/**
 * Model calls need a larger budget than evidence-provider reads. Structured
 * output generation includes provider latency and schema validation, while the
 * evidence timeouts protect the much smaller provider I/O operations.
 */
export const STRUCTURED_OUTPUT_MODEL_TIMEOUT = Object.freeze({
  totalMs: 15_000,
  stepMs: 10_000,
});
