import { describe, expect, it, vi } from 'vitest';

const { connect, getTursoDatabaseSupport } = vi.hoisted(() => ({
  connect: vi.fn(),
  getTursoDatabaseSupport: vi.fn(() => ({
    supported: false,
    platform: 'darwin' as const,
    arch: 'x64',
    reason: 'Turso Database does not provide a native binding for darwin/x64.',
  })),
}));

vi.mock('@tursodatabase/database', () => ({ connect }));
vi.mock('./support', () => ({ getTursoDatabaseSupport }));

import { TursoStore } from './index';

describe('TursoStore platform guard', () => {
  it('fails before loading the native database on unsupported platforms', () => {
    expect(() => new TursoStore({ id: 'unsupported', path: '/tmp/unsupported.db' })).toThrow(
      'Turso Database does not provide a native binding for darwin/x64.',
    );
    expect(connect).not.toHaveBeenCalled();
  });
});
