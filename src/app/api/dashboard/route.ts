import { getDashboardData } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getDashboardData();
  return Response.json(data);
}
