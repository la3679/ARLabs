export interface Coordinates {
  x: number;
  y: number;
  z: number;
}

export interface ARObjectData {
  id: string;
  position: [number, number, number];
  scale: [number, number, number];
  rotation: [number, number, number];
  color: string;
}

export type GestureType = 'IDLE' | 'DRAG' | 'PINCH' | 'ROTATE' | 'TAP' | 'LONG_PRESS' | 'SWIPE';

export interface LogEntry {
  id: string;
  message: string;
  timestamp: number;
}

export type ScreenCoordUpdateHandler = (x: number, y: number) => void;
