import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Button, Select, Badge, Input, Pagination } from './ui'; 
import { useStore } from '../services/store';
import { Language, EPass as EPassType, Student, EPassDestination, UserRole, User } from '../types';
import { TRANSLATIONS } from '../constants';
// CHANGED: Replaced 'XIcon' with 'X' as XIcon is not a standard export
import { Search, Filter, Ticket, Library, Stethoscope, Armchair, Briefcase, Coffee, Gamepad2, Music, Dumbbell, Beaker, BookOpen, Users, Ban, AlertOctagon, LayoutDashboard, AlertTriangle, Clock, ArrowUp, ArrowDown, ArrowUpDown, X } from 'lucide-react';
// import { sendUnauthorizedAlert, sendPassCreatedAlert } from '../services/telegramService';

interface EPassProps {
  lang: Language;
  currentUserRole?: UserRole;
  currentUserId?: string;
}

// Icon lookup map
const ICON_MAP: any = {
    Armchair, Stethoscope, Library, Briefcase, Coffee, Gamepad2, Music, Dumbbell, Beaker, BookOpen, Users
};

const UNAUTHORIZED_TYPE = 'UNAUTHORIZED';
const DASHBOARD_ITEMS_PER_PAGE = 10;

// Helper to get theme classes (Moved outside for better reusability)
const getThemeClasses = (theme: string) => {
    const themes: any = {
      blue: "bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50",
      red: "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50",
      yellow: "bg-yellow-50 text-yellow-600 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300 dark:hover:bg-yellow-900/50",
      green: "bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50",
      purple: "bg-purple-50 text-purple-600 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50",
      orange: "bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50",
      slate: "bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
    };
    return themes[theme] || themes.blue;
};

