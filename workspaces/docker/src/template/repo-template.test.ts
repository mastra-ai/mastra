/**
 * createDockerRepoTemplate unit tests — assert the synthesized Dockerfile bakes
 * the checkout, ref/commit selection, credentials handling, and setup marker,
 * without touching a Docker daemon.
 */

import { SETUP_MARKER_PATH } from '@internal/workspace';
import { describe, expect, it } from 'vitest';
import { createDockerRepoTemplate } from './repo-template';

describe('createDockerRepoTemplate', () => {
  it('clones the default branch into /workspace/repo and sets the workdir', () => {
    const dockerfile = createDockerRepoTemplate({ repoUrl: 'https://example.com/app.git' }).dockerfile;
    expect(dockerfile).toContain("git clone --depth=1 --single-branch 'https://example.com/app.git' '/workspace/repo'");
    expect(dockerfile).toContain('WORKDIR /workspace/repo');
  });

  it('clones a specific branch when provided', () => {
    const dockerfile = createDockerRepoTemplate({ repoUrl: 'https://example.com/app.git', branch: 'dev' }).dockerfile;
    expect(dockerfile).toContain("--branch 'dev'");
  });

  it('does a full clone and checkout for an exact commit', () => {
    const dockerfile = createDockerRepoTemplate({
      repoUrl: 'https://example.com/app.git',
      commit: 'a1b2c3d',
    }).dockerfile;
    expect(dockerfile).toContain("git clone 'https://example.com/app.git' '/workspace/repo'");
    expect(dockerfile).not.toContain('--depth=1');
    expect(dockerfile).toContain("git -C '/workspace/repo' checkout 'a1b2c3d'");
  });

  it('injects a token via an ephemeral build arg and per-invocation auth header', () => {
    const withToken = createDockerRepoTemplate({ repoUrl: 'https://example.com/app.git', tokenEnv: 'GH_TOKEN' });
    // Declared as an ARG (no baked ENV) so RUN steps can read it at build time.
    expect(withToken.dockerfile).toContain('ARG GH_TOKEN');
    expect(withToken.dockerfile).toContain('http.extraheader');
    // The token value itself is supplied at build time, never written into the Dockerfile.
    expect(withToken.dockerfile).toContain('$GH_TOKEN');
    expect(withToken.dockerfile).not.toMatch(/ENV .*GH_TOKEN/);
  });

  it('runs setup commands and writes the completion marker last', () => {
    const dockerfile = createDockerRepoTemplate({
      repoUrl: 'https://example.com/app.git',
      setupCommands: ['npm ci', 'npm run build'],
    }).dockerfile;
    expect(dockerfile).toContain('RUN npm ci');
    expect(dockerfile).toContain('RUN npm run build');
    const markerIndex = dockerfile.indexOf(SETUP_MARKER_PATH);
    const buildIndex = dockerfile.indexOf('npm run build');
    expect(markerIndex).toBeGreaterThan(buildIndex);
  });

  it('supports a custom base image and destination', () => {
    const dockerfile = createDockerRepoTemplate({
      repoUrl: 'https://example.com/app.git',
      baseImage: 'ubuntu:24.04',
      destination: '/srv/app',
    }).dockerfile;
    expect(dockerfile).toContain('FROM ubuntu:24.04');
    expect(dockerfile).toContain("'/srv/app'");
    expect(dockerfile).toContain('WORKDIR /srv/app');
  });
});
