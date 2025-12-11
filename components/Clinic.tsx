
import React, { useState, useMemo } from 'react';
import { Card, Button, Input, Select, Badge, Pagination } from './ui';
import { useStore } from '../services/store';
import { Language, ClinicVisit, User } from '../types';
import { TRANSLATIONS, CLINIC_SYMPTOMS } from '../constants';
import { AlertTriangle, Search, User as UserIcon, ArrowRight, Siren, FileText, Coffee, Plus, X, Clock } from 'lucide-react';

interface ClinicProps {
  lang: Language;
  currentUser: User | null;
}

const HISTORY_ITEMS_PER_PAGE = 10;

export const Clinic: React.FC<ClinicProps> = ({ lang, currentUser }) => {
  const t = TRANSLATIONS[lang];
  const store = useStore();
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [isLoading, setIsLoading] = useState(false);
  
  const [admissionTab, setAdmissionTab] = useState<'queue' | 'walkin'>('queue');
  // Form & Filter States
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [searchStudent, setSearchStudent] = useState("");
  const [linkedPassId, setLinkedPassId] = useState("");
  const [formData, setFormData] = useState<Partial<ClinicVisit>>({ symptom: '', severity: 'Low', outcome: 'ReturnToClass' });
  const [walkInGender, setWalkInGender] = useState("");
  const [walkInGrade, setWalkInGrade] = useState("");
  const [walkInSection, setWalkInSection] = useState("");
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
  const handleConfirmEmergency = async () => { 
      setEmergencyMode(true); 
      setShowEmergencyModal(false); 
      await store.triggerEmergencyAlert(); // Trigger the alert
  };

  const renderVisitForm = () => {
      const student = students.find(s => s.id === selectedStudentId);
      if (!student) return null;
      return (
          <Card className={`border-2 ${emergencyMode ? 'border-red-500 bg-red-50/50 dark:bg-red-900/20' : 'border-white/20'}`}>
              <div className="flex justify-between items-start mb-6">
                  <div><h3 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white"><UserIcon size={24} /> {lang === 'en' ? student.name_en : student.name_ar}</h3><p className="text-sm text-slate-500 dark:text-slate-400 mt-1">ID: {student.studentNumber} | {student.grade}-{student.section}</p></div>
                  <Button variant="ghost" onClick={() => setSelectedStudentId("")}>{t.cancel}</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.symptom} *</label><Select value={formData.symptom} onChange={(e) => setFormData({...formData, symptom: e.target.value})}><option value="">Select...</option>{CLINIC_SYMPTOMS.map((s: string) => <option key={s} value={s}>{s}</option>)}</Select></div>
                  <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.severity} *</label><Select value={formData.severity} onChange={(e) => setFormData({...formData, severity: e.target.value as any})} className={formData.severity === 'Emergency' ? 'text-red-600 font-bold' : ''}><option value="Low">{t.low}</option><option value="Medium">{t.medium}</option><option value="High">{t.high}</option><option value="Emergency">{t.emergency}</option></Select></div>
                  <div className="col-span-2"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.diagnosis}</label><Input value={formData.diagnosis || ''} onChange={(e) => setFormData({...formData, diagnosis: e.target.value})} placeholder="Initial observation..." /></div>
                  <div className="col-span-2"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.treatment}</label><Input value={formData.treatment || ''} onChange={(e) => setFormData({...formData, treatment: e.target.value})} placeholder="Medicine given, ice pack, etc." /></div>
                  <div className="col-span-2"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.notes}</label><Input value={formData.notes || ''} onChange={(e) => setFormData({...formData, notes: e.target.value})} placeholder="Additional private notes..." /></div>
                  <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.outcome} *</label><Select value={formData.outcome} onChange={(e) => setFormData({...formData, outcome: e.target.value as any})}><option value="ReturnToClass">{t.returnToClass}</option><option value="SentHome">{t.sentHomeAction}</option></Select></div>
              </div>
              <div className="flex justify-end gap-3"><Button disabled={isLoading} onClick={handleSubmitVisit} className={formData.severity === 'Emergency' ? 'bg-red-600 hover:bg-red-700' : ''}>{t.logVisit}</Button></div>
          </Card>
      );
  };

  return (
      <div className="space-y-6 relative">
          {showEmergencyModal && (
              <div className="fixed inset-0 bg-red-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
                  <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-300 border border-red-500/50 ring-4 ring-red-500/20">
                      <div className="bg-red-600 p-8 flex flex-col items-center text-white text-center"><div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-4 animate-pulse"><Siren size={48} className="text-white" /></div><h2 className="text-3xl font-bold">{t.emergencyAlert}</h2></div>
                      <div className="p-8 space-y-6"><p className="text-slate-700 dark:text-slate-200 text-center font-medium text-lg">{t.emergencyConfirm}</p><p className="text-slate-500 dark:text-slate-400 text-sm text-center bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-800">{t.emergencyConfirmDesc}</p><div className="flex gap-4 pt-2"><button onClick={() => setShowEmergencyModal(false)} className="flex-1 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">{t.cancel}</button><button onClick={handleConfirmEmergency} className="flex-1 py-4 rounded-2xl bg-red-600 font-bold text-white hover:bg-red-700 shadow-lg shadow-red-500/30 transition-all hover:scale-105">{t.confirmAction}</button></div></div>
                  </div>
              </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-24">
              <Card className="flex items-end justify-between min-w-0 p-6">
                  <div className="flex-1">
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{t.todayVisits}</p>
                      <h3 className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{todayVisits.length}</h3>
                  </div>
              </Card>
              <Card className="flex items-end justify-between min-w-0 p-6">
                  <div className="flex-1">
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{t.incomingPatients}</p>
                      <h3 className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{incomingStudents.length}</h3>
                  </div>
              </Card>
              <Card className="flex items-end justify-between min-w-0 p-6">
                  <div className="flex-1">
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{t.sentHome}</p>
                      <h3 className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{todayVisits.filter(v => v.outcome === 'SentHome').length}</h3>
                  </div>
              </Card>
              <button onClick={() => setShowEmergencyModal(true)} className="flex flex-col items-center justify-center bg-red-600 text-white rounded-3xl hover:bg-red-700 transition-all shadow-xl shadow-red-600/30 group min-w-0 hover:scale-105 active:scale-95 duration-300"><AlertTriangle size={32} className="mb-2 group-hover:animate-pulse" /><span className="font-bold uppercase text-sm tracking-wider">{t.emergencyAlert}</span></button>
          </div>
          {epidemicAlert.length > 0 && <div className="bg-red-50/80 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-6 rounded-3xl flex items-start gap-4 animate-in slide-in-from-top backdrop-blur-sm shadow-lg shadow-red-900/10"><div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-xl"><AlertTriangle className="text-red-600 dark:text-red-400 shrink-0" size={24} /></div><div><h4 className="font-bold text-lg text-red-800 dark:text-red-200">{t.epidemicWarning}</h4><p className="text-slate-700 dark:text-slate-300 mt-1">{t.epidemicMsg} {epidemicAlert.map(([s, c]) => `${s} (${c})`).join(', ')}</p></div></div>}
          
          <div className="bg-white/40 dark:bg-slate-900/40 p-1.5 rounded-2xl border border-white/20 backdrop-blur-md inline-flex flex-wrap gap-1 shadow-sm">
               <button onClick={() => setActiveTab('queue')} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'queue' ? 'bg-white dark:bg-slate-800 text-primary shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50'}`}>{t.incomingPatients}</button>
               <button onClick={() => setActiveTab('history')} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'history' ? 'bg-white dark:bg-slate-800 text-primary shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50'}`}>{t.medicalHistory}</button>
          </div>

          {activeTab === 'queue' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="lg:col-span-1 space-y-4">
                      <Card className="border-slate-200/60 dark:border-slate-700/60 relative overflow-visible">
                          <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl inline-flex items-center gap-1 mb-4">
                              <button onClick={() => setAdmissionTab('queue')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${admissionTab === 'queue' ? 'bg-white dark:bg-slate-700 text-primary shadow' : 'text-slate-500 dark:text-slate-400'}`}>{t.incomingPatients} <Badge color="blue" className="text-xs px-2">{incomingStudents.length}</Badge></button>
                              <button onClick={() => setAdmissionTab('walkin')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${admissionTab === 'walkin' ? 'bg-white dark:bg-slate-700 text-primary shadow' : 'text-slate-500 dark:text-slate-400'}`}>{t.admitWalkIn}</button>
                          </div>
                          {admissionTab === 'queue' && (
                              <div className="space-y-3">
                                  {incomingStudents.length === 0 ? <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400"><Coffee size={32} className="mx-auto mb-3 opacity-30" /><p className="font-medium text-sm">{t.noIncoming}</p></div> : incomingStudents.map(({ pass, student }) => (<div key={pass.id} className="bg-white/70 dark:bg-slate-800/70 border border-white/40 dark:border-slate-700 p-4 rounded-xl shadow-sm hover:shadow-md transition-all flex justify-between items-center backdrop-blur-xl"><div><h4 className="font-bold text-slate-800 dark:text-white">{lang === 'en' ? student?.name_en : student?.name_ar}</h4><p className="text-sm text-slate-500 dark:text-slate-400 font-mono mt-1 flex items-center gap-1.5"><Clock size={12} /> {new Date(pass.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p></div><Button size="sm" className="rounded-lg px-3" onClick={() => handleAdmitFromQueue(student!.id, pass.id)}> <ArrowRight size={16} className="ml-1" /></Button></div>))}
                              </div>
                          )}
                          {admissionTab === 'walkin' && (
                              <div className="space-y-3">
                                  <div className="grid grid-cols-3 gap-3">
                                      <Select value={walkInGender} onChange={(e) => { setWalkInGender(e.target.value); setWalkInGrade(""); setWalkInSection(""); }} className="text-sm py-2"><option value="">{t.gender}</option><option value="Male">{t.male}</option><option value="Female">{t.female}</option></Select>
                                      <Select value={walkInGrade} onChange={(e) => { setWalkInGrade(e.target.value); setWalkInSection(""); }} disabled={!walkInGender} className="text-sm py-2"><option value="">{t.grade}</option>{walkInAvailableGrades.map(g => <option key={g} value={g}>{g}</option>)}</Select>
                                      <Select value={walkInSection} onChange={(e) => setWalkInSection(e.target.value)} disabled={!walkInGrade} className="text-sm py-2"><option value="">{t.section}</option>{walkInAvailableSections.map(s => <option key={s} value={s}>{s}</option>)}</Select>
                                  </div>
                                  <div className="relative"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><Input placeholder={t.searchPlaceholder} className="pl-10" value={searchStudent} onChange={e => setSearchStudent(e.target.value)} />{searchStudent && <button onClick={() => setSearchStudent("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={18} /></button>}</div>
                                  {(searchStudent || (walkInGender && walkInGrade && walkInSection)) && <div className="mt-1 bg-white/90 dark:bg-slate-900/90 border border-slate-200/50 dark:border-slate-700/50 rounded-xl max-h-60 overflow-y-auto shadow-lg backdrop-blur-xl p-1.5 space-y-1">{filteredWalkInStudents.length === 0 ? <div className="p-4 text-sm text-slate-400 text-center">No students found</div> : filteredWalkInStudents.map(s => (<button key={s.id} onClick={() => { setSelectedStudentId(s.id); setSearchStudent(""); setWalkInGender(""); setWalkInGrade(""); setWalkInSection(""); }} className="w-full text-left px-3 py-2.5 hover:bg-blue-50/50 dark:hover:bg-slate-800/50 rounded-lg text-sm flex justify-between items-center transition-colors group"><span className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-primary">{s.name_en}</span><span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">{s.studentNumber}</span></button>))}</div>}
                              </div>
                          )}
                      </Card>
                  </div>
                  <div className="lg:col-span-2">{selectedStudentId ? renderVisitForm() : <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl text-slate-400 bg-white/30 dark:bg-slate-800/30 backdrop-blur-sm min-h-[400px]"><div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4"><FileText size={40} className="opacity-40" /></div><p className="text-lg font-medium">Select a student to log a visit</p></div>}</div>
              </div>
          )}
          {activeTab === 'history' && (
              <Card>
                  <h3 className="font-bold text-xl mb-6 text-slate-800 dark:text-white px-2">{t.medicalHistory}</h3>
                  <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                          <thead>
                              <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-sm border-b border-slate-200/50 dark:border-slate-700/50">
                                  <th className="p-4 rounded-tl-2xl text-start">{t.date}</th>
                                  <th className="p-4 text-start">{t.studentName}</th>
                                  <th className="p-4 text-start">{t.admitted}</th>
                                  <th className="p-4 text-start">{t.discharged}</th>
                                  <th className="p-4 text-start">{t.symptom}</th>
                                  <th className="p-4 text-start">{t.severity}</th>
                                  <th className="p-4 rounded-tr-2xl text-start">{t.outcome}</th>
                              </tr>
                          </thead>
                          <tbody>
                              {paginatedVisits.length === 0 ? (
                                  <tr><td colSpan={7} className="p-8 text-center text-slate-400 italic">No records found</td></tr>
                              ) : (
                                  paginatedVisits.map(v => { 
                                      const s = students.find(stu => stu.id === v.studentId); 
                                      return (
                                          <tr key={v.id} className="border-b border-slate-100/50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                              <td className="p-4 text-sm text-start text-slate-700 dark:text-slate-300 font-medium">{new Date(v.timestamp).toLocaleDateString()}</td>
                                              <td className="p-4 font-bold text-start text-slate-800 dark:text-slate-200">{lang === 'en' ? s?.name_en : s?.name_ar}</td>
                                              <td className="p-4 text-sm font-mono text-slate-500 dark:text-slate-400 text-start">{new Date(v.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                              <td className="p-4 text-sm font-mono text-slate-500 dark:text-slate-400 text-start">{v.dischargeTime ? new Date(v.dischargeTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}</td>
                                              <td className="p-4 text-start text-slate-700 dark:text-slate-300"><span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-sm font-medium">{v.symptom}</span></td>
                                              <td className="p-4 text-start"><Badge color={v.severity === 'Emergency' || v.severity === 'High' ? 'red' : 'blue'}>{v.severity}</Badge></td>
                                              <td className="p-4 text-sm text-start text-slate-700 dark:text-slate-300 font-medium">{v.outcome}</td>
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
                      className="pt-6 border-t border-slate-100 dark:border-slate-800"
                  />
              </Card>
          )}
      </div>
  );
};