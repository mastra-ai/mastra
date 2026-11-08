import { MastraBase } from '../../../base';

export interface StoredComputerRecord {
  schemaVersion: 1;
  id: string;
  recoveryId: string;
  providerId: string;
  providerIdentity: unknown;
  ownerResourceId: string;
  name: string;
  template: 'desktop';
  checkpointId?: string;
  createdAt: number;
}

export abstract class ComputersStorage extends MastraBase {
  constructor() {
    super({ component: 'STORAGE', name: 'COMPUTERS' });
  }

  abstract init(): Promise<void>;
  abstract getComputer(id: string): Promise<StoredComputerRecord | undefined>;
  abstract setComputer(record: StoredComputerRecord): Promise<void>;
  abstract deleteComputer(id: string): Promise<void>;
  abstract listComputers(resourceId: string): Promise<StoredComputerRecord[]>;
  abstract dangerouslyClearAll(): Promise<void>;
}
