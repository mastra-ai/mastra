# @mastra/arize

## 0.0.0-alpha.1

### Minor Changes

- feat(otel-exporter): Add customizable 'exporter' constructor parameter ([#8827](https://github.com/mastra-ai/mastra/pull/8827))

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

### Patch Changes

- fix(observability): Add ParentSpanContext to MastraSpan's with parentage ([#9085](https://github.com/mastra-ai/mastra/pull/9085))

- Updated dependencies [[`efb5ed9`](https://github.com/mastra-ai/mastra/commit/efb5ed946ae7f410bc68c9430beb4b010afd25ec), [`ff1fe1d`](https://github.com/mastra-ai/mastra/commit/ff1fe1d344c665a5da099386e12adffa04f9a8c7), [`8ea07b4`](https://github.com/mastra-ai/mastra/commit/8ea07b4bdc73e4218437dbb6dcb0f4b23e745a44), [`ba201b8`](https://github.com/mastra-ai/mastra/commit/ba201b8f8feac4c72350f2dbd52c13c7297ba7b0), [`4fc4136`](https://github.com/mastra-ai/mastra/commit/4fc413652866a8d2240694fddb2562e9edbb70df), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`d10baf5`](https://github.com/mastra-ai/mastra/commit/d10baf5a3c924f2a6654e23a3e318ed03f189b76), [`038c55a`](https://github.com/mastra-ai/mastra/commit/038c55a7090fc1b1513a966386d3072617f836ac), [`8bcab54`](https://github.com/mastra-ai/mastra/commit/8bcab543a13ff3fa4ba24da05076cd35f1797827), [`182f045`](https://github.com/mastra-ai/mastra/commit/182f0458f25bd70aa774e64fd923c8a483eddbf1), [`7620d2b`](https://github.com/mastra-ai/mastra/commit/7620d2bddeb4fae4c3c0a0b4e672969795fca11a), [`b2365f0`](https://github.com/mastra-ai/mastra/commit/b2365f038dd4c5f06400428b224af963f399ad50), [`9029ba3`](https://github.com/mastra-ai/mastra/commit/9029ba34459c8859fed4c6b73efd8e2d0021e7ba), [`426cc56`](https://github.com/mastra-ai/mastra/commit/426cc561c85ae76a112ded2385532a91f9f9f074), [`00931fb`](https://github.com/mastra-ai/mastra/commit/00931fb1a21aa42c4fbc20c2c40dd62466b8fc8f), [`e473bfe`](https://github.com/mastra-ai/mastra/commit/e473bfe416c0b8e876973c2b6a6f13c394b7a93f), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`648e2ca`](https://github.com/mastra-ai/mastra/commit/648e2ca42da54838c6ccbdaadc6fadd808fa6b86), [`b65c5e0`](https://github.com/mastra-ai/mastra/commit/b65c5e0fe6f3c390a9a8bbcf69304d972c3a4afb), [`10188d6`](https://github.com/mastra-ai/mastra/commit/10188d632a729010441f9c7e2a41eab60afccb23)]:
  - @mastra/core@0.22.0-alpha.1
  - @mastra/otel-exporter@0.2.0-alpha.0
