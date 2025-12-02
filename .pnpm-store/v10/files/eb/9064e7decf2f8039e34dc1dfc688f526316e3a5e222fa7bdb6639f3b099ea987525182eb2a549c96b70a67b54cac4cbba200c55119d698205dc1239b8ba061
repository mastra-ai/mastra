'use strict';

var jsxRuntime = require('react/jsx-runtime');
var react = require('react');
var dateFns = require('date-fns');
var locale = require('date-fns/locale');

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol */


var __assign = function() {
    __assign = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};

function __rest(s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
}

function __spreadArray(to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

/** Returns true when the props are of type {@link DayPickerMultipleProps}. */
function isDayPickerMultiple(props) {
    return props.mode === 'multiple';
}

/** Returns true when the props are of type {@link DayPickerRangeProps}. */
function isDayPickerRange(props) {
    return props.mode === 'range';
}

/** Returns true when the props are of type {@link DayPickerSingleProps}. */
function isDayPickerSingle(props) {
    return props.mode === 'single';
}

/**
 * The name of the default CSS classes.
 */
var defaultClassNames = {
    root: 'rdp',
    multiple_months: 'rdp-multiple_months',
    with_weeknumber: 'rdp-with_weeknumber',
    vhidden: 'rdp-vhidden',
    button_reset: 'rdp-button_reset',
    button: 'rdp-button',
    caption: 'rdp-caption',
    caption_start: 'rdp-caption_start',
    caption_end: 'rdp-caption_end',
    caption_between: 'rdp-caption_between',
    caption_label: 'rdp-caption_label',
    caption_dropdowns: 'rdp-caption_dropdowns',
    dropdown: 'rdp-dropdown',
    dropdown_month: 'rdp-dropdown_month',
    dropdown_year: 'rdp-dropdown_year',
    dropdown_icon: 'rdp-dropdown_icon',
    months: 'rdp-months',
    month: 'rdp-month',
    table: 'rdp-table',
    tbody: 'rdp-tbody',
    tfoot: 'rdp-tfoot',
    head: 'rdp-head',
    head_row: 'rdp-head_row',
    head_cell: 'rdp-head_cell',
    nav: 'rdp-nav',
    nav_button: 'rdp-nav_button',
    nav_button_previous: 'rdp-nav_button_previous',
    nav_button_next: 'rdp-nav_button_next',
    nav_icon: 'rdp-nav_icon',
    row: 'rdp-row',
    weeknumber: 'rdp-weeknumber',
    cell: 'rdp-cell',
    day: 'rdp-day',
    day_today: 'rdp-day_today',
    day_outside: 'rdp-day_outside',
    day_selected: 'rdp-day_selected',
    day_disabled: 'rdp-day_disabled',
    day_hidden: 'rdp-day_hidden',
    day_range_start: 'rdp-day_range_start',
    day_range_end: 'rdp-day_range_end',
    day_range_middle: 'rdp-day_range_middle'
};

/**
 * The default formatter for the caption.
 */
function formatCaption(month, options) {
    return dateFns.format(month, 'LLLL y', options);
}

/**
 * The default formatter for the Day button.
 */
function formatDay(day, options) {
    return dateFns.format(day, 'd', options);
}

/**
 * The default formatter for the Month caption.
 */
function formatMonthCaption(month, options) {
    return dateFns.format(month, 'LLLL', options);
}

/**
 * The default formatter for the week number.
 */
function formatWeekNumber(weekNumber) {
    return "".concat(weekNumber);
}

/**
 * The default formatter for the name of the weekday.
 */
function formatWeekdayName(weekday, options) {
    return dateFns.format(weekday, 'cccccc', options);
}

/**
 * The default formatter for the Year caption.
 */
function formatYearCaption(year, options) {
    return dateFns.format(year, 'yyyy', options);
}

var formatters = /*#__PURE__*/Object.freeze({
    __proto__: null,
    formatCaption: formatCaption,
    formatDay: formatDay,
    formatMonthCaption: formatMonthCaption,
    formatWeekNumber: formatWeekNumber,
    formatWeekdayName: formatWeekdayName,
    formatYearCaption: formatYearCaption
});

/**
 * The default ARIA label for the day button.
 */
var labelDay = function (day, activeModifiers, options) {
    return dateFns.format(day, 'do MMMM (EEEE)', options);
};

/**
 * The default ARIA label for the WeekNumber element.
 */
var labelMonthDropdown = function () {
    return 'Month: ';
};

/**
 * The default ARIA label for next month button in navigation
 */
var labelNext = function () {
    return 'Go to next month';
};

/**
 * The default ARIA label for previous month button in navigation
 */
var labelPrevious = function () {
    return 'Go to previous month';
};

/**
 * The default ARIA label for the Weekday element.
 */
var labelWeekday = function (day, options) {
    return dateFns.format(day, 'cccc', options);
};

/**
 * The default ARIA label for the WeekNumber element.
 */
var labelWeekNumber = function (n) {
    return "Week n. ".concat(n);
};

/**
 * The default ARIA label for the WeekNumber element.
 */
var labelYearDropdown = function () {
    return 'Year: ';
};

var labels = /*#__PURE__*/Object.freeze({
    __proto__: null,
    labelDay: labelDay,
    labelMonthDropdown: labelMonthDropdown,
    labelNext: labelNext,
    labelPrevious: labelPrevious,
    labelWeekNumber: labelWeekNumber,
    labelWeekday: labelWeekday,
    labelYearDropdown: labelYearDropdown
});

/**
 * Returns the default values to use in the DayPickerContext, in case they are
 * not passed down with the DayPicker initial props.
 */
function getDefaultContextValues() {
    var captionLayout = 'buttons';
    var classNames = defaultClassNames;
    var locale$1 = locale.enUS;
    var modifiersClassNames = {};
    var modifiers = {};
    var numberOfMonths = 1;
    var styles = {};
    var today = new Date();
    return {
        captionLayout: captionLayout,
        classNames: classNames,
        formatters: formatters,
        labels: labels,
        locale: locale$1,
        modifiersClassNames: modifiersClassNames,
        modifiers: modifiers,
        numberOfMonths: numberOfMonths,
        styles: styles,
        today: today,
        mode: 'default'
    };
}

/** Return the `fromDate` and `toDate` prop values values parsing the DayPicker props. */
function parseFromToProps(props) {
    var fromYear = props.fromYear, toYear = props.toYear, fromMonth = props.fromMonth, toMonth = props.toMonth;
    var fromDate = props.fromDate, toDate = props.toDate;
    if (fromMonth) {
        fromDate = dateFns.startOfMonth(fromMonth);
    }
    else if (fromYear) {
        fromDate = new Date(fromYear, 0, 1);
    }
    if (toMonth) {
        toDate = dateFns.endOfMonth(toMonth);
    }
    else if (toYear) {
        toDate = new Date(toYear, 11, 31);
    }
    return {
        fromDate: fromDate ? dateFns.startOfDay(fromDate) : undefined,
        toDate: toDate ? dateFns.startOfDay(toDate) : undefined
    };
}

/**
 * The DayPicker context shares the props passed to DayPicker within internal
 * and custom components. It is used to set the default values and perform
 * one-time calculations required to render the days.
 *
 * Access to this context from the {@link useDayPicker} hook.
 */
var DayPickerContext = react.createContext(undefined);
/**
 * The provider for the {@link DayPickerContext}, assigning the defaults from the
 * initial DayPicker props.
 */
function DayPickerProvider(props) {
    var _a;
    var initialProps = props.initialProps;
    var defaultContextValues = getDefaultContextValues();
    var _b = parseFromToProps(initialProps), fromDate = _b.fromDate, toDate = _b.toDate;
    var captionLayout = (_a = initialProps.captionLayout) !== null && _a !== void 0 ? _a : defaultContextValues.captionLayout;
    if (captionLayout !== 'buttons' && (!fromDate || !toDate)) {
        // When no from/to dates are set, the caption is always buttons
        captionLayout = 'buttons';
    }
    var onSelect;
    if (isDayPickerSingle(initialProps) ||
        isDayPickerMultiple(initialProps) ||
        isDayPickerRange(initialProps)) {
        onSelect = initialProps.onSelect;
    }
    var value = __assign(__assign(__assign({}, defaultContextValues), initialProps), { captionLayout: captionLayout, classNames: __assign(__assign({}, defaultContextValues.classNames), initialProps.classNames), components: __assign({}, initialProps.components), formatters: __assign(__assign({}, defaultContextValues.formatters), initialProps.formatters), fromDate: fromDate, labels: __assign(__assign({}, defaultContextValues.labels), initialProps.labels), mode: initialProps.mode || defaultContextValues.mode, modifiers: __assign(__assign({}, defaultContextValues.modifiers), initialProps.modifiers), modifiersClassNames: __assign(__assign({}, defaultContextValues.modifiersClassNames), initialProps.modifiersClassNames), onSelect: onSelect, styles: __assign(__assign({}, defaultContextValues.styles), initialProps.styles), toDate: toDate });
    return (jsxRuntime.jsx(DayPickerContext.Provider, { value: value, children: props.children }));
}
/**
 * Hook to access the {@link DayPickerContextValue}.
 *
 * Use the DayPicker context to access to the props passed to DayPicker inside
 * internal or custom components.
 */
function useDayPicker() {
    var context = react.useContext(DayPickerContext);
    if (!context) {
        throw new Error("useDayPicker must be used within a DayPickerProvider.");
    }
    return context;
}

/** Render the caption for the displayed month. This component is used when `captionLayout="buttons"`. */
function CaptionLabel(props) {
    var _a = useDayPicker(), locale = _a.locale, classNames = _a.classNames, styles = _a.styles, formatCaption = _a.formatters.formatCaption;
    return (jsxRuntime.jsx("div", { className: classNames.caption_label, style: styles.caption_label, "aria-live": "polite", role: "presentation", id: props.id, children: formatCaption(props.displayMonth, { locale: locale }) }));
}

/**
 * Render the icon in the styled drop-down.
 */
function IconDropdown(props) {
    return (jsxRuntime.jsx("svg", __assign({ width: "8px", height: "8px", viewBox: "0 0 120 120", "data-testid": "iconDropdown" }, props, { children: jsxRuntime.jsx("path", { d: "M4.22182541,48.2218254 C8.44222828,44.0014225 15.2388494,43.9273804 19.5496459,47.9996989 L19.7781746,48.2218254 L60,88.443 L100.221825,48.2218254 C104.442228,44.0014225 111.238849,43.9273804 115.549646,47.9996989 L115.778175,48.2218254 C119.998577,52.4422283 120.07262,59.2388494 116.000301,63.5496459 L115.778175,63.7781746 L67.7781746,111.778175 C63.5577717,115.998577 56.7611506,116.07262 52.4503541,112.000301 L52.2218254,111.778175 L4.22182541,63.7781746 C-0.0739418023,59.4824074 -0.0739418023,52.5175926 4.22182541,48.2218254 Z", fill: "currentColor", fillRule: "nonzero" }) })));
}

/**
 * Render a styled select component – displaying a caption and a custom
 * drop-down icon.
 */
function Dropdown(props) {
    var _a, _b;
    var onChange = props.onChange, value = props.value, children = props.children, caption = props.caption, className = props.className, style = props.style;
    var dayPicker = useDayPicker();
    var IconDropdownComponent = (_b = (_a = dayPicker.components) === null || _a === void 0 ? void 0 : _a.IconDropdown) !== null && _b !== void 0 ? _b : IconDropdown;
    return (jsxRuntime.jsxs("div", { className: className, style: style, children: [jsxRuntime.jsx("span", { className: dayPicker.classNames.vhidden, children: props['aria-label'] }), jsxRuntime.jsx("select", { name: props.name, "aria-label": props['aria-label'], className: dayPicker.classNames.dropdown, style: dayPicker.styles.dropdown, value: value, onChange: onChange, children: children }), jsxRuntime.jsxs("div", { className: dayPicker.classNames.caption_label, style: dayPicker.styles.caption_label, "aria-hidden": "true", children: [caption, jsxRuntime.jsx(IconDropdownComponent, { className: dayPicker.classNames.dropdown_icon, style: dayPicker.styles.dropdown_icon })] })] }));
}

/** Render the dropdown to navigate between months. */
function MonthsDropdown(props) {
    var _a;
    var _b = useDayPicker(), fromDate = _b.fromDate, toDate = _b.toDate, styles = _b.styles, locale = _b.locale, formatMonthCaption = _b.formatters.formatMonthCaption, classNames = _b.classNames, components = _b.components, labelMonthDropdown = _b.labels.labelMonthDropdown;
    // Dropdown should appear only when both from/toDate is set
    if (!fromDate)
        return jsxRuntime.jsx(jsxRuntime.Fragment, {});
    if (!toDate)
        return jsxRuntime.jsx(jsxRuntime.Fragment, {});
    var dropdownMonths = [];
    if (dateFns.isSameYear(fromDate, toDate)) {
        // only display the months included in the range
        var date = dateFns.startOfMonth(fromDate);
        for (var month = fromDate.getMonth(); month <= toDate.getMonth(); month++) {
            dropdownMonths.push(dateFns.setMonth(date, month));
        }
    }
    else {
        // display all the 12 months
        var date = dateFns.startOfMonth(new Date()); // Any date should be OK, as we just need the year
        for (var month = 0; month <= 11; month++) {
            dropdownMonths.push(dateFns.setMonth(date, month));
        }
    }
    var handleChange = function (e) {
        var selectedMonth = Number(e.target.value);
        var newMonth = dateFns.setMonth(dateFns.startOfMonth(props.displayMonth), selectedMonth);
        props.onChange(newMonth);
    };
    var DropdownComponent = (_a = components === null || components === void 0 ? void 0 : components.Dropdown) !== null && _a !== void 0 ? _a : Dropdown;
    return (jsxRuntime.jsx(DropdownComponent, { name: "months", "aria-label": labelMonthDropdown(), className: classNames.dropdown_month, style: styles.dropdown_month, onChange: handleChange, value: props.displayMonth.getMonth(), caption: formatMonthCaption(props.displayMonth, { locale: locale }), children: dropdownMonths.map(function (m) { return (jsxRuntime.jsx("option", { value: m.getMonth(), children: formatMonthCaption(m, { locale: locale }) }, m.getMonth())); }) }));
}

/**
 * Render a dropdown to change the year. Take in account the `nav.fromDate` and
 * `toDate` from context.
 */
function YearsDropdown(props) {
    var _a;
    var displayMonth = props.displayMonth;
    var _b = useDayPicker(), fromDate = _b.fromDate, toDate = _b.toDate, locale = _b.locale, styles = _b.styles, classNames = _b.classNames, components = _b.components, formatYearCaption = _b.formatters.formatYearCaption, labelYearDropdown = _b.labels.labelYearDropdown;
    var years = [];
    // Dropdown should appear only when both from/toDate is set
    if (!fromDate)
        return jsxRuntime.jsx(jsxRuntime.Fragment, {});
    if (!toDate)
        return jsxRuntime.jsx(jsxRuntime.Fragment, {});
    var fromYear = fromDate.getFullYear();
    var toYear = toDate.getFullYear();
    for (var year = fromYear; year <= toYear; year++) {
        years.push(dateFns.setYear(dateFns.startOfYear(new Date()), year));
    }
    var handleChange = function (e) {
        var newMonth = dateFns.setYear(dateFns.startOfMonth(displayMonth), Number(e.target.value));
        props.onChange(newMonth);
    };
    var DropdownComponent = (_a = components === null || components === void 0 ? void 0 : components.Dropdown) !== null && _a !== void 0 ? _a : Dropdown;
    return (jsxRuntime.jsx(DropdownComponent, { name: "years", "aria-label": labelYearDropdown(), className: classNames.dropdown_year, style: styles.dropdown_year, onChange: handleChange, value: displayMonth.getFullYear(), caption: formatYearCaption(displayMonth, { locale: locale }), children: years.map(function (year) { return (jsxRuntime.jsx("option", { value: year.getFullYear(), children: formatYearCaption(year, { locale: locale }) }, year.getFullYear())); }) }));
}

/**
 * Helper hook for using controlled/uncontrolled values from a component props.
 *
 * When the value is not controlled, pass `undefined` as `controlledValue` and
 * use the returned setter to update it.
 *
 * When the value is controlled, pass the controlled value as second
 * argument, which will be always returned as `value`.
 */
function useControlledValue(defaultValue, controlledValue) {
    var _a = react.useState(defaultValue), uncontrolledValue = _a[0], setValue = _a[1];
    var value = controlledValue === undefined ? uncontrolledValue : controlledValue;
    return [value, setValue];
}

/** Return the initial month according to the given options. */
function getInitialMonth(context) {
    var month = context.month, defaultMonth = context.defaultMonth, today = context.today;
    var initialMonth = month || defaultMonth || today || new Date();
    var toDate = context.toDate, fromDate = context.fromDate, _a = context.numberOfMonths, numberOfMonths = _a === void 0 ? 1 : _a;
    // Fix the initialMonth if is after the to-date
    if (toDate && dateFns.differenceInCalendarMonths(toDate, initialMonth) < 0) {
        var offset = -1 * (numberOfMonths - 1);
        initialMonth = dateFns.addMonths(toDate, offset);
    }
    // Fix the initialMonth if is before the from-date
    if (fromDate && dateFns.differenceInCalendarMonths(initialMonth, fromDate) < 0) {
        initialMonth = fromDate;
    }
    return dateFns.startOfMonth(initialMonth);
}

/** Controls the navigation state. */
function useNavigationState() {
    var context = useDayPicker();
    var initialMonth = getInitialMonth(context);
    var _a = useControlledValue(initialMonth, context.month), month = _a[0], setMonth = _a[1];
    var goToMonth = function (date) {
        var _a;
        if (context.disableNavigation)
            return;
        var month = dateFns.startOfMonth(date);
        setMonth(month);
        (_a = context.onMonthChange) === null || _a === void 0 ? void 0 : _a.call(context, month);
    };
    return [month, goToMonth];
}

/**
 * Return the months to display in the component according to the number of
 * months and the from/to date.
 */
function getDisplayMonths(month, _a) {
    var reverseMonths = _a.reverseMonths, numberOfMonths = _a.numberOfMonths;
    var start = dateFns.startOfMonth(month);
    var end = dateFns.startOfMonth(dateFns.addMonths(start, numberOfMonths));
    var monthsDiff = dateFns.differenceInCalendarMonths(end, start);
    var months = [];
    for (var i = 0; i < monthsDiff; i++) {
        var nextMonth = dateFns.addMonths(start, i);
        months.push(nextMonth);
    }
    if (reverseMonths)
        months = months.reverse();
    return months;
}

/**
 * Returns the next month the user can navigate to according to the given
 * options.
 *
 * Please note that the next month is not always the next calendar month:
 *
 * - if after the `toDate` range, is undefined;
 * - if the navigation is paged, is the number of months displayed ahead.
 *
 */
function getNextMonth(startingMonth, options) {
    if (options.disableNavigation) {
        return undefined;
    }
    var toDate = options.toDate, pagedNavigation = options.pagedNavigation, _a = options.numberOfMonths, numberOfMonths = _a === void 0 ? 1 : _a;
    var offset = pagedNavigation ? numberOfMonths : 1;
    var month = dateFns.startOfMonth(startingMonth);
    if (!toDate) {
        return dateFns.addMonths(month, offset);
    }
    var monthsDiff = dateFns.differenceInCalendarMonths(toDate, startingMonth);
    if (monthsDiff < numberOfMonths) {
        return undefined;
    }
    // Jump forward as the number of months when paged navigation
    return dateFns.addMonths(month, offset);
}

/**
 * Returns the next previous the user can navigate to, according to the given
 * options.
 *
 * Please note that the previous month is not always the previous calendar
 * month:
 *
 * - if before the `fromDate` date, is `undefined`;
 * - if the navigation is paged, is the number of months displayed before.
 *
 */
function getPreviousMonth(startingMonth, options) {
    if (options.disableNavigation) {
        return undefined;
    }
    var fromDate = options.fromDate, pagedNavigation = options.pagedNavigation, _a = options.numberOfMonths, numberOfMonths = _a === void 0 ? 1 : _a;
    var offset = pagedNavigation ? numberOfMonths : 1;
    var month = dateFns.startOfMonth(startingMonth);
    if (!fromDate) {
        return dateFns.addMonths(month, -offset);
    }
    var monthsDiff = dateFns.differenceInCalendarMonths(month, fromDate);
    if (monthsDiff <= 0) {
        return undefined;
    }
    // Jump back as the number of months when paged navigation
    return dateFns.addMonths(month, -offset);
}

/**
 * The Navigation context shares details and methods to navigate the months in DayPicker.
 * Access this context from the {@link useNavigation} hook.
 */
var NavigationContext = react.createContext(undefined);
/** Provides the values for the {@link NavigationContext}. */
function NavigationProvider(props) {
    var dayPicker = useDayPicker();
    var _a = useNavigationState(), currentMonth = _a[0], goToMonth = _a[1];
    var displayMonths = getDisplayMonths(currentMonth, dayPicker);
    var nextMonth = getNextMonth(currentMonth, dayPicker);
    var previousMonth = getPreviousMonth(currentMonth, dayPicker);
    var isDateDisplayed = function (date) {
        return displayMonths.some(function (displayMonth) {
            return dateFns.isSameMonth(date, displayMonth);
        });
    };
    var goToDate = function (date, refDate) {
        if (isDateDisplayed(date)) {
            return;
        }
        if (refDate && dateFns.isBefore(date, refDate)) {
            goToMonth(dateFns.addMonths(date, 1 + dayPicker.numberOfMonths * -1));
        }
        else {
            goToMonth(date);
        }
    };
    var value = {
        currentMonth: currentMonth,
        displayMonths: displayMonths,
        goToMonth: goToMonth,
        goToDate: goToDate,
        previousMonth: previousMonth,
        nextMonth: nextMonth,
        isDateDisplayed: isDateDisplayed
    };
    return (jsxRuntime.jsx(NavigationContext.Provider, { value: value, children: props.children }));
}
/**
 * Hook to access the {@link NavigationContextValue}. Use this hook to navigate
 * between months or years in DayPicker.
 *
 * This hook is meant to be used inside internal or custom components.
 */
function useNavigation() {
    var context = react.useContext(NavigationContext);
    if (!context) {
        throw new Error('useNavigation must be used within a NavigationProvider');
    }
    return context;
}

/**
 * Render a caption with the dropdowns to navigate between months and years.
 */
function CaptionDropdowns(props) {
    var _a;
    var _b = useDayPicker(), classNames = _b.classNames, styles = _b.styles, components = _b.components;
    var goToMonth = useNavigation().goToMonth;
    var handleMonthChange = function (newMonth) {
        goToMonth(dateFns.addMonths(newMonth, props.displayIndex ? -props.displayIndex : 0));
    };
    var CaptionLabelComponent = (_a = components === null || components === void 0 ? void 0 : components.CaptionLabel) !== null && _a !== void 0 ? _a : CaptionLabel;
    var captionLabel = (jsxRuntime.jsx(CaptionLabelComponent, { id: props.id, displayMonth: props.displayMonth }));
    return (jsxRuntime.jsxs("div", { className: classNames.caption_dropdowns, style: styles.caption_dropdowns, children: [jsxRuntime.jsx("div", { className: classNames.vhidden, children: captionLabel }), jsxRuntime.jsx(MonthsDropdown, { onChange: handleMonthChange, displayMonth: props.displayMonth }), jsxRuntime.jsx(YearsDropdown, { onChange: handleMonthChange, displayMonth: props.displayMonth })] }));
}

/**
 * Render the "previous month" button in the navigation.
 */
function IconLeft(props) {
    return (jsxRuntime.jsx("svg", __assign({ width: "16px", height: "16px", viewBox: "0 0 120 120" }, props, { children: jsxRuntime.jsx("path", { d: "M69.490332,3.34314575 C72.6145263,0.218951416 77.6798462,0.218951416 80.8040405,3.34314575 C83.8617626,6.40086786 83.9268205,11.3179931 80.9992143,14.4548388 L80.8040405,14.6568542 L35.461,60 L80.8040405,105.343146 C83.8617626,108.400868 83.9268205,113.317993 80.9992143,116.454839 L80.8040405,116.656854 C77.7463184,119.714576 72.8291931,119.779634 69.6923475,116.852028 L69.490332,116.656854 L18.490332,65.6568542 C15.4326099,62.5991321 15.367552,57.6820069 18.2951583,54.5451612 L18.490332,54.3431458 L69.490332,3.34314575 Z", fill: "currentColor", fillRule: "nonzero" }) })));
}

/**
 * Render the "next month" button in the navigation.
 */
function IconRight(props) {
    return (jsxRuntime.jsx("svg", __assign({ width: "16px", height: "16px", viewBox: "0 0 120 120" }, props, { children: jsxRuntime.jsx("path", { d: "M49.8040405,3.34314575 C46.6798462,0.218951416 41.6145263,0.218951416 38.490332,3.34314575 C35.4326099,6.40086786 35.367552,11.3179931 38.2951583,14.4548388 L38.490332,14.6568542 L83.8333725,60 L38.490332,105.343146 C35.4326099,108.400868 35.367552,113.317993 38.2951583,116.454839 L38.490332,116.656854 C41.5480541,119.714576 46.4651794,119.779634 49.602025,116.852028 L49.8040405,116.656854 L100.804041,65.6568542 C103.861763,62.5991321 103.926821,57.6820069 100.999214,54.5451612 L100.804041,54.3431458 L49.8040405,3.34314575 Z", fill: "currentColor" }) })));
}

/** Render a button HTML element applying the reset class name. */
var Button = react.forwardRef(function (props, ref) {
    var _a = useDayPicker(), classNames = _a.classNames, styles = _a.styles;
    var classNamesArr = [classNames.button_reset, classNames.button];
    if (props.className) {
        classNamesArr.push(props.className);
    }
    var className = classNamesArr.join(' ');
    var style = __assign(__assign({}, styles.button_reset), styles.button);
    if (props.style) {
        Object.assign(style, props.style);
    }
    return (jsxRuntime.jsx("button", __assign({}, props, { ref: ref, type: "button", className: className, style: style })));
});

/** A component rendering the navigation buttons or the drop-downs. */
function Navigation(props) {
    var _a, _b;
    var _c = useDayPicker(), dir = _c.dir, locale = _c.locale, classNames = _c.classNames, styles = _c.styles, _d = _c.labels, labelPrevious = _d.labelPrevious, labelNext = _d.labelNext, components = _c.components;
    if (!props.nextMonth && !props.previousMonth) {
        return jsxRuntime.jsx(jsxRuntime.Fragment, {});
    }
    var previousLabel = labelPrevious(props.previousMonth, { locale: locale });
    var previousClassName = [
        classNames.nav_button,
        classNames.nav_button_previous
    ].join(' ');
    var nextLabel = labelNext(props.nextMonth, { locale: locale });
    var nextClassName = [
        classNames.nav_button,
        classNames.nav_button_next
    ].join(' ');
    var IconRightComponent = (_a = components === null || components === void 0 ? void 0 : components.IconRight) !== null && _a !== void 0 ? _a : IconRight;
    var IconLeftComponent = (_b = components === null || components === void 0 ? void 0 : components.IconLeft) !== null && _b !== void 0 ? _b : IconLeft;
    return (jsxRuntime.jsxs("div", { className: classNames.nav, style: styles.nav, children: [!props.hidePrevious && (jsxRuntime.jsx(Button, { name: "previous-month", "aria-label": previousLabel, className: previousClassName, style: styles.nav_button_previous, disabled: !props.previousMonth, onClick: props.onPreviousClick, children: dir === 'rtl' ? (jsxRuntime.jsx(IconRightComponent, { className: classNames.nav_icon, style: styles.nav_icon })) : (jsxRuntime.jsx(IconLeftComponent, { className: classNames.nav_icon, style: styles.nav_icon })) })), !props.hideNext && (jsxRuntime.jsx(Button, { name: "next-month", "aria-label": nextLabel, className: nextClassName, style: styles.nav_button_next, disabled: !props.nextMonth, onClick: props.onNextClick, children: dir === 'rtl' ? (jsxRuntime.jsx(IconLeftComponent, { className: classNames.nav_icon, style: styles.nav_icon })) : (jsxRuntime.jsx(IconRightComponent, { className: classNames.nav_icon, style: styles.nav_icon })) }))] }));
}

/**
 * Render a caption with a button-based navigation.
 */
function CaptionNavigation(props) {
    var numberOfMonths = useDayPicker().numberOfMonths;
    var _a = useNavigation(), previousMonth = _a.previousMonth, nextMonth = _a.nextMonth, goToMonth = _a.goToMonth, displayMonths = _a.displayMonths;
    var displayIndex = displayMonths.findIndex(function (month) {
        return dateFns.isSameMonth(props.displayMonth, month);
    });
    var isFirst = displayIndex === 0;
    var isLast = displayIndex === displayMonths.length - 1;
    var hideNext = numberOfMonths > 1 && (isFirst || !isLast);
    var hidePrevious = numberOfMonths > 1 && (isLast || !isFirst);
    var handlePreviousClick = function () {
        if (!previousMonth)
            return;
        goToMonth(previousMonth);
    };
    var handleNextClick = function () {
        if (!nextMonth)
            return;
        goToMonth(nextMonth);
    };
    return (jsxRuntime.jsx(Navigation, { displayMonth: props.displayMonth, hideNext: hideNext, hidePrevious: hidePrevious, nextMonth: nextMonth, previousMonth: previousMonth, onPreviousClick: handlePreviousClick, onNextClick: handleNextClick }));
}

/**
 * Render the caption of a month. The caption has a different layout when
 * setting the {@link DayPickerBase.captionLayout} prop.
 */
function Caption(props) {
    var _a;
    var _b = useDayPicker(), classNames = _b.classNames, disableNavigation = _b.disableNavigation, styles = _b.styles, captionLayout = _b.captionLayout, components = _b.components;
    var CaptionLabelComponent = (_a = components === null || components === void 0 ? void 0 : components.CaptionLabel) !== null && _a !== void 0 ? _a : CaptionLabel;
    var caption;
    if (disableNavigation) {
        caption = (jsxRuntime.jsx(CaptionLabelComponent, { id: props.id, displayMonth: props.displayMonth }));
    }
    else if (captionLayout === 'dropdown') {
        caption = (jsxRuntime.jsx(CaptionDropdowns, { displayMonth: props.displayMonth, id: props.id }));
    }
    else if (captionLayout === 'dropdown-buttons') {
        caption = (jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [jsxRuntime.jsx(CaptionDropdowns, { displayMonth: props.displayMonth, displayIndex: props.displayIndex, id: props.id }), jsxRuntime.jsx(CaptionNavigation, { displayMonth: props.displayMonth, displayIndex: props.displayIndex, id: props.id })] }));
    }
    else {
        caption = (jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [jsxRuntime.jsx(CaptionLabelComponent, { id: props.id, displayMonth: props.displayMonth, displayIndex: props.displayIndex }), jsxRuntime.jsx(CaptionNavigation, { displayMonth: props.displayMonth, id: props.id })] }));
    }
    return (jsxRuntime.jsx("div", { className: classNames.caption, style: styles.caption, children: caption }));
}

