type OptionType = 'string' | 'boolean' | 'number' | 'positional';
type OutputType = string | boolean | number | undefined;
type BuilderConfig<TType extends OptionType = OptionType> = {
    name?: string | undefined;
    aliases: string[];
    type: TType;
    description?: string;
    default?: OutputType;
    isHidden?: boolean;
    isRequired?: boolean;
    isInt?: boolean;
    minVal?: number;
    maxVal?: number;
    enumVals?: [string, ...string[]];
};
type ProcessedBuilderConfig = {
    name: string;
    aliases: string[];
    type: OptionType;
    description?: string;
    default?: OutputType;
    isHidden?: boolean;
    isRequired?: boolean;
    isInt?: boolean;
    minVal?: number;
    maxVal?: number;
    enumVals?: [string, ...string[]];
};
type BuilderConfigLimited = BuilderConfig & {
    type: Exclude<OptionType, 'positional'>;
};
declare class OptionBuilderBase<TBuilderConfig extends BuilderConfig = BuilderConfig, TOutput extends OutputType = string, TOmit extends string = '', TEnums extends string | undefined = undefined> {
    _: {
        config: TBuilderConfig;
        /**
         * Type-level only field
         *
         * Do not attempt to access at a runtime
         */
        $output: TOutput;
    };
    private config;
    constructor(config?: TBuilderConfig);
    string<TName extends string>(name: TName): Omit<OptionBuilderBase<BuilderConfig<'string'>, string | undefined, TOmit | OptionType | 'min' | 'max' | 'int'>, TOmit | OptionType | 'min' | 'max' | 'int'>;
    string(): Omit<OptionBuilderBase<BuilderConfig<'string'>, string | undefined, TOmit | OptionType | 'min' | 'max' | 'int'>, TOmit | OptionType | 'min' | 'max' | 'int'>;
    number<TName extends string>(name: TName): Omit<OptionBuilderBase<BuilderConfig<'number'>, number | undefined, TOmit | OptionType | 'enum'>, TOmit | OptionType | 'enum'>;
    number(): Omit<OptionBuilderBase<BuilderConfig<'number'>, string | undefined, TOmit | OptionType | 'enum'>, TOmit | OptionType | 'enum'>;
    boolean<TName extends string>(name: TName): Omit<OptionBuilderBase<BuilderConfig<'boolean'>, boolean | undefined, TOmit | OptionType | 'min' | 'max' | 'enum' | 'int'>, TOmit | OptionType | 'min' | 'max' | 'enum' | 'int'>;
    boolean(): Omit<OptionBuilderBase<BuilderConfig<'boolean'>, boolean | undefined, TOmit | OptionType | 'min' | 'max' | 'enum' | 'int'>, TOmit | OptionType | 'min' | 'max' | 'enum' | 'int'>;
    positional<TName extends string>(displayName: TName): Omit<OptionBuilderBase<BuilderConfig<'positional'>, string | undefined, TOmit | OptionType | 'min' | 'max' | 'int' | 'alias'>, TOmit | OptionType | 'min' | 'max' | 'int' | 'alias'>;
    positional(): Omit<OptionBuilderBase<BuilderConfig<'positional'>, string | undefined, TOmit | OptionType | 'min' | 'max' | 'int' | 'alias'>, TOmit | OptionType | 'min' | 'max' | 'int' | 'alias'>;
    alias(...aliases: string[]): Omit<OptionBuilderBase<TBuilderConfig, TOutput, TOmit | 'alias'>, TOmit | 'alias'>;
    desc<TDescription extends string>(description: TDescription): Omit<OptionBuilderBase<TBuilderConfig, TOutput, TOmit | 'desc'>, TOmit | 'desc'>;
    hidden(): Omit<OptionBuilderBase<TBuilderConfig, TOutput, TOmit | 'hidden'>, TOmit | 'hidden'>;
    required(): Omit<OptionBuilderBase<TBuilderConfig, Exclude<TOutput, undefined>, TOmit | 'required' | 'default'>, TOmit | 'required' | 'default'>;
    default<TDefVal extends TEnums extends undefined ? Exclude<TOutput, undefined> : TEnums>(value: TDefVal): Omit<OptionBuilderBase<TBuilderConfig, Exclude<TOutput, undefined>, TOmit | 'enum' | 'required' | 'default', TEnums>, TOmit | 'enum' | 'required' | 'default'>;
    enum<TValues extends [string, ...string[]], TUnion extends TValues[number] = TValues[number]>(...values: TValues): Omit<OptionBuilderBase<TBuilderConfig, TUnion | (TOutput extends undefined ? undefined : never), TOmit | 'enum', TUnion>, TOmit | 'enum'>;
    min(value: number): Omit<OptionBuilderBase<TBuilderConfig, TOutput, TOmit | 'min'>, TOmit | 'min'>;
    max(value: number): Omit<OptionBuilderBase<TBuilderConfig, TOutput, TOmit | 'max'>, TOmit | 'max'>;
    int(): Omit<OptionBuilderBase<TBuilderConfig, TOutput, TOmit | 'int'>, TOmit | 'int'>;
}
type GenericBuilderInternalsFields = {
    /**
     * Type-level only field
     *
     * Do not attempt to access at a runtime
     */
    $output: OutputType;
    config: BuilderConfig;
};
type GenericBuilderInternals = {
    _: GenericBuilderInternalsFields;
};
type GenericBuilderInternalsFieldsLimited = {
    /**
     * Type-level only field
     *
     * Do not attempt to access at a runtime
     */
    $output: OutputType;
    config: BuilderConfigLimited;
};
type GenericBuilderInternalsLimited = {
    _: GenericBuilderInternalsFieldsLimited;
};
type ProcessedOptions<TOptionConfig extends Record<string, GenericBuilderInternals> = Record<string, GenericBuilderInternals>> = {
    [K in keyof TOptionConfig]: K extends string ? {
        config: ProcessedBuilderConfig;
        /**
         * Type-level only field
         *
         * Do not attempt to access at a runtime
         */
        $output: TOptionConfig[K]['_']['$output'];
    } : never;
};
type Simplify<T> = {
    [K in keyof T]: T[K];
} & {};
type TypeOf<TOptions extends Record<string, GenericBuilderInternals>> = Simplify<{
    [K in keyof TOptions]: TOptions[K]['_']['$output'];
}>;
declare function string<TName extends string>(name: TName): Omit<OptionBuilderBase<BuilderConfig<'string'>, string | undefined, OptionType | 'min' | 'max' | 'int'>, OptionType | 'min' | 'max' | 'int'>;
declare function string(): Omit<OptionBuilderBase<BuilderConfig<'string'>, string | undefined, OptionType | 'min' | 'max' | 'int'>, OptionType | 'min' | 'max' | 'int'>;
declare function number<TName extends string>(name: TName): Omit<OptionBuilderBase<BuilderConfig<'number'>, number | undefined, OptionType | 'enum'>, OptionType | 'enum'>;
declare function number(): Omit<OptionBuilderBase<BuilderConfig<'number'>, number | undefined, OptionType | 'enum'>, OptionType | 'enum'>;
declare function boolean<TName extends string>(name: TName): Omit<OptionBuilderBase<BuilderConfig<'boolean'>, boolean | undefined, OptionType | 'min' | 'max' | 'int' | 'enum'>, OptionType | 'min' | 'max' | 'int' | 'enum'>;
declare function boolean(): Omit<OptionBuilderBase<BuilderConfig<'boolean'>, boolean | undefined, OptionType | 'min' | 'max' | 'int' | 'enum'>, OptionType | 'min' | 'max' | 'int' | 'enum'>;
declare function positional<TName extends string>(displayName: TName): Omit<OptionBuilderBase<BuilderConfig<'positional'>, string | undefined, OptionType | 'min' | 'max' | 'int' | 'alias'>, OptionType | 'min' | 'max' | 'int' | 'alias'>;
declare function positional(): Omit<OptionBuilderBase<BuilderConfig<'positional'>, string | undefined, OptionType | 'min' | 'max' | 'int' | 'alias'>, OptionType | 'min' | 'max' | 'int' | 'alias'>;

