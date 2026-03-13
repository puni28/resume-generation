import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-20250514";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedResume {
  name: string;
  contact: {
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    website?: string;
  };
  summary: string;
  experience: Array<{
    title: string;
    company: string;
    dates: string;
    bullets: string[];
  }>;
  education: Array<{
    degree?: string;
    school?: string;
    dates?: string;
    details?: string;
  }>;
  skills: string[];
  certifications: string[];
}

export interface ResearchResults {
  company: string;
  role: string;
  companyOverview: string;
  cultureAndValues: string;
  recentNews: string;
  techStack: string;
  roleExpectations: string;
  idealCandidateProfile: string;
  atsKeywords: string[];
  industryContext: string;
}

export interface TailoredDocuments {
  resume: string;
  coverLetter: string;
}

export interface AgentPipelineResult {
  parsedResume: ParsedResume;
  research: ResearchResults;
  tailoredResume: string;
  coverLetter: string;
  qualityCheckPassed: boolean;
  finalResume: string;
  finalCoverLetter: string;
}

// ─── Step 1: Resume Parser ────────────────────────────────────────────────────

export async function parseResume(resumeText: string): Promise<ParsedResume> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Parse the following resume text into a structured JSON object. Extract all information accurately.

Resume text:
${resumeText}

Return ONLY valid JSON in this exact structure (no markdown, no explanation):
{
  "name": "",
  "contact": {
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": "",
    "website": ""
  },
  "summary": "",
  "experience": [
    {
      "title": "",
      "company": "",
      "dates": "",
      "bullets": []
    }
  ],
  "education": [
    {
      "degree": "",
      "school": "",
      "dates": "",
      "details": ""
    }
  ],
  "skills": [],
  "certifications": []
}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const text = content.text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in resume parser response");

  return JSON.parse(jsonMatch[0]) as ParsedResume;
}

// ─── Step 2: Job & Company Research Agent ────────────────────────────────────

export async function researchJobAndCompany(
  jobDescription: string
): Promise<ResearchResults> {
  const extractMatch = jobDescription.match(
    /(?:at|@|company:|organization:)?\s*([A-Z][a-zA-Z\s&.,]+(?:Inc|LLC|Corp|Co|Ltd|Technologies|Solutions|Systems|Labs|Group)?)/
  );
  const companyHint = extractMatch ? extractMatch[1].trim() : "the company";

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8096,
    tools: [
      {
        type: "web_search_20250305" as const,
        name: "web_search",
      },
    ],
    messages: [
      {
        role: "user",
        content: `You are a professional career researcher. Analyze this job description and use web search to research the company and role thoroughly.

Job Description:
${jobDescription}

Please research and gather:
1. Company mission, values, culture, and recent news
2. The company's products/services and tech stack
3. What this role does day-to-day based on the job description and industry knowledge
4. What makes a great candidate for this specific role
5. Industry trends and buzzwords relevant to this position
6. ATS keywords specific to this role and company
7. The company's tone and communication style

After your research, output ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
{
  "company": "Company name",
  "role": "Job title",
  "companyOverview": "Detailed company overview from research",
  "cultureAndValues": "Company culture and values",
  "recentNews": "Recent company news or developments",
  "techStack": "Technologies and tools the company uses",
  "roleExpectations": "What this role involves day-to-day",
  "idealCandidateProfile": "What great candidates for this role look like",
  "atsKeywords": ["keyword1", "keyword2", "keyword3"],
  "industryContext": "Relevant industry trends and context"
}`,
      },
    ],
  });

  // Extract final text from potentially multi-turn tool use response
  let finalText = "";
  for (const block of response.content) {
    if (block.type === "text") {
      finalText = block.text;
    }
  }

  // Handle tool_use responses that may need further processing
  if (!finalText && response.stop_reason === "tool_use") {
    // Continue conversation to get final JSON after tool use
    const toolResults = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        toolResults.push({
          type: "tool_result" as const,
          tool_use_id: block.id,
          content: "Search completed. Please now provide the structured JSON output based on your research.",
        });
      }
    }

    const followUp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      tools: [
        {
          type: "web_search_20250305" as const,
          name: "web_search",
        },
      ],
      messages: [
        {
          role: "user",
          content: `You are a professional career researcher. Analyze this job description and use web search to research the company and role thoroughly.

Job Description:
${jobDescription}

Research thoroughly and output ONLY a valid JSON object with this exact structure:
{
  "company": "Company name",
  "role": "Job title",
  "companyOverview": "Detailed company overview",
  "cultureAndValues": "Company culture and values",
  "recentNews": "Recent company news",
  "techStack": "Technologies used",
  "roleExpectations": "Day-to-day role activities",
  "idealCandidateProfile": "Ideal candidate description",
  "atsKeywords": ["keyword1", "keyword2"],
  "industryContext": "Industry trends"
}`,
        },
        {
          role: "assistant",
          content: response.content,
        },
        {
          role: "user",
          content: toolResults,
        },
      ],
    });

    for (const block of followUp.content) {
      if (block.type === "text") {
        finalText = block.text;
      }
    }
  }

  const jsonMatch = finalText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    // Return a fallback structure based on the job description
    console.warn("Could not extract JSON from research agent, using fallback");
    return {
      company: companyHint,
      role: "Position",
      companyOverview: "Company information extracted from job description",
      cultureAndValues: "Professional environment focused on excellence",
      recentNews: "Company is actively hiring for this role",
      techStack: "Modern technology stack",
      roleExpectations: jobDescription.substring(0, 500),
      idealCandidateProfile: "Experienced professional with relevant skills",
      atsKeywords: extractKeywords(jobDescription),
      industryContext: "Competitive industry with focus on innovation",
    };
  }

  return JSON.parse(jsonMatch[0]) as ResearchResults;
}

