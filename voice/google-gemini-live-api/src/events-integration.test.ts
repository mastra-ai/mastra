/**
 * Integration smoke test for GitHub Issue #17021.
 *
 * Validates the four native-audio behavioral signals end-to-end against the
 * real Gemini Live API:
 *
 *   1. Setup payload enables transcription + activity-handling
 *   2. `outputTranscription.text`  → `writing` { role: 'assistant' }
 *   3. `modelTurn.parts.text`      → `thinking` (on native-audio)
 *                                  → `writing`  (on non-native-audio)
 *   4. `inputTranscription.text` / `interrupted` → covered by routing tests
 *      in index.test.ts; not exercised here (would require sending mic-like
 *      PCM and a barge-in clip).
 *
 * Runs the same assertions against TWO models so we can directly compare
 * actual emitted events and verify the `isNativeAudioModel()` heuristic:
 *
 *   - gemini-3.1-flash-live-preview                (heuristic says: NOT native-audio)
 *   - gemini-2.5-flash-native-audio-preview-12-2025 (heuristic says: native-audio)
 *
 * Run with:
 *   GOOGLE_GENERATIVE_AI_API_KEY=... pnpm test:integration
 * or:
 *   GOOGLE_API_KEY=... pnpm test:integration
 *
 * Skipped automatically when no API key is configured.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { GeminiVoiceModel } from './types';
import { GeminiLiveVoice } from './index';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const hasApiKey = !!GOOGLE_API_KEY;
const testMode = hasApiKey ? describe : describe.skip;

/**
 * Models to probe. Order matters only for log readability.
 *
 * `gemini-3.1-flash-live-preview` was called out in the PE-462 spike as
 * exhibiting the same behavioral split as native-audio variants, but its ID
 * does NOT contain the substring `native-audio` — so `isNativeAudioModel()`
 * currently classifies it as half-cascade. This smoke test records what the
 * model actually emits so we can confirm or correct that classification.
 */
const MODELS: ReadonlyArray<GeminiVoiceModel> = [
  'gemini-3.1-flash-live-preview',
  'gemini-2.5-flash-native-audio-preview-12-2025',
];

/** Time to wait after `speak()` for the model to finish its turn. */
const TURN_WAIT_MS = 8000;

interface ObservedEvents {
  writing: Array<{ text: string; role: 'user' | 'assistant' }>;
  thinking: Array<{ text: string }>;
  speaking: number;
  turnComplete: number;
  interrupt: Array<{ type: string; timestamp: number }>;
  errors: Array<{ message: string; code?: string }>;
}

function newObserved(): ObservedEvents {
  return {
    writing: [],
    thinking: [],
    speaking: 0,
    turnComplete: 0,
    interrupt: [],
    errors: [],
  };
}

testMode('GeminiLiveVoice native-audio behavioral signals — Issue #17021', () => {
  describe.each(MODELS)('model: %s', model => {
    let voice: GeminiLiveVoice;
    let observed: ObservedEvents;

    beforeAll(() => {
      console.log(`\n━━━━ Smoke test for ${model} ━━━━`);
    });

    afterAll(() => {
      console.log(`━━━━ End ${model} ━━━━\n`);
    });

    beforeEach(async () => {
      observed = newObserved();

      voice = new GeminiLiveVoice({
        apiKey: GOOGLE_API_KEY,
        model,
        debug: false,
      });

      voice.on('writing', payload => {
        observed.writing.push(payload);
        console.log(`  [writing role=${payload.role}] ${JSON.stringify(payload.text)}`);
      });

      voice.on('thinking', payload => {
        observed.thinking.push(payload);
        console.log(`  [thinking] ${JSON.stringify(payload.text)}`);
      });

      voice.on('speaking', () => {
        observed.speaking += 1;
      });

      voice.on('turnComplete', () => {
        observed.turnComplete += 1;
        console.log(`  [turnComplete]`);
      });

      voice.on('interrupt', payload => {
        observed.interrupt.push(payload);
        console.log(`  [interrupt] ${JSON.stringify(payload)}`);
      });

      voice.on('error', err => {
        observed.errors.push({ message: err.message, code: err.code });
        console.error(`  [error] ${err.message} (code=${err.code})`);
      });

      await voice.connect();
    }, 30000);

    afterEach(async () => {
      if (voice) {
        await voice.disconnect();
      }
    }, 30000);

    it('emits the assistant transcript and surfaces reasoning consistently', async () => {
      // Prompt the model to produce a short, predictable spoken reply so we
      // can reason about which channel the text shows up on.
      await voice.speak('Please say exactly the word: pineapple. Then stop.');

      // Let the model finish the turn (audio + transcription frames trickle in).
      await new Promise(resolve => setTimeout(resolve, TURN_WAIT_MS));

      const assistantWrites = observed.writing.filter(w => w.role === 'assistant');
      const userWrites = observed.writing.filter(w => w.role === 'user');
      const thinking = observed.thinking;

      console.log(`\n  Summary for ${model}:`);
      console.log(`    writing[assistant]: ${assistantWrites.length} events`);
      console.log(`    writing[user]:      ${userWrites.length} events`);
      console.log(`    thinking:           ${thinking.length} events`);
      console.log(`    speaking frames:    ${observed.speaking}`);
      console.log(`    turnComplete:       ${observed.turnComplete}`);
      console.log(`    errors:             ${observed.errors.length}`);

      // ── Invariants that must hold on every Gemini Live model ──

      // No errors should be raised during a normal turn.
      expect(observed.errors).toEqual([]);

      // The model must produce SOME assistant-side text (either via
      // `outputTranscription` → writing[assistant], or via
      // `modelTurn.parts.text` → writing[assistant] on half-cascade).
      // If neither fires, the four routing changes are not working.
      const assistantText = assistantWrites.map(w => w.text).join('');
      const thinkingText = thinking.map(t => t.text).join('');
      const anyAssistantSurface = assistantText.length > 0 || thinkingText.length > 0;
      expect(anyAssistantSurface).toBe(true);

      // The turn must complete cleanly.
      expect(observed.turnComplete).toBeGreaterThanOrEqual(1);

      // ── Diagnostic record (does not fail the test) ──
      //
      // This is the data we actually care about: it tells us which channel
      // the model uses on this ID. Read the logs and compare to the
      // heuristic prediction above.
      console.log(`\n  Channel verdict for ${model}:`);
      if (assistantWrites.length > 0 && thinking.length === 0) {
        console.log(`    → writing-only. Half-cascade behavior (modelTurn.parts.text is the spoken response).`);
      } else if (assistantWrites.length > 0 && thinking.length > 0) {
        console.log(`    → writing + thinking. Native-audio behavior with outputTranscription wired.`);
      } else if (assistantWrites.length === 0 && thinking.length > 0) {
        console.log(
          `    → thinking-only. Native-audio behavior but outputTranscription channel produced no text on this prompt.`,
        );
      } else {
        console.log(`    → silent. Neither writing nor thinking fired — investigate.`);
      }
    }, 30000);
  });
});

if (!hasApiKey) {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  events-integration.test.ts SKIPPED — no API key configured    ║
╚════════════════════════════════════════════════════════════════╝

Set one of:
  export GOOGLE_GENERATIVE_AI_API_KEY=...
  export GOOGLE_API_KEY=...

Then run:
  pnpm test:integration
`);
}
