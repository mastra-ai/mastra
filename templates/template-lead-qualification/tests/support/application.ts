import { mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Mastra } from '@mastra/core/mastra';
import { MastraServer } from '@mastra/hono';
import { Hono } from 'hono';
import { createApplicationRuntime } from '../../src/mastra/application';
import type { ApplicationOptions } from '../../src/mastra/application';
import { intakeConfig } from '../../src/mastra/config/lead-ingestion';
import type { EvidenceProvider } from '../../src/mastra/providers/evidence';

const controlledText = 'Controlled intake-only provider material; no company attributes asserted.';
const emptyEvidence: EvidenceProvider = {
  id: 'openai-web',
  search: async (_branch, context) => ({
    sourceUrls: [],
    evidence: [
      {
        id: 'intake-fixture',
        kind: 'website',
        source: `https://${context.domain}/`,
        title: 'Controlled fixture',
        retrievedAt: context.snapshot.assessmentTime,
        publishedAt: null,
        excerpt: controlledText,
        digest: createHash('sha256').update(controlledText).digest('hex'),
        providerId: 'openai-web',
        retrieval: 'api',
      },
    ],
  }),
  extract: async () => ({ companyName: null, identityAmbiguous: false, candidates: [], intentCoverageComplete: false }),
  verify: async () => ({ supportedCandidateIds: [], intentCoverageComplete: false }),
};

export const productionToken = 'example-token-for-functional-tests-1234567890';
export function event(eventId = 'delivery-1', lead: Record<string, unknown> = { domain: 'example.com' }) {
  return { version: 1, type: 'lead.received', eventId, lead: { reference: eventId, ...lead } };
}

export async function harness(
  options: Omit<ApplicationOptions, 'runtime' | 'attio'> & {
    production?: boolean;
    dispatch?: boolean;
    directory?: string;
    attio?: ApplicationOptions['attio'];
    defaultProviders?: boolean;
  } = {},
) {
  const directory = options.directory ?? (await mkdtemp(join(tmpdir(), 'lead-intake-')));
  const application = await createApplicationRuntime({
    runtime: {
      mode: options.production ? 'production' : 'local',
      token: options.production ? productionToken : undefined,
      host: '127.0.0.1',
      applicationPath: join(directory, 'application.db'),
      observabilityPath: join(directory, 'observability.duckdb'),
    },
    config: options.defaultProviders
      ? options.config
      : (options.config ??
        (options.attio
          ? {
              ...intakeConfig,
              source: {
                ...intakeConfig.source,
                id: `attio:${options.attio.listId}`,
                inputProviderId: 'attio',
                destinationProviderId: 'attio',
              },
            }
          : intakeConfig)),
    qualification: options.qualification,
    input: options.input,
    additionalInputs: options.additionalInputs,
    inputFactories: options.inputFactories,
    outputFactories: options.outputFactories,
    evidence: options.evidence ?? [emptyEvidence],
    pages: options.pages,
    output: options.output,
    attio: options.defaultProviders ? options.attio : (options.attio ?? null),
    attioTransport: options.attioTransport,
  });
  const mastra = new Mastra(application.mastraConfig);
  const http = new Hono();
  const server = new MastraServer({ app: http, mastra, prefix: '/api' });
  await server.init();
  if (options.dispatch) await mastra.startWorkers();
  function post(body: unknown, headers: Record<string, string> = {}) {
    return http.request('/lead-qualification/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  }
  let closing: Promise<void> | undefined;
  async function close(remove = true) {
    closing ??= mastra.shutdown();
    await closing;
    if (remove) await rm(directory, { recursive: true, force: true });
  }
  return {
    ...application,
    store: application.storage.leadEvents,
    duckdb: application.storage.telemetryStore,
    mastra,
    directory,
    http,
    post,
    close,
  };
}
