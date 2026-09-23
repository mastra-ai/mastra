import { resolve } from 'node:path';
import type { Clock } from '../../src/domain/clock.js';
import { fixedClock } from '../../src/domain/clock.js';
import { createLibSqlOperationalStore } from '../../src/db/libsql-operational-store.js';
import { createSecurityIncidentWorkflow } from '../../src/mastra/workflows/security-incident-workflow.js';
import { LocalCloudEvidenceProvider } from '../../src/providers/cloud-evidence-provider.js';
import { LocalEndpointEvidenceProvider } from '../../src/providers/endpoint-evidence-provider.js';
import { LocalIdentityEvidenceProvider } from '../../src/providers/identity-evidence-provider.js';
import { LocalIncidentProvider } from '../../src/providers/local-incident-provider.js';
import { DeterministicRunbookEmbedder } from '../../src/mastra/knowledge/embeddings.js';
import { retrieveRunbook } from '../../src/mastra/knowledge/retrieve.js';
import { LibSqlRunbookVectorStore } from '../../src/mastra/knowledge/vector-store.js';
import { deterministicResponsePlanner } from '../../src/triage/prompt-safe-decision.js';

const investigator = async (input: { facts: readonly { factToken: string }[] }) => ({
  citedFactTokens: input.facts.map(fact => fact.factToken),
  gaps: [],
  contradictionFlags: [],
});

/** The actual production workflow with only model/provider boundaries injected. */
export function createLocalWorkflowDefinition(
  url: string,
  clock: Clock,
  benign = false,
  provider = new LocalIncidentProvider(),
) {
  const openStore = () => createLibSqlOperationalStore({ url });
  const runbookRoot = resolve(process.cwd(), 'runbooks');
  return createSecurityIncidentWorkflow(
    openStore,
    {
      openVectorStore: () => new LibSqlRunbookVectorStore({ url }),
      embedder: new DeterministicRunbookEmbedder(),
      retrieve: (db, vectors, embedder, input) =>
        retrieveRunbook(db, vectors, embedder, input, {
          threshold: -1,
          topK: 3,
          clock: fixedClock('2026-08-28T10:00:45.000Z'),
        }),
    },
    {
      identityProvider: new LocalIdentityEvidenceProvider(),
      endpointProvider: new LocalEndpointEvidenceProvider({
        verifyDeviceSignature: input => input.deviceId === 'device-new-1',
      }),
      cloudProvider: new LocalCloudEvidenceProvider(benign ? { countryByIp: { '198.51.100.8': 'US' } } : {}),
      clock: fixedClock('2026-08-28T10:00:30.000Z'),
      supervisor: async () => ({
        scopeValidated: true,
        specialists: ['identity', 'endpoint', 'cloud'],
      }),
      identityInvestigator: investigator,
      endpointInvestigator: investigator,
      cloudInvestigator: investigator,
      correlationAnalyst: async ({ candidate }) => candidate,
    },
    { planner: deterministicResponsePlanner, runbookRoot },
    {
      enabled: true,
      provider,
      mode: 'local',
      timeoutMs: 1_000,
      rateLimit: 8,
      clock,
      state: {
        sessions: new Map([['session-1', 'active']]),
        roles: new Map([['subject-1', 'admin']]),
        devices: new Map([['device-new-1', 'clear']]),
        reauthentication: new Map(),
        calls: new Map(),
      },
    },
  );
}
