// Fixed ceilings have no environment override unless explicitly documented below.
export const SOURCE_LIMITS = {
  // Sources/run; hard ceiling. MAX_SOURCES accepts integers from 1 to this value.
  maxSources: 20,
  // Example limit per monitor/run. Developers can raise MAX_SOURCES up to maxSources.
  defaultMaxSources: 3,
  // Source tasks in parallel; starter seed. SOURCE_CONCURRENCY accepts 1..maxConcurrency.
  defaultConcurrency: 3,
  // Concurrent source tasks; hard ceiling to bound outbound fan-out.
  maxConcurrency: 5,
  // Evaluations/source in parallel; fixed at one to preserve deterministic processing order.
  candidateConcurrency: 1,
  // Candidates/run/source; seed. CANDIDATES_PER_SOURCE accepts 1..maxCandidatesPerSource.
  defaultCandidatesPerSource: 20,
  // Candidates/run/source; hard ceiling. Remaining candidates must stay pending.
  maxCandidatesPerSource: 50,
  // Decoded bytes/source; hard ceiling. Reject oversized responses rather than truncate.
  maxHtmlBytes: 2 * 1024 * 1024,
  // Same-origin GET resources rendered by a browser source; hard ceiling across document and scripts.
  maxBrowserResources: 20,
  // Normalized characters/source; hard ceiling. Excess content is explicitly incomplete.
  maxNormalizedChars: 100_000,
  // Characters/before or after excerpt; hard ceiling, preserving semantic blocks.
  maxExcerptChars: 8_000,
  // Serialized candidate characters, excluding fixed questions; hard ceiling for model input.
  maxCandidateStateChars: 24_000,
  // Characters/source; quality seed. Per-source overrides may lower it to a positive integer.
  minContentChars: 200,
  // Alphabetic characters required before local language identification; below this language is uncertain.
  minLanguageLetters: 30,
  // Missing-text fraction; quality seed in [0, 1]. Quarantine above it; no env override.
  maxContentLossRatio: 0.6,
  // Redirect hops/acquisition; hard ceiling. Validate the destination at every hop.
  maxRedirects: 5,
} as const;

// Milliseconds unless stated otherwise; fixed bounds with no environment overrides.
export const TIMING = {
  // HTTP attempt deadline, including body reads; abort stalled acquisition.
  httpAttemptMs: 15_000,
  // Browser attempt deadline, including rendering and extraction.
  browserAttemptMs: 30_000,
  // Chrome DevTools readiness poll; fixed to fail unavailable binaries before the browser attempt deadline.
  browserLauncherPollMs: 250,
  // Chrome DevTools readiness retries; fixed with no env override to bound launch failure.
  browserLauncherMaxRetries: 20,
  // Browser/CDP cleanup deadline; process and proxy cleanup continue if the remote manager stalls.
  browserCleanupMs: 1_000,
  // Whole Jev evaluation deadline, including all SDK retries.
  jevCallMs: 30_000,
  // Maximum wait per notification provider; failed deliveries remain pending.
  notificationCallMs: 30_000,
  // Whole summary generation deadline, including retries.
  summaryCallMs: 30_000,
  // Shared acquisition deadline across HTTP, browser fallback and retry waits.
  acquisitionDeadlineMs: 120_000,
  // Additional transient attempts; hard ceiling, never retry invalid or blocked input.
  maxRetries: 2,
  // Acquisition backoff starter delay; SDK model retries retain their native algorithm.
  retryInitialDelayMs: 500,
  // Dimensionless acquisition backoff multiplier; fixed exponential growth.
  retryBackoffFactor: 2,
  // Maximum acquisition retry wait; longer Retry-After must defer the source.
  retryMaxDelayMs: 5_000,
  // Live evaluation test deadline; use explicitly on relevant tests, not on ordinary unit tests.
  evalTestTimeoutMs: 180_000,
} as const;

// HTTP protocol values used by acquisition. They are protocol semantics rather than operator-tunable limits.
export const HTTP_STATUS = {
  // Inclusive successful-response range.
  successMin: 200,
  successMaxExclusive: 300,
  // Redirect response codes that require a separately validated destination.
  redirects: [301, 302, 303, 307, 308],
  // Missing robots.txt permits collection under the default robots policy.
  notFound: 404,
  // Transient responses eligible for the bounded acquisition retry policy.
  tooManyRequests: 429,
  serverErrorMin: 500,
} as const;
