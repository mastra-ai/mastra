import "reflect-metadata";
import { DataType, Float, type IntoVector } from "../arrow";
/**
 * Options for a given embedding function
 */
export interface FunctionOptions {
    [key: string]: any;
}
export interface EmbeddingFunctionConstructor<T extends EmbeddingFunction = EmbeddingFunction> {
    new (modelOptions?: T["TOptions"]): T;
}
/**
 * An embedding function that automatically creates vector representation for a given column.
 *
 * It's important subclasses pass the **original** options to the super constructor
 * and then pass those options to `resolveVariables` to resolve any variables before
 * using them.
 *
 * @example
 * ```ts
 * class MyEmbeddingFunction extends EmbeddingFunction {
 *   constructor(options: {model: string, timeout: number}) {
 *     super(optionsRaw);
 *     const options = this.resolveVariables(optionsRaw);
 *     this.model = options.model;
 *     this.timeout = options.timeout;
 *   }
 * }
 * ```
 */
export declare abstract class EmbeddingFunction<T = any, M extends FunctionOptions = FunctionOptions> {
    #private;
    /**
     * @ignore
     *  This is only used for associating the options type with the class for type checking
     */
    readonly TOptions: M;
    /**
     * Get the original arguments to the constructor, to serialize them so they
     * can be used to recreate the embedding function later.
     */
    toJSON(): Record<string, any>;
    constructor();
    /**
     * Provide a list of keys in the function options that should be treated as
     * sensitive. If users pass raw values for these keys, they will be rejected.
     */
    protected getSensitiveKeys(): string[];
    /**
     * Apply variables to the config.
     */
    protected resolveVariables(config: Partial<M>): Partial<M>;
    /**
     * Optionally load any resources needed for the embedding function.
     *
     * This method is called after the embedding function has been initialized
     * but before any embeddings are computed. It is useful for loading local models
     * or other resources that are needed for the embedding function to work.
     */
    init?(): Promise<void>;
    /**
     * sourceField is used in combination with `LanceSchema` to provide a declarative data model
     *
     * @param optionsOrDatatype - The options for the field or the datatype
     *
     * @see {@link LanceSchema}
     */
    sourceField(optionsOrDatatype: Partial<FieldOptions> | DataType): [DataType, Map<string, EmbeddingFunction>];
    /**
     * vectorField is used in combination with `LanceSchema` to provide a declarative data model
     *
     * @param optionsOrDatatype - The options for the field
     *
     * @see {@link LanceSchema}
     */
    vectorField(optionsOrDatatype?: Partial<FieldOptions> | DataType): [DataType, Map<string, EmbeddingFunction>];
    /** The number of dimensions of the embeddings */
    ndims(): number | undefined;
    /** The datatype of the embeddings */
    abstract embeddingDataType(): Float;
    /**
     * Creates a vector representation for the given values.
     */
    abstract computeSourceEmbeddings(data: T[]): Promise<number[][] | Float32Array[] | Float64Array[]>;
    /**
    Compute the embeddings for a single query
   */
    computeQueryEmbeddings(data: T): Promise<Awaited<IntoVector>>;
}
/**
 * an abstract class for implementing embedding functions that take text as input
 */
export declare abstract class TextEmbeddingFunction<M extends FunctionOptions = FunctionOptions> extends EmbeddingFunction<string, M> {
    abstract generateEmbeddings(texts: string[], ...args: any[]): Promise<number[][] | Float32Array[] | Float64Array[]>;
    computeQueryEmbeddings(data: string): Promise<Awaited<IntoVector>>;
    embeddingDataType(): Float;
    sourceField(): [DataType, Map<string, EmbeddingFunction>];
    computeSourceEmbeddings(data: string[]): Promise<number[][] | Float32Array[] | Float64Array[]>;
}
export interface FieldOptions<T extends DataType = DataType> {
    datatype: T;
    dims?: number;
}
