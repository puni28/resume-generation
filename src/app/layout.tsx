import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Resume Tailor — Land Your Dream Job",
  description:
    "Upload your resume and paste a job description. Our AI researches the company and tailors your resume and cover letter to perfection.",
  keywords: ["resume", "AI", "cover letter", "job application", "career"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
