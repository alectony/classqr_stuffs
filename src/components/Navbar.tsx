import React, { useState, useEffect } from "react";
import {
  QrCode,
  Database,
  ScanLine,
  Clock,
  Cloud,
  Smartphone,
  ExternalLink,
  GraduationCap,
  Sparkles,
  Users
} from "lucide-react";
import { Session, AwsVaultStatus } from "../types";

interface NavbarProps {
  appMode: "teacher" | "student";
  setAppMode: (mode: "teacher" | "student") => void;
  activeTab: "teacher" | "student" | "aws";
  setActiveTab: (tab: "teacher" | "student" | "aws") => void;
  activeSession: Session | null;
  awsStatus: AwsVaultStatus | null;
  onOpenProjector: () => void;
  onOpenStudentShare: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  appMode,
  setAppMode,
  activeTab,
  setActiveTab,
  activeSession,
  awsStatus,
  onOpenProjector,
  onOpenStudentShare,
}) => {
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-[#020617]/80 backdrop-blur-xl border-b border-white/10 text-slate-100 shadow-2xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Portal Identity */}
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg font-bold text-lg ring-1 ring-white/20 transition-all ${
                appMode === "student"
                  ? "bg-gradient-to-tr from-emerald-500 to-teal-600 shadow-emerald-500/25 text-white"
                  : "bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 shadow-indigo-500/25 text-white"
              }`}
            >
              {appMode === "student" ? <ScanLine className="w-5 h-5" /> : <QrCode className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  ClassQR
                </span>
                <span
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border backdrop-blur-md ${
                    appMode === "student"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                  }`}
                >
                  {appMode === "student" ? "Student App" : "Teacher App"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-normal hidden sm:block">
                {appMode === "student"
                  ? "Mobile QR Scanner • Attendance Check-In"
                  : "Live Class Sessions • LocalStack AWS Database"}
              </p>
            </div>
          </div>

          {/* Navigation / Navigation Switcher */}
          {appMode === "teacher" ? (
            <nav className="flex items-center space-x-1 sm:space-x-1.5 bg-slate-900/60 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md">
              <button
                id="tab-teacher"
                onClick={() => setActiveTab("teacher")}
                className={`flex items-center space-x-2 px-3.5 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                  activeTab === "teacher"
                    ? "bg-indigo-600/90 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-white/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <GraduationCap className="w-4 h-4 text-indigo-300" />
                <span>Teacher Dashboard</span>
              </button>

              <button
                id="tab-aws"
                onClick={() => setActiveTab("aws")}
                className={`flex items-center space-x-2 px-3.5 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                  activeTab === "aws"
                    ? "bg-indigo-600/90 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-white/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <Database className="w-4 h-4 text-amber-400" />
                <span className="hidden md:inline">LocalStack / AWS</span>
                <span className="md:hidden">Database</span>
              </button>
            </nav>
          ) : (
            <div className="flex items-center space-x-2 bg-emerald-950/40 px-3.5 py-1.5 rounded-2xl border border-emerald-500/25 text-emerald-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Student Scanner Portal</span>
            </div>
          )}

          {/* Right Header Controls & App Switcher */}
          <div className="flex items-center space-x-2 sm:space-x-3 text-xs">
            {/* Live Clock */}
            <div className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-white/10 text-slate-300 backdrop-blur-md shadow-inner">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-mono font-semibold">{currentTime}</span>
            </div>

            {/* Teacher Specific Controls */}
            {appMode === "teacher" && (
              <>
                {/* Student App Share / QR Button */}
                <button
                  id="btn-nav-share-student"
                  onClick={onOpenStudentShare}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 font-semibold transition-all shadow-md shadow-emerald-950/40"
                  title="Share Student App Link or QR Code for mobile devices"
                >
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Student Mobile QR</span>
                </button>

                {/* Active Session Status */}
                {activeSession && (
                  <button
                    id="btn-nav-projector"
                    onClick={onOpenProjector}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-900/60 transition-all shadow-md shadow-indigo-950/40"
                    title="Open Classroom Projector QR Mode"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    <span className="font-mono font-semibold truncate max-w-[90px]">{activeSession.code}</span>
                    <span className="text-[10px] bg-indigo-500/20 border border-indigo-500/30 px-1.5 py-0.2 rounded-md font-medium">Project</span>
                  </button>
                )}
              </>
            )}

            {/* Portal Switcher Toggle Button */}
            <button
              onClick={() => {
                const nextMode = appMode === "teacher" ? "student" : "teacher";
                setAppMode(nextMode);
                if (nextMode === "student") {
                  setActiveTab("student");
                } else {
                  setActiveTab("teacher");
                }
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-bold transition-all border shadow-lg ${
                appMode === "teacher"
                  ? "bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-white/10"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white border-white/20 shadow-indigo-600/30"
              }`}
              title={appMode === "teacher" ? "Switch to Student Scanner Portal" : "Switch to Teacher Instructor Dashboard"}
            >
              {appMode === "teacher" ? (
                <>
                  <ScanLine className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Go to Student App</span>
                  <span className="sm:hidden">Student</span>
                </>
              ) : (
                <>
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-200" />
                  <span className="hidden sm:inline">Instructor App</span>
                  <span className="sm:hidden">Teacher</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
