import { MastraBase } from '../../../base';
import type { StorageAgentAvatarType } from '../../types';

/**
 * Input for storing (or replacing) an agent's avatar.
 */
export interface StoragePutAgentAvatarInput {
  /** ID of the agent the avatar belongs to */
  agentId: string;
  /** base64-encoded image bytes */
  data: string;
  /** MIME type of the image (e.g. 'image/png') */
  mime: string;
}

/**
 * Abstract base class for agent avatar storage.
 *
 * Stores one avatar image per agent, keyed by agent ID. Replacing an avatar
 * overwrites the previous row (last write wins). Avatar rows live alongside
 * the rest of Mastra's data in the configured storage adapter, so they are
 * durable and replicated wherever the user's storage is.
 *
 * Lifecycle: the server's stored-agent delete handler deletes the avatar row
 * when the agent record is hard-deleted (same pattern as favorites).
 */
export abstract class AgentAvatarsStorage extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'AGENT_AVATARS',
    });
  }

  /**
   * Initialize the avatar store (create tables, etc).
   */
  abstract init(): Promise<void>;

  /**
   * Store an avatar for an agent, replacing any existing one.
   */
  abstract put(input: StoragePutAgentAvatarInput): Promise<void>;

  /**
   * Retrieve an agent's avatar. Returns null if none is stored.
   */
  abstract get(agentId: string): Promise<StorageAgentAvatarType | null>;

  /**
   * Delete an agent's avatar. No-op if none is stored.
   */
  abstract delete(agentId: string): Promise<void>;

  /**
   * Delete all avatars. Used for testing.
   */
  abstract dangerouslyClearAll(): Promise<void>;
}
