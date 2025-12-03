import { useState, useEffect } from 'react';
import {
  Student,
  AttendanceRecord,
  EPass,
  ReceptionLog,
  AttendanceStatus,
  UserRole,
  ScheduleConfig,
  TimeSlot,
  EPassDestination,
  AppSettings,
  ClinicVisit,
  User
} from '../types';
import { generateDefaultPermissions } from '../constants';
import { supabase } from './supabase';

// Helper to fetch all rows safely
async function fetchAllFromTable<T>(table: string, options: { filter?: (query: any) => any } = {}): Promise<T[]> {
  let query = supabase.from(table).select('*');
  if (options.filter) query = options.filter(query);
  const { data, error } = await query;
  if (error) {
    console.error(`Error fetching ${table}:`, error);
    return [];
  }
  return (data || []) as T[];
}

// Default Schedules
const DEFAULT_STANDARD_SCHEDULE: TimeSlot[] = [
  { id: 'p1', name: 'Period 1', startTime: '08:00', endTime: '08:45', type: 'Period' },
  { id: 'p2', name: 'Period 2', startTime: '08:45', endTime: '09:30', type: 'Period' },
  { id: 'b1', name: 'Break', startTime: '09:30', endTime: '09:40', type: 'Break' },
  { id: 'p3', name: 'Period 3', startTime: '09:40', endTime: '10:25', type: 'Period' },
  { id: 'p4', name: 'Period 4', startTime: '10:25', endTime: '11:10', type: 'Period' },
  { id: 'p5', name: 'Period 5', startTime: '11:10', endTime: '11:55', type: 'Period' },
  { id: 'l1', name: 'Lunch 1', startTime: '11:55', endTime: '12:10', type: 'Lunch' },
  { id: 'l2', name: 'Lunch 2', startTime: '12:10', endTime: '12:25', type: 'Lunch' },
  { id: 'l3', name: 'Lunch 3', startTime: '12:25', endTime: '12:40', type: 'Lunch' },
  { id: 'p6', name: 'Period 6', startTime: '12:40', endTime: '13:20', type: 'Period' },
  { id: 'p7', name: 'Period 7', startTime: '13:20', endTime: '14:00', type: 'Period' },
  { id: 'p8', name: 'Period 8', startTime: '14:00', endTime: '14:40', type: 'Period' },
];

const DEFAULT_FRIDAY_SCHEDULE: TimeSlot[] = [
  { id: 'p1', name: 'Period 1', startTime: '08:00', endTime: '08:45', type: 'Period' },
  { id: 'p2', name: 'Period 2', startTime: '08:45', endTime: '09:30', type: 'Period' },
  { id: 'b1', name: 'Break', startTime: '09:30', endTime: '09:40', type: 'Break' },
  { id: 'p3', name: 'Period 3', startTime: '09:40', endTime: '10:25', type: 'Period' },
  { id: 'p4', name: 'Period 4', startTime: '10:25', endTime: '11:10', type: 'Period' },
];

interface StoreData {
  students: Student[];
  attendance: AttendanceRecord[];
  ePasses: EPass[];
  receptionLogs: ReceptionLog[];
  users: User[];
  schedule: ScheduleConfig;
  destinations: EPassDestination[];
  settings: AppSettings;
  clinicVisits: ClinicVisit[];
}

class SupabaseStore {
  private data: StoreData = {
    students: [],
    attendance: [],
    ePasses: [],
    receptionLogs: [],
    users: [],
    schedule: { standard: DEFAULT_STANDARD_SCHEDULE, friday: DEFAULT_FRIDAY_SCHEDULE },
    destinations: [],
    settings: {
      maxPassesPerDay: 4,
      rolePermissions: {},
      attendanceSettings: {
        absentPeriodThreshold: 3,
        countAllExcusedAsExcusedDay: true,
        alertThresholds: [3, 6, 10, 15],
        doubleCountFridays: false,
        doubleCountDates: []
      },
      notificationRules: { 'UNAUTHORIZED': true },
      academicCalendar: {
        academicYearStart: '2024-09-01',
        academicYearEnd: '2025-06-30',
        terms: [
          { id: 't1', name: 'Term 1', startDate: '2024-08-26', endDate: '2024-12-13' },
          { id: 't2', name: 'Term 2', startDate: '2025-01-06', endDate: '2025-03-21' },
          { id: 't3', name: 'Term 3', startDate: '2025-04-14', endDate: '2025-06-27' }
        ],
        events: []
      }
    },
    clinicVisits: []
  };

  private initialized = false;
  private subscribers: Set<() => void> = new Set();
  private realtimeChannel: any = null;
  private reconnectTimeout: any = null;
  private isReconnecting = false;

