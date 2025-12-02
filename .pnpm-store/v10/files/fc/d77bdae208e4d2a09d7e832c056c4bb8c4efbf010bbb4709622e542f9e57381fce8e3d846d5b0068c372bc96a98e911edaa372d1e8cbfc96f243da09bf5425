# OpenTelemetry Postgres Instrumentation for Node.js

[![NPM Published Version][npm-img]][npm-url]
[![Apache License][license-image]][license-image]

This module provides automatic instrumentation for the [`pg`](https://github.com/brianc/node-postgres)module, which may be loaded using the [`@opentelemetry/sdk-trace-node`](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-sdk-trace-node) package and is included in the [`@opentelemetry/auto-instrumentations-node`](https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-node) bundle.

If total installation size is not constrained, it is recommended to use the [`@opentelemetry/auto-instrumentations-node`](https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-node) bundle with [@opentelemetry/sdk-node](`https://www.npmjs.com/package/@opentelemetry/sdk-node`) for the most seamless instrumentation experience.

Compatible with OpenTelemetry JS API and SDK `1.0+`.

## Installation

```bash
npm install --save @opentelemetry/instrumentation-pg
```

### Supported Versions

- [`pg`](https://www.npmjs.com/package/pg) versions `>=8.0.3 <9`
- [`pg-pool`](https://www.npmjs.com/package/pg-pool) versions `>=2.0.0 <4`

## Usage

```js
const { PgInstrumentation } = require('@opentelemetry/instrumentation-pg');
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');

const provider = new NodeTracerProvider();
provider.register();

registerInstrumentations({
  instrumentations: [
    new PgInstrumentation(),
  ],
});
```

PgInstrumentation contains both pg and [`pg.Pool`](https://node-postgres.com/api/pool) so it will be instrumented automatically.

### PostgreSQL Instrumentation Options

PostgreSQL instrumentation has few options available to choose from. You can set the following:

| Options | Type | Description |
| ------- | ---- | ----------- |
| [`enhancedDatabaseReporting`](./src/types.ts#L30) | `boolean` | If true, additional information about query parameters and results will be attached (as `attributes`) to spans representing database operations |
| `requestHook` | `PgInstrumentationExecutionRequestHook` (function) | Function for adding custom span attributes using information about the query being issued and the db to which it's directed |
| `responseHook` | `PgInstrumentationExecutionResponseHook` (function) | Function for adding custom span attributes from db response |
| `requireParentSpan` | `boolean` | If true, requires a parent span to create new spans (default false) |
| `addSqlCommenterCommentToQueries` | `boolean` | If true, adds [sqlcommenter](https://github.com/open-telemetry/opentelemetry-sqlcommenter) specification compliant comment to queries with tracing context (default false). _NOTE: A comment will not be added to queries that already contain `--` or `/* ... */` in them, even if these are not actually part of comments_ |

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry JavaScript: <https://github.com/open-telemetry/opentelemetry-js>
- For help or feedback on this project, join us in [GitHub Discussions][discussions-url]

## License

Apache 2.0 - See [LICENSE][license-url] for more information.

[discussions-url]: https://github.com/open-telemetry/opentelemetry-js/discussions
[license-url]: https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/LICENSE
[license-image]: https://img.shields.io/badge/license-Apache_2.0-green.svg?style=flat
[npm-url]: https://www.npmjs.com/package/@opentelemetry/instrumentation-pg
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Finstrumentation-pg.svg
