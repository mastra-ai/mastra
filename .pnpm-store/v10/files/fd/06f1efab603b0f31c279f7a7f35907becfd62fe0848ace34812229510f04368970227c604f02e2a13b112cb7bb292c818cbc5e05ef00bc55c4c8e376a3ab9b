import { HeadRow } from 'components/HeadRow';
import { useDayPicker } from 'contexts/DayPicker';

/** Render the table head. */
export function Head(): JSX.Element {
  const { classNames, styles, components } = useDayPicker();
  const HeadRowComponent = components?.HeadRow ?? HeadRow;
  return (
    <thead style={styles.head} className={classNames.head}>
      <HeadRowComponent />
    </thead>
  );
}
