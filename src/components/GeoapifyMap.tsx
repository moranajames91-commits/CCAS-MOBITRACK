import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface GeoapifyMapProps {
  latitude: number | null;
  longitude: number | null;
  apiKey: string;
  location: string;
  postalCode: string;
  onLocationSelect?: (lat: number, lon: number) => void;
}

export const GeoapifyMap: React.FC<GeoapifyMapProps> = ({
  latitude,
  longitude,
  apiKey,
  location,
  postalCode,
  onLocationSelect,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    if (!mapContainer.current || !apiKey) return;

    // Initialize map only once
    if (!mapInstance.current) {
      // Set default view to world
      mapInstance.current = L.map(mapContainer.current, {
        center: [20, 0],
        zoom: 2,
        dragging: true,
        scrollWheelZoom: true,
        touchZoom: true,
        zoomControl: true,
      });

      // Try Geoapify tiles first
      const geoapifyUrl = `https://maps.geoapify.com/v1/tiles/osmbright/{z}/{x}/{y}.png?apiKey=${apiKey}`;
      
      // Add Geoapify tile layer with proper error handling
      const tileLayer = L.tileLayer(geoapifyUrl, {
        attribution: '© Geoapify | © OpenStreetMap contributors',
        maxZoom: 20,
        minZoom: 1,
        opacity: 1,
        crossOrigin: 'anonymous',
      });
      
      tileLayer.addTo(mapInstance.current);
      tileLayerRef.current = tileLayer;

      // Fallback to OpenStreetMap if Geoapify fails
      tileLayer.on('tileerror', () => {
        mapInstance.current?.removeLayer(tileLayer);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(mapInstance.current!);
      });

      // Add click handler
      mapInstance.current.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        updateMarker(lat, lng);
        onLocationSelect?.(lat, lng);
      });
    }

    // Update map center and marker when coordinates are available
    if (latitude !== null && longitude !== null && mapInstance.current) {
      mapInstance.current.setView([latitude, longitude], 15);
      updateMarker(latitude, longitude);
    }
  }, [apiKey, latitude, longitude, onLocationSelect]);

  const updateMarker = (lat: number, lon: number) => {
    if (!mapInstance.current) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon]);
    } else {
      markerRef.current = L.marker([lat, lon], {
        icon: L.icon({
          iconUrl:
            'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
          shadowUrl:
            'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        }),
      }).addTo(mapInstance.current);

      markerRef.current.bindPopup(`<strong>${location}</strong><br/>${postalCode}`).openPopup();
    }
  };

  return (
    <div className="w-full space-y-2">
      <div
        ref={mapContainer}
        className="w-full rounded border border-slate-300 bg-slate-100"
        style={{ height: '350px', minHeight: '300px' }}
      />
      <div className="text-[9px] text-slate-500 bg-blue-50 p-2 rounded border border-blue-100">
        💡 <strong>Map Controls:</strong> Drag to pan • Scroll to zoom • Click to pin location
      </div>
    </div>
  );
};
