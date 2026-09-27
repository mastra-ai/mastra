import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { askOrganizationAgent, createOrganizationAgent } from '../src/mastra/agents/organization-agent.js';
import { createOrganizationAnswerRoute } from '../src/mastra/api/organization.js';
import { assertIsolatedEvaluationState, operationalEvaluationExclusions } from '../src/mastra/evaluation/state.js';
import { createOrganizationMcpServer } from '../src/mastra/mcp/organization.js';
import { loadCatalog, sourceIdentity, validateEnvironment } from '../src/mastra/workspaces/catalog.js';
import { SourceIndex } from '../src/mastra/workspaces/source-index.js';
import { createSourceRuntime } from '../src/mastra/workspaces/sources.js';

const fixtureSchema = z.object({
  catalogPath: z.string().min(1),
  stateDirectory: z.string().min(1),
  stage: z.enum(['initial', 'changed']),
  question: z.string().min(1).max(4_000),
  driveMountedPath: z.string().startsWith('/drive/'),
  s3MountedPath: z.string().startsWith('/archive/'),
  expected: z.object({
    sources: z.array(z.string()).min(2),
    facts: z.array(z.string()).min(2),
    absentFacts: z.array(z.string()).default([]),
    mounted: z.object({
      driveContent: z.string().min(1),
      s3Content: z.string().min(1),
      s3Revision: z.string().min(1),
    }),
  }),
  maximumEmbeddings: z.number().int().min(1).max(20).default(20),
});
const credentialNames = [
  'OPENAI_API_KEY',
  'GOOGLE_DRIVE_CLIENT_EMAIL',
  'GOOGLE_DRIVE_PRIVATE_KEY',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
] as const;
function credentials() {
  return Object.fromEntries(
    credentialNames.map(name => {
      const value = process.env[name]?.trim();
      if (!value) throw new Error(`Missing required live-smoke credential: ${name}.`);
      return [name, value];
    }),
  ) as Record<(typeof credentialNames)[number], string>;
}
function fixturePath(path: string, value: string) {
  return resolve(dirname(path), value);
}
const fingerprint = (value: string) => createHash('sha256').update(value).digest('hex');

type StageMarker = {
  stage: 'initial' | 'changed';
  catalogPath: string;
  s3: { root: string; mountedPath: string; revision: string; fingerprint: string };
};

