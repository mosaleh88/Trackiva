
export enum UserRole {
  ADMIN_SGL = 'Admin_SGL',
  TEACHER = 'Teacher',
  MIDDLE_LEADER = 'Middle Leader',
  SUPERVISOR = 'Supervisor',
  SOCIAL_WORKER = 'Social Worker',
  COUNSELLOR = 'Counsellor',
  CLINIC_STAFF = 'Clinic_Staff',
  BUS_SUPERVISOR = 'Bus_Supervisor'
}

export type Language = 'en' | 'ar';

export enum AttendanceStatus {
  PRESENT = 'Present',
  ABSENT_EXCUSED = 'Absent (Excused)',
  ABSENT_UNEXCUSED = 'Absent (Unexcused)',
  LATE = 'Late',
  EARLY_LEAVE = 'Early Leave'
}

export interface Student {
  id: string;
  studentNumber: string;
  name_en: string;
  name_ar: string;
  gender: 'Male' | 'Female';
  grade: string;
  section: string;
  busRoute?: string;
  transportMode: 'Bus' | 'Car' | 'Walker';
  familyId?: string; // Shared ID to link siblings
  isWatchlisted?: boolean; // Targeted student for specific alerts
  
  // Parent Notification Settings
  parentTelegramChatId?: string;
  parentNotificationPreferences?: Record<string, boolean>; // Key: 'UNAUTHORIZED', 'EARLY_LEAVE', or DestinationID
}

export interface AssignedClass {
  grade: string;
  section: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  assignedClasses?: AssignedClass[]; // Array of { grade, section }
  telegramChatId?: string; // Personal Chat ID for notifications (Social Worker)
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  period: string; // Changed from number to string to support "P1", "P2" keys
  status: AttendanceStatus;
  reason?: string; // Reason for Absent (Excused)
  timestamp: number;
}

export interface EPassDestination {
  id: string;
  label_en: string;
  label_ar: string;
  iconName: string; // 'Stethoscope', 'Library', etc.
  colorTheme: 'blue' | 'red' | 'yellow' | 'green' | 'purple' | 'orange' | 'slate'; 
  maxDuration: number; // in minutes
}

export interface EPass {
  id: string;
  studentId: string;
  teacherId?: string; // ID of the teacher who issued the pass
  type: string; // ID of the EPassDestination
  startTime: number;
  endTime?: number;
  status: 'Active' | 'Completed' | 'Overdue';
  notes?: string;
}

// Permissions: Key is Role Name, Value is array of NAV_ITEM IDs
export type RolePermissions = Record<string, string[]>;

export interface AttendanceConfig {
  absentPeriodThreshold: number; // Default 3
  countAllExcusedAsExcusedDay: boolean; // Default true
  // Alerts configuration
  alertThresholds: number[]; // e.g. [1, 3, 6, 10, 15]
}

export interface AppSettings {
  maxPassesPerDay: number;
  rolePermissions: RolePermissions;
  attendanceSettings: AttendanceConfig;
  
  // Default Security/Unauthorized Alerts
  telegramBotToken?: string;
  telegramChatId?: string;
  
  // Early Leave Alerts
  earlyLeaveBotToken?: string;
  earlyLeaveChatId?: string;

  // Attendance Alerts (Social Worker)
  attendanceBotToken?: string;

  // Targeted/Watchlist Student Alerts
  watchlistBotToken?: string;
  watchlistChatId?: string;

  // Notification Toggles (Key = Pass Type ID or 'UNAUTHORIZED', Value = Enabled)
  notificationRules: Record<string, boolean>;
}

export interface ReceptionLog {
  id: string;
  studentId: string;
  type: 'LateArrival' | 'EarlyLeave'; // Changed from CheckIn/CheckOut
  timestamp: number;
  reason?: string;
  transportConflict?: boolean;
  pickupBy?: string; // Relationship (Mother, Father, etc.)
  pickupId?: string; // ID Number of person picking up
}

export interface ClinicVisit {
  id: string;
  studentId: string;
  timestamp: number;
  dischargeTime?: number;
  symptom: string; // Headache, Fever, etc.
  diagnosis?: string;
  treatment?: string;
  severity: 'Low' | 'Medium' | 'High' | 'Emergency';
  outcome: 'ReturnToClass' | 'SentHome'; // Removed Hospital
  notes?: string;
  linkedPassId?: string; // If linked to an E-Pass
}

// Timetable Types
export interface TimeSlot {
  id: string;
  name: string;
  startTime: string; // "08:00"
  endTime: string;   // "08:45"
  type: 'Period' | 'Break' | 'Lunch';
}

export interface ScheduleConfig {
  standard: TimeSlot[]; // Mon-Thu
  friday: TimeSlot[];   // Fri
}

// Navigation structure
export interface NavItem {
  id: string;
  label_en: string;
  label_ar: string;
  icon: any; // Lucide icon component
  allowedRoles: UserRole[];
}
