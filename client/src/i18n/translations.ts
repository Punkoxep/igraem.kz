export type Language = 'ru' | 'kk' | 'en';

export const LANGUAGE_NAMES: Record<Language, string> = {
  ru: 'Русский',
  kk: 'Қазақша',
  en: 'English',
};

export const translations = {
  ru: {
    // Header & Nav
    selectCity: 'Выберите город',
    navMap: 'Карта',
    navBookings: 'Брони',
    navRequests: 'Запросы',
    navFavorites: 'Избранное',
    navProfile: 'Профиль',

    // Filter Bar
    football: 'Футбол',
    basketball: 'Баскетбол',
    today: 'Сегодня',

    // Map & Floating Card
    upcomingBooking: 'БЛИЖАЙШАЯ БРОНЬ',
    unlock: 'Открыть',

    // Modals
    selectDateTime: 'Выбор даты и времени',
    dateLabel: 'Дата',
    timeSlotsLabel: 'Временные слоты (множественный выбор)',
    singleTimeSlotLabel: 'Временной слот',
    reset: 'Сбросить',
    showVenues: 'Показать площадки',
    selectTime: 'Выберите время',
    bookNow: 'Забронировать',
    selectedCount: 'Выбрано',

    // Booking Success
    venueBooked: 'Площадка забронирована',
    objectLabel: 'Объект',
    timeLabel: 'Время',
    startsIn: 'До начала',
    reportProblem: 'Сообщить о проблеме',
    reportSub: 'Не работает свет, мусор и другое',
    cancelBooking: 'Отменить бронь',
    inCalendar: 'В календарь',
    share: 'Поделиться',
    canOpenIn: 'Можно открыть через 2ч 34мин',
    openVenue: 'Открыть площадку',
    problemDesc: 'Описание проблемы',
    send: 'Отправить',
    thankYou: 'Спасибо за сообщение!',
    supportWorking: 'Наша служба поддержки уже работает над этим.',

    // Venue Opened
    activeBooking: 'Активная бронь',
    venueOpened: 'Площадка открыта!',
    locksUnlocked: 'Замки разблокированы.\nХорошей игры!',
    timeRemaining: 'До завершения осталось',
    min: 'мин',
    rulesCard: 'Правила пользования площадкой',
    reportProblemCard: 'Сообщить о проблеме',
    openDoorCard: 'Открыть дверь',
    finishBookingCard: 'Завершить бронирование',
    back: 'Назад',

    // Bookings Tab
    myBookings: 'Мои брони',
    upcoming: 'Предстоящие',
    past: 'Прошедшие',
    requests: 'Запросы',
    goToBooking: 'Перейти к брони',
    bookAgain: 'Забронировать снова',
    wantsToJoin: 'Хочет присоединиться',
    wantToJoin: 'Хотите присоединиться',
    approve: 'Одобрить',
    decline: 'Отклонить',
    approved: 'Подтверждено',
    declined: 'Отклонено',
    pending: 'В ожидании',

    // Profile Tab
    profileTitle: 'Профиль',
    memberSince: 'В сервисе с мая 2024',
    hoursPlayed: 'Сыграно часов',
    hoursShort: 'ч',
    favSport: 'Любимый спорт',
    
    sectionProfile: 'ПРОФИЛЬ',
    name: 'Имя',
    phone: 'Телефон',
    birthdate: 'Дата рождения',
    city: 'Город',

    sectionNotifications: 'УВЕДОМЛЕНИЯ',
    reminders30min: 'Напоминания о бронях за 30 мин',
    showOccupiedSlots: 'Показывать занятые слоты',

    sectionApp: 'ПРИЛОЖЕНИЕ',
    language: 'Язык',
    darkMode: 'Темная тема',
    aboutApp: 'О приложении',

    logout: 'Выйти из профиля',
    selectLanguageModalTitle: 'Выберите язык интерфейса',
    appInfoTitle: 'О приложении igraem.kz',
    appVersion: 'Версия 1.0.0 (казахстанский сервис бронирования)',
    close: 'Закрыть',
  },
  kk: {
    // Header & Nav
    selectCity: 'Каланы таңдаңыз',
    navMap: 'Карта',
    navBookings: 'Брондар',
    navRequests: 'Сұраныстар',
    navFavorites: 'Таңдаулылар',
    navProfile: 'Профиль',

    // Filter Bar
    football: 'Футбол',
    basketball: 'Баскетбол',
    today: 'Бүгін',

    // Map & Floating Card
    upcomingBooking: 'ЖАҚЫНДАҒЫ БРОНЬ',
    unlock: 'Ашу',

    // Modals
    selectDateTime: 'Күн мен уақытты таңдау',
    dateLabel: 'Күн',
    timeSlotsLabel: 'Уақыт аралықтары (көп таңдау)',
    singleTimeSlotLabel: 'Уақыт аралығы',
    reset: 'Қайтару',
    showVenues: 'Алаңдарды көрсету',
    selectTime: 'Уақытты таңдаңыз',
    bookNow: 'Броньдау',
    selectedCount: 'Таңдалды',

    // Booking Success
    venueBooked: 'Алаң броньдалды',
    objectLabel: 'Нысан',
    timeLabel: 'Уақыт',
    startsIn: 'Басталғанша',
    reportProblem: 'Мәселе туралы хабарлау',
    reportSub: 'Жарық жанмайды, қоқыс немесе басқа',
    cancelBooking: 'Броньды жою',
    inCalendar: 'Күнтізбеге',
    share: 'Бөлісу',
    canOpenIn: '2 сағ 34 мин кейін ашуға болады',
    openVenue: 'Алаңды ашу',
    problemDesc: 'Мәселенің сипаттамасы',
    send: 'Жіберу',
    thankYou: 'Хабарламаңызға рахмет!',
    supportWorking: 'Біздің қолдау қызметіміз мәселемен айналысып жатыр.',

    // Venue Opened
    activeBooking: 'Белсенді бронь',
    venueOpened: 'Алаң ашылды!',
    locksUnlocked: 'Құлыптар ашылды.\nЖақсы оюн тілейміз!',
    timeRemaining: 'Аяқталуға қалды',
    min: 'мин',
    rulesCard: 'Алаңды пайдалану ережелері',
    reportProblemCard: 'Мәселе туралы хабарлау',
    openDoorCard: 'Есікті ашу',
    finishBookingCard: 'Броньдауды аяқтау',
    back: 'Кері',

    // Bookings Tab
    myBookings: 'Менің броньдарым',
    upcoming: 'Алдағы',
    past: 'Өткен',
    requests: 'Сұраныстар',
    goToBooking: 'Броньға өту',
    bookAgain: 'Қайта броньдау',
    wantsToJoin: 'Қосылғысы келеді',
    wantToJoin: 'Қосылғыңыз келе ме',
    approve: 'Құптау',
    decline: 'Қайтару',
    approved: 'Расталды',
    declined: 'Қайтарылды',
    pending: 'Күтілуде',

    // Profile Tab
    profileTitle: 'Профиль',
    memberSince: 'Сервисте 2024 мамырдан бастап',
    hoursPlayed: 'Ойналған сағаттар',
    hoursShort: 'сағ',
    favSport: 'Сүйікті спорт',
    
    sectionProfile: 'ПРОФИЛЬ',
    name: 'Аты-жөні',
    phone: 'Телефон',
    birthdate: 'Туған күні',
    city: 'Қала',

    sectionNotifications: 'ХАБАРЛАМАЛАР',
    reminders30min: '30 мин бұрын бронь туралы ескерту',
    showOccupiedSlots: 'Бос емес уақыттарды көрсету',

    sectionApp: 'ҚОСЫМША',
    language: 'Тіл',
    darkMode: 'Қараңғы тақырып',
    aboutApp: 'Қосымша туралы',

    logout: 'Профильден шығу',
    selectLanguageModalTitle: 'Интерфейс тілін таңдаңыз',
    appInfoTitle: 'igraem.kz қосымшасы туралы',
    appVersion: 'Нұсқа 1.0.0 (Қазақстандық броньдау сервисі)',
    close: 'Жабу',
  },
  en: {
    // Header & Nav
    selectCity: 'Select City',
    navMap: 'Map',
    navBookings: 'Bookings',
    navRequests: 'Requests',
    navFavorites: 'Favorites',
    navProfile: 'Profile',

    // Filter Bar
    football: 'Football',
    basketball: 'Basketball',
    today: 'Today',

    // Map & Floating Card
    upcomingBooking: 'UPCOMING BOOKING',
    unlock: 'Open',

    // Modals
    selectDateTime: 'Select Date & Time',
    dateLabel: 'Date',
    timeSlotsLabel: 'Time Slots (Multi-select)',
    singleTimeSlotLabel: 'Time Slot',
    reset: 'Reset',
    showVenues: 'Show Venues',
    selectTime: 'Select Time',
    bookNow: 'Book Now',
    selectedCount: 'Selected',

    // Booking Success
    venueBooked: 'Venue Booked',
    objectLabel: 'Venue',
    timeLabel: 'Time',
    startsIn: 'Starts in',
    reportProblem: 'Report a Problem',
    reportSub: 'Lighting, trash, or other issues',
    cancelBooking: 'Cancel Booking',
    inCalendar: 'Add to Calendar',
    share: 'Share',
    canOpenIn: 'Unlocks in 2h 34min',
    openVenue: 'Unlock Venue',
    problemDesc: 'Issue Description',
    send: 'Send',
    thankYou: 'Thank you for your report!',
    supportWorking: 'Our support team is working on it.',

    // Venue Opened
    activeBooking: 'Active Booking',
    venueOpened: 'Venue Unlocked!',
    locksUnlocked: 'Smart locks unlocked.\nHave a great game!',
    timeRemaining: 'Time remaining',
    min: 'min',
    rulesCard: 'Venue Rules & Guidelines',
    reportProblemCard: 'Report an Issue',
    openDoorCard: 'Unlock Gate',
    finishBookingCard: 'Finish Session',
    back: 'Back',

    // Bookings Tab
    myBookings: 'My Bookings',
    upcoming: 'Upcoming',
    past: 'Past',
    requests: 'Requests',
    goToBooking: 'View Booking',
    bookAgain: 'Book Again',
    wantsToJoin: 'Wants to join',
    wantToJoin: 'Do you want to join',
    approve: 'Approve',
    decline: 'Decline',
    approved: 'Approved',
    declined: 'Declined',
    pending: 'Pending',

    // Profile Tab
    profileTitle: 'Profile',
    memberSince: 'Member since May 2024',
    hoursPlayed: 'Hours Played',
    hoursShort: 'hrs',
    favSport: 'Favorite Sport',
    
    sectionProfile: 'PROFILE',
    name: 'Name',
    phone: 'Phone',
    birthdate: 'Date of Birth',
    city: 'City',

    sectionNotifications: 'NOTIFICATIONS',
    reminders30min: '30 min booking reminders',
    showOccupiedSlots: 'Show occupied slots',

    sectionApp: 'APPLICATION',
    language: 'Language',
    darkMode: 'Dark Mode',
    aboutApp: 'About App',

    logout: 'Log Out',
    selectLanguageModalTitle: 'Select Interface Language',
    appInfoTitle: 'About igraem.kz',
    appVersion: 'Version 1.0.0 (Kazakhstan sports booking platform)',
    close: 'Close',
  },
};
