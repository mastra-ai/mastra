import { captureEEEvent } from '../../telemetry/posthog';

type EETelemetryBridge = {
  captureEEEvent?: typeof captureEEEvent;
};

const EE_TELEMETRY_BRIDGE = Symbol.for('mastra.eeTelemetryBridge');

(globalThis as typeof globalThis & { [EE_TELEMETRY_BRIDGE]?: EETelemetryBridge })[EE_TELEMETRY_BRIDGE] = {
  captureEEEvent,
};
