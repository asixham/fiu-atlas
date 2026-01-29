'use client';

import React from "react"

import { ClassSession, formatTime } from '@/lib/fiu-data';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface RoomTimelineProps {
  sessions: ClassSession[];
  selectedDate: Date;
}

interface TimeBlock {
  startTime: string;
  endTime: string;
  isOccupied: boolean;
  session?: ClassSession;
  startPercent: number;
  widthPercent: number;
}

const DAY_START = 7; // 7 AM
const DAY_END = 22; // 10 PM
const TOTAL_HOURS = DAY_END - DAY_START;

function timeToPercent(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = (hours - DAY_START) * 60 + minutes;
  const maxMinutes = TOTAL_HOURS * 60;
  return Math.max(0, Math.min(100, (totalMinutes / maxMinutes) * 100));
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function RoomTimeline({ sessions, selectedDate }: RoomTimelineProps) {
  const [hoveredBlock, setHoveredBlock] = useState<TimeBlock | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const dayName = DAYS_OF_WEEK[selectedDate.getDay()];
  
  // Get today's sessions sorted by start time
  const todaySessions = sessions
    .filter((session) => session.days.includes(dayName))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Build time blocks for the day
  const blocks: TimeBlock[] = [];
  let currentTime = `${String(DAY_START).padStart(2, '0')}:00`;
  const endOfDay = `${String(DAY_END).padStart(2, '0')}:00`;

  for (const session of todaySessions) {
    // Add available block before this session if there's a gap
    if (timeToMinutes(session.startTime) > timeToMinutes(currentTime)) {
      const gapStart = currentTime;
      const gapEnd = session.startTime;
      blocks.push({
        startTime: gapStart,
        endTime: gapEnd,
        isOccupied: false,
        startPercent: timeToPercent(gapStart),
        widthPercent: timeToPercent(gapEnd) - timeToPercent(gapStart),
      });
    }

    // Add occupied block for this session
    const sessionStart = session.startTime < currentTime ? currentTime : session.startTime;
    blocks.push({
      startTime: sessionStart,
      endTime: session.endTime,
      isOccupied: true,
      session,
      startPercent: timeToPercent(sessionStart),
      widthPercent: timeToPercent(session.endTime) - timeToPercent(sessionStart),
    });

    currentTime = session.endTime;
  }

  // Add final available block if there's time left in the day
  if (timeToMinutes(currentTime) < timeToMinutes(endOfDay)) {
    blocks.push({
      startTime: currentTime,
      endTime: endOfDay,
      isOccupied: false,
      startPercent: timeToPercent(currentTime),
      widthPercent: timeToPercent(endOfDay) - timeToPercent(currentTime),
    });
  }

  // If no sessions today, show entire day as available
  if (blocks.length === 0) {
    blocks.push({
      startTime: `${String(DAY_START).padStart(2, '0')}:00`,
      endTime: endOfDay,
      isOccupied: false,
      startPercent: 0,
      widthPercent: 100,
    });
  }

  const handleMouseEnter = (block: TimeBlock, e: React.MouseEvent) => {
    setHoveredBlock(block);
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({ 
      x: rect.left + rect.width / 2, 
      y: rect.top - 8 
    });
  };

  const handleMouseLeave = () => {
    setHoveredBlock(null);
  };

  // Current time indicator
  const currentTimePercent = timeToPercent(
    `${String(selectedDate.getHours()).padStart(2, '0')}:${String(selectedDate.getMinutes()).padStart(2, '0')}`
  );
  const showCurrentTime = currentTimePercent >= 0 && currentTimePercent <= 100;

  // Time markers
  const timeMarkers = [7, 10, 13, 16, 19, 22];

  return (
    <div className="mt-2 px-1">
      {/* Timeline bar */}
      <div className="relative h-6 w-full rounded-md overflow-hidden bg-neutral-900">
        {blocks.map((block, index) => (
          <div
            key={index}
            className={cn(
              'absolute top-0 h-full transition-opacity cursor-pointer',
              block.isOccupied 
                ? 'bg-[#a15c5c] hover:bg-[#b66a6a]' 
                : 'bg-[#4a7c59] hover:bg-[#5a8f69]'
            )}
            style={{
              left: `${block.startPercent}%`,
              width: `${Math.max(block.widthPercent, 0.5)}%`,
            }}
            onMouseEnter={(e) => handleMouseEnter(block, e)}
            onMouseLeave={handleMouseLeave}
          />
        ))}
        
        {/* Current time indicator */}
        {showCurrentTime && (
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground z-10"
            style={{ left: `${currentTimePercent}%` }}
          />
        )}
      </div>

      {/* Time labels */}
      <div className="relative mt-1 h-4">
        {timeMarkers.map((hour) => {
          const percent = ((hour - DAY_START) / TOTAL_HOURS) * 100;
          return (
            <span
              key={hour}
              className="absolute text-[9px] text-muted-foreground -translate-x-1/2"
              style={{ left: `${percent}%` }}
            >
              {hour > 12 ? `${hour - 12}P` : hour === 12 ? '12P' : `${hour}A`}
            </span>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-1.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#4a7c59]" />
          <span className="text-[10px] text-muted-foreground">Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#a15c5c]" />
          <span className="text-[10px] text-muted-foreground">Occupied</span>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredBlock && (
        <div 
          className="fixed z-50 pointer-events-none"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-lg text-xs">
            <div className="font-medium text-foreground mb-1">
              {formatTime(hoveredBlock.startTime)} - {formatTime(hoveredBlock.endTime)}
            </div>
            {hoveredBlock.isOccupied && hoveredBlock.session ? (
              <div className="text-muted-foreground">
                <span className="text-destructive">{hoveredBlock.session.className.split(' - ')[0]}</span>
                {hoveredBlock.session.className.includes(' - ') && (
                  <div className="truncate max-w-[200px]">
                    {hoveredBlock.session.className.split(' - ').slice(1).join(' - ')}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-success">Available</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
