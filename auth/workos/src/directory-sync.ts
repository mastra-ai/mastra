/**
 * WorkOS Directory Sync integration for automated user provisioning via SCIM.
 *
 * This class handles SCIM webhook events from WorkOS, enabling automated
 * user and group management when integrated with identity providers.
 */

import type { WorkOS, Directory, DirectoryUser, DirectoryGroup } from '@workos-inc/node';

import type {
  WorkOSDirectorySyncOptions,
  DirectorySyncHandlers,
  DirectorySyncUserData,
  DirectorySyncGroupData,
} from './types.js';

/**
 * Directory Sync event types from WorkOS webhooks.
 */
type DirectorySyncEventType =
  | 'dsync.user.created'
  | 'dsync.user.updated'
  | 'dsync.user.deleted'
  | 'dsync.group.created'
  | 'dsync.group.updated'
  | 'dsync.group.deleted'
  | 'dsync.group.user_added'
  | 'dsync.group.user_removed';

/**
 * WorkOS webhook event structure for directory sync.
 */
interface DirectorySyncEvent {
  id: string;
  event: DirectorySyncEventType;
  data: Record<string, unknown>;
  created_at: string;
}

/**
 * WorkOSDirectorySync handles SCIM webhook events from WorkOS for automated
 * user provisioning and deprovisioning.
 *
 * @example
 * ```typescript
 * import { WorkOS } from '@workos-inc/node';
 * import { WorkOSDirectorySync } from '@mastra/auth-workos';
 *
 * const workos = new WorkOS(process.env.WORKOS_API_KEY);
 *
 * const directorySync = new WorkOSDirectorySync(workos, {
 *   webhookSecret: process.env.WORKOS_WEBHOOK_SECRET,
 *   handlers: {
 *     onUserCreated: async (user) => {
 *       await db.users.create({ email: user.emails[0]?.value });
 *     },
 *     onUserDeleted: async (user) => {
 *       await db.users.delete({ id: user.id });
 *     },
 *   },
 * });
 *
 * // In your webhook endpoint:
 * app.post('/webhooks/workos', async (req, res) => {
 *   const signature = req.headers['workos-signature'] as string;
 *   await directorySync.handleWebhook(req.body, signature);
 *   res.status(200).send('OK');
 * });
 * ```
 */
export class WorkOSDirectorySync {
  private workos: WorkOS;
  private webhookSecret: string;
  private handlers: DirectorySyncHandlers;

  /**
   * Creates a new WorkOSDirectorySync instance.
   *
   * @param workos - WorkOS client instance
   * @param options - Configuration options including webhook secret and event handlers
   * @throws Error if webhook secret is not provided
   */
  constructor(workos: WorkOS, options: WorkOSDirectorySyncOptions) {
    this.workos = workos;

    const webhookSecret = options.webhookSecret ?? process.env.WORKOS_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error(
        'WorkOS webhook secret is required. Provide it in options or set WORKOS_WEBHOOK_SECRET environment variable.',
      );
    }

