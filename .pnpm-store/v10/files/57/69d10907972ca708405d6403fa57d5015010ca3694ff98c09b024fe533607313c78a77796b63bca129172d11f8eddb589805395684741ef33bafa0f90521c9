import { useDayPicker } from 'contexts/DayPicker';

import { getWeekdays } from './utils';

/**
 * Render the HeadRow component - i.e. the table head row with the weekday names.
 */
export function HeadRow(): JSX.Element {
  const {
    classNames,
    styles,
    showWeekNumber,
    locale,
    weekStartsOn,
    ISOWeek,
    formatters: { formatWeekdayName },
    labels: { labelWeekday }
  } = useDayPicker();

  const weekdays = getWeekdays(locale, weekStartsOn, ISOWeek);

  return (
    <tr style={styles.head_row} className={classNames.head_row}>
      {showWeekNumber && (
        <td style={styles.head_cell} className={classNames.head_cell}></td>
      )}
      {weekdays.map((weekday, i) => (
        <th
          key={i}
          scope="col"
          className={classNames.head_cell}
          style={styles.head_cell}
          aria-label={labelWeekday(weekday, { locale })}
        >
          {formatWeekdayName(weekday, { locale })}
        </th>
      ))}
    </tr>
  );
}