/** Render the Footer component (empty as default).*/
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Footer(props) {
    var _a = useDayPicker(), footer = _a.footer, styles = _a.styles, tfoot = _a.classNames.tfoot;
    if (!footer)
        return jsxRuntime.jsx(jsxRuntime.Fragment, {});
    return (jsxRuntime.jsx("tfoot", { className: tfoot, style: styles.tfoot, children: jsxRuntime.jsx("tr", { children: jsxRuntime.jsx("td", { colSpan: 8, children: footer }) }) }));
}

/**
 * Generate a series of 7 days, starting from the week, to use for formatting
 * the weekday names (Monday, Tuesday, etc.).
 */
function getWeekdays(locale, 
/** The index of the first day of the week (0 - Sunday). */
weekStartsOn, 
/** Use ISOWeek instead of locale/ */
ISOWeek) {
    var start = ISOWeek
        ? dateFns.startOfISOWeek(new Date())
        : dateFns.startOfWeek(new Date(), { locale: locale, weekStartsOn: weekStartsOn });
    var days = [];
    for (var i = 0; i < 7; i++) {
        var day = dateFns.addDays(start, i);
        days.push(day);
    }
    return days;
}

/**
 * Render the HeadRow component - i.e. the table head row with the weekday names.
 */
function HeadRow() {
    var _a = useDayPicker(), classNames = _a.classNames, styles = _a.styles, showWeekNumber = _a.showWeekNumber, locale = _a.locale, weekStartsOn = _a.weekStartsOn, ISOWeek = _a.ISOWeek, formatWeekdayName = _a.formatters.formatWeekdayName, labelWeekday = _a.labels.labelWeekday;
    var weekdays = getWeekdays(locale, weekStartsOn, ISOWeek);
    return (jsxRuntime.jsxs("tr", { style: styles.head_row, className: classNames.head_row, children: [showWeekNumber && (jsxRuntime.jsx("td", { style: styles.head_cell, className: classNames.head_cell })), weekdays.map(function (weekday, i) { return (jsxRuntime.jsx("th", { scope: "col", className: classNames.head_cell, style: styles.head_cell, "aria-label": labelWeekday(weekday, { locale: locale }), children: formatWeekdayName(weekday, { locale: locale }) }, i)); })] }));
}

