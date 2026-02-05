/**
 * MastraFilesystem Base Class Tests
 *
 * Tests the abstract base class functionality including:
 * - Logger integration via MastraBase
 * - Component type for logging
 *
 * Based on the Workspace Filesystem & Sandbox Test Plan.
 */

import { describe, it, expect, vi } from 'vitest';

import type { IMastraLogger } from '../../logger';
import { RegisteredLogger } from '../../logger/constants';
import type { ProviderStatus } from '../lifecycle';

import type {
  FileContent,
  FileStat,
  FileEntry,
  ReadOptions,
  WriteOptions,
  ListOptions,
  RemoveOptions,
  CopyOptions,
} from './filesystem';
import { MastraFilesystem } from './mastra-filesystem';

/**
 * Concrete implementation of MastraFilesystem for testing.
 */
class TestFilesystem extends MastraFilesystem {
  readonly id = 'test-filesystem';
  readonly name = 'TestFilesystem';
  readonly provider = 'test';
  status: ProviderStatus = 'pending';

  private files = new Map<string, string | Buffer>();

  constructor() {
    super({ name: 'TestFilesystem' });
  }

  protected async _doInit(): Promise<void> {
    // Initialization logic
  }

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    if (options?.encoding) {
      return content.toString();
    }
    return content;
  }

  async writeFile(path: string, content: FileContent, _options?: WriteOptions): Promise<void> {
    this.files.set(path, typeof content === 'string' ? content : Buffer.from(content));
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    const existing = this.files.get(path) || '';
    this.files.set(path, existing.toString() + content.toString());
  }

  async deleteFile(path: string, _options?: RemoveOptions): Promise<void> {
    this.files.delete(path);
  }

  async copyFile(src: string, dest: string, _options?: CopyOptions): Promise<void> {
    const content = this.files.get(src);
    if (content) {
      this.files.set(dest, content);
    }
  }

  async moveFile(src: string, dest: string, _options?: CopyOptions): Promise<void> {
    const content = this.files.get(src);
    if (content) {
      this.files.set(dest, content);
      this.files.delete(src);
    }
  }

  async mkdir(_path: string, _options?: { recursive?: boolean }): Promise<void> {
    // no-op for simple test
  }

  async rmdir(_path: string, _options?: RemoveOptions): Promise<void> {
    // no-op for simple test
  }

  async readdir(_path: string, _options?: ListOptions): Promise<FileEntry[]> {
    return [];
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async stat(path: string): Promise<FileStat> {
    const content = this.files.get(path);
    return {
      name: path.split('/').pop() || '',
      type: 'file',
      size: content?.length || 0,
      createdAt: new Date(),
      modifiedAt: new Date(),
    };
  }

  // Expose component for testing
  getComponent(): string {
    return this['component'];
  }
}

/**
 * Create a mock logger for testing.
 */
function createMockLogger(): IMastraLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as IMastraLogger;
}

describe('MastraFilesystem Base Class', () => {
  describe('Logger Integration', () => {
    it('extends MastraBase for logger support', () => {
      const fs = new TestFilesystem();

      // Should have the __setLogger method from MastraBase
      expect(typeof fs.__setLogger).toBe('function');
    });

    it('receives logger via __setLogger', () => {
      const fs = new TestFilesystem();
      const mockLogger = createMockLogger();

      fs.__setLogger(mockLogger);

      // Logger should be set internally
      expect(fs['logger']).toBeDefined();
    });

    it('logger can be used after __setLogger', () => {
      const fs = new TestFilesystem();
      const mockLogger = createMockLogger();

      fs.__setLogger(mockLogger);

      // Access the internal logger and call a method
      fs['logger'].debug('test message');

      expect(mockLogger.debug).toHaveBeenCalledWith('test message');
    });
  });

  describe('Component Type', () => {
    it('provides WORKSPACE component type for logging', () => {
      const fs = new TestFilesystem();

      // The component should be WORKSPACE
      expect(fs.getComponent()).toBe(RegisteredLogger.WORKSPACE);
    });
  });

  describe('Lifecycle Methods', () => {
    it('init() sets status to ready', async () => {
      const fs = new TestFilesystem();

      expect(fs.status).toBe('pending');

      await fs.init();

      expect(fs.status).toBe('ready');
    });

    it('init() is idempotent', async () => {
      const fs = new TestFilesystem();
      const initSpy = vi.spyOn(fs as any, '_doInit');

      await fs.init();
      await fs.init();
      await fs.init();

      // _doInit should only be called once
      expect(initSpy).toHaveBeenCalledTimes(1);
    });

    it('concurrent init() calls return same promise', async () => {
      const fs = new TestFilesystem();
      let initCount = 0;

      // Override _doInit to count calls
      (fs as any)._doInit = async () => {
        initCount++;
        await new Promise(resolve => setTimeout(resolve, 10));
      };

      // Start multiple concurrent init calls
      const promises = [fs.init(), fs.init(), fs.init()];

      await Promise.all(promises);

      // Should only init once
      expect(initCount).toBe(1);
    });

    it('destroy() sets status to destroyed', async () => {
      const fs = new TestFilesystem();
      await fs.init();

      await fs.destroy();

      expect(fs.status).toBe('destroyed');
    });
  });
});
