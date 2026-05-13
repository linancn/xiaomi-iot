import crypto from "node:crypto";

export const DASHBOARD_AUTH_COOKIE = "xiaomi_iot_dashboard_auth";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const SESSION_PURPOSE = "xiaomi-iot-dashboard";

function dashboardPassword() {
  return process.env.DASHBOARD_PASSWORD?.trim() ?? "";
}

function dashboardSecret() {
  return process.env.DASHBOARD_AUTH_SECRET?.trim() || dashboardPassword();
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function signSession(issuedAt: string) {
  return crypto
    .createHmac("sha256", dashboardSecret())
    .update(`${SESSION_PURPOSE}:${issuedAt}`)
    .digest("base64url");
}

export function isDashboardAuthEnabled() {
  return dashboardPassword().length > 0;
}

export function verifyDashboardPassword(password: string) {
  const expected = dashboardPassword();
  if (!expected) {
    return true;
  }

  return safeEqual(password, expected);
}

export function createDashboardSessionToken() {
  const issuedAt = String(Date.now());
  return `${issuedAt}.${signSession(issuedAt)}`;
}

export function verifyDashboardSessionToken(token: string | undefined | null) {
  if (!isDashboardAuthEnabled()) {
    return true;
  }
  if (!token) {
    return false;
  }

  const [issuedAt, signature] = token.split(".");
  if (!issuedAt || !signature) {
    return false;
  }

  const issuedAtMs = Number(issuedAt);
  if (!Number.isFinite(issuedAtMs)) {
    return false;
  }

  const ageSeconds = (Date.now() - issuedAtMs) / 1000;
  if (ageSeconds < 0 || ageSeconds > SESSION_MAX_AGE_SECONDS) {
    return false;
  }

  return safeEqual(signature, signSession(issuedAt));
}

export function dashboardAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.DASHBOARD_COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function safeRedirectPath(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  if (value.startsWith("/api/auth/")) {
    return "/";
  }
  return value;
}
