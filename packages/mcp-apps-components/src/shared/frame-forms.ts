/**
 * Hosts may sandbox apps without `allow-forms`, and a document sandboxed that way never fires `submit`:
 * the browser drops the submission before the event. Studio's forms (workflow run input, filters) only
 * handle `submit`, so inside such a frame their buttons do nothing. Studio never relies on the native
 * navigation, so firing the event ourselves for submit buttons and Enter in a text field keeps them working.
 */
export function submitFormsInFrame(): void {
  if (window.top === window) return;

  const submit = (form: HTMLFormElement, submitter: HTMLElement | null) => {
    const skipValidation = form.noValidate || (submitter as HTMLButtonElement | null)?.formNoValidate;
    if (!skipValidation && !form.reportValidity()) return;
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter }));
  };

  document.addEventListener('click', event => {
    if (event.defaultPrevented || !(event.target instanceof Element)) return;
    const submitter = event.target.closest<HTMLButtonElement | HTMLInputElement>('button, input[type="submit"]');
    if (!submitter?.form || submitter.type !== 'submit' || submitter.disabled) return;
    event.preventDefault();
    submit(submitter.form, submitter);
  });

  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.key !== 'Enter' || event.isComposing) return;
    const field = event.target;
    if (!(field instanceof HTMLInputElement) || !field.form) return;
    if (['button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'image'].includes(field.type)) return;
    event.preventDefault();
    const submitter = field.form.querySelector<HTMLElement>(
      'button[type="submit"], button:not([type]), input[type="submit"]',
    );
    if ((submitter as HTMLButtonElement | null)?.disabled) return;
    submit(field.form, submitter);
  });
}
