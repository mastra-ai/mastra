import { describe, expect, it, vi } from 'vitest';

import { AskQuestionDialogComponent } from '../ask-question-dialog.js';
import { AskQuestionInlineComponent } from '../ask-question-inline.js';

describe('AskQuestion multi select', () => {
  it('toggles selections in dialog component', () => {
    const onSubmit = vi.fn();

    const component = new AskQuestionDialogComponent({
      question: 'Select frameworks',
      selectionMode: 'multi_select',
      options: [{ label: 'React' }, { label: 'Vue' }],
      onSubmit,
      onCancel: vi.fn(),
    });

    component.handleInput(' ');
    component.handleInput('\r');

    expect(onSubmit).toHaveBeenCalledWith(['React']);
  });

  it('toggles multiple selections in dialog component', () => {
    const onSubmit = vi.fn();

    const component = new AskQuestionDialogComponent({
      question: 'Select frameworks',
      selectionMode: 'multi_select',
      options: [{ label: 'React' }, { label: 'Vue' }],
      onSubmit,
      onCancel: vi.fn(),
    });

    component.handleInput(' ');
    component.handleInput('\u001B[B');
    component.handleInput(' ');
    component.handleInput('\r');

    expect(onSubmit).toHaveBeenCalledWith(['React', 'Vue']);
  });

  it('submits multi select answers in inline component', () => {
    const onSubmit = vi.fn();

    const component = new AskQuestionInlineComponent({
      question: 'Select frameworks',
      selectionMode: 'multi_select',
      options: [{ label: 'React' }, { label: 'Vue' }],
      onSubmit,
      onCancel: vi.fn(),
    });

    component.handleInput(' ');
    component.handleInput('\u001B[B');
    component.handleInput(' ');
    component.handleInput('\r');

    expect(onSubmit).toHaveBeenCalledWith('React, Vue');
  });

  it('supports custom response in multi select mode', () => {
    const onSubmit = vi.fn();

    const component = new AskQuestionDialogComponent({
      question: 'Select frameworks',
      selectionMode: 'multi_select',
      allowCustomResponse: true,
      options: [{ label: 'React' }],
      onSubmit,
      onCancel: vi.fn(),
    });

    component.handleInput('\u001B[B');
    component.handleInput(' ');

    expect((component as any).input).toBeDefined();
  });
});