import { useState, useRef, useCallback, useEffect } from "react";
import axios from "axios";
import jsQR from "jsqr";

import { Capacitor } from "@capacitor/core";
const API_BASE = Capacitor.isNativePlatform() ? "http://192.168.29.195:5000/api" : "/api";

import {
  Shield, QrCode, Upload, Camera, CheckCircle, AlertTriangle, XCircle,
  LayoutDashboard, Users, ScanLine, BadgeCheck, HelpCircle, AlertOctagon,
  TrendingUp, Clock, LogOut, Activity, ChevronRight, Hash, RefreshCw,
  Eye, Download, Filter, Menu, X, Wifi, WifiOff, Zap
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────────
type ScanStatus = "Safe" | "Warning" | "High Risk";
type MerchantStatus = "Verified" | "Unknown";
type HashStatus = "Matched" | "Mismatched";

interface ScanResult {
  id: string;
  merchantName: string;
  upiId: string;
  merchantStatus: MerchantStatus;
  hashStatus: HashStatus;
  trustScore: number;
  finalStatus: ScanStatus;
  timestamp: Date;
  amount?: number;
}

interface DashboardData {
  totalMerchants: number;
  totalScans: number;
  safeScans: number;
  highRisk: number;
}

interface BarcodeDetectorResult {
  rawValue?: string;
}

interface BarcodeDetectorLike {
  detect: (source: ImageBitmapSource) => Promise<BarcodeDetectorResult[]>;
}

interface JsQrCode {
  data: string;
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

// ── Mock Merchant Database ─────────────────────────────────────────────────────
const SAMPLE_QR_IDS = [
  "abctea@okaxis",
  "xyz@okaxis",
  "coffee@okaxis",
  "fake@okaxis",
];

function getUpiIdFromQrValue(rawValue: string): string | null {
  const value = rawValue.trim();

  if (!value) return null;
  if (SAMPLE_QR_IDS.includes(value)) return value;

  const upiMatch = value.match(/(?:^|[?&])pa=([^&]+)/i);
  if (upiMatch?.[1]) return decodeURIComponent(upiMatch[1]);

  const textMatch = SAMPLE_QR_IDS.find((sampleId) => value.toLowerCase().includes(sampleId.toLowerCase()));
  if (textMatch) return textMatch;

  return value.includes("@") ? value : null;
}

function getHistorySignature(scan: ScanResult): string {
  return [
    scan.id,
    scan.merchantName,
    scan.upiId,
    scan.merchantStatus,
    scan.hashStatus,
    scan.trustScore,
    scan.finalStatus,
    scan.timestamp.toISOString(),
  ].join("|");
}

function dedupeHistoryEntries(scans: ScanResult[]): ScanResult[] {
  const deduped: ScanResult[] = [];
  const seen = new Set<string>();

  for (const scan of scans) {
    const signature = getHistorySignature(scan);
    if (seen.has(signature)) continue;
    seen.add(signature);
    deduped.push(scan);
  }

  return deduped.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

async function decodeQrFromImageFile(file: File): Promise<string | null> {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Unable to load image"));
      img.src = imageUrl;
    });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) return null;

    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, canvas.width, canvas.height) as JsQrCode | null;

    return code?.data?.trim() || null;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

// ── Workflow Engine ────────────────────────────────────────────────────────────
async function simulateSHA512(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 12);
}

async function processQRWorkflow(upiId: string): Promise<ScanResult> {

  const response = await axios.post(
    `${API_BASE}/scan`,
    {
      upiId
    }
  );

  const data = response.data;

  return {

    id: Math.random().toString(36).slice(2, 10).toUpperCase(),

    merchantName: data.merchantName,

    upiId: data.upiId,

    merchantStatus: data.merchantStatus,

    hashStatus: data.hashStatus,

    trustScore: data.trustScore,

    finalStatus: data.finalStatus,

    timestamp: new Date()

  };

}

