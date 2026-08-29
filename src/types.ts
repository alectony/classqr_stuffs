export type AttendanceStatus = 'present' | 'late' | 'left_early' | 'completed' | 'excused' | 'absent';
export type ScanMethod = 'qr_camera' | 'qr_upload' | 'manual_code' | 'teacher_override';
export type SessionMode = 'both' | 'time_in_only' | 'time_out_only';

export interface Session {
  id: string;
  code: string;
  subject: string;
  teacherName: string;
  room: string;
  startTime: string;
  endTime: string;
  gracePeriodMins: number; // e.g. 10 mins before marked as Late
  allowedMode: SessionMode;
  status: 'active' | 'closed';
  qrSecretToken: string;
  dynamicQr: boolean; // if true, rotates token every 30s to prevent photo sharing
  tokenExpiresAt: number;
  createdAt: string;
  totalStudentsExpected: number;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  sessionCode: string;
  subject: string;
  studentId: string;
  studentName: string;
  section: string;
  timeIn: string;
  timeOut: string | null;
  durationMinutes?: number;
  status: AttendanceStatus;
  method: ScanMethod;
  notes?: string;
  awsSyncStatus: 'synced_live' | 'vault_stored' | 'pending';
  awsRecordKey?: string;
  s3ArchiveKey?: string;
  hash?: string;
  deviceInfo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Student {
  id: string;
  studentId: string;
  name: string;
  section: string;
  email: string;
  avatarColor: string;
  totalPresent: number;
  totalLate: number;
}

export interface AwsVaultStatus {
  mode: 'aws_live' | 'localstack' | 'aws_cloud_vault';
  isConfigured: boolean;
  isLocalStack?: boolean;
  endpointUrl?: string;
  region: string;
  bucketName: string;
  tableName: string;
  totalDynamoRecords: number;
  totalS3Archives: number;
  lastSyncTime: string | null;
  auditChainValid: boolean;
  recentLogs: Array<{
    id: string;
    action: string;
    target: 'DynamoDB' | 'S3';
    key: string;
    timestamp: string;
    status: 'SUCCESS' | 'WARNING' | 'ERROR';
    details: string;
  }>;
}

export interface AIAnalysisResult {
  summary: string;
  attendanceRate: number;
  onTimeRate: number;
  anomalies: Array<{
    studentName: string;
    studentId: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  insights: string[];
  recommendations: string[];
  generatedAt: string;
}

export interface ExcuseNoteResult {
  studentName: string;
  studentId: string;
  date: string;
  reason: string;
  isLegitimate: boolean;
  confidenceScore: number;
  suggestedAction: 'approve' | 'review' | 'reject';
  summary: string;
}
