"use strict";
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Copyright The LanceDB Authors
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingFunctionRegistry = void 0;
exports.register = register;
exports.getRegistry = getRegistry;
require("reflect-metadata");
/**
 * This is a singleton class used to register embedding functions
 * and fetch them by name. It also handles serializing and deserializing.
 * You can implement your own embedding function by subclassing EmbeddingFunction
 * or TextEmbeddingFunction and registering it with the registry
 */
class EmbeddingFunctionRegistry {
    #functions = new Map();
    #variables = new Map();
    /**
     * Get the number of registered functions
     */
    length() {
        return this.#functions.size;
    }
    /**
     * Register an embedding function
     * @throws Error if the function is already registered
     */
    register(alias) {
        const self = this;
        return function (ctor) {
            if (!alias) {
                alias = ctor.name;
            }
            if (self.#functions.has(alias)) {
                throw new Error(`Embedding function with alias "${alias}" already exists`);
            }
            self.#functions.set(alias, ctor);
            Reflect.defineMetadata("lancedb::embedding::name", alias, ctor);
            return ctor;
        };
    }
    /**
     * Fetch an embedding function by name
     * @param name The name of the function
     */
    get(name) {
        const factory = this.#functions.get(name);
        if (!factory) {
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            return undefined;
        }
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        let create;
        if (factory.prototype.init) {
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            create = async function (options) {
                const instance = new factory(options);
                await instance.init();
                return instance;
            };
        }
        else {
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            create = (options) => new factory(options);
        }
        return {
            create,
        };
    }
    /**
     * reset the registry to the initial state
     */
    reset() {
        this.#functions.clear();
    }
    /**
     * @ignore
     */
    async parseFunctions(metadata) {
        if (!metadata.has("embedding_functions")) {
            return new Map();
        }
        else {
            const functions = (JSON.parse(metadata.get("embedding_functions")));
            const items = await Promise.all(functions.map(async (f) => {
                const fn = this.get(f.name);
                if (!fn) {
                    throw new Error(`Function "${f.name}" not found in registry`);
                }
                const func = await this.get(f.name).create(f.model);
                return [
                    f.name,
                    {
                        sourceColumn: f.sourceColumn,
                        vectorColumn: f.vectorColumn,
                        function: func,
                    },
                ];
            }));
            return new Map(items);
        }
    }
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    functionToMetadata(conf) {
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        const metadata = {};
        const name = Reflect.getMetadata("lancedb::embedding::name", conf.function.constructor);
        metadata["sourceColumn"] = conf.sourceColumn;
        metadata["vectorColumn"] = conf.vectorColumn ?? "vector";
        metadata["name"] = name ?? conf.function.constructor.name;
        metadata["model"] = conf.function.toJSON();
        return metadata;
    }
    getTableMetadata(functions) {
        const metadata = new Map();
        const jsonData = functions.map((conf) => this.functionToMetadata(conf));
        metadata.set("embedding_functions", JSON.stringify(jsonData));
        return metadata;
    }
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
    setVar(name, value) {
        if (name.includes(":")) {
            throw new Error("Variable names cannot contain colons");
        }
        this.#variables.set(name, value);
    }
    /**
     * Get a variable.
     * @param name
     * @returns
     * @see {@link setVar}
     */
    getVar(name) {
        return this.#variables.get(name);
    }
}
exports.EmbeddingFunctionRegistry = EmbeddingFunctionRegistry;
const _REGISTRY = new EmbeddingFunctionRegistry();
function register(name) {
    return _REGISTRY.register(name);
}
/**
 * Utility function to get the global instance of the registry
 * @returns `EmbeddingFunctionRegistry` The global instance of the registry
 * @example
 * ```ts
 * const registry = getRegistry();
 * const openai = registry.get("openai").create();
 */
function getRegistry() {
    return _REGISTRY;
}