// ── Chart Data ─────────────────────────────────────────────────────────────────
const AREA_DATA = [
  { time: "00:00", scans: 4, fraud: 1 }, { time: "04:00", scans: 2, fraud: 0 },
  { time: "08:00", scans: 18, fraud: 3 }, { time: "12:00", scans: 35, fraud: 8 },
  { time: "16:00", scans: 28, fraud: 5 }, { time: "20:00", scans: 22, fraud: 4 },
  { time: "23:59", scans: 12, fraud: 2 },
];

const BAR_DATA = [
  { day: "Mon", safe: 42, warning: 8, risk: 5 }, { day: "Tue", safe: 38, warning: 12, risk: 3 },
  { day: "Wed", safe: 55, warning: 6, risk: 7 }, { day: "Thu", safe: 31, warning: 15, risk: 9 },
  { day: "Fri", safe: 67, warning: 9, risk: 4 }, { day: "Sat", safe: 24, warning: 5, risk: 2 },
  { day: "Sun", safe: 19, warning: 3, risk: 1 },
];

const PIE_DATA = [
  { name: "Verified", value: 68 }, { name: "Unknown", value: 22 }, { name: "High Risk", value: 10 },
];
const PIE_COLORS = ["#10b981", "#f59e0b", "#ef4444"];