/** Render the table head. */
function Head() {
    var _a;
    var _b = useDayPicker(), classNames = _b.classNames, styles = _b.styles, components = _b.components;
    var HeadRowComponent = (_a = components === null || components === void 0 ? void 0 : components.HeadRow) !== null && _a !== void 0 ? _a : HeadRow;
    return (jsxRuntime.jsx("thead", { style: styles.head, className: classNames.head, children: jsxRuntime.jsx(HeadRowComponent, {}) }));
}

/** Render the content of the day cell. */
function DayContent(props) {
    var _a = useDayPicker(), locale = _a.locale, formatDay = _a.formatters.formatDay;
    return jsxRuntime.jsx(jsxRuntime.Fragment, { children: formatDay(props.date, { locale: locale }) });
}

/**
 * The SelectMultiple context shares details about the selected days when in
 * multiple selection mode.
 *
 * Access this context from the {@link useSelectMultiple} hook.
 */
var SelectMultipleContext = react.createContext(undefined);
/** Provides the values for the {@link SelectMultipleContext}. */
function SelectMultipleProvider(props) {
    if (!isDayPickerMultiple(props.initialProps)) {
        var emptyContextValue = {
            selected: undefined,
            modifiers: {
                disabled: []
            }
        };
        return (jsxRuntime.jsx(SelectMultipleContext.Provider, { value: emptyContextValue, children: props.children }));
    }
    return (jsxRuntime.jsx(SelectMultipleProviderInternal, { initialProps: props.initialProps, children: props.children }));
}
function SelectMultipleProviderInternal(_a) {
    var initialProps = _a.initialProps, children = _a.children;
    var selected = initialProps.selected, min = initialProps.min, max = initialProps.max;
    var onDayClick = function (day, activeModifiers, e) {
        var _a, _b;
        (_a = initialProps.onDayClick) === null || _a === void 0 ? void 0 : _a.call(initialProps, day, activeModifiers, e);
        var isMinSelected = Boolean(activeModifiers.selected && min && (selected === null || selected === void 0 ? void 0 : selected.length) === min);
        if (isMinSelected) {
            return;
        }
        var isMaxSelected = Boolean(!activeModifiers.selected && max && (selected === null || selected === void 0 ? void 0 : selected.length) === max);
        if (isMaxSelected) {
            return;
        }
        var selectedDays = selected ? __spreadArray([], selected, true) : [];
        if (activeModifiers.selected) {
            var index = selectedDays.findIndex(function (selectedDay) {
                return dateFns.isSameDay(day, selectedDay);
            });
            selectedDays.splice(index, 1);
        }
        else {
            selectedDays.push(day);
        }
        (_b = initialProps.onSelect) === null || _b === void 0 ? void 0 : _b.call(initialProps, selectedDays, day, activeModifiers, e);
    };
    var modifiers = {
        disabled: []
    };
    if (selected) {
        modifiers.disabled.push(function (day) {
            var isMaxSelected = max && selected.length > max - 1;
            var isSelected = selected.some(function (selectedDay) {
                return dateFns.isSameDay(selectedDay, day);
            });
            return Boolean(isMaxSelected && !isSelected);
        });
    }
    var contextValue = {
        selected: selected,
        onDayClick: onDayClick,
        modifiers: modifiers
    };
    return (jsxRuntime.jsx(SelectMultipleContext.Provider, { value: contextValue, children: children }));
}
/**
 * Hook to access the {@link SelectMultipleContextValue}.
 *
 * This hook is meant to be used inside internal or custom components.
 */
