import { BindingScope, createBindingFromClass } from '@loopback/core';
import type { Binding, Component } from '@loopback/core';

import { MastraLoopbackProviderBindings } from './bindings.js';
import {
  CurrentLoopbackMastraAbortSignalProvider,
  CurrentLoopbackMastraAuthContextProvider,
  CurrentLoopbackMastraBridgeProvider,
  CurrentLoopbackMastraRequestContextProvider,
} from './providers/index.js';
/**
 * Registers helper providers for request-scoped Mastra state inside LoopBack.
 * The adapter binds concrete request values during route invocation.
 */
export class MastraLoopbackComponent implements Component {
  bindings: Binding[] = [];

  constructor() {
    this.bindings = [
      createBindingFromClass(CurrentLoopbackMastraRequestContextProvider, {
        key: MastraLoopbackProviderBindings.REQUEST_CONTEXT.key,
        defaultScope: BindingScope.REQUEST,
      }),
      createBindingFromClass(CurrentLoopbackMastraAuthContextProvider, {
        key: MastraLoopbackProviderBindings.AUTH_CONTEXT.key,
        defaultScope: BindingScope.REQUEST,
      }),
      createBindingFromClass(CurrentLoopbackMastraAbortSignalProvider, {
        key: MastraLoopbackProviderBindings.ABORT_SIGNAL.key,
        defaultScope: BindingScope.REQUEST,
      }),
      createBindingFromClass(CurrentLoopbackMastraBridgeProvider, {
        key: MastraLoopbackProviderBindings.BRIDGE.key,
        defaultScope: BindingScope.REQUEST,
      }),
    ];
  }
}