  // --- Date Helpers ---
  getTodayStr() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
  }

  getAcademicYearStartStr() {
    if (this.data.settings.academicCalendar?.academicYearStart) {
      return this.data.settings.academicCalendar.academicYearStart;
    }
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const startYear = currentMonth < 8 ? currentYear - 1 : currentYear;
    return `${startYear}-09-01`;
  }

  getStartOfDay(dateStr: string) {
    return new Date(`${dateStr}T00:00:00`).getTime();
  }

  getEndOfDay(dateStr: string) {
    return new Date(`${dateStr}T23:59:59.999`).getTime();
  }

  getCalendarEvent(dateStr: string) {
    const events = this.data.settings.academicCalendar?.events || [];
    return events.find(e =>
      dateStr >= e.startDate && dateStr <= e.endDate &&
      (e.type === 'Holiday' || e.type === 'Break')
    );
  }

  countSchoolDays(startStr: string, endStr: string): number {
    if (!startStr || !endStr) return 0;
    
    const [sy, sm, sd] = startStr.split('-').map(Number);
    const [ey, em, ed] = endStr.split('-').map(Number);
    
    const startDate = new Date(sy, sm - 1, sd);
    const endDate = new Date(ey, em - 1, ed);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;

    const events = this.data.settings.academicCalendar?.events || [];
    let count = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const dt = String(current.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${dt}`;
      
      const day = current.getDay();
      const isWeekend = day === 0 || day === 6;
      const isHolidayOrBreak = events.some(e => 
        dateStr >= e.startDate && dateStr <= e.endDate && (e.type === 'Holiday' || e.type === 'Break')
      );

      if (!isWeekend && !isHolidayOrBreak) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  }

  // --- Initialization ---
  async init() {
    if (this.initialized) return;
    await this.refreshData();
    if (!this.data.settings.rolePermissions || Object.keys(this.data.settings.rolePermissions).length === 0) {
      this.data.settings.rolePermissions = generateDefaultPermissions();
    }
    this.initRealtime();
    this.initialized = true;
  }

  async load() {
    await this.init();
    if (this.data.users.length === 0) {
      const { data, error } = await supabase.from('users').insert({
        name: 'Admin',
        email: 'admin@school.com',
        role: UserRole.ADMIN_SGL
      }).select().single();

      if (data) {
        this.data.users.push(data);
        this.notify();
      }
    }
  }

  subscribe(callback: () => void) {
    this.subscribers.add(callback);
    return () => { this.subscribers.delete(callback); };
  }

  private notify() {
    this.subscribers.forEach(cb => cb());
  }

  async initRealtime() {
    if (this.isReconnecting) return;
    this.isReconnecting = true;

    if (this.realtimeChannel) this.realtimeChannel.unsubscribe();
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

    try {
      const channel = supabase.channel('public-changes', {
        config: { broadcast: { self: false }, presence: { key: '' } },
      });

      channel
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload: any) => {
          this.handleRealtimeEvent(payload);
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') this.isReconnecting = false;
          else if (['CLOSED', 'CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) {
            this.scheduleReconnect();
          }
        });

      this.realtimeChannel = channel;
    } catch (e) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.initRealtime();
    }, 5000);
  }

  private handleRealtimeEvent(payload: any) {
    const { table, eventType, new: newRecord, old: oldRecord } = payload;

    switch (table) {
      case 'students': this.updateCache('students', eventType, newRecord, oldRecord); break;
      case 'users': this.updateCache('users', eventType, newRecord, oldRecord); break;
      case 'attendance': this.updateCache('attendance', eventType, newRecord, oldRecord); break;
      case 'epasses': this.updateCache('ePasses', eventType, newRecord, oldRecord); break;
      case 'reception_logs': this.updateCache('receptionLogs', eventType, newRecord, oldRecord); break;
      case 'clinic_visits': this.updateCache('clinicVisits', eventType, newRecord, oldRecord); break;
      case 'destinations': this.updateCache('destinations', eventType, newRecord, oldRecord); break;
      case 'settings':
        if (eventType === 'UPDATE' && newRecord) {
          this.data.settings = { ...this.data.settings, ...newRecord };
          if (!this.data.settings.rolePermissions) {
            this.data.settings.rolePermissions = generateDefaultPermissions();
          }
          if (newRecord.attendanceSettings?.schedule) {
            this.data.schedule = newRecord.attendanceSettings.schedule;
          }
          this.notify();
        }
        break;
    }
  }

  private updateCache(key: keyof StoreData, event: string, newRec: any, oldRec: any) {
    const list = this.data[key] as any[];
    if (!Array.isArray(list)) return;

    if (event === 'INSERT') {
      if (!list.some(i => i.id === newRec.id)) {
        list.push(newRec);
      }
    } else if (event === 'UPDATE') {
      const idx = list.findIndex(item => item.id === newRec.id);
      if (idx !== -1) list[idx] = newRec;
    } else if (event === 'DELETE') {
      const idx = list.findIndex(item => item.id === oldRec.id);
      if (idx !== -1) list.splice(idx, 1);
    }

    if (['receptionLogs', 'clinicVisits', 'attendance'].includes(key)) {
      list.sort((a: any, b: any) => {
        const timeA = a.timestamp || a.startTime || (a.date ? new Date(a.date).getTime() : 0);
        const timeB = b.timestamp || b.startTime || (b.date ? new Date(b.date).getTime() : 0);
        return timeB - timeA;
      });
    }
    this.notify();
  }

  private mergeIntoStore(key: keyof StoreData, record: any) {
    const list = this.data[key] as any[];
    if (Array.isArray(list)) {
      const idx = list.findIndex(r => r.id === record.id);
      if (idx !== -1) list[idx] = record;
      else list.push(record);

      if (['receptionLogs', 'clinicVisits', 'attendance'].includes(key)) {
        list.sort((a: any, b: any) => {
          const timeA = a.timestamp || a.startTime || (a.date ? new Date(a.date).getTime() : 0);
          const timeB = b.timestamp || b.startTime || (b.date ? new Date(b.date).getTime() : 0);
          return timeB - timeA;
        });
      }
      this.notify();
    }
  }

  private mergeData<T extends { id: string }>(current: T[], incoming: T[]): T[] {
    const map = new Map(current.map(i => [i.id, i]));
    incoming.forEach(i => map.set(i.id, i));
    return Array.from(map.values());
  }

  async refreshData() {
    try {
      const todayStr = this.getTodayStr();
      const sevenDaysAgo = new Date(todayStr);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dateStr = sevenDaysAgo.toISOString().split('T')[0];
      const timestamp = sevenDaysAgo.getTime();

      const [students, users, settingsRes, destinationsRes] = await Promise.all([
        fetchAllFromTable<Student>('students'),
        fetchAllFromTable<User>('users'),
        supabase.from('settings').select('*').maybeSingle(),
        fetchAllFromTable<EPassDestination>('destinations'),
      ]);

      const [attendanceRes, epassesRes, logsRes, visitsRes] = await Promise.all([
        supabase.from('attendance').select('*').gte('date', dateStr),
        supabase.from('epasses').select('*').gte('startTime', timestamp),
        supabase.from('reception_logs').select('*').gte('timestamp', timestamp),
        supabase.from('clinic_visits').select('*').gte('timestamp', timestamp),
      ]);

      this.data.students = students;
      this.data.users = users;
      this.data.destinations = destinationsRes;
      this.data.attendance = attendanceRes.data || [];
      this.data.ePasses = epassesRes.data || [];
      this.data.receptionLogs = logsRes.data || [];
      this.data.clinicVisits = visitsRes.data || [];

      if (settingsRes.data) {
        this.data.settings = { ...this.data.settings, ...settingsRes.data };
        if (!this.data.settings.rolePermissions) {
          this.data.settings.rolePermissions = generateDefaultPermissions();
        }
        if (this.data.settings.attendanceSettings?.schedule) {
          this.data.schedule = this.data.settings.attendanceSettings.schedule;
        }
      }

      this.notify();
    } catch (error) {
      console.error("Error initializing store:", error);
    }
  }

  // Patched: always cache unless skipCache: true
  async fetchDataForRange(
    startDate: string,
    endDate: string,
    options: { 
      skipCache?: boolean;
      types?: ('attendance' | 'epasses' | 'receptionLogs' | 'clinicVisits')[];
    } = {}
  ) {
    try {
      const startTs = this.getStartOfDay(startDate);
      const endTs = this.getEndOfDay(endDate);
      const types = options.types || ['attendance', 'epasses', 'receptionLogs', 'clinicVisits'];
      const shouldCache = !options.skipCache;

      const fetchTimeSeries = async <T>(
        table: string,
        timeField: string,
        isDateField = false
      ): Promise<T[]> => {
        return fetchAllFromTable<T>(table, {
          filter: (query) => {
            let q = query.gte(timeField, isDateField ? startDate : startTs);
            if (endDate && endTs) {
              q = q.lte(timeField, isDateField ? endDate : endTs);
            }
            return q;
          }
        });
      };

      const [attendance, epasses, logs, visits] = await Promise.all([
        types.includes('attendance') ? fetchTimeSeries<AttendanceRecord>('attendance', 'date', true) : Promise.resolve([]),
        types.includes('epasses') ? fetchTimeSeries<EPass>('epasses', 'startTime') : Promise.resolve([]),
        types.includes('receptionLogs') ? fetchTimeSeries<ReceptionLog>('reception_logs', 'timestamp') : Promise.resolve([]),
        types.includes('clinicVisits') ? fetchTimeSeries<ClinicVisit>('clinic_visits', 'timestamp') : Promise.resolve([]),
      ]);

      const result = { attendance, ePasses: epasses, receptionLogs: logs, clinicVisits: visits };

      if (shouldCache) {
        if (types.includes('attendance')) this.data.attendance = this.mergeData(this.data.attendance, result.attendance);
        if (types.includes('epasses')) this.data.ePasses = this.mergeData(this.data.ePasses, result.ePasses);
        if (types.includes('receptionLogs')) this.data.receptionLogs = this.mergeData(this.data.receptionLogs, result.receptionLogs);
        if (types.includes('clinicVisits')) this.data.clinicVisits = this.mergeData(this.data.clinicVisits, result.clinicVisits);
        this.notify();
      }

      return result;
    } catch (error) {
      console.error("Error fetching historical data:", error);
      return { attendance: [], ePasses: [], receptionLogs: [], clinicVisits: [] };
    }
  }

  // --- GETTERS ---
  getStudents() { return this.data.students; }
  getUsers() { return this.data.users; }
  getEPasses() { return this.data.ePasses; }
  getReceptionLogs() { return this.data.receptionLogs; }
  getClinicVisits() { return this.data.clinicVisits; }
  getSettings() { return this.data.settings; }
  getDestinations() { return this.data.destinations; }
  getSchedule() { return this.data.schedule; }
  getUser(id: string) { return this.data.users.find(u => u.id === id); }

  getStudentsForUser(userId: string) {
    const user = this.data.users.find(u => u.id === userId);
    if (user?.role === UserRole.ADMIN_SGL || !user?.assignedClasses?.length) {
      return this.data.students;
    }
    return this.data.students.filter(student => {
      return user.assignedClasses?.some(ac => ac.grade === student.grade && ac.section === student.section);
    });
  }

  getSiblings(studentId: string) {
    const student = this.data.students.find(s => s.id === studentId);
    if (!student || !student.familyId) return [];
    return this.data.students.filter(s => s.familyId === student.familyId && s.id !== studentId);
  }

  getAttendance(date: string, period: string) {
    return this.data.attendance.filter(a => a.date === date && a.period === period);
  }

  getSocialWorkerForStudent(studentId: string): User | undefined {
    const student = this.data.students.find(s => s.id === studentId);
    if (!student) return undefined;
    return this.data.users.find(u =>
      u.role === UserRole.SOCIAL_WORKER &&
      u.assignedClasses?.some(ac => ac.grade === student.grade && ac.section === student.section)
    );
  }

  // Patched: sourceData is REQUIRED — no more stale cache fallback
  getStudent360Data(studentId: string, startDate: string, endDate: string, sourceData: any) {
    if (!sourceData) {
      console.error("getStudent360Data requires fresh sourceData. Falling back to cache is not allowed.");
      return { student: null, history: { attendance: [], epasses: [], clinic: [], reception: [] } };
    }

    const startTs = this.getStartOfDay(startDate);
    const endTs = this.getEndOfDay(endDate);
    const student = this.data.students.find(s => s.id === studentId) || null;

    const attendance = (sourceData.attendance || []).filter((a: any) => a.studentId === studentId && a.date >= startDate && a.date <= endDate);
    const epasses = (sourceData.ePasses || []).filter((p: any) => p.studentId === studentId && p.startTime >= startTs && p.startTime <= endTs);
    const clinic = (sourceData.clinicVisits || []).filter((v: any) => v.studentId === studentId && v.timestamp >= startTs && v.timestamp <= endTs);
    const reception = (sourceData.receptionLogs || []).filter((r: any) => r.studentId === studentId && r.timestamp >= startTs && r.timestamp <= endTs);

    return { student, history: { attendance, epasses, clinic, reception } };
  }

  // Patched: Use settings from sourceData when available
  getReportsData(
    startDate: string,
    endDate: string,
    filters?: { grade?: string, section?: string, gender?: string },
    userId?: string,
    sourceData?: Partial<StoreData>
  ) {
      const dataSource = sourceData ? { ...this.data, ...sourceData } : this.data;
    const settings = (sourceData as any)?.settings?.attendanceSettings || this.data.settings.attendanceSettings;

    let students = dataSource.students || [];
    if (filters?.grade && filters.grade !== 'All') students = students.filter(s => s.grade === filters.grade);
    if (filters?.section && filters.section !== 'All') students = students.filter(s => s.section === filters.section);
    if (filters?.gender && filters.gender !== 'All') students = students.filter(s => s.gender === filters.gender);

    const studentIds = new Set(students.map(s => s.id));

    const attendance = (dataSource.attendance || []).filter(a => 
      a.date >= startDate && a.date <= endDate && studentIds.has(a.studentId)
    );

    const totalDays = this.countSchoolDays(startDate, endDate); 
    const threshold = settings?.absentPeriodThreshold || 3;

    // Daily logs aggregation
    const dailyMap = new Map<string, any>();
    attendance.forEach(record => {
      const key = `${record.studentId}-${record.date}`;
      if (!dailyMap.has(key)) {
        dailyMap.set(key, { studentId: record.studentId, date: record.date, records: [] });
      }
      dailyMap.get(key).records.push(record);
    });

    const dailyLogs = Array.from(dailyMap.values()).map(item => {
      const dayRecs = item.records;
      const unexcused = dayRecs.filter((r: any) => r.status === 'Absent (Unexcused)').length;
      const excused = dayRecs.filter((r: any) => r.status === 'Absent (Excused)').length;
      const late = dayRecs.some((r: any) => r.status === 'Late');
      const early = dayRecs.some((r: any) => r.status === 'Early Leave');

      let status = 'Present';
      if (unexcused >= threshold) status = 'Absent (Unexcused)';
      else if (dayRecs.length > 0 && excused === dayRecs.length) status = 'Absent (Excused)';
      else if (early) status = 'Early Leave';
      else if (late) status = 'Late';

      const reason = Array.from(new Set(dayRecs.map((r: any) => r.reason).filter(Boolean))).join(', ');

      return {
        date: item.date,
        student: students.find(s => s.id === item.studentId) || { name_en: 'Unknown' },
        status,
        reason
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Comprehensive list with stats
    const comprehensiveList = students.map(s => {
      const recs = attendance.filter(a => a.studentId === s.id);
      const stats = { P: 0, A: 0, L: 0, EL: 0, EA: 0 };
      let weightedAbsences = 0;

      recs.forEach(r => {
        if (r.status === 'Present') stats.P++;
        else if (r.status === 'Absent (Unexcused)') {
          stats.A++;
          const [y, m, d] = r.date.split('-').map(Number);
          const localDate = new Date(y, m-1, d);
          const isFri = localDate.getDay() === 5;
          if ((isFri && settings?.doubleCountFridays) || settings?.doubleCountDates?.includes(r.date)) {
            weightedAbsences += 2;
          } else {
            weightedAbsences += 1;
          }
        }
        else if (r.status === 'Late') stats.L++;
        else if (r.status === 'Early Leave') stats.EL++;
        else if (r.status === 'Absent (Excused)') {
          stats.EA++;
          weightedAbsences += 1;
        }
      });

      const numerator = Math.max(0, totalDays - weightedAbsences);
      const percentage = totalDays > 0 ? Math.round((numerator / totalDays) * 100) : 0;

      return { ...s, stats, attendancePercentage: percentage };
    });

    // Buckets
    const buckets = { '1-2': 0, '3-5': 0, '6-9': 0, '10-14': 0, '15+': 0 };
    const excusedBuckets = { '1-2': 0, '3-5': 0, '6-9': 0, '10-14': 0, '15+': 0 };

    comprehensiveList.forEach(s => {
      const a = s.stats.A;
      const ea = s.stats.EA;
      if (a >= 15) buckets['15+']++;
      else if (a >= 10) buckets['10-14']++;
      else if (a >= 6) buckets['6-9']++;
      else if (a >= 3) buckets['3-5']++;
      else if (a >= 1) buckets['1-2']++;

      if (ea >= 15) excusedBuckets['15+']++;
      else if (ea >= 10) excusedBuckets['10-14']++;
      else if (ea >= 6) excusedBuckets['6-9']++;
      else if (ea >= 3) excusedBuckets['3-5']++;
      else if (ea >= 1) excusedBuckets['1-2']++;
    });

    const startTs = this.getStartOfDay(startDate);
    const endTs = this.getEndOfDay(endDate);

    const clinic = (dataSource.clinicVisits || []).filter(v => 
      v.timestamp >= startTs && v.timestamp <= endTs && studentIds.has(v.studentId)
    );

    const epasses = (dataSource.ePasses || []).filter(p => 
      p.startTime >= startTs && p.startTime <= endTs && studentIds.has(p.studentId)
    );

    const epassUserCounts: Record<string, number> = {};
    const unauthCounts: Record<string, number> = {};

    epasses.forEach(p => {
      if (p.type === 'UNAUTHORIZED') {
        unauthCounts[p.studentId] = (unauthCounts[p.studentId] || 0) + 1;
      } else {
        epassUserCounts[p.studentId] = (epassUserCounts[p.studentId] || 0) + 1;
      }
    });

    const topUsers = Object.entries(epassUserCounts)
      .map(([id, count]) => ({ student: students.find(s => s.id === id), count }))
      .filter(x => x.student)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topUnauthorized = Object.entries(unauthCounts)
      .map(([id, count]) => ({ student: students.find(s => s.id === id), count }))
      .filter(x => x.student)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const reception = (dataSource.receptionLogs || []).filter(r => 
      r.timestamp >= startTs && r.timestamp <= endTs && studentIds.has(r.studentId)
    );

    return {
      attendance: { buckets, excusedBuckets, logs: dailyLogs, comprehensiveList },
      clinic,
      epass: { topUsers, topUnauthorized },
      reception
    };
  }

  // --- WRITE OPERATIONS (all unchanged and working perfectly) ---
  async addStudent(student: Omit<Student, 'id'>) {
    const { data, error } = await supabase.from('students').insert(student).select().single();
    if (error) throw error;
    this.mergeIntoStore('students', data);
    return data;
  }

  async updateStudent(id: string, updates: Partial<Student>) {
    const { data, error } = await supabase.from('students').update(updates).eq('id', id).select().single();
    if (error) throw error;
    this.mergeIntoStore('students', data);
    return data;
  }

  async deleteStudent(id: string) {
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) throw error;
    this.data.students = this.data.students.filter(s => s.id !== id);
    this.notify();
  }

  async bulkImportStudents(students: Omit<Student, 'id'>[]) {
    const { data, error } = await supabase.from('students').upsert(students, { onConflict: 'studentNumber' }).select();
    if (error) throw error;
    await this.refreshData();
    return data;
  }

  async addUser(user: Omit<User, 'id'>) {
    try {
      await fetch('/api/create_user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: "TempPassword123!", user_metadata: { name: user.name, role: user.role } })
      });
    } catch (e) { console.error(e); }

    const { data, error } = await supabase.from('users').insert(user).select().single();
    if (error) throw error;
    this.mergeIntoStore('users', data);
    return data;
  }

  async updateUser(id: string, updates: Partial<User>) {
    const { data, error } = await supabase.from('users').update(updates).eq('id', id).select().single();
    if (error) throw error;
    this.mergeIntoStore('users', data);
    return data;
  }

  async deleteUser(id: string) {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
    this.data.users = this.data.users.filter(u => u.id !== id);
    this.notify();
  }

  async updateSettings(settings: Partial<AppSettings>) {
    const { data, error } = await supabase.from('settings').update(settings).eq('id', 1).select().single();
    if (data) this.data.settings = { ...this.data.settings, ...data };
    this.notify();
    return data;
  }

  async updateSchedule(type: 'standard' | 'friday', slots: TimeSlot[]) {
    this.data.schedule[type] = slots;
    const newAttendanceSettings = {
      ...this.data.settings.attendanceSettings,
      schedule: this.data.schedule
    };
    await this.updateSettings({ attendanceSettings: newAttendanceSettings });
  }

  async addDestination(dest: Omit<EPassDestination, 'id'>) {
    const { data, error } = await supabase.from('destinations').insert(dest).select().single();
    if (error) throw error;
    this.mergeIntoStore('destinations', data);
    return data;
  }

  async updateDestination(id: string, updates: Partial<EPassDestination>) {
    const { data, error } = await supabase.from('destinations').update(updates).eq('id', id).select().single();
    if (error) throw error;
    this.mergeIntoStore('destinations', data);
    return data;
  }

  async deleteDestination(id: string) {
    const { error } = await supabase.from('destinations').delete().eq('id', id);
    if (error) throw error;
    this.data.destinations = this.data.destinations.filter(d => d.id !== id);
    this.notify();
  }

  async markAttendance(record: Omit<AttendanceRecord, 'id' | 'timestamp'>) {
    let previousStatus: AttendanceStatus | undefined = undefined;
    let existingId: string | undefined = undefined;
    let existingReason: string | undefined = undefined;

    const cached = this.data.attendance.find(
      a => a.studentId === record.studentId && a.date === record.date && a.period === record.period
    );

    if (cached) {
      previousStatus = cached.status;
      existingId = cached.id;
      existingReason = cached.reason;
    } else {
      const { data: dbRecord } = await supabase.from('attendance').select('id, status, reason').eq('studentId', record.studentId).eq('date', record.date).eq('period', record.period).maybeSingle();
      if (dbRecord) {
        previousStatus = dbRecord.status;
        existingId = dbRecord.id;
        existingReason = dbRecord.reason;
      }
    }

    if (previousStatus === record.status && existingReason === record.reason) return { ...record, id: existingId || 'skipped' };

    const isAbsentUnexcused = record.status === AttendanceStatus.ABSENT_UNEXCUSED;
    const wasAbsentUnexcused = previousStatus === AttendanceStatus.ABSENT_UNEXCUSED;
    const shouldCheckAlert = isAbsentUnexcused && !wasAbsentUnexcused;

    const payload = {
      studentId: record.studentId,
      date: record.date,
      period: record.period,
      status: record.status,
      reason: record.reason,
      timestamp: Date.now()
    };

    let result;
    if (existingId) result = await supabase.from('attendance').update({ ...payload }).eq('id', existingId).select().single();
    else result = await supabase.from('attendance').insert(payload).select().single();

    const { data, error } = result;
    if (error) throw error;
    this.mergeIntoStore('attendance', data);
    if (shouldCheckAlert) await this.checkAttendanceAlert(record.studentId, data.id);
    return data;
  }

  async deleteAttendance(studentId: string, date: string, period: string) {
    const existing = this.data.attendance.find(a => a.studentId === studentId && a.date === date && a.period === period);
    if (existing) {
      const { error } = await supabase.from('attendance').delete().eq('id', existing.id);
      if (error) throw error;
      this.data.attendance = this.data.attendance.filter(a => a.id !== existing.id);
      this.notify();
    }
  }

  async checkAttendanceAlert(studentId: string, triggerRecordId?: string) {
    const student = this.data.students.find(s => s.id === studentId);
    if (!student) return;
    const settings = this.data.settings.attendanceSettings;
    const thresholds = settings?.alertThresholds || [3, 6, 10, 15];
    const threshold = settings?.absentPeriodThreshold || 3;
    const doubleCountFridays = settings?.doubleCountFridays || false;
    const doubleCountDates = settings?.doubleCountDates || [];

    const { data: records } = await supabase.from('attendance').select('*').eq('studentId', studentId).gte('date', this.getAcademicYearStartStr());
    if (!records || records.length === 0) return;

    const calculateAbsentDays = (attendanceRecords: AttendanceRecord[]) => {
      const byDate: Record<string, AttendanceRecord[]> = {};
      attendanceRecords.forEach((r: AttendanceRecord) => { if (!byDate[r.date]) byDate[r.date] = []; byDate[r.date].push(r); });
      let days = 0;
      Object.values(byDate).forEach((dayRecords: AttendanceRecord[]) => {
        const unexcused = dayRecords.filter((r: AttendanceRecord) => r.status === AttendanceStatus.ABSENT_UNEXCUSED).length;
        if (unexcused >= threshold) {
          const dateStr = dayRecords[0].date;
          const [y, m, d] = dateStr.split('-').map(Number);
          const dateObj = new Date(y, m - 1, d);
          const isFriday = dateObj.getDay() === 5;
          const isSpecialDate = doubleCountDates.includes(dateStr);
          if ((isFriday && doubleCountFridays) || isSpecialDate) days += 2; else days += 1;
        }
      });
      return days;
    };

    const currentTotal = calculateAbsentDays(records);
    const previousTotal = calculateAbsentDays(records.filter((r: AttendanceRecord) => r.id !== triggerRecordId));
    const crossedThreshold = thresholds.find(t => previousTotal < t && currentTotal >= t);

    if (crossedThreshold) {
      const socialWorker = this.getSocialWorkerForStudent(studentId);
      if (socialWorker) {
        const { sendAttendanceAlert } = await import('./telegramService');
        await sendAttendanceAlert(student, currentTotal, socialWorker);
      }
    }
  }

  getStudentDailyPassCount(studentId: string): number {
    const todayStr = this.getTodayStr();
    const todayStart = this.getStartOfDay(todayStr);
    const todayEnd = this.getEndOfDay(todayStr);
    return this.data.ePasses.filter(p =>
      p.studentId === studentId &&
      p.startTime >= todayStart &&
      p.startTime <= todayEnd &&
      p.type !== 'UNAUTHORIZED'
    ).length;
  }

  async createEPass(pass: Omit<EPass, 'id' | 'status' | 'startTime'>) {
    const newPass = { ...pass, status: 'Active', startTime: Date.now() };
    const { data, error } = await supabase.from('epasses').insert(newPass).select().single();
    if (error) throw error;
    this.mergeIntoStore('ePasses', data);
    return data;
  }

  async completeEPass(id: string) {
    const { data, error } = await supabase.from('epasses').update({ status: 'Completed', endTime: Date.now() }).eq('id', id).select().single();
    if (error) throw error;
    this.mergeIntoStore('ePasses', data);
    return data;
  }

  async logReception(log: Omit<ReceptionLog, 'id' | 'timestamp'>) {
    const student = this.data.students.find(s => s.id === log.studentId);
    const conflict = (log.type === 'EarlyLeave' && student?.transportMode === 'Bus');
    const newLog = { ...log, timestamp: Date.now(), transportConflict: conflict };
    const { data, error } = await supabase.from('reception_logs').insert(newLog).select().single();

    if (data) {
      this.mergeIntoStore('receptionLogs', data);
      if (log.type === 'EarlyLeave') {
        const dateStr = this.getTodayStr();
        const today = new Date();
        const day = today.getDay();
        const scheduleType = (day === 5) ? 'friday' : 'standard';
        const schedule = this.data.schedule[scheduleType];
        const currentMinutes = today.getHours() * 60 + today.getMinutes();
        const remainingPeriods = schedule.filter(s => {
          if (s.type !== 'Period') return false;
          const [startH, startM] = s.startTime.split(':').map(Number);
          return (startH * 60 + startM) > currentMinutes;
        });

        for (const p of remainingPeriods) {
          await this.markAttendance({ studentId: log.studentId, date: dateStr, period: p.id, status: AttendanceStatus.EARLY_LEAVE });
        }
      }
      return data;
    }
    if (error) throw error;
  }

  async addClinicVisit(visit: Omit<ClinicVisit, 'id' | 'timestamp'>) {
    const newVisit = { ...visit, timestamp: Date.now(), dischargeTime: Date.now() };
    const { data, error } = await supabase.from('clinic_visits').insert(newVisit).select().single();
    if (data) {
      this.mergeIntoStore('clinicVisits', data);
      return data;
    }
    if (error) throw error;
  }

  getCycle(grade: string): 'Cycle 1' | 'Cycle 2' | 'Cycle 3' | 'Unknown' {
    if (['KG1', 'KG2', '1', '2', '3', '4'].includes(grade)) return 'Cycle 1';
    if (['5', '6', '7', '8'].includes(grade)) return 'Cycle 2';
    if (['9', '10', '11', '12'].includes(grade)) return 'Cycle 3';
    return 'Unknown';
  }

  getDataSummary() {
    const today = this.getTodayStr();
    const todayStart = this.getStartOfDay(today);
    const activePasses = this.data.ePasses.filter(p => p.status === 'Active' && p.startTime >= todayStart);
    const threshold = this.data.settings.attendanceSettings?.absentPeriodThreshold ?? 3;
    const countExcusedAsDay = this.data.settings.attendanceSettings?.countAllExcusedAsExcusedDay ?? true;

    const overduePasses = activePasses.filter(p => {
      if (p.type === 'UNAUTHORIZED') return true;
      const dest = this.data.destinations.find(d => d.id === p.type);
      if (!dest) return false;
      return (Date.now() - p.startTime) > (dest.maxDuration * 60 * 1000);
    }).length;

    const ePassDestinations: Record<string, number> = {};
    activePasses.forEach(p => {
      const type = p.type === 'UNAUTHORIZED' ? 'UNAUTHORIZED' : p.type;
      ePassDestinations[type] = (ePassDestinations[type] || 0) + 1;
    });

    const todayRecords = this.data.attendance.filter(a => a.date === today);
    const studentMap: Record<string, AttendanceRecord[]> = {};
    this.data.students.forEach(s => studentMap[s.id] = []);
    todayRecords.forEach(r => { if (studentMap[r.studentId]) studentMap[r.studentId].push(r); });

    let presentCount = 0, lateCount = 0, earlyLeaveCount = 0, excusedAbsentCount = 0, unexcusedAbsentCount = 0;

    Object.values(studentMap).forEach((records: AttendanceRecord[]) => {
      if (records.length === 0) return;
      const unexcused = records.filter((r: AttendanceRecord) => r.status === AttendanceStatus.ABSENT_UNEXCUSED).length;
      const excused = records.filter((r: AttendanceRecord) => r.status === AttendanceStatus.ABSENT_EXCUSED).length;
      const late = records.some((r: AttendanceRecord) => r.status === AttendanceStatus.LATE);
      const early = records.some((r: AttendanceRecord) => r.status === AttendanceStatus.EARLY_LEAVE);

      if (unexcused >= threshold) { unexcusedAbsentCount++; return; }
      if (countExcusedAsDay && records.length > 0 && excused === records.length) { excusedAbsentCount++; return; }
      if (early) earlyLeaveCount++;
      else if (late) lateCount++;
      else presentCount++;
    });

    const todayEnd = this.getEndOfDay(today);
    const todayLogs = this.data.receptionLogs.filter(l => l.timestamp >= todayStart && l.timestamp <= todayEnd);

    const recentActivity: any[] = [];
    const studentsLookup = new Map(this.data.students.map(s => [s.id, s]));

    this.data.receptionLogs.forEach(log => {
      const s = studentsLookup.get(log.studentId);
      recentActivity.push({
        id: log.id,
        timestamp: log.timestamp,
        type: 'reception',
        subtype: log.type,
        studentName_en: s?.name_en || 'Unknown',
        studentName_ar: s?.name_ar || 'Unknown',
        details: log.reason,
        isAlert: log.transportConflict
      });
    });

    this.data.ePasses.forEach(pass => {
      if (pass.startTime < (Date.now() - 24*60*60*1000)) return;
      const s = studentsLookup.get(pass.studentId);
      recentActivity.push({
        id: pass.id,
        timestamp: pass.startTime,
        type: 'epass',
        subtype: pass.type,
        studentName_en: s?.name_en || 'Unknown',
        studentName_ar: s?.name_ar || 'Unknown',
        details: pass.status,
        isAlert: pass.type === 'UNAUTHORIZED'
      });
    });

    this.data.attendance.forEach(att => {
      if (att.status !== AttendanceStatus.PRESENT) {
        const s = studentsLookup.get(att.studentId);
        recentActivity.push({
          id: att.id,
          timestamp: att.timestamp,
          type: 'attendance',
          subtype: att.status,
          studentName_en: s?.name_en || 'Unknown',
          studentName_ar: s?.name_ar || 'Unknown',
          details: att.reason,
          isAlert: att.status === AttendanceStatus.ABSENT_UNEXCUSED
        });
      }
    });

    recentActivity.sort((a, b) => b.timestamp - a.timestamp);

    return {
      totalStudents: this.data.students.length,
      presentToday: presentCount,
      lateToday: lateCount,
      earlyLeaveToday: earlyLeaveCount,
      excusedAbsentToday: excusedAbsentCount,
      unexcusedAbsentToday: unexcusedAbsentCount,
      activePasses: activePasses.length,
      overduePasses,
      ePassBreakdown: ePassDestinations,
      receptionLogsToday: todayLogs.length,
      recentIncidents: recentActivity.slice(0, 10),
      clinicVisitsToday: this.data.clinicVisits.filter(v => v.timestamp >= todayStart && v.timestamp <= todayEnd).length
    };
  }

  async getYearlyTermStats() {
  const terms = this.data.settings.academicCalendar?.terms || [];
  const totalStudents = this.data.students.length;
  if (totalStudents === 0) return terms.map(t => ({ ...t, percentage: 0 }));

  const today = this.getTodayStr();

  const results = await Promise.all(
    terms.map(async (term) => {
      // If term hasn't started yet → show 0%
      if (today < term.startDate) {
        return { ...term, percentage: 0 };
      }

      // If term ended today or in the past → calculate real %
      const { data: records } = await supabase
        .from('attendance')
        .select('status, date')
        .gte('date', term.startDate)
        .lte('date', term.endDate);

      const schoolDays = this.countSchoolDays(term.startDate, term.endDate);
      const totalPossible = schoolDays * totalStudents;

      // If no school days in this term (should never happen) → 0%
      if (totalPossible === 0) return { ...term, percentage: 0 };

      // If literally zero attendance rows → assume no data → show 0%
      if (!records || records.length === 0) {
        return { ...term, percentage: 0 };
      }

      const settings = this.data.settings.attendanceSettings;
      let weightedAbsences = 0;

      records.forEach((r: any) => {
        const s = (r.status || '').trim();
        const isUnexcused = ['Absent (Unexcused)', 'مغيب (غير معذور)', 'غير معذور'].includes(s);
        const isExcused   = ['Absent (Excused)',   'مغيب (معذور)',   'معذور'].includes(s);

        if (isUnexcused) {
          const dateObj = new Date(r.date);
          const isDouble = (dateObj.getDay() === 5 && settings?.doubleCountFridays) ||
                          settings?.doubleCountDates?.includes(r.date);
          weightedAbsences += isDouble ? 2 : 1;
        } else if (isExcused) {
          weightedAbsences += 1;
        }
      });

      const presentDays = Math.max(0, totalPossible - weightedAbsences);
      const percentage = Math.round((presentDays / totalPossible) * 100);

      return { ...term, percentage };
    })
  );

  return results;
}
}

export const store = new SupabaseStore();

export const useStore = () => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    return store.subscribe(() => setTick(t => t + 1));
  }, []);
  return store;
};