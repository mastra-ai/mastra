import type { ConnectionCredential } from '@mastra/connect';

import type { InstallationInput, RepositoryInput, VersionControl } from '../../../capabilities/version-control.js';
import type {
  SourceControlInstallation,
  SourceControlProviderMetadata,
  SourceControlRepository,
  SourceControlStorageHandle,
} from '../../../storage/domains/source-control/base.js';
import type { PlatformConnection } from './connect-binding.js';
import type { PlatformConnectIntegration } from './integration.js';

/** A Platform connection with the credential Connect issued for it. */
export interface PlatformConnectionCredential {
  connection: PlatformConnection;
  credential: ConnectionCredential;
}

/**
 * Base class for the version control of a {@link PlatformConnectIntegration}.
 * It owns what every Platform version control shares: mirroring the
 * provider's installations and repositories into source-control storage,
 * keyed by the provider's `externalId`, and reaching a connection's
 * credential through the integration's project-scoped listing. Repository
 * operations are provider-specific: a subclass implements the rest of
 * {@link VersionControl}.
 *
 * The constructor only stores its argument, so a subclass can be created in
 * a field initializer of its integration.
 */
export abstract class PlatformVersionControlCapability implements Pick<
  VersionControl,
  'initialize' | 'registerInstallation' | 'registerRepositories'
> {
  readonly #integration: PlatformConnectIntegration;
  #storage: SourceControlStorageHandle | undefined;

  constructor(integration: PlatformConnectIntegration) {
    this.#integration = integration;
  }

  initialize({ storage }: { storage: SourceControlStorageHandle }): void {
    this.#storage = storage;
  }

  get storage(): SourceControlStorageHandle {
    if (!this.#storage) {
      throw new Error(`${this.#integration.id} source-control storage has not been initialized.`);
    }
    return this.#storage;
  }

  registerInstallation({
    orgId,
    userId,
    installation,
  }: {
    orgId: string;
    userId: string;
    installation: InstallationInput;
  }): Promise<SourceControlInstallation> {
    return this.storage.installations.upsert({
      orgId,
      connectedByUserId: userId,
      externalId: installation.externalId,
      accountName: installation.accountName,
      accountType: installation.accountType,
      providerMetadata: installation.metadata,
    });
  }

  registerRepositories({
    orgId,
    installationId,
    repositories,
  }: {
    orgId: string;
    installationId: string;
    repositories: RepositoryInput[];
  }): Promise<SourceControlRepository[]> {
    return Promise.all(
      repositories.map(repository =>
        this.storage.repositories.upsert({
          orgId,
          input: {
            installationId,
            externalId: repository.externalId,
            slug: repository.slug,
            defaultBranch: repository.defaultBranch,
            providerMetadata: repository.metadata,
          },
        }),
      ),
    );
  }

  /**
   * Points the org's installation row for `fromExternalId` at the provider
   * installation `toExternalId`, keeping the row, so its repositories and
   * project links stay attached. Resolves null when the org has no such row.
   */
  async repointInstallation(input: {
    orgId: string;
    fromExternalId: string;
    toExternalId: string;
    providerMetadata?: SourceControlProviderMetadata;
  }): Promise<SourceControlInstallation | null> {
    const installation = await this.storage.installations.findByExternalId({
      orgId: input.orgId,
      externalId: input.fromExternalId,
    });
    if (!installation) return null;
    return this.storage.installations.repoint({
      orgId: input.orgId,
      id: installation.id,
      externalId: input.toExternalId,
      ...(input.providerMetadata ? { providerMetadata: input.providerMetadata } : {}),
    });
  }

  /** The org's repository with this provider repository id, whichever installation holds it. */
  findRepository(input: { orgId: string; externalId: string }): Promise<SourceControlRepository | null> {
    return this.storage.repositories.findByExternalId(input);
  }

  /**
   * The first active connection for `providerKey` that `predicate` accepts,
   * with the credential Connect issues for it, or null when none is active.
   */
  async connectionCredential(
    providerKey: string,
    predicate?: (connection: PlatformConnection) => boolean,
  ): Promise<PlatformConnectionCredential | null> {
    const connection = await this.#integration.connectionFor(providerKey, predicate);
    if (!connection) return null;
    return { connection, credential: await this.#integration.connect.getCredential(connection.id) };
  }
}
