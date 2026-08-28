import React, { useState, useEffect } from "react";
import { QrCode, Database, ScanLine, Clock, Cloud } from "lucide-react";
import { Session, AwsVaultStatus } from "../types";

interface NavbarProps {
  activeTab: "teacher" | "student" | "aws";
  setActiveTab: (tab: "teacher" | "student" | "aws") => void;
  activeSession: Session | null;
  awsStatus: AwsVaultStatus | null;
  onOpenProjector: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeSession,
  awsStatus,
  onOpenProjector,
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
    <header className="sticky top-0 z-40 bg-[#020617]/70 backdrop-blur-xl border-b border-white/10 text-slate-100 shadow-2xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/25 text-white font-bold text-lg ring-1 ring-white/20">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  ClassQR
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 font-semibold border border-indigo-500/30 backdrop-blur-md">
                  Attendance
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-normal hidden sm:block">
                Live QR Time-In/Out • AWS Cloud Database
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1 sm:space-x-1.5 bg-slate-900/40 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md">
            <button
              id="tab-teacher"
              onClick={() => setActiveTab("teacher")}
              className={`flex items-center space-x-2 px-3 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                activeTab === "teacher"
                  ? "bg-indigo-600/90 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-white/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>Teacher Dashboard</span>
            </button>

            <button
              id="tab-student"
              onClick={() => setActiveTab("student")}
              className={`flex items-center space-x-2 px-3 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                activeTab === "student"
                  ? "bg-indigo-600/90 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-white/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              <ScanLine className="w-4 h-4 text-emerald-400" />
              <span>Student Scanner</span>
            </button>

            <button
              id="tab-aws"
              onClick={() => setActiveTab("aws")}
              className={`flex items-center space-x-2 px-3 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
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

          {/* Right Header Status Bar */}
          <div className="hidden lg:flex items-center space-x-2.5 text-xs">
            {/* Live Clock */}
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-white/10 text-slate-300 backdrop-blur-md shadow-inner">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-mono font-semibold">{currentTime}</span>
            </div>

            {/* Active Session Status */}
            {activeSession && (
              <button
                id="btn-nav-projector"
                onClick={onOpenProjector}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/60 transition-all shadow-lg shadow-emerald-950/40"
                title="Open Classroom Projector QR Mode"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-mono font-semibold truncate max-w-[110px]">{activeSession.code}</span>
                <span className="text-[10px] text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.2 rounded-md font-medium">Project</span>
              </button>
            )}

            {/* AWS / LocalStack Record status pill */}
            <div
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border backdrop-blur-md ${
                awsStatus?.mode === "localstack"
                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                  : awsStatus?.isConfigured
                  ? "bg-amber-950/40 border-amber-500/30 text-amber-300"
                  : "bg-slate-900/60 border-white/10 text-slate-300"
              }`}
              title="Database Storage Engine"
            >
              <Cloud className="w-3.5 h-3.5 text-orange-400" />
              <span className="font-medium">
                {awsStatus?.mode === "localstack"
                  ? "LocalStack Active"
                  : awsStatus?.isConfigured
                  ? "AWS Live"
                  : "Local Cloud Vault"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
