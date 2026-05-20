import { randomUUID } from 'node:crypto';

import type { Workspace } from '../../workspace';

export type WorkspaceOwnershipKind = 'shared' | 'per-resource' | 'per-session';

export interface WorkspaceProviderContext {
  resourceId: string;
  sessionId?: string;
  parentSessionId?: string;
  pushState: (state: unknown) => Promise<void>;
}

export interface WorkspaceProvider {
  readonly providerId: string;
  readonly resumable: boolean;
  create(ctx: WorkspaceProviderContext): Promise<Workspace>;
  resume?(ctx: WorkspaceProviderContext & { state: unknown }): Promise<Workspace>;
  destroy?(workspace: Workspace, ctx: WorkspaceProviderContext): Promise<void>;
}

export function nonDurableProvider(
  fn: (ctx: WorkspaceProviderContext) => Workspace | Promise<Workspace>,
  opts?: { providerId?: string },
): WorkspaceProvider {
  return {
    providerId: opts?.providerId ?? `non-durable-${randomUUID()}`,
    resumable: false,
    create: async ctx => Promise.resolve(fn(ctx)),
  };
}
