import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Badge, Input, Select, Pagination, Modal } from './ui';
import { store } from '../services/store';
import { Student, AttendanceStatus, Language, TimeSlot, User, CalendarEvent } from '../types';
import { TRANSLATIONS } from '../constants';
import { Clock, Calendar, Filter, Save, Users, X, Trash2, AlertCircle } from 'lucide-react';

interface AttendanceProps {
  lang: Language;
  currentUser: User | null;
}

const STUDENTS_PER_PAGE = 10;

export const Attendance: React.FC<AttendanceProps> = ({ lang, currentUser }) => {
  const t = TRANSLATIONS[lang];
  const [selectedDate, setSelectedDate] = useState<string>(store.getTodayStr());
  
  const [students, setStudents] = useState<Student[]>([]);
  const [marked, setMarked] = useState<Record<string, AttendanceStatus>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [selectedStudentForReason, setSelectedStudentForReason] = useState<string | null>(null);
  const [tempReason, setTempReason] = useState("");
  
  const [selectedGender, setSelectedGender] = useState<string>("");
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [availablePeriods, setAvailablePeriods] = useState<TimeSlot[]>([]);
  const [isWeekend, setIsWeekend] = useState(false);
  const [holidayEvent, setHolidayEvent] = useState<CalendarEvent | null>(null);

  const [bulkActionValue, setBulkActionValue] = useState<string>("");

  const [page, setPage] = useState(1);

  useEffect(() => {
    if (currentUser) {
      setStudents(store.getStudentsForUser(currentUser.id)); 
    }
  }, [currentUser]);

  // FIXED: Use correct option name (skipCache instead of cache)
  useEffect(() => {
    const todayStr = store.getTodayStr();
    const selectedTs = new Date(selectedDate).getTime();
    const sevenDaysAgoTs = new Date(todayStr).getTime() - (7 * 24 * 60 * 60 * 1000);
    
    if (selectedTs < sevenDaysAgoTs) {
      // Fetch old data and cache it so editing works
      store.fetchDataForRange(selectedDate, selectedDate, { types: ['attendance'] });
    }
  }, [selectedDate]);

  useEffect(() => {
    const calendarEvent = store.getCalendarEvent(selectedDate);
    const dateObj = new Date(selectedDate);
    const day = dateObj.getDay();
    const schedule = store.getSchedule();
    let periods: TimeSlot[] = [];
    let isWknd = false;

    if (calendarEvent) {
      setHolidayEvent(calendarEvent);
      setIsWeekend(false);
      periods = [];
    } else if (day === 0 || day === 6) {
      setHolidayEvent(null);
      isWknd = true;
      periods = [];
    } else if (day === 5) {
      setHolidayEvent(null);
      isWknd = false;
      periods = schedule.friday.filter(s => s.type === 'Period');
    } else {
      setHolidayEvent(null);
      isWknd = false;
      periods = schedule.standard.filter(s => s.type === 'Period');
    }

    setIsWeekend(isWknd);
    setAvailablePeriods(periods);

    if (periods.length > 0) {
      const todayStr = store.getTodayStr();
      
      if (selectedDate === todayStr) {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

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
          const nextPeriod = periods.find(p => {
            const [startH, startM] = p.startTime.split(':').map(Number);
            const startTotal = startH * 60 + startM;
            return currentMinutes < startTotal;
          });

          if (nextPeriod) {
            setSelectedPeriod(nextPeriod.id);
          } else {
            setSelectedPeriod(periods[periods.length - 1].id);
          }
        }
      } else {
        setSelectedPeriod(periods[0].id);
      }
    } else {
      setSelectedPeriod("");
    }
  }, [selectedDate, store]);

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
  }, [selectedDate, selectedPeriod, store]);

  useEffect(() => {
    setPage(1);
  }, [selectedGender, selectedGrade, selectedSection, selectedDate, selectedPeriod]);

  const availableGrades = useMemo(() => {
    if (!selectedGender) return [];
    const genderStudents = students.filter(s => s.gender === selectedGender);
    return Array.from(new Set(genderStudents.map(s => s.grade))).sort();
  }, [students, selectedGender]);

  const availableSections = useMemo(() => {
    if (!selectedGender || !selectedGrade) return [];
    const classStudents = students.filter(s => 
      s.gender === selectedGender && s.grade === selectedGrade
    );
    return Array.from(new Set(classStudents.map(s => s.section))).sort();
  }, [students, selectedGender, selectedGrade]);

  const filteredStudents = useMemo(() => {
    if (!selectedGender || !selectedGrade || !selectedSection) return [];

    return students.filter(s => {
      return s.gender === selectedGender && 
             s.grade === selectedGrade && 
             s.section === selectedSection;
    });
  }, [students, selectedGender, selectedGrade, selectedSection]);

  const totalPages = Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE);
  const paginatedStudents = useMemo(() => {
    const start = (page - 1) * STUDENTS_PER_PAGE;
    return filteredStudents.slice(start, start + STUDENTS_PER_PAGE);
  }, [filteredStudents, page]);

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
    if (marked[studentId] === status) {
      const newMarked = { ...marked };
      delete newMarked[studentId];
      setMarked(newMarked);
      
      if (reasons[studentId]) {
        setReasons(prev => {
          const next = { ...prev };
          delete next[studentId];
          return next;
        });
      }
      setUnsavedChanges(true);
      return;
    }

    if (status === AttendanceStatus.ABSENT_EXCUSED) {
      setSelectedStudentForReason(studentId);
      setTempReason(reasons[studentId] || "");
      setShowReasonModal(true);
    } else {
      setMarked(prev => ({ ...prev, [studentId]: status }));
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
      if (!newMarks[s.id]) {
        newMarks[s.id] = bulkActionValue as any;
      }
    });
    setMarked(newMarks);
    setUnsavedChanges(true);
    setBulkActionValue("");
  };

  const handleClearAll = () => {
    if (Object.keys(marked).length === 0) return;
    
    if (window.confirm(t.confirmClear || 'Are you sure you want to clear all marks?')) {
      const newMarked = { ...marked };
      const newReasons = { ...reasons };
      
      filteredStudents.forEach(s => {
        delete newMarked[s.id];
        delete newReasons[s.id];
      });
      
      setMarked(newMarked);
      setReasons(newReasons);
      setUnsavedChanges(true);
    }
  };

  const handleSubmitAttendance = async () => {
    setIsSubmitting(true);
    
    const updates = Object.entries(marked).map(([studentId, status]) => {
      return store.markAttendance({
        studentId,
        date: selectedDate,
        period: selectedPeriod,
        status,
        reason: reasons[studentId]
      });
    });

    const deletions = filteredStudents.filter(s => !marked[s.id]).map(s => {
      return store.deleteAttendance(s.id, selectedDate, selectedPeriod);
    });

    try {
      await Promise.all([...updates, ...deletions]);
      setUnsavedChanges(false);
      alert(t.attendanceSaved || 'Attendance saved successfully!');
    } catch (error) {
      console.error("Failed to save attendance", error);
      alert("Error saving attendance");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentPeriodInfo = availablePeriods.find(p => p.id === selectedPeriod);
  const currentStudent = students.find(s => s.id === selectedStudentForReason);
  
  const allStudentsMarked = filteredStudents.length > 0 && filteredStudents.every(s => marked[s.id]);

  return (
    <div className="space-y-6 pb-24">
      {/* Reason Modal */}
      {showReasonModal && currentStudent && (
        <Modal 
          isOpen={showReasonModal} 
          onClose={() => setShowReasonModal(false)} 
          title={`${t.excused}: ${lang === 'en' ? currentStudent.name_en : currentStudent.name_ar}`}
        >
          <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">{t.enterReason}</label>
          <Input 
              value={tempReason}
              onChange={(e) => setTempReason(e.target.value)}
              placeholder="e.g. Medical Appointment"
              autoFocus
              className="mb-6 h-12"
          />
          <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowReasonModal(false)}>{t.cancel}</Button>
              <Button onClick={handleSaveReason}>{t.saveReason}</Button>
          </div>
        </Modal>
      )}

      {/* Controls Header */}
      <Card className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Date Picker */}
            <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.date}</label>
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
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                    {t.period} {currentPeriodInfo && !isWeekend && !holidayEvent && <span className="text-primary font-normal">({currentPeriodInfo.startTime})</span>}
                </label>
                <Select 
                    value={selectedPeriod} 
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    disabled={isWeekend || !!holidayEvent}
                >
                    {holidayEvent ? (
                        <option>Holiday</option>
                    ) : isWeekend ? (
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
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.gender}</label>
                <Select 
                    value={selectedGender} 
                    onChange={(e) => handleGenderChange(e.target.value)}
                    disabled={!!holidayEvent}
                >
                    <option value="">{t.selectGender}</option>
                    <option value="Male">{t.male}</option>
                    <option value="Female">{t.female}</option>
                </Select>
            </div>

            {/* Grade Selector */}
            <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.grade}</label>
                <Select 
                    value={selectedGrade} 
                    onChange={(e) => handleGradeChange(e.target.value)}
                    disabled={!selectedGender || !!holidayEvent}
                >
                    <option value="">{t.selectGrade}</option>
                    {availableGrades.map(c => (
                        <option key={c} value={c}>{t.grade} {c}</option>
                    ))}
                </Select>
            </div>

            {/* Section Selector */}
            <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.section}</label>
                <Select 
                    value={selectedSection} 
                    onChange={(e) => setSelectedSection(e.target.value)}
                    disabled={!selectedGrade || !!holidayEvent}
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
      {holidayEvent ? (
        <Card className="text-center py-12 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20 border-indigo-200 dark:border-indigo-800 animate-in fade-in">
            <div className="inline-block p-4 bg-white/50 dark:bg-slate-800/50 rounded-full shadow-lg mb-4 backdrop-blur-md">
                <Calendar size={32} className="text-indigo-500 dark:text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">{holidayEvent.name}</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium">{t.noAttendance}</p>
        </Card>
      ) : isWeekend ? (
        <Card className="text-center py-12 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800/50 dark:to-slate-900/30 animate-in fade-in">
            <div className="inline-block p-4 bg-white/50 dark:bg-slate-700/50 rounded-full shadow-lg mb-4 backdrop-blur-md">
                <Clock size={32} className="text-slate-400 dark:text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">{t.weekend}</h3>
            <p className="text-slate-500 dark:text-slate-400">{t.noAttendance}</p>
        </Card>
      ) : !selectedSection ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-[2rem] bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm">
            <div className="inline-block p-4 bg-white/50 dark:bg-slate-800/50 rounded-full shadow-lg mb-4 text-slate-400 backdrop-blur-md">
                <Filter size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">{t.selectClass}</h3>
            <p className="text-slate-500 dark:text-slate-400">{t.selectClassMsg}</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-[2rem]">
            <p className="text-slate-500 dark:text-slate-400 font-medium">{t.noStudentsFound}</p>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in">
          
          {/* Bulk Actions Toolbar */}
          <Card className="!p-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 text-sm font-bold whitespace-nowrap">
                    <Users size={16} /> {t.totalStudents}: {filteredStudents.length}
                </div>
                <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-2 hidden md:block"></div>
                <Badge color="blue" className="text-sm px-3 py-1">
                    {selectedGender === 'Male' ? t.male : t.female} - {selectedGrade} {selectedSection}
                </Badge>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Button 
                    variant="ghost" 
                    onClick={handleClearAll}
                    className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-400 text-sm"
                    title={t.clearAll}
                >
                    <Trash2 size={16} /> {t.clearAll}
                </Button>
                <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden md:block"></div>
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
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="overflow-auto max-h-[600px]">
                <table className="w-full text-left border-collapse relative">
                    <thead className="sticky top-0 z-10 shadow-sm">
                        <tr className="bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-500 dark:text-slate-400 text-sm">
                            <th className="p-3 text-nowrap w-20 text-start">{t.studentNumber}</th>
                            <th className="p-3 text-start">{t.studentName}</th>
                            <th className="p-3 w-24 text-start">{t.section}</th>
                            <th className="p-3 w-32 text-start">{t.status}</th>
                            <th className="p-3 text-center w-auto">{t.actions}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {paginatedStudents.map(student => (
                            <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="p-3 font-mono text-slate-500 dark:text-slate-400 text-sm text-start align-top">{student.studentNumber}</td>
                                <td className="p-3 font-medium text-slate-800 dark:text-slate-100 text-start align-top">
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
                                            <span className="text-[10px] text-slate-500 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-700 max-w-[150px] truncate" title={reasons[student.id]}>
                                                {reasons[student.id]}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-3 align-top">
                                    <div className="flex justify-center gap-1 flex-wrap">
                                        <button 
                                            className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center font-bold text-xs ${marked[student.id] === AttendanceStatus.PRESENT ? 'bg-green-500 text-white shadow-md scale-105' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400'}`}
                                            onClick={() => handleMark(student.id, AttendanceStatus.PRESENT)}
                                            title={t.present}
                                        >
                                            P
                                        </button>
                                        <button 
                                            className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center font-bold text-xs ${marked[student.id] === AttendanceStatus.LATE ? 'bg-yellow-500 text-white shadow-md scale-105' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 hover:text-yellow-600 dark:hover:text-yellow-400'}`}
                                            onClick={() => handleMark(student.id, AttendanceStatus.LATE)}
                                            title={t.late}
                                        >
                                            L
                                        </button>
                                        <button 
                                            className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center font-bold text-xs ${marked[student.id] === AttendanceStatus.EARLY_LEAVE ? 'bg-orange-500 text-white shadow-md scale-105' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-orange-100 dark:hover:bg-orange-900/30 hover:text-orange-600 dark:hover:text-orange-400'}`}
                                            onClick={() => handleMark(student.id, AttendanceStatus.EARLY_LEAVE)}
                                            title={t.earlyLeave}
                                        >
                                            EL
                                        </button>
                                        <button 
                                            className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center font-bold text-xs ${marked[student.id] === AttendanceStatus.ABSENT_EXCUSED ? 'bg-blue-500 text-white shadow-md scale-105' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400'}`}
                                            onClick={() => handleMark(student.id, AttendanceStatus.ABSENT_EXCUSED)}
                                            title={t.excused}
                                        >
                                            EA
                                        </button>
                                        <button 
                                            className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center font-bold text-xs ${marked[student.id] === AttendanceStatus.ABSENT_UNEXCUSED ? 'bg-red-500 text-white shadow-md scale-105' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400'}`}
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
            <Pagination 
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                className="p-4 border-t border-slate-100 dark:border-slate-700"
            />
          </Card>

          {/* Submit Button - Static at bottom */}
          <div className="flex flex-col items-end gap-2 pt-6 border-t border-slate-200 dark:border-slate-700 mt-6">
            {!allStudentsMarked && (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-500/10 dark:bg-amber-900/20 dark:text-amber-400 px-4 py-2 rounded-xl text-sm backdrop-blur-sm border border-amber-500/10">
                    <AlertCircle size={16} />
                    <span>Please mark attendance for all students before submitting.</span>
                </div>
            )}
            <Button 
                onClick={handleSubmitAttendance} 
                disabled={isSubmitting || !allStudentsMarked || !unsavedChanges}
                className={`text-lg px-8 py-3 transition-all rounded-2xl ${
                    !allStudentsMarked ? 'bg-slate-300 dark:bg-slate-600 cursor-not-allowed opacity-70' :
                    unsavedChanges ? 'bg-primary hover:bg-blue-700 animate-breathing-glow' : 
                    'bg-slate-400 hover:bg-slate-50 opacity-90'
                }`}
            >
                <Save size={20} /> {isSubmitting ? 'Saving...' : (unsavedChanges ? t.submitChanges : t.attendanceSaved)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};