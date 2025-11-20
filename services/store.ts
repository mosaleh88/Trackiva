
import { Student, AttendanceRecord, EPass, ReceptionLog, AttendanceStatus, UserRole, ScheduleConfig, TimeSlot, EPassDestination, AppSettings, ClinicVisit } from '../types';
import { MOCK_STUDENTS, MOCK_USERS_SEED, DEFAULT_DESTINATIONS, NAV_ITEMS } from '../constants';

// This service simulates the Supabase backend by persisting data to localStorage
// ensuring the app works "offline" or without a real backend connected.

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

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
  private readonly STORAGE_KEY = 'trackiva_db_v7'; // Increment version
  
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
              rolePermissions: generateDefaultPermissions()
          };
      }
      if (!this.data.settings.rolePermissions) {
          this.data.settings.rolePermissions = generateDefaultPermissions();
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
            rolePermissions: generateDefaultPermissions()
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

  // Helper for Gemini context
  getDataSummary() {
    const today = new Date().toISOString().split('T')[0];
    const activePasses = this.data.ePasses.filter(p => p.status === 'Active');
    
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

        // Rule 1: If 3 or more absent periods -> ABSENT (Excluded from P/L/EL counts)
        if (unexcused >= 3) return; // Effectively counts as Unexcused Absent

        // Rule 2: If ALL marked periods are Excused Absent -> ABSENT (Excused)
        if (totalMarked > 0 && excused === totalMarked) {
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
            // This captures students who are fully Present OR have 1-2 Absents but pass the threshold check
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
