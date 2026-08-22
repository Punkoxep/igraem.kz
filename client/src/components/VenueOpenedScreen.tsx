import React, { useState, useEffect, useMemo } from 'react';
import {
  Unlock,
  ChevronLeft,
  Info,
  AlertCircle,
  DoorOpen,
  Check,
  X,
  Send,
  ShieldCheck,
  Users,
  ChevronRight,
  ShieldAlert,
  AlertTriangle,
  Clock,
  Loader2
} from 'lucide-react';
import { Booking } from '../types';
import { api } from '../services/api';

interface VenueOpenedScreenProps {
  booking: Booking;
  onBackToMap: () => void;
  onFinishBooking?: (bookingId: string) => void;
  onBookingUpdated?: (updatedBooking: Booking) => void;
  userBookings?: Booking[];
}

type ModalType = 'rules' | 'problem' | 'doorOpened' | 'confirmFinish' | 'confirmExtend' | 'players' | null;

/**
 * Calculates accurate session metrics:
 * totalDuration = endTime - startTime
 * elapsed = now - startTime
 * progress = (elapsed / totalDuration) * 100
 */
function calculateSessionMetrics(booking: Booking) {
  const now = new Date();
  const times = booking.timeSlot ? booking.timeSlot.split('–').map((t) => t.trim()) : ['18:00', '19:00'];
  const [startH, startM] = (times[0] || '18:00').split(':').map(Number);
  const [endH, endM] = (times[1] || '19:00').split(':').map(Number);

  const startDate = new Date();
  const endDate = new Date();

  if (booking.date && /^\d{4}-\d{2}-\d{2}$/.test(booking.date)) {
    const [y, m, d] = booking.date.split('-').map(Number);
    startDate.setFullYear(y, m - 1, d);
    endDate.setFullYear(y, m - 1, d);
  } else if (booking.date && /^\d{2}\.\d{2}\.\d{4}$/.test(booking.date)) {
    const [d, m, y] = booking.date.split('.').map(Number);
    startDate.setFullYear(y, m - 1, d);
    endDate.setFullYear(y, m - 1, d);
  }

  startDate.setHours(startH || 0, startM || 0, 0, 0);
  endDate.setHours(endH || 0, endM || 0, 0, 0);

  // Total duration of current booking session in seconds
  const totalDurationSeconds = Math.max(60, Math.floor((endDate.getTime() - startDate.getTime()) / 1000));

  // Seconds remaining until end of slot
  const rawRemainingSeconds = Math.floor((endDate.getTime() - now.getTime()) / 1000);
  const secondsRemaining = Math.max(0, rawRemainingSeconds);

  // Elapsed seconds since slot start
  const elapsedSeconds = Math.max(0, Math.min(totalDurationSeconds, Math.floor((now.getTime() - startDate.getTime()) / 1000)));

  // Progress percentage relative to total duration: (elapsed / totalDuration) * 100
  const progressPercent = Math.min(100, Math.max(0, (elapsedSeconds / totalDurationSeconds) * 100));

  return {
    totalDurationSeconds,
    secondsRemaining,
    elapsedSeconds,
    progressPercent,
  };
}

/**
 * Format remaining time nicely:
 * - If > 60 min: "X ч Y мин" (e.g. 95 min -> "1 ч 35 мин", 120 min -> "2 ч")
 * - If <= 60 min: "X мин" (e.g. "40 мин") or seconds when < 1 min ("45 сек")
 */
