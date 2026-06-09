// @vitest-environment jsdom
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AccumulatorPart } from '../../lib/mastra-db';
import { MessageFactory } from './MessageFactory';
import type {
  DynamicToolPart,
  MessageRenderers,
  MessageRoleRendererProps,
  MessageRoleRenderers,
  MessageStatusRenderers,
} from './types';

afterEach(() => {
  cleanup();
});

const makeMessage = (parts: AccumulatorPart[], role: MastraDBMessage['role'] = 'assistant'): MastraDBMessage => ({
  id: 'm-1',
  role,
  createdAt: new Date(0),
  content: {
    format: 2,
    parts: parts as MastraDBMessage['content']['parts'],
  },
});

const makeMessageWithMetadata = (
  parts: AccumulatorPart[],
  metadata: Record<string, unknown>,
  role: MastraDBMessage['role'] = 'assistant',
): MastraDBMessage => ({
  id: 'm-1',
  role,
  createdAt: new Date(0),
  content: {
    format: 2,
    parts: parts as MastraDBMessage['content']['parts'],
    metadata: metadata as MastraDBMessage['content']['metadata'],
  },
});

/**
 * Build the full set of renderers as spies so each test can assert which
 * renderer fired (and, crucially, which ones did NOT).
 */
const makeSpyRenderers = () => {
  const calls = {
    Text: vi.fn(),
    Reasoning: vi.fn(),
    File: vi.fn(),
    StepStart: vi.fn(),
    ToolInvocation: vi.fn(),
    SourceUrl: vi.fn(),
    SourceDocument: vi.fn(),
    Data: vi.fn(),
    DynamicTool: vi.fn(),
  };

  const renderers: MessageRenderers = {
    Text: part => {
      calls.Text(part);
      return <div data-testid="text">{part.text}</div>;
    },
    Reasoning: part => {
      calls.Reasoning(part);
      return <div data-testid="reasoning">{part.reasoning}</div>;
    },
    File: part => {
      calls.File(part);
      return <div data-testid="file">{part.mimeType}</div>;
    },
    StepStart: part => {
      calls.StepStart(part);
      return <div data-testid="step-start">{part.type}</div>;
    },
    ToolInvocation: part => {
      calls.ToolInvocation(part);
      return <div data-testid="tool-invocation">{part.toolInvocation.toolName}</div>;
    },
    SourceUrl: part => {
      calls.SourceUrl(part);
      return (
        <div data-testid="source" data-source-id={part.sourceId} data-url={part.url}>
          {part.title ?? part.type}
        </div>
      );
    },
    SourceDocument: part => {
      calls.SourceDocument(part);
      return <div data-testid="source-document">{part.title}</div>;
    },
    Data: part => {
      calls.Data(part);
      return <div data-testid="data">{part.type}</div>;
    },
    DynamicTool: part => {
      calls.DynamicTool(part);
      return <div data-testid="dynamic-tool">{part.toolName}</div>;
    },
  };

  return { calls, renderers };
};

// A part as it appears at runtime via the boundary cast in the accumulator.
const asPart = (part: unknown): AccumulatorPart => part as AccumulatorPart;

const textPart = (text: string, textId?: string): AccumulatorPart => ({ type: 'text', text, textId });
const reasoningPart = (reasoning: string): AccumulatorPart => asPart({ type: 'reasoning', reasoning });
const filePart = (): AccumulatorPart => asPart({ type: 'file', mimeType: 'image/png', data: 'AAAA' });
const stepStartPart = (): AccumulatorPart => asPart({ type: 'step-start' });
const toolInvocationPart = (toolCallId: string, toolName: string): AccumulatorPart =>
  asPart({
    type: 'tool-invocation',
    toolInvocation: { state: 'result', toolCallId, toolName, args: {}, result: {} },
  });
// Legacy persisted nested `type: 'source'` shape.
const sourcePart = (): AccumulatorPart =>
  asPart({ type: 'source', source: { sourceType: 'url', id: 's-1', url: 'https://x', title: 'Nested' } });
// Flat runtime `type: 'source-url'` shape pushed by the accumulator.
const sourceUrlPart = (): AccumulatorPart =>
  asPart({ type: 'source-url', sourceId: 's-2', url: 'https://flat', title: 'Flat' });
