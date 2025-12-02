import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, SimpleStringReply } from '@redis/client/dist/lib/RESP/types';
import { RedisVariadicArgument } from '@redis/client/dist/lib/commands/generic-transformers';
export declare const SCHEMA_FIELD_TYPE: {
    readonly TEXT: "TEXT";
    readonly NUMERIC: "NUMERIC";
    readonly GEO: "GEO";
    readonly TAG: "TAG";
    readonly VECTOR: "VECTOR";
    readonly GEOSHAPE: "GEOSHAPE";
};
export type SchemaFieldType = typeof SCHEMA_FIELD_TYPE[keyof typeof SCHEMA_FIELD_TYPE];
interface SchemaField<T extends SchemaFieldType = SchemaFieldType> {
    type: T;
    AS?: RedisArgument;
    INDEXMISSING?: boolean;
}
interface SchemaCommonField<T extends SchemaFieldType = SchemaFieldType> extends SchemaField<T> {
    SORTABLE?: boolean | 'UNF';
    NOINDEX?: boolean;
}
export declare const SCHEMA_TEXT_FIELD_PHONETIC: {
    readonly DM_EN: "dm:en";
    readonly DM_FR: "dm:fr";
    readonly FM_PT: "dm:pt";
    readonly DM_ES: "dm:es";
};
export type SchemaTextFieldPhonetic = typeof SCHEMA_TEXT_FIELD_PHONETIC[keyof typeof SCHEMA_TEXT_FIELD_PHONETIC];
interface SchemaTextField extends SchemaCommonField<typeof SCHEMA_FIELD_TYPE['TEXT']> {
    NOSTEM?: boolean;
    WEIGHT?: number;
    PHONETIC?: SchemaTextFieldPhonetic;
    WITHSUFFIXTRIE?: boolean;
    INDEXEMPTY?: boolean;
}
interface SchemaNumericField extends SchemaCommonField<typeof SCHEMA_FIELD_TYPE['NUMERIC']> {
}
interface SchemaGeoField extends SchemaCommonField<typeof SCHEMA_FIELD_TYPE['GEO']> {
}
interface SchemaTagField extends SchemaCommonField<typeof SCHEMA_FIELD_TYPE['TAG']> {
    SEPARATOR?: RedisArgument;
    CASESENSITIVE?: boolean;
    WITHSUFFIXTRIE?: boolean;
    INDEXEMPTY?: boolean;
}
export declare const SCHEMA_VECTOR_FIELD_ALGORITHM: {
    readonly FLAT: "FLAT";
    readonly HNSW: "HNSW";
    /**
     * available since 8.2
    */
    readonly VAMANA: "SVS-VAMANA";
};
export type SchemaVectorFieldAlgorithm = typeof SCHEMA_VECTOR_FIELD_ALGORITHM[keyof typeof SCHEMA_VECTOR_FIELD_ALGORITHM];
interface SchemaVectorField extends SchemaField<typeof SCHEMA_FIELD_TYPE['VECTOR']> {
    ALGORITHM: SchemaVectorFieldAlgorithm;
    TYPE: 'FLOAT32' | 'FLOAT64' | 'BFLOAT16' | 'FLOAT16' | 'INT8' | 'UINT8';
    DIM: number;
    DISTANCE_METRIC: 'L2' | 'IP' | 'COSINE';
    INITIAL_CAP?: number;
}
interface SchemaFlatVectorField extends SchemaVectorField {
    ALGORITHM: typeof SCHEMA_VECTOR_FIELD_ALGORITHM['FLAT'];
    BLOCK_SIZE?: number;
}
interface SchemaHNSWVectorField extends SchemaVectorField {
    ALGORITHM: typeof SCHEMA_VECTOR_FIELD_ALGORITHM['HNSW'];
    M?: number;
    EF_CONSTRUCTION?: number;
    EF_RUNTIME?: number;
}
export declare const VAMANA_COMPRESSION_ALGORITHM: {
    readonly LVQ4: "LVQ4";
    readonly LVQ8: "LVQ8";
    readonly LVQ4x4: "LVQ4x4";
    readonly LVQ4x8: "LVQ4x8";
    readonly LeanVec4x8: "LeanVec4x8";
    readonly LeanVec8x8: "LeanVec8x8";
};
export type VamanaCompressionAlgorithm = typeof VAMANA_COMPRESSION_ALGORITHM[keyof typeof VAMANA_COMPRESSION_ALGORITHM];
interface SchemaVAMANAVectorField extends SchemaVectorField {
    ALGORITHM: typeof SCHEMA_VECTOR_FIELD_ALGORITHM['VAMANA'];
    TYPE: 'FLOAT16' | 'FLOAT32';
    COMPRESSION?: VamanaCompressionAlgorithm;
    CONSTRUCTION_WINDOW_SIZE?: number;
    GRAPH_MAX_DEGREE?: number;
    SEARCH_WINDOW_SIZE?: number;
    EPSILON?: number;
    /**
     * applicable only with COMPRESSION
     */
    TRAINING_THRESHOLD?: number;
    /**
     * applicable only with LeanVec COMPRESSION
     */
    REDUCE?: number;
}
export declare const SCHEMA_GEO_SHAPE_COORD_SYSTEM: {
    readonly SPHERICAL: "SPHERICAL";
    readonly FLAT: "FLAT";
};
export type SchemaGeoShapeFieldCoordSystem = typeof SCHEMA_GEO_SHAPE_COORD_SYSTEM[keyof typeof SCHEMA_GEO_SHAPE_COORD_SYSTEM];
interface SchemaGeoShapeField extends SchemaField<typeof SCHEMA_FIELD_TYPE['GEOSHAPE']> {
    COORD_SYSTEM?: SchemaGeoShapeFieldCoordSystem;
}
export interface RediSearchSchema {
    [field: string]: (SchemaTextField | SchemaNumericField | SchemaGeoField | SchemaTagField | SchemaFlatVectorField | SchemaHNSWVectorField | SchemaVAMANAVectorField | SchemaGeoShapeField | SchemaFieldType);
}
export declare function parseSchema(parser: CommandParser, schema: RediSearchSchema): void;
export declare const REDISEARCH_LANGUAGE: {
    readonly ARABIC: "Arabic";
    readonly BASQUE: "Basque";
    readonly CATALANA: "Catalan";
    readonly DANISH: "Danish";
    readonly DUTCH: "Dutch";
    readonly ENGLISH: "English";
    readonly FINNISH: "Finnish";
    readonly FRENCH: "French";
    readonly GERMAN: "German";
    readonly GREEK: "Greek";
    readonly HUNGARIAN: "Hungarian";
    readonly INDONESAIN: "Indonesian";
    readonly IRISH: "Irish";
    readonly ITALIAN: "Italian";
    readonly LITHUANIAN: "Lithuanian";
    readonly NEPALI: "Nepali";
    readonly NORWEIGAN: "Norwegian";
    readonly PORTUGUESE: "Portuguese";
    readonly ROMANIAN: "Romanian";
    readonly RUSSIAN: "Russian";
    readonly SPANISH: "Spanish";
    readonly SWEDISH: "Swedish";
    readonly TAMIL: "Tamil";
    readonly TURKISH: "Turkish";
    readonly CHINESE: "Chinese";
};
export type RediSearchLanguage = typeof REDISEARCH_LANGUAGE[keyof typeof REDISEARCH_LANGUAGE];
export type RediSearchProperty = `${'@' | '$.'}${string}`;
export interface CreateOptions {
    ON?: 'HASH' | 'JSON';
    PREFIX?: RedisVariadicArgument;
    FILTER?: RedisArgument;
    LANGUAGE?: RediSearchLanguage;
    LANGUAGE_FIELD?: RediSearchProperty;
    SCORE?: number;
    SCORE_FIELD?: RediSearchProperty;
    MAXTEXTFIELDS?: boolean;
    TEMPORARY?: number;
    NOOFFSETS?: boolean;
    NOHL?: boolean;
    NOFIELDS?: boolean;
    NOFREQS?: boolean;
    SKIPINITIALSCAN?: boolean;
    STOPWORDS?: RedisVariadicArgument;
}
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Creates a new search index with the given schema and options.
     * @param parser - The command parser
     * @param index - Name of the index to create
     * @param schema - Index schema defining field names and types (TEXT, NUMERIC, GEO, TAG, VECTOR, GEOSHAPE)
     * @param options - Optional parameters:
     *   - ON: Type of container to index (HASH or JSON)
     *   - PREFIX: Prefixes for document keys to index
     *   - FILTER: Expression that filters indexed documents
     *   - LANGUAGE/LANGUAGE_FIELD: Default language for indexing
     *   - SCORE/SCORE_FIELD: Document ranking parameters
     *   - MAXTEXTFIELDS: Index all text fields without specifying them
     *   - TEMPORARY: Create a temporary index
     *   - NOOFFSETS/NOHL/NOFIELDS/NOFREQS: Index optimization flags
     *   - STOPWORDS: Custom stopword list
     */
    readonly parseCommand: (this: void, parser: CommandParser, index: RedisArgument, schema: RediSearchSchema, options?: CreateOptions) => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=CREATE.d.ts.map