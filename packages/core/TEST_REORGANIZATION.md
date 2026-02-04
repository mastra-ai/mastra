# Test Reorganization: Integration Tests vs Unit Tests

## Overview

This document describes the reorganization of tests in `packages/core` to separate integration tests (that use real LLM APIs) from unit tests (that use mock models).

## Naming Convention

Tests in this package follow a consistent naming convention:

- **Unit Tests**: `*.test.ts` - Use mock LLM models (e.g., `MockLanguageModelV2`, `createMockModel`, `getDummyResponseModel`)
- **Integration Tests**: `*.integration.test.ts` - Make real API calls to LLM providers (OpenAI, Google, Anthropic, etc.)

## Changes Made

The following test files were renamed from `*.test.ts` to `*.integration.test.ts` because they make real LLM API calls without using mock models:

### Agent Tests

| Original File | New File | Reason |
|--------------|----------|--------|
| `agent/agent-gemini.test.ts` | `agent/agent-gemini.integration.test.ts` | Uses real Gemini models (`google/gemini-2.0-flash-lite`, `google/gemini-3-pro-preview`) |
| `agent/__tests__/image-prompt.test.ts` | `agent/__tests__/image-prompt.integration.test.ts` | Uses real OpenAI models (`openai('gpt-4o')`) |
| `agent/__tests__/stopWhen.test.ts` | `agent/__tests__/stopWhen.integration.test.ts` | Uses real OpenAI models (`openai('gpt-4o-mini')`) |

### LLM/Model Tests

| Original File | New File | Reason |
|--------------|----------|--------|
| `llm/model/model.loop.test.ts` | `llm/model/model.loop.integration.test.ts` | Uses real OpenAI models for stream/generate testing |

### Tools Tests

| Original File | New File | Reason |
|--------------|----------|--------|
| `tools/provider-tools.test.ts` | `tools/provider-tools.integration.test.ts` | Uses real Google Search, OpenAI Web Search, and Anthropic Web Search tools with actual API calls |

### Processors Tests

| Original File | New File | Reason |
|--------------|----------|--------|
| `processors/processors/token-accuracy.test.ts` | `processors/processors/token-accuracy.integration.test.ts` | Uses real OpenAI model to verify token counting accuracy |

### Evals Tests

| Original File | New File | Reason |
|--------------|----------|--------|
| `evals/scorer-custom-gateway.test.ts` | `evals/scorer-custom-gateway.integration.test.ts` | Uses custom gateway that attempts real API calls |

## Files NOT Moved

The following files have "integration" in their names but were not moved because they use mock models (they test component integration, not external API integration):

- `mastra/custom-gateway-integration.test.ts` - Uses mock gateways, no real API calls
- `processors/processors/processors-integration.test.ts` - Uses mock data to test processor chaining
- `tools/__tests__/transform-agent-integration.test.ts` - Uses mock models to test tool transformation
- `tools/unified-integration.test.ts` - Uses `MockLanguageModelV2` for testing tool argument handling

## Pre-existing Integration Tests

These integration test files already existed in the codebase and follow the `.integration.test.ts` naming convention:

- `llm/model/embedding-router.integration.test.ts`
- `llm/model/router.integration.test.ts`
- `llm/model/gateways/azure.integration.test.ts`
- `llm/model/gateways/models-dev.integration.test.ts`
- `llm/model/gateways/netlify.integration.test.ts`

## Running Tests

### Unit Tests Only

To run only unit tests (faster, no API keys required):

```bash
pnpm test:core --exclude '**/*.integration.test.ts'
```

### Integration Tests Only

To run integration tests (requires API keys):

```bash
pnpm test:core --include '**/*.integration.test.ts'
```

### All Tests

To run all tests:

```bash
pnpm test:core
```

## Mock Utilities

The following mock utilities are used for unit tests:

- `test-utils/llm-mock.ts` - Provides `createMockModel` and `MockLanguageModel*` classes
- `agent/__tests__/mock-model.ts` - Provides `getDummyResponseModel`, `getSingleDummyResponseModel`, `getEmptyResponseModel`, `getErrorResponseModel`
- `@internal/ai-sdk-v5/test` - Provides `MockLanguageModelV2`

When writing new tests, prefer using these mock utilities to avoid making real API calls in unit tests.

## Why This Matters

1. **Faster CI/CD**: Unit tests can run quickly without waiting for API responses
2. **No API Key Requirements**: Unit tests don't require API keys to be configured
3. **Deterministic Results**: Mock models provide consistent, predictable responses
4. **Cost Savings**: Avoids API costs during development and testing
5. **Isolation**: Unit tests can run offline and in any environment
