import { describe, it, expect } from 'vitest';
import { matchesPermission } from './roles';

describe('matchesPermission', () => {
  describe('legacy stored:* backwards compatibility', () => {
    const storedFamilies = [
      'stored-agents',
      'stored-mcp-clients',
      'stored-prompt-blocks',
      'stored-scorers',
      'stored-skills',
      'stored-workspaces',
    ];

    it.each(storedFamilies)('granted stored:read matches %s:read', family => {
      expect(matchesPermission('stored:read', `${family}:read`)).toBe(true);
    });

    it.each(storedFamilies)('granted stored:write matches %s:write', family => {
      expect(matchesPermission('stored:write', `${family}:write`)).toBe(true);
    });

    it.each(storedFamilies)('granted stored:delete matches %s:delete', family => {
      expect(matchesPermission('stored:delete', `${family}:delete`)).toBe(true);
    });

    it.each(storedFamilies)('granted stored:* matches %s:read', family => {
      expect(matchesPermission('stored:*', `${family}:read`)).toBe(true);
    });

    it.each(storedFamilies)('granted stored:* matches %s:publish', family => {
      expect(matchesPermission('stored:*', `${family}:publish`)).toBe(true);
    });

    it('granted stored:read does not match stored-agents:write', () => {
      expect(matchesPermission('stored:read', 'stored-agents:write')).toBe(false);
    });

    it('granted stored:read does not match unrelated resources', () => {
      expect(matchesPermission('stored:read', 'agents:read')).toBe(false);
      expect(matchesPermission('stored:read', 'workflows:read')).toBe(false);
    });

    it('granted stored:read with resource id matches stored-agents:read:my-agent', () => {
      expect(matchesPermission('stored:read:my-agent', 'stored-agents:read:my-agent')).toBe(true);
    });

    it('granted stored:read:my-agent does not match different id', () => {
      expect(matchesPermission('stored:read:my-agent', 'stored-agents:read:other')).toBe(false);
    });
  });
});
