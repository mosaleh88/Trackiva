
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Badge, Pagination } from './ui';
import { store } from '../services/store';
import { Student, Language, UserRole, TimeSlot, EPassDestination, RolePermissions, AssignedClass, User, AttendanceConfig, AcademicCalendar, CalendarEvent } from '../types';
import { TRANSLATIONS, ROLES_LIST, AVAILABLE_ICONS, COLOR_THEMES, NAV_ITEMS, generateDefaultPermissions } from '../constants';
import { Users, GraduationCap, Upload, Trash2, Edit2, Plus, Search, Filter, ArrowUpDown, CreditCard, X, Printer, Clock, ArrowDownAZ, Ticket, Settings, Shield, Check, ShieldAlert, MessageCircle, Bell, LogOut, Eye, Download, Loader2, ListChecks, Megaphone, Calendar } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import QRCode from 'qrcode';

interface ManagementProps {
  lang: Language;
}

type Tab = 'users' | 'students' | 'timetable' | 'epass' | 'access' | 'notifications' | 'attendance_rules' | 'calendar';

const TABS = [
  { id: 'users', labelKey: 'users', icon: Users },
  { id: 'students', labelKey: 'students', icon: GraduationCap },
  { id: 'timetable', labelKey: 'timetable', icon: Clock },
  { id: 'calendar', labelKey: 'calendar', icon: Calendar },
  { id: 'epass', labelKey: 'destinations', icon: Ticket },
  { id: 'access', labelKey: 'access', icon: Shield },
  { id: 'notifications', labelKey: 'notifications', icon: Bell },
  { id: 'attendance_rules', labelKey: 'attendance_rules', icon: ListChecks },
];

const STUDENTS_PER_PAGE = 10;
const USERS_PER_PAGE = 10;

// Helper for natural grade sorting (KG1, KG2, 1, 2, ... 10, 11)
const gradeSort = (a: string, b: string) => {
    const valA = String(a).trim().toUpperCase();
    const valB = String(b).trim().toUpperCase();

    // Explicitly check for KG/Pre-K/FS and prioritize them
    const isAKG = /^(KG|FS|PRE)/.test(valA);
    const isBKG = /^(KG|FS|PRE)/.test(valB);

    if (isAKG && !isBKG) return -1; // KG before Numbers
    if (!isAKG && isBKG) return 1;  // Numbers after KG
    if (isAKG && isBKG) return valA.localeCompare(valB); // Sort KG1 before KG2

    // Numeric check for standard grades
    const numA = parseInt(valA.replace(/\D/g, ''));
    const numB = parseInt(valB.replace(/\D/g, ''));

    if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
    }
    return valA.localeCompare(valB);
};

// UUID Generator Polyfill
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}