// ── Utility Components ─────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: ScanStatus }) {
  const config = {
    Safe: { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle },
    Warning: { cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: AlertTriangle },
    "High Risk": { cls: "bg-red-500/15 text-red-400 border-red-500/30", icon: XCircle },
  }[status] || { cls: "bg-red-500/15 text-red-400 border-red-500/30", icon: AlertTriangle };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold border ${config.cls}`}>
      <Icon size={11} />
      {(status || 'Unknown').toUpperCase()}
    </span>
  );
}

function MerchantBadge({ status }: { status: MerchantStatus }) {
  return status === "Verified"
    ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30"><BadgeCheck size={11} />VERIFIED</span>
    : <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-gray-500/15 text-gray-400 border border-gray-500/30"><HelpCircle size={11} />UNKNOWN</span>;
}

function HashBadge({ status }: { status: HashStatus }) {
  return status === "Matched"
    ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"><Hash size={11} />MATCHED</span>
    : <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-red-500/15 text-red-400 border border-red-500/30"><Hash size={11} />MISMATCH</span>;
}

function TrustScoreRing({ score }: { score: number }) {
  const r = 48;
  const circ = 2 * Math.PI * r;
  const dash = circ * (score / 100);
  const color = score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      <svg width="128" height="128" className="-rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#1a2540" strokeWidth="10" />
        <circle
          cx="64" cy="64" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s ease, stroke 0.4s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold font-mono" style={{ color }}>{score}</span>
        <span className="text-xs text-muted-foreground font-mono">/ 100</span>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, delta, color }: {
  icon: React.ElementType; label: string; value: string | number; delta?: string; color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-start gap-4 hover:border-blue-500/30 transition-colors">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
        <p className="text-2xl font-bold text-foreground font-mono">{value}</p>
        {delta && <p className="text-xs text-emerald-400 mt-1">{delta}</p>}
      </div>
    </div>
  );
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(d: Date) {
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ── Processing Overlay ─────────────────────────────────────────────────────────
function ProcessingOverlay({ stage }: { stage: string }) {
  const stages = [
    "Reading QR Data",
    "Contacting Backend API",
    "Merchant Verification",
    "SHA-512 Hash Check",
    "Computing Trust Score",
    "Storing Scan Record",
  ];
  const current = stages.indexOf(stage);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-card border border-border rounded-2xl p-8 w-full max-w-sm mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
            <Shield size={16} className="text-blue-400" />
          </div>
          <span className="font-semibold text-foreground">Security Analysis</span>
        </div>
        <div className="space-y-3">
          {stages.map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                i < current ? "bg-emerald-500 border-emerald-500" :
                i === current ? "border-blue-400 animate-pulse" :
                "border-secondary"
              }`}>
                {i < current && <CheckCircle size={12} className="text-white" />}
                {i === current && <div className="w-2 h-2 rounded-full bg-blue-400" />}
              </div>
              <span className={`text-sm font-mono transition-colors duration-300 ${
                i <= current ? "text-foreground" : "text-muted-foreground"
              }`}>{s}</span>
              {i === current && (
                <span className="ml-auto text-xs text-blue-400 animate-pulse font-mono">Running...</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Result Card ────────────────────────────────────────────────────────────────
function ResultCard({ result, onClose }: { result: ScanResult; onClose: () => void }) {
  const borderColor = result.finalStatus === "Safe"
    ? "border-emerald-500/40" : result.finalStatus === "Warning"
    ? "border-amber-500/40" : "border-red-500/40";

  return (
    <div className={`bg-card border ${borderColor} rounded-2xl p-6 shadow-xl`}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-mono text-muted-foreground tracking-widest uppercase mb-1">Scan ID #{result.id}</p>
          <h3 className="text-lg font-semibold text-foreground">{result.merchantName}</h3>
          <p className="text-sm font-mono text-muted-foreground">{result.upiId}</p>
        </div>
        <StatusBadge status={result.finalStatus} />
      </div>

      <div className="flex items-center justify-between mb-6">
        <TrustScoreRing score={result.trustScore} />
        <div className="flex-1 pl-6 space-y-3">
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase mb-1.5">Merchant Status</p>
            <MerchantBadge status={result.merchantStatus} />
          </div>
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase mb-1.5">Hash Integrity</p>
            <HashBadge status={result.hashStatus} />
          </div>
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase mb-1.5">Timestamp</p>
            <p className="text-xs font-mono text-foreground">{result.timestamp.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className={`rounded-lg p-3 text-sm font-mono mb-4 ${
        result.finalStatus === "Safe" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
        result.finalStatus === "Warning" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
        "bg-red-500/10 text-red-400 border border-red-500/20"
      }`}>
        {result.finalStatus === "Safe" && "✓ This merchant is verified and the QR code is authentic. Safe to proceed."}
        {result.finalStatus === "Warning" && "⚠ Merchant could not be fully verified. Proceed with caution and verify independently."}
        {result.finalStatus === "High Risk" && "✗ This QR code shows signs of fraud. Do NOT make this payment."}
      </div>

      <button onClick={onClose}
        className="w-full py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-mono hover:bg-muted transition-colors">
        Scan Another QR Code
      </button>
    </div>
  );
}

// ── QR Scanner UI ──────────────────────────────────────────────────────────────
type ScanPhase = "idle" | "processing" | "result";

function UserPortal({ history, setHistory, onScanComplete }: {
  history: ScanResult[];
  setHistory: React.Dispatch<React.SetStateAction<ScanResult[]>>;
  onScanComplete: () => Promise<void>;
}) {
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [processingStage, setProcessingStage] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scannerMessage, setScannerMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const isProcessingScanRef = useRef(false);

  const runWorkflow = useCallback(async (upiId: string) => {
    if (isProcessingScanRef.current) return;

    isProcessingScanRef.current = true;
    setPhase("processing");
    setScannerMessage(`QR detected: ${upiId}`);
    const stages = [
      "Reading QR Data", "Contacting Backend API", "Merchant Verification",
      "SHA-512 Hash Check", "Computing Trust Score", "Storing Scan Record",
    ];
    try {
      for (const s of stages) {
        setProcessingStage(s);
        await new Promise((r) => setTimeout(r, 280));
      }
      const res = await processQRWorkflow(upiId);
      setResult(res);
      setPhase("result");
      stopCamera();
      await onScanComplete();
    } catch (err: any) {
      console.error(err);
      setPhase("idle");
      setScannerMessage("");
      setCameraError(`Network Error! Tried hitting: ${API_BASE}/scan. Original error: ${err.message}`);
    } finally {
      isProcessingScanRef.current = false;
    }
  }, [onScanComplete]);

  const handleScanRandom = () => {
    const id = SAMPLE_QR_IDS[Math.floor(Math.random() * SAMPLE_QR_IDS.length)];
    runWorkflow(id);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    void (async () => {
      try {
        setCameraError("");
        setScannerMessage("Reading uploaded QR image...");

        const rawValue = await decodeQrFromImageFile(file);
        const upiId = getUpiIdFromQrValue(rawValue ?? "");

        if (!upiId) {
          setScannerMessage("");
          setCameraError("Could not read a valid QR/UPI value from this image. Please upload a clearer QR code.");
          return;
        }

        await runWorkflow(upiId);
      } catch {
        setScannerMessage("");
        setCameraError("Failed to process the uploaded QR image. Please try another image.");
      } finally {
        input.value = "";
      }
    })();
  };

  useEffect(() => {
    if (!cameraActive || !videoRef.current || !streamRef.current) return;

    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.muted = true;

    void video.play().catch(() => {
      setCameraError("Unable to start camera preview. Please allow camera access and try again.");
    });
  }, [cameraActive]);

  useEffect(() => {
    if (!cameraActive || phase !== "idle") return;
    if (!detectorRef.current) {
      detectorRef.current = window.BarcodeDetector
        ? new window.BarcodeDetector({ formats: ["qr_code"] })
        : null;
    }

    let cancelled = false;

    const detectFromVideoFrame = async (video: HTMLVideoElement): Promise<string | null> => {
      if (detectorRef.current) {
        const barcodes = await detectorRef.current.detect(video);
        return barcodes[0]?.rawValue?.trim() || null;
      }

      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
      }

      const canvas = canvasRef.current;
      const width = video.videoWidth;
      const height = video.videoHeight;

      if (!width || !height) return null;

      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return null;

      context.drawImage(video, 0, 0, width, height);
      const imageData = context.getImageData(0, 0, width, height);
      const code = jsQR(imageData.data, width, height) as JsQrCode | null;

      return code?.data?.trim() || null;
    };

    const scanVideoFrame = async () => {
      if (
        cancelled ||
        !cameraActive ||
        phase !== "idle" ||
        isProcessingScanRef.current ||
        !videoRef.current ||
        videoRef.current.readyState < 2
      ) {
        scanFrameRef.current = window.requestAnimationFrame(scanVideoFrame);
        return;
      }

      try {
        const rawValue = await detectFromVideoFrame(videoRef.current);
        const upiId = getUpiIdFromQrValue(rawValue ?? "");

        if (upiId) {
          setScannerMessage(`QR detected: ${upiId}`);
          void runWorkflow(upiId);
          return;
        }

        setScannerMessage("Point the QR code inside the frame to scan automatically.");
      } catch {
        setScannerMessage("Trying to detect QR code...");
      }

      if (!cancelled) {
        scanFrameRef.current = window.requestAnimationFrame(scanVideoFrame);
      }
    };

    setScannerMessage(
      detectorRef.current
        ? "Point the QR code inside the frame to scan automatically."
        : "Point the QR code clearly at the camera. Fallback scanner is active."
    );
    scanFrameRef.current = window.requestAnimationFrame(scanVideoFrame);

    return () => {
      cancelled = true;
      if (scanFrameRef.current !== null) {
        window.cancelAnimationFrame(scanFrameRef.current);
        scanFrameRef.current = null;
      }
    };
  }, [cameraActive, phase, runWorkflow]);

  useEffect(() => {
    return () => {
      if (scanFrameRef.current !== null) {
        window.cancelAnimationFrame(scanFrameRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const startCamera = async () => {
    try {
      setCameraError("");
      setScannerMessage("Opening camera...");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setCameraActive(true);
    } catch {
      streamRef.current = null;
      setCameraActive(false);
      setCameraError("Camera access failed. Please allow permission in your browser and try again.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
    setCameraError("");
    setScannerMessage("");
  };

  const handleReset = () => {
    setPhase("idle");
    setResult(null);
    setScannerMessage("");
  };

  return (
    <div className="min-h-screen bg-background">
      {phase === "processing" && <ProcessingOverlay stage={processingStage} />}

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-background to-background" />
        <div className="absolute inset-0" style={{
          backgroundImage: "radial-gradient(circle at 20% 50%, rgba(37,99,235,0.08) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(37,99,235,0.05) 0%, transparent 50%)"
        }} />
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "linear-gradient(rgba(37,99,235,1) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,1) 1px, transparent 1px)",
          backgroundSize: "60px 60px"
        }} />

        <div className="relative max-w-6xl mx-auto px-6 py-16">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Shield size={16} className="text-white" />
            </div>
            <span className="text-sm font-mono text-muted-foreground tracking-widest uppercase">SecureQR · v2.4.1</span>
            <span className="ml-auto flex items-center gap-1.5 text-xs font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              System Online
            </span>
          </div>

          <div className="max-w-2xl">
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-4 leading-tight" style={{ fontFamily: "Rajdhani, sans-serif" }}>
              QR Code &amp; UPI<br />
              <span className="text-blue-400">Fraud Detection</span>
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed mb-8">
              AI-powered merchant verification with SHA-512 hash integrity checks.
              Scan before you pay — protect your money in real time.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                <Zap size={12} className="text-blue-400" /> Real-time verification
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                <Hash size={12} className="text-blue-400" /> SHA-512 integrity
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                <Activity size={12} className="text-blue-400" /> Trust scoring
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Scanner Section */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Left: Scanner */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-foreground font-mono uppercase tracking-widest flex items-center gap-2">
              <ScanLine size={16} className="text-blue-400" /> Scanning QR Code
            </h2>

            {phase === "result" && result ? (
              <ResultCard result={result} onClose={handleReset} />
            ) : (
              <>
                {/* Camera / QR area */}
                <div className="relative bg-card border border-border rounded-2xl overflow-hidden aspect-square max-h-72 flex items-center justify-center">
                  {cameraActive ? (
                    <>
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-48 h-48 relative">
                          {["top-left", "top-right", "bottom-left", "bottom-right"].map((pos) => (
                            <div key={pos} className={`absolute w-8 h-8 border-blue-400 border-2 ${
                              pos.includes("top") ? "top-0" : "bottom-0"
                            } ${pos.includes("left") ? "left-0 border-right-0 border-b-0" : "right-0 border-left-0 border-b-0"}`}
                              style={{
                                borderRight: pos === "top-left" || pos === "bottom-left" ? "none" : undefined,
                                borderLeft: pos === "top-right" || pos === "bottom-right" ? "none" : undefined,
                                borderBottom: pos.includes("top") ? "none" : undefined,
                                borderTop: pos.includes("bottom") ? "none" : undefined,
                              }}
                            />
                          ))}
                          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-blue-400/60 animate-bounce" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-muted-foreground p-8">
                      <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                        <QrCode size={28} className="text-blue-400" />
                      </div>
                      <p className="text-sm font-mono text-center">Camera inactive.<br />Use controls below to scan.</p>
                    </div>
                  )}
                </div>

                {cameraError && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {cameraError}
                  </div>
                )}

                {cameraActive && scannerMessage && (
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
                    {scannerMessage}
                  </div>
                )}

                {/* Controls */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={cameraActive ? undefined : startCamera}
                    disabled={cameraActive}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
                  >
                    <Camera size={16} />
                    {cameraActive ? "Scanning..." : "Scan QR Code"}
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-secondary hover:bg-muted border border-border text-secondary-foreground text-sm font-semibold transition-colors"
                  >
                    <Upload size={16} />
                    Upload Image
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                </div>

                {cameraActive && (
                  <button onClick={stopCamera}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-secondary text-muted-foreground text-sm font-mono hover:text-foreground transition-colors border border-border">
                    <WifiOff size={14} /> Stop Camera
                  </button>
                )}

                {/* Demo buttons */}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs font-mono text-muted-foreground mb-3 uppercase tracking-wider">Demo Scenarios</p>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { label: "ABC Tea Shop", id: "abctea@okaxis", color: "text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10" },
                      { label: "XYZ Store", id: "xyz@okaxis", color: "text-amber-400 border-amber-500/30 hover:bg-amber-500/10" },
                      { label: "Coffee House", id: "coffee@okaxis", color: "text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10" },
                      { label: "Fake QR", id: "fake@okaxis", color: "text-red-400 border-red-500/30 hover:bg-red-500/10" },
                    ].map(({ label, id, color }) => (
                      <button key={id} onClick={() => runWorkflow(id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono border bg-transparent transition-colors ${color}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right: Scan History */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-foreground font-mono uppercase tracking-widest flex items-center gap-2">
              <Clock size={16} className="text-blue-400" /> Recent Scans
            </h2>

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">Merchant</th>
                      <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Score</th>
                      <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider hidden md:table-cell">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(0, 8).map((scan, i) => (
                      <tr key={scan.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${i === 0 ? "bg-blue-500/5" : ""}`}>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-foreground font-medium text-xs">{scan.merchantName}</p>
                            <p className="text-muted-foreground font-mono text-xs">{scan.upiId}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className={`font-mono font-bold text-sm ${
                            scan.trustScore >= 80 ? "text-emerald-400" :
                            scan.trustScore >= 50 ? "text-amber-400" : "text-red-400"
                          }`}>{scan.trustScore}</span>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={scan.finalStatus} /></td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground hidden md:table-cell">
                          <div>{formatTime(scan.timestamp)}</div>
                          <div>{formatDate(scan.timestamp)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Admin Dashboard ────────────────────────────────────────────────────────────
type AdminPage = "overview" | "scans" | "merchants" | "hashes";

function AdminDashboard({ history, dashboard, merchants }: {
  history: ScanResult[];
  dashboard: DashboardData;
  merchants: any[];
}) {
  const [page, setPage] = useState<AdminPage>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const total = history.length;
  const verified = history.filter((s) => s.merchantStatus === "Verified").length;
  const mismatches = history.filter((s) => s.hashStatus === "Mismatched").length;
  const highRisk = history.filter((s) => s.finalStatus === "High Risk").length;

  const navItems: { id: AdminPage; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "scans", label: "Scan Logs", icon: ScanLine },
    { id: "merchants", label: "Merchants", icon: Users },
    { id: "hashes", label: "Hash Registry", icon: Hash },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar overlay mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-200
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:relative lg:translate-x-0 lg:z-auto`}>
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Shield size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground" style={{ fontFamily: "Rajdhani, sans-serif" }}>SecureQR</p>
              <p className="text-xs font-mono text-muted-foreground">Admin Console</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setPage(id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                page === id
                  ? "bg-blue-600 text-white"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
              }`}>
              <Icon size={16} />
              <span className="font-mono">{label}</span>
              {page === id && <ChevronRight size={14} className="ml-auto" />}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> System Online
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 border-b border-border bg-card flex items-center gap-4 px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-muted-foreground hover:text-foreground">
            <Menu size={20} />
          </button>
          <div>
            <h2 className="text-sm font-semibold text-foreground font-mono capitalize">{page}</h2>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs font-mono text-muted-foreground hidden sm:block">
              {new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
            </span>
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">A</div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {page === "overview" && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Users} label="Total Merchants" value={dashboard.totalMerchants} delta="+2 this week" color="bg-blue-500/15 text-blue-400" />
                <StatCard icon={ScanLine} label="Total Scans" value={dashboard.totalScans} delta={`+${Math.max(1, Math.floor(dashboard.totalScans * 0.1))} today`} color="bg-violet-500/15 text-violet-400" />
                <StatCard icon={BadgeCheck} label="Verified QR" value={verified} color="bg-emerald-500/15 text-emerald-400" />
                <StatCard icon={AlertOctagon} label="Hash Mismatches" value={mismatches} color="bg-red-500/15 text-red-400" />
              </div>

              {/* Secondary stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={HelpCircle} label="Unknown Merchants" value={total - verified} color="bg-amber-500/15 text-amber-400" />
                <StatCard icon={CheckCircle} label="Safe Transactions" value={dashboard.safeScans} color="bg-emerald-500/15 text-emerald-400" />
                <StatCard icon={XCircle} label="High Risk Detected" value={dashboard.highRisk} color="bg-red-500/15 text-red-400" />
                <StatCard icon={TrendingUp} label="Fraud Rate" value={`${total > 0 ? Math.round((highRisk / total) * 100) : 0}%`} color="bg-orange-500/15 text-orange-400" />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Area chart */}
                <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-4">Scan Activity — Today</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={AREA_DATA}>
                      <defs>
                        <linearGradient id="gradScans" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradFraud" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(37,99,235,0.1)" />
                      <XAxis dataKey="time" tick={{ fill: "#6b82a8", fontSize: 11, fontFamily: "JetBrains Mono" }} />
                      <YAxis tick={{ fill: "#6b82a8", fontSize: 11, fontFamily: "JetBrains Mono" }} />
                      <Tooltip contentStyle={{ background: "#0f1629", border: "1px solid rgba(37,99,235,0.3)", borderRadius: 8, fontFamily: "JetBrains Mono", fontSize: 12 }} />
                      <Area type="monotone" dataKey="scans" name="Total Scans" stroke="#3b82f6" fill="url(#gradScans)" strokeWidth={2} />
                      <Area type="monotone" dataKey="fraud" name="Fraud Alerts" stroke="#ef4444" fill="url(#gradFraud)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Pie chart */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-4">Merchant Distribution</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                        dataKey="value" paddingAngle={3}>
                        {PIE_DATA.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#0f1629", border: "1px solid rgba(37,99,235,0.3)", borderRadius: 8, fontFamily: "JetBrains Mono", fontSize: 12 }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "#6b82a8" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bar chart */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-4">Weekly Scan Status Breakdown</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={BAR_DATA} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(37,99,235,0.1)" />
                    <XAxis dataKey="day" tick={{ fill: "#6b82a8", fontSize: 11, fontFamily: "JetBrains Mono" }} />
                    <YAxis tick={{ fill: "#6b82a8", fontSize: 11, fontFamily: "JetBrains Mono" }} />
                    <Tooltip contentStyle={{ background: "#0f1629", border: "1px solid rgba(37,99,235,0.3)", borderRadius: 8, fontFamily: "JetBrains Mono", fontSize: 12 }} />
                    <Bar dataKey="safe" name="Safe" fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="warning" name="Warning" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="risk" name="High Risk" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* Scan Logs Table */}
          {(page === "scans" || page === "overview") && page === "scans" && (
            <ScanLogsTable data={history} />
          )}

          {page === "merchants" && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-widest">Merchant Registry</h3>
                <span className="text-xs font-mono text-muted-foreground">{merchants.length} records</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["UPI ID", "Merchant Name", "Status", "Registered"].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {merchants.map((merchant: any) => (
                      <tr key={merchant.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3 font-mono text-xs text-foreground">{merchant.upi_id}</td>
                        <td className="px-5 py-3 font-medium text-foreground text-sm">{merchant.merchant_name}</td>
                        <td className="px-5 py-3"><MerchantBadge status="Verified" /></td>
                        <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                          {merchant.created_at ? formatDate(new Date(merchant.created_at)) : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page === "hashes" && (
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-4">SHA-512 Hash Registry</h3>
                <p className="text-xs font-mono text-muted-foreground mb-5 leading-relaxed">
                  Each registered merchant has a stored SHA-512 hash of their UPI ID. On each scan, the system recomputes the hash and compares it to detect tampering or QR code substitution.
                </p>
                <div className="space-y-3">
                  {merchants.map((merchant: any) => (
                    <div key={merchant.id} className="flex items-start gap-4 p-4 rounded-lg bg-muted/30 border border-border/50">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-emerald-500/15 text-emerald-400">
                        <Hash size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground mb-0.5">{merchant.merchant_name}</p>
                        <p className="text-xs font-mono text-muted-foreground mb-1">{merchant.upi_id}</p>
                        <p className="text-xs font-mono text-blue-400 truncate">REGISTERED: {merchant.created_at ? formatDate(new Date(merchant.created_at)) : ""}…</p>
                      </div>
                      <HashBadge status="Matched" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recent scans on overview */}
          {page === "overview" && (
            <ScanLogsTable data={history} limit={5} />
          )}
        </main>
      </div>
    </div>
  );
}

function ScanLogsTable({ data, limit }: { data: ScanResult[]; limit?: number }) {
  const rows = limit ? data.slice(0, limit) : data;
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-widest">Scan Logs</h3>
        <span className="text-xs font-mono text-muted-foreground">{data.length} total</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Scan ID", "Merchant", "UPI ID", "Merchant Status", "Hash", "Trust", "Status", "Time"].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((scan, i) => (
              <tr key={scan.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${i === 0 ? "bg-blue-500/5" : ""}`}>
                <td className="px-5 py-3 font-mono text-xs text-blue-400">#{scan.id}</td>
                <td className="px-5 py-3 font-medium text-foreground text-sm whitespace-nowrap">{scan.merchantName}</td>
                <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{scan.upiId}</td>
                <td className="px-5 py-3"><MerchantBadge status={scan.merchantStatus} /></td>
                <td className="px-5 py-3"><HashBadge status={scan.hashStatus} /></td>
                <td className="px-5 py-3">
                  <span className={`font-mono font-bold ${
                    scan.trustScore >= 80 ? "text-emerald-400" :
                    scan.trustScore >= 50 ? "text-amber-400" : "text-red-400"
                  }`}>{scan.trustScore}</span>
                </td>
                <td className="px-5 py-3"><StatusBadge status={scan.finalStatus} /></td>
                <td className="px-5 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap">
                  {formatTime(scan.timestamp)}, {formatDate(scan.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Root App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState<"user" | "admin">("user");
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData>({
    totalMerchants: 0,
    totalScans: 0,
    safeScans: 0,
    highRisk: 0,
  });
  const [merchants, setMerchants] = useState<any[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/history`);
      const formatted: ScanResult[] = res.data.map((item: any) => ({
        id: item.id.toString(),
        merchantName: item.merchant_name,
        upiId: item.upi_id,
        merchantStatus: item.merchant_status,
        hashStatus: item.hash_status,
        trustScore: item.trust_score,
        finalStatus: item.final_status,
        timestamp: new Date(item.scanned_at),
        amount: 0,
      }));
      setHistory(dedupeHistoryEntries(formatted));
    } catch (err) {
      console.error("Failed to load history", err);
    }
  }, []);

  const loadMerchants = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/merchants`);
      setMerchants(res.data);
    } catch (err) {
      console.error("Failed to load merchants", err);
    }
  }, []);

  useEffect(() => {
    const loadDashboard = async () => {
      const res = await axios.get(`${API_BASE}/dashboard`);
      setDashboard(res.data);
    };
    loadDashboard();
    loadHistory();
    loadMerchants();
  }, [loadHistory, loadMerchants]);

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Top Navigation */}
      <nav className="sticky top-0 z-20 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2 mr-4">
            <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
              <Shield size={14} className="text-white" />
            </div>
            <span className="font-bold text-foreground hidden sm:block" style={{ fontFamily: "Rajdhani, sans-serif" }}>SecureQR</span>
          </div>
          <div className="flex items-center bg-secondary rounded-lg p-1">
            <button onClick={() => setView("user")}
              className={`px-4 py-1.5 rounded-md text-sm font-mono transition-all ${
                view === "user" ? "bg-blue-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              User Portal
            </button>
            <button onClick={() => setView("admin")}
              className={`px-4 py-1.5 rounded-md text-sm font-mono transition-all ${
                view === "admin" ? "bg-blue-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              Admin Dashboard
            </button>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span className="hidden sm:flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Protected
            </span>
          </div>
        </div>
      </nav>

      {view === "user"
        ? <UserPortal history={history} setHistory={setHistory} onScanComplete={loadHistory} />
        : <AdminDashboard history={history} dashboard={dashboard} merchants={merchants} />
      }
    </div>
  );
}
