import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  X,
  Check,
  Eye,
  EyeOff,
  User,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Mail,
  ShieldCheck
} from 'lucide-react';
import { api, UserProfile } from '../services/api';
import { Language, LANGUAGE_NAMES, translations } from '../i18n/translations';

interface AuthScreenProps {
  onSuccess: (user: UserProfile) => void;
  onClose?: () => void;
  currentLang?: Language;
  onLanguageChange?: (lang: Language) => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Formats 10 subscriber digits into Kazakhstan mask: (XXX) XXX-XX-XX
 */
export const formatKazakhstanPhoneDigits = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');

  let clean10 = digits;
  if ((digits.startsWith('7') || digits.startsWith('8')) && digits.length >= 11) {
    clean10 = digits.slice(1, 11);
  } else {
    clean10 = digits.slice(0, 10);
  }

  let formatted = '';
  if (clean10.length > 0) {
    formatted += `(${clean10.slice(0, 3)}`;
  }
  if (clean10.length >= 3) {
    formatted += `) ${clean10.slice(3, 6)}`;
  }
  if (clean10.length >= 6) {
    formatted += `-${clean10.slice(6, 8)}`;
  }
  if (clean10.length >= 8) {
    formatted += `-${clean10.slice(8, 10)}`;
  }

  return formatted;
};

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onSuccess,
  onClose,
  currentLang: currentLangProp,
  onLanguageChange,
}) => {
  // Main Screen View: 'login' | 'register' | 'forgot-password'
  const [authView, setAuthView] = useState<'login' | 'register' | 'forgot-password'>('login');

  // Language Selector State (with localStorage sync)
  const [internalLang, setInternalLang] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('language') as Language;
      if (saved && (saved === 'ru' || saved === 'kk' || saved === 'en')) {
        return saved;
      }
    }
    return currentLangProp || 'ru';
  });

  const activeLang: Language = currentLangProp || internalLang;
  const t = translations[activeLang]?.auth || translations.ru.auth;

  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);

  const handleSelectLanguage = (lang: Language) => {
    setInternalLang(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', lang);
    }
    if (onLanguageChange) {
      onLanguageChange(lang);
    }
    setIsLangDropdownOpen(false);
  };

  // --- Login State ---
  const [loginPhoneDigits, setLoginPhoneDigits] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // --- Registration State ---
  const [regFullName, setRegFullName] = useState('');
  const [regPhoneDigits, setRegPhoneDigits] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  // --- Forgot Password State ---
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSentSuccess, setForgotSentSuccess] = useState(false);

  // Status & Error
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fullLoginPhone = `+7 ${formatKazakhstanPhoneDigits(loginPhoneDigits)}`;
  const fullRegPhone = `+7 ${formatKazakhstanPhoneDigits(regPhoneDigits)}`;

  const GOOGLE_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '93930160138-eop34c99jsjd2ni4uaovoeomgir3ihsq.apps.googleusercontent.com';

  // Google OAuth Popup Trigger
  const handleGoogleAuthClick = () => {
    if (typeof window === 'undefined') return;

    // 1. Preferred Token Client (standard Google OAuth account selector popup)
    if ((window as any).google?.accounts?.oauth2) {
      try {
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'openid email profile',
          callback: async (tokenResponse: any) => {
            if (tokenResponse?.error) {
              console.warn('Google OAuth cancelled or error:', tokenResponse);
              return;
            }
            if (tokenResponse?.access_token) {
              setLoading(true);
              setErrorMsg('');
              try {
                const res = await api.googleAuth(tokenResponse.access_token);
                if (res && res.success && res.data?.user) {
                  onSuccess(res.data.user);
                } else {
                  setErrorMsg(res.message || t.loginError);
                }
              } catch (err: any) {
                setErrorMsg(err.message || t.loginError);
              } finally {
                setLoading(false);
              }
            }
          },
        });
        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (e) {
        console.warn('OAuth2 TokenClient init error:', e);
      }
    }

    // 2. Fallback to Google ID client prompt
    if ((window as any).google?.accounts?.id) {
      (window as any).google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        auto_select: false,
        callback: async (response: any) => {
          if (!response || !response.credential) return;
          setLoading(true);
          setErrorMsg('');
          try {
            const res = await api.googleAuth(response.credential);
            if (res && res.success && res.data?.user) {
              onSuccess(res.data.user);
            } else {
              setErrorMsg(res.message || t.loginError);
            }
          } catch (err: any) {
            setErrorMsg(err.message || t.loginError);
          } finally {
            setLoading(false);
          }
        },
      });
      (window as any).google.accounts.id.prompt();
    }
  };

  // Generic phone input handler (extracts 10 clean subscriber digits)
  const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) => {
    const rawVal = e.target.value;
    const digits = rawVal.replace(/\D/g, '');

    let clean10 = digits;
    if ((digits.startsWith('7') || digits.startsWith('8')) && digits.length >= 11) {
      clean10 = digits.slice(1, 11);
    } else {
      clean10 = digits.slice(0, 10);
    }

    setter(clean10);
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginPhoneDigits.length < 10) {
      setErrorMsg(t.enterFullPhone);
      return;
    }
    if (!loginPassword.trim()) {
      setErrorMsg(t.enterPassword);
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await api.login(fullLoginPhone, loginPassword.trim());
      if (res && res.success && res.data?.user) {
        onSuccess(res.data.user);
      } else {
        setErrorMsg(res.message || t.loginError);
      }
    } catch (err: any) {
      setErrorMsg(err.message || t.loginError);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPhoneDigits.length < 10) {
      setErrorMsg(t.enterFullPhone);
      return;
    }
    if (!regEmail.trim() || !EMAIL_REGEX.test(regEmail.trim())) {
      setErrorMsg(t.invalidEmail);
      return;
    }
    if (!regFullName.trim()) {
      setErrorMsg(t.fullNameLabel);
      return;
    }
    if (regPassword.length < 6) {
      setErrorMsg(t.passwordMinLength);
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMsg(t.passwordsDoNotMatch);
      return;
    }
    if (!agreeToTerms) {
      setErrorMsg(t.mustAgreeTerms);
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await api.register({
        full_name: regFullName.trim(),
        phone: fullRegPhone,
        email: regEmail.trim().toLowerCase(),
        password: regPassword.trim(),
        confirmPassword: regConfirmPassword.trim(),
      });

      if (res && res.success && res.data?.user) {
        onSuccess(res.data.user);
      } else {
        setErrorMsg(res.message || t.regError);
      }
    } catch (err: any) {
      setErrorMsg(err.message || t.regError);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim() || !EMAIL_REGEX.test(forgotEmail.trim())) {
      setErrorMsg(t.invalidEmail);
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      await api.forgotPassword(forgotEmail.trim().toLowerCase());
      setForgotSentSuccess(true);
      setSuccessMsg('');
    } catch (err: any) {
      setErrorMsg(err.message || t.regError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-6 bg-white text-slate-900 w-full relative overflow-y-auto min-h-full">
      <div className="pt-1">
        {/* ======================================================== */}
        {/* TOP HEADER: 3-Column Layout (Back | Language | Close)    */}
        {/* ======================================================== */}
        <div className="mb-6 flex items-center justify-between relative w-full">
          {/* Left: Round Back button (Chevron only) or empty placeholder */}
          <div className="w-9 h-9 flex items-center justify-start shrink-0">
            {authView !== 'login' ? (
              <button
                type="button"
                onClick={() => {
                  setAuthView('login');
                  setErrorMsg('');
                  setSuccessMsg('');
                  setForgotSentSuccess(false);
                }}
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 flex items-center justify-center text-slate-700 hover:text-slate-900 transition cursor-pointer"
                title={t.backBtn || 'Назад'}
              >
                <ChevronLeft className="w-5 h-5 text-slate-700" />
              </button>
            ) : (
              <div className="w-9 h-9" />
            )}
          </div>

          {/* Center: Language Switcher Dropdown (Strictly Centered) */}
          <div className="relative flex justify-center">
            <button
              type="button"
              onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer select-none"
            >
              <span>{LANGUAGE_NAMES[activeLang] || 'Русский'}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isLangDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isLangDropdownOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-32 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-30 animate-fade-in">
                <button
                  type="button"
                  onClick={() => handleSelectLanguage('ru')}
                  className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors ${activeLang === 'ru' ? 'text-[#00B050] bg-[#E8F8F0] font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  Русский
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectLanguage('kk')}
                  className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors ${activeLang === 'kk' ? 'text-[#00B050] bg-[#E8F8F0] font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  Қазақша
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectLanguage('en')}
                  className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors ${activeLang === 'en' ? 'text-[#00B050] bg-[#E8F8F0] font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  English
                </button>
              </div>
            )}
          </div>

          {/* Right: Close Button ✕ (Always present if onClose is provided) */}
          <div className="w-9 h-9 flex items-center justify-end shrink-0">
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer"
                title={t.close || 'Закрыть'}
              >
                <X className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-9 h-9" />
            )}
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-600 animate-fade-in flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Global Success Banner */}
        {successMsg && !forgotSentSuccess && (
          <div className="mb-4 p-3.5 bg-[#E8F8F0] border border-[#00B050]/30 rounded-2xl text-xs font-bold text-[#00B050] animate-fade-in flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#00B050] shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 1: LOGIN                                            */}
        {/* ======================================================== */}
        {authView === 'login' && (
          <div className="animate-fade-in">
            {/* Header Title */}
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-black text-[#0F172A] tracking-tight mb-1">
                {t.title}
              </h1>
              <p className="text-xs text-slate-500">
                {t.subtitle}
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              {/* Phone Input */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                  {t.phoneLabel}
                </label>
                <div className="flex items-center bg-white border border-slate-300 focus-within:border-[#00B050] focus-within:ring-1 focus-within:ring-[#00B050] rounded-xl overflow-hidden transition-all shadow-xs">
                  <div className="flex items-center gap-1.5 px-3.5 py-3.5 bg-slate-50 border-r border-slate-200 shrink-0 select-none">
                    <span className="text-lg leading-none">🇰🇿</span>
                    <span className="text-sm font-bold text-slate-800">+7</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={formatKazakhstanPhoneDigits(loginPhoneDigits)}
                    onChange={(e) => handlePhoneInputChange(e, setLoginPhoneDigits)}
                    placeholder="(771) 000-00-00"
                    required
                    autoFocus
                    className="w-full py-3.5 px-3 text-slate-900 font-semibold text-sm outline-none font-mono placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                  {t.passwordLabel}
                </label>
                <div className="flex items-center bg-white border border-slate-300 focus-within:border-[#00B050] focus-within:ring-1 focus-within:ring-[#00B050] rounded-xl px-3.5 py-3.5 transition-all shadow-xs">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder={t.passwordPlaceholder}
                    required
                    className="w-full bg-transparent text-slate-900 font-semibold text-sm outline-none placeholder:text-slate-400 placeholder:font-normal"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* «Forgot password?» strictly UNDER password field, centered */}
              <div className="text-center pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setAuthView('forgot-password');
                    setErrorMsg('');
                    setSuccessMsg('');
                    setForgotSentSuccess(false);
                  }}
                  className="text-xs text-[#00B050] hover:text-[#009644] font-medium hover:underline cursor-pointer transition-colors"
                >
                  {t.forgotPassword}
                </button>
              </div>

              {/* Primary Action Button */}
              <button
                type="submit"
                disabled={loading || loginPhoneDigits.length < 10 || !loginPassword.trim()}
                className="w-full bg-[#00B050] hover:bg-[#009644] active:scale-[0.99] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-md shadow-[#00B050]/20 transition-all text-base disabled:opacity-50 mt-3 cursor-pointer"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span>{t.submitButton}</span>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-5 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-slate-400 font-medium">{t.orDivider}</span>
              </div>
            </div>

            {/* Google Circular Button */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleGoogleAuthClick}
                disabled={loading}
                title={t.googleAuthTitle}
                className="w-12 h-12 rounded-full bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 hover:border-slate-300 flex items-center justify-center shadow-xs hover:shadow-sm transition-all cursor-pointer select-none"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.26 21.36 7.34 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.97 0 12s.46 3.84 1.26 5.42l4.02-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
              </button>
            </div>

            {/* Bottom Registration Block */}
            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-sm text-gray-500 mb-3">{t.notRegisteredText}</p>
              <button
                type="button"
                onClick={() => {
                  setAuthView('register');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="w-full h-12 bg-[#E6F6EC] hover:bg-[#DCF3E5] active:bg-[#CDEED9] active:scale-[0.99] text-[#00A859] font-bold text-base rounded-xl flex items-center justify-center transition-all cursor-pointer select-none"
              >
                {t.registerButton}
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 2: FORGOT PASSWORD                                  */}
        {/* ======================================================== */}
        {authView === 'forgot-password' && (
          <div className="animate-fade-in">
            {forgotSentSuccess ? (
              <div className="text-center py-6 space-y-5 animate-fade-in">
                {/* Success Checkmark Circle Badge */}
                <div className="w-16 h-16 bg-[#E8F8F0] border-2 border-[#00B050]/20 rounded-full flex items-center justify-center mx-auto text-[#00B050] shadow-sm">
                  <Check className="w-8 h-8 stroke-[2.5px]" />
                </div>

                {/* Title & Dynamic Email */}
                <div className="space-y-2">
                  <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">
                    {t.letterSent}
                  </h1>
                  <p className="text-sm font-bold text-slate-700 break-all px-2">
                    {forgotEmail}
                  </p>
                </div>

                {/* Full Width Close Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (onClose) {
                      onClose();
                    }
                    setAuthView('login');
                    setErrorMsg('');
                    setSuccessMsg('');
                    setForgotSentSuccess(false);
                  }}
                  className="w-full bg-[#00B050] hover:bg-[#009644] active:scale-[0.99] text-white font-bold py-3.5 rounded-xl transition-all text-base mt-6 cursor-pointer shadow-md shadow-[#00B050]/20"
                >
                  {t.backToLoginBtn || t.close || 'Закрыть'}
                </button>
              </div>
            ) : (
              <>
                <div className="mb-6 text-center">
                  <h1 className="text-2xl font-black text-[#0F172A] tracking-tight mb-1">
                    {t.forgotTitle}
                  </h1>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {t.forgotSubtitle}
                  </p>
                </div>

                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                      {t.emailLabel}
                    </label>
                    <div className="flex items-center bg-white border border-slate-300 focus-within:border-[#00B050] focus-within:ring-1 focus-within:ring-[#00B050] rounded-xl px-3.5 py-3.5 transition-all shadow-xs">
                      <Mail className="w-4 h-4 text-slate-400 mr-2.5 shrink-0" />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder={t.emailPlaceholder}
                        required
                        autoFocus
                        className="w-full bg-transparent text-slate-900 font-semibold text-sm outline-none placeholder:text-slate-400 placeholder:font-normal"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !forgotEmail.trim()}
                    className="w-full bg-[#00B050] hover:bg-[#009644] active:scale-[0.99] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-md shadow-[#00B050]/20 transition-all text-base disabled:opacity-50 mt-5 cursor-pointer"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <span>{t.sendLinkButton}</span>
                    )}
                  </button>
                </form>

                <div className="mt-8 pt-5 border-t border-slate-100 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthView('login');
                      setErrorMsg('');
                      setSuccessMsg('');
                      setForgotSentSuccess(false);
                    }}
                    className="text-xs font-medium text-[#00B050] hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{t.backToLogin}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* ======================================================== */}
        {/* VIEW 3: REGISTRATION                                     */}
        {/* ======================================================== */}
        {authView === 'register' && (
          <div className="animate-fade-in">
            <div className="mb-5 text-center">
              <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">
                {t.regTitle}
              </h1>
              {t.regSubtitle && (
                <p className="text-xs text-slate-500 mt-1">
                  {t.regSubtitle}
                </p>
              )}
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {/* 1. Phone Number */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t.phoneLabel}
                </label>
                <div className="flex items-center bg-white border border-slate-300 focus-within:border-[#00B050] focus-within:ring-1 focus-within:ring-[#00B050] rounded-xl overflow-hidden transition-all shadow-xs">
                  <div className="flex items-center gap-1.5 px-3.5 py-3 bg-slate-50 border-r border-slate-200 shrink-0 select-none">
                    <span className="text-lg leading-none">🇰🇿</span>
                    <span className="text-sm font-bold text-slate-800">+7</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={formatKazakhstanPhoneDigits(regPhoneDigits)}
                    onChange={(e) => handlePhoneInputChange(e, setRegPhoneDigits)}
                    placeholder="(771) 000-00-00"
                    required
                    autoFocus
                    className="w-full bg-transparent py-3 px-3 text-slate-900 font-semibold text-sm outline-none font-mono placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
              </div>

              {/* 2. Email */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t.emailLabel}
                </label>
                <div className="flex items-center bg-white border border-slate-300 focus-within:border-[#00B050] focus-within:ring-1 focus-within:ring-[#00B050] rounded-xl px-3.5 py-3 transition-all shadow-xs">
                  <Mail className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder={t.emailPlaceholder}
                    required
                    className="w-full bg-transparent text-slate-900 font-semibold text-sm outline-none placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
              </div>

              {/* 3. Full Name */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t.fullNameLabel}
                </label>
                <div className="flex items-center bg-white border border-slate-300 focus-within:border-[#00B050] focus-within:ring-1 focus-within:ring-[#00B050] rounded-xl px-3.5 py-3 transition-all shadow-xs">
                  <User className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder={t.fullNamePlaceholder}
                    required
                    className="w-full bg-transparent text-slate-900 font-semibold text-sm outline-none placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
              </div>

              {/* 4. Password */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t.passwordLabel}
                </label>
                <div className="flex items-center bg-white border border-slate-300 focus-within:border-[#00B050] focus-within:ring-1 focus-within:ring-[#00B050] rounded-xl px-3.5 py-3 transition-all shadow-xs">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder={t.regPasswordPlaceholder}
                    required
                    className="w-full bg-transparent text-slate-900 font-semibold text-sm outline-none placeholder:text-slate-400 placeholder:font-normal"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 5. Confirm Password */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t.confirmPasswordLabel}
                </label>
                <div className="flex items-center bg-white border border-slate-300 focus-within:border-[#00B050] focus-within:ring-1 focus-within:ring-[#00B050] rounded-xl px-3.5 py-3 transition-all shadow-xs">
                  <input
                    type={showRegConfirmPassword ? 'text' : 'password'}
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder={t.confirmPasswordPlaceholder}
                    required
                    className="w-full bg-transparent text-slate-900 font-semibold text-sm outline-none placeholder:text-slate-400 placeholder:font-normal"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                    className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {showRegConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 6. Terms Checkbox */}
              <label
                onClick={() => setAgreeToTerms(!agreeToTerms)}
                className="flex items-start gap-3 pt-1 select-none cursor-pointer group"
              >
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200 ${
                    agreeToTerms
                      ? 'bg-[#00A859] border-2 border-[#00A859] shadow-xs'
                      : 'bg-white border-2 border-slate-300 group-hover:border-[#00A859]'
                  }`}
                >
                  {agreeToTerms && (
                    <Check className="w-3.5 h-3.5 text-white stroke-[3px] animate-fade-in" />
                  )}
                </div>
                <span className="text-xs text-slate-600 leading-snug">
                  {t.agreeTerms}{' '}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="text-[#00A859] font-semibold underline hover:text-[#008f4c]"
                  >
                    {t.termsLink}
                  </span>{' '}
                  {t.agreeTermsEnd}
                </span>
              </label>

              {/* Primary Action Button */}
              <button
                type="submit"
                disabled={loading || !regFullName.trim() || regPhoneDigits.length < 10 || !regEmail.trim() || !regPassword || !regConfirmPassword || !agreeToTerms}
                className="w-full bg-[#00B050] hover:bg-[#009644] active:scale-[0.99] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-md shadow-[#00B050]/20 transition-all text-base disabled:opacity-50 mt-4 cursor-pointer"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span>{t.registerButton}</span>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-5 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-slate-400 font-medium">{t.orRegisterDivider || t.orDivider}</span>
              </div>
            </div>

            {/* Google Circular Button */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleGoogleAuthClick}
                disabled={loading}
                title={t.googleAuthTitle}
                className="w-12 h-12 rounded-full bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 hover:border-slate-300 flex items-center justify-center shadow-xs hover:shadow-sm transition-all cursor-pointer select-none"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.26 21.36 7.34 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.97 0 12s.46 3.84 1.26 5.42l4.02-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
              </button>
            </div>

            {/* Bottom Login Switch Block */}
            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-sm text-gray-500 mb-3">{t.alreadyRegisteredText}</p>
              <button
                type="button"
                onClick={() => {
                  setAuthView('login');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="w-full h-12 bg-[#E6F6EC] hover:bg-[#DCF3E5] active:bg-[#CDEED9] active:scale-[0.99] text-[#00A859] font-bold text-base rounded-xl flex items-center justify-center transition-all cursor-pointer select-none"
              >
                {t.loginLinkButton}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Security Badge */}
      <div className="pb-1 pt-6 border-t border-slate-100 flex items-center justify-center gap-1.5 text-slate-400 text-xs font-medium">
        <ShieldCheck className="w-4 h-4 text-[#00B050]" />
        <span>{t.protectedBadge}</span>
      </div>
    </div>
  );
};
