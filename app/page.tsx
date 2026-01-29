'use client';

import { BuildingList } from '@/components/building-list';
import { CampusMap } from '@/components/campus-map';
import { Header } from '@/components/header';
import { TimeSelector } from '@/components/time-selector';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useIsMobile } from '@/hooks/use-mobile';
import { loadBuildings, getBuildingOccupancy, Building } from '@/lib/fiu-data';
import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';

export default function Home() {
  const isMobile = useIsMobile();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);

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
    <div className="flex h-screen flex-col overflow-hidden bg-black">
      <Header />

      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-lg">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-neutral-700 border-t-foreground" />
            <p className="text-sm text-muted-foreground">Loading campus data...</p>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-hidden p-0 lg:p-3">
        <div className="lg:rounded-xl bg-neutral-950 h-full flex flex-col lg:px-6 lg:py-5 px-0 py-0">

          {/* Controls section */}
          <div className="mb-4 flex flex-col gap-3 lg:mb-6 px-4 lg:px-0 py-4">
            {/* Mobile: First row with live and location buttons only */}
            <div className="flex lg:hidden gap-2 items-center">
              {/* Live button */}
              <div className="relative">
                <button
                  onClick={() => {
                    const newDate = new Date();
                    handleDateChange(newDate);
                    handleLiveChange(true);
                  }}
                  className={`h-9 px-3 rounded-md border transition-colors cursor-pointer gap-2 flex items-center text-sm font-medium ${isLive
                    ? 'border-success/50 text-success bg-transparent'
                    : 'border-neutral-800 bg-transparent text-muted-foreground hover:bg-neutral-900/50 hover:text-foreground'
                    }`}
                >
                  {isRefreshing ? (
                    <svg className="h-3 w-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : isLive ? (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                    </span>
                  ) : null}
                  {isLive ? 'Live' : 'Now'}
                </button>
                {!isLive && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-warning" />
                )}
              </div>

              {/* Location button */}
              <button
                onClick={handleLocationToggle}
                disabled={locationLoading}
                className={`flex h-9 w-9 items-center justify-center rounded-md border transition-colors cursor-pointer ${locationEnabled
                  ? 'border-blue-500/50 bg-blue-500/10 text-blue-500'
                  : 'border-neutral-800 bg-transparent text-muted-foreground hover:bg-neutral-900/50 hover:text-foreground'
                  }`}
                title={locationEnabled ? 'Disable location' : 'Share your location'}
              >
                {locationLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Mobile: Second row with time selection */}
            <div className="lg:hidden w-full">
              <TimeSelector
                selectedDate={selectedDate}
                onDateChange={handleDateChange}
                isLive={isLive}
                onLiveChange={handleLiveChange}
                isRefreshing={isRefreshing}
              />
            </div>

            {/* Desktop: Single row with live button, location button, time selector, and stats */}
            <div className="hidden lg:flex flex-row items-center justify-between gap-4">
              <div className="flex gap-2 items-center">
                {/* Live button */}
                <div className="relative">
                  <button
                    onClick={() => {
                      const newDate = new Date();
                      handleDateChange(newDate);
                      handleLiveChange(true);
                    }}
                    className={`h-9 px-3 rounded-md border transition-colors cursor-pointer gap-2 flex items-center text-sm font-medium ${isLive
                      ? 'border-success/50 text-success bg-transparent'
                      : 'border-neutral-800 bg-transparent text-muted-foreground hover:bg-neutral-900/50 hover:text-foreground'
                      }`}
                  >
                    {isRefreshing ? (
                      <svg className="h-3 w-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : isLive ? (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                      </span>
                    ) : null}
                    {isLive ? 'Live' : 'Now'}
                  </button>
                  {!isLive && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-warning" />
                  )}
                </div>

                {/* Location button */}
                <button
                  onClick={handleLocationToggle}
                  disabled={locationLoading}
                  className={`flex h-9 w-9 items-center justify-center rounded-md border transition-colors cursor-pointer ${locationEnabled
                    ? 'border-blue-500/50 bg-blue-500/10 text-blue-500'
                    : 'border-neutral-800 bg-transparent text-muted-foreground hover:bg-neutral-900/50 hover:text-foreground'
                    }`}
                  title={locationEnabled ? 'Disable location' : 'Share your location'}
                >
                  {locationLoading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>

                {/* Time selector */}
                <div className="border-neutral-800">
                  <TimeSelector
                    selectedDate={selectedDate}
                    onDateChange={handleDateChange}
                    isLive={isLive}
                    onLiveChange={handleLiveChange}
                    isRefreshing={isRefreshing}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{campusStats.available}</span> available
                  </span>
                </div>
                <div className="h-3 w-px bg-border" />
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-destructive" />
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{campusStats.occupied}</span> in use
                  </span>
                </div>
                <div className="h-3 w-px bg-border" />
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground">{buildings.length}</span> buildings
                </span>
              </div>
            </div>
          </div>

          {/* Main content - Split layout with resizable panels */}
          <ResizablePanelGroup direction={isMobile ? 'vertical' : 'horizontal'} className="flex-1 overflow-hidden gap-4 lg:gap-0">
            {/* Buildings List - Left on desktop, bottom on mobile */}
            <ResizablePanel collapsible defaultSize={50} minSize={20} className="lg:min-w-0 px-4 lg:px-0 lg:pr-3">
              <div className="w-full h-full flex flex-col overflow-hidden">
                {/* Search bar */}
                <div className="mb-3">
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search buildings or rooms..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-neutral-800 bg-neutral-950 py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-700"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                {isLoading ? (
                  <div className="flex items-center justify-center h-32 rounded-lg border border-neutral-800 bg-neutral-950">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                      Loading buildings...
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <BuildingList
                      buildings={buildings}
                      selectedDate={selectedDate}
                      selectedBuildingId={selectedBuildingId || undefined}
                      onBuildingSelect={handleBuildingListSelect}
                      searchQuery={searchQuery}
                    />
                  </div>
                )}
              </div>
            </ResizablePanel>

            {/* Divider */}
            <ResizableHandle withHandle className="px-2 lg:px-0 lg:py-2" />

            {/* Map - Right on desktop, top on mobile */}
            <ResizablePanel collapsible defaultSize={50} minSize={20} className="lg:min-w-0 lg:px-0 lg:pl-3">
              <div className="w-full h-full flex flex-col overflow-hidden">
                <CampusMap
                  buildings={buildings}
                  selectedDate={selectedDate}
                  selectedBuildingId={selectedBuildingId || undefined}
                  onBuildingSelect={handleBuildingSelect}
                  userLocation={userLocation}
                />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>

          {/* Footer inside the container */}
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-center text-xs text-muted-foreground">
              Atlas uses FIU class schedule data. Room availability is estimated based on scheduled classes.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
