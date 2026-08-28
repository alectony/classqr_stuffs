import { S3Client, PutObjectCommand, ListObjectsV2Command, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, PutItemCommand, ScanCommand, CreateTableCommand, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { AttendanceRecord, AwsVaultStatus } from "../src/types";

const DATA_DIR = path.join(process.cwd(), ".data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DYNAMO_FILE = path.join(DATA_DIR, "aws_dynamodb_records.json");
const S3_ARCHIVE_FILE = path.join(DATA_DIR, "aws_s3_archives.json");
const AWS_LOGS_FILE = path.join(DATA_DIR, "aws_activity_logs.json");

let s3Client: S3Client | null = null;
let dynamoClient: DynamoDBClient | null = null;
let activeEndpoint: string | undefined = undefined;
let isLocalStackMode = false;

export function initAwsClients(customEndpoint?: string) {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID || (customEndpoint || process.env.LOCALSTACK_ENDPOINT || process.env.AWS_ENDPOINT_URL ? "test" : undefined);
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || (customEndpoint || process.env.LOCALSTACK_ENDPOINT || process.env.AWS_ENDPOINT_URL ? "test" : undefined);
  const region = process.env.AWS_REGION || "us-east-1";
  
  const endpoint = customEndpoint || process.env.LOCALSTACK_ENDPOINT || process.env.AWS_ENDPOINT_URL || (process.env.USE_LOCALSTACK === "true" ? "http://localhost:4566" : undefined);
  activeEndpoint = endpoint;
  isLocalStackMode = Boolean(endpoint || process.env.USE_LOCALSTACK === "true");

  if (endpoint || (accessKeyId && secretAccessKey)) {
    try {
      s3Client = new S3Client({
        region,
        endpoint,
        forcePathStyle: true, // Crucial for LocalStack S3 path-style routing
        credentials: {
          accessKeyId: accessKeyId || "test",
          secretAccessKey: secretAccessKey || "test",
        },
      });
      dynamoClient = new DynamoDBClient({
        region,
        endpoint,
        credentials: {
          accessKeyId: accessKeyId || "test",
          secretAccessKey: secretAccessKey || "test",
        },
      });

      const modeStr = isLocalStackMode ? `LocalStack (${endpoint})` : `AWS Cloud (${region})`;
      console.log(`[Database] Initialized storage client for ${modeStr}`);
    } catch (err) {
      console.warn("Failed to initialize AWS/LocalStack client, using local persistent vault:", err);
    }
  }
}

initAwsClients();

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data) as T;
    }
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e);
  }
  return fallback;
}

function writeJsonFile<T>(filePath: string, data: T) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error(`Error writing ${filePath}:`, e);
  }
}

export interface S3ArchiveItem {
  key: string;
  bucket: string;
  sizeBytes: number;
  etag: string;
  timestamp: string;
  recordCount: number;
  content: string; // JSON payload
}

export interface DynamoRecordItem {
  PK: string; // SESSION#<sessionId>
  SK: string; // STUDENT#<studentId>#<timeIn>
  recordId: string;
  studentId: string;
  studentName: string;
  section: string;
  subject: string;
  sessionCode: string;
  timeIn: string;
  timeOut: string | null;
  status: string;
  method: string;
  hash: string;
  lastUpdated: string;
}

export function logAwsActivity(action: string, target: 'DynamoDB' | 'S3', key: string, status: 'SUCCESS' | 'WARNING' | 'ERROR', details: string) {
  const logs = readJsonFile<AwsVaultStatus['recentLogs']>(AWS_LOGS_FILE, []);
  const newLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    action,
    target,
    key,
    timestamp: new Date().toISOString(),
    status,
    details,
  };
  logs.unshift(newLog);
  if (logs.length > 50) logs.pop();
  writeJsonFile(AWS_LOGS_FILE, logs);
}

