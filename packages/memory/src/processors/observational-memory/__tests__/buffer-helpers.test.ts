import { describe, it, expect } from 'vitest';

import {
  isAsyncObservationEnabled,
  isAsyncReflectionEnabled,
  getObservationBufferKey,
  getReflectionBufferKey,
  isAsyncBufferingInProgress,
} from '../buffer-helpers';

describe('buffer-helpers', () => {
  describe('isAsyncObservationEnabled', () => {
    it('should return true when bufferTokens is a positive number', () => {
      expect(isAsyncObservationEnabled({ bufferTokens: 5000 })).toBe(true);
    });

    it('should return false when bufferTokens is undefined', () => {
      expect(isAsyncObservationEnabled({})).toBe(false);
    });

    it('should return false when bufferTokens is 0', () => {
      expect(isAsyncObservationEnabled({ bufferTokens: 0 })).toBe(false);
    });

    it('should return false when bufferTokens is negative', () => {
      expect(isAsyncObservationEnabled({ bufferTokens: -1 })).toBe(false);
    });

    it('should return true for fractional bufferTokens', () => {
      expect(isAsyncObservationEnabled({ bufferTokens: 0.2 })).toBe(true);
    });
  });

  describe('isAsyncReflectionEnabled', () => {
    it('should return true when bufferActivation is a positive number', () => {
      expect(isAsyncReflectionEnabled({ bufferActivation: 0.5 })).toBe(true);
    });

    it('should return false when bufferActivation is undefined', () => {
      expect(isAsyncReflectionEnabled({})).toBe(false);
    });

    it('should return false when bufferActivation is 0', () => {
      expect(isAsyncReflectionEnabled({ bufferActivation: 0 })).toBe(false);
    });

    it('should return false when bufferActivation is negative', () => {
      expect(isAsyncReflectionEnabled({ bufferActivation: -0.5 })).toBe(false);
    });
  });

  describe('getObservationBufferKey', () => {
    it('should prefix with obs:', () => {
      expect(getObservationBufferKey('thread:abc')).toBe('obs:thread:abc');
    });

    it('should handle resource lock keys', () => {
      expect(getObservationBufferKey('resource:user-1')).toBe('obs:resource:user-1');
    });
  });

  describe('getReflectionBufferKey', () => {
    it('should prefix with refl:', () => {
      expect(getReflectionBufferKey('thread:abc')).toBe('refl:thread:abc');
    });

    it('should handle resource lock keys', () => {
      expect(getReflectionBufferKey('resource:user-1')).toBe('refl:resource:user-1');
    });
  });

  describe('isAsyncBufferingInProgress', () => {
    it('should return false for empty map', () => {
      const ops = new Map<string, Promise<void>>();
      expect(isAsyncBufferingInProgress('obs:thread:test', ops)).toBe(false);
    });

    it('should return true when key exists in map', () => {
      const ops = new Map<string, Promise<void>>();
      ops.set('obs:thread:test', Promise.resolve());
      expect(isAsyncBufferingInProgress('obs:thread:test', ops)).toBe(true);
    });

    it('should return false for different key', () => {
      const ops = new Map<string, Promise<void>>();
      ops.set('obs:thread:other', Promise.resolve());
      expect(isAsyncBufferingInProgress('obs:thread:test', ops)).toBe(false);
    });

    it('should distinguish observation and reflection keys', () => {
      const ops = new Map<string, Promise<void>>();
      ops.set('obs:thread:test', Promise.resolve());
      expect(isAsyncBufferingInProgress('obs:thread:test', ops)).toBe(true);
      expect(isAsyncBufferingInProgress('refl:thread:test', ops)).toBe(false);
    });
  });
});
