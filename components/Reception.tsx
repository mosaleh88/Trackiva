
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Badge } from './ui';
import { useStore } from '../services/store';
import { Student, Language, User } from '../types';
import { TRANSLATIONS, EARLY_LEAVE_REASONS, PICKUP_RELATIONS } from '../constants';
import { 
  Search, ArrowRight, UserCheck, LogOut, Clock, MapPin, Bus, User as UserIcon, X, Filter, AlertTriangle, CheckCircle2, Info, Users,
  Stethoscope, Home, Thermometer, FileText, Plane, MoreHorizontal 
} from 'lucide-react';
// import { sendEarlyLeaveAlert } from '../services/telegramService';

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
  const [isFilterOpen, setIsFilterOpen] = useState(true);

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
  const themeBg = mode === 'LateArrival' ? 'bg-blue-50/50 dark:bg-slate-900/50' : 'bg-orange-50/50 dark:bg-slate-900/50';

  return (
    <div className="h-[calc(100vh-9rem)] min-h-[600px] flex gap-8 overflow-hidden">
      {/* Sidebar: Student Finder */}
      <div className="w-96 flex flex-col bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl rounded-3xl shadow-glass border border-white/40 dark:border-white/10 overflow-hidden shrink-0 transition-all duration-300">
        {/* Mode Toggles */}
        <div className="p-3 grid grid-cols-2 gap-2 bg-white/30 dark:bg-slate-800/30 border-b border-white/20 dark:border-slate-700/50">
            <button onClick={() => handleModeSwitch('LateArrival')} className={`flex flex-col items-center justify-center py-4 px-2 rounded-2xl transition-all duration-300 ${mode === 'LateArrival' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-md ring-1 ring-black/5 dark:ring-white/10' : 'text-slate-500 dark:text-slate-400 hover:bg-white/40 dark:hover:bg-slate-800/40'}`}><Clock size={24} className="mb-1.5" /><span className="text-xs font-bold uppercase tracking-wide">{t.lateArrival}</span></button>
            <button onClick={() => handleModeSwitch('EarlyLeave')} className={`flex flex-col items-center justify-center py-4 px-2 rounded-2xl transition-all duration-300 ${mode === 'EarlyLeave' ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-md ring-1 ring-black/5 dark:ring-white/10' : 'text-slate-500 dark:text-slate-400 hover:bg-white/40 dark:hover:bg-slate-800/40'}`}><LogOut size={24} className="mb-1.5" /><span className="text-xs font-bold uppercase tracking-wide">{t.earlyLeave}</span></button>
        </div>
        
        <div className="p-5 space-y-4 border-b border-white/20 dark:border-slate-700/50">
            <div className="relative group">
                <Search className={`absolute top-3.5 text-slate-400 group-focus-within:text-primary transition-colors ${lang === 'ar' ? 'right-4' : 'left-4'}`} size={20} />
                <input autoFocus type="text" placeholder={t.searchPlaceholder} className={`w-full h-12 bg-white/50 dark:bg-slate-800/50 border border-white/30 dark:border-slate-600 text-slate-900 dark:text-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all font-mono text-sm shadow-inner ${lang === 'ar' ? 'pr-12 pl-4' : 'pl-12 pr-4'}`} value={searchNumber} onChange={(e) => { setSearchNumber(e.target.value); setSelectedStudentId(""); }} />
            </div>
            
            {/* Filter By Section: Now collapsible */}
            <div className="border border-white/30 dark:border-slate-700/50 rounded-2xl bg-white/30 dark:bg-slate-800/30 overflow-hidden">
                <button 
                    onClick={() => setIsFilterOpen(!isFilterOpen)} 
                    className="w-full flex justify-between items-center px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 transition-colors hover:bg-white/40 dark:hover:bg-slate-700/40"
                >
                    <div className="flex items-center gap-2">
                        <Filter size={16} /> <span>{t.filterBy}</span>
                    </div>
                    <ArrowRight size={16} className={`text-slate-400 transition-transform duration-300 ${isFilterOpen ? 'rotate-90' : 'rotate-0'}`} />
                </button>
                
                <div className={`overflow-hidden transition-all duration-300 ease-spring ${isFilterOpen ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="p-4 space-y-3 pt-0">
                        <div className="h-px w-full bg-slate-200/50 dark:bg-slate-700/50 mb-3"></div>
                        <Select value={selectedGender} onChange={(e) => { setSelectedGender(e.target.value); setSelectedGrade(""); setSelectedSection(""); }} className="bg-white/60 dark:bg-slate-800/60 text-sm py-2 h-10"><option value="">{t.gender}</option><option value="Male">{t.male}</option><option value="Female">{t.female}</option></Select>
                        <div className="grid grid-cols-2 gap-3"><Select value={selectedGrade} onChange={(e) => { setSelectedGrade(e.target.value); setSelectedSection(""); }} disabled={!selectedGender} className="bg-white/60 dark:bg-slate-800/60 text-sm py-2 h-10"><option value="">{t.grade}</option>{availableGrades.map(g => <option key={g} value={g}>{g}</option>)}</Select><Select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} disabled={!selectedGrade} className="bg-white/60 dark:bg-slate-800/60 text-sm py-2 h-10"><option value="">{t.section}</option>{availableSections.map(s => <option key={s} value={s}>{s}</option>)}</Select></div>
                        {(selectedGender || selectedGrade || selectedSection) && <button onClick={handleReset} className="w-full text-xs font-bold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 py-2 rounded-lg mt-1 transition-colors">{t.clearFilters}</button>}
                    </div>
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/30 dark:bg-slate-900/30 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
             {!isCriteriaActive ? <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center"><Search size={64} className="opacity-20 mb-4" /><p className="text-sm font-medium">{t.selectClassMsg}</p></div> : filteredStudents.length === 0 ? <div className="p-8 text-center text-slate-400"><p>{t.noStudentsFound}</p></div> : filteredStudents.map(s => (<button key={s.id} onClick={() => setSelectedStudentId(s.id)} className={`w-full text-start p-4 rounded-2xl border transition-all duration-200 group ${selectedStudentId === s.id ? `bg-white dark:bg-slate-700 border-${themeColor}-500 ring-2 ring-${themeColor}-500/30 shadow-lg z-10 scale-[1.02]` : 'bg-white/80 dark:bg-slate-800/80 border-transparent hover:border-slate-200 dark:hover:border-slate-600 shadow-sm hover:shadow-md'}`}><div className="flex justify-between items-start"><div><p className={`font-bold text-sm ${selectedStudentId === s.id ? `text-${themeColor}-700 dark:text-${themeColor}-400` : 'text-slate-700 dark:text-slate-200'}`}>{lang === 'en' ? s.name_en : s.name_ar}</p><p className="text-xs text-slate-400 font-mono mt-0.5">{s.studentNumber}</p></div><Badge color="gray" className="text-[10px] px-2">{s.grade}-{s.section}</Badge></div></button>))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 rounded-[2.5rem] shadow-glass border border-white/40 dark:border-white/10 flex flex-col overflow-hidden ${themeBg} backdrop-blur-xl transition-colors duration-500`}>
        {/* Header */}
        <div className="h-20 shrink-0 border-b border-white/20 dark:border-slate-700/50 flex items-center justify-between px-8 bg-white/40 dark:bg-slate-800/40 backdrop-blur-md">
            <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] ${mode === 'LateArrival' ? 'bg-blue-500 text-blue-500' : 'bg-orange-500 text-orange-500'}`}></div>
                <span className="font-bold text-lg text-slate-700 dark:text-slate-200 uppercase tracking-widest">{mode === 'LateArrival' ? t.lateArrival : t.earlyLeave}</span>
            </div>
            {currentStudent && <Badge color={mode === 'LateArrival' ? 'blue' : 'yellow'} className="shadow-sm text-lg px-4 py-1.5">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Badge>}
        </div>

        {!currentStudent ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 animate-in fade-in zoom-in-95 duration-500">
                <div className="w-40 h-40 rounded-full bg-white/50 dark:bg-slate-800/50 flex items-center justify-center mb-6 shadow-inner border border-white/20 dark:border-white/5">
                    <UserCheck size={80} className="opacity-30" />
                </div>
                <h2 className="text-3xl font-bold text-slate-600 dark:text-slate-300 mb-2">{t.readyToProcess}</h2>
                <p className="text-lg opacity-70 font-medium">{t.selectStudentMsg}</p>
            </div>
        ) : (
            <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-right-8 duration-300 relative">
                {/* Overlay for Last Log Success */}
                {lastLog && (
                    <div className="absolute inset-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center animate-in zoom-in fade-in duration-300">
                        <div className="bg-green-100 dark:bg-green-900/30 p-6 rounded-full mb-6 shadow-xl border-4 border-white dark:border-slate-800">
                            <CheckCircle2 size={80} className="text-green-600 dark:text-green-400" />
                        </div>
                        <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">{mode === 'LateArrival' ? t.confirmLate : t.earlyLeave} Logged!</h2>
                        <p className="text-slate-500 dark:text-slate-400 font-mono text-lg">{new Date(lastLog.timestamp).toLocaleTimeString()}</p>
                    </div>
                )}

                {/* Student Info Card */}
                <div className="p-8 pb-6 shrink-0">
                    <div className="bg-white/60 dark:bg-slate-800/60 rounded-[2rem] p-6 border border-white/40 dark:border-white/10 shadow-sm flex items-start gap-6 backdrop-blur-md">
                        <div className="w-24 h-24 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 shadow-inner border-2 border-white dark:border-slate-600">
                            <UserIcon size={48} />
                        </div>
                        <div className="flex-1 pt-1">
                            <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-1">{lang === 'en' ? currentStudent.name_en : currentStudent.name_ar}</h2>
                            <div className="flex flex-wrap gap-2 mb-3">
                                <Badge color="gray" className="text-sm px-3 py-1">ID: {currentStudent.studentNumber}</Badge>
                                <Badge color="blue" className="text-sm px-3 py-1">{currentStudent.grade} - {currentStudent.section}</Badge>
                                <Badge color="gray" className="text-sm px-3 py-1">{currentStudent.gender}</Badge>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-700/50 px-3 py-1.5 rounded-lg border border-white/20 dark:border-white/5">
                                    <Bus size={16} className={currentStudent.transportMode === 'Bus' ? 'text-yellow-500' : 'text-slate-400'} />
                                    <span>{currentStudent.transportMode} {currentStudent.busRoute ? `(${currentStudent.busRoute})` : ''}</span>
                                </div>
                                {currentStudent.isWatchlisted && (
                                    <div className="flex items-center gap-2 text-sm font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg border border-red-100 dark:border-red-900/50 animate-pulse">
                                        <AlertTriangle size={16} /> Targeted Student
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Siblings Alert */}
                    {siblings.length > 0 && (
                        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                            {siblings.map(sib => (
                                <div key={sib.id} className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 rounded-xl border border-indigo-100 dark:border-indigo-800/50 shrink-0">
                                    <Users size={14} className="text-indigo-500" />
                                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{lang === 'en' ? sib.name_en : sib.name_ar}</span>
                                    <span className="text-[10px] text-indigo-400">({sib.grade}-{sib.section})</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Content Body */}
                <div className="flex-1 px-8 pb-8 overflow-y-auto">
                    {mode === 'LateArrival' ? (
                        <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-[2rem] p-8 border border-blue-100 dark:border-blue-800/30 flex flex-col items-center justify-center h-full text-center space-y-4">
                            <Clock size={64} className="text-blue-400 dark:text-blue-500 opacity-80 mb-2" />
                            <h3 className="text-2xl font-bold text-blue-900 dark:text-blue-100">{t.confirmLate}</h3>
                            <p className="text-blue-700 dark:text-blue-300 max-w-md">{t.confirmLateMsg}</p>
                        </div>
                    ) : (
                        <div className="space-y-6 h-full flex flex-col">
                            {/* Transport Conflict Alert */}
                            {currentStudent.transportMode === 'Bus' && (
                                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-2xl p-4 flex items-start gap-3 animate-in slide-in-from-top-2">
                                    <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={20} />
                                    <div>
                                        <h4 className="font-bold text-orange-800 dark:text-orange-200 text-sm">{t.transportConflict}</h4>
                                        <p className="text-xs text-orange-600 dark:text-orange-300 mt-1">{t.busSchedule}: {currentStudent.busRoute || 'Assigned'}</p>
                                    </div>
                                </div>
                            )}

                            <div className="bg-white/60 dark:bg-slate-800/60 rounded-[2rem] p-6 border border-white/40 dark:border-white/10 shadow-sm space-y-6 flex-1 backdrop-blur-md">
                                <div>
                                    <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide ml-1">{t.reason}</label>
                                    <div className="grid grid-cols-3 gap-3 mb-3">
                                        {EARLY_LEAVE_REASONS.map(r => {
                                            const Icon = REASON_ICONS[r] || MoreHorizontal;
                                            const isSelected = reasonSelect === r;
                                            return (
                                                <button 
                                                    key={r} 
                                                    onClick={() => setReasonSelect(r)} 
                                                    className={`
                                                        flex flex-col items-center justify-center p-3 h-24 rounded-xl transition-all duration-200 border
                                                        ${isSelected 
                                                            ? 'bg-orange-500 text-white shadow-lg scale-105 border-orange-600 font-bold' 
                                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 border-slate-200 dark:border-slate-700 shadow-sm'
                                                        }
                                                    `}
                                                >
                                                    <Icon size={24} className={`mb-2 ${isSelected ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                                                    <span className="text-[10px] sm:text-xs text-center leading-tight font-medium">{r}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                    {reasonSelect === 'Other' && (
                                        <Input placeholder={t.pleaseSpecify} value={reasonText} onChange={(e) => setReasonText(e.target.value)} autoFocus className="bg-white dark:bg-slate-900" />
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide ml-1">{t.pickupBy}</label>
                                        <Select value={pickedBy} onChange={(e) => setPickedBy(e.target.value)} className="bg-white dark:bg-slate-900">
                                            <option value="">{t.selectRelation}</option>
                                            {PICKUP_RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide ml-1">{t.pickupId}</label>
                                        <Input placeholder="ID Number / Emirates ID" value={pickerId} onChange={(e) => setPickerId(e.target.value)} className="bg-white dark:bg-slate-900" />
                                    </div>
                                </div>

                                <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl flex items-center gap-3 border border-blue-100 dark:border-blue-800/30">
                                    <Info size={20} className="text-blue-500 shrink-0" />
                                    <p className="text-xs text-blue-700 dark:text-blue-300 font-medium leading-relaxed">{t.autoAttendance}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-8 pt-0 mt-auto">
                    <Button 
                        onClick={handleLog} 
                        disabled={isLoading || (mode === 'EarlyLeave' && (!reasonSelect || !pickedBy))} 
                        className={`w-full h-16 text-lg font-bold shadow-xl rounded-2xl transition-all hover:scale-[1.02] active:scale-95 ${mode === 'LateArrival' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/30' : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-orange-500/30'}`}
                    >
                        {isLoading ? 'Processing...' : mode === 'LateArrival' ? t.confirmLate : t.checkOut}
                    </Button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
