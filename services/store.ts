import { Student, AttendanceRecord, EPass, ReceptionLog, AttendanceStatus, UserRole, ScheduleConfig, TimeSlot, EPassDestination, AppSettings, ClinicVisit, User } from '../types';
import { DEFAULT_DESTINATIONS, NAV_ITEMS } from '../constants';
import { sendAttendanceAlert } from './telegramService';
import { supabase } from './supabase';

// Default schedules used if not present in DB settings
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

const generateDefaultPermissions = () => {
    const permissions: Record<string, string[]> = {};
    Object.values(UserRole).forEach(role => {
        permissions[role] = NAV_ITEMS.filter(item => item.allowedRoles.includes(role)).map(item => item.id);
    });
    return permissions;
};

class SupabaseStore {
  // Local cache of data
  private data: {
    students: Student[];
    attendance: AttendanceRecord[];
    ePasses: EPass[];
    receptionLogs: ReceptionLog[];
    users: User[];
    schedule: ScheduleConfig;
    destinations: EPassDestination[];
    settings: AppSettings;
    clinicVisits: ClinicVisit[];
  } = {
    students: [],
    attendance: [],
    ePasses: [],
    receptionLogs: [],
    users: [],
    schedule: { standard: DEFAULT_STANDARD_SCHEDULE, friday: DEFAULT_FRIDAY_SCHEDULE },
    destinations: [],
    settings: { 
        maxPassesPerDay: 4,
        rolePermissions: generateDefaultPermissions(),
        attendanceSettings: { absentPeriodThreshold: 3, countAllExcusedAsExcusedDay: true, alertThresholds: [3, 6, 10, 15] },
        notificationRules: { 'UNAUTHORIZED': true }
    },
    clinicVisits: []
  };

  private initialized = false;

  // Initialize: Fetch all data from Supabase
  async init() {
    if (this.initialized) return;
    await this.refreshData();
    this.initialized = true;
  }

  async refreshData() {
    try {
        const [students, users, attendance, epasses, logs, visits, settings, destinations] = await Promise.all([
            supabase.from('students').select('*'),
            supabase.from('users').select('*'),
            supabase.from('attendance').select('*'),
            supabase.from('epasses').select('*'),
            supabase.from('reception_logs').select('*'),
            supabase.from('clinic_visits').select('*'),
            supabase.from('settings').select('*').single(),
            supabase.from('destinations').select('*')
        ]);

        if (students.data) this.data.students = students.data;
        if (users.data) this.data.users = users.data;
        if (attendance.data) this.data.attendance = attendance.data;
        if (epasses.data) this.data.ePasses = epasses.data;
        if (logs.data) this.data.receptionLogs = logs.data;
        if (visits.data) this.data.clinicVisits = visits.data;
        
        if (destinations.data && destinations.data.length > 0) {
            this.data.destinations = destinations.data;
        } else {
            this.data.destinations = DEFAULT_DESTINATIONS;
        }

        if (settings.data) {
            this.data.settings = {
                ...this.data.settings,
                ...settings.data,
                // Merge JSON fields safely
                rolePermissions: settings.data.rolePermissions || this.data.settings.rolePermissions,
                notificationRules: settings.data.notificationRules || this.data.settings.notificationRules,
                attendanceSettings: settings.data.attendanceSettings || this.data.settings.attendanceSettings
            };
            // If schedule is saved in settings, use it
            if (this.data.settings.attendanceSettings?.schedule) {
                this.data.schedule = this.data.settings.attendanceSettings.schedule;
            }
        }
    } catch (error) {
        console.error("Error initializing store from Supabase:", error);
    }
  }

