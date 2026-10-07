import { createServer } from "node:http";
import { afterEach, expect, it, vi } from "vitest";
import { proxyWorkspace } from "../../src/server/proxy.ts";
import { authorizedProxy, deployment } from "../../src/server/deployment.ts";
import { boundedBody } from "../../src/server/http.ts";

afterEach(() => vi.unstubAllEnvs());
const token = "synthetic-workspace-proxy-token-for-tests";
function configure(agentOrigin: string) {
  vi.stubEnv("MASTRA_SERVER_URL", agentOrigin);
  vi.stubEnv("WEB_ORIGIN", "https://explorer.example");
  vi.stubEnv("WORKSPACE_PROXY_TOKEN", token);
}
function request(path = "/api/workspace", options: RequestInit = {}) {
  return new Request(`https://explorer.example${path}`, {
    ...options,
    headers: { host: "explorer.example", origin: "https://explorer.example", ...options.headers },
  });
}
it("connects a separate web origin to the configured agent and replaces client credentials", async () => {
  const received: { url: string | undefined; token: string | undefined; body: string }[] = [];
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += String(chunk);
    const credential = req.headers["x-workspace-token"];
    received.push({
      url: req.url,
      token: typeof credential === "string" ? credential : undefined,
      body,
    });
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end("data: verified\n\n");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing fixture address.");
  configure(`http://127.0.0.1:${address.port}`);
  try {
    const response = await proxyWorkspace(
      request("/api/copilotkit/agent/dataExplorer/run", {
        method: "POST",
        body: "{}",
        headers: { "x-workspace-token": "untrusted-client-token" },
      }),
      "/copilotkit/agent/dataExplorer/run",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(await response.text()).toBe("data: verified\n\n");
    expect(received).toEqual([{ url: "/copilotkit/agent/dataExplorer/run", token, body: "{}" }]);
    expect(response.headers.has("x-workspace-token")).toBe(false);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
it("rejects cross-origin requests, arbitrary routes and invalid server settings before forwarding", async () => {
  configure("http://127.0.0.1:4111");
  expect(
    (
      await proxyWorkspace(
        request("/api/workspace", { headers: { origin: "https://other.example" } }),
        "/workspace",
      )
    ).status,
  ).toBe(403);
  expect((await proxyWorkspace(request(), "//other.example/workspace")).status).toBe(400);
  expect((await proxyWorkspace(request(), "/api/agents/dataExplorer/generate")).status).toBe(400);
  vi.stubEnv("MASTRA_SERVER_URL", "https://agent.example/path");
  expect((await proxyWorkspace(request(), "/workspace")).status).toBe(503);
});
it("requires a server credential for non-loopback deployment and validates it at the agent", () => {
  configure("https://agent.example");
  const connection = deployment();
  expect(connection.agentHosts).toEqual(["agent.example"]);
  expect(connection.webOrigins).toEqual(["https://explorer.example"]);
  expect(authorizedProxy(new Request("https://agent.example/workspace"), connection.token)).toBe(
    false,
  );
  expect(
    authorizedProxy(
      new Request("https://agent.example/workspace", { headers: { "x-workspace-token": token } }),
      connection.token,
    ),
  ).toBe(true);
  vi.stubEnv("WORKSPACE_PROXY_TOKEN", "short");
  expect(() => deployment()).toThrow("WORKSPACE_PROXY_TOKEN");
});
it("does not forward an oversized or already cancelled upload", async () => {
  configure("http://127.0.0.1:4111");
  const oversized = request("/api/sessions", {
    method: "POST",
    body: "{}",
    headers: { "content-length": String(3 * 1024 * 1024) },
  });
  expect((await proxyWorkspace(oversized, "/sessions")).status).toBe(413);
  const controller = new AbortController();
  controller.abort();
  expect(
    (
      await proxyWorkspace(
        request("/api/sessions", { method: "POST", body: "{}", signal: controller.signal }),
        "/sessions",
      )
    ).status,
  ).toBe(408);
  await expect(
    boundedBody(
      request("/api/sessions", { method: "POST", body: "{}", signal: controller.signal }),
    ),
  ).rejects.toThrow();
});

it("does not follow upstream redirects or send credentials to their destination", async () => {
  let redirected = false;
  const server = createServer((req, res) => {
    if (req.url === "/workspace") {
      res.writeHead(302, { location: "/destination" });
    } else redirected = true;
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing fixture address.");
  configure(`http://127.0.0.1:${address.port}`);
  try {
    expect((await proxyWorkspace(request(), "/workspace")).status).toBe(503);
    expect(redirected).toBe(false);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

it("closes the upstream response when a connected streaming request aborts", async () => {
  let upstreamClosed = false;
  const server = createServer((_req, res) => {
    res.on("close", () => {
      upstreamClosed = true;
    });
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write("data: started\n\n");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing fixture address.");
  configure(`http://127.0.0.1:${address.port}`);
  const controller = new AbortController();
  try {
    const response = await proxyWorkspace(
      request("/api/copilotkit/agent/dataExplorer/run", {
        method: "POST",
        body: "{}",
        signal: controller.signal,
      }),
      "/copilotkit/agent/dataExplorer/run",
    );
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("data: started\n\n");
    controller.abort();
    await expect(reader.read()).rejects.toThrow();
    reader.releaseLock();
    await expect.poll(() => upstreamClosed).toBe(true);
  } finally {
    controller.abort();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
