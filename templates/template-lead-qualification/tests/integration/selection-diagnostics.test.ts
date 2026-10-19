import { afterEach, describe, expect, it, vi } from 'vitest';
import { qualificationConfig } from '../../src/mastra/config/qualification';
import { researchRoundSchema } from '../../src/mastra/research/contracts';
import type { Assessment } from '../../src/mastra/research/contracts';
import { event } from '../support/application';
import { controlledHarness, controlledResearch, pageResponse } from '../support/research';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  for (const close of cleanup.splice(0)) await close();
});
async function research(
  sources: string[],
  citations: string[] = [],
  options: { repeat?: boolean; employees?: null; maxPageRequests?: number } = {},
) {
  const config = structuredClone(qualificationConfig);
  config.research.targeted.order = options.repeat ? ['employeeCount', 'employeeCount'] : ['employeeCount'];
  if (options.maxPageRequests) config.research.maxPageRequests = options.maxPageRequests;
  const controlled = controlledResearch({
    roundSources: { employeeCount: sources },
    roundCitations: { employeeCount: citations },
    ...(options.employees === null ? { employees: null } : {}),
  });
  const { app } = await controlledHarness({ qualification: config }, controlled);
  cleanup.push(() => app.close());
  return {
    app,
    controlled,
    async qualify(this: void) {
      const { runId } = await (await app.post(event('selection-diagnostics'))).json();
      const assessment = (await app.qualification.qualify(runId, (await app.store.get(runId))!.event)) as Assessment;
      return { assessment, round: (await app.store.qualifications.round(runId, 0))! };
    },
  };
}

