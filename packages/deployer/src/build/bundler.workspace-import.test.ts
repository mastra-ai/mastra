import { describe, it, expect } from 'vitest';
import { getUnresolvedWorkspaceImport } from './bundler';

describe('getUnresolvedWorkspaceImport', () => {
  const workspaceMap = new Map([
    ['@scope/workspace-a', { name: '@scope/workspace-a', location: '/workspace-a', version: '1.0.0' } as any],
    ['@scope/workspace-b', { name: '@scope/workspace-b', location: '/workspace-b', version: '1.0.0' } as any],
  ]);

  it('returns the import specifier for a workspace package UNRESOLVED_IMPORT', () => {
    const warning = {
      code: 'UNRESOLVED_IMPORT',
      source: '@scope/workspace-a/sub',
      id: '@scope/workspace-a/sub',
      importer: '/project/src/index.ts',
      message: "'@scope/workspace-a/sub' is imported by ... but could not be resolved",
    };

    expect(getUnresolvedWorkspaceImport(warning, workspaceMap)).toBe('@scope/workspace-a/sub');
  });

  it('uses id as fallback when source is missing', () => {
    const warning = {
      code: 'UNRESOLVED_IMPORT',
      id: '@scope/workspace-b',
    };

    expect(getUnresolvedWorkspaceImport(warning, workspaceMap)).toBe('@scope/workspace-b');
  });

  it('returns undefined for non-workspace packages', () => {
    const warning = {
      code: 'UNRESOLVED_IMPORT',
      source: 'lodash/merge',
    };

    expect(getUnresolvedWorkspaceImport(warning, workspaceMap)).toBeUndefined();
  });

  it('returns undefined for non-UNRESOLVED_IMPORT warnings', () => {
    const warning = {
      code: 'CIRCULAR_DEPENDENCY',
      message: 'Circular dependency: a -> b -> a',
    };

    expect(getUnresolvedWorkspaceImport(warning, workspaceMap)).toBeUndefined();
  });

  it('returns undefined when both source and id are empty', () => {
    const warning = {
      code: 'UNRESOLVED_IMPORT',
      source: '',
      id: '',
    };

    expect(getUnresolvedWorkspaceImport(warning, workspaceMap)).toBeUndefined();
  });

  it('returns undefined when source is empty and id is undefined', () => {
    const warning = {
      code: 'UNRESOLVED_IMPORT',
    };

    expect(getUnresolvedWorkspaceImport(warning, workspaceMap)).toBeUndefined();
  });
});
