# LanceDB JavaScript SDK

A JavaScript library for [LanceDB](https://github.com/lancedb/lancedb).

## Installation

```bash
npm install @lancedb/lancedb
```

This will download the appropriate native library for your platform. We currently
support:

- Linux (x86_64 and aarch64 on glibc and musl)
- MacOS (Intel and ARM/M1/M2)
- Windows (x86_64 and aarch64)

## Usage

### Basic Example

```javascript
import * as lancedb from "@lancedb/lancedb";
const db = await lancedb.connect("data/sample-lancedb");
const table = await db.createTable("my_table", [
  { id: 1, vector: [0.1, 1.0], item: "foo", price: 10.0 },
  { id: 2, vector: [3.9, 0.5], item: "bar", price: 20.0 },
]);
const results = await table.vectorSearch([0.1, 0.3]).limit(20).toArray();
console.log(results);
```

The [quickstart](https://lancedb.github.io/lancedb/basic/) contains a more complete example.

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for information on how to contribute to LanceDB.
