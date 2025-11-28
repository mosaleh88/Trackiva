import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Badge, Pagination } from './ui';
import { store } from '../services/store';
import { generateSchoolInsights } from '../services/geminiService';
import { Language, Student, User } from '../types';
import { TRANSLATIONS } from '../constants';
import { BarChart3, Calendar, Download, Filter, Search, User as UserIcon, LayoutDashboard, Activity, Ticket, DoorOpen, ChevronDown, ChevronRight, Printer, Stethoscope, Clock, AlertTriangle, CheckCircle2, ArrowRight, BrainCircuit, UserCheck, Loader2, MousePointerClick, ArrowUpDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, Label } from 'recharts/lib';
import * as XLSX from 'xlsx';

interface ReportsProps {
  lang: Language;
  currentUser: User | null;
}

const COLORS = ['#22c55e', '#3b82f6', '#ef4444', '#f59e0b', '#f97316'];

const TABS = [
  { id: 'daily', labelKey: 'dailySummary', label: 'Summary', icon: LayoutDashboard },
  { id: 'attendance', labelKey: 'attendanceReport', label: 'Attendance', icon: BarChart3 },
  { id: 'clinic', labelKey: 'clinicReport', label: 'Clinic', icon: Stethoscope },
  { id: 'epass', labelKey: 'epassReport', label: 'E-Pass', icon: Ticket },
  { id: 'reception', labelKey: 'receptionReport', label: 'Reception', icon: DoorOpen },
  { id: 'student360', labelKey: 'student360', label: 'Student 360', icon: UserIcon },
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
  // Selected student for search (not yet generated)
  const [selectedSearchStudent, setSelectedSearchStudent] = useState<Student | null>(null);
  // Generated report student and data
  const [student360, setStudent360] = useState<Student | null>(null);
  const [student360Data, setStudent360Data] = useState<any>(null);
  const [isGenerating360, setIsGenerating360] = useState(false);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  
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
  // Term Statistics State
  const [termSummaries, setTermSummaries] = useState<any[]>([]);
  
  // Pagination States
  const [attendancePage, setAttendancePage] = useState(1);
  const [epassPage, setEpassPage] = useState(1);
  const [absenteePage, setAbsenteePage] = useState(1);
  const [receptionPage, setReceptionPage] = useState(1);
  const [fullListPage, setFullListPage] = useState(1);
  const [lateListPage, setLateListPage] = useState(1);
  const [logsPage, setLogsPage] = useState(1);

  // AI Analyst State
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  
  // 360 View Collapsibles
  const [showAttendanceHistory, setShowAttendanceHistory] = useState(true);
  const [showClinicHistory, setShowClinicHistory] = useState(false);
  const [showEPassHistory, setShowEPassHistory] = useState(false);
  const [showReceptionHistory, setShowReceptionHistory] = useState(false);

  // Attendance Report Specific State
  const [includeExcusedInBuckets, setIncludeExcusedInBuckets] = useState(false);
  const [attendanceSortConfig, setAttendanceSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'name_en', direction: 'asc' });
  const [absenteeSearch, setAbsenteeSearch] = useState(""); // Local search for Absentee List
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null); // For detailed breakdown

  const settings = store.getSettings();
  const attendanceConfig = settings.attendanceSettings;

  // Initial Student Load & Term Stats
  useEffect(() => {
      if (currentUser) {
          setStudents(store.getStudentsForUser(currentUser.id));
      }
      // Load Term Stats independently
      const loadTerms = async () => {
          const stats = await store.getYearlyTermStats();
          setTermSummaries(stats);
      };
      loadTerms();
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
          if (tab === 'attendance') {
              setAbsenteePage(1);
              setFullListPage(1);
              setLateListPage(1);
              setLogsPage(1); 
              setSelectedBucket(null); // Reset bucket selection
          }
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

  const handleGenerate360 = async () => {
      if (!selectedSearchStudent) return;
      
      setIsGenerating360(true);
      try {
          // For 360 view, we need all data types
          const fetchedData = await store.fetchDataForRange(student360StartDate, student360EndDate, { cache: false });
          const sData = store.getStudent360Data(selectedSearchStudent.id, student360StartDate, student360EndDate, fetchedData);
          setStudent360Data(sData);
          setStudent360(selectedSearchStudent);
      } catch (e) {
          console.error("Error generating 360 report", e);
      } finally {
          setIsGenerating360(false);
      }
  };

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

  const presentPct = useMemo(() => {
      const totalScheduled = store.countSchoolDays(student360StartDate, student360EndDate);
      const denominator = totalScheduled > 0 ? totalScheduled : 1;
      
      // Calculate total weighted absences from the processed daily records
      let totalAbsenceWeight = 0;
      dailyAttendance.forEach((day: any) => {
          if (day.status.startsWith(t.absent)) {
              totalAbsenceWeight += day.weight;
          } else if (day.status === t.excused) {
              totalAbsenceWeight += 1;
          }
      });

      const estimatedPresent = Math.max(0, totalScheduled - totalAbsenceWeight);
      
      let pct = Math.round((estimatedPresent / denominator) * 100);
      return Math.min(100, Math.max(0, isNaN(pct) ? 0 : pct));
  }, [dailyAttendance, student360StartDate, student360EndDate, t, settings.academicCalendar]);

  const pieData = useMemo(() => {
      const totalScheduled = store.countSchoolDays(student360StartDate, student360EndDate);
      
      const weightedAbsent = dailyAttendance.reduce((acc, d) => d.status.startsWith(t.absent) ? acc + d.weight : acc, 0);
      const countExcused = dailyAttendance.filter(d => d.status === t.excused).length;
      
      const calculatedPresent = Math.max(0, totalScheduled - weightedAbsent - countExcused);
      
      return [
          { name: t.present, value: calculatedPresent },
          { name: t.excused, value: countExcused },
          { name: t.absent, value: weightedAbsent }
      ].filter(d => d.value > 0);
  }, [dailyAttendance, t, student360StartDate, student360EndDate, settings.academicCalendar]);

  // MOVED USEMEMO TO TOP LEVEL TO FIX REACT ERROR #310
  const attendanceData = reportStates.attendance.data;
  const selectedBucketStudents = useMemo(() => {
      if (!selectedBucket || !attendanceData || !attendanceData.attendance?.comprehensiveList) return [];
      
      return attendanceData.attendance.comprehensiveList.filter((s: any) => {
          const count = includeExcusedInBuckets ? (s.stats.A + s.stats.EA) : s.stats.A;
          if (selectedBucket === '1-2') return count >= 1 && count <= 2;
          if (selectedBucket === '3-5') return count >= 3 && count <= 5;
          if (selectedBucket === '6-9') return count >= 6 && count <= 9;
          if (selectedBucket === '10-14') return count >= 10 && count <= 14;
          if (selectedBucket === '15+') return count >= 15;
          return false;
      });
  }, [selectedBucket, attendanceData, includeExcusedInBuckets]);

  const handleExport = (dataToExport: any[], filename: string) => {
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const handleAttendanceSort = (key: string) => {
      setAttendanceSortConfig(current => {
          if (current.key === key && current.direction === 'asc') {
              return { key, direction: 'desc' };
          }
          return { key, direction: 'asc' };
      });
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

            <Button onClick={() => generateReport(tabName)} className="h-[38px] bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200 dark:shadow-none" disabled={state.loading}>
                {state.loading ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                {t.generate}
            </Button>

            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-2 self-center hidden lg:block"></div>

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
      alert("Print started");
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
              {/* Term Percentage Cards (Moved here) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {termSummaries.length > 0 ? (
                      termSummaries.map((term: any) => (
                          <Card key={term.id} className="flex flex-col items-center justify-center py-6 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{term.name}</span>
                              <span className="text-3xl font-bold text-slate-800 dark:text-white">{term.percentage}%</span>
                              <span className="text-[10px] text-slate-400">{term.startDate} - {term.endDate}</span>
                          </Card>
                      ))
                  ) : (
                      <div className="col-span-3 text-center text-slate-400 italic py-4">Loading term statistics...</div>
                  )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="border-l-4 border-l-green-500 min-w-0">
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t.onCampus}</p>
                      <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{summary.presentToday + summary.lateToday + summary.earlyLeaveToday}</h3>
                      <p className="text-xs text-slate-400">{((summary.presentToday + summary.lateToday + summary.earlyLeaveToday) / (summary.totalStudents || 1) * 100).toFixed(1)}%</p>
                  </Card>
                  {/* Add more summary cards here as needed */}
              </div>
          </div>
      );
  };

  const renderAttendanceReports = () => {
      const { data, loading } = reportStates.attendance;
      if (loading) return <div className="space-y-6 animate-in fade-in"><FilterBar tabName="attendance" /><div className="h-80 flex items-center justify-center"><Loader2 className="animate-spin text-slate-300" size={32} /></div></div>;
      if (!data) return <div className="space-y-6 animate-in fade-in"><FilterBar tabName="attendance" /><div className="h-80 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl"><MousePointerClick size={48} className="mb-4 opacity-20" /><p>{t.clickToGenerate}</p></div></div>;

      const bucketData = [
          { name: t.bucket1_2, Unexcused: data.attendance.buckets['1-2'], Excused: data.attendance.excusedBuckets['1-2'], label: t.bucket1_2 },
          { name: t.bucket3_5, Unexcused: data.attendance.buckets['3-5'], Excused: data.attendance.excusedBuckets['3-5'], label: t.bucket3_5 },
          { name: t.bucket6_9, Unexcused: data.attendance.buckets['6-9'], Excused: data.attendance.excusedBuckets['6-9'], label: t.bucket6_9 },
          { name: t.bucket10_14, Unexcused: data.attendance.buckets['10-14'], Excused: data.attendance.excusedBuckets['10-14'], label: t.bucket10_14 },
          { name: t.bucket15plus, Unexcused: data.attendance.buckets['15+'], Excused: data.attendance.excusedBuckets['15+'], label: t.bucket15plus },
      ];

      // 1. Logs Pagination
      const logs = data.attendance.logs || [];
      const paginatedLogs = logs.slice((logsPage - 1) * REPORT_ITEMS_PER_PAGE, logsPage * REPORT_ITEMS_PER_PAGE);
      const totalLogsPages = Math.ceil(logs.length / REPORT_ITEMS_PER_PAGE);

      // 3. Full List Sorting, Filtering & Pagination
      let filteredFullList = [...data.attendance.comprehensiveList];
      if (absenteeSearch) {
          const lower = absenteeSearch.toLowerCase();
          filteredFullList = filteredFullList.filter((s: any) => 
              s.name_en.toLowerCase().includes(lower) || 
              s.name_ar.includes(lower) || 
              s.studentNumber.includes(lower)
          );
      }

      const sortedFullList = filteredFullList.sort((a: any, b: any) => {
          const { key, direction } = attendanceSortConfig;
          let valA = key === 'attendancePercentage' || key.startsWith('stats') ? (key.includes('.') ? a.stats[key.split('.')[1]] : a[key]) : a[key];
          let valB = key === 'attendancePercentage' || key.startsWith('stats') ? (key.includes('.') ? b.stats[key.split('.')[1]] : b[key]) : b[key];
          if (key === 'grade') { return direction === 'asc' ? a.grade.localeCompare(b.grade, undefined, {numeric: true}) : b.grade.localeCompare(a.grade, undefined, {numeric: true}); }
          if (valA < valB) return direction === 'asc' ? -1 : 1;
          if (valA > valB) return direction === 'asc' ? 1 : -1;
          return 0;
      });
      const paginatedFullList = sortedFullList.slice((fullListPage - 1) * REPORT_ITEMS_PER_PAGE, fullListPage * REPORT_ITEMS_PER_PAGE);
      const totalFullListPages = Math.ceil(sortedFullList.length / REPORT_ITEMS_PER_PAGE);

      // 4. Absentee Report Buckets Summary
      const absenteeSummary = [
          { id: '1-2', label: t.bucket1_2, count: includeExcusedInBuckets ? data.attendance.buckets['1-2'] + data.attendance.excusedBuckets['1-2'] : data.attendance.buckets['1-2'] },
          { id: '3-5', label: t.bucket3_5, count: includeExcusedInBuckets ? data.attendance.buckets['3-5'] + data.attendance.excusedBuckets['3-5'] : data.attendance.buckets['3-5'] },
          { id: '6-9', label: t.bucket6_9, count: includeExcusedInBuckets ? data.attendance.buckets['6-9'] + data.attendance.excusedBuckets['6-9'] : data.attendance.buckets['6-9'] },
          { id: '10-14', label: t.bucket10_14, count: includeExcusedInBuckets ? data.attendance.buckets['10-14'] + data.attendance.excusedBuckets['10-14'] : data.attendance.buckets['10-14'] },
          { id: '15+', label: t.bucket15plus, count: includeExcusedInBuckets ? data.attendance.buckets['15+'] + data.attendance.excusedBuckets['15+'] : data.attendance.buckets['15+'], isFlag: true },
      ];

      // 5. Late List
      const lateList = sortedFullList.filter((s: any) => s.stats.L > 0).sort((a: any, b: any) => b.stats.L - a.stats.L);
      const paginatedLateList = lateList.slice((lateListPage - 1) * REPORT_ITEMS_PER_PAGE, lateListPage * REPORT_ITEMS_PER_PAGE);
      const totalLateListPages = Math.ceil(lateList.length / REPORT_ITEMS_PER_PAGE);

      // Average Calculation
      const averagePct = sortedFullList.length ? Math.round(sortedFullList.reduce((acc: number, curr: any) => acc + curr.attendancePercentage, 0) / sortedFullList.length) : 0;

      return (
          <div className="space-y-8 animate-in fade-in">
              <FilterBar tabName="attendance" />

              {/* 1. Attendance Logs (Daily) */}
              <Card className="border-t-4 border-t-blue-500">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-slate-800 dark:text-white">{t.attendanceLogDaily}</h3>
                      <Button variant="secondary" size="sm" onClick={() => handleExport(logs, 'Daily_Logs')}>
                          <Download size={16} className="mr-2" /> Export
                      </Button>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-start">
                          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold uppercase text-xs">
                              <tr>
                                  <th className="p-3 text-start">{t.date}</th>
                                  <th className="p-3 text-start">{t.studentName}</th>
                                  <th className="p-3 text-start">{t.status}</th>
                                  <th className="p-3 text-start">{t.reason}</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                              {paginatedLogs.map((log: any) => (
                                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                      <td className="p-3 text-slate-600 dark:text-slate-300">{new Date(log.date).toLocaleDateString()}</td>
                                      <td className="p-3 font-bold text-slate-800 dark:text-white">{lang === 'en' ? log.student.name_en : log.student.name_ar}</td>
                                      <td className="p-3">
                                          {log.status === 'Present' && (
                                              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-md font-bold text-xs">Present</span>
                                          )}
                                          {log.status === 'Absent (Excused)' && (
                                              <span className="bg-red-100 text-red-700 px-3 py-1 rounded-md font-bold text-xs">Absent (Excused)</span>
                                          )}
                                          {log.status === 'Absent (Unexcused)' && (
                                              <span className="bg-red-100 text-red-700 px-3 py-1 rounded-md font-bold text-xs">Absent (Unexcused)</span>
                                          )}
                                          {log.status === 'Late' && (
                                              <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-md font-bold text-xs">Late</span>
                                          )}
                                          {log.status === 'Early Leave' && (
                                              <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-md font-bold text-xs">Early Leave</span>
                                          )}
                                      </td>
                                      <td className="p-3 text-slate-500 italic">{log.reason || '-'}</td>
                                  </tr>
                              ))}
                              {paginatedLogs.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-400">No logs found</td></tr>}
                          </tbody>
                      </table>
                  </div>
                  <Pagination currentPage={logsPage} totalPages={totalLogsPages} onPageChange={setLogsPage} className="p-4" />
              </Card>

              {/* 2. Attendance Percentage (Just Selected Range) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 flex flex-col items-center justify-center py-6">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-300 uppercase tracking-wider mb-1">Selected Range</span>
                      <span className="text-4xl font-bold text-slate-800 dark:text-white">{isNaN(averagePct) ? 0 : averagePct}%</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">Average Attendance</span>
                  </Card>
                  {/* Term Cards moved to Summary Tab */}
              </div>

              {/* 3. Absentee List (Full List) */}
              <Card>
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                      <div className="flex items-center gap-4 w-full md:w-auto">
                          <h3 className="font-bold text-lg text-slate-800 dark:text-white whitespace-nowrap">{t.absenteeList} (Full List)</h3>
                          <div className="relative w-full md:w-64">
                              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                              <Input 
                                  placeholder="Search name or ID..." 
                                  className="pl-9 h-9 text-sm" 
                                  value={absenteeSearch} 
                                  onChange={(e) => { setAbsenteeSearch(e.target.value); setFullListPage(1); }} 
                              />
                          </div>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => handleExport(sortedFullList, 'Absentee_List')}><Download size={16} className="mr-2" /> Export</Button>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-start border-collapse">
                          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                              <tr>
                                  <th className="p-3 text-start cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => handleAttendanceSort('studentNumber')}>ID <ArrowUpDown size={12} className="inline" /></th>
                                  <th className="p-3 text-start cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => handleAttendanceSort('name_en')}>Name <ArrowUpDown size={12} className="inline" /></th>
                                  <th className="p-3 text-start cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => handleAttendanceSort('grade')}>Grade <ArrowUpDown size={12} className="inline" /></th>
                                  <th className="p-3 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => handleAttendanceSort('stats.P')}>Present</th>
                                  <th className="p-3 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => handleAttendanceSort('stats.A')}>Absent</th>
                                  <th className="p-3 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => handleAttendanceSort('stats.L')}>Late</th>
                                  <th className="p-3 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => handleAttendanceSort('stats.EL')}>Early</th>
                                  <th className="p-3 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => handleAttendanceSort('attendancePercentage')}>%</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                              {paginatedFullList.map((s: any) => (
                                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                      <td className="p-3 font-mono text-slate-500">{s.studentNumber}</td>
                                      <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{lang === 'en' ? s.name_en : s.name_ar}</td>
                                      <td className="p-3"><Badge color="gray">{s.grade}-{s.section}</Badge></td>
                                      <td className="p-3 text-center text-green-600 font-bold">{s.stats.P}</td>
                                      <td className="p-3 text-center text-red-600 font-bold">{s.stats.A}</td>
                                      <td className="p-3 text-center text-yellow-600 font-bold">{s.stats.L}</td>
                                      <td className="p-3 text-center text-orange-600 font-bold">{s.stats.EL}</td>
                                      <td className="p-3 text-center">
                                          <span className={`font-bold ${s.attendancePercentage < 90 ? 'text-red-600' : 'text-green-600'}`}>{isNaN(s.attendancePercentage) ? 0 : s.attendancePercentage}%</span>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
                  <Pagination currentPage={fullListPage} totalPages={totalFullListPages} onPageChange={setFullListPage} className="p-4 border-t border-slate-100 dark:border-slate-700" />
              </Card>

              {/* 4. Absentee Report (Buckets) */}
              <Card>
                  <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-700 pb-4">
                      <h3 className="font-bold text-lg text-slate-800 dark:text-white">Absentee Report</h3>
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-300 font-medium bg-slate-100 dark:bg-slate-700 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors">
                          <input 
                              type="checkbox" 
                              checked={includeExcusedInBuckets} 
                              onChange={(e) => setIncludeExcusedInBuckets(e.target.checked)} 
                              className="rounded text-primary focus:ring-primary w-4 h-4"
                          />
                          <span>Include Excused Absences</span>
                      </label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                          {absenteeSummary.map((item, idx) => (
                              <button 
                                  key={idx} 
                                  onClick={() => setSelectedBucket(selectedBucket === item.id ? null : item.id)}
                                  className={`w-full flex justify-between items-center p-4 rounded-lg border transition-all ${
                                      selectedBucket === item.id 
                                      ? 'ring-2 ring-blue-500 border-transparent bg-blue-50 dark:bg-blue-900/20' 
                                      : item.isFlag 
                                          ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800 hover:bg-red-100' 
                                          : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-50'
                                  }`}
                              >
                                  <div className="text-left">
                                      <p className={`font-bold ${item.isFlag ? 'text-red-800 dark:text-red-300' : 'text-slate-700 dark:text-slate-200'}`}>Absences {item.label}</p>
                                      {item.isFlag && <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">RED FLAG</span>}
                                  </div>
                                  <div className="text-2xl font-bold text-slate-800 dark:text-white">{item.count}</div>
                              </button>
                          ))}
                      </div>
                      <div className="flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-6">
                          <div className="h-64 w-full relative">
                              {/* Recharts crashes if data array is empty in some versions, ensuring render only if data exists is safer */}
                              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                                  <BarChart data={bucketData}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                      <XAxis dataKey="name" fontSize={10} />
                                      <YAxis />
                                      <Tooltip />
                                      <Bar dataKey="Unexcused" fill="#ef4444" name={t.unexcused} />
                                      <Bar dataKey="Excused" fill="#3b82f6" name={t.excused} />
                                  </BarChart>
                              </ResponsiveContainer>
                          </div>
                      </div>
                  </div>
                  
                  {/* Detailed Bucket Table */}
                  {selectedBucket && selectedBucketStudents.length > 0 && (
                      <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-6 animate-in slide-in-from-top-4">
                          <h4 className="font-bold text-slate-800 dark:text-white mb-3">
                              Students with {absenteeSummary.find(s => s.id === selectedBucket)?.label} Absences
                          </h4>
                          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                              <table className="w-full text-sm text-start">
                                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold uppercase text-xs">
                                      <tr>
                                          <th className="p-3 text-start">Student Name</th>
                                          <th className="p-3 text-start">Grade</th>
                                          <th className="p-3 text-center">Unexcused</th>
                                          <th className="p-3 text-center">Excused</th>
                                          <th className="p-3 text-center">Total</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                      {selectedBucketStudents.map((s: any) => (
                                          <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                              <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{lang === 'en' ? s.name_en : s.name_ar}</td>
                                              <td className="p-3"><Badge color="gray">{s.grade}-{s.section}</Badge></td>
                                              <td className="p-3 text-center text-red-600 font-bold">{s.stats.A}</td>
                                              <td className="p-3 text-center text-blue-600 font-bold">{s.stats.EA}</td>
                                              <td className="p-3 text-center font-bold">{s.stats.A + s.stats.EA}</td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  )}
                  {selectedBucket && selectedBucketStudents.length === 0 && (
                      <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-6 text-center text-slate-400 italic">
                          No students found in this category.
                      </div>
                  )}
              </Card>

              {/* 5. Attendance Late Arrivals Report */}
              <Card>
                  <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Clock className="text-yellow-500" /> Late Arrivals Report</h3>
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-start">
                          <thead className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 font-bold uppercase text-xs">
                              <tr>
                                  <th className="p-3 text-start">Name</th>
                                  <th className="p-3 text-start">Grade</th>
                                  <th className="p-3 text-center">Late Count</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                              {paginatedLateList.map((s: any) => (
                                  <tr key={s.id}>
                                      <td className="p-3 font-medium">{lang === 'en' ? s.name_en : s.name_ar}</td>
                                      <td className="p-3">{s.grade}-{s.section}</td>
                                      <td className="p-3 text-center font-bold text-lg text-yellow-600">{s.stats.L}</td>
                                  </tr>
                              ))}
                              {paginatedLateList.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-slate-400">No late arrivals recorded</td></tr>}
                          </tbody>
                      </table>
                  </div>
                  <Pagination currentPage={lateListPage} totalPages={totalLateListPages} onPageChange={setLateListPage} className="p-4" />
              </Card>
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
              if (s) { grades[s.grade] = (grades[s.grade] || 0) + 1; }
          });
          chartData = Object.entries(symptoms).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
          gradeData = Object.entries(grades).map(([name, value]) => ({ name, value })).sort((a,b) => a.name.localeCompare(b.name));
      }
      return (
          <div className="space-y-6 animate-in fade-in">
              <FilterBar tabName="clinic" />
              {loading ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><Card className="h-80 flex items-center justify-center"><Loader2 className="animate-spin text-slate-300" size={32} /></Card><Card className="h-80 flex items-center justify-center"><Loader2 className="animate-spin text-slate-300" size={32} /></Card></div>
              ) : data ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card className="min-w-0"><h3 className="font-bold mb-4 text-slate-700 dark:text-slate-200">{t.topComplaints}</h3><div className="h-80 w-full relative"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}><BarChart data={chartData} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" /><YAxis dataKey="name" type="category" width={120} fontSize={12} /><Tooltip /><Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></Card>
                      <Card className="min-w-0"><h3 className="font-bold mb-4 text-slate-700 dark:text-slate-200">{t.visitsByGrade}</h3><div className="h-80 w-full relative"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}><BarChart data={gradeData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" fontSize={12} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
                  </div>
              ) : <div className="h-80 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/50"><MousePointerClick size={48} className="mb-4 opacity-20" /><p>{t.clickToGenerate}</p></div>}
          </div>
      );
  };

  const renderEPassReports = () => {
      const { data, loading } = reportStates.epass;
      return (
          <div className="space-y-6 animate-in fade-in">
              <FilterBar tabName="epass" />
              {loading ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><Card className="h-80 flex items-center justify-center"><Loader2 className="animate-spin text-slate-300" size={32} /></Card><Card className="h-80 flex items-center justify-center"><Loader2 className="animate-spin text-slate-300" size={32} /></Card></div>
              ) : data ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card className="min-w-0"><h3 className="font-bold mb-4 text-slate-700 dark:text-slate-200">{t.topEPassUsers}</h3><ul className="space-y-2">{data.epass.topUsers.map((item: any, i: number) => (<li key={i} className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded"><span className="text-slate-700 dark:text-slate-200">{lang === 'en' ? item.student.name_en : item.student.name_ar}</span><Badge color="blue">{item.count}</Badge></li>))}{data.epass.topUsers.length === 0 && <li className="text-center text-slate-400 p-4">No passes found</li>}</ul></Card>
                      <Card className="min-w-0"><h3 className="font-bold mb-4 text-slate-700 dark:text-slate-200">{t.topUnauthorized}</h3><ul className="space-y-2">{data.epass.topUnauthorized.map((item: any, i: number) => (<li key={i} className="flex justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-700 dark:text-red-300"><span>{lang === 'en' ? item.student.name_en : item.student.name_ar}</span><Badge color="red">{item.count}</Badge></li>))}{data.epass.topUnauthorized.length === 0 && <li className="text-center text-slate-400 p-4">No unauthorized exits found</li>}</ul></Card>
                  </div>
              ) : <div className="h-80 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/50"><MousePointerClick size={48} className="mb-4 opacity-20" /><p>{t.clickToGenerate}</p></div>}
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
                  <Card className="min-w-0 flex flex-col h-[500px]"><h3 className="font-bold mb-4 text-slate-700 dark:text-slate-200">{t.receptionReport}</h3><div className="overflow-y-auto flex-1"><table className="w-full text-sm text-start"><thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800 sticky top-0"><tr><th className="px-4 py-3 text-start">{t.date}</th><th className="px-4 py-3 text-start">{t.studentName}</th><th className="px-4 py-3 text-start">{t.grade}</th><th className="px-4 py-3 text-start">{t.section}</th><th className="px-4 py-3 text-start">{t.type}</th><th className="px-4 py-3 text-start">{t.reason}</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{paginatedReception.map((log: any) => { const s = students.find(st => st.id === log.studentId); return (<tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50"><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{new Date(log.timestamp).toLocaleString()}</td><td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{s ? (lang === 'en' ? s.name_en : s.name_ar) : 'Unknown'}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s ? s.grade : '-'}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s ? s.section : '-'}</td><td className="px-4 py-3"><Badge color={log.type === 'LateArrival' ? 'blue' : 'orange'}>{log.type === 'LateArrival' ? t.lateArrival : t.earlyLeave}</Badge></td><td className="px-4 py-3 text-slate-500 dark:text-slate-400">{log.reason || '-'}</td></tr>); })}{data.reception.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">No records found for selected period</td></tr>}</tbody></table></div><Pagination currentPage={receptionPage} totalPages={totalReceptionPages} onPageChange={setReceptionPage} className="mt-4 border-t border-slate-100 dark:border-slate-700 pt-2" isRTL={lang === 'ar'} /></Card>
              ) : <div className="h-80 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/50"><MousePointerClick size={48} className="mb-4 opacity-20" /><p>{t.clickToGenerate}</p></div>}
          </div>
      );
  };

  const renderStudent360 = () => {
      const locale = lang === 'ar' ? 'ar-EG' : 'en-US';
      
      const filteredSearchStudents = students.filter(s => 
          s.name_en.toLowerCase().includes(search360.toLowerCase()) || 
          s.studentNumber.includes(search360)
      ).slice(0, 10);

      return (
          <div>
              <div className="flex flex-col lg:flex-row gap-4 mb-6 items-start lg:items-center">
                  <div className="flex-1 relative z-30 w-full">
                      <div 
                          className={`relative border rounded-xl shadow-sm transition-all bg-white dark:bg-slate-800 ${isSearchDropdownOpen ? 'ring-2 ring-blue-500 border-blue-500' : 'border-slate-200 dark:border-slate-700'}`}
                      >
                          <Search className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${lang === 'ar' ? 'right-3' : 'left-3'}`} size={20} />
                          <input 
                              type="text"
                              placeholder={t.searchStudent} 
                              className={`w-full h-12 bg-transparent outline-none text-base text-slate-800 dark:text-white ${lang === 'ar' ? 'pr-10 pl-4' : 'pl-10 pr-4'}`}
                              value={search360}
                              onChange={e => { 
                                  setSearch360(e.target.value); 
                                  setIsSearchDropdownOpen(true);
                                  setSelectedSearchStudent(null); 
                              }}
                              onFocus={() => setIsSearchDropdownOpen(true)}
                              onBlur={() => setTimeout(() => setIsSearchDropdownOpen(false), 200)} 
                          />
                          {/* Dropdown Results */}
                          {isSearchDropdownOpen && search360 && !selectedSearchStudent && (
                              <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-b-xl shadow-xl mt-px z-40 max-h-60 overflow-y-auto">
                                  {filteredSearchStudents.map(s => (
                                      <button 
                                          key={s.id}
                                          onClick={() => { 
                                              setSelectedSearchStudent(s);
                                              setSearch360(lang === 'en' ? s.name_en : s.name_ar); 
                                              setIsSearchDropdownOpen(false);
                                          }}
                                          className="w-full text-start px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-200 border-b border-slate-50 dark:border-slate-700 last:border-0"
                                      >
                                          <div className="font-bold">{lang === 'en' ? s.name_en : s.name_ar}</div>
                                          <div className="text-xs text-slate-500 dark:text-slate-400">{s.studentNumber} - {s.grade} {s.section}</div>
                                      </button>
                                  ))}
                                  {filteredSearchStudents.length === 0 && (
                                      <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 italic">No students found</div>
                                  )}
                              </div>
                          )}
                      </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                      <div className="bg-white dark:bg-slate-800 px-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4 h-12 grow sm:grow-0">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{t.dateRange}</span>
                          <div className="h-6 w-px bg-slate-100 dark:bg-slate-700"></div>
                          <div className="flex items-center gap-2">
                              <input 
                                  type="date" 
                                  value={student360StartDate} 
                                  onChange={e => setStudent360StartDate(e.target.value)}
                                  className="text-sm font-medium bg-transparent border-none p-0 text-slate-700 dark:text-slate-200 focus:ring-0 outline-none w-28"
                              />
                              <span className="text-slate-400">-</span>
                              <input 
                                  type="date" 
                                  value={student360EndDate} 
                                  onChange={e => setStudent360EndDate(e.target.value)}
                                  className="text-sm font-medium bg-transparent border-none p-0 text-slate-700 dark:text-slate-200 focus:ring-0 outline-none w-28"
                              />
                          </div>
                      </div>

                      <Button 
                          onClick={handleGenerate360} 
                          disabled={!selectedSearchStudent || isGenerating360}
                          className="h-12 px-8 rounded-xl shadow-lg shadow-blue-200 dark:shadow-none bg-blue-600 hover:bg-blue-700 text-white font-bold"
                      >
                          {isGenerating360 ? (
                              <Loader2 className="animate-spin mr-2" size={20} />
                          ) : (
                              <MousePointerClick className="mr-2" size={20} />
                          )}
                          {t.generate}
                      </Button>
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
                                   {/* Ensure PieChart has data before rendering */}
                                   {pieData.length > 0 ? (
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
                                              formatter={(value: any, entry: any) => (
                                                <span className="text-slate-600 dark:text-slate-300 font-medium ml-1">
                                                  {value} ({entry.payload.value} {lang === 'en' ? 'days' : 'أيام'})
                                                </span>
                                              )}
                                           />
                                       </PieChart>
                                   </ResponsiveContainer>
                                   ) : (
                                       <div className="flex h-full items-center justify-center text-slate-400">No attendance data</div>
                                   )}
                                   <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pb-8">
                                        <span className="text-3xl font-bold text-slate-800 dark:text-white">{isNaN(presentPct) ? 0 : presentPct}%</span>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t.present}</p>
                                   </div>
                               </div>
                           </Card>
                           
                           <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                               {/* ... (Existing Metric Cards) */}
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
                                   </div>
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
                           <button onClick={() => setShowAttendanceHistory(!showAttendanceHistory)} className="w-full flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors">
                               <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200"><Calendar size={20} /><span>{t.attendanceLogDaily}</span></div>
                               {showAttendanceHistory ? <ChevronDown size={20} className="text-slate-500" /> : <ChevronRight size={20} className="text-slate-500" />}
                           </button>
                           {showAttendanceHistory && (
                               <div>
                                   <table className="w-full text-start text-sm">
                                       <thead className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400"><tr><th className="px-6 py-3 text-start">{t.date}</th><th className="px-6 py-3 text-start">{t.status}</th><th className="px-6 py-3 text-start">{t.notes}</th></tr></thead>
                                       <tbody className="divide-y divide-slate-50 dark:divide-slate-700">{paginatedAttendance.length === 0 ? <tr><td colSpan={3} className="px-6 py-4 text-center text-slate-400">{t.noData}</td></tr> : paginatedAttendance.map((day: any) => (<tr key={day.date}><td className="px-6 py-3 text-slate-700 dark:text-slate-300">{new Date(day.date).toLocaleDateString(locale)}</td><td className="px-6 py-3"><Badge color={day.color as any}>{day.status}</Badge></td><td className="px-6 py-3 text-slate-500 dark:text-slate-400">{day.note || '-'}</td></tr>))}</tbody>
                                   </table>
                                   <Pagination currentPage={attendancePage} totalPages={totalPages} onPageChange={setAttendancePage} className="p-3 border-t border-slate-100 dark:border-slate-700" isRTL={lang === 'ar'} />
                               </div>
                           )}
                       </div>
                       {/* ... (Other History sections maintained) */}
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
                    {tab.label || (t as any)[tab.labelKey]}
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