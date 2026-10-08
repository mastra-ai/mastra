import { boundedBody } from "./http.ts";
import { deployment } from "./deployment.ts";

/** Next.js owns this proxy; storage, model execution and credentials stay on Mastra. */
export async function proxyWorkspace(request: Request, pathname: string): Promise<Response> {
  let connection;
  try {
    connection = deployment();
  } catch {
    return Response.json(
      { error: "Correct the server connection settings and restart." },
      { status: 503 },
    );
  }
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  if (
    !host ||
    !connection.webOrigins.some(
      (allowed) => new URL(allowed).host === host && (!origin || origin === allowed),
    )
  )
    return Response.json(
      { error: "Only same-origin workspace requests are accepted." },
      { status: 403 },
    );

  // Routes construct these paths; never forward a user-selected origin or arbitrary backend API.
  if (
    !/^\/(?:workspace(?:\?session=[^&]+)?|render-ack(?:\?session=[^&]+)?|sessions|copilotkit\/[a-zA-Z0-9_/-]+)$/.test(
      pathname,
    )
  )
    return Response.json({ error: "Invalid workspace endpoint." }, { status: 400 });
  let body: string | undefined;
  if (request.method !== "GET") {
    try {
      body = await boundedBody(request);
      if (body === undefined)
        return Response.json({ error: "Request too large." }, { status: 413 });
    } catch {
      return Response.json(
        { error: "Request upload timed out or was cancelled." },
        { status: 408 },
      );
    }
  }
  try {
    const upstream = await fetch(`${connection.agentOrigin}${pathname}`, {
      method: request.method,
      ...(body !== undefined ? { body } : {}),
      headers: {
        "content-type": "application/json",
        ...(origin ? { origin } : {}),
        ...(connection.token ? { "x-workspace-token": connection.token } : {}),
      },
      redirect: "error",
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
          "The agent is unavailable. Check the server connection and retry; the last saved workspace is preserved.",
      },
      { status: 503 },
    );
  }
}
