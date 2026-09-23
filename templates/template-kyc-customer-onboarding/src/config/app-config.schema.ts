import { z } from 'zod';

import { piiModeSchema } from '../domain/context.js';
import { tenantIdSchema } from '../domain/identifiers.js';
import type { DeepReadonly } from '../domain/immutable.js';

export const appConfigSchema = z
  .object({
    environment: z.enum(['test', 'demo-default', 'demo-strict', 'live']),
    server: z
      .object({
        host: z.string().min(1),
        port: z.number().int().min(1).max(65_535),
        portalOrigin: z.url(),
        openapiPath: z.string().startsWith('/').endsWith('.json'),
      })
      .strict(),
    storage: z
      .object({
        demoDataRoot: z.string().min(1),
        operationalUrl: z.string().regex(/^file:.+/u),
        mastraUrl: z.string().regex(/^file:.+/u),
        analyticsPath: z.string().min(1),
        documentPath: z.string().min(1),
      })
      .strict(),
    tenant: z.object({ defaultTenantId: tenantIdSchema }).strict(),
    jurisdiction: z
      .object({
        defaultJurisdiction: z.literal('US'),
        defaultPolicyProfile: z.enum(['demo-default', 'demo-strict']),
      })
      .strict(),
    pii: z.object({ mode: piiModeSchema, externalProviderAllowlist: z.array(z.string().min(1)) }).strict(),
    locale: z.string().min(2).max(35),
    providers: z
      .object({
        documentExtraction: z.string().min(1),
        identityVerification: z.string().min(1),
        addressVerification: z.string().min(1),
        sanctionsScreening: z.string().min(1),
        pepScreening: z.string().min(1),
        documentStorage: z.string().min(1),
        notification: z.string().min(1),
        webhookPublisher: z.string().min(1),
        provisioning: z.string().min(1),
        riskPolicy: z.string().min(1),
        riskAssessment: z.enum(['rule-based', 'structured-llm']),
      })
      .strict(),
    model: z
      .object({
        documentExtraction: z.string().min(1),
        agent: z.string().min(1),
        riskAssessment: z.string().min(1),
      })
      .strict(),
    pricing: z
      .object({
        openAiExtraction: z
          .object({
            inputUsdPerMillion: z.number().nonnegative().max(1_000),
            outputUsdPerMillion: z.number().nonnegative().max(1_000),
            version: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,99}$/u),
          })
          .strict(),
      })
      .strict(),
    credentials: z
      .object({
        openAiApiKeyConfigured: z.boolean(),
        openSanctionsApiKeyConfigured: z.boolean(),
        customerWebhookSecretConfigured: z.boolean(),
        complianceReviewerWebhookSecretConfigured: z.boolean(),
        complianceSeniorWebhookSecretConfigured: z.boolean(),
        outboundWebhookSecretConfigured: z.boolean(),
        outboundWebhookUrl: z.url().optional(),
      })
      .strict(),
    retry: z
      .object({
        timeoutMs: z.number().int().min(100).max(120_000),
        maxAttempts: z.number().int().min(1).max(5),
        baseDelayMs: z.number().int().min(10).max(10_000),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.environment === 'demo-strict') {
      const strictSelections = [
        ['jurisdiction.defaultPolicyProfile', value.jurisdiction.defaultPolicyProfile, 'demo-strict'],
        ['pii.mode', value.pii.mode, 'demo-strict'],
        ['providers.riskPolicy', value.providers.riskPolicy, 'demo-strict@1.1.0'],
      ] as const;
      for (const [path, selection, expected] of strictSelections) {
        if (selection !== expected) {
          context.addIssue({
            code: 'custom',
            path: path.split('.'),
            message: 'demo-strict cannot use a weaker default selection',
          });
        }
      }
    }
    if (value.providers.riskAssessment === 'structured-llm') {
      if (!value.credentials.openAiApiKeyConfigured) {
        context.addIssue({
          code: 'custom',
          path: ['credentials', 'openAiApiKeyConfigured'],
          message: 'structured risk assessment requires OPENAI_API_KEY',
        });
      }
      if (value.model.riskAssessment !== 'openai-gpt-5.6-luna') {
        context.addIssue({
          code: 'custom',
          path: ['model', 'riskAssessment'],
          message: 'structured risk assessment requires the approved model selection',
        });
      }
    }
  });

export type AppConfig = DeepReadonly<z.infer<typeof appConfigSchema>>;
