/**
 * PDF text extraction using pdf.js (pdfjs-dist)
 * This runs server-side via the API route.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // Dynamic import to avoid SSR/client-bundle issues
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as string) as any;

  // In Node.js server environment, disable the worker
  if (pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "";
  }

  // Load the PDF document
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    disableWorker: true,
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  const textPages: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Reconstruct text with proper line breaks using Y position
    let lastY: number | null = null;
    const pageLines: string[] = [];
    let currentLine = "";

    for (const item of textContent.items) {
      if ("str" in item) {
        const textItem = item as {
          str: string;
          transform: number[];
          height: number;
        };

        const y = textItem.transform[5];
        const text = textItem.str;

        if (lastY !== null && Math.abs(y - lastY) > 3) {
          if (currentLine.trim()) {
            pageLines.push(currentLine.trim());
          }
          currentLine = text;
        } else {
          currentLine += (currentLine && !currentLine.endsWith(" ") ? " " : "") + text;
        }
        lastY = y;
      }
    }

    if (currentLine.trim()) {
      pageLines.push(currentLine.trim());
    }

    textPages.push(pageLines.join("\n"));
  }

  return textPages.join("\n\n");
}
