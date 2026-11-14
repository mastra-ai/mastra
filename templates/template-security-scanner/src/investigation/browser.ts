import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import type { Settings } from '../config/settings.js';
import type { DiscoveryImages } from '../discovery/images.js';
import type { ScanResources } from '../discovery/resources.js';
import { control, stageFiles } from '../discovery/io.js';
import { privateNativeSandbox, type PrivateSandbox } from '../discovery/native.js';
import { verifyFirewall } from '../discovery/firewall.js';
import { browserCrossOriginRead, browserSandboxStatus, inspectBrowser } from '../discovery/browser.js';
import type { SecretGuard } from '../discovery/parser.js';
import type { ImageReceipt } from '../runtime/docker.js';
import { sandboxOptions } from '../runtime/sandbox.js';
import { BROWSER_FLAGS } from '../runtime/browser.js';

/** Run the authorized browser verification and preserve its result while draining the command process. */
export async function verifyBrowserRead(input: {
  settings: Settings;
  resources: ScanResources;
  images: DiscoveryImages;
  image: ImageReceipt;
  networkId: string;
  gatewayIp: string;
  port: number;
  url: string;
  marker: string;
  guard: SecretGuard;
  signal: AbortSignal;
}) {
  const { settings, resources, images, image, signal } = input;
  const common = {
    CapDrop: ['ALL'],
    SecurityOpt: ['no-new-privileges:true'],
    Memory: 268435456,
    MemorySwap: 268435456,
    PidsLimit: 64,
    LogConfig: { Type: 'none', Config: {} },
    Init: true,
  };
  const anchor = await resources.container(
    {
      Entrypoint: [],
      Cmd: ['sleep', 'infinity'],
      HostConfig: {
        ...common,
        NetworkMode: input.networkId,
        Sysctls: { 'net.ipv4.ip_local_port_range': '40000 40031' },
      },
    },
    images.firewall,
  );
  await anchor.container.start();
  const anchorState = await anchor.container.inspect();
  if (
    anchorState.HostConfig.Sysctls?.['net.ipv4.ip_local_port_range'] !== '40000 40031' ||
    anchorState.HostConfig.Privileged ||
    (anchorState.HostConfig.CapAdd ?? []).length ||
    anchorState.HostConfig.LogConfig?.Type !== 'none'
  )
    throw new Error('BROWSER_ANCHOR_POLICY');
  const helper = await resources.container(
    {
      Entrypoint: [],
      Cmd: ['sleep', '10'],
      HostConfig: {
        ...common,
        NetworkMode: `container:${anchor.container.id}`,
        CapAdd: ['NET_ADMIN'],
        ReadonlyRootfs: true,
      },
    },
    images.firewall,
  );
  try {
    await helper.container.start();
    const result = await control(
      helper.container,
      ['/bin/sh', '/opt/scanner/install-firewall.sh', input.gatewayIp, String(input.port)],
      7000,
      signal,
    );
    if (!result.success) throw new Error('BROWSER_FIREWALL_UNAVAILABLE');
    verifyFirewall(JSON.parse(result.stdout), input.gatewayIp, input.port);
    const state = await helper.container.inspect();
    const capabilities = await control(helper.container, ['cat', '/proc/self/status'], 2000, signal);
    if (
      !capabilities.success ||
      !/^CapEff:\s+0*1000$/m.test(capabilities.stdout) ||
      !/^CapBnd:\s+0*1000$/m.test(capabilities.stdout) ||
      !/^NoNewPrivs:\s+1$/m.test(capabilities.stdout) ||
      !/^Seccomp:\s+2$/m.test(capabilities.stdout) ||
      state.HostConfig.CapAdd?.map((name: string) => name.replace(/^CAP_/, '')).join(',') !== 'NET_ADMIN' ||
      state.HostConfig.Privileged ||
      state.HostConfig.LogConfig?.Type !== 'none'
    )
      throw new Error('BROWSER_HELPER_CAPABILITY');
  } finally {
    await resources.stop(helper.resource);
    await helper.container.remove({ force: true, v: true });
  }
  let sandbox: PrivateSandbox | undefined;
  let running: Promise<unknown> | undefined;
  try {
    const intent = await resources.intent('container', image.imageId);
    const options = sandboxOptions(settings, image, intent.name);
    sandbox = await privateNativeSandbox(resources.client, {
      ...options,
      network: `container:${anchor.container.id}`,
      labels: { ...options.labels, ...intent.labels },
    });
    await stageFiles(
      sandbox.container,
      {
        'browser-inspect.sh': {
          bytes: await readFile(join(settings.root, 'scripts/runtime/browser-inspect.sh')),
          mode: 0o700,
        },
      },
      false,
      signal,
    );
    const created = await sandbox.executeCommand('mkdir', ['-p', '-m', '700', '/workspace/private-tmp'], {
      timeout: 3000,
      maxRetainedBytes: 0,
      abortSignal: signal,
    });
    if (!created.success) throw new Error('BROWSER_PRIVATE_DIRECTORY');
    let finished = false;
    running = sandbox
      .executeCommand(
        '/usr/local/bin/scanner-chromium',
        [
          ...BROWSER_FLAGS,
          '--remote-debugging-address=127.0.0.1',
          '--remote-debugging-port=9222',
          '--proxy-bypass-list=<-loopback>',
          `--proxy-server=http://${input.gatewayIp}:${input.port}`,
          'about:blank',
        ],
        { timeout: 30000, maxRetainedBytes: 0, abortSignal: signal },
      )
      .finally(() => {
        finished = true;
      });
    void running.catch(() => undefined);
    // Never retain browser stdout/stderr. Only fixed normalized CDP results leave
    // the owned browser; native retained process buffers are disabled.
    for (let attempt = 0; attempt < 80; attempt++) {
      signal.throwIfAborted();
      if (finished) throw new Error('BROWSER_EXITED_BEFORE_PROOF');
      const observed = await inspectBrowser(sandbox, input.guard, signal);
      if (observed.roots && observed.browserProcesses) {
        await browserSandboxStatus(sandbox, signal);
        return await browserCrossOriginRead(sandbox, signal, input.url, input.marker);
      }
      await pause(100, undefined, { signal });
    }
    throw new Error('BROWSER_START_TIMEOUT');
  } finally {
    try {
      if (sandbox) await sandbox.destroy();
    } finally {
      await running?.catch(() => undefined);
    }
  }
}
