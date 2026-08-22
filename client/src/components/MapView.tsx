import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { Navigation, Loader2 } from 'lucide-react';
import { CityName, Venue, Booking } from '../types';
import { CITIES_CONFIG } from '../data/venuesData';
import { formatDateDDMMYYYY } from '../utils/date';

interface MapViewProps {
  currentCity: CityName;
  venues: Venue[];
  selectedVenue: Venue | null;
  onSelectVenue: (venue: Venue) => void;
  activeBooking?: Booking | null;
  upcomingBooking?: Booking | null;
  onOpenVenue: (booking: Booking) => void;
  userCoords?: { lat: number; lng: number } | null;
  onUpdateUserCoords?: (coords: { lat: number; lng: number }) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  currentCity,
  venues,
  selectedVenue,
  onSelectVenue,
  activeBooking,
  upcomingBooking,
  onOpenVenue,
  userCoords,
  onUpdateUserCoords,
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const userMarkerRef = useRef<L.Marker | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // References to prevent unnecessary pan/jump on re-renders
  const lastCityRef = useRef<CityName | null>(null);
  const isUserDraggingRef = useRef<boolean>(false);

  // Invalidate size helper
  const triggerInvalidateSize = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.invalidateSize();
    }
  }, []);

  // Auto-locate on first map mount if permission is granted
  useEffect(() => {
    if ('geolocation' in navigator && !userCoords) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (onUpdateUserCoords) {
            onUpdateUserCoords(coords);
          }
        },
        (err) => {
          console.warn('[Geolocation Auto] Permission denied or position unavailable:', err.message);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  const handleLocateUser = () => {
    if (!('geolocation' in navigator)) {
      alert('Геолокация не поддерживается вашим браузером');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (onUpdateUserCoords) {
          onUpdateUserCoords(coords);
        }
        if (mapRef.current) {
          mapRef.current.flyTo([coords.lat, coords.lng], 16, {
            animate: true,
            duration: 1.2,
          });
        }
      },
      (err) => {
        setIsLocating(false);
        console.warn('[Geolocation] Error:', err);
        if (userCoords && mapRef.current) {
          mapRef.current.flyTo([userCoords.lat, userCoords.lng], 16, { animate: true });
        } else {
          alert('Не удалось определить местоположение. Пожалуйста, разрешите доступ к геопозиции в настройках браузера.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Map Initialization & City Switch Handler (Strictly only re-centers on real city change or 1st load)
  useEffect(() => {
    if (!containerRef.current) return;
    const cityConfig = CITIES_CONFIG[currentCity] || CITIES_CONFIG['Темиртау'];

    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        center: [cityConfig.lat, cityConfig.lng],
        zoom: cityConfig.zoom,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      // Track drag events to prevent any automatic viewport snaps while user is interacting
      map.on('dragstart', () => {
        isUserDraggingRef.current = true;
      });
      map.on('dragend', () => {
        isUserDraggingRef.current = false;
      });

      mapRef.current = map;
      lastCityRef.current = currentCity;

      // Invalidate sizes after layout mounting
      requestAnimationFrame(triggerInvalidateSize);
      const timer1 = setTimeout(triggerInvalidateSize, 100);
      const timer2 = setTimeout(triggerInvalidateSize, 300);
      const timer3 = setTimeout(triggerInvalidateSize, 600);

      // ResizeObserver to automatically resize map tiles whenever viewport dimensions change
      let resizeObserver: ResizeObserver | null = null;
      if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          triggerInvalidateSize();
        });
        resizeObserver.observe(containerRef.current);
      }

      window.addEventListener('resize', triggerInvalidateSize);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        window.removeEventListener('resize', triggerInvalidateSize);
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
      };
    } else {
      // ONLY change center if user selected a DIFFERENT city from the dropdown
      if (lastCityRef.current !== currentCity && !isUserDraggingRef.current) {
        mapRef.current.setView([cityConfig.lat, cityConfig.lng], cityConfig.zoom, { animate: true });
        lastCityRef.current = currentCity;
      }
    }
  }, [currentCity, triggerInvalidateSize]);

  // Periodic size invalidation when tab becomes active
  useEffect(() => {
    const t = setTimeout(triggerInvalidateSize, 150);
    return () => clearTimeout(t);
  }, [triggerInvalidateSize]);

  // Update venue markers on map (Football ⚽ and Basketball 🏀 balls)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    venues.forEach((venue, index) => {
      const isSelected = selectedVenue?.id === venue.id;
      const ballEmoji = venue.sport === 'football' ? '⚽' : '🏀';
      const pinSize = isSelected ? 40 : 34;
      const fontSize = isSelected ? 22 : 18;

      // Slight offset for venues at the same school/location so both ⚽ and 🏀 are visible side-by-side
      const sameCoordsIndex = venues.filter(
        (v, i) => i < index && Math.abs(v.lat - venue.lat) < 0.00001 && Math.abs(v.lng - venue.lng) < 0.00001
      ).length;
      const effectiveLat = venue.lat + (sameCoordsIndex > 0 ? sameCoordsIndex * 0.00008 : 0);
      const effectiveLng = venue.lng + (sameCoordsIndex > 0 ? sameCoordsIndex * 0.00014 : 0);

      const pinHtml = `
        <div class="custom-map-pin ${isSelected ? 'active' : ''}" style="
          width: ${pinSize}px;
          height: ${pinSize}px;
          background: #FFFFFF;
          border: ${isSelected ? '3px solid #00B050' : '2.5px solid #FFFFFF'};
          border-radius: 50%;
          box-shadow: ${isSelected ? '0 6px 18px rgba(0, 176, 80, 0.45)' : '0 4px 14px rgba(0, 0, 0, 0.22)'};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${fontSize}px;
          line-height: 1;
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          transform: ${isSelected ? 'scale(1.18)' : 'scale(1)'};
          user-select: none;
        ">${ballEmoji}</div>
      `;

      const customIcon = L.divIcon({
        html: pinHtml,
        className: 'custom-ball-leaflet-icon',
        iconSize: [pinSize, pinSize],
        iconAnchor: [pinSize / 2, pinSize / 2],
      });

      const marker = L.marker([effectiveLat, effectiveLng], { icon: customIcon }).addTo(map);

      marker.on('click', () => {
        onSelectVenue(venue);
      });

      markersRef.current[venue.id] = marker;
    });
  }, [venues, selectedVenue, onSelectVenue]);

  // Update user current GPS pin on map
  useEffect(() => {
    if (!mapRef.current) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (userCoords && userCoords.lat && userCoords.lng) {
      const userPinHtml = `
        <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
          <div class="user-pulse-ring" style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background: rgba(37, 99, 235, 0.35);"></div>
          <div style="position: relative; width: 16px; height: 16px; border-radius: 50%; background: #2563EB; border: 3px solid #FFFFFF; box-shadow: 0 2px 10px rgba(37, 99, 235, 0.6);"></div>
        </div>
      `;

      const userIcon = L.divIcon({
        html: userPinHtml,
        className: 'user-location-leaflet-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([userCoords.lat, userCoords.lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(mapRef.current);
      marker.bindTooltip('Вы здесь', { permanent: true, direction: 'top', offset: [0, -10], className: 'custom-user-tooltip' });
      userMarkerRef.current = marker;
    }
  }, [userCoords]);

  return (
    <div
      className="absolute inset-0 w-full h-full overflow-hidden"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', zIndex: 1 }}
    >
      {/* Map Canvas taking 100% full height and width */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', zIndex: 1 }}
      />

      {/* Floating GPS Location Button (top right corner) */}
      <button
        type="button"
        onClick={handleLocateUser}
        disabled={isLocating}
        className="absolute top-4 right-4 z-20 w-11 h-11 bg-white hover:bg-slate-50 border border-slate-200/60 rounded-2xl shadow-md flex items-center justify-center text-slate-800 transition-all active:scale-95 pointer-events-auto cursor-pointer"
        title="Моё местоположение"
      >
        {isLocating ? (
          <Loader2 className="w-5 h-5 animate-spin text-slate-800" />
        ) : (
          <Navigation className="w-5 h-5 fill-slate-700/20 text-slate-800" />
        )}
      </button>

      {/* Floating Active Booking Card - Rendered above bottom filter bar (bottom-[84px]) */}
      {activeBooking && (
        <div className="absolute bottom-[84px] left-4 right-4 z-20 pointer-events-auto">
          <div
            onClick={() => onOpenVenue(activeBooking)}
            className="bg-white rounded-2xl p-4 shadow-xl border border-[#00B050]/60 ring-2 ring-[#00B050]/20 flex items-center justify-between cursor-pointer hover:border-slate-300 active:scale-[0.99] transition-all animate-fade-in"
          >
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-[#00B050] flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00B050] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00B050]"></span>
                  </span>
                  <span>Активная бронь</span>
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight flex items-center gap-1.5 truncate">
                <span className="truncate">{activeBooking.venueTitle}</span>
                <span className="shrink-0">{activeBooking.sport === 'football' ? '⚽' : '🏀'}</span>
              </h3>
              <p className="text-xs text-slate-400 font-medium truncate">
                {formatDateDDMMYYYY(activeBooking.date)}, {activeBooking.timeSlot}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Floating Upcoming/Waiting Booking Card - Renders when user has a future booking for today */}
      {!activeBooking && upcomingBooking && (
        <div className="absolute bottom-[84px] left-4 right-4 z-20 pointer-events-auto">
          <div
            onClick={() => onOpenVenue(upcomingBooking)}
            className="bg-white rounded-2xl p-4 shadow-lg border border-slate-200/80 hover:border-slate-300 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all animate-fade-in"
          >
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200/60 inline-flex items-center gap-1">
                  <span>⏳ Предстоящая бронь</span>
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight flex items-center gap-1.5 truncate">
                <span className="truncate">{upcomingBooking.venueTitle}</span>
                <span className="shrink-0">{upcomingBooking.sport === 'football' ? '⚽' : '🏀'}</span>
              </h3>
              <p className="text-xs text-slate-400 font-medium truncate">
                {formatDateDDMMYYYY(upcomingBooking.date)}, {upcomingBooking.timeSlot}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
