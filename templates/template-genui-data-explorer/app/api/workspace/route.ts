import { proxyWorkspace } from "../../../src/workspace/proxy.ts";
import { requestedSession } from "../../../src/workspace/contracts.ts";
export const runtime = "nodejs";
function proxySession(request: Request, path: string) {
  try {
    return proxyWorkspace(
      request,
      `${path}?session=${encodeURIComponent(requestedSession(request))}`,
    );
  } catch {
    return new Response(JSON.stringify({ error: "Select one valid chat session." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
}
export async function GET(request: Request) {
  return proxySession(request, "/workspace");
}
export async function POST(request: Request) {
  return proxySession(request, "/render-ack");
}
