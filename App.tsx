import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ARObjectData, GestureType, LogEntry } from './types';
import ARCanvas from './components/ARCanvas';
import { Camera, Zap, Move, Maximize, RotateCcw, MousePointer2, Fingerprint, Trash2 } from 'lucide-react';
import clsx from 'clsx';

// Colors for new objects
const COLORS = ['#4f46e5', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const App: React.FC = () => {
  const [started, setStarted] = useState(false);
  const [objects, setObjects] = useState<ARObjectData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gesture, setGesture] = useState<GestureType>('IDLE');
  const [error, setError] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Coordinate Bridge: We use a ref to direct-update the DOM for high performance (60fps)
  const bridgeElementRef = useRef<HTMLDivElement>(null);

  const selectedObject = useMemo(() => objects.find(o => o.id === selectedId), [objects, selectedId]);

  const addLog = (message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setLogs(prev => [{ id, message, timestamp: Date.now() }, ...prev].slice(0, 3));
  };

  const handleAddObject = (pos: [number, number, number]) => {
    const newObj: ARObjectData = {
      id: Math.random().toString(36).substr(2, 9),
      position: pos,
      scale: [1, 1, 1],
      rotation: [0, 0, 0],
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    };
    setObjects(prev => [...prev, newObj]);
    setSelectedId(newObj.id);
    setGesture('TAP');
    setTimeout(() => setGesture('IDLE'), 500);
  };

  const handleUpdateObject = (id: string, data: Partial<ARObjectData>) => {
    setObjects(prev => prev.map(obj => obj.id === id ? { ...obj, ...data } : obj));
  };

  const handleDeleteSelected = () => {
    if (selectedId) {
        setObjects(prev => prev.filter(o => o.id !== selectedId));
        setSelectedId(null);
        if(bridgeElementRef.current) bridgeElementRef.current.innerText = "-";
        addLog('Object Deleted');
    }
  };

  // This function is passed down to the Canvas loop to update the bridge UI
  const handleScreenCoordUpdate = (x: number, y: number) => {
     if (bridgeElementRef.current) {
        if (x === -1 && y === -1) {
            bridgeElementRef.current.innerText = "-";
        } else {
            bridgeElementRef.current.innerText = `${x},${y}`;
        }
     }
  };

  const startAR = async () => {
    try {
      // Check for autostart bypass to allow testing in emulator without camera
      const params = new URLSearchParams(window.location.search);
      const isAutoStart = params.get('autostart') === '1';

      if (isAutoStart) {
          console.log("Autostart detected: Skipping camera check for automation");
          setStarted(true);
          return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setStarted(true);
        };
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Could not access camera. Using fallback mode.");
      setStarted(true); // Allow fallback usage
    }
  };

  // Auto-start check on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
        startAR();
    }

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const getGestureIcon = () => {
    switch (gesture) {
        case 'DRAG': return <Move className="w-5 h-5 text-yellow-400 animate-pulse" />;
        case 'PINCH': return <Maximize className="w-5 h-5 text-green-400 animate-pulse" />;
        case 'ROTATE': return <RotateCcw className="w-5 h-5 text-purple-400 animate-spin-slow" />;
        case 'TAP': return <MousePointer2 className="w-5 h-5 text-blue-400 animate-bounce" />;
        case 'LONG_PRESS': return <Fingerprint className="w-5 h-5 text-red-500 animate-pulse" />;
        default: return <Zap className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="relative w-full h-full bg-black text-white font-sans overflow-hidden selection:bg-indigo-500 selection:text-white select-none touch-none">
      
      {/* Camera Background */}
      {!started || new URLSearchParams(window.location.search).get('autostart') !== '1' ? (
           <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover z-0 opacity-80"
            playsInline
            muted
            autoPlay
          />
      ) : (
          /* Fallback background for emulator testing without camera */
          <div className="absolute inset-0 w-full h-full z-0 bg-gradient-to-b from-gray-900 to-gray-800 opacity-80" />
      )}

      {started && (
        <ARCanvas 
          objects={objects}
          selectedId={selectedId}
          onAddObject={handleAddObject}
          onSelectObject={setSelectedId}
          onUpdateObject={handleUpdateObject}
          onGestureChange={setGesture}
          onLog={addLog}
          onScreenCoordUpdate={handleScreenCoordUpdate}
        />
      )}

      <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-6">
        
        {/* HUD Top Row */}
        <div className="flex items-start justify-between animate-fade-in w-full">
          <div className="bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-xl max-w-[200px] pointer-events-auto">
             <h1 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">AR Lab</h1>
             <div className="flex items-center space-x-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${started ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs font-mono">{started ? 'ACTIVE' : 'IDLE'}</span>
             </div>
             <div className="text-[10px] text-gray-500">
                 Objects: {objects.length}
             </div>
          </div>

          {/* COORDINATE BRIDGE DISPLAY - ID REQUIRED FOR APPIUM */}
          <div className="flex flex-col items-end space-y-2">
            <div className="bg-red-900/60 backdrop-blur-md border border-red-500/50 p-4 rounded-2xl shadow-xl text-right">
                <h2 className="text-[10px] text-red-200 uppercase tracking-wider mb-1 font-bold">Coords Bridge</h2>
                <div className="flex items-center space-x-2 justify-end">
                    <div 
                        id="ar_coords_textview" 
                        ref={bridgeElementRef}
                        className="font-mono text-2xl text-white font-bold tracking-widest"
                    >
                        -
                    </div>
                </div>
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="flex flex-col items-center justify-center space-y-2 opacity-80">
             {logs.map((log) => (
                 <div key={log.id} className="bg-black/60 backdrop-blur text-white text-xs px-3 py-1 rounded-full shadow-lg">
                     {log.message}
                 </div>
             ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center space-y-4 pb-4 pointer-events-auto">
          {!started ? (
            <button
              onClick={startAR}
              className="group relative px-8 py-4 bg-white text-black rounded-full font-bold text-lg shadow-lg transition-transform hover:scale-105 flex items-center space-x-3"
            >
              <Camera className="w-6 h-6" />
              <span>Start AR Session</span>
            </button>
          ) : (
            <div className="w-full max-w-md flex flex-col gap-2">
              {/* Action Bar */}
              {selectedId && (
                  <div className="flex justify-center space-x-4 mb-2">
                       <button 
                         onClick={handleDeleteSelected}
                         className="bg-red-500/80 hover:bg-red-600 backdrop-blur text-white p-3 rounded-full shadow-lg transition-all active:scale-90"
                       >
                           <Trash2 className="w-5 h-5" />
                       </button>
                  </div>
              )}

              <div className="bg-black/50 backdrop-blur-lg border border-white/10 rounded-3xl p-2 flex items-center justify-between px-6 h-16 shadow-2xl">
                  <div className="flex items-center space-x-3">
                    <div className={clsx(
                      "p-2 rounded-full transition-colors duration-300",
                      gesture !== 'IDLE' ? "bg-indigo-500 text-white shadow-lg" : "bg-white/10 text-gray-400"
                    )}>
                       {getGestureIcon()}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 uppercase">Interaction</span>
                        <span className="font-bold text-sm tracking-wide text-white">
                            {gesture === 'IDLE' ? 'Ready' : gesture}
                        </span>
                    </div>
                  </div>
                  
                  <div className="h-8 w-px bg-white/10 mx-2" />
                  
                  <div className="text-[10px] text-gray-400 text-right leading-tight">
                     Tap = Place / Select<br/>
                     Drag = Move<br/>
                     Pinch = Resize
                  </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
