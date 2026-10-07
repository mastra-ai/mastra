import { proxyWorkspace } from "../../../src/workspace/proxy.ts";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return proxyWorkspace(request, "/sessions");
}
