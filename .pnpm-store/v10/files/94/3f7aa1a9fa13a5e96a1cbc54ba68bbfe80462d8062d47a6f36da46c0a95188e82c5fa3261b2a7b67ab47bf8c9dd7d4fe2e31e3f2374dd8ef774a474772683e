import * as react from 'react';
import { CSSProperties, ReactNode, SelectHTMLAttributes, ChangeEventHandler, MouseEvent, FocusEvent, KeyboardEvent, PointerEvent, TouchEvent, InputHTMLAttributes, HTMLProps, RefObject } from 'react';
import { Locale } from 'date-fns';

/** Represent the props of the {@link Caption} component. */
interface CaptionProps {
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
type CaptionLayout = 'dropdown' | 'buttons' | 'dropdown-buttons';
/**
 * Render the caption of a month. The caption has a different layout when
 * setting the {@link DayPickerBase.captionLayout} prop.
 */
declare function Caption(props: CaptionProps): JSX.Element;

/** The props for the {@link CaptionLabel} component. */
interface CaptionLabelProps {
    /** The ID for the heading element. Must be the same as the labelled-by in Table. */
    id?: string;
    /** The month where the caption is displayed. */
    displayMonth: Date;
    /** The index of the month where the caption is displayed. Older custom components may miss this prop. */
    displayIndex?: number | undefined;
}
/** Render the caption for the displayed month. This component is used when `captionLayout="buttons"`. */
declare function CaptionLabel(props: CaptionLabelProps): JSX.Element;

/** Represent the props used by the {@link Day} component. */
interface DayProps {
    /** The month where the date is displayed. */
    displayMonth: Date;
    /** The date to render. */
    date: Date;
}
/**
 * The content of a day cell – as a button or span element according to its
 * modifiers.
 */
declare function Day(props: DayProps): JSX.Element;

/**
 * A value or a function that matches a specific day.
 *
 *
 * Matchers are passed to DayPicker via {@link DayPickerBase.disabled},
 * {@link DayPickerBase.hidden]] or [[DayPickerProps.selected} and are used to
 * determine if a day should get a {@link Modifier}.
 *
 * Matchers can be of different types:
 *
 * ```
 * // will always match the day
 * const booleanMatcher: Matcher = true;
 *
 *  // will match the today's date
 * const dateMatcher: Matcher = new Date();
 *
 * // will match the days in the array
 * const arrayMatcher: Matcher = [new Date(2019, 1, 2), new Date(2019, 1, 4)];
 *
 * // will match days after the 2nd of February 2019
 * const afterMatcher: DateAfter = { after: new Date(2019, 1, 2) };
 *  // will match days before the 2nd of February 2019 }
 * const beforeMatcher: DateBefore = { before: new Date(2019, 1, 2) };
 *
 * // will match Sundays
 * const dayOfWeekMatcher: DayOfWeek = {
 *  dayOfWeek: 0
 * };
 *
 * // will match the included days, except the two dates
 * const intervalMatcher: DateInterval = {
 *    after: new Date(2019, 1, 2),
 *    before: new Date(2019, 1, 5)
 * };
 *
 * // will match the included days, including the two dates
 * const rangeMatcher: DateRange = {
 *    from: new Date(2019, 1, 2),
 *    to: new Date(2019, 1, 5)
 * };
 *
 * // will match when the function return true
 * const functionMatcher: Matcher = (day: Date) => {
 *  return day.getMonth() === 2 // match when month is March
 * };
 * ```
 *
 * @see {@link isMatch}
 *
 * */
type Matcher = boolean | ((date: Date) => boolean) | Date | Date[] | DateRange | DateBefore | DateAfter | DateInterval | DayOfWeek;
/** A matcher to match a day falling after the specified date, with the date not included. */
type DateAfter = {
    after: Date;
};
/** A matcher to match a day falling before the specified date, with the date not included. */
type DateBefore = {
    before: Date;
};
/** A matcher to match a day falling before and/or after two dates, where the dates are not included. */
type DateInterval = {
    before: Date;
    after: Date;
};
/** A matcher to match a range of dates. The range can be open. Differently from {@link DateInterval}, the dates here are included. */
type DateRange = {
    from: Date | undefined;
    to?: Date | undefined;
};
/** A matcher to match a date being one of the specified days of the week (`0-6`, where `0` is Sunday). */
type DayOfWeek = {
    dayOfWeek: number[];
};
/** Returns true if `matcher` is of type {@link DateInterval}. */
declare function isDateInterval(matcher: unknown): matcher is DateInterval;
/** Returns true if `value` is a {@link DateRange} type. */
declare function isDateRange(value: unknown): value is DateRange;
/** Returns true if `value` is of type {@link DateAfter}. */
declare function isDateAfterType(value: unknown): value is DateAfter;
/** Returns true if `value` is of type {@link DateBefore}. */
declare function isDateBeforeType(value: unknown): value is DateBefore;
/** Returns true if `value` is a {@link DayOfWeek} type. */
declare function isDayOfWeekType(value: unknown): value is DayOfWeek;

/** A _modifier_ represents different styles or states of a day displayed in the calendar. */
type Modifier = string;
/** The modifiers used by DayPicker. */
type Modifiers = CustomModifiers & InternalModifiers;
/** The name of the modifiers that are used internally by DayPicker. */
declare enum InternalModifier {
    Outside = "outside",
    /** Name of the modifier applied to the disabled days, using the `disabled` prop. */
    Disabled = "disabled",
    /** Name of the modifier applied to the selected days using the `selected` prop). */
    Selected = "selected",
    /** Name of the modifier applied to the hidden days using the `hidden` prop). */
    Hidden = "hidden",
    /** Name of the modifier applied to the day specified using the `today` prop). */
    Today = "today",
    /** The modifier applied to the day starting a selected range, when in range selection mode.  */
    RangeStart = "range_start",
    /** The modifier applied to the day ending a selected range, when in range selection mode.  */
    RangeEnd = "range_end",
    /** The modifier applied to the days between the start and the end of a selected range, when in range selection mode.  */
    RangeMiddle = "range_middle"
}
/** Map of matchers used for the internal modifiers. */
type InternalModifiers = Record<InternalModifier, Matcher[]>;
/**
 * The modifiers that are matching a day in the calendar. Use the {@link useActiveModifiers} hook to get the modifiers for a day.
 *
 * ```
 * const activeModifiers: ActiveModifiers = {
 *  selected: true,
 *  customModifier: true
 * }
 * ```
 *
 * */
type ActiveModifiers = Record<Modifier, true> & Partial<Record<InternalModifier, true>>;
/** The style to apply to each day element matching a modifier. */
type ModifiersStyles = Record<Modifier, CSSProperties> & Partial<Record<InternalModifier, CSSProperties>>;
/** The classnames to assign to each day element matching a modifier. */
type ModifiersClassNames = Record<Modifier, string> & Partial<Record<InternalModifier, string>>;
/** The custom modifiers passed to the {@link DayPickerBase.modifiers}. */
type DayModifiers = Record<Modifier, Matcher | Matcher[]>;
/**
 * A map of matchers used as custom modifiers by DayPicker component. This is
 * the same as {@link DayModifiers]], but it accepts only array of [[Matcher}s.
 */
type CustomModifiers = Record<Modifier, Matcher[]>;

/** Represent the props for the {@link DayContent} component. */
interface DayContentProps {
    /** The date representing the day. */
    date: Date;
    /** The month where the day is displayed. */
    displayMonth: Date;
    /** The active modifiers for the given date. */
    activeModifiers: ActiveModifiers;
}
/** Render the content of the day cell. */
declare function DayContent(props: DayContentProps): JSX.Element;

/** The props for the {@link Dropdown} component. */
interface DropdownProps {
    /** The name attribute of the element. */
    name?: string;
    /** The caption displayed to replace the hidden select. */
    caption?: ReactNode;
    children?: SelectHTMLAttributes<HTMLSelectElement>['children'];
    className?: string;
    ['aria-label']?: string;
    style?: CSSProperties;
    /** The selected value. */
    value?: string | number;
    onChange?: ChangeEventHandler<HTMLSelectElement>;
}
/**
 * Render a styled select component – displaying a caption and a custom
 * drop-down icon.
 */
declare function Dropdown(props: DropdownProps): JSX.Element;

interface FooterProps {
    /** The month where the footer is displayed. */
    displayMonth?: Date;
}
/** Render the Footer component (empty as default).*/
declare function Footer(props: FooterProps): JSX.Element;

/** The props for the {@link Months} component. */
type MonthsProps = {
    children: ReactNode;
};
/**
 * Render the wrapper for the month grids.
 */
declare function Months(props: MonthsProps): JSX.Element;

/**
 * The props for the {@link Row} component.
 */
interface RowProps {
    /** The month where the row is displayed. */
    displayMonth: Date;
    /** The number of the week to render. */
    weekNumber: number;
    /** The days contained in the week. */
    dates: Date[];
}
/** Render a row in the calendar, with the days and the week number. */
declare function Row(props: RowProps): JSX.Element;

/**
 * The props for the {@link WeekNumber} component.
 */
interface WeekNumberProps {
    /** The number of the week. */
    number: number;
    /** The dates in the week. */
    dates: Date[];
}
/**
 * Render the week number element. If `onWeekNumberClick` is passed to DayPicker, it
 * renders a button, otherwise a span element.
 */
declare function WeekNumber(props: WeekNumberProps): JSX.Element;

/** The event handler when a day is clicked. */
type DayClickEventHandler = (day: Date, activeModifiers: ActiveModifiers, e: MouseEvent) => void;
/** The event handler when a day is focused. */
type DayFocusEventHandler = (day: Date, activeModifiers: ActiveModifiers, e: FocusEvent | KeyboardEvent) => void;
/** The event handler when a day gets a keyboard event. */
type DayKeyboardEventHandler = (day: Date, activeModifiers: ActiveModifiers, e: KeyboardEvent) => void;
/** The event handler when a day gets a mouse event. */
type DayMouseEventHandler = (day: Date, activeModifiers: ActiveModifiers, e: MouseEvent) => void;
/** The event handler when a day gets a pointer event. */
type DayPointerEventHandler = (day: Date, activeModifiers: ActiveModifiers, e: PointerEvent) => void;
/** The event handler when a month is changed in the calendar. */
type MonthChangeEventHandler = (month: Date) => void;
/** The event handler when selecting multiple days. */
type SelectMultipleEventHandler = (
/** The selected days */
days: Date[] | undefined, 
/** The day that was clicked triggering the event. */
selectedDay: Date, 
/** The day that was clicked */
activeModifiers: ActiveModifiers, 
/** The mouse event that triggered this event. */
e: MouseEvent) => void;
/** The event handler when selecting a range of days. */
type SelectRangeEventHandler = (
/** The current range of the selected days. */
range: DateRange | undefined, 
/** The day that was selected (or clicked) triggering the event. */
selectedDay: Date, 
/** The modifiers of the selected day. */
activeModifiers: ActiveModifiers, e: MouseEvent) => void;
/** The event handler when selecting a single day. */
type SelectSingleEventHandler = (
/** The selected day, `undefined` when `required={false}` (default) and the day is clicked again. */
day: Date | undefined, 
/** The day that was selected (or clicked) triggering the event. */
selectedDay: Date, 
/** The modifiers of the selected day. */
activeModifiers: ActiveModifiers, e: MouseEvent) => void;
/**The event handler when the week number is clicked. */
type WeekNumberClickEventHandler = (
/** The week number that has been clicked. */
weekNumber: number, 
/** The dates in the clicked week. */
dates: Date[], 
/** The mouse event that triggered this event. */
e: MouseEvent) => void;
/** The event handler when a day gets a touch event. */
type DayTouchEventHandler = (day: Date, activeModifiers: ActiveModifiers, e: TouchEvent) => void;

/** Represents a function to format a date. */
type DateFormatter = (date: Date, options?: {
    locale?: Locale;
}) => ReactNode;
/** Represent a map of formatters used to render localized content. */
type Formatters = {
    /** Format the month in the caption when `captionLayout` is `buttons`. */
    formatCaption: DateFormatter;
    /** Format the month in the navigation dropdown. */
    formatMonthCaption: DateFormatter;
    /** Format the year in the navigation dropdown. */
    formatYearCaption: DateFormatter;
    /** Format the day in the day cell. */
    formatDay: DateFormatter;
    /** Format the week number. */
    formatWeekNumber: WeekNumberFormatter;
    /** Format the week day name in the header */
    formatWeekdayName: DateFormatter;
};
/** Represent a function to format the week number. */
type WeekNumberFormatter = (weekNumber: number, options?: {
    locale?: Locale;
}) => ReactNode;

/** Map of functions to translate ARIA labels for the relative elements. */
type Labels = {
    labelMonthDropdown: () => string;
    labelYearDropdown: () => string;
    labelNext: NavButtonLabel;
    labelPrevious: NavButtonLabel;
    /** @deprecated This label is not used anymore and this function will be removed in the future. */
    labelDay: DayLabel;
    labelWeekday: WeekdayLabel;
    labelWeekNumber: WeekNumberLabel;
};
/** Return the ARIA label for the {@link Day} component. */
type DayLabel = (day: Date, activeModifiers: ActiveModifiers, options?: {
    locale?: Locale;
}) => string;
/** Return the ARIA label for the "next month" / "prev month" buttons in the navigation.*/
type NavButtonLabel = (month?: Date, options?: {
    locale?: Locale;
}) => string;
/** Return the ARIA label for the Head component.*/
type WeekdayLabel = (day: Date, options?: {
    locale?: Locale;
}) => string;
/** Return the ARIA label of the week number.*/
type WeekNumberLabel = (n: number, options?: {
    locale?: Locale;
}) => string;

/** The style (either via class names or via in-line styles) of an element. */
type StyledElement<T = string | CSSProperties> = {
    /** The root element. */
    readonly root: T;
    /** The root element when `numberOfMonths > 1`. */
    readonly multiple_months: T;
    /** The root element when `showWeekNumber={true}`. */
    readonly with_weeknumber: T;
    /** The style of an element visually hidden. */
    readonly vhidden: T;
    /** The style for resetting the buttons. */
    readonly button_reset: T;
    /** The buttons. */
    readonly button: T;
    /** The caption (showing the calendar heading and the navigation) */
    readonly caption: T;
    /** The caption when at the start of a series of months. */
    readonly caption_start: T;
    /** The caption when at the end of a series of months. */
    readonly caption_end: T;
    /** The caption when between two months (when `multipleMonths > 2`). */
    readonly caption_between: T;
    /** The caption label. */
    readonly caption_label: T;
    /** The drop-downs container. */
    readonly caption_dropdowns: T;
    /** The drop-down (select) element. */
    readonly dropdown: T;
    /** The drop-down to change the month. */
    readonly dropdown_month: T;
    /** The drop-down to change the year. */
    readonly dropdown_year: T;
    /** The drop-down icon. */
    readonly dropdown_icon: T;
    /** The months wrapper. */
    readonly months: T;
    /** The table wrapper. */
    readonly month: T;
    /** Table containing the monthly calendar. */
    readonly table: T;
    /** The table body. */
    readonly tbody: T;
    /** The table footer. */
    readonly tfoot: T;
    /** The table’s head. */
    readonly head: T;
    /** The row in the head. */
    readonly head_row: T;
    /** The head cell. */
    readonly head_cell: T;
    /** The navigation container. */
    readonly nav: T;
    /** The navigation button. */
    readonly nav_button: T;
    /** The "previous month" navigation button. */
    readonly nav_button_previous: T;
    /** The "next month" navigation button. */
    readonly nav_button_next: T;
    /** The icon for the navigation button. */
    readonly nav_icon: T;
    /** The table’s row. */
    readonly row: T;
    /** The weeknumber displayed in the column. */
    readonly weeknumber: T;
    /** The table cell containing the day element. */
    readonly cell: T;
    /** The day element: it is a `span` when not interactive, a `button` otherwise. */
    readonly day: T;
    /** The day when outside the month. */
    readonly day_outside: T;
    /** The day when selected. */
    readonly day_selected: T;
    /** The day when disabled. */
    readonly day_disabled: T;
    /** The day when hidden. */
    readonly day_hidden: T;
    /** The day when at the start of a selected range. */
    readonly day_range_start: T;
    /** The day when at the end of a selected range. */
    readonly day_range_end: T;
    /** The day in the middle of a selected range: it does not include the "from" and the "to" days. */
    readonly day_range_middle: T;
    /** The day when today. */
    readonly day_today: T;
};
/** These elements must not be in the `styles` or `classNames` records as they are styled via the `modifiersStyles` or `modifiersClassNames` pop */
type InternalModifiersElement = 'day_outside' | 'day_selected' | 'day_disabled' | 'day_hidden' | 'day_range_start' | 'day_range_end' | 'day_range_middle' | 'day_today';
/** The class names of each element. */
type ClassNames = Partial<StyledElement<string>>;
/**
 * The inline-styles of each styled element, to use with the `styles` prop. Day
 * modifiers, such as `today` or `hidden`, should be styled using the
 * `modifiersStyles` prop.
 */
type Styles = Partial<Omit<StyledElement<CSSProperties>, InternalModifiersElement>>;
/** Props of a component that can be styled via classNames or inline-styles. */
type StyledComponent = {
    className?: string;
    style?: CSSProperties;
    children?: ReactNode;
};

/**
 * Selection modes supported by DayPicker.
 *
 * - `single`: use DayPicker to select single days.
 * - `multiple`: allow selecting multiple days.
 * - `range`: use DayPicker to select a range of days
 * - `default`: disable the built-in selection behavior. Customize what is
 *   selected by using {@link DayPickerBase.onDayClick}.
 */
type DaySelectionMode = 'single' | 'multiple' | 'range' | 'default';
/**
 * The base props for the {@link DayPicker} component and the {@link DayPickerContext}.
 */
interface DayPickerBase {
    /**
     * The CSS class to add to the container element. To change the name of the
     * class instead, use `classNames.root`.
     */
    className?: string;
    /**
     * Change the class names of the HTML elements.
     *
     * Use this prop when you need to change the default class names — for example
     * when using CSS modules.
     */
    classNames?: ClassNames;
    /**
     * Change the class name for the day matching the {@link modifiers}.
     */
    modifiersClassNames?: ModifiersClassNames;
    /**
     * Style to apply to the container element.
     */
    style?: CSSProperties;
    /**
     * Change the inline styles of the HTML elements.
     */
    styles?: Styles;
    /**
     * Change the inline style for the day matching the {@link modifiers}.
     */
    modifiersStyles?: ModifiersStyles;
    /**
     * A unique id to replace the random generated id – used by DayPicker for
     * accessibility.
     */
    id?: string;
    /**
     * The initial month to show in the calendar. Use this prop to let DayPicker
     * control the current month. If you need to set the month programmatically,
     * use {@link month]] and [[onMonthChange}.
     *
     * @defaultValue The current month
     */
    defaultMonth?: Date;
    /**
     * The month displayed in the calendar.
     *
     * As opposed to {@link DayPickerBase.defaultMonth}, use this prop with
     * {@link DayPickerBase.onMonthChange} to change the month programmatically.
     */
    month?: Date;
    /**
     * Event fired when the user navigates between months.
     */
    onMonthChange?: MonthChangeEventHandler;
    /**
     * The number of displayed months.
     *
     * @defaultValue 1
     */
    numberOfMonths?: number;
    /**
     * The earliest day to start the month navigation.
     */
    fromDate?: Date;
    /**
     * The latest day to end the month navigation.
     */
    toDate?: Date;
    /**
     * The earliest month to start the month navigation.
     */
    fromMonth?: Date;
    /**
     * The latest month to end the month navigation.
     */
    toMonth?: Date;
    /**
     * The earliest year to start the month navigation.
     */
    fromYear?: number;
    /**
     * The latest year to end the month navigation.
     */
    toYear?: number;
    /**
     * Disable the navigation between months.
     *
     * @defaultValue false
     */
    disableNavigation?: boolean;
    /**
     * Paginate the month navigation displaying the {@link numberOfMonths} at
     * time.
     *
     * @defaultValue false
     */
    pagedNavigation?: boolean;
    /**
     * Render the months in reversed order (when {@link numberOfMonths} is greater
     * than `1`) to display the most recent month first.
     *
     * @defaultValue false
     */
    reverseMonths?: boolean;
    /**
     * Change the layout of the caption:
     *
     * - `buttons`: display prev/right buttons
     * - `dropdown`: display drop-downs to change the month and the year
     *
     * **Note:** the `dropdown` layout is available only when `fromDate`,
     * `fromMonth` or`fromYear` and `toDate`, `toMonth` or `toYear` are set.
     *
     * @defaultValue buttons
     */
    captionLayout?: CaptionLayout;
    /**
     * Display six weeks per months, regardless the month’s number of weeks.
     * To use this prop, {@link showOutsideDays} must be set.
     *
     * @defaultValue false
     */
    fixedWeeks?: boolean;
    /**
     * Hide the month’s head displaying the weekday names.
     *
     * @defaultValue false
     */
    hideHead?: boolean;
    /**
     * Show the outside days.  An outside day is a day falling in the next or the
     * previous month.
     *
     * @defaultValue false
     */
    showOutsideDays?: boolean;
    /**
     * Show the week numbers column. Weeks are numbered according to the local
     * week index.
     *
     * - to use ISO week numbering, use the {@link ISOWeek} prop.
     * - to change how the week numbers are displayed, use the {@link Formatters} prop.
     *
     * @see  {@link ISOWeek}, {@link weekStartsOn} and {@link firstWeekContainsDate}.
     *
     * @defaultValue false
     */
    showWeekNumber?: boolean;
    /**
     * The index of the first day of the week (0 - Sunday). Overrides the locale's one.
     *
     * @see {@link ISOWeek}.
     */
    weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    /**
     * The day of January, which is always in the first week of the year. Can be
     * either Monday (`1`) or Thursday (`4`).
     *
     * @see https://date-fns.org/docs/getWeek
     * @see https://en.wikipedia.org/wiki/Week#Numbering
     * @see {@link ISOWeek}.
     */
    firstWeekContainsDate?: 1 | 4;
    /**
     * Use ISO week dates instead of the locale setting. Setting this prop will
     * ignore {@link weekStartsOn} and {@link firstWeekContainsDate}.
     *
     * @see https://en.wikipedia.org/wiki/ISO_week_date
     */
    ISOWeek?: boolean;
    /**
     * Map of components used to create the layout. Look at the [components
     * source](https://github.com/gpbl/react-day-picker/tree/main/src/components)
     * to understand how internal components are built and provide your custom components.
     */
    components?: CustomComponents;
    /**
     * Content to add to the table footer element.
     */
    footer?: ReactNode;
    /**
     * When a selection mode is set, DayPicker will focus the first selected day
     * (if set) or the today's date (if not disabled).
     *
     * Use this prop when you need to focus DayPicker after a user actions, for
     * improved accessibility.
     */
    initialFocus?: boolean;
    /**
     * Apply the `disabled` modifier to the matching days.
     */
    disabled?: Matcher | Matcher[] | undefined;
    /**
     * Apply the `hidden` modifier to the matching days. Will hide them from the
     * calendar.
     */
    hidden?: Matcher | Matcher[] | undefined;
    /**
     * Apply the `selected` modifier to the matching days.
     */
    selected?: Matcher | Matcher[] | undefined;
    /**
     * The today’s date. Default is the current date. This Date will get the
     * `today` modifier to style the day.
     */
    today?: Date;
    /**
     * Add modifiers to the matching days.
     */
    modifiers?: DayModifiers;
    /**
     * The date-fns locale object used to localize dates.
     *
     * @defaultValue en-US
     */
    locale?: Locale;
    /**
     * Labels creators to override the defaults. Use this prop to customize the
     * ARIA labels attributes.
     */
    labels?: Partial<Labels>;
    /**
     * A map of formatters. Use the formatters to override the default formatting
     * functions.
     */
    formatters?: Partial<Formatters>;
    /**
     * The text direction of the calendar. Use `ltr` for left-to-right (default)
     * or `rtl` for right-to-left.
     */
    dir?: HTMLDivElement['dir'];
    /**
     * A cryptographic nonce ("number used once") which can be used by Content
     * Security Policy for the inline `style` attributes.
     **/
    nonce?: HTMLDivElement['nonce'];
    /**
     * Add a `title` attribute to the container element.
     **/
    title?: HTMLDivElement['title'];
    /**
     * Add the language tag to the container element.
     **/
    lang?: HTMLDivElement['lang'];
    /**
     * Event callback fired when the next month button is clicked.
     */
    onNextClick?: MonthChangeEventHandler;
    /**
     * Event callback fired when the previous month button is clicked.
     */
    onPrevClick?: MonthChangeEventHandler;
    /**
     * Event callback fired when the week number is clicked. Requires
     * `showWeekNumbers` set.
     */
    onWeekNumberClick?: WeekNumberClickEventHandler;
    /**
     * Event callback fired when the user clicks on a day.
     */
    onDayClick?: DayClickEventHandler;
    /**
     * Event callback fired when the user focuses on a day.
     */
    onDayFocus?: DayFocusEventHandler;
    /**
     * Event callback fired when the user blurs from a day.
     */
    onDayBlur?: DayFocusEventHandler;
    /**
     * Event callback fired when the user hovers on a day.
     */
    onDayMouseEnter?: DayMouseEventHandler;
    /**
     * Event callback fired when the user hovers away from a day.
     */
    onDayMouseLeave?: DayMouseEventHandler;
    /**
     * Event callback fired when the user presses a key on a day.
     */
    onDayKeyDown?: DayKeyboardEventHandler;
    /**
     * Event callback fired when the user presses a key on a day.
     */
    onDayKeyUp?: DayKeyboardEventHandler;
    /**
     * Event callback fired when the user presses a key on a day.
     */
    onDayKeyPress?: DayKeyboardEventHandler;
    /**
     * Event callback fired when the pointer enters a day.
     */
    onDayPointerEnter?: DayPointerEventHandler;
    /**
     * Event callback fired when the pointer leaves a day.
     */
    onDayPointerLeave?: DayPointerEventHandler;
    /**
     * Event callback when a day touch event is canceled.
     */
    onDayTouchCancel?: DayTouchEventHandler;
    /**
     * Event callback when a day touch event ends.
     */
    onDayTouchEnd?: DayTouchEventHandler;
    /**
     * Event callback when a day touch event moves.
     */
    onDayTouchMove?: DayTouchEventHandler;
    /**
     * Event callback when a day touch event starts.
     */
    onDayTouchStart?: DayTouchEventHandler;
}
/**
 * Map of the components that can be changed using the `components` prop.
 *
 * @see https://github.com/gpbl/react-day-picker/tree/main/src/components
 */
interface CustomComponents {
    /** The component for the caption element. */
    Caption?: (props: CaptionProps) => JSX.Element | null;
    /** The component for the caption element. */
    CaptionLabel?: (props: CaptionLabelProps) => JSX.Element | null;
    /**
     * The component for the day element.
     *
     * Each `Day` in DayPicker should render one of the following, according to
     * the return value of {@link useDayRender}.
     *
     * - an empty `Fragment`, to render if `isHidden` is true
     * - a `button` element, when the day is interactive, e.g. is selectable
     * - a `div` or a `span` element, when the day is not interactive
     *
     */
    Day?: (props: DayProps) => JSX.Element | null;
    /** The component for the content of the day element. */
    DayContent?: (props: DayContentProps) => JSX.Element | null;
    /** The component for the drop-down elements. */
    Dropdown?: (props: DropdownProps) => JSX.Element | null;
    /** The component for the table footer. */
    Footer?: (props: FooterProps) => JSX.Element | null;
    /** The component for the table’s head. */
    Head?: () => JSX.Element | null;
    /** The component for the table’s head row. */
    HeadRow?: () => JSX.Element | null;
    /** The component for the small icon in the drop-downs. */
    IconDropdown?: (props: StyledComponent) => JSX.Element | null;
    /** The arrow right icon (used for the Navigation buttons). */
    IconRight?: (props: StyledComponent) => JSX.Element | null;
    /** The arrow left icon (used for the Navigation buttons). */
    IconLeft?: (props: StyledComponent) => JSX.Element | null;
    /** The component wrapping the month grids. */
    Months?: (props: MonthsProps) => JSX.Element | null;
    /** The component for the table rows. */
    Row?: (props: RowProps) => JSX.Element | null;
    /** The component for the week number in the table rows. */
    WeekNumber?: (props: WeekNumberProps) => JSX.Element | null;
}

/** The props for the {@link DayPicker} component when using `mode="default"` or `undefined`. */
interface DayPickerDefaultProps extends DayPickerBase {
    mode?: undefined | 'default';
}
/** Returns true when the props are of type {@link DayPickerDefaultProps}. */
declare function isDayPickerDefault(props: DayPickerProps): props is DayPickerDefaultProps;

/** The props for the {@link DayPicker} component when using `mode="range"`. */
interface DayPickerRangeProps extends DayPickerBase {
    mode: 'range';
    /** The selected range of days. */
    selected?: DateRange | undefined;
    /** Event fired when a range (or a part of the range) is selected. */
    onSelect?: SelectRangeEventHandler;
    /** The minimum amount of days that can be selected. */
    min?: number;
    /** The maximum amount of days that can be selected. */
    max?: number;
}
/** Returns true when the props are of type {@link DayPickerRangeProps}. */
declare function isDayPickerRange(props: DayPickerProps | DayPickerContextValue): props is DayPickerRangeProps;

/** The props for the {@link DayPicker} component when using `mode="single"`. */
interface DayPickerSingleProps extends DayPickerBase {
    mode: 'single';
    /** The selected day. */
    selected?: Date | undefined;
    /** Event fired when a day is selected. */
    onSelect?: SelectSingleEventHandler;
    /** Make the selection required. */
    required?: boolean;
}
/** Returns true when the props are of type {@link DayPickerSingleProps}. */
declare function isDayPickerSingle(props: DayPickerProps | DayPickerContextValue): props is DayPickerSingleProps;

/**
 * The value of the {@link DayPickerContext} extends the props from DayPicker
 * with default and cleaned up values.
 */
interface DayPickerContextValue extends DayPickerBase {
    mode: DaySelectionMode;
    onSelect?: DayPickerSingleProps['onSelect'] | DayPickerMultipleProps['onSelect'] | DayPickerRangeProps['onSelect'];
    required?: boolean;
    min?: number;
    max?: number;
    selected?: Matcher | Matcher[];
    captionLayout: CaptionLayout;
    classNames: Required<ClassNames>;
    formatters: Formatters;
    labels: Labels;
    locale: Locale;
    modifiersClassNames: ModifiersClassNames;
    modifiers: DayModifiers;
    numberOfMonths: number;
    styles: Styles;
    today: Date;
}
/**
 * The DayPicker context shares the props passed to DayPicker within internal
 * and custom components. It is used to set the default values and perform
 * one-time calculations required to render the days.
 *
 * Access to this context from the {@link useDayPicker} hook.
 */
declare const DayPickerContext: react.Context<DayPickerContextValue | undefined>;
/** The props for the {@link DayPickerProvider}. */
interface DayPickerProviderProps {
    /** The initial props from the DayPicker component. */
    initialProps: DayPickerProps;
    children?: ReactNode;
}
/**
 * The provider for the {@link DayPickerContext}, assigning the defaults from the
 * initial DayPicker props.
 */
declare function DayPickerProvider(props: DayPickerProviderProps): JSX.Element;
/**
 * Hook to access the {@link DayPickerContextValue}.
 *
 * Use the DayPicker context to access to the props passed to DayPicker inside
 * internal or custom components.
 */
declare function useDayPicker(): DayPickerContextValue;

/** The props for the {@link DayPicker} component when using `mode="multiple"`. */
interface DayPickerMultipleProps extends DayPickerBase {
    mode: 'multiple';
    /** The selected days. */
    selected?: Date[] | undefined;
    /** Event fired when a days added or removed to the selection. */
    onSelect?: SelectMultipleEventHandler;
    /** The minimum amount of days that can be selected. */
    min?: number;
    /** The maximum amount of days that can be selected. */
    max?: number;
}
/** Returns true when the props are of type {@link DayPickerMultipleProps}. */
declare function isDayPickerMultiple(props: DayPickerProps | DayPickerContextValue): props is DayPickerMultipleProps;

type DayPickerProps = DayPickerDefaultProps | DayPickerSingleProps | DayPickerMultipleProps | DayPickerRangeProps;
/**
 * DayPicker render a date picker component to let users pick dates from a
 * calendar. See http://react-day-picker.js.org for updated documentation and
 * examples.
 *
 * ### Customization
 *
 * DayPicker offers different customization props. For example,
 *
 * - show multiple months using `numberOfMonths`
 * - display a dropdown to navigate the months via `captionLayout`
 * - display the week numbers with `showWeekNumbers`
 * - disable or hide days with `disabled` or `hidden`
 *
 * ### Controlling the months
 *
 * Change the initially displayed month using the `defaultMonth` prop. The
 * displayed months are controlled by DayPicker and stored in its internal
 * state. To control the months yourself, use `month` instead of `defaultMonth`
 * and use the `onMonthChange` event to set it.
 *
 * To limit the months the user can navigate to, use
 * `fromDate`/`fromMonth`/`fromYear` or `toDate`/`toMonth`/`toYear`.
 *
 * ### Selection modes
 *
 * DayPicker supports different selection mode that can be toggled using the
 * `mode` prop:
 *
 * - `mode="single"`: only one day can be selected. Use `required` to make the
 *   selection required. Use the `onSelect` event handler to get the selected
 *   days.
 * - `mode="multiple"`: users can select one or more days. Limit the amount of
 *   days that can be selected with the `min` or the `max` props.
 * - `mode="range"`: users can select a range of days. Limit the amount of days
 *   in the range with the `min` or the `max` props.
 * - `mode="default"` (default): the built-in selections are disabled. Implement
 *   your own selection mode with `onDayClick`.
 *
 * The selection modes should cover the most common use cases. In case you
 * need a more refined way of selecting days, use `mode="default"`. Use the
 * `selected` props and add the day event handlers to add/remove days from the
 * selection.
 *
 * ### Modifiers
 *
 * A _modifier_ represents different styles or states for the days displayed in
 * the calendar (like "selected" or "disabled"). Define custom modifiers using
 * the `modifiers` prop.
 *
 * ### Formatters and custom component
 *
 * You can customize how the content is displayed in the date picker by using
 * either the formatters or replacing the internal components.
 *
 * For the most common cases you want to use the `formatters` prop to change how
 * the content is formatted in the calendar. Use the `components` prop to
 * replace the internal components, like the navigation icons.
 *
 * ### Styling
 *
 * DayPicker comes with a default, basic style in `react-day-picker/style` – use
 * it as template for your own style.
 *
 * If you are using CSS modules, pass the imported styles object the
 * `classNames` props.
 *
 * You can also style the elements via inline styles using the `styles` prop.
 *
 * ### Form fields
 *
 * If you need to bind the date picker to a form field, you can use the
 * `useInput` hooks for a basic behavior. See the `useInput` source as an
 * example to bind the date picker with form fields.
 *
 * ### Localization
 *
 * To localize DayPicker, import the locale from `date-fns` package and use the
 * `locale` prop.
 *
 * For example, to use Spanish locale:
 *
 * ```
 * import { es } from 'date-fns/locale';
 * <DayPicker locale={es} />
 * ```
 */
declare function DayPicker(props: DayPickerDefaultProps | DayPickerSingleProps | DayPickerMultipleProps | DayPickerRangeProps): JSX.Element;

/** The props for the {@link Button} component. */
type ButtonProps = JSX.IntrinsicElements['button'];
/** Render a button HTML element applying the reset class name. */
declare const Button: react.ForwardRefExoticComponent<Omit<react.DetailedHTMLProps<react.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>, "ref"> & react.RefAttributes<HTMLButtonElement>>;

/**
 * Render a caption with the dropdowns to navigate between months and years.
 */
declare function CaptionDropdowns(props: CaptionProps): JSX.Element;

/**
 * Render a caption with a button-based navigation.
 */
declare function CaptionNavigation(props: CaptionProps): JSX.Element;

/** Render the table head. */
declare function Head(): JSX.Element;

/**
 * Render the HeadRow component - i.e. the table head row with the weekday names.
 */
declare function HeadRow(): JSX.Element;

/**
 * Render the icon in the styled drop-down.
 */
declare function IconDropdown(props: StyledComponent): JSX.Element;

/**
 * Render the "next month" button in the navigation.
 */
declare function IconRight(props: StyledComponent): JSX.Element;

/**
 * Render the "previous month" button in the navigation.
 */
declare function IconLeft(props: StyledComponent): JSX.Element;

/** The props to attach to the input field when using {@link useInput}. */
type InputProps = Pick<InputHTMLAttributes<HTMLInputElement>, 'onBlur' | 'onChange' | 'onFocus' | 'value' | 'placeholder'>;
/** The props to attach to the DayPicker component when using {@link useInput}. */
type InputDayPickerProps = Pick<DayPickerSingleProps, 'fromDate' | 'toDate' | 'locale' | 'month' | 'onDayClick' | 'onMonthChange' | 'selected' | 'today'>;
interface UseInputOptions extends Pick<DayPickerBase, 'locale' | 'fromDate' | 'toDate' | 'fromMonth' | 'toMonth' | 'fromYear' | 'toYear' | 'today'> {
    /** The initially selected date */
    defaultSelected?: Date;
    /**
     * The format string for formatting the input field. See
     * https://date-fns.org/docs/format for a list of format strings.
     *
     * @defaultValue PP
     */
    format?: string;
    /** Make the selection required. */
    required?: boolean;
}
/** Represent the value returned by {@link useInput}. */
interface UseInputValue {
    /** The props to pass to a DayPicker component. */
    dayPickerProps: InputDayPickerProps;
    /** The props to pass to an input field. */
    inputProps: InputProps;
    /** A function to reset to the initial state. */
    reset: () => void;
    /** A function to set the selected day. */
    setSelected: (day: Date | undefined) => void;
}
/** Return props and setters for binding an input field to DayPicker. */
declare function useInput(options?: UseInputOptions): UseInputValue;

type EventName = 'onClick' | 'onFocus' | 'onBlur' | 'onKeyDown' | 'onKeyUp' | 'onMouseEnter' | 'onMouseLeave' | 'onPointerEnter' | 'onPointerLeave' | 'onTouchCancel' | 'onTouchEnd' | 'onTouchMove' | 'onTouchStart';
type DayEventHandlers = Pick<HTMLProps<HTMLButtonElement>, EventName>;

type SelectedDays = Date | Date[] | DateRange | undefined;

type DayRender = {
    /** Whether the day should be rendered a `button` instead of a `div` */
    isButton: boolean;
    /** Whether the day should be hidden. */
    isHidden: boolean;
    /** The modifiers active for the given day. */
    activeModifiers: ActiveModifiers;
    /** The props to apply to the button element (when `isButton` is true). */
    buttonProps: StyledComponent & Pick<ButtonProps, 'disabled' | 'aria-selected' | 'tabIndex'> & DayEventHandlers;
    /** The props to apply to the div element (when `isButton` is false). */
    divProps: StyledComponent;
    selectedDays: SelectedDays;
};
/**
 * Return props and data used to render the {@link Day} component.
 *
 * Use this hook when creating a component to replace the built-in `Day`
 * component.
 */
declare function useDayRender(
/** The date to render. */
day: Date, 
/** The month where the date is displayed (if not the same as `date`, it means it is an "outside" day). */
displayMonth: Date, 
/** A ref to the button element that will be target of focus when rendered (if required). */
buttonRef: RefObject<HTMLButtonElement>): DayRender;

/**
 * Return the active modifiers for the specified day.
 *
 * This hook is meant to be used inside internal or custom components.
 *
 * @param day
 * @param displayMonth
 */
declare function useActiveModifiers(day: Date, 
/**
 * The month where the date is displayed. If not the same as `date`, the day
 * is an "outside day".
 */
displayMonth?: Date): ActiveModifiers;

/** Represents the value of the {@link FocusContext}. */
type FocusContextValue = {
    /** The day currently focused. */
    focusedDay: Date | undefined;
    /** Day that will be focused.  */
    focusTarget: Date | undefined;
    /** Focus a day. */
    focus: (day: Date) => void;
    /** Blur the focused day. */
    blur: () => void;
    /** Focus the day after the focused day. */
    focusDayAfter: () => void;
    /** Focus the day before the focused day. */
    focusDayBefore: () => void;
    /** Focus the day in the week before the focused day. */
    focusWeekBefore: () => void;
    /** Focus the day in the week after the focused day. */
    focusWeekAfter: () => void;
    focusMonthBefore: () => void;
    focusMonthAfter: () => void;
    focusYearBefore: () => void;
    focusYearAfter: () => void;
    focusStartOfWeek: () => void;
    focusEndOfWeek: () => void;
};
/**
 * The Focus context shares details about the focused day for the keyboard
 *
 * Access this context from the {@link useFocusContext} hook.
 */
declare const FocusContext: react.Context<FocusContextValue | undefined>;
type FocusProviderProps = {
    children: ReactNode;
};
/** The provider for the {@link FocusContext}. */
declare function FocusProvider(props: FocusProviderProps): JSX.Element;
/**
 * Hook to access the {@link FocusContextValue}. Use this hook to handle the
 * focus state of the elements.
 *
 * This hook is meant to be used inside internal or custom components.
 */
declare function useFocusContext(): FocusContextValue;

/** Represents the value of the {@link NavigationContext}. */
interface NavigationContextValue {
    /** The month to display in the calendar. When `numberOfMonths` is greater than one, is the first of the displayed months. */
    currentMonth: Date;
    /** The months rendered by DayPicker. DayPicker can render multiple months via `numberOfMonths`. */
    displayMonths: Date[];
    /** Navigate to the specified month. */
    goToMonth: (month: Date) => void;
    /** Navigate to the specified date. */
    goToDate: (date: Date, refDate?: Date) => void;
    /** The next month to display. */
    nextMonth?: Date;
    /** The previous month to display. */
    previousMonth?: Date;
    /** Whether the given day is included in the displayed months. */
    isDateDisplayed: (day: Date) => boolean;
}
/**
 * The Navigation context shares details and methods to navigate the months in DayPicker.
 * Access this context from the {@link useNavigation} hook.
 */
declare const NavigationContext: react.Context<NavigationContextValue | undefined>;
/** Provides the values for the {@link NavigationContext}. */
declare function NavigationProvider(props: {
    children?: ReactNode;
}): JSX.Element;
/**
 * Hook to access the {@link NavigationContextValue}. Use this hook to navigate
 * between months or years in DayPicker.
 *
 * This hook is meant to be used inside internal or custom components.
 */
declare function useNavigation(): NavigationContextValue;

type RootContextProps = Partial<DayPickerDefaultProps> | Partial<DayPickerSingleProps> | Partial<DayPickerMultipleProps> | Partial<DayPickerRangeProps>;
/** The props of {@link RootProvider}. */
type RootContext = RootContextProps & {
    children?: ReactNode;
};
/** Provide the value for all the context providers. */
declare function RootProvider(props: RootContext): JSX.Element;

/** Represent the modifiers that are changed by the multiple selection. */
type SelectMultipleModifiers = Pick<Modifiers, InternalModifier.Disabled>;
/** Represents the value of a {@link SelectMultipleContext}. */
interface SelectMultipleContextValue {
    /** The days that have been selected. */
    selected: Date[] | undefined;
    /** The modifiers for the corresponding selection. */
    modifiers: SelectMultipleModifiers;
    /** Event handler to attach to the day button to enable the multiple select. */
    onDayClick?: DayClickEventHandler;
}
/**
 * The SelectMultiple context shares details about the selected days when in
 * multiple selection mode.
 *
 * Access this context from the {@link useSelectMultiple} hook.
 */
declare const SelectMultipleContext: react.Context<SelectMultipleContextValue | undefined>;
type SelectMultipleProviderProps = {
    initialProps: DayPickerBase;
    children?: ReactNode;
};
/** Provides the values for the {@link SelectMultipleContext}. */
declare function SelectMultipleProvider(props: SelectMultipleProviderProps): JSX.Element;
/** @private */
interface SelectMultipleProviderInternalProps {
    initialProps: DayPickerMultipleProps;
    children?: ReactNode;
}
declare function SelectMultipleProviderInternal({ initialProps, children }: SelectMultipleProviderInternalProps): JSX.Element;
/**
 * Hook to access the {@link SelectMultipleContextValue}.
 *
 * This hook is meant to be used inside internal or custom components.
 */
declare function useSelectMultiple(): SelectMultipleContextValue;

/** Represent the modifiers that are changed by the range selection. */
type SelectRangeModifiers = Pick<Modifiers, InternalModifier.Disabled | InternalModifier.RangeEnd | InternalModifier.RangeMiddle | InternalModifier.RangeStart>;
/** Represents the value of a {@link SelectRangeContext}. */
interface SelectRangeContextValue {
    /** The range of days that has been selected. */
    selected: DateRange | undefined;
    /** The modifiers for the corresponding selection. */
    modifiers: SelectRangeModifiers;
    /** Event handler to attach to the day button to enable the range select. */
    onDayClick?: DayClickEventHandler;
}
/**
 * The SelectRange context shares details about the selected days when in
 * range selection mode.
 *
 * Access this context from the {@link useSelectRange} hook.
 */
declare const SelectRangeContext: react.Context<SelectRangeContextValue | undefined>;
interface SelectRangeProviderProps {
    initialProps: DayPickerBase;
    children?: ReactNode;
}
/** Provides the values for the {@link SelectRangeProvider}. */
declare function SelectRangeProvider(props: SelectRangeProviderProps): JSX.Element;
/** @private */
interface SelectRangeProviderInternalProps {
    initialProps: DayPickerRangeProps;
    children?: ReactNode;
}
declare function SelectRangeProviderInternal({ initialProps, children }: SelectRangeProviderInternalProps): JSX.Element;
/**
 * Hook to access the {@link SelectRangeContextValue}.
 *
 * This hook is meant to be used inside internal or custom components.
 */
declare function useSelectRange(): SelectRangeContextValue;

/** Represents the value of a {@link SelectSingleContext}. */
interface SelectSingleContextValue {
    /** The day that has been selected. */
    selected: Date | undefined;
    /** Event handler to attach to the day button to enable the single select. */
    onDayClick?: DayClickEventHandler;
}
/**
 * The SelectSingle context shares details about the selected days when in
 * single selection mode.
 *
 * Access this context from the {@link useSelectSingle} hook.
 */
declare const SelectSingleContext: react.Context<SelectSingleContextValue | undefined>;
interface SelectSingleProviderProps {
    initialProps: DayPickerBase;
    children?: ReactNode;
}
/** Provides the values for the {@link SelectSingleProvider}. */
declare function SelectSingleProvider(props: SelectSingleProviderProps): JSX.Element;
/** @private */
interface SelectSingleProviderInternal {
    initialProps: DayPickerSingleProps;
    children?: ReactNode;
}
declare function SelectSingleProviderInternal({ initialProps, children }: SelectSingleProviderInternal): JSX.Element;
/**
 * Hook to access the {@link SelectSingleContextValue}.
 *
 * This hook is meant to be used inside internal or custom components.
 */
declare function useSelectSingle(): SelectSingleContextValue;

/**
 * Returns whether a day matches against at least one of the given Matchers.
 *
 * ```
 * const day = new Date(2022, 5, 19);
 * const matcher1: DateRange = {
 *    from: new Date(2021, 12, 21),
 *    to: new Date(2021, 12, 30)
 * }
 * const matcher2: DateRange = {
 *    from: new Date(2022, 5, 1),
 *    to: new Date(2022, 5, 23)
 * }
 *
 * const isMatch(day, [matcher1, matcher2]); // true, since day is in the matcher1 range.
 * ```
 * */
declare function isMatch(day: Date, matchers: Matcher[]): boolean;

/**
 * Add a day to an existing range.
 *
 * The returned range takes in account the `undefined` values and if the added
 * day is already present in the range.
 */
declare function addToRange(day: Date, range?: DateRange): DateRange | undefined;

export { type ActiveModifiers, Button, type ButtonProps, Caption, CaptionDropdowns, CaptionLabel, type CaptionLabelProps, type CaptionLayout, CaptionNavigation, type CaptionProps, type ClassNames, type CustomComponents, type CustomModifiers, type DateAfter, type DateBefore, type DateFormatter, type DateInterval, type DateRange, Day, type DayClickEventHandler, DayContent, type DayContentProps, type DayFocusEventHandler, type DayKeyboardEventHandler, type DayLabel, type DayModifiers, type DayMouseEventHandler, type DayOfWeek, DayPicker, type DayPickerBase, DayPickerContext, type DayPickerContextValue, type DayPickerDefaultProps, type DayPickerMultipleProps, type DayPickerProps, DayPickerProvider, type DayPickerProviderProps, type DayPickerRangeProps, type DayPickerSingleProps, type DayPointerEventHandler, type DayProps, type DayRender, type DaySelectionMode, type DayTouchEventHandler, Dropdown, type DropdownProps, FocusContext, type FocusContextValue, FocusProvider, type FocusProviderProps, Footer, type FooterProps, type Formatters, Head, HeadRow, IconDropdown, IconLeft, IconRight, type InputDayPickerProps, type InputProps, InternalModifier, type InternalModifiers, type InternalModifiersElement, type Labels, type Matcher, type Modifier, type Modifiers, type ModifiersClassNames, type ModifiersStyles, type MonthChangeEventHandler, Months, type MonthsProps, type NavButtonLabel, NavigationContext, type NavigationContextValue, NavigationProvider, type RootContext, RootProvider, Row, type RowProps, SelectMultipleContext, type SelectMultipleContextValue, type SelectMultipleEventHandler, type SelectMultipleModifiers, SelectMultipleProvider, SelectMultipleProviderInternal, type SelectMultipleProviderInternalProps, type SelectMultipleProviderProps, SelectRangeContext, type SelectRangeContextValue, type SelectRangeEventHandler, type SelectRangeModifiers, SelectRangeProvider, SelectRangeProviderInternal, type SelectRangeProviderInternalProps, type SelectRangeProviderProps, SelectSingleContext, type SelectSingleContextValue, type SelectSingleEventHandler, SelectSingleProvider, SelectSingleProviderInternal, type SelectSingleProviderProps, type StyledComponent, type StyledElement, type Styles, type UseInputOptions, type UseInputValue, WeekNumber, type WeekNumberClickEventHandler, type WeekNumberFormatter, type WeekNumberLabel, type WeekNumberProps, type WeekdayLabel, addToRange, isDateAfterType, isDateBeforeType, isDateInterval, isDateRange, isDayOfWeekType, isDayPickerDefault, isDayPickerMultiple, isDayPickerRange, isDayPickerSingle, isMatch, useActiveModifiers, useDayPicker, useDayRender, useFocusContext, useInput, useNavigation, useSelectMultiple, useSelectRange, useSelectSingle };
