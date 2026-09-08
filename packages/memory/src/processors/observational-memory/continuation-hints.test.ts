import { describe, expect, it } from 'vitest';

import {
  composeObservationExtractors,
  composeReflectionExtractors,
  resolveContinuationHints,
} from './built-in-extractors';
import { Extractor } from './extractor';
import { buildObserverSystemPrompt } from './observer-agent';
import { buildReflectorSystemPrompt } from './reflector-agent';

describe('resolveContinuationHints', () => {
  it('enables both sections by default', () => {
    expect(resolveContinuationHints(undefined)).toEqual({ currentTask: true, suggestedResponse: true });
    expect(resolveContinuationHints(true)).toEqual({ currentTask: true, suggestedResponse: true });
  });

  it('disables both sections when false', () => {
    expect(resolveContinuationHints(false)).toEqual({ currentTask: false, suggestedResponse: false });
  });

  it('supports disabling sections individually', () => {
    expect(resolveContinuationHints({ suggestedResponse: false })).toEqual({
      currentTask: true,
      suggestedResponse: false,
    });
    expect(resolveContinuationHints({ currentTask: false })).toEqual({
      currentTask: false,
      suggestedResponse: true,
    });
  });
});

describe('continuationHints extractor composition', () => {
  const user = new Extractor({ name: 'Preference', instructions: 'Extract preference.' });

  it('registers both continuation extractors by default', () => {
    expect(composeObservationExtractors({ threadTitle: false, extract: [user] }).map(e => e.slug)).toEqual([
      'current-task',
      'suggested-response',
      'preference',
    ]);
  });

  it('omits both continuation extractors when disabled', () => {
    expect(
      composeObservationExtractors({ threadTitle: false, extract: [user], continuationHints: false }).map(e => e.slug),
    ).toEqual(['preference']);
  });

  it('omits only the suggested-response extractor when disabled individually', () => {
    expect(
      composeObservationExtractors({
        threadTitle: true,
        extract: [user],
        continuationHints: { suggestedResponse: false },
      }).map(e => e.slug),
    ).toEqual(['current-task', 'thread-title', 'preference']);
  });

  it('applies continuation hints to reflection extractors too', () => {
    expect(
      composeReflectionExtractors({ extract: [user], continuationHints: { suggestedResponse: false } }).map(
        e => e.slug,
      ),
    ).toEqual(['current-task', 'preference']);
  });
});

describe('prompts only reference continuation sections they define', () => {
  it('drops suggested-response guidance from the observer prompt when disabled', () => {
    const extractors = composeObservationExtractors({
      threadTitle: false,
      continuationHints: { suggestedResponse: false },
    });
    const prompt = buildObserverSystemPrompt(false, undefined, false, extractors);

    expect(prompt).not.toContain('<suggested-response>');
    expect(prompt).toContain('<current-task>');
  });

  it('drops all continuation guidance from the observer prompt when both are disabled', () => {
    const extractors = composeObservationExtractors({ threadTitle: false, continuationHints: false });
    const prompt = buildObserverSystemPrompt(false, undefined, false, extractors);

    expect(prompt).not.toContain('<suggested-response>');
    expect(prompt).not.toContain('<current-task>');
    expect(prompt).toContain('User messages are extremely important.');
  });

  it('drops suggested-response guidance from the reflector prompt when disabled', () => {
    const extractors = composeReflectionExtractors({ continuationHints: { suggestedResponse: false } });
    const prompt = buildReflectorSystemPrompt(undefined, extractors);

    expect(prompt).not.toContain('<suggested-response>');
    expect(prompt).toContain('<current-task>');
  });

  it('still describes both sections on the legacy path with no extractors', () => {
    const prompt = buildObserverSystemPrompt();

    expect(prompt).toContain('<current-task>');
    expect(prompt).toContain('<suggested-response>');
  });
});

describe('multi-thread prompt follows the active continuation sections', () => {
  const multiThreadPrompt = (
    continuationHints: Parameters<typeof composeObservationExtractors>[0]['continuationHints'],
  ) =>
    buildObserverSystemPrompt(
      true,
      undefined,
      false,
      composeObservationExtractors({ threadTitle: false, continuationHints }),
    );

  it('nests and demonstrates both sections by default', () => {
    const prompt = multiThreadPrompt(undefined);

    expect(prompt).toContain(
      "Each thread's observations, current-task, and suggested-response should be nested inside",
    );
    expect(prompt).toContain('<current-task>');
    expect(prompt).toContain('<suggested-response>');
  });

  it('omits suggested-response from the nesting instruction and examples when disabled', () => {
    const prompt = multiThreadPrompt({ suggestedResponse: false });

    expect(prompt).toContain("Each thread's observations and current-task should be nested inside");
    expect(prompt).toContain('<current-task>');
    expect(prompt).not.toContain('<suggested-response>');
  });

  it('omits current-task from the nesting instruction and examples when disabled', () => {
    const prompt = multiThreadPrompt({ currentTask: false });

    expect(prompt).toContain("Each thread's observations and suggested-response should be nested inside");
    expect(prompt).toContain('<suggested-response>');
    expect(prompt).not.toContain('<current-task>');
  });

  it('drops both sections entirely when continuation hints are disabled', () => {
    const prompt = multiThreadPrompt(false);

    expect(prompt).toContain("Each thread's observations should be nested inside");
    expect(prompt).not.toContain('<current-task>');
    expect(prompt).not.toContain('<suggested-response>');
    // The thread scaffolding itself must survive so multi-thread output stays parseable.
    expect(prompt).toContain('<thread id="thread_id_1">');
    expect(prompt).toContain('=== MULTI-THREAD INPUT ===');
  });

  it('still lists thread-title alongside the enabled sections', () => {
    const prompt = buildObserverSystemPrompt(
      true,
      undefined,
      true,
      composeObservationExtractors({ threadTitle: true, continuationHints: { suggestedResponse: false } }),
    );

    expect(prompt).toContain("Each thread's observations, current-task, and thread-title should be nested inside");
    expect(prompt).toContain('<thread-title>');
    expect(prompt).not.toContain('<suggested-response>');
  });

  it('leaves the default multi-thread prompt unchanged on the legacy path', () => {
    expect(buildObserverSystemPrompt(true, undefined, false, undefined)).toContain(
      "Each thread's observations, current-task, and suggested-response should be nested inside",
    );
  });

  // Pins the exact default example so the section-driven template can't silently drift
  // from the shape the multi-thread parser expects.
  it('renders the default per-thread example verbatim', () => {
    expect(buildObserverSystemPrompt(true, undefined, true, undefined)).toContain(
      `<observations>
<thread id="thread_id_1">
Date: Dec 4, 2025
* 🔴 (14:30) User prefers direct answers
* 🔴 (14:31) Working on feature X

<current-task>
What the agent is currently working on in this thread
</current-task>

<suggested-response>
Hint for the agent's next message in this thread
</suggested-response>
<thread-title>Feature X implementation</thread-title>
</thread>

<thread id="thread_id_2">
Date: Dec 5, 2025
* 🔴 (09:15) User asked about deployment

<current-task>
Current task for this thread
</current-task>

<suggested-response>
Suggested response for this thread
</suggested-response>
<thread-title>Deployment setup</thread-title>
</thread>
</observations>`,
    );
  });
});
