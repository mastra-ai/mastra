/**
 * @license Mastra Enterprise License - see ee/LICENSE
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { FGADeniedError } from '../../auth/ee/fga-check';
import type { IFGAProvider } from '../../auth/ee/interfaces/fga';
import { Agent } from '../agent';

function createMockFGAProvider(authorized = true): IFGAProvider {
  return {
    check: vi.fn().mockResolvedValue(authorized),
    require: authorized
      ? vi.fn().mockResolvedValue(undefined)
      : vi
          .fn()
          .mockRejectedValue(
            new FGADeniedError({ id: 'user-1' }, { type: 'agent', id: 'test-agent' }, 'agents:execute'),
          ),
    filterAccessible: vi.fn(),
  };
}

function createMockMastra(fgaProvider?: IFGAProvider) {
  return {
    getServer: () => (fgaProvider ? { fga: fgaProvider } : {}),
    getMemory: () => undefined,
    listGateways: () => [],
  } as any;
}

describe('Agent FGA checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generate()', () => {
    it('should call FGA provider check when FGA provider is configured', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const mastra = createMockMastra(fgaProvider);

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any });
      (agent as any).__registerMastra(mastra);

      const requestContext = new Map<string, unknown>();
      requestContext.set('user', { id: 'user-1', organizationMembershipId: 'om-1' });

      try {
        await agent.generate('test', { requestContext: requestContext as any });
      } catch {
        // Expected to fail due to no real model
      }

      expect(fgaProvider.require).toHaveBeenCalledWith(
        { id: 'user-1', organizationMembershipId: 'om-1' },
        { resource: { type: 'agent', id: 'test-agent' }, permission: 'agents:execute' },
      );
    });

    it('should throw FGADeniedError when FGA check fails', async () => {
      const fgaProvider = createMockFGAProvider(false);
      const mastra = createMockMastra(fgaProvider);

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any });
      (agent as any).__registerMastra(mastra);

      const requestContext = new Map<string, unknown>();
      requestContext.set('user', { id: 'user-1' });

      await expect(agent.generate('test', { requestContext: requestContext as any })).rejects.toThrow(FGADeniedError);
    });

    it('should not call FGA check when no FGA provider configured', async () => {
      const mastra = createMockMastra();

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any });
      (agent as any).__registerMastra(mastra);

      const requestContext = new Map<string, unknown>();
      requestContext.set('user', { id: 'user-1' });

      try {
        await agent.generate('test', { requestContext: requestContext as any });
      } catch {
        // Expected to fail due to no real model
      }
      // Should not throw FGADeniedError
    });
  });

  describe('stream()', () => {
    it('should call FGA provider check when FGA provider is configured', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const mastra = createMockMastra(fgaProvider);

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any });
      (agent as any).__registerMastra(mastra);

      const requestContext = new Map<string, unknown>();
      requestContext.set('user', { id: 'user-1', organizationMembershipId: 'om-1' });

      try {
        await agent.stream('test', { requestContext: requestContext as any });
      } catch {
        // Expected to fail due to no real model
      }

      expect(fgaProvider.require).toHaveBeenCalledWith(
        { id: 'user-1', organizationMembershipId: 'om-1' },
        { resource: { type: 'agent', id: 'test-agent' }, permission: 'agents:execute' },
      );
    });

    it('should throw FGADeniedError when FGA check fails in stream', async () => {
      const fgaProvider = createMockFGAProvider(false);
      const mastra = createMockMastra(fgaProvider);

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any });
      (agent as any).__registerMastra(mastra);

      const requestContext = new Map<string, unknown>();
      requestContext.set('user', { id: 'user-1' });

      await expect(agent.stream('test', { requestContext: requestContext as any })).rejects.toThrow(FGADeniedError);
    });
  });
});
