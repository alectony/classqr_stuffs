import React, { useState, useEffect } from "react";
import { X, QrCode, Copy, Check, ExternalLink, Smartphone, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";

interface StudentShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StudentShareModal: React.FC<StudentShareModalProps> = ({ isOpen, onClose }) => {
  const [qrUrl, setQrUrl] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [studentAppUrl, setStudentAppUrl] = useState<string>("");

  useEffect(() => {
    if (!isOpen) return;

    // Generate absolute student portal URL
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const url = `${origin}${pathname}?app=student`;
    setStudentAppUrl(url);

    QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: {
        dark: "#020617",
        light: "#ffffff",
      },
      errorCorrectionLevel: "H",
    }).then(setQrUrl).catch(console.error);
  }, [isOpen]);

  const copyUrl = () => {
    navigator.clipboard.writeText(studentAppUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#020617]/85 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900/90 backdrop-blur-2xl border border-white/15 rounded-[32px] w-full max-w-lg shadow-2xl shadow-black/80 overflow-hidden flex flex-col text-slate-100 animate-in fade-in zoom-in-95 duration-200 relative">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Modal Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Student Portal Access</h2>
              <p className="text-xs text-slate-400">Share this QR code or URL for mobile scanning</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* QR Code Container */}
        <div className="p-6 sm:p-8 flex flex-col items-center text-center space-y-5">
          <div className="p-4 bg-white rounded-3xl shadow-2xl ring-4 ring-emerald-500/30">
            {qrUrl ? (
              <img src={qrUrl} alt="Student Portal QR Code" className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-2xl" />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-slate-900">
                <QrCode className="w-12 h-12 animate-pulse text-emerald-600" />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-white text-base flex items-center justify-center space-x-1.5">
              <span>Scan to Open Student Scanner App</span>
            </h3>
            <p className="text-xs text-slate-400 max-w-sm">
              Students can scan this code with their smartphone camera to directly launch the separate Student Scanner portal on their mobile device.
            </p>
          </div>

          {/* Copy URL Bar */}
          <div className="w-full bg-slate-950/80 border border-white/10 rounded-2xl p-2.5 flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-emerald-300 truncate px-2 select-all">
              {studentAppUrl}
            </span>
            <div className="flex items-center space-x-1.5 shrink-0">
              <button
                onClick={copyUrl}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
              <a
                href={studentAppUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors shadow-lg shadow-emerald-600/30"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open App</span>
              </a>
            </div>
          </div>

          {/* Features note */}
          <div className="w-full bg-slate-950/40 rounded-xl p-3 border border-white/5 text-left text-xs text-slate-400 flex items-start space-x-2.5">
            <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <span>
              The Student App is completely isolated from the Teacher Dashboard and database controls. Students can only scan and view their own attendance history.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
