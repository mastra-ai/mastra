import { getUnixTime } from 'date-fns';

import { Day } from 'components/Day';
import { WeekNumber } from 'components/WeekNumber';
import { useDayPicker } from 'contexts/DayPicker';

/**
 * The props for the {@link Row} component.
 */
export interface RowProps {
  /** The month where the row is displayed. */
  displayMonth: Date;
  /** The number of the week to render. */
  weekNumber: number;
  /** The days contained in the week. */
  dates: Date[];
}

/** Render a row in the calendar, with the days and the week number. */
export function Row(props: RowProps): JSX.Element {
  const { styles, classNames, showWeekNumber, components } = useDayPicker();

  const DayComponent = components?.Day ?? Day;
  const WeeknumberComponent = components?.WeekNumber ?? WeekNumber;

  let weekNumberCell;
  if (showWeekNumber) {
    weekNumberCell = (
      <td className={classNames.cell} style={styles.cell}>
        <WeeknumberComponent number={props.weekNumber} dates={props.dates} />
      </td>
    );
  }

  return (
    <tr className={classNames.row} style={styles.row}>
      {weekNumberCell}
      {props.dates.map((date) => (
        <td
          className={classNames.cell}
          style={styles.cell}
          key={getUnixTime(date)}
          role="presentation"
        >
          <DayComponent displayMonth={props.displayMonth} date={date} />
        </td>
      ))}
    </tr>
  );
}
