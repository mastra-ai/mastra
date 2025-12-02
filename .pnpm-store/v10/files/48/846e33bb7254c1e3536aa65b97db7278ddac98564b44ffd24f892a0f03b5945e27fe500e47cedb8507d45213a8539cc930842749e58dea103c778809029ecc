import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, SimpleStringReply } from '@redis/client/dist/lib/RESP/types';
import { RediSearchSchema } from './CREATE';
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Alters an existing RediSearch index schema by adding new fields.
     * @param parser - The command parser
     * @param index - The index to alter
     * @param schema - The schema definition containing new fields to add
     */
    readonly parseCommand: (this: void, parser: CommandParser, index: RedisArgument, schema: RediSearchSchema) => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=ALTER.d.ts.map