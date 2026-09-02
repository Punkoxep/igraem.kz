import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, Clock, Check } from 'lucide-react';

interface DateFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  selectedTimeSlots: string[];
  onApply: (date: string, timeSlots: string[]) => void;
}

const getUpcomingDays = () => {
  const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const fullDayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  const days = [];
  const today = new Date();

  for (let i = 0; i < 6; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);

    let label = fullDayNames[d.getDay()];
    if (i === 0) label = 'Сегодня';
    if (i === 1) label = 'Завтра';

    const dateStr = `${dayNames[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]}`;

    days.push({
      label,
      date: dateStr,
      fullDateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    });
  }
  return days;
};

const TIME_SLOTS = [
  '09:00 - 10:00',
  '10:00 - 11:00',
  '11:00 - 12:00',
  '12:00 - 13:00',
  '14:00 - 15:00',
  '15:00 - 16:00',
  '16:00 - 17:00',
  '17:00 - 18:00',
  '18:00 - 19:00',
  '19:00 - 20:00',
  '20:00 - 21:00',
  '21:00 - 22:00',
];

export const DateFilterModal: React.FC<DateFilterModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  selectedTimeSlots,
  onApply,
}) => {
  const upcomingDays = React.useMemo(() => getUpcomingDays(), []);
  const [tempDate, setTempDate] = useState(selectedDate || 'Сегодня');
  const [tempSlots, setTempSlots] = useState<string[]>(selectedTimeSlots || []);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    const initialDate = selectedDate || 'Сегодня';
    setTempDate(initialDate);

    const isToday =
      initialDate === 'Сегодня' ||
      (upcomingDays[0] && (initialDate === upcomingDays[0].label || initialDate === upcomingDays[0].date));
    const now = new Date();
    const cStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const validSlots = (selectedTimeSlots || []).filter((slot) => {
      if (!isToday) return true;
      const end = slot.split('-')[1]?.trim() || '23:59';
      return cStr < end;
    });

    setTempSlots(validSlots);
  }, [isOpen, selectedDate, selectedTimeSlots, upcomingDays]);

  if (!isOpen) return null;

  const handleSelectDate = (label: string) => {
    setTempDate(label);
    const isToday =
      label === 'Сегодня' ||
      (upcomingDays[0] && (label === upcomingDays[0].label || label === upcomingDays[0].date));
    if (isToday) {
      const now = new Date();
      const cStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const validSlots = tempSlots.filter((slot) => {
        const end = slot.split('-')[1]?.trim() || '23:59';
        return cStr < end;
      });
      setTempSlots(validSlots);
    }
  };

  const toggleSlot = (slot: string) => {
    if (tempSlots.includes(slot)) {
      setTempSlots(tempSlots.filter((s) => s !== slot));
    } else {
      setTempSlots([...tempSlots, slot]);
    }
  };

  const handleSave = () => {
    onApply(tempDate, tempSlots);
    onClose();
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
        onClose(); // Swipe down detected -> close modal
      }
      touchStartY.current = null;
    }
  };

  const isTodaySelected =
    tempDate === 'Сегодня' ||
    (upcomingDays[0] && (tempDate === upcomingDays[0].label || tempDate === upcomingDays[0].date));

  const now = new Date();
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMins = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMins}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs animate-fade-in"
      onClick={onClose} // Click outside modal closes it
    >
      <div
        className="w-full max-w-[430px] bg-white border-t border-slate-200 rounded-t-3xl p-6 shadow-2xl space-y-5 animate-slide-up max-h-[85vh] overflow-y-auto mx-auto"
        onClick={(e) => e.stopPropagation()} // Prevent click inside modal from closing
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Swipe Handle Indicator */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto -mt-2 mb-1 cursor-grab" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
            <Calendar className="w-5 h-5 text-[#00B050]" />
            <h2>Выбор даты и времени</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Date Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Дата
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {upcomingDays.map((item) => {
              const isSelected = tempDate === item.label || tempDate === item.date;
              return (
                <button
                  key={item.date}
                  type="button"
                  onClick={() => handleSelectDate(item.label)}
                  className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center ${
                    isSelected
                      ? 'bg-[#E8F8F0] border-[#00B050] text-[#00B050] font-bold shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-xs font-bold">{item.label}</span>
                  <span className="text-[10px] text-slate-400">{item.date}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Multiple Selection Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#00B050]" />
              Временные слоты (множественный выбор)
            </label>
            {tempSlots.length > 0 && (
              <span className="text-[11px] font-bold text-[#00B050]">
                Выбрано: {tempSlots.length}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TIME_SLOTS.map((slot) => {
              const isSelected = tempSlots.includes(slot);
              const slotEnd = slot.split('-')[1]?.trim() || '23:59';
              const isPast = isTodaySelected && currentTimeStr >= slotEnd;

              if (isPast) {
                return (
                  <div
                    key={slot}
                    className="p-2.5 rounded-2xl border border-slate-100 bg-slate-100/60 text-slate-400 text-xs font-medium cursor-not-allowed flex items-center justify-between opacity-50 select-none"
                    title="Время уже прошло"
                  >
                    <span className="line-through decoration-slate-300">{slot}</span>
                    <span className="text-[10px] font-semibold text-slate-400">Прошло</span>
                  </div>
                );
              }

              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => toggleSlot(slot)}
                  className={`relative p-2.5 px-2 rounded-2xl border flex items-center justify-center text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-[#E8F8F0] border-[#00B050] text-[#00B050] font-bold shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="whitespace-nowrap text-center">{slot}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5px] text-[#00B050] absolute right-[2px] top-1/2 -translate-y-1/2" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setTempDate('Сегодня');
              setTempSlots([]);
            }}
            className="w-1/3 py-3.5 rounded-2xl border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-all"
          >
            Сбросить
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="w-2/3 py-3.5 rounded-2xl bg-[#00B050] hover:bg-[#009644] text-white text-xs font-bold transition-all shadow-md shadow-[#00B050]/20"
          >
            Показать площадки
          </button>
        </div>
      </div>
    </div>
  );
};
