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
        required: ['authors', 'layout'],
      }),
    );
  });

  it('requires at least one author in provider config', () => {
    expect(mesaFilesystemProvider.configSchema.properties?.authors).toEqual(
      expect.objectContaining({
        type: 'array',
        minItems: 1,
      }),
    );
  });

  it('creates MesaFilesystem instances', () => {
    const filesystem = mesaFilesystemProvider.createFilesystem({
      authors: [{ name: 'Mastra Agent' }],
      layout: { '/docs': { kind: 'repo', name: 'docs', mode: 'rw' } },
    });

    expect(filesystem).toBeInstanceOf(MesaFilesystem);
    expect(filesystem.provider).toBe('mesa');
  });
});
