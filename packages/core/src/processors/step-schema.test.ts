/**
 * Tests for packages/core/src/processors/step-schema.ts
 *
 * These schemas are the runtime type-gate for all data entering the
 * processor pipeline. Tests verify real validation behaviour — what
 * is accepted, what is rejected, and that discriminated unions route
 * to the correct variant. Covers every Zod schema exported from this
 * module via safeParse().
 */
import { describe, expect, it } from 'vitest';

import {
  DataPartSchema,
  FilePartSchema,
  ImagePartSchema,
  MessageContentSchema,
  MessagePartSchema,
  ProcessorInputPhaseSchema,
  ProcessorInputStepPhaseSchema,
  ProcessorMessageSchema,
  ProcessorOutputResultPhaseSchema,
  ProcessorOutputStepPhaseSchema,
  ProcessorOutputStreamPhaseSchema,
  ProcessorStepInputSchema,
  ReasoningPartSchema,
  SourcePartSchema,
  StepStartPartSchema,
  SystemMessageSchema,
  TextPartSchema,
  ToolInvocationPartSchema,
} from './step-schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ok = (schema: any, input: unknown) => expect(schema.safeParse(input).success).toBe(true);
const fail = (schema: any, input: unknown) => expect(schema.safeParse(input).success).toBe(false);

const fakeMessageList = {} as any;

const baseMsg = {
  id: 'msg-1',
  role: 'user' as const,
  createdAt: new Date(),
  content: { format: 2 as const, parts: [] as any[] },
};

// ---------------------------------------------------------------------------
// TextPartSchema
// ---------------------------------------------------------------------------

describe('TextPartSchema', () => {
  it('accepts { type: "text", text: string }', () => ok(TextPartSchema, { type: 'text', text: 'hello' }));
  it('rejects wrong type literal', () => fail(TextPartSchema, { type: 'image', text: 'x' }));
  it('rejects missing text', () => fail(TextPartSchema, { type: 'text' }));
  it('rejects non-string text', () => fail(TextPartSchema, { type: 'text', text: 42 }));
});

// ---------------------------------------------------------------------------
// ImagePartSchema
// ---------------------------------------------------------------------------

describe('ImagePartSchema', () => {
  it('accepts string image', () => ok(ImagePartSchema, { type: 'image', image: 'https://example.com/img.png' }));
  it('accepts URL instance', () => ok(ImagePartSchema, { type: 'image', image: new URL('https://example.com') }));
  it('accepts Uint8Array', () => ok(ImagePartSchema, { type: 'image', image: new Uint8Array([1, 2, 3]) }));
  it('accepts optional mimeType', () =>
    ok(ImagePartSchema, { type: 'image', image: 'data:img', mimeType: 'image/png' }));
  it('rejects missing image', () => fail(ImagePartSchema, { type: 'image' }));
  it('rejects wrong type literal', () => fail(ImagePartSchema, { type: 'text', image: 'x' }));
});

// ---------------------------------------------------------------------------
// FilePartSchema
// ---------------------------------------------------------------------------

describe('FilePartSchema', () => {
  it('accepts valid file part', () =>
    ok(FilePartSchema, { type: 'file', data: 'base64data', mimeType: 'application/pdf' }));
  it('rejects missing mimeType', () => fail(FilePartSchema, { type: 'file', data: 'x' }));
  it('rejects missing data', () => fail(FilePartSchema, { type: 'file', mimeType: 'image/png' }));
  it('rejects wrong type literal', () => fail(FilePartSchema, { type: 'image', data: 'x', mimeType: 'image/png' }));
});

// ---------------------------------------------------------------------------
// ToolInvocationPartSchema
// ---------------------------------------------------------------------------

