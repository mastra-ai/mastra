/**
 * Internal, for core's unit tests: with MASTRA_TEST_FAST_WAITS=1, waits that only give
 * real infrastructure time (drain budgets, poll intervals, pacing sleeps) use `testMs`
 * instead of `defaultMs`. Read at each call, so a test file can opt out with
 * vi.stubEnv. Not a supported setting; production always gets `defaultMs`.
 */
export function waitMs(defaultMs: number, testMs: number): number {
  return process.env.MASTRA_TEST_FAST_WAITS === '1' ? testMs : defaultMs;
}