function useSelectMultiple() {
    var context = react.useContext(SelectMultipleContext);
    if (!context) {
        throw new Error('useSelectMultiple must be used within a SelectMultipleProvider');
    }
    return context;
}

/**
 * Add a day to an existing range.
 *
 * The returned range takes in account the `undefined` values and if the added
 * day is already present in the range.
 */
function addToRange(day, range) {
    var _a = range || {}, from = _a.from, to = _a.to;
    if (from && to) {
        if (dateFns.isSameDay(to, day) && dateFns.isSameDay(from, day)) {
            return undefined;
        }
        if (dateFns.isSameDay(to, day)) {
            return { from: to, to: undefined };
        }
        if (dateFns.isSameDay(from, day)) {
            return undefined;
        }
        if (dateFns.isAfter(from, day)) {
            return { from: day, to: to };
        }
        return { from: from, to: day };
    }
    if (to) {
        if (dateFns.isAfter(day, to)) {
            return { from: to, to: day };
        }
        return { from: day, to: to };
    }
    if (from) {
        if (dateFns.isBefore(day, from)) {
            return { from: day, to: from };
        }
        return { from: from, to: day };
    }
    return { from: day, to: undefined };
}

/**
 * The SelectRange context shares details about the selected days when in
 * range selection mode.
 *
 * Access this context from the {@link useSelectRange} hook.
 */
var SelectRangeContext = react.createContext(undefined);
/** Provides the values for the {@link SelectRangeProvider}. */
function SelectRangeProvider(props) {
    if (!isDayPickerRange(props.initialProps)) {
        var emptyContextValue = {
            selected: undefined,
            modifiers: {
                range_start: [],
                range_end: [],
                range_middle: [],
                disabled: []
            }
        };
        return (jsxRuntime.jsx(SelectRangeContext.Provider, { value: emptyContextValue, children: props.children }));
    }
    return (jsxRuntime.jsx(SelectRangeProviderInternal, { initialProps: props.initialProps, children: props.children }));
}
function SelectRangeProviderInternal(_a) {
    var initialProps = _a.initialProps, children = _a.children;
    var selected = initialProps.selected;
    var _b = selected || {}, selectedFrom = _b.from, selectedTo = _b.to;
    var min = initialProps.min;
    var max = initialProps.max;
    var onDayClick = function (day, activeModifiers, e) {
        var _a, _b;
        (_a = initialProps.onDayClick) === null || _a === void 0 ? void 0 : _a.call(initialProps, day, activeModifiers, e);
        var newRange = addToRange(day, selected);
        (_b = initialProps.onSelect) === null || _b === void 0 ? void 0 : _b.call(initialProps, newRange, day, activeModifiers, e);
    };
    var modifiers = {
        range_start: [],
        range_end: [],
        range_middle: [],
        disabled: []
    };
    if (selectedFrom) {
        modifiers.range_start = [selectedFrom];
        if (!selectedTo) {
            modifiers.range_end = [selectedFrom];
        }
        else {
            modifiers.range_end = [selectedTo];
            if (!dateFns.isSameDay(selectedFrom, selectedTo)) {
                modifiers.range_middle = [
                    {
                        after: selectedFrom,
                        before: selectedTo
                    }
                ];
            }
        }
    }
    else if (selectedTo) {
        modifiers.range_start = [selectedTo];
        modifiers.range_end = [selectedTo];
    }
    if (min) {
        if (selectedFrom && !selectedTo) {
            modifiers.disabled.push({
                after: dateFns.subDays(selectedFrom, min - 1),
                before: dateFns.addDays(selectedFrom, min - 1)
            });
        }
        if (selectedFrom && selectedTo) {
            modifiers.disabled.push({
                after: selectedFrom,
                before: dateFns.addDays(selectedFrom, min - 1)
            });
        }
        if (!selectedFrom && selectedTo) {
            modifiers.disabled.push({
                after: dateFns.subDays(selectedTo, min - 1),
                before: dateFns.addDays(selectedTo, min - 1)
            });
        }
    }
    if (max) {
        if (selectedFrom && !selectedTo) {
            modifiers.disabled.push({
                before: dateFns.addDays(selectedFrom, -max + 1)
            });
            modifiers.disabled.push({
                after: dateFns.addDays(selectedFrom, max - 1)
            });
        }
        if (selectedFrom && selectedTo) {
            var selectedCount = dateFns.differenceInCalendarDays(selectedTo, selectedFrom) + 1;
            var offset = max - selectedCount;
            modifiers.disabled.push({
                before: dateFns.subDays(selectedFrom, offset)
            });
            modifiers.disabled.push({
                after: dateFns.addDays(selectedTo, offset)
            });
        }
        if (!selectedFrom && selectedTo) {
            modifiers.disabled.push({
                before: dateFns.addDays(selectedTo, -max + 1)
            });
            modifiers.disabled.push({
                after: dateFns.addDays(selectedTo, max - 1)
            });
        }
    }
    return (jsxRuntime.jsx(SelectRangeContext.Provider, { value: { selected: selected, onDayClick: onDayClick, modifiers: modifiers }, children: children }));
}
/**
 * Hook to access the {@link SelectRangeContextValue}.
 *
 * This hook is meant to be used inside internal or custom components.
 */
function useSelectRange() {
    var context = react.useContext(SelectRangeContext);
    if (!context) {
        throw new Error('useSelectRange must be used within a SelectRangeProvider');
    }
    return context;
}

/** Normalize to array a matcher input. */
function matcherToArray(matcher) {
    if (Array.isArray(matcher)) {
        return __spreadArray([], matcher, true);
    }
    else if (matcher !== undefined) {
        return [matcher];
    }
    else {
        return [];
    }
}

/** Create CustomModifiers from dayModifiers */
function getCustomModifiers(dayModifiers) {
    var customModifiers = {};
    Object.entries(dayModifiers).forEach(function (_a) {
        var modifier = _a[0], matcher = _a[1];
        customModifiers[modifier] = matcherToArray(matcher);
    });
    return customModifiers;
}

/** The name of the modifiers that are used internally by DayPicker. */
exports.InternalModifier = void 0;
(function (InternalModifier) {
    InternalModifier["Outside"] = "outside";
    /** Name of the modifier applied to the disabled days, using the `disabled` prop. */
    InternalModifier["Disabled"] = "disabled";
    /** Name of the modifier applied to the selected days using the `selected` prop). */
    InternalModifier["Selected"] = "selected";
    /** Name of the modifier applied to the hidden days using the `hidden` prop). */
    InternalModifier["Hidden"] = "hidden";
    /** Name of the modifier applied to the day specified using the `today` prop). */
    InternalModifier["Today"] = "today";
    /** The modifier applied to the day starting a selected range, when in range selection mode.  */
    InternalModifier["RangeStart"] = "range_start";
    /** The modifier applied to the day ending a selected range, when in range selection mode.  */
    InternalModifier["RangeEnd"] = "range_end";
    /** The modifier applied to the days between the start and the end of a selected range, when in range selection mode.  */
    InternalModifier["RangeMiddle"] = "range_middle";
})(exports.InternalModifier || (exports.InternalModifier = {}));

var Selected = exports.InternalModifier.Selected, Disabled = exports.InternalModifier.Disabled, Hidden = exports.InternalModifier.Hidden, Today = exports.InternalModifier.Today, RangeEnd = exports.InternalModifier.RangeEnd, RangeMiddle = exports.InternalModifier.RangeMiddle, RangeStart = exports.InternalModifier.RangeStart, Outside = exports.InternalModifier.Outside;
/** Return the {@link InternalModifiers} from the DayPicker and select contexts. */
function getInternalModifiers(dayPicker, selectMultiple, selectRange) {
    var _a;
    var internalModifiers = (_a = {},
        _a[Selected] = matcherToArray(dayPicker.selected),
        _a[Disabled] = matcherToArray(dayPicker.disabled),
        _a[Hidden] = matcherToArray(dayPicker.hidden),
        _a[Today] = [dayPicker.today],
        _a[RangeEnd] = [],
        _a[RangeMiddle] = [],
        _a[RangeStart] = [],
        _a[Outside] = [],
        _a);
    if (dayPicker.fromDate) {
        internalModifiers[Disabled].push({ before: dayPicker.fromDate });
    }
    if (dayPicker.toDate) {
        internalModifiers[Disabled].push({ after: dayPicker.toDate });
    }
    if (isDayPickerMultiple(dayPicker)) {
        internalModifiers[Disabled] = internalModifiers[Disabled].concat(selectMultiple.modifiers[Disabled]);
    }
    else if (isDayPickerRange(dayPicker)) {
        internalModifiers[Disabled] = internalModifiers[Disabled].concat(selectRange.modifiers[Disabled]);
        internalModifiers[RangeStart] = selectRange.modifiers[RangeStart];
        internalModifiers[RangeMiddle] = selectRange.modifiers[RangeMiddle];
        internalModifiers[RangeEnd] = selectRange.modifiers[RangeEnd];
    }
    return internalModifiers;
}

/** The Modifiers context store the modifiers used in DayPicker. To access the value of this context, use {@link useModifiers}. */
var ModifiersContext = react.createContext(undefined);
/** Provide the value for the {@link ModifiersContext}. */
function ModifiersProvider(props) {
    var dayPicker = useDayPicker();
    var selectMultiple = useSelectMultiple();
    var selectRange = useSelectRange();
    var internalModifiers = getInternalModifiers(dayPicker, selectMultiple, selectRange);
    var customModifiers = getCustomModifiers(dayPicker.modifiers);
    var modifiers = __assign(__assign({}, internalModifiers), customModifiers);
    return (jsxRuntime.jsx(ModifiersContext.Provider, { value: modifiers, children: props.children }));
}
/**
 * Return the modifiers used by DayPicker.
 *
 * This hook is meant to be used inside internal or custom components.
 * Requires to be wrapped into {@link ModifiersProvider}.
 *
 */
