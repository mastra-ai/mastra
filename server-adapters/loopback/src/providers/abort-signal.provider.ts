import { inject } from '@loopback/core';
import type { Provider } from '@loopback/core';

import { MastraLoopbackBindings } from '../bindings.js';

export class CurrentLoopbackMastraAbortSignalProvider implements Provider<AbortSignal | undefined> {
  constructor(
    @inject(MastraLoopbackBindings.ABORT_SIGNAL, { optional: true })
    private readonly abortSignal?: AbortSignal,
  ) {}

  value(): AbortSignal | undefined {
    return this.abortSignal;
  }
}
