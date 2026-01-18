import { WorkOS } from '@workos-inc/node';
import type { DirectoryGroup, DirectoryUser } from '@workos-inc/node';

/**
 * Configuration for WorkOS Directory Sync (SCIM)
 */
export interface WorkOSDirectorySyncConfig {
  /**
   * WorkOS SDK instance
   */
  workos: WorkOS;

  /**
   * Directory ID to sync from
   */
  directoryId: string;

  /**
   * Callback when a user is created via SCIM
   */
  onUserCreated?: (user: DirectoryUser) => Promise<void>;

  /**
   * Callback when a user is updated via SCIM
   */
  onUserUpdated?: (user: DirectoryUser) => Promise<void>;

  /**
   * Callback when a user is deleted via SCIM
   */
  onUserDeleted?: (userId: string) => Promise<void>;

  /**
   * Callback when a user is added to a group
   */
  onUserAddedToGroup?: (userId: string, group: DirectoryGroup) => Promise<void>;

  /**
   * Callback when a user is removed from a group
   */
  onUserRemovedFromGroup?: (userId: string, group: DirectoryGroup) => Promise<void>;
}

/**
 * WorkOS Directory Sync event types
 */
export type DirectorySyncEventType =
  | 'dsync.user.created'
  | 'dsync.user.updated'
  | 'dsync.user.deleted'
  | 'dsync.group.user_added'
  | 'dsync.group.user_removed';

/**
 * WorkOS Directory Sync webhook event
 */
export interface DirectorySyncEvent {
  id: string;
  event: DirectorySyncEventType;
  data: {
    id: string;
    state: 'active' | 'inactive';
    directory_id: string;
    directory_group_id?: string;
    object: 'directory_user' | 'directory_group';
    [key: string]: any;
  };
  created_at: string;
}

/**
 * WorkOS Directory Sync (SCIM) handler
 *
 * Handles user provisioning and group membership events from identity providers
 * via WorkOS Directory Sync. Supports Azure AD, Okta, Google Workspace, and other
 * SCIM-compliant identity providers.
 *
 * @example
 * ```typescript
 * const directorySync = new WorkOSDirectorySync({
 *   workos: workosClient,
 *   directoryId: 'directory_123',
 *   onUserCreated: async (user) => {
 *     await db.users.create({
 *       id: user.id,
 *       email: user.emails[0]?.value,
 *       firstName: user.first_name,
 *       lastName: user.last_name,
 *     });
 *   },
 *   onUserUpdated: async (user) => {
 *     await db.users.update(user.id, {
 *       email: user.emails[0]?.value,
 *       firstName: user.first_name,
 *       lastName: user.last_name,
 *     });
 *   },
 *   onUserDeleted: async (userId) => {
 *     await db.users.delete(userId);
 *   },
 *   onUserAddedToGroup: async (userId, group) => {
 *     // Update role based on group
 *     const role = mapGroupToRole(group.name);
 *     await db.users.updateRole(userId, role);
 *   },
 * });
 *
 * // In webhook handler
 * app.post('/webhooks/workos', async (req, res) => {
 *   const event = req.body as DirectorySyncEvent;
 *   await directorySync.handleWebhook(event);
 *   res.status(200).send('OK');
 * });
 * ```
 */
export class WorkOSDirectorySync {
  private config: WorkOSDirectorySyncConfig;

  constructor(config: WorkOSDirectorySyncConfig) {
    this.config = config;
  }

  /**
   * Handle a Directory Sync webhook event
   */
  async handleWebhook(event: DirectorySyncEvent): Promise<void> {
    // Only process events for our directory
    if (event.data.directory_id !== this.config.directoryId) {
      return;
    }

    switch (event.event) {
      case 'dsync.user.created':
        await this.handleUserCreated(event.data.id);
        break;
      case 'dsync.user.updated':
        await this.handleUserUpdated(event.data.id);
        break;
      case 'dsync.user.deleted':
        await this.handleUserDeleted(event.data.id);
        break;
      case 'dsync.group.user_added':
        await this.handleUserAddedToGroup(event.data.id, event.data.directory_group_id!);
        break;
      case 'dsync.group.user_removed':
        await this.handleUserRemovedFromGroup(event.data.id, event.data.directory_group_id!);
        break;
    }
  }

  /**
   * Handle user created event
   */
  private async handleUserCreated(userId: string): Promise<void> {
    if (!this.config.onUserCreated) return;

    const user = await this.config.workos.directorySync.getUser(userId);
    await this.config.onUserCreated(user);
  }

  /**
   * Handle user updated event
   */
  private async handleUserUpdated(userId: string): Promise<void> {
    if (!this.config.onUserUpdated) return;

    const user = await this.config.workos.directorySync.getUser(userId);
    await this.config.onUserUpdated(user);
  }

  /**
   * Handle user deleted event
   */
  private async handleUserDeleted(userId: string): Promise<void> {
    if (!this.config.onUserDeleted) return;

    await this.config.onUserDeleted(userId);
  }

  /**
   * Handle user added to group event
   */
  private async handleUserAddedToGroup(userId: string, groupId: string): Promise<void> {
    if (!this.config.onUserAddedToGroup) return;

    const group = await this.config.workos.directorySync.getGroup(groupId);
    await this.config.onUserAddedToGroup(userId, group);
  }

  /**
   * Handle user removed from group event
   */
  private async handleUserRemovedFromGroup(userId: string, groupId: string): Promise<void> {
    if (!this.config.onUserRemovedFromGroup) return;

    const group = await this.config.workos.directorySync.getGroup(groupId);
    await this.config.onUserRemovedFromGroup(userId, group);
  }

  /**
   * List all users in the directory
   */
  async listUsers(): Promise<DirectoryUser[]> {
    const response = await this.config.workos.directorySync.listUsers({
      directory: this.config.directoryId,
    });
    return response.data;
  }

  /**
   * List all groups in the directory
   */
  async listGroups(): Promise<DirectoryGroup[]> {
    const response = await this.config.workos.directorySync.listGroups({
      directory: this.config.directoryId,
    });
    return response.data;
  }

  /**
   * Get a specific user by ID
   */
  async getUser(userId: string): Promise<DirectoryUser> {
    return await this.config.workos.directorySync.getUser(userId);
  }

  /**
   * Get a specific group by ID
   */
  async getGroup(groupId: string): Promise<DirectoryGroup> {
    return await this.config.workos.directorySync.getGroup(groupId);
  }
}
