# @mastra/dane

## 1.0.0-beta.0

### Major Changes

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- Rename RuntimeContext to RequestContext ([#9511](https://github.com/mastra-ai/mastra/pull/9511))

- Changing getAgents -> listAgents, getTools -> listTools, getWorkflows -> listWorkflows ([#9495](https://github.com/mastra-ai/mastra/pull/9495))

- Mark as stable ([`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc))

### Patch Changes

- Update tool execution signature ([#9587](https://github.com/mastra-ai/mastra/pull/9587))

  Consolidated the 3 different execution contexts to one

  ```typescript
  // before depending on the context the tool was executed in
  tool.execute({ context: data });
  tool.execute({ context: { inputData: data } });
  tool.execute(data);

  // now, for all contexts
  tool.execute(data, context);
  ```

  **Before:**

  ```typescript
  inputSchema: z.object({ something: z.string() }),
  execute: async ({ context, tracingContext, runId, ... }) => {
    return doSomething(context.string);
  }
  ```

  **After:**

  ```typescript
  inputSchema: z.object({ something: z.string() }),
  execute: async (inputData, context) => {
    const { agent, mcp, workflow, ...sharedContext } = context

    // context that only an agent would get like toolCallId, messages, suspend, resume, etc
    if (agent) {
      doSomething(inputData.something, agent)
    // context that only a workflow would get like runId, state, suspend, resume, etc
    } else if (workflow) {
      doSomething(inputData.something, workflow)
    // context that only a workflow would get like "extra", "elicitation"
    } else if (mcp) {
      doSomething(inputData.something, mcp)
    } else {
      // Running a tool in no execution context
      return doSomething(inputData.something);
    }
  }
  ```

- Updated dependencies [[`39c9743`](https://github.com/mastra-ai/mastra/commit/39c97432d084294f8ba85fbf3ef28098ff21459e), [`f743dbb`](https://github.com/mastra-ai/mastra/commit/f743dbb8b40d1627b5c10c0e6fc154f4ebb6e394), [`fec5129`](https://github.com/mastra-ai/mastra/commit/fec5129de7fc64423ea03661a56cef31dc747a0d), [`0491e7c`](https://github.com/mastra-ai/mastra/commit/0491e7c9b714cb0ba22187ee062147ec2dd7c712), [`f6f4903`](https://github.com/mastra-ai/mastra/commit/f6f4903397314f73362061dc5a3e8e7c61ea34aa), [`0e8ed46`](https://github.com/mastra-ai/mastra/commit/0e8ed467c54d6901a6a365f270ec15d6faadb36c), [`735d8c1`](https://github.com/mastra-ai/mastra/commit/735d8c1c0d19fbc09e6f8b66cf41bc7655993838), [`6c049d9`](https://github.com/mastra-ai/mastra/commit/6c049d94063fdcbd5b81c4912a2bf82a92c9cc0b), [`2f897df`](https://github.com/mastra-ai/mastra/commit/2f897df208508f46f51b7625e5dd20c37f93e0e3), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`3443770`](https://github.com/mastra-ai/mastra/commit/3443770662df8eb24c9df3589b2792d78cfcb811), [`f0a07e0`](https://github.com/mastra-ai/mastra/commit/f0a07e0111b3307c5fabfa4094c5c2cfb734fbe6), [`aaa40e7`](https://github.com/mastra-ai/mastra/commit/aaa40e788628b319baa8e889407d11ad626547fa), [`1521d71`](https://github.com/mastra-ai/mastra/commit/1521d716e5daedc74690c983fbd961123c56756b), [`9e1911d`](https://github.com/mastra-ai/mastra/commit/9e1911db2b4db85e0e768c3f15e0d61e319869f6), [`ebac155`](https://github.com/mastra-ai/mastra/commit/ebac15564a590117db7078233f927a7e28a85106), [`dd1c38d`](https://github.com/mastra-ai/mastra/commit/dd1c38d1b75f1b695c27b40d8d9d6ed00d5e0f6f), [`5948e6a`](https://github.com/mastra-ai/mastra/commit/5948e6a5146c83666ba3f294b2be576c82a513fb), [`8dcf9f9`](https://github.com/mastra-ai/mastra/commit/8dcf9f962dd6e074e0460aab4ddd2769eab5e172), [`8940859`](https://github.com/mastra-ai/mastra/commit/89408593658199b4ad67f7b65e888f344e64a442), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`e629310`](https://github.com/mastra-ai/mastra/commit/e629310f1a73fa236d49ec7a1d1cceb6229dc7cc), [`844ea5d`](https://github.com/mastra-ai/mastra/commit/844ea5dc0c248961e7bf73629ae7dcff503e853c), [`4c6b492`](https://github.com/mastra-ai/mastra/commit/4c6b492c4dd591c6a592520c1f6855d6e936d71f), [`dff01d8`](https://github.com/mastra-ai/mastra/commit/dff01d81ce1f4e4087cfac20fa868e6db138dd14), [`9d819d5`](https://github.com/mastra-ai/mastra/commit/9d819d54b61481639f4008e4694791bddf187edd), [`71c8d6c`](https://github.com/mastra-ai/mastra/commit/71c8d6c161253207b2b9588bdadb7eed604f7253), [`6179a9b`](https://github.com/mastra-ai/mastra/commit/6179a9ba36ffac326de3cc3c43cdc8028d37c251), [`00f4921`](https://github.com/mastra-ai/mastra/commit/00f4921dd2c91a1e5446799599ef7116a8214a1a), [`ca8041c`](https://github.com/mastra-ai/mastra/commit/ca8041cce0379fda22ed293a565bcb5b6ddca68a), [`7051bf3`](https://github.com/mastra-ai/mastra/commit/7051bf38b3b122a069008f861f7bfc004a6d9f6e), [`a8f1494`](https://github.com/mastra-ai/mastra/commit/a8f1494f4bbdc2770bcf327d4c7d869e332183f1), [`b88dd9d`](https://github.com/mastra-ai/mastra/commit/b88dd9dfd04a5f1a35d54f48eda944eac29923c2), [`0793497`](https://github.com/mastra-ai/mastra/commit/079349753620c40246ffd673e3f9d7d9820beff3), [`0d7618b`](https://github.com/mastra-ai/mastra/commit/0d7618bc650bf2800934b243eca5648f4aeed9c2), [`5df9cce`](https://github.com/mastra-ai/mastra/commit/5df9cce1a753438413f64c11eeef8f845745c2a8), [`a854ede`](https://github.com/mastra-ai/mastra/commit/a854ede62bf5ac0945a624ac48913dd69c73aabf), [`c576fc0`](https://github.com/mastra-ai/mastra/commit/c576fc0b100b2085afded91a37c97a0ea0ec09c7), [`3defc80`](https://github.com/mastra-ai/mastra/commit/3defc80cf2b88a1b7fc1cc4ddcb91e982a614609), [`16153fe`](https://github.com/mastra-ai/mastra/commit/16153fe7eb13c99401f48e6ca32707c965ee28b9), [`9f4a683`](https://github.com/mastra-ai/mastra/commit/9f4a6833e88b52574665c028fd5508ad5c2f6004), [`bc94344`](https://github.com/mastra-ai/mastra/commit/bc943444a1342d8a662151b7bce1df7dae32f59c), [`57d157f`](https://github.com/mastra-ai/mastra/commit/57d157f0b163a95c3e6c9eae31bdb11d1bfc64f9), [`903f67d`](https://github.com/mastra-ai/mastra/commit/903f67d184504a273893818c02b961f5423a79ad), [`2a90c55`](https://github.com/mastra-ai/mastra/commit/2a90c55a86a9210697d5adaab5ee94584b079adc), [`4c6b492`](https://github.com/mastra-ai/mastra/commit/4c6b492c4dd591c6a592520c1f6855d6e936d71f), [`eb09742`](https://github.com/mastra-ai/mastra/commit/eb09742197f66c4c38154c3beec78313e69760b2), [`ebac155`](https://github.com/mastra-ai/mastra/commit/ebac15564a590117db7078233f927a7e28a85106), [`96d35f6`](https://github.com/mastra-ai/mastra/commit/96d35f61376bc2b1bf148648a2c1985bd51bef55), [`5cbe88a`](https://github.com/mastra-ai/mastra/commit/5cbe88aefbd9f933bca669fd371ea36bf939ac6d), [`a1bd7b8`](https://github.com/mastra-ai/mastra/commit/a1bd7b8571db16b94eb01588f451a74758c96d65), [`d78b38d`](https://github.com/mastra-ai/mastra/commit/d78b38d898fce285260d3bbb4befade54331617f), [`0633100`](https://github.com/mastra-ai/mastra/commit/0633100a911ad22f5256471bdf753da21c104742), [`c710c16`](https://github.com/mastra-ai/mastra/commit/c710c1652dccfdc4111c8412bca7a6bb1d48b441), [`354ad0b`](https://github.com/mastra-ai/mastra/commit/354ad0b7b1b8183ac567f236a884fc7ede6d7138), [`cfae733`](https://github.com/mastra-ai/mastra/commit/cfae73394f4920635e6c919c8e95ff9a0788e2e5), [`e3dfda7`](https://github.com/mastra-ai/mastra/commit/e3dfda7b11bf3b8c4bb55637028befb5f387fc74), [`844ea5d`](https://github.com/mastra-ai/mastra/commit/844ea5dc0c248961e7bf73629ae7dcff503e853c), [`398fde3`](https://github.com/mastra-ai/mastra/commit/398fde3f39e707cda79372cdae8f9870e3b57c8d), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`0d7618b`](https://github.com/mastra-ai/mastra/commit/0d7618bc650bf2800934b243eca5648f4aeed9c2), [`7b763e5`](https://github.com/mastra-ai/mastra/commit/7b763e52fc3eaf699c2a99f2adf418dd46e4e9a5), [`d36cfbb`](https://github.com/mastra-ai/mastra/commit/d36cfbbb6565ba5f827883cc9bb648eb14befdc1), [`3697853`](https://github.com/mastra-ai/mastra/commit/3697853deeb72017d90e0f38a93c1e29221aeca0), [`b2e45ec`](https://github.com/mastra-ai/mastra/commit/b2e45eca727a8db01a81ba93f1a5219c7183c839), [`9d819d5`](https://github.com/mastra-ai/mastra/commit/9d819d54b61481639f4008e4694791bddf187edd), [`d6d49f7`](https://github.com/mastra-ai/mastra/commit/d6d49f7b8714fa19a52ff9c7cf7fb7e73751901e), [`a534e95`](https://github.com/mastra-ai/mastra/commit/a534e9591f83b3cc1ebff99c67edf4cda7bf81d3), [`9d0e7fe`](https://github.com/mastra-ai/mastra/commit/9d0e7feca8ed98de959f53476ee1456073673348), [`53d927c`](https://github.com/mastra-ai/mastra/commit/53d927cc6f03bff33655b7e2b788da445a08731d), [`3f2faf2`](https://github.com/mastra-ai/mastra/commit/3f2faf2e2d685d6c053cc5af1bf9fedf267b2ce5), [`22f64bc`](https://github.com/mastra-ai/mastra/commit/22f64bc1d37149480b58bf2fefe35b79a1e3e7d5), [`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc), [`dff01d8`](https://github.com/mastra-ai/mastra/commit/dff01d81ce1f4e4087cfac20fa868e6db138dd14), [`b7959e6`](https://github.com/mastra-ai/mastra/commit/b7959e6e25a46b480f9ea2217c4c6c588c423791), [`bda6370`](https://github.com/mastra-ai/mastra/commit/bda637009360649aaf579919e7873e33553c273e), [`245820c`](https://github.com/mastra-ai/mastra/commit/245820cdea463218fd1c4e62eb2a349d6520fe71), [`d7acd8e`](https://github.com/mastra-ai/mastra/commit/d7acd8e987b5d7eff4fd98b0906c17c06a2e83d5), [`c7f1f7d`](https://github.com/mastra-ai/mastra/commit/c7f1f7d24f61f247f018cc2d1f33bf63212959a7), [`0bddc6d`](https://github.com/mastra-ai/mastra/commit/0bddc6d8dbd6f6008c0cba2e4960a2da75a55af1), [`735d8c1`](https://github.com/mastra-ai/mastra/commit/735d8c1c0d19fbc09e6f8b66cf41bc7655993838), [`acf322e`](https://github.com/mastra-ai/mastra/commit/acf322e0f1fd0189684cf529d91c694bea918a45), [`c942802`](https://github.com/mastra-ai/mastra/commit/c942802a477a925b01859a7b8688d4355715caaa), [`a0c8c1b`](https://github.com/mastra-ai/mastra/commit/a0c8c1b87d4fee252aebda73e8637fbe01d761c9), [`cc34739`](https://github.com/mastra-ai/mastra/commit/cc34739c34b6266a91bea561119240a7acf47887), [`c218bd3`](https://github.com/mastra-ai/mastra/commit/c218bd3759e32423735b04843a09404572631014), [`2c4438b`](https://github.com/mastra-ai/mastra/commit/2c4438b87817ab7eed818c7990fef010475af1a3), [`2b8893c`](https://github.com/mastra-ai/mastra/commit/2b8893cb108ef9acb72ee7835cd625610d2c1a4a), [`c218bd3`](https://github.com/mastra-ai/mastra/commit/c218bd3759e32423735b04843a09404572631014), [`8e5c75b`](https://github.com/mastra-ai/mastra/commit/8e5c75bdb1d08a42d45309a4c72def4b6890230f), [`e59e0d3`](https://github.com/mastra-ai/mastra/commit/e59e0d32afb5fcf2c9f3c00c8f81f6c21d3a63fa), [`fa8409b`](https://github.com/mastra-ai/mastra/commit/fa8409bc39cfd8ba6643b9db5269b90b22e2a2f7), [`173c535`](https://github.com/mastra-ai/mastra/commit/173c535c0645b0da404fe09f003778f0b0d4e019), [`85436ef`](https://github.com/mastra-ai/mastra/commit/85436efc3526e3477b8c09ea02de01a2d1c41693)]:
  - @mastra/core@1.0.0-beta.0
  - @mastra/upstash@1.0.0-beta.0
  - @mastra/libsql@1.0.0-beta.0
  - @mastra/memory@1.0.0-beta.0
  - @mastra/mcp@1.0.0-beta.0
  - @mastra/rag@2.0.0-beta.0

## 0.1.12

### Patch Changes

- Updated dependencies [[`2b031e2`](https://github.com/mastra-ai/mastra/commit/2b031e25ca10cd3e4d63e6a27f909cba26d91405)]:
  - @mastra/core@0.22.2

## 0.1.12-alpha.0

### Patch Changes

- Updated dependencies [[`2b031e2`](https://github.com/mastra-ai/mastra/commit/2b031e25ca10cd3e4d63e6a27f909cba26d91405)]:
  - @mastra/core@0.22.2-alpha.0

## 0.1.11

### Patch Changes

- Updated dependencies []:
  - @mastra/core@0.22.1

## 0.1.11-alpha.0

### Patch Changes

- Updated dependencies []:
  - @mastra/core@0.22.1-alpha.0

## 0.1.10

### Patch Changes

- Updated dependencies [[`c67ca32`](https://github.com/mastra-ai/mastra/commit/c67ca32e3c2cf69bfc146580770c720220ca44ac), [`efb5ed9`](https://github.com/mastra-ai/mastra/commit/efb5ed946ae7f410bc68c9430beb4b010afd25ec), [`dbc9e12`](https://github.com/mastra-ai/mastra/commit/dbc9e1216ba575ba59ead4afb727a01215f7de4f), [`99e41b9`](https://github.com/mastra-ai/mastra/commit/99e41b94957cdd25137d3ac12e94e8b21aa01b68), [`c28833c`](https://github.com/mastra-ai/mastra/commit/c28833c5b6d8e10eeffd7f7d39129d53b8bca240), [`8ea07b4`](https://github.com/mastra-ai/mastra/commit/8ea07b4bdc73e4218437dbb6dcb0f4b23e745a44), [`ba201b8`](https://github.com/mastra-ai/mastra/commit/ba201b8f8feac4c72350f2dbd52c13c7297ba7b0), [`f053e89`](https://github.com/mastra-ai/mastra/commit/f053e89160dbd0bd3333fc3492f68231b5c7c349), [`4fc4136`](https://github.com/mastra-ai/mastra/commit/4fc413652866a8d2240694fddb2562e9edbb70df), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`d10baf5`](https://github.com/mastra-ai/mastra/commit/d10baf5a3c924f2a6654e23a3e318ed03f189b76), [`038c55a`](https://github.com/mastra-ai/mastra/commit/038c55a7090fc1b1513a966386d3072617f836ac), [`182f045`](https://github.com/mastra-ai/mastra/commit/182f0458f25bd70aa774e64fd923c8a483eddbf1), [`9a1a485`](https://github.com/mastra-ai/mastra/commit/9a1a4859b855e37239f652bf14b1ecd1029b8c4e), [`9257233`](https://github.com/mastra-ai/mastra/commit/9257233c4ffce09b2bedc2a9adbd70d7a83fa8e2), [`7620d2b`](https://github.com/mastra-ai/mastra/commit/7620d2bddeb4fae4c3c0a0b4e672969795fca11a), [`b2365f0`](https://github.com/mastra-ai/mastra/commit/b2365f038dd4c5f06400428b224af963f399ad50), [`0f1a4c9`](https://github.com/mastra-ai/mastra/commit/0f1a4c984fb4b104b2f0b63ba18c9fa77f567700), [`9029ba3`](https://github.com/mastra-ai/mastra/commit/9029ba34459c8859fed4c6b73efd8e2d0021e7ba), [`426cc56`](https://github.com/mastra-ai/mastra/commit/426cc561c85ae76a112ded2385532a91f9f9f074), [`00931fb`](https://github.com/mastra-ai/mastra/commit/00931fb1a21aa42c4fbc20c2c40dd62466b8fc8f), [`e473bfe`](https://github.com/mastra-ai/mastra/commit/e473bfe416c0b8e876973c2b6a6f13c394b7a93f), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`2db6160`](https://github.com/mastra-ai/mastra/commit/2db6160e2022ff8827c15d30157e684683b934b5), [`8aeea37`](https://github.com/mastra-ai/mastra/commit/8aeea37efdde347c635a67fed56794943b7f74ec), [`02fe153`](https://github.com/mastra-ai/mastra/commit/02fe15351d6021d214da48ec982a0e9e4150bcee), [`648e2ca`](https://github.com/mastra-ai/mastra/commit/648e2ca42da54838c6ccbdaadc6fadd808fa6b86), [`74567b3`](https://github.com/mastra-ai/mastra/commit/74567b3d237ae3915cd0bca3cf55fa0a64e4e4a4), [`b65c5e0`](https://github.com/mastra-ai/mastra/commit/b65c5e0fe6f3c390a9a8bbcf69304d972c3a4afb), [`7d35388`](https://github.com/mastra-ai/mastra/commit/7d35388b9bbb0adfd80658fefbe0b2ac3f7af6eb), [`15a1733`](https://github.com/mastra-ai/mastra/commit/15a1733074cee8bd37370e1af34cd818e89fa7ac), [`02fe153`](https://github.com/mastra-ai/mastra/commit/02fe15351d6021d214da48ec982a0e9e4150bcee), [`fc2a774`](https://github.com/mastra-ai/mastra/commit/fc2a77468981aaddc3e77f83f0c4ad4a4af140da), [`4e08933`](https://github.com/mastra-ai/mastra/commit/4e08933625464dfde178347af5b6278fcf34188e), [`10188d6`](https://github.com/mastra-ai/mastra/commit/10188d632a729010441f9c7e2a41eab60afccb23)]:
  - @mastra/core@0.22.0
  - @mastra/libsql@0.16.0
  - @mastra/mcp@0.14.0
  - @mastra/memory@0.15.8
  - @mastra/upstash@0.15.6
  - @mastra/rag@1.3.2

## 0.1.10-alpha.1

### Patch Changes

- Updated dependencies [[`efb5ed9`](https://github.com/mastra-ai/mastra/commit/efb5ed946ae7f410bc68c9430beb4b010afd25ec), [`8ea07b4`](https://github.com/mastra-ai/mastra/commit/8ea07b4bdc73e4218437dbb6dcb0f4b23e745a44), [`ba201b8`](https://github.com/mastra-ai/mastra/commit/ba201b8f8feac4c72350f2dbd52c13c7297ba7b0), [`4fc4136`](https://github.com/mastra-ai/mastra/commit/4fc413652866a8d2240694fddb2562e9edbb70df), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`d10baf5`](https://github.com/mastra-ai/mastra/commit/d10baf5a3c924f2a6654e23a3e318ed03f189b76), [`038c55a`](https://github.com/mastra-ai/mastra/commit/038c55a7090fc1b1513a966386d3072617f836ac), [`182f045`](https://github.com/mastra-ai/mastra/commit/182f0458f25bd70aa774e64fd923c8a483eddbf1), [`7620d2b`](https://github.com/mastra-ai/mastra/commit/7620d2bddeb4fae4c3c0a0b4e672969795fca11a), [`b2365f0`](https://github.com/mastra-ai/mastra/commit/b2365f038dd4c5f06400428b224af963f399ad50), [`9029ba3`](https://github.com/mastra-ai/mastra/commit/9029ba34459c8859fed4c6b73efd8e2d0021e7ba), [`426cc56`](https://github.com/mastra-ai/mastra/commit/426cc561c85ae76a112ded2385532a91f9f9f074), [`00931fb`](https://github.com/mastra-ai/mastra/commit/00931fb1a21aa42c4fbc20c2c40dd62466b8fc8f), [`e473bfe`](https://github.com/mastra-ai/mastra/commit/e473bfe416c0b8e876973c2b6a6f13c394b7a93f), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`648e2ca`](https://github.com/mastra-ai/mastra/commit/648e2ca42da54838c6ccbdaadc6fadd808fa6b86), [`b65c5e0`](https://github.com/mastra-ai/mastra/commit/b65c5e0fe6f3c390a9a8bbcf69304d972c3a4afb), [`7d35388`](https://github.com/mastra-ai/mastra/commit/7d35388b9bbb0adfd80658fefbe0b2ac3f7af6eb), [`10188d6`](https://github.com/mastra-ai/mastra/commit/10188d632a729010441f9c7e2a41eab60afccb23)]:
  - @mastra/core@0.22.0-alpha.1
  - @mastra/mcp@0.14.0-alpha.0
  - @mastra/memory@0.15.8-alpha.0
  - @mastra/upstash@0.15.6-alpha.0
  - @mastra/libsql@0.16.0-alpha.1
  - @mastra/rag@1.3.2-alpha.0

## 0.1.10-alpha.0

### Patch Changes

- Updated dependencies [[`c67ca32`](https://github.com/mastra-ai/mastra/commit/c67ca32e3c2cf69bfc146580770c720220ca44ac), [`dbc9e12`](https://github.com/mastra-ai/mastra/commit/dbc9e1216ba575ba59ead4afb727a01215f7de4f), [`99e41b9`](https://github.com/mastra-ai/mastra/commit/99e41b94957cdd25137d3ac12e94e8b21aa01b68), [`c28833c`](https://github.com/mastra-ai/mastra/commit/c28833c5b6d8e10eeffd7f7d39129d53b8bca240), [`f053e89`](https://github.com/mastra-ai/mastra/commit/f053e89160dbd0bd3333fc3492f68231b5c7c349), [`9a1a485`](https://github.com/mastra-ai/mastra/commit/9a1a4859b855e37239f652bf14b1ecd1029b8c4e), [`9257233`](https://github.com/mastra-ai/mastra/commit/9257233c4ffce09b2bedc2a9adbd70d7a83fa8e2), [`0f1a4c9`](https://github.com/mastra-ai/mastra/commit/0f1a4c984fb4b104b2f0b63ba18c9fa77f567700), [`2db6160`](https://github.com/mastra-ai/mastra/commit/2db6160e2022ff8827c15d30157e684683b934b5), [`8aeea37`](https://github.com/mastra-ai/mastra/commit/8aeea37efdde347c635a67fed56794943b7f74ec), [`02fe153`](https://github.com/mastra-ai/mastra/commit/02fe15351d6021d214da48ec982a0e9e4150bcee), [`74567b3`](https://github.com/mastra-ai/mastra/commit/74567b3d237ae3915cd0bca3cf55fa0a64e4e4a4), [`15a1733`](https://github.com/mastra-ai/mastra/commit/15a1733074cee8bd37370e1af34cd818e89fa7ac), [`02fe153`](https://github.com/mastra-ai/mastra/commit/02fe15351d6021d214da48ec982a0e9e4150bcee), [`fc2a774`](https://github.com/mastra-ai/mastra/commit/fc2a77468981aaddc3e77f83f0c4ad4a4af140da), [`4e08933`](https://github.com/mastra-ai/mastra/commit/4e08933625464dfde178347af5b6278fcf34188e)]:
  - @mastra/core@0.21.2-alpha.0
  - @mastra/libsql@0.16.0-alpha.0

## 0.1.9

### Patch Changes

- Updated dependencies [[`ca85c93`](https://github.com/mastra-ai/mastra/commit/ca85c932b232e6ad820c811ec176d98e68c59b0a), [`a1d40f8`](https://github.com/mastra-ai/mastra/commit/a1d40f88d4ce42c4508774ad22e38ac582157af2), [`01c4a25`](https://github.com/mastra-ai/mastra/commit/01c4a2506c514d5e861c004d3d2fb3791c6391f3), [`cce8aad`](https://github.com/mastra-ai/mastra/commit/cce8aad878a0dd98e5647680f3765caba0b1701c)]:
  - @mastra/core@0.21.1

## 0.1.9-alpha.0

### Patch Changes

- Updated dependencies [[`ca85c93`](https://github.com/mastra-ai/mastra/commit/ca85c932b232e6ad820c811ec176d98e68c59b0a), [`a1d40f8`](https://github.com/mastra-ai/mastra/commit/a1d40f88d4ce42c4508774ad22e38ac582157af2), [`01c4a25`](https://github.com/mastra-ai/mastra/commit/01c4a2506c514d5e861c004d3d2fb3791c6391f3), [`cce8aad`](https://github.com/mastra-ai/mastra/commit/cce8aad878a0dd98e5647680f3765caba0b1701c)]:
  - @mastra/core@0.21.1-alpha.0

## 0.1.8

### Patch Changes

- Updated dependencies [[`2288200`](https://github.com/mastra-ai/mastra/commit/22882001be465d960a88f2c7f9ff1502787eefe8), [`f368e7b`](https://github.com/mastra-ai/mastra/commit/f368e7b19436a14e5771c46810e5ae93a2faf2e9), [`f368e7b`](https://github.com/mastra-ai/mastra/commit/f368e7b19436a14e5771c46810e5ae93a2faf2e9), [`1ed9670`](https://github.com/mastra-ai/mastra/commit/1ed9670d3ca50cb60dc2e517738c5eef3968ed27), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`f59fc1e`](https://github.com/mastra-ai/mastra/commit/f59fc1e406b8912e692f6bff6cfd4754cc8d165c), [`16f1c10`](https://github.com/mastra-ai/mastra/commit/16f1c1062530419e3dc1c4076dc5e54872b15019), [`158381d`](https://github.com/mastra-ai/mastra/commit/158381d39335be934b81ef8a1947bccace492c25), [`a1799bc`](https://github.com/mastra-ai/mastra/commit/a1799bcc1b5a1cdc188f2ac0165f17a1c4ac6f7b), [`6ff6094`](https://github.com/mastra-ai/mastra/commit/6ff60946f4ecfebdeef6e21d2b230c2204f2c9b8), [`2ddb851`](https://github.com/mastra-ai/mastra/commit/2ddb8519c4b6f1d31be10ffd33b41d2b649a04ff), [`fb703b9`](https://github.com/mastra-ai/mastra/commit/fb703b9634eeaff1a6eb2b5531ce0f9e8fb04727), [`37a2314`](https://github.com/mastra-ai/mastra/commit/37a23148e0e5a3b40d4f9f098b194671a8a49faf), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`05a9dee`](https://github.com/mastra-ai/mastra/commit/05a9dee3d355694d28847bfffb6289657fcf7dfa), [`e3c1077`](https://github.com/mastra-ai/mastra/commit/e3c107763aedd1643d3def5df450c235da9ff76c), [`1908ca0`](https://github.com/mastra-ai/mastra/commit/1908ca0521f90e43779cc29ab590173ca560443c), [`1bccdb3`](https://github.com/mastra-ai/mastra/commit/1bccdb33eb90cbeba2dc5ece1c2561fb774b26b6), [`5ef944a`](https://github.com/mastra-ai/mastra/commit/5ef944a3721d93105675cac2b2311432ff8cc393), [`228228b`](https://github.com/mastra-ai/mastra/commit/228228b0b1de9291cb8887587f5cea1a8757ebad), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`d6b186f`](https://github.com/mastra-ai/mastra/commit/d6b186fb08f1caf1b86f73d3a5ee88fb999ca3be), [`ee68e82`](https://github.com/mastra-ai/mastra/commit/ee68e8289ea4408d29849e899bc6e78b3bd4e843), [`228228b`](https://github.com/mastra-ai/mastra/commit/228228b0b1de9291cb8887587f5cea1a8757ebad), [`ea33930`](https://github.com/mastra-ai/mastra/commit/ea339301e82d6318257720d811b043014ee44064), [`65493b3`](https://github.com/mastra-ai/mastra/commit/65493b31c36f6fdb78f9679f7e1ecf0c250aa5ee), [`a998b8f`](https://github.com/mastra-ai/mastra/commit/a998b8f858091c2ec47683e60766cf12d03001e4), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`8a37bdd`](https://github.com/mastra-ai/mastra/commit/8a37bddb6d8614a32c5b70303d583d80c620ea61), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`135d6f2`](https://github.com/mastra-ai/mastra/commit/135d6f22a326ed1dffff858700669dff09d2c9eb)]:
  - @mastra/memory@0.15.7
  - @mastra/upstash@0.15.5
  - @mastra/core@0.21.0
  - @mastra/mcp@0.13.5
  - @mastra/rag@1.3.1
  - @mastra/libsql@0.15.2

## 0.1.8-alpha.4

### Patch Changes

- Updated dependencies [[`1908ca0`](https://github.com/mastra-ai/mastra/commit/1908ca0521f90e43779cc29ab590173ca560443c)]:
  - @mastra/core@0.21.0-alpha.4

## 0.1.8-alpha.3

### Patch Changes

- Updated dependencies [[`a1799bc`](https://github.com/mastra-ai/mastra/commit/a1799bcc1b5a1cdc188f2ac0165f17a1c4ac6f7b), [`6ff6094`](https://github.com/mastra-ai/mastra/commit/6ff60946f4ecfebdeef6e21d2b230c2204f2c9b8)]:
  - @mastra/core@0.21.0-alpha.3

## 0.1.8-alpha.2

### Patch Changes

- Updated dependencies [[`f59fc1e`](https://github.com/mastra-ai/mastra/commit/f59fc1e406b8912e692f6bff6cfd4754cc8d165c)]:
  - @mastra/core@0.21.0-alpha.2

## 0.1.8-alpha.1

### Patch Changes

- Updated dependencies [[`1ed9670`](https://github.com/mastra-ai/mastra/commit/1ed9670d3ca50cb60dc2e517738c5eef3968ed27), [`16f1c10`](https://github.com/mastra-ai/mastra/commit/16f1c1062530419e3dc1c4076dc5e54872b15019), [`158381d`](https://github.com/mastra-ai/mastra/commit/158381d39335be934b81ef8a1947bccace492c25), [`fb703b9`](https://github.com/mastra-ai/mastra/commit/fb703b9634eeaff1a6eb2b5531ce0f9e8fb04727), [`37a2314`](https://github.com/mastra-ai/mastra/commit/37a23148e0e5a3b40d4f9f098b194671a8a49faf), [`05a9dee`](https://github.com/mastra-ai/mastra/commit/05a9dee3d355694d28847bfffb6289657fcf7dfa), [`e3c1077`](https://github.com/mastra-ai/mastra/commit/e3c107763aedd1643d3def5df450c235da9ff76c), [`1bccdb3`](https://github.com/mastra-ai/mastra/commit/1bccdb33eb90cbeba2dc5ece1c2561fb774b26b6), [`5ef944a`](https://github.com/mastra-ai/mastra/commit/5ef944a3721d93105675cac2b2311432ff8cc393), [`d6b186f`](https://github.com/mastra-ai/mastra/commit/d6b186fb08f1caf1b86f73d3a5ee88fb999ca3be), [`65493b3`](https://github.com/mastra-ai/mastra/commit/65493b31c36f6fdb78f9679f7e1ecf0c250aa5ee), [`a998b8f`](https://github.com/mastra-ai/mastra/commit/a998b8f858091c2ec47683e60766cf12d03001e4), [`8a37bdd`](https://github.com/mastra-ai/mastra/commit/8a37bddb6d8614a32c5b70303d583d80c620ea61)]:
  - @mastra/core@0.21.0-alpha.1
  - @mastra/memory@0.15.7-alpha.1

## 0.1.8-alpha.0

### Patch Changes

- Updated dependencies [[`2288200`](https://github.com/mastra-ai/mastra/commit/22882001be465d960a88f2c7f9ff1502787eefe8), [`f368e7b`](https://github.com/mastra-ai/mastra/commit/f368e7b19436a14e5771c46810e5ae93a2faf2e9), [`f368e7b`](https://github.com/mastra-ai/mastra/commit/f368e7b19436a14e5771c46810e5ae93a2faf2e9), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`2ddb851`](https://github.com/mastra-ai/mastra/commit/2ddb8519c4b6f1d31be10ffd33b41d2b649a04ff), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`228228b`](https://github.com/mastra-ai/mastra/commit/228228b0b1de9291cb8887587f5cea1a8757ebad), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`ee68e82`](https://github.com/mastra-ai/mastra/commit/ee68e8289ea4408d29849e899bc6e78b3bd4e843), [`228228b`](https://github.com/mastra-ai/mastra/commit/228228b0b1de9291cb8887587f5cea1a8757ebad), [`ea33930`](https://github.com/mastra-ai/mastra/commit/ea339301e82d6318257720d811b043014ee44064), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`135d6f2`](https://github.com/mastra-ai/mastra/commit/135d6f22a326ed1dffff858700669dff09d2c9eb), [`59d036d`](https://github.com/mastra-ai/mastra/commit/59d036d4c2706b430b0e3f1f1e0ee853ce16ca04)]:
  - @mastra/memory@0.15.7-alpha.0
  - @mastra/upstash@0.15.5-alpha.0
  - @mastra/core@0.21.0-alpha.0
  - @mastra/mcp@0.13.5-alpha.0
  - @mastra/rag@1.3.1-alpha.0
  - @mastra/libsql@0.15.2-alpha.0

## 0.1.7

### Patch Changes

- Updated dependencies [[`07eaf25`](https://github.com/mastra-ai/mastra/commit/07eaf25aada9e42235dbf905854de53da4d8121b), [`0d71771`](https://github.com/mastra-ai/mastra/commit/0d71771f5711164c79f8e80919bc84d6bffeb6bc), [`0d6e55e`](https://github.com/mastra-ai/mastra/commit/0d6e55ecc5a2e689cd4fc9c86525e0eb54d82372), [`68b1111`](https://github.com/mastra-ai/mastra/commit/68b11118a1303f93e9c0c157850c0751309304c5)]:
  - @mastra/core@0.20.2

## 0.1.7-alpha.1

### Patch Changes

- Updated dependencies [[`07eaf25`](https://github.com/mastra-ai/mastra/commit/07eaf25aada9e42235dbf905854de53da4d8121b), [`68b1111`](https://github.com/mastra-ai/mastra/commit/68b11118a1303f93e9c0c157850c0751309304c5)]:
  - @mastra/core@0.20.2-alpha.1

## 0.1.7-alpha.0

### Patch Changes

- Updated dependencies [[`0d71771`](https://github.com/mastra-ai/mastra/commit/0d71771f5711164c79f8e80919bc84d6bffeb6bc), [`0d6e55e`](https://github.com/mastra-ai/mastra/commit/0d6e55ecc5a2e689cd4fc9c86525e0eb54d82372)]:
  - @mastra/core@0.20.2-alpha.0

## 0.1.6

### Patch Changes

- Mutable shared workflow run state ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- Updated dependencies [[`c621613`](https://github.com/mastra-ai/mastra/commit/c621613069173c69eb2c3ef19a5308894c6549f0), [`12b1189`](https://github.com/mastra-ai/mastra/commit/12b118942445e4de0dd916c593e33ec78dc3bc73), [`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`076b092`](https://github.com/mastra-ai/mastra/commit/076b0924902ff0f49d5712d2df24c4cca683713f), [`2aee9e7`](https://github.com/mastra-ai/mastra/commit/2aee9e7d188b8b256a4ddc203ccefb366b4867fa), [`c582906`](https://github.com/mastra-ai/mastra/commit/c5829065a346260f96c4beb8af131b94804ae3ad), [`fa2eb96`](https://github.com/mastra-ai/mastra/commit/fa2eb96af16c7d433891a73932764960d3235c1d), [`ee9108f`](https://github.com/mastra-ai/mastra/commit/ee9108fa29bb8368fc23df158c9f0645b2d7b65c), [`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`a739d0c`](https://github.com/mastra-ai/mastra/commit/a739d0c8b37cd89569e04a6ca0827083c6167e19), [`603e927`](https://github.com/mastra-ai/mastra/commit/603e9279db8bf8a46caf83881c6b7389ccffff7e), [`cd45982`](https://github.com/mastra-ai/mastra/commit/cd4598291cda128a88738734ae6cbef076ebdebd), [`874f74d`](https://github.com/mastra-ai/mastra/commit/874f74da4b1acf6517f18132d035612c3ecc394a), [`b728a45`](https://github.com/mastra-ai/mastra/commit/b728a45ab3dba59da0f5ee36b81fe246659f305d), [`0baf2ba`](https://github.com/mastra-ai/mastra/commit/0baf2bab8420277072ef1f95df5ea7b0a2f61fe7), [`0ec8b4a`](https://github.com/mastra-ai/mastra/commit/0ec8b4a358db917016f45f1b5df3c81831c51834), [`10e633a`](https://github.com/mastra-ai/mastra/commit/10e633a07d333466d9734c97acfc3dbf757ad2d0), [`a6d69c5`](https://github.com/mastra-ai/mastra/commit/a6d69c5fb50c0875b46275811fece5862f03c6a0), [`84199af`](https://github.com/mastra-ai/mastra/commit/84199af8673f6f9cb59286ffb5477a41932775de), [`7f431af`](https://github.com/mastra-ai/mastra/commit/7f431afd586b7d3265075e73106eb73167edbb86), [`26e968d`](https://github.com/mastra-ai/mastra/commit/26e968db2171ded9e4d47aa1b4f19e1e771158d0), [`cbd3fb6`](https://github.com/mastra-ai/mastra/commit/cbd3fb65adb03a7c0df193cb998aed5ac56675ee)]:
  - @mastra/core@0.20.1
  - @mastra/mcp@0.13.4
  - @mastra/memory@0.15.6

## 0.1.6-alpha.4

### Patch Changes

- Updated dependencies [[`b728a45`](https://github.com/mastra-ai/mastra/commit/b728a45ab3dba59da0f5ee36b81fe246659f305d)]:
  - @mastra/core@0.20.1-alpha.4

## 0.1.6-alpha.3

### Patch Changes

- Updated dependencies [[`a6d69c5`](https://github.com/mastra-ai/mastra/commit/a6d69c5fb50c0875b46275811fece5862f03c6a0), [`84199af`](https://github.com/mastra-ai/mastra/commit/84199af8673f6f9cb59286ffb5477a41932775de), [`7f431af`](https://github.com/mastra-ai/mastra/commit/7f431afd586b7d3265075e73106eb73167edbb86)]:
  - @mastra/core@0.20.1-alpha.3
  - @mastra/memory@0.15.6-alpha.1

## 0.1.6-alpha.2

### Patch Changes

- Updated dependencies [[`ee9108f`](https://github.com/mastra-ai/mastra/commit/ee9108fa29bb8368fc23df158c9f0645b2d7b65c)]:
  - @mastra/core@0.20.1-alpha.2

## 0.1.6-alpha.1

### Patch Changes

- Mutable shared workflow run state ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- Updated dependencies [[`c621613`](https://github.com/mastra-ai/mastra/commit/c621613069173c69eb2c3ef19a5308894c6549f0), [`12b1189`](https://github.com/mastra-ai/mastra/commit/12b118942445e4de0dd916c593e33ec78dc3bc73), [`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`076b092`](https://github.com/mastra-ai/mastra/commit/076b0924902ff0f49d5712d2df24c4cca683713f), [`2aee9e7`](https://github.com/mastra-ai/mastra/commit/2aee9e7d188b8b256a4ddc203ccefb366b4867fa), [`c582906`](https://github.com/mastra-ai/mastra/commit/c5829065a346260f96c4beb8af131b94804ae3ad), [`fa2eb96`](https://github.com/mastra-ai/mastra/commit/fa2eb96af16c7d433891a73932764960d3235c1d), [`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`a739d0c`](https://github.com/mastra-ai/mastra/commit/a739d0c8b37cd89569e04a6ca0827083c6167e19), [`603e927`](https://github.com/mastra-ai/mastra/commit/603e9279db8bf8a46caf83881c6b7389ccffff7e), [`cd45982`](https://github.com/mastra-ai/mastra/commit/cd4598291cda128a88738734ae6cbef076ebdebd), [`874f74d`](https://github.com/mastra-ai/mastra/commit/874f74da4b1acf6517f18132d035612c3ecc394a), [`0baf2ba`](https://github.com/mastra-ai/mastra/commit/0baf2bab8420277072ef1f95df5ea7b0a2f61fe7), [`0ec8b4a`](https://github.com/mastra-ai/mastra/commit/0ec8b4a358db917016f45f1b5df3c81831c51834), [`26e968d`](https://github.com/mastra-ai/mastra/commit/26e968db2171ded9e4d47aa1b4f19e1e771158d0), [`cbd3fb6`](https://github.com/mastra-ai/mastra/commit/cbd3fb65adb03a7c0df193cb998aed5ac56675ee)]:
  - @mastra/core@0.20.1-alpha.1
  - @mastra/mcp@0.13.4-alpha.0
  - @mastra/memory@0.15.6-alpha.0

## 0.1.6-alpha.0

### Patch Changes

- Updated dependencies [[`10e633a`](https://github.com/mastra-ai/mastra/commit/10e633a07d333466d9734c97acfc3dbf757ad2d0)]:
  - @mastra/core@0.20.1-alpha.0

## 0.1.5

### Patch Changes

- Updated dependencies [[`00cb6bd`](https://github.com/mastra-ai/mastra/commit/00cb6bdf78737c0fac14a5a0c7b532a11e38558a), [`869ba22`](https://github.com/mastra-ai/mastra/commit/869ba222e1d6b58fc1b65e7c9fd55ca4e01b8c2f), [`1b73665`](https://github.com/mastra-ai/mastra/commit/1b73665e8e23f5c09d49fcf3e7d709c75259259e), [`f7d7475`](https://github.com/mastra-ai/mastra/commit/f7d747507341aef60ed39e4b49318db1f86034a6), [`084b77b`](https://github.com/mastra-ai/mastra/commit/084b77b2955960e0190af8db3f77138aa83ed65c), [`a93ff84`](https://github.com/mastra-ai/mastra/commit/a93ff84b5e1af07ee236ac8873dac9b49aa5d501), [`bc5aacb`](https://github.com/mastra-ai/mastra/commit/bc5aacb646d468d325327e36117129f28cd13bf6), [`03622f8`](https://github.com/mastra-ai/mastra/commit/03622f86e9d7342197f80f95333ea3ff65c783ae), [`6b5af12`](https://github.com/mastra-ai/mastra/commit/6b5af12ce9e09066e0c32e821c203a6954498bea), [`bf60e4a`](https://github.com/mastra-ai/mastra/commit/bf60e4a89c515afd9570b7b79f33b95e7d07c397), [`d41aee5`](https://github.com/mastra-ai/mastra/commit/d41aee526d124e35f42720a08e64043229193679), [`e8fe13c`](https://github.com/mastra-ai/mastra/commit/e8fe13c4b4c255a42520127797ec394310f7c919), [`3ca833d`](https://github.com/mastra-ai/mastra/commit/3ca833dc994c38e3c9b4f9b4478a61cd8e07b32a), [`1edb8d1`](https://github.com/mastra-ai/mastra/commit/1edb8d1cfb963e72a12412990fb9170936c9904c), [`fbf6e32`](https://github.com/mastra-ai/mastra/commit/fbf6e324946332d0f5ed8930bf9d4d4479cefd7a), [`4753027`](https://github.com/mastra-ai/mastra/commit/4753027ee889288775c6958bdfeda03ff909af67)]:
  - @mastra/core@0.20.0
  - @mastra/mcp@0.13.3
  - @mastra/rag@1.3.0
  - @mastra/memory@0.15.5
  - @mastra/libsql@0.15.1
  - @mastra/upstash@0.15.4

## 0.1.5-alpha.0

### Patch Changes

- Updated dependencies [[`00cb6bd`](https://github.com/mastra-ai/mastra/commit/00cb6bdf78737c0fac14a5a0c7b532a11e38558a), [`869ba22`](https://github.com/mastra-ai/mastra/commit/869ba222e1d6b58fc1b65e7c9fd55ca4e01b8c2f), [`1b73665`](https://github.com/mastra-ai/mastra/commit/1b73665e8e23f5c09d49fcf3e7d709c75259259e), [`f7d7475`](https://github.com/mastra-ai/mastra/commit/f7d747507341aef60ed39e4b49318db1f86034a6), [`084b77b`](https://github.com/mastra-ai/mastra/commit/084b77b2955960e0190af8db3f77138aa83ed65c), [`a93ff84`](https://github.com/mastra-ai/mastra/commit/a93ff84b5e1af07ee236ac8873dac9b49aa5d501), [`bc5aacb`](https://github.com/mastra-ai/mastra/commit/bc5aacb646d468d325327e36117129f28cd13bf6), [`03622f8`](https://github.com/mastra-ai/mastra/commit/03622f86e9d7342197f80f95333ea3ff65c783ae), [`6b5af12`](https://github.com/mastra-ai/mastra/commit/6b5af12ce9e09066e0c32e821c203a6954498bea), [`bf60e4a`](https://github.com/mastra-ai/mastra/commit/bf60e4a89c515afd9570b7b79f33b95e7d07c397), [`d41aee5`](https://github.com/mastra-ai/mastra/commit/d41aee526d124e35f42720a08e64043229193679), [`e8fe13c`](https://github.com/mastra-ai/mastra/commit/e8fe13c4b4c255a42520127797ec394310f7c919), [`3ca833d`](https://github.com/mastra-ai/mastra/commit/3ca833dc994c38e3c9b4f9b4478a61cd8e07b32a), [`1edb8d1`](https://github.com/mastra-ai/mastra/commit/1edb8d1cfb963e72a12412990fb9170936c9904c), [`fbf6e32`](https://github.com/mastra-ai/mastra/commit/fbf6e324946332d0f5ed8930bf9d4d4479cefd7a), [`4753027`](https://github.com/mastra-ai/mastra/commit/4753027ee889288775c6958bdfeda03ff909af67)]:
  - @mastra/core@0.20.0-alpha.0
  - @mastra/mcp@0.13.3-alpha.0
  - @mastra/rag@1.3.0-alpha.0
  - @mastra/memory@0.15.5-alpha.0
  - @mastra/libsql@0.15.1-alpha.0
  - @mastra/upstash@0.15.4-alpha.0

## 0.1.4

### Patch Changes

- Updated dependencies [[`4a70ccc`](https://github.com/mastra-ai/mastra/commit/4a70ccc5cfa12ae9c2b36545a5814cd98e5a0ead), [`0992b8b`](https://github.com/mastra-ai/mastra/commit/0992b8bf0f4f1ba7ad9940883ec4bb8d867d3105), [`283bea0`](https://github.com/mastra-ai/mastra/commit/283bea07adbaf04a27fa3ad2df611095e0825195)]:
  - @mastra/core@0.19.1

## 0.1.4-alpha.1

### Patch Changes

- Updated dependencies [[`4a70ccc`](https://github.com/mastra-ai/mastra/commit/4a70ccc5cfa12ae9c2b36545a5814cd98e5a0ead)]:
  - @mastra/core@0.19.1-alpha.1

## 0.1.4-alpha.0

### Patch Changes

- Updated dependencies [[`0992b8b`](https://github.com/mastra-ai/mastra/commit/0992b8bf0f4f1ba7ad9940883ec4bb8d867d3105), [`283bea0`](https://github.com/mastra-ai/mastra/commit/283bea07adbaf04a27fa3ad2df611095e0825195)]:
  - @mastra/core@0.19.1-alpha.0

## 0.1.3

### Patch Changes

- Updated dependencies [[`5f4e677`](https://github.com/mastra-ai/mastra/commit/5f4e67757bc23f2694d83af10f88cfccdc6013ff), [`dc099b4`](https://github.com/mastra-ai/mastra/commit/dc099b40fb31147ba3f362f98d991892033c4c67), [`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`b342a68`](https://github.com/mastra-ai/mastra/commit/b342a68e1399cf1ece9ba11bda112db89d21118c), [`a7243e2`](https://github.com/mastra-ai/mastra/commit/a7243e2e58762667a6e3921e755e89d6bb0a3282), [`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`9bea94d`](https://github.com/mastra-ai/mastra/commit/9bea94d36582ec6aa69126ab3b5f97e38aac9d98), [`7fceb0a`](https://github.com/mastra-ai/mastra/commit/7fceb0a327d678e812f90f5387c5bc4f38bd039e), [`303a9c0`](https://github.com/mastra-ai/mastra/commit/303a9c0d7dd58795915979f06a0512359e4532fb), [`df64f9e`](https://github.com/mastra-ai/mastra/commit/df64f9ef814916fff9baedd861c988084e7c41de), [`370f8a6`](https://github.com/mastra-ai/mastra/commit/370f8a6480faec70fef18d72e5f7538f27004301), [`e8f379d`](https://github.com/mastra-ai/mastra/commit/e8f379d390efa264c4e0874f9ac0cf8839b07777), [`809eea0`](https://github.com/mastra-ai/mastra/commit/809eea092fa80c3f69b9eaf078d843b57fd2a88e), [`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`683e5a1`](https://github.com/mastra-ai/mastra/commit/683e5a1466e48b686825b2c11f84680f296138e4), [`3679378`](https://github.com/mastra-ai/mastra/commit/3679378673350aa314741dc826f837b1984149bc), [`7775bc2`](https://github.com/mastra-ai/mastra/commit/7775bc20bb1ad1ab24797fb420e4f96c65b0d8ec), [`623ffaf`](https://github.com/mastra-ai/mastra/commit/623ffaf2d969e11e99a0224633cf7b5a0815c857), [`9fc1613`](https://github.com/mastra-ai/mastra/commit/9fc16136400186648880fd990119ac15f7c02ee4), [`61f62aa`](https://github.com/mastra-ai/mastra/commit/61f62aa31bc88fe4ddf8da6240dbcfbeb07358bd), [`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`db1891a`](https://github.com/mastra-ai/mastra/commit/db1891a4707443720b7cd8a260dc7e1d49b3609c), [`e8f379d`](https://github.com/mastra-ai/mastra/commit/e8f379d390efa264c4e0874f9ac0cf8839b07777), [`652066b`](https://github.com/mastra-ai/mastra/commit/652066bd1efc6bb6813ba950ed1d7573e8b7d9d4), [`3e292ba`](https://github.com/mastra-ai/mastra/commit/3e292ba00837886d5d68a34cbc0d9b703c991883), [`418c136`](https://github.com/mastra-ai/mastra/commit/418c1366843d88e491bca3f87763899ce855ca29), [`ea8d386`](https://github.com/mastra-ai/mastra/commit/ea8d386cd8c5593664515fd5770c06bf2aa980ef), [`67b0f00`](https://github.com/mastra-ai/mastra/commit/67b0f005b520335c71fb85cbaa25df4ce8484a81), [`c2a4919`](https://github.com/mastra-ai/mastra/commit/c2a4919ba6797d8bdb1509e02287496eef69303e), [`c84b7d0`](https://github.com/mastra-ai/mastra/commit/c84b7d093c4657772140cbfd2b15ef72f3315ed5), [`0130986`](https://github.com/mastra-ai/mastra/commit/0130986fc62d0edcc626dd593282661dbb9af141)]:
  - @mastra/mcp@0.13.2
  - @mastra/core@0.19.0
  - @mastra/memory@0.15.4
  - @mastra/upstash@0.15.3
  - @mastra/libsql@0.15.0
  - @mastra/rag@1.2.7

## 0.1.3-alpha.1

### Patch Changes

- Updated dependencies [[`5f4e677`](https://github.com/mastra-ai/mastra/commit/5f4e67757bc23f2694d83af10f88cfccdc6013ff), [`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`a7243e2`](https://github.com/mastra-ai/mastra/commit/a7243e2e58762667a6e3921e755e89d6bb0a3282), [`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`9bea94d`](https://github.com/mastra-ai/mastra/commit/9bea94d36582ec6aa69126ab3b5f97e38aac9d98), [`7fceb0a`](https://github.com/mastra-ai/mastra/commit/7fceb0a327d678e812f90f5387c5bc4f38bd039e), [`df64f9e`](https://github.com/mastra-ai/mastra/commit/df64f9ef814916fff9baedd861c988084e7c41de), [`e8f379d`](https://github.com/mastra-ai/mastra/commit/e8f379d390efa264c4e0874f9ac0cf8839b07777), [`809eea0`](https://github.com/mastra-ai/mastra/commit/809eea092fa80c3f69b9eaf078d843b57fd2a88e), [`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`683e5a1`](https://github.com/mastra-ai/mastra/commit/683e5a1466e48b686825b2c11f84680f296138e4), [`3679378`](https://github.com/mastra-ai/mastra/commit/3679378673350aa314741dc826f837b1984149bc), [`7775bc2`](https://github.com/mastra-ai/mastra/commit/7775bc20bb1ad1ab24797fb420e4f96c65b0d8ec), [`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`db1891a`](https://github.com/mastra-ai/mastra/commit/db1891a4707443720b7cd8a260dc7e1d49b3609c), [`e8f379d`](https://github.com/mastra-ai/mastra/commit/e8f379d390efa264c4e0874f9ac0cf8839b07777), [`652066b`](https://github.com/mastra-ai/mastra/commit/652066bd1efc6bb6813ba950ed1d7573e8b7d9d4), [`ea8d386`](https://github.com/mastra-ai/mastra/commit/ea8d386cd8c5593664515fd5770c06bf2aa980ef), [`c2a4919`](https://github.com/mastra-ai/mastra/commit/c2a4919ba6797d8bdb1509e02287496eef69303e), [`0130986`](https://github.com/mastra-ai/mastra/commit/0130986fc62d0edcc626dd593282661dbb9af141)]:
  - @mastra/mcp@0.13.2-alpha.0
  - @mastra/core@0.19.0-alpha.1
  - @mastra/memory@0.15.4-alpha.0
  - @mastra/upstash@0.15.3-alpha.0
  - @mastra/libsql@0.15.0-alpha.0
  - @mastra/rag@1.2.7-alpha.0

## 0.1.3-alpha.0

### Patch Changes

- Updated dependencies [[`dc099b4`](https://github.com/mastra-ai/mastra/commit/dc099b40fb31147ba3f362f98d991892033c4c67), [`b342a68`](https://github.com/mastra-ai/mastra/commit/b342a68e1399cf1ece9ba11bda112db89d21118c), [`303a9c0`](https://github.com/mastra-ai/mastra/commit/303a9c0d7dd58795915979f06a0512359e4532fb), [`370f8a6`](https://github.com/mastra-ai/mastra/commit/370f8a6480faec70fef18d72e5f7538f27004301), [`623ffaf`](https://github.com/mastra-ai/mastra/commit/623ffaf2d969e11e99a0224633cf7b5a0815c857), [`9fc1613`](https://github.com/mastra-ai/mastra/commit/9fc16136400186648880fd990119ac15f7c02ee4), [`61f62aa`](https://github.com/mastra-ai/mastra/commit/61f62aa31bc88fe4ddf8da6240dbcfbeb07358bd), [`3e292ba`](https://github.com/mastra-ai/mastra/commit/3e292ba00837886d5d68a34cbc0d9b703c991883), [`418c136`](https://github.com/mastra-ai/mastra/commit/418c1366843d88e491bca3f87763899ce855ca29), [`c84b7d0`](https://github.com/mastra-ai/mastra/commit/c84b7d093c4657772140cbfd2b15ef72f3315ed5)]:
  - @mastra/core@0.18.1-alpha.0

## 0.1.2

### Patch Changes

- Updated dependencies [[`6b7e804`](https://github.com/mastra-ai/mastra/commit/6b7e80406ba91bd6c6f5789f90e33551a48e66b1), [`5e1fa13`](https://github.com/mastra-ai/mastra/commit/5e1fa1371deef46395b68433ed2bb0518e4f1344), [`6b7e804`](https://github.com/mastra-ai/mastra/commit/6b7e80406ba91bd6c6f5789f90e33551a48e66b1), [`cf34503`](https://github.com/mastra-ai/mastra/commit/cf345031de4e157f29087946449e60b965e9c8a9), [`6b4b1e4`](https://github.com/mastra-ai/mastra/commit/6b4b1e4235428d39e51cbda9832704c0ba70ab32), [`3469fca`](https://github.com/mastra-ai/mastra/commit/3469fca7bb7e5e19369ff9f7044716a5e4b02585), [`a61f23f`](https://github.com/mastra-ai/mastra/commit/a61f23fbbca4b88b763d94f1d784c47895ed72d7), [`4b339b8`](https://github.com/mastra-ai/mastra/commit/4b339b8141c20d6a6d80583c7e8c5c05d8c19492), [`d1dc606`](https://github.com/mastra-ai/mastra/commit/d1dc6067b0557a71190b68d56ee15b48c26d2411), [`c45298a`](https://github.com/mastra-ai/mastra/commit/c45298a0a0791db35cf79f1199d77004da0704cb), [`c4a8204`](https://github.com/mastra-ai/mastra/commit/c4a82046bfd241d6044e234bc5917d5a01fe6b55), [`d3bd4d4`](https://github.com/mastra-ai/mastra/commit/d3bd4d482a685bbb67bfa89be91c90dca3fa71ad), [`c591dfc`](https://github.com/mastra-ai/mastra/commit/c591dfc1e600fae1dedffe239357d250e146378f), [`1920c5c`](https://github.com/mastra-ai/mastra/commit/1920c5c6d666f687785c73021196aa551e579e0d), [`b6a3b65`](https://github.com/mastra-ai/mastra/commit/b6a3b65d830fa0ca7754ad6481661d1f2c878f21), [`af3abb6`](https://github.com/mastra-ai/mastra/commit/af3abb6f7c7585d856e22d27f4e7d2ece2186b9a), [`5b1ee71`](https://github.com/mastra-ai/mastra/commit/5b1ee71dc3ac92383226dc1e375642ca5f9b4224)]:
  - @mastra/memory@0.15.3
  - @mastra/rag@1.2.6
  - @mastra/upstash@0.15.2
  - @mastra/core@0.18.0
  - @mastra/libsql@0.14.3
  - @mastra/mcp@0.13.1

## 0.1.2-alpha.3

### Patch Changes

- Updated dependencies [[`6b7e804`](https://github.com/mastra-ai/mastra/commit/6b7e80406ba91bd6c6f5789f90e33551a48e66b1), [`6b7e804`](https://github.com/mastra-ai/mastra/commit/6b7e80406ba91bd6c6f5789f90e33551a48e66b1), [`4b339b8`](https://github.com/mastra-ai/mastra/commit/4b339b8141c20d6a6d80583c7e8c5c05d8c19492), [`c591dfc`](https://github.com/mastra-ai/mastra/commit/c591dfc1e600fae1dedffe239357d250e146378f), [`1920c5c`](https://github.com/mastra-ai/mastra/commit/1920c5c6d666f687785c73021196aa551e579e0d), [`b6a3b65`](https://github.com/mastra-ai/mastra/commit/b6a3b65d830fa0ca7754ad6481661d1f2c878f21), [`af3abb6`](https://github.com/mastra-ai/mastra/commit/af3abb6f7c7585d856e22d27f4e7d2ece2186b9a)]:
  - @mastra/memory@0.15.3-alpha.1
  - @mastra/upstash@0.15.2-alpha.1
  - @mastra/core@0.18.0-alpha.3

## 0.1.2-alpha.2

### Patch Changes

- Updated dependencies [[`5e1fa13`](https://github.com/mastra-ai/mastra/commit/5e1fa1371deef46395b68433ed2bb0518e4f1344), [`cf34503`](https://github.com/mastra-ai/mastra/commit/cf345031de4e157f29087946449e60b965e9c8a9), [`6b4b1e4`](https://github.com/mastra-ai/mastra/commit/6b4b1e4235428d39e51cbda9832704c0ba70ab32), [`3469fca`](https://github.com/mastra-ai/mastra/commit/3469fca7bb7e5e19369ff9f7044716a5e4b02585), [`c4a8204`](https://github.com/mastra-ai/mastra/commit/c4a82046bfd241d6044e234bc5917d5a01fe6b55), [`5b1ee71`](https://github.com/mastra-ai/mastra/commit/5b1ee71dc3ac92383226dc1e375642ca5f9b4224)]:
  - @mastra/rag@1.2.6-alpha.0
  - @mastra/core@0.18.0-alpha.2
  - @mastra/memory@0.15.3-alpha.0
  - @mastra/upstash@0.15.2-alpha.0
  - @mastra/libsql@0.14.3-alpha.0
  - @mastra/mcp@0.13.1-alpha.0

## 0.1.2-alpha.1

### Patch Changes

- Updated dependencies [[`c45298a`](https://github.com/mastra-ai/mastra/commit/c45298a0a0791db35cf79f1199d77004da0704cb)]:
  - @mastra/core@0.17.2-alpha.1

## 0.1.2-alpha.0

### Patch Changes

- Updated dependencies [[`a61f23f`](https://github.com/mastra-ai/mastra/commit/a61f23fbbca4b88b763d94f1d784c47895ed72d7), [`d1dc606`](https://github.com/mastra-ai/mastra/commit/d1dc6067b0557a71190b68d56ee15b48c26d2411), [`d3bd4d4`](https://github.com/mastra-ai/mastra/commit/d3bd4d482a685bbb67bfa89be91c90dca3fa71ad)]:
  - @mastra/core@0.17.2-alpha.0

## 0.1.1

### Patch Changes

- Updated dependencies [[`fd00e63`](https://github.com/mastra-ai/mastra/commit/fd00e63759cbcca3473c40cac9843280b0557cff), [`ab610f6`](https://github.com/mastra-ai/mastra/commit/ab610f6f41dbfe6c9502368671485ca7a0aac09b), [`e6bda5f`](https://github.com/mastra-ai/mastra/commit/e6bda5f954ee8493ea18adc1a883f0a5b785ad9b)]:
  - @mastra/core@0.17.1

## 0.1.1-alpha.0

### Patch Changes

- Updated dependencies [[`fd00e63`](https://github.com/mastra-ai/mastra/commit/fd00e63759cbcca3473c40cac9843280b0557cff), [`ab610f6`](https://github.com/mastra-ai/mastra/commit/ab610f6f41dbfe6c9502368671485ca7a0aac09b), [`e6bda5f`](https://github.com/mastra-ai/mastra/commit/e6bda5f954ee8493ea18adc1a883f0a5b785ad9b)]:
  - @mastra/core@0.17.1-alpha.0

## 0.1.0

### Minor Changes

- Fully deprecated createRun (now throws an error) in favour of createRunAsync ([#7897](https://github.com/mastra-ai/mastra/pull/7897))

### Patch Changes

- Update peerdep of @mastra/core ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

- Updated dependencies [[`197cbb2`](https://github.com/mastra-ai/mastra/commit/197cbb248fc8cb4bbf61bf70b770f1388b445df2), [`2cecf62`](https://github.com/mastra-ai/mastra/commit/2cecf62739e6107d6f6a10de51bf7de88ff6d9e6), [`2ebe4c4`](https://github.com/mastra-ai/mastra/commit/2ebe4c4c34dd3e16b94cf66f6d5ce03a286e322a), [`3359146`](https://github.com/mastra-ai/mastra/commit/3359146477152fc68047d96081078b0912125824), [`a1bb887`](https://github.com/mastra-ai/mastra/commit/a1bb887e8bfae44230f487648da72e96ef824561), [`6590763`](https://github.com/mastra-ai/mastra/commit/65907630ef4bf4127067cecd1cb21b56f55d5f1b), [`fb84c21`](https://github.com/mastra-ai/mastra/commit/fb84c21859d09bdc8f158bd5412bdc4b5835a61c), [`5802bf5`](https://github.com/mastra-ai/mastra/commit/5802bf57f6182e4b67c28d7d91abed349a8d14f3), [`5bda53a`](https://github.com/mastra-ai/mastra/commit/5bda53a9747bfa7d876d754fc92c83a06e503f62), [`c2eade3`](https://github.com/mastra-ai/mastra/commit/c2eade3508ef309662f065e5f340d7840295dd53), [`f26a8fd`](https://github.com/mastra-ai/mastra/commit/f26a8fd99fcb0497a5d86c28324430d7f6a5fb83), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382), [`222965a`](https://github.com/mastra-ai/mastra/commit/222965a98ce8197b86673ec594244650b5960257), [`6047778`](https://github.com/mastra-ai/mastra/commit/6047778e501df460648f31decddf8e443f36e373), [`a0f5f1c`](https://github.com/mastra-ai/mastra/commit/a0f5f1ca39c3c5c6d26202e9fcab986b4fe14568), [`9d4fc09`](https://github.com/mastra-ai/mastra/commit/9d4fc09b2ad55caa7738c7ceb3a905e454f74cdd), [`05c7abf`](https://github.com/mastra-ai/mastra/commit/05c7abfe105a015b7760c9bf33ff4419727502a0), [`0324ceb`](https://github.com/mastra-ai/mastra/commit/0324ceb8af9d16c12a531f90e575f6aab797ac81), [`d75ccf0`](https://github.com/mastra-ai/mastra/commit/d75ccf06dfd2582b916aa12624e3cd61b279edf1), [`0f9d227`](https://github.com/mastra-ai/mastra/commit/0f9d227890a98db33865abbea39daf407cd55ef7), [`b356f5f`](https://github.com/mastra-ai/mastra/commit/b356f5f7566cb3edb755d91f00b72fc1420b2a37), [`de056a0`](https://github.com/mastra-ai/mastra/commit/de056a02cbb43f6aa0380ab2150ea404af9ec0dd), [`f5ce05f`](https://github.com/mastra-ai/mastra/commit/f5ce05f831d42c69559bf4c0fdb46ccb920fc3a3), [`60c9cec`](https://github.com/mastra-ai/mastra/commit/60c9cec7048a79a87440f7840c383875bd710d93), [`c93532a`](https://github.com/mastra-ai/mastra/commit/c93532a340b80e4dd946d4c138d9381de5f70399), [`6cb1fcb`](https://github.com/mastra-ai/mastra/commit/6cb1fcbc8d0378ffed0d17784c96e68f30cb0272), [`aee4f00`](https://github.com/mastra-ai/mastra/commit/aee4f00e61e1a42e81a6d74ff149dbe69e32695a), [`9f6f30f`](https://github.com/mastra-ai/mastra/commit/9f6f30f04ec6648bbca798ea8aad59317c40d8db), [`547c621`](https://github.com/mastra-ai/mastra/commit/547c62104af3f7a551b3754e9cbdf0a3fbba15e4), [`897995e`](https://github.com/mastra-ai/mastra/commit/897995e630d572fe2891e7ede817938cabb43251), [`fdc1394`](https://github.com/mastra-ai/mastra/commit/fdc13940f16d8ffcffebe96fe60396edae81450c), [`0fed8f2`](https://github.com/mastra-ai/mastra/commit/0fed8f2aa84b167b3415ea6f8f70755775132c8d), [`4f9ea8c`](https://github.com/mastra-ai/mastra/commit/4f9ea8c95ea74ba9abbf3b2ab6106c7d7bc45689), [`c4dbd12`](https://github.com/mastra-ai/mastra/commit/c4dbd12a05e75db124c5d8abff3d893ea1b88c30), [`1a1fbe6`](https://github.com/mastra-ai/mastra/commit/1a1fbe66efb7d94abc373ed0dd9676adb8122454), [`d706fad`](https://github.com/mastra-ai/mastra/commit/d706fad6e6e4b72357b18d229ba38e6c913c0e70), [`87fd07f`](https://github.com/mastra-ai/mastra/commit/87fd07ff35387a38728967163460231b5d33ae3b), [`5c3768f`](https://github.com/mastra-ai/mastra/commit/5c3768fa959454232ad76715c381f4aac00c6881), [`2685a78`](https://github.com/mastra-ai/mastra/commit/2685a78f224b8b04e20d4fab5ac1adb638190071), [`36f39c0`](https://github.com/mastra-ai/mastra/commit/36f39c00dc794952dc3c11aab91c2fa8bca74b11), [`239b5a4`](https://github.com/mastra-ai/mastra/commit/239b5a497aeae2e8b4d764f46217cfff2284788e), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382)]:
  - @mastra/core@0.17.0
  - @mastra/libsql@0.14.2
  - @mastra/rag@1.2.5
  - @mastra/memory@0.15.2
  - @mastra/mcp@0.13.0
  - @mastra/upstash@0.15.1

## 0.1.0-alpha.8

### Patch Changes

- Updated dependencies [[`05c7abf`](https://github.com/mastra-ai/mastra/commit/05c7abfe105a015b7760c9bf33ff4419727502a0), [`aee4f00`](https://github.com/mastra-ai/mastra/commit/aee4f00e61e1a42e81a6d74ff149dbe69e32695a)]:
  - @mastra/core@0.17.0-alpha.8

## 0.1.0-alpha.7

### Patch Changes

- Updated dependencies [[`4f9ea8c`](https://github.com/mastra-ai/mastra/commit/4f9ea8c95ea74ba9abbf3b2ab6106c7d7bc45689)]:
  - @mastra/core@0.17.0-alpha.7

## 0.1.0-alpha.6

### Patch Changes

- Updated dependencies [[`197cbb2`](https://github.com/mastra-ai/mastra/commit/197cbb248fc8cb4bbf61bf70b770f1388b445df2), [`6590763`](https://github.com/mastra-ai/mastra/commit/65907630ef4bf4127067cecd1cb21b56f55d5f1b), [`c2eade3`](https://github.com/mastra-ai/mastra/commit/c2eade3508ef309662f065e5f340d7840295dd53), [`222965a`](https://github.com/mastra-ai/mastra/commit/222965a98ce8197b86673ec594244650b5960257), [`0324ceb`](https://github.com/mastra-ai/mastra/commit/0324ceb8af9d16c12a531f90e575f6aab797ac81), [`0f9d227`](https://github.com/mastra-ai/mastra/commit/0f9d227890a98db33865abbea39daf407cd55ef7), [`de056a0`](https://github.com/mastra-ai/mastra/commit/de056a02cbb43f6aa0380ab2150ea404af9ec0dd), [`c93532a`](https://github.com/mastra-ai/mastra/commit/c93532a340b80e4dd946d4c138d9381de5f70399), [`6cb1fcb`](https://github.com/mastra-ai/mastra/commit/6cb1fcbc8d0378ffed0d17784c96e68f30cb0272), [`2685a78`](https://github.com/mastra-ai/mastra/commit/2685a78f224b8b04e20d4fab5ac1adb638190071), [`239b5a4`](https://github.com/mastra-ai/mastra/commit/239b5a497aeae2e8b4d764f46217cfff2284788e)]:
  - @mastra/core@0.17.0-alpha.6
  - @mastra/memory@0.15.2-alpha.2
  - @mastra/mcp@0.13.0-alpha.2

## 0.1.0-alpha.5

### Patch Changes

- Updated dependencies [[`6047778`](https://github.com/mastra-ai/mastra/commit/6047778e501df460648f31decddf8e443f36e373)]:
  - @mastra/core@0.17.0-alpha.5

## 0.1.0-alpha.4

### Minor Changes

- Fully deprecated createRun (now throws an error) in favour of createRunAsync ([#7897](https://github.com/mastra-ai/mastra/pull/7897))

### Patch Changes

- Updated dependencies [[`fb84c21`](https://github.com/mastra-ai/mastra/commit/fb84c21859d09bdc8f158bd5412bdc4b5835a61c), [`9d4fc09`](https://github.com/mastra-ai/mastra/commit/9d4fc09b2ad55caa7738c7ceb3a905e454f74cdd), [`d75ccf0`](https://github.com/mastra-ai/mastra/commit/d75ccf06dfd2582b916aa12624e3cd61b279edf1), [`0fed8f2`](https://github.com/mastra-ai/mastra/commit/0fed8f2aa84b167b3415ea6f8f70755775132c8d), [`c4dbd12`](https://github.com/mastra-ai/mastra/commit/c4dbd12a05e75db124c5d8abff3d893ea1b88c30), [`87fd07f`](https://github.com/mastra-ai/mastra/commit/87fd07ff35387a38728967163460231b5d33ae3b)]:
  - @mastra/memory@0.15.2-alpha.1
  - @mastra/core@0.17.0-alpha.4
  - @mastra/mcp@0.13.0-alpha.1

## 0.0.54-alpha.3

### Patch Changes

- Update peerdep of @mastra/core ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

- Updated dependencies [[`3359146`](https://github.com/mastra-ai/mastra/commit/3359146477152fc68047d96081078b0912125824), [`a1bb887`](https://github.com/mastra-ai/mastra/commit/a1bb887e8bfae44230f487648da72e96ef824561), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382), [`a0f5f1c`](https://github.com/mastra-ai/mastra/commit/a0f5f1ca39c3c5c6d26202e9fcab986b4fe14568), [`b356f5f`](https://github.com/mastra-ai/mastra/commit/b356f5f7566cb3edb755d91f00b72fc1420b2a37), [`f5ce05f`](https://github.com/mastra-ai/mastra/commit/f5ce05f831d42c69559bf4c0fdb46ccb920fc3a3), [`9f6f30f`](https://github.com/mastra-ai/mastra/commit/9f6f30f04ec6648bbca798ea8aad59317c40d8db), [`fdc1394`](https://github.com/mastra-ai/mastra/commit/fdc13940f16d8ffcffebe96fe60396edae81450c), [`d706fad`](https://github.com/mastra-ai/mastra/commit/d706fad6e6e4b72357b18d229ba38e6c913c0e70), [`5c3768f`](https://github.com/mastra-ai/mastra/commit/5c3768fa959454232ad76715c381f4aac00c6881), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382)]:
  - @mastra/rag@1.2.5-alpha.1
  - @mastra/core@0.17.0-alpha.3
  - @mastra/memory@0.15.2-alpha.0
  - @mastra/upstash@0.15.1-alpha.1
  - @mastra/libsql@0.14.2-alpha.2
  - @mastra/mcp@0.12.1-alpha.0

## 0.0.54-alpha.2

### Patch Changes

- Updated dependencies [[`60c9cec`](https://github.com/mastra-ai/mastra/commit/60c9cec7048a79a87440f7840c383875bd710d93), [`897995e`](https://github.com/mastra-ai/mastra/commit/897995e630d572fe2891e7ede817938cabb43251)]:
  - @mastra/core@0.16.4-alpha.2

## 0.0.54-alpha.1

### Patch Changes

- Updated dependencies [[`547c621`](https://github.com/mastra-ai/mastra/commit/547c62104af3f7a551b3754e9cbdf0a3fbba15e4)]:
  - @mastra/core@0.16.4-alpha.1
  - @mastra/libsql@0.14.2-alpha.1
  - @mastra/upstash@0.15.1-alpha.0

## 0.0.54-alpha.0

### Patch Changes

- Updated dependencies [[`2cecf62`](https://github.com/mastra-ai/mastra/commit/2cecf62739e6107d6f6a10de51bf7de88ff6d9e6), [`2ebe4c4`](https://github.com/mastra-ai/mastra/commit/2ebe4c4c34dd3e16b94cf66f6d5ce03a286e322a), [`5802bf5`](https://github.com/mastra-ai/mastra/commit/5802bf57f6182e4b67c28d7d91abed349a8d14f3), [`5bda53a`](https://github.com/mastra-ai/mastra/commit/5bda53a9747bfa7d876d754fc92c83a06e503f62), [`f26a8fd`](https://github.com/mastra-ai/mastra/commit/f26a8fd99fcb0497a5d86c28324430d7f6a5fb83), [`1a1fbe6`](https://github.com/mastra-ai/mastra/commit/1a1fbe66efb7d94abc373ed0dd9676adb8122454), [`36f39c0`](https://github.com/mastra-ai/mastra/commit/36f39c00dc794952dc3c11aab91c2fa8bca74b11)]:
  - @mastra/libsql@0.14.2-alpha.0
  - @mastra/rag@1.2.5-alpha.0
  - @mastra/core@0.16.4-alpha.0

## 0.0.53

### Patch Changes

- Updated dependencies [[`b4379f7`](https://github.com/mastra-ai/mastra/commit/b4379f703fd74474f253420e8c3a684f2c4b2f8e), [`2a6585f`](https://github.com/mastra-ai/mastra/commit/2a6585f7cb71f023f805d521d1c3c95fb9a3aa59), [`3d26e83`](https://github.com/mastra-ai/mastra/commit/3d26e8353a945719028f087cc6ac4b06f0ce27d2), [`dd9119b`](https://github.com/mastra-ai/mastra/commit/dd9119b175a8f389082f75c12750e51f96d65dca), [`d34aaa1`](https://github.com/mastra-ai/mastra/commit/d34aaa1da5d3c5f991740f59e2fe6d28d3e2dd91), [`56e55d1`](https://github.com/mastra-ai/mastra/commit/56e55d1e9eb63e7d9e41aa46e012aae471256812), [`ce1e580`](https://github.com/mastra-ai/mastra/commit/ce1e580f6391e94a0c6816a9c5db0a21566a262f), [`0a95f82`](https://github.com/mastra-ai/mastra/commit/0a95f824759099751d88b58db636863f9c8ff707), [`b2babfa`](https://github.com/mastra-ai/mastra/commit/b2babfa9e75b22f2759179e71d8473f6dc5421ed), [`d8c3ba5`](https://github.com/mastra-ai/mastra/commit/d8c3ba516f4173282d293f7e64769cfc8738d360), [`a566c4e`](https://github.com/mastra-ai/mastra/commit/a566c4e92d86c1671707c54359b1d33934f7cc13), [`af333aa`](https://github.com/mastra-ai/mastra/commit/af333aa30fe6d1b127024b03a64736c46eddeca2), [`3863c52`](https://github.com/mastra-ai/mastra/commit/3863c52d44b4e5779968b802d977e87adf939d8e), [`6424c7e`](https://github.com/mastra-ai/mastra/commit/6424c7ec38b6921d66212431db1e0958f441b2a7), [`db94750`](https://github.com/mastra-ai/mastra/commit/db94750a41fd29b43eb1f7ce8e97ba8b9978c91b), [`a66a371`](https://github.com/mastra-ai/mastra/commit/a66a3716b00553d7f01842be9deb34f720b10fab), [`69fc3cd`](https://github.com/mastra-ai/mastra/commit/69fc3cd0fd814901785bdcf49bf536ab1e7fd975)]:
  - @mastra/core@0.16.3
  - @mastra/libsql@0.14.1
  - @mastra/memory@0.15.1

## 0.0.53-alpha.1

### Patch Changes

- Updated dependencies [[`2a6585f`](https://github.com/mastra-ai/mastra/commit/2a6585f7cb71f023f805d521d1c3c95fb9a3aa59), [`3d26e83`](https://github.com/mastra-ai/mastra/commit/3d26e8353a945719028f087cc6ac4b06f0ce27d2), [`56e55d1`](https://github.com/mastra-ai/mastra/commit/56e55d1e9eb63e7d9e41aa46e012aae471256812)]:
  - @mastra/core@0.16.3-alpha.1

## 0.0.53-alpha.0

### Patch Changes

- Updated dependencies [[`b4379f7`](https://github.com/mastra-ai/mastra/commit/b4379f703fd74474f253420e8c3a684f2c4b2f8e), [`dd9119b`](https://github.com/mastra-ai/mastra/commit/dd9119b175a8f389082f75c12750e51f96d65dca), [`d34aaa1`](https://github.com/mastra-ai/mastra/commit/d34aaa1da5d3c5f991740f59e2fe6d28d3e2dd91), [`ce1e580`](https://github.com/mastra-ai/mastra/commit/ce1e580f6391e94a0c6816a9c5db0a21566a262f), [`0a95f82`](https://github.com/mastra-ai/mastra/commit/0a95f824759099751d88b58db636863f9c8ff707), [`b2babfa`](https://github.com/mastra-ai/mastra/commit/b2babfa9e75b22f2759179e71d8473f6dc5421ed), [`d8c3ba5`](https://github.com/mastra-ai/mastra/commit/d8c3ba516f4173282d293f7e64769cfc8738d360), [`a566c4e`](https://github.com/mastra-ai/mastra/commit/a566c4e92d86c1671707c54359b1d33934f7cc13), [`af333aa`](https://github.com/mastra-ai/mastra/commit/af333aa30fe6d1b127024b03a64736c46eddeca2), [`3863c52`](https://github.com/mastra-ai/mastra/commit/3863c52d44b4e5779968b802d977e87adf939d8e), [`6424c7e`](https://github.com/mastra-ai/mastra/commit/6424c7ec38b6921d66212431db1e0958f441b2a7), [`db94750`](https://github.com/mastra-ai/mastra/commit/db94750a41fd29b43eb1f7ce8e97ba8b9978c91b), [`a66a371`](https://github.com/mastra-ai/mastra/commit/a66a3716b00553d7f01842be9deb34f720b10fab), [`69fc3cd`](https://github.com/mastra-ai/mastra/commit/69fc3cd0fd814901785bdcf49bf536ab1e7fd975)]:
  - @mastra/core@0.16.3-alpha.0
  - @mastra/libsql@0.14.1-alpha.0
  - @mastra/memory@0.15.1-alpha.0

## 0.0.52

### Patch Changes

- Updated dependencies [[`61926ef`](https://github.com/mastra-ai/mastra/commit/61926ef40d415b805a63527cffe27a50542e15e5)]:
  - @mastra/core@0.16.2

## 0.0.52-alpha.0

### Patch Changes

- Updated dependencies [[`61926ef`](https://github.com/mastra-ai/mastra/commit/61926ef40d415b805a63527cffe27a50542e15e5)]:
  - @mastra/core@0.16.2-alpha.0

## 0.0.51

### Patch Changes

- Updated dependencies [[`0f7b8c0`](https://github.com/mastra-ai/mastra/commit/0f7b8c0c22d2a677a0f71c35ad1bc2d60b063d39), [`47b6dc9`](https://github.com/mastra-ai/mastra/commit/47b6dc94f4976d4f3d3882e8f19eb365bbc5976c), [`827d876`](https://github.com/mastra-ai/mastra/commit/827d8766f36a900afcaf64a040f7ba76249009b3), [`0662d02`](https://github.com/mastra-ai/mastra/commit/0662d02ef16916e67531890639fcd72c69cfb6e2), [`565d65f`](https://github.com/mastra-ai/mastra/commit/565d65fc16314a99f081975ec92f2636dff0c86d), [`6189844`](https://github.com/mastra-ai/mastra/commit/61898448e65bda02bb814fb15801a89dc6476938), [`4da3d68`](https://github.com/mastra-ai/mastra/commit/4da3d68a778e5c4d5a17351ef223289fe2f45a45), [`fd9bbfe`](https://github.com/mastra-ai/mastra/commit/fd9bbfee22484f8493582325f53e8171bf8e682b), [`7eaf1d1`](https://github.com/mastra-ai/mastra/commit/7eaf1d1cec7e828d7a98efc2a748ac395bbdba3b), [`6f046b5`](https://github.com/mastra-ai/mastra/commit/6f046b5ccc5c8721302a9a61d5d16c12374cc8d7), [`d7a8f59`](https://github.com/mastra-ai/mastra/commit/d7a8f59154b0621aec4f41a6b2ea2b3882f03cb7), [`0b0bbb2`](https://github.com/mastra-ai/mastra/commit/0b0bbb24f4198ead69792e92b68a350f52b45cf3), [`d951f41`](https://github.com/mastra-ai/mastra/commit/d951f41771e4e5da8da4b9f870949f9509e38756), [`4dda259`](https://github.com/mastra-ai/mastra/commit/4dda2593b6343f9258671de5fb237aeba3ef6bb7), [`8049e2e`](https://github.com/mastra-ai/mastra/commit/8049e2e8cce80a00353c64894c62b695ac34e35e), [`f3427cd`](https://github.com/mastra-ai/mastra/commit/f3427cdaf9eecd63360dfc897a4acbf5f4143a4e), [`defed1c`](https://github.com/mastra-ai/mastra/commit/defed1ca8040cc8d42e645c5a50a1bc52a4918d7), [`79b39c1`](https://github.com/mastra-ai/mastra/commit/79b39c1def3bbd5d6ee2d2cc1e89ea378a940477), [`6991ced`](https://github.com/mastra-ai/mastra/commit/6991cedcb5a44a49d9fe58ef67926e1f96ba55b1), [`9cb9c42`](https://github.com/mastra-ai/mastra/commit/9cb9c422854ee81074989dd2d8dccc0500ba8d3e), [`8334859`](https://github.com/mastra-ai/mastra/commit/83348594d4f37b311ba4a94d679c5f8721d796d4), [`05f13b8`](https://github.com/mastra-ai/mastra/commit/05f13b8fb269ccfc4de98e9db58dbe16eae55a5e)]:
  - @mastra/mcp@0.12.0
  - @mastra/core@0.16.1
  - @mastra/memory@0.15.0

## 0.0.51-alpha.3

### Patch Changes

- Updated dependencies [[`fd9bbfe`](https://github.com/mastra-ai/mastra/commit/fd9bbfee22484f8493582325f53e8171bf8e682b)]:
  - @mastra/core@0.16.1-alpha.3

## 0.0.51-alpha.2

### Patch Changes

- Updated dependencies [[`827d876`](https://github.com/mastra-ai/mastra/commit/827d8766f36a900afcaf64a040f7ba76249009b3), [`7eaf1d1`](https://github.com/mastra-ai/mastra/commit/7eaf1d1cec7e828d7a98efc2a748ac395bbdba3b), [`f3427cd`](https://github.com/mastra-ai/mastra/commit/f3427cdaf9eecd63360dfc897a4acbf5f4143a4e), [`05f13b8`](https://github.com/mastra-ai/mastra/commit/05f13b8fb269ccfc4de98e9db58dbe16eae55a5e)]:
  - @mastra/core@0.16.1-alpha.2

## 0.0.51-alpha.1

### Patch Changes

- Updated dependencies [[`0f7b8c0`](https://github.com/mastra-ai/mastra/commit/0f7b8c0c22d2a677a0f71c35ad1bc2d60b063d39), [`47b6dc9`](https://github.com/mastra-ai/mastra/commit/47b6dc94f4976d4f3d3882e8f19eb365bbc5976c), [`565d65f`](https://github.com/mastra-ai/mastra/commit/565d65fc16314a99f081975ec92f2636dff0c86d), [`4da3d68`](https://github.com/mastra-ai/mastra/commit/4da3d68a778e5c4d5a17351ef223289fe2f45a45), [`0b0bbb2`](https://github.com/mastra-ai/mastra/commit/0b0bbb24f4198ead69792e92b68a350f52b45cf3), [`d951f41`](https://github.com/mastra-ai/mastra/commit/d951f41771e4e5da8da4b9f870949f9509e38756), [`8049e2e`](https://github.com/mastra-ai/mastra/commit/8049e2e8cce80a00353c64894c62b695ac34e35e)]:
  - @mastra/mcp@0.12.0-alpha.1
  - @mastra/core@0.16.1-alpha.1

## 0.0.51-alpha.0

### Patch Changes

- Updated dependencies [[`0662d02`](https://github.com/mastra-ai/mastra/commit/0662d02ef16916e67531890639fcd72c69cfb6e2), [`6189844`](https://github.com/mastra-ai/mastra/commit/61898448e65bda02bb814fb15801a89dc6476938), [`d7a8f59`](https://github.com/mastra-ai/mastra/commit/d7a8f59154b0621aec4f41a6b2ea2b3882f03cb7), [`4dda259`](https://github.com/mastra-ai/mastra/commit/4dda2593b6343f9258671de5fb237aeba3ef6bb7), [`defed1c`](https://github.com/mastra-ai/mastra/commit/defed1ca8040cc8d42e645c5a50a1bc52a4918d7), [`79b39c1`](https://github.com/mastra-ai/mastra/commit/79b39c1def3bbd5d6ee2d2cc1e89ea378a940477), [`6991ced`](https://github.com/mastra-ai/mastra/commit/6991cedcb5a44a49d9fe58ef67926e1f96ba55b1), [`9cb9c42`](https://github.com/mastra-ai/mastra/commit/9cb9c422854ee81074989dd2d8dccc0500ba8d3e), [`8334859`](https://github.com/mastra-ai/mastra/commit/83348594d4f37b311ba4a94d679c5f8721d796d4)]:
  - @mastra/core@0.16.1-alpha.0
  - @mastra/memory@0.15.0-alpha.0
  - @mastra/mcp@0.12.0-alpha.0

## 0.0.50

### Patch Changes

- Updated dependencies [8fbf79e]
- Updated dependencies [fd83526]
- Updated dependencies [d0b90ab]
- Updated dependencies [6f5eb7a]
- Updated dependencies [a01cf14]
- Updated dependencies [a9e50ee]
- Updated dependencies [5397eb4]
- Updated dependencies [376913a]
- Updated dependencies [c9f4e4a]
- Updated dependencies [0acbc80]
- Updated dependencies [376913a]
- Updated dependencies [38020d5]
  - @mastra/core@0.16.0
  - @mastra/upstash@0.15.0
  - @mastra/libsql@0.14.0
  - @mastra/github@1.2.12
  - @mastra/memory@0.14.4
  - @mastra/mcp@0.11.4
  - @mastra/rag@1.2.4

## 0.0.50-alpha.1

### Patch Changes

- Updated dependencies [8fbf79e]
- Updated dependencies [376913a]
- Updated dependencies [376913a]
- Updated dependencies [38020d5]
  - @mastra/core@0.16.0-alpha.1
  - @mastra/github@1.2.12-alpha.0
  - @mastra/memory@0.14.4-alpha.0
  - @mastra/mcp@0.11.4-alpha.0
  - @mastra/rag@1.2.4-alpha.0
  - @mastra/upstash@0.15.0-alpha.1
  - @mastra/libsql@0.14.0-alpha.1

## 0.0.50-alpha.0

### Patch Changes

- Updated dependencies [fd83526]
- Updated dependencies [d0b90ab]
- Updated dependencies [6f5eb7a]
- Updated dependencies [a01cf14]
- Updated dependencies [a9e50ee]
- Updated dependencies [5397eb4]
- Updated dependencies [c9f4e4a]
- Updated dependencies [0acbc80]
  - @mastra/core@0.16.0-alpha.0
  - @mastra/upstash@0.14.7-alpha.0
  - @mastra/libsql@0.13.9-alpha.0

## 0.0.49

### Patch Changes

- ab48c97: dependencies updates:
  - Updated dependency [`zod@^3.25.76` ↗︎](https://www.npmjs.com/package/zod/v/3.25.76) (from `^3.25.67`, in `dependencies`)
- de3cbc6: Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.
- Updated dependencies [ab48c97]
- Updated dependencies [ab48c97]
- Updated dependencies [8429e4c]
- Updated dependencies [ab48c97]
- Updated dependencies [85ef90b]
- Updated dependencies [aedbbfa]
- Updated dependencies [ff89505]
- Updated dependencies [637f323]
- Updated dependencies [de3cbc6]
- Updated dependencies [c19bcf7]
- Updated dependencies [a5632dd]
- Updated dependencies [4474d04]
- Updated dependencies [183dc95]
- Updated dependencies [a1111e2]
- Updated dependencies [b42a961]
- Updated dependencies [61debef]
- Updated dependencies [9beaeff]
- Updated dependencies [29de0e1]
- Updated dependencies [f643c65]
- Updated dependencies [00c74e7]
- Updated dependencies [f0dfcac]
- Updated dependencies [fef7375]
- Updated dependencies [e3d8fea]
- Updated dependencies [45e4d39]
- Updated dependencies [ad78bfc]
- Updated dependencies [9eee594]
- Updated dependencies [7149d8d]
- Updated dependencies [b415a4e]
- Updated dependencies [822c2e8]
- Updated dependencies [3b8972b]
- Updated dependencies [979912c]
- Updated dependencies [7dcf4c0]
- Updated dependencies [4106a58]
- Updated dependencies [dbc51ef]
- Updated dependencies [ad78bfc]
- Updated dependencies [0302f50]
- Updated dependencies [6ac697e]
- Updated dependencies [74db265]
- Updated dependencies [6cffb99]
- Updated dependencies [0ce418a]
- Updated dependencies [3e0153a]
- Updated dependencies [af90672]
- Updated dependencies [8387952]
- Updated dependencies [7f3b8da]
- Updated dependencies [905352b]
- Updated dependencies [599d04c]
- Updated dependencies [56041d0]
- Updated dependencies [3412597]
- Updated dependencies [5eca5d2]
- Updated dependencies [f2cda47]
- Updated dependencies [5de1555]
- Updated dependencies [cfd377a]
- Updated dependencies [1ed5a3e]
  - @mastra/core@0.15.3
  - @mastra/github@1.2.11
  - @mastra/libsql@0.13.8
  - @mastra/memory@0.14.3
  - @mastra/upstash@0.14.6
  - @mastra/mcp@0.11.3
  - @mastra/rag@1.2.3

## 0.0.49-alpha.9

### Patch Changes

- Updated dependencies [[`599d04c`](https://github.com/mastra-ai/mastra/commit/599d04cebe92c1d536fee3190434941b8c91548e)]:
  - @mastra/core@0.15.3-alpha.9

## 0.0.49-alpha.8

### Patch Changes

- Updated dependencies [[`4474d04`](https://github.com/mastra-ai/mastra/commit/4474d0489b1e152e0985c33a4f529207317d27b5), [`4106a58`](https://github.com/mastra-ai/mastra/commit/4106a58b15b4c0a060a4a9ccab52d119d00d8edb)]:
  - @mastra/core@0.15.3-alpha.8

## 0.0.49-alpha.7

### Patch Changes

- Updated dependencies [[`f0dfcac`](https://github.com/mastra-ai/mastra/commit/f0dfcac4458bdf789b975e2d63e984f5d1e7c4d3), [`7149d8d`](https://github.com/mastra-ai/mastra/commit/7149d8d4bdc1edf0008e0ca9b7925eb0b8b60dbe)]:
  - @mastra/github@1.2.11-alpha.3
  - @mastra/memory@0.14.3-alpha.4
  - @mastra/upstash@0.14.6-alpha.1
  - @mastra/libsql@0.13.8-alpha.3
  - @mastra/rag@1.2.3-alpha.2
  - @mastra/core@0.15.3-alpha.7

## 0.0.49-alpha.6

### Patch Changes

- Updated dependencies [[`8429e4c`](https://github.com/mastra-ai/mastra/commit/8429e4c0d2041d072826c4382c09187116573a77), [`c19bcf7`](https://github.com/mastra-ai/mastra/commit/c19bcf7b43542b02157b5e17303e519933a153ab), [`a5632dd`](https://github.com/mastra-ai/mastra/commit/a5632dd316a6246666662705404bda570b070af1), [`b42a961`](https://github.com/mastra-ai/mastra/commit/b42a961a5aefd19d6e938a7705fc0ecc90e8f756), [`45e4d39`](https://github.com/mastra-ai/mastra/commit/45e4d391a2a09fc70c48e4d60f505586ada1ba0e), [`3b8972b`](https://github.com/mastra-ai/mastra/commit/3b8972bab8161d9fd96f6a41f57181443636cd43), [`0302f50`](https://github.com/mastra-ai/mastra/commit/0302f50861a53c66ff28801fc371b37c5f97e41e), [`74db265`](https://github.com/mastra-ai/mastra/commit/74db265b96aa01a72ffd91dcae0bc3b346cca0f2), [`6cffb99`](https://github.com/mastra-ai/mastra/commit/6cffb99030dc46256e4c3c0e6730565a2825d7a4), [`7f3b8da`](https://github.com/mastra-ai/mastra/commit/7f3b8da6dd21c35d3672e44b4f5dd3502b8f8f92), [`905352b`](https://github.com/mastra-ai/mastra/commit/905352bcda134552400eb252bca1cb05a7975c14), [`f2cda47`](https://github.com/mastra-ai/mastra/commit/f2cda47ae911038c5d5489f54c36517d6f15bdcc), [`cfd377a`](https://github.com/mastra-ai/mastra/commit/cfd377a3a33a9c88b644f6540feed9cd9832db47)]:
  - @mastra/libsql@0.13.8-alpha.2
  - @mastra/core@0.15.3-alpha.6
  - @mastra/github@1.2.11-alpha.2
  - @mastra/memory@0.14.3-alpha.3
  - @mastra/mcp@0.11.3-alpha.3

## 0.0.49-alpha.5

### Patch Changes

- [#7343](https://github.com/mastra-ai/mastra/pull/7343) [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e) Thanks [@LekoArts](https://github.com/LekoArts)! - Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.

- Updated dependencies [[`85ef90b`](https://github.com/mastra-ai/mastra/commit/85ef90bb2cd4ae4df855c7ac175f7d392c55c1bf), [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e)]:
  - @mastra/core@0.15.3-alpha.5
  - @mastra/github@1.2.11-alpha.1
  - @mastra/memory@0.14.3-alpha.2
  - @mastra/upstash@0.14.6-alpha.0
  - @mastra/libsql@0.13.8-alpha.1
  - @mastra/mcp@0.11.3-alpha.2
  - @mastra/rag@1.2.3-alpha.1

## 0.0.49-alpha.4

### Patch Changes

- [#5816](https://github.com/mastra-ai/mastra/pull/5816) [`ab48c97`](https://github.com/mastra-ai/mastra/commit/ab48c979098ea571faf998a55d3a00e7acd7a715) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`zod@^3.25.76` ↗︎](https://www.npmjs.com/package/zod/v/3.25.76) (from `^3.25.67`, in `dependencies`)
- Updated dependencies [[`ab48c97`](https://github.com/mastra-ai/mastra/commit/ab48c979098ea571faf998a55d3a00e7acd7a715), [`ab48c97`](https://github.com/mastra-ai/mastra/commit/ab48c979098ea571faf998a55d3a00e7acd7a715), [`ab48c97`](https://github.com/mastra-ai/mastra/commit/ab48c979098ea571faf998a55d3a00e7acd7a715), [`ff89505`](https://github.com/mastra-ai/mastra/commit/ff895057c8c7e91a5535faef46c5e5391085ddfa), [`183dc95`](https://github.com/mastra-ai/mastra/commit/183dc95596f391b977bd1a2c050b8498dac74891), [`a1111e2`](https://github.com/mastra-ai/mastra/commit/a1111e24e705488adfe5e0a6f20c53bddf26cb22), [`61debef`](https://github.com/mastra-ai/mastra/commit/61debefd80ad3a7ed5737e19df6a23d40091689a), [`9beaeff`](https://github.com/mastra-ai/mastra/commit/9beaeffa4a97b1d5fd01a7f8af8708b16067f67c), [`ad78bfc`](https://github.com/mastra-ai/mastra/commit/ad78bfc4ea6a1fff140432bf4f638e01af7af668), [`9eee594`](https://github.com/mastra-ai/mastra/commit/9eee594e35e0ca2a650fcc33fa82009a142b9ed0), [`979912c`](https://github.com/mastra-ai/mastra/commit/979912cfd180aad53287cda08af771df26454e2c), [`7dcf4c0`](https://github.com/mastra-ai/mastra/commit/7dcf4c04f44d9345b1f8bc5d41eae3f11ac61611), [`ad78bfc`](https://github.com/mastra-ai/mastra/commit/ad78bfc4ea6a1fff140432bf4f638e01af7af668), [`0ce418a`](https://github.com/mastra-ai/mastra/commit/0ce418a1ccaa5e125d4483a9651b635046152569), [`8387952`](https://github.com/mastra-ai/mastra/commit/838795227b4edf758c84a2adf6f7fba206c27719), [`5eca5d2`](https://github.com/mastra-ai/mastra/commit/5eca5d2655788863ea0442a46c9ef5d3c6dbe0a8)]:
  - @mastra/core@0.15.3-alpha.4
  - @mastra/github@1.2.11-alpha.0
  - @mastra/memory@0.14.3-alpha.1
  - @mastra/mcp@0.11.3-alpha.1

## 0.0.49-alpha.3

### Patch Changes

- Updated dependencies [[`aedbbfa`](https://github.com/mastra-ai/mastra/commit/aedbbfa064124ddde039111f12629daebfea7e48), [`f643c65`](https://github.com/mastra-ai/mastra/commit/f643c651bdaf57c2343cf9dbfc499010495701fb), [`fef7375`](https://github.com/mastra-ai/mastra/commit/fef737534574f41b432a7361a285f776c3bac42b), [`e3d8fea`](https://github.com/mastra-ai/mastra/commit/e3d8feaacfb8b5c5c03c13604cc06ea2873d45fe), [`dbc51ef`](https://github.com/mastra-ai/mastra/commit/dbc51ef2e42604117ab90917fc284a560647a61f), [`3412597`](https://github.com/mastra-ai/mastra/commit/3412597a6644c0b6bf3236d6e319ed1450c5bae8)]:
  - @mastra/core@0.15.3-alpha.3
  - @mastra/libsql@0.13.8-alpha.0

## 0.0.49-alpha.2

### Patch Changes

- Updated dependencies [[`822c2e8`](https://github.com/mastra-ai/mastra/commit/822c2e88a3ecbffb7c680e6227976006ccefe6a8)]:
  - @mastra/core@0.15.3-alpha.2

## 0.0.49-alpha.1

### Patch Changes

- Updated dependencies [[`637f323`](https://github.com/mastra-ai/mastra/commit/637f32371d79a8f78c52c0d53411af0915fcec67), [`29de0e1`](https://github.com/mastra-ai/mastra/commit/29de0e1b0a7173317ae7d1ab0c0993167c659f2b), [`b415a4e`](https://github.com/mastra-ai/mastra/commit/b415a4e05b2546ccb9b5ba31a2bdf23deb1c7fa8), [`6ac697e`](https://github.com/mastra-ai/mastra/commit/6ac697edcc2435482c247cba615277ec4765dcc4)]:
  - @mastra/core@0.15.3-alpha.1
  - @mastra/rag@1.2.3-alpha.0
  - @mastra/memory@0.14.3-alpha.0

## 0.0.49-alpha.0

### Patch Changes

- Updated dependencies [[`00c74e7`](https://github.com/mastra-ai/mastra/commit/00c74e73b1926be0d475693bb886fb67a22ff352), [`3e0153a`](https://github.com/mastra-ai/mastra/commit/3e0153adcf2309f3ffb01c9ac9e0f5adc0caa259), [`af90672`](https://github.com/mastra-ai/mastra/commit/af906722d8da28688882193b1e531026f9e2e81e), [`56041d0`](https://github.com/mastra-ai/mastra/commit/56041d018863a3da6b98c512e47348647c075fb3), [`5de1555`](https://github.com/mastra-ai/mastra/commit/5de15554d3d6695211945a36928f6657e76cddc9), [`1ed5a3e`](https://github.com/mastra-ai/mastra/commit/1ed5a3e19330374c4347a4237cd2f4b9ffb60376)]:
  - @mastra/core@0.15.3-alpha.0
  - @mastra/mcp@0.11.3-alpha.0

## 0.0.48

### Patch Changes

- Updated dependencies [[`c6113ed`](https://github.com/mastra-ai/mastra/commit/c6113ed7f9df297e130d94436ceee310273d6430)]:
  - @mastra/github@1.2.10
  - @mastra/mcp@0.11.2
  - @mastra/memory@0.14.2
  - @mastra/rag@1.2.2
  - @mastra/libsql@0.13.7
  - @mastra/upstash@0.14.5
  - @mastra/core@0.15.2

## 0.0.47

### Patch Changes

- Updated dependencies [[`95b2aa9`](https://github.com/mastra-ai/mastra/commit/95b2aa908230919e67efcac0d69005a2d5745298)]:
  - @mastra/github@1.2.9
  - @mastra/memory@0.14.1
  - @mastra/upstash@0.14.4
  - @mastra/libsql@0.13.6
  - @mastra/mcp@0.11.1
  - @mastra/rag@1.2.1
  - @mastra/core@0.15.1

## 0.0.46

### Patch Changes

- Updated dependencies [[`0778757`](https://github.com/mastra-ai/mastra/commit/07787570e4addbd501522037bd2542c3d9e26822), [`e38f807`](https://github.com/mastra-ai/mastra/commit/e38f8072853cc803ba48394e1930825129708400), [`943a7f3`](https://github.com/mastra-ai/mastra/commit/943a7f3dbc6a8ab3f9b7bc7c8a1c5b319c3d7f56), [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b), [`24d9ee3`](https://github.com/mastra-ai/mastra/commit/24d9ee3db1c09d15f27a5d0971b102abcfcf7dfd), [`da58ccc`](https://github.com/mastra-ai/mastra/commit/da58ccc1f2ac33da0cb97b00443fc6208b45bdec), [`be49354`](https://github.com/mastra-ai/mastra/commit/be493546dca540101923ec700feb31f9a13939f2), [`d591ab3`](https://github.com/mastra-ai/mastra/commit/d591ab3ecc985c1870c0db347f8d7a20f7360536), [`ba82abe`](https://github.com/mastra-ai/mastra/commit/ba82abe76e869316bb5a9c95e8ea3946f3436fae), [`727f7e5`](https://github.com/mastra-ai/mastra/commit/727f7e5086e62e0dfe3356fb6dcd8bcb420af246), [`94e9f54`](https://github.com/mastra-ai/mastra/commit/94e9f547d66ef7cd01d9075ab53b5ca9a1cae100), [`e6f5046`](https://github.com/mastra-ai/mastra/commit/e6f50467aff317e67e8bd74c485c3fbe2a5a6db1), [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95), [`2e58325`](https://github.com/mastra-ai/mastra/commit/2e58325beb170f5b92f856e27d915cd26917e5e6), [`0594a70`](https://github.com/mastra-ai/mastra/commit/0594a70ac948d306c7f38765b171c9535e6c78d4), [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c), [`4189486`](https://github.com/mastra-ai/mastra/commit/4189486c6718fda78347bdf4ce4d3fc33b2236e1), [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01), [`704173b`](https://github.com/mastra-ai/mastra/commit/704173b0d047e8d4cf29872464f383afc2f0c054), [`9613558`](https://github.com/mastra-ai/mastra/commit/9613558e6475f4710e05d1be7553a32ee7bddc20)]:
  - @mastra/core@0.15.0
  - @mastra/mcp@0.11.0
  - @mastra/memory@0.14.0
  - @mastra/rag@1.2.0
  - @mastra/upstash@0.14.3
  - @mastra/libsql@0.13.5

## 0.0.46-alpha.4

### Patch Changes

- Updated dependencies [[`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c)]:
  - @mastra/memory@0.14.0-alpha.3
  - @mastra/core@0.15.0-alpha.4
  - @mastra/mcp@0.11.0-alpha.3
  - @mastra/rag@1.2.0-alpha.2

## 0.0.46-alpha.3

### Patch Changes

- Updated dependencies [[`da58ccc`](https://github.com/mastra-ai/mastra/commit/da58ccc1f2ac33da0cb97b00443fc6208b45bdec)]:
  - @mastra/memory@0.14.0-alpha.2
  - @mastra/mcp@0.11.0-alpha.2
  - @mastra/rag@1.2.0-alpha.1
  - @mastra/core@0.15.0-alpha.3

## 0.0.46-alpha.2

### Patch Changes

- Updated dependencies [[`2e58325`](https://github.com/mastra-ai/mastra/commit/2e58325beb170f5b92f856e27d915cd26917e5e6)]:
  - @mastra/core@0.14.2-alpha.2

## 0.0.46-alpha.1

### Patch Changes

- Updated dependencies [[`943a7f3`](https://github.com/mastra-ai/mastra/commit/943a7f3dbc6a8ab3f9b7bc7c8a1c5b319c3d7f56), [`24d9ee3`](https://github.com/mastra-ai/mastra/commit/24d9ee3db1c09d15f27a5d0971b102abcfcf7dfd), [`be49354`](https://github.com/mastra-ai/mastra/commit/be493546dca540101923ec700feb31f9a13939f2), [`d591ab3`](https://github.com/mastra-ai/mastra/commit/d591ab3ecc985c1870c0db347f8d7a20f7360536), [`ba82abe`](https://github.com/mastra-ai/mastra/commit/ba82abe76e869316bb5a9c95e8ea3946f3436fae), [`727f7e5`](https://github.com/mastra-ai/mastra/commit/727f7e5086e62e0dfe3356fb6dcd8bcb420af246), [`94e9f54`](https://github.com/mastra-ai/mastra/commit/94e9f547d66ef7cd01d9075ab53b5ca9a1cae100), [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95), [`0594a70`](https://github.com/mastra-ai/mastra/commit/0594a70ac948d306c7f38765b171c9535e6c78d4), [`4189486`](https://github.com/mastra-ai/mastra/commit/4189486c6718fda78347bdf4ce4d3fc33b2236e1), [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01), [`704173b`](https://github.com/mastra-ai/mastra/commit/704173b0d047e8d4cf29872464f383afc2f0c054)]:
  - @mastra/core@0.14.2-alpha.1
  - @mastra/memory@0.13.2-alpha.1
  - @mastra/mcp@0.10.13-alpha.1
  - @mastra/rag@1.1.1-alpha.0
  - @mastra/upstash@0.14.3-alpha.0
  - @mastra/libsql@0.13.5-alpha.0

## 0.0.46-alpha.0

### Patch Changes

- Updated dependencies [[`0778757`](https://github.com/mastra-ai/mastra/commit/07787570e4addbd501522037bd2542c3d9e26822), [`e38f807`](https://github.com/mastra-ai/mastra/commit/e38f8072853cc803ba48394e1930825129708400), [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b), [`e6f5046`](https://github.com/mastra-ai/mastra/commit/e6f50467aff317e67e8bd74c485c3fbe2a5a6db1), [`9613558`](https://github.com/mastra-ai/mastra/commit/9613558e6475f4710e05d1be7553a32ee7bddc20)]:
  - @mastra/core@0.14.2-alpha.0
  - @mastra/mcp@0.10.13-alpha.0
  - @mastra/memory@0.13.2-alpha.0

## 0.0.45

### Patch Changes

- Updated dependencies [[`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27), [`64ad21f`](https://github.com/mastra-ai/mastra/commit/64ad21ff4f58ce8b344d163d800d9e4f84d82f6f), [`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27), [`c4f2605`](https://github.com/mastra-ai/mastra/commit/c4f2605fa00e796a26c6f5fc3cf8f5552f77d617), [`0f00e17`](https://github.com/mastra-ai/mastra/commit/0f00e172953ccdccadb35ed3d70f5e4d89115869), [`217cd7a`](https://github.com/mastra-ai/mastra/commit/217cd7a4ce171e9a575c41bb8c83300f4db03236), [`a5a23d9`](https://github.com/mastra-ai/mastra/commit/a5a23d981920d458dc6078919992a5338931ef02)]:
  - @mastra/core@0.14.1
  - @mastra/libsql@0.13.4
  - @mastra/memory@0.13.1
  - @mastra/upstash@0.14.2

## 0.0.45-alpha.1

### Patch Changes

- Updated dependencies [[`0f00e17`](https://github.com/mastra-ai/mastra/commit/0f00e172953ccdccadb35ed3d70f5e4d89115869), [`217cd7a`](https://github.com/mastra-ai/mastra/commit/217cd7a4ce171e9a575c41bb8c83300f4db03236)]:
  - @mastra/core@0.14.1-alpha.1

## 0.0.45-alpha.0

### Patch Changes

- Updated dependencies [[`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27), [`64ad21f`](https://github.com/mastra-ai/mastra/commit/64ad21ff4f58ce8b344d163d800d9e4f84d82f6f), [`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27), [`c4f2605`](https://github.com/mastra-ai/mastra/commit/c4f2605fa00e796a26c6f5fc3cf8f5552f77d617), [`a5a23d9`](https://github.com/mastra-ai/mastra/commit/a5a23d981920d458dc6078919992a5338931ef02)]:
  - @mastra/core@0.14.1-alpha.0
  - @mastra/libsql@0.13.4-alpha.0
  - @mastra/memory@0.13.1-alpha.0
  - @mastra/upstash@0.14.2-alpha.0

## 0.0.44

### Patch Changes

- Updated dependencies [8a41506]
- Updated dependencies [895d3b2]
- Updated dependencies [227c7e6]
- Updated dependencies [12cae67]
- Updated dependencies [fd3a3eb]
- Updated dependencies [6faaee5]
- Updated dependencies [4232b14]
- Updated dependencies [a89de7e]
- Updated dependencies [5a37d0c]
- Updated dependencies [4bde0cb]
- Updated dependencies [e1aed55]
- Updated dependencies [cf4f357]
- Updated dependencies [03997ae]
- Updated dependencies [03997ae]
- Updated dependencies [ad888a2]
- Updated dependencies [481751d]
- Updated dependencies [2454423]
- Updated dependencies [194e395]
- Updated dependencies [a722c0b]
- Updated dependencies [c30bca8]
- Updated dependencies [d6e39da]
- Updated dependencies [3b5fec7]
- Updated dependencies [a8f129d]
  - @mastra/memory@0.13.0
  - @mastra/mcp@0.10.12
  - @mastra/core@0.14.0
  - @mastra/github@1.2.8
  - @mastra/upstash@0.14.1
  - @mastra/libsql@0.13.3
  - @mastra/rag@1.1.0

## 0.0.44-alpha.7

### Patch Changes

- Updated dependencies [03997ae]
- Updated dependencies [03997ae]
  - @mastra/github@1.2.8-alpha.0
  - @mastra/upstash@0.14.1-alpha.0
  - @mastra/libsql@0.13.3-alpha.1
  - @mastra/mcp@0.10.12-alpha.2
  - @mastra/memory@0.13.0-alpha.1
  - @mastra/rag@1.1.0-alpha.1
  - @mastra/core@0.14.0-alpha.7

## 0.0.44-alpha.6

### Patch Changes

- Updated dependencies [ad888a2]
- Updated dependencies [481751d]
- Updated dependencies [194e395]
  - @mastra/core@0.14.0-alpha.6

## 0.0.44-alpha.5

### Patch Changes

- @mastra/core@0.14.0-alpha.5

## 0.0.44-alpha.4

### Patch Changes

- Updated dependencies [8a41506]
- Updated dependencies [0a7f675]
- Updated dependencies [12cae67]
- Updated dependencies [5a37d0c]
- Updated dependencies [4bde0cb]
- Updated dependencies [e1aed55]
- Updated dependencies [1a80071]
- Updated dependencies [36a3be8]
- Updated dependencies [361757b]
- Updated dependencies [2bb9955]
- Updated dependencies [2454423]
- Updated dependencies [a44d91e]
- Updated dependencies [dfb91e9]
- Updated dependencies [a741dde]
- Updated dependencies [e2ed127]
- Updated dependencies [7cb3fc0]
- Updated dependencies [195eabb]
- Updated dependencies [b78b95b]
  - @mastra/memory@0.12.3-alpha.0
  - @mastra/core@0.14.0-alpha.4
  - @mastra/mcp@0.10.12-alpha.1
  - @mastra/rag@1.0.9-alpha.0

## 0.0.44-alpha.3

### Patch Changes

- Updated dependencies [227c7e6]
- Updated dependencies [fd3a3eb]
- Updated dependencies [a8f129d]
  - @mastra/core@0.14.0-alpha.3

## 0.0.44-alpha.2

### Patch Changes

- @mastra/core@0.14.0-alpha.2

## 0.0.44-alpha.1

### Patch Changes

- Updated dependencies [895d3b2]
- Updated dependencies [6faaee5]
- Updated dependencies [4232b14]
- Updated dependencies [a89de7e]
- Updated dependencies [cf4f357]
- Updated dependencies [a722c0b]
- Updated dependencies [d6e39da]
- Updated dependencies [3b5fec7]
  - @mastra/mcp@0.10.12-alpha.0
  - @mastra/core@0.14.0-alpha.1
  - @mastra/libsql@0.13.3-alpha.0

## 0.0.44-alpha.0

### Patch Changes

- Updated dependencies [c30bca8]
  - @mastra/core@0.13.3-alpha.0

## 0.0.43

### Patch Changes

- Updated dependencies [d5330bf]
- Updated dependencies [2e74797]
- Updated dependencies [da62f49]
- Updated dependencies [8388649]
- Updated dependencies [a239d41]
- Updated dependencies [dd94a26]
- Updated dependencies [3ba6772]
- Updated dependencies [b5cf2a3]
- Updated dependencies [2fff911]
- Updated dependencies [1be6004]
- Updated dependencies [b32c50d]
- Updated dependencies [63449d0]
- Updated dependencies [121a3f8]
- Updated dependencies [ec510e7]
  - @mastra/core@0.13.2
  - @mastra/memory@0.12.2
  - @mastra/libsql@0.13.2
  - @mastra/rag@1.0.8
  - @mastra/mcp@0.10.11

## 0.0.43-alpha.3

### Patch Changes

- Updated dependencies [b5cf2a3]
  - @mastra/core@0.13.2-alpha.3
  - @mastra/libsql@0.13.2-alpha.1

## 0.0.43-alpha.2

### Patch Changes

- Updated dependencies [d5330bf]
- Updated dependencies [a239d41]
- Updated dependencies [b32c50d]
- Updated dependencies [121a3f8]
- Updated dependencies [ec510e7]
  - @mastra/core@0.13.2-alpha.2
  - @mastra/libsql@0.13.2-alpha.0
  - @mastra/mcp@0.10.11-alpha.0
  - @mastra/memory@0.12.2-alpha.2

## 0.0.43-alpha.1

### Patch Changes

- Updated dependencies [2e74797]
- Updated dependencies [da62f49]
- Updated dependencies [63449d0]
  - @mastra/core@0.13.2-alpha.1
  - @mastra/memory@0.12.2-alpha.1

## 0.0.43-alpha.0

### Patch Changes

- Updated dependencies [8388649]
- Updated dependencies [dd94a26]
- Updated dependencies [3ba6772]
- Updated dependencies [2fff911]
- Updated dependencies [1be6004]
  - @mastra/core@0.13.2-alpha.0
  - @mastra/memory@0.12.2-alpha.0
  - @mastra/rag@1.0.8-alpha.0

## 0.0.42

### Patch Changes

- Updated dependencies [8888b57]
- Updated dependencies [cd0042e]
  - @mastra/libsql@0.13.1
  - @mastra/core@0.13.1

## 0.0.42-alpha.0

### Patch Changes

- Updated dependencies [8888b57]
- Updated dependencies [cd0042e]
  - @mastra/libsql@0.13.1-alpha.0
  - @mastra/core@0.13.1-alpha.0

## 0.0.41

### Patch Changes

- Updated dependencies [cb36de0]
- Updated dependencies [d0496e6]
- Updated dependencies [7d53af4]
- Updated dependencies [e1a2ef1]
- Updated dependencies [f082460]
- Updated dependencies [e1a2ef1]
- Updated dependencies [a82b851]
- Updated dependencies [ea0c5f2]
- Updated dependencies [41a0a0e]
- Updated dependencies [351b36e]
- Updated dependencies [ea0c5f2]
- Updated dependencies [2871020]
- Updated dependencies [9e792ef]
- Updated dependencies [ccd519c]
- Updated dependencies [94f4812]
- Updated dependencies [e202b82]
- Updated dependencies [e00f6a0]
- Updated dependencies [4a406ec]
- Updated dependencies [b0e43c1]
- Updated dependencies [5d377e5]
- Updated dependencies [50f80dd]
- Updated dependencies [1fb812e]
- Updated dependencies [35c5798]
  - @mastra/core@0.13.0
  - @mastra/memory@0.12.1
  - @mastra/upstash@0.14.0
  - @mastra/rag@1.0.7
  - @mastra/libsql@0.13.0
  - @mastra/mcp@0.10.10
  - @mastra/github@1.2.7

## 0.0.41-alpha.3

### Patch Changes

- Updated dependencies [d0496e6]
- Updated dependencies [9e792ef]
  - @mastra/core@0.13.0-alpha.3
  - @mastra/mcp@0.10.10-alpha.1

## 0.0.41-alpha.2

### Patch Changes

- Updated dependencies [cb36de0]
- Updated dependencies [e1a2ef1]
- Updated dependencies [f082460]
- Updated dependencies [e1a2ef1]
- Updated dependencies [a82b851]
- Updated dependencies [41a0a0e]
- Updated dependencies [2871020]
- Updated dependencies [4a406ec]
- Updated dependencies [5d377e5]
- Updated dependencies [50f80dd]
  - @mastra/core@0.13.0-alpha.2
  - @mastra/memory@0.12.1-alpha.2
  - @mastra/upstash@0.14.0-alpha.1
  - @mastra/libsql@0.13.0-alpha.1
  - @mastra/github@1.2.7-alpha.0
  - @mastra/mcp@0.10.10-alpha.0
  - @mastra/rag@1.0.7-alpha.1

## 0.0.41-alpha.1

### Patch Changes

- Updated dependencies [7d53af4]
- Updated dependencies [ea0c5f2]
- Updated dependencies [351b36e]
- Updated dependencies [ea0c5f2]
- Updated dependencies [ccd519c]
- Updated dependencies [b0e43c1]
- Updated dependencies [1fb812e]
- Updated dependencies [35c5798]
  - @mastra/memory@0.12.1-alpha.1
  - @mastra/core@0.13.0-alpha.1
  - @mastra/rag@1.0.7-alpha.0
  - @mastra/upstash@0.14.0-alpha.0
  - @mastra/libsql@0.13.0-alpha.0

## 0.0.41-alpha.0

### Patch Changes

- Updated dependencies [94f4812]
- Updated dependencies [e202b82]
- Updated dependencies [e00f6a0]
  - @mastra/core@0.12.2-alpha.0
  - @mastra/memory@0.12.1-alpha.0

## 0.0.40

### Patch Changes

- Updated dependencies [33dcb07]
- Updated dependencies [f90797b]
- Updated dependencies [613eec3]
- Updated dependencies [d0d9500]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [b4a8df0]
  - @mastra/core@0.12.1
  - @mastra/mcp@0.10.9
  - @mastra/rag@1.0.6

## 0.0.40-alpha.1

### Patch Changes

- Updated dependencies [d0d9500]
  - @mastra/core@0.12.1-alpha.1

## 0.0.40-alpha.0

### Patch Changes

- Updated dependencies [33dcb07]
- Updated dependencies [f90797b]
- Updated dependencies [613eec3]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [b4a8df0]
  - @mastra/core@0.12.1-alpha.0
  - @mastra/mcp@0.10.9-alpha.0
  - @mastra/rag@1.0.6-alpha.0

## 0.0.39

### Patch Changes

- 23247c4: dependencies updates:
  - Updated dependency [`typescript@^5.8.3` ↗︎](https://www.npmjs.com/package/typescript/v/5.8.3) (from `^5.8.2`, in `dependencies`)
- Updated dependencies [510e2c8]
- Updated dependencies [2f72fb2]
- Updated dependencies [27cc97a]
- Updated dependencies [24ac5ff]
- Updated dependencies [674a348]
- Updated dependencies [fc437d9]
- Updated dependencies [674a348]
- Updated dependencies [3f89307]
- Updated dependencies [b5a6da2]
- Updated dependencies [9eda7d4]
- Updated dependencies [9d49408]
- Updated dependencies [41daa63]
- Updated dependencies [ad0a58b]
- Updated dependencies [254a36b]
- Updated dependencies [2ecf658]
- Updated dependencies [7a7754f]
- Updated dependencies [fc92d80]
- Updated dependencies [e0f73c6]
- Updated dependencies [0b89602]
- Updated dependencies [4d37822]
- Updated dependencies [23a6a7c]
- Updated dependencies [cda801d]
- Updated dependencies [a77c823]
- Updated dependencies [ff9c125]
- Updated dependencies [09bca64]
- Updated dependencies [a3ca14c]
- Updated dependencies [b92bc89]
- Updated dependencies [f42c4c2]
- Updated dependencies [b8efbb9]
- Updated dependencies [71466e7]
- Updated dependencies [0c99fbe]
- Updated dependencies [ad8a1d8]
  - @mastra/core@0.12.0
  - @mastra/libsql@0.12.0
  - @mastra/memory@0.12.0
  - @mastra/rag@1.0.5
  - @mastra/upstash@0.13.0
  - @mastra/github@1.2.6
  - @mastra/mcp@0.10.8

## 0.0.39-alpha.5

### Patch Changes

- Updated dependencies [f42c4c2]
  - @mastra/memory@0.12.0-alpha.3
  - @mastra/libsql@0.12.0-alpha.2
  - @mastra/upstash@0.13.0-alpha.2
  - @mastra/github@1.2.6-alpha.0
  - @mastra/mcp@0.10.8-alpha.0
  - @mastra/rag@1.0.5-alpha.1
  - @mastra/core@0.12.0-alpha.5

## 0.0.39-alpha.4

### Patch Changes

- Updated dependencies [ad0a58b]
  - @mastra/core@0.12.0-alpha.4

## 0.0.39-alpha.3

### Patch Changes

- @mastra/core@0.12.0-alpha.3

## 0.0.39-alpha.2

### Patch Changes

- Updated dependencies [27cc97a]
- Updated dependencies [41daa63]
- Updated dependencies [254a36b]
- Updated dependencies [0b89602]
- Updated dependencies [4d37822]
- Updated dependencies [ff9c125]
- Updated dependencies [b92bc89]
- Updated dependencies [b8efbb9]
- Updated dependencies [71466e7]
- Updated dependencies [0c99fbe]
  - @mastra/core@0.12.0-alpha.2
  - @mastra/memory@0.11.6-alpha.2
  - @mastra/libsql@0.11.3-alpha.1
  - @mastra/upstash@0.12.4-alpha.1

## 0.0.39-alpha.1

### Patch Changes

- Updated dependencies [e0f73c6]
- Updated dependencies [cda801d]
- Updated dependencies [a77c823]
  - @mastra/core@0.12.0-alpha.1
  - @mastra/memory@0.11.6-alpha.1

## 0.0.39-alpha.0

### Patch Changes

- 23247c4: dependencies updates:
  - Updated dependency [`typescript@^5.8.3` ↗︎](https://www.npmjs.com/package/typescript/v/5.8.3) (from `^5.8.2`, in `dependencies`)
- Updated dependencies [510e2c8]
- Updated dependencies [2f72fb2]
- Updated dependencies [24ac5ff]
- Updated dependencies [674a348]
- Updated dependencies [fc437d9]
- Updated dependencies [674a348]
- Updated dependencies [3f89307]
- Updated dependencies [b5a6da2]
- Updated dependencies [9eda7d4]
- Updated dependencies [9d49408]
- Updated dependencies [2ecf658]
- Updated dependencies [7a7754f]
- Updated dependencies [fc92d80]
- Updated dependencies [23a6a7c]
- Updated dependencies [09bca64]
- Updated dependencies [a3ca14c]
- Updated dependencies [ad8a1d8]
  - @mastra/core@0.12.0-alpha.0
  - @mastra/libsql@0.11.3-alpha.0
  - @mastra/memory@0.11.6-alpha.0
  - @mastra/rag@1.0.5-alpha.0
  - @mastra/upstash@0.12.4-alpha.0

## 0.0.38

### Patch Changes

- Updated dependencies [3cc50c7]
- Updated dependencies [ce088f5]
  - @mastra/libsql@0.11.2
  - @mastra/github@1.2.5
  - @mastra/memory@0.11.5
  - @mastra/upstash@0.12.3
  - @mastra/mcp@0.10.7
  - @mastra/rag@1.0.4
  - @mastra/core@0.11.1

## 0.0.37

### Patch Changes

- Updated dependencies [138f4a2]
- Updated dependencies [f248d53]
- Updated dependencies [2affc57]
- Updated dependencies [66e13e3]
- Updated dependencies [edd9482]
- Updated dependencies [18344d7]
- Updated dependencies [7ba91fa]
- Updated dependencies [9d372c2]
- Updated dependencies [40c2525]
- Updated dependencies [e473f27]
- Updated dependencies [032cb66]
- Updated dependencies [703ac71]
- Updated dependencies [a723d69]
- Updated dependencies [7827943]
- Updated dependencies [5889a31]
- Updated dependencies [bf1e7e7]
- Updated dependencies [65e3395]
- Updated dependencies [4933192]
- Updated dependencies [d1c77a4]
- Updated dependencies [bea9dd1]
- Updated dependencies [da168a4]
- Updated dependencies [dcd4802]
- Updated dependencies [cbddd18]
- Updated dependencies [7ba91fa]
  - @mastra/memory@0.11.4
  - @mastra/core@0.11.0
  - @mastra/upstash@0.12.2
  - @mastra/libsql@0.11.1

## 0.0.37-alpha.3

### Patch Changes

- @mastra/core@0.11.0-alpha.3

## 0.0.37-alpha.2

### Patch Changes

- Updated dependencies [f248d53]
- Updated dependencies [2affc57]
- Updated dependencies [66e13e3]
- Updated dependencies [edd9482]
- Updated dependencies [18344d7]
- Updated dependencies [7ba91fa]
- Updated dependencies [9d372c2]
- Updated dependencies [40c2525]
- Updated dependencies [e473f27]
- Updated dependencies [032cb66]
- Updated dependencies [703ac71]
- Updated dependencies [a723d69]
- Updated dependencies [5889a31]
- Updated dependencies [65e3395]
- Updated dependencies [4933192]
- Updated dependencies [d1c77a4]
- Updated dependencies [bea9dd1]
- Updated dependencies [da168a4]
- Updated dependencies [dcd4802]
- Updated dependencies [7ba91fa]
  - @mastra/core@0.11.0-alpha.2
  - @mastra/upstash@0.12.2-alpha.0
  - @mastra/libsql@0.11.1-alpha.0

## 0.0.37-alpha.1

### Patch Changes

- @mastra/core@0.11.0-alpha.1

## 0.0.37-alpha.0

### Patch Changes

- Updated dependencies [138f4a2]
- Updated dependencies [7827943]
- Updated dependencies [bf1e7e7]
- Updated dependencies [cbddd18]
  - @mastra/memory@0.11.4-alpha.0
  - @mastra/core@0.11.0-alpha.0

## 0.0.36

### Patch Changes

- Updated dependencies [4b20131]
- Updated dependencies [0b56518]
- Updated dependencies [db5cc15]
- Updated dependencies [2ba5b76]
- Updated dependencies [edff568]
- Updated dependencies [5237998]
- Updated dependencies [c3a30de]
- Updated dependencies [37c1acd]
- Updated dependencies [1aa60b1]
- Updated dependencies [89ec9d4]
- Updated dependencies [cf3a184]
- Updated dependencies [d6bfd60]
- Updated dependencies [626b0f4]
- Updated dependencies [c22a91f]
- Updated dependencies [f7403ab]
- Updated dependencies [6c89d7f]
  - @mastra/memory@0.11.3
  - @mastra/core@0.10.15
  - @mastra/rag@1.0.3

## 0.0.36-alpha.1

### Patch Changes

- Updated dependencies [0b56518]
- Updated dependencies [2ba5b76]
- Updated dependencies [c3a30de]
- Updated dependencies [cf3a184]
- Updated dependencies [d6bfd60]
  - @mastra/core@0.10.15-alpha.1
  - @mastra/memory@0.11.3-alpha.1

## 0.0.36-alpha.0

### Patch Changes

- Updated dependencies [4b20131]
- Updated dependencies [db5cc15]
- Updated dependencies [edff568]
- Updated dependencies [5237998]
- Updated dependencies [37c1acd]
- Updated dependencies [1aa60b1]
- Updated dependencies [89ec9d4]
- Updated dependencies [626b0f4]
- Updated dependencies [c22a91f]
- Updated dependencies [f7403ab]
- Updated dependencies [6c89d7f]
  - @mastra/memory@0.11.3-alpha.0
  - @mastra/core@0.10.15-alpha.0
  - @mastra/rag@1.0.3-alpha.0

## 0.0.35

### Patch Changes

- @mastra/core@0.10.14

## 0.0.33

### Patch Changes

- Updated dependencies [b4a9811]
- Updated dependencies [4d5583d]
  - @mastra/core@0.10.12

## 0.0.33-alpha.1

### Patch Changes

- Updated dependencies [4d5583d]
  - @mastra/core@0.10.12-alpha.1

## 0.0.33-alpha.0

### Patch Changes

- Updated dependencies [b4a9811]
  - @mastra/core@0.10.12-alpha.0

## 0.0.32

### Patch Changes

- Updated dependencies [2873c7f]
- Updated dependencies [1c1c6a1]
- Updated dependencies [fb2a1b9]
- Updated dependencies [bc2bbdc]
- Updated dependencies [bef10e5]
- Updated dependencies [f5ec3a4]
- Updated dependencies [f8ce2cc]
- Updated dependencies [ab3bbff]
- Updated dependencies [8c846b6]
- Updated dependencies [c7bbf1e]
- Updated dependencies [8722d53]
- Updated dependencies [565cc0c]
- Updated dependencies [43da563]
- Updated dependencies [b790fd1]
- Updated dependencies [132027f]
- Updated dependencies [0c85311]
- Updated dependencies [d7ed04d]
- Updated dependencies [c0ba5e2]
- Updated dependencies [cb16baf]
- Updated dependencies [f36e4f1]
- Updated dependencies [7f6e403]
  - @mastra/core@0.10.11
  - @mastra/memory@0.11.2
  - @mastra/upstash@0.12.1
  - @mastra/mcp@0.10.6
  - @mastra/rag@1.0.2

## 0.0.32-alpha.4

### Patch Changes

- @mastra/core@0.10.11-alpha.4

## 0.0.32-alpha.3

### Patch Changes

- Updated dependencies [c7bbf1e]
- Updated dependencies [8722d53]
- Updated dependencies [43da563]
- Updated dependencies [132027f]
- Updated dependencies [0c85311]
- Updated dependencies [c0ba5e2]
- Updated dependencies [cb16baf]
  - @mastra/core@0.10.11-alpha.3
  - @mastra/rag@1.0.2-alpha.0
  - @mastra/mcp@0.10.6-alpha.1

## 0.0.32-alpha.2

### Patch Changes

- Updated dependencies [2873c7f]
- Updated dependencies [1c1c6a1]
- Updated dependencies [bc2bbdc]
- Updated dependencies [bef10e5]
- Updated dependencies [f5ec3a4]
- Updated dependencies [ab3bbff]
- Updated dependencies [565cc0c]
  - @mastra/core@0.10.11-alpha.2
  - @mastra/memory@0.11.2-alpha.1
  - @mastra/upstash@0.12.1-alpha.0
  - @mastra/mcp@0.10.6-alpha.0

## 0.0.32-alpha.1

### Patch Changes

- Updated dependencies [7f6e403]
  - @mastra/core@0.10.11-alpha.1

## 0.0.32-alpha.0

### Patch Changes

- Updated dependencies [fb2a1b9]
- Updated dependencies [f8ce2cc]
- Updated dependencies [8c846b6]
- Updated dependencies [b790fd1]
- Updated dependencies [d7ed04d]
- Updated dependencies [f36e4f1]
  - @mastra/memory@0.11.2-alpha.0
  - @mastra/core@0.10.11-alpha.0

## 0.0.31

### Patch Changes

- Updated dependencies [4d3fbdf]
  - @mastra/core@0.10.10

## 0.0.31-alpha.1

### Patch Changes

- @mastra/core@0.10.10-alpha.1

## 0.0.31-alpha.0

### Patch Changes

- Updated dependencies [4d3fbdf]
  - @mastra/core@0.10.10-alpha.0

## 0.0.30

### Patch Changes

- Updated dependencies [9dda1ac]
- Updated dependencies [c984582]
- Updated dependencies [7e801dd]
- Updated dependencies [a606c75]
- Updated dependencies [7aa70a4]
- Updated dependencies [764f86a]
- Updated dependencies [1760a1c]
- Updated dependencies [038e5ae]
- Updated dependencies [7dda16a]
- Updated dependencies [5ebfcdd]
- Updated dependencies [81a1b3b]
- Updated dependencies [b2d0c91]
- Updated dependencies [4e809ad]
- Updated dependencies [57929df]
- Updated dependencies [b7852ed]
- Updated dependencies [6320a61]
  - @mastra/core@0.10.9
  - @mastra/memory@0.11.1

## 0.0.30-alpha.0

### Patch Changes

- Updated dependencies [9dda1ac]
- Updated dependencies [c984582]
- Updated dependencies [7e801dd]
- Updated dependencies [a606c75]
- Updated dependencies [7aa70a4]
- Updated dependencies [764f86a]
- Updated dependencies [1760a1c]
- Updated dependencies [038e5ae]
- Updated dependencies [7dda16a]
- Updated dependencies [5ebfcdd]
- Updated dependencies [81a1b3b]
- Updated dependencies [b2d0c91]
- Updated dependencies [4e809ad]
- Updated dependencies [57929df]
- Updated dependencies [b7852ed]
- Updated dependencies [6320a61]
  - @mastra/core@0.10.9-alpha.0
  - @mastra/memory@0.11.1-alpha.0

## 0.0.29

### Patch Changes

- Updated dependencies [b8f16b2]
- Updated dependencies [3e04487]
- Updated dependencies [a344ac7]
- Updated dependencies [dc4ca0a]
  - @mastra/core@0.10.8

## 0.0.29-alpha.1

### Patch Changes

- Updated dependencies [b8f16b2]
- Updated dependencies [3e04487]
- Updated dependencies [dc4ca0a]
  - @mastra/core@0.10.8-alpha.1

## 0.0.29-alpha.0

### Patch Changes

- Updated dependencies [a344ac7]
  - @mastra/core@0.10.8-alpha.0

## 0.0.28

### Patch Changes

- 8e1b6e9: dependencies updates:
  - Updated dependency [`zod@^3.25.67` ↗︎](https://www.npmjs.com/package/zod/v/3.25.67) (from `^3.25.56`, in `dependencies`)
- Updated dependencies [8e1b6e9]
- Updated dependencies [ee93d96]
- Updated dependencies [c00039d]
- Updated dependencies [8e1b6e9]
- Updated dependencies [8e1b6e9]
- Updated dependencies [15e9d26]
- Updated dependencies [d1baedb]
- Updated dependencies [d8f2d19]
- Updated dependencies [a85fa13]
- Updated dependencies [4d21bf2]
- Updated dependencies [0fb9d64]
- Updated dependencies [07d6d88]
- Updated dependencies [9d52b17]
- Updated dependencies [2097952]
- Updated dependencies [792c4c0]
- Updated dependencies [5d74aab]
- Updated dependencies [8a3bfd2]
- Updated dependencies [a8b194f]
- Updated dependencies [4fb0cc2]
- Updated dependencies [d2a7a31]
- Updated dependencies [502fe05]
- Updated dependencies [144eb0b]
- Updated dependencies [f0150c4]
- Updated dependencies [8ba1b51]
- Updated dependencies [4efcfa0]
- Updated dependencies [0e17048]
- Updated dependencies [dc93062]
  - @mastra/github@1.2.4
  - @mastra/mcp@0.10.5
  - @mastra/memory@0.11.0
  - @mastra/rag@1.0.1
  - @mastra/upstash@0.12.0
  - @mastra/core@0.10.7
  - @mastra/libsql@0.11.0

## 0.0.28-alpha.5

### Patch Changes

- @mastra/core@0.10.7-alpha.5

## 0.0.28-alpha.4

### Patch Changes

- Updated dependencies [a8b194f]
- Updated dependencies [dc93062]
  - @mastra/memory@0.11.0-alpha.3
  - @mastra/core@0.10.7-alpha.4
  - @mastra/mcp@0.10.5-alpha.2

## 0.0.28-alpha.3

### Patch Changes

- Updated dependencies [792c4c0]
- Updated dependencies [8a3bfd2]
- Updated dependencies [502fe05]
- Updated dependencies [4efcfa0]
  - @mastra/core@0.10.7-alpha.3
  - @mastra/memory@0.11.0-alpha.2
  - @mastra/upstash@0.12.0-alpha.3
  - @mastra/libsql@0.11.0-alpha.3

## 0.0.28-alpha.2

### Patch Changes

- 8e1b6e9: dependencies updates:
  - Updated dependency [`zod@^3.25.67` ↗︎](https://www.npmjs.com/package/zod/v/3.25.67) (from `^3.25.56`, in `dependencies`)
- Updated dependencies [8e1b6e9]
- Updated dependencies [ee93d96]
- Updated dependencies [c00039d]
- Updated dependencies [8e1b6e9]
- Updated dependencies [8e1b6e9]
- Updated dependencies [15e9d26]
- Updated dependencies [a85fa13]
- Updated dependencies [0fb9d64]
- Updated dependencies [07d6d88]
- Updated dependencies [5d74aab]
- Updated dependencies [144eb0b]
- Updated dependencies [f0150c4]
  - @mastra/github@1.2.4-alpha.0
  - @mastra/mcp@0.10.5-alpha.1
  - @mastra/memory@0.10.5-alpha.1
  - @mastra/rag@1.0.1-alpha.0
  - @mastra/upstash@0.11.1-alpha.2
  - @mastra/core@0.10.7-alpha.2
  - @mastra/libsql@0.10.4-alpha.2

## 0.0.28-alpha.1

### Patch Changes

- Updated dependencies [d1baedb]
- Updated dependencies [4d21bf2]
- Updated dependencies [2097952]
- Updated dependencies [4fb0cc2]
- Updated dependencies [d2a7a31]
- Updated dependencies [0e17048]
  - @mastra/core@0.10.7-alpha.1
  - @mastra/mcp@0.10.5-alpha.0
  - @mastra/libsql@0.10.4-alpha.1
  - @mastra/upstash@0.11.1-alpha.1

## 0.0.28-alpha.0

### Patch Changes

- Updated dependencies [d8f2d19]
- Updated dependencies [9d52b17]
- Updated dependencies [8ba1b51]
  - @mastra/memory@0.10.5-alpha.0
  - @mastra/upstash@0.11.1-alpha.0
  - @mastra/core@0.10.7-alpha.0
  - @mastra/libsql@0.10.4-alpha.0

## 0.0.27

### Patch Changes

- 4051477: dependencies updates:
  - Updated dependency [`@ai-sdk/anthropic@^1.2.12` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/1.2.12) (from `^1.2.11`, in `dependencies`)
- 42ec363: dependencies updates:
  - Updated dependency [`@ai-sdk/anthropic@^1.2.12` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/1.2.12) (from `^1.2.11`, in `dependencies`)
- Updated dependencies [63f6b7d]
- Updated dependencies [63f6b7d]
- Updated dependencies [63f6b7d]
- Updated dependencies [63f6b7d]
- Updated dependencies [4051477]
- Updated dependencies [63f6b7d]
- Updated dependencies [63f6b7d]
- Updated dependencies [12a95fc]
- Updated dependencies [4b0f8a6]
- Updated dependencies [51264a5]
- Updated dependencies [8e6f677]
- Updated dependencies [d70c420]
- Updated dependencies [ee9af57]
- Updated dependencies [36f1c36]
- Updated dependencies [2a16996]
- Updated dependencies [2fda031]
- Updated dependencies [10d352e]
- Updated dependencies [9589624]
- Updated dependencies [bd1674f]
- Updated dependencies [69f76f7]
- Updated dependencies [53d3c37]
- Updated dependencies [704d1ca]
- Updated dependencies [751c894]
- Updated dependencies [75136cd]
- Updated dependencies [577ce3a]
- Updated dependencies [9260b3a]
- Updated dependencies [e8fdbdd]
  - @mastra/core@0.10.6
  - @mastra/github@1.2.3
  - @mastra/libsql@0.10.3
  - @mastra/mcp@0.10.4
  - @mastra/memory@0.10.4
  - @mastra/rag@1.0.0
  - @mastra/upstash@0.11.0

## 0.0.27-alpha.7

### Patch Changes

- Updated dependencies [bd1674f]
- Updated dependencies [69f76f7]
  - @mastra/mcp@0.10.4-alpha.1

## 0.0.27-alpha.6

### Patch Changes

- Updated dependencies [12a95fc]
- Updated dependencies [51264a5]
- Updated dependencies [8e6f677]
  - @mastra/core@0.10.6-alpha.5

## 0.0.27-alpha.5

### Patch Changes

- Updated dependencies [9589624]
- Updated dependencies [e8fdbdd]
  - @mastra/core@0.10.6-alpha.4
  - @mastra/upstash@0.11.0-alpha.2

## 0.0.27-alpha.4

### Patch Changes

- 4051477: dependencies updates:
  - Updated dependency [`@ai-sdk/anthropic@^1.2.12` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/1.2.12) (from `^1.2.11`, in `dependencies`)
- Updated dependencies [4051477]
- Updated dependencies [d70c420]
- Updated dependencies [2a16996]
  - @mastra/memory@0.10.4-alpha.1
  - @mastra/core@0.10.6-alpha.3

## 0.0.27-alpha.3

### Patch Changes

- 42ec363: dependencies updates:
  - Updated dependency [`@ai-sdk/anthropic@^1.2.12` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/1.2.12) (from `^1.2.11`, in `dependencies`)
- Updated dependencies [4b0f8a6]
  - @mastra/core@0.10.6-alpha.2

## 0.0.27-alpha.2

### Patch Changes

- Updated dependencies [ee9af57]
- Updated dependencies [2fda031]
- Updated dependencies [751c894]
- Updated dependencies [577ce3a]
- Updated dependencies [9260b3a]
  - @mastra/core@0.10.6-alpha.1
  - @mastra/upstash@0.11.0-alpha.1

## 0.0.27-alpha.1

### Patch Changes

- Updated dependencies [704d1ca]
  - @mastra/upstash@0.11.0-alpha.0

## 0.0.27-alpha.0

### Patch Changes

- Updated dependencies [63f6b7d]
- Updated dependencies [63f6b7d]
- Updated dependencies [63f6b7d]
- Updated dependencies [63f6b7d]
- Updated dependencies [63f6b7d]
- Updated dependencies [63f6b7d]
- Updated dependencies [36f1c36]
- Updated dependencies [10d352e]
- Updated dependencies [53d3c37]
- Updated dependencies [75136cd]
  - @mastra/core@0.10.6-alpha.0
  - @mastra/github@1.2.3-alpha.0
  - @mastra/libsql@0.10.3-alpha.0
  - @mastra/mcp@0.10.4-alpha.0
  - @mastra/memory@0.10.4-alpha.0
  - @mastra/rag@1.0.0-alpha.0

## 0.0.26

### Patch Changes

- Updated dependencies [13c97f9]
  - @mastra/core@0.10.5

## 0.0.25

### Patch Changes

- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- Updated dependencies [d1ed912]
- Updated dependencies [1ccccff]
- Updated dependencies [1ccccff]
- Updated dependencies [5d3dc1e]
- Updated dependencies [1ccccff]
- Updated dependencies [1ccccff]
- Updated dependencies [71999e9]
- Updated dependencies [1ccccff]
- Updated dependencies [1ccccff]
- Updated dependencies [1a35518]
- Updated dependencies [f6fd25f]
- Updated dependencies [dffb67b]
- Updated dependencies [f1f1f1b]
- Updated dependencies [925ab94]
- Updated dependencies [f9816ae]
- Updated dependencies [82090c1]
- Updated dependencies [1b443fd]
- Updated dependencies [ce97900]
- Updated dependencies [fc579cd]
- Updated dependencies [e0f9201]
- Updated dependencies [f1309d3]
- Updated dependencies [14a2566]
- Updated dependencies [f7f8293]
- Updated dependencies [a382d3b]
- Updated dependencies [48eddb9]
- Updated dependencies [66f4424]
- Updated dependencies [a914da2]
  - @mastra/core@0.10.4
  - @mastra/github@1.2.2
  - @mastra/libsql@0.10.2
  - @mastra/memory@0.10.3
  - @mastra/rag@0.10.3
  - @mastra/upstash@0.10.3
  - @mastra/mcp@0.10.3

## 0.0.25-alpha.4

### Patch Changes

- Updated dependencies [66f4424]
  - @mastra/memory@0.10.3-alpha.2
  - @mastra/upstash@0.10.3-alpha.4
  - @mastra/libsql@0.10.2-alpha.4

## 0.0.25-alpha.3

### Patch Changes

- Updated dependencies [925ab94]
- Updated dependencies [e0f9201]
- Updated dependencies [a914da2]
  - @mastra/core@0.10.4-alpha.3
  - @mastra/upstash@0.10.3-alpha.3
  - @mastra/libsql@0.10.2-alpha.3

## 0.0.25-alpha.2

### Patch Changes

- Updated dependencies [48eddb9]
  - @mastra/core@0.10.4-alpha.2
  - @mastra/memory@0.10.3-alpha.1
  - @mastra/libsql@0.10.2-alpha.2
  - @mastra/upstash@0.10.3-alpha.2

## 0.0.25-alpha.1

### Patch Changes

- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- Updated dependencies [1ccccff]
- Updated dependencies [1ccccff]
- Updated dependencies [1ccccff]
- Updated dependencies [1ccccff]
- Updated dependencies [1ccccff]
- Updated dependencies [1ccccff]
- Updated dependencies [f6fd25f]
- Updated dependencies [dffb67b]
- Updated dependencies [fc579cd]
- Updated dependencies [f1309d3]
- Updated dependencies [f7f8293]
- Updated dependencies [a382d3b]
  - @mastra/github@1.2.2-alpha.0
  - @mastra/memory@0.10.3-alpha.0
  - @mastra/rag@0.10.3-alpha.1
  - @mastra/core@0.10.4-alpha.1
  - @mastra/libsql@0.10.2-alpha.1
  - @mastra/upstash@0.10.3-alpha.1
  - @mastra/mcp@0.10.3-alpha.0

## 0.0.25-alpha.0

### Patch Changes

- Updated dependencies [d1ed912]
- Updated dependencies [5d3dc1e]
- Updated dependencies [71999e9]
- Updated dependencies [1a35518]
- Updated dependencies [f1f1f1b]
- Updated dependencies [f9816ae]
- Updated dependencies [82090c1]
- Updated dependencies [1b443fd]
- Updated dependencies [ce97900]
- Updated dependencies [14a2566]
  - @mastra/core@0.10.4-alpha.0
  - @mastra/libsql@0.10.2-alpha.0
  - @mastra/rag@0.10.3-alpha.0
  - @mastra/upstash@0.10.3-alpha.0

## 0.0.24

### Patch Changes

- Updated dependencies [2b0fc7e]
  - @mastra/core@0.10.3

## 0.0.24-alpha.0

### Patch Changes

- Updated dependencies [2b0fc7e]
  - @mastra/core@0.10.3-alpha.0

## 0.0.23

### Patch Changes

- Updated dependencies [ee77e78]
- Updated dependencies [592a2db]
- Updated dependencies [e5dc18d]
- Updated dependencies [ab5adbe]
- Updated dependencies [1e8bb40]
- Updated dependencies [a60d630]
- Updated dependencies [1b5fc55]
- Updated dependencies [a3f1b39]
- Updated dependencies [195c428]
- Updated dependencies [f73e11b]
- Updated dependencies [37643b8]
- Updated dependencies [99fd6cf]
- Updated dependencies [9e37877]
- Updated dependencies [c5bf1ce]
- Updated dependencies [add596e]
- Updated dependencies [8dc94d8]
- Updated dependencies [ecebbeb]
- Updated dependencies [4b23936]
- Updated dependencies [79d5145]
- Updated dependencies [12b7002]
- Updated dependencies [f0d559f]
- Updated dependencies [2901125]
  - @mastra/core@0.10.2
  - @mastra/mcp@0.10.2
  - @mastra/memory@0.10.2
  - @mastra/upstash@0.10.2
  - @mastra/libsql@0.10.1
  - @mastra/rag@0.10.2
  - @mastra/github@1.2.1

## 0.0.23-alpha.10

### Patch Changes

- Updated dependencies [37643b8]
- Updated dependencies [79d5145]
  - @mastra/core@0.10.2-alpha.8

## 0.0.23-alpha.9

### Patch Changes

- @mastra/core@0.10.2-alpha.7

## 0.0.23-alpha.8

### Patch Changes

- Updated dependencies [a3f1b39]
  - @mastra/libsql@0.10.1-alpha.3

## 0.0.23-alpha.7

### Patch Changes

- Updated dependencies [99fd6cf]
- Updated dependencies [8dc94d8]
  - @mastra/core@0.10.2-alpha.6

## 0.0.23-alpha.6

### Patch Changes

- Updated dependencies [a60d630]
- Updated dependencies [1b5fc55]
- Updated dependencies [add596e]
- Updated dependencies [ecebbeb]
  - @mastra/rag@0.10.2-alpha.1
  - @mastra/core@0.10.2-alpha.5

## 0.0.23-alpha.5

### Patch Changes

- Updated dependencies [4b23936]
  - @mastra/github@1.2.1-alpha.1

## 0.0.23-alpha.4

### Patch Changes

- Updated dependencies [c5bf1ce]
- Updated dependencies [12b7002]
  - @mastra/memory@0.10.2-alpha.2
  - @mastra/upstash@0.10.2-alpha.2
  - @mastra/core@0.10.2-alpha.4
  - @mastra/libsql@0.10.1-alpha.2

## 0.0.23-alpha.3

### Patch Changes

- Updated dependencies [ab5adbe]
- Updated dependencies [195c428]
- Updated dependencies [f73e11b]
  - @mastra/core@0.10.2-alpha.3

## 0.0.23-alpha.2

### Patch Changes

- Updated dependencies [1e8bb40]
- Updated dependencies [f0d559f]
  - @mastra/core@0.10.2-alpha.2
  - @mastra/github@1.2.1-alpha.0
  - @mastra/memory@0.10.2-alpha.1
  - @mastra/upstash@0.10.2-alpha.1
  - @mastra/libsql@0.10.1-alpha.1
  - @mastra/mcp@0.10.2-alpha.1
  - @mastra/rag@0.10.2-alpha.0

## 0.0.23-alpha.1

### Patch Changes

- Updated dependencies [ee77e78]
- Updated dependencies [2901125]
  - @mastra/core@0.10.2-alpha.1

## 0.0.23-alpha.0

### Patch Changes

- Updated dependencies [592a2db]
- Updated dependencies [e5dc18d]
- Updated dependencies [9e37877]
  - @mastra/core@0.10.2-alpha.0
  - @mastra/mcp@0.10.2-alpha.0
  - @mastra/memory@0.10.2-alpha.0
  - @mastra/upstash@0.10.2-alpha.0
  - @mastra/libsql@0.10.1-alpha.0

## 0.0.22

### Patch Changes

- Updated dependencies [d70b807]
- Updated dependencies [6d16390]
- Updated dependencies [1e4a421]
- Updated dependencies [e60402a]
- Updated dependencies [ab89d6a]
- Updated dependencies [200d0da]
- Updated dependencies [bf5f17b]
- Updated dependencies [5343f93]
- Updated dependencies [38aee50]
- Updated dependencies [8784cef]
- Updated dependencies [5c41100]
- Updated dependencies [d6a759b]
- Updated dependencies [f56fd29]
- Updated dependencies [6015bdf]
  - @mastra/memory@0.10.1
  - @mastra/core@0.10.1
  - @mastra/upstash@0.10.1
  - @mastra/mcp@0.10.1
  - @mastra/rag@0.10.1

## 0.0.22-alpha.4

### Patch Changes

- Updated dependencies [d70b807]
  - @mastra/memory@0.10.1-alpha.0
  - @mastra/core@0.10.1-alpha.3

## 0.0.22-alpha.3

### Patch Changes

- Updated dependencies [6015bdf]
  - @mastra/core@0.10.1-alpha.2

## 0.0.22-alpha.2

### Patch Changes

- Updated dependencies [ab89d6a]
- Updated dependencies [200d0da]
- Updated dependencies [bf5f17b]
- Updated dependencies [5343f93]
- Updated dependencies [38aee50]
- Updated dependencies [5c41100]
- Updated dependencies [d6a759b]
  - @mastra/mcp@0.10.1-alpha.0
  - @mastra/core@0.10.1-alpha.1

## 0.0.22-alpha.1

### Patch Changes

- Updated dependencies [f56fd29]
  - @mastra/rag@0.10.1-alpha.1

## 0.0.22-alpha.0

### Patch Changes

- Updated dependencies [6d16390]
- Updated dependencies [1e4a421]
- Updated dependencies [e60402a]
- Updated dependencies [8784cef]
  - @mastra/core@0.10.1-alpha.0
  - @mastra/upstash@0.10.1-alpha.0
  - @mastra/rag@0.10.1-alpha.0

## 0.0.21

### Patch Changes

- Updated dependencies [b3a3d63]
- Updated dependencies [344f453]
- Updated dependencies [3cd7aee]
- Updated dependencies [0a3ae6d]
- Updated dependencies [95911be]
- Updated dependencies [4424836]
- Updated dependencies [83da932]
- Updated dependencies [f53a6ac]
- Updated dependencies [8cdd799]
- Updated dependencies [5eb5a99]
- Updated dependencies [7e632c5]
- Updated dependencies [1e9fbfa]
- Updated dependencies [eabdcd9]
- Updated dependencies [90be034]
- Updated dependencies [99f050a]
- Updated dependencies [d0ee3c6]
- Updated dependencies [b2ae5aa]
- Updated dependencies [23f258c]
- Updated dependencies [a7292b0]
- Updated dependencies [4f62987]
- Updated dependencies [0dcb9f0]
- Updated dependencies [2672a05]
  - @mastra/core@0.10.0
  - @mastra/memory@0.10.0
  - @mastra/mcp@0.10.0
  - @mastra/rag@0.10.0
  - @mastra/github@1.2.0
  - @mastra/upstash@0.10.0
  - @mastra/libsql@0.10.0

## 0.0.21-alpha.1

### Patch Changes

- Updated dependencies [b3a3d63]
- Updated dependencies [344f453]
- Updated dependencies [0a3ae6d]
- Updated dependencies [95911be]
- Updated dependencies [4424836]
- Updated dependencies [83da932]
- Updated dependencies [8cdd799]
- Updated dependencies [5eb5a99]
- Updated dependencies [7e632c5]
- Updated dependencies [1e9fbfa]
- Updated dependencies [b2ae5aa]
- Updated dependencies [a7292b0]
- Updated dependencies [4f62987]
- Updated dependencies [0dcb9f0]
  - @mastra/core@0.10.0-alpha.1
  - @mastra/mcp@0.6.0-alpha.1
  - @mastra/rag@0.2.0-alpha.1
  - @mastra/github@1.2.0-alpha.1
  - @mastra/memory@0.4.0-alpha.1
  - @mastra/upstash@0.4.0-alpha.1
  - @mastra/libsql@0.1.0-alpha.1

## 0.0.21-alpha.0

### Patch Changes

- Updated dependencies [3cd7aee]
- Updated dependencies [f53a6ac]
- Updated dependencies [eabdcd9]
- Updated dependencies [90be034]
- Updated dependencies [99f050a]
- Updated dependencies [d0ee3c6]
- Updated dependencies [23f258c]
- Updated dependencies [2672a05]
  - @mastra/memory@0.3.5-alpha.0
  - @mastra/core@0.9.5-alpha.0
  - @mastra/libsql@0.0.5-alpha.0
  - @mastra/upstash@0.3.5-alpha.0
  - @mastra/mcp@0.5.1-alpha.0
  - @mastra/github@1.1.24-alpha.0
  - @mastra/rag@0.1.24-alpha.0

## 0.0.20

### Patch Changes

- 48b8c2c: dependencies updates:
  - Updated dependency [`@ai-sdk/anthropic@^1.2.10` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/1.2.10) (from `^1.1.15`, in `dependencies`)
- 981308f: dependencies updates:
  - Updated dependency [`@ai-sdk/anthropic@^1.2.11` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/1.2.11) (from `^1.2.10`, in `dependencies`)
- Updated dependencies [8baa6c8]
- Updated dependencies [396be50]
- Updated dependencies [ab80e7e]
- Updated dependencies [e229660]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [bb1e2c8]
- Updated dependencies [a5810ce]
- Updated dependencies [3e9c131]
- Updated dependencies [3171b5b]
- Updated dependencies [973e5ac]
- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
- Updated dependencies [9e1eff5]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/mcp@0.5.0
  - @mastra/core@0.9.4
  - @mastra/upstash@0.3.4
  - @mastra/libsql@0.0.4
  - @mastra/github@1.1.23
  - @mastra/memory@0.3.4
  - @mastra/rag@0.1.23

## 0.0.20-alpha.6

### Patch Changes

- Updated dependencies [3e9c131]
  - @mastra/core@0.9.4-alpha.4
  - @mastra/github@1.1.23-alpha.4
  - @mastra/mcp@0.5.0-alpha.6
  - @mastra/memory@0.3.4-alpha.4
  - @mastra/rag@0.1.23-alpha.4
  - @mastra/libsql@0.0.4-alpha.4
  - @mastra/upstash@0.3.4-alpha.4

## 0.0.20-alpha.5

### Patch Changes

- Updated dependencies [8baa6c8]
  - @mastra/mcp@0.5.0-alpha.5

## 0.0.20-alpha.4

### Patch Changes

- Updated dependencies [396be50]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [a5810ce]
  - @mastra/core@0.9.4-alpha.3
  - @mastra/mcp@0.5.0-alpha.4
  - @mastra/upstash@0.3.4-alpha.3
  - @mastra/libsql@0.0.4-alpha.3
  - @mastra/github@1.1.23-alpha.3
  - @mastra/memory@0.3.4-alpha.3
  - @mastra/rag@0.1.23-alpha.3

## 0.0.20-alpha.3

### Patch Changes

- Updated dependencies [bb1e2c8]
  - @mastra/mcp@0.5.0-alpha.3

## 0.0.20-alpha.2

### Patch Changes

- Updated dependencies [3171b5b]
- Updated dependencies [973e5ac]
- Updated dependencies [9e1eff5]
  - @mastra/core@0.9.4-alpha.2
  - @mastra/github@1.1.23-alpha.2
  - @mastra/mcp@0.5.0-alpha.2
  - @mastra/memory@0.3.4-alpha.2
  - @mastra/rag@0.1.23-alpha.2
  - @mastra/libsql@0.0.4-alpha.2
  - @mastra/upstash@0.3.4-alpha.2

## 0.0.20-alpha.1

### Patch Changes

- Updated dependencies [ab80e7e]
- Updated dependencies [e229660]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/core@0.9.4-alpha.1
  - @mastra/mcp@0.5.0-alpha.1
  - @mastra/github@1.1.23-alpha.1
  - @mastra/memory@0.3.4-alpha.1
  - @mastra/rag@0.1.23-alpha.1
  - @mastra/libsql@0.0.4-alpha.1
  - @mastra/upstash@0.3.4-alpha.1

## 0.0.20-alpha.0

### Patch Changes

- 48b8c2c: dependencies updates:
  - Updated dependency [`@ai-sdk/anthropic@^1.2.10` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/1.2.10) (from `^1.1.15`, in `dependencies`)
- 981308f: dependencies updates:
  - Updated dependency [`@ai-sdk/anthropic@^1.2.11` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/1.2.11) (from `^1.2.10`, in `dependencies`)
- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
  - @mastra/core@0.9.4-alpha.0
  - @mastra/github@1.1.23-alpha.0
  - @mastra/mcp@0.4.4-alpha.0
  - @mastra/memory@0.3.4-alpha.0
  - @mastra/rag@0.1.23-alpha.0
  - @mastra/libsql@0.0.4-alpha.0
  - @mastra/upstash@0.3.4-alpha.0

## 0.0.19

### Patch Changes

- Updated dependencies [e450778]
- Updated dependencies [8902157]
- Updated dependencies [ca0dc88]
- Updated dependencies [526c570]
- Updated dependencies [d7a6a33]
- Updated dependencies [9cd1a46]
- Updated dependencies [b5d2de0]
- Updated dependencies [644f8ad]
- Updated dependencies [70dbf51]
  - @mastra/core@0.9.3
  - @mastra/github@1.1.22
  - @mastra/mcp@0.4.3
  - @mastra/memory@0.3.3
  - @mastra/rag@0.1.22
  - @mastra/libsql@0.0.3
  - @mastra/upstash@0.3.3

## 0.0.19-alpha.1

### Patch Changes

- Updated dependencies [e450778]
- Updated dependencies [8902157]
- Updated dependencies [ca0dc88]
- Updated dependencies [9cd1a46]
- Updated dependencies [70dbf51]
  - @mastra/core@0.9.3-alpha.1
  - @mastra/github@1.1.22-alpha.1
  - @mastra/mcp@0.4.3-alpha.1
  - @mastra/memory@0.3.3-alpha.1
  - @mastra/rag@0.1.22-alpha.1
  - @mastra/libsql@0.0.3-alpha.1
  - @mastra/upstash@0.3.3-alpha.1

## 0.0.19-alpha.0

### Patch Changes

- Updated dependencies [526c570]
- Updated dependencies [b5d2de0]
- Updated dependencies [644f8ad]
  - @mastra/core@0.9.3-alpha.0
  - @mastra/github@1.1.22-alpha.0
  - @mastra/mcp@0.4.3-alpha.0
  - @mastra/memory@0.3.3-alpha.0
  - @mastra/rag@0.1.22-alpha.0
  - @mastra/libsql@0.0.3-alpha.0
  - @mastra/upstash@0.3.3-alpha.0

## 0.0.18

### Patch Changes

- 2cf3b8f: dependencies updates:
  - Updated dependency [`zod@^3.24.3` ↗︎](https://www.npmjs.com/package/zod/v/3.24.3) (from `^3.24.2`, in `dependencies`)
- Updated dependencies [2cf3b8f]
- Updated dependencies [2cf3b8f]
- Updated dependencies [2cf3b8f]
- Updated dependencies [6052aa6]
- Updated dependencies [967b41c]
- Updated dependencies [3d2fb5c]
- Updated dependencies [67e14dd]
- Updated dependencies [544767d]
- Updated dependencies [26738f4]
- Updated dependencies [4155f47]
- Updated dependencies [7eeb2bc]
- Updated dependencies [b804723]
- Updated dependencies [8bb9b4d]
- Updated dependencies [8607972]
- Updated dependencies [ccef9f9]
- Updated dependencies [0097d50]
- Updated dependencies [7eeb2bc]
- Updated dependencies [17826a9]
- Updated dependencies [7d8b7c7]
- Updated dependencies [fba031f]
- Updated dependencies [3a5f1e1]
- Updated dependencies [51e6923]
- Updated dependencies [8398d89]
  - @mastra/github@1.1.21
  - @mastra/memory@0.3.2
  - @mastra/rag@0.1.21
  - @mastra/core@0.9.2
  - @mastra/mcp@0.4.2
  - @mastra/upstash@0.3.2
  - @mastra/libsql@0.0.2

## 0.0.18-alpha.7

### Patch Changes

- Updated dependencies [6052aa6]
- Updated dependencies [67e14dd]
- Updated dependencies [7d8b7c7]
- Updated dependencies [3a5f1e1]
- Updated dependencies [8398d89]
  - @mastra/core@0.9.2-alpha.6
  - @mastra/memory@0.3.2-alpha.7
  - @mastra/github@1.1.21-alpha.6
  - @mastra/mcp@0.4.2-alpha.6
  - @mastra/rag@0.1.21-alpha.6
  - @mastra/libsql@0.0.2-alpha.6
  - @mastra/upstash@0.3.2-alpha.6

## 0.0.18-alpha.6

### Patch Changes

- Updated dependencies [544767d]
  - @mastra/memory@0.3.2-alpha.6

## 0.0.18-alpha.5

### Patch Changes

- Updated dependencies [3d2fb5c]
- Updated dependencies [7eeb2bc]
- Updated dependencies [8607972]
- Updated dependencies [7eeb2bc]
- Updated dependencies [fba031f]
  - @mastra/core@0.9.2-alpha.5
  - @mastra/github@1.1.21-alpha.5
  - @mastra/mcp@0.4.2-alpha.5
  - @mastra/memory@0.3.2-alpha.5
  - @mastra/rag@0.1.21-alpha.5
  - @mastra/libsql@0.0.2-alpha.5
  - @mastra/upstash@0.3.2-alpha.5

## 0.0.18-alpha.4

### Patch Changes

- Updated dependencies [ccef9f9]
- Updated dependencies [51e6923]
  - @mastra/core@0.9.2-alpha.4
  - @mastra/github@1.1.21-alpha.4
  - @mastra/mcp@0.4.2-alpha.4
  - @mastra/memory@0.3.2-alpha.4
  - @mastra/rag@0.1.21-alpha.4
  - @mastra/libsql@0.0.2-alpha.4
  - @mastra/upstash@0.3.2-alpha.4

## 0.0.18-alpha.3

### Patch Changes

- Updated dependencies [967b41c]
- Updated dependencies [4155f47]
- Updated dependencies [17826a9]
  - @mastra/core@0.9.2-alpha.3
  - @mastra/upstash@0.3.2-alpha.3
  - @mastra/libsql@0.0.2-alpha.3
  - @mastra/memory@0.3.2-alpha.3
  - @mastra/github@1.1.21-alpha.3
  - @mastra/mcp@0.4.2-alpha.3
  - @mastra/rag@0.1.21-alpha.3

## 0.0.18-alpha.2

### Patch Changes

- Updated dependencies [26738f4]
  - @mastra/core@0.9.2-alpha.2
  - @mastra/mcp@0.4.2-alpha.2
  - @mastra/github@1.1.21-alpha.2
  - @mastra/memory@0.3.2-alpha.2
  - @mastra/rag@0.1.21-alpha.2
  - @mastra/libsql@0.0.2-alpha.2
  - @mastra/upstash@0.3.2-alpha.2

## 0.0.18-alpha.1

### Patch Changes

- Updated dependencies [b804723]
- Updated dependencies [8bb9b4d]
  - @mastra/core@0.9.2-alpha.1
  - @mastra/mcp@0.4.2-alpha.1
  - @mastra/github@1.1.21-alpha.1
  - @mastra/memory@0.3.2-alpha.1
  - @mastra/rag@0.1.21-alpha.1
  - @mastra/libsql@0.0.2-alpha.1
  - @mastra/upstash@0.3.2-alpha.1

## 0.0.18-alpha.0

### Patch Changes

- Updated dependencies [0097d50]
  - @mastra/core@0.9.2-alpha.0
  - @mastra/github@1.1.21-alpha.0
  - @mastra/mcp@0.4.2-alpha.0
  - @mastra/memory@0.3.2-alpha.0
  - @mastra/rag@0.1.21-alpha.0
  - @mastra/libsql@0.0.2-alpha.0
  - @mastra/upstash@0.3.2-alpha.0

## 0.0.17

### Patch Changes

- 2526527: We are deprecating the MastraMCPClient class in favour of using MCPClient (formerly MCPConfiguration). MCPClient can handle 1+ MCP servers, whereas MastraMCPClient can only handle a single MCP server. Rather than having two different interfaces to use when using a single MCP vs multiple, we opted to nudge people towards using the interface that is more flexible.
- 35d5538: Fix dane
- Updated dependencies [6278b62]
- Updated dependencies [8fb46d6]
- Updated dependencies [2526527]
- Updated dependencies [405b63d]
- Updated dependencies [81fb7f6]
- Updated dependencies [20275d4]
- Updated dependencies [7d1892c]
- Updated dependencies [a90a082]
- Updated dependencies [2d17c73]
- Updated dependencies [61e92f5]
- Updated dependencies [35955b0]
- Updated dependencies [6262bd5]
- Updated dependencies [c1409ef]
- Updated dependencies [3e7b69d]
- Updated dependencies [e4943b8]
- Updated dependencies [11d4485]
- Updated dependencies [479f490]
- Updated dependencies [5f826d9]
- Updated dependencies [ba1f4f3]
- Updated dependencies [c23a81c]
- Updated dependencies [db1d220]
- Updated dependencies [a2ccb71]
- Updated dependencies [c4c6f04]
- Updated dependencies [2d4001d]
- Updated dependencies [c71013a]
- Updated dependencies [1d3b1cd]
  - @mastra/rag@0.1.20
  - @mastra/mcp@0.4.1
  - @mastra/core@0.9.1
  - @mastra/memory@0.3.1
  - @mastra/libsql@0.0.1
  - @mastra/upstash@0.3.1
  - @mastra/github@1.1.20

## 0.0.17-alpha.9

### Patch Changes

- Updated dependencies [2d17c73]
  - @mastra/core@0.9.1-alpha.8
  - @mastra/github@1.1.20-alpha.8
  - @mastra/mcp@0.4.1-alpha.9
  - @mastra/memory@0.3.1-alpha.8
  - @mastra/rag@0.1.20-alpha.8
  - @mastra/libsql@0.0.1-alpha.8
  - @mastra/upstash@0.3.1-alpha.8

## 0.0.17-alpha.8

### Patch Changes

- Updated dependencies [1d3b1cd]
  - @mastra/core@0.9.1-alpha.7
  - @mastra/github@1.1.20-alpha.7
  - @mastra/mcp@0.4.1-alpha.8
  - @mastra/memory@0.3.1-alpha.7
  - @mastra/rag@0.1.20-alpha.7
  - @mastra/libsql@0.0.1-alpha.7
  - @mastra/upstash@0.3.1-alpha.7

## 0.0.17-alpha.7

### Patch Changes

- Updated dependencies [c23a81c]
  - @mastra/core@0.9.1-alpha.6
  - @mastra/github@1.1.20-alpha.6
  - @mastra/mcp@0.4.1-alpha.7
  - @mastra/memory@0.3.1-alpha.6
  - @mastra/rag@0.1.20-alpha.6
  - @mastra/libsql@0.0.1-alpha.6
  - @mastra/upstash@0.3.1-alpha.6

## 0.0.17-alpha.6

### Patch Changes

- Updated dependencies [3e7b69d]
- Updated dependencies [5f826d9]
  - @mastra/core@0.9.1-alpha.5
  - @mastra/upstash@0.3.1-alpha.5
  - @mastra/libsql@0.0.1-alpha.5
  - @mastra/rag@0.1.20-alpha.5
  - @mastra/github@1.1.20-alpha.5
  - @mastra/mcp@0.4.1-alpha.6
  - @mastra/memory@0.3.1-alpha.5

## 0.0.17-alpha.5

### Patch Changes

- Updated dependencies [e4943b8]
- Updated dependencies [479f490]
  - @mastra/core@0.9.1-alpha.4
  - @mastra/libsql@0.0.1-alpha.4
  - @mastra/upstash@0.3.1-alpha.4
  - @mastra/github@1.1.20-alpha.4
  - @mastra/mcp@0.4.1-alpha.5
  - @mastra/memory@0.3.1-alpha.4
  - @mastra/rag@0.1.20-alpha.4

## 0.0.17-alpha.4

### Patch Changes

- 2526527: We are deprecating the MastraMCPClient class in favour of using MCPClient (formerly MCPConfiguration). MCPClient can handle 1+ MCP servers, whereas MastraMCPClient can only handle a single MCP server. Rather than having two different interfaces to use when using a single MCP vs multiple, we opted to nudge people towards using the interface that is more flexible.
- Updated dependencies [2526527]
- Updated dependencies [a2ccb71]
  - @mastra/mcp@0.4.1-alpha.4

## 0.0.17-alpha.3

### Patch Changes

- 35d5538: Fix dane
- Updated dependencies [6262bd5]
- Updated dependencies [ba1f4f3]
- Updated dependencies [c4c6f04]
  - @mastra/core@0.9.1-alpha.3
  - @mastra/mcp@0.4.1-alpha.3
  - @mastra/rag@0.1.20-alpha.3
  - @mastra/github@1.1.20-alpha.3
  - @mastra/memory@0.3.1-alpha.3
  - @mastra/libsql@0.0.1-alpha.3
  - @mastra/upstash@0.3.1-alpha.3

## 0.0.17-alpha.2

### Patch Changes

- Updated dependencies [405b63d]
- Updated dependencies [61e92f5]
- Updated dependencies [c71013a]
  - @mastra/core@0.9.1-alpha.2
  - @mastra/github@1.1.20-alpha.2
  - @mastra/mcp@0.4.1-alpha.2
  - @mastra/memory@0.3.1-alpha.2
  - @mastra/rag@0.1.20-alpha.2
  - @mastra/libsql@0.0.1-alpha.2
  - @mastra/upstash@0.3.1-alpha.2

## 0.0.17-alpha.1

### Patch Changes

- Updated dependencies [6278b62]
- Updated dependencies [8fb46d6]
- Updated dependencies [20275d4]
- Updated dependencies [7d1892c]
- Updated dependencies [a90a082]
- Updated dependencies [35955b0]
- Updated dependencies [c1409ef]
- Updated dependencies [11d4485]
- Updated dependencies [db1d220]
- Updated dependencies [2d4001d]
  - @mastra/rag@0.1.20-alpha.1
  - @mastra/memory@0.3.1-alpha.1
  - @mastra/core@0.9.1-alpha.1
  - @mastra/libsql@0.0.1-alpha.1
  - @mastra/github@1.1.20-alpha.1
  - @mastra/mcp@0.4.1-alpha.1
  - @mastra/upstash@0.3.1-alpha.1

## 0.0.17-alpha.0

### Patch Changes

- Updated dependencies [81fb7f6]
  - @mastra/core@0.9.1-alpha.0
  - @mastra/github@1.1.20-alpha.0
  - @mastra/mcp@0.4.1-alpha.0
  - @mastra/memory@0.3.1-alpha.0
  - @mastra/rag@0.1.20-alpha.0
  - @mastra/upstash@0.3.1-alpha.0

## 0.0.16

### Patch Changes

- Updated dependencies [a3b2fb3]
- Updated dependencies [000a6d4]
- Updated dependencies [08bb78e]
- Updated dependencies [ed2f549]
- Updated dependencies [7e92011]
- Updated dependencies [9ee4293]
- Updated dependencies [03f3cd0]
- Updated dependencies [c0f22b4]
- Updated dependencies [71d9444]
- Updated dependencies [157c741]
- Updated dependencies [5c6825c]
- Updated dependencies [8a8a73b]
- Updated dependencies [0a033fa]
- Updated dependencies [fe3ae4d]
- Updated dependencies [f850f80]
- Updated dependencies [9c26508]
- Updated dependencies [0f4eae3]
- Updated dependencies [16a8648]
- Updated dependencies [6f92295]
  - @mastra/mcp@0.4.0
  - @mastra/memory@0.3.0
  - @mastra/core@0.9.0
  - @mastra/upstash@0.3.0
  - @mastra/rag@0.1.19
  - @mastra/github@1.1.19

## 0.0.16-alpha.9

### Patch Changes

- Updated dependencies [000a6d4]
- Updated dependencies [ed2f549]
- Updated dependencies [c0f22b4]
- Updated dependencies [0a033fa]
- Updated dependencies [9c26508]
- Updated dependencies [0f4eae3]
- Updated dependencies [16a8648]
  - @mastra/memory@0.3.0-alpha.9
  - @mastra/core@0.9.0-alpha.8
  - @mastra/mcp@0.4.0-alpha.9
  - @mastra/github@1.1.19-alpha.8
  - @mastra/rag@0.1.19-alpha.8
  - @mastra/upstash@0.3.0-alpha.8

## 0.0.16-alpha.8

### Patch Changes

- Updated dependencies [71d9444]
  - @mastra/core@0.9.0-alpha.7
  - @mastra/memory@0.3.0-alpha.8
  - @mastra/github@1.1.19-alpha.7
  - @mastra/mcp@0.4.0-alpha.8
  - @mastra/rag@0.1.19-alpha.7
  - @mastra/upstash@0.3.0-alpha.7

## 0.0.16-alpha.7

### Patch Changes

- Updated dependencies [157c741]
  - @mastra/core@0.9.0-alpha.6
  - @mastra/github@1.1.19-alpha.6
  - @mastra/mcp@0.4.0-alpha.7
  - @mastra/memory@0.3.0-alpha.7
  - @mastra/rag@0.1.19-alpha.6
  - @mastra/upstash@0.3.0-alpha.6

## 0.0.16-alpha.6

### Patch Changes

- Updated dependencies [08bb78e]
  - @mastra/core@0.9.0-alpha.5
  - @mastra/github@1.1.19-alpha.5
  - @mastra/mcp@0.4.0-alpha.6
  - @mastra/memory@0.3.0-alpha.6
  - @mastra/rag@0.1.19-alpha.5
  - @mastra/upstash@0.3.0-alpha.5

## 0.0.16-alpha.5

### Patch Changes

- Updated dependencies [7e92011]
- Updated dependencies [f850f80]
  - @mastra/core@0.9.0-alpha.4
  - @mastra/rag@0.1.19-alpha.4
  - @mastra/github@1.1.19-alpha.4
  - @mastra/mcp@0.4.0-alpha.5
  - @mastra/memory@0.3.0-alpha.5
  - @mastra/upstash@0.3.0-alpha.4

## 0.0.16-alpha.4

### Patch Changes

- Updated dependencies [fe3ae4d]
  - @mastra/memory@0.3.0-alpha.4
  - @mastra/upstash@0.3.0-alpha.3
  - @mastra/core@0.9.0-alpha.3
  - @mastra/github@1.1.19-alpha.3
  - @mastra/mcp@0.4.0-alpha.4
  - @mastra/rag@0.1.19-alpha.3

## 0.0.16-alpha.3

### Patch Changes

- Updated dependencies [9ee4293]
  - @mastra/core@0.8.4-alpha.2
  - @mastra/github@1.1.19-alpha.2
  - @mastra/mcp@0.4.0-alpha.3
  - @mastra/memory@0.2.11-alpha.3
  - @mastra/rag@0.1.19-alpha.2
  - @mastra/upstash@0.2.6-alpha.2

## 0.0.16-alpha.2

### Patch Changes

- Updated dependencies [a3b2fb3]
- Updated dependencies [5c6825c]
  - @mastra/mcp@0.4.0-alpha.2
  - @mastra/memory@0.2.11-alpha.2

## 0.0.16-alpha.1

### Patch Changes

- Updated dependencies [8a8a73b]
- Updated dependencies [6f92295]
  - @mastra/core@0.8.4-alpha.1
  - @mastra/memory@0.2.11-alpha.1
  - @mastra/github@1.1.19-alpha.1
  - @mastra/mcp@0.3.11-alpha.1
  - @mastra/rag@0.1.19-alpha.1
  - @mastra/upstash@0.2.6-alpha.1

## 0.0.16-alpha.0

### Patch Changes

- Updated dependencies [03f3cd0]
  - @mastra/core@0.8.4-alpha.0
  - @mastra/github@1.1.19-alpha.0
  - @mastra/mcp@0.3.11-alpha.0
  - @mastra/memory@0.2.11-alpha.0
  - @mastra/rag@0.1.19-alpha.0
  - @mastra/upstash@0.2.6-alpha.0

## 0.0.15

### Patch Changes

- 37bb612: Add Elastic-2.0 licensing for packages
- Updated dependencies [d72318f]
- Updated dependencies [0bcc862]
- Updated dependencies [10a8caf]
- Updated dependencies [f6f7345]
- Updated dependencies [359b089]
- Updated dependencies [32e7b71]
- Updated dependencies [ec3cbf9]
- Updated dependencies [18d0758]
- Updated dependencies [492e370]
- Updated dependencies [37bb612]
- Updated dependencies [3e8e000]
- Updated dependencies [476ce7c]
- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3
  - @mastra/memory@0.2.10
  - @mastra/upstash@0.2.5
  - @mastra/rag@0.1.18
  - @mastra/mcp@0.3.10
  - @mastra/github@1.1.18

## 0.0.15-alpha.7

### Patch Changes

- Updated dependencies [d72318f]
- Updated dependencies [ec3cbf9]
  - @mastra/core@0.8.3-alpha.5
  - @mastra/upstash@0.2.5-alpha.5
  - @mastra/github@1.1.18-alpha.5
  - @mastra/mcp@0.3.10-alpha.6
  - @mastra/memory@0.2.10-alpha.5
  - @mastra/rag@0.1.18-alpha.6

## 0.0.15-alpha.6

### Patch Changes

- Updated dependencies [18d0758]
  - @mastra/rag@0.1.18-alpha.5

## 0.0.15-alpha.5

### Patch Changes

- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3-alpha.4
  - @mastra/github@1.1.18-alpha.4
  - @mastra/mcp@0.3.10-alpha.5
  - @mastra/memory@0.2.10-alpha.4
  - @mastra/rag@0.1.18-alpha.4
  - @mastra/upstash@0.2.5-alpha.4

## 0.0.15-alpha.4

### Patch Changes

- Updated dependencies [10a8caf]
  - @mastra/core@0.8.3-alpha.3
  - @mastra/github@1.1.18-alpha.3
  - @mastra/mcp@0.3.10-alpha.4
  - @mastra/memory@0.2.10-alpha.3
  - @mastra/rag@0.1.18-alpha.3
  - @mastra/upstash@0.2.5-alpha.3

## 0.0.15-alpha.3

### Patch Changes

- Updated dependencies [492e370]
  - @mastra/mcp@0.3.10-alpha.3

## 0.0.15-alpha.2

### Patch Changes

- Updated dependencies [0bcc862]
  - @mastra/core@0.8.3-alpha.2
  - @mastra/github@1.1.18-alpha.2
  - @mastra/mcp@0.3.10-alpha.2
  - @mastra/memory@0.2.10-alpha.2
  - @mastra/rag@0.1.18-alpha.2
  - @mastra/upstash@0.2.5-alpha.2

## 0.0.15-alpha.1

### Patch Changes

- 37bb612: Add Elastic-2.0 licensing for packages
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
- Updated dependencies [3e8e000]
- Updated dependencies [476ce7c]
  - @mastra/core@0.8.3-alpha.1
  - @mastra/github@1.1.18-alpha.1
  - @mastra/memory@0.2.10-alpha.1
  - @mastra/upstash@0.2.5-alpha.1
  - @mastra/mcp@0.3.10-alpha.1
  - @mastra/rag@0.1.18-alpha.1

## 0.0.15-alpha.0

### Patch Changes

- Updated dependencies [f6f7345]
- Updated dependencies [359b089]
  - @mastra/memory@0.2.10-alpha.0
  - @mastra/core@0.8.3-alpha.0
  - @mastra/github@1.1.18-alpha.0
  - @mastra/mcp@0.3.10-alpha.0
  - @mastra/rag@0.1.18-alpha.0
  - @mastra/upstash@0.2.5-alpha.0

## 0.0.14

### Patch Changes

- Updated dependencies [a06aadc]
  - @mastra/core@0.8.2
  - @mastra/github@1.1.17
  - @mastra/mcp@0.3.9
  - @mastra/memory@0.2.9
  - @mastra/rag@0.1.17
  - @mastra/upstash@0.2.4

## 0.0.14-alpha.0

### Patch Changes

- Updated dependencies [a06aadc]
  - @mastra/core@0.8.2-alpha.0
  - @mastra/github@1.1.17-alpha.0
  - @mastra/mcp@0.3.9-alpha.0
  - @mastra/memory@0.2.9-alpha.0
  - @mastra/rag@0.1.17-alpha.0
  - @mastra/upstash@0.2.4-alpha.0

## 0.0.13

### Patch Changes

- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1
  - @mastra/github@1.1.16
  - @mastra/mcp@0.3.8
  - @mastra/memory@0.2.8
  - @mastra/rag@0.1.16
  - @mastra/upstash@0.2.3

## 0.0.13-alpha.0

### Patch Changes

- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1-alpha.0
  - @mastra/github@1.1.16-alpha.0
  - @mastra/mcp@0.3.8-alpha.0
  - @mastra/memory@0.2.8-alpha.0
  - @mastra/rag@0.1.16-alpha.0
  - @mastra/upstash@0.2.3-alpha.0

## 0.0.12

### Patch Changes

- Updated dependencies [56c31b7]
- Updated dependencies [619c39d]
- Updated dependencies [5ae0180]
- Updated dependencies [fe56be0]
- Updated dependencies [93875ed]
- Updated dependencies [107bcfe]
- Updated dependencies [3e72f94]
- Updated dependencies [9bfa12b]
- Updated dependencies [515ebfb]
- Updated dependencies [5b4e19f]
- Updated dependencies [dbbbf80]
- Updated dependencies [a0967a0]
- Updated dependencies [e47f529]
- Updated dependencies [b7c1319]
- Updated dependencies [fca3b21]
- Updated dependencies [88fa727]
- Updated dependencies [f37f535]
- Updated dependencies [a3f0e90]
- Updated dependencies [4d67826]
- Updated dependencies [6330967]
- Updated dependencies [8393832]
- Updated dependencies [6330967]
- Updated dependencies [99d43b9]
- Updated dependencies [d7e08e8]
- Updated dependencies [58a4146]
- Updated dependencies [febc8a6]
- Updated dependencies [7599d77]
- Updated dependencies [0118361]
- Updated dependencies [619c39d]
- Updated dependencies [cafae83]
- Updated dependencies [8076ecf]
- Updated dependencies [8df4a77]
- Updated dependencies [304397c]
  - @mastra/core@0.8.0
  - @mastra/memory@0.2.7
  - @mastra/rag@0.1.15
  - @mastra/upstash@0.2.2
  - @mastra/github@1.1.15
  - @mastra/mcp@0.3.7

## 0.0.12-alpha.8

### Patch Changes

- Updated dependencies [b7c1319]
- Updated dependencies [8df4a77]
  - @mastra/upstash@0.2.2-alpha.8
  - @mastra/core@0.8.0-alpha.8
  - @mastra/github@1.1.15-alpha.8
  - @mastra/mcp@0.3.7-alpha.8
  - @mastra/memory@0.2.7-alpha.8
  - @mastra/rag@0.1.15-alpha.8

## 0.0.12-alpha.7

### Patch Changes

- Updated dependencies [febc8a6]
  - @mastra/core@0.8.0-alpha.7
  - @mastra/github@1.1.15-alpha.7
  - @mastra/mcp@0.3.7-alpha.7
  - @mastra/memory@0.2.7-alpha.7
  - @mastra/rag@0.1.15-alpha.7
  - @mastra/upstash@0.2.2-alpha.7

## 0.0.12-alpha.6

### Patch Changes

- Updated dependencies [a3f0e90]
  - @mastra/core@0.8.0-alpha.6
  - @mastra/github@1.1.15-alpha.6
  - @mastra/mcp@0.3.7-alpha.6
  - @mastra/memory@0.2.7-alpha.6
  - @mastra/rag@0.1.15-alpha.6
  - @mastra/upstash@0.2.2-alpha.6

## 0.0.12-alpha.5

### Patch Changes

- Updated dependencies [93875ed]
  - @mastra/memory@0.2.7-alpha.5
  - @mastra/core@0.8.0-alpha.5
  - @mastra/github@1.1.15-alpha.5
  - @mastra/mcp@0.3.7-alpha.5
  - @mastra/rag@0.1.15-alpha.5
  - @mastra/upstash@0.2.2-alpha.5

## 0.0.12-alpha.4

### Patch Changes

- Updated dependencies [d7e08e8]
  - @mastra/core@0.8.0-alpha.4
  - @mastra/github@1.1.15-alpha.4
  - @mastra/mcp@0.3.7-alpha.4
  - @mastra/memory@0.2.7-alpha.4
  - @mastra/rag@0.1.15-alpha.4
  - @mastra/upstash@0.2.2-alpha.4

## 0.0.12-alpha.3

### Patch Changes

- Updated dependencies [5ae0180]
- Updated dependencies [3e72f94]
- Updated dependencies [9bfa12b]
- Updated dependencies [515ebfb]
- Updated dependencies [88fa727]
- Updated dependencies [f37f535]
- Updated dependencies [4d67826]
- Updated dependencies [6330967]
- Updated dependencies [8393832]
- Updated dependencies [6330967]
- Updated dependencies [58a4146]
  - @mastra/memory@0.2.7-alpha.3
  - @mastra/core@0.8.0-alpha.3
  - @mastra/upstash@0.2.2-alpha.3
  - @mastra/github@1.1.15-alpha.3
  - @mastra/mcp@0.3.7-alpha.3
  - @mastra/rag@0.1.15-alpha.3

## 0.0.12-alpha.2

### Patch Changes

- Updated dependencies [56c31b7]
- Updated dependencies [dbbbf80]
- Updated dependencies [99d43b9]
  - @mastra/core@0.8.0-alpha.2
  - @mastra/github@1.1.15-alpha.2
  - @mastra/mcp@0.3.7-alpha.2
  - @mastra/memory@0.2.7-alpha.2
  - @mastra/rag@0.1.15-alpha.2
  - @mastra/upstash@0.2.2-alpha.2

## 0.0.12-alpha.1

### Patch Changes

- Updated dependencies [619c39d]
- Updated dependencies [fe56be0]
- Updated dependencies [a0967a0]
- Updated dependencies [e47f529]
- Updated dependencies [fca3b21]
- Updated dependencies [0118361]
- Updated dependencies [619c39d]
  - @mastra/core@0.8.0-alpha.1
  - @mastra/memory@0.2.7-alpha.1
  - @mastra/rag@0.1.15-alpha.1
  - @mastra/github@1.1.15-alpha.1
  - @mastra/mcp@0.3.7-alpha.1
  - @mastra/upstash@0.2.2-alpha.1

## 0.0.12-alpha.0

### Patch Changes

- Updated dependencies [107bcfe]
- Updated dependencies [5b4e19f]
- Updated dependencies [7599d77]
- Updated dependencies [cafae83]
- Updated dependencies [8076ecf]
- Updated dependencies [304397c]
  - @mastra/core@0.7.1-alpha.0
  - @mastra/memory@0.2.7-alpha.0
  - @mastra/rag@0.1.15-alpha.0
  - @mastra/github@1.1.15-alpha.0
  - @mastra/mcp@0.3.7-alpha.0
  - @mastra/upstash@0.2.2-alpha.0

## 0.0.11

### Patch Changes

- Updated dependencies [05095e9]
- Updated dependencies [b4fbc59]
- Updated dependencies [a838fde]
- Updated dependencies [a8bd4cf]
- Updated dependencies [7a3eeb0]
- Updated dependencies [0b54522]
- Updated dependencies [394dfad]
- Updated dependencies [b3b34f5]
- Updated dependencies [1af25d5]
- Updated dependencies [a4686e8]
- Updated dependencies [6530ad1]
- Updated dependencies [27439ad]
  - @mastra/memory@0.2.6
  - @mastra/core@0.7.0
  - @mastra/github@1.1.14
  - @mastra/mcp@0.3.6
  - @mastra/rag@0.1.14
  - @mastra/upstash@0.2.1

## 0.0.11-alpha.4

### Patch Changes

- Updated dependencies [394dfad]
  - @mastra/memory@0.2.6-alpha.4

## 0.0.11-alpha.3

### Patch Changes

- Updated dependencies [05095e9]
- Updated dependencies [b3b34f5]
- Updated dependencies [a4686e8]
  - @mastra/memory@0.2.6-alpha.3
  - @mastra/core@0.7.0-alpha.3
  - @mastra/github@1.1.14-alpha.3
  - @mastra/mcp@0.3.6-alpha.3
  - @mastra/rag@0.1.14-alpha.3
  - @mastra/upstash@0.2.1-alpha.3

## 0.0.11-alpha.2

### Patch Changes

- Updated dependencies [a838fde]
- Updated dependencies [a8bd4cf]
- Updated dependencies [7a3eeb0]
- Updated dependencies [6530ad1]
  - @mastra/core@0.7.0-alpha.2
  - @mastra/github@1.1.14-alpha.2
  - @mastra/mcp@0.3.6-alpha.2
  - @mastra/memory@0.2.6-alpha.2
  - @mastra/rag@0.1.14-alpha.2
  - @mastra/upstash@0.2.1-alpha.2

## 0.0.11-alpha.1

### Patch Changes

- Updated dependencies [0b54522]
- Updated dependencies [51ee4bb]
- Updated dependencies [1af25d5]
- Updated dependencies [27439ad]
  - @mastra/core@0.7.0-alpha.1
  - @mastra/stabilityai@1.1.14-alpha.1
  - @mastra/github@1.1.14-alpha.1
  - @mastra/mcp@0.3.6-alpha.1
  - @mastra/memory@0.2.6-alpha.1
  - @mastra/rag@0.1.14-alpha.1
  - @mastra/upstash@0.2.1-alpha.1

## 0.0.11-alpha.0

### Patch Changes

- Updated dependencies [b4fbc59]
  - @mastra/core@0.6.5-alpha.0
  - @mastra/github@1.1.14-alpha.0
  - @mastra/stabilityai@1.1.14-alpha.0
  - @mastra/mcp@0.3.6-alpha.0
  - @mastra/memory@0.2.6-alpha.0
  - @mastra/rag@0.1.14-alpha.0
  - @mastra/upstash@0.2.1-alpha.0

## 0.0.10

### Patch Changes

- Updated dependencies [6794797]
- Updated dependencies [fb68a80]
- Updated dependencies [2621e3f]
- Updated dependencies [ac30427]
- Updated dependencies [c0b2496]
- Updated dependencies [b56a681]
- Updated dependencies [7911ddf]
- Updated dependencies [248cb07]
  - @mastra/core@0.6.4
  - @mastra/mcp@0.3.5
  - @mastra/rag@0.1.13
  - @mastra/upstash@0.2.0
  - @mastra/github@1.1.13
  - @mastra/stabilityai@1.1.13
  - @mastra/memory@0.2.5

## 0.0.10-alpha.2

### Patch Changes

- Updated dependencies [ac30427]
  - @mastra/rag@0.1.13-alpha.2

## 0.0.10-alpha.1

### Patch Changes

- Updated dependencies [6794797]
- Updated dependencies [2621e3f]
- Updated dependencies [c0b2496]
  - @mastra/core@0.6.4-alpha.1
  - @mastra/mcp@0.3.5-alpha.1
  - @mastra/upstash@0.2.0-alpha.1
  - @mastra/github@1.1.13-alpha.1
  - @mastra/stabilityai@1.1.13-alpha.1
  - @mastra/memory@0.2.5-alpha.1
  - @mastra/rag@0.1.13-alpha.1

## 0.0.10-alpha.0

### Patch Changes

- Updated dependencies [fb68a80]
- Updated dependencies [b56a681]
- Updated dependencies [7911ddf]
- Updated dependencies [248cb07]
  - @mastra/core@0.6.4-alpha.0
  - @mastra/upstash@0.1.13-alpha.0
  - @mastra/github@1.1.13-alpha.0
  - @mastra/stabilityai@1.1.13-alpha.0
  - @mastra/mcp@0.3.5-alpha.0
  - @mastra/memory@0.2.5-alpha.0
  - @mastra/rag@0.1.13-alpha.0

## 0.0.9

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
- Updated dependencies [3bce733]
  - @mastra/stabilityai@1.1.12
  - @mastra/github@1.1.12
  - @mastra/memory@0.2.4
  - @mastra/upstash@0.1.12
  - @mastra/core@0.6.3
  - @mastra/mcp@0.3.4
  - @mastra/rag@0.1.12

## 0.0.9-alpha.1

### Patch Changes

- Updated dependencies [3bce733]
  - @mastra/core@0.6.3-alpha.1
  - @mastra/github@1.1.12-alpha.1
  - @mastra/stabilityai@1.1.12-alpha.1
  - @mastra/mcp@0.3.4-alpha.1
  - @mastra/memory@0.2.4-alpha.1
  - @mastra/rag@0.1.12-alpha.1
  - @mastra/upstash@0.1.12-alpha.1

## 0.0.9-alpha.0

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
  - @mastra/stabilityai@1.1.12-alpha.0
  - @mastra/github@1.1.12-alpha.0
  - @mastra/memory@0.2.4-alpha.0
  - @mastra/upstash@0.1.12-alpha.0
  - @mastra/core@0.6.3-alpha.0
  - @mastra/mcp@0.3.4-alpha.0
  - @mastra/rag@0.1.12-alpha.0

## 0.0.8

### Patch Changes

- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/core@0.6.2
  - @mastra/github@1.1.11
  - @mastra/stabilityai@1.1.11
  - @mastra/mcp@0.3.3
  - @mastra/memory@0.2.3
  - @mastra/rag@0.1.11
  - @mastra/upstash@0.1.11

## 0.0.8-alpha.0

### Patch Changes

- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/core@0.6.2-alpha.0
  - @mastra/github@1.1.11-alpha.0
  - @mastra/stabilityai@1.1.11-alpha.0
  - @mastra/mcp@0.3.3-alpha.0
  - @mastra/memory@0.2.3-alpha.0
  - @mastra/rag@0.1.11-alpha.0
  - @mastra/upstash@0.1.11-alpha.0

## 0.0.7

### Patch Changes

- Updated dependencies [ff1a76c]
- Updated dependencies [fc2f89c]
- Updated dependencies [dfbb131]
- Updated dependencies [f4854ee]
- Updated dependencies [afaf73f]
- Updated dependencies [0850b4c]
- Updated dependencies [b195f6e]
- Updated dependencies [7bcfaee]
- Updated dependencies [44631b1]
- Updated dependencies [9116d70]
- Updated dependencies [6e559a0]
- Updated dependencies [5f43505]
  - @mastra/rag@0.1.10
  - @mastra/core@0.6.1
  - @mastra/github@1.1.10
  - @mastra/stabilityai@1.1.10
  - @mastra/mcp@0.3.2
  - @mastra/memory@0.2.2
  - @mastra/upstash@0.1.10

## 0.0.7-alpha.2

### Patch Changes

- Updated dependencies [fc2f89c]
- Updated dependencies [dfbb131]
- Updated dependencies [0850b4c]
- Updated dependencies [9116d70]
  - @mastra/core@0.6.1-alpha.2
  - @mastra/github@1.1.10-alpha.2
  - @mastra/stabilityai@1.1.10-alpha.2
  - @mastra/mcp@0.3.2-alpha.2
  - @mastra/memory@0.2.2-alpha.2
  - @mastra/rag@0.1.10-alpha.2
  - @mastra/upstash@0.1.10-alpha.2

## 0.0.7-alpha.1

### Patch Changes

- Updated dependencies [ff1a76c]
- Updated dependencies [f4854ee]
- Updated dependencies [afaf73f]
- Updated dependencies [b195f6e]
- Updated dependencies [44631b1]
- Updated dependencies [6e559a0]
- Updated dependencies [5f43505]
  - @mastra/rag@0.1.10-alpha.1
  - @mastra/core@0.6.1-alpha.1
  - @mastra/github@1.1.10-alpha.1
  - @mastra/stabilityai@1.1.10-alpha.1
  - @mastra/mcp@0.3.2-alpha.1
  - @mastra/memory@0.2.2-alpha.1
  - @mastra/upstash@0.1.10-alpha.1

## 0.0.7-alpha.0

### Patch Changes

- Updated dependencies [7bcfaee]
  - @mastra/core@0.6.1-alpha.0
  - @mastra/github@1.1.10-alpha.0
  - @mastra/stabilityai@1.1.10-alpha.0
  - @mastra/mcp@0.3.2-alpha.0
  - @mastra/memory@0.2.2-alpha.0
  - @mastra/rag@0.1.10-alpha.0
  - @mastra/upstash@0.1.10-alpha.0

## 0.0.6

### Patch Changes

- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [f14c830]
- Updated dependencies [95b4144]
- Updated dependencies [3729dbd]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0
  - @mastra/rag@0.1.9
  - @mastra/memory@0.2.1
  - @mastra/github@1.1.9
  - @mastra/stabilityai@1.1.9
  - @mastra/mcp@0.3.1
  - @mastra/upstash@0.1.9

## 0.0.6-alpha.1

### Patch Changes

- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [f14c830]
- Updated dependencies [95b4144]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0-alpha.1
  - @mastra/rag@0.1.9-alpha.1
  - @mastra/github@1.1.9-alpha.1
  - @mastra/stabilityai@1.1.9-alpha.1
  - @mastra/mcp@0.3.1-alpha.1
  - @mastra/memory@0.2.1-alpha.1
  - @mastra/upstash@0.1.9-alpha.1

## 0.0.6-alpha.0

### Patch Changes

- Updated dependencies [3729dbd]
  - @mastra/memory@0.2.1-alpha.0
  - @mastra/core@0.5.1-alpha.0
  - @mastra/github@1.1.9-alpha.0
  - @mastra/stabilityai@1.1.9-alpha.0
  - @mastra/mcp@0.3.1-alpha.0
  - @mastra/rag@0.1.9-alpha.0
  - @mastra/upstash@0.1.9-alpha.0

## 0.0.5

### Patch Changes

- fd4a1d7: Update cjs bundling to make sure files are split
- Updated dependencies [a910463]
- Updated dependencies [59df7b6]
- Updated dependencies [22643eb]
- Updated dependencies [6feb23f]
- Updated dependencies [f2d6727]
- Updated dependencies [7a7a547]
- Updated dependencies [29f3a82]
- Updated dependencies [3d0e290]
- Updated dependencies [e9fbac5]
- Updated dependencies [301e4ee]
- Updated dependencies [ee667a2]
- Updated dependencies [dfbe4e9]
- Updated dependencies [dab255b]
- Updated dependencies [1e8bcbc]
- Updated dependencies [f2e8e5f]
- Updated dependencies [f6678e4]
- Updated dependencies [9e81f35]
- Updated dependencies [c93798b]
- Updated dependencies [9e0f2c9]
- Updated dependencies [a85ab24]
- Updated dependencies [dbd9f2d]
- Updated dependencies [59df7b6]
- Updated dependencies [caefaa2]
- Updated dependencies [c151ae6]
- Updated dependencies [52e0418]
- Updated dependencies [d79aedf]
- Updated dependencies [03236ec]
- Updated dependencies [3764e71]
- Updated dependencies [df982db]
- Updated dependencies [7848663]
- Updated dependencies [a171b37]
- Updated dependencies [506f1d5]
- Updated dependencies [02ffb7b]
- Updated dependencies [dd7a09a]
- Updated dependencies [0461849]
- Updated dependencies [aec08af]
- Updated dependencies [2259379]
- Updated dependencies [aeb5e36]
- Updated dependencies [f2301de]
- Updated dependencies [358f069]
- Updated dependencies [fd4a1d7]
- Updated dependencies [c139344]
  - @mastra/core@0.5.0
  - @mastra/memory@0.2.0
  - @mastra/rag@0.1.8
  - @mastra/github@1.1.8
  - @mastra/mcp@0.3.0
  - @mastra/stabilityai@1.1.8
  - @mastra/upstash@0.1.8

## 0.0.5-alpha.13

### Patch Changes

- Updated dependencies [a85ab24]
  - @mastra/core@0.5.0-alpha.12
  - @mastra/github@1.1.8-alpha.12
  - @mastra/stabilityai@1.1.8-alpha.12
  - @mastra/mcp@0.3.0-alpha.13
  - @mastra/memory@0.2.0-alpha.12
  - @mastra/rag@0.1.8-alpha.13
  - @mastra/upstash@0.1.8-alpha.12

## 0.0.5-alpha.12

### Patch Changes

- fd4a1d7: Update cjs bundling to make sure files are split
- Updated dependencies [7a7a547]
- Updated dependencies [c93798b]
- Updated dependencies [dbd9f2d]
- Updated dependencies [a171b37]
- Updated dependencies [fd4a1d7]
  - @mastra/core@0.5.0-alpha.11
  - @mastra/rag@0.1.8-alpha.12
  - @mastra/stabilityai@1.1.8-alpha.11
  - @mastra/github@1.1.8-alpha.11
  - @mastra/memory@0.2.0-alpha.11
  - @mastra/upstash@0.1.8-alpha.11
  - @mastra/mcp@0.3.0-alpha.12

## 0.0.5-alpha.11

### Patch Changes

- Updated dependencies [7848663]
- Updated dependencies [aec08af]
  - @mastra/mcp@0.3.0-alpha.11
  - @mastra/rag@0.1.8-alpha.11

## 0.0.5-alpha.10

### Patch Changes

- Updated dependencies [a910463]
- Updated dependencies [dd7a09a]
  - @mastra/core@0.5.0-alpha.10
  - @mastra/mcp@0.3.0-alpha.10
  - @mastra/github@1.1.8-alpha.10
  - @mastra/stabilityai@1.1.8-alpha.10
  - @mastra/memory@0.2.0-alpha.10
  - @mastra/rag@0.1.8-alpha.10
  - @mastra/upstash@0.1.8-alpha.10

## 0.0.5-alpha.9

### Patch Changes

- Updated dependencies [e9fbac5]
- Updated dependencies [1e8bcbc]
- Updated dependencies [aeb5e36]
- Updated dependencies [f2301de]
  - @mastra/core@0.5.0-alpha.9
  - @mastra/memory@0.2.0-alpha.9
  - @mastra/github@1.1.8-alpha.9
  - @mastra/stabilityai@1.1.8-alpha.9
  - @mastra/mcp@0.2.7-alpha.9
  - @mastra/rag@0.1.8-alpha.9
  - @mastra/upstash@0.1.8-alpha.9

## 0.0.5-alpha.8

### Patch Changes

- Updated dependencies [506f1d5]
  - @mastra/core@0.5.0-alpha.8
  - @mastra/github@1.1.8-alpha.8
  - @mastra/stabilityai@1.1.8-alpha.8
  - @mastra/mcp@0.2.7-alpha.8
  - @mastra/memory@0.2.0-alpha.8
  - @mastra/rag@0.1.8-alpha.8
  - @mastra/upstash@0.1.8-alpha.8

## 0.0.5-alpha.7

### Patch Changes

- Updated dependencies [ee667a2]
  - @mastra/core@0.5.0-alpha.7
  - @mastra/github@1.1.8-alpha.7
  - @mastra/stabilityai@1.1.8-alpha.7
  - @mastra/mcp@0.2.7-alpha.7
  - @mastra/memory@0.2.0-alpha.7
  - @mastra/rag@0.1.8-alpha.7
  - @mastra/upstash@0.1.8-alpha.7

## 0.0.5-alpha.6

### Patch Changes

- Updated dependencies [f6678e4]
  - @mastra/core@0.5.0-alpha.6
  - @mastra/github@1.1.8-alpha.6
  - @mastra/stabilityai@1.1.8-alpha.6
  - @mastra/mcp@0.2.7-alpha.6
  - @mastra/memory@0.2.0-alpha.6
  - @mastra/rag@0.1.8-alpha.6
  - @mastra/upstash@0.1.8-alpha.6

## 0.0.5-alpha.5

### Patch Changes

- Updated dependencies [22643eb]
- Updated dependencies [6feb23f]
- Updated dependencies [f2d6727]
- Updated dependencies [301e4ee]
- Updated dependencies [dfbe4e9]
- Updated dependencies [9e81f35]
- Updated dependencies [9e0f2c9]
- Updated dependencies [caefaa2]
- Updated dependencies [c151ae6]
- Updated dependencies [52e0418]
- Updated dependencies [03236ec]
- Updated dependencies [3764e71]
- Updated dependencies [df982db]
- Updated dependencies [0461849]
- Updated dependencies [2259379]
- Updated dependencies [358f069]
  - @mastra/core@0.5.0-alpha.5
  - @mastra/rag@0.1.8-alpha.5
  - @mastra/memory@0.2.0-alpha.5
  - @mastra/github@1.1.8-alpha.5
  - @mastra/mcp@0.2.7-alpha.5
  - @mastra/stabilityai@1.1.8-alpha.5
  - @mastra/upstash@0.1.8-alpha.5

## 0.0.5-alpha.4

### Patch Changes

- Updated dependencies [d79aedf]
  - @mastra/core@0.5.0-alpha.4
  - @mastra/github@1.1.8-alpha.4
  - @mastra/stabilityai@1.1.8-alpha.4
  - @mastra/mcp@0.2.7-alpha.4
  - @mastra/memory@0.2.0-alpha.4
  - @mastra/rag@0.1.8-alpha.4
  - @mastra/upstash@0.1.8-alpha.4

## 0.0.5-alpha.3

### Patch Changes

- Updated dependencies [3d0e290]
- Updated dependencies [f2e8e5f]
  - @mastra/core@0.5.0-alpha.3
  - @mastra/rag@0.1.8-alpha.3
  - @mastra/github@1.1.8-alpha.3
  - @mastra/stabilityai@1.1.8-alpha.3
  - @mastra/mcp@0.2.7-alpha.3
  - @mastra/memory@0.2.0-alpha.3
  - @mastra/upstash@0.1.8-alpha.3

## 0.0.5-alpha.2

### Patch Changes

- Updated dependencies [02ffb7b]
  - @mastra/core@0.5.0-alpha.2
  - @mastra/github@1.1.8-alpha.2
  - @mastra/stabilityai@1.1.8-alpha.2
  - @mastra/mcp@0.2.7-alpha.2
  - @mastra/memory@0.2.0-alpha.2
  - @mastra/rag@0.1.8-alpha.2
  - @mastra/upstash@0.1.8-alpha.2

## 0.0.5-alpha.1

### Patch Changes

- Updated dependencies [dab255b]
  - @mastra/core@0.5.0-alpha.1
  - @mastra/github@1.1.8-alpha.1
  - @mastra/stabilityai@1.1.8-alpha.1
  - @mastra/mcp@0.2.7-alpha.1
  - @mastra/memory@0.2.0-alpha.1
  - @mastra/rag@0.1.8-alpha.1
  - @mastra/upstash@0.1.8-alpha.1

## 0.0.5-alpha.0

### Patch Changes

- Updated dependencies [59df7b6]
- Updated dependencies [29f3a82]
- Updated dependencies [59df7b6]
- Updated dependencies [c139344]
  - @mastra/memory@0.2.0-alpha.0
  - @mastra/core@0.5.0-alpha.0
  - @mastra/github@1.1.8-alpha.0
  - @mastra/stabilityai@1.1.8-alpha.0
  - @mastra/mcp@0.2.7-alpha.0
  - @mastra/rag@0.1.8-alpha.0
  - @mastra/upstash@0.1.8-alpha.0

## 0.0.3

### Patch Changes

- Updated dependencies [1da20e7]
  - @mastra/core@0.4.4
  - @mastra/github@1.1.7
  - @mastra/stabilityai@1.1.7
  - @mastra/mcp@0.2.6
  - @mastra/memory@0.1.7
  - @mastra/rag@0.1.7
  - @mastra/upstash@0.1.7

## 0.0.3-alpha.0

### Patch Changes

- Updated dependencies [1da20e7]
  - @mastra/core@0.4.4-alpha.0
  - @mastra/github@1.1.7-alpha.0
  - @mastra/stabilityai@1.1.7-alpha.0
  - @mastra/mcp@0.2.6-alpha.0
  - @mastra/memory@0.1.7-alpha.0
  - @mastra/rag@0.1.7-alpha.0
  - @mastra/upstash@0.1.7-alpha.0

## 0.0.2

### Patch Changes

- Updated dependencies [0d185b1]
- Updated dependencies [ed55f1d]
- Updated dependencies [06aa827]
- Updated dependencies [0fd78ac]
- Updated dependencies [2512a93]
- Updated dependencies [e62de74]
- Updated dependencies [0d25b75]
- Updated dependencies [fd14a3f]
- Updated dependencies [c4fdac3]
- Updated dependencies [8d13b14]
- Updated dependencies [3f369a2]
- Updated dependencies [3ee4831]
- Updated dependencies [4d4e1e1]
- Updated dependencies [bb4f447]
- Updated dependencies [108793c]
- Updated dependencies [5f28f44]
- Updated dependencies [dabecf4]
  - @mastra/core@0.4.3
  - @mastra/memory@0.1.6
  - @mastra/upstash@0.1.6
  - @mastra/rag@0.1.6
  - @mastra/stabilityai@1.1.6
  - @mastra/github@1.1.6
  - @mastra/mcp@0.2.5

## 0.0.2-alpha.121

### Patch Changes

- Updated dependencies [dabecf4]
  - @mastra/core@0.4.3-alpha.4
  - @mastra/github@1.1.6-alpha.4
  - @mastra/stabilityai@1.1.6-alpha.4
  - @mastra/mcp@0.2.5-alpha.4
  - @mastra/memory@0.1.6-alpha.4
  - @mastra/rag@0.1.6-alpha.4
  - @mastra/upstash@0.1.6-alpha.4

## 0.0.2-alpha.120

### Patch Changes

- Updated dependencies [0fd78ac]
- Updated dependencies [0d25b75]
- Updated dependencies [fd14a3f]
- Updated dependencies [c4fdac3]
- Updated dependencies [3f369a2]
- Updated dependencies [4d4e1e1]
- Updated dependencies [bb4f447]
  - @mastra/memory@0.1.6-alpha.3
  - @mastra/upstash@0.1.6-alpha.3
  - @mastra/core@0.4.3-alpha.3
  - @mastra/rag@0.1.6-alpha.3
  - @mastra/stabilityai@1.1.6-alpha.3
  - @mastra/github@1.1.6-alpha.3
  - @mastra/mcp@0.2.5-alpha.3

## 0.0.2-alpha.119

### Patch Changes

- Updated dependencies [2512a93]
- Updated dependencies [e62de74]
  - @mastra/core@0.4.3-alpha.2
  - @mastra/github@1.1.6-alpha.2
  - @mastra/stabilityai@1.1.6-alpha.2
  - @mastra/mcp@0.2.5-alpha.2
  - @mastra/memory@0.1.6-alpha.2
  - @mastra/rag@0.1.6-alpha.2
  - @mastra/upstash@0.1.6-alpha.2

## 0.0.2-alpha.118

### Patch Changes

- Updated dependencies [0d185b1]
- Updated dependencies [ed55f1d]
- Updated dependencies [8d13b14]
- Updated dependencies [3ee4831]
- Updated dependencies [108793c]
- Updated dependencies [5f28f44]
  - @mastra/core@0.4.3-alpha.1
  - @mastra/github@1.1.6-alpha.1
  - @mastra/stabilityai@1.1.6-alpha.1
  - @mastra/mcp@0.2.5-alpha.1
  - @mastra/memory@0.1.6-alpha.1
  - @mastra/rag@0.1.6-alpha.1
  - @mastra/upstash@0.1.6-alpha.1

## 0.0.2-alpha.115

### Patch Changes

- Updated dependencies [8151f44]
- Updated dependencies [e897f1c]
- Updated dependencies [3700be1]
  - @mastra/core@0.2.0-alpha.90
  - @mastra/firecrawl@1.1.0-alpha.84
  - @mastra/github@1.0.3-alpha.75
  - @mastra/stabilityai@1.0.1-alpha.65
  - @mastra/mcp@0.1.0-alpha.32
  - @mastra/memory@0.1.0-alpha.72
  - @mastra/rag@0.1.0-alpha.82
  - @mastra/store-upstash@0.0.0-alpha.9

## 0.0.2-alpha.114

### Patch Changes

- Updated dependencies [fb49659]
  - @mastra/store-upstash@0.0.0-alpha.8

## 0.0.2-alpha.113

### Patch Changes

- Updated dependencies [27275c9]
  - @mastra/memory@0.1.0-alpha.71
  - @mastra/core@0.2.0-alpha.89
  - @mastra/firecrawl@1.1.0-alpha.83
  - @mastra/github@1.0.3-alpha.74
  - @mastra/stabilityai@1.0.1-alpha.64
  - @mastra/mcp@0.1.0-alpha.31
  - @mastra/rag@0.1.0-alpha.81
  - @mastra/store-upstash@0.0.0-alpha.7

## 0.0.2-alpha.112

### Patch Changes

- Updated dependencies [ccbc581]
  - @mastra/core@0.2.0-alpha.88
  - @mastra/firecrawl@1.1.0-alpha.82
  - @mastra/github@1.0.3-alpha.73
  - @mastra/stabilityai@1.0.1-alpha.63
  - @mastra/mcp@0.1.0-alpha.30
  - @mastra/memory@0.1.0-alpha.70
  - @mastra/rag@0.1.0-alpha.80
  - @mastra/store-upstash@0.0.0-alpha.6

## 0.0.2-alpha.111

### Patch Changes

- Updated dependencies [7365b6c]
  - @mastra/core@0.2.0-alpha.87
  - @mastra/firecrawl@1.1.0-alpha.81
  - @mastra/github@1.0.3-alpha.72
  - @mastra/stabilityai@1.0.1-alpha.62
  - @mastra/mcp@0.1.0-alpha.29
  - @mastra/memory@0.1.0-alpha.69
  - @mastra/rag@0.1.0-alpha.79
  - @mastra/store-upstash@0.0.0-alpha.5

## 0.0.2-alpha.110

### Patch Changes

- Updated dependencies [6fa4bd2]
- Updated dependencies [5916f9d]
- Updated dependencies [e2e76de]
- Updated dependencies [7f24c29]
- Updated dependencies [67637ba]
- Updated dependencies [04f3171]
  - @mastra/core@0.2.0-alpha.86
  - @mastra/firecrawl@1.1.0-alpha.80
  - @mastra/memory@0.1.0-alpha.68
  - @mastra/store-upstash@0.0.0-alpha.4
  - @mastra/mcp@0.1.0-alpha.28
  - @mastra/rag@0.1.0-alpha.78
  - @mastra/github@1.0.3-alpha.71
  - @mastra/stabilityai@1.0.1-alpha.61

## 0.0.2-alpha.109

### Patch Changes

- Updated dependencies [e9d1b47]
  - @mastra/memory@0.1.0-alpha.67
  - @mastra/core@0.2.0-alpha.85
  - @mastra/firecrawl@1.0.4-alpha.79
  - @mastra/github@1.0.3-alpha.70
  - @mastra/stabilityai@1.0.1-alpha.60
  - @mastra/mcp@0.0.1-alpha.27
  - @mastra/rag@0.0.2-alpha.77
  - @mastra/store-upstash@0.0.0-alpha.3

## 0.0.2-alpha.108

### Patch Changes

- Updated dependencies [f646a8b]
  - @mastra/rag@0.0.2-alpha.76
  - @mastra/firecrawl@1.0.4-alpha.78

## 0.0.2-alpha.107

### Patch Changes

- Updated dependencies [2f17a5f]
- Updated dependencies [0696eeb]
- Updated dependencies [cb290ee]
- Updated dependencies [b4d7416]
- Updated dependencies [38b7f66]
  - @mastra/core@0.2.0-alpha.84
  - @mastra/github@1.0.3-alpha.69
  - @mastra/memory@0.1.0-alpha.66
  - @mastra/firecrawl@1.0.4-alpha.77
  - @mastra/stabilityai@1.0.1-alpha.59
  - @mastra/mcp@0.0.1-alpha.26
  - @mastra/rag@0.0.2-alpha.75
  - @mastra/store-upstash@0.0.0-alpha.2

## 0.0.2-alpha.106

### Patch Changes

- Updated dependencies [03bc87c]
  - @mastra/github@1.0.3-alpha.68

## 0.0.2-alpha.105

### Patch Changes

- Updated dependencies [30322ce]
- Updated dependencies [78eec7c]
- Updated dependencies [c35aa18]
- Updated dependencies [9625602]
- Updated dependencies [b8f3be0]
- Updated dependencies [bbe0c19]
- Updated dependencies [8769a62]
  - @mastra/memory@0.1.0-alpha.65
  - @mastra/store-upstash@0.0.0-alpha.1
  - @mastra/core@0.2.0-alpha.83
  - @mastra/mcp@0.0.1-alpha.25
  - @mastra/rag@0.0.2-alpha.74
  - @mastra/stabilityai@1.0.1-alpha.58
  - @mastra/firecrawl@1.0.4-alpha.76
  - @mastra/github@1.0.3-alpha.67

## 0.0.2-alpha.103

### Patch Changes

- Updated dependencies [73d112c]
  - @mastra/core@0.1.27-alpha.82
  - @mastra/firecrawl@1.0.4-alpha.75
  - @mastra/github@1.0.3-alpha.66
  - @mastra/stabilityai@1.0.1-alpha.57
  - @mastra/mcp@0.0.1-alpha.24
  - @mastra/memory@0.0.2-alpha.64
  - @mastra/rag@0.0.2-alpha.73

## 0.0.2-alpha.101

### Patch Changes

- Updated dependencies [9fb3039]
  - @mastra/core@0.1.27-alpha.81
  - @mastra/firecrawl@1.0.4-alpha.74
  - @mastra/github@1.0.3-alpha.65
  - @mastra/stabilityai@1.0.1-alpha.56
  - @mastra/mcp@0.0.1-alpha.23
  - @mastra/memory@0.0.2-alpha.63
  - @mastra/rag@0.0.2-alpha.72

## 0.0.2-alpha.99

### Patch Changes

- Updated dependencies [a944f1a]
- Updated dependencies [7f5b1b2]
  - @mastra/rag@0.0.2-alpha.71
  - @mastra/memory@0.0.2-alpha.62
  - @mastra/firecrawl@1.0.4-alpha.73

## 0.0.2-alpha.96

### Patch Changes

- 327ece7: Updates for ts versions
- Updated dependencies [327ece7]
  - @mastra/stabilityai@1.0.1-alpha.55
  - @mastra/firecrawl@1.0.4-alpha.72
  - @mastra/github@1.0.3-alpha.64
  - @mastra/engine@0.0.5-alpha.75
  - @mastra/core@0.1.27-alpha.80
  - @mastra/rag@0.0.2-alpha.70
  - @mastra/mcp@0.0.1-alpha.22
  - @mastra/memory@0.0.2-alpha.61

## 0.0.2-alpha.95

### Patch Changes

- Updated dependencies [21fe536]
  - @mastra/core@0.1.27-alpha.79
  - @mastra/rag@0.0.2-alpha.69
  - @mastra/firecrawl@1.0.4-alpha.71
  - @mastra/github@1.0.3-alpha.63
  - @mastra/stabilityai@1.0.1-alpha.54
  - @mastra/engine@0.0.5-alpha.74
  - @mastra/mcp@0.0.1-alpha.21
  - @mastra/memory@0.0.2-alpha.60

## 0.0.2-alpha.93

### Patch Changes

- 685108a: Removing mastra syncs
- Updated dependencies [685108a]
- Updated dependencies [685108a]
  - @mastra/firecrawl@1.0.4-alpha.70
  - @mastra/core@0.1.27-alpha.78
  - @mastra/rag@0.0.2-alpha.68
  - @mastra/github@1.0.3-alpha.62
  - @mastra/stabilityai@1.0.1-alpha.53
  - @mastra/engine@0.0.5-alpha.73
  - @mastra/mcp@0.0.1-alpha.20
  - @mastra/memory@0.0.2-alpha.59

## 0.0.2-alpha.92

### Patch Changes

- cfb966f: Deprecate @mastra/tts for mastra speech providers
- Updated dependencies [8105fae]
- Updated dependencies [8468b7f]
- Updated dependencies [ecdee97]
  - @mastra/core@0.1.27-alpha.77
  - @mastra/rag@0.0.2-alpha.67
  - @mastra/mcp@0.0.1-alpha.19
  - @mastra/firecrawl@1.0.4-alpha.69
  - @mastra/github@1.0.3-alpha.61
  - @mastra/stabilityai@1.0.1-alpha.52
  - @mastra/engine@0.0.5-alpha.72
  - @mastra/memory@0.0.2-alpha.58

## 0.0.2-alpha.91

### Patch Changes

- Updated dependencies [9c0d010]
  - @mastra/rag@0.0.2-alpha.66
  - @mastra/firecrawl@1.0.4-alpha.68

## 0.0.2-alpha.90

### Patch Changes

- Updated dependencies [ae7bf94]
- Updated dependencies [ae7bf94]
  - @mastra/core@0.1.27-alpha.76
  - @mastra/firecrawl@1.0.4-alpha.67
  - @mastra/github@1.0.3-alpha.60
  - @mastra/stabilityai@1.0.1-alpha.51
  - @mastra/engine@0.0.5-alpha.71
  - @mastra/mcp@0.0.1-alpha.18
  - @mastra/memory@0.0.2-alpha.57
  - @mastra/rag@0.0.2-alpha.65

## 0.0.2-alpha.89

### Patch Changes

- Updated dependencies [23dcb23]
  - @mastra/core@0.1.27-alpha.75
  - @mastra/firecrawl@1.0.4-alpha.66
  - @mastra/github@1.0.3-alpha.59
  - @mastra/stabilityai@1.0.1-alpha.50
  - @mastra/engine@0.0.5-alpha.70
  - @mastra/mcp@0.0.1-alpha.17
  - @mastra/memory@0.0.2-alpha.56
  - @mastra/rag@0.0.2-alpha.64

## 0.0.2-alpha.88

### Patch Changes

- Updated dependencies [7b87567]
  - @mastra/core@0.1.27-alpha.74
  - @mastra/firecrawl@1.0.4-alpha.65
  - @mastra/github@1.0.3-alpha.58
  - @mastra/stabilityai@1.0.1-alpha.49
  - @mastra/engine@0.0.5-alpha.69
  - @mastra/mcp@0.0.1-alpha.16
  - @mastra/memory@0.0.2-alpha.55
  - @mastra/rag@0.0.2-alpha.63

## 0.0.2-alpha.87

### Patch Changes

- Updated dependencies [3427b95]
  - @mastra/core@0.1.27-alpha.73
  - @mastra/firecrawl@1.0.4-alpha.64
  - @mastra/github@1.0.3-alpha.57
  - @mastra/stabilityai@1.0.1-alpha.48
  - @mastra/engine@0.0.5-alpha.68
  - @mastra/mcp@0.0.1-alpha.15
  - @mastra/memory@0.0.2-alpha.54
  - @mastra/rag@0.0.2-alpha.62

## 0.0.2-alpha.86

### Patch Changes

- Updated dependencies [e4d4ede]
- Updated dependencies [06b2c0a]
  - @mastra/core@0.1.27-alpha.72
  - @mastra/firecrawl@1.0.4-alpha.63
  - @mastra/github@1.0.3-alpha.56
  - @mastra/stabilityai@1.0.1-alpha.47
  - @mastra/engine@0.0.5-alpha.67
  - @mastra/mcp@0.0.1-alpha.14
  - @mastra/memory@0.0.2-alpha.53
  - @mastra/rag@0.0.2-alpha.61

## 0.0.2-alpha.84

### Patch Changes

- Updated dependencies [d9c8dd0]
  - @mastra/core@0.1.27-alpha.71
  - @mastra/firecrawl@1.0.4-alpha.62
  - @mastra/github@1.0.3-alpha.55
  - @mastra/stabilityai@1.0.1-alpha.46
  - @mastra/engine@0.0.5-alpha.66
  - @mastra/mcp@0.0.1-alpha.13
  - @mastra/memory@0.0.2-alpha.52
  - @mastra/rag@0.0.2-alpha.60

## 0.0.2-alpha.80

### Patch Changes

- Updated dependencies [bdaf834]
  - @mastra/engine@0.0.5-alpha.65
  - @mastra/mcp@0.0.1-alpha.12
  - @mastra/memory@0.0.2-alpha.51
  - @mastra/rag@0.0.2-alpha.59
  - @mastra/firecrawl@1.0.4-alpha.61

## 0.0.2-alpha.79

### Patch Changes

- Updated dependencies [dd6d87f]
- Updated dependencies [04434b6]
  - @mastra/core@0.1.27-alpha.70
  - @mastra/firecrawl@1.0.4-alpha.60
  - @mastra/github@1.0.3-alpha.54
  - @mastra/stabilityai@1.0.1-alpha.45
  - @mastra/engine@0.0.5-alpha.64
  - @mastra/mcp@0.0.1-alpha.11
  - @mastra/memory@0.0.2-alpha.50
  - @mastra/rag@0.0.2-alpha.58

## 0.0.2-alpha.77

### Patch Changes

- 0d5a03d: Vector store modules
- Updated dependencies [ab1dc59]
- Updated dependencies [0d5a03d]
- Updated dependencies [4769753]
  - @mastra/rag@0.0.2-alpha.57
  - @mastra/mcp@0.0.1-alpha.10
  - @mastra/firecrawl@1.0.4-alpha.59

## 0.0.2-alpha.76

### Patch Changes

- Updated dependencies [ee856f3]
- Updated dependencies [c3047a7]
  - @mastra/rag@0.0.2-alpha.56
  - @mastra/firecrawl@1.0.4-alpha.58

## 0.0.2-alpha.75

### Patch Changes

- Updated dependencies [1944807]
- Updated dependencies [9ade36e]
  - @mastra/core@0.1.27-alpha.69
  - @mastra/rag@0.0.2-alpha.55
  - @mastra/firecrawl@1.0.4-alpha.57
  - @mastra/github@1.0.3-alpha.53
  - @mastra/stabilityai@1.0.1-alpha.44
  - @mastra/engine@0.0.5-alpha.63
  - @mastra/mcp@0.0.1-alpha.9
  - @mastra/memory@0.0.2-alpha.49

## 0.0.2-alpha.74

### Patch Changes

- ef09ea1: Fix dane

## 0.0.2-alpha.72

### Patch Changes

- Updated dependencies [0be7181]
- Updated dependencies [0be7181]
  - @mastra/core@0.1.27-alpha.68
  - @mastra/firecrawl@1.0.4-alpha.56
  - @mastra/github@1.0.3-alpha.52
  - @mastra/stabilityai@1.0.1-alpha.43
  - @mastra/engine@0.0.5-alpha.62
  - @mastra/mcp@0.0.1-alpha.8
  - @mastra/memory@0.0.2-alpha.48
  - @mastra/rag@0.0.2-alpha.54

## 0.0.2-alpha.70

### Patch Changes

- Updated dependencies [c8ff2f5]
  - @mastra/core@0.1.27-alpha.67
  - @mastra/firecrawl@1.0.4-alpha.55
  - @mastra/github@1.0.3-alpha.51
  - @mastra/stabilityai@1.0.1-alpha.42
  - @mastra/engine@0.0.5-alpha.61
  - @mastra/mcp@0.0.1-alpha.7
  - @mastra/memory@0.0.2-alpha.47
  - @mastra/rag@0.0.2-alpha.53

## 0.0.2-alpha.65

### Patch Changes

- Updated dependencies [14064f2]
  - @mastra/core@0.1.27-alpha.66
  - @mastra/firecrawl@1.0.4-alpha.54
  - @mastra/github@1.0.3-alpha.50
  - @mastra/stabilityai@1.0.1-alpha.41
  - @mastra/engine@0.0.5-alpha.60
  - @mastra/mcp@0.0.1-alpha.6
  - @mastra/memory@0.0.2-alpha.46
  - @mastra/rag@0.0.2-alpha.52

## 0.0.2-alpha.64

### Patch Changes

- Updated dependencies [e66643a]
  - @mastra/core@0.1.27-alpha.65
  - @mastra/firecrawl@1.0.4-alpha.53
  - @mastra/github@1.0.3-alpha.49
  - @mastra/stabilityai@1.0.1-alpha.40
  - @mastra/engine@0.0.5-alpha.59
  - @mastra/mcp@0.0.1-alpha.5
  - @mastra/memory@0.0.2-alpha.45
  - @mastra/rag@0.0.2-alpha.51

## 0.0.2-alpha.63

### Patch Changes

- Updated dependencies [1616f70]
  - @mastra/rag@0.0.2-alpha.50
  - @mastra/firecrawl@1.0.4-alpha.52

## 0.0.2-alpha.60

### Patch Changes

- 75d08a3: Iteration

## 0.0.2-alpha.59

### Patch Changes

- a4db688: Dane changes

## 0.0.2-alpha.58

### Patch Changes

- Updated dependencies [f368477]
- Updated dependencies [d5ec619]
  - @mastra/core@0.1.27-alpha.64
  - @mastra/firecrawl@1.0.4-alpha.51
  - @mastra/github@1.0.3-alpha.48
  - @mastra/stabilityai@1.0.1-alpha.39
  - @mastra/engine@0.0.5-alpha.58
  - @mastra/memory@0.0.2-alpha.44
  - @mastra/rag@0.0.2-alpha.49
