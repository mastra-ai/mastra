import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Status } from './status';

const RUNNING = {
  label: 'Running',
  tone: 'success',
  description: 'The server is live.',
} as const;

describe('Status', () => {
  it('composes the decorative dot and visible label', () => {
    const html = renderToStaticMarkup(<Status presentation={RUNNING} />);

    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('Running');
    expect(html).not.toContain('<button');
  });

  it('passes status semantics to its root element', () => {
    const html = renderToStaticMarkup(
      <Status presentation={RUNNING} role="status" aria-label="Current status: Running" />,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Current status: Running"');
  });

  it('inherits surrounding text style', () => {
    const html = renderToStaticMarkup(<Status presentation={RUNNING} />);

    expect(html).not.toMatch(/text-(meta|body|foreground)/);
    expect(html).toContain('Running</span>');
  });
});
