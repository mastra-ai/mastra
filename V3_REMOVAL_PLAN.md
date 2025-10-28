# MastraMessageV3 Removal Plan

## Overview

Remove MastraMessageV3 as an intermediary format and create direct V2 ↔ AIV5 conversions while preserving all transformation logic.

## Current Conversion Chains

### V2 → AIV5 UI

1. `mastraMessageV2ToMastraMessageV3` (V2 → V3)
2. `mastraMessageV3ToAIV5UIMessage` (V3 → AIV5 UI)

### AIV5 UI → V2

1. `aiV5UIMessageToMastraMessageV3` (AIV5 UI → V3)
2. `mastraMessageV3ToV2` (V3 → V2)

### AIV5 Model → V2

1. `aiV5ModelMessageToMastraMessageV3` (AIV5 Model → V3)
2. `mastraMessageV3ToV2` (V3 → V2)

## New Direct Conversion Methods

### 1. `mastraMessageV2ToAIV5UIMessage(v2Msg: MastraMessageV2): AIV5Type.UIMessage`

**Logic to preserve from V2→V3→AIV5:**

From `mastraMessageV2ToMastraMessageV3`:

- Convert V2 content to parts array
- Handle tool invocations (convert to tool-call/tool-result parts)
- Handle reasoning parts
- Handle file parts (experimental_attachments)
- Handle text content
- Preserve metadata

From `mastraMessageV3ToAIV5UIMessage`:

- Move createdAt, threadId, resourceId into metadata
- Keep parts as-is
- Return AIV5 UIMessage structure

**Combined Direct Logic:**

```typescript
private static mastraMessageV2ToAIV5UIMessage(v2Msg: MastraMessageV2): AIV5Type.UIMessage {
  const parts: AIV5Type.UIMessagePart[] = [];
  const metadata: Record<string, any> = { ...(v2Msg.content.metadata || {}) };

  // Add Mastra-specific metadata
  if (v2Msg.createdAt) metadata.createdAt = v2Msg.createdAt;
  if (v2Msg.threadId) metadata.threadId = v2Msg.threadId;
  if (v2Msg.resourceId) metadata.resourceId = v2Msg.resourceId;

  // Convert V2 content to AIV5 parts
  // 1. Handle tool invocations
  if (v2Msg.content.toolInvocations) {
    for (const invocation of v2Msg.content.toolInvocations) {
      if (invocation.state === 'call') {
        parts.push({
          type: `tool-call-${invocation.toolName}`,
          toolCallId: invocation.toolCallId,
          toolName: invocation.toolName,
          args: invocation.args,
          providerMetadata: invocation.callProviderMetadata,
        });
      } else if (invocation.state === 'result') {
        parts.push({
          type: `tool-result-${invocation.toolName}`,
          toolCallId: invocation.toolCallId,
          toolName: invocation.toolName,
          result: invocation.result,
          providerMetadata: invocation.resultProviderMetadata,
        });
      }
    }
  }

  // 2. Handle reasoning
  if (v2Msg.content.reasoning) {
    for (const reasoning of v2Msg.content.reasoning) {
      parts.push({
        type: 'reasoning',
        text: reasoning.text,
        providerMetadata: reasoning.providerMetadata,
      });
    }
  }

  // 3. Handle files (experimental_attachments)
  if (v2Msg.content.experimental_attachments) {
    for (const attachment of v2Msg.content.experimental_attachments) {
      parts.push({
        type: 'file',
        data: attachment.url,
        mediaType: attachment.contentType,
        providerMetadata: attachment.providerMetadata,
      });
    }
  }

  // 4. Handle text content
  if (v2Msg.content.content) {
    if (typeof v2Msg.content.content === 'string') {
      parts.push({ type: 'text', text: v2Msg.content.content });
    } else if (Array.isArray(v2Msg.content.content)) {
      for (const part of v2Msg.content.content) {
        if (part.type === 'text') {
          parts.push({
            type: 'text',
            text: part.text,
            providerMetadata: part.experimental_providerMetadata,
          });
        } else if (part.type === 'image') {
          // Convert image to file part
          parts.push({
            type: 'file',
            data: part.image,
            mediaType: part.mimeType,
            providerMetadata: part.experimental_providerMetadata,
          });
        }
      }
    }
  }

  // 5. Handle parts directly (if present in V2)
  if (v2Msg.content.parts) {
    parts.push(...v2Msg.content.parts);
  }

  return {
    id: v2Msg.id,
    role: v2Msg.role,
    metadata,
    parts,
  };
}
```

