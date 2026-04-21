import { inject } from '@loopback/core';
import type { Provider } from '@loopback/core';

import { MastraLoopbackBindings } from '../bindings.js';
import type { LoopbackMastraBridge } from '../types.js';

export class CurrentLoopbackMastraBridgeProvider implements Provider<LoopbackMastraBridge | undefined> {
  constructor(
    @inject(MastraLoopbackBindings.BRIDGE, { optional: true })
    private readonly bridge?: LoopbackMastraBridge,
  ) {}

  value(): LoopbackMastraBridge | undefined {
    return this.bridge;
  }
}
