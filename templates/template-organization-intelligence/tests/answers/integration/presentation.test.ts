import { Mastra } from '@mastra/core/mastra';
import { describe, expect, it } from 'vitest';
import type { SourceIndex } from '../../../src/mastra/workspaces/source-index.js';
import { createStatelessOrganizationAgent as createOrganizationAgent } from '../../fixtures/agent.js';
import { hits, studioUserSignal } from '../../fixtures/answers.js';
import { fixedLanguageModel } from '../../fixtures/model.js';

describe('Organization Agent grounded answer integration', () => {
  it('renders safe native Studio citations and statuses', async () => {
    const unsafeHits = [
      {
        content: hits[0]!.content,
        metadata: {
          ...hits[0]!.metadata,
          recordId: 'drive-record',
          sourceId: 'drive-source',
          title: '![title](https://attacker.example)',
          path: '/<img src=x>',
          locator: '[locator](https://attacker.example)',
          url: 'https://drive.google.com/file/d/exact-source-url/view',
        },
      },
      {
        content: hits[1]!.content,
        metadata: {
          ...hits[1]!.metadata,
          recordId: 'private-record',
          sourceId: 'private-s3',
          title: 'Private [archive](https://attacker.example)',
          path: '/archive/<retention>.md',
          locator: 'Part ![two](https://attacker.example)',
        },
      },
    ];
    const unsafeStatus = [
      {
        sourceId: 'drive-source',
        ready: true,
        stale: false,
        lastSuccessAt: '2026-01-01T00:00:00Z',
        error: null,
        records: 1,
      },
      {
        sourceId: 'private-s3',
        ready: false,
        stale: true,
        lastSuccessAt: null,
        error: '<img src=x>',
        records: 3,
      },
    ];
    const unsafeIndex = {
      search: async () => unsafeHits,
      sourceStatus: () => unsafeStatus,
    } as unknown as SourceIndex;
    const cited = unsafeHits.map(hit => ({ recordId: hit.metadata.recordId, locator: hit.metadata.locator }));
    const studioAgent = new Mastra({
      agents: {
        organizationAgent: createOrganizationAgent(
          unsafeIndex,
          fixedLanguageModel(
            JSON.stringify({
              status: 'answered',
              answer: 'Invoices are retained for seven years. [unsafe](https://attacker.example) <img src=x>',
              citations: cited,
            }),
          ) as never,
        ),
      },
    }).getAgent('organizationAgent');
    const stream = await studioAgent.stream(studioUserSignal('How long are invoices retained?'));
    const parts = [];
    for await (const part of stream.fullStream) parts.push(part);
    const presentation = parts.find(part => part.type === 'text-delta');
    expect(presentation?.type === 'text-delta' && presentation.payload.text).toContain('**Status:** Answered');
    expect(presentation?.type === 'text-delta' && presentation.payload.text).toContain('**Citations**');
    expect(presentation?.type === 'text-delta' && presentation.payload.text).toContain(
      '](<https://drive.google.com/file/d/exact-source-url/view>)',
    );
    expect(presentation?.type === 'text-delta' && presentation.payload.text.match(/\]\(<https:/g)).toHaveLength(1);
    expect(presentation?.type === 'text-delta' && presentation.payload.text).not.toContain(
      '](https://attacker.example)',
    );
    expect(presentation?.type === 'text-delta' && presentation.payload.text).not.toContain('<img');
    expect(presentation?.type === 'text-delta' && presentation.payload.text).toContain(
      'private\\-s3: unavailable; stale; 3 records; last success: never',
    );

    const unknownAgent = createOrganizationAgent(
      unsafeIndex,
      fixedLanguageModel(
        JSON.stringify({
          status: 'insufficient_evidence',
          answer: 'The indexed records do not establish that information.',
          citations: [],
        }),
      ) as never,
    );
    const unknownStream = await unknownAgent.stream(studioUserSignal('What is the unrecorded budget?'));
    const unknownParts = [];
    for await (const part of unknownStream.fullStream) unknownParts.push(part);
    const unknown = unknownParts.find(part => part.type === 'text-delta');
    expect(unknown?.type === 'text-delta' && unknown.payload.text).toContain('**Status:** Insufficient evidence');
    expect(unknown?.type === 'text-delta' && unknown.payload.text).toContain('private\\-s3: unavailable; stale');

    const invalidAgent = createOrganizationAgent(unsafeIndex, fixedLanguageModel('{invalid') as never);
    const invalidStream = await invalidAgent.stream(studioUserSignal('What is the retention rule?'));
    const invalidParts = [];
    for await (const part of invalidStream.fullStream) invalidParts.push(part);
    const invalid = invalidParts.find(part => part.type === 'text-delta');
    expect(invalid?.type === 'text-delta' && invalid.payload.text).toContain('**Status:** Operational error');
    expect(invalid?.type === 'text-delta' && invalid.payload.text).toContain('**Source status**');
  });
});
