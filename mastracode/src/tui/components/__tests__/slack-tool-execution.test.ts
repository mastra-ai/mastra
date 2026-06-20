import { describe, expect, it } from 'vitest';
import { createToolExecutionComponent } from '../tool-execution-factory.js';
import { SlackToolExecutionComponent } from '../slack-tool-execution.js';

const ui = { requestRender() {} } as any;

function stripAnsi(text: string): string {
  return text
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\u001b\]8;;[^\u0007]*\u0007/g, '')
    .replace(/\u001b\]8;;\u0007/g, '');
}

describe('SlackToolExecutionComponent', () => {
  it('renders Slack conversation results as chat messages', () => {
    const component = new SlackToolExecutionComponent('slack_read_conversation', { channel: 'general' }, ui);

    component.updateResult({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            slackMessageRef: {
              channelId: 'C123',
              channelName: 'general',
              channelType: 'public_channel',
              messageTs: '1700000000.000100',
            },
            channel: { id: 'C123', name: 'general', type: 'public_channel' },
            messages: [
              { ts: '1700000000.000100', username: 'Abhi Aiyer', text: 'AIMock is legit' },
              { ts: '1700000010.000100', username: 'Tyler', isCurrentUser: true, text: '<#C123|general> agrees &amp; ships' },
            ],
          }),
        },
      ],
      isError: false,
    });

    const output = stripAnsi(component.render(100).join('\n'));
    expect(output).toContain('Abhi Aiyer');
    expect(output).toContain('AIMock is legit');
    expect(output).toContain('Tyler (you)');
    expect(output).toContain('#general agrees & ships');
    expect(output).toContain('slack #general · 2 messages ✓');
  });

  it('renders pending Slack tool calls with Slack-specific label', () => {
    const component = createToolExecutionComponent(
      'slack_read_thread',
      { channel: 'kindergarten', threadTs: '1700000000.000100' },
      { collapsedByDefault: true },
      ui,
    );

    const output = stripAnsi(component.render(100).join('\n'));
    expect(output).toContain('kindergarten · thread 1700000000.000100');
    expect(output).toContain('slack');
    expect(output).toContain('⋯');
  });

  it('keeps Slack cards readable in quiet mode', () => {
    const component = createToolExecutionComponent(
      'slack_read_conversation',
      { channel: 'kindergarten' },
      { collapsedByDefault: true },
      ui,
    );
    component.setQuietModeDisplay?.('quiet');
    component.updateResult({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            channel: { id: 'C123', name: 'kindergarten', type: 'public_channel' },
            messages: [{ ts: '1700000000.000100', username: 'Tyler', text: 'quiet mode should still show this' }],
          }),
        },
      ],
      isError: false,
    });

    const output = stripAnsi(component.render(100).join('\n'));
    expect(output).toContain('Tyler');
    expect(output).toContain('quiet mode should still show this');
    expect(output).toContain('slack #kindergarten · 1 message ✓');
  });
});
