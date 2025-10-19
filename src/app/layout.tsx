import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { Providers } from "~/app/_components/Providers";

// Force dynamic rendering for the entire app to avoid build-time issues
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Video Processor - Remove Silence from Videos",
  description: "Automatically remove silences from your videos with AI",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
