import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from "pdf-lib";

// ─── Color Palette ────────────────────────────────────────────────────────────
const COLORS = {
  primary: rgb(0.1, 0.2, 0.5),       // Deep navy blue
  accent: rgb(0.2, 0.4, 0.7),        // Mid blue
  text: rgb(0.1, 0.1, 0.1),          // Near black
  lightText: rgb(0.4, 0.4, 0.4),     // Gray
  rule: rgb(0.8, 0.85, 0.95),        // Light blue rule
  background: rgb(1, 1, 1),          // White
};

const MARGINS = { top: 50, bottom: 50, left: 56, right: 56 };
const LINE_HEIGHT = 14;
const SECTION_GAP = 10;

// ─── Text wrapping helper ────────────────────────────────────────────────────

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    const w = font.widthOfTextAtSize(test, size);
    if (w > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ─── Page management ──────────────────────────────────────────────────────────

interface DrawContext {
  page: PDFPage;
  y: number;
  doc: PDFDocument;
  boldFont: PDFFont;
  regularFont: PDFFont;
  italicFont: PDFFont;
  pageWidth: number;
  pageHeight: number;
}

async function addNewPage(ctx: DrawContext): Promise<DrawContext> {
  const newPage = ctx.doc.addPage([612, 792]);
  return {
    ...ctx,
    page: newPage,
    y: 792 - MARGINS.top,
  };
}

async function ensureSpace(ctx: DrawContext, needed: number): Promise<DrawContext> {
  if (ctx.y - needed < MARGINS.bottom) {
    return addNewPage(ctx);
  }
  return ctx;
}

function drawLine(ctx: DrawContext, y?: number) {
  const yPos = y !== undefined ? y : ctx.y;
  ctx.page.drawLine({
    start: { x: MARGINS.left, y: yPos },
    end: { x: ctx.pageWidth - MARGINS.right, y: yPos },
    thickness: 0.5,
    color: COLORS.rule,
  });
}

// ─── Resume PDF ───────────────────────────────────────────────────────────────

export async function generateResumePDF(resumeText: string, jobTitle: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await doc.embedFont(StandardFonts.Helvetica);
  const italicFont = await doc.embedFont(StandardFonts.HelveticaOblique);

  const firstPage = doc.addPage([612, 792]);
  const pageWidth = 612;

  let ctx: DrawContext = {
    page: firstPage,
    y: 792 - MARGINS.top,
    doc,
    boldFont,
    regularFont,
    italicFont,
    pageWidth,
    pageHeight: 792,
  };

  const contentWidth = pageWidth - MARGINS.left - MARGINS.right;

  // Parse sections from text
  const sections = parseResumeText(resumeText);

  // ── Header (name) ──
  const name = sections.name || "Candidate";
  ctx = await ensureSpace(ctx, 50);
  const nameWidth = boldFont.widthOfTextAtSize(name.toUpperCase(), 22);
  ctx.page.drawText(name.toUpperCase(), {
    x: MARGINS.left,
    y: ctx.y,
    size: 22,
    font: boldFont,
    color: COLORS.primary,
  });
  ctx.y -= 8;

  // Blue rule under name
  ctx.page.drawLine({
    start: { x: MARGINS.left, y: ctx.y },
    end: { x: MARGINS.left + Math.min(nameWidth + 40, contentWidth), y: ctx.y },
    thickness: 2,
    color: COLORS.accent,
  });
  ctx.y -= 12;

  // Contact line
  if (sections.contact) {
    const contactText = sections.contact;
    const contactLines = wrapText(contactText, regularFont, 9, contentWidth);
    for (const line of contactLines) {
      ctx = await ensureSpace(ctx, LINE_HEIGHT);
      ctx.page.drawText(line, {
        x: MARGINS.left,
        y: ctx.y,
        size: 9,
        font: regularFont,
        color: COLORS.lightText,
      });
      ctx.y -= LINE_HEIGHT;
    }
  }
  ctx.y -= SECTION_GAP;

  // Sections
  for (const [sectionTitle, sectionContent] of Object.entries(sections.sections)) {
    if (!sectionContent || sectionContent.trim() === "") continue;

    ctx = await ensureSpace(ctx, 30);

    // Section header
    ctx.page.drawText(sectionTitle.toUpperCase(), {
      x: MARGINS.left,
      y: ctx.y,
      size: 10,
      font: boldFont,
      color: COLORS.primary,
    });
    ctx.y -= 4;

    // Full-width rule
    drawLine(ctx);
    ctx.y -= 10;

    const lines = sectionContent.split("\n").filter((l) => l.trim());

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Detect sub-headers (job title | company | dates lines)
      const isSubHeader =
        trimmed.includes("|") || /^[A-Z][a-zA-Z\s,&.]+\s+[-–—]\s+[A-Z]/.test(trimmed);
      const isBullet = trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("*");
      const isJobLine = !isBullet && trimmed.length < 80 && trimmed === trimmed.trim() && !trimmed.includes(",") && /[A-Z]/.test(trimmed[0]);

      if (isBullet) {
        const bulletText = trimmed.replace(/^[•\-\*]\s*/, "");
        const wrapped = wrapText(bulletText, regularFont, 9.5, contentWidth - 14);
        for (let i = 0; i < wrapped.length; i++) {
          ctx = await ensureSpace(ctx, LINE_HEIGHT);
          if (i === 0) {
            ctx.page.drawText("•", {
              x: MARGINS.left + 2,
              y: ctx.y,
              size: 9.5,
              font: regularFont,
              color: COLORS.text,
            });
          }
          ctx.page.drawText(wrapped[i], {
            x: MARGINS.left + 14,
            y: ctx.y,
            size: 9.5,
            font: regularFont,
            color: COLORS.text,
          });
          ctx.y -= LINE_HEIGHT;
        }
      } else if (isSubHeader || (trimmed.includes("|") && trimmed.split("|").length >= 2)) {
        // Job title / company line
        ctx = await ensureSpace(ctx, LINE_HEIGHT + 4);
        ctx.y -= 4;
        const parts = trimmed.split("|").map((p) => p.trim());
        if (parts.length >= 2) {
          const titleCompany = parts.slice(0, -1).join(" | ");
          const dates = parts[parts.length - 1];
          ctx.page.drawText(titleCompany, {
            x: MARGINS.left,
            y: ctx.y,
            size: 10,
            font: boldFont,
            color: COLORS.text,
          });
          const datesWidth = italicFont.widthOfTextAtSize(dates, 9);
          ctx.page.drawText(dates, {
            x: pageWidth - MARGINS.right - datesWidth,
            y: ctx.y,
            size: 9,
            font: italicFont,
            color: COLORS.lightText,
          });
        } else {
          ctx.page.drawText(trimmed, {
            x: MARGINS.left,
            y: ctx.y,
            size: 10,
            font: boldFont,
            color: COLORS.text,
          });
        }
        ctx.y -= LINE_HEIGHT + 2;
      } else {
        // Regular text with wrapping
        const wrapped = wrapText(trimmed, regularFont, 9.5, contentWidth);
        for (const wline of wrapped) {
          ctx = await ensureSpace(ctx, LINE_HEIGHT);
          ctx.page.drawText(wline, {
            x: MARGINS.left,
            y: ctx.y,
            size: 9.5,
            font: regularFont,
            color: COLORS.text,
          });
          ctx.y -= LINE_HEIGHT;
        }
      }
    }

    ctx.y -= SECTION_GAP;
  }

  return doc.save();
}

