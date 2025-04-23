import { verifyAccess, type ApiData } from "@vercel/flags";
import { getProviderData } from "@vercel/flags/next";

import { NextResponse, type NextRequest } from "next/server";

import * as flags from "../../../../lib/server-utils";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = await verifyAccess(
    request.headers.get("Authorization"),
    process.env.FLAGS_SECRET,
  );
  console.log("access", access);
  if (!access) return NextResponse.json(null, { status: 401 });

  return NextResponse.json<ApiData>(getProviderData(flags));
}
