'use client';

import { BuildingListPanel } from '@/components/building-list-panel';
import { MapPanel } from '@/components/map-panel';
import { ResizablePanelGroup, ResizableHandle } from '@/components/ui/resizable';
import { loadBuildings, getBuildingOccupancy, Building } from '@/lib/fiu-data';
import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/header';
import useSWR from 'swr';

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [isTimeSelectorOpen, setIsTimeSelectorOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1500);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleLocationToggle = useCallback(() => {
    if (locationEnabled) {
      // Disable location
      setLocationEnabled(false);
      setUserLocation(null);
      return;
    }

    // Enable location
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation([position.coords.longitude, position.coords.latitude]);
        setLocationEnabled(true);
        setLocationLoading(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        setLocationLoading(false);
        alert('Unable to get your location. Please check your browser permissions.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [locationEnabled]);

  const { data: buildings = [], isLoading, mutate } = useSWR('buildings', loadBuildings, {
    revalidateOnFocus: false,
  });

  // Live refresh - update time every minute when in live mode
  useEffect(() => {
    if (!isLive) return;

    const refreshData = async () => {
      setIsRefreshing(true);
      setSelectedDate(new Date());
      await mutate();
      // Small delay to show the spinner
      setTimeout(() => setIsRefreshing(false), 500);
    };

    // Initial sync to current time
    setSelectedDate(new Date());

    const interval = setInterval(refreshData, 60000); // Every 1 minute

    return () => clearInterval(interval);
  }, [isLive, mutate]);

  // Calculate overall campus stats
  const campusStats = buildings.reduce(
    (acc, building) => {
      const occupancy = getBuildingOccupancy(building, selectedDate);
      return {
        total: acc.total + occupancy.total,
        available: acc.available + occupancy.available,
        occupied: acc.occupied + occupancy.occupied,
      };
    },
    { total: 0, available: 0, occupied: 0 }
  );

  const handleBuildingSelect = (building: Building) => {
    setSelectedBuildingId(building.id === selectedBuildingId ? null : building.id);
  };

  const handleBuildingListSelect = (buildingId: string | null) => {
    setSelectedBuildingId(buildingId);
  };

  const handleDateChange = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const handleLiveChange = useCallback((live: boolean) => {
    setIsLive(live);
    if (live) {
      setSelectedDate(new Date());
    }
  }, []);

  return (
    <div className="flex h-dvh z-50 flex-col overflow-hidden bg-zinc-900">
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-900 backdrop-blur-lg">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-700 border-t-foreground" />
            <Header />
            {/* <p className="text-sm text-muted-foreground">Loading campus data...</p> */}
          </div>
        </div>
      )}

      <main className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction={isMobile ? 'vertical' : 'horizontal'} className="h-full">
          {/* On mobile: map first, then handle, then building list */}
          {/* On desktop: building list first, then handle, then map */}
          {isMobile ? (
            <>
              <MapPanel
                buildings={buildings}
                selectedDate={selectedDate}
                selectedBuildingId={selectedBuildingId || undefined}
                onBuildingSelect={handleBuildingSelect}
                userLocation={userLocation}
                isMobile={isMobile}
              />
              <ResizableHandle key="handle" withHandle className="h-1 p-4 bg-transparent hover:bg-zinc-800/30 transition-colors" />
              <BuildingListPanel
                buildings={buildings}
                selectedDate={selectedDate}
                selectedBuildingId={selectedBuildingId || undefined}
                onBuildingSelect={handleBuildingListSelect}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                isLoading={isLoading}
                locationEnabled={locationEnabled}
                locationLoading={locationLoading}
                onLocationToggle={handleLocationToggle}
                isLive={isLive}
                isRefreshing={isRefreshing}
                isTimeSelectorOpen={isTimeSelectorOpen}
                onTimeSelectorOpenChange={setIsTimeSelectorOpen}
                onDateChange={handleDateChange}
                onLiveChange={handleLiveChange}
              />
            </>
          ) : (
            <>
              <BuildingListPanel
                buildings={buildings}
                selectedDate={selectedDate}
                selectedBuildingId={selectedBuildingId || undefined}
                onBuildingSelect={handleBuildingListSelect}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                isLoading={isLoading}
                locationEnabled={locationEnabled}
                locationLoading={locationLoading}
                onLocationToggle={handleLocationToggle}
                isLive={isLive}
                isRefreshing={isRefreshing}
                isTimeSelectorOpen={isTimeSelectorOpen}
                onTimeSelectorOpenChange={setIsTimeSelectorOpen}
                onDateChange={handleDateChange}
                onLiveChange={handleLiveChange}
              />
              <ResizableHandle key="handle" withHandle className="w-11 p-4 bg-transparent transition-colors" />
              <MapPanel
                buildings={buildings}
                selectedDate={selectedDate}
                selectedBuildingId={selectedBuildingId || undefined}
                onBuildingSelect={handleBuildingSelect}
                userLocation={userLocation}
                isMobile={isMobile}
              />
            </>
          )}
        </ResizablePanelGroup>
      </main>
    </div >
  );
}
