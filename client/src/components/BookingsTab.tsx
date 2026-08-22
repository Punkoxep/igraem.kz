import React, { useState, useMemo } from 'react';
import { ChevronRight, RotateCcw, Calendar, Clock } from 'lucide-react';
import { Booking } from '../types';
import { formatDateDDMMYYYY } from '../utils/date';

interface BookingsTabProps {
  bookings: Booking[];
  onOpenVenue: (booking: Booking) => void;
  onSelectVenueForBooking?: (venueId: string) => void;
  onRefreshBookings?: () => void;
}

/**
 * Checks if a booking's end time is in the future.
 */
export const isBookingUpcoming = (b: Booking): boolean => {
  if (b.status === 'completed') return false;

  const now = new Date();
  const times = b.timeSlot ? b.timeSlot.split('–').map((t) => t.trim()) : [];
  const endTimeStr = times[1] || times[0] || '23:59';
  const [endHour, endMin] = endTimeStr.split(':').map(Number);

  // Parse booking date
  let bookingDate = new Date();
  if (b.date && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) {
    const [y, m, d] = b.date.split('-').map(Number);
    bookingDate = new Date(y, m - 1, d);
  } else if (b.date && /^\d{2}\.\d{2}\.\d{4}$/.test(b.date)) {
    const [d, m, y] = b.date.split('.').map(Number);
    bookingDate = new Date(y, m - 1, d);
  }

  bookingDate.setHours(endHour || 0, endMin || 0, 0, 0);

  // If status is active or end time has not passed yet
  return (b.status === 'active' || b.status === 'upcoming') && bookingDate.getTime() > now.getTime();
};