function useModifiers() {
    var context = react.useContext(ModifiersContext);
    if (!context) {
        throw new Error('useModifiers must be used within a ModifiersProvider');
    }
    return context;
}

/** Returns true if `matcher` is of type {@link DateInterval}. */
function isDateInterval(matcher) {
    return Boolean(matcher &&
        typeof matcher === 'object' &&
        'before' in matcher &&
        'after' in matcher);
}
/** Returns true if `value` is a {@link DateRange} type. */
function isDateRange(value) {
    return Boolean(value && typeof value === 'object' && 'from' in value);
}
/** Returns true if `value` is of type {@link DateAfter}. */
function isDateAfterType(value) {
    return Boolean(value && typeof value === 'object' && 'after' in value);
}
/** Returns true if `value` is of type {@link DateBefore}. */
function isDateBeforeType(value) {
    return Boolean(value && typeof value === 'object' && 'before' in value);
}
/** Returns true if `value` is a {@link DayOfWeek} type. */
function isDayOfWeekType(value) {
    return Boolean(value && typeof value === 'object' && 'dayOfWeek' in value);
}

/** Return `true` whether `date` is inside `range`. */
function isDateInRange(date, range) {
    var _a;
    var from = range.from, to = range.to;
    if (from && to) {
        var isRangeInverted = dateFns.differenceInCalendarDays(to, from) < 0;
        if (isRangeInverted) {
            _a = [to, from], from = _a[0], to = _a[1];
        }
        var isInRange = dateFns.differenceInCalendarDays(date, from) >= 0 &&
            dateFns.differenceInCalendarDays(to, date) >= 0;
        return isInRange;
    }
    if (to) {
        return dateFns.isSameDay(to, date);
    }
    if (from) {
        return dateFns.isSameDay(from, date);
    }
    return false;
}

/** Returns true if `value` is a Date type. */
function isDateType(value) {
    return dateFns.isDate(value);
}
/** Returns true if `value` is an array of valid dates. */
function isArrayOfDates(value) {
    return Array.isArray(value) && value.every(dateFns.isDate);
}
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
function isMatch(day, matchers) {
    return matchers.some(function (matcher) {
        if (typeof matcher === 'boolean') {
            return matcher;
        }
        if (isDateType(matcher)) {
            return dateFns.isSameDay(day, matcher);
        }
        if (isArrayOfDates(matcher)) {
            return matcher.includes(day);
        }
        if (isDateRange(matcher)) {
            return isDateInRange(day, matcher);
        }
        if (isDayOfWeekType(matcher)) {
            return matcher.dayOfWeek.includes(day.getDay());
        }
        if (isDateInterval(matcher)) {
            var diffBefore = dateFns.differenceInCalendarDays(matcher.before, day);
            var diffAfter = dateFns.differenceInCalendarDays(matcher.after, day);
            var isDayBefore = diffBefore > 0;
            var isDayAfter = diffAfter < 0;
            var isClosedInterval = dateFns.isAfter(matcher.before, matcher.after);
            if (isClosedInterval) {
                return isDayAfter && isDayBefore;
            }
            else {
                return isDayBefore || isDayAfter;
            }
        }
        if (isDateAfterType(matcher)) {
            return dateFns.differenceInCalendarDays(day, matcher.after) > 0;
        }
        if (isDateBeforeType(matcher)) {
            return dateFns.differenceInCalendarDays(matcher.before, day) > 0;
        }
        if (typeof matcher === 'function') {
            return matcher(day);
        }
        return false;
    });
}

/** Return the active modifiers for the given day. */
function getActiveModifiers(day, 
/** The modifiers to match for the given date. */
modifiers, 
/** The month where the day is displayed, to add the "outside" modifiers.  */
displayMonth) {
    var matchedModifiers = Object.keys(modifiers).reduce(function (result, key) {
        var modifier = modifiers[key];
        if (isMatch(day, modifier)) {
            result.push(key);
        }
        return result;
    }, []);
    var activeModifiers = {};
    matchedModifiers.forEach(function (modifier) { return (activeModifiers[modifier] = true); });
    if (displayMonth && !dateFns.isSameMonth(day, displayMonth)) {
        activeModifiers.outside = true;
    }
    return activeModifiers;
}

/**
 * Returns the day that should be the target of the focus when DayPicker is
 * rendered the first time.
 *
 * TODO: this function doesn't consider if the day is outside the month. We
 * implemented this check in `useDayRender` but it should probably go here. See
 * https://github.com/gpbl/react-day-picker/pull/1576
 */
function getInitialFocusTarget(displayMonths, modifiers) {
    var firstDayInMonth = dateFns.startOfMonth(displayMonths[0]);
    var lastDayInMonth = dateFns.endOfMonth(displayMonths[displayMonths.length - 1]);
    // TODO: cleanup code
    var firstFocusableDay;
    var today;
    var date = firstDayInMonth;
    while (date <= lastDayInMonth) {
        var activeModifiers = getActiveModifiers(date, modifiers);
        var isFocusable = !activeModifiers.disabled && !activeModifiers.hidden;
        if (!isFocusable) {
            date = dateFns.addDays(date, 1);
            continue;
        }
        if (activeModifiers.selected) {
            return date;
        }
        if (activeModifiers.today && !today) {
            today = date;
        }
        if (!firstFocusableDay) {
            firstFocusableDay = date;
        }
        date = dateFns.addDays(date, 1);
    }
    if (today) {
        return today;
    }
    else {
        return firstFocusableDay;
    }
}

var MAX_RETRY = 365;
/** Return the next date to be focused. */
function getNextFocus(focusedDay, options) {
    var moveBy = options.moveBy, direction = options.direction, context = options.context, modifiers = options.modifiers, _a = options.retry, retry = _a === void 0 ? { count: 0, lastFocused: focusedDay } : _a;
    var weekStartsOn = context.weekStartsOn, fromDate = context.fromDate, toDate = context.toDate, locale = context.locale;
    var moveFns = {
        day: dateFns.addDays,
        week: dateFns.addWeeks,
        month: dateFns.addMonths,
        year: dateFns.addYears,
        startOfWeek: function (date) {
            return context.ISOWeek
                ? dateFns.startOfISOWeek(date)
                : dateFns.startOfWeek(date, { locale: locale, weekStartsOn: weekStartsOn });
        },
        endOfWeek: function (date) {
            return context.ISOWeek
                ? dateFns.endOfISOWeek(date)
                : dateFns.endOfWeek(date, { locale: locale, weekStartsOn: weekStartsOn });
        }
    };
    var newFocusedDay = moveFns[moveBy](focusedDay, direction === 'after' ? 1 : -1);
    if (direction === 'before' && fromDate) {
        newFocusedDay = dateFns.max([fromDate, newFocusedDay]);
    }
    else if (direction === 'after' && toDate) {
        newFocusedDay = dateFns.min([toDate, newFocusedDay]);
    }
    var isFocusable = true;
    if (modifiers) {
        var activeModifiers = getActiveModifiers(newFocusedDay, modifiers);
        isFocusable = !activeModifiers.disabled && !activeModifiers.hidden;
    }
    if (isFocusable) {
        return newFocusedDay;
    }
    else {
        if (retry.count > MAX_RETRY) {
            return retry.lastFocused;
        }
        return getNextFocus(newFocusedDay, {
            moveBy: moveBy,
            direction: direction,
            context: context,
            modifiers: modifiers,
            retry: __assign(__assign({}, retry), { count: retry.count + 1 })
        });
    }
}

/**
 * The Focus context shares details about the focused day for the keyboard
 *
 * Access this context from the {@link useFocusContext} hook.
 */
var FocusContext = react.createContext(undefined);
/** The provider for the {@link FocusContext}. */
function FocusProvider(props) {
    var navigation = useNavigation();
    var modifiers = useModifiers();
    var _a = react.useState(), focusedDay = _a[0], setFocusedDay = _a[1];
    var _b = react.useState(), lastFocused = _b[0], setLastFocused = _b[1];
    var initialFocusTarget = getInitialFocusTarget(navigation.displayMonths, modifiers);
    // TODO: cleanup and test obscure code below
    var focusTarget = (focusedDay !== null && focusedDay !== void 0 ? focusedDay : (lastFocused && navigation.isDateDisplayed(lastFocused)))
        ? lastFocused
        : initialFocusTarget;
    var blur = function () {
        setLastFocused(focusedDay);
        setFocusedDay(undefined);
    };
    var focus = function (date) {
        setFocusedDay(date);
    };
    var context = useDayPicker();
    var moveFocus = function (moveBy, direction) {
        if (!focusedDay)
            return;
        var nextFocused = getNextFocus(focusedDay, {
            moveBy: moveBy,
            direction: direction,
            context: context,
            modifiers: modifiers
        });
        if (dateFns.isSameDay(focusedDay, nextFocused))
            return undefined;
        navigation.goToDate(nextFocused, focusedDay);
        focus(nextFocused);
    };
    var value = {
        focusedDay: focusedDay,
        focusTarget: focusTarget,
        blur: blur,
        focus: focus,
        focusDayAfter: function () { return moveFocus('day', 'after'); },
        focusDayBefore: function () { return moveFocus('day', 'before'); },
        focusWeekAfter: function () { return moveFocus('week', 'after'); },
        focusWeekBefore: function () { return moveFocus('week', 'before'); },
        focusMonthBefore: function () { return moveFocus('month', 'before'); },
        focusMonthAfter: function () { return moveFocus('month', 'after'); },
        focusYearBefore: function () { return moveFocus('year', 'before'); },
        focusYearAfter: function () { return moveFocus('year', 'after'); },
        focusStartOfWeek: function () { return moveFocus('startOfWeek', 'before'); },
        focusEndOfWeek: function () { return moveFocus('endOfWeek', 'after'); }
    };
    return (jsxRuntime.jsx(FocusContext.Provider, { value: value, children: props.children }));
}
/**
 * Hook to access the {@link FocusContextValue}. Use this hook to handle the
 * focus state of the elements.
 *
 * This hook is meant to be used inside internal or custom components.
 */
function useFocusContext() {
    var context = react.useContext(FocusContext);
    if (!context) {
        throw new Error('useFocusContext must be used within a FocusProvider');
    }
    return context;
}

/**
 * Return the active modifiers for the specified day.
 *
 * This hook is meant to be used inside internal or custom components.
 *
 * @param day
 * @param displayMonth
 */
function useActiveModifiers(day, 
/**
 * The month where the date is displayed. If not the same as `date`, the day
 * is an "outside day".
 */
displayMonth) {
    var modifiers = useModifiers();
    var activeModifiers = getActiveModifiers(day, modifiers, displayMonth);
    return activeModifiers;
}

/**
 * The SelectSingle context shares details about the selected days when in
 * single selection mode.
 *
 * Access this context from the {@link useSelectSingle} hook.
 */
var SelectSingleContext = react.createContext(undefined);
/** Provides the values for the {@link SelectSingleProvider}. */
function SelectSingleProvider(props) {
    if (!isDayPickerSingle(props.initialProps)) {
        var emptyContextValue = {
            selected: undefined
        };
        return (jsxRuntime.jsx(SelectSingleContext.Provider, { value: emptyContextValue, children: props.children }));
    }
    return (jsxRuntime.jsx(SelectSingleProviderInternal, { initialProps: props.initialProps, children: props.children }));
}
function SelectSingleProviderInternal(_a) {
    var initialProps = _a.initialProps, children = _a.children;
    var onDayClick = function (day, activeModifiers, e) {
        var _a, _b, _c;
        (_a = initialProps.onDayClick) === null || _a === void 0 ? void 0 : _a.call(initialProps, day, activeModifiers, e);
        if (activeModifiers.selected && !initialProps.required) {
            (_b = initialProps.onSelect) === null || _b === void 0 ? void 0 : _b.call(initialProps, undefined, day, activeModifiers, e);
            return;
        }
        (_c = initialProps.onSelect) === null || _c === void 0 ? void 0 : _c.call(initialProps, day, day, activeModifiers, e);
    };
    var contextValue = {
        selected: initialProps.selected,
        onDayClick: onDayClick
    };
    return (jsxRuntime.jsx(SelectSingleContext.Provider, { value: contextValue, children: children }));
}
/**
 * Hook to access the {@link SelectSingleContextValue}.
 *
 * This hook is meant to be used inside internal or custom components.
 */
