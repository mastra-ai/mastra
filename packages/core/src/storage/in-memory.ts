import { MastraStorageBase } from './base';

export class MastraStorageInMemory extends MastraStorageBase {
  constructor() {
    super({ name: 'in-memory' });
  }
}
