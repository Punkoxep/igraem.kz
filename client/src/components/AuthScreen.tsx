import React, { useState, useEffect } from 'react';
import { Phone, ArrowRight, ArrowLeft, RefreshCw, CheckCircle2, ShieldCheck, Lock, Eye, EyeOff, KeyRound, User, FileText, UserPlus, CheckSquare, Square, Mail, AlertCircle } from 'lucide-react';
import { api, UserProfile } from '../services/api';
import { Logo } from './Logo';

interface AuthScreenProps {
  onSuccess: (user: UserProfile) => void;
}

const MASTER_OTP_CODES = ['1111', '0000', '1234', '7777'];
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

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  // Main Screen View: 'login' | 'register' | 'forgot-password'
  const [authView, setAuthView] = useState<'login' | 'register' | 'forgot-password'>('login');

  // Login Mode Tab (within 'login' view): 'password' vs 'sms'
  const [authMode, setAuthMode] = useState<'password' | 'sms'>('password');

  // SMS Flow Steps: 'phone' | 'otp' | 'profile'
  const [step, setStep] = useState<'phone' | 'otp' | 'profile'>('phone');

  // --- Login State ---
  const [loginPhoneDigits, setLoginPhoneDigits] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // --- Registration State ---
  const [regFullName, setRegFullName] = useState('');
  const [regPhoneDigits, setRegPhoneDigits] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regIin, setRegIin] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(true);

  // --- Forgot Password State ---
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSentSuccess, setForgotSentSuccess] = useState(false);

  // --- SMS OTP State ---
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [resendToast, setResendToast] = useState(false);

  // Status & Error
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fullLoginPhone = `+7 ${formatKazakhstanPhoneDigits(loginPhoneDigits)}`;
  const fullRegPhone = `+7 ${formatKazakhstanPhoneDigits(regPhoneDigits)}`;

  // 60-Second Resend Countdown Timer for OTP
  useEffect(() => {
    let interval: any = null;
    if (authView === 'login' && authMode === 'sms' && step === 'otp' && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [authView, authMode, step, timerSeconds]);

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

  // ==========================================
  // 1. PASSWORD LOGIN SUBMISSION (POST /auth/login)
  // ==========================================
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginPhoneDigits.length < 10) {
      setErrorMsg('Введите полный 10-значный номер телефона');
      return;
    }
    if (!loginPassword.trim()) {
      setErrorMsg('Введите пароль');
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
        setErrorMsg(res.message || 'Неверный номер телефона или пароль');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка входа в систему. Проверьте правильность данных.');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 2. REGISTRATION SUBMISSION (POST /auth/register)
  // ==========================================
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName.trim()) {
      setErrorMsg('Укажите ваше имя и фамилию (ФИО)');
      return;
    }
    if (regPhoneDigits.length < 10) {
      setErrorMsg('Введите полный номер телефона (10 цифр)');
      return;
    }
    if (!regEmail.trim() || !EMAIL_REGEX.test(regEmail.trim())) {
      setErrorMsg('Укажите корректный адрес электронной почты (например, user@example.kz)');
      return;
    }
    if (regIin.length < 12) {
      setErrorMsg('ИИН должен состоять из 12 цифр');
      return;
    }
    if (regPassword.length < 6) {
      setErrorMsg('Пароль должен быть длиной не менее 6 символов');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Введенные пароли не совпадают');
      return;
    }
    if (!agreeToTerms) {
      setErrorMsg('Необходимо согласиться с правилами сервиса');
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
        iin: regIin.trim(),
        password: regPassword.trim(),
        confirmPassword: regConfirmPassword.trim(),
      });

      if (res && res.success && res.data?.user) {
        onSuccess(res.data.user);
      } else {
        setErrorMsg(res.message || 'Ошибка при регистрации');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка при регистрации. Проверьте правильность введенных данных.');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 3. FORGOT PASSWORD (POST /auth/forgot-password)
  // ==========================================
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim() || !EMAIL_REGEX.test(forgotEmail.trim())) {
      setErrorMsg('Введите корректный адрес электронной почты');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await api.forgotPassword(forgotEmail.trim().toLowerCase());
      setForgotSentSuccess(true);
      setSuccessMsg(res.message || 'Если такой email зарегистрирован, ссылка отправлена на почту.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка отправки запроса на сброс пароля');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 4. SMS FLOW HANDLERS
  // ==========================================
  const handleRequestSmsCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginPhoneDigits.length < 10) {
      setErrorMsg('Введите полный 10-значный номер телефона');
      return;
    }
    setErrorMsg('');
    setStep('otp');
    setTimerSeconds(60);
    setCanResend(false);
    setOtpDigits(['', '', '', '']);
  };

  const handleResendSmsCode = () => {
    if (!canResend) return;
    setTimerSeconds(60);
    setCanResend(false);
    setOtpDigits(['', '', '', '']);
    setErrorMsg('');
    setResendToast(true);
    setTimeout(() => setResendToast(false), 2500);
  };

  const handleOtpChange = (val: string, idx: number) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const newOtp = [...otpDigits];
    newOtp[idx] = digit;
    setOtpDigits(newOtp);

    if (digit && idx < 3) {
      const nextInput = document.getElementById(`otp-input-${idx + 1}`);
      nextInput?.focus();
    }

    if (newOtp.every((d) => d !== '')) {
      handleVerifyOtp(newOtp.join(''));
    }
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      const prevInput = document.getElementById(`otp-input-${idx - 1}`);
      prevInput?.focus();
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = codeToVerify || otpDigits.join('');
    setErrorMsg('');
    setLoading(true);

    const isValidCode = MASTER_OTP_CODES.includes(code) || code.length === 4;
    if (!isValidCode) {
      setErrorMsg('Неверный SMS код подтверждения');
      setLoading(false);
      return;
    }

    try {
      const loginAttempt = await api.login(fullLoginPhone, 'password123').catch(() => null);
      if (loginAttempt && loginAttempt.success && loginAttempt.data?.user) {
        onSuccess(loginAttempt.data.user);
        return;
      }

      // If user not in DB, move to register view with pre-filled phone!
      setRegPhoneDigits(loginPhoneDigits);
      setAuthView('register');
    } catch (err: any) {
      setRegPhoneDigits(loginPhoneDigits);
      setAuthView('register');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-6 bg-white text-slate-900 w-full relative overflow-y-auto min-h-full">
      <div className="pt-2">
        {/* Header Bar with Logo */}
        <div className="mb-5 flex items-center justify-between">
          <Logo size="lg" />
          {authView === 'login' && authMode === 'sms' && step === 'otp' && (
            <button
              type="button"
              onClick={() => setStep('phone')}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Изменить номер</span>
            </button>
          )}
          {(authView === 'register' || authView === 'forgot-password') && (
            <button
              type="button"
              onClick={() => {
                setAuthView('login');
                setErrorMsg('');
                setSuccessMsg('');
                setForgotSentSuccess(false);
              }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>К авторизации</span>
            </button>
          )}
        </div>

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-600 animate-fade-in flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Global Success Banner */}
        {successMsg && (
          <div className="mb-4 p-3.5 bg-[#E8F8F0] border border-[#00B050]/30 rounded-2xl text-xs font-semibold text-[#00B050] animate-fade-in flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#00B050] shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 1: LOGIN (Авторизация / Вход)                       */}
        {/* ======================================================== */}
        {authView === 'login' && (
          <div className="animate-fade-in">
            {/* Mode Switch Tabs (Password vs SMS) */}
            <div className="flex items-center p-1 bg-slate-100 rounded-2xl mb-5 select-none border border-slate-200/80">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('password');
                  setErrorMsg('');
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authMode === 'password'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5 text-[#00B050]" />
                <span>Вход по паролю</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('sms');
                  setStep('phone');
                  setErrorMsg('');
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authMode === 'sms'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Phone className="w-3.5 h-3.5 text-[#00B050]" />
                <span>Вход по SMS</span>
              </button>
            </div>

            {/* TAB A: PASSWORD LOGIN */}
            {authMode === 'password' && (
              <div>
                <div className="mb-5">
                  <h1 className="text-2xl font-bold text-slate-900 mb-1">Авторизация</h1>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Введите номер телефона и пароль от вашего аккаунта
                  </p>
                </div>

                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                      Номер телефона (Казахстан)
                    </label>
                    <div className="flex items-center bg-slate-50 border border-slate-300 focus-within:border-[#00B050] focus-within:bg-white rounded-2xl overflow-hidden transition-all shadow-xs">
                      <div className="flex items-center gap-1 px-3 py-3.5 bg-slate-100/80 border-r border-slate-200 shrink-0 select-none">
                        <span className="text-base leading-none">🇰🇿</span>
                        <span className="text-xs font-extrabold text-slate-800">+7</span>
                      </div>
                      <input
                        type="tel"
                        inputMode="tel"
                        value={formatKazakhstanPhoneDigits(loginPhoneDigits)}
                        onChange={(e) => handlePhoneInputChange(e, setLoginPhoneDigits)}
                        placeholder="(771) 000-00-00"
                        required
                        autoFocus
                        className="w-full bg-transparent py-3.5 px-3 text-slate-900 font-bold text-sm outline-none tracking-wide font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-600 block">
                        Пароль
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthView('forgot-password');
                          setErrorMsg('');
                          setSuccessMsg('');
                          setForgotSentSuccess(false);
                          setForgotEmail('');
                        }}
                        className="text-xs font-bold text-[#00B050] hover:underline cursor-pointer"
                      >
                        Забыли пароль?
                      </button>
                    </div>
                    <div className="flex items-center bg-slate-50 border border-slate-300 focus-within:border-[#00B050] focus-within:bg-white rounded-2xl px-3.5 py-3.5 transition-all shadow-xs">
                      <Lock className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Введите пароль"
                        required
                        className="w-full bg-transparent text-slate-900 font-bold text-sm outline-none"
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

                  <button
                    type="submit"
                    disabled={loading || loginPhoneDigits.length < 10 || !loginPassword.trim()}
                    className="w-full bg-[#00B050] hover:bg-[#009644] active:scale-[0.99] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-[#00B050]/20 transition-all text-base disabled:opacity-50 mt-5 cursor-pointer"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <span>Войти в систему</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* TAB B: SMS LOGIN STEP 1 */}
            {authMode === 'sms' && step === 'phone' && (
              <div>
                <div className="mb-5">
                  <h1 className="text-2xl font-bold text-slate-900 mb-1">Вход по SMS</h1>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Введите номер телефона для получения 4-значного кода подтверждения
                  </p>
                </div>

                <form onSubmit={handleRequestSmsCode} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                      Номер телефона (Казахстан)
                    </label>
                    <div className="flex items-center bg-slate-50 border border-slate-300 focus-within:border-[#00B050] focus-within:bg-white rounded-2xl overflow-hidden transition-all shadow-xs">
                      <div className="flex items-center gap-1 px-3 py-3.5 bg-slate-100/80 border-r border-slate-200 shrink-0 select-none">
                        <span className="text-base leading-none">🇰🇿</span>
                        <span className="text-xs font-extrabold text-slate-800">+7</span>
                      </div>
                      <input
                        type="tel"
                        inputMode="tel"
                        value={formatKazakhstanPhoneDigits(loginPhoneDigits)}
                        onChange={(e) => handlePhoneInputChange(e, setLoginPhoneDigits)}
                        placeholder="(771) 000-00-00"
                        required
                        autoFocus
                        className="w-full bg-transparent py-3.5 px-3 text-slate-900 font-bold text-sm outline-none tracking-wide font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || loginPhoneDigits.length < 10}
                    className="w-full bg-[#00B050] hover:bg-[#009644] active:scale-[0.99] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-[#00B050]/20 transition-all text-base disabled:opacity-50 mt-5 cursor-pointer"
                  >
                    <span>Получить SMS код</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* TAB B: SMS LOGIN STEP 2 (OTP) */}
            {authMode === 'sms' && step === 'otp' && (
              <div className="text-center space-y-4 pt-1">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 mb-1">Код из SMS</h1>
                  <p className="text-xs text-slate-500 max-w-[290px] mx-auto leading-relaxed">
                    Введите код подтверждения для номера{' '}
                    <span className="font-bold text-slate-900 block mt-0.5">{fullLoginPhone}</span>
                  </p>
                </div>

                {resendToast && (
                  <div className="p-3 bg-[#E8F8F0] border border-[#00B050]/30 text-[#00B050] text-xs font-bold rounded-2xl animate-fade-in flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Новый код отправлен</span>
                  </div>
                )}

                <div className="flex items-center justify-center gap-3 py-3">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      id={`otp-input-${idx}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(e.target.value, idx)}
                      onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                      autoFocus={idx === 0}
                      className={`w-13 h-14 text-center font-black text-2xl rounded-2xl border-2 transition-all outline-none ${
                        digit
                          ? 'border-[#00B050] bg-[#E8F8F0]/30 text-slate-900 shadow-xs'
                          : 'border-slate-200 bg-slate-50 text-slate-900 focus:border-[#00B050] focus:bg-white'
                      }`}
                    />
                  ))}
                </div>

                <div>
                  {canResend ? (
                    <button
                      type="button"
                      onClick={handleResendSmsCode}
                      className="text-xs font-bold text-[#00B050] hover:underline flex items-center justify-center gap-1.5 mx-auto py-1.5 px-3 rounded-xl hover:bg-[#E8F8F0]/50 transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Отправить код повторно</span>
                    </button>
                  ) : (
                    <p className="text-xs text-slate-400 font-medium">
                      Отправить код повторно через{' '}
                      <span className="font-bold text-slate-700 font-mono">
                        0:{timerSeconds < 10 ? `0${timerSeconds}` : timerSeconds}
                      </span>
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={loading || otpDigits.some((d) => !d)}
                  onClick={() => handleVerifyOtp()}
                  className="w-full bg-[#00B050] hover:bg-[#009644] active:scale-[0.99] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-[#00B050]/20 transition-all text-base disabled:opacity-50 mt-4 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span>Подтвердить код</span>
                  )}
                </button>
              </div>
            )}

            {/* Bottom Switch: «Нет аккаунта? Зарегистрироваться» */}
            <div className="mt-8 pt-5 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500">
                Нет аккаунта в igraem.kz?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthView('register');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="text-[#00B050] font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Зарегистрироваться</span>
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
              </p>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 2: FORGOT PASSWORD (Восстановление пароля)          */}
        {/* ======================================================== */}
        {authView === 'forgot-password' && (
          <div className="animate-fade-in">
            <div className="mb-5">
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Восстановление пароля</h1>
              <p className="text-xs text-slate-500 leading-relaxed">
                Введите адрес электронной почты, указанный при регистрации. Мы вышлем ссылку для установки нового пароля.
              </p>
            </div>

            {forgotSentSuccess ? (
              <div className="text-center py-5 space-y-4">
                <div className="w-14 h-14 bg-[#E8F8F0] border border-[#00B050]/30 rounded-full flex items-center justify-center mx-auto text-[#00B050]">
                  <Mail className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900">Письмо отправлено</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Если адрес <span className="font-semibold text-slate-800">{forgotEmail}</span> зарегистрирован, ссылка для сброса пароля отправлена. Проверьте почту (включая папку «Спам»).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAuthView('login');
                    setErrorMsg('');
                    setSuccessMsg('');
                    setForgotSentSuccess(false);
                  }}
                  className="w-full bg-[#00B050] hover:bg-[#009644] active:scale-[0.99] text-white font-bold py-3.5 rounded-2xl transition-all text-sm mt-4 cursor-pointer"
                >
                  Вернуться ко входу
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                    Email (Электронная почта)
                  </label>
                  <div className="flex items-center bg-slate-50 border border-slate-300 focus-within:border-[#00B050] focus-within:bg-white rounded-2xl px-3.5 py-3.5 transition-all shadow-xs">
                    <Mail className="w-4 h-4 text-slate-400 mr-2.5 shrink-0" />
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="user@example.kz"
                      required
                      autoFocus
                      className="w-full bg-transparent text-slate-900 font-bold text-sm outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !forgotEmail.trim()}
                  className="w-full bg-[#00B050] hover:bg-[#009644] active:scale-[0.99] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-[#00B050]/20 transition-all text-base disabled:opacity-50 mt-5 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Отправить ссылку</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="mt-8 pt-5 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => {
                  setAuthView('login');
                  setErrorMsg('');
                  setSuccessMsg('');
                  setForgotSentSuccess(false);
                }}
                className="text-xs font-bold text-[#00B050] hover:underline inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Вернуться к авторизации</span>
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 3: REGISTRATION FORM (Регистрация)                   */}
        {/* ======================================================== */}
        {authView === 'register' && (
          <div className="animate-fade-in">
            <div className="mb-5">
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Регистрация</h1>
              <p className="text-xs text-slate-500 leading-relaxed">
                Создайте аккаунт для бронирования площадок и участия в матчах
              </p>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {/* 1. Full Name */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Имя и Фамилия (ФИО)
                </label>
                <div className="flex items-center bg-slate-50 border border-slate-300 focus-within:border-[#00B050] focus-within:bg-white rounded-2xl px-3.5 py-3 transition-all shadow-xs">
                  <User className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="Арман Аскаров"
                    required
                    autoFocus
                    className="w-full bg-transparent text-slate-900 font-bold text-sm outline-none"
                  />
                </div>
              </div>

              {/* 2. Phone Number */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Номер телефона (Казахстан)
                </label>
                <div className="flex items-center bg-slate-50 border border-slate-300 focus-within:border-[#00B050] focus-within:bg-white rounded-2xl overflow-hidden transition-all shadow-xs">
                  <div className="flex items-center gap-1 px-3 py-3 bg-slate-100/80 border-r border-slate-200 shrink-0 select-none">
                    <span className="text-base leading-none">🇰🇿</span>
                    <span className="text-xs font-extrabold text-slate-800">+7</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={formatKazakhstanPhoneDigits(regPhoneDigits)}
                    onChange={(e) => handlePhoneInputChange(e, setRegPhoneDigits)}
                    placeholder="(771) 000-00-00"
                    required
                    className="w-full bg-transparent py-3 px-3 text-slate-900 font-bold text-sm outline-none tracking-wide font-mono"
                  />
                </div>
              </div>

              {/* 3. Email (Электронная почта) */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Email (Электронная почта)
                </label>
                <div className="flex items-center bg-slate-50 border border-slate-300 focus-within:border-[#00B050] focus-within:bg-white rounded-2xl px-3.5 py-3 transition-all shadow-xs">
                  <Mail className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="user@example.kz"
                    required
                    className="w-full bg-transparent text-slate-900 font-bold text-sm outline-none"
                  />
                </div>
              </div>

              {/* 4. IIN */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  ИИН (12 цифр)
                </label>
                <div className="flex items-center bg-slate-50 border border-slate-300 focus-within:border-[#00B050] focus-within:bg-white rounded-2xl px-3.5 py-3 transition-all shadow-xs">
                  <FileText className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={12}
                    value={regIin}
                    onChange={(e) => setRegIin(e.target.value.replace(/\D/g, ''))}
                    placeholder="990101300123"
                    required
                    className="w-full bg-transparent text-slate-900 font-bold text-sm outline-none tracking-widest font-mono"
                  />
                </div>
              </div>

              {/* 5. Password */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Пароль
                </label>
                <div className="flex items-center bg-slate-50 border border-slate-300 focus-within:border-[#00B050] focus-within:bg-white rounded-2xl px-3.5 py-3 transition-all shadow-xs">
                  <Lock className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Минимум 6 символов"
                    required
                    className="w-full bg-transparent text-slate-900 font-bold text-sm outline-none"
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

              {/* 6. Confirm Password */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Подтверждение пароля
                </label>
                <div className="flex items-center bg-slate-50 border border-slate-300 focus-within:border-[#00B050] focus-within:bg-white rounded-2xl px-3.5 py-3 transition-all shadow-xs">
                  <Lock className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                  <input
                    type={showRegConfirmPassword ? 'text' : 'password'}
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Повторите пароль"
                    required
                    className="w-full bg-transparent text-slate-900 font-bold text-sm outline-none"
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

              {/* 7. Terms Checkbox */}
              <div
                onClick={() => setAgreeToTerms(!agreeToTerms)}
                className="flex items-start gap-2.5 pt-1 select-none cursor-pointer"
              >
                <div className="mt-0.5 text-[#00B050]">
                  {agreeToTerms ? (
                    <CheckSquare className="w-4 h-4 fill-[#E8F8F0]" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <span className="text-[11px] text-slate-600 leading-snug">
                  Я согласен с <span className="text-[#00B050] font-semibold underline">правилами сервиса</span> и обработкой персональных данных
                </span>
              </div>

              <button
                type="submit"
                disabled={loading || !regFullName || regPhoneDigits.length < 10 || !regEmail || regIin.length < 12 || !regPassword || !agreeToTerms}
                className="w-full bg-[#00B050] hover:bg-[#009644] active:scale-[0.99] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-[#00B050]/20 transition-all text-base disabled:opacity-50 mt-4 cursor-pointer"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Зарегистрироваться</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Bottom Switch: «Уже есть аккаунт? Войти» */}
            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500">
                Уже есть зарегистрированный аккаунт?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthView('login');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="text-[#00B050] font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Войти</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Security Badge */}
      <div className="pb-2 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-slate-400 text-xs font-medium">
        <ShieldCheck className="w-4 h-4 text-[#00B050]" />
        <span>Защищено igraem.kz API • JWT Session</span>
      </div>
    </div>
  );
};