  // --- READ Operations (Synchronous from Cache) ---
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
      if (user?.role === UserRole.ADMIN_SGL || !user?.assignedClasses || user.assignedClasses.length === 0) {
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

  // --- WRITE Operations (Async to Supabase) ---

  async addStudent(student: Omit<Student, 'id'>) {
    const { data, error } = await supabase.from('students').insert(student).select().single();
    if (data) {
        this.data.students.push(data);
        return data;
    }
    if (error) throw error;
  }

  async updateStudent(id: string, updates: Partial<Student>) {
    const { data, error } = await supabase.from('students').update(updates).eq('id', id).select().single();
    if (data) {
        const idx = this.data.students.findIndex(s => s.id === id);
        if (idx !== -1) this.data.students[idx] = data;
    }
    if (error) throw error;
  }

  async deleteStudent(id: string) {
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (!error) {
        this.data.students = this.data.students.filter(s => s.id !== id);
    } else { throw error; }
  }

  async bulkImportStudents(students: Omit<Student, 'id'>[]) {
    const { data, error } = await supabase.from('students').insert(students).select();
    if (data) {
        this.data.students = [...this.data.students, ...data];
    }
    if (error) throw error;
  }

  async addUser(user: Omit<User, 'id'>) {
    // 1. Call Cloudflare Function to create Auth User (requires server-side logic)
    // We generate a temporary password for the user
    const tempPassword = "TempPassword123!"; 
    
    try {
        const response = await fetch('/api/create_user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: user.email, 
                password: tempPassword,
                user_metadata: { name: user.name, role: user.role }
            })
        });

