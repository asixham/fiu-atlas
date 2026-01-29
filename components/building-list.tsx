'use client';

import React, { useEffect, useRef } from "react"

import {
  Building,
  getBuildingOccupancy,
  getRoomsSortedByAvailability,
  getRoomStatus,
  formatTime,
} from '@/lib/fiu-data';
import { Building2, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { RoomTimeline } from './room-timeline';

interface BuildingListProps {
  buildings: Building[];
  selectedDate: Date;
  selectedBuildingId?: string;
  onBuildingSelect?: (buildingId: string | null) => void;
  searchQuery?: string;
}

export function BuildingList({
  buildings,
  selectedDate,
  selectedBuildingId,
  onBuildingSelect,
  searchQuery = '',
}: BuildingListProps) {
  const [expandedBuilding, setExpandedBuilding] = useState<string | null>(null);
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
  const buildingRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Sync expanded state with selectedBuildingId (for map clicks)
  useEffect(() => {
    if (selectedBuildingId && selectedBuildingId !== expandedBuilding) {
      setExpandedBuilding(selectedBuildingId);
      setExpandedRoom(null);
      // Scroll the building into view
      setTimeout(() => {
        buildingRefs.current[selectedBuildingId]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }, 100);
    } else if (!selectedBuildingId && expandedBuilding) {
      setExpandedBuilding(null);
      setExpandedRoom(null);
    }
  }, [selectedBuildingId]);

  const handleBuildingClick = (buildingId: string) => {
    const newExpanded = expandedBuilding === buildingId ? null : buildingId;
    setExpandedBuilding(newExpanded);
    setExpandedRoom(null); // Close any open room when switching buildings
    onBuildingSelect?.(newExpanded);
  };

  const handleRoomClick = (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRoom(expandedRoom === roomId ? null : roomId);
  };

  // Filter buildings based on search query
  const query = searchQuery.toLowerCase().trim();
  const filteredBuildings = buildings.filter((building) => {
    if (!query) return true;

    // Match building name or short name
    if (building.name.toLowerCase().includes(query)) return true;
    if (building.shortName.toLowerCase().includes(query)) return true;

    // Match any room number
    const hasMatchingRoom = building.rooms.some((room) =>
      room.number.toLowerCase().includes(query)
    );
    return hasMatchingRoom;
  });

  // Sort buildings by availability (most available first)
  const sortedBuildings = [...filteredBuildings].sort((a, b) => {
    const aOcc = getBuildingOccupancy(a, selectedDate);
    const bOcc = getBuildingOccupancy(b, selectedDate);
    return bOcc.available - aOcc.available;
  });

  if (sortedBuildings.length === 0 && query) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-2 text-muted-foreground">
          <svg className="mx-auto h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <p className="text-sm text-muted-foreground">No results found for "{searchQuery}"</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Try searching for a building name or room number</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {sortedBuildings.map((building) => {
        const occupancy = getBuildingOccupancy(building, selectedDate);
        const isExpanded = expandedBuilding === building.id;
        const isSelected = selectedBuildingId === building.id;
        const rooms = getRoomsSortedByAvailability(building, selectedDate);

        // Determine status styling
        const getStatusStyles = () => {
          if (occupancy.available === 0) {
            return 'bg-destructive/15 border-destructive/50 text-destructive';
          }
          if (occupancy.percentage >= 75) {
            return 'bg-warning/15 border-warning/50 text-warning';
          }
          return 'bg-success/15 border-success/50 text-success';
        };

        const getStatusText = () => {
          if (occupancy.available === 0) return 'Full';
          if (occupancy.percentage >= 75) return 'Limited';
          return 'Available';
        };

        return (
          <div
            key={building.id}
            ref={(el) => { buildingRefs.current[building.id] = el; }}
            className={cn(
              'rounded-lg border border-zinc-700 bg-zinc-900 transition-all',
              isSelected && 'border-zinc-700 ring-1 ring-zinc-700/30'
            )}
          >
            {/* Building Header */}
            <button
              onClick={() => handleBuildingClick(building.id)}
              className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-zinc-800 cursor-pointer"
            >
              {/* <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-900">
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div> */}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {building.shortName}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                      getStatusStyles()
                    )}
                  >
                    {getStatusText()}
                  </span>
                </div>
                <h3 className="truncate text-sm font-medium text-foreground">
                  {building.name}
                </h3>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {/* Radial Progress */}
                <div className="relative h-10 w-10">
                  <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                    {/* Background circle */}
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="text-zinc-700"
                    />
                    {/* Progress circle */}
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`${((100 - occupancy.percentage) / 100) * 87.96} 87.96`}
                      className={cn(
                        occupancy.available === 0
                          ? 'text-destructive'
                          : occupancy.percentage >= 75
                            ? 'text-warning'
                            : 'text-success'
                      )}
                    />
                  </svg>
                  {/* Percentage text */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-semibold text-foreground">
                      {Math.round(100 - occupancy.percentage)}%
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-muted-foreground transition-transform',
                    isExpanded && 'rotate-180'
                  )}
                />
              </div>
            </button>

            {/* Rooms Dropdown */}
            {isExpanded && (
              <div className="border-t border-zinc-800">
                <div className="max-h-80 overflow-y-auto custom-scrollbar">
                  {rooms.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No room data available
                    </div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {rooms.map((room) => {
                        const status = getRoomStatus(room, selectedDate);
                        const isRoomExpanded = expandedRoom === room.id;

                        return (
                          <div
                            key={room.id}
                            className={cn(
                              'transition-colors bg-zinc-800/30',
                              status.isOccupied ? 'border-l-2 border-l-destructive/30' : 'border-l-2 border-l-success/30'
                            )}
                          >
                            {/* Room Header */}
                            <button
                              onClick={(e) => handleRoomClick(room.id, e)}
                              className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-zinc-700/40 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-3">
                                <span
                                  className={cn(
                                    'h-2 w-2 rounded-full shrink-0',
                                    status.isOccupied ? 'bg-destructive' : 'bg-success'
                                  )}
                                />
                                <div>
                                  <div className="text-sm font-medium text-foreground">
                                    Room {room.number}
                                  </div>
                                  {status.isOccupied && status.currentClass && (
                                    <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                                      {status.currentClass.className.split(' - ')[0]}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="text-xs text-right">
                                  {status.isOccupied ? (
                                    <span className="text-destructive">
                                      Until {formatTime(status.currentClass?.endTime || '')}
                                    </span>
                                  ) : status.nextClass ? (
                                    <span className="flex items-center gap-1 text-muted-foreground">
                                      <Clock className="h-3 w-3" />
                                      Free until {formatTime(status.nextClass.startTime)}
                                    </span>
                                  ) : (
                                    <span className="text-success">Free all day</span>
                                  )}
                                </div>
                                <ChevronUp
                                  className={cn(
                                    'h-3.5 w-3.5 text-muted-foreground transition-transform',
                                    !isRoomExpanded && 'rotate-180'
                                  )}
                                />
                              </div>
                            </button>

                            {/* Room Timeline */}
                            {isRoomExpanded && (
                              <div className="px-4 pb-3 pt-1 bg-zinc-700/20">
                                <RoomTimeline
                                  sessions={room.sessions}
                                  selectedDate={selectedDate}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
