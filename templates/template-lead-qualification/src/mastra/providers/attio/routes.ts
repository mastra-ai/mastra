import { createHmac, timingSafeEqual } from 'node:crypto';
import { registerApiRoute } from '@mastra/core/server';
import { ZodError } from 'zod';
import type { AttioConfig } from '../../config/attio';
import { attioDeliverySchema, AttioDeliveryConflictError, deliveryIdSchema } from './store';
import type { AttioStore } from './store';
import { readRawBody, BodyTooLargeError } from '../../routes/lead-event-routes';

export function createAttioRoutes(store: AttioStore, config: AttioConfig, maxBytes: number, maxPending: number) {
  return [
    registerApiRoute('/lead-qualification/attio/deliveries/:deliveryId', {
      method: 'GET',
      requiresAuth: true,
      handler: async c => {
        const id = deliveryIdSchema.safeParse(c.req.param('deliveryId'));
        if (!id.success) return c.json({ error: 'invalid_delivery_id' }, 400);
        try {
          const result = await store.delivery(id.data);
          return result ? c.json(result) : c.json({ error: 'delivery_not_found' }, 404);
        } catch {
          return c.json({ error: 'persistence_unavailable' }, 503);
        }
      },
    }),
    registerApiRoute('/lead-qualification/webhooks/attio', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        if (c.req.header('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json')
          return c.json({ error: 'unsupported_content_type' }, 415);
        try {
          const body = await readRawBody(c.req.raw, maxBytes);
          const signature = c.req.header('attio-signature') ?? c.req.header('x-attio-signature');
          if (
            !signature ||
            !/^[a-fA-F0-9]{64}$/.test(signature) ||
            !timingSafeEqual(
              Buffer.from(signature, 'hex'),
              createHmac('sha256', config.webhookSecret).update(body).digest(),
            )
          )
            return c.json({ error: 'invalid_signature' }, 401);
          const id = deliveryIdSchema.safeParse(c.req.header('idempotency-key'));
          if (!id.success) return c.json({ error: 'invalid_delivery_id' }, 400);
          const payload = attioDeliverySchema.parse(JSON.parse(body.toString('utf8')));
          await store.accept(id.data, payload, new Date().toISOString(), maxPending);
          return c.json({ deliveryId: id.data }, 202);
        } catch (error) {
          if (error instanceof BodyTooLargeError) return c.json({ error: 'body_too_large' }, 413);
          if (error instanceof SyntaxError || error instanceof ZodError || error instanceof AttioDeliveryConflictError)
            return c.json({ error: 'invalid_event' }, 400);
          return c.json({ error: 'persistence_unavailable' }, 503);
        }
      },
    }),
  ];
}
