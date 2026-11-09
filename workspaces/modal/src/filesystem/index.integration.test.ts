/**
 * ModalFilesystem integration tests against real Modal infrastructure.
 *
 * Required environment variables:
 *   MODAL_TOKEN_ID
 *   MODAL_TOKEN_SECRET
 */

import { FileNotFoundError } from '@mastra/core/workspace';
import { ModalClient } from 'modal';
import type { Volume } from 'modal';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ModalSandbox } from '../sandbox';
import { ModalFilesystem } from './index';

const hasCredentials = !!(process.env.MODAL_TOKEN_ID && process.env.MODAL_TOKEN_SECRET);

describe.skipIf(!hasCredentials)('ModalFilesystem integration', () => {
  const suffix = Date.now().toString(36);
  let client: ModalClient;
  let volume: Volume;
  let writer: ModalSandbox;
  let reader: ModalSandbox;
  let fs: ModalFilesystem;
  let readerFs: ModalFilesystem;

  beforeAll(async () => {
    client = new ModalClient();
    volume = await client.volumes.ephemeral();
    const options = { baseImage: 'ubuntu:22.04', timeoutMs: 300_000, volumes: { '/mnt/agent': volume } };
    writer = new ModalSandbox({ ...options, id: `mastra-fs-w-${suffix}` });
    reader = new ModalSandbox({ ...options, id: `mastra-fs-r-${suffix}` });
    fs = new ModalFilesystem({ sandbox: writer, basePath: '/mnt/agent' });
    readerFs = new ModalFilesystem({ sandbox: reader, basePath: '/mnt/agent', readOnly: true });
    await Promise.all([writer._start(), reader._start()]);
  }, 120_000);

  afterAll(async () => {
    await Promise.allSettled([writer?._destroy(), reader?._destroy()]);
    volume?.closeEphemeral();
  }, 60_000);

  it('round-trips files through the volume', async () => {
    await fs.writeFile('/notes/hello.md', '# hello');
    await fs.appendFile('/notes/hello.md', '\nworld');
    expect(await fs.readFile('/notes/hello.md', { encoding: 'utf-8' })).toBe('# hello\nworld');
    expect((await fs.readdir('/notes')).map(e => e.name)).toEqual(['hello.md']);
    expect((await fs.stat('/notes/hello.md')).size).toBe(13);
  }, 60_000);

  it('makes writes visible to another sandbox after reloadVolumes()', async () => {
    await fs.writeFile('/shared.txt', 'from writer');
    await writer.modal.exec(['sync']).then(p => p.wait());
    await writer.reloadVolumes();
    await reader.reloadVolumes();
    expect(await readerFs.readFile('/shared.txt', { encoding: 'utf-8' })).toBe('from writer');
  }, 120_000);

  it('maps missing files to FileNotFoundError', async () => {
    await expect(fs.readFile('/missing.txt')).rejects.toThrow(FileNotFoundError);
  }, 60_000);
});
