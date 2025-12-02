# JSON Schema Traverse

<center>
  <span>
    <img alt="CircleCI branch" src="https://img.shields.io/circleci/project/github/json-schema-tools/traverse/master.svg">
    <img src="https://codecov.io/gh/json-schema-tools/traverse/branch/master/graph/badge.svg" />
    <img alt="npm" src="https://img.shields.io/npm/dt/@json-schema-tools/traverse.svg" />
    <img alt="GitHub release" src="https://img.shields.io/github/release/json-schema-tools/traverse.svg" />
    <img alt="GitHub commits since latest release" src="https://img.shields.io/github/commits-since/json-schema-tools/traverse/latest.svg" />
  </span>
</center>

This package exports a method that will traverse a JSON-Schema, calling a "mutation" function for each sub schema found. It is useful for building tools to work with JSON Schemas.

## Features

 - circular reference detection & handling
 - synchronous - doesn't touch the filesystem or make network requests.
 - easily perform schema mutations while traversing
 - optional mutability (toggle updating original schema object)
 - returns [JSONPaths](https://www.ietf.org/archive/id/draft-goessner-dispatch-jsonpath-00.html) as it traverses

## Getting Started

```sh
npm install @json-schema-tools/traverse
```

```js
const traverse = require("@json-schema-tools/traverse").default;
//import traverse from "@json-schema-tools/traverse"

const mySchema = {
  title: "baz",
  type: "object",
  properties: {
    foo: {
      title: "foo",
      type: "array",
      items: { type: "string" }
    },
    bar: {
      title: "bar",
      anyOf: [
        { title: "stringerific", type: "string" },
        { title: "numberoo", type: "number" }
      ]
    }
  }
};

traverse(mySchema, (schemaOrSubschema) => {
  console.log(schemaOrSubschema.title);
});
```

## API Docs

https://json-schema-tools.github.io/traverse/

### Contributing

How to contribute, build and release are outlined in [CONTRIBUTING.md](CONTRIBUTING.md), [BUILDING.md](BUILDING.md) and [RELEASING.md](RELEASING.md) respectively. Commits in this repository follow the [CONVENTIONAL_COMMITS.md](CONVENTIONAL_COMMITS.md) specification.