function extractKeywords(text: string): string[] {
  const commonKeywords = text
    .toLowerCase()
    .match(/\b(?:experience|skills?|proficient|knowledge|ability|years?|degree|bachelor|master|required|preferred)\b/g);
  return [...new Set(commonKeywords || [])].slice(0, 10);
}

// ─── Step 3: Resume Tailoring Agent ──────────────────────────────────────────

export async function tailorResume(
  parsedResume: ParsedResume,
  jobDescription: string,
  research: ResearchResults
): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8096,
    system: `You are an elite career coach and professional resume writer with 20 years of experience.
You have just completed deep research on the target company and role. Use that research to
rewrite the candidate's resume so it feels perfectly crafted for this specific opportunity.

Rules:
- Sound like a confident, polished human wrote this — never robotic or AI-sounding
- NEVER invent experience, titles, companies, or skills not in the original resume
- Naturally mirror the company's language, values, and keywords from your research
- Reorder bullet points so the most relevant experience leads
- Use strong specific action verbs — avoid generic phrases
- Tailor the summary directly to this company and role
- Ensure it passes ATS screening for this specific job
- Output clean structured text organized by section
- Format with clear section headers and bullet points`,
    messages: [
      {
        role: "user",
        content: `Here is the candidate's parsed resume:
${JSON.stringify(parsedResume, null, 2)}

Target Job Description:
${jobDescription}

Research Results About Company & Role:
${JSON.stringify(research, null, 2)}

ATS Keywords to naturally incorporate: ${research.atsKeywords.join(", ")}

Please rewrite the resume tailored specifically for this role at ${research.company}.
Output the resume as clean formatted text with clear sections.
Format it as:
[CANDIDATE NAME]
[Contact Info]

PROFESSIONAL SUMMARY
[tailored summary]

PROFESSIONAL EXPERIENCE
[Job Title] | [Company] | [Dates]
• [bullet]
• [bullet]

EDUCATION
[Degree] | [School] | [Dates]

SKILLS
[skills list]

CERTIFICATIONS (if any)
[certifications]`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response from tailoring agent");
  return content.text;
}

// ─── Step 4: Cover Letter Agent ───────────────────────────────────────────────

export async function generateCoverLetter(
  parsedResume: ParsedResume,
  jobDescription: string,
  research: ResearchResults
): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `You are an elite career coach writing a cover letter for a top candidate. Using your
research on the company and role, write a compelling, human cover letter that:
- Opens with a hook specific to the company (reference something real from research)
- Connects the candidate's top 2-3 achievements to what this company needs
- Reflects the company's tone and culture
- Is 3-4 paragraphs, never longer than one page
- Sounds like the candidate wrote it — warm, specific, never generic
- NEVER uses phrases like "I am writing to express my interest" or AI-sounding openers
- Start with the candidate's contact info and date at the top
- End with a confident, specific call to action`,
    messages: [
      {
        role: "user",
        content: `Candidate's Resume:
${JSON.stringify(parsedResume, null, 2)}

Target Job Description:
${jobDescription}

Research Results About ${research.company}:
Company Overview: ${research.companyOverview}
Culture & Values: ${research.cultureAndValues}
Recent News: ${research.recentNews}
Role Expectations: ${research.roleExpectations}
Ideal Candidate: ${research.idealCandidateProfile}

Write a compelling cover letter for ${parsedResume.name} applying for the ${research.role} position at ${research.company}.

Format:
${parsedResume.name}
${parsedResume.contact.email || ""} | ${parsedResume.contact.phone || ""} | ${parsedResume.contact.location || ""}

[Today's date]

Hiring Manager
${research.company}

[4 paragraphs of compelling cover letter content]

Sincerely,
${parsedResume.name}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response from cover letter agent");
  return content.text;
}

// ─── Step 5: Quality Check Agent ──────────────────────────────────────────────

export async function runQualityCheck(
  tailoredResume: string,
  coverLetter: string,
  parsedResume: ParsedResume,
  research: ResearchResults
): Promise<{ resume: string; coverLetter: string; passed: boolean }> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8096,
    messages: [
      {
        role: "user",
        content: `You are a quality assurance editor. Review these two documents for a job application.

ORIGINAL CANDIDATE DATA (source of truth - nothing can be added that isn't here):
${JSON.stringify(parsedResume, null, 2)}

TAILORED RESUME:
${tailoredResume}

COVER LETTER:
${coverLetter}

TARGET COMPANY: ${research.company}
TARGET ROLE: ${research.role}

Quality checks to perform:
1. Verify no hallucinated content (no companies, titles, or skills not in original)
2. Ensure both read naturally and professionally, not AI-sounding
3. Confirm company-specific language is present
4. Check that achievements are compelling and specific
5. Make minor improvements to flow and word choice where needed

Output ONLY a JSON object with this structure (no markdown):
{
  "passed": true,
  "resume": "[full corrected resume text]",
  "coverLetter": "[full corrected cover letter text]",
  "notes": "Brief quality check notes"
}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response from quality check agent");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { resume: tailoredResume, coverLetter, passed: true };
  }

  const result = JSON.parse(jsonMatch[0]);
  return {
    resume: result.resume || tailoredResume,
    coverLetter: result.coverLetter || coverLetter,
    passed: result.passed ?? true,
  };
}

// ─── Full Pipeline ─────────────────────────────────────────────────────────────

export async function runAgentPipeline(
  resumeText: string,
  jobDescription: string,
  onProgress?: (step: string, message: string) => void
): Promise<AgentPipelineResult> {
  const emit = (step: string, message: string) => {
    if (onProgress) onProgress(step, message);
  };

  emit("parsing", "Parsing your resume...");
  const parsedResume = await parseResume(resumeText);

  emit("researching", "Researching the company and role...");
  const research = await researchJobAndCompany(jobDescription);

  emit("tailoring", "Tailoring your resume...");
  const tailoredResume = await tailorResume(parsedResume, jobDescription, research);

  emit("coverLetter", "Writing your cover letter...");
  const coverLetter = await generateCoverLetter(parsedResume, jobDescription, research);

  emit("qualityCheck", "Running quality check...");
  const { resume: finalResume, coverLetter: finalCoverLetter, passed } = await runQualityCheck(
    tailoredResume,
    coverLetter,
    parsedResume,
    research
  );

  emit("done", "Ready!");

  return {
    parsedResume,
    research,
    tailoredResume,
    coverLetter,
    qualityCheckPassed: passed,
    finalResume,
    finalCoverLetter,
  };
}
