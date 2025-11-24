import React, { useState, useEffect } from 'react';
import { User, Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { store } from '../services/store';
import { supabase } from '../services/supabase';
import { Input, Button } from './ui';
import { Globe, LogIn, Eye, EyeOff, Loader2, ArrowLeft, Mail, KeyRound } from 'lucide-react';

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

  // Initialize View based on prop (Correctly handles deep linking)
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
        // 1. Authenticate against Supabase Auth
        const { error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (authError) throw authError;

        // 2. Fetch User Profile from public.users
        const users = store.getUsers();
        const userProfile = users.find(u => u.email.toLowerCase() === email.toLowerCase());

        if (userProfile) {
            onLogin(userProfile);
        } else {
            setError("Account authenticated but User Profile not found in database.");
            await supabase.auth.signOut();
        }

    } catch (err: any) {
        console.error("Login failed:", err);
        setError(t.invalidCredentials);
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
          // Dynamically determine the URL (Fixes local vs prod redirect mismatch)
          const redirectTo = window.location.origin;
          
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: redirectTo, 
          });
          if (error) throw error;
          setSuccessMsg(t.resetLinkSent);
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
          const { error } = await supabase.auth.updateUser({ password: password });
          if (error) throw error;
          
          // Password updated successfully, verify session
          const { data: { user } } = await supabase.auth.getUser();
          if (user && user.email) {
              const users = store.getUsers();
              const userProfile = users.find(u => u.email.toLowerCase() === user.email!.toLowerCase());
              if (userProfile) {
                  alert("Password updated successfully!");
                  onLogin(userProfile);
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
    <div className={`min-h-screen flex bg-slate-50 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Left: Branding Area */}
      <div className="hidden lg:flex flex-1 bg-blue-600 flex-col justify-center items-center text-white p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-800 opacity-90"></div>
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        
        <div className="relative z-10 text-center">
          <h1 className="text-6xl font-bold mb-6">Trackiva</h1>
          <p className="text-xl text-blue-100 max-w-md mx-auto leading-relaxed">
            Smart School Management System. <br/>
            Real-time attendance, digital passes, and AI-powered insights.
          </p>
        </div>
      </div>

      {/* Right: Auth Forms */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          
          {/* View Header */}
          <div className="text-center lg:text-left">
            {view === 'login' ? (
                <>
                    <h2 className="text-3xl font-bold text-slate-900">{t.welcome}</h2>
                    <p className="text-slate-500 mt-2">{t.loginDescription}</p>
                </>
            ) : view === 'forgot' ? (
                <>
                    <h2 className="text-3xl font-bold text-slate-900">{t.resetPassword}</h2>
                    <p className="text-slate-500 mt-2">{t.enterEmailToReset}</p>
                </>
            ) : (
                <>
                    <h2 className="text-3xl font-bold text-slate-900">Set New Password</h2>
                    <p className="text-slate-500 mt-2">Please enter your new secure password.</p>
                </>
            )}
          </div>

          <div className="flex justify-end">
             <button 
                onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors"
             >
                <Globe size={16} /> {t.switchLang}
             </button>
          </div>

          {/* FORMS */}
          {view === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t.email}</label>
                    <Input 
                    id="login-email"
                    name="email"
                    type="email" 
                    value={email} 
                    onChange={e => { setEmail(e.target.value); setError(""); }}
                    placeholder="name@school.com"
                    className="h-12"
                    required
                  />
                </div>
                
                <div>
                  <div className="flex justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-700">{t.password}</label>
                      <button 
                          type="button" 
                          onClick={() => { setView('forgot'); setError(""); setSuccessMsg(""); }}
                          className="text-xs text-blue-600 hover:text-blue-800"
                      >
                          {t.forgotPassword}
                      </button>
                  </div>
                  <div className="relative">
                    <Input 
                      id="login-password"
                      name="password"
                      type={showPassword ? "text" : "password"} 
                      value={password} 
                      onChange={e => { setPassword(e.target.value); setError(""); }}
                      placeholder="••••••••"
                      className="h-12 pr-10"
                      required
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute top-3.5 text-slate-400 hover:text-slate-600 ${isRTL ? 'left-3' : 'right-3'}`}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">
                    {error}
                  </div>
                )}

                <Button type="submit" disabled={isLoading} className="w-full h-12 text-lg shadow-lg shadow-blue-200">
                  {isLoading ? <Loader2 className="animate-spin mx-2" /> : t.signIn} {!isLoading && <LogIn size={20} className="mx-2" />}
                </Button>
              </form>
          ) : view === 'forgot' ? (
              <form onSubmit={handleForgotPassword} className="space-y-6">
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t.email}</label>
                      <div className="relative">
                          <Input 
                            id="forgot-email"
                            name="email"
                            type="email" 
                            value={email} 
                            onChange={e => { setEmail(e.target.value); setError(""); }}
                            placeholder="name@school.com"
                            className="h-12 pl-10"
                            required
                          />
                          <Mail className="absolute left-3 top-3.5 text-slate-400" size={20} />
                      </div>
                  </div>

                  {error && (
                      <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">
                        {error}
                      </div>
                  )}
                  
                  {successMsg && (
                      <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg border border-green-100">
                        {successMsg}
                      </div>
                  )}

                  <Button type="submit" disabled={isLoading} className="w-full h-12 text-lg shadow-lg">
                      {isLoading ? <Loader2 className="animate-spin mx-2" /> : t.sendLink}
                  </Button>

                  <button 
                      type="button"
                      onClick={() => { setView('login'); setError(""); }}
                      className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-700 py-2"
                  >
                      <ArrowLeft size={16} /> {t.backToLogin}
                  </button>
              </form>
          ) : (
              <form onSubmit={handleUpdatePassword} className="space-y-6">
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                      <div className="relative">
                          <Input 
                            id="update-password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            value={password} 
                            onChange={e => { setPassword(e.target.value); setError(""); }}
                            placeholder="Enter new password"
                            className="h-12 pl-10 pr-10"
                            required
                            minLength={6}
                          />
                          <KeyRound className="absolute left-3 top-3.5 text-slate-400" size={20} />
                          <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className={`absolute top-3.5 text-slate-400 hover:text-slate-600 ${isRTL ? 'left-3' : 'right-3'}`}
                          >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                          </button>
                      </div>
                  </div>

                  {error && (
                      <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">
                        {error}
                      </div>
                  )}

                  <Button type="submit" disabled={isLoading} className="w-full h-12 text-lg shadow-lg bg-green-600 hover:bg-green-700">
                      {isLoading ? <Loader2 className="animate-spin mx-2" /> : "Update Password & Login"}
                  </Button>
              </form>
          )}
        </div>
      </div>
    </div>
  );
};