describe('ToolInvocationPartSchema', () => {
  const validCall = {
    type: 'tool-invocation',
    toolInvocation: { toolCallId: 'c-1', toolName: 'search', args: {}, state: 'call' },
  };

  it('accepts call state', () => ok(ToolInvocationPartSchema, validCall));
  it('accepts partial-call state', () =>
    ok(ToolInvocationPartSchema, {
      ...validCall,
      toolInvocation: { ...validCall.toolInvocation, state: 'partial-call' },
    }));
  it('accepts result state with result field', () =>
    ok(ToolInvocationPartSchema, {
      ...validCall,
      toolInvocation: { ...validCall.toolInvocation, state: 'result', result: { data: 'ok' } },
    }));
  it('rejects invalid state value', () =>
    fail(ToolInvocationPartSchema, {
      ...validCall,
      toolInvocation: { ...validCall.toolInvocation, state: 'invalid' },
    }));
  it('rejects missing toolCallId', () =>
    fail(ToolInvocationPartSchema, {
      type: 'tool-invocation',
      toolInvocation: { toolName: 'search', args: {}, state: 'call' },
    }));
  it('rejects missing toolName', () =>
    fail(ToolInvocationPartSchema, {
      type: 'tool-invocation',
      toolInvocation: { toolCallId: 'c-1', args: {}, state: 'call' },
    }));
});

// ---------------------------------------------------------------------------
// ReasoningPartSchema
// ---------------------------------------------------------------------------

describe('ReasoningPartSchema', () => {
  it('accepts valid text detail', () =>
    ok(ReasoningPartSchema, {
      type: 'reasoning',
      reasoning: 'thinking',
      details: [{ type: 'text', text: 'step 1' }],
    }));
  it('accepts redacted detail', () =>
    ok(ReasoningPartSchema, {
      type: 'reasoning',
      reasoning: 'hidden',
      details: [{ type: 'redacted', data: 'encrypted' }],
    }));
  it('accepts empty details array', () => ok(ReasoningPartSchema, { type: 'reasoning', reasoning: 'ok', details: [] }));
  it('rejects invalid detail type', () =>
    fail(ReasoningPartSchema, {
      type: 'reasoning',
      reasoning: 'x',
      details: [{ type: 'unknown' }],
    }));
  it('rejects missing reasoning field', () => fail(ReasoningPartSchema, { type: 'reasoning', details: [] }));
});

// ---------------------------------------------------------------------------
// SourcePartSchema
// ---------------------------------------------------------------------------

describe('SourcePartSchema', () => {
  it('accepts valid source with url', () =>
    ok(SourcePartSchema, {
      type: 'source',
      source: { sourceType: 'url', id: 'src-1', url: 'https://example.com', title: 'Example' },
    }));
  it('accepts source without optional url/title', () =>
    ok(SourcePartSchema, { type: 'source', source: { sourceType: 'doc', id: 'doc-1' } }));
  it('rejects missing id', () => fail(SourcePartSchema, { type: 'source', source: { sourceType: 'url' } }));
  it('rejects missing source object', () => fail(SourcePartSchema, { type: 'source' }));
});

// ---------------------------------------------------------------------------
// StepStartPartSchema
// ---------------------------------------------------------------------------

describe('StepStartPartSchema', () => {
  it('accepts { type: "step-start" }', () => ok(StepStartPartSchema, { type: 'step-start' }));
  it('rejects wrong type', () => fail(StepStartPartSchema, { type: 'text' }));
  it('rejects empty object', () => fail(StepStartPartSchema, {}));
});

// ---------------------------------------------------------------------------
// DataPartSchema
// ---------------------------------------------------------------------------

describe('DataPartSchema', () => {
  it('accepts data-prefixed type string', () => ok(DataPartSchema, { type: 'data-custom', id: 'x', data: {} }));
  it('accepts data-* with no id or data', () => ok(DataPartSchema, { type: 'data-stream' }));
  it('rejects type not starting with data-', () => fail(DataPartSchema, { type: 'custom' }));
  it('rejects plain "data" without dash', () => fail(DataPartSchema, { type: 'data' }));
  it('rejects empty type string', () => fail(DataPartSchema, { type: '' }));
});

// ---------------------------------------------------------------------------
// MessagePartSchema (discriminated union)
// ---------------------------------------------------------------------------

