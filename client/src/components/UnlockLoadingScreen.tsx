import React, { useState, useEffect } from 'react';
import { ShieldCheck, Wifi, DoorOpen } from 'lucide-react';
import { Booking } from '../types';

interface UnlockLoadingScreenProps {
  booking: Booking;
  onComplete: () => void;
}

export const UnlockLoadingScreen: React.FC<UnlockLoadingScreenProps> = ({
  onComplete,
}) => {
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    // Stage 1 -> Stage 2 at 1000ms
    const timer1 = setTimeout(() => {
      setStage(2);
      setProgress(55);
    }, 1000);

    // Stage 2 -> Stage 3 at 2200ms
    const timer2 = setTimeout(() => {
      setStage(3);
      setProgress(90);
    }, 2200);

    // Complete & open screen at 3200ms
    const timer3 = setTimeout(() => {
      setProgress(100);
      onComplete();
    }, 3200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in text-slate-900 min-w-[360px]">
      <div className="w-full max-w-[340px] bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl text-center space-y-6 animate-fade-in relative overflow-hidden">
        {/* Ambient Radial Glow */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#00B050]/20 via-transparent to-transparent pointer-events-none animate-pulse" />

        {/* Animated Smart Lock Icon & Rings */}
        <div className="relative z-10 w-36 h-36 mx-auto flex items-center justify-center pt-2">
          {/* Outer Pulsing Wave Rings */}
          <div className="absolute inset-0 rounded-full border border-[#00B050]/30 animate-ping" />
          <div
            className="absolute inset-3 rounded-full border-2 border-dashed border-[#00B050]/40 animate-spin"
            style={{ animationDuration: '8s' }}
          />

          {/* Central Glowing Icon Emblem */}
          <div className="relative w-24 h-24 rounded-full bg-[#E8F8F0] border-2 border-[#00B050] flex items-center justify-center text-[#00B050] shadow-lg shadow-[#00B050]/20 animate-spring-pop">
            {stage === 1 && <ShieldCheck className="w-10 h-10 animate-pulse stroke-[2.2px]" />}
            {stage === 2 && <Wifi className="w-10 h-10 animate-bounce stroke-[2.2px]" />}
            {stage === 3 && <DoorOpen className="w-10 h-10 animate-pulse stroke-[2.2px]" />}
          </div>
        </div>

        {/* Dynamic Status Title Only */}
        <div className="relative z-10 py-1">
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight animate-fade-in">
            {stage === 1 && 'Проверка бронирования и GPS...'}
            {stage === 2 && 'Отправка сигнала на смарт-замок...'}
            {stage === 3 && 'Разблокировка двери площадки...'}
          </h3>
        </div>

        {/* Progress Bar */}
        <div className="relative z-10 pb-1">
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-200/80">
            <div
              className="h-full bg-[#00B050] rounded-full transition-all duration-700 ease-out shadow-xs shadow-[#00B050]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
