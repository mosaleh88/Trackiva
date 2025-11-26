
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Badge, Pagination } from './ui';
import { store } from '../services/store';
import { generateSchoolInsights } from '../services/geminiService';
import { Language, Student, User } from '../types';
import { TRANSLATIONS } from '../constants';
import { BarChart3, Calendar, Download, Filter, Search, User as UserIcon, LayoutDashboard, Activity, Ticket, DoorOpen, ChevronDown, ChevronRight, Printer, Stethoscope, Clock, AlertTriangle, CheckCircle2, ArrowRight, BrainCircuit, UserCheck, Loader2, MousePointerClick } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, Label } from 'recharts/lib';

interface ReportsProps {
  lang: Language;
  currentUser: User | null;
}

const COLORS = ['#22c55e', '#3b82f6', '#ef4444', '#f59e0b', '#f97316'];

const TABS = [
  { id: 'daily', labelKey: 'dailySummary', icon: LayoutDashboard },
  { id: 'attendance', labelKey: 'attendanceReport', icon: BarChart3 },
  { id: 'clinic', labelKey: 'clinicReport', icon: Stethoscope },
  { id: 'epass', labelKey: 'epassReport', icon: Ticket },
  { id: 'reception', labelKey: 'receptionReport', icon: DoorOpen },
  { id: 'student360', labelKey: 'student360', icon: UserIcon },
];

const ITEMS_PER_PAGE = 5;
const REPORT_ITEMS_PER_PAGE = 10;

