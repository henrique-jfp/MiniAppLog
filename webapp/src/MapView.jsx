import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, SVGOverlay } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapPin, Package, Navigation } from 'lucide-react';

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
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Bottom Sheet */}
      <div className={`relative bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl transition-all duration-300 ${isExpanded ? 'h-2/3' : 'h-fit max-h-96'}`}>
        
        {/* Handle Bar */}
        <div className="flex justify-center pt-3 pb-4">
          <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pb-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-sm">
                {index + 1}
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Parada {index + 1} de {total}</p>
                <h3 className="font-black text-gray-900 dark:text-white">{stop.id}</h3>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className={`overflow-y-auto px-5 py-4 ${isExpanded ? 'max-h-[calc(2/3vh-120px)]' : 'max-h-64'}`}>
          
          {/* Address Section */}
          <div className="mb-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mb-2">ENDEREÇO</p>
            <p className="font-bold text-lg text-gray-900 dark:text-white mb-1">{stop.address}</p>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <MapPin className="w-4 h-4 text-accent-500" />
              <span>Clique para copiar coordenadas</span>
            </div>
          </div>

          {/* Packages Section */}
          <div className="mb-4 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-200 dark:border-primary-800">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-primary-700 dark:text-primary-400">PACOTES</p>
              <span className="badge badge-info text-xs">{stop.packages.length}</span>
            </div>
            {stop.packages && stop.packages.length > 0 && (
              <div className="space-y-2 text-sm">
                {stop.packages.slice(0, 3).map((pkg, i) => (
                  <div key={i} className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Package className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                    <span className="font-mono text-xs truncate">{pkg}</span>
                  </div>
                ))}
                {stop.packages.length > 3 && (
                  <p className="text-xs text-gray-500 italic">+{stop.packages.length - 3} mais</p>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
            <button className="btn-primary w-full flex items-center justify-center gap-2">
              <Navigation className="w-5 h-5" />
              Navegar Até Aqui
            </button>
            <button className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95">
              Confirmar Entrega
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