describe('persisted discovery selection diagnostics', () => {
  it('explains_existing_priority_citation_ties_filters_and_attempts_without_changing_retrieval', async () => {
    const team = 'https://example.com/team?tracking=sensitive-marker#sensitive-marker';
    const about = 'https://example.com/about';
    const support = 'https://support.example.com/en/team-management';
    const { controlled, qualify, app } = await research(
      [
        support,
        'https://example.com/about.pdf?token=sensitive-marker',
        'http://example.com/sensitive-marker',
        'https://localhost/sensitive-marker',
        'https://user:sensitive-marker@example.com/sensitive-marker',
        'https://off-policy.example.org/team',
        'sensitive-marker',
        team,
        'https://EXAMPLE.com./team?tracking=sensitive-marker#sensitive-marker',
        about,
        'https://example.com/company',
      ],
      [support, about],
    );
    vi.mocked(controlled.transport.request).mockImplementation(async url =>
      url.pathname === '/about' ? pageResponse('Unavailable', 404) : pageResponse('Our company has 40 employees.'),
    );
    const { assessment, round } = await qualify();
    const selection = round.diagnostic.discoverySelection!;
    expect(vi.mocked(controlled.transport.request).mock.calls.map(([url]) => url.href)).toEqual([
      about,
      team.split('#')[0],
    ]);
    expect(selection.candidates).toEqual([
      expect.objectContaining({
        url: support,
        priority: -5,
        citationPreferred: true,
        selected: false,
        reason: 'not_selected',
      }),
      expect.objectContaining({
        url: 'https://example.com/about.pdf',
        priority: 8,
        selectionRank: null,
        reason: 'unsupported_format',
      }),
      ...Array.from({ length: 3 }, () =>
        expect.objectContaining({ url: null, priority: null, rank: null, reason: 'unapproved_source' }),
      ),
      expect.objectContaining({
        url: 'https://off-policy.example.org/team',
        priority: 4,
        rank: expect.any(Number),
        reason: 'unapproved_source',
      }),
      expect.objectContaining({ url: null, reason: 'unapproved_source' }),
      expect.objectContaining({
        url: 'https://example.com/team',
        priority: 8,
        selectionRank: 2,
        selected: true,
        reason: 'retrieved',
      }),
      expect.objectContaining({
        url: 'https://example.com/team',
        priority: 8,
        selectionRank: null,
        selected: false,
        reason: 'duplicate',
      }),
      expect.objectContaining({
        url: about,
        priority: 8,
        rank: 1,
        selectionRank: 1,
        citationPreferred: true,
        selected: true,
        reason: 'unavailable',
      }),
      expect.objectContaining({
        url: 'https://example.com/company',
        priority: 8,
        selectionRank: 3,
        selected: false,
        reason: 'not_selected',
      }),
    ]);
    expect(selection.omittedCount).toBe(0);
    expect(JSON.stringify(controlled.requests)).not.toContain('discoverySelection');
    expect(JSON.stringify(selection)).not.toContain('sensitive-marker');
    expect(round.diagnostic.urls).toContainEqual({ url: 'https://example.com/team', outcome: 'retrieved' });
    expect(assessment.rounds[0]!.discoverySelection).toEqual(selection);
    expect((await app.store.qualifications.get(assessment.runId))!.assessment!.rounds[0]!.discoverySelection).toEqual(
      selection,
    );
    const legacy = structuredClone(round);
    delete legacy.diagnostic.discoverySelection;
    expect(researchRoundSchema.parse(legacy)).toEqual(legacy);
  });

  it('bounds_candidates_and_retains_omitted_count_even_when_the_selected_page_is_beyond_the_cap', async () => {
    const sources = [
      ...Array.from({ length: 34 }, (_, index) => `https://example.com/news/${index}`),
      'https://example.com/team',
    ];
    const { qualify, controlled } = await research(sources);
    const { round } = await qualify();
    expect(round.diagnostic.discoverySelection).toMatchObject({ omittedCount: 3 });
    expect(round.diagnostic.discoverySelection!.candidates).toHaveLength(32);
    expect(round.diagnostic.discoverySelection!.candidates.every(candidate => !candidate.selected)).toBe(true);
    expect(vi.mocked(controlled.transport.request).mock.calls.map(([url]) => url.href)).toEqual([
      'https://example.com/team',
    ]);
    expect(round.diagnostic.urls).toContainEqual({ url: 'https://example.com/team', outcome: 'retrieved' });
    expect(round.diagnostic.discoveredUrls).toBe(35);
  });

  it('records_prior_consultation_without_refetching_or_exposing_query_strings', async () => {
    const { qualify, controlled, app } = await research(['https://example.com/team?tracking=sensitive-marker'], [], {
      repeat: true,
      employees: null,
    });
    const { assessment } = await qualify();
    const second = (await app.store.qualifications.round(assessment.runId, 1))!;
    expect(second.diagnostic.discoverySelection!.candidates[0]).toMatchObject({
      url: 'https://example.com/team',
      priority: 8,
      rank: 1,
      selectionRank: null,
      selected: false,
      reason: 'already_consulted',
    });
    expect(vi.mocked(controlled.transport.request)).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(second.diagnostic.discoverySelection)).not.toContain('sensitive-marker');
  });

  it('distinguishes_unavailable_attempts_from_remaining_candidates_stopped_by_the_shared_budget', async () => {
    const { qualify, controlled } = await research(
      ['https://example.com/team', 'https://example.com/about', 'https://example.com/company'],
      [],
      { maxPageRequests: 1 },
    );
    vi.mocked(controlled.transport.request).mockImplementation(async () => pageResponse('Unavailable', 404));
    const { round } = await qualify();
    expect(
      round.diagnostic.discoverySelection!.candidates.map(candidate => [candidate.selected, candidate.reason]),
    ).toEqual([
      [true, 'unavailable'],
      [true, 'unavailable'],
      [false, 'budget_exhausted'],
    ]);
    expect(round.diagnostic.pageRequests).toBe(1);
    expect(vi.mocked(controlled.transport.request)).toHaveBeenCalledTimes(1);
  });
});
