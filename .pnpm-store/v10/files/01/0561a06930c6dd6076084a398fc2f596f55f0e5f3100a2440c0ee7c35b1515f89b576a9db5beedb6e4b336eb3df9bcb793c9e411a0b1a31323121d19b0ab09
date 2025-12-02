import { DayPickerContextValue } from 'contexts/DayPicker';
import { defaultClassNames } from 'contexts/DayPicker/defaultClassNames';
import { ActiveModifiers, InternalModifier } from 'types/Modifiers';

import { getDayClassNames } from './getDayClassNames';

type DayPickerOptions = Pick<
  DayPickerContextValue,
  'modifiersClassNames' | 'classNames'
>;

const internalModifiers = Object.values(InternalModifier);

test('should include the day class name', () => {
  const dayPicker: DayPickerOptions = {
    modifiersClassNames: {},
    classNames: defaultClassNames
  };
  const activeModifiers: ActiveModifiers = {};
  expect(getDayClassNames(dayPicker, activeModifiers)).toContain(
    defaultClassNames.day
  );
});

describe('when using "modifiersClassNames" for a custom modifier', () => {
  const modifierClassName = `foo-class`;
  const dayPicker: DayPickerOptions = {
    modifiersClassNames: {
      foo: modifierClassName
    },
    classNames: defaultClassNames
  };
  const activeModifiers: ActiveModifiers = { foo: true };
  test('should return the custom class name for the modifier', () => {
    expect(getDayClassNames(dayPicker, activeModifiers)).toContain(
      modifierClassName
    );
  });
});

describe.each(internalModifiers)(
  'when using "modifiersClassNames" for the %s (internal) modifier',
  (internalModifier) => {
    const modifierClassName = `foo-${internalModifier}`;
    const dayPicker: DayPickerOptions = {
      modifiersClassNames: {
        [internalModifier]: modifierClassName
      },
      classNames: defaultClassNames
    };
    const activeModifiers: ActiveModifiers = { [internalModifier]: true };
    test('should return the custom class name for the modifier', () => {
      expect(getDayClassNames(dayPicker, activeModifiers)).toContain(
        modifierClassName
      );
    });
    test('should not include the default class name for the modifier', () => {
      expect(getDayClassNames(dayPicker, activeModifiers)).not.toContain(
        defaultClassNames.day_selected
      );
    });
  }
);
