/**
 * Tests for packages/core/src/workspace/errors.ts
 *
 * All classes under test are plain Error subclasses with deterministic
 * constructor logic — no I/O, no async behaviour, no mocking required.
 * Each test verifies the error `name`, `message`, and any custom fields
 * (code, path, workspaceId, etc.) set by the constructor.
 */
import { describe, expect, it } from 'vitest';

import {
  DirectoryNotEmptyError,
  DirectoryNotFoundError,
  FileExistsError,
  FilesystemError,
  FilesystemNotAvailableError,
  FilesystemNotReadyError,
  FileNotFoundError,
  FileReadRequiredError,
  IsDirectoryError,
  NotDirectoryError,
  PermissionError,
  SandboxFeatureNotSupportedError,
  SandboxNotAvailableError,
  SearchNotAvailableError,
  StaleFileError,
  WorkspaceError,
  WorkspaceNotAvailableError,
  WorkspaceNotReadyError,
  WorkspaceReadOnlyError,
} from './errors';

// ---------------------------------------------------------------------------
// WorkspaceError (base class)
// ---------------------------------------------------------------------------

describe('WorkspaceError', () => {
  it('sets message, code, and name', () => {
    const err = new WorkspaceError('something went wrong', 'CUSTOM_CODE');
    expect(err.message).toBe('something went wrong');
    expect(err.code).toBe('CUSTOM_CODE');
    expect(err.name).toBe('WorkspaceError');
  });

  it('is an instance of Error', () => {
    expect(new WorkspaceError('x', 'Y')).toBeInstanceOf(Error);
  });

  it('sets workspaceId when provided', () => {
    const err = new WorkspaceError('x', 'Y', 'ws-123');
    expect(err.workspaceId).toBe('ws-123');
  });

  it('leaves workspaceId undefined when omitted', () => {
    const err = new WorkspaceError('x', 'Y');
    expect(err.workspaceId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// WorkspaceNotAvailableError
// ---------------------------------------------------------------------------

describe('WorkspaceNotAvailableError', () => {
  it('has the correct name, code, and message', () => {
    const err = new WorkspaceNotAvailableError();
    expect(err.name).toBe('WorkspaceNotAvailableError');
    expect(err.code).toBe('NO_WORKSPACE');
    expect(err.message).toBe('Workspace not available. Ensure the agent has a workspace configured.');
  });

  it('is an instance of WorkspaceError', () => {
    expect(new WorkspaceNotAvailableError()).toBeInstanceOf(WorkspaceError);
  });
});

// ---------------------------------------------------------------------------
// FilesystemNotAvailableError
// ---------------------------------------------------------------------------

describe('FilesystemNotAvailableError', () => {
  it('has the correct name, code, and message', () => {
    const err = new FilesystemNotAvailableError();
    expect(err.name).toBe('FilesystemNotAvailableError');
    expect(err.code).toBe('NO_FILESYSTEM');
    expect(err.message).toBe('Workspace does not have a filesystem configured');
  });
});

// ---------------------------------------------------------------------------
// SandboxNotAvailableError
// ---------------------------------------------------------------------------

describe('SandboxNotAvailableError', () => {
  it('uses the default message when none provided', () => {
    const err = new SandboxNotAvailableError();
    expect(err.message).toBe('Workspace does not have a sandbox configured');
    expect(err.code).toBe('NO_SANDBOX');
  });

  it('uses a custom message when provided', () => {
    const err = new SandboxNotAvailableError('custom sandbox message');
    expect(err.message).toBe('custom sandbox message');
    expect(err.code).toBe('NO_SANDBOX');
  });

  it('has the correct name', () => {
    expect(new SandboxNotAvailableError().name).toBe('SandboxNotAvailableError');
  });
});

// ---------------------------------------------------------------------------
// SandboxFeatureNotSupportedError
// ---------------------------------------------------------------------------

describe('SandboxFeatureNotSupportedError', () => {
  it('includes the feature name in the message for executeCommand', () => {
    const err = new SandboxFeatureNotSupportedError('executeCommand');
    expect(err.message).toBe('Sandbox does not support executeCommand');
  });

  it('includes the feature name in the message for installPackage', () => {
    const err = new SandboxFeatureNotSupportedError('installPackage');
    expect(err.message).toBe('Sandbox does not support installPackage');
  });

  it('includes the feature name in the message for processes', () => {
    const err = new SandboxFeatureNotSupportedError('processes');
    expect(err.message).toBe('Sandbox does not support processes');
  });

  it('has the correct code and name', () => {
    const err = new SandboxFeatureNotSupportedError('processes');
    expect(err.code).toBe('FEATURE_NOT_SUPPORTED');
    expect(err.name).toBe('SandboxFeatureNotSupportedError');
  });
});

// ---------------------------------------------------------------------------
// SearchNotAvailableError
// ---------------------------------------------------------------------------

describe('SearchNotAvailableError', () => {
  it('has the correct name, code, and message', () => {
    const err = new SearchNotAvailableError();
    expect(err.name).toBe('SearchNotAvailableError');
    expect(err.code).toBe('NO_SEARCH');
    expect(err.message).toBe(
      'Workspace does not have search configured (enable bm25 or provide vectorStore + embedder)',
    );
  });
});

// ---------------------------------------------------------------------------
// WorkspaceNotReadyError
// ---------------------------------------------------------------------------

describe('WorkspaceNotReadyError', () => {
  it('includes the status and workspaceId', () => {
    const err = new WorkspaceNotReadyError('ws-1', 'initializing' as any);
    expect(err.message).toBe('Workspace is not ready (status: initializing)');
    expect(err.workspaceId).toBe('ws-1');
    expect(err.code).toBe('NOT_READY');
  });

  it('has the correct name', () => {
    expect(new WorkspaceNotReadyError('ws-2', 'error' as any).name).toBe('WorkspaceNotReadyError');
  });
});

// ---------------------------------------------------------------------------
// WorkspaceReadOnlyError
// ---------------------------------------------------------------------------

describe('WorkspaceReadOnlyError', () => {
  it('includes the operation name in the message', () => {
    const err = new WorkspaceReadOnlyError('write file');
    expect(err.message).toBe('Workspace is in read-only mode. Cannot perform: write file');
  });

  it('has the correct code and name', () => {
    const err = new WorkspaceReadOnlyError('delete');
    expect(err.code).toBe('READ_ONLY');
    expect(err.name).toBe('WorkspaceReadOnlyError');
  });
});

// ---------------------------------------------------------------------------
// FilesystemError (base class)
// ---------------------------------------------------------------------------

describe('FilesystemError', () => {
  it('sets message, code, and path', () => {
    const err = new FilesystemError('disk full', 'ENOSPC', '/tmp/file.txt');
    expect(err.message).toBe('disk full');
    expect(err.code).toBe('ENOSPC');
    expect(err.path).toBe('/tmp/file.txt');
    expect(err.name).toBe('FilesystemError');
  });

  it('is an instance of Error', () => {
    expect(new FilesystemError('x', 'Y', '/z')).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// FileNotFoundError
// ---------------------------------------------------------------------------

describe('FileNotFoundError', () => {
  it('includes the path in the message and sets ENOENT code', () => {
    const err = new FileNotFoundError('/data/missing.txt');
    expect(err.message).toBe('File not found: /data/missing.txt');
    expect(err.code).toBe('ENOENT');
    expect(err.path).toBe('/data/missing.txt');
    expect(err.name).toBe('FileNotFoundError');
  });

  it('is an instance of FilesystemError', () => {
    expect(new FileNotFoundError('/x')).toBeInstanceOf(FilesystemError);
  });
});

// ---------------------------------------------------------------------------
// DirectoryNotFoundError
// ---------------------------------------------------------------------------

describe('DirectoryNotFoundError', () => {
  it('includes the path and sets ENOENT code', () => {
    const err = new DirectoryNotFoundError('/data/missing-dir');
    expect(err.message).toBe('Directory not found: /data/missing-dir');
    expect(err.code).toBe('ENOENT');
    expect(err.name).toBe('DirectoryNotFoundError');
  });
});

// ---------------------------------------------------------------------------
// FileExistsError
// ---------------------------------------------------------------------------

describe('FileExistsError', () => {
  it('includes the path and sets EEXIST code', () => {
    const err = new FileExistsError('/data/existing.txt');
    expect(err.message).toBe('File already exists: /data/existing.txt');
    expect(err.code).toBe('EEXIST');
    expect(err.name).toBe('FileExistsError');
  });
});

// ---------------------------------------------------------------------------
// IsDirectoryError
// ---------------------------------------------------------------------------

describe('IsDirectoryError', () => {
  it('includes the path and sets EISDIR code', () => {
    const err = new IsDirectoryError('/data/adir');
    expect(err.message).toBe('Path is a directory: /data/adir');
    expect(err.code).toBe('EISDIR');
    expect(err.name).toBe('IsDirectoryError');
  });
});

// ---------------------------------------------------------------------------
// NotDirectoryError
// ---------------------------------------------------------------------------

describe('NotDirectoryError', () => {
  it('includes the path and sets ENOTDIR code', () => {
    const err = new NotDirectoryError('/data/file.txt');
    expect(err.message).toBe('Path is not a directory: /data/file.txt');
    expect(err.code).toBe('ENOTDIR');
    expect(err.name).toBe('NotDirectoryError');
  });
});

// ---------------------------------------------------------------------------
// DirectoryNotEmptyError
// ---------------------------------------------------------------------------

describe('DirectoryNotEmptyError', () => {
  it('includes the path and sets ENOTEMPTY code', () => {
    const err = new DirectoryNotEmptyError('/data/full-dir');
    expect(err.message).toBe('Directory not empty: /data/full-dir');
    expect(err.code).toBe('ENOTEMPTY');
    expect(err.name).toBe('DirectoryNotEmptyError');
  });
});

// ---------------------------------------------------------------------------
// PermissionError
// ---------------------------------------------------------------------------

describe('PermissionError', () => {
  it('includes the operation and path in the message', () => {
    const err = new PermissionError('/data/locked.txt', 'write');
    expect(err.message).toBe('Permission denied: write on /data/locked.txt');
    expect(err.code).toBe('EACCES');
  });

  it('exposes the operation field separately', () => {
    const err = new PermissionError('/p', 'delete');
    expect(err.operation).toBe('delete');
  });

  it('has the correct name', () => {
    expect(new PermissionError('/p', 'read').name).toBe('PermissionError');
  });
});

// ---------------------------------------------------------------------------
// FileReadRequiredError
// ---------------------------------------------------------------------------

describe('FileReadRequiredError', () => {
  it('uses the reason as the message directly', () => {
    const err = new FileReadRequiredError('/data/file.txt', 'File must be read before editing');
    expect(err.message).toBe('File must be read before editing');
    expect(err.code).toBe('EREAD_REQUIRED');
    expect(err.path).toBe('/data/file.txt');
  });

  it('has the correct name', () => {
    expect(new FileReadRequiredError('/p', 'reason').name).toBe('FileReadRequiredError');
  });
});

// ---------------------------------------------------------------------------
// StaleFileError
// ---------------------------------------------------------------------------

describe('StaleFileError', () => {
  it('includes path and both mtimes in the message', () => {
    const expected = new Date('2024-01-01T00:00:00.000Z');
    const actual = new Date('2024-01-02T00:00:00.000Z');
    const err = new StaleFileError('/data/file.txt', expected, actual);

    expect(err.message).toContain('/data/file.txt');
    expect(err.message).toContain('2024-01-01T00:00:00.000Z');
    expect(err.message).toContain('2024-01-02T00:00:00.000Z');
    expect(err.code).toBe('ESTALE');
  });

  it('exposes expectedMtime and actualMtime fields', () => {
    const expected = new Date('2024-01-01T00:00:00.000Z');
    const actual = new Date('2024-01-02T00:00:00.000Z');
    const err = new StaleFileError('/p', expected, actual);

    expect(err.expectedMtime).toBe(expected);
    expect(err.actualMtime).toBe(actual);
  });

  it('has the correct name', () => {
    const err = new StaleFileError('/p', new Date(), new Date());
    expect(err.name).toBe('StaleFileError');
  });
});

// ---------------------------------------------------------------------------
// FilesystemNotReadyError
// ---------------------------------------------------------------------------

describe('FilesystemNotReadyError', () => {
  it('includes the filesystem id in the message', () => {
    const err = new FilesystemNotReadyError('fs-1');
    expect(err.message).toBe('Filesystem "fs-1" is not ready. Call init() first or use ensureReady().');
    expect(err.code).toBe('ENOTREADY');
    expect(err.path).toBe('fs-1');
  });

  it('has the correct name', () => {
    expect(new FilesystemNotReadyError('fs-2').name).toBe('FilesystemNotReadyError');
  });
});
