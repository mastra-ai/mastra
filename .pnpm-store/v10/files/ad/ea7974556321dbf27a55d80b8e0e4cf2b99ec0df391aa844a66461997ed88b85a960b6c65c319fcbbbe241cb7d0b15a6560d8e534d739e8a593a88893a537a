import { customRender } from 'test/render';

import { IconLeft } from './IconLeft';

let root: HTMLElement;

beforeEach(() => {
  const view = customRender(
    <IconLeft className="foo" style={{ color: 'red' }} />
  );
  root = view.container.firstChild as HTMLElement;
});
test('should add the class name', () => {
  expect(root).toHaveClass('foo');
});
test('should apply the style', () => {
  expect(root).toHaveStyle({ color: 'red' });
});
