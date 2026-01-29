// FIU Building and Room Data - Fetched from Supabase

import { createClient } from '@/lib/supabase/client';

export interface ClassSession {
  className: string;
  days: string[];
  startTime: string;
  endTime: string;
  instructor: string;
  startDate: string;
  endDate: string;
}

export interface Room {
  id: string;
  number: string;
  buildingName: string;
  sessions: ClassSession[];
}

export interface Building {
  id: string;
  name: string;
  shortName: string;
  campus: string;
  coordinates: [number, number];
  rooms: Room[];
}

// Days mapping for comparison
const DAY_MAP: Record<string, string> = {
  Mo: 'monday',
  Tu: 'tuesday',
  We: 'wednesday',
  Th: 'thursday',
  Fr: 'friday',
  Sa: 'saturday',
  Su: 'sunday',
};

const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Building coordinates for FIU MMC campus (verified coordinates)
// Verified Building coordinates for FIU MMC campus
// Format: [Longitude, Latitude]
const BUILDING_COORDINATES: Record<string, [number, number]> = {
  // --- Core Campus ---
  'Green Library': [-80.37387941544537, 25.75726384343859],
  'Graham Center': [-80.37279883736768, 25.756235563409305],
  'Charles E. Perry (PC)': [-80.37380313905875, 25.755585289867405],
  'Deuxieme Maison': [-80.37468429416529, 25.756185299118933],
  'Owa Ehan': [-80.37295105114137, 25.758093407917986],
  'Chem & Physics': [-80.37222323214473, 25.758373982818195],
  'Stocker AstroScience': [-80.372558158972, 25.75791350895314],

  // --- Business & Management ---
  'Ryder Business': [-80.37612541659684, 25.757430885973932],
  'College Business Complex': [-80.3770406180777, 25.758031725071078],
  'Mgmt and New Growth Opp': [-80.37696280603302, 25.757463260095147], // MANGO

  // --- International & Public Affairs ---
  'SCH INTER & PUB AFFAIR 1': [-80.37626685994533, 25.756513707335138],
  'SCH INTNL & PUB AFFAIRS 2': [-80.37667399757984, 25.756517804408123],
  'Labor Center': [-80.37715883776042, 25.75654979372263],

  // --- Health & Sciences (East Side) ---
  'Academic Health Center 1': [-80.37138831829029, 25.757652335892992],
  'Academic Center Two': [-80.37129544986662, 25.75819002705321],
  'Academic Health Center 3': [-80.37137607127403, 25.75881998502289],
  'Academic Health Center 4': [-80.372293242273, 25.759326155836145],
  'Academic Health Center 5': [-80.37115089756057, 25.759189308566473],
  'Innovation 1': [-80.36934181677428, 25.760609348960426],

  // --- West Campus (Law, Architecture, Arts) ---
  'Rafael Diaz Balart': [-80.37777433201501, 25.75681213931396],
  'Paul Cejas Architecture': [-80.37528733209065, 25.75895882361899],
  'Ziff Education Bldg': [-80.37676102127567, 25.75903305722242],
  'Viertes Haus': [-80.37471040564922, 25.757971805490456],
  'Comp, Arts, Sci & Educat': [-80.37385154509248, 25.759086503993288], // CASE

  // --- Engineering ---
  'Engineering Center': [-80.36773876923758, 25.77002291187089],

  // --- Student Life & Athletics ---
  'Ocean Bank Convoc Center': [-80.37959043658789, 25.75696342243802],
  'Student Acad Success Cntr': [-80.37139571769416, 25.75572440171293],
  'Parking Garage 6': [-80.37457046626925, 25.760205480481076],
  'PG5 MARKET STATION': [-80.37165071049701, 25.760202651626887],

  // --- Studios / West Complex ---
  'West 1 Room': [-80.38232312649168, 25.752773949830647],
  'West 9 Room': [-80.38265923738535, 25.756823001958796],
  'West 10 (W10)': [-80.38295198464573, 25.756900383916417],
  'West 10A Room': [-80.38362594577217, 25.757271453137797],
  'Art Studio Room': [-80.38117218608232, 25.75303124603555],
  'Studio W1C': [-80.38151688711187, 25.752779120671743],

  'Wertheim Prf Arts Ctr': [-80.37265870279163, 25.75254878732886],
  'Jelke/Sigma Phi Epsilon': [-80.36997107141251, 25.753617088248895],
  'Wertheim Conservatory': [-80.37304727638077, 25.759346264521987],
  'Mgmt & Advanced Resrch Ctr': [-80.373283693317, 25.75460211003198],
  'FIU Downtown Brickell S': [-80.19096504676872, 25.763227144721178],

  default: [-80.37337, 25.75469], // Graham Center as default
};