// ─── Cover Letter PDF ─────────────────────────────────────────────────────────

export async function generateCoverLetterPDF(
  coverLetterText: string,
  jobTitle: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await doc.embedFont(StandardFonts.Helvetica);
  const italicFont = await doc.embedFont(StandardFonts.HelveticaOblique);

  const firstPage = doc.addPage([612, 792]);
  const pageWidth = 612;

  let ctx: DrawContext = {
    page: firstPage,
    y: 792 - MARGINS.top,
    doc,
    boldFont,
    regularFont,
    italicFont,
    pageWidth,
    pageHeight: 792,
  };

  const contentWidth = pageWidth - MARGINS.left - MARGINS.right;
  const paragraphs = coverLetterText.split("\n\n").filter((p) => p.trim());

  let isFirstParagraph = true;
  let headerDone = false;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    const lines = trimmed.split("\n").filter((l) => l.trim());

    // Detect header block (name + contact on top lines)
    if (!headerDone && lines.length <= 4 && isFirstParagraph) {
      // Draw name in primary color
      const nameLine = lines[0];
      ctx = await ensureSpace(ctx, 30);
      ctx.page.drawText(nameLine.toUpperCase(), {
        x: MARGINS.left,
        y: ctx.y,
        size: 18,
        font: boldFont,
        color: COLORS.primary,
      });
      ctx.y -= 6;
      ctx.page.drawLine({
        start: { x: MARGINS.left, y: ctx.y },
        end: { x: pageWidth - MARGINS.right, y: ctx.y },
        thickness: 1.5,
        color: COLORS.accent,
      });
      ctx.y -= 10;

      // Contact info
      for (const line of lines.slice(1)) {
        ctx = await ensureSpace(ctx, LINE_HEIGHT);
        ctx.page.drawText(line, {
          x: MARGINS.left,
          y: ctx.y,
          size: 9,
          font: regularFont,
          color: COLORS.lightText,
        });
        ctx.y -= LINE_HEIGHT;
      }

      ctx.y -= SECTION_GAP * 2;
      headerDone = true;
      isFirstParagraph = false;
      continue;
    }

    isFirstParagraph = false;

    // Date line
    if (
      trimmed.match(
        /^(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d/i
      )
    ) {
      ctx = await ensureSpace(ctx, LINE_HEIGHT);
      ctx.page.drawText(trimmed, {
        x: MARGINS.left,
        y: ctx.y,
        size: 10,
        font: regularFont,
        color: COLORS.lightText,
      });
      ctx.y -= LINE_HEIGHT + SECTION_GAP;
      continue;
    }

    // Salutation / closing lines
    if (
      trimmed.startsWith("Dear") ||
      trimmed.startsWith("Sincerely") ||
      trimmed.startsWith("Best") ||
      trimmed.startsWith("Thank you") ||
      trimmed.startsWith("Hiring Manager") ||
      lines.length <= 2 && !trimmed.includes(" ")
    ) {
      for (const line of lines) {
        ctx = await ensureSpace(ctx, LINE_HEIGHT);
        ctx.page.drawText(line, {
          x: MARGINS.left,
          y: ctx.y,
          size: 10,
          font: line.startsWith("Dear") || line.startsWith("Sincerely") ? regularFont : boldFont,
          color: line.startsWith("Dear") ? COLORS.text : COLORS.primary,
        });
        ctx.y -= LINE_HEIGHT;
      }
      ctx.y -= SECTION_GAP;
      continue;
    }

    // Body paragraphs
    ctx = await ensureSpace(ctx, LINE_HEIGHT);
    for (const line of lines) {
      const wrapped = wrapText(line, regularFont, 10.5, contentWidth);
      for (const wline of wrapped) {
        ctx = await ensureSpace(ctx, LINE_HEIGHT);
        ctx.page.drawText(wline, {
          x: MARGINS.left,
          y: ctx.y,
          size: 10.5,
          font: regularFont,
          color: COLORS.text,
        });
        ctx.y -= LINE_HEIGHT + 1;
      }
    }
    ctx.y -= SECTION_GAP;
  }

  return doc.save();
}

