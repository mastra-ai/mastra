import { type EmbeddingFunction, type EmbeddingFunctionConstructor } from "./embedding_function";
import "reflect-metadata";
export type CreateReturnType<T> = T extends {
    init: () => Promise<void>;
} ? Promise<T> : T;
export interface EmbeddingFunctionCreate<T extends EmbeddingFunction> {
    create(options?: T["TOptions"]): CreateReturnType<T>;
}
/**
 * This is a singleton class used to register embedding functions
 * and fetch them by name. It also handles serializing and deserializing.
 * You can implement your own embedding function by subclassing EmbeddingFunction
 * or TextEmbeddingFunction and registering it with the registry
 */
export declare class EmbeddingFunctionRegistry {
    #private;
    /**
     * Get the number of registered functions
     */
    length(): number;
    /**
     * Register an embedding function
     * @throws Error if the function is already registered
     */
    register<T extends EmbeddingFunctionConstructor = EmbeddingFunctionConstructor>(this: EmbeddingFunctionRegistry, alias?: string): (ctor: T) => any;
    get<T extends EmbeddingFunction<unknown>>(name: string): EmbeddingFunctionCreate<T> | undefined;
    /**
     * reset the registry to the initial state
     */
    reset(this: EmbeddingFunctionRegistry): void;
    /**
     * @ignore
     */
    parseFunctions(this: EmbeddingFunctionRegistry, metadata: Map<string, string>): Promise<Map<string, EmbeddingFunctionConfig>>;
    functionToMetadata(conf: EmbeddingFunctionConfig): Record<string, any>;
    getTableMetadata(functions: EmbeddingFunctionConfig[]): Map<string, string>;
    /**
     * Set a variable. These can be accessed in the embedding function
     * configuration using the syntax `$var:variable_name`. If they are not
     * set, an error will be thrown letting you know which key is unset. If you
     * want to supply a default value, you can add an additional part in the
     * configuration like so: `$var:variable_name:default_value`. Default values
     * can be used for runtime configurations that are not sensitive, such as
     * whether to use a GPU for inference.
     *
     * The name must not contain colons. The default value can contain colons.
     *
     * @param name
     * @param value
     */
    setVar(name: string, value: string): void;
    /**
     * Get a variable.
     * @param name
     * @returns
     * @see {@link setVar}
     */
    getVar(name: string): string | undefined;
}
export declare function register(name?: string): (ctor: EmbeddingFunctionConstructor<EmbeddingFunction<any, import("./embedding_function").FunctionOptions>>) => any;
/**
 * Utility function to get the global instance of the registry
 * @returns `EmbeddingFunctionRegistry` The global instance of the registry
 * @example
 * ```ts
 * const registry = getRegistry();
 * const openai = registry.get("openai").create();
 */
export declare function getRegistry(): EmbeddingFunctionRegistry;
export interface EmbeddingFunctionConfig {
    sourceColumn: string;
    vectorColumn?: string;
    function: EmbeddingFunction;
}
