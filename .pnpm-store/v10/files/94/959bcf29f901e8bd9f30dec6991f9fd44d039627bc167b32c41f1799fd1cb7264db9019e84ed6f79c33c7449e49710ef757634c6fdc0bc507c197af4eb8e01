# OpenInference GenAI

[![npm version](https://badge.fury.io/js/@arizeai%2Fopeninference-genai.svg)](https://badge.fury.io/js/@arizeai%2Fopeninference-genai)

This package provides a set of utilities to convert [OpenTelemetry GenAI](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation/opentelemetry-instrumentation-genai) span attributes to OpenInference span attributes.

> [!WARNING]
> The OpenTelemetry GenAI conventions are still incubating, and may include breaking changes at any time.
> This package will attempt best effort conversions of a subset of the OpenTelemetry GenAI attributes to OpenInference attributes.
> Currently, attributes reflect their definition as of October 2025.

## Installation

```shell
npm install --save @arizeai/openinference-genai
```

## Usage

`@arizeai/openinference-genai` can be used as a standalone set of helper functions,
or in conjunction with a SpanProcessor in order to automatically convert OpenTelemetry GenAI spans to OpenInference spans.

### Standalone

You can mutate the span attributes in place by using the standalone helper functions.

> [!IMPORTANT]
> Span mutation is not supported by the OpenTelemetry SDK, so ensure that you are
> performing mutations in the last-mile of the span's lifetime (i.e. just before exporting the span in a SpanProcessor).

```ts
import { convertGenAISpanAttributesToOpenInferenceSpanAttributes } from `@arizeai/openinference-genai`

// obtain a span with OpenTelemetry GenAI attributes from your tracing system
const span: ReadableSpan = {/* ... */}

// convert the span attributes to OpenInference attributes
const openinferenceAttributes = convertGenAISpanAttributesToOpenInferenceSpanAttributes(span.attributes)

// add the OpenInference attributes to the span
span.attributes = {...span.attributes, ...openinferenceAttributes}
```

### SpanProcessor

You can use the a custom TraceExporter to automatically convert OpenTelemetry GenAI spans to OpenInference spans.

See [examples/export-spans.ts](./examples/export-spans.ts) for a runnable version of the following sample code.

Start by installing packages

```shell
pnpm add @opentelemetry/api @opentelemetry/core @opentelemetry/exporter-trace-otlp-proto @opentelemetry/sdk-trace-base @opentelemetry/sdk-trace-node @opentelemetry/semantic-conventions @opentelemetry/resources @arizeai/openinference-genai
```

Create a custom TraceExporter that converts the OpenTelemetry GenAI attributes to OpenInference attributes.

```ts
// openinferenceOTLPTraceExporter.ts
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import type { ExportResult } from "@opentelemetry/core";

import { convertGenAISpanAttributesToOpenInferenceSpanAttributes } from "@arizeai/openinference-genai";
import type { Mutable } from "@arizeai/openinference-genai/types";

class OpenInferenceOTLPTraceExporter extends OTLPTraceExporter {
  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ) {
    const processedSpans = spans.map((span) => {
      const processedAttributes =
        convertGenAISpanAttributesToOpenInferenceSpanAttributes(
          span.attributes,
        );
      // optionally you can replace the entire attributes object with the
      // processed attributes if you want _only_ the OpenInference attributes
      (span as Mutable<ReadableSpan>).attributes = {
        ...span.attributes,
        ...processedAttributes,
      };
      return span;
    });

    super.export(processedSpans, resultCallback);
  }
}
```

And then use it in the SpanProcessor of your choice.

```ts
// instrumentation.ts
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  NodeTracerProvider,
  BatchSpanProcessor,
} from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions";

import { OpenInferenceOTLPTraceExporter } from "./openinferenceOTLPTraceExporter";

const COLLECTOR_ENDPOINT = process.env.COLLECTOR_ENDPOINT;
const SERVICE_NAME = "openinference-genai-app";

export const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
    [SEMRESATTRS_PROJECT_NAME]: SERVICE_NAME,
  }),
  spanProcessors: [
    new BatchSpanProcessor(
      new OpenInferenceOTLPTraceExporter({
        url: `${COLLECTOR_ENDPOINT}/v1/traces`,
      }),
    ),
  ],
});

provider.register();
```

## Examples

See the [examples](./examples) directory in this package for more executable examples.

To execute an example, run the following commands:

```shell
cd js/packages/openinference-genai
pnpm install
pnpm -r build
pnpx tsx examples/export-spans.ts
```
