import { loadSettings, morphModelDescriptor, RuntimeDiagnostic, type Settings } from '../config/settings.js';
import { buildLocalImage, preflight, reconcileOwnedSandboxes, releaseImage } from './docker.js';
import { withSetupLock, writeReceipt } from './files.js';
import { probeSandbox } from './sandbox.js';
import { initializeStorage } from '../http/server.js';
import { prepareDiscoveryCapability } from '../discovery/capability.js';
import { acquireInstance } from '../discovery/instance.js';
import { recoverInterruptedRestore } from './operations.js';

/** Validate supported runtime settings before preparing and probing the owned local sandbox. */
export async function setup(settings: Settings = loadSettings(), signal?: AbortSignal) {
  if (settings.DOCKER_PLATFORM !== 'linux/arm64')
    throw new RuntimeDiagnostic(
      'DISCOVERY_PLATFORM_UNSUPPORTED',
      'Discovery requires a native linux/arm64 Docker daemon.',
    );
  const environment = await preflight(settings);
  signal?.throwIfAborted();
  return withSetupLock(settings, async () => {
    const releaseInstance = await acquireInstance(settings);
    try {
      await recoverInterruptedRestore(settings);
      await reconcileOwnedSandboxes(settings);
      signal?.throwIfAborted();
      const image = await buildLocalImage(settings, signal);
      let imageDisposition: Awaited<ReturnType<typeof releaseImage>> | undefined;
      try {
        const sandbox = await probeSandbox(settings, image, signal);
        signal?.throwIfAborted();
        const { mastra, storage } = await initializeStorage(settings);
        try {
          await mastra.shutdown();
        } finally {
          await storage.close();
        }
        imageDisposition = await releaseImage(settings, image);
        const receipt = {
          ...image,
          environment,
          sandbox,
          discovery: await prepareDiscoveryCapability(settings, signal),
          imageDisposition,
          models: morphModelDescriptor(settings),
          scanningEnabled: false,
          completedAt: new Date().toISOString(),
        };
        await writeReceipt(settings, receipt);
        return receipt;
      } finally {
        if (imageDisposition === undefined) await releaseImage(settings, image);
      }
    } finally {
      await releaseInstance();
    }
  });
}
