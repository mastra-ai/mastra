# LANE 3b: @mastra/observability-file-local Implementation Plan

## Overview

This plan covers the implementation of the local file storage adapter for the MastraAdmin observability system. The `@mastra/observability-file-local` package provides local filesystem storage for observability data (traces, spans, logs, metrics, scores) written in JSONL format.

**Package**: `@mastra/observability-file-local`
**Location**: `observability/file-local/`
**Priority**: P0 (MVP requirement)
**Dependencies**: LANE 1 (Core Package) - `FileStorageProvider` interface from `@mastra/admin`

## Purpose

The local file storage adapter enables:

1. **Development Mode**: Store observability data locally during development
2. **Self-Hosted Single-Node**: Simple deployments that don't need cloud storage
3. **Testing**: Predictable file-based storage for integration tests
4. **Ingestion Worker**: The ClickHouse ingestion worker reads from this storage

## Interface to Implement

From `packages/admin/src/file-storage/base.ts`:

```typescript
import type { FileInfo } from '@mastra/admin';

export interface FileStorageProvider {
  /** Storage type identifier */
  readonly type: 'local' | 's3' | 'gcs' | string;

  /**
   * Write content to a file.
   * Creates parent directories if they don't exist.
   */
  write(path: string, content: Buffer | string): Promise<void>;

  /**
   * Read a file's content.
   * @throws Error if file doesn't exist
   */
  read(path: string): Promise<Buffer>;

  /**
   * List files matching a prefix.
   * Results are sorted by lastModified ascending (oldest first).
   */
  list(prefix: string): Promise<FileInfo[]>;

  /**
   * Delete a file.
   * No-op if file doesn't exist.
   */
  delete(path: string): Promise<void>;

  /**
   * Move/rename a file.
   * Used for marking files as processed.
   */
  move(from: string, to: string): Promise<void>;

  /**
   * Check if a file exists.
   */
  exists(path: string): Promise<boolean>;
}

export interface FileInfo {
  path: string;
  size: number;
  lastModified: Date;
}
```

## Directory Structure

```
observability/file-local/
├── src/
│   ├── index.ts              # Public exports
│   ├── provider.ts           # LocalFileStorage implementation
│   ├── provider.test.ts      # Unit tests
│   ├── types.ts              # Configuration types
│   └── utils.ts              # Helper utilities
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── tsup.config.ts
├── vitest.config.ts
├── eslint.config.js
├── turbo.json
└── CHANGELOG.md
```

## Implementation Details

### 1. Package Configuration (`package.json`)

```json
{
  "name": "@mastra/observability-file-local",
  "version": "1.0.0",
  "description": "Local filesystem storage provider for MastraAdmin observability",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist", "CHANGELOG.md"],
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.cjs"
      }
    },
    "./package.json": "./package.json"
  },
  "scripts": {
    "build:lib": "tsup --silent --config tsup.config.ts",
    "build:docs": "pnpx tsx ../../scripts/generate-package-docs.ts observability/file-local",
    "build:watch": "pnpm build:lib --watch",
    "test": "vitest run",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit -p tsconfig.build.json"
  },
  "license": "Apache-2.0",
  "dependencies": {
    "fast-glob": "^3.3.0"
  },
  "devDependencies": {
    "@internal/lint": "workspace:*",
    "@internal/types-builder": "workspace:*",
    "@mastra/admin": "workspace:*",
    "@types/node": "22.13.17",
    "@vitest/coverage-v8": "catalog:",
    "@vitest/ui": "catalog:",
    "eslint": "^9.37.0",
    "memfs": "^4.0.0",
    "tsup": "^8.5.0",
    "typescript": "catalog:",
    "vitest": "catalog:"
  },
  "peerDependencies": {
    "@mastra/admin": ">=1.0.0-0 <2.0.0-0"
  },
  "homepage": "https://mastra.ai",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/mastra-ai/mastra.git",
    "directory": "observability/file-local"
  },
  "bugs": {
    "url": "https://github.com/mastra-ai/mastra/issues"
  },
  "engines": {
    "node": ">=22.13.0"
  }
}
```

### 2. Types (`src/types.ts`)

