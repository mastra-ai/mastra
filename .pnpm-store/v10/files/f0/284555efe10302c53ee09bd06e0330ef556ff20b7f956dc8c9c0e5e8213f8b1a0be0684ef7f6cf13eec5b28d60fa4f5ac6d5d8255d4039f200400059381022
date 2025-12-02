# OpenTelemetry Knex Instrumentation for Node.js

[![NPM Published Version][npm-img]][npm-url]
[![Apache License][license-image]][license-image]

This module provides automatic instrumentation for the [`knex`](https://github.com/knex/knex) module, which may be loaded using the [`@opentelemetry/sdk-trace-node`](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-sdk-trace-node) package and is included in the [`@opentelemetry/auto-instrumentations-node`](https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-node) bundle. This module allows the user to automatically collect trace data and export them to their backend of choice.

If total installation size is not constrained, it is recommended to use the [`@opentelemetry/auto-instrumentations-node`](https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-node) bundle with [@opentelemetry/sdk-node](`https://www.npmjs.com/package/@opentelemetry/sdk-node`) for the most seamless instrumentation experience.

Compatible with OpenTelemetry JS API and SDK `1.0+`.

## Installation

```bash
npm install --save @opentelemetry/instrumentation-knex
```

### Supported Versions

- [`knex`](https://www.npmjs.com/package/knex) versions `>=0.10.0 <4`

## Usage

```js
const { KnexInstrumentation } = require('@opentelemetry/instrumentation-knex');
const { ConsoleSpanExporter, SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');

const provider = new NodeTracerProvider({
  spanProcessors: [
    new SimpleSpanProcessor(new ConsoleSpanExporter()),
  ],
});

provider.register();

registerInstrumentations({
  instrumentations: [
    new KnexInstrumentation({
        maxQueryLength: 100,
      })
  ],
  tracerProvider: provider,
});
```

### Configuration Options

| Options | Type | Example | Description |
| ------- | ---- | ------- | ----------- |
| `maxQueryLength` | `number` | `100` | Truncate `db.statement` attribute to a maximum length. If the statement is truncated `'..'` is added to it's end. Default `1022`. `-1` leaves `db.statement` untouched. |
| `requireParentSpan` | `boolean` | `false` | Don't create spans unless they are part of an existing trace. Default is `false`. |

## Semantic Conventions

This package uses `@opentelemetry/semantic-conventions` version `1.22+`, which implements Semantic Convention [Version 1.7.0](https://github.com/open-telemetry/opentelemetry-specification/blob/v1.7.0/semantic_conventions/README.md)

Attributes collected:

| Attribute               | Short Description                                                              |
| ----------------------- | ------------------------------------------------------------------------------ |
| `db.name`               | This attribute is used to report the name of the database being accessed.      |
| `db.operation`          | The name of the operation being executed.                                      |
| `db.sql.table`          | The name of the primary table that the operation is acting upon.               |
| `db.statement`          | The database statement being executed.                                         |
| `db.system`             | An identifier for the database management system (DBMS) product being used.    |
| `db.user`               | Username for accessing the database.                                           |
| `net.peer.name`         | Remote hostname or similar.                                                    |
| `net.peer.port`         | Remote port number.                                                            |
| `net.transport`         | Transport protocol used.                                                       |

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry JavaScript: <https://github.com/open-telemetry/opentelemetry-js>
- For help or feedback on this project, join us in [GitHub Discussions][discussions-url]

## License

Apache 2.0 - See [LICENSE][license-url] for more information.

[discussions-url]: https://github.com/open-telemetry/opentelemetry-js/discussions
[license-url]: https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/LICENSE
[license-image]: https://img.shields.io/badge/license-Apache_2.0-green.svg?style=flat
[npm-url]: https://www.npmjs.com/package/@opentelemetry/instrumentation-knex
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Finstrumentation-knex.svg
