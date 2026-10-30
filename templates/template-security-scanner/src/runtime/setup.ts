import { loadSettings, morphModelDescriptor, type Settings } from '../config/settings.js';
import { buildLocalImage, preflight, reconcileOwnedSandboxes, releaseImage } from './docker.js';
import { withSetupLock, writeReceipt } from './files.js';
import { probeSandbox } from './sandbox.js';
import { initializeStorage } from '../http/server.js';
import { prepareDiscoveryCapability } from '../discovery/capability.js';

export async function setup(settings: Settings = loadSettings(), signal?: AbortSignal) {
  const environment = await preflight(settings);
  signal?.throwIfAborted();
  return withSetupLock(settings, async () => {
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
  });
}
