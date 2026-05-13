import { getPool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const pool = getPool();

  if (!pool) {
    return Response.json({
      ok: true,
      database: "not_configured",
      message: "DATABASE_URL is not set; dashboard will use demo data.",
    });
  }

  try {
    const result = await pool.query<{ now: string }>("SELECT NOW() AS now");
    return Response.json({
      ok: true,
      database: "connected",
      now: result.rows[0]?.now,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        database: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}
