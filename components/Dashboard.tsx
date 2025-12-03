import React from 'react';
import { Card, Button, Badge } from './ui';
import { UserRole, Language, EPassDestination } from '../types';
import { useStore } from '../services/store';
import { TRANSLATIONS } from '../constants';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend 
} from 'recharts';
import { AlertTriangle, Activity, Users, Clock, Stethoscope, LogOut, Ticket, UserX, AlertOctagon, CheckCircle2, UserCheck } from 'lucide-react';

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

  if (passData.length === 0) {
      passData.push({ name: 'No Active Passes', value: 1, color: '#94a3b8' });
  }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="animate-in slide-in-from-bottom-4 fade-in duration-500 delay-100">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t.onCampus}</p>
            <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{onCampusCount}</h3>
                <span className="text-xs text-slate-400 dark:text-slate-500">/ {summary.totalStudents}</span>
                <span className="text-xs font-bold text-green-600 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded-md ml-1">
                    {((onCampusCount / (summary.totalStudents || 1)) * 100).toFixed(0)}%
                </span>
            </div>
          </div>
          <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full">
            <Users size={24} />
          </div>
        </Card>
        
        <Card className="animate-in slide-in-from-bottom-4 fade-in duration-500 delay-100">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t.activePasses}</p>
            <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{summary.activePasses}</h3>
                {summary.overduePasses > 0 && (
  <span className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1 animate-pulse">
    <AlertTriangle size={12} className="animate-pulse" />
    {summary.overduePasses} Overdue
  </span>
)}
            </div>
          </div>
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
            <Ticket size={24} />
          </div>
        </Card>

        <Card className="animate-in slide-in-from-bottom-4 fade-in duration-500 delay-100">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t.clinic} {t.todayVisits}</p>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{summary.clinicVisitsToday}</h3>
          </div>
          <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full">
            <Stethoscope size={24} />
          </div>
        </Card>

        <Card className="animate-in slide-in-from-bottom-4 fade-in duration-500 delay-100">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t.late} / {t.earlyLeave}</p>
            <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{summary.lateToday}</span>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <span className="text-xl font-bold text-orange-600 dark:text-orange-400">{summary.earlyLeaveToday}</span>
            </div>
          </div>
          <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full">
            <Clock size={24} />
          </div>
        </Card>
      </div>

      {/* Row 2: Charts & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Recent Activity (Expanded to full height) */}
        <Card className="flex flex-col h-full min-h-[22rem] min-w-0">
            <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">{t.recentActivity}</h3>
            <div className="flex-1 overflow-y-auto max-h-[18rem] space-y-4 pr-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
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
                        <div key={log.id} className="flex gap-3 border-b border-slate-50 dark:border-slate-700 pb-3 last:border-0 items-start hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-lg -mx-2 px-2 py-1">
                            <div className={`mt-1 p-1.5 rounded-full shrink-0 ${colorClass}`}>
                                <Icon size={14} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                    {title}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {lang === 'en' ? log.studentName_en : log.studentName_ar}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                                {log.details && <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 bg-slate-50 dark:bg-slate-700 px-2 py-0.5 rounded inline-block">{log.details}</p>}
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
        <Card className="lg:col-span-1 h-full flex flex-col justify-center min-h-[22rem] min-w-0">
          <h3 className="font-bold text-lg mb-6 text-slate-800 dark:text-white">Attendance Overview</h3>
          
          <div className="flex-1 flex flex-col justify-center">
              {/* Progress Bar - 3 Segments */}
              <div className="w-full h-8 bg-slate-100 dark:bg-slate-700 rounded-full flex overflow-hidden shadow-inner mb-8 relative">
                  {onCampusPct > 0 && <div style={{ width: `${onCampusPct}%` }} className="bg-green-500 h-full transition-all duration-500" />}
                  {excusedAbsentPct > 0 && <div style={{ width: `${excusedAbsentPct}%` }} className="bg-blue-500 h-full transition-all duration-500" />}
                  {unexcusedAbsentPct > 0 && <div style={{ width: `${unexcusedAbsentPct}%` }} className="bg-red-500 h-full transition-all duration-500" />}
              </div>

              {/* Horizontal Grid Legend - 3 Items */}
              <div className="grid grid-cols-3 gap-4">
                  {/* 1. Present on Campus */}
                  <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">{t.onCampus}</span>
                      </div>
                      <span className="text-2xl font-bold text-slate-800 dark:text-white">{onCampusCount}</span>
                  </div>
                  
                  {/* 2. Excused */}
                  <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">{t.excused}</span>
                      </div>
                      <span className="text-2xl font-bold text-slate-800 dark:text-white">{summary.excusedAbsentToday}</span>
                  </div>

                  {/* 3. Absent */}
                  <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">{t.absent}</span>
                      </div>
                      <span className="text-2xl font-bold text-slate-800 dark:text-white">{unexcusedAbsentCount}</span>
                  </div>
              </div>
          </div>
        </Card>

        {/* Right: E-Pass Pie Chart */}
        <Card className="lg:col-span-1 h-full min-h-[22rem] min-w-0">
            <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">{t.destinationBreakdown}</h3>
            <div className="relative h-72 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                    <PieChart>
  <Pie
    data={passData}
    cx="50%"
    cy="50%"
    innerRadius={70}
    outerRadius={100}
    paddingAngle={3}
    cornerRadius={8}
    dataKey="value"
    stroke="none"
    animationBegin={0}
    animationDuration={1200}
    animationEasing="ease-out"
  >
    {passData.map((entry: any, index: number) => (
      <Cell 
        key={`cell-${index}`} 
        fill={entry.color}
        strokeWidth={3}
        stroke="rgba(255,255,255,0.8)"
      />
    ))}
  </Pie>
  <Tooltip 
    contentStyle={{
    backgroundColor: 'rgba(15, 23, 42, 0.95)',  // slate-900 with opacity
    border: 'none',
    borderRadius: '12px',
    color: 'white',
    fontSize: '14px',
    padding: '8px 12px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(12px)',           // this works in modern browsers
    WebkitBackdropFilter: 'blur(12px)'      // Safari support
  }}
  itemStyle={{ color: 'white' }}
  cursor={{ fill: 'rgba(255,255,255,0.1)' }}
  />
  <Legend 
    verticalAlign="bottom" 
    height={50} 
    iconType="circle" 
    wrapperStyle={{fontSize: '13px', paddingTop: '30px', fontWeight: '600'}}
  />
</PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pb-8">
                    <p className="text-3xl font-bold text-slate-800 dark:text-white">{summary.activePasses}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Active</p>
                </div>
            </div>
        </Card>
      </div>
    </div>
  );
};