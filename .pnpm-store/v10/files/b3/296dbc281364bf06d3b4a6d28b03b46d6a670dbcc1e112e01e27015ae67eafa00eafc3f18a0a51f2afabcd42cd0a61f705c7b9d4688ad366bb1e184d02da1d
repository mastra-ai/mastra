"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportMap = exports.defaultApplyCardinalityToTsType = exports.generateTsObjectField = exports.generateTsObject = exports.defaultCodecGenerators = exports.defineCodecGeneratorTuple = exports.generateTSTypeFromCodec = void 0;
exports.analyzeQuery = analyzeQuery;
const array_1 = require("../codecs/array");
const enum_1 = require("../codecs/enum");
const ifaces_1 = require("../codecs/ifaces");
const namedtuple_1 = require("../codecs/namedtuple");
const object_1 = require("../codecs/object");
const range_1 = require("../codecs/range");
const codecs_1 = require("../codecs/codecs");
const set_1 = require("../codecs/set");
const tuple_1 = require("../codecs/tuple");
const enums_1 = require("./enums");
const util_1 = require("./util");
async function analyzeQuery(client, query) {
    const { cardinality, capabilities, in: inCodec, out: outCodec, } = await client.describe(query);
    const args = (0, exports.generateTSTypeFromCodec)(inCodec, enums_1.Cardinality.One, {
        optionalNulls: true,
        readonly: true,
    });
    const result = (0, exports.generateTSTypeFromCodec)(outCodec, cardinality);
    const imports = args.imports.merge(result.imports);
    return {
        result: result.type,
        args: args.type,
        cardinality,
        capabilities,
        query,
        importMap: imports,
        imports: imports.get("gel") ?? new Set(),
    };
}
const generateTSTypeFromCodec = (codec, cardinality = enums_1.Cardinality.One, options = {}) => {
    const optionsWithDefaults = {
        indent: "",
        optionalNulls: false,
        readonly: false,
        ...options,
    };
    const context = {
        ...optionsWithDefaults,
        generators: exports.defaultCodecGenerators,
        applyCardinality: (0, exports.defaultApplyCardinalityToTsType)(optionsWithDefaults),
        ...options,
        imports: new ImportMap(),
        walk: (codec, innerContext) => {
            innerContext ??= context;
            for (const [type, generator] of innerContext.generators) {
                if (codec instanceof type) {
                    return generator(codec, innerContext);
                }
            }
            throw new Error(`Unexpected codec kind: ${codec.getKind()}`);
        },
    };
    const type = context.applyCardinality(context.walk(codec, context), cardinality);
    return {
        type,
        imports: context.imports,
    };
};
exports.generateTSTypeFromCodec = generateTSTypeFromCodec;
const genDef = (codecType, generator) => [codecType, generator];
exports.defineCodecGeneratorTuple = genDef;
const getSortPriority = (field) => {
    if (!(field.codec instanceof object_1.ObjectCodec)) {
        switch (field.cardinality) {
            case enums_1.Cardinality.One:
                return 0;
            case enums_1.Cardinality.AtLeastOne:
                return 1;
            case enums_1.Cardinality.AtMostOne:
                return 2;
            case enums_1.Cardinality.Many:
                return 3;
        }
    }
    else {
        switch (field.cardinality) {
            case enums_1.Cardinality.One:
                return 4;
            case enums_1.Cardinality.AtLeastOne:
                return 5;
            case enums_1.Cardinality.AtMostOne:
                return 6;
            case enums_1.Cardinality.Many:
                return 7;
        }
    }
    return 8;
};
exports.defaultCodecGenerators = new Map([
    genDef(codecs_1.NullCodec, () => "null"),
    genDef(enum_1.EnumCodec, (codec) => {
        return `(${codec.values.map((val) => JSON.stringify(val)).join(" | ")})`;
    }),
    genDef(ifaces_1.ScalarCodec, (codec, ctx) => {
        if (codec.tsModule) {
            ctx.imports.add(codec.tsModule, codec.tsType);
        }
        return codec.tsType;
    }),
    genDef(object_1.ObjectCodec, (codec, ctx) => {
        const subCodecs = codec.getSubcodecs();
        const originalFields = codec.getFields();
        const fieldsWithCodecs = originalFields.map((field, i) => ({
            name: field.name,
            cardinality: util_1.util.parseCardinality(field.cardinality),
            codec: subCodecs[i],
        }));
        const sortedFieldsWithCodecs = fieldsWithCodecs.sort((a, b) => {
            const aPriority = getSortPriority(a);
            const bPriority = getSortPriority(b);
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            return a.name.localeCompare(b.name);
        });
        return (0, exports.generateTsObject)(sortedFieldsWithCodecs, ctx);
    }),
    genDef(namedtuple_1.NamedTupleCodec, (codec, ctx) => {
        const subCodecs = codec.getSubcodecs();
        const fields = codec.getNames().map((name, i) => ({
            name,
            codec: subCodecs[i],
            cardinality: enums_1.Cardinality.One,
        }));
        return (0, exports.generateTsObject)(fields, ctx);
    }),
    genDef(tuple_1.TupleCodec, (codec, ctx) => {
        const subCodecs = codec
            .getSubcodecs()
            .map((subCodec) => ctx.walk(subCodec));
        const tuple = `[${subCodecs.join(", ")}]`;
        return ctx.readonly ? `(readonly ${tuple})` : tuple;
    }),
    genDef(array_1.ArrayCodec, (codec, ctx) => ctx.applyCardinality(ctx.walk(codec.getSubcodecs()[0]), enums_1.Cardinality.Many)),
    genDef(range_1.RangeCodec, (codec, ctx) => {
        const subCodec = codec.getSubcodecs()[0];
        if (!(subCodec instanceof ifaces_1.ScalarCodec)) {
            throw Error("expected range subtype to be scalar type");
        }
        ctx.imports.add(codec.tsModule, codec.tsType);
        return `${codec.tsType}<${ctx.walk(subCodec)}>`;
    }),
    genDef(range_1.MultiRangeCodec, (codec, ctx) => {
        const subCodec = codec.getSubcodecs()[0];
        if (!(subCodec instanceof ifaces_1.ScalarCodec)) {
            throw Error("expected multirange subtype to be scalar type");
        }
        ctx.imports.add(codec.tsModule, codec.tsType);
        return `${codec.tsType}<${ctx.walk(subCodec)}>`;
    }),
]);
const generateTsObject = (fields, ctx) => {
    const properties = fields.map((field) => (0, exports.generateTsObjectField)(field, ctx));
    return `{\n${properties.join("\n")}\n${ctx.indent}}`;
};
exports.generateTsObject = generateTsObject;
const generateTsObjectField = (field, ctx) => {
    const codec = unwrapSetCodec(field);
    const name = JSON.stringify(field.name);
    const value = ctx.applyCardinality(ctx.walk(codec, { ...ctx, indent: ctx.indent + "  " }), field.cardinality);
    const optional = ctx.optionalNulls && field.cardinality === enums_1.Cardinality.AtMostOne;
    const questionMark = optional ? "?" : "";
    const isReadonly = ctx.readonly ? "readonly " : "";
    return `${ctx.indent}  ${isReadonly}${name}${questionMark}: ${value};`;
};
exports.generateTsObjectField = generateTsObjectField;
function unwrapSetCodec(field) {
    if (!(field.codec instanceof set_1.SetCodec)) {
        return field.codec;
    }
    if (field.cardinality === enums_1.Cardinality.Many ||
        field.cardinality === enums_1.Cardinality.AtLeastOne) {
        return field.codec.getSubcodecs()[0];
    }
    throw new Error("Sub-codec is SetCodec, but upper cardinality is one");
}
const defaultApplyCardinalityToTsType = (ctx) => (type, cardinality) => {
    switch (cardinality) {
        case enums_1.Cardinality.Many:
            return `${ctx.readonly ? "Readonly" : ""}Array<${type}>`;
        case enums_1.Cardinality.One:
            return type;
        case enums_1.Cardinality.AtMostOne:
            return `${type} | null`;
        case enums_1.Cardinality.AtLeastOne: {
            const tuple = `[(${type}), ...(${type})[]]`;
            return ctx.readonly ? `(readonly ${tuple})` : tuple;
        }
    }
    throw new Error(`Unexpected cardinality: ${cardinality}`);
};
exports.defaultApplyCardinalityToTsType = defaultApplyCardinalityToTsType;
class ImportMap extends Map {
    add(module, specifier) {
        if (!this.has(module)) {
            this.set(module, new Set());
        }
        this.get(module).add(specifier);
        return this;
    }
    merge(map) {
        const out = new ImportMap();
        for (const [mod, specifiers] of [...this, ...map]) {
            for (const specifier of specifiers) {
                out.add(mod, specifier);
            }
        }
        return out;
    }
}
exports.ImportMap = ImportMap;
