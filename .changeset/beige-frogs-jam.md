---
'@mastra/arize': minor
'@mastra/otel-exporter': minor
---

feat(otel-exporter): Add customizable 'exporter' constructor parameter

You can now pass in an instantiated `TraceExporter` inheriting class into `OtelExporter`.
This will circumvent the default package detection, no longer instantiating a `TraceExporter`
automatically if one is instead passed in to the `OtelExporter` constructor.

feat(arize): Initial release of @mastra/arize observability package

The `@mastra/arize` package exports an `ArizeExporter` class that can be used to easily send AI
traces from Mastra to Arize AX, Arize Phoenix, or any OpenInference compatible collector.
It sends traces uses `BatchSpanProcessor` over OTLP connections.
It leverages the `@mastra/otel-exporter` package, reusing `OtelExporter` for transmission and
span management.
See the README in `observability/arize/README.md` for more details