function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return '0 мин';
  if (seconds < 60) return `${seconds} сек`;

  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`;
  }

  return `${totalMinutes} мин`;
}

export const VenueOpenedScreen: React.FC<VenueOpenedScreenProps> = ({
  booking,
  onBackToMap,
  onFinishBooking,
  onBookingUpdated,
  userBookings = [],
}) => {
  const [currentBooking, setCurrentBooking] = useState<Booking>(booking);

  useEffect(() => {
    setCurrentBooking(booking);
  }, [booking]);

  const [sessionMetrics, setSessionMetrics] = useState(() => calculateSessionMetrics(currentBooking));

  // Realtime 1-second countdown timer interval
  useEffect(() => {
    const updateMetrics = () => {
      setSessionMetrics(calculateSessionMetrics(currentBooking));
    };
    updateMetrics();
    const timer = setInterval(updateMetrics, 1000);
    return () => clearInterval(timer);
  }, [currentBooking]);

  const { secondsRemaining, progressPercent } = sessionMetrics;
  const isUrgent = secondsRemaining < 600 && secondsRemaining > 0;
  const displayTimeText = formatTimeRemaining(secondsRemaining);

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [problemText, setProblemText] = useState('');
  const [problemSent, setProblemSent] = useState(false);
  const [extendSuccessToast, setExtendSuccessToast] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isExtending, setIsExtending] = useState(false);

  const times = currentBooking.timeSlot ? currentBooking.timeSlot.split('–').map((t) => t.trim()) : ['18:00', '19:00'];
  const startHourStr = times[0] || '18:00';
  const endHourStr = times[1] || '19:00';
  const [endH, endM] = endHourStr.split(':').map(Number);
  const nextEndH = (endH || 0) + 1;
  const nextEndFormatted = `${String(nextEndH).padStart(2, '0')}:${String(endM || 0).padStart(2, '0')}`;

  const isParticipant = !!currentBooking.isParticipant;
  const isHost = !isParticipant || currentBooking.isHost === true;
  const isPastClosing = (endH || 0) >= 23;

  // Calculate total booked hours today for user limit check (max 3h)
  // Strictly include only ACTIVE, CONFIRMED, UPCOMING. Exclude CANCELLED, REJECTED.
  const userBookedHoursToday = useMemo(() => {
    if (!userBookings || userBookings.length === 0) {
      const sH = parseInt(startHourStr.split(':')[0] || '0', 10);
      const eH = parseInt(endHourStr.split(':')[0] || '0', 10);
      return Math.max(1, eH - sH);
    }
    return userBookings
      .filter((b) => {
        if (b.date !== currentBooking.date) return false;
        const s = (b.status || '').toUpperCase();
        return s === 'ACTIVE' || s === 'CONFIRMED' || s === 'UPCOMING';
      })
      .reduce((sum, b) => {
        const t = b.timeSlot ? b.timeSlot.split('–').map((x) => x.trim()) : [];
        const s = parseInt(t[0]?.split(':')[0] || '0', 10);
        const e = parseInt(t[1]?.split(':')[0] || '0', 10);
        const diff = e - s;
        return sum + (diff > 0 ? diff : 1);
      }, 0);
  }, [userBookings, currentBooking.date, startHourStr, endHourStr]);

  // Check 1: Время закрытия (текущая бронь заканчивается в 23:00)
  const isClosingTime = (endH || 0) >= 23;

  // Check 2: Суточный лимит (текущие часы + 1 час > 3 часов)
  const isDailyLimitReached = userBookedHoursToday + 1 > 3;

  // Check 3: Занятость следующего часа
  // Ground bookings to check next hour availability
  const [groundBookings, setGroundBookings] = useState<any[]>([]);

  useEffect(() => {
    const gid = currentBooking.venueId || currentBooking.groundId;
    if (gid && currentBooking.date) {
      api.getGroundBookings(gid, currentBooking.date)
        .then((res) => {
          if (res && res.success && Array.isArray(res.data)) {
            setGroundBookings(res.data);
          }
        })
        .catch((err) => console.warn('[VenueOpenedScreen] getGroundBookings error:', err));
    }
  }, [currentBooking.venueId, currentBooking.groundId, currentBooking.date]);

  const isNextSlotOccupied = useMemo(() => {
    return groundBookings.some((b) => {
      if (b.id === currentBooking.id) return false;
      const s = (b.status || '').toUpperCase();
      if (s === 'CANCELLED' || s === 'REJECTED') return false;
      const bStart = b.startTime || b.start_time || b.time_slot?.split('–')[0]?.trim();
      const bEnd = b.endTime || b.end_time || b.time_slot?.split('–')[1]?.trim();
      if (!bStart || !bEnd) return false;
      return endHourStr < bEnd && nextEndFormatted > bStart;
    });
  }, [groundBookings, currentBooking.id, endHourStr, nextEndFormatted]);

  const canExtend = isHost && !isClosingTime && !isDailyLimitReached && !isNextSlotOccupied;

  const extendSubtitle = useMemo(() => {
    // Проверка 1 (Время закрытия)
    if (isClosingTime) return 'Площадка закрывается в 23:00';
    // Проверка 2 (Суточный лимит)
    if (isDailyLimitReached) return 'Достигнут лимит 3 ч в день';
    // Проверка 3 (Занятость)
    if (isNextSlotOccupied) return 'Следующий час занят';
    // Проверка 4 (Свободно)
    return 'Следующий час свободен';
  }, [isClosingTime, isDailyLimitReached, isNextSlotOccupied]);

  const initialGuests = useMemo(() => {
    if (currentBooking.guests && currentBooking.guests.length > 0) {
      return currentBooking.guests.map((g: any, idx: number) => ({
        id: g.id || `g-${idx}`,
        name: g.name || g.user?.full_name || `Игрок ${idx + 1}`,
        iin: g.iin || g.user?.iin || '000000000000',
        status: (g.status === 'approved' ? 'approved' : g.status === 'entered' ? 'entered' : 'pending') as 'approved' | 'pending' | 'entered',
      }));
    }
    return [
      { id: '1', name: 'Нурлан С.', iin: '950312301245', status: 'approved' as const },
    ];
  }, [currentBooking.guests]);

  const [participantsList, setParticipantsList] = useState(initialGuests);

  const handleOpenDoorClick = async () => {
    if (!('geolocation' in navigator)) {
      alert('Геолокация не поддерживается вашим браузером. Включите геолокацию на смартфоне для открытия замка.');
      return;
    }

    setIsUnlocking(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await api.unlockDoor({
            bookingId: currentBooking.id,
            qrCode: currentBooking.qrCode,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });

          if (res && res.success === false) {
            alert(res.message || 'Не удалось открыть дверь');
          } else {
            setActiveModal('doorOpened');
          }
        } catch (e: any) {
          console.warn('[VenueOpenedScreen] Door unlock API call error:', e);
          alert(e.message || 'Ошибка связи с замком');
        } finally {
          setIsUnlocking(false);
        }
      },
      async (err) => {
        console.warn('[VenueOpenedScreen] Geolocation error:', err);
        // Fallback for admins: attempt unlock without coordinates (if admin)
        try {
          const res = await api.unlockDoor({
            bookingId: currentBooking.id,
            qrCode: currentBooking.qrCode,
          });

          if (res && res.success) {
            setActiveModal('doorOpened');
            setIsUnlocking(false);
            return;
          }
        } catch (e) {}

        setIsUnlocking(false);
        alert('Включите геолокацию на смартфоне для открытия замка.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleApproveParticipant = (id: string) => {
    setParticipantsList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'approved' } : item))
    );
  };

  const handleDeclineParticipant = (id: string) => {
    setParticipantsList((prev) => prev.filter((item) => item.id !== id));
  };

  const handleExtendBooking = async () => {
    setIsExtending(true);
    try {
      const res = await api.extendBooking(currentBooking.id);
      if (res && res.success) {
        setActiveModal(null);
        setExtendSuccessToast(true);
        setTimeout(() => setExtendSuccessToast(false), 3500);

        const newEndTime = res.data?.end_time || nextEndFormatted;
        const newTimeSlot = `${startHourStr} – ${newEndTime}`;
        const updatedBookingObj: Booking = {
          ...currentBooking,
          timeSlot: newTimeSlot,
        };

        setCurrentBooking(updatedBookingObj);
        setSessionMetrics(calculateSessionMetrics(updatedBookingObj));

        if (onBookingUpdated) {
          onBookingUpdated(updatedBookingObj);
        }
      } else {
        alert(res?.message || 'Не удалось продлить бронирование');
      }
    } catch (err: any) {
      console.error('[VenueOpenedScreen] extendBooking error:', err);
      alert(err.message || 'Ошибка продления бронирования');
    } finally {
      setIsExtending(false);
    }
  };

  const [issueToast, setIssueToast] = useState<string | null>(null);
  const [isSendingProblem, setIsSendingProblem] = useState(false);

  const handleSendProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problemText.trim() || problemText.trim().length < 5) {
      alert('Пожалуйста, опишите проблему подробнее (минимум 5 символов)');
      return;
    }
    setIsSendingProblem(true);
    try {
      const res = await api.createIssueReport({
        message: problemText.trim(),
        groundId: currentBooking.venueId || currentBooking.groundId,
        bookingId: currentBooking.id,
      });
      if (res && res.success) {
        setActiveModal(null);
        setProblemText('');
        setIssueToast('Спасибо! Сообщение о проблеме отправлено администрации');
        setTimeout(() => setIssueToast(null), 4000);
      } else {
        alert(res?.message || 'Не удалось отправить сообщение о проблеме');
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка отправки сообщения');
    } finally {
      setIsSendingProblem(false);
    }
  };

  const handleCompleteBooking = () => {
    if (onFinishBooking) onFinishBooking(booking.id);
    setActiveModal(null);
    onBackToMap();
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-4 bg-white text-slate-900 animate-fade-in w-full relative overflow-y-auto">
      {/* Extension Success Toast */}
      {extendSuccessToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#00B050] text-white font-bold text-xs px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>Бронирование успешно продлено на 1 час! 🎉</span>
        </div>
      )}

      {/* Issue Report Success Toast */}
      {issueToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#00B050] text-white font-bold text-xs px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-slide-down">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{issueToast}</span>
        </div>
      )}

      <div className="pt-2 space-y-4">
        {/* Header Top Bar */}
        <div className="relative flex items-center justify-center w-full min-h-[36px]">
          <button
            type="button"
            onClick={onBackToMap}
            className="absolute left-0 bg-[#E8F8F0] hover:bg-[#D2F2E2] text-[#00B050] font-bold px-3.5 py-1.5 rounded-2xl text-xs flex items-center gap-0.5 transition-colors z-10 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5px]" />
            <span>Назад</span>
          </button>
          <h1 className="text-base font-bold text-slate-900 tracking-tight text-center">
            Активная бронь
          </h1>
        </div>

        {/* Top Lock Emblem - Turns red when time expired */}
        <div className="pt-2">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto shadow-xs transition-colors ${
            secondsRemaining <= 0
              ? 'bg-rose-50 border-2 border-rose-200 text-rose-600 animate-pulse'
              : 'bg-[#E8F8F0] border border-[#00B050]/20 text-[#00B050]'
          }`}>
            {secondsRemaining <= 0 ? (
              <AlertTriangle className="w-11 h-11 stroke-[2.2px]" />
            ) : (
              <Unlock className="w-11 h-11 stroke-[2.2px]" />
            )}
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-1">
          <h2 className={`text-2xl font-black tracking-tight ${secondsRemaining <= 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {secondsRemaining <= 0 ? 'Время вышло' : 'Площадка открыта'}
          </h2>
          {secondsRemaining <= 0 && (
            <p className="text-sm font-bold text-rose-600">
              Пожалуйста, покиньте площадку
            </p>
          )}
        </div>

        {/* Progress Timer Box OR Expired Warning Notice */}
        {secondsRemaining <= 0 ? (
          <div className="space-y-3">
            {/* 3-Day Block Penalty Highlighted Box */}
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-1.5 shadow-xs text-left animate-fade-in">
              <div className="flex items-center gap-2 text-rose-600 font-extrabold text-xs uppercase tracking-wide">
                <ShieldAlert className="w-4.5 h-4.5 text-rose-600 shrink-0" />
                <span>ПРЕДУПРЕЖДЕНИЕ О БЛОКИРОВКЕ</span>
              </div>
              <p className="text-xs text-slate-800 font-medium leading-relaxed">
                Если в течение <span className="text-rose-600 font-bold">5 минут</span> после истечения лимита вы не покинете и не закроете площадку, ваш аккаунт будет <span className="text-rose-600 font-bold">заблокирован в сервисе на 3 дня</span>.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-[#F8FAFC] border border-slate-100 rounded-2xl p-4 text-center space-y-2">
            <span className="text-xs font-medium text-slate-400 block">
              До освобождения площадки (за 5 мин до конца слота)
            </span>
            <div className={`text-xl font-bold transition-colors ${isUrgent ? 'text-[#F97316]' : 'text-slate-900'}`}>
              {displayTimeText}
            </div>

            {/* Progress bar fills up as time elapses, turns ORANGE when < 10 mins remain! */}
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isUrgent ? 'bg-[#F97316]' : 'bg-[#00B050]'
                }`}
                style={{ width: `${Math.max(8, progressPercent)}%` }}
              />
            </div>
          </div>
        )}

        {/* Clean Menu Action Cards Stack */}
        <div className="space-y-2 pt-1">
          {/* Card: Участники */}
          <button
            type="button"
            onClick={() => setActiveModal('players')}
            className="w-full bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-2.5 px-3.5 flex items-center gap-3 text-left shadow-xs transition-all active:scale-98 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-[#E8F8F0] text-[#00B050] flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 stroke-[1.8px]" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-slate-900 text-xs block leading-tight">
                Участники
              </span>
              <span className="text-[11px] text-slate-400 font-medium truncate block">
                {booking.guests && booking.guests.length > 0
                  ? `Организатор + ${booking.guests.length} игроков`
                  : 'Организатор и запросы на игру'}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>

          {/* Card 1: Правила пользования площадкой */}
          <button
            type="button"
            onClick={() => setActiveModal('rules')}
            className="w-full bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-2.5 px-3.5 flex items-center gap-3 text-left shadow-xs transition-all active:scale-98 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center shrink-0">
              <Info className="w-4 h-4 stroke-[1.8px]" />
            </div>
            <span className="font-bold text-slate-900 text-xs flex-1">
              Правила пользования площадкой
            </span>
          </button>

          {/* Card 2: Сообщить о проблеме */}
          <button
            type="button"
            onClick={() => setActiveModal('problem')}
            className="w-full bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-2.5 px-3.5 flex items-center gap-3 text-left shadow-xs transition-all active:scale-98 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-[#FEE2E2] text-[#EF4444] flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4 stroke-[1.8px]" />
            </div>
            <span className="font-bold text-slate-900 text-xs flex-1">
              Сообщить о проблеме
            </span>
          </button>

          {/* Card: Продлить на 1 час - Visible ONLY to Host (Variant D: Hidden for participants) */}
          {isHost && (
            <button
              type="button"
              onClick={() => {
                if (canExtend) {
                  setActiveModal('confirmExtend');
                }
              }}
              disabled={!canExtend}
              className={`w-full border rounded-2xl p-2.5 px-3.5 flex items-center gap-3 text-left shadow-xs transition-all ${
                canExtend
                  ? 'bg-white border-slate-200/80 hover:border-slate-300 cursor-pointer active:scale-98'
                  : 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed opacity-60'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  canExtend ? 'bg-[#E8F8F0] text-[#00B050]' : 'bg-slate-100 text-slate-400'
                }`}
              >
                <Clock className="w-4 h-4 stroke-[1.8px]" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-slate-900 text-xs block leading-tight">
                  Продлить на 1 час
                </span>
                <span className="text-[11px] text-slate-400 font-medium truncate block">
                  {extendSubtitle}
                </span>
              </div>
            </button>
          )}

          {/* Card 3: Открыть дверь */}
          <button
            type="button"
            onClick={handleOpenDoorClick}
            disabled={isUnlocking}
            className="w-full bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-2.5 px-3.5 flex items-center gap-3 text-left shadow-xs transition-all active:scale-98 cursor-pointer disabled:opacity-75"
          >
            <div className="w-8 h-8 rounded-xl bg-[#E8F8F0] text-[#00B050] flex items-center justify-center shrink-0">
              {isUnlocking ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#00B050]" />
              ) : (
                <DoorOpen className="w-4 h-4 stroke-[1.8px]" />
              )}
            </div>
            <div className="flex-1">
              <span className="font-bold text-slate-900 text-xs block leading-tight">
                {isUnlocking ? 'Открытие замка...' : 'Открыть дверь'}
              </span>
              <span className="text-[11px] text-slate-400 font-medium truncate block">
                {isUnlocking ? 'Отправляем сигнал на смарт-замок' : 'Нажмите для разблокировки замка'}
              </span>
            </div>
          </button>

          {/* Full-width Red Button: Завершить бронь / Покинуть площадку (Организатор) или Покинуть игру (Участник) */}
          <button
            type="button"
            onClick={() => setActiveModal('confirmFinish')}
            className="w-full bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white font-bold py-3.5 px-4 rounded-2xl text-xs flex items-center justify-center shadow-md shadow-rose-500/20 transition-all cursor-pointer active:scale-98 !mt-6"
          >
            <span>{isParticipant ? 'Покинуть игру' : 'Завершить бронь / Покинуть площадку'}</span>
          </button>
        </div>
      </div>

      {/* Rules Modal Popup */}
      {activeModal === 'rules' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-[420px] bg-white rounded-3xl p-5 shadow-2xl space-y-4 animate-fade-in text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <ShieldCheck className="w-5 h-5 text-[#00B050]" />
                <h2>Правила пользования площадки</h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <p>1. Переобувайтесь в чистую спортивную обувь без металлических шипов.</p>
              <p>2. Убирайте за собой мусор и соблюдайте чистоту на территории.</p>
              <p>3. Покиньте и освободите площадку за 5 минут до окончания забронированного часа.</p>
              <p>4. При выходе убедитесь, что дверь плотно закрыта.</p>
            </div>

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="w-full bg-[#00B050] hover:bg-[#009644] text-white font-bold py-3 rounded-2xl text-xs transition-all cursor-pointer"
            >
              Понятно
            </button>
          </div>
        </div>
      )}

      {/* Problem Modal Popup */}
      {activeModal === 'problem' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-[420px] bg-white rounded-3xl p-5 shadow-2xl space-y-4 animate-fade-in text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                <h2>Сообщить о проблеме</h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {problemSent ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#E8F8F0] text-[#00B050] flex items-center justify-center">
                  <Check className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Спасибо за сообщение!</h3>
                <p className="text-xs text-slate-500">Наша служба поддержки уже занимается вашей заявкой.</p>
              </div>
            ) : (
              <form onSubmit={handleSendProblem} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">
                    Описание проблемы
                  </label>
                  <textarea
                    rows={3}
                    value={problemText}
                    onChange={(e) => {
                      setProblemText(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = `${Math.max(96, e.target.scrollHeight)}px`;
                    }}
                    placeholder="Не работает свет, сломан замок, мусор на площадке..."
                    required
                    className="w-full min-h-[96px] bg-slate-50 border border-slate-200 focus:border-[#00B050] focus:bg-white rounded-2xl p-3 text-xs text-slate-900 outline-none transition-all resize-none overflow-x-hidden overflow-y-hidden break-words whitespace-pre-wrap"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#00B050] hover:bg-[#009644] text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs shadow-md shadow-[#00B050]/20 transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Отправить</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Door Opened Toast Modal Popup */}
      {activeModal === 'doorOpened' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-[360px] bg-white rounded-3xl p-6 shadow-2xl text-center space-y-3 animate-fade-in text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 mx-auto rounded-full bg-[#E8F8F0] text-[#00B050] flex items-center justify-center">
              <DoorOpen className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Дверь разблокирована!</h3>
            <p className="text-xs text-slate-500">Сигнал на открытие отправлен на смарт-замок.</p>
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="w-full bg-[#00B050] hover:bg-[#009644] text-white font-bold py-3 rounded-2xl text-xs transition-all cursor-pointer"
            >
              Отлично
            </button>
          </div>
        </div>
      )}

      {/* Finish/Leave Booking Confirmation Modal */}
      {activeModal === 'confirmFinish' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-[380px] bg-white rounded-3xl p-6 shadow-2xl text-center space-y-4 animate-fade-in text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`w-14 h-14 mx-auto rounded-full ${isParticipant ? 'bg-amber-50 text-amber-500' : 'bg-rose-50 text-rose-500'} flex items-center justify-center`}>
              {isParticipant ? <Users className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isParticipant ? 'Покинуть совместную игру?' : 'Завершить бронирование?'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {isParticipant
                  ? 'Вы уверены, что хотите выйти из совместной игры? Доступ к площадке будет закрыт для вас.'
                  : 'Вы уверены, что хотите завершить сеанс? Доступ к площадке будет закрыт для всех участников игры.'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl text-xs transition-all cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleCompleteBooking}
                className={`w-1/2 ${isParticipant ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-600 hover:bg-rose-700'} text-white font-bold py-3 rounded-2xl text-xs transition-all cursor-pointer shadow-md`}
              >
                {isParticipant ? 'Да, покинуть' : 'Да, завершить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Extend 1 Hour Modal Popup */}
      {activeModal === 'confirmExtend' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in text-slate-900"
          onClick={() => !isExtending && setActiveModal(null)}
        >
          <div
            className="w-full max-w-[380px] bg-white rounded-3xl p-6 shadow-2xl text-center space-y-4 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 mx-auto rounded-full bg-[#E8F8F0] text-[#00B050] flex items-center justify-center">
              <Clock className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Продлить бронирование?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Продлить бронирование еще на 1 час? Сеанс будет увеличен до{' '}
                <span className="font-semibold text-slate-800">{nextEndFormatted}</span>.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={isExtending}
                onClick={() => setActiveModal(null)}
                className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-2xl text-xs transition-all cursor-pointer disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isExtending}
                onClick={handleExtendBooking}
                className="w-1/2 bg-[#00B050] hover:bg-[#009644] text-white font-bold py-3.5 rounded-2xl text-xs transition-all shadow-md shadow-[#00B050]/20 cursor-pointer disabled:opacity-75 flex items-center justify-center gap-1.5"
              >
                {isExtending ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <span>Да, продлить</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Screen "Участники" View */}
      {activeModal === 'players' && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-fade-in text-slate-900 w-full min-w-[360px]">
          {/* Header Bar */}
          <div className="bg-white px-4 pt-3.5 pb-3.5 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10 w-full">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="flex items-center gap-1 bg-[#E8F8F0] hover:bg-[#D2F2E2] text-[#00B050] font-bold px-3.5 py-1.5 rounded-full text-xs transition-all active:scale-95 shrink-0 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.5px]" />
              <span>Назад</span>
            </button>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight text-center flex-1 pr-14">
              Участники
            </h2>
          </div>

          {/* Participants List */}
          <div className="flex-1 overflow-y-auto w-full bg-white pt-[8px]">
            {participantsList.map((item) => (
              <div
                key={item.id}
                className="py-3.5 px-4 flex items-center justify-between text-xs w-full min-h-[48px] border-b border-slate-100"
              >
                <span className="font-bold text-slate-900 text-xs leading-normal pr-4 flex-1">
                  {item.name}
                </span>

                {item.status === 'pending' && (
                  <div className="flex items-center gap-5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDeclineParticipant(item.id)}
                      className="text-[#EF4444] hover:text-red-600 font-bold text-xs active:scale-95 transition-all cursor-pointer leading-normal"
                    >
                      Отклонить
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApproveParticipant(item.id)}
                      className="text-[#00B050] hover:text-[#009040] font-bold text-xs active:scale-95 transition-all cursor-pointer leading-normal"
                    >
                      Принять
                    </button>
                  </div>
                )}

                {item.status === 'entered' && (
                  <span className="text-slate-400 font-medium text-xs shrink-0 leading-normal flex items-center">
                    Вошёл
                  </span>
                )}

                {item.status === 'approved' && (
                  <span className="text-[#00B050] font-bold text-xs shrink-0 leading-normal flex items-center">
                    Одобрен
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
