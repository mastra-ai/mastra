import { describe, expect, it } from 'vitest';
import { askOrganizationAgent } from '../../../src/mastra/agents/organization-agent.js';
import type { SourceIndex } from '../../../src/mastra/workspaces/source-index.js';
import { createStatelessOrganizationAgent as createOrganizationAgent } from '../../fixtures/agent.js';
import { hits, sourceStatus } from '../../fixtures/answers.js';
import { fixedLanguageModel } from '../../fixtures/model.js';
import { stringsIn } from './helpers/runtime.js';

describe('Organization Agent grounded answer integration', () => {
  it('unknown and conflicting evidence are explicit', async () => {
    const searches: string[] = [];
    const isolatedIndex = {
      search: async (question: string) => {
        searches.push(question);
        return hits;
      },
      sourceStatus: () => sourceStatus,
    } as unknown as SourceIndex;
    const agent = createOrganizationAgent(
      isolatedIndex,
      fixedLanguageModel(
        JSON.stringify({
          status: 'insufficient_evidence',
          answer: 'The indexed records do not establish that information.',
          citations: [],
        }),
      ) as never,
    );
    const [first, second] = await Promise.all([
      askOrganizationAgent(agent, 'What is the unrecorded budget?'),
      askOrganizationAgent(agent, 'What is the unrecorded owner?'),
    ]);

    expect(searches).toEqual(
      expect.arrayContaining(['What is the unrecorded budget?', 'What is the unrecorded owner?']),
    );
    expect(first.status).toBe('insufficient_evidence');
    expect(second.status).toBe('insufficient_evidence');
    expect(first.metadata.correlationId).not.toBe(second.metadata.correlationId);

    const isolationHits = {
      alpha: { ...hits[0]!, metadata: { ...hits[0]!.metadata, recordId: 'isolation-alpha', locator: 'Alpha' } },
      beta: { ...hits[1]!, metadata: { ...hits[1]!.metadata, recordId: 'isolation-beta', locator: 'Beta' } },
    };
    const isolationAgent = createOrganizationAgent(
      {
        search: async (question: string) => (question.includes('alpha') ? [isolationHits.alpha] : [isolationHits.beta]),
        sourceStatus: () => sourceStatus,
      } as unknown as SourceIndex,
      fixedLanguageModel('', {
        textForCall: call => {
          const isAlpha = stringsIn(call.prompt).some(text => text.includes('isolation-alpha'));
          return JSON.stringify({
            status: 'answered',
            answer: isAlpha ? 'Alpha evidence only.' : 'Beta evidence only.',
            citations: [
              { recordId: isAlpha ? 'isolation-alpha' : 'isolation-beta', locator: isAlpha ? 'Alpha' : 'Beta' },
            ],
          });
        },
      }) as never,
    );
    const [alpha, beta] = await Promise.all([
      askOrganizationAgent(isolationAgent, 'What does alpha say?'),
      askOrganizationAgent(isolationAgent, 'What does beta say?'),
    ]);
    expect(alpha.citations).toEqual([expect.objectContaining({ recordId: 'isolation-alpha', locator: 'Alpha' })]);
    expect(beta.citations).toEqual([expect.objectContaining({ recordId: 'isolation-beta', locator: 'Beta' })]);

    const conflictingPolicies = [
      {
        content: 'The 2024 retention policy requires invoices to be retained for seven years.',
        metadata: {
          ...hits[0]!.metadata,
          recordId: 'retention-seven-years',
          locator: 'Section 4.1',
          revision: 'retention-policy-2024',
          indexedAt: '2026-01-05T00:00:00Z',
        },
      },
      {
        content: 'The 2025 retention policy requires invoices to be retained for ten years.',
        metadata: {
          ...hits[0]!.metadata,
          recordId: 'retention-ten-years',
          locator: 'Section 8.2',
          revision: 'retention-policy-2025',
          indexedAt: '2026-07-15T00:00:00Z',
        },
      },
    ];
    const conflictingAgent = createOrganizationAgent(
      { search: async () => conflictingPolicies, sourceStatus: () => sourceStatus } as unknown as SourceIndex,
      fixedLanguageModel(
        JSON.stringify({
          status: 'conflicting_evidence',
          answer:
            'One policy requires seven-year invoice retention and another requires ten-year retention. The differing dates do not select either policy.',
          citations: [
            { recordId: 'retention-seven-years', locator: 'Section 4.1' },
            { recordId: 'retention-ten-years', locator: 'Section 8.2' },
          ],
        }),
      ) as never,
    );
    const conflict = await askOrganizationAgent(conflictingAgent, 'How long must invoices be retained?');
    expect(conflict).toMatchObject({
      status: 'conflicting_evidence',
      answer: expect.stringContaining('seven-year'),
    });
    expect(conflict.answer).toContain('ten-year');
    expect(conflict.answer).toContain('do not select either policy');
    expect(conflict.citations).toEqual([
      expect.objectContaining({
        recordId: 'retention-seven-years',
        locator: 'Section 4.1',
        revision: 'retention-policy-2024',
        indexedAt: '2026-01-05T00:00:00Z',
      }),
      expect.objectContaining({
        recordId: 'retention-ten-years',
        locator: 'Section 8.2',
        revision: 'retention-policy-2025',
        indexedAt: '2026-07-15T00:00:00Z',
      }),
    ]);

    const boundedCalls: Array<{ prompt: unknown }> = [];
    const boundedHits = Array.from({ length: 7 }, (_, number) => ({
      content: 'evidence '.repeat(2_000),
      metadata: {
        ...hits[0]!.metadata,
        recordId: `bounded-${number}`,
        locator: `chunk-${number}`,
      },
    }));
    const boundedAgent = createOrganizationAgent(
      { search: async () => boundedHits, sourceStatus: () => sourceStatus } as unknown as SourceIndex,
      fixedLanguageModel(
        JSON.stringify({
          status: 'answered',
          answer: 'The bounded evidence supports this answer.',
          citations: [{ recordId: 'bounded-0', locator: 'chunk-0' }],
        }),
        { onCall: call => boundedCalls.push(call) },
      ) as never,
    );
    await askOrganizationAgent(boundedAgent, 'What does the bounded evidence say?');
    const evidencePayload = stringsIn(boundedCalls[0]?.prompt).find(text => text.includes('"evidence"'));
    const embeddedEvidence = JSON.parse(evidencePayload?.split('\n').at(-1) ?? '{}').evidence as Array<{
      excerpt: string;
    }>;
    expect(embeddedEvidence.length).toBeLessThanOrEqual(6);
    expect(embeddedEvidence.every(item => item.excerpt.length > 0)).toBe(true);
    expect(
      embeddedEvidence.reduce((bytes, item) => bytes + Buffer.byteLength(item.excerpt, 'utf8'), 0),
    ).toBeLessThanOrEqual(6_000);
    expect(Buffer.byteLength(evidencePayload?.split('\n').at(-1) ?? '', 'utf8')).toBeLessThanOrEqual(6_000);
  });
});
