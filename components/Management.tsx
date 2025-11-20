
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Badge } from './ui';
import { store, User } from '../services/store';
import { Student, Language, UserRole, TimeSlot, EPassDestination, RolePermissions } from '../types';
import { TRANSLATIONS, ROLES_LIST, AVAILABLE_ICONS, COLOR_THEMES, NAV_ITEMS } from '../constants';
import { Users, GraduationCap, Upload, Trash2, Edit2, Plus, FileJson, Search, Filter, ArrowUpDown, IdCard, X, Printer, Clock, ArrowDownAZ, Ticket, Settings, Shield, Check, ShieldAlert, MessageCircle, Bell, LogOut, Eye } from 'lucide-react';
import QRCode from 'qrcode';
import * as LucideIcons from 'lucide-react';

interface ManagementProps {
  lang: Language;
}

type Tab = 'users' | 'students' | 'classes' | 'timetable' | 'epass' | 'access' | 'notifications';

export const Management: React.FC<ManagementProps> = ({ lang }) => {
  const t = TRANSLATIONS[lang];
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [students, setStudents] = useState<Student[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [destinations, setDestinations] = useState<EPassDestination[]>([]);
  
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
  
  // Watchlist Settings
  const [wlTelegramToken, setWlTelegramToken] = useState("");
  const [wlTelegramChatId, setWlTelegramChatId] = useState("");

  // Notification Rules
  const [notificationRules, setNotificationRules] = useState<Record<string, boolean>>({});
  
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>({});
  const [selectedRoleForAccess, setSelectedRoleForAccess] = useState<string>(UserRole.TEACHER);

  // ID Card State
  const [viewingCard, setViewingCard] = useState<Student | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Timetable State
  const [schedule, setSchedule] = useState(store.getSchedule());
  const [editingScheduleType, setEditingScheduleType] = useState<'standard' | 'friday'>('standard');

  // Form States
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
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
    setWlTelegramToken(settings.watchlistBotToken || "");
    setWlTelegramChatId(settings.watchlistChatId || "");
    setNotificationRules(settings.notificationRules || {});
    setRolePermissions(settings.rolePermissions);
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

  const handleSaveStudent = () => {
    if (editingStudent) {
      store.updateStudent(editingStudent.id, formData);
    } else {
      store.addStudent({ ...formData, gender: formData.gender || 'Male' });
    }
    setEditingStudent(null);
    setIsAddingStudent(false);
    setFormData({});
    refreshData();
  };

  const handleDeleteStudent = (id: string) => {
    if (confirm("Are you sure you want to delete this student?")) {
      store.deleteStudent(id);
      refreshData();
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`Are you sure you want to upload "${file.name}"? This will add students to the database.`)) {
      e.target.value = ''; // Reset input
      return;
    }

    setIsUploading(true);
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
        busRoute: row.busRoute || row['Bus Route'] || ''
      }));

      if (mappedStudents.length > 0) {
        store.bulkImportStudents(mappedStudents);
        refreshData();
        alert(`Successfully imported ${mappedStudents.length} students.`);
      } else {
        alert("No valid student data found in the Excel file.");
      }
    } catch (err) {
      console.error(err);
      alert("Error parsing Excel file. Please ensure it is a valid .xlsx or .xls file.");
    } finally {
      setIsUploading(false);
      e.target.value = '';
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

  // --- User Handlers ---

  const handleSaveUser = () => {
    if (editingUser) {
      store.updateUser(editingUser.id, formData);
    } else {
      store.addUser(formData);
    }
    setEditingUser(null);
    setIsAddingUser(false);
    setFormData({});
    refreshData();
  };

  const handleDeleteUser = (id: string) => {
     if (confirm("Delete this user?")) {
       store.deleteUser(id);
       refreshData();
     }
  };

  // --- Timetable Handlers ---

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

  const saveSchedule = () => {
      store.updateSchedule(editingScheduleType, schedule[editingScheduleType]);
      alert(t.attendanceSaved);
  };

  // --- Destination & Settings Handlers ---
  const handleSaveDest = () => {
      if (editingDest) {
          store.updateDestination(editingDest.id, formData);
      } else {
          store.addDestination({
              label_en: formData.label_en || 'New Destination',
              label_ar: formData.label_ar || 'وجهة جديدة',
              iconName: formData.iconName || 'Ticket',
              colorTheme: formData.colorTheme || 'blue',
              maxDuration: parseInt(formData.maxDuration) || 10
          });
      }
      setEditingDest(null);
      setIsAddingDest(false);
      setFormData({});
      refreshData();
  };

  const handleDeleteDest = (id: string) => {
      if (confirm("Are you sure you want to delete this destination?")) {
          store.deleteDestination(id);
          refreshData();
      }
  };

  const handleUpdateEPassSettings = () => {
      store.updateSettings({ 
          maxPassesPerDay: maxPasses,
      });
      alert("Limit updated successfully!");
  };

  const handleUpdateNotificationSettings = () => {
      store.updateSettings({ 
          telegramBotToken: telegramToken,
          telegramChatId: telegramChatId,
          earlyLeaveBotToken: elTelegramToken,
          earlyLeaveChatId: elTelegramChatId,
          watchlistBotToken: wlTelegramToken,
          watchlistChatId: wlTelegramChatId,
          notificationRules: notificationRules
      });
      alert("Notification credentials saved successfully!");
  };

  const toggleNotificationRule = (key: string) => {
      setNotificationRules(prev => ({
          ...prev,
          [key]: !prev[key]
      }));
  };

  // --- Access Control Handlers ---
  const handleToggleAccess = (navId: string) => {
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
      store.updateSettings({ rolePermissions: updatedRolePermissions });
  };

  // --- Render Helpers ---

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
                        {/* Landscape Card Container */}
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
        <div className="col-span-1 md:col-span-3 bg-red-50 p-4 rounded-lg border border-red-100">
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
        <Button onClick={handleSaveStudent}>{t.save}</Button>
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
        <div className="col-span-1 md:col-span-2">
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
      </div>
      <div className="flex gap-2 mt-6 justify-end border-t border-slate-200 pt-4">
        <Button onClick={handleSaveUser}>{t.save}</Button>
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
                  <Input value={formData.label_en || ''} onChange={e => setFormData({ ...formData, label_en: e.target.value })} />
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t.labelAr}</label>
                  <Input value={formData.label_ar || ''} onChange={e => setFormData({ ...formData, label_ar: e.target.value })} className="text-right" />
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t.duration}</label>
                  <Input type="number" value={formData.maxDuration || 10} onChange={e => setFormData({ ...formData, maxDuration: e.target.value })} />
              </div>
              <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">{t.color}</label>
                   <div className="flex flex-wrap gap-2">
                       {COLOR_THEMES.map(c => (
                           <button
                                key={c.name}
                                type="button"
                                onClick={() => setFormData({ ...formData, colorTheme: c.name })}
                                className={`w-8 h-8 rounded-full border-2 transition-all ${c.class.split(' ')[0]} ${formData.colorTheme === c.name ? 'border-slate-600 scale-110' : 'border-transparent'}`}
                           />
                       ))}
                   </div>
              </div>
              <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t.icon}</label>
                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-32 overflow-y-auto p-2 bg-white border border-slate-200 rounded-lg">
                      {AVAILABLE_ICONS.map(iconName => {
                          const Icon = (LucideIcons as any)[iconName];
                          return (
                              <button
                                key={iconName}
                                type="button"
                                onClick={() => setFormData({ ...formData, iconName })}
                                className={`p-2 rounded-lg flex items-center justify-center border transition-all ${formData.iconName === iconName ? 'bg-primary/10 border-primary text-primary' : 'border-transparent hover:bg-slate-50'}`}
                              >
                                  {Icon && <Icon size={20} />}
                              </button>
                          )
                      })}
                  </div>
              </div>
          </div>
          <div className="flex gap-2 mt-6 justify-end border-t border-slate-200 pt-4">
              <Button onClick={handleSaveDest}>{t.save}</Button>
          </div>
      </div>
  );

  return (
    <div className="space-y-6">
      {/* ID Card Modal */}
      {viewingCard && renderIdCardModal()}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <Button 
            variant={activeTab === 'users' ? 'primary' : 'ghost'} 
            onClick={() => setActiveTab('users')}
        >
            <Users size={18} /> {t.users}
        </Button>
        <Button 
            variant={activeTab === 'students' ? 'primary' : 'ghost'} 
            onClick={() => setActiveTab('students')}
        >
            <GraduationCap size={18} /> {t.students}
        </Button>
        <Button 
            variant={activeTab === 'classes' ? 'primary' : 'ghost'} 
            onClick={() => setActiveTab('classes')}
        >
            <FileJson size={18} /> {t.classes}
        </Button>
        <Button 
            variant={activeTab === 'timetable' ? 'primary' : 'ghost'} 
            onClick={() => setActiveTab('timetable')}
        >
            <Clock size={18} /> {t.timetable}
        </Button>
        <Button 
            variant={activeTab === 'epass' ? 'primary' : 'ghost'} 
            onClick={() => setActiveTab('epass')}
        >
            <Ticket size={18} /> {t.destinations}
        </Button>
        <Button 
            variant={activeTab === 'access' ? 'primary' : 'ghost'} 
            onClick={() => setActiveTab('access')}
        >
            <Shield size={18} /> {t.accessControl}
        </Button>
        <Button 
            variant={activeTab === 'notifications' ? 'primary' : 'ghost'} 
            onClick={() => setActiveTab('notifications')}
        >
            <Bell size={18} /> {t.notifications}
        </Button>
      </div>

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <Card>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{t.users}</h2>
                <Button onClick={() => { setFormData({}); setIsAddingUser(true); }}>
                    <Plus size={16} /> {t.addUser}
                </Button>
            </div>

            {(isAddingUser || editingUser) && renderUserForm()}

            {/* User Filters */}
            <div className="bg-slate-50 p-3 rounded-lg mb-4 border border-slate-200 flex flex-col md:flex-row gap-3 items-center">
                <div className="relative w-full md:w-auto flex-1">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <Input 
                        placeholder="Search Users..." 
                        className="pl-9"
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <span className="text-sm font-bold text-slate-500">{t.filterBy}:</span>
                    <Select 
                        value={userRoleFilter} 
                        onChange={(e) => setUserRoleFilter(e.target.value)}
                        className="w-full md:w-48"
                    >
                        <option value="All">All Roles</option>
                        {ROLES_LIST.map(role => (
                            <option key={role} value={role}>{role}</option>
                        ))}
                    </Select>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-200 text-slate-500 text-sm bg-slate-50">
                            <th className="p-3 rounded-tl-lg text-start">{t.studentName}</th>
                            <th className="p-3 text-start">{t.email}</th>
                            <th className="p-3 text-start">{t.role}</th>
                            <th className="p-3 text-center rounded-tr-lg">{t.actions}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-6 text-center text-slate-400 italic">No users found</td>
                            </tr>
                        ) : (
                            filteredUsers.map(user => (
                                <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                    <td className="p-3 font-medium text-start">{user.name}</td>
                                    <td className="p-3 text-slate-500 text-start">{user.email}</td>
                                    <td className="p-3 text-start"><Badge color="blue">{user.role}</Badge></td>
                                    <td className="p-3 flex justify-end gap-2">
                                        <button 
                                            onClick={() => { setEditingUser(user); setFormData(user); }}
                                            className="p-2 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteUser(user.id)}
                                            className="p-2 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
      )}

      {/* STUDENTS TAB */}
      {activeTab === 'students' && (
        <Card>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h2 className="text-xl font-bold">{t.students}</h2>
                <div className="flex gap-2 flex-wrap">
                     {/* Bulk Upload Excel */}
                    <div className="relative">
                        <input 
                            type="file" 
                            accept=".xlsx, .xls" 
                            id="bulk-upload" 
                            className="hidden" 
                            onChange={handleBulkUpload}
                            disabled={isUploading}
                        />
                        <Button 
                            variant="secondary" 
                            onClick={() => document.getElementById('bulk-upload')?.click()}
                            disabled={isUploading}
                        >
                            {isUploading ? (
                                <>Loading...</>
                            ) : (
                                <><Upload size={16} /> {t.upload} (Excel)</>
                            )}
                        </Button>
                    </div>
                    <Button onClick={() => { setFormData({}); setIsAddingStudent(true); }}>
                        <Plus size={16} /> {t.addStudent}
                    </Button>
                </div>
            </div>

            {(isAddingStudent || editingStudent) && renderStudentForm()}

            {/* Filters & Search Bar */}
            <div className="bg-slate-50 p-4 rounded-lg mb-4 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2">
                    <Search size={18} className="text-slate-400" />
                    <Input 
                        placeholder={t.searchPlaceholder} 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-white"
                    />
                </div>
                
                <div className="flex flex-wrap gap-2 items-center">
                    <div className="flex items-center gap-1 text-sm font-bold text-slate-600 rtl:ml-2 ltr:mr-2">
                        <Filter size={14} /> {t.filterBy}:
                    </div>
                    <select 
                        className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none"
                        value={filterGrade}
                        onChange={(e) => setFilterGrade(e.target.value)}
                    >
                        <option value="All">{t.allGrades}</option>
                        {uniqueGrades.map(g => <option key={g} value={g}>{t.grade} {g}</option>)}
                    </select>

                    <select 
                        className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none"
                        value={filterSection}
                        onChange={(e) => setFilterSection(e.target.value)}
                    >
                        <option value="All">{t.allSections}</option>
                        {uniqueSections.map(s => <option key={s} value={s}>{t.section} {s}</option>)}
                    </select>

                    <select 
                        className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none"
                        value={filterGender}
                        onChange={(e) => setFilterGender(e.target.value)}
                    >
                        <option value="All">{t.allGenders}</option>
                        <option value="Male">{t.male}</option>
                        <option value="Female">{t.female}</option>
                    </select>

                    <div className="h-6 w-px bg-slate-300 mx-2"></div>

                    <div className="flex items-center gap-1 text-sm font-bold text-slate-600 rtl:ml-2 ltr:mr-2">
                        <ArrowUpDown size={14} /> {t.sortBy}:
                    </div>
                    <select 
                        className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                    >
                        <option value="name">{t.studentName}</option>
                        <option value="grade">{t.grade}</option>
                        <option value="number">{t.studentNumber}</option>
                    </select>
                    <button 
                        className="p-2 bg-white border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                        onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    >
                        {sortOrder === 'asc' ? 'ASC' : 'DESC'}
                    </button>

                    {/* Reset Button */}
                    {(searchTerm || filterGrade !== 'All' || filterSection !== 'All' || filterGender !== 'All') && (
                        <button 
                            onClick={() => {
                                setSearchTerm("");
                                setFilterGrade("All");
                                setFilterSection("All");
                                setFilterGender("All");
                            }}
                            className="text-xs text-red-500 hover:underline ml-auto"
                        >
                            {t.clearFilters}
                        </button>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-200 text-slate-500 text-sm bg-slate-50">
                            <th className="p-3 rounded-tl-lg text-nowrap text-start">{t.studentNumber}</th>
                            <th className="p-3 text-start">{t.studentName}</th>
                            <th className="p-3 text-start">{t.gender}</th>
                            <th className="p-3 text-start">{t.grade}</th>
                            <th className="p-3 text-start">{t.transport}</th>
                            <th className="p-3 text-center rounded-tr-lg">{t.actions}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredStudents.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-slate-500 italic">
                                    {t.noStudentsFound}
                                </td>
                            </tr>
                        ) : (
                            filteredStudents.map(student => (
                                <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                                    <td className="p-3 font-mono text-slate-600 text-sm text-start">{student.studentNumber}</td>
                                    <td className="p-3 font-medium text-start">
                                        <div className="text-slate-900 flex items-center gap-2">
                                            {lang === 'en' ? student.name_en : student.name_ar}
                                            {student.isWatchlisted && <Eye size={14} className="text-red-500" />}
                                        </div>
                                        {lang === 'en' && <div className="text-xs text-slate-500">{student.name_ar}</div>}
                                    </td>
                                    <td className="p-3 text-start">
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${student.gender === 'Male' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'}`}>
                                            {student.gender === 'Male' ? t.male : t.female}
                                        </span>
                                    </td>
                                    <td className="p-3 text-sm text-slate-700 text-start">
                                        <span className="font-bold">{student.grade}</span> - {student.section}
                                    </td>
                                    <td className="p-3 text-sm text-slate-600 text-start">
                                        {student.transportMode}
                                        {student.busRoute && <span className="text-xs text-slate-400 mx-1">({student.busRoute})</span>}
                                    </td>
                                    <td className="p-3 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => setViewingCard(student)}
                                            className="p-2 rounded hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"
                                            title={t.generateId}
                                        >
                                            <IdCard size={16} />
                                        </button>
                                        <button 
                                            onClick={() => { setEditingStudent(student); setFormData(student); }}
                                            className="p-2 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteStudent(student.id)}
                                            className="p-2 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                <div className="p-4 border-t border-slate-100 text-xs text-slate-400 text-center">
                    Showing {filteredStudents.length} of {students.length} students
                </div>
            </div>
        </Card>
      )}

      {/* CLASSES TAB */}
      {activeTab === 'classes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from(new Set(students.map(s => `${s.grade}-${s.section}`))).sort().map(classId => {
                const classStudents = students.filter(s => `${s.grade}-${s.section}` === classId);
                const boys = classStudents.filter(s => s.gender === 'Male').length;
                const girls = classStudents.filter(s => s.gender === 'Female').length;

                return (
                    <Card key={classId} className="hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-800">{t.grade} {classId}</h3>
                            <Badge color="blue">{classStudents.length}</Badge>
                        </div>
                        <div className="flex gap-2 text-xs text-slate-500 mb-3">
                            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">{t.male}: {boys}</span>
                            <span className="bg-pink-50 text-pink-700 px-2 py-1 rounded">{t.female}: {girls}</span>
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto pr-2">
                            {classStudents.map(s => (
                                <div key={s.id} className="text-sm p-2 bg-slate-50 rounded border border-slate-100 flex justify-between items-center">
                                    <span className="truncate max-w-[70%]">{lang === 'en' ? s.name_en : s.name_ar}</span>
                                    <span className="text-slate-400 text-[10px]">{s.studentNumber}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                )
            })}
        </div>
      )}

      {/* TIMETABLE TAB */}
      {activeTab === 'timetable' && (
        <Card>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Clock className="text-primary" /> {t.timetableConfig}
                </h2>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button 
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${editingScheduleType === 'standard' ? 'bg-white shadow-sm text-primary' : 'text-slate-500'}`}
                        onClick={() => setEditingScheduleType('standard')}
                    >
                        {t.standard}
                    </button>
                    <button 
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${editingScheduleType === 'friday' ? 'bg-white shadow-sm text-primary' : 'text-slate-500'}`}
                        onClick={() => setEditingScheduleType('friday')}
                    >
                        {t.friday}
                    </button>
                </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-sm text-yellow-800 flex justify-between items-center">
                <span>
                    <strong>Note:</strong> Changing timings here will affect the "Current Period" display in the Attendance module. Ensure format is HH:MM.
                </span>
                <Button variant="secondary" className="text-xs bg-white" onClick={sortSchedule}>
                    <ArrowDownAZ size={14} /> {t.sortChrono}
                </Button>
            </div>

            <div className="overflow-x-auto mb-4">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-slate-50 text-slate-500 text-sm text-left">
                            <th className="p-3 rounded-tl-lg pl-4 text-start">{t.labelEn}</th>
                            <th className="p-3 text-start">{t.type}</th>
                            <th className="p-3 text-start">{t.startTime}</th>
                            <th className="p-3 text-start">{t.endTime}</th>
                            <th className="p-3 rounded-tr-lg text-center">{t.actions}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {schedule[editingScheduleType].map((slot) => (
                            <tr key={slot.id} className="hover:bg-slate-50">
                                <td className="p-3 pl-4">
                                    <Input 
                                        value={slot.name} 
                                        onChange={(e) => handleSlotChange(slot.id, 'name', e.target.value)}
                                        className="w-full md:w-40"
                                    />
                                </td>
                                <td className="p-3">
                                    <Select
                                        value={slot.type}
                                        onChange={(e) => handleSlotChange(slot.id, 'type', e.target.value as any)}
                                        className="w-32"
                                    >
                                        <option value="Period">Period</option>
                                        <option value="Break">Break</option>
                                        <option value="Lunch">Lunch</option>
                                    </Select>
                                </td>
                                <td className="p-3">
                                    <Input 
                                        type="time" 
                                        value={slot.startTime}
                                        onChange={(e) => handleSlotChange(slot.id, 'startTime', e.target.value)}
                                        className="w-32"
                                    />
                                </td>
                                <td className="p-3">
                                    <Input 
                                        type="time" 
                                        value={slot.endTime}
                                        onChange={(e) => handleSlotChange(slot.id, 'endTime', e.target.value)}
                                        className="w-32"
                                    />
                                </td>
                                <td className="p-3 text-right">
                                    <button 
                                        onClick={() => handleDeleteSlot(slot.id)}
                                        className="p-2 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                                        title="Delete Slot"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-between border-t border-slate-200 pt-4">
                <Button variant="secondary" onClick={handleAddSlot}>
                    <Plus size={16} /> {t.addSlot}
                </Button>
                <Button onClick={saveSchedule}>{t.saveSchedule}</Button>
            </div>
        </Card>
      )}

      {/* E-PASS DESTINATIONS TAB */}
      {activeTab === 'epass' && (
          <div className="space-y-6">
              {/* Global Settings Card - Only Max Passes Now */}
              <Card>
                  <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2 mb-4">
                      <Settings className="text-slate-500" size={20} /> {t.globalSettings}
                  </h3>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 max-w-md">
                      <label className="block text-xs font-bold text-slate-500 mb-2">{t.maxPasses}</label>
                      <div className="flex gap-2">
                        <Input 
                            type="number" 
                            min="1" 
                            max="20" 
                            value={maxPasses} 
                            onChange={(e) => setMaxPasses(parseInt(e.target.value) || 1)} 
                        />
                        <Button onClick={handleUpdateEPassSettings}>{t.updateLimit}</Button>
                      </div>
                  </div>
              </Card>

              <Card>
                  <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold">{t.destinations}</h2>
                      <Button onClick={() => { setFormData({ colorTheme: 'blue', maxDuration: 10 }); setIsAddingDest(true); }}>
                          <Plus size={16} /> {t.addDestination}
                      </Button>
                  </div>

                  {(isAddingDest || editingDest) && renderDestForm()}

                  <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                          <thead>
                              <tr className="border-b border-slate-200 text-slate-500 text-sm bg-slate-50">
                                  <th className="p-3 rounded-tl-lg text-start">{t.icon}</th>
                                  <th className="p-3 text-start">{t.labelEn}</th>
                                  <th className="p-3 text-start">{t.labelAr}</th>
                                  <th className="p-3 text-start">{t.duration}</th>
                                  <th className="p-3 text-center rounded-tr-lg">{t.actions}</th>
                              </tr>
                          </thead>
                          <tbody>
                              {destinations.map(dest => {
                                  const Icon = (LucideIcons as any)[dest.iconName];
                                  return (
                                    <tr key={dest.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                        <td className="p-3">
                                            <div className={`w-8 h-8 rounded flex items-center justify-center ${COLOR_THEMES.find(c => c.name === dest.colorTheme)?.class}`}>
                                                {Icon && <Icon size={18} />}
                                            </div>
                                        </td>
                                        <td className="p-3 font-medium text-start">{dest.label_en}</td>
                                        <td className="p-3 text-slate-600 text-start">{dest.label_ar}</td>
                                        <td className="p-3 text-start">
                                            <Badge color="gray">{dest.maxDuration}m</Badge>
                                        </td>
                                        <td className="p-3 text-right flex justify-end gap-2">
                                            <button
                                                onClick={() => { setEditingDest(dest); setFormData(dest); }}
                                                className="p-2 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteDest(dest.id)}
                                                className="p-2 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                  )
                              })}
                          </tbody>
                      </table>
                  </div>
              </Card>
          </div>
      )}

      {/* NOTIFICATIONS TAB */}
      {activeTab === 'notifications' && (
          <Card>
              <div className="flex items-center gap-3 mb-6">
                  <div className="bg-blue-50 p-3 rounded-lg text-blue-600">
                      <Bell size={24} />
                  </div>
                  <div>
                      <h2 className="text-xl font-bold text-slate-800">{t.telegramSettings}</h2>
                      <p className="text-slate-500 text-sm">Configure alerting channels for different modules.</p>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Security / E-Pass Alerts */}
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                       <div className="flex items-center gap-2 mb-4">
                           <ShieldAlert className="text-red-500" size={20} />
                           <h3 className="font-bold text-slate-700">{t.securityAlerts}</h3>
                       </div>
                       <p className="text-xs text-slate-500 mb-4">Used for unauthorized exits and security breaches.</p>
                       
                       <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">{t.botToken}</label>
                                <Input 
                                    placeholder="123456:ABC-..." 
                                    value={telegramToken} 
                                    onChange={(e) => setTelegramToken(e.target.value)}
                                    className="bg-white"
                                    type="password"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">{t.chatId}</label>
                                <Input 
                                    placeholder="-100123..." 
                                    value={telegramChatId} 
                                    onChange={(e) => setTelegramChatId(e.target.value)}
                                    className="bg-white"
                                />
                            </div>
                       </div>
                  </div>

                  {/* Reception / Early Leave Alerts */}
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                       <div className="flex items-center gap-2 mb-4">
                           <LogOut className="text-orange-500" size={20} />
                           <h3 className="font-bold text-slate-700">{t.receptionAlerts}</h3>
                       </div>
                       <p className="text-xs text-slate-500 mb-4">Used for notifying parents/admins about Early Leave.</p>
                       
                       <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">{t.botToken}</label>
                                <Input 
                                    placeholder="123456:ABC-..." 
                                    value={elTelegramToken} 
                                    onChange={(e) => setElTelegramToken(e.target.value)}
                                    className="bg-white"
                                    type="password"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">{t.chatId}</label>
                                <Input 
                                    placeholder="-100123..." 
                                    value={elTelegramChatId} 
                                    onChange={(e) => setElTelegramChatId(e.target.value)}
                                    className="bg-white"
                                />
                            </div>
                       </div>
                  </div>

                   {/* Targeted / Watchlist Alerts */}
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                       <div className="flex items-center gap-2 mb-4">
                           <Eye className="text-purple-500" size={20} />
                           <h3 className="font-bold text-slate-700">{t.watchlistAlerts}</h3>
                       </div>
                       <p className="text-xs text-slate-500 mb-4">{t.watchlistDesc}</p>
                       
                       <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">{t.botToken}</label>
                                <Input 
                                    placeholder="123456:ABC-..." 
                                    value={wlTelegramToken} 
                                    onChange={(e) => setWlTelegramToken(e.target.value)}
                                    className="bg-white"
                                    type="password"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">{t.chatId}</label>
                                <Input 
                                    placeholder="-100123..." 
                                    value={wlTelegramChatId} 
                                    onChange={(e) => setWlTelegramChatId(e.target.value)}
                                    className="bg-white"
                                />
                            </div>
                       </div>
                  </div>

                  {/* Notification Rules */}
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                       <div className="flex items-center gap-2 mb-4">
                           <Settings className="text-slate-600" size={20} />
                           <h3 className="font-bold text-slate-700">{t.notificationRules}</h3>
                       </div>
                       <p className="text-xs text-slate-500 mb-4">{t.enableNotificationsFor}</p>

                       <div className="space-y-2">
                           {/* Unauthorized Toggle */}
                           <label className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-blue-300 transition-colors">
                               <span className="text-sm font-bold text-red-600 flex items-center gap-2">
                                   <ShieldAlert size={16} /> {t.unauthorized}
                               </span>
                               <input 
                                   type="checkbox" 
                                   checked={notificationRules['UNAUTHORIZED'] ?? true}
                                   onChange={() => toggleNotificationRule('UNAUTHORIZED')}
                                   className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                               />
                           </label>

                           {/* Destinations Toggles */}
                           {destinations.map(dest => (
                               <label key={dest.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-blue-300 transition-colors">
                                   <span className="text-sm font-medium text-slate-700">
                                       {lang === 'en' ? dest.label_en : dest.label_ar}
                                   </span>
                                   <input 
                                       type="checkbox" 
                                       checked={notificationRules[dest.id] === true}
                                       onChange={() => toggleNotificationRule(dest.id)}
                                       className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                   />
                               </label>
                           ))}
                       </div>
                  </div>
              </div>

              <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
                   <Button onClick={handleUpdateNotificationSettings}>
                       <Check size={18} /> {t.saveCredentials}
                   </Button>
              </div>
          </Card>
      )}

      {/* ACCESS CONTROL TAB */}
      {activeTab === 'access' && (
          <Card>
              <div className="flex items-center gap-3 mb-6">
                  <div className="bg-primary/10 p-3 rounded-lg text-primary">
                      <Shield size={24} />
                  </div>
                  <div>
                      <h2 className="text-xl font-bold text-slate-800">{t.manageRoles}</h2>
                      <p className="text-slate-500 text-sm">Configure what each user role can access in the application.</p>
                  </div>
              </div>

              <div className="flex flex-col md:flex-row gap-6">
                  {/* Role Selection */}
                  <div className="w-full md:w-64 shrink-0 space-y-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase">{t.role}</label>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                          {ROLES_LIST.map(role => (
                              <button
                                  key={role}
                                  onClick={() => setSelectedRoleForAccess(role)}
                                  className={`w-full text-start px-4 py-3 text-sm font-medium transition-colors border-b last:border-0 border-slate-100 flex justify-between items-center ${selectedRoleForAccess === role ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                              >
                                  {role}
                                  {selectedRoleForAccess === role && <Check size={16} />}
                              </button>
                          ))}
                      </div>
                  </div>

                  {/* Permissions Matrix */}
                  <div className="flex-1">
                      <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                          <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-white">
                              <h3 className="font-bold text-slate-700">{t.module} {t.access}</h3>
                              <Badge color="blue">{selectedRoleForAccess}</Badge>
                          </div>
                          <div className="divide-y divide-slate-100">
                              {NAV_ITEMS.map(item => {
                                  const Icon = item.icon;
                                  const isAllowed = rolePermissions[selectedRoleForAccess]?.includes(item.id);
                                  
                                  return (
                                      <div key={item.id} className="px-4 py-3 flex items-center justify-between hover:bg-white transition-colors">
                                          <div className="flex items-center gap-3">
                                              <div className={`p-2 rounded-lg ${isAllowed ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-400'}`}>
                                                  <Icon size={20} />
                                              </div>
                                              <div>
                                                  <p className={`font-medium ${isAllowed ? 'text-slate-800' : 'text-slate-400'}`}>
                                                      {lang === 'en' ? item.label_en : item.label_ar}
                                                  </p>
                                              </div>
                                          </div>
                                          
                                          <label className="relative inline-flex items-center cursor-pointer">
                                              <input 
                                                  type="checkbox" 
                                                  className="sr-only peer" 
                                                  checked={isAllowed || false}
                                                  onChange={() => handleToggleAccess(item.id)}
                                              />
                                              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                          </label>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                      
                      <div className="mt-4 flex gap-2 items-start text-xs text-slate-500 bg-blue-50 p-3 rounded-lg">
                          <ShieldAlert size={16} className="text-blue-500 mt-0.5 shrink-0" />
                          <p>Changes take effect immediately. Users with this role will see the updated navigation menu upon their next login or page refresh.</p>
                      </div>
                  </div>
              </div>
          </Card>
      )}
    </div>
  );
};
