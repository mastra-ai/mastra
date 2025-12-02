# OpenTelemetry Propagation Utils

[![NPM Published Version][npm-img]][npm-url]
[![Apache License][license-image]][license-image]

A collection of propagation utils for opentelemetry.

## Install

```sh
npm install --save @opentelemetry/propagation-utils
```

## Usage

### PubSub

To make sure each message handled by pubsub creates a new `process` span, and propagates to any internal operation, do as follow:

```ts
import { pubsubPropagation } from '@opentelemetry/propagation-utils';
import { Span, propagation, trace, Context } from '@opentelemetry/api';

const patch = (message: Message[], rootSpan: Span) => {
    const tracer = trace.getTracer('my-tracer');
    pubsubPropagation.patchArrayForProcessSpans(messages, tracer);

    pubsubPropagation.patchMessagesArrayToStartProcessSpans<Message>({
        messages,
        tracer,
        parentSpan: rootSpan,
        messageToSpanDetails: (message) => ({
            attributes: { ... },
            name: 'some-name',
            parentContext: propagation.extract(....) as Context
        }),
    });
}
```

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry JavaScript: <https://github.com/open-telemetry/opentelemetry-js>
- For help or feedback on this project, join us in [GitHub Discussions][discussions-url]

### License

Apache 2.0 - See [LICENSE][license-url] for more information.

[discussions-url]: https://github.com/open-telemetry/opentelemetry-js/discussions
[license-url]: https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/LICENSE
[license-image]: https://img.shields.io/badge/license-Apache_2.0-green.svg?style=flat
[npm-url]: https://www.npmjs.com/package/@opentelemetry/propagation-utils
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Fpropagation-utils.svg