        if (!response.ok) {
            const err = await response.json();
            // If error is that user exists, we proceed to try creating the profile
            // Otherwise, throw error
            if (!err.error?.includes("already registered")) {
                throw new Error(err.error || "Failed to create auth user");
            }
        } else {
            const { user: authUser } = await response.json();
            // Optionally use authUser.id if we want tight coupling
        }
    } catch (e) {
        console.error("Auth creation warning:", e);
        // Proceeding to create profile anyway, user might have been created manually
    }

    // 2. Create Profile in public.users
    const { data, error } = await supabase.from('users').insert(user).select().single();
    if (data) this.data.users.push(data);
    if (error) throw error;
  }

  async updateUser(id: string, updates: Partial<User>) {
    const { data, error } = await supabase.from('users').update(updates).eq('id', id).select().single();
    if (data) {
        const idx = this.data.users.findIndex(u => u.id === id);
        if (idx !== -1) this.data.users[idx] = data;
    }
    if (error) throw error;
  }

  async deleteUser(id: string) {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (!error) {
        this.data.users = this.data.users.filter(u => u.id !== id);
    } else { throw error; }
  }

  async updateSettings(settings: Partial<AppSettings>) {
    // We assume ID 1 is the single settings row
    const { data, error } = await supabase.from('settings').update(settings).eq('id', 1).select().single();
    if (data) {
        this.data.settings = { ...this.data.settings, ...data };
    } else if (error) {
        console.error(error);
    }
  }

  async updateSchedule(type: 'standard' | 'friday', slots: TimeSlot[]) {
      this.data.schedule[type] = slots;
      // Save schedule inside attendanceSettings JSONB
      const currentAttendanceSettings = this.data.settings.attendanceSettings;
      const newAttendanceSettings = { 
          ...currentAttendanceSettings,
          schedule: this.data.schedule
      };
      await this.updateSettings({ attendanceSettings: newAttendanceSettings });
  }

  async addDestination(dest: Omit<EPassDestination, 'id'>) {
      // Assuming ID is provided or auto-generated by text input in form, 
      // but here we let Supabase or Logic handle it. 
      // Ideally dest.id should be unique string like 'Library'
      const { data, error } = await supabase.from('destinations').insert(dest).select().single();
      if (data) this.data.destinations.push(data);
      if (error) throw error;
  }

  async updateDestination(id: string, updates: Partial<EPassDestination>) {
      const { data, error } = await supabase.from('destinations').update(updates).eq('id', id).select().single();
      if (data) {
          const idx = this.data.destinations.findIndex(d => d.id === id);
          if (idx !== -1) this.data.destinations[idx] = data;
      }
  }

  async deleteDestination(id: string) {
      const { error } = await supabase.from('destinations').delete().eq('id', id);
      if (!error) {
          this.data.destinations = this.data.destinations.filter(d => d.id !== id);
      }
  }

  async markAttendance(record: Omit<AttendanceRecord, 'id' | 'timestamp'>) {
      const existing = this.data.attendance.find(
          a => a.studentId === record.studentId && a.date === record.date && a.period === record.period
      );

      if (existing) {
          const { data, error } = await supabase.from('attendance')
              .update({ status: record.status, reason: record.reason, timestamp: Date.now() })
              .eq('id', existing.id)
              .select().single();
          if (data) {
              const idx = this.data.attendance.findIndex(a => a.id === existing.id);
              this.data.attendance[idx] = data;
          }
      } else {
          const { data, error } = await supabase.from('attendance')
              .insert({ ...record, timestamp: Date.now() })
              .select().single();
          if (data) this.data.attendance.push(data);
      }
  }

  async deleteAttendance(studentId: string, date: string, period: string) {
      const existing = this.data.attendance.find(
          a => a.studentId === studentId && a.date === date && a.period === period
      );
      if (existing) {
          const { error } = await supabase.from('attendance').delete().eq('id', existing.id);
          if (!error) {
              this.data.attendance = this.data.attendance.filter(a => a.id !== existing.id);
          }
      }
  }

  // Logic only, no DB write (DB write happened in markAttendance)
  checkAttendanceAlert(studentId: string) {
      const student = this.data.students.find(s => s.id === studentId);
      if (!student) return;

      const settings = this.data.settings.attendanceSettings;
      const thresholds = settings?.alertThresholds || [3, 6, 10, 15];
      const threshold = settings?.absentPeriodThreshold || 3;

      const records = this.data.attendance.filter(a => a.studentId === studentId);
      const byDate: Record<string, AttendanceRecord[]> = {};
      records.forEach(r => {
          if (!byDate[r.date]) byDate[r.date] = [];
          byDate[r.date].push(r);
      });

      let totalAbsentDays = 0;
      Object.values(byDate).forEach(dayRecords => {
          const unexcused = dayRecords.filter(r => r.status === AttendanceStatus.ABSENT_UNEXCUSED).length;
          if (unexcused >= threshold) {
              totalAbsentDays++;
          }
      });

      if (thresholds.includes(totalAbsentDays)) {
          const socialWorker = this.getSocialWorkerForStudent(studentId);
          if (socialWorker) {
              sendAttendanceAlert(student, totalAbsentDays, socialWorker);
          }
      }
  }

  getStudentDailyPassCount(studentId: string): number {
      const today = new Date().setHours(0,0,0,0);
      return this.data.ePasses.filter(p => {
          const passDate = new Date(p.startTime).setHours(0,0,0,0);
          return p.studentId === studentId && passDate === today && p.type !== 'UNAUTHORIZED';
      }).length;
  }

  async createEPass(pass: Omit<EPass, 'id' | 'status' | 'startTime'>) {
      const newPass = {
          ...pass,
          status: 'Active',
          startTime: Date.now()
      };
      const { data, error } = await supabase.from('epasses').insert(newPass).select().single();
      if (data) {
          this.data.ePasses.push(data);
          return data;
      }
      if (error) throw error;
  }

  async completeEPass(id: string) {
      const { data, error } = await supabase.from('epasses')
          .update({ status: 'Completed', endTime: Date.now() })
          .eq('id', id)
          .select().single();
      
      if (data) {
          const idx = this.data.ePasses.findIndex(p => p.id === id);
          if (idx !== -1) this.data.ePasses[idx] = data;
      }
  }

  async logReception(log: Omit<ReceptionLog, 'id' | 'timestamp'>) {
      const student = this.data.students.find(s => s.id === log.studentId);
      let conflict = false;
      if (log.type === 'EarlyLeave' && student?.transportMode === 'Bus') {
          conflict = true; 
      }

      const newLog = { ...log, timestamp: Date.now(), transportConflict: conflict };
      const { data, error } = await supabase.from('reception_logs').insert(newLog).select().single();
      
      if (data) {
          this.data.receptionLogs.unshift(data);
          
          // Auto-attendance for Early Leave
          if (log.type === 'EarlyLeave') {
              const today = new Date();
              const dateStr = today.toISOString().split('T')[0];
              const day = today.getDay();
              const scheduleType = (day === 5) ? 'friday' : 'standard';
              const schedule = this.data.schedule[scheduleType];
              const currentMinutes = today.getHours() * 60 + today.getMinutes();

              // FIX: Only mark periods that START AFTER current time
              const remainingPeriods = schedule.filter(s => {
                  if (s.type !== 'Period') return false;
                  const [startH, startM] = s.startTime.split(':').map(Number);
                  return (startH * 60 + startM) > currentMinutes;
              });

              // Async mark attendance
              for (const p of remainingPeriods) {
                  await this.markAttendance({
                      studentId: log.studentId,
                      date: dateStr,
                      period: p.id,
                      status: AttendanceStatus.EARLY_LEAVE
                  });
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
          this.data.clinicVisits.unshift(data);
          if (visit.linkedPassId && visit.outcome !== 'ReturnToClass') {
              await this.completeEPass(visit.linkedPassId);
          }
          return data;
      }
      if (error) throw error;
  }

  // --- Reporting Helpers (Same as before, using cached data) ---
  getCycle(grade: string): 'Cycle 1' | 'Cycle 2' | 'Cycle 3' | 'Unknown' {
    if (['KG1', 'KG2', '1', '2', '3', '4'].includes(grade)) return 'Cycle 1';
    if (['5', '6', '7', '8'].includes(grade)) return 'Cycle 2';
    if (['9', '10', '11', '12'].includes(grade)) return 'Cycle 3';
    return 'Unknown';
  }

  getDataSummary() {
    const today = new Date().toISOString().split('T')[0];
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

    let presentCount = 0, lateCount = 0, earlyLeaveCount = 0, excusedAbsentCount = 0;

    Object.values(studentMap).forEach(records => {
        if (records.length === 0) return; 
        const unexcused = records.filter(r => r.status === AttendanceStatus.ABSENT_UNEXCUSED).length;
        const excused = records.filter(r => r.status === AttendanceStatus.ABSENT_EXCUSED).length;
        const late = records.some(r => r.status === AttendanceStatus.LATE);
        const early = records.some(r => r.status === AttendanceStatus.EARLY_LEAVE);
        const totalMarked = records.length;

        if (unexcused >= threshold) return;
        if (countExcusedAsDay && totalMarked > 0 && excused === totalMarked) {
            excusedAbsentCount++;
            return;
        }
        if (early) earlyLeaveCount++;
        else if (late) lateCount++;
        else presentCount++;
    });

    const todayLogs = this.data.receptionLogs.filter(l => new Date(l.timestamp).toISOString().split('T')[0] === today);

    return {
      totalStudents: this.data.students.length,
      presentToday: presentCount,
      lateToday: lateCount,
      earlyLeaveToday: earlyLeaveCount,
      excusedAbsentToday: excusedAbsentCount,
      activePasses: activePasses.length,
      overduePasses: overduePasses,
      ePassBreakdown: ePassDestinations,
      receptionLogsToday: todayLogs.length,
      recentIncidents: this.data.receptionLogs.slice(0, 5),
      clinicVisitsToday: this.data.clinicVisits.filter(v => new Date(v.timestamp).toDateString() === new Date().toDateString()).length
    };
  }

  getReportsData(startDate: string, endDate: string, filters?: { grade?: string, section?: string, gender?: string }, userId?: string) {
      const start = new Date(startDate).setHours(0,0,0,0);
      const end = new Date(endDate).setHours(23,59,59,999);
      
      const threshold = this.data.settings.attendanceSettings?.absentPeriodThreshold ?? 3;
      const countExcusedAsDay = this.data.settings.attendanceSettings?.countAllExcusedAsExcusedDay ?? true;

      let targetStudents = userId ? this.getStudentsForUser(userId) : this.data.students;
      
      if (filters) {
          if (filters.grade && filters.grade !== 'All') targetStudents = targetStudents.filter(s => s.grade === filters.grade);
          if (filters.section && filters.section !== 'All') targetStudents = targetStudents.filter(s => s.section === filters.section);
          if (filters.gender && filters.gender !== 'All') targetStudents = targetStudents.filter(s => s.gender === filters.gender);
      }
      const targetStudentIds = new Set(targetStudents.map(s => s.id));

      const filteredAttendance = this.data.attendance.filter(a => {
          const d = new Date(a.date).getTime();
          return d >= start && d <= end && targetStudentIds.has(a.studentId);
      });

      const filteredVisits = this.data.clinicVisits.filter(v => v.timestamp >= start && v.timestamp <= end && targetStudentIds.has(v.studentId));
      const filteredPasses = this.data.ePasses.filter(p => p.startTime >= start && p.startTime <= end && targetStudentIds.has(p.studentId));
      const filteredLogs = this.data.receptionLogs.filter(l => l.timestamp >= start && l.timestamp <= end && targetStudentIds.has(l.studentId));

      const studentAttendance: any = {};
      const attendanceByDateStudent: any = {};
      filteredAttendance.forEach(r => {
          const key = `${r.date}-${r.studentId}`;
          if (!attendanceByDateStudent[key]) attendanceByDateStudent[key] = [];
          attendanceByDateStudent[key].push(r);
      });

      Object.entries(attendanceByDateStudent).forEach(([key, records]: any) => {
          const studentId = key.split('-')[1];
          if (!studentAttendance[studentId]) studentAttendance[studentId] = { P: 0, A: 0, EA: 0, L: 0, EL: 0, total: 0 };
          
          const unexcused = records.filter((r:any) => r.status === AttendanceStatus.ABSENT_UNEXCUSED).length;
          const excused = records.filter((r:any) => r.status === AttendanceStatus.ABSENT_EXCUSED).length;
          const late = records.some((r:any) => r.status === AttendanceStatus.LATE);
          const early = records.some((r:any) => r.status === AttendanceStatus.EARLY_LEAVE);
          const totalRecs = records.length;

          studentAttendance[studentId].total++;

          if (unexcused >= threshold) studentAttendance[studentId].A++;
          else if (countExcusedAsDay && totalRecs > 0 && excused === totalRecs) studentAttendance[studentId].EA++;
          else if (early) studentAttendance[studentId].EL++;
          else if (late) studentAttendance[studentId].L++;
          else studentAttendance[studentId].P++;
      });

      const absenteeBuckets = { '1-2': 0, '3-5': 0, '6-9': 0, '10-14': 0, '15+': 0 };
      const excusedBuckets = { '1-2': 0, '3-5': 0, '6-9': 0, '10-14': 0, '15+': 0 };
      const absenteeList: any[] = [];

      Object.entries(studentAttendance).forEach(([sid, stats]: any) => {
          const student = this.data.students.find(s => s.id === sid);
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

      const topEPassUsers = Object.entries(epassCounts)
          .map(([sid, count]) => ({ student: this.data.students.find(s => s.id === sid), count }))
          .filter(i => i.student)
          .sort((a,b) => b.count - a.count)
          .slice(0, 10);

      const topUnauthorized = Object.entries(unauthorizedCounts)
           .map(([sid, count]) => ({ student: this.data.students.find(s => s.id === sid), count }))
           .filter(i => i.student)
           .sort((a,b) => b.count - a.count)
           .slice(0, 10);

       const teacherStats = Object.entries(teacherCounts)
           .map(([tid, count]) => ({ user: this.data.users.find(u => u.id === tid), count }))
           .filter(i => i.user)
           .sort((a,b) => b.count - a.count);

      return {
          attendance: { buckets: absenteeBuckets, excusedBuckets: excusedBuckets, list: absenteeList, raw: studentAttendance },
          clinic: filteredVisits,
          epass: { topUsers: topEPassUsers, topUnauthorized: topUnauthorized, byTeacher: teacherStats },
          reception: filteredLogs
      };
  }

  getStudent360Data(studentId: string, startDate: string, endDate: string) {
      const start = new Date(startDate).setHours(0,0,0,0);
      const end = new Date(endDate).setHours(23,59,59,999);

      const history = {
          attendance: this.data.attendance.filter(a => {
              const d = new Date(a.date).getTime();
              return d >= start && d <= end && a.studentId === studentId;
          }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),

          clinic: this.data.clinicVisits.filter(v => 
              v.timestamp >= start && v.timestamp <= end && v.studentId === studentId
          ).sort((a,b) => b.timestamp - a.timestamp),

          epasses: this.data.ePasses.filter(p => 
              p.startTime >= start && p.startTime <= end && p.studentId === studentId
          ).sort((a,b) => b.startTime - a.startTime),

          reception: this.data.receptionLogs.filter(l => 
              l.timestamp >= start && l.timestamp <= end && l.studentId === studentId
          ).sort((a,b) => b.timestamp - a.timestamp)
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

export const store = new SupabaseStore();