import React from 'react';
import { Map, FileText, MessageSquare, Heart, User } from 'lucide-react';
import { ActiveTab } from '../types';
import { Language, translations } from '../i18n/translations';

interface BottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  bookingsCount: number;
  requestsCount?: number;
  favoritesCount: number;
  currentLang: Language;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  bookingsCount,
  requestsCount = 0,
  favoritesCount,
  currentLang,
}) => {
  const t = translations[currentLang];

  const tabs = [
    { id: 'map' as ActiveTab, label: t.navMap, icon: Map, animationClass: 'animate-spring-pop' },
    { id: 'bookings' as ActiveTab, label: t.navBookings, icon: FileText, badge: bookingsCount, animationClass: 'animate-spring-pop' },
    { id: 'requests' as ActiveTab, label: t.navRequests, icon: MessageSquare, badge: requestsCount, animationClass: 'animate-spring-pop' },
    { id: 'favorites' as ActiveTab, label: t.navFavorites, icon: Heart, animationClass: 'animate-heartbeat' },
    { id: 'profile' as ActiveTab, label: t.navProfile, icon: User, animationClass: 'animate-spring-pop' },
  ];

  return (
    <nav className="shrink-0 w-full relative z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-1 py-2 grid grid-cols-5 shadow-lg">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`relative flex flex-col items-center justify-center gap-0.5 w-full py-1.5 rounded-2xl transition-colors duration-200 active:scale-95 ${
              isActive
                ? 'bg-[#E8F8F0]/90 text-[#00B050] font-bold shadow-xs border border-[#00B050]/20'
                : 'text-slate-400 hover:text-[#00B050] font-medium'
            }`}
          >
            {/* Animated Icon Container */}
            <div className="relative flex items-center justify-center">
              <div key={isActive ? `${tab.id}-active` : `${tab.id}-inactive`} className={isActive ? tab.animationClass : ''}>
                <Icon className={`w-5 h-5 transition-colors duration-200 ${isActive ? 'text-[#00B050] stroke-[2.5px] scale-110' : 'text-slate-400 stroke-[1.8px]'}`} />
              </div>

              {/* Badge for count (static, no blinking animation) */}
              {!!tab.badge && tab.badge > 0 && (
                <span className="absolute -top-1 -right-2.5 w-4 h-4 rounded-full bg-[#00B050] text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                  {tab.badge}
                </span>
              )}
            </div>

            {/* Label */}
            <span className={`text-[10px] tracking-tight text-center truncate w-full px-0.5 transition-colors duration-200 ${
              isActive ? 'font-black text-[#00B050] scale-105' : 'font-semibold text-slate-400'
            }`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
