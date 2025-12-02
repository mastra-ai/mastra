import { State, AutocompletePrompt } from '@clack/core';
export { ClackSettings, isCancel, settings, updateSettings } from '@clack/core';
import { Readable, Writable } from 'node:stream';

declare const unicode: boolean;
declare const isCI: () => boolean;
declare const isTTY: (output: Writable) => boolean;
declare const unicodeOr: (c: string, fallback: string) => string;
declare const S_STEP_ACTIVE: string;
declare const S_STEP_CANCEL: string;
declare const S_STEP_ERROR: string;
declare const S_STEP_SUBMIT: string;
declare const S_BAR_START: string;
declare const S_BAR: string;
declare const S_BAR_END: string;
declare const S_BAR_START_RIGHT: string;
declare const S_BAR_END_RIGHT: string;
declare const S_RADIO_ACTIVE: string;
declare const S_RADIO_INACTIVE: string;
declare const S_CHECKBOX_ACTIVE: string;
declare const S_CHECKBOX_SELECTED: string;
declare const S_CHECKBOX_INACTIVE: string;
declare const S_PASSWORD_MASK: string;
declare const S_BAR_H: string;
declare const S_CORNER_TOP_RIGHT: string;
declare const S_CONNECT_LEFT: string;
declare const S_CORNER_BOTTOM_RIGHT: string;
declare const S_CORNER_BOTTOM_LEFT: string;
declare const S_CORNER_TOP_LEFT: string;
declare const S_INFO: string;
declare const S_SUCCESS: string;
declare const S_WARN: string;
declare const S_ERROR: string;
declare const symbol: (state: State) => string;
interface CommonOptions {
    input?: Readable;
    output?: Writable;
    signal?: AbortSignal;
}

type Primitive = Readonly<string | boolean | number>;
type Option<Value> = Value extends Primitive ? {
    /**
     * Internal data for this option.
     */
    value: Value;
    /**
     * The optional, user-facing text for this option.
     *
     * By default, the `value` is converted to a string.
     */
    label?: string;
    /**
     * An optional hint to display to the user when
     * this option might be selected.
     *
     * By default, no `hint` is displayed.
     */
    hint?: string;
    /**
     * Whether this option is disabled.
     * Disabled options are visible but cannot be selected.
     *
     * By default, options are not disabled.
     */
    disabled?: boolean;
} : {
    /**
     * Internal data for this option.
     */
    value: Value;
    /**
     * Required. The user-facing text for this option.
     */
    label: string;
    /**
     * An optional hint to display to the user when
     * this option might be selected.
     *
     * By default, no `hint` is displayed.
     */
    hint?: string;
    /**
     * Whether this option is disabled.
     * Disabled options are visible but cannot be selected.
     *
     * By default, options are not disabled.
     */
    disabled?: boolean;
};
interface SelectOptions<Value> extends CommonOptions {
    message: string;
    options: Option<Value>[];
    initialValue?: Value;
    maxItems?: number;
}
declare const select: <Value>(opts: SelectOptions<Value>) => Promise<Value | symbol>;

interface AutocompleteSharedOptions<Value> extends CommonOptions {
    /**
     * The message to display to the user.
     */
    message: string;
    /**
     * Available options for the autocomplete prompt.
     */
    options: Option<Value>[] | ((this: AutocompletePrompt<Option<Value>>) => Option<Value>[]);
    /**
     * Maximum number of items to display at once.
     */
    maxItems?: number;
    /**
     * Placeholder text to display when no input is provided.
     */
    placeholder?: string;
    /**
     * Validates the value
     */
    validate?: (value: Value | Value[] | undefined) => string | Error | undefined;
}
interface AutocompleteOptions<Value> extends AutocompleteSharedOptions<Value> {
    /**
     * The initial selected value.
     */
    initialValue?: Value;
    /**
     * The initial user input
     */
    initialUserInput?: string;
}
declare const autocomplete: <Value>(opts: AutocompleteOptions<Value>) => Promise<Value | symbol>;
interface AutocompleteMultiSelectOptions<Value> extends AutocompleteSharedOptions<Value> {
    /**
     * The initial selected values
     */
    initialValues?: Value[];
    /**
     * If true, at least one option must be selected
     */
    required?: boolean;
}
/**
 * Integrated autocomplete multiselect - combines type-ahead filtering with multiselect in one UI
 */
declare const autocompleteMultiselect: <Value>(opts: AutocompleteMultiSelectOptions<Value>) => Promise<Value[] | symbol>;

