'use client';

import { BuildingList } from '@/components/building-list';
import { TimeSelector } from '@/components/time-selector';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ResizablePanel } from '@/components/ui/resizable';
import { Building } from '@/lib/fiu-data';
import { Header } from '@/components/header';

interface BuildingListPanelProps {
  buildings: Building[];
  selectedDate: Date;
  selectedBuildingId?: string;
  onBuildingSelect: (buildingId: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isLoading: boolean;
  locationEnabled: boolean;
  locationLoading: boolean;
  onLocationToggle: () => void;
  isLive: boolean;
  isRefreshing: boolean;
  isTimeSelectorOpen: boolean;
  onTimeSelectorOpenChange: (open: boolean) => void;
  onDateChange: (date: Date) => void;
  onLiveChange: (live: boolean) => void;
}

export function BuildingListPanel({
  buildings,
  selectedDate,
  selectedBuildingId,
  onBuildingSelect,
  searchQuery,
  onSearchChange,
  isLoading,
  locationEnabled,
  locationLoading,
  onLocationToggle,
  isLive,
  isRefreshing,
  isTimeSelectorOpen,
  onTimeSelectorOpenChange,
  onDateChange,
  onLiveChange,
}: BuildingListPanelProps) {
  return (
    <ResizablePanel key="building-list" defaultSize={50} minSize={20} collapsible className="flex flex-col overflow-hidden pt-4">
      <div className="flex flex-col overflow-hidden h-full">
        <Header />
        {/* Controls */}
        <div className="flex items-center px-4 gap-3 py-4">
          {/* Search - full width */}
          <div className="relative w-full">
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
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{ fontSize: '16px' }}
              className="h-9 w-full rounded-lg border border-zinc-700 py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Combined Live indicator + Time picker - always visible */}
          <Popover open={isTimeSelectorOpen} onOpenChange={onTimeSelectorOpenChange}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="h-9 px-3 rounded-md border border-zinc-700 bg-transparent text-muted-foreground hover:bg-zinc-800 hover:text-foreground transition-colors cursor-pointer text-sm flex items-center gap-2 w-fit"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {/* Live indicator - clickable to activate live mode */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Always set back to live mode when clicked
                      const newDate = new Date();
                      onDateChange(newDate);
                      onLiveChange(true);
                    }}
                    className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-colors ${isLive
                      ? 'text-green-500 hover:text-green-400'
                      : 'text-zinc-500 hover:text-zinc-400'
                      }`}
                  >
                    {isRefreshing ? (
                      <svg className="h-3 w-3 animate-spin flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : isLive ? (
                      <span className="relative flex h-2 w-2 flex-shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                      </span>
                    ) : (
                      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-zinc-500" />
                    )}
                    <span className="text-xs font-medium whitespace-nowrap">Live</span>
                  </button>
                  {/* Date and time */}
                  <span className="text-xs whitespace-nowrap truncate">
                    {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {selectedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {/* Clock icon */}
                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth={2} />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
                </svg>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4 bg-zinc-800 border-zinc-700" align="end">
              <TimeSelector
                selectedDate={selectedDate}
                onDateChange={onDateChange}
                isLive={isLive}
                onLiveChange={onLiveChange}
                isRefreshing={isRefreshing}
              />
            </PopoverContent>
          </Popover>

          {/* Location button - always visible */}
          <button
            type="button"
            onClick={onLocationToggle}
            disabled={locationLoading}
            className={`flex h-9 w-9 items-center justify-center rounded-md border px-2 transition-colors cursor-pointer ${locationEnabled
              ? 'border-blue-600/50 bg-blue-500/10 text-blue-400'
              : 'border-zinc-700 bg-transparent text-muted-foreground hover:bg-zinc-800 hover:text-foreground'
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

        {/* List */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-foreground" />
                Loading buildings...
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4">
              <BuildingList
                buildings={buildings}
                selectedDate={selectedDate}
                selectedBuildingId={selectedBuildingId}
                onBuildingSelect={onBuildingSelect}
                searchQuery={searchQuery}
              />
            </div>
          )}
        </div>
      </div>
    </ResizablePanel>
  );
}

