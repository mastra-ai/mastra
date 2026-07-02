import { describe, expect, it } from 'vitest';

import { MesaFilesystem } from './filesystem';
import { mesaFilesystemProvider } from './provider';

describe('mesaFilesystemProvider', () => {
  it('describes the Mesa filesystem provider', () => {
    expect(mesaFilesystemProvider.id).toBe('mesa');
    expect(mesaFilesystemProvider.name).toBe('Mesa');
    expect(mesaFilesystemProvider.configSchema).toEqual(
      expect.objectContaining({
        type: 'object',
        required: ['repos'],
      }),
    );
  });

  it('requires at least one repo in provider config', () => {
    expect(mesaFilesystemProvider.configSchema.properties?.repos).toEqual(
      expect.objectContaining({
        type: 'array',
        minItems: 1,
      }),
    );
  });

  it('creates MesaFilesystem instances', () => {
    const filesystem = mesaFilesystemProvider.createFilesystem({
      repos: [{ name: 'docs', bookmark: 'main' }],
    });

    expect(filesystem).toBeInstanceOf(MesaFilesystem);
    expect(filesystem.provider).toBe('mesa');
  });
});
