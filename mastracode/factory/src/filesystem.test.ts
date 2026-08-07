import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  CopyOptions,
  FileContent,
  FileEntry,
  FileStat,
  ListOptions,
  ReadOptions,
  RemoveOptions,
  WorkspaceFilesystem,
  WriteOptions,
} from '@mastra/core/workspace';
import { DirectoryNotFoundError, FileNotFoundError, LocalFilesystem } from '@mastra/core/workspace';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FACTORY_FS_MOUNT, FactoryFilesystem, repoDirName, sanitizePathSegment } from './filesystem.js';

const ORG_ID = 'org-1111';
const PROJECT_NAME = 'My Project';
const REPO_SLUG = 'mastra-ai/mastra';
const REPO_DIR = 'mastra-ai__mastra';

/**
 * Minimal stand-in for the session's SandboxFilesystem: stores files by the
 * exact path it was given (the overlay must delegate paths untouched).
 */
class FakeSandboxFilesystem implements WorkspaceFilesystem {
  readonly id = 'fake-sandbox-fs';
  readonly name = 'FakeSandboxFilesystem';
  readonly provider = 'fake-sandbox';
  readonly basePath = '/workspace/owner/repo';
  status = 'ready' as const;
  files = new Map<string, string>();

  async readFile(path: string, _options?: ReadOptions): Promise<string | Buffer> {
    const content = this.files.get(path);
    if (content === undefined) throw new FileNotFoundError(path);
    return content;
  }
  async writeFile(path: string, content: FileContent, _options?: WriteOptions): Promise<void> {
    this.files.set(path, content.toString());
  }
  async appendFile(path: string, content: FileContent): Promise<void> {
    this.files.set(path, (this.files.get(path) ?? '') + content.toString());
  }
  async deleteFile(path: string, options?: RemoveOptions): Promise<void> {
    if (!this.files.delete(path) && !options?.force) throw new FileNotFoundError(path);
  }
  async copyFile(src: string, dest: string, _options?: CopyOptions): Promise<void> {
    this.files.set(dest, String(await this.readFile(src)));
  }
  async moveFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    await this.copyFile(src, dest, options);
    this.files.delete(src);
  }
  async mkdir(_path: string, _options?: { recursive?: boolean }): Promise<void> {}
  async rmdir(_path: string, _options?: RemoveOptions): Promise<void> {}
  async readdir(_path: string, _options?: ListOptions): Promise<FileEntry[]> {
    return [...this.files.keys()].map(name => ({ name, type: 'file' as const }));
  }
  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }
  async stat(path: string): Promise<FileStat> {
    const content = this.files.get(path);
    if (content === undefined) throw new FileNotFoundError(path);
    return {
      name: path.split('/').at(-1) ?? path,
      path,
      type: 'file',
      size: content.length,
      createdAt: new Date(0),
      modifiedAt: new Date(0),
    };
  }
  getInstructions(): string {
    return `Files are stored in a remote sandbox at ${this.basePath}.`;
  }
}

