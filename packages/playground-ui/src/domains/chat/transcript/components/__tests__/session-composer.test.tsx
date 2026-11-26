// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';
import { SessionComposer } from '../composer/session-composer';

describe('SessionComposer', () => {
  it('renders for a host that has no annotations', () => {
    render(
      <SessionComposer
        onSubmit={() => {}}
        busy={false}
        images={[]}
        onRemoveImage={() => {}}
        input={{}}
        showAbort={false}
        sendDisabled
        onAbort={() => {}}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeTruthy();
  });
});
