import { createHash } from 'node:crypto';
import type { TaskContext } from '@renderinc/sdk/workflows';
import { RenderProtocolError } from './errors.js';

/** Stable public identities, never dispatch credentials. */
export function identity(...parts: unknown[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

/** Native identity comes from Render's input channel, never task arguments. */
export function nativeIdentity(context: TaskContext, localDevelopment = false) {
  const { taskRunId, rootTaskRunId, parentTaskRunId } = context.metadata ?? {};
  // CLI 2.28.0 does not populate this SDK 1.2.0 field. Preserve existing local
  // signed dispatch only when the application explicitly selected local development.
  if (localDevelopment && !taskRunId && !rootTaskRunId && !parentTaskRunId) return undefined;
  if (!taskRunId || !rootTaskRunId)
    throw new RenderProtocolError('Render task run metadata is required. Update the Render runtime/CLI and SDK.');
  return { taskRunId, rootTaskRunId, parentTaskRunId };
}
