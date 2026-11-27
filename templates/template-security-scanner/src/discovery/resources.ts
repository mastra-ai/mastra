import type Docker from 'dockerode';
import { randomUUID } from 'node:crypto';
import type { Settings } from '../config/settings.js';
import { dockerClient, ownerIdentity, OWNER_LABEL, INPUT_LABEL } from '../runtime/docker.js';
import { DiscoveryStore, type OwnedResource } from './store.js';

export const SCAN_LABEL = 'dev.mastra.security-scanner.scan';
export const RESOURCE_LABEL = 'dev.mastra.security-scanner.resource';
export class ScanResources {
  readonly client: Docker;
  constructor(
    private readonly settings: Settings,
    private readonly store: DiscoveryStore,
    readonly scanId: string,
  ) {
    this.client = dockerClient(settings);
  }
  /** Persist a resource ownership intent before creating its corresponding runtime object. */
  async intent(kind: Exclude<OwnedResource['kind'], 'image'>, imageId?: string) {
    const token = randomUUID(),
      name = `scanner-${kind}-${token}`;
    const resource: OwnedResource = { id: name, scanId: this.scanId, token, kind, ...(imageId ? { imageId } : {}) };
    await this.store.remember(resource);
    return {
      resource,
      name,
      labels: { [OWNER_LABEL]: ownerIdentity(this.settings), [SCAN_LABEL]: this.scanId, [RESOURCE_LABEL]: token },
    };
  }
  async container(options: Docker.ContainerCreateOptions, imageId: string) {
    const intent = await this.intent('container', imageId);
    const container = await this.client.createContainer({
      ...options,
      Image: imageId,
      name: intent.name,
      Labels: { ...options.Labels, ...intent.labels },
    });
    return { container, resource: intent.resource };
  }
  /** Create and record a scan-owned Docker network with its expected labels. */
  async network(internal: boolean) {
    const intent = await this.intent('network');
    const network = await this.client.createNetwork({
      Name: intent.name,
      Internal: internal,
      Driver: 'bridge',
      Labels: intent.labels,
    });
    const observed = await network.inspect();
    const subnet = observed.IPAM?.Config?.[0]?.Subnet;
    if (!subnet || !/^\d+\.\d+\.\d+\.0\/\d+$/.test(subnet)) throw new Error('NETWORK_ADDRESS_UNSUPPORTED');
    const prefix = subnet.slice(0, subnet.indexOf('/')).split('.').slice(0, 3).join('.');
    return { network, name: intent.name, address: (host: number) => `${prefix}.${host}`, resource: intent.resource };
  }
  /** Check that actual Docker resources match the scan's persisted ownership receipt. */
  async verify(resource: OwnedResource) {
    if (resource.kind === 'image') {
      const reference = resource.imageId ?? resource.id;
      const image = await this.client.getImage(reference).inspect();
      const acquiring = resource.id === `${resource.scanId}:acquiring:${reference}`;
      if (
        (acquiring ? !image.RepoTags?.includes(reference) : image.Id !== reference) ||
        image.Config.Labels?.[OWNER_LABEL] !== ownerIdentity(this.settings) ||
        image.Config.Labels?.[INPUT_LABEL] !== resource.token
      )
        throw new Error('RESOURCE_OWNERSHIP_CHANGED');
      return image;
    }
    const observed =
      resource.kind === 'container'
        ? await this.client.getContainer(resource.id).inspect()
        : await this.client.getNetwork(resource.id).inspect();
    const labels = 'Config' in observed ? observed.Config.Labels : observed.Labels;
    if (
      labels?.[OWNER_LABEL] !== ownerIdentity(this.settings) ||
      labels?.[SCAN_LABEL] !== resource.scanId ||
      labels?.[RESOURCE_LABEL] !== resource.token ||
      ('Config' in observed && observed.Image !== resource.imageId)
    )
      throw new Error('RESOURCE_OWNERSHIP_CHANGED');
    return observed;
  }
  /** Stop the scan's owned runtime resources while preserving cleanup error visibility. */
  async stop(resource: OwnedResource) {
    const observed = await this.verify(resource);
    if ('State' in observed && observed.State.Running) {
      await this.client.getContainer(resource.id).kill({ signal: 'SIGKILL' });
      await this.client.getContainer(resource.id).wait();
    }
  }
  /** Release only resources attributable to the scan's ownership and lifecycle receipts. */
  async cleanup(retainImageRecords = false) {
    let complete = true;
    for (const resource of (await this.store.resources(this.scanId)).reverse()) {
      try {
        const observed = await this.verify(resource);
        if (resource.kind === 'image' && retainImageRecords) continue;
        if (resource.kind === 'container') await this.client.getContainer(resource.id).remove({ force: true, v: true });
        else if (resource.kind === 'network') await this.client.getNetwork(resource.id).remove();
        else {
          const image = observed as Docker.ImageInspectInfo;
          const imageId = image.Id;
          // Another job's persisted receipt owns a shared image until that job
          // releases it. The last exact-owner receipt removes the image.
          const shared = (await this.store.resources()).some(
            other =>
              other.kind === 'image' &&
              other.scanId !== resource.scanId &&
              other.token === resource.token &&
              (other.imageId === imageId || (other.imageId !== undefined && image.RepoTags?.includes(other.imageId))),
          );
          if (shared) {
            await this.store.forget(resource.id);
            continue;
          }
          // A shared consumer owns its own lifecycle. Preserve both the image
          // and this deletion receipt so a later owned cleanup can finish it.
          if ((await this.client.listContainers({ all: true, filters: { ancestor: [imageId] } })).length) continue;
          if (resource.sharedBase && this.settings.DOCKER_RETAIN_SHARED_BASE_IMAGE) {
            await this.store.forget(resource.id);
            continue;
          }
          await this.client.getImage(imageId).remove({ force: false, noprune: true });
        }
        await this.store.forget(resource.id);
      } catch (error) {
        if ((error as { statusCode?: number }).statusCode === 404) await this.store.forget(resource.id);
        else complete = false;
      }
    }
    return complete;
  }
}
/** Reconcile interrupted scan resources using their persisted ownership and lifecycle receipts. */
export async function reconcileScans(settings: Settings, store: DiscoveryStore) {
  // Instance ownership must already be held before this function is called.
  for (const scan of await store.interrupted()) {
    const complete = await new ScanResources(settings, store, scan.id).cleanup();
    await store.update(scan.id, scan.owner, current => ({
      ...current,
      state:
        current.cleanup === 'DEBT' && ['FAILED', 'AUTH_REQUIRED'].includes(current.state) ? current.state : 'FAILED',
      reason: complete ? 'PROCESS_INTERRUPTED' : 'CLEANUP_FAILED',
      partial: true,
      cleanup: complete ? 'COMPLETE' : 'DEBT',
      budget: { remainingRequests: null, remainingBytes: null, exhausted: true, reason: 'unknown' },
    }));
  }
}
