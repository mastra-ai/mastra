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
import type { MastraFilesystemOptions } from './mastra-filesystem';

/**
 * Concrete implementation of MastraFilesystem for testing.
 */
class TestFilesystem extends MastraFilesystem {
  readonly id = 'test-filesystem';
  readonly name = 'TestFilesystem';
  readonly provider = 'test';
  status: ProviderStatus = 'pending';

  private files = new Map<string, string | Buffer>();

  constructor(options?: MastraFilesystemOptions) {
    super({ ...options, name: 'TestFilesystem' });
  }

  async init(): Promise<void> {
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
    if (content !== undefined) {
      this.files.set(dest, content);
    }
  }

  async moveFile(src: string, dest: string, _options?: CopyOptions): Promise<void> {
    const content = this.files.get(src);
    if (content !== undefined) {
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
      path,
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
    it('_init() sets status to ready', async () => {
      const fs = new TestFilesystem();

      expect(fs.status).toBe('pending');

      await fs._init();

      expect(fs.status).toBe('ready');
    });

    it('_init() is idempotent', async () => {
      const fs = new TestFilesystem();
      const initSpy = vi.spyOn(fs as any, 'init');

      await fs._init();
      await fs._init();
      await fs._init();

      // init should only be called once
      expect(initSpy).toHaveBeenCalledTimes(1);
    });

    it('concurrent _init() calls return same promise', async () => {
      const fs = new TestFilesystem();
      let initCount = 0;

      // Override init to count calls
      (fs as any).init = async () => {
        initCount++;
        await new Promise(resolve => setTimeout(resolve, 10));
      };

      // Start multiple concurrent init calls
      const promises = [fs._init(), fs._init(), fs._init()];

      await Promise.all(promises);

      // Should only init once
      expect(initCount).toBe(1);
    });

    it('_destroy() sets status to destroyed', async () => {
      const fs = new TestFilesystem();
      await fs._init();

      await fs._destroy();

      expect(fs.status).toBe('destroyed');
    });

    it('concurrent _destroy() calls return same promise', async () => {
      const fs = new TestFilesystem();
      let destroyCount = 0;

      // Override destroy to count calls
      (fs as any).destroy = async () => {
        destroyCount++;
        await new Promise(resolve => setTimeout(resolve, 10));
      };

      await fs._init();

      // Start multiple concurrent destroy calls
      const promises = [fs._destroy(), fs._destroy(), fs._destroy()];

      await Promise.all(promises);

      // Should only destroy once
      expect(destroyCount).toBe(1);
      expect(fs.status).toBe('destroyed');
    });

    it('_init() sets status to error when init() throws', async () => {
      const fs = new TestFilesystem();

      // Override init to throw
      (fs as any).init = async () => {
        throw new Error('Init failed');
      };

      await expect(fs._init()).rejects.toThrow('Init failed');

      expect(fs.status).toBe('error');
    });

    it('ensureReady() propagates init error when init() fails', async () => {
      const fs = new TestFilesystem();

      // Override init to throw
      (fs as any).init = async () => {
        throw new Error('Init failed');
      };

      // ensureReady checks status !== 'ready', calls _init() which throws
      await expect((fs as any).ensureReady()).rejects.toThrow('Init failed');
      expect(fs.status).toBe('error');
    });

    it('_initPromise is cleared after error so retry is possible', async () => {
      const fs = new TestFilesystem();
      let shouldFail = true;

      (fs as any).init = async () => {
        if (shouldFail) throw new Error('Init failed');
      };

      // First init fails
      await expect(fs._init()).rejects.toThrow('Init failed');
      expect(fs.status).toBe('error');

      // Fix the issue and retry
      shouldFail = false;
      await fs._init();
      expect(fs.status).toBe('ready');
    });

    it('_destroy() sets status to error when destroy() throws', async () => {
      const fs = new TestFilesystem();
      await fs._init();

      (fs as any).destroy = async () => {
        throw new Error('Destroy failed');
      };

      await expect(fs._destroy()).rejects.toThrow('Destroy failed');

      expect(fs.status).toBe('error');
    });

    it('_init() after _destroy() re-initializes', async () => {
      const fs = new TestFilesystem();

      await fs._init();
      expect(fs.status).toBe('ready');

      await fs._destroy();
      expect(fs.status).toBe('destroyed');

      // Re-init should work since _initPromise was cleared and status is not 'ready'
      await fs._init();
      expect(fs.status).toBe('ready');
    });
  });

  describe('Lifecycle Callbacks', () => {
    it('onInit fires after status becomes ready', async () => {
      const onInit = vi.fn(({ filesystem }) => {
        // Status should already be 'ready' when callback fires
        expect(filesystem.status).toBe('ready');
      });

      const fs = new TestFilesystem({ onInit });

      await fs._init();

      expect(onInit).toHaveBeenCalledTimes(1);
      expect(fs.status).toBe('ready');
    });

    it('onInit failure is non-fatal', async () => {
      const onInit = vi.fn(() => {
        throw new Error('callback boom');
      });

      const fs = new TestFilesystem({ onInit });

      // Should NOT throw — callback error is swallowed
      await fs._init();

      expect(onInit).toHaveBeenCalledTimes(1);
      expect(fs.status).toBe('ready');
    });

    it('onInit is not called when init() throws', async () => {
      const onInit = vi.fn();
      const fs = new TestFilesystem({ onInit });

      // Override init to throw
      (fs as any).init = async () => {
        throw new Error('Init failed');
      };

      await expect(fs._init()).rejects.toThrow('Init failed');

      expect(onInit).not.toHaveBeenCalled();
      expect(fs.status).toBe('error');
    });

    it('onDestroy fires before destroy()', async () => {
      const order: string[] = [];

      const onDestroy = vi.fn(() => {
        order.push('onDestroy');
      });

      const fs = new TestFilesystem({ onDestroy });

      // Override destroy to track call order
      (fs as any).destroy = async () => {
        order.push('destroy');
      };

      await fs._init();
      await fs._destroy();

      expect(onDestroy).toHaveBeenCalledTimes(1);
      expect(order).toEqual(['onDestroy', 'destroy']);
      expect(fs.status).toBe('destroyed');
    });

    it('onDestroy receives filesystem instance', async () => {
      const onDestroy = vi.fn();
      const fs = new TestFilesystem({ onDestroy });

      await fs._init();
      await fs._destroy();

      expect(onDestroy).toHaveBeenCalledWith({ filesystem: fs });
    });

    it('onDestroy failure propagates (marks status as error)', async () => {
      const onDestroy = vi.fn(() => {
        throw new Error('destroy callback boom');
      });

      const fs = new TestFilesystem({ onDestroy });

      await fs._init();

      await expect(fs._destroy()).rejects.toThrow('destroy callback boom');

      expect(fs.status).toBe('error');
    });

    it('callbacks are not called when no hooks are provided', async () => {
      const fs = new TestFilesystem();

      // Should work fine with no callbacks
      await fs._init();
      expect(fs.status).toBe('ready');

      await fs._destroy();
      expect(fs.status).toBe('destroyed');
    });
  });
});
