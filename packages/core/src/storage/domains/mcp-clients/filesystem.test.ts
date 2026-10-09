import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { FilesystemDB } from '../../filesystem-db';
import { FilesystemMCPClientsStorage } from './filesystem';

describe('FilesystemMCPClientsStorage', () => {
  let storageDir: string | undefined;

  afterEach(() => {
    if (storageDir) {
      rmSync(storageDir, { recursive: true, force: true });
      storageDir = undefined;
    }
  });

  it('keeps snapshot config fields off the entity record on update', async () => {
    storageDir = mkdtempSync(join(tmpdir(), 'mastra-mcp-clients-storage-'));
    const storage = new FilesystemMCPClientsStorage({ db: new FilesystemDB(storageDir) });
    await storage.init();
    await storage.create({
      mcpClient: { id: 'client-1', name: 'Client', servers: { docs: { url: 'https://example.com/mcp' } } },
    });

    await storage.update({
      id: 'client-1',
      metadata: { team: 'a' },
      name: 'Renamed',
      description: 'Changed',
      servers: { other: { url: 'https://other.example.com/mcp' } },
    });

    const entity = await storage.getById('client-1');
    expect(entity?.metadata).toEqual({ team: 'a' });
    expect(entity).not.toHaveProperty('name');
    expect(entity).not.toHaveProperty('description');
    expect(entity).not.toHaveProperty('servers');
  });
});
