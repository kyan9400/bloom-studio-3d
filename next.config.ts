import type { NextConfig } from "next";

// GH_PAGES=1 builds the static GitHub Pages mirror (npm run build:pages).
// Without it the Vercel build is unchanged.
const isPages = process.env.GH_PAGES === "1";
const PAGES_BASE = "/bloom-studio-3d";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // exposed to client code so the 3D chunk can prefix /models/* with the Pages base path
  env: { NEXT_PUBLIC_GH_PAGES: isPages ? "1" : "" },
  ...(isPages && {
    output: "export",
    basePath: PAGES_BASE,
    assetPrefix: PAGES_BASE,
    images: { unoptimized: true },
    trailingSlash: true,
  }),
};

export default nextConfig;
