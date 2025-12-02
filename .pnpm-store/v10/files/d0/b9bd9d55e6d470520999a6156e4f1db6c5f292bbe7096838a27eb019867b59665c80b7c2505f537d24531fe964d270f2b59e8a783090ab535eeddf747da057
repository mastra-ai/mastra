#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsonSchemaToZod_js_1 = require("./jsonSchemaToZod.js");
const fs_1 = require("fs");
const path_1 = require("path");
const cliTools_js_1 = require("./utils/cliTools.js");
const params = {
    input: {
        shorthand: "i",
        value: "string",
        required: process.stdin.isTTY &&
            "input is required when no JSON or file path is piped",
        description: "JSON or a source file path. Required if no data is piped.",
    },
    output: {
        shorthand: "o",
        value: "string",
        description: "A file path to write to. If not supplied stdout will be used.",
    },
    name: {
        shorthand: "n",
        value: "string",
        description: "The name of the schema in the output.",
    },
    depth: {
        shorthand: "d",
        value: "number",
        description: "Maximum depth of recursion before falling back to z.any(). Defaults to 0.",
    },
    module: {
        shorthand: "m",
        value: ["esm", "cjs", "none"],
        description: "Module syntax; 'esm', 'cjs' or 'none'. Defaults to 'esm'.",
    },
    type: {
        shorthand: "t",
        value: "string",
        description: "The name of the (optional) inferred type export."
    },
    noImport: {
        shorthand: "ni",
        description: "Removes the `import { z } from 'zod';` or equivalent from the output."
    },
    withJsdocs: {
        shorthand: "wj",
        description: "Generate jsdocs off of the description property.",
    },
};
async function main() {
    const args = (0, cliTools_js_1.parseArgs)(params, process.argv, true);
    const input = args.input || (await (0, cliTools_js_1.readPipe)());
    const jsonSchema = (0, cliTools_js_1.parseOrReadJSON)(input);
    const zodSchema = (0, jsonSchemaToZod_js_1.jsonSchemaToZod)(jsonSchema, {
        name: args.name,
        depth: args.depth,
        module: args.module || "esm",
        noImport: args.noImport,
        type: args.type,
        withJsdocs: args.withJsdocs,
    });
    if (args.output) {
        (0, fs_1.mkdirSync)((0, path_1.dirname)(args.output), { recursive: true });
        (0, fs_1.writeFileSync)(args.output, zodSchema);
    }
    else {
        console.log(zodSchema);
    }
}
void main();
