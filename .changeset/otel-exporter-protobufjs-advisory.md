---
'@mastra/otel-exporter': minor
---

Bumped the OpenTelemetry OTLP exporter dependencies (`@opentelemetry/exporter-*-otlp-*`, `@opentelemetry/sdk-logs`, `@opentelemetry/api-logs`) from `^0.215.0` to `^0.218.0`.

The previously pinned range resolved `@opentelemetry/otlp-transformer` to a version that pulled in a vulnerable `protobufjs` release, surfacing several GitHub advisories (GHSA-66ff-xgx4-vchm, GHSA-2pr8-phx7-x9h3, GHSA-fx83-v9x8-x52w, GHSA-75px-5xx7-5xc7, GHSA-jvwf-75h9-cwgg, GHSA-685m-2w69-288q, GHSA-q6x5-8v7m-xcrf, GHSA-jggg-4jg4-v7c6) on every install. The 0.218 OTLP packages no longer depend on the affected `protobufjs`, so `npm audit` runs and CI audit gates stay clean. See [#16965](https://github.com/mastra-ai/mastra/issues/16965).
