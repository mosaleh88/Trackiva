
import React, { useState, useEffect } from 'react';
import { UserRole, Language } from './types';
import { ROLES_LIST, NAV_ITEMS, TRANSLATIONS } from './constants';
import { store } from './services/store';
import { Dashboard } from './components/Dashboard';
import { Attendance } from './components/Attendance';
import { Reception } from './components/Reception';
import { EPass } from './components/EPass';
import { Management } from './components/Management';
import { Clinic } from './components/Clinic';
import { Reports } from './components/Reports';
import { Menu, Globe, LogOut } from 'lucide-react';

const App = () => {
  // App State
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [lang, setLang] = useState<Language>('en');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);

  const t = TRANSLATIONS[lang];
  const isRTL = lang === 'ar';

  // Refresh permissions when role changes
  useEffect(() => {
      if (currentRole) {
          const allPermissions = store.getSettings().rolePermissions;
          const rolePerms = allPermissions[currentRole] || [];
          setPermissions(rolePerms);
          
          // Reset to dashboard if current tab is not allowed, or first allowed item
          if (!rolePerms.includes(activeTab)) {
              setActiveTab(rolePerms[0] || 'dashboard');
          }
      }
  }, [currentRole]);

  // Login Screen
  if (!currentRole) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6">
          <h1 className="text-3xl font-bold text-primary">Trackiva</h1>
          <p className="text-slate-500">{t.selectRole}</p>
          
          <div className="grid grid-cols-1 gap-3">
            {ROLES_LIST.map(role => (
              <button
                key={role}
                onClick={() => setCurrentRole(role)}
                className="p-3 border rounded-lg hover:bg-slate-50 transition-colors text-left flex items-center gap-3"
              >
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                {role}
              </button>
            ))}
          </div>

          <button 
            onClick={() => setLang(prev => prev === 'en' ? 'ar' : 'en')}
            className="text-sm text-slate-400 hover:text-primary flex items-center justify-center gap-2 mx-auto"
          >
            <Globe size={16} /> {t.switchLang}
          </button>
        </div>
      </div>
    );
  }

  // Determine visible navigation items based on dynamic permissions from store
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
                <div className="px-2 py-2 mb-4 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Role</p>
                    <p className="font-medium truncate">{currentRole}</p>
                </div>

                {visibleNavItems.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'}`}
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
                    onClick={() => setCurrentRole(null)}
                    className="w-full flex items-center justify-center gap-2 p-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                >
                    <LogOut size={16} /> Logout
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
            <div className="flex items-center gap-4">
                 <div className="text-sm text-right hidden sm:block">
                    <p className="text-slate-500">{t.welcome}</p>
                    <p className="font-bold text-slate-900">User</p>
                 </div>
                 <div className="w-10 h-10 bg-slate-200 rounded-full border-2 border-white shadow-sm" />
            </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
            <div className="max-w-6xl mx-auto">
                {activeTab === 'dashboard' && <Dashboard role={currentRole} lang={lang} />}
                {activeTab === 'attendance' && <Attendance lang={lang} />}
                {activeTab === 'reception' && <Reception lang={lang} />}
                {activeTab === 'epass' && <EPass lang={lang} currentUserRole={currentRole} />}
                {activeTab === 'management' && <Management lang={lang} />}
                {activeTab === 'clinic' && <Clinic lang={lang} />}
                {activeTab === 'reports' && <Reports lang={lang} />}
                
                {/* Placeholders for other modules */}
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