describe('FactoryFilesystem', () => {
  let durableRoot: string;
  let inner: FakeSandboxFilesystem;
  let durable: LocalFilesystem;
  let fs: FactoryFilesystem;

  beforeEach(() => {
    durableRoot = mkdtempSync(join(tmpdir(), 'factory-fs-durable-'));
    inner = new FakeSandboxFilesystem();
    durable = new LocalFilesystem({ basePath: durableRoot });
    fs = new FactoryFilesystem({
      inner,
      durable,
      orgId: ORG_ID,
      projectName: PROJECT_NAME,
      repoSlug: REPO_SLUG,
    });
  });

  afterEach(() => {
    rmSync(durableRoot, { recursive: true, force: true });
  });

  describe('routing', () => {
    it('routes mount paths to the durable backend under the org prefix', async () => {
      await fs.writeFile(`${FACTORY_FS_MOUNT}/shared/note.md`, 'org note');
      expect(await durable.readFile(`orgs/${ORG_ID}/shared/note.md`, { encoding: 'utf8' })).toBe('org note');
      expect(await fs.readFile(`${FACTORY_FS_MOUNT}/shared/note.md`, { encoding: 'utf8' })).toBe('org note');
      // Nothing leaked into the sandbox filesystem.
      expect(inner.files.size).toBe(0);
    });

    it('routes own project and repo mount paths', async () => {
      const planPath = `${FACTORY_FS_MOUNT}/projects/${PROJECT_NAME}/repos/${REPO_DIR}/plans/foo.md`;
      await fs.writeFile(planPath, 'the plan');
      expect(
        await durable.readFile(`orgs/${ORG_ID}/projects/${PROJECT_NAME}/repos/${REPO_DIR}/plans/foo.md`, {
          encoding: 'utf8',
        }),
      ).toBe('the plan');
      expect(await fs.readFile(planPath, { encoding: 'utf8' })).toBe('the plan');
    });

    it('delegates non-mount paths to the inner filesystem verbatim', async () => {
      await fs.writeFile('/src/index.ts', 'export {}');
      expect(inner.files.get('/src/index.ts')).toBe('export {}');
      expect(await durable.readdir('.')).toEqual([]);
      expect(await fs.readFile('/src/index.ts')).toBe('export {}');
    });

    it('sends relative paths to the inner filesystem, even mount-looking ones', async () => {
      await fs.writeFile('factory/nested.md', 'inner file');
      expect(inner.files.get('factory/nested.md')).toBe('inner file');
      expect(await durable.readdir('.')).toEqual([]);
    });
  });

  describe('traversal guards', () => {
    it('normalizes .. out of the mount prefix into the inner filesystem', async () => {
      // /factory/../escape.md normalizes to /escape.md — routed to the
      // inner filesystem (which applies its own workdir containment), never
      // the durable backend. Paths are delegated verbatim.
      await fs.writeFile(`${FACTORY_FS_MOUNT}/../escape.md`, 'escaped');
      expect(inner.files.get(`${FACTORY_FS_MOUNT}/../escape.md`)).toBe('escaped');
      expect(await durable.readdir('.')).toEqual([]);
    });

    it('cannot climb out of the org prefix with .. inside the mount subtree', async () => {
      await durable.writeFile('orgs/other-org/secret.md', 'secret');
      // /factory/shared/../../x normalizes to /x — inner, never the backend.
      await expect(fs.readFile(`${FACTORY_FS_MOUNT}/shared/../../x`)).rejects.toThrow(FileNotFoundError);
      // Every durable write stays under the session org.
      await fs.writeFile(`${FACTORY_FS_MOUNT}/shared/a.md`, 'a');
      const entries = await durable.readdir('orgs');
      expect(entries.map(e => e.name).sort()).toEqual([ORG_ID, 'other-org']);
    });

    it('cannot reach a sibling project via .. through its own project dir', async () => {
      await durable.writeFile(`orgs/${ORG_ID}/projects/other-project/notes.md`, 'other');
      await expect(
        fs.readFile(`${FACTORY_FS_MOUNT}/projects/${PROJECT_NAME}/../other-project/notes.md`),
      ).rejects.toThrow(FileNotFoundError);
      await expect(
        fs.writeFile(`${FACTORY_FS_MOUNT}/projects/${PROJECT_NAME}/../other-project/inject.md`, 'x'),
      ).rejects.toThrow(FileNotFoundError);
    });

    it('rejects backslash-bearing mount paths outright', async () => {
      // posix.normalize does not treat `\` as a separator, but a Windows-hosted
      // local backend would — never let one through to the backend.
      await expect(fs.readFile(`${FACTORY_FS_MOUNT}/shared/..\\..\\..\\etc/passwd`)).rejects.toThrow(FileNotFoundError);
      await expect(fs.writeFile(`${FACTORY_FS_MOUNT}/shared\\x.md`, 'x')).rejects.toThrow(FileNotFoundError);
    });

    it('denies copying repo files into a hidden sibling project', async () => {
      inner.files.set('/src/secret.ts', 'code');
      await expect(
        fs.copyFile('/src/secret.ts', `${FACTORY_FS_MOUNT}/projects/other-project/exfil.ts`),
      ).rejects.toThrow(FileNotFoundError);
      await expect(
        fs.moveFile('/src/secret.ts', `${FACTORY_FS_MOUNT}/projects/other-project/exfil.ts`),
      ).rejects.toThrow(FileNotFoundError);
      expect(await durable.exists(`orgs/${ORG_ID}/projects/other-project/exfil.ts`)).toBe(false);
      // The move must not have deleted the source after the failed copy.
      expect(inner.files.get('/src/secret.ts')).toBe('code');
    });

    it('refuses to overwrite reserved layout directories as files', async () => {
      await expect(fs.writeFile(`${FACTORY_FS_MOUNT}/shared`, 'x')).rejects.toThrow(/[Rr]eserved/);
      await expect(fs.appendFile(`${FACTORY_FS_MOUNT}/projects/${PROJECT_NAME}`, 'x')).rejects.toThrow(/[Rr]eserved/);
      await expect(fs.deleteFile(`${FACTORY_FS_MOUNT}/shared`)).rejects.toThrow(/[Rr]eserved/);
      // Writes beneath them still work afterwards.
      await fs.writeFile(`${FACTORY_FS_MOUNT}/shared/ok.md`, 'ok');
      expect(await fs.readFile(`${FACTORY_FS_MOUNT}/shared/ok.md`, { encoding: 'utf8' })).toBe('ok');
    });
  });

  describe('project isolation', () => {
    beforeEach(async () => {
      await durable.writeFile(`orgs/${ORG_ID}/projects/other-project/notes.md`, 'other project doc');
    });

    it('denies reads of sibling project files as not-found', async () => {
      await expect(fs.readFile(`${FACTORY_FS_MOUNT}/projects/other-project/notes.md`)).rejects.toThrow(
        FileNotFoundError,
      );
      await expect(fs.stat(`${FACTORY_FS_MOUNT}/projects/other-project/notes.md`)).rejects.toThrow(FileNotFoundError);
      expect(await fs.exists(`${FACTORY_FS_MOUNT}/projects/other-project/notes.md`)).toBe(false);
      expect(await fs.exists(`${FACTORY_FS_MOUNT}/projects/other-project`)).toBe(false);
    });

    it('denies writes into sibling project dirs as not-found', async () => {
      await expect(fs.writeFile(`${FACTORY_FS_MOUNT}/projects/other-project/inject.md`, 'x')).rejects.toThrow(
        FileNotFoundError,
      );
      await expect(fs.deleteFile(`${FACTORY_FS_MOUNT}/projects/other-project/notes.md`)).rejects.toThrow(
        FileNotFoundError,
      );
      expect(await durable.readFile(`orgs/${ORG_ID}/projects/other-project/notes.md`, { encoding: 'utf8' })).toBe(
        'other project doc',
      );
    });

    it('hides sibling projects from /projects listings', async () => {
      const entries = await fs.readdir(`${FACTORY_FS_MOUNT}/projects`);
      expect(entries).toEqual([{ name: PROJECT_NAME, type: 'directory' }]);
    });

    it('denies unknown top-level mount paths as not-found', async () => {
      await expect(fs.writeFile(`${FACTORY_FS_MOUNT}/oops.md`, 'x')).rejects.toThrow(FileNotFoundError);
      await expect(fs.readFile(`${FACTORY_FS_MOUNT}/oops.md`)).rejects.toThrow(FileNotFoundError);
    });
  });

  describe('virtual directories', () => {
    it('lists the layout at the mount root', async () => {
      expect(await fs.readdir(FACTORY_FS_MOUNT)).toEqual([
        { name: 'shared', type: 'directory' },
        { name: 'projects', type: 'directory' },
      ]);
    });

    it('lists layout directories as empty before any writes', async () => {
      expect(await fs.readdir(`${FACTORY_FS_MOUNT}/shared`)).toEqual([]);
      expect(await fs.readdir(`${FACTORY_FS_MOUNT}/projects/${PROJECT_NAME}`)).toEqual([]);
      expect(await fs.readdir(`${FACTORY_FS_MOUNT}/projects/${PROJECT_NAME}/repos/${REPO_DIR}`)).toEqual([]);
    });

    it('still throws for unknown deep directories', async () => {
      await expect(fs.readdir(`${FACTORY_FS_MOUNT}/shared/nope`)).rejects.toThrow(DirectoryNotFoundError);
    });

    it('reports layout directories as existing directories', async () => {
      expect(await fs.exists(FACTORY_FS_MOUNT)).toBe(true);
      expect(await fs.exists(`${FACTORY_FS_MOUNT}/shared`)).toBe(true);
      const stat = await fs.stat(`${FACTORY_FS_MOUNT}/projects/${PROJECT_NAME}`);
      expect(stat.type).toBe('directory');
      expect(stat.path).toBe(`${FACTORY_FS_MOUNT}/projects/${PROJECT_NAME}`);
    });

    it('refuses to remove layout directories', async () => {
      await expect(fs.rmdir(`${FACTORY_FS_MOUNT}/shared`, { recursive: true })).rejects.toThrow(/reserved/);
    });
  });

  describe('stat', () => {
    it('re-roots reported paths into the agent-visible namespace', async () => {
      await fs.writeFile(`${FACTORY_FS_MOUNT}/shared/doc.md`, 'hi');
      const stat = await fs.stat(`${FACTORY_FS_MOUNT}/shared/doc.md`);
      expect(stat.path).toBe(`${FACTORY_FS_MOUNT}/shared/doc.md`);
      expect(stat.type).toBe('file');
    });
  });

  describe('cross-boundary copy/move', () => {
    it('copies a file from the sandbox into the durable mount', async () => {
      await inner.writeFile('/README.md', 'readme');
      await fs.copyFile('/README.md', `${FACTORY_FS_MOUNT}/shared/README.md`);
      expect(await fs.readFile(`${FACTORY_FS_MOUNT}/shared/README.md`, { encoding: 'utf8' })).toBe('readme');
      expect(inner.files.has('/README.md')).toBe(true);
    });

    it('moves a file from the durable mount into the sandbox', async () => {
      await fs.writeFile(`${FACTORY_FS_MOUNT}/shared/plan.md`, 'plan');
      await fs.moveFile(`${FACTORY_FS_MOUNT}/shared/plan.md`, '/plan.md');
      expect(inner.files.get('/plan.md')).toBe('plan');
      expect(await fs.exists(`${FACTORY_FS_MOUNT}/shared/plan.md`)).toBe(false);
    });
  });

  describe('instructions', () => {
    it('merges inner instructions with the durable-mount blurb', () => {
      const instructions = fs.getInstructions();
      expect(instructions).toContain(inner.getInstructions());
      expect(instructions).toContain(`${FACTORY_FS_MOUNT}/shared`);
      expect(instructions).toContain(`${FACTORY_FS_MOUNT}/projects/${PROJECT_NAME}/shared`);
      expect(instructions).toContain(`${FACTORY_FS_MOUNT}/projects/${PROJECT_NAME}/repos/${REPO_DIR}`);
      expect(instructions).toContain('shell commands cannot see');
    });
  });

  describe('lazy durable init', () => {
    it('surfaces backend init failures per mount operation without breaking sandbox paths', async () => {
      class BrokenFilesystem extends LocalFilesystem {
        override async init(): Promise<void> {
          throw new Error('bucket unavailable');
        }
      }
      const broken = new FactoryFilesystem({
        inner,
        durable: new BrokenFilesystem({ basePath: durableRoot }),
        orgId: ORG_ID,
        projectName: PROJECT_NAME,
        repoSlug: REPO_SLUG,
      });
      // Overlay init succeeds — only the inner filesystem initializes eagerly.
      await expect(broken.init()).resolves.toBeUndefined();
      await expect(broken.writeFile(`${FACTORY_FS_MOUNT}/shared/x.md`, 'x')).rejects.toThrow(/bucket unavailable/);
      // Sandbox-side operations are unaffected.
      await broken.writeFile('/ok.md', 'ok');
      expect(inner.files.get('/ok.md')).toBe('ok');
    });
  });
});

describe('path segment helpers', () => {
  it('sanitizes names into safe path segments', () => {
    expect(sanitizePathSegment('My Project')).toBe('My Project');
    expect(sanitizePathSegment('a/b\\c')).toBe('a-b-c');
    expect(sanitizePathSegment('..')).toBe('_');
    expect(sanitizePathSegment('  ')).toBe('_');
    expect(sanitizePathSegment('with\u0000control\u001fchars')).toBe('withcontrolchars');
  });

  it('derives repo directory names from owner/repo slugs', () => {
    expect(repoDirName('mastra-ai/mastra')).toBe('mastra-ai__mastra');
    expect(repoDirName('solo')).toBe('solo');
  });
});
