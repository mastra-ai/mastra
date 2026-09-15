import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  getProjectRoot,
  getWorkspacePath,
} from '../../../../../templates/template-agent-harness/src/mastra/workspace-path';

const projectRoot = path.resolve('/tmp', 'offline-agent');
const publicCwd = path.join(projectRoot, 'src', 'mastra', 'public');
const buildCwd = path.join(projectRoot, '.mastra', 'output');

describe('template-agent-harness workspace path', () => {
  it('uses MASTRA_PROJECT_ROOT when mastra dev runs from src/mastra/public', () => {
    const env = { MASTRA_PROJECT_ROOT: projectRoot };
    expect(getProjectRoot(env, publicCwd)).toBe(path.resolve(projectRoot));
    expect(getWorkspacePath(env, publicCwd)).toBe(path.join(path.resolve(projectRoot), 'workspace'));
  });

  it('resolves a relative workspace from the repository root cwd', () => {
    expect(getProjectRoot({}, projectRoot)).toBe(projectRoot);
    expect(getWorkspacePath({}, projectRoot)).toBe(path.join(projectRoot, 'workspace'));
  });

  it('strips src/mastra/public from cwd when MASTRA_PROJECT_ROOT is unset', () => {
    expect(getProjectRoot({}, publicCwd)).toBe(projectRoot);
    expect(getWorkspacePath({}, publicCwd)).toBe(path.join(projectRoot, 'workspace'));
  });

  it('strips .mastra/output from cwd when MASTRA_PROJECT_ROOT is unset', () => {
    expect(getProjectRoot({}, buildCwd)).toBe(projectRoot);
    expect(getWorkspacePath({}, buildCwd)).toBe(path.join(projectRoot, 'workspace'));
  });

  it('honors an absolute WORKSPACE_PATH regardless of cwd', () => {
    const absolute = path.join(os.tmpdir(), 'custom-mastra-workspace');
    expect(getWorkspacePath({ WORKSPACE_PATH: absolute, MASTRA_PROJECT_ROOT: projectRoot }, publicCwd)).toBe(
      path.resolve(absolute),
    );
  });

  it('joins a relative WORKSPACE_PATH to the project root, not the public cwd', () => {
    expect(getWorkspacePath({ WORKSPACE_PATH: 'data/files', MASTRA_PROJECT_ROOT: projectRoot }, publicCwd)).toBe(
      path.join(path.resolve(projectRoot), 'data', 'files'),
    );
  });
});
