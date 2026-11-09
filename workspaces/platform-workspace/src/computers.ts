import { hkdfSync } from 'node:crypto';
import { createSemanticHands, withSemantic } from '@mastra/computer-semantic';
import type { DaemonConnect } from '@mastra/computer-semantic';
import { Computers } from '@mastra/core/computers';
import type {
  ComputerControlSubscriber,
  ComputerProvider,
  ComputerSandbox,
  ComputersOptions,
} from '@mastra/core/computers';
import type { MastraComputerScope, MastraComputerViewer } from '@mastra/core/mastra';
import { PlatformComputerControlSubscriber } from './computer-control.js';
import type { PlatformComputerControlEnforcementOptions } from './computer-control.js';
import { COMPUTER_VIEWER_PORT } from './computer.js';
import { PlatformSandbox } from './sandbox.js';
import type { PlatformSandboxOptions, PlatformSandboxTemplate } from './sandbox.js';
import { Template, withDesktop } from './template.js';

export type { ComputerSandbox } from '@mastra/core/computers';
export {
  DESTROY_FAILED,
  HUMAN_HAS_CONTROL,
  MISSING_IDENTITY,
  NOT_ATTACHED,
  NOT_FOUND,
  UNAVAILABLE,
} from '@mastra/core/computers';

export interface PlatformComputersOptions {
  environmentId?: string;
  accessToken?: string;
  projectId?: string;
  secret?: string;
  screenshotAfterAction?: boolean;
  template?: PlatformSandboxTemplate | false;
  hands?: 'pixel' | 'semantic';
  /** @internal Test seam for the sandbox driver. */
  createSandbox?: (options: PlatformSandboxOptions) => ComputerSandbox;
  /** @internal Test seam for the daemon socket. */
  connectDaemon?: DaemonConnect;
  /** Required Platform projection of core's authoritative control revision. */
  controlEnforcement?: PlatformComputerControlEnforcementOptions;
}

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  return values.find(value => typeof value === 'string' && value.trim().length > 0);
}

function assertExperimentalComputerEnabled(): void {
  if (process.env.MASTRA_EXPERIMENTAL_COMPUTER !== 'true') {
    throw new Error('PlatformComputers is experimental; set MASTRA_EXPERIMENTAL_COMPUTER=true to enable it');
  }
}

function computerSecret(options: PlatformComputersOptions): string | Uint8Array {
  const secret = firstNonEmpty(options.secret, process.env.MASTRA_COMPUTERS_SECRET);
  if (secret) return secret;
  const accessToken = firstNonEmpty(
    options.accessToken,
    process.env.MASTRA_PLATFORM_ACCESS_TOKEN,
    process.env.MASTRA_PLATFORM_SECRET_KEY,
  );
  if (!accessToken) {
    throw new Error('PlatformComputers needs a secret (set MASTRA_COMPUTERS_SECRET or an access token)');
  }
  return Buffer.from(
    hkdfSync('sha256', Buffer.from(accessToken, 'utf8'), 'mastra-computers', 'mastra-computers-v1', 32),
  );
}

type PlatformComputerSandbox = ComputerSandbox & {
  getPortAuthCookie(port: number): Promise<{ name: string; value: string } | null>;
  createComputerEmbed?(origin: string, mode: 'watch' | 'control'): Promise<string | null>;
  setComputerEmbedMode?(mode: 'view' | 'control', signal: AbortSignal): Promise<void>;
};

class PlatformComputerEmbedControlSubscriber implements ComputerControlSubscriber {
  readonly id = 'platform-computer-embed-control';
  readonly required = true;

  constructor(
    private readonly sandboxes: Set<PlatformComputerSandbox>,
    private readonly embedded: WeakSet<PlatformComputerSandbox>,
  ) {}

  async enforce(input: Parameters<ComputerControlSubscriber['enforce']>[0]) {
    const sandboxId = (input.identity as { sandboxId?: unknown })?.sandboxId;
    const sandbox = [...this.sandboxes].find(candidate => candidate.sandboxId === sandboxId);
    if (!sandbox || !this.embedded.has(sandbox) || !sandbox.setComputerEmbedMode) {
      return { status: 'enforced' as const, enforcedRevision: input.control.revision };
    }
    try {
      await sandbox.setComputerEmbedMode(input.control.holder === 'human' ? 'control' : 'view', input.signal);
      return { status: 'enforced' as const, enforcedRevision: input.control.revision };
    } catch (error) {
      return { status: 'retryable' as const, error: String((error as Error)?.message ?? error) };
    }
  }
}

