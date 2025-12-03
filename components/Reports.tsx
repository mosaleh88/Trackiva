import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Badge, Pagination } from './ui';
import { store } from '../services/store';
import { generateSchoolInsights } from '../services/geminiService';
import { Language, Student, User } from '../types';
import { TRANSLATIONS } from '../constants';
import { 
  BarChart3, Calendar, Download, Filter, Search, User as UserIcon, LayoutDashboard, 
  Activity, Ticket, DoorOpen, ChevronDown, ChevronRight, Printer, Stethoscope, 
  Clock, AlertTriangle, CheckCircle2, ArrowRight, BrainCircuit, Loader2, 
  MousePointerClick, ArrowUpDown 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import * as XLSX from 'xlsx';

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

  // Student 360 State
  const [student360StartDate, setStudent360StartDate] = useState(store.getAcademicYearStartStr());
  const [student360EndDate, setStudent360EndDate] = useState(store.getTodayStr());
  const [search360, setSearch360] = useState("");
  const [selectedSearchStudent, setSelectedSearchStudent] = useState<Student | null>(null);
  const [student360, setStudent360] = useState<Student | null>(null);
  const [student360Data, setStudent360Data] = useState<any>(null);
  const [isGenerating360, setIsGenerating360] = useState(false);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);

  // Report Filters State
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

  // Data
  const [students, setStudents] = useState<Student[]>([]);
  const [termSummaries, setTermSummaries] = useState<any[]>([]);

  // Pagination
  const [attendancePage, setAttendancePage] = useState(1);
  const [epassPage, setEpassPage] = useState(1);
  const [receptionPage, setReceptionPage] = useState(1);
  const [fullListPage, setFullListPage] = useState(1);
  const [lateListPage, setLateListPage] = useState(1);
  const [logsPage, setLogsPage] = useState(1);

  // AI
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // 360 Collapsibles
  const [showAttendanceHistory, setShowAttendanceHistory] = useState(true);
  const [showClinicHistory, setShowClinicHistory] = useState(false);
  const [showEPassHistory, setShowEPassHistory] = useState(false);
  const [showReceptionHistory, setShowReceptionHistory] = useState(false);

  // Attendance Specific
  const [includeExcusedInBuckets, setIncludeExcusedInBuckets] = useState(false);
  const [attendanceSortConfig, setAttendanceSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'name_en', direction: 'asc' });
  const [absenteeSearch, setAbsenteeSearch] = useState("");
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);

  const settings = store.getSettings();
  const attendanceConfig = settings.attendanceSettings;

  // Load Students & Terms
  useEffect(() => {
    if (currentUser) {
      setStudents(store.getStudentsForUser(currentUser.id));
    }
    const loadTerms = async () => {
      const stats = await store.getYearlyTermStats();
      setTermSummaries(stats);
    };
    loadTerms();
  }, [currentUser]);

  // Handlers
  const handleFilterChange = (tab: string, key: string, value: string) => {
    setReportStates(prev => ({
      ...prev,
      [tab]: { ...prev[tab], filters: { ...prev[tab].filters, [key]: value } }
    }));
  };

  const generateReport = async (tab: string) => {
    if (!currentUser) return;

    // Reset all pagination when generating new report
    setFullListPage(1);
    setLateListPage(1);
    setLogsPage(1);
    setAttendancePage(1);
    setEpassPage(1);
    setReceptionPage(1);

    setReportStates(prev => ({ ...prev, [tab]: { ...prev[tab], loading: true } }));

    try {
      const filters = reportStates[tab].filters;
      const typesToFetch: ('attendance' | 'epasses' | 'receptionLogs' | 'clinicVisits')[] = 
        tab === 'attendance' ? ['attendance'] :
        tab === 'clinic' ? ['clinicVisits'] :
        tab === 'epass' ? ['epasses'] :
        tab === 'reception' ? ['receptionLogs'] : ['attendance', 'epasses', 'receptionLogs', 'clinicVisits'];

      // FIXED: Removed { cache: false } → now caches properly
      const fetchedData = await store.fetchDataForRange(filters.startDate, filters.endDate, { types: typesToFetch });
      const reportData = store.getReportsData(filters.startDate, filters.endDate, {
        grade: filters.grade, section: filters.section, gender: filters.gender
      }, currentUser.id, fetchedData);

      setReportStates(prev => ({ ...prev, [tab]: { ...prev[tab], data: reportData, loading: false } }));
      setAiInsight(null);
    } catch (e) {
      console.error(e);
      setReportStates(prev => ({ ...prev, [tab]: { ...prev[tab], loading: false } }));
    }
  };

  const handleGenerate360 = async () => {
    if (!selectedSearchStudent) return;

    // Reset pagination reset for 360 view
    setAttendancePage(1);
    setEpassPage(1);

    setIsGenerating360(true);
    try {
      // FIXED: Removed { cache: false }
      const fetchedData = await store.fetchDataForRange(student360StartDate, student360EndDate);
      const sData = store.getStudent360Data(selectedSearchStudent.id, student360StartDate, student360EndDate, fetchedData);
      setStudent360Data(sData);
      setStudent360(selectedSearchStudent);
    } finally {
      setIsGenerating360(false);
    }
  };

  const handleAskAi = async () => {
    setLoadingAi(true);
    try {
      const context = activeTab === 'student360' && student360Data ? 'student_profile' : 'global_report';
      const analysisData = activeTab === 'student360' && student360Data ? student360Data : reportStates[activeTab]?.data;
      if (!analysisData) {
        setAiInsight(t.noDataForAi || "No data available for analysis.");
        return;
      }
      const insight = await generateSchoolInsights(analysisData, context, 'Administrator', lang);
      setAiInsight(insight);
    } catch (e) {
      console.error(e);
      setAiInsight(t.aiError || "Failed to generate insights.");
    } finally {
      setLoadingAi(false);
    }
  };

  const handleExport = (dataToExport: any[], filename: string) => {
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const handleAttendanceSort = (key: string) => {
    setAttendanceSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handlePrint360 = () => {
    if (!student360 || !student360Data) return;
    window.print();
  };

  // Student 360 Data - All useMemo now have null guards
  const dailyAttendance = useMemo(() => {
    if (!student360Data?.history?.attendance?.length) return [];
    const groups: Record<string, any[]> = {};
    student360Data.history.attendance.forEach((r: any) => {
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
        const localDate = new Date(y, m - 1, d);
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

  const epassHistory = useMemo(() => student360Data?.history?.epasses || [], [student360Data]);
  const paginatedEPasses = useMemo(() => {
    const start = (epassPage - 1) * ITEMS_PER_PAGE;
    return epassHistory.slice(start, start + ITEMS_PER_PAGE);
  }, [epassHistory, epassPage]);

  const totalEpassPages = useMemo(() => {
    return Math.ceil(epassHistory.length / ITEMS_PER_PAGE);
  }, [epassHistory]);

  const epassStats = useMemo(() => {
    const counts: Record<string, number> = {};
    const destinations = store.getDestinations();
    epassHistory.forEach((p: any) => {
      let type = p.type;
      if (type === 'UNAUTHORIZED') {
        type = t.unauthorized;
      } else {
        const d = destinations.find(dst => dst.id === type);
        type = d ? (lang === 'en' ? d.label_en : d.label_ar) : type;
      }
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }, [epassHistory, lang, t]);

  const presentPct = useMemo(() => {
    if (!student360Data) return 0;
    const totalScheduled = store.countSchoolDays(student360StartDate, student360EndDate);
    const denominator = totalScheduled > 0 ? totalScheduled : 1;
    let totalAbsenceWeight = 0;
    dailyAttendance.forEach((day: any) => {
      if (day.status.startsWith(t.absent)) totalAbsenceWeight += day.weight;
      else if (day.status === t.excused) totalAbsenceWeight += 1;
    });
    const estimatedPresent = Math.max(0, totalScheduled - totalAbsenceWeight);
    return Math.round((estimatedPresent / denominator) * 100);
  }, [dailyAttendance, student360Data, student360StartDate, student360EndDate, t]);

  const pieData = useMemo(() => {
    if (!student360Data) return [];
    const totalScheduled = store.countSchoolDays(student360StartDate, student360EndDate);
    const weightedAbsent = dailyAttendance.reduce((acc, d) => d.status.startsWith(t.absent) ? acc + d.weight : acc, 0);
    const countExcused = dailyAttendance.filter(d => d.status === t.excused).length;
    const calculatedPresent = Math.max(0, totalScheduled - weightedAbsent - countExcused);
    return [
      { name: t.present, value: calculatedPresent },
      { name: t.excused, value: countExcused },
      { name: t.absent, value: weightedAbsent }
    ].filter(d => d.value > 0);
  }, [dailyAttendance, t, student360Data, student360StartDate, student360EndDate]);

  const attendanceData = reportStates.attendance.data;
  const selectedBucketStudents = useMemo(() => {
    if (!selectedBucket || !attendanceData?.attendance?.comprehensiveList) return [];
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

  // Filter Bar Component
  const FilterBar = ({ tabName }: { tabName: string }) => {
    const state = reportStates[tabName];
    if (!state) return null;
    const uniqueGrades = Array.from(new Set(students.map(s => s.grade))).sort();
    const uniqueSections = Array.from(new Set(students.map(s => s.section))).sort();

    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">{t.startDate}</label>
            <Input type="date" value={state.filters.startDate} onChange={e => handleFilterChange(tabName, 'startDate', e.target.value)} className="h-12" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">{t.endDate}</label>
            <Input type="date" value={state.filters.endDate} onChange={e => handleFilterChange(tabName, 'endDate', e.target.value)} className="h-12" />
          </div>

          <Button onClick={() => generateReport(tabName)} disabled={state.loading} className="h-12 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg">
            {state.loading ? <Loader2 className="animate-spin mr-2" size={20} /> : null}
            {t.generate}
          </Button>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <Filter size={18} />
              <span className="text-sm font-bold">{t.filterBy}:</span>
            </div>
            <Select value={state.filters.grade} onChange={e => handleFilterChange(tabName, 'grade', e.target.value)} className="h-12 w-32">
              <option value="All">{t.allGrades}</option>
              {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
            </Select>
            <Select value={state.filters.section} onChange={e => handleFilterChange(tabName, 'section', e.target.value)} className="h-12 w-32">
              <option value="All">{t.allSections}</option>
              {uniqueSections.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Select value={state.filters.gender} onChange={e => handleFilterChange(tabName, 'gender', e.target.value)} className="h-12 w-36">
              <option value="All">{t.allGenders}</option>
              <option value="Male">{t.male}</option>
              <option value="Female">{t.female}</option>
            </Select>
          </div>
        </div>
      </div>
    );
  };

  const renderAiCard = () => (
    <Card className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white border-none shadow-2xl animate-in fade-in mb-8 no-print">
      <div className="flex items-start gap-5 p-6">
        <div className="p-4 bg-white/20 backdrop-blur rounded-2xl shrink-0">
          <BrainCircuit size={32} className="text-white" />
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-2xl font-bold">{t.askAi || 'AI Analyst'}</h3>
            {!aiInsight && (
              <Button onClick={handleAskAi} disabled={loadingAi} className="bg-white/20 hover:bg-white/30 text-white border-none">
                {loadingAi ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                {loadingAi ? t.aiThinking : "Generate Insights"}
              </Button>
            )}
          </div>
          {aiInsight ? (
            <div className="bg-white/10 backdrop-blur rounded-2xl p-6 text-base leading-relaxed animate-in slide-in-from-top-4">
              {aiInsight}
            </div>
          ) : (
            <p className="text-white/80 text-lg">Click "Generate Insights" to get AI-powered analysis, trends, and recommendations.</p>
          )}
        </div>
      </div>
    </Card>
  );

  const renderDailySummary = () => {
    const summary = store.getDataSummary();
    return (
      <div className="space-y-8 animate-in fade-in">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {termSummaries.length > 0 ? termSummaries.map((term: any) => (
            <Card key={term.id} className="text-center p-8 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800 hover:shadow-xl transition-all">
              <p className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">{term.name}</p>
              <p className="text-5xl font-bold text-slate-800 dark:text-white">{term.percentage}%</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{term.startDate} - {term.endDate}</p>
            </Card>
          )) : (
            <div className="col-span-3 text-center py-12 text-slate-400 italic">Loading term statistics...</div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-l-8 border-l-green-500 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
            <div className="p-6">
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">{t.onCampus}</p>
              <p className="text-4xl font-bold text-green-600 dark:text-green-400 mt-2">
                {summary.presentToday + summary.lateToday + summary.earlyLeaveToday}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                of {summary.totalStudents} students
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  };

  const renderAttendanceReports = () => {
    const { data, loading } = reportStates.attendance;
    if (loading) return (
      <div className="space-y-6 animate-in fade-in">
        <FilterBar tabName="attendance" />
        <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={48} /></div>
      </div>
    );
    if (!data) return (
      <div className="space-y-6 animate-in fade-in">
        <FilterBar tabName="attendance" />
        <div className="h-96 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
          <MousePointerClick size={64} className="mb-4 opacity-30" />
          <p className="text-xl font-medium">{t.clickToGenerate}</p>
        </div>
      </div>
    );

    const bucketData = [
      { name: '1-2', Unexcused: data.attendance.buckets['1-2'], Excused: data.attendance.excusedBuckets['1-2'] },
      { name: '3-5', Unexcused: data.attendance.buckets['3-5'], Excused: data.attendance.excusedBuckets['3-5'] },
      { name: '6-9', Unexcused: data.attendance.buckets['6-9'], Excused: data.attendance.excusedBuckets['6-9'] },
      { name: '10-14', Unexcused: data.attendance.buckets['10-14'], Excused: data.attendance.excusedBuckets['10-14'] },
      { name: '15+', Unexcused: data.attendance.buckets['15+'], Excused: data.attendance.excusedBuckets['15+'] },
    ];

    const logs = data.attendance.logs || [];
    const paginatedLogs = logs.slice((logsPage - 1) * REPORT_ITEMS_PER_PAGE, logsPage * REPORT_ITEMS_PER_PAGE);
    const totalLogsPages = Math.ceil(logs.length / REPORT_ITEMS_PER_PAGE);

    let filteredFullList = [...data.attendance.comprehensiveList];
    if (absenteeSearch) {
      const lower = absenteeSearch.toLowerCase();
      filteredFullList = filteredFullList.filter((s: any) => 
        s.name_en.toLowerCase().includes(lower) || 
        s.name_ar.includes(lower) || 
        s.studentNumber.includes(lower)
      );
    }

    const sortedFullList = [...filteredFullList].sort((a: any, b: any) => {
      const { key, direction } = attendanceSortConfig;
      const valA = key.includes('.') ? a.stats[key.split('.')[1]] : a[key];
      const valB = key.includes('.') ? b.stats[key.split('.')[1]] : b[key];
      if (key === 'grade') return direction === 'asc' ? a.grade.localeCompare(b.grade) : b.grade.localeCompare(a.grade);
      return direction === 'asc' ? (valA < valB ? -1 : 1) : (valA > valB ? -1 : 1);
    });

    const paginatedFullList = sortedFullList.slice((fullListPage - 1) * REPORT_ITEMS_PER_PAGE, fullListPage * REPORT_ITEMS_PER_PAGE);
    const totalFullListPages = Math.ceil(sortedFullList.length / REPORT_ITEMS_PER_PAGE);

    const absenteeSummary = [
      { id: '1-2', label: '1-2 Days', count: includeExcusedInBuckets ? data.attendance.buckets['1-2'] + data.attendance.excusedBuckets['1-2'] : data.attendance.buckets['1-2'] },
      { id: '3-5', label: '3-5 Days', count: includeExcusedInBuckets ? data.attendance.buckets['3-5'] + data.attendance.excusedBuckets['3-5'] : data.attendance.buckets['3-5'] },
      { id: '6-9', label: '6-9 Days', count: includeExcusedInBuckets ? data.attendance.buckets['6-9'] + data.attendance.excusedBuckets['6-9'] : data.attendance.buckets['6-9'] },
      { id: '10-14', label: '10-14 Days', count: includeExcusedInBuckets ? data.attendance.buckets['10-14'] + data.attendance.excusedBuckets['10-14'] : data.attendance.buckets['10-14'] },
      { id: '15+', label: '15+ Days', count: includeExcusedInBuckets ? data.attendance.buckets['15+'] + data.attendance.excusedBuckets['15+'] : data.attendance.buckets['15+'], isFlag: true },
    ];

    const lateList = sortedFullList.filter((s: any) => s.stats.L > 0).sort((a: any, b: any) => b.stats.L - a.stats.L);
    const paginatedLateList = lateList.slice((lateListPage - 1) * REPORT_ITEMS_PER_PAGE, lateListPage * REPORT_ITEMS_PER_PAGE);
    const totalLateListPages = Math.ceil(lateList.length / REPORT_ITEMS_PER_PAGE);

    const averagePct = sortedFullList.length ? Math.round(sortedFullList.reduce((acc: number, curr: any) => acc + curr.attendancePercentage, 0) / sortedFullList.length) : 0;

    return (
      <div className="space-y-8 animate-in fade-in">
        <FilterBar tabName="attendance" />

        {/* Attendance Logs */}
        <Card className="border-t-4 border-t-blue-600">
          <div className="flex justify-between items-center mb-6 p-6">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{t.attendanceLogDaily}</h3>
            <Button variant="secondary" onClick={() => handleExport(logs, 'Daily_Attendance_Logs')}>
              <Download size={18} className="mr-2" /> Export
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 font-bold uppercase text-xs">
                <tr>
                  <th className="p-4 text-start">{t.date}</th>
                  <th className="p-4 text-start">{t.studentName}</th>
                  <th className="p-4 text-start">{t.status}</th>
                  <th className="p-4 text-start">{t.reason}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {paginatedLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4">{new Date(log.date).toLocaleDateString()}</td>
                    <td className="p-4 font-medium">{lang === 'en' ? log.student.name_en : log.student.name_ar}</td>
                    <td className="p-4">
                      <Badge color={
                        log.status.includes('Absent') ? 'red' :
                        log.status === 'Late' ? 'yellow' :
                        log.status === 'Early Leave' ? 'orange' : 'blue'
                      }>
                        {log.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-slate-500 italic">{log.reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={logsPage} totalPages={totalLogsPages} onPageChange={setLogsPage} className="mt-4" />
        </Card>

        {/* Average Attendance Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800">
            <div className="p-8 text-center">
              <p className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Selected Range</p>
              <p className="text-6xl font-bold text-slate-800 dark:text-white">{isNaN(averagePct) ? 0 : averagePct}%</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Average Attendance</p>
            </div>
          </Card>
        </div>

        {/* Full Absentee List */}
        <Card>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 p-6">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white whitespace-nowrap">{t.absenteeList} (Full List)</h3>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
                <Input
                  placeholder="Search name or ID..."
                  className="pl-12 h-12 text-base"
                  value={absenteeSearch}
                  onChange={(e) => { setAbsenteeSearch(e.target.value); setFullListPage(1); }}
                />
              </div>
            </div>
            <Button variant="secondary" onClick={() => handleExport(sortedFullList, 'Full_Attendance_List')}>
              <Download size={18} className="mr-2" /> Export
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                <tr>
                  <th className="p-4 text-start cursor-pointer hover:bg-slate-.org-slate-100 dark:hover:bg-slate-700" onClick={() => handleAttendanceSort('studentNumber')}>ID <ArrowUpDown size={14} className="inline" /></th>
                  <th className="p-4 text-start cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => handleAttendanceSort('name_en')}>Name <ArrowUpDown size={14} className="inline" /></th>
                  <th className="p-4 text-start cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => handleAttendanceSort('grade')}>Grade <ArrowUpDown size={14} className="inline" /></th>
                  <th className="p-4 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => handleAttendanceSort('stats.P')}>Present</th>
                  <th className="p-4 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => handleAttendanceSort('stats.A')}>Absent</th>
                  <th className="p-4 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => handleAttendanceSort('stats.L')}>Late</th>
                  <th className="p-4 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => handleAttendanceSort('stats.EL')}>Early</th>
                  <th className="p-4 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => handleAttendanceSort('attendancePercentage')}>%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {paginatedFullList.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4 font-mono text-slate-500">{s.studentNumber}</td>
                    <td className="p-4 font-medium text-slate-800 dark:text-slate-200">{lang === 'en' ? s.name_en : s.name_ar}</td>
                    <td className="p-4"><Badge color="gray">{s.grade}-{s.section}</Badge></td>
                    <td className="p-4 text-center text-green-600 font-bold">{s.stats.P}</td>
                    <td className="p-4 text-center text-red-600 font-bold">{s.stats.A}</td>
                    <td className="p-4 text-center text-yellow-600 font-bold">{s.stats.L}</td>
                    <td className="p-4 text-center text-orange-600 font-bold">{s.stats.EL}</td>
                    <td className="p-4 text-center">
                      <span className={`font-bold ${s.attendancePercentage < 90 ? 'text-red-600' : 'text-green-600'}`}>
                        {isNaN(s.attendancePercentage) ? 0 : s.attendancePercentage}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={fullListPage} totalPages={totalFullListPages} onPageChange={setFullListPage} className="mt-4" />
        </Card>

        {/* Absentee Report (Buckets) */}
        <Card>
          <div className="flex justify-between items-center mb-6 p-6 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white">Absentee Report</h3>
            <label className="flex items-center gap-3 cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={includeExcusedInBuckets}
                onChange={(e) => setIncludeExcusedInBuckets(e.target.checked)}
                className="rounded text-primary focus:ring-primary w-5 h-5"
              />
              <span>Include Excused Absences</span>
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
            <div className="space-y-4">
              {absenteeSummary.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedBucket(selectedBucket === item.id ? null : item.id)}
                  className={`w-full flex justify-between items-center p-5 rounded-xl border-2 transition-all ${
                    selectedBucket === item.id
                      ? 'ring-4 ring-blue-500/30 border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : item.isFlag
                        ? 'border-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <div className="text-left">
                    <p className={`text-lg font-bold ${item.isFlag ? 'text-red-800 dark:text-red-300' : 'text-slate-700 dark:text-slate-200'}`}>
                      Absences {item.label}
                    </p>
                    {item.isFlag && <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-1 rounded mt-1 inline-block">RED FLAG</span>}
                  </div>
                  <div className="text-3xl font-bold text-slate-800 dark:text-white">{item.count}</div>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-8">
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bucketData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="Unexcused" fill="#ef4444" name="Unexcused" />
                    <Bar dataKey="Excused" fill="#3b82f6" name="Excused" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {selectedBucket && selectedBucketStudents.length > 0 && (
            <div className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-8">
              <h4 className="text-xl font-bold text-slate-800 dark:text-white mb-6">
                Students with {absenteeSummary.find(s => s.id === selectedBucket)?.label} Absences
              </h4>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                    <tr>
                      <th className="p-4 text-start">Student Name</th>
                      <th className="p-4 text-start">Grade</th>
                      <th className="p-4 text-center">Unexcused</th>
                      <th className="p-4 text-center">Excused</th>
                      <th className="p-4 text-center">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {selectedBucketStudents.map((s: any) => (
                      <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-4 font-medium text-slate-800 dark:text-slate-200">{lang === 'en' ? s.name_en : s.name_ar}</td>
                        <td className="p-4"><Badge color="gray">{s.grade}-{s.section}</Badge></td>
                        <td className="p-4 text-center text-red-600 font-bold">{s.stats.A}</td>
                        <td className="p-4 text-center text-blue-600 font-bold">{s.stats.EA}</td>
                        <td className="p-4 text-center font-bold text-slate-800 dark:text-white">{s.stats.A + s.stats.EA}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>

        {/* Late Arrivals */}
        <Card>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 p-6 flex items-center gap-3">
            <Clock className="text-yellow-500" size={28} /> Late Arrivals Report
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 font-bold uppercase text-xs">
                <tr>
                  <th className="p-4 text-start">Name</th>
                  <th className="p-4 text-start">Grade</th>
                  <th className="p-4 text-center">Late Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {paginatedLateList.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4 font-medium">{lang === 'en' ? s.name_en : s.name_ar}</td>
                    <td className="p-4">{s.grade}-{s.section}</td>
                    <td className="p-4 text-center font-bold text-2xl text-yellow-600">{s.stats.L}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={lateListPage} totalPages={totalLateListPages} onPageChange={setLateListPage} className="mt-4" />
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
        if (s) grades[s.grade] = (grades[s.grade] || 0) + 1;
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
            <Card>
              <h3 className="font-bold text-xl mb-4 p-6">{t.topComplaints}</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={150} fontSize={13} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <h3 className="font-bold text-xl mb-4 p-6">{t.visitsByGrade}</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gradeData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={13} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        ) : (
          <div className="h-80 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
            <MousePointerClick size={64} className="mb-4 opacity-30" />
            <p className="text-xl font-medium">{t.clickToGenerate}</p>
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
            <Card>
              <h3 className="font-bold text-xl mb-4 p-6">{t.topEPassUsers}</h3>
              <ul className="space-y-3">
                {data.epass.topUsers.map((item: any, i: number) => (
                  <li key={i} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <span className="font-medium text-slate-700 dark:text-slate-200">{lang === 'en' ? item.student.name_en : item.student.name_ar}</span>
                    <Badge color="blue" className="text-lg font-bold">{item.count}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <h3 className="font-bold text-xl mb-4 p-6">{t.topUnauthorized}</h3>
              <ul className="space-y-3">
                {data.epass.topUnauthorized.map((item: any, i: number) => (
                  <li key={i} className="flex justify-between items-center p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                    <span className="font-medium text-red-700 dark:text-red-300">{lang === 'en' ? item.student.name_en : item.student.name_ar}</span>
                    <Badge color="red" className="text-lg font-bold">{item.count}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        ) : (
          <div className="h-80 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
            <MousePointerClick size={64} className="mb-4 opacity-30" />
            <p className="text-xl font-medium">{t.clickToGenerate}</p>
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
          <Card className="h-96 flex items-center justify-center"><Loader2 className="animate-spin text-slate-300" size={32} /></Card>
        ) : data ? (
          <Card>
            <h3 className="font-bold text-xl mb-4 p-6">{t.receptionReport}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                  <tr>
                    <th className="p-4 text-start">{t.date}</th>
                    <th className="p-4 text-start">{t.studentName}</th>
                    <th className="p-4 text-start">{t.grade}</th>
                    <th className="p-4 text-start">{t.section}</th>
                    <th className="p-4 text-start">{t.type}</th>
                    <th className="p-4 text-start">{t.reason}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {paginatedReception.map((log: any) => {
                    const s = students.find(st => st.id === log.studentId);
                    return (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-4">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="p-4 font-medium">{s ? (lang === 'en' ? s.name_en : s.name_ar) : 'Unknown'}</td>
                        <td className="p-4">{s ? s.grade : '-'}</td>
                        <td className="p-4">{s ? s.section : '-'}</td>
                        <td className="p-4">
                          <Badge color={log.type === 'LateArrival' ? 'blue' : 'orange'}>
                            {log.type === 'LateArrival' ? t.lateArrival : t.earlyLeave}
                          </Badge>
                        </td>
                        <td className="p-4 text-slate-500 italic">{log.reason || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={receptionPage} totalPages={totalReceptionPages} onPageChange={setReceptionPage} className="mt-4" />
          </Card>
        ) : (
          <div className="h-80 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
            <MousePointerClick size={64} className="mb-4 opacity-30" />
            <p className="text-xl font-medium">{t.clickToGenerate}</p>
          </div>
        )}
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
      <div className="space-y-8">
        {/* Search & Date Range */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center">
            <div className="flex-1 relative z-30 w-full">
              <div className={`relative border-2 rounded-2xl shadow-sm transition-all ${isSearchDropdownOpen ? 'ring-4 ring-blue-500/30 border-blue-500' : 'border-slate-200 dark:border-slate-700'}`}>
                <Search className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${lang === 'ar' ? 'right-4' : 'left-4'}`} size={22} />
                <input
                  type="text"
                  placeholder={t.searchStudent || "Search student..."}
                  className={`w-full h-16 bg-transparent outline-none text-lg font-medium text-slate-800 dark:text-white ${lang === 'ar' ? 'pr-12 pl-4' : 'pl-12 pr-4'}`}
                  value={search360}
                  onChange={e => {
                    setSearch360(e.target.value);
                    setIsSearchDropdownOpen(true);
                    setSelectedSearchStudent(null);
                  }}
                  onFocus={() => setIsSearchDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setIsSearchDropdownOpen(false), 200)}
                />
                {isSearchDropdownOpen && search360 && !selectedSearchStudent && (
                  <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-b-2xl shadow-2xl mt-1 z-40 max-h-80 overflow-y-auto">
                    {filteredSearchStudents.map(s => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSelectedSearchStudent(s);
                          setSearch360(lang === 'en' ? s.name_en : s.name_ar);
                          setIsSearchDropdownOpen(false);
                          // REMOVED: handleGenerate360() — only on Generate button
                        }}
                        className="w-full text-start px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0"
                      >
                        <div className="font-bold text-slate-800 dark:text-white">{lang === 'en' ? s.name_en : s.name_ar}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{s.studentNumber} • {s.grade}-{s.section} • {s.gender}</div>
                      </button>
                    ))}
                    {filteredSearchStudents.length === 0 && (
                      <div className="px-6 py-8 text-center text-slate-500 dark:text-slate-400 italic">No students found</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex items-center gap-4 h-16">
                <Calendar size={20} className="text-slate-400" />
                <input type="date" value={student360StartDate} onChange={e => setStudent360StartDate(e.target.value)} className="text-sm font-medium bg-transparent border-none outline-none text-slate-700 dark:text-slate-200" />
                <span className="text-slate-400">—</span>
                <input type="date" value={student360EndDate} onChange={e => setStudent360EndDate(e.target.value)} className="text-sm font-medium bg-transparent border-none outline-none text-slate-700 dark:text-slate-200" />
              </div>

              <Button
                onClick={handleGenerate360}
                disabled={!selectedSearchStudent || isGenerating360}
                className="h-16 px-10 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl text-lg font-bold"
              >
                {isGenerating360 ? <Loader2 className="animate-spin mr-3" size={24} /> : <MousePointerClick className="mr-3" size={24} />}
                {t.generate}
              </Button>
            </div>
          </div>
        </div>

        {student360 && student360Data && (
          <div className="space-y-8">
            {/* Profile Header */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl shadow-2xl p-8 text-white">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-8">
                  <div className="w-32 h-32 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                    <UserIcon size={72} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-4xl font-bold">{lang === 'en' ? student360.name_en : student360.name_ar}</h2>
                    <div className="flex flex-wrap gap-3 mt-4">
  <Badge color="gray" className="bg-white/20 text-white text-lg px-5 py-2.5 font-medium backdrop-blur-sm border border-white/30">
    {student360.grade}-{student360.section}
  </Badge>
  <Badge color="gray" className="bg-white/20 text-white text-lg px-5 py-2.5 font-mono backdrop-blur-sm border border-white/30">
    #{student360.studentNumber}
  </Badge>
  <Badge color="gray" className="bg-white/20 text-white text-lg px-5 py-2.5 backdrop-blur-sm border border-white/30">
    {student360.gender}
  </Badge>
  {student360.isWatchlisted && (
    <Badge color="red" className="bg-red-500 hover:bg-red-600 text-white text-lg px-6 py-2.5 font-bold shadow-lg">
      WATCHLIST
    </Badge>
  )}
</div>
                  </div>
                </div>
                <Button variant="secondary" onClick={handlePrint360} className="bg-white/20 hover:bg-white/30 text-white">
                  <Printer size={22} className="mr-3" />
                  Print Profile
                </Button>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-100 dark:border-green-800">
                <div className="p-8 text-center">
                  <p className="text-sm font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-3">Attendance Rate</p>
                  <p className="text-5xl font-bold text-green-600 dark:text-green-400">{presentPct}%</p>
                </div>
              </Card>
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800">
                <div className="p-8 text-center">
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-3">Clinic Visits</p>
                  <p className="text-5xl font-bold text-blue-600 dark:text-blue-400">{student360Data.history.clinic.length}</p>
                </div>
              </Card>
              <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border border-purple-100 dark:border-purple-800">
                <div className="p-8 text-center">
                  <p className="text-sm font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-3">E-Passes</p>
                  <p className="text-5xl font-bold text-purple-600 dark:text-purple-400">{student360Data.history.epasses.length}</p>
                </div>
              </Card>
              <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-100 dark:border-orange-800">
                <div className="p-8 text-center">
                  <p className="text-sm font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-3">Late Arrivals</p>
                  <p className="text-5xl font-bold text-orange-600 dark:text-orange-400">
                    {dailyAttendance.filter(d => d.status === t.late).length}
                  </p>
                </div>
              </Card>
            </div>

            {/* Attendance Pie Chart */}
            <Card className="p-8">
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Attendance Breakdown</h3>
              <div className="h-96 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.name === t.absent ? '#ef4444' : entry.name === t.excused ? '#3b82f6' : '#22c55e'} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={50} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
      <p className="text-6xl font-bold text-slate-800 dark:text-white">
        {presentPct}%
      </p>
      <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-2">
        {t.present}
      </p>
    </div>
              </div>
            </Card>

            {/* Attendance History */}
            <Card>
              <button
                onClick={() => setShowAttendanceHistory(!showAttendanceHistory)}
                className="w-full flex justify-between items-center p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 hover:from-blue-100 dark:hover:from-blue-900/30 transition-all rounded-t-2xl"
              >
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-4">
                  <Calendar size={28} />
                  Daily Attendance History
                </h3>
                {showAttendanceHistory ? <ChevronDown size={28} /> : <ChevronRight size={28} />}
              </button>
              {showAttendanceHistory && (
                <div className="p-6 pt-0">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                      <tr>
                        <th className="p-4 text-start">{t.date}</th>
                        <th className="p-4 text-start">{t.status}</th>
                        <th className="p-4 text-start">{t.notes}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {paginatedAttendance.map((day: any) => (
                        <tr key={day.date} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-4">{new Date(day.date).toLocaleDateString(locale)}</td>
                          <td className="p-4">
                            <Badge color={day.color as any} className="text-lg px-4 py-2">
                              {day.status}
                            </Badge>
                          </td>
                          <td className="p-4 text-slate-600 dark:text-slate-300">{day.note || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination currentPage={attendancePage} totalPages={totalPages} onPageChange={setAttendancePage} className="mt-6" />
                </div>
              )}
            </Card>

            {/* Clinic History */}
            <Card>
              <button
                onClick={() => setShowClinicHistory(!showClinicHistory)}
                className="w-full flex justify-between items-center p-6 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 hover:from-red-100 dark:hover:from-red-900/30 transition-all rounded-t-2xl"
              >
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-4">
                  <Stethoscope size={28} />
                  Clinic History
                </h3>
                {showClinicHistory ? <ChevronDown size={28} /> : <ChevronRight size={28} />}
              </button>
              {showClinicHistory && (
                <div className="p-6 pt-0">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                      <tr>
                        <th className="p-4 text-start">{t.date}</th>
                        <th className="p-4 text-start">{t.symptom}</th>
                        <th className="p-4 text-start">{t.treatment}</th>
                        <th className="p-4 text-start">{t.outcome}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {student360Data.history.clinic.map((v: any) => (
                        <tr key={v.id}>
                          <td className="p-4">{new Date(v.timestamp).toLocaleDateString()}</td>
                          <td className="p-4 font-medium">{v.symptom}</td>
                          <td className="p-4 text-slate-600 dark:text-slate-300">{v.treatment || '-'}</td>
                          <td className="p-4 text-slate-600 dark:text-slate-300">{v.outcome}</td>
                        </tr>
                      ))}
                      {student360Data.history.clinic.length === 0 && (
                        <tr><td colSpan={4} className="p-4 text-center text-slate-400">No clinic visits</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* E-Pass History */}
            <Card>
              <button
                onClick={() => setShowEPassHistory(!showEPassHistory)}
                className="w-full flex justify-between items-center p-6 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 hover:from-purple-100 dark:hover:from-purple-900/30 transition-all rounded-t-2xl"
              >
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-4">
                  <Ticket size={28} />
                  E-Pass History
                </h3>
                {showEPassHistory ? <ChevronDown size={28} /> : <ChevronRight size={28} />}
              </button>
              {showEPassHistory && (
                <div className="p-6 pt-0">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {Object.entries(epassStats).map(([type, count]: any) => (
                      <div key={type} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-center shadow-sm">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{type}</p>
                        <p className="text-3xl font-bold text-slate-800 dark:text-white">{count}</p>
                      </div>
                    ))}
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                      <tr>
                        <th className="p-4 text-start">{t.date}</th>
                        <th className="p-4 text-start">Time</th>
                        <th className="p-4 text-start">{t.type}</th>
                        <th className="p-4 text-start">{t.issuedBy}</th>
                        <th className="p-4 text-start">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {paginatedEPasses.map((p: any) => {
                        const issuer = store.getUser(p.teacherId)?.name || 'Unknown';
                        let destName = p.type;
                        if (p.type !== 'UNAUTHORIZED') {
                          const d = store.getDestinations().find(dest => dest.id === p.type);
                          if (d) destName = lang === 'en' ? d.label_en : d.label_ar;
                        }
                        return (
                          <tr key={p.id}>
                            <td className="p-4">{new Date(p.startTime).toLocaleDateString()}</td>
                            <td className="p-4 font-mono text-xs">{new Date(p.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                            <td className="p-4">
                              {p.type === 'UNAUTHORIZED' ? 
                                <span className="text-red-600 font-bold text-xs bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded">Unauthorized</span> : 
                                <Badge color="blue">{destName}</Badge>
                              }
                            </td>
                            <td className="p-4 text-xs">{issuer}</td>
                            <td className="p-4 text-xs font-mono">
                              {p.endTime ? Math.floor((p.endTime - p.startTime) / 60000) + ' mins' : <span className="text-green-600 dark:text-green-400 font-bold animate-pulse">Active</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <Pagination currentPage={epassPage} totalPages={totalEpassPages} onPageChange={setEpassPage} className="mt-6" />
                </div>
              )}
            </Card>

            {/* Reception History */}
            <Card>
              <button
                onClick={() => setShowReceptionHistory(!showReceptionHistory)}
                className="w-full flex justify-between items-center p-6 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 hover:from-orange-100 dark:hover:from-orange-900/30 transition-all rounded-t-2xl"
              >
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-4">
                  <DoorOpen size={28} />
                  Reception Log
                </h3>
                {showReceptionHistory ? <ChevronDown size={28} /> : <ChevronRight size={28} />}
              </button>
              {showReceptionHistory && (
                <div className="p-6 pt-0">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                      <tr>
                        <th className="p-4 text-start">{t.date}</th>
                        <th className="p-4 text-start">{t.type}</th>
                        <th className="p-4 text-start">{t.reason}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {student360Data.history.reception.map((l: any) => (
                        <tr key={l.id}>
                          <td className="p-4">{new Date(l.timestamp).toLocaleDateString()}</td>
                          <td className="p-4">
                            <Badge color={l.type === 'LateArrival' ? 'blue' : 'orange'}>
                              {l.type === 'LateArrival' ? t.lateArrival : t.earlyLeave}
                            </Badge>
                          </td>
                          <td className="p-4 text-slate-600 dark:text-slate-300">{l.reason || '-'}</td>
                        </tr>
                      ))}
                      {student360Data.history.reception.length === 0 && (
                        <tr><td colSpan={3} className="p-4 text-center text-slate-400">No reception records</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-12">
      <Card className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-2xl">
        <div className="p-2 rounded-2xl bg-white/10 backdrop-blur">
          <div className="flex flex-wrap gap-3 p-3">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-8 py-5 rounded-2xl text-lg font-bold transition-all duration-300 ${
                  activeTab === tab.id 
                    ? 'bg-white text-blue-600 shadow-2xl' 
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <tab.icon size={26} />
                {t[tab.labelKey as keyof typeof t] || tab.labelKey}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {activeTab === 'daily' && renderDailySummary()}
      {activeTab === 'attendance' && renderAttendanceReports()}
      {activeTab === 'clinic' && renderClinicReports()}
      {activeTab === 'epass' && renderEPassReports()}
      {activeTab === 'reception' && renderReceptionReports()}
      {activeTab === 'student360' && renderStudent360()}

      {activeTab !== 'daily' && activeTab !== 'student360' && renderAiCard()}
    </div>
  );
};