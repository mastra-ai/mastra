/**
 * DockerTemplate Integration Tests
 *
 * These tests require a running Docker daemon and build/run real images and
 * containers. They are separated from unit tests to avoid mock conflicts.
 *
 * Prerequisites:
 * - Docker daemon running locally
 */

import { afterAll, describe, expect, it } from 'vitest';
import { DockerSandbox } from '../sandbox';
import { DockerTemplate } from './template';

describe('DockerTemplate (integration)', () => {
  const templates: DockerTemplate[] = [];
  const sandboxes: DockerSandbox[] = [];

  afterAll(async () => {
    for (const sandbox of sandboxes) {
      try {
        await sandbox._destroy();
      } catch {
        // ignore cleanup errors
      }
    }
    for (const template of templates) {
      try {
        await template.dispose();
      } catch {
        // ignore cleanup errors
      }
    }
  });

  it('builds a prepared image and spawns sandboxes with independent filesystems', async () => {
    const template = new DockerTemplate({ baseImage: 'node:22-slim' })
      .setWorkdir('/workspace')
      .runCmd('echo "baseline" > /workspace/baseline.txt');
    templates.push(template);

    const build = await template.build();
    expect(build.status).toBe('ready');
    expect(build.templateId).toBe(template.templateId);

    // Second build reuses the content-addressed image without rebuilding.
    const rebuild = await template.build();
    expect(rebuild.status).toBe('ready');

    const a = await template.createSandbox({ id: `tmpl-a-${Date.now()}`, timeout: 60000 });
    const b = await template.createSandbox({ id: `tmpl-b-${Date.now()}`, timeout: 60000 });
    sandboxes.push(a, b);
    await a._start();
    await b._start();

    // Both sandboxes inherit the baked-in baseline file.
    const baselineA = await a.executeCommand!('cat', ['/workspace/baseline.txt']);
    expect(baselineA.exitCode).toBe(0);
    expect(baselineA.stdout).toContain('baseline');

    // Writes in one sandbox do not leak into the other (independent writable layers).
    await a.executeCommand!('sh', ['-c', 'echo "only-a" > /workspace/scratch.txt']);
    const scratchB = await b.executeCommand!('sh', ['-c', 'cat /workspace/scratch.txt 2>&1 || true']);
    expect(scratchB.stdout).not.toContain('only-a');
  }, 300000);

  it('surfaces build failures instead of throwing', async () => {
    const template = new DockerTemplate({ baseImage: 'node:22-slim' }).runCmd('exit 1');
    templates.push(template);
    const result = await template.build({ force: true });
    expect(result.status).toBe('failed');
    expect(result.error).toBeTruthy();
  }, 300000);
});
