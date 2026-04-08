# Gateway API Endpoints Reference

Complete reference for Gateway API endpoints.

## Base URLs

| Environment | URL |
|-------------|-----|
| Production  | `https://server.mastra.ai` |
| Staging     | `https://server.staging.mastra.ai` |

## Authentication

All requests require the `Authorization` header:

```
Authorization: Bearer msk_your_api_key
```

## Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | API key: `Bearer msk_xxx` |
| `Content-Type` | Yes | `application/json` |
| `x-thread-id` | No | Thread ID for memory persistence |
| `x-resource-id` | No | Resource ID for grouping threads |
| `x-openai-api-key` | No | BYOK: OpenAI key |
| `x-anthropic-api-key` | No | BYOK: Anthropic key |
| `x-google-api-key` | No | BYOK: Google key |

## Chat Completions

**POST** `/v1/chat/completions`

OpenAI-compatible chat completions endpoint.

### Request

```json
{
  "model": "openai/gpt-4o",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant"},
    {"role": "user", "content": "Hello!"}
  ],
  "temperature": 0.7,
  "max_tokens": 1000,
  "stream": false
}
```

### Response

```json
{
  "id": "gen-xxx",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "openai/gpt-4o",
  "provider": "OpenAI",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you today?"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 10,
    "total_tokens": 30,
    "cost": 0.00015,
    "is_byok": false
  }
}
```

## Completions (Legacy)

**POST** `/v1/completions`

Legacy completions endpoint.

> **Note:** This endpoint may not be implemented. Test and report status.

### Request

```json
{
  "model": "openai/gpt-4o",
  "prompt": "Say hello",
  "max_tokens": 100
}
```

## Responses

**POST** `/v1/responses`

Alternative response format.

### Request

```json
{
  "model": "openai/gpt-4o",
  "input": "What is 2+2?"
}
```

## Memory API

All memory/thread operations are under the `/v1/memory` prefix.

### List Threads

**GET** `/v1/memory/threads`

Query params: `resourceId`, `limit`, `offset`

Returns all threads for the authenticated project.

### Create Thread

**POST** `/v1/memory/threads`

```json
{
  "id": "optional-thread-id",
  "resourceId": "required-resource-id",
  "title": "Optional title",
  "metadata": {}
}
```

> **Note:** `resourceId` is required.

### Get Thread

**GET** `/v1/memory/threads/{threadId}`

Returns a specific thread.

### Update Thread

**PATCH** `/v1/memory/threads/{threadId}`

```json
{
  "title": "Updated title",
  "metadata": {}
}
```

### Delete Thread

**DELETE** `/v1/memory/threads/{threadId}`

Deletes a thread and its messages.

### Get Messages

**GET** `/v1/memory/threads/{threadId}/messages`

Query params: `limit`, `offset`, `order` (asc/desc)

Returns messages in a thread.

### Save Messages

**POST** `/v1/memory/threads/{threadId}/messages`

```json
{
  "messages": [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi there!"}
  ]
}
```

### Delete Messages

**DELETE** `/v1/memory/threads/{threadId}/messages`

```json
{
  "messageIds": ["msg-1", "msg-2"]
}
```

## Observational Memory (OM) API

### Get OM Record

**GET** `/v1/memory/threads/{threadId}/observations/record`

Returns the OM record for a thread.

### Get Observations

**GET** `/v1/memory/threads/{threadId}/observations`

Returns the current observations string.

### Get OM History

**GET** `/v1/memory/threads/{threadId}/observations/history`

Returns observation history.

### Update OM Config

**PATCH** `/v1/memory/threads/{threadId}/observations/config`

```json
{
  "messageTokens": 7000
}
```

Updates per-thread OM threshold settings.

## Models

### Supported Model Formats

Models must use `provider/model` format:

| Provider | Example Models |
|----------|----------------|
| OpenAI | `openai/gpt-4o`, `openai/gpt-4o-mini`, `openai/gpt-5` |
| Anthropic | `anthropic/claude-sonnet-4-20250514`, `anthropic/claude-opus-4-20250514` |
| Google | `google/gemini-1.5-pro`, `google/gemini-2.0-flash` |

## Error Responses

### 401 Unauthorized

```json
{
  "error": {
    "message": "Invalid API key",
    "type": "authentication_error"
  }
}
```

### 400 Bad Request

```json
{
  "error": {
    "message": "Invalid model format",
    "type": "invalid_request_error"
  }
}
```

### 429 Rate Limited

```json
{
  "error": {
    "message": "Rate limit exceeded",
    "type": "rate_limit_error"
  }
}
```
