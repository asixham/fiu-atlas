'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClassSession, formatTime } from '@/lib/fiu-data';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { Check, Loader2, UserPlus } from 'lucide-react';
import {
  AttendanceSnapshot,
  announceAttendance,
  formatAttendanceDateKey,
  getRoomAttendanceSnapshot,
  isRoomAttendanceTableMissingError,
  makeAttendanceBlockKey,
  withdrawAttendance,
} from '@/lib/room-attendance';

interface RoomTimelineProps {
  sessions: ClassSession[];
  selectedDate: Date;
  roomId: string;
  roomNumber: string;
  buildingId?: string;
  buildingName?: string;
}

interface TimeBlock {
  startTime: string;
  endTime: string;
  isOccupied: boolean;
  session?: ClassSession;
  startPercent: number;
  widthPercent: number;
  blockKey: string;
  isPassingPeriod: boolean;
  isPast: boolean;
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

export function RoomTimeline({
  sessions,
  selectedDate,
  roomId,
  roomNumber,
  buildingId,
  buildingName,
}: RoomTimelineProps) {
  const [hoveredBlock, setHoveredBlock] = useState<TimeBlock | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [selectedBlockKey, setSelectedBlockKey] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<AttendanceSnapshot>({ counts: {}, userRecordIds: {} });
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const mountedRef = useRef(true);
  const { toast } = useToast();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const dateKey = useMemo(() => formatAttendanceDateKey(selectedDate), [selectedDate]);
  const dayName = useMemo(() => DAYS_OF_WEEK[selectedDate.getDay()], [selectedDate]);
  const selectedDayStart = useMemo(() => {
    const day = new Date(selectedDate);
    day.setHours(0, 0, 0, 0);
    return day.getTime();
  }, [selectedDate]);
  const todayStart = useMemo(() => {
    const today = new Date(currentTime);
    today.setHours(0, 0, 0, 0);
    return today.getTime();
  }, [currentTime]);
  const isPastDay = selectedDayStart < todayStart;
  const allowAnnouncements = !isPastDay;
  const isToday = allowAnnouncements && selectedDayStart === todayStart;

  useEffect(() => {
    if (!allowAnnouncements || !isToday) {
      return;
    }

    const interval = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);

    return () => window.clearInterval(interval);
  }, [allowAnnouncements, isToday]);

