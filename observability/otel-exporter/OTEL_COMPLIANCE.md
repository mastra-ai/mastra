# OTEL Compliance Updates

## Overview

The otel-exporter has been updated to follow OpenTelemetry Semantic Conventions for Generative AI, ensuring better compatibility with observability platforms and alignment with industry standards.

## Key Changes

### 1. Span Naming Conventions

- **Before**: Generic span names from Mastra
- **After**: OTEL-compliant naming:
  - LLM: `chat {model}` or `tool_selection {model}`
  - Tools: `tool.execute {tool_name}`
  - Agents: `agent.{agent_id}`
  - Workflows: `workflow.{workflow_id}`

### 2. Attribute Namespace Standardization

- **Removed**: Duplicate `llm.*` attributes
- **Standardized on**: `gen_ai.*` namespace following OTEL conventions
- **Key mappings**:
  - `llm.model` → `gen_ai.request.model`
  - `llm.provider` → `gen_ai.system`
  - `promptTokens` → `gen_ai.usage.input_tokens`
  - `completionTokens` → `gen_ai.usage.output_tokens`

### 3. Token Usage Attributes

- **Legacy format supported**: `promptTokens`/`completionTokens`
- **V5 format supported**: `inputTokens`/`outputTokens`
- **OTEL output**: Always maps to `gen_ai.usage.input_tokens`/`gen_ai.usage.output_tokens`

### 4. Span Kind Updates

- **Root spans** (agent/workflow): `SERVER` instead of `INTERNAL`
- **LLM calls**: `CLIENT` (calling external services)
- **Tool calls**: `INTERNAL` (local) or `CLIENT` (MCP/external)

### 5. New Required Attributes

- `gen_ai.operation.name`: Identifies the operation type
- `gen_ai.request.temperature`, `gen_ai.request.max_tokens`: LLM parameters
- `gen_ai.response.finish_reasons`: Completion reason
- `gen_ai.tool.success`: Tool execution result

### 6. Input/Output Handling

- **LLM spans**: Use `gen_ai.prompt` and `gen_ai.completion`
- **Tool spans**: Use `gen_ai.tool.input` and `gen_ai.tool.output`
- **Other spans**: Use generic `input` and `output`

### 7. Parent-Child Span Relationships

- **Fixed**: Now correctly preserves `parentSpanId` from Mastra's AI tracing
- **No override**: The exporter uses the parent relationships as defined by Mastra
- **Proper hierarchy**: Maintains correct span nesting for agents, workflows, LLM calls, and tools

## Compatibility

### With OTEL Standards

✅ Follows [OpenTelemetry Semantic Conventions for GenAI](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
✅ Compatible with standard OTEL collectors and backends
✅ Proper span hierarchy and relationships

### With Old Telemetry System

✅ Similar naming patterns for agents/workflows
✅ Maintains trace/span ID compatibility
✅ Resource and service name preservation

## Testing

Comprehensive test coverage added:

- Span naming conventions
- Attribute mapping (gen_ai.\* namespace)
- Token usage mapping (both legacy and v5 formats)
- Error handling
- Metadata handling
- Input/output serialization

## Benefits

1. **Better Observability Platform Support**: Traces will display correctly in platforms that support OTEL GenAI conventions
2. **Standardized Attributes**: Consistent attribute naming across different AI providers
3. **Future-Proof**: Aligned with evolving OTEL standards for AI/LLM tracing
4. **Backward Compatible**: Still handles legacy token format from older Mastra versions

## Migration Notes

No action required for users. The exporter automatically:

- Converts Mastra span types to OTEL-compliant names
- Maps attributes to proper namespaces
- Handles both legacy and new token formats
- Preserves all metadata and custom attributes
