/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { submitFormsInFrame } from '../shared/frame-forms';

describe('submitFormsInFrame', () => {
  const submissions: Array<HTMLElement | null> = [];

  beforeAll(() => {
    vi.spyOn(window, 'top', 'get').mockReturnValue({} as Window);
    submitFormsInFrame();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    submissions.length = 0;
  });

  const renderForm = (fields = '<input name="orderId" />') => {
    document.body.innerHTML = `<form>${fields}<button>Run</button></form>`;
    const form = document.querySelector('form')!;
    form.addEventListener('submit', event => {
      event.preventDefault();
      submissions.push((event as SubmitEvent).submitter);
    });
    return { form, button: form.querySelector('button')!, input: form.querySelector('input')! };
  };

  it('submits once, with the submitter, when a submit button is clicked', () => {
    const { button } = renderForm();

    button.click();

    expect(submissions).toEqual([button]);
  });

  it('submits when Enter is pressed in a text field', () => {
    const { button, input } = renderForm();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

    expect(submissions).toEqual([button]);
  });

  it('does not submit a form whose fields are invalid', () => {
    const { button } = renderForm('<input name="orderId" required />');

    button.click();

    expect(submissions).toEqual([]);
  });

  it('leaves non-submit buttons and handled clicks alone', () => {
    const { form, button } = renderForm();
    const plain = document.createElement('button');
    plain.type = 'button';
    form.append(plain);
    button.addEventListener('click', event => event.preventDefault());

    plain.click();
    button.click();

    expect(submissions).toEqual([]);
  });

  it('does nothing when the app is not embedded', () => {
    const listen = vi.spyOn(document, 'addEventListener');

    submitFormsInFrame();

    expect(listen).not.toHaveBeenCalled();
    listen.mockRestore();
  });
});
