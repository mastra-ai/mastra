import { describe, expect, it } from 'vitest';
import type { Processor } from '../processors';
import { PhaseFilteredProcessor } from './phase-filtered-processor';
import type { ProcessorPhase } from './types';

// A processor that implements all 5 phases
function createFullProcessor(): Processor<'test-full'> {
  return {
    id: 'test-full',
    name: 'Full Test Processor',
    processInput: async ({ messages }) => messages,
    processInputStep: async () => ({ messages: [], systemMessages: [] }),
    processOutputStream: async ({ part }) => part,
    processOutputResult: async ({ messages }) => messages,
    processOutputStep: async ({ messages, text = '', finishReason = 'stop' }) =>
      messages.map(m => ({ ...m, metadata: { text, finishReason } })),
  };
}

// A processor that only implements processInput + processOutputStream
function createPartialProcessor(): Processor<'test-partial'> {
  return {
    id: 'test-partial',
    name: 'Partial Test Processor',
    processInput: async ({ messages }) =>
      messages.map(m => ({
        ...m,
        content: {
          ...m.content,
          parts: m.content.parts.map(p => (p.type === 'text' ? { ...p, text: `[FILTERED] ${p.text}` } : p)),
        },
      })),
    processOutputStream: async ({ part }) => part,
  };
}

describe('PhaseFilteredProcessor', () => {
  it('should expose all phases when all are enabled', () => {
    const inner = createFullProcessor();
    const allPhases: ProcessorPhase[] = [
      'processInput',
      'processInputStep',
      'processOutputStream',
      'processOutputResult',
      'processOutputStep',
    ];
    const filtered = new PhaseFilteredProcessor(inner, allPhases);

    expect(filtered.id).toBe('test-full');
    expect(filtered.name).toBe('Full Test Processor');
    expect(filtered.processInput).toBeDefined();
    expect(filtered.processInputStep).toBeDefined();
    expect(filtered.processOutputStream).toBeDefined();
    expect(filtered.processOutputResult).toBeDefined();
    expect(filtered.processOutputStep).toBeDefined();
  });

  it('should hide disabled phases', () => {
    const inner = createFullProcessor();
    const filtered = new PhaseFilteredProcessor(inner, ['processInput']);

    expect(filtered.processInput).toBeDefined();
    expect(filtered.processInputStep).toBeUndefined();
    expect(filtered.processOutputStream).toBeUndefined();
    expect(filtered.processOutputResult).toBeUndefined();
    expect(filtered.processOutputStep).toBeUndefined();
  });

  it('should not expose a phase the inner processor does not implement', () => {
    const inner = createPartialProcessor();
    // Ask for all 5 phases, but the inner only has processInput + processOutputStream
    const filtered = new PhaseFilteredProcessor(inner, [
      'processInput',
      'processInputStep',
      'processOutputStream',
      'processOutputResult',
      'processOutputStep',
    ]);

    expect(filtered.processInput).toBeDefined();
    expect(filtered.processInputStep).toBeUndefined();
    expect(filtered.processOutputStream).toBeDefined();
    expect(filtered.processOutputResult).toBeUndefined();
    expect(filtered.processOutputStep).toBeUndefined();
  });

  it('should delegate processInput to the inner processor', async () => {
    const inner = createPartialProcessor();
    const filtered = new PhaseFilteredProcessor(inner, ['processInput']);

    const messages = [
      {
        id: '1',
        role: 'user' as const,
        content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'hello' }] },
        createdAt: new Date(),
      },
    ];

    const result = await filtered.processInput!({
      messages,
      abort: (() => {}) as any,
    } as any);

    // The partial processor prepends [FILTERED]
    const resultMessages = Array.isArray(result) ? result : [];
    expect(resultMessages[0]).toBeDefined();
    const textPart = (resultMessages[0] as any).content.parts[0];
    expect(textPart.text).toBe('[FILTERED] hello');
  });

  it('should produce undefined for an empty enabledPhases array', () => {
    const inner = createFullProcessor();
    const filtered = new PhaseFilteredProcessor(inner, []);

    expect(filtered.processInput).toBeUndefined();
    expect(filtered.processInputStep).toBeUndefined();
    expect(filtered.processOutputStream).toBeUndefined();
    expect(filtered.processOutputResult).toBeUndefined();
    expect(filtered.processOutputStep).toBeUndefined();
  });

  it('should bind to the inner processor context (this)', async () => {
    let capturedThis: any;
    const inner: Processor<'context-test'> = {
      id: 'context-test',
      processInput: async function (this: any, { messages }) {
        capturedThis = this;
        return messages;
      },
    };

    const filtered = new PhaseFilteredProcessor(inner, ['processInput']);
    await filtered.processInput!({
      messages: [],
      abort: (() => {}) as any,
    } as any);

    // The method should be bound to the inner processor, not the filtered wrapper
    expect(capturedThis).toBe(inner);
  });

  it('should forward __registerMastra to the inner processor', () => {
    let registeredMastra: any;
    const inner: Processor<'reg-test'> = {
      id: 'reg-test',
      processInput: async ({ messages }) => messages,
      __registerMastra: (mastra: any) => {
        registeredMastra = mastra;
      },
    };

    const filtered = new PhaseFilteredProcessor(inner, ['processInput']);
    const fakeMastra = { isFake: true };
    filtered.__registerMastra(fakeMastra as any);

    expect(registeredMastra).toBe(fakeMastra);
  });
});
