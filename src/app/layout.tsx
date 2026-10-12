import type { Metadata } from "next";
import "./globals.css";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: "AI Doctor Swarm",
  description: "Ask anything about your health. A swarm of specialist agents answers, shows where they disagree, and helps you reach a real doctor.",
  metadataBase: new URL("https://aidoctorswarm.com"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" />
      </head>
      <body className="min-h-screen antialiased">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
