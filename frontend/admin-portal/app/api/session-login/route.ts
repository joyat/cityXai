import { NextRequest, NextResponse } from "next/server";

async function tryKeycloak(email: string, password: string) {
  const params = new URLSearchParams();
  params.set("client_id", process.env.KEYCLOAK_CLIENT_ID || "cityxai-frontend");
  params.set("grant_type", "password");
  params.set("username", email);
  params.set("password", password);

  const response = await fetch("http://keycloak:8080/realms/cityxai/protocol/openid-connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
    cache: "no-store"
  });

  const data = await response.json().catch(() => ({}));
  return { ok: response.ok && !!data.access_token, data };
}

async function tryDemoLogin(email: string, password: string, request: NextRequest) {
  const response = await fetch(new URL("/api/dev-login", request.url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store"
  });

  const data = await response.json().catch(() => ({}));
  return { ok: response.ok && !!data.access_token, data };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const requestedRedirect = String(body.redirect_to || "").trim();
  const allowedRedirects = new Set(["/dashboard", "/chat"]);
  const redirectTo = allowedRedirects.has(requestedRedirect) ? requestedRedirect : "/dashboard";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  let result = await tryKeycloak(email, password);
  if (!result.ok) {
    result = await tryDemoLogin(email, password, request);
  }

  if (!result.ok || !result.data?.access_token) {
    const message =
      result.data?.error_description ||
      result.data?.error ||
      "Login failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const response = NextResponse.json({
    ok: true,
    redirect_to: redirectTo,
    access_token: result.data.access_token
  });

  response.cookies.set("cityxai_token", result.data.access_token, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: false,
    maxAge: 60 * 60 * 8
  });

  return response;
}
