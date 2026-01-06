try {
  const { startTelemetry } = await import('@mastra/hono-multi-instrumentation');
  await startTelemetry();
} catch (error) {
  console.error('[instrumentation] Failed to initialize telemetry:', error);
}

export {};
