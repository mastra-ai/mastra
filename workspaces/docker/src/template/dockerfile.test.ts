import { describe, expect, it } from 'vitest';
import { type DockerTemplateDefinition, synthesizeDockerfile, templateIdentity, templateImageTag } from './dockerfile';

function def(overrides: Partial<DockerTemplateDefinition> = {}): DockerTemplateDefinition {
  return {
    baseImage: 'node:22-slim',
    operations: [],
    buildArgNames: [],
    ...overrides,
  };
}

describe('synthesizeDockerfile', () => {
  it('emits FROM for the base image', () => {
    expect(synthesizeDockerfile(def())).toBe('FROM node:22-slim AS mastra-main-0\n');
  });

  it('renders runWithSecrets as a throwaway stage plus COPY --from', () => {
    const dockerfile = synthesizeDockerfile(
      def({
        operations: [
          { method: 'runCmd', args: ['echo before'] },
          { method: 'runWithSecrets', args: ['fetch', { secrets: ['B', 'A'], output: '/out' }] },
        ],
      }),
    );
    expect(dockerfile).toBe(
      [
        'FROM node:22-slim AS mastra-main-0',
        'RUN echo before',
        'FROM mastra-main-0 AS mastra-secret-1',
        'ARG A',
        'ARG B',
        'RUN fetch',
        'FROM mastra-main-0 AS mastra-main-1',
        'COPY --from=mastra-secret-1 /out /out',
        '',
      ].join('\n'),
    );
  });

  it('secret stages inherit prior state and later operations continue from the copied output', () => {
    const dockerfile = synthesizeDockerfile(
      def({
        operations: [
          { method: 'aptInstall', args: ['git'] },
          { method: 'setWorkdir', args: ['/w'] },
          { method: 'runWithSecrets', args: ['git clone x /w/a', { secrets: ['T'], output: '/w/a' }] },
          { method: 'runWithSecrets', args: ['cat /w/a/x > /w/b', { secrets: ['T'], output: '/w/b' }] },
          { method: 'runCmd', args: ['ls /w/a /w/b'] },
        ],
      }),
    );
    expect(dockerfile).toBe(
      [
        'FROM node:22-slim AS mastra-main-0',
        'RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*',
        'WORKDIR /w',
        // First secret step forks the main stage after git + WORKDIR.
        'FROM mastra-main-0 AS mastra-secret-2',
        'ARG T',
        'RUN git clone x /w/a',
        'FROM mastra-main-0 AS mastra-main-1',
        'COPY --from=mastra-secret-2 /w/a /w/a',
        // Second secret step forks after the first output was copied in.
        'FROM mastra-main-1 AS mastra-secret-3',
        'ARG T',
        'RUN cat /w/a/x > /w/b',
        'FROM mastra-main-1 AS mastra-main-2',
        'COPY --from=mastra-secret-3 /w/b /w/b',
        'RUN ls /w/a /w/b',
        '',
      ].join('\n'),
    );
  });

  it('renders operations in order', () => {
    const dockerfile = synthesizeDockerfile(
      def({
        operations: [
          { method: 'setWorkdir', args: ['/app'] },
          { method: 'runCmd', args: ['echo hi'] },
        ],
      }),
    );
    expect(dockerfile).toBe('FROM node:22-slim AS mastra-main-0\nWORKDIR /app\nRUN echo hi\n');
  });

  it('joins array runCmd with &&', () => {
    const dockerfile = synthesizeDockerfile(def({ operations: [{ method: 'runCmd', args: [['a', 'b']] }] }));
    expect(dockerfile).toContain('RUN a && b');
  });

  it('renders env vars deterministically sorted', () => {
    const dockerfile = synthesizeDockerfile(def({ operations: [{ method: 'setEnvs', args: [{ B: '2', A: '1' }] }] }));
    expect(dockerfile).toContain('ENV A="1" B="2"');
  });

  it('renders apt install with cleanup and flags', () => {
    const dockerfile = synthesizeDockerfile(
      def({ operations: [{ method: 'aptInstall', args: [['git', 'curl'], { noInstallRecommends: true }] }] }),
    );
    expect(dockerfile).toContain('RUN apt-get update && apt-get install -y --no-install-recommends git curl');
    expect(dockerfile).toContain('rm -rf /var/lib/apt/lists/*');
  });

  it('renders npm install variants', () => {
    expect(synthesizeDockerfile(def({ operations: [{ method: 'npmInstall', args: [] }] }))).toContain(
      'RUN npm install\n',
    );
    expect(
      synthesizeDockerfile(def({ operations: [{ method: 'npmInstall', args: [undefined, { dev: true }] }] })),
    ).toContain('RUN npm install --include=dev');
    expect(
      synthesizeDockerfile(def({ operations: [{ method: 'npmInstall', args: ['typescript', { g: true }] }] })),
    ).toContain('RUN npm install -g typescript');
  });
});

describe('templateIdentity', () => {
  it('is stable for identical definitions', () => {
    expect(templateIdentity(def())).toBe(templateIdentity(def()));
  });

  it('changes when operations change', () => {
    const a = templateIdentity(def());
    const b = templateIdentity(def({ operations: [{ method: 'runCmd', args: ['echo hi'] }] }));
    expect(a).not.toBe(b);
  });

  it('canonicalizes env insertion order and secret name order', () => {
    const a = templateIdentity(def({ operations: [{ method: 'setEnvs', args: [{ A: '1', B: '2' }] }] }));
    const b = templateIdentity(def({ operations: [{ method: 'setEnvs', args: [{ B: '2', A: '1' }] }] }));
    expect(a).toBe(b);
    const c = templateIdentity(
      def({ operations: [{ method: 'runWithSecrets', args: ['x', { secrets: ['A', 'B'], output: '/o' }] }] }),
    );
    const d = templateIdentity(
      def({ operations: [{ method: 'runWithSecrets', args: ['x', { secrets: ['B', 'A'], output: '/o' }] }] }),
    );
    expect(c).toBe(d);
  });

  it('produces a mastra-template tag', () => {
    expect(templateImageTag(def())).toMatch(/^mastra-template:[0-9a-f]{24}$/);
  });
});