type BoxAlignment = 'left' | 'center' | 'right';
interface BoxOptions extends CommonOptions {
    contentAlign?: BoxAlignment;
    titleAlign?: BoxAlignment;
    width?: number | 'auto';
    titlePadding?: number;
    contentPadding?: number;
    rounded?: boolean;
    includePrefix?: boolean;
    formatBorder?: (text: string) => string;
}
declare const box: (message?: string, title?: string, opts?: BoxOptions) => void;

interface ConfirmOptions extends CommonOptions {
    message: string;
    active?: string;
    inactive?: string;
    initialValue?: boolean;
}
declare const confirm: (opts: ConfirmOptions) => Promise<boolean | symbol>;

type Prettify<T> = {
    [P in keyof T]: T[P];
} & {};
type PromptGroupAwaitedReturn<T> = {
    [P in keyof T]: Exclude<Awaited<T[P]>, symbol>;
};
interface PromptGroupOptions<T> {
    /**
     * Control how the group can be canceled
     * if one of the prompts is canceled.
     */
    onCancel?: (opts: {
        results: Prettify<Partial<PromptGroupAwaitedReturn<T>>>;
    }) => void;
}
type PromptGroup<T> = {
    [P in keyof T]: (opts: {
        results: Prettify<Partial<PromptGroupAwaitedReturn<Omit<T, P>>>>;
    }) => undefined | Promise<T[P] | undefined>;
};
/**
 * Define a group of prompts to be displayed
 * and return a results of objects within the group
 */
declare const group: <T>(prompts: PromptGroup<T>, opts?: PromptGroupOptions<T>) => Promise<Prettify<PromptGroupAwaitedReturn<T>>>;

interface GroupMultiSelectOptions<Value> extends CommonOptions {
    message: string;
    options: Record<string, Option<Value>[]>;
    initialValues?: Value[];
    required?: boolean;
    cursorAt?: Value;
    selectableGroups?: boolean;
    groupSpacing?: number;
}
declare const groupMultiselect: <Value>(opts: GroupMultiSelectOptions<Value>) => Promise<Value[] | symbol>;

interface LimitOptionsParams<TOption> extends CommonOptions {
    options: TOption[];
    maxItems: number | undefined;
    cursor: number;
    style: (option: TOption, active: boolean) => string;
    columnPadding?: number;
    rowPadding?: number;
}
declare const limitOptions: <TOption>(params: LimitOptionsParams<TOption>) => string[];

interface LogMessageOptions extends CommonOptions {
    symbol?: string;
    spacing?: number;
    secondarySymbol?: string;
}
declare const log: {
    message: (message?: string | string[], { symbol, secondarySymbol, output, spacing, }?: LogMessageOptions) => void;
    info: (message: string, opts?: LogMessageOptions) => void;
    success: (message: string, opts?: LogMessageOptions) => void;
    step: (message: string, opts?: LogMessageOptions) => void;
    warn: (message: string, opts?: LogMessageOptions) => void;
    /** alias for `log.warn()`. */
    warning: (message: string, opts?: LogMessageOptions) => void;
    error: (message: string, opts?: LogMessageOptions) => void;
};

declare const cancel: (message?: string, opts?: CommonOptions) => void;
declare const intro: (title?: string, opts?: CommonOptions) => void;
declare const outro: (message?: string, opts?: CommonOptions) => void;

interface MultiSelectOptions<Value> extends CommonOptions {
    message: string;
    options: Option<Value>[];
    initialValues?: Value[];
    maxItems?: number;
    required?: boolean;
    cursorAt?: Value;
}
declare const multiselect: <Value>(opts: MultiSelectOptions<Value>) => Promise<Value[] | symbol>;

type FormatFn = (line: string) => string;
interface NoteOptions extends CommonOptions {
    format?: FormatFn;
}
declare const note: (message?: string, title?: string, opts?: NoteOptions) => void;

interface PasswordOptions extends CommonOptions {
    message: string;
    mask?: string;
    validate?: (value: string | undefined) => string | Error | undefined;
    clearOnError?: boolean;
}
declare const password: (opts: PasswordOptions) => Promise<string | symbol>;

interface PathOptions extends CommonOptions {
    root?: string;
    directory?: boolean;
    initialValue?: string;
    message: string;
    validate?: (value: string | undefined) => string | Error | undefined;
}
declare const path: (opts: PathOptions) => Promise<string | symbol>;

interface SpinnerOptions extends CommonOptions {
    indicator?: 'dots' | 'timer';
    onCancel?: () => void;
    cancelMessage?: string;
    errorMessage?: string;
    frames?: string[];
    delay?: number;
    styleFrame?: (frame: string) => string;
}
interface SpinnerResult {
    start(msg?: string): void;
    stop(msg?: string, code?: number): void;
    message(msg?: string): void;
    readonly isCancelled: boolean;
}
declare const spinner: ({ indicator, onCancel, output, cancelMessage, errorMessage, frames, delay, signal, ...opts }?: SpinnerOptions) => SpinnerResult;

