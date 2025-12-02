import { useDayPicker } from 'contexts/DayPicker';
import { ActiveModifiers } from 'types/Modifiers';

/** Represent the props for the {@link DayContent} component. */
export interface DayContentProps {
  /** The date representing the day. */
  date: Date;
  /** The month where the day is displayed. */
  displayMonth: Date;
  /** The active modifiers for the given date. */
  activeModifiers: ActiveModifiers;
}

/** Render the content of the day cell. */
export function DayContent(props: DayContentProps): JSX.Element {
  const {
    locale,
    formatters: { formatDay }
  } = useDayPicker();

  return <>{formatDay(props.date, { locale })}</>;
}
