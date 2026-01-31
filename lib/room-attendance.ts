'use client';

import { createClient } from '@/lib/supabase/client';

const TABLE_NAME = 'room_attendance';
const USER_TOKEN_STORAGE_KEY = 'fiu-atlas:user-token';

export class RoomAttendanceTableMissingError extends Error {
  constructor() {
    super('Room attendance tracking is not configured. Missing `room_attendance` table.');
    this.name = 'RoomAttendanceTableMissingError';
  }
}

export function isRoomAttendanceTableMissingError(error: unknown): error is RoomAttendanceTableMissingError {
  return error instanceof RoomAttendanceTableMissingError;
}

export function formatAttendanceDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function makeAttendanceBlockKey(startTime: string, endTime: string): string {
  return `${startTime}-${endTime}`;
}

function getOrCreateUserToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const existing = window.localStorage.getItem(USER_TOKEN_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const token = window.crypto?.randomUUID?.()
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    window.localStorage.setItem(USER_TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignore storage errors (e.g. private mode)
  }

  return token;
}

interface RawAttendanceRecord {
  id: string;
  room_id: string;
  attendance_date: string;
  start_time: string;
  end_time: string;
  user_token: string | null;
}

export interface AttendanceSnapshot {
  counts: Record<string, number>;
  userRecordIds: Record<string, string>;
}

function normalizeSupabaseError(error: { code?: string; message?: string } | null, fallback: string): never {
  if (error?.code === '42P01') {
    throw new RoomAttendanceTableMissingError();
  }

  throw new Error(error?.message ? `${fallback}: ${error.message}` : fallback);
}

export async function getRoomAttendanceSnapshot(roomId: string, dateKey: string): Promise<AttendanceSnapshot> {
  const supabase = createClient();
  const userToken = getOrCreateUserToken();

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('id, room_id, attendance_date, start_time, end_time, user_token')
    .eq('room_id', roomId)
    .eq('attendance_date', dateKey);

  if (error) {
    normalizeSupabaseError(error, 'Unable to load attendance data');
  }

  const counts: Record<string, number> = {};
  const userRecordIds: Record<string, string> = {};

  (data || []).forEach((record) => {
    const blockKey = makeAttendanceBlockKey(record.start_time, record.end_time);
    counts[blockKey] = (counts[blockKey] ?? 0) + 1;

    if (userToken && record.user_token === userToken) {
      userRecordIds[blockKey] = record.id;
    }
  });

  return { counts, userRecordIds };
}

interface AnnounceAttendanceArgs {
  roomId: string;
  dateKey: string;
  startTime: string;
  endTime: string;
  roomNumber?: string;
  buildingId?: string;
  buildingName?: string;
}

export interface AnnounceAttendanceResult {
  recordId: string;
  alreadyJoined: boolean;
}

export async function announceAttendance({
  roomId,
  dateKey,
  startTime,
  endTime,
  roomNumber,
  buildingId,
  buildingName,
}: AnnounceAttendanceArgs): Promise<AnnounceAttendanceResult> {
  const supabase = createClient();
  const userToken = getOrCreateUserToken();

  if (!userToken) {
    throw new Error('Unable to determine user identity for attendance.');
  }

  const existing = await supabase
    .from(TABLE_NAME)
    .select('id')
    .eq('room_id', roomId)
    .eq('attendance_date', dateKey)
    .eq('start_time', startTime)
    .eq('end_time', endTime)
    .eq('user_token', userToken)
    .maybeSingle();

  if (existing.error && existing.error.code !== 'PGRST116') {
    normalizeSupabaseError(existing.error, 'Unable to check existing attendance');
  }

  if (existing.data?.id) {
    return { recordId: existing.data.id, alreadyJoined: true };
  }

  const payload = {
    room_id: roomId,
    attendance_date: dateKey,
    start_time: startTime,
    end_time: endTime,
    room_number: roomNumber ?? null,
    building_id: buildingId ?? null,
    building_name: buildingName ?? null,
    user_token: userToken,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert([payload])
    .select('id')
    .single();

  if (error) {
    normalizeSupabaseError(error, 'Unable to announce attendance');
  }

  if (!data?.id) {
    throw new Error('Attendance record was created without an identifier.');
  }

  return { recordId: data.id, alreadyJoined: false };
}

export async function withdrawAttendance(recordId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', recordId);

  if (error) {
    normalizeSupabaseError(error, 'Unable to withdraw attendance');
  }
}
