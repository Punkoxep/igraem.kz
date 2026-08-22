import React, { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { CityName } from '../types';
import { Language, translations } from '../i18n/translations';

import { Logo } from './Logo';

interface HeaderProps {
  currentCity: CityName;
  onSelectCity: (city: CityName) => void;
  currentLang: Language;
}

const CITIES: CityName[] = ['Темиртау', 'Караганды', 'Астана', 'Алматы'];

export const Header: React.FC<HeaderProps> = ({ currentCity, onSelectCity, currentLang }) => {
  const [isOpen, setIsOpen] = useState(false);
  const t = translations[currentLang];

  return (
    <header className="shrink-0 w-full relative z-30 px-4 pt-4 pb-3 bg-white flex items-center justify-between pointer-events-auto border-b border-slate-200/80 shadow-xs">
      {/* Brand Logo with Green Map Pin and Play Triangle */}
      <Logo size="md" />

      {/* City Selector Pill Button - rounded-2xl matching date/time filter button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 bg-[#F8FAFC] hover:bg-slate-100 text-slate-800 px-3.5 py-2 rounded-2xl border border-slate-200/80 shadow-xs transition-all text-xs font-semibold active:scale-98"
        >
          <span>{currentCity}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 top-11 w-44 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 animate-fade-in">
              <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
                {t.selectCity}
              </div>
              <div className="py-1 space-y-0.5">
                {CITIES.map((city) => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => {
                      onSelectCity(city);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-2xl transition-all ${
                      currentCity === city
                        ? 'bg-[#E8F8F0] text-[#00B050] font-semibold border border-[#00B050]/20'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{city}</span>
                    {currentCity === city && <Check className="w-4 h-4 text-[#00B050]" />}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
};
