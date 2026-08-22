import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const iconSizeClass = size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-9 h-9' : 'w-7 h-7';
  const textSizeClass = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-base';

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      {/* Green Map Pin with Play Triangle inside matching user uploaded logo */}
      <div className={`${iconSizeClass} shrink-0 flex items-center justify-center`}>
        <svg
          className="w-full h-full"
          viewBox="0 0 32 38"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Map Pin Path */}
          <path
            d="M16 0C7.16344 0 0 7.16344 0 16C0 26.5 13.5 35.8 15.2 37.1C15.7 37.5 16.3 37.5 16.8 37.1C18.5 35.8 32 26.5 32 16C32 7.16344 24.8366 0 16 0Z"
            fill="#00B050"
          />
          {/* White Play Triangle */}
          <path
            d="M12.5 10.5V21.5L21.5 16L12.5 10.5Z"
            fill="white"
          />
        </svg>
      </div>

      {/* Brand Text: IGRAEM (Black) + .KZ (Green) */}
      <div className={`flex items-baseline font-black tracking-tight leading-none text-slate-900 ${textSizeClass}`}>
        <span className="font-black text-black tracking-tight">IGRAEM</span>
        <span className="font-black text-[#00B050] tracking-tight">.KZ</span>
      </div>
    </div>
  );
};
