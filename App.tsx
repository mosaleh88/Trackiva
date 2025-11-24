
import React, { useState, useEffect } from 'react';
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
import { Menu, Globe, LogOut, UserCircle, Loader2, ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react';
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
      const initApp = async () => {
          setIsLoadingData(true);
          try {
              // 1. CRITICAL: Check URL Hash for Recovery BEFORE anything else
              const hash = window.location.hash;
              if (hash && hash.includes('type=recovery')) {
                  console.log("Password recovery detected from URL hash");
                  setIsPasswordRecovery(true);
              }

              // 2. Check for existing Supabase Session
              const { data: { session }, error: sessionError } = await supabase.auth.getSession();
              
              if (sessionError) {
                  console.warn("Session check error:", sessionError.message);
                  if (sessionError.message.includes("Refresh Token") || sessionError.message.includes("Not Found")) {
                      await supabase.auth.signOut();
                  }
              }

              // 3. Load Store Data
              await store.init();

              // 4. Restore User Session
              if (session?.user?.email) {
                  const users = store.getUsers();
                  const userProfile = users.find(u => u.email.toLowerCase() === session.user.email!.toLowerCase());
                  if (userProfile) {
                      setCurrentUser(userProfile);
                  }
              }

              // 5. Listen for Auth Changes
              const { data: authListener } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
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

              return () => {
                  authListener.subscription.unsubscribe();
              };

          } catch (e: any) {
              console.error("Failed to load initial data", e);
              if (e?.message?.includes("Refresh Token")) {
                  await supabase.auth.signOut();
              }
          } finally {
              setIsLoadingData(false);
          }
      };
      initApp();
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
          <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-400 flex-col gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
              <p>Loading Trackiva...</p>
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

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 flex ${isRTL ? 'flex-row-reverse' : 'flex-row'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 z-30 
        ${isCollapsed ? 'w-20' : 'w-64'} 
        bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-all duration-300
        ${sidebarOpen ? 'translate-x-0' : (isRTL ? 'translate-x-full' : '-translate-x-full')}
        lg:translate-x-0
        ${isRTL ? 'border-l border-r-0 left-auto right-0' : 'left-0'}
      `}>
        <div className="h-full flex flex-col">
            <div className={`h-16 flex items-center ${isCollapsed ? 'justify-center' : 'px-6 justify-between'} border-b border-slate-100 dark:border-slate-800`}>
                {!isCollapsed && <h1 className="text-2xl font-bold text-primary truncate">Trackiva</h1>}
                <button 
                    onClick={() => setIsCollapsed(!isCollapsed)} 
                    className="hidden lg:flex p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                    {isCollapsed ? (
                        isRTL ? <ChevronLeft size={20} /> : <ChevronRight size={20} />
                    ) : (
                        isRTL ? <ChevronRight size={20} /> : <ChevronLeft size={20} />
                    )}
                </button>
            </div>

            <div className="p-4 space-y-1 flex-1 overflow-y-auto overflow-x-hidden">
                <div className={`px-3 py-3 mb-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
                    <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold shadow-sm shrink-0">
                        {currentUser.name.charAt(0)}
                    </div>
                    {!isCollapsed && (
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{currentUser.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{currentUser.role}</p>
                        </div>
                    )}
                </div>

                {visibleNavItems.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive ? 'bg-primary text-white shadow-md shadow-blue-100 dark:shadow-none' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'} ${isCollapsed ? 'justify-center px-2' : ''}`}
                            title={isCollapsed ? (lang === 'en' ? item.label_en : item.label_ar) : undefined}
                        >
                            <Icon size={20} className="shrink-0" />
                            {!isCollapsed && <span className="font-medium truncate">{lang === 'en' ? item.label_en : item.label_ar}</span>}
                        </button>
                    );
                })}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <button 
                    onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
                    className={`w-full flex items-center justify-center gap-2 p-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg`}
                    title={isCollapsed ? (theme === 'light' ? t.darkMode : t.lightMode) : undefined}
                >
                    {theme === 'light' ? <Moon size={16} className="shrink-0" /> : <Sun size={16} className="shrink-0" />}
                    {!isCollapsed && (theme === 'light' ? t.darkMode : t.lightMode)}
                </button>
                <button 
                    onClick={() => setLang(prev => prev === 'en' ? 'ar' : 'en')}
                    className={`w-full flex items-center justify-center gap-2 p-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg`}
                    title={isCollapsed ? t.switchLang : undefined}
                >
                    <Globe size={16} className="shrink-0" /> {!isCollapsed && t.switchLang}
                </button>
                <button 
                    onClick={() => { 
                        supabase.auth.signOut(); 
                        setCurrentUser(null); 
                    }}
                    className={`w-full flex items-center justify-center gap-2 p-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors`}
                    title={isCollapsed ? t.logout : undefined}
                >
                    <LogOut size={16} className="shrink-0" /> {!isCollapsed && t.logout}
                </button>
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden transition-all duration-300">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 lg:px-8 shrink-0">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 text-slate-600 dark:text-slate-300">
                <Menu size={24} />
            </button>
            <div className="flex items-center gap-4 ml-auto">
                 <div className="text-sm text-right hidden sm:block rtl:text-left">
                    <p className="text-slate-500 dark:text-slate-400">{t.welcome}</p>
                    <p className="font-bold text-slate-900 dark:text-white">{currentUser.name}</p>
                 </div>
                 <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full border-2 border-white dark:border-slate-700 shadow-sm flex items-center justify-center text-slate-400">
                    <UserCircle size={24} />
                 </div>
            </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 bg-slate-50/50 dark:bg-slate-950">
            <div className="max-w-7xl mx-auto">
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
                    <div className="flex items-center justify-center h-64 text-slate-400">
                        Module under construction
                    </div>
                )}
            </div>
        </div>
      </main>

    </div>
  );
};

export default App;