type CommandHandler<TOpts extends Record<string, GenericBuilderInternals> | undefined = Record<string, GenericBuilderInternals> | undefined> = (options: TOpts extends Record<string, GenericBuilderInternals> ? TypeOf<TOpts> : undefined) => any;
type CommandInfo = {
    name: string;
    aliases?: [string, ...string[]];
    desc?: string;
    shortDesc?: string;
    hidden?: boolean;
    options?: Record<string, ProcessedBuilderConfig>;
    metadata?: any;
    subcommands?: CommandsInfo;
};
type CommandsInfo = Record<string, CommandInfo>;
type EventType = 'before' | 'after';
type BroCliConfig = {
    name?: string;
    description?: string;
    argSource?: string[];
    help?: string | Function;
    version?: string | Function;
    omitKeysOfUndefinedOptions?: boolean;
    hook?: (event: EventType, command: Command) => any;
    theme?: EventHandler;
};
type GenericCommandHandler = (options?: Record<string, OutputType> | undefined) => any;
type RawCommand<TOpts extends Record<string, GenericBuilderInternals> | undefined = Record<string, GenericBuilderInternals> | undefined, TOptsData = TOpts extends Record<string, GenericBuilderInternals> ? TypeOf<TOpts> : undefined, TTransformed = TOptsData extends undefined ? undefined : TOptsData> = {
    name?: string;
    aliases?: [string, ...string[]];
    desc?: string;
    shortDesc?: string;
    hidden?: boolean;
    options?: TOpts;
    help?: string | Function;
    transform?: (options: TOptsData) => TTransformed;
    handler?: (options: Awaited<TTransformed>) => any;
    subcommands?: [Command, ...Command[]];
    metadata?: any;
};
type AnyRawCommand<TOpts extends Record<string, GenericBuilderInternals> | undefined = Record<string, GenericBuilderInternals> | undefined> = {
    name?: string;
    aliases?: [string, ...string[]];
    desc?: string;
    shortDesc?: string;
    hidden?: boolean;
    options?: TOpts;
    help?: string | Function;
    transform?: GenericCommandHandler;
    handler?: GenericCommandHandler;
    subcommands?: [Command, ...Command[]];
    metadata?: any;
};
type Command<TOptsType = any, TTransformedType = any> = {
    name: string;
    aliases?: [string, ...string[]];
    desc?: string;
    shortDesc?: string;
    hidden?: boolean;
    options?: ProcessedOptions;
    help?: string | Function;
    transform?: GenericCommandHandler;
    handler?: GenericCommandHandler;
    subcommands?: [Command, ...Command[]];
    parent?: Command;
    metadata?: any;
};
type CommandCandidate = {
    data: string;
    originalIndex: number;
};
type InnerCommandParseRes = {
    command: Command | undefined;
    args: string[];
};
type TestResult<THandlerInput> = {
    type: 'handler';
    options: THandlerInput;
} | {
    type: 'help' | 'version';
} | {
    type: 'error';
    error: unknown;
};
declare const command: <TOpts extends Record<string, GenericBuilderInternals> | undefined, TOptsData = TOpts extends Record<string, GenericBuilderInternals> ? { [K_1 in keyof { [K in keyof TOpts]: TOpts[K]["_"]["$output"]; }]: { [K in keyof TOpts]: TOpts[K]["_"]["$output"]; }[K_1]; } : undefined, TTransformed = TOptsData>(command: RawCommand<TOpts, TOptsData, TTransformed>) => Command<TOptsData, Awaited<TTransformed>>;
declare const getCommandNameWithParents: (command: Command) => string;
/**
 * Runs CLI commands
 *
 * @param commands - command collection
 *
 * @param config - additional settings
 */
