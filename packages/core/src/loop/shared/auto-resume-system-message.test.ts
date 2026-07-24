import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../../agent/message-list';
import {
  appendSuffixToLeadingSystemMessage,
  applyAutoResumeSystemMessage,
  buildAutoResumeSystemMessageSuffix,
  extractSuspendedToolsFromMessages,
} from './auto-resume-system-message';

function makeAssistantMessage(overrides: {
  metadata?: Record<string, unknown>;
  parts?: Array<{ type: string; data?: unknown }>;
}): MastraDBMessage {
  return {
    id: 'a',
    role: 'assistant',
    createdAt: new Date(),
    threadId: 't',
    resourceId: 'r',
    content: {
      format: 3,
      metadata: overrides.metadata,
      parts: (overrides.parts ?? []) as MastraDBMessage['content']['parts'],
      content: '',
    },
  } as unknown as MastraDBMessage;
}

const baseInputMessages: LanguageModelV2Prompt = [
  { role: 'system', content: 'You are helpful.' },
  { role: 'user', content: [{ type: 'text', text: 'hi' }] },
];

describe('extractSuspendedToolsFromMessages', () => {
  it('returns [] when no assistant message has suspended/approval state', () => {
    const messages = [makeAssistantMessage({ parts: [{ type: 'text', data: undefined }] })];
    expect(extractSuspendedToolsFromMessages(messages)).toEqual([]);
  });

  it('reads suspendedTools metadata when present', () => {
    const suspended = { fooTool: { toolName: 'fooTool', resumeSchema: {} } };
    const messages = [makeAssistantMessage({ metadata: { suspendedTools: suspended } })];
    expect(extractSuspendedToolsFromMessages(messages)).toEqual([suspended.fooTool]);
  });

  it('reads pendingToolApprovals metadata as a fallback', () => {
    const pending = { approveMe: { toolName: 'approveMe', type: 'approval' } };
    const messages = [makeAssistantMessage({ metadata: { pendingToolApprovals: pending } })];
    expect(extractSuspendedToolsFromMessages(messages)).toEqual([pending.approveMe]);
  });

  it('falls back to data-tool-call-suspended parts when metadata is absent', () => {
    const messages = [
      makeAssistantMessage({
        parts: [
          { type: 'data-tool-call-suspended', data: { toolName: 'fooTool', args: { a: 1 } } },
          { type: 'data-tool-call-approval', data: { toolName: 'bar', resumed: true } },
        ],
      }),
    ];
    const result = extractSuspendedToolsFromMessages(messages);
    expect(result).toHaveLength(1);
    expect((result[0] as { toolName: string }).toolName).toBe('fooTool');
  });

  it('walks assistant messages newest-to-oldest', () => {
    const newerSuspended = { newer: { toolName: 'newer' } };
    const messages = [
      makeAssistantMessage({ metadata: { suspendedTools: { older: { toolName: 'older' } } } }),
      makeAssistantMessage({ metadata: { suspendedTools: newerSuspended } }),
    ];
    expect(extractSuspendedToolsFromMessages(messages)).toEqual([newerSuspended.newer]);
  });
});

describe('buildAutoResumeSystemMessageSuffix', () => {
  it('returns null on empty input', () => {
    expect(buildAutoResumeSystemMessageSuffix([])).toBeNull();
  });

  it('embeds the suspended tools JSON into the suffix', () => {
    const suffix = buildAutoResumeSystemMessageSuffix([{ toolName: 'fooTool' }]);
    expect(suffix).not.toBeNull();
    expect(suffix!).toContain('Analyse the suspended tools');
    expect(suffix!).toContain('fooTool');
  });

  it('omits parentRunId from the serialized suspended tools', () => {
    const suffix = buildAutoResumeSystemMessageSuffix([
      {
        toolName: 'fooTool',
        runId: 'sub-run',
        parentRunId: 'parent-run',
        toolCallId: 'call-1',
      },
    ]);
    expect(suffix).not.toBeNull();
    expect(suffix!).toContain('"runId":"sub-run"');
    expect(suffix!).toContain('"toolName":"fooTool"');
    expect(suffix!).not.toContain('parentRunId');
    expect(suffix!).not.toContain('parent-run');
  });
});

describe('appendSuffixToLeadingSystemMessage', () => {
  it('returns the prompt unchanged when suffix is null', () => {
    expect(appendSuffixToLeadingSystemMessage(baseInputMessages, null)).toBe(baseInputMessages);
  });

  it('appends suffix to a leading system message only', () => {
    const result = appendSuffixToLeadingSystemMessage(baseInputMessages, '\nEXTRA');
    expect((result[0] as { role: string; content: string }).content).toBe('You are helpful.\nEXTRA');
    expect(result[1]).toBe(baseInputMessages[1]);
  });

  it('does not append when first message is not a system message', () => {
    const promptWithoutSystem: LanguageModelV2Prompt = [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }];
    const result = appendSuffixToLeadingSystemMessage(promptWithoutSystem, '\nEXTRA');
    expect(result).toEqual(promptWithoutSystem);
  });
});

describe('applyAutoResumeSystemMessage', () => {
  it('returns the prompt unchanged when autoResume is false', () => {
    const messages = [makeAssistantMessage({ metadata: { suspendedTools: { foo: { toolName: 'foo' } } } })];
    expect(applyAutoResumeSystemMessage({ autoResume: false, inputMessages: baseInputMessages, messages })).toBe(
      baseInputMessages,
    );
  });

  it('returns the prompt unchanged when there are no suspended tools', () => {
    expect(applyAutoResumeSystemMessage({ autoResume: true, inputMessages: baseInputMessages, messages: [] })).toBe(
      baseInputMessages,
    );
  });

  it('rewrites the leading system message when suspended tools exist', () => {
    const messages = [makeAssistantMessage({ metadata: { suspendedTools: { fooTool: { toolName: 'fooTool' } } } })];
    const result = applyAutoResumeSystemMessage({
      autoResume: true,
      inputMessages: baseInputMessages,
      messages,
    });
    const sys = result[0] as { role: string; content: string };
    expect(sys.role).toBe('system');
    expect(sys.content).toContain('You are helpful.');
    expect(sys.content).toContain('Analyse the suspended tools');
    expect(sys.content).toContain('fooTool');
  });
});
