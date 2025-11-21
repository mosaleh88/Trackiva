
import { Student, AttendanceRecord, EPass, ReceptionLog, AttendanceStatus, UserRole, ScheduleConfig, TimeSlot, EPassDestination, AppSettings, ClinicVisit, User } from '../types';
import { MOCK_STUDENTS, MOCK_USERS_SEED, DEFAULT_DESTINATIONS, NAV_ITEMS } from '../constants';
import { sendAttendanceAlert } from './telegramService';

// This service simulates the Supabase backend by persisting data to localStorage
// ensuring the app works "offline" or without a real backend connected.

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

// Helper to generate default permissions based on constants
const generateDefaultPermissions = () => {
    const permissions: Record<string, string[]> = {};
    Object.values(UserRole).forEach(role => {
        permissions[role] = NAV_ITEMS.filter(item => item.allowedRoles.includes(role)).map(item => item.id);
    });
    return permissions;
};

class MockStore {
  private readonly STORAGE_KEY = 'trackiva_db_v10'; // Increment version
  
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
  };

  constructor() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      this.data = JSON.parse(saved);
      // Migrations
      if (!this.data.schedule) {
        this.data.schedule = {
            standard: DEFAULT_STANDARD_SCHEDULE,
            friday: DEFAULT_FRIDAY_SCHEDULE
        };
      }
      if (!this.data.destinations) {
          this.data.destinations = DEFAULT_DESTINATIONS;
      }
      if (!this.data.settings) {
          this.data.settings = { 
              maxPassesPerDay: 4,
              rolePermissions: generateDefaultPermissions(),
              attendanceSettings: { absentPeriodThreshold: 3, countAllExcusedAsExcusedDay: true, alertThresholds: [3, 6, 10, 15] },
              telegramBotToken: '',
              telegramChatId: '',
              earlyLeaveBotToken: '',
              earlyLeaveChatId: '',
              watchlistBotToken: '',
              watchlistChatId: '',
              notificationRules: { 'UNAUTHORIZED': true }
          };
      }
      if (!this.data.settings.rolePermissions) {
          this.data.settings.rolePermissions = generateDefaultPermissions();
      }
      if (!this.data.settings.notificationRules) {
          this.data.settings.notificationRules = { 'UNAUTHORIZED': true };
      }
      if (!this.data.settings.attendanceSettings) {
          this.data.settings.attendanceSettings = { absentPeriodThreshold: 3, countAllExcusedAsExcusedDay: true, alertThresholds: [3, 6, 10, 15] };
      }
      if (!this.data.settings.attendanceSettings.alertThresholds) {
          this.data.settings.attendanceSettings.alertThresholds = [3, 6, 10, 15];
      }
      if (!this.data.clinicVisits) {
          this.data.clinicVisits = [];
      }
    } else {
      this.data = {
        students: [...MOCK_STUDENTS],
        attendance: [],
        ePasses: [],
        receptionLogs: [],
        users: [...MOCK_USERS_SEED],
        schedule: {
            standard: DEFAULT_STANDARD_SCHEDULE,
            friday: DEFAULT_FRIDAY_SCHEDULE
        },
        destinations: DEFAULT_DESTINATIONS,
        settings: { 
            maxPassesPerDay: 4,
            rolePermissions: generateDefaultPermissions(),
            attendanceSettings: { absentPeriodThreshold: 3, countAllExcusedAsExcusedDay: true, alertThresholds: [3, 6, 10, 15] },
            telegramBotToken: '',
            telegramChatId: '',
            earlyLeaveBotToken: '',
            earlyLeaveChatId: '',
            watchlistBotToken: '',
            watchlistChatId: '',
            notificationRules: { 'UNAUTHORIZED': true }
        },
        clinicVisits: []
      };
      this.save();
    }
  }

  private save() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
  }

  // --- Settings ---
  getSettings() {
      return this.data.settings;
  }

  updateSettings(settings: Partial<AppSettings>) {
      this.data.settings = { ...this.data.settings, ...settings };
      this.save();
  }

  // --- Student Management ---
  getStudents() {
    return this.data.students;
  }
  
  // NEW: Get students filtered by user's assigned classes (if any)
  getStudentsForUser(userId: string) {
      const user = this.data.users.find(u => u.id === userId);
      
      // If Admin, return all
      if (user?.role === UserRole.ADMIN_SGL || !user?.assignedClasses || user.assignedClasses.length === 0) {
          return this.data.students;
      }

      return this.data.students.filter(student => {
          return user.assignedClasses?.some(ac => 
              ac.grade === student.grade && ac.section === student.section
          );
      });
  }

  getSiblings(studentId: string) {
      const student = this.data.students.find(s => s.id === studentId);
      if (!student || !student.familyId) return [];
      return this.data.students.filter(s => s.familyId === student.familyId && s.id !== studentId);
  }

  addStudent(student: Omit<Student, 'id'>) {
    const newStudent = {
      ...student,
      id: `S${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`
    };
    this.data.students.push(newStudent);
    this.save();
    return newStudent;
  }

  updateStudent(id: string, updates: Partial<Student>) {
    const idx = this.data.students.findIndex(s => s.id === id);
    if (idx !== -1) {
      this.data.students[idx] = { ...this.data.students[idx], ...updates };
      this.save();
    }
  }

  deleteStudent(id: string) {
    this.data.students = this.data.students.filter(s => s.id !== id);
    this.save();
  }

  bulkImportStudents(students: Omit<Student, 'id'>[]) {
    const newStudents = students.map(s => ({
      ...s,
      id: `S${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`
    }));
    this.data.students = [...this.data.students, ...newStudents];
    this.save();
  }

  // --- User Management ---
  getUsers() {
    return this.data.users;
  }

  getUser(id: string) {
      return this.data.users.find(u => u.id === id);
  }

  addUser(user: Omit<User, 'id'>) {
    const newUser = {
      ...user,
      id: `U${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
    };
    this.data.users.push(newUser);
    this.save();
  }

  updateUser(id: string, updates: Partial<User>) {
    const idx = this.data.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      this.data.users[idx] = { ...this.data.users[idx], ...updates };
      this.save();
    }
  }

  deleteUser(id: string) {
    this.data.users = this.data.users.filter(u => u.id !== id);
    this.save();
  }

  // --- Social Worker Lookup ---
  getSocialWorkerForStudent(studentId: string): User | undefined {
      const student = this.data.students.find(s => s.id === studentId);
      if (!student) return undefined;

      // Find user with Role SOCIAL_WORKER who is assigned to this student's class
      return this.data.users.find(u => 
          u.role === UserRole.SOCIAL_WORKER && 
          u.assignedClasses?.some(ac => ac.grade === student.grade && ac.section === student.section)
      );
  }

  // --- Schedule Management ---
  getSchedule() {
    return this.data.schedule;
  }

  updateSchedule(type: 'standard' | 'friday', slots: TimeSlot[]) {
    this.data.schedule[type] = slots;
    this.save();
  }

  // --- Destination Management ---
  getDestinations() {
      return this.data.destinations || DEFAULT_DESTINATIONS;
  }

  addDestination(dest: Omit<EPassDestination, 'id'>) {
      const newDest = { ...dest, id: `D${Date.now()}` };
      this.data.destinations.push(newDest);
      this.save();
  }

  updateDestination(id: string, updates: Partial<EPassDestination>) {
      const idx = this.data.destinations.findIndex(d => d.id === id);
      if (idx !== -1) {
          this.data.destinations[idx] = { ...this.data.destinations[idx], ...updates };
          this.save();
      }
  }

  deleteDestination(id: string) {
      this.data.destinations = this.data.destinations.filter(d => d.id !== id);
      this.save();
  }

  // --- Attendance ---
  getAttendance(date: string, period: string) {
    return this.data.attendance.filter(a => a.date === date && a.period === period);
  }

  markAttendance(record: Omit<AttendanceRecord, 'id' | 'timestamp'>) {
    const existingIndex = this.data.attendance.findIndex(
      a => a.studentId === record.studentId && a.date === record.date && a.period === record.period
    );

    const entry: AttendanceRecord = {
      ...record,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now()
    };

    if (existingIndex >= 0) {
      this.data.attendance[existingIndex] = { ...this.data.attendance[existingIndex], status: record.status };
    } else {
      this.data.attendance.push(entry);
    }
    this.save();
  }

  deleteAttendance(studentId: string, date: string, period: string) {
    this.data.attendance = this.data.attendance.filter(
      a => !(a.studentId === studentId && a.date === date && a.period === period)
    );
    this.save();
  }

  // Check total absences for a student and trigger alert if threshold met
  checkAttendanceAlert(studentId: string) {
      const student = this.data.students.find(s => s.id === studentId);
      if (!student) return;

      const settings = this.data.settings.attendanceSettings;
      const thresholds = settings?.alertThresholds || [3, 6, 10, 15];
      const threshold = settings?.absentPeriodThreshold || 3;

      // Get all attendance records
      const records = this.data.attendance.filter(a => a.studentId === studentId);
      
      // Group by date
      const byDate: Record<string, AttendanceRecord[]> = {};
      records.forEach(r => {
          if (!byDate[r.date]) byDate[r.date] = [];
          byDate[r.date].push(r);
      });

      // Count Total Absent Days
      let totalAbsentDays = 0;
      Object.values(byDate).forEach(dayRecords => {
          const unexcused = dayRecords.filter(r => r.status === AttendanceStatus.ABSENT_UNEXCUSED).length;
          if (unexcused >= threshold) {
              totalAbsentDays++;
          }
      });

      // Check if total matches a configured threshold
      // Note: We check exact match to trigger only once per threshold
      if (thresholds.includes(totalAbsentDays)) {
          const socialWorker = this.getSocialWorkerForStudent(studentId);
          if (socialWorker) {
              sendAttendanceAlert(student, totalAbsentDays, socialWorker);
          }
      }
  }

  // --- EPass ---
  getEPasses() {
    return this.data.ePasses;
  }

  getStudentDailyPassCount(studentId: string): number {
      const today = new Date().setHours(0,0,0,0);
      return this.data.ePasses.filter(p => {
          const passDate = new Date(p.startTime).setHours(0,0,0,0);
          // Exclude unauthorized passes from the daily count
          return p.studentId === studentId && passDate === today && p.type !== 'UNAUTHORIZED';
      }).length;
  }

  createEPass(pass: Omit<EPass, 'id' | 'status' | 'startTime'>) {
    const newPass: EPass = {
      ...pass,
      id: Math.random().toString(36).substr(2, 9),
      status: 'Active',
      startTime: Date.now()
    };
    this.data.ePasses.push(newPass);
    this.save();
    return newPass;
  }

  completeEPass(id: string) {
    const pass = this.data.ePasses.find(p => p.id === id);
    if (pass) {
      pass.status = 'Completed';
      pass.endTime = Date.now();
      this.save();
    }
  }

  // --- Reception ---
  getReceptionLogs() {
    return this.data.receptionLogs;
  }

  logReception(log: Omit<ReceptionLog, 'id' | 'timestamp'>) {
    const student = this.data.students.find(s => s.id === log.studentId);
    let conflict = false;

    // Simple transport conflict logic
    if (log.type === 'EarlyLeave' && student?.transportMode === 'Bus') {
      conflict = true; 
    }

    const newLog: ReceptionLog = {
      ...log,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      transportConflict: conflict
    };

    this.data.receptionLogs.unshift(newLog);

    // --- Auto-mark Attendance if Early Leave ---
    if (log.type === 'EarlyLeave') {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        const day = today.getDay();
        
        // Get applicable schedule
        const scheduleType = (day === 5) ? 'friday' : 'standard';
        const schedule = this.data.schedule[scheduleType];
        const currentMinutes = today.getHours() * 60 + today.getMinutes();

        // Filter periods that END after the current time
        const remainingPeriods = schedule.filter(s => {
            if (s.type !== 'Period') return false;
            const [endH, endM] = s.endTime.split(':').map(Number);
            const periodEndMins = endH * 60 + endM;
            return periodEndMins > currentMinutes;
        });

        remainingPeriods.forEach(p => {
             this.markAttendance({
                 studentId: log.studentId,
                 date: dateStr,
                 period: p.id,
                 status: AttendanceStatus.EARLY_LEAVE
             });
        });
    }

    this.save();
    return newLog;
  }

  // --- Clinic ---
  getClinicVisits() {
      return this.data.clinicVisits;
  }

  addClinicVisit(visit: Omit<ClinicVisit, 'id' | 'timestamp'>) {
      const newVisit: ClinicVisit = {
          ...visit,
          id: `V${Date.now()}`,
          timestamp: Date.now(),
          dischargeTime: Date.now()
      };
      this.data.clinicVisits.unshift(newVisit);
      
      // If linked pass, check it out ONLY if not returning to class (e.g. Sent Home)
      if (visit.linkedPassId && visit.outcome !== 'ReturnToClass') {
          this.completeEPass(visit.linkedPassId);
      }

      this.save();
      return newVisit;
  }

  // --- Reporting Helpers ---

  getCycle(grade: string): 'Cycle 1' | 'Cycle 2' | 'Cycle 3' | 'Unknown' {
    if (['KG1', 'KG2', '1', '2', '3', '4'].includes(grade)) return 'Cycle 1';
    if (['5', '6', '7', '8'].includes(grade)) return 'Cycle 2';
    if (['9', '10', '11', '12'].includes(grade)) return 'Cycle 3';
    return 'Unknown';
  }

  getReportsData(startDate: string, endDate: string, filters?: { grade?: string, section?: string, gender?: string }) {
      const start = new Date(startDate).setHours(0,0,0,0);
      const end = new Date(endDate).setHours(23,59,59,999);
      
      const threshold = this.data.settings.attendanceSettings?.absentPeriodThreshold ?? 3;
      const countExcusedAsDay = this.data.settings.attendanceSettings?.countAllExcusedAsExcusedDay ?? true;

      // 1. Filter Students based on Global Filters
      let targetStudents = this.data.students;
      if (filters) {
          if (filters.grade && filters.grade !== 'All') targetStudents = targetStudents.filter(s => s.grade === filters.grade);
          if (filters.section && filters.section !== 'All') targetStudents = targetStudents.filter(s => s.section === filters.section);
          if (filters.gender && filters.gender !== 'All') targetStudents = targetStudents.filter(s => s.gender === filters.gender);
      }
      const targetStudentIds = new Set(targetStudents.map(s => s.id));

      // 2. Filter Data based on Date AND Target Students
      const filteredAttendance = this.data.attendance.filter(a => {
          const d = new Date(a.date).getTime();
          return d >= start && d <= end && targetStudentIds.has(a.studentId);
      });

      const filteredVisits = this.data.clinicVisits.filter(v => 
          v.timestamp >= start && v.timestamp <= end && targetStudentIds.has(v.studentId)
      );
      const filteredPasses = this.data.ePasses.filter(p => 
          p.startTime >= start && p.startTime <= end && targetStudentIds.has(p.studentId)
      );
      const filteredLogs = this.data.receptionLogs.filter(l => 
          l.timestamp >= start && l.timestamp <= end && targetStudentIds.has(l.studentId)
      );

      // --- Attendance Aggregation ---
      const studentAttendance: Record<string, { P: number, A: number, EA: number, L: number, EL: number, total: number }> = {};
      
      // Group by date AND student to calculate daily status first
      const attendanceByDateStudent: Record<string, AttendanceRecord[]> = {};
      filteredAttendance.forEach(r => {
          const key = `${r.date}-${r.studentId}`;
          if (!attendanceByDateStudent[key]) attendanceByDateStudent[key] = [];
          attendanceByDateStudent[key].push(r);
      });

      // Calculate daily statuses
      Object.entries(attendanceByDateStudent).forEach(([key, records]) => {
          const studentId = key.split('-')[1];
          if (!studentAttendance[studentId]) studentAttendance[studentId] = { P: 0, A: 0, EA: 0, L: 0, EL: 0, total: 0 };
          
          const unexcused = records.filter(r => r.status === AttendanceStatus.ABSENT_UNEXCUSED).length;
          const excused = records.filter(r => r.status === AttendanceStatus.ABSENT_EXCUSED).length;
          const late = records.some(r => r.status === AttendanceStatus.LATE);
          const early = records.some(r => r.status === AttendanceStatus.EARLY_LEAVE);
          const totalRecs = records.length;

          studentAttendance[studentId].total++;

          if (unexcused >= threshold) {
              studentAttendance[studentId].A++;
          } else if (countExcusedAsDay && totalRecs > 0 && excused === totalRecs) {
              studentAttendance[studentId].EA++;
          } else if (early) {
              studentAttendance[studentId].EL++;
          } else if (late) {
              studentAttendance[studentId].L++;
          } else {
              studentAttendance[studentId].P++;
          }
      });

      // Bucketing
      const absenteeBuckets = { '1-2': 0, '3-5': 0, '6-9': 0, '10-14': 0, '15+': 0 };
      const excusedBuckets = { '1-2': 0, '3-5': 0, '6-9': 0, '10-14': 0, '15+': 0 };
      const absenteeList: any[] = [];

      Object.entries(studentAttendance).forEach(([sid, stats]) => {
          const student = this.data.students.find(s => s.id === sid);
          if (!student) return;
          
          // Unexcused
          if (stats.A > 0) {
              if (stats.A >= 15) absenteeBuckets['15+']++;
              else if (stats.A >= 10) absenteeBuckets['10-14']++;
              else if (stats.A >= 6) absenteeBuckets['6-9']++;
              else if (stats.A >= 3) absenteeBuckets['3-5']++;
              else absenteeBuckets['1-2']++;
              
              absenteeList.push({ ...student, daysAbsent: stats.A, type: 'Unexcused' });
          }

          // Excused
          if (stats.EA > 0) {
             if (stats.EA >= 15) excusedBuckets['15+']++;
              else if (stats.EA >= 10) excusedBuckets['10-14']++;
              else if (stats.EA >= 6) excusedBuckets['6-9']++;
              else if (stats.EA >= 3) excusedBuckets['3-5']++;
              else excusedBuckets['1-2']++;
          }
      });

      // --- E-Pass Aggregation ---
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
          attendance: {
              buckets: absenteeBuckets,
              excusedBuckets: excusedBuckets,
              list: absenteeList,
              raw: studentAttendance
          },
          clinic: filteredVisits,
          epass: {
              topUsers: topEPassUsers,
              topUnauthorized: topUnauthorized,
              byTeacher: teacherStats
          },
          reception: filteredLogs
      };
  }

  // Get full history for Student 360
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

      // Calculate Aggregated Stats
      const attendanceStats = { P: 0, EA: 0, A: 0, L: 0, EL: 0 };
      
      // Simple raw count for 360 view (not daily logic for simplicity in list view, but can be enhanced)
      // Actually, let's use the records to count flags
      history.attendance.forEach(a => {
          if(a.status === AttendanceStatus.PRESENT) attendanceStats.P++;
          else if(a.status === AttendanceStatus.ABSENT_EXCUSED) attendanceStats.EA++;
          else if(a.status === AttendanceStatus.ABSENT_UNEXCUSED) attendanceStats.A++;
          else if(a.status === AttendanceStatus.LATE) attendanceStats.L++;
          else if(a.status === AttendanceStatus.EARLY_LEAVE) attendanceStats.EL++;
      });

      return {
          history,
          stats: attendanceStats
      };
  }

  // Helper for Gemini context
  getDataSummary() {
    const today = new Date().toISOString().split('T')[0];
    const activePasses = this.data.ePasses.filter(p => p.status === 'Active');
    
    const threshold = this.data.settings.attendanceSettings?.absentPeriodThreshold ?? 3;
    const countExcusedAsDay = this.data.settings.attendanceSettings?.countAllExcusedAsExcusedDay ?? true;

    // Calculate Overdue Passes
    const overduePasses = activePasses.filter(p => {
        if (p.type === 'UNAUTHORIZED') return true;
        const dest = this.data.destinations.find(d => d.id === p.type);
        if (!dest) return false;
        return (Date.now() - p.startTime) > (dest.maxDuration * 60 * 1000);
    }).length;

    // Pass Stats by Destination
    const ePassDestinations: Record<string, number> = {};
    activePasses.forEach(p => {
        const type = p.type === 'UNAUTHORIZED' ? 'UNAUTHORIZED' : p.type;
        ePassDestinations[type] = (ePassDestinations[type] || 0) + 1;
    });

    // --- Daily Attendance Logic ---
    // 1. Group today's records by student
    const todayRecords = this.data.attendance.filter(a => a.date === today);
    const studentMap: Record<string, AttendanceRecord[]> = {};
    
    // Initialize map for all students to ensure accurate total calculations if needed
    this.data.students.forEach(s => studentMap[s.id] = []);
    todayRecords.forEach(r => {
        if(studentMap[r.studentId]) studentMap[r.studentId].push(r);
    });

    let presentCount = 0;
    let lateCount = 0;
    let earlyLeaveCount = 0;
    let excusedAbsentCount = 0;
    // unexcusedAbsentCount is derived from total - sum(others)
    
    // Iterate through each student to determine their "Day Status"
    Object.values(studentMap).forEach(records => {
        if (records.length === 0) return; // No data (treated as Absent in total calculation by subtraction)

        const unexcused = records.filter(r => r.status === AttendanceStatus.ABSENT_UNEXCUSED).length;
        const excused = records.filter(r => r.status === AttendanceStatus.ABSENT_EXCUSED).length;
        const late = records.some(r => r.status === AttendanceStatus.LATE);
        const early = records.some(r => r.status === AttendanceStatus.EARLY_LEAVE);
        const totalMarked = records.length;

        // Rule 1: If threshold reached -> ABSENT (Excluded from P/L/EL counts)
        if (unexcused >= threshold) return; // Effectively counts as Unexcused Absent

        // Rule 2: If ALL marked periods are Excused Absent -> ABSENT (Excused)
        if (countExcusedAsDay && totalMarked > 0 && excused === totalMarked) {
            excusedAbsentCount++;
            return;
        }

        // Rule 3: Otherwise, they are "Present" in some capacity. 
        // We prioritize the specific flags for the dashboard breakdown.
        if (early) {
            earlyLeaveCount++;
        } else if (late) {
            lateCount++;
        } else {
            // This captures students who are fully Present OR have < threshold Absents
            presentCount++;
        }
    });

    // Reception Stats
    const todayLogs = this.data.receptionLogs.filter(l => new Date(l.timestamp).toISOString().split('T')[0] === today);

    return {
      totalStudents: this.data.students.length,
      presentToday: presentCount,
      lateToday: lateCount,
      earlyLeaveToday: earlyLeaveCount,
      excusedAbsentToday: excusedAbsentCount, // Added this field
      activePasses: activePasses.length,
      overduePasses: overduePasses,
      ePassBreakdown: ePassDestinations,
      receptionLogsToday: todayLogs.length,
      recentIncidents: this.data.receptionLogs.slice(0, 5),
      clinicVisitsToday: this.data.clinicVisits.filter(v => new Date(v.timestamp).toDateString() === new Date().toDateString()).length
    };
  }
}

export const store = new MockStore();
