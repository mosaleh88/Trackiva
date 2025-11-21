
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Select, Badge, Input } from './ui';
import { store } from '../services/store';
import { Language, EPass as EPassType, Student, EPassDestination, UserRole, User } from '../types';
import { TRANSLATIONS, ROLES_LIST } from '../constants';
import { Search, Filter, Ticket, Library, Stethoscope, Armchair, Briefcase, Coffee, Gamepad2, Music, Dumbbell, Beaker, BookOpen, Users, Ban, AlertOctagon, LayoutDashboard, AlertTriangle, Clock } from 'lucide-react';
import { sendUnauthorizedAlert, sendPassCreatedAlert } from '../services/telegramService';

interface EPassProps {
  lang: Language;
  // In a real app, we would pass 'currentUser' here
  currentUserRole?: UserRole; // Add this prop if we can modify App.tsx, otherwise assume we can't
}

// Icon lookup map
const ICON_MAP: any = {
    Armchair, Stethoscope, Library, Briefcase, Coffee, Gamepad2, Music, Dumbbell, Beaker, BookOpen, Users
};

const UNAUTHORIZED_TYPE = 'UNAUTHORIZED';

export const EPass: React.FC<EPassProps> = ({ lang, currentUserRole }) => {
  const t = TRANSLATIONS[lang];
  const [activeTab, setActiveTab] = useState<'issue' | 'dashboard'>('issue');
  const [passes, setPasses] = useState<EPassType[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [destinations, setDestinations] = useState<EPassDestination[]>([]);
  const [maxPasses, setMaxPasses] = useState(4);
  const [users, setUsers] = useState<User[]>([]);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGender, setSelectedGender] = useState<string>("");
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");

  // Local state to track allowed overrides for the current session
  const [overrideMap, setOverrideMap] = useState<Record<string, boolean>>({});

  const refresh = () => {
      setPasses(store.getEPasses().filter(p => p.status === 'Active'));
      
      // SIMULATION: If we are simulating Sarah Teacher (U002), filter by her classes.
      // Since we don't have the current user context, we will fetch ALL students for now to avoid breaking the demo flow,
      // but the `store.getStudentsForUser` logic exists for when authentication is fully wired up.
      // In a real implementation: setStudents(store.getStudentsForUser(currentUserId));
      setStudents(store.getStudents()); 
      
      setUsers(store.getUsers());
      setDestinations(store.getDestinations());
      setMaxPasses(store.getSettings().maxPassesPerDay);
  };
  
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  const currentUser = useMemo(() => {
      if (!currentUserRole) return undefined;
      // Find a user that matches the current simulated role.
      // In a real app, this would be the actual logged-in user from auth context.
      return users.find(u => u.role === currentUserRole);
  }, [currentUserRole, users]);

  // --- Derived Data for Dashboard ---
  const destinationStats = useMemo(() => {
    const stats: Record<string, number> = {};
    destinations.forEach(d => stats[d.id] = 0);
    stats['UNAUTHORIZED'] = 0;
    
    passes.forEach(p => {
      const key = p.type === UNAUTHORIZED_TYPE ? 'UNAUTHORIZED' : p.type;
      if (stats[key] !== undefined) {
        stats[key]++;
      } else {
        stats[key] = 1;
      }
    });
    return stats;
  }, [passes, destinations]);

  const totalOverdue = passes.filter(p => {
      if (p.type === UNAUTHORIZED_TYPE) return true;
      const dest = destinations.find(d => d.id === p.type);
      if (!dest) return false;
      return (Date.now() - p.startTime) > (dest.maxDuration * 60 * 1000);
  }).length;

  // --- Hierarchical Filter Logic ---

  const availableGrades = useMemo(() => {
    if (!selectedGender) return [];
    return Array.from(new Set(students.filter(s => s.gender === selectedGender).map(s => s.grade))).sort();
  }, [students, selectedGender]);

  const availableSections = useMemo(() => {
    if (!selectedGender || !selectedGrade) return [];
    return Array.from(new Set(students.filter(s => s.gender === selectedGender && s.grade === selectedGrade).map(s => s.section))).sort();
  }, [students, selectedGender, selectedGrade]);

  const filteredStudents = useMemo(() => {
    let result = students;

    // 1. Search takes priority
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        return result.filter(s => 
            s.name_en.toLowerCase().includes(lower) || 
            s.name_ar.includes(lower) || 
            s.studentNumber.includes(lower)
        );
    }

    // 2. Class Filter
    if (selectedGender && selectedGrade && selectedSection) {
        return result.filter(s => 
            s.gender === selectedGender && 
            s.grade === selectedGrade && 
            s.section === selectedSection
        );
    }

    return [];
  }, [students, searchTerm, selectedGender, selectedGrade, selectedSection]);

  // --- Handlers ---

  const handleCreatePass = (studentId: string, type: string) => {
    store.createEPass({
        studentId,
        type,
        teacherId: currentUser?.id
    });

    const student = students.find(s => s.id === studentId);
    
    // --- TELEGRAM ALERT TRIGGERS ---
    if (student) {
        if (type === UNAUTHORIZED_TYPE) {
            sendUnauthorizedAlert(student);
        } else {
            // Standard Pass
            const dest = destinations.find(d => d.id === type);
            if (dest) {
                sendPassCreatedAlert(student, dest);
            }
        }
    }
    // -----------------------------

    if (overrideMap[studentId]) {
        setOverrideMap(prev => {
            const newMap = { ...prev };
            delete newMap[studentId];
            return newMap;
        });
    }

    refresh();
  };

  const handleComplete = (id: string) => {
    store.completeEPass(id);
    refresh();
  };

  const handleAllowOverride = (studentId: string) => {
      setOverrideMap(prev => ({ ...prev, [studentId]: true }));
  };

  const getActivePass = (studentId: string) => passes.find(p => p.studentId === studentId);

  const getElapsed = (start: number) => {
    const mins = Math.floor((Date.now() - start) / 60000);
    return `${mins}m`;
  };

  const getDestinationDetails = (id: string) => destinations.find(d => d.id === id) || destinations[0];

  // Helper to get styled classes based on theme
  const getThemeClasses = (theme: string) => {
      const themes: any = {
        blue: "bg-blue-50 text-blue-600 hover:bg-blue-100",
        red: "bg-red-50 text-red-600 hover:bg-red-100",
        yellow: "bg-yellow-50 text-yellow-600 hover:bg-yellow-100",
        green: "bg-green-50 text-green-600 hover:bg-green-100",
        purple: "bg-purple-50 text-purple-600 hover:bg-purple-100",
        orange: "bg-orange-50 text-orange-600 hover:bg-orange-100",
        slate: "bg-slate-50 text-slate-600 hover:bg-slate-100"
      };
      return themes[theme] || themes.blue;
  };

  // --- Render Methods ---

  const renderIssuePass = () => {
      const isSelectionActive = searchTerm || (selectedGender && selectedGrade && selectedSection);

      return (
        <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
            {/* Left: Student Grid */}
            <div className="flex-1 overflow-y-auto pr-2 rtl:pr-0 rtl:pl-2">
                {!isSelectionActive ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                        <Filter size={48} className="opacity-20 mb-4" />
                        <p>{t.selectClassMsg}</p>
                    </div>
                ) : filteredStudents.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-slate-400">
                        <p>{t.noStudentsFound}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredStudents.map(student => {
                            const activePass = getActivePass(student.id);
                            const dailyCount = store.getStudentDailyPassCount(student.id);
                            const limitReached = dailyCount >= maxPasses;
                            const isOverridden = overrideMap[student.id];
                            
                            const isUnauthorized = activePass?.type === UNAUTHORIZED_TYPE;

                            let activeDestDetails = null;
                            let isOverdue = false;

                            if (activePass && !isUnauthorized) {
                                activeDestDetails = getDestinationDetails(activePass.type);
                                if (activeDestDetails) {
                                    const maxTime = activeDestDetails.maxDuration * 60 * 1000;
                                    isOverdue = (Date.now() - activePass.startTime) > maxTime;
                                }
                            }

                            const cardBorderClass = activePass 
                                ? (isUnauthorized 
                                    ? 'border-red-500 shadow-red-100 ring-2 ring-red-500 bg-red-50'
                                    : isOverdue 
                                        ? 'border-red-200 shadow-red-100 ring-1 ring-red-100' 
                                        : 'border-green-200 shadow-green-100 ring-1 ring-green-100')
                                : 'border-slate-200 shadow-sm hover:shadow-md';

                            return (
                                <div key={student.id} className={`bg-white border rounded-xl p-4 transition-all ${cardBorderClass} relative`}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="font-bold text-slate-800 truncate">{lang === 'en' ? student.name_en : student.name_ar}</h4>
                                            <p className="text-xs text-slate-500 font-mono">#{student.studentNumber}</p>
                                        </div>
                                        {activePass ? (
                                            isUnauthorized ? (
                                                <Badge color='red' className="animate-pulse font-bold">{t.unauthorized}</Badge>
                                            ) : (
                                                <Badge color={isOverdue ? 'red' : 'green'} className="animate-pulse">
                                                    {isOverdue ? t.passOverdue : t.passActive}
                                                </Badge>
                                            )
                                        ) : (
                                            <div className={`text-[10px] font-bold px-2 py-1 rounded-full ${limitReached ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {t.passes}: {dailyCount}/{maxPasses}
                                            </div>
                                        )}
                                    </div>

                                    {isUnauthorized && activePass ? (
                                        <div className="bg-red-100 border-2 border-red-200 rounded-lg p-4 text-center animate-in zoom-in">
                                            <div className="flex justify-center mb-2">
                                                <AlertOctagon size={32} className="text-red-600" />
                                            </div>
                                            <h5 className="font-bold text-red-800 text-sm mb-1">{t.outOfClass}</h5>
                                            <p className="text-xs text-red-700 mb-3">{t.studentOutOfClass}</p>
                                            <p className="text-xl font-mono text-red-900 font-bold mb-3">
                                                {getElapsed(activePass.startTime)}
                                            </p>
                                            <Button 
                                                onClick={() => handleComplete(activePass.id)}
                                                className="w-full bg-red-600 hover:bg-red-700 text-white text-xs h-9 shadow-lg"
                                            >
                                                {t.studentReturned}
                                            </Button>
                                        </div>
                                    ) : activePass && activeDestDetails ? (
                                        <div className={`rounded-lg p-3 text-center border ${isOverdue ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                                            <p className={`text-xs font-bold mb-1 ${isOverdue ? 'text-red-800' : 'text-green-800'}`}>
                                                {isOverdue ? t.passOverdue : t.passActive}: 
                                                {lang === 'en' ? activeDestDetails.label_en : activeDestDetails.label_ar}
                                            </p>
                                            <p className={`text-2xl font-mono mb-2 ${isOverdue ? 'text-red-600' : 'text-green-600'}`}>
                                                {getElapsed(activePass.startTime)}
                                            </p>
                                            <Button 
                                                onClick={() => handleComplete(activePass.id)}
                                                className={`w-full text-white text-xs h-8 ${isOverdue ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                                            >
                                                {t.endPass}
                                            </Button>
                                        </div>
                                    ) : limitReached && !isOverridden ? (
                                        <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-center">
                                            <div className="flex justify-center mb-2">
                                                <Ban size={24} className="text-red-400" />
                                            </div>
                                            <p className="text-xs font-bold text-red-800 mb-2">{t.dailyLimit} ({maxPasses})</p>
                                            <Button 
                                                variant="ghost" 
                                                onClick={() => handleAllowOverride(student.id)}
                                                className="w-full bg-white border border-red-200 text-red-600 hover:bg-red-100 h-8 text-xs mb-2"
                                            >
                                                {t.allowAnyway}
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-2">
                                                {destinations.map(dest => {
                                                    const IconComp = ICON_MAP[dest.iconName] || Ticket;
                                                    return (
                                                        <button
                                                            key={dest.id}
                                                            onClick={() => handleCreatePass(student.id, dest.id)}
                                                            className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors gap-1 ${getThemeClasses(dest.colorTheme)}`}
                                                        >
                                                            <IconComp size={18} />
                                                            <span className="text-[10px] font-bold text-center leading-tight">
                                                                {lang === 'en' ? dest.label_en : dest.label_ar}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            
                                            <button
                                                onClick={() => handleCreatePass(student.id, UNAUTHORIZED_TYPE)}
                                                className="w-full flex items-center justify-center gap-2 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-bold transition-colors"
                                            >
                                                <AlertTriangle size={14} /> {t.outOfClass}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
      );
  };

  const renderDashboard = () => (
      <div className="flex-1 overflow-y-auto space-y-6">
          {/* Top Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                      <p className="text-sm text-slate-500 mb-1">{t.totalActive}</p>
                      <h3 className="text-3xl font-bold text-blue-600">{passes.length}</h3>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                      <Ticket size={24} />
                  </div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                      <p className="text-sm text-slate-500 mb-1">{t.totalOverdue}</p>
                      <h3 className="text-3xl font-bold text-red-600">{totalOverdue}</h3>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                      <Clock size={24} />
                  </div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                      <p className="text-sm text-slate-500 mb-1">{t.outOfClass}</p>
                      <h3 className="text-3xl font-bold text-orange-600">{destinationStats['UNAUTHORIZED'] || 0}</h3>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                      <AlertOctagon size={24} />
                  </div>
              </div>
          </div>

          {/* Destination Breakdown */}
          <div>
              <h3 className="font-bold text-slate-800 mb-3 text-lg">{t.destinationBreakdown}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {destinations.map(dest => {
                      const count = destinationStats[dest.id] || 0;
                      const IconComp = ICON_MAP[dest.iconName] || Ticket;
                      return (
                          <div key={dest.id} className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center gap-2 shadow-sm hover:shadow-md transition-shadow">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getThemeClasses(dest.colorTheme)}`}>
                                  <IconComp size={20} />
                              </div>
                              <span className="text-sm font-bold text-slate-700 text-center leading-tight">
                                  {lang === 'en' ? dest.label_en : dest.label_ar}
                              </span>
                              <Badge color={count > 0 ? 'blue' : 'gray'} className="text-xs">
                                  {count}
                              </Badge>
                          </div>
                      )
                  })}
              </div>
          </div>

          {/* Active Students Table */}
          <Card>
              <h3 className="font-bold text-slate-800 mb-4 text-lg">{t.activeStudentList}</h3>
              <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                      <thead>
                          <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                              <th className="p-3 rounded-tl-lg text-start">{t.studentName}</th>
                              <th className="p-3 text-start">{t.grade}</th>
                              <th className="p-3 text-start">{t.issuedBy}</th>
                              <th className="p-3 text-start">{t.where}</th>
                              <th className="p-3 text-start">{t.startTime}</th>
                              <th className="p-3 text-start">{t.timeElapsed}</th>
                              <th className="p-3 text-center rounded-tr-lg">{t.actions}</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {passes.length === 0 ? (
                              <tr>
                                  <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                                      No active passes
                                  </td>
                              </tr>
                          ) : (
                              passes.map(pass => {
                                  const student = students.find(s => s.id === pass.studentId);
                                  const issuer = users.find(u => u.id === pass.teacherId);
                                  const isUnauthorized = pass.type === UNAUTHORIZED_TYPE;
                                  let destLabel = t.unauthorized;
                                  let destColor = 'red';
                                  
                                  if (!isUnauthorized) {
                                      const dest = getDestinationDetails(pass.type);
                                      destLabel = lang === 'en' ? dest.label_en : dest.label_ar;
                                      destColor = dest.colorTheme;
                                  }

                                  const elapsed = getElapsed(pass.startTime);
                                  const isOverdue = !isUnauthorized && parseInt(elapsed) > (getDestinationDetails(pass.type).maxDuration);

                                  return (
                                      <tr key={pass.id} className="hover:bg-slate-50 transition-colors">
                                          <td className="p-3">
                                              <div className="font-bold text-slate-800">{lang === 'en' ? student?.name_en : student?.name_ar}</div>
                                              <div className="text-xs text-slate-400 font-mono">{student?.studentNumber}</div>
                                          </td>
                                          <td className="p-3">
                                              <Badge color="gray">{student?.grade} - {student?.section}</Badge>
                                          </td>
                                          <td className="p-3 text-sm text-slate-600">
                                              {issuer ? issuer.name : <span className="text-slate-300">-</span>}
                                          </td>
                                          <td className="p-3">
                                              <Badge color={isUnauthorized ? 'red' : (destColor as any)}>
                                                  {destLabel}
                                              </Badge>
                                          </td>
                                          <td className="p-3 text-sm text-slate-600 font-mono">
                                              {new Date(pass.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                          </td>
                                          <td className="p-3">
                                              <span className={`font-mono font-bold ${isOverdue || isUnauthorized ? 'text-red-600' : 'text-green-600'}`}>
                                                  {elapsed}
                                              </span>
                                          </td>
                                          <td className="p-3 text-center">
                                              <Button 
                                                  variant="secondary" 
                                                  onClick={() => handleComplete(pass.id)}
                                                  className="text-xs h-8 px-3"
                                              >
                                                  {t.endPass}
                                              </Button>
                                          </td>
                                      </tr>
                                  )
                              })
                          )}
                      </tbody>
                  </table>
              </div>
          </Card>
      </div>
  );

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      
      {/* Top Tabs & Controls */}
      <Card className="shrink-0 pb-2">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center border-b border-slate-100 pb-4 mb-4">
             <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
                <button
                    onClick={() => setActiveTab('issue')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'issue' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <div className="flex items-center gap-2">
                        <Ticket size={16} /> {t.issuePass}
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <div className="flex items-center gap-2">
                        <LayoutDashboard size={16} /> {t.activityMonitor}
                    </div>
                </button>
             </div>

            {/* Filters only visible in Issue Mode */}
            {activeTab === 'issue' && (
                <div className="flex flex-wrap gap-3 items-end w-full lg:w-auto">
                     <div className="flex gap-2 w-full lg:w-auto">
                        <div className="w-1/3 lg:w-32">
                            <Select value={selectedGender} onChange={(e) => { setSelectedGender(e.target.value); setSelectedGrade(""); setSelectedSection(""); }} className="text-sm py-1.5">
                                <option value="">{t.gender}</option>
                                <option value="Male">{t.male}</option>
                                <option value="Female">{t.female}</option>
                            </Select>
                        </div>
                        <div className="w-1/3 lg:w-24">
                            <Select value={selectedGrade} onChange={(e) => { setSelectedGrade(e.target.value); setSelectedSection(""); }} disabled={!selectedGender} className="text-sm py-1.5">
                                <option value="">{t.grade}</option>
                                {availableGrades.map(g => <option key={g} value={g}>{g}</option>)}
                            </Select>
                        </div>
                        <div className="w-1/3 lg:w-24">
                            <Select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} disabled={!selectedGrade} className="text-sm py-1.5">
                                <option value="">{t.section}</option>
                                {availableSections.map(s => <option key={s} value={s}>{s}</option>)}
                            </Select>
                        </div>
                    </div>
                    <div className="w-full lg:w-48 relative">
                        <Search className={`absolute top-2 text-slate-400 ${lang === 'ar' ? 'right-3' : 'left-3'}`} size={14} />
                        <Input 
                            placeholder={t.searchPlaceholder} 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`text-sm py-1.5 ${lang === 'ar' ? 'pr-9' : 'pl-9'}`}
                        />
                    </div>
                </div>
            )}
        </div>
      </Card>

      {/* Main Content Area */}
      {activeTab === 'issue' ? renderIssuePass() : renderDashboard()}
      
    </div>
  );
};
