import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  createObservationStartMarker,
  createObservationEndMarker,
  createObservationFailedMarker,
  createBufferingStartMarker,
  createBufferingEndMarker,
  createBufferingFailedMarker,
  createActivationMarker,
  createThreadUpdateMarker,
} from '../markers';
import type { ObservationMarkerConfig } from '../types';

const DEFAULT_CONFIG: ObservationMarkerConfig = {
  messageTokens: 30000,
  observationTokens: 40000,
  scope: 'thread',
};

describe('markers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createObservationStartMarker', () => {
    it('returns a data-om-observation-start part with correct fields', () => {
      const marker = createObservationStartMarker({
        cycleId: 'cycle-1',
        operationType: 'observation',
        tokensToObserve: 5000,
        recordId: 'rec-1',
        threadId: 'thread-1',
        threadIds: ['thread-1'],
        config: DEFAULT_CONFIG,
      });

      expect(marker).toEqual({
        type: 'data-om-observation-start',
        data: {
          cycleId: 'cycle-1',
          operationType: 'observation',
          startedAt: '2025-06-15T12:00:00.000Z',
          tokensToObserve: 5000,
          recordId: 'rec-1',
          threadId: 'thread-1',
          threadIds: ['thread-1'],
          config: DEFAULT_CONFIG,
        },
      });
    });

    it('supports reflection operationType', () => {
      const marker = createObservationStartMarker({
        cycleId: 'cycle-2',
        operationType: 'reflection',
        tokensToObserve: 8000,
        recordId: 'rec-2',
        threadId: 'thread-2',
        threadIds: ['thread-2'],
        config: DEFAULT_CONFIG,
      });

      expect(marker.data.operationType).toBe('reflection');
    });

    it('supports multiple threadIds for resource-scoped observation', () => {
      const marker = createObservationStartMarker({
        cycleId: 'cycle-3',
        operationType: 'observation',
        tokensToObserve: 10000,
        recordId: 'rec-3',
        threadId: 'thread-1',
        threadIds: ['thread-1', 'thread-2', 'thread-3'],
        config: { ...DEFAULT_CONFIG, scope: 'resource' },
      });

      expect(marker.data.threadIds).toEqual(['thread-1', 'thread-2', 'thread-3']);
      expect(marker.data.config.scope).toBe('resource');
    });
  });

  describe('createObservationEndMarker', () => {
    it('returns a data-om-observation-end part with duration', () => {
      const startedAt = '2025-06-15T11:59:57.000Z';

      const marker = createObservationEndMarker({
        cycleId: 'cycle-1',
        operationType: 'observation',
        startedAt,
        tokensObserved: 5000,
        observationTokens: 12000,
        observations: '- User asked about weather\n- User prefers Celsius',
        currentTask: 'Helping with weather info',
        suggestedResponse: 'The forecast looks clear',
        recordId: 'rec-1',
        threadId: 'thread-1',
      });

      expect(marker.type).toBe('data-om-observation-end');
      expect(marker.data.completedAt).toBe('2025-06-15T12:00:00.000Z');
      expect(marker.data.durationMs).toBe(3000);
      expect(marker.data.tokensObserved).toBe(5000);
      expect(marker.data.observationTokens).toBe(12000);
      expect(marker.data.observations).toBe('- User asked about weather\n- User prefers Celsius');
      expect(marker.data.currentTask).toBe('Helping with weather info');
      expect(marker.data.suggestedResponse).toBe('The forecast looks clear');
    });

    it('allows optional fields to be undefined', () => {
      const marker = createObservationEndMarker({
        cycleId: 'cycle-2',
        operationType: 'observation',
        startedAt: '2025-06-15T12:00:00.000Z',
        tokensObserved: 3000,
        observationTokens: 8000,
        recordId: 'rec-2',
        threadId: 'thread-2',
      });

      expect(marker.data.observations).toBeUndefined();
      expect(marker.data.currentTask).toBeUndefined();
      expect(marker.data.suggestedResponse).toBeUndefined();
      expect(marker.data.durationMs).toBe(0);
    });
  });

  describe('createThreadUpdateMarker', () => {
    it('returns a data-om-thread-update part with title change fields', () => {
      const marker = createThreadUpdateMarker({
        cycleId: 'cycle-1',
        threadId: 'thread-1',
        oldTitle: 'Old Title',
        newTitle: 'New Title',
      });

      expect(marker).toEqual({
        type: 'data-om-thread-update',
        data: {
          cycleId: 'cycle-1',
          threadId: 'thread-1',
          oldTitle: 'Old Title',
          newTitle: 'New Title',
          timestamp: '2025-06-15T12:00:00.000Z',
        },
      });
    });
  });

  describe('createObservationFailedMarker', () => {
    it('returns a data-om-observation-failed part with error and duration', () => {
      const startedAt = '2025-06-15T11:59:55.000Z';

      const marker = createObservationFailedMarker({
        cycleId: 'cycle-1',
        operationType: 'observation',
        startedAt,
        tokensAttempted: 7000,
        error: 'Observer model failed: rate limit exceeded',
        recordId: 'rec-1',
        threadId: 'thread-1',
      });

      expect(marker.type).toBe('data-om-observation-failed');
      expect(marker.data.failedAt).toBe('2025-06-15T12:00:00.000Z');
      expect(marker.data.durationMs).toBe(5000);
      expect(marker.data.tokensAttempted).toBe(7000);
      expect(marker.data.error).toBe('Observer model failed: rate limit exceeded');
    });

    it('works with reflection operationType', () => {
      const marker = createObservationFailedMarker({
        cycleId: 'cycle-2',
        operationType: 'reflection',
        startedAt: '2025-06-15T12:00:00.000Z',
        tokensAttempted: 15000,
        error: 'Reflector failed: degenerate output',
        recordId: 'rec-2',
        threadId: 'thread-2',
      });

      expect(marker.data.operationType).toBe('reflection');
    });
  });

  describe('createBufferingStartMarker', () => {
    it('returns a data-om-buffering-start part with correct fields', () => {
      const marker = createBufferingStartMarker({
        cycleId: 'cycle-1',
        operationType: 'observation',
        tokensToBuffer: 4000,
        recordId: 'rec-1',
        threadId: 'thread-1',
        threadIds: ['thread-1'],
        config: DEFAULT_CONFIG,
      });

      expect(marker).toEqual({
        type: 'data-om-buffering-start',
        data: {
          cycleId: 'cycle-1',
          operationType: 'observation',
          startedAt: '2025-06-15T12:00:00.000Z',
          tokensToBuffer: 4000,
          recordId: 'rec-1',
          threadId: 'thread-1',
          threadIds: ['thread-1'],
          config: DEFAULT_CONFIG,
        },
      });
    });
  });

  describe('createBufferingEndMarker', () => {
    it('returns a data-om-buffering-end part with duration', () => {
      const startedAt = '2025-06-15T11:59:58.000Z';

      const marker = createBufferingEndMarker({
        cycleId: 'cycle-1',
        operationType: 'observation',
        startedAt,
        tokensBuffered: 3500,
        bufferedTokens: 7000,
        recordId: 'rec-1',
        threadId: 'thread-1',
        observations: '- Buffered obs 1\n- Buffered obs 2',
      });

      expect(marker.type).toBe('data-om-buffering-end');
      expect(marker.data.completedAt).toBe('2025-06-15T12:00:00.000Z');
      expect(marker.data.durationMs).toBe(2000);
      expect(marker.data.tokensBuffered).toBe(3500);
      expect(marker.data.bufferedTokens).toBe(7000);
      expect(marker.data.observations).toBe('- Buffered obs 1\n- Buffered obs 2');
    });

    it('allows observations to be undefined', () => {
      const marker = createBufferingEndMarker({
        cycleId: 'cycle-2',
        operationType: 'reflection',
        startedAt: '2025-06-15T12:00:00.000Z',
        tokensBuffered: 2000,
        bufferedTokens: 5000,
        recordId: 'rec-2',
        threadId: 'thread-2',
      });

      expect(marker.data.observations).toBeUndefined();
    });
  });

  describe('createBufferingFailedMarker', () => {
    it('returns a data-om-buffering-failed part with error and duration', () => {
      const startedAt = '2025-06-15T11:59:50.000Z';

      const marker = createBufferingFailedMarker({
        cycleId: 'cycle-1',
        operationType: 'observation',
        startedAt,
        tokensAttempted: 6000,
        error: 'Buffering timeout exceeded',
        recordId: 'rec-1',
        threadId: 'thread-1',
      });

      expect(marker.type).toBe('data-om-buffering-failed');
      expect(marker.data.failedAt).toBe('2025-06-15T12:00:00.000Z');
      expect(marker.data.durationMs).toBe(10000);
      expect(marker.data.tokensAttempted).toBe(6000);
      expect(marker.data.error).toBe('Buffering timeout exceeded');
    });
  });

  describe('createActivationMarker', () => {
    it('returns a data-om-activation part with correct fields', () => {
      const marker = createActivationMarker({
        cycleId: 'cycle-1',
        operationType: 'observation',
        chunksActivated: 3,
        tokensActivated: 9000,
        observationTokens: 25000,
        messagesActivated: 12,
        recordId: 'rec-1',
        threadId: 'thread-1',
        generationCount: 2,
        observations: '- Activated obs 1\n- Activated obs 2',
        triggeredBy: 'ttl',
        lastActivityAt: 1750000000000,
        ttlExpiredMs: 301000,
        config: DEFAULT_CONFIG,
      });

      expect(marker).toEqual({
        type: 'data-om-activation',
        data: {
          cycleId: 'cycle-1',
          operationType: 'observation',
          activatedAt: '2025-06-15T12:00:00.000Z',
          chunksActivated: 3,
          tokensActivated: 9000,
          observationTokens: 25000,
          messagesActivated: 12,
          recordId: 'rec-1',
          threadId: 'thread-1',
          generationCount: 2,
          config: DEFAULT_CONFIG,
          observations: '- Activated obs 1\n- Activated obs 2',
          triggeredBy: 'ttl',
          lastActivityAt: 1750000000000,
          ttlExpiredMs: 301000,
        },
      });
    });

    it('allows observations to be undefined', () => {
      const marker = createActivationMarker({
        cycleId: 'cycle-2',
        operationType: 'reflection',
        chunksActivated: 1,
        tokensActivated: 4000,
        observationTokens: 15000,
        messagesActivated: 5,
        recordId: 'rec-2',
        threadId: 'thread-2',
        generationCount: 1,
        config: DEFAULT_CONFIG,
      });

      expect(marker.data.observations).toBeUndefined();
    });
  });

  describe('timestamp consistency', () => {
    it('all start markers use the same frozen time', () => {
      const obsStart = createObservationStartMarker({
        cycleId: 'c1',
        operationType: 'observation',
        tokensToObserve: 1000,
        recordId: 'r1',
        threadId: 't1',
        threadIds: ['t1'],
        config: DEFAULT_CONFIG,
      });

      const bufStart = createBufferingStartMarker({
        cycleId: 'c2',
        operationType: 'observation',
        tokensToBuffer: 1000,
        recordId: 'r1',
        threadId: 't1',
        threadIds: ['t1'],
        config: DEFAULT_CONFIG,
      });

      const activation = createActivationMarker({
        cycleId: 'c3',
        operationType: 'observation',
        chunksActivated: 1,
        tokensActivated: 1000,
        observationTokens: 5000,
        messagesActivated: 3,
        recordId: 'r1',
        threadId: 't1',
        generationCount: 1,
        config: DEFAULT_CONFIG,
      });

      expect(obsStart.data.startedAt).toBe('2025-06-15T12:00:00.000Z');
      expect(bufStart.data.startedAt).toBe('2025-06-15T12:00:00.000Z');
      expect(activation.data.activatedAt).toBe('2025-06-15T12:00:00.000Z');
    });

    it('duration markers calculate correctly with time advancement', () => {
      const startedAt = new Date().toISOString();

      // Advance time by 1.5 seconds
      vi.advanceTimersByTime(1500);

      const endMarker = createObservationEndMarker({
        cycleId: 'c1',
        operationType: 'observation',
        startedAt,
        tokensObserved: 2000,
        observationTokens: 8000,
        recordId: 'r1',
        threadId: 't1',
      });

      const failedMarker = createObservationFailedMarker({
        cycleId: 'c2',
        operationType: 'observation',
        startedAt,
        tokensAttempted: 2000,
        error: 'test',
        recordId: 'r1',
        threadId: 't1',
      });

      const bufEndMarker = createBufferingEndMarker({
        cycleId: 'c3',
        operationType: 'observation',
        startedAt,
        tokensBuffered: 2000,
        bufferedTokens: 4000,
        recordId: 'r1',
        threadId: 't1',
      });

      const bufFailedMarker = createBufferingFailedMarker({
        cycleId: 'c4',
        operationType: 'observation',
        startedAt,
        tokensAttempted: 2000,
        error: 'test',
        recordId: 'r1',
        threadId: 't1',
      });

      expect(endMarker.data.durationMs).toBe(1500);
      expect(failedMarker.data.durationMs).toBe(1500);
      expect(bufEndMarker.data.durationMs).toBe(1500);
      expect(bufFailedMarker.data.durationMs).toBe(1500);
    });
  });
});
