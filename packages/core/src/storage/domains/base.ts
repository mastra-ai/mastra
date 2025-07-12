import { MastraBase } from '../../base';

import type { StorageColumn } from '../types';
import type { MastraStore } from './store';

export abstract class MastraStorageBase extends MastraBase {
  protected hasInitialized: null | Promise<boolean> = null;
  protected shouldCacheInit = true;

  store: MastraStore;

  constructor({ name, store }: { name: string; store: MastraStore }) {
    super({
      component: 'STORAGE',
      name,
    });

    this.store = store;
  }

  public get supports(): {
    selectByIncludeResourceScope: boolean;
    resourceWorkingMemory: boolean;
  } {
    return {
      selectByIncludeResourceScope: false,
      resourceWorkingMemory: false,
    };
  }

  protected ensureDate(date: Date | string | undefined): Date | undefined {
    if (!date) return undefined;
    return date instanceof Date ? date : new Date(date);
  }

  protected serializeDate(date: Date | string | undefined): string | undefined {
    if (!date) return undefined;
    const dateObj = this.ensureDate(date);
    return dateObj?.toISOString();
  }

  /**
   * Resolves limit for how many messages to fetch
   *
   * @param last The number of messages to fetch
   * @param defaultLimit The default limit to use if last is not provided
   * @returns The resolved limit
   */
  protected resolveMessageLimit({
    last,
    defaultLimit,
  }: {
    last: number | false | undefined;
    defaultLimit: number;
  }): number {
    // TODO: Figure out consistent default limit for all stores as some stores use 40 and some use no limit (Number.MAX_SAFE_INTEGER)
    if (typeof last === 'number') return Math.max(0, last);
    if (last === false) return 0;
    return defaultLimit;
  }
}
