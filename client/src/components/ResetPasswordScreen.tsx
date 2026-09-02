import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, ArrowRight, ShieldCheck, AlertCircle, RefreshCw, ChevronLeft, X } from 'lucide-react';
import { api } from '../services/api';
import { Logo } from './Logo';

interface ResetPasswordScreenProps {
  initialToken?: string;
  onBackToLogin: () => void;
}

export const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({ initialToken, onBackToLogin }) => {
  const [token, setToken] = useState<string>(initialToken || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!token) {
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      if (urlToken) {
        setToken(urlToken);
      }
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!token.trim()) {
      setErrorMsg('Токен восстановления отсутствует или недействителен. Запросите новую ссылку.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('Пароль должен содержать минимум 6 символов');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Пароли не совпадают');
      return;
    }

    setLoading(true);

    try {
      const res = await api.resetPassword(token, newPassword, confirmPassword);
      if (res.success) {
        setSuccessMsg(res.message || 'Пароль успешно обновлен! Теперь вы можете войти в систему с новым паролем.');
        // Clean URL query param
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        setErrorMsg(res.message || 'Не удалось обновить пароль');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Срок действия ссылки истек или токен недействителен');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-6 bg-white text-slate-900 w-full relative overflow-y-auto min-h-full">
      <div className="pt-2">
        {/* Header Bar with 3-column layout */}
        <div className="mb-6 flex items-center justify-between relative w-full">
          <div className="w-9 h-9 flex items-center justify-start shrink-0">
            <button
              type="button"
              onClick={onBackToLogin}
              className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 flex items-center justify-center text-slate-700 hover:text-slate-900 transition cursor-pointer"
              title="Назад"
            >
              <ChevronLeft className="w-5 h-5 text-slate-700" />
            </button>
          </div>

          <div className="relative flex justify-center">
            <Logo size="md" />
          </div>

          <div className="w-9 h-9 flex items-center justify-end shrink-0">
            <button
              type="button"
              onClick={onBackToLogin}
              className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer"
              title="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Success View */}
        {successMsg ? (
          <div className="text-center py-6 space-y-4 animate-fade-in">
            <div className="w-16 h-16 bg-[#E8F8F0] border-2 border-[#00B050]/20 rounded-full flex items-center justify-center mx-auto text-[#00B050] shadow-sm">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-1.5">
                Пароль изменен!
              </h1>
              <p className="text-xs text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                {successMsg}
              </p>
            </div>

            <button
              type="button"
              onClick={onBackToLogin}
              className="w-full bg-[#00B050] hover:bg-[#009644] active:scale-[0.99] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-[#00B050]/20 transition-all text-base mt-6 cursor-pointer"
            >
              <span>Войти с новым паролем</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="animate-fade-in">
            <div className="mb-5">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-1.5">
                Новый пароль
              </h1>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Придумайте надежный пароль для входа в ваш аккаунт IGRAEM.KZ
              </p>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-600 animate-fade-in flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {!token ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 space-y-3">
                <p className="font-semibold">
                  Ссылка для сброса пароля не содержит токена безопасности или повреждена.
                </p>
                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  Вернуться и запросить ссылку заново
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 1. New Password */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5 uppercase tracking-wider">
                    Новый пароль
                  </label>
                  <div className="flex items-center bg-slate-50 border border-slate-300 focus-within:border-[#00B050] focus-within:bg-white rounded-2xl px-3.5 py-3.5 transition-all shadow-xs">
                    <Lock className="w-4 h-4 text-slate-400 mr-2.5 shrink-0" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Минимум 6 символов"
                      required
                      autoFocus
                      className="w-full bg-transparent text-slate-900 font-bold text-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* 2. Confirm Password */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5 uppercase tracking-wider">
                    Повторите новый пароль
                  </label>
                  <div className="flex items-center bg-slate-50 border border-slate-300 focus-within:border-[#00B050] focus-within:bg-white rounded-2xl px-3.5 py-3.5 transition-all shadow-xs">
                    <Lock className="w-4 h-4 text-slate-400 mr-2.5 shrink-0" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Повторите пароль"
                      required
                      className="w-full bg-transparent text-slate-900 font-bold text-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || newPassword.length < 6 || confirmPassword.length < 6}
                  className="w-full bg-[#00B050] hover:bg-[#009644] active:scale-[0.99] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-[#00B050]/20 transition-all text-base disabled:opacity-50 mt-5 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Сохранить новый пароль</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Footer Security Badge */}
      <div className="pb-2 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-slate-400 text-xs font-medium">
        <ShieldCheck className="w-4 h-4 text-[#00B050]" />
        <span>Защищено IGRAEM.KZ Security</span>
      </div>
    </div>
  );
};
