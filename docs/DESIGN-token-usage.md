# Token Usage Tracking Design

This document outlines the design for unified token usage tracking across Mastra's observability exporters, with a focus on proper cache token handling.

## Problem Statement

Multiple GitHub issues report incorrect or missing cached token counts:

- [#10174](https://github.com/mastra-ai/mastra/issues/10174) - Langfuse missing cached tokens with OpenRouter
- [#9853](https://github.com/mastra-ai/mastra/issues/9853) - Braintrust dropping token counts from API calls
- [#9821](https://github.com/mastra-ai/mastra/issues/9821) - Braintrust not showing cached tokens with Anthropic prompt caching

The root cause is inconsistent handling of cache token fields across different AI SDK versions and provider-specific semantics.

---

## Provider Token Semantics

### OpenAI

OpenAI uses **automatic caching** - no explicit cache control needed.

```json
{
  "usage": {
    "prompt_tokens": 1566,
    "completion_tokens": 1518,
    "prompt_tokens_details": {
      "cached_tokens": 1408,
      "audio_tokens": null
    },
    "completion_tokens_details": {
      "reasoning_tokens": 576,
      "audio_tokens": null
    }
  }
}
```

| Field                                        | Meaning                              | Cost Impact       |
| -------------------------------------------- | ------------------------------------ | ----------------- |
| `prompt_tokens`                              | Total input tokens (includes cached) | Base price        |
| `prompt_tokens_details.cached_tokens`        | Tokens served from cache             | **-50%** discount |
| `completion_tokens_details.reasoning_tokens` | Reasoning tokens (o1 models)         | Base price        |

### Anthropic

Anthropic uses **explicit caching** with cache control markers.

```json
{
  "usage": {
    "input_tokens": 21,
    "cache_creation_input_tokens": 188086,
    "cache_read_input_tokens": 0,
    "output_tokens": 393
  }
}
```

| Field                         | Meaning                                    | Cost Impact            |
| ----------------------------- | ------------------------------------------ | ---------------------- |
| `input_tokens`                | Regular text tokens (NOT including cached) | Base price             |
| `cache_creation_input_tokens` | Tokens written TO cache                    | **+25%** extra         |
| `cache_read_input_tokens`     | Tokens read FROM cache                     | **-90%** (10% of base) |

**Key difference:** For Anthropic, `input_tokens` does NOT include cache tokens. Per [Anthropic docs](https://platform.claude.com/docs/en/api/messages): _"Total input tokens in a request is the summation of `input_tokens`, `cache_creation_input_tokens`, and `cache_read_input_tokens`."_

Total input = `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`

---

## How AI SDK Exposes Cache Tokens

**Critical Discovery:** The AI SDK exposes cache tokens differently for each provider:

### OpenAI via AI SDK

Cache tokens appear directly in the **`usage`** object:

```typescript
// AI SDK's LanguageModelV2Usage for OpenAI
{
  inputTokens: 6003,        // INCLUDES cached tokens
  outputTokens: 92,
  totalTokens: 6095,
  reasoningTokens: 0,
  cachedInputTokens: 5760   // ✅ Available directly in usage
}
```

- `inputTokens` **includes** cached tokens (no double-counting needed)
- `cachedInputTokens` is available directly
- No `cacheWriteTokens` (OpenAI caching is automatic, no write cost)

### Anthropic via AI SDK

Cache tokens appear in **`providerMetadata.anthropic`**, NOT in the usage object:

```typescript
// AI SDK response for Anthropic
{
  usage: {
    inputTokens: 21,          // Does NOT include cached tokens
    outputTokens: 393,
  },
  providerMetadata: {
    anthropic: {
      cacheCreationInputTokens: 188086,  // ✅ Cache WRITE tokens
      cacheReadInputTokens: 0,           // ✅ Cache READ tokens
    }
  }
}
```

- `inputTokens` does **NOT** include cached tokens
- Cache metrics are in `providerMetadata.anthropic`
- Both read AND write tokens are available

### Current Mastra Code Location

In `packages/core/src/stream/aisdk/v5/transform.ts` (lines 215-238), the `finish` chunk:

```typescript
case 'finish':
  return {
    payload: {
      output: {
        usage: { ...value.usage },  // ❌ Only standard usage fields
      },
      metadata: {
        providerMetadata: value.providerMetadata,  // ✅ Contains Anthropic cache tokens
      },
    },
  };
```

**The Problem:** We capture `providerMetadata` but don't extract the cache tokens into the usage object!

---

## Current Implementation State

### Core UsageStats Interface

Location: `packages/core/src/observability/types/tracing.ts`

```typescript
export interface UsageStats {
  // AI SDK v5 format
  inputTokens?: number;
  outputTokens?: number;
  // AI SDK v4 format (legacy)
  promptTokens?: number;
  completionTokens?: number;
  // Common
  totalTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number; // v5 cache read
  promptCacheHitTokens?: number; // v4 cache read (legacy)
  promptCacheMissTokens?: number; // v4 cache write (legacy)
}
```

### Exporter Mapping Summary

| Exporter       | Cache Read Source                            | Cache Write Source      | Gap                                     |
| -------------- | -------------------------------------------- | ----------------------- | --------------------------------------- |
| **Braintrust** | `promptCacheHitTokens`                       | `promptCacheMissTokens` | Missing `cachedInputTokens`             |
| **Langfuse**   | `cachedInputTokens` + `promptCacheHitTokens` | `promptCacheMissTokens` | Field naming may not match expectations |
| **LangSmith**  | `promptCacheHitTokens`                       | `promptCacheMissTokens` | Missing `cachedInputTokens`             |
| **PostHog**    | `cachedInputTokens`                          | (none)                  | Missing cache write + legacy fields     |
| **OTEL**       | `cachedInputTokens`                          | (none)                  | Missing cache write                     |

---

## Proposed UsageStats Interface

Based on [OpenInference semantic conventions](https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md), we propose a comprehensive token tracking structure:

```typescript
export interface UsageStats {
  // ===== Totals =====
  /** Total input tokens (sum of all input details) */
  inputTokens?: number;
  /** Total output tokens (sum of all output details) */
  outputTokens?: number;

  // ===== Input Token Details =====
  inputDetails?: {
    /** Regular text tokens (non-cached, non-audio, non-image) */
    text?: number;
    /** Tokens served from cache (cache hit) */
    cacheRead?: number;
    /** Tokens written to cache (cache creation - Anthropic only) */
    cacheWrite?: number;
    /** Audio input tokens */
    audio?: number;
    /** Image input tokens (includes PDF pages) */
    image?: number;
  };

  // ===== Output Token Details =====
  outputDetails?: {
    /** Regular text output tokens */
    text?: number;
    /** Reasoning/thinking tokens (o1, Claude thinking) */
    reasoning?: number;
    /** Audio output tokens */
    audio?: number;
    /** Image output tokens (DALL-E, etc.) */
    image?: number;
  };
}
```

### Design Decisions

1. **No legacy fields** - Handle mapping at the normalization layer, not in the interface
2. **No `totalTokens`** - Computed as `inputTokens + outputTokens` when needed
3. **Explicit `text` field** - Clearer than deriving as "total minus details"
4. **No `video` tokens** - Not yet supported by major providers
5. **No separate `file`/`document` tokens** - PDFs are processed as text + image tokens

---

## Provider to UsageStats Mapping

### From OpenAI Response

```typescript
function mapOpenAIUsage(usage: OpenAIUsage): UsageStats {
  return {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    inputDetails: {
      cacheRead: usage.prompt_tokens_details?.cached_tokens,
      audio: usage.prompt_tokens_details?.audio_tokens,
      // text = prompt_tokens - cached_tokens - audio_tokens (computed)
    },
    outputDetails: {
      reasoning: usage.completion_tokens_details?.reasoning_tokens,
      audio: usage.completion_tokens_details?.audio_tokens,
      // text = completion_tokens - reasoning_tokens - audio_tokens (computed)
    },
  };
}
```

### From Anthropic Response

```typescript
function mapAnthropicUsage(usage: AnthropicUsage): UsageStats {
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const textInput = usage.input_tokens ?? 0;

  return {
    // Total input = text + cache read + cache write
    inputTokens: textInput + cacheRead + cacheWrite,
    outputTokens: usage.output_tokens,
    inputDetails: {
      text: textInput,
      cacheRead: cacheRead || undefined,
      cacheWrite: cacheWrite || undefined,
    },
    outputDetails: {
      text: usage.output_tokens,
      // reasoning: when thinking is enabled
    },
  };
}
```

---

## Exporter Output Mapping

### Braintrust

Per [Braintrust docs](https://www.braintrust.dev/docs/guides/traces/customize#wrap-a-custom-llm-client), `prompt_tokens` should **include** cached tokens.

```typescript
function toBraintrustMetrics(usage: UsageStats): BraintrustMetrics {
  return {
    prompt_tokens: usage.inputTokens,
    completion_tokens: usage.outputTokens,
    tokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
    prompt_cached_tokens: usage.inputDetails?.cacheRead,
    prompt_cache_creation_tokens: usage.inputDetails?.cacheWrite,
    completion_reasoning_tokens: usage.outputDetails?.reasoning,
  };
}
```

### Langfuse

Per [Langfuse docs](https://langfuse.com/docs/observability/features/token-and-cost-tracking):

```typescript
function toLangfuseUsage(usage: UsageStats): LangfuseUsage {
  return {
    input: usage.inputTokens,
    output: usage.outputTokens,
    cache_read_input_tokens: usage.inputDetails?.cacheRead,
    // Langfuse uses OpenAI-compatible schema for details
  };
}
```

### LangSmith

Per [LangSmith UsageMetadata](https://docs.smith.langchain.com/reference/js/types/schemas.UsageMetadata):

```typescript
function toLangSmithUsage(usage: UsageStats): LangSmithUsageMetadata {
  return {
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    total_tokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
    input_token_details: {
      cache_read: usage.inputDetails?.cacheRead,
      cache_write: usage.inputDetails?.cacheWrite,
      audio: usage.inputDetails?.audio,
    },
    output_token_details: {
      reasoning_tokens: usage.outputDetails?.reasoning,
      audio: usage.outputDetails?.audio,
    },
  };
}
```

### PostHog

Per [PostHog LLM Analytics](https://posthog.com/docs/llm-analytics/generations):

```typescript
function toPostHogProperties(usage: UsageStats): PostHogProperties {
  return {
    $ai_input_tokens: usage.inputTokens,
    $ai_output_tokens: usage.outputTokens,
    // Cache tokens - field names TBD (not fully documented)
    cached_input_tokens: usage.inputDetails?.cacheRead,
    reasoning_tokens: usage.outputDetails?.reasoning,
  };
}
```

### OTEL / OpenInference (Arize)

Per [OpenInference Semantic Conventions](https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md):

```typescript
function toOtelAttributes(usage: UsageStats): Attributes {
  return {
    "gen_ai.usage.input_tokens": usage.inputTokens,
    "gen_ai.usage.output_tokens": usage.outputTokens,
    "llm.token_count.prompt": usage.inputTokens,
    "llm.token_count.completion": usage.outputTokens,
    "llm.token_count.prompt_details.cache_read": usage.inputDetails?.cacheRead,
    "llm.token_count.prompt_details.cache_write":
      usage.inputDetails?.cacheWrite,
    "llm.token_count.prompt_details.audio": usage.inputDetails?.audio,
    "llm.token_count.prompt_details.image": usage.inputDetails?.image,
    "llm.token_count.completion_details.reasoning":
      usage.outputDetails?.reasoning,
    "llm.token_count.completion_details.audio": usage.outputDetails?.audio,
  };
}
```

---

## Implementation Plan

### Phase 1: Update Core Interface

1. Add new `UsageStats` interface with `inputDetails` and `outputDetails`
2. Create normalization utilities to handle legacy AI SDK formats
3. Update `ModelGenerationAttributes` to use new interface

### Phase 2: Extract Cache Tokens from providerMetadata

**Key file:** `packages/core/src/stream/aisdk/v5/transform.ts`

Create a utility function to extract provider-specific cache tokens:

```typescript
function extractCacheTokensFromProviderMetadata(
  usage: LanguageModelV2Usage,
  providerMetadata?: SharedV2ProviderMetadata,
): UsageStats {
  const baseUsage: UsageStats = {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    inputDetails: {},
    outputDetails: {
      reasoning: usage.reasoningTokens,
    },
  };

  // OpenAI: cachedInputTokens is already in usage
  if (usage.cachedInputTokens) {
    baseUsage.inputDetails!.cacheRead = usage.cachedInputTokens;
  }

  // Anthropic: extract from providerMetadata.anthropic
  const anthropic = providerMetadata?.anthropic as
    | {
        cacheCreationInputTokens?: number;
        cacheReadInputTokens?: number;
      }
    | undefined;

  if (anthropic) {
    if (anthropic.cacheReadInputTokens) {
      baseUsage.inputDetails!.cacheRead = anthropic.cacheReadInputTokens;
    }
    if (anthropic.cacheCreationInputTokens) {
      baseUsage.inputDetails!.cacheWrite = anthropic.cacheCreationInputTokens;
    }
    // For Anthropic, adjust inputTokens to include cache tokens
    if (anthropic.cacheReadInputTokens || anthropic.cacheCreationInputTokens) {
      baseUsage.inputTokens =
        (usage.inputTokens ?? 0) +
        (anthropic.cacheReadInputTokens ?? 0) +
        (anthropic.cacheCreationInputTokens ?? 0);
      baseUsage.inputDetails!.text = usage.inputTokens;
    }
  }

  // Google/Gemini: extract from providerMetadata.google.usageMetadata
  // Available in @ai-sdk/google@1.2.23+
  const google = providerMetadata?.google as
    | {
        usageMetadata?: {
          cachedContentTokenCount?: number;
          thoughtsTokenCount?: number;
          promptTokenCount?: number;
          candidatesTokenCount?: number;
        };
      }
    | undefined;

  if (google?.usageMetadata?.cachedContentTokenCount) {
    baseUsage.inputDetails!.cacheRead =
      google.usageMetadata.cachedContentTokenCount;
  }
  // Gemini "thoughts" are similar to reasoning tokens
  if (google?.usageMetadata?.thoughtsTokenCount) {
    baseUsage.outputDetails!.reasoning =
      google.usageMetadata.thoughtsTokenCount;
  }

  // OpenRouter: Uses OpenAI-compatible structure in usage object
  // Per https://openrouter.ai/docs/guides/guides/usage-accounting
  // Note: OpenRouter only supports cache READ, not cache WRITE tokens
  // The AI SDK should normalize this to cachedInputTokens in usage

  return baseUsage;
}
```

**Providers investigated for providerMetadata:**

- [x] **Anthropic** - `cacheCreationInputTokens`, `cacheReadInputTokens` in `providerMetadata.anthropic`
- [x] **OpenAI** - `cachedInputTokens` directly in `usage` object (not in providerMetadata)
- [x] **Google/Gemini** - `cachedContentTokenCount`, `thoughtsTokenCount` in `providerMetadata.google.usageMetadata`
  - Gemini 2.5: 75% implicit cache discount, 90% explicit cache discount
  - Gemini 2.0: 75% cache discount
- [x] **OpenRouter** - Uses OpenAI-compatible structure: `prompt_tokens_details.cached_tokens`
  - Per [OpenRouter docs](https://openrouter.ai/docs/guides/guides/usage-accounting)
  - Only cache READ supported, no cache WRITE tokens available
  - AI SDK should normalize to `cachedInputTokens` in usage
- [ ] **Amazon Bedrock** - may have Anthropic-compatible fields when using Claude models
- [ ] **Azure OpenAI** - likely same as OpenAI (cachedInputTokens in usage)

### Phase 3: Update Token Extraction Points

1. **`transform.ts`** - Extract cache tokens when processing `finish` chunk
2. **`model.loop.ts`** - Pass extended usage to span tracker
3. **`output.ts`** - Ensure cache tokens flow through to final usage

### Phase 4: Update Exporters

1. **Braintrust** - Map to `prompt_cached_tokens`, `prompt_cache_creation_tokens`
2. **Langfuse** - Map to `cache_read_input_tokens` and appropriate fields
3. **LangSmith** - Map to nested `input_token_details` / `output_token_details`
4. **PostHog** - Map to documented properties (verify field names)
5. **OTEL/Arize** - Map to OpenInference semantic convention attributes

### Phase 5: Testing

1. Add unit tests for `extractCacheTokensFromProviderMetadata`
2. Add integration tests with mocked provider responses for:
   - Anthropic with cache creation
   - Anthropic with cache read
   - OpenAI with cached tokens
3. Verify correct token reporting in each exporter

---

## References

- [Braintrust Custom LLM Wrapping](https://www.braintrust.dev/docs/guides/traces/customize#wrap-a-custom-llm-client)
- [Langfuse Token and Cost Tracking](https://langfuse.com/docs/observability/features/token-and-cost-tracking)
- [LangSmith UsageMetadata](https://docs.smith.langchain.com/reference/js/types/schemas.UsageMetadata)
- [PostHog LLM Analytics](https://posthog.com/docs/llm-analytics/generations)
- [OpenInference Semantic Conventions](https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md)
- [Anthropic Prompt Caching](https://docs.claude.com/en/docs/build-with-claude/prompt-caching)
- [OpenAI Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching)
