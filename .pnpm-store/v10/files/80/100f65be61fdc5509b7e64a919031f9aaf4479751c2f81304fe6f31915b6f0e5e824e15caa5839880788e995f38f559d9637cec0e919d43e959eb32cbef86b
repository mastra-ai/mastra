import { CommandParser } from '../client/parser';
import { SimpleStringReply, RedisArgument } from '../RESP/types';
type SingleParameter = [parameter: RedisArgument, value: RedisArgument];
type MultipleParameters = [config: Record<string, RedisArgument>];
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Sets configuration parameters to the specified values
     * @param parser - The Redis command parser
     * @param parameterOrConfig - Either a single parameter name or a configuration object
     * @param value - Value for the parameter (when using single parameter format)
     */
    readonly parseCommand: (this: void, parser: CommandParser, ...[parameterOrConfig, value]: SingleParameter | MultipleParameters) => void;
    readonly transformReply: () => SimpleStringReply;
};
export default _default;
//# sourceMappingURL=CONFIG_SET.d.ts.map