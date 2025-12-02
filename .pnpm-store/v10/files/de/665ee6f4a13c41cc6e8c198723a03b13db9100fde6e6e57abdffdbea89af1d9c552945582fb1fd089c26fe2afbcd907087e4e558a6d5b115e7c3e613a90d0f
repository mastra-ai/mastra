import { RenderResult, screen } from '@testing-library/react';
import { addDays } from 'date-fns';
import { DayPickerProps } from 'DayPicker';

import { customRender } from 'test/render';
import { getDayButton, queryMonthGrids } from 'test/selectors';
import { freezeBeforeAll } from 'test/utils';

import { MonthsProps } from 'components/Months';
import { defaultClassNames } from 'contexts/DayPicker/defaultClassNames';
import { ClassNames } from 'types/Styles';

import { Root } from './Root';

const today = new Date(2020, 10, 4);
freezeBeforeAll(today);

let container: HTMLElement;
let view: RenderResult;

function render(dayPickerProps: DayPickerProps = {}) {
  view = customRender(<Root initialProps={dayPickerProps} />, dayPickerProps);
  container = view.container;
}

describe('when the number of months is 1', () => {
  const props: DayPickerProps = { numberOfMonths: 1 };
  beforeEach(() => {
    render(props);
  });
  test('should display one month grid', () => {
    expect(queryMonthGrids()).toHaveLength(1);
  });
});

describe('when the number of months is greater than 1', () => {
  const props: DayPickerProps = { numberOfMonths: 3 };
  beforeEach(() => {
    render(props);
  });
  test('should display the specified number of month grids', () => {
    expect(queryMonthGrids()).toHaveLength(3);
  });
});

describe('when using the "classNames" prop', () => {
  const classNames: ClassNames = {
    root: 'foo'
  };
  beforeEach(() => {
    render({ classNames });
  });
  test('should add the class to the container', () => {
    expect(container.firstChild).toHaveClass('foo');
  });
});

describe('when using a custom "Months" component', () => {
  function CustomMonths(props: MonthsProps) {
    return (
      <div>
        <div data-testid="foo" />
        {props.children}
      </div>
    );
  }
  beforeEach(() => {
    render({ numberOfMonths: 3, components: { Months: CustomMonths } });
  });
  test('should render the custom component', () => {
    expect(screen.getByTestId('foo')).toBeInTheDocument();
  });
  test('should still display the specified number of months', () => {
    expect(queryMonthGrids()).toHaveLength(3);
  });
});

describe('when using the "id" prop', () => {
  const testId = 'foo';
  beforeEach(() => render({ id: testId }));
  test('should add the "id" attribute', () => {
    expect(container.firstChild).toHaveAttribute('id', testId);
  });
});

describe('when using the "nonce" prop', () => {
  const nonce = 'foo';
  beforeEach(() => render({ nonce }));
  test('should add the "nonce" attribute', () => {
    expect(container.firstChild).toHaveAttribute('nonce', nonce);
  });
});

describe('when using the "title" prop', () => {
  const title = 'foo';
  beforeEach(() => render({ title }));
  test('should add the "title" attribute', () => {
    expect(container.firstChild).toHaveAttribute('title', title);
  });
});

describe('when using the "lang" prop', () => {
  const lang = 'en-US';
  beforeEach(() => render({ lang }));
  test('should add the "lang" attribute', () => {
    expect(container.firstChild).toHaveAttribute('lang', lang);
  });
});

describe('when using the "className" prop', () => {
  const props: DayPickerProps = { className: 'foo' };
  beforeEach(() => {
    render(props);
  });
  test('should append the class name to the root element', () => {
    expect(container.firstChild).toHaveClass('rdp foo');
  });
});

describe('when the "numberOfMonths" is greater than 1', () => {
  const props: DayPickerProps = { numberOfMonths: 3 };
  const expectedClassName = defaultClassNames.multiple_months;
  beforeEach(() => {
    render(props);
  });
  test(`should have the ${expectedClassName} class name`, () => {
    expect(container.firstChild).toHaveClass(expectedClassName);
  });
});

describe('when showing the week numbers', () => {
  const props: DayPickerProps = { showWeekNumber: true };
  const expectedClassName = defaultClassNames.with_weeknumber;
  beforeEach(() => {
    render(props);
  });
  test(`should have the ${expectedClassName} class name`, () => {
    expect(container.firstChild).toHaveClass(expectedClassName);
  });
});

describe('when "initialFocus" is set', () => {
  const baseProps: DayPickerProps = {
    initialFocus: true,
    mode: 'single'
  };
  describe('when a day is not selected', () => {
    beforeEach(() => {
      render(baseProps);
    });
    test('should focus today', () => {
      expect(getDayButton(today)).toHaveFocus();
    });
    describe('when a new day is focused', () => {
      beforeEach(() => {
        getDayButton(addDays(today, 1)).focus();
      });
      describe('and the calendar is rerendered', () => {
        test.todo('should focus the new day');
      });
    });
  });
  describe('when a day is selected', () => {
    const selected = addDays(today, 1);
    const props: DayPickerProps = { ...baseProps, selected };
    beforeEach(() => {
      render(props);
    });
    test('should focus the selected day', () => {
      expect(getDayButton(selected)).toHaveFocus();
    });
  });
});
