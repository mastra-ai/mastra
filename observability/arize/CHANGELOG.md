# @mastra/arize

## 0.1.0-alpha.0

### Minor Changes

- fix(@mastra/arize): Auto-detect arize endpoint when endpoint field is not provided ([#9250](https://github.com/mastra-ai/mastra/pull/9250))

  When spaceId is provided to ArizeExporter constructor, and endpoint is not, pre-populate endpoint with default ArizeAX endpoint.

### Patch Changes

- Fixed import isssues in exporters. ([#9331](https://github.com/mastra-ai/mastra/pull/9331))

- Updated dependencies [[`58bbda8`](https://github.com/mastra-ai/mastra/commit/58bbda8eafa72947c0cf0bd73fa436596b8a0d20), [`2afd345`](https://github.com/mastra-ai/mastra/commit/2afd3450825b76e41f7973baddf13867ea042e40), [`eefc89e`](https://github.com/mastra-ai/mastra/commit/eefc89ee69f05bb71661473a807fc7dc03d56f17), [`0fe7adb`](https://github.com/mastra-ai/mastra/commit/0fe7adb0f20f59a6bb41f235d01f8b7a880ea6e7), [`a42e496`](https://github.com/mastra-ai/mastra/commit/a42e49686a7486e2e9e9397fa98e5ff7a71dc1b0), [`3670db7`](https://github.com/mastra-ai/mastra/commit/3670db7e8e798f9d65fac5bfb732134a1f26ba7b), [`fc843ff`](https://github.com/mastra-ai/mastra/commit/fc843ff4d1d149317b6324553ce5ad7972062a78)]:
  - @mastra/otel-exporter@0.3.2-alpha.0
  - @mastra/core@0.23.2-alpha.0

## 0.0.2

### Patch Changes

- Fix peerdependencies ([`eb7c1c8`](https://github.com/mastra-ai/mastra/commit/eb7c1c8c592d8fb16dfd250e337d9cdc73c8d5de))

- Updated dependencies [[`eb7c1c8`](https://github.com/mastra-ai/mastra/commit/eb7c1c8c592d8fb16dfd250e337d9cdc73c8d5de)]:
  - @mastra/otel-exporter@0.3.1
  - @mastra/core@0.23.1

## 0.0.1

### Patch Changes

- Updated dependencies [[`f743dbb`](https://github.com/mastra-ai/mastra/commit/f743dbb8b40d1627b5c10c0e6fc154f4ebb6e394), [`5df9cce`](https://github.com/mastra-ai/mastra/commit/5df9cce1a753438413f64c11eeef8f845745c2a8), [`2060766`](https://github.com/mastra-ai/mastra/commit/20607667bf78ea104cca3e15dfb93ae0b62c9d18), [`2c4438b`](https://github.com/mastra-ai/mastra/commit/2c4438b87817ab7eed818c7990fef010475af1a3)]:
  - @mastra/core@0.23.0
  - @mastra/otel-exporter@0.3.0

## 0.0.1-alpha.0

### Patch Changes

- Updated dependencies [[`f743dbb`](https://github.com/mastra-ai/mastra/commit/f743dbb8b40d1627b5c10c0e6fc154f4ebb6e394), [`5df9cce`](https://github.com/mastra-ai/mastra/commit/5df9cce1a753438413f64c11eeef8f845745c2a8), [`2060766`](https://github.com/mastra-ai/mastra/commit/20607667bf78ea104cca3e15dfb93ae0b62c9d18), [`2c4438b`](https://github.com/mastra-ai/mastra/commit/2c4438b87817ab7eed818c7990fef010475af1a3)]:
  - @mastra/core@0.23.0-alpha.0
  - @mastra/otel-exporter@0.3.0-alpha.0

## 0.0.0

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

- Updated dependencies [[`c67ca32`](https://github.com/mastra-ai/mastra/commit/c67ca32e3c2cf69bfc146580770c720220ca44ac), [`efb5ed9`](https://github.com/mastra-ai/mastra/commit/efb5ed946ae7f410bc68c9430beb4b010afd25ec), [`ff1fe1d`](https://github.com/mastra-ai/mastra/commit/ff1fe1d344c665a5da099386e12adffa04f9a8c7), [`dbc9e12`](https://github.com/mastra-ai/mastra/commit/dbc9e1216ba575ba59ead4afb727a01215f7de4f), [`99e41b9`](https://github.com/mastra-ai/mastra/commit/99e41b94957cdd25137d3ac12e94e8b21aa01b68), [`c28833c`](https://github.com/mastra-ai/mastra/commit/c28833c5b6d8e10eeffd7f7d39129d53b8bca240), [`8ea07b4`](https://github.com/mastra-ai/mastra/commit/8ea07b4bdc73e4218437dbb6dcb0f4b23e745a44), [`ba201b8`](https://github.com/mastra-ai/mastra/commit/ba201b8f8feac4c72350f2dbd52c13c7297ba7b0), [`f053e89`](https://github.com/mastra-ai/mastra/commit/f053e89160dbd0bd3333fc3492f68231b5c7c349), [`4fc4136`](https://github.com/mastra-ai/mastra/commit/4fc413652866a8d2240694fddb2562e9edbb70df), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`d10baf5`](https://github.com/mastra-ai/mastra/commit/d10baf5a3c924f2a6654e23a3e318ed03f189b76), [`038c55a`](https://github.com/mastra-ai/mastra/commit/038c55a7090fc1b1513a966386d3072617f836ac), [`8bcab54`](https://github.com/mastra-ai/mastra/commit/8bcab543a13ff3fa4ba24da05076cd35f1797827), [`182f045`](https://github.com/mastra-ai/mastra/commit/182f0458f25bd70aa774e64fd923c8a483eddbf1), [`9a1a485`](https://github.com/mastra-ai/mastra/commit/9a1a4859b855e37239f652bf14b1ecd1029b8c4e), [`9257233`](https://github.com/mastra-ai/mastra/commit/9257233c4ffce09b2bedc2a9adbd70d7a83fa8e2), [`7620d2b`](https://github.com/mastra-ai/mastra/commit/7620d2bddeb4fae4c3c0a0b4e672969795fca11a), [`b2365f0`](https://github.com/mastra-ai/mastra/commit/b2365f038dd4c5f06400428b224af963f399ad50), [`0f1a4c9`](https://github.com/mastra-ai/mastra/commit/0f1a4c984fb4b104b2f0b63ba18c9fa77f567700), [`9029ba3`](https://github.com/mastra-ai/mastra/commit/9029ba34459c8859fed4c6b73efd8e2d0021e7ba), [`426cc56`](https://github.com/mastra-ai/mastra/commit/426cc561c85ae76a112ded2385532a91f9f9f074), [`00931fb`](https://github.com/mastra-ai/mastra/commit/00931fb1a21aa42c4fbc20c2c40dd62466b8fc8f), [`e473bfe`](https://github.com/mastra-ai/mastra/commit/e473bfe416c0b8e876973c2b6a6f13c394b7a93f), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`2db6160`](https://github.com/mastra-ai/mastra/commit/2db6160e2022ff8827c15d30157e684683b934b5), [`8aeea37`](https://github.com/mastra-ai/mastra/commit/8aeea37efdde347c635a67fed56794943b7f74ec), [`02fe153`](https://github.com/mastra-ai/mastra/commit/02fe15351d6021d214da48ec982a0e9e4150bcee), [`648e2ca`](https://github.com/mastra-ai/mastra/commit/648e2ca42da54838c6ccbdaadc6fadd808fa6b86), [`74567b3`](https://github.com/mastra-ai/mastra/commit/74567b3d237ae3915cd0bca3cf55fa0a64e4e4a4), [`b65c5e0`](https://github.com/mastra-ai/mastra/commit/b65c5e0fe6f3c390a9a8bbcf69304d972c3a4afb), [`15a1733`](https://github.com/mastra-ai/mastra/commit/15a1733074cee8bd37370e1af34cd818e89fa7ac), [`fc2a774`](https://github.com/mastra-ai/mastra/commit/fc2a77468981aaddc3e77f83f0c4ad4a4af140da), [`4e08933`](https://github.com/mastra-ai/mastra/commit/4e08933625464dfde178347af5b6278fcf34188e), [`10188d6`](https://github.com/mastra-ai/mastra/commit/10188d632a729010441f9c7e2a41eab60afccb23)]:
  - @mastra/core@0.22.0
  - @mastra/otel-exporter@0.2.0

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