export const Management: React.FC<ManagementProps> = ({ lang }) => {
  const t = TRANSLATIONS[lang];
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [students, setStudents] = useState<Student[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [destinations, setDestinations] = useState<EPassDestination[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // User Filters
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("All");
  const [userPage, setUserPage] = useState(1);

  // Student Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [filterGrade, setFilterGrade] = useState("All");
  const [filterSection, setFilterSection] = useState("All");
  const [filterGender, setFilterGender] = useState("All");
  const [sortBy, setSortBy] = useState<"name" | "grade" | "number">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  
  // Student Pagination
  const [studentPage, setStudentPage] = useState(1);

  // Editing States
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Destination Editing State
  const [editingDest, setEditingDest] = useState<EPassDestination | null>(null);
  const [isAddingDest, setIsAddingDest] = useState(false);

  // Settings State
  const [maxPasses, setMaxPasses] = useState<number>(4);
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [elTelegramToken, setElTelegramToken] = useState("");
  const [elTelegramChatId, setElTelegramChatId] = useState("");
  const [attTelegramToken, setAttTelegramToken] = useState(""); // Attendance Bot
  
  // Watchlist Settings
  const [wlTelegramToken, setWlTelegramToken] = useState("");
  const [wlTelegramChatId, setWlTelegramChatId] = useState("");

  // Notification Rules
  const [notificationRules, setNotificationRules] = useState<Record<string, boolean>>({});
  
  // Attendance Rules
  const [attendanceRules, setAttendanceRules] = useState<AttendanceConfig>({
      absentPeriodThreshold: 3,
      countAllExcusedAsExcusedDay: true,
      alertThresholds: [3, 6, 10, 15],
      doubleCountFridays: false,
      doubleCountDates: []
  });
  const [newDoubleDate, setNewDoubleDate] = useState("");
  
  // Calendar Settings
  const [calendarSettings, setCalendarSettings] = useState<AcademicCalendar>({
      academicYearStart: '',
      academicYearEnd: '',
      terms: [],
      events: []
  });
  const [newEvent, setNewEvent] = useState<Partial<CalendarEvent>>({
      type: 'Holiday',
      name: '',
      startDate: '',
      endDate: ''
  });

  const [rolePermissions, setRolePermissions] = useState<RolePermissions>(() => generateDefaultPermissions());
  const [selectedRoleForAccess, setSelectedRoleForAccess] = useState<string>(UserRole.TEACHER);

  // Parent Notification State
  const [parentSearch, setParentSearch] = useState("");
  const [selectedStudentForParent, setSelectedStudentForParent] = useState<Student | null>(null);
  const [parentChatId, setParentChatId] = useState("");
  const [parentRules, setParentRules] = useState<Record<string, boolean>>({});

  // ID Card State
  const [viewingCard, setViewingCard] = useState<Student | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Timetable State
  const [schedule, setSchedule] = useState(store.getSchedule());
  const [editingScheduleType, setEditingScheduleType] = useState<'standard' | 'friday'>('standard');

  // Form States
  const [formData, setFormData] = useState<any>({});
  const [assignedClassGrade, setAssignedClassGrade] = useState("");
  const [assignedClassSection, setAssignedClassSection] = useState("");

  useEffect(() => {
    refreshData();
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
      setStudentPage(1);
  }, [searchTerm, filterGrade, filterSection, filterGender]);

  useEffect(() => {
      setUserPage(1);
  }, [userSearchTerm, userRoleFilter]);

  const refreshData = async () => {
    // Ensure data is fresh
    await store.refreshData();
    setStudents(store.getStudents());
    setUsers(store.getUsers());
    setSchedule(store.getSchedule());
    setDestinations(store.getDestinations());
    const settings = store.getSettings();
    setMaxPasses(settings.maxPassesPerDay);
    setTelegramToken(settings.telegramBotToken || "");
    setTelegramChatId(settings.telegramChatId || "");
    setElTelegramToken(settings.earlyLeaveBotToken || "");
    setElTelegramChatId(settings.earlyLeaveChatId || "");
    setAttTelegramToken(settings.attendanceBotToken || "");
    setWlTelegramToken(settings.watchlistBotToken || "");
    setWlTelegramChatId(settings.watchlistChatId || "");
    setNotificationRules(settings.notificationRules || {});
    setRolePermissions(settings.rolePermissions || generateDefaultPermissions());
    setAttendanceRules(settings.attendanceSettings || { 
        absentPeriodThreshold: 3, 
        countAllExcusedAsExcusedDay: true, 
        alertThresholds: [3, 6, 10, 15],
        doubleCountFridays: false,
        doubleCountDates: []
    });
    setCalendarSettings(settings.academicCalendar || {
        academicYearStart: '',
        academicYearEnd: '',
        terms: [],
        events: []
    });
  };

  // Generate QR Code when viewing card
  useEffect(() => {
    if (viewingCard) {
        // The QR code contains a JSON string with student info for easy scanning
        const dataToEncode = JSON.stringify({
            id: viewingCard.id,
            no: viewingCard.studentNumber,
            name: viewingCard.name_en
        });
        
        QRCode.toDataURL(dataToEncode, { width: 200, margin: 1 })
            .then(url => setQrDataUrl(url))
            .catch(err => console.error(err));
    }
  }, [viewingCard]);

  // --- User Logic ---
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) || 
                            u.email.toLowerCase().includes(userSearchTerm.toLowerCase());
      const matchesRole = userRoleFilter === "All" || u.role === userRoleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, userSearchTerm, userRoleFilter]);

  const paginatedUsers = useMemo(() => {
      const start = (userPage - 1) * USERS_PER_PAGE;
      return filteredUsers.slice(start, start + USERS_PER_PAGE);
  }, [filteredUsers, userPage]);

  const totalUserPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);

  // --- Student Logic ---

  // Use the custom gradeSort to ensure KG1, KG2, 1, 2 order
  const uniqueGrades = Array.from(new Set(students.map(s => s.grade))).sort(gradeSort);
  const uniqueSections = Array.from(new Set(students.map(s => s.section))).sort();

  // FIX: Dynamic Sections for Assigned Classes based on selected grade
  const availableAssignedClassSections = useMemo(() => {
      if (!assignedClassGrade) return [];
      const gradeStudents = students.filter(s => s.grade === assignedClassGrade);
      return Array.from(new Set(gradeStudents.map(s => s.section))).sort();
  }, [students, assignedClassGrade]);

  const filteredStudents = useMemo(() => {
    let result = students;

    // Search
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(s => 
        s.name_en.toLowerCase().includes(lower) || 
        s.name_ar.includes(lower) || 
        s.studentNumber.includes(lower)
      );
    }

    // Filters
    if (filterGrade !== "All") result = result.filter(s => s.grade === filterGrade);
    if (filterSection !== "All") result = result.filter(s => s.section === filterSection);
    if (filterGender !== "All") result = result.filter(s => s.gender === filterGender);

    // Sorting
    result = [...result].sort((a, b) => {
      let valA, valB;
      if (sortBy === 'name') {
        valA = a.name_en.toLowerCase();
        valB = b.name_en.toLowerCase();
      } else if (sortBy === 'grade') {
        // Sort by Grade using custom sorter, then by Section
        const gradeDiff = gradeSort(a.grade, b.grade);
        if (gradeDiff !== 0) return sortOrder === 'asc' ? gradeDiff : -gradeDiff;
        
        valA = a.section;
        valB = b.section;
      } else {
        valA = a.studentNumber;
        valB = b.studentNumber;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [students, searchTerm, filterGrade, filterSection, filterGender, sortBy, sortOrder]);

  // Pagination
  const paginatedStudents = useMemo(() => {
      const start = (studentPage - 1) * STUDENTS_PER_PAGE;
      return filteredStudents.slice(start, start + STUDENTS_PER_PAGE);
  }, [filteredStudents, studentPage]);

  const totalStudentPages = Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE);


  const handleSaveStudent = async () => {
    if (!formData.studentNumber || !formData.name_en || !formData.grade || !formData.section) {
        alert("Please fill in all required fields (ID, Name EN, Grade, Section)");
        return;
    }

    setIsLoading(true);
    try {
        const studentData = {
            ...formData,
            // DEFAULT VALUES to fix Supabase 400 Error
            gender: formData.gender || 'Male',
            transportMode: formData.transportMode || 'Bus',
            name_ar: formData.name_ar || '',
            busRoute: formData.busRoute || '',
            familyId: formData.familyId || '',
            isWatchlisted: formData.isWatchlisted === 'true' || formData.isWatchlisted === true
        };

        if (editingStudent) {
          await store.updateStudent(editingStudent.id, studentData);
        } else {
          await store.addStudent(studentData);
        }
        setEditingStudent(null);
        setIsAddingStudent(false);
        setFormData({});
        await refreshData();
    } catch (error) {
        console.error(error);
        alert("Failed to save student. Ensure ID Number is unique.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (confirm("Are you sure you want to delete this student?")) {
      setIsLoading(true);
      try {
          await store.deleteStudent(id);
          await refreshData();
      } catch (error) {
          alert("Failed to delete student.");
      } finally {
          setIsLoading(false);
      }
    }
  };

  // --- Parent Notification Logic ---
  const handleParentSearchSelect = (student: Student) => {
      setSelectedStudentForParent(student);
      setParentChatId(student.parentTelegramChatId || "");
      setParentRules(student.parentNotificationPreferences || {});
      setParentSearch("");
  };

  const handleSaveParentSettings = async () => {
      if (!selectedStudentForParent) return;
      setIsLoading(true);
      try {
          await store.updateStudent(selectedStudentForParent.id, {
              parentTelegramChatId: parentChatId,
              parentNotificationPreferences: parentRules
          });
          alert("Parent settings saved successfully!");
          setSelectedStudentForParent(null);
          await refreshData();
      } catch (e) {
          alert("Error saving parent settings");
      } finally {
          setIsLoading(false);
      }
  };

  const toggleParentRule = (key: string) => {
      setParentRules(prev => ({
          ...prev,
          [key]: !prev[key]
      }));
  };

  const filteredParentSearch = useMemo(() => {
      if (!parentSearch) return [];
      const lower = parentSearch.toLowerCase();
      return students.filter(s => 
        s.name_en.toLowerCase().includes(lower) || 
        s.name_ar.includes(lower) || 
        s.studentNumber.includes(lower)
      ).slice(0, 5);
  }, [students, parentSearch]);


  // --- Bulk Upload ---
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // UPDATE: Clarified message about upsert behavior
    if (!confirm(`Are you sure you want to upload "${file.name}"?\n\nNote: This will UPDATE existing students (by ID Number) and ADD new ones.`)) {
      e.target.value = ''; // Reset input
      return;
    }

    setIsUploading(true);

    // Use timeout to allow UI to re-render with loading state before blocking thread
    setTimeout(async () => {
        try {
            const XLSX = await import('xlsx');
            
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(worksheet);
            
            const mappedStudents = json.map((row: any) => ({
                studentNumber: String(row.studentNumber || row['Student Number'] || row['ID'] || Math.floor(Math.random()*100000)),
                name_en: row.name_en || row['Name EN'] || row['Name'] || 'Unknown',
                name_ar: row.name_ar || row['Name AR'] || '',
                gender: (row.gender || row['Gender'] || 'Male') as 'Male' | 'Female',
                grade: String(row.grade || row['Grade'] || ''),
                section: String(row.section || row['Section'] || ''),
                transportMode: (row.transportMode || row['Transport'] || 'Bus') as any,
                busRoute: row.busRoute || row['Bus Route'] || '',
                familyId: String(row.familyId || row['Family ID'] || '')
            }));

            if (mappedStudents.length > 0) {
                await store.bulkImportStudents(mappedStudents);
                await refreshData();
                alert(`Successfully updated/imported ${mappedStudents.length} students.`);
            } else {
                alert("No valid student data found in the Excel file.");
            }
        } catch (err) {
            console.error(err);
            alert("Error parsing Excel file. Please ensure it is a valid .xlsx or .xls file.");
        } finally {
            setIsUploading(false);
            if(e.target) e.target.value = '';
        }
    }, 100);
  };

  const handleDownloadTemplate = async () => {
      try {
          const XLSX = await import('xlsx');
          const template = [
              { "Student Number": "2024001", "Name EN": "John Doe", "Name AR": "جون دو", "Gender": "Male", "Grade": "10", "Section": "A", "Transport": "Bus", "Bus Route": "R-101", "Family ID": "FAM-001" },
              { "Student Number": "2024002", "Name EN": "Jane Smith", "Name AR": "جين سميث", "Gender": "Female", "Grade": "11", "Section": "B", "Transport": "Car", "Bus Route": "", "Family ID": "FAM-002" }
          ];
          const ws = XLSX.utils.json_to_sheet(template);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Template");
          XLSX.writeFile(wb, "Student_Upload_Template.xlsx");
      } catch (e) {
          console.error("Template download failed", e);
          alert("Could not download template.");
      }
  };

  const handlePrintCard = () => {
    const printContent = document.getElementById('id-card-container');
    if (!printContent) return;

    const win = window.open('', '', 'height=600,width=800');
    if (win) {
        win.document.write(`
            <html>
                <head><title>Print ID Card</title></head>
                <body class="flex items-center justify-center h-screen bg-white">
                    ${printContent.innerHTML}
                </body>
            </html>
        `);
        const script = win.document.createElement('script');
        script.src = "https://cdn.tailwindcss.com";
        win.document.head.appendChild(script);
        win.document.close();
        script.onload = () => { win.print(); win.close(); };
    }
  };

  const handleSaveUser = async () => {
    if (!formData.name || !formData.email) {
        alert("Name and Email are required.");
        return;
    }

    setIsLoading(true);
    try {
        const userData = {
            name: formData.name,
            email: formData.email,
            // DEFAULT ROLE to fix Supabase 400 Error
            role: formData.role || UserRole.TEACHER, 
            assignedClasses: formData.assignedClasses || [],
            telegramChatId: formData.telegramChatId || null
        };

        if (editingUser) {
          await store.updateUser(editingUser.id, userData);
          alert("User updated successfully.");
        } else {
          await store.addUser(userData);
          alert("User created successfully!\n\nTemporary Password: TempPassword123!\nPlease share this with the user.");
        }
        setEditingUser(null);
        setIsAddingUser(false);
        setFormData({});
        await refreshData();
    } catch (e) {
        console.error(e);
        alert("Failed to save user: " + (e as any).message);
    } finally {
        setIsLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
     if (confirm("Delete this user?")) {
       await store.deleteUser(id);
       await refreshData();
     }
  };
  
  const handleAddAssignedClass = () => {
      if (!assignedClassGrade || !assignedClassSection) return;
      
      const currentClasses: AssignedClass[] = formData.assignedClasses || [];
      
      // Avoid duplicates
      if (currentClasses.some(c => c.grade === assignedClassGrade && c.section === assignedClassSection)) {
          return;
      }
      
      setFormData({
          ...formData,
          assignedClasses: [...currentClasses, { grade: assignedClassGrade, section: assignedClassSection }]
      });
      setAssignedClassGrade("");
      setAssignedClassSection("");
  };

  const handleRemoveAssignedClass = (index: number) => {
      const currentClasses: AssignedClass[] = formData.assignedClasses || [];
      const newClasses = [...currentClasses];
      newClasses.splice(index, 1);
      setFormData({ ...formData, assignedClasses: newClasses });
  };

  const handleSlotChange = (slotId: string, field: keyof TimeSlot, value: string) => {
     const currentSlots = [...schedule[editingScheduleType]];
     const idx = currentSlots.findIndex(s => s.id === slotId);
     if (idx !== -1) {
         currentSlots[idx] = { ...currentSlots[idx], [field]: value };
         const newSchedule = { ...schedule, [editingScheduleType]: currentSlots };
         setSchedule(newSchedule);
     }
  };

  const handleAddSlot = () => {
    const newSlot: TimeSlot = {
        id: `custom-${Date.now()}`,
        name: 'New Period',
        type: 'Period',
        startTime: '00:00',
        endTime: '00:00'
    };
    const newSchedule = {
        ...schedule,
        [editingScheduleType]: [...schedule[editingScheduleType], newSlot]
    };
    setSchedule(newSchedule);
  };

  const handleDeleteSlot = (slotId: string) => {
      if(!confirm("Are you sure you want to delete this time slot?")) return;
      
      const newSlots = schedule[editingScheduleType].filter(s => s.id !== slotId);
      setSchedule({
          ...schedule,
          [editingScheduleType]: newSlots
      });
  };

  const sortSchedule = () => {
      const sorted = [...schedule[editingScheduleType]].sort((a, b) => {
          return a.startTime.localeCompare(b.startTime);
      });
      setSchedule({ ...schedule, [editingScheduleType]: sorted });
  };

  const saveSchedule = async () => {
      setIsLoading(true);
      await store.updateSchedule(editingScheduleType, schedule[editingScheduleType]);
      setIsLoading(false);
      alert(t.attendanceSaved);
  };

  const handleSaveDest = async () => {
      setIsLoading(true);
      try {
          const destData: any = {
              label_en: formData.label_en || 'New Destination',
              label_ar: formData.label_ar || 'وجهة جديدة',
              iconName: formData.iconName || 'Ticket', // Default icon
              colorTheme: formData.colorTheme || 'blue', // Default color
              maxDuration: parseInt(formData.maxDuration) || 10 // Default duration
          };

          if (editingDest) {
              await store.updateDestination(editingDest.id, destData);
          } else {
              // Generate ID manually to fix "null value in column id" error if backend doesn't support auto-generation for this table
              destData.id = generateUUID();
              await store.addDestination(destData);
          }
          setEditingDest(null);
          setIsAddingDest(false);
          setFormData({});
          await refreshData();
      } catch(e: any) {
          console.error("Save Destination Error:", e);
          const errorMessage = e.message || (typeof e === 'string' ? e : 'Unknown error');
          alert(`Error saving destination: ${errorMessage}`);
      } finally {
          setIsLoading(false);
      }
  };

  const handleDeleteDest = async (id: string) => {
      if (confirm("Are you sure you want to delete this destination?")) {
          try {
              await store.deleteDestination(id);
              await refreshData();
          } catch (e: any) {
              console.error("Delete destination failed:", e);
              alert("Failed to delete destination. " + (e.message || "Unknown error"));
          }
      }
  };

  const handleUpdateEPassSettings = async () => {
      await store.updateSettings({ 
          maxPassesPerDay: maxPasses,
      });
      alert("Limit updated successfully!");
  };

  const handleUpdateNotificationSettings = async () => {
      await store.updateSettings({ 
          telegramBotToken: telegramToken,
          telegramChatId: telegramChatId,
          earlyLeaveBotToken: elTelegramToken,
          earlyLeaveChatId: elTelegramChatId,
          attendanceBotToken: attTelegramToken,
          watchlistBotToken: wlTelegramToken,
          watchlistChatId: wlTelegramChatId,
          notificationRules: notificationRules
      });
      alert("Notification credentials saved successfully!");
  };

  const handleUpdateAttendanceRules = async () => {
      await store.updateSettings({
          attendanceSettings: attendanceRules
      });
      alert("Attendance rules updated successfully!");
  };

  const handleSaveCalendar = async () => {
      setIsLoading(true);
      try {
          await store.updateSettings({ academicCalendar: calendarSettings });
          alert("Calendar updated successfully!");
      } catch (e) {
          console.error(e);
          alert("Failed to update calendar.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleAddEvent = () => {
      if(!newEvent.name || !newEvent.startDate || !newEvent.endDate) return;
      const event: CalendarEvent = {
          id: generateUUID(),
          name: newEvent.name!,
          startDate: newEvent.startDate!,
          endDate: newEvent.endDate!,
          type: newEvent.type || 'Other'
      };
      setCalendarSettings(prev => ({
          ...prev,
          events: [...prev.events, event].sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      }));
      setNewEvent({ type: 'Holiday', name: '', startDate: '', endDate: '' });
  };

  const handleDeleteEvent = (id: string) => {
      setCalendarSettings(prev => ({
          ...prev,
          events: prev.events.filter(e => e.id !== id)
      }));
  };

  const handleTermChange = (idx: number, field: keyof TimeSlot | string, value: string) => {
      const newTerms = [...calendarSettings.terms];
      newTerms[idx] = { ...newTerms[idx], [field]: value };
      setCalendarSettings(prev => ({ ...prev, terms: newTerms }));
  };

  const toggleNotificationRule = (key: string) => {
      setNotificationRules(prev => ({
          ...prev,
          [key]: !prev[key]
      }));
  };

  const handleToggleAccess = async (navId: string) => {
      const safePermissions = rolePermissions || generateDefaultPermissions();
      const currentPerms = safePermissions[selectedRoleForAccess] || [];
      let newPerms: string[];
      
      if (currentPerms.includes(navId)) {
          newPerms = currentPerms.filter(id => id !== navId);
      } else {
          newPerms = [...currentPerms, navId];
      }

      const updatedRolePermissions = {
          ...safePermissions,
          [selectedRoleForAccess]: newPerms
      };

      setRolePermissions(updatedRolePermissions);
      await store.updateSettings({ rolePermissions: updatedRolePermissions });
  };

  const toggleAttendanceAlertThreshold = (days: number) => {
      const current = attendanceRules.alertThresholds || [];
      let next: number[];
      if (current.includes(days)) {
          next = current.filter(d => d !== days);
      } else {
          next = [...current, days].sort((a,b) => a-b);
      }
      setAttendanceRules({ ...attendanceRules, alertThresholds: next });
  };

  const handleAddDoubleDate = () => {
      if (!newDoubleDate) return;
      if (attendanceRules.doubleCountDates?.includes(newDoubleDate)) return;
      setAttendanceRules(prev => ({
          ...prev,
          doubleCountDates: [...(prev.doubleCountDates || []), newDoubleDate].sort()
      }));
      setNewDoubleDate("");
  };

  const handleRemoveDoubleDate = (date: string) => {
      setAttendanceRules(prev => ({
          ...prev,
          doubleCountDates: prev.doubleCountDates?.filter(d => d !== date)
      }));
  };

  const renderIdCardModal = () => {
    if (!viewingCard) return null;
    
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 no-print backdrop-blur-sm">
            <div className="bg-white/90 dark:bg-slate-900/90 rounded-[2rem] shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] border border-white/20 dark:border-slate-700 backdrop-blur-xl animate-in zoom-in-95">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center">
                    <h3 className="font-bold text-xl text-slate-800 dark:text-white">{t.generateId}</h3>
                    <button onClick={() => setViewingCard(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400 transition-colors">
                        <X size={24} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 dark:bg-slate-950/50 flex justify-center">
                    <div id="id-card-container">
                        <div className="w-[480px] bg-white rounded-2xl overflow-hidden shadow-xl border border-slate-200 relative flex flex-col print:shadow-none print:border" 
                             style={{ borderTop: '12px solid #3b82f6' }}>
                            
                            <div className="p-8">
                                <div className="mb-6">
                                    <div className="flex justify-between items-start">
                                        <h1 className="text-3xl font-extrabold text-slate-900">{lang === 'en' ? viewingCard.name_en : viewingCard.name_ar}</h1>
                                        {viewingCard.isWatchlisted && (
                                            <Eye className="text-red-500 animate-pulse" size={28} />
                                        )}
                                    </div>
                                    {lang === 'en' && viewingCard.name_ar && <h2 className="text-xl text-slate-500 font-medium mt-1">{viewingCard.name_ar}</h2>}
                                    {lang === 'ar' && viewingCard.name_en && <h2 className="text-xl text-slate-500 font-medium mt-1">{viewingCard.name_en}</h2>}
                                </div>

                                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 mb-8">
                                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">{t.grade}</span>
                                        <span className="font-bold text-slate-800 text-lg">{viewingCard.grade} - {viewingCard.section}</span>
                                    </div>
                                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">ID</span>
                                        <span className="font-mono font-bold text-slate-800 text-lg">{viewingCard.studentNumber}</span>
                                    </div>
                                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">{t.transport}</span>
                                        <span className="font-bold text-slate-800 text-lg">{viewingCard.transportMode} {viewingCard.busRoute ? `(${viewingCard.busRoute})` : ''}</span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-end border-t border-slate-100 pt-6">
                                    <div>
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">{t.trackivaAcademy}</p>
                                        <p className="text-[10px] text-slate-400 font-medium">{t.academicYear}</p>
                                    </div>
                                    {qrDataUrl && (
                                        <img src={qrDataUrl} alt="QR Code" className="w-24 h-24 rounded-xl border border-slate-200 p-1" />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-slate-800/50 flex justify-end gap-3 bg-white/50 dark:bg-slate-900/50 rounded-b-[2rem] backdrop-blur-md">
                    <Button variant="secondary" onClick={() => setViewingCard(null)}>{t.cancel}</Button>
                    <Button onClick={handlePrintCard} className="shadow-lg">
                        <Printer size={18} className="mr-2" /> {t.printCard}
                    </Button>
                </div>
            </div>
        </div>
    );
  }

  const renderStudentForm = () => (
    <div className="bg-slate-50/50 dark:bg-slate-800/50 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 mb-8 animate-in fade-in shadow-sm backdrop-blur-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-xl text-slate-800 dark:text-white">{editingStudent ? t.actions : t.addStudent}</h3>
        <Button variant="ghost" onClick={() => { setEditingStudent(null); setIsAddingStudent(false); setFormData({}); }}>{t.cancel}</Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="col-span-1">
             <label htmlFor="studentNumber" className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.studentNumber} *</label>
             <Input 
                id="studentNumber"
                placeholder="2024XXX" 
                value={formData.studentNumber || ''} 
                onChange={e => setFormData({...formData, studentNumber: e.target.value})} 
            />
        </div>
        <div className="col-span-1">
            <label htmlFor="gender" className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.gender} *</label>
            <Select 
                id="gender"
                value={formData.gender || 'Male'} 
                onChange={e => setFormData({...formData, gender: e.target.value})}
            >
                <option value="Male">{t.male}</option>
                <option value="Female">{t.female}</option>
            </Select>
        </div>
        <div className="col-span-1 md:col-span-2 lg:col-span-1">
             <label htmlFor="transportMode" className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.transport}</label>
             <Select 
                id="transportMode"
                value={formData.transportMode || 'Bus'} 
                onChange={e => setFormData({...formData, transportMode: e.target.value})}
            >
                <option value="Bus">{t.bus}</option>
                <option value="Car">{t.car}</option>
                <option value="Walker">{t.walker}</option>
            </Select>
        </div>

        <div className="col-span-1">
            <label htmlFor="name_en" className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.labelEn} *</label>
            <Input 
                id="name_en"
                placeholder="John Doe" 
                value={formData.name_en || ''} 
                onChange={e => setFormData({...formData, name_en: e.target.value})} 
            />
        </div>
        <div className="col-span-1">
            <label htmlFor="name_ar" className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.labelAr}</label>
            <Input 
                id="name_ar"
                placeholder="جون دو" 
                value={formData.name_ar || ''} 
                onChange={e => setFormData({...formData, name_ar: e.target.value})} 
            />
        </div>
        <div className="col-span-1">
             <label htmlFor="watchlist" className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.watchlist}</label>
             <Select 
                id="watchlist"
                value={formData.isWatchlisted ? 'true' : 'false'}
                onChange={e => setFormData({...formData, isWatchlisted: e.target.value})}
            >
                <option value="false">Normal Status</option>
                <option value="true">Targeted / Watchlisted</option>
            </Select>
        </div>

        <div className="col-span-1">
            <label htmlFor="grade" className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.grade} *</label>
            <Select 
                id="grade"
                value={formData.grade || ''} 
                onChange={e => setFormData({...formData, grade: e.target.value})}
            >
                <option value="">Select Grade</option>
                {Array.from({length: 12}, (_, i) => i + 1).map(g => <option key={g} value={g}>{g}</option>)}
                <option value="KG1">KG1</option>
                <option value="KG2">KG2</option>
            </Select>
        </div>
        <div className="col-span-1">
            <label htmlFor="section" className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.section} *</label>
            <Input 
                id="section"
                placeholder="A, B, C..." 
                value={formData.section || ''} 
                onChange={e => setFormData({...formData, section: e.target.value})} 
            />
        </div>
        <div className="col-span-1">
            <label htmlFor="busRoute" className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Bus Route</label>
            <Input 
                id="busRoute"
                placeholder="e.g. R-101" 
                value={formData.busRoute || ''} 
                onChange={e => setFormData({...formData, busRoute: e.target.value})} 
            />
        </div>
        <div className="col-span-1">
            <label htmlFor="familyId" className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.familyId}</label>
            <Input 
                id="familyId"
                placeholder="Shared ID for siblings" 
                value={formData.familyId || ''} 
                onChange={e => setFormData({...formData, familyId: e.target.value})} 
            />
        </div>
      </div>
      <div className="mt-8 flex justify-end gap-3">
        <Button disabled={isLoading} onClick={handleSaveStudent} size="lg" className="shadow-lg">{t.save}</Button>
      </div>
    </div>
  );

  return (
      <div className="space-y-8 pb-12">
          {renderIdCardModal()} 
          <Card className="!p-2">
            <div className="p-2 rounded-2xl bg-slate-100/50 dark:bg-slate-900/50">
              <div className="flex flex-wrap gap-2">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as Tab)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                      activeTab === tab.id
                        ? 'bg-white dark:bg-slate-800 text-primary shadow-lg'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:backdrop-blur-md'
                    }`}
                  >
                    <tab.icon size={18} />
                    <span className="hidden sm:inline">{t[tab.labelKey as keyof typeof t]}</span>
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Students Management */}
          {activeTab === 'students' && (
              <div className="space-y-6">
                  {(isAddingStudent || editingStudent) && renderStudentForm()}
                  
                  {/* Toolbar */}
                  <Card className="flex flex-col md:flex-row gap-4 justify-between items-center p-6 !bg-transparent">
                      <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                           <div className="relative group w-full sm:w-64">
                               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
                               <Input placeholder={t.searchPlaceholder} className="pl-12 h-12" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                           </div>
                           <div className="flex items-center gap-2 bg-white/50 dark:bg-slate-900/50 p-2 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 backdrop-blur-lg">
                               <Select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className="w-28 h-10 bg-transparent border-none focus:ring-0">
                                   <option value="All">{t.allGrades}</option>
                                   {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
                               </Select>
                               <Select value={filterSection} onChange={e => setFilterSection(e.target.value)} className="w-28 h-10 bg-transparent border-none focus:ring-0">
                                   <option value="All">{t.allSections}</option>
                                   {uniqueSections.map(s => <option key={s} value={s}>{s}</option>)}
                               </Select>
                               <Select value={filterGender} onChange={e => setFilterGender(e.target.value)} className="w-28 h-10 bg-transparent border-none focus:ring-0">
                                   <option value="All">{t.allGenders}</option>
                                   <option value="Male">{t.male}</option>
                                   <option value="Female">{t.female}</option>
                               </Select>
                           </div>
                      </div>
                      
                      <div className="flex gap-3 w-full md:w-auto justify-end">
                          <label className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors shadow-sm h-11">
                              <Upload size={18} />
                              <span className="text-sm font-bold">{isUploading ? t.uploading : t.upload}</span>
                              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleBulkUpload} disabled={isUploading} />
                          </label>
                          <Button onClick={handleDownloadTemplate} variant="secondary" className="px-4 h-11 rounded-xl">
                              <Download size={18} />
                          </Button>
                          <Button onClick={() => { setIsAddingStudent(true); setFormData({}); }} className="h-11 w-11 p-0 rounded-xl shadow-md" title={t.addStudent}>
                              <Plus size={20} />
                          </Button>
                      </div>
                  </Card>

                  {/* Table */}
                  <Card className="p-0 overflow-hidden !bg-transparent">
                      <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                              <thead className="bg-slate-50/50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase border-b border-slate-100 dark:border-slate-800/50">
                                  <tr className="[&>th]:p-5 [&>th]:font-bold [&>th]:cursor-pointer [&>th]:select-none [&>th:hover]:bg-slate-100/50 dark:[&>th:hover]:bg-slate-800/50">
                                      <th onClick={() => setSortBy('number')}>
                                          <div className="flex items-center gap-2">
                                              ID {sortBy === 'number' && <ArrowUpDown size={14} />}
                                          </div>
                                      </th>
                                      <th onClick={() => setSortBy('name')}>
                                          <div className="flex items-center gap-2">
                                              {t.studentName} {sortBy === 'name' && <ArrowUpDown size={14} />}
                                          </div>
                                      </th>
                                      <th onClick={() => setSortBy('grade')}>
                                          <div className="flex items-center gap-2">
                                              {t.grade} {sortBy === 'grade' && <ArrowUpDown size={14} />}
                                          </div>
                                      </th>
                                      <th className="p-5 font-bold">{t.transport}</th>
                                      <th className="p-5 font-bold text-center">{t.actions}</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm">
                                  {paginatedStudents.length === 0 ? (
                                      <tr><td colSpan={5} className="p-12 text-center text-slate-400 italic">No students found</td></tr>
                                  ) : (
                                      paginatedStudents.map(student => (
                                          <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                              <td className="p-5 font-mono text-slate-500 dark:text-slate-400">{student.studentNumber}</td>
                                              <td className="p-5 font-bold text-slate-700 dark:text-slate-200">
                                                  {lang === 'en' ? student.name_en : student.name_ar}
                                                  {student.isWatchlisted && <Eye className="inline ml-2 text-red-500 w-4 h-4 animate-pulse" />}
                                              </td>
                                              <td className="p-5"><Badge color="blue">{student.grade} - {student.section}</Badge></td>
                                              <td className="p-5 text-slate-600 dark:text-slate-300 font-medium">{student.transportMode}</td>
                                              <td className="p-5 flex justify-center gap-2">
                                                  <button onClick={() => setViewingCard(student)} className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg transition-colors" title="ID Card"><CreditCard size={18} /></button>
                                                  <button onClick={() => { setEditingStudent(student); setFormData(student); setIsAddingStudent(false); }} className="p-2 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 rounded-lg transition-colors"><Edit2 size={18} /></button>
                                                  <button onClick={() => handleDeleteStudent(student.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg transition-colors"><Trash2 size={18} /></button>
                                              </td>
                                          </tr>
                                      ))
                                  )}
                              </tbody>
                          </table>
                      </div>
                      
                      <Pagination 
                          currentPage={studentPage}
                          totalPages={totalStudentPages}
                          onPageChange={setStudentPage}
                          className="p-5 border-t border-slate-100 dark:border-slate-800/50"
                      />
                  </Card>
              </div>
          )}

          {/* User Management */}
          {activeTab === 'users' && (
              <div className="space-y-6">

                  {(isAddingUser || editingUser) && (
                       <div className="bg-slate-50/50 dark:bg-slate-800/50 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 mb-8 animate-in fade-in shadow-sm backdrop-blur-sm">
                          <div className="flex justify-between items-center mb-6">
                              <h3 className="font-bold text-xl text-slate-800 dark:text-white">{editingUser ? t.actions : t.addUser}</h3>
                              <Button variant="ghost" onClick={() => { setEditingUser(null); setIsAddingUser(false); setFormData({}); }}>{t.cancel}</Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.studentName}</label><Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Full Name" /></div>
                              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.email}</label><Input value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="email@school.com" /></div>
                              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.role}</label><Select value={formData.role || UserRole.TEACHER} onChange={e => setFormData({...formData, role: e.target.value})}>{ROLES_LIST.map(r => <option key={r} value={r}>{r}</option>)}</Select></div>
                              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.userChatId}</label><Input value={formData.telegramChatId || ''} onChange={e => setFormData({...formData, telegramChatId: e.target.value})} placeholder="Optional: For Notifications" /></div>
                          </div>
                          <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-6">
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">{t.assignedClasses}</label>
                              <div className="flex gap-3 mb-3">
                                  <Select value={assignedClassGrade} onChange={e => setAssignedClassGrade(e.target.value)} className="w-36"><option value="">{t.grade}</option>{uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}</Select>
                                  <Select value={assignedClassSection} onChange={e => setAssignedClassSection(e.target.value)} disabled={!assignedClassGrade} className="w-36"><option value="">{t.section}</option>{availableAssignedClassSections.map(s => <option key={s} value={s}>{s}</option>)}</Select>
                                  <Button onClick={handleAddAssignedClass} variant="secondary"><Plus size={16} /> {t.assignClass}</Button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                  {formData.assignedClasses?.map((c: AssignedClass, i: number) => (
                                      <Badge key={i} color="blue" className="flex items-center gap-2 pl-3 pr-2 py-1.5 text-sm">{c.grade} - {c.section} <button onClick={() => handleRemoveAssignedClass(i)} className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5 transition-colors"><X size={14} /></button></Badge>
                                  ))}
                              </div>
                          </div>
                          <div className="mt-8 flex justify-end gap-3"><Button disabled={isLoading} onClick={handleSaveUser} size="lg" className="shadow-lg">{t.save}</Button></div>
                       </div>
                  )}

                  <Card className="p-6 !bg-transparent">
                      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                          <div className="flex gap-4 items-center w-full md:w-auto">
                               <div className="relative group flex-1 md:flex-none md:w-72">
                                   <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
                                   <Input placeholder="Search Users..." className="pl-12 h-12" value={userSearchTerm} onChange={e => setUserSearchTerm(e.target.value)} />
                               </div>
                               <Select value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)} className="w-48 h-12">
                                   <option value="All">All Roles</option>
                                   {ROLES_LIST.map(r => <option key={r} value={r}>{r}</option>)}
                               </Select>
                          </div>
                          <Button onClick={() => { setIsAddingUser(true); setFormData({}); }} className="h-12 px-6 rounded-xl shadow-md w-full md:w-auto"><Plus size={20} className="mr-2" /> {t.addUser}</Button>
                      </div>
                  </Card>
                  
                  <Card className="p-0 overflow-hidden !bg-transparent">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50/50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase border-b border-slate-100 dark:border-slate-800/50">
                                <tr>
                                    <th className="p-5 font-bold">{t.studentName}</th>
                                    <th className="p-5 font-bold">{t.email}</th>
                                    <th className="p-5 font-bold">{t.role}</th>
                                    <th className="p-5 font-bold">{t.assignedClasses}</th>
                                    <th className="p-5 font-bold text-center">{t.actions}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm">
                                {paginatedUsers.map(user => (
                                    <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="p-5 font-bold text-slate-700 dark:text-slate-200">{user.name}</td>
                                        <td className="p-5 text-slate-600 dark:text-slate-300">{user.email}</td>
                                        <td className="p-5"><Badge color="blue">{user.role}</Badge></td>
                                        <td className="p-5">
                                            <div className="flex flex-wrap gap-1.5">
                                                {user.assignedClasses?.map((ac, i) => (
                                                    <span key={i} className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600/50 px-2 py-1 rounded-md text-slate-600 dark:text-slate-300">{ac.grade}-{ac.section}</span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-5 flex justify-center gap-2">
                                            <button onClick={() => { setEditingUser(user); setFormData(user); setIsAddingUser(false); }} className="p-2 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 rounded-lg transition-colors"><Edit2 size={18} /></button>
                                            <button onClick={() => handleDeleteUser(user.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg transition-colors"><Trash2 size={18} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                  </Card>
                  <Pagination 
                      currentPage={userPage}
                      totalPages={totalUserPages}
                      onPageChange={setUserPage}
                  />
              </div>
          )}

          {/* Access Control */}
          {activeTab === 'access' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <Card className="col-span-1 h-fit p-6">
                      <h3 className="font-bold text-xl mb-6 text-slate-800 dark:text-white">{t.selectRole}</h3>
                      <div className="space-y-2">
                          {ROLES_LIST.map(role => (
                              <button key={role} onClick={() => setSelectedRoleForAccess(role)} className={`w-full text-left px-5 py-4 rounded-2xl transition-all flex justify-between items-center ${selectedRoleForAccess === role ? 'bg-primary text-white shadow-lg scale-105' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                                  <span className="font-bold">{role}</span>
                                  {selectedRoleForAccess === role && <Check size={18} />}
                              </button>
                          ))}
                      </div>
                  </Card>
                  <Card className="col-span-1 md:col-span-2 p-8">
                      <div className="flex justify-between items-center mb-8">
                           <div>
                               <h3 className="font-bold text-2xl text-slate-800 dark:text-white">{selectedRoleForAccess} Permissions</h3>
                               <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Select which modules this role can access.</p>
                           </div>
                           <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-full">
                                <Shield className="text-slate-300 dark:text-slate-600" size={40} />
                           </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {NAV_ITEMS.map(item => {
                              const isAllowed = rolePermissions?.[selectedRoleForAccess]?.includes(item.id);
                              const Icon = item.icon;
                              return (
                                  <div key={item.id} onClick={() => handleToggleAccess(item.id)} className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-5 group hover:scale-[1.02] ${isAllowed ? 'border-green-500/50 bg-green-50/50 dark:bg-green-900/10' : 'border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600'}`}>
                                      <div className={`p-3 rounded-xl transition-colors ${isAllowed ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}><Icon size={28} /></div>
                                      <div><h4 className={`font-bold text-lg ${isAllowed ? 'text-green-800 dark:text-green-300' : 'text-slate-500 dark:text-slate-400'}`}>{lang === 'en' ? item.label_en : item.label_ar}</h4><p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider mt-1">{isAllowed ? 'Access Granted' : 'Access Denied'}</p></div>
                                  </div>
                              );
                          })}
                      </div>
                  </Card>
              </div>
          )}
          
          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
              <div className="space-y-8">
                  {/* Parent Notification Section */}
                  <Card className="p-8 !bg-transparent">
                      <div className="flex items-start gap-5 mb-8">
                           <div className="p-4 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-2xl shadow-sm"><MessageCircle size={32} /></div>
                           <div><h3 className="font-bold text-2xl text-slate-800 dark:text-white">{t.parentNotifications}</h3><p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t.parentNotificationsDesc}</p></div>
                      </div>
                      <div className="relative max-w-xl mb-8">
                           <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
                           <Input placeholder={t.searchStudent} className="pl-12 h-12 text-lg rounded-xl" value={parentSearch} onChange={e => setParentSearch(e.target.value)} />
                           {parentSearch && (
                               <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl mt-2 z-20 max-h-60 overflow-y-auto">
                                   {filteredParentSearch.map(s => (
                                       <button key={s.id} onClick={() => handleParentSearchSelect(s)} className="w-full text-left px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700/50 last:border-0 transition-colors">
                                            <p className="font-bold text-slate-700 dark:text-slate-200">{lang === 'en' ? s.name_en : s.name_ar}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{s.studentNumber} - {s.grade}-{s.section}</p>
                                       </button>
                                   ))}
                               </div>
                           )}
                      </div>
                      
                      {selectedStudentForParent && (
                          <div className="bg-purple-50/50 dark:bg-purple-900/10 rounded-3xl p-8 border border-purple-100 dark:border-purple-800/50 animate-in fade-in backdrop-blur-sm">
                              <div className="flex justify-between items-start mb-6">
                                  <div><h4 className="font-bold text-xl text-purple-900 dark:text-purple-100">{lang === 'en' ? selectedStudentForParent.name_en : selectedStudentForParent.name_ar}</h4><p className="text-sm text-purple-700 dark:text-purple-300 font-medium">Configure Parent Alerts</p></div>
                                  <Button variant="ghost" onClick={() => setSelectedStudentForParent(null)} size="sm" className="hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300"><X size={20} /></Button>
                              </div>
                              <div className="mb-6">
                                  <label className="block text-xs font-bold text-purple-800 dark:text-purple-200 mb-2 uppercase tracking-wide">{t.parentChatId}</label>
                                  <Input value={parentChatId} onChange={e => setParentChatId(e.target.value)} placeholder="Enter numeric Chat ID" className="bg-white/80 dark:bg-slate-900/80 border-purple-200 dark:border-purple-800 focus:border-purple-500 focus:ring-purple-500/20" />
                              </div>
                              <div className="mb-6"><label className="block text-xs font-bold text-purple-800 dark:text-purple-200 mb-3 uppercase tracking-wide">{t.selectEvents}</label>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      {['UNAUTHORIZED', 'EARLY_LEAVE', ...destinations.map(d => d.id)].map(key => (
                                          <label key={key} className="flex items-center gap-4 p-4 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-purple-100 dark:border-slate-700 cursor-pointer hover:bg-purple-50 dark:hover:bg-slate-800 transition-colors shadow-sm">
                                              <input type="checkbox" checked={!!parentRules[key]} onChange={() => toggleParentRule(key)} className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500" />
                                              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{key === 'UNAUTHORIZED' ? 'Unauthorized Exit' : key === 'EARLY_LEAVE' ? 'Early Leave' : destinations.find(d => d.id === key)?.label_en || key}</span>
                                          </label>
                                      ))}
                                  </div>
                              </div>
                              <div className="flex justify-end"><Button onClick={handleSaveParentSettings} disabled={isLoading} className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/30 px-8 h-12 rounded-xl text-lg font-bold">{t.saveParentSettings}</Button></div>
                          </div>
                      )}
                  </Card>

                  {/* General Notification Settings */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 !bg-transparent">
                      <Card className="p-8">
                           <h3 className="font-bold text-xl mb-6 flex items-center gap-3 text-slate-800 dark:text-white"><ShieldAlert size={24} className="text-blue-500" /> {t.securityAlerts}</h3>
                           <div className="space-y-5">
                               <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t.botToken}</label><Input type="password" value={telegramToken} onChange={e => setTelegramToken(e.target.value)} className="font-mono text-sm" /></div>
                               <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t.chatId} (Security Channel)</label><Input value={telegramChatId} onChange={e => setTelegramChatId(e.target.value)} className="font-mono text-sm" /></div>
                           </div>
                           <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300 mt-8 mb-4 uppercase tracking-wide">{t.enableNotificationsFor}</h4>
                           <div className="space-y-3">
                               {['UNAUTHORIZED', ...destinations.map(d => d.id)].map(key => (
                                   <label key={key} className="flex items-center gap-3 cursor-pointer p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                                       <input type="checkbox" checked={!!notificationRules[key]} onChange={() => toggleNotificationRule(key)} className="rounded text-primary focus:ring-primary w-5 h-5" />
                                       <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{key === 'UNAUTHORIZED' ? t.unauthorized : destinations.find(d => d.id === key)?.label_en || key}</span>
                                   </label>
                               ))}
                           </div>
                      </Card>

                      <div className="space-y-8">
                           <Card className="p-8">
                               <h3 className="font-bold text-xl mb-6 flex items-center gap-3 text-slate-800 dark:text-white"><LogOut size={24} className="text-orange-500" /> {t.receptionAlerts}</h3>
                               <div className="space-y-5">
                                   <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t.botToken}</label><Input type="password" value={elTelegramToken} onChange={e => setElTelegramToken(e.target.value)} className="font-mono text-sm" /></div>
                                   <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t.chatId} (Reception/Admin)</label><Input value={elTelegramChatId} onChange={e => setElTelegramChatId(e.target.value)} className="font-mono text-sm" /></div>
                               </div>
                           </Card>
                           <Card className="p-8">
                               <h3 className="font-bold text-xl mb-6 flex items-center gap-3 text-slate-800 dark:text-white"><Users size={24} className="text-green-500" /> {t.attendanceAlerts}</h3>
                               <div className="space-y-5">
                                   <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t.botToken}</label><Input type="password" value={attTelegramToken} onChange={e => setAttTelegramToken(e.target.value)} className="font-mono text-sm" /></div>
                                   <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">Chat IDs are configured per Social Worker in User Management.</p>
                               </div>
                           </Card>
                            <Card className="p-8">
                               <h3 className="font-bold text-xl mb-4 flex items-center gap-3 text-slate-800 dark:text-white"><Eye size={24} className="text-red-500" /> {t.watchlistAlerts}</h3>
                               <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">{t.watchlistDesc}</p>
                               <div className="space-y-5">
                                   <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t.botToken}</label><Input type="password" value={wlTelegramToken} onChange={e => setWlTelegramToken(e.target.value)} className="font-mono text-sm" /></div>
                                   <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t.chatId} (Private Channel)</label><Input value={wlTelegramChatId} onChange={e => setWlTelegramChatId(e.target.value)} className="font-mono text-sm" /></div>
                               </div>
                           </Card>
                      </div>
                  </div>
                  <div className="flex justify-end pt-4"><Button onClick={handleUpdateNotificationSettings} size="lg" className="px-8 shadow-lg">{t.saveCredentials}</Button></div>
              </div>
          )}

          {/* Attendance Rules Tab */}
          {activeTab === 'attendance_rules' && ( 
              <Card className="max-w-3xl mx-auto p-8">
                  <div className="flex items-center gap-6 mb-8"><div className="p-4 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl shadow-sm"><ListChecks size={32} /></div><div><h3 className="font-bold text-2xl text-slate-800 dark:text-white">{t.attendanceRules}</h3><p className="text-slate-500 dark:text-slate-400 font-medium mt-1">{t.attendanceRulesDesc}</p></div></div>
                  
                  <div className="space-y-8">
                      <div className="p-6 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
                          <label className="block font-bold text-lg text-slate-800 dark:text-white mb-2">{t.absentThreshold}</label>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t.absentThresholdDesc}</p>
                          <div className="flex items-center gap-6">
                              <input type="range" min="1" max="8" value={attendanceRules.absentPeriodThreshold} onChange={e => setAttendanceRules({...attendanceRules, absentPeriodThreshold: parseInt(e.target.value)})} className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-primary" />
                              <span className="font-bold text-3xl text-blue-600 dark:text-blue-400 w-12 text-center">{attendanceRules.absentPeriodThreshold}</span>
                          </div>
                      </div>

                      <div className="flex items-start gap-4 p-6 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800 shadow-sm transition-all hover:border-blue-200 dark:hover:border-blue-800">
                          <input type="checkbox" checked={attendanceRules.countAllExcusedAsExcusedDay} onChange={e => setAttendanceRules({...attendanceRules, countAllExcusedAsExcusedDay: e.target.checked})} className="mt-1 w-6 h-6 text-blue-600 rounded-md focus:ring-blue-500" />
                          <div><label className="block font-bold text-lg text-slate-800 dark:text-white mb-1">{t.countAllExcused}</label><p className="text-sm text-slate-500 dark:text-slate-400">{t.countAllExcusedDesc}</p></div>
                      </div>

                      {/* Double Count Friday Toggle */}
                      <div className="flex items-start gap-4 p-6 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800 shadow-sm transition-all hover:border-blue-200 dark:hover:border-blue-800">
                          <input type="checkbox" checked={attendanceRules.doubleCountFridays || false} onChange={e => setAttendanceRules({...attendanceRules, doubleCountFridays: e.target.checked})} className="mt-1 w-6 h-6 text-blue-600 rounded-md focus:ring-blue-500" />
                          <div><label className="block font-bold text-lg text-slate-800 dark:text-white mb-1">{t.doubleCountFriday}</label><p className="text-sm text-slate-500 dark:text-slate-400">{t.doubleCountFridayDesc}</p></div>
                      </div>

                      {/* Specific Double Count Dates */}
                      <div className="p-6 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
                           <label className="block font-bold text-lg text-slate-800 dark:text-white mb-2">{t.doubleCountDates}</label>
                           <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t.doubleCountDatesDesc}</p>
                           
                           <div className="flex gap-3 mb-6">
                               <div className="relative">
                                   <Input 
                                       type="date" 
                                       value={newDoubleDate}
                                       onChange={(e) => setNewDoubleDate(e.target.value)}
                                       className="pl-10 w-48 h-12 rounded-xl"
                                   />
                                   <Calendar className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
                               </div>
                               <Button onClick={handleAddDoubleDate} className="h-12 rounded-xl px-5"><Plus size={18} /> {t.addDate}</Button>
                           </div>

                           {attendanceRules.doubleCountDates && attendanceRules.doubleCountDates.length > 0 && (
                               <div className="flex flex-wrap gap-3">
                                   {attendanceRules.doubleCountDates.map((date) => (
                                       <Badge key={date} color="red" className="flex items-center gap-2 pl-3 pr-2 py-1.5 text-sm rounded-lg shadow-sm">
                                           {date}
                                           <button onClick={() => handleRemoveDoubleDate(date)} className="hover:bg-red-200 dark:hover:bg-red-800 rounded-full p-0.5 text-red-800 dark:text-red-100 transition-colors">
                                               <X size={14} />
                                           </button>
                                       </Badge>
                                   ))}
                               </div>
                           )}
                           {(!attendanceRules.doubleCountDates || attendanceRules.doubleCountDates.length === 0) && (
                               <p className="text-sm text-slate-400 italic">No specific dates added.</p>
                           )}
                      </div>

                      <div className="p-6 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
                           <label className="block font-bold text-lg text-slate-800 dark:text-white mb-2">{t.attendanceAlertThresholds}</label>
                           <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t.attendanceAlertDesc}</p>
                           <div className="flex flex-wrap gap-3">
                               {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20].map(num => {
                                   const active = attendanceRules.alertThresholds?.includes(num);
                                   return (
                                       <button key={num} onClick={() => toggleAttendanceAlertThreshold(num)} className={`w-12 h-12 rounded-full font-bold text-base transition-all ${active ? 'bg-red-500 text-white shadow-lg scale-110 ring-4 ring-red-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                                           {num}
                                       </button>
                                   );
                               })}
                           </div>
                      </div>
                  </div>
                  <div className="flex justify-end mt-10"><Button onClick={handleUpdateAttendanceRules} size="lg" className="px-10 h-14 text-lg font-bold shadow-xl shadow-primary/30 rounded-2xl">{t.saveRules}</Button></div>
              </Card>
          )}
          
          {/* Calendar Tab */}
          {activeTab === 'calendar' && ( 
              <div className="space-y-8">
                  {/* Academic Year Configuration */}
                  <Card className="p-8">
                      <h3 className="font-bold text-xl mb-6 text-slate-800 dark:text-white flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg text-primary"><Calendar size={24} /></div>
                          Academic Year Configuration
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Academic Year Start</label>
                              <Input 
                                  type="date" 
                                  value={calendarSettings.academicYearStart} 
                                  onChange={e => setCalendarSettings({...calendarSettings, academicYearStart: e.target.value})}
                                  className="h-12"
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Academic Year End</label>
                              <Input 
                                  type="date" 
                                  value={calendarSettings.academicYearEnd} 
                                  onChange={e => setCalendarSettings({...calendarSettings, academicYearEnd: e.target.value})}
                                  className="h-12"
                              />
                          </div>
                      </div>
                  </Card>

                  {/* Terms Configuration */}
                  <Card className="p-8">
                      <h3 className="font-bold text-xl mb-6 text-slate-800 dark:text-white">Academic Terms</h3>
                      <div className="space-y-4">
                          {calendarSettings.terms.map((term, idx) => (
                              <div key={term.id} className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 border border-slate-100 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                  <div className="flex items-center">
                                      <span className="font-bold text-lg text-slate-800 dark:text-slate-200">{term.name}</span>
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Start Date</label>
                                      <Input 
                                          type="date" 
                                          value={term.startDate} 
                                          onChange={e => handleTermChange(idx, 'startDate', e.target.value)}
                                          className="bg-white dark:bg-slate-900"
                                      />
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">End Date</label>
                                      <Input 
                                          type="date" 
                                          value={term.endDate} 
                                          onChange={e => handleTermChange(idx, 'endDate', e.target.value)}
                                          className="bg-white dark:bg-slate-900"
                                      />
                                  </div>
                              </div>
                          ))}
                      </div>
                  </Card>

                  {/* Events & Holidays */}
                  <Card className="p-8">
                      <h3 className="font-bold text-xl mb-6 text-slate-800 dark:text-white">Events, Exams & Holidays</h3>
                      
                      {/* Add Event Form */}
                      <div className="bg-slate-50/50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 mb-8 backdrop-blur-sm">
                          <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-wide">Add New Event</h4>
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                              <div className="md:col-span-2">
                                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Event Name</label>
                                  <Input 
                                      placeholder="e.g. Winter Break, Mid-Term Exams" 
                                      value={newEvent.name} 
                                      onChange={e => setNewEvent({...newEvent, name: e.target.value})}
                                      className="bg-white dark:bg-slate-900"
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Type</label>
                                  <Select 
                                      value={newEvent.type} 
                                      onChange={e => setNewEvent({...newEvent, type: e.target.value as any})}
                                      className="bg-white dark:bg-slate-900"
                                  >
                                      <option value="Holiday">Holiday/Off Day</option>
                                      <option value="Exam">Exam</option>
                                      <option value="Break">Break (Winter/Spring/Summer)</option>
                                      <option value="Other">Other</option>
                                  </Select>
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Start Date</label>
                                  <Input 
                                      type="date" 
                                      value={newEvent.startDate} 
                                      onChange={e => setNewEvent({...newEvent, startDate: e.target.value})}
                                      className="bg-white dark:bg-slate-900"
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">End Date</label>
                                  <Input 
                                      type="date" 
                                      value={newEvent.endDate} 
                                      onChange={e => setNewEvent({...newEvent, endDate: e.target.value})}
                                      className="bg-white dark:bg-slate-900"
                                  />
                              </div>
                          </div>
                          <div className="mt-4 flex justify-end">
                              <Button onClick={handleAddEvent} disabled={!newEvent.name || !newEvent.startDate || !newEvent.endDate} className="shadow-md">
                                  <Plus size={18} className="mr-2" /> Add Event
                              </Button>
                          </div>
                      </div>

                      {/* Events List */}
                      <div className="space-y-3">
                          {calendarSettings.events.length === 0 ? (
                              <div className="text-center py-12 text-slate-400 italic">No events scheduled.</div>
                          ) : (
                              calendarSettings.events.map(event => (
                                  <div key={event.id} className="flex flex-wrap md:flex-nowrap items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl hover:shadow-md transition-all hover:scale-[1.01]">
                                      <div className="flex items-center gap-4 flex-1">
                                          <div className={`w-1.5 h-12 rounded-full ${
                                              event.type === 'Exam' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 
                                              event.type === 'Break' ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 
                                              event.type === 'Holiday' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-slate-400'
                                          }`}></div>
                                          <div>
                                              <p className="font-bold text-lg text-slate-800 dark:text-slate-200">{event.name}</p>
                                              <Badge color={
                                                  event.type === 'Exam' ? 'red' : 
                                                  event.type === 'Break' ? 'blue' : 
                                                  event.type === 'Holiday' ? 'green' : 'gray'
                                              } className="text-[10px] mt-1 px-2 py-0.5">{event.type}</Badge>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-6 mt-3 md:mt-0">
                                          <div className="text-right">
                                              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">From</p>
                                              <p className="text-sm font-mono text-slate-700 dark:text-slate-300 font-bold">{event.startDate}</p>
                                          </div>
                                          <div className="text-right">
                                              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">To</p>
                                              <p className="text-sm font-mono text-slate-700 dark:text-slate-300 font-bold">{event.endDate}</p>
                                          </div>
                                          <button 
                                              onClick={() => handleDeleteEvent(event.id)}
                                              className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors ml-4"
                                          >
                                              <Trash2 size={18} />
                                          </button>
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                  </Card>

                  <div className="flex justify-end pt-6">
                      <Button onClick={handleSaveCalendar} size="lg" className="px-10 h-14 text-lg font-bold shadow-xl rounded-2xl">Save Calendar</Button>
                  </div>
              </div>
          )}

          {/* E-Pass Destinations */}
          {activeTab === 'epass' && (
               <div className="space-y-8">
                   {(isAddingDest || editingDest) && (
                       <Card className="bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 animate-in fade-in p-8 backdrop-blur-sm !bg-transparent">
                          <div className="flex justify-between items-center mb-6">
                              <h3 className="font-bold text-xl text-slate-800 dark:text-white">{editingDest ? t.editDestination : t.addDestination}</h3>
                              <Button variant="ghost" onClick={() => { setEditingDest(null); setIsAddingDest(false); setFormData({}); }}>{t.cancel}</Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                              <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t.labelEn}</label><Input value={formData.label_en || ''} onChange={e => setFormData({...formData, label_en: e.target.value})} placeholder="e.g. Library" /></div>
                              <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t.labelAr}</label><Input value={formData.label_ar || ''} onChange={e => setFormData({...formData, label_ar: e.target.value})} placeholder="e.g. المكتبة" /></div>
                              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t.duration}</label><Input type="number" value={formData.maxDuration || ''} onChange={e => setFormData({...formData, maxDuration: e.target.value})} placeholder="10" /></div>
                              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t.color}</label><Select value={formData.colorTheme || 'blue'} onChange={e => setFormData({...formData, colorTheme: e.target.value})}>{COLOR_THEMES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</Select></div>
                              <div className="md:col-span-2">
                                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t.icon}</label>
                                  <div className="flex flex-wrap gap-2 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                                      {AVAILABLE_ICONS.map(iconName => {
                                          const IconComp = LucideIcons[iconName as keyof typeof LucideIcons] as any;
                                          const isSelected = (formData.iconName || 'Ticket') === iconName;
                                          return (
                                              <button key={iconName} onClick={() => setFormData({...formData, iconName})} className={`p-2.5 rounded-lg transition-all ${isSelected ? 'bg-primary text-white shadow-lg scale-110' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                                                  {IconComp && <IconComp size={22} />}
                                              </button>
                                          );
                                      })}
                                  </div>
                              </div>
                          </div>
                          <div className="mt-8 flex justify-end"><Button onClick={handleSaveDest} size="lg" className="px-8 shadow-md">{t.save}</Button></div>
                       </Card>
                   )}

                   <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                       <Card className="md:col-span-2 p-8 !bg-transparent">
                           <div className="flex justify-between items-center mb-8">
                               <h3 className="font-bold text-2xl text-slate-800 dark:text-white">{t.destinations}</h3>
                               <Button onClick={() => { setIsAddingDest(true); setFormData({}); }} className="shadow-md rounded-xl"><Plus size={20} className="mr-2" /> {t.addDestination}</Button>
                           </div>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                               {destinations.map(dest => {
                                   const IconComp = LucideIcons[dest.iconName as keyof typeof LucideIcons] as any || Ticket;
                                   const theme = COLOR_THEMES.find(c => c.name === dest.colorTheme);
                                   return (
                                       <div key={dest.id} className="flex items-center justify-between p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all group">
                                           <div className="flex items-center gap-5">
                                               <div className={`p-4 rounded-xl shadow-sm ${theme?.class || 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}><IconComp size={24} /></div>
                                               <div><h4 className="font-bold text-lg text-slate-800 dark:text-white">{dest.label_en}</h4><p className="text-sm text-slate-500 dark:text-slate-400">{dest.label_ar}</p></div>
                                           </div>
                                           <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                               <Badge color="gray" className="mr-2">{dest.maxDuration}m</Badge>
                                               <button onClick={() => { setEditingDest(dest); setFormData(dest); setIsAddingDest(true); }} className="p-2 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 text-slate-400 hover:text-yellow-600 dark:hover:text-yellow-400 rounded-lg transition-colors"><Edit2 size={18} /></button>
                                               <button onClick={() => handleDeleteDest(dest.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"><Trash2 size={18} /></button>
                                           </div>
                                       </div>
                                   );
                               })}
                           </div>
                       </Card>
                       <Card className="h-fit p-8">
                           <h3 className="font-bold text-xl mb-6 text-slate-800 dark:text-white">{/* Global Settings */}</h3>
                           <div className="mb-6">
                               <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wide">{t.maxPasses}</label>
                               <div className="flex gap-3">
                                   <Input type="number" value={maxPasses} onChange={e => setMaxPasses(parseInt(e.target.value))} className="h-12 text-lg font-bold" />
                                   <Button onClick={handleUpdateEPassSettings} className="h-12 px-6">{t.updateLimit}</Button>
                               </div>
                           </div>
                           <div className="bg-yellow-50 dark:bg-yellow-900/20 p-5 rounded-2xl border border-yellow-100 dark:border-yellow-800/50">
                               <h4 className="font-bold text-yellow-800 dark:text-yellow-200 text-sm mb-2 flex items-center gap-2"><Megaphone size={18} /> Note</h4>
                               <p className="text-xs text-yellow-700 dark:text-yellow-300 leading-relaxed">Changing pass limits applies immediately to all students across the system.</p>
                           </div>
                       </Card>
                   </div>
               </div>
          )}

          {/* Timetable Tab */}
          {activeTab === 'timetable' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <Card className="lg:col-span-2 p-8">
                      <div className="flex justify-between items-center mb-8 !bg-transparent">
                          <div className="flex gap-2 bg-slate-100 dark:bg-slate-700/50 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-600">
                              <button onClick={() => setEditingScheduleType('standard')} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${editingScheduleType === 'standard' ? 'bg-white dark:bg-slate-600 shadow-md text-primary dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-600/50'}`}>{t.standard}</button>
                              <button onClick={() => setEditingScheduleType('friday')} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${editingScheduleType === 'friday' ? 'bg-white dark:bg-slate-600 shadow-md text-primary dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-600/50'}`}>{t.friday}</button>
                          </div>
                          <div className="flex gap-3">
                              <Button variant="secondary" onClick={sortSchedule} title={t.sortChrono} className="h-11 w-11 p-0 rounded-xl"><ArrowDownAZ size={20} /></Button>
                              <Button onClick={handleAddSlot} className="h-11 rounded-xl shadow-md"><Plus size={20} className="mr-2" /> {t.addSlot}</Button>
                          </div>
                      </div>
                      
                      <div className="space-y-3">
                          {schedule[editingScheduleType].map((slot, index) => (
                              <div key={slot.id} className="flex flex-wrap md:flex-nowrap items-center gap-4 p-4 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-white dark:hover:bg-slate-800 hover:shadow-md transition-all group backdrop-blur-sm">
                                  <div className="flex-none w-10 text-center font-bold text-slate-400 dark:text-slate-500 text-sm">#{index + 1}</div>
                                  <div className="flex-1 min-w-[160px]">
                                      <Input value={slot.name} onChange={e => handleSlotChange(slot.id, 'name', e.target.value)} placeholder="Period Name" className="h-10 text-sm font-bold bg-transparent border-slate-300 dark:border-slate-600 focus:bg-white dark:focus:bg-slate-900" />
                                  </div>
                                  <div className="flex-none w-32">
                                      <Select value={slot.type} onChange={e => handleSlotChange(slot.id, 'type', e.target.value)} className="h-10 text-xs bg-transparent border-slate-300 dark:border-slate-600 focus:bg-white dark:focus:bg-slate-900">
                                          <option value="Period">Period</option>
                                          <option value="Break">Break</option>
                                          <option value="Lunch">Lunch</option>
                                      </Select>
                                  </div>
                                  <div className="flex items-center gap-3">
                                      <Input type="time" value={slot.startTime} onChange={e => handleSlotChange(slot.id, 'startTime', e.target.value)} className="h-10 w-28 text-xs font-mono bg-transparent border-slate-300 dark:border-slate-600 focus:bg-white dark:focus:bg-slate-900 text-center" />
                                      <span className="text-slate-400 font-bold">-</span>
                                      <Input type="time" value={slot.endTime} onChange={e => handleSlotChange(slot.id, 'endTime', e.target.value)} className="h-10 w-28 text-xs font-mono bg-transparent border-slate-300 dark:border-slate-600 focus:bg-white dark:focus:bg-slate-900 text-center" />
                                  </div>
                                  <button onClick={() => handleDeleteSlot(slot.id)} className="p-2.5 text-slate-300 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
                              </div>
                          ))}
                      </div>
                      
                      <div className="mt-8 flex justify-end">
                          <Button onClick={saveSchedule} size="lg" className="shadow-lg px-8 h-12 rounded-xl">{t.saveSchedule}</Button>
                      </div>
                  </Card>
                  
                  <Card className="h-fit bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700 p-8 backdrop-blur-sm">
                      <h3 className="font-bold text-xl mb-8 text-slate-800 dark:text-white flex items-center gap-3"><Clock size={24} className="text-primary" />{/* Live Preview */}</h3>
                      <div className="relative pl-6 border-l-2 border-dashed border-slate-300 dark:border-slate-600 space-y-8">
                          {schedule[editingScheduleType].map((slot) => (
                              <div key={slot.id} className="relative">
                                  <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 shadow-sm ring-4 ring-slate-50 dark:ring-slate-900 ${slot.type === 'Period' ? 'bg-blue-500' : slot.type === 'Break' ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mb-1 font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded inline-block">{slot.startTime} - {slot.endTime}</p>
                                  <h4 className="font-bold text-base text-slate-800 dark:text-white">{slot.name}</h4>
                                  <Badge color={slot.type === 'Period' ? 'blue' : slot.type === 'Break' ? 'green' : 'orange'} className="mt-2 text-[10px] uppercase tracking-wide">{slot.type}</Badge>
                              </div>
                          ))}
                      </div>
                  </Card>
              </div>
          )}

      </div>
  );
};
