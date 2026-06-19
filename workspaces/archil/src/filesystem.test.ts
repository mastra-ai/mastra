import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArchilFilesystem } from './filesystem';

const mockDisk = vi.hoisted(() => ({
  id: 'dsk-0123456789abcdef',
  name: 'test-disk',
  organization: 'test-org',
  status: 'available',
  provider: 'archil',
  region: 'aws-us-east-1',
  createdAt: '2026-01-01T00:00:00Z',
  exec: vi.fn(),
  grep: vi.fn(),
  share: vi.fn(),
  getObject: vi.fn(),
  putObject: vi.fn(),
  deleteObject: vi.fn(),
  headObject: vi.fn(),
  objectExists: vi.fn(),
  listObjects: vi.fn(),
}));

vi.mock('disk', () => {
  class MockArchil {
    disks = {
      get: vi.fn().mockResolvedValue(mockDisk),
      create: vi
        .fn()
        .mockResolvedValue({ disk: mockDisk, token: 'tok-123', tokenIdentifier: 'id-123', authorizedUsers: [] }),
      list: vi.fn().mockResolvedValue([mockDisk]),
    };
    tokens = {
      list: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    };
  }

  return {
    Archil: MockArchil,
    Disk: class {},
    getDisk: vi.fn().mockResolvedValue(mockDisk),
    createDisk: vi.fn().mockResolvedValue({ disk: mockDisk, token: 'tok-123' }),
    listDisks: vi.fn().mockResolvedValue([mockDisk]),
    configure: vi.fn(),
  };
});