declare const run: (commands: Command[], config?: BroCliConfig) => Promise<void>;
declare const handler: <TOpts extends Record<string, GenericBuilderInternals>>(options: TOpts, handler: CommandHandler<TOpts>) => CommandHandler<TOpts>;
declare const test: <TOpts, THandlerInput>(command: Command<TOpts, THandlerInput>, args: string) => Promise<TestResult<THandlerInput>>;
declare const commandsInfo: (commands: Command[]) => CommandsInfo;

type CommandHelpEvent = {
    type: 'command_help';
    name: string | undefined;
    description: string | undefined;
    command: Command;
};
type GlobalHelpEvent = {
    type: 'global_help';
    description: string | undefined;
    name: string | undefined;
    commands: Command[];
};
type MissingArgsEvent = {
    type: 'error';
    violation: 'missing_args_error';
    name: string | undefined;
    description: string | undefined;
    command: Command;
    missing: [string[], ...string[][]];
};
type UnrecognizedArgsEvent = {
    type: 'error';
    violation: 'unrecognized_args_error';
    name: string | undefined;
    description: string | undefined;
    command: Command;
    unrecognized: [string, ...string[]];
};
type UnknownCommandEvent = {
    type: 'error';
    violation: 'unknown_command_error';
    name: string | undefined;
    description: string | undefined;
    commands: Command[];
    offender: string;
};
type UnknownSubcommandEvent = {
    type: 'error';
    violation: 'unknown_subcommand_error';
    name: string | undefined;
    description: string | undefined;
    command: Command;
    offender: string;
};
type UnknownErrorEvent = {
    type: 'error';
    violation: 'unknown_error';
    name: string | undefined;
    description: string | undefined;
    error: unknown;
};
type VersionEvent = {
    type: 'version';
    name: string | undefined;
    description: string | undefined;
};
type GenericValidationViolation = 'above_max' | 'below_min' | 'expected_int' | 'invalid_boolean_syntax' | 'invalid_string_syntax' | 'invalid_number_syntax' | 'invalid_number_value' | 'enum_violation';
type ValidationViolation = BroCliEvent extends infer Event ? Event extends {
    violation: string;
} ? Event['violation'] : never : never;
type ValidationErrorEvent = {
    type: 'error';
    violation: GenericValidationViolation;
    name: string | undefined;
    description: string | undefined;
    command: Command;
    option: ProcessedBuilderConfig;
    offender: {
        namePart?: string;
        dataPart?: string;
    };
};
type BroCliEvent = CommandHelpEvent | GlobalHelpEvent | MissingArgsEvent | UnrecognizedArgsEvent | UnknownCommandEvent | UnknownSubcommandEvent | ValidationErrorEvent | VersionEvent | UnknownErrorEvent;
type BroCliEventType = BroCliEvent['type'];
/**
 * Return `true` if your handler processes the event
 *
 * Return `false` to process event with a built-in handler
 */
