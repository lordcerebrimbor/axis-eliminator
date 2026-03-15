/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Crosshair, Shield, ShieldAlert, AlertTriangle, Activity, 
  Map as MapIcon, Radio, Target, Layers, Search, 
  ChevronRight, Maximize, Settings, Database, Wifi, Download
} from 'lucide-react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const MIN_LAT = 33.0;
const MAX_LAT = 35.0;
const MIN_LON = -119.0;
const MAX_LON = -117.0;

// --- Types ---
type EntityType = 'hostile' | 'friendly' | 'unknown' | 'neutral';
type Entity = {
  id: string;
  type: EntityType;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  heading: number; // degrees
  speed: number;
  realSpeed: number; // knots
  status: string;
  lastUpdated: number;
  elevation: number;
  classification: string;
  lat: number;
  lng: number;
  health: number; // percentage 0-100
};

type IntelLog = {
  id: string;
  timestamp: Date;
  message: string;
  level: 'info' | 'warn' | 'critical';
  source: string;
};

// --- Mock Data Generators ---
const generateId = (prefix: string) => `${prefix}-${Math.floor(Math.random() * 9000) + 1000}`;

const INITIAL_ENTITIES: Entity[] = [
  { id: 'FR-882', type: 'friendly', x: 45, y: 55, heading: 45, speed: 0.1, realSpeed: 450, status: 'PATROL', lastUpdated: Date.now(), elevation: 12000, classification: 'F-35A', lat: 33.9, lng: -118.1, health: 100 },
  { id: 'HOS-109', type: 'hostile', x: 80, y: 20, heading: 220, speed: 0.15, realSpeed: 600, status: 'INTERCEPT', lastUpdated: Date.now(), elevation: 15000, classification: 'SU-57', lat: 34.6, lng: -117.4, health: 85 },
  { id: 'UNK-404', type: 'unknown', x: 20, y: 80, heading: 90, speed: 0.05, realSpeed: 200, status: 'MONITORING', lastUpdated: Date.now(), elevation: 500, classification: 'UNIDENTIFIED_VESSEL', lat: 33.4, lng: -118.6, health: 100 },
  { id: 'NEU-991', type: 'neutral', x: 60, y: 40, heading: 180, speed: 0.02, realSpeed: 100, status: 'TRANSIT', lastUpdated: Date.now(), elevation: 35000, classification: 'BOEING_777', lat: 34.2, lng: -117.8, health: 100 },
];

const getColorForType = (type: EntityType) => {
  switch (type) {
    case 'hostile': return '#FF1A40'; // Bright Neon Red
    case 'friendly': return '#00FF66'; // Bright Neon Green
    case 'unknown': return '#FFEA00'; // Bright Neon Yellow
    case 'neutral': return '#00FFFF'; // Pure Cyan
    default: return '#FFFFFF';
  }
};

// --- Components ---