describe('ArchilFilesystem', () => {
  let fs: ArchilFilesystem;

  beforeEach(async () => {
    vi.clearAllMocks();
    fs = new ArchilFilesystem({
      diskId: 'dsk-0123456789abcdef',
      apiKey: 'test-key',
      region: 'aws-us-east-1',
    });
    await fs._init();
  });

  describe('constructor', () => {
    it('sets correct defaults', () => {
      expect(fs.name).toBe('ArchilFilesystem');
      expect(fs.provider).toBe('archil');
      expect(fs.displayName).toBe('Archil');
    });

    it('accepts custom options', () => {
      const customFs = new ArchilFilesystem({
        id: 'custom-id',
        displayName: 'My Disk',
        description: 'Custom description',
        readOnly: true,
        diskId: 'dsk-test',
        apiKey: 'key',
        region: 'aws-us-east-1',
      });
      expect(customFs.id).toBe('custom-id');
      expect(customFs.displayName).toBe('My Disk');
      expect(customFs.description).toBe('Custom description');
      expect(customFs.readOnly).toBe(true);
    });
  });

  describe('lifecycle', () => {
    it('initializes with diskId', () => {
      expect(fs.status).toBe('ready');
      expect(fs.isReady()).toBe(true);
    });

    it('initializes with createDiskOptions', async () => {
      const createFs = new ArchilFilesystem({
        createDiskOptions: { name: 'new-disk' },
        apiKey: 'key',
        region: 'aws-us-east-1',
      });
      await createFs._init();
      expect(createFs.status).toBe('ready');
    });

    it('throws without diskId or createDiskOptions', async () => {
      const badFs = new ArchilFilesystem({
        apiKey: 'key',
        region: 'aws-us-east-1',
      });
      await expect(badFs._init()).rejects.toThrow('Either diskId or createDiskOptions must be provided');
      expect(badFs.status).toBe('error');
    });

    it('destroys cleanly', async () => {
      await fs._destroy();
      expect(fs.status).toBe('destroyed');
    });

    it('returns correct info', () => {
      const info = fs.getInfo();
      expect(info.provider).toBe('archil');
      expect(info.status).toBe('ready');
      expect(info.metadata?.diskId).toBe('dsk-0123456789abcdef');
    });
  });

  describe('readFile', () => {
    it('reads a file as buffer', async () => {
      mockDisk.getObject.mockResolvedValue(new Uint8Array([72, 101, 108, 108, 111]));
      const result = await fs.readFile('/hello.txt');
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString()).toBe('Hello');
      expect(mockDisk.getObject).toHaveBeenCalledWith('hello.txt');
    });

    it('reads a file with encoding', async () => {
      mockDisk.getObject.mockResolvedValue(new Uint8Array([72, 101, 108, 108, 111]));
      const result = await fs.readFile('/hello.txt', { encoding: 'utf-8' });
      expect(typeof result).toBe('string');
      expect(result).toBe('Hello');
    });

    it('throws FileNotFoundError on 404', async () => {
      mockDisk.getObject.mockRejectedValue({ status: 404, code: 'NoSuchKey' });
      await expect(fs.readFile('/missing.txt')).rejects.toThrow();
    });
  });

  describe('writeFile', () => {
    it('writes string content', async () => {
      mockDisk.putObject.mockResolvedValue({ etag: '"abc"' });
      mockDisk.objectExists.mockResolvedValue(false);
      await fs.writeFile('/test.txt', 'hello world');
      expect(mockDisk.putObject).toHaveBeenCalledWith('test.txt', 'hello world', 'text/plain');
    });

    it('writes buffer content', async () => {
      const buf = Buffer.from('binary data');
      mockDisk.putObject.mockResolvedValue({ etag: '"abc"' });
      await fs.writeFile('/data.bin', buf);
      expect(mockDisk.putObject).toHaveBeenCalled();
    });

    it('throws FileExistsError when overwrite is false', async () => {
      mockDisk.objectExists.mockResolvedValue(true);
      await expect(fs.writeFile('/existing.txt', 'data', { overwrite: false })).rejects.toThrow();
    });

    it('creates parent directories with recursive option', async () => {
      mockDisk.putObject.mockResolvedValue({ etag: '"abc"' });
      mockDisk.exec.mockResolvedValue({
        exitCode: 0,
        stdout: '',
        stderr: '',
        timing: { totalMs: 100, queueMs: 10, executeMs: 90 },
      });
      await fs.writeFile('/a/b/file.txt', 'content', { recursive: true });
      expect(mockDisk.exec).toHaveBeenCalledWith(expect.stringContaining('mkdir -p'));
    });

    it('throws on read-only filesystem', async () => {
      const roFs = new ArchilFilesystem({
        diskId: 'dsk-test',
        readOnly: true,
        apiKey: 'key',
        region: 'aws-us-east-1',
      });
      await roFs._init();
      await expect(roFs.writeFile('/test.txt', 'data')).rejects.toThrow('read-only');
    });
  });

  describe('deleteFile', () => {
    it('deletes an existing file', async () => {
      mockDisk.objectExists.mockResolvedValue(true);
      mockDisk.deleteObject.mockResolvedValue(undefined);
      await fs.deleteFile('/test.txt');
      expect(mockDisk.deleteObject).toHaveBeenCalledWith('test.txt');
    });

    it('throws FileNotFoundError when file missing', async () => {
      mockDisk.objectExists.mockResolvedValue(false);
      await expect(fs.deleteFile('/missing.txt')).rejects.toThrow();
    });

    it('does not throw with force option', async () => {
      mockDisk.objectExists.mockResolvedValue(false);
      mockDisk.deleteObject.mockResolvedValue(undefined);
      await expect(fs.deleteFile('/missing.txt', { force: true })).resolves.not.toThrow();
    });
  });

  describe('copyFile', () => {
    it('copies using exec', async () => {
      mockDisk.objectExists.mockResolvedValue(false);
      mockDisk.exec.mockResolvedValue({
        exitCode: 0,
        stdout: '',
        stderr: '',
        timing: { totalMs: 100, queueMs: 10, executeMs: 90 },
      });
      await fs.copyFile('/src.txt', '/dest.txt');
      expect(mockDisk.exec).toHaveBeenCalledWith(expect.stringContaining('cp'));
    });
  });

  describe('moveFile', () => {
    it('moves using exec', async () => {
      mockDisk.objectExists.mockResolvedValue(false);
      mockDisk.exec.mockResolvedValue({
        exitCode: 0,
        stdout: '',
        stderr: '',
        timing: { totalMs: 100, queueMs: 10, executeMs: 90 },
      });
      await fs.moveFile('/old.txt', '/new.txt');
      expect(mockDisk.exec).toHaveBeenCalledWith(expect.stringContaining('mv'));
    });
  });

  describe('mkdir', () => {
    it('creates directory using exec', async () => {
      mockDisk.exec.mockResolvedValue({
        exitCode: 0,
        stdout: '',
        stderr: '',
        timing: { totalMs: 100, queueMs: 10, executeMs: 90 },
      });
      await fs.mkdir('/newdir');
      expect(mockDisk.exec).toHaveBeenCalledWith(expect.stringContaining('mkdir'));
    });

    it('creates nested dirs with recursive', async () => {
      mockDisk.exec.mockResolvedValue({
        exitCode: 0,
        stdout: '',
        stderr: '',
        timing: { totalMs: 100, queueMs: 10, executeMs: 90 },
      });
      await fs.mkdir('/a/b/c', { recursive: true });
      expect(mockDisk.exec).toHaveBeenCalledWith(expect.stringContaining('mkdir -p'));
    });
  });

  describe('readdir', () => {
    it('lists directory contents', async () => {
      mockDisk.listObjects.mockResolvedValue({
        objects: [
          { key: 'docs/readme.md', size: 100 },
          { key: 'docs/guide.md', size: 200 },
        ],
        commonPrefixes: ['docs/images/'],
        isTruncated: false,
        keyCount: 2,
      });
      const entries = await fs.readdir('/docs');
      expect(entries).toHaveLength(3);
      expect(entries.find(e => e.name === 'readme.md')).toEqual({ name: 'readme.md', type: 'file', size: 100 });
      expect(entries.find(e => e.name === 'images')).toEqual({ name: 'images', type: 'directory' });
    });

    it('filters by extension', async () => {
      mockDisk.listObjects.mockResolvedValue({
        objects: [
          { key: 'src/app.ts', size: 100 },
          { key: 'src/data.json', size: 50 },
        ],
        commonPrefixes: [],
        isTruncated: false,
        keyCount: 2,
      });
      const entries = await fs.readdir('/src', { extension: '.ts' });
      expect(entries).toHaveLength(1);
      expect(entries[0]!.name).toBe('app.ts');
    });
  });

  describe('exists', () => {
    it('returns true for existing file', async () => {
      mockDisk.objectExists.mockResolvedValue(true);
      expect(await fs.exists('/file.txt')).toBe(true);
    });

    it('returns true for existing directory', async () => {
      mockDisk.objectExists.mockResolvedValue(false);
      mockDisk.listObjects.mockResolvedValue({
        objects: [{ key: 'dir/child.txt', size: 10 }],
        commonPrefixes: [],
        isTruncated: false,
        keyCount: 1,
      });
      expect(await fs.exists('/dir')).toBe(true);
    });

    it('returns false for non-existent path', async () => {
      mockDisk.objectExists.mockResolvedValue(false);
      mockDisk.listObjects.mockResolvedValue({
        objects: [],
        commonPrefixes: [],
        isTruncated: false,
        keyCount: 0,
      });
      expect(await fs.exists('/nope')).toBe(false);
    });

    it('returns true for root', async () => {
      expect(await fs.exists('/')).toBe(true);
    });
  });

  describe('stat', () => {
    it('returns file stat', async () => {
      mockDisk.headObject.mockResolvedValue({
        size: 1234,
        contentType: 'text/plain',
        lastModified: new Date('2026-01-15T10:00:00Z'),
      });
      const stat = await fs.stat('/hello.txt');
      expect(stat.type).toBe('file');
      expect(stat.name).toBe('hello.txt');
      expect(stat.size).toBe(1234);
      expect(stat.mimeType).toBe('text/plain');
    });

    it('returns directory stat', async () => {
      mockDisk.headObject.mockResolvedValue(null);
      mockDisk.listObjects.mockResolvedValue({
        objects: [{ key: 'mydir/file.txt', size: 10 }],
        commonPrefixes: [],
        isTruncated: false,
        keyCount: 1,
      });
      const stat = await fs.stat('/mydir');
      expect(stat.type).toBe('directory');
      expect(stat.name).toBe('mydir');
    });

    it('throws FileNotFoundError for missing path', async () => {
      mockDisk.headObject.mockResolvedValue(null);
      mockDisk.listObjects.mockResolvedValue({
        objects: [],
        commonPrefixes: [],
        isTruncated: false,
        keyCount: 0,
      });
      await expect(fs.stat('/missing')).rejects.toThrow();
    });
  });

  describe('exec', () => {
    it('passes through to disk.exec', async () => {
      const result = {
        exitCode: 0,
        stdout: 'hello\n',
        stderr: '',
        timing: { totalMs: 500, queueMs: 100, executeMs: 400 },
      };
      mockDisk.exec.mockResolvedValue(result);
      const res = await fs.exec('echo hello');
      expect(res).toEqual(result);
      expect(mockDisk.exec).toHaveBeenCalledWith('echo hello');
    });
  });

  describe('grep', () => {
    it('passes through to disk.grep', async () => {
      const result = {
        matches: [{ file: 'log.txt', line: 1, text: 'ERROR: something' }],
        stoppedReason: 'completed' as const,
        filesScanned: 10,
        containersDispatched: 2,
        computeSecondsUsed: 0.5,
        durationMs: 1000,
        listingMs: 200,
        grepMs: 800,
      };
      mockDisk.grep.mockResolvedValue(result);
      const res = await fs.grep({ directory: '/', pattern: 'ERROR', recursive: true });
      expect(res).toEqual(result);
    });
  });

  describe('getInstructions', () => {
    it('returns instructions string', () => {
      const instructions = fs.getInstructions();
      expect(instructions).toContain('Archil');
      expect(instructions).toContain('Persistent');
    });
  });
});
