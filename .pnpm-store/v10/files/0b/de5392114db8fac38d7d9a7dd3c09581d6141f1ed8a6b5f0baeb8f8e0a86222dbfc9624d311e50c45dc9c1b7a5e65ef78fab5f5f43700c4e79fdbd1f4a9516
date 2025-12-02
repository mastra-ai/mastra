import { Key } from 'node:readline';
import { Readable, Writable } from 'node:stream';

declare const actions: readonly ["up", "down", "left", "right", "space", "enter", "cancel"];
type Action = (typeof actions)[number];
/** Global settings for Clack programs, stored in memory */
interface InternalClackSettings {
    actions: Set<Action>;
    aliases: Map<string, Action>;
    messages: {
        cancel: string;
        error: string;
    };
}
declare const settings: InternalClackSettings;
interface ClackSettings {
    /**
     * Set custom global aliases for the default actions.
     * This will not overwrite existing aliases, it will only add new ones!
     *
     * @param aliases - An object that maps aliases to actions
     * @default { k: 'up', j: 'down', h: 'left', l: 'right', '\x03': 'cancel', 'escape': 'cancel' }
     */
    aliases?: Record<string, Action>;
    /**
     * Custom messages for prompts
     */
    messages?: {
        /**
         * Custom message to display when a spinner is cancelled
         * @default "Canceled"
         */
        cancel?: string;
        /**
         * Custom message to display when a spinner encounters an error
         * @default "Something went wrong"
         */
        error?: string;
    };
}
declare function updateSettings(updates: ClackSettings): void;

/**
 * The state of the prompt
 */
type ClackState = 'initial' | 'active' | 'cancel' | 'submit' | 'error';
/**
 * Typed event emitter for clack
 */
interface ClackEvents<TValue> {
    initial: (value?: any) => void;
    active: (value?: any) => void;
    cancel: (value?: any) => void;
    submit: (value?: any) => void;
    error: (value?: any) => void;
    cursor: (key?: Action) => void;
    key: (key: string | undefined, info: Key) => void;
    value: (value?: TValue) => void;
    userInput: (value: string) => void;
    confirm: (value?: boolean) => void;
    finalize: () => void;
    beforePrompt: () => void;
}

interface PromptOptions<TValue, Self extends Prompt<TValue>> {
    render(this: Omit<Self, 'prompt'>): string | undefined;
    initialValue?: any;
    initialUserInput?: string;
    validate?: ((value: TValue | undefined) => string | Error | undefined) | undefined;
    input?: Readable;
    output?: Writable;
    debug?: boolean;
    signal?: AbortSignal;
}
declare class Prompt<TValue> {
    protected input: Readable;
    protected output: Writable;
    private _abortSignal?;
    private rl;
    private opts;
    private _render;
    private _track;
    private _prevFrame;
    private _subscribers;
    protected _cursor: number;
    state: ClackState;
    error: string;
    value: TValue | undefined;
    userInput: string;
    constructor(options: PromptOptions<TValue, Prompt<TValue>>, trackValue?: boolean);
    /**
     * Unsubscribe all listeners
     */
    protected unsubscribe(): void;
    /**
     * Set a subscriber with opts
     * @param event - The event name
     */
    private setSubscriber;
    /**
     * Subscribe to an event
     * @param event - The event name
     * @param cb - The callback
     */
    on<T extends keyof ClackEvents<TValue>>(event: T, cb: ClackEvents<TValue>[T]): void;
    /**
     * Subscribe to an event once
     * @param event - The event name
     * @param cb - The callback
     */
    once<T extends keyof ClackEvents<TValue>>(event: T, cb: ClackEvents<TValue>[T]): void;
    /**
     * Emit an event with data
     * @param event - The event name
     * @param data - The data to pass to the callback
     */
    emit<T extends keyof ClackEvents<TValue>>(event: T, ...data: Parameters<ClackEvents<TValue>[T]>): void;
    prompt(): Promise<symbol | TValue | undefined>;
    protected _isActionKey(char: string | undefined, _key: Key): boolean;
    protected _setValue(value: TValue | undefined): void;
    protected _setUserInput(value: string | undefined, write?: boolean): void;
    protected _clearUserInput(): void;
    private onKeypress;
    protected close(): void;
    private restoreCursor;
    private render;
}

