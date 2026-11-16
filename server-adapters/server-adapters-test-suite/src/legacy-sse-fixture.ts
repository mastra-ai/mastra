import { MCPServerBase } from '@mastra/core/mcp';
import type { MCPServerHonoSSEOptions, MCPServerSSEOptions } from '@mastra/core/mcp';

const TRUSTED_REQUEST_CONTEXT = Symbol.for('mastra.mcp.trustedRequestContext');

/** What the SSE transport was handed for the caller before it started. */
export type LegacySSEIdentity = {
  clientId: string | null;
  userId: string | null;
  permissions: string[] | null;
};

function identityOf(auth: unknown): LegacySSEIdentity {
  const authInfo = auth as { clientId?: string; [TRUSTED_REQUEST_CONTEXT]?: Record<string, unknown> } | undefined;
  const trusted = authInfo?.[TRUSTED_REQUEST_CONTEXT];
  const user = trusted?.['mastra__user'] as { id?: string } | undefined;
  return {
    clientId: authInfo?.clientId ?? null,
    userId: user?.id ?? null,
    permissions: (trusted?.['mastra__userPermissions'] as string[] | undefined) ?? null,
  };
}

/**
 * Stands in for an `@mastra/mcp` 1.x server, the only kind that serves the
 * standalone SSE transport. Instead of streaming, it answers the SSE request
 * with the caller identity the adapter handed it.
 */
export class LegacySSEFixture extends MCPServerBase {
  constructor() {
    super({ id: 'legacy-sse-fixture', name: 'Legacy SSE fixture', version: '1.0.0', tools: {} });
  }

  override async startSSE({ req, res }: MCPServerSSEOptions) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(identityOf((req as { auth?: unknown }).auth)));
  }

  override async startHonoSSE({ authInfo }: MCPServerHonoSSEOptions): Promise<Response> {
    return Response.json(identityOf(authInfo));
  }

  convertTools() {
    return {};
  }
  async startStdio() {}
  async startHTTP() {}
  async close() {}
  getServerInfo() {
    return {
      id: this.id,
      name: this.name,
      version_detail: { version: this.version, release_date: this.releaseDate, is_latest: this.isLatest },
    };
  }
  getServerDetail() {
    return this.getServerInfo();
  }
  getToolListInfo() {
    return { tools: [] };
  }
  getToolInfo() {
    return undefined;
  }
  async executeTool() {
    return {};
  }
  async readResource() {
    return { contents: [] };
  }
  async listResources() {
    return { resources: [] };
  }
}
