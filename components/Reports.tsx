
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Badge } from './ui';
import { store } from '../services/store';
import { generateSchoolInsights } from '../services/geminiService';
import { Language, Student } from '../types';
import { TRANSLATIONS } from '../constants';
import { BarChart3, Calendar, Download, Filter, Search, User, LayoutDashboard, Activity, Ticket, DoorOpen, ChevronDown, ChevronRight, Printer, Stethoscope, Clock, AlertTriangle, CheckCircle2, ArrowRight, BrainCircuit } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface ReportsProps {
  lang: Language;
}

const COLORS = ['#22c55e', '#3b82f6', '#ef4444', '#f59e0b', '#f97316'];

const TABS = [
  { id: 'daily', labelKey: 'dailySummary', icon: LayoutDashboard },
  { id: 'attendance', labelKey: 'attendanceReport', icon: BarChart3 },
  { id: 'clinic', labelKey: 'clinicReport', icon: Stethoscope },
  { id: 'epass', labelKey: 'epassReport', icon: Ticket },
  { id: 'reception', labelKey: 'receptionReport', icon: DoorOpen },
  { id: 'student360', labelKey: 'student360', icon: User },
];

const ITEMS_PER_PAGE = 5;

export const Reports: React.FC<ReportsProps> = ({ lang }) => {
  const t = TRANSLATIONS[lang];
  const [activeTab, setActiveTab] = useState('daily');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Global Filters
  const [filterGrade, setFilterGrade] = useState("All");
  const [filterSection, setFilterSection] = useState("All");
  const [filterGender, setFilterGender] = useState("All");

  // Data State
  const [data, setData] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  
  // Student 360 State
  const [search360, setSearch360] = useState("");
  const [student360, setStudent360] = useState<Student | null>(null);
  const [student360Data, setStudent360Data] = useState<any>(null);
  
  // AI Analyst State
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  
  // 360 View Collapsibles
  const [showAttendanceHistory, setShowAttendanceHistory] = useState(true);
  const [showClinicHistory, setShowClinicHistory] = useState(false);
  const [showEPassHistory, setShowEPassHistory] = useState(false);
  const [showReceptionHistory, setShowReceptionHistory] = useState(false);

  // Reset AI when student changes
  useEffect(() => {
      setAiInsight(null);
  }, [student360]);

  // Clear AI insight when tab changes
  useEffect(() => {
      setAiInsight(null);
  }, [activeTab]);

  // Auto-refresh Student 360 data when dates change
  useEffect(() => {
      if (student360) {
          const sData = store.getStudent360Data(student360.id, startDate, endDate);
          setStudent360Data(sData);
      }
  }, [startDate, endDate, student360]);

  // --- AI Analyst Handler ---
  const handleAskAi = async () => {
      setLoadingAi(true);
      try {
          let context: 'global_report' | 'student_profile' = 'global_report';
          let analysisData = data;

          if (activeTab === 'student360' && student360Data) {
              context = 'student_profile';
              analysisData = student360Data;
          }

          const insight = await generateSchoolInsights(analysisData, context, 'Administrator', lang);
          setAiInsight(insight);
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
      
      // Group by date
      records.forEach((r: any) => {
          if (!groups[r.date]) groups[r.date] = [];
          groups[r.date].push(r);
      });

      // Calculate status per day
      return Object.entries(groups).map(([date, dayRecs]) => {
          const unexcused = dayRecs.filter((r: any) => r.status === 'Absent (Unexcused)').length;
          const excused = dayRecs.filter((r: any) => r.status === 'Absent (Excused)').length;
          const late = dayRecs.some((r: any) => r.status === 'Late');
          const early = dayRecs.some((r: any) => r.status === 'Early Leave');
          const total = dayRecs.length;

          let status = 'Present';
          let color = 'green'; // Badge color
          let note = Array.from(new Set(dayRecs.map((r: any) => r.reason).filter(Boolean))).join(', ');

          // Logic from store.getDataSummary
          if (unexcused >= 3) {
              status = 'Absent';
              color = 'red';
          } else if (total > 0 && excused === total) {
              status = 'Excused Absent';
              color = 'blue';
          } else if (early) {
              status = 'Early Leave';
              color = 'orange';
          } else if (late) {
              status = 'Late';
              color = 'yellow';
          }

          return { date, status, color, note };
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [student360Data]);

  // Recalculate Pie Data based on DAILY status
  const pieData = useMemo(() => {
      let p = 0, ea = 0, a = 0; 
      
      dailyAttendance.forEach((day: any) => {
          if (day.status === 'Absent') a++;
          else if (day.status === 'Excused Absent') ea++;
          else p++; // Present, Late, Early Leave
      });

      return [
          { name: t.present, value: p },
          { name: t.excused, value: ea },
          { name: t.absent, value: a }
      ].filter(d => d.value > 0);
  }, [dailyAttendance, t]);

  useEffect(() => {
      setStudents(store.getStudents());
  }, []);

  const refreshReport = () => {
      // Fetch aggregated data with filters
      const reportData = store.getReportsData(startDate, endDate, {
          grade: filterGrade,
          section: filterSection,
          gender: filterGender
      });
      setData(reportData);
      setAiInsight(null);
  };

  // Initial load
  useEffect(() => {
      refreshReport();
  }, []); // Run once on mount, then user triggers "Generate"

  const handleExport = () => {
      alert("Report exported to Excel (Simulated)");
  };

  const handlePrint360 = () => {
      if (!student360) return;
      window.print();
  };

  const uniqueGrades = useMemo(() => Array.from(new Set(students.map(s => s.grade))).sort(), [students]);
  const uniqueSections = useMemo(() => Array.from(new Set(students.map(s => s.section))).sort(), [students]);

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
                          <Button 
                              onClick={handleAskAi} 
                              disabled={loadingAi}
                              className="bg-white/20 hover:bg-white/30 text-white border-none text-xs"
                          >
                              {loadingAi ? t.aiThinking : "Analyze Report"}
                          </Button>
                      )}
                  </div>
                  {aiInsight && (
                      <div className="bg-white/10 rounded-lg p-4 text-sm leading-relaxed animate-in slide-in-from-top-2">
                          {aiInsight}
                      </div>
                  )}
                  {!aiInsight && !loadingAi && (
                      <p className="text-sm text-white/70">
                          Click analyze to get AI-powered insights, trends, and recommendations based on the current report data.
                      </p>
                  )}
              </div>
          </div>
      </Card>
  );

  // --- Daily Summary Logic ---
  const renderDailySummary = () => {
      const summary = store.getDataSummary();
      
      return (
          <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="border-l-4 border-l-green-500">
                      <p className="text-sm text-slate-500">{t.onCampus}</p>
                      <h3 className="text-2xl font-bold">{summary.presentToday + summary.lateToday + summary.earlyLeaveToday}</h3>
                      <p className="text-xs text-slate-400">{((summary.presentToday + summary.lateToday + summary.earlyLeaveToday) / (summary.totalStudents || 1) * 100).toFixed(1)}%</p>
                  </Card>
                  <Card className="border-l-4 border-l-red-500">
                      <p className="text-sm text-slate-500">{t.absent}</p>
                      <h3 className="text-2xl font-bold">{summary.totalStudents - (summary.presentToday + summary.lateToday + summary.earlyLeaveToday + summary.excusedAbsentToday)}</h3>
                  </Card>
                  <Card className="border-l-4 border-l-yellow-500">
                      <p className="text-sm text-slate-500">{t.late}</p>
                      <h3 className="text-2xl font-bold">{summary.lateToday}</h3>
                  </Card>
                  <Card className="border-l-4 border-l-blue-500">
                      <p className="text-sm text-slate-500">{t.clinic} / {t.passes}</p>
                      <h3 className="text-2xl font-bold">{summary.clinicVisitsToday} / {summary.activePasses}</h3>
                  </Card>
              </div>
              <div className="flex justify-end">
                  <Button onClick={handleExport}>
                      <Download size={16} /> {t.exportReport}
                  </Button>
              </div>
          </div>
      );
  };

  const renderAttendanceReports = () => {
      if (!data) return null;

      const bucketData = [
          { name: t.bucket1_2, Unexcused: data.attendance.buckets['1-2'], Excused: data.attendance.excusedBuckets['1-2'] },
          { name: t.bucket3_5, Unexcused: data.attendance.buckets['3-5'], Excused: data.attendance.excusedBuckets['3-5'] },
          { name: t.bucket6_9, Unexcused: data.attendance.buckets['6-9'], Excused: data.attendance.excusedBuckets['6-9'] },
          { name: t.bucket10_14, Unexcused: data.attendance.buckets['10-14'], Excused: data.attendance.excusedBuckets['10-14'] },
          { name: t.bucket15plus, Unexcused: data.attendance.buckets['15+'], Excused: data.attendance.excusedBuckets['15+'] },
      ];

      return (
          <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                      <h3 className="font-bold mb-4 text-slate-700">{t.absentBuckets}</h3>
                      <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
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
                  
                  <Card>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-700">{t.absenteeList}</h3>
                        <Button variant="secondary" className="text-xs h-8" onClick={handleExport}><Download size={14} /></Button>
                      </div>
                      <div className="overflow-y-auto h-64">
                          <table className="w-full text-sm text-left">
                              <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0">
                                  <tr>
                                      <th className="px-3 py-2">{t.studentName}</th>
                                      <th className="px-3 py-2">{t.grade}</th>
                                      <th className="px-3 py-2 text-center">Days</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {data.attendance.list.map((s: any) => (
                                      <tr key={s.id} className="border-b">
                                          <td className="px-3 py-2 font-medium">{lang === 'en' ? s.name_en : s.name_ar}</td>
                                          <td className="px-3 py-2">{s.grade}-{s.section}</td>
                                          <td className={`px-3 py-2 text-center font-bold ${s.daysAbsent >= 15 ? 'text-red-600' : 'text-slate-700'}`}>
                                              {s.daysAbsent}
                                          </td>
                                      </tr>
                                  ))}
                                  {data.attendance.list.length === 0 && (
                                      <tr><td colSpan={3} className="text-center py-4 text-slate-400">No absentees in range</td></tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                  </Card>
              </div>
          </div>
      );
  };

  const renderClinicReports = () => {
      if (!data) return null;
      
      const symptoms: Record<string, number> = {};
      const grades: Record<string, number> = {};
      
      data.clinic.forEach((v: any) => {
          symptoms[v.symptom] = (symptoms[v.symptom] || 0) + 1;
          const s = students.find(stu => stu.id === v.studentId);
          if (s) {
             grades[s.grade] = (grades[s.grade] || 0) + 1;
          }
      });

      const chartData = Object.entries(symptoms).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
      const gradeData = Object.entries(grades).map(([name, value]) => ({ name, value })).sort((a,b) => a.name.localeCompare(b.name));

      return (
          <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                      <h3 className="font-bold mb-4 text-slate-700">{t.topComplaints}</h3>
                      <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
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

                  <Card>
                      <h3 className="font-bold mb-4 text-slate-700">{t.visitsByGrade}</h3>
                      <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
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
          </div>
      );
  };

  const renderEPassReports = () => {
      if (!data) return null;
      return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                  <h3 className="font-bold mb-4 text-slate-700">{t.topEPassUsers}</h3>
                  <ul className="space-y-2">
                      {data.epass.topUsers.map((item: any, i: number) => (
                          <li key={i} className="flex justify-between p-2 bg-slate-50 rounded">
                              <span>{lang === 'en' ? item.student.name_en : item.student.name_ar}</span>
                              <Badge color="blue">{item.count}</Badge>
                          </li>
                      ))}
                  </ul>
              </Card>
              <Card>
                   <h3 className="font-bold mb-4 text-slate-700">{t.topUnauthorized}</h3>
                   <ul className="space-y-2">
                      {data.epass.topUnauthorized.map((item: any, i: number) => (
                          <li key={i} className="flex justify-between p-2 bg-red-50 rounded text-red-700">
                              <span>{lang === 'en' ? item.student.name_en : item.student.name_ar}</span>
                              <Badge color="red">{item.count}</Badge>
                          </li>
                      ))}
                  </ul>
              </Card>
          </div>
      );
  };

  const renderReceptionReports = () => {
      if (!data) return null;
      return (
          <Card>
              <h3 className="font-bold mb-4 text-slate-700">{t.receptionReport}</h3>
               <div className="overflow-y-auto h-96">
                   <table className="w-full text-sm text-left">
                       <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0">
                           <tr>
                               <th className="px-4 py-3">{t.date}</th>
                               <th className="px-4 py-3">{t.studentName}</th>
                               <th className="px-4 py-3">{t.type}</th>
                               <th className="px-4 py-3">{t.reason}</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                           {data.reception.map((log: any) => {
                               const s = students.find(st => st.id === log.studentId);
                               return (
                                   <tr key={log.id}>
                                       <td className="px-4 py-3">{new Date(log.timestamp).toLocaleString()}</td>
                                       <td className="px-4 py-3 font-medium">{s ? (lang === 'en' ? s.name_en : s.name_ar) : 'Unknown'}</td>
                                       <td className="px-4 py-3">
                                           <Badge color={log.type === 'LateArrival' ? 'blue' : 'orange'}>
                                               {log.type === 'LateArrival' ? t.lateArrival : t.earlyLeave}
                                           </Badge>
                                       </td>
                                       <td className="px-4 py-3 text-slate-500">{log.reason || '-'}</td>
                                   </tr>
                               );
                           })}
                       </tbody>
                   </table>
               </div>
          </Card>
      );
  };

  const renderStudent360 = () => {
      // ... Student 360 UI Implementation similar to Clinic Report but aggregated ...
      return (
          <div>
              <div className="relative mb-6">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                  <Input 
                      placeholder={t.searchStudent} 
                      className="pl-10"
                      value={search360}
                      onChange={e => { setSearch360(e.target.value); setStudent360(null); }}
                  />
                  {search360 && !student360 && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 z-20 max-h-60 overflow-y-auto">
                          {students.filter(s => s.name_en.toLowerCase().includes(search360.toLowerCase()) || s.studentNumber.includes(search360)).map(s => (
                              <button 
                                  key={s.id}
                                  onClick={() => { setStudent360(s); setSearch360(lang === 'en' ? s.name_en : s.name_ar); }}
                                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm"
                              >
                                  {lang === 'en' ? s.name_en : s.name_ar} ({s.studentNumber})
                              </button>
                          ))}
                      </div>
                  )}
              </div>

              {student360 && student360Data && (
                  <div className="space-y-6 animate-in fade-in">
                       <div className="flex justify-between items-center">
                           <h2 className="text-2xl font-bold text-slate-800">{lang === 'en' ? student360.name_en : student360.name_ar}</h2>
                           <Button variant="secondary" onClick={handlePrint360}><Printer size={18} /> Print Profile</Button>
                       </div>

                       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                           <Card className="lg:col-span-2">
                               <h3 className="font-bold text-slate-700 mb-4">Attendance Summary</h3>
                               <div className="h-64 flex items-center justify-center">
                                   <ResponsiveContainer width="100%" height="100%">
                                       <PieChart>
                                           <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                               {pieData.map((entry, index) => (
                                                   <Cell key={`cell-${index}`} fill={entry.name === t.absent ? '#ef4444' : entry.name === t.excused ? '#3b82f6' : '#22c55e'} />
                                               ))}
                                           </Pie>
                                           <Tooltip />
                                           <Legend />
                                       </PieChart>
                                   </ResponsiveContainer>
                               </div>
                           </Card>
                           
                           <Card>
                               <h3 className="font-bold text-slate-700 mb-4">Quick Stats</h3>
                               <div className="space-y-4">
                                   <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                       <span className="text-sm text-slate-600">Days Absent</span>
                                       <span className="font-bold text-red-600">{pieData.find(d => d.name === t.absent)?.value || 0}</span>
                                   </div>
                                   <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                       <span className="text-sm text-slate-600">Clinic Visits</span>
                                       <span className="font-bold text-blue-600">{student360Data.history.clinic.length}</span>
                                   </div>
                                   <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                       <span className="text-sm text-slate-600">Late Arrivals</span>
                                       <span className="font-bold text-yellow-600">{dailyAttendance.filter((d:any) => d.status === 'Late').length}</span>
                                   </div>
                               </div>
                           </Card>
                       </div>
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Controls */}
      <Card>
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-end lg:items-center mb-6">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto max-w-full">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-bold whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <tab.icon size={16} />
                        {(t as any)[tab.labelKey]}
                    </button>
                ))}
            </div>
            
            <div className="flex flex-wrap gap-2 items-end">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t.startDate}</label>
                    <div className="relative">
                        <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="py-1.5 text-sm w-36" />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t.endDate}</label>
                    <div className="relative">
                        <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="py-1.5 text-sm w-36" />
                    </div>
                </div>
                <Button onClick={refreshReport} className="h-[34px] text-sm">
                    {t.generate}
                </Button>
            </div>
        </div>

        {/* Advanced Filters (Only for applicable tabs) */}
        {activeTab !== 'student360' && activeTab !== 'daily' && (
            <div className="flex flex-wrap gap-3 items-center pt-4 border-t border-slate-100">
                <Filter size={14} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-500">{t.filterBy}:</span>
                <Select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className="py-1 text-xs w-24">
                    <option value="All">{t.allGrades}</option>
                    {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
                </Select>
                <Select value={filterSection} onChange={e => setFilterSection(e.target.value)} className="py-1 text-xs w-24">
                    <option value="All">{t.allSections}</option>
                    {uniqueSections.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
                <Select value={filterGender} onChange={e => setFilterGender(e.target.value)} className="py-1 text-xs w-24">
                    <option value="All">{t.allGenders}</option>
                    <option value="Male">{t.male}</option>
                    <option value="Female">{t.female}</option>
                </Select>
            </div>
        )}
      </Card>

      {/* AI Insight Card */}
      {renderAiCard()}

      {/* Main Content Area */}
      <div className="min-h-[400px]">
          {activeTab === 'daily' && renderDailySummary()}
          {activeTab === 'attendance' && renderAttendanceReports()}
          {activeTab === 'clinic' && renderClinicReports()}
          {activeTab === 'epass' && renderEPassReports()}
          {activeTab === 'reception' && renderReceptionReports()}
          {activeTab === 'student360' && renderStudent360()}
      </div>

    </div>
  );
};