import { customRender } from 'test/render';

import { Months } from './Months';

let root: HTMLElement;

test('should use the default class name', () => {
  const view = customRender(<Months>foo</Months>, {});
  root = view.container.firstChild as HTMLElement;
  expect(root).toHaveClass('rdp-months');
});

test('should use a custom class name', () => {
  const view = customRender(<Months>foo</Months>, {
    classNames: { months: 'foo' }
  });
  root = view.container.firstChild as HTMLElement;
  expect(root).toHaveClass('foo');
});

test('should use a custom style', () => {
  const view = customRender(<Months>foo</Months>, {
    styles: { months: { color: 'red' } }
  });
  root = view.container.firstChild as HTMLElement;
  expect(root).toHaveStyle({ color: 'red' });
});