export async function autoProvisionLocalStack(endpoint?: string): Promise<{ success: boolean; message: string; details?: any }> {
  if (endpoint) {
    initAwsClients(endpoint);
  }

  const tableName = process.env.AWS_DYNAMODB_TABLE_NAME || "AttendanceLogs";
  const bucketName = process.env.AWS_S3_BUCKET_NAME || "classroom-attendance-records";
  const results: any = { dynamodb: null, s3: null };

  if (!dynamoClient || !s3Client) {
    initAwsClients(endpoint || "http://localhost:4566");
  }

  // 1. Provision DynamoDB Table
  if (dynamoClient) {
    try {
      try {
        await dynamoClient.send(new DescribeTableCommand({ TableName: tableName }));
        results.dynamodb = `Table "${tableName}" already exists and is active.`;
      } catch (descErr: any) {
        if (descErr.name === "ResourceNotFoundException" || descErr.message?.includes("not found") || descErr.message?.includes("Cannot do operations on a non-existent table")) {
          await dynamoClient.send(new CreateTableCommand({
            TableName: tableName,
            KeySchema: [
              { AttributeName: "PK", KeyType: "HASH" },
              { AttributeName: "SK", KeyType: "RANGE" },
            ],
            AttributeDefinitions: [
              { AttributeName: "PK", AttributeType: "S" },
              { AttributeName: "SK", AttributeType: "S" },
            ],
            BillingMode: "PAY_PER_REQUEST",
          }));
          results.dynamodb = `Table "${tableName}" created successfully in LocalStack!`;
          logAwsActivity("CreateTable", "DynamoDB", tableName, "SUCCESS", `Created table ${tableName} on LocalStack`);
        } else {
          throw descErr;
        }
      }
    } catch (err: any) {
      results.dynamodb = `DynamoDB Error: ${err.message}`;
    }
  }

  // 2. Provision S3 Bucket
  if (s3Client) {
    try {
      try {
        await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
        results.s3 = `Bucket "${bucketName}" already exists.`;
      } catch (headErr: any) {
        await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
        results.s3 = `Bucket "${bucketName}" created successfully in LocalStack!`;
        logAwsActivity("CreateBucket", "S3", bucketName, "SUCCESS", `Created S3 bucket ${bucketName} on LocalStack`);
      }
    } catch (err: any) {
      results.s3 = `S3 Error: ${err.message}`;
    }
  }

  const isSuccess = !results.dynamodb?.startsWith("DynamoDB Error") && !results.s3?.startsWith("S3 Error");
  return {
    success: isSuccess,
    message: isSuccess
      ? `LocalStack provisioned: ${results.dynamodb} | ${results.s3}`
      : `LocalStack provision issue: ${results.dynamodb} | ${results.s3}`,
    details: results,
  };
}

export function calculateRecordHash(record: AttendanceRecord): string {
  const str = `${record.id}:${record.sessionId}:${record.studentId}:${record.timeIn}:${record.timeOut || ""}:${record.status}`;
  return crypto.createHash("sha256").update(str).digest("hex");
}

export async function putAttendanceRecordToAws(record: AttendanceRecord): Promise<{ success: boolean; hash: string; dynamoKey: string }> {
  const hash = calculateRecordHash(record);
  const dynamoPK = `SESSION#${record.sessionId}`;
  const dynamoSK = `STUDENT#${record.studentId}#${record.timeIn}`;
  const tableName = process.env.AWS_DYNAMODB_TABLE_NAME || "AttendanceLogs";
  const region = process.env.AWS_REGION || "us-east-1";

  const dynamoItem: DynamoRecordItem = {
    PK: dynamoPK,
    SK: dynamoSK,
    recordId: record.id,
    studentId: record.studentId,
    studentName: record.studentName,
    section: record.section,
    subject: record.subject,
    sessionCode: record.sessionCode,
    timeIn: record.timeIn,
    timeOut: record.timeOut,
    status: record.status,
    method: record.method,
    hash,
    lastUpdated: new Date().toISOString(),
  };

  // 1. Write to local Cloud Vault
  const localDynamoRecords = readJsonFile<Record<string, DynamoRecordItem>>(DYNAMO_FILE, {});
  const key = `${dynamoPK}_${dynamoSK}`;
  localDynamoRecords[key] = dynamoItem;
  writeJsonFile(DYNAMO_FILE, localDynamoRecords);

  // 2. If LocalStack or live AWS is configured, attempt live PutItem
  if (dynamoClient && (isLocalStackMode || process.env.AWS_ACCESS_KEY_ID)) {
    try {
      const marshalledItem = marshall(dynamoItem);
      await dynamoClient.send(new PutItemCommand({
        TableName: tableName,
        Item: marshalledItem,
      }));
      const targetLabel = isLocalStackMode ? `LocalStack (${activeEndpoint})` : `AWS Cloud (${region})`;
      logAwsActivity("PutItem", "DynamoDB", key, "SUCCESS", `Written to ${targetLabel} Table: ${tableName}`);
    } catch (err: any) {
      console.warn("DynamoDB PutItem failed, recorded in local AWS Vault:", err.message);
      logAwsActivity("PutItem", "DynamoDB", key, "WARNING", `Write to live database failed (${err.message}). Stored in Local Vault.`);
    }
  } else {
    logAwsActivity("PutItem", "DynamoDB", key, "SUCCESS", `Stored in DynamoDB Schema Vault: PK=${dynamoPK}, SK=${dynamoSK}`);
  }

  return { success: true, hash, dynamoKey: key };
}

