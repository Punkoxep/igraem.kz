import { CityName, Venue } from '../types';

export const CITIES_CONFIG: Record<CityName, { lat: number; lng: number; zoom: number }> = {
  'Темиртау': { lat: 50.060371, lng: 72.993374, zoom: 16 },
  'Караганды': { lat: 49.8020, lng: 73.1020, zoom: 12 },
  'Астана': { lat: 51.1694, lng: 71.4491, zoom: 12 },
  'Алматы': { lat: 43.2389, lng: 76.8897, zoom: 12 },
};

export const INITIAL_VENUES: Venue[] = [
  // ТЕМИРТАУ - Школа №11
  {
    id: 'f4c907ad-504c-44fa-96f4-3ac72446a8f6',
    title: 'Спортивная площадка Школа №11 (Футбол)',
    sport: 'football',
    city: 'Темиртау',
    lat: 50.060371,
    lng: 72.993374,
    address: 'Школа №11, г. Темиртау',
    rating: 0.0,
    images: [
      'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80',
    ],
    description: 'Оборудованная открытая футбольная площадка Школы №11 с искусственным газоном, прожекторным освещением и электронным замком TTLock.',
    amenities: ['Освещение', 'Искусственный газон', 'Электронный замок TTLock', 'Ограждение'],
    workingHours: '08:00 - 23:00',
    surface: 'Искусственная трава',
    slots: [
      { id: 's1', time: '17:00 – 18:00', isAvailable: true },
      { id: 's2', time: '18:00 – 19:00', isAvailable: true },
      { id: 's3', time: '19:00 – 20:00', isAvailable: true },
      { id: 's4', time: '20:00 – 21:00', isAvailable: true },
      { id: 's5', time: '21:00 – 22:00', isAvailable: true },
    ]
  },
  {
    id: 'e71d14e4-28ff-4934-84a1-4bd5c2549376',
    title: 'Спортивная площадка Школа №11 (Баскетбол)',
    sport: 'basketball',
    city: 'Темиртау',
    lat: 50.060371,
    lng: 72.993374,
    address: 'Школа №11, г. Темиртау',
    rating: 0.0,
    images: [
      'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=80',
    ],
    description: 'Баскетбольная площадка Школы №11 с профессиональным кольцами и амортизирующим покрытием.',
    amenities: ['Освещение', 'Электронный замок TTLock', 'Баскетбольные щиты'],
    workingHours: '08:00 - 23:00',
    surface: 'Каучуковое покрытие',
    slots: [
      { id: 'b1', time: '17:00 – 18:00', isAvailable: true },
      { id: 'b2', time: '18:00 – 19:00', isAvailable: true },
      { id: 'b3', time: '19:00 – 20:00', isAvailable: true },
    ]
  },

  // КАРАГАНДЫ
  {
    id: 'krg-1',
    title: 'Шахтёр Арена (Мини-футбол)',
    sport: 'football',
    city: 'Караганды',
    lat: 49.8050,
    lng: 73.0980,
    address: 'ул. Казахстанская, 1',
    rating: 0.0,
    images: [
      'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Главная мини-футбольная площадка Караганды с сертифицированным газоном.',
    amenities: ['Освещение PRO', 'Душевые', 'Охраняемая парковка', 'Кафе'],
    workingHours: '08:00 - 01:00',
    surface: 'Искусственная трава 50мм',
    slots: [
      { id: 'k1', time: '18:00 - 19:00', isAvailable: true },
      { id: 'k2', time: '19:00 - 20:00', isAvailable: true },
      { id: 'k3', time: '20:00 - 21:00', isAvailable: true },
    ]
  },
  {
    id: 'krg-2',
    title: 'Hoop City Karaganda',
    sport: 'basketball',
    city: 'Караганды',
    lat: 49.7990,
    lng: 73.1090,
    address: 'пр. Бухар-Жырау, 59',
    rating: 0.0,
    images: [
      'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Современный баскетбол в центре города. Высокие потолки, отличное освещение.',
    amenities: ['Раздевалка', 'Кулер с водой', 'Аудиосистема', 'Снаряжение'],
    workingHours: '10:00 - 22:00',
    surface: 'Спортивное каучуковое покрытие',
    slots: [
      { id: 'kb1', time: '16:00 - 17:00', isAvailable: true },
      { id: 'kb2', time: '17:00 - 18:00', isAvailable: true },
    ]
  },

  // АСТАНА
  {
    id: 'astana-1',
    title: 'Astana Indoor Pitch',
    sport: 'football',
    city: 'Астана',
    lat: 51.1300,
    lng: 71.4200,
    address: 'пр. Кабанбай Батыра, 43',
    rating: 0.0,
    images: [
      'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Премиум крытый купол для футбола возле Ботанического сада.',
    amenities: ['Климат-контроль', 'Сауна', 'Душ', 'Спортивный бар', 'Раздевалки VIP'],
    workingHours: '24/7',
    surface: 'Искусственная трава FIFA Quality',
    slots: [
      { id: 'a1', time: '19:00 - 20:00', isAvailable: true },
      { id: 'a2', time: '20:00 - 21:00', isAvailable: true },
      { id: 'a3', time: '21:00 - 22:00', isAvailable: true },
    ]
  },
  {
    id: 'astana-2',
    title: 'Capital Basketball Center',
    sport: 'basketball',
    city: 'Астана',
    lat: 51.1800,
    lng: 71.4500,
    address: 'пр. Мангилик Ел, 55',
    rating: 0.0,
    images: [
      'https://images.unsplash.com/photo-1519766304817-4f37bda74a29?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Профессиональный зал 3х3 и 5х5 с амортизацией и профессиональными мячами Spalding.',
    amenities: ['Паркет', 'Электронный счетчик', 'Душ', 'Прокат обуви'],
    workingHours: '09:00 - 00:00',
    surface: 'Канадский клен',
    slots: [
      { id: 'ab1', time: '18:00 - 19:00', isAvailable: true },
      { id: 'ab2', time: '19:00 - 20:00', isAvailable: true },
    ]
  },

  // АЛМАТЫ
  {
    id: 'almaty-1',
    title: 'Medeu Football Park',
    sport: 'football',
    city: 'Алматы',
    lat: 43.2450,
    lng: 76.9200,
    address: 'пр. Достык, 160',
    rating: 0.0,
    images: [
      'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Живописный комплекс в предгорьях Алматы с панорамным видом и свежим воздухом.',
    amenities: ['Панорамный вид', 'Раздевалки', 'Гриль-зона', 'Кафе', 'Освещение'],
    workingHours: '08:00 - 02:00',
    surface: 'Евро-газон премиум',
    slots: [
      { id: 'al1', time: '18:00 - 19:00', isAvailable: true },
      { id: 'al2', time: '19:00 - 20:00', isAvailable: true },
      { id: 'al3', time: '20:00 - 21:00', isAvailable: true },
    ]
  },
  {
    id: 'almaty-2',
    title: 'Almaty Streetball Court',
    sport: 'basketball',
    city: 'Алматы',
    lat: 43.2300,
    lng: 76.8800,
    address: 'ул. Абая, 84 (Центральный стадион)',
    rating: 0.0,
    images: [
      'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Легендарная баскетбольная площадка в спортивном кластере Алматы.',
    amenities: ['Профессиональные щиты', 'Трибуны', 'Раздевалки', 'Трибуны'],
    workingHours: '08:00 - 23:00',
    surface: 'Бесшовный акрил',
    slots: [
      { id: 'alb1', time: '17:00 - 18:00', isAvailable: true },
      { id: 'alb2', time: '18:00 - 19:00', isAvailable: true },
    ]
  }
];
