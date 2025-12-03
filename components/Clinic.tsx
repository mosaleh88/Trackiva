import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Badge, Pagination } from './ui';
import { useStore } from '../services/store';
import { Language, ClinicVisit, Student, EPass, User } from '../types';
import { TRANSLATIONS, CLINIC_SYMPTOMS } from '../constants';
import { Stethoscope, Activity, AlertTriangle, Search, User as UserIcon, ArrowRight, Siren, FileText, Coffee, Plus, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts/lib';

interface ClinicProps {
  lang: Language;
  currentUser: User | null;
}

const HISTORY_ITEMS_PER_PAGE = 10;

export const Clinic: React.FC<ClinicProps> = ({ lang, currentUser }) => {
  const t = TRANSLATIONS[lang];
  const store = useStore();
  const [activeTab, setActiveTab] = useState<'queue' | 'history' | 'analytics' | 'report'>('queue');
  const [isLoading, setIsLoading] = useState(false);
  
  // Form & Filter States
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [searchStudent, setSearchStudent] = useState("");
  const [linkedPassId, setLinkedPassId] = useState("");
  const [formData, setFormData] = useState<Partial<ClinicVisit>>({ symptom: '', severity: 'Low', outcome: 'ReturnToClass' });
  const [walkInGender, setWalkInGender] = useState("");
  const [walkInGrade, setWalkInGrade] = useState("");
  const [walkInSection, setWalkInSection] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [reportStudent, setReportStudent] = useState<Student | null>(null);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  // Pagination
  const [historyPage, setHistoryPage] = useState(1);

  // Reactive Data
  const visits = store.getClinicVisits();
  const students = useMemo(() => currentUser ? store.getStudentsForUser(currentUser.id) : store.getStudents(), [currentUser, store.getStudents()]);
  const activePasses = store.getEPasses().filter(p => p.status === 'Active' && p.type === 'Clinic');

  // --- Computed Data ---
  const incomingStudents = useMemo(() => {
      // Filter out passes that are already linked to a recorded visit (student admitted)
      const linkedPassIds = new Set(visits.map(v => v.linkedPassId).filter(Boolean));
      
      return activePasses
          .filter(p => !linkedPassIds.has(p.id))
          .map(p => ({ pass: p, student: students.find(s => s.id === p.studentId) }))
          .filter(i => i.student);
  }, [activePasses, students, visits]);

  const todayVisits = useMemo(() => visits.filter(v => new Date(v.timestamp).toDateString() === new Date().toDateString()), [visits]);
  const epidemicAlert = useMemo(() => {
      const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
      const recent = visits.filter(v => v.timestamp > threeDaysAgo);
      const counts: Record<string, number> = {};
      recent.forEach(v => counts[v.symptom] = (counts[v.symptom] || 0) + 1);
      return Object.entries(counts).filter(([sym, count]) => count >= 3);
  }, [visits]);

  // History Pagination Logic
  const paginatedVisits = useMemo(() => {
      // Sort visits by timestamp desc
      const sortedVisits = [...visits].sort((a,b) => b.timestamp - a.timestamp);
      const start = (historyPage - 1) * HISTORY_ITEMS_PER_PAGE;
      return sortedVisits.slice(start, start + HISTORY_ITEMS_PER_PAGE);
  }, [visits, historyPage]);

  const totalHistoryPages = Math.ceil(visits.length / HISTORY_ITEMS_PER_PAGE);

  // --- Filter Logic ---
  const walkInAvailableGrades = useMemo(() => { if (!walkInGender) return []; return Array.from(new Set(students.filter(s => s.gender === walkInGender).map(s => s.grade))).sort(); }, [students, walkInGender]);
  const walkInAvailableSections = useMemo(() => { if (!walkInGender || !walkInGrade) return []; return Array.from(new Set(students.filter(s => s.gender === walkInGender && s.grade === walkInGrade).map(s => s.section))).sort(); }, [students, walkInGender, walkInGrade]);
  const filteredWalkInStudents = useMemo(() => {
      let res = students;
      if (searchStudent) { const lower = searchStudent.toLowerCase(); res = res.filter(s => s.name_en.toLowerCase().includes(lower) || s.name_ar.includes(lower) || s.studentNumber.includes(lower)); }
      if (walkInGender) res = res.filter(s => s.gender === walkInGender);
      if (walkInGrade) res = res.filter(s => s.grade === walkInGrade);
      if (walkInSection) res = res.filter(s => s.section === walkInSection);
      if (!searchStudent && (!walkInGender || !walkInGrade || !walkInSection)) return [];
      return res;
  }, [students, searchStudent, walkInGender, walkInGrade, walkInSection]);

  const reportSearchResults = useMemo(() => { if (!reportSearch) return []; const lower = reportSearch.toLowerCase(); return students.filter(s => s.name_en.toLowerCase().includes(lower) || s.name_ar.includes(lower) || s.studentNumber.includes(lower)).slice(0, 5); }, [students, reportSearch]);
  const reportVisits = useMemo(() => { if (!reportStudent) return []; return visits.filter(v => v.studentId === reportStudent.id).sort((a,b) => b.timestamp - a.timestamp); }, [visits, reportStudent]);

  // --- Handlers ---
  const handleAdmitFromQueue = (studentId: string, passId: string) => { setSelectedStudentId(studentId); setLinkedPassId(passId); };
  const handleSubmitVisit = async () => {
      if (!selectedStudentId || !formData.symptom) return;
      setIsLoading(true);
      try {
          await store.addClinicVisit({
              studentId: selectedStudentId,
              symptom: formData.symptom!,
              severity: formData.severity as any,
              outcome: formData.outcome as any,
              diagnosis: formData.diagnosis,
              treatment: formData.treatment,
              notes: formData.notes,
              linkedPassId: linkedPassId || undefined
          });
          alert(t.visitLogged);
          setSelectedStudentId(""); setLinkedPassId(""); setFormData({ symptom: '', severity: 'Low', outcome: 'ReturnToClass' }); setEmergencyMode(false);
      } catch (e) { console.error(e); alert("Error saving visit"); } finally { setIsLoading(false); }
  };
  const handleConfirmEmergency = () => { setEmergencyMode(true); setShowEmergencyModal(false); };

  // --- Chart Data ---
  const symptomData = useMemo(() => { const c: Record<string, number> = {}; visits.forEach(v => c[v.symptom] = (c[v.symptom] || 0) + 1); return Object.entries(c).map(([name, value]) => ({ name, value })); }, [visits]);
  const gradeData = useMemo(() => { const c: Record<string, number> = {}; visits.forEach(v => { const s = students.find(stu => stu.id === v.studentId); if (s) c[s.grade] = (c[s.grade] || 0) + 1; }); return Object.entries(c).map(([name, value]) => ({ name, value })).sort((a,b) => a.name.localeCompare(b.name)); }, [visits, students]);
  const sectionData = useMemo(() => { const c: Record<string, number> = {}; visits.forEach(v => { const s = students.find(stu => stu.id === v.studentId); if (s) { const k = `${s.grade}-${s.section}`; c[k] = (c[k] || 0) + 1; } }); return Object.entries(c).map(([name, value]) => ({ name, value })).sort((a,b) => a.name.localeCompare(b.name)); }, [visits, students]);
  const genderData = useMemo(() => { const c: Record<string, number> = {}; visits.forEach(v => { const s = students.find(stu => stu.id === v.studentId); if (s) c[s.gender] = (c[s.gender] || 0) + 1; }); return Object.entries(c).map(([name, value]) => ({ name, value })); }, [visits, students]);

  const renderVisitForm = () => {
      const student = students.find(s => s.id === selectedStudentId);
      if (!student) return null;
      return (
          <Card className={`border-2 ${emergencyMode ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
              <div className="flex justify-between items-start mb-4">
                  <div><h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white"><UserIcon size={20} /> {lang === 'en' ? student.name_en : student.name_ar}</h3><p className="text-sm text-slate-500 dark:text-slate-400">ID: {student.studentNumber} | {student.grade}-{student.section}</p></div>
                  <Button variant="ghost" onClick={() => setSelectedStudentId("")}>{t.cancel}</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.symptom} *</label><Select value={formData.symptom} onChange={(e) => setFormData({...formData, symptom: e.target.value})}><option value="">Select...</option>{CLINIC_SYMPTOMS.map((s: string) => <option key={s} value={s}>{s}</option>)}</Select></div>
                  <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.severity} *</label><Select value={formData.severity} onChange={(e) => setFormData({...formData, severity: e.target.value as any})} className={formData.severity === 'Emergency' ? 'text-red-600 font-bold' : ''}><option value="Low">{t.low}</option><option value="Medium">{t.medium}</option><option value="High">{t.high}</option><option value="Emergency">{t.emergency}</option></Select></div>
                  <div className="col-span-2"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.diagnosis}</label><Input value={formData.diagnosis || ''} onChange={(e) => setFormData({...formData, diagnosis: e.target.value})} placeholder="Initial observation..." /></div>
                  <div className="col-span-2"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.treatment}</label><Input value={formData.treatment || ''} onChange={(e) => setFormData({...formData, treatment: e.target.value})} placeholder="Medicine given, ice pack, etc." /></div>
                  <div className="col-span-2"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.notes}</label><Input value={formData.notes || ''} onChange={(e) => setFormData({...formData, notes: e.target.value})} placeholder="Additional private notes..." /></div>
                  <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.outcome} *</label><Select value={formData.outcome} onChange={(e) => setFormData({...formData, outcome: e.target.value as any})}><option value="ReturnToClass">{t.returnToClass}</option><option value="SentHome">{t.sentHomeAction}</option></Select></div>
              </div>
              <div className="flex justify-end gap-2"><Button disabled={isLoading} onClick={handleSubmitVisit} className={formData.severity === 'Emergency' ? 'bg-red-600 hover:bg-red-700' : ''}>{t.logVisit}</Button></div>
          </Card>
      );
  };

  const renderReportTab = () => (
    <div className="space-y-6">
        <Card>
            <div className="relative max-w-xl mx-auto z-20">
                <Search className={`absolute top-3 text-slate-400 ${lang === 'ar' ? 'right-3' : 'left-3'}`} size={20} />
                <Input placeholder={t.searchReportPlaceholder} value={reportSearch} onChange={(e) => { setReportSearch(e.target.value); setReportStudent(null); }} className={`${lang === 'ar' ? 'pr-10' : 'pl-10'} py-3 text-lg`} />
                {reportSearch && !reportStudent && (
                    <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-b-xl shadow-lg mt-1">
                        {reportSearchResults.map(s => (
                            <button key={s.id} onClick={() => { setReportStudent(s); setReportSearch(lang === 'en' ? s.name_en : s.name_ar); }} className="w-full text-left text-start px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-50 dark:border-slate-700 last:border-0">
                                <p className="font-bold text-slate-700 dark:text-slate-200">{lang === 'en' ? s.name_en : s.name_ar}</p><p className="text-xs text-slate-500 dark:text-slate-400">{s.studentNumber} - {s.grade}-{s.section}</p>
                            </button>
                        ))}
                        {reportSearchResults.length === 0 && <div className="p-4 text-center text-slate-400">No matches found</div>}
                    </div>
                )}
            </div>
        </Card>
        {reportStudent ? (
             <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <Card className="md:col-span-2 flex items-center gap-6">
                         <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-300"><UserIcon size={40} /></div>
                         <div><h2 className="text-2xl font-bold text-slate-800 dark:text-white">{lang === 'en' ? reportStudent.name_en : reportStudent.name_ar}</h2><div className="flex gap-2 mt-1"><Badge color="gray">#{reportStudent.studentNumber}</Badge><Badge color="blue">{reportStudent.grade}-{reportStudent.section}</Badge><Badge color="gray">{reportStudent.gender}</Badge></div></div>
                     </Card>
                     <Card className="flex flex-col justify-center items-center text-center bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800"><p className="text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-wider">{t.totalVisits}</p><h3 className="text-5xl font-bold text-blue-600 dark:text-blue-400 mt-2">{reportVisits.length}</h3></Card>
                 </div>
                 <Card>
                     <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">{t.medicalHistory}</h3>
                     {reportVisits.length === 0 ? <div className="text-center py-8 text-slate-400">{t.noVisitsFound}</div> : (
                         <div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead><tr className="border-b border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm bg-slate-50 dark:bg-slate-800"><th className="p-3 rounded-tl-lg text-start">{t.date}</th><th className="p-3 text-start">{t.symptom}</th><th className="p-3 text-start">{t.diagnosis}</th><th className="p-3 text-start">{t.treatment}</th><th className="p-3 text-start">{t.severity}</th><th className="p-3 rounded-tr-lg text-start">{t.outcome}</th></tr></thead><tbody className="divide-y divide-slate-50 dark:divide-slate-700">{reportVisits.map(v => (<tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800"><td className="p-3 text-sm text-start text-slate-700 dark:text-slate-300"><div className="font-bold">{new Date(v.timestamp).toLocaleDateString()}</div><div className="text-xs text-slate-400">{new Date(v.timestamp).toLocaleTimeString()}</div></td><td className="p-3 font-medium text-start text-slate-700 dark:text-slate-300">{v.symptom}</td><td className="p-3 text-sm text-slate-600 dark:text-slate-400 text-start">{v.diagnosis || '-'}</td><td className="p-3 text-sm text-slate-600 dark:text-slate-400 text-start">{v.treatment || '-'}</td><td className="p-3 text-start"><Badge color={v.severity === 'Emergency' ? 'red' : v.severity === 'High' ? 'orange' : 'blue'}>{v.severity}</Badge></td><td className="p-3 text-sm text-start text-slate-700 dark:text-slate-300">{v.outcome}</td></tr>))}</tbody></table></div>
                     )}
                 </Card>
             </div>
        ) : <div className="text-center py-12 opacity-50"><FileText size={64} className="mx-auto mb-4 text-slate-300" /><p className="text-lg font-medium text-slate-500">{t.selectStudentForReport}</p></div>}
    </div>
  );

  return (
      <div className="space-y-6 relative">
          {showEmergencyModal && (
              <div className="fixed inset-0 bg-red-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-200 border border-red-500">
                      <div className="bg-red-600 p-6 flex flex-col items-center text-white text-center"><div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4 animate-pulse"><Siren size={40} className="text-white" /></div><h2 className="text-2xl font-bold">{t.emergencyAlert}</h2></div>
                      <div className="p-6 space-y-4"><p className="text-slate-600 dark:text-slate-300 text-center font-medium">{t.emergencyConfirm}</p><p className="text-slate-500 dark:text-slate-400 text-sm text-center bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">{t.emergencyConfirmDesc}</p><div className="flex gap-3 mt-4"><button onClick={() => setShowEmergencyModal(false)} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">{t.cancel}</button><button onClick={handleConfirmEmergency} className="flex-1 py-3 rounded-xl bg-red-600 font-bold text-white hover:bg-red-700 shadow-lg shadow-red-200/50 transition-colors">{t.confirmAction}</button></div></div>
                  </div>
              </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="flex items-center gap-4 min-w-0"><div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full"><Stethoscope size={24} /></div><div><p className="text-sm text-slate-500 dark:text-slate-400">{t.todayVisits}</p><h3 className="text-2xl font-bold text-slate-800 dark:text-white">{todayVisits.length}</h3></div></Card>
              <Card className="flex items-center gap-4 min-w-0"><div className="p-3 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full"><Activity size={24} /></div><div><p className="text-sm text-slate-500 dark:text-slate-400">{t.incomingPatients}</p><h3 className="text-2xl font-bold text-slate-800 dark:text-white">{incomingStudents.length}</h3></div></Card>
              <Card className="flex items-center gap-4 min-w-0"><div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full"><Siren size={24} /></div><div><p className="text-sm text-slate-500 dark:text-slate-400">{t.sentHome}</p><h3 className="text-2xl font-bold text-slate-800 dark:text-white">{todayVisits.filter(v => v.outcome === 'SentHome').length}</h3></div></Card>
              <button onClick={() => setShowEmergencyModal(true)} className="flex flex-col items-center justify-center bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200/50 group min-w-0"><AlertTriangle size={24} className="mb-1 group-hover:scale-110 transition-transform" /><span className="font-bold uppercase text-xs tracking-wider">{t.emergencyAlert}</span></button>
          </div>
          {epidemicAlert.length > 0 && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl flex items-start gap-3 animate-in slide-in-from-top"><AlertTriangle className="text-red-600 dark:text-red-400 shrink-0" /><div><h4 className="font-bold text-red-800 dark:text-red-200">{t.epidemicWarning}</h4><p className="text-sm text-red-700 dark:text-red-300 mt-1">{t.epidemicMsg} {epidemicAlert.map(([s, c]) => `${s} (${c})`).join(', ')}</p></div></div>}
          <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-2 overflow-x-auto">
               <Button variant={activeTab === 'queue' ? 'primary' : 'ghost'} onClick={() => setActiveTab('queue')}>{t.incomingPatients}</Button>
               <Button variant={activeTab === 'history' ? 'primary' : 'ghost'} onClick={() => setActiveTab('history')}>{t.medicalHistory}</Button>
               <Button variant={activeTab === 'report' ? 'primary' : 'ghost'} onClick={() => setActiveTab('report')}>{t.studentReport}</Button>
               <Button variant={activeTab === 'analytics' ? 'primary' : 'ghost'} onClick={() => setActiveTab('analytics')}>{t.analytics}</Button>
          </div>
          {activeTab === 'queue' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-1 space-y-4">
                      <div className="flex items-center justify-between"><h3 className="font-bold text-slate-700 dark:text-slate-200">{t.incomingPatients}</h3><Badge color="blue">{incomingStudents.length}</Badge></div>
                      {incomingStudents.length === 0 ? <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 bg-slate-50 dark:bg-slate-800/50"><Coffee size={32} className="mx-auto mb-2 opacity-20" /><p>{t.noIncoming}</p></div> : incomingStudents.map(({ pass, student }) => (<div key={pass.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-sm flex justify-between items-center"><div><h4 className="font-bold text-slate-800 dark:text-white">{lang === 'en' ? student?.name_en : student?.name_ar}</h4><p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{new Date(pass.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p></div><Button className="py-1 px-3 text-sm" onClick={() => handleAdmitFromQueue(student!.id, pass.id)}>{t.admitPatient} <ArrowRight size={16} /></Button></div>))}
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-700 relative">
                           <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.admitWalkIn}</p>
                           <div className="grid grid-cols-3 gap-2 mb-2">
                               <Select value={walkInGender} onChange={(e) => { setWalkInGender(e.target.value); setWalkInGrade(""); setWalkInSection(""); }} className="text-xs py-1.5"><option value="">{t.gender}</option><option value="Male">{t.male}</option><option value="Female">{t.female}</option></Select>
                               <Select value={walkInGrade} onChange={(e) => { setWalkInGrade(e.target.value); setWalkInSection(""); }} disabled={!walkInGender} className="text-xs py-1.5"><option value="">{t.grade}</option>{walkInAvailableGrades.map(g => <option key={g} value={g}>{g}</option>)}</Select>
                               <Select value={walkInSection} onChange={(e) => setWalkInSection(e.target.value)} disabled={!walkInGrade} className="text-xs py-1.5"><option value="">{t.section}</option>{walkInAvailableSections.map(s => <option key={s} value={s}>{s}</option>)}</Select>
                           </div>
                           <div className="relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /><Input placeholder={t.searchPlaceholder} className="pl-9" value={searchStudent} onChange={e => setSearchStudent(e.target.value)} />{searchStudent && <button onClick={() => setSearchStudent("")} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"><X size={16} /></button>}</div>
                           {(searchStudent || (walkInGender && walkInGrade && walkInSection)) && <div className="mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg max-h-40 overflow-y-auto shadow-lg absolute z-10 w-full max-w-[calc(100%-2rem)] lg:max-w-[22rem] left-0 right-0">{filteredWalkInStudents.length === 0 ? <div className="p-3 text-sm text-slate-400 text-center">No students found</div> : filteredWalkInStudents.map(s => (<button key={s.id} onClick={() => { setSelectedStudentId(s.id); setSearchStudent(""); setWalkInGender(""); setWalkInGrade(""); setWalkInSection(""); }} className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-slate-700 text-sm border-b border-slate-50 dark:border-slate-700 last:border-0 flex justify-between items-center"><span className="font-medium text-slate-700 dark:text-slate-200">{s.name_en}</span><span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{s.studentNumber}</span></button>))}</div>}
                           {!selectedStudentId && !searchStudent && !walkInGender && <div className="mt-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-3 flex items-start gap-2"><Plus className="text-blue-500 shrink-0 w-4 h-4 mt-0.5" /><p className="text-xs text-blue-700 dark:text-blue-300">Search for a student or select their class to admit them immediately without an E-Pass.</p></div>}
                      </div>
                  </div>
                  <div className="lg:col-span-2">{selectedStudentId ? renderVisitForm() : <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 bg-slate-50 dark:bg-slate-800/50 min-h-[300px]"><FileText size={48} className="opacity-20 mb-4" /><p className="text-sm font-medium">Select a student from the queue or search to log a visit</p></div>}</div>
              </div>
          )}
          {activeTab === 'history' && (
              <Card>
                  <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">{t.medicalHistory}</h3>
                  <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                          <thead>
                              <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm border-b border-slate-100 dark:border-slate-700">
                                  <th className="p-3 text-start">{t.date}</th>
                                  <th className="p-3 text-start">{t.studentName}</th>
                                  <th className="p-3 text-start">{t.admitted}</th>
                                  <th className="p-3 text-start">{t.discharged}</th>
                                  <th className="p-3 text-start">{t.symptom}</th>
                                  <th className="p-3 text-start">{t.severity}</th>
                                  <th className="p-3 text-start">{t.outcome}</th>
                              </tr>
                          </thead>
                          <tbody>
                              {paginatedVisits.length === 0 ? (
                                  <tr><td colSpan={7} className="p-6 text-center text-slate-400 italic">No records found</td></tr>
                              ) : (
                                  paginatedVisits.map(v => { 
                                      const s = students.find(stu => stu.id === v.studentId); 
                                      return (
                                          <tr key={v.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                                              <td className="p-3 text-sm text-start text-slate-700 dark:text-slate-300">{new Date(v.timestamp).toLocaleDateString()}</td>
                                              <td className="p-3 font-medium text-start text-slate-800 dark:text-slate-200">{lang === 'en' ? s?.name_en : s?.name_ar}</td>
                                              <td className="p-3 text-sm font-mono text-slate-500 dark:text-slate-400 text-start">{new Date(v.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                              <td className="p-3 text-sm font-mono text-slate-500 dark:text-slate-400 text-start">{v.dischargeTime ? new Date(v.dischargeTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}</td>
                                              <td className="p-3 text-start text-slate-700 dark:text-slate-300">{v.symptom}</td>
                                              <td className="p-3 text-start"><Badge color={v.severity === 'Emergency' || v.severity === 'High' ? 'red' : 'blue'}>{v.severity}</Badge></td>
                                              <td className="p-3 text-sm text-start text-slate-700 dark:text-slate-300">{v.outcome}</td>
                                          </tr>
                                      )
                                  })
                              )}
                          </tbody>
                      </table>
                  </div>
                  <Pagination 
                      currentPage={historyPage}
                      totalPages={totalHistoryPages}
                      onPageChange={setHistoryPage}
                      className="pt-4"
                  />
              </Card>
          )}
          {activeTab === 'report' && renderReportTab()}
          {activeTab === 'analytics' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="h-80 flex flex-col min-w-0">
                    <h3 className="font-bold mb-4 text-slate-800 dark:text-white">{t.commonComplaints}</h3>
                    <div className="flex-1 min-h-0 w-full">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                            <BarChart data={symptomData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={100} fontSize={12} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
                <Card className="h-80 flex flex-col min-w-0">
                    <h3 className="font-bold mb-4 text-slate-800 dark:text-white">{t.visitsByGrade}</h3>
                    <div className="flex-1 min-h-0 w-full">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                            <BarChart data={gradeData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" fontSize={12} />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
                <Card className="h-80 flex flex-col min-w-0">
                    <h3 className="font-bold mb-4 text-slate-800 dark:text-white">{t.visitsBySection}</h3>
                    <div className="flex-1 min-h-0 w-full">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                            <BarChart data={sectionData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" fontSize={12} />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
                <Card className="h-80 flex flex-col min-w-0">
                    <h3 className="font-bold mb-4 text-slate-800 dark:text-white">{t.visitsByGender}</h3>
                    <div className="flex-1 min-h-0 w-full">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                            <BarChart data={genderData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" fontSize={12} />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#ec4899" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
          )}
      </div>
  );
};