function useSelectSingle() {
    var context = react.useContext(SelectSingleContext);
    if (!context) {
        throw new Error('useSelectSingle must be used within a SelectSingleProvider');
    }
    return context;
}

/**
 * This hook returns details about the content to render in the day cell.
 *
 *
 * When a day cell is rendered in the table, DayPicker can either:
 *
 * - render nothing: when the day is outside the month or has matched the
 *   "hidden" modifier.
 * - render a button when `onDayClick` or a selection mode is set.
 * - render a non-interactive element: when no selection mode is set, the day
 *   cell shouldn’t respond to any interaction. DayPicker should render a `div`
 *   or a `span`.
 *
 * ### Usage
 *
 * Use this hook to customize the behavior of the {@link Day} component. Create a
 * new `Day` component using this hook and pass it to the `components` prop.
 * The source of {@link Day} can be a good starting point.
 *
 */
function useDayEventHandlers(date, activeModifiers) {
    var dayPicker = useDayPicker();
    var single = useSelectSingle();
    var multiple = useSelectMultiple();
    var range = useSelectRange();
    var _a = useFocusContext(), focusDayAfter = _a.focusDayAfter, focusDayBefore = _a.focusDayBefore, focusWeekAfter = _a.focusWeekAfter, focusWeekBefore = _a.focusWeekBefore, blur = _a.blur, focus = _a.focus, focusMonthBefore = _a.focusMonthBefore, focusMonthAfter = _a.focusMonthAfter, focusYearBefore = _a.focusYearBefore, focusYearAfter = _a.focusYearAfter, focusStartOfWeek = _a.focusStartOfWeek, focusEndOfWeek = _a.focusEndOfWeek;
    var onClick = function (e) {
        var _a, _b, _c, _d;
        if (isDayPickerSingle(dayPicker)) {
            (_a = single.onDayClick) === null || _a === void 0 ? void 0 : _a.call(single, date, activeModifiers, e);
        }
        else if (isDayPickerMultiple(dayPicker)) {
            (_b = multiple.onDayClick) === null || _b === void 0 ? void 0 : _b.call(multiple, date, activeModifiers, e);
        }
        else if (isDayPickerRange(dayPicker)) {
            (_c = range.onDayClick) === null || _c === void 0 ? void 0 : _c.call(range, date, activeModifiers, e);
        }
        else {
            (_d = dayPicker.onDayClick) === null || _d === void 0 ? void 0 : _d.call(dayPicker, date, activeModifiers, e);
        }
    };
    var onFocus = function (e) {
        var _a;
        focus(date);
        (_a = dayPicker.onDayFocus) === null || _a === void 0 ? void 0 : _a.call(dayPicker, date, activeModifiers, e);
    };
    var onBlur = function (e) {
        var _a;
        blur();
        (_a = dayPicker.onDayBlur) === null || _a === void 0 ? void 0 : _a.call(dayPicker, date, activeModifiers, e);
    };
    var onMouseEnter = function (e) {
        var _a;
        (_a = dayPicker.onDayMouseEnter) === null || _a === void 0 ? void 0 : _a.call(dayPicker, date, activeModifiers, e);
    };
    var onMouseLeave = function (e) {
        var _a;
        (_a = dayPicker.onDayMouseLeave) === null || _a === void 0 ? void 0 : _a.call(dayPicker, date, activeModifiers, e);
    };
    var onPointerEnter = function (e) {
        var _a;
        (_a = dayPicker.onDayPointerEnter) === null || _a === void 0 ? void 0 : _a.call(dayPicker, date, activeModifiers, e);
    };
    var onPointerLeave = function (e) {
        var _a;
        (_a = dayPicker.onDayPointerLeave) === null || _a === void 0 ? void 0 : _a.call(dayPicker, date, activeModifiers, e);
    };
    var onTouchCancel = function (e) {
        var _a;
        (_a = dayPicker.onDayTouchCancel) === null || _a === void 0 ? void 0 : _a.call(dayPicker, date, activeModifiers, e);
    };
    var onTouchEnd = function (e) {
        var _a;
        (_a = dayPicker.onDayTouchEnd) === null || _a === void 0 ? void 0 : _a.call(dayPicker, date, activeModifiers, e);
    };
    var onTouchMove = function (e) {
        var _a;
        (_a = dayPicker.onDayTouchMove) === null || _a === void 0 ? void 0 : _a.call(dayPicker, date, activeModifiers, e);
    };
    var onTouchStart = function (e) {
        var _a;
        (_a = dayPicker.onDayTouchStart) === null || _a === void 0 ? void 0 : _a.call(dayPicker, date, activeModifiers, e);
    };
    var onKeyUp = function (e) {
        var _a;
        (_a = dayPicker.onDayKeyUp) === null || _a === void 0 ? void 0 : _a.call(dayPicker, date, activeModifiers, e);
    };
    var onKeyDown = function (e) {
        var _a;
        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                e.stopPropagation();
                dayPicker.dir === 'rtl' ? focusDayAfter() : focusDayBefore();
                break;
            case 'ArrowRight':
                e.preventDefault();
                e.stopPropagation();
                dayPicker.dir === 'rtl' ? focusDayBefore() : focusDayAfter();
                break;
            case 'ArrowDown':
                e.preventDefault();
                e.stopPropagation();
                focusWeekAfter();
                break;
            case 'ArrowUp':
                e.preventDefault();
                e.stopPropagation();
                focusWeekBefore();
                break;
            case 'PageUp':
                e.preventDefault();
                e.stopPropagation();
                e.shiftKey ? focusYearBefore() : focusMonthBefore();
                break;
            case 'PageDown':
                e.preventDefault();
                e.stopPropagation();
                e.shiftKey ? focusYearAfter() : focusMonthAfter();
                break;
            case 'Home':
                e.preventDefault();
                e.stopPropagation();
                focusStartOfWeek();
                break;
            case 'End':
                e.preventDefault();
                e.stopPropagation();
                focusEndOfWeek();
                break;
        }
        (_a = dayPicker.onDayKeyDown) === null || _a === void 0 ? void 0 : _a.call(dayPicker, date, activeModifiers, e);
    };
    var eventHandlers = {
        onClick: onClick,
        onFocus: onFocus,
        onBlur: onBlur,
        onKeyDown: onKeyDown,
        onKeyUp: onKeyUp,
        onMouseEnter: onMouseEnter,
        onMouseLeave: onMouseLeave,
        onPointerEnter: onPointerEnter,
        onPointerLeave: onPointerLeave,
        onTouchCancel: onTouchCancel,
        onTouchEnd: onTouchEnd,
        onTouchMove: onTouchMove,
        onTouchStart: onTouchStart
    };
    return eventHandlers;
}

/**
 * Return the current selected days when DayPicker is in selection mode. Days
 * selected by the custom selection mode are not returned.
 *
 * This hook is meant to be used inside internal or custom components.
 *
 */
function useSelectedDays() {
    var dayPicker = useDayPicker();
    var single = useSelectSingle();
    var multiple = useSelectMultiple();
    var range = useSelectRange();
    var selectedDays = isDayPickerSingle(dayPicker)
        ? single.selected
        : isDayPickerMultiple(dayPicker)
            ? multiple.selected
            : isDayPickerRange(dayPicker)
                ? range.selected
                : undefined;
    return selectedDays;
}

function isInternalModifier(modifier) {
    return Object.values(exports.InternalModifier).includes(modifier);
}
/**
 * Return the class names for the Day element, according to the given active
 * modifiers.
 *
 * Custom class names are set via `modifiersClassNames` or `classNames`,
 * where the first have the precedence.
 */
function getDayClassNames(dayPicker, activeModifiers) {
    var classNames = [dayPicker.classNames.day];
    Object.keys(activeModifiers).forEach(function (modifier) {
        var customClassName = dayPicker.modifiersClassNames[modifier];
        if (customClassName) {
            classNames.push(customClassName);
        }
        else if (isInternalModifier(modifier)) {
            var internalClassName = dayPicker.classNames["day_".concat(modifier)];
            if (internalClassName) {
                classNames.push(internalClassName);
            }
        }
    });
    return classNames;
}

/** Return the style for the Day element, according to the given active modifiers. */
function getDayStyle(dayPicker, activeModifiers) {
    var style = __assign({}, dayPicker.styles.day);
    Object.keys(activeModifiers).forEach(function (modifier) {
        var _a;
        style = __assign(__assign({}, style), (_a = dayPicker.modifiersStyles) === null || _a === void 0 ? void 0 : _a[modifier]);
    });
    return style;
}

/**
 * Return props and data used to render the {@link Day} component.
 *
 * Use this hook when creating a component to replace the built-in `Day`
 * component.
 */
function useDayRender(
/** The date to render. */
day, 
/** The month where the date is displayed (if not the same as `date`, it means it is an "outside" day). */
displayMonth, 
/** A ref to the button element that will be target of focus when rendered (if required). */
buttonRef) {
    var _a;
    var _b, _c;
    var dayPicker = useDayPicker();
    var focusContext = useFocusContext();
    var activeModifiers = useActiveModifiers(day, displayMonth);
    var eventHandlers = useDayEventHandlers(day, activeModifiers);
    var selectedDays = useSelectedDays();
    var isButton = Boolean(dayPicker.onDayClick || dayPicker.mode !== 'default');
    // Focus the button if the day is focused according to the focus context
    react.useEffect(function () {
        var _a;
        if (activeModifiers.outside)
            return;
        if (!focusContext.focusedDay)
            return;
        if (!isButton)
            return;
        if (dateFns.isSameDay(focusContext.focusedDay, day)) {
            (_a = buttonRef.current) === null || _a === void 0 ? void 0 : _a.focus();
        }
    }, [
        focusContext.focusedDay,
        day,
        buttonRef,
        isButton,
        activeModifiers.outside
    ]);
    var className = getDayClassNames(dayPicker, activeModifiers).join(' ');
    var style = getDayStyle(dayPicker, activeModifiers);
    var isHidden = Boolean((activeModifiers.outside && !dayPicker.showOutsideDays) ||
        activeModifiers.hidden);
    var DayContentComponent = (_c = (_b = dayPicker.components) === null || _b === void 0 ? void 0 : _b.DayContent) !== null && _c !== void 0 ? _c : DayContent;
    var children = (jsxRuntime.jsx(DayContentComponent, { date: day, displayMonth: displayMonth, activeModifiers: activeModifiers }));
    var divProps = {
        style: style,
        className: className,
        children: children,
        role: 'gridcell'
    };
    var isFocusTarget = focusContext.focusTarget &&
        dateFns.isSameDay(focusContext.focusTarget, day) &&
        !activeModifiers.outside;
    var isFocused = focusContext.focusedDay && dateFns.isSameDay(focusContext.focusedDay, day);
    var buttonProps = __assign(__assign(__assign({}, divProps), (_a = { disabled: activeModifiers.disabled, role: 'gridcell' }, _a['aria-selected'] = activeModifiers.selected, _a.tabIndex = isFocused || isFocusTarget ? 0 : -1, _a)), eventHandlers);
    var dayRender = {
        isButton: isButton,
        isHidden: isHidden,
        activeModifiers: activeModifiers,
        selectedDays: selectedDays,
        buttonProps: buttonProps,
        divProps: divProps
    };
    return dayRender;
}

