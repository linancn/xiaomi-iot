import { getDashboardData, normalizeDashboardHours } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const data = await getDashboardData({
    hours: normalizeDashboardHours(url.searchParams.get("hours")),
  });

  return Response.json(data);
}
