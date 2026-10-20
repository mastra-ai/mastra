import { expect, it } from 'vitest';
import { OpenAIEvidenceProvider } from '../../src/mastra/providers/evidence';
import type { ResearchContext } from '../../src/mastra/providers/evidence';
import { event, harness } from '../support/application';

// The external execution package supplies readiness, transport and durable admission controls.
// This fixture performs discovery only and never starts application workers.
it('observes_one_isolated_company_discovery', async () => {
  const control = Reflect.get(globalThis, Symbol.for('lead.isolated.search.v12')) as {
    authorize(): void;
    directory: string;
    complete(result: {
      sourceCount: number;
      preferredSourceCount: number;
      evidenceCount: number;
      budget: unknown;
    }): void;
  };
  expect(control).toBeTruthy();
  control.authorize();
  const app = await harness({ attio: null, dispatch: false, directory: control.directory });
  try {
    const response = await app.post(event('isolated-discovery', { domain: 'crisp.chat' }));
    expect(response.status).toBe(202);
    const { runId } = (await response.json()) as { runId: string };
    const { snapshot } = (await app.store.qualifications.get(runId))!;
    const deadline = await app.store.qualifications.start(runId, snapshot);
    const context: ResearchContext = {
      runId,
      snapshot,
      deadline,
      store: app.store.qualifications,
      domain: 'crisp.chat',
      domains: ['crisp.chat'],
      round: {
        index: 0,
        target: 'employeeCount',
        query: 'Find current company workforce evidence',
        gap: 'unresolved',
        year: 2026,
        searchDomains: ['crisp.chat'],
        previousEvidence: [],
        consultedUrls: [],
        missingAttributes: ['employeeCount'],
        supportedFacts: {},
        counters: { discoveredUrls: 0, retrievedPages: 0, extractedCandidates: 0, selectedCandidates: 0, urls: [] },
      },
    };
    const discovery = await new OpenAIEvidenceProvider().search('firmographics', context);
    const budget = (await app.store.qualifications.get(runId))!.budget;
    expect(budget.searchCalls).toBe(1);
    expect(budget.pageRequests).toBe(0);
    expect(budget.outputTokens).toBeLessThanOrEqual(1500);
    control.complete({
      sourceCount: discovery.sourceUrls.length,
      preferredSourceCount: discovery.preferredSourceUrls?.length ?? 0,
      evidenceCount: discovery.evidence.length,
      budget,
    });
  } finally {
    // Retain only this disposable execution's databases as isolated diagnostic evidence.
    await app.close(false);
  }
});
