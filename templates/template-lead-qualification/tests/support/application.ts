import { mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Mastra } from '@mastra/core/mastra';
import { MastraServer } from '@mastra/hono';
import { Hono } from 'hono';
import { createApplicationRuntime } from '../../src/mastra/application';
import type { ApplicationOptions } from '../../src/mastra/application';
import type { EvidenceProvider } from '../../src/mastra/providers/evidence';
import { attioConfigSchema } from '../../src/mastra/config/attio';
import type { AttioConnectionConfig } from '../../src/mastra/config/attio';
import { createAttioInputProvider } from '../../src/mastra/providers/attio/input';
import { createAttioOutputProvider } from '../../src/mastra/providers/attio/output';
import { LocalInputProvider } from '../../src/mastra/providers/local/input';
import { LocalOutputProvider } from '../../src/mastra/providers/local/output';

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
  extract: async () => ({ identityAmbiguous: false, candidates: [], intentCoverageComplete: false }),
  verify: async () => ({ supportedCandidateIds: [], intentCoverageComplete: false }),
};

export const productionToken = 'example-token-for-functional-tests-1234567890';
export function event(eventId = 'delivery-1', lead: Record<string, unknown> = { domain: 'example.com' }) {
  return { version: 1, type: 'lead.received', eventId, lead: { reference: eventId, ...lead } };
}

export async function harness(
  options: Omit<ApplicationOptions, 'runtime'> & {
    production?: boolean;
    dispatch?: boolean;
    directory?: string;
    attio?: AttioConnectionConfig & { webhookSecret?: string };
    attioTransport?: typeof fetch;
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
    config: options.config,
    qualification: options.qualification,
    review: options.review,
    inputProvider:
      options.inputProvider ??
      (options.attio && (!options.config || options.config.source.inputProviderId === 'attio')
        ? context => createAttioInputProvider(context, attioConfigSchema.parse(options.attio), options.attioTransport)
        : options.defaultProviders
          ? undefined
          : context => new LocalInputProvider(context.config.source)),
    outputProvider:
      options.outputProvider ??
      (options.attio && (!options.config || options.config.source.destinationProviderId === 'attio')
        ? () => createAttioOutputProvider(options.attio, options.attioTransport)
        : options.defaultProviders
          ? undefined
          : client => new LocalOutputProvider(client)),
    evidence: options.evidence ?? [emptyEvidence],
    pages: options.pages,
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
