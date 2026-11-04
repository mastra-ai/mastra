import { proxyWorkspace } from "../../../../src/server/proxy.ts";
export const runtime = "nodejs";
async function handler(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!path.every((segment) => /^[a-zA-Z0-9_-]+$/.test(segment)))
    return Response.json({ error: "Invalid endpoint." }, { status: 400 });
  return proxyWorkspace(request, `/copilotkit/${path.join("/")}`);
}
export { handler as GET, handler as POST };
