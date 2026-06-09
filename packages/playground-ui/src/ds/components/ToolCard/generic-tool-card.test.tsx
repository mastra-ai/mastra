// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { GenericToolCard, ToolCardShell } from './generic-tool-card';

afterEach(() => cleanup());

describe('ToolCardShell', () => {
  it('renders children and forwards testId', () => {
    const { getByTestId } = render(
      <ToolCardShell testId="shell">
        <span>inside</span>
      </ToolCardShell>,
    );

    expect(getByTestId('shell').textContent).toContain('inside');
  });
});

describe('GenericToolCard', () => {
  it('shows the executing label with the tool name', () => {
    const { container } = render(<GenericToolCard toolName="my-tool" input={{ a: 1 }} output={{ ok: true }} />);

    expect(container.textContent).toContain('Executing');
    expect(container.textContent).toContain('my-tool');
  });

  it('renders input and output JSON when expanded', () => {
    const { container, getByRole } = render(
      <GenericToolCard toolName="my-tool" input={{ a: 1 }} output={{ ok: true }} />,
    );

    fireEvent.click(getByRole('button'));

    expect(container.textContent).toContain('Input');
    expect(container.textContent).toContain('"a": 1');
    expect(container.textContent).toContain('Output');
    expect(container.textContent).toContain('"ok": true');
  });

  it('omits the output panel when there is no output', () => {
    const { container, getByRole } = render(<GenericToolCard toolName="my-tool" input={{ a: 1 }} />);

    fireEvent.click(getByRole('button'));

    expect(container.textContent).toContain('Input');
    expect(container.textContent).not.toContain('Output');
  });
});
