
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Badge } from './ui';
import { store } from '../services/store';
import { Language, Student } from '../types';
import { TRANSLATIONS } from '../constants';
import { BarChart3, Calendar, Download, Filter, Search, User, LayoutDashboard, Activity, Ticket, DoorOpen, ChevronDown, ChevronRight, Printer, Stethoscope, Clock, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
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
  
  // 360 View Collapsibles
  const [showAttendanceHistory, setShowAttendanceHistory] = useState(true);
  const [showClinicHistory, setShowClinicHistory] = useState(false);
  const [showEPassHistory, setShowEPassHistory] = useState(false);
  const [showReceptionHistory, setShowReceptionHistory] = useState(false);

  // Pagination State
  const [attendancePage, setAttendancePage] = useState(1);

  // Reset pagination when student changes
  useEffect(() => {
      setAttendancePage(1);
  }, [student360]);

  // Auto-refresh Student 360 data when dates change
  useEffect(() => {
      if (student360) {
          const sData = store.getStudent360Data(student360.id, startDate, endDate);
          setStudent360Data(sData);
      }
  }, [startDate, endDate, student360]);

  // --- Moved Hooks from renderStudent360 to top level ---
  
  // Aggregate Attendance Data by Day
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
      
      // Note: Student 360 data is now handled by the dedicated useEffect
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

  // --- Daily Summary Logic ---
  const renderDailySummary = () => {
      // Reuse existing daily summary logic from store for "Today"
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

  // --- Attendance Reports ---
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

  // --- Clinic Reports ---
  const renderClinicReports = () => {
      if (!data) return null;
      
      const symptoms: Record<string, number> = {};
      const grades: Record<string, number> = {};
      const genders: Record<string, number> = {};
      
      data.clinic.forEach((v: any) => {
          symptoms[v.symptom] = (symptoms[v.symptom] || 0) + 1;
          const s = students.find(stu => stu.id === v.studentId);
          if (s) {
             grades[s.grade] = (grades[s.grade] || 0) + 1;
             genders[s.gender] = (genders[s.gender] || 0) + 1;
          }
      });

      const chartData = Object.entries(symptoms).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);

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
                      <h3 className="font-bold mb-4 text-slate-700">Demographic Breakdown</h3>
                      <div className="space-y-6">
                          <div>
                              <h4 className="text-sm font-bold text-slate-500 mb-2">Visits by Grade</h4>
                              <div className="grid grid-cols-3 gap-2">
                                  {Object.entries(grades).sort((a,b) => b[1] - a[1]).map(([grade, count]) => (
                                      <div key={grade} className="flex justify-between p-2 bg-slate-50 rounded border border-slate-100">
                                          <span className="font-mono text-sm">G{grade}</span>
                                          <span className="font-bold text-blue-600">{count}</span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                          <div>
                              <h4 className="text-sm font-bold text-slate-500 mb-2">Visits by Gender</h4>
                              <div className="flex gap-4">
                                  <div className="flex-1 flex justify-between p-3 bg-blue-50 rounded border border-blue-100">
                                      <span className="font-medium text-blue-800">{t.male}</span>
                                      <span className="font-bold text-blue-600">{genders['Male'] || 0}</span>
                                  </div>
                                  <div className="flex-1 flex justify-between p-3 bg-pink-50 rounded border border-pink-100">
                                      <span className="font-medium text-pink-800">{t.female}</span>
                                      <span className="font-bold text-pink-600">{genders['Female'] || 0}</span>
                                  </div>
                              </div>
                          </div>
                      </div>
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

  // --- E-Pass Reports ---
  const renderEPassReports = () => {
     if (!data) return null;
     
     return (
         <div className="space-y-6 animate-in fade-in">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <Card>
                     <h3 className="font-bold mb-4 text-slate-700 flex items-center gap-2">
                         <Ticket size={20} className="text-blue-500" /> {t.topEPassUsers}
                     </h3>
                     <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500">
                                <tr>
                                    <th className="p-2">#</th>
                                    <th className="p-2">{t.studentName}</th>
                                    <th className="p-2">{t.grade}</th>
                                    <th className="p-2 text-right">{t.count}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.epass.topUsers.map((item: any, idx: number) => (
                                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                                        <td className="p-2 text-slate-400 font-mono">{idx + 1}</td>
                                        <td className="p-2 font-medium">{lang === 'en' ? item.student.name_en : item.student.name_ar}</td>
                                        <td className="p-2"><Badge color="gray">{item.student.grade}-{item.student.section}</Badge></td>
                                        <td className="p-2 text-right font-bold text-blue-600">{item.count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                     </div>
                 </Card>

                 <Card>
                     <h3 className="font-bold mb-4 text-slate-700 flex items-center gap-2">
                         <DoorOpen size={20} className="text-red-500" /> {t.topUnauthorized}
                     </h3>
                     <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500">
                                <tr>
                                    <th className="p-2">#</th>
                                    <th className="p-2">{t.studentName}</th>
                                    <th className="p-2">{t.grade}</th>
                                    <th className="p-2 text-right">{t.count}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.epass.topUnauthorized.map((item: any, idx: number) => (
                                    <tr key={idx} className="border-b border-slate-50 hover:bg-red-50/30">
                                        <td className="p-2 text-slate-400 font-mono">{idx + 1}</td>
                                        <td className="p-2 font-medium">{lang === 'en' ? item.student.name_en : item.student.name_ar}</td>
                                        <td className="p-2"><Badge color="gray">{item.student.grade}-{item.student.section}</Badge></td>
                                        <td className="p-2 text-right font-bold text-red-600">{item.count}</td>
                                    </tr>
                                ))}
                                {data.epass.topUnauthorized.length === 0 && (
                                    <tr><td colSpan={4} className="p-4 text-center text-slate-400">No unauthorized exits detected.</td></tr>
                                )}
                            </tbody>
                        </table>
                     </div>
                 </Card>
             </div>
             
             <Card>
                 <h3 className="font-bold mb-4 text-slate-700">{t.teacherPassStats}</h3>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     {data.epass.byTeacher.map((item: any, idx: number) => (
                         <div key={idx} className="p-3 border border-slate-200 rounded-lg flex justify-between items-center hover:bg-slate-50">
                             <div className="flex items-center gap-2">
                                 <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold">
                                     {item.user.name.charAt(0)}
                                 </div>
                                 <span className="text-sm font-medium truncate max-w-[120px]">{item.user.name}</span>
                             </div>
                             <Badge color="blue">{item.count}</Badge>
                         </div>
                     ))}
                 </div>
             </Card>
         </div>
     );
  };

  // --- Student 360 ---
  const renderStudent360 = () => {
      const searchResults = search360 ? students.filter(s => 
        s.name_en.toLowerCase().includes(search360.toLowerCase()) || 
        s.studentNumber.includes(search360)
      ).slice(0, 5) : [];

      // Pagination Logic for Attendance
      const totalPages = Math.ceil(dailyAttendance.length / ITEMS_PER_PAGE);
      const paginatedAttendance = dailyAttendance.slice((attendancePage - 1) * ITEMS_PER_PAGE, attendancePage * ITEMS_PER_PAGE);

      return (
          <div className="space-y-6 animate-in fade-in">
              <Card className="no-print">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <div className="md:col-span-2 relative z-20">
                          <div className="relative">
                              <Search className="absolute left-3 top-3 text-slate-400" size={16} />
                              <Input 
                                  placeholder={t.searchReportPlaceholder} 
                                  className="pl-9" 
                                  value={search360}
                                  onChange={e => { setSearch360(e.target.value); setStudent360(null); setStudent360Data(null); }}
                              />
                              {search360 && !student360 && (
                                  <div className="absolute top-full left-0 right-0 bg-white border rounded-b-lg shadow-lg z-10">
                                      {searchResults.map(s => (
                                          <button 
                                            key={s.id}
                                            onClick={() => { 
                                                setStudent360(s); 
                                                setSearch360(lang === 'en' ? s.name_en : s.name_ar); 
                                                // Note: Data is now fetched by the useEffect on change of student360 or dates
                                            }}
                                            className="w-full text-left p-3 hover:bg-slate-50 text-sm border-b last:border-0"
                                          >
                                              {lang === 'en' ? s.name_en : s.name_ar}
                                          </button>
                                      ))}
                                  </div>
                              )}
                          </div>
                      </div>
                      <div className="md:col-span-1">
                          <label className="block text-xs font-bold text-slate-500 mb-1">{t.dateRange}</label>
                          <div className="flex items-center gap-2">
                              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-sm" />
                              <span className="text-slate-400">-</span>
                              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-sm" />
                          </div>
                      </div>
                  </div>
              </Card>

              {student360 && student360Data && (
                  <div className="space-y-6">
                      {/* Profile Header */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <Card className="col-span-2 flex gap-6 items-center bg-gradient-to-br from-slate-50 to-white">
                              <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 border-4 border-white shadow-sm">
                                  <User size={48} />
                              </div>
                              <div>
                                  <h2 className="text-2xl font-bold text-slate-800">{lang === 'en' ? student360.name_en : student360.name_ar}</h2>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                      <Badge>{student360.grade}-{student360.section}</Badge>
                                      <Badge color="gray">#{student360.studentNumber}</Badge>
                                      <Badge color="gray">{student360.gender}</Badge>
                                      {student360.isWatchlisted && <Badge color="red">Targeted</Badge>}
                                  </div>
                              </div>
                          </Card>
                          
                          {/* Attendance Chart */}
                          <Card className="flex flex-col p-4 h-full min-h-[200px]">
                              <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">{t.attendanceReport}</h4>
                              <div className="w-full flex-1 relative">
                                  <ResponsiveContainer width="100%" height="100%" minHeight={140}>
                                      <PieChart>
                                          <Pie
                                              data={pieData}
                                              cx="50%"
                                              cy="50%"
                                              innerRadius={45}
                                              outerRadius={60}
                                              paddingAngle={5}
                                              dataKey="value"
                                          >
                                              {pieData.map((entry, index) => (
                                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                              ))}
                                          </Pie>
                                          <Tooltip />
                                      </PieChart>
                                  </ResponsiveContainer>
                              </div>
                              <div className="flex gap-3 text-xs mt-2 justify-center">
                                  <div className="flex items-center gap-1"><div className="w-2 h-2 bg-green-500 rounded-full"></div> P</div>
                                  <div className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-500 rounded-full"></div> EA</div>
                                  <div className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-full"></div> A</div>
                              </div>
                          </Card>
                      </div>

                      {/* Summary Cards */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <Card className="p-4">
                              <p className="text-xs text-slate-500 uppercase font-bold">{t.clinic}</p>
                              <h3 className="text-2xl font-bold text-blue-600">{student360Data.history.clinic.length}</h3>
                          </Card>
                          <Card className="p-4">
                              <p className="text-xs text-slate-500 uppercase font-bold">{t.epassReport}</p>
                              <h3 className="text-2xl font-bold text-purple-600">{student360Data.history.epasses.length}</h3>
                          </Card>
                          <Card className="p-4">
                              <p className="text-xs text-slate-500 uppercase font-bold">{t.late}</p>
                              <h3 className="text-2xl font-bold text-yellow-600">{student360Data.stats.L}</h3>
                          </Card>
                          <Card className="p-4">
                              <p className="text-xs text-slate-500 uppercase font-bold">{t.earlyLeave}</p>
                              <h3 className="text-2xl font-bold text-orange-600">{student360Data.stats.EL}</h3>
                          </Card>
                      </div>
                      
                      {/* Collapsible History Sections */}
                      <div className="space-y-4 print:space-y-6">
                          {/* Attendance History (Aggregated Daily) with Pagination */}
                          <div className="border border-slate-200 rounded-xl overflow-hidden">
                              <button 
                                  onClick={() => setShowAttendanceHistory(!showAttendanceHistory)}
                                  className="w-full flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                              >
                                  <span className="font-bold text-slate-700 flex items-center gap-2"><Calendar size={18} /> Attendance Log (Daily)</span>
                                  {showAttendanceHistory ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                              </button>
                              {showAttendanceHistory && (
                                  <div className="bg-white">
                                      <div className="p-4">
                                          <table className="w-full text-sm text-left">
                                              <thead><tr className="text-slate-500"><th>Date</th><th>Status</th><th>Note</th></tr></thead>
                                              <tbody>
                                                  {paginatedAttendance.map((day: any, idx: number) => (
                                                      <tr key={idx} className="border-b border-slate-50 last:border-0">
                                                          <td className="py-2">{new Date(day.date).toLocaleDateString()}</td>
                                                          <td><Badge color={day.color as any}>{day.status}</Badge></td>
                                                          <td className="text-slate-500">{day.note || '-'}</td>
                                                      </tr>
                                                  ))}
                                                  {paginatedAttendance.length === 0 && (
                                                      <tr><td colSpan={3} className="py-4 text-center text-slate-400">No attendance records found</td></tr>
                                                  )}
                                              </tbody>
                                          </table>
                                      </div>
                                      
                                      {/* Pagination Footer */}
                                      {totalPages > 1 && (
                                          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-100">
                                              <span className="text-xs text-slate-500">Page {attendancePage} of {totalPages}</span>
                                              <div className="flex gap-2">
                                                  <Button 
                                                      variant="secondary" 
                                                      className="h-8 px-3 text-xs" 
                                                      onClick={() => setAttendancePage(p => Math.max(1, p - 1))} 
                                                      disabled={attendancePage === 1}
                                                  >
                                                      Previous
                                                  </Button>
                                                  <Button 
                                                      variant="secondary" 
                                                      className="h-8 px-3 text-xs" 
                                                      onClick={() => setAttendancePage(p => Math.min(totalPages, p + 1))} 
                                                      disabled={attendancePage === totalPages}
                                                  >
                                                      Next
                                                  </Button>
                                              </div>
                                          </div>
                                      )}
                                  </div>
                              )}
                          </div>

                          {/* Clinic History */}
                          <div className="border border-slate-200 rounded-xl overflow-hidden">
                              <button 
                                  onClick={() => setShowClinicHistory(!showClinicHistory)}
                                  className="w-full flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                              >
                                  <span className="font-bold text-slate-700 flex items-center gap-2"><Stethoscope size={18} /> Clinic History</span>
                                  {showClinicHistory ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                              </button>
                              {showClinicHistory && (
                                  <div className="p-4 max-h-60 overflow-y-auto bg-white">
                                      <table className="w-full text-sm text-left">
                                          <thead><tr className="text-slate-500"><th>Date</th><th>Symptom</th><th>Severity</th><th>Outcome</th></tr></thead>
                                          <tbody>
                                              {student360Data.history.clinic.map((c: any) => (
                                                  <tr key={c.id} className="border-b border-slate-50">
                                                      <td className="py-2">{new Date(c.timestamp).toLocaleDateString()}</td>
                                                      <td>{c.symptom}</td>
                                                      <td><Badge color={c.severity === 'Emergency' ? 'red' : 'blue'}>{c.severity}</Badge></td>
                                                      <td>{c.outcome}</td>
                                                  </tr>
                                              ))}
                                          </tbody>
                                      </table>
                                  </div>
                              )}
                          </div>

                          {/* E-Pass History */}
                           <div className="border border-slate-200 rounded-xl overflow-hidden">
                              <button 
                                  onClick={() => setShowEPassHistory(!showEPassHistory)}
                                  className="w-full flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                              >
                                  <span className="font-bold text-slate-700 flex items-center gap-2"><Ticket size={18} /> E-Pass Log</span>
                                  {showEPassHistory ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                              </button>
                              {showEPassHistory && (
                                  <div className="p-4 max-h-60 overflow-y-auto bg-white">
                                      <table className="w-full text-sm text-left">
                                          <thead><tr className="text-slate-500"><th>Date</th><th>Destination</th><th>Duration</th></tr></thead>
                                          <tbody>
                                              {student360Data.history.epasses.map((p: any) => {
                                                  const duration = p.endTime ? Math.floor((p.endTime - p.startTime) / 60000) + 'm' : 'Active';
                                                  return (
                                                      <tr key={p.id} className="border-b border-slate-50">
                                                          <td className="py-2">{new Date(p.startTime).toLocaleDateString()} {new Date(p.startTime).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</td>
                                                          <td>
                                                              <Badge color={p.type === 'UNAUTHORIZED' ? 'red' : 'blue'}>{p.type}</Badge>
                                                          </td>
                                                          <td>{duration}</td>
                                                      </tr>
                                                  )
                                              })}
                                          </tbody>
                                      </table>
                                  </div>
                              )}
                          </div>

                          {/* Reception History */}
                          <div className="border border-slate-200 rounded-xl overflow-hidden">
                              <button 
                                  onClick={() => setShowReceptionHistory(!showReceptionHistory)}
                                  className="w-full flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                              >
                                  <span className="font-bold text-slate-700 flex items-center gap-2"><DoorOpen size={18} /> Reception Log</span>
                                  {showReceptionHistory ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                              </button>
                              {showReceptionHistory && (
                                  <div className="p-4 max-h-60 overflow-y-auto bg-white">
                                      <table className="w-full text-sm text-left">
                                          <thead><tr className="text-slate-500"><th>Date</th><th>Type</th><th>Reason</th><th>Picked By</th></tr></thead>
                                          <tbody>
                                              {student360Data.history.reception.map((l: any) => (
                                                  <tr key={l.id} className="border-b border-slate-50">
                                                      <td className="py-2">{new Date(l.timestamp).toLocaleDateString()}</td>
                                                      <td>
                                                          <Badge color={l.type === 'LateArrival' ? 'blue' : 'orange'}>{l.type}</Badge>
                                                      </td>
                                                      <td>{l.reason || '-'}</td>
                                                      <td>{l.pickupBy || '-'}</td>
                                                  </tr>
                                              ))}
                                          </tbody>
                                      </table>
                                  </div>
                              )}
                          </div>
                      </div>

                      <div className="flex justify-end no-print pt-6 border-t border-slate-200">
                          <Button onClick={handlePrint360}>
                              <Printer size={16} /> {t.printCard}
                          </Button>
                      </div>
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className="space-y-6 h-[calc(100vh-9rem)] overflow-y-auto pr-2">
      {/* Top Navigation */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto shrink-0 no-print">
          {TABS.map(tab => (
              <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                  <tab.icon size={16} />
                  {t[tab.labelKey as keyof typeof t]}
              </button>
          ))}
      </div>

      {/* Global Filter Bar (Hidden for Daily Summary & Student 360 which has its own search) */}
      {activeTab !== 'daily' && activeTab !== 'student360' && (
          <Card className="no-print">
              <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 items-end">
                  <div className="lg:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 mb-1">{t.dateRange}</label>
                      <div className="flex items-center gap-2">
                          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                          <span className="text-slate-400">-</span>
                          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                      </div>
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">{t.grade}</label>
                      <Select value={filterGrade} onChange={e => setFilterGrade(e.target.value)}>
                          <option value="All">{t.allGrades}</option>
                          {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
                      </Select>
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">{t.section}</label>
                      <Select value={filterSection} onChange={e => setFilterSection(e.target.value)}>
                          <option value="All">{t.allSections}</option>
                          {uniqueSections.map(s => <option key={s} value={s}>{s}</option>)}
                      </Select>
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">{t.gender}</label>
                      <Select value={filterGender} onChange={e => setFilterGender(e.target.value)}>
                          <option value="All">{t.allGenders}</option>
                          <option value="Male">{t.male}</option>
                          <option value="Female">{t.female}</option>
                      </Select>
                  </div>
                  <div>
                      <Button onClick={refreshReport} className="w-full">
                          {t.generate}
                      </Button>
                  </div>
              </div>
          </Card>
      )}

      {/* Tab Content */}
      <div className="min-h-[400px]">
          {activeTab === 'daily' && renderDailySummary()}
          {activeTab === 'attendance' && renderAttendanceReports()}
          {activeTab === 'clinic' && renderClinicReports()}
          {activeTab === 'epass' && renderEPassReports()}
          {/* Reception Report reusing EPass structure logic for now but specific to logs */}
          {activeTab === 'reception' && data && (
              <Card>
                  <h3 className="font-bold mb-4 text-slate-700">{t.receptionReport}</h3>
                   <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 text-slate-500">
                              <tr>
                                  <th className="p-3">{t.date}</th>
                                  <th className="p-3">{t.studentName}</th>
                                  <th className="p-3">{t.grade}</th>
                                  <th className="p-3">{t.type}</th>
                                  <th className="p-3">{t.reason}</th>
                                  <th className="p-3">{t.pickupBy}</th>
                              </tr>
                          </thead>
                          <tbody>
                              {data.reception.map((log: any) => {
                                  const student = students.find(s => s.id === log.studentId);
                                  return (
                                      <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50">
                                          <td className="p-3">{new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</td>
                                          <td className="p-3 font-bold">{lang === 'en' ? student?.name_en : student?.name_ar}</td>
                                          <td className="p-3"><Badge color="gray">{student?.grade}-{student?.section}</Badge></td>
                                          <td className="p-3"><Badge color={log.type === 'LateArrival' ? 'blue' : 'orange'}>{log.type}</Badge></td>
                                          <td className="p-3">{log.reason || '-'}</td>
                                          <td className="p-3">{log.pickupBy || '-'}</td>
                                      </tr>
                                  )
                              })}
                              {data.reception.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-400">{t.noData}</td></tr>}
                          </tbody>
                      </table>
                  </div>
                  <div className="flex justify-end mt-4">
                      <Button onClick={handleExport}><Download size={16} /> {t.exportReport}</Button>
                  </div>
              </Card>
          )}
          {activeTab === 'student360' && renderStudent360()}
      </div>
    </div>
  );
};
