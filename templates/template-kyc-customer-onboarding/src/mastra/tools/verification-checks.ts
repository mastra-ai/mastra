import { createTool } from '@mastra/core/tools';
import type { TracingContext } from '@mastra/core/observability';
import { z } from 'zod';

import { executionContextSchema } from '../../domain/context.js';
import { caseIdSchema, documentIdSchema, idempotencyKeySchema, workflowRunIdSchema } from '../../domain/identifiers.js';
import type {
  AddressVerificationService,
  IdentityVerificationService,
  PepScreeningService,
  SanctionsScreeningService,
} from '../../services/check-execution.js';
import { screeningCheckOutputSchema, verificationCheckOutputSchema } from '../../services/check-execution.js';

export const verificationCheckToolInputSchema = z
  .object({
    caseId: caseIdSchema,
    documentId: documentIdSchema,
    idempotencyKey: idempotencyKeySchema,
    workflowRunId: workflowRunIdSchema,
  })
  .strict();

const annotations = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const toolRequestContextSchema = z.object(executionContextSchema.shape).loose();

const executionFrom = (value: unknown) => {
  const context = toolRequestContextSchema.parse(value);
  return executionContextSchema.parse({
    tenantId: context.tenantId,
    jurisdiction: context.jurisdiction,
    piiMode: context.piiMode,
    policy: context.policy,
    locale: context.locale,
    correlationId: context.correlationId,
    actor: context.actor,
  });
};

const execute =
  <Result>(service: { execute(input: unknown, tracingContext?: TracingContext): Promise<Result> }, timeoutMs: number) =>
  async (
    input: z.infer<typeof verificationCheckToolInputSchema>,
    context: { requestContext: { all: unknown }; tracingContext?: TracingContext },
  ): Promise<Result> =>
    service.execute(
      {
        ...input,
        execution: executionFrom(context.requestContext.all),
        timeoutMs,
      },
      context.tracingContext,
    );

export const createIdentityVerificationTool = (service: IdentityVerificationService, timeoutMs: number) =>
  createTool({
    id: 'identity-verification-v1',
    description: 'Run the configured identity verification check using tenant-scoped references',
    inputSchema: verificationCheckToolInputSchema,
    outputSchema: verificationCheckOutputSchema,
    strict: true,
    mcp: { annotations },
    execute: execute(service, timeoutMs),
  });

export const createAddressVerificationTool = (service: AddressVerificationService, timeoutMs: number) =>
  createTool({
    id: 'address-verification-v1',
    description: 'Run the configured address verification check using tenant-scoped references',
    inputSchema: verificationCheckToolInputSchema,
    outputSchema: verificationCheckOutputSchema,
    strict: true,
    mcp: { annotations },
    execute: execute(service, timeoutMs),
  });

export const createSanctionsScreeningTool = (service: SanctionsScreeningService, timeoutMs: number) =>
  createTool({
    id: 'sanctions-screening-v1',
    description: 'Run the configured sanctions screening using tenant-scoped references',
    inputSchema: verificationCheckToolInputSchema,
    outputSchema: screeningCheckOutputSchema,
    strict: true,
    mcp: { annotations },
    execute: execute(service, timeoutMs),
  });

export const createPepScreeningTool = (service: PepScreeningService, timeoutMs: number) =>
  createTool({
    id: 'pep-screening-v1',
    description: 'Run the configured PEP screening using tenant-scoped references',
    inputSchema: verificationCheckToolInputSchema,
    outputSchema: screeningCheckOutputSchema,
    strict: true,
    mcp: { annotations },
    execute: execute(service, timeoutMs),
  });

export type IdentityVerificationTool = ReturnType<typeof createIdentityVerificationTool>;
export type AddressVerificationTool = ReturnType<typeof createAddressVerificationTool>;
export type SanctionsScreeningTool = ReturnType<typeof createSanctionsScreeningTool>;
export type PepScreeningTool = ReturnType<typeof createPepScreeningTool>;

export type VerificationCheckTools = Readonly<{
  identityVerification: IdentityVerificationTool;
  addressVerification: AddressVerificationTool;
  sanctionsScreening: SanctionsScreeningTool;
  pepScreening: PepScreeningTool;
}>;
