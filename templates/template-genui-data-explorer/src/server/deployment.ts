import { timingSafeEqual } from "node:crypto";

function origin(value: string, name: string) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      `${name} must be an HTTP(S) origin without credentials, path, query or fragment.`,
    );
  return url;
}
function loopback(url: URL) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

/** Server-only connection settings; browser input never chooses the upstream or credential. */
export function deployment(
  ports = {
    agentPort: Number(process.env.AGENT_PORT ?? 4111),
    webPort: Number(process.env.WEB_PORT ?? 3000),
  },
) {
  for (const port of [ports.agentPort, ports.webPort])
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error("Configure valid AGENT_PORT and WEB_PORT values and restart.");
  const agent = origin(
    process.env.MASTRA_SERVER_URL ?? `http://127.0.0.1:${ports.agentPort}`,
    "MASTRA_SERVER_URL",
  );
  const web = origin(process.env.WEB_ORIGIN ?? `http://127.0.0.1:${ports.webPort}`, "WEB_ORIGIN");
  const agentHost = process.env.AGENT_HOST ?? "127.0.0.1";
  const token = process.env.WORKSPACE_PROXY_TOKEN;
  const remote =
    !loopback(agent) || !loopback(web) || !["127.0.0.1", "localhost", "::1"].includes(agentHost);
  if (remote && (!token || token.length < 32))
    throw new Error(
      "Separate servers require the same WORKSPACE_PROXY_TOKEN (at least 32 characters) on Next.js and Mastra.",
    );
  const webOrigins = process.env.WEB_ORIGIN
    ? [web.origin]
    : [`http://127.0.0.1:${ports.webPort}`, `http://localhost:${ports.webPort}`];
  const agentHosts = process.env.MASTRA_SERVER_URL
    ? [agent.host]
    : [`127.0.0.1:${ports.agentPort}`, `localhost:${ports.agentPort}`];
  return {
    agentOrigin: agent.origin,
    agentHost,
    agentHosts,
    webOrigins,
    origins: [...webOrigins, agent.origin, ...agentHosts.map((host) => `http://${host}`)],
    token,
  };
}

export function authorizedProxy(request: Request, token: string | undefined) {
  if (!token) return true;
  const supplied = Buffer.from(request.headers.get("x-workspace-token") ?? "");
  const expected = Buffer.from(token);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
