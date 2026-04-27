import { z } from 'zod';

/**
 * Whitelist of signal names accepted by `watch.subscribe`. Catching a
 * typo here saves the agent the round-trip cost of finding out via 400.
 */
export const SignalSchema = z.enum([
  'unknown_endpoint',
  'no_history',
  'dead',
  'zombie',
  'decoy_price_extreme',
  'suspicious_high_price',
  'slow',
  'new_provider',
  'dead_7d',
  'mostly_dead',
  'slow_p99',
  'price_outlier_high',
  'high_concentration',
]);

export const PreflightInputSchema = z.object({
  url: z.string().url().describe('The full URL of the x402 endpoint the agent is about to pay.'),
});

export const ForensicsInputSchema = z.object({
  url: z.string().url().describe('The full URL of the x402 endpoint to analyse.'),
});

export const CatalogDecoysInputSchema = z.object({});

export const WatchSubscribeInputSchema = z.object({
  url: z.string().url().describe('The x402 endpoint URL to watch.'),
  webhookUrl: z
    .string()
    .url()
    .refine(u => u.startsWith('https://'), {
      message: 'webhookUrl must use HTTPS — HMAC-signed alert payloads must not travel in clear text',
    })
    .describe(
      'Where x402station should POST alert payloads. Must be HTTPS (HMAC-signed payloads must travel encrypted) and reachable from the public internet.',
    ),
  signals: z
    .array(SignalSchema)
    .min(1)
    .max(20)
    .optional()
    .describe(
      "Signal names to alert on. Defaults server-side to ['dead', 'zombie', 'decoy_price_extreme'].",
    ),
});

export const WatchSecretInputSchema = z.object({
  watchId: z.string().uuid().describe('The watchId UUID returned by watch_subscribe.'),
  secret: z
    .string()
    .length(64)
    .regex(/^[0-9a-f]{64}$/i, 'secret must be 64 hex chars')
    .describe('The 64-char hex secret returned by watch_subscribe.'),
});

export const PaymentReceiptSchema = z
  .object({
    transaction: z.string().optional(),
    network: z.string().optional(),
    payer: z.string().optional(),
    raw: z.string().optional(),
    malformed: z.boolean().optional(),
  })
  .passthrough()
  .nullable();

export const EndpointMetadataSchema = z
  .object({
    url: z.string(),
    service: z.string().optional(),
    service_id: z.string().optional(),
    provider: z.string().nullable().optional(),
    price_usdc: z.string().nullable().optional(),
    currency: z.string().nullable().optional(),
    is_active: z.boolean().optional(),
    uptime_1h_pct: z.number().nullable().optional(),
    avg_latency_ms: z.number().nullable().optional(),
    endpoint_first_seen: z.string().optional(),
    service_first_seen: z.string().optional(),
  })
  .passthrough();

export const PreflightOutputSchema = z.object({
  result: z.object({
    ok: z.boolean(),
    warnings: z.array(SignalSchema),
    metadata: EndpointMetadataSchema,
  }),
  paymentReceipt: PaymentReceiptSchema,
});

export const ForensicsOutputSchema = z.object({
  result: z
    .object({
      ok: z.boolean(),
      warnings: z.array(SignalSchema),
      decoy_probability: z.number(),
      metadata: EndpointMetadataSchema,
    })
    .passthrough(),
  paymentReceipt: PaymentReceiptSchema,
});

export const CatalogDecoysOutputSchema = z.object({
  result: z
    .object({
      generated_at: z.string(),
      counts: z.object({
        total: z.number(),
        by_reason: z.record(z.string(), z.number()),
      }),
      truncated: z.boolean(),
      entries: z.array(z.unknown()),
    })
    .passthrough(),
  paymentReceipt: PaymentReceiptSchema,
});

export const WatchSubscribeOutputSchema = z.object({
  result: z
    .object({
      watchId: z.string(),
      secret: z.string(),
      expiresAt: z.string(),
      signals: z.array(SignalSchema),
      alertsPaid: z.number(),
      alertsRemaining: z.number(),
    })
    .passthrough(),
  paymentReceipt: PaymentReceiptSchema,
});

export const WatchStatusOutputSchema = z
  .object({
    watchId: z.string(),
    endpointUrl: z.string(),
    isActive: z.boolean(),
    expired: z.boolean(),
    alertsRemaining: z.number(),
  })
  .passthrough();

export const WatchUnsubscribeOutputSchema = z.object({
  watchId: z.string(),
  isActive: z.literal(false),
  message: z.string(),
});

export type PreflightInput = z.infer<typeof PreflightInputSchema>;
export type ForensicsInput = z.infer<typeof ForensicsInputSchema>;
export type CatalogDecoysInput = z.infer<typeof CatalogDecoysInputSchema>;
export type WatchSubscribeInput = z.infer<typeof WatchSubscribeInputSchema>;
export type WatchSecretInput = z.infer<typeof WatchSecretInputSchema>;