describe('MessagePartSchema union', () => {
  it('routes text part', () => ok(MessagePartSchema, { type: 'text', text: 'hi' }));
  it('routes image part', () => ok(MessagePartSchema, { type: 'image', image: 'url' }));
  it('routes file part', () => ok(MessagePartSchema, { type: 'file', data: 'b64', mimeType: 'image/png' }));
  it('routes step-start part', () => ok(MessagePartSchema, { type: 'step-start' }));
  it('routes data-* part', () => ok(MessagePartSchema, { type: 'data-foo' }));
  it('routes tool-invocation part', () =>
    ok(MessagePartSchema, {
      type: 'tool-invocation',
      toolInvocation: { toolCallId: 'c-1', toolName: 'fn', args: {}, state: 'call' },
    }));
  it('rejects completely unknown type', () => fail(MessagePartSchema, { type: 'unknown-xyz-abc' }));
  it('rejects missing type field', () => fail(MessagePartSchema, { text: 'hello' }));
});

// ---------------------------------------------------------------------------
// MessageContentSchema
// ---------------------------------------------------------------------------

describe('MessageContentSchema', () => {
  it('accepts valid content with format=2', () =>
    ok(MessageContentSchema, { format: 2, parts: [{ type: 'text', text: 'hello' }] }));
  it('rejects format=1', () => fail(MessageContentSchema, { format: 1, parts: [] }));
  it('rejects missing parts', () => fail(MessageContentSchema, { format: 2 }));
  it('accepts optional content/metadata/providerMetadata', () =>
    ok(MessageContentSchema, {
      format: 2,
      parts: [],
      content: 'legacy',
      metadata: { key: 'v' },
      providerMetadata: { p: 'd' },
    }));
  it('accepts empty parts array', () => ok(MessageContentSchema, { format: 2, parts: [] }));
});

// ---------------------------------------------------------------------------
// SystemMessageSchema
// ---------------------------------------------------------------------------

describe('SystemMessageSchema', () => {
  it('accepts string content', () => ok(SystemMessageSchema, { role: 'system', content: 'You are a helper.' }));
  it('accepts array of text parts', () =>
    ok(SystemMessageSchema, { role: 'system', content: [{ type: 'text', text: 'instruction' }] }));
  it('rejects non-system role', () => fail(SystemMessageSchema, { role: 'user', content: 'hi' }));
  it('rejects missing content', () => fail(SystemMessageSchema, { role: 'system' }));
  it('rejects missing role', () => fail(SystemMessageSchema, { content: 'hi' }));
});

// ---------------------------------------------------------------------------
// ProcessorMessageSchema
// ---------------------------------------------------------------------------

