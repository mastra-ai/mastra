import type { IntegrationConnection } from '../../../capabilities/connection.js';
import type {
  CreateIntakeCommentInput,
  CreatedIntakeComment,
  GetIntakeIssueInput,
  Intake,
  IntakeIssue,
  IntakeIssueDetail,
  IntakeIssuePage,
  IntakeItemPage,
  IntakeSource,
  ListIntakeIssuesInput,
  ListIntakeItemsInput,
  ListIntakeSourcesInput,
  ResolveIntakeDispatchInput,
  ResolvedIntakeDispatch,
  UpdateIntakeIssueInput,
} from '../../../capabilities/intake.js';
import type { PlatformConnection } from './connect-binding.js';
import type { PlatformConnectIntegration } from './integration.js';

/**
 * Base class for the intake of a {@link PlatformConnectIntegration}. It owns
 * what every Platform intake shares: the connection token that carries a
 * Platform connection id through intake storage, and resolving that id to an
 * active connection. Source ids, paging, dispatch resolution and issue
 * mapping are provider-specific and stay in the subclass.
 *
 * The constructor only stores its arguments, so a subclass can be created in
 * a field initializer of its integration before the integration's
 * constructor body has run.
 */
export abstract class PlatformIntakeCapability implements Intake {
  readonly #integration: PlatformConnectIntegration;
  readonly #connectionTokenPrefix: string;

  constructor(integration: PlatformConnectIntegration, connectionTokenPrefix: string) {
    this.#integration = integration;
    this.#connectionTokenPrefix = connectionTokenPrefix;
  }

  /** The intake connection that names a Platform connection. */
  connectionCredential(connectionId: string): IntegrationConnection {
    return { type: 'oauth', accessToken: `${this.#connectionTokenPrefix}${connectionId}` };
  }

  /** The Platform connection id an intake connection names, if it names one. */
  connectionIdOf(connection: IntegrationConnection): string | null {
    if (connection.type !== 'oauth' || !connection.accessToken.startsWith(this.#connectionTokenPrefix)) return null;
    return connection.accessToken.slice(this.#connectionTokenPrefix.length) || null;
  }

  /**
   * The active connection with this id. A caller-supplied id is only a claim,
   * so anything that isn't an active connection of the integration throws
   * {@link notConnectedError} before a proxy request is made with it.
   */
  protected async activeConnectionById(connectionId: string): Promise<PlatformConnection> {
    const connection = (await this.#integration.listConnections()).find(
      candidate => candidate.id === connectionId && candidate.status === 'active',
    );
    if (!connection) throw this.notConnectedError(connectionId);
    return connection;
  }

  /** The provider's error for a connection that is missing or needs reauthentication. */
  protected abstract notConnectedError(connectionId: string): Error;

  abstract resolveIntakeDispatch(input: ResolveIntakeDispatchInput): Promise<ResolvedIntakeDispatch | null>;
  abstract listSources(input: ListIntakeSourcesInput): Promise<IntakeSource[]>;
  abstract listItems(input: ListIntakeItemsInput): Promise<IntakeItemPage>;
  abstract listIssues(input: ListIntakeIssuesInput): Promise<IntakeIssuePage>;
  abstract getIssue(input: GetIntakeIssueInput): Promise<IntakeIssueDetail | null>;
  abstract createComment(input: CreateIntakeCommentInput): Promise<CreatedIntakeComment | null>;
  abstract updateIssue(input: UpdateIntakeIssueInput): Promise<IntakeIssue | null>;
}