/**
 * The content of a day cell – as a button or span element according to its
 * modifiers.
 */
function Day(props) {
    var buttonRef = react.useRef(null);
    var dayRender = useDayRender(props.date, props.displayMonth, buttonRef);
    if (dayRender.isHidden) {
        return jsxRuntime.jsx("div", { role: "gridcell" });
    }
    if (!dayRender.isButton) {
        return jsxRuntime.jsx("div", __assign({}, dayRender.divProps));
    }
    return jsxRuntime.jsx(Button, __assign({ name: "day", ref: buttonRef }, dayRender.buttonProps));
}

/**
 * Render the week number element. If `onWeekNumberClick` is passed to DayPicker, it
 * renders a button, otherwise a span element.
 */
function WeekNumber(props) {
    var weekNumber = props.number, dates = props.dates;
    var _a = useDayPicker(), onWeekNumberClick = _a.onWeekNumberClick, styles = _a.styles, classNames = _a.classNames, locale = _a.locale, labelWeekNumber = _a.labels.labelWeekNumber, formatWeekNumber = _a.formatters.formatWeekNumber;
    var content = formatWeekNumber(Number(weekNumber), { locale: locale });
    if (!onWeekNumberClick) {
        return (jsxRuntime.jsx("span", { className: classNames.weeknumber, style: styles.weeknumber, children: content }));
    }
    var label = labelWeekNumber(Number(weekNumber), { locale: locale });
    var handleClick = function (e) {
        onWeekNumberClick(weekNumber, dates, e);
    };
    return (jsxRuntime.jsx(Button, { name: "week-number", "aria-label": label, className: classNames.weeknumber, style: styles.weeknumber, onClick: handleClick, children: content }));
}

/** Render a row in the calendar, with the days and the week number. */
function Row(props) {
    var _a, _b;
    var _c = useDayPicker(), styles = _c.styles, classNames = _c.classNames, showWeekNumber = _c.showWeekNumber, components = _c.components;
    var DayComponent = (_a = components === null || components === void 0 ? void 0 : components.Day) !== null && _a !== void 0 ? _a : Day;
    var WeeknumberComponent = (_b = components === null || components === void 0 ? void 0 : components.WeekNumber) !== null && _b !== void 0 ? _b : WeekNumber;
    var weekNumberCell;
    if (showWeekNumber) {
        weekNumberCell = (jsxRuntime.jsx("td", { className: classNames.cell, style: styles.cell, children: jsxRuntime.jsx(WeeknumberComponent, { number: props.weekNumber, dates: props.dates }) }));
    }
    return (jsxRuntime.jsxs("tr", { className: classNames.row, style: styles.row, children: [weekNumberCell, props.dates.map(function (date) { return (jsxRuntime.jsx("td", { className: classNames.cell, style: styles.cell, role: "presentation", children: jsxRuntime.jsx(DayComponent, { displayMonth: props.displayMonth, date: date }) }, dateFns.getUnixTime(date))); })] }));
}

/** Return the weeks between two dates.  */
function daysToMonthWeeks(fromDate, toDate, options) {
    var toWeek = (options === null || options === void 0 ? void 0 : options.ISOWeek)
        ? dateFns.endOfISOWeek(toDate)
        : dateFns.endOfWeek(toDate, options);
    var fromWeek = (options === null || options === void 0 ? void 0 : options.ISOWeek)
        ? dateFns.startOfISOWeek(fromDate)
        : dateFns.startOfWeek(fromDate, options);
    var nOfDays = dateFns.differenceInCalendarDays(toWeek, fromWeek);
    var days = [];
    for (var i = 0; i <= nOfDays; i++) {
        days.push(dateFns.addDays(fromWeek, i));
    }
    var weeksInMonth = days.reduce(function (result, date) {
        var weekNumber = (options === null || options === void 0 ? void 0 : options.ISOWeek)
            ? dateFns.getISOWeek(date)
            : dateFns.getWeek(date, options);
        var existingWeek = result.find(function (value) { return value.weekNumber === weekNumber; });
        if (existingWeek) {
            existingWeek.dates.push(date);
            return result;
        }
        result.push({
            weekNumber: weekNumber,
            dates: [date]
        });
        return result;
    }, []);
    return weeksInMonth;
}

/**
 * Return the weeks belonging to the given month, adding the "outside days" to
 * the first and last week.
 */
function getMonthWeeks(month, options) {
    var weeksInMonth = daysToMonthWeeks(dateFns.startOfMonth(month), dateFns.endOfMonth(month), options);
    if (options === null || options === void 0 ? void 0 : options.useFixedWeeks) {
        // Add extra weeks to the month, up to 6 weeks
        var nrOfMonthWeeks = dateFns.getWeeksInMonth(month, options);
        if (nrOfMonthWeeks < 6) {
            var lastWeek = weeksInMonth[weeksInMonth.length - 1];
            var lastDate = lastWeek.dates[lastWeek.dates.length - 1];
            var toDate = dateFns.addWeeks(lastDate, 6 - nrOfMonthWeeks);
            var extraWeeks = daysToMonthWeeks(dateFns.addWeeks(lastDate, 1), toDate, options);
            weeksInMonth.push.apply(weeksInMonth, extraWeeks);
        }
    }
    return weeksInMonth;
}

/** Render the table with the calendar. */
function Table(props) {
    var _a, _b, _c;
    var _d = useDayPicker(), locale = _d.locale, classNames = _d.classNames, styles = _d.styles, hideHead = _d.hideHead, fixedWeeks = _d.fixedWeeks, components = _d.components, weekStartsOn = _d.weekStartsOn, firstWeekContainsDate = _d.firstWeekContainsDate, ISOWeek = _d.ISOWeek;
    var weeks = getMonthWeeks(props.displayMonth, {
        useFixedWeeks: Boolean(fixedWeeks),
        ISOWeek: ISOWeek,
        locale: locale,
        weekStartsOn: weekStartsOn,
        firstWeekContainsDate: firstWeekContainsDate
    });
    var HeadComponent = (_a = components === null || components === void 0 ? void 0 : components.Head) !== null && _a !== void 0 ? _a : Head;
    var RowComponent = (_b = components === null || components === void 0 ? void 0 : components.Row) !== null && _b !== void 0 ? _b : Row;
    var FooterComponent = (_c = components === null || components === void 0 ? void 0 : components.Footer) !== null && _c !== void 0 ? _c : Footer;
    return (jsxRuntime.jsxs("table", { id: props.id, className: classNames.table, style: styles.table, role: "grid", "aria-labelledby": props['aria-labelledby'], children: [!hideHead && jsxRuntime.jsx(HeadComponent, {}), jsxRuntime.jsx("tbody", { className: classNames.tbody, style: styles.tbody, children: weeks.map(function (week) { return (jsxRuntime.jsx(RowComponent, { displayMonth: props.displayMonth, dates: week.dates, weekNumber: week.weekNumber }, week.weekNumber)); }) }), jsxRuntime.jsx(FooterComponent, { displayMonth: props.displayMonth })] }));
}

/*
The MIT License (MIT)

Copyright (c) 2018-present, React Training LLC

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/*
 * Welcome to @reach/auto-id!
 * Let's see if we can make sense of why this hook exists and its
 * implementation.
 *
 * Some background:
 *   1. Accessibility APIs rely heavily on element IDs
 *   2. Requiring developers to put IDs on every element in Reach UI is both
 *      cumbersome and error-prone
 *   3. With a component model, we can generate IDs for them!
 *
 * Solution 1: Generate random IDs.
 *
 * This works great as long as you don't server render your app. When React (in
 * the client) tries to reuse the markup from the server, the IDs won't match
 * and React will then recreate the entire DOM tree.
 *
 * Solution 2: Increment an integer
 *
 * This sounds great. Since we're rendering the exact same tree on the server
 * and client, we can increment a counter and get a deterministic result between
 * client and server. Also, JS integers can go up to nine-quadrillion. I'm
 * pretty sure the tab will be closed before an app never needs
 * 10 quadrillion IDs!
 *
 * Problem solved, right?
 *
 * Ah, but there's a catch! React's concurrent rendering makes this approach
 * non-deterministic. While the client and server will end up with the same
 * elements in the end, depending on suspense boundaries (and possibly some user
 * input during the initial render) the incrementing integers won't always match
 * up.
 *
 * Solution 3: Don't use IDs at all on the server; patch after first render.
 *
 * What we've done here is solution 2 with some tricks. With this approach, the
 * ID returned is an empty string on the first render. This way the server and
 * client have the same markup no matter how wild the concurrent rendering may
 * have gotten.
 *
 * After the render, we patch up the components with an incremented ID. This
 * causes a double render on any components with `useId`. Shouldn't be a problem
 * since the components using this hook should be small, and we're only updating
 * the ID attribute on the DOM, nothing big is happening.
 *
 * It doesn't have to be an incremented number, though--we could do generate
 * random strings instead, but incrementing a number is probably the cheapest
 * thing we can do.
 *
 * Additionally, we only do this patchup on the very first client render ever.
 * Any calls to `useId` that happen dynamically in the client will be
 * populated immediately with a value. So, we only get the double render after
 * server hydration and never again, SO BACK OFF ALRIGHT?
 */
function canUseDOM() {
    return !!(typeof window !== 'undefined' &&
        window.document &&
        window.document.createElement);
}
/**
 * React currently throws a warning when using useLayoutEffect on the server. To
 * get around it, we can conditionally useEffect on the server (no-op) and
 * useLayoutEffect in the browser. We occasionally need useLayoutEffect to
 * ensure we don't get a render flash for certain operations, but we may also
 * need affected components to render on the server. One example is when setting
 * a component's descendants to retrieve their index values.
 *
 * Important to note that using this hook as an escape hatch will break the
 * eslint dependency warnings unless you rename the import to `useLayoutEffect`.
 * Use sparingly only when the effect won't effect the rendered HTML to avoid
 * any server/client mismatch.
 *
 * If a useLayoutEffect is needed and the result would create a mismatch, it's
 * likely that the component in question shouldn't be rendered on the server at
 * all, so a better approach would be to lazily render those in a parent
 * component after client-side hydration.
 *
 * https://gist.github.com/gaearon/e7d97cdf38a2907924ea12e4ebdf3c85
 * https://github.com/reduxjs/react-redux/blob/master/src/utils/useIsomorphicLayoutEffect.js
 *
 * @param effect
 * @param deps
 */
