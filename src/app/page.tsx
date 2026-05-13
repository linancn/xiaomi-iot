import { DashboardShell } from "@/components/dashboard-shell";
import { getDashboardData } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Home() {
  const dashboardData = await getDashboardData();

  return <DashboardShell data={dashboardData} />;
}
