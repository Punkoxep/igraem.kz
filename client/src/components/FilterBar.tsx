import React from 'react';
import { ChevronDown } from 'lucide-react';
import { SportType } from '../types';
import { Language, translations } from '../i18n/translations';

interface FilterBarProps {
  selectedSport: SportType;
  onSelectSport: (sport: SportType) => void;
  selectedDate: string;
  selectedTimeSlotsCount: number;
  onOpenDateModal: () => void;
  currentLang: Language;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  selectedSport,
  onSelectSport,
  selectedDate,
  selectedTimeSlotsCount,
  onOpenDateModal,
  currentLang,
}) => {
  const t = translations[currentLang];

  return (
    <div className="w-full pointer-events-auto px-4 py-3 flex items-center justify-between gap-3 bg-white border-t border-slate-200/80 box-border">
      {/* Animated Segment Control (Football / Basketball) */}
      <div className="bg-[#F1F5F9] p-1 rounded-2xl flex items-center w-[140px] shrink-0 border border-slate-200/80 relative overflow-hidden h-11">
        {/* Smooth Sliding Active Pill Background Indicator */}
        <div
          className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl bg-[#E8F8F0] border border-[#00B050] shadow-xs transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            selectedSport === 'football' ? 'left-1' : 'left-[calc(50%+2px)]'
          }`}
        />

        {/* Football Segment Button */}
        <button
          type="button"
          onClick={() => onSelectSport('football')}
          className={`relative z-10 flex-1 h-9 rounded-xl flex items-center justify-center gap-1 text-xs transition-colors duration-200 font-semibold active:scale-90 cursor-pointer ${
            selectedSport === 'football' ? 'text-[#00B050]' : 'text-slate-700 hover:text-slate-900'
          }`}
          title={t.football}
        >
          <span
            className={`text-base leading-none transform inline-block transition-transform duration-500 cubic-bezier(0.34,1.56,0.64,1) ${
              selectedSport === 'football'
                ? 'scale-120 rotate-[-25deg]'
                : 'scale-100 rotate-0 opacity-70 hover:opacity-100'
            }`}
          >
            ⚽
          </span>
        </button>

        {/* Basketball Segment Button */}
        <button
          type="button"
          onClick={() => onSelectSport('basketball')}
          className={`relative z-10 flex-1 h-9 rounded-xl flex items-center justify-center gap-1 text-xs transition-colors duration-200 font-semibold active:scale-90 cursor-pointer ${
            selectedSport === 'basketball' ? 'text-[#00B050]' : 'text-slate-700 hover:text-slate-900'
          }`}
          title={t.basketball}
        >
          <span
            className={`text-base leading-none transform inline-block transition-transform duration-500 cubic-bezier(0.34,1.56,0.64,1) ${
              selectedSport === 'basketball'
                ? 'scale-120 rotate-[25deg]'
                : 'scale-100 rotate-0 opacity-70 hover:opacity-100'
            }`}
          >
            🏀
          </span>
        </button>
      </div>

      {/* Date & Time Button Pill: "Сегодня ▾" */}
      <button
        type="button"
        onClick={onOpenDateModal}
        className="flex-1 min-w-0 h-11 bg-[#F1F5F9] hover:bg-slate-200/80 border border-slate-200/80 rounded-2xl px-3.5 flex items-center justify-between text-xs font-semibold text-slate-800 transition-all shadow-xs active:scale-98 cursor-pointer"
      >
        <span className="truncate pr-1">
          {selectedDate === 'Сегодня' ? t.today : selectedDate}
          {selectedTimeSlotsCount > 0 && (
            <span className="ml-1 text-[10px] text-[#00B050] font-bold">
              ({selectedTimeSlotsCount})
            </span>
          )}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
      </button>
    </div>
  );
};
