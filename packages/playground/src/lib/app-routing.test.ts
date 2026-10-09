import { describe, expect, it } from 'vitest';

import { paths } from './app-routing';

describe('paths.scorerLink', () => {
  describe('when no params are given', () => {
    it('links to the scorer page', () => {
      expect(paths.scorerLink('scorer-1')).toBe('/scorers/scorer-1');
    });
  });

  describe('when a score id is given', () => {
    it('links to that scorer run', () => {
      expect(paths.scorerLink('scorer-1', { scoreId: 'score-1' })).toBe('/scorers/scorer-1?scoreId=score-1');
    });
  });

  describe('when an entity and a score id are given', () => {
    it('adds both, encoded', () => {
      expect(paths.scorerLink('scorer-1', { entity: 'chef agent', scoreId: 'a&b' })).toBe(
        '/scorers/scorer-1?entity=chef+agent&scoreId=a%26b',
      );
    });
  });
});
