/**
 * Mastra Observability
 */
import { NoOpEntrypoint } from './no-op-entrypoint';
import type { ObservabilityEntrypoint, InitObservabilityFunction, InitObservabilityOptions } from './types';

// Re-export core types & entrypoint class
export * from './types';
export * from './no-op-entrypoint';
export { wrapMastra } from './context';

let _initFunction: InitObservabilityFunction | undefined;

export function registerObservabilityInit(fn: InitObservabilityFunction) {
  if (_initFunction === undefined) {
    _initFunction = fn;
  }
}

export function getObservabilityInit(): InitObservabilityFunction | undefined {
  return _initFunction;
}

export function initObservability(options: InitObservabilityOptions): ObservabilityEntrypoint {
  if (!options.config) {
    return new NoOpEntrypoint();
  } else {
    const init = getObservabilityInit();
    if (!init) {
      options.logger?.warn?.(
        '[Mastra Observability] Observability config provided but no init registered. ' +
          "To enable observability install '@mastra/observability' and " +
          "import '@mastra/observability/init' at startup. Falling back to No-Op.",
      );
      return new NoOpEntrypoint();
    } else {
      return init(options);
    }
  }
}
