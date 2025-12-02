# OpenTelemetry gRPC Instrumentation for Node.js

[![NPM Published Version][npm-img]][npm-url]
[![Apache License][license-image]][license-image]

**Note: This is an experimental package under active development. New releases may include breaking changes.**

This module provides automatic instrumentation for [`@grpc/grpc-js`](https://grpc.io/blog/grpc-js-1.0/). Currently, version [`1.x`](https://www.npmjs.com/package/@grpc/grpc-js?activeTab=versions) of `@grpc/grpc-js` is supported.

For automatic instrumentation see the
[@opentelemetry/sdk-trace-node](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-sdk-trace-node) package.

## Installation

```sh
npm install --save @opentelemetry/instrumentation-grpc
```

## Supported Versions

- [`@grpc/grpc-js`](https://www.npmjs.com/package/@grpc/grpc-js) versions `^1.0.0`

## Usage

OpenTelemetry gRPC Instrumentation allows the user to automatically collect trace data and export them to the backend of choice, to give observability to distributed systems when working with ([grpc-js](https://www.npmjs.com/package/@grpc/grpc-js)).

To load a specific instrumentation (**gRPC** in this case), specify it in the Node Tracer's configuration.

```javascript
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { GrpcInstrumentation } = require('@opentelemetry/instrumentation-grpc');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');

const provider = new NodeTracerProvider({
  spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter())]
});

provider.register();

registerInstrumentations({
  instrumentations: [new GrpcInstrumentation()]
});

```

See [examples/grpc-js](https://github.com/open-telemetry/opentelemetry-js/tree/main/examples/grpc-js) for examples.

### gRPC Instrumentation Options

gRPC instrumentation accepts the following configuration:

| Options                                                                                                                                                              | Type              | Description                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`ignoreGrpcMethods`](https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/packages/opentelemetry-instrumentation-grpc/src/types.ts#L25)        | `IgnoreMatcher[]` | gRPC instrumentation will not trace any methods that match anything in this list. You may pass a string (case-insensitive match), a `RegExp` object, or a filter function.                                                                                                           |
| [`metadataToSpanAttributes`](https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/packages/opentelemetry-instrumentation-grpc/src/types.ts#L27) | `object`          | List of case insensitive metadata to convert to span attributes. Client and server (outgoing requests, incoming responses) metadata attributes will be converted to span attributes in the form of `rpc.{request\response}.metadata.metadata_key`, e.g. `rpc.response.metadata.date` |

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry JavaScript: <https://github.com/open-telemetry/opentelemetry-js>
- For help or feedback on this project, join us in [GitHub Discussions][discussions-url]

## License

Apache 2.0 - See [LICENSE][license-url] for more information.

[discussions-url]: https://github.com/open-telemetry/opentelemetry-js/discussions
[license-url]: https://github.com/open-telemetry/opentelemetry-js/blob/main/LICENSE
[license-image]: https://img.shields.io/badge/license-Apache_2.0-green.svg?style=flat
[npm-url]: https://www.npmjs.com/package/@opentelemetry/instrumentation-grpc
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Finstrumentation-grpc.svg
