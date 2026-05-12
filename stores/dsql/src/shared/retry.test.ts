import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  withRetry,
  isRetriableError,
  isPostgresError,
  getErrorCode,
  RETRIABLE_ERROR_CODES,
  DEFAULT_RETRY_OPTIONS,
} from './retry';

// Helper to create a PostgreSQL-like error
function createPgError(code: string, message: string = 'Test error'): Error {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

describe('retry utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isPostgresError', () => {
    it('should return true for errors with code property', () => {
      const error = createPgError('40001');
      expect(isPostgresError(error)).toBe(true);
    });

    it('should return false for regular errors', () => {
      const error = new Error('Test');
      expect(isPostgresError(error)).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isPostgresError(null)).toBe(false);
      expect(isPostgresError(undefined)).toBe(false);
      expect(isPostgresError('string')).toBe(false);
      expect(isPostgresError({ code: '40001' })).toBe(false);
    });
  });

  describe('getErrorCode', () => {
    it('should return code for PostgreSQL errors', () => {
      const error = createPgError('40001');
      expect(getErrorCode(error)).toBe('40001');
    });

    it('should return undefined for regular errors', () => {
      const error = new Error('Test');
      expect(getErrorCode(error)).toBeUndefined();
    });
  });

  describe('isRetriableError', () => {
    it('should return true for serialization failure (40001)', () => {
      const error = createPgError(RETRIABLE_ERROR_CODES.SERIALIZATION_FAILURE);
      expect(isRetriableError(error)).toBe(true);
    });

    it('should return false for deadlock (40P01) - not retriable by default', () => {
      const error = createPgError(RETRIABLE_ERROR_CODES.DEADLOCK_DETECTED);
      expect(isRetriableError(error)).toBe(false);
    });

    it('should return false for connection failure (08006) - not retriable by default', () => {
      const error = createPgError(RETRIABLE_ERROR_CODES.CONNECTION_FAILURE);
      expect(isRetriableError(error)).toBe(false);
    });

    it('should return false for admin shutdown (57P01) - not retriable by default', () => {
      const error = createPgError(RETRIABLE_ERROR_CODES.ADMIN_SHUTDOWN);
      expect(isRetriableError(error)).toBe(false);
    });

    it('should return false for quota errors', () => {
      const error = createPgError('54000'); // PROGRAM_LIMIT_EXCEEDED
      expect(isRetriableError(error)).toBe(false);
    });

    it('should return false for connection-related message errors - not based on message', () => {
      // The default isRetriableError only checks SQLSTATE, not message content
      expect(isRetriableError(new Error('Connection refused'))).toBe(false);
      expect(isRetriableError(new Error('timeout exceeded'))).toBe(false);
      expect(isRetriableError(new Error('ECONNRESET'))).toBe(false);
      expect(isRetriableError(new Error('ECONNREFUSED'))).toBe(false);
    });

    it('should return false for regular errors without code', () => {
      expect(isRetriableError(new Error('Some error'))).toBe(false);
    });

    it('should normalize lowercase SQLSTATE codes to uppercase', () => {
      // Mixed case deadlock - normalized to '40P01' but not retriable by default
      const mixedCaseDeadlock = createPgError('40p01');
      expect(isRetriableError(mixedCaseDeadlock)).toBe(false);

      // Lowercase connection failure - normalized but not retriable by default
      const lowerConnectionFailure = createPgError('08006');
      expect(isRetriableError(lowerConnectionFailure)).toBe(false);
    });

    it('should return false for errors with invalid SQLSTATE format', () => {
      // Invalid: too short
      const error2 = createPgError('4001');
      expect(isRetriableError(error2)).toBe(false);

      // Invalid: too long
      const error3 = createPgError('400001');
      expect(isRetriableError(error3)).toBe(false);

      // Invalid: special characters
      const error4 = createPgError('4000!');
      expect(isRetriableError(error4)).toBe(false);
    });
  });

  describe('withRetry', () => {
    it('should return result on first success', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const resultPromise = withRetry(fn, { maxAttempts: 3 });
      await vi.runAllTimersAsync();
      const { result, attempts } = await resultPromise;

      expect(result).toBe('success');
      expect(attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retriable error and succeed', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(createPgError('40001', 'Serialization failure'))
        .mockResolvedValue('success');

      const onRetry = vi.fn();

      const resultPromise = withRetry(fn, {
        maxAttempts: 3,
        onRetry,
        jitter: false,
      });
      await vi.runAllTimersAsync();
      const { result, attempts } = await resultPromise;

      expect(result).toBe('success');
      expect(attempts).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should throw on non-retriable error', async () => {
      const error = createPgError('42P01', 'Table not found');
      const fn = vi.fn().mockRejectedValue(error);

      await expect(withRetry(fn, { maxAttempts: 3 })).rejects.toThrow('Table not found');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throw after max attempts', async () => {
      vi.useRealTimers(); // Use real timers for this test to avoid unhandled rejection warnings
      const error = createPgError('40001', 'Serialization failure');
      const fn = vi.fn().mockRejectedValue(error);

      await expect(
        withRetry(fn, {
          maxAttempts: 3,
          jitter: false,
          initialDelayMs: 1,
          maxDelayMs: 10,
        }),
      ).rejects.toThrow('Serialization failure');
      expect(fn).toHaveBeenCalledTimes(3);
      vi.useFakeTimers(); // Restore fake timers
    });

    it('should call onRetry callback for each retry', async () => {
      vi.useRealTimers(); // Use real timers for this test to avoid unhandled rejection warnings
      const error = createPgError('40001', 'Serialization failure');
      const fn = vi.fn().mockRejectedValue(error);
      const onRetry = vi.fn();

      await expect(
        withRetry(fn, {
          maxAttempts: 3,
          onRetry,
          jitter: false,
          initialDelayMs: 1,
          maxDelayMs: 10,
        }),
      ).rejects.toThrow();
      expect(onRetry).toHaveBeenCalledTimes(2); // Called before 2nd and 3rd attempts
      expect(onRetry).toHaveBeenCalledWith(error, 1, 1); // First retry with 1ms delay
      expect(onRetry).toHaveBeenCalledWith(error, 2, 2); // Second retry with 2ms delay
      vi.useFakeTimers(); // Restore fake timers
    });

    it('should use custom isRetriable function', async () => {
      const customError = new Error('Custom error');
      const fn = vi.fn().mockRejectedValueOnce(customError).mockResolvedValue('success');

      const isRetriable = vi.fn().mockReturnValue(true);

      const resultPromise = withRetry(fn, {
        maxAttempts: 3,
        isRetriable,
        jitter: false,
      });
      await vi.runAllTimersAsync();
      const { result } = await resultPromise;

      expect(result).toBe('success');
      expect(isRetriable).toHaveBeenCalledWith(customError);
    });

    it('should apply full jitter when jitter is true', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(createPgError('40001', 'Serialization failure'))
        .mockResolvedValue('success');

      const onRetry = vi.fn();
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const resultPromise = withRetry(fn, {
        maxAttempts: 2,
        initialDelayMs: 100,
        maxDelayMs: 100,
        jitter: true,
        onRetry,
      });

      await vi.runAllTimersAsync();
      await resultPromise;

      // With Math.random = 0.5:
      // baseDelay = 100, cappedDelay = 100
      // delay = floor(0.5 * (100 + 1)) = 50
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, 50);

      randomSpy.mockRestore();
    });

    it('should wrap non-Error rejections into Error', async () => {
      const fn = vi.fn().mockRejectedValue('oops');

      await expect(withRetry(fn, { maxAttempts: 1 })).rejects.toThrow('oops');
    });
  });

  describe('error code constants', () => {
    it('should have correct retriable error codes', () => {
      expect(RETRIABLE_ERROR_CODES.SERIALIZATION_FAILURE).toBe('40001');
      expect(RETRIABLE_ERROR_CODES.DEADLOCK_DETECTED).toBe('40P01');
      expect(RETRIABLE_ERROR_CODES.CONNECTION_FAILURE).toBe('08006');
    });
  });

  describe('default retry options', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_RETRY_OPTIONS.maxAttempts).toBe(5);
      expect(DEFAULT_RETRY_OPTIONS.initialDelayMs).toBe(100);
      expect(DEFAULT_RETRY_OPTIONS.maxDelayMs).toBe(2000);
      expect(DEFAULT_RETRY_OPTIONS.backoffMultiplier).toBe(2);
      expect(DEFAULT_RETRY_OPTIONS.jitter).toBe(true);
    });
  });

  describe('withRetry validation', () => {
    it('should throw error for maxAttempts < 1', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      await expect(withRetry(fn, { maxAttempts: 0 })).rejects.toThrow('maxAttempts must be >= 1');
    });

    it('should throw error for negative initialDelayMs', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      await expect(withRetry(fn, { initialDelayMs: -1 })).rejects.toThrow('initialDelayMs must be >= 0');
    });

    it('should throw error for negative maxDelayMs', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      await expect(withRetry(fn, { maxDelayMs: -1 })).rejects.toThrow('maxDelayMs must be > 0');
    });

    it('should throw error for backoffMultiplier < 1', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      await expect(withRetry(fn, { backoffMultiplier: 0.5 })).rejects.toThrow('backoffMultiplier must be >= 1');
    });

    it('should throw error when maxDelayMs < initialDelayMs', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      await expect(withRetry(fn, { initialDelayMs: 100, maxDelayMs: 50 })).rejects.toThrow(
        'maxDelayMs (50) must be >= initialDelayMs (100)',
      );
    });

    it('should throw error for maxDelayMs = 0', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      await expect(withRetry(fn, { maxDelayMs: 0 })).rejects.toThrow('maxDelayMs must be > 0');
    });

    it('should allow valid maxDelayMs > 0 and >= initialDelayMs', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const resultPromise = withRetry(fn, {
        initialDelayMs: 100,
        maxDelayMs: 200,
      });
      await vi.runAllTimersAsync();
      const { result } = await resultPromise;
      expect(result).toBe('success');
    });
  });
});