const sourceDocumentPart = (): AccumulatorPart =>
  asPart({ type: 'source-document', sourceId: 's-1', mediaType: 'text/plain', title: 'Doc' });
const dataPart = (type: `data-${string}`): AccumulatorPart => asPart({ type, data: { ok: true } });
const dynamicToolPart = (toolName: string, toolCallId: string): AccumulatorPart =>
  asPart({ type: 'dynamic-tool', toolName, toolCallId, state: 'output-available', input: {}, output: {} });
const v5ToolPart = (toolName: `tool-${string}`, toolCallId: string): AccumulatorPart =>
  asPart({ type: toolName, toolName, toolCallId, state: 'output-available' });

describe('MessageFactory', () => {
  it('renders text via the Text renderer and fires no other renderer', () => {
    const { calls, renderers } = makeSpyRenderers();
    render(<MessageFactory message={makeMessage([textPart('hello')])} {...renderers} />);

    expect(screen.getByTestId('text').textContent).toBe('hello');
    expect(calls.Text).toHaveBeenCalledTimes(1);
    expect(calls.Reasoning).not.toHaveBeenCalled();
    expect(calls.DynamicTool).not.toHaveBeenCalled();
    expect(calls.Data).not.toHaveBeenCalled();
  });

  it('renders reasoning only via the Reasoning renderer', () => {
    const { calls, renderers } = makeSpyRenderers();
    render(<MessageFactory message={makeMessage([reasoningPart('thinking')])} {...renderers} />);

    expect(screen.getByTestId('reasoning').textContent).toBe('thinking');
    expect(calls.Reasoning).toHaveBeenCalledTimes(1);
    expect(calls.Text).not.toHaveBeenCalled();
  });

  it('renders file only via the File renderer', () => {
    const { calls, renderers } = makeSpyRenderers();
    render(<MessageFactory message={makeMessage([filePart()])} {...renderers} />);

    expect(screen.getByTestId('file').textContent).toBe('image/png');
    expect(calls.File).toHaveBeenCalledTimes(1);
  });

  it('renders step-start only via the StepStart renderer', () => {
    const { calls, renderers } = makeSpyRenderers();
    render(<MessageFactory message={makeMessage([stepStartPart()])} {...renderers} />);

    expect(screen.getByTestId('step-start')).toBeTruthy();
    expect(calls.StepStart).toHaveBeenCalledTimes(1);
  });

  it('renders tool-invocation via ToolInvocation, never DynamicTool', () => {
    const { calls, renderers } = makeSpyRenderers();
    render(<MessageFactory message={makeMessage([toolInvocationPart('c-1', 'weather')])} {...renderers} />);

    expect(screen.getByTestId('tool-invocation').textContent).toBe('weather');
    expect(calls.ToolInvocation).toHaveBeenCalledTimes(1);
    expect(calls.DynamicTool).not.toHaveBeenCalled();
  });

  it('normalizes a legacy nested `source` part to the flat SourceUrl shape', () => {
    const { calls, renderers } = makeSpyRenderers();
    render(<MessageFactory message={makeMessage([sourcePart()])} {...renderers} />);

    const el = screen.getByTestId('source');
    expect(el.getAttribute('data-source-id')).toBe('s-1');
    expect(el.getAttribute('data-url')).toBe('https://x');
    expect(el.textContent).toBe('Nested');
    expect(calls.SourceUrl).toHaveBeenCalledTimes(1);
    expect(calls.SourceUrl).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'source-url', sourceId: 's-1', url: 'https://x', title: 'Nested' }),
    );
    expect(calls.SourceDocument).not.toHaveBeenCalled();
  });

  it('routes a runtime flat `source-url` part to the SourceUrl renderer', () => {
    const { calls, renderers } = makeSpyRenderers();
    render(<MessageFactory message={makeMessage([sourceUrlPart()])} {...renderers} />);

    const el = screen.getByTestId('source');
    expect(el.getAttribute('data-source-id')).toBe('s-2');
    expect(el.getAttribute('data-url')).toBe('https://flat');
    expect(el.textContent).toBe('Flat');
    expect(calls.SourceUrl).toHaveBeenCalledTimes(1);
    expect(calls.SourceUrl).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'source-url', sourceId: 's-2', url: 'https://flat', title: 'Flat' }),
    );
    expect(calls.SourceDocument).not.toHaveBeenCalled();
    expect(calls.Text).not.toHaveBeenCalled();
  });

  it('renders source-document only via the SourceDocument renderer', () => {
    const { calls, renderers } = makeSpyRenderers();
    render(<MessageFactory message={makeMessage([sourceDocumentPart()])} {...renderers} />);

    expect(screen.getByTestId('source-document').textContent).toBe('Doc');
    expect(calls.SourceDocument).toHaveBeenCalledTimes(1);
    expect(calls.SourceUrl).not.toHaveBeenCalled();
  });

  it('renders data-${string} via the Data renderer', () => {
    const { calls, renderers } = makeSpyRenderers();
    render(<MessageFactory message={makeMessage([dataPart('data-foo')])} {...renderers} />);

    expect(screen.getByTestId('data').textContent).toBe('data-foo');
    expect(calls.Data).toHaveBeenCalledTimes(1);
    expect(calls.DynamicTool).not.toHaveBeenCalled();
  });

  it('routes data-signal and data-om-observation to the Data renderer', () => {
    const { calls, renderers } = makeSpyRenderers();
    render(
      <MessageFactory
        message={makeMessage([dataPart('data-signal'), dataPart('data-om-observation')])}
        {...renderers}
      />,
    );

    expect(calls.Data).toHaveBeenCalledTimes(2);
  });

  it('renders runtime-only dynamic-tool via DynamicTool, never ToolInvocation', () => {
    const { calls, renderers } = makeSpyRenderers();
    render(<MessageFactory message={makeMessage([dynamicToolPart('weather', 'c-9')])} {...renderers} />);

    expect(screen.getByTestId('dynamic-tool').textContent).toBe('weather');
    expect(calls.DynamicTool).toHaveBeenCalledTimes(1);
    expect(calls.ToolInvocation).not.toHaveBeenCalled();
    const arg = calls.DynamicTool.mock.calls[0][0] as DynamicToolPart;
    expect(arg.toolName).toBe('weather');
    expect(arg.state).toBe('output-available');
  });

  it('renders AI SDK v5 tool-${string} via DynamicTool', () => {
    const { calls, renderers } = makeSpyRenderers();
    render(<MessageFactory message={makeMessage([v5ToolPart('tool-weather', 'c-10')])} {...renderers} />);

    expect(screen.getByTestId('dynamic-tool')).toBeTruthy();
    expect(calls.DynamicTool).toHaveBeenCalledTimes(1);
    expect(calls.Data).not.toHaveBeenCalled();
  });

  it('renders a mixed message preserving part order', () => {
    const { renderers } = makeSpyRenderers();
    const { container } = render(
      <MessageFactory
        message={makeMessage([
          textPart('a'),
          reasoningPart('b'),
          toolInvocationPart('c-1', 'weather'),
          dynamicToolPart('search', 'c-2'),
          dataPart('data-foo'),
        ])}
        {...renderers}
      />,
    );

    const ids = Array.from(container.querySelectorAll('[data-testid]')).map(el => el.getAttribute('data-testid'));
    expect(ids).toEqual(['text', 'reasoning', 'tool-invocation', 'dynamic-tool', 'data']);
  });

  it('falls back when a renderer is omitted, without throwing', () => {
    const fallback = vi.fn((part: { type: string }) => <div data-testid="fallback">{part.type}</div>);
    render(<MessageFactory message={makeMessage([textPart('hi')])} fallback={fallback} />);

    expect(screen.getByTestId('fallback').textContent).toBe('text');
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('renders null (no throw) when neither renderer nor fallback is provided', () => {
    expect(() =>
      render(<MessageFactory message={makeMessage([textPart('hi'), dynamicToolPart('x', 'c-1')])} />),
    ).not.toThrow();
  });

  it('routes an unrecognized runtime-only part to fallback without throwing', () => {
    const fallback = vi.fn((part: { type: string }) => <div data-testid="fallback">{part.type}</div>);
    render(<MessageFactory message={makeMessage([asPart({ type: 'mystery-runtime-part' })])} fallback={fallback} />);

    expect(screen.getByTestId('fallback').textContent).toBe('mystery-runtime-part');
  });

  it('wraps parts with the role-specific wrapper for a signal message', () => {
    const { renderers } = makeSpyRenderers();
    const roles: MessageRoleRenderers = {
      Signal: ({ children }) => <section data-testid="signal-wrapper">{children}</section>,
    };
    render(<MessageFactory message={makeMessage([textPart('sig')], 'signal')} roles={roles} {...renderers} />);

    const wrapper = screen.getByTestId('signal-wrapper');
    expect(wrapper).toBeTruthy();
    expect(wrapper.querySelector('[data-testid="text"]')?.textContent).toBe('sig');
  });

  it('renders parts unwrapped (fragment) when no role wrapper matches', () => {
    const { renderers } = makeSpyRenderers();
    render(<MessageFactory message={makeMessage([textPart('plain')], 'assistant')} {...renderers} />);

    expect(screen.queryByTestId('signal-wrapper')).toBeNull();
    expect(screen.getByTestId('text').textContent).toBe('plain');
  });

  // Every role the two playground chat surfaces wrap (user / assistant / system
  // / signal) must reach its matching wrapper. This is the role half of the
  // surface-coverage matrix; the part/status halves are covered above.
  it.each([
    ['user', 'User'],
    ['assistant', 'Assistant'],
    ['system', 'System'],
    ['signal', 'Signal'],
  ] as const)('wraps a %s message with its matching role wrapper', (role, slot) => {
    const { renderers } = makeSpyRenderers();
    const roles: MessageRoleRenderers = {
      [slot]: ({ children }: MessageRoleRendererProps) => <section data-testid={`${role}-wrapper`}>{children}</section>,
    };
    render(<MessageFactory message={makeMessage([textPart(role)], role)} roles={roles} {...renderers} />);

    const wrapper = screen.getByTestId(`${role}-wrapper`);
    expect(wrapper.querySelector('[data-testid="text"]')?.textContent).toBe(role);
  });

  describe('status slots', () => {
    it('renders the Tripwire slot instead of the parts, forwarding text + tripwire metadata', () => {
      const { calls, renderers } = makeSpyRenderers();
      const tripwire = { reason: 'guardrail tripped', processorId: 'blocked' };
      const status: MessageStatusRenderers = {
        Tripwire: props => (
          <div
            data-testid="tripwire"
            data-text={props.text}
            data-reason={props.tripwire?.reason}
            data-processor={props.tripwire?.processorId}
          />
        ),
      };
      render(
        <MessageFactory
          message={makeMessageWithMetadata([textPart('halt')], { status: 'tripwire', tripwire })}
          status={status}
          {...renderers}
        />,
      );

      const el = screen.getByTestId('tripwire');
      expect(el.getAttribute('data-text')).toBe('halt');
      expect(el.getAttribute('data-reason')).toBe('guardrail tripped');
      expect(el.getAttribute('data-processor')).toBe('blocked');
      expect(calls.Text).not.toHaveBeenCalled();
    });

    it('renders the Warning slot instead of the parts', () => {
      const { calls, renderers } = makeSpyRenderers();
      const status: MessageStatusRenderers = {
        Warning: props => <div data-testid="warning">{props.text}</div>,
      };
      render(
        <MessageFactory
          message={makeMessageWithMetadata([textPart('careful')], { status: 'warning' })}
          status={status}
          {...renderers}
        />,
      );

      expect(screen.getByTestId('warning').textContent).toBe('careful');
      expect(calls.Text).not.toHaveBeenCalled();
    });

    it('renders the Error slot instead of the parts', () => {
      const { calls, renderers } = makeSpyRenderers();
      const status: MessageStatusRenderers = {
        Error: props => <div data-testid="error">{props.text}</div>,
      };
      render(
        <MessageFactory
          message={makeMessageWithMetadata([textPart('boom')], { status: 'error' })}
          status={status}
          {...renderers}
        />,
      );

      expect(screen.getByTestId('error').textContent).toBe('boom');
      expect(calls.Text).not.toHaveBeenCalled();
    });

    it('falls through to the parts walk when the status matches but no slot is provided', () => {
      const { calls, renderers } = makeSpyRenderers();
      render(
        <MessageFactory
          message={makeMessageWithMetadata([textPart('still here')], { status: 'tripwire' })}
          {...renderers}
        />,
      );

      expect(screen.getByTestId('text').textContent).toBe('still here');
      expect(calls.Text).toHaveBeenCalledTimes(1);
    });

    it('renders the Task slot ADJACENT to the parts when completionResult exists', () => {
      const { calls, renderers } = makeSpyRenderers();
      const status: MessageStatusRenderers = {
        Task: props => <div data-testid="task" data-passed={String(props.passed)} />,
      };
      render(
        <MessageFactory
          message={makeMessageWithMetadata([textPart('did work')], { completionResult: { passed: true } })}
          status={status}
          {...renderers}
        />,
      );

      expect(screen.getByTestId('text').textContent).toBe('did work');
      expect(screen.getByTestId('task').getAttribute('data-passed')).toBe('true');
      expect(calls.Text).toHaveBeenCalledTimes(1);
    });

    it('drives the Task slot from isTaskCompleteResult when completionResult is absent', () => {
      const { renderers } = makeSpyRenderers();
      const status: MessageStatusRenderers = {
        Task: props => <div data-testid="task" data-passed={String(props.passed)} />,
      };
      render(
        <MessageFactory
          message={makeMessageWithMetadata([textPart('done')], { isTaskCompleteResult: { passed: false } })}
          status={status}
          {...renderers}
        />,
      );

      expect(screen.getByTestId('task').getAttribute('data-passed')).toBe('false');
    });

    it('still invokes the Task slot when suppressFeedback is true (no factory filtering)', () => {
      const { renderers } = makeSpyRenderers();
      const status: MessageStatusRenderers = {
        Task: props => <div data-testid="task" data-suppressed={String(props.suppressFeedback)} />,
      };
      render(
        <MessageFactory
          message={makeMessageWithMetadata([textPart('x')], {
            completionResult: { passed: true, suppressFeedback: true },
          })}
          status={status}
          {...renderers}
        />,
      );

      expect(screen.getByTestId('task').getAttribute('data-suppressed')).toBe('true');
    });

    it('wraps the parts walk with the Pending slot when status is pending', () => {
      const { calls, renderers } = makeSpyRenderers();
      const status: MessageStatusRenderers = {
        Pending: props => <div data-testid="pending">{props.children}</div>,
      };
      render(
        <MessageFactory
          message={makeMessageWithMetadata([textPart('sending this')], { status: 'pending' })}
          status={status}
          {...renderers}
        />,
      );

      const pending = screen.getByTestId('pending');
      expect(pending.querySelector('[data-testid="text"]')?.textContent).toBe('sending this');
      expect(calls.Text).toHaveBeenCalledTimes(1);
    });

    it('falls through to the bare parts walk when status is pending but no Pending slot is provided', () => {
      const { calls, renderers } = makeSpyRenderers();
      render(
        <MessageFactory
          message={makeMessageWithMetadata([textPart('sending this')], { status: 'pending' })}
          {...renderers}
        />,
      );

      expect(screen.getByTestId('text').textContent).toBe('sending this');
      expect(calls.Text).toHaveBeenCalledTimes(1);
    });

    it('wraps a replacement slot with a matching role wrapper', () => {
      const { renderers } = makeSpyRenderers();
      const roles: MessageRoleRenderers = {
        Assistant: ({ children }) => <section data-testid="assistant-wrapper">{children}</section>,
      };
      const status: MessageStatusRenderers = {
        Error: props => <div data-testid="error">{props.text}</div>,
      };
      render(
        <MessageFactory
          message={makeMessageWithMetadata([textPart('boom')], { status: 'error' })}
          roles={roles}
          status={status}
          {...renderers}
        />,
      );

      const wrapper = screen.getByTestId('assistant-wrapper');
      expect(wrapper.querySelector('[data-testid="error"]')?.textContent).toBe('boom');
    });
  });
});