// Parse time string like "8:00AM" to "08:00" format
function parseTime(timeStr: string): string {
  const match = timeStr.match(/(\d{1,2}):(\d{2})(AM|PM)/i);
  if (!match) return '00:00';

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }

  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

// Parse days string like "MoWe" or "TuTh" to array of day names
function parseDays(daysStr: string): string[] {
  const days: string[] = [];
  const dayPatterns = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  for (const pattern of dayPatterns) {
    if (daysStr.includes(pattern)) {
      days.push(DAY_MAP[pattern]);
    }
  }

  return days;
}

// Get coordinates for a building
function getBuildingCoordinates(buildingName: string): [number, number] {
  if (BUILDING_COORDINATES[buildingName]) {
    return BUILDING_COORDINATES[buildingName];
  }

  for (const [key, coords] of Object.entries(BUILDING_COORDINATES)) {
    if (buildingName.includes(key) || key.includes(buildingName)) {
      return coords;
    }
  }

  const defaultCoords = BUILDING_COORDINATES['default'];
  return [defaultCoords[0] + (Math.random() - 0.5) * 0.005, defaultCoords[1] + (Math.random() - 0.5) * 0.003];
}

// Generate a short name for the building
function getShortName(buildingName: string): string {
  const abbreviations: Record<string, string> = {
    'Green Library': 'GL',
    'Charles E. Perry (PC)': 'PC',
    'Deuxieme Maison': 'DM',
    'College of Business Complex': 'CBC',
    'Mgmt and New Growth Opp': 'MANGO',
    'Graham Center': 'GC',
    'SCH INTNL & PUB AFFAIRS 2': 'SIPA2',
    'SCH INTER & PUB AFFAIR 1': 'SIPA1',
    'Academic Health Center 5': 'AHC5',
    'Academic Health Center 4': 'AHC4',
    'Academic Health Center 3': 'AHC3',
    'Ryder Business': 'RB',
    'Paul Cejas Architecture': 'PCA',
    'Chem & Physics': 'CP',
    'Ziff Education Bldg': 'ZEB',
    'Viertes Haus': 'VH',
    'Owa Ehan': 'OE',
    'West 1 Room': 'W1',
    'West 9 Room': 'W9',
    'West 10 (W10)': 'W10',
    'Art Studio Room': 'ART',
    'Student Acad Success Cntr': 'SASC',
    'Ocean Bank Convoc Center': 'OBCC',
    'Innovation 1': 'IN1',
    'Parking Garage 6': 'PG6',
    'PG5 MARKET STATION': 'PG5',
    'Rafael Diaz-Balart': 'RDB',
    'Engineering Center': 'EC',
    'Stocker AstroScience': 'SAS',
    'Comp, Arts, Sci & Educat': 'CASE',
    'Labor Center': 'LC',
    'Studio W1C': 'W1C',
  };

  if (abbreviations[buildingName]) {
    return abbreviations[buildingName];
  }

  return buildingName
    .split(/[\s,]+/)
    .filter((w) => w.length > 0)
    .map((w) => w[0].toUpperCase())
    .join('')
    .slice(0, 4);
}

// Database row type
interface ClassRow {
  id: number;
  class_name: string;
  days: string;
  start_time: string;
  end_time: string;
  building_name: string;
  room_number: string;
  instructor: string;
  start_date: string;
  end_date: string;
  campus: string;
}

