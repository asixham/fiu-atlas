'use client';

import React, { useState } from "react";
import { ClassSession, formatTime } from '@/lib/fiu-data';
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
const BLOCK_GAP_PX = 3;

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

const DAYS_OF_WEEK = [
  'sunday','monday','tuesday','wednesday',
  'thursday','friday','saturday'
];

export function RoomTimeline({ sessions, selectedDate }: RoomTimelineProps) {
  const [hoveredBlock, setHoveredBlock] = useState<TimeBlock | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const dayName = DAYS_OF_WEEK[selectedDate.getDay()];

  const todaySessions = sessions
    .filter((s) => s.days.includes(dayName))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const blocks: TimeBlock[] = [];

  let currentTime = `${String(DAY_START).padStart(2, '0')}:00`;
  const endOfDay = `${String(DAY_END).padStart(2, '0')}:00`;

  for (const session of todaySessions) {

    const sessionStartMin = timeToMinutes(session.startTime);
    const sessionEndMin = timeToMinutes(session.endTime);
    const currentMin = timeToMinutes(currentTime);

    if (sessionStartMin > currentMin) {
      const gapStart = currentTime;
      const gapEnd = session.startTime;

      const gapWidth =
        timeToPercent(gapEnd) - timeToPercent(gapStart);

      if (gapWidth > 0) {
        blocks.push({
          startTime: gapStart,
          endTime: gapEnd,
          isOccupied: false,
          startPercent: timeToPercent(gapStart),
          widthPercent: gapWidth,
        });
      }
    }

    const clippedStartMin = Math.max(sessionStartMin, currentMin);
    const clippedEndMin = sessionEndMin;

    if (clippedEndMin > clippedStartMin) {
      const clippedStart = `${String(Math.floor(clippedStartMin / 60)).padStart(2,'0')}:${String(clippedStartMin % 60).padStart(2,'0')}`;

      const width =
        timeToPercent(session.endTime) -
        timeToPercent(clippedStart);

      if (width > 0) {
        blocks.push({
          startTime: clippedStart,
          endTime: session.endTime,
          isOccupied: true,
          session,
          startPercent: timeToPercent(clippedStart),
          widthPercent: width,
        });
      }
    }

    currentTime = session.endTime;
  }

  if (timeToMinutes(endOfDay) > timeToMinutes(currentTime)) {
    const width =
      timeToPercent(endOfDay) -
      timeToPercent(currentTime);

    if (width > 0) {
      blocks.push({
        startTime: currentTime,
        endTime: endOfDay,
        isOccupied: false,
        startPercent: timeToPercent(currentTime),
        widthPercent: width,
      });
    }
  }

  if (blocks.length === 0) {
    blocks.push({
      startTime: `${String(DAY_START).padStart(2,'0')}:00`,
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

  const handleMouseLeave = () => setHoveredBlock(null);

  const currentTimePercent = timeToPercent(
    `${String(selectedDate.getHours()).padStart(2,'0')}:${String(selectedDate.getMinutes()).padStart(2,'0')}`
  );

  const showCurrentTime =
    currentTimePercent >= 0 && currentTimePercent <= 100;

  const timeMarkers = [7, 10, 13, 16, 19, 22];

  return (
    <div className="mt-2 px-1">

      {/* Timeline */}
      <div className="relative h-10 w-full overflow-hidden">
        {blocks.map((block, index) => (
          <div
            key={index}
            className={cn(
              'absolute top-0 rounded-md h-full cursor-pointer',
              block.isOccupied
                ? 'bg-red-400 hover:bg-red-500'
                : 'bg-green-400 hover:bg-green-500'
            )}
            style={{
              left: `calc(${block.startPercent}% + ${index === 0 ? 0 : BLOCK_GAP_PX/2}px)`,
              width: `calc(${Math.max(block.widthPercent, 0.8)}% - ${
                index === 0 || index === blocks.length - 1
                  ? BLOCK_GAP_PX/2
                  : BLOCK_GAP_PX
              }px)`
            }}
            onMouseEnter={(e) => handleMouseEnter(block, e)}
            onMouseLeave={handleMouseLeave}
          />
        ))}

        {showCurrentTime && (
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground z-10"
            style={{ left: `${currentTimePercent}%` }}
          />
        )}
      </div>

      {/* Time labels */}
      <div className="relative mt-1 h-4">
        {timeMarkers.map(hour => {
          const percent = ((hour - DAY_START) / TOTAL_HOURS) * 100;
          return (
            <span
              key={hour}
              className="absolute text-[9px] text-muted-foreground -translate-x-1/2"
              style={{ left: `${percent}%` }}
            >
              {hour > 12 ? `${hour-12}P` : hour === 12 ? '12P' : `${hour}A`}
            </span>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-1.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-[10px] text-muted-foreground">Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" />
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
          <div className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 shadow-lg text-xs">
            <div className="font-medium mb-1">
              {formatTime(hoveredBlock.startTime)} — {formatTime(hoveredBlock.endTime)}
            </div>

            {hoveredBlock.isOccupied && hoveredBlock.session ? (
              <div className="text-muted-foreground">
                <span className="text-destructive">
                  {hoveredBlock.session.className.split(' - ')[0]}
                </span>
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
