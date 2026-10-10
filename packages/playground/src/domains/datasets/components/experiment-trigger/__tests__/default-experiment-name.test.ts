import { describe, expect, it } from 'vitest';
import { buildDefaultExperimentName } from '../default-experiment-name';

describe('buildDefaultExperimentName', () => {
  describe('when the target name has spaces and symbols', () => {
    it('joins the words with dashes in lowercase', () => {
      expect(buildDefaultExperimentName('Agent with Processor Workflow (v2)!', 'a3f9')).toBe(
        'agent-with-processor-workflow-v2-a3f9',
      );
    });
  });

  describe('when the target name is not in Latin script', () => {
    it('keeps the letters', () => {
      expect(buildDefaultExperimentName('Агент поддержки', 'a3f9')).toBe('агент-поддержки-a3f9');
    });
  });

  describe('when the target name has no letters or digits', () => {
    it('falls back to "experiment"', () => {
      expect(buildDefaultExperimentName('***', 'a3f9')).toBe('experiment-a3f9');
    });
  });
});
