import { describe, expect, it } from 'vitest';
import { Mastra } from './index';

describe('Mastra.setServer()', () => {
  it('should set server config on a Mastra instance with no initial server', () => {
    const mastra = new Mastra({ logger: false });

    expect(mastra.getServer()).toBeUndefined();

    const serverConfig = { port: 3000 };
    mastra.setServer(serverConfig as any);

    expect(mastra.getServer()).toEqual(serverConfig);
  });

  it('should replace existing server config', () => {
    const initialConfig = { port: 3000 };
    const mastra = new Mastra({ logger: false, server: initialConfig as any });

    expect(mastra.getServer()).toEqual(initialConfig);

    const updatedConfig = { port: 4000 };
    mastra.setServer(updatedConfig as any);

    expect(mastra.getServer()).toEqual(updatedConfig);
  });

  it('should allow merging with existing server config via spread', () => {
    const initialConfig = { port: 3000, timeout: 5000 };
    const mastra = new Mastra({ logger: false, server: initialConfig as any });

    mastra.setServer({ ...mastra.getServer(), port: 8080 } as any);

    expect(mastra.getServer()).toEqual({ port: 8080, timeout: 5000 });
  });
});
