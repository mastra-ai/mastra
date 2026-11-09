// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as AskUser from './ask-user';

afterEach(cleanup);

function ComposedQuestion(props: Omit<ComponentProps<typeof AskUser.Root>, 'children'>) {
  return (
    <AskUser.Root {...props}>
      <AskUser.Body>
        <AskUser.Question>Choose a deployment target</AskUser.Question>
        <AskUser.Options>
          <AskUser.Option value="Staging">Staging</AskUser.Option>
          <AskUser.Option value="Production">Production</AskUser.Option>
          <AskUser.CustomAnswer />
        </AskUser.Options>
        <AskUser.Submit />
      </AskUser.Body>
    </AskUser.Root>
  );
}

describe('composed AskUser', () => {
  it('names the root and single-select options from the question without caller ARIA props', () => {
    render(<ComposedQuestion onSubmit={vi.fn()} />);

    const question = screen.getByRole('group', { name: 'Choose a deployment target' });
    expect(within(question).getByRole('radiogroup', { name: 'Choose a deployment target' })).toBeTruthy();
  });

  it('submits a suggested single-select answer immediately through the root', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ComposedQuestion onSubmit={onSubmit} />);

    await user.click(screen.getByRole('radio', { name: 'Staging' }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('Staging');
  });

  it('submits trimmed custom text with Enter without interpreting it as an option', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ComposedQuestion onSubmit={onSubmit} />);

    await user.click(screen.getByRole('radio', { name: 'Other…' }));
    await user.type(screen.getByRole('textbox', { name: 'Your answer' }), '  Isolated environment  {Enter}');

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('Isolated environment');
  });

  it('shares the draft with a submit button placed outside the options', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ComposedQuestion selectionMode="multi_select" onSubmit={onSubmit} />);

    await user.click(screen.getByRole('checkbox', { name: 'Staging' }));
    await user.click(screen.getByRole('checkbox', { name: 'Other…' }));
    await user.type(screen.getByRole('textbox', { name: 'Your answer' }), '  Customer environment  ');
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(['Staging', 'Customer environment']);
  });

  it('excludes a previous custom draft after a suggested single-select answer submits', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ComposedQuestion onSubmit={onSubmit} />);

    await user.click(screen.getByRole('radio', { name: 'Other…' }));
    await user.type(screen.getByRole('textbox', { name: 'Your answer' }), 'Customer environment');
    await user.click(screen.getByRole('radio', { name: 'Production' }));

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Submit answer' }).disabled).toBe(true);
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('Production');
  });

  it('keeps suggested selections when an empty custom field loses keyboard focus', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ComposedQuestion selectionMode="multi_select" onSubmit={onSubmit} />);

    await user.click(screen.getByRole('checkbox', { name: 'Staging' }));
    await user.click(screen.getByRole('checkbox', { name: 'Other…' }));
    await user.tab();

    expect(screen.getByRole('checkbox', { name: 'Other…' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByRole('textbox')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(['Staging']);
  });

  it('disables all answer controls and submission through the root', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ComposedQuestion disabled onSubmit={onSubmit} />);

    await user.click(screen.getByRole('radio', { name: 'Staging' }));
    await user.click(screen.getByRole('radio', { name: 'Other…' }));

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Submit answer' }).disabled).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps answer state and accessible title IDs separate between roots', async () => {
    const onFirstSubmit = vi.fn();
    const onSecondSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <>
        <ComposedQuestion selectionMode="multi_select" onSubmit={onFirstSubmit} />
        <ComposedQuestion selectionMode="multi_select" onSubmit={onSecondSubmit} />
      </>,
    );
    const [firstQuestion, secondQuestion] = screen.getAllByRole('group', { name: 'Choose a deployment target' });
    expect(firstQuestion.getAttribute('aria-labelledby')).not.toBe(secondQuestion.getAttribute('aria-labelledby'));
    await user.click(within(firstQuestion).getByRole('checkbox', { name: 'Staging' }));
    await user.click(within(firstQuestion).getByRole('button', { name: 'Submit answer' }));

    expect(within(secondQuestion).getByRole('checkbox', { name: 'Staging' }).getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(onFirstSubmit).toHaveBeenCalledExactlyOnceWith(['Staging']);
    expect(onSecondSubmit).not.toHaveBeenCalled();
  });

  it('supports a free-text answer without an options group', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <AskUser.Root onSubmit={onSubmit}>
        <AskUser.Question>What should we prioritize?</AskUser.Question>
        <AskUser.TextAnswer />
        <AskUser.Submit />
      </AskUser.Root>,
    );

    await user.type(screen.getByRole('textbox', { name: 'What should we prioritize?' }), '  Accessibility  ');
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('Accessibility');
  });
});
