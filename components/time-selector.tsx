'use client';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

interface TimeSelectorProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  isLive: boolean;
  onLiveChange: (live: boolean) => void;
  isRefreshing?: boolean;
}

export function TimeSelector({
  selectedDate,
  onDateChange,
  isLive,
  onLiveChange,
  isRefreshing
}: TimeSelectorProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i); // 12 AM to 11 PM
  const minutes = Array.from({ length: 60 }, (_, i) => i); // 0-59

  const handleTimeChange = (type: 'hour' | 'minute', value: string) => {
    const newDate = new Date(selectedDate);
    if (type === 'hour') {
      newDate.setHours(parseInt(value));
    } else {
      newDate.setMinutes(parseInt(value));
    }
    onDateChange(newDate);
    onLiveChange(false); // User manually changed time, no longer "now"
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const newDate = new Date(date);
      newDate.setHours(selectedDate.getHours());
      newDate.setMinutes(selectedDate.getMinutes());
      onDateChange(newDate);
      onLiveChange(false); // User manually changed date, no longer "now"
    }
  };

  const setToNow = () => {
    onDateChange(new Date());
    onLiveChange(true);
  };

  const formatHour = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour} ${period}`;
  };

  const formatMinute = (minute: number) => {
    return String(minute).padStart(2, '0');
  };

  return (
    <div className="flex flex-col w-full">
      {/* Calendar */}
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={handleDateSelect}
        initialFocus
      />

      {/* Time picker */}
      <div className="flex flex-col border-t border-zinc-700">
        <div className="flex items-center py-4 gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Enter time</span>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={String(selectedDate.getHours())}
            onValueChange={(value) => handleTimeChange('hour', value)}
          >
            <SelectTrigger className="h-9 gap-2 w-fit cursor-pointer bg-transparent border-zinc-700 hover:bg-zinc-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[200px] bg-zinc-800">
              {hours.map((hour) => (
                <SelectItem key={hour} value={String(hour)} className="cursor-pointer">
                  {formatHour(hour)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">:</span>
          <Select
            value={String(selectedDate.getMinutes())}
            onValueChange={(value) => handleTimeChange('minute', value)}
          >
            <SelectTrigger className="h-9 gap-2 w-fit cursor-pointer bg-transparent border-zinc-700 hover:bg-zinc-700">
              <SelectValue>{formatMinute(selectedDate.getMinutes())}</SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-[200px] bg-zinc-800">
              {minutes.map((minute) => (
                <SelectItem key={minute} value={String(minute)} className="cursor-pointer">
                  {formatMinute(minute)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
