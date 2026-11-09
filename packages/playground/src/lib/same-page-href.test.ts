import { describe, expect, it } from 'vitest';
import { isSamePageHref } from './same-page-href';

describe('isSamePageHref', () => {
  describe('when only the search changes', () => {
    it('is the same page', () => {
      expect(isSamePageHref('?tool=refundUser', '/tools')).toBe(true);
      expect(isSamePageHref('/agents/chef/threads/new?tool=cooking-tool', '/agents/chef/threads/new')).toBe(true);
    });
  });

  describe('when the path changes', () => {
    it('is a different page', () => {
      expect(isSamePageHref('/agents/chef', '/tools')).toBe(false);
      expect(isSamePageHref('/tools?tool=refundUser', '/agents/chef/threads/new')).toBe(false);
    });
  });
});
