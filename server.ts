import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import QRCode from "qrcode";
import { createServer as createViteServer } from "vite";
import {
  putAttendanceRecordToAws,
  archiveSessionToAwsS3,
  getAwsVaultStatus,
  getDynamoRecords,
  getS3Archives,
  getS3FileByKey,
  autoProvisionLocalStack,
  initAwsClients,
  logAwsActivity,
} from "./server/awsStorage";
import { Session, AttendanceRecord, Student } from "./src/types";

const DATA_DIR = path.join(process.cwd(), ".data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");
const ATTENDANCE_FILE = path.join(DATA_DIR, "attendance.json");
const STUDENTS_FILE = path.join(DATA_DIR, "students.json");

function readJson<T>(file: string, fallback: T): T {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
    }
  } catch (e) {
    console.error(`Failed to read ${file}:`, e);
  }
  return fallback;
}

function writeJson<T>(file: string, data: T) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error(`Failed to write ${file}:`, e);
  }
}

// Initial seed data if empty
function initializeSeedData() {
  const existingStudents = readJson<Student[]>(STUDENTS_FILE, []);
  if (existingStudents.length === 0) {
    const defaultStudents: Student[] = [
      { id: "stu-1", studentId: "2026-0012", name: "Alex Rivera", section: "CS-4A", email: "alex.rivera@edu.university.com", avatarColor: "bg-blue-500", totalPresent: 14, totalLate: 1 },
      { id: "stu-2", studentId: "2026-0034", name: "Samantha Chen", section: "CS-4A", email: "sam.chen@edu.university.com", avatarColor: "bg-emerald-500", totalPresent: 15, totalLate: 0 },
      { id: "stu-3", studentId: "2026-0089", name: "Marcus Vance", section: "CS-4A", email: "m.vance@edu.university.com", avatarColor: "bg-amber-500", totalPresent: 12, totalLate: 3 },
      { id: "stu-4", studentId: "2026-0105", name: "Elena Rostova", section: "CS-4A", email: "elena.r@edu.university.com", avatarColor: "bg-purple-500", totalPresent: 14, totalLate: 0 },
      { id: "stu-5", studentId: "2026-0142", name: "David Kim", section: "CS-4A", email: "david.kim@edu.university.com", avatarColor: "bg-rose-500", totalPresent: 13, totalLate: 2 },
      { id: "stu-6", studentId: "2026-0188", name: "Chloe Bennett", section: "CS-4A", email: "c.bennett@edu.university.com", avatarColor: "bg-indigo-500", totalPresent: 15, totalLate: 0 },
    ];
    writeJson(STUDENTS_FILE, defaultStudents);
  }

  const existingSessions = readJson<Session[]>(SESSIONS_FILE, []);
  if (existingSessions.length === 0) {
    const now = new Date();
    const startTime = new Date(now.getTime() - 15 * 60 * 1000).toTimeString().slice(0, 5);
    const endTime = new Date(now.getTime() + 75 * 60 * 1000).toTimeString().slice(0, 5);

    const defaultSession: Session = {
      id: "sess-default-1",
      code: "MATH-401",
      subject: "Advanced Mathematics & Algorithms",
      teacherName: "Prof. Anthony Bisnar",
      room: "Hall B-204",
      startTime,
      endTime,
      gracePeriodMins: 10,
      allowedMode: "both",
      status: "active",
      qrSecretToken: crypto.randomBytes(8).toString("hex"),
      dynamicQr: true,
      tokenExpiresAt: Date.now() + 30000,
      createdAt: new Date().toISOString(),
      totalStudentsExpected: 25,
    };
    writeJson(SESSIONS_FILE, [defaultSession]);

    // Initial sample attendance records
    const defaultAttendance: AttendanceRecord[] = [
      {
        id: "rec-1",
        sessionId: "sess-default-1",
        sessionCode: "MATH-401",
        subject: "Advanced Mathematics & Algorithms",
        studentId: "2026-0012",
        studentName: "Alex Rivera",
        section: "CS-4A",
        timeIn: new Date(now.getTime() - 12 * 60 * 1000).toISOString(),
        timeOut: null,
        status: "present",
        method: "qr_camera",
        awsSyncStatus: "vault_stored",
        awsRecordKey: "SESSION#sess-default-1_STUDENT#2026-0012",
        createdAt: new Date(now.getTime() - 12 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 12 * 60 * 1000).toISOString(),
      },
      {
        id: "rec-2",
        sessionId: "sess-default-1",
        sessionCode: "MATH-401",
        subject: "Advanced Mathematics & Algorithms",
        studentId: "2026-0034",
        studentName: "Samantha Chen",
        section: "CS-4A",
        timeIn: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
        timeOut: null,
        status: "present",
        method: "qr_camera",
        awsSyncStatus: "vault_stored",
        awsRecordKey: "SESSION#sess-default-1_STUDENT#2026-0034",
        createdAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
      },
    ];
    writeJson(ATTENDANCE_FILE, defaultAttendance);

    // Initial put to AWS Vault
    defaultAttendance.forEach(rec => putAttendanceRecordToAws(rec));
  }
}