### 2. `aiV5UIMessageToMastraMessageV2(message: AIV5Type.UIMessage, messageSource: MessageSource): MastraMessageV2`

**Logic to preserve from AIV5→V3→V2:**

From `aiV5UIMessageToMastraMessageV3`:

- Extract parts from AIV5 message
- Handle metadata extraction

From `mastraMessageV3ToV2`:

- Convert parts to V2 content structure
- Build toolInvocations array from tool-call/tool-result parts
- Build reasoning array from reasoning parts
- Build experimental_attachments from file parts
- Build content from text parts
- Extract createdAt, threadId, resourceId from metadata

**Combined Direct Logic:**

```typescript
private aiV5UIMessageToMastraMessageV2(
  message: AIV5Type.UIMessage,
  messageSource: MessageSource
): MastraMessageV2 {
  const content: MastraMessageContentV2 = {
    parts: message.parts || [],
  };

  const toolInvocations: MastraMessageContentV2['toolInvocations'] = [];
  const reasoning: MastraMessageContentV2['reasoning'] = [];
  const experimental_attachments: MastraMessageContentV2['experimental_attachments'] = [];
  const textParts: string[] = [];

  // Process parts
  for (const part of message.parts || []) {
    if (part.type.startsWith('tool-call-')) {
      const toolName = getToolName(part);
      toolInvocations.push({
        state: 'call',
        toolCallId: part.toolCallId,
        toolName,
        args: part.args,
        callProviderMetadata: part.providerMetadata,
      });
    } else if (part.type.startsWith('tool-result-')) {
      const toolName = getToolName(part);
      toolInvocations.push({
        state: 'result',
        toolCallId: part.toolCallId,
        toolName,
        result: part.result,
        resultProviderMetadata: part.providerMetadata,
      });
    } else if (part.type === 'reasoning') {
      reasoning.push({
        text: part.text,
        providerMetadata: part.providerMetadata,
      });
    } else if (part.type === 'file') {
      experimental_attachments.push({
        url: part.data,
        contentType: part.mediaType,
        providerMetadata: part.providerMetadata,
      });
    } else if (part.type === 'text') {
      textParts.push(part.text);
    }
  }

  // Set content fields
  if (toolInvocations.length > 0) content.toolInvocations = toolInvocations;
  if (reasoning.length > 0) content.reasoning = reasoning;
  if (experimental_attachments.length > 0) content.experimental_attachments = experimental_attachments;
  if (textParts.length > 0) {
    content.content = textParts.length === 1 ? textParts[0] : textParts.join('');
  }

  // Extract metadata
  const { createdAt, threadId, resourceId, ...restMetadata } = message.metadata || {};
  if (Object.keys(restMetadata).length > 0) {
    content.metadata = restMetadata;
  }

  return {
    id: message.id,
    role: message.role,
    createdAt: createdAt ? new Date(createdAt) : this.getMessageDate(messageSource),
    threadId: threadId || this.getThreadId(messageSource),
    resourceId: resourceId || this.getResourceId(messageSource),
    format: 2,
    content,
  };
}
```

### 3. `aiV5ModelMessageToMastraMessageV2(message: AIV5Type.ModelMessage, messageSource: MessageSource): MastraMessageV2`

**Logic to preserve from AIV5Model→V3→V2:**

This is more complex as it handles the AIV5 ModelMessage format which has different part types.

From `aiV5ModelMessageToMastraMessageV3`:

- Handle tool-call parts (with `input` field)
- Handle tool-result parts (with `output` field)
- Handle text parts
- Handle file parts (with `mediaType` field)
- Generate IDs and timestamps

From `mastraMessageV3ToV2`:

- Same conversion as above

**Combined Direct Logic:**

