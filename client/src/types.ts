export type CityName = 'Темиртау' | 'Караганды' | 'Астана' | 'Алматы';

export type SportType = 'all' | 'football' | 'basketball';

export interface TimeSlot {
  id: string;
  time: string;
  isAvailable: boolean;
}

export interface Venue {
  id: string;
  title: string;
  sport: 'football' | 'basketball';
  city: CityName;
  lat: number;
  lng: number;
  address: string;
  rating: number;
  reviewsCount?: number;
  images: string[];
  description: string;
  amenities: string[];
  workingHours: string;
  surface: string;
  slots: TimeSlot[];
  occupiedSlots?: { id?: string; booking_date: string; start_time: string; end_time: string }[];
}

export interface ParticipantUser {
  id: string;
  userId?: string;
  fullName: string;
  phone?: string;
  avatar?: string | null;
  status?: string;
  isCurrentUser?: boolean;
}

export interface BookingParticipantsData {
  bookingId: string;
  organizer: ParticipantUser;
  creator?: ParticipantUser;
  participants: ParticipantUser[];
  totalCount: number;
}

export interface Booking {
  id: string;
  venueId: string;
  groundId?: string;
  venueTitle: string;
  sport: 'football' | 'basketball';
  city: CityName;
  address: string;
  date: string;
  timeSlot: string;
  qrCode: string;
  pinCode: string;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  isOpened: boolean;
  canOpenNow?: boolean;
  guests?: any[];
  isParticipant?: boolean;
  isHost?: boolean;
  guestId?: string;
  participantsCount?: number;
  hostName?: string;
  hostPhone?: string;
  host_user_id?: string;
  host_user?: {
    id: string;
    full_name: string;
    phone_number?: string;
    avatar_url?: string;
  };
}

export type ActiveTab = 'map' | 'bookings' | 'requests' | 'favorites' | 'profile';

export type MyRequestStatus = 'pending' | 'confirmed' | 'declined';
export type IncomingRequestStatus = 'pending' | 'accepted' | 'declined';

export interface MyRequestItem {
  id: string;
  venueId: string;
  venueTitle: string;
  sport: 'football' | 'basketball';
  address: string;
  date: string;
  timeSlot: string;
  status: MyRequestStatus;
}

export interface IncomingUserRequest {
  id: string;
  userName: string;
  userPhone?: string;
  status: IncomingRequestStatus;
}

export interface VenueIncomingRequests {
  id: string;
  venueId: string;
  venueTitle: string;
  sport: 'football' | 'basketball';
  address: string;
  date: string;
  timeSlot: string;
  joinedCount?: number;
  requests: IncomingUserRequest[];
}
