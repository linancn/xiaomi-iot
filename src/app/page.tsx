import { DashboardShell } from "@/components/dashboard-shell";
import { getDashboardData, normalizeDashboardHours } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams: Promise<{ hours?: string | string[] }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const hours = Array.isArray(params.hours) ? params.hours[0] : params.hours;
  const dashboardData = await getDashboardData({ hours: normalizeDashboardHours(hours) });

  return <DashboardShell data={dashboardData} />;
}
