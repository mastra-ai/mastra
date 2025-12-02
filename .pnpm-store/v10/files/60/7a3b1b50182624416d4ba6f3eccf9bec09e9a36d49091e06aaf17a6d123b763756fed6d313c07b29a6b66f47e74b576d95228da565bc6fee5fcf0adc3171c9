import { CaptionDropdowns } from 'components/CaptionDropdowns';
import { CaptionLabel } from 'components/CaptionLabel';
import { CaptionNavigation } from 'components/CaptionNavigation';
import { useDayPicker } from 'contexts/DayPicker';

/** Represent the props of the {@link Caption} component. */
export interface CaptionProps {
  /** The ID for the heading element. Must be the same as the labelled-by in Table. */
  id?: string;
  /** The month where the caption is displayed. */
  displayMonth: Date;
  /** The index of the month where the caption is displayed. Older custom components may miss this prop. */
  displayIndex?: number | undefined;
}

/**
 * The layout of the caption:
 *
 * - `dropdown`: display dropdowns for choosing the month and the year.
 * - `buttons`: display previous month / next month buttons.
 * - `dropdown-buttons`: display both month / year dropdowns and previous month / next month buttons.
 */
export type CaptionLayout = 'dropdown' | 'buttons' | 'dropdown-buttons';

/**
 * Render the caption of a month. The caption has a different layout when
 * setting the {@link DayPickerBase.captionLayout} prop.
 */
export function Caption(props: CaptionProps): JSX.Element {
  const { classNames, disableNavigation, styles, captionLayout, components } =
    useDayPicker();

  const CaptionLabelComponent = components?.CaptionLabel ?? CaptionLabel;

  let caption: JSX.Element;
  if (disableNavigation) {
    caption = (
      <CaptionLabelComponent id={props.id} displayMonth={props.displayMonth} />
    );
  } else if (captionLayout === 'dropdown') {
    caption = (
      <CaptionDropdowns displayMonth={props.displayMonth} id={props.id} />
    );
  } else if (captionLayout === 'dropdown-buttons') {
    caption = (
      <>
        <CaptionDropdowns
          displayMonth={props.displayMonth}
          displayIndex={props.displayIndex}
          id={props.id}
        />
        <CaptionNavigation
          displayMonth={props.displayMonth}
          displayIndex={props.displayIndex}
          id={props.id}
        />
      </>
    );
  } else {
    caption = (
      <>
        <CaptionLabelComponent
          id={props.id}
          displayMonth={props.displayMonth}
          displayIndex={props.displayIndex}
        />
        <CaptionNavigation displayMonth={props.displayMonth} id={props.id} />
      </>
    );
  }

  return (
    <div className={classNames.caption} style={styles.caption}>
      {caption}
    </div>
  );
}
