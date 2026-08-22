import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Heart, Check, Star, AlertCircle } from 'lucide-react';
import { Venue, TimeSlot, Booking } from '../types';
import { calculateDistanceMeters, formatDistance } from '../utils/geo';
import { api } from '../services/api';

interface VenueCardModalProps {
  venue: Venue | null;
  userCoords?: { lat: number; lng: number } | null;
  userBookings?: Booking[];
  onClose: () => void;
  onBook: (venue: Venue, date: string, slot: TimeSlot) => void;
  isFavorite: boolean;
  onToggleFavorite: (venueId: string) => void;
}

const getUpcomingDays = () => {
  const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const days = [];
  const today = new Date();

  for (let i = 0; i < 6; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dayStr = String(d.getDate()).padStart(2, '0');
    const monthStr = String(d.getMonth() + 1).padStart(2, '0');
    const yearStr = d.getFullYear();
    const formattedDDMMYYYY = `${dayStr}.${monthStr}.${yearStr}`;
    const isoYYYYMMDD = `${yearStr}-${monthStr}-${dayStr}`;

    days.push({
      day: dayNames[d.getDay()],
      num: String(d.getDate()),
      fullDateStr: formattedDDMMYYYY,
      isoDateStr: isoYYYYMMDD,
      label: `${dayNames[d.getDay()]}, ${formattedDDMMYYYY}`,
    });
  }
  return days;
};

const TIME_SLOTS_GRID = [
  { time: '08:00 – 09:00', status: 'available' },
  { time: '09:00 – 10:00', status: 'available' },
  { time: '10:00 – 11:00', status: 'available' },
  { time: '11:00 – 12:00', status: 'available' },
  { time: '12:00 – 13:00', status: 'available' },
  { time: '13:00 – 14:00', status: 'available' },
  { time: '14:00 – 15:00', status: 'available' },
  { time: '15:00 – 16:00', status: 'available' },
  { time: '16:00 – 17:00', status: 'available' },
  { time: '17:00 – 18:00', status: 'available' },
  { time: '18:00 – 19:00', status: 'available' },
  { time: '19:00 – 20:00', status: 'available' },
  { time: '20:00 – 21:00', status: 'available' },
  { time: '21:00 – 22:00', status: 'available' },
  { time: '22:00 – 23:00', status: 'available' },
];

const getSlotIndex = (timeStr: string) => TIME_SLOTS_GRID.findIndex((s) => s.time === timeStr);

