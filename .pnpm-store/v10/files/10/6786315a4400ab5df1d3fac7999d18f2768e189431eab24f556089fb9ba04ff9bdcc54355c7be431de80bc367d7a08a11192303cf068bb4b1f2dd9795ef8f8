import type { Credentials, RepoDesignation } from "../types/public";
import type { SetRequired } from "../vendor/type-fest/set-required";
export declare const SAFETENSORS_FILE = "model.safetensors";
export declare const SAFETENSORS_INDEX_FILE = "model.safetensors.index.json";
export declare const RE_SAFETENSORS_FILE: RegExp;
export declare const RE_SAFETENSORS_INDEX_FILE: RegExp;
export declare const RE_SAFETENSORS_SHARD_FILE: RegExp;
export interface SafetensorsShardFileInfo {
    prefix: string;
    basePrefix: string;
    shard: string;
    total: string;
}
export declare function parseSafetensorsShardFilename(filename: string): SafetensorsShardFileInfo | null;
type FileName = string;
export type TensorName = string;
export type Dtype = "F64" | "F32" | "F16" | "BF16" | "I64" | "I32" | "I16" | "I8" | "U8" | "BOOL";
export interface TensorInfo {
    dtype: Dtype;
    shape: number[];
    data_offsets: [number, number];
}
export type SafetensorsFileHeader = Record<TensorName, TensorInfo> & {
    __metadata__: Record<string, string>;
};
export interface SafetensorsIndexJson {
    dtype?: string;
    metadata?: Record<string, string>;
    weight_map: Record<TensorName, FileName>;
}
export type SafetensorsShardedHeaders = Record<FileName, SafetensorsFileHeader>;
export type SafetensorsParseFromRepo = {
    sharded: false;
    header: SafetensorsFileHeader;
    parameterCount?: Partial<Record<Dtype, number>>;
} | {
    sharded: true;
    index: SafetensorsIndexJson;
    headers: SafetensorsShardedHeaders;
    parameterCount?: Partial<Record<Dtype, number>>;
};
/**
 * Analyze model.safetensors.index.json or model.safetensors from a model hosted
 * on Hugging Face using smart range requests to extract its metadata.
 */
export declare function parseSafetensorsMetadata(params: {
    /** Only models are supported */
    repo: RepoDesignation;
    /**
     * Relative file path to safetensors file inside `repo`. Defaults to `SAFETENSORS_FILE` or `SAFETENSORS_INDEX_FILE` (whichever one exists).
     */
    path?: string;
    /**
     * Will include SafetensorsParseFromRepo["parameterCount"], an object containing the number of parameters for each DType
     *
     * @default false
     */
    computeParametersCount: true;
    hubUrl?: string;
    credentials?: Credentials;
    revision?: string;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
}): Promise<SetRequired<SafetensorsParseFromRepo, "parameterCount">>;
export declare function parseSafetensorsMetadata(params: {
    /** Only models are supported */
    repo: RepoDesignation;
    /**
     * Will include SafetensorsParseFromRepo["parameterCount"], an object containing the number of parameters for each DType
     *
     * @default false
     */
    path?: string;
    computeParametersCount?: boolean;
    hubUrl?: string;
    credentials?: Credentials;
    revision?: string;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
}): Promise<SafetensorsParseFromRepo>;
export {};
//# sourceMappingURL=parse-safetensors-metadata.d.ts.map