import type { MetadataRoute } from "next";

// static file, so it also works in the GitHub Pages export
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://bloom-studio-3d.vercel.app/", changeFrequency: "monthly", priority: 1 }];
}
