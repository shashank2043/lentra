import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const AUTH_COOKIE_NAME = "lentra_auth_token";
const DEFAULT_SECRET = "default-dev-secret-change-in-production-123456";

function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET || DEFAULT_SECRET;
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow public routes: /login, /api/cron/*, /api/auth/login, static files
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".") // favicon, assets, etc.
  ) {
    // If user is already logged in and navigates to /login, redirect to dashboard
    if (pathname === "/login") {
      const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
      if (token) {
        try {
          const { payload } = await jwtVerify(token, getAuthSecret());
          if (payload.role === "admin") {
            return NextResponse.redirect(new URL("/", request.url));
          }
        } catch {
          // Token invalid, continue to /login
        }
      }
    }
    return NextResponse.next();
  }

  // 2. Check for auth cookie
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  let isValid = false;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, getAuthSecret());
      if (payload.role === "admin") {
        isValid = true;
      }
    } catch {
      isValid = false;
    }
  }

  // 3. Handle unauthorized access
  if (!isValid) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