describe('ProcessorMessageSchema', () => {
  it('accepts a valid user message', () => ok(ProcessorMessageSchema, baseMsg));
  it('accepts all valid roles', () => {
    for (const role of ['user', 'assistant', 'system', 'tool', 'signal'] as const) {
      ok(ProcessorMessageSchema, { ...baseMsg, role });
    }
  });
  it('rejects invalid role', () => fail(ProcessorMessageSchema, { ...baseMsg, role: 'bot' }));
  it('coerces ISO string createdAt to Date', () => {
    const result = ProcessorMessageSchema.safeParse({ ...baseMsg, createdAt: '2024-01-01T00:00:00Z' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.createdAt).toBeInstanceOf(Date);
  });
  it('rejects missing id', () => fail(ProcessorMessageSchema, { ...baseMsg, id: undefined }));
  it('rejects missing content', () => fail(ProcessorMessageSchema, { ...baseMsg, content: undefined }));
  it('rejects wrong content format', () =>
    fail(ProcessorMessageSchema, { ...baseMsg, content: { format: 1, parts: [] } }));
});

// ---------------------------------------------------------------------------
// Phase schemas
// ---------------------------------------------------------------------------

describe('ProcessorInputPhaseSchema', () => {
  it('accepts valid input phase', () =>
    ok(ProcessorInputPhaseSchema, { phase: 'input', messages: [baseMsg], messageList: fakeMessageList }));
  it('rejects wrong phase', () =>
    fail(ProcessorInputPhaseSchema, { phase: 'outputStream', messages: [], messageList: fakeMessageList }));
  it('rejects missing messageList', () => fail(ProcessorInputPhaseSchema, { phase: 'input', messages: [] }));
});

describe('ProcessorInputStepPhaseSchema', () => {
  it('accepts valid inputStep phase with stepNumber', () =>
    ok(ProcessorInputStepPhaseSchema, {
      phase: 'inputStep',
      messages: [baseMsg],
      messageList: fakeMessageList,
      stepNumber: 0,
    }));
  it('rejects missing stepNumber', () =>
    fail(ProcessorInputStepPhaseSchema, { phase: 'inputStep', messages: [], messageList: fakeMessageList }));
  it('rejects non-number stepNumber', () =>
    fail(ProcessorInputStepPhaseSchema, {
      phase: 'inputStep',
      messages: [],
      messageList: fakeMessageList,
      stepNumber: 'first',
    }));
});

describe('ProcessorOutputStreamPhaseSchema', () => {
  it('accepts valid outputStream phase with part', () =>
    ok(ProcessorOutputStreamPhaseSchema, {
      phase: 'outputStream',
      part: { type: 'text-delta', textDelta: 'hello' },
      streamParts: [],
      state: {},
    }));
  it('accepts null part (skip signal)', () =>
    ok(ProcessorOutputStreamPhaseSchema, { phase: 'outputStream', part: null, streamParts: [], state: {} }));
  it('rejects missing state', () =>
    fail(ProcessorOutputStreamPhaseSchema, { phase: 'outputStream', part: null, streamParts: [] }));
  it('rejects missing streamParts', () =>
    fail(ProcessorOutputStreamPhaseSchema, { phase: 'outputStream', part: null, state: {} }));
});

describe('ProcessorOutputResultPhaseSchema', () => {
  it('accepts valid outputResult phase', () =>
    ok(ProcessorOutputResultPhaseSchema, {
      phase: 'outputResult',
      messages: [baseMsg],
      messageList: fakeMessageList,
    }));
  it('accepts optional result field', () =>
    ok(ProcessorOutputResultPhaseSchema, {
      phase: 'outputResult',
      messages: [],
      messageList: fakeMessageList,
      result: { text: 'hi', usage: {}, finishReason: 'stop', steps: [] },
    }));
  it('rejects wrong phase', () =>
    fail(ProcessorOutputResultPhaseSchema, { phase: 'input', messages: [], messageList: fakeMessageList }));
});

describe('ProcessorOutputStepPhaseSchema', () => {
  it('accepts valid outputStep phase', () =>
    ok(ProcessorOutputStepPhaseSchema, {
      phase: 'outputStep',
      messages: [baseMsg],
      messageList: fakeMessageList,
      stepNumber: 1,
    }));
  it('rejects missing stepNumber', () =>
    fail(ProcessorOutputStepPhaseSchema, { phase: 'outputStep', messages: [], messageList: fakeMessageList }));
});

// ---------------------------------------------------------------------------
// ProcessorStepInputSchema — discriminated union on "phase"
// ---------------------------------------------------------------------------

describe('ProcessorStepInputSchema discriminated union', () => {
  it('routes to "input" phase', () =>
    ok(ProcessorStepInputSchema, { phase: 'input', messages: [], messageList: fakeMessageList }));
  it('routes to "inputStep" phase', () =>
    ok(ProcessorStepInputSchema, {
      phase: 'inputStep',
      messages: [],
      messageList: fakeMessageList,
      stepNumber: 0,
    }));
  it('routes to "outputStream" phase', () =>
    ok(ProcessorStepInputSchema, { phase: 'outputStream', part: null, streamParts: [], state: {} }));
  it('routes to "outputResult" phase', () =>
    ok(ProcessorStepInputSchema, { phase: 'outputResult', messages: [], messageList: fakeMessageList }));
  it('routes to "outputStep" phase', () =>
    ok(ProcessorStepInputSchema, {
      phase: 'outputStep',
      messages: [],
      messageList: fakeMessageList,
      stepNumber: 0,
    }));
  it('rejects unknown phase value', () => fail(ProcessorStepInputSchema, { phase: 'unknown', messages: [] }));
  it('rejects missing phase field', () =>
    fail(ProcessorStepInputSchema, { messages: [], messageList: fakeMessageList }));
  it('rejects phase that exists but with wrong required fields', () =>
    fail(ProcessorStepInputSchema, { phase: 'inputStep', messages: [], messageList: fakeMessageList }));
});
