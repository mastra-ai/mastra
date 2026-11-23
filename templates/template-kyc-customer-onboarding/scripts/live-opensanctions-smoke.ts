import { z } from 'zod';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadScreeningPolicy } from '../src/config/policies/screening.js';
import { executionContextSchema } from '../src/domain/context.js';
import { SystemClock } from '../src/providers/local/deterministic-primitives.js';
import { OpenSanctionsGateway } from '../src/providers/screening/opensanctions-gateway.js';
import {
  OpenSanctionsPepScreeningProvider,
  OpenSanctionsSanctionsScreeningProvider,
} from '../src/providers/screening/opensanctions.js';
import { reserveCampaignRequests } from './lib/campaign-request-ledger.js';

const acceptedGate = 'contract-privacy-license-approved-2026-08-21';
const environment = z
  .object({
    OPENSANCTIONS_LIVE_GATE_ACCEPTED: z.literal(acceptedGate),
    OPENSANCTIONS_API_KEY: z.string().min(1),
    OPENSANCTIONS_MAX_BUDGET_EUR: z.coerce
      .number()
      .refine(value => value === 0.2, 'live smoke budget must be exactly EUR 0.20'),
    OPENSANCTIONS_CAMPAIGN_REQUEST_LIMIT: z.coerce
      .number()
      .int()
      .refine(value => value === 50, 'campaign request limit must be exactly 50'),
    OPENSANCTIONS_CAMPAIGN_INITIAL_USED: z.coerce.number().int().min(0).max(50).optional(),
  })
  .parse(process.env);

const ledgerPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../data/opensanctions-campaign-ledger.json');
const ledger = await reserveCampaignRequests({
  ledgerPath,
  requests: 2,
  limit: environment.OPENSANCTIONS_CAMPAIGN_REQUEST_LIMIT,
  ...(environment.OPENSANCTIONS_CAMPAIGN_INITIAL_USED === undefined
    ? {}
    : { initialReservedRequests: environment.OPENSANCTIONS_CAMPAIGN_INITIAL_USED }),
});

const clock = new SystemClock();
const policy = loadScreeningPolicy('demo-default');
const gateway = new OpenSanctionsGateway(environment.OPENSANCTIONS_API_KEY);
const sanctions = new OpenSanctionsSanctionsScreeningProvider(gateway, policy, 1, clock);
const pep = new OpenSanctionsPepScreeningProvider(gateway, policy, 1, clock);
const execution = executionContextSchema.parse({
  tenantId: 'live-smoke',
  jurisdiction: 'US',
  piiMode: 'demo-default',
  policy: { id: 'US-demo-default', version: '1.0.0', checksum: '0'.repeat(64) },
  locale: 'en-US',
  correlationId: 'opensanctions-live-smoke',
  actor: { type: 'system', id: 'live-smoke', roles: [] },
});
const input = {
  caseId: 'case-live-smoke',
  fullName: 'Morgan Example',
  aliases: [],
  dateOfBirth: '1990-01-01',
  nationality: 'US',
  jurisdiction: 'US',
  policyVersion: '1.0.0',
};
const deadlineAt = new Date(clock.now().getTime() + 10_000).toISOString();
const context = {
  execution,
  deadlineAt,
  attempt: 1,
  idempotencyKey: 'opensanctions-live-smoke-2026-08-21',
};

const [sanctionsResult, pepResult] = await Promise.all([sanctions.screen(input, context), pep.screen(input, context)]);

process.stdout.write(
  `${JSON.stringify({
    gate: 'accepted',
    budgetEur: environment.OPENSANCTIONS_MAX_BUDGET_EUR,
    campaignRequestLimit: environment.OPENSANCTIONS_CAMPAIGN_REQUEST_LIMIT,
    campaignReservedRequests: ledger.reservedRequests,
    campaignRemainingRequests: ledger.limit - ledger.reservedRequests,
    calls: 2,
    sanctions: { status: sanctionsResult.status, candidates: sanctionsResult.candidates.length },
    pep: { status: pepResult.status, candidates: pepResult.candidates.length },
  })}\n`,
);
