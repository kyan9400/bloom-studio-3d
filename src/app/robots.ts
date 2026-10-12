import type { MetadataRoute } from "next";

// static file, so it also works in the GitHub Pages export
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://bloom-studio-3d.vercel.app/sitemap.xml",
  };
}
