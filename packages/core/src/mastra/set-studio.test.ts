import { describe, expect, it } from 'vitest';
import { Mastra } from './index';

describe('Mastra.setStudio()', () => {
  it('should set studio config on a Mastra instance with no initial studio', () => {
    const mastra = new Mastra({ logger: false });

    expect(mastra.getStudio()).toBeUndefined();

    const studioConfig = { auth: { name: 'test-auth' } };
    mastra.setStudio(studioConfig as any);

    expect(mastra.getStudio()).toEqual(studioConfig);
  });

  it('should replace existing studio config', () => {
    const initialConfig = { auth: { name: 'initial-auth' } };
    const mastra = new Mastra({ logger: false, studio: initialConfig as any });

    expect(mastra.getStudio()).toEqual(initialConfig);

    const updatedConfig = { auth: { name: 'updated-auth' } };
    mastra.setStudio(updatedConfig as any);

    expect(mastra.getStudio()).toEqual(updatedConfig);
  });

  it('should allow merging with existing studio config via spread', () => {
    const initialConfig = { auth: { name: 'test-auth' }, rbac: { roleMapping: {} } };
    const mastra = new Mastra({ logger: false, studio: initialConfig as any });

    mastra.setStudio({ ...mastra.getStudio(), auth: { name: 'new-auth' } } as any);

    expect(mastra.getStudio()).toEqual({ auth: { name: 'new-auth' }, rbac: { roleMapping: {} } });
  });
});
