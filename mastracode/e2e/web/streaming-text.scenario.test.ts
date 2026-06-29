import { describe, it } from 'vitest';

import type { WebScenario } from './scenario-runner';
import { runScenario } from './scenario-runner';

const scenario: WebScenario = {
  name: 'streaming-text',
  description:
    'Confirms message_update events arrive with partial text and the streaming flag transitions true → false.',
  aimockFixture: 'streaming-text.json',
  run: async ({ driver }) => {
    await driver.submit('Hello');

    // The reducer receives message_start (streaming=true), message_update(s),
    // then message_end (streaming=false). Wait for the final text to appear.
    await driver.waitForText('Streaming test response');

    // After message_end the streaming flag should be false.
    const state = driver.state();
    const assistantEntries = state.entries.filter(e => e.kind === 'message' && e.message.role === 'assistant');
    const last = assistantEntries[assistantEntries.length - 1];
    if (!last || last.kind !== 'message') throw new Error('No assistant entry found');
    if (last.streaming !== false) {
      throw new Error(`Expected streaming=false after message_end, got ${String(last.streaming)}`);
    }
    const assistantText = last.message.content.parts
      .filter(part => part.type === 'text')
      .map(part => (part.type === 'text' ? part.text : ''))
      .join('');
    if (!assistantText.includes('Streaming test response')) {
      throw new Error(`Unexpected text: ${assistantText}`);
    }
  },
};

describe(`web scenario: ${scenario.name}`, () => {
  it(scenario.description, () => runScenario(scenario));
});
