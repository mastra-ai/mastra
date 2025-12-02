import { useDayPicker } from 'contexts/DayPicker';

/** The props for the {@link CaptionLabel} component. */
export interface CaptionLabelProps {
  /** The ID for the heading element. Must be the same as the labelled-by in Table. */
  id?: string;
  /** The month where the caption is displayed. */
  displayMonth: Date;
  /** The index of the month where the caption is displayed. Older custom components may miss this prop. */
  displayIndex?: number | undefined;
}

/** Render the caption for the displayed month. This component is used when `captionLayout="buttons"`. */
export function CaptionLabel(props: CaptionLabelProps): JSX.Element {
  const {
    locale,
    classNames,
    styles,
    formatters: { formatCaption }
  } = useDayPicker();
  return (
    <div
      className={classNames.caption_label}
      style={styles.caption_label}
      aria-live="polite"
      role="presentation"
      id={props.id}
    >
      {formatCaption(props.displayMonth, { locale })}
    </div>
  );
}
