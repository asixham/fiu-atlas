import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

type PerformanceResult = {
  shouldUseLiteMode: boolean;
  fps: number | null;
};

type MapboxPerformanceTestOptions = {
  cacheKey?: string;
  durationMs?: number;
  fpsThreshold?: number;
  enableLogging?: boolean;
  accessToken?: string | null;
};

const DEFAULT_OPTIONS = {
  cacheKey: 'mapbox-lite-mode',
  durationMs: 2500,
  fpsThreshold: 25,
  enableLogging: false,
} satisfies Required<Omit<MapboxPerformanceTestOptions, 'accessToken'>>;

const isBrowser = typeof window !== 'undefined';

const parseCachedResult = (raw: string | null): PerformanceResult | null => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PerformanceResult;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.shouldUseLiteMode === 'boolean' &&
      (parsed.fps === null || typeof parsed.fps === 'number')
    ) {
      return parsed;
    }
  } catch (error) {
    console.warn('Failed to parse cached map performance result:', error);
  }

  return null;
};

export const useMapboxPerformanceTest = (
  options?: MapboxPerformanceTestOptions
) => {
  const { cacheKey, durationMs, fpsThreshold, enableLogging, accessToken } = useMemo(
    () => ({ ...DEFAULT_OPTIONS, ...options }),
    [options]
  );

  const [result, setResult] = useState<PerformanceResult | null>(() => {
    if (!isBrowser) return null;
    const cached = parseCachedResult(window.localStorage.getItem(cacheKey));
    return cached;
  });
  const [isTesting, setIsTesting] = useState(() => !Boolean(result));
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isBrowser) return;

    const resolvedToken = accessToken ?? mapboxgl.accessToken;
    if (!resolvedToken) {
      return;
    }

    mapboxgl.accessToken = resolvedToken;

    if (result) {
      setIsTesting(false);
      return;
    }

    let isCancelled = false;

    const runBenchmark = async () => {
      const container = document.createElement('div');
      container.style.width = '480px';
      container.style.height = '320px';
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.zIndex = '-1';
      container.setAttribute('data-mapbox-performance-container', 'true');
      document.body.appendChild(container);

      let map: mapboxgl.Map | null = null;

      const dispose = () => {
        if (map) {
          map.remove();
          map = null;
        }
        if (container.parentElement) {
          container.parentElement.removeChild(container);
        }
      };

      cleanupRef.current = dispose;

      try {
        map = new mapboxgl.Map({
          container,
          style: 'mapbox://styles/mapbox/standard',
          center: [-80.3762, 25.7568],
          zoom: 15,
          pitch: 60,
          bearing: -20,
          interactive: false,
        });

        await new Promise<void>((resolve) => {
          map!.on('load', () => resolve());
        });

        if (isCancelled) {
          dispose();
          return;
        }

        // Stress test with 3D buildings similar to production style
        if (!map.getSource('composite')) {
          map.addSource('composite', {
            type: 'vector',
            url: 'mapbox://mapbox.mapbox-streets-v8',
          });
        }

        if (!map.getLayer('performance-3d-buildings')) {
          map.addLayer({
            id: 'performance-3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            filter: ['==', ['get', 'extrude'], 'true'],
            type: 'fill-extrusion',
            minzoom: 15,
            paint: {
              'fill-extrusion-color': '#aaa',
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-base': ['get', 'min_height'],
              'fill-extrusion-opacity': 0.6,
            },
          });
        }

        let frames = 0;
        const startTime = performance.now();
        const endTime = startTime + durationMs;

        const animate = () => {
          if (isCancelled || !map) return;

          const now = performance.now();
          if (now < endTime) {
            frames++;
            const rotation = (frames * 0.45) % 360;
            map.rotateTo(rotation, { duration: 0 });
            requestAnimationFrame(animate);
            return;
          }

          const elapsedSeconds = (now - startTime) / 1000;
          const fps = frames / elapsedSeconds;
          const shouldUseLiteMode = fps < fpsThreshold;

          if (enableLogging) {
            console.log(`Mapbox benchmark FPS: ${fps.toFixed(2)}`);
          }

          const finalResult: PerformanceResult = {
            shouldUseLiteMode,
            fps,
          };

          window.localStorage.setItem(cacheKey, JSON.stringify(finalResult));
          setResult(finalResult);
          setIsTesting(false);
          dispose();
        };

        requestAnimationFrame(animate);
      } catch (error) {
        console.error('Mapbox performance benchmark failed:', error);
        window.localStorage.setItem(
          cacheKey,
          JSON.stringify({ shouldUseLiteMode: true, fps: null })
        );
        setResult({ shouldUseLiteMode: true, fps: null });
        setIsTesting(false);
        dispose();
      }
    };

    runBenchmark();

    return () => {
      isCancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [accessToken, cacheKey, durationMs, enableLogging, fpsThreshold, result]);

  return {
    shouldUseLiteMode: result?.shouldUseLiteMode ?? null,
    fps: result?.fps ?? null,
    isTesting,
  };
};
