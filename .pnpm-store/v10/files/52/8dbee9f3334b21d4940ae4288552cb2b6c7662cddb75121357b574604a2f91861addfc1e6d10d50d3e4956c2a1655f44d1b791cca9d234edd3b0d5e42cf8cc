import { customRender } from 'test/render';
import { getMonthCaption } from 'test/selectors';
import { freezeBeforeAll } from 'test/utils';

import { CaptionLabel } from './CaptionLabel';

const today = new Date(1979, 8);
freezeBeforeAll(today);

test('should render the formatted display month', () => {
  customRender(<CaptionLabel displayMonth={today} />);
  expect(getMonthCaption()).toHaveTextContent('September 1979');
});

test('should apply the `caption_label` class name', () => {
  customRender(<CaptionLabel displayMonth={today} />, {
    classNames: { caption_label: 'foo' }
  });
  expect(getMonthCaption()).toHaveClass('foo');
});

test('should apply the `caption_label` style', () => {
  customRender(<CaptionLabel displayMonth={today} />, {
    styles: { caption_label: { color: 'red' } }
  });
  expect(getMonthCaption()).toHaveStyle({ color: 'red' });
});
