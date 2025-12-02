import { screen } from '@testing-library/react';
import { DayPickerProps } from 'DayPicker';

import { customRender } from 'test/render';
import {
  getMonthCaption,
  getMonthDropdown,
  getNextButton,
  getPrevButton,
  getYearDropdown,
  queryNextButton,
  queryPrevButton
} from 'test/selectors';
import { freezeBeforeAll } from 'test/utils';

import { CustomComponents } from 'types/DayPickerBase';

import { Caption, CaptionProps } from './Caption';

const today = new Date(2021, 8);

freezeBeforeAll(today);

function setup(props: CaptionProps, dayPickerProps?: DayPickerProps) {
  customRender(<Caption {...props} />, dayPickerProps);
}

describe('when navigation is disabled', () => {
  const props = { displayMonth: today };
  const dayPickerProps = { disableNavigation: true };
  beforeEach(() => setup(props, dayPickerProps));
  test('should display the caption label', () => {
    expect(getMonthCaption()).toHaveTextContent('September 2021');
  });
  test('should not render the navigation', () => {
    expect(queryPrevButton()).toBeNull();
    expect(queryNextButton()).toBeNull();
  });
});

describe('when using a custom CaptionLabel component', () => {
  const components: CustomComponents = {
    CaptionLabel: () => <>custom label foo</>
  };
  const props = { displayMonth: today };
  beforeEach(() => {
    setup(props, { components });
  });
  test('it should render the custom component instead', () => {
    expect(screen.getByText('custom label foo')).toBeInTheDocument();
  });
});

describe('when the caption layout is "dropdown"', () => {
  const dayPickerProps: DayPickerProps = {
    captionLayout: 'dropdown',
    fromYear: 2020,
    toYear: 2025
  };
  const props = { displayMonth: today };
  beforeEach(() => {
    setup(props, dayPickerProps);
  });
  test('should render the month drop-down', () => {
    expect(getMonthDropdown()).toBeInTheDocument();
  });
  test('should render the year drop-down', () => {
    expect(getYearDropdown()).toBeInTheDocument();
  });
});

describe('when the caption layout is "buttons"', () => {
  const dayPickerProps: DayPickerProps = {
    captionLayout: 'buttons'
  };
  test('should render the next month button', () => {
    customRender(<Caption displayMonth={today} />, dayPickerProps);
    expect(getNextButton()).toBeInTheDocument();
  });
  test('should render the previous month button', () => {
    customRender(<Caption displayMonth={today} />, dayPickerProps);
    expect(getPrevButton()).toBeInTheDocument();
  });
});

describe('when the caption layout is "dropdown-buttons"', () => {
  const dayPickerProps: DayPickerProps = {
    captionLayout: 'dropdown-buttons',
    fromYear: 2020,
    toYear: 2025
  };
  const props = { displayMonth: today };
  beforeEach(() => {
    setup(props, dayPickerProps);
  });
  test('should render the month drop-down', () => {
    expect(getMonthDropdown()).toBeInTheDocument();
  });
  test('should render the year drop-down', () => {
    expect(getYearDropdown()).toBeInTheDocument();
  });
  test('should render the next month button', () => {
    expect(getNextButton()).toBeInTheDocument();
  });
  test('should render the previous month button', () => {
    expect(getPrevButton()).toBeInTheDocument();
  });
});
