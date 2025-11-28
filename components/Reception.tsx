
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Badge } from './ui';
import { useStore } from '../services/store';
import { Student, Language, User } from '../types';
import { TRANSLATIONS, EARLY_LEAVE_REASONS, PICKUP_RELATIONS } from '../constants';
import { Search, ArrowRight, UserCheck, LogOut, Clock, MapPin, Bus, User as UserIcon, X, Filter, AlertTriangle, CheckCircle2, Info, Users } from 'lucide-react';
import QRCode from 'qrcode';
import { sendEarlyLeaveAlert } from '../services/telegramService';

interface ReceptionProps {
  lang: Language;
  currentUser: User | null;
}

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
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [siblings, setSiblings] = useState<Student[]>([]);

  // Form States
  const [reasonSelect, setReasonSelect] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [pickedBy, setPickedBy] = useState("");
  const [pickerId, setPickerId] = useState("");

  const students = useMemo(() => currentUser ? store.getStudentsForUser(currentUser.id) : store.getStudents(), [currentUser, store.getStudents()]);

  useEffect(() => {
    if (selectedStudentId) {
        const student = students.find(s => s.id === selectedStudentId);
        if (student) {
            const dataToEncode = JSON.stringify({ id: student.id, no: student.studentNumber });
            QRCode.toDataURL(dataToEncode, { width: 100, margin: 0 }).then(url => setQrDataUrl(url)).catch(err => console.error(err));
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
            sendEarlyLeaveAlert(currentStudent, finalReason, pickedBy, pickerId);
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
  const themeBg = mode === 'LateArrival' ? 'bg-blue-50 dark:bg-slate-900' : 'bg-orange-50 dark:bg-slate-900';

  return (
    <div className="h-[calc(100vh-9rem)] min-h-[600px] flex gap-6 overflow-hidden">
      <div className="w-96 flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
        <div className="p-2 grid grid-cols-2 gap-1 bg-slate-100/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
            <button onClick={() => handleModeSwitch('LateArrival')} className={`flex flex-col items-center justify-center py-3 px-2 rounded-xl transition-all duration-200 ${mode === 'LateArrival' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800'}`}><Clock size={20} className="mb-1" /><span className="text-xs font-bold uppercase">{t.lateArrival}</span></button>
            <button onClick={() => handleModeSwitch('EarlyLeave')} className={`flex flex-col items-center justify-center py-3 px-2 rounded-xl transition-all duration-200 ${mode === 'EarlyLeave' ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800'}`}><LogOut size={20} className="mb-1" /><span className="text-xs font-bold uppercase">{t.earlyLeave}</span></button>
        </div>
        <div className="p-4 space-y-3 border-b border-slate-100 dark:border-slate-700">
            <div className="relative group"><Search className={`absolute top-3 text-slate-400 group-focus-within:text-primary transition-colors ${lang === 'ar' ? 'right-3' : 'left-3'}`} size={18} /><input autoFocus type="text" placeholder={t.searchPlaceholder} className={`w-full py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono text-sm ${lang === 'ar' ? 'pr-10 pl-4' : 'pl-10 pr-4'}`} value={searchNumber} onChange={(e) => { setSearchNumber(e.target.value); setSelectedStudentId(""); }} /></div>
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300"><Filter size={16} /> <span>{t.filterBy}</span></div>
                <div className="p-3 space-y-2">
                    <Select value={selectedGender} onChange={(e) => { setSelectedGender(e.target.value); setSelectedGrade(""); setSelectedSection(""); }} className="bg-white dark:bg-slate-800 text-sm py-1.5"><option value="">{t.gender}</option><option value="Male">{t.male}</option><option value="Female">{t.female}</option></Select>
                    <div className="grid grid-cols-2 gap-2"><Select value={selectedGrade} onChange={(e) => { setSelectedGrade(e.target.value); setSelectedSection(""); }} disabled={!selectedGender} className="bg-white dark:bg-slate-800 text-sm py-1.5"><option value="">{t.grade}</option>{availableGrades.map(g => <option key={g} value={g}>{g}</option>)}</Select><Select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} disabled={!selectedGrade} className="bg-white dark:bg-slate-800 text-sm py-1.5"><option value="">{t.section}</option>{availableSections.map(s => <option key={s} value={s}>{s}</option>)}</Select></div>
                    {(selectedGender || selectedGrade || selectedSection) && <button onClick={handleReset} className="w-full text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 py-1 rounded mt-1">{t.clearFilters}</button>}
                </div>
            </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/50 dark:bg-slate-900/50">
             {!isCriteriaActive ? <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center"><Search size={48} className="opacity-20 mb-4" /><p className="text-sm">{t.selectClassMsg}</p></div> : filteredStudents.length === 0 ? <div className="p-8 text-center text-slate-400"><p>{t.noStudentsFound}</p></div> : filteredStudents.map(s => (<button key={s.id} onClick={() => setSelectedStudentId(s.id)} className={`w-full text-start p-3 rounded-xl border transition-all group ${selectedStudentId === s.id ? `bg-white dark:bg-slate-700 border-${themeColor}-500 ring-1 ring-${themeColor}-500 shadow-md z-10` : 'bg-white dark:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-600 shadow-sm'}`}><div className="flex justify-between items-start"><div><p className={`font-bold text-sm ${selectedStudentId === s.id ? `text-${themeColor}-700 dark:text-${themeColor}-400` : 'text-slate-700 dark:text-slate-200'}`}>{lang === 'en' ? s.name_en : s.name_ar}</p><p className="text-xs text-slate-400 font-mono">{s.studentNumber}</p></div><Badge color="gray" className="text-[10px]">{s.grade}-{s.section}</Badge></div></button>))}
        </div>
      </div>
      <div className={`flex-1 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden ${themeBg}`}>
        <div className="h-14 shrink-0 border-b border-white/50 dark:border-slate-700 flex items-center justify-between px-6 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm"><div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${mode === 'LateArrival' ? 'bg-blue-500' : 'bg-orange-500'}`}></div><span className="font-bold text-sm text-slate-600 dark:text-slate-300 uppercase tracking-wider">{mode === 'LateArrival' ? t.lateArrival : t.earlyLeave}</span></div>{currentStudent && <Badge color={mode === 'LateArrival' ? 'blue' : 'yellow'} className="shadow-sm">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Badge>}</div>
        {!currentStudent ? <div className="flex-1 flex flex-col items-center justify-center text-slate-400"><div className="w-32 h-32 rounded-full bg-white/80 dark:bg-slate-800/80 flex items-center justify-center mb-4 shadow-sm"><UserCheck size={64} className="opacity-20" /></div><h2 className="text-xl font-bold text-slate-500 dark:text-slate-400">{t.readyToProcess}</h2><p className="text-sm opacity-70">{t.selectStudentMsg}</p></div> : (
            <div className="flex-1 flex flex-col min-h-0">
                <div className="p-6 pb-2 shrink-0"><div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden relative border-t-[10px]" style={{ borderTopColor: '#458489' }}><div className="px-6 pb-6 flex gap-6 relative pt-6"><div className="flex-1"><h2 className="text-2xl font-bold text-slate-800 dark:text-white">{lang === 'en' ? currentStudent.name_en : currentStudent.name_ar}</h2><div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium"><span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">{currentStudent.grade} - {currentStudent.section}</span><span className="font-mono">#{currentStudent.studentNumber}</span></div><div className="mt-4 grid grid-cols-2 gap-4"><div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">{currentStudent.transportMode === 'Bus' ? <Bus size={16} /> : <MapPin size={16} />}<span>{currentStudent.transportMode} {currentStudent.busRoute ? `(${currentStudent.busRoute})` : ''}</span></div></div></div></div></div></div>
                {siblings.length > 0 && <div className="px-6 pb-2 shrink-0"><div className="bg-blue-50/80 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-3 animate-in slide-in-from-top-2"><div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-xs font-bold uppercase mb-2"><Users size={14} /> {t.siblings}</div><div className="flex flex-wrap gap-2">{siblings.map(sib => (<button key={sib.id} onClick={() => setSelectedStudentId(sib.id)} className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-blue-200 dark:border-slate-700 px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-700 hover:border-blue-300 dark:hover:border-slate-600 transition-all text-sm shadow-sm group"><span className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-700 dark:group-hover:text-blue-400">{lang === 'en' ? sib.name_en : sib.name_ar}</span><Badge color="gray" className="text-[10px]">{sib.grade}-{sib.section}</Badge></button>))}</div></div></div>}
                <div className="flex-1 overflow-y-auto px-6 py-2">{mode === 'LateArrival' ? <div className="h-full flex flex-col justify-center items-center text-center space-y-4 bg-white/50 dark:bg-slate-800/50 rounded-xl border border-white dark:border-slate-700 shadow-sm p-8"><div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center animate-pulse"><Clock size={32} /></div><div><h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">{t.confirmLate}</h3><p className="text-slate-500 dark:text-slate-400 text-sm mt-1 max-w-xs">{t.confirmLateMsg}</p></div></div> : <div className="space-y-4 pb-4"><Card className="border-0 shadow-sm bg-white/80 dark:bg-slate-800/80"><h4 className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2"><AlertTriangle size={16} className="text-orange-500" /> {t.reason}</h4><Select value={reasonSelect} onChange={(e) => setReasonSelect(e.target.value)} className="mb-2"><option value="">{t.selectReason}</option>{EARLY_LEAVE_REASONS.map((r: string) => <option key={r} value={r}>{r}</option>)}</Select>{reasonSelect === 'Other' && <Input placeholder={t.pleaseSpecify} value={reasonText} onChange={(e) => setReasonText(e.target.value)} autoFocus />}</Card><Card className="border-0 shadow-sm bg-white/80 dark:bg-slate-800/80"><h4 className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2"><UserCheck size={16} className="text-slate-500 dark:text-slate-400" /> {t.guardianPickup}</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">{t.pickupBy}</label><Select value={pickedBy} onChange={(e) => setPickedBy(e.target.value)}><option value="">{t.selectRelation}</option>{PICKUP_RELATIONS.map((r: string) => <option key={r} value={r}>{r}</option>)}</Select></div><div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">{t.pickupId}</label><Input placeholder="Emirates ID / National ID" value={pickerId} onChange={(e) => setPickerId(e.target.value)} /></div></div></Card><div className="flex items-start gap-3 p-4 rounded-lg bg-orange-100/50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300 text-xs"><Info size={16} className="shrink-0 mt-0.5" /><p>{t.autoAttendance}</p></div></div>}</div>
                <div className="shrink-0 p-6 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center z-20"><Button variant="ghost" onClick={() => setSelectedStudentId("")} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">{t.cancel}</Button><Button onClick={handleLog} disabled={(mode === 'EarlyLeave' && (!reasonSelect || !pickedBy || !pickerId)) || isLoading} className={`px-8 py-3 text-lg shadow-xl transition-transform active:scale-95 ${mode === 'LateArrival' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200 dark:shadow-none' : 'bg-orange-600 hover:bg-orange-700 shadow-orange-200 dark:shadow-none'}`}><span className="mx-2">{isLoading ? 'Processing...' : t.submit}</span> {lang === 'ar' ? <ArrowRight size={20} className="rotate-180" /> : <ArrowRight size={20} />}</Button></div>
            </div>
        )}
      </div>
      {lastLog && <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl border-2 animate-in fade-in slide-in-from-bottom-8 ${lastLog.transportConflict ? 'bg-red-50 dark:bg-red-900 border-red-100 dark:border-red-800 text-red-900 dark:text-red-100' : 'bg-white dark:bg-slate-800 border-white dark:border-slate-700 text-slate-800 dark:text-white'}`}><div className={`w-10 h-10 rounded-full flex items-center justify-center ${lastLog.transportConflict ? 'bg-red-200 text-red-700' : 'bg-green-100 text-green-600'}`}>{lastLog.transportConflict ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}</div><div><h3 className="font-bold text-lg">{lastLog.type === 'LateArrival' ? t.lateArrival : t.earlyLeave}</h3>{lastLog.transportConflict && <p className="text-sm text-red-600 dark:text-red-300 font-bold">{t.transportConflict}</p>}</div></div>}
    </div>
  );
};