function platformProvider(
  options: PlatformComputersOptions,
  sandboxes: Set<PlatformComputerSandbox>,
  embedded: WeakSet<PlatformComputerSandbox>,
): ComputerProvider {
  const semantic = options.hands === 'semantic';
  if (semantic && options.template === false) {
    throw new Error("PlatformComputers hands: 'semantic' needs a template to install the accessibility daemon into");
  }
  const base = options.template === false ? undefined : options.template;
  const template: PlatformSandboxTemplate | false | undefined = !semantic
    ? options.template
    : async () => {
        const resolved = typeof base === 'function' ? await base() : base;
        return withSemantic(withDesktop(resolved ?? Template())) as ReturnType<typeof withDesktop>;
      };
  const sandboxOptions: PlatformSandboxOptions = {
    ...(options.environmentId !== undefined && { environmentId: options.environmentId }),
    ...(options.accessToken !== undefined && { accessToken: options.accessToken }),
    ...(options.projectId !== undefined && { projectId: options.projectId }),
    ...(template !== false && { template: template ?? (() => withDesktop(Template())) }),
  };
  const createSandbox = options.createSandbox ?? (opts => new PlatformSandbox(opts) as unknown as ComputerSandbox);
  return {
    id: 'platform',
    macContext: options.environmentId ?? process.env.MASTRA_ENVIRONMENT_ID ?? '',
    create(input) {
      const sandbox = createSandbox({
        ...sandboxOptions,
        computer: true,
        ...(input.sandboxId !== undefined && { sandboxId: input.sandboxId }),
        ...(input.reattach !== undefined && { reattach: input.reattach }),
      }) as PlatformComputerSandbox;
      sandboxes.add(sandbox);
      return sandbox;
    },
    async viewer(sandbox: ComputerSandbox, _scope: MastraComputerScope): Promise<MastraComputerViewer | null> {
      const platformSandbox = sandbox as PlatformComputerSandbox;
      const url = await platformSandbox.computer?.streamUrl?.();
      if (!url) return null;
      const cookie = await platformSandbox.getPortAuthCookie(COMPUTER_VIEWER_PORT);
      if (!cookie) return null;
      return { url, headers: { cookie: `${cookie.name}=${cookie.value}` } };
    },
    async port(sandbox, port) {
      const platformSandbox = sandbox as PlatformComputerSandbox;
      const url = await platformSandbox.networking?.getPortUrl(port);
      if (!url) return null;
      const cookie = await platformSandbox.getPortAuthCookie(port);
      const headers: Record<string, string> = cookie ? { cookie: `${cookie.name}=${cookie.value}` } : {};
      return { url, headers };
    },
    async embed(sandbox, request) {
      const platformSandbox = sandbox as PlatformComputerSandbox;
      if (!platformSandbox.createComputerEmbed) return null;
      const url = await platformSandbox.createComputerEmbed(request.origin, request.mode);
      if (url) embedded.add(platformSandbox);
      return url;
    },
  };
}

/** Agent computers hosted by Mastra Platform. Platform owns provisioning, viewer auth, and control enforcement. */
export class PlatformComputers extends Computers {
  readonly #controlSubscriber?: PlatformComputerControlSubscriber;
  readonly #disposeControlSubscriber?: () => void;

  constructor(options: PlatformComputersOptions = {}) {
    assertExperimentalComputerEnabled();
    const sandboxes = new Set<PlatformComputerSandbox>();
    const embedded = new WeakSet<PlatformComputerSandbox>();
    const generic: ComputersOptions = {
      provider: platformProvider(options, sandboxes, embedded),
      secret: computerSecret(options),
      ...(options.screenshotAfterAction !== undefined && { screenshotAfterAction: options.screenshotAfterAction }),
      ...(options.hands === 'semantic' && {
        handsExtension: createSemanticHands({ connectDaemon: options.connectDaemon }),
      }),
    };
    super(generic);
    this.registerControlSubscriber(new PlatformComputerEmbedControlSubscriber(sandboxes, embedded));
    if (options.controlEnforcement) {
      this.#controlSubscriber = new PlatformComputerControlSubscriber(options.controlEnforcement);
      this.#disposeControlSubscriber = this.registerControlSubscriber(this.#controlSubscriber);
    }
  }

  /** Stop accepting remote enforcement work and release this registration owner. */
  closeControlEnforcement(): void {
    this.#controlSubscriber?.close();
    this.#disposeControlSubscriber?.();
  }
}
