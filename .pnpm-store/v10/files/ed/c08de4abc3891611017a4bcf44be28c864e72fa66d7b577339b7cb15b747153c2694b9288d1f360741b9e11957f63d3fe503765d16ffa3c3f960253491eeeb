import type { JSONSchema } from "@apidevtools/json-schema-ref-parser/dist/lib/types";
import type { ParserOptions } from "@apidevtools/json-schema-ref-parser/dist/lib/options";
type InputSchema = JSONSchema;
type ProcessorFunction<T> = (schema: T) => void;
type IVocabulary = Record<string, any>;
interface Options {
    cloneSchema?: boolean;
    dereference?: boolean;
    dereferenceOptions?: ParserOptions | undefined;
}
export declare class Walker<T extends InputSchema = InputSchema> {
    rootSchema: T;
    vocabulary: IVocabulary;
    vocabularies: Record<string, IVocabulary>;
    walker: ProcessorFunction<T>;
    constructor();
    loadSchema: (schema: T, options?: Options) => Promise<void>;
    walk: (processor: ProcessorFunction<T>, vocabulary: IVocabulary) => Promise<void>;
    private cleanupVisited;
    private isValidSubSchema;
    private applyUserProcessor;
    private subschemaWalk;
    private processSchemaKey;
    private processObjectOfSchemas;
    private processArrayOfSchemas;
    private processSingleOrArrayOfSchemas;
    private processSingleSchema;
    /**
     * Loop over the links and apply the callbacks, while
     * handling LDO keyword deletions by catching NEXT_LDO_KEYWORD.
     */
    private getProcessLinks;
    private initVocabulary;
}
export {};