// ─── Resume Text Parser ────────────────────────────────────────────────────────

interface ResumeStructure {
  name: string;
  contact: string;
  sections: Record<string, string>;
}

function parseResumeText(text: string): ResumeStructure {
  const lines = text.split("\n");
  const result: ResumeStructure = {
    name: "",
    contact: "",
    sections: {},
  };

  const sectionHeaders = new Set([
    "PROFESSIONAL SUMMARY",
    "SUMMARY",
    "OBJECTIVE",
    "PROFESSIONAL EXPERIENCE",
    "WORK EXPERIENCE",
    "EXPERIENCE",
    "EDUCATION",
    "SKILLS",
    "TECHNICAL SKILLS",
    "CERTIFICATIONS",
    "CERTIFICATES",
    "AWARDS",
    "PUBLICATIONS",
    "PROJECTS",
    "VOLUNTEER",
    "LANGUAGES",
  ]);

  let currentSection = "";
  let lineIdx = 0;

  // First non-empty line is the name
  while (lineIdx < lines.length && !lines[lineIdx].trim()) lineIdx++;
  if (lineIdx < lines.length) {
    result.name = lines[lineIdx].trim();
    lineIdx++;
  }

  // Next non-empty lines until section header are contact
  const contactLines: string[] = [];
  while (lineIdx < lines.length) {
    const line = lines[lineIdx].trim();
    const isHeader = sectionHeaders.has(line.toUpperCase()) || sectionHeaders.has(line);
    if (isHeader || line.toUpperCase() === line && line.length > 3 && !line.includes("@") && !line.includes("|")) {
      if (isHeader) {
        currentSection = line;
        result.sections[currentSection] = "";
        lineIdx++;
      }
      break;
    }
    if (line) contactLines.push(line);
    lineIdx++;
  }
  result.contact = contactLines.join(" | ");

  // Remaining lines go into sections
  while (lineIdx < lines.length) {
    const line = lines[lineIdx].trim();
    const upperLine = line.toUpperCase();

    const isKnownHeader = sectionHeaders.has(upperLine);
    const looksLikeHeader =
      !isKnownHeader &&
      line === line.toUpperCase() &&
      line.length > 3 &&
      line.length < 50 &&
      !line.startsWith("•") &&
      !line.startsWith("-") &&
      !/^\d/.test(line) &&
      !line.includes("@") &&
      line.replace(/[^A-Z\s]/g, "").length > line.length * 0.7;

    if (isKnownHeader || looksLikeHeader) {
      currentSection = line;
      result.sections[currentSection] = "";
    } else if (currentSection) {
      result.sections[currentSection] += (result.sections[currentSection] ? "\n" : "") + lines[lineIdx];
    }

    lineIdx++;
  }

  return result;
}
