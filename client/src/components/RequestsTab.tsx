import React, { useState } from 'react';
import { ChevronLeft, Check, X, Users, Clock } from 'lucide-react';
import { MyRequestItem, VenueIncomingRequests } from '../types';
import { Language, translations } from '../i18n/translations';
import { formatDateDDMMYYYY } from '../utils/date';

interface RequestsTabProps {
  myRequests: MyRequestItem[];
  incomingVenueRequests: VenueIncomingRequests[];
  onAcceptIncomingRequest: (venueId: string, requestId: string) => void;
  onDeclineIncomingRequest: (venueId: string, requestId: string) => void;
  currentLang: Language;
  initialSubTab?: 'my' | 'incoming';
}

export const RequestsTab: React.FC<RequestsTabProps> = ({
  myRequests,
  incomingVenueRequests,
  onAcceptIncomingRequest,
  onDeclineIncomingRequest,
  currentLang,
  initialSubTab,
}) => {
  const getInitialSubTab = (): 'my' | 'incoming' => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      const filter = params.get('filter');
      if (tab === 'incoming' || filter === 'incoming') return 'incoming';
      if (tab === 'my' || filter === 'my') return 'my';
    }
    return initialSubTab || 'my';
  };

  const [activeSubTab, setActiveSubTab] = useState<'my' | 'incoming'>(getInitialSubTab);
  const [selectedVenueForRequests, setSelectedVenueForRequests] = useState<VenueIncomingRequests | null>(null);
  const [processingRequestIds, setProcessingRequestIds] = useState<Set<string>>(new Set());
  const [dismissedRequestIds, setDismissedRequestIds] = useState<Set<string>>(new Set());

  const handleSubTabClick = (tab: 'my' | 'incoming') => {
    setActiveSubTab(tab);
    if (typeof window !== 'undefined' && window.location.pathname.toLowerCase().startsWith('/requests')) {
      const targetUrl = tab === 'incoming' ? '/requests?tab=incoming' : '/requests';
      window.history.replaceState({ tab: 'requests', subTab: tab }, '', targetUrl);
    }
  };

  const handleAccept = async (venueId: string, reqId: string) => {
    if (processingRequestIds.has(reqId)) return;
    setProcessingRequestIds((prev) => new Set(prev).add(reqId));
    setDismissedRequestIds((prev) => new Set(prev).add(reqId));
    try {
      await onAcceptIncomingRequest(venueId, reqId);
    } finally {
      setProcessingRequestIds((prev) => {
        const next = new Set(prev);
        next.delete(reqId);
        return next;
      });
    }
  };

  const handleDecline = async (venueId: string, reqId: string) => {
    if (processingRequestIds.has(reqId)) return;
    setProcessingRequestIds((prev) => new Set(prev).add(reqId));
    setDismissedRequestIds((prev) => new Set(prev).add(reqId));
    try {
      await onDeclineIncomingRequest(venueId, reqId);
    } finally {
      setProcessingRequestIds((prev) => {
        const next = new Set(prev);
        next.delete(reqId);
        return next;
      });
    }
  };

  React.useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    } else if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      const filter = params.get('filter');
      if (tab === 'incoming' || filter === 'incoming') {
        setActiveSubTab('incoming');
      } else if (tab === 'my' || filter === 'my') {
        setActiveSubTab('my');
      }
    }
  }, [initialSubTab]);

  const t = translations[currentLang];

  // Only show venues that have at least 1 pending request sent to them, with highest count at top
  const filteredIncomingVenueRequests = React.useMemo(() => {
    const list = incomingVenueRequests
      .map((v) => ({
        ...v,
        requests: (v.requests || []).filter((r) => !dismissedRequestIds.has(r.id) && r.status === 'pending'),
      }))
      .filter((v) => v.requests.length > 0);

    return [...list].sort((a, b) => b.requests.length - a.requests.length);
  }, [incomingVenueRequests, dismissedRequestIds]);

  // Helper for sport icon emoji
  const getSportEmoji = (sport: string) => (sport === 'basketball' ? '🏀' : '⚽');

  // Render detail view for specific venue's incoming requests (Screen 3)
  if (selectedVenueForRequests) {
    const foundVenue = incomingVenueRequests.find((v) => v.id === selectedVenueForRequests.id);
    const currentVenueData = foundVenue
      ? {
          ...foundVenue,
          requests: (foundVenue.requests || []).filter(
            (r) => !dismissedRequestIds.has(r.id) && r.status === 'pending'
          ),
        }
      : {
          ...selectedVenueForRequests,
          requests: (selectedVenueForRequests.requests || []).filter(
            (r) => !dismissedRequestIds.has(r.id) && r.status === 'pending'
          ),
        };

    const activeRequests = currentVenueData.requests;

    return (
      <div className="flex-1 flex flex-col min-h-0 bg-slate-50 text-slate-900 w-full animate-fade-in">
        {/* Top Sticky Header */}
        <div className="shrink-0 bg-white px-4 pt-3 pb-3 border-b border-slate-200/80 sticky top-0 z-10 w-full flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSelectedVenueForRequests(null)}
            className="flex items-center gap-1 bg-[#E8F8F0] text-[#00B050] px-3.5 py-1.5 rounded-full font-bold text-xs border border-[#00B050]/20 hover:bg-[#d5f5e3] active:scale-95 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
            <span>Назад</span>
          </button>
          <h2 className="text-base font-bold text-slate-900 tracking-tight pr-6">Запросы</h2>
          <div className="w-12" /> {/* Spacer */}
        </div>

        {/* Content list with 16px side padding */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-3.5 w-full">
          {/* Venue Info Header summary */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-1 w-full">
            <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-900 text-[10px] font-normal border border-slate-200/60">
              {currentVenueData.sport === 'football' ? '⚽ Футбол' : '🏀 Баскетбол'}
            </span>
            <h3 className="text-base font-bold text-slate-900 leading-snug">
              {currentVenueData.venueTitle}
            </h3>
            <p className="text-xs text-slate-400 font-medium">{currentVenueData.address}</p>
            <p className="text-xs text-slate-500 font-medium">{formatDateDDMMYYYY(currentVenueData.date)}, {currentVenueData.timeSlot}</p>
          </div>

          {/* List of Incoming User Requests for this venue */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden w-full">
            {activeRequests.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs font-medium space-y-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#E8F8F0] text-[#00B050] flex items-center justify-center">
                  <Check className="w-6 h-6 stroke-[2.5]" />
                </div>
                <p className="font-bold text-slate-800 text-sm">Вам пока не присылали запросов</p>
                <p className="text-slate-400 text-xs">
                  Все входящие заявки по данной брони обработаны.
                </p>
              </div>
            ) : (
              activeRequests.map((req) => (
                <div key={req.id} className="p-4 flex flex-col gap-2.5 w-full">
                  {/* User Name and Phone on top row */}
                  <div className="w-full">
                    <span className="text-sm font-bold text-slate-900 leading-snug break-words block">
                      {req.userName}
                    </span>
                    {req.userPhone && (
                      <span className="text-xs text-slate-400 font-medium block">
                        {req.userPhone}
                      </span>
                    )}
                  </div>

                  {/* Actions / Status on bottom row */}
                  <div className="flex items-center justify-end gap-3 w-full">
                    <button
                      type="button"
                      disabled={processingRequestIds.has(req.id)}
                      onClick={() => handleDecline(currentVenueData.id, req.id)}
                      className="text-red-500 hover:text-red-600 font-bold text-xs px-2.5 py-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {processingRequestIds.has(req.id) ? '...' : 'Отклонить'}
                    </button>
                    <button
                      type="button"
                      disabled={processingRequestIds.has(req.id)}
                      onClick={() => handleAccept(currentVenueData.id, req.id)}
                      className="text-[#00B050] hover:text-[#009040] font-bold text-xs px-2.5 py-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {processingRequestIds.has(req.id) ? '...' : 'Принять'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 text-slate-900 w-full animate-fade-in">
      {/* Top Segmented Control Switcher (Exact style from BookingsTab) */}
      <div className="shrink-0 bg-white px-4 pt-3 pb-3 border-b border-slate-200/80 sticky top-0 z-10 w-full">
        <div className="relative bg-[#F8FAFC] border border-slate-200/80 p-1 rounded-2xl flex items-center h-11">
          {/* Animated Sliding Pill Indicator */}
          <div
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-xs border border-slate-200/60 transition-all duration-300 ease-out ${
              activeSubTab === 'my' ? 'left-1' : 'left-[calc(50%+2px)]'
            }`}
          />

          <button
            type="button"
            onClick={() => handleSubTabClick('my')}
            className={`relative z-10 flex-1 h-9 px-2 text-xs text-center flex items-center justify-center transition-colors duration-200 ${
              activeSubTab === 'my'
                ? 'text-[#00B050] font-semibold'
                : 'text-slate-500 font-semibold hover:text-slate-900'
            }`}
          >
            Мои запросы
          </button>
          <button
            type="button"
            onClick={() => handleSubTabClick('incoming')}
            className={`relative z-10 flex-1 h-9 px-2 text-xs text-center flex items-center justify-center transition-colors duration-200 ${
              activeSubTab === 'incoming'
                ? 'text-[#00B050] font-semibold'
                : 'text-slate-500 font-semibold hover:text-slate-900'
            }`}
          >
            Запросы мне
          </button>
        </div>
      </div>

      {/* Main Content List with 16px side padding */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-3.5 w-full">
        {/* SUB-TAB 1: "Мои запросы" */}
        {activeSubTab === 'my' && (
          <>
            {myRequests.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center space-y-2 shadow-xs w-full">
                <Clock className="w-10 h-10 text-slate-300 mx-auto stroke-1.5" />
                <p className="text-slate-800 font-bold text-sm">У вас нет отправленных запросов</p>
                <p className="text-slate-500 text-xs">
                  Когда вы выбираете занятый слот на площадке и нажимаете «Присоединиться», ваши запросы появляются здесь.
                </p>
              </div>
            ) : (
              myRequests.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-2.5 shadow-xs hover:shadow-sm transition-all w-full"
                >
                  <div className="space-y-1">
                    <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-900 text-[10px] font-normal border border-slate-200/60">
                      {item.sport === 'football' ? '⚽ Футбол' : '🏀 Баскетбол'}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {item.venueTitle}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">{item.address}</p>
                    <p className="text-xs text-slate-500 font-medium">
                      {formatDateDDMMYYYY(item.date)}, {item.timeSlot}
                    </p>
                  </div>

                  <div className="pt-1">
                    {item.status === 'pending' && (
                      <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-3 py-1 rounded-full border border-slate-200/80 inline-flex items-center gap-1">
                        В ожидании
                      </span>
                    )}
                    {item.status === 'confirmed' && (
                      <span className="bg-[#E8F8F0] text-[#00B050] text-xs font-bold px-3 py-1 rounded-full border border-[#00B050]/20 inline-flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        Подтверждено
                      </span>
                    )}
                    {item.status === 'declined' && (
                      <span className="bg-red-50 text-red-500 text-xs font-semibold px-3 py-1 rounded-full border border-red-200/60 inline-flex items-center gap-1">
                        <X className="w-3 h-3 stroke-[2.5]" />
                        Отклонено
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* SUB-TAB 2: "Запросы мне" */}
        {activeSubTab === 'incoming' && (
          <>
            {filteredIncomingVenueRequests.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center space-y-2 shadow-xs w-full">
                <Users className="w-10 h-10 text-slate-300 mx-auto stroke-1.5" />
                <p className="text-slate-800 font-bold text-sm">Вам пока не присылали запросов</p>
                <p className="text-slate-500 text-xs">
                  Когда другие игроки захотят присоединиться к вашей брони на площадке, их запросы отобразятся здесь.
                </p>
              </div>
            ) : (
              filteredIncomingVenueRequests.map((venueReq) => {
                const pendingCount = venueReq.requests.filter((r) => r.status === 'pending').length;
                const acceptedCount =
                  venueReq.joinedCount !== undefined
                    ? venueReq.joinedCount
                    : venueReq.requests.filter((r) => r.status === 'accepted').length;

                const getJoinedText = (count: number) => {
                  if (count === 1) return `Присоединился: ${count} человек`;
                  if (count >= 2 && count <= 4) return `Присоединились: ${count} человека`;
                  return `Присоединились: ${count} человек`;
                };

                return (
                  <div
                    key={venueReq.id}
                    onClick={() => setSelectedVenueForRequests(venueReq)}
                    className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs hover:border-slate-300 active:scale-[0.99] transition-all flex items-center justify-between cursor-pointer w-full"
                  >
                    <div className="space-y-1 pr-3 min-w-0 flex-1">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-900 text-[10px] font-normal border border-slate-200/60">
                        {venueReq.sport === 'football' ? '⚽ Футбол' : '🏀 Баскетбол'}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 leading-snug truncate">
                        {venueReq.venueTitle}
                      </h3>
                      <p className="text-xs text-slate-400 font-medium truncate">{venueReq.address}</p>
                      <p className="text-xs text-slate-500 font-medium truncate">
                        {formatDateDDMMYYYY(venueReq.date)}, {venueReq.timeSlot}
                      </p>
                      <p className="text-xs text-[#00B050] font-semibold truncate pt-0.5">
                        {getJoinedText(acceptedCount)}
                      </p>
                    </div>

                    {pendingCount > 0 && (
                      <div className="w-7 h-7 rounded-full bg-[#00B050] text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0">
                        {pendingCount}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
};
