import { NextResponse } from "next/server";
import {
  DASHBOARD_AUTH_COOKIE,
  createDashboardSessionToken,
  dashboardAuthCookieOptions,
  dashboardRedirectUrl,
  safeRedirectPath,
  verifyDashboardPassword,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const next = safeRedirectPath(form.get("next"));

  if (!verifyDashboardPassword(password)) {
    const url = dashboardRedirectUrl(request, "/login");
    url.searchParams.set("error", "1");
    url.searchParams.set("next", next);
    return NextResponse.redirect(url, { status: 303 });
  }

  const response = NextResponse.redirect(dashboardRedirectUrl(request, next), { status: 303 });
  response.cookies.set(DASHBOARD_AUTH_COOKIE, createDashboardSessionToken(), dashboardAuthCookieOptions());
  return response;
}
