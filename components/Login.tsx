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
      className={`min-h-screen flex bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 ${isRTL ? 'flex-row-reverse' : ''}`} 
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Left: Branding */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-600 to-indigo-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
        
        <div className="relative z-10 flex flex-col justify-center items-center text-center px-12 w-full">
          <div className="mb-10 animate-fade-in">
            <div className="w-32 h-32 bg-white/20 backdrop-blur-xl rounded-[2.5rem] flex items-center justify-center mb-10 mx-auto shadow-2xl border border-white/20">
              <Ticket size={64} className="text-white drop-shadow-md" />
            </div>
            <h1 className="text-7xl font-extrabold text-white mb-6 tracking-tight drop-shadow-sm">Trackiva</h1>
            <p className="text-2xl text-blue-100 max-w-2xl leading-relaxed font-light drop-shadow-sm">
              The future of school management.<br />
              Real-time. Beautiful. Effortless.
            </p>
          </div>
        </div>

        {/* Abstract shapes */}
        <div className="absolute -bottom-40 -left-40 w-[40rem] h-[40rem] bg-blue-500/40 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute -top-40 -right-40 w-[40rem] h-[40rem] bg-purple-500/40 rounded-full blur-[100px] animate-pulse animation-delay-4000"></div>
      </div>

      {/* Right: Form */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        {/* Mobile Background Shapes */}
        <div className="lg:hidden absolute top-0 left-0 w-full h-full overflow-hidden -z-10 bg-slate-50 dark:bg-slate-900">
             <div className="absolute top-[-10%] right-[-10%] w-72 h-72 bg-blue-500/20 rounded-full blur-3xl"></div>
             <div className="absolute bottom-[-10%] left-[-10%] w-72 h-72 bg-purple-500/20 rounded-full blur-3xl"></div>
        </div>

        <div className="w-full max-w-md perspective-1000">
          <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-3xl rounded-[2.5rem] shadow-glass p-10 border border-white/60 dark:border-white/20 transition-transform duration-500 shadow-[inset_0_1px_4px_0_rgba(255,255,255,0.1)]">
            
            {/* Language & Back */}
            <div className="flex justify-between items-center mb-10">
              <button 
                onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
                className="flex items-center gap-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-primary transition-all hover:scale-105 bg-white/50 dark:bg-slate-800/50 px-3 py-1.5 rounded-full border border-white/20"
              >
                <Globe size={18} />
                {lang === 'en' ? 'العربية' : 'English'}
              </button>

              {view !== 'login' && (
                <button 
                  onClick={() => setView('login')} 
                  className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-all"
                >
                  <ArrowLeft size={18} />
                  {t.backToLogin || 'Back to Login'}
                </button>
              )}
            </div>

            {/* Login View */}
            {view === 'login' && (
              <form onSubmit={handleLogin} className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                <div className="text-center mb-8">
                  <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-3 tracking-tight [text-shadow:0_1px_2px_rgba(0,0,0,0.1)] dark:[text-shadow:none]">{t.welcome || 'Welcome Back'}</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-lg font-medium [text-shadow:0_1px_2px_rgba(0,0,0,0.05)] dark:[text-shadow:none]">{t.loginDescription || 'Sign in to your school account'}</p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">{t.email}</label>
                    <div className="relative mt-2 group">
                      <Mail className="absolute left-5 top-4 text-slate-400 group-focus-within:text-primary transition-colors" size={22} />
                      <Input
  name="email"
  type="email"
  autoComplete="email"
  value={email}
  onChange={(e) => { setEmail(e.target.value); setError(""); }}
  placeholder="name@school.com"
  className="pl-14 h-14 text-lg bg-white/50 dark:bg-slate-950/50 border-white/40 dark:border-slate-700 shadow-inner-light focus:ring-4 focus:ring-primary/20"
  required
/>

                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2 ml-1">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t.password}</label>
                      <button 
                        type="button" 
                        onClick={() => setView('forgot')}
                        className="text-sm text-primary hover:text-blue-700 font-bold hover:underline transition-all"
                      >
                        {t.forgotPassword || 'Forgot password?'}
                      </button>
                    </div>
                    <div className="relative group">
                      <KeyRound className="absolute left-5 top-4 text-slate-400 group-focus-within:text-primary transition-colors" size={22} />
                      <Input
  name="password"
  type={showPassword ? "text" : "password"}
  autoComplete="current-password"
  value={password}
  onChange={(e) => { setPassword(e.target.value); setError(""); }}
  placeholder="••••••••"
  className="pl-14 pr-14 h-14 text-lg bg-white/50 dark:bg-slate-950/50 border-white/40 dark:border-slate-700 shadow-inner-light focus:ring-4 focus:ring-primary/20"
  required
/>

                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-5 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      >
                        {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                      </button>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50/80 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 px-6 py-4 rounded-2xl text-sm font-bold animate-in zoom-in-95 flex items-center gap-3 shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-16 text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl shadow-blue-500/30 transition-all duration-300 rounded-2xl hover:-translate-y-1"
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
              <form onSubmit={handleForgotPassword} className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                <div className="text-center mb-8">
                  <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-3 tracking-tight">{t.resetPassword || 'Reset Password'}</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">{t.enterEmailToReset || 'Enter your email to receive a reset link'}</p>
                </div>

                <div>
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">{t.email}</label>
                  <div className="relative mt-2 group">
                    <Mail className="absolute left-5 top-4 text-slate-400 group-focus-within:text-primary transition-colors" size={22} />
                    <Input
  name="email"
  type="email"
  autoComplete="email"
  value={email}
  onChange={(e) => { setEmail(e.target.value); setError(""); }}
  placeholder="name@school.com"
  className="pl-14 h-14 text-lg bg-white/50 dark:bg-slate-950/50 border-white/40 dark:border-slate-700 shadow-inner-light focus:ring-4 focus:ring-primary/20"
  required
/>

                  </div>
                </div>

                {error && (
                  <div className="bg-red-50/80 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 px-6 py-4 rounded-2xl text-sm font-bold shadow-sm">
                    {error}
                  </div>
                )}

                {successMsg && (
                  <div className="bg-green-50/80 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-6 py-4 rounded-2xl text-sm font-bold flex items-center gap-3 shadow-sm">
                    <CheckCircle2 size={24} className="text-green-500" />
                    {successMsg}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-16 text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-xl shadow-emerald-500/30 rounded-2xl hover:-translate-y-1 transition-all"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={28} /> : t.sendLink || 'Send Reset Link'}
                </Button>
              </form>
            )}

            {/* Update Password View */}
            {view === 'update_password' && successMsg ? (
              <div className="text-center py-20 animate-in zoom-in duration-500">
                <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/20">
                    <CheckCircle2 size={60} className="text-green-500" />
                </div>
                <h3 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-4">Success!</h3>
                <p className="text-lg text-slate-600 dark:text-slate-300 font-medium">{successMsg}</p>
              </div>
            ) : view === 'update_password' && (
              <form onSubmit={handleUpdatePassword} className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                <div className="text-center mb-8">
                  <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-3">Set New Password</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">Choose a strong, secure password</p>
                </div>

                <div>
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">New Password</label>
                  <div className="relative mt-2 group">
                    <KeyRound className="absolute left-5 top-4 text-slate-400 group-focus-within:text-primary transition-colors" size={22} />
                    <Input
  name="new-password"
  type={showPassword ? "text" : "password"}
  autoComplete="new-password"
  value={password}
  onChange={(e) => { setPassword(e.target.value); setError(""); }}
  className="pl-14 pr-14 h-14 text-lg bg-white/50 dark:bg-slate-950/50 border-white/40 dark:border-slate-700 shadow-inner-light focus:ring-4 focus:ring-primary/20"
  required
  minLength={6}
/>

                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-5 top-4 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50/80 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 px-6 py-4 rounded-2xl text-sm font-bold shadow-sm">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-16 text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-xl shadow-green-500/30 rounded-2xl hover:-translate-y-1 transition-all"
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