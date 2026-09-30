import { Mastra } from '@mastra/core/mastra';
import { describe, expect, it } from 'vitest';
import { createStatelessOrganizationAgent as createOrganizationAgent } from '../../fixtures/agent.js';
import { studioUserSignal } from '../../fixtures/answers.js';
import { fixedLanguageModel } from '../../fixtures/model.js';
import { index } from './helpers/runtime.js';

describe('Organization Agent grounded answer integration', () => {
  it('accepts the real Studio user signal shape', async () => {
    const agent = new Mastra({
      agents: {
        organizationAgent: createOrganizationAgent(
          index(),
          fixedLanguageModel(
            JSON.stringify({
              status: 'answered',
              answer: 'Invoices are retained for seven years.',
              citations: [{ recordId: 'policy-retention', locator: 'Retention' }],
            }),
          ) as never,
        ),
      },
    }).getAgent('organizationAgent');
    const studioSignal = studioUserSignal('How long are invoices retained and who approves archive access?');
    const stream = await agent.stream(studioSignal);
    const parts = [];
    for await (const part of stream.fullStream) parts.push(part);
    const final = parts.find(part => part.type === 'text-delta');
    expect(final?.type === 'text-delta' && final.payload.text).toContain('**Status:** Answered');
    expect(final?.type === 'text-delta' && final.payload.text).toContain(
      '- Retention policy — /policies/retention\\.md \\(Retention\\)',
    );
    const structuredStreams = await Promise.all(
      ['How long are invoices retained?', 'Who approves archive access?'].map(async question => {
        const result = await agent.stream(question);
        const output = [];
        for await (const part of result.fullStream) output.push(part);
        return output.find(part => part.type === 'text-delta');
      }),
    );
    for (const structured of structuredStreams)
      expect(structured?.type === 'text-delta' && JSON.parse(structured.payload.text)).toMatchObject({
        status: 'answered',
        citations: [expect.objectContaining({ recordId: 'policy-retention', locator: 'Retention' })],
      });
    const newerUserStream = await agent.stream([
      ...studioSignal,
      { role: 'user', content: 'Use the newest ordinary message.' },
    ] as never);
    const newerUserParts = [];
    for await (const part of newerUserStream.fullStream) newerUserParts.push(part);
    const newerUserFinal = newerUserParts.find(part => part.type === 'text-delta');
    expect(newerUserFinal?.type === 'text-delta' && JSON.parse(newerUserFinal.payload.text)).toMatchObject({
      status: 'answered',
    });
    await expect(
      agent.generate([
        { role: 'user', content: 'Answer this earlier question instead.' },
        { role: 'user', content: '' },
      ] as never),
    ).rejects.toThrow('Input processor error');
  });
});
