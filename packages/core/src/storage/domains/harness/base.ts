import { StorageDomain } from '../base';
import type { SessionRecord } from './types';

export abstract class HarnessStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'HARNESS',
    });
  }

  abstract loadSession(sessionId: string): Promise<SessionRecord | null>;

  abstract saveSession(record: SessionRecord): Promise<void>;

  abstract listSessions(): Promise<SessionRecord[]>;
}
