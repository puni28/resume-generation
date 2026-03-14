# AI Resume Tailor

An AI-powered web app that tailors your resume and generates a cover letter for any job — using deep company research and Claude AI.

## Tech Stack

**Next.js 14+ (App Router)** was chosen because:
- Zero-config Vercel deployment with automatic CI/CD
- App Router enables streaming responses (Server-Sent Events) for real-time progress
- API routes handle server-side AI calls securely (API key never exposed to client)
- TypeScript support out of the box

**Tailwind CSS** for styling: utility-first, no runtime overhead, perfect for rapid UI development.

**pdf-lib** for PDF generation: pure JavaScript, no native dependencies, fully Vercel-compatible (unlike Puppeteer).

**pdfjs-dist** for PDF parsing: the industry standard, handles complex PDF layouts reliably.

**Anthropic Claude API** (`claude-sonnet-4-20250514`) with `web_search` tool for the AI pipeline.

## Features

- Upload a PDF resume (up to 10MB)
- Paste any job description
- 5-step AI agent pipeline:
  1. **Resume Parser** — extracts structured data from your resume
  2. **Research Agent** — searches the web to learn about the company, role, and culture
  3. **Resume Tailoring Agent** — rewrites your resume for the specific role (never invents experience)
  4. **Cover Letter Agent** — writes a compelling, company-specific cover letter
  5. **Quality Check Agent** — verifies no hallucinations, ensures human-sounding output
- Real-time progress UI with step-by-step feedback
- Tabbed preview of both documents before downloading
- Download as professional print-ready PDFs

## Setup

```bash
git clone <repo>
cd resume-generation
npm install
cp .env.example .env.local
# Add your ANTHROPIC_API_KEY to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key from [console.anthropic.com](https://console.anthropic.com) |

## Deployment to Vercel

```bash
npm install -g vercel
vercel --prod
vercel env add ANTHROPIC_API_KEY production
vercel --prod
```

## Architecture

```
src/
├── app/
│   ├── page.tsx              # Main UI
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── parse-resume/route.ts   # PDF text extraction
│       └── generate/route.ts       # Agent pipeline SSE stream
└── lib/
    ├── agents.ts             # 5 AI agent functions
    ├── pdfGenerator.ts       # PDF generation (pdf-lib)
    └── pdfParser.ts          # PDF parsing (pdfjs-dist)
```
