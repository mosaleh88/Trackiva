import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Badge } from './ui';
import { useStore } from '../services/store';
import { Student, Language, User } from '../types';
import { TRANSLATIONS, EARLY_LEAVE_REASONS, PICKUP_RELATIONS } from '../constants';
import { 
  Search, ArrowRight, UserCheck, LogOut, Clock, Bus, User as UserIcon, Filter, AlertTriangle, CheckCircle2,
  Stethoscope, Home, Thermometer, FileText, Plane, MoreHorizontal 
} from 'lucide-react';

interface ReceptionProps {
  lang: Language;
  currentUser: User | null;
}

const REASON_ICONS: Record<string, any> = {
  "Medical Appointment": Stethoscope,
  "Family Emergency": Home,
  "Sickness": Thermometer,
  "Official Paperwork": FileText,
  "Travel": Plane,
  "Other": MoreHorizontal
};

export const Reception: React.FC<ReceptionProps> = ({ lang, currentUser }) => {
  const t = TRANSLATIONS[lang];
  const store = useStore();
  const [mode, setMode] = useState<'LateArrival' | 'EarlyLeave'>('LateArrival');
  const [lastLog, setLastLog] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Filter States
  const [selectedGender, setSelectedGender] = useState<string>("");
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [searchNumber, setSearchNumber] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [siblings, setSiblings] = useState<Student[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false); // Default closed to save space on mobile

  // Form States
  const [reasonSelect, setReasonSelect] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [pickedBy, setPickedBy] = useState("");
  const [pickerId, setPickerId] = useState("");

  const students = useMemo(() => currentUser ? store.getStudentsForUser(currentUser.id) : store.getStudents(), [currentUser, store.getStudents()]);

  // EFFECT: Auto-collapse filter when class selection is complete
  useEffect(() => {
    if (selectedGender && selectedGrade && selectedSection) {
      setIsFilterOpen(false);
    }
  }, [selectedGender, selectedGrade, selectedSection]);

  useEffect(() => {
    if (selectedStudentId) {
        const student = students.find(s => s.id === selectedStudentId);
        if (student) {
            setSiblings(store.getSiblings(student.id));
        }
    } else setSiblings([]);
  }, [selectedStudentId, students]);

  const filteredStudents = useMemo(() => {
    if (searchNumber) return students.filter(s => s.studentNumber.includes(searchNumber));
    if (selectedGender && selectedGrade && selectedSection) return students.filter(s => s.gender === selectedGender && s.grade === selectedGrade && s.section === selectedSection);
    return [];
  }, [students, searchNumber, selectedGender, selectedGrade, selectedSection]);

  const availableGrades = useMemo(() => { if (!selectedGender) return []; return Array.from(new Set(students.filter(s => s.gender === selectedGender).map(s => s.grade))).sort(); }, [students, selectedGender]);
  const availableSections = useMemo(() => { if (!selectedGender || !selectedGrade) return []; return Array.from(new Set(students.filter(s => s.gender === selectedGender && s.grade === selectedGrade).map(s => s.section))).sort(); }, [students, selectedGender, selectedGrade]);

  const isCriteriaActive = !!searchNumber || (!!selectedGender && !!selectedGrade && !!selectedSection);

  const handleReset = () => { setSelectedGender(""); setSelectedGrade(""); setSelectedSection(""); setSearchNumber(""); setSelectedStudentId(""); setReasonSelect(""); setReasonText(""); setPickedBy(""); setPickerId(""); };
  const handleModeSwitch = (newMode: 'LateArrival' | 'EarlyLeave') => { setMode(newMode); handleReset(); };

  const handleLog = async () => {
    if (!selectedStudentId) return;
    setIsLoading(true);
    const currentStudent = students.find(s => s.id === selectedStudentId);
    const finalReason = reasonSelect === 'Other' ? reasonText : reasonSelect;
    
    try {
        const log = await store.logReception({ 
            studentId: selectedStudentId, 
            type: mode, 
            reason: mode === 'EarlyLeave' ? finalReason : undefined, 
            pickupBy: mode === 'EarlyLeave' ? pickedBy : undefined, 
            pickupId: mode === 'EarlyLeave' ? pickerId : undefined 
        });
        
        if (mode === 'EarlyLeave' && currentStudent) {
            store.sendEarlyLeaveAlert(currentStudent, finalReason, pickedBy, pickerId);
        }
        
        setLastLog(log); 
        setSelectedStudentId(""); 
        setReasonSelect(""); 
        setReasonText(""); 
        setPickedBy(""); 
        setPickerId(""); 
        setTimeout(() => setLastLog(null), 4000);
    } catch (e) { 
        console.error(e); 
        alert("Failed to log reception event"); 
    } finally { 
        setIsLoading(false); 
    }
  };

  const currentStudent = students.find(s => s.id === selectedStudentId);
  const themeColor = mode === 'LateArrival' ? 'blue' : 'orange';

  return (
    <div className="flex flex-col lg:flex-row lg:h-[calc(125vh-8.5rem)] h-auto gap-4 lg:gap-6 animate-in fade-in duration-500">
      
      {/* Sidebar: Student Finder */}
      <Card className="w-full lg:w-96 !p-0 h-[500px] lg:h-full shrink-0 transition-all duration-300 ">
        <div className="flex flex-col h-full ">
            {/* Header Tabs */}
            <div className="grid grid-cols-2 bg-slate-100/50 dark:bg-slate-900/50 p-2 gap-2 border-b border-white/20 dark:border-white/10 shrink-0">
                <button 
                    onClick={() => handleModeSwitch('LateArrival')} 
                    className={`flex flex-col items-center justify-center py-3 rounded-xl transition-all duration-300 ${mode === 'LateArrival' ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:bg-white/50'}`}
                >
                    <Clock size={20} className="mb-1" />
                    <span className="text-[10px] font-bold uppercase">{t.lateArrival}</span>
                </button>
                <button 
                    onClick={() => handleModeSwitch('EarlyLeave')} 
                    className={`flex flex-col items-center justify-center py-3 rounded-xl transition-all duration-300 ${mode === 'EarlyLeave' ? 'bg-white dark:bg-slate-800 shadow-sm text-orange-600 dark:text-orange-400' : 'text-slate-400 hover:bg-white/50'}`}
                >
                    <LogOut size={20} className="mb-1" />
                    <span className="text-[10px] font-bold uppercase">{t.earlyLeave}</span>
                </button>
            </div>

            {/* Search & Filter */}
            <div className="p-4 space-y-3 bg-white/30 dark:bg-slate-800/30 border-b border-white/10 shrink-0">
                <div className="relative">
                    <Search className={`absolute top-3 text-slate-400 ${lang === 'ar' ? 'right-3' : 'left-3'}`} size={18} />
                    <input 
                        type="text" 
                        placeholder={t.searchPlaceholder} 
                        className={`w-full h-10 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-${themeColor}-500/50 text-sm ${lang === 'ar' ? 'pr-10' : 'pl-10'}`} 
                        value={searchNumber} 
                        onChange={(e) => { setSearchNumber(e.target.value); setSelectedStudentId(""); }} 
                    />
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-xl bg-white/40 dark:bg-slate-900/40 overflow-hidden">
                    <button onClick={() => setIsFilterOpen(!isFilterOpen)} className="w-full flex justify-between items-center px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                        <span className="flex items-center gap-2"><Filter size={14} /> {t.filterBy}</span>
                        <ArrowRight size={14} className={`transition-transform duration-300 ${isFilterOpen ? 'rotate-90' : ''}`} />
                    </button>
                    <div className={`transition-all duration-300 overflow-hidden ${isFilterOpen ? 'max-h-60' : 'max-h-0'}`}>
                        <div className="p-3 space-y-2 pt-2 ">
                            <Select value={selectedGender} onChange={(e) => { setSelectedGender(e.target.value); setSelectedGrade(""); }} className="h-11 text-sm py-2"><option value="">{t.gender}</option><option value="Male">{t.male}</option><option value="Female">{t.female}</option></Select>
                            <div className="grid grid-cols-2 gap-2">
                                <Select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)} disabled={!selectedGender} className="h-11 text-sm py-2"><option value="">{t.grade}</option>{availableGrades.map(g => <option key={g} value={g}>{g}</option>)}</Select>
                                <Select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} disabled={!selectedGrade} className="h-11 text-sm py-2"><option value="">{t.section}</option>{availableSections.map(s => <option key={s} value={s}>{s}</option>)}</Select>
                            </div>
                            {(selectedGender || selectedGrade) && <button onClick={handleReset} className="w-full text-[10px] text-red-500 font-bold hover:underline py-1">{t.clearFilters}</button>}
                        </div>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin min-h-0">
                {!isCriteriaActive ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center opacity-60">
                        <Search size={40} className="mb-2" />
                        <p className="text-xs font-medium">{t.selectClassMsg}</p>
                    </div>
                ) : filteredStudents.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">{t.noStudentsFound}</div>
                ) : (
                    filteredStudents.map(s => (
                        <button 
                            key={s.id} 
                            onClick={() => setSelectedStudentId(s.id)} 
                            className={`w-full text-start p-3 rounded-xl border transition-all duration-200 group flex items-center gap-3
                                ${selectedStudentId === s.id 
                                    ? `bg-${themeColor}-50 dark:bg-${themeColor}-900/20 border-${themeColor}-200 dark:border-${themeColor}-800 ring-1 ring-${themeColor}-500/20` 
                                    : 'bg-white/60 dark:bg-slate-800/60 border-transparent hover:bg-white dark:hover:bg-slate-700'
                                }
                            `}
                        >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${selectedStudentId === s.id ? `bg-${themeColor}-100 text-${themeColor}-600` : 'bg-slate-100 text-slate-500'}`}>
                                {s.grade}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`font-bold text-sm truncate ${selectedStudentId === s.id ? `text-${themeColor}-700 dark:text-${themeColor}-300` : 'text-slate-700 dark:text-slate-200'}`}>
                                    {lang === 'en' ? s.name_en : s.name_ar}
                                </p>
                                <p className="text-xs text-slate-400 font-mono">{s.studentNumber}</p>
                            </div>
                            {selectedStudentId === s.id && <CheckCircle2 size={18} className={`text-${themeColor}-500`} />}
                        </button>
                    ))
                )}
            </div>
        </div>
      </Card>

      {/* Main Content: Action Area */}
      <Card className={`flex-1 !p-0 relative overflow-hidden transition-colors duration-500 min-h-[500px] lg:min-h-0 lg:h-full ${mode === 'LateArrival' ? 'bg-blue-50/30' : 'bg-orange-50/30'}`}>
        <div className="flex flex-col h-full relative">
            {/* Header */}
            <div className={`h-16 shrink-0 flex items-center justify-between px-6 border-b border-white/20 dark:border-white/5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${mode === 'LateArrival' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                        {mode === 'LateArrival' ? <Clock size={20} /> : <LogOut size={20} />}
                    </div>
                    <h2 className="font-bold text-lg text-slate-800 dark:text-white">
                        {mode === 'LateArrival' ? t.confirmLate : t.earlyLeave}
                    </h2>
                </div>
                {currentStudent && <Badge color={mode === 'LateArrival' ? 'blue' : 'orange'} className="text-sm font-mono">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Badge>}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 relative min-h-0">
                {!currentStudent ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 animate-in fade-in zoom-in-95">
                        <UserCheck size={64} className="opacity-20 mb-4" />
                        <p className="text-lg font-medium">{t.selectStudentMsg}</p>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 max-w-3xl mx-auto pb-10">
                        
                        {/* Student Identity Card */}
                        <div className="bg-white/60 dark:bg-slate-800/60 rounded-2xl p-6 border border-white/40 dark:border-white/10 shadow-sm backdrop-blur-md">
                            <div className="flex items-start gap-5">
                                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-400 shadow-inner shrink-0">
                                    <UserIcon size={32} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{lang === 'en' ? currentStudent.name_en : currentStudent.name_ar}</h3>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        <Badge color="gray">ID: {currentStudent.studentNumber}</Badge>
                                        <Badge color="blue">{currentStudent.grade} - {currentStudent.section}</Badge>
                                        {currentStudent.transportMode === 'Bus' && <Badge color="yellow" className="flex items-center gap-1"><Bus size={12} /> {currentStudent.busRoute}</Badge>}
                                    </div>
                                    {currentStudent.isWatchlisted && (
                                        <div className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg border border-red-100 animate-pulse">
                                            <AlertTriangle size={14} /> Targeted Student
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Action Form */}
                        {mode === 'LateArrival' ? (
                            <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl p-8 border border-blue-100 dark:border-blue-800/30 text-center">
                                <Clock size={48} className="text-blue-400 mx-auto mb-4" />
                                <p className="text-blue-800 dark:text-blue-200 font-medium text-lg">{t.confirmLateMsg}</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {currentStudent.transportMode === 'Bus' && (
                                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 flex gap-3 text-orange-800 dark:text-orange-200">
                                        <AlertTriangle size={20} className="shrink-0" />
                                        <div>
                                            <p className="font-bold text-sm">{t.transportConflict}</p>
                                            <p className="text-xs opacity-80 mt-0.5">{t.busSchedule}: {currentStudent.busRoute}</p>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase ml-1">{t.reason}</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {EARLY_LEAVE_REASONS.map(r => {
                                                const Icon = REASON_ICONS[r] || MoreHorizontal;
                                                return (
                                                    <button 
                                                        key={r} 
                                                        onClick={() => setReasonSelect(r)}
                                                        className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 text-center h-24 justify-center ${reasonSelect === r ? 'bg-orange-500 text-white border-orange-600 shadow-md transform scale-105' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-orange-300'}`}
                                                    >
                                                        <Icon size={20} />
                                                        <span className="text-xs font-bold leading-tight">{r}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                    {reasonSelect === 'Other' && (
                                        <Input placeholder={t.pleaseSpecify} value={reasonText} onChange={(e) => setReasonText(e.target.value)} autoFocus />
                                    )}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase ml-1">{t.pickupBy}</label>
                                            <Select value={pickedBy} onChange={(e) => setPickedBy(e.target.value)}>
                                                <option value="">{t.selectRelation}</option>
                                                {PICKUP_RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase ml-1">{t.pickupId}</label>
                                            <Input placeholder="Emirates ID / Phone" value={pickerId} onChange={(e) => setPickerId(e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/20 dark:border-white/5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md mt-auto shrink-0">
                <Button 
                    onClick={handleLog} 
                    disabled={!currentStudent || isLoading || (mode === 'EarlyLeave' && (!reasonSelect || !pickedBy))}
                    className={`w-full h-14 text-lg font-bold shadow-lg rounded-xl ${mode === 'LateArrival' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                >
                    {isLoading ? <span className="animate-pulse">Processing...</span> : (mode === 'LateArrival' ? t.confirmLate : t.checkOut)}
                </Button>
            </div>

            {/* Success Overlay */}
            {lastLog && (
                <div className="absolute inset-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-300">
                    <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-lg animate-bounce">
                        <CheckCircle2 size={48} />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Success!</h2>
                    <p className="text-slate-500 mt-2 font-medium">{mode === 'LateArrival' ? 'Late Arrival Logged' : 'Student Checked Out'}</p>
                </div>
            )}
        </div>
      </Card>
    </div>
  );
};