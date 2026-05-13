import { NextResponse } from "next/server";
import {
  DASHBOARD_AUTH_COOKIE,
  createDashboardSessionToken,
  dashboardAuthCookieOptions,
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
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "1");
    url.searchParams.set("next", next);
    return NextResponse.redirect(url, { status: 303 });
  }

  const response = NextResponse.redirect(new URL(next, request.url), { status: 303 });
  response.cookies.set(DASHBOARD_AUTH_COOKIE, createDashboardSessionToken(), dashboardAuthCookieOptions());
  return response;
}
