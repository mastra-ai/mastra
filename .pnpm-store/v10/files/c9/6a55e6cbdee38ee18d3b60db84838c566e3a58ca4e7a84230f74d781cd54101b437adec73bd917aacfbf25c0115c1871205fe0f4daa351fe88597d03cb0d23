import { screen } from '@testing-library/react';
import { DayPickerProps } from 'DayPicker';

import { customRender } from 'test/render';
import { getMonthCaption, getMonthGrid } from 'test/selectors';

import { CustomComponents } from 'types/DayPickerBase';

import { Month, MonthProps } from './Month';

let root: HTMLDivElement;

const displayMonth = new Date(2022, 10, 4);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const testStyles: Record<string, any> = {
  caption_start: { color: 'red' },
  caption_end: { background: 'blue' },
  caption_between: { fontSize: 20 }
};

const testClassNames: Record<string, string> = {
  caption_start: 'caption_start',
  caption_end: 'caption_end',
  caption_between: 'caption_between'
};

type Test = {
  monthProps: MonthProps;
  dayPickerProps: DayPickerProps;
  expected: string[];
  notExpected: string[];
};

function setup(props: MonthProps, dayPickerProps?: DayPickerProps) {
  const view = customRender(<Month {...props} />, dayPickerProps);
  root = view.container.firstChild as HTMLDivElement;
}
describe('when rendered', () => {
  beforeEach(() => {
    setup({ displayIndex: 0, displayMonth });
  });
  test('the caption id should be the aria-labelledby of the grid', () => {
    const captionId = getMonthCaption().getAttribute('id');
    const gridLabelledBy = getMonthGrid().getAttribute('aria-labelledby');
    expect(captionId).toEqual(gridLabelledBy);
  });
});

describe('when rendered with a custom id', () => {
  const id = 'custom-id';
  beforeEach(() => {
    setup({ displayIndex: 0, displayMonth }, { id });
  });
  test('the caption id should include the display index', () => {
    const captionId = getMonthCaption().getAttribute('id');
    expect(captionId).toEqual('custom-id-0');
  });

  test('the table id should include the display index', () => {
    const tableId = getMonthGrid().getAttribute('id');
    expect(tableId).toEqual('custom-id-grid-0');
  });
});

describe('when using a custom Caption component', () => {
  const components: CustomComponents = {
    Caption: () => <>custom caption foo</>
  };
  beforeEach(() => {
    setup({ displayIndex: 0, displayMonth }, { components });
  });
  test('it should render the custom component instead', () => {
    expect(screen.getByText('custom caption foo')).toBeInTheDocument();
  });
});

describe('when dir is ltr', () => {
  const testLtr: Test[] = [
    {
      monthProps: {
        displayIndex: 0,
        displayMonth
      },
      dayPickerProps: {
        numberOfMonths: 1,
        styles: testStyles,
        classNames: testClassNames
      },
      expected: ['caption_start', 'caption_end'],
      notExpected: ['caption_between']
    },
    {
      monthProps: {
        displayIndex: 0,
        displayMonth
      },
      dayPickerProps: {
        numberOfMonths: 2,
        styles: testStyles,
        classNames: testClassNames
      },
      expected: ['caption_start'],
      notExpected: ['caption_between', 'caption_end']
    },
    {
      monthProps: {
        displayIndex: 1,
        displayMonth
      },
      dayPickerProps: {
        numberOfMonths: 2,
        styles: testStyles,
        classNames: testClassNames
      },
      expected: ['caption_end'],
      notExpected: ['caption_start', 'caption_between']
    },
    {
      monthProps: {
        displayIndex: 1,
        displayMonth
      },
      dayPickerProps: {
        numberOfMonths: 3,
        styles: testStyles,
        classNames: testClassNames
      },
      expected: ['caption_between'],
      notExpected: ['caption_start', 'caption_end']
    }
  ];

  describe.each(testLtr)(
    'when displayIndex is $monthProps.displayIndex and numberOfMonths is $dayPickerProps.numberOfMonths',
    ({ monthProps, dayPickerProps, expected, notExpected }) => {
      beforeEach(() => {
        setup(monthProps, dayPickerProps);
      });
      test.each(expected)(`the root should have the %s class`, (name) =>
        expect(root).toHaveClass(testClassNames[name])
      );
      test.each(expected)(`the root should have the %s style`, (name) =>
        expect(root).toHaveStyle(testStyles[name])
      );
      test.each(notExpected)(`the root should not have the %s class`, (name) =>
        expect(root).not.toHaveClass(testClassNames[name])
      );
    }
  );
});

describe('when dir is rtl', () => {
  const testRtl: Test[] = [
    {
      monthProps: {
        displayIndex: 0,
        displayMonth
      },
      dayPickerProps: {
        dir: 'rtl',
        numberOfMonths: 1,
        styles: testStyles,
        classNames: testClassNames
      },
      expected: ['caption_start', 'caption_end'],
      notExpected: ['caption_between']
    },
    {
      monthProps: {
        displayIndex: 0,
        displayMonth
      },
      dayPickerProps: {
        dir: 'rtl',
        numberOfMonths: 2,
        styles: testStyles,
        classNames: testClassNames
      },
      expected: ['caption_end'],
      notExpected: ['caption_between', 'caption_start']
    },
    {
      monthProps: {
        displayIndex: 1,
        displayMonth
      },
      dayPickerProps: {
        dir: 'rtl',
        numberOfMonths: 2,
        styles: testStyles,
        classNames: testClassNames
      },
      expected: ['caption_start'],
      notExpected: ['caption_end', 'caption_between']
    },
    {
      monthProps: {
        displayIndex: 1,
        displayMonth
      },
      dayPickerProps: {
        dir: 'rtl',
        numberOfMonths: 3,
        styles: testStyles,
        classNames: testClassNames
      },
      expected: ['caption_between'],
      notExpected: ['caption_start', 'caption_end']
    }
  ];

  describe.each(testRtl)(
    'when displayIndex is $monthProps.displayIndex and numberOfMonths is $dayPickerProps.numberOfMonths',
    ({ monthProps, dayPickerProps, expected, notExpected }) => {
      beforeEach(() => {
        setup(monthProps, dayPickerProps);
      });
      test.each(expected)(`the root should have the %s class`, (name) =>
        expect(root).toHaveClass(testClassNames[name])
      );
      test.each(expected)(`the root should have the %s style`, (name) =>
        expect(root).toHaveStyle(testStyles[name])
      );
      test.each(notExpected)(`the root should not have the %s class`, (name) =>
        expect(root).not.toHaveClass(testClassNames[name])
      );
    }
  );
});
