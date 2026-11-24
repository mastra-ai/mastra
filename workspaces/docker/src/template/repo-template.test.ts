/**
 * createDockerRepoTemplate tests — the Dockerfile assembly is asserted through
 * the pure `buildRepoTemplate`; head resolution is exercised against a local
 * bare git repository served over the file protocol (no network, no daemon).
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SETUP_FAILED_MARKER_PATH,
  SETUP_MARKER_PATH,
  WORKSPACE_SETUP_MARKER_PATH,
  repoSetupMarkerPath,
  setupMarkerContent,
} from '@internal/workspace';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildMultiRepoTemplate, buildRepoTemplate, createDockerRepoTemplate, resolveHead } from './repo-template';

const cloneUrl = 'https://example.com/acme/app.git';
const sha = '0123456789abcdef0123456789abcdef01234567';
const otherSha = 'f'.repeat(40);

const markerLine = (path: string, ...commands: string[]) =>
  `RUN mkdir -p "$(dirname "${path}")" && printf '%s' '${setupMarkerContent(commands)}' > "${path}"`;
const guarded = (dir: string, command: string) =>
  `RUN ( cd "${dir}" && sh -c '${command}' ) || { mkdir -p ".mastra-sandbox" && grep -qxF -- '${dir}' "${SETUP_FAILED_MARKER_PATH}" 2>/dev/null || printf '%s\\n' '${dir}' >> "${SETUP_FAILED_MARKER_PATH}"; }`;

describe('buildRepoTemplate', () => {
  it('clones under /workspace/<repo>, installs git first, and sets the workdir', () => {
    const dockerfile = buildRepoTemplate({ cloneUrl, sha, workingDirectory: '/workspace' }).dockerfile;
    // The slim default base has no git, so it is installed before the clone stage.
    expect(dockerfile.indexOf('apt-get install')).toBeLessThan(dockerfile.indexOf('git clone'));
    expect(dockerfile).toMatch(/apt-get install[^\n]*\bgit\b/);
    expect(dockerfile).toContain("git clone 'https://example.com/acme/app.git' '/workspace/app'");
    expect(dockerfile).toContain('WORKDIR /workspace/app');
  });

  it('chowns the checkout to the owner for non-root base images', () => {
    const owned = buildRepoTemplate({
      cloneUrl,
      sha,
      workingDirectory: '/workspace',
      baseImage: 'node:22',
      owner: 'node',
    });
    expect(owned.dockerfile).toContain('COPY --chown=node --from=mastra-secret-0 /workspace/app /workspace/app');
    const plain = buildRepoTemplate({ cloneUrl, sha, workingDirectory: '/workspace', baseImage: 'node:22' });
    expect(plain.dockerfile).toContain('COPY --from=mastra-secret-0 /workspace/app /workspace/app');
    expect(() => buildRepoTemplate({ cloneUrl, sha, workingDirectory: '/workspace', owner: '' })).toThrow();
  });

  it('pins the sha with a full clone + detached checkout, making it part of the identity', () => {
    const a = buildRepoTemplate({ cloneUrl, sha, workingDirectory: '/workspace' });
    const b = buildRepoTemplate({ cloneUrl, sha: 'f'.repeat(40), workingDirectory: '/workspace' });
    expect(a.dockerfile).not.toContain('--depth=1');
    expect(a.dockerfile).toContain(`git -C '/workspace/app' checkout --detach '${sha}'`);
    expect(a.templateId).not.toBe(b.templateId);
  });

  it('passes the token by value to the clone stage only and keeps it out of the identity', () => {
    const withToken = buildRepoTemplate({ cloneUrl, sha, token: 'tok-1', workingDirectory: '/workspace' });
    const rotated = buildRepoTemplate({ cloneUrl, sha, token: 'tok-2', workingDirectory: '/workspace' });
    const dockerfile = withToken.dockerfile;
    expect(dockerfile).toContain('AS mastra-secret-');
    expect(dockerfile).toContain('--mount=type=secret,id=GH_TOKEN');
    expect(dockerfile).not.toContain('ARG ');
    expect(dockerfile).toContain('http.extraheader');
    expect(dockerfile).not.toContain('tok-1');
    expect(dockerfile).not.toMatch(/ENV .*GH_TOKEN/);
    const mainStages = dockerfile.split('\nFROM ').filter(stage => !stage.includes('AS mastra-secret-'));
    expect(mainStages.join('\n')).not.toContain('GH_TOKEN');
    expect(withToken.templateId).toBe(rotated.templateId);
  });

  it('bakes buildEnv into ENV and the identity', () => {
    const a = buildRepoTemplate({
      cloneUrl,
      sha,
      buildEnv: { NPM_CONFIG_REGISTRY: 'https://r1' },
      workingDirectory: '/w',
    });
    const b = buildRepoTemplate({
      cloneUrl,
      sha,
      buildEnv: { NPM_CONFIG_REGISTRY: 'https://r2' },
      workingDirectory: '/w',
    });
    expect(a.dockerfile).toContain('ENV NPM_CONFIG_REGISTRY=');
    expect(a.templateId).not.toBe(b.templateId);
  });

  it('clones and pins in one secret stage, then runs setup and writes the completion marker last', () => {
    const dockerfile = buildRepoTemplate({
      cloneUrl,
      sha,
      setupCommand: ['npm ci', 'npm run build'],
      workingDirectory: '/workspace',
    }).dockerfile;
    // The whole file is pinned: this is the single form's shape, unchanged.
    expect(dockerfile.trimEnd()).toBe(
      [
        'FROM node:22-slim AS mastra-main-0',
        'RUN apt-get update && apt-get install -y git ca-certificates && rm -rf /var/lib/apt/lists/*',
        'FROM mastra-main-0 AS mastra-secret-1',
        `RUN git clone 'https://example.com/acme/app.git' '/workspace/app' && git -C '/workspace/app' checkout --detach '${sha}'`,
        'FROM mastra-main-0 AS mastra-main-1',
        'COPY --from=mastra-secret-1 /workspace/app /workspace/app',
        'WORKDIR /workspace/app',
        'RUN npm ci',
        'RUN npm run build',
        markerLine(SETUP_MARKER_PATH, 'npm ci', 'npm run build'),
      ].join('\n'),
    );
  });

  it('writes no marker without setup commands', () => {
    expect(buildRepoTemplate({ cloneUrl, sha, workingDirectory: '/workspace' }).dockerfile).not.toContain(
      SETUP_MARKER_PATH,
    );
  });

  it('supports a custom base image and working directory', () => {
    const dockerfile = buildRepoTemplate({
      cloneUrl,
      sha,
      baseImage: 'ubuntu:24.04',
      workingDirectory: '/srv/',
    }).dockerfile;
    expect(dockerfile).toContain('FROM ubuntu:24.04');
    expect(dockerfile).toContain('WORKDIR /srv/app');
  });
});

describe('buildMultiRepoTemplate', () => {
  const privateRepo = {
    cloneUrl: 'https://example.com/acme/private.git',
    sha,
    token: 'tok-1',
    tokenEnv: 'GH_TOKEN_0',
    setupCommand: 'npm ci',
  };
  const publicRepo = { cloneUrl, sha: otherSha, setupCommand: "echo it's # note" };

  it('chowns every checkout to the owner for non-root base images', () => {
    const dockerfile = buildMultiRepoTemplate({
      workingDirectory: '/workspace',
      continueOnSetupFailure: false,
      baseImage: 'node:22',
      owner: 'node',
      repos: [privateRepo, publicRepo],
    }).dockerfile;
    const copies = dockerfile.split('\n').filter(line => line.startsWith('COPY '));
    expect(copies).toHaveLength(2);
    for (const line of copies) expect(line).toMatch(/^COPY --chown=node --from=/);
    // WORKDIR creates the workspace as the image's USER; a RUN mkdir would run
    // as that user too and fail under a root-owned parent.
    expect(dockerfile).toContain('WORKDIR /workspace');
    expect(dockerfile).not.toMatch(/RUN mkdir -p '\/workspace'/);
  });

  it('lays every repository out under the workspace, public first, each after its own pin', () => {
    const dockerfile = buildMultiRepoTemplate({
      workingDirectory: '/workspace',
      continueOnSetupFailure: true,
      workspaceSetupCommand: 'touch .ready',
      repos: [privateRepo, publicRepo],
    }).dockerfile;
    expect(dockerfile.trimEnd()).toBe(
      [
        'FROM node:22-slim AS mastra-main-0',
        'RUN apt-get update && apt-get install -y git ca-certificates && rm -rf /var/lib/apt/lists/*',
        'WORKDIR /workspace',
        'FROM mastra-main-0 AS mastra-secret-2',
        `RUN git clone 'https://example.com/acme/app.git' '/workspace/app' && git -C '/workspace/app' checkout --detach '${otherSha}'`,
        'FROM mastra-main-0 AS mastra-main-1',
        'COPY --from=mastra-secret-2 /workspace/app /workspace/app',
        guarded('app', "echo it'\\''s # note"),
        markerLine(repoSetupMarkerPath('app'), "echo it's # note"),
        'FROM mastra-main-1 AS mastra-secret-5',
        `RUN --mount=type=secret,id=GH_TOKEN_0,mode=0444 export GH_TOKEN_0="$(cat /run/secrets/GH_TOKEN_0)" && git -c http.extraheader="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$GH_TOKEN_0" | base64 -w0)" clone 'https://example.com/acme/private.git' '/workspace/private' && git -C '/workspace/private' checkout --detach '${sha}'`,
        'FROM mastra-main-1 AS mastra-main-2',
        'COPY --from=mastra-secret-5 /workspace/private /workspace/private',
        guarded('private', 'npm ci'),
        markerLine(repoSetupMarkerPath('private'), 'npm ci'),
        'RUN touch .ready',
        markerLine(WORKSPACE_SETUP_MARKER_PATH, 'touch .ready'),
      ].join('\n'),
    );
    // Every RUN is one line: a Dockerfile instruction cannot span lines.
    expect(dockerfile).not.toContain('tok-1');
  });

  it('leaves setup steps unguarded and still writes the workspace marker when the guard is off', () => {
    const dockerfile = buildMultiRepoTemplate({
      workingDirectory: '/workspace',
      continueOnSetupFailure: false,
      repos: [publicRepo],
    }).dockerfile;
    expect(dockerfile).toContain(`RUN cd "app" && echo it's # note`);
    expect(dockerfile).not.toContain(SETUP_FAILED_MARKER_PATH);
    expect(dockerfile.trimEnd().endsWith(markerLine(WORKSPACE_SETUP_MARKER_PATH))).toBe(true);
  });

  it('keeps the credential out of the identity and the main stages', () => {
    const a = buildMultiRepoTemplate({ workingDirectory: '/w', continueOnSetupFailure: false, repos: [privateRepo] });
    const b = buildMultiRepoTemplate({
      workingDirectory: '/w',
      continueOnSetupFailure: false,
      repos: [{ ...privateRepo, token: 'tok-2' }],
    });
    expect(a.templateId).toBe(b.templateId);
    const mainStages = a.dockerfile.split('\nFROM ').filter(stage => !stage.includes('AS mastra-secret-'));
    expect(mainStages.join('\n')).not.toContain('GH_TOKEN');
  });
});

describe('createDockerRepoTemplate', () => {
  it('returns undefined when there is no repository access', () => {
    expect(createDockerRepoTemplate({ getRepositoryAccess: undefined })).toBeUndefined();
    expect(createDockerRepoTemplate({ repos: [] })).toBeUndefined();
  });

  it('rejects both forms together and the list-only options without repos', () => {
    const getRepositoryAccess = async () => ({ cloneUrl });
    expect(() => createDockerRepoTemplate({ getRepositoryAccess, repos: [{ getRepositoryAccess }] })).toThrow(
      TypeError,
    );
    expect(() => createDockerRepoTemplate({ getRepositoryAccess, workspaceSetupCommand: 'x' })).toThrow(TypeError);
    expect(() => createDockerRepoTemplate({ getRepositoryAccess, continueOnSetupFailure: false })).toThrow(TypeError);
  });

  it('rejects a bare newline in a setup command up front, but keeps backslash continuation', () => {
    const getRepositoryAccess = async () => ({ cloneUrl });
    expect(() => createDockerRepoTemplate({ getRepositoryAccess, setupCommand: 'npm ci\nnpm test' })).toThrow(
      /bare newline/,
    );
    expect(() =>
      createDockerRepoTemplate({ getRepositoryAccess, setupCommand: 'npm ci \\\n  --omit=dev' }),
    ).not.toThrow();
    expect(() =>
      createDockerRepoTemplate({ repos: [{ getRepositoryAccess }], workspaceSetupCommand: ['ok', 'a\nb'] }),
    ).toThrow(/workspaceSetupCommand/);
    expect(() => createDockerRepoTemplate({ getRepositoryAccess, setupCommand: ['npm ci', 'npm test'] })).not.toThrow();
  });

  it('validates every entry ref up front', () => {
    const getRepositoryAccess = async () => ({ cloneUrl });
    expect(() =>
      createDockerRepoTemplate({ repos: [{ getRepositoryAccess }, { getRepositoryAccess, ref: 'x; rm -rf /' }] }),
    ).toThrow(/Invalid ref/);
  });

  it('rejects unsafe refs and relative working directories up front', () => {
    const getRepositoryAccess = async () => ({ cloneUrl });
    expect(() => createDockerRepoTemplate({ getRepositoryAccess, ref: 'x; rm -rf /' })).toThrow(/Invalid ref/);
    expect(() => createDockerRepoTemplate({ getRepositoryAccess, workingDirectory: 'rel' })).toThrow(/absolute/);
  });

  it('rejects clone URLs that could smuggle shell or credentials', async () => {
    const resolver = createDockerRepoTemplate({
      getRepositoryAccess: async () => ({ cloneUrl: 'https://user:pw@example.com/a/b.git' }),
    })!;
    await expect(resolver()).rejects.toThrow(/Invalid cloneUrl/);
  });

  it('propagates cancellation through repository access and build environment resolution', async () => {
    const controller = new AbortController();
    const getRepositoryAccess = async ({ abortSignal }: { abortSignal?: AbortSignal }) => {
      expect(abortSignal).toBe(controller.signal);
      controller.abort();
      return { cloneUrl };
    };
    const buildEnv = ({ abortSignal }: { abortSignal?: AbortSignal }) => {
      expect(abortSignal).toBe(controller.signal);
      return {};
    };
    const resolver = createDockerRepoTemplate({ getRepositoryAccess, buildEnv, ref: sha })!;
    await expect(resolver({ abortSignal: controller.signal })).rejects.toMatchObject({ code: 'ABORTED' });
  });

  it('forwards the resolver signal to build environment resolution', async () => {
    const controller = new AbortController();
    const buildEnv = vi.fn(() => ({}));
    const resolver = createDockerRepoTemplate({
      getRepositoryAccess: async () => ({ cloneUrl }),
      buildEnv,
      ref: sha,
    })!;

    await resolver({ abortSignal: controller.signal });

    expect(buildEnv).toHaveBeenCalledWith({ abortSignal: controller.signal });
  });

  it('rejects pre-aborted resolution before requesting repository access', async () => {
    const getRepositoryAccess = async () => ({ cloneUrl });
    const resolver = createDockerRepoTemplate({ getRepositoryAccess, ref: sha })!;
    const controller = new AbortController();
    controller.abort();
    await expect(resolver({ abortSignal: controller.signal })).rejects.toMatchObject({ code: 'ABORTED' });
  });

  it('propagates getRepositoryAccess failures instead of masking them', async () => {
    const resolver = createDockerRepoTemplate({
      getRepositoryAccess: async () => {
        throw new Error('token exchange failed');
      },
    })!;
    await expect(resolver()).rejects.toThrow(/token exchange failed/);
  });

  it('throws when access resolves to no clone URL', async () => {
    const resolver = createDockerRepoTemplate({ getRepositoryAccess: async () => undefined })!;
    await expect(resolver()).rejects.toThrow(/no clone URL/);
  });

  describe('head resolution', () => {
    let dir: string;
    let bare: string;
    let headSha: string;

    beforeAll(() => {
      dir = mkdtempSync(join(tmpdir(), 'docker-repo-template-'));
      const work = join(dir, 'work');
      bare = join(dir, 'app.git');
      const git = (args: string[], cwd = work) =>
        execFileSync('git', args, { cwd, stdio: 'pipe', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
          .toString()
          .trim();
      execFileSync('git', ['init', '-q', '-b', 'main', work]);
      git(['config', 'user.email', 't@example.com']);
      git(['config', 'user.name', 't']);
      writeFileSync(join(work, 'README'), 'hi');
      git(['add', '.']);
      git(['commit', '-q', '-m', 'init']);
      headSha = git(['rev-parse', 'HEAD']);
      execFileSync('git', ['clone', '-q', '--bare', work, bare]);
    });

    afterAll(() => rmSync(dir, { recursive: true, force: true }));

    it('resolves the default branch, a named branch, and a tag to shas via ls-remote', async () => {
      execFileSync('git', ['tag', 'v1', headSha], { cwd: bare });
      await expect(resolveHead(bare, undefined, undefined)).resolves.toBe(headSha);
      await expect(resolveHead(bare, 'main', undefined)).resolves.toBe(headSha);
      await expect(resolveHead(bare, 'v1', undefined)).resolves.toBe(headSha);
      await expect(resolveHead(bare, 'nope', undefined)).resolves.toBeUndefined();
      await expect(resolveHead(join(dir, 'missing.git'), undefined, undefined)).resolves.toBeUndefined();
    });

    it('only treats a full 40-char sha as already resolved; short hex could be a branch', async () => {
      await expect(resolveHead(bare, sha, undefined)).resolves.toBe(sha);
      execFileSync('git', ['branch', 'deadbee', headSha], { cwd: bare });
      await expect(resolveHead(bare, 'deadbee', undefined)).resolves.toBe(headSha);
    });

    it('passes the token to ls-remote through GIT_CONFIG_* env, never argv', async () => {
      const binDir = join(dir, 'bin');
      mkdirSync(binDir, { recursive: true });
      const log = join(dir, 'git.log');
      writeFileSync(
        join(binDir, 'git'),
        `#!/bin/sh\nprintf 'ARGV=%s\\n' "$*" >> '${log}'\nprintf 'CFG=%s\\n' "$GIT_CONFIG_VALUE_0" >> '${log}'\nprintf '${headSha}\\tHEAD\\n'\n`,
        { mode: 0o755 },
      );
      const prevPath = process.env.PATH;
      process.env.PATH = `${binDir}:${prevPath}`;
      try {
        await expect(resolveHead('https://example.com/a/b.git', undefined, 'tok-secret')).resolves.toBe(headSha);
      } finally {
        process.env.PATH = prevPath;
      }
      const recorded = readFileSync(log, 'utf8');
      const expectedHeader = `AUTHORIZATION: basic ${Buffer.from('x-access-token:tok-secret').toString('base64')}`;
      expect(recorded).toContain(`CFG=${expectedHeader}`);
      expect(recorded).toMatch(/ARGV=ls-remote -- https:\/\/example\.com\/a\/b\.git HEAD/);
      expect(recorded).not.toContain('ARGV=-c');
      expect(recorded).not.toContain('tok-secret');
    });

    // Clone URLs must be https, so the resolver-level tests stub `git` on PATH
    // instead of touching the network.
    const withFakeGit = async (script: string, run: () => Promise<void>) => {
      const binDir = mkdtempSync(join(dir, 'fake-git-'));
      writeFileSync(join(binDir, 'git'), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
      const prevPath = process.env.PATH;
      process.env.PATH = `${binDir}:${prevPath}`;
      try {
        await run();
      } finally {
        process.env.PATH = prevPath;
      }
    };

    it('rejects when the head cannot be resolved rather than caching an unpinned clone', async () => {
      await withFakeGit('exit 128', async () => {
        const resolver = createDockerRepoTemplate({ getRepositoryAccess: async () => ({ cloneUrl }) })!;
        await expect(resolver()).rejects.toThrow(/Could not resolve HEAD of https:\/\/example\.com/);
      });
    });

    it('resolves each list entry by its own ref, numbers secrets by position, and rejects a duplicate dir', async () => {
      const script = `case "$*" in *v1*) printf '${sha}\\tv1\\n';; *) printf '${headSha}\\tHEAD\\n';; esac`;
      await withFakeGit(script, async () => {
        const resolver = createDockerRepoTemplate({
          repos: [
            {
              getRepositoryAccess: async () => ({
                cloneUrl: 'https://example.com/acme/private.git',
                authorization: { token: 'tok-1' },
              }),
              ref: 'v1',
            },
            { getRepositoryAccess: async () => ({ cloneUrl }) },
          ],
          continueOnSetupFailure: true,
        })!;
        const template = await resolver();
        expect(template.dockerfile).toContain(`git -C '/workspace/private' checkout --detach '${sha}'`);
        expect(template.dockerfile).toContain(`git -C '/workspace/app' checkout --detach '${headSha}'`);
        expect(template.dockerfile).toContain('id=GH_TOKEN_0');
        expect(template.dockerfile.indexOf("clone 'https://example.com/acme/app.git'")).toBeLessThan(
          template.dockerfile.indexOf("clone 'https://example.com/acme/private.git'"),
        );
        expect(template.dockerfile).not.toContain('tok-1');

        const getRepositoryAccess = async () => ({ cloneUrl });
        await expect(
          createDockerRepoTemplate({ repos: [{ getRepositoryAccess }, { getRepositoryAccess }] })!(),
        ).rejects.toThrow(/both clone into/);
      });
    });

    it('rejects the whole list when one head cannot be resolved', async () => {
      await withFakeGit(`case "$*" in *private*) exit 128;; *) printf '${headSha}\\tHEAD\\n';; esac`, async () => {
        const resolver = createDockerRepoTemplate({
          repos: [
            { getRepositoryAccess: async () => ({ cloneUrl }) },
            { getRepositoryAccess: async () => ({ cloneUrl: 'https://example.com/acme/private.git' }) },
          ],
        })!;
        await expect(resolver()).rejects.toThrow(/Could not resolve HEAD of https:\/\/example\.com\/acme\/private/);
      });
    });

    it('pins the current head sha into the template so a moved branch rebuilds', async () => {
      const getRepositoryAccess = async () => ({ cloneUrl });
      const moved = 'f'.repeat(40);
      await withFakeGit(`printf '${headSha}\\tHEAD\\n'`, async () => {
        const before = await createDockerRepoTemplate({ getRepositoryAccess })!();
        expect(before.dockerfile).toContain(`checkout --detach '${headSha}'`);
        // A full sha ref skips ls-remote entirely and is pinned verbatim.
        const pinned = await createDockerRepoTemplate({ getRepositoryAccess, ref: sha })!();
        expect(pinned.dockerfile).toContain(`checkout --detach '${sha}'`);
        expect(pinned.templateId).not.toBe(before.templateId);
      });
      await withFakeGit(`printf '${moved}\\tHEAD\\n'`, async () => {
        const after = await createDockerRepoTemplate({ getRepositoryAccess })!();
        expect(after.dockerfile).toContain(`checkout --detach '${moved}'`);
      });
    });
  });
});
