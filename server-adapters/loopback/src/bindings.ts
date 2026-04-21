import { BindingKey } from '@loopback/core';
import type { Mastra } from '@mastra/core';
import type { RequestContext } from '@mastra/core/request-context';
import type { HttpLoggingConfig } from '@mastra/core/server';

import type {
  LoopbackAuthResolverInput,
  LoopbackMastraBridge,
  LoopbackMastraConfig,
  MastraAuthContext,
  MastraRequestContext,
} from './types.js';

export namespace MastraLoopbackBindings {
  export const CONFIG = BindingKey.create<LoopbackMastraConfig>('mastra.loopback.config');
  export const MASTRA_INSTANCE = BindingKey.create<Mastra>('mastra.loopback.instance');
  export const REQUEST_CONTEXT = BindingKey.create<MastraRequestContext>('mastra.loopback.requestContext');
  export const REQUEST_CONTEXT_VALUE = BindingKey.create<RequestContext>('mastra.loopback.requestContext.value');
  export const AUTH_CONTEXT = BindingKey.create<MastraAuthContext | undefined>('mastra.loopback.authContext');
  export const ABORT_SIGNAL = BindingKey.create<AbortSignal>('mastra.loopback.abortSignal');
  export const BRIDGE = BindingKey.create<LoopbackMastraBridge>('mastra.loopback.bridge');
  export const AUTH_RESOLVER = BindingKey.create<
    | ((input: LoopbackAuthResolverInput) => MastraAuthContext | undefined | Promise<MastraAuthContext | undefined>)
    | undefined
  >('mastra.loopback.authResolver');
  export const HTTP_LOGGING_CONFIG = BindingKey.create<HttpLoggingConfig | undefined>(
    'mastra.loopback.httpLoggingConfig',
  );
}

export namespace MastraLoopbackProviderBindings {
  export const REQUEST_CONTEXT = BindingKey.create<RequestContext | undefined>(
    'providers.mastra.loopback.requestContext',
  );
  export const AUTH_CONTEXT = BindingKey.create<MastraAuthContext | undefined>('providers.mastra.loopback.authContext');
  export const ABORT_SIGNAL = BindingKey.create<AbortSignal | undefined>('providers.mastra.loopback.abortSignal');
  export const BRIDGE = BindingKey.create<LoopbackMastraBridge | undefined>('providers.mastra.loopback.bridge');
}
