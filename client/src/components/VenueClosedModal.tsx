import React, { useEffect } from 'react';
import { SportType } from '../types';

interface VenueClosedModalProps {
  isOpen: boolean;
  onClose: () => void;
  sport?: SportType;
}

export const VenueClosedModal: React.FC<VenueClosedModalProps> = ({
  isOpen,
  onClose,
  sport = 'football',
}) => {
  // Auto-close after 5 seconds as requested
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isFootball = sport === 'football';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[390px] bg-white rounded-3xl p-6 shadow-2xl text-center space-y-4 animate-fade-in text-slate-900 overflow-hidden relative border border-slate-100 mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Light Theme Animated Sports Field Illustration Header */}
        <div className="relative w-full h-36 rounded-2xl overflow-hidden bg-gradient-to-b from-[#E8F8F0] via-[#D2F2E2]/60 to-[#F8FAFC] flex items-center justify-center border border-[#00B050]/20 shadow-inner">
          {/* Subtle Ambient Pulsing Glow */}
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#00B050]/20 via-transparent to-transparent animate-pulse" />

          {/* SVG Pitch / Court Lines in Clean Green */}
          <svg className="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 200 120" fill="none">
            {/* Field boundary */}
            <rect x="10" y="10" width="180" height="100" rx="4" stroke="#00B050" strokeWidth="1.5" />
            {/* Center line */}
            <line x1="100" y1="10" x2="100" y2="110" stroke="#00B050" strokeWidth="1.5" strokeDasharray="3 3" />
            {/* Center circle */}
            <circle cx="100" cy="60" r="22" stroke="#00B050" strokeWidth="1.5" />
            {/* Goal boxes */}
            <rect x="10" y="30" width="25" height="60" stroke="#00B050" strokeWidth="1" />
            <rect x="165" y="30" width="25" height="60" stroke="#00B050" strokeWidth="1" />
          </svg>

          {/* Center Animated Bouncing Ball Emblem */}
          <div className="relative z-10 flex flex-col items-center justify-center gap-1.5">
            <div className="w-14 h-14 rounded-full bg-white border-2 border-[#00B050] flex items-center justify-center text-2xl shadow-lg shadow-[#00B050]/20 animate-spring-pop">
              <span>{isFootball ? '⚽' : '🏀'}</span>
            </div>
            <div className="w-10 h-1.5 rounded-full bg-[#00B050]/20 blur-xs animate-pulse" />
          </div>
        </div>

        {/* Title & Body matching light theme design system */}
        <div className="space-y-1.5 pt-1">
          <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
            Площадка закрыта
          </h3>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Надеемся что вы сегодня отлично поиграли
          </p>
        </div>

        {/* Bottom Button "Понятно" */}
        <button
          type="button"
          onClick={onClose}
          className="w-full bg-[#00B050] hover:bg-[#009644] text-white font-bold py-3.5 rounded-2xl text-xs transition-all shadow-md shadow-[#00B050]/20 active:scale-98"
        >
          Понятно
        </button>

        {/* Subtle auto-close countdown indicator */}
        <p className="text-[10px] text-slate-400 font-medium">
          Окно закроется автоматически через 5 сек
        </p>
      </div>
    </div>
  );
};
