import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const roleMap: Record<string, string[]> = {
  "admin@demo.de": ["system_admin", "document_admin", "staff"],
  "staff@demo.de": ["staff"],
  "docadmin@demo.de": ["document_admin", "staff"],
  "auditor@demo.de": ["readonly_auditor"],
  "citizen@demo.de": ["citizen"]
};

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: Record<string, unknown>, secret: string) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest("base64url");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export async function POST(request: NextRequest) {
  if (process.env.DEMO_LOGIN_ENABLED !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").toLowerCase();
  const password = String(body.password || "");
  const roles = roleMap[email];

  if (!roles || password !== (process.env.DEV_LOGIN_PASSWORD || "Demo1234!")) {
    return NextResponse.json({ error: "Anmeldung fehlgeschlagen" }, { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);
  const secret = process.env.JWT_SECRET || "change-me";
  const municipality = process.env.MUNICIPALITY_NAMESPACE || "paderborn";
  const token = sign(
    {
      sub: `demo-${email}`,
      email,
      preferred_username: email,
      municipality,
      realm_access: { roles },
      iat: now,
      exp: now + 60 * 60 * 8
    },
    secret
  );

  return NextResponse.json({ access_token: token, token_type: "bearer" });
}