```typescript
/**
 * Configuration for LocalFileStorage provider.
 */
export interface LocalFileStorageConfig {
  /**
   * Base directory for all file operations.
   * All paths will be relative to this directory.
   * Must be an absolute path.
   */
  baseDir: string;

  /**
   * File permissions for created files (octal).
   * @default 0o644
   */
  fileMode?: number;

  /**
   * Directory permissions for created directories (octal).
   * @default 0o755
   */
  dirMode?: number;

  /**
   * Use atomic writes (write to temp file, then rename).
   * Prevents partial writes on crashes.
   * @default true
   */
  atomicWrites?: boolean;

  /**
   * Custom temp directory for atomic writes.
   * @default `${baseDir}/.tmp`
   */
  tempDir?: string;
}
```

### 3. LocalFileStorage Implementation (`src/provider.ts`)

````typescript
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { FileStorageProvider, FileInfo } from '@mastra/admin';
import fg from 'fast-glob';
import type { LocalFileStorageConfig } from './types';

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG = {
  fileMode: 0o644,
  dirMode: 0o755,
  atomicWrites: true,
} as const;

/**
 * Local filesystem storage provider for observability data.
 *
 * Stores files on the local filesystem with support for:
 * - Atomic writes (prevents partial files on crash)
 * - Automatic directory creation
 * - Prefix-based listing (for finding pending files)
 * - Move operations (for marking files as processed)
 *
 * @example
 * ```typescript
 * const storage = new LocalFileStorage({
 *   baseDir: '/var/mastra/observability',
 * });
 *
 * // Write observability data
 * await storage.write('pending/traces-2024-01-23-001.jsonl', jsonlContent);
 *
 * // List pending files
 * const pending = await storage.list('pending/');
 *
 * // After processing, move to processed
 * await storage.move(
 *   'pending/traces-2024-01-23-001.jsonl',
 *   'processed/traces-2024-01-23-001.jsonl'
 * );
 * ```
 */
export class LocalFileStorage implements FileStorageProvider {
  readonly type = 'local' as const;

  private readonly config: Required<LocalFileStorageConfig>;
  private initialized = false;

