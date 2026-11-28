import { z } from 'zod/v4';

export const CONTROLLER_RUN_BINDING_KEY = 'mastra__controllerRunBinding';

export const controllerRunBindingSchema = z.object({
  controllerId: z.string().min(1),
  agentId: z.string().min(1),
  sessionId: z.string().min(1),
  ownerId: z.string(),
  resourceId: z.string().min(1),
  threadId: z.string().min(1),
  modeId: z.string().min(1),
});

export type ControllerRunBinding = z.infer<typeof controllerRunBindingSchema>;

// Only a controller view rebuilt on this worker may supersede the serialized entry.
export const restoredWorkerControllerContexts = new WeakSet<object>();

export function isRestoredWorkerControllerContext(value: unknown): value is object {
  return typeof value === 'object' && value !== null && restoredWorkerControllerContexts.has(value);
}