    this.webhookSecret = webhookSecret;
    this.handlers = options.handlers;
  }

  /**
   * Handles incoming webhook events from WorkOS Directory Sync.
   *
   * This method verifies the webhook signature for security, parses the event,
   * and routes it to the appropriate handler based on the event type.
   *
   * @param payload - Raw webhook payload (string or object)
   * @param signature - WorkOS signature header for verification
   * @throws Error if signature verification fails
   */
  async handleWebhook(payload: string | object, signature: string): Promise<void> {
    // Verify the webhook signature and construct the event
    // Cast through unknown since WorkOS Event type is a union of many event types
    const event = (await this.workos.webhooks.constructEvent({
      payload,
      sigHeader: signature,
      secret: this.webhookSecret,
    })) as unknown as DirectorySyncEvent;

    // Route to appropriate handler based on event type
    try {
      await this.routeEvent(event);
    } catch (error) {
      // Log but don't crash - webhook handlers should be resilient
      console.error(`[WorkOSDirectorySync] Error handling event ${event.event}:`, error);
    }
  }

  /**
   * Routes a directory sync event to the appropriate handler.
   *
   * @param event - The verified webhook event
   */
  private async routeEvent(event: DirectorySyncEvent): Promise<void> {
    const { event: eventType, data } = event;

    switch (eventType) {
      case 'dsync.user.created':
        if (this.handlers.onUserCreated) {
          await this.handlers.onUserCreated(this.mapUserData(data));
        }
        break;

      case 'dsync.user.updated':
        if (this.handlers.onUserUpdated) {
          await this.handlers.onUserUpdated(this.mapUserData(data));
        }
        break;

      case 'dsync.user.deleted':
        if (this.handlers.onUserDeleted) {
          await this.handlers.onUserDeleted(this.mapUserData(data));
        }
        break;

      case 'dsync.group.created':
        if (this.handlers.onGroupCreated) {
          await this.handlers.onGroupCreated(this.mapGroupData(data));
        }
        break;

      case 'dsync.group.updated':
        if (this.handlers.onGroupUpdated) {
          await this.handlers.onGroupUpdated(this.mapGroupData(data));
        }
        break;

      case 'dsync.group.deleted':
        if (this.handlers.onGroupDeleted) {
          await this.handlers.onGroupDeleted(this.mapGroupData(data));
        }
        break;

      case 'dsync.group.user_added':
        if (this.handlers.onGroupUserAdded) {
          await this.handlers.onGroupUserAdded({
            group: this.mapGroupData(data.group as Record<string, unknown>),
            user: this.mapUserData(data.user as Record<string, unknown>),
          });
        }
        break;

      case 'dsync.group.user_removed':
        if (this.handlers.onGroupUserRemoved) {
          await this.handlers.onGroupUserRemoved({
            group: this.mapGroupData(data.group as Record<string, unknown>),
            user: this.mapUserData(data.user as Record<string, unknown>),
          });
        }
        break;

      default:
        // Unknown event type - log for debugging but don't fail
        console.warn(`[WorkOSDirectorySync] Unknown event type: ${eventType}`);
    }
  }

  /**
   * Maps raw webhook user data to the DirectorySyncUserData type.
   *
   * @param data - Raw user data from webhook
   * @returns Typed user data
   */
  private mapUserData(data: Record<string, unknown>): DirectorySyncUserData {
    return {
      id: data.id as string,
      directoryId: data.directory_id as string,
      organizationId: data.organization_id as string | undefined,
      idpId: data.idp_id as string,
      firstName: data.first_name as string | undefined,
      lastName: data.last_name as string | undefined,
      jobTitle: data.job_title as string | undefined,
      emails: (data.emails as Array<{ primary: boolean; type?: string; value: string }>) ?? [],
      username: data.username as string | undefined,
      groups: (data.groups as Array<{ id: string; name: string }>) ?? [],
      state: data.state as 'active' | 'inactive',
      rawAttributes: (data.raw_attributes as Record<string, unknown>) ?? {},
      customAttributes: (data.custom_attributes as Record<string, unknown>) ?? {},
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }

  /**
   * Maps raw webhook group data to the DirectorySyncGroupData type.
   *
   * @param data - Raw group data from webhook
   * @returns Typed group data
   */
  private mapGroupData(data: Record<string, unknown>): DirectorySyncGroupData {
    return {
      id: data.id as string,
      directoryId: data.directory_id as string,
      organizationId: data.organization_id as string | undefined,
      idpId: data.idp_id as string,
      name: data.name as string,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
      rawAttributes: (data.raw_attributes as Record<string, unknown>) ?? {},
    };
  }

  // ===========================================================================
  // Helper Methods for Directory Sync Operations
  // ===========================================================================

  /**
   * Lists all directories for an organization.
   *
   * @param organizationId - The WorkOS organization ID
   * @returns Array of directories
   *
   * @example
   * ```typescript
   * const directories = await directorySync.listDirectories('org_123');
   * for (const dir of directories) {
   *   console.log(`Directory: ${dir.name} (${dir.type})`);
   * }
   * ```
   */
  async listDirectories(organizationId: string): Promise<Directory[]> {
    const response = await this.workos.directorySync.listDirectories({
      organizationId,
    });
    return response.data;
  }

  /**
   * Lists all users in a directory.
   *
   * @param directoryId - The directory ID
   * @returns Array of directory users
   *
   * @example
   * ```typescript
   * const users = await directorySync.listDirectoryUsers('directory_123');
   * for (const user of users) {
   *   console.log(`User: ${user.firstName} ${user.lastName}`);
   * }
   * ```
   */
  async listDirectoryUsers(directoryId: string): Promise<DirectoryUser[]> {
    const response = await this.workos.directorySync.listUsers({
      directory: directoryId,
    });
    return response.data;
  }

  /**
   * Lists all groups in a directory.
   *
   * @param directoryId - The directory ID
   * @returns Array of directory groups
   *
   * @example
   * ```typescript
   * const groups = await directorySync.listDirectoryGroups('directory_123');
   * for (const group of groups) {
   *   console.log(`Group: ${group.name}`);
   * }
   * ```
   */
  async listDirectoryGroups(directoryId: string): Promise<DirectoryGroup[]> {
    const response = await this.workos.directorySync.listGroups({
      directory: directoryId,
    });
    return response.data;
  }
}
