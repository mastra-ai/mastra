"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Completable = exports.McpZodTypeKind = void 0;
exports.completable = completable;
const zod_1 = require("zod");
var McpZodTypeKind;
(function (McpZodTypeKind) {
    McpZodTypeKind["Completable"] = "McpCompletable";
})(McpZodTypeKind || (exports.McpZodTypeKind = McpZodTypeKind = {}));
class Completable extends zod_1.ZodType {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        const data = ctx.data;
        return this._def.type._parse({
            data,
            path: ctx.path,
            parent: ctx
        });
    }
    unwrap() {
        return this._def.type;
    }
}
exports.Completable = Completable;
Completable.create = (type, params) => {
    return new Completable({
        type,
        typeName: McpZodTypeKind.Completable,
        complete: params.complete,
        ...processCreateParams(params)
    });
};
/**
 * Wraps a Zod type to provide autocompletion capabilities. Useful for, e.g., prompt arguments in MCP.
 */
function completable(schema, complete) {
    return Completable.create(schema, { ...schema._def, complete });
}
// Not sure why this isn't exported from Zod:
// https://github.com/colinhacks/zod/blob/f7ad26147ba291cb3fb257545972a8e00e767470/src/types.ts#L130
function processCreateParams(params) {
    if (!params)
        return {};
    const { errorMap, invalid_type_error, required_error, description } = params;
    if (errorMap && (invalid_type_error || required_error)) {
        throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
    }
    if (errorMap)
        return { errorMap: errorMap, description };
    const customMap = (iss, ctx) => {
        var _a, _b;
        const { message } = params;
        if (iss.code === 'invalid_enum_value') {
            return { message: message !== null && message !== void 0 ? message : ctx.defaultError };
        }
        if (typeof ctx.data === 'undefined') {
            return { message: (_a = message !== null && message !== void 0 ? message : required_error) !== null && _a !== void 0 ? _a : ctx.defaultError };
        }
        if (iss.code !== 'invalid_type')
            return { message: ctx.defaultError };
        return { message: (_b = message !== null && message !== void 0 ? message : invalid_type_error) !== null && _b !== void 0 ? _b : ctx.defaultError };
    };
    return { errorMap: customMap, description };
}
//# sourceMappingURL=completable.js.map