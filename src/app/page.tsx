import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  DASHBOARD_AUTH_COOKIE,
  isDashboardAuthEnabled,
  verifyDashboardSessionToken,
} from "@/lib/auth";
import { getDashboardData, normalizeDashboardHours } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams: Promise<{ hours?: string | string[] }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const hours = Array.isArray(params.hours) ? params.hours[0] : params.hours;
  const query = hours ? `?hours=${encodeURIComponent(hours)}` : "";
  const cookieStore = await cookies();
  const isAllowed = verifyDashboardSessionToken(cookieStore.get(DASHBOARD_AUTH_COOKIE)?.value);

  if (isDashboardAuthEnabled() && !isAllowed) {
    redirect(`/login?next=${encodeURIComponent(`/${query}`)}`);
  }

  const dashboardData = await getDashboardData({ hours: normalizeDashboardHours(hours) });

  return <DashboardShell data={dashboardData} />;
}
