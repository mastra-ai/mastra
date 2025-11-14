# @mastra/deployer-netlify

## 1.0.0-beta.0

### Major Changes

- Moving scorers under the eval domain, api method consistency, prebuilt evals, scorers require ids. ([#9589](https://github.com/mastra-ai/mastra/pull/9589))

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- Mark as stable ([`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc))

- Remove legacy evals from Mastra ([#9491](https://github.com/mastra-ai/mastra/pull/9491))

### Minor Changes

- Update peer dependencies to match core package version bump (1.0.0) ([#9491](https://github.com/mastra-ai/mastra/pull/9491))

### Patch Changes

- Do not apply ESM shim to output as Netlify should handle this already ([#9239](https://github.com/mastra-ai/mastra/pull/9239))

- Update peer dependencies to match core package version bump (1.0.0) ([#9237](https://github.com/mastra-ai/mastra/pull/9237))

- Updated dependencies [[`77ff370`](https://github.com/mastra-ai/mastra/commit/77ff370186ba77955620c465fd2e95360e1947ea), [`39c9743`](https://github.com/mastra-ai/mastra/commit/39c97432d084294f8ba85fbf3ef28098ff21459e), [`f743dbb`](https://github.com/mastra-ai/mastra/commit/f743dbb8b40d1627b5c10c0e6fc154f4ebb6e394), [`3852192`](https://github.com/mastra-ai/mastra/commit/3852192c81b2a4f1f883f17d80ce50e0c60dba55), [`fec5129`](https://github.com/mastra-ai/mastra/commit/fec5129de7fc64423ea03661a56cef31dc747a0d), [`5540775`](https://github.com/mastra-ai/mastra/commit/5540775f68685e19ddb6972ad73297f117656f59), [`0491e7c`](https://github.com/mastra-ai/mastra/commit/0491e7c9b714cb0ba22187ee062147ec2dd7c712), [`f6f4903`](https://github.com/mastra-ai/mastra/commit/f6f4903397314f73362061dc5a3e8e7c61ea34aa), [`0e8ed46`](https://github.com/mastra-ai/mastra/commit/0e8ed467c54d6901a6a365f270ec15d6faadb36c), [`6c049d9`](https://github.com/mastra-ai/mastra/commit/6c049d94063fdcbd5b81c4912a2bf82a92c9cc0b), [`2f897df`](https://github.com/mastra-ai/mastra/commit/2f897df208508f46f51b7625e5dd20c37f93e0e3), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`3443770`](https://github.com/mastra-ai/mastra/commit/3443770662df8eb24c9df3589b2792d78cfcb811), [`f0a07e0`](https://github.com/mastra-ai/mastra/commit/f0a07e0111b3307c5fabfa4094c5c2cfb734fbe6), [`aaa40e7`](https://github.com/mastra-ai/mastra/commit/aaa40e788628b319baa8e889407d11ad626547fa), [`1521d71`](https://github.com/mastra-ai/mastra/commit/1521d716e5daedc74690c983fbd961123c56756b), [`9e1911d`](https://github.com/mastra-ai/mastra/commit/9e1911db2b4db85e0e768c3f15e0d61e319869f6), [`ebac155`](https://github.com/mastra-ai/mastra/commit/ebac15564a590117db7078233f927a7e28a85106), [`dd1c38d`](https://github.com/mastra-ai/mastra/commit/dd1c38d1b75f1b695c27b40d8d9d6ed00d5e0f6f), [`5948e6a`](https://github.com/mastra-ai/mastra/commit/5948e6a5146c83666ba3f294b2be576c82a513fb), [`2ef1f3c`](https://github.com/mastra-ai/mastra/commit/2ef1f3cc1f9785998197571478821326b2a528ee), [`8940859`](https://github.com/mastra-ai/mastra/commit/89408593658199b4ad67f7b65e888f344e64a442), [`e629310`](https://github.com/mastra-ai/mastra/commit/e629310f1a73fa236d49ec7a1d1cceb6229dc7cc), [`5df9cce`](https://github.com/mastra-ai/mastra/commit/5df9cce1a753438413f64c11eeef8f845745c2a8), [`4c6b492`](https://github.com/mastra-ai/mastra/commit/4c6b492c4dd591c6a592520c1f6855d6e936d71f), [`dff01d8`](https://github.com/mastra-ai/mastra/commit/dff01d81ce1f4e4087cfac20fa868e6db138dd14), [`9d819d5`](https://github.com/mastra-ai/mastra/commit/9d819d54b61481639f4008e4694791bddf187edd), [`b7de533`](https://github.com/mastra-ai/mastra/commit/b7de53361667eb51fefd89fcaed924f3c57cee8d), [`71c8d6c`](https://github.com/mastra-ai/mastra/commit/71c8d6c161253207b2b9588bdadb7eed604f7253), [`6179a9b`](https://github.com/mastra-ai/mastra/commit/6179a9ba36ffac326de3cc3c43cdc8028d37c251), [`00f4921`](https://github.com/mastra-ai/mastra/commit/00f4921dd2c91a1e5446799599ef7116a8214a1a), [`ca8041c`](https://github.com/mastra-ai/mastra/commit/ca8041cce0379fda22ed293a565bcb5b6ddca68a), [`7051bf3`](https://github.com/mastra-ai/mastra/commit/7051bf38b3b122a069008f861f7bfc004a6d9f6e), [`a8f1494`](https://github.com/mastra-ai/mastra/commit/a8f1494f4bbdc2770bcf327d4c7d869e332183f1), [`0793497`](https://github.com/mastra-ai/mastra/commit/079349753620c40246ffd673e3f9d7d9820beff3), [`5df9cce`](https://github.com/mastra-ai/mastra/commit/5df9cce1a753438413f64c11eeef8f845745c2a8), [`a854ede`](https://github.com/mastra-ai/mastra/commit/a854ede62bf5ac0945a624ac48913dd69c73aabf), [`c576fc0`](https://github.com/mastra-ai/mastra/commit/c576fc0b100b2085afded91a37c97a0ea0ec09c7), [`3defc80`](https://github.com/mastra-ai/mastra/commit/3defc80cf2b88a1b7fc1cc4ddcb91e982a614609), [`16153fe`](https://github.com/mastra-ai/mastra/commit/16153fe7eb13c99401f48e6ca32707c965ee28b9), [`9f4a683`](https://github.com/mastra-ai/mastra/commit/9f4a6833e88b52574665c028fd5508ad5c2f6004), [`bc94344`](https://github.com/mastra-ai/mastra/commit/bc943444a1342d8a662151b7bce1df7dae32f59c), [`87f9f96`](https://github.com/mastra-ai/mastra/commit/87f9f96c772117fb868c9ea17a9eda664d41a35e), [`57d157f`](https://github.com/mastra-ai/mastra/commit/57d157f0b163a95c3e6c9eae31bdb11d1bfc64f9), [`903f67d`](https://github.com/mastra-ai/mastra/commit/903f67d184504a273893818c02b961f5423a79ad), [`2a90c55`](https://github.com/mastra-ai/mastra/commit/2a90c55a86a9210697d5adaab5ee94584b079adc), [`eb09742`](https://github.com/mastra-ai/mastra/commit/eb09742197f66c4c38154c3beec78313e69760b2), [`9e0a85d`](https://github.com/mastra-ai/mastra/commit/9e0a85d11d02ca5918463ab5c2ec55d4eebf3769), [`96d35f6`](https://github.com/mastra-ai/mastra/commit/96d35f61376bc2b1bf148648a2c1985bd51bef55), [`5cbe88a`](https://github.com/mastra-ai/mastra/commit/5cbe88aefbd9f933bca669fd371ea36bf939ac6d), [`a1bd7b8`](https://github.com/mastra-ai/mastra/commit/a1bd7b8571db16b94eb01588f451a74758c96d65), [`d78b38d`](https://github.com/mastra-ai/mastra/commit/d78b38d898fce285260d3bbb4befade54331617f), [`e41f852`](https://github.com/mastra-ai/mastra/commit/e41f852a3068be9c65818d9ab2218bae06ed0237), [`c576fc0`](https://github.com/mastra-ai/mastra/commit/c576fc0b100b2085afded91a37c97a0ea0ec09c7), [`0633100`](https://github.com/mastra-ai/mastra/commit/0633100a911ad22f5256471bdf753da21c104742), [`c710c16`](https://github.com/mastra-ai/mastra/commit/c710c1652dccfdc4111c8412bca7a6bb1d48b441), [`354ad0b`](https://github.com/mastra-ai/mastra/commit/354ad0b7b1b8183ac567f236a884fc7ede6d7138), [`cfae733`](https://github.com/mastra-ai/mastra/commit/cfae73394f4920635e6c919c8e95ff9a0788e2e5), [`e3dfda7`](https://github.com/mastra-ai/mastra/commit/e3dfda7b11bf3b8c4bb55637028befb5f387fc74), [`844ea5d`](https://github.com/mastra-ai/mastra/commit/844ea5dc0c248961e7bf73629ae7dcff503e853c), [`398fde3`](https://github.com/mastra-ai/mastra/commit/398fde3f39e707cda79372cdae8f9870e3b57c8d), [`dfe3f8c`](https://github.com/mastra-ai/mastra/commit/dfe3f8c7376ffe159236819e19ca522143c1f972), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`0d7618b`](https://github.com/mastra-ai/mastra/commit/0d7618bc650bf2800934b243eca5648f4aeed9c2), [`7b763e5`](https://github.com/mastra-ai/mastra/commit/7b763e52fc3eaf699c2a99f2adf418dd46e4e9a5), [`d36cfbb`](https://github.com/mastra-ai/mastra/commit/d36cfbbb6565ba5f827883cc9bb648eb14befdc1), [`3697853`](https://github.com/mastra-ai/mastra/commit/3697853deeb72017d90e0f38a93c1e29221aeca0), [`c23200d`](https://github.com/mastra-ai/mastra/commit/c23200ddfd60830effb39329674ba4ca93be6aac), [`b2e45ec`](https://github.com/mastra-ai/mastra/commit/b2e45eca727a8db01a81ba93f1a5219c7183c839), [`d6d49f7`](https://github.com/mastra-ai/mastra/commit/d6d49f7b8714fa19a52ff9c7cf7fb7e73751901e), [`a534e95`](https://github.com/mastra-ai/mastra/commit/a534e9591f83b3cc1ebff99c67edf4cda7bf81d3), [`9d0e7fe`](https://github.com/mastra-ai/mastra/commit/9d0e7feca8ed98de959f53476ee1456073673348), [`53d927c`](https://github.com/mastra-ai/mastra/commit/53d927cc6f03bff33655b7e2b788da445a08731d), [`3f2faf2`](https://github.com/mastra-ai/mastra/commit/3f2faf2e2d685d6c053cc5af1bf9fedf267b2ce5), [`22f64bc`](https://github.com/mastra-ai/mastra/commit/22f64bc1d37149480b58bf2fefe35b79a1e3e7d5), [`363284b`](https://github.com/mastra-ai/mastra/commit/363284bb974e850f06f40f89a28c79d9f432d7e4), [`6c7ffcd`](https://github.com/mastra-ai/mastra/commit/6c7ffcdf9a5b0a4435eb3f934c22c05b9e2fedb3), [`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc), [`b7959e6`](https://github.com/mastra-ai/mastra/commit/b7959e6e25a46b480f9ea2217c4c6c588c423791), [`bda6370`](https://github.com/mastra-ai/mastra/commit/bda637009360649aaf579919e7873e33553c273e), [`d7acd8e`](https://github.com/mastra-ai/mastra/commit/d7acd8e987b5d7eff4fd98b0906c17c06a2e83d5), [`056d075`](https://github.com/mastra-ai/mastra/commit/056d075598761a47c4f6f48c0ba8f793ca915c7f), [`c7f1f7d`](https://github.com/mastra-ai/mastra/commit/c7f1f7d24f61f247f018cc2d1f33bf63212959a7), [`0bddc6d`](https://github.com/mastra-ai/mastra/commit/0bddc6d8dbd6f6008c0cba2e4960a2da75a55af1), [`4a8cade`](https://github.com/mastra-ai/mastra/commit/4a8cade69b4616da04d78e6f76649b52d843997e), [`735d8c1`](https://github.com/mastra-ai/mastra/commit/735d8c1c0d19fbc09e6f8b66cf41bc7655993838), [`acf322e`](https://github.com/mastra-ai/mastra/commit/acf322e0f1fd0189684cf529d91c694bea918a45), [`c942802`](https://github.com/mastra-ai/mastra/commit/c942802a477a925b01859a7b8688d4355715caaa), [`a0c8c1b`](https://github.com/mastra-ai/mastra/commit/a0c8c1b87d4fee252aebda73e8637fbe01d761c9), [`cc34739`](https://github.com/mastra-ai/mastra/commit/cc34739c34b6266a91bea561119240a7acf47887), [`c218bd3`](https://github.com/mastra-ai/mastra/commit/c218bd3759e32423735b04843a09404572631014), [`2c4438b`](https://github.com/mastra-ai/mastra/commit/2c4438b87817ab7eed818c7990fef010475af1a3), [`2b8893c`](https://github.com/mastra-ai/mastra/commit/2b8893cb108ef9acb72ee7835cd625610d2c1a4a), [`8e5c75b`](https://github.com/mastra-ai/mastra/commit/8e5c75bdb1d08a42d45309a4c72def4b6890230f), [`e59e0d3`](https://github.com/mastra-ai/mastra/commit/e59e0d32afb5fcf2c9f3c00c8f81f6c21d3a63fa), [`fa8409b`](https://github.com/mastra-ai/mastra/commit/fa8409bc39cfd8ba6643b9db5269b90b22e2a2f7), [`173c535`](https://github.com/mastra-ai/mastra/commit/173c535c0645b0da404fe09f003778f0b0d4e019), [`1176e03`](https://github.com/mastra-ai/mastra/commit/1176e03a0db4b8f5b0a85afbaf45d3cc7ab2d94a)]:
  - @mastra/deployer@1.0.0-beta.0
  - @mastra/core@1.0.0-beta.0

## 0.13.12

### Patch Changes

- Updated dependencies [[`2b031e2`](https://github.com/mastra-ai/mastra/commit/2b031e25ca10cd3e4d63e6a27f909cba26d91405)]:
  - @mastra/core@0.22.2
  - @mastra/deployer@0.22.2

## 0.13.12-alpha.0

### Patch Changes

- Updated dependencies [[`2b031e2`](https://github.com/mastra-ai/mastra/commit/2b031e25ca10cd3e4d63e6a27f909cba26d91405)]:
  - @mastra/core@0.22.2-alpha.0
  - @mastra/deployer@0.22.2-alpha.0

## 0.13.11

### Patch Changes

- Updated dependencies [[`69ff5d5`](https://github.com/mastra-ai/mastra/commit/69ff5d58e4bc4054ce76bbb25a8fa5d3177c49ea)]:
  - @mastra/deployer@0.22.1
  - @mastra/core@0.22.1

## 0.13.11-alpha.0

### Patch Changes

- Updated dependencies [[`69ff5d5`](https://github.com/mastra-ai/mastra/commit/69ff5d58e4bc4054ce76bbb25a8fa5d3177c49ea)]:
  - @mastra/deployer@0.22.1-alpha.0
  - @mastra/core@0.22.1-alpha.0

## 0.13.10

### Patch Changes

- Update peerdeps to 0.23.0-0 ([#9043](https://github.com/mastra-ai/mastra/pull/9043))

- Updated dependencies [[`25305a2`](https://github.com/mastra-ai/mastra/commit/25305a2af1acf77cc2ac9237774ecd7d3caa31a1), [`c67ca32`](https://github.com/mastra-ai/mastra/commit/c67ca32e3c2cf69bfc146580770c720220ca44ac), [`efb5ed9`](https://github.com/mastra-ai/mastra/commit/efb5ed946ae7f410bc68c9430beb4b010afd25ec), [`dbc9e12`](https://github.com/mastra-ai/mastra/commit/dbc9e1216ba575ba59ead4afb727a01215f7de4f), [`99e41b9`](https://github.com/mastra-ai/mastra/commit/99e41b94957cdd25137d3ac12e94e8b21aa01b68), [`c28833c`](https://github.com/mastra-ai/mastra/commit/c28833c5b6d8e10eeffd7f7d39129d53b8bca240), [`8ea07b4`](https://github.com/mastra-ai/mastra/commit/8ea07b4bdc73e4218437dbb6dcb0f4b23e745a44), [`ba201b8`](https://github.com/mastra-ai/mastra/commit/ba201b8f8feac4c72350f2dbd52c13c7297ba7b0), [`f053e89`](https://github.com/mastra-ai/mastra/commit/f053e89160dbd0bd3333fc3492f68231b5c7c349), [`4fc4136`](https://github.com/mastra-ai/mastra/commit/4fc413652866a8d2240694fddb2562e9edbb70df), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`d10baf5`](https://github.com/mastra-ai/mastra/commit/d10baf5a3c924f2a6654e23a3e318ed03f189b76), [`038c55a`](https://github.com/mastra-ai/mastra/commit/038c55a7090fc1b1513a966386d3072617f836ac), [`1eb156a`](https://github.com/mastra-ai/mastra/commit/1eb156ace499b34ab48bf23fb16f1affe6bb9c1c), [`182f045`](https://github.com/mastra-ai/mastra/commit/182f0458f25bd70aa774e64fd923c8a483eddbf1), [`9a1a485`](https://github.com/mastra-ai/mastra/commit/9a1a4859b855e37239f652bf14b1ecd1029b8c4e), [`9257233`](https://github.com/mastra-ai/mastra/commit/9257233c4ffce09b2bedc2a9adbd70d7a83fa8e2), [`7620d2b`](https://github.com/mastra-ai/mastra/commit/7620d2bddeb4fae4c3c0a0b4e672969795fca11a), [`b2365f0`](https://github.com/mastra-ai/mastra/commit/b2365f038dd4c5f06400428b224af963f399ad50), [`0f1a4c9`](https://github.com/mastra-ai/mastra/commit/0f1a4c984fb4b104b2f0b63ba18c9fa77f567700), [`9029ba3`](https://github.com/mastra-ai/mastra/commit/9029ba34459c8859fed4c6b73efd8e2d0021e7ba), [`426cc56`](https://github.com/mastra-ai/mastra/commit/426cc561c85ae76a112ded2385532a91f9f9f074), [`00931fb`](https://github.com/mastra-ai/mastra/commit/00931fb1a21aa42c4fbc20c2c40dd62466b8fc8f), [`e473bfe`](https://github.com/mastra-ai/mastra/commit/e473bfe416c0b8e876973c2b6a6f13c394b7a93f), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`8ea07b4`](https://github.com/mastra-ai/mastra/commit/8ea07b4bdc73e4218437dbb6dcb0f4b23e745a44), [`084afad`](https://github.com/mastra-ai/mastra/commit/084afadff49b168d8b6104b43c77cecc96c48ac2), [`2db6160`](https://github.com/mastra-ai/mastra/commit/2db6160e2022ff8827c15d30157e684683b934b5), [`8aeea37`](https://github.com/mastra-ai/mastra/commit/8aeea37efdde347c635a67fed56794943b7f74ec), [`02fe153`](https://github.com/mastra-ai/mastra/commit/02fe15351d6021d214da48ec982a0e9e4150bcee), [`648e2ca`](https://github.com/mastra-ai/mastra/commit/648e2ca42da54838c6ccbdaadc6fadd808fa6b86), [`74567b3`](https://github.com/mastra-ai/mastra/commit/74567b3d237ae3915cd0bca3cf55fa0a64e4e4a4), [`b65c5e0`](https://github.com/mastra-ai/mastra/commit/b65c5e0fe6f3c390a9a8bbcf69304d972c3a4afb), [`15a1733`](https://github.com/mastra-ai/mastra/commit/15a1733074cee8bd37370e1af34cd818e89fa7ac), [`fc2a774`](https://github.com/mastra-ai/mastra/commit/fc2a77468981aaddc3e77f83f0c4ad4a4af140da), [`4e08933`](https://github.com/mastra-ai/mastra/commit/4e08933625464dfde178347af5b6278fcf34188e), [`10188d6`](https://github.com/mastra-ai/mastra/commit/10188d632a729010441f9c7e2a41eab60afccb23)]:
  - @mastra/deployer@0.22.0
  - @mastra/core@0.22.0

## 0.13.10-alpha.1

### Patch Changes

- Update peerdeps to 0.23.0-0 ([#9043](https://github.com/mastra-ai/mastra/pull/9043))

- Updated dependencies [[`25305a2`](https://github.com/mastra-ai/mastra/commit/25305a2af1acf77cc2ac9237774ecd7d3caa31a1), [`efb5ed9`](https://github.com/mastra-ai/mastra/commit/efb5ed946ae7f410bc68c9430beb4b010afd25ec), [`8ea07b4`](https://github.com/mastra-ai/mastra/commit/8ea07b4bdc73e4218437dbb6dcb0f4b23e745a44), [`ba201b8`](https://github.com/mastra-ai/mastra/commit/ba201b8f8feac4c72350f2dbd52c13c7297ba7b0), [`4fc4136`](https://github.com/mastra-ai/mastra/commit/4fc413652866a8d2240694fddb2562e9edbb70df), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`d10baf5`](https://github.com/mastra-ai/mastra/commit/d10baf5a3c924f2a6654e23a3e318ed03f189b76), [`038c55a`](https://github.com/mastra-ai/mastra/commit/038c55a7090fc1b1513a966386d3072617f836ac), [`182f045`](https://github.com/mastra-ai/mastra/commit/182f0458f25bd70aa774e64fd923c8a483eddbf1), [`7620d2b`](https://github.com/mastra-ai/mastra/commit/7620d2bddeb4fae4c3c0a0b4e672969795fca11a), [`b2365f0`](https://github.com/mastra-ai/mastra/commit/b2365f038dd4c5f06400428b224af963f399ad50), [`9029ba3`](https://github.com/mastra-ai/mastra/commit/9029ba34459c8859fed4c6b73efd8e2d0021e7ba), [`426cc56`](https://github.com/mastra-ai/mastra/commit/426cc561c85ae76a112ded2385532a91f9f9f074), [`00931fb`](https://github.com/mastra-ai/mastra/commit/00931fb1a21aa42c4fbc20c2c40dd62466b8fc8f), [`e473bfe`](https://github.com/mastra-ai/mastra/commit/e473bfe416c0b8e876973c2b6a6f13c394b7a93f), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`8ea07b4`](https://github.com/mastra-ai/mastra/commit/8ea07b4bdc73e4218437dbb6dcb0f4b23e745a44), [`084afad`](https://github.com/mastra-ai/mastra/commit/084afadff49b168d8b6104b43c77cecc96c48ac2), [`648e2ca`](https://github.com/mastra-ai/mastra/commit/648e2ca42da54838c6ccbdaadc6fadd808fa6b86), [`b65c5e0`](https://github.com/mastra-ai/mastra/commit/b65c5e0fe6f3c390a9a8bbcf69304d972c3a4afb), [`10188d6`](https://github.com/mastra-ai/mastra/commit/10188d632a729010441f9c7e2a41eab60afccb23)]:
  - @mastra/deployer@0.22.0-alpha.1
  - @mastra/core@0.22.0-alpha.1

## 0.13.10-alpha.0

### Patch Changes

- Updated dependencies [[`c67ca32`](https://github.com/mastra-ai/mastra/commit/c67ca32e3c2cf69bfc146580770c720220ca44ac), [`dbc9e12`](https://github.com/mastra-ai/mastra/commit/dbc9e1216ba575ba59ead4afb727a01215f7de4f), [`99e41b9`](https://github.com/mastra-ai/mastra/commit/99e41b94957cdd25137d3ac12e94e8b21aa01b68), [`c28833c`](https://github.com/mastra-ai/mastra/commit/c28833c5b6d8e10eeffd7f7d39129d53b8bca240), [`f053e89`](https://github.com/mastra-ai/mastra/commit/f053e89160dbd0bd3333fc3492f68231b5c7c349), [`1eb156a`](https://github.com/mastra-ai/mastra/commit/1eb156ace499b34ab48bf23fb16f1affe6bb9c1c), [`9a1a485`](https://github.com/mastra-ai/mastra/commit/9a1a4859b855e37239f652bf14b1ecd1029b8c4e), [`9257233`](https://github.com/mastra-ai/mastra/commit/9257233c4ffce09b2bedc2a9adbd70d7a83fa8e2), [`0f1a4c9`](https://github.com/mastra-ai/mastra/commit/0f1a4c984fb4b104b2f0b63ba18c9fa77f567700), [`2db6160`](https://github.com/mastra-ai/mastra/commit/2db6160e2022ff8827c15d30157e684683b934b5), [`8aeea37`](https://github.com/mastra-ai/mastra/commit/8aeea37efdde347c635a67fed56794943b7f74ec), [`02fe153`](https://github.com/mastra-ai/mastra/commit/02fe15351d6021d214da48ec982a0e9e4150bcee), [`74567b3`](https://github.com/mastra-ai/mastra/commit/74567b3d237ae3915cd0bca3cf55fa0a64e4e4a4), [`15a1733`](https://github.com/mastra-ai/mastra/commit/15a1733074cee8bd37370e1af34cd818e89fa7ac), [`fc2a774`](https://github.com/mastra-ai/mastra/commit/fc2a77468981aaddc3e77f83f0c4ad4a4af140da), [`4e08933`](https://github.com/mastra-ai/mastra/commit/4e08933625464dfde178347af5b6278fcf34188e)]:
  - @mastra/core@0.21.2-alpha.0
  - @mastra/deployer@0.21.2-alpha.0

## 0.13.9

### Patch Changes

- Pin `@rollup/*` dependencies to fixed versions (instead of using `^`) to: ([#8900](https://github.com/mastra-ai/mastra/pull/8900))
  - Hotfix a bug inside `@rollup/plugin-commonjs`
  - Have more control over the versions in the future to not have breakages over night

- Updated dependencies [[`5253cd2`](https://github.com/mastra-ai/mastra/commit/5253cd2d5b2cf4558963fa73c6a6b36c72f8875f), [`ca85c93`](https://github.com/mastra-ai/mastra/commit/ca85c932b232e6ad820c811ec176d98e68c59b0a), [`a1d40f8`](https://github.com/mastra-ai/mastra/commit/a1d40f88d4ce42c4508774ad22e38ac582157af2), [`11e9e8f`](https://github.com/mastra-ai/mastra/commit/11e9e8f4fb09a493ea00deda49081788f16e753b), [`00bf52b`](https://github.com/mastra-ai/mastra/commit/00bf52b89a93e6bffaaaf1714316870ad8af6572), [`01c4a25`](https://github.com/mastra-ai/mastra/commit/01c4a2506c514d5e861c004d3d2fb3791c6391f3), [`cce8aad`](https://github.com/mastra-ai/mastra/commit/cce8aad878a0dd98e5647680f3765caba0b1701c)]:
  - @mastra/deployer@0.21.1
  - @mastra/core@0.21.1

## 0.13.9-alpha.0

### Patch Changes

- Pin `@rollup/*` dependencies to fixed versions (instead of using `^`) to: ([#8900](https://github.com/mastra-ai/mastra/pull/8900))
  - Hotfix a bug inside `@rollup/plugin-commonjs`
  - Have more control over the versions in the future to not have breakages over night

- Updated dependencies [[`5253cd2`](https://github.com/mastra-ai/mastra/commit/5253cd2d5b2cf4558963fa73c6a6b36c72f8875f), [`ca85c93`](https://github.com/mastra-ai/mastra/commit/ca85c932b232e6ad820c811ec176d98e68c59b0a), [`a1d40f8`](https://github.com/mastra-ai/mastra/commit/a1d40f88d4ce42c4508774ad22e38ac582157af2), [`11e9e8f`](https://github.com/mastra-ai/mastra/commit/11e9e8f4fb09a493ea00deda49081788f16e753b), [`00bf52b`](https://github.com/mastra-ai/mastra/commit/00bf52b89a93e6bffaaaf1714316870ad8af6572), [`01c4a25`](https://github.com/mastra-ai/mastra/commit/01c4a2506c514d5e861c004d3d2fb3791c6391f3), [`cce8aad`](https://github.com/mastra-ai/mastra/commit/cce8aad878a0dd98e5647680f3765caba0b1701c)]:
  - @mastra/deployer@0.21.1-alpha.0
  - @mastra/core@0.21.1-alpha.0

## 0.13.8

### Patch Changes

- Update peer dependencies to match core package version bump (0.21.0) ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

- Update peer dependencies to match core package version bump (0.21.0) ([#8557](https://github.com/mastra-ai/mastra/pull/8557))

- Update peer dependencies to match core package version bump (0.21.0) ([#8626](https://github.com/mastra-ai/mastra/pull/8626))

- Update peer dependencies to match core package version bump (0.21.0) ([#8686](https://github.com/mastra-ai/mastra/pull/8686))

- Updated dependencies [[`0fb6616`](https://github.com/mastra-ai/mastra/commit/0fb66169600ed2a3dc1297b1bfa8a7693ebb6e3c), [`1ed9670`](https://github.com/mastra-ai/mastra/commit/1ed9670d3ca50cb60dc2e517738c5eef3968ed27), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`1dbd76a`](https://github.com/mastra-ai/mastra/commit/1dbd76aff29cc764d3a1ac7bb01172fe59cb5992), [`f59fc1e`](https://github.com/mastra-ai/mastra/commit/f59fc1e406b8912e692f6bff6cfd4754cc8d165c), [`ca5a01f`](https://github.com/mastra-ai/mastra/commit/ca5a01f0dd4dabdbfde3beeaf92c7333e0f9bb39), [`158381d`](https://github.com/mastra-ai/mastra/commit/158381d39335be934b81ef8a1947bccace492c25), [`a1799bc`](https://github.com/mastra-ai/mastra/commit/a1799bcc1b5a1cdc188f2ac0165f17a1c4ac6f7b), [`6ff6094`](https://github.com/mastra-ai/mastra/commit/6ff60946f4ecfebdeef6e21d2b230c2204f2c9b8), [`2ddb851`](https://github.com/mastra-ai/mastra/commit/2ddb8519c4b6f1d31be10ffd33b41d2b649a04ff), [`fb703b9`](https://github.com/mastra-ai/mastra/commit/fb703b9634eeaff1a6eb2b5531ce0f9e8fb04727), [`dfe856f`](https://github.com/mastra-ai/mastra/commit/dfe856f7f60ff4765b75930e7b5d82dd0f0f7d89), [`37a2314`](https://github.com/mastra-ai/mastra/commit/37a23148e0e5a3b40d4f9f098b194671a8a49faf), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`05a9dee`](https://github.com/mastra-ai/mastra/commit/05a9dee3d355694d28847bfffb6289657fcf7dfa), [`e3c1077`](https://github.com/mastra-ai/mastra/commit/e3c107763aedd1643d3def5df450c235da9ff76c), [`1908ca0`](https://github.com/mastra-ai/mastra/commit/1908ca0521f90e43779cc29ab590173ca560443c), [`1bccdb3`](https://github.com/mastra-ai/mastra/commit/1bccdb33eb90cbeba2dc5ece1c2561fb774b26b6), [`5ef944a`](https://github.com/mastra-ai/mastra/commit/5ef944a3721d93105675cac2b2311432ff8cc393), [`228228b`](https://github.com/mastra-ai/mastra/commit/228228b0b1de9291cb8887587f5cea1a8757ebad), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`d6b186f`](https://github.com/mastra-ai/mastra/commit/d6b186fb08f1caf1b86f73d3a5ee88fb999ca3be), [`ee68e82`](https://github.com/mastra-ai/mastra/commit/ee68e8289ea4408d29849e899bc6e78b3bd4e843), [`228228b`](https://github.com/mastra-ai/mastra/commit/228228b0b1de9291cb8887587f5cea1a8757ebad), [`ea33930`](https://github.com/mastra-ai/mastra/commit/ea339301e82d6318257720d811b043014ee44064), [`65493b3`](https://github.com/mastra-ai/mastra/commit/65493b31c36f6fdb78f9679f7e1ecf0c250aa5ee), [`a998b8f`](https://github.com/mastra-ai/mastra/commit/a998b8f858091c2ec47683e60766cf12d03001e4), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`8a37bdd`](https://github.com/mastra-ai/mastra/commit/8a37bddb6d8614a32c5b70303d583d80c620ea61), [`e0e1cf1`](https://github.com/mastra-ai/mastra/commit/e0e1cf1e37b9dc61099ab331a6d386e44b816310), [`135d6f2`](https://github.com/mastra-ai/mastra/commit/135d6f22a326ed1dffff858700669dff09d2c9eb)]:
  - @mastra/deployer@0.21.0
  - @mastra/core@0.21.0

## 0.13.8-alpha.0

### Patch Changes

- Update peer dependencies to match core package version bump (0.21.0) ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

- Update peer dependencies to match core package version bump (0.21.0) ([#8557](https://github.com/mastra-ai/mastra/pull/8557))

- Update peer dependencies to match core package version bump (0.21.0) ([#8626](https://github.com/mastra-ai/mastra/pull/8626))

- Update peer dependencies to match core package version bump (0.21.0) ([#8686](https://github.com/mastra-ai/mastra/pull/8686))

- Updated dependencies [[`0fb6616`](https://github.com/mastra-ai/mastra/commit/0fb66169600ed2a3dc1297b1bfa8a7693ebb6e3c), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`1dbd76a`](https://github.com/mastra-ai/mastra/commit/1dbd76aff29cc764d3a1ac7bb01172fe59cb5992), [`2ddb851`](https://github.com/mastra-ai/mastra/commit/2ddb8519c4b6f1d31be10ffd33b41d2b649a04ff), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`228228b`](https://github.com/mastra-ai/mastra/commit/228228b0b1de9291cb8887587f5cea1a8757ebad), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`ee68e82`](https://github.com/mastra-ai/mastra/commit/ee68e8289ea4408d29849e899bc6e78b3bd4e843), [`228228b`](https://github.com/mastra-ai/mastra/commit/228228b0b1de9291cb8887587f5cea1a8757ebad), [`ea33930`](https://github.com/mastra-ai/mastra/commit/ea339301e82d6318257720d811b043014ee44064), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`135d6f2`](https://github.com/mastra-ai/mastra/commit/135d6f22a326ed1dffff858700669dff09d2c9eb), [`59d036d`](https://github.com/mastra-ai/mastra/commit/59d036d4c2706b430b0e3f1f1e0ee853ce16ca04)]:
  - @mastra/deployer@0.21.0-alpha.0
  - @mastra/core@0.21.0-alpha.0

## 0.13.7

### Patch Changes

- Updated dependencies [[`07eaf25`](https://github.com/mastra-ai/mastra/commit/07eaf25aada9e42235dbf905854de53da4d8121b), [`0d71771`](https://github.com/mastra-ai/mastra/commit/0d71771f5711164c79f8e80919bc84d6bffeb6bc), [`0d6e55e`](https://github.com/mastra-ai/mastra/commit/0d6e55ecc5a2e689cd4fc9c86525e0eb54d82372), [`68b1111`](https://github.com/mastra-ai/mastra/commit/68b11118a1303f93e9c0c157850c0751309304c5)]:
  - @mastra/core@0.20.2
  - @mastra/deployer@0.20.2

## 0.13.7-alpha.0

### Patch Changes

- Updated dependencies [[`0d71771`](https://github.com/mastra-ai/mastra/commit/0d71771f5711164c79f8e80919bc84d6bffeb6bc), [`0d6e55e`](https://github.com/mastra-ai/mastra/commit/0d6e55ecc5a2e689cd4fc9c86525e0eb54d82372)]:
  - @mastra/core@0.20.2-alpha.0
  - @mastra/deployer@0.20.2-alpha.0

## 0.13.6

### Patch Changes

- Mutable shared workflow run state ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- Updated dependencies [[`c621613`](https://github.com/mastra-ai/mastra/commit/c621613069173c69eb2c3ef19a5308894c6549f0), [`ee17cec`](https://github.com/mastra-ai/mastra/commit/ee17cec065f4454740c9cc8f8a841027a5990f57), [`12b1189`](https://github.com/mastra-ai/mastra/commit/12b118942445e4de0dd916c593e33ec78dc3bc73), [`42ffed3`](https://github.com/mastra-ai/mastra/commit/42ffed311b9d8750652bbc55c773be62c989fcc6), [`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`076b092`](https://github.com/mastra-ai/mastra/commit/076b0924902ff0f49d5712d2df24c4cca683713f), [`2aee9e7`](https://github.com/mastra-ai/mastra/commit/2aee9e7d188b8b256a4ddc203ccefb366b4867fa), [`c582906`](https://github.com/mastra-ai/mastra/commit/c5829065a346260f96c4beb8af131b94804ae3ad), [`fa2eb96`](https://github.com/mastra-ai/mastra/commit/fa2eb96af16c7d433891a73932764960d3235c1d), [`ee9108f`](https://github.com/mastra-ai/mastra/commit/ee9108fa29bb8368fc23df158c9f0645b2d7b65c), [`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`a739d0c`](https://github.com/mastra-ai/mastra/commit/a739d0c8b37cd89569e04a6ca0827083c6167e19), [`a9c4cb7`](https://github.com/mastra-ai/mastra/commit/a9c4cb7d6a35de23ca51066f166a66e0e4cca418), [`603e927`](https://github.com/mastra-ai/mastra/commit/603e9279db8bf8a46caf83881c6b7389ccffff7e), [`cd45982`](https://github.com/mastra-ai/mastra/commit/cd4598291cda128a88738734ae6cbef076ebdebd), [`874f74d`](https://github.com/mastra-ai/mastra/commit/874f74da4b1acf6517f18132d035612c3ecc394a), [`b728a45`](https://github.com/mastra-ai/mastra/commit/b728a45ab3dba59da0f5ee36b81fe246659f305d), [`0baf2ba`](https://github.com/mastra-ai/mastra/commit/0baf2bab8420277072ef1f95df5ea7b0a2f61fe7), [`10e633a`](https://github.com/mastra-ai/mastra/commit/10e633a07d333466d9734c97acfc3dbf757ad2d0), [`a6d69c5`](https://github.com/mastra-ai/mastra/commit/a6d69c5fb50c0875b46275811fece5862f03c6a0), [`84199af`](https://github.com/mastra-ai/mastra/commit/84199af8673f6f9cb59286ffb5477a41932775de), [`7f431af`](https://github.com/mastra-ai/mastra/commit/7f431afd586b7d3265075e73106eb73167edbb86), [`26e968d`](https://github.com/mastra-ai/mastra/commit/26e968db2171ded9e4d47aa1b4f19e1e771158d0), [`cbd3fb6`](https://github.com/mastra-ai/mastra/commit/cbd3fb65adb03a7c0df193cb998aed5ac56675ee)]:
  - @mastra/core@0.20.1
  - @mastra/deployer@0.20.1

## 0.13.6-alpha.1

### Patch Changes

- Mutable shared workflow run state ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- Updated dependencies [[`c621613`](https://github.com/mastra-ai/mastra/commit/c621613069173c69eb2c3ef19a5308894c6549f0), [`ee17cec`](https://github.com/mastra-ai/mastra/commit/ee17cec065f4454740c9cc8f8a841027a5990f57), [`12b1189`](https://github.com/mastra-ai/mastra/commit/12b118942445e4de0dd916c593e33ec78dc3bc73), [`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`076b092`](https://github.com/mastra-ai/mastra/commit/076b0924902ff0f49d5712d2df24c4cca683713f), [`2aee9e7`](https://github.com/mastra-ai/mastra/commit/2aee9e7d188b8b256a4ddc203ccefb366b4867fa), [`c582906`](https://github.com/mastra-ai/mastra/commit/c5829065a346260f96c4beb8af131b94804ae3ad), [`fa2eb96`](https://github.com/mastra-ai/mastra/commit/fa2eb96af16c7d433891a73932764960d3235c1d), [`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`a739d0c`](https://github.com/mastra-ai/mastra/commit/a739d0c8b37cd89569e04a6ca0827083c6167e19), [`a9c4cb7`](https://github.com/mastra-ai/mastra/commit/a9c4cb7d6a35de23ca51066f166a66e0e4cca418), [`603e927`](https://github.com/mastra-ai/mastra/commit/603e9279db8bf8a46caf83881c6b7389ccffff7e), [`cd45982`](https://github.com/mastra-ai/mastra/commit/cd4598291cda128a88738734ae6cbef076ebdebd), [`874f74d`](https://github.com/mastra-ai/mastra/commit/874f74da4b1acf6517f18132d035612c3ecc394a), [`0baf2ba`](https://github.com/mastra-ai/mastra/commit/0baf2bab8420277072ef1f95df5ea7b0a2f61fe7), [`26e968d`](https://github.com/mastra-ai/mastra/commit/26e968db2171ded9e4d47aa1b4f19e1e771158d0), [`cbd3fb6`](https://github.com/mastra-ai/mastra/commit/cbd3fb65adb03a7c0df193cb998aed5ac56675ee)]:
  - @mastra/core@0.20.1-alpha.1
  - @mastra/deployer@0.20.1-alpha.1

## 0.13.6-alpha.0

### Patch Changes

- Updated dependencies [[`10e633a`](https://github.com/mastra-ai/mastra/commit/10e633a07d333466d9734c97acfc3dbf757ad2d0)]:
  - @mastra/core@0.20.1-alpha.0
  - @mastra/deployer@0.20.1-alpha.0

## 0.13.5

### Patch Changes

- Breaking change to move the agent.streamVNext/generateVNext implementation to the default stream/generate. The old stream/generate have now been moved to streamLegacy and generateLegacy ([#8097](https://github.com/mastra-ai/mastra/pull/8097))

- Updated dependencies [[`00cb6bd`](https://github.com/mastra-ai/mastra/commit/00cb6bdf78737c0fac14a5a0c7b532a11e38558a), [`869ba22`](https://github.com/mastra-ai/mastra/commit/869ba222e1d6b58fc1b65e7c9fd55ca4e01b8c2f), [`1b73665`](https://github.com/mastra-ai/mastra/commit/1b73665e8e23f5c09d49fcf3e7d709c75259259e), [`989a4db`](https://github.com/mastra-ai/mastra/commit/989a4dbbaf07a2794d0e1863714c6d10f1244d6b), [`f7d7475`](https://github.com/mastra-ai/mastra/commit/f7d747507341aef60ed39e4b49318db1f86034a6), [`084b77b`](https://github.com/mastra-ai/mastra/commit/084b77b2955960e0190af8db3f77138aa83ed65c), [`a93ff84`](https://github.com/mastra-ai/mastra/commit/a93ff84b5e1af07ee236ac8873dac9b49aa5d501), [`bc5aacb`](https://github.com/mastra-ai/mastra/commit/bc5aacb646d468d325327e36117129f28cd13bf6), [`6b5af12`](https://github.com/mastra-ai/mastra/commit/6b5af12ce9e09066e0c32e821c203a6954498bea), [`bf60e4a`](https://github.com/mastra-ai/mastra/commit/bf60e4a89c515afd9570b7b79f33b95e7d07c397), [`d41aee5`](https://github.com/mastra-ai/mastra/commit/d41aee526d124e35f42720a08e64043229193679), [`e8fe13c`](https://github.com/mastra-ai/mastra/commit/e8fe13c4b4c255a42520127797ec394310f7c919), [`3ca833d`](https://github.com/mastra-ai/mastra/commit/3ca833dc994c38e3c9b4f9b4478a61cd8e07b32a), [`1edb8d1`](https://github.com/mastra-ai/mastra/commit/1edb8d1cfb963e72a12412990fb9170936c9904c), [`fbf6e32`](https://github.com/mastra-ai/mastra/commit/fbf6e324946332d0f5ed8930bf9d4d4479cefd7a), [`4753027`](https://github.com/mastra-ai/mastra/commit/4753027ee889288775c6958bdfeda03ff909af67)]:
  - @mastra/core@0.20.0
  - @mastra/deployer@0.20.0

## 0.13.5-alpha.0

### Patch Changes

- Breaking change to move the agent.streamVNext/generateVNext implementation to the default stream/generate. The old stream/generate have now been moved to streamLegacy and generateLegacy ([#8097](https://github.com/mastra-ai/mastra/pull/8097))

- Updated dependencies [[`00cb6bd`](https://github.com/mastra-ai/mastra/commit/00cb6bdf78737c0fac14a5a0c7b532a11e38558a), [`869ba22`](https://github.com/mastra-ai/mastra/commit/869ba222e1d6b58fc1b65e7c9fd55ca4e01b8c2f), [`1b73665`](https://github.com/mastra-ai/mastra/commit/1b73665e8e23f5c09d49fcf3e7d709c75259259e), [`989a4db`](https://github.com/mastra-ai/mastra/commit/989a4dbbaf07a2794d0e1863714c6d10f1244d6b), [`f7d7475`](https://github.com/mastra-ai/mastra/commit/f7d747507341aef60ed39e4b49318db1f86034a6), [`084b77b`](https://github.com/mastra-ai/mastra/commit/084b77b2955960e0190af8db3f77138aa83ed65c), [`a93ff84`](https://github.com/mastra-ai/mastra/commit/a93ff84b5e1af07ee236ac8873dac9b49aa5d501), [`bc5aacb`](https://github.com/mastra-ai/mastra/commit/bc5aacb646d468d325327e36117129f28cd13bf6), [`6b5af12`](https://github.com/mastra-ai/mastra/commit/6b5af12ce9e09066e0c32e821c203a6954498bea), [`bf60e4a`](https://github.com/mastra-ai/mastra/commit/bf60e4a89c515afd9570b7b79f33b95e7d07c397), [`d41aee5`](https://github.com/mastra-ai/mastra/commit/d41aee526d124e35f42720a08e64043229193679), [`e8fe13c`](https://github.com/mastra-ai/mastra/commit/e8fe13c4b4c255a42520127797ec394310f7c919), [`3ca833d`](https://github.com/mastra-ai/mastra/commit/3ca833dc994c38e3c9b4f9b4478a61cd8e07b32a), [`1edb8d1`](https://github.com/mastra-ai/mastra/commit/1edb8d1cfb963e72a12412990fb9170936c9904c), [`fbf6e32`](https://github.com/mastra-ai/mastra/commit/fbf6e324946332d0f5ed8930bf9d4d4479cefd7a), [`4753027`](https://github.com/mastra-ai/mastra/commit/4753027ee889288775c6958bdfeda03ff909af67)]:
  - @mastra/core@0.20.0-alpha.0
  - @mastra/deployer@0.20.0-alpha.0

## 0.13.4

### Patch Changes

- Updated dependencies [[`4a70ccc`](https://github.com/mastra-ai/mastra/commit/4a70ccc5cfa12ae9c2b36545a5814cd98e5a0ead), [`0992b8b`](https://github.com/mastra-ai/mastra/commit/0992b8bf0f4f1ba7ad9940883ec4bb8d867d3105), [`283bea0`](https://github.com/mastra-ai/mastra/commit/283bea07adbaf04a27fa3ad2df611095e0825195)]:
  - @mastra/core@0.19.1
  - @mastra/deployer@0.19.1

## 0.13.4-alpha.0

### Patch Changes

- Updated dependencies [[`0992b8b`](https://github.com/mastra-ai/mastra/commit/0992b8bf0f4f1ba7ad9940883ec4bb8d867d3105), [`283bea0`](https://github.com/mastra-ai/mastra/commit/283bea07adbaf04a27fa3ad2df611095e0825195)]:
  - @mastra/deployer@0.19.1-alpha.0
  - @mastra/core@0.19.1-alpha.0

## 0.13.3

### Patch Changes

- Update peer deps ([#8154](https://github.com/mastra-ai/mastra/pull/8154))

- Updated dependencies [[`5089c84`](https://github.com/mastra-ai/mastra/commit/5089c84a2f535ad12e79b5aa524ad7d8ca5e2b4c), [`5c98f03`](https://github.com/mastra-ai/mastra/commit/5c98f03ae76d9a93cd6be206b4abb7bf186b3163), [`dc099b4`](https://github.com/mastra-ai/mastra/commit/dc099b40fb31147ba3f362f98d991892033c4c67), [`57b75b0`](https://github.com/mastra-ai/mastra/commit/57b75b01c0c64d91c50d7384c700afda89456fe8), [`4c5e65d`](https://github.com/mastra-ai/mastra/commit/4c5e65de746fbdab23eb6072cb999f4c7aeef9f3), [`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`57b6dd5`](https://github.com/mastra-ai/mastra/commit/57b6dd50f9e6d92c0ed3e7199e6a92752025e3a1), [`b342a68`](https://github.com/mastra-ai/mastra/commit/b342a68e1399cf1ece9ba11bda112db89d21118c), [`a7243e2`](https://github.com/mastra-ai/mastra/commit/a7243e2e58762667a6e3921e755e89d6bb0a3282), [`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`7fceb0a`](https://github.com/mastra-ai/mastra/commit/7fceb0a327d678e812f90f5387c5bc4f38bd039e), [`303a9c0`](https://github.com/mastra-ai/mastra/commit/303a9c0d7dd58795915979f06a0512359e4532fb), [`df64f9e`](https://github.com/mastra-ai/mastra/commit/df64f9ef814916fff9baedd861c988084e7c41de), [`370f8a6`](https://github.com/mastra-ai/mastra/commit/370f8a6480faec70fef18d72e5f7538f27004301), [`809eea0`](https://github.com/mastra-ai/mastra/commit/809eea092fa80c3f69b9eaf078d843b57fd2a88e), [`683e5a1`](https://github.com/mastra-ai/mastra/commit/683e5a1466e48b686825b2c11f84680f296138e4), [`3679378`](https://github.com/mastra-ai/mastra/commit/3679378673350aa314741dc826f837b1984149bc), [`7775bc2`](https://github.com/mastra-ai/mastra/commit/7775bc20bb1ad1ab24797fb420e4f96c65b0d8ec), [`623ffaf`](https://github.com/mastra-ai/mastra/commit/623ffaf2d969e11e99a0224633cf7b5a0815c857), [`9fc1613`](https://github.com/mastra-ai/mastra/commit/9fc16136400186648880fd990119ac15f7c02ee4), [`61f62aa`](https://github.com/mastra-ai/mastra/commit/61f62aa31bc88fe4ddf8da6240dbcfbeb07358bd), [`db1891a`](https://github.com/mastra-ai/mastra/commit/db1891a4707443720b7cd8a260dc7e1d49b3609c), [`e8f379d`](https://github.com/mastra-ai/mastra/commit/e8f379d390efa264c4e0874f9ac0cf8839b07777), [`652066b`](https://github.com/mastra-ai/mastra/commit/652066bd1efc6bb6813ba950ed1d7573e8b7d9d4), [`3e292ba`](https://github.com/mastra-ai/mastra/commit/3e292ba00837886d5d68a34cbc0d9b703c991883), [`418c136`](https://github.com/mastra-ai/mastra/commit/418c1366843d88e491bca3f87763899ce855ca29), [`ea8d386`](https://github.com/mastra-ai/mastra/commit/ea8d386cd8c5593664515fd5770c06bf2aa980ef), [`67b0f00`](https://github.com/mastra-ai/mastra/commit/67b0f005b520335c71fb85cbaa25df4ce8484a81), [`c2a4919`](https://github.com/mastra-ai/mastra/commit/c2a4919ba6797d8bdb1509e02287496eef69303e), [`c84b7d0`](https://github.com/mastra-ai/mastra/commit/c84b7d093c4657772140cbfd2b15ef72f3315ed5), [`6f67656`](https://github.com/mastra-ai/mastra/commit/6f676562276926e2982401574d1e07157579be30), [`0130986`](https://github.com/mastra-ai/mastra/commit/0130986fc62d0edcc626dd593282661dbb9af141), [`5dc8e9a`](https://github.com/mastra-ai/mastra/commit/5dc8e9a7f8472298cd3d4e8a0cf6d265529f287d)]:
  - @mastra/deployer@0.19.0
  - @mastra/core@0.19.0

## 0.13.3-alpha.1

### Patch Changes

- Update peer deps ([#8154](https://github.com/mastra-ai/mastra/pull/8154))

- Updated dependencies [[`5089c84`](https://github.com/mastra-ai/mastra/commit/5089c84a2f535ad12e79b5aa524ad7d8ca5e2b4c), [`5c98f03`](https://github.com/mastra-ai/mastra/commit/5c98f03ae76d9a93cd6be206b4abb7bf186b3163), [`57b75b0`](https://github.com/mastra-ai/mastra/commit/57b75b01c0c64d91c50d7384c700afda89456fe8), [`4c5e65d`](https://github.com/mastra-ai/mastra/commit/4c5e65de746fbdab23eb6072cb999f4c7aeef9f3), [`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`57b6dd5`](https://github.com/mastra-ai/mastra/commit/57b6dd50f9e6d92c0ed3e7199e6a92752025e3a1), [`a7243e2`](https://github.com/mastra-ai/mastra/commit/a7243e2e58762667a6e3921e755e89d6bb0a3282), [`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`7fceb0a`](https://github.com/mastra-ai/mastra/commit/7fceb0a327d678e812f90f5387c5bc4f38bd039e), [`df64f9e`](https://github.com/mastra-ai/mastra/commit/df64f9ef814916fff9baedd861c988084e7c41de), [`809eea0`](https://github.com/mastra-ai/mastra/commit/809eea092fa80c3f69b9eaf078d843b57fd2a88e), [`683e5a1`](https://github.com/mastra-ai/mastra/commit/683e5a1466e48b686825b2c11f84680f296138e4), [`3679378`](https://github.com/mastra-ai/mastra/commit/3679378673350aa314741dc826f837b1984149bc), [`7775bc2`](https://github.com/mastra-ai/mastra/commit/7775bc20bb1ad1ab24797fb420e4f96c65b0d8ec), [`db1891a`](https://github.com/mastra-ai/mastra/commit/db1891a4707443720b7cd8a260dc7e1d49b3609c), [`e8f379d`](https://github.com/mastra-ai/mastra/commit/e8f379d390efa264c4e0874f9ac0cf8839b07777), [`652066b`](https://github.com/mastra-ai/mastra/commit/652066bd1efc6bb6813ba950ed1d7573e8b7d9d4), [`ea8d386`](https://github.com/mastra-ai/mastra/commit/ea8d386cd8c5593664515fd5770c06bf2aa980ef), [`c2a4919`](https://github.com/mastra-ai/mastra/commit/c2a4919ba6797d8bdb1509e02287496eef69303e), [`6f67656`](https://github.com/mastra-ai/mastra/commit/6f676562276926e2982401574d1e07157579be30), [`0130986`](https://github.com/mastra-ai/mastra/commit/0130986fc62d0edcc626dd593282661dbb9af141), [`5dc8e9a`](https://github.com/mastra-ai/mastra/commit/5dc8e9a7f8472298cd3d4e8a0cf6d265529f287d)]:
  - @mastra/deployer@0.19.0-alpha.1
  - @mastra/core@0.19.0-alpha.1

## 0.13.3-alpha.0

### Patch Changes

- Updated dependencies [[`dc099b4`](https://github.com/mastra-ai/mastra/commit/dc099b40fb31147ba3f362f98d991892033c4c67), [`b342a68`](https://github.com/mastra-ai/mastra/commit/b342a68e1399cf1ece9ba11bda112db89d21118c), [`303a9c0`](https://github.com/mastra-ai/mastra/commit/303a9c0d7dd58795915979f06a0512359e4532fb), [`370f8a6`](https://github.com/mastra-ai/mastra/commit/370f8a6480faec70fef18d72e5f7538f27004301), [`623ffaf`](https://github.com/mastra-ai/mastra/commit/623ffaf2d969e11e99a0224633cf7b5a0815c857), [`9fc1613`](https://github.com/mastra-ai/mastra/commit/9fc16136400186648880fd990119ac15f7c02ee4), [`61f62aa`](https://github.com/mastra-ai/mastra/commit/61f62aa31bc88fe4ddf8da6240dbcfbeb07358bd), [`3e292ba`](https://github.com/mastra-ai/mastra/commit/3e292ba00837886d5d68a34cbc0d9b703c991883), [`418c136`](https://github.com/mastra-ai/mastra/commit/418c1366843d88e491bca3f87763899ce855ca29), [`c84b7d0`](https://github.com/mastra-ai/mastra/commit/c84b7d093c4657772140cbfd2b15ef72f3315ed5)]:
  - @mastra/core@0.18.1-alpha.0
  - @mastra/deployer@0.18.1-alpha.0

## 0.13.2

### Patch Changes

- dependencies updates: ([#8007](https://github.com/mastra-ai/mastra/pull/8007))
  - Updated dependency [`fs-extra@^11.3.2` ↗︎](https://www.npmjs.com/package/fs-extra/v/11.3.2) (from `^11.3.1`, in `dependencies`)

- feat: implement trace scoring with batch processing capabilities ([#8033](https://github.com/mastra-ai/mastra/pull/8033))

- Update Peerdeps for packages based on core minor bump ([#8025](https://github.com/mastra-ai/mastra/pull/8025))

- Updated dependencies [[`288745a`](https://github.com/mastra-ai/mastra/commit/288745a19aa9557db3ab3c877d667ff59f14d79c), [`cf34503`](https://github.com/mastra-ai/mastra/commit/cf345031de4e157f29087946449e60b965e9c8a9), [`6b4b1e4`](https://github.com/mastra-ai/mastra/commit/6b4b1e4235428d39e51cbda9832704c0ba70ab32), [`3469fca`](https://github.com/mastra-ai/mastra/commit/3469fca7bb7e5e19369ff9f7044716a5e4b02585), [`a61f23f`](https://github.com/mastra-ai/mastra/commit/a61f23fbbca4b88b763d94f1d784c47895ed72d7), [`4b339b8`](https://github.com/mastra-ai/mastra/commit/4b339b8141c20d6a6d80583c7e8c5c05d8c19492), [`8f56160`](https://github.com/mastra-ai/mastra/commit/8f56160fd45c740076529148b9c225f6842d43b0), [`d1dc606`](https://github.com/mastra-ai/mastra/commit/d1dc6067b0557a71190b68d56ee15b48c26d2411), [`2d29ad9`](https://github.com/mastra-ai/mastra/commit/2d29ad92763cac02fc1d80c221ac93c39c0c5caf), [`c45298a`](https://github.com/mastra-ai/mastra/commit/c45298a0a0791db35cf79f1199d77004da0704cb), [`c4a8204`](https://github.com/mastra-ai/mastra/commit/c4a82046bfd241d6044e234bc5917d5a01fe6b55), [`d3bd4d4`](https://github.com/mastra-ai/mastra/commit/d3bd4d482a685bbb67bfa89be91c90dca3fa71ad), [`c591dfc`](https://github.com/mastra-ai/mastra/commit/c591dfc1e600fae1dedffe239357d250e146378f), [`1920c5c`](https://github.com/mastra-ai/mastra/commit/1920c5c6d666f687785c73021196aa551e579e0d), [`b6a3b65`](https://github.com/mastra-ai/mastra/commit/b6a3b65d830fa0ca7754ad6481661d1f2c878f21), [`af3abb6`](https://github.com/mastra-ai/mastra/commit/af3abb6f7c7585d856e22d27f4e7d2ece2186b9a), [`5b1ee71`](https://github.com/mastra-ai/mastra/commit/5b1ee71dc3ac92383226dc1e375642ca5f9b4224), [`282379f`](https://github.com/mastra-ai/mastra/commit/282379fafed80c6417fe1e791087110decd481ca)]:
  - @mastra/deployer@0.18.0
  - @mastra/core@0.18.0

## 0.13.2-alpha.3

### Patch Changes

- feat: implement trace scoring with batch processing capabilities ([#8033](https://github.com/mastra-ai/mastra/pull/8033))

- Updated dependencies [[`4b339b8`](https://github.com/mastra-ai/mastra/commit/4b339b8141c20d6a6d80583c7e8c5c05d8c19492), [`8f56160`](https://github.com/mastra-ai/mastra/commit/8f56160fd45c740076529148b9c225f6842d43b0), [`c591dfc`](https://github.com/mastra-ai/mastra/commit/c591dfc1e600fae1dedffe239357d250e146378f), [`1920c5c`](https://github.com/mastra-ai/mastra/commit/1920c5c6d666f687785c73021196aa551e579e0d), [`b6a3b65`](https://github.com/mastra-ai/mastra/commit/b6a3b65d830fa0ca7754ad6481661d1f2c878f21), [`af3abb6`](https://github.com/mastra-ai/mastra/commit/af3abb6f7c7585d856e22d27f4e7d2ece2186b9a), [`282379f`](https://github.com/mastra-ai/mastra/commit/282379fafed80c6417fe1e791087110decd481ca)]:
  - @mastra/core@0.18.0-alpha.3
  - @mastra/deployer@0.18.0-alpha.3

## 0.13.2-alpha.2

### Patch Changes

- Update Peerdeps for packages based on core minor bump ([#8025](https://github.com/mastra-ai/mastra/pull/8025))

- Updated dependencies [[`cf34503`](https://github.com/mastra-ai/mastra/commit/cf345031de4e157f29087946449e60b965e9c8a9), [`6b4b1e4`](https://github.com/mastra-ai/mastra/commit/6b4b1e4235428d39e51cbda9832704c0ba70ab32), [`3469fca`](https://github.com/mastra-ai/mastra/commit/3469fca7bb7e5e19369ff9f7044716a5e4b02585), [`2d29ad9`](https://github.com/mastra-ai/mastra/commit/2d29ad92763cac02fc1d80c221ac93c39c0c5caf), [`c4a8204`](https://github.com/mastra-ai/mastra/commit/c4a82046bfd241d6044e234bc5917d5a01fe6b55), [`5b1ee71`](https://github.com/mastra-ai/mastra/commit/5b1ee71dc3ac92383226dc1e375642ca5f9b4224)]:
  - @mastra/core@0.18.0-alpha.2
  - @mastra/deployer@0.18.0-alpha.2

## 0.13.2-alpha.1

### Patch Changes

- dependencies updates: ([#8007](https://github.com/mastra-ai/mastra/pull/8007))
  - Updated dependency [`fs-extra@^11.3.2` ↗︎](https://www.npmjs.com/package/fs-extra/v/11.3.2) (from `^11.3.1`, in `dependencies`)
- Updated dependencies [[`288745a`](https://github.com/mastra-ai/mastra/commit/288745a19aa9557db3ab3c877d667ff59f14d79c), [`c45298a`](https://github.com/mastra-ai/mastra/commit/c45298a0a0791db35cf79f1199d77004da0704cb)]:
  - @mastra/deployer@0.17.2-alpha.1
  - @mastra/core@0.17.2-alpha.1

## 0.13.2-alpha.0

### Patch Changes

- Updated dependencies [[`a61f23f`](https://github.com/mastra-ai/mastra/commit/a61f23fbbca4b88b763d94f1d784c47895ed72d7), [`d1dc606`](https://github.com/mastra-ai/mastra/commit/d1dc6067b0557a71190b68d56ee15b48c26d2411), [`d3bd4d4`](https://github.com/mastra-ai/mastra/commit/d3bd4d482a685bbb67bfa89be91c90dca3fa71ad)]:
  - @mastra/core@0.17.2-alpha.0
  - @mastra/deployer@0.17.2-alpha.0

## 0.13.1

### Patch Changes

- Updated dependencies [[`fd00e63`](https://github.com/mastra-ai/mastra/commit/fd00e63759cbcca3473c40cac9843280b0557cff), [`ab610f6`](https://github.com/mastra-ai/mastra/commit/ab610f6f41dbfe6c9502368671485ca7a0aac09b), [`e6bda5f`](https://github.com/mastra-ai/mastra/commit/e6bda5f954ee8493ea18adc1a883f0a5b785ad9b)]:
  - @mastra/core@0.17.1
  - @mastra/deployer@0.17.1

## 0.13.1-alpha.0

### Patch Changes

- Updated dependencies [[`fd00e63`](https://github.com/mastra-ai/mastra/commit/fd00e63759cbcca3473c40cac9843280b0557cff), [`ab610f6`](https://github.com/mastra-ai/mastra/commit/ab610f6f41dbfe6c9502368671485ca7a0aac09b), [`e6bda5f`](https://github.com/mastra-ai/mastra/commit/e6bda5f954ee8493ea18adc1a883f0a5b785ad9b)]:
  - @mastra/core@0.17.1-alpha.0
  - @mastra/deployer@0.17.1-alpha.0

## 0.13.0

### Minor Changes

- The `IBundler` and subsequently the `IDeployer` interface changed, making the third argument of `bundle()` an object. ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

  ```diff
  - bundle(entryFile: string, outputDirectory: string, toolsPaths: (string | string[])[]): Promise<void>;
  + bundle(entryFile: string, outputDirectory: string, options: { toolsPaths: (string | string[])[]; projectRoot: string }): Promise<void>;
  ```

  If you're just using the deployer inside `src/mastra/index.ts` you're safe to upgrade, no changes needed.

### Patch Changes

- Update peerdep of @mastra/core ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

- Updated dependencies [[`197cbb2`](https://github.com/mastra-ai/mastra/commit/197cbb248fc8cb4bbf61bf70b770f1388b445df2), [`b1c155b`](https://github.com/mastra-ai/mastra/commit/b1c155b57ce702674f207f1d4c6a4ebf94225f44), [`790f7d1`](https://github.com/mastra-ai/mastra/commit/790f7d17895d7a5f75b6b5d2d794c2e820b99d4c), [`3cd6538`](https://github.com/mastra-ai/mastra/commit/3cd6538811fc94f84a19dbd1064f46cb42e38c1d), [`197cbb2`](https://github.com/mastra-ai/mastra/commit/197cbb248fc8cb4bbf61bf70b770f1388b445df2), [`a1bb887`](https://github.com/mastra-ai/mastra/commit/a1bb887e8bfae44230f487648da72e96ef824561), [`6590763`](https://github.com/mastra-ai/mastra/commit/65907630ef4bf4127067cecd1cb21b56f55d5f1b), [`fb84c21`](https://github.com/mastra-ai/mastra/commit/fb84c21859d09bdc8f158bd5412bdc4b5835a61c), [`5802bf5`](https://github.com/mastra-ai/mastra/commit/5802bf57f6182e4b67c28d7d91abed349a8d14f3), [`5bda53a`](https://github.com/mastra-ai/mastra/commit/5bda53a9747bfa7d876d754fc92c83a06e503f62), [`c2eade3`](https://github.com/mastra-ai/mastra/commit/c2eade3508ef309662f065e5f340d7840295dd53), [`f26a8fd`](https://github.com/mastra-ai/mastra/commit/f26a8fd99fcb0497a5d86c28324430d7f6a5fb83), [`7e82fbf`](https://github.com/mastra-ai/mastra/commit/7e82fbf3715175e274d2015eb59fb7f57dc9b09d), [`222965a`](https://github.com/mastra-ai/mastra/commit/222965a98ce8197b86673ec594244650b5960257), [`6047778`](https://github.com/mastra-ai/mastra/commit/6047778e501df460648f31decddf8e443f36e373), [`a0f5f1c`](https://github.com/mastra-ai/mastra/commit/a0f5f1ca39c3c5c6d26202e9fcab986b4fe14568), [`9d4fc09`](https://github.com/mastra-ai/mastra/commit/9d4fc09b2ad55caa7738c7ceb3a905e454f74cdd), [`05c7abf`](https://github.com/mastra-ai/mastra/commit/05c7abfe105a015b7760c9bf33ff4419727502a0), [`0324ceb`](https://github.com/mastra-ai/mastra/commit/0324ceb8af9d16c12a531f90e575f6aab797ac81), [`d75ccf0`](https://github.com/mastra-ai/mastra/commit/d75ccf06dfd2582b916aa12624e3cd61b279edf1), [`0f9d227`](https://github.com/mastra-ai/mastra/commit/0f9d227890a98db33865abbea39daf407cd55ef7), [`b356f5f`](https://github.com/mastra-ai/mastra/commit/b356f5f7566cb3edb755d91f00b72fc1420b2a37), [`de056a0`](https://github.com/mastra-ai/mastra/commit/de056a02cbb43f6aa0380ab2150ea404af9ec0dd), [`f5ce05f`](https://github.com/mastra-ai/mastra/commit/f5ce05f831d42c69559bf4c0fdb46ccb920fc3a3), [`60c9cec`](https://github.com/mastra-ai/mastra/commit/60c9cec7048a79a87440f7840c383875bd710d93), [`c93532a`](https://github.com/mastra-ai/mastra/commit/c93532a340b80e4dd946d4c138d9381de5f70399), [`6c33d7f`](https://github.com/mastra-ai/mastra/commit/6c33d7f7242804c32e969ad3ab33ff4a6aebda8b), [`6cb1fcb`](https://github.com/mastra-ai/mastra/commit/6cb1fcbc8d0378ffed0d17784c96e68f30cb0272), [`aee4f00`](https://github.com/mastra-ai/mastra/commit/aee4f00e61e1a42e81a6d74ff149dbe69e32695a), [`f0ab020`](https://github.com/mastra-ai/mastra/commit/f0ab02034532a4afb71a1ef4fe243f9a8dffde84), [`9f6f30f`](https://github.com/mastra-ai/mastra/commit/9f6f30f04ec6648bbca798ea8aad59317c40d8db), [`547c621`](https://github.com/mastra-ai/mastra/commit/547c62104af3f7a551b3754e9cbdf0a3fbba15e4), [`897995e`](https://github.com/mastra-ai/mastra/commit/897995e630d572fe2891e7ede817938cabb43251), [`0fed8f2`](https://github.com/mastra-ai/mastra/commit/0fed8f2aa84b167b3415ea6f8f70755775132c8d), [`4f9ea8c`](https://github.com/mastra-ai/mastra/commit/4f9ea8c95ea74ba9abbf3b2ab6106c7d7bc45689), [`1a1fbe6`](https://github.com/mastra-ai/mastra/commit/1a1fbe66efb7d94abc373ed0dd9676adb8122454), [`d706fad`](https://github.com/mastra-ai/mastra/commit/d706fad6e6e4b72357b18d229ba38e6c913c0e70), [`87fd07f`](https://github.com/mastra-ai/mastra/commit/87fd07ff35387a38728967163460231b5d33ae3b), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382), [`5c3768f`](https://github.com/mastra-ai/mastra/commit/5c3768fa959454232ad76715c381f4aac00c6881), [`2685a78`](https://github.com/mastra-ai/mastra/commit/2685a78f224b8b04e20d4fab5ac1adb638190071), [`36f39c0`](https://github.com/mastra-ai/mastra/commit/36f39c00dc794952dc3c11aab91c2fa8bca74b11), [`239b5a4`](https://github.com/mastra-ai/mastra/commit/239b5a497aeae2e8b4d764f46217cfff2284788e), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382)]:
  - @mastra/core@0.17.0
  - @mastra/deployer@0.17.0

## 0.13.0-alpha.1

### Minor Changes

- The `IBundler` and subsequently the `IDeployer` interface changed, making the third argument of `bundle()` an object. ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

  ```diff
  - bundle(entryFile: string, outputDirectory: string, toolsPaths: (string | string[])[]): Promise<void>;
  + bundle(entryFile: string, outputDirectory: string, options: { toolsPaths: (string | string[])[]; projectRoot: string }): Promise<void>;
  ```

  If you're just using the deployer inside `src/mastra/index.ts` you're safe to upgrade, no changes needed.

### Patch Changes

- Update peerdep of @mastra/core ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

- Updated dependencies [[`b1c155b`](https://github.com/mastra-ai/mastra/commit/b1c155b57ce702674f207f1d4c6a4ebf94225f44), [`790f7d1`](https://github.com/mastra-ai/mastra/commit/790f7d17895d7a5f75b6b5d2d794c2e820b99d4c), [`3cd6538`](https://github.com/mastra-ai/mastra/commit/3cd6538811fc94f84a19dbd1064f46cb42e38c1d), [`a1bb887`](https://github.com/mastra-ai/mastra/commit/a1bb887e8bfae44230f487648da72e96ef824561), [`7e82fbf`](https://github.com/mastra-ai/mastra/commit/7e82fbf3715175e274d2015eb59fb7f57dc9b09d), [`a0f5f1c`](https://github.com/mastra-ai/mastra/commit/a0f5f1ca39c3c5c6d26202e9fcab986b4fe14568), [`b356f5f`](https://github.com/mastra-ai/mastra/commit/b356f5f7566cb3edb755d91f00b72fc1420b2a37), [`f5ce05f`](https://github.com/mastra-ai/mastra/commit/f5ce05f831d42c69559bf4c0fdb46ccb920fc3a3), [`9f6f30f`](https://github.com/mastra-ai/mastra/commit/9f6f30f04ec6648bbca798ea8aad59317c40d8db), [`d706fad`](https://github.com/mastra-ai/mastra/commit/d706fad6e6e4b72357b18d229ba38e6c913c0e70), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382), [`5c3768f`](https://github.com/mastra-ai/mastra/commit/5c3768fa959454232ad76715c381f4aac00c6881), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382)]:
  - @mastra/deployer@0.17.0-alpha.3
  - @mastra/core@0.17.0-alpha.3

## 0.12.8-alpha.0

### Patch Changes

- Updated dependencies [[`5802bf5`](https://github.com/mastra-ai/mastra/commit/5802bf57f6182e4b67c28d7d91abed349a8d14f3), [`5bda53a`](https://github.com/mastra-ai/mastra/commit/5bda53a9747bfa7d876d754fc92c83a06e503f62), [`f26a8fd`](https://github.com/mastra-ai/mastra/commit/f26a8fd99fcb0497a5d86c28324430d7f6a5fb83), [`f0ab020`](https://github.com/mastra-ai/mastra/commit/f0ab02034532a4afb71a1ef4fe243f9a8dffde84), [`1a1fbe6`](https://github.com/mastra-ai/mastra/commit/1a1fbe66efb7d94abc373ed0dd9676adb8122454), [`36f39c0`](https://github.com/mastra-ai/mastra/commit/36f39c00dc794952dc3c11aab91c2fa8bca74b11)]:
  - @mastra/core@0.16.4-alpha.0
  - @mastra/deployer@0.16.4-alpha.0

## 0.12.7

### Patch Changes

- Updated dependencies [[`b4379f7`](https://github.com/mastra-ai/mastra/commit/b4379f703fd74474f253420e8c3a684f2c4b2f8e), [`b4379f7`](https://github.com/mastra-ai/mastra/commit/b4379f703fd74474f253420e8c3a684f2c4b2f8e), [`2a6585f`](https://github.com/mastra-ai/mastra/commit/2a6585f7cb71f023f805d521d1c3c95fb9a3aa59), [`3d26e83`](https://github.com/mastra-ai/mastra/commit/3d26e8353a945719028f087cc6ac4b06f0ce27d2), [`dd9119b`](https://github.com/mastra-ai/mastra/commit/dd9119b175a8f389082f75c12750e51f96d65dca), [`d34aaa1`](https://github.com/mastra-ai/mastra/commit/d34aaa1da5d3c5f991740f59e2fe6d28d3e2dd91), [`56e55d1`](https://github.com/mastra-ai/mastra/commit/56e55d1e9eb63e7d9e41aa46e012aae471256812), [`ce1e580`](https://github.com/mastra-ai/mastra/commit/ce1e580f6391e94a0c6816a9c5db0a21566a262f), [`b2babfa`](https://github.com/mastra-ai/mastra/commit/b2babfa9e75b22f2759179e71d8473f6dc5421ed), [`d8c3ba5`](https://github.com/mastra-ai/mastra/commit/d8c3ba516f4173282d293f7e64769cfc8738d360), [`a566c4e`](https://github.com/mastra-ai/mastra/commit/a566c4e92d86c1671707c54359b1d33934f7cc13), [`0666082`](https://github.com/mastra-ai/mastra/commit/06660820230dcb1fa7c1d51c8254107afd68cd67), [`af333aa`](https://github.com/mastra-ai/mastra/commit/af333aa30fe6d1b127024b03a64736c46eddeca2), [`4c81b65`](https://github.com/mastra-ai/mastra/commit/4c81b65a28d128560bdf63bc9b8a1bddd4884812), [`3863c52`](https://github.com/mastra-ai/mastra/commit/3863c52d44b4e5779968b802d977e87adf939d8e), [`6424c7e`](https://github.com/mastra-ai/mastra/commit/6424c7ec38b6921d66212431db1e0958f441b2a7), [`db94750`](https://github.com/mastra-ai/mastra/commit/db94750a41fd29b43eb1f7ce8e97ba8b9978c91b), [`a66a371`](https://github.com/mastra-ai/mastra/commit/a66a3716b00553d7f01842be9deb34f720b10fab), [`69fc3cd`](https://github.com/mastra-ai/mastra/commit/69fc3cd0fd814901785bdcf49bf536ab1e7fd975)]:
  - @mastra/core@0.16.3
  - @mastra/deployer@0.16.3

## 0.12.7-alpha.0

### Patch Changes

- Updated dependencies [[`b4379f7`](https://github.com/mastra-ai/mastra/commit/b4379f703fd74474f253420e8c3a684f2c4b2f8e), [`b4379f7`](https://github.com/mastra-ai/mastra/commit/b4379f703fd74474f253420e8c3a684f2c4b2f8e), [`dd9119b`](https://github.com/mastra-ai/mastra/commit/dd9119b175a8f389082f75c12750e51f96d65dca), [`d34aaa1`](https://github.com/mastra-ai/mastra/commit/d34aaa1da5d3c5f991740f59e2fe6d28d3e2dd91), [`ce1e580`](https://github.com/mastra-ai/mastra/commit/ce1e580f6391e94a0c6816a9c5db0a21566a262f), [`b2babfa`](https://github.com/mastra-ai/mastra/commit/b2babfa9e75b22f2759179e71d8473f6dc5421ed), [`d8c3ba5`](https://github.com/mastra-ai/mastra/commit/d8c3ba516f4173282d293f7e64769cfc8738d360), [`a566c4e`](https://github.com/mastra-ai/mastra/commit/a566c4e92d86c1671707c54359b1d33934f7cc13), [`0666082`](https://github.com/mastra-ai/mastra/commit/06660820230dcb1fa7c1d51c8254107afd68cd67), [`af333aa`](https://github.com/mastra-ai/mastra/commit/af333aa30fe6d1b127024b03a64736c46eddeca2), [`3863c52`](https://github.com/mastra-ai/mastra/commit/3863c52d44b4e5779968b802d977e87adf939d8e), [`6424c7e`](https://github.com/mastra-ai/mastra/commit/6424c7ec38b6921d66212431db1e0958f441b2a7), [`db94750`](https://github.com/mastra-ai/mastra/commit/db94750a41fd29b43eb1f7ce8e97ba8b9978c91b), [`a66a371`](https://github.com/mastra-ai/mastra/commit/a66a3716b00553d7f01842be9deb34f720b10fab), [`69fc3cd`](https://github.com/mastra-ai/mastra/commit/69fc3cd0fd814901785bdcf49bf536ab1e7fd975)]:
  - @mastra/core@0.16.3-alpha.0
  - @mastra/deployer@0.16.3-alpha.0

## 0.12.6

### Patch Changes

- Updated dependencies [[`61926ef`](https://github.com/mastra-ai/mastra/commit/61926ef40d415b805a63527cffe27a50542e15e5)]:
  - @mastra/core@0.16.2
  - @mastra/deployer@0.16.2

## 0.12.6-alpha.0

### Patch Changes

- Updated dependencies [[`61926ef`](https://github.com/mastra-ai/mastra/commit/61926ef40d415b805a63527cffe27a50542e15e5)]:
  - @mastra/core@0.16.2-alpha.0
  - @mastra/deployer@0.16.2-alpha.0

## 0.12.5

### Patch Changes

- dependencies updates: ([#7544](https://github.com/mastra-ai/mastra/pull/7544))
  - Updated dependency [`fs-extra@^11.3.1` ↗︎](https://www.npmjs.com/package/fs-extra/v/11.3.1) (from `^11.3.0`, in `dependencies`)
- Updated dependencies [[`6d6e5dd`](https://github.com/mastra-ai/mastra/commit/6d6e5dd00edd5f4d2f310d347c615aef3ed7f609), [`47b6dc9`](https://github.com/mastra-ai/mastra/commit/47b6dc94f4976d4f3d3882e8f19eb365bbc5976c), [`827d876`](https://github.com/mastra-ai/mastra/commit/827d8766f36a900afcaf64a040f7ba76249009b3), [`0662d02`](https://github.com/mastra-ai/mastra/commit/0662d02ef16916e67531890639fcd72c69cfb6e2), [`565d65f`](https://github.com/mastra-ai/mastra/commit/565d65fc16314a99f081975ec92f2636dff0c86d), [`6189844`](https://github.com/mastra-ai/mastra/commit/61898448e65bda02bb814fb15801a89dc6476938), [`4da3d68`](https://github.com/mastra-ai/mastra/commit/4da3d68a778e5c4d5a17351ef223289fe2f45a45), [`90cab34`](https://github.com/mastra-ai/mastra/commit/90cab347db71359dc5f3d001b1e8d63fd958879a), [`fd9bbfe`](https://github.com/mastra-ai/mastra/commit/fd9bbfee22484f8493582325f53e8171bf8e682b), [`e75360a`](https://github.com/mastra-ai/mastra/commit/e75360a134d722df969777abcf36092fadad1f12), [`7eaf1d1`](https://github.com/mastra-ai/mastra/commit/7eaf1d1cec7e828d7a98efc2a748ac395bbdba3b), [`6f046b5`](https://github.com/mastra-ai/mastra/commit/6f046b5ccc5c8721302a9a61d5d16c12374cc8d7), [`d7a8f59`](https://github.com/mastra-ai/mastra/commit/d7a8f59154b0621aec4f41a6b2ea2b3882f03cb7), [`0b0bbb2`](https://github.com/mastra-ai/mastra/commit/0b0bbb24f4198ead69792e92b68a350f52b45cf3), [`d951f41`](https://github.com/mastra-ai/mastra/commit/d951f41771e4e5da8da4b9f870949f9509e38756), [`4dda259`](https://github.com/mastra-ai/mastra/commit/4dda2593b6343f9258671de5fb237aeba3ef6bb7), [`8049e2e`](https://github.com/mastra-ai/mastra/commit/8049e2e8cce80a00353c64894c62b695ac34e35e), [`f3427cd`](https://github.com/mastra-ai/mastra/commit/f3427cdaf9eecd63360dfc897a4acbf5f4143a4e), [`defed1c`](https://github.com/mastra-ai/mastra/commit/defed1ca8040cc8d42e645c5a50a1bc52a4918d7), [`6991ced`](https://github.com/mastra-ai/mastra/commit/6991cedcb5a44a49d9fe58ef67926e1f96ba55b1), [`9cb9c42`](https://github.com/mastra-ai/mastra/commit/9cb9c422854ee81074989dd2d8dccc0500ba8d3e), [`f36343e`](https://github.com/mastra-ai/mastra/commit/f36343e02935b9a112a45b2dc3de7b562cc3aa68), [`8334859`](https://github.com/mastra-ai/mastra/commit/83348594d4f37b311ba4a94d679c5f8721d796d4), [`05f13b8`](https://github.com/mastra-ai/mastra/commit/05f13b8fb269ccfc4de98e9db58dbe16eae55a5e)]:
  - @mastra/deployer@0.16.1
  - @mastra/core@0.16.1

## 0.12.5-alpha.0

### Patch Changes

- dependencies updates: ([#7544](https://github.com/mastra-ai/mastra/pull/7544))
  - Updated dependency [`fs-extra@^11.3.1` ↗︎](https://www.npmjs.com/package/fs-extra/v/11.3.1) (from `^11.3.0`, in `dependencies`)
- Updated dependencies [[`6d6e5dd`](https://github.com/mastra-ai/mastra/commit/6d6e5dd00edd5f4d2f310d347c615aef3ed7f609), [`0662d02`](https://github.com/mastra-ai/mastra/commit/0662d02ef16916e67531890639fcd72c69cfb6e2), [`6189844`](https://github.com/mastra-ai/mastra/commit/61898448e65bda02bb814fb15801a89dc6476938), [`90cab34`](https://github.com/mastra-ai/mastra/commit/90cab347db71359dc5f3d001b1e8d63fd958879a), [`e75360a`](https://github.com/mastra-ai/mastra/commit/e75360a134d722df969777abcf36092fadad1f12), [`d7a8f59`](https://github.com/mastra-ai/mastra/commit/d7a8f59154b0621aec4f41a6b2ea2b3882f03cb7), [`4dda259`](https://github.com/mastra-ai/mastra/commit/4dda2593b6343f9258671de5fb237aeba3ef6bb7), [`defed1c`](https://github.com/mastra-ai/mastra/commit/defed1ca8040cc8d42e645c5a50a1bc52a4918d7), [`6991ced`](https://github.com/mastra-ai/mastra/commit/6991cedcb5a44a49d9fe58ef67926e1f96ba55b1), [`9cb9c42`](https://github.com/mastra-ai/mastra/commit/9cb9c422854ee81074989dd2d8dccc0500ba8d3e), [`8334859`](https://github.com/mastra-ai/mastra/commit/83348594d4f37b311ba4a94d679c5f8721d796d4)]:
  - @mastra/deployer@0.16.1-alpha.0
  - @mastra/core@0.16.1-alpha.0

## 0.12.4

### Patch Changes

- 376913a: Update peerdeps
- Updated dependencies [8fbf79e]
- Updated dependencies [cf4e353]
- Updated dependencies [fd83526]
- Updated dependencies [d0b90ab]
- Updated dependencies [6f5eb7a]
- Updated dependencies [a01cf14]
- Updated dependencies [a9e50ee]
- Updated dependencies [5397eb4]
- Updated dependencies [c9f4e4a]
- Updated dependencies [0acbc80]
- Updated dependencies [376913a]
  - @mastra/core@0.16.0
  - @mastra/deployer@0.16.0

## 0.12.4-alpha.1

### Patch Changes

- 376913a: Update peerdeps
- Updated dependencies [8fbf79e]
- Updated dependencies [376913a]
  - @mastra/core@0.16.0-alpha.1
  - @mastra/deployer@0.16.0-alpha.1

## 0.12.4-alpha.0

### Patch Changes

- Updated dependencies [cf4e353]
- Updated dependencies [fd83526]
- Updated dependencies [d0b90ab]
- Updated dependencies [6f5eb7a]
- Updated dependencies [a01cf14]
- Updated dependencies [a9e50ee]
- Updated dependencies [5397eb4]
- Updated dependencies [c9f4e4a]
- Updated dependencies [0acbc80]
  - @mastra/deployer@0.16.0-alpha.0
  - @mastra/core@0.16.0-alpha.0

## 0.12.3

### Patch Changes

- de3cbc6: Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.
- f0dfcac: updated core peerdep
- Updated dependencies [ab48c97]
- Updated dependencies [3e0bd2a]
- Updated dependencies [2b64943]
- Updated dependencies [85ef90b]
- Updated dependencies [aedbbfa]
- Updated dependencies [ff89505]
- Updated dependencies [637f323]
- Updated dependencies [de3cbc6]
- Updated dependencies [c19bcf7]
- Updated dependencies [4474d04]
- Updated dependencies [183dc95]
- Updated dependencies [a1111e2]
- Updated dependencies [b42a961]
- Updated dependencies [71b657b]
- Updated dependencies [61debef]
- Updated dependencies [9beaeff]
- Updated dependencies [29de0e1]
- Updated dependencies [f643c65]
- Updated dependencies [00c74e7]
- Updated dependencies [f0dfcac]
- Updated dependencies [fef7375]
- Updated dependencies [6d98856]
- Updated dependencies [e3d8fea]
- Updated dependencies [45e4d39]
- Updated dependencies [9eee594]
- Updated dependencies [7149d8d]
- Updated dependencies [822c2e8]
- Updated dependencies [979912c]
- Updated dependencies [7dcf4c0]
- Updated dependencies [4106a58]
- Updated dependencies [ad78bfc]
- Updated dependencies [6f715fe]
- Updated dependencies [48f0742]
- Updated dependencies [0302f50]
- Updated dependencies [12adcc8]
- Updated dependencies [6ac697e]
- Updated dependencies [74db265]
- Updated dependencies [0ce418a]
- Updated dependencies [af90672]
- Updated dependencies [8387952]
- Updated dependencies [7f3b8da]
- Updated dependencies [905352b]
- Updated dependencies [599d04c]
- Updated dependencies [a6e2254]
- Updated dependencies [56041d0]
- Updated dependencies [3412597]
- Updated dependencies [5eca5d2]
- Updated dependencies [8f22a2c]
- Updated dependencies [f2cda47]
- Updated dependencies [5de1555]
- Updated dependencies [cfd377a]
- Updated dependencies [1ed5a3e]
- Updated dependencies [03d0c39]
  - @mastra/core@0.15.3
  - @mastra/deployer@0.15.3

## 0.12.3-alpha.2

### Patch Changes

- [#7394](https://github.com/mastra-ai/mastra/pull/7394) [`f0dfcac`](https://github.com/mastra-ai/mastra/commit/f0dfcac4458bdf789b975e2d63e984f5d1e7c4d3) Thanks [@NikAiyer](https://github.com/NikAiyer)! - updated core peerdep

- Updated dependencies [[`f0dfcac`](https://github.com/mastra-ai/mastra/commit/f0dfcac4458bdf789b975e2d63e984f5d1e7c4d3), [`7149d8d`](https://github.com/mastra-ai/mastra/commit/7149d8d4bdc1edf0008e0ca9b7925eb0b8b60dbe)]:
  - @mastra/deployer@0.15.3-alpha.7
  - @mastra/core@0.15.3-alpha.7

## 0.12.3-alpha.1

### Patch Changes

- [#7343](https://github.com/mastra-ai/mastra/pull/7343) [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e) Thanks [@LekoArts](https://github.com/LekoArts)! - Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.

- Updated dependencies [[`2b64943`](https://github.com/mastra-ai/mastra/commit/2b64943a282c99988c2e5b6e1269bfaca60e6fe3), [`85ef90b`](https://github.com/mastra-ai/mastra/commit/85ef90bb2cd4ae4df855c7ac175f7d392c55c1bf), [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e)]:
  - @mastra/deployer@0.15.3-alpha.5
  - @mastra/core@0.15.3-alpha.5

## 0.12.3-alpha.0

### Patch Changes

- Updated dependencies [[`00c74e7`](https://github.com/mastra-ai/mastra/commit/00c74e73b1926be0d475693bb886fb67a22ff352), [`6f715fe`](https://github.com/mastra-ai/mastra/commit/6f715fe524296e1138a319e56bcf8e4214bd5dd5), [`af90672`](https://github.com/mastra-ai/mastra/commit/af906722d8da28688882193b1e531026f9e2e81e), [`a6e2254`](https://github.com/mastra-ai/mastra/commit/a6e225469159950bb69e8d240d510ec57dc0d79a), [`56041d0`](https://github.com/mastra-ai/mastra/commit/56041d018863a3da6b98c512e47348647c075fb3), [`5de1555`](https://github.com/mastra-ai/mastra/commit/5de15554d3d6695211945a36928f6657e76cddc9), [`1ed5a3e`](https://github.com/mastra-ai/mastra/commit/1ed5a3e19330374c4347a4237cd2f4b9ffb60376)]:
  - @mastra/core@0.15.3-alpha.0
  - @mastra/deployer@0.15.3-alpha.0

## 0.12.2

### Patch Changes

- [`c6113ed`](https://github.com/mastra-ai/mastra/commit/c6113ed7f9df297e130d94436ceee310273d6430) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdpes for @mastra/core

- Updated dependencies [[`c6113ed`](https://github.com/mastra-ai/mastra/commit/c6113ed7f9df297e130d94436ceee310273d6430)]:
  - @mastra/deployer@0.15.2
  - @mastra/core@0.15.2

## 0.12.1

### Patch Changes

- [`95b2aa9`](https://github.com/mastra-ai/mastra/commit/95b2aa908230919e67efcac0d69005a2d5745298) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdeps @mastra/core

- Updated dependencies [[`95b2aa9`](https://github.com/mastra-ai/mastra/commit/95b2aa908230919e67efcac0d69005a2d5745298)]:
  - @mastra/deployer@0.15.1
  - @mastra/core@0.15.1

## 0.12.0

### Minor Changes

- [#7028](https://github.com/mastra-ai/mastra/pull/7028) [`da58ccc`](https://github.com/mastra-ai/mastra/commit/da58ccc1f2ac33da0cb97b00443fc6208b45bdec) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump core peerdependency

- [#7032](https://github.com/mastra-ai/mastra/pull/7032) [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump zod peerdep to 3.25.0 to support both v3/v4

### Patch Changes

- [#6942](https://github.com/mastra-ai/mastra/pull/6942) [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01) Thanks [@wardpeet](https://github.com/wardpeet)! - Add zod as peerdeps for all packages

- Updated dependencies [[`0778757`](https://github.com/mastra-ai/mastra/commit/07787570e4addbd501522037bd2542c3d9e26822), [`e9a36bd`](https://github.com/mastra-ai/mastra/commit/e9a36bd03ed032528b60186a318f563ebf59c01a), [`2b38a60`](https://github.com/mastra-ai/mastra/commit/2b38a60da0c1153028d8241c7748b41c5fb81121), [`943a7f3`](https://github.com/mastra-ai/mastra/commit/943a7f3dbc6a8ab3f9b7bc7c8a1c5b319c3d7f56), [`681252d`](https://github.com/mastra-ai/mastra/commit/681252d20e57fcee6821377dea96cacab3bc230f), [`01be5d3`](https://github.com/mastra-ai/mastra/commit/01be5d358fad8faa101e5c69dfa54562c02cc0af), [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b), [`da58ccc`](https://github.com/mastra-ai/mastra/commit/da58ccc1f2ac33da0cb97b00443fc6208b45bdec), [`be49354`](https://github.com/mastra-ai/mastra/commit/be493546dca540101923ec700feb31f9a13939f2), [`d591ab3`](https://github.com/mastra-ai/mastra/commit/d591ab3ecc985c1870c0db347f8d7a20f7360536), [`ba82abe`](https://github.com/mastra-ai/mastra/commit/ba82abe76e869316bb5a9c95e8ea3946f3436fae), [`2a96802`](https://github.com/mastra-ai/mastra/commit/2a96802f76790ebb86a1bcb254398dccf27e5479), [`727f7e5`](https://github.com/mastra-ai/mastra/commit/727f7e5086e62e0dfe3356fb6dcd8bcb420af246), [`e6f5046`](https://github.com/mastra-ai/mastra/commit/e6f50467aff317e67e8bd74c485c3fbe2a5a6db1), [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95), [`2e58325`](https://github.com/mastra-ai/mastra/commit/2e58325beb170f5b92f856e27d915cd26917e5e6), [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c), [`de24804`](https://github.com/mastra-ai/mastra/commit/de248044e79b407d211b339ce3ed4dc6e1630704), [`4189486`](https://github.com/mastra-ai/mastra/commit/4189486c6718fda78347bdf4ce4d3fc33b2236e1), [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01), [`9613558`](https://github.com/mastra-ai/mastra/commit/9613558e6475f4710e05d1be7553a32ee7bddc20)]:
  - @mastra/core@0.15.0
  - @mastra/deployer@0.15.0

## 0.12.0-alpha.3

### Minor Changes

- [#7032](https://github.com/mastra-ai/mastra/pull/7032) [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump zod peerdep to 3.25.0 to support both v3/v4

### Patch Changes

- Updated dependencies [[`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c)]:
  - @mastra/deployer@0.15.0-alpha.4
  - @mastra/core@0.15.0-alpha.4

## 0.12.0-alpha.2

### Minor Changes

- [#7028](https://github.com/mastra-ai/mastra/pull/7028) [`da58ccc`](https://github.com/mastra-ai/mastra/commit/da58ccc1f2ac33da0cb97b00443fc6208b45bdec) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump core peerdependency

### Patch Changes

- Updated dependencies [[`da58ccc`](https://github.com/mastra-ai/mastra/commit/da58ccc1f2ac33da0cb97b00443fc6208b45bdec)]:
  - @mastra/deployer@0.15.0-alpha.3
  - @mastra/core@0.15.0-alpha.3

## 0.11.16-alpha.1

### Patch Changes

- [#6942](https://github.com/mastra-ai/mastra/pull/6942) [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01) Thanks [@wardpeet](https://github.com/wardpeet)! - Add zod as peerdeps for all packages

- Updated dependencies [[`2b38a60`](https://github.com/mastra-ai/mastra/commit/2b38a60da0c1153028d8241c7748b41c5fb81121), [`943a7f3`](https://github.com/mastra-ai/mastra/commit/943a7f3dbc6a8ab3f9b7bc7c8a1c5b319c3d7f56), [`681252d`](https://github.com/mastra-ai/mastra/commit/681252d20e57fcee6821377dea96cacab3bc230f), [`01be5d3`](https://github.com/mastra-ai/mastra/commit/01be5d358fad8faa101e5c69dfa54562c02cc0af), [`be49354`](https://github.com/mastra-ai/mastra/commit/be493546dca540101923ec700feb31f9a13939f2), [`d591ab3`](https://github.com/mastra-ai/mastra/commit/d591ab3ecc985c1870c0db347f8d7a20f7360536), [`ba82abe`](https://github.com/mastra-ai/mastra/commit/ba82abe76e869316bb5a9c95e8ea3946f3436fae), [`727f7e5`](https://github.com/mastra-ai/mastra/commit/727f7e5086e62e0dfe3356fb6dcd8bcb420af246), [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95), [`4189486`](https://github.com/mastra-ai/mastra/commit/4189486c6718fda78347bdf4ce4d3fc33b2236e1), [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01)]:
  - @mastra/deployer@0.14.2-alpha.1
  - @mastra/core@0.14.2-alpha.1

## 0.11.16-alpha.0

### Patch Changes

- Updated dependencies [[`0778757`](https://github.com/mastra-ai/mastra/commit/07787570e4addbd501522037bd2542c3d9e26822), [`e9a36bd`](https://github.com/mastra-ai/mastra/commit/e9a36bd03ed032528b60186a318f563ebf59c01a), [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b), [`e6f5046`](https://github.com/mastra-ai/mastra/commit/e6f50467aff317e67e8bd74c485c3fbe2a5a6db1), [`de24804`](https://github.com/mastra-ai/mastra/commit/de248044e79b407d211b339ce3ed4dc6e1630704), [`9613558`](https://github.com/mastra-ai/mastra/commit/9613558e6475f4710e05d1be7553a32ee7bddc20)]:
  - @mastra/core@0.14.2-alpha.0
  - @mastra/deployer@0.14.2-alpha.0

## 0.11.15

### Patch Changes

- Updated dependencies [[`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27), [`4c8956f`](https://github.com/mastra-ai/mastra/commit/4c8956f3110ccf39595e022f127a44a0a5c09c86), [`0f00e17`](https://github.com/mastra-ai/mastra/commit/0f00e172953ccdccadb35ed3d70f5e4d89115869), [`217cd7a`](https://github.com/mastra-ai/mastra/commit/217cd7a4ce171e9a575c41bb8c83300f4db03236), [`a5a23d9`](https://github.com/mastra-ai/mastra/commit/a5a23d981920d458dc6078919992a5338931ef02)]:
  - @mastra/core@0.14.1
  - @mastra/deployer@0.14.1

## 0.11.15-alpha.0

### Patch Changes

- Updated dependencies [[`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27), [`4c8956f`](https://github.com/mastra-ai/mastra/commit/4c8956f3110ccf39595e022f127a44a0a5c09c86), [`a5a23d9`](https://github.com/mastra-ai/mastra/commit/a5a23d981920d458dc6078919992a5338931ef02)]:
  - @mastra/core@0.14.1-alpha.0
  - @mastra/deployer@0.14.1-alpha.0

## 0.11.14

### Patch Changes

- 03997ae: Update peerdeps
- Updated dependencies [227c7e6]
- Updated dependencies [12cae67]
- Updated dependencies [bca2ba3]
- Updated dependencies [fd3a3eb]
- Updated dependencies [022f3a2]
- Updated dependencies [6faaee5]
- Updated dependencies [4232b14]
- Updated dependencies [6313063]
- Updated dependencies [a89de7e]
- Updated dependencies [96518cc]
- Updated dependencies [5a37d0c]
- Updated dependencies [4bde0cb]
- Updated dependencies [cf4f357]
- Updated dependencies [c712849]
- Updated dependencies [04dcd66]
- Updated dependencies [03997ae]
- Updated dependencies [ad888a2]
- Updated dependencies [481751d]
- Updated dependencies [2454423]
- Updated dependencies [194e395]
- Updated dependencies [a9916bd]
- Updated dependencies [a722c0b]
- Updated dependencies [c30bca8]
- Updated dependencies [95e1330]
- Updated dependencies [33eb340]
- Updated dependencies [3b5fec7]
- Updated dependencies [a8f129d]
- Updated dependencies [6dfc4a6]
  - @mastra/core@0.14.0
  - @mastra/deployer@0.14.0

## 0.11.14-alpha.2

### Patch Changes

- 03997ae: Update peerdeps
- Updated dependencies [03997ae]
  - @mastra/deployer@0.14.0-alpha.7
  - @mastra/core@0.14.0-alpha.7

## 0.11.14-alpha.1

### Patch Changes

- Updated dependencies [bca2ba3]
- Updated dependencies [6faaee5]
- Updated dependencies [4232b14]
- Updated dependencies [6313063]
- Updated dependencies [a89de7e]
- Updated dependencies [cf4f357]
- Updated dependencies [a722c0b]
- Updated dependencies [3b5fec7]
- Updated dependencies [6dfc4a6]
  - @mastra/deployer@0.14.0-alpha.1
  - @mastra/core@0.14.0-alpha.1

## 0.11.14-alpha.0

### Patch Changes

- Updated dependencies [c30bca8]
  - @mastra/core@0.13.3-alpha.0
  - @mastra/deployer@0.13.3-alpha.0

## 0.11.13

### Patch Changes

- Updated dependencies [d5330bf]
- Updated dependencies [aaf0224]
- Updated dependencies [2e74797]
- Updated dependencies [42cb4e9]
- Updated dependencies [8388649]
- Updated dependencies [a239d41]
- Updated dependencies [dd94a26]
- Updated dependencies [3ba6772]
- Updated dependencies [96169cc]
- Updated dependencies [b5cf2a3]
- Updated dependencies [2fff911]
- Updated dependencies [b32c50d]
- Updated dependencies [c6d2603]
- Updated dependencies [63449d0]
- Updated dependencies [121a3f8]
- Updated dependencies [ce04175]
- Updated dependencies [ec510e7]
  - @mastra/core@0.13.2
  - @mastra/deployer@0.13.2

## 0.11.13-alpha.0

### Patch Changes

- Updated dependencies [8388649]
- Updated dependencies [dd94a26]
- Updated dependencies [3ba6772]
- Updated dependencies [2fff911]
  - @mastra/core@0.13.2-alpha.0
  - @mastra/deployer@0.13.2-alpha.0

## 0.11.12

### Patch Changes

- Updated dependencies [cd0042e]
  - @mastra/core@0.13.1
  - @mastra/deployer@0.13.1

## 0.11.12-alpha.0

### Patch Changes

- Updated dependencies [cd0042e]
  - @mastra/core@0.13.1-alpha.0
  - @mastra/deployer@0.13.1-alpha.0

## 0.11.11

### Patch Changes

- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility
- Updated dependencies [cb36de0]
- Updated dependencies [d0496e6]
- Updated dependencies [7b8172f]
- Updated dependencies [cb36de0]
- Updated dependencies [d0496e6]
- Updated dependencies [a82b851]
- Updated dependencies [ea0c5f2]
- Updated dependencies [41a0a0e]
- Updated dependencies [2871020]
- Updated dependencies [94f4812]
- Updated dependencies [e202b82]
- Updated dependencies [e00f6a0]
- Updated dependencies [4a406ec]
- Updated dependencies [b0e43c1]
- Updated dependencies [5d377e5]
- Updated dependencies [1fb812e]
- Updated dependencies [35c5798]
  - @mastra/core@0.13.0
  - @mastra/deployer@0.13.0

## 0.11.11-alpha.2

### Patch Changes

- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility
- Updated dependencies [cb36de0]
- Updated dependencies [cb36de0]
- Updated dependencies [a82b851]
- Updated dependencies [41a0a0e]
- Updated dependencies [2871020]
- Updated dependencies [4a406ec]
- Updated dependencies [5d377e5]
  - @mastra/core@0.13.0-alpha.2
  - @mastra/deployer@0.13.0-alpha.2

## 0.11.11-alpha.1

### Patch Changes

- Updated dependencies [7b8172f]
- Updated dependencies [ea0c5f2]
- Updated dependencies [b0e43c1]
- Updated dependencies [1fb812e]
- Updated dependencies [35c5798]
  - @mastra/deployer@0.13.0-alpha.1
  - @mastra/core@0.13.0-alpha.1

## 0.11.11-alpha.0

### Patch Changes

- Updated dependencies [94f4812]
- Updated dependencies [e202b82]
- Updated dependencies [e00f6a0]
  - @mastra/core@0.12.2-alpha.0
  - @mastra/deployer@0.12.2-alpha.0

## 0.11.10

### Patch Changes

- Updated dependencies [33dcb07]
- Updated dependencies [d0d9500]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [07fe7a2]
- Updated dependencies [b4a8df0]
  - @mastra/core@0.12.1
  - @mastra/deployer@0.12.1

## 0.11.10-alpha.0

### Patch Changes

- Updated dependencies [33dcb07]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [07fe7a2]
- Updated dependencies [b4a8df0]
  - @mastra/core@0.12.1-alpha.0
  - @mastra/deployer@0.12.1-alpha.0

## 0.11.9

### Patch Changes

- bc6b44a: Extract tools import from `createHonoServer`; the function now receives tools via a prop on the `options` parameter.
- f42c4c2: update peer deps for packages to latest core range
- Updated dependencies [510e2c8]
- Updated dependencies [2f72fb2]
- Updated dependencies [27cc97a]
- Updated dependencies [832691b]
- Updated dependencies [557bb9d]
- Updated dependencies [27cc97a]
- Updated dependencies [3f89307]
- Updated dependencies [9eda7d4]
- Updated dependencies [9d49408]
- Updated dependencies [bc6b44a]
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
- Updated dependencies [9802f42]
- Updated dependencies [d5cc460]
- Updated dependencies [f42c4c2]
- Updated dependencies [b8efbb9]
- Updated dependencies [71466e7]
- Updated dependencies [0c99fbe]
  - @mastra/core@0.12.0
  - @mastra/deployer@0.12.0

## 0.11.9-alpha.1

### Patch Changes

- f42c4c2: update peer deps for packages to latest core range
- Updated dependencies [f42c4c2]
  - @mastra/deployer@0.12.0-alpha.5
  - @mastra/core@0.12.0-alpha.5

## 0.11.9-alpha.0

### Patch Changes

- bc6b44a: Extract tools import from `createHonoServer`; the function now receives tools via a prop on the `options` parameter.
- Updated dependencies [510e2c8]
- Updated dependencies [2f72fb2]
- Updated dependencies [832691b]
- Updated dependencies [557bb9d]
- Updated dependencies [3f89307]
- Updated dependencies [9eda7d4]
- Updated dependencies [9d49408]
- Updated dependencies [bc6b44a]
- Updated dependencies [2ecf658]
- Updated dependencies [7a7754f]
- Updated dependencies [fc92d80]
- Updated dependencies [23a6a7c]
- Updated dependencies [09bca64]
  - @mastra/core@0.12.0-alpha.0
  - @mastra/deployer@0.12.0-alpha.0

## 0.11.8

### Patch Changes

- 1a45f3a: Fix peerdeps

## 0.11.7

### Patch Changes

- Updated dependencies [f248d53]
- Updated dependencies [82c6860]
- Updated dependencies [2affc57]
- Updated dependencies [66e13e3]
- Updated dependencies [edd9482]
- Updated dependencies [0938991]
- Updated dependencies [18344d7]
- Updated dependencies [7ba91fa]
- Updated dependencies [a512ede]
- Updated dependencies [35b1155]
- Updated dependencies [9d372c2]
- Updated dependencies [45469c5]
- Updated dependencies [40c2525]
- Updated dependencies [e473f27]
- Updated dependencies [032cb66]
- Updated dependencies [6f50efd]
- Updated dependencies [24eb25c]
- Updated dependencies [bf6903e]
- Updated dependencies [703ac71]
- Updated dependencies [a723d69]
- Updated dependencies [7827943]
- Updated dependencies [4c06f06]
- Updated dependencies [5889a31]
- Updated dependencies [bf1e7e7]
- Updated dependencies [65e3395]
- Updated dependencies [9de6f58]
- Updated dependencies [4933192]
- Updated dependencies [d1c77a4]
- Updated dependencies [bea9dd1]
- Updated dependencies [7983e53]
- Updated dependencies [dcd4802]
- Updated dependencies [cbddd18]
- Updated dependencies [7ba91fa]
- Updated dependencies [15ce274]
  - @mastra/core@0.11.0
  - @mastra/deployer@0.11.0

## 0.11.7-alpha.0

### Patch Changes

- Updated dependencies [0938991]
- Updated dependencies [6f50efd]
- Updated dependencies [bf6903e]
- Updated dependencies [7827943]
- Updated dependencies [bf1e7e7]
- Updated dependencies [cbddd18]
  - @mastra/deployer@0.11.0-alpha.0
  - @mastra/core@0.11.0-alpha.0

## 0.11.6

### Patch Changes

- Updated dependencies [7776324]
- Updated dependencies [0b56518]
- Updated dependencies [db5cc15]
- Updated dependencies [2ba5b76]
- Updated dependencies [7b57e2c]
- Updated dependencies [5237998]
- Updated dependencies [c3a30de]
- Updated dependencies [37c1acd]
- Updated dependencies [1aa60b1]
- Updated dependencies [89ec9d4]
- Updated dependencies [cf3a184]
- Updated dependencies [fe4bbd4]
- Updated dependencies [d6bfd60]
- Updated dependencies [626b0f4]
- Updated dependencies [c22a91f]
- Updated dependencies [f7403ab]
- Updated dependencies [6c89d7f]
  - @mastra/deployer@0.10.15
  - @mastra/core@0.10.15

## 0.11.6-alpha.0

### Patch Changes

- Updated dependencies [7776324]
- Updated dependencies [db5cc15]
- Updated dependencies [7b57e2c]
- Updated dependencies [5237998]
- Updated dependencies [37c1acd]
- Updated dependencies [1aa60b1]
- Updated dependencies [89ec9d4]
- Updated dependencies [626b0f4]
- Updated dependencies [c22a91f]
- Updated dependencies [f7403ab]
- Updated dependencies [6c89d7f]
  - @mastra/deployer@0.10.15-alpha.0
  - @mastra/core@0.10.15-alpha.0

## 0.11.5

### Patch Changes

- Updated dependencies [b4a9811]
- Updated dependencies [4d5583d]
- Updated dependencies [53e3f58]
  - @mastra/core@0.10.12
  - @mastra/deployer@0.10.12

## 0.11.5-alpha.0

### Patch Changes

- Updated dependencies [b4a9811]
- Updated dependencies [53e3f58]
  - @mastra/core@0.10.12-alpha.0
  - @mastra/deployer@0.10.12-alpha.0

## 0.11.4

### Patch Changes

- Updated dependencies [2873c7f]
- Updated dependencies [1c1c6a1]
- Updated dependencies [bc40cdd]
- Updated dependencies [2873c7f]
- Updated dependencies [1c1c6a1]
- Updated dependencies [d9b26b5]
- Updated dependencies [f8ce2cc]
- Updated dependencies [8c846b6]
- Updated dependencies [c7bbf1e]
- Updated dependencies [8722d53]
- Updated dependencies [565cc0c]
- Updated dependencies [b790fd1]
- Updated dependencies [132027f]
- Updated dependencies [0c85311]
- Updated dependencies [d7ed04d]
- Updated dependencies [18ca936]
- Updated dependencies [cb16baf]
- Updated dependencies [40cd025]
- Updated dependencies [f36e4f1]
- Updated dependencies [7f6e403]
  - @mastra/core@0.10.11
  - @mastra/deployer@0.10.11

## 0.11.4-alpha.0

### Patch Changes

- Updated dependencies [bc40cdd]
- Updated dependencies [f8ce2cc]
- Updated dependencies [8c846b6]
- Updated dependencies [b790fd1]
- Updated dependencies [d7ed04d]
- Updated dependencies [f36e4f1]
  - @mastra/deployer@0.10.11-alpha.0
  - @mastra/core@0.10.11-alpha.0

## 0.11.3

### Patch Changes

- Updated dependencies [6e13b80]
- Updated dependencies [6997af1]
- Updated dependencies [4d3fbdf]
  - @mastra/deployer@0.10.10
  - @mastra/core@0.10.10

## 0.11.3-alpha.0

### Patch Changes

- Updated dependencies [6e13b80]
- Updated dependencies [4d3fbdf]
  - @mastra/deployer@0.10.10-alpha.0
  - @mastra/core@0.10.10-alpha.0

## 0.11.2

### Patch Changes

- Updated dependencies [9dda1ac]
- Updated dependencies [9dda1ac]
- Updated dependencies [c984582]
- Updated dependencies [7e801dd]
- Updated dependencies [a606c75]
- Updated dependencies [7aa70a4]
- Updated dependencies [764f86a]
- Updated dependencies [1760a1c]
- Updated dependencies [038e5ae]
- Updated dependencies [7dda16a]
- Updated dependencies [6f87544]
- Updated dependencies [5ebfcdd]
- Updated dependencies [81a1b3b]
- Updated dependencies [b2d0c91]
- Updated dependencies [4e809ad]
- Updated dependencies [57929df]
- Updated dependencies [7e801dd]
- Updated dependencies [b7852ed]
- Updated dependencies [6320a61]
  - @mastra/core@0.10.9
  - @mastra/deployer@0.10.9

## 0.11.2-alpha.0

### Patch Changes

- Updated dependencies [9dda1ac]
- Updated dependencies [9dda1ac]
- Updated dependencies [c984582]
- Updated dependencies [7e801dd]
- Updated dependencies [a606c75]
- Updated dependencies [7aa70a4]
- Updated dependencies [764f86a]
- Updated dependencies [1760a1c]
- Updated dependencies [038e5ae]
- Updated dependencies [7dda16a]
- Updated dependencies [6f87544]
- Updated dependencies [5ebfcdd]
- Updated dependencies [81a1b3b]
- Updated dependencies [b2d0c91]
- Updated dependencies [4e809ad]
- Updated dependencies [57929df]
- Updated dependencies [7e801dd]
- Updated dependencies [b7852ed]
- Updated dependencies [6320a61]
  - @mastra/core@0.10.9-alpha.0
  - @mastra/deployer@0.10.9-alpha.0

## 0.11.1

### Patch Changes

- Updated dependencies [b8f16b2]
- Updated dependencies [3e04487]
- Updated dependencies [a344ac7]
- Updated dependencies [dc4ca0a]
  - @mastra/core@0.10.8
  - @mastra/deployer@0.10.8

## 0.11.1-alpha.1

### Patch Changes

- Updated dependencies [b8f16b2]
- Updated dependencies [3e04487]
- Updated dependencies [dc4ca0a]
  - @mastra/core@0.10.8-alpha.1
  - @mastra/deployer@0.10.8-alpha.1

## 0.11.1-alpha.0

### Patch Changes

- Updated dependencies [a344ac7]
  - @mastra/deployer@0.10.8-alpha.0
  - @mastra/core@0.10.8-alpha.0

## 0.11.0

### Minor Changes

- 3df52d1: fix deployers netlify and vercel on both cli and git integrations, improve DX

### Patch Changes

- 8e1b6e9: dependencies updates:
  - Updated dependency [`zod@^3.25.67` ↗︎](https://www.npmjs.com/package/zod/v/3.25.67) (from `^3.25.57`, in `dependencies`)
- Updated dependencies [8e1b6e9]
- Updated dependencies [36cd0f1]
- Updated dependencies [2eab82b]
- Updated dependencies [15e9d26]
- Updated dependencies [d1baedb]
- Updated dependencies [d8f2d19]
- Updated dependencies [9bf1d55]
- Updated dependencies [4d21bf2]
- Updated dependencies [914684e]
- Updated dependencies [07d6d88]
- Updated dependencies [9d52b17]
- Updated dependencies [2097952]
- Updated dependencies [792c4c0]
- Updated dependencies [5d74aab]
- Updated dependencies [5d74aab]
- Updated dependencies [17903a3]
- Updated dependencies [a8b194f]
- Updated dependencies [4fb0cc2]
- Updated dependencies [d2a7a31]
- Updated dependencies [502fe05]
- Updated dependencies [144eb0b]
- Updated dependencies [8ba1b51]
- Updated dependencies [10a4f10]
- Updated dependencies [4efcfa0]
- Updated dependencies [0e17048]
  - @mastra/deployer@0.10.7
  - @mastra/core@0.10.7

## 0.11.0-alpha.5

### Patch Changes

- @mastra/core@0.10.7-alpha.5
- @mastra/deployer@0.10.7-alpha.5

## 0.11.0-alpha.4

### Patch Changes

- Updated dependencies [a8b194f]
  - @mastra/core@0.10.7-alpha.4
  - @mastra/deployer@0.10.7-alpha.4

## 0.11.0-alpha.3

### Minor Changes

- 3df52d1: fix deployers netlify and vercel on both cli and git integrations, improve DX

### Patch Changes

- Updated dependencies [792c4c0]
- Updated dependencies [502fe05]
- Updated dependencies [10a4f10]
- Updated dependencies [4efcfa0]
  - @mastra/core@0.10.7-alpha.3
  - @mastra/deployer@0.10.7-alpha.3

## 0.10.7-alpha.2

### Patch Changes

- 8e1b6e9: dependencies updates:
  - Updated dependency [`zod@^3.25.67` ↗︎](https://www.npmjs.com/package/zod/v/3.25.67) (from `^3.25.57`, in `dependencies`)
- Updated dependencies [8e1b6e9]
- Updated dependencies [36cd0f1]
- Updated dependencies [2eab82b]
- Updated dependencies [15e9d26]
- Updated dependencies [9bf1d55]
- Updated dependencies [914684e]
- Updated dependencies [07d6d88]
- Updated dependencies [5d74aab]
- Updated dependencies [5d74aab]
- Updated dependencies [17903a3]
- Updated dependencies [144eb0b]
  - @mastra/deployer@0.10.7-alpha.2
  - @mastra/core@0.10.7-alpha.2

## 0.10.7-alpha.1

### Patch Changes

- Updated dependencies [d1baedb]
- Updated dependencies [4d21bf2]
- Updated dependencies [2097952]
- Updated dependencies [4fb0cc2]
- Updated dependencies [d2a7a31]
- Updated dependencies [0e17048]
  - @mastra/core@0.10.7-alpha.1
  - @mastra/deployer@0.10.7-alpha.1

## 0.10.7-alpha.0

### Patch Changes

- Updated dependencies [d8f2d19]
- Updated dependencies [9d52b17]
- Updated dependencies [8ba1b51]
  - @mastra/core@0.10.7-alpha.0
  - @mastra/deployer@0.10.7-alpha.0

## 0.10.6

### Patch Changes

- 63f6b7d: dependencies updates:
  - Updated dependency [`zod@^3.25.57` ↗︎](https://www.npmjs.com/package/zod/v/3.25.57) (from `^3.25.56`, in `dependencies`)
  - Removed dependency [`netlify-cli@^19.1.7` ↗︎](https://www.npmjs.com/package/netlify-cli/v/19.1.7) (from `dependencies`)
- Updated dependencies [63f6b7d]
- Updated dependencies [4051477]
- Updated dependencies [2d12edd]
- Updated dependencies [63f6b7d]
- Updated dependencies [c28ed65]
- Updated dependencies [12a95fc]
- Updated dependencies [79b9909]
- Updated dependencies [4b0f8a6]
- Updated dependencies [51264a5]
- Updated dependencies [8e6f677]
- Updated dependencies [d70c420]
- Updated dependencies [ee9af57]
- Updated dependencies [ec7f824]
- Updated dependencies [36f1c36]
- Updated dependencies [084f6aa]
- Updated dependencies [2a16996]
- Updated dependencies [10d352e]
- Updated dependencies [9589624]
- Updated dependencies [3270d9d]
- Updated dependencies [53d3c37]
- Updated dependencies [751c894]
- Updated dependencies [577ce3a]
- Updated dependencies [9260b3a]
  - @mastra/core@0.10.6
  - @mastra/deployer@0.10.6

## 0.10.6-alpha.5

### Patch Changes

- Updated dependencies [12a95fc]
- Updated dependencies [51264a5]
- Updated dependencies [8e6f677]
  - @mastra/core@0.10.6-alpha.5
  - @mastra/deployer@0.10.6-alpha.5

## 0.10.6-alpha.4

### Patch Changes

- Updated dependencies [79b9909]
- Updated dependencies [084f6aa]
- Updated dependencies [9589624]
  - @mastra/deployer@0.10.6-alpha.4
  - @mastra/core@0.10.6-alpha.4

## 0.10.6-alpha.3

### Patch Changes

- Updated dependencies [4051477]
- Updated dependencies [c28ed65]
- Updated dependencies [d70c420]
- Updated dependencies [2a16996]
  - @mastra/deployer@0.10.6-alpha.3
  - @mastra/core@0.10.6-alpha.3

## 0.10.6-alpha.2

### Patch Changes

- Updated dependencies [4b0f8a6]
- Updated dependencies [ec7f824]
  - @mastra/core@0.10.6-alpha.2
  - @mastra/deployer@0.10.6-alpha.2

## 0.10.6-alpha.1

### Patch Changes

- Updated dependencies [ee9af57]
- Updated dependencies [3270d9d]
- Updated dependencies [751c894]
- Updated dependencies [577ce3a]
- Updated dependencies [9260b3a]
  - @mastra/deployer@0.10.6-alpha.1
  - @mastra/core@0.10.6-alpha.1

## 0.10.6-alpha.0

### Patch Changes

- 63f6b7d: dependencies updates:
  - Updated dependency [`zod@^3.25.57` ↗︎](https://www.npmjs.com/package/zod/v/3.25.57) (from `^3.25.56`, in `dependencies`)
  - Removed dependency [`netlify-cli@^19.1.7` ↗︎](https://www.npmjs.com/package/netlify-cli/v/19.1.7) (from `dependencies`)
- Updated dependencies [63f6b7d]
- Updated dependencies [2d12edd]
- Updated dependencies [63f6b7d]
- Updated dependencies [36f1c36]
- Updated dependencies [10d352e]
- Updated dependencies [53d3c37]
  - @mastra/core@0.10.6-alpha.0
  - @mastra/deployer@0.10.6-alpha.0

## 0.10.5

### Patch Changes

- Updated dependencies [8725d02]
- Updated dependencies [13c97f9]
- Updated dependencies [105f872]
  - @mastra/deployer@0.10.5
  - @mastra/core@0.10.5

## 0.10.4

### Patch Changes

- d90c49f: dependencies updates:
  - Updated dependency [`execa@^9.6.0` ↗︎](https://www.npmjs.com/package/execa/v/9.6.0) (from `^9.5.2`, in `dependencies`)
  - Updated dependency [`netlify-cli@^19.1.7` ↗︎](https://www.npmjs.com/package/netlify-cli/v/19.1.7) (from `^19.0.3`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- Updated dependencies [d1ed912]
- Updated dependencies [d1ed912]
- Updated dependencies [f595975]
- Updated dependencies [d90c49f]
- Updated dependencies [1ccccff]
- Updated dependencies [1ccccff]
- Updated dependencies [afd9fda]
- Updated dependencies [f6fd25f]
- Updated dependencies [dffb67b]
- Updated dependencies [f1f1f1b]
- Updated dependencies [925ab94]
- Updated dependencies [9597ee5]
- Updated dependencies [f9816ae]
- Updated dependencies [82090c1]
- Updated dependencies [69f6101]
- Updated dependencies [1b443fd]
- Updated dependencies [ce97900]
- Updated dependencies [514fdde]
- Updated dependencies [f1309d3]
- Updated dependencies [bebd27c]
- Updated dependencies [14a2566]
- Updated dependencies [f7f8293]
- Updated dependencies [48eddb9]
  - @mastra/core@0.10.4
  - @mastra/deployer@0.10.4

## 0.10.4-alpha.3

### Patch Changes

- Updated dependencies [925ab94]
  - @mastra/core@0.10.4-alpha.3
  - @mastra/deployer@0.10.4-alpha.3

## 0.10.4-alpha.2

### Patch Changes

- Updated dependencies [48eddb9]
  - @mastra/core@0.10.4-alpha.2
  - @mastra/deployer@0.10.4-alpha.2

## 0.10.4-alpha.1

### Patch Changes

- d90c49f: dependencies updates:
  - Updated dependency [`execa@^9.6.0` ↗︎](https://www.npmjs.com/package/execa/v/9.6.0) (from `^9.5.2`, in `dependencies`)
  - Updated dependency [`netlify-cli@^19.1.7` ↗︎](https://www.npmjs.com/package/netlify-cli/v/19.1.7) (from `^19.0.3`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- Updated dependencies [d90c49f]
- Updated dependencies [1ccccff]
- Updated dependencies [1ccccff]
- Updated dependencies [f6fd25f]
- Updated dependencies [dffb67b]
- Updated dependencies [9597ee5]
- Updated dependencies [514fdde]
- Updated dependencies [f1309d3]
- Updated dependencies [bebd27c]
- Updated dependencies [f7f8293]
  - @mastra/deployer@0.10.4-alpha.1
  - @mastra/core@0.10.4-alpha.1

## 0.10.4-alpha.0

### Patch Changes

- Updated dependencies [d1ed912]
- Updated dependencies [d1ed912]
- Updated dependencies [f595975]
- Updated dependencies [afd9fda]
- Updated dependencies [f1f1f1b]
- Updated dependencies [f9816ae]
- Updated dependencies [82090c1]
- Updated dependencies [69f6101]
- Updated dependencies [1b443fd]
- Updated dependencies [ce97900]
- Updated dependencies [14a2566]
  - @mastra/core@0.10.4-alpha.0
  - @mastra/deployer@0.10.4-alpha.0

## 0.10.3

### Patch Changes

- Updated dependencies [2b0fc7e]
  - @mastra/core@0.10.3
  - @mastra/deployer@0.10.3

## 0.10.3-alpha.0

### Patch Changes

- Updated dependencies [2b0fc7e]
  - @mastra/core@0.10.3-alpha.0
  - @mastra/deployer@0.10.3-alpha.0

## 0.10.2

### Patch Changes

- f0d559f: Fix peerdeps for alpha channel
- Updated dependencies [ee77e78]
- Updated dependencies [592a2db]
- Updated dependencies [e5dc18d]
- Updated dependencies [ab5adbe]
- Updated dependencies [e8d2aff]
- Updated dependencies [1e8bb40]
- Updated dependencies [1b5fc55]
- Updated dependencies [195c428]
- Updated dependencies [f73e11b]
- Updated dependencies [37643b8]
- Updated dependencies [99fd6cf]
- Updated dependencies [1fcc048]
- Updated dependencies [c5bf1ce]
- Updated dependencies [f946acf]
- Updated dependencies [add596e]
- Updated dependencies [8dc94d8]
- Updated dependencies [ecebbeb]
- Updated dependencies [4187ed4]
- Updated dependencies [79d5145]
- Updated dependencies [12b7002]
- Updated dependencies [f0d559f]
- Updated dependencies [2901125]
  - @mastra/core@0.10.2
  - @mastra/deployer@0.10.2

## 0.10.2-alpha.8

### Patch Changes

- Updated dependencies [37643b8]
- Updated dependencies [79d5145]
  - @mastra/core@0.10.2-alpha.8
  - @mastra/deployer@0.10.2-alpha.8

## 0.10.2-alpha.7

### Patch Changes

- @mastra/deployer@0.10.2-alpha.7
- @mastra/core@0.10.2-alpha.7

## 0.10.2-alpha.6

### Patch Changes

- Updated dependencies [99fd6cf]
- Updated dependencies [1fcc048]
- Updated dependencies [8dc94d8]
  - @mastra/core@0.10.2-alpha.6
  - @mastra/deployer@0.10.2-alpha.6

## 0.10.2-alpha.5

### Patch Changes

- Updated dependencies [1b5fc55]
- Updated dependencies [add596e]
- Updated dependencies [ecebbeb]
  - @mastra/core@0.10.2-alpha.5
  - @mastra/deployer@0.10.2-alpha.5

## 0.10.2-alpha.4

### Patch Changes

- Updated dependencies [c5bf1ce]
- Updated dependencies [12b7002]
  - @mastra/core@0.10.2-alpha.4
  - @mastra/deployer@0.10.2-alpha.4

## 0.10.2-alpha.3

### Patch Changes

- Updated dependencies [ab5adbe]
- Updated dependencies [195c428]
- Updated dependencies [f73e11b]
- Updated dependencies [f946acf]
  - @mastra/core@0.10.2-alpha.3
  - @mastra/deployer@0.10.2-alpha.3

## 0.10.2-alpha.2

### Patch Changes

- f0d559f: Fix peerdeps for alpha channel
- Updated dependencies [e8d2aff]
- Updated dependencies [1e8bb40]
- Updated dependencies [4187ed4]
- Updated dependencies [f0d559f]
  - @mastra/deployer@0.10.2-alpha.2
  - @mastra/core@0.10.2-alpha.2

## 0.10.2-alpha.1

### Patch Changes

- Updated dependencies [ee77e78]
- Updated dependencies [2901125]
  - @mastra/core@0.10.2-alpha.1
  - @mastra/deployer@0.10.2-alpha.1

## 0.10.2-alpha.0

### Patch Changes

- Updated dependencies [592a2db]
- Updated dependencies [e5dc18d]
  - @mastra/core@0.10.2-alpha.0
  - @mastra/deployer@0.10.2-alpha.0

## 0.10.1

### Patch Changes

- d70b807: Improve storage.init
- Updated dependencies [d70b807]
- Updated dependencies [6d16390]
- Updated dependencies [1e4a421]
- Updated dependencies [200d0da]
- Updated dependencies [bed0916]
- Updated dependencies [bf5f17b]
- Updated dependencies [5343f93]
- Updated dependencies [38aee50]
- Updated dependencies [5c41100]
- Updated dependencies [d6a759b]
- Updated dependencies [fe68410]
- Updated dependencies [6015bdf]
  - @mastra/core@0.10.1
  - @mastra/deployer@0.10.1

## 0.10.1-alpha.3

### Patch Changes

- d70b807: Improve storage.init
- Updated dependencies [d70b807]
  - @mastra/core@0.10.1-alpha.3
  - @mastra/deployer@0.10.1-alpha.3

## 0.10.1-alpha.2

### Patch Changes

- Updated dependencies [fe68410]
- Updated dependencies [6015bdf]
  - @mastra/deployer@0.10.1-alpha.2
  - @mastra/core@0.10.1-alpha.2

## 0.10.1-alpha.1

### Patch Changes

- Updated dependencies [200d0da]
- Updated dependencies [bed0916]
- Updated dependencies [bf5f17b]
- Updated dependencies [5343f93]
- Updated dependencies [38aee50]
- Updated dependencies [5c41100]
- Updated dependencies [d6a759b]
  - @mastra/core@0.10.1-alpha.1
  - @mastra/deployer@0.10.1-alpha.1

## 0.10.1-alpha.0

### Patch Changes

- Updated dependencies [6d16390]
- Updated dependencies [1e4a421]
  - @mastra/deployer@0.10.1-alpha.0
  - @mastra/core@0.10.1-alpha.0

## 0.10.0

### Minor Changes

- 83da932: Move @mastra/core to peerdeps

### Patch Changes

- Updated dependencies [b3a3d63]
- Updated dependencies [344f453]
- Updated dependencies [0a3ae6d]
- Updated dependencies [95911be]
- Updated dependencies [83da932]
- Updated dependencies [f53a6ac]
- Updated dependencies [5eb5a99]
- Updated dependencies [7e632c5]
- Updated dependencies [1e9fbfa]
- Updated dependencies [eabdcd9]
- Updated dependencies [90be034]
- Updated dependencies [8d9feae]
- Updated dependencies [aaf0e48]
- Updated dependencies [99f050a]
- Updated dependencies [d0ee3c6]
- Updated dependencies [b2ae5aa]
- Updated dependencies [48e5910]
- Updated dependencies [23f258c]
- Updated dependencies [a7292b0]
- Updated dependencies [0dcb9f0]
- Updated dependencies [2672a05]
  - @mastra/deployer@0.10.0
  - @mastra/core@0.10.0

## 0.2.0-alpha.1

### Minor Changes

- 83da932: Move @mastra/core to peerdeps

### Patch Changes

- Updated dependencies [b3a3d63]
- Updated dependencies [344f453]
- Updated dependencies [0a3ae6d]
- Updated dependencies [95911be]
- Updated dependencies [83da932]
- Updated dependencies [5eb5a99]
- Updated dependencies [7e632c5]
- Updated dependencies [1e9fbfa]
- Updated dependencies [8d9feae]
- Updated dependencies [b2ae5aa]
- Updated dependencies [a7292b0]
- Updated dependencies [0dcb9f0]
  - @mastra/deployer@0.4.0-alpha.1
  - @mastra/core@0.10.0-alpha.1

## 0.1.24-alpha.0

### Patch Changes

- Updated dependencies [f53a6ac]
- Updated dependencies [eabdcd9]
- Updated dependencies [90be034]
- Updated dependencies [aaf0e48]
- Updated dependencies [99f050a]
- Updated dependencies [d0ee3c6]
- Updated dependencies [48e5910]
- Updated dependencies [23f258c]
- Updated dependencies [2672a05]
  - @mastra/core@0.9.5-alpha.0
  - @mastra/deployer@0.3.5-alpha.0

## 0.1.23

### Patch Changes

- Updated dependencies [396be50]
- Updated dependencies [ab80e7e]
- Updated dependencies [5c70b8a]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [a5810ce]
- Updated dependencies [3e9c131]
- Updated dependencies [3171b5b]
- Updated dependencies [03c40d1]
- Updated dependencies [cb1f698]
- Updated dependencies [973e5ac]
- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
- Updated dependencies [9e1eff5]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/core@0.9.4
  - @mastra/deployer@0.3.4

## 0.1.23-alpha.4

### Patch Changes

- Updated dependencies [5c70b8a]
- Updated dependencies [3e9c131]
  - @mastra/deployer@0.3.4-alpha.4
  - @mastra/core@0.9.4-alpha.4

## 0.1.23-alpha.3

### Patch Changes

- Updated dependencies [396be50]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [a5810ce]
  - @mastra/core@0.9.4-alpha.3
  - @mastra/deployer@0.3.4-alpha.3

## 0.1.23-alpha.2

### Patch Changes

- Updated dependencies [3171b5b]
- Updated dependencies [03c40d1]
- Updated dependencies [973e5ac]
- Updated dependencies [9e1eff5]
  - @mastra/core@0.9.4-alpha.2
  - @mastra/deployer@0.3.4-alpha.2

## 0.1.23-alpha.1

### Patch Changes

- Updated dependencies [ab80e7e]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/core@0.9.4-alpha.1
  - @mastra/deployer@0.3.4-alpha.1

## 0.1.23-alpha.0

### Patch Changes

- Updated dependencies [cb1f698]
- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
  - @mastra/deployer@0.3.4-alpha.0
  - @mastra/core@0.9.4-alpha.0

## 0.1.22

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
  - @mastra/deployer@0.3.3

## 0.1.22-alpha.1

### Patch Changes

- Updated dependencies [e450778]
- Updated dependencies [8902157]
- Updated dependencies [ca0dc88]
- Updated dependencies [9cd1a46]
- Updated dependencies [70dbf51]
  - @mastra/core@0.9.3-alpha.1
  - @mastra/deployer@0.3.3-alpha.1

## 0.1.22-alpha.0

### Patch Changes

- Updated dependencies [526c570]
- Updated dependencies [b5d2de0]
- Updated dependencies [644f8ad]
  - @mastra/core@0.9.3-alpha.0
  - @mastra/deployer@0.3.3-alpha.0

## 0.1.21

### Patch Changes

- 2cf3b8f: dependencies updates:
  - Updated dependency [`zod@^3.24.3` ↗︎](https://www.npmjs.com/package/zod/v/3.24.3) (from `^3.24.2`, in `dependencies`)
- 8607972: Introduce Mastra lint cli command
- Updated dependencies [2cf3b8f]
- Updated dependencies [6052aa6]
- Updated dependencies [967b41c]
- Updated dependencies [3d2fb5c]
- Updated dependencies [26738f4]
- Updated dependencies [4155f47]
- Updated dependencies [254f5c3]
- Updated dependencies [7eeb2bc]
- Updated dependencies [b804723]
- Updated dependencies [8607972]
- Updated dependencies [a798090]
- Updated dependencies [ccef9f9]
- Updated dependencies [0097d50]
- Updated dependencies [7eeb2bc]
- Updated dependencies [17826a9]
- Updated dependencies [7d8b7c7]
- Updated dependencies [fba031f]
- Updated dependencies [3a5f1e1]
- Updated dependencies [51e6923]
- Updated dependencies [8398d89]
  - @mastra/deployer@0.3.2
  - @mastra/core@0.9.2

## 0.1.21-alpha.6

### Patch Changes

- Updated dependencies [6052aa6]
- Updated dependencies [a798090]
- Updated dependencies [7d8b7c7]
- Updated dependencies [3a5f1e1]
- Updated dependencies [8398d89]
  - @mastra/core@0.9.2-alpha.6
  - @mastra/deployer@0.3.2-alpha.6

## 0.1.21-alpha.5

### Patch Changes

- 8607972: Introduce Mastra lint cli command
- Updated dependencies [3d2fb5c]
- Updated dependencies [7eeb2bc]
- Updated dependencies [8607972]
- Updated dependencies [7eeb2bc]
- Updated dependencies [fba031f]
  - @mastra/core@0.9.2-alpha.5
  - @mastra/deployer@0.3.2-alpha.5

## 0.1.21-alpha.4

### Patch Changes

- Updated dependencies [ccef9f9]
- Updated dependencies [51e6923]
  - @mastra/core@0.9.2-alpha.4
  - @mastra/deployer@0.3.2-alpha.4

## 0.1.21-alpha.3

### Patch Changes

- Updated dependencies [967b41c]
- Updated dependencies [4155f47]
- Updated dependencies [17826a9]
  - @mastra/core@0.9.2-alpha.3
  - @mastra/deployer@0.3.2-alpha.3

## 0.1.21-alpha.2

### Patch Changes

- Updated dependencies [26738f4]
  - @mastra/core@0.9.2-alpha.2
  - @mastra/deployer@0.3.2-alpha.2

## 0.1.21-alpha.1

### Patch Changes

- Updated dependencies [254f5c3]
- Updated dependencies [b804723]
  - @mastra/deployer@0.3.2-alpha.1
  - @mastra/core@0.9.2-alpha.1

## 0.1.21-alpha.0

### Patch Changes

- Updated dependencies [0097d50]
  - @mastra/core@0.9.2-alpha.0
  - @mastra/deployer@0.3.2-alpha.0

## 0.1.20

### Patch Changes

- Updated dependencies [e7c2881]
- Updated dependencies [0ccb8b4]
- Updated dependencies [92c598d]
- Updated dependencies [405b63d]
- Updated dependencies [81fb7f6]
- Updated dependencies [20275d4]
- Updated dependencies [7d1892c]
- Updated dependencies [ebdb781]
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
- Updated dependencies [530ced1]
- Updated dependencies [c23a81c]
- Updated dependencies [611aa4a]
- Updated dependencies [2d4001d]
- Updated dependencies [c71013a]
- Updated dependencies [1d3b1cd]
  - @mastra/deployer@0.3.1
  - @mastra/core@0.9.1

## 0.1.20-alpha.8

### Patch Changes

- Updated dependencies [2d17c73]
  - @mastra/core@0.9.1-alpha.8
  - @mastra/deployer@0.3.1-alpha.8

## 0.1.20-alpha.7

### Patch Changes

- Updated dependencies [1d3b1cd]
  - @mastra/core@0.9.1-alpha.7
  - @mastra/deployer@0.3.1-alpha.7

## 0.1.20-alpha.6

### Patch Changes

- Updated dependencies [c23a81c]
  - @mastra/core@0.9.1-alpha.6
  - @mastra/deployer@0.3.1-alpha.6

## 0.1.20-alpha.5

### Patch Changes

- Updated dependencies [3e7b69d]
  - @mastra/core@0.9.1-alpha.5
  - @mastra/deployer@0.3.1-alpha.5

## 0.1.20-alpha.4

### Patch Changes

- Updated dependencies [e4943b8]
- Updated dependencies [479f490]
  - @mastra/core@0.9.1-alpha.4
  - @mastra/deployer@0.3.1-alpha.4

## 0.1.20-alpha.3

### Patch Changes

- Updated dependencies [6262bd5]
  - @mastra/deployer@0.3.1-alpha.3
  - @mastra/core@0.9.1-alpha.3

## 0.1.20-alpha.2

### Patch Changes

- Updated dependencies [405b63d]
- Updated dependencies [61e92f5]
- Updated dependencies [c71013a]
  - @mastra/core@0.9.1-alpha.2
  - @mastra/deployer@0.3.1-alpha.2

## 0.1.20-alpha.1

### Patch Changes

- Updated dependencies [e7c2881]
- Updated dependencies [0ccb8b4]
- Updated dependencies [92c598d]
- Updated dependencies [20275d4]
- Updated dependencies [7d1892c]
- Updated dependencies [ebdb781]
- Updated dependencies [a90a082]
- Updated dependencies [35955b0]
- Updated dependencies [c1409ef]
- Updated dependencies [11d4485]
- Updated dependencies [530ced1]
- Updated dependencies [611aa4a]
- Updated dependencies [2d4001d]
  - @mastra/deployer@0.3.1-alpha.1
  - @mastra/core@0.9.1-alpha.1

## 0.1.20-alpha.0

### Patch Changes

- Updated dependencies [81fb7f6]
  - @mastra/core@0.9.1-alpha.0
  - @mastra/deployer@0.3.1-alpha.0

## 0.1.19

### Patch Changes

- 7e92011: Include tools with deployment builds
- 16a8648: Disable swaggerUI, playground for production builds, mastra instance server build config to enable swaggerUI, apiReqLogs, openAPI documentation for prod builds
- Updated dependencies [b9122b0]
- Updated dependencies [000a6d4]
- Updated dependencies [08bb78e]
- Updated dependencies [3527610]
- Updated dependencies [ed2f549]
- Updated dependencies [7e92011]
- Updated dependencies [9ee4293]
- Updated dependencies [03f3cd0]
- Updated dependencies [c0f22b4]
- Updated dependencies [71d9444]
- Updated dependencies [157c741]
- Updated dependencies [8a8a73b]
- Updated dependencies [0a033fa]
- Updated dependencies [fe3ae4d]
- Updated dependencies [2538066]
- Updated dependencies [9c26508]
- Updated dependencies [63fe16a]
- Updated dependencies [0f4eae3]
- Updated dependencies [3f9d151]
- Updated dependencies [735ead7]
- Updated dependencies [16a8648]
- Updated dependencies [6f92295]
  - @mastra/deployer@0.3.0
  - @mastra/core@0.9.0

## 0.1.19-alpha.9

### Patch Changes

- 16a8648: Disable swaggerUI, playground for production builds, mastra instance server build config to enable swaggerUI, apiReqLogs, openAPI documentation for prod builds
- Updated dependencies [b9122b0]
- Updated dependencies [000a6d4]
- Updated dependencies [ed2f549]
- Updated dependencies [c0f22b4]
- Updated dependencies [0a033fa]
- Updated dependencies [2538066]
- Updated dependencies [9c26508]
- Updated dependencies [0f4eae3]
- Updated dependencies [16a8648]
  - @mastra/deployer@0.3.0-alpha.9
  - @mastra/core@0.9.0-alpha.8

## 0.1.19-alpha.8

### Patch Changes

- Updated dependencies [71d9444]
  - @mastra/core@0.9.0-alpha.7
  - @mastra/deployer@0.3.0-alpha.8

## 0.1.19-alpha.7

### Patch Changes

- Updated dependencies [157c741]
- Updated dependencies [63fe16a]
- Updated dependencies [735ead7]
  - @mastra/core@0.9.0-alpha.6
  - @mastra/deployer@0.3.0-alpha.7

## 0.1.19-alpha.6

### Patch Changes

- Updated dependencies [08bb78e]
- Updated dependencies [3f9d151]
  - @mastra/core@0.9.0-alpha.5
  - @mastra/deployer@0.3.0-alpha.6

## 0.1.19-alpha.5

### Patch Changes

- 7e92011: Include tools with deployment builds
- Updated dependencies [7e92011]
  - @mastra/deployer@0.3.0-alpha.5
  - @mastra/core@0.9.0-alpha.4

## 0.1.19-alpha.4

### Patch Changes

- Updated dependencies [fe3ae4d]
  - @mastra/deployer@0.3.0-alpha.4
  - @mastra/core@0.9.0-alpha.3

## 0.1.19-alpha.3

### Patch Changes

- Updated dependencies [9ee4293]
  - @mastra/core@0.8.4-alpha.2
  - @mastra/deployer@0.2.10-alpha.3

## 0.1.19-alpha.2

### Patch Changes

- Updated dependencies [3527610]
  - @mastra/deployer@0.2.10-alpha.2

## 0.1.19-alpha.1

### Patch Changes

- Updated dependencies [8a8a73b]
- Updated dependencies [6f92295]
  - @mastra/core@0.8.4-alpha.1
  - @mastra/deployer@0.2.10-alpha.1

## 0.1.19-alpha.0

### Patch Changes

- Updated dependencies [03f3cd0]
  - @mastra/core@0.8.4-alpha.0
  - @mastra/deployer@0.2.10-alpha.0

## 0.1.18

### Patch Changes

- 37bb612: Add Elastic-2.0 licensing for packages
- 67aff42: Fix netlify deployer missing @libsql/linux-x64-gnu bug
- Updated dependencies [d72318f]
- Updated dependencies [0bcc862]
- Updated dependencies [10a8caf]
- Updated dependencies [359b089]
- Updated dependencies [9f6f6dd]
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
- Updated dependencies [1ebbfbf]
- Updated dependencies [67aff42]
- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3
  - @mastra/deployer@0.2.9

## 0.1.18-alpha.7

### Patch Changes

- Updated dependencies [d72318f]
  - @mastra/core@0.8.3-alpha.5
  - @mastra/deployer@0.2.9-alpha.7

## 0.1.18-alpha.6

### Patch Changes

- 67aff42: Fix netlify deployer missing @libsql/linux-x64-gnu bug
- Updated dependencies [67aff42]
  - @mastra/deployer@0.2.9-alpha.6

## 0.1.18-alpha.5

### Patch Changes

- Updated dependencies [9f6f6dd]
  - @mastra/deployer@0.2.9-alpha.5

## 0.1.18-alpha.4

### Patch Changes

- Updated dependencies [1ebbfbf]
- Updated dependencies [7f1b291]
  - @mastra/deployer@0.2.9-alpha.4
  - @mastra/core@0.8.3-alpha.4

## 0.1.18-alpha.3

### Patch Changes

- Updated dependencies [10a8caf]
  - @mastra/core@0.8.3-alpha.3
  - @mastra/deployer@0.2.9-alpha.3

## 0.1.18-alpha.2

### Patch Changes

- Updated dependencies [0bcc862]
  - @mastra/core@0.8.3-alpha.2
  - @mastra/deployer@0.2.9-alpha.2

## 0.1.18-alpha.1

### Patch Changes

- 37bb612: Add Elastic-2.0 licensing for packages
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
  - @mastra/deployer@0.2.9-alpha.1
  - @mastra/core@0.8.3-alpha.1

## 0.1.18-alpha.0

### Patch Changes

- Updated dependencies [359b089]
  - @mastra/core@0.8.3-alpha.0
  - @mastra/deployer@0.2.9-alpha.0

## 0.1.17

### Patch Changes

- Updated dependencies [a06aadc]
- Updated dependencies [ae6c5ce]
- Updated dependencies [94cd5c1]
  - @mastra/core@0.8.2
  - @mastra/deployer@0.2.8

## 0.1.17-alpha.1

### Patch Changes

- Updated dependencies [94cd5c1]
  - @mastra/deployer@0.2.8-alpha.1

## 0.1.17-alpha.0

### Patch Changes

- Updated dependencies [a06aadc]
- Updated dependencies [ae6c5ce]
  - @mastra/core@0.8.2-alpha.0
  - @mastra/deployer@0.2.8-alpha.0

## 0.1.16

### Patch Changes

- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1
  - @mastra/deployer@0.2.7

## 0.1.16-alpha.0

### Patch Changes

- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1-alpha.0
  - @mastra/deployer@0.2.7-alpha.0

## 0.1.15

### Patch Changes

- Updated dependencies [56c31b7]
- Updated dependencies [619c39d]
- Updated dependencies [2135c81]
- Updated dependencies [5ae0180]
- Updated dependencies [05d58cc]
- Updated dependencies [fe56be0]
- Updated dependencies [93875ed]
- Updated dependencies [107bcfe]
- Updated dependencies [9bfa12b]
- Updated dependencies [515ebfb]
- Updated dependencies [5b4e19f]
- Updated dependencies [4c98129]
- Updated dependencies [4c65a57]
- Updated dependencies [dbbbf80]
- Updated dependencies [a0967a0]
- Updated dependencies [84fe241]
- Updated dependencies [fca3b21]
- Updated dependencies [88fa727]
- Updated dependencies [dfb0601]
- Updated dependencies [f37f535]
- Updated dependencies [789bef3]
- Updated dependencies [a3f0e90]
- Updated dependencies [4d67826]
- Updated dependencies [6330967]
- Updated dependencies [8393832]
- Updated dependencies [6330967]
- Updated dependencies [84fe241]
- Updated dependencies [99d43b9]
- Updated dependencies [32ba03c]
- Updated dependencies [d7e08e8]
- Updated dependencies [3c6ae54]
- Updated dependencies [febc8a6]
- Updated dependencies [0deb356]
- Updated dependencies [7599d77]
- Updated dependencies [0118361]
- Updated dependencies [619c39d]
- Updated dependencies [cafae83]
- Updated dependencies [8076ecf]
- Updated dependencies [8df4a77]
- Updated dependencies [304397c]
  - @mastra/core@0.8.0
  - @mastra/deployer@0.2.6

## 0.1.15-alpha.10

### Patch Changes

- Updated dependencies [2135c81]
- Updated dependencies [8df4a77]
  - @mastra/deployer@0.2.6-alpha.10
  - @mastra/core@0.8.0-alpha.8

## 0.1.15-alpha.9

### Patch Changes

- Updated dependencies [3c6ae54]
- Updated dependencies [febc8a6]
  - @mastra/deployer@0.2.6-alpha.9
  - @mastra/core@0.8.0-alpha.7

## 0.1.15-alpha.8

### Patch Changes

- Updated dependencies [4c65a57]
- Updated dependencies [a3f0e90]
  - @mastra/deployer@0.2.6-alpha.8
  - @mastra/core@0.8.0-alpha.6

## 0.1.15-alpha.7

### Patch Changes

- Updated dependencies [93875ed]
  - @mastra/core@0.8.0-alpha.5
  - @mastra/deployer@0.2.6-alpha.7

## 0.1.15-alpha.6

### Patch Changes

- Updated dependencies [d7e08e8]
  - @mastra/core@0.8.0-alpha.4
  - @mastra/deployer@0.2.6-alpha.6

## 0.1.15-alpha.5

### Patch Changes

- Updated dependencies [32ba03c]
  - @mastra/deployer@0.2.6-alpha.5

## 0.1.15-alpha.4

### Patch Changes

- Updated dependencies [5ae0180]
- Updated dependencies [9bfa12b]
- Updated dependencies [515ebfb]
- Updated dependencies [88fa727]
- Updated dependencies [dfb0601]
- Updated dependencies [f37f535]
- Updated dependencies [789bef3]
- Updated dependencies [4d67826]
- Updated dependencies [6330967]
- Updated dependencies [8393832]
- Updated dependencies [6330967]
  - @mastra/core@0.8.0-alpha.3
  - @mastra/deployer@0.2.6-alpha.4

## 0.1.15-alpha.3

### Patch Changes

- Updated dependencies [0deb356]
  - @mastra/deployer@0.2.6-alpha.3

## 0.1.15-alpha.2

### Patch Changes

- Updated dependencies [56c31b7]
- Updated dependencies [4c98129]
- Updated dependencies [dbbbf80]
- Updated dependencies [84fe241]
- Updated dependencies [84fe241]
- Updated dependencies [99d43b9]
  - @mastra/core@0.8.0-alpha.2
  - @mastra/deployer@0.2.6-alpha.2

## 0.1.15-alpha.1

### Patch Changes

- Updated dependencies [619c39d]
- Updated dependencies [fe56be0]
- Updated dependencies [a0967a0]
- Updated dependencies [fca3b21]
- Updated dependencies [0118361]
- Updated dependencies [619c39d]
  - @mastra/core@0.8.0-alpha.1
  - @mastra/deployer@0.2.6-alpha.1

## 0.1.15-alpha.0

### Patch Changes

- Updated dependencies [05d58cc]
- Updated dependencies [107bcfe]
- Updated dependencies [5b4e19f]
- Updated dependencies [7599d77]
- Updated dependencies [cafae83]
- Updated dependencies [8076ecf]
- Updated dependencies [304397c]
  - @mastra/deployer@0.2.6-alpha.0
  - @mastra/core@0.7.1-alpha.0

## 0.1.14

### Patch Changes

- 4be4cb9: Update netlify cli to latest
- Updated dependencies [cdc0498]
- Updated dependencies [b4fbc59]
- Updated dependencies [a838fde]
- Updated dependencies [a8bd4cf]
- Updated dependencies [7a3eeb0]
- Updated dependencies [0b54522]
- Updated dependencies [b3b34f5]
- Updated dependencies [1af25d5]
- Updated dependencies [a4686e8]
- Updated dependencies [6530ad1]
- Updated dependencies [0b496ff]
- Updated dependencies [27439ad]
  - @mastra/deployer@0.2.5
  - @mastra/core@0.7.0

## 0.1.14-alpha.3

### Patch Changes

- Updated dependencies [b3b34f5]
- Updated dependencies [a4686e8]
  - @mastra/core@0.7.0-alpha.3
  - @mastra/deployer@0.2.5-alpha.3

## 0.1.14-alpha.2

### Patch Changes

- Updated dependencies [a838fde]
- Updated dependencies [a8bd4cf]
- Updated dependencies [7a3eeb0]
- Updated dependencies [6530ad1]
  - @mastra/core@0.7.0-alpha.2
  - @mastra/deployer@0.2.5-alpha.2

## 0.1.14-alpha.1

### Patch Changes

- 4be4cb9: Update netlify cli to latest
- Updated dependencies [cdc0498]
- Updated dependencies [0b54522]
- Updated dependencies [1af25d5]
- Updated dependencies [0b496ff]
- Updated dependencies [27439ad]
  - @mastra/deployer@0.2.5-alpha.1
  - @mastra/core@0.7.0-alpha.1

## 0.1.14-alpha.0

### Patch Changes

- Updated dependencies [b4fbc59]
  - @mastra/core@0.6.5-alpha.0
  - @mastra/deployer@0.2.5-alpha.0

## 0.1.13

### Patch Changes

- Updated dependencies [e764fd1]
- Updated dependencies [6794797]
- Updated dependencies [709aa2c]
- Updated dependencies [fb68a80]
- Updated dependencies [e764fd1]
- Updated dependencies [05ef3e0]
- Updated dependencies [95c5745]
- Updated dependencies [b56a681]
- Updated dependencies [85a2461]
- Updated dependencies [248cb07]
  - @mastra/deployer@0.2.4
  - @mastra/core@0.6.4

## 0.1.13-alpha.1

### Patch Changes

- Updated dependencies [6794797]
- Updated dependencies [709aa2c]
- Updated dependencies [85a2461]
  - @mastra/core@0.6.4-alpha.1
  - @mastra/deployer@0.2.4-alpha.1

## 0.1.13-alpha.0

### Patch Changes

- Updated dependencies [e764fd1]
- Updated dependencies [fb68a80]
- Updated dependencies [e764fd1]
- Updated dependencies [05ef3e0]
- Updated dependencies [95c5745]
- Updated dependencies [b56a681]
- Updated dependencies [248cb07]
  - @mastra/deployer@0.2.4-alpha.0
  - @mastra/core@0.6.4-alpha.0

## 0.1.12

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
- Updated dependencies [3bce733]
  - @mastra/deployer@0.2.3
  - @mastra/core@0.6.3

## 0.1.12-alpha.1

### Patch Changes

- Updated dependencies [3bce733]
  - @mastra/core@0.6.3-alpha.1
  - @mastra/deployer@0.2.3-alpha.1

## 0.1.12-alpha.0

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
  - @mastra/deployer@0.2.3-alpha.0
  - @mastra/core@0.6.3-alpha.0

## 0.1.11

### Patch Changes

- Updated dependencies [4e6732b]
- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/deployer@0.2.2
  - @mastra/core@0.6.2

## 0.1.11-alpha.1

### Patch Changes

- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/core@0.6.2-alpha.0
  - @mastra/deployer@0.2.2-alpha.1

## 0.1.11-alpha.0

### Patch Changes

- Updated dependencies [4e6732b]
  - @mastra/deployer@0.2.2-alpha.0

## 0.1.10

### Patch Changes

- Updated dependencies [cc7f392]
- Updated dependencies [fc2f89c]
- Updated dependencies [dfbb131]
- Updated dependencies [f4854ee]
- Updated dependencies [afaf73f]
- Updated dependencies [0850b4c]
- Updated dependencies [7bcfaee]
- Updated dependencies [da8d9bb]
- Updated dependencies [44631b1]
- Updated dependencies [9116d70]
- Updated dependencies [6e559a0]
- Updated dependencies [5f43505]
- Updated dependencies [61ad5a4]
  - @mastra/deployer@0.2.1
  - @mastra/core@0.6.1

## 0.1.10-alpha.2

### Patch Changes

- Updated dependencies [cc7f392]
- Updated dependencies [fc2f89c]
- Updated dependencies [dfbb131]
- Updated dependencies [0850b4c]
- Updated dependencies [da8d9bb]
- Updated dependencies [9116d70]
  - @mastra/deployer@0.2.1-alpha.2
  - @mastra/core@0.6.1-alpha.2

## 0.1.10-alpha.1

### Patch Changes

- Updated dependencies [f4854ee]
- Updated dependencies [afaf73f]
- Updated dependencies [44631b1]
- Updated dependencies [6e559a0]
- Updated dependencies [5f43505]
- Updated dependencies [61ad5a4]
  - @mastra/core@0.6.1-alpha.1
  - @mastra/deployer@0.2.1-alpha.1

## 0.1.10-alpha.0

### Patch Changes

- Updated dependencies [7bcfaee]
  - @mastra/core@0.6.1-alpha.0
  - @mastra/deployer@0.2.1-alpha.0

## 0.1.9

### Patch Changes

- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [95b4144]
- Updated dependencies [3729dbd]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0
  - @mastra/deployer@0.2.0

## 0.1.9-alpha.1

### Patch Changes

- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [95b4144]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0-alpha.1
  - @mastra/deployer@0.2.0-alpha.1

## 0.1.9-alpha.0

### Patch Changes

- Updated dependencies [3729dbd]
  - @mastra/core@0.5.1-alpha.0
  - @mastra/deployer@0.1.9-alpha.0

## 0.1.8

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
- Updated dependencies [f6678e4]
- Updated dependencies [9e81f35]
- Updated dependencies [c93798b]
- Updated dependencies [a85ab24]
- Updated dependencies [dbd9f2d]
- Updated dependencies [59df7b6]
- Updated dependencies [caefaa2]
- Updated dependencies [c151ae6]
- Updated dependencies [52e0418]
- Updated dependencies [d79aedf]
- Updated dependencies [8deb34c]
- Updated dependencies [c2dde91]
- Updated dependencies [5d41958]
- Updated dependencies [144b3d5]
- Updated dependencies [03236ec]
- Updated dependencies [3764e71]
- Updated dependencies [df982db]
- Updated dependencies [a171b37]
- Updated dependencies [506f1d5]
- Updated dependencies [02ffb7b]
- Updated dependencies [731dd8a]
- Updated dependencies [0461849]
- Updated dependencies [2259379]
- Updated dependencies [aeb5e36]
- Updated dependencies [f2301de]
- Updated dependencies [358f069]
- Updated dependencies [fd4a1d7]
- Updated dependencies [960690d]
- Updated dependencies [c139344]
  - @mastra/core@0.5.0
  - @mastra/deployer@0.1.8

## 0.1.8-alpha.12

### Patch Changes

- Updated dependencies [a85ab24]
  - @mastra/core@0.5.0-alpha.12
  - @mastra/deployer@0.1.8-alpha.12

## 0.1.8-alpha.11

### Patch Changes

- fd4a1d7: Update cjs bundling to make sure files are split
- Updated dependencies [7a7a547]
- Updated dependencies [c93798b]
- Updated dependencies [dbd9f2d]
- Updated dependencies [8deb34c]
- Updated dependencies [5d41958]
- Updated dependencies [a171b37]
- Updated dependencies [fd4a1d7]
  - @mastra/deployer@0.1.8-alpha.11
  - @mastra/core@0.5.0-alpha.11

## 0.1.8-alpha.10

### Patch Changes

- Updated dependencies [a910463]
  - @mastra/core@0.5.0-alpha.10
  - @mastra/deployer@0.1.8-alpha.10

## 0.1.8-alpha.9

### Patch Changes

- Updated dependencies [e9fbac5]
- Updated dependencies [1e8bcbc]
- Updated dependencies [aeb5e36]
- Updated dependencies [f2301de]
  - @mastra/deployer@0.1.8-alpha.9
  - @mastra/core@0.5.0-alpha.9

## 0.1.8-alpha.8

### Patch Changes

- Updated dependencies [506f1d5]
  - @mastra/core@0.5.0-alpha.8
  - @mastra/deployer@0.1.8-alpha.8

## 0.1.8-alpha.7

### Patch Changes

- Updated dependencies [ee667a2]
  - @mastra/core@0.5.0-alpha.7
  - @mastra/deployer@0.1.8-alpha.7

## 0.1.8-alpha.6

### Patch Changes

- Updated dependencies [f6678e4]
  - @mastra/core@0.5.0-alpha.6
  - @mastra/deployer@0.1.8-alpha.6

## 0.1.8-alpha.5

### Patch Changes

- Updated dependencies [22643eb]
- Updated dependencies [6feb23f]
- Updated dependencies [f2d6727]
- Updated dependencies [301e4ee]
- Updated dependencies [dfbe4e9]
- Updated dependencies [9e81f35]
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
  - @mastra/deployer@0.1.8-alpha.5

## 0.1.8-alpha.4

### Patch Changes

- Updated dependencies [d79aedf]
- Updated dependencies [144b3d5]
  - @mastra/core@0.5.0-alpha.4
  - @mastra/deployer@0.1.8-alpha.4

## 0.1.8-alpha.3

### Patch Changes

- Updated dependencies [3d0e290]
  - @mastra/core@0.5.0-alpha.3
  - @mastra/deployer@0.1.8-alpha.3

## 0.1.8-alpha.2

### Patch Changes

- Updated dependencies [02ffb7b]
  - @mastra/core@0.5.0-alpha.2
  - @mastra/deployer@0.1.8-alpha.2

## 0.1.8-alpha.1

### Patch Changes

- Updated dependencies [dab255b]
  - @mastra/core@0.5.0-alpha.1
  - @mastra/deployer@0.1.8-alpha.1

## 0.1.8-alpha.0

### Patch Changes

- Updated dependencies [59df7b6]
- Updated dependencies [29f3a82]
- Updated dependencies [59df7b6]
- Updated dependencies [c2dde91]
- Updated dependencies [731dd8a]
- Updated dependencies [960690d]
- Updated dependencies [c139344]
  - @mastra/core@0.5.0-alpha.0
  - @mastra/deployer@0.1.8-alpha.0

## 0.1.7

### Patch Changes

- Updated dependencies [1da20e7]
- Updated dependencies [30a4c29]
- Updated dependencies [e1e2705]
  - @mastra/core@0.4.4
  - @mastra/deployer@0.1.7

## 0.1.7-alpha.0

### Patch Changes

- Updated dependencies [1da20e7]
- Updated dependencies [30a4c29]
- Updated dependencies [e1e2705]
  - @mastra/core@0.4.4-alpha.0
  - @mastra/deployer@0.1.7-alpha.0

## 0.1.6

### Patch Changes

- bb4f447: Add support for commonjs
- Updated dependencies [0d185b1]
- Updated dependencies [ed55f1d]
- Updated dependencies [06aa827]
- Updated dependencies [80cdd76]
- Updated dependencies [0fd78ac]
- Updated dependencies [2512a93]
- Updated dependencies [e62de74]
- Updated dependencies [0d25b75]
- Updated dependencies [fd14a3f]
- Updated dependencies [8d13b14]
- Updated dependencies [3f369a2]
- Updated dependencies [3ee4831]
- Updated dependencies [4d4e1e1]
- Updated dependencies [bb4f447]
- Updated dependencies [108793c]
- Updated dependencies [5f28f44]
- Updated dependencies [dabecf4]
  - @mastra/core@0.4.3
  - @mastra/deployer@0.1.6

## 0.1.6-alpha.4

### Patch Changes

- Updated dependencies [dabecf4]
  - @mastra/core@0.4.3-alpha.4
  - @mastra/deployer@0.1.6-alpha.4

## 0.1.6-alpha.3

### Patch Changes

- bb4f447: Add support for commonjs
- Updated dependencies [0fd78ac]
- Updated dependencies [0d25b75]
- Updated dependencies [fd14a3f]
- Updated dependencies [3f369a2]
- Updated dependencies [4d4e1e1]
- Updated dependencies [bb4f447]
  - @mastra/deployer@0.1.6-alpha.3
  - @mastra/core@0.4.3-alpha.3

## 0.1.6-alpha.2

### Patch Changes

- Updated dependencies [2512a93]
- Updated dependencies [e62de74]
  - @mastra/core@0.4.3-alpha.2
  - @mastra/deployer@0.1.6-alpha.2

## 0.1.6-alpha.1

### Patch Changes

- Updated dependencies [0d185b1]
- Updated dependencies [ed55f1d]
- Updated dependencies [80cdd76]
- Updated dependencies [8d13b14]
- Updated dependencies [3ee4831]
- Updated dependencies [108793c]
- Updated dependencies [5f28f44]
  - @mastra/core@0.4.3-alpha.1
  - @mastra/deployer@0.1.6-alpha.1

## 0.1.6-alpha.0

### Patch Changes

- Updated dependencies [06aa827]
  - @mastra/core@0.4.3-alpha.0
  - @mastra/deployer@0.1.6-alpha.0

## 0.1.5

### Patch Changes

- Updated dependencies [7fceae1]
- Updated dependencies [e4ee56c]
- Updated dependencies [8d94c3e]
- Updated dependencies [2d68431]
- Updated dependencies [99dcdb5]
- Updated dependencies [6cb63e0]
- Updated dependencies [f626fbb]
- Updated dependencies [e752340]
- Updated dependencies [eb91535]
  - @mastra/core@0.4.2
  - @mastra/deployer@0.1.5

## 0.1.5-alpha.3

### Patch Changes

- Updated dependencies [8d94c3e]
- Updated dependencies [99dcdb5]
- Updated dependencies [e752340]
- Updated dependencies [eb91535]
  - @mastra/core@0.4.2-alpha.2
  - @mastra/deployer@0.1.5-alpha.3

## 0.1.5-alpha.2

### Patch Changes

- Updated dependencies [6cb63e0]
  - @mastra/core@0.4.2-alpha.1
  - @mastra/deployer@0.1.5-alpha.2

## 0.1.5-alpha.1

### Patch Changes

- Updated dependencies [2d68431]
  - @mastra/deployer@0.1.5-alpha.1

## 0.1.5-alpha.0

### Patch Changes

- Updated dependencies [7fceae1]
- Updated dependencies [e4ee56c]
- Updated dependencies [f626fbb]
  - @mastra/core@0.4.2-alpha.0
  - @mastra/deployer@0.1.5-alpha.0

## 0.1.4

### Patch Changes

- Updated dependencies [ce44b9b]
- Updated dependencies [967da43]
- Updated dependencies [b405f08]
  - @mastra/core@0.4.1
  - @mastra/deployer@0.1.4

## 0.1.3

### Patch Changes

- Updated dependencies [5297264]
- Updated dependencies [2fc618f]
- Updated dependencies [fe0fd01]
  - @mastra/deployer@0.1.3
  - @mastra/core@0.4.0

## 0.1.3-alpha.1

### Patch Changes

- Updated dependencies [fe0fd01]
  - @mastra/core@0.4.0-alpha.1
  - @mastra/deployer@0.1.3-alpha.1

## 0.1.3-alpha.0

### Patch Changes

- Updated dependencies [5297264]
- Updated dependencies [2fc618f]
  - @mastra/deployer@0.1.3-alpha.0
  - @mastra/core@0.4.0-alpha.0

## 0.1.2

### Patch Changes

- Updated dependencies [f205ede]
  - @mastra/core@0.3.0
  - @mastra/deployer@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [d59f1a8]
- Updated dependencies [936dc26]
- Updated dependencies [91ef439]
- Updated dependencies [4a25be4]
- Updated dependencies [bf2e88f]
- Updated dependencies [2f0d707]
- Updated dependencies [aac1667]
  - @mastra/core@0.2.1
  - @mastra/deployer@0.1.1

## 0.1.1-alpha.0

### Patch Changes

- Updated dependencies [d59f1a8]
- Updated dependencies [936dc26]
- Updated dependencies [91ef439]
- Updated dependencies [4a25be4]
- Updated dependencies [bf2e88f]
- Updated dependencies [2f0d707]
- Updated dependencies [aac1667]
  - @mastra/core@0.2.1-alpha.0
  - @mastra/deployer@0.1.1-alpha.0

## 0.1.0

### Minor Changes

- 4d4f6b6: Update deployer
- 5916f9d: Update deps from fixed to ^
- 8b416d9: Breaking changes

### Patch Changes

- 2b75edf: mastra deployers tsup bundling
- 44c7c26: Rebuild
- e27fe69: Add dir to deployer
- bdaf834: publish packages
- b97ca96: Tracing into default storage
- a9b5ddf: Publish new versions
- 88600bc: Deployer fixes
- 9c10484: update all packages
- 70dabd9: Fix broken publish
- 0d5a03d: Vector store modules
- 9625602: Use mastra core splitted bundles in other packages
- 38b7f66: Update deployer logic
- 4f1d1a1: Enforce types ann cleanup package.json
- Updated dependencies [2ab57d6]
- Updated dependencies [a1774e7]
- Updated dependencies [f537e33]
- Updated dependencies [291fe57]
- Updated dependencies [6f2c0f5]
- Updated dependencies [e4d4ede]
- Updated dependencies [0be7181]
- Updated dependencies [dd6d87f]
- Updated dependencies [9029796]
- Updated dependencies [6fa4bd2]
- Updated dependencies [f031a1f]
- Updated dependencies [8151f44]
- Updated dependencies [d7d465a]
- Updated dependencies [4d4f6b6]
- Updated dependencies [73d112c]
- Updated dependencies [592e3cf]
- Updated dependencies [9d1796d]
- Updated dependencies [e897f1c]
- Updated dependencies [4a54c82]
- Updated dependencies [e27fe69]
- Updated dependencies [3967e69]
- Updated dependencies [8ae2bbc]
- Updated dependencies [246f06c]
- Updated dependencies [ac8c61a]
- Updated dependencies [82a6d53]
- Updated dependencies [e9d1b47]
- Updated dependencies [bdaf834]
- Updated dependencies [016493a]
- Updated dependencies [bc40916]
- Updated dependencies [93a3719]
- Updated dependencies [7d83b92]
- Updated dependencies [9fb3039]
- Updated dependencies [8fa48b9]
- Updated dependencies [d5e12de]
- Updated dependencies [e1dd94a]
- Updated dependencies [07c069d]
- Updated dependencies [5cdfb88]
- Updated dependencies [837a288]
- Updated dependencies [685108a]
- Updated dependencies [c8ff2f5]
- Updated dependencies [5fdc87c]
- Updated dependencies [ae7bf94]
- Updated dependencies [8e7814f]
- Updated dependencies [66a03ec]
- Updated dependencies [5916f9d]
- Updated dependencies [7d87a15]
- Updated dependencies [b97ca96]
- Updated dependencies [ad2cd74]
- Updated dependencies [23dcb23]
- Updated dependencies [033eda6]
- Updated dependencies [7babd5c]
- Updated dependencies [a9b5ddf]
- Updated dependencies [9066f95]
- Updated dependencies [4139b43]
- Updated dependencies [8105fae]
- Updated dependencies [e097800]
- Updated dependencies [ab01c53]
- Updated dependencies [1944807]
- Updated dependencies [30322ce]
- Updated dependencies [8aec8b7]
- Updated dependencies [1874f40]
- Updated dependencies [685108a]
- Updated dependencies [f7d1131]
- Updated dependencies [79acad0]
- Updated dependencies [7a19083]
- Updated dependencies [382f4dc]
- Updated dependencies [1ebd071]
- Updated dependencies [0b74006]
- Updated dependencies [2f17a5f]
- Updated dependencies [f368477]
- Updated dependencies [7892533]
- Updated dependencies [9c10484]
- Updated dependencies [b726bf5]
- Updated dependencies [88f18d7]
- Updated dependencies [70dabd9]
- Updated dependencies [21fe536]
- Updated dependencies [1a41fbf]
- Updated dependencies [176bc42]
- Updated dependencies [391d5ea]
- Updated dependencies [401a4d9]
- Updated dependencies [2e099d2]
- Updated dependencies [0b826f6]
- Updated dependencies [8329f1a]
- Updated dependencies [d68b532]
- Updated dependencies [75bf3f0]
- Updated dependencies [e6d8055]
- Updated dependencies [e2e76de]
- Updated dependencies [a18e96c]
- Updated dependencies [ccbc581]
- Updated dependencies [5950de5]
- Updated dependencies [b425845]
- Updated dependencies [fe3dcb0]
- Updated dependencies [0696eeb]
- Updated dependencies [6780223]
- Updated dependencies [78eec7c]
- Updated dependencies [a8a459a]
- Updated dependencies [0b96376]
- Updated dependencies [0be7181]
- Updated dependencies [7b87567]
- Updated dependencies [b524c22]
- Updated dependencies [d7d465a]
- Updated dependencies [df843d3]
- Updated dependencies [cfb966f]
- Updated dependencies [4534e77]
- Updated dependencies [d6d8159]
- Updated dependencies [0bd142c]
- Updated dependencies [9625602]
- Updated dependencies [72d1990]
- Updated dependencies [f6ba259]
- Updated dependencies [2712098]
- Updated dependencies [a291824]
- Updated dependencies [eedb829]
- Updated dependencies [8ea426a]
- Updated dependencies [c5f2d50]
- Updated dependencies [5285356]
- Updated dependencies [74b3078]
- Updated dependencies [cb290ee]
- Updated dependencies [b4d7416]
- Updated dependencies [e608d8c]
- Updated dependencies [7064554]
- Updated dependencies [06b2c0a]
- Updated dependencies [002d6d8]
- Updated dependencies [e448a26]
- Updated dependencies [8b416d9]
- Updated dependencies [fd494a3]
- Updated dependencies [dc90663]
- Updated dependencies [c872875]
- Updated dependencies [3c4488b]
- Updated dependencies [72c280b]
- Updated dependencies [a7b016d]
- Updated dependencies [fd75f3c]
- Updated dependencies [7f24c29]
- Updated dependencies [2017553]
- Updated dependencies [b80ea8d]
- Updated dependencies [a10b7a3]
- Updated dependencies [42a2e69]
- Updated dependencies [cf6d825]
- Updated dependencies [963c15a]
- Updated dependencies [28dceab]
- Updated dependencies [7365b6c]
- Updated dependencies [5ee67d3]
- Updated dependencies [a5604c4]
- Updated dependencies [d38f7a6]
- Updated dependencies [38b7f66]
- Updated dependencies [2fa7f53]
- Updated dependencies [1420ae2]
- Updated dependencies [b9c7047]
- Updated dependencies [4a328af]
- Updated dependencies [f6da688]
- Updated dependencies [3700be1]
- Updated dependencies [9ade36e]
- Updated dependencies [10870bc]
- Updated dependencies [2b01511]
- Updated dependencies [a870123]
- Updated dependencies [ccf115c]
- Updated dependencies [04434b6]
- Updated dependencies [5811de6]
- Updated dependencies [9f3ab05]
- Updated dependencies [66a5392]
- Updated dependencies [4b1ce2c]
- Updated dependencies [14064f2]
- Updated dependencies [f5dfa20]
- Updated dependencies [327ece7]
- Updated dependencies [da2e8d3]
- Updated dependencies [95a4697]
- Updated dependencies [d5fccfb]
- Updated dependencies [3427b95]
- Updated dependencies [538a136]
- Updated dependencies [e66643a]
- Updated dependencies [b5393f1]
- Updated dependencies [d2cd535]
- Updated dependencies [c2dd6b5]
- Updated dependencies [67637ba]
- Updated dependencies [836f4e3]
- Updated dependencies [5ee2e78]
- Updated dependencies [cd02c56]
- Updated dependencies [01502b0]
- Updated dependencies [16e5b04]
- Updated dependencies [d9c8dd0]
- Updated dependencies [9fb59d6]
- Updated dependencies [a9345f9]
- Updated dependencies [f1e3105]
- Updated dependencies [99f1847]
- Updated dependencies [04f3171]
- Updated dependencies [8769a62]
- Updated dependencies [d5ec619]
- Updated dependencies [27275c9]
- Updated dependencies [ae7bf94]
- Updated dependencies [4f1d1a1]
- Updated dependencies [ee4de15]
- Updated dependencies [202d404]
- Updated dependencies [a221426]
  - @mastra/deployer@0.1.0
  - @mastra/core@0.2.0

## 0.1.0-alpha.66

### Patch Changes

- Updated dependencies [391d5ea]
  - @mastra/deployer@0.1.0-alpha.63

## 0.1.0-alpha.65

### Patch Changes

- Updated dependencies [016493a]
- Updated dependencies [382f4dc]
- Updated dependencies [176bc42]
- Updated dependencies [d68b532]
- Updated dependencies [fe3dcb0]
- Updated dependencies [e448a26]
- Updated dependencies [fd75f3c]
- Updated dependencies [ccf115c]
- Updated dependencies [a221426]
  - @mastra/core@0.2.0-alpha.110
  - @mastra/deployer@0.1.0-alpha.62

## 0.1.0-alpha.64

### Patch Changes

- Updated dependencies [b9c7047]
  - @mastra/deployer@0.1.0-alpha.61

## 0.1.0-alpha.63

### Patch Changes

- Updated dependencies [d5fccfb]
  - @mastra/core@0.2.0-alpha.109
  - @mastra/deployer@0.1.0-alpha.60

## 0.1.0-alpha.62

### Patch Changes

- Updated dependencies [5ee67d3]
- Updated dependencies [95a4697]
  - @mastra/core@0.2.0-alpha.108
  - @mastra/deployer@0.1.0-alpha.59

## 0.1.0-alpha.61

### Patch Changes

- Updated dependencies [8fa48b9]
- Updated dependencies [66a5392]
  - @mastra/deployer@0.1.0-alpha.58
  - @mastra/core@0.2.0-alpha.107

## 0.1.0-alpha.60

### Patch Changes

- Updated dependencies [6f2c0f5]
- Updated dependencies [a8a459a]
- Updated dependencies [4a328af]
  - @mastra/core@0.2.0-alpha.106
  - @mastra/deployer@0.1.0-alpha.57

## 0.1.0-alpha.59

### Patch Changes

- Updated dependencies [246f06c]
  - @mastra/deployer@0.1.0-alpha.56

## 0.1.0-alpha.58

### Patch Changes

- Updated dependencies [1420ae2]
- Updated dependencies [99f1847]
  - @mastra/core@0.2.0-alpha.105
  - @mastra/deployer@0.1.0-alpha.55

## 0.1.0-alpha.57

### Patch Changes

- b97ca96: Tracing into default storage
- Updated dependencies [5fdc87c]
- Updated dependencies [b97ca96]
- Updated dependencies [6780223]
- Updated dependencies [72d1990]
- Updated dependencies [cf6d825]
- Updated dependencies [10870bc]
  - @mastra/core@0.2.0-alpha.104
  - @mastra/deployer@0.1.0-alpha.54

## 0.1.0-alpha.56

### Patch Changes

- Updated dependencies [4534e77]
  - @mastra/core@0.2.0-alpha.103
  - @mastra/deployer@0.1.0-alpha.53

## 0.1.0-alpha.55

### Patch Changes

- Updated dependencies [a9345f9]
  - @mastra/core@0.2.0-alpha.102
  - @mastra/deployer@0.1.0-alpha.52

## 0.1.0-alpha.54

### Patch Changes

- 4f1d1a1: Enforce types ann cleanup package.json
- Updated dependencies [66a03ec]
- Updated dependencies [4f1d1a1]
  - @mastra/core@0.2.0-alpha.101
  - @mastra/deployer@0.1.0-alpha.51

## 0.1.0-alpha.53

### Patch Changes

- Updated dependencies [9d1796d]
  - @mastra/deployer@0.1.0-alpha.50
  - @mastra/core@0.2.0-alpha.100

## 0.1.0-alpha.52

### Patch Changes

- Updated dependencies [7d83b92]
  - @mastra/deployer@0.1.0-alpha.49
  - @mastra/core@0.2.0-alpha.99

## 0.1.0-alpha.51

### Patch Changes

- Updated dependencies [8aec8b7]
  - @mastra/deployer@0.1.0-alpha.48

## 0.1.0-alpha.50

### Patch Changes

- 70dabd9: Fix broken publish
- Updated dependencies [70dabd9]
- Updated dependencies [202d404]
  - @mastra/core@0.2.0-alpha.98
  - @mastra/deployer@0.1.0-alpha.47

## 0.1.0-alpha.49

### Patch Changes

- Updated dependencies [07c069d]
- Updated dependencies [7892533]
- Updated dependencies [e6d8055]
- Updated dependencies [a18e96c]
- Updated dependencies [5950de5]
- Updated dependencies [df843d3]
- Updated dependencies [a870123]
- Updated dependencies [f1e3105]
  - @mastra/core@0.2.0-alpha.97
  - @mastra/deployer@0.1.0-alpha.46

## 0.1.0-alpha.48

### Patch Changes

- Updated dependencies [74b3078]
  - @mastra/core@0.2.0-alpha.96
  - @mastra/deployer@0.1.0-alpha.45

## 0.1.0-alpha.47

### Patch Changes

- Updated dependencies [9fb59d6]
  - @mastra/deployer@0.1.0-alpha.44
  - @mastra/core@0.2.0-alpha.95

## 0.1.0-alpha.46

### Minor Changes

- 8b416d9: Breaking changes

### Patch Changes

- 9c10484: update all packages
- Updated dependencies [9c10484]
- Updated dependencies [8b416d9]
  - @mastra/core@0.2.0-alpha.94
  - @mastra/deployer@0.1.0-alpha.43

## 0.1.0-alpha.45

### Patch Changes

- Updated dependencies [5285356]
- Updated dependencies [42a2e69]
  - @mastra/core@0.2.0-alpha.93
  - @mastra/deployer@0.1.0-alpha.42

## 0.1.0-alpha.44

### Patch Changes

- Updated dependencies [0b96376]
  - @mastra/deployer@0.1.0-alpha.41

## 0.1.0-alpha.43

### Patch Changes

- Updated dependencies [8329f1a]
  - @mastra/deployer@0.1.0-alpha.40

## 0.1.0-alpha.42

### Patch Changes

- Updated dependencies [8ea426a]
  - @mastra/deployer@0.1.0-alpha.39

## 0.1.0-alpha.41

### Patch Changes

- Updated dependencies [b80ea8d]
  - @mastra/deployer@0.1.0-alpha.34

## 0.1.0-alpha.40

### Minor Changes

- 4d4f6b6: Update deployer

### Patch Changes

- Updated dependencies [4d4f6b6]
  - @mastra/deployer@0.1.0-alpha.38
  - @mastra/core@0.2.0-alpha.92

## 0.1.0-alpha.39

### Patch Changes

- Updated dependencies [d7d465a]
- Updated dependencies [d7d465a]
- Updated dependencies [2017553]
- Updated dependencies [a10b7a3]
- Updated dependencies [16e5b04]
  - @mastra/core@0.2.0-alpha.91
  - @mastra/deployer@0.1.0-alpha.37

## 0.1.0-alpha.38

### Patch Changes

- Updated dependencies [8151f44]
- Updated dependencies [e897f1c]
- Updated dependencies [82a6d53]
- Updated dependencies [3700be1]
  - @mastra/core@0.2.0-alpha.90
  - @mastra/deployer@0.1.0-alpha.36

## 0.1.0-alpha.37

### Patch Changes

- Updated dependencies [27275c9]
  - @mastra/core@0.2.0-alpha.89
  - @mastra/deployer@0.1.0-alpha.35

## 0.1.0-alpha.36

### Patch Changes

- Updated dependencies [ab01c53]
- Updated dependencies [ccbc581]
  - @mastra/deployer@0.1.0-alpha.34
  - @mastra/core@0.2.0-alpha.88

## 0.1.0-alpha.35

### Patch Changes

- Updated dependencies [7365b6c]
  - @mastra/core@0.2.0-alpha.87
  - @mastra/deployer@0.1.0-alpha.33

## 0.1.0-alpha.34

### Minor Changes

- 5916f9d: Update deps from fixed to ^

### Patch Changes

- Updated dependencies [6fa4bd2]
- Updated dependencies [5916f9d]
- Updated dependencies [e2e76de]
- Updated dependencies [7f24c29]
- Updated dependencies [67637ba]
- Updated dependencies [04f3171]
  - @mastra/core@0.2.0-alpha.86
  - @mastra/deployer@0.1.0-alpha.32

## 0.0.1-alpha.33

### Patch Changes

- Updated dependencies [e9d1b47]
- Updated dependencies [c5f2d50]
  - @mastra/core@0.2.0-alpha.85
  - @mastra/deployer@0.0.1-alpha.31

## 0.0.1-alpha.32

### Patch Changes

- e27fe69: Add dir to deployer
- Updated dependencies [e27fe69]
  - @mastra/deployer@0.0.1-alpha.30

## 0.0.1-alpha.31

### Patch Changes

- 38b7f66: Update deployer logic
- Updated dependencies [2f17a5f]
- Updated dependencies [0696eeb]
- Updated dependencies [cb290ee]
- Updated dependencies [b4d7416]
- Updated dependencies [38b7f66]
  - @mastra/core@0.2.0-alpha.84
  - @mastra/deployer@0.0.1-alpha.29

## 0.0.1-alpha.30

### Patch Changes

- 9625602: Use mastra core splitted bundles in other packages
- Updated dependencies [2ab57d6]
- Updated dependencies [30322ce]
- Updated dependencies [78eec7c]
- Updated dependencies [9625602]
- Updated dependencies [8769a62]
  - @mastra/deployer@0.0.1-alpha.28
  - @mastra/core@0.2.0-alpha.83

## 0.0.1-alpha.29

### Patch Changes

- Updated dependencies [73d112c]
- Updated dependencies [ac8c61a]
  - @mastra/deployer@0.0.1-alpha.27
  - @mastra/core@0.1.27-alpha.82

## 0.0.1-alpha.28

### Patch Changes

- Updated dependencies [9fb3039]
  - @mastra/core@0.1.27-alpha.81
  - @mastra/deployer@0.0.1-alpha.26

## 0.0.1-alpha.27

### Patch Changes

- Updated dependencies [327ece7]
  - @mastra/core@0.1.27-alpha.80
  - @mastra/deployer@0.0.1-alpha.25

## 0.0.1-alpha.26

### Patch Changes

- Updated dependencies [21fe536]
  - @mastra/core@0.1.27-alpha.79
  - @mastra/deployer@0.0.1-alpha.24

## 0.0.1-alpha.25

### Patch Changes

- Updated dependencies [88f18d7]
  - @mastra/deployer@0.0.1-alpha.23

## 0.0.1-alpha.24

### Patch Changes

- 44c7c26: Rebuild

## 0.0.1-alpha.23

### Patch Changes

- Updated dependencies [685108a]
- Updated dependencies [685108a]
  - @mastra/deployer@0.0.1-alpha.22
  - @mastra/core@0.1.27-alpha.78

## 0.0.1-alpha.22

### Patch Changes

- 2b75edf: mastra deployers tsup bundling
- Updated dependencies [8105fae]
- Updated dependencies [cfb966f]
  - @mastra/core@0.1.27-alpha.77
  - @mastra/deployer@0.0.1-alpha.21

## 0.0.1-alpha.21

### Patch Changes

- Updated dependencies [ae7bf94]
- Updated dependencies [ae7bf94]
  - @mastra/deployer@0.0.1-alpha.20
  - @mastra/core@0.1.27-alpha.76

## 0.0.1-alpha.20

### Patch Changes

- Updated dependencies [23dcb23]
- Updated dependencies [7064554]
  - @mastra/core@0.1.27-alpha.75
  - @mastra/deployer@0.0.1-alpha.19

## 0.0.1-alpha.19

### Patch Changes

- Updated dependencies [7b87567]
  - @mastra/core@0.1.27-alpha.74
  - @mastra/deployer@0.0.1-alpha.18

## 0.0.1-alpha.18

### Patch Changes

- Updated dependencies [3427b95]
  - @mastra/core@0.1.27-alpha.73
  - @mastra/deployer@0.0.1-alpha.17

## 0.0.1-alpha.17

### Patch Changes

- Updated dependencies [e4d4ede]
- Updated dependencies [06b2c0a]
  - @mastra/core@0.1.27-alpha.72
  - @mastra/deployer@0.0.1-alpha.16

## 0.0.1-alpha.16

### Patch Changes

- Updated dependencies [d9c8dd0]
  - @mastra/deployer@0.0.1-alpha.15
  - @mastra/core@0.1.27-alpha.71

## 0.0.1-alpha.15

### Patch Changes

- Updated dependencies [ad2cd74]
  - @mastra/deployer@0.0.1-alpha.14

## 0.0.1-alpha.14

### Patch Changes

- Updated dependencies [a1774e7]
  - @mastra/deployer@0.0.1-alpha.13

## 0.0.1-alpha.13

### Patch Changes

- Updated dependencies [28dceab]
  - @mastra/deployer@0.0.1-alpha.12

## 0.0.1-alpha.12

### Patch Changes

- bdaf834: publish packages
- Updated dependencies [bdaf834]
  - @mastra/deployer@0.0.1-alpha.11

## 0.0.1-alpha.11

### Patch Changes

- Updated dependencies [dd6d87f]
- Updated dependencies [04434b6]
  - @mastra/core@0.1.27-alpha.70
  - @mastra/deployer@0.0.1-alpha.10

## 0.0.1-alpha.10

### Patch Changes

- Updated dependencies [9066f95]
  - @mastra/deployer@0.0.1-alpha.9

## 0.0.1-alpha.9

### Patch Changes

- 0d5a03d: Vector store modules

## 0.0.1-alpha.8

### Patch Changes

- Updated dependencies [b425845]
  - @mastra/deployer@0.0.1-alpha.8

## 0.0.1-alpha.7

### Patch Changes

- Updated dependencies [1944807]
- Updated dependencies [9ade36e]
  - @mastra/deployer@0.0.1-alpha.7
  - @mastra/core@0.1.27-alpha.69

## 0.0.1-alpha.6

### Patch Changes

- Updated dependencies [291fe57]
- Updated dependencies [1a41fbf]
  - @mastra/deployer@0.0.1-alpha.6

## 0.0.1-alpha.5

### Patch Changes

- Updated dependencies [0be7181]
- Updated dependencies [0be7181]
  - @mastra/core@0.1.27-alpha.68
  - @mastra/deployer@0.0.1-alpha.5

## 0.0.1-alpha.4

### Patch Changes

- Updated dependencies [7babd5c]
  - @mastra/deployer@0.0.1-alpha.4

## 0.0.1-alpha.3

### Patch Changes

- Updated dependencies [c8ff2f5]
- Updated dependencies [a291824]
  - @mastra/core@0.1.27-alpha.67
  - @mastra/deployer@0.0.1-alpha.3

## 0.0.1-alpha.2

### Patch Changes

- 88600bc: Deployer fixes

## 0.0.1-alpha.1

### Patch Changes

- a9b5ddf: Publish new versions
- Updated dependencies [a9b5ddf]
- Updated dependencies [72c280b]
  - @mastra/deployer@0.0.1-alpha.2

## 0.0.1-alpha.0

### Patch Changes

- Updated dependencies [4139b43]
- Updated dependencies [a5604c4]
  - @mastra/deployer@0.0.1-alpha.0
