import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Phone,
  Calendar as CalendarIcon,
  MapPin,
  Globe,
  Smartphone,
  ChevronRight,
  X,
  Check,
  Unlock,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  ArrowRight,
  Plus,
  Pencil,
  Bell
} from 'lucide-react';
import { CityName, Venue } from '../types';
import { Language, LANGUAGE_NAMES, translations } from '../i18n/translations';
import { UserProfile, api } from '../services/api';
import { registerServiceWorkerAndSubscribe, isPushSupported } from '../utils/webPush';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isStubOrEmptyEmail = (email?: string | null): boolean => {
  if (!email || !email.trim()) return true;
  const trimmed = email.trim().toLowerCase();
  return trimmed.startsWith('unique_') || (trimmed.endsWith('@igraem.kz') && trimmed.startsWith('test_'));
};

interface ProfileTabProps {
  userProfile?: UserProfile | null;
  userPhone: string;
  currentCity: CityName;
  currentLang: Language;
  onSelectLang: (lang: Language) => void;
  onLogout: () => void;
  onProfileUpdated?: (updatedProfile: UserProfile) => void;
  bookings?: any[];
  venues?: Venue[];
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  userProfile,
  userPhone,
  currentCity,
  currentLang,
  onSelectLang,
  onLogout,
  onProfileUpdated,
  bookings = [],
  venues = [],
}) => {
  const t = translations[currentLang];

  const [isLangModalOpen, setIsLangModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);

  // Email Binding & Editing State & Modal
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailStep, setEmailStep] = useState<'input' | 'code'>('input');
  const [emailInput, setEmailInput] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [localEmail, setLocalEmail] = useState<string>(userProfile?.email || '');

  // Admin Force Unlock Modal & Toast State
  const [isForceUnlockModalOpen, setIsForceUnlockModalOpen] = useState(false);
  const [selectedGroundId, setSelectedGroundId] = useState<string>('');
  const [isForceUnlocking, setIsForceUnlocking] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (userProfile?.email !== undefined) {
      setLocalEmail(userProfile.email || '');
    }
  }, [userProfile]);

  // Default selected venue
  useEffect(() => {
    if (venues && venues.length > 0 && !selectedGroundId) {
      setSelectedGroundId(venues[0].id);
    }
  }, [venues, selectedGroundId]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleConfirmForceUnlock = async () => {
    setIsForceUnlocking(true);
    try {
      const res = await api.adminForceUnlock({ groundId: selectedGroundId || undefined });
      if (res.success) {
        setIsForceUnlockModalOpen(false);
        showToast(res.message || 'Замок успешно открыт в принудительном режиме!', 'success');
      } else {
        showToast(res.message || 'Ошибка при открытии замка', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Ошибка сети при экстренном открытии замка', 'error');
    } finally {
      setIsForceUnlocking(false);
    }
  };

  const targetVenue = (venues || []).find((v) => v.id === selectedGroundId) || (venues && venues[0]) || { title: 'Школа №11' };

  // Settings Toggles state & Web Push (Disabled by default)
  const [remindersEnabled, setRemindersEnabled] = useState<boolean>(userProfile?.notify_30min ?? false);
  const [isTogglingReminders, setIsTogglingReminders] = useState(false);

  // Sync with userProfile and fetch server status on load
  useEffect(() => {
    if (userProfile?.notify_30min !== undefined) {
      setRemindersEnabled(userProfile.notify_30min);
    }
    api.getNotificationStatus()
      .then((res) => {
        if (res.success && res.data) {
          setRemindersEnabled(res.data.notify_30min);
        }
      })
      .catch((e) => console.warn('[ProfileTab] Could not fetch notification status:', e));
  }, [userProfile]);

  const handleToggleReminders = async () => {
    if (isTogglingReminders) return;
    setIsTogglingReminders(true);

    try {
      if (!remindersEnabled) {
        // Turning ON
        if (!isPushSupported()) {
          throw new Error('Ваш браузер не поддерживает Web Push уведомления');
        }

        // 1. Get VAPID key
        const { publicKey } = await api.getVapidPublicKey();
        if (!publicKey) {
          throw new Error('Не удалось получить ключ VAPID от сервера');
        }

        // 2. Register Service Worker & subscribe
        const subscription = await registerServiceWorkerAndSubscribe(publicKey);
        if (!subscription) {
          throw new Error('Не удалось создать подписку Web Push');
        }

        // 3. Send subscription to backend
        await api.subscribePushNotifications({
          subscription,
          notify30min: true,
        });

        setRemindersEnabled(true);
        showToast('Напоминания о бронях за 30 минут успешно включены! ⚽', 'success');
      } else {
        // Turning OFF
        await api.toggleReminders(false);
        setRemindersEnabled(false);
        showToast('Напоминания о бронях отключены', 'success');
      }
    } catch (err: any) {
      console.error('[handleToggleReminders error]', err);
      showToast(err.message || 'Ошибка настройки уведомлений', 'error');
    } finally {
      setIsTogglingReminders(false);
    }
  };

  const [isSendingTestPush, setIsSendingTestPush] = useState(false);

  const handleSendTestPush = async () => {
    if (isSendingTestPush) return;
    setIsSendingTestPush(true);
    try {
      const res = await api.sendTestPush();
      if (res && res.success) {
        showToast('Тестовое Web Push уведомление отправлено! 🔔', 'success');
      } else {
        showToast(res.message || 'Не удалось отправить тестовое уведомление', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Ошибка отправки тестового уведомления', 'error');
    } finally {
      setIsSendingTestPush(false);
    }
  };

  // --- Email Binding Handlers ---
  const handleOpenEmailModal = () => {
    setIsEmailModalOpen(true);
    setEmailStep('input');
    setEmailError('');
    setEmailSuccess('');
    setEmailInput(isStubOrEmptyEmail(localEmail) ? '' : localEmail);
    setVerificationCode('');
  };

  const handleSendEmailVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');

    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      setEmailError('Укажите корректный адрес электронной почты (например, user@example.kz)');
      return;
    }

    setEmailLoading(true);
    try {
      const res = await api.sendEmailVerification(cleanEmail);
      if (res.success) {
        setEmailStep('code');
        setEmailSuccess(res.message || 'Код подтверждения отправлен на указанную почту');
      } else {
        setEmailError(res.message || 'Не удалось отправить код');
      }
    } catch (err: any) {
      setEmailError(err.message || 'Ошибка отправки кода подтверждения');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');

    const cleanCode = verificationCode.trim();
    if (cleanCode.length !== 6) {
      setEmailError('Введите 6-значный код из письма');
      return;
    }

    setEmailLoading(true);
    try {
      const res = await api.verifyEmail(cleanCode);
      if (res.success) {
        const confirmed = res.email || emailInput.trim().toLowerCase();
        setLocalEmail(confirmed);
        if (userProfile) {
          const updated = { ...userProfile, email: confirmed };
          onProfileUpdated?.(updated);
        }
        setIsEmailModalOpen(false);
        showToast('Email успешно обновлен!', 'success');
      } else {
        setEmailError(res.message || 'Неверный код подтверждения');
      }
    } catch (err: any) {
      setEmailError(err.message || 'Неверный или истекший код подтверждения');
    } finally {
      setEmailLoading(false);
    }
  };

  const displayName = userProfile?.full_name || 'Пользователь';
  const hasBoundEmail = !isStubOrEmptyEmail(localEmail);

  // Calculate actual played hours from completed/active bookings (1 hour per slot)
  const completedCount = bookings.filter((b) => b.status === 'completed').length;
  const hoursPlayed = completedCount * 1;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50 text-slate-900 w-full animate-fade-in pb-24">
      {/* Toast Banner */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold animate-fade-in flex items-center gap-2 ${
            toastMessage.type === 'success'
              ? 'bg-[#E8F8F0] border border-[#00B050]/30 text-[#00B050]'
              : 'bg-rose-50 border border-rose-200 text-rose-600'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* BLOCK 1: Игрок + Статистика (Сыграно часов & Любимый спорт) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl pt-4 px-4 pb-2 shadow-xs space-y-3">
        <div className="text-center pt-1">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {displayName}
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#F8FAFC] border border-slate-100 rounded-xl p-3 text-center space-y-0.5">
            <div className="text-lg font-black text-slate-900">
              {hoursPlayed}
            </div>
            <div className="text-[11px] font-semibold text-slate-400">
              {t.hoursPlayed}
            </div>
          </div>
          <div className="bg-[#F8FAFC] border border-slate-100 rounded-xl p-3 text-center space-y-0.5">
            <div className="text-lg font-black text-slate-900">
              ⚽
            </div>
            <div className="text-[11px] font-semibold text-slate-400">
              {t.favSport}
            </div>
          </div>
        </div>
      </div>

      {/* BLOCK 2: Профиль (Имя, Телефон, ИИН, Email) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl pt-4 px-4 pb-1 shadow-xs space-y-1">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          {t.sectionProfile}
        </div>
        <div className="divide-y divide-slate-100">
          {/* Имя */}
          <div className="py-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5 font-semibold text-slate-800">
              <UserIcon className="w-4 h-4 text-slate-400" />
              <span>{t.name}</span>
            </div>
            <span className="text-slate-400 font-medium">{displayName}</span>
          </div>

          {/* Телефон */}
          <div className="py-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5 font-semibold text-slate-800">
              <Phone className="w-4 h-4 text-slate-400" />
              <span>{t.phone}</span>
            </div>
            <span className="text-slate-400 font-medium">{userProfile?.phone_number || userPhone}</span>
          </div>

          {/* ИИН */}
          <div className="py-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5 font-semibold text-slate-800">
              <CalendarIcon className="w-4 h-4 text-slate-400" />
              <span>ИИН</span>
            </div>
            <span className="text-slate-400 font-medium font-mono">{userProfile?.iin || '—'}</span>
          </div>

          {/* Email */}
          <div className="py-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5 font-semibold text-slate-800">
              <Mail className="w-4 h-4 text-slate-400" />
              <span>Email</span>
            </div>
            {hasBoundEmail ? (
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium font-mono truncate max-w-[150px] text-right" title={localEmail}>
                  {localEmail}
                </span>
                <button
                  type="button"
                  onClick={handleOpenEmailModal}
                  className="p-1 rounded-lg text-slate-400 hover:text-[#00B050] hover:bg-emerald-50 border border-transparent hover:border-emerald-200/60 transition-all cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                  title="Изменить email"
                >
                  <Pencil className="w-3.5 h-3.5 text-[#00B050]" />
                  <span className="text-[#00B050]">Изменить</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200 select-none">
                  Не привязан
                </span>
                <button
                  type="button"
                  onClick={handleOpenEmailModal}
                  className="text-[11px] font-bold text-[#00B050] hover:underline flex items-center gap-0.5 cursor-pointer bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg transition-colors border border-emerald-200/60"
                >
                  <Plus className="w-3 h-3" />
                  <span>Привязать</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BLOCK 3: Уведомления */}
      <div className="bg-white border border-slate-200/80 rounded-2xl pt-4 px-4 pb-3 shadow-xs space-y-2">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          {t.sectionNotifications}
        </div>
        <div className="py-1 flex items-center justify-between text-xs">
          <div className="pr-4">
            <span className="font-semibold text-slate-800 block">
              Web Push уведомления
            </span>
            <span className="text-[11px] text-slate-400 font-medium block pt-0.5">
              Входящие запросы игроков и напоминания за 30 мин (звук + вибрация)
            </span>
          </div>
          <button
            type="button"
            disabled={isTogglingReminders}
            onClick={handleToggleReminders}
            className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center shrink-0 cursor-pointer ${
              remindersEnabled ? 'bg-[#00B050] justify-end' : 'bg-slate-300 justify-start'
            } ${isTogglingReminders ? 'opacity-50' : ''}`}
          >
            {isTogglingReminders ? (
              <Loader2 className="w-4 h-4 text-white animate-spin mx-auto" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-white shadow-xs" />
            )}
          </button>
        </div>

        {remindersEnabled && (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">
              Проверка работы на устройстве:
            </span>
            <button
              type="button"
              disabled={isSendingTestPush}
              onClick={handleSendTestPush}
              className="text-xs font-bold text-[#00B050] hover:text-[#009040] bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
            >
              {isSendingTestPush ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Bell className="w-3 h-3" />
              )}
              <span>Тест Push</span>
            </button>
          </div>
        )}
      </div>

      {/* BLOCK 4: Приложение */}
      <div className="bg-white border border-slate-200/80 rounded-2xl pt-4 px-4 pb-1 shadow-xs space-y-1">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          {t.sectionApp}
        </div>
        <div className="divide-y divide-slate-100">
          {/* Язык */}
          <div
            onClick={() => setIsLangModalOpen(true)}
            className="py-2.5 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50 transition-colors -mx-4 px-4"
          >
            <div className="flex items-center gap-2.5 font-semibold text-slate-800">
              <Globe className="w-4 h-4 text-slate-400" />
              <span>{t.language}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span>{LANGUAGE_NAMES[currentLang]}</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            </div>
          </div>

          {/* О приложении */}
          <div
            onClick={() => setIsAboutModalOpen(true)}
            className="py-2.5 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50 transition-colors -mx-4 px-4"
          >
            <div className="flex items-center gap-2.5 font-semibold text-slate-800">
              <Smartphone className="w-4 h-4 text-slate-400" />
              <span>{t.aboutApp}</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          </div>
        </div>
      </div>

      {/* BLOCK 5: Экстренное открытие замка (Admin / Emergency Access) */}
      {userProfile?.role === 'admin' && (
        <div className="bg-white border border-emerald-200/80 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-emerald-800">
            <ShieldAlert className="w-4 h-4 text-emerald-600 shrink-0" />
            <h3 className="text-xs font-bold uppercase tracking-wider">
              Панель администратора
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Принудительное открытие замка через Wi-Fi шлюз TTLock (Cloud API).
          </p>
          <button
            type="button"
            onClick={() => setIsForceUnlockModalOpen(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>Открыть замок принудительно</span>
          </button>
        </div>
      )}

      {/* Кнопка Выйти */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onLogout}
          className="w-full bg-[#FEE2E2]/60 hover:bg-[#FEE2E2] text-[#EF4444] font-bold py-3.5 rounded-2xl text-xs transition-colors mb-4 cursor-pointer"
        >
          {t.logout}
        </button>
      </div>

      {/* Modal: Принудительное открытие замка */}
      {isForceUnlockModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => !isForceUnlocking && setIsForceUnlockModalOpen(false)}
        >
          <div
            className="w-full max-w-[380px] bg-white border border-slate-100 rounded-3xl p-5 shadow-2xl space-y-4 animate-fade-in text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <ShieldAlert className="w-5 h-5 text-emerald-600" />
                <h2>Принудительное открытие</h2>
              </div>
              <button
                type="button"
                disabled={isForceUnlocking}
                onClick={() => setIsForceUnlockModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Вы собираетесь принудительно разблокировать замок на площадке{' '}
              <span className="font-bold text-slate-900">«{targetVenue.title}»</span>.
            </p>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Выберите площадку
              </label>
              <select
                value={selectedGroundId}
                onChange={(e) => setSelectedGroundId(e.target.value)}
                disabled={isForceUnlocking}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 outline-none focus:border-[#00B050]"
              >
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title} ({v.sport === 'football' ? 'Футбол' : v.sport === 'basketball' ? 'Баскетбол' : v.sport})
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                disabled={isForceUnlocking}
                onClick={() => setIsForceUnlockModalOpen(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs transition-all"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isForceUnlocking}
                onClick={handleConfirmForceUnlock}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
              >
                {isForceUnlocking ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Открытие...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Разблокировать</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Привязка / Изменение Email */}
      {isEmailModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => !emailLoading && setIsEmailModalOpen(false)}
        >
          <div
            className="w-full max-w-[380px] bg-white border border-slate-100 rounded-3xl p-5 shadow-2xl space-y-4 animate-scale-up text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100/80 text-[#00B050] flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {emailStep === 'input'
                      ? hasBoundEmail
                        ? 'Изменение Email'
                        : 'Привязка Email'
                      : 'Подтверждение Email'}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Безопасность вашего аккаунта</p>
                </div>
              </div>
              <button
                type="button"
                disabled={emailLoading}
                onClick={() => {
                  setIsEmailModalOpen(false);
                  setEmailError('');
                }}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {emailError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-semibold flex items-start gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{emailError}</span>
              </div>
            )}

            {emailSuccess && (
              <div className="p-3 bg-[#E8F8F0] border border-[#00B050]/30 rounded-xl text-xs text-[#00B050] font-semibold flex items-start gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-[#00B050] shrink-0 mt-0.5" />
                <span>{emailSuccess}</span>
              </div>
            )}

            {emailStep === 'input' ? (
              <form onSubmit={handleSendEmailVerification} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wider">
                    {hasBoundEmail ? 'Новый адрес электронной почты' : 'Адрес электронной почты'}
                  </label>
                  <div className="flex items-center bg-slate-50 border border-slate-300 focus-within:border-[#00B050] focus-within:bg-white rounded-xl px-3.5 py-3 transition-all shadow-xs">
                    <Mail className="w-4 h-4 text-slate-400 mr-2.5 shrink-0" />
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="user@example.kz"
                      required
                      autoFocus
                      className="w-full bg-transparent text-slate-900 font-bold text-sm outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 font-medium leading-relaxed">
                    На этот адрес придет 6-значный код подтверждения через сервис Resend.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={emailLoading || !emailInput.trim()}
                  className="w-full bg-[#00B050] hover:bg-[#009644] active:scale-[0.99] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-md shadow-[#00B050]/20 transition-all text-sm disabled:opacity-50 cursor-pointer"
                >
                  {emailLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Получить код</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyEmailCode} className="space-y-4">
                <div>
                  <div className="text-center pb-2">
                    <p className="text-xs text-slate-500">
                      Код отправлен на <span className="font-bold text-slate-800">{emailInput}</span>
                    </p>
                  </div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wider text-center">
                    6-значный код из письма
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    required
                    autoFocus
                    className="w-full bg-slate-50 border border-slate-300 focus:border-[#00B050] focus:bg-white rounded-xl py-3 text-center text-slate-900 font-black text-2xl tracking-[8px] outline-none font-mono transition-all shadow-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={emailLoading || verificationCode.length !== 6}
                  className="w-full bg-[#00B050] hover:bg-[#009644] active:scale-[0.99] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-md shadow-[#00B050]/20 transition-all text-sm disabled:opacity-50 cursor-pointer"
                >
                  {emailLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Подтвердить</span>
                  )}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEmailStep('input');
                      setEmailError('');
                      setEmailSuccess('');
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer underline"
                  >
                    Изменить email
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Language Selection Modal */}
      {isLangModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => !isForceUnlocking && setIsLangModalOpen(false)}
        >
          <div
            className="w-full max-w-[380px] bg-white border border-slate-100 rounded-3xl p-5 shadow-2xl space-y-4 animate-fade-in text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Globe className="w-5 h-5 text-[#00B050]" />
                <h2>{t.selectLanguageModalTitle}</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsLangModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {(['ru', 'kk', 'en'] as Language[]).map((langKey) => {
                const isSelected = currentLang === langKey;
                return (
                  <button
                    key={langKey}
                    type="button"
                    onClick={() => {
                      onSelectLang(langKey);
                      setIsLangModalOpen(false);
                    }}
                    className={`w-full p-3.5 rounded-2xl border text-xs font-bold transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#E8F8F0] border-[#00B050] text-[#00B050]'
                        : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <span>{LANGUAGE_NAMES[langKey]}</span>
                    {isSelected && <Check className="w-4 h-4 text-[#00B050] stroke-[2.5px]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* About App Modal */}
      {isAboutModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => setIsAboutModalOpen(false)}
        >
          <div
            className="w-full max-w-[380px] bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl text-center space-y-4 animate-fade-in text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 mx-auto rounded-full bg-[#E8F8F0] text-[#00B050] flex items-center justify-center font-black text-xl">
              P
            </div>
            <div>
              <h3 className="text-base font-bold">{t.appInfoTitle}</h3>
              <p className="text-xs text-slate-400 mt-1">{t.appVersion}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsAboutModalOpen(false)}
              className="w-full bg-[#00B050] hover:bg-[#009644] text-white font-bold py-3 rounded-2xl text-xs transition-all"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
