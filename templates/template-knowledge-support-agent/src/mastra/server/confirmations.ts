import { randomUUID } from 'node:crypto';
import { registerApiRoute } from '@mastra/core/server';
import type { Memory } from '@mastra/memory';
import { resourceId, type Profile } from '../identity.ts';
import {
  confirmationInputSchema,
  confirmationMetadataSchema,
  confirmationText,
  encodeConfirmationReference,
} from '../review/confirmation.ts';

/** This explicit route is the only HTTP writer of structured confirmation metadata. */
export async function authorizeConfirmation(
  path: string,
  method: string,
  request: Request,
  owner: string,
  memory: Memory,
) {
  if (path !== '/support/confirmations') return undefined;
  if (method !== 'POST' || new URL(request.url).search) return false;
  try {
    const input = confirmationInputSchema.parse(await request.clone().json());
    return (await memory.getThreadById({ threadId: input.threadId }))?.resourceId === owner;
  } catch {
    return false;
  }
}
export function createConfirmationRoute(memory: Memory) {
  return registerApiRoute('/support/confirmations', {
    // Reserve the path for every method so unsupported requests cannot fall through to Studio.
    method: 'ALL',
    handler: async context => {
      if (context.req.method !== 'POST') return context.json({ error: 'Method not allowed' }, 405);
      const profile = context.get('requestContext').get('mastra__user') as Profile | undefined;
      if (!profile) return context.json({ error: 'Authentication required' }, 401);
      const parsed = confirmationInputSchema.safeParse(await context.req.json());
      if (!parsed.success) return context.json({ error: 'Invalid confirmation' }, 400);
      const input = parsed.data;
      const owner = resourceId(profile);
      if ((await memory.getThreadById({ threadId: input.threadId }))?.resourceId !== owner)
        return context.json({ error: 'Source thread ownership mismatch' }, 403);
      const id = randomUUID();
      const metadata = confirmationMetadataSchema.parse({
        ...input,
        version: 1,
        sourceActorId: profile.actorId,
        confirmedAt: new Date().toISOString(),
      });
      const confirmationReference = encodeConfirmationReference({
        threadId: input.threadId,
        messageId: id,
        sourceActorId: profile.actorId,
      });
      await memory.saveMessages({
        messages: [
          {
            id,
            threadId: input.threadId,
            resourceId: owner,
            role: 'user',
            createdAt: new Date(),
            content: {
              format: 2,
              parts: [{ type: 'text', text: confirmationText(input) }],
              metadata: { supportConfirmation: metadata },
            },
          },
        ],
      });
      return context.json({ confirmationReference }, 201);
    },
  });
}
