import { MastraBase } from '../../../base';
import type { StorageUserPreferencesType, StorageUpdateUserPreferencesInput } from '../../types';

/**
 * Abstract base class for per-user preferences storage.
 *
 * Preferences are keyed by user ID. Agent Studio uses this domain to store
 * starred agents/skills, UI preferences, and the admin preview toggle
 * without mutating agent or skill records (which only their author can
 * write to).
 */
export abstract class UserPreferencesStorage extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'USER_PREFERENCES',
    });
  }

  /**
   * Initialize the storage (create tables, directories, etc). Default is a no-op
   * because the in-memory adapter has nothing to set up.
   */
  async init(): Promise<void> {}

  /**
   * Get preferences for the given user. Returns `null` when no record exists
   * yet; callers are expected to treat this as "use defaults".
   */
  abstract get(userId: string): Promise<StorageUserPreferencesType | null>;

  /**
   * Create or merge preferences for the given user. `agentStudio` is
   * deep-merged into the existing record.
   */
  abstract update(userId: string, patch: StorageUpdateUserPreferencesInput): Promise<StorageUserPreferencesType>;

  /**
   * Delete all preferences for the given user.
   */
  abstract delete(userId: string): Promise<void>;

  /**
   * Delete all preferences. Used for testing.
   */
  abstract dangerouslyClearAll(): Promise<void>;
}