// Process database rows into Building structure
function processClassData(classes: ClassRow[]): Building[] {
  const buildingsMap = new Map<string, Building>();
  const roomsMap = new Map<string, Room>();

  for (const row of classes) {
    const buildingName = row.building_name;
    const roomNumber = row.room_number;

    // Create building if it doesn't exist
    const buildingId = buildingName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    if (!buildingsMap.has(buildingId)) {
      buildingsMap.set(buildingId, {
        id: buildingId,
        name: buildingName,
        shortName: getShortName(buildingName),
        campus: row.campus || 'MMC',
        coordinates: getBuildingCoordinates(buildingName),
        rooms: [],
      });
    }

    // Create room if it doesn't exist
    const roomId = `${buildingId}-${roomNumber}`;
    if (!roomsMap.has(roomId)) {
      const room: Room = {
        id: roomId,
        number: roomNumber,
        buildingName,
        sessions: [],
      };
      roomsMap.set(roomId, room);
      buildingsMap.get(buildingId)!.rooms.push(room);
    }

    // Add session to room
    const room = roomsMap.get(roomId)!;
    room.sessions.push({
      className: row.class_name,
      days: parseDays(row.days),
      startTime: parseTime(row.start_time),
      endTime: parseTime(row.end_time),
      instructor: row.instructor?.replace(/,\s*$/, '') || '',
      startDate: row.start_date || '',
      endDate: row.end_date || '',
    });
  }

  return Array.from(buildingsMap.values());
}

// Load buildings from Supabase
export async function loadBuildings(): Promise<Building[]> {
  try {
    const supabase = createClient();

    // Fetch all classes with pagination to avoid default 1000 row limit
    const allClasses: ClassRow[] = [];
    let offset = 0;
    const pageSize = 1000;

    while (true) {
      const { data: classes, error } = await supabase
        .from('classes')
        .select('*')
        .order('building_name', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error('Error fetching classes from Supabase:', error);
        break;
      }

      if (!classes || classes.length === 0) {
        break;
      }

      allClasses.push(...(classes as ClassRow[]));

      if (classes.length < pageSize) {
        break;
      }

      offset += pageSize;
    }

    if (allClasses.length === 0) {
      console.warn('No classes found in database');
      return [];
    }

    return processClassData(allClasses);
  } catch (error) {
    console.error('Failed to load class data:', error);
    return [];
  }
}

// Utility functions
export function isRoomOccupied(room: Room, date: Date): boolean {
  const dayName = DAYS_OF_WEEK[date.getDay()];
  const currentTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  return room.sessions.some((session) => {
    if (!session.days.includes(dayName)) return false;
    return currentTime >= session.startTime && currentTime < session.endTime;
  });
}

export function getRoomStatus(
  room: Room,
  date: Date
): {
  isOccupied: boolean;
  currentClass?: ClassSession;
  nextClass?: ClassSession;
  freeUntil?: string;
} {
  const dayName = DAYS_OF_WEEK[date.getDay()];
  const currentTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  const todaySessions = room.sessions
    .filter((session) => session.days.includes(dayName))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const currentClass = todaySessions.find(
    (session) => currentTime >= session.startTime && currentTime < session.endTime
  );

  const nextClass = todaySessions.find((session) => session.startTime > currentTime);

  return {
    isOccupied: !!currentClass,
    currentClass,
    nextClass,
    freeUntil: currentClass ? undefined : nextClass?.startTime || '22:00',
  };
}

export function getBuildingOccupancy(
  building: Building,
  date: Date
): {
  total: number;
  occupied: number;
  available: number;
  percentage: number;
} {
  const rooms = building.rooms;
  const total = rooms.length;
  const occupied = rooms.filter((room) => isRoomOccupied(room, date)).length;
  const available = total - occupied;
  const percentage = total > 0 ? Math.round((occupied / total) * 100) : 0;

  return { total, occupied, available, percentage };
}

export function formatTime(time: string): string {
  const [hoursStr, minutes] = time.split(':');
  const hours = parseInt(hoursStr, 10);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${period}`;
}

export function getAvailableRooms(building: Building, date: Date): Room[] {
  return building.rooms.filter((room) => !isRoomOccupied(room, date));
}

export function getOccupiedRooms(building: Building, date: Date): Room[] {
  return building.rooms.filter((room) => isRoomOccupied(room, date));
}

export function getBuildingById(buildings: Building[], id: string): Building | undefined {
  return buildings.find((b) => b.id === id);
}

export function getRoomsSortedByAvailability(building: Building, date: Date): Room[] {
  const rooms = [...building.rooms];
  return rooms.sort((a, b) => {
    const aOccupied = isRoomOccupied(a, date);
    const bOccupied = isRoomOccupied(b, date);
    if (aOccupied === bOccupied) {
      return a.number.localeCompare(b.number, undefined, { numeric: true });
    }
    return aOccupied ? 1 : -1;
  });
}
