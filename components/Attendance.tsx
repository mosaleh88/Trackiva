

import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Badge, Input, Select } from './ui';
import { store } from '../services/store';
import { Student, AttendanceStatus, Language, TimeSlot } from '../types';
import { TRANSLATIONS } from '../constants';
import { Clock, Calendar, Filter, Save, Users, X } from 'lucide-react';

interface AttendanceProps {
  lang: Language;
}

export const Attendance: React.FC<AttendanceProps> = ({ lang }) => {
  const t = TRANSLATIONS[lang];
  const [students, setStudents] = useState<Student[]>([]);
  const [marked, setMarked] = useState<Record<string, AttendanceStatus>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  
  // Modal State
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [selectedStudentForReason, setSelectedStudentForReason] = useState<string | null>(null);
  const [tempReason, setTempReason] = useState("");
  
  // Filters & Settings
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Hierarchical Filters
  const [selectedGender, setSelectedGender] = useState<string>("");
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [availablePeriods, setAvailablePeriods] = useState<TimeSlot[]>([]);
  const [isWeekend, setIsWeekend] = useState(false);

  // Bulk Action State
  const [bulkActionValue, setBulkActionValue] = useState<string>("");

  useEffect(() => {
    setStudents(store.getStudents()); 
  }, []);

  // ... rest of component ...
  // Calculate Available Periods based on Date & Auto-Select Current Period
  useEffect(() => {
    const dateObj = new Date(selectedDate);
    const day = dateObj.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
    const schedule = store.getSchedule();
    let periods: TimeSlot[] = [];
    let isWknd = false;

    if (day === 0 || day === 6) {
        isWknd = true;
        periods = [];
    } else if (day === 5) { // Friday
        isWknd = false;
        periods = schedule.friday.filter(s => s.type === 'Period');
    } else {
        isWknd = false;
        periods = schedule.standard.filter(s => s.type === 'Period');
    }

    setIsWeekend(isWknd);
    setAvailablePeriods(periods);

    // Logic to auto-select period based on current time
    if (periods.length > 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        
        if (selectedDate === todayStr) {
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();

            // 1. Try to find the exact active period
            const currentPeriod = periods.find(p => {
                const [startH, startM] = p.startTime.split(':').map(Number);
                const [endH, endM] = p.endTime.split(':').map(Number);
                const startTotal = startH * 60 + startM;
                const endTotal = endH * 60 + endM;
                return currentMinutes >= startTotal && currentMinutes < endTotal;
            });

            if (currentPeriod) {
                setSelectedPeriod(currentPeriod.id);
            } else {
                // 2. If not inside a period (e.g. Break/Lunch), find the NEXT upcoming period
                const nextPeriod = periods.find(p => {
                    const [startH, startM] = p.startTime.split(':').map(Number);
                    const startTotal = startH * 60 + startM;
                    return currentMinutes < startTotal;
                });

                if (nextPeriod) {
                    setSelectedPeriod(nextPeriod.id);
                } else {
                    // 3. If day is over (after last period), default to the last period (for review)
                    setSelectedPeriod(periods[periods.length - 1].id);
                }
            }
        } else {
             // If looking at a past/future date, default to the first period (P1)
             setSelectedPeriod(periods[0].id);
        }
    } else {
        setSelectedPeriod("");
    }
  }, [selectedDate]);

  // Load existing attendance from store
  useEffect(() => {
    if (!selectedPeriod) return;

    const existing = store.getAttendance(selectedDate, selectedPeriod);
    const map: Record<string, AttendanceStatus> = {};
    const reasonMap: Record<string, string> = {};

    existing.forEach(r => {
        map[r.studentId] = r.status;
        if (r.reason) reasonMap[r.studentId] = r.reason;
    });
    setMarked(map);
    setReasons(reasonMap);
    setUnsavedChanges(false);
  }, [selectedDate, selectedPeriod]); 

  // --- Derived Data for Hierarchical Dropdowns ---
  
  // 1. Available Grades depend on Gender
  const availableGrades = useMemo(() => {
    if (!selectedGender) return [];
    const genderStudents = students.filter(s => s.gender === selectedGender);
    return Array.from(new Set(genderStudents.map(s => s.grade))).sort();
  }, [students, selectedGender]);

  // 2. Available Sections depend on Gender AND Grade
  const availableSections = useMemo(() => {
    if (!selectedGender || !selectedGrade) return [];
    const classStudents = students.filter(s => 
        s.gender === selectedGender && s.grade === selectedGrade
    );
    return Array.from(new Set(classStudents.map(s => s.section))).sort();
  }, [students, selectedGender, selectedGrade]);

  // 3. Filtered Students (Only show if Section is selected)
  const filteredStudents = useMemo(() => {
    if (!selectedGender || !selectedGrade || !selectedSection) return [];

    return students.filter(s => {
        return s.gender === selectedGender && 
               s.grade === selectedGrade && 
               s.section === selectedSection;
    });
  }, [students, selectedGender, selectedGrade, selectedSection]);

  // --- Handlers ---

  const handleGenderChange = (val: string) => {
      setSelectedGender(val);
      setSelectedGrade("");
      setSelectedSection("");
  };

  const handleGradeChange = (val: string) => {
      setSelectedGrade(val);
      setSelectedSection("");
  };

  const handleMark = (studentId: string, status: AttendanceStatus) => {
    if (status === AttendanceStatus.ABSENT_EXCUSED) {
        setSelectedStudentForReason(studentId);
        setTempReason(reasons[studentId] || "");
        setShowReasonModal(true);
    } else {
        setMarked(prev => ({ ...prev, [studentId]: status }));
        // Clear reason if status changes to something else
        setReasons(prev => {
            const next = { ...prev };
            delete next[studentId];
            return next;
        });
        setUnsavedChanges(true);
    }
  };
  
  const handleSaveReason = () => {
      if (selectedStudentForReason) {
          setMarked(prev => ({ ...prev, [selectedStudentForReason]: AttendanceStatus.ABSENT_EXCUSED }));
          if (tempReason.trim()) {
            setReasons(prev => ({ ...prev, [selectedStudentForReason]: tempReason }));
          } else {
             setReasons(prev => {
                const next = { ...prev };
                delete next[selectedStudentForReason];
                return next;
             });
          }
          setUnsavedChanges(true);
      }
      setShowReasonModal(false);
      setSelectedStudentForReason(null);
      setTempReason("");
  };

  const handleBulkFill = () => {
    if (!bulkActionValue) return;
    
    const newMarks = { ...marked };
    filteredStudents.forEach(s => {
        if (!newMarks[s.id]) { // Only fill blank entries
            newMarks[s.id] = bulkActionValue as AttendanceStatus;
        }
    });
    setMarked(newMarks);
    setUnsavedChanges(true);
    setBulkActionValue(""); // Reset dropdown
  };

  const handleSubmitAttendance = () => {
    // 1. Save all positive marks (covers all sections modified)
    Object.entries(marked).forEach(([studentId, status]) => {
        store.markAttendance({
            studentId,
            date: selectedDate,
            period: selectedPeriod,
            status,
            reason: reasons[studentId]
        });
        
        // Trigger check for Absent status to send Alert
        if (status === AttendanceStatus.ABSENT_UNEXCUSED) {
            store.checkAttendanceAlert(studentId);
        }
    });

    // 2. Handle deletions (Unmarking) for visible students
    filteredStudents.forEach(s => {
        if (!marked[s.id]) {
            store.deleteAttendance(s.id, selectedDate, selectedPeriod);
        }
    });
    
    setUnsavedChanges(false);
    alert(t.attendanceSaved);
  };

  const currentPeriodInfo = availablePeriods.find(p => p.id === selectedPeriod);
  const currentStudent = students.find(s => s.id === selectedStudentForReason);

  return (
    <div className="space-y-6">
      {/* Reason Modal */}
      {showReasonModal && currentStudent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in zoom-in">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800">{t.excused}: {lang === 'en' ? currentStudent.name_en : currentStudent.name_ar}</h3>
                    <button onClick={() => setShowReasonModal(false)} className="p-1 hover:bg-slate-100 rounded-full">
                        <X size={20} />
                    </button>
                </div>
                
                <label className="block text-sm font-bold text-slate-500 mb-2">{t.enterReason}</label>
                <Input 
                    value={tempReason}
                    onChange={(e) => setTempReason(e.target.value)}
                    placeholder="e.g. Medical Appointment"
                    autoFocus
                    className="mb-6"
                />

                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setShowReasonModal(false)}>{t.cancel}</Button>
                    <Button onClick={handleSaveReason}>{t.saveReason}</Button>
                </div>
            </div>
        </div>
      )}

      {/* Controls Header */}
      <Card className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Date Picker */}
            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{t.date}</label>
                <div className="relative">
                    <Input 
                        type="date" 
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className={`${lang === 'ar' ? 'pr-9' : 'pl-9'}`}
                    />
                    <Calendar className={`absolute ${lang === 'ar' ? 'right-3' : 'left-3'} top-2.5 text-slate-400`} size={16} />
                </div>
            </div>

             {/* Period Selector */}
             <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                    {t.period} {currentPeriodInfo && !isWeekend && <span className="text-primary font-normal">({currentPeriodInfo.startTime})</span>}
                </label>
                <Select 
                    value={selectedPeriod} 
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    disabled={isWeekend}
                >
                    {isWeekend ? (
                        <option>{t.weekend}</option>
                    ) : (
                        availablePeriods.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.startTime})</option>
                        ))
                    )}
                </Select>
            </div>

            {/* Gender Selector */}
            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{t.gender}</label>
                <Select 
                    value={selectedGender} 
                    onChange={(e) => handleGenderChange(e.target.value)}
                >
                    <option value="">{t.selectGender}</option>
                    <option value="Male">{t.male}</option>
                    <option value="Female">{t.female}</option>
                </Select>
            </div>

            {/* Grade Selector */}
            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{t.grade}</label>
                <Select 
                    value={selectedGrade} 
                    onChange={(e) => handleGradeChange(e.target.value)}
                    disabled={!selectedGender}
                >
                    <option value="">{t.selectGrade}</option>
                    {availableGrades.map(c => (
                        <option key={c} value={c}>{t.grade} {c}</option>
                    ))}
                </Select>
            </div>

            {/* Section Selector */}
            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{t.section}</label>
                <Select 
                    value={selectedSection} 
                    onChange={(e) => setSelectedSection(e.target.value)}
                    disabled={!selectedGrade}
                >
                    <option value="">{t.selectSection}</option>
                    {availableSections.map(s => (
                        <option key={s} value={s}>{t.section} {s}</option>
                    ))}
                </Select>
            </div>
        </div>
      </Card>

      {/* Attendance Area */}
      {isWeekend ? (
        <div className="text-center py-12 bg-slate-100 rounded-xl border border-slate-200">
            <div className="inline-block p-3 bg-white rounded-full shadow-sm mb-3">
                <Clock size={32} className="text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-700">{t.weekend}</h3>
            <p className="text-slate-500">{t.noAttendance}</p>
        </div>
      ) : !selectedSection ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
            <div className="inline-block p-3 bg-white rounded-full shadow-sm mb-3 text-slate-400">
                <Filter size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-700">{t.selectClass}</h3>
            <p className="text-slate-500">{t.selectClassMsg}</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-300 rounded-xl">
            <p className="text-slate-500 font-medium">{t.noStudentsFound}</p>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in">
          
          {/* Bulk Actions Toolbar */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center sticky top-0 z-10">
            <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 text-slate-600 text-sm font-bold whitespace-nowrap">
                    <Users size={16} /> {t.totalStudents}: {filteredStudents.length}
                </div>
                <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block"></div>
                <Badge color="blue" className="text-sm px-3 py-1">
                    {selectedGender === 'Male' ? t.male : t.female} - {selectedGrade} {selectedSection}
                </Badge>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-48">
                    <Select 
                        value={bulkActionValue}
                        onChange={(e) => setBulkActionValue(e.target.value)}
                    >
                        <option value="">{t.markAllAs}</option>
                        <option value={AttendanceStatus.PRESENT}>{t.present} (P)</option>
                        <option value={AttendanceStatus.LATE}>{t.late} (L)</option>
                        <option value={AttendanceStatus.EARLY_LEAVE}>{t.earlyLeave} (EL)</option>
                        <option value={AttendanceStatus.ABSENT_EXCUSED}>{t.excused} (EA)</option>
                        <option value={AttendanceStatus.ABSENT_UNEXCUSED}>{t.absent} (A)</option>
                    </Select>
                </div>
                <Button onClick={handleBulkFill} disabled={!bulkActionValue} variant="secondary">
                    {t.apply}
                </Button>
            </div>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left border-collapse relative">
                    <thead className="sticky top-0 z-0 shadow-sm">
                        <tr className="bg-slate-50 text-slate-500 text-sm">
                            <th className="p-3 text-nowrap w-20 text-start">{t.studentNumber}</th>
                            <th className="p-3 text-start">{t.studentName}</th>
                            <th className="p-3 w-24 text-start">{t.section}</th>
                            <th className="p-3 w-32 text-start">{t.status}</th>
                            <th className="p-3 text-center w-auto">{t.actions}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredStudents.map(student => (
                            <tr key={student.id} className="hover:bg-slate-50 transition-colors bg-white">
                                <td className="p-3 font-mono text-slate-500 text-sm text-start align-top">{student.studentNumber}</td>
                                <td className="p-3 font-medium text-start align-top">
                                    <div>{lang === 'en' ? student.name_en : student.name_ar}</div>
                                </td>
                                <td className="p-3 text-start align-top">
                                    <Badge color="gray">{student.section}</Badge>
                                </td>
                                <td className="p-3 text-start align-top">
                                    <div className="flex flex-col items-start gap-1">
                                        {marked[student.id] ? (
                                            <Badge color={
                                                marked[student.id] === AttendanceStatus.PRESENT ? 'green' :
                                                marked[student.id] === AttendanceStatus.ABSENT_UNEXCUSED ? 'red' : 
                                                marked[student.id] === AttendanceStatus.ABSENT_EXCUSED ? 'blue' :
                                                marked[student.id] === AttendanceStatus.LATE ? 'yellow' : 
                                                marked[student.id] === AttendanceStatus.EARLY_LEAVE ? 'yellow' : 'gray'
                                            }>
                                                {marked[student.id]}
                                            </Badge>
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">--</span>
                                        )}
                                        {marked[student.id] === AttendanceStatus.ABSENT_EXCUSED && reasons[student.id] && (
                                            <span className="text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 max-w-[150px] truncate" title={reasons[student.id]}>
                                                {reasons[student.id]}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-3 align-top">
                                    <div className="flex justify-center gap-1 flex-wrap">
                                        <button 
                                            className={`w-8 h-8 rounded-md transition-all flex items-center justify-center font-bold text-xs ${marked[student.id] === AttendanceStatus.PRESENT ? 'bg-green-600 text-white shadow-md scale-105' : 'bg-slate-100 text-slate-500 hover:bg-green-100 hover:text-green-600'}`}
                                            onClick={() => handleMark(student.id, AttendanceStatus.PRESENT)}
                                            title={t.present}
                                        >
                                            P
                                        </button>
                                        <button 
                                            className={`w-8 h-8 rounded-md transition-all flex items-center justify-center font-bold text-xs ${marked[student.id] === AttendanceStatus.LATE ? 'bg-yellow-500 text-white shadow-md scale-105' : 'bg-slate-100 text-slate-500 hover:bg-yellow-100 hover:text-yellow-600'}`}
                                            onClick={() => handleMark(student.id, AttendanceStatus.LATE)}
                                            title={t.late}
                                        >
                                            L
                                        </button>
                                        <button 
                                            className={`w-8 h-8 rounded-md transition-all flex items-center justify-center font-bold text-xs ${marked[student.id] === AttendanceStatus.EARLY_LEAVE ? 'bg-orange-500 text-white shadow-md scale-105' : 'bg-slate-100 text-slate-500 hover:bg-orange-100 hover:text-orange-600'}`}
                                            onClick={() => handleMark(student.id, AttendanceStatus.EARLY_LEAVE)}
                                            title={t.earlyLeave}
                                        >
                                            EL
                                        </button>
                                        <button 
                                            className={`w-8 h-8 rounded-md transition-all flex items-center justify-center font-bold text-xs ${marked[student.id] === AttendanceStatus.ABSENT_EXCUSED ? 'bg-blue-500 text-white shadow-md scale-105' : 'bg-slate-100 text-slate-500 hover:bg-blue-100 hover:text-blue-600'}`}
                                            onClick={() => handleMark(student.id, AttendanceStatus.ABSENT_EXCUSED)}
                                            title={t.excused}
                                        >
                                            EA
                                        </button>
                                        <button 
                                            className={`w-8 h-8 rounded-md transition-all flex items-center justify-center font-bold text-xs ${marked[student.id] === AttendanceStatus.ABSENT_UNEXCUSED ? 'bg-red-600 text-white shadow-md scale-105' : 'bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600'}`}
                                            onClick={() => handleMark(student.id, AttendanceStatus.ABSENT_UNEXCUSED)}
                                            title={t.absent}
                                        >
                                            A
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end sticky bottom-4 z-20">
            <Button 
                onClick={handleSubmitAttendance} 
                className={`shadow-xl text-lg px-8 py-3 transition-all ${unsavedChanges ? 'bg-primary hover:bg-blue-700 translate-y-0' : 'bg-slate-400 hover:bg-slate-500 translate-y-0 opacity-90'}`}
            >
                <Save size={20} /> {unsavedChanges ? t.submitChanges : t.attendanceSaved}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