export const BookingsTab: React.FC<BookingsTabProps> = ({
  bookings = [],
  onOpenVenue,
  onSelectVenueForBooking,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'upcoming' | 'past'>('upcoming');

  // Split bookings into upcoming vs past (sort active booking to top)
  const upcomingBookings = useMemo(() => {
    const list = bookings.filter((b) => isBookingUpcoming(b));
    return [...list].sort((a, b) => {
      const aActive = a.isOpened || a.status === 'active' ? 1 : 0;
      const bActive = b.isOpened || b.status === 'active' ? 1 : 0;
      return bActive - aActive; // Active booking ALWAYS at top
    });
  }, [bookings]);

  const pastBookings = useMemo(() => {
    return bookings.filter((b) => !isBookingUpcoming(b));
  }, [bookings]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 text-slate-900 w-full animate-fade-in">
      {/* White Panel Header with Segmented Control (Предстоящие & Прошедшие) */}
      <div className="shrink-0 bg-white px-4 pt-3 pb-3 border-b border-slate-200/80 sticky top-0 z-10 w-full">
        <div className="relative bg-[#F8FAFC] border border-slate-200/80 p-1 rounded-2xl flex items-center h-11">
          {/* Animated Sliding Pill Indicator */}
          <div
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-xs border border-slate-200/60 transition-all duration-300 ease-out ${
              activeSubTab === 'upcoming' ? 'left-1' : 'left-[calc(50%+2px)]'
            }`}
          />

          <button
            type="button"
            onClick={() => setActiveSubTab('upcoming')}
            className={`relative z-10 flex-1 h-9 px-2 text-xs text-center flex items-center justify-center transition-colors duration-200 cursor-pointer ${
              activeSubTab === 'upcoming'
                ? 'text-[#00B050] font-semibold'
                : 'text-slate-500 font-semibold hover:text-slate-900'
            }`}
          >
            <span>Предстоящие</span>
            {upcomingBookings.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-[#00B050] text-white text-[10px] font-bold">
                {upcomingBookings.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('past')}
            className={`relative z-10 flex-1 h-9 px-2 text-xs text-center flex items-center justify-center transition-colors duration-200 cursor-pointer ${
              activeSubTab === 'past'
                ? 'text-[#00B050] font-semibold'
                : 'text-slate-500 font-semibold hover:text-slate-900'
            }`}
          >
            <span>Прошедшие</span>
            {pastBookings.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                {pastBookings.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 pb-24">
        {/* Sub-Tab 1: Предстоящие */}
        {activeSubTab === 'upcoming' && (
          <div className="space-y-3.5">
            {upcomingBookings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center space-y-2.5 shadow-xs w-full animate-fade-in my-2">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto stroke-1.5" />
                <p className="text-slate-800 font-bold text-sm">У вас пока нет предстоящих бронирований</p>
                <p className="text-slate-500 text-xs max-w-xs mx-auto leading-relaxed">
                  Выберите спортивную площадку на карте и забронируйте удобное время для игры
                </p>
              </div>
            ) : (
              upcomingBookings.map((b) => {
                const isActive = b.isOpened || b.status === 'active';
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onOpenVenue(b)}
                    className={`w-full text-left bg-white hover:bg-slate-50/80 border rounded-2xl p-4 shadow-xs space-y-3 transition-all cursor-pointer group active:scale-98 block ${
                      isActive ? 'border-[#00B050]/60 ring-2 ring-[#00B050]/15' : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-900 text-[10px] font-normal border border-slate-200/60">
                          {b.sport === 'football' ? '⚽ Футбол' : '🏀 Баскетбол'}
                        </span>
                        {b.isParticipant ? (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold border border-amber-200/60">
                            👥 Совместная игра
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200/60">
                            👑 Организатор
                          </span>
                        )}
                        {isActive && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E8F8F0] text-[#00B050] text-[10px] font-bold border border-[#00B050]/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00B050] animate-pulse" />
                            <span>Активная бронь</span>
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 leading-snug group-hover:text-[#00B050] transition-colors">
                        {b.venueTitle}
                      </h3>
                      <p className="text-xs text-slate-400 font-medium">{b.address}</p>
                      <p className="text-xs text-slate-500 font-medium">
                        {formatDateDDMMYYYY(b.date)}, {b.timeSlot}
                      </p>
                    </div>

                    <div className="flex justify-end pt-1">
                      <div className="text-[#00B050] group-hover:text-[#009644] font-bold text-xs flex items-center gap-0.5 transition-colors">
                        <span>Перейти к брони</span>
                        <ChevronRight className="w-4 h-4 stroke-[2.5px] group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Sub-Tab 2: Прошедшие */}
        {activeSubTab === 'past' && (
          <div className="space-y-3.5">
            {pastBookings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center space-y-2.5 shadow-xs w-full animate-fade-in my-2">
                <Clock className="w-10 h-10 text-slate-300 mx-auto stroke-1.5" />
                <p className="text-slate-800 font-bold text-sm">У вас пока нет прошедших бронирований</p>
                <p className="text-slate-500 text-xs max-w-xs mx-auto leading-relaxed">
                  Здесь будут сохраняться все ваши завершенные игры с возможностью быстрого повторного бронирования
                </p>
              </div>
            ) : (
              pastBookings.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onSelectVenueForBooking && onSelectVenueForBooking(b.venueId)}
                  className="w-full text-left bg-white hover:bg-slate-50/80 border border-slate-200/80 hover:border-slate-300 rounded-2xl p-4 shadow-xs space-y-3 transition-all cursor-pointer group active:scale-98 block"
                >
                  <div className="space-y-1">
                    <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-900 text-[10px] font-normal border border-slate-200/60">
                      {b.sport === 'football' ? '⚽ Футбол' : '🏀 Баскетбол'}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 leading-snug group-hover:text-[#00B050] transition-colors">
                      {b.venueTitle}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">{b.address}</p>
                    <p className="text-xs text-slate-500 font-medium">
                      {formatDateDDMMYYYY(b.date)}, {b.timeSlot}
                    </p>
                  </div>

                  <div className="flex justify-end pt-1">
                    <div className="text-[#00B050] group-hover:text-[#009644] font-bold text-xs flex items-center gap-1.5 transition-colors">
                      <RotateCcw className="w-3.5 h-3.5 stroke-[2.5px]" />
                      <span>Забронировать снова</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
