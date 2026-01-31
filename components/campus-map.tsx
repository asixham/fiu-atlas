'use client';

import { Building, getBuildingOccupancy } from '@/lib/fiu-data';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { InfoIcon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

const PERFORMANCE_MODE_STORAGE_KEY = 'fiu-atlas-performance-mode';

interface CampusMapProps {
  buildings: Building[];
  selectedDate: Date;
  selectedBuildingId?: string;
  onBuildingSelect?: (building: Building) => void;
  userLocation?: [number, number] | null;
  isMobile?: boolean;
}

export function CampusMap({
  buildings,
  selectedDate,
  selectedBuildingId,
  onBuildingSelect,
  userLocation,
  isMobile = false,
}: CampusMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const pinnedBuildingRef = useRef<string | null>(null);
  const resizeTimeoutRef = useRef<number | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isPerformanceMode, setIsPerformanceMode] = useState<boolean | null>(null);
  const [performanceModalOpen, setPerformanceModalOpen] = useState(false);
  const [manualPerformanceOverride, setManualPerformanceOverride] = useState<boolean | null>(null);
  const [manualOverrideLoaded, setManualOverrideLoaded] = useState(false);

  // FIU MMC campus center coordinates
  const FIU_CENTER: [number, number] = [-80.37621507143407, 25.75677363629563];

  useEffect(() => {
    // Fetch token from server API to avoid exposing in client bundle
    fetch('/api/mapbox-token')
      .then((res) => res.json())
      .then((data) => {
        if (data.token) {
          setMapboxToken(data.token);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch Mapbox token:', err);
      });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedValue = window.localStorage.getItem(PERFORMANCE_MODE_STORAGE_KEY);
    if (storedValue === 'true') {
      setManualPerformanceOverride(true);
    } else if (storedValue === 'false') {
      setManualPerformanceOverride(false);
    }

    setManualOverrideLoaded(true);
  }, []);

  useEffect(() => {
    if (!manualOverrideLoaded || typeof window === 'undefined') return;

    if (manualPerformanceOverride === null) {
      window.localStorage.removeItem(PERFORMANCE_MODE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(
        PERFORMANCE_MODE_STORAGE_KEY,
        manualPerformanceOverride ? 'true' : 'false',
      );
    }
  }, [manualPerformanceOverride, manualOverrideLoaded]);

  useEffect(() => {
    if (typeof window === 'undefined' || !manualOverrideLoaded) return;

    if (manualPerformanceOverride !== null) {
      setIsPerformanceMode(manualPerformanceOverride);
      return;
    }

    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const detectPerformanceNeeds = (prefersReducedMotion: boolean) => {
      const lowCores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency < 4 : false;
      const deviceMemory = typeof navigator !== 'undefined' && 'deviceMemory' in navigator ? (navigator as unknown as { deviceMemory?: number }).deviceMemory : undefined;
      const lowMemory = typeof deviceMemory === 'number' ? deviceMemory < 4 : false;

      const shouldReduce = prefersReducedMotion || lowCores || lowMemory;
      setIsPerformanceMode(shouldReduce);
    };

    detectPerformanceNeeds(mediaQuery?.matches ?? false);

    const handleChange = (event: MediaQueryListEvent) => {
      detectPerformanceNeeds(event.matches);
    };

    if (mediaQuery) {
      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handleChange);
      } else if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(handleChange);
      }
    }

    return () => {
      if (!mediaQuery) return;
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handleChange);
      } else if (typeof mediaQuery.removeListener === 'function') {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [isMobile, manualPerformanceOverride, manualOverrideLoaded]);

  const effectivePerformanceMode = useMemo(() => {
    if (manualPerformanceOverride !== null) {
      return manualPerformanceOverride;
    }
    return isPerformanceMode;
  }, [isPerformanceMode, manualPerformanceOverride]);

  const getMarkerColor = useCallback(
    (building: Building) => {
      const occupancy = getBuildingOccupancy(building, selectedDate);
      if (occupancy.available === 0) return '#ef4444'; // red - full
      if (occupancy.percentage >= 75) return '#f59e0b'; // yellow - limited
      return '#22c55e'; // green - available
    },
    [selectedDate]
  );

  const createPopupContent = useCallback(
    (building: Building) => {
      const occupancy = getBuildingOccupancy(building, selectedDate);
      const percentage =
        occupancy.total > 0
          ? Math.round((occupancy.available / occupancy.total) * 100)
          : 0;

      const getStatus = () => {
        if (occupancy.available === 0)
          return { text: 'Full', barColor: '#ef4444' };
        if (occupancy.percentage >= 75)
          return { text: 'Limited', barColor: '#f59e0b' };
        return { text: 'Available', barColor: '#22c55e' };
      };
      const status = getStatus();

      // Google Maps directions URL
      const directionsUrl = (() => {
        const base = 'https://www.google.com/maps/dir/?api=1';
        const destination = `destination=${building.coordinates[1]},${building.coordinates[0]}`;
        const travel = 'travelmode=walking';
        if (userLocation) {
          const origin = `origin=${userLocation[1]},${userLocation[0]}`;
          return `${base}&${origin}&${destination}&${travel}`;
        }
        return `${base}&${destination}&${travel}`;
      })();

      const baseButtonStyle = 'display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 12px; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 500; text-decoration: none; transition: all 0.18s ease; border: 1px solid;';
      const buttonPalette = userLocation
        ? {
            baseBg: 'rgba(59,130,246,0.14)',
            baseBorder: 'rgba(96,165,250,0.55)',
            baseColor: '#bfdbfe',
            hoverBg: 'rgba(59,130,246,0.24)',
            hoverBorder: 'rgba(96,165,250,0.75)',
            hoverColor: '#e0f2fe',
          }
        : {
            baseBg: 'rgba(39,39,42,0.6)',
            baseBorder: 'rgba(63,63,70,0.8)',
            baseColor: '#d4d4d8',
            hoverBg: 'rgba(63,63,70,0.85)',
            hoverBorder: 'rgba(82,82,91,0.9)',
            hoverColor: '#f4f4f5',
          };
      const paletteStyle = `background: ${buttonPalette.baseBg}; border-color: ${buttonPalette.baseBorder}; color: ${buttonPalette.baseColor};`;
      const hoverHandlers = `onmouseover="this.style.background='${buttonPalette.hoverBg}'; this.style.borderColor='${buttonPalette.hoverBorder}'; this.style.color='${buttonPalette.hoverColor}';" onmouseout="this.style.background='${buttonPalette.baseBg}'; this.style.borderColor='${buttonPalette.baseBorder}'; this.style.color='${buttonPalette.baseColor}';"`;

      return `
        <div style="padding: 2px 0; min-width: 150px;">
          <div style="font-weight: 600; font-size: 13px; color: #fff; margin-bottom: 2px; white-space: nowrap;">${building.name}</div>
          <div style="font-size: 11px; color: #888; margin-bottom: 8px; font-family: monospace;">${building.shortName}</div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 11px; color: ${status.barColor}; font-weight: 600;">${status.text}</span>
            <span style="font-size: 11px; color: #888;">${occupancy.available}/${occupancy.total} rooms</span>
          </div>
          <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
            <div style="width: ${percentage}%; height: 100%; background: ${status.barColor}; border-radius: 2px;"></div>
          </div>
          <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" style="${baseButtonStyle} ${paletteStyle}" ${hoverHandlers}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
            </svg>
            Get Directions
          </a>
        </div>
      `;
    },
    [selectedDate, userLocation]
  );

  const updateMarkers = useCallback(() => {
    if (!map.current || !mapLoaded) return;

    // Store currently pinned building before removing markers
    const currentPinned = pinnedBuildingRef.current;

    // Remove existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Only remove popup if not pinned
    if (popupRef.current && !currentPinned) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    // Create a single reusable popup if none exists
    if (!popupRef.current) {
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 15,
        className: 'atlas-popup',
      });
      popupRef.current = popup;
    }

    const popup = popupRef.current;

    // Add new markers
    buildings.forEach((building) => {
      const color = getMarkerColor(building);
      const isSelected = selectedBuildingId === building.id;

      // Create simple marker element
      const el = document.createElement('div');
      const performanceModeActive = effectivePerformanceMode ?? false;
      const size = performanceModeActive ? (isSelected ? 10 : 6) : isSelected ? 12 : 8;
      const glowColor = performanceModeActive ? color + '40' : color + '80';

      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.backgroundColor = color;
      el.style.borderRadius = '50%';
      el.style.cursor = 'pointer';
      el.style.boxShadow = performanceModeActive ? `0 1px 4px ${glowColor}` : `0 0 2px 2px ${glowColor}`;
      el.style.transition = 'box-shadow 0.15s ease';
      if (isSelected) {
        el.style.zIndex = '10';
      }

      if (!performanceModeActive) {
        el.addEventListener('mouseenter', () => {
          el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
          // Only show on hover if no popup is pinned
          if (!pinnedBuildingRef.current) {
            popup
              .setLngLat(building.coordinates)
              .setHTML(createPopupContent(building))
              .addTo(map.current!);
          }
        });

        el.addEventListener('mouseleave', () => {
          el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.35)';
          // Only hide on mouseleave if this building's popup is not pinned
          if (pinnedBuildingRef.current !== building.id) {
            popup.remove();
          }
        });
      }

      el.addEventListener('click', (e) => {
        e.stopPropagation();

        // If clicking the same pinned building, unpin it
        if (pinnedBuildingRef.current === building.id) {
          pinnedBuildingRef.current = null;
          popup.remove();
        } else {
          // Pin this building's popup
          pinnedBuildingRef.current = building.id;
          popup
            .setLngLat(building.coordinates)
            .setHTML(createPopupContent(building))
            .addTo(map.current!);
        }

        onBuildingSelect?.(building);
      });

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat(building.coordinates)
        .addTo(map.current!);

      markersRef.current.push(marker);

      // Re-show popup for pinned building after marker recreation
      if (currentPinned === building.id && popup) {
        popup
          .setLngLat(building.coordinates)
          .setHTML(createPopupContent(building))
          .addTo(map.current!);
      }
    });
  }, [
    buildings,
    selectedDate,
    selectedBuildingId,
    getMarkerColor,
    createPopupContent,
    onBuildingSelect,
    mapLoaded,
    effectivePerformanceMode,
  ]);

  // Pan to selected building and show pinned popup
  useEffect(() => {
    if (!map.current || !mapLoaded || !selectedBuildingId) return;

    const building = buildings.find((b) => b.id === selectedBuildingId);
    if (building) {
      map.current.flyTo({
        center: building.coordinates,
        zoom: 17,
        duration: 800,
        pitch: 20
      });

      // Auto-pin the popup when a building is selected
      pinnedBuildingRef.current = building.id;
      if (popupRef.current) {
        popupRef.current
          .setLngLat(building.coordinates)
          .setHTML(createPopupContent(building))
          .addTo(map.current);
      }
    }
  }, [selectedBuildingId, mapLoaded, buildings, createPopupContent]);

  // User location marker
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove existing user marker
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (!userLocation) return;

    // Create user location marker (blue pulsing dot)
    const el = document.createElement('div');
    el.innerHTML = `
      <div style="position: relative; width: 20px; height: 20px;">
        <div style="position: absolute; inset: 0; background: rgba(59, 130, 246, 0.3); border-radius: 50%; animation: pulse 2s infinite;"></div>
        <div style="position: absolute; inset: 4px; background: #3b82f6; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>
      </div>
      <style>
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
        }
      </style>
    `;

    userMarkerRef.current = new mapboxgl.Marker({
      element: el,
      anchor: 'center',
    })
      .setLngLat(userLocation)
      .addTo(map.current);

  }, [userLocation, mapLoaded]);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || map.current || effectivePerformanceMode === null) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: effectivePerformanceMode ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/standard',
      config: {
        basemap: {
          lightPreset: effectivePerformanceMode ? 'dusk' : 'dusk',
        }
      },
      center: FIU_CENTER,
      zoom: effectivePerformanceMode ? 15.5 : 16,
      pitch: effectivePerformanceMode ? 0 : 70,
      bearing: effectivePerformanceMode ? 0 : 60,
      dragRotate: !effectivePerformanceMode,
      touchZoomRotate: !effectivePerformanceMode,
    });

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    // Close pinned popup when clicking on the map (not on a marker)
    map.current.on('click', () => {
      if (pinnedBuildingRef.current && popupRef.current) {
        pinnedBuildingRef.current = null;
        popupRef.current.remove();
      }
    });

    // Add ResizeObserver to handle container size changes (e.g., from resizable panels)
    const resizeObserver = new ResizeObserver(() => {
      if (!map.current) return;

      setIsResizing(true);
      map.current.resize();

      if (resizeTimeoutRef.current !== null) {
        window.clearTimeout(resizeTimeoutRef.current);
      }

      resizeTimeoutRef.current = window.setTimeout(() => {
        map.current?.resize();
        setIsResizing(false);
        resizeTimeoutRef.current = null;
      }, 200);
    });

    resizeObserver.observe(mapContainer.current);

    return () => {
      resizeObserver.disconnect();
      if (resizeTimeoutRef.current !== null) {
        window.clearTimeout(resizeTimeoutRef.current);
        resizeTimeoutRef.current = null;
      }
      map.current?.remove();
      map.current = null;
    };
  }, [mapboxToken, effectivePerformanceMode]);

  useEffect(() => {
    if (!map.current || effectivePerformanceMode === null) return;

    if (effectivePerformanceMode) {
      map.current.dragRotate.disable();
      map.current.touchZoomRotate.disableRotation();
      map.current.easeTo({ pitch: 0, bearing: 0, duration: 400 });
    } else {
      map.current.dragRotate.enable();
      map.current.touchZoomRotate.enableRotation();
      map.current.easeTo({ pitch: 70, bearing: 60, duration: 600 });
    }
  }, [effectivePerformanceMode]);

  useEffect(() => {
    updateMarkers();
  }, [updateMarkers]);

  if (!mapboxToken) {
    return (
      <div className={`relative h-full w-full overflow-hidden border border-border bg-neutral-950 ${isMobile ? 'rounded-lg' : ''}`}>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900">
            <svg
              className="h-7 w-7 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-medium text-foreground">
              Campus Map
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Add MAPBOX_TOKEN to enable the map
            </p>
          </div>
          {/* Static building indicators */}
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {buildings.slice(0, 8).map((building) => {
              const color = getMarkerColor(building);
              const isSelected = selectedBuildingId === building.id;
              return (
                <button
                  key={building.id}
                  onClick={() => onBuildingSelect?.(building)}
                  className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] transition-colors cursor-pointer ${isSelected
                    ? 'border-neutral-700 bg-neutral-900'
                    : 'border-neutral-800 bg-neutral-950 hover:bg-neutral-900/50'
                    }`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {building.shortName}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative h-full w-full overflow-hidden border border-border ${isMobile ? 'rounded-lg' : ''}`}>
      <div ref={mapContainer} className="h-full w-full" />
      {isResizing && (
        <div className="pointer-events-none z-10 absolute inset-0 flex items-center justify-center bg-zinc-950 backdrop-blur-sm text-xs font-medium text-muted-foreground">
          Release to update map view
        </div>
      )}
      <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-zinc-900/80 px-4 py-2 text-sm font-medium text-muted-foreground">
        <span>
          {effectivePerformanceMode ? 'Performance mode enabled' : 'Performance mode off'}
        </span>
        <button
          type="button"
          className="flex cursor-pointer h-6 w-6 items-center justify-center rounded-full bg-zinc-800/80 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setPerformanceModalOpen(true)}
        >
          <InfoIcon className="h-3.5 w-3.5" />
          <span className="sr-only">Performance mode info</span>
        </button>
      </div>
      <Dialog open={performanceModalOpen} onOpenChange={setPerformanceModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-4xl">
          <DialogHeader>
            <DialogTitle>Performance mode</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 text-sm text-muted-foreground">
            <p>Your device might benefit from a lighter map experience. Performance mode reduces visual effects to keep things responsive.</p>
            <p>This mode lowers map detail, disables 3D rotation, and simplifies markers so older or battery-constrained devices render the map smoothly.</p>
            <div className="flex items-center justify-between rounded-full bg-zinc-800 px-6 py-3">
              <div>
                <p className="text-foreground text-sm font-medium">Performance mode</p>
                <p className="text-xs text-muted-foreground">Toggle to balance smoothness and visuals.</p>
              </div>
              <Switch
                checked={effectivePerformanceMode ?? false}
                onCheckedChange={(checked) => {
                  setManualPerformanceOverride(checked);
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className='rounded-full' onClick={() => {
              setManualPerformanceOverride(null);
              setPerformanceModalOpen(false);
            }}>
              Reset to automatic
            </Button>
            <Button variant="default" className='rounded-full' onClick={() => setPerformanceModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Legend */}
      <div className="absolute bottom-10 left-3 rounded-full bg-zinc-900/80 px-4 py-2 backdrop-blur-sm text-sm font-medium text-muted-foreground">
        <div className="flex flex-row gap-5">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
            Available
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
            Limited
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-[#ef4444]" />
            Full
          </div>
        </div>
      </div>
    </div>
  );
}
