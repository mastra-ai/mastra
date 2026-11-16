/**
 * ModalSandbox against the real `modal` SDK, with only the network replaced.
 *
 * `sandbox.test.ts` mocks the whole SDK, so it cannot see what the SDK itself
 * does with the options: its validation and its translation into the
 * `SandboxCreateRequest` that goes to Modal. Here the real `ModalClient` and the
 * real `client.sandboxes.create()` run, and only the control-plane gRPC client is
 * swapped for an in-memory fake that records each request. The fake is passed
 * through the SDK's own `cpClient` option on `ModalClient`.
 */

import { Image, NotFoundError, Sandbox } from 'modal';
import type { ModalClient as RealModalClient, ModalClientParams } from 'modal';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ControlPlane = NonNullable<ModalClientParams['cpClient']>;
type RecordedCall = { rpc: string; request: unknown };

const fake = vi.hoisted(() => {
  // Keep a developer's ~/.modal.toml out of the profile the SDK builds.
  process.env.MODAL_CONFIG_PATH = '/nonexistent/mastra-modal-test.toml';
  return {
    calls: [] as RecordedCall[],
    cpClient: undefined as unknown,
    lastClient: undefined as RealModalClient | undefined,
  };
});

vi.mock('modal', async importOriginal => {
  const actual = await importOriginal<typeof import('modal')>();
  // ModalSandbox builds its own ModalClient; hand every one the fake control plane.
  class ModalClient extends actual.ModalClient {
    constructor(params?: ModalClientParams) {
      super({ ...params, cpClient: fake.cpClient as ControlPlane });
      fake.lastClient = this;
    }
  }
  return { ...actual, ModalClient };
});

// Import after mock registration
// oxlint-disable-next-line mastra/import-order
import { ModalSandbox } from './index';

/**
 * Answers each control-plane RPC the SDK makes on the create, stop and resume
 * paths, as Modal would for an app with no running sandbox of that name.
 * Any other RPC fails the test with its name, so a new SDK call is visible.
 */
function fakeControlPlane(): ControlPlane {
  const responses: Record<string, (request: unknown) => unknown> = {
    sandboxGetFromName: () => {
      // The SDK turns gRPC NOT_FOUND into this error and passes it through as is.
      throw new NotFoundError('no running sandbox');
    },
    sandboxGetFromNameV2: () => {
      throw new NotFoundError('no running sandbox');
    },
    appGetOrCreate: () => ({ appId: 'ap-test' }),
    environmentGetOrCreate: () => ({
      environmentId: 'en-test',
      metadata: { name: 'main', settings: { imageBuilderVersion: '2024.10', webhookSuffix: '' } },
    }),
    imageGetOrCreate: () => ({ imageId: 'im-registry', result: { status: 1 } }),
    sandboxCreate: () => ({ sandboxId: 'sb-test' }),
    sandboxCreateV2: () => ({ sandboxId: 'sb-test', taskId: 'ta-test', tunnels: [] }),
    sandboxGetTaskIdV2: () => ({ taskId: 'ta-test' }),
    sandboxTerminateV2: () => ({}),
    sandboxWaitV2: () => ({ result: { status: 3, exitcode: 0 } }),
  };
  const handler: ProxyHandler<object> = {
    get(_target, rpc) {
      if (typeof rpc !== 'string') return undefined;
      return async (request: unknown) => {
        fake.calls.push({ rpc, request });
        const respond = responses[rpc];
        if (!respond) throw new Error(`fake Modal control plane: unexpected RPC ${rpc}`);
        return respond(request);
      };
    },
  };
  // The SDK only calls RPC methods on this client, and the Proxy answers any of them.
  return new Proxy({}, handler) as ControlPlane;
}

/** The SandboxCreateRequest bodies the SDK sent, in order. */
function createRequests(): unknown[] {
  return fake.calls.filter(c => c.rpc === 'sandboxCreate' || c.rpc === 'sandboxCreateV2').map(c => c.request);
}

// Modal 0.11.1 sends sandboxCreateV2 by default (MODAL_SANDBOX_V2 unset) and
// sandboxCreate when MODAL_SANDBOX_V2=0. Both build the definition the same way.
describe.each([
  { sdkPath: 'default (V2)', sandboxV2: '1' },
  { sdkPath: 'V1', sandboxV2: '0' },
])('ModalSandbox create request through the real modal SDK, $sdkPath path (#30369)', ({ sandboxV2 }) => {
  beforeEach(() => {
    vi.stubEnv('MODAL_SANDBOX_V2', sandboxV2);
    fake.calls.length = 0;
    fake.cpClient = fakeControlPlane();
    fake.lastClient = undefined;
    // stop() takes a filesystem snapshot over the task command router, a second
    // gRPC connection that `cpClient` does not cover. Answer it with the Image
    // the SDK itself would build from the router's reply.
    vi.spyOn(Sandbox.prototype, 'snapshotFilesystem').mockImplementation(async () => {
      if (!fake.lastClient) throw new Error('no ModalClient was created');
      return new Image(fake.lastClient, 'im-snapshot', '');
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // The issue's repro: a 1-minute idle window on a template with a 1-hour lifetime.
  // Before the fix Modal received timeoutSecs: 60 and no idleTimeoutSecs, so the
  // clone was killed a minute after start even while a command ran.
  it('a clone with idleTimeoutMinutes: 1 asks Modal for a 60s idle timeout and a 1h lifetime', async () => {
    const template = new ModalSandbox({ tokenId: 'tid', tokenSecret: 'tsec', timeoutMs: 60 * 60_000 });
    const clone = template.clone({ id: 'x', idleTimeoutMinutes: 1 });

    await clone._start();

    const [request] = createRequests();
    expect(createRequests()).toHaveLength(1);
    expect(request).toMatchObject({
      appId: 'ap-test',
      definition: { name: 'x', imageId: 'im-registry', timeoutSecs: 3600, idleTimeoutSecs: 60 },
    });
  });

  it('the same clone keeps both timeouts when it resumes from its snapshot after stop()', async () => {
    const template = new ModalSandbox({ tokenId: 'tid', tokenSecret: 'tsec', timeoutMs: 60 * 60_000 });
    const clone = template.clone({ id: 'x', idleTimeoutMinutes: 1 });

    await clone._start();
    await clone._stop();
    await clone._start();

    const requests = createRequests();
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatchObject({
      definition: { name: 'x', imageId: 'im-snapshot', timeoutSecs: 3600, idleTimeoutSecs: 60 },
    });
  });

  // The default template lifetime is 5 minutes, shorter than a 15-minute idle
  // window, so clone() raises the lifetime to the idle window.
  it('a default-template clone with idleTimeoutMinutes: 15 gets a 15m lifetime and idle timeout', async () => {
    const template = new ModalSandbox({ tokenId: 'tid', tokenSecret: 'tsec' });
    const clone = template.clone({ id: 'x', idleTimeoutMinutes: 15 });

    await clone._start();

    const [request] = createRequests();
    expect(request).toMatchObject({ definition: { name: 'x', timeoutSecs: 900, idleTimeoutSecs: 900 } });
  });

  it('a sandbox with no idle timeout asks Modal for none', async () => {
    const sandbox = new ModalSandbox({ tokenId: 'tid', tokenSecret: 'tsec', timeoutMs: 60 * 60_000 });

    await sandbox._start();

    const [request] = createRequests();
    expect(request).toMatchObject({ definition: { timeoutSecs: 3600 } });
    expect(request).not.toMatchObject({ definition: { idleTimeoutSecs: expect.anything() } });
  });
});
