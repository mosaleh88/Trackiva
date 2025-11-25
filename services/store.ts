
import { useState, useEffect } from 'react';
import { Student, AttendanceRecord, EPass, ReceptionLog, AttendanceStatus, UserRole, ScheduleConfig, TimeSlot, EPassDestination, AppSettings, ClinicVisit, User } from '../types';
import { generateDefaultPermissions } from '../constants';
import { sendAttendanceAlert } from './telegramService';
import { supabase } from './supabase';

// ... (Default Schedules) ...
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
        rolePermissions: {}, // Initialize as empty
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
  

  // --- Date Standardization Helpers ---
  getTodayStr() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
  }
  
  // Returns the start date of the current academic year (Sept 1st)
  getAcademicYearStartStr() {
    // If configured in calendar, use it
    if (this.data.settings.academicCalendar?.academicYearStart) {
        return this.data.settings.academicCalendar.academicYearStart;
    }

    // Fallback logic
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    
    // If we are in Jan-Aug (0-7), the academic year started in Sept of previous year
    // If we are in Sept-Dec (8-11), the academic year started in Sept of current year
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


  // --- Initialization ---
  async init() {
    if (this.initialized) return;
    await this.refreshData();
    // Lazily generate permissions after modules are loaded
    if (!this.data.settings.rolePermissions || Object.keys(this.data.settings.rolePermissions).length === 0) {
        this.data.settings.rolePermissions = generateDefaultPermissions();
    }
    this.initRealtime();
    this.initialized = true;
  }

  subscribe(callback: () => void) {
    this.subscribers.add(callback);
    return () => { this.subscribers.delete(callback); };
  }

  private notify() {
    this.subscribers.forEach(callback => callback());
  }

  async initRealtime() {
    if (this.isReconnecting) return;
    this.isReconnecting = true;

    // Clear any pending reconnects to avoid race conditions
    if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
    }

    try {
        // Robust Cleanup: Remove ALL channels to ensure a clean slate
        const channels = supabase.getChannels();
        if (channels.length > 0) {
            await Promise.all(channels.map((ch: any) => supabase.removeChannel(ch)));
        }
        this.realtimeChannel = null;

        // Create new channel
        const channelName = `db-changes-${Date.now()}`;
        const channel = supabase.channel(channelName);
        this.realtimeChannel = channel;

        channel
          .on(
            'postgres_changes',
            { event: '*', schema: 'public' },
            (payload: any) => this.handleRealtimeEvent(payload)
          )
          .subscribe((status: string, err: any) => {
            if (status === 'SUBSCRIBED') {
              console.log('Realtime channel connected.');
              this.isReconnecting = false;
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              // Only reconnect if not intentionally closed
              if (!this.reconnectTimeout) {
                  console.warn(`Realtime status: ${status}`, err);
                  this.scheduleReconnect();
              }
            }
          });
    } catch (e) {
        console.error("Error initializing realtime:", e);
        this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
      if (this.reconnectTimeout) return; 
      this.isReconnecting = false; // Allow next attempt
      console.log('Reconnecting realtime in 5s...');
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
          // PREVENT GHOST DATA: Only insert if record is recent (last 7 days)
          let isRecent = true;
          const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
          
          if (newRec.date) { // Attendance
             const recTime = new Date(newRec.date).getTime();
             if (recTime < sevenDaysAgo) isRecent = false;
          } else if (newRec.timestamp) { // Logs
             if (newRec.timestamp < sevenDaysAgo) isRecent = false;
          } else if (newRec.startTime) { // EPass
             if (newRec.startTime < sevenDaysAgo) isRecent = false;
          }

          // Always allow non-time-series data
          if (['students', 'users', 'destinations', 'settings'].includes(key)) isRecent = true;

          if (isRecent) {
             if (!list.some(i => i.id === newRec.id)) list.push(newRec);
          }

      } else if (event === 'UPDATE') {
          const idx = list.findIndex(item => item.id === newRec.id);
          if (idx !== -1) list[idx] = newRec;
      } else if (event === 'DELETE') {
          const idx = list.findIndex(item => item.id === oldRec.id);
          if (idx !== -1) list.splice(idx, 1);
      }
      
      if (['receptionLogs', 'clinicVisits'].includes(key)) {
          list.sort((a, b) => b.timestamp - a.timestamp);
      }
      this.notify();
  }

  // Helper to safely merge data into the store (for manual updates)
  private mergeIntoStore(key: keyof StoreData, record: any) {
      const list = this.data[key] as any[];
      if (Array.isArray(list)) {
          const idx = list.findIndex(r => r.id === record.id);
          if (idx !== -1) list[idx] = record;
          else list.push(record);
          
          if (['receptionLogs', 'clinicVisits'].includes(key)) {
              list.sort((a: any, b: any) => b.timestamp - a.timestamp);
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

          const [students, users] = await Promise.all([
              fetchAllFromTable<Student>('students'),
              fetchAllFromTable<User>('users'),
          ]);

          const [settingsRes, destinationsRes] = await Promise.all([
              supabase.from('settings').select('*').single(),
              supabase.from('destinations').select('*'),
          ]);

          const [attendanceRes, epassesRes, logsRes, visitsRes] = await Promise.all([
              supabase.from('attendance').select('*').gte('date', dateStr),
              supabase.from('epasses').select('*').gte('startTime', timestamp),
              supabase.from('reception_logs').select('*').gte('timestamp', timestamp),
              supabase.from('clinic_visits').select('*').gte('timestamp', timestamp),
          ]);

          this.data.students = students;
          this.data.users = users;
          this.data.destinations = destinationsRes.data || [];
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

  // FETCH ONLY (No Cache Merge by default)
  async fetchDataForRange(startDate: string, endDate: string, options: { cache: boolean } = { cache: false }) {
      try {
        const startTs = this.getStartOfDay(startDate);
        const endTs = this.getEndOfDay(endDate);

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
          fetchTimeSeries<AttendanceRecord>('attendance', 'date', true),
          fetchTimeSeries<EPass>('epasses', 'startTime', false),
          fetchTimeSeries<ReceptionLog>('reception_logs', 'timestamp', false),
          fetchTimeSeries<ClinicVisit>('clinic_visits', 'timestamp', false),
        ]);

          const result = {
              attendance,
              ePasses: epasses,
              receptionLogs: logs,
              clinicVisits: visits
          };

          if (options.cache) {
              this.data.attendance = this.mergeData(this.data.attendance, result.attendance);
              this.data.ePasses = this.mergeData(this.data.ePasses, result.ePasses);
              this.data.receptionLogs = this.mergeData(this.data.receptionLogs, result.receptionLogs);
              this.data.clinicVisits = this.mergeData(this.data.clinicVisits, result.clinicVisits);
              this.notify();
          }

          return result;
      } catch (error) {
        console.error("Error fetching historical data:", error);
          return { attendance: [], ePasses: [], receptionLogs: [], clinicVisits: [] };
      }
  }

  // --- Getters ---
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

  // --- Write Operations ---

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
    const tempPassword = "TempPassword123!"; 
    try {
        await fetch('/api/create_user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email, password: tempPassword, user_metadata: { name: user.name, role: user.role } })
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
    if (error) console.error(error);
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
      // 1. DETERMINE PREVIOUS STATUS
      // We check both local cache AND the database to ensure we don't have stale data.
      // This prevents "New Record" assumptions that lead to duplicate alerts.
      let previousStatus: AttendanceStatus | undefined = undefined;
      let existingId: string | undefined = undefined;
      let existingReason: string | undefined = undefined;

      // Check Cache First
      const cached = this.data.attendance.find(
          a => a.studentId === record.studentId && a.date === record.date && a.period === record.period
      );

      if (cached) {
          previousStatus = cached.status;
          existingId = cached.id;
          existingReason = cached.reason;
      } else {
          // Check DB (fallback for cache miss)
          const { data: dbRecord } = await supabase
              .from('attendance')
              .select('id, status, reason')
              .eq('studentId', record.studentId)
              .eq('date', record.date)
              .eq('period', record.period)
              .maybeSingle();
          
          if (dbRecord) {
              previousStatus = dbRecord.status;
              existingId = dbRecord.id;
              existingReason = dbRecord.reason;
          }
      }

      // Optimization: If nothing changed, return early
      if (previousStatus === record.status && existingReason === record.reason) {
          return { ...record, id: existingId || 'skipped' };
      }

      // 2. ALERT CHECK LOGIC
      // Trigger ONLY if status CHANGED to Absent Unexcused from something else.
      // This strict check prevents duplicate alerts when just updating notes or resaving.
      const isAbsentUnexcused = record.status === AttendanceStatus.ABSENT_UNEXCUSED;
      const wasAbsentUnexcused = previousStatus === AttendanceStatus.ABSENT_UNEXCUSED;
      const shouldCheckAlert = isAbsentUnexcused && !wasAbsentUnexcused;

      // 3. UPDATE DATABASE (Upsert)
      const payload = { 
          studentId: record.studentId,
          date: record.date,
          period: record.period,
          status: record.status,
          reason: record.reason,
          timestamp: Date.now()
      };
      
      let result;
      if (existingId) {
           result = await supabase.from('attendance').update({ ...payload }).eq('id', existingId).select().single();
      } else {
           // Try insert. 
           // Note: If you have a unique constraint on (studentId, date, period), consider .upsert() or handle error
           // For now, we trust the pre-check above handled the existence check.
           result = await supabase.from('attendance').insert(payload).select().single();
      }

      const { data, error } = result;
      if (error) throw error;

      this.mergeIntoStore('attendance', data);

      // 4. TRIGGER ALERT (If applicable)
      if (shouldCheckAlert) {
          await this.checkAttendanceAlert(record.studentId, data.id);
      }
      return data;
  }

  async deleteAttendance(studentId: string, date: string, period: string) {
      const existing = this.data.attendance.find(
          a => a.studentId === studentId && a.date === date && a.period === period
      );
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

      // FETCH FULL HISTORY FOR CURRENT ACADEMIC YEAR
      // Filter out legacy records to ensure alerts align with current year reports.
      const { data: records, error } = await supabase
          .from('attendance')
          .select('*')
          .eq('studentId', studentId)
          .gte('date', this.getAcademicYearStartStr());

      if (error || !records || records.length === 0) return;

      // Helper to calculate total absent days from a set of records
      const calculateAbsentDays = (attendanceRecords: AttendanceRecord[]) => {
          const byDate: Record<string, AttendanceRecord[]> = {};
          attendanceRecords.forEach(r => { if (!byDate[r.date]) byDate[r.date] = []; byDate[r.date].push(r); });

          let days = 0;
          Object.values(byDate).forEach(dayRecords => {
              const unexcused = dayRecords.filter(r => r.status === AttendanceStatus.ABSENT_UNEXCUSED).length;
              if (unexcused >= threshold) {
                  const dateStr = dayRecords[0].date;
                  const [y, m, d] = dateStr.split('-').map(Number);
                  const dateObj = new Date(y, m-1, d); 
                  const isFriday = dateObj.getDay() === 5; 
                  const isSpecialDate = doubleCountDates.includes(dateStr);

                  if ((isFriday && doubleCountFridays) || isSpecialDate) {
                      days += 2;
                  } else {
                      days += 1;
                  }
              }
          });
          return days;
      };

      const currentTotal = calculateAbsentDays(records);
      
      // Calculate previous total by excluding the record that triggered this alert
      // Since we only call this function when status CHANGES to Absent, removing the current record
      // gives us the count BEFORE this specific absence event occurred.
      const previousTotal = calculateAbsentDays(records.filter(r => r.id !== triggerRecordId));

      // Check if we crossed any threshold
      const crossedThreshold = thresholds.find(t => previousTotal < t && currentTotal >= t);

      if (crossedThreshold) {
          const socialWorker = this.getSocialWorkerForStudent(studentId);
          if (socialWorker) {
              console.log(`Triggering Attendance Alert for ${student.name_en}. Crossed ${crossedThreshold}, Current: ${currentTotal}`);
              await sendAttendanceAlert(student, currentTotal, socialWorker);
          }
      }
  }

  getStudentDailyPassCount(studentId: string): number {
      const todayStr = this.getTodayStr();
      const todayStart = this.getStartOfDay(todayStr);
      const todayEnd = this.getEndOfDay(todayStr);
      return this.data.ePasses.filter(p => p.studentId === studentId && p.startTime >= todayStart && p.startTime <= todayEnd && p.type !== 'UNAUTHORIZED').length;
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
          if (visit.linkedPassId && visit.outcome !== 'ReturnToClass') await this.completeEPass(visit.linkedPassId);
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

  // Note: getDataSummary relies on `this.data`. If `this.data` only contains recent records, stats are for recent records.
  getDataSummary() {
    const today = this.getTodayStr();
    const activePasses = this.data.ePasses.filter(p => p.status === 'Active');
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
    todayRecords.forEach(r => { if(studentMap[r.studentId]) studentMap[r.studentId].push(r); });

    let presentCount = 0, lateCount = 0, earlyLeaveCount = 0, excusedAbsentCount = 0, unexcusedAbsentCount = 0;

    Object.values(studentMap).forEach(records => {
        if (records.length === 0) return; 
        
        const unexcused = records.filter(r => r.status === AttendanceStatus.ABSENT_UNEXCUSED).length;
        const excused = records.filter(r => r.status === AttendanceStatus.ABSENT_EXCUSED).length;
        const late = records.some(r => r.status === AttendanceStatus.LATE);
        const early = records.some(r => r.status === AttendanceStatus.EARLY_LEAVE);
        
        if (unexcused >= threshold) { unexcusedAbsentCount++; return; }
        if (countExcusedAsDay && records.length > 0 && excused === records.length) { excusedAbsentCount++; return; }
        if (early) earlyLeaveCount++;
        else if (late) lateCount++;
        else presentCount++;
    });

    const todayStart = this.getStartOfDay(today);
    const todayEnd = this.getEndOfDay(today);
    const todayLogs = this.data.receptionLogs.filter(l => l.timestamp >= todayStart && l.timestamp <= todayEnd);

    // Recent Activity Aggregation
    const recentActivity: any[] = [];
    const studentsLookup = new Map(this.data.students.map(s => [s.id, s]));

    // 1. Reception Logs
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

    // 2. E-Passes (Created)
    this.data.ePasses.forEach(pass => {
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

    // 3. Attendance (Marked) - Exceptions Only
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
      overduePasses: overduePasses,
      ePassBreakdown: ePassDestinations,
      receptionLogsToday: todayLogs.length,
      recentIncidents: recentActivity.slice(0, 10), // Top 10
      clinicVisitsToday: this.data.clinicVisits.filter(v => v.timestamp >= todayStart && v.timestamp <= todayEnd).length
    };
  }

  // New Signature: Use optional sourceData instead of this.data to calculate reports on non-cached datasets
  getReportsData(startDate: string, endDate: string, filters?: { grade?: string, section?: string, gender?: string }, userId?: string, sourceData?: Partial<StoreData>) {
      // Use provided sourceData or fallback to global cache
      const dataSource = sourceData ? { ...this.data, ...sourceData } : this.data;
      
      const startTs = this.getStartOfDay(startDate);
      const endTs = this.getEndOfDay(endDate);
      const threshold = dataSource.settings.attendanceSettings?.absentPeriodThreshold ?? 3;
      const countExcusedAsDay = dataSource.settings.attendanceSettings?.countAllExcusedAsExcusedDay ?? true;
      const doubleCountFridays = dataSource.settings.attendanceSettings?.doubleCountFridays ?? false;
      const doubleCountDates = dataSource.settings.attendanceSettings?.doubleCountDates ?? [];

      let targetStudents = userId ? this.getStudentsForUser(userId) : dataSource.students;
      if (filters) {
          if (filters.grade && filters.grade !== 'All') targetStudents = targetStudents.filter(s => s.grade === filters.grade);
          if (filters.section && filters.section !== 'All') targetStudents = targetStudents.filter(s => s.section === filters.section);
          if (filters.gender && filters.gender !== 'All') targetStudents = targetStudents.filter(s => s.gender === filters.gender);
      }
      const targetStudentIds = new Set(targetStudents.map(s => s.id));

      const filteredAttendance = dataSource.attendance.filter(a => a.date >= startDate && a.date <= endDate && targetStudentIds.has(a.studentId));
      const filteredVisits = dataSource.clinicVisits.filter(v => v.timestamp >= startTs && v.timestamp <= endTs && targetStudentIds.has(v.studentId));
      const filteredPasses = dataSource.ePasses.filter(p => p.startTime >= startTs && p.startTime <= endTs && targetStudentIds.has(p.studentId));
      const filteredLogs = dataSource.receptionLogs.filter(l => l.timestamp >= startTs && l.timestamp <= endTs && targetStudentIds.has(l.studentId));

      // ... (Report Calculation Logic remains mostly same but uses filtered arrays) ...
      const studentAttendance: any = {};
      const attendanceByDateStudent: any = {};
      filteredAttendance.forEach(r => {
          const key = `${r.date}-${r.studentId}`;
          if (!attendanceByDateStudent[key]) attendanceByDateStudent[key] = [];
          attendanceByDateStudent[key].push(r);
      });

      Object.entries(attendanceByDateStudent).forEach(([key, records]: any) => {
          const studentId = key.split('-')[1];
          const recordDate = records[0].date;

          if (!studentAttendance[studentId]) studentAttendance[studentId] = { P: 0, A: 0, EA: 0, L: 0, EL: 0, total: 0 };
          const unexcused = records.filter((r:any) => r.status === AttendanceStatus.ABSENT_UNEXCUSED).length;
          const excused = records.filter((r:any) => r.status === AttendanceStatus.ABSENT_EXCUSED).length;
          const late = records.some((r:any) => r.status === AttendanceStatus.LATE);
          const early = records.some((r:any) => r.status === AttendanceStatus.EARLY_LEAVE);
          
          if (unexcused >= threshold) {
              // DOUBLE COUNT LOGIC
              // Safe date parsing for day of week check (avoid UTC issues)
              const [y, m, d] = recordDate.split('-').map(Number);
              const dateObj = new Date(y, m-1, d); 
              const isFriday = dateObj.getDay() === 5; // 5 = Friday
              const isSpecialDate = doubleCountDates.includes(recordDate);

              if ((isFriday && doubleCountFridays) || isSpecialDate) {
                  studentAttendance[studentId].A += 2;
              } else {
                  studentAttendance[studentId].A += 1;
              }
          }
          else if (countExcusedAsDay && records.length > 0 && excused === records.length) studentAttendance[studentId].EA++;
          else if (early) studentAttendance[studentId].EL++;
          else if (late) studentAttendance[studentId].L++;
          else studentAttendance[studentId].P++;
      });

      const absenteeBuckets = { '1-2': 0, '3-5': 0, '6-9': 0, '10-14': 0, '15+': 0 };
      const excusedBuckets = { '1-2': 0, '3-5': 0, '6-9': 0, '10-14': 0, '15+': 0 };
      const absenteeList: any[] = [];

      Object.entries(studentAttendance).forEach(([sid, stats]: any) => {
          const student = targetStudents.find(s => s.id === sid);
          if (!student) return;
          if (stats.A > 0) {
              if (stats.A >= 15) absenteeBuckets['15+']++;
              else if (stats.A >= 10) absenteeBuckets['10-14']++;
              else if (stats.A >= 6) absenteeBuckets['6-9']++;
              else if (stats.A >= 3) absenteeBuckets['3-5']++;
              else absenteeBuckets['1-2']++;
              absenteeList.push({ ...student, daysAbsent: stats.A, type: 'Unexcused' });
          }
          if (stats.EA > 0) {
             if (stats.EA >= 15) excusedBuckets['15+']++;
              else if (stats.EA >= 10) excusedBuckets['10-14']++;
              else if (stats.EA >= 6) excusedBuckets['6-9']++;
              else if (stats.EA >= 3) excusedBuckets['3-5']++;
              else excusedBuckets['1-2']++;
          }
      });

      const epassCounts: Record<string, number> = {};
      const unauthorizedCounts: Record<string, number> = {};
      const teacherCounts: Record<string, number> = {};
      filteredPasses.forEach(p => {
          epassCounts[p.studentId] = (epassCounts[p.studentId] || 0) + 1;
          if (p.type === 'UNAUTHORIZED') unauthorizedCounts[p.studentId] = (unauthorizedCounts[p.studentId] || 0) + 1;
          if (p.teacherId) teacherCounts[p.teacherId] = (teacherCounts[p.teacherId] || 0) + 1;
      });

      const topEPassUsers = Object.entries(epassCounts).map(([sid, count]) => ({ student: targetStudents.find(s => s.id === sid), count })).filter(i => i.student).sort((a,b) => b.count - a.count).slice(0, 10);
      const topUnauthorized = Object.entries(unauthorizedCounts).map(([sid, count]) => ({ student: targetStudents.find(s => s.id === sid), count })).filter(i => i.student).sort((a,b) => b.count - a.count).slice(0, 10);
      const teacherStats = Object.entries(teacherCounts).map(([tid, count]) => ({ user: dataSource.users.find(u => u.id === tid), count })).filter(i => i.user).sort((a,b) => b.count - a.count);

      return {
          attendance: { buckets: absenteeBuckets, excusedBuckets: excusedBuckets, list: absenteeList },
          clinic: filteredVisits,
          epass: { topUsers: topEPassUsers, topUnauthorized: topUnauthorized, byTeacher: teacherStats },
          reception: filteredLogs
      };
  }

  getStudent360Data(studentId: string, startDate: string, endDate: string, sourceData?: Partial<StoreData>) {
      const dataSource = sourceData ? { ...this.data, ...sourceData } : this.data;
      const startTs = this.getStartOfDay(startDate);
      const endTs = this.getEndOfDay(endDate);

      const history = {
          attendance: dataSource.attendance.filter(a => a.date >= startDate && a.date <= endDate && a.studentId === studentId)
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          clinic: dataSource.clinicVisits.filter(v => v.timestamp >= startTs && v.timestamp <= endTs && v.studentId === studentId)
            .sort((a,b) => b.timestamp - a.timestamp),
          epasses: dataSource.ePasses.filter(p => p.startTime >= startTs && p.startTime <= endTs && p.studentId === studentId)
            .sort((a,b) => b.startTime - a.startTime),
          reception: dataSource.receptionLogs.filter(l => l.timestamp >= startTs && l.timestamp <= endTs && l.studentId === studentId)
            .sort((a,b) => b.timestamp - a.timestamp)
      };
      const attendanceStats = { P: 0, EA: 0, A: 0, L: 0, EL: 0 };
      history.attendance.forEach(a => {
          if(a.status === AttendanceStatus.PRESENT) attendanceStats.P++;
          else if(a.status === AttendanceStatus.ABSENT_EXCUSED) attendanceStats.EA++;
          else if(a.status === AttendanceStatus.ABSENT_UNEXCUSED) attendanceStats.A++;
          else if(a.status === AttendanceStatus.LATE) attendanceStats.L++;
          else if(a.status === AttendanceStatus.EARLY_LEAVE) attendanceStats.EL++;
      });
      return { history, stats: attendanceStats };
  }
}


export async function fetchAllFromTable<T>(
  table: string,
  options: {
    select?: string;
    filter?: (query: any) => any; // optional chaining for filters
    pageSize?: number;
  } = {}
): Promise<T[]> {
  const {
    select = '*',
    filter = (q: any) => q,
    pageSize = 1000
  } = options;

  if (pageSize > 1000) {
    console.warn('Supabase enforces a max of 1000 rows per request. pageSize clamped to 1000.');
  }

  const effectivePageSize = Math.min(pageSize, 1000);
  let all: T[] = [];
  let start = 0;

  while (true) {
    let query = supabase
      .from(table)
      .select(select)
      .range(start, start + effectivePageSize - 1);

    // Apply optional filter (e.g., .eq('grade', '5'))
    query = filter(query);

    const { data, error } = await query;

    if (error) {
      console.error(`Error fetching from table "${table}":`, error);
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    all.push(...data);

    // If we got fewer than requested, we're at the end
    if (data.length < effectivePageSize) {
      break;
    }

    start += effectivePageSize;
  }

  return all;
}

export const store = new SupabaseStore();
export const useStore = () => {
    const [state, setState] = useState(0);
    useEffect(() => {
        return store.subscribe(() => setState(prev => prev + 1));
    }, []);
    return store;
};