type EventHandler = (event: BroCliEvent) => boolean | Promise<boolean>;

/**
 * Internal error class used to bypass runCli's logging without stack trace
 *
 * Used only for malformed commands and options
 */
declare class BroCliError extends Error {
    event?: BroCliEvent | undefined;
    constructor(message: string | undefined, event?: BroCliEvent | undefined);
}

export { type AnyRawCommand, type BroCliConfig, BroCliError, type BroCliEvent, type BroCliEventType, type BuilderConfig, type BuilderConfigLimited, type Command, type CommandCandidate, type CommandHandler, type CommandHelpEvent, type CommandInfo, type CommandsInfo, type EventHandler, type EventType, type GenericBuilderInternals, type GenericBuilderInternalsFields, type GenericBuilderInternalsFieldsLimited, type GenericBuilderInternalsLimited, type GenericCommandHandler, type GenericValidationViolation, type GlobalHelpEvent, type InnerCommandParseRes, type MissingArgsEvent, OptionBuilderBase, type OptionType, type OutputType, type ProcessedBuilderConfig, type ProcessedOptions, type RawCommand, type Simplify, type TestResult, type TypeOf, type UnknownCommandEvent, type UnknownErrorEvent, type UnknownSubcommandEvent, type UnrecognizedArgsEvent, type ValidationErrorEvent, type ValidationViolation, type VersionEvent, boolean, command, commandsInfo, getCommandNameWithParents, handler, number, positional, run, string, test };
