import React, { useState, useEffect, useRef } from "react";
import {
  Camera,
  Upload,
  Keyboard,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  History,
  RotateCcw,
  RefreshCw,
  LogOut,
  LogIn,
  FileCheck,
  QrCode
} from "lucide-react";
import jsQR from "jsqr";
import confetti from "canvas-confetti";
import { Session, AttendanceRecord, Student } from "../types";
import { DataService } from "../lib/dataService";

interface StudentScannerProps {
  sessions: Session[];
  students: Student[];
  records: AttendanceRecord[];
  onRefreshData: () => void;
}

export const StudentScanner: React.FC<StudentScannerProps> = ({
  sessions,
  students,
  records,
  onRefreshData,
}) => {
  // Mode: "camera" | "upload" | "manual" | "history"
  const [scanMode, setScanMode] = useState<"camera" | "upload" | "manual" | "history">("camera");

  // Student Identity Form
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [customName, setCustomName] = useState<string>("");
  const [customStudentId, setCustomStudentId] = useState<string>("");
  const [customSection, setCustomSection] = useState<string>("CS-4A");

  // Selected Action: "time_in" or "time_out"
  const [actionType, setActionType] = useState<"time_in" | "time_out">("time_in");

  // Manual code input
  const [manualCode, setManualCode] = useState<string>("");

  // Camera & Stream states
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Scan status & Result Receipt
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [scanSuccessResult, setScanSuccessResult] = useState<{
    record: AttendanceRecord;
    message: string;
    action: string;
  } | null>(null);
  const [scanErrorMessage, setScanErrorMessage] = useState<string | null>(null);

  // Load saved student identity from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("classqr_saved_student");
      if (saved) {
        const parsed = JSON.parse(saved);
        setCustomName(parsed.name || "");
        setCustomStudentId(parsed.studentId || "");
        setCustomSection(parsed.section || "CS-4A");
      } else if (students.length > 0) {
        setSelectedStudent(students[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  }, [students]);

  // Handle student profile selection
  const handleStudentSelectChange = (val: string) => {
    setSelectedStudent(val);
    if (val) {
      const s = students.find((item) => item.id === val);
      if (s) {
        setCustomName(s.name);
        setCustomStudentId(s.studentId);
        setCustomSection(s.section);
      }
    }
  };

  // Save student identity
  const saveIdentity = () => {
    if (customName && customStudentId) {
      localStorage.setItem(
        "classqr_saved_student",
        JSON.stringify({ name: customName, studentId: customStudentId, section: customSection })
      );
    }
  };

  // Start Camera Stream
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: cameraFacing, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          await videoRef.current.play();
          setCameraActive(true);
          requestAnimationFrame(scanVideoFrame);
        }
      } else {
        setCameraError("Camera access is not supported by your browser. Please use the Upload QR or Manual Code option.");
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError(
        err.name === "NotAllowedError"
          ? "Camera permission was denied. Please allow camera access in your browser or use QR Upload/Manual Code."
          : `Camera error: ${err.message}`
      );
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (scanMode === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [scanMode, cameraFacing]);

  // Frame scanner loop
  const scanVideoFrame = () => {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animationFrameId.current = requestAnimationFrame(scanVideoFrame);
      return;
    }

    const canvas = canvasRef.current;
    if (canvas && videoRef.current) {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code && code.data && !isProcessing) {
          handleScannedData(code.data, "qr_camera");
          return; // Stop scan loop until response
        }
      }
    }

    animationFrameId.current = requestAnimationFrame(scanVideoFrame);
  };

  // Image Upload Scanner
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            handleScannedData(code.data, "qr_upload");
          } else {
            setScanErrorMessage("Could not detect a valid ClassQR code in this image. Try another photo or enter the code manually.");
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Core Processing of Scanned QR Payload
  const handleScannedData = async (payloadString: string, method: "qr_camera" | "qr_upload" | "manual_code") => {
    setIsProcessing(true);
    setScanErrorMessage(null);
    saveIdentity();

    let studentId = customStudentId.trim();
    let studentName = customName.trim();
    let section = customSection.trim();

    if (!studentId || !studentName) {
      setScanErrorMessage("Please specify your Student Name and Student ID in the identity box before scanning.");
      setIsProcessing(false);
      if (scanMode === "camera") {
        setTimeout(() => requestAnimationFrame(scanVideoFrame), 1500);
      }
      return;
    }

    let parsedPayload: any = null;
    try {
      parsedPayload = JSON.parse(payloadString);
    } catch {
      // If not JSON, check if it's a plain session code string
      parsedPayload = { sessionCode: payloadString.trim() };
    }

    const sessionId = parsedPayload.sessionId;
    const sessionCode = parsedPayload.sessionCode || payloadString.trim();
    const token = parsedPayload.token;

    try {
      const data = await DataService.processScan({
        sessionId,
        sessionCode,
        token,
        studentId,
        studentName,
        section,
        actionType,
        method,
      });

      setScanSuccessResult({
        record: data.record,
        message: data.message,
        action: data.action,
      });

      // Trigger confetti celebration
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#10b981", "#6366f1", "#f59e0b", "#3b82f6"],
        });
      } catch (e) {
        // ignore if confetti fails
      }

      onRefreshData();
    } catch (err: any) {
      setScanErrorMessage(err.message || "Failed to log attendance record.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Manual Code Submit
  const handleManualCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleScannedData(manualCode.trim(), "manual_code");
  };

  // Student's personal history
  const studentHistory = records.filter(
    (r) => r.studentId.toLowerCase() === customStudentId.trim().toLowerCase()
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Student Profile Header & Mode Switcher */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-[28px] p-6 shadow-2xl text-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 tracking-wide uppercase">
              Student Terminal
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1.5">
              Class Attendance Scanner
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Scan the teacher's projected QR code for instant Time In / Time Out verification.
            </p>
          </div>

          {/* Action Choice: Time In vs Time Out */}
          <div className="bg-slate-950/80 p-1.5 rounded-2xl border border-white/10 flex items-center space-x-1.5 self-start sm:self-auto backdrop-blur-md shadow-inner">
            <button
              id="btn-action-time-in"
              onClick={() => {
                setActionType("time_in");
                setScanSuccessResult(null);
              }}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                actionType === "time_in"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-1 ring-white/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Time In (Entry)</span>
            </button>
            <button
              id="btn-action-time-out"
              onClick={() => {
                setActionType("time_out");
                setScanSuccessResult(null);
              }}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                actionType === "time_out"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-white/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Time Out (Exit)</span>
            </button>
          </div>
        </div>

        {/* Student Identity Box */}
        <div className="mt-5 pt-5 border-t border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Select or Type Student Name
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Alex Rivera"
              className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/50 font-medium backdrop-blur-md"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Student ID Number *
            </label>
            <input
              type="text"
              value={customStudentId}
              onChange={(e) => setCustomStudentId(e.target.value)}
              placeholder="e.g. 2026-0012"
              className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/50 font-mono font-semibold backdrop-blur-md"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Section / Class Group
            </label>
            <input
              type="text"
              value={customSection}
              onChange={(e) => setCustomSection(e.target.value)}
              placeholder="e.g. CS-4A"
              className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/50 font-medium backdrop-blur-md"
            />
          </div>
        </div>
      </div>

      {/* Success Digital Attendance Pass Receipt Card */}
      {scanSuccessResult && (
        <div className="bg-gradient-to-br from-slate-900/90 via-indigo-950/40 to-slate-900/90 border border-emerald-500/50 rounded-[28px] p-6 sm:p-7 shadow-2xl shadow-emerald-500/10 text-slate-100 animate-in fade-in zoom-in-95 backdrop-blur-2xl relative overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center space-x-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider block">
                  Attendance Verified & Recorded
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold text-white">Digital Attendance Pass</h3>
              </div>
            </div>
            <button
              onClick={() => setScanSuccessResult(null)}
              className="text-xs px-3.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all border border-white/10 font-semibold shadow-sm"
            >
              Scan Another
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-xs">
            <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-white/5 backdrop-blur-md">
              <span className="text-slate-400 block mb-1 font-medium">Student</span>
              <span className="font-bold text-white text-sm block">{scanSuccessResult.record.studentName}</span>
              <span className="text-slate-400 font-mono text-[11px]">{scanSuccessResult.record.studentId}</span>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-white/5 backdrop-blur-md">
              <span className="text-slate-400 block mb-1 font-medium">Subject & Code</span>
              <span className="font-bold text-white text-sm block truncate">{scanSuccessResult.record.subject}</span>
              <span className="text-indigo-400 font-mono font-bold">{scanSuccessResult.record.sessionCode}</span>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-white/5 backdrop-blur-md">
              <span className="text-slate-400 block mb-1 font-medium">Time In</span>
              <span className="font-bold text-emerald-300 text-sm font-mono block">
                {new Date(scanSuccessResult.record.timeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
              <span className="text-emerald-400 uppercase font-bold text-[10px] tracking-wide">{scanSuccessResult.record.status}</span>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-white/5 backdrop-blur-md">
              <span className="text-slate-400 block mb-1 font-medium">Time Out & Duration</span>
              <span className="font-bold text-indigo-300 text-sm font-mono block">
                {scanSuccessResult.record.timeOut
                  ? new Date(scanSuccessResult.record.timeOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                  : "In Progress"}
              </span>
              <span className="text-slate-400 text-[11px]">
                {scanSuccessResult.record.durationMinutes ? `${scanSuccessResult.record.durationMinutes} mins logged` : "Active"}
              </span>
            </div>
          </div>

          {/* Cryptographic AWS Chain Footer */}
          <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between text-[11px] text-slate-400 gap-2">
            <div className="flex items-center space-x-1.5 text-indigo-300 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>AWS Vault Key: {scanSuccessResult.record.awsRecordKey || "STAGED_HASH_SECURE"}</span>
            </div>
            <span className="text-slate-500 font-mono">Timestamp: {scanSuccessResult.record.createdAt}</span>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {scanErrorMessage && (
        <div className="p-4 bg-rose-950/80 border border-rose-500/40 rounded-2xl text-rose-200 text-xs sm:text-sm flex items-start space-x-3 animate-shake backdrop-blur-md">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block">Scan Notice</span>
            <span>{scanErrorMessage}</span>
          </div>
          <button
            onClick={() => setScanErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Scanner Mode Switch Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3 text-sm font-medium">
        <button
          onClick={() => setScanMode("camera")}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all text-xs sm:text-sm ${
            scanMode === "camera"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-bold ring-1 ring-white/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Live Camera</span>
        </button>

        <button
          onClick={() => setScanMode("upload")}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all text-xs sm:text-sm ${
            scanMode === "upload"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-bold ring-1 ring-white/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Upload QR Image</span>
        </button>

        <button
          onClick={() => setScanMode("manual")}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all text-xs sm:text-sm ${
            scanMode === "manual"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-bold ring-1 ring-white/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
          }`}
        >
          <Keyboard className="w-4 h-4" />
          <span>Session Code</span>
        </button>

        <button
          onClick={() => setScanMode("history")}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all text-xs sm:text-sm ${
            scanMode === "history"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-bold ring-1 ring-white/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
          }`}
        >
          <History className="w-4 h-4" />
          <span>My History ({studentHistory.length})</span>
        </button>
      </div>

      {/* TAB 1: Live Camera Scanner */}
      {scanMode === "camera" && (
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[28px] p-6 shadow-2xl flex flex-col items-center">
          <div className="relative w-full max-w-md aspect-square bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-800/80 flex items-center justify-center">
            {/* Video element */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Viewfinder Target Graphic */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
              <div className="relative w-60 h-60 border-2 border-indigo-400/60 rounded-2xl shadow-inner">
                {/* Corner Accents */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl shadow-sm" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr shadow-sm" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl shadow-sm" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br shadow-sm" />

                {/* Laser animation beam */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-lg shadow-emerald-400 animate-pulse absolute top-1/2" />
              </div>
            </div>

            {/* Camera error placeholder */}
            {cameraError && (
              <div className="absolute inset-0 bg-[#020617]/95 flex flex-col items-center justify-center p-6 text-center text-slate-300 space-y-3">
                <AlertCircle className="w-10 h-10 text-amber-400" />
                <p className="text-xs text-slate-300">{cameraError}</p>
                <button
                  onClick={() => setScanMode("upload")}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md"
                >
                  Switch to QR Image Upload
                </button>
              </div>
            )}

            {/* Processing Spinner Overlay */}
            {isProcessing && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center space-y-2 text-white">
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                <span className="text-xs font-bold">Verifying Anti-Proxy Token...</span>
              </div>
            )}
          </div>

          {/* Controls below viewfinder */}
          <div className="mt-4 flex items-center space-x-3 text-xs text-slate-400">
            <button
              onClick={() => setCameraFacing((prev) => (prev === "environment" ? "user" : "environment"))}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 transition-all border border-white/10"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Switch Camera ({cameraFacing === "environment" ? "Back" : "Front"})</span>
            </button>
            <span>•</span>
            <span>Position the classroom QR code inside the viewfinder</span>
          </div>
        </div>
      )}

      {/* TAB 2: Upload QR Photo */}
      {scanMode === "upload" && (
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[28px] p-8 shadow-2xl text-center">
          <div className="max-w-md mx-auto border-2 border-dashed border-white/15 hover:border-indigo-400/80 rounded-2xl p-8 transition-colors flex flex-col items-center justify-center bg-slate-950/40">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center mb-3 ring-1 ring-indigo-500/25">
              <Upload className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white">Upload Class QR Code Image</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Upload a picture or screenshot of the teacher's projected QR code.
            </p>

            <label className="mt-5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-lg shadow-indigo-600/30 transition-all ring-1 ring-white/20">
              <span>Choose Image File</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}

      {/* TAB 3: Manual Code Entry */}
      {scanMode === "manual" && (
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[28px] p-6 sm:p-8 shadow-2xl max-w-md mx-auto">
          <h3 className="text-lg font-bold text-white">Enter Classroom Session Code</h3>
          <p className="text-xs text-slate-400 mt-1">
            If scanning is not available, enter the 6-character session code shown on the board.
          </p>

          <form onSubmit={handleManualCodeSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Session Code</label>
              <input
                type="text"
                required
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="e.g. MATH-401"
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3 text-white text-base font-mono font-bold tracking-wider uppercase focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/50"
              />
            </div>

            <button
              type="submit"
              disabled={isProcessing || !manualCode.trim()}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 flex items-center justify-center space-x-2 ring-1 ring-white/20"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Submit {actionType === "time_in" ? "Time In" : "Time Out"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: Personal History Log */}
      {scanMode === "history" && (
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[28px] shadow-2xl overflow-hidden">
          <div className="p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/40">
            <div>
              <h3 className="text-base font-bold text-white">
                Personal Attendance History: {customName || "Student"}
              </h3>
              <span className="text-xs text-slate-400 font-mono">ID: {customStudentId || "Not set"}</span>
            </div>
            <span className="text-xs px-3 py-1 rounded-full bg-slate-800/80 text-slate-300 font-semibold border border-white/5">
              {studentHistory.length} Sessions Logged
            </span>
          </div>

          <div className="divide-y divide-white/5">
            {studentHistory.length > 0 ? (
              studentHistory.map((h) => (
                <div key={h.id} className="p-4 sm:p-5 hover:bg-white/[0.02] transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-100 text-sm">{h.subject}</span>
                      <span className="px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 font-mono font-semibold border border-indigo-500/30">
                        {h.sessionCode}
                      </span>
                    </div>
                    <span className="text-slate-400 block mt-1">
                      Logged on {new Date(h.createdAt).toLocaleDateString()} via {h.method}
                    </span>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Time In</span>
                      <span className="font-mono text-emerald-400 font-semibold">
                        {new Date(h.timeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block">Time Out</span>
                      <span className="font-mono text-indigo-400 font-semibold">
                        {h.timeOut ? new Date(h.timeOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block">Duration</span>
                      <span className="font-mono text-slate-300 font-semibold">
                        {h.durationMinutes ? `${h.durationMinutes}m` : "Active"}
                      </span>
                    </div>

                    <div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full capitalize font-semibold ${
                          h.status === "present"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : h.status === "late"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                        }`}
                      >
                        {h.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-slate-400">
                <FileCheck className="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-50" />
                <p className="font-semibold text-slate-300">No previous records found for {customStudentId || "this student ID"}.</p>
                <p className="text-xs text-slate-500 mt-1">Scan a classroom QR code to record your first time in.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
