# Test Reorganization: E2E Tests vs Unit Tests

## Overview

This document describes the reorganization of tests in `packages/core` to separate end-to-end tests (that use real LLM APIs) from unit tests (that use mock models).

## Naming Convention

Tests in this package follow a consistent naming convention:

| Pattern | Description | API Keys Required |
|---------|-------------|-------------------|
| `*.test.ts` | Unit tests using mock models | No |
| `*-integration.test.ts` | Component integration tests (multiple components, but with mocks) | No |
| `*.e2e.test.ts` | End-to-end tests hitting real LLM APIs | Yes |

### Key Distinction

- **Unit/Integration tests** (`*.test.ts`, `*-integration.test.ts`): Test components in isolation or together, but use mock LLM models. These are fast, deterministic, and don't require API keys.
- **E2E tests** (`*.e2e.test.ts`): Test against real external services (OpenAI, Google, Anthropic, etc.). These require API keys and make actual network calls.

## E2E Test Files

The following test files use real LLM APIs and are named with `.e2e.test.ts`:

### Agent Tests

| File | APIs Used |
|------|-----------|
| `agent/agent-gemini.e2e.test.ts` | Google Gemini |
| `agent/__tests__/image-prompt.e2e.test.ts` | OpenAI |
| `agent/__tests__/stopWhen.e2e.test.ts` | OpenAI |

### LLM/Model Tests

| File | APIs Used |
|------|-----------|
| `llm/model/model.loop.e2e.test.ts` | OpenAI |
| `llm/model/router.e2e.test.ts` | OpenAI, Anthropic, Google, OpenRouter |
| `llm/model/embedding-router.e2e.test.ts` | OpenAI, Google |
| `llm/model/gateways/azure.e2e.test.ts` | Azure OpenAI |
| `llm/model/gateways/models-dev.e2e.test.ts` | Models.dev Gateway |
| `llm/model/gateways/netlify.e2e.test.ts` | Netlify AI Gateway |

### Tools Tests

| File | APIs Used |
|------|-----------|
| `tools/provider-tools.e2e.test.ts` | Google Search, OpenAI Web Search, Anthropic Web Search |

### Processors Tests

| File | APIs Used |
|------|-----------|
| `processors/processors/token-accuracy.e2e.test.ts` | OpenAI |

### Evals Tests

| File | APIs Used |
|------|-----------|
| `evals/scorer-custom-gateway.e2e.test.ts` | Custom Gateway |

## Component Integration Tests (Using Mocks)

These files have "integration" in their names but use mock models. They test how multiple internal components work together:

- `mastra/custom-gateway-integration.test.ts` - Tests custom gateway configuration
- `processors/processors/processors-integration.test.ts` - Tests processor chaining
- `processors/processors/tool-search-integration.test.ts` - Tests tool search with processors
- `tools/__tests__/transform-agent-integration.test.ts` - Tests tool transforms through agent pipeline
- `tools/unified-integration.test.ts` - Tests tool argument handling across contexts

## Running Tests

### Unit Tests Only (Fast, No API Keys)

```bash
pnpm test:core --exclude '**/*.e2e.test.ts'
```

### E2E Tests Only (Requires API Keys)

```bash
pnpm test:core --include '**/*.e2e.test.ts'
```

### All Tests

```bash
pnpm test:core
```

## Required Environment Variables for E2E Tests

| Variable | Used By |
|----------|---------|
| `OPENAI_API_KEY` | Most e2e tests |
| `ANTHROPIC_API_KEY` | router.e2e.test.ts, provider-tools.e2e.test.ts |
| `GOOGLE_GENERATIVE_AI_API_KEY` | agent-gemini.e2e.test.ts, router.e2e.test.ts, embedding-router.e2e.test.ts |
| `AZURE_OPENAI_API_KEY` | azure.e2e.test.ts |
| `AZURE_OPENAI_ENDPOINT` | azure.e2e.test.ts |
| `OPENROUTER_API_KEY` | router.e2e.test.ts |
| `NETLIFY_TOKEN` | netlify.e2e.test.ts |
| `NETLIFY_SITE_ID` | netlify.e2e.test.ts |

## Mock Utilities for Unit Tests

When writing new tests, use these mock utilities to avoid making real API calls:

- `@internal/ai-sdk-v5/test` - Provides `MockLanguageModelV2`, `convertArrayToReadableStream`
- `@internal/ai-sdk-v4/test` - Provides `MockLanguageModelV1`, `simulateReadableStream`
- `agent/__tests__/mock-model.ts` - Provides `getDummyResponseModel`, `getSingleDummyResponseModel`, `getEmptyResponseModel`, `getErrorResponseModel`

## Why This Matters

1. **Faster CI/CD**: Unit tests run quickly without waiting for API responses
2. **No API Key Requirements**: Unit tests don't require API keys to be configured
3. **Deterministic Results**: Mock models provide consistent, predictable responses
4. **Cost Savings**: Avoids API costs during development and testing
5. **Isolation**: Unit tests can run offline and in any environment
6. **Clear Naming**: `.e2e.test.ts` makes it obvious which tests hit real APIs
