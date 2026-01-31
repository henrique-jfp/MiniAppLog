import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Componente para ajustar zoom
function MapAdjuster({ points }) {
  const map = useMap();

  useEffect(() => {
    if (points && points.length > 0) {
      const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [points, map]);

  return null;
}

export default function MapView({ stops }) {
  if (!stops || stops.length === 0) {
    return <div className="p-4 text-center text-gray-500">Sem pontos no mapa.</div>;
  }

  const polylinePositions = stops.map(stop => [stop.lat, stop.lng]);
  const center = [stops[0].lat, stops[0].lng];

  return (
    <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700 relative z-0">
       <MapContainer 
        center={center} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <Polyline 
            positions={polylinePositions} 
            pathOptions={{ color: 'blue', weight: 4, opacity: 0.7 }} 
        />

        {stops.map((stop, idx) => (
          <Marker key={idx} position={[stop.lat, stop.lng]}>
            <Popup>
              <div className="text-sm">
                <strong className="block text-base mb-1">Parada {stop.id}</strong>
                <span className="block text-gray-600 dark:text-gray-300">{stop.address}</span>
                <div className="mt-2 text-xs bg-blue-100 text-blue-800 p-1 rounded inline-block">
                  {stop.packages.length} pacotes
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        <MapAdjuster points={stops} />
      </MapContainer>
    </div>
  );
}
