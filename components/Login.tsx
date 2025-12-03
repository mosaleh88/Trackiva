import React, { useState, useEffect } from 'react';
import { User, Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { store } from '../services/store';
import { supabase } from '../services/supabase';
import { Input, Button } from './ui';
import { 
  Globe, LogIn, Eye, EyeOff, Loader2, ArrowLeft, 
  Mail, KeyRound, CheckCircle2, Ticket 
} from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
  lang: Language;
  setLang: (lang: Language) => void;
  isPasswordRecovery?: boolean;
}

export const Login: React.FC<LoginProps> = ({ onLogin, lang, setLang, isPasswordRecovery = false }) => {
  const t = TRANSLATIONS[lang];
  const [view, setView] = useState<'login' | 'forgot' | 'update_password'>('login');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isPasswordRecovery) {
      setView('update_password');
    }
  }, [isPasswordRecovery]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      const users = store.getUsers();
      const userProfile = users.find(u => u.email.toLowerCase() === email.toLowerCase());

      if (userProfile) {
        onLogin(userProfile);
      } else {
        setError("Account authenticated but profile not found.");
        await supabase.auth.signOut();
      }
    } catch (err: any) {
      setError(t.invalidCredentials || "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname,
      });
      if (error) throw error;
      setSuccessMsg(t.resetLinkSent || "Check your email for the reset link");
    } catch (err: any) {
      setError(err.message || "Failed to send reset link");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const userProfile = store.getUsers().find(u => u.email.toLowerCase() === user.email!.toLowerCase());
        if (userProfile) {
          setSuccessMsg("Password updated successfully! Logging you in...");
          setTimeout(() => onLogin(userProfile), 1500);
        } else {
          setError("Password updated, but profile not found.");
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to update password");
    } finally {
      setIsLoading(false);
    }
  };

  const isRTL = lang === 'ar';

  return (
    <div 
      className={`min-h-screen flex bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 ${isRTL ? 'flex-row-reverse' : ''}`} 
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Left: Branding */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-600 to-indigo-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
        
        <div className="relative z-10 flex flex-col justify-center items-center text-center px-12 w-full">
          <div className="mb-10">
            <div className="w-28 h-28 bg-white/20 backdrop-blur-xl rounded-3xl flex items-center justify-center mb-8 mx-auto shadow-2xl">
              <Ticket size={56} className="text-white" />
            </div>
            <h1 className="text-7xl font-bold text-white mb-6 tracking-tight">Trackiva</h1>
            <p className="text-2xl text-blue-100 max-w-2xl leading-relaxed font-light">
              The future of school management.<br />
              Real-time. Beautiful. Effortless.
            </p>
          </div>
        </div>

        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/40 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/40 rounded-full blur-3xl animate-pulse animation-delay-4000"></div>
      </div>

      {/* Right: Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-white/80 dark:bg-slate-800/95 backdrop-blur-2xl rounded-3xl shadow-2xl p-10 border border-white/20 dark:border-slate-700/50">
            
            {/* Language & Back */}
            <div className="flex justify-between items-center mb-10">
              <button 
                onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
                className="flex items-center gap-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-primary transition-all hover:scale-105"
              >
                <Globe size={20} />
                {lang === 'en' ? 'العربية' : 'English'}
              </button>

              {view !== 'login' && (
                <button 
                  onClick={() => setView('login')} 
                  className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-all"
                >
                  <ArrowLeft size={18} />
                  {t.backToLogin || 'Back to Login'}
                </button>
              )}
            </div>

            {/* Login View */}
            {view === 'login' && (
              <form onSubmit={handleLogin} className="space-y-8">
                <div className="text-center mb-8">
                  <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-3">{t.welcome || 'Welcome Back'}</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-lg">{t.loginDescription || 'Sign in to your school account'}</p>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.email}</label>
                    <div className="relative mt-2">
                      <Mail className="absolute left-4 top-3.5 text-slate-400" size={22} />
                      <Input
  name="email"
  type="email"
  autoComplete="email"
  value={email}
  onChange={(e) => { setEmail(e.target.value); setError(""); }}
  placeholder="name@school.com"
  className="pl-12 h-14 text-lg"
  required
/>

                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.password}</label>
                      <button 
                        type="button" 
                        onClick={() => setView('forgot')}
                        className="text-sm text-primary hover:underline font-medium"
                      >
                        {t.forgotPassword || 'Forgot password?'}
                      </button>
                    </div>
                    <div className="relative">
                      <KeyRound className="absolute left-4 top-3.5 text-slate-400" size={22} />
                      <Input
  name="password"
  type={showPassword ? "text" : "password"}
  autoComplete="current-password"
  value={password}
  onChange={(e) => { setPassword(e.target.value); setError(""); }}
  placeholder="••••••••"
  className="pl-12 pr-14 h-14 text-lg"
  required
/>

                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                      </button>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-5 py-4 rounded-xl text-sm font-medium">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-16 text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-2xl shadow-blue-500/30 transition-all duration-300"
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin" size={28} />
                  ) : (
                    <span className="flex items-center justify-center gap-3">
                      {t.signIn || 'Sign In'} <LogIn size={26} />
                    </span>
                  )}
                </Button>
              </form>
            )}

            {/* Forgot Password View */}
            {view === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-8">
                <div className="text-center mb-8">
                  <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-3">{t.resetPassword || 'Reset Password'}</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-lg">{t.enterEmailToReset || 'Enter your email to receive a reset link'}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.email}</label>
                  <div className="relative mt-2">
                    <Mail className="absolute left-4 top-3.5 text-slate-400" size={22} />
                    <Input
  name="email"
  type="email"
  autoComplete="email"
  value={email}
  onChange={(e) => { setEmail(e.target.value); setError(""); }}
  placeholder="name@school.com"
  className="pl-12 h-14 text-lg"
  required
/>

                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-5 py-4 rounded-xl text-sm font-medium">
                    {error}
                  </div>
                )}

                {successMsg && (
                  <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-5 py-4 rounded-xl text-sm font-medium flex items-center gap-3">
                    <CheckCircle2 size={20} />
                    {successMsg}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-16 text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-2xl"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={28} /> : t.sendLink || 'Send Reset Link'}
                </Button>
              </form>
            )}

            {/* Update Password View */}
            {view === 'update_password' && successMsg ? (
              <div className="text-center py-20">
                <CheckCircle2 size={80} className="text-green-500 mx-auto mb-6" />
                <h3 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-3">Success!</h3>
                <p className="text-lg text-slate-600 dark:text-slate-300">{successMsg}</p>
              </div>
            ) : view === 'update_password' && (
              <form onSubmit={handleUpdatePassword} className="space-y-8">
                <div className="text-center mb-8">
                  <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-3">Set New Password</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-lg">Choose a strong, secure password</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">New Password</label>
                  <div className="relative mt-2">
                    <KeyRound className="absolute left-4 top-3.5 text-slate-400" size={22} />
                    <Input
  name="new-password"
  type={showPassword ? "text" : "password"}
  autoComplete="new-password"
  value={password}
  onChange={(e) => { setPassword(e.target.value); setError(""); }}
  className="pl-12 pr-14 h-14 text-lg"
  required
  minLength={6}
/>

                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-5 py-4 rounded-xl text-sm font-medium">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-16 text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-2xl"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={28} /> : "Update Password & Login"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};