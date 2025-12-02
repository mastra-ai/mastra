"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseString = void 0;
const withMessage_js_1 = require("../utils/withMessage.js");
const parseSchema_js_1 = require("./parseSchema.js");
const parseString = (schema) => {
    let r = "z.string()";
    r += (0, withMessage_js_1.withMessage)(schema, "format", ({ value }) => {
        switch (value) {
            case "email":
                return [".email(", ")"];
            case "ip":
                return [".ip(", ")"];
            case "ipv4":
                return ['.ip({ version: "v4"', ", message: ", " })"];
            case "ipv6":
                return ['.ip({ version: "v6"', ", message: ", " })"];
            case "uri":
                return [".url(", ")"];
            case "uuid":
                return [".uuid(", ")"];
            case "date-time":
                return [".datetime({ offset: true", ", message: ", " })"];
            case "time":
                return [".time(", ")"];
            case "date":
                return [".date(", ")"];
            case "binary":
                return [".base64(", ")"];
            case "duration":
                return [".duration(", ")"];
        }
    });
    r += (0, withMessage_js_1.withMessage)(schema, "pattern", ({ json }) => [
        `.regex(new RegExp(${json})`,
        ", ",
        ")",
    ]);
    r += (0, withMessage_js_1.withMessage)(schema, "minLength", ({ json }) => [
        `.min(${json}`,
        ", ",
        ")",
    ]);
    r += (0, withMessage_js_1.withMessage)(schema, "maxLength", ({ json }) => [
        `.max(${json}`,
        ", ",
        ")",
    ]);
    r += (0, withMessage_js_1.withMessage)(schema, "contentEncoding", ({ value }) => {
        if (value === "base64") {
            return [".base64(", ")"];
        }
    });
    const contentMediaType = (0, withMessage_js_1.withMessage)(schema, "contentMediaType", ({ value }) => {
        if (value === "application/json") {
            return [
                ".transform((str, ctx) => { try { return JSON.parse(str); } catch (err) { ctx.addIssue({ code: \"custom\", message: \"Invalid JSON\" }); }}",
                ", ",
                ")"
            ];
        }
    });
    if (contentMediaType != "") {
        r += contentMediaType;
        r += (0, withMessage_js_1.withMessage)(schema, "contentSchema", ({ value }) => {
            if (value && value instanceof Object) {
                return [
                    `.pipe(${(0, parseSchema_js_1.parseSchema)(value)}`,
                    ", ",
                    ")"
                ];
            }
        });
    }
    return r;
};
exports.parseString = parseString;
