import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface DensityPoint {
  label: string;
  latitude: number;
  longitude: number;
  orders: number;
  revenue: number;
  type: 'sales' | 'service';
}

interface CustomerDensityMapProps {
  points: DensityPoint[];
  selectedPoint?: DensityPoint | null;
}

export const CustomerDensityMap: React.FC<CustomerDensityMapProps> = ({ points, selectedPoint }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markerRefs = useRef(new Map<string, L.CircleMarker>());

  useEffect(() => {
    if (!containerRef.current || mapRef.current || points.length === 0) return;

    const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [points.length]);

  useEffect(() => {
    if (!mapRef.current || !layerRef.current || points.length === 0) return;
    layerRef.current.clearLayers();
    markerRefs.current.clear();
    const bounds = L.latLngBounds([]);
    points.forEach(point => {
      const isService = point.type === 'service';
      const radius = Math.max(8, Math.min(24, 8 + point.orders * 2));
      const marker = L.circleMarker([point.latitude, point.longitude], {
        radius,
        color: isService ? '#b42318' : '#1d4ed8',
        weight: 2,
        fillColor: isService ? '#f04438' : '#3b82f6',
        fillOpacity: 0.78
      }).bindPopup(`<strong>${point.label}</strong><br/>${isService ? 'Repair service' : 'POS sales'}<br/>${point.orders} ${isService ? 'tickets' : 'orders'}<br/>PHP ${point.revenue.toFixed(2)}`).addTo(layerRef.current!);
      markerRefs.current.set(`${point.type}:${point.label}`, marker);
      bounds.extend([point.latitude, point.longitude]);
    });
    mapRef.current.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
  }, [points]);

  useEffect(() => {
    if (!mapRef.current || !selectedPoint) return;
    const marker = markerRefs.current.get(`${selectedPoint.type}:${selectedPoint.label}`);
    if (!marker) return;
    mapRef.current.setView([selectedPoint.latitude, selectedPoint.longitude], 16, { animate: true });
    marker.openPopup();
  }, [selectedPoint]);

  return <div ref={containerRef} className="h-[18rem] w-full rounded-lg border border-[#a8c8b3] overflow-hidden" aria-label="Customer sales and repair service density map" />;
};
