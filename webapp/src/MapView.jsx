import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, SVGOverlay } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapPin, Package, Navigation, Check } from 'lucide-react';

// Fix icons
delete L.Icon.Default.prototype._getIconUrl;

// Custom Marker Icons
const createCustomIcon = (index, total) => {
  const isStart = index === 0;
  const isEnd = index === total - 1;
  
  if (isStart) {
    return L.divIcon({
      html: `<div class="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-700 rounded-full shadow-lg border-4 border-white dark:border-gray-800 text-white font-black text-xs">START</div>`,
      iconSize: [40, 40],
      className: 'custom-marker-start',
    });
  }
  
  if (isEnd) {
    return L.divIcon({
      html: `<div class="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-accent-500 to-accent-600 rounded-full shadow-lg border-4 border-white dark:border-gray-800 text-white font-black text-xs">END</div>`,
      iconSize: [40, 40],
      className: 'custom-marker-end',
    });
  }

  const colors = [
    'bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-rose-500'
  ];
  const colorClass = colors[index % colors.length];

  return L.divIcon({
    html: `<div class="flex items-center justify-center w-9 h-9 ${colorClass} rounded-full shadow-lg border-3 border-white dark:border-gray-800 text-white font-bold text-xs">${index + 1}</div>`,
    iconSize: [36, 36],
    className: 'custom-marker',
  });
};

// Componente para ajustar zoom
function MapAdjuster({ points }) {
  const map = useMap();

  useEffect(() => {
    if (points && points.length > 0) {
      const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [80, 80] });
    }
  }, [points, map]);

  return null;
}

export default function MapView({ stops }) {
  const [selectedStopIndex, setSelectedStopIndex] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Detectar dark mode
    const isDark = document.documentElement.classList.contains('dark') || 
                   window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(isDark);

    // Listener para mudanças
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setIsDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  if (!stops || stops.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800">
        <MapPin className="w-12 h-12 text-gray-400 mb-3" />
        <p className="text-gray-500 dark:text-gray-400 font-medium">Sem pontos no mapa</p>
      </div>
    );
  }

  const polylinePositions = stops.map(stop => [stop.lat, stop.lng]);
  const center = [stops[0].lat, stops[0].lng];
  const tileLayerUrl = isDarkMode 
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  const polylineColor = isDarkMode ? '#8B5CF6' : '#7C3AED';

  return (
    <div className="h-full w-full relative z-0">
      <MapContainer 
        center={center} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        className="map-container"
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
          url={tileLayerUrl}
          maxZoom={19}
        />
        
        {/* Polyline com dash pattern elegante */}
        <Polyline 
          positions={polylinePositions} 
          pathOptions={{ 
            color: polylineColor, 
            weight: 3, 
            opacity: 0.8,
            dashArray: '5, 5',
            lineCap: 'round',
            lineJoin: 'round'
          }} 
        />

        {/* Markers customizados */}
        {stops.map((stop, idx) => (
          <Marker 
            key={idx} 
            position={[stop.lat, stop.lng]}
            icon={createCustomIcon(idx, stops.length)}
            eventHandlers={{
              click: () => setSelectedStopIndex(idx),
            }}
          >
            <Popup className="custom-popup">
              <div className="min-w-max p-2">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200">
                  <Package className="w-4 h-4 text-primary-600" />
                  <strong className="text-gray-900">Parada {stop.id}</strong>
                </div>
                <p className="text-sm text-gray-700 font-medium mb-1">{stop.address}</p>
                <div className="mt-3 pt-2 border-t border-gray-200">
                  <span className="inline-block bg-primary-100 text-primary-800 text-xs px-2.5 py-1 rounded-full font-semibold">
                    {stop.packages.length} pacote{stop.packages.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        <MapAdjuster points={stops} />
      </MapContainer>

      {/* Bottom Sheet Info */}
      {selectedStopIndex !== null && (
        <BottomSheetStopInfo 
          stop={stops[selectedStopIndex]} 
          index={selectedStopIndex}
          total={stops.length}
          onClose={() => setSelectedStopIndex(null)}
        />
      )}
    </div>
  );
}

function BottomSheetStopInfo({ stop, index, total, onClose }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-40 animate-slide-up"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />

      {/* Bottom Sheet */}
      <div className={`relative bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl transition-all duration-300 ${isExpanded ? 'h-2/3' : 'h-fit max-h-96'} border-t-2 border-primary-600`}>
        
        {/* Handle Bar - Melhorado */}
        <div className="flex justify-center pt-4 pb-3 bg-gradient-to-b from-transparent to-gray-50 dark:to-gray-800/50">
          <div className="w-14 h-1.5 bg-gradient-to-r from-gray-300 via-gray-400 to-gray-300 dark:from-gray-600 dark:via-gray-500 dark:to-gray-600 rounded-full shadow-md" />
        </div>

        {/* Header */}
        <div className="px-5 pb-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-primary-500/30">
                {index + 1}
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wide">Parada {index + 1} de {total}</p>
                <h3 className="font-black text-lg text-gray-900 dark:text-white">{stop.id}</h3>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-all active:scale-90"
            >
              <span className="text-lg text-gray-600 dark:text-gray-300">✕</span>
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className={`overflow-y-auto px-5 py-4 ${isExpanded ? 'max-h-[calc(2/3vh-120px)]' : 'max-h-64'}`}>
          
          {/* Address Section */}
          <div className="mb-5 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/10 rounded-2xl border border-blue-200 dark:border-blue-800/30">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wide mb-1">Endereço</p>
                <p className="font-bold text-base text-gray-900 dark:text-white">{stop.address}</p>
              </div>
            </div>
          </div>

          {/* Packages Section */}
          <div className="mb-4 p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/10 rounded-2xl border border-green-200 dark:border-green-800/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-green-600 dark:text-green-400" />
                <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wide">Pacotes</p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-600 text-white text-xs font-bold shadow-lg shadow-green-500/30">
                <Package className="w-3.5 h-3.5" />
                {stop.packages.length}
              </span>
            </div>
            {stop.packages && stop.packages.length > 0 && (
              <div className="space-y-2 text-sm">
                {stop.packages.slice(0, 4).map((pkg, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white/50 dark:bg-gray-800/50 p-2 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-green-600" />
                    <span className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate">{pkg}</span>
                  </div>
                ))}
                {stop.packages.length > 4 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic pl-2">+{stop.packages.length - 4} mais pacotes</p>
                )}
              </div>
            )}
          </div>

          {/* Status Badge */}
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800/30 flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">Aguardando confirmação</p>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
            <button className="btn-primary w-full flex items-center justify-center gap-2 active:scale-95">
              <Navigation className="w-5 h-5" />
              <span>Navegar Até Aqui</span>
            </button>
            <button className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold hover:shadow-lg hover:shadow-green-500/30 transition-all active:scale-95 shadow-lg shadow-green-500/20 flex items-center justify-center gap-2">
              <Check className="w-5 h-5" />
              <span>Confirmar Entrega</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
