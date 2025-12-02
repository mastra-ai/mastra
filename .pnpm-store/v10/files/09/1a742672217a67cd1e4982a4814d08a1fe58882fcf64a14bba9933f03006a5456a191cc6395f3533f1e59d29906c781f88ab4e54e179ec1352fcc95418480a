import { useDayPicker } from 'contexts/DayPicker';

export interface FooterProps {
  /** The month where the footer is displayed. */
  displayMonth?: Date;
}
/** Render the Footer component (empty as default).*/
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Footer(props: FooterProps): JSX.Element {
  const {
    footer,
    styles,
    classNames: { tfoot }
  } = useDayPicker();
  if (!footer) return <></>;
  return (
    <tfoot className={tfoot} style={styles.tfoot}>
      <tr>
        <td colSpan={8}>{footer}</td>
      </tr>
    </tfoot>
  );
}