interface ProgressOptions extends SpinnerOptions {
    style?: 'light' | 'heavy' | 'block';
    max?: number;
    size?: number;
}
interface ProgressResult extends SpinnerResult {
    advance(step?: number, msg?: string): void;
}
declare function progress({ style, max: userMax, size: userSize, ...spinnerOptions }?: ProgressOptions): ProgressResult;

declare const selectKey: <Value extends string>(opts: SelectOptions<Value>) => Promise<Value | symbol>;

declare const stream: {
    message: (iterable: Iterable<string> | AsyncIterable<string>, { symbol }?: LogMessageOptions) => Promise<void>;
    info: (iterable: Iterable<string> | AsyncIterable<string>) => Promise<void>;
    success: (iterable: Iterable<string> | AsyncIterable<string>) => Promise<void>;
    step: (iterable: Iterable<string> | AsyncIterable<string>) => Promise<void>;
    warn: (iterable: Iterable<string> | AsyncIterable<string>) => Promise<void>;
    /** alias for `log.warn()`. */
    warning: (iterable: Iterable<string> | AsyncIterable<string>) => Promise<void>;
    error: (iterable: Iterable<string> | AsyncIterable<string>) => Promise<void>;
};

type Task = {
    /**
     * Task title
     */
    title: string;
    /**
     * Task function
     */
    task: (message: (string: string) => void) => string | Promise<string> | void | Promise<void>;
    /**
     * If enabled === false the task will be skipped
     */
    enabled?: boolean;
};
/**
 * Define a group of tasks to be executed
 */
declare const tasks: (tasks: Task[], opts?: CommonOptions) => Promise<void>;

interface TaskLogOptions extends CommonOptions {
    title: string;
    limit?: number;
    spacing?: number;
    retainLog?: boolean;
}
interface TaskLogMessageOptions {
    raw?: boolean;
}
interface TaskLogCompletionOptions {
    showLog?: boolean;
}
/**
 * Renders a log which clears on success and remains on failure
 */
declare const taskLog: (opts: TaskLogOptions) => {
    message(msg: string, mopts?: TaskLogMessageOptions): void;
    group(name: string): {
        message(msg: string, mopts?: TaskLogMessageOptions): void;
        error(message: string): void;
        success(message: string): void;
    };
    error(message: string, opts?: TaskLogCompletionOptions): void;
    success(message: string, opts?: TaskLogCompletionOptions): void;
};

interface TextOptions extends CommonOptions {
    message: string;
    placeholder?: string;
    defaultValue?: string;
    initialValue?: string;
    validate?: (value: string | undefined) => string | Error | undefined;
}
declare const text: (opts: TextOptions) => Promise<string | symbol>;

export { S_BAR, S_BAR_END, S_BAR_END_RIGHT, S_BAR_H, S_BAR_START, S_BAR_START_RIGHT, S_CHECKBOX_ACTIVE, S_CHECKBOX_INACTIVE, S_CHECKBOX_SELECTED, S_CONNECT_LEFT, S_CORNER_BOTTOM_LEFT, S_CORNER_BOTTOM_RIGHT, S_CORNER_TOP_LEFT, S_CORNER_TOP_RIGHT, S_ERROR, S_INFO, S_PASSWORD_MASK, S_RADIO_ACTIVE, S_RADIO_INACTIVE, S_STEP_ACTIVE, S_STEP_CANCEL, S_STEP_ERROR, S_STEP_SUBMIT, S_SUCCESS, S_WARN, autocomplete, autocompleteMultiselect, box, cancel, confirm, group, groupMultiselect, intro, isCI, isTTY, limitOptions, log, multiselect, note, outro, password, path, progress, select, selectKey, spinner, stream, symbol, taskLog, tasks, text, unicode, unicodeOr };
export type { AutocompleteMultiSelectOptions, AutocompleteOptions, BoxAlignment, BoxOptions, CommonOptions, ConfirmOptions, GroupMultiSelectOptions, LimitOptionsParams, LogMessageOptions, MultiSelectOptions, NoteOptions, Option, PasswordOptions, PathOptions, ProgressOptions, ProgressResult, PromptGroup, PromptGroupAwaitedReturn, PromptGroupOptions, SelectOptions, SpinnerOptions, SpinnerResult, Task, TaskLogCompletionOptions, TaskLogMessageOptions, TaskLogOptions, TextOptions };
