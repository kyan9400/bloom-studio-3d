import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://bloom-studio-3d.vercel.app/", changeFrequency: "monthly", priority: 1 }];
}
