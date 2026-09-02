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

    // Booking Restrictions
    bookingRestricted: {
      title: "Бронирование ограничено",
      desc: "Доступ к бронированию приостановлен за нарушение правил площадки (неявка/опоздание).",
      until: "Действует до:",
      modalTitle: "Ваш аккаунт временно заблокирован",
      modalDesc: "Вы не можете забронировать этот слот из-за несоблюдения регламента посещения.",
      reasonLabel: "Причина блокировки:",
      defaultReason: "Неявка или опоздание на забронированное время (нарушение правил площадки)",
      gotItButton: "Понятно",
    },

    // Auth Screen
    auth: {
      title: "Вход в IGRAEM.KZ",
      subtitle: "Введите номер телефона и пароль для входа",
      phoneLabel: "Телефон",
      passwordLabel: "Пароль",
      passwordPlaceholder: "Введите пароль",
      forgotPassword: "Забыли пароль?",
      submitButton: "Войти",
      orDivider: "или",
      notRegisteredText: "Если вы не зарегистрированы",
      registerButton: "Зарегистрироваться",
      googleAuthTitle: "Войти через Google",
      
      // Register
      regTitle: "Регистрация",
      regSubtitle: "",
      emailLabel: "Email",
      emailPlaceholder: "Email",
      fullNameLabel: "Фамилия Имя Отчество",
      fullNamePlaceholder: "Введите фамилию, имя и отчество",
      regPasswordPlaceholder: "Введите пароль",
      confirmPasswordLabel: "Повторите пароль",
      confirmPasswordPlaceholder: "Повторите пароль",
      agreeTerms: "Я согласен с",
      termsLink: "правилами сервиса",
      agreeTermsEnd: "и обработкой персональных данных",
      orRegisterDivider: "или зарегистрируйтесь через",
      alreadyRegisteredText: "Если вы зарегистрированы",
      loginLinkButton: "Войти",
      
      // Forgot Password
      forgotTitle: "Восстановление пароля",
      forgotSubtitle: "Введите ваш Email, указанный при регистрации. Мы вышлем ссылку для установки нового пароля.",
      sendLinkButton: "Отправить ссылку",
      backToLogin: "Вернуться к авторизации",
      letterSent: "Ссылка на изменение пароля отправлена на ваш email",
      letterSentDesc: "",
      backToLoginBtn: "Закрыть",
      
      // Validation & Errors
      enterFullPhone: "Введите полный 10-значный номер телефона",
      enterPassword: "Введите пароль",
      invalidEmail: "Укажите корректный адрес электронной почты",
      iinLengthError: "ИИН должен состоять из 12 цифр",
      passwordMinLength: "Пароль должен быть длиной не менее 6 символов",
      passwordsDoNotMatch: "Введенные пароли не совпадают",
      mustAgreeTerms: "Пожалуйста, примите правила пользования сервисом",
      loginError: "Неверный номер телефона или пароль",
      regError: "Ошибка при регистрации. Проверьте правильность введенных данных.",
      backBtn: "Назад",
      close: "Закрыть",
      protectedBadge: "Защищено igraem.kz • JWT Session",
    },
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

    // Booking Restrictions
    bookingRestricted: {
      title: "Брондау шектелген",
      desc: "Алаң ережелерін бұзғаныңыз үшін (келмеу/кешігу) брондау уақытша тоқтатылды.",
      until: "Шектеу мерзімі:",
      modalTitle: "Сіздің аккаунтыңыз уақытша бұғатталды",
      modalDesc: "Сіз алаңға келу ережелерін сақтамағаныңыз үшін бұл уақытты брондай алмайсыз.",
      reasonLabel: "Бұғаттау себебі:",
      defaultReason: "Брондалған уақытқа келмеу немесе кешігу (алаң ережелерін бұзу)",
      gotItButton: "Түсінікті",
    },

    // Auth Screen
    auth: {
      title: "IGRAEM.KZ жүйесіне кіру",
      subtitle: "Кіру үшін телефон нөмірі мен құпиясөзді енгізіңіз",
      phoneLabel: "Телефон",
      passwordLabel: "Құпиясөз",
      passwordPlaceholder: "Құпиясөзді енгізіңіз",
      forgotPassword: "Құпиясөзді ұмыттыңыз ба?",
      submitButton: "Кіру",
      orDivider: "немесе",
      notRegisteredText: "Егер тіркелмеген болсаңыз",
      registerButton: "Тіркелу",
      googleAuthTitle: "Google арқылы кіру",
      
      // Register
      regTitle: "Тіркелу",
      regSubtitle: "",
      emailLabel: "Email",
      emailPlaceholder: "Email",
      fullNameLabel: "Тегі Аты Әкесінің аты",
      fullNamePlaceholder: "Тегі, аты және әкесінің атын енгізіңіз",
      regPasswordPlaceholder: "Құпиясөзді енгізіңіз",
      confirmPasswordLabel: "Құпиясөзді қайталаңыз",
      confirmPasswordPlaceholder: "Құпиясөзді қайталаңыз",
      agreeTerms: "Мен",
      termsLink: "қызмет ережелерімен",
      agreeTermsEnd: "және дербес деректерді өңдеумен келісемін",
      orRegisterDivider: "немесе арқылы тіркеліңіз",
      alreadyRegisteredText: "Егер тіркелген болсаңыз",
      loginLinkButton: "Кіру",
      
      // Forgot Password
      forgotTitle: "Құпиясөзді қалпына келтіру",
      forgotSubtitle: "Тіркелген кездегі электрондық поштаңызды енгізіңіз. Біз жаңа құпиясөз орнату үшін сілтеме жібереміз.",
      sendLinkButton: "Сілтемені жіберу",
      backToLogin: "Кіруге оралу",
      letterSent: "Құпиясөзді өзгерту сілтемесі сіздің email-іңізге жіберілді",
      letterSentDesc: "",
      backToLoginBtn: "Жабу",
      
      // Validation & Errors
      enterFullPhone: "10 таңбалы толық телефон нөмірін енгізіңіз",
      enterPassword: "Құпиясөзді енгізіңіз",
      invalidEmail: "Дұрыс электрондық пошта мекенжайын көрсетіңіз",
      iinLengthError: "ЖСН 12 саннан тұруы керек",
      passwordMinLength: "Құпиясөз кемінде 6 таңбадан тұруы керек",
      passwordsDoNotMatch: "Енгізілген құпиясөздер сәйкес келмейді",
      mustAgreeTerms: "Қызметті пайдалану ережелерімен келісіңіз",
      loginError: "Телефон нөмірі немесе құпиясөз қате",
      regError: "Тіркелу кезінде қате орын алды. Деректерді тексеріңіз.",
      backBtn: "Артқа",
      close: "Жабу",
      protectedBadge: "igraem.kz қорғалған • JWT Session",
    },
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

    // Booking Restrictions
    bookingRestricted: {
      title: "Booking Restricted",
      desc: "Booking is temporarily suspended due to a rule violation (no-show or late arrival).",
      until: "Active until:",
      modalTitle: "Your account is temporarily suspended",
      modalDesc: "You cannot book this slot due to a venue rule violation.",
      reasonLabel: "Reason for suspension:",
      defaultReason: "No-show or late arrival for reserved time (venue rule violation)",
      gotItButton: "Got it",
    },

    // Auth Screen
    auth: {
      title: "Log in to IGRAEM.KZ",
      subtitle: "Enter your phone number and password to log in",
      phoneLabel: "Phone",
      passwordLabel: "Password",
      passwordPlaceholder: "Enter password",
      forgotPassword: "Forgot password?",
      submitButton: "Log in",
      orDivider: "or",
      notRegisteredText: "Don't have an account?",
      registerButton: "Sign Up",
      googleAuthTitle: "Continue with Google",
      
      // Register
      regTitle: "Sign Up",
      regSubtitle: "",
      emailLabel: "Email",
      emailPlaceholder: "Email",
      fullNameLabel: "Full Name",
      fullNamePlaceholder: "Enter full name",
      regPasswordPlaceholder: "Enter password",
      confirmPasswordLabel: "Repeat Password",
      confirmPasswordPlaceholder: "Repeat password",
      agreeTerms: "I agree to the",
      termsLink: "Terms of Service",
      agreeTermsEnd: "and Privacy Policy",
      orRegisterDivider: "or sign up with",
      alreadyRegisteredText: "Already have an account?",
      loginLinkButton: "Log In",
      
      // Forgot Password
      forgotTitle: "Reset Password",
      forgotSubtitle: "Enter the email associated with your account and we will send a password reset link.",
      sendLinkButton: "Send reset link",
      backToLogin: "Back to login",
      letterSent: "A password reset link has been sent to your email",
      letterSentDesc: "",
      backToLoginBtn: "Close",
      
      // Validation & Errors
      enterFullPhone: "Enter a full 10-digit phone number",
      enterPassword: "Enter password",
      invalidEmail: "Enter a valid email address",
      iinLengthError: "IIN must be 12 digits",
      passwordMinLength: "Password must be at least 6 characters",
      passwordsDoNotMatch: "Passwords do not match",
      mustAgreeTerms: "Please accept the terms of service",
      loginError: "Invalid phone number or password",
      regError: "Registration error. Please check your data.",
      backBtn: "Back",
      close: "Close",
      protectedBadge: "Protected by igraem.kz • JWT Session",
    },
  },
};