var useIsomorphicLayoutEffect = canUseDOM() ? react.useLayoutEffect : react.useEffect;
var serverHandoffComplete = false;
var id = 0;
function genId() {
    return "react-day-picker-".concat(++id);
}
function useId(providedId) {
    // TODO: Remove error flag when updating internal deps to React 18. None of
    // our tricks will play well with concurrent rendering anyway.
    var _a;
    // If this instance isn't part of the initial render, we don't have to do the
    // double render/patch-up dance. We can just generate the ID and return it.
    var initialId = providedId !== null && providedId !== void 0 ? providedId : (serverHandoffComplete ? genId() : null);
    var _b = react.useState(initialId), id = _b[0], setId = _b[1];
    useIsomorphicLayoutEffect(function () {
        if (id === null) {
            // Patch the ID after render. We do this in `useLayoutEffect` to avoid any
            // rendering flicker, though it'll make the first render slower (unlikely
            // to matter, but you're welcome to measure your app and let us know if
            // it's a problem).
            setId(genId());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    react.useEffect(function () {
        if (serverHandoffComplete === false) {
            // Flag all future uses of `useId` to skip the update dance. This is in
            // `useEffect` because it goes after `useLayoutEffect`, ensuring we don't
            // accidentally bail out of the patch-up dance prematurely.
            serverHandoffComplete = true;
        }
    }, []);
    return (_a = providedId !== null && providedId !== void 0 ? providedId : id) !== null && _a !== void 0 ? _a : undefined;
}

/** Render a month. */
function Month(props) {
    var _a;
    var _b;
    var dayPicker = useDayPicker();
    var dir = dayPicker.dir, classNames = dayPicker.classNames, styles = dayPicker.styles, components = dayPicker.components;
    var displayMonths = useNavigation().displayMonths;
    var captionId = useId(dayPicker.id ? "".concat(dayPicker.id, "-").concat(props.displayIndex) : undefined);
    var tableId = dayPicker.id
        ? "".concat(dayPicker.id, "-grid-").concat(props.displayIndex)
        : undefined;
    var className = [classNames.month];
    var style = styles.month;
    var isStart = props.displayIndex === 0;
    var isEnd = props.displayIndex === displayMonths.length - 1;
    var isCenter = !isStart && !isEnd;
    if (dir === 'rtl') {
        _a = [isStart, isEnd], isEnd = _a[0], isStart = _a[1];
    }
    if (isStart) {
        className.push(classNames.caption_start);
        style = __assign(__assign({}, style), styles.caption_start);
    }
    if (isEnd) {
        className.push(classNames.caption_end);
        style = __assign(__assign({}, style), styles.caption_end);
    }
    if (isCenter) {
        className.push(classNames.caption_between);
        style = __assign(__assign({}, style), styles.caption_between);
    }
    var CaptionComponent = (_b = components === null || components === void 0 ? void 0 : components.Caption) !== null && _b !== void 0 ? _b : Caption;
    return (jsxRuntime.jsxs("div", { className: className.join(' '), style: style, children: [jsxRuntime.jsx(CaptionComponent, { id: captionId, displayMonth: props.displayMonth, displayIndex: props.displayIndex }), jsxRuntime.jsx(Table, { id: tableId, "aria-labelledby": captionId, displayMonth: props.displayMonth })] }, props.displayIndex));
}

/**
 * Render the wrapper for the month grids.
 */
function Months(props) {
    var _a = useDayPicker(), classNames = _a.classNames, styles = _a.styles;
    return (jsxRuntime.jsx("div", { className: classNames.months, style: styles.months, children: props.children }));
}

/** Render the container with the months according to the number of months to display. */
function Root(_a) {
    var _b, _c;
    var initialProps = _a.initialProps;
    var dayPicker = useDayPicker();
    var focusContext = useFocusContext();
    var navigation = useNavigation();
    var _d = react.useState(false), hasInitialFocus = _d[0], setHasInitialFocus = _d[1];
    // Focus the focus target when initialFocus is passed in
    react.useEffect(function () {
        if (!dayPicker.initialFocus)
            return;
        if (!focusContext.focusTarget)
            return;
        if (hasInitialFocus)
            return;
        focusContext.focus(focusContext.focusTarget);
        setHasInitialFocus(true);
    }, [
        dayPicker.initialFocus,
        hasInitialFocus,
        focusContext.focus,
        focusContext.focusTarget,
        focusContext
    ]);
    // Apply classnames according to props
    var classNames = [dayPicker.classNames.root, dayPicker.className];
    if (dayPicker.numberOfMonths > 1) {
        classNames.push(dayPicker.classNames.multiple_months);
    }
    if (dayPicker.showWeekNumber) {
        classNames.push(dayPicker.classNames.with_weeknumber);
    }
    var style = __assign(__assign({}, dayPicker.styles.root), dayPicker.style);
    var dataAttributes = Object.keys(initialProps)
        .filter(function (key) { return key.startsWith('data-'); })
        .reduce(function (attrs, key) {
        var _a;
        return __assign(__assign({}, attrs), (_a = {}, _a[key] = initialProps[key], _a));
    }, {});
    var MonthsComponent = (_c = (_b = initialProps.components) === null || _b === void 0 ? void 0 : _b.Months) !== null && _c !== void 0 ? _c : Months;
    return (jsxRuntime.jsx("div", __assign({ className: classNames.join(' '), style: style, dir: dayPicker.dir, id: dayPicker.id, nonce: initialProps.nonce, title: initialProps.title, lang: initialProps.lang }, dataAttributes, { children: jsxRuntime.jsx(MonthsComponent, { children: navigation.displayMonths.map(function (month, i) { return (jsxRuntime.jsx(Month, { displayIndex: i, displayMonth: month }, i)); }) }) })));
}

/** Provide the value for all the context providers. */
function RootProvider(props) {
    var children = props.children, initialProps = __rest(props, ["children"]);
    return (jsxRuntime.jsx(DayPickerProvider, { initialProps: initialProps, children: jsxRuntime.jsx(NavigationProvider, { children: jsxRuntime.jsx(SelectSingleProvider, { initialProps: initialProps, children: jsxRuntime.jsx(SelectMultipleProvider, { initialProps: initialProps, children: jsxRuntime.jsx(SelectRangeProvider, { initialProps: initialProps, children: jsxRuntime.jsx(ModifiersProvider, { children: jsxRuntime.jsx(FocusProvider, { children: children }) }) }) }) }) }) }));
}

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
function DayPicker(props) {
    return (jsxRuntime.jsx(RootProvider, __assign({}, props, { children: jsxRuntime.jsx(Root, { initialProps: props }) })));
}

/** @private */
function isValidDate(day) {
    return !isNaN(day.getTime());
}

/** Return props and setters for binding an input field to DayPicker. */
function useInput(options) {
    if (options === void 0) { options = {}; }
    var _a = options.locale, locale$1 = _a === void 0 ? locale.enUS : _a, required = options.required, _b = options.format, format = _b === void 0 ? 'PP' : _b, defaultSelected = options.defaultSelected, _c = options.today, today = _c === void 0 ? new Date() : _c;
    var _d = parseFromToProps(options), fromDate = _d.fromDate, toDate = _d.toDate;
    // Shortcut to the DateFns functions
    var parseValue = function (value) { return dateFns.parse(value, format, today, { locale: locale$1 }); };
    // Initialize states
    var _e = react.useState(defaultSelected !== null && defaultSelected !== void 0 ? defaultSelected : today), month = _e[0], setMonth = _e[1];
    var _f = react.useState(defaultSelected), selectedDay = _f[0], setSelectedDay = _f[1];
    var defaultInputValue = defaultSelected
        ? dateFns.format(defaultSelected, format, { locale: locale$1 })
        : '';
    var _g = react.useState(defaultInputValue), inputValue = _g[0], setInputValue = _g[1];
    var reset = function () {
        setSelectedDay(defaultSelected);
        setMonth(defaultSelected !== null && defaultSelected !== void 0 ? defaultSelected : today);
        setInputValue(defaultInputValue !== null && defaultInputValue !== void 0 ? defaultInputValue : '');
    };
    var setSelected = function (date) {
        setSelectedDay(date);
        setMonth(date !== null && date !== void 0 ? date : today);
        setInputValue(date ? dateFns.format(date, format, { locale: locale$1 }) : '');
    };
    var handleDayClick = function (day, _a) {
        var selected = _a.selected;
        if (!required && selected) {
            setSelectedDay(undefined);
            setInputValue('');
            return;
        }
        setSelectedDay(day);
        setInputValue(day ? dateFns.format(day, format, { locale: locale$1 }) : '');
    };
    var handleMonthChange = function (month) {
        setMonth(month);
    };
    // When changing the input field, save its value in state and check if the
    // string is a valid date. If it is a valid day, set it as selected and update
    // the calendar’s month.
    var handleChange = function (e) {
        setInputValue(e.target.value);
        var day = parseValue(e.target.value);
        var isBefore = fromDate && dateFns.differenceInCalendarDays(fromDate, day) > 0;
        var isAfter = toDate && dateFns.differenceInCalendarDays(day, toDate) > 0;
        if (!isValidDate(day) || isBefore || isAfter) {
            setSelectedDay(undefined);
            return;
        }
        setSelectedDay(day);
        setMonth(day);
    };
    // Special case for _required_ fields: on blur, if the value of the input is not
    // a valid date, reset the calendar and the input value.
    var handleBlur = function (e) {
        var day = parseValue(e.target.value);
        if (!isValidDate(day)) {
            reset();
        }
    };
    // When focusing, make sure DayPicker visualizes the month of the date in the
    // input field.
    var handleFocus = function (e) {
        if (!e.target.value) {
            reset();
            return;
        }
        var day = parseValue(e.target.value);
        if (isValidDate(day)) {
            setMonth(day);
        }
    };
    var dayPickerProps = {
        month: month,
        onDayClick: handleDayClick,
        onMonthChange: handleMonthChange,
        selected: selectedDay,
        locale: locale$1,
        fromDate: fromDate,
        toDate: toDate,
        today: today
    };
    var inputProps = {
        onBlur: handleBlur,
        onChange: handleChange,
        onFocus: handleFocus,
        value: inputValue,
        placeholder: dateFns.format(new Date(), format, { locale: locale$1 })
    };
    return { dayPickerProps: dayPickerProps, inputProps: inputProps, reset: reset, setSelected: setSelected };
}

/** Returns true when the props are of type {@link DayPickerDefaultProps}. */
function isDayPickerDefault(props) {
    return props.mode === undefined || props.mode === 'default';
}

exports.Button = Button;
exports.Caption = Caption;
exports.CaptionDropdowns = CaptionDropdowns;
exports.CaptionLabel = CaptionLabel;
exports.CaptionNavigation = CaptionNavigation;
exports.Day = Day;
exports.DayContent = DayContent;
exports.DayPicker = DayPicker;
exports.DayPickerContext = DayPickerContext;
exports.DayPickerProvider = DayPickerProvider;
exports.Dropdown = Dropdown;
exports.FocusContext = FocusContext;
exports.FocusProvider = FocusProvider;
exports.Footer = Footer;
exports.Head = Head;
exports.HeadRow = HeadRow;
exports.IconDropdown = IconDropdown;
exports.IconLeft = IconLeft;
exports.IconRight = IconRight;
exports.Months = Months;
exports.NavigationContext = NavigationContext;
exports.NavigationProvider = NavigationProvider;
exports.RootProvider = RootProvider;
exports.Row = Row;
exports.SelectMultipleContext = SelectMultipleContext;
exports.SelectMultipleProvider = SelectMultipleProvider;
exports.SelectMultipleProviderInternal = SelectMultipleProviderInternal;
exports.SelectRangeContext = SelectRangeContext;
exports.SelectRangeProvider = SelectRangeProvider;
exports.SelectRangeProviderInternal = SelectRangeProviderInternal;
exports.SelectSingleContext = SelectSingleContext;
exports.SelectSingleProvider = SelectSingleProvider;
exports.SelectSingleProviderInternal = SelectSingleProviderInternal;
exports.WeekNumber = WeekNumber;
exports.addToRange = addToRange;
exports.isDateAfterType = isDateAfterType;
exports.isDateBeforeType = isDateBeforeType;
exports.isDateInterval = isDateInterval;
exports.isDateRange = isDateRange;
exports.isDayOfWeekType = isDayOfWeekType;
exports.isDayPickerDefault = isDayPickerDefault;
exports.isDayPickerMultiple = isDayPickerMultiple;
exports.isDayPickerRange = isDayPickerRange;
exports.isDayPickerSingle = isDayPickerSingle;
exports.isMatch = isMatch;
exports.useActiveModifiers = useActiveModifiers;
exports.useDayPicker = useDayPicker;
exports.useDayRender = useDayRender;
exports.useFocusContext = useFocusContext;
exports.useInput = useInput;
exports.useNavigation = useNavigation;
exports.useSelectMultiple = useSelectMultiple;
exports.useSelectRange = useSelectRange;
exports.useSelectSingle = useSelectSingle;
//# sourceMappingURL=index.js.map
