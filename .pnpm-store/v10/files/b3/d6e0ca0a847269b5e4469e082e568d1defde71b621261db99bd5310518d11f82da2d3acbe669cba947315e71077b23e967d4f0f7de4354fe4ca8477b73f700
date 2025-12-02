# Standard OpenAPI

[![npm version](https://img.shields.io/npm/v/@standard-community/standard-openapi.svg)](https://npmjs.org/package/@standard-community/standard-openapi "View this project on NPM")
[![npm downloads](https://img.shields.io/npm/dm/@standard-community/standard-openapi)](https://www.npmjs.com/package/@standard-community/standard-openapi)
[![license](https://img.shields.io/npm/l/@standard-community/standard-openapi)](LICENSE)

Standard Schema Validator's OpenAPI Schema Converter

## Installation

Install the main package -

```sh
pnpm add @standard-community/standard-openapi
```

For some specific vendor, install the respective package also -

| Vendor  | Package |
| ------- | ------- |
| Zod v3  | `zod-openapi@4` |
| Valibot | `@valibot/to-json-schema` |

## Usage

```ts
import { toOpenAPISchema } from "@standard-community/standard-openapi";

// Define your schema
const schema = v.pipe(
    v.object({
        myString: v.string(),
        myUnion: v.union([v.number(), v.boolean()]),
    }),
    v.description("My neat object schema"),
);

// Convert it to OpenAPI Schema
const openapiSchema = await toOpenAPISchema(schema);
```

### Sync Usage

#### Adding support for Unsupported validation libs

```ts
import { toOpenAPISchema, loadVendor } from "@standard-community/standard-openapi";
import { convertSchemaToJson } from "your-validation-lib";

// The lib should support Standard Schema, like Sury
// as we use 'schema["~standard"].vendor' to get the vendor name
// Eg. loadVendor(zod["~standard"].vendor, convertorFunction)
loadVendor("validation-lib-name", convertSchemaToJson)

// Define your validation schema
const schema = {
    // ...
};

// Convert it to OpenAPI Schema
const openapiSchema = toOpenAPISchema(schema);
```

#### Customize the toOpenAPISchema of a supported lib

```ts
import { z } from "zod/v4";
import { toJSONSchema } from "zod/v4/core";
import { toOpenAPISchema, loadVendor } from "@standard-community/standard-openapi";
import { convertToOpenAPISchema } from "@standard-community/standard-openapi/convert";

// Or pass a custom implmentation
loadVendor("zod", (schema, context) => {
    return convertToOpenAPISchema(toJSONSchema(schema, {
        io: "input"
    }), context);
})

// Define your schema
const schema = z.object({
    myString: z.string(),
    myUnion: z.union([z.number(), z.boolean()]),
}),

// Convert it to OpenAPI Schema
const openapiSchema = await toOpenAPISchema(schema);
```
