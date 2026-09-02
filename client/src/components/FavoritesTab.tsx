import React from 'react';
import { Venue } from '../types';
import { Heart, Star, MapPin, ChevronRight } from 'lucide-react';

interface FavoritesTabProps {
  favoriteVenues: Venue[];
  onSelectVenue: (venue: Venue) => void;
  onRemoveFavorite: (venueId: string) => void;
}

export const FavoritesTab: React.FC<FavoritesTabProps> = ({
  favoriteVenues,
  onSelectVenue,
  onRemoveFavorite,
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50 text-slate-900 w-full animate-fade-in pb-24">
      {favoriteVenues.length === 0 ? (
        <div className="text-center py-16 space-y-3 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
            <Heart className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">Список избранного пуст</h2>
          <p className="text-xs text-slate-500">
            Нажмите на сердечко в карточке площадки, чтобы сохранить её
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {favoriteVenues.map((venue) => (
            <div
              key={venue.id}
              onClick={() => onSelectVenue(venue)}
              className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col space-y-3 relative cursor-pointer hover:border-slate-300 active:scale-[0.99] transition-all"
            >
              {/* Top Section: Tags, Rating & Heart Remove Button */}
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 pr-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-900 text-[10px] font-normal border border-slate-200/60">
                      {venue.sport === 'football' ? '⚽ Футбол' : '🏀 Баскетбол'}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">
                    {venue.title}
                  </h2>
                  <p className="flex items-center gap-1 text-xs text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-[#00B050] shrink-0" />
                    <span>{venue.address}</span>
                  </p>
                </div>

                {/* Remove from Favorite button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFavorite(venue.id);
                  }}
                  className="w-8 h-8 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-500 flex items-center justify-center shrink-0 transition-colors"
                  title="Удалить из избранного"
                >
                  <Heart className="w-4 h-4 fill-rose-500" />
                </button>
              </div>

              {/* Bottom Ghost Button matching "Мои брони" style */}
              <button
                type="button"
                onClick={() => onSelectVenue(venue)}
                className="w-full bg-[#E8F8F0] hover:bg-[#D2F2E2] text-[#00B050] font-bold py-2.5 px-4 rounded-2xl text-xs flex items-center justify-between transition-colors shadow-2xs active:scale-98"
              >
                <span>Выбрать слот</span>
                <ChevronRight className="w-4 h-4 stroke-[2.5px]" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