interface OptionLike$1 {
    value: unknown;
    label?: string;
}
type FilterFunction<T extends OptionLike$1> = (search: string, opt: T) => boolean;
interface AutocompleteOptions<T extends OptionLike$1> extends PromptOptions<T['value'] | T['value'][], AutocompletePrompt<T>> {
    options: T[] | ((this: AutocompletePrompt<T>) => T[]);
    filter?: FilterFunction<T>;
    multiple?: boolean;
}
declare class AutocompletePrompt<T extends OptionLike$1> extends Prompt<T['value'] | T['value'][]> {
    #private;
    filteredOptions: T[];
    multiple: boolean;
    isNavigating: boolean;
    selectedValues: Array<T['value']>;
    focusedValue: T['value'] | undefined;
    get cursor(): number;
    get userInputWithCursor(): string;
    get options(): T[];
    constructor(opts: AutocompleteOptions<T>);
    protected _isActionKey(char: string | undefined, key: Key): boolean;
    deselectAll(): void;
    toggleSelected(value: T['value']): void;
}

interface ConfirmOptions extends PromptOptions<boolean, ConfirmPrompt> {
    active: string;
    inactive: string;
    initialValue?: boolean;
}
declare class ConfirmPrompt extends Prompt<boolean> {
    get cursor(): 0 | 1;
    private get _value();
    constructor(opts: ConfirmOptions);
}

interface GroupMultiSelectOptions<T extends {
    value: any;
}> extends PromptOptions<T['value'][], GroupMultiSelectPrompt<T>> {
    options: Record<string, T[]>;
    initialValues?: T['value'][];
    required?: boolean;
    cursorAt?: T['value'];
    selectableGroups?: boolean;
}
declare class GroupMultiSelectPrompt<T extends {
    value: any;
}> extends Prompt<T['value'][]> {
    #private;
    options: (T & {
        group: string | boolean;
    })[];
    cursor: number;
    getGroupItems(group: string): T[];
    isGroupSelected(group: string): boolean;
    private toggleValue;
    constructor(opts: GroupMultiSelectOptions<T>);
}

interface OptionLike {
    value: any;
    disabled?: boolean;
}
interface MultiSelectOptions<T extends OptionLike> extends PromptOptions<T['value'][], MultiSelectPrompt<T>> {
    options: T[];
    initialValues?: T['value'][];
    required?: boolean;
    cursorAt?: T['value'];
}
declare class MultiSelectPrompt<T extends OptionLike> extends Prompt<T['value'][]> {
    options: T[];
    cursor: number;
    private get _value();
    private get _enabledOptions();
    private toggleAll;
    private toggleInvert;
    private toggleValue;
    constructor(opts: MultiSelectOptions<T>);
}

interface PasswordOptions extends PromptOptions<string, PasswordPrompt> {
    mask?: string;
}
declare class PasswordPrompt extends Prompt<string> {
    private _mask;
    get cursor(): number;
    get masked(): string;
    get userInputWithCursor(): string;
    clear(): void;
    constructor({ mask, ...opts }: PasswordOptions);
}

interface SelectOptions<T extends {
    value: any;
    disabled?: boolean;
}> extends PromptOptions<T['value'], SelectPrompt<T>> {
    options: T[];
    initialValue?: T['value'];
}
declare class SelectPrompt<T extends {
    value: any;
    disabled?: boolean;
}> extends Prompt<T['value']> {
    options: T[];
    cursor: number;
    private get _selectedValue();
    private changeValue;
    constructor(opts: SelectOptions<T>);
}

interface SelectKeyOptions<T extends {
    value: string;
}> extends PromptOptions<T['value'], SelectKeyPrompt<T>> {
    options: T[];
}
declare class SelectKeyPrompt<T extends {
    value: string;
}> extends Prompt<T['value']> {
    options: T[];
    cursor: number;
    constructor(opts: SelectKeyOptions<T>);
}

interface TextOptions extends PromptOptions<string, TextPrompt> {
    placeholder?: string;
    defaultValue?: string;
}
declare class TextPrompt extends Prompt<string> {
    get userInputWithCursor(): string;
    get cursor(): number;
    constructor(opts: TextOptions);
}

declare function isCancel(value: unknown): value is symbol;
interface BlockOptions {
    input?: Readable;
    output?: Writable;
    overwrite?: boolean;
    hideCursor?: boolean;
}
declare function block({ input, output, overwrite, hideCursor, }?: BlockOptions): () => void;
declare const getColumns: (output: Writable) => number;
declare const getRows: (output: Writable) => number;

export { AutocompletePrompt, ConfirmPrompt, GroupMultiSelectPrompt, MultiSelectPrompt, PasswordPrompt, Prompt, SelectKeyPrompt, SelectPrompt, TextPrompt, block, getColumns, getRows, isCancel, settings, updateSettings };
export type { ClackSettings, ClackState as State };
