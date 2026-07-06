import { NextRequest, NextResponse } from "next/server";
import { runScraper } from "@/lib/scraper";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily scheduled scrape, invoked by Vercel Cron (see vercel.json) or any
 * external scheduler. Protected by CRON_SECRET — Vercel sends it
 * automatically as "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 }
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get("dry_run") === "true";
  const date = request.nextUrl.searchParams.get("date") ?? undefined;
  const lines: string[] = [];
  const summary = await runScraper({
    dryRun,
    date,
    log: (line) => lines.push(line),
  });

  return NextResponse.json({ summary, log: lines });
}
