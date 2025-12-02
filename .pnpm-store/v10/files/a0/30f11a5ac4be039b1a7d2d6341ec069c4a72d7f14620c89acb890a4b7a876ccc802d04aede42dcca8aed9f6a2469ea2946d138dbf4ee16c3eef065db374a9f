import { CommandParser } from '../client/parser';
import { TuplesToMapReply, BlobStringReply, NullReply, NumberReply, MapReply } from '../RESP/types';
type RunningScript = NullReply | TuplesToMapReply<[
    [
        BlobStringReply<'name'>,
        BlobStringReply
    ],
    [
        BlobStringReply<'command'>,
        BlobStringReply
    ],
    [
        BlobStringReply<'duration_ms'>,
        NumberReply
    ]
]>;
type Engine = TuplesToMapReply<[
    [
        BlobStringReply<'libraries_count'>,
        NumberReply
    ],
    [
        BlobStringReply<'functions_count'>,
        NumberReply
    ]
]>;
type Engines = MapReply<BlobStringReply, Engine>;
type FunctionStatsReply = TuplesToMapReply<[
    [
        BlobStringReply<'running_script'>,
        RunningScript
    ],
    [
        BlobStringReply<'engines'>,
        Engines
    ]
]>;
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Returns information about the function that is currently running and information about the available execution engines
     * @param parser - The Redis command parser
     */
    readonly parseCommand: (this: void, parser: CommandParser) => void;
    readonly transformReply: {
        readonly 2: (reply: [BlobStringReply<"running_script">, NullReply | import("../RESP/types").RespType<42, [BlobStringReply<"name">, BlobStringReply<string>, BlobStringReply<"command">, BlobStringReply<string>, BlobStringReply<"duration_ms">, NumberReply<number>], never, [BlobStringReply<"name">, BlobStringReply<string>, BlobStringReply<"command">, BlobStringReply<string>, BlobStringReply<"duration_ms">, NumberReply<number>]>, BlobStringReply<"engines">, import("../RESP/types").RespType<42, (BlobStringReply<string> | import("../RESP/types").RespType<42, [BlobStringReply<"libraries_count">, NumberReply<number>, BlobStringReply<"functions_count">, NumberReply<number>], never, [BlobStringReply<"libraries_count">, NumberReply<number>, BlobStringReply<"functions_count">, NumberReply<number>]>)[], never, (BlobStringReply<string> | import("../RESP/types").RespType<42, [BlobStringReply<"libraries_count">, NumberReply<number>, BlobStringReply<"functions_count">, NumberReply<number>], never, [BlobStringReply<"libraries_count">, NumberReply<number>, BlobStringReply<"functions_count">, NumberReply<number>]>)[]>]) => {
            running_script: {
                name: BlobStringReply<string>;
                command: BlobStringReply<string>;
                duration_ms: NumberReply<number>;
            } | null;
            engines: Record<string, {
                libraries_count: NumberReply<number>;
                functions_count: NumberReply<number>;
            }>;
        };
        readonly 3: () => FunctionStatsReply;
    };
};
export default _default;
//# sourceMappingURL=FUNCTION_STATS.d.ts.map