describe('explicit simultaneous Drive/R2 smoke', () => {
  it('runs exactly one selected operator fixture stage', async () => {
    const supplied = process.env.S3_R2_SMOKE_FIXTURE_PATH?.trim();
    if (!supplied) throw new Error('Missing required live-smoke setting: S3_R2_SMOKE_FIXTURE_PATH.');
    const path = resolve(supplied);
    const fixture = fixtureSchema.parse(JSON.parse(await readFile(path, 'utf8')));
    const catalogPath = fixturePath(path, fixture.catalogPath);
    const requestedStateDirectory = fixturePath(path, fixture.stateDirectory);
    const catalog = await loadCatalog(catalogPath);
    const enabled = catalog.sources.filter(source => source.enabled);
    expect(enabled.map(source => source.provider).sort()).toEqual(['google-drive', 's3']);
    expect([...fixture.expected.sources].sort()).toEqual(enabled.map(source => source.id).sort());
    const s3Source = enabled.find(source => source.provider === 's3');
    const driveSource = enabled.find(source => source.provider === 'google-drive');
    if (!s3Source || !driveSource)
      throw new Error('The smoke catalog must enable exactly one Drive source and one S3 source.');
    if (!fixture.driveMountedPath.startsWith(driveSource.mountPath + '/'))
      throw new Error('The Drive mounted path must be contained by the enabled Drive mount.');
    if (!fixture.s3MountedPath.startsWith(s3Source.mountPath + '/'))
      throw new Error('The S3 mounted path must be contained by the enabled S3 mount.');
    const operational = await operationalEvaluationExclusions(process.cwd());
    const stateDirectory = await assertIsolatedEvaluationState(requestedStateDirectory, [
      path,
      catalogPath,
      resolve(dirname(catalogPath), '.mastra'),
      ...catalog.sources.filter(source => source.provider === 'local').map(source => source.root),
      ...operational,
    ]);
    const markerPath = resolve(stateDirectory, 's3-r2-smoke-stage.json');
    if (fixture.stage === 'initial') {
      await expect(access(markerPath)).rejects.toMatchObject({ code: 'ENOENT' });
    }
    const environment = credentials();
    const issues = validateEnvironment(catalog, environment);
    if (issues.length) throw new Error(issues.join(' '));
    let previous: StageMarker | undefined;
    if (fixture.stage === 'changed') {
      previous = JSON.parse(await readFile(markerPath, 'utf8')) as StageMarker;
      if (previous.stage !== 'initial' || previous.catalogPath !== catalogPath)
        throw new Error('The changed stage requires a completed initial stage with the same fixture catalog.');
    }
    await mkdir(stateDirectory, { recursive: true });
    const sources = await createSourceRuntime({
      catalog,
      catalogPath,
      ledgerPath: resolve(stateDirectory, 'source-identities.json'),
      environment,
    });
    const filesystem = sources.workspace.filesystem;
    if (!filesystem) throw new Error('Shared Workspace filesystem is unavailable.');
    const [driveEntries, driveStat, driveContent, s3Entries, s3Stat, s3Content] = await Promise.all([
      filesystem.readdir(driveSource.mountPath),
      filesystem.stat(fixture.driveMountedPath),
      filesystem.readFile(fixture.driveMountedPath, { encoding: 'utf8' }),
      filesystem.readdir(s3Source.mountPath),
      filesystem.stat(fixture.s3MountedPath),
      filesystem.readFile(fixture.s3MountedPath, { encoding: 'utf8' }),
    ]);
    expect(driveEntries.map(entry => entry.name)).toContain(fixture.driveMountedPath.split('/').at(-1));
    expect(s3Entries.map(entry => entry.name)).toContain(fixture.s3MountedPath.split('/').at(-1));
    expect(driveStat.size).toBe(Buffer.byteLength(fixture.expected.mounted.driveContent));
    expect(s3Stat.size).toBe(Buffer.byteLength(fixture.expected.mounted.s3Content));
    expect(String(driveContent)).toBe(fixture.expected.mounted.driveContent);
    expect(String(s3Content)).toBe(fixture.expected.mounted.s3Content);
    const s3RelativePath = fixture.s3MountedPath.slice(s3Source.mountPath.length + 1);
    const observed = (await sources.s3Readers.get(s3Source.id)!.list()).objects.find(
      object => object.relativePath === s3RelativePath,
    );
    if (!observed?.validator?.etag || observed.validator.etag !== fixture.expected.mounted.s3Revision)
      throw new Error('The configured S3 object does not match the fixture revision.');
    const observedStage: StageMarker['s3'] = {
      root: sourceIdentity(s3Source),
      mountedPath: fixture.s3MountedPath,
      revision: observed.validator.etag,
      fingerprint: fingerprint(String(s3Content)),
    };
    if (
      previous &&
      (previous.s3.root !== observedStage.root ||
        previous.s3.mountedPath !== observedStage.mountedPath ||
        previous.s3.revision === observedStage.revision ||
        previous.s3.fingerprint === observedStage.fingerprint)
    )
      throw new Error(
        'The changed stage requires a changed S3 revision and object content at the initial source root.',
      );
    let embeddingCalls = 0;
    const embed = async (text: string) => {
      if (++embeddingCalls > fixture.maximumEmbeddings) throw new Error('Live-smoke embedding limit exceeded.');
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + environment.OPENAI_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
          encoding_format: 'float',
          dimensions: 1536,
        }),
        signal: AbortSignal.timeout(30_000),
        redirect: 'error',
      });
      if (!response.ok) throw new Error('Live-smoke embedding request failed.');
      const vector = ((await response.json()) as { data?: Array<{ embedding?: number[] }> }).data?.[0]?.embedding;
      if (!vector || vector.length !== 1536 || !vector.every(Number.isFinite))
        throw new Error('Live-smoke embedding response was invalid.');
      return vector;
    };
    const index = new SourceIndex({ databaseUrl: 'file:' + resolve(stateDirectory, 'smoke-index.db'), sources, embed });
    const usage: unknown[] = [];
    try {
      await index.initialize();
      const synced = await index.sync();
      expect(synced.status).toBe('success');
      expect(index.sourceStatus()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ sourceId: driveSource.id, ready: true, stale: false }),
          expect.objectContaining({ sourceId: s3Source.id, ready: true, stale: false }),
        ]),
      );
      const agent = createOrganizationAgent(index, 'openai/gpt-5.6-terra', {
        memory: false,
        maxRetries: 0,
        onGroundedUsage: item => usage.push(item ?? 'unavailable'),
      });
      let answerCalls = 0;
      const direct = await askOrganizationAgent(agent, fixture.question);
      answerCalls++;
      const mcp = await createOrganizationMcpServer(agent).executeTool('answerOrganizationQuestion', {
        question: fixture.question,
      });
      answerCalls++;
      const route = createOrganizationAnswerRoute(agent) as unknown as {
        handler: (context: {
          req: { json: () => Promise<unknown> };
          json: (body: unknown, status?: number) => Response;
        }) => Promise<Response>;
      };
      const api = await route.handler({
        req: { json: async () => ({ question: fixture.question }) },
        json: (body, status) => Response.json(body, { status }),
      });
      answerCalls++;
      for (const answer of [direct, mcp, await api.json()] as Array<typeof direct>) {
        expect(new Set(answer.citations.map(citation => citation.sourceId))).toEqual(new Set(fixture.expected.sources));
        for (const fact of fixture.expected.facts) expect(answer.answer).toContain(fact);
        for (const fact of fixture.expected.absentFacts) expect(answer.answer).not.toContain(fact);
      }
      expect(embeddingCalls).toBeLessThanOrEqual(fixture.maximumEmbeddings);
      await writeFile(
        markerPath,
        JSON.stringify({
          stage: fixture.stage,
          catalogPath,
          s3: observedStage,
          completedAt: new Date().toISOString(),
        }) + '\n',
      );
      await writeFile(
        resolve(stateDirectory, `s3-r2-smoke-${fixture.stage}-report.json`),
        JSON.stringify({
          stage: fixture.stage,
          embeddingCalls,
          answerCalls,
          usage,
          sourceStatus: index.sourceStatus(),
          citations: direct.citations.map(citation => ({
            sourceId: citation.sourceId,
            path: citation.path,
            locator: citation.locator,
            revision: citation.revision,
          })),
        }) + '\n',
      );
    } finally {
      await index.close();
    }
  });
});
