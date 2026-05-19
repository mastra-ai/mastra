// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ContextMenu } from './context-menu';

afterEach(() => {
  cleanup();
});

describe('ContextMenu', () => {
  it('renders Label standalone without throwing (no Group ancestor required)', () => {
    expect(() => render(<ContextMenu.Label>Heading</ContextMenu.Label>)).not.toThrow();
  });

  it('mounts every menu part inside an open menu without throwing', () => {
    expect(() =>
      render(
        <ContextMenu defaultOpen>
          <ContextMenu.Trigger>Right click here</ContextMenu.Trigger>
          <ContextMenu.Content>
            <ContextMenu.Label>Top-level label</ContextMenu.Label>
            <ContextMenu.Separator />
            <ContextMenu.Group>
              <ContextMenu.Label>Group label</ContextMenu.Label>
              <ContextMenu.Item>Default item</ContextMenu.Item>
              <ContextMenu.Item disabled>Disabled item</ContextMenu.Item>
              <ContextMenu.Item variant="destructive">Destructive item</ContextMenu.Item>
            </ContextMenu.Group>
            <ContextMenu.Separator />
            <ContextMenu.CheckboxItem checked>Checkbox</ContextMenu.CheckboxItem>
            <ContextMenu.RadioGroup value="a">
              <ContextMenu.RadioItem value="a">Radio A</ContextMenu.RadioItem>
              <ContextMenu.RadioItem value="b">Radio B</ContextMenu.RadioItem>
            </ContextMenu.RadioGroup>
            <ContextMenu.Separator />
            <ContextMenu.Sub>
              <ContextMenu.SubTrigger>Submenu</ContextMenu.SubTrigger>
              <ContextMenu.SubContent>
                <ContextMenu.Item>Sub item</ContextMenu.Item>
              </ContextMenu.SubContent>
            </ContextMenu.Sub>
            <ContextMenu.Item>
              <span>Item</span>
              <ContextMenu.Shortcut>Ctrl+K</ContextMenu.Shortcut>
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu>,
      ),
    ).not.toThrow();
  });
});
