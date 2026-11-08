import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod/v4';
import { RequestContext } from '../request-context';
import { createTool } from '../tools';
import type { ToolAction } from '../tools';
import { COMPUTER_ORDERED_TOOL_GROUP, markOrderedTool } from '../tools/ordered-tools';
import { WORKSPACE_TOOLS } from '../workspace/constants';
import { supportsComputer } from '../workspace/sandbox';
import type { WorkspaceSandbox } from '../workspace/sandbox';
import type { Workspace } from '../workspace/workspace';
import type { MastraComputerScope, MastraComputerViewer, MastraComputers } from './contracts';

const ID_PATTERN = /^cmp_s_([A-Za-z0-9-]{1,128})_([A-Za-z0-9_-]{22})$/;
const MISSING_IDENTITY = 'computer tools require a resource id and thread id';
const NOT_FOUND = 'computer not found';
const NOT_ATTACHED = 'no computer attached — call mastra_workspace_computer_attach';

export interface SandboxComputersOptions {
  workspace: Workspace;
  secret: string | Uint8Array;
  viewer?: (sandbox: WorkspaceSandbox, scope: MastraComputerScope) => Promise<MastraComputerViewer | null>;
}

type Context = {
  agent?: { resourceId?: string; threadId?: string };
  requestContext?: RequestContext;
  writer?: { custom(part: unknown): Promise<void> | void };
};

/**
 * Computer lifecycle adapter for a borrowed Workspace sandbox.
 * It never starts, creates, checkpoints, or destroys provider infrastructure.
 * @experimental
 */
export class SandboxComputers implements MastraComputers {
  readonly #workspace: Workspace;
  readonly #key: Buffer;
  readonly #viewer?: SandboxComputersOptions['viewer'];
  readonly #attachments = new Map<string, { id: string; sandbox: WorkspaceSandbox }>();
  #tools?: Record<string, ToolAction<any, any, any, any>>;

  constructor(options: SandboxComputersOptions) {
    if (process.env.MASTRA_EXPERIMENTAL_COMPUTER !== 'true') {
      throw new Error('SandboxComputers is experimental; set MASTRA_EXPERIMENTAL_COMPUTER=true to enable it');
    }
    const key = Buffer.from(options.secret);
    if (key.byteLength === 0) throw new Error('SandboxComputers needs a non-empty secret');
    this.#workspace = options.workspace;
    this.#key = key;
    this.#viewer = options.viewer;
  }

  #mac(sandboxId: string, resourceId: string): Buffer {
    return createHmac('sha256', this.#key)
      .update(JSON.stringify(['mastra-sandbox-computer-v1', sandboxId, resourceId]))
      .digest()
      .subarray(0, 16);
  }

  #mint(sandboxId: string, resourceId: string): string {
    return `cmp_s_${sandboxId}_${this.#mac(sandboxId, resourceId).toString('base64url')}`;
  }

  #verify(id: string, resourceId: string): string | undefined {
    const match = ID_PATTERN.exec(id);
    if (!match) return undefined;
    const [, sandboxId, encoded] = match;
    const given = Buffer.from(encoded!, 'base64url');
    const expected = this.#mac(sandboxId!, resourceId);
    if (given.length !== expected.length || given.toString('base64url') !== encoded) return undefined;
    return timingSafeEqual(given, expected) ? sandboxId : undefined;
  }

  #scope(context: Context): (MastraComputerScope & { key: string; requestContext: RequestContext }) | undefined {
    const resourceId = context.agent?.resourceId;
    const threadId = context.agent?.threadId;
    if (!resourceId || !threadId) return undefined;
    return {
      resourceId,
      threadId,
      key: JSON.stringify([resourceId, threadId]),
      requestContext: context.requestContext ?? new RequestContext(),
    };
  }

  async #resolve(requestContext: RequestContext): Promise<WorkspaceSandbox | undefined> {
    const sandbox = await this.#workspace.resolveSandbox({ requestContext });
    return sandbox && supportsComputer(sandbox) ? sandbox : undefined;
  }

  async #emit(context: Context, id: string, threadId: string, status: 'attached' | 'released') {
    await context.writer?.custom({
      type: 'data-computer',
      data: { computerId: id, threadId, name: 'computer', status, persistent: false },
    });
  }

  tools(): Record<string, ToolAction<any, any, any, any>> {
    if (this.#tools) return this.#tools;
    this.#tools = {
      [WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.LIST]: createTool({
        id: WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.LIST,
        description: 'List the computer available from this workspace.',
        inputSchema: z.object({}),
        execute: async (_input, context: Context) => {
          const scope = this.#scope(context);
          if (!scope) return MISSING_IDENTITY;
          const sandbox = await this.#resolve(scope.requestContext);
          if (!sandbox) return { computers: [], attachedId: this.#attachments.get(scope.key)?.id };
          return {
            computers: [{ id: this.#mint(sandbox.id, scope.resourceId), name: sandbox.name, status: 'available', persistent: false }],
            attachedId: this.#attachments.get(scope.key)?.id,
          };
        },
      }),
      [WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.ATTACH]: createTool({
        id: WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.ATTACH,
        description: 'Attach the workspace computer to this conversation.',
        inputSchema: z.object({ id: z.string().max(256) }),
        execute: async ({ id }, context: Context) => {
          const scope = this.#scope(context);
          if (!scope) return MISSING_IDENTITY;
          const sandboxId = this.#verify(id, scope.resourceId);
          if (!sandboxId) return NOT_FOUND;
          const sandbox = await this.#resolve(scope.requestContext);
          if (!sandbox || sandbox.id !== sandboxId) return NOT_FOUND;
          this.#attachments.set(scope.key, { id, sandbox });
          await this.#emit(context, id, scope.threadId, 'attached');
          return { computer: { id, name: sandbox.name, status: 'attached', persistent: false } };
        },
      }),
      [WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.RELEASE]: createTool({
        id: WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.RELEASE,
        description: 'Detach the workspace computer without changing the sandbox.',
        inputSchema: z.object({}),
        execute: async (_input, context: Context) => {
          const scope = this.#scope(context);
          if (!scope) return MISSING_IDENTITY;
          const attached = this.#attachments.get(scope.key);
          if (!attached) return NOT_ATTACHED;
          this.#attachments.delete(scope.key);
          await this.#emit(context, attached.id, scope.threadId, 'released');
          return { computer: { id: attached.id, name: attached.sandbox.name, status: 'released', persistent: false } };
        },
      }),
    };
    for (const tool of Object.values(this.#tools)) markOrderedTool(tool, COMPUTER_ORDERED_TOOL_GROUP);
    return this.#tools;
  }

  async viewer(computerId: string, scope: MastraComputerScope): Promise<MastraComputerViewer | null> {
    const attached = this.#attachments.get(JSON.stringify([scope.resourceId, scope.threadId]));
    if (!attached || attached.id !== computerId || !this.#verify(computerId, scope.resourceId)) throw new Error(NOT_ATTACHED);
    if (this.#viewer) return this.#viewer(attached.sandbox, scope);
    const url = await attached.sandbox.computer?.streamUrl?.();
    return url ? { url, headers: {} } : null;
  }
}
