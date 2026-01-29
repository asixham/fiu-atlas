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
  'Green Library': [-80.37452, 25.75538],
  'Graham Center': [-80.37345, 25.75468],
  'Charles E. Perry (PC)': [-80.37392, 25.75637],
  'Deuxieme Maison': [-80.37289, 25.75573],
  'Owa Ehan': [-80.37168, 25.75612],
  'Chem & Physics': [-80.37055, 25.75529],
  'Stocker AstroScience': [-80.37012, 25.75589],

  // --- Business & Management ---
  'Ryder Business': [-80.37098, 25.75691],
  'College of Business Complex': [-80.37198, 25.75727],
  'Mgmt and New Growth Opp': [-80.37142, 25.75659], // MANGO

  // --- International & Public Affairs ---
  'SIPA': [-80.37238, 25.75598], // Main SIPA entrance
  'SCH INTER & PUB AFFAIR 1': [-80.37254, 25.75609],
  'SCH INTNL & PUB AFFAIRS 2': [-80.37222, 25.75587],
  'Labor Center': [-80.37189, 25.75654],

  // --- Health & Sciences (East Side) ---
  'Academic Health Center 3': [-80.37011, 25.75378],
  'Academic Health Center 4': [-80.36952, 25.75342],
  'Academic Health Center 5': [-80.36895, 25.75309],
  'Innovation 1': [-80.36743, 25.75267],

  // --- West Campus (Law, Architecture, Arts) ---
  'Rafael Diaz-Balart': [-80.37628, 25.75485], // CORRECTED: Moved from East to West side
  'Paul Cejas Architecture': [-80.37593, 25.75398],
  'Ziff Education Bldg': [-80.37412, 25.75462],
  'Viertes Haus': [-80.37352, 25.75404],
  'Comp, Arts, Sci & Educat': [-80.37456, 25.75387], // CASE

  // --- Engineering ---
  'Engineering Center': [-80.36622, 25.77232], // CORRECTED: This is the Flagler Campus (Off-site)
  'Eng. & Comp. Science (ECS)': [-80.37175, 25.75545], // ADDED: The Engineering bldg ON MMC campus

  // --- Student Life & Athletics ---
  'Ocean Bank Convoc Center': [-80.36812, 25.75198],
  'Student Acad Success Cntr': [-80.37321, 25.75689],
  'Parking Garage 6': [-80.36987, 25.75234],
  'PG5 MARKET STATION': [-80.37054, 25.75189],

  // --- Studios / West Complex ---
  'West 1 Room': [-80.37654, 25.75487],
  'West 9 Room': [-80.37712, 25.75423],
  'West 10 (W10)': [-80.37756, 25.75387],
  'Art Studio Room': [-80.37698, 25.75512],
  'Studio W1C': [-80.37632, 25.75467],

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
