import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  shutdown: vi.fn(),
  closeStorage: vi.fn(),
  closeReview: vi.fn(),
  readReview: vi.fn(),
  init: vi.fn(),
  readOnly: vi.fn(),
  telemetryHealth: { status: 'healthy' },
}));
vi.mock('@mastra/core', () => ({ Mastra: class {} }));
vi.mock('../../src/mastra/observability/privacy.ts', () => ({
  createLocalObservability: () => ({ shutdown: runtime.shutdown }),
  SafeLogger: class {},
}));
vi.mock('../../src/mastra/persistence/database.ts', () => ({
  databaseUrl: 'file:unused.db',
  runtimeRoot: '/unused',
  storage: { init: runtime.init },
  nativeStorage: { close: runtime.closeStorage, deferTelemetry: vi.fn() },
  configureReadOnlyAccess: runtime.readOnly,
  telemetryHealth: runtime.telemetryHealth,
}));
vi.mock('../../src/mastra/persistence/review.ts', () => ({
  openReviewStore: async () => ({ read: runtime.readReview, close: runtime.closeReview }),
}));
vi.mock('../../src/mastra/workflows/vendor-risk-questionnaire.ts', () => ({
  vendorRiskQuestionnaire: {},
  recoverQuestionnaire: vi.fn(),
}));
vi.mock('../../src/mastra/observability/metrics.ts', () => ({ readDomainMetrics: vi.fn() }));
vi.mock('../../src/mastra/review/service.ts', () => ({ submitReview: vi.fn() }));
vi.mock('../../src/mastra/exports/publication.ts', () => ({ publishExport: vi.fn() }));
vi.mock('../../src/mastra/runtime/profile.ts', () => ({ loadEvidenceProfile: vi.fn() }));
vi.mock('../../src/mastra/runtime/maintenance.ts', () => ({
  previewCleanup: vi.fn(),
  confirmCleanup: vi.fn(),
  cleanupConfirmationSchema: {},
}));

const originalArgv = process.argv;
const originalExitCode = process.exitCode;
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  runtime.telemetryHealth.status = 'healthy';
  process.argv = [process.execPath, 'scripts/review.ts', 'status', '--run-id', 'selected-run'];
  process.exitCode = undefined;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  process.argv = originalArgv;
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
});

it.each(['observability', 'storage', 'both'])(
  'closes every resource and sanitizes %s cleanup failures',
  async failure => {
    const secret = new Error('PRIVATE_CLEANUP_STACK_AND_PAYLOAD');
    if (failure !== 'storage') runtime.shutdown.mockRejectedValue(secret);
    if (failure !== 'observability') runtime.closeStorage.mockRejectedValue(secret);
    runtime.telemetryHealth.status = 'degraded_incomplete';
    await expect(import('../../scripts/review.ts')).resolves.toBeDefined();
    expect(runtime.closeReview).toHaveBeenCalledOnce();
    expect(runtime.shutdown).toHaveBeenCalledOnce();
    expect(runtime.closeStorage).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith(JSON.stringify({ code: 'STORAGE_FAILURE' }));
    expect(console.error).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith(JSON.stringify({ telemetry: 'degraded_incomplete' }));
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('PRIVATE_');
    expect(process.exitCode).toBe(1);
  },
);

it.each(['FOREIGN_REVIEW', 'FOREIGN_CLEANUP', 'FINAL_APPROVAL_REQUIRED', 'COMPLETE_EVIDENCE_OVERRIDE_REQUIRED'])(
  'reports the safe code %s',
  async code => {
    runtime.readReview.mockRejectedValue(new Error(code));
    await import('../../scripts/review.ts');
    expect(console.error).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ code }));
    expect(process.exitCode).toBe(1);
  },
);

it('hides unrecognized error details', async () => {
  runtime.readReview.mockRejectedValue(new Error('PRIVATE_DATABASE_ERROR'));
  await import('../../scripts/review.ts');
  expect(console.error).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ code: 'REVIEW_OPERATION_FAILED' }));
  expect(process.exitCode).toBe(1);
});

it.each([{ args: [] }, { args: ['typo'] }])(
  'prints complete usage for missing or unknown commands: $args',
  async ({ args }) => {
    process.argv = [process.execPath, 'scripts/review.ts', ...args];
    await import('../../scripts/review.ts');
    expect(console.error).toHaveBeenCalledWith(JSON.stringify({ code: 'UNKNOWN_REVIEW_COMMAND' }));
    expect(console.error).toHaveBeenCalledWith(
      'Use metrics, status, submit, resume, export, recover-claim, cleanup-preview or cleanup.',
    );
    expect(runtime.init).not.toHaveBeenCalled();
    expect(runtime.closeStorage).toHaveBeenCalledOnce();
    expect(process.exitCode).toBe(1);
  },
);
