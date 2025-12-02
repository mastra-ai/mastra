import { z } from "zod";
import { Identifier, Reference } from "./types.js";
export declare const componentArgumentValidator: z.ZodObject<{
    type: z.ZodLiteral<"value">;
    value: z.ZodString;
}, "passthrough", z.ZodTypeAny, {
    type: "value";
    value: string;
}, {
    type: "value";
    value: string;
}>;
export declare const componentDefinitionType: z.ZodUnion<[z.ZodObject<{
    type: z.ZodLiteral<"app">;
}, "passthrough", z.ZodTypeAny, {
    type: "app";
}, {
    type: "app";
}>, z.ZodObject<{
    type: z.ZodLiteral<"childComponent">;
    name: z.ZodString;
    args: z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodObject<{
        type: z.ZodLiteral<"value">;
        value: z.ZodString;
    }, "passthrough", z.ZodTypeAny, {
        type: "value";
        value: string;
    }, {
        type: "value";
        value: string;
    }>], null>, "many">;
}, "passthrough", z.ZodTypeAny, {
    type: "childComponent";
    name: string;
    args: [string, {
        type: "value";
        value: string;
    }][];
}, {
    type: "childComponent";
    name: string;
    args: [string, {
        type: "value";
        value: string;
    }][];
}>]>;
export declare const componentArgument: z.ZodObject<{
    type: z.ZodLiteral<"value">;
    value: z.ZodString;
}, "passthrough", z.ZodTypeAny, {
    type: "value";
    value: string;
}, {
    type: "value";
    value: string;
}>;
export declare const componentInstantiation: z.ZodObject<{
    name: z.ZodString;
    path: z.ZodString;
    args: z.ZodNullable<z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodObject<{
        type: z.ZodLiteral<"value">;
        value: z.ZodString;
    }, "passthrough", z.ZodTypeAny, {
        type: "value";
        value: string;
    }, {
        type: "value";
        value: string;
    }>], null>, "many">>;
}, "passthrough", z.ZodTypeAny, {
    name: string;
    args: [string, {
        type: "value";
        value: string;
    }][] | null;
    path: string;
}, {
    name: string;
    args: [string, {
        type: "value";
        value: string;
    }][] | null;
    path: string;
}>;
export type ComponentExports = {
    type: "leaf";
    leaf: Reference;
} | {
    type: "branch";
    branch: [Identifier, ComponentExports][];
};
export declare const componentExports: z.ZodType<ComponentExports>;
export declare const componentDefinitionMetadata: z.ZodObject<{
    path: z.ZodString;
    definitionType: z.ZodUnion<[z.ZodObject<{
        type: z.ZodLiteral<"app">;
    }, "passthrough", z.ZodTypeAny, {
        type: "app";
    }, {
        type: "app";
    }>, z.ZodObject<{
        type: z.ZodLiteral<"childComponent">;
        name: z.ZodString;
        args: z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodObject<{
            type: z.ZodLiteral<"value">;
            value: z.ZodString;
        }, "passthrough", z.ZodTypeAny, {
            type: "value";
            value: string;
        }, {
            type: "value";
            value: string;
        }>], null>, "many">;
    }, "passthrough", z.ZodTypeAny, {
        type: "childComponent";
        name: string;
        args: [string, {
            type: "value";
            value: string;
        }][];
    }, {
        type: "childComponent";
        name: string;
        args: [string, {
            type: "value";
            value: string;
        }][];
    }>]>;
    childComponents: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        path: z.ZodString;
        args: z.ZodNullable<z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodObject<{
            type: z.ZodLiteral<"value">;
            value: z.ZodString;
        }, "passthrough", z.ZodTypeAny, {
            type: "value";
            value: string;
        }, {
            type: "value";
            value: string;
        }>], null>, "many">>;
    }, "passthrough", z.ZodTypeAny, {
        name: string;
        args: [string, {
            type: "value";
            value: string;
        }][] | null;
        path: string;
    }, {
        name: string;
        args: [string, {
            type: "value";
            value: string;
        }][] | null;
        path: string;
    }>, "many">;
    httpMounts: z.ZodRecord<z.ZodString, z.ZodString>;
    exports: z.ZodObject<{
        type: z.ZodLiteral<"branch">;
        branch: z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodType<ComponentExports, z.ZodTypeDef, ComponentExports>], null>, "many">;
    }, "passthrough", z.ZodTypeAny, {
        type: "branch";
        branch: [string, ComponentExports][];
    }, {
        type: "branch";
        branch: [string, ComponentExports][];
    }>;
}, "passthrough", z.ZodTypeAny, {
    path: string;
    childComponents: {
        name: string;
        args: [string, {
            type: "value";
            value: string;
        }][] | null;
        path: string;
    }[];
    exports: {
        type: "branch";
        branch: [string, ComponentExports][];
    };
    definitionType: {
        type: "app";
    } | {
        type: "childComponent";
        name: string;
        args: [string, {
            type: "value";
            value: string;
        }][];
    };
    httpMounts: Record<string, string>;
}, {
    path: string;
    childComponents: {
        name: string;
        args: [string, {
            type: "value";
            value: string;
        }][] | null;
        path: string;
    }[];
    exports: {
        type: "branch";
        branch: [string, ComponentExports][];
    };
    definitionType: {
        type: "app";
    } | {
        type: "childComponent";
        name: string;
        args: [string, {
            type: "value";
            value: string;
        }][];
    };
    httpMounts: Record<string, string>;
}>;
export declare const indexSchema: z.ZodObject<{
    indexDescriptor: z.ZodString;
    fields: z.ZodArray<z.ZodString, "many">;
}, "passthrough", z.ZodTypeAny, {
    fields: string[];
    indexDescriptor: string;
}, {
    fields: string[];
    indexDescriptor: string;
}>;
export declare const vectorIndexSchema: z.ZodObject<{
    indexDescriptor: z.ZodString;
    vectorField: z.ZodString;
    dimensions: z.ZodOptional<z.ZodNumber>;
    filterFields: z.ZodArray<z.ZodString, "many">;
}, "passthrough", z.ZodTypeAny, {
    filterFields: string[];
    vectorField: string;
    indexDescriptor: string;
    dimensions?: number | undefined;
}, {
    filterFields: string[];
    vectorField: string;
    indexDescriptor: string;
    dimensions?: number | undefined;
}>;
export declare const searchIndexSchema: z.ZodObject<{
    indexDescriptor: z.ZodString;
    searchField: z.ZodString;
    filterFields: z.ZodArray<z.ZodString, "many">;
}, "passthrough", z.ZodTypeAny, {
    searchField: string;
    filterFields: string[];
    indexDescriptor: string;
}, {
    searchField: string;
    filterFields: string[];
    indexDescriptor: string;
}>;
export declare const tableDefinition: z.ZodObject<{
    tableName: z.ZodString;
    indexes: z.ZodArray<z.ZodObject<{
        indexDescriptor: z.ZodString;
        fields: z.ZodArray<z.ZodString, "many">;
    }, "passthrough", z.ZodTypeAny, {
        fields: string[];
        indexDescriptor: string;
    }, {
        fields: string[];
        indexDescriptor: string;
    }>, "many">;
    searchIndexes: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodObject<{
        indexDescriptor: z.ZodString;
        searchField: z.ZodString;
        filterFields: z.ZodArray<z.ZodString, "many">;
    }, "passthrough", z.ZodTypeAny, {
        searchField: string;
        filterFields: string[];
        indexDescriptor: string;
    }, {
        searchField: string;
        filterFields: string[];
        indexDescriptor: string;
    }>, "many">>>;
    vectorIndexes: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodObject<{
        indexDescriptor: z.ZodString;
        vectorField: z.ZodString;
        dimensions: z.ZodOptional<z.ZodNumber>;
        filterFields: z.ZodArray<z.ZodString, "many">;
    }, "passthrough", z.ZodTypeAny, {
        filterFields: string[];
        vectorField: string;
        indexDescriptor: string;
        dimensions?: number | undefined;
    }, {
        filterFields: string[];
        vectorField: string;
        indexDescriptor: string;
        dimensions?: number | undefined;
    }>, "many">>>;
    documentType: z.ZodType<import("./validator.js").ConvexValidator, z.ZodTypeDef, import("./validator.js").ConvexValidator>;
}, "passthrough", z.ZodTypeAny, {
    tableName: string;
    indexes: {
        fields: string[];
        indexDescriptor: string;
    }[];
    documentType: import("./validator.js").ConvexValidator;
    searchIndexes?: {
        searchField: string;
        filterFields: string[];
        indexDescriptor: string;
    }[] | null | undefined;
    vectorIndexes?: {
        filterFields: string[];
        vectorField: string;
        indexDescriptor: string;
        dimensions?: number | undefined;
    }[] | null | undefined;
}, {
    tableName: string;
    indexes: {
        fields: string[];
        indexDescriptor: string;
    }[];
    documentType: import("./validator.js").ConvexValidator;
    searchIndexes?: {
        searchField: string;
        filterFields: string[];
        indexDescriptor: string;
    }[] | null | undefined;
    vectorIndexes?: {
        filterFields: string[];
        vectorField: string;
        indexDescriptor: string;
        dimensions?: number | undefined;
    }[] | null | undefined;
}>;
export type TableDefinition = z.infer<typeof tableDefinition>;
export declare const analyzedSchema: z.ZodObject<{
    tables: z.ZodArray<z.ZodObject<{
        tableName: z.ZodString;
        indexes: z.ZodArray<z.ZodObject<{
            indexDescriptor: z.ZodString;
            fields: z.ZodArray<z.ZodString, "many">;
        }, "passthrough", z.ZodTypeAny, {
            fields: string[];
            indexDescriptor: string;
        }, {
            fields: string[];
            indexDescriptor: string;
        }>, "many">;
        searchIndexes: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodObject<{
            indexDescriptor: z.ZodString;
            searchField: z.ZodString;
            filterFields: z.ZodArray<z.ZodString, "many">;
        }, "passthrough", z.ZodTypeAny, {
            searchField: string;
            filterFields: string[];
            indexDescriptor: string;
        }, {
            searchField: string;
            filterFields: string[];
            indexDescriptor: string;
        }>, "many">>>;
        vectorIndexes: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodObject<{
            indexDescriptor: z.ZodString;
            vectorField: z.ZodString;
            dimensions: z.ZodOptional<z.ZodNumber>;
            filterFields: z.ZodArray<z.ZodString, "many">;
        }, "passthrough", z.ZodTypeAny, {
            filterFields: string[];
            vectorField: string;
            indexDescriptor: string;
            dimensions?: number | undefined;
        }, {
            filterFields: string[];
            vectorField: string;
            indexDescriptor: string;
            dimensions?: number | undefined;
        }>, "many">>>;
        documentType: z.ZodType<import("./validator.js").ConvexValidator, z.ZodTypeDef, import("./validator.js").ConvexValidator>;
    }, "passthrough", z.ZodTypeAny, {
        tableName: string;
        indexes: {
            fields: string[];
            indexDescriptor: string;
        }[];
        documentType: import("./validator.js").ConvexValidator;
        searchIndexes?: {
            searchField: string;
            filterFields: string[];
            indexDescriptor: string;
        }[] | null | undefined;
        vectorIndexes?: {
            filterFields: string[];
            vectorField: string;
            indexDescriptor: string;
            dimensions?: number | undefined;
        }[] | null | undefined;
    }, {
        tableName: string;
        indexes: {
            fields: string[];
            indexDescriptor: string;
        }[];
        documentType: import("./validator.js").ConvexValidator;
        searchIndexes?: {
            searchField: string;
            filterFields: string[];
            indexDescriptor: string;
        }[] | null | undefined;
        vectorIndexes?: {
            filterFields: string[];
            vectorField: string;
            indexDescriptor: string;
            dimensions?: number | undefined;
        }[] | null | undefined;
    }>, "many">;
    schemaValidation: z.ZodBoolean;
}, "passthrough", z.ZodTypeAny, {
    schemaValidation: boolean;
    tables: {
        tableName: string;
        indexes: {
            fields: string[];
            indexDescriptor: string;
        }[];
        documentType: import("./validator.js").ConvexValidator;
        searchIndexes?: {
            searchField: string;
            filterFields: string[];
            indexDescriptor: string;
        }[] | null | undefined;
        vectorIndexes?: {
            filterFields: string[];
            vectorField: string;
            indexDescriptor: string;
            dimensions?: number | undefined;
        }[] | null | undefined;
    }[];
}, {
    schemaValidation: boolean;
    tables: {
        tableName: string;
        indexes: {
            fields: string[];
            indexDescriptor: string;
        }[];
        documentType: import("./validator.js").ConvexValidator;
        searchIndexes?: {
            searchField: string;
            filterFields: string[];
            indexDescriptor: string;
        }[] | null | undefined;
        vectorIndexes?: {
            filterFields: string[];
            vectorField: string;
            indexDescriptor: string;
            dimensions?: number | undefined;
        }[] | null | undefined;
    }[];
}>;
export type AnalyzedSchema = z.infer<typeof analyzedSchema>;
export declare const evaluatedComponentDefinition: z.ZodObject<{
    definition: z.ZodObject<{
        path: z.ZodString;
        definitionType: z.ZodUnion<[z.ZodObject<{
            type: z.ZodLiteral<"app">;
        }, "passthrough", z.ZodTypeAny, {
            type: "app";
        }, {
            type: "app";
        }>, z.ZodObject<{
            type: z.ZodLiteral<"childComponent">;
            name: z.ZodString;
            args: z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodObject<{
                type: z.ZodLiteral<"value">;
                value: z.ZodString;
            }, "passthrough", z.ZodTypeAny, {
                type: "value";
                value: string;
            }, {
                type: "value";
                value: string;
            }>], null>, "many">;
        }, "passthrough", z.ZodTypeAny, {
            type: "childComponent";
            name: string;
            args: [string, {
                type: "value";
                value: string;
            }][];
        }, {
            type: "childComponent";
            name: string;
            args: [string, {
                type: "value";
                value: string;
            }][];
        }>]>;
        childComponents: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            path: z.ZodString;
            args: z.ZodNullable<z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodObject<{
                type: z.ZodLiteral<"value">;
                value: z.ZodString;
            }, "passthrough", z.ZodTypeAny, {
                type: "value";
                value: string;
            }, {
                type: "value";
                value: string;
            }>], null>, "many">>;
        }, "passthrough", z.ZodTypeAny, {
            name: string;
            args: [string, {
                type: "value";
                value: string;
            }][] | null;
            path: string;
        }, {
            name: string;
            args: [string, {
                type: "value";
                value: string;
            }][] | null;
            path: string;
        }>, "many">;
        httpMounts: z.ZodRecord<z.ZodString, z.ZodString>;
        exports: z.ZodObject<{
            type: z.ZodLiteral<"branch">;
            branch: z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodType<ComponentExports, z.ZodTypeDef, ComponentExports>], null>, "many">;
        }, "passthrough", z.ZodTypeAny, {
            type: "branch";
            branch: [string, ComponentExports][];
        }, {
            type: "branch";
            branch: [string, ComponentExports][];
        }>;
    }, "passthrough", z.ZodTypeAny, {
        path: string;
        childComponents: {
            name: string;
            args: [string, {
                type: "value";
                value: string;
            }][] | null;
            path: string;
        }[];
        exports: {
            type: "branch";
            branch: [string, ComponentExports][];
        };
        definitionType: {
            type: "app";
        } | {
            type: "childComponent";
            name: string;
            args: [string, {
                type: "value";
                value: string;
            }][];
        };
        httpMounts: Record<string, string>;
    }, {
        path: string;
        childComponents: {
            name: string;
            args: [string, {
                type: "value";
                value: string;
            }][] | null;
            path: string;
        }[];
        exports: {
            type: "branch";
            branch: [string, ComponentExports][];
        };
        definitionType: {
            type: "app";
        } | {
            type: "childComponent";
            name: string;
            args: [string, {
                type: "value";
                value: string;
            }][];
        };
        httpMounts: Record<string, string>;
    }>;
    schema: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        tables: z.ZodArray<z.ZodObject<{
            tableName: z.ZodString;
            indexes: z.ZodArray<z.ZodObject<{
                indexDescriptor: z.ZodString;
                fields: z.ZodArray<z.ZodString, "many">;
            }, "passthrough", z.ZodTypeAny, {
                fields: string[];
                indexDescriptor: string;
            }, {
                fields: string[];
                indexDescriptor: string;
            }>, "many">;
            searchIndexes: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodObject<{
                indexDescriptor: z.ZodString;
                searchField: z.ZodString;
                filterFields: z.ZodArray<z.ZodString, "many">;
            }, "passthrough", z.ZodTypeAny, {
                searchField: string;
                filterFields: string[];
                indexDescriptor: string;
            }, {
                searchField: string;
                filterFields: string[];
                indexDescriptor: string;
            }>, "many">>>;
            vectorIndexes: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodObject<{
                indexDescriptor: z.ZodString;
                vectorField: z.ZodString;
                dimensions: z.ZodOptional<z.ZodNumber>;
                filterFields: z.ZodArray<z.ZodString, "many">;
            }, "passthrough", z.ZodTypeAny, {
                filterFields: string[];
                vectorField: string;
                indexDescriptor: string;
                dimensions?: number | undefined;
            }, {
                filterFields: string[];
                vectorField: string;
                indexDescriptor: string;
                dimensions?: number | undefined;
            }>, "many">>>;
            documentType: z.ZodType<import("./validator.js").ConvexValidator, z.ZodTypeDef, import("./validator.js").ConvexValidator>;
        }, "passthrough", z.ZodTypeAny, {
            tableName: string;
            indexes: {
                fields: string[];
                indexDescriptor: string;
            }[];
            documentType: import("./validator.js").ConvexValidator;
            searchIndexes?: {
                searchField: string;
                filterFields: string[];
                indexDescriptor: string;
            }[] | null | undefined;
            vectorIndexes?: {
                filterFields: string[];
                vectorField: string;
                indexDescriptor: string;
                dimensions?: number | undefined;
            }[] | null | undefined;
        }, {
            tableName: string;
            indexes: {
                fields: string[];
                indexDescriptor: string;
            }[];
            documentType: import("./validator.js").ConvexValidator;
            searchIndexes?: {
                searchField: string;
                filterFields: string[];
                indexDescriptor: string;
            }[] | null | undefined;
            vectorIndexes?: {
                filterFields: string[];
                vectorField: string;
                indexDescriptor: string;
                dimensions?: number | undefined;
            }[] | null | undefined;
        }>, "many">;
        schemaValidation: z.ZodBoolean;
    }, "passthrough", z.ZodTypeAny, {
        schemaValidation: boolean;
        tables: {
            tableName: string;
            indexes: {
                fields: string[];
                indexDescriptor: string;
            }[];
            documentType: import("./validator.js").ConvexValidator;
            searchIndexes?: {
                searchField: string;
                filterFields: string[];
                indexDescriptor: string;
            }[] | null | undefined;
            vectorIndexes?: {
                filterFields: string[];
                vectorField: string;
                indexDescriptor: string;
                dimensions?: number | undefined;
            }[] | null | undefined;
        }[];
    }, {
        schemaValidation: boolean;
        tables: {
            tableName: string;
            indexes: {
                fields: string[];
                indexDescriptor: string;
            }[];
            documentType: import("./validator.js").ConvexValidator;
            searchIndexes?: {
                searchField: string;
                filterFields: string[];
                indexDescriptor: string;
            }[] | null | undefined;
            vectorIndexes?: {
                filterFields: string[];
                vectorField: string;
                indexDescriptor: string;
                dimensions?: number | undefined;
            }[] | null | undefined;
        }[];
    }>>>;
    functions: z.ZodRecord<z.ZodString, z.ZodObject<{
        functions: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            pos: z.ZodAny;
            udfType: z.ZodUnion<[z.ZodLiteral<"Query">, z.ZodLiteral<"Mutation">, z.ZodLiteral<"Action">]>;
            visibility: z.ZodNullable<z.ZodUnion<[z.ZodObject<{
                kind: z.ZodLiteral<"public">;
            }, "passthrough", z.ZodTypeAny, {
                kind: "public";
            }, {
                kind: "public";
            }>, z.ZodObject<{
                kind: z.ZodLiteral<"internal">;
            }, "passthrough", z.ZodTypeAny, {
                kind: "internal";
            }, {
                kind: "internal";
            }>]>>;
            args: z.ZodNullable<z.ZodString>;
            returns: z.ZodNullable<z.ZodString>;
        }, "passthrough", z.ZodTypeAny, {
            name: string;
            args: string | null;
            returns: string | null;
            udfType: "Mutation" | "Action" | "Query";
            visibility: {
                kind: "public";
            } | {
                kind: "internal";
            } | null;
            pos?: any;
        }, {
            name: string;
            args: string | null;
            returns: string | null;
            udfType: "Mutation" | "Action" | "Query";
            visibility: {
                kind: "public";
            } | {
                kind: "internal";
            } | null;
            pos?: any;
        }>, "many">;
        httpRoutes: z.ZodAny;
        cronSpecs: z.ZodAny;
        sourceMapped: z.ZodAny;
    }, "passthrough", z.ZodTypeAny, {
        functions: {
            name: string;
            args: string | null;
            returns: string | null;
            udfType: "Mutation" | "Action" | "Query";
            visibility: {
                kind: "public";
            } | {
                kind: "internal";
            } | null;
            pos?: any;
        }[];
        httpRoutes?: any;
        cronSpecs?: any;
        sourceMapped?: any;
    }, {
        functions: {
            name: string;
            args: string | null;
            returns: string | null;
            udfType: "Mutation" | "Action" | "Query";
            visibility: {
                kind: "public";
            } | {
                kind: "internal";
            } | null;
            pos?: any;
        }[];
        httpRoutes?: any;
        cronSpecs?: any;
        sourceMapped?: any;
    }>>;
    udfConfig: z.ZodObject<{
        serverVersion: z.ZodString;
        importPhaseRngSeed: z.ZodAny;
        importPhaseUnixTimestamp: z.ZodAny;
    }, "passthrough", z.ZodTypeAny, {
        serverVersion: string;
        importPhaseRngSeed?: any;
        importPhaseUnixTimestamp?: any;
    }, {
        serverVersion: string;
        importPhaseRngSeed?: any;
        importPhaseUnixTimestamp?: any;
    }>;
}, "passthrough", z.ZodTypeAny, {
    definition: {
        path: string;
        childComponents: {
            name: string;
            args: [string, {
                type: "value";
                value: string;
            }][] | null;
            path: string;
        }[];
        exports: {
            type: "branch";
            branch: [string, ComponentExports][];
        };
        definitionType: {
            type: "app";
        } | {
            type: "childComponent";
            name: string;
            args: [string, {
                type: "value";
                value: string;
            }][];
        };
        httpMounts: Record<string, string>;
    };
    functions: Record<string, {
        functions: {
            name: string;
            args: string | null;
            returns: string | null;
            udfType: "Mutation" | "Action" | "Query";
            visibility: {
                kind: "public";
            } | {
                kind: "internal";
            } | null;
            pos?: any;
        }[];
        httpRoutes?: any;
        cronSpecs?: any;
        sourceMapped?: any;
    }>;
    udfConfig: {
        serverVersion: string;
        importPhaseRngSeed?: any;
        importPhaseUnixTimestamp?: any;
    };
    schema?: {
        schemaValidation: boolean;
        tables: {
            tableName: string;
            indexes: {
                fields: string[];
                indexDescriptor: string;
            }[];
            documentType: import("./validator.js").ConvexValidator;
            searchIndexes?: {
                searchField: string;
                filterFields: string[];
                indexDescriptor: string;
            }[] | null | undefined;
            vectorIndexes?: {
                filterFields: string[];
                vectorField: string;
                indexDescriptor: string;
                dimensions?: number | undefined;
            }[] | null | undefined;
        }[];
    } | null | undefined;
}, {
    definition: {
        path: string;
        childComponents: {
            name: string;
            args: [string, {
                type: "value";
                value: string;
            }][] | null;
            path: string;
        }[];
        exports: {
            type: "branch";
            branch: [string, ComponentExports][];
        };
        definitionType: {
            type: "app";
        } | {
            type: "childComponent";
            name: string;
            args: [string, {
                type: "value";
                value: string;
            }][];
        };
        httpMounts: Record<string, string>;
    };
    functions: Record<string, {
        functions: {
            name: string;
            args: string | null;
            returns: string | null;
            udfType: "Mutation" | "Action" | "Query";
            visibility: {
                kind: "public";
            } | {
                kind: "internal";
            } | null;
            pos?: any;
        }[];
        httpRoutes?: any;
        cronSpecs?: any;
        sourceMapped?: any;
    }>;
    udfConfig: {
        serverVersion: string;
        importPhaseRngSeed?: any;
        importPhaseUnixTimestamp?: any;
    };
    schema?: {
        schemaValidation: boolean;
        tables: {
            tableName: string;
            indexes: {
                fields: string[];
                indexDescriptor: string;
            }[];
            documentType: import("./validator.js").ConvexValidator;
            searchIndexes?: {
                searchField: string;
                filterFields: string[];
                indexDescriptor: string;
            }[] | null | undefined;
            vectorIndexes?: {
                filterFields: string[];
                vectorField: string;
                indexDescriptor: string;
                dimensions?: number | undefined;
            }[] | null | undefined;
        }[];
    } | null | undefined;
}>;
export type EvaluatedComponentDefinition = z.infer<typeof evaluatedComponentDefinition>;
//# sourceMappingURL=componentDefinition.d.ts.map