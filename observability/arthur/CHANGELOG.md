# @mastra/arthur

## 0.2.9-alpha.0

### Patch Changes

- Updated dependencies [[`6dcd65f`](https://github.com/mastra-ai/mastra/commit/6dcd65f2a34069e6dc43ba35f1d11119b9b40bef), [`1c2dda8`](https://github.com/mastra-ai/mastra/commit/1c2dda805fbfccc0abf55d4cb20cc34402dc3f0c)]:
  - @mastra/core@1.31.1-alpha.0
  - @mastra/otel-exporter@1.0.22-alpha.0

## 0.2.8

### Patch Changes

- Renamed emitted OTel GenAI cache usage attributes to match the OpenTelemetry semantic conventions: ([#15966](https://github.com/mastra-ai/mastra/pull/15966))
  - `gen_ai.usage.cached_input_tokens` → `gen_ai.usage.cache_read.input_tokens`
  - `gen_ai.usage.cache_write_tokens` → `gen_ai.usage.cache_creation.input_tokens`

  `gen_ai.usage.input_tokens` is unchanged and remains the total prompt-token count. Cache attributes are emitted separately as subsets of that total.

  Updated Arize, Arthur, and Sentry mappings so cache values continue to flow through those exporters.

  Direct consumers should update any dashboards, alerts, or queries that reference the old attribute names.

- Updated dependencies [[`1723e09`](https://github.com/mastra-ai/mastra/commit/1723e099829892419ddbfe49287acfeac2522724), [`629f9e9`](https://github.com/mastra-ai/mastra/commit/629f9e9a7e56aa8f129515a3923c5813298790c7), [`25168fb`](https://github.com/mastra-ai/mastra/commit/25168fb9c1de9db7f8171df4f58ceb842c53aa29), [`ab34b5a`](https://github.com/mastra-ai/mastra/commit/ab34b5a2191b8e4353df1dbf7b9155e7d6628d79), [`5fb6c2a`](https://github.com/mastra-ai/mastra/commit/5fb6c2a95c1843cc231704b91354311fc1f34a71), [`2b0f355`](https://github.com/mastra-ai/mastra/commit/2b0f3553be3e9e5524da539a66e5cf82668440a4), [`394f0cf`](https://github.com/mastra-ai/mastra/commit/394f0cfc31e6b4d801219fdef2e9cc69e5bc8682), [`b2deb29`](https://github.com/mastra-ai/mastra/commit/b2deb29412b300c868655b5840463614fbb7962d), [`66644be`](https://github.com/mastra-ai/mastra/commit/66644beac1aa560f0e417956ff007c89341dc382), [`e109607`](https://github.com/mastra-ai/mastra/commit/e10960749251e34d46b480a20648c490fd30381b), [`310b953`](https://github.com/mastra-ai/mastra/commit/310b95345f302dcd5ba3ed862bdc96f059d44122), [`3d7f709`](https://github.com/mastra-ai/mastra/commit/3d7f709b615e588050bb6283c4ee5cfe2978cbde), [`724ec57`](https://github.com/mastra-ai/mastra/commit/724ec5736c4b0baf84d3baa7877ac3cf04947995), [`48a42f1`](https://github.com/mastra-ai/mastra/commit/48a42f114a4006a95e0b7a1b5ad1a24815a175c2), [`8091c7c`](https://github.com/mastra-ai/mastra/commit/8091c7c944d15e13fef6d61b6cfd903f158d4006), [`2c83efc`](https://github.com/mastra-ai/mastra/commit/2c83efc4482b3efe50830e3b8b4ba9a8d219edff), [`43f0e1d`](https://github.com/mastra-ai/mastra/commit/43f0e1d5d5a74ba6fc746f2ad89ebe0c64777a7d), [`da0b9e2`](https://github.com/mastra-ai/mastra/commit/da0b9e2ba7ecc560213b426d6c097fe63946086e), [`282a10c`](https://github.com/mastra-ai/mastra/commit/282a10c9446e9922afe80e10e3770481c8ac8a28), [`04151c7`](https://github.com/mastra-ai/mastra/commit/04151c7dcea934b4fe9076708a23fac161195414), [`8091c7c`](https://github.com/mastra-ai/mastra/commit/8091c7c944d15e13fef6d61b6cfd903f158d4006)]:
  - @mastra/core@1.31.0
  - @mastra/otel-exporter@1.0.21

## 0.2.8-alpha.1

### Patch Changes

- Updated dependencies [[`1723e09`](https://github.com/mastra-ai/mastra/commit/1723e099829892419ddbfe49287acfeac2522724), [`629f9e9`](https://github.com/mastra-ai/mastra/commit/629f9e9a7e56aa8f129515a3923c5813298790c7), [`25168fb`](https://github.com/mastra-ai/mastra/commit/25168fb9c1de9db7f8171df4f58ceb842c53aa29), [`ab34b5a`](https://github.com/mastra-ai/mastra/commit/ab34b5a2191b8e4353df1dbf7b9155e7d6628d79), [`5fb6c2a`](https://github.com/mastra-ai/mastra/commit/5fb6c2a95c1843cc231704b91354311fc1f34a71), [`394f0cf`](https://github.com/mastra-ai/mastra/commit/394f0cfc31e6b4d801219fdef2e9cc69e5bc8682), [`3d7f709`](https://github.com/mastra-ai/mastra/commit/3d7f709b615e588050bb6283c4ee5cfe2978cbde), [`48a42f1`](https://github.com/mastra-ai/mastra/commit/48a42f114a4006a95e0b7a1b5ad1a24815a175c2), [`2c83efc`](https://github.com/mastra-ai/mastra/commit/2c83efc4482b3efe50830e3b8b4ba9a8d219edff), [`282a10c`](https://github.com/mastra-ai/mastra/commit/282a10c9446e9922afe80e10e3770481c8ac8a28)]:
  - @mastra/core@1.31.0-alpha.0
  - @mastra/otel-exporter@1.0.21-alpha.1

## 0.2.8-alpha.0

### Patch Changes

- Renamed emitted OTel GenAI cache usage attributes to match the OpenTelemetry semantic conventions: ([#15966](https://github.com/mastra-ai/mastra/pull/15966))
  - `gen_ai.usage.cached_input_tokens` → `gen_ai.usage.cache_read.input_tokens`
  - `gen_ai.usage.cache_write_tokens` → `gen_ai.usage.cache_creation.input_tokens`

  `gen_ai.usage.input_tokens` is unchanged and remains the total prompt-token count. Cache attributes are emitted separately as subsets of that total.

  Updated Arize, Arthur, and Sentry mappings so cache values continue to flow through those exporters.

  Direct consumers should update any dashboards, alerts, or queries that reference the old attribute names.

- Updated dependencies [[`724ec57`](https://github.com/mastra-ai/mastra/commit/724ec5736c4b0baf84d3baa7877ac3cf04947995)]:
  - @mastra/otel-exporter@1.0.21-alpha.0

## 0.2.7

### Patch Changes

- Updated dependencies [[`920c757`](https://github.com/mastra-ai/mastra/commit/920c75799c6bd71787d86deaf654a35af4c839ca), [`d587199`](https://github.com/mastra-ai/mastra/commit/d5871993c0371bde2b0717d6b47194755baa1443), [`1fe2533`](https://github.com/mastra-ai/mastra/commit/1fe2533c4382ca6858aac7c4b63e888c2eac6541), [`f8694b6`](https://github.com/mastra-ai/mastra/commit/f8694b6fa0b7a5cde71d794c3bbef4957c55bcb8)]:
  - @mastra/core@1.30.0
  - @mastra/otel-exporter@1.0.20

## 0.2.7-alpha.0

### Patch Changes

- Updated dependencies [[`920c757`](https://github.com/mastra-ai/mastra/commit/920c75799c6bd71787d86deaf654a35af4c839ca), [`1fe2533`](https://github.com/mastra-ai/mastra/commit/1fe2533c4382ca6858aac7c4b63e888c2eac6541), [`f8694b6`](https://github.com/mastra-ai/mastra/commit/f8694b6fa0b7a5cde71d794c3bbef4957c55bcb8)]:
  - @mastra/core@1.30.0-alpha.1
  - @mastra/otel-exporter@1.0.20-alpha.0

## 0.2.6

### Patch Changes

- Updated dependencies [[`6db978c`](https://github.com/mastra-ai/mastra/commit/6db978c42e94e75540a504f7230086f0b5cd35f9), [`512a013`](https://github.com/mastra-ai/mastra/commit/512a013f285aa9c0aa8f08a35b2ce09f9938b017), [`e9becde`](https://github.com/mastra-ai/mastra/commit/e9becdeed9176b9f8392e557bde12b933f99cf7a), [`703a443`](https://github.com/mastra-ai/mastra/commit/703a44390c587d9c0b8ae94ec4edd8afb2a74044), [`808df1b`](https://github.com/mastra-ai/mastra/commit/808df1b39358b5f10b7317107e42b1fda7c87185)]:
  - @mastra/core@1.29.1
  - @mastra/otel-exporter@1.0.19

## 0.2.6-alpha.0

### Patch Changes

- Updated dependencies [[`703a443`](https://github.com/mastra-ai/mastra/commit/703a44390c587d9c0b8ae94ec4edd8afb2a74044), [`808df1b`](https://github.com/mastra-ai/mastra/commit/808df1b39358b5f10b7317107e42b1fda7c87185)]:
  - @mastra/core@1.29.1-alpha.1
  - @mastra/otel-exporter@1.0.19-alpha.0

## 0.2.5

### Patch Changes

- Updated dependencies [[`28caa5b`](https://github.com/mastra-ai/mastra/commit/28caa5b032358545af2589ed90636eccb4dd9d2f), [`c1ae974`](https://github.com/mastra-ai/mastra/commit/c1ae97491f6e57378ce880c3a397778c42adcdf1), [`b510d36`](https://github.com/mastra-ai/mastra/commit/b510d368f73dab6be2e2c2bc99035aaef1fb7d7a), [`13b4d7c`](https://github.com/mastra-ai/mastra/commit/13b4d7c16de34dff9095d1cd80f22f544b6cfe75), [`7a7b313`](https://github.com/mastra-ai/mastra/commit/7a7b3138fb3bcf0b0c740eaea07971e43d330ef3), [`c04417b`](https://github.com/mastra-ai/mastra/commit/c04417ba0a2e4ded66da4352331ef29cd4bd1d79), [`cf25a03`](https://github.com/mastra-ai/mastra/commit/cf25a03132164b9dc1e5dccf7394824e33007c51), [`8a71261`](https://github.com/mastra-ai/mastra/commit/8a71261e3954ae617c6f8e25767b951f99438ab2), [`9e973b0`](https://github.com/mastra-ai/mastra/commit/9e973b010dacfa15ac82b0072897319f5234b90a), [`dd934a0`](https://github.com/mastra-ai/mastra/commit/dd934a0982ce0f78712fbd559e4f2410bf594b39), [`ba6b0c5`](https://github.com/mastra-ai/mastra/commit/ba6b0c51bfce358554fd33c7f2bcd5593633f2ff), [`a6dac0a`](https://github.com/mastra-ai/mastra/commit/a6dac0a40c7181161b1add4e8534f962bcbc9aa7), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`6c8c6c7`](https://github.com/mastra-ai/mastra/commit/6c8c6c71518394321a4692614aa4b11f3bb0a343), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`7d056b6`](https://github.com/mastra-ai/mastra/commit/7d056b6ecf603cacaa0f663ff1df025ed885b6c1), [`9cef83b`](https://github.com/mastra-ai/mastra/commit/9cef83b8a642b8098747772921e3523b492bafbc), [`d30e215`](https://github.com/mastra-ai/mastra/commit/d30e2156c746bc9fd791745cec1cc24377b66789), [`021a60f`](https://github.com/mastra-ai/mastra/commit/021a60f1f3e0135a70ef23c58be7a9b3aaffe6b4), [`73f2809`](https://github.com/mastra-ai/mastra/commit/73f2809721db24e98cdf122539652a455211b450), [`aedeea4`](https://github.com/mastra-ai/mastra/commit/aedeea48a94f728323f040478775076b9574be50), [`26f1f94`](https://github.com/mastra-ai/mastra/commit/26f1f9490574b864ba1ecedf2c9632e0767a23bd), [`8126d86`](https://github.com/mastra-ai/mastra/commit/8126d8638411eacfafdc29036ac998e8757ea66f), [`73b45fa`](https://github.com/mastra-ai/mastra/commit/73b45facdef4fbcb8af710c50f0646f18619dbaa), [`ae97520`](https://github.com/mastra-ai/mastra/commit/ae975206fdb0f6ef03c4d5bf94f7dc7c3f706c02), [`7a7b313`](https://github.com/mastra-ai/mastra/commit/7a7b3138fb3bcf0b0c740eaea07971e43d330ef3), [`441670a`](https://github.com/mastra-ai/mastra/commit/441670a02c9dc7731c52674f55481e7848a84523)]:
  - @mastra/core@1.29.0
  - @mastra/otel-exporter@1.0.18

## 0.2.5-alpha.0

### Patch Changes

- Updated dependencies [[`c04417b`](https://github.com/mastra-ai/mastra/commit/c04417ba0a2e4ded66da4352331ef29cd4bd1d79), [`cf25a03`](https://github.com/mastra-ai/mastra/commit/cf25a03132164b9dc1e5dccf7394824e33007c51), [`ba6b0c5`](https://github.com/mastra-ai/mastra/commit/ba6b0c51bfce358554fd33c7f2bcd5593633f2ff)]:
  - @mastra/core@1.29.0-alpha.3
  - @mastra/otel-exporter@1.0.18-alpha.0

## 0.2.4

### Patch Changes

- dependencies updates: ([#15526](https://github.com/mastra-ai/mastra/pull/15526))
  - Updated dependency [`@opentelemetry/core@^2.7.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/core/v/2.7.0) (from `^2.6.0`, in `dependencies`)
  - Updated dependency [`@opentelemetry/exporter-trace-otlp-proto@^0.215.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/exporter-trace-otlp-proto/v/0.215.0) (from `^0.205.0`, in `dependencies`)
  - Updated dependency [`@opentelemetry/sdk-trace-base@^2.7.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/sdk-trace-base/v/2.7.0) (from `^2.6.0`, in `dependencies`)

- Fixed a security issue where several parsing and tracing paths could slow down on malformed or attacker-crafted input. Normal behavior is unchanged, and these packages now handle pathological input in linear time. ([#15566](https://github.com/mastra-ai/mastra/pull/15566))

- Updated dependencies [[`20f59b8`](https://github.com/mastra-ai/mastra/commit/20f59b876cf91199efbc49a0e36b391240708f08), [`710bced`](https://github.com/mastra-ai/mastra/commit/710bced6ffce524c6d1b624ac55b1062c90ad238), [`aba393e`](https://github.com/mastra-ai/mastra/commit/aba393e2da7390c69b80e516a4f153cda6f09376), [`3d83d06`](https://github.com/mastra-ai/mastra/commit/3d83d06f776f00fb5f4163dddd32a030c5c20844), [`e2687a7`](https://github.com/mastra-ai/mastra/commit/e2687a7408790c384563816a9a28ed06735684c9), [`fdd54cf`](https://github.com/mastra-ai/mastra/commit/fdd54cf612a9af876e9fdd85e534454f6e7dd518), [`6315317`](https://github.com/mastra-ai/mastra/commit/63153175fe9a7b224e5be7c209bbebc01dd9b0d5), [`a371ac5`](https://github.com/mastra-ai/mastra/commit/a371ac534aa1bb368a1acf9d8b313378dfdc787e), [`0474c2b`](https://github.com/mastra-ai/mastra/commit/0474c2b2e7c7e1ad8691dca031284841391ff1ef), [`0a5fa1d`](https://github.com/mastra-ai/mastra/commit/0a5fa1d3cb0583889d06687155f26fd7d2edc76c), [`7e0e63e`](https://github.com/mastra-ai/mastra/commit/7e0e63e2e485e84442351f4c7a79a424c83539dc), [`ea43e64`](https://github.com/mastra-ai/mastra/commit/ea43e646dd95d507694b6112b0bf1df22ad552b2), [`f607106`](https://github.com/mastra-ai/mastra/commit/f607106854c6416c4a07d4082604b9f66d047221), [`30456b6`](https://github.com/mastra-ai/mastra/commit/30456b6b08c8fd17e109dd093b73d93b65e83bc5), [`9d11a8c`](https://github.com/mastra-ai/mastra/commit/9d11a8c1c8924eb975a245a5884d40ca1b7e0491), [`9d3b24b`](https://github.com/mastra-ai/mastra/commit/9d3b24b19407ae9c09586cf7766d38dc4dff4a69), [`00d1b16`](https://github.com/mastra-ai/mastra/commit/00d1b16b401199cb294fa23f43336547db4dca9b), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e), [`62919a6`](https://github.com/mastra-ai/mastra/commit/62919a6ee0fbf3779ad21a97b1ec6696515d5104), [`d246696`](https://github.com/mastra-ai/mastra/commit/d246696139a3144a5b21b042d41c532688e957e1), [`354f9ce`](https://github.com/mastra-ai/mastra/commit/354f9ce1ca6af2074b6a196a23f8ec30012dccca), [`16e34ca`](https://github.com/mastra-ai/mastra/commit/16e34caa98b9a114b17a6125e4e3fd87f169d0d0), [`7020c06`](https://github.com/mastra-ai/mastra/commit/7020c0690b199d9da337f0e805f16948e557922e), [`8786a61`](https://github.com/mastra-ai/mastra/commit/8786a61fa54ba265f85eeff9985ca39863d18bb6), [`9467ea8`](https://github.com/mastra-ai/mastra/commit/9467ea87695749a53dfc041576410ebf9ee7bb67), [`7338d94`](https://github.com/mastra-ai/mastra/commit/7338d949380cf68b095342e8e42610dc51d557c1), [`c80dc16`](https://github.com/mastra-ai/mastra/commit/c80dc16e113e6cc159f510ffde501ad4711b2189), [`af8a57e`](https://github.com/mastra-ai/mastra/commit/af8a57ed9ba9685ad8601d5b71ae3706da6222f9), [`d63ffdb`](https://github.com/mastra-ai/mastra/commit/d63ffdbb2c11e76fe5ea45faab44bc15460f010c), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e), [`1bd5104`](https://github.com/mastra-ai/mastra/commit/1bd51048b6da93507276d6623e3fd96a9e1a8944), [`e9837b5`](https://github.com/mastra-ai/mastra/commit/e9837b53699e18711b09e0ca010a4106376f2653), [`8f1b280`](https://github.com/mastra-ai/mastra/commit/8f1b280b7fe6999ec654f160cb69c1a8719e7a57), [`92dcf02`](https://github.com/mastra-ai/mastra/commit/92dcf029294210ac91b090900c1a0555a425c57a), [`0fd90a2`](https://github.com/mastra-ai/mastra/commit/0fd90a215caf5fca8099c15a67ca03e4427747a3), [`8fb2405`](https://github.com/mastra-ai/mastra/commit/8fb2405138f2d208b7962ad03f121ca25bcc28c5), [`12df98c`](https://github.com/mastra-ai/mastra/commit/12df98c4904643d9481f5c78f3bed443725b4c96)]:
  - @mastra/core@1.26.0
  - @mastra/otel-exporter@1.0.17

## 0.2.4-alpha.4

### Patch Changes

- Updated dependencies [[`20f59b8`](https://github.com/mastra-ai/mastra/commit/20f59b876cf91199efbc49a0e36b391240708f08), [`e2687a7`](https://github.com/mastra-ai/mastra/commit/e2687a7408790c384563816a9a28ed06735684c9), [`8f1b280`](https://github.com/mastra-ai/mastra/commit/8f1b280b7fe6999ec654f160cb69c1a8719e7a57), [`12df98c`](https://github.com/mastra-ai/mastra/commit/12df98c4904643d9481f5c78f3bed443725b4c96)]:
  - @mastra/core@1.26.0-alpha.11
  - @mastra/otel-exporter@1.0.17-alpha.4

## 0.2.4-alpha.3

### Patch Changes

- dependencies updates: ([#15526](https://github.com/mastra-ai/mastra/pull/15526))
  - Updated dependency [`@opentelemetry/core@^2.7.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/core/v/2.7.0) (from `^2.6.0`, in `dependencies`)
  - Updated dependency [`@opentelemetry/exporter-trace-otlp-proto@^0.215.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/exporter-trace-otlp-proto/v/0.215.0) (from `^0.205.0`, in `dependencies`)
  - Updated dependency [`@opentelemetry/sdk-trace-base@^2.7.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/sdk-trace-base/v/2.7.0) (from `^2.6.0`, in `dependencies`)

- Fixed a security issue where several parsing and tracing paths could slow down on malformed or attacker-crafted input. Normal behavior is unchanged, and these packages now handle pathological input in linear time. ([#15566](https://github.com/mastra-ai/mastra/pull/15566))

- Updated dependencies [[`710bced`](https://github.com/mastra-ai/mastra/commit/710bced6ffce524c6d1b624ac55b1062c90ad238), [`aba393e`](https://github.com/mastra-ai/mastra/commit/aba393e2da7390c69b80e516a4f153cda6f09376), [`0a5fa1d`](https://github.com/mastra-ai/mastra/commit/0a5fa1d3cb0583889d06687155f26fd7d2edc76c), [`ea43e64`](https://github.com/mastra-ai/mastra/commit/ea43e646dd95d507694b6112b0bf1df22ad552b2), [`00d1b16`](https://github.com/mastra-ai/mastra/commit/00d1b16b401199cb294fa23f43336547db4dca9b), [`af8a57e`](https://github.com/mastra-ai/mastra/commit/af8a57ed9ba9685ad8601d5b71ae3706da6222f9)]:
  - @mastra/otel-exporter@1.0.17-alpha.3
  - @mastra/core@1.26.0-alpha.10

## 0.2.4-alpha.2

### Patch Changes

- Updated dependencies [[`8786a61`](https://github.com/mastra-ai/mastra/commit/8786a61fa54ba265f85eeff9985ca39863d18bb6), [`8fb2405`](https://github.com/mastra-ai/mastra/commit/8fb2405138f2d208b7962ad03f121ca25bcc28c5)]:
  - @mastra/core@1.26.0-alpha.7
  - @mastra/otel-exporter@1.0.17-alpha.2

## 0.2.4-alpha.1

### Patch Changes

- Updated dependencies [[`6315317`](https://github.com/mastra-ai/mastra/commit/63153175fe9a7b224e5be7c209bbebc01dd9b0d5), [`9d3b24b`](https://github.com/mastra-ai/mastra/commit/9d3b24b19407ae9c09586cf7766d38dc4dff4a69)]:
  - @mastra/core@1.26.0-alpha.6
  - @mastra/otel-exporter@1.0.17-alpha.1

## 0.2.4-alpha.0

### Patch Changes

- Updated dependencies [[`3d83d06`](https://github.com/mastra-ai/mastra/commit/3d83d06f776f00fb5f4163dddd32a030c5c20844), [`7e0e63e`](https://github.com/mastra-ai/mastra/commit/7e0e63e2e485e84442351f4c7a79a424c83539dc), [`9467ea8`](https://github.com/mastra-ai/mastra/commit/9467ea87695749a53dfc041576410ebf9ee7bb67), [`7338d94`](https://github.com/mastra-ai/mastra/commit/7338d949380cf68b095342e8e42610dc51d557c1)]:
  - @mastra/core@1.26.0-alpha.2
  - @mastra/otel-exporter@1.0.17-alpha.0

## 0.2.3

### Patch Changes

- dependencies updates: ([#15282](https://github.com/mastra-ai/mastra/pull/15282))
  - Updated dependency [`@arizeai/openinference-genai@0.1.7` ↗︎](https://www.npmjs.com/package/@arizeai/openinference-genai/v/0.1.7) (from `0.1.6`, in `dependencies`)
- Updated dependencies [[`87df955`](https://github.com/mastra-ai/mastra/commit/87df955c028660c075873fd5d74af28233ce32eb), [`8fad147`](https://github.com/mastra-ai/mastra/commit/8fad14759804179c8e080ce4d9dec6ef1a808b31), [`582644c`](https://github.com/mastra-ai/mastra/commit/582644c4a87f83b4f245a84d72b9e8590585012e), [`cbdf3e1`](https://github.com/mastra-ai/mastra/commit/cbdf3e12b3d0c30a6e5347be658e2009648c130a), [`8fe46d3`](https://github.com/mastra-ai/mastra/commit/8fe46d354027f3f0f0846e64219772348de106dd), [`18c67db`](https://github.com/mastra-ai/mastra/commit/18c67dbb9c9ebc26f26f65f7d3ff836e5691ef46), [`4ba3bb1`](https://github.com/mastra-ai/mastra/commit/4ba3bb1e465ad2ddaba3bbf2bc47e0faec32985e), [`5d84914`](https://github.com/mastra-ai/mastra/commit/5d84914e0e520c642a40329b210b413fcd139898), [`8dcc77e`](https://github.com/mastra-ai/mastra/commit/8dcc77e78a5340f5848f74b9e9f1b3da3513c1f5), [`aa67fc5`](https://github.com/mastra-ai/mastra/commit/aa67fc59ee8a5eeff1f23eb05970b8d7a536c8ff), [`fd2f314`](https://github.com/mastra-ai/mastra/commit/fd2f31473d3449b6b97e837ef8641264377f41a7), [`fa8140b`](https://github.com/mastra-ai/mastra/commit/fa8140bcd4251d2e3ac85fdc5547dfc4f372b5be), [`190f452`](https://github.com/mastra-ai/mastra/commit/190f45258b0640e2adfc8219fa3258cdc5b8f071), [`e80fead`](https://github.com/mastra-ai/mastra/commit/e80fead1412cc0d1b2f7d6a1ce5017d9e0098ff7), [`0287b64`](https://github.com/mastra-ai/mastra/commit/0287b644a5c3272755cf3112e71338106664103b), [`7e7bf60`](https://github.com/mastra-ai/mastra/commit/7e7bf606886bf374a6f9d4ca9b09dd83d0533372), [`184907d`](https://github.com/mastra-ai/mastra/commit/184907d775d8609c03c26e78ccaf37315f3aa287), [`075e91a`](https://github.com/mastra-ai/mastra/commit/075e91a4549baf46ad7a42a6a8ac8dfa78cc09e6), [`0c4cd13`](https://github.com/mastra-ai/mastra/commit/0c4cd131931c04ac5405373c932a242dbe88edd6), [`b16a753`](https://github.com/mastra-ai/mastra/commit/b16a753d5748440248d7df82e29bb987a9c8386c)]:
  - @mastra/core@1.25.0
  - @mastra/otel-exporter@1.0.16

## 0.2.3-alpha.3

### Patch Changes

- dependencies updates: ([#15282](https://github.com/mastra-ai/mastra/pull/15282))
  - Updated dependency [`@arizeai/openinference-genai@0.1.7` ↗︎](https://www.npmjs.com/package/@arizeai/openinference-genai/v/0.1.7) (from `0.1.6`, in `dependencies`)

## 0.2.3-alpha.2

### Patch Changes

- Updated dependencies [[`cbdf3e1`](https://github.com/mastra-ai/mastra/commit/cbdf3e12b3d0c30a6e5347be658e2009648c130a), [`8fe46d3`](https://github.com/mastra-ai/mastra/commit/8fe46d354027f3f0f0846e64219772348de106dd), [`18c67db`](https://github.com/mastra-ai/mastra/commit/18c67dbb9c9ebc26f26f65f7d3ff836e5691ef46), [`8dcc77e`](https://github.com/mastra-ai/mastra/commit/8dcc77e78a5340f5848f74b9e9f1b3da3513c1f5), [`aa67fc5`](https://github.com/mastra-ai/mastra/commit/aa67fc59ee8a5eeff1f23eb05970b8d7a536c8ff), [`fa8140b`](https://github.com/mastra-ai/mastra/commit/fa8140bcd4251d2e3ac85fdc5547dfc4f372b5be), [`190f452`](https://github.com/mastra-ai/mastra/commit/190f45258b0640e2adfc8219fa3258cdc5b8f071), [`7e7bf60`](https://github.com/mastra-ai/mastra/commit/7e7bf606886bf374a6f9d4ca9b09dd83d0533372), [`184907d`](https://github.com/mastra-ai/mastra/commit/184907d775d8609c03c26e78ccaf37315f3aa287), [`0c4cd13`](https://github.com/mastra-ai/mastra/commit/0c4cd131931c04ac5405373c932a242dbe88edd6), [`b16a753`](https://github.com/mastra-ai/mastra/commit/b16a753d5748440248d7df82e29bb987a9c8386c)]:
  - @mastra/core@1.25.0-alpha.3
  - @mastra/otel-exporter@1.0.16-alpha.2

## 0.2.3-alpha.1

### Patch Changes

- Updated dependencies:
  - @mastra/otel-exporter@1.0.16-alpha.1

## 0.2.3-alpha.0

### Patch Changes

- Updated dependencies [[`4ba3bb1`](https://github.com/mastra-ai/mastra/commit/4ba3bb1e465ad2ddaba3bbf2bc47e0faec32985e)]:
  - @mastra/core@1.25.0-alpha.2
  - @mastra/otel-exporter@1.0.16-alpha.0

## 0.2.2

### Patch Changes

- Updated dependencies [[`ef94400`](https://github.com/mastra-ai/mastra/commit/ef9440049402596b31f2ab976c5e4508f6cb6c91), [`3db852b`](https://github.com/mastra-ai/mastra/commit/3db852bff74e29f60d415a7b0f1583d6ce2bad92)]:
  - @mastra/core@1.24.1
  - @mastra/otel-exporter@1.0.15

## 0.2.2-alpha.0

### Patch Changes

- Updated dependencies [[`ef94400`](https://github.com/mastra-ai/mastra/commit/ef9440049402596b31f2ab976c5e4508f6cb6c91)]:
  - @mastra/core@1.24.1-alpha.0
  - @mastra/otel-exporter@1.0.15-alpha.0

## 0.2.1

### Patch Changes

- Updated dependencies [[`8db7663`](https://github.com/mastra-ai/mastra/commit/8db7663c9a9c735828094c359d2e327fd4f8fba3), [`153e864`](https://github.com/mastra-ai/mastra/commit/153e86476b425db7cd0dc8490050096e92964a38), [`715710d`](https://github.com/mastra-ai/mastra/commit/715710d12fa47cf88e09d41f13843eddc29327b0), [`378c6c4`](https://github.com/mastra-ai/mastra/commit/378c6c4755726e8d8cf83a14809b350b90d46c62), [`9f91fd5`](https://github.com/mastra-ai/mastra/commit/9f91fd538ab2a44f8cc740bcad8e51205f74fbea), [`ba6fa9c`](https://github.com/mastra-ai/mastra/commit/ba6fa9cc0f3e1912c49fd70d4c3bb8c44903ddaa)]:
  - @mastra/core@1.24.0
  - @mastra/otel-exporter@1.0.14

## 0.2.1-alpha.1

### Patch Changes

- Updated dependencies [[`8db7663`](https://github.com/mastra-ai/mastra/commit/8db7663c9a9c735828094c359d2e327fd4f8fba3), [`715710d`](https://github.com/mastra-ai/mastra/commit/715710d12fa47cf88e09d41f13843eddc29327b0), [`378c6c4`](https://github.com/mastra-ai/mastra/commit/378c6c4755726e8d8cf83a14809b350b90d46c62), [`9f91fd5`](https://github.com/mastra-ai/mastra/commit/9f91fd538ab2a44f8cc740bcad8e51205f74fbea), [`ba6fa9c`](https://github.com/mastra-ai/mastra/commit/ba6fa9cc0f3e1912c49fd70d4c3bb8c44903ddaa)]:
  - @mastra/core@1.24.0-alpha.1
  - @mastra/otel-exporter@1.0.14-alpha.1

## 0.2.1-alpha.0

### Patch Changes

- Updated dependencies [[`153e864`](https://github.com/mastra-ai/mastra/commit/153e86476b425db7cd0dc8490050096e92964a38)]:
  - @mastra/core@1.23.1-alpha.0
  - @mastra/otel-exporter@1.0.14-alpha.0

## 0.2.0

### Minor Changes

- Added @mastra/arthur observability provider for exporting Mastra traces to Arthur AI using OpenInference semantic conventions. Supports zero-config setup via ARTHUR_API_KEY, ARTHUR_BASE_URL, and ARTHUR_TASK_ID environment variables. ([#14643](https://github.com/mastra-ai/mastra/pull/14643))

### Patch Changes

- Updated dependencies [[`f32b9e1`](https://github.com/mastra-ai/mastra/commit/f32b9e115a3c754d1c8cfa3f4256fba87b09cfb7), [`7d6f521`](https://github.com/mastra-ai/mastra/commit/7d6f52164d0cca099f0b07cb2bba334360f1c8ab), [`a50d220`](https://github.com/mastra-ai/mastra/commit/a50d220b01ecbc5644d489a3d446c3bd4ab30245), [`665477b`](https://github.com/mastra-ai/mastra/commit/665477bc104fd52cfef8e7610d7664781a70c220), [`4cc2755`](https://github.com/mastra-ai/mastra/commit/4cc2755a7194cb08720ff2ab4dffb4b4a5103dfd), [`ac7baf6`](https://github.com/mastra-ai/mastra/commit/ac7baf66ef1db15e03975ef4ebb02724f015a391), [`ed425d7`](https://github.com/mastra-ai/mastra/commit/ed425d78e7c66cbda8209fee910856f98c6c6b82), [`1371703`](https://github.com/mastra-ai/mastra/commit/1371703835080450ef3f9aea58059a95d0da2e5a), [`0df8321`](https://github.com/mastra-ai/mastra/commit/0df832196eeb2450ab77ce887e8553abdd44c5a6), [`deb0888`](https://github.com/mastra-ai/mastra/commit/deb08881cd35468421dfb30bf5e2ec21cd1ca4e1), [`98f8a8b`](https://github.com/mastra-ai/mastra/commit/98f8a8bdf5761b9982f3ad3acbe7f1cc3efa71f3), [`ba6f7e9`](https://github.com/mastra-ai/mastra/commit/ba6f7e9086d8281393f2acae60fda61de3bff1f9), [`7eb2596`](https://github.com/mastra-ai/mastra/commit/7eb25960d607e07468c9a10c5437abd2deaf1e9a), [`1805ddc`](https://github.com/mastra-ai/mastra/commit/1805ddc9c9b3b14b63749735a13c05a45af43a80), [`fff91cf`](https://github.com/mastra-ai/mastra/commit/fff91cf914de0e731578aacebffdeebef82f0440), [`61109b3`](https://github.com/mastra-ai/mastra/commit/61109b34feb0e38d54bee4b8ca83eb7345b1d557), [`33f1ead`](https://github.com/mastra-ai/mastra/commit/33f1eadfa19c86953f593478e5fa371093b33779)]:
  - @mastra/core@1.23.0
  - @mastra/otel-exporter@1.0.13

## 0.2.0-alpha.0

### Minor Changes

- Added @mastra/arthur observability provider for exporting Mastra traces to Arthur AI using OpenInference semantic conventions. Supports zero-config setup via ARTHUR_API_KEY, ARTHUR_BASE_URL, and ARTHUR_TASK_ID environment variables. ([#14643](https://github.com/mastra-ai/mastra/pull/14643))

### Patch Changes

- Updated dependencies [[`ac7baf6`](https://github.com/mastra-ai/mastra/commit/ac7baf66ef1db15e03975ef4ebb02724f015a391), [`0df8321`](https://github.com/mastra-ai/mastra/commit/0df832196eeb2450ab77ce887e8553abdd44c5a6), [`deb0888`](https://github.com/mastra-ai/mastra/commit/deb08881cd35468421dfb30bf5e2ec21cd1ca4e1), [`61109b3`](https://github.com/mastra-ai/mastra/commit/61109b34feb0e38d54bee4b8ca83eb7345b1d557), [`33f1ead`](https://github.com/mastra-ai/mastra/commit/33f1eadfa19c86953f593478e5fa371093b33779)]:
  - @mastra/core@1.23.0-alpha.8
  - @mastra/otel-exporter@1.0.13-alpha.0
