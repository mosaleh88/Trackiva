
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Badge } from './ui';
import { store } from '../services/store';
import { Student, Language, UserRole, TimeSlot, EPassDestination, RolePermissions, AssignedClass, User, AttendanceConfig } from '../types';
import { TRANSLATIONS, ROLES_LIST, AVAILABLE_ICONS, COLOR_THEMES, NAV_ITEMS } from '../constants';
import { Users, GraduationCap, Upload, Trash2, Edit2, Plus, Search, Filter, ArrowUpDown, CreditCard, X, Printer, Clock, ArrowDownAZ, Ticket, Settings, Shield, Check, ShieldAlert, MessageCircle, Bell, LogOut, Eye, Download, Loader2, ListChecks, Megaphone } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import QRCode from 'qrcode';

interface ManagementProps {
  lang: Language;
}

type Tab = 'users' | 'students' | 'timetable' | 'epass' | 'access' | 'notifications' | 'attendance_rules';

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

  // Student Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [filterGrade, setFilterGrade] = useState("All");
  const [filterSection, setFilterSection] = useState("All");
  const [filterGender, setFilterGender] = useState("All");
  const [sortBy, setSortBy] = useState<"name" | "grade" | "number">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

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
      alertThresholds: [3, 6, 10, 15]
  });

  const [rolePermissions, setRolePermissions] = useState<RolePermissions>({});
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
    setRolePermissions(settings.rolePermissions);
    setAttendanceRules(settings.attendanceSettings || { absentPeriodThreshold: 3, countAllExcusedAsExcusedDay: true, alertThresholds: [3, 6, 10, 15] });
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

  // --- Student Logic ---

  const uniqueGrades = Array.from(new Set(students.map(s => s.grade))).sort();
  const uniqueSections = Array.from(new Set(students.map(s => s.section))).sort();

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
        valA = `${a.grade}-${a.section}`;
        valB = `${b.grade}-${b.section}`;
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

  const handleSaveStudent = async () => {
    if (!formData.studentNumber || !formData.name_en || !formData.grade || !formData.section) {
        alert("Please fill in all required fields (ID, Name EN, Grade, Section)");
        return;
    }

    setIsLoading(true);
    try {
        const studentData = {
            ...formData,
            gender: formData.gender || 'Male',
            transportMode: formData.transportMode || 'Bus',
            // Ensure all fields are defined to prevent Supabase issues
            name_ar: formData.name_ar || '',
            busRoute: formData.busRoute || '',
            familyId: formData.familyId || '',
            isWatchlisted: formData.isWatchlisted || false
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

    if (!confirm(`Are you sure you want to upload "${file.name}"? This will add students to the database.`)) {
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
                alert(`Successfully imported ${mappedStudents.length} students.`);
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
        win.document.write('<html><head><title>Print ID Card</title>');
        win.document.write('<script src="https://cdn.tailwindcss.com"></script>');
        win.document.write('</head><body class="flex items-center justify-center h-screen bg-white">');
        win.document.write(printContent.innerHTML);
        win.document.write('</body></html>');
        win.document.close();
        setTimeout(() => {
            win.print();
            win.close();
        }, 1000);
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
            role: formData.role || UserRole.TEACHER, // Enforce default Role
            assignedClasses: formData.assignedClasses || [],
            telegramChatId: formData.telegramChatId || null
        };

        if (editingUser) {
          await store.updateUser(editingUser.id, userData);
          alert("User updated successfully.");
        } else {
          await store.addUser(userData);
          // Note: Backend now handles Auth creation via /api/create_user
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
          const destData = {
              label_en: formData.label_en || 'New Destination',
              label_ar: formData.label_ar || 'وجهة جديدة',
              iconName: formData.iconName || 'Ticket', // Default icon
              colorTheme: formData.colorTheme || 'blue', // Default color
              maxDuration: parseInt(formData.maxDuration) || 10 // Default duration
          };

          if (editingDest) {
              await store.updateDestination(editingDest.id, destData);
          } else {
              await store.addDestination(destData);
          }
          setEditingDest(null);
          setIsAddingDest(false);
          setFormData({});
          await refreshData();
      } catch(e) {
          alert("Error saving destination");
      } finally {
          setIsLoading(false);
      }
  };

  const handleDeleteDest = async (id: string) => {
      if (confirm("Are you sure you want to delete this destination?")) {
          await store.deleteDestination(id);
          await refreshData();
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

  const toggleNotificationRule = (key: string) => {
      setNotificationRules(prev => ({
          ...prev,
          [key]: !prev[key]
      }));
  };

  const handleToggleAccess = async (navId: string) => {
      const currentPerms = rolePermissions[selectedRoleForAccess] || [];
      let newPerms: string[];
      
      if (currentPerms.includes(navId)) {
          newPerms = currentPerms.filter(id => id !== navId);
      } else {
          newPerms = [...currentPerms, navId];
      }

      const updatedRolePermissions = {
          ...rolePermissions,
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

  const renderIdCardModal = () => {
    if (!viewingCard) return null;
    
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 no-print">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-lg">{t.generateId}</h3>
                    <button onClick={() => setViewingCard(null)} className="p-2 hover:bg-slate-100 rounded-full">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-8 bg-slate-100 flex justify-center">
                    <div id="id-card-container">
                        <div className="w-[480px] bg-white rounded-xl overflow-hidden shadow-xl border border-slate-200 relative flex flex-col print:shadow-none print:border" 
                             style={{ borderTop: '12px solid #458489' }}>
                            
                            <div className="p-8">
                                <div className="mb-6">
                                    <div className="flex justify-between items-start">
                                        <h1 className="text-3xl font-bold text-slate-900">{lang === 'en' ? viewingCard.name_en : viewingCard.name_ar}</h1>
                                        {viewingCard.isWatchlisted && (
                                            <Eye className="text-red-500 animate-pulse" />
                                        )}
                                    </div>
                                    {lang === 'en' && viewingCard.name_ar && <h2 className="text-lg text-slate-500 font-medium">{viewingCard.name_ar}</h2>}
                                    {lang === 'ar' && viewingCard.name_en && <h2 className="text-lg text-slate-500 font-medium">{viewingCard.name_en}</h2>}
                                </div>

                                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 mb-8">
                                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold">{t.grade}</span>
                                        <span className="font-bold text-slate-800">{viewingCard.grade} - {viewingCard.section}</span>
                                    </div>
                                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold">ID</span>
                                        <span className="font-mono font-bold text-slate-800">{viewingCard.studentNumber}</span>
                                    </div>
                                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold">{t.transport}</span>
                                        <span className="font-bold text-slate-800">{viewingCard.transportMode} {viewingCard.busRoute ? `(${viewingCard.busRoute})` : ''}</span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-end border-t border-slate-100 pt-4">
                                    <div>
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">{t.trackivaAcademy}</p>
                                        <p className="text-[10px] text-slate-400">{t.academicYear}</p>
                                    </div>
                                    {qrDataUrl && (
                                        <img src={qrDataUrl} alt="QR Code" className="w-20 h-20 rounded-lg border border-slate-200 p-1" />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-white rounded-b-2xl">
                    <Button variant="secondary" onClick={() => setViewingCard(null)}>{t.cancel}</Button>
                    <Button onClick={handlePrintCard}>
                        <Printer size={16} /> {t.printCard}
                    </Button>
                </div>
            </div>
        </div>
    );
  }

  const renderStudentForm = () => (
    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-6 animate-in fade-in shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg text-slate-800">{editingStudent ? t.actions : t.addStudent}</h3>
        <Button variant="ghost" onClick={() => { setEditingStudent(null); setIsAddingStudent(false); }}>{t.cancel}</Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="col-span-1">
             <label className="block text-xs font-bold text-slate-500 mb-1">{t.studentNumber} *</label>
             <Input 
                placeholder="2024XXX" 
                value={formData.studentNumber || ''} 
                onChange={e => setFormData({...formData, studentNumber: e.target.value})} 
            />
        </div>
        <div className="col-span-1">
            <label className="block text-xs font-bold text-slate-500 mb-1">{t.gender} *</label>
            <Select 
                value={formData.gender || 'Male'} 
                onChange={e => setFormData({...formData, gender: e.target.value})}
            >
                <option value="Male">{t.male}</option>
                <option value="Female">{t.female}</option>
            </Select>
        </div>
        <div className="col-span-1 md:col-span-2 lg:col-span-1">
             <label className="block text-xs font-bold text-slate-500 mb-1">{t.transport}</label>
             <Select 
                value={formData.transportMode || 'Bus'} 
                onChange={e => setFormData({...formData, transportMode: e.target.value})}
            >
                <option value="Bus">{t.bus}</option>
                <option value="Car">{t.car}</option>
                <option value="Walker">{t.walker}</option>
            </Select>
        </div>

        <div className="col-span-1">
            <label className="block text-xs font-bold text-slate-500 mb-1">{t.labelEn} *</label>
            <Input 
                placeholder="John Doe" 
                value={formData.name_en || ''} 
                onChange={e => setFormData({...formData, name_en: e.target.value})} 
            />
        </div>
        <div className="col-span-1">
            <label className="block text-xs font-bold text-slate-500 mb-1">{t.labelAr}</label>
            <Input 
                placeholder="الاسم" 
                value={formData.name_ar || ''} 
                onChange={e => setFormData({...formData, name_ar: e.target.value})} 
            />
        </div>
        <div className="flex gap-2 col-span-1">
            <div className="w-1/2">
                <label className="block text-xs font-bold text-slate-500 mb-1">{t.grade} *</label>
                <Input 
                    placeholder="10" 
                    value={formData.grade || ''} 
                    onChange={e => setFormData({...formData, grade: e.target.value})} 
                />
            </div>
            <div className="w-1/2">
                <label className="block text-xs font-bold text-slate-500 mb-1">{t.section} *</label>
                <Input 
                    placeholder="A" 
                    value={formData.section || ''} 
                    onChange={e => setFormData({...formData, section: e.target.value})} 
                />
            </div>
        </div>
        
        {/* Family ID Input */}
        <div className="col-span-1">
            <label className="block text-xs font-bold text-slate-500 mb-1">{t.familyId}</label>
            <Input 
                placeholder="FAM-001" 
                value={formData.familyId || ''} 
                onChange={e => setFormData({...formData, familyId: e.target.value})} 
            />
            <p className="text-[10px] text-slate-400 mt-1">Assign same ID to link siblings.</p>
        </div>

        <div className="col-span-1 md:col-span-2 bg-red-50 p-4 rounded-lg border border-red-100">
            <label className="flex items-center gap-3 cursor-pointer">
                <input 
                    type="checkbox" 
                    className="w-5 h-5 rounded text-red-600 focus:ring-red-500"
                    checked={formData.isWatchlisted || false}
                    onChange={e => setFormData({...formData, isWatchlisted: e.target.checked})}
                />
                <div>
                    <span className="font-bold text-red-800 text-sm block">{t.watchlist}</span>
                    <span className="text-xs text-red-600">Flag this student for strict monitoring and targeted alerts.</span>
                </div>
            </label>
        </div>
    </div>
    {formData.transportMode === 'Bus' && (
         <div className="mt-4">
            <label className="block text-xs font-bold text-slate-500 mb-1">Bus Route Number</label>
            <Input 
                placeholder="R-101" 
                value={formData.busRoute || ''} 
                onChange={e => setFormData({...formData, busRoute: e.target.value})} 
            />
         </div>
    )}
      <div className="flex gap-2 mt-6 justify-end border-t border-slate-200 pt-4">
        <Button disabled={isLoading} onClick={handleSaveStudent}>{t.save}</Button>
      </div>
    </div>
  );

  const renderUserForm = () => (
    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-6 animate-in fade-in shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg text-slate-800">{editingUser ? t.actions : t.addUser}</h3>
        <Button variant="ghost" onClick={() => { setEditingUser(null); setIsAddingUser(false); }}>{t.cancel}</Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">{t.studentName}</label>
            <Input 
                placeholder="Name" 
                value={formData.name || ''} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
            />
        </div>
        <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">{t.email}</label>
            <Input 
                placeholder="Email" 
                value={formData.email || ''} 
                onChange={e => setFormData({...formData, email: e.target.value})} 
            />
        </div>
        <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">{t.role}</label>
            <Select 
                value={formData.role || UserRole.TEACHER} 
                onChange={e => setFormData({...formData, role: e.target.value})}
            >
                {ROLES_LIST.map(r => (
                    <option key={r} value={r}>{r}</option>
                ))}
            </Select>
        </div>
        
        {/* Social Worker Chat ID Input */}
        {formData.role === UserRole.SOCIAL_WORKER && (
            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{t.userChatId}</label>
                <Input 
                    placeholder="e.g. 123456789" 
                    value={formData.telegramChatId || ''} 
                    onChange={e => setFormData({...formData, telegramChatId: e.target.value})} 
                />
            </div>
        )}
        
        {/* Assigned Classes Section */}
        <div className="md:col-span-2 border-t border-slate-200 pt-4 mt-2">
             <h4 className="font-bold text-sm text-slate-700 mb-2">{t.assignedClasses}</h4>
             <div className="flex gap-2 mb-3">
                  <div className="flex-1">
                      <Select value={assignedClassGrade} onChange={e => setAssignedClassGrade(e.target.value)}>
                          <option value="">{t.grade}</option>
                          {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
                      </Select>
                  </div>
                  <div className="flex-1">
                       <Select value={assignedClassSection} onChange={e => setAssignedClassSection(e.target.value)}>
                          <option value="">{t.section}</option>
                          {uniqueSections.map(s => <option key={s} value={s}>{s}</option>)}
                      </Select>
                  </div>
                  <Button onClick={handleAddAssignedClass} disabled={!assignedClassGrade || !assignedClassSection} variant="secondary">
                      <Plus size={16} /> {t.addClass}
                  </Button>
             </div>
             
             {formData.assignedClasses && formData.assignedClasses.length > 0 ? (
                 <div className="flex flex-wrap gap-2">
                     {formData.assignedClasses.map((cls: AssignedClass, index: number) => (
                         <div key={`${cls.grade}-${cls.section}`} className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm border border-blue-100">
                             <span>{cls.grade} - {cls.section}</span>
                             <button onClick={() => handleRemoveAssignedClass(index)} className="hover:text-red-600"><X size={14} /></button>
                         </div>
                     ))}
                 </div>
             ) : (
                 <p className="text-xs text-slate-400 italic">No classes assigned.</p>
             )}
        </div>
      </div>
      <div className="flex gap-2 mt-6 justify-end">
        <Button disabled={isLoading} onClick={handleSaveUser}>{t.save}</Button>
      </div>
    </div>
  );

  const renderDestForm = () => (
      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-6 animate-in fade-in shadow-sm">
          <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-slate-800">{editingDest ? t.editDestination : t.addDestination}</h3>
              <Button variant="ghost" onClick={() => { setEditingDest(null); setIsAddingDest(false); }}>{t.cancel}</Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t.labelEn}</label>
                  <Input value={formData.label_en || ''} onChange={e => setFormData({...formData, label_en: e.target.value})} />
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t.labelAr}</label>
                  <Input value={formData.label_ar || ''} onChange={e => setFormData({...formData, label_ar: e.target.value})} />
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t.duration}</label>
                  <Input type="number" value={formData.maxDuration || ''} onChange={e => setFormData({...formData, maxDuration: e.target.value})} />
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t.color}</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                      {COLOR_THEMES.map(c => (
                          <button
                              key={c.name}
                              onClick={() => setFormData({...formData, colorTheme: c.name})}
                              className={`w-6 h-6 rounded-full border-2 ${formData.colorTheme === c.name ? 'border-slate-800 scale-110' : 'border-transparent'} ${c.class.split(' ')[0]}`}
                          />
                      ))}
                  </div>
              </div>
              <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t.icon}</label>
                  <div className="flex flex-wrap gap-2 p-2 bg-white border border-slate-200 rounded-lg h-32 overflow-y-auto">
                      {AVAILABLE_ICONS.map(iconName => {
                          // Dynamic icon rendering
                          const Icon = (LucideIcons as any)[iconName] || Ticket;
                          return (
                              <button 
                                  key={iconName}
                                  onClick={() => setFormData({...formData, iconName: iconName})}
                                  className={`p-2 rounded-lg hover:bg-slate-100 transition-colors ${formData.iconName === iconName ? 'bg-blue-100 text-blue-600 ring-1 ring-blue-500' : 'text-slate-500'}`}
                              >
                                  <Icon size={20} />
                              </button>
                          )
                      })}
                  </div>
              </div>
          </div>
          <div className="flex gap-2 mt-6 justify-end">
              <Button disabled={isLoading} onClick={handleSaveDest}>{t.save}</Button>
          </div>
      </div>
  );

  const renderNotificationsTab = () => (
      <div className="space-y-6">
          <Card>
              <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><Bell size={24} /></div>
                  <div>
                      <h3 className="text-lg font-bold text-slate-800">{t.telegramSettings}</h3>
                      <p className="text-sm text-slate-500">Configure alerting channels for different modules.</p>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Security Alerts */}
                  <div className="p-4 border border-slate-200 rounded-xl bg-red-50/30">
                      <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                          <ShieldAlert size={18} className="text-red-500" /> {t.securityAlerts}
                      </h4>
                      <p className="text-xs text-slate-500 mb-4">Used for unauthorized exits and security breaches.</p>
                      <div className="space-y-3">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">{t.botToken}</label>
                              <Input value={telegramToken} onChange={e => setTelegramToken(e.target.value)} type="password" />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">{t.chatId}</label>
                              <Input value={telegramChatId} onChange={e => setTelegramChatId(e.target.value)} />
                          </div>
                      </div>
                  </div>

                  {/* Reception Alerts */}
                  <div className="p-4 border border-slate-200 rounded-xl bg-orange-50/30">
                      <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                          <LogOut size={18} className="text-orange-500" /> {t.receptionAlerts}
                      </h4>
                      <p className="text-xs text-slate-500 mb-4">Used for notifying parents/admins about Early Leave.</p>
                      <div className="space-y-3">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">{t.botToken}</label>
                              <Input value={elTelegramToken} onChange={e => setElTelegramToken(e.target.value)} type="password" />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">{t.chatId}</label>
                              <Input value={elTelegramChatId} onChange={e => setElTelegramChatId(e.target.value)} />
                          </div>
                      </div>
                  </div>

                  {/* Attendance Alerts */}
                  <div className="p-4 border border-slate-200 rounded-xl bg-blue-50/30">
                      <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                          <Megaphone size={18} className="text-blue-600" /> {t.attendanceAlerts}
                      </h4>
                      <p className="text-xs text-slate-500 mb-4">Used for notifying Social Workers about absence thresholds.</p>
                      <div className="space-y-3">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">{t.botToken}</label>
                              <Input value={attTelegramToken} onChange={e => setAttTelegramToken(e.target.value)} type="password" />
                          </div>
                      </div>
                  </div>

                  {/* Watchlist Alerts */}
                  <div className="p-4 border border-slate-200 rounded-xl bg-yellow-50/30 md:col-span-1">
                      <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                          <Eye size={18} className="text-yellow-600" /> {t.watchlistAlerts}
                      </h4>
                      <p className="text-xs text-slate-500 mb-4">{t.watchlistDesc}</p>
                      <div className="grid grid-cols-1 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">{t.botToken}</label>
                              <Input value={wlTelegramToken} onChange={e => setWlTelegramToken(e.target.value)} type="password" />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">{t.chatId}</label>
                              <Input value={wlTelegramChatId} onChange={e => setWlTelegramChatId(e.target.value)} />
                          </div>
                      </div>
                  </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100">
                  <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                      <Check size={18} className="text-green-500" /> {t.notificationRules}
                  </h4>
                  <p className="text-xs text-slate-500 mb-4">{t.enableNotificationsFor}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                          <input 
                              type="checkbox" 
                              checked={notificationRules['UNAUTHORIZED'] !== false} // Default true
                              onChange={() => toggleNotificationRule('UNAUTHORIZED')}
                              className="rounded text-primary focus:ring-primary"
                          />
                          <span className="text-sm font-medium text-red-600">{t.unauthorized}</span>
                       </label>
                       
                       {destinations.map(d => (
                           <label key={d.id} className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                              <input 
                                  type="checkbox" 
                                  checked={notificationRules[d.id] === true}
                                  onChange={() => toggleNotificationRule(d.id)}
                                  className="rounded text-primary focus:ring-primary"
                              />
                              <span className="text-sm font-medium">{lang === 'en' ? d.label_en : d.label_ar}</span>
                           </label>
                       ))}
                  </div>
              </div>

              <div className="mt-6 flex justify-end">
                  <Button onClick={handleUpdateNotificationSettings}>{t.saveCredentials}</Button>
              </div>
          </Card>
          
          {/* Parent Notification Section */}
          <Card>
              <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-purple-100 text-purple-600 rounded-full"><MessageCircle size={24} /></div>
                  <div>
                      <h3 className="text-lg font-bold text-slate-800">{t.parentNotifications}</h3>
                      <p className="text-sm text-slate-500">{t.parentNotificationsDesc}</p>
                  </div>
              </div>

              <div className="max-w-lg relative mb-6">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                  <Input 
                      placeholder={t.searchStudent} 
                      className="pl-10"
                      value={parentSearch}
                      onChange={e => setParentSearch(e.target.value)}
                  />
                  {parentSearch && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 z-10">
                          {filteredParentSearch.map(s => (
                              <button 
                                  key={s.id}
                                  onClick={() => handleParentSearchSelect(s)}
                                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm"
                              >
                                  {lang === 'en' ? s.name_en : s.name_ar} ({s.studentNumber})
                              </button>
                          ))}
                      </div>
                  )}
              </div>

              {selectedStudentForParent && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 animate-in fade-in">
                      <div className="flex justify-between items-start mb-4">
                          <div>
                              <h4 className="font-bold text-slate-800">{lang === 'en' ? selectedStudentForParent.name_en : selectedStudentForParent.name_ar}</h4>
                              <p className="text-xs text-slate-500">ID: {selectedStudentForParent.studentNumber}</p>
                          </div>
                          <button onClick={() => setSelectedStudentForParent(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
                      </div>
                      
                      <div className="space-y-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">{t.parentChatId}</label>
                              <Input value={parentChatId} onChange={e => setParentChatId(e.target.value)} placeholder="e.g. 123456789" />
                          </div>

                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-2">{t.selectEvents}</label>
                              <div className="grid grid-cols-2 gap-3">
                                   <label className="flex items-center gap-2">
                                      <input 
                                          type="checkbox" 
                                          checked={parentRules['UNAUTHORIZED'] || false}
                                          onChange={() => toggleParentRule('UNAUTHORIZED')}
                                          className="rounded text-purple-600 focus:ring-purple-500"
                                      />
                                      <span className="text-sm">{t.unauthorized}</span>
                                  </label>
                                  <label className="flex items-center gap-2">
                                      <input 
                                          type="checkbox" 
                                          checked={parentRules['EARLY_LEAVE'] || false}
                                          onChange={() => toggleParentRule('EARLY_LEAVE')}
                                          className="rounded text-purple-600 focus:ring-purple-500"
                                      />
                                      <span className="text-sm">{t.earlyLeave}</span>
                                  </label>
                                  {destinations.map(d => (
                                      <label key={d.id} className="flex items-center gap-2">
                                          <input 
                                              type="checkbox" 
                                              checked={parentRules[d.id] || false}
                                              onChange={() => toggleParentRule(d.id)}
                                              className="rounded text-purple-600 focus:ring-purple-500"
                                          />
                                          <span className="text-sm">{lang === 'en' ? d.label_en : d.label_ar}</span>
                                      </label>
                                  ))}
                              </div>
                          </div>
                          
                          <Button disabled={isLoading} onClick={handleSaveParentSettings} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                              {t.saveParentSettings}
                          </Button>
                      </div>
                  </div>
              )}
          </Card>
      </div>
  );

  const renderAttendanceRules = () => (
      <Card>
          <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-slate-100 text-slate-600 rounded-full"><ListChecks size={24} /></div>
              <div>
                  <h3 className="text-lg font-bold text-slate-800">{t.attendanceRules}</h3>
                  <p className="text-sm text-slate-500">{t.attendanceRulesDesc}</p>
              </div>
          </div>

          <div className="space-y-6 max-w-xl">
              {/* Threshold for calculating daily absent status */}
              <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">{t.absentThreshold}</label>
                  <p className="text-xs text-slate-500 mb-2">{t.absentThresholdDesc}</p>
                  <Input 
                      type="number" 
                      min={1}
                      max={10}
                      value={attendanceRules.absentPeriodThreshold} 
                      onChange={e => setAttendanceRules({...attendanceRules, absentPeriodThreshold: parseInt(e.target.value) || 3})} 
                  />
              </div>

              {/* Excused Logic Toggle */}
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                  <label className="flex items-start gap-3 cursor-pointer">
                      <input 
                          type="checkbox" 
                          className="mt-1 w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                          checked={attendanceRules.countAllExcusedAsExcusedDay}
                          onChange={e => setAttendanceRules({...attendanceRules, countAllExcusedAsExcusedDay: e.target.checked})}
                      />
                      <div>
                          <span className="font-bold text-slate-800 text-sm block">{t.countAllExcused}</span>
                          <span className="text-xs text-slate-600">{t.countAllExcusedDesc}</span>
                      </div>
                  </label>
              </div>

              {/* Notification Thresholds */}
              <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">{t.attendanceAlertThresholds}</label>
                  <p className="text-xs text-slate-500 mb-3">{t.attendanceAlertDesc}</p>
                  
                  <div className="flex flex-wrap gap-3">
                      {[1, 3, 6, 10, 15].map(days => {
                          const isSelected = attendanceRules.alertThresholds?.includes(days);
                          return (
                              <button 
                                  key={days}
                                  onClick={() => toggleAttendanceAlertThreshold(days)}
                                  className={`px-4 py-2 rounded-lg border text-sm font-bold transition-all ${isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                              >
                                  {days} Days
                              </button>
                          );
                      })}
                  </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                  <Button disabled={isLoading} onClick={handleUpdateAttendanceRules}>{t.saveRules}</Button>
              </div>
          </div>
      </Card>
  );

  const renderAccessControl = () => (
      <Card>
          <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-slate-100 text-slate-600 rounded-full"><Shield size={24} /></div>
              <div>
                  <h3 className="text-lg font-bold text-slate-800">{t.accessControl}</h3>
                  <p className="text-sm text-slate-500">{t.manageRoles}</p>
              </div>
          </div>

          <div className="mb-6">
              <label className="block text-xs font-bold text-slate-500 mb-1">{t.selectRole}</label>
              <Select 
                  value={selectedRoleForAccess} 
                  onChange={e => setSelectedRoleForAccess(e.target.value)}
                  className="max-w-xs"
              >
                  {ROLES_LIST.map(r => <option key={r} value={r}>{r}</option>)}
              </Select>
          </div>

          <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                  <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                          <th className="p-4 font-bold">{t.module}</th>
                          <th className="p-4 font-bold text-center">{t.access}</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {NAV_ITEMS.map(item => {
                          const hasAccess = (rolePermissions[selectedRoleForAccess] || []).includes(item.id);
                          const Icon = item.icon;
                          return (
                              <tr key={item.id} className="hover:bg-slate-50">
                                  <td className="p-4 flex items-center gap-3">
                                      <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                                          <Icon size={18} />
                                      </div>
                                      <span className="font-medium text-slate-700">{lang === 'en' ? item.label_en : item.label_ar}</span>
                                  </td>
                                  <td className="p-4 text-center">
                                      <label className="relative inline-flex items-center cursor-pointer">
                                          <input 
                                              type="checkbox" 
                                              className="sr-only peer"
                                              checked={hasAccess}
                                              onChange={() => handleToggleAccess(item.id)}
                                          />
                                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                      </label>
                                  </td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
          
          <div className="mt-4 p-3 bg-yellow-50 text-yellow-800 text-sm rounded-lg flex gap-2 items-start">
              <ShieldAlert size={16} className="mt-0.5 shrink-0" />
              <p>Changes to access control are saved immediately but may require users to refresh their session to take effect.</p>
          </div>
      </Card>
  );

  return (
    <div className="space-y-6">
      {renderIdCardModal()}
      
      {/* Top Navigation */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto">
         {[
             { id: 'users', label: t.users, icon: Users },
             { id: 'students', label: t.students, icon: GraduationCap },
             { id: 'timetable', label: t.timetable, icon: Clock },
             { id: 'epass', label: t.destinations, icon: Ticket },
             { id: 'attendance_rules', label: t.attendanceRules, icon: ListChecks },
             { id: 'access', label: t.accessControl, icon: Shield },
             { id: 'notifications', label: t.notifications, icon: Bell }
         ].map(tab => (
             <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                 <tab.icon size={16} />
                 {tab.label}
             </button>
         ))}
      </div>

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <div>
          <div className="flex justify-between items-center mb-6">
              <div className="flex gap-4 w-full max-w-lg">
                  <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                      <Input 
                          placeholder="Search Users..." 
                          className="pl-10" 
                          value={userSearchTerm}
                          onChange={e => setUserSearchTerm(e.target.value)}
                      />
                  </div>
                  <Select 
                      value={userRoleFilter}
                      onChange={e => setUserRoleFilter(e.target.value)}
                      className="w-40"
                  >
                      <option value="All">All Roles</option>
                      {ROLES_LIST.map(r => <option key={r} value={r}>{r}</option>)}
                  </Select>
              </div>
              <Button onClick={() => setIsAddingUser(true)}><Plus size={18} /> {t.addUser}</Button>
          </div>

          {isAddingUser && renderUserForm()}
          {editingUser && renderUserForm()}

          <Card className="overflow-hidden p-0">
             <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                    <tr>
                        <th className="p-4">{t.studentName}</th>
                        <th className="p-4">{t.email}</th>
                        <th className="p-4">{t.role}</th>
                        <th className="p-4 text-right">{t.actions}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map(user => (
                        <tr key={user.id} className="hover:bg-slate-50">
                            <td className="p-4 font-medium">
                                <div>{user.name}</div>
                                {user.assignedClasses && user.assignedClasses.length > 0 && (
                                    <div className="flex gap-1 mt-1">
                                        {user.assignedClasses.map((c, i) => (
                                            <span key={i} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">
                                                {c.grade}-{c.section}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </td>
                            <td className="p-4 text-slate-500">{user.email}</td>
                            <td className="p-4"><Badge color="blue">{user.role}</Badge></td>
                            <td className="p-4 text-right flex justify-end gap-2">
                                <Button variant="ghost" onClick={() => { setEditingUser(user); setFormData(user); }}>
                                    <Edit2 size={16} />
                                </Button>
                                <Button variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => handleDeleteUser(user.id)}>
                                    <Trash2 size={16} />
                                </Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
             </table>
          </Card>
        </div>
      )}

      {/* STUDENTS TAB */}
      {activeTab === 'students' && (
        <div>
           <Card className="mb-6">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  <h2 className="text-xl font-bold text-slate-800">{t.students}</h2>
                  <div className="flex gap-2">
                      <label className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                          {isUploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                          <span className="font-bold text-sm">{isUploading ? t.uploading : t.upload}</span>
                          <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleBulkUpload} disabled={isUploading} />
                      </label>
                      <Button variant="secondary" onClick={handleDownloadTemplate}>
                          <Download size={16} /> {t.downloadTemplate}
                      </Button>
                      <Button onClick={() => setIsAddingStudent(true)}>
                          <Plus size={16} /> {t.addStudent}
                      </Button>
                  </div>
              </div>
              
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="lg:col-span-2 relative">
                      <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                      <Input 
                          placeholder={t.searchPlaceholder} 
                          className="pl-10"
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                      />
                  </div>
                  <div className="flex gap-2 items-center">
                      <Filter size={16} className="text-slate-400" />
                      <span className="text-xs font-bold text-slate-500 whitespace-nowrap">{t.filterBy}:</span>
                      <Select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className="py-1 text-sm">
                          <option value="All">{t.allGrades}</option>
                          {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
                      </Select>
                      <Select value={filterSection} onChange={e => setFilterSection(e.target.value)} className="py-1 text-sm">
                          <option value="All">{t.allSections}</option>
                          {uniqueSections.map(s => <option key={s} value={s}>{s}</option>)}
                      </Select>
                      <Select value={filterGender} onChange={e => setFilterGender(e.target.value)} className="py-1 text-sm">
                          <option value="All">{t.allGenders}</option>
                          <option value="Male">{t.male}</option>
                          <option value="Female">{t.female}</option>
                      </Select>
                  </div>
                  <div className="flex gap-2 items-center justify-end">
                       <ArrowUpDown size={16} className="text-slate-400" />
                       <span className="text-xs font-bold text-slate-500 whitespace-nowrap">{t.sortBy}:</span>
                       <Select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="py-1 text-sm w-32">
                           <option value="name">{t.studentName}</option>
                           <option value="grade">{t.grade}</option>
                           <option value="number">{t.studentNumber}</option>
                       </Select>
                       <button 
                          onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                          className="p-2 bg-slate-100 rounded hover:bg-slate-200"
                       >
                           {sortOrder === 'asc' ? <ArrowDownAZ size={16} /> : <ArrowUpDown size={16} className="rotate-180" />}
                       </button>
                  </div>
              </div>
           </Card>

           {isAddingStudent && renderStudentForm()}
           {editingStudent && renderStudentForm()}

           <Card className="overflow-hidden p-0">
              <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                      <tr>
                          <th className="p-4">{t.studentNumber}</th>
                          <th className="p-4">{t.studentName}</th>
                          <th className="p-4">{t.gender}</th>
                          <th className="p-4">{t.grade}</th>
                          <th className="p-4">{t.transport}</th>
                          <th className="p-4 text-right">{t.actions}</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filteredStudents.map(student => (
                          <tr key={student.id} className={`hover:bg-slate-50 ${student.isWatchlisted ? 'bg-red-50/30' : ''}`}>
                              <td className="p-4 font-mono text-slate-600">{student.studentNumber}</td>
                              <td className="p-4">
                                  <div className="font-bold text-slate-800 flex items-center gap-2">
                                      {lang === 'en' ? student.name_en : student.name_ar}
                                      {student.name_ar && lang === 'en' && <span className="text-xs text-slate-400 font-normal">{student.name_ar}</span>}
                                  </div>
                              </td>
                              <td className="p-4">
                                  <Badge color={student.gender === 'Male' ? 'blue' : 'red'}>
                                      {student.gender === 'Male' ? t.male : t.female}
                                  </Badge>
                              </td>
                              <td className="p-4 font-bold">{student.grade} - {student.section}</td>
                              <td className="p-4 text-sm text-slate-600">
                                  {student.transportMode} {student.busRoute && <span className="text-slate-400">({student.busRoute})</span>}
                              </td>
                              <td className="p-4 text-right flex justify-end gap-2">
                                  <Button variant="secondary" className="px-2 py-1" onClick={() => setViewingCard(student)}>
                                      <CreditCard size={16} />
                                  </Button>
                                  <Button variant="ghost" onClick={() => { setEditingStudent(student); setFormData(student); }}>
                                      <Edit2 size={16} />
                                  </Button>
                                  <Button variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => handleDeleteStudent(student.id)}>
                                      <Trash2 size={16} />
                                  </Button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
           </Card>
        </div>
      )}

      {/* TIMETABLE TAB */}
      {activeTab === 'timetable' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                  <Card>
                      <div className="flex justify-between items-center mb-6">
                          <div>
                              <h3 className="text-xl font-bold text-slate-800">{t.timetable}</h3>
                              <p className="text-sm text-slate-500">{t.timetableConfig}</p>
                          </div>
                          <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
                              <button 
                                  onClick={() => setEditingScheduleType('standard')}
                                  className={`px-3 py-1 rounded-md text-sm font-bold transition-all ${editingScheduleType === 'standard' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
                              >
                                  {t.standard}
                              </button>
                              <button 
                                  onClick={() => setEditingScheduleType('friday')}
                                  className={`px-3 py-1 rounded-md text-sm font-bold transition-all ${editingScheduleType === 'friday' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
                              >
                                  {t.friday}
                              </button>
                          </div>
                      </div>

                      <div className="space-y-3">
                          {schedule[editingScheduleType].map((slot, idx) => (
                              <div key={slot.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100 group">
                                  <span className="w-6 text-center text-slate-400 font-mono text-xs">{idx + 1}</span>
                                  <Input 
                                      value={slot.name} 
                                      onChange={(e) => handleSlotChange(slot.id, 'name', e.target.value)} 
                                      className="w-32 text-sm font-bold"
                                  />
                                  <Select 
                                      value={slot.type} 
                                      onChange={(e) => handleSlotChange(slot.id, 'type', e.target.value as any)}
                                      className="w-28 text-sm"
                                  >
                                      <option value="Period">Period</option>
                                      <option value="Break">Break</option>
                                      <option value="Lunch">Lunch</option>
                                  </Select>
                                  <Input 
                                      type="time" 
                                      value={slot.startTime} 
                                      onChange={(e) => handleSlotChange(slot.id, 'startTime', e.target.value)} 
                                      className="w-28 text-sm font-mono"
                                  />
                                  <span className="text-slate-400">-</span>
                                  <Input 
                                      type="time" 
                                      value={slot.endTime} 
                                      onChange={(e) => handleSlotChange(slot.id, 'endTime', e.target.value)} 
                                      className="w-28 text-sm font-mono"
                                  />
                                  <button 
                                      onClick={() => handleDeleteSlot(slot.id)}
                                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full ml-auto"
                                  >
                                      <X size={16} />
                                  </button>
                              </div>
                          ))}
                          
                          <button 
                              onClick={handleAddSlot}
                              className="w-full py-3 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 hover:text-primary hover:border-primary hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                          >
                              <Plus size={16} /> {t.addSlot}
                          </button>
                      </div>

                      <div className="mt-6 flex justify-between border-t border-slate-100 pt-4">
                          <Button variant="ghost" onClick={sortSchedule}>
                              <ArrowDownAZ size={16} /> {t.sortChrono}
                          </Button>
                          <Button disabled={isLoading} onClick={saveSchedule}>
                              <Check size={16} /> {t.saveSchedule}
                          </Button>
                      </div>
                  </Card>
              </div>
          </div>
      )}

      {/* DESTINATIONS & EPASS SETTINGS */}
      {activeTab === 'epass' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold text-slate-800">{t.destinations}</h2>
                      <Button onClick={() => setIsAddingDest(true)}><Plus size={16} /> {t.addDestination}</Button>
                  </div>
                  
                  {isAddingDest && renderDestForm()}
                  {editingDest && renderDestForm()}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {destinations.map(dest => {
                          const Icon = (LucideIcons as any)[dest.iconName] || Ticket;
                          return (
                              <Card key={dest.id} className="relative group hover:shadow-md transition-all">
                                  <div className="flex items-center gap-4">
                                      <div className={`p-3 rounded-full ${COLOR_THEMES.find(c => c.name === dest.colorTheme)?.class}`}>
                                          <Icon size={24} />
                                      </div>
                                      <div>
                                          <h4 className="font-bold text-slate-800">{dest.label_en}</h4>
                                          <p className="text-sm text-slate-500">{dest.label_ar}</p>
                                          <div className="flex gap-2 mt-1">
                                              <Badge color="gray">{dest.maxDuration}m</Badge>
                                          </div>
                                      </div>
                                  </div>
                                  <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => { setEditingDest(dest); setFormData(dest); }} className="p-1 text-slate-400 hover:text-blue-600"><Edit2 size={16} /></button>
                                      <button onClick={() => handleDeleteDest(dest.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                                  </div>
                              </Card>
                          )
                      })}
                  </div>
              </div>

              <div className="lg:col-span-1">
                   <Card>
                      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                          <Settings size={18} /> {t.globalSettings}
                      </h3>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-2">{t.maxPasses}</label>
                          <div className="flex gap-2">
                              <Input 
                                  type="number" 
                                  value={maxPasses} 
                                  onChange={(e) => setMaxPasses(parseInt(e.target.value))} 
                              />
                              <Button onClick={handleUpdateEPassSettings}>{t.updateLimit}</Button>
                          </div>
                      </div>
                   </Card>
              </div>
          </div>
      )}

      {/* NOTIFICATIONS TAB */}
      {activeTab === 'notifications' && renderNotificationsTab()}

      {/* ATTENDANCE RULES TAB */}
      {activeTab === 'attendance_rules' && renderAttendanceRules()}

      {/* ACCESS CONTROL TAB */}
      {activeTab === 'access' && renderAccessControl()}

    </div>
  );
};
