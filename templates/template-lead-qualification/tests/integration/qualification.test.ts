import { EventEmitter } from 'node:events';
import https from 'node:https';
import type { ClientRequest, IncomingMessage } from 'node:http';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { qualificationConfig, qualificationConfigSchema } from '../../src/mastra/config/qualification';
import type { EvidenceProvider } from '../../src/mastra/providers/evidence';
import { LocalOutputProvider } from '../../src/mastra/providers/local/output';
import { digestValue } from '../../src/mastra/review/contracts';
import { PageRetriever, publicHttpsTransport } from '../../src/mastra/research/page-retrieval';
import type { PageTransport } from '../../src/mastra/research/page-retrieval';
import type { Assessment, Evidence, Fact } from '../../src/mastra/research/contracts';
import { assessmentSchema, candidateSchema, researchRoundSchema } from '../../src/mastra/research/contracts';
import { scoreCompany } from '../../src/mastra/tools/score-company';
import { event, harness } from '../support/application';
import { controlledHarness, controlledResearch, pageResponse, recordProvider, proposal } from '../support/research';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  for (const close of cleanup.splice(0).reverse()) await close();
});
async function researchHarness(
  research: Partial<typeof qualificationConfig.research> = {},
  config = qualificationConfig,
) {
  const { app, controlled } = await controlledHarness({
    qualification: { ...config, research: { ...config.research, ...research } },
  });
  cleanup.push(() => app.close());
  await app.mastra.startWorkers();
  return { app, controlled };
}
async function submit(
  app: Awaited<ReturnType<typeof harness>>,
  id: string,
  inquiry = false,
  lead: Record<string, unknown> = { domain: 'example.com' },
) {
  const response = await app.post(
    event(id, {
      ...lead,
      ...(inquiry
        ? {
            inquiry: {
              type: 'demo_request',
              occurredAt: new Date(Date.now() - 1000).toISOString(),
              text: 'Please show us a demo for our procurement team.',
            },
          }
        : {}),
    }),
  );
  expect(response.status).toBe(202);
  const association = await response.json();
  let assessment: Assessment | null = null;
  await vi.waitFor(
    async () => {
      const read = await app.http.request(association.statusUrl);
      expect(read.status).toBe(200);
      const body = await read.json();
      assessment = body.qualification?.assessment;
      expect(assessment).toBeTruthy();
      expect(body.status).toBe(assessment?.processingStatus === 'failed' ? 'failed' : 'intake_received');
    },
    { timeout: 20_000 },
  );
  return assessment! as Assessment;
}
async function pageContext(app: Awaited<ReturnType<typeof harness>>, id: string) {
  const { runId } = await (await app.post(event(id))).json();
  const snapshot = (await app.store.qualifications.get(runId))!.snapshot;
  const deadline = await app.store.qualifications.start(runId, snapshot);
  return {
    runId,
    deadline,
    sourceUrl: 'https://example.com/',
    domains: ['example.com'],
    providerId: 'openai-web',
    store: app.store.qualifications,
  };
}
function providerInput(request: Record<string, unknown>) {
  const input = request.input as Array<{ role: string; content: Array<{ text: string }> }>;
  return JSON.parse(input.find(message => message.role === 'user')!.content[0]!.text);
}
function accepted(value: Fact['value']): Fact {
  return {
    value,
    disposition: 'accepted',
    evidenceIds: ['supported'],
    candidateIds: ['candidate'],
    freshness: 'current',
    basis: 'observed',
  };
}

