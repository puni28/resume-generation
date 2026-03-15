import { NextRequest } from "next/server";
import { runAgentPipeline } from "@/lib/agents";
import { generateResumePDF, generateCoverLetterPDF } from "@/lib/pdfGenerator";

export const maxDuration = 300; // 5 minutes for Vercel Pro / hobby allows 60s
export const runtime = "nodejs";

// Server-Sent Events streaming response
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const body = await request.json();
  const { resumeText, jobDescription, suggestions } = body as {
    resumeText: string;
    jobDescription: string;
    suggestions?: string;
  };

  if (!resumeText || !jobDescription) {
    return new Response(JSON.stringify({ error: "Missing resumeText or jobDescription" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const result = await runAgentPipeline(
          resumeText,
          jobDescription,
          (step, message) => {
            send({ type: "progress", step, message });
          },
          suggestions
        );

        // Generate PDFs
        send({ type: "progress", step: "pdf", message: "Generating PDFs..." });

        const jobTitle = result.research.role.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "") || "Position";

        const resumePDFBytes = await generateResumePDF(result.finalResume, jobTitle);
        const coverLetterPDFBytes = await generateCoverLetterPDF(result.finalCoverLetter, jobTitle);

        // Encode as base64 for JSON transfer
        const resumeBase64 = Buffer.from(resumePDFBytes).toString("base64");
        const coverLetterBase64 = Buffer.from(coverLetterPDFBytes).toString("base64");

        send({
          type: "complete",
          data: {
            parsedResume: result.parsedResume,
            research: result.research,
            finalResume: result.finalResume,
            finalCoverLetter: result.finalCoverLetter,
            qualityCheckPassed: result.qualityCheckPassed,
            resumePDF: resumeBase64,
            coverLetterPDF: coverLetterBase64,
            jobTitle,
          },
        });
      } catch (error) {
        console.error("Agent pipeline error:", error);
        send({
          type: "error",
          message: error instanceof Error ? error.message : "An unexpected error occurred",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
