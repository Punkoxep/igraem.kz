import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { Header } from './components/Header';
import { MapView } from './components/MapView';
import { FilterBar } from './components/FilterBar';
import { DateFilterModal } from './components/DateFilterModal';
import { VenueCardModal } from './components/VenueCardModal';
import { BookingSuccessScreen } from './components/BookingSuccessScreen';
import { BookingsTab } from './components/BookingsTab';
import { VenueOpenedScreen } from './components/VenueOpenedScreen';
import { FavoritesTab } from './components/FavoritesTab';
import { ProfileTab } from './components/ProfileTab';
import { RequestsTab } from './components/RequestsTab';
import { BottomNav } from './components/BottomNav';
import { VenueClosedModal } from './components/VenueClosedModal';
import { UnlockLoadingScreen } from './components/UnlockLoadingScreen';
import { BannedUserScreen } from './components/BannedUserScreen';
import { ResetPasswordScreen } from './components/ResetPasswordScreen';

import { CityName, SportType, Venue, TimeSlot, Booking, ActiveTab, MyRequestItem, VenueIncomingRequests } from './types';
import { INITIAL_VENUES } from './data/venuesData';
import { Language } from './i18n/translations';
import { api, UserProfile } from './services/api';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export const App: React.FC = () => {
  // Auth & Ban state
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(api.getToken()));
  const [isBanned, setIsBanned] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userPhone, setUserPhone] = useState('');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Dynamic Venues state
  const [venues, setVenues] = useState<Venue[]>(INITIAL_VENUES);

  // i18n Language state
  const [currentLang, setCurrentLang] = useState<Language>('ru');

  // Navigation & Location - initialize state from current URL
  const getTabFromLocation = (): ActiveTab => {
    if (typeof window === 'undefined') return 'map';
    const path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
    const params = new URLSearchParams(window.location.search);

    if (path === '/bookings' || path.startsWith('/bookings/') || params.has('id') || params.has('bookingid')) {
      return 'bookings';
    }
    if (path === '/requests' || path.startsWith('/requests/')) {
      return 'requests';
    }
    if (path === '/favorites' || path.startsWith('/favorites/')) {
      return 'favorites';
    }
    if (path === '/profile' || path.startsWith('/profile/')) {
      return 'profile';
    }
    return 'map';
  };

  const getRequestsSubTabFromLocation = (): 'my' | 'incoming' => {
    if (typeof window === 'undefined') return 'my';
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const filter = params.get('filter');
    if (tab === 'incoming' || filter === 'incoming') return 'incoming';
    return 'my';
  };

  const [currentCity, setCurrentCity] = useState<CityName>('Темиртау');
  const [activeTab, setActiveTab] = useState<ActiveTab>(getTabFromLocation);

  // Filters - Football active by default
  const [selectedSport, setSelectedSport] = useState<SportType>('football');
  const [selectedDate, setSelectedDate] = useState<string>('Сегодня');
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);

  // Selected Venue for Slot Modal
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);

  // Favorites (empty array by default)
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  // Bookings state (populated strictly from API / PostgreSQL DB)
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Browser GPS Geolocation state
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Requests state (clean empty array by default, loaded from API)
  const [myRequests, setMyRequests] = useState<MyRequestItem[]>([]);
  const [incomingVenueRequests, setIncomingVenueRequests] = useState<VenueIncomingRequests[]>([]);
  const [requestsSubTab, setRequestsSubTab] = useState<'my' | 'incoming'>(getRequestsSubTabFromLocation);

  // Handle Tab changes with URL synchronization (updates browser address bar & history)
  const handleTabChange = useCallback((newTab: ActiveTab, subTab?: 'my' | 'incoming') => {
    setActiveTab(newTab);
    if (newTab === 'requests') {
      const chosenSubTab = subTab || requestsSubTab;
      setRequestsSubTab(chosenSubTab);
    }

    if (typeof window !== 'undefined') {
      let targetPath = '/';
      if (newTab === 'bookings') targetPath = '/bookings';
      else if (newTab === 'requests') targetPath = (subTab || requestsSubTab) === 'incoming' ? '/requests?tab=incoming' : '/requests';
      else if (newTab === 'favorites') targetPath = '/favorites';
      else if (newTab === 'profile') targetPath = '/profile';

      const currentFull = window.location.pathname + window.location.search;
      if (currentFull !== targetPath && (targetPath !== '/' || (window.location.pathname !== '/' && window.location.pathname !== ''))) {
        window.history.pushState({ tab: newTab }, '', targetPath);
      }
    }
  }, [requestsSubTab]);

  // Synchronize on browser Back / Forward buttons & PopState events
  useEffect(() => {
    const handlePopState = () => {
      const tab = getTabFromLocation();
      setActiveTab(tab);
      if (tab === 'requests') {
        setRequestsSubTab(getRequestsSubTabFromLocation());
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch grounds from API
  const fetchGrounds = useCallback(async () => {
    try {
      const res = await api.getGrounds();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        const mappedVenues: Venue[] = res.data.map((g: any) => ({
          id: g.id,
          title: g.name || g.title || 'Площадка',
          sport: (g.type || g.sport_type || 'football').toLowerCase() as any,
          city: (g.city || 'Темиртау') as CityName,
          lat: g.latitude ? Number(g.latitude) : 50.060371,
          lng: g.longitude ? Number(g.longitude) : 72.993374,
          address: g.address || '',
          rating: g.rating !== undefined && g.rating !== null ? Number(g.rating) : 0.0,
          images: g.images && g.images.length > 0 ? g.images : (g.type === 'basketball' ? ['https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80'] : ['https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80']),
          description: g.description || 'Оборудованная спортивная площадка с покрытием.',
          amenities: g.amenities || ['Освещение', 'Искусственный газон', 'Электронный замок TTLock'],
          workingHours: g.working_hours || '08:00 - 23:00',
          surface: g.surface || 'Искусственная трава',
          slots: [
            { id: 's1', time: '17:00 – 18:00', isAvailable: true },
            { id: 's2', time: '18:00 – 19:00', isAvailable: true },
            { id: 's3', time: '19:00 – 20:00', isAvailable: true },
          ],
          occupiedSlots: g.occupied_slots || [],
        }));
        setVenues(mappedVenues);
      }
    } catch (err) {
      console.warn('[App] fetchGrounds error:', err);
    }
  }, []);

  // Fetch user's real bookings from PostgreSQL DB via API
  const fetchMyBookings = useCallback(async () => {
    try {
      const res = await api.getMyBookings();
      if (res.success && res.data) {
        const hosted = res.data.hosted || [];
        const joined = res.data.joined || [];
        const rawList = [...hosted, ...joined];

        const now = new Date();
        const curYear = now.getFullYear();
        const curMonth = String(now.getMonth() + 1).padStart(2, '0');
        const curDay = String(now.getDate()).padStart(2, '0');
        const todayIso = `${curYear}-${curMonth}-${curDay}`;
        const todayDot = `${curDay}.${curMonth}.${curYear}`;

        const mapped: Booking[] = rawList.map((b: any) => {
          const dateStr = b.booking_date || todayDot;
          const sTime = b.start_time || '18:00';
          const eTime = b.end_time || '19:00';

          const [sH, sM] = sTime.split(':').map(Number);
          const [eH, eM] = eTime.split(':').map(Number);

          let bDate = new Date();
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const [y, m, d] = dateStr.split('-').map(Number);
            bDate = new Date(y, m - 1, d);
          } else if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
            const [d, m, y] = dateStr.split('.').map(Number);
            bDate = new Date(y, m - 1, d);
          }

          const startMs = new Date(bDate).setHours(sH || 0, sM || 0, 0, 0);
          const endMs = new Date(bDate).setHours(eH || 0, eM || 0, 0, 0);
          const nowMs = Date.now();

          const isPast = b.status === 'completed' || b.status === 'cancelled' || b.status === 'cancelled_no_show' || nowMs >= endMs;
          const isOngoing = !isPast && (b.is_door_opened || (nowMs >= startMs - 10 * 60 * 1000));

          let status: 'upcoming' | 'active' | 'completed' = 'upcoming';
          if (isPast) {
            status = 'completed';
          } else if (isOngoing) {
            status = 'active';
          } else {
            status = 'upcoming';
          }

          return {
            id: b.id,
            venueId: b.ground_id || b.ground?.id || '',
            venueTitle: b.ground?.name || 'Спортивная площадка',
            sport: (b.ground?.type || 'football').toLowerCase() as any,
            city: (b.ground?.city || 'Темиртау') as CityName,
            address: b.ground?.address || '',
            date: dateStr,
            timeSlot: `${sTime} – ${eTime}`,
            qrCode: b.qr_code || `IGRAEM-${b.id?.slice(0, 5)}`,
            pinCode: b.pin_code || '4819',
            status,
            isOpened: Boolean(b.is_door_opened),
            isParticipant: Boolean(b.isParticipant || b.is_participant),
            isHost: b.isHost !== undefined ? b.isHost : !Boolean(b.isParticipant || b.is_participant),
            guests: b.guests || [],
            participantsCount: b.participantsCount || (b.guests ? 1 + b.guests.filter((g: any) => g.status === 'approved').length : 1),
          };
        });

        setBookings(mapped);
      }
    } catch (err) {
      console.warn('[App] fetchMyBookings error:', err);
    }
  }, []);

  // Fetch user's outgoing join requests
  const fetchMyRequests = useCallback(async () => {
    try {
      const res = await api.getMyJoinRequests();
      if (res.success && Array.isArray(res.data)) {
        const mapped: MyRequestItem[] = res.data.map((r: any) => ({
          id: r.id,
          venueId: r.venueId || r.booking?.ground_id || '',
          venueTitle: r.venueTitle || r.booking?.ground?.name || 'Площадка',
          sport: (r.sport || r.booking?.ground?.type || 'football').toLowerCase() as any,
          address: r.address || r.booking?.ground?.address || '',
          date: r.date || r.booking?.booking_date || '',
          timeSlot: r.timeSlot || `${r.booking?.start_time} – ${r.booking?.end_time}`,
          status: r.status === 'confirmed' || r.status === 'APPROVED' ? 'confirmed' : r.status === 'declined' || r.status === 'REJECTED' ? 'declined' : 'pending',
        }));
        setMyRequests(mapped);
      }
    } catch (err) {
      console.warn('[App] fetchMyRequests error:', err);
    }
  }, []);

  // Fetch host requests
  const fetchHostRequests = useCallback(async () => {
    try {
      const res = await api.getHostRequests();
      if (res.success && Array.isArray(res.data)) {
        const mapped: VenueIncomingRequests[] = res.data.map((item: any) => ({
          id: item.id || item.ground_id,
          venueId: item.venueId || item.ground_id || item.ground?.id || '',
          venueTitle: item.venueTitle || item.ground?.name || item.ground?.title || 'Площадка',
          sport: (item.sport || item.ground?.type || 'football').toLowerCase() as any,
          address: item.address || item.ground?.address || '',
          date: item.date || item.booking_date || '',
          timeSlot: item.timeSlot || `${item.start_time || '18:00'} – ${item.end_time || '19:00'}`,
          joinedCount: item.joinedCount !== undefined ? item.joinedCount : (item.guests ? 1 + item.guests.filter((g: any) => g.status === 'approved').length : 1),
          requests: (item.requests || item.join_requests || []).map((r: any) => ({
            id: r.id,
            userName: r.userName || r.user_name || r.user?.full_name || 'Пользователь',
            userPhone: r.userPhone || r.user_phone || '',
            status: (r.status?.toLowerCase() === 'approved' || r.status === 'accepted') ? 'accepted' : (r.status?.toLowerCase() === 'rejected' || r.status === 'declined') ? 'declined' : 'pending',
          })),
        }));
        setIncomingVenueRequests(mapped);
      }
    } catch (err) {
      console.warn('[App] fetchHostRequests error:', err);
    }
  }, []);

  // Check saved token on mount and restore user profile & bookings from DB
  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api.getMe()
        .then((res) => {
          if (res.success && res.data) {
            setUserProfile(res.data);
            setUserPhone(res.data.phone_number || '');
            setIsAuthenticated(true);
          }
        })
        .catch(() => {
          api.setToken(null);
          setIsAuthenticated(false);
        });
    }
  }, []);

  // When authenticated, fetch fresh data and start background polling (every 5 seconds)
  useEffect(() => {
    if (isAuthenticated) {
      fetchGrounds();
      fetchMyBookings();
      fetchMyRequests();
      fetchHostRequests();

      const pollInterval = setInterval(() => {
        fetchMyBookings();
        fetchMyRequests();
        fetchHostRequests();
      }, 5000);

      return () => clearInterval(pollInterval);
    } else {
      setBookings([]);
      setIncomingVenueRequests([]);
      setMyRequests([]);
    }
  }, [isAuthenticated, fetchGrounds, fetchMyBookings, fetchMyRequests, fetchHostRequests]);

  const totalPendingRequestsCount = useMemo(() => {
    return incomingVenueRequests.reduce((acc, venue) => {
      return acc + (venue.requests || []).filter((r) => r.status === 'pending').length;
    }, 0);
  }, [incomingVenueRequests]);

  const handleAcceptIncomingRequest = async (venueReqId: string, reqId: string) => {
    try {
      await api.approveJoinRequest(reqId);
    } catch (err) {
      console.warn('[App] Approve join request API error:', err);
    }
    setIncomingVenueRequests((prev) =>
      prev.map((v) =>
        v.id === venueReqId
          ? {
              ...v,
              joinedCount: (v.joinedCount || 1) + 1,
              requests: v.requests.map((r) => (r.id === reqId ? { ...r, status: 'accepted' } : r)),
            }
          : v
      )
    );
    await fetchHostRequests();
    await fetchMyBookings();
    await fetchGrounds();
  };

  const handleDeclineIncomingRequest = async (venueReqId: string, reqId: string) => {
    try {
      await api.rejectJoinRequest(reqId);
    } catch (err) {
      console.warn('[App] Reject join request API error:', err);
    }
    setIncomingVenueRequests((prev) =>
      prev.map((v) =>
        v.id === venueReqId
          ? {
              ...v,
              requests: v.requests.map((r) => (r.id === reqId ? { ...r, status: 'declined' } : r)),
            }
          : v
      )
    );
    await fetchHostRequests();
  };

  // Views overlay states
  const [currentBookingSuccess, setCurrentBookingSuccess] = useState<Booking | null>(null);
  const [openedVenueBooking, setOpenedVenueBooking] = useState<Booking | null>(null);

  // Helper to determine if a booking is actively ongoing right now
  const isBookingOngoingNow = useCallback((b: Booking): boolean => {
    if (b.status === 'completed') {
      return false;
    }

    const times = b.timeSlot ? b.timeSlot.split('–').map((t) => t.trim()) : [];
    const startTimeStr = times[0] || '18:00';
    const endTimeStr = times[1] || '19:00';

    const [startHour, startMin] = startTimeStr.split(':').map(Number);
    const [endHour, endMin] = endTimeStr.split(':').map(Number);

    let bookingDateObj = new Date();
    if (b.date && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) {
      const [y, m, d] = b.date.split('-').map(Number);
      bookingDateObj = new Date(y, m - 1, d);
    } else if (b.date && /^\d{2}\.\d{2}\.\d{4}$/.test(b.date)) {
      const [d, m, y] = b.date.split('.').map(Number);
      bookingDateObj = new Date(y, m - 1, d);
    }

    const startMs = new Date(bookingDateObj).setHours(startHour || 0, startMin || 0, 0, 0);
    const endMs = new Date(bookingDateObj).setHours(endHour || 0, endMin || 0, 0, 0);
    const nowMs = Date.now();

    // Active if door is opened OR if current time is within active booking window and end time has NOT passed
    return (b.isOpened || (nowMs >= startMs - 10 * 60 * 1000)) && nowMs < endMs;
  }, []);

  // Active ongoing booking strictly right now (shows on map only if actually ongoing)
  const activeBooking = useMemo(() => {
    if (openedVenueBooking && isBookingOngoingNow(openedVenueBooking)) {
      return openedVenueBooking;
    }
    return bookings.find((b) => isBookingOngoingNow(b)) || null;
  }, [bookings, openedVenueBooking, isBookingOngoingNow]);

  // Upcoming / Waiting booking for today (now < startTime - 10 min)
  const upcomingBooking = useMemo(() => {
    if (activeBooking) return null; // Prioritize active ongoing booking on map
    const nowMs = Date.now();
    return (
      bookings.find((b) => {
        if (b.status === 'completed') return false;
        const times = b.timeSlot ? b.timeSlot.split('–').map((t) => t.trim()) : [];
        const [startHour, startMin] = (times[0] || '18:00').split(':').map(Number);
        const [endHour, endMin] = (times[1] || '19:00').split(':').map(Number);

        let bDate = new Date();
        if (b.date && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) {
          const [y, m, d] = b.date.split('-').map(Number);
          bDate = new Date(y, m - 1, d);
        } else if (b.date && /^\d{2}\.\d{2}\.\d{4}$/.test(b.date)) {
          const [d, m, y] = b.date.split('.').map(Number);
          bDate = new Date(y, m - 1, d);
        }
        const startMs = new Date(bDate).setHours(startHour || 0, startMin || 0, 0, 0);
        const endMs = new Date(bDate).setHours(endHour || 0, endMin || 0, 0, 0);

        return nowMs < startMs - 10 * 60 * 1000 && nowMs < endMs;
      }) || null
    );
  }, [bookings, activeBooking]);

  // Count active/upcoming bookings for bottom nav badge
  const activeBookingsCount = useMemo(() => {
    return bookings.filter((b) => b.status !== 'completed').length;
  }, [bookings]);

  // Unlock Loading Process state
  const [unlockingBooking, setUnlockingBooking] = useState<Booking | null>(null);

  // Venue Closed Thanks Modal state
  const [isVenueClosedModalOpen, setIsVenueClosedModalOpen] = useState(false);
  const [closedVenueSport, setClosedVenueSport] = useState<SportType>('football');

  // Filtered Venues List for Map
  const filteredVenues = useMemo(() => {
    return venues.filter((venue) => {
      if (venue.city !== currentCity) return false;
      if (selectedSport !== 'all' && venue.sport !== selectedSport) return false;
      
      if (selectedTimeSlots.length > 0) {
        const hasMatchingSlot = venue.slots.some(
          (slot) => slot.isAvailable && selectedTimeSlots.includes(slot.time)
        );
        if (!hasMatchingSlot) return false;
      }

      return true;
    });
  }, [venues, currentCity, selectedSport, selectedTimeSlots]);

  const favoriteVenues = useMemo(() => {
    return venues.filter((v) => favoriteIds.includes(v.id));
  }, [venues, favoriteIds]);

  const handleAuthSuccess = (user: UserProfile) => {
    setUserProfile(user);
    setUserPhone(user.phone_number || '');
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    api.setToken(null);
    setUserProfile(null);
    setUserPhone('');
    setIsAuthenticated(false);
    setBookings([]);
    setIncomingVenueRequests([]);
    setMyRequests([]);
    setOpenedVenueBooking(null);
    setCurrentBookingSuccess(null);
  };

  const handleToggleFavorite = (venueId: string) => {
    setFavoriteIds((prev) =>
      prev.includes(venueId) ? prev.filter((id) => id !== venueId) : [...prev, venueId]
    );
  };

  // Create booking connected directly to PostgreSQL DB
  const handleCreateBooking = async (
    venue: Venue,
    dateStr: string,
    slot: TimeSlot
  ) => {
    const times = slot.time.split('–').map((t) => t.trim());
    const startTime = times[0] || '18:00';
    const endTime = times[1] || '19:00';

    try {
      const res = await api.createBooking({
        ground_id: venue.id,
        booking_date: dateStr,
        start_time: startTime,
        end_time: endTime,
      });

      if (res && res.success && res.data) {
        await fetchMyBookings();
        await fetchGrounds();

        const createdBooking = res.data;
        const newBookingObj: Booking = {
          id: createdBooking.id || `B-${Math.floor(1000 + Math.random() * 9000)}`,
          venueId: venue.id,
          venueTitle: venue.title,
          sport: venue.sport,
          city: venue.city,
          address: venue.address,
          date: createdBooking.booking_date || dateStr,
          timeSlot: slot.time,
          qrCode: createdBooking.qr_code || `IGRAEM-${createdBooking.id?.slice(0, 5)}`,
          pinCode: createdBooking.pin_code || '4819',
          status: 'upcoming',
          isOpened: false,
          canOpenNow: true,
          isParticipant: false,
          isHost: true,
          guests: [],
          participantsCount: 1,
        };

        setSelectedVenue(null);
        setCurrentBookingSuccess(newBookingObj);
        return;
      } else {
        alert(res?.message || 'Не удалось создать бронирование');
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка бронирования. Проверьте суточный лимит и доступность времени.');
    }
  };

  // Cancel booking with real backend request
  const handleCancelBooking = async (bookingId: string) => {
    try {
      await api.cancelBooking(bookingId);
      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
      if (currentBookingSuccess?.id === bookingId) {
        setCurrentBookingSuccess(null);
      }
      if (openedVenueBooking?.id === bookingId) {
        setOpenedVenueBooking(null);
      }
      showToast('Бронирование успешно отменено', 'success');
      await fetchMyBookings();
      await fetchGrounds();
    } catch (err: any) {
      console.error('[App] cancelBooking error:', err);
      showToast(err.message || 'Не удалось отменить бронирование', 'error');
    }
  };

  // Leave/opt-out from joint booking (Participant) with real backend request
  const handleLeaveBooking = async (bookingId: string) => {
    try {
      await api.leaveBooking(bookingId);
      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
      if (currentBookingSuccess?.id === bookingId) {
        setCurrentBookingSuccess(null);
      }
      if (openedVenueBooking?.id === bookingId) {
        setOpenedVenueBooking(null);
      }
      showToast('Вы отказались от участия в игре', 'info');
      await fetchMyBookings();
      await fetchMyRequests();
      await fetchGrounds();
    } catch (err: any) {
      console.error('[App] leaveBooking error:', err);
      showToast(err.message || 'Не удалось отказаться от участия', 'error');
    }
  };

  // Finish/Complete active booking (Host) or Leave session (Participant) with real backend request
  const handleFinishBooking = async (bookingId: string) => {
    const foundBooking = bookings.find((b) => b.id === bookingId) || openedVenueBooking;
    const isParticipant = Boolean(foundBooking?.isParticipant);

    if (foundBooking) {
      setClosedVenueSport(foundBooking.sport);
    }

    try {
      if (isParticipant) {
        await api.leaveBooking(bookingId);
      } else {
        await api.completeBooking(bookingId);
      }
    } catch (err) {
      console.warn('[App] finish/leave booking backend error:', err);
    }

    if (isParticipant) {
      // Participant left: completely remove from active list, clear opened screen & state
      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
      setOpenedVenueBooking(null);
      setCurrentBookingSuccess(null);
      setActiveTab('map');
      showToast('Вы вышли из совместной игры', 'info');
    } else {
      // Organizer finished: mark booking as completed, open venue closed modal
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: 'completed', isOpened: false } : b))
      );
      setOpenedVenueBooking(null);
      setCurrentBookingSuccess(null);
      setActiveTab('map');
      setIsVenueClosedModalOpen(true);
    }

    // Refresh data from DB
    await fetchMyBookings();
    await fetchGrounds();
  };

  // Handle booking extension / update
  const handleBookingUpdated = async (updatedBooking: Booking) => {
    setBookings((prev) => prev.map((b) => (b.id === updatedBooking.id ? updatedBooking : b)));
    setOpenedVenueBooking(updatedBooking);
    showToast('Бронь успешно продлена на 1 час!', 'success');
    await fetchMyBookings();
    await fetchGrounds();
  };

  const handleOpenVenue = (booking: Booking) => {
    const isOngoing = isBookingOngoingNow(booking);
    if (isOngoing) {
      setCurrentBookingSuccess(null);
      setOpenedVenueBooking(booking);
    } else {
      // In WAITING state (now < startTime - 10 min) -> open Waiting Screen with countdown timer
      setCurrentBookingSuccess(booking);
    }
  };

  const handleUnlockComplete = () => {
    if (unlockingBooking) {
      const openedBooking: Booking = { ...unlockingBooking, isOpened: true };
      setBookings((prev) =>
        prev.map((b) => (b.id === openedBooking.id ? openedBooking : b))
      );
      setUnlockingBooking(null);
      setOpenedVenueBooking(openedBooking);
    }
  };

  const handleSelectVenueForBooking = (venueId: string) => {
    const found = venues.find((v) => v.id === venueId);
    if (found) {
      setSelectedVenue(found);
      setActiveTab('map');
    }
  };

  // Reset Password Screen (if ?token=... or /reset-password in URL)
  const [resetToken, setResetToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const isResetPath = window.location.pathname.includes('reset-password');
      if (token !== null) return token;
      if (isResetPath) return '';
    }
    return null;
  });

  if (resetToken !== null) {
    return (
      <div className="app-container">
        <ResetPasswordScreen
          initialToken={resetToken}
          onBackToLogin={() => {
            setResetToken(null);
            window.history.replaceState({}, document.title, '/');
          }}
        />
      </div>
    );
  }

  // Screen 1: Unauthenticated -> AuthScreen
  if (!isAuthenticated) {
    return (
      <div className="app-container">
        <AuthScreen onSuccess={handleAuthSuccess} />
      </div>
    );
  }

  // Screen 6: Venue Opened Screen
  if (openedVenueBooking) {
    return (
      <div className="app-container">
        <VenueOpenedScreen
          booking={openedVenueBooking}
          userBookings={bookings}
          onBookingUpdated={handleBookingUpdated}
          onBackToMap={() => {
            setOpenedVenueBooking(null);
            setActiveTab('map');
          }}
          onFinishBooking={handleFinishBooking}
        />
        <BottomNav
          activeTab={activeTab}
          onTabChange={(tab) => {
            setOpenedVenueBooking(null);
            setActiveTab(tab);
          }}
          bookingsCount={activeBookingsCount}
          requestsCount={totalPendingRequestsCount}
          favoritesCount={favoriteVenues.length}
          currentLang={currentLang}
        />
      </div>
    );
  }

  if (isBanned) {
    return (
      <div className="app-container">
        <BannedUserScreen onUnbanForDemo={() => setIsBanned(false)} />
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header
        currentCity={currentCity}
        onSelectCity={setCurrentCity}
        currentLang={currentLang}
      />

      <main className="flex-1 relative flex flex-col min-h-0 overflow-hidden w-full">
        {activeTab === 'map' && (
          <div key="tab-map" className="relative w-full h-full flex-1 overflow-hidden min-h-0 animate-tab-view">
            <MapView
              currentCity={currentCity}
              venues={filteredVenues}
              selectedVenue={selectedVenue}
              onSelectVenue={setSelectedVenue}
              activeBooking={activeBooking}
              upcomingBooking={upcomingBooking}
              onOpenVenue={handleOpenVenue}
              userCoords={userCoords}
              onUpdateUserCoords={setUserCoords}
            />

            <div className="absolute bottom-0 left-0 right-0 w-full z-10 bg-white shadow-md pointer-events-auto">
              <FilterBar
                selectedSport={selectedSport}
                onSelectSport={setSelectedSport}
                selectedDate={selectedDate}
                selectedTimeSlotsCount={selectedTimeSlots.length}
                onOpenDateModal={() => setIsDateModalOpen(true)}
                currentLang={currentLang}
              />
            </div>
          </div>
        )}

        {activeTab === 'bookings' && (
          <div key="tab-bookings" className="flex-1 flex flex-col min-h-0 overflow-hidden animate-tab-view">
            <BookingsTab
              bookings={bookings}
              onOpenVenue={handleOpenVenue}
              onSelectVenueForBooking={handleSelectVenueForBooking}
              onRefreshBookings={fetchMyBookings}
            />
          </div>
        )}

        {activeTab === 'requests' && (
          <div key="tab-requests" className="flex-1 flex flex-col min-h-0 overflow-hidden animate-tab-view">
            <RequestsTab
              myRequests={myRequests}
              incomingVenueRequests={incomingVenueRequests}
              onAcceptIncomingRequest={handleAcceptIncomingRequest}
              onDeclineIncomingRequest={handleDeclineIncomingRequest}
              currentLang={currentLang}
              initialSubTab={requestsSubTab}
            />
          </div>
        )}

        {activeTab === 'favorites' && (
          <div key="tab-favorites" className="flex-1 flex flex-col min-h-0 overflow-hidden animate-tab-view">
            <FavoritesTab
              favoriteVenues={favoriteVenues}
              onSelectVenue={(v) => {
                setSelectedVenue(v);
              }}
              onRemoveFavorite={handleToggleFavorite}
            />
          </div>
        )}

        {activeTab === 'profile' && (
          <div key="tab-profile" className="flex-1 flex flex-col min-h-0 overflow-hidden animate-tab-view">
            <ProfileTab
              userProfile={userProfile}
              userPhone={userPhone}
              currentCity={currentCity}
              currentLang={currentLang}
              onSelectLang={setCurrentLang}
              onLogout={handleLogout}
              onProfileUpdated={(updated) => setUserProfile(updated)}
              bookings={bookings}
              venues={venues}
            />
          </div>
        )}
      </main>

      <DateFilterModal
        isOpen={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        selectedDate={selectedDate}
        selectedTimeSlots={selectedTimeSlots}
        onApply={(date, timeSlots) => {
          setSelectedDate(date);
          setSelectedTimeSlots(timeSlots);
        }}
      />

      <VenueCardModal
        venue={selectedVenue}
        userCoords={userCoords}
        userBookings={bookings}
        onClose={() => setSelectedVenue(null)}
        onBook={handleCreateBooking}
        isFavorite={selectedVenue ? favoriteIds.includes(selectedVenue.id) : false}
        onToggleFavorite={handleToggleFavorite}
      />

      {currentBookingSuccess && (
        <BookingSuccessScreen
          booking={currentBookingSuccess}
          onClose={() => setCurrentBookingSuccess(null)}
          onGoToBookings={() => {
            setCurrentBookingSuccess(null);
            handleTabChange('bookings');
          }}
          onOpenVenue={handleOpenVenue}
          onCancelBooking={handleCancelBooking}
          onLeaveBooking={handleLeaveBooking}
        />
      )}

      {unlockingBooking && (
        <UnlockLoadingScreen
          booking={unlockingBooking}
          onComplete={handleUnlockComplete}
        />
      )}

      <VenueClosedModal
        isOpen={isVenueClosedModalOpen}
        onClose={() => setIsVenueClosedModalOpen(false)}
        sport={closedVenueSport}
      />

      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        bookingsCount={activeBookingsCount}
        requestsCount={totalPendingRequestsCount}
        favoritesCount={favoriteVenues.length}
        currentLang={currentLang}
      />

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] max-w-[90%] sm:max-w-md w-full px-4 animate-fade-in pointer-events-none">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-md ${
              toastMessage.type === 'success'
                ? 'bg-white/95 border-[#00B050]/40 text-slate-900 shadow-[#00B050]/10'
                : toastMessage.type === 'error'
                ? 'bg-white/95 border-rose-400 text-slate-900 shadow-rose-500/10'
                : 'bg-white/95 border-sky-400 text-slate-900 shadow-sky-500/10'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-[#00B050] shrink-0" />
            ) : toastMessage.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-sky-500 shrink-0" />
            )}
            <span className="text-xs font-bold leading-snug">{toastMessage.text}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
