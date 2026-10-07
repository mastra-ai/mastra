import { proxyWorkspace } from "../../../src/server/proxy.ts";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return proxyWorkspace(request, "/sessions");
}
