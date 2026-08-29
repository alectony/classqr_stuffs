import React, { useState } from "react";
import {
  QrCode,
  Plus,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Download,
  Database,
  Search,
  Filter,
  Trash2,
  Edit2,
  ExternalLink,
  ShieldCheck,
  FileSpreadsheet,
  ChevronDown,
  ArrowRight,
  Maximize2,
  LogOut,
  UserPlus
} from "lucide-react";
import { Session, AttendanceRecord, Student, AttendanceStatus } from "../types";
import { DataService } from "../lib/dataService";

interface TeacherDashboardProps {
  sessions: Session[];
  activeSession: Session | null;
  setActiveSession: (session: Session) => void;
  records: AttendanceRecord[];
  students: Student[];
  onOpenProjector: () => void;
  onRefreshData: () => void;
  onSyncAws: (sessionId: string) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  sessions,
  activeSession,
  setActiveSession,
  records,
  students,
  onOpenProjector,
  onRefreshData,
  onSyncAws,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);

  // New Session Form State
  const [newSubject, setNewSubject] = useState("");
  const [newTeacherName, setNewTeacherName] = useState("Prof. Anthony Bisnar");
  const [newRoom, setNewRoom] = useState("Hall B-204");
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("10:30");
  const [newGracePeriod, setNewGracePeriod] = useState<number>(10);
  const [newDynamicQr, setNewDynamicQr] = useState<boolean>(true);
  const [newExpectedStudents, setNewExpectedStudents] = useState<number>(25);

  // Manual Add Form State
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [customStudentName, setCustomStudentName] = useState("");
  const [customStudentId, setCustomStudentId] = useState("");
  const [customSection, setCustomSection] = useState("CS-4A");
  const [manualAction, setManualAction] = useState<"time_in" | "time_out">("time_in");

  // Filter records for active session
  const currentSessionRecords = activeSession
    ? records.filter((r) => r.sessionId === activeSession.id)
    : records;

  const filteredRecords = currentSessionRecords.filter((rec) => {
    const matchesSearch =
      rec.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.section.toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === "all") return matchesSearch;
    if (statusFilter === "present") return matchesSearch && (rec.status === "present" || rec.status === "completed");
    if (statusFilter === "late") return matchesSearch && rec.status === "late";
    if (statusFilter === "completed") return matchesSearch && rec.timeOut !== null;
    if (statusFilter === "excused") return matchesSearch && rec.status === "excused";
    return matchesSearch;
  });

  // Calculate Metrics
  const totalLogged = currentSessionRecords.length;
  const totalExpected = activeSession?.totalStudentsExpected || 30;
  const presentCount = currentSessionRecords.filter((r) => r.status === "present" || r.status === "completed").length;
  const lateCount = currentSessionRecords.filter((r) => r.status === "late").length;
  const completedCount = currentSessionRecords.filter((r) => r.timeOut !== null).length;
  const attendanceRate = Math.min(100, Math.round((totalLogged / totalExpected) * 100));
  const onTimeRate = totalLogged > 0 ? Math.round((presentCount / totalLogged) * 100) : 100;

  // Handle Session Creation
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim()) return;

    try {
      const created = await DataService.createSession({
        subject: newSubject,
        teacherName: newTeacherName,
        room: newRoom,
        startTime: newStartTime,
        endTime: newEndTime,
        gracePeriodMins: newGracePeriod,
        dynamicQr: newDynamicQr,
        totalStudentsExpected: newExpectedStudents,
        allowedMode: "both",
      });
      setActiveSession(created);
      setIsCreatingSession(false);
      setNewSubject("");
      onRefreshData();
    } catch (err) {
      console.error("Failed to create session:", err);
    }
  };

  // Handle Manual Add Attendee
  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;

    let sId = customStudentId;
    let sName = customStudentName;
    let sSection = customSection;

    if (selectedStudentId) {
      const studentObj = students.find((s) => s.id === selectedStudentId);
      if (studentObj) {
        sId = studentObj.studentId;
        sName = studentObj.name;
        sSection = studentObj.section;
      }
    }

    if (!sId || !sName) return;

    try {
      await DataService.processScan({
        sessionId: activeSession.id,
        sessionCode: activeSession.code,
        studentId: sId,
        studentName: sName,
        section: sSection,
        actionType: manualAction,
        method: "teacher_override",
        notes: "Manual check-in by instructor",
      });
      setIsManualAddOpen(false);
      setSelectedStudentId("");
      setCustomStudentId("");
      setCustomStudentName("");
      onRefreshData();
    } catch (err) {
      console.error("Manual add failed:", err);
    }
  };

  // Handle Record Status Update
  const handleUpdateRecordStatus = async (recordId: string, newStatus: AttendanceStatus, notes?: string) => {
    try {
      await DataService.updateAttendanceStatus(recordId, newStatus, notes);
      setEditingRecord(null);
      onRefreshData();
    } catch (e) {
      console.error("Status update error:", e);
    }
  };

  // Handle Delete Record
  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm("Are you sure you want to remove this attendance record?")) return;
    try {
      await DataService.deleteAttendanceRecord(recordId);
      onRefreshData();
    } catch (e) {
      console.error("Delete error:", e);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (currentSessionRecords.length === 0) {
      alert("No attendance records to export.");
      return;
    }
    const headers = ["Session Code", "Subject", "Student ID", "Student Name", "Section", "Time In", "Time Out", "Duration (mins)", "Status", "Method", "AWS Sync Key"];
    const rows = currentSessionRecords.map((r) => [
      r.sessionCode,
      `"${r.subject}"`,
      r.studentId,
      `"${r.studentName}"`,
      r.section,
      r.timeIn,
      r.timeOut || "N/A",
      r.durationMinutes || "In Progress",
      r.status,
      r.method,
      r.awsRecordKey || "Staged",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ClassQR_${activeSession?.code || "Session"}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Session Control Bar */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-[28px] p-6 shadow-2xl text-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
        
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          {/* Left: Active Session Info */}
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 tracking-wide uppercase">
                Active Classroom
              </span>
              <span className="text-[11px] text-slate-400 font-mono">ID: {activeSession?.id || "N/A"}</span>
            </div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {activeSession ? activeSession.subject : "No Session Selected"}
              </h1>
              {activeSession && (
                <span className="bg-indigo-600/30 text-indigo-200 border border-indigo-400/30 text-xs px-2.5 py-1 rounded-lg font-mono font-bold shadow-inner">
                  {activeSession.code}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Instructor: <span className="text-slate-200 font-semibold">{activeSession?.teacherName || "Unassigned"}</span> • Room:{" "}
              <span className="text-slate-200 font-semibold">{activeSession?.room || "General"}</span> • Window:{" "}
              <span className="text-slate-200 font-mono font-medium">{activeSession?.startTime} - {activeSession?.endTime}</span> (Grace: {activeSession?.gracePeriodMins}m)
            </p>
          </div>

          {/* Right: Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {activeSession && (
              <button
                id="btn-project-qr"
                onClick={onOpenProjector}
                className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/20 text-xs sm:text-sm transition-all transform active:scale-95 ring-1 ring-white/20"
              >
                <QrCode className="w-4 h-4" />
                <span>Project QR Screen</span>
              </button>
            )}

            <button
              id="btn-new-session"
              onClick={() => setIsCreatingSession(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-xs sm:text-sm transition-all shadow-lg shadow-indigo-600/30 ring-1 ring-white/20"
            >
              <Plus className="w-4 h-4" />
              <span>New Class</span>
            </button>

            <button
              id="btn-manual-add"
              onClick={() => setIsManualAddOpen(true)}
              disabled={!activeSession}
              className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-slate-900/80 hover:bg-slate-800 text-slate-200 rounded-xl font-semibold text-xs sm:text-sm transition-all disabled:opacity-40 border border-white/10 backdrop-blur-md shadow-sm"
            >
              <UserPlus className="w-4 h-4 text-indigo-400" />
              <span>Check In Student</span>
            </button>

            <button
              id="btn-sync-aws"
              onClick={() => activeSession && onSyncAws(activeSession.id)}
              disabled={!activeSession}
              className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-slate-900/80 hover:bg-slate-800 text-amber-300 rounded-xl font-semibold text-xs sm:text-sm transition-all disabled:opacity-40 border border-white/10 backdrop-blur-md shadow-sm"
              title="Sync session records to AWS DynamoDB & S3"
            >
              <Database className="w-4 h-4 text-amber-400" />
              <span>Sync AWS</span>
            </button>
          </div>
        </div>

        {/* Switch Session Dropdown if multiple sessions exist */}
        {sessions.length > 1 && (
          <div className="mt-5 pt-4 border-t border-white/5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="font-medium">Switch Session:</span>
            <div className="flex flex-wrap gap-1.5">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSession(s)}
                  className={`px-3 py-1.5 rounded-xl transition-all font-medium ${
                    activeSession?.id === s.id
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-white/20"
                      : "bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-white/5"
                  }`}
                >
                  {s.code} ({s.subject.slice(0, 16)}...)
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Attendance */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl hover:border-white/20 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Attendance Rate</span>
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/20 group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-white font-mono">{totalLogged}</span>
            <span className="text-xs text-slate-400 font-mono">/ {totalExpected} expected</span>
          </div>
          <div className="mt-3 w-full bg-slate-950/80 h-2 rounded-full overflow-hidden p-0.5 border border-white/5">
            <div className="bg-gradient-to-r from-blue-600 to-cyan-400 h-full rounded-full transition-all duration-500" style={{ width: `${attendanceRate}%` }} />
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block font-medium">{attendanceRate}% class turnout</span>
        </div>

        {/* Card 2: On-Time Rate */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl hover:border-white/20 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400">On Time Arrivals</span>
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-emerald-300 font-mono">{presentCount}</span>
            <span className="text-xs text-emerald-400 font-mono font-semibold">({onTimeRate}%)</span>
          </div>
          <div className="mt-3 w-full bg-slate-950/80 h-2 rounded-full overflow-hidden p-0.5 border border-white/5">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-400 h-full rounded-full transition-all duration-500" style={{ width: `${onTimeRate}%` }} />
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block font-medium">Within {activeSession?.gracePeriodMins || 10}m grace period</span>
        </div>

        {/* Card 3: Late Check-ins */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl hover:border-white/20 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400">Tardy / Late</span>
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/20 group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-amber-300 font-mono">{lateCount}</span>
            <span className="text-xs text-slate-400 font-mono">flagged records</span>
          </div>
          <div className="mt-3 w-full bg-slate-950/80 h-2 rounded-full overflow-hidden p-0.5 border border-white/5">
            <div className="bg-gradient-to-r from-amber-600 to-yellow-400 h-full rounded-full transition-all duration-500" style={{ width: `${totalLogged > 0 ? (lateCount / totalLogged) * 100 : 0}%` }} />
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block font-medium">Arrived past grace period</span>
        </div>

        {/* Card 4: Completed Time-Outs */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl hover:border-white/20 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-400">Timed Out & Completed</span>
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/20 group-hover:scale-105 transition-transform">
              <LogOut className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-indigo-300 font-mono">{completedCount}</span>
            <span className="text-xs text-slate-400 font-mono">/ {totalLogged} logged</span>
          </div>
          <div className="mt-3 w-full bg-slate-950/80 h-2 rounded-full overflow-hidden p-0.5 border border-white/5">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-400 h-full rounded-full transition-all duration-500" style={{ width: `${totalLogged > 0 ? (completedCount / totalLogged) * 100 : 0}%` }} />
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block font-medium">Full duration calculated</span>
        </div>
      </div>

      {/* Main Attendance Roster Table Section */}
      <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[28px] shadow-2xl overflow-hidden">
        {/* Table Header / Filter Toolbar */}
        <div className="p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-950/40">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-bold text-white tracking-tight">Real-Time Attendance Roster</h2>
            <span className="px-2.5 py-0.5 text-xs rounded-full bg-slate-800/80 text-slate-300 font-semibold border border-white/5">
              {filteredRecords.length} records
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search input */}
            <div className="relative w-48 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search name, ID, section..."
                className="w-full bg-slate-900/80 border border-white/10 text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-indigo-400/80 focus:ring-1 focus:ring-indigo-400/50 backdrop-blur-md"
              />
            </div>

            {/* Filter Pill Tabs */}
            <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-white/10 text-xs backdrop-blur-md">
              {["all", "present", "late", "completed", "excused"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1 rounded-lg capitalize font-medium transition-all ${
                    statusFilter === tab
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* CSV Export Button */}
            <button
              onClick={handleExportCsv}
              className="flex items-center space-x-1.5 px-3 py-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-white/10 transition-all backdrop-blur-md"
              title="Download CSV attendance sheet"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm text-slate-300">
            <thead>
              <tr className="border-b border-white/10 bg-slate-950/70 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                <th className="py-4 px-5">Student</th>
                <th className="py-4 px-4">ID & Section</th>
                <th className="py-4 px-4">Time In</th>
                <th className="py-4 px-4">Time Out</th>
                <th className="py-4 px-4">Duration</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-4">Verification</th>
                <th className="py-4 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-normal">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((rec) => {
                  const timeInFormatted = new Date(rec.timeIn).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });
                  const timeOutFormatted = rec.timeOut
                    ? new Date(rec.timeOut).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })
                    : "—";

                  return (
                    <tr key={rec.id} className="hover:bg-white/[0.03] transition-colors">
                      {/* Student Name */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs uppercase shadow-sm ring-1 ring-white/20">
                            {rec.studentName.charAt(0)}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-100 block">{rec.studentName}</span>
                            {rec.notes && <span className="text-[10px] text-amber-300/90 italic">{rec.notes}</span>}
                          </div>
                        </div>
                      </td>

                      {/* ID & Section */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-slate-200 font-medium block">{rec.studentId}</span>
                        <span className="text-[11px] text-slate-400">{rec.section}</span>
                      </td>

                      {/* Time In */}
                      <td className="py-3.5 px-4 font-mono text-slate-200 font-medium">
                        {timeInFormatted}
                      </td>

                      {/* Time Out */}
                      <td className="py-3.5 px-4 font-mono font-medium">
                        {rec.timeOut ? (
                          <span className="text-emerald-400">{timeOutFormatted}</span>
                        ) : (
                          <span className="text-slate-500 italic">In Session</span>
                        )}
                      </td>

                      {/* Duration */}
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {rec.durationMinutes ? `${rec.durationMinutes} mins` : "Active"}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {rec.status === "present" && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Present
                          </span>
                        )}
                        {rec.status === "late" && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Late
                          </span>
                        )}
                        {rec.status === "completed" && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            Completed
                          </span>
                        )}
                        {rec.status === "excused" && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            Excused
                          </span>
                        )}
                      </td>

                      {/* Verification / AWS Hash */}
                      <td className="py-3.5 px-4 text-xs">
                        <div className="flex items-center space-x-1.5 text-slate-400" title={`AWS Dynamo Key: ${rec.awsRecordKey || 'Local'}`}>
                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="font-mono text-[10px] text-slate-300 truncate max-w-[100px]">
                            {rec.method === "qr_camera" ? "QR Cam" : rec.method === "manual_code" ? "Manual" : "Override"}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => setEditingRecord(rec)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-100 transition-colors"
                            title="Edit Record Status or Notes"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRecord(rec.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <QrCode className="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-slate-300 text-sm">No attendance records found for this session.</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Project the QR Code screen for students to scan, or use the "Check In Student" button.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Create New Session */}
      {isCreatingSession && (
        <div className="fixed inset-0 z-50 bg-[#020617]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0b0f19] border border-white/15 rounded-[28px] max-w-lg w-full p-6 sm:p-7 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
            
            <h3 className="text-xl font-bold text-white">Create New Classroom Session</h3>
            <p className="text-xs text-slate-400 mt-1">
              Initialize a session with dynamic anti-proxy QR code protection.
            </p>

            <form onSubmit={handleCreateSession} className="mt-5 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Subject / Class Name *</label>
                <input
                  type="text"
                  required
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="e.g. Physics 101 - Thermodynamics"
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Instructor Name</label>
                  <input
                    type="text"
                    value={newTeacherName}
                    onChange={(e) => setNewTeacherName(e.target.value)}
                    className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Room / Location</label>
                  <input
                    type="text"
                    value={newRoom}
                    onChange={(e) => setNewRoom(e.target.value)}
                    className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-2.5 py-2 text-white focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">End Time</label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-2.5 py-2 text-white focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Grace Period</label>
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={newGracePeriod}
                      onChange={(e) => setNewGracePeriod(Number(e.target.value))}
                      className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-2.5 py-2 text-white focus:outline-none focus:border-indigo-400 font-mono"
                    />
                    <span className="text-xs text-slate-400">mins</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Expected Students</label>
                  <input
                    type="number"
                    min={1}
                    value={newExpectedStudents}
                    onChange={(e) => setNewExpectedStudents(Number(e.target.value))}
                    className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-5">
                  <input
                    type="checkbox"
                    id="dynamicQrToggle"
                    checked={newDynamicQr}
                    onChange={(e) => setNewDynamicQr(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-white/20"
                  />
                  <label htmlFor="dynamicQrToggle" className="text-xs text-slate-300 font-semibold cursor-pointer">
                    Dynamic QR (30s rotation)
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsCreatingSession(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30 transition-all ring-1 ring-white/20"
                >
                  Create & Launch QR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Manual Student Check-in */}
      {isManualAddOpen && (
        <div className="fixed inset-0 z-50 bg-[#020617]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0b0f19] border border-white/15 rounded-[28px] max-w-md w-full p-6 sm:p-7 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 relative overflow-hidden">
            <h3 className="text-xl font-bold text-white">Manual Student Check-in</h3>
            <p className="text-xs text-slate-400 mt-1">
              Check in a student manually (for phone battery outage or teacher override).
            </p>

            <form onSubmit={handleManualAdd} className="mt-5 space-y-4 text-sm">
              {/* Select from enrolled roster */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Pick from Enrolled Students</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-400"
                >
                  <option value="">-- Or enter new student details below --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.studentId} • {s.section})
                    </option>
                  ))}
                </select>
              </div>

              {!selectedStudentId && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Student Full Name *</label>
                    <input
                      type="text"
                      required={!selectedStudentId}
                      value={customStudentName}
                      onChange={(e) => setCustomStudentName(e.target.value)}
                      placeholder="e.g. Jordan Miller"
                      className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Student ID *</label>
                      <input
                        type="text"
                        required={!selectedStudentId}
                        value={customStudentId}
                        onChange={(e) => setCustomStudentId(e.target.value)}
                        placeholder="2026-0991"
                        className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-400 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Section</label>
                      <input
                        type="text"
                        value={customSection}
                        onChange={(e) => setCustomSection(e.target.value)}
                        className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Action Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setManualAction("time_in")}
                    className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                      manualAction === "time_in"
                        ? "bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-600/30"
                        : "bg-slate-900/80 border-white/10 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    Time In (Entry)
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualAction("time_out")}
                    className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                      manualAction === "time_out"
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30"
                        : "bg-slate-900/80 border-white/10 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    Time Out (Exit)
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsManualAddOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30 transition-all ring-1 ring-white/20"
                >
                  Confirm Check-in
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Edit Attendance Record */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-[#020617]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0b0f19] border border-white/15 rounded-[28px] max-w-md w-full p-6 sm:p-7 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 relative overflow-hidden">
            <h3 className="text-xl font-bold text-white">Edit Record: {editingRecord.studentName}</h3>
            <p className="text-xs text-slate-400 mt-1">ID: {editingRecord.studentId} • {editingRecord.section}</p>

            <div className="mt-5 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Attendance Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["present", "late", "completed", "excused"] as AttendanceStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleUpdateRecordStatus(editingRecord.id, st, editingRecord.notes)}
                      className={`py-2 rounded-xl capitalize font-semibold text-xs border transition-all ${
                        editingRecord.status === st
                          ? "bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-600/30 ring-1 ring-white/20"
                          : "bg-slate-900/80 border-white/10 text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Instructor Note / Excuse Reason</label>
                <textarea
                  defaultValue={editingRecord.notes || ""}
                  onChange={(e) => (editingRecord.notes = e.target.value)}
                  placeholder="e.g. Excused with medical certificate"
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-indigo-400 h-20"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateRecordStatus(editingRecord.id, editingRecord.status, editingRecord.notes)}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-lg shadow-indigo-600/30 ring-1 ring-white/20"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
