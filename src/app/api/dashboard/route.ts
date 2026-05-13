import { cookies } from "next/headers";
import {
  DASHBOARD_AUTH_COOKIE,
  isDashboardAuthEnabled,
  verifyDashboardSessionToken,
} from "@/lib/auth";
import { getDashboardData, normalizeDashboardHours } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const isAllowed = verifyDashboardSessionToken(cookieStore.get(DASHBOARD_AUTH_COOKIE)?.value);

  if (isDashboardAuthEnabled() && !isAllowed) {
    return Response.json({ ok: false, message: "Authentication required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const data = await getDashboardData({
    hours: normalizeDashboardHours(url.searchParams.get("hours")),
  });

  return Response.json(data);
}
