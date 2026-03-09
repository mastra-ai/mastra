/**
 * Tests for LLM mocking.
 *
 * These tests verify the mocking APIs without requiring real API keys.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { createLLMMock, createGatewayMock  } from './llm-mock';
import type {ModelLike} from './llm-mock';

function fakeModel(provider: string, modelId: string): ModelLike {
  return { provider, modelId };
}

describe('createLLMMock', () => {
  const mocks: Array<{ saveAndStop(): Promise<void> }> = [];
  afterAll(async () => {
    for (const m of mocks) await m.saveAndStop();
  });

  it('reads provider and modelId from the model instance', () => {
    const mock = createLLMMock(fakeModel('openai.chat', 'gpt-4o'), { name: 'test-props' });
    mocks.push(mock);
    expect(mock.provider).toBe('openai.chat');
    expect(mock.modelId).toBe('gpt-4o');
  });

  it('uses explicit name when provided', () => {
    const mock = createLLMMock(fakeModel('openai.chat', 'gpt-4o'), { name: 'my-custom-name' });
    mocks.push(mock);
    expect(mock.recordingName).toBe('my-custom-name');
  });

  it('auto-derives recording name from vitest filepath and model', () => {
    const mock = createLLMMock(fakeModel('openai.chat', 'gpt-4o'));
    mocks.push(mock);
    // Should include provider and model slugs
    expect(mock.recordingName).toContain('--openai-chat--gpt-4o');
    // Should not be unknown since we're inside vitest
    expect(mock.recordingName.startsWith('unknown-test')).toBe(false);
  });

  it('normalizes dots and slashes in recording name', () => {
    const mock = createLLMMock(fakeModel('anthropic.messages', 'claude-3.5-sonnet'), {
      name: 'test-normalize',
    });
    mocks.push(mock);
    // Provider and model are not in auto-name since we passed explicit name
    expect(mock.recordingName).toBe('test-normalize');

    // Test auto-derivation with dots
    const mock2 = createLLMMock(fakeModel('anthropic.messages', 'claude-3.5-sonnet'));
    mocks.push(mock2);
    expect(mock2.recordingName).toContain('--anthropic-messages--claude-3-5-sonnet');
  });

  it('exposes the underlying recorder', () => {
    const mock = createLLMMock(fakeModel('openai.chat', 'gpt-4o'), { name: 'test-recorder' });
    mocks.push(mock);
    expect(mock.recorder).toBeDefined();
    expect(mock.recorder.mode).toBe(mock.mode);
  });

  it('has a defined mode', () => {
    const mock = createLLMMock(fakeModel('openai.chat', 'gpt-4o'), { name: 'test-mode' });
    mocks.push(mock);
    expect(['record', 'replay', 'auto', 'live', 'update']).toContain(mock.mode);
  });
});

describe('createGatewayMock', () => {
  const mocks: Array<{ saveAndStop(): Promise<void> }> = [];
  afterAll(async () => {
    for (const m of mocks) await m.saveAndStop();
  });

  it('creates a mock with explicit name', () => {
    const mock = createGatewayMock({ name: 'test-gateway' });
    mocks.push(mock);
    expect(mock.recordingName).toBe('test-gateway');
    expect(mock.mode).toBeDefined();
  });

  it('auto-derives recording name from vitest filepath', () => {
    const mock = createGatewayMock();
    mocks.push(mock);
    // Should derive from test file path, no model suffix
    expect(mock.recordingName.startsWith('unknown-test')).toBe(false);
    // Should NOT contain '--' since there's no model suffix
    expect(mock.recordingName.includes('--')).toBe(false);
  });

  it('exposes the underlying recorder', () => {
    const mock = createGatewayMock({ name: 'test-gw-recorder' });
    mocks.push(mock);
    expect(mock.recorder).toBeDefined();
    expect(mock.recorder.mode).toBe(mock.mode);
  });
});
