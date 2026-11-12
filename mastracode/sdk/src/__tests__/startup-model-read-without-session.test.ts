import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { RequestContext } from '@mastra/core/request-context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resolveAuthenticatedCredentialTenant,
  setCredentialLogger,
  setCredentialStoreProvider,
} from '../agents/credential-resolver.js';
import { createMastraCodeAgentController } from '../index.js';

// No model is ever called here (every read fails before resolving one), so no aimock server is needed.
vi.setConfig({ testTimeout: 60_000 });

let directory: string;
let logError: ReturnType<typeof vi.fn>;

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'mastracode-startup-read-'));
  vi.stubEnv('MASTRA_APP_DATA_DIR', path.join(directory, 'app-data'));
  vi.stubEnv('MASTRACODE_DISABLE_UNIX_SOCKET_PUBSUB', '1');
  vi.stubEnv('MASTRACODE_DISABLE_OBSERVATIONAL_MEMORY', '1');
  logError = vi.fn();
  setCredentialLogger({ error: logError });
  // A deployed host like Mastra Factory: a tenant exists only for a signed-in user.
  setCredentialStoreProvider(
    () => undefined,
    async requestContext => resolveAuthenticatedCredentialTenant(requestContext),
  );
});

afterEach(() => {
  setCredentialStoreProvider(undefined);
  setCredentialLogger(undefined);
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

describe('reading the code agent model', () => {
  it('fails with "No model available" and no tenant error when there is no controller session', async () => {
    const { codeAgent } = await createMastraCodeAgentController({ cwd: directory, disableEnvFile: true });

    await expect(codeAgent.getModel({ requestContext: new RequestContext() })).rejects.toThrow(/No model available/);
    await expect(codeAgent.getModelList(new RequestContext())).rejects.toThrow(/No model available/);
    expect(logError).not.toHaveBeenCalled();
  });

  it('still runs the tenant check for a controller session without a signed-in user', async () => {
    const { codeAgent } = await createMastraCodeAgentController({ cwd: directory, disableEnvFile: true });
    const requestContext = new RequestContext();
    requestContext.set('controller', { resourceId: 'resource-a', threadId: 'thread-a' });

    await expect(codeAgent.getModel({ requestContext })).rejects.toThrow(/no authenticated user/);
    expect(logError).toHaveBeenCalledOnce();
    expect(logError).toHaveBeenCalledWith(
      '[MastraCode] Tenant model credential policy could not be resolved',
      expect.objectContaining({ reason: 'missing-user-context', hasControllerThread: true }),
    );
  });
});
