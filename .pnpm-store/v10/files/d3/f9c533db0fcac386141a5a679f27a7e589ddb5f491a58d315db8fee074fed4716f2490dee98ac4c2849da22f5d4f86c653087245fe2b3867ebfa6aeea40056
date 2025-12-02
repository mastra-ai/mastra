import { Logger } from '@/types'
import { BucketedRateLimiter } from './bucketed-rate-limiter'

jest.useFakeTimers()

describe('BucketedRateLimiter', () => {
  let rateLimiter: BucketedRateLimiter<string>

  beforeEach(() => {
    rateLimiter = new BucketedRateLimiter({
      bucketSize: 10,
      refillRate: 1,
      refillInterval: 1000,
      _logger: {} as unknown as Logger,
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('basic consumption', () => {
    test('it is not rate limited by default', () => {
      const result = rateLimiter.consumeRateLimit('ResizeObserver')
      expect(result).toBe(false)
    })

    test('returns bucket is rate limited if no mutations are left', () => {
      rateLimiter['_buckets']['ResizeObserver'] = { tokens: 0, lastAccess: Date.now() }

      const result = rateLimiter.consumeRateLimit('ResizeObserver')
      expect(result).toBe(true)
    })

    test.each([
      { bucketSize: 1, consumptions: 1 },
      { bucketSize: 5, consumptions: 5 },
      { bucketSize: 10, consumptions: 10 },
      { bucketSize: 50, consumptions: 50 },
    ])('exhausts bucket of size $bucketSize after $consumptions consumptions', ({ bucketSize, consumptions }) => {
      const limiter = new BucketedRateLimiter({
        bucketSize,
        refillRate: 1,
        refillInterval: 1000,
        _logger: {} as unknown as Logger,
      })

      for (let i = 0; i < consumptions - 1; i++) {
        expect(limiter.consumeRateLimit('test')).toBe(false)
      }

      expect(limiter.consumeRateLimit('test')).toBe(true)
      // can check the same bucket more than once
      expect(limiter.consumeRateLimit('test')).toBe(true)
    })
  })

  describe('refill behavior', () => {
    test('refills tokens based on elapsed time', () => {
      const key = 'ResizeObserver'

      for (let i = 0; i < 9; i++) {
        expect(rateLimiter.consumeRateLimit(key)).toBe(false)
      }

      expect(rateLimiter.consumeRateLimit(key)).toBe(true)

      jest.advanceTimersByTime(2000)

      const result = rateLimiter.consumeRateLimit(key)
      expect(result).toBe(false)

      const bucket = rateLimiter['_buckets'][key]
      expect(bucket.tokens).toBe(1)
    })

    test('refills to bucket size maximum', () => {
      const key = 'ResizeObserver'
      rateLimiter.consumeRateLimit(key)

      jest.advanceTimersByTime(20000)

      rateLimiter.consumeRateLimit(key)

      const bucket = rateLimiter['_buckets'][key]
      expect(bucket.tokens).toBe(9)
    })

    test('partial refill intervals do not refill tokens', () => {
      const key = 'test'

      for (let i = 0; i < 9; i++) {
        rateLimiter.consumeRateLimit(key)
      }

      jest.advanceTimersByTime(999)

      rateLimiter.consumeRateLimit(key)
      expect(rateLimiter['_buckets'][key].tokens).toBe(0)
    })

    test.each([
      { refillRate: 1, intervals: 1, expected: 9 },
      { refillRate: 2, intervals: 1, expected: 9 },
      { refillRate: 1, intervals: 2, expected: 9 },
      { refillRate: 3, intervals: 1, tokensLeft: 5, expected: 7 },
      { refillRate: 2, intervals: 2, tokensLeft: 5, expected: 8 },
    ])(
      'with rate $refillRate, $intervals intervals, starting at $tokensLeft tokens, ends at $expected',
      ({ refillRate, intervals, tokensLeft = 9, expected }) => {
        const limiter = new BucketedRateLimiter({
          bucketSize: 10,
          refillRate,
          refillInterval: 1000,
          _logger: {} as unknown as Logger,
        })

        const consumptions = 10 - tokensLeft
        for (let i = 0; i < consumptions; i++) {
          limiter.consumeRateLimit('test')
        }

        jest.advanceTimersByTime(intervals * 1000)

        limiter.consumeRateLimit('test')
        expect(limiter['_buckets']['test'].tokens).toBe(expected)
      }
    )
  })

  describe('bucket isolation', () => {
    test('different keys maintain separate buckets', () => {
      const key1 = 'bucket1'
      const key2 = 'bucket2'

      for (let i = 0; i < 9; i++) {
        rateLimiter.consumeRateLimit(key1)
      }

      expect(rateLimiter.consumeRateLimit(key1)).toBe(true)
      expect(rateLimiter.consumeRateLimit(key2)).toBe(false)

      expect(rateLimiter['_buckets'][key1].tokens).toBe(0)
      expect(rateLimiter['_buckets'][key2].tokens).toBe(9)
    })

    test('supports both string and number keys', () => {
      const limiter = new BucketedRateLimiter<string | number>({
        bucketSize: 5,
        refillRate: 1,
        refillInterval: 1000,
        _logger: {} as unknown as Logger,
      })

      for (let i = 0; i < 4; i++) {
        limiter.consumeRateLimit('string-key')
        limiter.consumeRateLimit(123)
      }

      expect(limiter['_buckets']['string-key'].tokens).toBe(1)
      expect(limiter['_buckets']['123'].tokens).toBe(1)
    })
  })

  describe('callback behavior', () => {
    test('invokes callback when bucket reaches zero', () => {
      const callback = jest.fn()
      const limiter = new BucketedRateLimiter({
        bucketSize: 3,
        refillRate: 1,
        refillInterval: 1000,
        _logger: {} as unknown as Logger,
        _onBucketRateLimited: callback,
      })

      limiter.consumeRateLimit('test')
      limiter.consumeRateLimit('test')
      expect(callback).not.toHaveBeenCalled()

      limiter.consumeRateLimit('test')
      expect(callback).toHaveBeenCalledWith('test')
      expect(callback).toHaveBeenCalledTimes(1)
    })

    test('does not invoke callback for subsequent calls when already at zero', () => {
      const callback = jest.fn()
      const limiter = new BucketedRateLimiter({
        bucketSize: 2,
        refillRate: 1,
        refillInterval: 1000,
        _logger: {} as unknown as Logger,
        _onBucketRateLimited: callback,
      })

      limiter.consumeRateLimit('test')
      limiter.consumeRateLimit('test')
      expect(callback).toHaveBeenCalledTimes(1)

      limiter.consumeRateLimit('test')
      limiter.consumeRateLimit('test')
      expect(callback).toHaveBeenCalledTimes(1)
    })

    test('invokes callback again after refill and re-exhaustion', () => {
      const callback = jest.fn()
      const limiter = new BucketedRateLimiter({
        bucketSize: 2,
        refillRate: 1,
        refillInterval: 1000,
        _logger: {} as unknown as Logger,
        _onBucketRateLimited: callback,
      })

      limiter.consumeRateLimit('test')
      limiter.consumeRateLimit('test')
      expect(callback).toHaveBeenCalledTimes(1)

      jest.advanceTimersByTime(2000)

      limiter.consumeRateLimit('test')
      limiter.consumeRateLimit('test')
      expect(callback).toHaveBeenCalledTimes(2)
    })
  })

  describe('stop method', () => {
    test('clears all buckets', () => {
      rateLimiter.consumeRateLimit('key1')
      rateLimiter.consumeRateLimit('key2')

      expect(Object.keys(rateLimiter['_buckets']).length).toBe(2)

      rateLimiter.stop()

      expect(Object.keys(rateLimiter['_buckets']).length).toBe(0)
    })

    test('resets state after stop', () => {
      for (let i = 0; i < 9; i++) {
        rateLimiter.consumeRateLimit('test')
      }

      rateLimiter.stop()

      expect(rateLimiter.consumeRateLimit('test')).toBe(false)
      expect(rateLimiter['_buckets']['test'].tokens).toBe(9)
    })
  })

  describe('timestamp tracking', () => {
    test('preserves fractional intervals', () => {
      const key = 'test'
      const startTime = Date.now()

      rateLimiter.consumeRateLimit(key)
      expect(rateLimiter['_buckets'][key].lastAccess).toBe(startTime)
      expect(rateLimiter['_buckets'][key].tokens).toBe(9)

      jest.advanceTimersByTime(500)

      rateLimiter.consumeRateLimit(key)
      expect(rateLimiter['_buckets'][key].lastAccess).toBe(startTime)
      expect(rateLimiter['_buckets'][key].tokens).toBe(8)

      jest.advanceTimersByTime(600)

      rateLimiter.consumeRateLimit(key)
      expect(rateLimiter['_buckets'][key].lastAccess).toBe(startTime + 1000)
      expect(rateLimiter['_buckets'][key].tokens).toBe(8)
    })

    test('advances lastAccess by complete intervals on refill', () => {
      const key = 'test'
      const startTime = Date.now()

      for (let i = 0; i < 9; i++) {
        rateLimiter.consumeRateLimit(key)
      }

      expect(rateLimiter['_buckets'][key].lastAccess).toBe(startTime)

      jest.advanceTimersByTime(2500)

      rateLimiter.consumeRateLimit(key)

      expect(rateLimiter['_buckets'][key].lastAccess).toBe(startTime + 2000)
      expect(rateLimiter['_buckets'][key].tokens).toBe(2)
    })
  })
})
