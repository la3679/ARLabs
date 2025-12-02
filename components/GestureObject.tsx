import React, { useRef, useEffect } from 'react';
import { useThree, useFrame, ThreeEvent } from '@react-three/fiber';
import { useGesture } from '@use-gesture/react';
import { useSpring, animated } from '@react-spring/three';
import * as THREE from 'three';
import { ARObjectData, GestureType, ScreenCoordUpdateHandler } from '../types';

interface GestureObjectProps {
  data: ARObjectData;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onUpdate: (id: string, newData: Partial<ARObjectData>) => void;
  onGesture: (type: GestureType) => void;
  onLog: (msg: string) => void;
  onScreenCoordUpdate: ScreenCoordUpdateHandler;
}

const GestureObject: React.FC<GestureObjectProps> = ({ 
  data, 
  isSelected, 
  onSelect, 
  onUpdate, 
  onGesture,
  onLog,
  onScreenCoordUpdate
}) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const { size, viewport, camera } = useThree();
  const aspect = size.width / viewport.width;
  
  // Fix: Use ReturnType<typeof setTimeout> to be environment agnostic
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Spring physics for smooth animation
  const [{ position, rotation, scale, color }, api] = useSpring(() => ({
    position: data.position,
    rotation: data.rotation,
    scale: data.scale,
    color: data.color,
    config: { tension: 200, friction: 20, mass: 1 },
  }));

  // Update spring when props change (e.g. from external updates or after drag drop)
  useEffect(() => {
    api.start({
      position: data.position,
      rotation: data.rotation,
      scale: isSelected ? [data.scale[0] * 1.1, data.scale[1] * 1.1, data.scale[2] * 1.1] : data.scale,
      color: isSelected ? '#fbbf24' : data.color, // Gold when selected
    });
  }, [data.position, data.rotation, data.scale, data.color, isSelected, api]);

  const bind = useGesture(
    {
      onDrag: ({ offset: [x, y], down, movement: [mx, my] }) => {
        // Cancel long press if moved significantly
        if ((Math.abs(mx) > 2 || Math.abs(my) > 2) && longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }

        if (!isSelected) {
            if(down) onSelect(data.id);
            return;
        }
        
        onGesture(down ? 'DRAG' : 'IDLE');
        
        // Screen to World projection (simplified for 2D plane at Z=0)
        const newPos: [number, number, number] = [x / aspect, -y / aspect, 0];
        
        // Fix: Use immediate: true to prevent spring snap-back or lag during drag.
        // This ensures the object stays exactly where the user releases it.
        api.start({ position: newPos, immediate: true });
        
        if (!down) {
          // On Drop: Commit final position to app state
          onUpdate(data.id, { position: newPos });
        }
      },
      onPinch: ({ offset: [s, a], down }) => {
        // Cancel long press on pinch
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }

        if (!isSelected) return;
        onGesture(down ? 'PINCH' : 'IDLE');
        const newScale = [s, s, s] as [number, number, number];
        const newRot: [number, number, number] = [data.rotation[0], data.rotation[1], a];
        
        api.start({ scale: newScale, rotation: newRot, immediate: down });
        
        if (!down) {
          onUpdate(data.id, { scale: newScale, rotation: newRot });
        }
      }
    },
    {
      drag: {
        from: () => [position.get()[0] * aspect, -position.get()[1] * aspect],
        filterTaps: true,
        enabled: true,
        threshold: 10
      },
      pinch: {
        scaleBounds: { min: 0.5, max: 5 },
        from: () => [scale.get()[0], rotation.get()[2]],
        enabled: true
      }
    }
  );

  const handlePointerDown = () => {
    longPressTimer.current = setTimeout(() => {
        onGesture('LONG_PRESS');
        onLog('Resetting Object');
        const resetRot: [number, number, number] = [0, 0, 0];
        const resetScale: [number, number, number] = [1, 1, 1];
        
        api.start({ rotation: resetRot, scale: resetScale });
        onUpdate(data.id, { rotation: resetRot, scale: resetScale });
        longPressTimer.current = null;
    }, 800);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
    }
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    // Stop propagation so we don't trigger "Place Object" on the background
    event.stopPropagation();
    
    if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
    }

    onSelect(data.id);
    onGesture('TAP');
    onLog('Object Selected');
    
    // Small bounce effect
    api.start({ 
        scale: [data.scale[0]*1.2, data.scale[1]*1.2, data.scale[2]*1.2],
        config: { tension: 500, friction: 15 },
        onRest: () => {
          api.start({ 
            scale: isSelected ? [data.scale[0] * 1.1, data.scale[1] * 1.1, data.scale[2] * 1.1] : data.scale 
          }); // restore
        }
    });
  };

  // Coordinate Bridge Logic: Project 3D position to 2D Screen Pixels
  useFrame(() => {
    if (isSelected && meshRef.current) {
      const vector = new THREE.Vector3();
      // Get current world position
      meshRef.current.getWorldPosition(vector);
      
      // Project to Normalized Device Coordinates (-1 to +1)
      vector.project(camera);

      // Convert NDC to Screen Pixels
      // vector.x: -1 (left) to +1 (right)
      // vector.y: -1 (bottom) to +1 (top) -> Needs inversion for Screen Y (top=0)
      const x = (vector.x * 0.5 + 0.5) * size.width;
      const y = (-(vector.y) * 0.5 + 0.5) * size.height;

      onScreenCoordUpdate(Math.round(x), Math.round(y));
    }
  });

  const gestures = bind();

  return (
    <animated.mesh
      ref={meshRef}
      {...gestures}
      onPointerDown={(e) => {
        (gestures as any).onPointerDown?.(e);
        handlePointerDown();
      }}
      onPointerUp={(e) => {
        (gestures as any).onPointerUp?.(e);
        handlePointerUp();
      }}
      onPointerLeave={(e) => {
        (gestures as any).onPointerLeave?.(e);
        handlePointerUp();
      }}
      onClick={handleClick}
      position={position}
      rotation={rotation}
      scale={scale}
    >
      <dodecahedronGeometry args={[0.8, 0]} />
      <animated.meshStandardMaterial 
        color={color} 
        metalness={0.6}
        roughness={0.2}
      />
      
      {/* Selection Highlight */}
      {isSelected && (
        <animated.mesh>
           <sphereGeometry args={[1.2, 16, 16]} />
           <meshBasicMaterial color="white" wireframe transparent opacity={0.3} />
        </animated.mesh>
      )}
    </animated.mesh>
  );
};

export default GestureObject;