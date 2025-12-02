# OpenTelemetry `kafkajs` Instrumentation for Node.js

[![NPM Published Version][npm-img]][npm-url]
[![Apache License][license-image]][license-image]

This module provides automatic instrumentation for the [`kafkajs`](https://www.npmjs.com/package/kafkajs) package, which may be loaded using the [`@opentelemetry/sdk-trace-node`](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-sdk-trace-node) package and is included in the [`@opentelemetry/auto-instrumentations-node`](https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-node) bundle.

If total installation size is not constrained, it is recommended to use the [`@opentelemetry/auto-instrumentations-node`](https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-node) bundle with [@opentelemetry/sdk-node](`https://www.npmjs.com/package/@opentelemetry/sdk-node`) for the most seamless instrumentation experience.

Compatible with OpenTelemetry JS API and SDK `1.0+`.

## Installation

```bash
npm install --save @opentelemetry/instrumentation-kafkajs
```

### Supported versions

- [`kafkajs`](https://www.npmjs.com/package/kafkajs) versions `>=0.1.0 <3`

## Usage

```js
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { KafkaJsInstrumentation } = require('@opentelemetry/instrumentation-kafkajs');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');

const provider = new NodeTracerProvider();
provider.register();

registerInstrumentations({
  instrumentations: [
    new KafkaJsInstrumentation({
      // see below for available configuration
    }),
  ],
});
```

### Instrumentation Options

You can set the following:

| Options                      | Type                                   | Description                                                                                                          |
| ---------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `producerHook`               | `KafkaProducerCustomAttributeFunction` | Function called before a producer message is sent. Allows for adding custom attributes to the span.                  |
| `consumerHook`               | `KafkaConsumerCustomAttributeFunction` | Function called before a consumer message is processed. Allows for adding custom attributes to the span.             |

## Semantic Conventions

This package uses `@opentelemetry/semantic-conventions` version `1.24+`, which implements Semantic Convention [Version 1.7.0](https://github.com/open-telemetry/opentelemetry-specification/blob/v1.7.0/semantic_conventions/README.md)

Attributes collected:

| Attribute                    | Short Description                                     |
| -----------------------------| ----------------------------------------------------- |
| `messaging.system`           | An identifier for the messaging system being used.    |
| `messaging.destination`      | The message destination name.                         |
| `messaging.operation`        | A string identifying the kind of messaging operation. |

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry JavaScript: <https://github.com/open-telemetry/opentelemetry-js>
- For help or feedback on this project, join us in [GitHub Discussions][discussions-url]

## License

Apache 2.0 - See [LICENSE][license-url] for more information.

[discussions-url]: https://github.com/open-telemetry/opentelemetry-js/discussions
[license-url]: https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/LICENSE
[license-image]: https://img.shields.io/badge/license-Apache_2.0-green.svg?style=flat
[npm-url]: https://www.npmjs.com/package/@opentelemetry/instrumentation-kafkajs
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Finstrumentation-kafkajs.svg
