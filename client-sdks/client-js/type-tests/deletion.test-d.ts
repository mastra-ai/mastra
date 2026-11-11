import { expectTypeOf, test } from 'vitest';
import type { MastraClient } from '../src/client';
import type { Observability } from '../src/resources/observability';

declare const client: MastraClient;
declare const observability: Observability;

test('callers distinguish completed deletion from accepted cleanup at both entry points', async () => {
  for (const api of [client, observability]) {
    const traces = await api.deleteTraces({ traceIds: ['abc'] });
    const scores = await api.deleteScores({ scoreIds: ['score-1'] });
    const feedback = await api.deleteFeedback({ feedbackIds: ['feedback-1'] });
    expectTypeOf(traces).toEqualTypeOf<{ success: true } | { accepted: true }>();
    expectTypeOf(scores).toEqualTypeOf<{ success: boolean } | { accepted: true }>();
    expectTypeOf(feedback).toEqualTypeOf<{ success: boolean } | { accepted: true }>();
    for (const result of [traces, scores, feedback]) {
      if ('accepted' in result) {
        expectTypeOf(result.accepted).toEqualTypeOf<true>();
      } else {
        expectTypeOf(result.success).toEqualTypeOf<boolean>();
      }
    }
  }
});
