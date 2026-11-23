// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible';

afterEach(() => {
  cleanup();
});

describe('Collapsible', () => {
  it('renders an asChild Trigger as the child element without nesting buttons', () => {
    render(
      <Collapsible>
        <CollapsibleTrigger asChild>
          <button type="button">Toggle panel</button>
        </CollapsibleTrigger>
        <CollapsibleContent>Panel content</CollapsibleContent>
      </Collapsible>,
    );

    const trigger = screen.getByRole('button', { name: 'Toggle panel' });
    expect(trigger.querySelector('button')).toBeNull();
  });

  it('toggles the panel when the trigger is clicked', () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Panel content</CollapsibleContent>
      </Collapsible>,
    );

    expect(screen.queryByText('Panel content')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));
    expect(screen.getByText('Panel content')).toBeDefined();
  });
});
