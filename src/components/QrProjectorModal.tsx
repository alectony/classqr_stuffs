import React, { useState, useEffect } from "react";
import {
  X,
  Maximize2,
  Minimize2,
  RefreshCw,
  Users,
  ShieldCheck,
  Clock,
  Volume2,
  VolumeX,
  Sparkles,
  CheckCircle2,
  Smartphone,
  QrCode as QrCodeIcon,
  ExternalLink
} from "lucide-react";
import QRCode from "qrcode";
import { Session, AttendanceRecord } from "../types";
import { DataService } from "../lib/dataService";

interface QrProjectorModalProps {
  session: Session | null;
  records: AttendanceRecord[];
  isOpen: boolean;
  onClose: () => void;
}

export const QrProjectorModal: React.FC<QrProjectorModalProps> = ({
  session,
  records,
  isOpen,
  onClose,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [studentAppQrUrl, setStudentAppQrUrl] = useState<string>("");
  const [displayMode, setDisplayMode] = useState<"attendance_qr" | "student_app_qr">("attendance_qr");
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [lastRecordCount, setLastRecordCount] = useState<number>(records.length);
  const [latestAttendee, setLatestAttendee] = useState<string | null>(null);

  // Filter records for this session
  const sessionRecords = records.filter((r) => r.sessionId === session?.id);
  const presentCount = sessionRecords.filter((r) => r.status === "present" || r.status === "completed").length;
  const lateCount = sessionRecords.filter((r) => r.status === "late").length;

  const fetchAndRenderQr = async () => {
    if (!session) return;
    try {
      const data = await DataService.getQrToken(session.id);
      if (data.qrPayload) {
        const url = await QRCode.toDataURL(data.qrPayload, {
          width: 500,
          margin: 2,
          color: {
            dark: "#090d16",
            light: "#ffffff",
          },
          errorCorrectionLevel: "H",
        });
        setQrDataUrl(url);
        const diffMs = Math.max(0, data.expiresAt - Date.now());
        setSecondsRemaining(Math.ceil(diffMs / 1000) || 30);
      }
    } catch (e) {
      console.error("Error generating QR code:", e);
    }
  };

  useEffect(() => {
    if (!isOpen || !session) return;
    fetchAndRenderQr();

    // Also generate Student App URL QR code
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const appUrl = `${origin}${pathname}?app=student`;
    QRCode.toDataURL(appUrl, {
      width: 500,
      margin: 2,
      color: {
        dark: "#090d16",
        light: "#ffffff",
      },
      errorCorrectionLevel: "H",
    }).then(setStudentAppQrUrl).catch(console.error);

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          fetchAndRenderQr();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, session?.id]);

  // Trigger celebration banner when new scan arrives
  useEffect(() => {
    if (sessionRecords.length > lastRecordCount) {
      const newest = sessionRecords[0];
      if (newest) {
        setLatestAttendee(`${newest.studentName} (${newest.status.toUpperCase()})`);
        setTimeout(() => setLatestAttendee(null), 4000);
      }
    }
    setLastRecordCount(sessionRecords.length);
  }, [sessionRecords.length]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (!isOpen || !session) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#020617]/85 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900/60 backdrop-blur-2xl border border-white/15 rounded-[32px] w-full max-w-4xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col text-slate-100 animate-in fade-in zoom-in-95 duration-200 relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Top Control Bar */}
        <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-white/10 bg-slate-950/60">
          <div className="flex items-center space-x-3.5">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 tracking-wide uppercase">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-2" />
              Live Projector Mode
            </span>
            <span className="font-mono text-sm text-indigo-300 font-extrabold bg-indigo-950/60 px-3 py-1 rounded-xl border border-white/10">
              {session.code}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Toggle between Attendance QR vs Student App Link QR */}
            <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setDisplayMode("attendance_qr")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  displayMode === "attendance_qr"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Attendance QR
              </button>
              <button
                onClick={() => setDisplayMode("student_app_qr")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center space-x-1 ${
                  displayMode === "student_app_qr"
                    ? "bg-emerald-600 text-white shadow-md"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Smartphone className="w-3 h-3" />
                <span>Student App Link</span>
              </button>
            </div>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-white/10 transition-colors"
              title={soundEnabled ? "Sound Enabled" : "Sound Muted"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-white/10 transition-colors"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 border border-white/10 transition-colors"
              title="Close Projector"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="p-6 md:p-8 lg:p-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* QR Code Presentation Box */}
          <div className="md:col-span-6 flex flex-col items-center justify-center">
            {displayMode === "attendance_qr" ? (
              <>
                <div className="relative p-5 bg-white rounded-3xl shadow-2xl shadow-indigo-500/20 border-4 border-indigo-500/40">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Classroom QR Code"
                      className="w-64 h-64 sm:w-72 sm:h-72 object-contain rounded-2xl"
                    />
                  ) : (
                    <div className="w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center text-slate-400">
                      <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                    </div>
                  )}

                  {/* Rotating Token Badge */}
                  <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-950 text-slate-200 text-xs font-semibold px-4 py-1.5 rounded-full border border-white/15 shadow-xl flex items-center space-x-2 whitespace-nowrap">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    <span>Anti-Proxy Token: rotates in</span>
                    <span className="font-mono text-indigo-300 font-extrabold">{secondsRemaining}s</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-64 sm:w-72 mt-7 bg-slate-950/80 border border-white/10 h-2 rounded-full overflow-hidden p-0.5">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-indigo-400 h-full rounded-full transition-all duration-1000 ease-linear shadow-sm"
                    style={{ width: `${(secondsRemaining / 30) * 100}%` }}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="relative p-5 bg-white rounded-3xl shadow-2xl shadow-emerald-500/20 border-4 border-emerald-500/40">
                  {studentAppQrUrl ? (
                    <img
                      src={studentAppQrUrl}
                      alt="Student App Link QR"
                      className="w-64 h-64 sm:w-72 sm:h-72 object-contain rounded-2xl"
                    />
                  ) : (
                    <div className="w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center text-slate-400">
                      <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
                    </div>
                  )}

                  <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-emerald-950 text-emerald-200 text-xs font-semibold px-4 py-1.5 rounded-full border border-emerald-500/30 shadow-xl flex items-center space-x-2 whitespace-nowrap">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span>Scan with Phone Camera to Open App</span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 text-center mt-6">
                  Points directly to: <span className="font-mono text-emerald-300 font-semibold">{window.location.origin}/?app=student</span>
                </p>
              </>
            )}
          </div>

          {/* Session Details & Live Ticker */}
          <div className="md:col-span-6 flex flex-col space-y-5">
            <div>
              <span className="text-xs uppercase tracking-wider font-bold text-indigo-400">
                {session.room} • {session.teacherName}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
                {session.subject}
              </h2>
              <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
                {displayMode === "attendance_qr" ? (
                  <>
                    Scan the rotating QR code with your phone camera or Student Scanner app to log your{" "}
                    <span className="text-indigo-300 font-semibold">Time In</span> or{" "}
                    <span className="text-indigo-300 font-semibold">Time Out</span>.
                  </>
                ) : (
                  <>
                    Students who don't have the scanner open can scan this QR code with their default camera app to launch the{" "}
                    <span className="text-emerald-300 font-semibold">Student Scanner Portal</span> on their phone.
                  </>
                )}
              </p>
            </div>

            {/* Live attendee arrival pop-up */}
            {latestAttendee && (
              <div className="p-3.5 bg-emerald-950/80 border border-emerald-500/40 rounded-2xl text-emerald-200 text-sm flex items-center space-x-2.5 animate-bounce shadow-xl backdrop-blur-md">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Just checked in: <strong className="text-white">{latestAttendee}</strong>
                </span>
              </div>
            )}

            {/* Live Attendance Stats Metrics */}
            <div className="grid grid-cols-3 gap-3 bg-slate-950/60 p-4 sm:p-5 rounded-2xl border border-white/10 backdrop-blur-md shadow-inner">
              <div className="text-center">
                <span className="text-xs text-slate-400 block font-medium">Total Logged</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono mt-0.5 block">{sessionRecords.length}</span>
                <span className="text-[10px] text-slate-500 block">/ {session.totalStudentsExpected} expected</span>
              </div>
              <div className="text-center border-x border-white/10">
                <span className="text-xs text-emerald-400 block font-medium">On Time</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-300 font-mono mt-0.5 block">{presentCount}</span>
                <span className="text-[10px] text-slate-500 block">Grace: {session.gracePeriodMins}m</span>
              </div>
              <div className="text-center">
                <span className="text-xs text-amber-400 block font-medium">Late</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-amber-300 font-mono mt-0.5 block">{lateCount}</span>
                <span className="text-[10px] text-slate-500 block">Flagged</span>
              </div>
            </div>

            {/* Instruction Callout */}
            <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-4 text-xs text-slate-300 space-y-2 backdrop-blur-md">
              <div className="flex items-center space-x-2 text-indigo-300 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Teacher Projection Tips:</span>
              </div>
              <ul className="list-disc list-inside space-y-1.5 text-slate-400 pl-1">
                <li>Students can open the scanner on their own phone using the <strong>Student App Link</strong> tab above.</li>
                <li>Dynamic QR automatically refreshes token every 30 seconds to prevent forwarding photos.</li>
                <li>Records are cryptographically hashed and mirrored to LocalStack DynamoDB.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 sm:px-8 py-4 bg-slate-950/80 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <span>LocalStack & AWS Cloud Storage Sync Active</span>
          </div>
          <button
            onClick={fetchAndRenderQr}
            className="flex items-center space-x-1.5 text-indigo-400 hover:text-indigo-300 font-semibold px-3 py-1 rounded-xl bg-slate-900/80 border border-white/5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Force Regenerate Token</span>
          </button>
        </div>
      </div>
    </div>
  );
};
