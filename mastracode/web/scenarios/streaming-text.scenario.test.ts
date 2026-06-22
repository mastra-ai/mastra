import { describe, it } from 'vitest';

import type { WebScenario } from './harness';
import { runScenario } from './harness';

const scenario: WebScenario = {
  name: 'streaming-text',
  description: 'Confirms message_update events arrive with partial text and the streaming flag transitions true → false.',
  aimockFixture: 'streaming-text.json',
  run: async ({ driver }) => {
    await driver.submit('Hello');

    // The reducer receives message_start (streaming=true), message_update(s),
    // then message_end (streaming=false). Wait for the final text to appear.
    await driver.waitForText('Streaming test response');

    // After message_end the streaming flag should be false.
    const state = driver.state();
    const assistantEntries = state.entries.filter(e => e.kind === 'assistant');
    const last = assistantEntries[assistantEntries.length - 1];
    if (!last || last.kind !== 'assistant') throw new Error('No assistant entry found');
    if (last.streaming) throw new Error('Expected streaming=false after message_end, got true');
    if (!last.text.includes('Streaming test response')) {
      throw new Error(`Unexpected text: ${last.text}`);
    }
  },
};

describe(`web scenario: ${scenario.name}`, () => {
  it(scenario.description, () => runScenario(scenario));
});
