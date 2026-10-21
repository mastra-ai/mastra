import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { IntegrationTools } from '../integrations/base.js';
import { createSandboxPreviewUrl } from '../routes/sandbox-preview.js';
import { peekSessionSandbox } from '../sandbox/session-sandbox.js';
import type { FactoryToolScope } from './scope.js';
import type { FactorySessionToolDependencies } from './session-tools.js';

export function createSandboxPreviewTools(
  scope: FactoryToolScope,
  deps: Pick<FactorySessionToolDependencies, 'sessions'>,
): IntegrationTools {
  async function sandbox() {
    const row = await deps.sessions.getBySessionId(scope.sessionId);
    if (!row || row.userId !== scope.userId || row.orgId !== scope.orgId || !row.sandboxId) {
      throw new Error('Session sandbox is unavailable');
    }
    const entry = peekSessionSandbox(scope.sessionId);
    if (!entry || !('sandboxId' in entry.sandbox) || entry.sandbox.sandboxId !== row.sandboxId) {
      throw new Error('Session sandbox is unavailable');
    }
    return { row, sandbox: entry.sandbox };
  }

  return {
    factory_start_preview_process: createTool({
      id: 'factory_start_preview_process',
      description:
        'Start a long-running web server inside this session sandbox. Returns a process ID; use factory_preview_port to open its UI.',
      inputSchema: z.object({ command: z.string().min(1).max(65536), cwd: z.string().optional() }),
      execute: async ({ command, cwd }) => {
        const { sandbox: instance } = await sandbox();
        if (!('startPersistentProcess' in instance) || typeof instance.startPersistentProcess !== 'function') {
          throw new Error('Persistent processes require a Railway platform sandbox');
        }
        return instance.startPersistentProcess(command, cwd);
      },
    }),
    factory_preview_process_status: createTool({
      id: 'factory_preview_process_status',
      description: 'Read the status and recent output of a preview process in this session sandbox.',
      inputSchema: z.object({ processId: z.string().uuid() }),
      execute: async ({ processId }) => {
        const { sandbox: instance } = await sandbox();
        if (!('getPersistentProcess' in instance) || typeof instance.getPersistentProcess !== 'function') {
          throw new Error('Persistent processes require a Railway platform sandbox');
        }
        return instance.getPersistentProcess(processId);
      },
    }),
    factory_stop_preview_process: createTool({
      id: 'factory_stop_preview_process',
      description: 'Stop a preview process started in this session sandbox.',
      inputSchema: z.object({ processId: z.string().uuid() }),
      execute: async ({ processId }) => {
        const { sandbox: instance } = await sandbox();
        if (!('stopPersistentProcess' in instance) || typeof instance.stopPersistentProcess !== 'function') {
          throw new Error('Persistent processes require a Railway platform sandbox');
        }
        await instance.stopPersistentProcess(processId);
        return { stopped: true };
      },
    }),
    factory_preview_port: createTool({
      id: 'factory_preview_port',
      description:
        'Return a short-lived browser URL for an HTTP server listening on a port inside this session sandbox.',
      inputSchema: z.object({
        port: z
          .number()
          .int()
          .min(1024)
          .max(65535)
          .refine(port => port !== 47000),
      }),
      execute: async ({ port }) => {
        const origin = process.env.MASTRACODE_PREVIEW_ORIGIN;
        const secret = process.env.MASTRACODE_PREVIEW_SIGNING_KEY ?? process.env.WORKOS_COOKIE_PASSWORD;
        if (!origin || !secret || new URL(origin).protocol !== 'https:') {
          throw new Error('Isolated preview origin is not configured');
        }
        const { row } = await sandbox();
        return {
          url: createSandboxPreviewUrl(new URL(origin).origin, secret, {
            sessionId: scope.sessionId,
            userId: row.userId,
            orgId: row.orgId,
            sandboxId: row.sandboxId!,
            port,
            expires: Date.now() + 60_000,
          }),
        };
      },
    }),
  };
}