```typescript
private aiV5ModelMessageToMastraMessageV2(
  message: AIV5Type.ModelMessage,
  messageSource: MessageSource
): MastraMessageV2 {
  const content: MastraMessageContentV2 = {
    parts: [],
  };

  const toolInvocations: MastraMessageContentV2['toolInvocations'] = [];
  const reasoning: MastraMessageContentV2['reasoning'] = [];
  const experimental_attachments: MastraMessageContentV2['experimental_attachments'] = [];
  const textParts: string[] = [];

  // Process ModelMessage content
  for (const part of message.content) {
    if (part.type === 'tool-call') {
      const aiV5Part: AIV5Type.ToolCallPart = {
        type: `tool-call-${part.toolName}`,
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        args: part.input,
        providerMetadata: part.providerMetadata,
      };
      content.parts!.push(aiV5Part);

      toolInvocations.push({
        state: 'call',
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        args: part.input,
        callProviderMetadata: part.providerMetadata,
      });
    } else if (part.type === 'tool-result') {
      const aiV5Part: AIV5Type.ToolResultPart = {
        type: `tool-result-${part.toolName}`,
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        result: part.output,
        providerMetadata: part.providerMetadata,
      };
      content.parts!.push(aiV5Part);

      toolInvocations.push({
        state: 'result',
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        result: part.output,
        resultProviderMetadata: part.providerMetadata,
      });
    } else if (part.type === 'text') {
      content.parts!.push({
        type: 'text',
        text: part.text,
        providerMetadata: part.providerMetadata,
      });
      textParts.push(part.text);
    } else if (part.type === 'file') {
      const aiV5Part: AIV5Type.FilePart = {
        type: 'file',
        data: part.data,
        mediaType: part.mediaType,
        providerMetadata: part.providerMetadata,
      };
      content.parts!.push(aiV5Part);

      experimental_attachments.push({
        url: part.data,
        contentType: part.mediaType,
        providerMetadata: part.providerMetadata,
      });
    }
  }

  // Set content fields
  if (toolInvocations.length > 0) content.toolInvocations = toolInvocations;
  if (reasoning.length > 0) content.reasoning = reasoning;
  if (experimental_attachments.length > 0) content.experimental_attachments = experimental_attachments;
  if (textParts.length > 0) {
    content.content = textParts.length === 1 ? textParts[0] : textParts.join('');
  }

  return {
    id: randomUUID(),
    role: message.role,
    createdAt: this.getMessageDate(messageSource),
    threadId: this.getThreadId(messageSource),
    resourceId: this.getResourceId(messageSource),
    format: 2,
    content,
  };
}
```

## Changes Required

### 1. Add new direct conversion methods

- Add `mastraMessageV2ToAIV5UIMessage` (static)
- Add `aiV5UIMessageToMastraMessageV2` (instance)
- Add `aiV5ModelMessageToMastraMessageV2` (instance)

### 2. Update all.aiV5.ui() method

Replace:

```typescript
ui: (): AIV5Type.UIMessage[] => this.all.v3().map(MessageList.mastraMessageV3ToAIV5UIMessage),
```

With:

```typescript
ui: (): AIV5Type.UIMessage[] => this.messages.map(MessageList.mastraMessageV2ToAIV5UIMessage),
```

### 3. Update conversion in convertMessageToMastraMessageV2

Replace:

```typescript
if (MessageList.isAIV5ModelMessage(message)) {
  return MessageList.mastraMessageV3ToV2(this.aiV5ModelMessageToMastraMessageV3(message, messageSource));
}
if (MessageList.isAIV5UIMessage(message)) {
  return MessageList.mastraMessageV3ToV2(this.aiV5UIMessageToMastraMessageV3(message, messageSource));
}
```

With:

```typescript
if (MessageList.isAIV5ModelMessage(message)) {
  return this.aiV5ModelMessageToMastraMessageV2(message, messageSource);
}
if (MessageList.isAIV5UIMessage(message)) {
  return this.aiV5UIMessageToMastraMessageV2(message, messageSource);
}
```

### 4. Update aiV5ModelMessagesToAIV4CoreMessages

Replace V3 intermediary with direct V2 conversion

### 5. Update aiV4CoreMessagesToAIV5ModelMessages

Replace V3 intermediary with direct V2 conversion

### 6. Remove V3-related code

- Remove `MastraMessageV3` type definition
- Remove `all.v3()` method
- Remove `remembered.v3()` method
- Remove `input.v3()` method
- Remove `response.v3()` method
- Remove `mastraMessageV2ToMastraMessageV3` method
- Remove `mastraMessageV3ToV2` method
- Remove `mastraMessageV3ToAIV5UIMessage` method
- Remove `aiV5UIMessageToMastraMessageV3` method
- Remove `aiV5ModelMessageToMastraMessageV3` method
- Remove `hydrateMastraMessageV3Fields` method
- Remove `cleanV3Metadata` method
- Remove `isMastraMessageV3` method
- Update `isMastraMessage` to remove V3 check
- Update `isMastraMessageV2` to remove V3 check

### 7. Update type exports

Remove `MastraMessageV3` from exports

### 8. Update tests

- Update all tests that reference V3
- Ensure V2↔AIV5 conversions work correctly
- Verify all transformation logic is preserved

## Testing Strategy

1. Run existing message-list tests
2. Run message-list-v5 tests
3. Run storage adapter integration tests
4. Verify no regressions in:
   - Tool invocation handling
   - Reasoning preservation
   - File/attachment handling
   - Metadata preservation
   - Provider options preservation
