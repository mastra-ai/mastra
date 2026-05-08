import { describe, it, expect } from 'vitest';

import { opKey, registerOp, unregisterOp, isOpActiveInProcess } from '../operation-registry';

describe('operation-registry', () => {
  const recordId = 'test-record-123';

  describe('opKey', () => {
    it('creates a key from recordId and operation name', () => {
      expect(opKey(recordId, 'reflecting')).toBe('test-record-123:reflecting');
      expect(opKey(recordId, 'observing')).toBe('test-record-123:observing');
      expect(opKey(recordId, 'bufferingObservation')).toBe('test-record-123:bufferingObservation');
      expect(opKey(recordId, 'bufferingReflection')).toBe('test-record-123:bufferingReflection');
    });
  });

  describe('registerOp / unregisterOp / isOpActiveInProcess', () => {
    // Use unique recordIds per test to avoid cross-test pollution from the shared Set
    it('returns false when no op is registered', () => {
      expect(isOpActiveInProcess('unreg-1', 'reflecting')).toBe(false);
    });

    it('returns true after registering an op', () => {
      registerOp('reg-1', 'observing');
      expect(isOpActiveInProcess('reg-1', 'observing')).toBe(true);
      // cleanup
      unregisterOp('reg-1', 'observing');
    });

    it('returns false after unregistering an op', () => {
      registerOp('unreg-2', 'reflecting');
      unregisterOp('unreg-2', 'reflecting');
      expect(isOpActiveInProcess('unreg-2', 'reflecting')).toBe(false);
    });

    it('tracks different operations independently for the same record', () => {
      registerOp('multi-1', 'observing');
      registerOp('multi-1', 'reflecting');

      expect(isOpActiveInProcess('multi-1', 'observing')).toBe(true);
      expect(isOpActiveInProcess('multi-1', 'reflecting')).toBe(true);
      expect(isOpActiveInProcess('multi-1', 'bufferingObservation')).toBe(false);

      unregisterOp('multi-1', 'observing');
      expect(isOpActiveInProcess('multi-1', 'observing')).toBe(false);
      expect(isOpActiveInProcess('multi-1', 'reflecting')).toBe(true);

      // cleanup
      unregisterOp('multi-1', 'reflecting');
    });

    it('tracks different records independently', () => {
      registerOp('rec-a', 'observing');
      registerOp('rec-b', 'observing');

      expect(isOpActiveInProcess('rec-a', 'observing')).toBe(true);
      expect(isOpActiveInProcess('rec-b', 'observing')).toBe(true);

      unregisterOp('rec-a', 'observing');
      expect(isOpActiveInProcess('rec-a', 'observing')).toBe(false);
      expect(isOpActiveInProcess('rec-b', 'observing')).toBe(true);

      // cleanup
      unregisterOp('rec-b', 'observing');
    });

    it('unregisterOp is idempotent (no error on double-unregister)', () => {
      registerOp('idem-1', 'bufferingObservation');
      unregisterOp('idem-1', 'bufferingObservation');
      unregisterOp('idem-1', 'bufferingObservation'); // should not throw
      expect(isOpActiveInProcess('idem-1', 'bufferingObservation')).toBe(false);
    });

    it('handles concurrent duplicate registrations with ref counting', () => {
      registerOp('dup-1', 'observing');
      registerOp('dup-1', 'observing'); // second concurrent registration

      // After one unregister, the op should still be active (ref count = 1)
      unregisterOp('dup-1', 'observing');
      expect(isOpActiveInProcess('dup-1', 'observing')).toBe(true);

      // After the second unregister, the op should be inactive (ref count = 0)
      unregisterOp('dup-1', 'observing');
      expect(isOpActiveInProcess('dup-1', 'observing')).toBe(false);
    });

    it('unregisterOp on non-registered key is a no-op', () => {
      unregisterOp('never-registered', 'reflecting'); // should not throw
      expect(isOpActiveInProcess('never-registered', 'reflecting')).toBe(false);
    });
  });
});
