import React, { useState, useEffect } from "react";
import { Navbar } from "./components/Navbar";
import { TeacherDashboard } from "./components/TeacherDashboard";
import { StudentScanner } from "./components/StudentScanner";
import { AwsRecordVault } from "./components/AwsRecordVault";
import { QrProjectorModal } from "./components/QrProjectorModal";
import { StudentShareModal } from "./components/StudentShareModal";
import { Session, AttendanceRecord, Student, AwsVaultStatus } from "./types";
import { DataService } from "./lib/dataService";
import { RefreshCw, ExternalLink, ShieldCheck, Smartphone, GraduationCap, ArrowRight } from "lucide-react";

export function App() {
  // Detect initial mode from URL (e.g. ?app=student, ?role=student, ?portal=student)
  const getInitialAppMode = (): "teacher" | "student" => {
    try {
      const params = new URLSearchParams(window.location.search);
      const app = params.get("app") || params.get("role") || params.get("portal");
      if (app === "student") return "student";
      return "teacher";
    } catch {
      return "teacher";
    }
  };

  const [appMode, setAppMode] = useState<"teacher" | "student">(getInitialAppMode());
  const [activeTab, setActiveTab] = useState<"teacher" | "student" | "aws">(
    getInitialAppMode() === "student" ? "student" : "teacher"
  );

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [awsStatus, setAwsStatus] = useState<AwsVaultStatus | null>(null);
  const [isProjectorOpen, setIsProjectorOpen] = useState<boolean>(false);
  const [isStudentShareOpen, setIsStudentShareOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sync mode changes to URL without reloading page
  const handleSetAppMode = (mode: "teacher" | "student") => {
    setAppMode(mode);
    if (mode === "student") {
      setActiveTab("student");
    } else {
      setActiveTab("teacher");
    }

    try {
      const url = new URL(window.location.href);
      url.searchParams.set("app", mode);
      window.history.pushState({}, "", url.toString());
    } catch (e) {
      console.error("Failed to update URL history:", e);
    }
  };

  // Fetch all initial data using DataService
  const loadData = async () => {
    try {
      const [sessData, recData, stuData, awsData] = await Promise.all([
        DataService.getSessions(),
        DataService.getAttendance(),
        DataService.getStudents(),
        DataService.getAwsStatus(),
      ]);

      setSessions(sessData || []);
      setRecords(recData || []);
      setStudents(stuData || []);
      setAwsStatus(awsData || null);

      // Set active session default if not selected
      if (!activeSession && sessData && sessData.length > 0) {
        setActiveSession(sessData[0]);
      } else if (activeSession && sessData) {
        const updated = sessData.find((s: Session) => s.id === activeSession.id);
        if (updated) setActiveSession(updated);
      }
    } catch (e) {
      console.error("Failed to load application state:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Auto-refresh roster in background every 6 seconds for real-time check-in feel
    const poll = setInterval(() => {
      loadData();
    }, 6000);

    return () => clearInterval(poll);
  }, []);

  const handleSyncAws = async (sessionId: string) => {
    try {
      await DataService.syncSessionToAws(sessionId);
      loadData();
    } catch (e) {
      console.error("Sync error:", e);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200 relative overflow-x-hidden">
      {/* Immersive ambient background gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />
      </div>

      {/* Top Navigation Bar */}
      <Navbar
        appMode={appMode}
        setAppMode={handleSetAppMode}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeSession={activeSession}
        awsStatus={awsStatus}
        onOpenProjector={() => setIsProjectorOpen(true)}
        onOpenStudentShare={() => setIsStudentShareOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 relative z-10">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-28 space-y-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <span className="text-slate-400 text-sm font-medium tracking-wide">
              Initializing ClassQR Environment & Database...
            </span>
          </div>
        ) : (
          <>
            {/* Student App Portal View */}
            {appMode === "student" && (
              <div className="space-y-4">
                <StudentScanner
                  sessions={sessions}
                  students={students}
                  records={records}
                  onRefreshData={loadData}
                />
              </div>
            )}

            {/* Teacher App Portal Views */}
            {appMode === "teacher" && (
              <>
                {activeTab === "teacher" && (
                  <TeacherDashboard
                    sessions={sessions}
                    activeSession={activeSession}
                    setActiveSession={setActiveSession}
                    records={records}
                    students={students}
                    onOpenProjector={() => setIsProjectorOpen(true)}
                    onRefreshData={loadData}
                    onSyncAws={handleSyncAws}
                  />
                )}

                {activeTab === "aws" && (
                  <AwsRecordVault
                    awsStatus={awsStatus}
                    activeSession={activeSession}
                    onRefreshData={loadData}
                  />
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Classroom Projector Modal */}
      <QrProjectorModal
        session={activeSession}
        records={records}
        isOpen={isProjectorOpen}
        onClose={() => setIsProjectorOpen(false)}
      />

      {/* Share Student Mobile App Modal */}
      <StudentShareModal
        isOpen={isStudentShareOpen}
        onClose={() => setIsStudentShareOpen(false)}
      />
    </div>
  );
}

export default App;
