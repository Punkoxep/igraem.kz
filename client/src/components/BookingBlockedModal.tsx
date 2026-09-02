import React from 'react';
import { X } from 'lucide-react';
import { Language, translations } from '../i18n/translations';

interface BookingBlockedModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string | null;
  blockedUntil?: string | null;
  currentLang?: Language;
}

export const BookingBlockedModal: React.FC<BookingBlockedModalProps> = ({
  isOpen,
  onClose,
  reason,
  blockedUntil,
  currentLang = 'ru',
}) => {
  if (!isOpen) return null;

  const t = translations[currentLang]?.bookingRestricted || {
    title: 'Бронирование ограничено',
    desc: 'Доступ к бронированию приостановлен за нарушение правил площадки (неявка/опоздание).',
    until: 'Действует до:',
    modalTitle: 'Ваш аккаунт временно заблокирован',
    modalDesc: 'Вы не можете забронировать этот слот из-за несоблюдения регламента посещения.',
    reasonLabel: 'Причина блокировки:',
    defaultReason: 'Неявка или опоздание на забронированное время (нарушение правил площадки)',
    gotItButton: 'Понятно',
  };

  const formatBlockedDate = (isoStr?: string | null) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}.${month}.${year}, ${hours}:${minutes}`;
    } catch {
      return isoStr;
    }
  };

  const formattedDate = formatBlockedDate(blockedUntil);
  const displayReason = reason || t.defaultReason;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center space-y-4 animate-scale-up relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Icon Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Red Circle with White Cross Error Badge */}
        <div className="w-16 h-16 rounded-full bg-rose-50 border-4 border-rose-100 flex items-center justify-center shadow-xs">
          <div className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center text-white shadow-sm">
            <X className="w-6 h-6 stroke-[3px]" />
          </div>
        </div>

        {/* Title */}
        <div>
          <h3 className="text-xl font-black text-[#0F172A] tracking-tight leading-snug">
            {t.modalTitle || 'Ваш аккаунт временно заблокирован'}
          </h3>
        </div>

        {/* Red / Rose Alert Box with Expiration Date and Reason */}
        <div className="w-full bg-red-50 border border-red-200 rounded-2xl p-4 text-center shadow-xs">
          {formattedDate && (
            <div className="text-sm font-semibold text-red-900 mb-4 leading-snug">
              <span>{t.until || 'Действует до:'} </span>
              <span className="font-bold">{formattedDate}</span>
            </div>
          )}
          <div className="text-sm font-semibold text-red-900 mb-1">
            {t.reasonLabel || 'Причина блокировки:'}
          </div>
          <div className="text-sm font-normal text-red-900 leading-relaxed">
            {displayReason}
          </div>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full h-12 bg-[#00B050] hover:bg-[#009644] active:scale-98 text-white rounded-2xl font-bold text-sm shadow-md shadow-[#00B050]/20 transition-all cursor-pointer"
        >
          {t.gotItButton || 'Понятно'}
        </button>
      </div>
    </div>
  );
};