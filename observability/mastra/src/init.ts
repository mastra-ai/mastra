import { NoOpEntrypoint, registerObservabilityInit } from '@mastra/core/observability';
import type { InitObservabilityOptions } from '@mastra/core/observability';
import { DefaultEntrypoint } from './default-entrypoint';

// Side-effect: called once when this module is imported.
registerObservabilityInit((options: InitObservabilityOptions) => {
  if (!options.config) {
    options.logger?.warn?.(
      '[Mastra Observability] Observability init registered but no config provided. ' +
        "To enable observability, add an 'observability' section to your Mastra config. " +
        'Falling back to No-Op.',
    );
    return new NoOpEntrypoint();
  }
  return new DefaultEntrypoint(options.config);
});