initializeSeedData();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // --- API: Sessions ---
  app.get("/api/sessions", (req, res) => {
    const sessions = readJson<Session[]>(SESSIONS_FILE, []);
    res.json(sessions);
  });

  app.post("/api/sessions", (req, res) => {
    const { subject, teacherName, room, startTime, endTime, gracePeriodMins, allowedMode, dynamicQr, totalStudentsExpected } = req.body;
    if (!subject || !teacherName) {
      return res.status(400).json({ error: "Subject and Teacher Name are required" });
    }

    const sessions = readJson<Session[]>(SESSIONS_FILE, []);
    const prefix = subject.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() || "CLAS";
    const randomNum = Math.floor(100 + Math.random() * 900);
    const code = `${prefix}-${randomNum}`;

    const newSession: Session = {
      id: `sess-${Date.now()}`,
      code,
      subject,
      teacherName,
      room: room || "Main Hall",
      startTime: startTime || "09:00",
      endTime: endTime || "10:30",
      gracePeriodMins: Number(gracePeriodMins) || 10,
      allowedMode: allowedMode || "both",
      status: "active",
      qrSecretToken: crypto.randomBytes(8).toString("hex"),
      dynamicQr: dynamicQr ?? true,
      tokenExpiresAt: Date.now() + 30000,
      createdAt: new Date().toISOString(),
      totalStudentsExpected: Number(totalStudentsExpected) || 30,
    };

    sessions.unshift(newSession);
    writeJson(SESSIONS_FILE, sessions);
    logAwsActivity("CreateSession", "DynamoDB", newSession.id, "SUCCESS", `New classroom session initialized: ${newSession.code} (${newSession.subject})`);
    res.status(201).json(newSession);
  });

  app.patch("/api/sessions/:id", (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const sessions = readJson<Session[]>(SESSIONS_FILE, []);
    const idx = sessions.findIndex((s) => s.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: "Session not found" });
    }

    sessions[idx] = { ...sessions[idx], ...updates };
    writeJson(SESSIONS_FILE, sessions);

    if (updates.status === "closed") {
      // Trigger S3 Archive
      const attendance = readJson<AttendanceRecord[]>(ATTENDANCE_FILE, []);
      const sessionRecords = attendance.filter((r) => r.sessionId === id);
      archiveSessionToAwsS3(id, sessions[idx].code, sessionRecords).catch((e) => console.error("S3 archive failed:", e));
    }

    res.json(sessions[idx]);
  });

  // Get active dynamic QR Token for a session
  app.get("/api/sessions/:id/qr-token", (req, res) => {
    const { id } = req.params;
    const sessions = readJson<Session[]>(SESSIONS_FILE, []);
    const session = sessions.find((s) => s.id === id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const now = Date.now();
    if (session.dynamicQr && now > session.tokenExpiresAt) {
      session.qrSecretToken = crypto.randomBytes(8).toString("hex");
      session.tokenExpiresAt = now + 30000; // 30s token rotation
      writeJson(SESSIONS_FILE, sessions);
    }

    const qrPayload = JSON.stringify({
      type: "CLASSQR_ATTENDANCE",
      sessionId: session.id,
      sessionCode: session.code,
      subject: session.subject,
      token: session.qrSecretToken,
      expiresAt: session.tokenExpiresAt,
      allowedMode: session.allowedMode,
    });

    res.json({
      sessionId: session.id,
      sessionCode: session.code,
      token: session.qrSecretToken,
      expiresAt: session.tokenExpiresAt,
      qrPayload,
    });
  });

  // Generate QR Code data URL directly
  app.get("/api/sessions/:id/qr-image", async (req, res) => {
    const { id } = req.params;
    const sessions = readJson<Session[]>(SESSIONS_FILE, []);
    const session = sessions.find((s) => s.id === id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const qrPayload = JSON.stringify({
      type: "CLASSQR_ATTENDANCE",
      sessionId: session.id,
      sessionCode: session.code,
      token: session.qrSecretToken,
      expiresAt: session.tokenExpiresAt,
      allowedMode: session.allowedMode,
    });

    try {
      const dataUrl = await QRCode.toDataURL(qrPayload, {
        width: 380,
        margin: 2,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      });
      res.json({ dataUrl });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- API: Attendance Records ---
  app.get("/api/attendance", (req, res) => {
    const { sessionId, studentId } = req.query;
    let attendance = readJson<AttendanceRecord[]>(ATTENDANCE_FILE, []);
    if (sessionId) {
      attendance = attendance.filter((r) => r.sessionId === sessionId);
    }
    if (studentId) {
      attendance = attendance.filter((r) => r.studentId === studentId);
    }
    res.json(attendance);
  });

  // Time In or Time Out Action
  app.post("/api/attendance/scan", async (req, res) => {
    const { sessionId, sessionCode, token, studentId, studentName, section, actionType, method, notes } = req.body;

    if (!studentId || !studentName) {
      return res.status(400).json({ error: "Student ID and Student Name are required" });
    }

    const sessions = readJson<Session[]>(SESSIONS_FILE, []);
    const session = sessions.find((s) => s.id === sessionId || s.code === sessionCode);
    if (!session) {
      return res.status(404).json({ error: "Classroom Session not found" });
    }

    if (session.status === "closed") {
      return res.status(400).json({ error: "This attendance session is currently closed." });
    }

    // Validate QR Token freshness if dynamic QR is active and method is qr
    if (session.dynamicQr && method?.startsWith("qr_") && token) {
      if (token !== session.qrSecretToken && Date.now() > session.tokenExpiresAt + 10000) {
        return res.status(400).json({ error: "Expired or Invalid QR Code. Please scan the current live QR code on the teacher screen." });
      }
    }

    const attendance = readJson<AttendanceRecord[]>(ATTENDANCE_FILE, []);
    const existingRecordIndex = attendance.findIndex(
      (r) => r.sessionId === session.id && r.studentId.trim().toLowerCase() === studentId.trim().toLowerCase()
    );

    const now = new Date();
    const action = actionType || "time_in";

    if (action === "time_out") {
      if (existingRecordIndex === -1) {
        return res.status(400).json({ error: "No prior Time-In record found for this session. Please Time In first." });
      }

      const existing = attendance[existingRecordIndex];
      const timeInDate = new Date(existing.timeIn);
      const durationMins = Math.max(1, Math.round((now.getTime() - timeInDate.getTime()) / (1000 * 60)));

      existing.timeOut = now.toISOString();
      existing.durationMinutes = durationMins;
      existing.status = "completed";
      existing.updatedAt = now.toISOString();
      if (notes) existing.notes = notes;

      const awsResult = await putAttendanceRecordToAws(existing);
      existing.awsSyncStatus = "vault_stored";
      existing.awsRecordKey = awsResult.dynamoKey;

      attendance[existingRecordIndex] = existing;
      writeJson(ATTENDANCE_FILE, attendance);

      return res.json({
        success: true,
        action: "time_out",
        record: existing,
        message: `Time-Out confirmed for ${studentName}. Total Duration: ${durationMins} mins.`,
      });
    }

    // TIME IN action
    if (existingRecordIndex !== -1) {
      const existing = attendance[existingRecordIndex];
      return res.status(200).json({
        success: true,
        alreadyTimedIn: true,
        record: existing,
        message: `${studentName} already timed in at ${new Date(existing.timeIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
      });
    }

    // Determine status (Present vs Late)
    let status: AttendanceRecord["status"] = "present";
    const sessionCreatedAt = new Date(session.createdAt);
    const minsSinceSessionStart = (now.getTime() - sessionCreatedAt.getTime()) / (1000 * 60);
    if (minsSinceSessionStart > session.gracePeriodMins) {
      status = "late";
    }

    const newRecord: AttendanceRecord = {
      id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sessionId: session.id,
      sessionCode: session.code,
      subject: session.subject,
      studentId: studentId.trim(),
      studentName: studentName.trim(),
      section: section || "Regular",
      timeIn: now.toISOString(),
      timeOut: null,
      status,
      method: method || "qr_camera",
      notes: notes || (status === "late" ? `Checked in ${Math.round(minsSinceSessionStart - session.gracePeriodMins)}m past grace period` : undefined),
      awsSyncStatus: "vault_stored",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // AWS Record Keeping PutItem
    const awsResult = await putAttendanceRecordToAws(newRecord);
    newRecord.awsRecordKey = awsResult.dynamoKey;

    attendance.unshift(newRecord);
    writeJson(ATTENDANCE_FILE, attendance);

    // Update student directory stats
    const students = readJson<Student[]>(STUDENTS_FILE, []);
    const sIdx = students.findIndex((s) => s.studentId.toLowerCase() === studentId.toLowerCase());
    if (sIdx !== -1) {
      if (status === "present") students[sIdx].totalPresent += 1;
      if (status === "late") students[sIdx].totalLate += 1;
      writeJson(STUDENTS_FILE, students);
    }

    res.status(201).json({
      success: true,
      action: "time_in",
      record: newRecord,
      message: `Time-In recorded! Welcome to ${session.subject}, ${studentName}. Status: ${status.toUpperCase()}.`,
    });
  });

  // Manual Override / Status Edit
  app.patch("/api/attendance/:id", async (req, res) => {
    const { id } = req.params;
    const { status, notes, timeIn, timeOut } = req.body;
    const attendance = readJson<AttendanceRecord[]>(ATTENDANCE_FILE, []);
    const idx = attendance.findIndex((r) => r.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: "Record not found" });
    }

    if (status) attendance[idx].status = status;
    if (notes !== undefined) attendance[idx].notes = notes;
    if (timeIn) attendance[idx].timeIn = timeIn;
    if (timeOut) attendance[idx].timeOut = timeOut;
    attendance[idx].updatedAt = new Date().toISOString();

    const awsResult = await putAttendanceRecordToAws(attendance[idx]);
    attendance[idx].awsRecordKey = awsResult.dynamoKey;
    writeJson(ATTENDANCE_FILE, attendance);

    res.json(attendance[idx]);
  });

  app.delete("/api/attendance/:id", (req, res) => {
    const { id } = req.params;
    let attendance = readJson<AttendanceRecord[]>(ATTENDANCE_FILE, []);
    attendance = attendance.filter((r) => r.id !== id);
    writeJson(ATTENDANCE_FILE, attendance);
    res.json({ success: true });
  });

  // --- API: Students ---
  app.get("/api/students", (req, res) => {
    const students = readJson<Student[]>(STUDENTS_FILE, []);
    res.json(students);
  });

  app.post("/api/students", (req, res) => {
    const { studentId, name, section, email } = req.body;
    if (!studentId || !name) {
      return res.status(400).json({ error: "Student ID and Name are required" });
    }

    const students = readJson<Student[]>(STUDENTS_FILE, []);
    const colors = ["bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500", "bg-rose-500", "bg-indigo-500", "bg-teal-500"];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    const newStudent: Student = {
      id: `stu-${Date.now()}`,
      studentId: studentId.trim(),
      name: name.trim(),
      section: section || "General",
      email: email || `${studentId.toLowerCase()}@edu.school.com`,
      avatarColor,
      totalPresent: 0,
      totalLate: 0,
    };

    students.push(newStudent);
    writeJson(STUDENTS_FILE, students);
    res.status(201).json(newStudent);
  });

  // --- API: AWS Record Keeper & LocalStack Endpoints ---
  app.get("/api/aws/status", (req, res) => {
    const status = getAwsVaultStatus();
    res.json(status);
  });

  app.get("/api/aws/dynamodb-records", (req, res) => {
    const records = getDynamoRecords();
    res.json(records);
  });

  app.get("/api/aws/s3-archives", (req, res) => {
    const archives = getS3Archives();
    res.json(archives);
  });

  app.get("/api/aws/s3/file", (req, res) => {
    const key = req.query.key as string;
    if (!key) {
      return res.status(400).json({ error: "Missing S3 key" });
    }
    const content = getS3FileByKey(key);
    if (!content) {
      return res.status(404).json({ error: "S3 Object not found" });
    }
    res.json(content);
  });

  app.post("/api/aws/localstack/provision", async (req, res) => {
    const { endpoint } = req.body || {};
    const result = await autoProvisionLocalStack(endpoint);
    const updatedStatus = getAwsVaultStatus();
    res.json({
      ...result,
      status: updatedStatus,
    });
  });

  app.post("/api/aws/localstack/set-endpoint", async (req, res) => {
    const { endpoint } = req.body;
    if (endpoint) {
      initAwsClients(endpoint);
      const result = await autoProvisionLocalStack(endpoint);
      const updatedStatus = getAwsVaultStatus();
      return res.json({
        success: true,
        endpoint,
        provision: result,
        status: updatedStatus,
      });
    }
    res.status(400).json({ error: "Endpoint URL required (e.g. http://localhost:4566)" });
  });

  const handleSyncSession = async (sessionId: string, res: express.Response) => {
    const sessions = readJson<Session[]>(SESSIONS_FILE, []);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const attendance = readJson<AttendanceRecord[]>(ATTENDANCE_FILE, []);
    const sessionRecords = attendance.filter((r) => r.sessionId === sessionId);

    // Sync all records to DynamoDB and generate S3 JSON archive
    for (const rec of sessionRecords) {
      await putAttendanceRecordToAws(rec);
    }
    const archive = await archiveSessionToAwsS3(session.id, session.code, sessionRecords);

    res.json({
      success: true,
      recordsSynced: sessionRecords.length,
      s3Archive: archive,
      message: `Successfully synchronized ${sessionRecords.length} records to DynamoDB & S3.`,
    });
  };

  app.post("/api/aws/sync-session", async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }
    await handleSyncSession(sessionId, res);
  });

  app.post("/api/aws/sync/:id", async (req, res) => {
    const sessionId = req.params.id;
    await handleSyncSession(sessionId, res);
  });

  // Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ClassQR Attendance & AWS Keeper server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
