import { proxyWorkspace } from "../../../src/workspace/proxy.ts";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return proxyWorkspace(request, "/workspace");
}

export async function POST(request: Request) {
  return proxyWorkspace(request, "/render-ack");
}
