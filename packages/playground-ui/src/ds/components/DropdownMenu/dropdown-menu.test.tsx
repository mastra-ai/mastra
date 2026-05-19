// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DropdownMenu } from './dropdown-menu';

afterEach(() => {
  cleanup();
});

describe('DropdownMenu', () => {
  it('renders Label standalone without throwing (no Group ancestor required)', () => {
    expect(() => render(<DropdownMenu.Label>Heading</DropdownMenu.Label>)).not.toThrow();
  });

  it('mounts every menu part inside an open menu without throwing', () => {
    expect(() =>
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Label>Top-level label</DropdownMenu.Label>
            <DropdownMenu.Separator />
            <DropdownMenu.Group>
              <DropdownMenu.Label>Group label</DropdownMenu.Label>
              <DropdownMenu.Item>Default item</DropdownMenu.Item>
              <DropdownMenu.Item disabled>Disabled item</DropdownMenu.Item>
              <DropdownMenu.Item variant="destructive">Destructive item</DropdownMenu.Item>
            </DropdownMenu.Group>
            <DropdownMenu.Separator />
            <DropdownMenu.CheckboxItem checked>Checkbox</DropdownMenu.CheckboxItem>
            <DropdownMenu.RadioGroup value="a">
              <DropdownMenu.RadioItem value="a">Radio A</DropdownMenu.RadioItem>
              <DropdownMenu.RadioItem value="b">Radio B</DropdownMenu.RadioItem>
            </DropdownMenu.RadioGroup>
            <DropdownMenu.Separator />
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger>Submenu</DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent>
                <DropdownMenu.Item>Sub item</DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
            <DropdownMenu.Item>
              <span>Item</span>
              <DropdownMenu.Shortcut>Ctrl+K</DropdownMenu.Shortcut>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>,
      ),
    ).not.toThrow();
  });
});
