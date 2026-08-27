import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Check,
  Calendar,
  Share2,
  AlertCircle,
  X,
  Send,
  Unlock,
  Bell,
  Loader2
} from 'lucide-react';
import { Booking } from '../types';
import { formatDateDDMMYYYY } from '../utils/date';
import { api } from '../services/api';
import { registerServiceWorkerAndSubscribe, isPushSupported } from '../utils/webPush';

interface BookingSuccessScreenProps {
  booking: Booking;
  onClose: () => void;
  onGoToBookings: () => void;
  onOpenVenue: (booking: Booking) => void;
  onCancelBooking?: (bookingId: string) => void;
  onLeaveBooking?: (bookingId: string) => void;
}

function getBookingCountdownInfo(booking: Booking, currentTimeMs: number = Date.now()) {
  const now = new Date(currentTimeMs);

  const times = booking.timeSlot ? booking.timeSlot.split('–').map((t) => t.trim()) : ['18:00', '19:00'];
  const startTimeStr = times[0] || '18:00';
  const endTimeStr = times[1] || '19:00';

  const [startHour, startMin] = startTimeStr.split(':').map(Number);
  const [endHour, endMin] = endTimeStr.split(':').map(Number);

  const startDate = new Date();
  startDate.setHours(startHour || 0, startMin || 0, 0, 0);

  if (booking.date && /^\d{4}-\d{2}-\d{2}$/.test(booking.date)) {
    const [y, m, d] = booking.date.split('-').map(Number);
    startDate.setFullYear(y, m - 1, d);
  } else if (booking.date && /^\d{2}\.\d{2}\.\d{4}$/.test(booking.date)) {
    const [d, m, y] = booking.date.split('.').map(Number);
    startDate.setFullYear(y, m - 1, d);
  }

  const endDate = new Date(startDate);
  endDate.setHours(endHour || 0, endMin || 0, 0, 0);

  // Vacate time is 5 minutes before end hour
  const vacateDate = new Date(endDate.getTime() - 5 * 60 * 1000);

  const diffMs = startDate.getTime() - now.getTime();
  const vacateDiffMs = vacateDate.getTime() - now.getTime();

  // Unlock window starts 10 minutes before slot start and remains active until vacate time
  const UNLOCK_LEAD_TIME_MS = 10 * 60 * 1000;

  // Active / within unlock lead time
  if (diffMs <= UNLOCK_LEAD_TIME_MS && vacateDiffMs > 0) {
    const vHours = String(vacateDate.getHours()).padStart(2, '0');
    const vMins = String(vacateDate.getMinutes()).padStart(2, '0');

    let countdownText = '';
    if (diffMs > 0) {
      const remainingStartMins = Math.ceil(diffMs / 60000);
      countdownText = `До старта ${remainingStartMins} мин • Доступ к замку открыт!`;
    } else {
      countdownText = `Игра идёт сейчас (освободить в ${vHours}:${vMins})`;
    }

    return {
      countdownText,
      canOpenNow: true,
      buttonText: 'Открыть площадку',
    };
  }

  // Vacate time passed or booking ended
  if (vacateDiffMs <= 0) {
    return {
      countdownText: 'Время бронирования истекло',
      canOpenNow: false,
      buttonText: 'Время сеанса завершено',
    };
  }

  // Future booking (> 10 mins before start)
  const totalMins = Math.ceil(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;

  let countdownFormatted = '';
  if (hours > 0) {
    countdownFormatted = `${hours}ч ${mins}мин`;
  } else {
    countdownFormatted = `${mins} мин`;
  }

  return {
    countdownText: `До начала брони: ${countdownFormatted} (в ${startTimeStr})`,
    canOpenNow: false,
    buttonText: `Открытие будет доступно за 10 мин до старта`,
  };
}

export const BookingSuccessScreen: React.FC<BookingSuccessScreenProps> = ({
  booking,
  onClose,
  onGoToBookings,
  onOpenVenue,
  onCancelBooking,
  onLeaveBooking,
}) => {
  const [isProblemModalOpen, setIsProblemModalOpen] = useState(false);
  const [isConfirmCancelOpen, setIsConfirmCancelOpen] = useState(false);
  const [isConfirmLeaveOpen, setIsConfirmLeaveOpen] = useState(false);
  const [problemText, setProblemText] = useState('');
  const [problemSent, setProblemSent] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockErrorMessage, setUnlockErrorMessage] = useState<string | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Live real-time tick interval every 1 second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const countdownInfo = useMemo(() => getBookingCountdownInfo(booking, currentTime), [booking, currentTime]);
  const canOpenNow = countdownInfo.canOpenNow;

  const handleOpenVenueWithUnlock = async () => {
    setIsUnlocking(true);
    setUnlockErrorMessage(null);

    const performUnlock = async (coords?: { latitude: number; longitude: number }) => {
      try {
        const payload: any = {
          bookingId: booking.id,
          booking_id: booking.id,
          qrCode: booking.qrCode,
        };

        if (coords) {
          payload.latitude = coords.latitude;
          payload.longitude = coords.longitude;
          payload.userLatitude = coords.latitude;
          payload.userLongitude = coords.longitude;
        }

        const res = await api.unlockDoor(payload);
        if (res && res.success === false) {
          throw new Error(res.message || 'Не удалось открыть замок');
        }

        // Haptic feedback (tactile vibration)
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate([100, 50, 100]);
          } catch (e) {}
        }

        // Transition directly to active venue screen with isOpened = true
        onOpenVenue({
          ...booking,
          isOpened: true,
        });
      } catch (err: any) {
        console.warn('[BookingSuccessScreen] Unlock error:', err);
        setUnlockErrorMessage(
          err.message || 'Не удалось открыть замок. Убедитесь, что вы находитесь рядом с площадкой и включена геолокация.'
        );
      } finally {
        setIsUnlocking(false);
      }
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          performUnlock({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        },
        (err) => {
          console.warn('[BookingSuccessScreen] Geolocation error:', err);
          performUnlock();
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      performUnlock();
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

  // System Share Sheet handler (Web Share API)
  const handleShare = async () => {
    const shareData = {
      title: `Бронирование: ${booking.venueTitle}`,
      text: `Я забронировал ${booking.venueTitle} (${booking.sport === 'football' ? '⚽ Футбол' : '🏀 Баскетбол'}) на ${booking.date} в ${booking.timeSlot}! ПИН-код: ${booking.pinCode}`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Share canceled or error:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(
          `${shareData.title}\n${shareData.text}\n${shareData.url}`
        );
        alert('Ссылка и информация о бронировании скопированы в буфер обмена!');
      } catch (e) {
        alert('Ссылка скопирована!');
      }
    }
  };

  // System Calendar (.ics iCalendar entry) handler
  const handleAddToCalendar = () => {
    const title = `Игра: ${booking.venueTitle}`;
    const description = `Бронирование площадки ${booking.venueTitle}. ПИН-код смарт-замка: ${booking.pinCode}. Адрес: ${booking.address}`;
    const location = `${booking.address}, ${booking.city}`;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//igraem.kz//NONSGML Booking System v1.0//RU',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `SUMMARY:${title}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `igraem-booking-${booking.id}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const [issueToast, setIssueToast] = useState<string | null>(null);
  const [isSendingProblem, setIsSendingProblem] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !isPushSupported()) return false;
    return 'Notification' in window && Notification.permission === 'default';
  });
  const [isSubscribingPush, setIsSubscribingPush] = useState(false);

  const handleEnableNotifications = async () => {
    setIsSubscribingPush(true);
    try {
      if (!isPushSupported()) {
        throw new Error('Ваш браузер не поддерживает Web Push уведомления');
      }

      // 1. Get VAPID public key
      const res = await api.getVapidPublicKey();
      const publicKey = res.publicKey;
      if (!publicKey) {
        throw new Error('Не удалось получить ключ VAPID от сервера');
      }

      // 2. Register Service Worker & subscribe
      const subscription = await registerServiceWorkerAndSubscribe(publicKey);
      if (!subscription) {
        throw new Error('Не удалось оформить подписку Web Push');
      }

      // 3. Send subscription to backend
      await api.subscribePushNotifications({
        subscription,
        notify30min: true,
      });

      setShowNotificationPrompt(false);
      setIssueToast('Уведомления успешно подключены! 🔔');
      setTimeout(() => setIssueToast(null), 4000);
    } catch (err: any) {
      console.warn('[BookingSuccessScreen] handleEnableNotifications error:', err);
      alert(err.message || 'Не удалось включить уведомления');
    } finally {
      setIsSubscribingPush(false);
    }
  };

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
        groundId: booking.venueId || booking.groundId,
        bookingId: booking.id,
      });
      if (res && res.success) {
        setIsProblemModalOpen(false);
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs animate-fade-in min-w-[360px]"
      onClick={onClose}
    >
      {/* Issue Report Success Toast */}
      {issueToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] bg-[#00B050] text-white font-bold text-xs px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-slide-down">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{issueToast}</span>
        </div>
      )}

      <div
        className="w-full max-w-[430px] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up p-5 max-h-[90vh] overflow-y-auto relative text-slate-900 mx-auto"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Top Close Button (X icon) */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors z-10 cursor-pointer"
          title="Закрыть"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="pt-2 space-y-4 text-center">
          {/* Top Checkmark Circle */}
          <div className="mx-auto w-16 h-16 rounded-full bg-[#E8F8F0] border border-[#00B050]/20 flex items-center justify-center text-[#00B050]">
            <Check className="w-8 h-8 stroke-[2.5px]" />
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Бронь подтверждена!
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {countdownInfo.countdownText}
            </p>
          </div>

          {/* Booking Summary Card */}
          <div className="bg-[#F8FAFC] border border-slate-100 rounded-2xl p-4 text-left space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-white text-slate-900 text-xs font-bold border border-slate-200/60 shadow-xs">
                {booking.sport === 'football' ? '⚽ Футбол' : '🏀 Баскетбол'}
              </span>
              <span className="text-xs font-bold text-[#00B050]">Оплачено</span>
            </div>

            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900 leading-snug">
                {booking.venueTitle}
              </h2>
              <p className="text-xs text-slate-400 font-medium">{booking.address}</p>
              <p className="text-xs text-slate-600 font-semibold pt-1">
                {formatDateDDMMYYYY(booking.date)}, {booking.timeSlot}
              </p>
            </div>
          </div>

          {/* Web Push Notification Prompt Banner */}
          {showNotificationPrompt && (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-2xl p-3.5 text-left space-y-2.5 shadow-xs animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-100/80 text-[#00B050] flex items-center justify-center shrink-0 mt-0.5">
                  <Bell className="w-4 h-4 stroke-[2.2px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-slate-900 text-xs block leading-tight">
                    Включите Web Push уведомления
                  </span>
                  <p className="text-[11px] text-slate-600 font-medium leading-relaxed pt-0.5">
                    Разрешите уведомления, чтобы мгновенно получать запросы от игроков со звуком и вибрацией
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleEnableNotifications}
                  disabled={isSubscribingPush}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#00B050] hover:bg-[#009644] text-white text-xs font-bold transition-all active:scale-98 shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubscribingPush ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Bell className="w-3.5 h-3.5" />
                  )}
                  <span>Разрешить</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowNotificationPrompt(false)}
                  className="py-2 px-3 rounded-xl bg-white/80 hover:bg-white text-slate-500 text-xs font-semibold border border-slate-200/60 transition-all cursor-pointer"
                >
                  Позже
                </button>
              </div>
            </div>
          )}

          {/* Quick Actions (Календарь & Поделиться) */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleAddToCalendar}
              className="py-3 px-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/60 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>Календарь</span>
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="py-3 px-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/60 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-slate-500" />
              <span>Поделиться</span>
            </button>
          </div>

          {/* Cancel Booking Button - Visible ONLY to creator / owner of booking */}
          {(!booking.isParticipant || booking.isHost) && onCancelBooking && (
            <button
              type="button"
              onClick={() => setIsConfirmCancelOpen(true)}
              className="w-full py-3 px-3 rounded-2xl bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 text-rose-600 hover:text-rose-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
            >
              <X className="w-4 h-4 stroke-[2.5px] text-rose-500" />
              <span>Отменить бронь</span>
            </button>
          )}

          {/* Opt-out / Leave Game Button - Visible ONLY to joined participants */}
          {booking.isParticipant && !booking.isHost && (
            <button
              type="button"
              onClick={() => setIsConfirmLeaveOpen(true)}
              className="w-full py-3 px-3 rounded-2xl bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-600 hover:text-rose-600 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
            >
              <X className="w-4 h-4 stroke-[2.5px] text-rose-500" />
              <span>Отказаться от участия</span>
            </button>
          )}

          {/* Unlock Error Card with Try Again & Proceed to Booking options */}
          {unlockErrorMessage && (
            <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-3.5 text-left space-y-2.5 animate-fade-in shadow-xs">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-rose-900 block leading-tight">
                    Не удалось открыть замок
                  </span>
                  <p className="text-[11px] text-rose-700 font-medium leading-relaxed pt-0.5">
                    {unlockErrorMessage}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleOpenVenueWithUnlock}
                  disabled={isUnlocking}
                  className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all active:scale-98 shadow-xs cursor-pointer text-center disabled:opacity-50"
                >
                  Попробовать снова
                </button>
                <button
                  type="button"
                  onClick={() => onOpenVenue(booking)}
                  className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200/80 transition-all cursor-pointer text-center"
                >
                  К экрану брони
                </button>
              </div>
            </div>
          )}

          {/* Bottom Unlock Button */}
          <div className="pt-2">
            {canOpenNow ? (
              <button
                type="button"
                disabled={isUnlocking}
                onClick={handleOpenVenueWithUnlock}
                className="w-full bg-[#00B050] hover:bg-[#009644] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-sm transition-all shadow-md shadow-[#00B050]/20 active:scale-98 cursor-pointer disabled:opacity-80"
              >
                {isUnlocking ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Открываем замок...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-5 h-5 stroke-[2.2px]" />
                    <span>Открыть площадку</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="w-full bg-[#F1F5F9] text-[#94A3B8] font-semibold py-4 rounded-2xl text-center text-xs cursor-not-allowed"
              >
                {countdownInfo.buttonText}
              </button>
            )}
          </div>
        </div>

        {/* Problem Form Modal Popup */}
        {isProblemModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in"
            onClick={() => setIsProblemModalOpen(false)}
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
                  onClick={() => setIsProblemModalOpen(false)}
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
                  <p className="text-xs text-slate-500">Наша служба поддержки уже работает над этим.</p>
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
                      onChange={(e) => setProblemText(e.target.value)}
                      placeholder="Не работает освещение, мусор на площадке, сломан замок..."
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

        {/* Confirmation Modal for Canceling Booking */}
        {isConfirmCancelOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in text-slate-900"
            onClick={() => setIsConfirmCancelOpen(false)}
          >
            <div
              className="w-full max-w-[380px] bg-white rounded-3xl p-6 shadow-2xl text-center space-y-4 animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 mx-auto rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900">
                  Отмена бронирования
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Вы уверены, что хотите отменить бронирование площадки на{' '}
                  <span className="font-semibold text-slate-800">
                    {booking.timeSlot}
                  </span>
                  ? Слот станет доступен для других игроков.
                </p>
              </div>
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (onCancelBooking) {
                      await onCancelBooking(booking.id);
                    }
                    setIsConfirmCancelOpen(false);
                    onClose();
                  }}
                  className="w-full bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold py-3.5 rounded-2xl text-xs transition-all shadow-md shadow-rose-500/20 active:scale-98 cursor-pointer"
                >
                  Да, отменить
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmCancelOpen(false)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-2xl text-xs transition-all active:scale-98 cursor-pointer"
                >
                  Оставить бронь
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal for Leaving / Opting out of Booking (Participants) */}
        {isConfirmLeaveOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in text-slate-900"
            onClick={() => setIsConfirmLeaveOpen(false)}
          >
            <div
              className="w-full max-w-[380px] bg-white rounded-3xl p-6 shadow-2xl text-center space-y-4 animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900">
                  Отказ от участия
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Вы уверены, что хотите отказаться от участия в игре на{' '}
                  <span className="font-semibold text-slate-800">
                    {booking.timeSlot}
                  </span>
                  ? Ваше место освободится для других участников.
                </p>
              </div>
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (onLeaveBooking) {
                      await onLeaveBooking(booking.id);
                    }
                    setIsConfirmLeaveOpen(false);
                    onClose();
                  }}
                  className="w-full bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold py-3.5 rounded-2xl text-xs transition-all shadow-md shadow-rose-500/20 active:scale-98 cursor-pointer"
                >
                  Да, отказаться
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmLeaveOpen(false)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-2xl text-xs transition-all active:scale-98 cursor-pointer"
                >
                  Остаться в игре
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