describe('sourced company qualification', () => {
  it('allows_automatic_nurture_after_inquiry_only_ambiguity_but_keeps_research_conflicts_sticky', async () => {
    for (const sourceConflict of [false, true]) {
      const config = structuredClone(qualificationConfig);
      config.sources.providerIds = ['records'];
      const provider = recordProvider('records', context =>
        context.round.index === 0
          ? sourceConflict
            ? [
                {
                  id: 'other-company',
                  source: 'https://example.com/identity',
                  excerpt: 'Two unrelated companies share this brand.',
                },
              ]
            : []
          : [
              {
                id: 'about',
                source: 'https://example.com/about',
                excerpt: 'Example Company sells software. We have 40 employees. Headquarters: United States.',
              },
            ],
      );
      provider.extract.mockImplementation(async (_branch, evidence, context) => {
        if (context.round.index === 0)
          return { companyName: null, identityAmbiguous: true, candidates: [], intentCoverageComplete: false };
        const source = evidence.find(item => item.source === 'https://example.com/about')!;
        return {
          companyName: 'Example Company',
          identityAmbiguous: false,
          intentCoverageComplete: false,
          candidates: [
            proposal('businessModel', 'b2b_saas', 'sells software', source.id),
            proposal('employeeCount', { min: 40, max: 40 }, '40 employees', source.id),
            proposal('headquartersCountry', 'US', 'Headquarters: United States', source.id),
          ],
        };
      });
      const app = await harness({ qualification: config, evidence: [provider], dispatch: true });
      cleanup.push(() => app.close());
      const response = await app.post(
        event(`inquiry-only-identity-${sourceConflict}`, {
          domain: 'example.com',
          inquiry: {
            type: 'demo_request',
            occurredAt: '2025-01-01T00:00:00Z',
            text: 'Please demonstrate this product to our buyers.',
          },
        }),
      );
      const { statusUrl, runId } = await response.json();
      await vi.waitFor(
        async () => {
          const read = await app.http.request(statusUrl);
          expect(read.status).toBe(200);
          const body = await read.json();
          const assessment = body.qualification?.assessment as Assessment;
          expect(assessment?.facts.businessModel.disposition).toBe('accepted');
          expect(assessment.facts.employeeCount.disposition).toBe('accepted');
          expect(assessment.facts.headquartersCountry.disposition).toBe('accepted');
          expect(assessment.identity.status).toBe(sourceConflict ? 'ambiguous' : 'resolved');
          expect(assessment.result).toMatchObject({
            classification: sourceConflict ? 'needs_review' : 'nurture',
            requiresReview: sourceConflict,
            score: sourceConflict ? 0 : 70,
          });
          expect(body.business).toMatchObject({
            state: sourceConflict ? 'awaiting_review' : 'applied',
            decision: null,
          });
          expect(body.business.authorization?.kind ?? null).toBe(sourceConflict ? null : 'policy');
          expect(body.business.authorization?.outcome ?? null).toBe(sourceConflict ? null : 'nurture');
        },
        { timeout: 20_000 },
      );
      const initial = (await app.store.qualifications.round(runId, 0))!;
      expect(initial.result.evidence).toHaveLength(sourceConflict ? 1 : 0);
      expect(initial.result.identityAmbiguous).toBe(sourceConflict);
      expect((await app.store.qualifications.round(runId, 1))!.result.identityAmbiguous).toBe(false);
      expect(provider.extract).toHaveBeenCalledTimes(2);
      const operation = await app.store.reviews.operation(runId, 'final');
      const destination = (await new LocalOutputProvider(app.store.client).read({
        providerId: 'local',
        reference: `inquiry-only-identity-${sourceConflict}`,
      }))!;
      expect(destination.fields).toMatchObject({
        classification: sourceConflict ? 'needs_review' : 'nurture',
        decisionSource: sourceConflict ? null : 'Automatic',
        reviewStatus: sourceConflict ? 'Awaiting review' : 'Not required',
      });
      expect(operation?.state ?? null).toBe(sourceConflict ? null : 'applied');
      expect(operation ? destination.marker === operation.id : null).toBe(sourceConflict ? null : true);
      expect((await app.reviews.read(runId))!.authorization?.patchDigest ?? null).toBe(
        operation ? digestValue(operation.patch) : null,
      );
    }
  });

  it('preserves_independent_supported_facts_after_rejected_restatement_with_actual_round_context', async () => {
    const config = structuredClone(qualificationConfig);
    const { app, controlled } = await researchHarness({}, config);
    controlled.setScenario({
      rejectRedundantBusiness: true,
      roundSources: {
        businessModel: ['https://example.com/product'],
        employeeCount: ['https://example.com/team'],
        headquartersCountry: ['https://example.com/about'],
      },
    });
    vi.mocked(controlled.transport.request).mockImplementation(async url =>
      pageResponse(
        url.pathname === '/product'
          ? 'Example sells subscription cloud software to businesses.'
          : url.pathname === '/team'
            ? '40 employees'
            : 'Headquarters: United States',
      ),
    );
    const assessment = await submit(app, 'supported-aggregation', true);
    expect(assessment.facts.businessModel).toMatchObject({
      disposition: 'accepted',
      value: 'b2b_saas',
    });
    expect(assessment.facts.employeeCount.disposition).toBe('accepted');
    expect(assessment.facts.headquartersCountry.disposition).toBe('accepted');
    expect(assessment.result.classification).toBe('qualified');
    expect(
      assessment.rejections.some(
        rejection => rejection.attribute === 'businessModel' && rejection.reason === 'semantic_verification_rejected',
      ),
    ).toBe(true);
    const inputs = controlled.requests
      .filter(request => !(request.tools as unknown[])?.length)
      .map(request => providerInput(request));
    const employee = inputs.filter(input => input.round.target === 'employeeCount');
    expect(employee).toHaveLength(2);
    expect(employee[0].round).toEqual(employee[1].round);
    expect(employee[0].round).toMatchObject({
      target: 'employeeCount',
      missingAttributes: ['employeeCount', 'headquartersCountry'],
      supportedFacts: { businessModel: { disposition: 'accepted', value: 'b2b_saas' } },
    });
    expect(employee[0].round.currentEvidenceIds).toHaveLength(1);
    expect(employee[0].round.previousEvidenceIds).toHaveLength(2);
    expect(
      employee[0].round.currentEvidenceIds.some((id: string) => employee[0].round.previousEvidenceIds.includes(id)),
    ).toBe(false);
    expect(
      [...employee[0].round.currentEvidenceIds, ...employee[0].round.previousEvidenceIds].sort((a: string, b: string) =>
        a.localeCompare(b),
      ),
    ).toEqual(
      employee[0].evidence
        .map((source: { id: string }) => source.id)
        .sort((a: string, b: string) => a.localeCompare(b)),
    );
    const headquarters = inputs.find(input => input.round.target === 'headquartersCountry');
    expect(headquarters.round.supportedFacts.businessModel?.disposition).toBe('accepted');
  });

  it('keeps_rejected_only_and_stale_firmographics_uncertain_with_supported_aggregation', async () => {
    const { app, controlled } = await researchHarness();
    const workforce = 'Sellsy, c’est une équipe de plus de 150 collaborateurs,';
    const headquarters = 'dont le siège social est situé 22 rue Alexander Fleming, 17000 La Rochelle, France';
    for (const scenario of [
      { event: 'rejected-only-supported-mode', config: { unsupported: true }, disposition: 'unsupported' },
      {
        event: 'retrieval-is-not-fact-date',
        config: { asOf: (source: Evidence) => source.retrievedAt },
        disposition: 'stale',
      },
      { event: 'undated-open-workforce', config: { asOf: null }, disposition: 'accepted' },
      {
        event: 'stale-supported-mode',
        config: { asOf: new Date(Date.now() - 31 * 86_400_000).toISOString() },
        disposition: 'stale',
      },
      {
        event: 'future-fact-date',
        config: { asOf: new Date(Date.now() + 86_400_000).toISOString() },
        disposition: 'stale',
      },
    ]) {
      controlled.setScenario({
        employees: { min: 150, max: null },
        employeeQuote: workforce,
        country: 'FR',
        countryQuote: headquarters,
        ...scenario.config,
      });
      vi.mocked(controlled.transport.request).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return pageResponse(
          `Example sells subscription cloud software to businesses. ${workforce} ${headquarters}. ${typeof scenario.config.asOf === 'string' ? `These facts apply as of ${scenario.config.asOf}.` : ''}`,
        );
      });
      const assessment = await submit(app, scenario.event, true);
      for (const attribute of ['businessModel', 'employeeCount', 'headquartersCountry'] as const)
        expect(assessment.facts[attribute].disposition).toBe(scenario.disposition);
      const undated = scenario.disposition === 'accepted';
      expect(assessment.facts.employeeCount.value).toEqual(undated ? { min: 150, max: null } : null);
      expect(assessment.facts.headquartersCountry.value).toBe(undated ? 'FR' : null);
      expect(assessment.result.contributions.find(rule => rule.rule === 'employeeCount')!.state).toBe('unknown');
      expect(assessment.result.classification).toBe('needs_review');
      const round = (await app.store.qualifications.round(assessment.runId, 0))!.result;
      expect(round.candidates).toHaveLength(scenario.disposition === 'unsupported' ? 0 : 3);
      for (const candidate of round.candidates) {
        const source = round.evidence.find(item => item.id === candidate.evidenceId)!;
        expect(source.publishedAt).toBeNull();
        expect(Date.parse(source.retrievedAt)).toBeGreaterThan(Date.parse(assessment.snapshot.assessmentTime));
        expect(candidate.asOf).toBe(
          typeof scenario.config.asOf === 'function' ? source.retrievedAt : (scenario.config.asOf ?? null),
        );
      }
    }
  });

  it('preserves_same_adapter_provenance_for_unchanged_and_changed_round_material', async () => {
    for (const changed of [false, true]) {
      const staff = 'The company has 40 employees.';
      const product = 'It sells subscription cloud software to businesses.';
      const provider = recordProvider(
        'records',
        context => [
          {
            id: 'record-1',
            source: 'https://example.com/company',
            excerpt: context.round!.index === 0 || !changed ? `${staff} ${product}` : product,
          },
        ],
        (evidence, context) =>
          context.round!.index === 0
            ? [proposal('employeeCount', { min: 40, max: 40 }, '40 employees')]
            : [
                {
                  ...proposal('businessModel', 'b2b_saas', product),
                  inference: {
                    rationale: 'The software offering serves business customers.',
                    additionalPassages: [
                      { evidenceId: evidence.find(source => source.id !== 'record-1')!.id, quote: product },
                      { evidenceId: evidence.find(source => source.id !== 'record-1')!.id, quote: '40 employees' },
                    ],
                  },
                },
              ],
      );
      const config = structuredClone(qualificationConfig);
      config.sources.providerIds = ['records'];
      config.research.targeted.order = ['employeeCount', 'businessModel'];
      const app = await harness({ qualification: config, evidence: [provider], dispatch: true });
      cleanup.push(() => app.close());
      const assessment = await submit(app, `record-alias-${changed}`);
      expect(assessment.facts.businessModel.disposition).toBe('accepted');
      expect(assessment.facts.employeeCount.disposition).toBe('accepted');
      expect(assessment.evidence).toHaveLength(changed ? 2 : 1);
      const second = (await app.store.qualifications.round(assessment.runId, 1))!;
      expect(second.result.candidates[0]!.inference!.additionalPassages).toHaveLength(changed ? 2 : 1);
      for (const passage of assessment.inferences![0]!.passages)
        expect(
          assessment.evidence.find(source => source.id === passage.evidenceId)?.excerpt.includes(passage.quote),
        ).toBe(true);
      expect(await app.qualification.qualify(assessment.runId, (await app.store.get(assessment.runId))!.event)).toEqual(
        assessment,
      );
      expect(provider.search).toHaveBeenCalledTimes(2);
    }
  });

  it('rejects_ambiguous_duplicate_ids_within_one_adapter_before_candidate_acceptance', async () => {
    const provider = recordProvider('records', () =>
      ['40 employees', '400 employees'].map((excerpt, index) => ({
        id: 'record-1',
        source: `https://example.com/report-${index}`,
        excerpt,
      })),
    );
    const config = structuredClone(qualificationConfig);
    config.sources.providerIds = ['records'];
    config.research.targeted.order = ['employeeCount'];
    const app = await harness({ qualification: config, evidence: [provider], dispatch: true });
    cleanup.push(() => app.close());
    const assessment = await submit(app, 'ambiguous-adapter-ids');
    expect(assessment.processingStatus).toBe('failed');
    expect(assessment.evidence).toEqual([]);
    expect(assessment.facts.employeeCount.disposition).toBe('missing');
    expect(assessment.failures[0]!.code).toBe('evidence_id_conflict');
    expect(provider.extract).not.toHaveBeenCalled();
  });

  it('namespaces_provider_collisions_and_remaps_main_and_additional_citations', async () => {
    const texts = {
      first: 'The company has 40 employees and sells hosted subscription cloud software.',
      second: 'Headquarters: United States. Our customers are business engineering teams.',
    };
    const adapters = (['first', 'second'] as const).map(id =>
      recordProvider(
        id,
        () => [
          {
            id: 'record-1',
            source: `https://example.com/${id}`,
            excerpt: texts[id],
          },
        ],
        evidence =>
          id === 'first'
            ? [proposal('employeeCount', { min: 40, max: 40 }, '40 employees')]
            : [
                proposal('headquartersCountry', 'US', 'Headquarters: United States'),
                {
                  ...proposal('businessModel', 'b2b_saas', 'Our customers are business engineering teams.'),
                  inference: {
                    rationale: 'Hosted subscription software and business customers establish the category.',
                    additionalPassages: [
                      {
                        evidenceId: evidence.find(source => source.providerId === 'first')!.id,
                        quote: 'sells hosted subscription cloud software',
                      },
                    ],
                  },
                },
              ],
      ),
    );
    const config = structuredClone(qualificationConfig);
    config.sources.providerIds = ['first', 'second'];
    config.research.targeted.order = ['employeeCount'];
    const app = await harness({ qualification: config, evidence: adapters, dispatch: true });
    cleanup.push(() => app.close());
    const assessment = await submit(app, 'provider-id-collision');
    expect(assessment.facts.employeeCount).toMatchObject({ disposition: 'accepted', value: { min: 40, max: 40 } });
    expect(assessment.facts.headquartersCountry).toMatchObject({ disposition: 'accepted', value: 'US' });
    expect(assessment.facts.businessModel).toMatchObject({ disposition: 'accepted', value: 'b2b_saas' });
    expect(new Set(assessment.evidence.map(source => source.id)).size).toBe(2);
    const round = (await app.store.qualifications.round(assessment.runId, 0))!;
    for (const candidate of round.result.candidates)
      for (const passage of [
        { evidenceId: candidate.evidenceId, quote: candidate.quote },
        ...(candidate.inference?.additionalPassages ?? []),
      ])
        expect(
          assessment.evidence.find(source => source.id === passage.evidenceId)?.excerpt.includes(passage.quote),
        ).toBe(true);
    expect(assessment.inferences![0]!.passages.map(passage => passage.evidenceId).sort()).toEqual(
      assessment.facts.businessModel.evidenceIds,
    );
  });

  it('targets_missing_firmographics_before_public_intent_and_selects_official_relevant_pages', async () => {
    const config = structuredClone(qualificationConfig);
    config.sources.additionalDomains = ['directory.example.org'];
    config.research.targeted.order.unshift('buyingIntent');
    const { app, controlled } = await researchHarness({}, config);
    controlled.setScenario({
      roundCitations: {
        headquartersCountry: [
          'https://off-policy.example.org/location',
          'https://example.com/company/location-details',
        ],
        employeeCount: ['https://support.example.com/en/team-management-settings'],
      },
      roundSources: {
        businessModel: [
          'https://off-policy.example.org/company',
          'https://directory.example.org/product',
          'https://example.com/pricing',
        ],
        employeeCount: [
          'https://support.example.com/en/team-management-settings',
          'https://docs.example.com/about-your-team',
          'https://example.com/podcast/company-size-of-customers',
          'https://example.com/customers/team',
          'https://example.com/categories/company',
          'https://example.com/blog/company-size/201-1000-employees/',
          'https://example.com/careers/jobs/software-engineer',
          'https://example.com/blog',
          'https://example.com/team',
          'https://career.example.com/en',
        ],
        headquartersCountry: [
          'https://help.example.com/about',
          'https://example.com/customer-stories/company',
          'https://example.com/about',
        ],
        buyingIntent: ['https://example.com/demo'],
      },
    });
    const pages: Record<string, string> = {
      '/pricing': 'Example sells subscription cloud software to businesses.',
      '/en': 'Our company has 40 employees.',
      '/team': 'Our company has 40 employees.',
      '/about': 'Headquarters: United States',
      '/company/location-details': 'Headquarters: United States',
    };
    vi.mocked(controlled.transport.request).mockImplementation(async url =>
      pageResponse(pages[url.pathname] ?? 'A marketing demo offer is not buying intent.'),
    );
    const assessment = await submit(app, 'targeted-firmographics', true);
    expect(assessment.result).toMatchObject({ classification: 'qualified', score: 100 });
    expect(vi.mocked(controlled.transport.request).mock.calls.map(([url]) => url.href)).toEqual([
      'https://example.com/pricing',
      'https://career.example.com/en',
      'https://example.com/company/location-details',
    ]);
    const searches = controlled.requests.filter(request => (request.tools as unknown[])?.length);
    const data = searches.map(request => providerInput(request));
    expect(data.map(item => item.attribute)).toEqual(['businessModel', 'employeeCount', 'headquartersCountry']);
    expect(data[1].searchQuery).toContain('employee count');
    expect(data[1].round.gap).toBe('unresolved');
    expect(data[1].round.missingAttributes).toContain('employeeCount');
    expect(data[1].round.supportedFacts.businessModel.value).toBe('b2b_saas');
    expect(data[2].searchQuery).toContain('headquarters');
    expect(data[2].searchQuery).toContain('registered office');
    for (const item of data) {
      expect(item.searchQuery).toContain('example.com');
      expect(item.searchQuery).not.toMatch(/[()]|\bOR\b|site:|-(?:inurl|filetype):/);
      expect(item.searchQuery).not.toContain(String(item.year));
      expect(item.year).toBe(new Date(assessment.snapshot.assessmentTime).getUTCFullYear());
    }
    expect(
      searches.map(
        search => (search.tools as Array<{ filters: { allowed_domains: string[] } }>)[0]!.filters.allowed_domains,
      ),
    ).toEqual([['example.com'], ['example.com', 'directory.example.org'], ['example.com', 'directory.example.org']]);
    expect(assessment.rounds?.map(round => [round.target, round.reason])).toEqual([
      ['buyingIntent', 'already_supported'],
      ['businessModel', 'completed'],
      ['employeeCount', 'completed'],
      ['headquartersCountry', 'completed'],
      ['employeeCount', 'already_supported'],
    ]);
    expect(
      assessment.rounds?.find(round => round.target === 'employeeCount' && round.reason === 'completed'),
    ).toMatchObject({
      discoveredUrls: 10,
      retrievedPages: 1,
      extractedCandidates: 2,
      selectedCandidates: 2,
      acceptedCandidates: 2,
    });
    expect(assessment.failures.some(failure => failure.code === 'unapproved_source')).toBe(true);
    expect((await app.store.qualifications.get(assessment.runId))!.budget).toMatchObject({
      searchCalls: 3,
      pageRequests: 3,
    });
    for (const [corporatePath, extension] of [
      ['who-are-we', 'pdf'],
      ['qui-sommes-nous', 'docx'],
      ['quienes-somos', 'PNG'],
    ] as const) {
      const incompatibleUrl = `https://example.com/about/team.${extension}?download=1`;
      controlled.setScenario({
        roundCitations: {
          employeeCount: [incompatibleUrl, 'https://example.com/support/team-tutorial'],
          headquartersCountry: ['https://help.example.com/contact'],
        },
        roundSources: {
          businessModel: ['https://example.com/pricing'],
          employeeCount: [
            incompatibleUrl,
            'https://example.com/legal/about-company',
            'https://example.com/privacy/team',
            'https://example.com/blog/company-size/201-1000-employees/',
            'https://example.com/careers/jobs/software-engineer',
            'https://example.com/support/team-tutorial',
            `https://example.com/${corporatePath}`,
          ],
          headquartersCountry: ['https://help.example.com/contact', 'https://example.com/legal/mentions-legales'],
        },
      });
      vi.mocked(controlled.transport.request).mockImplementation(async url =>
        pageResponse(
          url.pathname === '/pricing'
            ? 'Example sells subscription cloud software to businesses.'
            : url.pathname.includes('legal')
              ? 'Headquarters: United States'
              : 'Our company has 40 employees.',
        ),
      );
      const before = vi.mocked(controlled.transport.request).mock.calls.length;
      const corporate = await submit(app, `targeted-corporate-${corporatePath}`, true);
      expect(corporate.result.classification).toBe('qualified');
      expect(
        corporate.rounds.find(round => round.target === 'employeeCount' && round.reason === 'completed')!.urls,
      ).toContainEqual({ url: incompatibleUrl.split('?')[0], outcome: 'unsupported_format' });
      expect(corporate.failures.some(failure => failure.code === 'unsupported_source_format')).toBe(true);
      expect(corporate.evidence.some(source => source.source.includes(`team.${extension}`))).toBe(false);
      expect(
        vi
          .mocked(controlled.transport.request)
          .mock.calls.slice(before)
          .map(([url]) => url.href),
      ).toEqual([
        'https://example.com/pricing',
        `https://example.com/${corporatePath}`,
        'https://example.com/legal/mentions-legales',
      ]);
      expect((await app.store.qualifications.get(corporate.runId))!.budget).toMatchObject({
        searchCalls: 3,
        pageRequests: 3,
      });
    }
  });

  it('replays_saved_rounds_after_restart_without_repeating_paid_work', async () => {
    const controlled = controlledResearch({
      rejectRedundantBusiness: true,
      roundSources: {
        businessModel: ['https://example.com/pricing'],
        employeeCount: ['https://example.com/team'],
        headquartersCountry: ['https://example.com/about'],
      },
    });
    vi.mocked(controlled.transport.request).mockImplementation(async url =>
      pageResponse(
        url.pathname === '/pricing'
          ? 'Example sells subscription cloud software to businesses.'
          : url.pathname === '/team'
            ? '40 employees'
            : 'Headquarters: United States',
      ),
    );
    const previous = structuredClone(qualificationConfig);
    previous.policy.version = 'inbound-saas-v4';
    previous.policy.rules.employeeCount.estimates = 'review';
    const { app } = await controlledHarness({ qualification: previous }, controlled);
    cleanup.push(() => app.close());
    const { runId } = await (
      await app.post(
        event('round-restart', {
          domain: 'example.com',
          inquiry: {
            type: 'demo_request',
            occurredAt: new Date(Date.now() - 1000).toISOString(),
            text: 'Please show our procurement team a demo.',
          },
        }),
      )
    ).json();
    const save = app.store.qualifications.saveRound.bind(app.store.qualifications);
    vi.spyOn(app.store.qualifications, 'saveRound').mockImplementationOnce(async (...args) => {
      await save(...args);
      throw new Error('Controlled interruption after checkpoint');
    });
    await expect(app.qualification.qualify(runId, (await app.store.get(runId))!.event)).rejects.toThrow(
      'Controlled interruption',
    );
    const snapshot = (await app.store.qualifications.get(runId))!.snapshot;
    const checkpoint = await app.store.qualifications.round(runId, 0);
    expect(checkpoint?.diagnostic).toMatchObject({ target: 'businessModel', searchCalls: 1, pageRequests: 1 });
    const deadline = (await app.store.qualifications.get(runId))!.budget.deadlineAt;
    await app.close(false);
    const current = structuredClone(qualificationConfig);
    const { app: next } = await controlledHarness(
      {
        directory: app.directory,
        qualification: current,
      },
      controlled,
    );
    cleanup.push(() => next.close());
    await next.mastra.startWorkers();
    await vi.waitFor(async () => expect((await next.store.qualifications.get(runId))!.assessment).toBeTruthy(), {
      timeout: 20_000,
    });
    const stored = (await next.store.qualifications.get(runId))!;
    expect(stored.snapshot).toEqual(snapshot);
    expect(stored.snapshot.config.policy.version).toBe('inbound-saas-v4');
    expect(stored.snapshot.config.policy.rules.employeeCount.estimates).toBe('review');
    expect(stored.assessment!.facts.businessModel.disposition).toBe('accepted');
    expect(stored.assessment!.rejections.some(rejection => rejection.attribute === 'businessModel')).toBe(true);
    expect(stored.assessment!.result.classification).toBe('qualified');
    expect(stored.budget).toMatchObject({ searchCalls: 3, pageRequests: 3, outputTokens: 900, deadlineAt: deadline });
    expect(await next.store.qualifications.round(runId, 0)).toEqual(checkpoint);
    expect(vi.mocked(controlled.transport.request).mock.calls.map(([url]) => url.pathname)).toEqual([
      '/pricing',
      '/team',
      '/about',
    ]);
  });

  it('does_not_discover_without_get_or_downstream_token_allowance', async () => {
    const { app, controlled } = await researchHarness();
    await app.dispatcher.stop();
    for (const kind of ['pages', 'tokens'] as const) {
      const { runId } = await (await app.post(event(`no-discovery-${kind}`))).json();
      const record = (await app.store.qualifications.get(runId))!;
      await app.store.qualifications.start(runId, record.snapshot);
      if (kind === 'pages')
        for (let index = 0; index < 4; index++) await app.store.qualifications.reserve(runId, 'page');
      else await app.store.qualifications.reserve(runId, 'model', 12_000 - 383);
      const assessment = (await app.qualification.qualify(runId, (await app.store.get(runId))!.event))!;
      expect(assessment.processingStatus).toBe('failed');
      expect(assessment.rounds?.[0]).toMatchObject({ reason: 'budget_exhausted', searchCalls: 0, pageRequests: 0 });
      expect(assessment.failures[0]!.code).toBe(
        kind === 'pages' ? 'request_budget_exhausted' : 'resource_budget_exhausted',
      );
    }
    expect(controlled.requests).toHaveLength(0);
    const { runId } = await (await app.post(event('minimum-round-headroom'))).json();
    const record = (await app.store.qualifications.get(runId))!;
    await app.store.qualifications.start(runId, record.snapshot);
    await app.store.qualifications.reserve(runId, 'model', 12_000 - 384);
    const assessment = (await app.qualification.qualify(runId, (await app.store.get(runId))!.event))!;
    expect(assessment.facts.businessModel.disposition).toBe('accepted');
    expect(controlled.requests).toHaveLength(3);
    expect(controlled.requests.map(request => request.max_output_tokens)).toEqual([128, 156, 184]);
    expect((await app.store.qualifications.get(runId))!.budget.outputTokens).toBeLessThanOrEqual(12_000);
  });

  it('distinguishes_open_observations_grounded_estimates_and_advisory_employee_ranges', async () => {
    const cases = [
      {
        name: 'open',
        value: { min: 190, max: null },
        quote: '190+',
      },
      {
        name: 'open-excluded',
        value: { min: 501, max: null },
        quote: '501+',
        state: 'mismatched',
      },
      {
        name: 'estimate',
        value: { min: 180, max: 220 },
        quote: 'about 200 employees',
        inferred: true,
        state: 'matched',
      },
      {
        name: 'advisory',
        value: { min: 180, max: 220 },
        quote: 'about 200 employees',
        inferred: true,
        review: true,
      },
      {
        name: 'advisory-lower-cue',
        value: { min: 150, max: 240 },
        quote: '150+ employees',
        inferred: true,
        review: true,
        rationale:
          'Assuming a rounded workforce milestone and moderate unreported growth, 150–240 is a working estimate. The upper bound is uncertain, not a source-declared ceiling.',
      },
      {
        name: 'advisory-roster',
        value: { min: 30, max: 60 },
        quote: 'Meet our team: 30 staff profiles across the main departments',
        inferred: true,
        review: true,
        rationale:
          'Assuming these distinct staff profiles are current and cover the main departments, 30–60 allows for unlisted colleagues. Completeness and the estimated ceiling remain uncertain.',
      },
      {
        name: 'crossing',
        value: { min: 10, max: 50 },
        quote: 'about 30 employees',
        inferred: true,
      },
      {
        name: 'icp-chosen-upper',
        value: { min: 190, max: 500 },
        quote: '190+',
        inferred: true,
        reject: true,
        rationale: 'Use the configured ICP maximum of 500 as the estimated ceiling so the company qualifies.',
      },
      {
        name: 'false-observed-precision',
        value: { min: 190, max: 190 },
        quote: '190+ employees',
        reject: true,
      },
      {
        name: 'cue-free-guess',
        value: { min: 40, max: 80 },
        quote: 'Welcome to our company',
        inferred: true,
        reject: true,
        rationale: 'No workforce information is available; assume a convenient staff interval.',
      },
      {
        name: 'customer-count',
        value: { min: 150, max: 240 },
        quote: '150+ customers',
        inferred: true,
        reject: true,
        rationale: 'Treat the customer total as staff and allow uncertain growth.',
      },
      {
        name: 'job-count',
        value: { min: 30, max: 60 },
        quote: '30 open jobs',
        inferred: true,
        reject: true,
        rationale: 'Treat every vacancy as a current employee and allow uncertain growth.',
      },
      {
        name: 'false-quote',
        value: { min: 180, max: 220 },
        quote: 'about 200 employees',
        inferred: true,
        falseQuote: true,
      },
    ] as const;
    for (const item of cases) {
      const inferred = 'inferred' in item;
      const disposition = 'reject' in item || 'falseQuote' in item ? 'unsupported' : 'accepted';
      const config = structuredClone(qualificationConfig);
      config.research.targeted.order = ['employeeCount'];
      if ('review' in item) config.policy.rules.employeeCount.estimates = 'review';
      const { app, controlled } = await researchHarness({}, config);
      controlled.setScenario({
        employees: item.value,
        employeeQuote: item.quote,
        rejectEmployee: 'reject' in item,
        missingQuote: 'falseQuote' in item,
        ...(inferred
          ? {
              employeeInference: {
                rationale:
                  'rationale' in item
                    ? item.rationale
                    : 'The approximate workforce statement supports this finite estimate, independently of the ICP thresholds.',
                additionalPassages: [],
              },
            }
          : {}),
      });
      vi.mocked(controlled.transport.request).mockImplementation(async () => pageResponse(`Our team: ${item.quote}.`));
      const assessment = await submit(app, `employee-${item.name}`, true);
      expect(assessment.facts.employeeCount).toMatchObject({
        disposition: disposition,
        basis: disposition === 'accepted' && inferred ? 'inferred' : 'observed',
      });
      expect(assessment.result.contributions.find(rule => rule.rule === 'employeeCount')!.state).toBe(
        'state' in item ? item.state : 'unknown',
      );
      expect(assessment.facts.employeeCount.value).toEqual(disposition === 'accepted' ? item.value : null);
      expect(assessment.inferences.some(inference => inference.attribute === 'employeeCount')).toBe(
        disposition === 'accepted' && inferred,
      );
      expect(assessment.rejections.some(rejection => rejection.attribute === 'employeeCount')).toBe(
        disposition === 'unsupported',
      );
    }
    expect(
      candidateSchema.safeParse({
        ...proposal('employeeCount', { min: 190, max: null }, '190+'),
        inference: { rationale: 'An open range is an observation, not a finite estimate.', additionalPassages: [] },
      }).success,
    ).toBe(false);
  });

  it('reconciles_supported_employee_refinements_without_bypassing_estimate_review', async () => {
    for (const [mode, inferred, decisive] of [
      ['accept', true, false],
      ['review', true, false],
      ['review', false, false],
      ['review', true, true],
    ] as const) {
      const config = structuredClone(qualificationConfig);
      config.policy.rules.employeeCount.estimates = mode;
      config.research.targeted.order = [
        'businessModel',
        decisive ? 'headquartersCountry' : 'employeeCount',
        'employeeCount',
      ];
      const { app, controlled } = await researchHarness({}, config);
      const roundSources = {
        businessModel: ['https://example.com/product'],
        employeeCount: ['https://example.com/team'],
        headquartersCountry: ['https://example.com/team'],
      };
      const first = decisive ? { min: 100, max: 300 } : { min: 190, max: null };
      const firstQuote = decisive ? 'Employee interval: 100–300' : '190+';
      controlled.setScenario({ roundSources, employees: first, employeeQuote: firstQuote });
      vi.mocked(controlled.transport.request).mockImplementation(async url => {
        if (url.pathname === '/product')
          return pageResponse(`Example sells subscription cloud software to businesses. Team: ${firstQuote}`);
        const quote = inferred
          ? decisive
            ? 'about 175 employees'
            : 'about 220 employees'
          : 'Employee interval: 180–250';
        controlled.setScenario({
          roundSources,
          employees: decisive ? { min: 150, max: 200 } : { min: 180, max: 250 },
          employeeQuote: quote,
          ...(inferred
            ? {
                employeeInference: {
                  rationale: 'The approximate workforce statement supports this finite estimate.',
                  additionalPassages: [],
                },
              }
            : {}),
        });
        return pageResponse(`${quote}. Headquarters: United States`);
      });
      const assessment = await submit(app, `employee-refinement-${mode}-${inferred}-${decisive}`, true);
      const advisory = mode === 'review' && inferred && !decisive;
      expect(assessment.facts.employeeCount).toMatchObject({
        disposition: 'accepted',
        value: decisive ? first : { min: 190, max: 250 },
        basis: decisive || !inferred ? 'observed' : 'inferred',
      });
      expect(assessment.facts.employeeCount.evidenceIds).toHaveLength(2);
      expect(assessment.result.contributions.find(rule => rule.rule === 'employeeCount')!.state).toBe(
        advisory ? 'unknown' : 'matched',
      );
      expect(assessment.result.classification).toBe(advisory ? 'needs_review' : 'qualified');
      expect(assessment.inferences.some(inference => inference.attribute === 'employeeCount')).toBe(inferred);
      expect(assessment.rounds[1]!.missingAfter.includes('employeeCount')).toBe(advisory);
      expect(assessment.rounds[2]!.reason).toBe(advisory ? 'completed' : 'already_supported');
      const searches = controlled.requests.filter(request => (request.tools as unknown[])?.length).map(providerInput);
      expect(searches[1].round.gap).toBe(decisive ? 'unresolved' : 'lower_bound_only');
      expect(searches[1].searchQuery.includes('workforce size')).toBe(!decisive);
      expect(new Set(searches.map(search => search.searchQuery)).size).toBe(searches.length);
      expect(searches.every(search => search.searchQuery !== search.target)).toBe(true);
    }
  });

  it('reports_incomplete_analysis_honestly_in_round_and_followup_gaps', async () => {
    for (const phase of ['extraction', 'verification'] as const) {
      const provider = recordProvider(
        'records',
        context =>
          context.round.index === 3
            ? []
            : [
                {
                  id: `record-${context.round.index}`,
                  source: `https://example.com/page-${context.round.index}`,
                  excerpt: 'Headquarters: United States. No workforce number is stated in this fixture.',
                },
              ],
        (_evidence, context) => {
          if (phase === 'extraction' && context.round.index === 1) throw new Error('Controlled analysis failure');
          return context.round.index === 0
            ? [proposal('headquartersCountry', 'US', 'Headquarters: United States', 'record-0')]
            : [];
        },
      );
      const verify = vi.fn<EvidenceProvider['verify']>(async (_branch, candidates, _evidence, context) => {
        if (phase === 'verification' && context.round.index === 1) throw new Error('Controlled analysis failure');
        return { supportedCandidateIds: candidates.map(candidate => candidate.id), intentCoverageComplete: false };
      });
      const config = structuredClone(qualificationConfig);
      config.sources.providerIds = ['records'];
      config.research.targeted.order = ['employeeCount', 'employeeCount', 'headquartersCountry', 'employeeCount'];
      const app = await harness({ qualification: config, evidence: [{ ...provider, verify }], dispatch: true });
      cleanup.push(() => app.close());
      const assessment = await submit(app, `analysis-gap-${phase}`);
      expect(assessment.rounds.map(round => round.gap)).toEqual([
        'no_count_observed',
        'unresolved',
        'resolved',
        'no_count_observed',
      ]);
      expect(provider.search.mock.calls.map(([, context]) => context.round.gap)).toEqual([
        'content_unavailable',
        'no_count_observed',
        'unresolved',
      ]);
      expect(assessment.facts.employeeCount.disposition).toBe('missing');
      expect(assessment.facts.headquartersCountry.disposition).toBe('accepted');
      expect(assessment.evidence).toHaveLength(2);
      expect(assessment.failures.map(failure => failure.code)).toEqual(['provider_failed']);
      expect((await app.store.qualifications.round(assessment.runId, 0))!.diagnostic.gap).toBe('no_count_observed');
      expect((await app.store.qualifications.round(assessment.runId, 3))!.result.analysisComplete).toBe(true);
    }
  });

  it('searches_with_prior_gaps_and_sanitized_history_and_reuses_valid_material_without_another_get', async () => {
    const { app, controlled } = await researchHarness();
    controlled.setScenario({
      employees: null,
      roundSources: { businessModel: ['https://example.com/pricing?tracking=public#top'] },
    });
    const fetch = controlled.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof globalThis.fetch>(async (url, init) => {
        const body = JSON.parse(init!.body as string);
        const data = JSON.parse(
          body.input.find((message: { role: string }) => message.role === 'user').content[0].text,
        );
        if (body.tools?.length && data.attribute === 'employeeCount')
          controlled.setScenario({ roundSources: { employeeCount: [] } });
        return fetch(url, init);
      }),
    );
    const assessment = await submit(app, 'reuse-authorized-material');
    expect(assessment.facts.employeeCount).toMatchObject({ disposition: 'accepted', value: { min: 40, max: 40 } });
    expect(assessment.facts.buyingIntent.disposition).toBe('missing');
    expect(controlled.transport.request).toHaveBeenCalledTimes(1);
    const searches = controlled.requests
      .filter(request => (request.tools as unknown[])?.length)
      .map(request => providerInput(request));
    expect(searches.map(data => data.attribute)).toEqual(['businessModel', 'employeeCount']);
    expect(searches[1].round.missingAttributes).toContain('employeeCount');
    expect(searches[1].round.supportedFacts.businessModel.value).toBe('b2b_saas');
    expect(searches[1].consultedUrls).toEqual(['https://example.com/pricing']);
    expect(searches[1].priorSourceContext[0].excerpt).toContain('40 employees');
    expect(assessment.rounds![1]).toMatchObject({ retrievedPages: 0, gap: 'resolved' });
    expect(JSON.stringify(assessment.rounds)).not.toContain('tracking');
    expect(JSON.stringify(assessment.rounds)).not.toContain('40 employees');
  });

  it('reanalyzes_valid_prior_material_after_discovery_failure_and_retains_the_failure', async () => {
    const { app, controlled } = await researchHarness({ maxRetries: 0 });
    controlled.setScenario({ employees: null });
    const fetch = controlled.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof globalThis.fetch>(async (url, init) => {
        const body = JSON.parse(init!.body as string);
        const data = providerInput(body);
        if (body.tools?.length && data.attribute === 'employeeCount') {
          controlled.setScenario({});
          throw new TypeError('sensitive-marker discovery unavailable');
        }
        return fetch(url, init);
      }),
    );
    const assessment = await submit(app, 'reuse-after-discovery-failure', true);
    expect(assessment.result.classification).toBe('qualified');
    expect(assessment.facts.employeeCount).toMatchObject({ disposition: 'accepted', value: { min: 40, max: 40 } });
    expect(assessment.failures).toEqual([
      expect.objectContaining({
        code: 'provider_failed',
        retryable: true,
        provider: { stage: 'search', errorClass: 'network' },
      }),
    ]);
    expect(controlled.transport.request).toHaveBeenCalledTimes(1);
    expect(assessment.rounds[1]).toMatchObject({ retrievedPages: 0, extractedCandidates: 3, gap: 'resolved' });
    expect(JSON.stringify(assessment.failures)).not.toContain('sensitive-marker');
    const saved = await app.store.qualifications.get(assessment.runId);
    expect(saved!.assessment!.failures).toEqual(assessment.failures);
    expect(saved!.budget.outputTokens).toBeGreaterThanOrEqual(1500);
    expect(saved!.budget.outputTokens).toBeLessThanOrEqual(saved!.snapshot.config.research.maxOutputTokens);
  });

  it('rejects_future_dated_inquiry_before_any_research', async () => {
    const { app, controlled } = await researchHarness();
    const response = await app.post(
      event('future-inquiry-research', {
        domain: 'example.com',
        inquiry: {
          type: 'demo_request',
          occurredAt: new Date(Date.now() + 86_400_000).toISOString(),
          text: 'A future-dated inquiry requires confirmation.',
        },
      }),
    );
    expect(response.status).toBe(400);
    expect(controlled.requests).toHaveLength(0);
  });

  it('targets_boundary_spanning_intervals_without_overwriting_prior_conflicts', async () => {
    const { app, controlled } = await researchHarness();
    const roundSources = {
      businessModel: ['https://example.com/product'],
      employeeCount: ['https://example.com/team'],
      headquartersCountry: ['https://example.com/about'],
    };
    controlled.setScenario({ roundSources, employees: { min: 10, max: 50 }, employeeQuote: 'Employee range: 10–50.' });
    vi.mocked(controlled.transport.request).mockImplementation(async url => {
      if (url.pathname === '/product')
        return pageResponse('Example sells subscription cloud software to businesses. Employee range: 10–50.');
      controlled.setScenario({ roundSources, employees: { min: 400, max: 400 }, employeeQuote: '400 employees' });
      return pageResponse(url.pathname === '/team' ? '400 employees' : 'Headquarters: United States');
    });
    const assessment = await submit(app, 'interval-followup-conflict', true);
    const employeeInput = controlled.requests
      .filter(request => !(request.tools as unknown[])?.length)
      .map(request => providerInput(request))
      .find(input => input.round.target === 'employeeCount');
    expect(employeeInput.round.supportedFacts.employeeCount).toMatchObject({
      disposition: 'accepted',
      value: { min: 10, max: 50 },
    });
    expect(employeeInput.round.missingAttributes).toContain('employeeCount');
    expect(assessment.rounds?.[0]?.missingAfter).toContain('employeeCount');
    expect(
      (await app.store.qualifications.round(assessment.runId, 0))?.result.candidates.find(
        candidate => candidate.attribute === 'employeeCount',
      )?.value,
    ).toEqual({ min: 10, max: 50 });
    expect(
      (await app.store.qualifications.round(assessment.runId, 1))?.result.candidates.find(
        candidate => candidate.attribute === 'employeeCount',
      )?.value,
    ).toEqual({ min: 400, max: 400 });
    expect(assessment.facts.employeeCount).toMatchObject({ disposition: 'conflicting', value: null });
    expect(assessment.result.classification).toBe('needs_review');
    expect(
      assessment.rounds?.filter(round => round.target === 'employeeCount' && round.reason === 'completed'),
    ).toHaveLength(2);
  });

  it('infers_positive_and_negative_business_models_from_exact_combined_passages_and_preserves_unknown', async () => {
    const { app, controlled } = await researchHarness();
    const cases = [
      {
        label: 'b2b_saas',
        classification: 'needs_review',
        pages: [
          'Our cloud service provides an email sending API with monthly usage plans.',
          'Engineering teams at businesses use our API in their products.',
        ],
        rationale:
          'Hosted usage-based software and business engineering customers jointly establish the configured SaaS category.',
      },
      {
        label: 'other',
        classification: 'disqualified',
        pages: [
          'We manufacture desks from solid wood in our workshop.',
          'Customers order physical office furniture from our catalog.',
        ],
        rationale: 'Manufacturing and selling physical furniture affirmatively establishes a different offering.',
      },
      {
        label: null,
        classification: 'needs_review',
        pages: ['Welcome to our company.', 'Contact our team.'],
        rationale: '',
      },
    ];
    for (const item of cases) {
      vi.mocked(controlled.transport.request).mockImplementation(async url =>
        pageResponse(item.pages[url.pathname === '/product' ? 0 : 1]!),
      );
      controlled.setScenario({
        employees: null,
        country: null,
        businessModel: null,
        sourceUrls: { firmographics: ['https://example.com/product', 'https://example.com/customers'], signals: [] },
        deferIncompleteInference: true,
        ...(item.label
          ? {
              inferredBusiness: {
                label: item.label,
                quote: item.pages[0]!,
                additionalQuotes: [item.pages[1]!],
                rationale: item.rationale,
              },
            }
          : {}),
      });
      const assessment = await submit(app, `business-inference-${item.label ?? 'unknown'}`);
      expect(assessment.facts.businessModel).toMatchObject({
        disposition: item.label ? 'accepted' : 'missing',
        value: item.label,
      });
      expect(assessment.result.classification).toBe(item.classification);
      expect(assessment.facts.employeeCount.disposition).toBe('missing');
      expect(assessment.facts.headquartersCountry.disposition).toBe('missing');
      expect(assessment.facts.businessModel.evidenceIds).toHaveLength(item.label ? 2 : 0);
      expect(assessment.inferences.length > 0).toBe(Boolean(item.label));
      for (const inference of assessment.inferences) {
        expect(inference.passages.map(passage => passage.quote)).toEqual(item.pages);
        for (const passage of inference.passages)
          expect(
            assessment.evidence.find(source => source.id === passage.evidenceId)?.excerpt.includes(passage.quote),
          ).toBe(true);
      }
      expect(
        assessment.evidence.some(source => item.rationale.length > 0 && source.excerpt.includes(item.rationale)),
      ).toBe(false);
      expect(assessment.summary.includes('inference rationale')).toBe(Boolean(item.label));
    }
  });

  it('rejects_false_additional_citations_unsupported_inference_and_unconfigured_labels', async () => {
    const { app, controlled } = await researchHarness();
    for (const testCase of [
      { label: 'b2b_saas', extra: 'Invented supporting quotation.', unsupported: false, reason: 'exact_quote_absent' },
      { label: 'b2b_saas', extra: '40 employees', unsupported: true, reason: 'semantic_verification_rejected' },
      { label: 'unconfigured', extra: '40 employees', unsupported: false, reason: 'unconfigured_business_model' },
    ]) {
      controlled.setScenario({
        employees: null,
        country: null,
        unsupported: testCase.unsupported,
        inferredBusiness: {
          label: testCase.label,
          quote: 'sells subscription cloud software to businesses',
          additionalQuotes: [testCase.extra],
          rationale: 'A proposed interpretation that still requires exact attribution and independent support.',
        },
      });
      const assessment = await submit(app, `invalid-inference-${testCase.reason}`);
      expect(assessment.facts.businessModel.disposition).toBe('unsupported');
      expect(assessment.inferences).toEqual([]);
      expect(assessment.rejections.find(rejection => rejection.attribute === 'businessModel')?.reason).toBe(
        testCase.reason,
      );
      expect(assessment.result.classification).toBe('needs_review');
    }
    const base = {
      id: 'candidate',
      attribute: 'employeeCount',
      value: { min: 40, max: 40 },
      evidenceId: 'evidence',
      quote: '40 employees',
      asOf: null,
    };
    for (const invalid of [
      {
        attribute: 'headquartersCountry',
        value: 'US',
        inference: { rationale: 'Headquarters must be explicit.', additionalPassages: [] },
      },
      { attribute: 'businessModel', value: 'b2b_saas', inference: { rationale: '', additionalPassages: [] } },
      {
        attribute: 'businessModel',
        value: 'b2b_saas',
        inference: {
          rationale: 'Duplicate citations are not independent support.',
          additionalPassages: [{ evidenceId: base.evidenceId, quote: base.quote }],
        },
      },
    ])
      expect(candidateSchema.safeParse({ ...base, ...invalid }).success).toBe(false);
  });

  it('uses_captured_custom_classification_across_recovery_search_extraction_and_verification', async () => {
    const controlled = controlledResearch();
    const original = structuredClone(qualificationConfig);
    original.policy.version = 'consulting-v1';
    original.research.targeted.order = ['businessModel'];
    original.policy.rules.businessModel.categories = [
      { label: 'consultancy', criteria: 'Human-delivered technical consulting to organizations.' },
      { label: 'product', criteria: 'Selling a product without providing consulting services.' },
    ];
    original.policy.rules.businessModel.accepted = ['consultancy'];
    const consultingText = 'Our consultants deliver technical strategy workshops for business customers.';
    controlled.setScenario({
      employees: null,
      country: null,
      inferredBusiness: {
        label: 'consultancy',
        quote: consultingText,
        rationale:
          'The consulting team delivers human-led workshops to businesses, meeting the configured consulting category.',
      },
    });
    vi.mocked(controlled.transport.request).mockImplementation(async () => pageResponse(consultingText));
    const { app } = await controlledHarness(
      {
        qualification: original,
      },
      controlled,
    );
    cleanup.push(() => app.close());
    const { runId } = await (await app.post(event('captured-custom-model'))).json();
    const snapshot = (await app.store.qualifications.get(runId))!.snapshot;
    await app.close(false);
    const current = structuredClone(original);
    current.policy.version = 'retail-v2';
    current.policy.rules.businessModel.categories = [
      { label: 'retail', criteria: 'Selling physical consumer goods.' },
      { label: 'other', criteria: 'Affirmative evidence of a different offering.' },
    ];
    current.policy.rules.businessModel.accepted = ['retail'];
    current.prompts.version = 'different-prompts-v4';
    current.research.targeted.queries.businessModel = 'A new query policy for future acceptances.';
    current.prompts.extraction = 'A different extraction policy for newly accepted runs.';
    current.prompts.verification = 'A different verification policy for newly accepted runs.';
    const { app: next } = await controlledHarness(
      {
        directory: app.directory,
        qualification: current,
      },
      controlled,
    );
    cleanup.push(() => next.close());
    await next.mastra.startWorkers();
    await vi.waitFor(async () => expect((await next.store.qualifications.get(runId))!.assessment).toBeTruthy(), {
      timeout: 20_000,
    });
    const assessment = (await next.store.qualifications.get(runId))!.assessment!;
    expect(assessment.snapshot).toEqual(snapshot);
    expect(assessment.facts.businessModel).toMatchObject({ disposition: 'accepted', value: 'consultancy' });
    expect(assessment.result.contributions.find(rule => rule.rule === 'businessModel')).toMatchObject({
      state: 'matched',
      points: 30,
    });
    expect(assessment.inferences![0]!.rationale).toContain('configured consulting category');
    expect(controlled.requests).toHaveLength(3);
    for (const request of controlled.requests) {
      const data = providerInput(request);
      expect(data.businessModel).toEqual(snapshot.config.policy.rules.businessModel);
      expect(data.target ?? '').not.toContain('B2B subscription software');
    }
    const searchData = providerInput(controlled.requests.find(request => (request.tools as unknown[])?.length)!);
    expect(searchData.target).toBe(snapshot.config.research.targeted.queries.businessModel);
    for (const request of controlled.requests.filter(body => !(body.tools as unknown[])?.length)) {
      const data = providerInput(request);
      const prompt = data.candidates ? snapshot.config.prompts.verification : snapshot.config.prompts.extraction;
      expect(JSON.stringify(request)).toContain(JSON.stringify(prompt).slice(1, -1));
    }
    const invalid = structuredClone(current);
    invalid.policy.rules.businessModel.accepted = ['undeclared'];
    expect(qualificationConfigSchema.safeParse(invalid).success).toBe(false);
  });

  it('keeps_rejected_intent_unsupported_despite_complete_coverage', async () => {
    const config = structuredClone(qualificationConfig);
    config.research.targeted.order = ['businessModel', 'buyingIntent'];
    const { app, controlled } = await researchHarness({}, config);
    controlled.setScenario({ rejectedIntent: true });
    const assessment = await submit(app, 'rejected-intent-coverage');
    expect(assessment.facts.buyingIntent).toMatchObject({ disposition: 'unsupported', value: null });
    expect(assessment.result).toMatchObject({ classification: 'needs_review', score: 70, requiresReview: true });
    expect(assessment.rejections.find(rejection => rejection.attribute === 'buyingIntent')?.reason).toBe(
      'semantic_verification_rejected',
    );
    expect((await app.store.qualifications.get(assessment.runId))!.assessment).toEqual(assessment);
  });

  it('preserves_multi_provider_conflicts_and_rejections_and_reports_oversized_adapter_output', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Unexpected network access');
      }),
    );
    let rejectAll = false;
    const adapter = (id: string, employees: number, count: number): EvidenceProvider => {
      const provider = recordProvider(
        id,
        () =>
          Array.from({ length: 16 }, (_, index) => ({
            id: `${id}-${index}`,
            source: `https://example.com/${id}/${'x'.repeat(400)}/${index}`,
            excerpt: `Controlled report records ${employees} employees.`,
          })),
        () =>
          Array.from({ length: count }, (_, index) => ({
            ...proposal(
              'employeeCount',
              { min: employees, max: employees },
              `${employees} employees`,
              `${id}-${index % 16}`,
            ),
            id: `employee-${index}`,
          })),
      );
      return {
        ...provider,
        search: async (...args) => ({
          ...(await provider.search(...args)),
          sourceUrls: Array.from({ length: 16 }, (_, index) => `https://off-policy.example.org/${id}/${index}`),
        }),
        verify: async (_branch, candidates) => ({
          supportedCandidateIds: rejectAll ? [] : candidates.map(candidate => candidate.id),
          intentCoverageComplete: false,
        }),
      };
    };
    const config = structuredClone(qualificationConfig);
    config.sources.providerIds = ['first', 'second', 'oversized'];
    config.research.targeted.order = ['employeeCount'];
    const app = await harness({
      qualification: config,
      evidence: [adapter('first', 40, 16), adapter('second', 400, 16), adapter('oversized', 9999, 31)],
    });
    cleanup.push(() => app.close());
    await app.mastra.startWorkers();
    for (const reject of [false, true]) {
      rejectAll = reject;
      const assessment = await submit(app, `adapter-aggregates-${reject}`);
      expect(assessment.processingStatus).toBe('completed');
      expect(assessment.result.classification).toBe('needs_review');
      expect(assessment.facts.employeeCount.disposition).toBe(reject ? 'unsupported' : 'conflicting');
      expect(assessment.facts.employeeCount.candidateIds).toHaveLength(reject ? 0 : 32);
      expect(assessment.rejections).toHaveLength(reject ? 32 : 0);
      expect(assessment.evidence).toHaveLength(48);
      expect(assessment.failures).toHaveLength(49);
      expect(assessment.failures).toContainEqual({
        branch: 'firmographics',
        providerId: 'oversized',
        code: 'provider_extraction_invalid',
        retryable: false,
      });
      expect(assessment.summary.length).toBeLessThan(10_000);
      expect(assessment.summary.includes('31 additional evidence references in the assessment.')).toBe(!reject);
      expect(assessment.facts.employeeCount.evidenceIds).toHaveLength(reject ? 0 : 32);
      const branch = await app.store.qualifications.round(assessment.runId, 0);
      expect(branch!.result.candidates).toHaveLength(reject ? 0 : 32);
      expect(branch!.result.rejections).toHaveLength(reject ? 32 : 0);
      expect(branch!.result.evidence).toHaveLength(48);
      expect((await app.store.qualifications.get(assessment.runId))!.assessment).toEqual(assessment);
    }
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('falls_through_oversized_returned_pages_into_real_decoder_extraction', async () => {
    const { app, controlled } = await researchHarness({ maxPageBytes: 262_144, maxTotalPageBytes: 1_048_576 });
    controlled.setScenario({
      sourceUrls: {
        firmographics: ['a-large', 'b-large', 'c-usable', 'd-unused'].map(path => `https://example.com/${path}`),
        signals: [],
      },
    });
    vi.mocked(controlled.transport.request).mockImplementation(async url =>
      url.pathname === '/c-usable'
        ? pageResponse(`<main>${controlled.pageText}</main>`)
        : pageResponse('Rejected oversized material', 200, {
            'content-type': 'text/html',
            'content-length': '262145',
          }),
    );
    const assessment = await submit(app, 'page-fallthrough', true);
    expect(assessment.processingStatus).toBe('completed');
    expect(assessment.result.classification).toBe('qualified');
    expect(assessment.facts.employeeCount.disposition).toBe('accepted');
    const website = assessment.evidence.filter(source => source.kind === 'website');
    expect(website).toHaveLength(1);
    expect(website[0]).toMatchObject({ source: 'https://example.com/c-usable', excerpt: controlled.pageText });
    expect(vi.mocked(controlled.transport.request).mock.calls.map(([url]) => url.pathname)).toEqual([
      '/a-large',
      '/b-large',
      '/c-usable',
    ]);
    expect((await app.store.qualifications.get(assessment.runId))!.budget.pageRequests).toBe(3);
    expect(assessment.failures.filter(failure => failure.code === 'page_byte_limit')).toHaveLength(2);
    expect(assessment.failures.find(failure => failure.page)?.page).toEqual({
      phase: 'declared_too_large',
      declaredLength: 262145,
      encoding: 'identity',
      observedCompressedBytes: 0,
      observedDecodedBytes: 0,
      byteCap: 262144,
    });
    const structured = controlled.requests.filter(body => !(body.tools as unknown[])?.length);
    expect(structured).toHaveLength(2);
    expect(
      structured.every(request => (request.text as { format: { type: string } }).format.type === 'json_schema'),
    ).toBe(true);
    expect(JSON.stringify(assessment)).not.toContain('Rejected oversized material');
  });

  it('persists_safe_distinct_reasons_for_rejected_candidates', async () => {
    const { app, controlled } = await researchHarness();
    for (const testCase of [
      {
        scenario: { unknownEvidence: true },
        reason: 'unknown_evidence_id',
        checks: { evidenceKnown: false, exactQuotePresent: false, semanticSupported: true },
      },
      {
        scenario: { missingQuote: true },
        reason: 'exact_quote_absent',
        checks: { evidenceKnown: true, exactQuotePresent: false, semanticSupported: true },
      },
      {
        scenario: { unsupported: true },
        reason: 'semantic_verification_rejected',
        checks: { evidenceKnown: true, exactQuotePresent: true, semanticSupported: false },
      },
    ]) {
      controlled.setScenario(testCase.scenario);
      const assessment = await submit(app, `rejection-${testCase.reason}`, true);
      expect(assessment.facts.businessModel.disposition).toBe('unsupported');
      expect(assessment.rejections.length).toBeGreaterThanOrEqual(3);
      expect(assessment.rejections.every(rejection => rejection.reason === testCase.reason)).toBe(true);
      expect(assessment.rejections.find(rejection => rejection.attribute === 'businessModel')).toMatchObject({
        branch: 'firmographics',
        value: 'b2b_saas',
        checks: testCase.checks,
      });
      for (const rejection of assessment.rejections) {
        expect(rejection.candidateId).toMatch(/^candidate-[a-f0-9]{24}$/);
        expect(rejection.evidenceId).toMatch(/^evidence-[a-f0-9]{24}$/);
      }
      const diagnostic = JSON.stringify(assessment.rejections);
      expect(diagnostic).not.toContain('private-unknown-evidence-id');
      expect(diagnostic).not.toContain('invented quotation');
      const unknown = testCase.reason === 'unknown_evidence_id';
      expect(assessment.rejections.every(rejection => rejection.diagnostic === undefined)).toBe(unknown);
      const detail = assessment.rejections.find(rejection => rejection.attribute === 'businessModel')!.diagnostic;
      expect(detail?.version ?? null).toBe(unknown ? null : 1);
      expect(detail?.verificationContract ?? null).toBe(unknown ? null : 'supported_candidate_ids');
      const passage = detail?.passages[0];
      expect(
        passage
          ? {
              exactQuotePresent: passage.exactQuotePresent,
              publicText: passage.quote.publicText,
              omission: passage.quote.omission,
            }
          : null,
      ).toEqual(
        unknown
          ? null
          : {
              exactQuotePresent: testCase.checks.exactQuotePresent,
              publicText:
                testCase.reason === 'exact_quote_absent' ? null : 'sells subscription cloud software to businesses',
              omission: testCase.reason === 'exact_quote_absent' ? 'not_public_literal' : null,
            },
      );
      const source = assessment.evidence.find(item => item.id === passage?.evidenceId);
      expect(passage?.evidenceDigest ?? null).toBe(unknown ? null : source!.digest);
      expect((await app.store.qualifications.get(assessment.runId))!.assessment!.rejections).toEqual(
        assessment.rejections,
      );
    }
  });

  it('reopens_legacy_rejections_and_resumes_saved_public_rejection_diagnostics_without_research', async () => {
    const config = structuredClone(qualificationConfig);
    config.research.targeted.order = ['businessModel'];
    const controlled = controlledResearch({ unsupported: true });
    const { app } = await controlledHarness({ qualification: config }, controlled);
    const directory = app.directory;
    cleanup.push(() => app.close());
    const assessments: Assessment[] = [];
    for (const id of ['legacy-rejection', 'current-rejection']) {
      const { runId } = await (await app.post(event(id))).json();
      assessments.push((await app.qualification.qualify(runId, (await app.store.get(runId))!.event))!);
    }
    const legacy = assessments[0]!;
    const current = assessments[1]!;
    const legacyRound = (await app.store.qualifications.round(legacy.runId, 0))!;
    for (const rejection of [...legacy.rejections, ...legacyRound.result.rejections]) delete rejection.diagnostic;
    expect(assessmentSchema.parse(legacy)).toEqual(legacy);
    expect(researchRoundSchema.parse(legacyRound)).toEqual(legacyRound);
    const legacyJson = JSON.stringify(legacy);
    const legacyRoundJson = JSON.stringify(legacyRound);
    await app.store.client.execute({
      sql: 'UPDATE lead_qualifications SET assessment_json=? WHERE run_id=?',
      args: [legacyJson, legacy.runId],
    });
    await app.store.client.execute({
      sql: 'UPDATE lead_research_rounds SET result_json=? WHERE run_id=?',
      args: [legacyRoundJson, legacy.runId],
    });
    const currentRound = (await app.store.qualifications.round(current.runId, 0))!;
    expect(currentRound.result.rejections.some(rejection => rejection.diagnostic)).toBe(true);
    // Simulate interruption after a durable round but before the final assessment.
    await app.store.client.execute({
      sql: 'UPDATE lead_qualifications SET assessment_json=NULL WHERE run_id=?',
      args: [current.runId],
    });
    await app.close(false);
    controlled.fetch.mockClear();
    vi.mocked(controlled.transport.request).mockClear();
    const { app: reopened } = await controlledHarness({ directory, qualification: config }, controlled);
    cleanup.push(() => reopened.close());
    expect((await reopened.store.qualifications.get(legacy.runId))!.assessment).toEqual(legacy);
    expect((await reopened.store.qualifications.round(legacy.runId, 0))!).toEqual(legacyRound);
    expect(await reopened.qualification.qualify(legacy.runId, (await reopened.store.get(legacy.runId))!.event)).toEqual(
      legacy,
    );
    const resumed = (await reopened.qualification.qualify(
      current.runId,
      (await reopened.store.get(current.runId))!.event,
    ))!;
    expect(resumed.rejections).toEqual(current.rejections);
    expect(resumed.result).toEqual(current.result);
    expect(resumed.snapshot).toEqual(current.snapshot);
    expect((await reopened.store.qualifications.round(current.runId, 0))!).toEqual(currentRound);
    expect(controlled.fetch).not.toHaveBeenCalled();
    expect(controlled.transport.request).not.toHaveBeenCalled();
    expect(
      (
        await reopened.store.client.execute({
          sql: 'SELECT assessment_json FROM lead_qualifications WHERE run_id=?',
          args: [legacy.runId],
        })
      ).rows[0]!.assessment_json,
    ).toBe(legacyJson);
    expect(
      (
        await reopened.store.client.execute({
          sql: 'SELECT result_json FROM lead_research_rounds WHERE run_id=?',
          args: [legacy.runId],
        })
      ).rows[0]!.result_json,
    ).toBe(legacyRoundJson);
  });

  it('stops_returned_page_fallthrough_at_shared_budget_including_redirects', async () => {
    const { app, controlled } = await researchHarness({ maxPageBytes: 262_144, maxTotalPageBytes: 1_048_576 });
    for (const redirect of [false, true]) {
      controlled.setScenario({
        sourceUrls: {
          firmographics: ['a-large', 'b-large', 'c-large', 'd-large', 'e-unused', 'f-unused'].map(
            path => `https://example.com/${path}`,
          ),
          signals: [],
        },
      });
      vi.mocked(controlled.transport.request)
        .mockClear()
        .mockImplementation(async url =>
          redirect && url.pathname === '/a-large'
            ? pageResponse('', 302, { location: '/redirected-large' })
            : pageResponse('Rejected oversized material', 200, {
                'content-type': 'text/html',
                'content-length': '262145',
              }),
        );
      const assessment = await submit(app, `page-exhaustion-${redirect}`);
      expect(assessment.processingStatus).toBe('failed');
      expect(assessment.evidence).toHaveLength(0);
      expect((await app.store.qualifications.get(assessment.runId))!.budget).toMatchObject({
        pageRequests: 4,
        compressedBytes: 1048576,
        decodedBytes: 1048576,
      });
      expect(vi.mocked(controlled.transport.request).mock.calls.map(([url]) => url.pathname)).toEqual(
        redirect
          ? ['/a-large', '/redirected-large', '/b-large', '/c-large']
          : ['/a-large', '/b-large', '/c-large', '/d-large'],
      );
      expect(assessment.failures.some(failure => failure.code === 'request_budget_exhausted')).toBe(true);
      expect(assessment.failures.filter(failure => failure.page)).toHaveLength(redirect ? 3 : 4);
    }
    expect(controlled.requests.every(body => (body.tools as unknown[])?.length)).toBe(true);
  });

  it('captures_returned_opened_pages_and_final_citations_through_responses_decoder', async () => {
    const { app, controlled } = await researchHarness();
    for (const sourceMode of ['opened_page', 'final_citation'] as const) {
      controlled.setScenario({ sourceMode });
      const assessment = await submit(app, `returned-${sourceMode}`, true);
      expect(assessment.result.classification).toBe('qualified');
      expect(assessment.evidence.filter(source => source.kind === 'website')).toHaveLength(1);
      expect(assessment.facts.businessModel.disposition).toBe('accepted');
    }
    expect(
      controlled.requests
        .filter(body => (body.tools as unknown[])?.length)
        .every(body => (body.include as string[]).includes('web_search_call.action.sources')),
    ).toBe(true);
    const structured = controlled.requests.filter(body => !(body.tools as unknown[])?.length);
    expect(structured).toHaveLength(4);
    for (const request of structured)
      expect(request.text).toMatchObject({
        format: { type: 'json_schema', strict: true, schema: { type: 'object', additionalProperties: false } },
      });
    const schemas = structured.map(
      request =>
        (request.text as { format: { schema: { properties: Record<string, unknown> } } }).format.schema.properties,
    );
    expect(schemas.filter(schema => 'candidates' in schema)).toHaveLength(2);
    expect(schemas.filter(schema => 'supportedCandidateIds' in schema)).toHaveLength(2);
  });

  it('qualifies_a_company_from_approved_evidence', async () => {
    const { app, controlled } = await researchHarness();
    const assessment = await submit(app, 'qualified', true);
    expect(assessment.result).toMatchObject({ classification: 'qualified', score: 100, requiresReview: false });
    expect(assessment.result.contributions.map(rule => rule.points)).toEqual([30, 25, 15, 30]);
    expect(assessment.evidence).toHaveLength(2);
    for (const fact of Object.values(assessment.facts)) {
      expect(fact.disposition).toBe('accepted');
      expect(fact.evidenceIds.every(id => assessment.evidence.some(source => source.id === id))).toBe(true);
    }
    expect(
      assessment.evidence
        .filter(source => source.kind === 'website')
        .every(source => source.excerpt === controlled.pageText),
    ).toBe(true);
    expect(assessment.summary).toContain(`[${assessment.facts.employeeCount.evidenceIds[0]}]`);
    expect(assessment.summary).not.toContain('Controlled search response');
    expect(controlled.requests.filter(body => (body.tools as unknown[])?.length)).toHaveLength(1);
    for (const body of controlled.requests) {
      expect(body.model).toBe('gpt-6-luna');
      expect(body.store).toBe(false);
      expect(Number(body.max_output_tokens)).toBeLessThanOrEqual(2000);
    }
    const stored = (await app.store.qualifications.get(assessment.runId))!;
    expect(stored.budget).toMatchObject({ searchCalls: 1, pageRequests: 1, outputTokens: 300 });
    expect(stored.assessment).toEqual(assessment);
    expect(Object.keys(app.mastra.listAgents())).toHaveLength(0);
    const snapshot = await app.intake.workflow.getWorkflowRunById(assessment.runId);
    expect(snapshot?.status).toBe('success');
    expect(snapshot?.steps).toHaveProperty('qualify-company');
    const search = controlled.requests.find(body => (body.tools as unknown[])?.length)!;
    expect(providerInput(search).round.supportedFacts.buyingIntent.disposition).toBe('accepted');
    const oldInquiry = await submit(app, 'expired-inquiry', false, {
      domain: 'example.com',
      inquiry: {
        type: 'demo_request',
        occurredAt: new Date(Date.now() - 91 * 86_400_000).toISOString(),
        text: 'An earlier demo request.',
      },
    });
    expect(oldInquiry.result).toMatchObject({ classification: 'nurture', score: 70 });
    const calls = controlled.requests.length;
    expect(await app.qualification.qualify(assessment.runId, (await app.store.get(assessment.runId))!.event)).toEqual(
      assessment,
    );
    expect(controlled.requests).toHaveLength(calls);
    const directory = app.directory;
    await app.close(false);
    const changed = structuredClone(qualificationConfig);
    changed.policy.rules.employeeCount.max = 39;
    const { app: next } = await controlledHarness(
      {
        directory,
        qualification: changed,
        dispatch: true,
      },
      controlled,
    );
    cleanup.push(() => next.close());
    expect((await next.store.qualifications.get(assessment.runId))?.assessment).toEqual(assessment);
    const fresh = await submit(next, 'new-policy', true);
    expect(fresh.snapshot.digest).not.toBe(assessment.snapshot.digest);
    expect(fresh.snapshot.config.policy.version).toBe(assessment.snapshot.config.policy.version);
    expect(fresh.result).toMatchObject({ classification: 'disqualified', score: 75 });
  });

  it('routes_ambiguous_partial_and_conflicting_evidence_to_review', async () => {
    const { app, controlled } = await researchHarness();
    const ambiguous = await submit(app, 'email-candidate', false, { email: 'buyer@example.com' });
    expect(ambiguous.identity.status).toBe('ambiguous');
    expect(ambiguous.result.classification).toBe('needs_review');
    expect(controlled.requests).toHaveLength(0);
    controlled.setScenario({ conflict: true });
    const conflict = await submit(app, 'conflicting');
    expect(conflict.facts.employeeCount.disposition).toBe('conflicting');
    expect(conflict.result.classification).toBe('needs_review');
    controlled.setScenario({ failSignals: true });
    const partial = await submit(app, 'partial');
    expect(partial.facts.businessModel.disposition).toBe('accepted');
    expect(partial.evidence.length).toBeGreaterThan(0);
    expect(
      controlled.requests.filter(request => JSON.stringify(request).includes('dated explicit purchase inquiries')),
    ).toHaveLength(0);
    expect(partial.facts.buyingIntent.disposition).toBe('missing');
    expect(partial.result.classification).toBe('needs_review');
    controlled.setScenario({ country: null });
    const missing = await submit(app, 'missing-country');
    expect(missing.result.reviewReasons.join(' ')).toContain('Headquarters country');
    expect(missing.result.nextAction).toContain('confirm headquarters');
    controlled.setScenario({ ambiguous: true });
    expect((await submit(app, 'subsidiary-conflict')).identity.status).toBe('ambiguous');
  });

  it('scores_icp_boundaries_and_disqualifiers_consistently', async () => {
    const policy = structuredClone(qualificationConfig.policy);
    const input = {
      identity: {
        status: 'resolved' as const,
        domain: 'example.com',
        companyName: 'Example',
        candidates: ['example.com'],
        reason: 'Confirmed domain',
      },
      facts: {
        businessModel: accepted('b2b_saas'),
        employeeCount: accepted({ min: 20, max: 20 }),
        headquartersCountry: accepted('BR'),
        buyingIntent: accepted([{ type: 'purchase_inquiry', occurredAt: '2026-07-19T00:00:00Z' }]),
      },
      policy,
      routing: qualificationConfig.routing,
      assessmentTime: '2026-10-17T00:00:00Z',
    };
    for (const employees of [20, 500]) {
      input.facts.employeeCount = accepted({ min: employees, max: employees });
      const first = scoreCompany(input);
      expect(first).toMatchObject({ classification: 'qualified', score: 100 });
      expect(JSON.stringify(scoreCompany(input))).toBe(JSON.stringify(first));
    }
    for (const employees of [19, 501]) {
      input.facts.employeeCount = accepted({ min: employees, max: employees });
      expect(scoreCompany(input)).toMatchObject({ classification: 'disqualified', score: 75 });
    }
    input.facts.employeeCount = accepted({ min: 10, max: 50 });
    expect(scoreCompany(input)).toMatchObject({ classification: 'needs_review', score: 75 });
    input.facts.employeeCount = accepted({ min: 40, max: 40 });
    input.facts.buyingIntent = accepted([]);
    expect(scoreCompany(input)).toMatchObject({ classification: 'nurture', score: 70 });
    input.facts.businessModel = accepted('other');
    input.facts.headquartersCountry = {
      ...accepted(null),
      disposition: 'missing',
      freshness: 'unknown',
      evidenceIds: [],
    };
    expect(scoreCompany(input).classification).toBe('disqualified');
    input.facts.businessModel = accepted('b2b_saas');
    input.facts.headquartersCountry = accepted('AU');
    expect(scoreCompany(input).classification).toBe('disqualified');
    input.facts.headquartersCountry = accepted('DE');
    input.facts.buyingIntent = accepted([{ type: 'demo_request', occurredAt: null }]);
    expect(scoreCompany(input).classification).toBe('needs_review');
    input.facts.buyingIntent = accepted([{ type: 'demo_request', occurredAt: '2026-10-18T00:00:00Z' }]);
    expect(scoreCompany(input).classification).toBe('needs_review');
    input.facts.buyingIntent = accepted([]);
    policy.rules.businessModel.points = 25;
    policy.rules.buyingIntent.points = 35;
    expect(scoreCompany(input)).toMatchObject({ classification: 'nurture', score: 65 });
    expect(
      scoreCompany({
        ...input,
        routing: { automaticOutcomes: ['qualified', 'disqualified'], reviewOutcomes: ['needs_review', 'nurture'] },
      }).requiresReview,
    ).toBe(true);
  });

  it('excludes_unapproved_sources_and_bounds_research', async () => {
    const { app, controlled } = await researchHarness();
    controlled.setScenario({ unapproved: true });
    const rejected = await submit(app, 'off-policy');
    expect(rejected.evidence).toHaveLength(0);
    expect(controlled.transport.request).not.toHaveBeenCalled();
    expect(rejected.failures.some(failure => failure.code === 'unapproved_source')).toBe(true);
    controlled.setScenario({ injection: true });
    const injected = await submit(app, 'injection');
    expect(injected.result).toMatchObject({ classification: 'needs_review', score: 70 });
    expect(injected.evidence.some(source => source.excerpt.includes('write CRM'))).toBe(true);
    expect(
      controlled.requests.every(
        body => !(body.tools as Array<{ type: string }> | undefined)?.some(tool => tool.type !== 'web_search'),
      ),
    ).toBe(true);
    // Crash with unknown calls in flight. A later process must not recover their allowance.
    await app.dispatcher.stop();
    const pending = await app.post(event('interrupted'));
    const { runId } = await pending.json();
    // Stop dispatch before it can start this new run.
    const before = (await app.store.qualifications.get(runId))!;
    await app.store.qualifications.start(runId, before.snapshot);
    const reservations = await Promise.all(
      Array.from({ length: 4 }, () => app.store.qualifications.reserve(runId, 'search', 1500)),
    );
    expect(reservations).toHaveLength(4);
    const directory = app.directory;
    await app.close(false);
    const { app: restarted } = await controlledHarness(
      {
        directory,
      },
      controlled,
    );
    cleanup.push(() => restarted.close());
    expect((await restarted.store.qualifications.get(runId))!.budget).toMatchObject({
      searchCalls: 4,
      outputTokens: 6000,
    });
    await expect(restarted.store.qualifications.reserve(runId, 'search', 128)).rejects.toMatchObject({
      code: 'request_budget_exhausted',
    });
    const callsBefore = controlled.requests.length;
    await restarted.mastra.startWorkers();
    await vi.waitFor(async () =>
      expect((await restarted.store.qualifications.get(runId))?.assessment?.result.classification).toBe('needs_review'),
    );
    expect(controlled.requests).toHaveLength(callsBefore);
    const account = (await restarted.store.qualifications.get(runId))!;
    expect(account.budget.searchCalls).toBe(4);
  });
});

