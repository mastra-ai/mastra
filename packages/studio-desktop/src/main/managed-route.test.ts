import { describe, expect, it } from 'vitest';
import { applyManagedStudioRoute, normalizeManagedStudioRoute } from './managed-route';

describe('normalizeManagedStudioRoute', () => {
  describe('when the route is the local Agent Builder create page', () => {
    it('returns the normalized route', () => {
      expect(normalizeManagedStudioRoute('/agent-builder/agents/create')).toBe('/agent-builder/agents/create');
    });
  });

  describe('when the route is not allowed', () => {
    it('rejects the route', () => {
      expect(() => normalizeManagedStudioRoute('/platform/sign-in')).toThrow(/not allowed/);
    });
  });

  describe('when the route is an external URL shape', () => {
    it('rejects the route', () => {
      expect(() => normalizeManagedStudioRoute('//example.com/agent-builder/agents/create')).toThrow(/local path/);
    });
  });
});

describe('applyManagedStudioRoute', () => {
  describe('when a managed Studio route is provided', () => {
    it('opens the route on the local Studio shell URL', () => {
      expect(applyManagedStudioRoute('http://127.0.0.1:3133/', '/agent-builder/agents/create')).toBe(
        'http://127.0.0.1:3133/agent-builder/agents/create',
      );
    });
  });
});
