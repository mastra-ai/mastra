import { ReactNode } from 'react';

import { useDayPicker } from 'contexts/DayPicker';

/** The props for the {@link Months} component. */
export type MonthsProps = { children: ReactNode };

/**
 * Render the wrapper for the month grids.
 */
export function Months(props: MonthsProps): JSX.Element {
  const { classNames, styles } = useDayPicker();

  return (
    <div className={classNames.months} style={styles.months}>
      {props.children}
    </div>
  );
}
