import { inject } from '@loopback/core';
import type { Provider } from '@loopback/core';

import { MastraLoopbackBindings } from '../bindings.js';
import type { MastraAuthContext } from '../types.js';

export class CurrentLoopbackMastraAuthContextProvider implements Provider<MastraAuthContext | undefined> {
  constructor(
    @inject(MastraLoopbackBindings.AUTH_CONTEXT, { optional: true })
    private readonly authContext?: MastraAuthContext,
  ) {}

  value(): MastraAuthContext | undefined {
    return this.authContext;
  }
}
