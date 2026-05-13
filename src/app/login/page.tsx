import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  DASHBOARD_AUTH_COOKIE,
  isDashboardAuthEnabled,
  safeRedirectPath,
  verifyDashboardSessionToken,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    next?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = safeRedirectPath(Array.isArray(params.next) ? params.next[0] : params.next);
  const hasError = Boolean(Array.isArray(params.error) ? params.error[0] : params.error);
  const cookieStore = await cookies();
  const isAllowed = verifyDashboardSessionToken(cookieStore.get(DASHBOARD_AUTH_COOKIE)?.value);

  if (isDashboardAuthEnabled() && isAllowed) {
    redirect(next);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col justify-center px-5 py-8">
      <section className="dashboard-shadow rounded-[8px] border border-[#d8cdb8] bg-[#fffaf0] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#716a5e]">
          Xiaomi IoT Dashboard
        </p>
        <h1 className="mt-3 text-3xl font-black">访问密码</h1>
        <p className="mt-3 text-sm leading-6 text-[#716a5e]">
          输入固定访问密码后才能查看 Jing 大屋设备面板。
        </p>

        {isDashboardAuthEnabled() ? (
          <form action="/api/auth/login" method="post" className="mt-6 grid gap-4">
            <input type="hidden" name="next" value={next} />
            <label className="grid gap-2 text-sm font-semibold">
              密码
              <input
                autoFocus
                className="h-11 rounded-[8px] border border-[#d8cdb8] bg-white px-3 text-base outline-none focus:border-[#26221c]"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            {hasError ? <p className="text-sm font-semibold text-[#c43d2b]">密码不正确。</p> : null}
            <button
              type="submit"
              className="h-11 rounded-[8px] bg-[#26221c] px-4 text-sm font-black text-[#fffaf0]"
            >
              进入面板
            </button>
          </form>
        ) : (
          <div className="mt-6 rounded-[8px] border border-[#d8cdb8] bg-[#f8efdf] p-4 text-sm leading-6 text-[#716a5e]">
            当前未配置 `DASHBOARD_PASSWORD`，门禁未启用。公网暴露前请先在 `.env.local`
            配置固定密码并重启 PM2。
          </div>
        )}
      </section>
    </main>
  );
}