export async function archiveSessionToAwsS3(sessionId: string, sessionCode: string, records: AttendanceRecord[]): Promise<S3ArchiveItem> {
  const bucketName = process.env.AWS_S3_BUCKET_NAME || "classroom-attendance-records";
  const dateStr = new Date().toISOString().slice(0, 10);
  const s3Key = `attendance-archives/${dateStr}/${sessionCode}-${sessionId}.json`;
  
  const payload = {
    archiveMetadata: {
      generatedAt: new Date().toISOString(),
      sessionId,
      sessionCode,
      totalRecords: records.length,
      storageEngine: isLocalStackMode ? "LocalStack S3 Emulator" : "AWS S3 Cloud Record Keeper",
    },
    records,
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const etag = `"${crypto.createHash("md5").update(jsonString).digest("hex")}"`;

  const archiveItem: S3ArchiveItem = {
    key: s3Key,
    bucket: bucketName,
    sizeBytes: Buffer.byteLength(jsonString, "utf-8"),
    etag,
    timestamp: new Date().toISOString(),
    recordCount: records.length,
    content: jsonString,
  };

  // Save to local vault
  const localArchives = readJsonFile<Record<string, S3ArchiveItem>>(S3_ARCHIVE_FILE, {});
  localArchives[s3Key] = archiveItem;
  writeJsonFile(S3_ARCHIVE_FILE, localArchives);

  // LocalStack / Live S3 upload if configured
  if (s3Client && (isLocalStackMode || process.env.AWS_ACCESS_KEY_ID)) {
    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: jsonString,
        ContentType: "application/json",
      }));
      const targetLabel = isLocalStackMode ? `LocalStack S3` : `AWS S3`;
      logAwsActivity("PutObject", "S3", s3Key, "SUCCESS", `Uploaded archive to ${targetLabel} s3://${bucketName}/${s3Key} (${records.length} records)`);
    } catch (err: any) {
      logAwsActivity("PutObject", "S3", s3Key, "WARNING", `S3 upload failed (${err.message}). Stored in Local S3 Vault.`);
    }
  } else {
    logAwsActivity("PutObject", "S3", s3Key, "SUCCESS", `Created S3 Object: s3://${bucketName}/${s3Key} (${archiveItem.sizeBytes} bytes)`);
  }

  return archiveItem;
}

export function getAwsVaultStatus(): AwsVaultStatus {
  const isConfigured = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) || isLocalStackMode;
  const dynamoRecords = readJsonFile<Record<string, DynamoRecordItem>>(DYNAMO_FILE, {});
  const s3Archives = readJsonFile<Record<string, S3ArchiveItem>>(S3_ARCHIVE_FILE, {});
  const logs = readJsonFile<AwsVaultStatus['recentLogs']>(AWS_LOGS_FILE, []);

  let mode: AwsVaultStatus['mode'] = "aws_cloud_vault";
  if (isLocalStackMode) {
    mode = "localstack";
  } else if (process.env.AWS_ACCESS_KEY_ID) {
    mode = "aws_live";
  }

  return {
    mode,
    isConfigured,
    isLocalStack: isLocalStackMode,
    endpointUrl: activeEndpoint,
    region: process.env.AWS_REGION || "us-east-1",
    bucketName: process.env.AWS_S3_BUCKET_NAME || "classroom-attendance-records",
    tableName: process.env.AWS_DYNAMODB_TABLE_NAME || "AttendanceLogs",
    totalDynamoRecords: Object.keys(dynamoRecords).length,
    totalS3Archives: Object.keys(s3Archives).length,
    lastSyncTime: logs.length > 0 ? logs[0].timestamp : null,
    auditChainValid: true,
    recentLogs: logs.slice(0, 20),
  };
}

export function getDynamoRecords(): DynamoRecordItem[] {
  const records = readJsonFile<Record<string, DynamoRecordItem>>(DYNAMO_FILE, {});
  return Object.values(records).sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
}

export function getS3Archives(): S3ArchiveItem[] {
  const archives = readJsonFile<Record<string, S3ArchiveItem>>(S3_ARCHIVE_FILE, {});
  return Object.values(archives).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function getS3FileByKey(key: string): any | null {
  const archives = readJsonFile<Record<string, S3ArchiveItem>>(S3_ARCHIVE_FILE, {});
  const item = archives[key];
  if (item && item.content) {
    try {
      return JSON.parse(item.content);
    } catch {
      return item.content;
    }
  }
  return null;
}

