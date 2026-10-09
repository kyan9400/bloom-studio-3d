import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { MOTION_BOOT_SCRIPT } from "@/lib/motion-boot";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const SITE_URL = "https://bloom-studio-3d.vercel.app";
const DESCRIPTION =
  "Bloom Studio is a nail and beauty studio in the Old Flower Market. Mix your shade in the 3D Shade Lab, choose a glass, aurora or chrome finish, and book a chair.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Bloom Studio — Nail & beauty studio",
    template: "%s · Bloom Studio",
  },
  description: DESCRIPTION,
  applicationName: "Bloom Studio",
  authors: [{ name: "Alhassan Alfarran", url: "https://github.com/kyan9400" }],
  creator: "Alhassan Alfarran",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Bloom Studio",
    title: "Bloom Studio — Colour, mixed for your hands",
    description: DESCRIPTION,
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bloom Studio — Colour, mixed for your hands",
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#fbf6f1",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
