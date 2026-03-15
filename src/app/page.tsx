"use client";

import { useState, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Step =
  | "idle"
  | "parsing"
  | "researching"
  | "tailoring"
  | "coverLetter"
  | "qualityCheck"
  | "pdf"
  | "done"
  | "error";

interface ProgressState {
  step: Step;
  message: string;
}

interface GenerationResult {
  parsedResume: {
    name: string;
    contact: Record<string, string>;
    summary: string;
    experience: Array<{ title: string; company: string; dates: string; bullets: string[] }>;
    education: Array<{ degree?: string; school?: string; dates?: string }>;
    skills: string[];
    certifications: string[];
  };
  research: {
    company: string;
    role: string;
    companyOverview: string;
    atsKeywords: string[];
  };
  finalResume: string;
  finalCoverLetter: string;
  qualityCheckPassed: boolean;
  resumePDF: string;
  coverLetterPDF: string;
  jobTitle: string;
}

// ─── Step Configuration ─────────────────────────────────────────────────────────

const STEPS: Array<{ id: Step; label: string; icon: string }> = [
  { id: "parsing", label: "Parsing Resume", icon: "📄" },
  { id: "researching", label: "Researching Company", icon: "🔍" },
  { id: "tailoring", label: "Tailoring Resume", icon: "✏️" },
  { id: "coverLetter", label: "Writing Cover Letter", icon: "📝" },
  { id: "qualityCheck", label: "Quality Check", icon: "✅" },
  { id: "pdf", label: "Generating PDFs", icon: "📁" },
];

const STEP_ORDER: Step[] = [
  "parsing",
  "researching",
  "tailoring",
  "coverLetter",
  "qualityCheck",
  "pdf",
  "done",
];

function getStepIndex(step: Step): number {
  return STEP_ORDER.indexOf(step);
}

// ─── Progress Bar Component ─────────────────────────────────────────────────────

function ProgressBar({ progress }: { progress: ProgressState }) {
  const currentIdx = getStepIndex(progress.step);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-4 py-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full pulse-ring" />
          <span className="text-sm font-medium text-blue-700">{progress.message}</span>
        </div>
      </div>

      <div className="space-y-3">
        {STEPS.map((step) => {
          const stepIdx = getStepIndex(step.id);
          const isDone = currentIdx > stepIdx || progress.step === "done";
          const isActive = progress.step === step.id;

          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-300 ${
                isDone
                  ? "bg-green-50 border-green-200"
                  : isActive
                  ? "bg-blue-50 border-blue-300 shadow-sm"
                  : "bg-white border-slate-200 opacity-50"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  isDone
                    ? "bg-green-500 text-white"
                    : isActive
                    ? "bg-blue-500 text-white pulse-ring"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {isDone ? "✓" : step.icon}
              </div>
              <div className="flex-1">
                <div
                  className={`text-sm font-medium ${
                    isDone ? "text-green-700" : isActive ? "text-blue-700" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </div>
                {isActive && (
                  <div className="mt-1 h-1 rounded-full overflow-hidden bg-blue-100">
                    <div
                      className="h-full bg-blue-500 shimmer rounded-full"
                      style={{ width: "60%" }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Document Preview Component ─────────────────────────────────────────────────

function DocumentPreview({
  result,
  activeTab,
  setActiveTab,
}: {
  result: GenerationResult;
  activeTab: "resume" | "cover";
  setActiveTab: (tab: "resume" | "cover") => void;
}) {
  const downloadPDF = (base64: string, filename: string) => {
    const link = document.createElement("a");
    link.href = `data:application/pdf;base64,${base64}`;
    link.download = filename;
    link.click();
  };

  return (
    <div className="w-full">
      {result.qualityCheckPassed && (
        <div className="flex justify-center mb-4">
          <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-2">
            <span className="text-green-600">✓</span>
            <span className="text-sm font-medium text-green-700">
              Quality check passed — no hallucinations detected
            </span>
          </div>
        </div>
      )}

      {result.research && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">
            🔍 Company Research: {result.research.company}
          </h3>
          <p className="text-xs text-blue-700 mb-3 leading-relaxed line-clamp-3">
            {result.research.companyOverview}
          </p>
          {result.research.atsKeywords && result.research.atsKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-blue-600 font-medium mr-1">ATS Keywords:</span>
              {result.research.atsKeywords.slice(0, 8).map((kw, i) => (
                <span
                  key={i}
                  className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab("resume")}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === "resume"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          📄 Tailored Resume
        </button>
        <button
          onClick={() => setActiveTab("cover")}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === "cover"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          📝 Cover Letter
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 max-h-96 overflow-y-auto">
          <pre className="resume-preview text-sm text-slate-700 leading-relaxed">
            {activeTab === "resume" ? result.finalResume : result.finalCoverLetter}
          </pre>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={() =>
            downloadPDF(result.resumePDF, `tailored_resume_${result.jobTitle}.pdf`)
          }
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-xl font-semibold text-sm transition-all shadow-sm hover:shadow-md active:scale-95"
        >
          <span>⬇</span>
          Download Resume PDF
        </button>
        <button
          onClick={() =>
            downloadPDF(result.coverLetterPDF, `cover_letter_${result.jobTitle}.pdf`)
          }
          className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white py-3 px-6 rounded-xl font-semibold text-sm transition-all shadow-sm hover:shadow-md active:scale-95"
        >
          <span>⬇</span>
          Download Cover Letter PDF
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [progress, setProgress] = useState<ProgressState>({ step: "idle", message: "" });
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"resume" | "cover">("resume");
  const abortRef = useRef<AbortController | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      setResumeFile(accepted[0]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    onDropRejected: (rejections) => {
      const err = rejections[0]?.errors[0];
      if (err?.code === "file-too-large") setError("File too large (max 10MB)");
      else if (err?.code === "file-invalid-type") setError("Please upload a PDF file");
      else setError("Invalid file");
    },
  });

  const isGenerating = !["idle", "done", "error"].includes(progress.step);

  const handleGenerate = async () => {
    if (!resumeFile || !jobDescription.trim()) return;
    setError(null);
    setResult(null);
    setProgress({ step: "parsing", message: "Starting..." });

    // Step 1: Parse PDF
    const formData = new FormData();
    formData.append("resume", resumeFile);

    let resumeText = "";
    try {
      const parseRes = await fetch("/api/parse-resume", {
        method: "POST",
        body: formData,
      });
      const parseData = await parseRes.json();
      if (!parseRes.ok) throw new Error(parseData.error || "Failed to parse PDF");
      resumeText = parseData.text;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse PDF");
      setProgress({ step: "error", message: "Error" });
      return;
    }

    // Step 2: Run agent pipeline via SSE
    abortRef.current = new AbortController();
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, jobDescription, suggestions }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Generation failed");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response body");

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "progress") {
              setProgress({ step: event.step as Step, message: event.message });
            } else if (event.type === "complete") {
              setResult(event.data);
              setProgress({ step: "done", message: "Ready!" });
              setActiveTab("resume");
            } else if (event.type === "error") {
              throw new Error(event.message);
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setProgress({ step: "idle", message: "" });
        return;
      }
      const msg = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(msg);
      setProgress({ step: "error", message: "Error" });
    }
  };

  const handleReset = () => {
    if (abortRef.current) abortRef.current.abort();
    setResumeFile(null);
    setJobDescription("");
    setSuggestions("");
    setProgress({ step: "idle", message: "" });
    setResult(null);
    setError(null);
  };

  const isDone = progress.step === "done" && result;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
              AI
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Resume Tailor</h1>
              <p className="text-xs text-slate-500 hidden sm:block">Powered by Claude AI</p>
            </div>
          </div>
          {(isGenerating || isDone) && (
            <button
              onClick={handleReset}
              className="text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-all"
            >
              Start Over
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Hero */}
        {!isGenerating && !isDone && (
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 mb-4">
              <span className="text-blue-600 text-xs font-semibold uppercase tracking-wide">
                AI-Powered
              </span>
            </div>
            <h2 className="text-4xl font-bold text-slate-900 mb-3">Land Your Dream Job</h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Upload your resume and paste a job description. Our AI researches the company,
              tailors your resume, and writes a compelling cover letter — in minutes.
            </p>
          </div>
        )}

        {/* Input form */}
        {!isGenerating && !isDone && (
          <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Resume upload */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Upload Your Resume (PDF)
              </label>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  isDragActive
                    ? "border-blue-400 bg-blue-50"
                    : resumeFile
                    ? "border-green-400 bg-green-50"
                    : "border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50"
                }`}
              >
                <input {...getInputProps()} />
                {resumeFile ? (
                  <div>
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl">✓</span>
                    </div>
                    <p className="text-sm font-semibold text-green-700">{resumeFile.name}</p>
                    <p className="text-xs text-green-600 mt-1">
                      {(resumeFile.size / 1024).toFixed(0)} KB · Click to replace
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl">📄</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                      {isDragActive ? "Drop your PDF here" : "Drag & drop your PDF resume"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      or click to browse · max 10MB
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Job description */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Job Description
              </label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the full job description here — the more detail, the better your tailored resume will be..."
                rows={10}
                className="w-full border border-slate-300 rounded-xl p-4 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all placeholder:text-slate-400"
              />
              <p className="text-xs text-slate-400 mt-1 text-right">
                {jobDescription.length} characters
              </p>
            </div>
          </div>

          {/* Suggestions */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Additional Instructions <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={suggestions}
              onChange={(e) => setSuggestions(e.target.value)}
              placeholder="e.g. Emphasize leadership experience · I'm switching careers from finance · Highlight Python and data skills · Keep it to one page · Use a more formal tone..."
              rows={3}
              className="w-full border border-slate-300 rounded-xl p-4 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all placeholder:text-slate-400"
            />
          </div>
          </>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <span className="text-red-500 flex-shrink-0 mt-0.5">⚠</span>
            <div>
              <p className="text-sm font-semibold text-red-700">Something went wrong</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Generate button */}
        {!isGenerating && !isDone && (
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={handleGenerate}
              disabled={!resumeFile || !jobDescription.trim()}
              className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-4 px-10 rounded-xl font-semibold text-base transition-all shadow-sm hover:shadow-md active:scale-95 min-w-64"
            >
              <span className="text-lg">✨</span>
              Generate Tailored Documents
            </button>
            {(!resumeFile || !jobDescription.trim()) && (
              <p className="text-xs text-slate-400">
                {!resumeFile
                  ? "Upload a PDF resume to continue"
                  : "Paste a job description to continue"}
              </p>
            )}
            <div className="flex items-center gap-6 text-xs text-slate-400">
              <span className="flex items-center gap-1">🔍 Deep company research</span>
              <span className="flex items-center gap-1">🎯 ATS optimized</span>
              <span className="flex items-center gap-1">📄 2 PDF downloads</span>
            </div>
          </div>
        )}

        {/* Progress view */}
        {isGenerating && (
          <div className="py-8">
            <ProgressBar progress={progress} />
          </div>
        )}

        {/* Results view */}
        {isDone && result && (
          <div>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🎉</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Your Documents Are Ready!
              </h2>
              <p className="text-slate-500">
                Tailored for <strong>{result.research.role}</strong> at{" "}
                <strong>{result.research.company}</strong>
              </p>
            </div>
            <DocumentPreview
              result={result}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-200 py-6">
        <div className="max-w-5xl mx-auto px-4 text-center text-xs text-slate-400">
          <p>AI Resume Tailor · Powered by Claude AI · Built with Next.js</p>
          <p className="mt-1">Your resume data is processed in real-time and never stored.</p>
        </div>
      </footer>
    </div>
  );
}
