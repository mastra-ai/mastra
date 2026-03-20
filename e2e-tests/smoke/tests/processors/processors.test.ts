import { describe, it, expect } from 'vitest';
import { fetchJson, fetchApi } from '../utils.js';

/**
 * Helper to build a message payload for the execute endpoint.
 * The processor handler wraps these into a MessageList internally.
 */
function makeMessage(role: 'user' | 'assistant' | 'system', text: string) {
  return {
    id: crypto.randomUUID(),
    role,
    createdAt: new Date().toISOString(),
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
    },
  };
}

/**
 * Helper to build a message with mixed part types (text + tool-call).
 */
function makeMixedMessage(role: 'user' | 'assistant', text: string) {
  return {
    id: crypto.randomUUID(),
    role,
    createdAt: new Date().toISOString(),
    content: {
      format: 2,
      parts: [
        { type: 'text', text },
        { type: 'tool-invocation', toolCallId: 'call-123', toolName: 'calculator', state: 'call', args: { a: 1 } },
      ],
    },
  };
}

describe('processors', () => {
  describe('GET /processors', () => {
    it('should list all registered processors', async () => {
      const { status, data } = await fetchJson<Record<string, any>>('/api/processors');

      expect(status).toBe(200);

      // Verify all three processors are present
      expect(data).toHaveProperty('uppercase');
      expect(data).toHaveProperty('suffix');
      expect(data).toHaveProperty('tripwire-test');

      // Verify uppercase processor shape
      expect(data['uppercase']).toMatchObject({
        id: 'uppercase',
        name: 'Uppercase Processor',
        description: 'Uppercases all text content in messages',
        phases: ['input'],
        isWorkflow: false,
      });
      expect(data['uppercase'].agentIds).toBeInstanceOf(Array);
      expect(data['uppercase'].configurations).toBeInstanceOf(Array);

      // Verify suffix processor has both input and outputResult phases
      expect(data['suffix']).toMatchObject({
        id: 'suffix',
        name: 'Suffix Processor',
        phases: expect.arrayContaining(['input', 'outputResult']),
        isWorkflow: false,
      });

      // Verify tripwire processor
      expect(data['tripwire-test']).toMatchObject({
        id: 'tripwire-test',
        name: 'Tripwire Test Processor',
        phases: ['input'],
        isWorkflow: false,
      });
    });
  });

  describe('GET /processors/:processorId', () => {
    it('should return processor details by ID', async () => {
      const { status, data } = await fetchJson<any>('/api/processors/uppercase');

      expect(status).toBe(200);
      expect(data).toMatchObject({
        id: 'uppercase',
        name: 'Uppercase Processor',
        description: 'Uppercases all text content in messages',
        phases: ['input'],
        isWorkflow: false,
      });
      expect(data.configurations).toBeInstanceOf(Array);
    });

    it('should return suffix processor with both phases', async () => {
      const { status, data } = await fetchJson<any>('/api/processors/suffix');

      expect(status).toBe(200);
      expect(data).toMatchObject({
        id: 'suffix',
        name: 'Suffix Processor',
        isWorkflow: false,
      });
      expect(data.phases).toContain('input');
      expect(data.phases).toContain('outputResult');
    });

    it('should return 404 for non-existent processor', async () => {
      const res = await fetchApi('/api/processors/does-not-exist');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /processors/:processorId/execute', () => {
    it('should execute uppercase processor on input phase', async () => {
      const { status, data } = await fetchJson<any>('/api/processors/uppercase/execute', {
        method: 'POST',
        body: JSON.stringify({
          phase: 'input',
          messages: [makeMessage('user', 'hello world')],
        }),
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.phase).toBe('input');
      expect(data.messages).toHaveLength(1);
      expect(data.messages[0].content.parts).toContainEqual(
        expect.objectContaining({ type: 'text', text: 'HELLO WORLD' }),
      );
    });

    it('should execute suffix processor on input phase', async () => {
      const { status, data } = await fetchJson<any>('/api/processors/suffix/execute', {
        method: 'POST',
        body: JSON.stringify({
          phase: 'input',
          messages: [makeMessage('user', 'test message')],
        }),
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.phase).toBe('input');
      expect(data.messages).toHaveLength(1);
      expect(data.messages[0].content.parts).toContainEqual(
        expect.objectContaining({ type: 'text', text: 'test message [processed]' }),
      );
    });

    it('should execute suffix processor on outputResult phase', async () => {
      const { status, data } = await fetchJson<any>('/api/processors/suffix/execute', {
        method: 'POST',
        body: JSON.stringify({
          phase: 'outputResult',
          messages: [makeMessage('assistant', 'response text')],
        }),
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.phase).toBe('outputResult');
      expect(data.messages).toHaveLength(1);
      expect(data.messages[0].content.parts).toContainEqual(
        expect.objectContaining({ type: 'text', text: 'response text [output-processed]' }),
      );
    });

    it('should process multiple messages at once', async () => {
      const { status, data } = await fetchJson<any>('/api/processors/uppercase/execute', {
        method: 'POST',
        body: JSON.stringify({
          phase: 'input',
          messages: [
            makeMessage('user', 'first message'),
            makeMessage('user', 'second message'),
          ],
        }),
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.messages).toHaveLength(2);
      expect(data.messages[0].content.parts).toContainEqual(
        expect.objectContaining({ type: 'text', text: 'FIRST MESSAGE' }),
      );
      expect(data.messages[1].content.parts).toContainEqual(
        expect.objectContaining({ type: 'text', text: 'SECOND MESSAGE' }),
      );
    });

    it('should preserve non-text parts while transforming text parts', async () => {
      const { status, data } = await fetchJson<any>('/api/processors/uppercase/execute', {
        method: 'POST',
        body: JSON.stringify({
          phase: 'input',
          messages: [makeMixedMessage('user', 'hello world')],
        }),
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.messages).toHaveLength(1);

      const parts = data.messages[0].content.parts;
      // Text part should be uppercased
      expect(parts).toContainEqual(
        expect.objectContaining({ type: 'text', text: 'HELLO WORLD' }),
      );
      // Tool invocation part should be preserved unchanged
      expect(parts).toContainEqual(
        expect.objectContaining({ type: 'tool-invocation', toolName: 'calculator' }),
      );
    });

    it('should trigger tripwire with metadata when message contains BLOCK', async () => {
      const { status, data } = await fetchJson<any>('/api/processors/tripwire-test/execute', {
        method: 'POST',
        body: JSON.stringify({
          phase: 'input',
          messages: [makeMessage('user', 'this should BLOCK')],
        }),
      });

      expect(status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.phase).toBe('input');
      expect(data.tripwire).toMatchObject({
        triggered: true,
        reason: 'Content blocked by policy',
        metadata: { trigger: 'BLOCK' },
      });
    });

    it('should pass through when tripwire is not triggered', async () => {
      const { status, data } = await fetchJson<any>('/api/processors/tripwire-test/execute', {
        method: 'POST',
        body: JSON.stringify({
          phase: 'input',
          messages: [makeMessage('user', 'this is fine')],
        }),
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.phase).toBe('input');
      expect(data.tripwire).toBeUndefined();
      expect(data.messages).toHaveLength(1);
    });

    it('should compose input and outputResult phases independently', async () => {
      const inputMsg = makeMessage('user', 'compose test');

      // Run input phase
      const { status: inputStatus, data: inputData } = await fetchJson<any>('/api/processors/suffix/execute', {
        method: 'POST',
        body: JSON.stringify({ phase: 'input', messages: [inputMsg] }),
      });

      expect(inputStatus).toBe(200);
      expect(inputData.success).toBe(true);
      expect(inputData.messages).toHaveLength(1);
      expect(inputData.messages[0].content.parts).toContainEqual(
        expect.objectContaining({ type: 'text', text: 'compose test [processed]' }),
      );

      // Run outputResult phase with the input-processed message
      const { status: outputStatus, data: outputData } = await fetchJson<any>('/api/processors/suffix/execute', {
        method: 'POST',
        body: JSON.stringify({ phase: 'outputResult', messages: inputData.messages }),
      });

      expect(outputStatus).toBe(200);
      expect(outputData.success).toBe(true);
      expect(outputData.messages).toHaveLength(1);
      expect(outputData.messages[0].content.parts).toContainEqual(
        expect.objectContaining({ type: 'text', text: 'compose test [processed] [output-processed]' }),
      );
    });

    it('should handle empty messages array', async () => {
      const { status, data } = await fetchJson<any>('/api/processors/uppercase/execute', {
        method: 'POST',
        body: JSON.stringify({
          phase: 'input',
          messages: [],
        }),
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.messages).toHaveLength(0);
    });

    it('should return 400 when phase is missing', async () => {
      const res = await fetchApi('/api/processors/uppercase/execute', {
        method: 'POST',
        body: JSON.stringify({
          messages: [makeMessage('user', 'test')],
        }),
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 when messages is missing', async () => {
      const res = await fetchApi('/api/processors/uppercase/execute', {
        method: 'POST',
        body: JSON.stringify({
          phase: 'input',
        }),
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for unsupported phase on processor', async () => {
      const res = await fetchApi('/api/processors/uppercase/execute', {
        method: 'POST',
        body: JSON.stringify({
          phase: 'outputResult',
          messages: [makeMessage('user', 'test')],
        }),
      });

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent processor', async () => {
      const res = await fetchApi('/api/processors/nope/execute', {
        method: 'POST',
        body: JSON.stringify({
          phase: 'input',
          messages: [makeMessage('user', 'test')],
        }),
      });

      expect(res.status).toBe(404);
    });
  });
});
