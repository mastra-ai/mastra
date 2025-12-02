import { es } from 'date-fns/locale';
import { DayPickerProps } from 'DayPicker';

import { customRender } from 'test/render';
import { freezeBeforeAll } from 'test/utils';

import { DayContent, DayContentProps } from 'components/DayContent';

const today = new Date(2021, 8);

freezeBeforeAll(today);
let container: HTMLElement;
function setup(props: DayContentProps, dayPickerProps?: DayPickerProps) {
  const view = customRender(<DayContent {...props} />, dayPickerProps);
  container = view.container;
}

const date = today;
const displayMonth = today;
const props: DayContentProps = {
  date: date,
  displayMonth,
  activeModifiers: {}
};

const dayPickerProps: DayPickerProps = {
  locale: es
};

describe('when rendered', () => {
  beforeEach(() => {
    setup(props, dayPickerProps);
  });
  test('contains the formatted day', () => {
    expect(container.firstChild).toHaveTextContent('1');
  });
});
