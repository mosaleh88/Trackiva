
import React, { useState } from 'react';
import { User, Language, UserRole } from '../types';
import { MOCK_USERS_SEED, TRANSLATIONS } from '../constants';
import { store } from '../services/store';
import { supabase } from '../services/supabase';
import { Card, Input, Button, Badge } from './ui';
import { Globe, LogIn, Eye, EyeOff, Loader2 } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
  lang: Language;
  setLang: (lang: Language) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin, lang, setLang }) => {
  const t = TRANSLATIONS[lang];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
        // 1. Authenticate against Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (authError) throw authError;

        // 2. Fetch User Profile from public.users
        // We assume the 'email' is the link between Auth and Profile for this setup
        const users = store.getUsers();
        const userProfile = users.find(u => u.email.toLowerCase() === email.toLowerCase());

        if (userProfile) {
            onLogin(userProfile);
        } else {
            // Fallback if profile missing (shouldn't happen if setup correctly)
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

  // Demo functionality retained for testing without auth setup
  const handleDemoLogin = async (user: User) => {
      onLogin(user);
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

      {/* Right: Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-slate-900">{t.welcome}</h2>
            <p className="text-slate-500 mt-2">{t.loginDescription}</p>
          </div>

          <div className="flex justify-end">
             <button 
                onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors"
             >
                <Globe size={16} /> {t.switchLang}
             </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.email}</label>
              <Input 
                type="email" 
                value={email} 
                onChange={e => { setEmail(e.target.value); setError(""); }}
                placeholder="name@school.com"
                className="h-12"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.password}</label>
              <div className="relative">
                <Input 
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

          {/* Demo Mode Section */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-slate-50 text-slate-500">{t.demoMode}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {MOCK_USERS_SEED.map(user => (
              <button
                key={user.id}
                onClick={() => handleDemoLogin(user)}
                className="flex items-center p-3 border border-slate-200 rounded-xl hover:bg-white hover:shadow-md hover:border-blue-200 transition-all text-left group bg-white"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 ${
                    user.role === UserRole.ADMIN_SGL ? 'bg-purple-600' :
                    user.role === UserRole.TEACHER ? 'bg-blue-600' :
                    user.role === UserRole.CLINIC_STAFF ? 'bg-red-500' :
                    user.role === UserRole.SOCIAL_WORKER ? 'bg-orange-500' : 'bg-slate-500'
                }`}>
                    {user.name.charAt(0)}
                </div>
                <div className="ml-4 rtl:ml-0 rtl:mr-4 flex-1">
                    <p className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{user.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <Badge color="gray" className="text-[10px] px-2">{user.role}</Badge>
                        <span className="text-xs text-slate-400">{user.email}</span>
                    </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
