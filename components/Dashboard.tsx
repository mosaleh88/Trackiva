import React from 'react';
import { Card } from './ui';
import { UserRole, Language } from '../types';
import { useStore } from '../services/store';
import { TRANSLATIONS } from '../constants';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend 
} from 'recharts';
import { AlertTriangle, Activity, Users, Clock, Stethoscope, LogOut, Ticket, UserX,Ban} from 'lucide-react';

interface DashboardProps {
  role: UserRole;
  lang: Language;
}

export const Dashboard: React.FC<DashboardProps> = ({ role, lang }) => {
  const t = TRANSLATIONS[lang];
  const store = useStore();
  const summary = store.getDataSummary();
  const destinations = store.getDestinations();

  if (!summary) return <div>Loading...</div>;

  // Attendance Calculations for Custom Stacked Bar (3 Groups)
  const total = summary.totalStudents || 1; // Avoid division by zero
  
  // 1. Present on Campus (Present + Late + Early Leave)
  const onCampusCount = summary.presentToday + summary.lateToday + summary.earlyLeaveToday;
  const onCampusPct = (onCampusCount / total) * 100;
  
  // 2. Excused Absent
  const excusedAbsentPct = (summary.excusedAbsentToday / total) * 100;
  
  // 3. Unexcused Absent (Explicit Count, not remainder)
  const unexcusedAbsentCount = summary.unexcusedAbsentToday;
  const unexcusedAbsentPct = (unexcusedAbsentCount / total) * 100;

  // Active E-Pass Destinations Data
  const passData = Object.entries(summary.ePassBreakdown).map(([type, count]) => {
     if (type === 'UNAUTHORIZED') return { name: t.unauthorized, value: count, color: '#ef4444' };
     const dest = destinations.find(d => d.id === type);
     // Map basic colors
     const colorMap: Record<string, string> = {
         blue: '#3b82f6', red: '#ef4444', yellow: '#eab308', green: '#22c55e', 
         purple: '#a855f7', orange: '#f97316', slate: '#64748b'
     };
     return {
         name: dest ? (lang === 'en' ? dest.label_en : dest.label_ar) : type,
         value: count,
         color: dest ? colorMap[dest.colorTheme] : '#94a3b8'
     };
  });


  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="animate-in slide-in-from-bottom-4 fade-in duration-500 delay-100 flex items-center justify-between p-6">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1 font-medium">{t.onCampus}</p>
            <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{onCampusCount}</h3>
                <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">/ {summary.totalStudents}</span>
                <span className="text-xs font-bold text-green-600  dark:bg-green-900/30 px-2 py-1 rounded-lg ml-1">
                    {((onCampusCount / (summary.totalStudents || 1)) * 100).toFixed(0)}%
                </span>
            </div>
          </div>
<div className="p-4 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-2xl shadow-sm inline-flex items-center justify-center">
            <Users size={28} />
          </div>
        </Card>
        
        <Card className="animate-in slide-in-from-bottom-4 fade-in duration-500 delay-100 flex items-center justify-between p-6">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1 font-medium">{t.activePasses}</p>
            <div className="flex flex-col">
                <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{summary.activePasses}</h3>
                {summary.overduePasses > 0 && (
                  <span className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1 animate-pulse mt-1">
                    <AlertTriangle size={12} />
                    {summary.overduePasses} Overdue
                  </span>
                )}
            </div>
          </div>
          <div className="p-4 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl shadow-sm inline-flex items-center justify-center">
            <Ticket size={28} />
          </div>
        </Card>

        <Card className="animate-in slide-in-from-bottom-4 fade-in duration-500 delay-100 flex items-center justify-between p-6">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1 font-medium">{t.clinic} {t.todayVisits}</p>
            <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{summary.clinicVisitsToday}</h3>
          </div>
          <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl shadow-sm inline-flex items-center justify-center">
            <Stethoscope size={28} />
          </div>
        </Card>

        <Card className="animate-in slide-in-from-bottom-4 fade-in duration-500 delay-100 flex items-center justify-between p-6">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1 font-medium">{t.late} / {t.earlyLeave}</p>
            <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{summary.lateToday}</span>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{summary.earlyLeaveToday}</span>
            </div>
          </div>
          <div className="p-4 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-2xl shadow-sm inline-flex items-center justify-center">
            <Clock size={28} />
          </div>
        </Card>
      </div>

      {/* Row 2: Charts & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Recent Activity (Expanded to full height) */}
        <Card className="flex flex-col h-full min-h-[24rem] min-w-0 p-6">
            <h3 className="font-bold text-xl mb-6 text-slate-800 dark:text-white">{t.recentActivity}</h3>
            <div className="flex-1 overflow-y-auto max-h-[20rem] space-y-4 pr-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                {summary.recentIncidents.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500">
                        <p>No recent activity</p>
                    </div>
                ) : (
                summary.recentIncidents.map((log: any) => {
                    let Icon = Activity;
                    let colorClass = "bg-slate-100 text-slate-500";
                    let title = "";
                    
                    if (log.type === 'reception') {
                        if (log.subtype === 'LateArrival') {
                            Icon = Clock;
                            colorClass = "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400";
                            title = t.lateArrival;
                        } else {
                            Icon = LogOut;
                            colorClass = "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400";
                            title = t.earlyLeave;
                        }
                    } else if (log.type === 'epass') {
                        if (log.subtype === 'UNAUTHORIZED') {
                            Icon = AlertTriangle;
                            colorClass = "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400";
                            title = t.unauthorized;
                        } else {
                            Icon = Ticket;
                            colorClass = "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400";
                             const dest = destinations.find(d => d.id === log.subtype);
                             title = dest ? (lang === 'en' ? dest.label_en : dest.label_ar) : log.subtype;
                        }
                    } else if (log.type === 'attendance') {
                        // Map status
                        title = log.subtype; 
                        if (title === 'Absent (Unexcused)') {
                             Icon = UserX;
                             colorClass = "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400";
                             title = t.absent; 
                        } else if (title === 'Absent (Excused)') {
                             Icon = UserX;
                             colorClass = "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400";
                             title = t.excused;
                        } else if (title === 'Late') {
                             Icon = Clock;
                             colorClass = "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400";
                             title = t.late;
                        } else if (title === 'Early Leave') {
                             Icon = LogOut;
                             colorClass = "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400";
                             title = t.earlyLeave;
                        }
                    }

                    return (
                        <div key={log.id} className="flex gap-4 border-b border-slate-50 dark:border-slate-800 pb-3 last:border-0 items-start hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors rounded-xl p-2 -mx-2">
                            <div className={`mt-1 p-2.5 rounded-xl shrink-0 ${colorClass} shadow-sm`}>
                                <Icon size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                    {title}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                    {lang === 'en' ? log.studentName_en : log.studentName_ar}
                                </p>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                                {log.details && <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded-lg inline-block border border-slate-200 dark:border-slate-700">{log.details}</p>}
                                {log.isAlert && (
                                    <span className="text-xs text-red-500 font-bold block mt-1">Alert Triggered</span>
                                )}
                            </div>
                        </div>
                    );
                })
                )}
            </div>
        </Card>

        {/* Center: Attendance Horizontal Stacked Bar (3 Groups) */}
        <Card className="lg:col-span-1 h-full flex flex-col justify-center min-h-[24rem] min-w-0 p-8">
          <h3 className="font-bold text-xl mb-8 text-slate-800 dark:text-white">{t.attendanceOverview}</h3>
          
          <div className="flex-1 flex flex-col justify-center">
              {/* Progress Bar - 3 Segments */}
              <div className="w-full h-10 bg-slate-100 dark:bg-slate-700/50 rounded-full flex overflow-hidden shadow-inner mb-10 relative border border-slate-200 dark:border-slate-600">
                  {onCampusPct > 0 && <div style={{ width: `${onCampusPct}%` }} className="bg-green-500 h-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(34,197,94,0.5)] z-30" />}
                  {excusedAbsentPct > 0 && <div style={{ width: `${excusedAbsentPct}%` }} className="bg-blue-500 h-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)] z-20" />}
                  {unexcusedAbsentPct > 0 && <div style={{ width: `${unexcusedAbsentPct}%` }} className="bg-red-500 h-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(239,68,68,0.5)] z-10" />}
              </div>

              {/* Horizontal Grid Legend - 3 Items */}
              <div className="grid grid-cols-3 gap-6">
                  {/* 1. Present on Campus */}
                  <div className="flex flex-col p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm"></div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide">{t.present}</span>
                      </div>
                      <span className="text-3xl font-bold text-slate-800 dark:text-white">{onCampusCount}</span>
                  </div>
                  
                  {/* 2. Excused */}
                  <div className="flex flex-col p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm"></div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide">{t.excused}</span>
                      </div>
                      <span className="text-3xl font-bold text-slate-800 dark:text-white">{summary.excusedAbsentToday}</span>
                  </div>

                  {/* 3. Absent */}
                  <div className="flex flex-col p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm"></div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide">{t.absent}</span>
                      </div>
                      <span className="text-3xl font-bold text-slate-800 dark:text-white">{unexcusedAbsentCount}</span>
                  </div>
              </div>
          </div>
        </Card>

        {/* Right: E-Pass Pie Chart */}
        <Card className="lg:col-span-1 h-full min-h-[24rem] min-w-0 p-6">
  <h3 className="font-bold text-xl mb-4 text-slate-800 dark:text-white">
    {t.destinationBreakdown}
  </h3>

  <div className="relative h-72 w-full min-w-0 mt-4">
    <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
      <PieChart margin={{ top: 10, bottom: 0, left: 0, right: 0 }}>
        <Pie
          data={passData}
          cx="50%"
          cy="50%"   // Perfect center for the donut
          innerRadius={70}
          outerRadius={95}
          paddingAngle={5}
          cornerRadius={8}
          dataKey="value"
          stroke="none"
          isAnimationActive={false}
        >
          {passData.map((entry: any, index: number) => (
            <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
          ))}
        </Pie>

        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            border: 'none',
            borderRadius: '16px',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            padding: '12px 16px',
            boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)'
          }}
          itemStyle={{ color: 'white' }}
          cursor={{ fill: 'transparent' }}
        />

        <Legend
          verticalAlign="bottom"
          height={10}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{
            paddingTop: '10px',
            fontSize: '11px',
            fontWeight: '600',
            opacity: 0.8,
            width: '100%'
          }}
        />
      </PieChart>
    </ResponsiveContainer>

    {/* Absolute Center Content (Perfect Alignment) */}
   <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {summary.activePasses > 0 ? (
                <>
                  <div className="text-4xl font-extrabold text-slate-800 dark:text-white drop-shadow-lg">
                    {summary.activePasses}
                  </div>
                  <div className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest mt-3 opacity-90">
                    {summary.activePasses === 1 ? t.passes : t.passes}
                  </div>
                </>
              ) : (
                <>
                  <div className="p-6 rounded-full bg-slate-100/80 dark:bg-slate-800/60 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-inner">
                    <Ban size={48} className="text-slate-400 dark:text-slate-600" />
                  </div>
                  <div className="mt-5 text-1xl font-bold text-slate-500 dark:text-slate-400">
                    {t.noActivePasses || "No Active Passes"}
                  </div>
                </>
              )}
            </div>
  </div>
</Card>

      </div>
    </div>
  );
};