// ------------------------------------------
// Modal Component (UPDATED: Using X icon)
// ------------------------------------------

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    className?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, className = '' }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 
                 bg-black/40 backdrop-blur-md
                 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className={`bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-[2rem] shadow-2xl border border-white/20 dark:border-slate-700
                   max-h-[90vh] overflow-y-auto w-full max-w-lg
                   animate-in zoom-in-95 duration-300 ease-out
                   ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="relative p-8 pb-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white pr-10">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="absolute right-6 top-7 rounded-full p-2 
                       hover:bg-slate-100 dark:hover:bg-slate-700 
                       transition-all duration-200 text-slate-500 dark:text-slate-400"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-8 pt-6">
          {children}
        </div>
      </div>
    </div>
  );
};


// ------------------------------------------
// Issue Pass Modal Component
// ------------------------------------------

interface IssuePassModalProps {
    student: Student;
    destinations: EPassDestination[];
    t: typeof TRANSLATIONS.en; // Translation object
    lang: Language;
    maxPasses: number;
    dailyCount: number;
    isOverridden: boolean;
    isLoading: boolean;
    handleCreatePass: (studentId: string, type: string) => Promise<void>;
    handleAllowOverride: (studentId: string) => void;
    onClose: () => void;
}

const IssuePassModal: React.FC<IssuePassModalProps> = ({
    student,
    destinations,
    t,
    lang,
    maxPasses,
    dailyCount,
    isOverridden,
    isLoading,
    handleCreatePass,
    handleAllowOverride,
    onClose
}) => {
    const limitReached = dailyCount >= maxPasses;

    const handleCreatePassAndClose = async (studentId: string, type: string) => {
        await handleCreatePass(studentId, type);
        onClose();
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={t.issuePassFor || "Issue Pass"} className="w-full max-w-lg">
            <div className="">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-dashed border-slate-200 dark:border-slate-700">
                    <h4 className="text-xl font-bold text-slate-800 dark:text-white">
                        {lang === 'en' ? student.name_en : student.name_ar}
                    </h4>
                    <div className={`text-sm font-bold px-4 py-1.5 rounded-full ${limitReached && !isOverridden ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>
                        {t.passes}: {dailyCount}/{maxPasses}
                    </div>
                </div>

                {limitReached && !isOverridden ? (
                    <div className="bg-red-500/10 dark:bg-red-900/30 border border-red-500/20 backdrop-blur-sm rounded-2xl p-6 text-center mb-4">
                        <div className="flex justify-center mb-3"><Ban size={40} className="text-red-400" /></div>
                        <p className="text-lg font-bold text-red-800 dark:text-red-300 mb-6">{t.dailyLimit} ({maxPasses})</p>
                        {/* FIX: Line 93 - Removed variant="default" */}
                        <Button 
                            onClick={() => { handleAllowOverride(student.id); onClose(); }} 
                            className="w-full bg-red-600 dark:bg-red-700 hover:bg-red-700 text-white shadow-lg h-12 font-bold text-base rounded-xl"
                        >
                            {t.allowAnyway || "Allow Anyway"}
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <p className="text-slate-600 dark:text-slate-300 font-semibold">{t.selectDestination || "Select Destination"}:</p>
                        <div className="grid grid-cols-3 gap-4">
                            {destinations.map((dest: EPassDestination) => {
                                const IconComp = ICON_MAP[dest.iconName] || Ticket;
                                return (
                                    <button 
                                        key={dest.id} 
                                        disabled={isLoading} 
                                        onClick={() => handleCreatePassAndClose(student.id, dest.id)} 
                                        className={`flex flex-col items-center justify-center p-4 rounded-2xl transition-all gap-2 shadow-sm hover:shadow-lg hover:scale-105 active:scale-95 ${getThemeClasses(dest.colorTheme)} disabled:opacity-50 border border-white/20`}
                                    >
                                        <IconComp size={28} />
                                        <span className="text-xs font-bold text-center leading-tight">{lang === 'en' ? dest.label_en : dest.label_ar}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <button 
                            disabled={isLoading} 
                            onClick={() => handleCreatePassAndClose(student.id, UNAUTHORIZED_TYPE)} 
                            className="w-full flex items-center justify-center gap-3 py-4 bg-red-500/10 dark:bg-red-900/30 hover:bg-red-500/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-500/20 rounded-2xl text-sm font-bold transition-all disabled:opacity-50 shadow-sm hover:shadow-md"
                        >
                            <AlertTriangle size={18} /> {t.outOfClass} (UNAUTHORIZED)
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    );
};


// ------------------------------------------
// Student Card Component 
// ------------------------------------------

interface StudentEPassCardProps {
    student: Student;
    activePass: EPassType | undefined;
    dailyCount: number;
    maxPasses: number;
    isOverridden: boolean;
    isUnauthorized: boolean;
    isOverdue: boolean;
    activeDestDetails: EPassDestination | null;
    t: typeof TRANSLATIONS.en;
    lang: Language;
    getElapsed: (start: number) => string;
    handleComplete: (id: string) => Promise<void>;
    onCardClick: (student: Student) => void;
}

const StudentEPassCard: React.FC<StudentEPassCardProps> = ({
    student,
    activePass,
    dailyCount,
    maxPasses,
    isOverridden,
    isUnauthorized,
    isOverdue,
    activeDestDetails,
    t,
    lang,
    getElapsed,
    handleComplete,
    onCardClick
}) => {
    const limitReached = dailyCount >= maxPasses;

let cardBorderClass = 'bg-white/70 dark:bg-slate-800/80 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-glass hover:shadow-glass-hover';
let isDisabled = false;

if (activePass) {
    if (isUnauthorized) {
        cardBorderClass = 'bg-red-500/20 dark:bg-red-900/40 border-red-500/30 dark:border-red-700/50 shadow-lg shadow-red-500/10';
    } else if (isOverdue) {
        cardBorderClass = 'bg-yellow-500/20 dark:bg-yellow-900/30 border-yellow-500/30 dark:border-yellow-700/50 shadow-md shadow-yellow-500/10';
    } else {
        cardBorderClass = 'bg-green-500/20 dark:bg-green-900/40 border-green-500/30 dark:border-green-700/50 shadow-md shadow-green-500/10';
    }
  isDisabled = true;
} else if (limitReached && !isOverridden) {
  cardBorderClass = 'bg-slate-100/80 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-80 hover:opacity-100';
}

const handleClick = () => {
    if (!isDisabled) {
        onCardClick(student);
    }
};

    return (
      <div
        key={student.id}
        onClick={handleClick}
        className={`
          ${isDisabled ? 'cursor-default' : 'cursor-pointer'}
          group relative min-h-[140px]
          select-none
          will-change-transform
          transition-transform duration-300 ease-spring
          hover:scale-[1.03] hover:z-10
          active:scale-[0.98]
        `}
      >
        {/* This inner wrapper now holds the background, border, shadow, and rounding */}
        <div className={`absolute inset-0 rounded-3xl ${cardBorderClass} transition-all duration-300 ease-spring`}></div>
        
        {/* This inner wrapper ensures content never overflows and adapts perfectly */}
        <div className="relative z-10 flex-1 flex flex-col min-w-0 p-5 h-full">
    
    {/* Header – always visible and properly spaced */}
    <div className="flex justify-between items-start gap-2 mb-3">
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-slate-800 dark:text-white text-base leading-tight truncate">
          {lang === 'en' ? student.name_en : student.name_ar}
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1 opacity-80">
          #{student.studentNumber}
        </p>
      </div>

      <div className="shrink-0">
        {activePass ? (
          isUnauthorized ? (
            <Badge color="red" className="animate-pulse text-[10px] sm:text-xs font-bold px-2 py-1 shadow-sm">
              {t.unauthorized}
            </Badge>
          ) : (
            <Badge
              color={isOverdue ? 'red' : 'green'}
              className="animate-pulse text-[10px] sm:text-xs font-bold px-2 py-1 shadow-sm"
            >
              {isOverdue ? t.passOverdue : t.passActive}
            </Badge>
          )
        ) : (
          <div className={`
            text-[10px] font-bold px-2.5 py-1 rounded-full border
            ${limitReached && !isOverridden
              ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800'
              : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
            }
          `}>
            {dailyCount}/{maxPasses}
          </div>
        )}
      </div>
    </div>

    {/* Main Content Area – takes remaining space and handles overflow */}
    <div className="flex-1 flex items-center justify-center mt-1">
      {isUnauthorized && activePass ? (
        <div className="w-full text-center space-y-2">
          <p className="text-xs font-bold text-red-900 dark:text-red-200 uppercase tracking-widest">
            {t.outOfClass}
          </p>
          <p className="text-3xl font-mono font-bold text-red-900 dark:text-red-100 tracking-tight">
            {getElapsed(activePass.startTime)}
          </p>
          <Button
            onClick={(e) => { e.stopPropagation(); handleComplete(activePass.id); }}
            className="w-full text-xs h-10 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/30"
          >
            {t.studentReturned}
          </Button>
        </div>
      ) : activePass && activeDestDetails ? (
        <div className="w-full text-center space-y-2">
          <p className={`text-sm font-bold ${isOverdue ? 'text-yellow-800 dark:text-yellow-300' : 'text-green-800 dark:text-green-300'}`}>
            {lang === 'en' ? activeDestDetails.label_en : activeDestDetails.label_ar}
          </p>
          <p className={`text-3xl font-mono font-bold tracking-tight ${isOverdue ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
            {getElapsed(activePass.startTime)}
          </p>
          <Button
            onClick={(e) => { e.stopPropagation(); handleComplete(activePass.id); }}
            className={`w-full text-xs h-10 font-bold text-white shadow-lg rounded-xl transition-all hover:-translate-y-0.5 ${
              isOverdue ? 'bg-red-600 hover:bg-red-700 shadow-red-500/30' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'
            }`}
          >
            {t.endPass}
          </Button>
        </div>
      ) : limitReached && !isOverridden ? (
        <div className="text-center space-y-1">
          <Ban size={32} className="mx-auto text-slate-400/80 dark:text-slate-500/60 mb-2" />
          <p className="text-xs font-bold text-slate-500/80 dark:text-slate-400/80 uppercase tracking-wide">
            {t.dailyLimitReached}
          </p>
        </div>
      ) : (
        <div className="text-center opacity-60 group-hover:opacity-100 transition-opacity">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-2 text-blue-500 dark:text-blue-400">
             <Ticket size={24} />
          </div>
          <p className="text-xs font-bold text-blue-600 dark:text-blue-400">
            {t.clickToIssuePass}
          </p>
        </div>
      )}
    </div>
        </div>
      </div>
);
};


// ------------------------------------------
// Main EPass Component 
// ------------------------------------------

export const EPass: React.FC<EPassProps> = ({ lang, currentUserRole, currentUserId }) => {
  const t = TRANSLATIONS[lang];
  const store = useStore();
  const [activeTab, setActiveTab] = useState<'issue' | 'dashboard'>('issue');
  
  // Local Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGender, setSelectedGender] = useState<string>("");
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [overrideMap, setOverrideMap] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  
  // New state for the modal
  const [modalStudent, setModalStudent] = useState<Student | null>(null);

  // Dashboard Pagination & Sorting
  const [dashboardPage, setDashboardPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  // Reactive Data from Store
  const users = store.getUsers();
  const destinations = store.getDestinations();
  const maxPasses = store.getSettings().maxPassesPerDay;

  const students = useMemo(() => {
      return currentUserId ? store.getStudentsForUser(currentUserId) : store.getStudents();
  }, [currentUserId, store.getStudents()]);

  const relevantStudentIds = useMemo(() => new Set(students.map(s => s.id)), [students]);
  const passes = store.getEPasses().filter(p => p.status === 'Active' && relevantStudentIds.has(p.studentId));

  const currentUser = useMemo(() => {
      if (currentUserId) return users.find(u => u.id === currentUserId);
      if (currentUserRole) return users.find(u => u.role === currentUserRole);
      return undefined;
  }, [currentUserId, currentUserRole, users]);

  // --- Derived Data for Dashboard ---
  const destinationStats = useMemo(() => {
    const stats: Record<string, number> = {};
    destinations.forEach(d => stats[d.id] = 0);
    stats['UNAUTHORIZED'] = 0;
    passes.forEach(p => {
      const key = p.type === UNAUTHORIZED_TYPE ? 'UNAUTHORIZED' : p.type;
      if (stats[key] !== undefined) stats[key]++; else stats[key] = 1;
    });
    return stats;
  }, [passes, destinations]);

  const totalOverdue = passes.filter(p => {
      if (p.type === UNAUTHORIZED_TYPE) return true;
      const dest = destinations.find(d => d.id === p.type);
      if (!dest) return false;
      return (Date.now() - p.startTime) > (dest.maxDuration * 60 * 1000);
  }).length;

  // Sorting Logic
  const sortedPasses = useMemo(() => {
      let sorted = [...passes];
      if (sortConfig) {
          sorted.sort((a, b) => {
              if (sortConfig.key === 'startTime') {
                  return sortConfig.direction === 'asc' 
                      ? a.startTime - b.startTime 
                      : b.startTime - a.startTime;
              }
              return 0;
          });
      }
      return sorted;
  }, [passes, sortConfig]);

  // Dashboard Pagination Logic
  const paginatedPasses = useMemo(() => {
      const start = (dashboardPage - 1) * DASHBOARD_ITEMS_PER_PAGE;
      return sortedPasses.slice(start, start + DASHBOARD_ITEMS_PER_PAGE);
  }, [sortedPasses, dashboardPage]);

  const totalDashboardPages = Math.ceil(passes.length / DASHBOARD_ITEMS_PER_PAGE);

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
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        return result.filter(s => 
            s.name_en.toLowerCase().includes(lower) || 
            s.name_ar.includes(lower) || 
            s.studentNumber.includes(lower)
        );
    }
    if (selectedGender && selectedGrade && selectedSection) {
        return result.filter(s => 
            s.gender === selectedGender && s.grade === selectedGrade && s.section === selectedSection
        );
    }
    return [];
  }, [students, searchTerm, selectedGender, selectedGrade, selectedSection]);

  // --- Handlers ---
  const handleCreatePass = useCallback(async (studentId: string, type: string) => {
    setIsLoading(true);
    try {
        await store.createEPass({ studentId, type, teacherId: currentUser?.id });
        const student = students.find(s => s.id === studentId);
        if (student) store.sendEPassAlert(student, type, destinations);
        if (overrideMap[studentId]) {
            setOverrideMap(prev => { const newMap = { ...prev }; delete newMap[studentId]; return newMap; });
        }
    } catch (e) { console.error(e); alert("Failed to create pass"); } 
    finally { setIsLoading(false); }
  }, [currentUser?.id, destinations, overrideMap, students, store]);

  const handleComplete = async (id: string) => {
    try { await store.completeEPass(id); } catch (e) { console.error(e); }
  };

  const handleAllowOverride = (studentId: string) => {
      setOverrideMap(prev => ({ ...prev, [studentId]: true }));
  };

  const handleCardClick = (student: Student) => {
    const dailyCount = store.getStudentDailyPassCount(student.id);
    const limitReached = dailyCount >= maxPasses;
    const isOverridden = overrideMap[student.id];

    // If the limit is reached and NOT overridden, we still open the modal 
    // to allow the teacher to click the 'Allow Anyway' button, which handles the override.
    if (limitReached && !isOverridden) {
        setModalStudent(student);
    } 
    // If there is no active pass, open the modal for pass issuance
    else if (!getActivePass(student.id)) {
        setModalStudent(student);
    }
    // If there is an active pass, the card handles the 'End Pass' action directly, so no modal.
  }

  const handleSort = (key: string) => {
      setSortConfig(current => {
          if (current?.key === key && current.direction === 'asc') {
              return { key, direction: 'desc' };
          }
          return { key, direction: 'asc' };
      });
      setDashboardPage(1);
  };

  const getActivePass = (studentId: string) => passes.find(p => p.studentId === studentId);
  const getElapsed = (start: number) => `${Math.floor((Date.now() - start) / 60000)}m`;
  const getDestinationDetails = (id: string) => destinations.find(d => d.id === id) || destinations[0];

  const renderIssuePass = () => {
      const isSelectionActive = searchTerm || (selectedGender && selectedGrade && selectedSection);
      return (
        <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-2 rtl:pr-0 rtl:pl-2 scrollbar-none">
                {!isSelectionActive ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl bg-slate-50/50 dark:bg-slate-900/30">
                        <Filter size={64} className="opacity-20 mb-6" />
                        <p className="text-lg font-medium">{t.selectClassMsg}</p>
                    </div>
                ) : filteredStudents.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-slate-400"><p>{t.noStudentsFound}</p></div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 
                gap-6 
                p-8
                pb-32
                [transform:translateZ(0)] 
                [&>*]:!overflow-visible">
  {filteredStudents.map(student => {
                            const activePass = getActivePass(student.id);
                            const dailyCount = store.getStudentDailyPassCount(student.id);
                            const maxPasses = store.getSettings().maxPassesPerDay; // Ensure maxPasses is available here
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

                            return (
                                <StudentEPassCard
                                    key={student.id}
                                    student={student}
                                    activePass={activePass}
                                    dailyCount={dailyCount}
                                    maxPasses={maxPasses}
                                    isOverridden={isOverridden}
                                    isUnauthorized={isUnauthorized}
                                    isOverdue={isOverdue}
                                    activeDestDetails={activeDestDetails}
                                    t={t}
                                    lang={lang}
                                    getElapsed={getElapsed}
                                    handleComplete={handleComplete}
                                    onCardClick={handleCardClick}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
            {/* Render Modal if a student is selected for pass issuance */}
            {modalStudent && (
                <IssuePassModal
                    student={modalStudent}
                    destinations={destinations}
                    t={t}
                    lang={lang}
                    maxPasses={maxPasses}
                    dailyCount={store.getStudentDailyPassCount(modalStudent.id)}
                    isOverridden={overrideMap[modalStudent.id] || false}
                    isLoading={isLoading}
                    handleCreatePass={handleCreatePass}
                    handleAllowOverride={handleAllowOverride}
                    onClose={() => setModalStudent(null)}
                />
            )}
        </div>
      );
  };

  const renderDashboard = () => (
      <div className="flex-1 overflow-y-auto space-y-8 scrollbar-none p-12 pb-48">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/80 dark:bg-slate-800/80 p-6 rounded-3xl border border-white/40 dark:border-white/10 shadow-glass flex items-center justify-between backdrop-blur-md">
                  <div><p className="text-sm text-slate-500 dark:text-slate-400 mb-1 font-medium">{t.totalActive}</p><h3 className="text-4xl font-bold text-blue-600 dark:text-blue-400">{passes.length}</h3></div>
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm"><Ticket size={32} /></div>
              </div>
              <div className="bg-white/80 dark:bg-slate-800/80 p-6 rounded-3xl border border-white/40 dark:border-white/10 shadow-glass flex items-center justify-between backdrop-blur-md">
                  <div><p className="text-sm text-slate-500 dark:text-slate-400 mb-1 font-medium">{t.totalOverdue}</p><h3 className="text-4xl font-bold text-red-600 dark:text-red-400">{totalOverdue}</h3></div>
                  <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 shadow-sm"><Clock size={32} /></div>
              </div>
              <div className="bg-white/80 dark:bg-slate-800/80 p-6 rounded-3xl border border-white/40 dark:border-white/10 shadow-glass flex items-center justify-between backdrop-blur-md">
                  <div><p className="text-sm text-slate-500 dark:text-slate-400 mb-1 font-medium">{t.outOfClass}</p><h3 className="text-4xl font-bold text-orange-600 dark:text-orange-400">{destinationStats['UNAUTHORIZED'] || 0}</h3></div>
                  <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 shadow-sm"><AlertOctagon size={32} /></div>
              </div>
          </div>
          <div>
              <h3 className="font-bold text-slate-800 dark:text-white mb-4 text-xl">{t.destinationBreakdown}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {destinations.map((dest: EPassDestination) => {
                      const count = destinationStats[dest.id] || 0;
                      const IconComp = ICON_MAP[dest.iconName] || Ticket;
                      return (
                          <div key={dest.id} className="bg-white/70 dark:bg-slate-800/70 p-5 rounded-2xl border border-white/30 dark:border-slate-700 flex flex-col items-center justify-center gap-3 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all backdrop-blur-md">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm ${getThemeClasses(dest.colorTheme)} border border-white/30`}><IconComp size={22} /></div>
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-200 text-center leading-tight">{lang === 'en' ? dest.label_en : dest.label_ar}</span>
                              <Badge color={count > 0 ? (dest.colorTheme as any) : 'gray'} className="text-sm px-3 py-0.5">{count}</Badge>
                          </div>
                      )
                  })}
              </div>
          </div>
          <Card className="!overflow-visible">
              <div className="overflow-hidden rounded-[2rem]">
                  <h3 className="font-bold text-slate-800 dark:text-white mb-6 text-xl px-2 pt-6 pl-6">{t.activeStudentList}</h3>
                  <div className="overflow-x-auto pb-6">
                      <table className="w-full text-left border-collapse">
                          <thead className="sticky top-0 z-10">
                              <tr className="bg-slate-50/50 dark:bg-slate-700/30 text-slate-500 dark:text-slate-400 text-sm border-b border-slate-100 dark:border-slate-700/50">
                                  <th className="p-4 rounded-tl-2xl text-start">{t.studentName}</th>
                                  <th className="p-4 text-start">{t.grade}</th>
                                  <th className="p-4 text-start">{t.issuedBy}</th>
                                  <th className="p-4 text-start">{t.where}</th>
                                  <th 
                                      className="p-4 text-start cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-colors select-none"
                                      onClick={() => handleSort('startTime')}
                                  >
                                      <div className="flex items-center gap-2">
                                          {t.startTime}
                                          {sortConfig?.key === 'startTime' ? (
                                              sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                          ) : (
                                              <ArrowUpDown size={14} className="text-slate-300" />
                                          )}
                                      </div>
                                  </th>
                                  <th className="p-4 text-start">{t.timeElapsed}</th>
                                  <th className="p-4 text-center rounded-tr-2xl">{t.actions}</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100/50 dark:divide-slate-700/50">
                              {paginatedPasses.length === 0 ? (
                                  <tr><td colSpan={7} className="p-12 text-center text-slate-400 italic">No active passes</td></tr>
                              ) : (
                                  paginatedPasses.map(pass => {
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
                                      return ( // Added backdrop-blur to table rows
                                          <tr key={pass.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                              <td className="p-4">
                                                  <div className="font-bold text-slate-800 dark:text-white">{lang === 'en' ? student?.name_en : student?.name_ar}</div>
                                                  <div className="text-xs text-slate-400 font-mono mt-0.5">{student?.studentNumber}</div>
                                              </td>
                                              <td className="p-4"><Badge color="gray">{student?.grade} - {student?.section}</Badge></td>
                                              <td className="p-4 text-sm text-slate-600 dark:text-slate-300">{issuer ? issuer.name : <span className="text-slate-300">-</span>}</td>
                                              <td className="p-4"><Badge color={isUnauthorized ? 'red' : (destColor as any)}>{destLabel}</Badge></td>
                                              <td className="p-4 text-sm text-slate-600 dark:text-slate-300 font-mono">{new Date(pass.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                              <td className="p-4"><span className={`font-mono font-bold ${isUnauthorized ? 'text-red-600 dark:text-red-400' : isOverdue ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>{elapsed}</span></td>
                                              <td className="p-4 text-center">
                                                {/* End Pass button color is purple */}
    <Button
      onClick={(e) => {
        e.stopPropagation();
        handleComplete(pass.id);
      }}
      variant="secondary"
      className="text-xs h-9 px-4"
    >
      {t.endPass}
    </Button>                                       </td>
                                          </tr>
                                      )
                                  })
                              )}
                          </tbody>
                      </table>
                  </div>
                  <Pagination 
                      currentPage={dashboardPage}
                      totalPages={totalDashboardPages}
                      onPageChange={setDashboardPage}
                      className="p-4 pt-6 border-t border-slate-100 dark:border-slate-700"
                  />
              </div>
          </Card>
      </div>
  );

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      <Card className="shrink-0 !p-2">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
             <div className="flex gap-2 bg-slate-100/50 dark:bg-slate-900/50 p-1.5 rounded-2xl">
                <button 
  onClick={() => setActiveTab('issue')}
  className={`
    flex-1 lg:flex-none px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300
    ${activeTab === 'issue' 
      ? 'bg-white dark:bg-slate-800 shadow-lg text-primary' 
      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:backdrop-blur-md'
    }
  `}
>
                    <div className="flex items-center gap-2"><Ticket size={18} /> {t.issuePass}</div>
                </button>
                <button 
  onClick={() => setActiveTab('dashboard')}
  className={`
    flex-1 lg:flex-none px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300
    ${activeTab === 'dashboard' 
      ? 'bg-white dark:bg-slate-800 shadow-lg text-primary' 
      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:backdrop-blur-md'
    }
  `}
>
                    <div className="flex items-center gap-2"><LayoutDashboard size={18} /> {t.activityMonitor}</div>
                </button>
             </div>
            {activeTab === 'issue' && (
                <div className="flex flex-wrap gap-3 items-end w-full lg:w-auto">
                     <div className="flex gap-2 w-full lg:w-auto">
                        <div className="w-1/3 lg:w-28">
                            <Select value={selectedGender} onChange={(e) => { setSelectedGender(e.target.value); setSelectedGrade(""); setSelectedSection(""); }} className="text-sm py-2 h-11">
                                <option value="">{t.gender}</option>
                                <option value="Male">{t.male}</option>
                                <option value="Female">{t.female}</option>
                            </Select>
                        </div>
                        <div className="w-1/3 lg:w-28">
                            <Select value={selectedGrade} onChange={(e) => { setSelectedGrade(e.target.value); setSelectedSection(""); }} disabled={!selectedGender} className="text-sm py-2 h-11">
                                <option value="">{t.grade}</option>
                                {availableGrades.map(g => <option key={g} value={g}>{g}</option>)}
                            </Select>
                        </div>
                        <div className="w-1/3 lg:w-28">
                            <Select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} disabled={!selectedGrade} className="text-sm py-2 h-11">
                                <option value="">{t.section}</option>
                                {availableSections.map(s => <option key={s} value={s}>{s}</option>)}
                            </Select>
                        </div>
                    </div>
                    <div className="w-full lg:w-56 relative">
                        <Search className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${lang === 'ar' ? 'right-3' : 'left-3'}`} size={18} />
                        <Input placeholder={t.searchPlaceholder} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`text-sm h-10 ${lang === 'ar' ? 'pr-10' : 'pl-10'}`} />
                    </div>
                </div>
            )}
        </div>
      </Card>
      {activeTab === 'issue' ? renderIssuePass() : renderDashboard()}
    </div>
  );
};