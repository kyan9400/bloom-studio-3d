import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { MOTION_BOOT_SCRIPT } from "@/lib/motion-boot";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  // The hero headline is the LCP element. "optional" never swaps the display face in late (no second,
  // later LCP paint); it is still preloaded, so it shows whenever it arrives in time or is cached.
  display: "optional",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  // body font: not preloaded, so it never competes with the LCP headline font for bandwidth
  preload: false,
});

const SITE_URL = "https://bloom-studio-3d.vercel.app";
// The Pages mirror serves files under /bloom-studio-3d on github.io, so OG image URLs must resolve there.
// Canonical and og:url stay on the main Vercel site.
const ASSET_ORIGIN = process.env.GH_PAGES === "1" ? "https://kyan9400.github.io" : SITE_URL;
const DESCRIPTION =
  "Bloom Studio is a nail and beauty studio in the Old Flower Market. Mix your shade in the 3D Shade Lab, choose a glass, aurora or chrome finish, and book a chair.";

export const metadata: Metadata = {
  metadataBase: new URL(ASSET_ORIGIN),
  title: {
    default: "Bloom Studio — Nail & beauty studio",
    template: "%s · Bloom Studio",
  },
  description: DESCRIPTION,
  applicationName: "Bloom Studio",
  authors: [{ name: "Alhassan Alfarran", url: "https://github.com/kyan9400" }],
  creator: "Alhassan Alfarran",
  alternates: { canonical: `${SITE_URL}/` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/`,
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
