import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger';

/**
 * Abstract base class for content storage backends (Skills & Knowledge).
 *
 * Provides common infrastructure for storing and retrieving searchable content.
 * Domain-specific storage classes (KnowledgeStorage, SkillsStorage) extend this.
 *
 * This class lives in @mastra/core so that storage adapters
 * can be built in separate packages.
 */
export abstract class ContentStorage extends MastraBase {
  constructor({ component, name }: { component: RegisteredLogger; name: string }) {
    super({ component, name });
  }

  /**
   * Initialize the storage backend.
   * Called once before first use.
   */
  async init(): Promise<void> {
    // Default no-op - adapters override if they need initialization
  }
}
