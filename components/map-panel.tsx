'use client';

import { CampusMap } from '@/components/campus-map';
import { ResizablePanel } from '@/components/ui/resizable';
import { Building } from '@/lib/fiu-data';

interface MapPanelProps {
  buildings: Building[];
  selectedDate: Date;
  selectedBuildingId?: string;
  onBuildingSelect: (building: Building) => void;
  userLocation: [number, number] | null;
  isMobile: boolean;
}

export function MapPanel({
  buildings,
  selectedDate,
  selectedBuildingId,
  onBuildingSelect,
  userLocation,
  isMobile,
}: MapPanelProps) {
  return (
    <ResizablePanel key="map" defaultSize={50} minSize={20} collapsible className={`overflow-hidden ${isMobile ? 'p-2' : ''}`}>
      <CampusMap
        buildings={buildings}
        selectedDate={selectedDate}
        selectedBuildingId={selectedBuildingId}
        onBuildingSelect={onBuildingSelect}
        userLocation={userLocation}
        isMobile={isMobile}
      />
    </ResizablePanel>
  );
}

