import { describe, expect, it, vi } from 'vitest';

const { buildSkillPathsMock } = vi.hoisted(() => ({
  buildSkillPathsMock: vi.fn((_projectPath: string, _configDir: string) => ['/mock/skills/dir-a', '/mock/skills/dir-b']),
}));

// Mock the workspace module to control buildSkillPaths
vi.mock('../../agents/workspace.js', () => ({
  buildSkillPaths: buildSkillPathsMock,
}));

import { getAllowedPathsFromContext } from '../utils.js';

describe('getAllowedPathsFromContext', () => {
  it('returns a copy of skill paths when toolContext is undefined', () => {
    const a = getAllowedPathsFromContext(undefined);
    const b = getAllowedPathsFromContext(undefined);
    expect(a).toEqual(['/mock/skills/dir-a', '/mock/skills/dir-b']);
    expect(a).not.toBe(b); // must be a fresh copy each time
  });

  it('returns a copy of skill paths when requestContext is missing', () => {
    const a = getAllowedPathsFromContext({});
    const b = getAllowedPathsFromContext({});
    expect(a).toEqual(['/mock/skills/dir-a', '/mock/skills/dir-b']);
    expect(a).not.toBe(b);
  });

  it('merges skill paths with sandbox paths from harness state (getState)', () => {
    buildSkillPathsMock.mockClear();
    const toolContext = {
      requestContext: {
        get: (key: string) => {
          if (key === 'harness') {
            return {
              getState: () => ({
                projectPath: '/test/project',
                configDir: '.mastracode',
                sandboxAllowedPaths: ['/user/sandbox/path-1', '/user/sandbox/path-2'],
              }),
            };
          }
          return undefined;
        },
      },
    };
    const result = getAllowedPathsFromContext(toolContext);
    expect(buildSkillPathsMock).toHaveBeenCalledWith('/test/project', '.mastracode');
    expect(result).toEqual([
      '/mock/skills/dir-a',
      '/mock/skills/dir-b',
      '/user/sandbox/path-1',
      '/user/sandbox/path-2',
    ]);
  });

  it('merges skill paths with sandbox paths from harness state (static state)', () => {
    const toolContext = {
      requestContext: {
        get: (key: string) => {
          if (key === 'harness') {
            return {
              state: {
                projectPath: '/test/project',
                sandboxAllowedPaths: ['/user/sandbox/static-path'],
              },
            };
          }
          return undefined;
        },
      },
    };
    const result = getAllowedPathsFromContext(toolContext);
    expect(result).toEqual(['/mock/skills/dir-a', '/mock/skills/dir-b', '/user/sandbox/static-path']);
  });

  it('returns only skill paths when harness context has no sandbox paths', () => {
    const toolContext = {
      requestContext: {
        get: (key: string) => {
          if (key === 'harness') {
            return {
              getState: () => ({
                projectPath: '/test/project',
              }),
            };
          }
          return undefined;
        },
      },
    };
    const result = getAllowedPathsFromContext(toolContext);
    expect(result).toEqual(['/mock/skills/dir-a', '/mock/skills/dir-b']);
  });

  it('returns only skill paths when harness context is not set', () => {
    const toolContext = {
      requestContext: {
        get: () => undefined,
      },
    };
    const result = getAllowedPathsFromContext(toolContext);
    expect(result).toEqual(['/mock/skills/dir-a', '/mock/skills/dir-b']);
  });

  it('prefers getState() over static state property', () => {
    const toolContext = {
      requestContext: {
        get: (key: string) => {
          if (key === 'harness') {
            return {
              getState: () => ({
                projectPath: '/test/project',
                sandboxAllowedPaths: ['/from-getState'],
              }),
              state: {
                projectPath: '/test/project',
                sandboxAllowedPaths: ['/from-static-state'],
              },
            };
          }
          return undefined;
        },
      },
    };
    const result = getAllowedPathsFromContext(toolContext);
    expect(result).toEqual(['/mock/skills/dir-a', '/mock/skills/dir-b', '/from-getState']);
  });
});
