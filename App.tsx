
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
import { Menu, Globe, LogOut, UserCircle, Loader2 } from 'lucide-react';
import { supabase } from './services/supabase';

const App = () => {
  // App State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [lang, setLang] = useState<Language>('en');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const t = TRANSLATIONS[lang];
  const isRTL = lang === 'ar';

  // Initialization
  useEffect(() => {
      const initApp = async () => {
          setIsLoadingData(true);
          try {
              await store.init();
          } catch (e) {
              console.error("Failed to load initial data", e);
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
          const rolePerms = allPermissions[currentUser.role] || [];
          setPermissions(rolePerms);
          
          if (!rolePerms.includes(activeTab)) {
              setActiveTab(rolePerms[0] || 'dashboard');
          }
      }
  }, [currentUser]);

  if (isLoadingData) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 flex-col gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
              <p>Loading Trackiva...</p>
          </div>
      );
  }

  // Login Screen
  if (!currentUser) {
    return <Login onLogin={setCurrentUser} lang={lang} setLang={setLang} />;
  }

  const visibleNavItems = NAV_ITEMS.filter(item => permissions.includes(item.id));

  return (
    <div className={`min-h-screen bg-slate-50 flex ${isRTL ? 'flex-row-reverse' : 'flex-row'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 z-30 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : (isRTL ? 'translate-x-full' : '-translate-x-full')}
        lg:translate-x-0
        ${isRTL ? 'border-l border-r-0 left-auto right-0' : 'left-0'}
      `}>
        <div className="h-full flex flex-col">
            <div className="h-16 flex items-center px-6 border-b border-slate-100">
                <h1 className="text-2xl font-bold text-primary">Trackiva</h1>
            </div>

            <div className="p-4 space-y-1 flex-1 overflow-y-auto">
                <div className="px-3 py-3 mb-6 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold shadow-sm">
                        {currentUser.name.charAt(0)}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-bold text-slate-800 truncate">{currentUser.name}</p>
                        <p className="text-xs text-slate-500 truncate">{currentUser.role}</p>
                    </div>
                </div>

                {visibleNavItems.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive ? 'bg-primary text-white shadow-md shadow-blue-100' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <Icon size={20} />
                            <span className="font-medium">{lang === 'en' ? item.label_en : item.label_ar}</span>
                        </button>
                    );
                })}
            </div>

            <div className="p-4 border-t border-slate-100 space-y-2">
                <button 
                    onClick={() => setLang(prev => prev === 'en' ? 'ar' : 'en')}
                    className="w-full flex items-center justify-center gap-2 p-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg"
                >
                    <Globe size={16} /> {t.switchLang}
                </button>
                <button 
                    onClick={() => { 
                        supabase.auth.signOut(); 
                        setCurrentUser(null); 
                    }}
                    className="w-full flex items-center justify-center gap-2 p-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                    <LogOut size={16} /> {t.logout}
                </button>
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 shrink-0">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 text-slate-600">
                <Menu size={24} />
            </button>
            <div className="flex items-center gap-4 ml-auto">
                 <div className="text-sm text-right hidden sm:block rtl:text-left">
                    <p className="text-slate-500">{t.welcome}</p>
                    <p className="font-bold text-slate-900">{currentUser.name}</p>
                 </div>
                 <div className="w-10 h-10 bg-slate-100 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-slate-400">
                    <UserCircle size={24} />
                 </div>
            </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 bg-slate-50/50">
            <div className="max-w-7xl mx-auto">
                {activeTab === 'dashboard' && <Dashboard role={currentUser.role} lang={lang} />}
                {activeTab === 'attendance' && <Attendance lang={lang} />}
                {activeTab === 'reception' && <Reception lang={lang} />}
                {activeTab === 'epass' && (
                    <EPass 
                        lang={lang} 
                        currentUserId={currentUser.id} 
                        currentUserRole={currentUser.role} 
                    />
                )}
                {activeTab === 'management' && <Management lang={lang} />}
                {activeTab === 'clinic' && <Clinic lang={lang} />}
                {activeTab === 'reports' && <Reports lang={lang} />}
                
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
