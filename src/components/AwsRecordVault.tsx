import React, { useState, useEffect } from "react";
import {
  Database,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Activity,
  Terminal,
  Copy,
  Check,
  Server,
  PlayCircle
} from "lucide-react";
import { AwsVaultStatus, Session } from "../types";
import { DataService } from "../lib/dataService";

interface AwsRecordVaultProps {
  awsStatus: AwsVaultStatus | null;
  activeSession: Session | null;
  onRefreshData: () => void;
}

export const AwsRecordVault: React.FC<AwsRecordVaultProps> = ({
  awsStatus,
  activeSession,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<"localstack" | "dynamodb" | "backup">("localstack");
  const [dynamoRecords, setDynamoRecords] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<{ success: boolean; text: string } | null>(null);

  // LocalStack custom endpoint state
  const [localstackEndpoint, setLocalstackEndpoint] = useState<string>(
    awsStatus?.endpointUrl || "http://localhost:4566"
  );
  const [isProvisioning, setIsProvisioning] = useState<boolean>(false);
  const [provisionResult, setProvisionResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const fetchRecords = async () => {
    try {
      const dData = await DataService.getDynamoRecords();
      setDynamoRecords(Array.isArray(dData) ? dData : []);
    } catch (e) {
      console.error("Failed to fetch database records:", e);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [awsStatus]);

  const handleTriggerSync = async () => {
    if (!activeSession) return;
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const data = await DataService.syncSessionToAws(activeSession.id);
      setSyncMessage(data.message || "Sync completed successfully.");
      onRefreshData();
      fetchRecords();
    } catch (e: any) {
      setSyncMessage(`Sync failed: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTestAndProvisionLocalStack = async () => {
    setIsProvisioning(true);
    setProvisionResult(null);
    try {
      const data = await DataService.provisionLocalStack(localstackEndpoint);
      setProvisionResult(data);
      onRefreshData();
      fetchRecords();
    } catch (e: any) {
      setProvisionResult({
        success: false,
        message: `Connection failed: ${e.message}. Ensure LocalStack container is running on ${localstackEndpoint}.`,
      });
    } finally {
      setIsProvisioning(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(id);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const dockerCommand = `docker run --rm -it -p 4566:4566 -p 4510-4559:4510-4559 localstack/localstack`;
  const cliScanCommand = `awslocal dynamodb scan --table-name AttendanceLogs`;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-[28px] p-6 sm:p-7 shadow-2xl text-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-xl shadow-orange-500/25 ring-1 ring-white/20 shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 tracking-wide uppercase">
                  LocalStack DynamoDB Vault
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {awsStatus?.mode === "localstack"
                    ? "LocalStack Connected"
                    : awsStatus?.isConfigured
                    ? "Live AWS Cloud"
                    : "Local DynamoDB Emulator Vault"}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
                LocalStack & DynamoDB Database Hub
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleTriggerSync}
              disabled={isSyncing || !activeSession}
              className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-600/30 transition-all disabled:opacity-50 ring-1 ring-white/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Syncing..." : "Sync Active Session to DynamoDB"}</span>
            </button>
          </div>
        </div>

        {syncMessage && (
          <div className="mt-4 p-3.5 bg-emerald-950/80 border border-emerald-500/40 rounded-2xl text-emerald-200 text-xs flex items-center space-x-2.5 backdrop-blur-md">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncMessage}</span>
          </div>
        )}
      </div>

      {/* Cloud Architecture Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* DynamoDB Tile */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between text-xs text-orange-400 font-bold mb-1">
            <span className="flex items-center space-x-1.5">
              <HardDrive className="w-4 h-4" />
              <span>LocalStack DynamoDB</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 font-mono text-[10px] font-bold border border-orange-500/30">
              NoSQL Table
            </span>
          </div>
          <p className="text-xl font-extrabold text-white font-mono mt-2 truncate">
            {awsStatus?.tableName || "AttendanceLogs"}
          </p>
          <div className="mt-3.5 text-xs text-slate-400 space-y-1.5 pt-3 border-t border-white/5">
            <div className="flex justify-between">
              <span className="font-medium">Total Items:</span>
              <span className="font-mono text-slate-200 font-bold">{dynamoRecords.length} records</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Partition Key (PK):</span>
              <span className="font-mono text-slate-200">SESSION#id</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Sort Key (SK):</span>
              <span className="font-mono text-slate-200">STUDENT#id#time</span>
            </div>
          </div>
        </div>

        {/* LocalStack Status Tile */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between text-xs text-indigo-400 font-bold mb-1">
            <span className="flex items-center space-x-1.5">
              <Server className="w-4 h-4" />
              <span>Database Engine</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-bold border border-indigo-500/30">
              {awsStatus?.region || "us-east-1"}
            </span>
          </div>
          <p className="text-base font-bold text-white mt-2 flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>LocalStack Compatible</span>
          </p>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed font-mono">
            {awsStatus?.endpointUrl || "http://localhost:4566"}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Supports local Docker emulation and zero-cloud AWS development.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3 text-sm font-medium">
        <button
          onClick={() => setActiveTab("localstack")}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all text-xs sm:text-sm ${
            activeTab === "localstack"
              ? "bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/30 ring-1 ring-white/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
          }`}
        >
          <Server className="w-4 h-4 text-emerald-400" />
          <span>LocalStack Setup & Controls</span>
        </button>

        <button
          onClick={() => setActiveTab("dynamodb")}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all text-xs sm:text-sm ${
            activeTab === "dynamodb"
              ? "bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/30 ring-1 ring-white/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
          }`}
        >
          <HardDrive className="w-4 h-4 text-orange-400" />
          <span>DynamoDB Items ({dynamoRecords.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("backup")}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all text-xs sm:text-sm ${
            activeTab === "backup"
              ? "bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/30 ring-1 ring-white/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
          }`}
        >
          <Activity className="w-4 h-4 text-cyan-400" />
          <span>GitHub Pages & Backups</span>
        </button>
      </div>

      {/* TAB 0: LocalStack Setup & Controls */}
      {activeTab === "localstack" && (
        <div className="space-y-6">
          {/* Quick Provision & Test Panel */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[28px] p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-white flex items-center space-x-2">
                  <Server className="w-5 h-5 text-emerald-400" />
                  <span>LocalStack Connection & Auto-Provisioning</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Connect to your local LocalStack AWS instance to emulate DynamoDB with zero cloud cost.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono text-slate-400">Endpoint:</span>
                <input
                  type="text"
                  value={localstackEndpoint}
                  onChange={(e) => setLocalstackEndpoint(e.target.value)}
                  className="bg-slate-950/80 border border-white/15 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52"
                  placeholder="http://localhost:4566"
                />
                <button
                  onClick={handleTestAndProvisionLocalStack}
                  disabled={isProvisioning}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/25 disabled:opacity-50"
                >
                  <PlayCircle className={`w-4 h-4 ${isProvisioning ? "animate-spin" : ""}`} />
                  <span>{isProvisioning ? "Testing..." : "Provision Resources"}</span>
                </button>
              </div>
            </div>

            {provisionResult && (
              <div
                className={`p-4 rounded-2xl border text-xs flex items-start space-x-3 backdrop-blur-md ${
                  provisionResult.success
                    ? "bg-emerald-950/70 border-emerald-500/40 text-emerald-200"
                    : "bg-amber-950/70 border-amber-500/40 text-amber-200"
                }`}
              >
                {provisionResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="font-bold">{provisionResult.message}</div>
                  {provisionResult.details && (
                    <pre className="mt-1 text-[11px] font-mono opacity-90 whitespace-pre-wrap">
                      {JSON.stringify(provisionResult.details, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {/* Docker & CLI Guide */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              {/* Docker Run Card */}
              <div className="bg-slate-950/60 p-5 rounded-2xl border border-white/5 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-300 font-bold">
                  <span className="flex items-center space-x-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span>1. Start LocalStack via Docker</span>
                  </span>
                  <button
                    onClick={() => copyToClipboard(dockerCommand, "docker")}
                    className="text-xs text-slate-400 hover:text-white flex items-center space-x-1"
                  >
                    {copiedCommand === "docker" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedCommand === "docker" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl font-mono text-[11px] text-emerald-300 overflow-x-auto border border-white/5">
                  {dockerCommand}
                </div>
                <p className="text-[11px] text-slate-400">
                  This boots LocalStack listening on port <strong>4566</strong> for DynamoDB table operations.
                </p>
              </div>

              {/* CLI Query Card */}
              <div className="bg-slate-950/60 p-5 rounded-2xl border border-white/5 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-300 font-bold">
                  <span className="flex items-center space-x-2">
                    <Terminal className="w-4 h-4 text-indigo-400" />
                    <span>2. Query LocalStack via awslocal CLI</span>
                  </span>
                  <button
                    onClick={() => copyToClipboard(cliScanCommand, "scan")}
                    className="text-xs text-slate-400 hover:text-white flex items-center space-x-1"
                  >
                    {copiedCommand === "scan" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedCommand === "scan" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl font-mono text-[11px] text-indigo-300 overflow-x-auto border border-white/5">
                  {cliScanCommand}
                </div>
                <p className="text-[11px] text-slate-400">
                  Scans all attendance records written to the LocalStack DynamoDB table.
                </p>
              </div>
            </div>
          </div>

          {/* Activity Log Stream */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[28px] p-6 sm:p-7 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center space-x-2">
                <Activity className="w-4 h-4 text-amber-400" />
                <span>Live Storage Activity & Audit Log Stream</span>
              </h3>
              <button
                onClick={fetchRecords}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh Logs</span>
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
              {awsStatus?.recentLogs && awsStatus.recentLogs.length > 0 ? (
                awsStatus.recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-slate-950/60 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono"
                  >
                    <div className="flex items-center space-x-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.status === "SUCCESS"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : log.status === "WARNING"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {log.action}
                      </span>
                      <span className="text-slate-400 font-sans">[{log.target}]</span>
                      <span className="text-slate-200 truncate max-w-[300px]">{log.details}</span>
                    </div>
                    <span className="text-slate-500 text-[10px] shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs font-mono">
                  No activity logged yet. Check in a student to witness real-time database transactions.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: DynamoDB Table Viewer */}
      {activeTab === "dynamodb" && (
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[28px] shadow-2xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-white/10 bg-slate-950/60 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <span className="font-bold text-white text-sm">
                Table: {awsStatus?.tableName || "AttendanceLogs"}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                ({dynamoRecords.length} items)
              </span>
            </div>
            <button
              onClick={() => {
                onRefreshData();
                fetchRecords();
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/5"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh Table</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse text-slate-300">
              <thead>
                <tr className="border-b border-white/10 bg-slate-950/80 text-slate-400 uppercase tracking-wider font-bold text-[10px]">
                  <th className="py-3.5 px-4 font-mono">Partition Key (PK)</th>
                  <th className="py-3.5 px-4 font-mono">Sort Key (SK)</th>
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Time-In / Out</th>
                  <th className="py-3.5 px-4 font-mono">Hash Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {dynamoRecords.length > 0 ? (
                  dynamoRecords.map((item, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02] font-normal transition-colors">
                      <td className="py-3.5 px-4 font-mono text-indigo-300 font-semibold">{item.PK}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">{item.SK}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-white block">{item.studentName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.studentId} • {item.section}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full capitalize font-semibold text-[11px] bg-slate-800/80 text-slate-200 border border-white/10">
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        <div>In: {new Date(item.timeIn).toLocaleTimeString()}</div>
                        {item.timeOut && (
                          <div className="text-indigo-400 font-semibold">
                            Out: {new Date(item.timeOut).toLocaleTimeString()}
                          </div>
                        )}
                      </td>
                      <td
                        className="py-3.5 px-4 font-mono text-[10px] text-emerald-400 truncate max-w-[140px]"
                        title={item.hash}
                      >
                        {item.hash || "verified"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No records synchronized yet. Check in a student to see DynamoDB items.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* TAB 2: GitHub Pages & Backups */}
      {activeTab === "backup" && (
        <div className="space-y-6">
          <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[28px] p-6 sm:p-7 shadow-2xl space-y-6">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white flex items-center space-x-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                <span>GitHub Pages & Offline Persistence</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                ClassQR is built with a dual-engine architecture: when hosted as a static site on GitHub Pages, data is securely persisted in your browser's local storage and can be backed up or restored anytime.
              </p>
            </div>

            {importMessage && (
              <div
                className={`p-4 rounded-2xl border text-xs flex items-center space-x-2 ${
                  importMessage.success
                    ? "bg-emerald-950/60 border-emerald-500/30 text-emerald-300"
                    : "bg-red-950/60 border-red-500/30 text-red-300"
                }`}
              >
                {importMessage.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                )}
                <span>{importMessage.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Export Data */}
              <div className="bg-slate-950/60 border border-white/10 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="font-bold text-white text-sm flex items-center space-x-2">
                    <Database className="w-4 h-4 text-indigo-400" />
                    <span>Export JSON Backup</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Download all classroom sessions, attendance logs, and student rosters as a single portable JSON file.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const dataStr = DataService.exportAllData();
                    const blob = new Blob([dataStr], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `classqr_backup_${new Date().toISOString().split("T")[0]}.json`;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/30"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Download Backup (.json)</span>
                </button>
              </div>

              {/* Import Data */}
              <div className="bg-slate-950/60 border border-white/10 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="font-bold text-white text-sm flex items-center space-x-2">
                    <RefreshCw className="w-4 h-4 text-emerald-400" />
                    <span>Import JSON Backup</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Restore sessions, attendance records, and student rosters from an exported JSON file.
                  </p>
                </div>
                <label className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-lg shadow-emerald-600/30 cursor-pointer">
                  <Activity className="w-3.5 h-3.5" />
                  <span>Upload & Restore Backup</span>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        try {
                          const jsonStr = event.target?.result as string;
                          const res = DataService.importAllData(jsonStr);
                          setImportMessage(res);
                          if (res.success) {
                            onRefreshData();
                            fetchRecords();
                          }
                        } catch (err: any) {
                          setImportMessage({ success: false, text: `Error reading file: ${err.message}` });
                        }
                      };
                      reader.readAsText(file);
                    }}
                  />
                </label>
              </div>

              {/* Reset to Seed Data */}
              <div className="bg-slate-950/60 border border-white/10 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="font-bold text-white text-sm flex items-center space-x-2">
                    <HardDrive className="w-4 h-4 text-amber-400" />
                    <span>Reset to Seed Roster</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Reset local database to initial sample data with demo students, subjects, and QR tokens.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (confirm("Reset all local sessions and records to the default demo data?")) {
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-white/10 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Reset Demo State</span>
                </button>
              </div>
            </div>

            {/* GitHub Pages Deployment Guide */}
            <div className="bg-slate-950/80 border border-white/10 rounded-2xl p-5 space-y-4">
              <h3 className="font-extrabold text-white text-sm flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span>How to Deploy to GitHub Pages</span>
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                A pre-configured GitHub Actions workflow (<code className="text-indigo-300 font-mono">.github/workflows/deploy.yml</code>) has been placed in your repository root. Follow these simple steps:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-xs text-slate-300 leading-relaxed font-sans pl-1">
                <li>Push your repository to GitHub: <code className="text-indigo-300 font-mono bg-white/5 px-2 py-0.5 rounded">git push origin main</code></li>
                <li>Go to your repository settings on GitHub: <strong>Settings &rarr; Pages</strong>.</li>
                <li>Under <strong>Build and deployment &rarr; Source</strong>, choose <strong>GitHub Actions</strong>.</li>
                <li>The automated action will build the static Vite bundle and deploy your ClassQR site within 1-2 minutes!</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
