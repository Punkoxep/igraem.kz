import React, { useState, useEffect } from 'react';
import { ShieldAlert, Phone, Mail, Send, X, Check } from 'lucide-react';

import { Logo } from './Logo';

interface BannedUserScreenProps {
  onUnbanForDemo?: () => void;
}

export const BannedUserScreen: React.FC<BannedUserScreenProps> = ({
  onUnbanForDemo,
}) => {
  // Ban countdown timer: 2 days, 23 hours, 54 mins, 30 secs
  const [secondsRemaining, setSecondsRemaining] = useState(
    2 * 24 * 3600 + 23 * 3600 + 54 * 60 + 30
  );

  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [supportMessage, setSupportMessage] = useState('');
  const [messageSent, setMessageSent] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format days, hours, minutes
  const days = Math.floor(secondsRemaining / (24 * 3600));
  const hours = Math.floor((secondsRemaining % (24 * 3600)) / 3600);
  const mins = Math.floor((secondsRemaining % 3600) / 60);

  const handleSendSupportMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportMessage.trim()) return;
    setMessageSent(true);
    setTimeout(() => {
      setMessageSent(false);
      setIsSupportModalOpen(false);
      setSupportMessage('');
    }, 1800);
  };

  return (
    <div className="flex-1 w-full bg-slate-50 text-slate-900 flex flex-col justify-between p-4 sm:p-6 animate-fade-in overflow-y-auto">
      {/* Header bar matching app header */}
      <div className="w-full flex items-center justify-between pt-2 pb-2">
        <Logo size="md" />
        {onUnbanForDemo && (
          <button
            type="button"
            onClick={onUnbanForDemo}
            className="text-[11px] text-slate-400 underline hover:text-[#00B050] font-medium cursor-pointer"
          >
            [Тест: Разблокировать]
          </button>
        )}
      </div>

      {/* Main Content Card in App Light Styling */}
      <div className="w-full my-auto bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm text-center space-y-5 animate-slide-up">
        {/* Shield Icon Emblem */}
        <div className="w-16 h-16 mx-auto rounded-full bg-rose-50 border border-rose-100 text-rose-500 flex items-center justify-center shadow-xs">
          <ShieldAlert className="w-8 h-8 stroke-[2.2px]" />
        </div>

        {/* Status Badge & Title */}
        <div className="space-y-2">
          <div className="inline-block px-3 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-200/60 text-[11px] font-bold">
            Доступ ограничен
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Ваш аккаунт заблокирован
          </h1>
          <p className="text-xs text-slate-500 font-medium leading-relaxed px-1">
            Вы не освободили площадку вовремя (в течение 5 минут после завершения бронирования). Доступ к сервису временно приостановлен.
          </p>
        </div>

        {/* Countdown Box */}
        <div className="bg-[#F8FAFC] border border-slate-200/80 rounded-2xl p-4 text-center space-y-1">
          <span className="text-[11px] font-medium text-slate-400 block">
            До окончания блокировки осталось
          </span>
          <div className="text-xl font-bold text-rose-500 tracking-tight flex items-center justify-center gap-1.5">
            <span>{days} дн</span>
            <span className="text-slate-300">:</span>
            <span>{hours} ч</span>
            <span className="text-slate-300">:</span>
            <span>{mins} мин</span>
          </div>
        </div>

        {/* Reason Box */}
        <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-4 text-left space-y-1">
          <span className="text-xs font-bold text-rose-600 block">Причина блокировки:</span>
          <p className="text-xs text-slate-600 leading-relaxed font-normal">
            Превышение отведенного времени нахождения на площадке после окончания брони.
          </p>
        </div>
      </div>

      {/* Bottom Action Button matching app design system */}
      <div className="w-full max-w-[420px] mx-auto pb-4 pt-2">
        <button
          type="button"
          onClick={() => setIsSupportModalOpen(true)}
          className="w-full bg-[#00B050] hover:bg-[#009644] text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs shadow-md shadow-[#00B050]/20 transition-all cursor-pointer active:scale-98"
        >
          <Mail className="w-4 h-4" />
          <span>Связаться с техподдержкой</span>
        </button>
      </div>

      {/* Contact Support Modal Dialog */}
      {isSupportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in text-slate-900"
          onClick={() => setIsSupportModalOpen(false)}
        >
          <div
            className="w-full max-w-[380px] bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl space-y-4 animate-fade-in text-left relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Close Button */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">Служба поддержки</h2>
              <button
                type="button"
                onClick={() => setIsSupportModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {messageSent ? (
              <div className="py-6 text-center space-y-2.5">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#E8F8F0] text-[#00B050] flex items-center justify-center border border-[#00B050]/20">
                  <Check className="w-6 h-6 stroke-[2.5px]" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Обращение отправлено</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Наш оператор свяжется с вами по указанному телефону в ближайшее время.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSendSupportMessage} className="space-y-3">
                <span className="text-[11px] font-medium text-slate-400 block">
                  Написать обращение
                </span>
                <textarea
                  rows={4}
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  placeholder="Опишите проблему или причину задержки..."
                  required
                  className="w-full bg-[#F8FAFC] border border-slate-200/80 focus:border-[#00B050] focus:bg-white rounded-2xl p-3 text-xs text-slate-900 outline-none transition-all resize-none"
                />
                <button
                  type="submit"
                  className="w-full bg-[#00B050] hover:bg-[#009644] text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs shadow-md shadow-[#00B050]/20 transition-all cursor-pointer active:scale-98"
                >
                  <Send className="w-4 h-4" />
                  <span>Отправить</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