  const todaySessions = useMemo(() => {
    return sessions
      .filter((s) => s.days.includes(dayName))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [sessions, dayName]);

  const blocks = useMemo(() => {
    const result: TimeBlock[] = [];
    let currentTimeString = `${String(DAY_START).padStart(2, '0')}:00`;
    const endOfDay = `${String(DAY_END).padStart(2, '0')}:00`;

    for (const session of todaySessions) {
      const sessionStartMin = timeToMinutes(session.startTime);
      const sessionEndMin = timeToMinutes(session.endTime);
      const currentMin = timeToMinutes(currentTimeString);

      if (sessionStartMin > currentMin) {
        const gapStart = currentTimeString;
        const gapEnd = session.startTime;
        const gapWidth = timeToPercent(gapEnd) - timeToPercent(gapStart);
        const gapMinutes = timeToMinutes(gapEnd) - timeToMinutes(gapStart);
        const isPassingPeriod = gapMinutes > 0 && gapMinutes < 30;
        const [gapStartHour, gapStartMinute] = gapStart.split(':').map(Number);
        const [gapEndHour, gapEndMinute] = gapEnd.split(':').map(Number);
        const blockEndTime = new Date(selectedDate);
        blockEndTime.setHours(gapEndHour, gapEndMinute, 0, 0);
        const blockIsPast = isToday && blockEndTime.getTime() <= currentTime.getTime();

        if (gapWidth > 0) {
          result.push({
            startTime: gapStart,
            endTime: gapEnd,
            isOccupied: false,
            startPercent: timeToPercent(gapStart),
            widthPercent: gapWidth,
            blockKey: makeAttendanceBlockKey(gapStart, gapEnd),
            isPassingPeriod,
            isPast: blockIsPast,
          });
        }
      }

      const clippedStartMin = Math.max(sessionStartMin, currentMin);
      const clippedEndMin = sessionEndMin;

      if (clippedEndMin > clippedStartMin) {
        const clippedStart = `${String(Math.floor(clippedStartMin / 60)).padStart(2, '0')}:${String(clippedStartMin % 60).padStart(2, '0')}`;
        const width = timeToPercent(session.endTime) - timeToPercent(clippedStart);

        if (width > 0) {
          result.push({
            startTime: clippedStart,
            endTime: session.endTime,
            isOccupied: true,
            session,
            startPercent: timeToPercent(clippedStart),
            widthPercent: width,
            blockKey: makeAttendanceBlockKey(clippedStart, session.endTime),
            isPassingPeriod: false,
            isPast: false,
          });
        }
      }

      currentTimeString = session.endTime;
    }

    if (timeToMinutes(endOfDay) > timeToMinutes(currentTimeString)) {
      const width = timeToPercent(endOfDay) - timeToPercent(currentTimeString);
      const gapMinutes = timeToMinutes(endOfDay) - timeToMinutes(currentTimeString);
      const isPassingPeriod = gapMinutes > 0 && gapMinutes < 30;
      const [gapEndHour, gapEndMinute] = endOfDay.split(':').map(Number);
      const blockEndTime = new Date(selectedDate);
      blockEndTime.setHours(gapEndHour, gapEndMinute, 0, 0);
      const blockIsPast = isToday && blockEndTime.getTime() <= currentTime.getTime();

      if (width > 0) {
        result.push({
          startTime: currentTimeString,
          endTime: endOfDay,
          isOccupied: false,
          startPercent: timeToPercent(currentTimeString),
          widthPercent: width,
          blockKey: makeAttendanceBlockKey(currentTimeString, endOfDay),
          isPassingPeriod,
          isPast: blockIsPast,
        });
      }
    }

    if (result.length === 0) {
      const start = `${String(DAY_START).padStart(2, '0')}:00`;
      const end = `${String(DAY_END).padStart(2, '0')}:00`;
      const gapMinutes = timeToMinutes(end) - timeToMinutes(start);
      result.push({
        startTime: start,
        endTime: end,
        isOccupied: false,
        startPercent: 0,
        widthPercent: 100,
        blockKey: makeAttendanceBlockKey(start, end),
        isPassingPeriod: gapMinutes > 0 && gapMinutes < 30,
        isPast: isToday && new Date(selectedDate).setHours(DAY_END, 0, 0, 0) <= currentTime.getTime(),
      });
    }

    return result;
  }, [currentTime, isToday, selectedDate, todaySessions]);

  const hasAvailableBlocks = useMemo(
    () =>
      allowAnnouncements &&
      blocks.some((block) => !block.isOccupied && !block.isPassingPeriod && !block.isPast),
    [allowAnnouncements, blocks]
  );

  const selectedBlock = useMemo(
    () =>
      allowAnnouncements
        ? blocks.find(
          (block) =>
            !block.isOccupied && !block.isPassingPeriod && !block.isPast && block.blockKey === selectedBlockKey
        ) ?? null
        : null,
    [allowAnnouncements, blocks, selectedBlockKey]
  );

  const selectedCount = allowAnnouncements && selectedBlockKey ? snapshot.counts[selectedBlockKey] ?? 0 : 0;
  const selectedUserRecordId = allowAnnouncements && selectedBlockKey ? snapshot.userRecordIds[selectedBlockKey] : undefined;
  const userHasJoinedSelected = allowAnnouncements && Boolean(selectedUserRecordId) && Boolean(selectedBlock);

  const hoveredCount = hoveredBlock ? snapshot.counts[hoveredBlock.blockKey] ?? 0 : 0;
  const hoveredUserJoined = hoveredBlock
    ? allowAnnouncements &&
      !hoveredBlock.isOccupied &&
      !hoveredBlock.isPassingPeriod &&
      !hoveredBlock.isPast &&
      Boolean(snapshot.userRecordIds[hoveredBlock.blockKey])
    : false;

  const handleMouseEnter = useCallback(
    (block: TimeBlock, event: React.MouseEvent<HTMLDivElement>) => {
      if (snapshotLoading) return;
      setHoveredBlock(block);
      const rect = event.currentTarget.getBoundingClientRect();
      setTooltipPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
      });
    },
    [snapshotLoading]
  );

  const handleMouseLeave = useCallback(() => setHoveredBlock(null), []);

  const handleBlockClick = useCallback((block: TimeBlock) => {
    if (block.isOccupied || block.isPassingPeriod || block.isPast || snapshotLoading || !allowAnnouncements) return;
    setActionError(null);
    setHoveredBlock(null);
    setSelectedBlockKey((prev) => (prev === block.blockKey ? null : block.blockKey));
  }, [allowAnnouncements, snapshotLoading]);

  const fetchSnapshot = useCallback(async () => {
    setSnapshotLoading(true);
    setAttendanceError(null);

    try {
      const data = await getRoomAttendanceSnapshot(roomId, dateKey);
      if (!mountedRef.current) {
        return;
      }

      setSnapshot(data);
      setTableMissing(false);
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setSnapshot({ counts: {}, userRecordIds: {} });

      if (isRoomAttendanceTableMissingError(error)) {
        setTableMissing(true);
        setAttendanceError(null);
      } else {
        const message = error instanceof Error ? error.message : 'Unable to load attendance.';
        setAttendanceError(message);
      }
    } finally {
      if (mountedRef.current) {
        setSnapshotLoading(false);
      }
    }
  }, [roomId, dateKey]);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  useEffect(() => {
    setSelectedBlockKey(null);
  }, [dateKey, roomId]);

  useEffect(() => {
    if (
      selectedBlockKey &&
      !blocks.some(
        (block) =>
          block.blockKey === selectedBlockKey &&
          !block.isOccupied &&
          !block.isPassingPeriod &&
          !block.isPast
      )
    ) {
      setSelectedBlockKey(null);
    }
  }, [blocks, selectedBlockKey]);

  useEffect(() => {
    if (!allowAnnouncements) {
      setSelectedBlockKey(null);
    }
  }, [allowAnnouncements]);

  const handleAnnounce = useCallback(async () => {
    if (!selectedBlock || !allowAnnouncements || selectedBlock.isPast) return;

    setActionLoading(true);
    setActionError(null);

    try {
      const result = await announceAttendance({
        roomId,
        dateKey,
        startTime: selectedBlock.startTime,
        endTime: selectedBlock.endTime,
        roomNumber,
        buildingId,
        buildingName,
      });

      if (!mountedRef.current) {
        return;
      }

      toast({
        title: result.alreadyJoined ? 'Already counted' : 'See you there!',
        description: result.alreadyJoined
          ? 'You were already on the list for this time.'
          : `Others can now see you plan to be there sometime between ${formatTime(selectedBlock.startTime)} — ${formatTime(selectedBlock.endTime)}.`,
      });

      await fetchSnapshot();
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      const tableMissingError = isRoomAttendanceTableMissingError(error);

      if (tableMissingError) {
        setTableMissing(true);
        setAttendanceError(null);
      }

      const message = tableMissingError
        ? 'Room attendance tracking is not yet configured.'
        : error instanceof Error
          ? error.message
          : 'Unable to update attendance.';

      setActionError(message);

      toast({
        variant: 'destructive',
        title: 'Unable to update attendance',
        description: message,
      });
    } finally {
      if (mountedRef.current) {
        setActionLoading(false);
      }
    }
  }, [allowAnnouncements, selectedBlock, roomId, dateKey, roomNumber, buildingId, buildingName, fetchSnapshot, toast]);

  const handleWithdraw = useCallback(async () => {
    if (!selectedUserRecordId || !selectedBlock || !allowAnnouncements || selectedBlock.isPast) return;

    setActionLoading(true);
    setActionError(null);

    try {
      await withdrawAttendance(selectedUserRecordId);

      if (!mountedRef.current) {
        return;
      }

      toast({
        title: 'Attendance updated',
        description: `You are no longer listed for ${formatTime(selectedBlock.startTime)} — ${formatTime(selectedBlock.endTime)}.`,
      });

      await fetchSnapshot();
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      const tableMissingError = isRoomAttendanceTableMissingError(error);

      if (tableMissingError) {
        setTableMissing(true);
        setAttendanceError(null);
      }

      const message = tableMissingError
        ? 'Room attendance tracking is not yet configured.'
        : error instanceof Error
          ? error.message
          : 'Unable to update attendance.';

      setActionError(message);

      toast({
        variant: 'destructive',
        title: 'Unable to update attendance',
        description: message,
      });
    } finally {
      if (mountedRef.current) {
        setActionLoading(false);
      }
    }
  }, [allowAnnouncements, selectedUserRecordId, selectedBlock, fetchSnapshot, toast]);

  const currentTimePercent = timeToPercent(
    `${String(selectedDate.getHours()).padStart(2, '0')}:${String(selectedDate.getMinutes()).padStart(2, '0')}`
  );

  const showCurrentTime = currentTimePercent >= 0 && currentTimePercent <= 100;

  const timeMarkers = [7, 10, 13, 16, 19, 22];

  return (
    <div className="mt-2 px-1">
      <div className="relative h-10 w-full overflow-hidden">
        {blocks.map((block, index) => {
          const blockCount = snapshot.counts[block.blockKey] ?? 0;
          const isSelected = selectedBlockKey === block.blockKey;
          const userJoinedBlock =
            !block.isOccupied && !block.isPassingPeriod && Boolean(snapshot.userRecordIds[block.blockKey]);

          return (
            <div
              key={block.blockKey ?? `${block.startTime}-${index}`}
              className={cn(
                'absolute top-0 h-full rounded-md transition-all',
                block.isOccupied
                  ? 'bg-red-400 hover:bg-red-500 cursor-not-allowed'
                  : block.isPassingPeriod
                    ? 'bg-amber-300 text-amber-900 cursor-not-allowed'
                    : block.isPast
                      ? 'bg-green-500 text-zinc-200 cursor-not-allowed'
                      : allowAnnouncements
                        ? 'bg-green-500 hover:bg-green-500 cursor-pointer'
                        : 'bg-green-500/70 cursor-not-allowed',
                isSelected &&
                  !block.isOccupied &&
                  !block.isPassingPeriod &&
                  !block.isPast &&
                  allowAnnouncements &&
                  'shimmer outline outline-3 outline-green-900/60 -outline-offset-3'
              )}
              style={{
                left: `calc(${block.startPercent}% + ${index === 0 ? 0 : BLOCK_GAP_PX / 2}px)`,
                width: `calc(${Math.max(block.widthPercent, 0.8)}% - ${
                  index === 0 || index === blocks.length - 1 ? BLOCK_GAP_PX / 2 : BLOCK_GAP_PX
                }px)`
              }}
              onMouseEnter={(event) => handleMouseEnter(block, event)}
              onMouseLeave={handleMouseLeave}
              onClick={() => {
                if (!block.isOccupied && !block.isPassingPeriod && !block.isPast) {
                  handleBlockClick(block);
                }
              }}
              role={
                block.isOccupied ||
                block.isPassingPeriod ||
                block.isPast ||
                snapshotLoading ||
                !allowAnnouncements
                  ? undefined
                  : 'button'
              }
              aria-label={
                block.isOccupied
                  ? `Occupied from ${formatTime(block.startTime)} to ${formatTime(block.endTime)}`
                  : block.isPassingPeriod
                    ? `Passing period ${formatTime(block.startTime)} to ${formatTime(block.endTime)}`
                    : block.isPast
                      ? `Time has passed for ${formatTime(block.startTime)} to ${formatTime(block.endTime)}`
                    : `Available from ${formatTime(block.startTime)} to ${formatTime(block.endTime)}`
              }
            >
              {!block.isOccupied &&
                !block.isPassingPeriod &&
                !block.isPast &&
                !snapshotLoading &&
                allowAnnouncements &&
                blockCount > 0 && (
                <div className="pointer-events-none absolute right-1 top-1 flex items-center gap-1 rounded-full bg-green-100/90 px-1.5 py-0.5 text-[10px] font-semibold text-green-900 shadow-sm">
                  <UserPlus className="h-3 w-3" />
                  <span>{blockCount}</span>
                </div>
              )}
              {!block.isOccupied &&
                !block.isPassingPeriod &&
                !block.isPast &&
                !snapshotLoading &&
                allowAnnouncements &&
                userJoinedBlock && (
                <div className="pointer-events-none absolute left-1 bottom-1 rounded-full bg-green-600 p-1 text-white shadow-sm">
                  <Check className="h-3 w-3" />
                </div>
              )}
            </div>
          );
        })}

        {showCurrentTime && (
          <div
            className="absolute top-0 z-10 h-full w-0.5 bg-foreground"
            style={{ left: `${currentTimePercent}%` }}
          />
        )}

        {snapshotLoading && (
          <div className="absolute inset-0 z-20 rounded-md bg-zinc-900 shimmer" />
        )}
      </div>

      <div className="relative mt-1 h-4">
        {timeMarkers.map((hour) => {
          const percent = ((hour - DAY_START) / TOTAL_HOURS) * 100;
          return (
            <span
              key={hour}
              className="absolute -translate-x-1/2 text-[9px] text-muted-foreground"
              style={{ left: `${percent}%` }}
            >
              {hour > 12 ? `${hour - 12}P` : hour === 12 ? '12P' : `${hour}A`}
            </span>
          );
        })}
      </div>

      <div className="mt-1.5 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-[10px] text-muted-foreground">Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-[10px] text-muted-foreground">Occupied</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-300" />
          <span className="text-[10px] text-muted-foreground">Passing</span>
        </div>
      </div>

      {hoveredBlock && (
        <div
          className="pointer-events-none fixed z-50"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="rounded-xl bg-zinc-900 px-3 py-2 text-sm shadow-lg">
            <div className="mb-1 font-medium">
              {formatTime(hoveredBlock.startTime)} — {formatTime(hoveredBlock.endTime)}
            </div>

            {hoveredBlock.isOccupied && hoveredBlock.session ? (
              <div className="text-muted-foreground">
                <span className="text-destructive">
                  {hoveredBlock.session.className.split(' - ')[0]}
                </span>
                {hoveredBlock.session.className.includes(' - ') && (
                  <div className="max-w-[200px] truncate">
                    {hoveredBlock.session.className.split(' - ').slice(1).join(' - ')}
                  </div>
                )}
              </div>
            ) : hoveredBlock.isPassingPeriod ? (
              <div className="space-y-0.5 text-muted-foreground">
                <div className="text-amber-300">Passing period</div>
                <div>Less than 30 minutes between classes.</div>
              </div>
            ) : hoveredBlock.isPast ? (
              <div className="space-y-0.5 text-muted-foreground">
                <div className="text-zinc-200">Time passed</div>
                <div>This block is no longer open for attendance.</div>
              </div>
            ) : (
              <div className="space-y-0.5 text-muted-foreground">
                <div className="text-success">Available</div>
                <div>
                  {hoveredCount === 0
                    ? 'No users coming yet'
                    : hoveredCount === 1
                      ? '1 user coming'
                      : `${hoveredCount} users coming`}
                </div>
                {hoveredUserJoined && <div className="text-green-400">You are coming</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {attendanceError && (
        <div className="mt-3 text-xs text-destructive">{attendanceError}</div>
      )}

      {tableMissing ? (
        <div className="mt-3 rounded-lg bg-zinc-900/50 p-3 text-xs text-muted-foreground">
          Attendance announcements are not yet enabled for this environment.
        </div>
      ) : (
        <>
          <Accordion
            type="single"
            collapsible
            value={selectedBlock ? 'attendance' : undefined}
            className="mt-3"
          >
            <AccordionItem value="attendance" className="border-none">
              <AccordionTrigger className="hidden" aria-hidden />
              <AccordionContent className="px-0 pt-0 pb-0">
                {selectedBlock && (
                  <div className="relative">
                    <div className={cn(
                      'space-y-3 rounded-3xl bg-zinc-900/60 p-3 transition-opacity',
                      snapshotLoading && 'pointer-events-none blur-sm'
                    )}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-foreground">
                            {formatTime(selectedBlock.startTime)} — {formatTime(selectedBlock.endTime)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Room {roomNumber}
                            {buildingName ? ` · ${buildingName}` : ''}
                          </div>
                        </div>
                        <Badge
                          variant="secondary"
                          className="whitespace-nowrap rounded-full bg-zinc-800"
                        >
                          {selectedCount === 0
                            ? 'No users coming yet'
                            : selectedCount === 1
                              ? '1 user coming'
                              : `${selectedCount} users coming`}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-muted-foreground">
                          {userHasJoinedSelected
                            ? "You're currently listed for this slot."
                            : 'Let others know you plan to use this room.'}
                          {actionError && (
                            <div className="mt-1 text-xs text-destructive">{actionError}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {userHasJoinedSelected && selectedBlock && !selectedBlock.isPast ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full"
                              onClick={handleWithdraw}
                              disabled={actionLoading || snapshotLoading}
                            >
                              {actionLoading ? (
                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin bg-transparent" />
                              ) : (
                                <Check className="mr-2 h-3.5 w-3.5" />
                              )}
                              I'm not coming
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={handleAnnounce}
                              className="rounded-full"
                              disabled={
                                actionLoading ||
                                snapshotLoading ||
                                !selectedBlock ||
                                selectedBlock.isPast
                              }
                            >
                              {actionLoading ? (
                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin bg-transparent" />
                              ) : (
                                <UserPlus className="mr-2 h-3.5 w-3.5" />
                              )}
                              I'll be there
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {snapshotLoading && (
                      <div className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-[#2C2C30]/10 backdrop-blur-xs">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {allowAnnouncements ? (
            selectedBlock ? null : hasAvailableBlocks ? (
              <div className="mt-3 text-[11px] text-muted-foreground">
                Click an available block to announce that you'll be in the room.
              </div>
            ) : (
              <div className="mt-3 text-[11px] text-muted-foreground">
                No upcoming time blocks remain for this room today.
              </div>
            )
          ) : (
            <div className="mt-3 text-[11px] text-muted-foreground">
              Attendance announcements are only available for today and upcoming dates.
            </div>
          )}
        </>
      )}
    </div>
  );
}
