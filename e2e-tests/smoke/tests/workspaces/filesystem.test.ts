import { describe, it, expect, afterAll } from 'vitest';
import { fetchJson, fetchApi } from '../utils.js';

const WS = 'test-workspace';
const FIXTURE_CONTENT = 'Hello from workspace!';
const FIXTURE_SIZE = Buffer.byteLength(FIXTURE_CONTENT);

// Paths created by write/mkdir tests, cleaned up after all tests run
const createdPaths: string[] = [];

async function cleanupPath(path: string, recursive = false) {
  await fetchApi(`/api/workspaces/${WS}/fs/delete?path=${path}${recursive ? '&recursive=true' : ''}`, {
    method: 'DELETE',
  }).catch(() => {});
}

afterAll(async () => {
  for (const p of createdPaths.reverse()) {
    await cleanupPath(p, true);
  }
});

describe('workspace filesystem', () => {
  describe('GET /fs/list', () => {
    it('should list root directory entries', async () => {
      const { status, data } = await fetchJson<any>(`/api/workspaces/${WS}/fs/list?path=.`);

      expect(status).toBe(200);
      expect(data.path).toBe('.');
      expect(data.entries).toBeInstanceOf(Array);

      // Should contain the hello.txt fixture and skills directory
      const names = data.entries.map((e: any) => e.name);
      expect(names).toContain('hello.txt');
      expect(names).toContain('skills');

      // Verify entry shapes
      const file = data.entries.find((e: any) => e.name === 'hello.txt');
      expect(file.type).toBe('file');
      expect(file.size).toBe(FIXTURE_SIZE);

      const dir = data.entries.find((e: any) => e.name === 'skills');
      expect(dir.type).toBe('directory');
    });

    it('should list subdirectory entries', async () => {
      const { status, data } = await fetchJson<any>(`/api/workspaces/${WS}/fs/list?path=skills`);

      expect(status).toBe(200);
      expect(data.path).toBe('skills');

      const names = data.entries.map((e: any) => e.name);
      expect(names).toContain('test-skill');
    });

    it('should return 404 for non-existent directory', async () => {
      const res = await fetchApi(`/api/workspaces/${WS}/fs/list?path=nonexistent`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /fs/read', () => {
    it('should read file content', async () => {
      const { status, data } = await fetchJson<any>(`/api/workspaces/${WS}/fs/read?path=hello.txt`);

      expect(status).toBe(200);
      expect(data.path).toBe('hello.txt');
      expect(data.content).toBe(FIXTURE_CONTENT);
      expect(data.type).toBe('file');
    });

    it('should return 404 for non-existent file', async () => {
      const res = await fetchApi(`/api/workspaces/${WS}/fs/read?path=missing.txt`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /fs/stat', () => {
    it('should return file metadata', async () => {
      const { status, data } = await fetchJson<any>(`/api/workspaces/${WS}/fs/stat?path=hello.txt`);

      expect(status).toBe(200);
      expect(data.type).toBe('file');
      expect(data.size).toBe(FIXTURE_SIZE);
    });

    it('should return directory metadata', async () => {
      const { status, data } = await fetchJson<any>(`/api/workspaces/${WS}/fs/stat?path=skills`);

      expect(status).toBe(200);
      expect(data.type).toBe('directory');
    });

    it('should return 404 for non-existent path', async () => {
      const res = await fetchApi(`/api/workspaces/${WS}/fs/stat?path=nope`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /fs/write', () => {
    it('should write a new file and read it back', async () => {
      createdPaths.push('test-write.txt');

      const writeRes = await fetchJson<any>(`/api/workspaces/${WS}/fs/write`, {
        method: 'POST',
        body: JSON.stringify({ path: 'test-write.txt', content: 'Written by smoke test' }),
      });

      expect(writeRes.status).toBe(200);
      expect(writeRes.data).toMatchObject({ success: true, path: 'test-write.txt' });

      // Verify the file content
      const { data: readData } = await fetchJson<any>(`/api/workspaces/${WS}/fs/read?path=test-write.txt`);
      expect(readData.content).toBe('Written by smoke test');
    });

    it('should write with recursive directory creation', async () => {
      createdPaths.push('deep');

      const writeRes = await fetchJson<any>(`/api/workspaces/${WS}/fs/write`, {
        method: 'POST',
        body: JSON.stringify({
          path: 'deep/nested/file.txt',
          content: 'Nested content',
          recursive: true,
        }),
      });

      expect(writeRes.status).toBe(200);
      expect(writeRes.data).toMatchObject({ success: true, path: 'deep/nested/file.txt' });

      const { data: readData } = await fetchJson<any>(`/api/workspaces/${WS}/fs/read?path=deep/nested/file.txt`);
      expect(readData.content).toBe('Nested content');
    });
  });

  describe('POST /fs/mkdir', () => {
    it('should create a directory', async () => {
      createdPaths.push('new-dir');

      const { status, data } = await fetchJson<any>(`/api/workspaces/${WS}/fs/mkdir`, {
        method: 'POST',
        body: JSON.stringify({ path: 'new-dir' }),
      });

      expect(status).toBe(200);
      expect(data).toMatchObject({ success: true, path: 'new-dir' });

      // Verify it exists via stat
      const { data: statData } = await fetchJson<any>(`/api/workspaces/${WS}/fs/stat?path=new-dir`);
      expect(statData.type).toBe('directory');
    });

    it('should create nested directories with recursive', async () => {
      createdPaths.push('a');

      const { status, data } = await fetchJson<any>(`/api/workspaces/${WS}/fs/mkdir`, {
        method: 'POST',
        body: JSON.stringify({ path: 'a/b/c', recursive: true }),
      });

      expect(status).toBe(200);
      expect(data).toMatchObject({ success: true, path: 'a/b/c' });

      const { data: statData } = await fetchJson<any>(`/api/workspaces/${WS}/fs/stat?path=a/b/c`);
      expect(statData.type).toBe('directory');
    });
  });

  describe('DELETE /fs/delete', () => {
    it('should delete a file', async () => {
      // Create a file to delete
      await fetchApi(`/api/workspaces/${WS}/fs/write`, {
        method: 'POST',
        body: JSON.stringify({ path: 'to-delete.txt', content: 'delete me' }),
      });

      const { status, data } = await fetchJson<any>(`/api/workspaces/${WS}/fs/delete?path=to-delete.txt`, {
        method: 'DELETE',
      });

      expect(status).toBe(200);
      expect(data).toMatchObject({ success: true, path: 'to-delete.txt' });

      // Verify it's gone
      const statRes = await fetchApi(`/api/workspaces/${WS}/fs/stat?path=to-delete.txt`);
      expect(statRes.status).toBe(404);
    });

    it('should delete a directory recursively', async () => {
      // Create a dir with content
      await fetchApi(`/api/workspaces/${WS}/fs/write`, {
        method: 'POST',
        body: JSON.stringify({ path: 'dir-to-delete/file.txt', content: 'x', recursive: true }),
      });

      const { status, data } = await fetchJson<any>(
        `/api/workspaces/${WS}/fs/delete?path=dir-to-delete&recursive=true`,
        { method: 'DELETE' },
      );

      expect(status).toBe(200);
      expect(data).toMatchObject({ success: true, path: 'dir-to-delete' });

      const statRes = await fetchApi(`/api/workspaces/${WS}/fs/stat?path=dir-to-delete`);
      expect(statRes.status).toBe(404);
    });

    it('should return 404 for non-existent path', async () => {
      const res = await fetchApi(`/api/workspaces/${WS}/fs/delete?path=does-not-exist`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(404);
    });
  });
});
