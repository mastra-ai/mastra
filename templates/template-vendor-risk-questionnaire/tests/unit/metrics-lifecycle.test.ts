import { afterEach, expect, it, vi } from 'vitest';
import { openDatabase } from '../../src/mastra/persistence/database.ts';
import { openProcessingStore } from '../../src/mastra/persistence/processing.ts';
import { openReviewStore } from '../../src/mastra/persistence/review.ts';
import { readDomainMetrics } from '../../src/mastra/observability/metrics.ts';

vi.mock('../../src/mastra/persistence/database.ts', () => ({ openDatabase: vi.fn() }));
vi.mock('../../src/mastra/persistence/processing.ts', () => ({ openProcessingStore: vi.fn() }));
vi.mock('../../src/mastra/persistence/review.ts', () => ({ openReviewStore: vi.fn() }));
vi.mock('../../src/mastra/observability/privacy.ts', () => ({ telemetryId: vi.fn() }));
afterEach(() => vi.resetAllMocks());

it.each([0, 1, 2, 3])('closes only opened metrics stores when stage %i fails', async failureAt => {
  const failure = new Error('STORAGE_FAILURE');
  const close = [vi.fn(), vi.fn(), vi.fn()];
  vi.mocked(openDatabase).mockResolvedValue({ close: close[0] } as unknown as Awaited<ReturnType<typeof openDatabase>>);
  vi.mocked(openProcessingStore).mockResolvedValue({
    close: close[1],
    status: vi.fn().mockRejectedValue(failure),
  } as unknown as Awaited<ReturnType<typeof openProcessingStore>>);
  vi.mocked(openReviewStore).mockResolvedValue({ close: close[2] } as unknown as Awaited<
    ReturnType<typeof openReviewStore>
  >);
  const open = [vi.mocked(openDatabase), vi.mocked(openProcessingStore), vi.mocked(openReviewStore)];
  if (failureAt < 3) open[failureAt]!.mockRejectedValue(failure);
  await expect(readDomainMetrics('file:test.db', 'run')).rejects.toBe(failure);
  for (let i = 0; i < 3; i++) {
    expect(open[i]).toHaveBeenCalledTimes(i <= failureAt ? 1 : 0);
    expect(close[i]).toHaveBeenCalledTimes(i < failureAt ? 1 : 0);
  }
});

it('waits for asynchronous cleanup and preserves the read error when cleanup fails', async () => {
  const failure = new Error('READ_FAILED');
  let finishClose!: () => void;
  const dbClose = vi.fn(() => {
    throw new Error('DB_CLOSE_FAILED');
  });
  const processingClose = vi.fn(
    () =>
      new Promise<void>((_, reject) => {
        finishClose = () => reject(new Error('DRAIN_FAILED'));
      }),
  );
  const reviewClose = vi.fn();
  vi.mocked(openDatabase).mockResolvedValue({ close: dbClose } as unknown as Awaited<ReturnType<typeof openDatabase>>);
  vi.mocked(openProcessingStore).mockResolvedValue({
    close: processingClose,
    status: vi.fn().mockRejectedValue(failure),
  } as unknown as Awaited<ReturnType<typeof openProcessingStore>>);
  vi.mocked(openReviewStore).mockResolvedValue({ close: reviewClose } as unknown as Awaited<
    ReturnType<typeof openReviewStore>
  >);
  let settled = false;
  const result = readDomainMetrics('file:test.db', 'run').catch(error => {
    settled = true;
    return error;
  });
  await vi.waitFor(() => expect(processingClose).toHaveBeenCalledOnce());
  expect(settled).toBe(false);
  expect(reviewClose).toHaveBeenCalledOnce();
  finishClose();
  expect(await result).toBe(failure);
});
