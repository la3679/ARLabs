import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, ContactShadows } from '@react-three/drei';
import { ThreeEvent } from '@react-three/fiber';
import GestureObject from './GestureObject';
import { ARObjectData, GestureType, ScreenCoordUpdateHandler } from '../types';

interface ARCanvasProps {
  objects: ARObjectData[];
  selectedId: string | null;
  onAddObject: (position: [number, number, number]) => void;
  onSelectObject: (id: string | null) => void;
  onUpdateObject: (id: string, data: Partial<ARObjectData>) => void;
  onGestureChange: (type: GestureType) => void;
  onLog: (msg: string) => void;
  onScreenCoordUpdate: ScreenCoordUpdateHandler;
}

const ARCanvas: React.FC<ARCanvasProps> = ({ 
  objects, 
  selectedId, 
  onAddObject, 
  onSelectObject, 
  onUpdateObject,
  onGestureChange,
  onLog,
  onScreenCoordUpdate
}) => {

  const handlePlaneClick = (e: ThreeEvent<MouseEvent>) => {
    onAddObject([e.point.x, e.point.y, 0]);
    onLog('Placed new object');
  };

  return (
    <div className="absolute inset-0 z-10">
      <Canvas
        camera={{ position: [0, 0, 10], fov: 45 }}
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
        style={{ pointerEvents: 'auto', touchAction: 'none' }}
        onPointerMissed={() => {
            onSelectObject(null);
            onScreenCoordUpdate(-1, -1); // Reset bridge coords when deselecting
        }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow />
        <pointLight position={[-10, -5, 5]} intensity={0.5} color="#ec4899" />
        
        <Suspense fallback={null}>
           <Environment preset="sunset" />
           
           {/* Invisible plane to catch clicks for placement */}
           <mesh 
             visible={false} 
             position={[0, 0, 0]} 
             onClick={handlePlaneClick}
           >
             <planeGeometry args={[100, 100]} />
             <meshBasicMaterial transparent opacity={0} />
           </mesh>

           {objects.map(obj => (
             <GestureObject
               key={obj.id}
               data={obj}
               isSelected={selectedId === obj.id}
               onSelect={onSelectObject}
               onUpdate={onUpdateObject}
               onGesture={onGestureChange}
               onLog={onLog}
               onScreenCoordUpdate={onScreenCoordUpdate}
             />
           ))}

           <ContactShadows 
            opacity={0.4} 
            scale={20} 
            blur={2} 
            far={5} 
            resolution={256} 
            color="#000000" 
            position={[0, 0, -1]} // Slightly behind objects
           />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default ARCanvas;