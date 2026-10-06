import { describe, expect, it } from 'vitest';

import { computeAgentInitialValues } from '../compute-agent-initial-values';

describe('computeAgentInitialValues', () => {
  describe('when memory references a registered memory instance', () => {
    it('keeps the reference and leaves the inline memory fields empty', () => {
      const values = computeAgentInitialValues({ memory: { type: 'id', memoryId: 'support-memory' } });

      expect(values.memoryRef).toEqual({ type: 'id', memoryId: 'support-memory' });
      expect(values.memory).toBeUndefined();
    });
  });

  describe('when memory is a tagged inline config', () => {
    it('maps the wrapped config into the inline memory fields', () => {
      const values = computeAgentInitialValues({
        memory: { type: 'inline', config: { options: { lastMessages: 12, readOnly: true } } },
      });

      expect(values.memoryRef).toBeUndefined();
      expect(values.memory).toMatchObject({ enabled: true, lastMessages: 12, readOnly: true });
    });
  });

  describe('when memory is a legacy untagged inline config', () => {
    it('maps the config into the inline memory fields', () => {
      const values = computeAgentInitialValues({ memory: { options: { lastMessages: 8 } } });

      expect(values.memoryRef).toBeUndefined();
      expect(values.memory).toMatchObject({ enabled: true, lastMessages: 8 });
    });
  });
});
