import { describe, expect, it } from 'vitest';

import { findNavItem } from '@/lib/nav';
import { getIsLinkActive } from '@/lib/nav/get-is-link-active';

const experiments = findNavItem('/experiments')!;
const reviewQueue = findNavItem('/experiments/review-queue')!;
const siblings = [experiments, reviewQueue];

describe('getIsLinkActive', () => {
  describe('when on the review queue page', () => {
    it('activates Review Queue only, not its Experiments parent', () => {
      const pathname = '/experiments/review-queue?experiment=exp-1'.split('?')[0]!;
      expect(getIsLinkActive(reviewQueue, pathname, siblings)).toBe(true);
      expect(getIsLinkActive(experiments, pathname, siblings)).toBe(false);
    });
  });

  describe('when on an experiment detail page', () => {
    it('activates Experiments only', () => {
      expect(getIsLinkActive(experiments, '/experiments/exp-1', siblings)).toBe(true);
      expect(getIsLinkActive(reviewQueue, '/experiments/exp-1', siblings)).toBe(false);
    });
  });

  describe('when on the experiments list', () => {
    it('activates Experiments only', () => {
      expect(getIsLinkActive(experiments, '/experiments', siblings)).toBe(true);
      expect(getIsLinkActive(reviewQueue, '/experiments', siblings)).toBe(false);
    });
  });
});
