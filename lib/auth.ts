import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import crypto from "crypto";

export const AUTH_COOKIE_NAME = "lentra_auth_token";
const DEFAULT_SECRET = "default-dev-secret-change-in-production-123456";

function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET || DEFAULT_SECRET;
  return new TextEncoder().encode(secret);
}

/**
 * Constant-time password comparison to prevent timing attacks.
 * Uses SHA-256 hashing to ensure both inputs have identical buffer lengths.
 */
export function verifyAdminPassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error("ADMIN_PASSWORD is not set in environment variables");
    return false;
  }

  const hashProvided = crypto.createHash("sha256").update(password).digest();
  const hashActual = crypto.createHash("sha256").update(adminPassword).digest();

  return crypto.timingSafeEqual(hashProvided, hashActual);
}

/**
 * Creates a signed JWT valid for 30 days.
 */
export async function createAdminToken(): Promise<string> {
  const secret = getAuthSecret();

  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

/**
 * Verifies a JWT token. Returns true if valid.
 */
export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const secret = getAuthSecret();
    const { payload } = await jwtVerify(token, secret);
    return payload.role === "admin";
  } catch {
    return false;
  }
}

/**
 * Sets the signed httpOnly auth cookie for 30 days.
 */
export async function setAdminAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;

  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS_SEC,
  });
}

/**
 * Removes the auth cookie on logout.
 */
export async function clearAdminAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

/**
 * Checks if the current request is authenticated as admin.
 */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyAdminToken(token);
}
