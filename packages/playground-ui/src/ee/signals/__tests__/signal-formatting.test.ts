import { describe, expect, it } from 'vitest';

import { getSignalDescription } from '../signal-formatting';

describe('getSignalDescription', () => {
  describe('when the input names an inherited object property', () => {
    it('does not expose it as a signal description', () => {
      expect(getSignalDescription('toString')).toBeUndefined();
      expect(getSignalDescription('__proto__')).toBeUndefined();
    });
  });
});
