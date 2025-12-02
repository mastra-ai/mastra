import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { DayPickerProps } from 'DayPicker';

import { customRender } from 'test/render/customRender';

import { WeekNumber, WeekNumberProps } from './WeekNumber';

function setup(props: WeekNumberProps, dayPickerProps?: DayPickerProps) {
  return customRender(<WeekNumber {...props} />, dayPickerProps);
}

const props: WeekNumberProps = {
  number: 10,
  dates: [new Date(), new Date()]
};

describe('without "onWeekNumberClick" prop', () => {
  const dayPickerProps: DayPickerProps = { onWeekNumberClick: undefined };
  test('it should return a span element', () => {
    const { container } = setup(props, dayPickerProps);
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe('with "onWeekNumberClick" prop', () => {
  const dayPickerProps: DayPickerProps = { onWeekNumberClick: jest.fn() };
  let container: HTMLElement;
  beforeEach(() => {
    container = setup(props, dayPickerProps).container;
  });
  test('it should return a button element', () => {
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(container.firstChild).toHaveAttribute('name', 'week-number');
    expect(container.firstChild).toMatchSnapshot();
  });
  describe('when the button element is clicked', () => {
    beforeEach(async () => {
      await userEvent.click(screen.getByRole('button'));
    });
    test('should call onWeekNumberClick', () => {
      expect(dayPickerProps.onWeekNumberClick).toHaveBeenCalledWith(
        props.number,
        props.dates,
        expect.anything()
      );
    });
  });
});
