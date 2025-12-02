import { z } from "zod";
export declare const authDiff: z.ZodObject<{
    added: z.ZodArray<z.ZodString, "many">;
    removed: z.ZodArray<z.ZodString, "many">;
}, "passthrough", z.ZodTypeAny, {
    added: string[];
    removed: string[];
}, {
    added: string[];
    removed: string[];
}>;
export type AuthDiff = z.infer<typeof authDiff>;
export declare const componentDefinitionDiff: z.ZodObject<{}, "passthrough", z.ZodTypeAny, {}, {}>;
export type ComponentDefinitionDiff = z.infer<typeof componentDefinitionDiff>;
export declare const componentDiffType: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"create">;
}, "passthrough", z.ZodTypeAny, {
    type: "create";
}, {
    type: "create";
}>, z.ZodObject<{
    type: z.ZodLiteral<"modify">;
}, "passthrough", z.ZodTypeAny, {
    type: "modify";
}, {
    type: "modify";
}>, z.ZodObject<{
    type: z.ZodLiteral<"unmount">;
}, "passthrough", z.ZodTypeAny, {
    type: "unmount";
}, {
    type: "unmount";
}>, z.ZodObject<{
    type: z.ZodLiteral<"remount">;
}, "passthrough", z.ZodTypeAny, {
    type: "remount";
}, {
    type: "remount";
}>]>;
export type ComponentDiffType = z.infer<typeof componentDiffType>;
export declare const moduleDiff: z.ZodObject<{
    added: z.ZodArray<z.ZodString, "many">;
    removed: z.ZodArray<z.ZodString, "many">;
}, "passthrough", z.ZodTypeAny, {
    added: string[];
    removed: string[];
}, {
    added: string[];
    removed: string[];
}>;
export type ModuleDiff = z.infer<typeof moduleDiff>;
export declare const udfConfigDiff: z.ZodObject<{
    previous_version: z.ZodString;
    next_version: z.ZodString;
}, "passthrough", z.ZodTypeAny, {
    previous_version: string;
    next_version: string;
}, {
    previous_version: string;
    next_version: string;
}>;
export type UdfConfigDiff = z.infer<typeof udfConfigDiff>;
export declare const cronDiff: z.ZodObject<{
    added: z.ZodArray<z.ZodString, "many">;
    updated: z.ZodArray<z.ZodString, "many">;
    deleted: z.ZodArray<z.ZodString, "many">;
}, "passthrough", z.ZodTypeAny, {
    deleted: string[];
    added: string[];
    updated: string[];
}, {
    deleted: string[];
    added: string[];
    updated: string[];
}>;
export type CronDiff = z.infer<typeof cronDiff>;
declare const developerIndexConfig: z.ZodIntersection<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    name: z.ZodString;
    type: z.ZodLiteral<"database">;
    fields: z.ZodArray<z.ZodString, "many">;
}, "passthrough", z.ZodTypeAny, {
    type: "database";
    fields: string[];
    name: string;
}, {
    type: "database";
    fields: string[];
    name: string;
}>, z.ZodObject<{
    name: z.ZodString;
    type: z.ZodLiteral<"search">;
    searchField: z.ZodString;
    filterFields: z.ZodArray<z.ZodString, "many">;
}, "passthrough", z.ZodTypeAny, {
    type: "search";
    name: string;
    searchField: string;
    filterFields: string[];
}, {
    type: "search";
    name: string;
    searchField: string;
    filterFields: string[];
}>, z.ZodObject<{
    name: z.ZodString;
    type: z.ZodLiteral<"vector">;
    dimensions: z.ZodNumber;
    vectorField: z.ZodString;
    filterFields: z.ZodArray<z.ZodString, "many">;
}, "passthrough", z.ZodTypeAny, {
    type: "vector";
    name: string;
    filterFields: string[];
    vectorField: string;
    dimensions: number;
}, {
    type: "vector";
    name: string;
    filterFields: string[];
    vectorField: string;
    dimensions: number;
}>]>, z.ZodObject<{
    staged: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    staged?: boolean | undefined;
}, {
    staged?: boolean | undefined;
}>>;
export type DeveloperIndexConfig = z.infer<typeof developerIndexConfig>;
export declare const indexDiff: z.ZodObject<{
    added_indexes: z.ZodArray<z.ZodIntersection<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        name: z.ZodString;
        type: z.ZodLiteral<"database">;
        fields: z.ZodArray<z.ZodString, "many">;
    }, "passthrough", z.ZodTypeAny, {
        type: "database";
        fields: string[];
        name: string;
    }, {
        type: "database";
        fields: string[];
        name: string;
    }>, z.ZodObject<{
        name: z.ZodString;
        type: z.ZodLiteral<"search">;
        searchField: z.ZodString;
        filterFields: z.ZodArray<z.ZodString, "many">;
    }, "passthrough", z.ZodTypeAny, {
        type: "search";
        name: string;
        searchField: string;
        filterFields: string[];
    }, {
        type: "search";
        name: string;
        searchField: string;
        filterFields: string[];
    }>, z.ZodObject<{
        name: z.ZodString;
        type: z.ZodLiteral<"vector">;
        dimensions: z.ZodNumber;
        vectorField: z.ZodString;
        filterFields: z.ZodArray<z.ZodString, "many">;
    }, "passthrough", z.ZodTypeAny, {
        type: "vector";
        name: string;
        filterFields: string[];
        vectorField: string;
        dimensions: number;
    }, {
        type: "vector";
        name: string;
        filterFields: string[];
        vectorField: string;
        dimensions: number;
    }>]>, z.ZodObject<{
        staged: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        staged?: boolean | undefined;
    }, {
        staged?: boolean | undefined;
    }>>, "many">;
    removed_indexes: z.ZodArray<z.ZodIntersection<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        name: z.ZodString;
        type: z.ZodLiteral<"database">;
        fields: z.ZodArray<z.ZodString, "many">;
    }, "passthrough", z.ZodTypeAny, {
        type: "database";
        fields: string[];
        name: string;
    }, {
        type: "database";
        fields: string[];
        name: string;
    }>, z.ZodObject<{
        name: z.ZodString;
        type: z.ZodLiteral<"search">;
        searchField: z.ZodString;
        filterFields: z.ZodArray<z.ZodString, "many">;
    }, "passthrough", z.ZodTypeAny, {
        type: "search";
        name: string;
        searchField: string;
        filterFields: string[];
    }, {
        type: "search";
        name: string;
        searchField: string;
        filterFields: string[];
    }>, z.ZodObject<{
        name: z.ZodString;
        type: z.ZodLiteral<"vector">;
        dimensions: z.ZodNumber;
        vectorField: z.ZodString;
        filterFields: z.ZodArray<z.ZodString, "many">;
    }, "passthrough", z.ZodTypeAny, {
        type: "vector";
        name: string;
        filterFields: string[];
        vectorField: string;
        dimensions: number;
    }, {
        type: "vector";
        name: string;
        filterFields: string[];
        vectorField: string;
        dimensions: number;
    }>]>, z.ZodObject<{
        staged: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        staged?: boolean | undefined;
    }, {
        staged?: boolean | undefined;
    }>>, "many">;
    enabled_indexes: z.ZodOptional<z.ZodArray<z.ZodIntersection<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        name: z.ZodString;
        type: z.ZodLiteral<"database">;
        fields: z.ZodArray<z.ZodString, "many">;
    }, "passthrough", z.ZodTypeAny, {
        type: "database";
        fields: string[];
        name: string;
    }, {
        type: "database";
        fields: string[];
        name: string;
    }>, z.ZodObject<{
        name: z.ZodString;
        type: z.ZodLiteral<"search">;
        searchField: z.ZodString;
        filterFields: z.ZodArray<z.ZodString, "many">;
    }, "passthrough", z.ZodTypeAny, {
        type: "search";
        name: string;
        searchField: string;
        filterFields: string[];
    }, {
        type: "search";
        name: string;
        searchField: string;
        filterFields: string[];
    }>, z.ZodObject<{
        name: z.ZodString;
        type: z.ZodLiteral<"vector">;
        dimensions: z.ZodNumber;
        vectorField: z.ZodString;
        filterFields: z.ZodArray<z.ZodString, "many">;
    }, "passthrough", z.ZodTypeAny, {
        type: "vector";
        name: string;
        filterFields: string[];
        vectorField: string;
        dimensions: number;
    }, {
        type: "vector";
        name: string;
        filterFields: string[];
        vectorField: string;
        dimensions: number;
    }>]>, z.ZodObject<{
        staged: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        staged?: boolean | undefined;
    }, {
        staged?: boolean | undefined;
    }>>, "many">>;
    disabled_indexes: z.ZodOptional<z.ZodArray<z.ZodIntersection<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        name: z.ZodString;
        type: z.ZodLiteral<"database">;
        fields: z.ZodArray<z.ZodString, "many">;
    }, "passthrough", z.ZodTypeAny, {
        type: "database";
        fields: string[];
        name: string;
    }, {
        type: "database";
        fields: string[];
        name: string;
    }>, z.ZodObject<{
        name: z.ZodString;
        type: z.ZodLiteral<"search">;
        searchField: z.ZodString;
        filterFields: z.ZodArray<z.ZodString, "many">;
    }, "passthrough", z.ZodTypeAny, {
        type: "search";
        name: string;
        searchField: string;
        filterFields: string[];
    }, {
        type: "search";
        name: string;
        searchField: string;
        filterFields: string[];
    }>, z.ZodObject<{
        name: z.ZodString;
        type: z.ZodLiteral<"vector">;
        dimensions: z.ZodNumber;
        vectorField: z.ZodString;
        filterFields: z.ZodArray<z.ZodString, "many">;
    }, "passthrough", z.ZodTypeAny, {
        type: "vector";
        name: string;
        filterFields: string[];
        vectorField: string;
        dimensions: number;
    }, {
        type: "vector";
        name: string;
        filterFields: string[];
        vectorField: string;
        dimensions: number;
    }>]>, z.ZodObject<{
        staged: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        staged?: boolean | undefined;
    }, {
        staged?: boolean | undefined;
    }>>, "many">>;
}, "passthrough", z.ZodTypeAny, {
    added_indexes: (({
        type: "database";
        fields: string[];
        name: string;
    } | {
        type: "search";
        name: string;
        searchField: string;
        filterFields: string[];
    } | {
        type: "vector";
        name: string;
        filterFields: string[];
        vectorField: string;
        dimensions: number;
    }) & {
        staged?: boolean | undefined;
    })[];
    removed_indexes: (({
        type: "database";
        fields: string[];
        name: string;
    } | {
        type: "search";
        name: string;
        searchField: string;
        filterFields: string[];
    } | {
        type: "vector";
        name: string;
        filterFields: string[];
        vectorField: string;
        dimensions: number;
    }) & {
        staged?: boolean | undefined;
    })[];
    enabled_indexes?: (({
        type: "database";
        fields: string[];
        name: string;
    } | {
        type: "search";
        name: string;
        searchField: string;
        filterFields: string[];
    } | {
        type: "vector";
        name: string;
        filterFields: string[];
        vectorField: string;
        dimensions: number;
    }) & {
        staged?: boolean | undefined;
    })[] | undefined;
    disabled_indexes?: (({
        type: "database";
        fields: string[];
        name: string;
    } | {
        type: "search";
        name: string;
        searchField: string;
        filterFields: string[];
    } | {
        type: "vector";
        name: string;
        filterFields: string[];
        vectorField: string;
        dimensions: number;
    }) & {
        staged?: boolean | undefined;
    })[] | undefined;
}, {
    added_indexes: (({
        type: "database";
        fields: string[];
        name: string;
    } | {
        type: "search";
        name: string;
        searchField: string;
        filterFields: string[];
    } | {
        type: "vector";
        name: string;
        filterFields: string[];
        vectorField: string;
        dimensions: number;
    }) & {
        staged?: boolean | undefined;
    })[];
    removed_indexes: (({
        type: "database";
        fields: string[];
        name: string;
    } | {
        type: "search";
        name: string;
        searchField: string;
        filterFields: string[];
    } | {
        type: "vector";
        name: string;
        filterFields: string[];
        vectorField: string;
        dimensions: number;
    }) & {
        staged?: boolean | undefined;
    })[];
    enabled_indexes?: (({
        type: "database";
        fields: string[];
        name: string;
    } | {
        type: "search";
        name: string;
        searchField: string;
        filterFields: string[];
    } | {
        type: "vector";
        name: string;
        filterFields: string[];
        vectorField: string;
        dimensions: number;
    }) & {
        staged?: boolean | undefined;
    })[] | undefined;
    disabled_indexes?: (({
        type: "database";
        fields: string[];
        name: string;
    } | {
        type: "search";
        name: string;
        searchField: string;
        filterFields: string[];
    } | {
        type: "vector";
        name: string;
        filterFields: string[];
        vectorField: string;
        dimensions: number;
    }) & {
        staged?: boolean | undefined;
    })[] | undefined;
}>;
export type IndexDiff = z.infer<typeof indexDiff>;
export declare const schemaDiff: z.ZodObject<{
    previous_schema: z.ZodNullable<z.ZodString>;
    next_schema: z.ZodNullable<z.ZodString>;
}, "passthrough", z.ZodTypeAny, {
    previous_schema: string | null;
    next_schema: string | null;
}, {
    previous_schema: string | null;
    next_schema: string | null;
}>;
export type SchemaDiff = z.infer<typeof schemaDiff>;
export declare const componentDiff: z.ZodObject<{
    diffType: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"create">;
    }, "passthrough", z.ZodTypeAny, {
        type: "create";
    }, {
        type: "create";
    }>, z.ZodObject<{
        type: z.ZodLiteral<"modify">;
    }, "passthrough", z.ZodTypeAny, {
        type: "modify";
    }, {
        type: "modify";
    }>, z.ZodObject<{
        type: z.ZodLiteral<"unmount">;
    }, "passthrough", z.ZodTypeAny, {
        type: "unmount";
    }, {
        type: "unmount";
    }>, z.ZodObject<{
        type: z.ZodLiteral<"remount">;
    }, "passthrough", z.ZodTypeAny, {
        type: "remount";
    }, {
        type: "remount";
    }>]>;
    moduleDiff: z.ZodObject<{
        added: z.ZodArray<z.ZodString, "many">;
        removed: z.ZodArray<z.ZodString, "many">;
    }, "passthrough", z.ZodTypeAny, {
        added: string[];
        removed: string[];
    }, {
        added: string[];
        removed: string[];
    }>;
    udfConfigDiff: z.ZodNullable<z.ZodObject<{
        previous_version: z.ZodString;
        next_version: z.ZodString;
    }, "passthrough", z.ZodTypeAny, {
        previous_version: string;
        next_version: string;
    }, {
        previous_version: string;
        next_version: string;
    }>>;
    cronDiff: z.ZodObject<{
        added: z.ZodArray<z.ZodString, "many">;
        updated: z.ZodArray<z.ZodString, "many">;
        deleted: z.ZodArray<z.ZodString, "many">;
    }, "passthrough", z.ZodTypeAny, {
        deleted: string[];
        added: string[];
        updated: string[];
    }, {
        deleted: string[];
        added: string[];
        updated: string[];
    }>;
    indexDiff: z.ZodObject<{
        added_indexes: z.ZodArray<z.ZodIntersection<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
            name: z.ZodString;
            type: z.ZodLiteral<"database">;
            fields: z.ZodArray<z.ZodString, "many">;
        }, "passthrough", z.ZodTypeAny, {
            type: "database";
            fields: string[];
            name: string;
        }, {
            type: "database";
            fields: string[];
            name: string;
        }>, z.ZodObject<{
            name: z.ZodString;
            type: z.ZodLiteral<"search">;
            searchField: z.ZodString;
            filterFields: z.ZodArray<z.ZodString, "many">;
        }, "passthrough", z.ZodTypeAny, {
            type: "search";
            name: string;
            searchField: string;
            filterFields: string[];
        }, {
            type: "search";
            name: string;
            searchField: string;
            filterFields: string[];
        }>, z.ZodObject<{
            name: z.ZodString;
            type: z.ZodLiteral<"vector">;
            dimensions: z.ZodNumber;
            vectorField: z.ZodString;
            filterFields: z.ZodArray<z.ZodString, "many">;
        }, "passthrough", z.ZodTypeAny, {
            type: "vector";
            name: string;
            filterFields: string[];
            vectorField: string;
            dimensions: number;
        }, {
            type: "vector";
            name: string;
            filterFields: string[];
            vectorField: string;
            dimensions: number;
        }>]>, z.ZodObject<{
            staged: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            staged?: boolean | undefined;
        }, {
            staged?: boolean | undefined;
        }>>, "many">;
        removed_indexes: z.ZodArray<z.ZodIntersection<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
            name: z.ZodString;
            type: z.ZodLiteral<"database">;
            fields: z.ZodArray<z.ZodString, "many">;
        }, "passthrough", z.ZodTypeAny, {
            type: "database";
            fields: string[];
            name: string;
        }, {
            type: "database";
            fields: string[];
            name: string;
        }>, z.ZodObject<{
            name: z.ZodString;
            type: z.ZodLiteral<"search">;
            searchField: z.ZodString;
            filterFields: z.ZodArray<z.ZodString, "many">;
        }, "passthrough", z.ZodTypeAny, {
            type: "search";
            name: string;
            searchField: string;
            filterFields: string[];
        }, {
            type: "search";
            name: string;
            searchField: string;
            filterFields: string[];
        }>, z.ZodObject<{
            name: z.ZodString;
            type: z.ZodLiteral<"vector">;
            dimensions: z.ZodNumber;
            vectorField: z.ZodString;
            filterFields: z.ZodArray<z.ZodString, "many">;
        }, "passthrough", z.ZodTypeAny, {
            type: "vector";
            name: string;
            filterFields: string[];
            vectorField: string;
            dimensions: number;
        }, {
            type: "vector";
            name: string;
            filterFields: string[];
            vectorField: string;
            dimensions: number;
        }>]>, z.ZodObject<{
            staged: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            staged?: boolean | undefined;
        }, {
            staged?: boolean | undefined;
        }>>, "many">;
        enabled_indexes: z.ZodOptional<z.ZodArray<z.ZodIntersection<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
            name: z.ZodString;
            type: z.ZodLiteral<"database">;
            fields: z.ZodArray<z.ZodString, "many">;
        }, "passthrough", z.ZodTypeAny, {
            type: "database";
            fields: string[];
            name: string;
        }, {
            type: "database";
            fields: string[];
            name: string;
        }>, z.ZodObject<{
            name: z.ZodString;
            type: z.ZodLiteral<"search">;
            searchField: z.ZodString;
            filterFields: z.ZodArray<z.ZodString, "many">;
        }, "passthrough", z.ZodTypeAny, {
            type: "search";
            name: string;
            searchField: string;
            filterFields: string[];
        }, {
            type: "search";
            name: string;
            searchField: string;
            filterFields: string[];
        }>, z.ZodObject<{
            name: z.ZodString;
            type: z.ZodLiteral<"vector">;
            dimensions: z.ZodNumber;
            vectorField: z.ZodString;
            filterFields: z.ZodArray<z.ZodString, "many">;
        }, "passthrough", z.ZodTypeAny, {
            type: "vector";
            name: string;
            filterFields: string[];
            vectorField: string;
            dimensions: number;
        }, {
            type: "vector";
            name: string;
            filterFields: string[];
            vectorField: string;
            dimensions: number;
        }>]>, z.ZodObject<{
            staged: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            staged?: boolean | undefined;
        }, {
            staged?: boolean | undefined;
        }>>, "many">>;
        disabled_indexes: z.ZodOptional<z.ZodArray<z.ZodIntersection<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
            name: z.ZodString;
            type: z.ZodLiteral<"database">;
            fields: z.ZodArray<z.ZodString, "many">;
        }, "passthrough", z.ZodTypeAny, {
            type: "database";
            fields: string[];
            name: string;
        }, {
            type: "database";
            fields: string[];
            name: string;
        }>, z.ZodObject<{
            name: z.ZodString;
            type: z.ZodLiteral<"search">;
            searchField: z.ZodString;
            filterFields: z.ZodArray<z.ZodString, "many">;
        }, "passthrough", z.ZodTypeAny, {
            type: "search";
            name: string;
            searchField: string;
            filterFields: string[];
        }, {
            type: "search";
            name: string;
            searchField: string;
            filterFields: string[];
        }>, z.ZodObject<{
            name: z.ZodString;
            type: z.ZodLiteral<"vector">;
            dimensions: z.ZodNumber;
            vectorField: z.ZodString;
            filterFields: z.ZodArray<z.ZodString, "many">;
        }, "passthrough", z.ZodTypeAny, {
            type: "vector";
            name: string;
            filterFields: string[];
            vectorField: string;
            dimensions: number;
        }, {
            type: "vector";
            name: string;
            filterFields: string[];
            vectorField: string;
            dimensions: number;
        }>]>, z.ZodObject<{
            staged: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            staged?: boolean | undefined;
        }, {
            staged?: boolean | undefined;
        }>>, "many">>;
    }, "passthrough", z.ZodTypeAny, {
        added_indexes: (({
            type: "database";
            fields: string[];
            name: string;
        } | {
            type: "search";
            name: string;
            searchField: string;
            filterFields: string[];
        } | {
            type: "vector";
            name: string;
            filterFields: string[];
            vectorField: string;
            dimensions: number;
        }) & {
            staged?: boolean | undefined;
        })[];
        removed_indexes: (({
            type: "database";
            fields: string[];
            name: string;
        } | {
            type: "search";
            name: string;
            searchField: string;
            filterFields: string[];
        } | {
            type: "vector";
            name: string;
            filterFields: string[];
            vectorField: string;
            dimensions: number;
        }) & {
            staged?: boolean | undefined;
        })[];
        enabled_indexes?: (({
            type: "database";
            fields: string[];
            name: string;
        } | {
            type: "search";
            name: string;
            searchField: string;
            filterFields: string[];
        } | {
            type: "vector";
            name: string;
            filterFields: string[];
            vectorField: string;
            dimensions: number;
        }) & {
            staged?: boolean | undefined;
        })[] | undefined;
        disabled_indexes?: (({
            type: "database";
            fields: string[];
            name: string;
        } | {
            type: "search";
            name: string;
            searchField: string;
            filterFields: string[];
        } | {
            type: "vector";
            name: string;
            filterFields: string[];
            vectorField: string;
            dimensions: number;
        }) & {
            staged?: boolean | undefined;
        })[] | undefined;
    }, {
        added_indexes: (({
            type: "database";
            fields: string[];
            name: string;
        } | {
            type: "search";
            name: string;
            searchField: string;
            filterFields: string[];
        } | {
            type: "vector";
            name: string;
            filterFields: string[];
            vectorField: string;
            dimensions: number;
        }) & {
            staged?: boolean | undefined;
        })[];
        removed_indexes: (({
            type: "database";
            fields: string[];
            name: string;
        } | {
            type: "search";
            name: string;
            searchField: string;
            filterFields: string[];
        } | {
            type: "vector";
            name: string;
            filterFields: string[];
            vectorField: string;
            dimensions: number;
        }) & {
            staged?: boolean | undefined;
        })[];
        enabled_indexes?: (({
            type: "database";
            fields: string[];
            name: string;
        } | {
            type: "search";
            name: string;
            searchField: string;
            filterFields: string[];
        } | {
            type: "vector";
            name: string;
            filterFields: string[];
            vectorField: string;
            dimensions: number;
        }) & {
            staged?: boolean | undefined;
        })[] | undefined;
        disabled_indexes?: (({
            type: "database";
            fields: string[];
            name: string;
        } | {
            type: "search";
            name: string;
            searchField: string;
            filterFields: string[];
        } | {
            type: "vector";
            name: string;
            filterFields: string[];
            vectorField: string;
            dimensions: number;
        }) & {
            staged?: boolean | undefined;
        })[] | undefined;
    }>;
    schemaDiff: z.ZodNullable<z.ZodObject<{
        previous_schema: z.ZodNullable<z.ZodString>;
        next_schema: z.ZodNullable<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, {
        previous_schema: string | null;
        next_schema: string | null;
    }, {
        previous_schema: string | null;
        next_schema: string | null;
    }>>;
}, "passthrough", z.ZodTypeAny, {
    diffType: {
        type: "create";
    } | {
        type: "modify";
    } | {
        type: "unmount";
    } | {
        type: "remount";
    };
    moduleDiff: {
        added: string[];
        removed: string[];
    };
    udfConfigDiff: {
        previous_version: string;
        next_version: string;
    } | null;
    cronDiff: {
        deleted: string[];
        added: string[];
        updated: string[];
    };
    indexDiff: {
        added_indexes: (({
            type: "database";
            fields: string[];
            name: string;
        } | {
            type: "search";
            name: string;
            searchField: string;
            filterFields: string[];
        } | {
            type: "vector";
            name: string;
            filterFields: string[];
            vectorField: string;
            dimensions: number;
        }) & {
            staged?: boolean | undefined;
        })[];
        removed_indexes: (({
            type: "database";
            fields: string[];
            name: string;
        } | {
            type: "search";
            name: string;
            searchField: string;
            filterFields: string[];
        } | {
            type: "vector";
            name: string;
            filterFields: string[];
            vectorField: string;
            dimensions: number;
        }) & {
            staged?: boolean | undefined;
        })[];
        enabled_indexes?: (({
            type: "database";
            fields: string[];
            name: string;
        } | {
            type: "search";
            name: string;
            searchField: string;
            filterFields: string[];
        } | {
            type: "vector";
            name: string;
            filterFields: string[];
            vectorField: string;
            dimensions: number;
        }) & {
            staged?: boolean | undefined;
        })[] | undefined;
        disabled_indexes?: (({
            type: "database";
            fields: string[];
            name: string;
        } | {
            type: "search";
            name: string;
            searchField: string;
            filterFields: string[];
        } | {
            type: "vector";
            name: string;
            filterFields: string[];
            vectorField: string;
            dimensions: number;
        }) & {
            staged?: boolean | undefined;
        })[] | undefined;
    };
    schemaDiff: {
        previous_schema: string | null;
        next_schema: string | null;
    } | null;
}, {
    diffType: {
        type: "create";
    } | {
        type: "modify";
    } | {
        type: "unmount";
    } | {
        type: "remount";
    };
    moduleDiff: {
        added: string[];
        removed: string[];
    };
    udfConfigDiff: {
        previous_version: string;
        next_version: string;
    } | null;
    cronDiff: {
        deleted: string[];
        added: string[];
        updated: string[];
    };
    indexDiff: {
        added_indexes: (({
            type: "database";
            fields: string[];
            name: string;
        } | {
            type: "search";
            name: string;
            searchField: string;
            filterFields: string[];
        } | {
            type: "vector";
            name: string;
            filterFields: string[];
            vectorField: string;
            dimensions: number;
        }) & {
            staged?: boolean | undefined;
        })[];
        removed_indexes: (({
            type: "database";
            fields: string[];
            name: string;
        } | {
            type: "search";
            name: string;
            searchField: string;
            filterFields: string[];
        } | {
            type: "vector";
            name: string;
            filterFields: string[];
            vectorField: string;
            dimensions: number;
        }) & {
            staged?: boolean | undefined;
        })[];
        enabled_indexes?: (({
            type: "database";
            fields: string[];
            name: string;
        } | {
            type: "search";
            name: string;
            searchField: string;
            filterFields: string[];
        } | {
            type: "vector";
            name: string;
            filterFields: string[];
            vectorField: string;
            dimensions: number;
        }) & {
            staged?: boolean | undefined;
        })[] | undefined;
        disabled_indexes?: (({
            type: "database";
            fields: string[];
            name: string;
        } | {
            type: "search";
            name: string;
            searchField: string;
            filterFields: string[];
        } | {
            type: "vector";
            name: string;
            filterFields: string[];
            vectorField: string;
            dimensions: number;
        }) & {
            staged?: boolean | undefined;
        })[] | undefined;
    };
    schemaDiff: {
        previous_schema: string | null;
        next_schema: string | null;
    } | null;
}>;
export type ComponentDiff = z.infer<typeof componentDiff>;
export declare const finishPushDiff: z.ZodObject<{
    authDiff: z.ZodObject<{
        added: z.ZodArray<z.ZodString, "many">;
        removed: z.ZodArray<z.ZodString, "many">;
    }, "passthrough", z.ZodTypeAny, {
        added: string[];
        removed: string[];
    }, {
        added: string[];
        removed: string[];
    }>;
    definitionDiffs: z.ZodRecord<z.ZodString, z.ZodObject<{}, "passthrough", z.ZodTypeAny, {}, {}>>;
    componentDiffs: z.ZodRecord<z.ZodString, z.ZodObject<{
        diffType: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
            type: z.ZodLiteral<"create">;
        }, "passthrough", z.ZodTypeAny, {
            type: "create";
        }, {
            type: "create";
        }>, z.ZodObject<{
            type: z.ZodLiteral<"modify">;
        }, "passthrough", z.ZodTypeAny, {
            type: "modify";
        }, {
            type: "modify";
        }>, z.ZodObject<{
            type: z.ZodLiteral<"unmount">;
        }, "passthrough", z.ZodTypeAny, {
            type: "unmount";
        }, {
            type: "unmount";
        }>, z.ZodObject<{
            type: z.ZodLiteral<"remount">;
        }, "passthrough", z.ZodTypeAny, {
            type: "remount";
        }, {
            type: "remount";
        }>]>;
        moduleDiff: z.ZodObject<{
            added: z.ZodArray<z.ZodString, "many">;
            removed: z.ZodArray<z.ZodString, "many">;
        }, "passthrough", z.ZodTypeAny, {
            added: string[];
            removed: string[];
        }, {
            added: string[];
            removed: string[];
        }>;
        udfConfigDiff: z.ZodNullable<z.ZodObject<{
            previous_version: z.ZodString;
            next_version: z.ZodString;
        }, "passthrough", z.ZodTypeAny, {
            previous_version: string;
            next_version: string;
        }, {
            previous_version: string;
            next_version: string;
        }>>;
        cronDiff: z.ZodObject<{
            added: z.ZodArray<z.ZodString, "many">;
            updated: z.ZodArray<z.ZodString, "many">;
            deleted: z.ZodArray<z.ZodString, "many">;
        }, "passthrough", z.ZodTypeAny, {
            deleted: string[];
            added: string[];
            updated: string[];
        }, {
            deleted: string[];
            added: string[];
            updated: string[];
        }>;
        indexDiff: z.ZodObject<{
            added_indexes: z.ZodArray<z.ZodIntersection<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                name: z.ZodString;
                type: z.ZodLiteral<"database">;
                fields: z.ZodArray<z.ZodString, "many">;
            }, "passthrough", z.ZodTypeAny, {
                type: "database";
                fields: string[];
                name: string;
            }, {
                type: "database";
                fields: string[];
                name: string;
            }>, z.ZodObject<{
                name: z.ZodString;
                type: z.ZodLiteral<"search">;
                searchField: z.ZodString;
                filterFields: z.ZodArray<z.ZodString, "many">;
            }, "passthrough", z.ZodTypeAny, {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            }, {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            }>, z.ZodObject<{
                name: z.ZodString;
                type: z.ZodLiteral<"vector">;
                dimensions: z.ZodNumber;
                vectorField: z.ZodString;
                filterFields: z.ZodArray<z.ZodString, "many">;
            }, "passthrough", z.ZodTypeAny, {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }, {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }>]>, z.ZodObject<{
                staged: z.ZodOptional<z.ZodBoolean>;
            }, "strip", z.ZodTypeAny, {
                staged?: boolean | undefined;
            }, {
                staged?: boolean | undefined;
            }>>, "many">;
            removed_indexes: z.ZodArray<z.ZodIntersection<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                name: z.ZodString;
                type: z.ZodLiteral<"database">;
                fields: z.ZodArray<z.ZodString, "many">;
            }, "passthrough", z.ZodTypeAny, {
                type: "database";
                fields: string[];
                name: string;
            }, {
                type: "database";
                fields: string[];
                name: string;
            }>, z.ZodObject<{
                name: z.ZodString;
                type: z.ZodLiteral<"search">;
                searchField: z.ZodString;
                filterFields: z.ZodArray<z.ZodString, "many">;
            }, "passthrough", z.ZodTypeAny, {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            }, {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            }>, z.ZodObject<{
                name: z.ZodString;
                type: z.ZodLiteral<"vector">;
                dimensions: z.ZodNumber;
                vectorField: z.ZodString;
                filterFields: z.ZodArray<z.ZodString, "many">;
            }, "passthrough", z.ZodTypeAny, {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }, {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }>]>, z.ZodObject<{
                staged: z.ZodOptional<z.ZodBoolean>;
            }, "strip", z.ZodTypeAny, {
                staged?: boolean | undefined;
            }, {
                staged?: boolean | undefined;
            }>>, "many">;
            enabled_indexes: z.ZodOptional<z.ZodArray<z.ZodIntersection<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                name: z.ZodString;
                type: z.ZodLiteral<"database">;
                fields: z.ZodArray<z.ZodString, "many">;
            }, "passthrough", z.ZodTypeAny, {
                type: "database";
                fields: string[];
                name: string;
            }, {
                type: "database";
                fields: string[];
                name: string;
            }>, z.ZodObject<{
                name: z.ZodString;
                type: z.ZodLiteral<"search">;
                searchField: z.ZodString;
                filterFields: z.ZodArray<z.ZodString, "many">;
            }, "passthrough", z.ZodTypeAny, {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            }, {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            }>, z.ZodObject<{
                name: z.ZodString;
                type: z.ZodLiteral<"vector">;
                dimensions: z.ZodNumber;
                vectorField: z.ZodString;
                filterFields: z.ZodArray<z.ZodString, "many">;
            }, "passthrough", z.ZodTypeAny, {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }, {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }>]>, z.ZodObject<{
                staged: z.ZodOptional<z.ZodBoolean>;
            }, "strip", z.ZodTypeAny, {
                staged?: boolean | undefined;
            }, {
                staged?: boolean | undefined;
            }>>, "many">>;
            disabled_indexes: z.ZodOptional<z.ZodArray<z.ZodIntersection<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                name: z.ZodString;
                type: z.ZodLiteral<"database">;
                fields: z.ZodArray<z.ZodString, "many">;
            }, "passthrough", z.ZodTypeAny, {
                type: "database";
                fields: string[];
                name: string;
            }, {
                type: "database";
                fields: string[];
                name: string;
            }>, z.ZodObject<{
                name: z.ZodString;
                type: z.ZodLiteral<"search">;
                searchField: z.ZodString;
                filterFields: z.ZodArray<z.ZodString, "many">;
            }, "passthrough", z.ZodTypeAny, {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            }, {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            }>, z.ZodObject<{
                name: z.ZodString;
                type: z.ZodLiteral<"vector">;
                dimensions: z.ZodNumber;
                vectorField: z.ZodString;
                filterFields: z.ZodArray<z.ZodString, "many">;
            }, "passthrough", z.ZodTypeAny, {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }, {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }>]>, z.ZodObject<{
                staged: z.ZodOptional<z.ZodBoolean>;
            }, "strip", z.ZodTypeAny, {
                staged?: boolean | undefined;
            }, {
                staged?: boolean | undefined;
            }>>, "many">>;
        }, "passthrough", z.ZodTypeAny, {
            added_indexes: (({
                type: "database";
                fields: string[];
                name: string;
            } | {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            } | {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }) & {
                staged?: boolean | undefined;
            })[];
            removed_indexes: (({
                type: "database";
                fields: string[];
                name: string;
            } | {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            } | {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }) & {
                staged?: boolean | undefined;
            })[];
            enabled_indexes?: (({
                type: "database";
                fields: string[];
                name: string;
            } | {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            } | {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }) & {
                staged?: boolean | undefined;
            })[] | undefined;
            disabled_indexes?: (({
                type: "database";
                fields: string[];
                name: string;
            } | {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            } | {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }) & {
                staged?: boolean | undefined;
            })[] | undefined;
        }, {
            added_indexes: (({
                type: "database";
                fields: string[];
                name: string;
            } | {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            } | {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }) & {
                staged?: boolean | undefined;
            })[];
            removed_indexes: (({
                type: "database";
                fields: string[];
                name: string;
            } | {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            } | {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }) & {
                staged?: boolean | undefined;
            })[];
            enabled_indexes?: (({
                type: "database";
                fields: string[];
                name: string;
            } | {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            } | {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }) & {
                staged?: boolean | undefined;
            })[] | undefined;
            disabled_indexes?: (({
                type: "database";
                fields: string[];
                name: string;
            } | {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            } | {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }) & {
                staged?: boolean | undefined;
            })[] | undefined;
        }>;
        schemaDiff: z.ZodNullable<z.ZodObject<{
            previous_schema: z.ZodNullable<z.ZodString>;
            next_schema: z.ZodNullable<z.ZodString>;
        }, "passthrough", z.ZodTypeAny, {
            previous_schema: string | null;
            next_schema: string | null;
        }, {
            previous_schema: string | null;
            next_schema: string | null;
        }>>;
    }, "passthrough", z.ZodTypeAny, {
        diffType: {
            type: "create";
        } | {
            type: "modify";
        } | {
            type: "unmount";
        } | {
            type: "remount";
        };
        moduleDiff: {
            added: string[];
            removed: string[];
        };
        udfConfigDiff: {
            previous_version: string;
            next_version: string;
        } | null;
        cronDiff: {
            deleted: string[];
            added: string[];
            updated: string[];
        };
        indexDiff: {
            added_indexes: (({
                type: "database";
                fields: string[];
                name: string;
            } | {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            } | {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }) & {
                staged?: boolean | undefined;
            })[];
            removed_indexes: (({
                type: "database";
                fields: string[];
                name: string;
            } | {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            } | {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }) & {
                staged?: boolean | undefined;
            })[];
            enabled_indexes?: (({
                type: "database";
                fields: string[];
                name: string;
            } | {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            } | {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }) & {
                staged?: boolean | undefined;
            })[] | undefined;
            disabled_indexes?: (({
                type: "database";
                fields: string[];
                name: string;
            } | {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            } | {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }) & {
                staged?: boolean | undefined;
            })[] | undefined;
        };
        schemaDiff: {
            previous_schema: string | null;
            next_schema: string | null;
        } | null;
    }, {
        diffType: {
            type: "create";
        } | {
            type: "modify";
        } | {
            type: "unmount";
        } | {
            type: "remount";
        };
        moduleDiff: {
            added: string[];
            removed: string[];
        };
        udfConfigDiff: {
            previous_version: string;
            next_version: string;
        } | null;
        cronDiff: {
            deleted: string[];
            added: string[];
            updated: string[];
        };
        indexDiff: {
            added_indexes: (({
                type: "database";
                fields: string[];
                name: string;
            } | {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            } | {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }) & {
                staged?: boolean | undefined;
            })[];
            removed_indexes: (({
                type: "database";
                fields: string[];
                name: string;
            } | {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            } | {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }) & {
                staged?: boolean | undefined;
            })[];
            enabled_indexes?: (({
                type: "database";
                fields: string[];
                name: string;
            } | {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            } | {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }) & {
                staged?: boolean | undefined;
            })[] | undefined;
            disabled_indexes?: (({
                type: "database";
                fields: string[];
                name: string;
            } | {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            } | {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }) & {
                staged?: boolean | undefined;
            })[] | undefined;
        };
        schemaDiff: {
            previous_schema: string | null;
            next_schema: string | null;
        } | null;
    }>>;
}, "passthrough", z.ZodTypeAny, {
    authDiff: {
        added: string[];
        removed: string[];
    };
    definitionDiffs: Record<string, {}>;
    componentDiffs: Record<string, {
        diffType: {
            type: "create";
        } | {
            type: "modify";
        } | {
            type: "unmount";
        } | {
            type: "remount";
        };
        moduleDiff: {
            added: string[];
            removed: string[];
        };
        udfConfigDiff: {
            previous_version: string;
            next_version: string;
        } | null;
        cronDiff: {
            deleted: string[];
            added: string[];
            updated: string[];
        };
        indexDiff: {
            added_indexes: (({
                type: "database";
                fields: string[];
                name: string;
            } | {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            } | {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }) & {
                staged?: boolean | undefined;
            })[];
            removed_indexes: (({
                type: "database";
                fields: string[];
                name: string;
            } | {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            } | {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }) & {
                staged?: boolean | undefined;
            })[];
            enabled_indexes?: (({
                type: "database";
                fields: string[];
                name: string;
            } | {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            } | {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }) & {
                staged?: boolean | undefined;
            })[] | undefined;
            disabled_indexes?: (({
                type: "database";
                fields: string[];
                name: string;
            } | {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            } | {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }) & {
                staged?: boolean | undefined;
            })[] | undefined;
        };
        schemaDiff: {
            previous_schema: string | null;
            next_schema: string | null;
        } | null;
    }>;
}, {
    authDiff: {
        added: string[];
        removed: string[];
    };
    definitionDiffs: Record<string, {}>;
    componentDiffs: Record<string, {
        diffType: {
            type: "create";
        } | {
            type: "modify";
        } | {
            type: "unmount";
        } | {
            type: "remount";
        };
        moduleDiff: {
            added: string[];
            removed: string[];
        };
        udfConfigDiff: {
            previous_version: string;
            next_version: string;
        } | null;
        cronDiff: {
            deleted: string[];
            added: string[];
            updated: string[];
        };
        indexDiff: {
            added_indexes: (({
                type: "database";
                fields: string[];
                name: string;
            } | {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            } | {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }) & {
                staged?: boolean | undefined;
            })[];
            removed_indexes: (({
                type: "database";
                fields: string[];
                name: string;
            } | {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            } | {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }) & {
                staged?: boolean | undefined;
            })[];
            enabled_indexes?: (({
                type: "database";
                fields: string[];
                name: string;
            } | {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            } | {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }) & {
                staged?: boolean | undefined;
            })[] | undefined;
            disabled_indexes?: (({
                type: "database";
                fields: string[];
                name: string;
            } | {
                type: "search";
                name: string;
                searchField: string;
                filterFields: string[];
            } | {
                type: "vector";
                name: string;
                filterFields: string[];
                vectorField: string;
                dimensions: number;
            }) & {
                staged?: boolean | undefined;
            })[] | undefined;
        };
        schemaDiff: {
            previous_schema: string | null;
            next_schema: string | null;
        } | null;
    }>;
}>;
export type FinishPushDiff = z.infer<typeof finishPushDiff>;
export {};
//# sourceMappingURL=finishPush.d.ts.map