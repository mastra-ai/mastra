import { describe, expect, it } from 'vitest';
import { InMemoryStore } from '../../storage';
import { Knowledge, createKnowledgeImporterHost } from '../index';
import { importerHostConformance } from './conformance';
import { KnowledgeImporter } from './define';
import type { KnowledgeImporterHost } from './host';

function localHost(): KnowledgeImporterHost {
  const knowledge = new Knowledge({
    storage: new InMemoryStore(),
    scopes: { 'docs:$orgId': {} },
    importers: [
      new (class extends KnowledgeImporter({ id: 'notes', label: 'Notes' }) {
        async import() {}
      })({ id: 'b1', target: 'docs:acme#notion' }),
    ],
  });
  return knowledge.importers!.host;
}

function leasedHost(): KnowledgeImporterHost {
  const knowledge = new Knowledge({ storage: new InMemoryStore(), scopes: { 'docs:$orgId': {} } });
  return createKnowledgeImporterHost(knowledge, {
    leaseMs: 90_000,
    bindings: [{ id: 'b1', importer: 'notes', target: 'docs:acme#notion', settings: {}, credentials: {} }],
  });
}

async function failures(
  wrap: (host: KnowledgeImporterHost) => KnowledgeImporterHost,
  make: () => KnowledgeImporterHost = localHost,
): Promise<string[]> {
  const failed: string[] = [];
  for (const c of importerHostConformance(async () => ({ host: wrap(make()), bindingId: 'b1' }))) {
    await c.run().catch(() => failed.push(c.name));
  }
  return failed;
}

describe('importerHostConformance', () => {
  it('passes the local host', async () => {
    expect(await failures(host => host)).toEqual([]);
  });

  it('passes a strict-lease service host, which refuses heartbeats for runs it no longer holds', async () => {
    expect(await failures(host => host, leasedHost)).toEqual([]);
  });

  it('catches a host that tells a finished run to keep going', async () => {
    const failed = await failures(host => ({
      ...host,
      startRun: host.startRun.bind(host),
      flush: host.flush.bind(host),
      finishRun: host.finishRun.bind(host),
      heartbeat: async () => ({ cancel: false }),
    }));
    expect(failed).toEqual([
      'refuses a flush or finish from another generation',
      'after a finish, refuses new flushes and still replays committed ones',
    ]);
  });

  it('catches a host that applies a replayed seq again instead of returning its receipt', async () => {
    const failed = await failures(host => {
      const seen = new Map<string, number>();
      return {
        ...host,
        startRun: host.startRun.bind(host),
        heartbeat: host.heartbeat.bind(host),
        finishRun: host.finishRun.bind(host),
        async flush(flush) {
          const receipt = await host.flush(flush);
          const key = `${flush.runId}:${flush.seq}`;
          const n = (seen.get(key) ?? 0) + 1;
          seen.set(key, n);
          return n > 1 ? { ...receipt, created: receipt.created + 1 } : receipt;
        },
      };
    });
    expect(failed).toContain('replays a committed seq to the same receipt and refuses other content for it');
  });

  it('catches a host that trusts the supplied digest when it replays a committed seq', async () => {
    const failed = await failures(host => {
      const committed = new Map<string, { digest: string; receipt: Awaited<ReturnType<typeof host.flush>> }>();
      return {
        ...host,
        startRun: host.startRun.bind(host),
        heartbeat: host.heartbeat.bind(host),
        finishRun: host.finishRun.bind(host),
        async flush(flush) {
          const key = `${flush.runId}:${flush.generation}:${flush.seq}`;
          const stored = committed.get(key);
          if (stored?.digest === flush.digest) return stored.receipt;
          const receipt = await host.flush(flush);
          committed.set(key, { digest: flush.digest, receipt });
          return receipt;
        },
      };
    });
    expect(failed).toEqual(['replays a committed seq to the same receipt and refuses other content for it']);
  });

  it('catches a host that chains on nothing and one that forgets refusal codes', async () => {
    const chains = await failures(host => ({
      ...host,
      startRun: host.startRun.bind(host),
      heartbeat: host.heartbeat.bind(host),
      flush: host.flush.bind(host),
      finishRun: async request => ({ ...(await host.finishRun(request)), chain: true }),
    }));
    expect(chains).toContain(
      'finishes at the committed seq, sums counts from receipts, and replays the finish exactly',
    );

    const codes = await failures(host => ({
      ...host,
      startRun: host.startRun.bind(host),
      heartbeat: host.heartbeat.bind(host),
      finishRun: host.finishRun.bind(host),
      flush: request =>
        host.flush(request).catch((error: { status?: number }) => {
          throw Object.assign(new Error('refused'), { status: error.status });
        }),
    }));
    expect(codes).toContain('refuses a seq gap');
  });
});