describe('bounded HTTPS evidence transport', () => {
  it('pins_public_dns_and_revalidates_every_redirect_without_private_connections', async () => {
    const app = await harness();
    cleanup.push(() => app.close());
    const context = await pageContext(app, 'redirect');
    const { runId } = context;
    const resolver = vi
      .fn<PageTransport['resolve']>()
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }]);
    const connected: string[] = [];
    const request = vi.spyOn(https, 'request').mockImplementation(((
      url: URL,
      options: https.RequestOptions,
      callback: (response: IncomingMessage) => void,
    ) => {
      expect(url.hostname).toBe('example.com');
      expect(options.servername).toBe('example.com');
      expect(options.rejectUnauthorized).toBe(true);
      options.lookup!('example.com', {}, (error, address) => {
        expect(error).toBeNull();
        connected.push(typeof address === 'string' ? address : 'unexpected-array');
      });
      const req = new EventEmitter() as ClientRequest;
      req.end = (() => {
        queueMicrotask(() => callback(pageResponse('', 302, { location: 'https://www.example.com/private' })));
        return req;
      }) as ClientRequest['end'];
      return req;
    }) as typeof https.request);
    const retriever = new PageRetriever({ ...publicHttpsTransport, resolve: resolver });
    await expect(retriever.retrieve(context)).rejects.toMatchObject({ code: 'unsafe_source_address' });
    expect(request).toHaveBeenCalledTimes(1);
    expect(connected).toEqual(['93.184.216.34']);
    expect(resolver).toHaveBeenCalledTimes(2);
    expect((await app.store.qualifications.get(runId))!.budget.pageRequests).toBe(2);
    for (const address of [
      '::1',
      '::ffff:127.0.0.1',
      'fc00::1',
      '2001:db8::1',
      '169.254.169.254',
      '100.64.0.1',
      '224.0.0.1',
    ]) {
      const deniedContext = await pageContext(app, `private-${address.replaceAll(':', '-')}`);
      const denied = new PageRetriever({
        ...publicHttpsTransport,
        resolve: async () => [{ address, family: address.includes(':') ? 6 : 4 }],
      });
      await expect(denied.retrieve(deniedContext)).rejects.toMatchObject({ code: 'unsafe_source_address' });
    }
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('stops_before_dns_when_reservation_outlasts_deadline_and_aborts_pending_dns', async () => {
    const app = await harness();
    cleanup.push(() => app.close());
    for (const delayedReservation of [true, false]) {
      const { runId } = await (await app.post(event(`dns-deadline-${delayedReservation}`))).json();
      const snapshot = (await app.store.qualifications.get(runId))!.snapshot;
      await app.store.qualifications.start(runId, snapshot);
      const reserve = app.store.qualifications.reserve.bind(app.store.qualifications);
      const reservation = vi.spyOn(app.store.qualifications, 'reserve');
      if (delayedReservation)
        reservation.mockImplementationOnce(async (...args) => {
          await new Promise(resolve => setTimeout(resolve, 30));
          return reserve(...args);
        });
      const transport: PageTransport = {
        resolve: vi.fn<PageTransport['resolve']>(async () => new Promise<never>(() => {})),
        request: vi.fn<PageTransport['request']>(async () => {
          throw new Error('Unexpected network request');
        }),
      };
      await expect(
        new PageRetriever(transport).retrieve({
          runId,
          sourceUrl: 'https://example.com/',
          domains: ['example.com'],
          providerId: 'openai-web',
          deadline: Date.now() + (delayedReservation ? 10 : 100),
          store: app.store.qualifications,
        }),
      ).rejects.toMatchObject({ code: 'deadline_exhausted' });
      expect(transport.resolve).toHaveBeenCalledTimes(delayedReservation ? 0 : 1);
      expect(transport.request).not.toHaveBeenCalled();
      expect((await app.store.qualifications.get(runId))!.budget.pageRequests).toBe(1);
      reservation.mockRestore();
    }
  });

  it('accepts_exactly_two_mib_and_rejects_enlarged_compressed_and_decoded_overflow', async () => {
    const cap = 2_097_152;
    expect(qualificationConfig.research).toMatchObject({ maxPageBytes: cap, maxTotalPageBytes: 8_388_608 });
    const oversizedConfiguration = structuredClone(qualificationConfig);
    oversizedConfiguration.research.maxPageBytes = 8_388_609;
    expect(qualificationConfigSchema.safeParse(oversizedConfiguration).success).toBe(false);
    const app = await harness();
    cleanup.push(() => app.close());
    const context = await pageContext(app, 'enlarged-bytes');
    const { runId } = context;
    const exact = Buffer.alloc(cap, 'x');
    const transport = {
      resolve: async () => [{ address: '93.184.216.34', family: 4 }],
      request: vi.fn<PageTransport['request']>(async () =>
        pageResponse(exact, 200, { 'content-type': 'text/plain', 'content-length': String(cap) }),
      ),
    };
    const retrieve = () => new PageRetriever(transport).retrieve(context);
    expect((await retrieve()).excerpt).toBe('x'.repeat(24_000));
    const compressed = gzipSync(exact);
    transport.request.mockImplementation(async () =>
      pageResponse(compressed, 200, { 'content-type': 'text/plain', 'content-encoding': 'gzip' }),
    );
    expect((await retrieve()).excerpt).toBe('x'.repeat(24_000));
    expect((await app.store.qualifications.get(runId))!.budget).toMatchObject({
      compressedBytes: cap + compressed.length,
      decodedBytes: cap * 2,
    });
    transport.request.mockImplementation(async () =>
      pageResponse(Buffer.alloc(cap + 1), 200, { 'content-type': 'text/plain' }),
    );
    await expect(retrieve()).rejects.toMatchObject({
      code: 'page_byte_limit',
      page: { phase: 'compressed_overflow', observedCompressedBytes: cap + 1, byteCap: cap },
    });
    transport.request.mockImplementation(async () =>
      pageResponse(gzipSync(Buffer.alloc(cap + 1, 'x')), 200, {
        'content-type': 'text/plain',
        'content-encoding': 'gzip',
      }),
    );
    await expect(retrieve()).rejects.toMatchObject({
      code: 'page_byte_limit',
      page: { phase: 'decoded_overflow', observedDecodedBytes: cap + 1, byteCap: cap },
    });
    expect((await app.store.qualifications.get(runId))!.budget).toMatchObject({
      pageRequests: 4,
      decodedBytes: 8_388_608,
    });
  });

  it('bounds_compressed_decoded_and_shared_bytes_and_absolute_deadline', async () => {
    const config = structuredClone(qualificationConfig);
    config.research.maxPageBytes = 64;
    config.research.maxTotalPageBytes = 128;
    const app = await harness({ qualification: config });
    cleanup.push(() => app.close());
    const context = await pageContext(app, 'bytes');
    const { runId } = context;
    const compressed = gzipSync('x'.repeat(1000));
    const transport = {
      resolve: async () => [{ address: '93.184.216.34', family: 4 }],
      request: vi.fn<PageTransport['request']>(async () =>
        pageResponse(compressed, 200, { 'content-type': 'text/plain', 'content-encoding': 'gzip' }),
      ),
    };
    const retrieve = () => new PageRetriever(transport).retrieve(context);
    await expect(retrieve()).rejects.toMatchObject({
      code: 'page_byte_limit',
      page: {
        phase: 'decoded_overflow',
        declaredLength: null,
        encoding: 'gzip',
        observedCompressedBytes: compressed.length,
        observedDecodedBytes: 1000,
        byteCap: 64,
      },
    });
    transport.request.mockImplementation(async () =>
      pageResponse(Buffer.alloc(65), 200, { 'content-type': 'text/plain' }),
    );
    await expect(retrieve()).rejects.toMatchObject({
      code: 'page_byte_limit',
      page: {
        phase: 'compressed_overflow',
        declaredLength: null,
        encoding: 'identity',
        observedCompressedBytes: 65,
        observedDecodedBytes: 0,
        byteCap: 64,
      },
    });
    await expect(retrieve()).rejects.toMatchObject({ code: 'resource_budget_exhausted' });
    expect(transport.request).toHaveBeenCalledTimes(2);
    const budget = (await app.store.qualifications.get(runId))!.budget;
    expect(budget).toMatchObject({ compressedBytes: 128, decodedBytes: 128, pageRequests: 2 });
    await app.store.client.execute({
      sql: 'UPDATE lead_qualifications SET deadline_at=? WHERE run_id=?',
      args: [Date.now() - 1, runId],
    });
    await expect(app.store.qualifications.reserve(runId, 'model', 1000)).rejects.toMatchObject({
      code: 'deadline_exhausted',
    });
  });
});