  constructor(config: LocalFileStorageConfig) {
    // Validate baseDir is absolute
    if (!path.isAbsolute(config.baseDir)) {
      throw new Error(`baseDir must be an absolute path: ${config.baseDir}`);
    }

    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      tempDir: config.tempDir ?? path.join(config.baseDir, '.tmp'),
    };
  }

  /**
   * Ensure base and temp directories exist.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    await fs.mkdir(this.config.baseDir, { recursive: true, mode: this.config.dirMode });
    if (this.config.atomicWrites) {
      await fs.mkdir(this.config.tempDir, { recursive: true, mode: this.config.dirMode });
    }

    this.initialized = true;
  }

  /**
   * Resolve a relative path to an absolute path within baseDir.
   * Validates the path doesn't escape baseDir (security).
   */
  private resolvePath(relativePath: string): string {
    // Normalize and join with baseDir
    const normalized = path.normalize(relativePath);
    const fullPath = path.join(this.config.baseDir, normalized);

    // Security: Ensure the resolved path is within baseDir
    const resolvedBase = path.resolve(this.config.baseDir);
    const resolvedFull = path.resolve(fullPath);

    if (!resolvedFull.startsWith(resolvedBase + path.sep) && resolvedFull !== resolvedBase) {
      throw new Error(`Path escapes base directory: ${relativePath}`);
    }

    return fullPath;
  }

  /**
   * Write content to a file.
   * Creates parent directories if they don't exist.
   * Uses atomic writes by default (write to temp, then rename).
   */
  async write(filePath: string, content: Buffer | string): Promise<void> {
    await this.ensureInitialized();

    const fullPath = this.resolvePath(filePath);
    const dir = path.dirname(fullPath);

    // Ensure parent directory exists
    await fs.mkdir(dir, { recursive: true, mode: this.config.dirMode });

    // Convert string to Buffer for consistent handling
    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;

    if (this.config.atomicWrites) {
      // Atomic write: write to temp file, then rename
      const tempPath = path.join(this.config.tempDir, `${crypto.randomUUID()}.tmp`);

      try {
        await fs.writeFile(tempPath, buffer, { mode: this.config.fileMode });
        await fs.rename(tempPath, fullPath);
      } catch (error) {
        // Clean up temp file on failure
        try {
          await fs.unlink(tempPath);
        } catch {
          // Ignore cleanup errors
        }
        throw error;
      }
    } else {
      // Direct write (not atomic, but slightly faster)
      await fs.writeFile(fullPath, buffer, { mode: this.config.fileMode });
    }
  }

  /**
   * Read a file's content.
   * @throws Error if file doesn't exist
   */
  async read(filePath: string): Promise<Buffer> {
    await this.ensureInitialized();

    const fullPath = this.resolvePath(filePath);

    try {
      return await fs.readFile(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      throw error;
    }
  }

  /**
   * List files matching a prefix.
   * Results are sorted by lastModified ascending (oldest first).
   */
  async list(prefix: string): Promise<FileInfo[]> {
    await this.ensureInitialized();

    const searchPath = this.resolvePath(prefix);
    const baseDir = this.config.baseDir;

    // Use fast-glob to find files
    // Add ** pattern to match files recursively under the prefix
    const pattern = searchPath.endsWith(path.sep) || searchPath.endsWith('/') ? `${searchPath}**/*` : `${searchPath}*`;

    const files = await fg(pattern, {
      onlyFiles: true,
      stats: true,
      absolute: true,
    });

    // Map to FileInfo and sort by lastModified
    const fileInfos: FileInfo[] = files.map(file => {
      const stats = file.stats!;
      // Convert absolute path back to relative
      const relativePath = path.relative(baseDir, file.path);

      return {
        path: relativePath,
        size: stats.size,
        lastModified: stats.mtime,
      };
    });

    // Sort by lastModified ascending (oldest first - for FIFO processing)
    fileInfos.sort((a, b) => a.lastModified.getTime() - b.lastModified.getTime());

    return fileInfos;
  }

  /**
   * Delete a file.
   * No-op if file doesn't exist.
   */
  async delete(filePath: string): Promise<void> {
    await this.ensureInitialized();

    const fullPath = this.resolvePath(filePath);

    try {
      await fs.unlink(fullPath);
    } catch (error) {
      // Ignore ENOENT (file doesn't exist)
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Move/rename a file.
   * Creates destination directory if it doesn't exist.
   * Used for marking files as processed.
   */
  async move(from: string, to: string): Promise<void> {
    await this.ensureInitialized();

    const fromPath = this.resolvePath(from);
    const toPath = this.resolvePath(to);

    // Ensure destination directory exists
    const toDir = path.dirname(toPath);
    await fs.mkdir(toDir, { recursive: true, mode: this.config.dirMode });

    await fs.rename(fromPath, toPath);
  }

  /**
   * Check if a file exists.
   */
  async exists(filePath: string): Promise<boolean> {
    await this.ensureInitialized();

    const fullPath = this.resolvePath(filePath);

    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the base directory.
   */
  getBaseDir(): string {
    return this.config.baseDir;
  }

  /**
   * Get the current configuration.
   */
  getConfig(): Readonly<Required<LocalFileStorageConfig>> {
    return { ...this.config };
  }
}
````

### 4. Public Exports (`src/index.ts`)

```typescript
export { LocalFileStorage } from './provider';
export type { LocalFileStorageConfig } from './types';

// Re-export types from @mastra/admin for convenience
export type { FileStorageProvider, FileInfo } from '@mastra/admin';
```

### 5. Utility Functions (`src/utils.ts`)

```typescript
import * as path from 'node:path';

/**
 * Ensure a path uses forward slashes (for consistency).
 */
export function normalizeSlashes(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

/**
 * Generate a timestamped filename for observability files.
 * Format: {type}-{YYYY-MM-DD}-{HHmmss}-{random}.jsonl
 */
export function generateFilename(type: 'traces' | 'spans' | 'logs' | 'metrics' | 'scores'): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = now.toISOString().split('T')[1]!.replace(/[:.]/g, '').slice(0, 6); // HHmmss
  const random = Math.random().toString(36).slice(2, 8);

  return `${type}-${date}-${time}-${random}.jsonl`;
}
```

### 6. Unit Tests (`src/provider.test.ts`)

```typescript
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalFileStorage } from './provider';

describe('LocalFileStorage', () => {
  let storage: LocalFileStorage;
  let testDir: string;

  beforeEach(async () => {
    // Create unique temp directory for each test
    testDir = path.join(os.tmpdir(), `mastra-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(testDir, { recursive: true });

    storage = new LocalFileStorage({
      baseDir: testDir,
    });
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should throw if baseDir is not absolute', () => {
      expect(() => new LocalFileStorage({ baseDir: 'relative/path' })).toThrow('baseDir must be an absolute path');
    });

    it('should accept valid absolute path', () => {
      const storage = new LocalFileStorage({ baseDir: '/tmp/test' });
      expect(storage.type).toBe('local');
    });
  });

  describe('write', () => {
    it('should write string content', async () => {
      await storage.write('test.txt', 'hello world');

      const content = await fs.readFile(path.join(testDir, 'test.txt'), 'utf-8');
      expect(content).toBe('hello world');
    });

    it('should write Buffer content', async () => {
      const buffer = Buffer.from('binary data');
      await storage.write('test.bin', buffer);

      const content = await fs.readFile(path.join(testDir, 'test.bin'));
      expect(content.equals(buffer)).toBe(true);
    });

    it('should create parent directories', async () => {
      await storage.write('deep/nested/path/file.txt', 'content');

      const content = await fs.readFile(path.join(testDir, 'deep/nested/path/file.txt'), 'utf-8');
      expect(content).toBe('content');
    });

    it('should use atomic writes by default', async () => {
      // Write should complete atomically - file should either exist fully or not at all
      await storage.write('atomic.txt', 'atomic content');

      const exists = await storage.exists('atomic.txt');
      expect(exists).toBe(true);
    });

    it('should prevent path traversal attacks', async () => {
      await expect(storage.write('../escape/file.txt', 'malicious')).rejects.toThrow('Path escapes base directory');
    });
  });

  describe('read', () => {
    it('should read existing file', async () => {
      await fs.writeFile(path.join(testDir, 'existing.txt'), 'existing content');

      const content = await storage.read('existing.txt');
      expect(content.toString('utf-8')).toBe('existing content');
    });

    it('should throw for non-existent file', async () => {
      await expect(storage.read('nonexistent.txt')).rejects.toThrow('File not found: nonexistent.txt');
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      // Create test files with different timestamps
      await storage.write('pending/file1.jsonl', 'content1');
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay for different mtime
      await storage.write('pending/file2.jsonl', 'content2');
      await storage.write('processed/file3.jsonl', 'content3');
    });

    it('should list files matching prefix', async () => {
      const files = await storage.list('pending/');
      expect(files).toHaveLength(2);
      expect(files.map(f => f.path)).toContain('pending/file1.jsonl');
      expect(files.map(f => f.path)).toContain('pending/file2.jsonl');
    });

    it('should return files sorted by lastModified (oldest first)', async () => {
      const files = await storage.list('pending/');
      expect(files[0]!.path).toBe('pending/file1.jsonl');
      expect(files[1]!.path).toBe('pending/file2.jsonl');
    });

    it('should return file info with size and lastModified', async () => {
      const files = await storage.list('pending/');
      for (const file of files) {
        expect(typeof file.size).toBe('number');
        expect(file.lastModified).toBeInstanceOf(Date);
      }
    });

    it('should return empty array for non-matching prefix', async () => {
      const files = await storage.list('nonexistent/');
      expect(files).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should delete existing file', async () => {
      await storage.write('to-delete.txt', 'content');
      expect(await storage.exists('to-delete.txt')).toBe(true);

      await storage.delete('to-delete.txt');
      expect(await storage.exists('to-delete.txt')).toBe(false);
    });

    it('should be no-op for non-existent file', async () => {
      // Should not throw
      await storage.delete('nonexistent.txt');
    });
  });

  describe('move', () => {
    it('should move file to new location', async () => {
      await storage.write('pending/file.jsonl', 'content');

      await storage.move('pending/file.jsonl', 'processed/file.jsonl');

      expect(await storage.exists('pending/file.jsonl')).toBe(false);
      expect(await storage.exists('processed/file.jsonl')).toBe(true);

      const content = await storage.read('processed/file.jsonl');
      expect(content.toString('utf-8')).toBe('content');
    });

    it('should create destination directory if needed', async () => {
      await storage.write('source.txt', 'content');

      await storage.move('source.txt', 'new/deep/path/dest.txt');

      expect(await storage.exists('new/deep/path/dest.txt')).toBe(true);
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      await storage.write('exists.txt', 'content');
      expect(await storage.exists('exists.txt')).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      expect(await storage.exists('nonexistent.txt')).toBe(false);
    });
  });

  describe('non-atomic writes', () => {
    it('should support non-atomic writes', async () => {
      const nonAtomicStorage = new LocalFileStorage({
        baseDir: testDir,
        atomicWrites: false,
      });

      await nonAtomicStorage.write('direct.txt', 'content');
      const content = await nonAtomicStorage.read('direct.txt');
      expect(content.toString('utf-8')).toBe('content');
    });
  });
});
```

### 7. Configuration Files

**tsconfig.json**:

```json
{
  "extends": "../../tsconfig.node.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**tsconfig.build.json**:

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**tsup.config.ts**:

```typescript
import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  sourcemap: true,
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
```

**vitest.config.ts**:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

**eslint.config.js**:

```javascript
import lintConfig from '@internal/lint';

export default lintConfig;
```

**turbo.json**:

```json
{
  "extends": ["//"],
  "tasks": {
    "build:lib": {
      "dependsOn": ["^build:lib"],
      "outputs": ["dist/**"]
    }
  }
}
```

**CHANGELOG.md**:

```markdown
# @mastra/observability-file-local

## 1.0.0

### Major Changes

- Initial release of the local file storage provider for MastraAdmin observability
- Implements `FileStorageProvider` interface from `@mastra/admin`
- Features:
  - Atomic writes (write to temp, then rename) for crash safety
  - Automatic directory creation
  - Prefix-based file listing for processing queues
  - Move operations for marking files as processed
  - Security validation to prevent path traversal attacks
```

## Implementation Steps

### Step 1: Create Package Structure

1. Create `observability/file-local/` directory
2. Create all configuration files (package.json, tsconfig.json, etc.)
3. Add package to workspace root

### Step 2: Implement Core Provider

1. Create `src/types.ts` with configuration types
2. Create `src/provider.ts` with `LocalFileStorage` implementation
3. Create `src/utils.ts` with helper functions
4. Create `src/index.ts` with exports

### Step 3: Write Tests

1. Create `src/provider.test.ts` with comprehensive unit tests
2. Cover all interface methods
3. Test edge cases (path traversal, non-existent files, etc.)

### Step 4: Build and Verify

1. Run `pnpm build:lib` to compile
2. Run `pnpm test` to verify tests pass
3. Run `pnpm typecheck` to verify types
4. Run `pnpm lint` to verify code style

## Integration with Observability System

The `LocalFileStorage` provider integrates with the observability data flow:

```
┌──────────────────────────┐
│  ObservabilityWriter     │
│  (packages/observability-│
│   writer/)               │
└───────────┬──────────────┘
            │ writes JSONL files
            ▼
┌──────────────────────────┐
│  LocalFileStorage        │
│  (this package)          │
│                          │
│  baseDir/                │
│  ├── pending/            │
│  │   ├── traces-*.jsonl  │
│  │   └── spans-*.jsonl   │
│  └── processed/          │
│      └── *.jsonl         │
└───────────┬──────────────┘
            │ reads & moves files
            ▼
┌──────────────────────────┐
│  IngestionWorker         │
│  (observability/         │
│   clickhouse/)           │
└──────────────────────────┘
```

### Usage Example

```typescript
import { LocalFileStorage } from '@mastra/observability-file-local';
import { ObservabilityWriter } from '@mastra/observability-writer';

// Configure local file storage
const fileStorage = new LocalFileStorage({
  baseDir: '/var/mastra/observability',
  atomicWrites: true, // Crash-safe writes
});

// Pass to observability writer
const writer = new ObservabilityWriter({
  fileStorage,
  // ... other config
});

// The writer will write JSONL files to:
// /var/mastra/observability/pending/traces-YYYY-MM-DD-HHmmss-XXXX.jsonl
```

## Success Criteria

- [ ] Package builds successfully: `pnpm build:lib`
- [ ] All tests pass: `pnpm test`
- [ ] TypeScript types are correct: `pnpm typecheck`
- [ ] Code passes linting: `pnpm lint`
- [ ] Implements complete `FileStorageProvider` interface
- [ ] Atomic writes prevent partial files on crash
- [ ] Path traversal attacks are prevented
- [ ] Files are sorted by lastModified for FIFO processing
- [ ] Move operation works across directories

## Future Enhancements (Out of Scope for MVP)

1. **File Locking**: For multi-process safety (not needed for single-process ingestion worker)
2. **Compression**: gzip compression for space savings
3. **Rotation Policy**: Automatic cleanup of old processed files
4. **Metrics**: Expose storage metrics (file count, total size)

---

**Note**: This is a P0 MVP implementation. S3 and GCS adapters (`@mastra/observability-file-s3`, `@mastra/observability-file-gcs`) are P2 and will be implemented later following the same interface.
