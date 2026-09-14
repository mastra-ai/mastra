import { describe, expect, it } from 'vitest';

import { tokenEstimate } from '../../utils/token-estimator.js';
import { buildContextAudit } from '../context-audit.js';

const promptSections = [
  { id: 'base-prompt', label: 'Base system prompt', content: 'You are a coding agent. '.repeat(20) },
  {
    id: 'agent-instructions:/repo/AGENTS.md:0',
    label: 'Project instructions',
    detail: '/repo/AGENTS.md',
    content: 'Always run the tests. '.repeat(5),
  },
];

function findGroup(audit: ReturnType<typeof buildContextAudit>, id: string) {
  return [...audit.startup.groups, ...audit.accumulated.groups].find(group => group.id === id);
}

describe('buildContextAudit', () => {
  it('returns an empty audit with no divide-by-zero percentages', () => {
    const audit = buildContextAudit({});

    expect(audit.totalTokens).toBe(0);
    expect(audit.startup.groups).toEqual([]);
    expect(audit.accumulated.groups).toEqual([]);
    expect(audit.startup.percent).toBe(0);
  });

  it('measures each prompt section separately with its provenance', () => {
    const audit = buildContextAudit({ promptSections });
    const group = findGroup(audit, 'system-prompt')!;

    expect(group.entries).toHaveLength(2);
    expect(group.entries[1]!.label).toBe('Project instructions');
    expect(group.entries[1]!.detail).toBe('/repo/AGENTS.md');
    expect(group.entries[1]!.tokens).toBe(tokenEstimate(promptSections[1]!.content));
    expect(group.tokens).toBe(group.entries.reduce((sum, entry) => sum + entry.tokens, 0));
  });

  it('skips empty sections so they do not clutter the report', () => {
    const audit = buildContextAudit({
      promptSections: [...promptSections, { id: 'model-prompt', label: 'Model-specific prompt', content: '' }],
    });

    expect(findGroup(audit, 'system-prompt')!.entries.map(entry => entry.id)).not.toContain('prompt:model-prompt');
  });

  it('omits groups that have nothing to report', () => {
    const audit = buildContextAudit({ promptSections });

    expect(audit.startup.groups.map(group => group.id)).toEqual(['system-prompt']);
  });

  it('attributes tools to the server that provides them', () => {
    const audit = buildContextAudit({
      tools: [
        { name: 'view', description: 'Read a file', parameters: { type: 'object' } },
        { name: 'query', description: 'Run a query', server: 'postgres' },
      ],
    });
    const group = findGroup(audit, 'tools')!;

    expect(group.entries.map(entry => entry.detail)).toEqual([undefined, 'postgres']);
    expect(group.entries.every(entry => entry.tokens > 0)).toBe(true);
  });

  it('percentages are shares of the audited total and sum to 100', () => {
    const audit = buildContextAudit({
      promptSections,
      skillsCatalog: '<available_skills>\n  <skill><name>x</name></skill>\n</available_skills>',
      tools: [{ name: 'view', description: 'Read a file' }],
    });

    const total = audit.startup.groups.reduce((sum, group) => sum + group.percent, 0);
    expect(total).toBeCloseTo(100, 5);
    expect(audit.startup.percent).toBeCloseTo(100, 5);
    expect(audit.totalTokens).toBe(audit.startup.tokens);
  });

  // Provider prompt tokens cover the entire request. Reporting them as-is next
  // to the measured startup context would count the system prompt twice.
  it('reports conversation tokens net of startup context and injected observations', () => {
    const injectedObservations = 'User prefers pnpm. '.repeat(10);
    const audit = buildContextAudit({
      promptSections,
      injectedObservations,
      conversation: { promptTokens: 10_000 },
    });

    const expected = 10_000 - audit.startup.tokens - tokenEstimate(injectedObservations);
    expect(findGroup(audit, 'conversation')!.entries[0]!.tokens).toBe(expected);
    expect(audit.totalTokens).toBe(10_000);
  });

  it('clamps conversation tokens when the provider count predates the current context', () => {
    const audit = buildContextAudit({ promptSections, conversation: { promptTokens: 1 } });

    expect(findGroup(audit, 'conversation')!.entries[0]!.tokens).toBe(0);
  });

  it('omits the conversation group before the first request', () => {
    const audit = buildContextAudit({ promptSections });

    expect(findGroup(audit, 'conversation')).toBeUndefined();
  });

  // Stored observations are the headline confusion this audit resolves: they
  // are large, and they cost nothing until recalled.
  it('says plainly that stored-only observations are excluded', () => {
    const audit = buildContextAudit({ injectedObservations: 'User prefers pnpm.' });

    expect(findGroup(audit, 'observations')!.note).toContain('storage');
  });

  // The memory subsystem knows its own size better than a re-measurement of the
  // rendered text would.
  it('accepts an observation token count reported by the memory subsystem', () => {
    const audit = buildContextAudit({ injectedObservations: { tokens: 1_200 } });

    expect(findGroup(audit, 'observations')!.tokens).toBe(1_200);
  });

  it('omits the observation group when nothing is injected', () => {
    const audit = buildContextAudit({ promptSections, injectedObservations: { tokens: 0 } });

    expect(findGroup(audit, 'observations')).toBeUndefined();
  });

  it('counts injected observations against the context window', () => {
    const audit = buildContextAudit({ injectedObservations: 'User prefers pnpm.' });
    const group = findGroup(audit, 'observations')!;

    expect(group.tokens).toBeGreaterThan(0);
    expect(audit.accumulated.tokens).toBe(group.tokens);
  });

  it('never carries the audited content itself, so a report is safe to share', () => {
    const audit = buildContextAudit({
      promptSections: [{ id: 'base-prompt', label: 'Base', content: 'API_KEY=sk-secret-value' }],
      skillsCatalog: 'sk-another-secret',
      tools: [{ name: 'deploy', description: 'sk-third-secret' }],
    });

    expect(JSON.stringify(audit)).not.toContain('sk-');
  });
});
