import { enUS } from 'date-fns/locale';

import { CaptionLayout } from 'components/Caption';
import { DayPickerContextValue } from 'contexts/DayPicker';

import { defaultClassNames } from './defaultClassNames';
import * as formatters from './formatters';
import * as labels from './labels';

export type DefaultContextProps =
  | 'captionLayout'
  | 'classNames'
  | 'formatters'
  | 'locale'
  | 'labels'
  | 'modifiersClassNames'
  | 'modifiers'
  | 'numberOfMonths'
  | 'styles'
  | 'today'
  | 'mode';

export type DefaultContextValues = Pick<
  DayPickerContextValue,
  DefaultContextProps
>;
/**
 * Returns the default values to use in the DayPickerContext, in case they are
 * not passed down with the DayPicker initial props.
 */
export function getDefaultContextValues(): DefaultContextValues {
  const captionLayout: CaptionLayout = 'buttons';
  const classNames = defaultClassNames;
  const locale = enUS;
  const modifiersClassNames = {};
  const modifiers = {};
  const numberOfMonths = 1;
  const styles = {};
  const today = new Date();

  return {
    captionLayout,
    classNames,
    formatters,
    labels,
    locale,
    modifiersClassNames,
    modifiers,
    numberOfMonths,
    styles,
    today,
    mode: 'default'
  };
}
