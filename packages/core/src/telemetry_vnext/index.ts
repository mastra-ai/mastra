/**
 * Mastra Telemetry V-Next
 * 
 * New telemetry interface that addresses limitations of the current system
 * while incorporating best practices from leading AI observability platforms.
 */

// Core types and interfaces
export * from './types';

// Abstract base class
export { MastraTelemetry, telemetryDefaultOptions } from './base';

// Registry functions
export {
  registerTelemetry,
  getTelemetry,
  unregisterTelemetry,
  clearTelemetryRegistry,
  hasTelemetry,
} from './registry';

// Decorators
export {
  withSpan,
  InstrumentClass,
} from './decorators';

// Re-export commonly used types for convenience
export type {
  // Core interfaces
  Trace,
  AISpan,
  SpanMetadata,
  
  // Specific metadata types
  AgentRunMetadata,
  WorkflowRunMetadata,
  LLMGenerationMetadata,
  ToolCallMetadata,
  MCPToolCallMetadata,
  MemoryLookupMetadata,
  MemoryUpdateMetadata,
  RAGQueryMetadata,
  EmbeddingGenerationMetadata,
  EvalExecutionMetadata,
  WorkflowStepMetadata,
  
  // Scoring and annotations
  EvaluationScore,
  HumanAnnotation,
  LLMAnnotation,
  
  // Configuration
  TelemetryConfig,
  SharedTelemetryConfig,
  TelemetrySupports,
  
  // Plugin interfaces
  TelemetryExporter,
  SpanProcessor,
  TelemetrySampler,
  
  // Options
  SpanOptions,
  TracingOptions,
  DecoratorOptions,
} from './types';

// Export enum
export { SpanType } from './types';