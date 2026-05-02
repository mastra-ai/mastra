import type { UIMessage } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';

import { prepareServerHistoryRequest } from '../transport';

describe('prepareServerHistoryRequest', () => {
  it('sends only the latest submitted message', () => {
    const prepareRequest = prepareServerHistoryRequest<UIMessage>();
    const latestMessage: UIMessage = {
      id: 'user-2',
      role: 'user',
      parts: [{ type: 'text', text: 'Second question' }],
    };

    expect(
      prepareRequest({
        id: 'thread-1',
        trigger: 'submit-message',
        messages: [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'First question' }] }, latestMessage],
      }),
    ).toEqual({
      body: {
        id: 'thread-1',
        trigger: 'submit-message',
        message: latestMessage,
      },
    });
  });

  it('sends only the target assistant message id for regeneration', () => {
    const prepareRequest = prepareServerHistoryRequest<UIMessage>();

    expect(
      prepareRequest({
        id: 'thread-1',
        trigger: 'regenerate-message',
        messageId: 'assistant-1',
        messages: [{ id: 'assistant-1', role: 'assistant', parts: [{ type: 'text', text: 'Old answer' }] }],
      }),
    ).toEqual({
      body: {
        id: 'thread-1',
        trigger: 'regenerate-message',
        messageId: 'assistant-1',
      },
    });
  });

  it('requires a message for submit requests', () => {
    const prepareRequest = prepareServerHistoryRequest<UIMessage>();

    expect(() =>
      prepareRequest({
        id: 'thread-1',
        trigger: 'submit-message',
        messages: [],
      }),
    ).toThrow('A message is required when submitting with server history');
  });

  it('sends compact resume data for a trailing approval response', () => {
    const prepareRequest = prepareServerHistoryRequest<any>();

    expect(
      prepareRequest({
        id: 'thread-1',
        messages: [
          {
            id: 'assistant-1',
            role: 'assistant',
            parts: [
              {
                type: 'dynamic-tool',
                state: 'approval-responded',
                approval: {
                  id: 'run-123::tool-call-1',
                  approved: false,
                  reason: 'No',
                },
              },
            ],
          },
        ],
      }),
    ).toEqual({
      body: {
        id: 'thread-1',
        runId: 'run-123',
        resumeData: {
          approved: false,
          reason: 'No',
        },
        messageId: 'assistant-1',
      },
    });
  });
});
