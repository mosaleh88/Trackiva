import React, { useState, useEffect, useMemo } from 'react';
import { UserRole, Language, User } from './types';
import { ROLES_LIST, NAV_ITEMS, TRANSLATIONS } from './constants';
import { store } from './services/store';
import { Dashboard } from './components/Dashboard';
import { Attendance } from './components/Attendance';
import { Reception } from './components/Reception';
import { EPass } from './components/EPass';
import { Management } from './components/Management';
import { Clinic } from './components/Clinic';
import { Reports } from './components/Reports';
import { Login } from './components/Login';
import { Menu, Globe, LogOut, UserCircle, Loader2, ChevronLeft, ChevronRight, Moon, Sun, LayoutGrid } from 'lucide-react';
import { supabase } from './services/supabase';

const App = () => {
  // App State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [lang, setLang] = useState<Language>('en');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    }
    return 'light';
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  
  // Sidebar Collapse State
  const [isCollapsed, setIsCollapsed] = useState(false);

  const t = TRANSLATIONS[lang];
  const isRTL = lang === 'ar';

  // Theme Effect
  useEffect(() => {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Initialization & Session Check
  useEffect(() => {
      let mounted = true;
      let authListener: { subscription: { unsubscribe: () => void } } | null = null;

      const initApp = async () => {
          setIsLoadingData(true);
          try {
              // 1. CRITICAL: Check URL Hash for Recovery BEFORE anything else
              const hash = window.location.hash;
              if (hash && hash.includes('type=recovery')) {
                  console.log("Password recovery detected from URL hash");
                  if (mounted) setIsPasswordRecovery(true);
              }

              // 2. Check for existing Supabase Session
              const { data: { session }, error: sessionError } = await supabase.auth.getSession();
              
              if (sessionError) {
                  console.warn("Session check error:", sessionError.message);
                  if (sessionError.message.includes("Refresh Token") || sessionError.message.includes("Not Found")) {
                      await supabase.auth.signOut();
                  }
              }

              if (!mounted) return;

              // 3. Load Store Data
              await store.init();
              
              if (!mounted) return;

              // 4. Restore User Session
              if (session?.user?.email) {
                  const users = store.getUsers();
                  const userProfile = users.find(u => u.email.toLowerCase() === session.user.email!.toLowerCase());
                  if (userProfile) {
                      setCurrentUser(userProfile);
                  }
              }

              // 5. Listen for Auth Changes
              const { data } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
                  if (!mounted) return;

                  if (event === 'PASSWORD_RECOVERY') {
                      setIsPasswordRecovery(true);
                  } else if (event === 'SIGNED_IN' && session?.user?.email) {
                      // Double check store if users not loaded yet
                      let users = store.getUsers();
                      if (users.length === 0) {
                          await store.refreshData();
                          users = store.getUsers();
                      }
                      const userProfile = users.find(u => u.email.toLowerCase() === session.user.email!.toLowerCase());
                      if (userProfile) {
                          setCurrentUser(userProfile);
                      }
                  } else if (event === 'SIGNED_OUT') {
                      setCurrentUser(null);
                      setIsPasswordRecovery(false);
                  }
              });
              authListener = data;

          } catch (e: any) {
              console.error("Failed to load initial data", e);
              if (e?.message?.includes("Refresh Token")) {
                  await supabase.auth.signOut();
              }
          } finally {
              if (mounted) setIsLoadingData(false);
          }
      };
      
      initApp();

      return () => {
          mounted = false;
          if (authListener?.subscription) {
              authListener.subscription.unsubscribe();
          }
      };
  }, []);

  // Refresh permissions when user changes
  useEffect(() => {
      if (currentUser) {
          const allPermissions = store.getSettings().rolePermissions;
          const rolePerms = (allPermissions && allPermissions[currentUser.role]) || [];
          setPermissions(rolePerms);
          
          if (!rolePerms.includes(activeTab)) {
              setActiveTab(rolePerms[0] || 'dashboard');
          }
      }
  }, [currentUser]);

  if (isLoadingData) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-transparent backdrop-blur-3xl text-slate-400 flex-col gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <p className="font-medium animate-pulse">Loading Trackiva System...</p>
          </div>
      );
  }

  if (!currentUser || isPasswordRecovery) {
    return (
        <Login 
            onLogin={(user) => { setCurrentUser(user); setIsPasswordRecovery(false); }} 
            lang={lang} 
            setLang={setLang} 
            isPasswordRecovery={isPasswordRecovery}
        />
    );
  }

  const visibleNavItems = NAV_ITEMS.filter(item => permissions.includes(item.id));
  const activeIndex = visibleNavItems.findIndex(item => item.id === activeTab);

  return (
    <div className={`h-[100dvh] w-full p-2 lg:p-4 gap-3 lg:gap-4 flex overflow-hidden ${isRTL ? 'flex-row-reverse' : 'flex-row'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden transition-all duration-300"
            onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Floating Sidebar */}
      <aside className={`
        fixed lg:static 
        inset-y-2 lg:inset-y-0 z-50 
        ${isRTL ? 'right-2 lg:right-auto' : 'left-2 lg:left-auto'}
        ${isCollapsed ? 'w-20 lg:w-24' : 'w-72'} 
        bg-white/60 dark:bg-slate-900/70 backdrop-blur-2xl
        border border-white/20 dark:border-white/5
        shadow-2xl rounded-[2rem] lg:rounded-[2.5rem]
        transition-[width,transform] duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : (isRTL ? 'translate-x-[120%]' : '-translate-x-[120%]')}
        lg:translate-x-0
        flex flex-col shrink-0 overflow-hidden
        lg:h-full max-h-[calc(100dvh-1rem)] lg:max-h-full
      `}>
            {/* Sidebar Header */}
            <div className={`h-20 flex items-center justify-center shrink-0 transition-all duration-300 ${isCollapsed ? 'justify-center' : 'px-6'}`}>
                <button 
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className={`flex items-center gap-3 group focus:outline-none w-full ${isCollapsed ? 'justify-center' : 'justify-start'}`}
                    title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/30 transition-transform active:scale-95 group-hover:scale-105 shrink-0">
                        <LayoutGrid size={24} />
                    </div>
                    <div className={`overflow-hidden  transition-all duration-300 ease-in-out ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                        <h1 className="text-2xl font-extrabold tracking-tight bg-primary from-primary to-accent bg-clip-text text-transparent whitespace-nowrap">
                            Trackiva
                        </h1>
                    </div>
                </button>
            </div>

            {/* Navigation Items */}
            <div className="px-4 space-y-4 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                
                {/* User Profile Mini Card */}
                <div className={`
                    bg-gradient-to-br from-slate-100/80 to-slate-200/50 dark:from-slate-800/80 dark:to-slate-900/50 
                    rounded-2xl border border-white/50 dark:border-white/5 shadow-inner
                    flex items-center transition-all duration-300 ease-in-out
                    ${isCollapsed ? 'mx-auto justify-center p-1 w-12 h-12' : 'mx-0 p-3 gap-3'}
                `}>
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-700 text-primary flex items-center justify-center font-bold shadow-sm shrink-0 border-2 border-white dark:border-slate-600">
                        {currentUser.name.charAt(0)}
                    </div>
                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'w-0 opacity-0' : 'w-full opacity-100'}`}>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{currentUser.name}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">{currentUser.role}</p>
                        </div>
                    </div>
                </div>

                {/* Navigation Menu Wrapper */}
                <div className="relative flex flex-col gap-2">
                    
                    {/* Liquid Glass Active Indicator */}
                    {activeIndex !== -1 && (
                        <div 
                            className="absolute left-0 right-0 h-14 bg-primary from-sky-400/80 via-blue-500/80 to-purple-600/80 dark:from-sky-500/80 dark:via-blue-600/80 dark:to-purple-600/80 rounded-[1.25rem] shadow-[0_8px_20px_-6px_rgba(59,130,246,0.6)] border border-white/30 backdrop-blur-sm z-0 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                            style={{ 
                                top: `${activeIndex * 64}px` // 56px height + 8px gap
                            }}
                        />
                    )}

                    {visibleNavItems.map((item, index) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                                className={`group
                                    relative z-10 w-full h-14 flex items-center rounded-[1.25rem] transition-all duration-300 ease-in-out outline-none
                                    ${isActive 
                                        ? 'text-white scale-100' 
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/40 dark:hover:bg-slate-800/40 hover:backdrop-blur-md'
                                    } 
                                    ${isCollapsed ? 'justify-center px-0' : 'px-5 gap-4'}
                                `}
                                title={isCollapsed ? (lang === 'en' ? item.label_en : item.label_ar) : undefined}
                            >
                                {/* Icon with subtle scaling on active */}
                                <Icon size={22} className={`shrink-0 transition-transform duration-500 ${isActive ? 'scale-110 drop-shadow-md text-white' : 'group-hover:scale-105'}`} />
                                
                                {/* Label with reveal transition */}
                                <span className={`font-bold tracking-wide truncate transition-all duration-300 ease-in-out ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                                    {lang === 'en' ? item.label_en : item.label_ar}
                                </span>
                                
                                {/* Active Dot Indicator (Only visible in collapsed state or if needed) */}
                                {isActive && !isCollapsed && (
                                    <div className={`absolute ${isRTL ? 'left-5' : 'right-5'} w-1.5 h-1.5 bg-white/80 rounded-full shadow-glow animate-breathing-glow`}></div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Sidebar Footer */}
            <div className="p-6 space-y-3 shrink-0">
                <div className={`grid gap-3 transition-all duration-300 ${isCollapsed ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    <button 
                        onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
                        className={`flex items-center justify-center gap-2 p-3 text-slate-500 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-600`}
                        title={theme === 'light' ? t.darkMode : t.lightMode}
                    >
                        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                    </button>
                    
                    <button 
                        onClick={() => setLang(prev => prev === 'en' ? 'ar' : 'en')}
                        className={`group
                            flex items-center justify-center gap-2 p-3 text-slate-500 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-600
                            ${isCollapsed ? 'hidden' : ''}
                        `}
                        title={t.switchLang}
                    >
                        <Globe size={20} /> 
                        <span className="text-xs font-bold uppercase">{lang === 'en' ? 'AR' : 'EN'}</span>
                    </button>
                </div>
                
                <button 
                    onClick={() => { 
                        supabase.auth.signOut(); 
                        setCurrentUser(null); 
                    }}
                    className={`w-full flex items-center justify-center gap-3 p-4 text-sm font-bold text-red-500 bg-red-500/10 dark:bg-red-900/20 hover:bg-red-500/20 dark:hover:bg-red-900/40 rounded-2xl transition-all active:scale-95`}
                    title={isCollapsed ? t.logout : undefined}
                >
                    <LogOut size={20} className="shrink-0" /> 
                    <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                        {t.logout}
                    </span>
                </button>
            </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        
        {/* Top Bar - Glassmorphic */}
        <header className={`h-16 shrink-0 flex items-center justify-between px-2 md:px-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="flex items-center gap-4">
                <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-3 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-sm text-slate-600 dark:text-slate-300 active:scale-95 transition-transform">
                    <Menu size={24} />
                </button>
                <div className="hidden md:block">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                        {NAV_ITEMS.find(i => i.id === activeTab)?.[lang === 'en' ? 'label_en' : 'label_ar']}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
            </div>

            <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                 <div className={`hidden sm:flex items-center gap-3 px-4 py-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-full border border-white/20 dark:border-white/5 shadow-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">System Online</span>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                 </div>
                 
                 <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                    {isRTL ? (
                        <>
                            <div className="w-12 h-12 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-full border border-white/20 shadow-glass flex items-center justify-center text-primary">
                                <UserCircle size={28} />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="w-12 h-12 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-full border border-white/20 shadow-glass flex items-center justify-center text-primary">
                                <UserCircle size={28} />
                            </div>
                        </>
                    )}
                 </div>
            </div>
        </header>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 lg:p-6 scrollbar-none">
            {/* REMOVED max-w constraints to allow full-width scaling per request */}
            <div className="w-full pb-12 animate-fade-in h-full">
                {activeTab === 'dashboard' && <Dashboard role={currentUser.role} lang={lang} />}
                {activeTab === 'attendance' && <Attendance lang={lang} currentUser={currentUser} />}
                {activeTab === 'reception' && <Reception lang={lang} currentUser={currentUser} />}
                {activeTab === 'epass' && (
                    <EPass 
                        lang={lang} 
                        currentUserId={currentUser.id} 
                        currentUserRole={currentUser.role} 
                    />
                )}
                {activeTab === 'management' && <Management lang={lang} />}
                {activeTab === 'clinic' && <Clinic lang={lang} currentUser={currentUser} />}
                {activeTab === 'reports' && <Reports lang={lang} currentUser={currentUser} />}
                
                {(activeTab === 'transport') && (
                    <div className="flex flex-col items-center justify-center h-96 text-slate-400 bg-white/40 dark:bg-slate-900/40 rounded-[2rem] border-2 border-dashed border-slate-300 dark:border-slate-700">
                        <Loader2 className="w-16 h-16 animate-spin mb-4 opacity-50" />
                        <p className="text-xl font-bold">Module under construction</p>
                    </div>
                )}
            </div>
        </div>
      </main>

    </div>
  );
};

export default App;