const Header = ({ searchQuery, onSearchChange, onExport, entities }: { searchQuery: string, onSearchChange: (q: string) => void, onExport: () => void, entities: Entity[] }) => {
  const calculateThreatLevel = () => {
    const hostileCount = entities.filter(e => e.type === 'hostile').length;
    const unknownCount = entities.filter(e => e.type === 'unknown').length;
    
    const score = (hostileCount * 10) + (unknownCount * 2);
    
    if (score === 0) return { level: 'DEFCON 5', color: '#00FF66', text: 'LOW THREAT' };
    if (score <= 10) return { level: 'DEFCON 4', color: '#00FFFF', text: 'ELEVATED' };
    if (score <= 30) return { level: 'DEFCON 3', color: '#FFEA00', text: 'HIGH THREAT' };
    if (score <= 60) return { level: 'DEFCON 2', color: '#FF8C00', text: 'SEVERE' };
    return { level: 'DEFCON 1', color: '#FF1A40', text: 'CRITICAL' };
  };

  const threat = calculateThreatLevel();

  return (
    <header className="h-14 border-b border-[#00E5FF]/20 bg-[#050505] flex items-center justify-between px-4 z-50 relative">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-[#00E5FF]">
          <Activity size={20} />
          <span className="font-bold tracking-[0.2em] text-sm">NEXUS // GOTHAM</span>
        </div>
        <div className="h-4 w-px bg-white/20 mx-2" />
        <div className="flex items-center gap-3 text-xs font-mono text-gray-400">
          <span className="flex items-center gap-1"><Wifi size={12} className="text-[#00FF66]" /> UPLINK SECURE</span>
          <span className="flex items-center gap-1"><Database size={12} /> DATALINK ACTIVE</span>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div 
          className="flex items-center gap-2 text-xs font-mono px-3 py-1 border transition-colors duration-500"
          style={{ 
            color: threat.color, 
            borderColor: `${threat.color}40`,
            backgroundColor: `${threat.color}10`
          }}
        >
          <span className="font-bold">{threat.level}</span>
          <span className="w-px h-3 bg-current opacity-50" />
          <span>{threat.text}</span>
        </div>
        <div className="text-xs font-mono text-gray-400">
          {new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC
        </div>
        <div className="flex items-center gap-3 border-l border-white/10 pl-6">
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-2 text-gray-400" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search ID or Class..." 
              className="bg-black/50 border border-white/20 text-xs font-mono text-white pl-8 pr-2 py-1 focus:outline-none focus:border-[#00E5FF] transition-colors w-48 placeholder:text-gray-600"
            />
          </div>
          <button onClick={onExport} className="text-gray-400 hover:text-[#00E5FF] transition-colors ml-2" title="Export Intel Data">
            <Download size={16} />
          </button>
          <Settings size={16} className="text-gray-400 hover:text-white cursor-pointer ml-2" />
          <div className="w-8 h-8 bg-gray-800 border border-gray-600 flex items-center justify-center text-xs font-bold ml-2">
            OP
          </div>
        </div>
      </div>
    </header>
  );
};

const LiveMetrics = () => {
  const [threatData, setThreatData] = useState<number[]>(Array(20).fill(25));
  const [networkData, setNetworkData] = useState<number[]>(Array(20).fill(80));

  useEffect(() => {
    const interval = setInterval(() => {
      setThreatData(prev => [...prev.slice(1), Math.max(10, Math.min(90, prev[prev.length - 1] + (Math.random() * 10 - 5)))]);
      setNetworkData(prev => [...prev.slice(1), Math.max(40, Math.min(100, prev[prev.length - 1] + (Math.random() * 20 - 10)))]);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 border-t border-white/10 mt-auto bg-black/40">
      <h2 className="text-xs font-bold text-gray-500 tracking-widest uppercase mb-4">Live System Monitoring</h2>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-[10px] font-mono mb-1">
            <span className="text-gray-400">GLOBAL THREAT</span>
            <span className="text-[#FF3366]">{Math.round(threatData[threatData.length-1])}%</span>
          </div>
          <svg className="w-full h-8 bg-black/30" preserveAspectRatio="none" viewBox="0 0 100 100">
            <polyline
              points={threatData.map((val, i) => `${(i / 19) * 100},${100 - val}`).join(' ')}
              fill="none"
              stroke="#FF3366"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
        <div>
          <div className="flex justify-between text-[10px] font-mono mb-1">
            <span className="text-gray-400">SATCOM UPLINK</span>
            <span className="text-[#00E5FF]">{Math.round(networkData[networkData.length-1])}%</span>
          </div>
          <svg className="w-full h-8 bg-black/30" preserveAspectRatio="none" viewBox="0 0 100 100">
            <polyline
              points={networkData.map((val, i) => `${(i / 19) * 100},${100 - val}`).join(' ')}
              fill="none"
              stroke="#00E5FF"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};

const LeftPanel = () => (
  <aside className="w-64 border-r border-[#00E5FF]/20 bg-[#0A0A0A]/90 backdrop-blur-md flex flex-col z-40 relative">
    <div className="p-4 border-b border-white/10">
      <h2 className="text-xs font-bold text-gray-500 tracking-widest uppercase mb-4">Active Layers</h2>
      <div className="space-y-2">
        {['SIGINT', 'GEOINT', 'HUMINT', 'OSINT', 'MASINT'].map((layer, i) => (
          <div key={layer} className="flex items-center justify-between text-sm font-mono">
            <div className="flex items-center gap-2">
              <input type="checkbox" defaultChecked={i < 3} className="accent-[#00E5FF] bg-black border-gray-600" />
              <span className={i < 3 ? 'text-white' : 'text-gray-500'}>{layer}</span>
            </div>
            {i < 3 && <span className="w-2 h-2 rounded-full bg-[#00FF66] animate-pulse" />}
          </div>
        ))}
      </div>
    </div>
    
    <div className="p-4 flex-1 overflow-y-auto">
      <h2 className="text-xs font-bold text-gray-500 tracking-widest uppercase mb-4">Operations</h2>
      <div className="space-y-3">
        <div className="border border-[#FF3366]/30 bg-[#FF3366]/5 p-3 cursor-pointer hover:bg-[#FF3366]/10 transition-colors">
          <div className="text-xs font-mono text-[#FF3366] mb-1 flex items-center justify-between">
            <span>OP: RED STORM</span>
            <AlertTriangle size={12} />
          </div>
          <div className="text-[10px] text-gray-400 font-mono">STATUS: ACTIVE ENGAGEMENT</div>
        </div>
        <div className="border border-[#00E5FF]/30 bg-[#00E5FF]/5 p-3 cursor-pointer hover:bg-[#00E5FF]/10 transition-colors">
          <div className="text-xs font-mono text-[#00E5FF] mb-1">OP: SILENT WATCH</div>
          <div className="text-[10px] text-gray-400 font-mono">STATUS: MONITORING</div>
        </div>
      </div>
    </div>
    <LiveMetrics />
  </aside>
);

const MapOverlay = ({ 
  entities, 
  selectedId, 
  onSelect,
  onContextMenu
}: { 
  entities: Entity[], 
  selectedId: string | null, 
  onSelect: (id: string) => void,
  onContextMenu: (e: React.MouseEvent, id: string) => void
}) => {
  const map = useMap();
  const [positions, setPositions] = useState<Record<string, {x: number, y: number}>>({});

  useEffect(() => {
    const updatePositions = () => {
      const newPositions: Record<string, {x: number, y: number}> = {};
      entities.forEach(entity => {
        const point = map.latLngToContainerPoint([entity.lat, entity.lng]);
        newPositions[entity.id] = { x: point.x, y: point.y };
      });
      setPositions(newPositions);
    };
    
    updatePositions();
    map.on('move', updatePositions);
    map.on('zoom', updatePositions);
    map.on('resize', updatePositions);
    
    return () => {
      map.off('move', updatePositions);
      map.off('zoom', updatePositions);
      map.off('resize', updatePositions);
    };
  }, [map, entities]);

  return (
    <div className="absolute inset-0 pointer-events-none z-[400]">
      {/* Predicted Path Overlay */}
      {(() => {
        const selectedEntity = entities.find(e => e.id === selectedId);
        if (!selectedEntity || selectedEntity.speed === 0 || !positions[selectedEntity.id]) return null;
        
        const startPos = positions[selectedEntity.id];
        const distanceLat = Math.cos(selectedEntity.heading * Math.PI / 180) * (selectedEntity.realSpeed / 3600);
        const distanceLng = Math.sin(selectedEntity.heading * Math.PI / 180) * (selectedEntity.realSpeed / 3600) / Math.cos(selectedEntity.lat * Math.PI / 180);
        
        const endLatLng = [
          selectedEntity.lat + distanceLat * 60,
          selectedEntity.lng + distanceLng * 60
        ] as [number, number];
        
        const endPos = map.latLngToContainerPoint(endLatLng);
        const color = getColorForType(selectedEntity.type);
        
        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <g opacity="0.6">
              <line 
                x1={startPos.x} 
                y1={startPos.y} 
                x2={endPos.x} 
                y2={endPos.y} 
                stroke={color} 
                strokeWidth="1.5" 
                strokeDasharray="4 4" 
              />
              <circle 
                cx={endPos.x} 
                cy={endPos.y} 
                r="3" 
                fill="none" 
                stroke={color} 
                strokeWidth="1" 
              />
              <text 
                x={endPos.x} 
                y={endPos.y} 
                dx="8" 
                dy="3" 
                fill={color} 
                fontSize="9" 
                fontFamily="monospace"
                className="drop-shadow-md"
              >
                T+60s
              </text>
            </g>
          </svg>
        );
      })()}

      {/* Entities */}
      {entities.map(entity => {
        const pos = positions[entity.id];
        if (!pos) return null;
        const color = getColorForType(entity.type);
        const isSelected = entity.id === selectedId;
        
        return (
          <motion.div
            key={entity.id}
            className={`absolute w-8 h-8 -ml-4 -mt-4 cursor-pointer pointer-events-auto flex items-center justify-center group ${isSelected ? 'target-bracket' : ''}`}
            style={{ 
              left: pos.x, 
              top: pos.y, 
              color,
              filter: `drop-shadow(0 0 6px ${color}) drop-shadow(0 0 12px ${color})`
            }}
            animate={{ left: pos.x, top: pos.y }}
            transition={{ duration: 1, ease: "linear" }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(entity.id);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect(entity.id);
              onContextMenu(e, entity.id);
            }}
          >
            {/* Hover ring */}
            <div className="absolute inset-0 rounded-full border border-current opacity-0 group-hover:opacity-80 scale-150 group-hover:scale-100 transition-all duration-300 pointer-events-none" />
            
            {/* Entity Icon/Shape based on type */}
            <div 
              className="w-4 h-4 flex items-center justify-center"
              style={{ transform: `rotate(${entity.heading}deg)` }}
            >
              {entity.type === 'hostile' && <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[12px] border-l-transparent border-r-transparent border-b-current" />}
              {entity.type === 'friendly' && <div className="w-3 h-3 bg-current rounded-full" />}
              {entity.type === 'unknown' && <div className="w-3 h-3 border-2 border-current" />}
              {entity.type === 'neutral' && <div className="w-3 h-3 bg-current" style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }} />}
            </div>

            {/* Label and Health */}
            <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 flex flex-col items-center gap-0.5 pointer-events-none transition-opacity ${entity.health < 100 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              <div className="text-[10px] font-mono whitespace-nowrap bg-black/80 px-1.5 py-0.5 rounded border border-current">
                {entity.id}
              </div>
              <div className="w-8 h-1 bg-black border border-current rounded-sm overflow-hidden">
                <div 
                  className="h-full transition-all duration-300"
                  style={{ 
                    width: `${entity.health}%`,
                    backgroundColor: entity.health > 50 ? '#00FF66' : entity.health > 25 ? '#FFEA00' : '#FF1A40'
                  }}
                />
              </div>
            </div>
            
            {/* Velocity Vector Line */}
            {entity.speed > 0 && (
              <div 
                className="absolute top-1/2 left-1/2 w-px origin-bottom pointer-events-none opacity-80"
                style={{ 
                  height: `${entity.speed * 100}px`, 
                  backgroundColor: color,
                  transform: `translate(-50%, -100%) rotate(${entity.heading}deg)`,
                  boxShadow: `0 0 4px ${color}`
                }}
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

const TacticalMap = ({ 
  entities, 
  selectedId, 
  onSelect,
  onContextMenu
}: { 
  entities: Entity[], 
  selectedId: string | null, 
  onSelect: (id: string) => void,
  onContextMenu: (e: React.MouseEvent, id: string) => void
}) => {
  return (
    <div className="flex-1 relative bg-[#020202] overflow-hidden" onClick={() => onSelect('')}>
      {/* Satellite Map Background */}
      <div className="absolute inset-0 z-0 opacity-40 saturate-50 contrast-125 mix-blend-screen">
        <MapContainer 
          bounds={[[MIN_LAT, MIN_LON], [MAX_LAT, MAX_LON]]} 
          zoomControl={false} 
          dragging={true} 
          scrollWheelZoom={true} 
          doubleClickZoom={true}
          attributionControl={false}
          style={{ width: '100%', height: '100%', background: 'transparent' }}
        >
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
          <MapOverlay entities={entities} selectedId={selectedId} onSelect={onSelect} onContextMenu={onContextMenu} />
        </MapContainer>
      </div>

      {/* Grid Backgrounds */}
      <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none z-10" />
      <div className="absolute inset-0 bg-grid-large opacity-20 pointer-events-none z-10" />
      
      {/* Radar Sweep */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
        <div className="radar-sweep" />
      </div>

      {/* Crosshairs Center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-20 z-10">
        <div className="w-[800px] h-[800px] border border-[#00E5FF] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-[#00E5FF] rounded-full" />
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-[#00E5FF]" />
        <div className="absolute left-0 right-0 top-1/2 h-px bg-[#00E5FF]" />
      </div>

      {/* Map Overlay Coordinates */}
      <div className="absolute bottom-4 left-4 text-[10px] font-mono text-[#00E5FF]/50 z-10 pointer-events-none">
        LIVE TRACKING: SOUTHERN CALIFORNIA<br/>
        LAT: 33.0N - 35.0N<br/>
        LNG: 119.0W - 117.0W<br/>
        SOURCE: OPENSKY NETWORK
      </div>
    </div>
  );
};

const RightPanel = ({ selectedEntity, logs, onTaskAsset }: { selectedEntity: Entity | null, logs: IntelLog[], onTaskAsset: (id: string) => void }) => {
  const [showTaskDialog, setShowTaskDialog] = useState(false);

  return (
    <aside className="w-80 border-l border-[#00E5FF]/20 bg-[#0A0A0A]/90 backdrop-blur-md flex flex-col z-40 relative">
    {/* Entity Details */}
    <div className="flex flex-col border-b border-white/10 max-h-[60%]">
      <div className="p-3 border-b border-white/5 bg-black/40 flex items-center justify-between shrink-0">
        <h2 className="text-xs font-bold text-gray-500 tracking-widest uppercase">Target Telemetry</h2>
        <Target size={14} className="text-[#00E5FF]" />
      </div>
      
      <div className="p-4 overflow-y-auto">
        {selectedEntity ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-2xl font-mono font-bold" style={{ color: getColorForType(selectedEntity.type) }}>
                  {selectedEntity.id}
                </div>
                <div className="text-xs font-mono text-gray-400 uppercase">{selectedEntity.classification}</div>
              </div>
              <div className="px-2 py-1 border text-[10px] font-mono uppercase font-bold" 
                   style={{ borderColor: getColorForType(selectedEntity.type), color: getColorForType(selectedEntity.type) }}>
                {selectedEntity.type}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-black/50 border border-white/5 p-2">
                <div className="text-gray-500 mb-1">STATUS</div>
                <div className="text-white">{selectedEntity.status}</div>
              </div>
              <div className="bg-black/50 border border-white/5 p-2">
                <div className="text-gray-500 mb-1">HEALTH</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-black border border-white/20 rounded-sm overflow-hidden">
                    <div 
                      className="h-full transition-all duration-300"
                      style={{ 
                        width: `${selectedEntity.health}%`,
                        backgroundColor: selectedEntity.health > 50 ? '#00FF66' : selectedEntity.health > 25 ? '#FFEA00' : '#FF1A40'
                      }}
                    />
                  </div>
                  <span className="text-white w-8 text-right">{Math.round(selectedEntity.health)}%</span>
                </div>
              </div>
              <div className="bg-black/50 border border-white/5 p-2">
                <div className="text-gray-500 mb-1">ELEVATION</div>
                <div className="text-white">{selectedEntity.elevation} FT</div>
              </div>
              <div className="bg-black/50 border border-white/5 p-2">
                <div className="text-gray-500 mb-1">HEADING</div>
                <div className="text-white">{Math.round(selectedEntity.heading)}&deg;</div>
              </div>
              <div className="bg-black/50 border border-white/5 p-2">
                <div className="text-gray-500 mb-1">SPEED</div>
                <div className="text-white">{Math.round(selectedEntity.realSpeed)} KTS</div>
              </div>
            </div>

            <div className="bg-black/50 border border-white/5 p-2 text-xs font-mono">
              <div className="text-gray-500 mb-1">COORDINATES</div>
              <div className="text-[#00E5FF]">
                {selectedEntity.lat.toFixed(4)} N<br/>
                {Math.abs(selectedEntity.lng).toFixed(4)} W
              </div>
            </div>

            {/* LIVE OPTICAL FEED */}
            <div className="mt-2">
              <div className="text-[10px] font-mono text-gray-500 mb-1 flex justify-between">
                <span>LIVE OPTICAL FEED</span>
                <span className="text-[#00FF66] animate-pulse">LINK ACTIVE</span>
              </div>
              <div className="relative h-24 bg-[#020202] border border-white/10 overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 bg-grid opacity-20" />
                <div className="absolute top-1 left-1 text-[8px] font-mono text-[#00FF66] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-[#00FF66] rounded-full animate-pulse" /> REC
                </div>
                <div className="absolute bottom-1 right-1 text-[8px] font-mono text-gray-500">
                  {Math.random().toString(36).substring(2, 10).toUpperCase()}
                </div>
                <Crosshair size={20} className="text-[#00FF66] opacity-40" />
                <motion.div 
                  className="absolute top-0 left-0 right-0 h-0.5 bg-[#00FF66]/20"
                  animate={{ top: ['0%', '100%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                />
              </div>
            </div>
            
            <button 
              onClick={() => setShowTaskDialog(true)}
              className="w-full py-2 border border-white/20 hover:bg-white/10 text-xs font-mono uppercase tracking-widest transition-colors active:bg-white/20 mt-2">
              Task Asset
            </button>
          </div>
        ) : (
          <div className="py-8 flex flex-col items-center justify-center text-gray-600">
            <Crosshair size={32} className="mb-2 opacity-50" />
            <div className="text-xs font-mono uppercase tracking-widest">No Target Selected</div>
          </div>
        )}
      </div>
    </div>

    {/* Live Intel Feed */}
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-3 border-b border-white/5 bg-black/40 flex items-center justify-between shrink-0">
        <h2 className="text-xs font-bold text-gray-500 tracking-widest uppercase">Live Intel Feed</h2>
        <Radio size={14} className="text-[#00E5FF]" />
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <AnimatePresence initial={false}>
          {logs.map((log) => (
            <motion.div 
              key={log.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-2 border-l-2 text-[10px] font-mono bg-black/40 ${
                log.level === 'critical' ? 'border-[#FF3366] text-[#FF3366]' : 
                log.level === 'warn' ? 'border-[#FFD600] text-[#FFD600]' : 
                'border-[#00E5FF] text-gray-300'
              }`}
            >
              <div className="flex justify-between opacity-70 mb-1">
                <span>{log.timestamp.toISOString().substring(11, 19)}</span>
                <span>[{log.source}]</span>
              </div>
              <div>{log.message}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>

    {/* Task Confirmation Dialog */}
    <AnimatePresence>
      {showTaskDialog && selectedEntity && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#0A0A0A] border border-[#00E5FF]/50 p-4 w-full shadow-[0_0_15px_rgba(0,229,255,0.2)]"
          >
            <div className="flex items-center gap-2 text-[#00E5FF] mb-3 border-b border-[#00E5FF]/20 pb-2">
              <AlertTriangle size={16} />
              <h3 className="text-xs font-bold font-mono uppercase tracking-widest">Confirm Tasking</h3>
            </div>
            <p className="text-xs font-mono text-gray-300 mb-4">
              Initiate tasking sequence for asset <span className="text-white font-bold">{selectedEntity.id}</span>? This action will be logged in the operational record.
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowTaskDialog(false)}
                className="flex-1 py-2 border border-gray-600 hover:bg-gray-800 text-xs font-mono uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  onTaskAsset(selectedEntity.id);
                  setShowTaskDialog(false);
                }}
                className="flex-1 py-2 border border-[#00E5FF] bg-[#00E5FF]/10 hover:bg-[#00E5FF]/20 text-[#00E5FF] text-xs font-mono uppercase tracking-widest transition-colors"
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  </aside>
  );
};

export default function App() {
  const [entities, setEntities] = useState<Entity[]>(INITIAL_ENTITIES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [logs, setLogs] = useState<IntelLog[]>([
    { id: '1', timestamp: new Date(), message: 'SYSTEM INITIALIZED. DATALINKS ACTIVE.', level: 'info', source: 'SYS' }
  ]);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, entityId: string } | null>(null);

  // Live Data Fetching
  useEffect(() => {
    const fetchRealData = async () => {
      try {
        const url = `https://opensky-network.org/api/states/all?lamin=${MIN_LAT}&lomin=${MIN_LON}&lamax=${MAX_LAT}&lomax=${MAX_LON}`;
        let data;
        
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error('API Error');
          data = await res.json();
        } catch (err) {
          // Fallback to CORS proxy if direct fetch fails
          const proxyRes = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
          if (!proxyRes.ok) throw new Error('Proxy Error');
          const proxyData = await proxyRes.json();
          if (!proxyData.contents) throw new Error('Empty proxy contents');
          try {
            data = JSON.parse(proxyData.contents);
          } catch (parseErr) {
            throw new Error('Invalid JSON from proxy');
          }
        }
        
        if (data && data.states) {
          const liveEntities: Entity[] = data.states.map((state: any) => {
            const lon = state[5];
            const lat = state[6];
            const velocity = state[9] || 0;
            const true_track = state[10] || 0;
            
            const x = ((lon - MIN_LON) / (MAX_LON - MIN_LON)) * 100;
            const y = ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * 100;
            
            let type: EntityType = 'neutral';
            if (state[2] === 'United States') type = 'friendly';
            else if (state[2] === 'Russian Federation' || state[2] === 'China') type = 'hostile';
            else if (!state[2]) type = 'unknown';

            return {
              id: (state[1] || state[0]).trim(),
              type,
              x,
              y,
              heading: true_track,
              speed: velocity * 0.0005, // visual speed
              realSpeed: velocity * 1.94384, // knots
              status: state[8] ? 'GROUNDED' : 'AIRBORNE',
              lastUpdated: Date.now(),
              elevation: (state[7] || 0) * 3.28084, // feet
              classification: state[2] || 'UNKNOWN ORIGIN',
              lat,
              lng: lon,
              health: 100 // Default health for live entities
            };
          });
          
          setEntities(liveEntities);
          setLogs(prev => [{
            id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9),
            timestamp: new Date(),
            message: `OPENSKY DATALINK: ${liveEntities.length} LIVE CONTACTS SYNCED`,
            level: 'info',
            source: 'SAT_COM'
          }, ...prev].slice(0, 50));
        }
      } catch (error) {
        // Silently handle network/proxy errors as the UI already displays a fallback warning
        setLogs(prev => [{
          id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9),
          timestamp: new Date(),
          message: 'DATALINK ERROR: FALLING BACK TO INTERNAL SENSORS',
          level: 'warn',
          source: 'SYS'
        }, ...prev].slice(0, 50));
      }
    };

    fetchRealData();
    const intervalId = setInterval(fetchRealData, 15000);
    return () => clearInterval(intervalId);
  }, []);

  // Simulation Loop (Interpolation)
  useEffect(() => {
    const interval = setInterval(() => {
      setEntities(prev => prev.map(entity => {
        if (entity.speed === 0) return entity;

        // Calculate new position based on heading and speed
        const rad = (entity.heading - 90) * (Math.PI / 180);
        let newX = entity.x + Math.cos(rad) * entity.speed;
        let newY = entity.y + Math.sin(rad) * entity.speed;
        let newHeading = entity.heading;
        
        // Update lat/lng for telemetry panel
        let newLat = entity.lat - Math.sin(rad) * entity.speed * 0.02;
        let newLng = entity.lng + Math.cos(rad) * entity.speed * 0.02;

        // Bounce off walls (simple bounds checking)
        if (newX < 0 || newX > 100) {
          newHeading = 360 - newHeading;
          newX = Math.max(0, Math.min(100, newX));
        }
        if (newY < 0 || newY > 100) {
          newHeading = 180 - newHeading;
          newY = Math.max(0, Math.min(100, newY));
        }
        
        // Normalize heading
        newHeading = (newHeading + 360) % 360;

        return { ...entity, x: newX, y: newY, lat: newLat, lng: newLng, heading: newHeading, lastUpdated: Date.now() };
      }));
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  // Random Event Generator (Logs & Entity Spawns)
  useEffect(() => {
    const eventInterval = setInterval(() => {
      const rand = Math.random();
      
      if (rand > 0.7) {
        // Generate a log
        const newLog: IntelLog = {
          id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9),
          timestamp: new Date(),
          message: rand > 0.9 ? 'UNAUTHORIZED RADAR PAINT DETECTED' : 'SIGINT INTERCEPT LOGGED',
          level: rand > 0.9 ? 'critical' : 'info',
          source: rand > 0.9 ? 'EW_SYS' : 'SAT_COM'
        };
        setLogs(prev => [newLog, ...prev].slice(0, 50)); // Keep last 50
      }
      
      if (rand > 0.95) {
        // Spawn a new unknown entity temporarily
        const newEntity: Entity = {
          id: generateId('UNK'),
          type: 'unknown',
          x: Math.random() * 100,
          y: Math.random() * 100,
          heading: Math.random() * 360,
          speed: 0.1 + Math.random() * 0.1,
          realSpeed: 200 + Math.random() * 300,
          status: 'DETECTED',
          lastUpdated: Date.now(),
          elevation: Math.floor(Math.random() * 40000),
          classification: 'UNIDENTIFIED',
          lat: 33.0 + Math.random() * 2.0,
          lng: -119.0 + Math.random() * 2.0,
          health: 100
        };
        setEntities(prev => [...prev, newEntity]);
        
        setLogs(prev => [{
          id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9),
          timestamp: new Date(),
          message: `NEW CONTACT DETECTED: ${newEntity.id}`,
          level: 'warn',
          source: 'RADAR_NET'
        }, ...prev].slice(0, 50));
      }

      // Random health decrease to simulate combat/damage
      if (rand < 0.05) {
        setEntities(prev => {
          if (prev.length === 0) return prev;
          const targetIdx = Math.floor(Math.random() * prev.length);
          const target = prev[targetIdx];
          if (target.health <= 0) return prev;
          
          const damage = Math.floor(Math.random() * 20) + 5;
          const newHealth = Math.max(0, target.health - damage);
          
          setLogs(logs => [{
            id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9),
            timestamp: new Date(),
            message: `WEAPONS IMPACT ON ${target.id}. INTEGRITY AT ${newHealth}%`,
            level: newHealth < 25 ? 'critical' : 'warn',
            source: 'BATTLE_NET'
          }, ...logs].slice(0, 50));

          const newEntities = [...prev];
          newEntities[targetIdx] = { ...target, health: newHealth };
          return newEntities;
        });
      }
    }, 3000);

    return () => clearInterval(eventInterval);
  }, []);

  const selectedEntity = entities.find(e => e.id === selectedId) || null;

  const filteredEntities = entities.filter(e => 
    e.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
    e.classification.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTaskAsset = (id: string) => {
    setLogs(prev => [{
      id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date(),
      message: `ASSET TASKED TO INTERCEPT: ${id}`,
      level: 'warn',
      source: 'CMD'
    }, ...prev].slice(0, 50));
  };

  const handleContextMenuAction = (action: string, entityId: string) => {
    setContextMenu(null);
    setLogs(prev => [{
      id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date(),
      message: `${action.toUpperCase()} INITIATED FOR: ${entityId}`,
      level: 'info',
      source: 'CMD'
    }, ...prev].slice(0, 50));
  };

  const handleExport = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      entities: entities,
      logs: logs
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-intel-export-${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setLogs(prev => [{
      id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date(),
      message: `DATA EXPORT COMPLETED`,
      level: 'info',
      source: 'SYS'
    }, ...prev].slice(0, 50));
  };

  return (
    <div className="h-screen w-screen bg-black text-white flex flex-col overflow-hidden selection:bg-[#00E5FF]/30" onClick={() => setContextMenu(null)}>
      <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} onExport={handleExport} entities={entities} />
      <div className="flex-1 flex overflow-hidden relative">
        <LeftPanel />
        <TacticalMap 
          entities={filteredEntities} 
          selectedId={selectedId} 
          onSelect={setSelectedId} 
          onContextMenu={(e, id) => setContextMenu({ x: e.clientX, y: e.clientY, entityId: id })}
        />
        <RightPanel 
          selectedEntity={selectedEntity} 
          logs={logs} 
          onTaskAsset={handleTaskAsset}
        />
        
        {/* Context Menu */}
        <AnimatePresence>
          {contextMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className="absolute z-50 bg-[#0A0A0A]/95 border border-[#00E5FF]/30 backdrop-blur-md shadow-2xl shadow-black/50 py-1 min-w-[160px]"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-1.5 border-b border-white/10 text-[10px] font-mono text-gray-500 mb-1">
                TARGET: {contextMenu.entityId}
              </div>
              <button 
                className="w-full text-left px-4 py-2 text-xs font-mono text-white hover:bg-[#00E5FF]/20 hover:text-[#00E5FF] transition-colors"
                onClick={() => handleContextMenuAction('Query Intel', contextMenu.entityId)}
              >
                Query Intel
              </button>
              <button 
                className="w-full text-left px-4 py-2 text-xs font-mono text-white hover:bg-[#00E5FF]/20 hover:text-[#00E5FF] transition-colors"
                onClick={() => handleContextMenuAction('Set Waypoint', contextMenu.entityId)}
              >
                Set Waypoint
              </button>
              <button 
                className="w-full text-left px-4 py-2 text-xs font-mono text-[#FF3366] hover:bg-[#FF3366]/20 transition-colors"
                onClick={() => handleContextMenuAction('Disengage', contextMenu.entityId)}
              >
                Disengage
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scanlines Overlay for CRT effect */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] z-50 opacity-20 mix-blend-overlay" />
      </div>
    </div>
  );
}