export const Reports: React.FC<ReportsProps> = ({ lang, currentUser }) => {
  const t = TRANSLATIONS[lang];
  const [activeTab, setActiveTab] = useState('daily');
  
  // -- Independent State for Student 360 --
  const [student360StartDate, setStudent360StartDate] = useState(store.getAcademicYearStartStr());
  const [student360EndDate, setStudent360EndDate] = useState(store.getTodayStr());
  const [search360, setSearch360] = useState("");
  const [student360, setStudent360] = useState<Student | null>(null);
  const [student360Data, setStudent360Data] = useState<any>(null);
  
  // -- Independent State for Other Reports --
  const defaultFilters = {
      startDate: store.getAcademicYearStartStr(),
      endDate: store.getTodayStr(),
      grade: 'All',
      section: 'All',
      gender: 'All'
  };

  const [reportStates, setReportStates] = useState<Record<string, { filters: typeof defaultFilters, data: any, loading: boolean }>>({
      attendance: { filters: { ...defaultFilters }, data: null, loading: false },
      clinic: { filters: { ...defaultFilters }, data: null, loading: false },
      epass: { filters: { ...defaultFilters }, data: null, loading: false },
      reception: { filters: { ...defaultFilters }, data: null, loading: false },
  });

  // Data State (General Student List)
  const [students, setStudents] = useState<Student[]>([]);
  
  // Pagination States
  const [attendancePage, setAttendancePage] = useState(1);
  const [epassPage, setEpassPage] = useState(1);
  const [absenteePage, setAbsenteePage] = useState(1);
  const [receptionPage, setReceptionPage] = useState(1);

  // AI Analyst State
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  
  // 360 View Collapsibles
  const [showAttendanceHistory, setShowAttendanceHistory] = useState(true);
  const [showClinicHistory, setShowClinicHistory] = useState(false);
  const [showEPassHistory, setShowEPassHistory] = useState(false);
  const [showReceptionHistory, setShowReceptionHistory] = useState(false);

  const settings = store.getSettings();
  const attendanceConfig = settings.attendanceSettings;

  // Initial Student Load
  useEffect(() => {
      if (currentUser) {
          setStudents(store.getStudentsForUser(currentUser.id));
      }
  }, [currentUser]);

  // -- Handlers for Report State --
  const handleFilterChange = (tab: string, key: string, value: string) => {
      setReportStates(prev => ({
          ...prev,
          [tab]: {
              ...prev[tab],
              filters: { ...prev[tab].filters, [key]: value }
          }
      }));
  };

  const generateReport = async (tab: string) => {
      if (!currentUser) return;
      
      setReportStates(prev => ({ ...prev, [tab]: { ...prev[tab], loading: true } }));
      
      try {
          const filters = reportStates[tab].filters;
          
          // SELECTIVE FETCHING OPTIMIZATION
          let typesToFetch: ('attendance' | 'epasses' | 'receptionLogs' | 'clinicVisits')[] = [];
          switch(tab) {
              case 'attendance': typesToFetch = ['attendance']; break;
              case 'clinic': typesToFetch = ['clinicVisits']; break;
              case 'epass': typesToFetch = ['epasses']; break;
              case 'reception': typesToFetch = ['receptionLogs']; break;
              default: typesToFetch = ['attendance', 'epasses', 'receptionLogs', 'clinicVisits'];
          }

          // Fetch data without caching to ensure fresh custom range data
          const fetchedData = await store.fetchDataForRange(filters.startDate, filters.endDate, { cache: false, types: typesToFetch });
          
          const reportData = store.getReportsData(filters.startDate, filters.endDate, {
              grade: filters.grade,
              section: filters.section,
              gender: filters.gender
          }, currentUser.id, fetchedData);
          
          setReportStates(prev => ({ 
              ...prev, 
              [tab]: { ...prev[tab], data: reportData, loading: false } 
          }));
          
          // Reset paginations
          if (tab === 'attendance') setAbsenteePage(1);
          if (tab === 'reception') setReceptionPage(1);
          setAiInsight(null);

      } catch (e) {
          console.error(e);
          setReportStates(prev => ({ ...prev, [tab]: { ...prev[tab], loading: false } }));
      }
  };

  // -- Student 360 Logic --
  // Reset pagination and AI when student changes
  useEffect(() => {
      setAttendancePage(1);
      setEpassPage(1);
      setAiInsight(null);
  }, [student360]);

  // Auto-refresh Student 360 data when dates change
  useEffect(() => {
      if (student360) {
          const load360 = async () => {
             // For 360 view, we need all data types, so we don't restrict types
             const fetchedData = await store.fetchDataForRange(student360StartDate, student360EndDate, { cache: false });
             const sData = store.getStudent360Data(student360.id, student360StartDate, student360EndDate, fetchedData);
             setStudent360Data(sData);
          };
          load360();
      }
  }, [student360StartDate, student360EndDate, student360]);

  // --- AI Analyst Handler ---
  const handleAskAi = async () => {
      setLoadingAi(true);
      try {
          let context: 'global_report' | 'student_profile' = 'global_report';
          let analysisData = null;

          if (activeTab === 'student360' && student360Data) {
              context = 'student_profile';
              analysisData = student360Data;
          } else if (reportStates[activeTab]?.data) {
              analysisData = reportStates[activeTab].data;
          }

          if (analysisData) {
              const insight = await generateSchoolInsights(analysisData, context, 'Administrator', lang);
              setAiInsight(insight);
          }
      } catch (e) {
          console.error(e);
      } finally {
          setLoadingAi(false);
      }
  };

  // Aggregate Attendance Data by Day for 360
  const dailyAttendance = useMemo(() => {
      if (!student360Data?.history?.attendance) return [];
      
      const records = student360Data.history.attendance;
      const groups: Record<string, any[]> = {};
      
      records.forEach((r: any) => {
          if (!groups[r.date]) groups[r.date] = [];
          groups[r.date].push(r);
      });

      return Object.entries(groups).map(([dateStr, dayRecs]) => {
          const unexcused = dayRecs.filter((r: any) => r.status === 'Absent (Unexcused)').length;
          const excused = dayRecs.filter((r: any) => r.status === 'Absent (Excused)').length;
          const late = dayRecs.some((r: any) => r.status === 'Late');
          const early = dayRecs.some((r: any) => r.status === 'Early Leave');
          const total = dayRecs.length;

          let status = t.present;
          let color = 'green';
          let note = Array.from(new Set(dayRecs.map((r: any) => r.reason).filter(Boolean))).join(', ');
          let weight = 1;

          const threshold = attendanceConfig?.absentPeriodThreshold || 3;

          if (unexcused >= threshold) {
              status = t.absent;
              color = 'red';
              const [y, m, d] = dateStr.split('-').map(Number);
              const localDate = new Date(y, m-1, d);
              const isFriday = localDate.getDay() === 5;
              const isSpecial = attendanceConfig?.doubleCountDates?.includes(dateStr);

              if ((isFriday && attendanceConfig?.doubleCountFridays) || isSpecial) {
                  weight = 2;
                  status = `${t.absent} (x2)`;
              }
          } else if (total > 0 && excused === total) {
              status = t.excused;
              color = 'blue';
          } else if (early) {
              status = t.earlyLeave;
              color = 'orange';
          } else if (late) {
              status = t.late;
              color = 'yellow';
          }

          return { date: dateStr, status, color, note, weight };
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [student360Data, attendanceConfig, t]);

  const paginatedAttendance = useMemo(() => {
      const start = (attendancePage - 1) * ITEMS_PER_PAGE;
      return dailyAttendance.slice(start, start + ITEMS_PER_PAGE);
  }, [dailyAttendance, attendancePage]);

  const totalPages = Math.ceil(dailyAttendance.length / ITEMS_PER_PAGE);

  const epassHistory = useMemo(() => {
      if (!student360Data?.history?.epasses) return [];
      return student360Data.history.epasses;
  }, [student360Data]);

  const paginatedEPasses = useMemo(() => {
      const start = (epassPage - 1) * ITEMS_PER_PAGE;
      return epassHistory.slice(start, start + ITEMS_PER_PAGE);
  }, [epassHistory, epassPage]);

  const totalEpassPages = Math.ceil(epassHistory.length / ITEMS_PER_PAGE);

  const epassStats = useMemo(() => {
      const counts: Record<string, number> = {};
      const destinations = store.getDestinations();
      epassHistory.forEach((p: any) => {
          let type = p.type;
          if (type === 'UNAUTHORIZED') {
              type = t.unauthorized;
          } else {
              const d = destinations.find(dst => dst.id === type);
              if (d) type = lang === 'en' ? d.label_en : d.label_ar;
          }
          counts[type] = (counts[type] || 0) + 1;
      });
      return counts;
  }, [epassHistory, lang, t]);

  const pieData = useMemo(() => {
      let p = 0, ea = 0, a = 0; 
      dailyAttendance.forEach((day: any) => {
          if (day.status.startsWith(t.absent)) a += day.weight;
          else if (day.status === t.excused) ea++;
          else p++;
      });
      return [
          { name: t.present, value: p },
          { name: t.excused, value: ea },
          { name: t.absent, value: a }
      ].filter(d => d.value > 0);
  }, [dailyAttendance, t]);
  
  const presentPct = useMemo(() => {
      const totalDays = dailyAttendance.length || 1;
      const presentCount = pieData.find(d => d.name === t.present)?.value || 0;
      return Math.round((presentCount / totalDays) * 100);
  }, [pieData, dailyAttendance.length, t.present]);

  const handleExport = () => {
      alert("Report exported to Excel (Simulated)");
  };

  // -- Reusable Filter Bar Component --
  const FilterBar = ({ tabName }: { tabName: string }) => {
      const state = reportStates[tabName];
      if (!state) return null;
      
      const uniqueGrades = Array.from(new Set(students.map(s => s.grade))).sort();
      const uniqueSections = Array.from(new Set(students.map(s => s.section))).sort();

      return (
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 dark:border-slate-700 pb-4 mb-6">
            <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.startDate}</label>
                <Input type="date" value={state.filters.startDate} onChange={e => handleFilterChange(tabName, 'startDate', e.target.value)} className="py-2 text-sm w-36" />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.endDate}</label>
                <Input type="date" value={state.filters.endDate} onChange={e => handleFilterChange(tabName, 'endDate', e.target.value)} className="py-2 text-sm w-36" />
            </div>

            <Button onClick={() => generateReport(tabName)} className="h-[38px]" disabled={state.loading}>
                {state.loading ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                {t.generate}
            </Button>

            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-2 self-center"></div>

            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                    <Filter size={16} />
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 hidden md:inline">{t.filterBy}:</span>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.grade}</label>
                    <Select value={state.filters.grade} onChange={e => handleFilterChange(tabName, 'grade', e.target.value)} className="py-2 text-sm w-24 text-start">
                        <option value="All">{t.allGrades}</option>
                        {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
                    </Select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.section}</label>
                    <Select value={state.filters.section} onChange={e => handleFilterChange(tabName, 'section', e.target.value)} className="py-2 text-sm w-24 text-start">
                        <option value="All">{t.allSections}</option>
                        {uniqueSections.map(s => <option key={s} value={s}>{s}</option>)}
                    </Select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.gender}</label>
                    <Select value={state.filters.gender} onChange={e => handleFilterChange(tabName, 'gender', e.target.value)} className="py-2 text-sm w-28 text-start">
                        <option value="All">{t.allGenders}</option>
                        <option value="Male">{t.male}</option>
                        <option value="Female">{t.female}</option>
                    </Select>
                </div>
            </div>
        </div>
      );
  };

  const handlePrint360 = () => {
      if (!student360 || !student360Data) return;
      
      const locale = lang === 'ar' ? 'ar-EG' : 'en-US';
      const epassCounts: Record<string, number> = {};
      student360Data.history.epasses.forEach((p: any) => {
          let type = p.type === 'UNAUTHORIZED' ? t.unauthorized : p.type;
          if (p.type !== 'UNAUTHORIZED') {
               const d = store.getDestinations().find((dst: any) => dst.id === p.type);
               if (d) type = lang === 'en' ? d.label_en : d.label_ar;
          }
          epassCounts[type] = (epassCounts[type] || 0) + 1;
      });

      const epassSummaryHTML = Object.keys(epassCounts).length > 0 ? `
        <div class="grid grid-cols-4 gap-2 mb-4">
            ${Object.entries(epassCounts).sort((a, b) => b[1] - a[1]).map(([label, count]) => `
                <div class="p-2 border rounded text-center bg-slate-50">
                    <div class="text-[10px] font-bold text-slate-500 uppercase truncate">${label}</div>
                    <div class="text-lg font-bold text-slate-800">${count}</div>
                </div>
            `).join('')}
        </div>
      ` : '';

      const epassRows = student360Data.history.epasses.map((p: any) => {
          let dest = p.type;
          if (dest === 'UNAUTHORIZED') {
              dest = t.unauthorized;
          } else {
             const d = store.getDestinations().find((dst: any) => dst.id === p.type);
             if (d) dest = lang === 'en' ? d.label_en : d.label_ar;
          }
          const duration = p.endTime 
            ? Math.floor((p.endTime - p.startTime)/60000) + (lang === 'ar' ? ' دقيقة' : 'm') 
            : 'Active';
            
          return `
          <tr class="border-b">
              <td class="p-2">${new Date(p.startTime).toLocaleDateString(locale)}</td>
              <td class="p-2" dir="ltr">${new Date(p.startTime).toLocaleTimeString(locale, {hour: '2-digit', minute: '2-digit'})}</td>
              <td class="p-2">${dest}</td>
              <td class="p-2">${duration}</td>
          </tr>`;
      }).join('');

      const receptionRows = student360Data.history.reception.map((r: any) => {
          const typeLabel = r.type === 'LateArrival' ? t.lateArrival : t.earlyLeave;
          return `
          <tr class="border-b">
              <td class="p-2">${new Date(r.timestamp).toLocaleDateString(locale)}</td>
              <td class="p-2" dir="ltr">${new Date(r.timestamp).toLocaleTimeString(locale, {hour: '2-digit', minute: '2-digit'})}</td>
              <td class="p-2">${typeLabel}</td>
              <td class="p-2">${r.reason || '-'}</td>
          </tr>`;
      }).join('');

      const filteredAttendance = dailyAttendance.filter((d: any) => 
          d.status === t.absent || d.status === t.excused || d.status === t.earlyLeave
      );

      const printContent = `
        <html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">
          <head>
            <title>${t.studentComprehensiveReport} - ${lang === 'en' ? student360.name_en : student360.name_ar}</title>
            <script src="https://cdn.tailwindcss.com"></script>
          </head>
          <body class="p-8 bg-white font-sans">
             <div class="mb-8 border-b pb-4 flex justify-between items-center">
                <div>
                    <h1 class="text-3xl font-bold">${t.trackivaAcademy}</h1>
                    <p class="text-slate-500">${t.studentComprehensiveReport}</p>
                </div>
                <div class="text-right">
                    <p class="text-sm text-slate-400">${t.generatedOn} ${new Date().toLocaleDateString(locale)}</p>
                </div>
             </div>
             <div class="flex items-center gap-6 mb-8 p-6 bg-slate-50 rounded-xl border">
                <div class="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center text-3xl font-bold text-slate-500">
                    ${student360.name_en.charAt(0)}
                </div>
                <div>
                    <h2 class="text-2xl font-bold">${lang === 'en' ? student360.name_en : student360.name_ar}</h2>
                    <div class="flex gap-4 mt-2 text-sm">
                        <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded">${student360.grade}-${student360.section}</span>
                        <span class="bg-slate-100 text-slate-800 px-2 py-1 rounded">ID: ${student360.studentNumber}</span>
                    </div>
                </div>
             </div>
             <div class="grid grid-cols-4 gap-4 mb-8">
                 <div class="p-4 border rounded-lg text-center">
                    <h3 class="text-xs font-bold text-slate-500 uppercase">${t.present} %</h3>
                    <p class="text-2xl font-bold text-blue-600">${presentPct}%</p>
                 </div>
                 <div class="p-4 border rounded-lg text-center">
                    <h3 class="text-xs font-bold text-slate-500 uppercase">${t.absent}</h3>
                    <p class="text-2xl font-bold text-red-600">${pieData.find((d: any) => d.name === t.absent)?.value || 0}</p>
                 </div>
                 <div class="p-4 border rounded-lg text-center">
                    <h3 class="text-xs font-bold text-slate-500 uppercase">${t.clinic}</h3>
                    <p class="text-2xl font-bold text-purple-600">${student360Data.history.clinic.length}</p>
                 </div>
                 <div class="p-4 border rounded-lg text-center">
                    <h3 class="text-xs font-bold text-slate-500 uppercase">${t.epassReport}</h3>
                    <p class="text-2xl font-bold text-orange-600">${student360Data.history.epasses.length}</p>
                 </div>
             </div>
             <h3 class="text-lg font-bold mb-4 border-b pb-2">${t.attendanceLogExceptions}</h3>
             <table class="w-full text-left text-sm mb-8">
                 <thead class="bg-slate-50">
                     <tr><th class="p-2">${t.date}</th><th class="p-2">${t.status}</th><th class="p-2">${t.reason}</th></tr>
                 </thead>
                 <tbody>
                     ${filteredAttendance.length > 0 ? filteredAttendance.map((d: any) => `
                        <tr class="border-b">
                            <td class="p-2">${new Date(d.date).toLocaleDateString(locale)}</td>
                            <td class="p-2"><span class="px-2 py-1 rounded text-xs font-bold ${d.color === 'green' ? 'bg-green-100 text-green-800' : d.color === 'red' ? 'bg-red-100 text-red-800' : d.color === 'blue' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}">${d.status}</span></td>
                            <td class="p-2 text-slate-500">${d.note || '-'}</td>
                        </tr>
                     `).join('') : `<tr><td colspan="3" class="p-4 text-center text-slate-400 italic">${t.noData}</td></tr>`}
                 </tbody>
             </table>
             <h3 class="text-lg font-bold mb-4 border-b pb-2">${t.clinicHistory}</h3>
             <table class="w-full text-left text-sm mb-8">
                 <thead class="bg-slate-50">
                     <tr><th class="p-2">${t.date}</th><th class="p-2">${t.symptom}</th><th class="p-2">${t.treatment}</th><th class="p-2">${t.outcome}</th></tr>
                 </thead>
                 <tbody>
                     ${student360Data.history.clinic.map((v: any) => {
                        const outcomeLabel = v.outcome === 'ReturnToClass' ? t.returnToClass : v.outcome === 'SentHome' ? t.sentHome : v.outcome;
                        return `
                        <tr class="border-b">
                            <td class="p-2">${new Date(v.timestamp).toLocaleDateString(locale)}</td>
                            <td class="p-2">${v.symptom}</td>
                            <td class="p-2">${v.treatment || '-'}</td>
                            <td class="p-2">${outcomeLabel}</td>
                        </tr>
                     `}).join('')}
                 </tbody>
             </table>
             <h3 class="text-lg font-bold mb-4 border-b pb-2">${t.epassLog}</h3>
             ${epassSummaryHTML}
             <table class="w-full text-left text-sm mb-8">
                 <thead class="bg-slate-50">
                     <tr><th class="p-2">${t.date}</th><th class="p-2">Time</th><th class="p-2">${t.destinations}</th><th class="p-2">${t.duration}</th></tr>
                 </thead>
                 <tbody>${epassRows || `<tr><td colspan="4" class="p-2 text-slate-400">${t.noData}</td></tr>`}</tbody>
             </table>
             <h3 class="text-lg font-bold mb-4 border-b pb-2">${t.receptionLog}</h3>
             <table class="w-full text-left text-sm mb-8">
                 <thead class="bg-slate-50">
                     <tr><th class="p-2">${t.date}</th><th class="p-2">Time</th><th class="p-2">${t.type}</th><th class="p-2">${t.reason}</th></tr>
                 </thead>
                 <tbody>${receptionRows || `<tr><td colspan="4" class="p-2 text-slate-400">${t.noData}</td></tr>`}</tbody>
             </table>
             <div class="mt-12 text-center text-xs text-slate-400">Printed from Trackiva School Management System</div>
          </body>
        </html>
      `;
      const win = window.open('', '', 'height=800,width=800');
      if (win) {
          win.document.write(printContent);
          win.document.close();
          setTimeout(() => { win.print(); }, 1000);
      }
  };

  const renderAiCard = () => (
      <Card className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white border-none shadow-lg animate-in fade-in mb-6 no-print">
          <div className="flex items-start gap-4">
              <div className="p-3 bg-white/10 rounded-full shrink-0">
                  <BrainCircuit size={24} className="text-white" />
              </div>
              <div className="flex-1">
                  <div className="flex justify-between items-center mb-2">
                      <h3 className="font-bold text-lg">{t.askAi}</h3>
                      {!aiInsight && (
                          <Button onClick={handleAskAi} disabled={loadingAi} className="bg-white/20 hover:bg-white/30 text-white border-none text-xs">
                              {loadingAi ? t.aiThinking : "Analyze Report"}
                          </Button>
                      )}
                  </div>
                  {aiInsight && <div className="bg-white/10 rounded-lg p-4 text-sm leading-relaxed animate-in slide-in-from-top-2">{aiInsight}</div>}
                  {!aiInsight && !loadingAi && <p className="text-sm text-white/70">Click analyze to get AI-powered insights, trends, and recommendations based on the current report data.</p>}
              </div>
          </div>
      </Card>
  );

  const renderDailySummary = () => {
      const summary = store.getDataSummary(); 
      return (
          <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="border-l-4 border-l-green-500 min-w-0">
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t.onCampus}</p>
                      <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{summary.presentToday + summary.lateToday + summary.earlyLeaveToday}</h3>
                      <p className="text-xs text-slate-400">{((summary.presentToday + summary.lateToday + summary.earlyLeaveToday) / (summary.totalStudents || 1) * 100).toFixed(1)}%</p>
                  </Card>
                  <Card className="border-l-4 border-l-red-500 min-w-0">
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t.absent}</p>
                      <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{summary.totalStudents - (summary.presentToday + summary.lateToday + summary.earlyLeaveToday + summary.excusedAbsentToday)}</h3>
                  </Card>
                  <Card className="border-l-4 border-l-yellow-500 min-w-0">
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t.late}</p>
                      <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{summary.lateToday}</h3>
                  </Card>
                  <Card className="border-l-4 border-l-blue-500 min-w-0">
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t.clinic} / {t.passes}</p>
                      <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{summary.clinicVisitsToday} / {summary.activePasses}</h3>
                  </Card>
              </div>
              <div className="flex justify-end">
                  <Button onClick={handleExport}><Download size={16} /> {t.exportReport}</Button>
              </div>
          </div>
      );
  };

  const renderAttendanceReports = () => {
      const { data, loading } = reportStates.attendance;
      
      let bucketData: any[] = [];
      let paginatedAbsenteeList: any[] = [];
      let totalAbsenteePages = 0;

      if (data) {
          bucketData = [
              { name: t.bucket1_2, Unexcused: data.attendance.buckets['1-2'], Excused: data.attendance.excusedBuckets['1-2'] },
              { name: t.bucket3_5, Unexcused: data.attendance.buckets['3-5'], Excused: data.attendance.excusedBuckets['3-5'] },
              { name: t.bucket6_9, Unexcused: data.attendance.buckets['6-9'], Excused: data.attendance.excusedBuckets['6-9'] },
              { name: t.bucket10_14, Unexcused: data.attendance.buckets['10-14'], Excused: data.attendance.excusedBuckets['10-14'] },
              { name: t.bucket15plus, Unexcused: data.attendance.buckets['15+'], Excused: data.attendance.excusedBuckets['15+'] },
          ];
          paginatedAbsenteeList = data.attendance.list.slice((absenteePage - 1) * REPORT_ITEMS_PER_PAGE, absenteePage * REPORT_ITEMS_PER_PAGE);
          totalAbsenteePages = Math.ceil(data.attendance.list.length / REPORT_ITEMS_PER_PAGE);
      }

      return (
          <div className="space-y-6 animate-in fade-in">
              <FilterBar tabName="attendance" />
              {loading ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card className="h-80 flex items-center justify-center"><Loader2 className="animate-spin text-slate-300" size={32} /></Card>
                      <Card className="h-80 flex items-center justify-center"><Loader2 className="animate-spin text-slate-300" size={32} /></Card>
                  </div>
              ) : data ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card className="min-w-0">
                          <h3 className="font-bold mb-4 text-slate-700 dark:text-slate-200">{t.absentBuckets}</h3>
                          <div className="h-64 w-full relative">
                              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                                  <BarChart data={bucketData}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                      <XAxis dataKey="name" fontSize={10} />
                                      <YAxis />
                                      <Tooltip />
                                      <Legend />
                                      <Bar dataKey="Unexcused" fill="#ef4444" name={t.unexcused} />
                                      <Bar dataKey="Excused" fill="#3b82f6" name={t.excused} />
                                  </BarChart>
                              </ResponsiveContainer>
                          </div>
                      </Card>
                      
                      <Card className="min-w-0 flex flex-col">
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-700 dark:text-slate-200">{t.absenteeList}</h3>
                            <Button variant="secondary" className="text-xs h-8" onClick={handleExport}><Download size={14} /></Button>
                          </div>
                          <div className="flex-1 overflow-y-auto min-h-[200px] relative">
                              <table className="w-full text-sm text-start">
                                  <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800 sticky top-0">
                                      <tr>
                                          <th className="px-3 py-2 text-start">{t.studentName}</th>
                                          <th className="px-3 py-2 text-start">{t.grade}</th>
                                          <th className="px-3 py-2 text-center">Days</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                      {paginatedAbsenteeList.map((s: any) => (
                                          <tr key={s.id} className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                              <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{lang === 'en' ? s.name_en : s.name_ar}</td>
                                              <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{s.grade}-{s.section}</td>
                                              <td className={`px-3 py-2 text-center font-bold ${s.daysAbsent >= 15 ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                  {s.daysAbsent}
                                              </td>
                                          </tr>
                                      ))}
                                      {paginatedAbsenteeList.length === 0 && (
                                          <tr><td colSpan={3} className="text-center py-8 text-slate-400">No absentees found for selected period</td></tr>
                                      )}
                                  </tbody>
                              </table>
                          </div>
                          <Pagination 
                              currentPage={absenteePage}
                              totalPages={totalAbsenteePages}
                              onPageChange={setAbsenteePage}
                              className="mt-2"
                              isRTL={lang === 'ar'}
                          />
                      </Card>
                  </div>
              ) : (
                  <div className="h-80 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/50">
                      <MousePointerClick size={48} className="mb-4 opacity-20" />
                      <p>{t.clickToGenerate}</p>
                  </div>
              )}
          </div>
      );
  };

  const renderClinicReports = () => {
      const { data, loading } = reportStates.clinic;
      
      let chartData: any[] = [];
      let gradeData: any[] = [];

      if (data) {
          const symptoms: Record<string, number> = {};
          const grades: Record<string, number> = {};
          
          data.clinic.forEach((v: any) => {
              symptoms[v.symptom] = (symptoms[v.symptom] || 0) + 1;
              const s = students.find(stu => stu.id === v.studentId);
              if (s) {
                 grades[s.grade] = (grades[s.grade] || 0) + 1;
              }
          });

          chartData = Object.entries(symptoms).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
          gradeData = Object.entries(grades).map(([name, value]) => ({ name, value })).sort((a,b) => a.name.localeCompare(b.name));
      }

      return (
          <div className="space-y-6 animate-in fade-in">
              <FilterBar tabName="clinic" />
              {loading ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card className="h-80 flex items-center justify-center"><Loader2 className="animate-spin text-slate-300" size={32} /></Card>
                      <Card className="h-80 flex items-center justify-center"><Loader2 className="animate-spin text-slate-300" size={32} /></Card>
                  </div>
              ) : data ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card className="min-w-0">
                          <h3 className="font-bold mb-4 text-slate-700 dark:text-slate-200">{t.topComplaints}</h3>
                          <div className="h-80 w-full relative">
                              {chartData.length === 0 && (
                                  <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm font-medium bg-white/50 dark:bg-slate-800/50 z-10">
                                      No clinic visits recorded
                                  </div>
                              )}
                              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                                  <BarChart data={chartData} layout="vertical">
                                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                      <XAxis type="number" />
                                      <YAxis dataKey="name" type="category" width={120} fontSize={12} />
                                      <Tooltip />
                                      <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                                  </BarChart>
                              </ResponsiveContainer>
                          </div>
                      </Card>

                      <Card className="min-w-0">
                          <h3 className="font-bold mb-4 text-slate-700 dark:text-slate-200">{t.visitsByGrade}</h3>
                          <div className="h-80 w-full relative">
                              {gradeData.length === 0 && (
                                  <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm font-medium bg-white/50 dark:bg-slate-800/50 z-10">
                                      No clinic visits recorded
                                  </div>
                              )}
                              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                                  <BarChart data={gradeData}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                      <XAxis dataKey="name" fontSize={12} />
                                      <YAxis allowDecimals={false} />
                                      <Tooltip />
                                      <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                  </BarChart>
                              </ResponsiveContainer>
                          </div>
                      </Card>
                  </div>
              ) : (
                  <div className="h-80 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/50">
                      <MousePointerClick size={48} className="mb-4 opacity-20" />
                      <p>{t.clickToGenerate}</p>
                  </div>
              )}
          </div>
      );
  };

  const renderEPassReports = () => {
      const { data, loading } = reportStates.epass;
      
      return (
          <div className="space-y-6 animate-in fade-in">
              <FilterBar tabName="epass" />
              {loading ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card className="h-80 flex items-center justify-center"><Loader2 className="animate-spin text-slate-300" size={32} /></Card>
                      <Card className="h-80 flex items-center justify-center"><Loader2 className="animate-spin text-slate-300" size={32} /></Card>
                  </div>
              ) : data ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card className="min-w-0">
                          <h3 className="font-bold mb-4 text-slate-700 dark:text-slate-200">{t.topEPassUsers}</h3>
                          <ul className="space-y-2">
                              {data.epass.topUsers.map((item: any, i: number) => (
                                  <li key={i} className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded">
                                      <span className="text-slate-700 dark:text-slate-200">{lang === 'en' ? item.student.name_en : item.student.name_ar}</span>
                                      <Badge color="blue">{item.count}</Badge>
                                  </li>
                              ))}
                              {data.epass.topUsers.length === 0 && <li className="text-center text-slate-400 p-4">No passes found</li>}
                          </ul>
                      </Card>
                      <Card className="min-w-0">
                           <h3 className="font-bold mb-4 text-slate-700 dark:text-slate-200">{t.topUnauthorized}</h3>
                           <ul className="space-y-2">
                              {data.epass.topUnauthorized.map((item: any, i: number) => (
                                  <li key={i} className="flex justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-700 dark:text-red-300">
                                      <span>{lang === 'en' ? item.student.name_en : item.student.name_ar}</span>
                                      <Badge color="red">{item.count}</Badge>
                                  </li>
                              ))}
                              {data.epass.topUnauthorized.length === 0 && <li className="text-center text-slate-400 p-4">No unauthorized exits found</li>}
                          </ul>
                      </Card>
                  </div>
              ) : (
                  <div className="h-80 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/50">
                      <MousePointerClick size={48} className="mb-4 opacity-20" />
                      <p>{t.clickToGenerate}</p>
                  </div>
              )}
          </div>
      );
  };

  const renderReceptionReports = () => {
      const { data, loading } = reportStates.reception;
      
      let paginatedReception: any[] = [];
      let totalReceptionPages = 0;

      if (data) {
          paginatedReception = data.reception.slice((receptionPage - 1) * REPORT_ITEMS_PER_PAGE, receptionPage * REPORT_ITEMS_PER_PAGE);
          totalReceptionPages = Math.ceil(data.reception.length / REPORT_ITEMS_PER_PAGE);
      }

      return (
          <div className="space-y-6 animate-in fade-in">
              <FilterBar tabName="reception" />
              {loading ? (
                  <Card className="h-[500px] flex items-center justify-center"><Loader2 className="animate-spin text-slate-300" size={32} /></Card>
              ) : data ? (
                  <Card className="min-w-0 flex flex-col h-[500px]">
                      <h3 className="font-bold mb-4 text-slate-700 dark:text-slate-200">{t.receptionReport}</h3>
                       <div className="overflow-y-auto flex-1">
                           <table className="w-full text-sm text-start">
                               <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800 sticky top-0">
                                   <tr>
                                       <th className="px-4 py-3 text-start">{t.date}</th>
                                       <th className="px-4 py-3 text-start">{t.studentName}</th>
                                       <th className="px-4 py-3 text-start">{t.grade}</th>
                                       <th className="px-4 py-3 text-start">{t.section}</th>
                                       <th className="px-4 py-3 text-start">{t.type}</th>
                                       <th className="px-4 py-3 text-start">{t.reason}</th>
                                   </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                   {paginatedReception.map((log: any) => {
                                       const s = students.find(st => st.id === log.studentId);
                                       return (
                                           <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                               <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{new Date(log.timestamp).toLocaleString()}</td>
                                               <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{s ? (lang === 'en' ? s.name_en : s.name_ar) : 'Unknown'}</td>
                                               <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s ? s.grade : '-'}</td>
                                               <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s ? s.section : '-'}</td>
                                               <td className="px-4 py-3">
                                                   <Badge color={log.type === 'LateArrival' ? 'blue' : 'orange'}>
                                                       {log.type === 'LateArrival' ? t.lateArrival : t.earlyLeave}
                                                   </Badge>
                                               </td>
                                               <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{log.reason || '-'}</td>
                                           </tr>
                                       );
                                   })}
                                   {data.reception.length === 0 && (
                                       <tr><td colSpan={6} className="text-center py-8 text-slate-400">No records found for selected period</td></tr>
                                   )}
                               </tbody>
                           </table>
                       </div>
                       <Pagination 
                           currentPage={receptionPage}
                           totalPages={totalReceptionPages}
                           onPageChange={setReceptionPage}
                           className="mt-4 border-t border-slate-100 dark:border-slate-700 pt-2"
                           isRTL={lang === 'ar'}
                       />
                  </Card>
              ) : (
                  <div className="h-80 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/50">
                      <MousePointerClick size={48} className="mb-4 opacity-20" />
                      <p>{t.clickToGenerate}</p>
                  </div>
              )}
          </div>
      );
  };

  const renderStudent360 = () => {
      const locale = lang === 'ar' ? 'ar-EG' : 'en-US';
      return (
          <div>
              <div className="flex flex-col lg:flex-row gap-4 mb-6">
                  <div className="flex-1 relative z-10">
                      <Search className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${lang === 'ar' ? 'right-3' : 'left-3'}`} size={20} />
                      <Input 
                          placeholder={t.searchStudent} 
                          className={`${lang === 'ar' ? 'pr-10' : 'pl-10'} h-12 text-base bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm rounded-xl`}
                          value={search360}
                          onChange={e => { setSearch360(e.target.value); setStudent360(null); }}
                      />
                      {search360 && !student360 && (
                          <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl mt-1 z-10 max-h-60 overflow-y-auto">
                              {students.filter(s => s.name_en.toLowerCase().includes(search360.toLowerCase()) || s.studentNumber.includes(search360)).map(s => (
                                  <button 
                                      key={s.id}
                                      onClick={() => { 
                                          const load360 = async () => {
                                              // For 360 view, we need ALL data types, so we don't limit types
                                              const fetchedData = await store.fetchDataForRange(student360StartDate, student360EndDate, { cache: false });
                                              const sData = store.getStudent360Data(s.id, student360StartDate, student360EndDate, fetchedData);
                                              setStudent360Data(sData);
                                              setStudent360(s); 
                                              setSearch360(lang === 'en' ? s.name_en : s.name_ar); 
                                          };
                                          load360();
                                      }}
                                      className="w-full text-start px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-200 border-b border-slate-50 dark:border-slate-700 last:border-0"
                                  >
                                      <div className="font-bold">{lang === 'en' ? s.name_en : s.name_ar}</div>
                                      <div className="text-xs text-slate-500 dark:text-slate-400">{s.studentNumber} - {s.grade} {s.section}</div>
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>
                  
                  <div className="bg-white dark:bg-slate-800 px-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4 h-12 shrink-0">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.dateRange}</span>
                      <div className="h-6 w-px bg-slate-100 dark:bg-slate-700"></div>
                      <div className="flex items-center gap-2">
                          <input 
                              type="date" 
                              value={student360StartDate} 
                              onChange={e => setStudent360StartDate(e.target.value)}
                              className="text-sm font-medium bg-transparent border-none p-0 text-slate-700 dark:text-slate-200 focus:ring-0 outline-none"
                          />
                          <span className="text-slate-400">-</span>
                          <input 
                              type="date" 
                              value={student360EndDate} 
                              onChange={e => setStudent360EndDate(e.target.value)}
                              className="text-sm font-medium bg-transparent border-none p-0 text-slate-700 dark:text-slate-200 focus:ring-0 outline-none"
                          />
                      </div>
                  </div>
              </div>

              {student360 && student360Data && (
                  <div className="space-y-6 animate-in fade-in">
                       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                           <div className="flex items-center gap-6">
                               <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-300">
                                   <UserIcon size={40} />
                                </div>
                               <div>
                                   <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{lang === 'en' ? student360.name_en : student360.name_ar}</h2>
                                   <div className="flex flex-wrap gap-2 mt-2">
                                       <Badge color="blue" className="text-sm">{student360.grade}-{student360.section}</Badge>
                                       <Badge color="gray" className="text-sm font-mono">#{student360.studentNumber}</Badge>
                                       <Badge color="gray" className="text-sm">{student360.gender}</Badge>
                                       {student360.isWatchlisted && <Badge color="red" className="text-sm font-bold">{t.watchlist}</Badge>}
                                   </div>
                               </div>
                           </div>
                           <Button variant="secondary" onClick={handlePrint360}><Printer size={18} /> {t.printProfile}</Button>
                       </div>

                       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                           <Card className="lg:col-span-1 flex flex-col min-w-0">
                               <div className="mb-2">
                                   <h3 className="font-bold text-slate-700 dark:text-slate-200 uppercase text-sm tracking-wider">{t.attendanceReportTitle}</h3>
                               </div>
                               <div className="h-[260px] w-full relative">
                                   <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                                       <PieChart>
                                           <Pie 
                                               data={pieData} 
                                               innerRadius={60} 
                                               outerRadius={80} 
                                               paddingAngle={5} 
                                               dataKey="value"
                                           >
                                               {pieData.map((entry, index) => (
                                                   <Cell key={`cell-${index}`} fill={entry.name === t.absent ? '#ef4444' : entry.name === t.excused ? '#3b82f6' : '#22c55e'} />
                                               ))}
                                           </Pie>
                                           <Legend 
                                              verticalAlign="bottom" 
                                              height={36} 
                                              iconType="circle" 
                                              formatter={(value, entry: any) => (
                                                <span className="text-slate-600 dark:text-slate-300 font-medium ml-1">
                                                  {value} ({entry.payload.value} {lang === 'en' ? 'days' : 'أيام'})
                                                </span>
                                              )}
                                           />
                                       </PieChart>
                                   </ResponsiveContainer>
                                   <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pb-8">
                                        <span className="text-3xl font-bold text-slate-800 dark:text-white">{presentPct}%</span>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t.present}</p>
                                   </div>
                               </div>
                           </Card>
                           
                           <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                               <Card className="flex flex-col justify-center items-center p-4 min-w-0">
                                   <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">{t.clinic}</p>
                                   <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{student360Data.history.clinic.length}</span>
                               </Card>
                               
                               <Card className="flex flex-col justify-center items-center p-4 min-w-0 relative group hover:shadow-md transition-shadow cursor-default">
                                   <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">{t.epassReport}</p>
                                   <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">{student360Data.history.epasses.length}</span>
                                   
                                   <div className="w-full mt-2 space-y-1">
                                       {Object.entries(epassStats)
                                           .sort((a, b) => b[1] - a[1]) 
                                           .slice(0, 3)
                                           .map(([type, count]: any) => (
                                           <div key={type} className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700 pb-0.5 last:border-0">
                                               <span className="truncate max-w-[80px]" title={type}>{type}</span>
                                               <span className="font-bold">{count}</span>
                                           </div>
                                       ))}
                                       {Object.keys(epassStats).length > 3 && (
                                           <div className="text-[10px] text-center text-slate-400 pt-1">+{Object.keys(epassStats).length - 3} {t.more}</div>
                                       )}
                                   </div>
                                   
                                   {Object.keys(epassStats).length > 0 && (
                                       <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-3 z-20 hidden group-hover:block">
                                           <p className="text-xs font-bold mb-2 text-slate-700 dark:text-slate-200 border-b pb-1">{t.destinationBreakdown}</p>
                                           {Object.entries(epassStats)
                                               .sort((a, b) => b[1] - a[1]) 
                                               .map(([type, count]: any) => (
                                               <div key={type} className="flex justify-between text-xs py-1">
                                                   <span className="text-slate-600 dark:text-slate-300">{type}</span>
                                                   <span className="font-bold text-purple-600 dark:text-purple-400">{count}</span>
                                               </div>
                                           ))}
                                       </div>
                                   )}
                               </Card>

                               <Card className="flex flex-col justify-center items-center p-4 min-w-0">
                                   <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">{t.late}</p>
                                   <span className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{dailyAttendance.filter((d:any) => d.status === t.late).length}</span>
                               </Card>
                               <Card className="flex flex-col justify-center items-center p-4 min-w-0">
                                   <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">{t.earlyLeave}</p>
                                   <span className="text-3xl font-bold text-orange-600 dark:text-orange-400">{dailyAttendance.filter((d:any) => d.status === t.earlyLeave).length}</span>
                               </Card>
                           </div>
                       </div>

                       <div className="border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 overflow-hidden">
                           <button 
                               onClick={() => setShowAttendanceHistory(!showAttendanceHistory)}
                               className="w-full flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                           >
                               <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                                   <Calendar size={20} />
                                   <span>{t.attendanceLogDaily}</span>
                               </div>
                               {showAttendanceHistory ? <ChevronDown size={20} className="text-slate-500" /> : <ChevronRight size={20} className="text-slate-500" />}
                           </button>
                           
                           {showAttendanceHistory && (
                               <div>
                                   <table className="w-full text-start text-sm">
                                       <thead className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                                           <tr>
                                               <th className="px-6 py-3 text-start">{t.date}</th>
                                               <th className="px-6 py-3 text-start">{t.status}</th>
                                               <th className="px-6 py-3 text-start">{t.notes}</th>
                                           </tr>
                                       </thead>
                                       <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                           {paginatedAttendance.length === 0 ? (
                                               <tr><td colSpan={3} className="px-6 py-4 text-center text-slate-400">{t.noData}</td></tr>
                                           ) : (
                                               paginatedAttendance.map((day: any) => (
                                                   <tr key={day.date}>
                                                       <td className="px-6 py-3 text-slate-700 dark:text-slate-300">{new Date(day.date).toLocaleDateString(locale)}</td>
                                                       <td className="px-6 py-3"><Badge color={day.color as any}>{day.status}</Badge></td>
                                                       <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{day.note || '-'}</td>
                                                   </tr>
                                               ))
                                           )}
                                       </tbody>
                                   </table>
                                   <Pagination 
                                       currentPage={attendancePage}
                                       totalPages={totalPages}
                                       onPageChange={setAttendancePage}
                                       className="p-3 border-t border-slate-100 dark:border-slate-700"
                                       isRTL={lang === 'ar'}
                                   />
                               </div>
                           )}
                       </div>

                       <div className="border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 overflow-hidden">
                           <button 
                               onClick={() => setShowClinicHistory(!showClinicHistory)}
                               className="w-full flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                           >
                               <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                                   <Stethoscope size={20} />
                                   <span>{t.clinicHistory}</span>
                               </div>
                               {showClinicHistory ? <ChevronDown size={20} className="text-slate-500" /> : <ChevronRight size={20} className="text-slate-500" />}
                           </button>
                           
                           {showClinicHistory && (
                               <div className="max-h-60 overflow-y-auto">
                                   <table className="w-full text-start text-sm">
                                       <thead className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                                           <tr>
                                               <th className="px-6 py-3 text-start">{t.date}</th>
                                               <th className="px-6 py-3 text-start">{t.symptom}</th>
                                               <th className="px-6 py-3 text-start">{t.treatment}</th>
                                               <th className="px-6 py-3 text-start">{t.outcome}</th>
                                           </tr>
                                       </thead>
                                       <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                           {student360Data.history.clinic.map((v: any) => (
                                               <tr key={v.id}>
                                                   <td className="px-6 py-3 text-slate-700 dark:text-slate-300">{new Date(v.timestamp).toLocaleDateString(locale)}</td>
                                                   <td className="px-6 py-3 text-slate-700 dark:text-slate-300">{v.symptom}</td>
                                                   <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{v.treatment || '-'}</td>
                                                   <td className="px-6 py-3 text-slate-700 dark:text-slate-300">
                                                       {v.outcome === 'ReturnToClass' ? t.returnToClass : v.outcome === 'SentHome' ? t.sentHome : v.outcome}
                                                   </td>
                                               </tr>
                                           ))}
                                           {student360Data.history.clinic.length === 0 && (
                                               <tr><td colSpan={4} className="px-6 py-4 text-center text-slate-400">{t.noData}</td></tr>
                                           )}
                                       </tbody>
                                   </table>
                               </div>
                           )}
                       </div>

                       <div className="border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 overflow-hidden">
                           <button 
                               onClick={() => setShowEPassHistory(!showEPassHistory)}
                               className="w-full flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                           >
                               <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                                   <Ticket size={20} />
                                   <span>{t.epassLog}</span>
                               </div>
                               {showEPassHistory ? <ChevronDown size={20} className="text-slate-500" /> : <ChevronRight size={20} className="text-slate-500" />}
                           </button>
                           
                           {showEPassHistory && (
                               <div>
                                   <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-4 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700">
                                       {Object.entries(epassStats)
                                           .sort((a, b) => b[1] - a[1]) 
                                           .map(([type, count]: any) => (
                                           <div key={type} className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700 text-center shadow-sm">
                                               <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold truncate" title={type}>{type}</div>
                                               <div className="text-lg font-bold text-slate-800 dark:text-slate-200">{count}</div>
                                           </div>
                                       ))}
                                   </div>

                                   <table className="w-full text-start text-sm">
                                       <thead className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                                           <tr>
                                               <th className="px-6 py-3 text-start">{t.date}</th>
                                               <th className="px-6 py-3 text-start">Time</th>
                                               <th className="px-6 py-3 text-start">{t.type}</th>
                                               <th className="px-6 py-3 text-start">{t.issuedBy}</th>
                                               <th className="px-6 py-3 text-start">{t.duration}</th>
                                           </tr>
                                       </thead>
                                       <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                           {paginatedEPasses.length === 0 ? (
                                               <tr><td colSpan={5} className="px-6 py-4 text-center text-slate-400">{t.noData}</td></tr>
                                           ) : (
                                               paginatedEPasses.map((p: any) => {
                                                   const issuer = store.getUser(p.teacherId)?.name || 'Unknown';
                                                   let destName = p.type;
                                                   if (p.type !== 'UNAUTHORIZED') {
                                                       const d = store.getDestinations().find(dest => dest.id === p.type);
                                                       if (d) destName = lang === 'en' ? d.label_en : d.label_ar;
                                                   } else {
                                                       destName = t.unauthorized;
                                                   }

                                                   return (
                                                       <tr key={p.id}>
                                                           <td className="px-6 py-3 text-slate-700 dark:text-slate-300">{new Date(p.startTime).toLocaleDateString(locale)}</td>
                                                           <td className="px-6 py-3 font-mono text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                                                               {new Date(p.startTime).toLocaleTimeString(locale, {hour: '2-digit', minute:'2-digit'})}
                                                           </td>
                                                           <td className="px-6 py-3">
                                                               {p.type === 'UNAUTHORIZED' ? <span className="text-red-600 font-bold text-xs bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">{t.unauthorized}</span> : <Badge color="blue">{destName}</Badge>}
                                                           </td>
                                                           <td className="px-6 py-3 text-slate-600 dark:text-slate-300 text-xs">{issuer}</td>
                                                           <td className="px-6 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">
                                                               {p.endTime ? Math.floor((p.endTime - p.startTime) / 60000) + (lang === 'ar' ? ' دقيقة' : ' mins') : <span className="text-green-600 dark:text-green-400 font-bold animate-pulse">Active</span>}
                                                           </td>
                                                       </tr>
                                                   );
                                               })
                                           )}
                                       </tbody>
                                   </table>
                                   <Pagination 
                                       currentPage={epassPage}
                                       totalPages={totalEpassPages}
                                       onPageChange={setEpassPage}
                                       className="p-3 border-t border-slate-100 dark:border-slate-700"
                                       isRTL={lang === 'ar'}
                                   />
                               </div>
                           )}
                       </div>

                       <div className="border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 overflow-hidden">
                           <button 
                               onClick={() => setShowReceptionHistory(!showReceptionHistory)}
                               className="w-full flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                           >
                               <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                                   <DoorOpen size={20} />
                                   <span>{t.receptionLog}</span>
                               </div>
                               {showReceptionHistory ? <ChevronDown size={20} className="text-slate-500" /> : <ChevronRight size={20} className="text-slate-500" />}
                           </button>
                           
                           {showReceptionHistory && (
                               <div className="max-h-60 overflow-y-auto">
                                   <table className="w-full text-start text-sm">
                                       <thead className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                                           <tr>
                                               <th className="px-6 py-3 text-start">{t.date}</th>
                                               <th className="px-6 py-3 text-start">{t.type}</th>
                                               <th className="px-6 py-3 text-start">{t.reason}</th>
                                           </tr>
                                       </thead>
                                       <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                           {student360Data.history.reception.map((l: any) => (
                                               <tr key={l.id}>
                                                   <td className="px-6 py-3 text-slate-700 dark:text-slate-300">{new Date(l.timestamp).toLocaleDateString(locale)}</td>
                                                   <td className="px-6 py-3">
                                                       <Badge color={l.type === 'LateArrival' ? 'blue' : 'orange'}>
                                                           {l.type === 'LateArrival' ? t.lateArrival : t.earlyLeave}
                                                       </Badge>
                                                   </td>
                                                   <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{l.reason || '-'}</td>
                                               </tr>
                                           ))}
                                           {student360Data.history.reception.length === 0 && (
                                               <tr><td colSpan={3} className="px-6 py-4 text-center text-slate-400">{t.noData}</td></tr>
                                           )}
                                       </tbody>
                                   </table>
                               </div>
                           )}
                       </div>
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className="space-y-6 pb-12">
      <Card>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg inline-flex mb-0 overflow-x-auto max-w-full">
            {TABS.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-bold whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    <tab.icon size={16} />
                    {(t as any)[tab.labelKey]}
                </button>
            ))}
        </div>
      </Card>

      {activeTab === 'daily' && renderDailySummary()}
      
      {activeTab !== 'daily' && (
          <>
              {activeTab !== 'student360' && renderAiCard()}
              {activeTab === 'attendance' && renderAttendanceReports()}
              {activeTab === 'clinic' && renderClinicReports()}
              {activeTab === 'epass' && renderEPassReports()}
              {activeTab === 'reception' && renderReceptionReports()}
              {activeTab === 'student360' && renderStudent360()}
          </>
      )}
    </div>
  );
};
