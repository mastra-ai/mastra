const maxBytes = 2 * 1024 * 1024;
/** A fixed local upstream; client input never selects a hostname, path or credential. */
export async function proxyWorkspace(request: Request, pathname: string): Promise<Response> {
  const url = new URL(request.url);
  const webPort = process.env.WEB_PORT ?? "3000";
  const hosts = [`127.0.0.1:${webPort}`, `localhost:${webPort}`];
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  if (!host || !hosts.includes(host) || (origin && origin !== `http://${host}`))
    return Response.json(
      { error: "Only same-origin local workspace requests are accepted." },
      { status: 403 },
    );
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost")
    return Response.json({ error: "Use the local workspace URL." }, { status: 403 });
  const port = Number(process.env.AGENT_PORT ?? "4111");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    return Response.json({ error: "Configure a valid AGENT_PORT and restart." }, { status: 503 });
  const body = request.method === "GET" ? undefined : await limitedBody(request);
  if (body instanceof Response) return body;
  try {
    const upstream = await fetch(`http://127.0.0.1:${port}${pathname}`, {
      method: request.method,
      ...(body ? { body } : {}),
      headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
      signal: request.signal,
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return Response.json(
      {
        error:
          "The local agent is unavailable. Restart the launcher and retry; the last saved workspace is preserved.",
      },
      { status: 503 },
    );
  }
}
async function limitedBody(request: Request): Promise<string | Response> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes)
    return Response.json({ error: "Request too large." }, { status: 413 });
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  const timer = setTimeout(() => {
    void reader.cancel();
  }, 5000);
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        return Response.json({ error: "Request too large." }, { status: 413 });
      }
      chunks.push(chunk.value);
    }
    const combined = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    return new TextDecoder().decode(combined);
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}
