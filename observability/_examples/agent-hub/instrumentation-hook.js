import * as module from 'module';

/**
 * Hook that sets up import-in-the-middle for the purpose of OpenTelemetry (see https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/esm-support.md)
 */

module.register('@opentelemetry/instrumentation/hook.mjs', import.meta.url, {
  data: {exclude: [/openai/]},
});

globalThis.___MASTRA_TELEMETRY___ = true;