export const VenueCardModal: React.FC<VenueCardModalProps> = ({
  venue,
  userCoords,
  userBookings = [],
  onClose,
  onBook,
  isFavorite,
  onToggleFavorite,
}) => {
  if (!venue) return null;

  // Calculate real GPS distance in meters/km if user geolocation is enabled
  const distanceText = useMemo(() => {
    if (!userCoords || !venue || !userCoords.lat || !userCoords.lng) return null;
    const meters = calculateDistanceMeters(userCoords.lat, userCoords.lng, venue.lat, venue.lng);
    return formatDistance(meters);
  }, [userCoords, venue]);

  const upcomingDays = useMemo(() => getUpcomingDays(), []);
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  const [selectedSlotTimes, setSelectedSlotTimes] = useState<string[]>([]);
  const [groundBookings, setGroundBookings] = useState<any[]>([]);
  const [isJoinSuccessModalOpen, setIsJoinSuccessModalOpen] = useState(false);
  const [slotWarningMsg, setSlotWarningMsg] = useState<string | null>(null);
  const touchStartY = useRef<number | null>(null);

  const activeDay = upcomingDays[selectedDateIdx] || upcomingDays[0];

  // Fetch real active bookings from backend for selected ground and date
  useEffect(() => {
    if (venue && venue.id) {
      api
        .getGroundBookings(venue.id, activeDay.isoDateStr)
        .then((res) => {
          if (res && res.success && Array.isArray(res.data)) {
            setGroundBookings(res.data);
          } else {
            setGroundBookings([]);
          }
        })
        .catch((err) => {
          console.warn('[VenueCardModal] Error loading ground bookings:', err);
          setGroundBookings([]);
        });
    }
  }, [venue, activeDay.isoDateStr]);

  // Reset selected slots on date change
  useEffect(() => {
    setSelectedSlotTimes([]);
    setSlotWarningMsg(null);
  }, [selectedDateIdx]);

  // Daily Limit calculation: sum existing hours user has booked for this specific calendar date
  const userBookedHoursToday = useMemo(() => {
    if (!userBookings || userBookings.length === 0) return 0;
    return userBookings
      .filter((b) => {
        const isTargetDate = b.date === activeDay.fullDateStr || b.date === activeDay.isoDateStr;
        if (!isTargetDate) return false;
        const s = (b.status || '').toUpperCase();
        return s === 'ACTIVE' || s === 'CONFIRMED' || s === 'UPCOMING';
      })
      .reduce((sum, b) => {
        const times = b.timeSlot.split('–').map((t) => t.trim());
        const startH = parseInt(times[0]?.split(':')[0] || '0', 10);
        const endH = parseInt(times[1]?.split(':')[0] || '0', 10);
        const diff = endH - startH;
        return sum + (diff > 0 ? diff : 1);
      }, 0);
  }, [userBookings, activeDay.fullDateStr, activeDay.isoDateStr]);

  const maxAllowedHoursToday = Math.max(0, 3 - userBookedHoursToday);

  // Helper to determine one of 4 slot states: 'past' | 'my_booking' | 'occupied' | 'available'
  const getSlotInfo = (slotTime: string, dateIdx: number = selectedDateIdx) => {
    const times = slotTime.split('–').map((t) => t.trim());
    const slotStart = times[0] || '08:00';
    const slotEnd = times[1] || '09:00';

    const targetDay = upcomingDays[dateIdx] || upcomingDays[0];
    const targetIsoDate = targetDay.isoDateStr;
    const targetFullDate = targetDay.fullDateStr;

    // State 4: Прошедшее время (только для сегодняшней даты, если currentTime >= slotEnd)
    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMins = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMins}`;
    const isPast = dateIdx === 0 && currentTimeStr >= slotEnd;
    if (isPast) {
      return { state: 'past' as const, label: slotTime };
    }

    const overlaps = (sA: string, eA: string, sB: string, eB: string) => {
      if (!sA || !eA || !sB || !eB) return false;
      return sA < eB && eA > sB;
    };

    // Find matching booking from backend ground bookings
    const apiBooking = groundBookings.find(
      (b) =>
        (b.status === 'confirmed' || b.status === 'active' || b.status === 'upcoming' || b.isOccupied || b.is_occupied) &&
        overlaps(slotStart, slotEnd, b.startTime || b.start_time, b.endTime || b.end_time)
    );

    // Find matching booking in current user local state
    const myLocalBooking = userBookings.find(
      (b) =>
        (b.venueId === venue.id || b.venueTitle === venue.title) &&
        (b.date === targetFullDate || b.date === targetIsoDate) &&
        b.status !== 'completed' &&
        overlaps(slotStart, slotEnd, b.timeSlot?.split('–')[0]?.trim(), b.timeSlot?.split('–')[1]?.trim())
    );

    const isHost =
      (apiBooking && (apiBooking.isHost || apiBooking.is_host || (apiBooking.isMyBooking && !apiBooking.isParticipant))) ||
      (myLocalBooking && (myLocalBooking.isHost || !myLocalBooking.isParticipant));

    const isParticipant =
      (apiBooking && (apiBooking.isParticipant || apiBooking.is_participant)) ||
      (myLocalBooking && myLocalBooking.isParticipant);

    // State 1: «Ваша бронь» (создатель бронирования)
    if (isHost) {
      return {
        state: 'my_booking' as const,
        label: `${slotTime} (Ваша бронь)`,
        badge: 'Ваша бронь',
        booking: apiBooking || myLocalBooking,
      };
    }

    // State 1.2: «Вы участвуете» (одобренный участник совместной игры)
    if (isParticipant) {
      return {
        state: 'my_booking' as const,
        label: `${slotTime} (Вы участвуете)`,
        badge: 'Вы участвуете',
        booking: apiBooking || myLocalBooking,
      };
    }

    // State 2: «Занято другим пользователем»
    const isVenueOcc = venue.occupiedSlots?.some((occ) => {
      const occDate = occ.booking_date;
      if (occDate !== targetFullDate && occDate !== targetIsoDate) return false;
      return overlaps(slotStart, slotEnd, occ.start_time, occ.end_time);
    });

    if (apiBooking || isVenueOcc) {
      return {
        state: 'occupied' as const,
        label: `${slotTime} (Занято)`,
        badge: 'Занято',
        booking: apiBooking,
      };
    }

    // State 3: «Свободный слот»
    return {
      state: 'available' as const,
      label: slotTime,
    };
  };

  // Contiguous slot selection logic for available slots
  const handleSlotClick = (slotTime: string) => {
    setSlotWarningMsg(null);
    const clickedIdx = getSlotIndex(slotTime);
    if (clickedIdx === -1) return;

    if (maxAllowedHoursToday <= 0) {
      setSlotWarningMsg('Вы исчерпали суточный лимит бронирований (3 часа в сутки на пользователя).');
      return;
    }

    // If previously an occupied slot was selected, clear it
    if (isSelectedSlotOccupied) {
      setSelectedSlotTimes([slotTime]);
      return;
    }

    // Case 1: First slot chosen
    if (selectedSlotTimes.length === 0) {
      setSelectedSlotTimes([slotTime]);
      return;
    }

    // Case 2: Slot is already in selection -> deselecting
    if (selectedSlotTimes.includes(slotTime)) {
      const currentIndices = selectedSlotTimes.map(getSlotIndex).sort((a, b) => a - b);
      const minIdx = currentIndices[0];
      const maxIdx = currentIndices[currentIndices.length - 1];

      // If single slot selected, deselect it
      if (selectedSlotTimes.length === 1) {
        setSelectedSlotTimes([]);
        return;
      }

      // If clicked the edge slot, shrink selection
      if (clickedIdx === minIdx || clickedIdx === maxIdx) {
        setSelectedSlotTimes(selectedSlotTimes.filter((t) => t !== slotTime));
        return;
      }

      // If clicked the middle slot of 3 -> reset to just this slot
      setSelectedSlotTimes([slotTime]);
      return;
    }

    // Case 3: Adding a new slot -> must be contiguous (adjacent to min or max)
    const currentIndices = selectedSlotTimes.map(getSlotIndex).sort((a, b) => a - b);
    const minIdx = currentIndices[0];
    const maxIdx = currentIndices[currentIndices.length - 1];

    const isAdjacent = clickedIdx === minIdx - 1 || clickedIdx === maxIdx + 1;

    if (isAdjacent) {
      // Check 3h limit & daily limit
      if (selectedSlotTimes.length >= 3 || selectedSlotTimes.length >= maxAllowedHoursToday) {
        if (selectedSlotTimes.length >= maxAllowedHoursToday && maxAllowedHoursToday < 3) {
          setSlotWarningMsg(`Доступно для бронирования не более ${maxAllowedHoursToday} ч на эту дату (суточный лимит: 3 ч).`);
        } else {
          setSlotWarningMsg('В одной брони можно выбрать максимум 3 часа подряд.');
        }
        setSelectedSlotTimes([slotTime]);
        return;
      }

      const newIndices = [...currentIndices, clickedIdx].sort((a, b) => a - b);
      setSelectedSlotTimes(newIndices.map((i) => TIME_SLOTS_GRID[i].time));
    } else {
      // Non-contiguous -> inform user and reset to newly clicked slot
      setSlotWarningMsg('В одной брони можно выбрать только непрерывное время. Для разного времени создайте отдельные брони.');
      setSelectedSlotTimes([slotTime]);
    }
  };

  const handleOccupiedSlotClick = (slotTime: string) => {
    setSlotWarningMsg(null);
    setSelectedSlotTimes([slotTime]);
  };

  const selectedOccupiedInfo = selectedSlotTimes.length > 0 ? getSlotInfo(selectedSlotTimes[0]) : null;
  const isSelectedSlotOccupied = selectedOccupiedInfo?.state === 'occupied';
  const selectedBooking = selectedOccupiedInfo?.booking;
  const isFull = Boolean(selectedBooking && (selectedBooking.isFull || (selectedBooking.participantsCount && selectedBooking.participantsCount >= 15)));

  // Compute strictly continuous overall time range for booking
  const sortedSelected = useMemo(() => {
    return [...selectedSlotTimes].sort((a, b) => {
      const idxA = getSlotIndex(a);
      const idxB = getSlotIndex(b);
      return idxA - idxB;
    });
  }, [selectedSlotTimes]);

  const startTime = sortedSelected[0] ? sortedSelected[0].split('–')[0]?.trim() : '';
  const endTime = sortedSelected[sortedSelected.length - 1] ? sortedSelected[sortedSelected.length - 1].split('–')[1]?.trim() : '';
  const totalHours = selectedSlotTimes.length;

  const handleActionClick = async () => {
    if (selectedSlotTimes.length > 0 && startTime && endTime) {
      if (isSelectedSlotOccupied) {
        if (isFull) {
          setSlotWarningMsg('Все места на эту игру уже заняты (15/15)');
          return;
        }
        const targetBookingId = selectedBooking?.id || selectedBooking?.bookingId;
        if (targetBookingId) {
          try {
            const res = await api.createJoinRequest(targetBookingId);
            if (res.success) {
              setIsJoinSuccessModalOpen(true);
            } else {
              setSlotWarningMsg(res.message || 'Не удалось отправить заявку');
            }
          } catch (err: any) {
            setSlotWarningMsg(err.message || 'Ошибка при отправке заявки');
          }
        }
      } else {
        const slotObj: TimeSlot = {
          id: `slot-${startTime}-${endTime}`,
          time: `${startTime} – ${endTime}`,
          isAvailable: true,
        };
        onBook(venue, activeDay.fullDateStr, slotObj);
      }
    }
  };

  // Touch swipe down handlers to close modal
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current !== null) {
      const touchEndY = e.changedTouches[0].clientY;
      const deltaY = touchEndY - touchStartY.current;
      if (deltaY > 60) {
        onClose();
      }
      touchStartY.current = null;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[430px] bg-white rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up p-5 text-slate-900 mx-auto"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Swipe Down Bar Indicator */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-3" />

        {/* Top Header info */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-[#00B050] bg-[#E8F8F0] px-2 py-0.5 rounded-lg border border-[#00B050]/20">
                {venue.sport === 'football' ? '⚽ Футбол' : '🏀 Баскетбол'}
              </span>
              <div className="flex items-center gap-1 text-slate-400 text-xs font-semibold">
                <Star className="w-3.5 h-3.5 fill-[#FFB800] text-[#FFB800]" />
                <span className="text-slate-800 font-bold">5.0</span>
                <span>•</span>
                <span>{venue.city}</span>
                {distanceText && (
                  <>
                    <span>•</span>
                    <span className="text-[#00B050] font-bold">{distanceText}</span>
                  </>
                )}
              </div>
            </div>

            <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-snug truncate">
              {venue.title}
            </h2>
            <p className="text-xs text-slate-500 font-medium truncate">{venue.address}</p>
          </div>

          <button
            type="button"
            onClick={() => onToggleFavorite(venue.id)}
            className="w-10 h-10 rounded-2xl bg-[#F8FAFC] border border-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50/50 transition-all shrink-0 cursor-pointer"
          >
            <Heart
              className={`w-5 h-5 transition-colors ${
                isFavorite ? 'fill-red-500 text-red-500' : 'text-slate-400'
              }`}
            />
          </button>
        </div>

        {/* Date Selector Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-900">Выберите время:</span>
          <span className="text-[11px] font-semibold text-slate-400">
            {maxAllowedHoursToday < 3
              ? `Осталось лимита: ${maxAllowedHoursToday} ч`
              : 'Лимит: до 3 часов в сутки'}
          </span>
        </div>

        {/* Dates Horizontal Picker */}
        <div className="grid grid-cols-6 gap-1.5 mb-3">
          {upcomingDays.map((item, idx) => {
            const isSelected = idx === selectedDateIdx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setSelectedDateIdx(idx);
                }}
                className={`py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#E8F8F0] border-2 border-[#00B050] text-slate-900 shadow-xs'
                    : 'bg-[#F8FAFC] border border-slate-100 text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span className="text-[11px] font-semibold text-slate-500">{item.day}</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5">{item.num}</span>
              </button>
            );
          })}
        </div>

        {/* Time Slots Grid (4 distinct states) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-3 max-h-[320px] overflow-y-auto pr-0.5">
          {TIME_SLOTS_GRID.map((slotItem, idx) => {
            const isSelected = selectedSlotTimes.includes(slotItem.time);
            const info = getSlotInfo(slotItem.time, selectedDateIdx);

            // State 4: «Прошедшее время»
            if (info.state === 'past') {
              return (
                <div
                  key={idx}
                  className="py-3 px-3.5 rounded-2xl text-xs bg-[#F4F4F6] border border-slate-100 text-slate-400 font-medium cursor-not-allowed flex items-center justify-between select-none opacity-60"
                  title="Время уже прошло"
                >
                  <span>{slotItem.time}</span>
                </div>
              );
            }

            // State 1: «Ваша бронь» (занято текущим пользователем)
            if (info.state === 'my_booking') {
              return (
                <div
                  key={idx}
                  className="py-3 px-3.5 rounded-2xl text-xs bg-[#E8F8F0] border-2 border-[#00B050] text-[#009644] font-bold flex items-center justify-between opacity-95 cursor-not-allowed select-none shadow-xs"
                  title="Ваше активное бронирование на этой площадке"
                >
                  <span className="truncate mr-1">{slotItem.time}</span>
                  <span className="text-[10px] bg-[#00B050] text-white px-1.5 py-0.5 rounded-md font-bold shrink-0">
                    Ваша бронь
                  </span>
                </div>
              );
            }

            // State 2: «Занято другим пользователем»
            if (info.state === 'occupied') {
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleOccupiedSlotClick(slotItem.time)}
                  className={`py-3 px-3.5 rounded-2xl text-xs transition-all flex items-center justify-between font-bold cursor-pointer ${
                    isSelected
                      ? 'bg-[#FFF4E5] border-2 border-[#D97706] text-[#D97706] shadow-xs'
                      : 'bg-[#FFF4E5] border border-[#FDE68A] text-[#D97706] hover:bg-[#FFE8CC]'
                  }`}
                  title="Этот слот занят, но вы можете отправить запрос на присоединение"
                >
                  <span className="truncate mr-1">{slotItem.time}</span>
                  <span className="text-[10px] bg-[#D97706] text-white px-1.5 py-0.5 rounded-md font-bold shrink-0">
                    {isSelected ? 'Выбрано' : 'Занято'}
                  </span>
                </button>
              );
            }

            // State 3: «Свободный слот»
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSlotClick(slotItem.time)}
                className={`py-3 px-3.5 rounded-2xl text-xs transition-all flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-[#E8F8F0] border-2 border-[#00B050] text-slate-900 font-bold shadow-xs'
                    : 'bg-[#F8FAFC] hover:bg-slate-100 text-slate-900 font-semibold border border-slate-100'
                }`}
              >
                <span>{slotItem.time}</span>
                {isSelected && (
                  <Check className="w-4 h-4 stroke-[2.5px] text-[#00B050]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Informative Warning Toast for non-contiguous or limit alerts */}
        {slotWarningMsg && (
          <div className="text-xs text-amber-800 font-semibold text-center mb-3 bg-amber-50 p-2.5 rounded-xl border border-amber-200 animate-fade-in flex items-center justify-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{slotWarningMsg}</span>
          </div>
        )}

        {/* Yellow Alert when an occupied slot is selected */}
        {isSelectedSlotOccupied && (
          <div className="text-xs text-[#D97706] font-semibold text-center mb-3 bg-[#FFF4E5] p-3 rounded-2xl border border-[#FDE68A] animate-fade-in">
            {isFull
              ? 'Все места на эту игру уже заняты (15/15)'
              : 'Этот слот занят, но вы можете отправить запрос, чтобы присоединиться к игре'}
          </div>
        )}

        {/* Bottom Action Area */}
        <div className="pt-3 border-t border-slate-100">
          <button
            type="button"
            disabled={selectedSlotTimes.length === 0 || (isSelectedSlotOccupied && isFull)}
            onClick={handleActionClick}
            className="w-full bg-[#00B050] hover:bg-[#009644] text-white font-bold py-4 rounded-2xl flex items-center justify-center shadow-md shadow-[#00B050]/20 transition-all text-base disabled:opacity-40 cursor-pointer"
          >
            <span>
              {isSelectedSlotOccupied
                ? isFull
                  ? 'Все места заняты (15/15)'
                  : 'Присоединиться к игре'
                : totalHours > 0
                ? `Забронировать (${startTime} – ${endTime} • ${totalHours} ${totalHours === 1 ? 'час' : 'часа'})`
                : 'Забронировать'}
            </span>
          </button>
        </div>
      </div>

      {/* Join Request Success Modal Popup */}
      {isJoinSuccessModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => {
            setIsJoinSuccessModalOpen(false);
            onClose();
          }}
        >
          <div
            className="w-full max-w-[380px] bg-white rounded-3xl p-6 shadow-2xl text-center space-y-4 animate-fade-in text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 mx-auto rounded-full bg-[#E8F8F0] text-[#00B050] flex items-center justify-center">
              <Check className="w-7 h-7 stroke-[2.5px]" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">Запрос отправлен</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Ваш запрос отправлен организатору. Как только он будет одобрен, вы получите уведомление
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsJoinSuccessModalOpen(false);
                onClose();
              }}
              className="w-full bg-[#00B050] hover:bg-[#009644] text-white font-bold py-3.5 rounded-2xl text-xs transition-all shadow-md shadow-[#00B050]/20 cursor-pointer"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
