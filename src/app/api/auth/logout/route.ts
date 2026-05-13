import { NextResponse } from "next/server";
import { DASHBOARD_AUTH_COOKIE, dashboardRedirectUrl } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const response = NextResponse.redirect(dashboardRedirectUrl(request, "/login"), { status: 303 });
  response.cookies.delete(DASHBOARD_AUTH_COOKIE);
  return response;
}
