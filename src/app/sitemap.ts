import type { MetadataRoute } from "next";
import { CHARGE_CATEGORIES } from "@/lib/charges";
import { GUIDES } from "@/lib/guides";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/recent-arrests`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/search`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/charges`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/guides`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/remove-mugshot`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/disclaimer`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  const chargeRoutes: MetadataRoute.Sitemap = CHARGE_CATEGORIES.map((category) => ({
    url: `${siteUrl}/charges/${category.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const guideRoutes: MetadataRoute.Sitemap = GUIDES.map((guide) => ({
    url: `${siteUrl}/guides/${guide.slug}`,
    lastModified: new Date(guide.updated),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...chargeRoutes, ...guideRoutes];
}
