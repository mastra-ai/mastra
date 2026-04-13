# mastracode

## 0.13.1-alpha.2

### Patch Changes

- Updated dependencies [[`4ba3bb1`](https://github.com/mastra-ai/mastra/commit/4ba3bb1e465ad2ddaba3bbf2bc47e0faec32985e)]:
  - @mastra/core@1.25.0-alpha.2
  - @mastra/mcp@1.4.2
  - @mastra/memory@1.15.1-alpha.1

## 0.13.1-alpha.1

### Patch Changes

- Fixed symlinked skill paths so workspace skills resolve consistently and allowed path checks work through both symlink and real paths. ([#15228](https://github.com/mastra-ai/mastra/pull/15228))

- Updated dependencies [[`8fad147`](https://github.com/mastra-ai/mastra/commit/8fad14759804179c8e080ce4d9dec6ef1a808b31), [`582644c`](https://github.com/mastra-ai/mastra/commit/582644c4a87f83b4f245a84d72b9e8590585012e), [`5d84914`](https://github.com/mastra-ai/mastra/commit/5d84914e0e520c642a40329b210b413fcd139898), [`fd2f314`](https://github.com/mastra-ai/mastra/commit/fd2f31473d3449b6b97e837ef8641264377f41a7), [`e80fead`](https://github.com/mastra-ai/mastra/commit/e80fead1412cc0d1b2f7d6a1ce5017d9e0098ff7), [`0287b64`](https://github.com/mastra-ai/mastra/commit/0287b644a5c3272755cf3112e71338106664103b)]:
  - @mastra/core@1.25.0-alpha.1

## 0.13.1-alpha.0

### Patch Changes

- Updated dependencies [[`87df955`](https://github.com/mastra-ai/mastra/commit/87df955c028660c075873fd5d74af28233ce32eb), [`075e91a`](https://github.com/mastra-ai/mastra/commit/075e91a4549baf46ad7a42a6a8ac8dfa78cc09e6)]:
  - @mastra/core@1.24.2-alpha.0
  - @mastra/memory@1.15.1-alpha.0

## 0.13.0

### Minor Changes

- Added --thread, --title, and --clone-thread CLI options to headless mode for thread control. The most recent thread is now automatically resumed by default, and --continue is deprecated. ([#14962](https://github.com/mastra-ai/mastra/pull/14962))

### Patch Changes

- Fixed task list leaking across threads when switching conversations. Tasks from the previous thread no longer appear in the new thread. ([#15192](https://github.com/mastra-ai/mastra/pull/15192))

- Added collapsible output for shell passthrough (! commands). Output now defaults to 20 lines with Ctrl+E to expand/collapse, matching the existing tool call output behavior. ([#15092](https://github.com/mastra-ai/mastra/pull/15092))

- Updated dependencies [[`ef94400`](https://github.com/mastra-ai/mastra/commit/ef9440049402596b31f2ab976c5e4508f6cb6c91), [`3db852b`](https://github.com/mastra-ai/mastra/commit/3db852bff74e29f60d415a7b0f1583d6ce2bad92)]:
  - @mastra/core@1.24.1

## 0.13.0-alpha.2

### Patch Changes

- Fixed task list leaking across threads when switching conversations. Tasks from the previous thread no longer appear in the new thread. ([#15192](https://github.com/mastra-ai/mastra/pull/15192))

- Updated dependencies [[`3db852b`](https://github.com/mastra-ai/mastra/commit/3db852bff74e29f60d415a7b0f1583d6ce2bad92)]:
  - @mastra/core@1.24.1-alpha.1

## 0.13.0-alpha.1

### Minor Changes

- Added --thread, --title, and --clone-thread CLI options to headless mode for thread control. The most recent thread is now automatically resumed by default, and --continue is deprecated. ([#14962](https://github.com/mastra-ai/mastra/pull/14962))

## 0.12.2-alpha.0

### Patch Changes

- Added collapsible output for shell passthrough (! commands). Output now defaults to 20 lines with Ctrl+E to expand/collapse, matching the existing tool call output behavior. ([#15092](https://github.com/mastra-ai/mastra/pull/15092))

- Updated dependencies [[`ef94400`](https://github.com/mastra-ai/mastra/commit/ef9440049402596b31f2ab976c5e4508f6cb6c91)]:
  - @mastra/core@1.24.1-alpha.0

## 0.12.1

### Patch Changes

- Added support for Agent Skills spec directories (.agents/skills/) for skill discovery, both project-local and global (~/.agents/skills/) ([#15151](https://github.com/mastra-ai/mastra/pull/15151))

- Updated dependencies [[`8db7663`](https://github.com/mastra-ai/mastra/commit/8db7663c9a9c735828094c359d2e327fd4f8fba3), [`60b7d4a`](https://github.com/mastra-ai/mastra/commit/60b7d4a428c6caeca94f4740978359bb40c4ab37), [`ba6fa9c`](https://github.com/mastra-ai/mastra/commit/ba6fa9cc0f3e1912c49fd70d4c3bb8c44903ddaa), [`153e864`](https://github.com/mastra-ai/mastra/commit/153e86476b425db7cd0dc8490050096e92964a38), [`f308d62`](https://github.com/mastra-ai/mastra/commit/f308d6206a083eeaccbca782be062c57076935d7), [`715710d`](https://github.com/mastra-ai/mastra/commit/715710d12fa47cf88e09d41f13843eddc29327b0), [`378c6c4`](https://github.com/mastra-ai/mastra/commit/378c6c4755726e8d8cf83a14809b350b90d46c62), [`9f91fd5`](https://github.com/mastra-ai/mastra/commit/9f91fd538ab2a44f8cc740bcad8e51205f74fbea), [`ba6fa9c`](https://github.com/mastra-ai/mastra/commit/ba6fa9cc0f3e1912c49fd70d4c3bb8c44903ddaa), [`6f714ec`](https://github.com/mastra-ai/mastra/commit/6f714ec9a5614222761fd6ea3d53af1da9ab6034), [`98209a0`](https://github.com/mastra-ai/mastra/commit/98209a03c35c5479c25cca26ee0c63eff81e6d74), [`2bdb5fd`](https://github.com/mastra-ai/mastra/commit/2bdb5fd887bfd81bdb71c4a5db22a4fda99f2591)]:
  - @mastra/core@1.24.0
  - @mastra/memory@1.15.0
  - @mastra/mcp@1.4.2

## 0.12.1-alpha.4

### Patch Changes

- Updated dependencies [[`60b7d4a`](https://github.com/mastra-ai/mastra/commit/60b7d4a428c6caeca94f4740978359bb40c4ab37)]:
  - @mastra/memory@1.15.0-alpha.3

## 0.12.1-alpha.3

### Patch Changes

- Updated dependencies [[`6f714ec`](https://github.com/mastra-ai/mastra/commit/6f714ec9a5614222761fd6ea3d53af1da9ab6034), [`2bdb5fd`](https://github.com/mastra-ai/mastra/commit/2bdb5fd887bfd81bdb71c4a5db22a4fda99f2591)]:
  - @mastra/memory@1.15.0-alpha.2
  - @mastra/mcp@1.4.2-alpha.1

## 0.12.1-alpha.2

### Patch Changes

- Added support for Agent Skills spec directories (.agents/skills/) for skill discovery, both project-local and global (~/.agents/skills/) ([#15151](https://github.com/mastra-ai/mastra/pull/15151))

- Updated dependencies [[`8db7663`](https://github.com/mastra-ai/mastra/commit/8db7663c9a9c735828094c359d2e327fd4f8fba3), [`ba6fa9c`](https://github.com/mastra-ai/mastra/commit/ba6fa9cc0f3e1912c49fd70d4c3bb8c44903ddaa), [`715710d`](https://github.com/mastra-ai/mastra/commit/715710d12fa47cf88e09d41f13843eddc29327b0), [`378c6c4`](https://github.com/mastra-ai/mastra/commit/378c6c4755726e8d8cf83a14809b350b90d46c62), [`9f91fd5`](https://github.com/mastra-ai/mastra/commit/9f91fd538ab2a44f8cc740bcad8e51205f74fbea), [`ba6fa9c`](https://github.com/mastra-ai/mastra/commit/ba6fa9cc0f3e1912c49fd70d4c3bb8c44903ddaa)]:
  - @mastra/core@1.24.0-alpha.1
  - @mastra/memory@1.15.0-alpha.1

## 0.12.1-alpha.1

### Patch Changes

- Updated dependencies [[`153e864`](https://github.com/mastra-ai/mastra/commit/153e86476b425db7cd0dc8490050096e92964a38), [`98209a0`](https://github.com/mastra-ai/mastra/commit/98209a03c35c5479c25cca26ee0c63eff81e6d74)]:
  - @mastra/core@1.23.1-alpha.0
  - @mastra/mcp@1.4.2-alpha.0

## 0.12.1-alpha.0

### Patch Changes

- Updated dependencies [[`f308d62`](https://github.com/mastra-ai/mastra/commit/f308d6206a083eeaccbca782be062c57076935d7)]:
  - @mastra/memory@1.15.0-alpha.0

## 0.12.0

### Minor Changes

- Added `/browser` command to enable, disable, and configure browser automation providers (Stagehand or AgentBrowser) from the TUI, with settings persisted between sessions. ([#15036](https://github.com/mastra-ai/mastra/pull/15036))

### Patch Changes

- Fixed mastracode TUI memory usage during long sessions by pruning older rendered chat components after each agent turn. ([#15082](https://github.com/mastra-ai/mastra/pull/15082))

  The chat view now keeps recent conversation history available while preventing unbounded growth from rendered messages, tool outputs, slash command boxes, and system reminders.

- Updated dependencies [[`f32b9e1`](https://github.com/mastra-ai/mastra/commit/f32b9e115a3c754d1c8cfa3f4256fba87b09cfb7), [`7d6f521`](https://github.com/mastra-ai/mastra/commit/7d6f52164d0cca099f0b07cb2bba334360f1c8ab), [`a50d220`](https://github.com/mastra-ai/mastra/commit/a50d220b01ecbc5644d489a3d446c3bd4ab30245), [`a50d220`](https://github.com/mastra-ai/mastra/commit/a50d220b01ecbc5644d489a3d446c3bd4ab30245), [`665477b`](https://github.com/mastra-ai/mastra/commit/665477bc104fd52cfef8e7610d7664781a70c220), [`4cc2755`](https://github.com/mastra-ai/mastra/commit/4cc2755a7194cb08720ff2ab4dffb4b4a5103dfd), [`ac7baf6`](https://github.com/mastra-ai/mastra/commit/ac7baf66ef1db15e03975ef4ebb02724f015a391), [`ed425d7`](https://github.com/mastra-ai/mastra/commit/ed425d78e7c66cbda8209fee910856f98c6c6b82), [`a4c0c78`](https://github.com/mastra-ai/mastra/commit/a4c0c78264013624e5fe369f9a27aa25f3401012), [`1371703`](https://github.com/mastra-ai/mastra/commit/1371703835080450ef3f9aea58059a95d0da2e5a), [`0df8321`](https://github.com/mastra-ai/mastra/commit/0df832196eeb2450ab77ce887e8553abdd44c5a6), [`0df8321`](https://github.com/mastra-ai/mastra/commit/0df832196eeb2450ab77ce887e8553abdd44c5a6), [`98f8a8b`](https://github.com/mastra-ai/mastra/commit/98f8a8bdf5761b9982f3ad3acbe7f1cc3efa71f3), [`ba6f7e9`](https://github.com/mastra-ai/mastra/commit/ba6f7e9086d8281393f2acae60fda61de3bff1f9), [`a50d220`](https://github.com/mastra-ai/mastra/commit/a50d220b01ecbc5644d489a3d446c3bd4ab30245), [`7eb2596`](https://github.com/mastra-ai/mastra/commit/7eb25960d607e07468c9a10c5437abd2deaf1e9a), [`aced936`](https://github.com/mastra-ai/mastra/commit/aced93644d7544ef631c530b960ba1278dcef7f4), [`1805ddc`](https://github.com/mastra-ai/mastra/commit/1805ddc9c9b3b14b63749735a13c05a45af43a80), [`fff91cf`](https://github.com/mastra-ai/mastra/commit/fff91cf914de0e731578aacebffdeebef82f0440), [`ac7baf6`](https://github.com/mastra-ai/mastra/commit/ac7baf66ef1db15e03975ef4ebb02724f015a391), [`61109b3`](https://github.com/mastra-ai/mastra/commit/61109b34feb0e38d54bee4b8ca83eb7345b1d557), [`33f1ead`](https://github.com/mastra-ai/mastra/commit/33f1eadfa19c86953f593478e5fa371093b33779)]:
  - @mastra/core@1.23.0
  - @mastra/pg@1.9.0
  - @mastra/libsql@1.8.0
  - @mastra/memory@1.14.0

## 0.12.0-alpha.9

### Patch Changes

- Updated dependencies [[`a50d220`](https://github.com/mastra-ai/mastra/commit/a50d220b01ecbc5644d489a3d446c3bd4ab30245), [`a50d220`](https://github.com/mastra-ai/mastra/commit/a50d220b01ecbc5644d489a3d446c3bd4ab30245), [`a50d220`](https://github.com/mastra-ai/mastra/commit/a50d220b01ecbc5644d489a3d446c3bd4ab30245)]:
  - @mastra/core@1.23.0-alpha.9
  - @mastra/pg@1.9.0-alpha.0
  - @mastra/libsql@1.8.0-alpha.0

## 0.12.0-alpha.8

### Patch Changes

- Updated dependencies [[`ac7baf6`](https://github.com/mastra-ai/mastra/commit/ac7baf66ef1db15e03975ef4ebb02724f015a391), [`0df8321`](https://github.com/mastra-ai/mastra/commit/0df832196eeb2450ab77ce887e8553abdd44c5a6), [`0df8321`](https://github.com/mastra-ai/mastra/commit/0df832196eeb2450ab77ce887e8553abdd44c5a6), [`aced936`](https://github.com/mastra-ai/mastra/commit/aced93644d7544ef631c530b960ba1278dcef7f4), [`ac7baf6`](https://github.com/mastra-ai/mastra/commit/ac7baf66ef1db15e03975ef4ebb02724f015a391), [`61109b3`](https://github.com/mastra-ai/mastra/commit/61109b34feb0e38d54bee4b8ca83eb7345b1d557), [`33f1ead`](https://github.com/mastra-ai/mastra/commit/33f1eadfa19c86953f593478e5fa371093b33779)]:
  - @mastra/core@1.23.0-alpha.8
  - @mastra/memory@1.14.0-alpha.2

## 0.12.0-alpha.7

### Patch Changes

- Updated dependencies [[`665477b`](https://github.com/mastra-ai/mastra/commit/665477bc104fd52cfef8e7610d7664781a70c220), [`4cc2755`](https://github.com/mastra-ai/mastra/commit/4cc2755a7194cb08720ff2ab4dffb4b4a5103dfd)]:
  - @mastra/core@1.23.0-alpha.7

## 0.12.0-alpha.6

### Minor Changes

- Added `/browser` command to enable, disable, and configure browser automation providers (Stagehand or AgentBrowser) from the TUI, with settings persisted between sessions. ([#15036](https://github.com/mastra-ai/mastra/pull/15036))

### Patch Changes

- Fixed mastracode TUI memory usage during long sessions by pruning older rendered chat components after each agent turn. ([#15082](https://github.com/mastra-ai/mastra/pull/15082))

  The chat view now keeps recent conversation history available while preventing unbounded growth from rendered messages, tool outputs, slash command boxes, and system reminders.

- Updated dependencies [[`7d6f521`](https://github.com/mastra-ai/mastra/commit/7d6f52164d0cca099f0b07cb2bba334360f1c8ab)]:
  - @mastra/core@1.23.0-alpha.6

## 0.11.1-alpha.5

### Patch Changes

- Updated dependencies [[`1371703`](https://github.com/mastra-ai/mastra/commit/1371703835080450ef3f9aea58059a95d0da2e5a), [`98f8a8b`](https://github.com/mastra-ai/mastra/commit/98f8a8bdf5761b9982f3ad3acbe7f1cc3efa71f3)]:
  - @mastra/core@1.23.0-alpha.5

## 0.11.1-alpha.4

### Patch Changes

- Updated dependencies [[`a4c0c78`](https://github.com/mastra-ai/mastra/commit/a4c0c78264013624e5fe369f9a27aa25f3401012), [`fff91cf`](https://github.com/mastra-ai/mastra/commit/fff91cf914de0e731578aacebffdeebef82f0440)]:
  - @mastra/memory@1.14.0-alpha.1
  - @mastra/core@1.23.0-alpha.4

## 0.11.1-alpha.3

### Patch Changes

- Updated dependencies [[`1805ddc`](https://github.com/mastra-ai/mastra/commit/1805ddc9c9b3b14b63749735a13c05a45af43a80)]:
  - @mastra/core@1.23.0-alpha.3

## 0.11.1-alpha.2

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.23.0-alpha.2

## 0.11.1-alpha.1

### Patch Changes

- Updated dependencies [[`f32b9e1`](https://github.com/mastra-ai/mastra/commit/f32b9e115a3c754d1c8cfa3f4256fba87b09cfb7)]:
  - @mastra/core@1.23.0-alpha.1

## 0.11.1-alpha.0

### Patch Changes

- Updated dependencies [[`ed425d7`](https://github.com/mastra-ai/mastra/commit/ed425d78e7c66cbda8209fee910856f98c6c6b82), [`ba6f7e9`](https://github.com/mastra-ai/mastra/commit/ba6f7e9086d8281393f2acae60fda61de3bff1f9), [`7eb2596`](https://github.com/mastra-ai/mastra/commit/7eb25960d607e07468c9a10c5437abd2deaf1e9a)]:
  - @mastra/core@1.23.0-alpha.0
  - @mastra/memory@1.13.2-alpha.0

## 0.11.0

### Minor Changes

- Added Mastra Gateway integration with `/memory-gateway` setup command and automatic provider sync on startup. ([#14952](https://github.com/mastra-ai/mastra/pull/14952))

### Patch Changes

- Mask sensitive input fields (API keys, credentials, connection strings) in settings and login dialogs so they display as asterisks instead of plaintext ([#14936](https://github.com/mastra-ai/mastra/pull/14936))

- Updated dependencies [[`cb15509`](https://github.com/mastra-ai/mastra/commit/cb15509b58f6a83e11b765c945082afc027db972), [`81e4259`](https://github.com/mastra-ai/mastra/commit/81e425939b4ceeb4f586e9b6d89c3b1c1f2d2fe7), [`951b8a1`](https://github.com/mastra-ai/mastra/commit/951b8a1b5ef7e1474c59dc4f2b9fc1a8b1e508b6), [`80c5668`](https://github.com/mastra-ai/mastra/commit/80c5668e365470d3a96d3e953868fd7a643ff67c), [`3d478c1`](https://github.com/mastra-ai/mastra/commit/3d478c1e13f17b80f330ac49d7aa42ef929b93ff), [`2b4ea10`](https://github.com/mastra-ai/mastra/commit/2b4ea10b053e4ea1ab232d536933a4a3c4cba999), [`a0544f0`](https://github.com/mastra-ai/mastra/commit/a0544f0a1e6bd52ac12676228967c1938e43648d), [`6039f17`](https://github.com/mastra-ai/mastra/commit/6039f176f9c457304825ff1df8c83b8e457376c0), [`06b928d`](https://github.com/mastra-ai/mastra/commit/06b928dfc2f5630d023467476cc5919dfa858d0a), [`6a8d984`](https://github.com/mastra-ai/mastra/commit/6a8d9841f2933456ee1598099f488d742b600054), [`c8c86aa`](https://github.com/mastra-ai/mastra/commit/c8c86aa1458017fbd1c0776fdc0c520d129df8a6)]:
  - @mastra/core@1.22.0
  - @mastra/libsql@1.7.4
  - @mastra/pg@1.8.6
  - @mastra/memory@1.13.1

## 0.11.0-alpha.3

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.22.0-alpha.3

## 0.11.0-alpha.2

### Patch Changes

- Updated dependencies [[`cb15509`](https://github.com/mastra-ai/mastra/commit/cb15509b58f6a83e11b765c945082afc027db972), [`80c5668`](https://github.com/mastra-ai/mastra/commit/80c5668e365470d3a96d3e953868fd7a643ff67c), [`3d478c1`](https://github.com/mastra-ai/mastra/commit/3d478c1e13f17b80f330ac49d7aa42ef929b93ff), [`6039f17`](https://github.com/mastra-ai/mastra/commit/6039f176f9c457304825ff1df8c83b8e457376c0), [`06b928d`](https://github.com/mastra-ai/mastra/commit/06b928dfc2f5630d023467476cc5919dfa858d0a), [`6a8d984`](https://github.com/mastra-ai/mastra/commit/6a8d9841f2933456ee1598099f488d742b600054)]:
  - @mastra/core@1.22.0-alpha.2
  - @mastra/libsql@1.7.4-alpha.0
  - @mastra/pg@1.8.6-alpha.0
  - @mastra/memory@1.13.1-alpha.0

## 0.11.0-alpha.1

### Patch Changes

- Mask sensitive input fields (API keys, credentials, connection strings) in settings and login dialogs so they display as asterisks instead of plaintext ([#14936](https://github.com/mastra-ai/mastra/pull/14936))

- Updated dependencies [[`81e4259`](https://github.com/mastra-ai/mastra/commit/81e425939b4ceeb4f586e9b6d89c3b1c1f2d2fe7), [`951b8a1`](https://github.com/mastra-ai/mastra/commit/951b8a1b5ef7e1474c59dc4f2b9fc1a8b1e508b6)]:
  - @mastra/core@1.22.0-alpha.1

## 0.11.0-alpha.0

### Minor Changes

- Added Mastra Gateway integration with `/memory-gateway` setup command and automatic provider sync on startup. ([#14952](https://github.com/mastra-ai/mastra/pull/14952))

### Patch Changes

- Updated dependencies [[`2b4ea10`](https://github.com/mastra-ai/mastra/commit/2b4ea10b053e4ea1ab232d536933a4a3c4cba999), [`a0544f0`](https://github.com/mastra-ai/mastra/commit/a0544f0a1e6bd52ac12676228967c1938e43648d), [`c8c86aa`](https://github.com/mastra-ai/mastra/commit/c8c86aa1458017fbd1c0776fdc0c520d129df8a6)]:
  - @mastra/core@1.22.0-alpha.0

## 0.10.3

### Patch Changes

- Disabled MCP tool result timeout in MastraCode to allow for long running tools ([#14960](https://github.com/mastra-ai/mastra/pull/14960))

- Fixed agent sandbox instructions to use the `request_access` tool instead of telling users to manually run `/sandbox`. The agent now requests directory access interactively, reducing friction when working with files outside the project root. ([#14961](https://github.com/mastra-ai/mastra/pull/14961))

- Updated dependencies [[`9a43b47`](https://github.com/mastra-ai/mastra/commit/9a43b476465e86c9aca381c2831066b5c33c999a), [`ec5c319`](https://github.com/mastra-ai/mastra/commit/ec5c3197a50d034cb8e9cc494eebfddc684b5d81), [`6517789`](https://github.com/mastra-ai/mastra/commit/65177895b74b5471fe2245c7292f0176d9b3385d), [`13f4327`](https://github.com/mastra-ai/mastra/commit/13f4327f052faebe199cefbe906d33bf90238767), [`9ad6aa6`](https://github.com/mastra-ai/mastra/commit/9ad6aa6dfe858afc6955d1df5f3f78c40bb96b9c), [`2862127`](https://github.com/mastra-ai/mastra/commit/2862127d0a7cbd28523120ad64fea067a95838e6), [`3d16814`](https://github.com/mastra-ai/mastra/commit/3d16814c395931373543728994ff45ac98093074), [`7f498d0`](https://github.com/mastra-ai/mastra/commit/7f498d099eacef64fd43ee412e3bd6f87965a8a6), [`5467a87`](https://github.com/mastra-ai/mastra/commit/5467a87090d6359980344c443737c059afe5cc11), [`8cf8a67`](https://github.com/mastra-ai/mastra/commit/8cf8a67b061b737cb06d501fb8c1967a98bbf3cb), [`d7827e3`](https://github.com/mastra-ai/mastra/commit/d7827e393937c6cb0c7a744dde4d31538cb542b7)]:
  - @mastra/core@1.21.0
  - @mastra/memory@1.13.0

## 0.10.3-alpha.2

### Patch Changes

- Disabled MCP tool result timeout in MastraCode to allow for long running tools ([#14960](https://github.com/mastra-ai/mastra/pull/14960))

- Fixed agent sandbox instructions to use the `request_access` tool instead of telling users to manually run `/sandbox`. The agent now requests directory access interactively, reducing friction when working with files outside the project root. ([#14961](https://github.com/mastra-ai/mastra/pull/14961))

- Updated dependencies [[`ec5c319`](https://github.com/mastra-ai/mastra/commit/ec5c3197a50d034cb8e9cc494eebfddc684b5d81), [`6517789`](https://github.com/mastra-ai/mastra/commit/65177895b74b5471fe2245c7292f0176d9b3385d), [`9ad6aa6`](https://github.com/mastra-ai/mastra/commit/9ad6aa6dfe858afc6955d1df5f3f78c40bb96b9c), [`2862127`](https://github.com/mastra-ai/mastra/commit/2862127d0a7cbd28523120ad64fea067a95838e6), [`3d16814`](https://github.com/mastra-ai/mastra/commit/3d16814c395931373543728994ff45ac98093074), [`7f498d0`](https://github.com/mastra-ai/mastra/commit/7f498d099eacef64fd43ee412e3bd6f87965a8a6), [`8cf8a67`](https://github.com/mastra-ai/mastra/commit/8cf8a67b061b737cb06d501fb8c1967a98bbf3cb), [`d7827e3`](https://github.com/mastra-ai/mastra/commit/d7827e393937c6cb0c7a744dde4d31538cb542b7)]:
  - @mastra/core@1.21.0-alpha.2

## 0.10.3-alpha.1

### Patch Changes

- Updated dependencies [[`13f4327`](https://github.com/mastra-ai/mastra/commit/13f4327f052faebe199cefbe906d33bf90238767), [`5467a87`](https://github.com/mastra-ai/mastra/commit/5467a87090d6359980344c443737c059afe5cc11)]:
  - @mastra/core@1.21.0-alpha.1
  - @mastra/memory@1.13.0-alpha.0

## 0.10.3-alpha.0

### Patch Changes

- Updated dependencies [[`9a43b47`](https://github.com/mastra-ai/mastra/commit/9a43b476465e86c9aca381c2831066b5c33c999a)]:
  - @mastra/core@1.21.0-alpha.0

## 0.10.2

### Patch Changes

- Updated dependencies [[`cbeec24`](https://github.com/mastra-ai/mastra/commit/cbeec24b3c97a1a296e7e461e66cc7f7d215dc50), [`cee146b`](https://github.com/mastra-ai/mastra/commit/cee146b5d858212e1df2b2730fc36d3ceda0e08d), [`aa0aeff`](https://github.com/mastra-ai/mastra/commit/aa0aeffa11efbef5e219fbd97bf43d263cfe3afe), [`2bcec65`](https://github.com/mastra-ai/mastra/commit/2bcec652d62b07eab15e9eb9822f70184526eede), [`ad9bded`](https://github.com/mastra-ai/mastra/commit/ad9bdedf86a824801f49928a8d40f6e31ff5450f), [`cbeec24`](https://github.com/mastra-ai/mastra/commit/cbeec24b3c97a1a296e7e461e66cc7f7d215dc50), [`208c0bb`](https://github.com/mastra-ai/mastra/commit/208c0bbacbf5a1da6318f2a0e0c544390e542ddc), [`f566ee7`](https://github.com/mastra-ai/mastra/commit/f566ee7d53a3da33a01103e2a5ac2070ddefe6b0)]:
  - @mastra/core@1.20.0
  - @mastra/memory@1.12.1
  - @mastra/mcp@1.4.1

## 0.10.2-alpha.0

### Patch Changes

- Updated dependencies [[`cbeec24`](https://github.com/mastra-ai/mastra/commit/cbeec24b3c97a1a296e7e461e66cc7f7d215dc50), [`cee146b`](https://github.com/mastra-ai/mastra/commit/cee146b5d858212e1df2b2730fc36d3ceda0e08d), [`aa0aeff`](https://github.com/mastra-ai/mastra/commit/aa0aeffa11efbef5e219fbd97bf43d263cfe3afe), [`2bcec65`](https://github.com/mastra-ai/mastra/commit/2bcec652d62b07eab15e9eb9822f70184526eede), [`ad9bded`](https://github.com/mastra-ai/mastra/commit/ad9bdedf86a824801f49928a8d40f6e31ff5450f), [`cbeec24`](https://github.com/mastra-ai/mastra/commit/cbeec24b3c97a1a296e7e461e66cc7f7d215dc50), [`208c0bb`](https://github.com/mastra-ai/mastra/commit/208c0bbacbf5a1da6318f2a0e0c544390e542ddc), [`f566ee7`](https://github.com/mastra-ai/mastra/commit/f566ee7d53a3da33a01103e2a5ac2070ddefe6b0)]:
  - @mastra/core@1.20.0-alpha.0
  - @mastra/memory@1.12.1-alpha.0
  - @mastra/mcp@1.4.1-alpha.0

## 0.10.1

### Patch Changes

- Fixed /subagents to show configured subagents from the harness config. ([#14804](https://github.com/mastra-ai/mastra/pull/14804))

- Tools that return objects with circular references no longer crash the agent with "Converting circular structure to JSON". Circular parts are replaced with `"[Circular]"` and the conversation continues normally. ([#14535](https://github.com/mastra-ai/mastra/pull/14535))

- Updated dependencies [[`180aaaf`](https://github.com/mastra-ai/mastra/commit/180aaaf4d0903d33a49bc72de2d40ca69a5bc599), [`25bbff6`](https://github.com/mastra-ai/mastra/commit/25bbff67dadc01d5a18095574421f6266f610b17), [`9140989`](https://github.com/mastra-ai/mastra/commit/91409890e83f4f1d9c1b39223f1af91a6a53b549), [`542977f`](https://github.com/mastra-ai/mastra/commit/542977fe5043678df071ad3982b6bcbc78d95f02), [`d7c98cf`](https://github.com/mastra-ai/mastra/commit/d7c98cfc9d75baba9ecbf1a8835b5183d0a0aec8), [`acf5fbc`](https://github.com/mastra-ai/mastra/commit/acf5fbcb890dc7ca7167bec386ce5874dfadb997), [`24ca2ae`](https://github.com/mastra-ai/mastra/commit/24ca2ae57538ec189fabb9daee6175ad27035853), [`0762516`](https://github.com/mastra-ai/mastra/commit/07625167e029a8268ea7aaf0402416e6d8832874), [`9c57f2f`](https://github.com/mastra-ai/mastra/commit/9c57f2f7241e9f94769aa99fc86c531e8207d0f9), [`5bfc691`](https://github.com/mastra-ai/mastra/commit/5bfc69104c07ba7a9b55c2f8536422c0878b9c57), [`e91c011`](https://github.com/mastra-ai/mastra/commit/e91c0119878d956fdaab9b60ac721f93f3221335), [`d2d0bea`](https://github.com/mastra-ai/mastra/commit/d2d0beaafba2e25b9ad368015ce91312c372f6a5), [`2de3d36`](https://github.com/mastra-ai/mastra/commit/2de3d36932b7f73ad26bc403f7da26cfe89e903e), [`d3736cb`](https://github.com/mastra-ai/mastra/commit/d3736cb9ce074d2b8e8b00218a01f790fe81a1b4), [`c627366`](https://github.com/mastra-ai/mastra/commit/c6273666f9ef4c8c617c68b7d07fe878a322f85c), [`66a7412`](https://github.com/mastra-ai/mastra/commit/66a7412ec0550f3dfa01cd05b057d8c6e5b062bc)]:
  - @mastra/core@1.19.0
  - @mastra/memory@1.12.0
  - @mastra/pg@1.8.5
  - @mastra/mcp@1.4.0

## 0.10.1-alpha.2

### Patch Changes

- Updated dependencies [[`542977f`](https://github.com/mastra-ai/mastra/commit/542977fe5043678df071ad3982b6bcbc78d95f02), [`9c57f2f`](https://github.com/mastra-ai/mastra/commit/9c57f2f7241e9f94769aa99fc86c531e8207d0f9), [`5bfc691`](https://github.com/mastra-ai/mastra/commit/5bfc69104c07ba7a9b55c2f8536422c0878b9c57), [`d2d0bea`](https://github.com/mastra-ai/mastra/commit/d2d0beaafba2e25b9ad368015ce91312c372f6a5)]:
  - @mastra/memory@1.12.0-alpha.1
  - @mastra/core@1.19.0-alpha.2

## 0.10.1-alpha.1

### Patch Changes

- Fixed /subagents to show configured subagents from the harness config. ([#14804](https://github.com/mastra-ai/mastra/pull/14804))

- Tools that return objects with circular references no longer crash the agent with "Converting circular structure to JSON". Circular parts are replaced with `"[Circular]"` and the conversation continues normally. ([#14535](https://github.com/mastra-ai/mastra/pull/14535))

- Updated dependencies [[`9140989`](https://github.com/mastra-ai/mastra/commit/91409890e83f4f1d9c1b39223f1af91a6a53b549), [`d7c98cf`](https://github.com/mastra-ai/mastra/commit/d7c98cfc9d75baba9ecbf1a8835b5183d0a0aec8), [`acf5fbc`](https://github.com/mastra-ai/mastra/commit/acf5fbcb890dc7ca7167bec386ce5874dfadb997), [`24ca2ae`](https://github.com/mastra-ai/mastra/commit/24ca2ae57538ec189fabb9daee6175ad27035853), [`0762516`](https://github.com/mastra-ai/mastra/commit/07625167e029a8268ea7aaf0402416e6d8832874), [`e91c011`](https://github.com/mastra-ai/mastra/commit/e91c0119878d956fdaab9b60ac721f93f3221335), [`2de3d36`](https://github.com/mastra-ai/mastra/commit/2de3d36932b7f73ad26bc403f7da26cfe89e903e), [`d3736cb`](https://github.com/mastra-ai/mastra/commit/d3736cb9ce074d2b8e8b00218a01f790fe81a1b4), [`c627366`](https://github.com/mastra-ai/mastra/commit/c6273666f9ef4c8c617c68b7d07fe878a322f85c), [`66a7412`](https://github.com/mastra-ai/mastra/commit/66a7412ec0550f3dfa01cd05b057d8c6e5b062bc)]:
  - @mastra/core@1.18.1-alpha.1
  - @mastra/pg@1.8.5-alpha.0
  - @mastra/mcp@1.4.0-alpha.0

## 0.10.1-alpha.0

### Patch Changes

- Updated dependencies [[`180aaaf`](https://github.com/mastra-ai/mastra/commit/180aaaf4d0903d33a49bc72de2d40ca69a5bc599), [`25bbff6`](https://github.com/mastra-ai/mastra/commit/25bbff67dadc01d5a18095574421f6266f610b17)]:
  - @mastra/core@1.18.1-alpha.0
  - @mastra/memory@1.11.1-alpha.0

## 0.10.0

### Minor Changes

- Added a "Custom response..." option to questions with predefined choices. When selected, it switches to a free-text input so you can type an answer not covered by the given options. ([#14845](https://github.com/mastra-ai/mastra/pull/14845))

- Added a /thread command to show the active thread, resource, and pending-new-thread state. ([#14567](https://github.com/mastra-ai/mastra/pull/14567))

### Patch Changes

- Persist observational memory threshold settings across restarts and restore per-thread overrides. ([#14788](https://github.com/mastra-ai/mastra/pull/14788))

- Improved Mastra Code prompt guidance so responses stay concise and terminal-friendly. ([#14688](https://github.com/mastra-ai/mastra/pull/14688))

- Fixed provider name quoting in gateway sync to properly quote digit-leading provider IDs (e.g. `302ai`), preventing repeated "invalid provider-types in global cache" warnings from GatewayRegistry. ([#14867](https://github.com/mastra-ai/mastra/pull/14867))

- Limit dynamically injected AGENTS.md reminders to 1000 estimated tokens by default and tell mastracode observational memory to ignore those ephemeral reminder messages. ([#14790](https://github.com/mastra-ai/mastra/pull/14790))

- Improved the Loaded AGENTS.md reminder in the TUI so it uses the new bordered notice style and collapses long reminder content by default. ([#14637](https://github.com/mastra-ai/mastra/pull/14637))

- Fixed the thread selector so it shows all threads consistently and opens faster. ([#14690](https://github.com/mastra-ai/mastra/pull/14690))

- Custom slash commands now load correctly from all configured directories ([#14727](https://github.com/mastra-ai/mastra/pull/14727))

- Updated dependencies [[`dc514a8`](https://github.com/mastra-ai/mastra/commit/dc514a83dba5f719172dddfd2c7b858e4943d067), [`e333b77`](https://github.com/mastra-ai/mastra/commit/e333b77e2d76ba57ccec1818e08cebc1993469ff), [`dc9fc19`](https://github.com/mastra-ai/mastra/commit/dc9fc19da4437f6b508cc355f346a8856746a76b), [`60a224d`](https://github.com/mastra-ai/mastra/commit/60a224dd497240e83698cfa5bfd02e3d1d854844), [`0dbaab9`](https://github.com/mastra-ai/mastra/commit/0dbaab988103f27495c37fd820f03a632eab2c59), [`fbf22a7`](https://github.com/mastra-ai/mastra/commit/fbf22a7ad86bcb50dcf30459f0d075e51ddeb468), [`1662721`](https://github.com/mastra-ai/mastra/commit/1662721aac59ad048b5df80323bdfb836fccbbfe), [`f16d92c`](https://github.com/mastra-ai/mastra/commit/f16d92c677a119a135cebcf7e2b9f51ada7a9df4), [`949b7bf`](https://github.com/mastra-ai/mastra/commit/949b7bfd4e40f2b2cba7fef5eb3f108a02cfe938), [`404fea1`](https://github.com/mastra-ai/mastra/commit/404fea13042181f0b0c73a101392ac87c79ceae2), [`ebf5047`](https://github.com/mastra-ai/mastra/commit/ebf5047e825c38a1a356f10b214c1d4260dfcd8d), [`12c647c`](https://github.com/mastra-ai/mastra/commit/12c647cf3a26826eb72d40b42e3c8356ceae16ed), [`d084b66`](https://github.com/mastra-ai/mastra/commit/d084b6692396057e83c086b954c1857d20b58a14), [`79c699a`](https://github.com/mastra-ai/mastra/commit/79c699acf3cd8a77e11c55530431f48eb48456e9), [`62757b6`](https://github.com/mastra-ai/mastra/commit/62757b6db6e8bb86569d23ad0b514178f57053f8), [`675f15b`](https://github.com/mastra-ai/mastra/commit/675f15b7eaeea649158d228ea635be40480c584d), [`b174c63`](https://github.com/mastra-ai/mastra/commit/b174c63a093108d4e53b9bc89a078d9f66202b3f), [`819f03c`](https://github.com/mastra-ai/mastra/commit/819f03c25823373b32476413bd76be28a5d8705a), [`04160ee`](https://github.com/mastra-ai/mastra/commit/04160eedf3130003cf842ad08428c8ff69af4cc1), [`7302e5c`](https://github.com/mastra-ai/mastra/commit/7302e5ce0f52d769d3d63fb0faa8a7d4089cda6d), [`2c27503`](https://github.com/mastra-ai/mastra/commit/2c275032510d131d2cde47f99953abf0fe02c081), [`424a1df`](https://github.com/mastra-ai/mastra/commit/424a1df7bee59abb5c83717a54807fdd674a6224), [`3d70b0b`](https://github.com/mastra-ai/mastra/commit/3d70b0b3524d817173ad870768f259c06d61bd23), [`eef7cb2`](https://github.com/mastra-ai/mastra/commit/eef7cb2abe7ef15951e2fdf792a5095c6c643333), [`43595bf`](https://github.com/mastra-ai/mastra/commit/43595bf7b8df1a6edce7a23b445b5124d2a0b473), [`260fe12`](https://github.com/mastra-ai/mastra/commit/260fe1295fe7354e39d6def2775e0797a7a277f0), [`fbf22a7`](https://github.com/mastra-ai/mastra/commit/fbf22a7ad86bcb50dcf30459f0d075e51ddeb468), [`12c88a6`](https://github.com/mastra-ai/mastra/commit/12c88a6e32bf982c2fe0c6af62e65a3414519a75), [`43595bf`](https://github.com/mastra-ai/mastra/commit/43595bf7b8df1a6edce7a23b445b5124d2a0b473), [`78670e9`](https://github.com/mastra-ai/mastra/commit/78670e97e76d7422cf7025faf371b2aeafed860d), [`e8a5b0b`](https://github.com/mastra-ai/mastra/commit/e8a5b0b9bc94d12dee4150095512ca27a288d778), [`3b45a13`](https://github.com/mastra-ai/mastra/commit/3b45a138d09d040779c0aba1edbbfc1b57442d23), [`dd668a0`](https://github.com/mastra-ai/mastra/commit/dd668a0e4d6b3fd75cbe780028b578f0ac0ec635), [`d400e7c`](https://github.com/mastra-ai/mastra/commit/d400e7c8b8d7afa6ba2c71769eace4048e3cef8e), [`d657856`](https://github.com/mastra-ai/mastra/commit/d6578561c104fecfeb3caa17dc07d1acbeeffff7), [`f58d1a7`](https://github.com/mastra-ai/mastra/commit/f58d1a7a457588a996c3ecb53201a68f3d28c432), [`a49a929`](https://github.com/mastra-ai/mastra/commit/a49a92904968b4fc67e01effee8c7c8d0464ba85), [`8127d96`](https://github.com/mastra-ai/mastra/commit/8127d96280492e335d49b244501088dfdd59a8f1)]:
  - @mastra/core@1.18.0
  - @mastra/memory@1.11.0
  - @mastra/pg@1.8.4
  - @mastra/libsql@1.7.3
  - @mastra/mcp@1.3.2

## 0.10.0-alpha.8

### Minor Changes

- Added a "Custom response..." option to questions with predefined choices. When selected, it switches to a free-text input so you can type an answer not covered by the given options. ([#14845](https://github.com/mastra-ai/mastra/pull/14845))

### Patch Changes

- Updated dependencies [[`12c647c`](https://github.com/mastra-ai/mastra/commit/12c647cf3a26826eb72d40b42e3c8356ceae16ed), [`819f03c`](https://github.com/mastra-ai/mastra/commit/819f03c25823373b32476413bd76be28a5d8705a)]:
  - @mastra/core@1.18.0-alpha.5

## 0.10.0-alpha.7

### Patch Changes

- Updated dependencies [[`fbf22a7`](https://github.com/mastra-ai/mastra/commit/fbf22a7ad86bcb50dcf30459f0d075e51ddeb468), [`04160ee`](https://github.com/mastra-ai/mastra/commit/04160eedf3130003cf842ad08428c8ff69af4cc1), [`2c27503`](https://github.com/mastra-ai/mastra/commit/2c275032510d131d2cde47f99953abf0fe02c081), [`424a1df`](https://github.com/mastra-ai/mastra/commit/424a1df7bee59abb5c83717a54807fdd674a6224), [`43595bf`](https://github.com/mastra-ai/mastra/commit/43595bf7b8df1a6edce7a23b445b5124d2a0b473), [`fbf22a7`](https://github.com/mastra-ai/mastra/commit/fbf22a7ad86bcb50dcf30459f0d075e51ddeb468), [`12c88a6`](https://github.com/mastra-ai/mastra/commit/12c88a6e32bf982c2fe0c6af62e65a3414519a75), [`43595bf`](https://github.com/mastra-ai/mastra/commit/43595bf7b8df1a6edce7a23b445b5124d2a0b473), [`78670e9`](https://github.com/mastra-ai/mastra/commit/78670e97e76d7422cf7025faf371b2aeafed860d), [`d400e7c`](https://github.com/mastra-ai/mastra/commit/d400e7c8b8d7afa6ba2c71769eace4048e3cef8e), [`f58d1a7`](https://github.com/mastra-ai/mastra/commit/f58d1a7a457588a996c3ecb53201a68f3d28c432), [`a49a929`](https://github.com/mastra-ai/mastra/commit/a49a92904968b4fc67e01effee8c7c8d0464ba85)]:
  - @mastra/core@1.18.0-alpha.4
  - @mastra/mcp@1.3.2-alpha.0
  - @mastra/libsql@1.7.3-alpha.3
  - @mastra/pg@1.8.4-alpha.3

## 0.10.0-alpha.6

### Minor Changes

- Added a /thread command to show the active thread, resource, and pending-new-thread state. ([#14567](https://github.com/mastra-ai/mastra/pull/14567))

### Patch Changes

- Persist observational memory threshold settings across restarts and restore per-thread overrides. ([#14788](https://github.com/mastra-ai/mastra/pull/14788))

- Limit dynamically injected AGENTS.md reminders to 1000 estimated tokens by default and tell mastracode observational memory to ignore those ephemeral reminder messages. ([#14790](https://github.com/mastra-ai/mastra/pull/14790))

- Updated dependencies [[`e333b77`](https://github.com/mastra-ai/mastra/commit/e333b77e2d76ba57ccec1818e08cebc1993469ff), [`60a224d`](https://github.com/mastra-ai/mastra/commit/60a224dd497240e83698cfa5bfd02e3d1d854844), [`949b7bf`](https://github.com/mastra-ai/mastra/commit/949b7bfd4e40f2b2cba7fef5eb3f108a02cfe938), [`d084b66`](https://github.com/mastra-ai/mastra/commit/d084b6692396057e83c086b954c1857d20b58a14), [`79c699a`](https://github.com/mastra-ai/mastra/commit/79c699acf3cd8a77e11c55530431f48eb48456e9), [`62757b6`](https://github.com/mastra-ai/mastra/commit/62757b6db6e8bb86569d23ad0b514178f57053f8), [`3d70b0b`](https://github.com/mastra-ai/mastra/commit/3d70b0b3524d817173ad870768f259c06d61bd23), [`3b45a13`](https://github.com/mastra-ai/mastra/commit/3b45a138d09d040779c0aba1edbbfc1b57442d23), [`dd668a0`](https://github.com/mastra-ai/mastra/commit/dd668a0e4d6b3fd75cbe780028b578f0ac0ec635), [`8127d96`](https://github.com/mastra-ai/mastra/commit/8127d96280492e335d49b244501088dfdd59a8f1)]:
  - @mastra/core@1.18.0-alpha.3
  - @mastra/memory@1.11.0-alpha.4

## 0.9.3-alpha.5

### Patch Changes

- Custom slash commands now load correctly from all configured directories ([#14727](https://github.com/mastra-ai/mastra/pull/14727))

- Updated dependencies [[`f16d92c`](https://github.com/mastra-ai/mastra/commit/f16d92c677a119a135cebcf7e2b9f51ada7a9df4)]:
  - @mastra/core@1.18.0-alpha.2

## 0.9.3-alpha.4

### Patch Changes

- Updated dependencies [[`dc9fc19`](https://github.com/mastra-ai/mastra/commit/dc9fc19da4437f6b508cc355f346a8856746a76b), [`0dbaab9`](https://github.com/mastra-ai/mastra/commit/0dbaab988103f27495c37fd820f03a632eab2c59), [`1662721`](https://github.com/mastra-ai/mastra/commit/1662721aac59ad048b5df80323bdfb836fccbbfe), [`260fe12`](https://github.com/mastra-ai/mastra/commit/260fe1295fe7354e39d6def2775e0797a7a277f0)]:
  - @mastra/core@1.18.0-alpha.1
  - @mastra/memory@1.10.1-alpha.3
  - @mastra/libsql@1.7.3-alpha.2
  - @mastra/pg@1.8.4-alpha.2

## 0.9.3-alpha.3

### Patch Changes

- Improved Mastra Code prompt guidance so responses stay concise and terminal-friendly. ([#14688](https://github.com/mastra-ai/mastra/pull/14688))

- Improved the Loaded AGENTS.md reminder in the TUI so it uses the new bordered notice style and collapses long reminder content by default. ([#14637](https://github.com/mastra-ai/mastra/pull/14637))

- Fixed the thread selector so it shows all threads consistently and opens faster. ([#14690](https://github.com/mastra-ai/mastra/pull/14690))

- Updated dependencies [[`dc514a8`](https://github.com/mastra-ai/mastra/commit/dc514a83dba5f719172dddfd2c7b858e4943d067), [`404fea1`](https://github.com/mastra-ai/mastra/commit/404fea13042181f0b0c73a101392ac87c79ceae2), [`ebf5047`](https://github.com/mastra-ai/mastra/commit/ebf5047e825c38a1a356f10b214c1d4260dfcd8d), [`675f15b`](https://github.com/mastra-ai/mastra/commit/675f15b7eaeea649158d228ea635be40480c584d), [`b174c63`](https://github.com/mastra-ai/mastra/commit/b174c63a093108d4e53b9bc89a078d9f66202b3f), [`7302e5c`](https://github.com/mastra-ai/mastra/commit/7302e5ce0f52d769d3d63fb0faa8a7d4089cda6d), [`eef7cb2`](https://github.com/mastra-ai/mastra/commit/eef7cb2abe7ef15951e2fdf792a5095c6c643333), [`e8a5b0b`](https://github.com/mastra-ai/mastra/commit/e8a5b0b9bc94d12dee4150095512ca27a288d778), [`d657856`](https://github.com/mastra-ai/mastra/commit/d6578561c104fecfeb3caa17dc07d1acbeeffff7)]:
  - @mastra/core@1.18.0-alpha.0
  - @mastra/memory@1.10.1-alpha.2
  - @mastra/pg@1.8.4-alpha.1
  - @mastra/libsql@1.7.3-alpha.1

## 0.9.3-alpha.2

### Patch Changes

- Improved Mastra Code prompt guidance so responses stay concise and terminal-friendly. ([#14688](https://github.com/mastra-ai/mastra/pull/14688))

- Improved the Loaded AGENTS.md reminder in the TUI so it uses the new bordered notice style and collapses long reminder content by default. ([#14637](https://github.com/mastra-ai/mastra/pull/14637))

- Fixed the thread selector so it shows all threads consistently and opens faster. ([#14690](https://github.com/mastra-ai/mastra/pull/14690))

- Updated dependencies [[`404fea1`](https://github.com/mastra-ai/mastra/commit/404fea13042181f0b0c73a101392ac87c79ceae2), [`ebf5047`](https://github.com/mastra-ai/mastra/commit/ebf5047e825c38a1a356f10b214c1d4260dfcd8d), [`675f15b`](https://github.com/mastra-ai/mastra/commit/675f15b7eaeea649158d228ea635be40480c584d), [`b174c63`](https://github.com/mastra-ai/mastra/commit/b174c63a093108d4e53b9bc89a078d9f66202b3f), [`eef7cb2`](https://github.com/mastra-ai/mastra/commit/eef7cb2abe7ef15951e2fdf792a5095c6c643333), [`86e3263`](https://github.com/mastra-ai/mastra/commit/86e326363edd12be5a5b25ccce4a39f66f7c9f50), [`e8a5b0b`](https://github.com/mastra-ai/mastra/commit/e8a5b0b9bc94d12dee4150095512ca27a288d778)]:
  - @mastra/core@1.17.0-alpha.2

## 0.9.3-alpha.1

### Patch Changes

- Updated dependencies [[`7302e5c`](https://github.com/mastra-ai/mastra/commit/7302e5ce0f52d769d3d63fb0faa8a7d4089cda6d)]:
  - @mastra/memory@1.10.1-alpha.1
  - @mastra/core@1.16.1-alpha.1
  - @mastra/pg@1.8.4-alpha.0
  - @mastra/libsql@1.7.3-alpha.0

## 0.9.3-alpha.0

### Patch Changes

- Updated dependencies [[`dc514a8`](https://github.com/mastra-ai/mastra/commit/dc514a83dba5f719172dddfd2c7b858e4943d067), [`d657856`](https://github.com/mastra-ai/mastra/commit/d6578561c104fecfeb3caa17dc07d1acbeeffff7)]:
  - @mastra/core@1.16.1-alpha.0
  - @mastra/memory@1.10.1-alpha.0

## 0.9.2

### Patch Changes

- Added macOS sleep prevention while Mastra Code is actively running. ([#14586](https://github.com/mastra-ai/mastra/pull/14586))

  Mastra Code now starts the built-in caffeinate utility only while an agent run is in progress, then releases it after completion, aborts, errors, or app shutdown.

  To opt out, set MASTRACODE_DISABLE_CAFFEINATE=1 before launching Mastra Code.

- Removed the Anthropic OAuth warning flow from Mastra Code. ([#14605](https://github.com/mastra-ai/mastra/pull/14605))

  `/login`, startup, and the setup wizard no longer interrupt Anthropic OAuth with the Claude Max warning prompt, and the related onboarding setting has been removed. Anthropic has confirmed that users do not get banned for using Claude max oauth. https://x.com/trq212/status/2035076299774206228?s=20

- Mastra Code now defaults the OpenAI mode pack to use `openai/gpt-5.4` for build and plan, and `openai/gpt-5.4-mini` for fast mode. The OpenAI OM pack selected during setup now defaults to `openai/gpt-5.4-mini`. ([#14604](https://github.com/mastra-ai/mastra/pull/14604))

- Improved Mastra Code autonomy prompts by expanding the default guidance around assumptions, persistence, and when to ask questions. Also applied GPT-5.4-specific prompt instructions consistently during prompt assembly. ([#14587](https://github.com/mastra-ai/mastra/pull/14587))

- Updated dependencies [[`68ed4e9`](https://github.com/mastra-ai/mastra/commit/68ed4e9f118e8646b60a6112dabe854d0ef53902), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`be37de4`](https://github.com/mastra-ai/mastra/commit/be37de4391bd1d5486ce38efacbf00ca51637262), [`7dbd611`](https://github.com/mastra-ai/mastra/commit/7dbd611a85cb1e0c0a1581c57564268cb183d86e), [`f14604c`](https://github.com/mastra-ai/mastra/commit/f14604c7ef01ba794e1a8d5c7bae5415852aacec), [`4a75e10`](https://github.com/mastra-ai/mastra/commit/4a75e106bd31c283a1b3fe74c923610dcc46415b), [`f3ce603`](https://github.com/mastra-ai/mastra/commit/f3ce603fd76180f4a5be90b6dc786d389b6b3e98), [`423aa6f`](https://github.com/mastra-ai/mastra/commit/423aa6fd12406de6a1cc6b68e463d30af1d790fb), [`f21c626`](https://github.com/mastra-ai/mastra/commit/f21c6263789903ab9720b4d11373093298e97f15), [`41aee84`](https://github.com/mastra-ai/mastra/commit/41aee84561ceebe28bad1ecba8702d92838f67f0), [`2871451`](https://github.com/mastra-ai/mastra/commit/2871451703829aefa06c4a5d6eca7fd3731222ef), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124), [`e06b520`](https://github.com/mastra-ai/mastra/commit/e06b520bdd5fdef844760c5e692c7852cbc5c240), [`d3930ea`](https://github.com/mastra-ai/mastra/commit/d3930eac51c30b0ecf7eaa54bb9430758b399777), [`dd9c4e0`](https://github.com/mastra-ai/mastra/commit/dd9c4e0a47962f1413e9b72114fcad912e19a0a6), [`23bd359`](https://github.com/mastra-ai/mastra/commit/23bd359c50898c3b28b9ee25ce47c12614da5a36)]:
  - @mastra/core@1.16.0
  - @mastra/libsql@1.7.2
  - @mastra/pg@1.8.3
  - @mastra/memory@1.10.0
  - @mastra/mcp@1.3.1

## 0.9.2-alpha.6

### Patch Changes

- Updated dependencies [[`f21c626`](https://github.com/mastra-ai/mastra/commit/f21c6263789903ab9720b4d11373093298e97f15)]:
  - @mastra/core@1.16.0-alpha.5

## 0.9.2-alpha.5

### Patch Changes

- Updated dependencies [[`f14604c`](https://github.com/mastra-ai/mastra/commit/f14604c7ef01ba794e1a8d5c7bae5415852aacec), [`e06b520`](https://github.com/mastra-ai/mastra/commit/e06b520bdd5fdef844760c5e692c7852cbc5c240), [`dd9c4e0`](https://github.com/mastra-ai/mastra/commit/dd9c4e0a47962f1413e9b72114fcad912e19a0a6)]:
  - @mastra/core@1.16.0-alpha.4
  - @mastra/memory@1.10.0-alpha.2

## 0.9.2-alpha.4

### Patch Changes

- Updated dependencies [[`423aa6f`](https://github.com/mastra-ai/mastra/commit/423aa6fd12406de6a1cc6b68e463d30af1d790fb), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124)]:
  - @mastra/core@1.16.0-alpha.3
  - @mastra/mcp@1.3.1
  - @mastra/memory@1.9.1-alpha.1

## 0.9.2-alpha.3

### Patch Changes

- Removed the Anthropic OAuth warning flow from Mastra Code. ([#14605](https://github.com/mastra-ai/mastra/pull/14605))

  `/login`, startup, and the setup wizard no longer interrupt Anthropic OAuth with the Claude Max warning prompt, and the related onboarding setting has been removed. Anthropic has confirmed that users do not get banned for using Claude max oauth. https://x.com/trq212/status/2035076299774206228?s=20

- Mastra Code now defaults the OpenAI mode pack to use `openai/gpt-5.4` for build and plan, and `openai/gpt-5.4-mini` for fast mode. The OpenAI OM pack selected during setup now defaults to `openai/gpt-5.4-mini`. ([#14604](https://github.com/mastra-ai/mastra/pull/14604))

- Updated dependencies [[`be37de4`](https://github.com/mastra-ai/mastra/commit/be37de4391bd1d5486ce38efacbf00ca51637262), [`f3ce603`](https://github.com/mastra-ai/mastra/commit/f3ce603fd76180f4a5be90b6dc786d389b6b3e98), [`2871451`](https://github.com/mastra-ai/mastra/commit/2871451703829aefa06c4a5d6eca7fd3731222ef), [`d3930ea`](https://github.com/mastra-ai/mastra/commit/d3930eac51c30b0ecf7eaa54bb9430758b399777), [`23bd359`](https://github.com/mastra-ai/mastra/commit/23bd359c50898c3b28b9ee25ce47c12614da5a36)]:
  - @mastra/core@1.16.0-alpha.2
  - @mastra/memory@1.9.1-alpha.0
  - @mastra/mcp@1.3.1

## 0.9.2-alpha.2

### Patch Changes

- Added macOS sleep prevention while Mastra Code is actively running. ([#14586](https://github.com/mastra-ai/mastra/pull/14586))

  Mastra Code now starts the built-in caffeinate utility only while an agent run is in progress, then releases it after completion, aborts, errors, or app shutdown.

  To opt out, set MASTRACODE_DISABLE_CAFFEINATE=1 before launching Mastra Code.

- Updated dependencies [[`7dbd611`](https://github.com/mastra-ai/mastra/commit/7dbd611a85cb1e0c0a1581c57564268cb183d86e), [`41aee84`](https://github.com/mastra-ai/mastra/commit/41aee84561ceebe28bad1ecba8702d92838f67f0)]:
  - @mastra/core@1.16.0-alpha.1
  - @mastra/libsql@1.7.2-alpha.1
  - @mastra/pg@1.8.3-alpha.1

## 0.9.2-alpha.1

### Patch Changes

- Improved Mastra Code autonomy prompts by expanding the default guidance around assumptions, persistence, and when to ask questions. Also applied GPT-5.4-specific prompt instructions consistently during prompt assembly. ([#14587](https://github.com/mastra-ai/mastra/pull/14587))

## 0.9.2-alpha.0

### Patch Changes

- Updated dependencies [[`68ed4e9`](https://github.com/mastra-ai/mastra/commit/68ed4e9f118e8646b60a6112dabe854d0ef53902), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`4a75e10`](https://github.com/mastra-ai/mastra/commit/4a75e106bd31c283a1b3fe74c923610dcc46415b), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c)]:
  - @mastra/core@1.16.0-alpha.0
  - @mastra/libsql@1.7.2-alpha.0
  - @mastra/pg@1.8.3-alpha.0

## 0.9.1

### Patch Changes

- Fixed mastracode to forward harness thread and resource headers to model providers. ([#14433](https://github.com/mastra-ai/mastra/pull/14433))

- Removed italic styling from tool arguments (shell commands, web search queries, and generic tool args) for improved readability in the terminal. ([#14472](https://github.com/mastra-ai/mastra/pull/14472))

- Added thread title support to Mastra Code. ([#14436](https://github.com/mastra-ai/mastra/pull/14436))
  - Show live thread title update markers in the chat history.
  - Display non-generic thread titles in the status bar and thread picker.
  - Auto-truncate long titles to fit available terminal width.

- Fixed inline text questions so long answers wrap inside the question box instead of crashing the terminal render. ([#14479](https://github.com/mastra-ai/mastra/pull/14479))

- Improved `/threads` so it opens quickly with batched lazy preview loading, reuses cached previews across the active TUI session, and refreshes cached previews whenever a thread's `updatedAt` changes. ([#14428](https://github.com/mastra-ai/mastra/pull/14428))

- Improved the Mastra Code TUI with clearer user history styling and a smoother active prompt animation. ([#14423](https://github.com/mastra-ai/mastra/pull/14423))

- Fixed mastracode dependency ranges to use explicit semver constraints instead of latest. ([#14541](https://github.com/mastra-ai/mastra/pull/14541))

- Updated dependencies [[`cb611a1`](https://github.com/mastra-ai/mastra/commit/cb611a1e89a4f4cf74c97b57e0c27bb56f2eceb5), [`da93115`](https://github.com/mastra-ai/mastra/commit/da931155c1a9bc63d455d3d86b4ec984db5991fe), [`44df54a`](https://github.com/mastra-ai/mastra/commit/44df54a28e6315d9699cf437e4f3e8c7c7d10217), [`62d1d3c`](https://github.com/mastra-ai/mastra/commit/62d1d3cc08fe8182e7080237fd975de862ec8c91), [`9e1a3ed`](https://github.com/mastra-ai/mastra/commit/9e1a3ed07cfafb5e8e19a796ce0bee817002d7c0), [`56c9ad9`](https://github.com/mastra-ai/mastra/commit/56c9ad9c871d258af9da4d6e50065b01d339bf34), [`0773d08`](https://github.com/mastra-ai/mastra/commit/0773d089859210217702d3175ad4b2f3d63d267e), [`8681ecb`](https://github.com/mastra-ai/mastra/commit/8681ecb86184d5907267000e4576cc442a9a83fc), [`888c512`](https://github.com/mastra-ai/mastra/commit/888c5121e370289713d560a99bce58814e2fbb69), [`28d0249`](https://github.com/mastra-ai/mastra/commit/28d0249295782277040ad1e0d243e695b7ab1ce4), [`681ee1c`](https://github.com/mastra-ai/mastra/commit/681ee1c811359efd1b8bebc4bce35b9bb7b14bec), [`bb0f09d`](https://github.com/mastra-ai/mastra/commit/bb0f09dbac58401b36069f483acf5673202db5b5), [`6a8f1e6`](https://github.com/mastra-ai/mastra/commit/6a8f1e66272d2928351db334da091ee27e304c23), [`a579f7a`](https://github.com/mastra-ai/mastra/commit/a579f7a31e582674862b5679bc79af7ccf7429b8), [`5f7e9d0`](https://github.com/mastra-ai/mastra/commit/5f7e9d0db664020e1f3d97d7d18c6b0b9d4843d0), [`aa664b2`](https://github.com/mastra-ai/mastra/commit/aa664b218c15d397598c71194a8603b5b5a691bb), [`d7f14c3`](https://github.com/mastra-ai/mastra/commit/d7f14c3285cd253ecdd5f58139b7b6cbdf3678b5), [`0efe12a`](https://github.com/mastra-ai/mastra/commit/0efe12a5f008a939a1aac71699486ba40138054e)]:
  - @mastra/core@1.15.0
  - @mastra/memory@1.9.0
  - @mastra/mcp@1.3.1
  - @mastra/pg@1.8.2

## 0.9.1-alpha.5

### Patch Changes

- Fixed mastracode dependency ranges to use explicit semver constraints instead of latest. ([#14541](https://github.com/mastra-ai/mastra/pull/14541))

## 0.9.1-alpha.4

### Patch Changes

- Updated dependencies [[`da93115`](https://github.com/mastra-ai/mastra/commit/da931155c1a9bc63d455d3d86b4ec984db5991fe), [`44df54a`](https://github.com/mastra-ai/mastra/commit/44df54a28e6315d9699cf437e4f3e8c7c7d10217), [`0efe12a`](https://github.com/mastra-ai/mastra/commit/0efe12a5f008a939a1aac71699486ba40138054e)]:
  - @mastra/memory@1.9.0-alpha.2
  - @mastra/core@1.15.0-alpha.4
  - @mastra/mcp@1.3.1-alpha.1

## 0.9.1-alpha.3

### Patch Changes

- Updated dependencies [[`888c512`](https://github.com/mastra-ai/mastra/commit/888c5121e370289713d560a99bce58814e2fbb69), [`d7f14c3`](https://github.com/mastra-ai/mastra/commit/d7f14c3285cd253ecdd5f58139b7b6cbdf3678b5)]:
  - @mastra/pg@1.8.2-alpha.0
  - @mastra/core@1.15.0-alpha.3

## 0.9.1-alpha.2

### Patch Changes

- Updated dependencies [[`9e1a3ed`](https://github.com/mastra-ai/mastra/commit/9e1a3ed07cfafb5e8e19a796ce0bee817002d7c0), [`a579f7a`](https://github.com/mastra-ai/mastra/commit/a579f7a31e582674862b5679bc79af7ccf7429b8)]:
  - @mastra/core@1.15.0-alpha.2

## 0.9.1-alpha.1

### Patch Changes

- Fixed mastracode to forward harness thread and resource headers to model providers. ([#14433](https://github.com/mastra-ai/mastra/pull/14433))

- Removed italic styling from tool arguments (shell commands, web search queries, and generic tool args) for improved readability in the terminal. ([#14472](https://github.com/mastra-ai/mastra/pull/14472))

- Added thread title support to Mastra Code. ([#14436](https://github.com/mastra-ai/mastra/pull/14436))
  - Show live thread title update markers in the chat history.
  - Display non-generic thread titles in the status bar and thread picker.
  - Auto-truncate long titles to fit available terminal width.

- Fixed inline text questions so long answers wrap inside the question box instead of crashing the terminal render. ([#14479](https://github.com/mastra-ai/mastra/pull/14479))

- Improved `/threads` so it opens quickly with batched lazy preview loading, reuses cached previews across the active TUI session, and refreshes cached previews whenever a thread's `updatedAt` changes. ([#14428](https://github.com/mastra-ai/mastra/pull/14428))

- Improved the Mastra Code TUI with clearer user history styling and a smoother active prompt animation. ([#14423](https://github.com/mastra-ai/mastra/pull/14423))

- Updated dependencies [[`681ee1c`](https://github.com/mastra-ai/mastra/commit/681ee1c811359efd1b8bebc4bce35b9bb7b14bec), [`aa664b2`](https://github.com/mastra-ai/mastra/commit/aa664b218c15d397598c71194a8603b5b5a691bb)]:
  - @mastra/core@1.15.0-alpha.1
  - @mastra/memory@1.9.0-alpha.1
  - @mastra/mcp@1.3.1-alpha.0

## 0.9.1-alpha.0

### Patch Changes

- Updated dependencies [[`cb611a1`](https://github.com/mastra-ai/mastra/commit/cb611a1e89a4f4cf74c97b57e0c27bb56f2eceb5), [`62d1d3c`](https://github.com/mastra-ai/mastra/commit/62d1d3cc08fe8182e7080237fd975de862ec8c91), [`56c9ad9`](https://github.com/mastra-ai/mastra/commit/56c9ad9c871d258af9da4d6e50065b01d339bf34), [`0773d08`](https://github.com/mastra-ai/mastra/commit/0773d089859210217702d3175ad4b2f3d63d267e), [`8681ecb`](https://github.com/mastra-ai/mastra/commit/8681ecb86184d5907267000e4576cc442a9a83fc), [`28d0249`](https://github.com/mastra-ai/mastra/commit/28d0249295782277040ad1e0d243e695b7ab1ce4), [`bb0f09d`](https://github.com/mastra-ai/mastra/commit/bb0f09dbac58401b36069f483acf5673202db5b5), [`6a8f1e6`](https://github.com/mastra-ai/mastra/commit/6a8f1e66272d2928351db334da091ee27e304c23), [`5f7e9d0`](https://github.com/mastra-ai/mastra/commit/5f7e9d0db664020e1f3d97d7d18c6b0b9d4843d0)]:
  - @mastra/core@1.15.0-alpha.0
  - @mastra/mcp@1.3.1-alpha.0
  - @mastra/memory@1.8.4-alpha.0

## 0.9.0

### Minor Changes

- Improved MCP server management with interactive `/mcp` selector UI. ([#14377](https://github.com/mastra-ai/mastra/pull/14377))
  - **Fixed stderr flooding** — MCP child process debug output no longer corrupts the terminal. Server stderr is piped and buffered instead of inherited.
  - **Fixed console.info race condition** — MCP status messages now display properly in the chat area instead of racing with TUI rendering.
  - **Better error detection** — Failed MCP servers now correctly show as failed instead of showing as connected with 0 tools.
  - **Interactive `/mcp` command** — Replaces text-only output with a navigable overlay (↑↓ to select, Enter for actions, Esc to close). Sub-menus offer View tools, View error, View logs, and Reconnect per server.
  - **Per-server reconnect** — Reconnect individual servers from the `/mcp` selector without restarting all connections.
  - **Live status polling** — The `/mcp` selector auto-refreshes while servers are still connecting.
  - **Connecting state** — Servers show as 'connecting...' during initial startup, visible via `/mcp`.

  **Example**

  ```text
  /mcp
  ```

- Added adaptive light and dark terminal themes with WCAG-compliant contrast. Editor input, messages, tool output, and interactive components now automatically adjust colors and borders for readability across terminal backgrounds. ([#14337](https://github.com/mastra-ai/mastra/pull/14337))

- Added interactive API key prompt when selecting a model without a configured key. When you choose a model from the model selector that lacks an API key, Mastra Code now displays a dialog to enter the key. The key is stored persistently in auth.json and loaded into the environment on subsequent startups. Environment variables always take priority over stored keys. Press Escape to dismiss the prompt and keep the previous behavior. ([#13573](https://github.com/mastra-ai/mastra/pull/13573))

### Patch Changes

- Improved Mastra Code terminal queueing and slash-command behavior while the agent is busy. ([#14250](https://github.com/mastra-ai/mastra/pull/14250))
  - Press `Enter` to send a message normally, or queue a follow-up while the current run is still streaming.
  - Queued follow-up messages and slash commands now drain in the same FIFO order they were entered.
  - Custom slash commands use `//command` so they stay distinct from built-in `/command` entries, including when names overlap.
  - Slash-command autocomplete now defaults to the first visible matching entry instead of jumping to a later custom command match.
  - `/help` and related shortcut text now reflect the updated behavior.

- Fix rendering corruption in some terminal emulators by replacing the per-character gradient animation on the editor input border with a solid mode-color border. ([#14359](https://github.com/mastra-ai/mastra/pull/14359))

- Updated dependencies [[`51970b3`](https://github.com/mastra-ai/mastra/commit/51970b3828494d59a8dd4df143b194d37d31e3f5), [`bbcbbce`](https://github.com/mastra-ai/mastra/commit/bbcbbce4f0e268053cbb11ca58350f5ceba15498), [`4444280`](https://github.com/mastra-ai/mastra/commit/444428094253e916ec077e66284e685fde67021e), [`085e371`](https://github.com/mastra-ai/mastra/commit/085e3718a7d0fe9a210fe7dd1c867b9bdfe8d16b), [`b77aa19`](https://github.com/mastra-ai/mastra/commit/b77aa1981361c021f2c881bee8f0c703687f00da), [`dbb879a`](https://github.com/mastra-ai/mastra/commit/dbb879af0b809c668e9b3a9d8bac97d806caa267), [`dbb879a`](https://github.com/mastra-ai/mastra/commit/dbb879af0b809c668e9b3a9d8bac97d806caa267), [`8b4ce84`](https://github.com/mastra-ai/mastra/commit/8b4ce84aed0808b9805cc4fd7147c1f8a2ef7a36), [`8d4cfe6`](https://github.com/mastra-ai/mastra/commit/8d4cfe6b9a7157d3876206227ec9f04cde6dbc4a), [`247c353`](https://github.com/mastra-ai/mastra/commit/247c3531fa01d1af1014843729f0fba7d3acc953), [`dd6ca1c`](https://github.com/mastra-ai/mastra/commit/dd6ca1cdea3b8b6182f4cf61df41070ba0cc0deb), [`ce26fe2`](https://github.com/mastra-ai/mastra/commit/ce26fe2166dd90254f8bee5776e55977143e97de), [`68a019d`](https://github.com/mastra-ai/mastra/commit/68a019d30d22251ddd628a2947d60215c03c350a), [`b92d0c9`](https://github.com/mastra-ai/mastra/commit/b92d0c92ecc833bec9a99af98b3243839c1661be), [`4cb4edf`](https://github.com/mastra-ai/mastra/commit/4cb4edf3c909d197ec356c1790d13270514ffef6), [`8de3555`](https://github.com/mastra-ai/mastra/commit/8de355572c6fd838f863a3e7e6fe24d0947b774f), [`b26307f`](https://github.com/mastra-ai/mastra/commit/b26307f050df39629511b0e831b8fc26973ce8b1), [`68a019d`](https://github.com/mastra-ai/mastra/commit/68a019d30d22251ddd628a2947d60215c03c350a), [`133ef20`](https://github.com/mastra-ai/mastra/commit/133ef20c39c696eb0dbbee26e77c8acfec14b8c6), [`4444280`](https://github.com/mastra-ai/mastra/commit/444428094253e916ec077e66284e685fde67021e)]:
  - @mastra/core@1.14.0
  - @mastra/mcp@1.3.0
  - @mastra/pg@1.8.1
  - @mastra/libsql@1.7.1
  - @mastra/memory@1.8.3

## 0.9.0-alpha.3

### Patch Changes

- Updated dependencies [[`8b4ce84`](https://github.com/mastra-ai/mastra/commit/8b4ce84aed0808b9805cc4fd7147c1f8a2ef7a36), [`8d4cfe6`](https://github.com/mastra-ai/mastra/commit/8d4cfe6b9a7157d3876206227ec9f04cde6dbc4a), [`247c353`](https://github.com/mastra-ai/mastra/commit/247c3531fa01d1af1014843729f0fba7d3acc953), [`68a019d`](https://github.com/mastra-ai/mastra/commit/68a019d30d22251ddd628a2947d60215c03c350a), [`68a019d`](https://github.com/mastra-ai/mastra/commit/68a019d30d22251ddd628a2947d60215c03c350a)]:
  - @mastra/core@1.14.0-alpha.3
  - @mastra/memory@1.8.3-alpha.2

## 0.9.0-alpha.2

### Minor Changes

- Improved MCP server management with interactive `/mcp` selector UI. ([#14377](https://github.com/mastra-ai/mastra/pull/14377))
  - **Fixed stderr flooding** — MCP child process debug output no longer corrupts the terminal. Server stderr is piped and buffered instead of inherited.
  - **Fixed console.info race condition** — MCP status messages now display properly in the chat area instead of racing with TUI rendering.
  - **Better error detection** — Failed MCP servers now correctly show as failed instead of showing as connected with 0 tools.
  - **Interactive `/mcp` command** — Replaces text-only output with a navigable overlay (↑↓ to select, Enter for actions, Esc to close). Sub-menus offer View tools, View error, View logs, and Reconnect per server.
  - **Per-server reconnect** — Reconnect individual servers from the `/mcp` selector without restarting all connections.
  - **Live status polling** — The `/mcp` selector auto-refreshes while servers are still connecting.
  - **Connecting state** — Servers show as 'connecting...' during initial startup, visible via `/mcp`.

  **Example**

  ```text
  /mcp
  ```

### Patch Changes

- Updated dependencies [[`4444280`](https://github.com/mastra-ai/mastra/commit/444428094253e916ec077e66284e685fde67021e), [`dbb879a`](https://github.com/mastra-ai/mastra/commit/dbb879af0b809c668e9b3a9d8bac97d806caa267), [`dbb879a`](https://github.com/mastra-ai/mastra/commit/dbb879af0b809c668e9b3a9d8bac97d806caa267), [`b92d0c9`](https://github.com/mastra-ai/mastra/commit/b92d0c92ecc833bec9a99af98b3243839c1661be), [`8de3555`](https://github.com/mastra-ai/mastra/commit/8de355572c6fd838f863a3e7e6fe24d0947b774f), [`133ef20`](https://github.com/mastra-ai/mastra/commit/133ef20c39c696eb0dbbee26e77c8acfec14b8c6), [`4444280`](https://github.com/mastra-ai/mastra/commit/444428094253e916ec077e66284e685fde67021e)]:
  - @mastra/core@1.14.0-alpha.2
  - @mastra/pg@1.8.1-alpha.0
  - @mastra/libsql@1.7.1-alpha.0
  - @mastra/memory@1.8.3-alpha.1
  - @mastra/mcp@1.3.0-alpha.1

## 0.9.0-alpha.1

### Minor Changes

- Added adaptive light and dark terminal themes with WCAG-compliant contrast. Editor input, messages, tool output, and interactive components now automatically adjust colors and borders for readability across terminal backgrounds. ([#14337](https://github.com/mastra-ai/mastra/pull/14337))

### Patch Changes

- Fix rendering corruption in some terminal emulators by replacing the per-character gradient animation on the editor input border with a solid mode-color border. ([#14359](https://github.com/mastra-ai/mastra/pull/14359))

- Updated dependencies [[`b77aa19`](https://github.com/mastra-ai/mastra/commit/b77aa1981361c021f2c881bee8f0c703687f00da), [`dd6ca1c`](https://github.com/mastra-ai/mastra/commit/dd6ca1cdea3b8b6182f4cf61df41070ba0cc0deb), [`4cb4edf`](https://github.com/mastra-ai/mastra/commit/4cb4edf3c909d197ec356c1790d13270514ffef6)]:
  - @mastra/core@1.13.3-alpha.1

## 0.9.0-alpha.0

### Minor Changes

- Added interactive API key prompt when selecting a model without a configured key. When you choose a model from the model selector that lacks an API key, Mastra Code now displays a dialog to enter the key. The key is stored persistently in auth.json and loaded into the environment on subsequent startups. Environment variables always take priority over stored keys. Press Escape to dismiss the prompt and keep the previous behavior. ([#13573](https://github.com/mastra-ai/mastra/pull/13573))

### Patch Changes

- Improved Mastra Code terminal queueing and slash-command behavior while the agent is busy. ([#14250](https://github.com/mastra-ai/mastra/pull/14250))
  - Press `Enter` to send a message normally, or queue a follow-up while the current run is still streaming.
  - Queued follow-up messages and slash commands now drain in the same FIFO order they were entered.
  - Custom slash commands use `//command` so they stay distinct from built-in `/command` entries, including when names overlap.
  - Slash-command autocomplete now defaults to the first visible matching entry instead of jumping to a later custom command match.
  - `/help` and related shortcut text now reflect the updated behavior.

- Updated dependencies [[`51970b3`](https://github.com/mastra-ai/mastra/commit/51970b3828494d59a8dd4df143b194d37d31e3f5), [`bbcbbce`](https://github.com/mastra-ai/mastra/commit/bbcbbce4f0e268053cbb11ca58350f5ceba15498), [`085e371`](https://github.com/mastra-ai/mastra/commit/085e3718a7d0fe9a210fe7dd1c867b9bdfe8d16b), [`ce26fe2`](https://github.com/mastra-ai/mastra/commit/ce26fe2166dd90254f8bee5776e55977143e97de), [`b26307f`](https://github.com/mastra-ai/mastra/commit/b26307f050df39629511b0e831b8fc26973ce8b1)]:
  - @mastra/core@1.13.3-alpha.0
  - @mastra/mcp@1.2.2-alpha.0
  - @mastra/memory@1.8.3-alpha.0

## 0.8.3

### Patch Changes

- Updated dependencies [[`0ce6035`](https://github.com/mastra-ai/mastra/commit/0ce603591189f547397704e53f23c77bc5630071)]:
  - @mastra/core@1.13.2
  - @mastra/mcp@1.2.1
  - @mastra/memory@1.8.2

## 0.8.3-alpha.0

### Patch Changes

- Updated dependencies [[`0ce6035`](https://github.com/mastra-ai/mastra/commit/0ce603591189f547397704e53f23c77bc5630071)]:
  - @mastra/core@1.13.2-alpha.0
  - @mastra/mcp@1.2.1
  - @mastra/memory@1.8.2-alpha.0

## 0.8.2

### Patch Changes

- Updated dependencies [[`205e76c`](https://github.com/mastra-ai/mastra/commit/205e76c3ba652205dafb037f50a4a8eea73f6736)]:
  - @mastra/core@1.13.1
  - @mastra/mcp@1.2.1
  - @mastra/memory@1.8.1

## 0.8.1

### Patch Changes

- Updated dependencies [[`ea86967`](https://github.com/mastra-ai/mastra/commit/ea86967449426e0a3673253bd1c2c052a99d970d), [`db21c21`](https://github.com/mastra-ai/mastra/commit/db21c21a6ae5f33539262cc535342fa8757eb359), [`11f5dbe`](https://github.com/mastra-ai/mastra/commit/11f5dbe9a1e7ad8ef3b1ea34fb4a9fa3631d1587), [`11f5dbe`](https://github.com/mastra-ai/mastra/commit/11f5dbe9a1e7ad8ef3b1ea34fb4a9fa3631d1587), [`6751354`](https://github.com/mastra-ai/mastra/commit/67513544d1a64be891d9de7624d40aadc895d56e), [`c958cd3`](https://github.com/mastra-ai/mastra/commit/c958cd36627c1eea122ec241b2b15492977a263a), [`86f2426`](https://github.com/mastra-ai/mastra/commit/86f242631d252a172d2f9f9a2ea0feb8647a76b0), [`950eb07`](https://github.com/mastra-ai/mastra/commit/950eb07b7e7354629630e218d49550fdd299c452)]:
  - @mastra/core@1.13.0
  - @mastra/mcp@1.2.1
  - @mastra/memory@1.8.0

## 0.8.1-alpha.0

### Patch Changes

- Updated dependencies [[`ea86967`](https://github.com/mastra-ai/mastra/commit/ea86967449426e0a3673253bd1c2c052a99d970d), [`db21c21`](https://github.com/mastra-ai/mastra/commit/db21c21a6ae5f33539262cc535342fa8757eb359), [`11f5dbe`](https://github.com/mastra-ai/mastra/commit/11f5dbe9a1e7ad8ef3b1ea34fb4a9fa3631d1587), [`11f5dbe`](https://github.com/mastra-ai/mastra/commit/11f5dbe9a1e7ad8ef3b1ea34fb4a9fa3631d1587), [`6751354`](https://github.com/mastra-ai/mastra/commit/67513544d1a64be891d9de7624d40aadc895d56e), [`c958cd3`](https://github.com/mastra-ai/mastra/commit/c958cd36627c1eea122ec241b2b15492977a263a), [`86f2426`](https://github.com/mastra-ai/mastra/commit/86f242631d252a172d2f9f9a2ea0feb8647a76b0), [`950eb07`](https://github.com/mastra-ai/mastra/commit/950eb07b7e7354629630e218d49550fdd299c452)]:
  - @mastra/core@1.13.0-alpha.0
  - @mastra/mcp@1.2.1-alpha.0
  - @mastra/memory@1.8.0-alpha.0

## 0.8.0

### Minor Changes

- Added `mcpServers` option to `createMastraCode()` for programmatic MCP server configuration. Servers passed via this option are merged with file-based configs at highest priority, allowing you to define MCP servers directly in code: ([#13750](https://github.com/mastra-ai/mastra/pull/13750))

  ```typescript
  const { harness } = await createMastraCode({
    mcpServers: {
      filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'] },
      remote: { url: 'https://mcp.example.com/sse', headers: { Authorization: 'Bearer tok' } },
    },
  });
  ```

### Patch Changes

- Fixed tool validation errors being hidden behind a generic 'see details above' message. All errors now display their actual error message consistently. ([#14168](https://github.com/mastra-ai/mastra/pull/14168))

- Fixed `mastracode` schema generation when running the CLI with Zod v4-compatible schemas. The CLI now produces valid object JSON Schema instead of failing on some tool input schemas. ([#14157](https://github.com/mastra-ai/mastra/pull/14157))

- Fixed /om model search in Kitty terminals so typed characters filter models again. ([#13996](https://github.com/mastra-ai/mastra/pull/13996))

- Updated dependencies [[`cddf895`](https://github.com/mastra-ai/mastra/commit/cddf895532b8ee7f9fa814136ec672f53d37a9ba), [`9cede11`](https://github.com/mastra-ai/mastra/commit/9cede110abac9d93072e0521bb3c8bcafb9fdadf), [`a59f126`](https://github.com/mastra-ai/mastra/commit/a59f1269104f54726699c5cdb98c72c93606d2df), [`ed8fd75`](https://github.com/mastra-ai/mastra/commit/ed8fd75cbff03bb5e19971ddb30ab7040fc60447), [`c510833`](https://github.com/mastra-ai/mastra/commit/c5108333e8cbc19dafee5f8bfefbcb5ee935335c), [`c4c7dad`](https://github.com/mastra-ai/mastra/commit/c4c7dadfe2e4584f079f6c24bfabdb8c4981827f), [`b9a77b9`](https://github.com/mastra-ai/mastra/commit/b9a77b951fa6422077080b492cce74460d2f8fdd), [`45c3112`](https://github.com/mastra-ai/mastra/commit/45c31122666a0cc56b94727099fcb1871ed1b3f6), [`45c3112`](https://github.com/mastra-ai/mastra/commit/45c31122666a0cc56b94727099fcb1871ed1b3f6), [`7296fcc`](https://github.com/mastra-ai/mastra/commit/7296fcc599c876a68699a71c7054a16d5aaf2337), [`00c27f9`](https://github.com/mastra-ai/mastra/commit/00c27f9080731433230a61be69c44e39a7a7b4c7), [`5e7c287`](https://github.com/mastra-ai/mastra/commit/5e7c28701f2bce795dd5c811e4c3060bf2ea2242), [`977b49e`](https://github.com/mastra-ai/mastra/commit/977b49e23d8b050a2c6a6a91c0aa38b28d6388ee), [`7e17d3f`](https://github.com/mastra-ai/mastra/commit/7e17d3f656fdda2aad47c4beb8c491636d70820c), [`ee19c9b`](https://github.com/mastra-ai/mastra/commit/ee19c9ba3ec3ed91feb214ad539bdc766c53bb01)]:
  - @mastra/core@1.12.0
  - @mastra/mcp@1.2.0
  - @mastra/memory@1.7.0

## 0.8.0-alpha.1

### Patch Changes

- Fixed tool validation errors being hidden behind a generic 'see details above' message. All errors now display their actual error message consistently. ([#14168](https://github.com/mastra-ai/mastra/pull/14168))

- Updated dependencies [[`9cede11`](https://github.com/mastra-ai/mastra/commit/9cede110abac9d93072e0521bb3c8bcafb9fdadf), [`a59f126`](https://github.com/mastra-ai/mastra/commit/a59f1269104f54726699c5cdb98c72c93606d2df), [`c510833`](https://github.com/mastra-ai/mastra/commit/c5108333e8cbc19dafee5f8bfefbcb5ee935335c), [`7296fcc`](https://github.com/mastra-ai/mastra/commit/7296fcc599c876a68699a71c7054a16d5aaf2337), [`00c27f9`](https://github.com/mastra-ai/mastra/commit/00c27f9080731433230a61be69c44e39a7a7b4c7), [`977b49e`](https://github.com/mastra-ai/mastra/commit/977b49e23d8b050a2c6a6a91c0aa38b28d6388ee), [`ee19c9b`](https://github.com/mastra-ai/mastra/commit/ee19c9ba3ec3ed91feb214ad539bdc766c53bb01)]:
  - @mastra/core@1.12.0-alpha.1
  - @mastra/memory@1.7.0-alpha.1
  - @mastra/mcp@1.2.0-alpha.0

## 0.8.0-alpha.0

### Minor Changes

- Added `mcpServers` option to `createMastraCode()` for programmatic MCP server configuration. Servers passed via this option are merged with file-based configs at highest priority, allowing you to define MCP servers directly in code: ([#13750](https://github.com/mastra-ai/mastra/pull/13750))

  ```typescript
  const { harness } = await createMastraCode({
    mcpServers: {
      filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'] },
      remote: { url: 'https://mcp.example.com/sse', headers: { Authorization: 'Bearer tok' } },
    },
  });
  ```

### Patch Changes

- Fixed `mastracode` schema generation when running the CLI with Zod v4-compatible schemas. The CLI now produces valid object JSON Schema instead of failing on some tool input schemas. ([#14157](https://github.com/mastra-ai/mastra/pull/14157))

- Fixed /om model search in Kitty terminals so typed characters filter models again. ([#13996](https://github.com/mastra-ai/mastra/pull/13996))

- Updated dependencies [[`cddf895`](https://github.com/mastra-ai/mastra/commit/cddf895532b8ee7f9fa814136ec672f53d37a9ba), [`aede3cc`](https://github.com/mastra-ai/mastra/commit/aede3cc2a83b54bbd9e9a54c8aedcd1708b2ef87), [`c4c7dad`](https://github.com/mastra-ai/mastra/commit/c4c7dadfe2e4584f079f6c24bfabdb8c4981827f), [`b9a77b9`](https://github.com/mastra-ai/mastra/commit/b9a77b951fa6422077080b492cce74460d2f8fdd), [`45c3112`](https://github.com/mastra-ai/mastra/commit/45c31122666a0cc56b94727099fcb1871ed1b3f6), [`45c3112`](https://github.com/mastra-ai/mastra/commit/45c31122666a0cc56b94727099fcb1871ed1b3f6), [`5e7c287`](https://github.com/mastra-ai/mastra/commit/5e7c28701f2bce795dd5c811e4c3060bf2ea2242), [`7e17d3f`](https://github.com/mastra-ai/mastra/commit/7e17d3f656fdda2aad47c4beb8c491636d70820c)]:
  - @mastra/core@1.12.0-alpha.0
  - @mastra/mcp@1.2.0-alpha.0
  - @mastra/memory@1.6.3-alpha.0

## 0.7.0

### Minor Changes

- Added headless non-interactive mode via `--prompt` / `-p` flag. Mastra Code can now run from scripts, CI/CD pipelines, and task orchestration systems without human interaction. All blocking interactions (tool approvals, questions, plan approvals, sandbox access) are auto-resolved. Supports `--timeout`, `--continue`, and `--format json` flags. Exit codes: 0 (success), 1 (error/aborted), 2 (timeout). ([#13648](https://github.com/mastra-ai/mastra/pull/13648))

### Patch Changes

- Improve MastraCode image pasting for clipboard images, local image paths, and remote image URLs. ([#13953](https://github.com/mastra-ai/mastra/pull/13953))

- Improved web_search tool rendering in the TUI. Search results now display a clean list of titles and URLs with the search query in the header, instead of dumping raw JSON. ([#13870](https://github.com/mastra-ai/mastra/pull/13870))

- Improved the shell passthrough command (`! <command>`, e.g. `! ls -la`) to show output as it happens. Previously, running a command like `! ping example.com` would show nothing until the command finished. Now, stdout and stderr stream live into a bordered output box with a spinner that resolves to a success or failure indicator on completion. ([#13999](https://github.com/mastra-ai/mastra/pull/13999))

- Subagents now use the same file and command tools as the parent agent, ensuring consistent behavior across sandbox environments and workspaces. ([#13940](https://github.com/mastra-ai/mastra/pull/13940))

- Updated dependencies [[`4f71b43`](https://github.com/mastra-ai/mastra/commit/4f71b436a4a6b8839842d8da47b57b84509af56c), [`a070277`](https://github.com/mastra-ai/mastra/commit/a07027766ce195ba74d0783116d894cbab25d44c), [`b628b91`](https://github.com/mastra-ai/mastra/commit/b628b9128b372c0f54214d902b07279f03443900), [`332c014`](https://github.com/mastra-ai/mastra/commit/332c014e076b81edf7fe45b58205882726415e90), [`6b63153`](https://github.com/mastra-ai/mastra/commit/6b63153878ea841c0f4ce632ba66bb33e57e9c1b), [`c2d7a7c`](https://github.com/mastra-ai/mastra/commit/c2d7a7c48d89245188c81a9a436ad8b1d9f3872d), [`4246e34`](https://github.com/mastra-ai/mastra/commit/4246e34cec9c26636d0965942268e6d07c346671), [`b8837ee`](https://github.com/mastra-ai/mastra/commit/b8837ee77e2e84197609762bfabd8b3da326d30c), [`866cc2c`](https://github.com/mastra-ai/mastra/commit/866cc2cb1f0e3b314afab5194f69477fada745d1), [`5d950f7`](https://github.com/mastra-ai/mastra/commit/5d950f7bf426a215a1808f0abef7de5c8336ba1c), [`d3ad589`](https://github.com/mastra-ai/mastra/commit/d3ad589a39e66bb783513c4bbf912246bdf18c22), [`28c85b1`](https://github.com/mastra-ai/mastra/commit/28c85b184fc32b40f7f160483c982da6d388ecbd), [`e9a08fb`](https://github.com/mastra-ai/mastra/commit/e9a08fbef1ada7e50e961e2f54f55e8c10b4a45c), [`57c7391`](https://github.com/mastra-ai/mastra/commit/57c739108b9a6c9160352f0468dfe0428c03a234), [`1d0a8a8`](https://github.com/mastra-ai/mastra/commit/1d0a8a8acf33203d5744fc429b090ad8598aa8ed), [`18d91c3`](https://github.com/mastra-ai/mastra/commit/18d91c3b6e905cfd3ba50e7c7dc81164b6aa69ad), [`631ffd8`](https://github.com/mastra-ai/mastra/commit/631ffd82fed108648b448b28e6a90e38c5f53bf5), [`6bcbf8a`](https://github.com/mastra-ai/mastra/commit/6bcbf8a6774d5a53b21d61db8a45ce2593ca1616), [`aae2295`](https://github.com/mastra-ai/mastra/commit/aae2295838a2d329ad6640829e87934790ffe5b8), [`aa61f29`](https://github.com/mastra-ai/mastra/commit/aa61f29ff8095ce46a4ae16e46c4d8c79b2b685b), [`7ff3714`](https://github.com/mastra-ai/mastra/commit/7ff37148515439bb3be009a60e02c3e363299760), [`18c3a90`](https://github.com/mastra-ai/mastra/commit/18c3a90c9e48cf69500e308affeb8eba5860b2af), [`41d79a1`](https://github.com/mastra-ai/mastra/commit/41d79a14bd8cb6de1e2565fd0a04786bae2f211b), [`f35487b`](https://github.com/mastra-ai/mastra/commit/f35487bb2d46c636e22aa71d90025613ae38235a), [`6dc2192`](https://github.com/mastra-ai/mastra/commit/6dc21921aef0f0efab15cd0805fa3d18f277a76f), [`eeb3a3f`](https://github.com/mastra-ai/mastra/commit/eeb3a3f43aca10cf49479eed2a84b7d9ecea02ba), [`e673376`](https://github.com/mastra-ai/mastra/commit/e6733763ad1321aa7e5ae15096b9c2104f93b1f3), [`05f8d90`](https://github.com/mastra-ai/mastra/commit/05f8d9009290ce6aa03428b3add635268615db85), [`b2204c9`](https://github.com/mastra-ai/mastra/commit/b2204c98a42848bbfb6f0440f005dc2b6354f1cd), [`a1bf1e3`](https://github.com/mastra-ai/mastra/commit/a1bf1e385ed4c0ef6f11b56c5887442970d127f2), [`b6f647a`](https://github.com/mastra-ai/mastra/commit/b6f647ae2388e091f366581595feb957e37d5b40), [`0c57b8b`](https://github.com/mastra-ai/mastra/commit/0c57b8b0a69a97b5a4ae3f79be6c610f29f3cf7b), [`b081f27`](https://github.com/mastra-ai/mastra/commit/b081f272cf411716e1d6bd72ceac4bcee2657b19), [`4b8da97`](https://github.com/mastra-ai/mastra/commit/4b8da97a5ce306e97869df6c39535d9069e563db), [`682b7f7`](https://github.com/mastra-ai/mastra/commit/682b7f773b7940687ef22569e720fd4bc4fdb8fe), [`0c09eac`](https://github.com/mastra-ai/mastra/commit/0c09eacb1926f64cfdc9ae5c6d63385cf8c9f72c), [`6b9b93d`](https://github.com/mastra-ai/mastra/commit/6b9b93d6f459d1ba6e36f163abf62a085ddb3d64), [`d3ad589`](https://github.com/mastra-ai/mastra/commit/d3ad589a39e66bb783513c4bbf912246bdf18c22), [`b6f647a`](https://github.com/mastra-ai/mastra/commit/b6f647ae2388e091f366581595feb957e37d5b40), [`31b6067`](https://github.com/mastra-ai/mastra/commit/31b6067d0cc3ab10e1b29c36147f3b5266bc714a), [`797ac42`](https://github.com/mastra-ai/mastra/commit/797ac4276de231ad2d694d9aeca75980f6cd0419), [`0423bf4`](https://github.com/mastra-ai/mastra/commit/0423bf4292bd494565ef631bc4f2cc7b86b27390), [`0bc289e`](https://github.com/mastra-ai/mastra/commit/0bc289e2d476bf46c5b91c21969e8d0c6864691c), [`9b75a06`](https://github.com/mastra-ai/mastra/commit/9b75a06e53ebb0b950ba7c1e83a0142047185f46), [`4c3a1b1`](https://github.com/mastra-ai/mastra/commit/4c3a1b122ea083e003d71092f30f3b31680b01c0), [`256df35`](https://github.com/mastra-ai/mastra/commit/256df3571d62beb3ad4971faa432927cc140e603), [`b8837ee`](https://github.com/mastra-ai/mastra/commit/b8837ee77e2e84197609762bfabd8b3da326d30c), [`0c57b8b`](https://github.com/mastra-ai/mastra/commit/0c57b8b0a69a97b5a4ae3f79be6c610f29f3cf7b), [`85cc3b3`](https://github.com/mastra-ai/mastra/commit/85cc3b3b6f32ae4b083c26498f50d5b250ba944b), [`3ebdadf`](https://github.com/mastra-ai/mastra/commit/3ebdadfe517d16f29464f35baba8356771160369), [`d567299`](https://github.com/mastra-ai/mastra/commit/d567299cf81e02bd9d5221d4bc05967d6c224161), [`97ea28c`](https://github.com/mastra-ai/mastra/commit/97ea28c746e9e4147d56047bbb1c4a92417a3fec), [`d567299`](https://github.com/mastra-ai/mastra/commit/d567299cf81e02bd9d5221d4bc05967d6c224161), [`716ffe6`](https://github.com/mastra-ai/mastra/commit/716ffe68bed81f7c2690bc8581b9e140f7bf1c3d), [`8296332`](https://github.com/mastra-ai/mastra/commit/8296332de21c16e3dfc3d0b2d615720a6dc88f2f), [`4df2116`](https://github.com/mastra-ai/mastra/commit/4df211619dd922c047d396ca41cd7027c8c4c8e7), [`2219c1a`](https://github.com/mastra-ai/mastra/commit/2219c1acbd21da116da877f0036ffb985a9dd5a3), [`17c4145`](https://github.com/mastra-ai/mastra/commit/17c4145166099354545582335b5252bdfdfd908b)]:
  - @mastra/core@1.11.0
  - @mastra/libsql@1.7.0
  - @mastra/pg@1.8.0
  - @mastra/memory@1.6.2
  - @mastra/mcp@1.1.0

## 0.7.0-alpha.2

### Patch Changes

- Updated dependencies [[`1d0a8a8`](https://github.com/mastra-ai/mastra/commit/1d0a8a8acf33203d5744fc429b090ad8598aa8ed)]:
  - @mastra/core@1.11.0-alpha.2

## 0.7.0-alpha.1

### Patch Changes

- Updated dependencies [[`866cc2c`](https://github.com/mastra-ai/mastra/commit/866cc2cb1f0e3b314afab5194f69477fada745d1), [`6bcbf8a`](https://github.com/mastra-ai/mastra/commit/6bcbf8a6774d5a53b21d61db8a45ce2593ca1616), [`18c3a90`](https://github.com/mastra-ai/mastra/commit/18c3a90c9e48cf69500e308affeb8eba5860b2af), [`f35487b`](https://github.com/mastra-ai/mastra/commit/f35487bb2d46c636e22aa71d90025613ae38235a), [`6dc2192`](https://github.com/mastra-ai/mastra/commit/6dc21921aef0f0efab15cd0805fa3d18f277a76f), [`eeb3a3f`](https://github.com/mastra-ai/mastra/commit/eeb3a3f43aca10cf49479eed2a84b7d9ecea02ba), [`05f8d90`](https://github.com/mastra-ai/mastra/commit/05f8d9009290ce6aa03428b3add635268615db85), [`4b8da97`](https://github.com/mastra-ai/mastra/commit/4b8da97a5ce306e97869df6c39535d9069e563db), [`256df35`](https://github.com/mastra-ai/mastra/commit/256df3571d62beb3ad4971faa432927cc140e603)]:
  - @mastra/core@1.11.0-alpha.1

## 0.7.0-alpha.0

### Minor Changes

- Added headless non-interactive mode via `--prompt` / `-p` flag. Mastra Code can now run from scripts, CI/CD pipelines, and task orchestration systems without human interaction. All blocking interactions (tool approvals, questions, plan approvals, sandbox access) are auto-resolved. Supports `--timeout`, `--continue`, and `--format json` flags. Exit codes: 0 (success), 1 (error/aborted), 2 (timeout). ([#13648](https://github.com/mastra-ai/mastra/pull/13648))

### Patch Changes

- Improve MastraCode image pasting for clipboard images, local image paths, and remote image URLs. ([#13953](https://github.com/mastra-ai/mastra/pull/13953))

- Improved web_search tool rendering in the TUI. Search results now display a clean list of titles and URLs with the search query in the header, instead of dumping raw JSON. ([#13870](https://github.com/mastra-ai/mastra/pull/13870))

- Improved the shell passthrough command (`! <command>`, e.g. `! ls -la`) to show output as it happens. Previously, running a command like `! ping example.com` would show nothing until the command finished. Now, stdout and stderr stream live into a bordered output box with a spinner that resolves to a success or failure indicator on completion. ([#13999](https://github.com/mastra-ai/mastra/pull/13999))

- Subagents now use the same file and command tools as the parent agent, ensuring consistent behavior across sandbox environments and workspaces. ([#13940](https://github.com/mastra-ai/mastra/pull/13940))

- Updated dependencies [[`4f71b43`](https://github.com/mastra-ai/mastra/commit/4f71b436a4a6b8839842d8da47b57b84509af56c), [`a070277`](https://github.com/mastra-ai/mastra/commit/a07027766ce195ba74d0783116d894cbab25d44c), [`b628b91`](https://github.com/mastra-ai/mastra/commit/b628b9128b372c0f54214d902b07279f03443900), [`332c014`](https://github.com/mastra-ai/mastra/commit/332c014e076b81edf7fe45b58205882726415e90), [`6b63153`](https://github.com/mastra-ai/mastra/commit/6b63153878ea841c0f4ce632ba66bb33e57e9c1b), [`c2d7a7c`](https://github.com/mastra-ai/mastra/commit/c2d7a7c48d89245188c81a9a436ad8b1d9f3872d), [`4246e34`](https://github.com/mastra-ai/mastra/commit/4246e34cec9c26636d0965942268e6d07c346671), [`b8837ee`](https://github.com/mastra-ai/mastra/commit/b8837ee77e2e84197609762bfabd8b3da326d30c), [`5d950f7`](https://github.com/mastra-ai/mastra/commit/5d950f7bf426a215a1808f0abef7de5c8336ba1c), [`d3ad589`](https://github.com/mastra-ai/mastra/commit/d3ad589a39e66bb783513c4bbf912246bdf18c22), [`28c85b1`](https://github.com/mastra-ai/mastra/commit/28c85b184fc32b40f7f160483c982da6d388ecbd), [`e9a08fb`](https://github.com/mastra-ai/mastra/commit/e9a08fbef1ada7e50e961e2f54f55e8c10b4a45c), [`57c7391`](https://github.com/mastra-ai/mastra/commit/57c739108b9a6c9160352f0468dfe0428c03a234), [`18d91c3`](https://github.com/mastra-ai/mastra/commit/18d91c3b6e905cfd3ba50e7c7dc81164b6aa69ad), [`631ffd8`](https://github.com/mastra-ai/mastra/commit/631ffd82fed108648b448b28e6a90e38c5f53bf5), [`aae2295`](https://github.com/mastra-ai/mastra/commit/aae2295838a2d329ad6640829e87934790ffe5b8), [`aa61f29`](https://github.com/mastra-ai/mastra/commit/aa61f29ff8095ce46a4ae16e46c4d8c79b2b685b), [`7ff3714`](https://github.com/mastra-ai/mastra/commit/7ff37148515439bb3be009a60e02c3e363299760), [`41d79a1`](https://github.com/mastra-ai/mastra/commit/41d79a14bd8cb6de1e2565fd0a04786bae2f211b), [`e673376`](https://github.com/mastra-ai/mastra/commit/e6733763ad1321aa7e5ae15096b9c2104f93b1f3), [`b2204c9`](https://github.com/mastra-ai/mastra/commit/b2204c98a42848bbfb6f0440f005dc2b6354f1cd), [`a1bf1e3`](https://github.com/mastra-ai/mastra/commit/a1bf1e385ed4c0ef6f11b56c5887442970d127f2), [`b6f647a`](https://github.com/mastra-ai/mastra/commit/b6f647ae2388e091f366581595feb957e37d5b40), [`0c57b8b`](https://github.com/mastra-ai/mastra/commit/0c57b8b0a69a97b5a4ae3f79be6c610f29f3cf7b), [`b081f27`](https://github.com/mastra-ai/mastra/commit/b081f272cf411716e1d6bd72ceac4bcee2657b19), [`682b7f7`](https://github.com/mastra-ai/mastra/commit/682b7f773b7940687ef22569e720fd4bc4fdb8fe), [`0c09eac`](https://github.com/mastra-ai/mastra/commit/0c09eacb1926f64cfdc9ae5c6d63385cf8c9f72c), [`6b9b93d`](https://github.com/mastra-ai/mastra/commit/6b9b93d6f459d1ba6e36f163abf62a085ddb3d64), [`d3ad589`](https://github.com/mastra-ai/mastra/commit/d3ad589a39e66bb783513c4bbf912246bdf18c22), [`b6f647a`](https://github.com/mastra-ai/mastra/commit/b6f647ae2388e091f366581595feb957e37d5b40), [`31b6067`](https://github.com/mastra-ai/mastra/commit/31b6067d0cc3ab10e1b29c36147f3b5266bc714a), [`797ac42`](https://github.com/mastra-ai/mastra/commit/797ac4276de231ad2d694d9aeca75980f6cd0419), [`0423bf4`](https://github.com/mastra-ai/mastra/commit/0423bf4292bd494565ef631bc4f2cc7b86b27390), [`0bc289e`](https://github.com/mastra-ai/mastra/commit/0bc289e2d476bf46c5b91c21969e8d0c6864691c), [`9b75a06`](https://github.com/mastra-ai/mastra/commit/9b75a06e53ebb0b950ba7c1e83a0142047185f46), [`4c3a1b1`](https://github.com/mastra-ai/mastra/commit/4c3a1b122ea083e003d71092f30f3b31680b01c0), [`b8837ee`](https://github.com/mastra-ai/mastra/commit/b8837ee77e2e84197609762bfabd8b3da326d30c), [`0c57b8b`](https://github.com/mastra-ai/mastra/commit/0c57b8b0a69a97b5a4ae3f79be6c610f29f3cf7b), [`85cc3b3`](https://github.com/mastra-ai/mastra/commit/85cc3b3b6f32ae4b083c26498f50d5b250ba944b), [`3ebdadf`](https://github.com/mastra-ai/mastra/commit/3ebdadfe517d16f29464f35baba8356771160369), [`d567299`](https://github.com/mastra-ai/mastra/commit/d567299cf81e02bd9d5221d4bc05967d6c224161), [`97ea28c`](https://github.com/mastra-ai/mastra/commit/97ea28c746e9e4147d56047bbb1c4a92417a3fec), [`d567299`](https://github.com/mastra-ai/mastra/commit/d567299cf81e02bd9d5221d4bc05967d6c224161), [`716ffe6`](https://github.com/mastra-ai/mastra/commit/716ffe68bed81f7c2690bc8581b9e140f7bf1c3d), [`8296332`](https://github.com/mastra-ai/mastra/commit/8296332de21c16e3dfc3d0b2d615720a6dc88f2f), [`4df2116`](https://github.com/mastra-ai/mastra/commit/4df211619dd922c047d396ca41cd7027c8c4c8e7), [`2219c1a`](https://github.com/mastra-ai/mastra/commit/2219c1acbd21da116da877f0036ffb985a9dd5a3), [`17c4145`](https://github.com/mastra-ai/mastra/commit/17c4145166099354545582335b5252bdfdfd908b)]:
  - @mastra/core@1.11.0-alpha.0
  - @mastra/libsql@1.7.0-alpha.0
  - @mastra/pg@1.8.0-alpha.0
  - @mastra/memory@1.6.2-alpha.0
  - @mastra/mcp@1.1.0

## 0.6.0

### Minor Changes

- Added pre/post hook wrapping for tool execution via `HookManager`, exported `createAuthStorage` for standalone auth provider initialization, and fixed Anthropic/OpenAI auth routing to use stored credential type as the source of truth. ([#13611](https://github.com/mastra-ai/mastra/pull/13611))

  **New API: `createAuthStorage`**

  ```ts
  import { createAuthStorage } from 'mastracode';

  const authStorage = createAuthStorage();
  // authStorage is now wired into Claude Max and OpenAI Codex providers
  ```

  - `disabledTools` config now also filters tools exposed to subagents, preventing bypass through delegation
  - Auth routing uses `AuthStorage` credential type (`api_key` vs `oauth`) to correctly route API-key auth vs OAuth bearer auth

- Added /update slash command to check for and install updates directly from the TUI. Fixed update notifications logging repeatedly in the terminal — now only shown once per session. Update messages now reference /update instead of shell commands. ([#13787](https://github.com/mastra-ai/mastra/pull/13787))

### Patch Changes

- Fixed thinking level persistence as a global preference. `/think`, Settings, and OpenAI model pack updates now save the selected level to `settings.json`, so it is kept across restarts and new threads. ([#13748](https://github.com/mastra-ai/mastra/pull/13748))

- Renamed `request_sandbox_access` tool to `request_access`. Fixed tilde paths (`~/.config/...`) not being expanded, which caused the tool to incorrectly report access as already granted. Fixed newly approved paths not being accessible until the next turn by calling `setAllowedPaths` immediately after approval. ([#13753](https://github.com/mastra-ai/mastra/pull/13753))

- Fix fatal "MASTRACODE_VERSION is not defined" error when running from source with tsx. The version constant is now gracefully resolved from package.json at runtime when the build-time define is unavailable. ([#13767](https://github.com/mastra-ai/mastra/pull/13767))

- Updated dependencies [[`41e48c1`](https://github.com/mastra-ai/mastra/commit/41e48c198eee846478e60c02ec432c19d322a517), [`82469d3`](https://github.com/mastra-ai/mastra/commit/82469d3135d5a49dd8dc8feec0ff398b4e0225a0), [`33e2fd5`](https://github.com/mastra-ai/mastra/commit/33e2fd5088f83666df17401e2da68c943dbc0448), [`7ef6e2c`](https://github.com/mastra-ai/mastra/commit/7ef6e2c61be5a42e26f55d15b5902866fc76634f), [`08072ec`](https://github.com/mastra-ai/mastra/commit/08072ec54b5dfe810ed66c0d583ae9d1a9103c11), [`ef9d0f0`](https://github.com/mastra-ai/mastra/commit/ef9d0f0fa98ff225b17afe071f5b84a9258dc142), [`b12d2a5`](https://github.com/mastra-ai/mastra/commit/b12d2a59a48be0477cabae66eb6cf0fc94a7d40d), [`9e21667`](https://github.com/mastra-ai/mastra/commit/9e2166746df81da8f1f933a918741fc52f922c70), [`fa37d39`](https://github.com/mastra-ai/mastra/commit/fa37d39910421feaf8847716292e3d65dd4f30c2), [`b12d2a5`](https://github.com/mastra-ai/mastra/commit/b12d2a59a48be0477cabae66eb6cf0fc94a7d40d), [`1391f22`](https://github.com/mastra-ai/mastra/commit/1391f227ff197080de185ac1073c1d1568c0631f), [`71c38bf`](https://github.com/mastra-ai/mastra/commit/71c38bf905905148ecd0e75c07c1f9825d299b76), [`f993c38`](https://github.com/mastra-ai/mastra/commit/f993c3848c97479b813231be872443bedeced6ab), [`f51849a`](https://github.com/mastra-ai/mastra/commit/f51849a568935122b5100b7ee69704e6d680cf7b), [`3ceb231`](https://github.com/mastra-ai/mastra/commit/3ceb2317aad7da36df5053e7c84f9381eeb68d11), [`9bf3a0d`](https://github.com/mastra-ai/mastra/commit/9bf3a0dac602787925f1762f1f0387d7b4a59620), [`cafa045`](https://github.com/mastra-ai/mastra/commit/cafa0453c9de141ad50c09a13894622dffdd9978), [`1fd9ddb`](https://github.com/mastra-ai/mastra/commit/1fd9ddbb3fe83b281b12bd2e27e426ae86288266), [`1391f22`](https://github.com/mastra-ai/mastra/commit/1391f227ff197080de185ac1073c1d1568c0631f), [`ef888d2`](https://github.com/mastra-ai/mastra/commit/ef888d23c77f85f4c202228b63f8fd9b6d9361af), [`e7a567c`](https://github.com/mastra-ai/mastra/commit/e7a567cfb3e65c955a07d0167cb1b4141f5bda01), [`3626623`](https://github.com/mastra-ai/mastra/commit/36266238eb7db78fce2ac34187194613f6f53733), [`6135ef4`](https://github.com/mastra-ai/mastra/commit/6135ef4f5288652bf45f616ec590607e4c95f443), [`d9d228c`](https://github.com/mastra-ai/mastra/commit/d9d228c0c6ae82ae6ce3b540a3a56b2b1c2b8d98), [`5576507`](https://github.com/mastra-ai/mastra/commit/55765071e360fb97e443aa0a91ccf7e1cd8d92aa), [`79d69c9`](https://github.com/mastra-ai/mastra/commit/79d69c9d5f842ff1c31352fb6026f04c1f6190f3), [`94f44b8`](https://github.com/mastra-ai/mastra/commit/94f44b827ce57b179e50f4916a84c0fa6e7f3b8c), [`13187db`](https://github.com/mastra-ai/mastra/commit/13187dbac880174232dedc5a501ff6c5d0fe59bc), [`2ae5311`](https://github.com/mastra-ai/mastra/commit/2ae531185fff66a80fa165c0999e3d801900e89d), [`6135ef4`](https://github.com/mastra-ai/mastra/commit/6135ef4f5288652bf45f616ec590607e4c95f443)]:
  - @mastra/core@1.10.0
  - @mastra/memory@1.6.1
  - @mastra/mcp@1.1.0
  - @mastra/libsql@1.6.4
  - @mastra/pg@1.7.2

## 0.6.0-alpha.0

### Minor Changes

- Added pre/post hook wrapping for tool execution via `HookManager`, exported `createAuthStorage` for standalone auth provider initialization, and fixed Anthropic/OpenAI auth routing to use stored credential type as the source of truth. ([#13611](https://github.com/mastra-ai/mastra/pull/13611))

  **New API: `createAuthStorage`**

  ```ts
  import { createAuthStorage } from 'mastracode';

  const authStorage = createAuthStorage();
  // authStorage is now wired into Claude Max and OpenAI Codex providers
  ```

  - `disabledTools` config now also filters tools exposed to subagents, preventing bypass through delegation
  - Auth routing uses `AuthStorage` credential type (`api_key` vs `oauth`) to correctly route API-key auth vs OAuth bearer auth

- Added /update slash command to check for and install updates directly from the TUI. Fixed update notifications logging repeatedly in the terminal — now only shown once per session. Update messages now reference /update instead of shell commands. ([#13787](https://github.com/mastra-ai/mastra/pull/13787))

### Patch Changes

- Fixed thinking level persistence as a global preference. `/think`, Settings, and OpenAI model pack updates now save the selected level to `settings.json`, so it is kept across restarts and new threads. ([#13748](https://github.com/mastra-ai/mastra/pull/13748))

- Renamed `request_sandbox_access` tool to `request_access`. Fixed tilde paths (`~/.config/...`) not being expanded, which caused the tool to incorrectly report access as already granted. Fixed newly approved paths not being accessible until the next turn by calling `setAllowedPaths` immediately after approval. ([#13753](https://github.com/mastra-ai/mastra/pull/13753))

- Fix fatal "MASTRACODE_VERSION is not defined" error when running from source with tsx. The version constant is now gracefully resolved from package.json at runtime when the build-time define is unavailable. ([#13767](https://github.com/mastra-ai/mastra/pull/13767))

- Updated dependencies [[`41e48c1`](https://github.com/mastra-ai/mastra/commit/41e48c198eee846478e60c02ec432c19d322a517), [`82469d3`](https://github.com/mastra-ai/mastra/commit/82469d3135d5a49dd8dc8feec0ff398b4e0225a0), [`33e2fd5`](https://github.com/mastra-ai/mastra/commit/33e2fd5088f83666df17401e2da68c943dbc0448), [`7ef6e2c`](https://github.com/mastra-ai/mastra/commit/7ef6e2c61be5a42e26f55d15b5902866fc76634f), [`08072ec`](https://github.com/mastra-ai/mastra/commit/08072ec54b5dfe810ed66c0d583ae9d1a9103c11), [`ef9d0f0`](https://github.com/mastra-ai/mastra/commit/ef9d0f0fa98ff225b17afe071f5b84a9258dc142), [`b12d2a5`](https://github.com/mastra-ai/mastra/commit/b12d2a59a48be0477cabae66eb6cf0fc94a7d40d), [`9e21667`](https://github.com/mastra-ai/mastra/commit/9e2166746df81da8f1f933a918741fc52f922c70), [`fa37d39`](https://github.com/mastra-ai/mastra/commit/fa37d39910421feaf8847716292e3d65dd4f30c2), [`b12d2a5`](https://github.com/mastra-ai/mastra/commit/b12d2a59a48be0477cabae66eb6cf0fc94a7d40d), [`1391f22`](https://github.com/mastra-ai/mastra/commit/1391f227ff197080de185ac1073c1d1568c0631f), [`71c38bf`](https://github.com/mastra-ai/mastra/commit/71c38bf905905148ecd0e75c07c1f9825d299b76), [`f993c38`](https://github.com/mastra-ai/mastra/commit/f993c3848c97479b813231be872443bedeced6ab), [`f51849a`](https://github.com/mastra-ai/mastra/commit/f51849a568935122b5100b7ee69704e6d680cf7b), [`3ceb231`](https://github.com/mastra-ai/mastra/commit/3ceb2317aad7da36df5053e7c84f9381eeb68d11), [`9bf3a0d`](https://github.com/mastra-ai/mastra/commit/9bf3a0dac602787925f1762f1f0387d7b4a59620), [`cafa045`](https://github.com/mastra-ai/mastra/commit/cafa0453c9de141ad50c09a13894622dffdd9978), [`1fd9ddb`](https://github.com/mastra-ai/mastra/commit/1fd9ddbb3fe83b281b12bd2e27e426ae86288266), [`1391f22`](https://github.com/mastra-ai/mastra/commit/1391f227ff197080de185ac1073c1d1568c0631f), [`ef888d2`](https://github.com/mastra-ai/mastra/commit/ef888d23c77f85f4c202228b63f8fd9b6d9361af), [`e7a567c`](https://github.com/mastra-ai/mastra/commit/e7a567cfb3e65c955a07d0167cb1b4141f5bda01), [`3626623`](https://github.com/mastra-ai/mastra/commit/36266238eb7db78fce2ac34187194613f6f53733), [`6135ef4`](https://github.com/mastra-ai/mastra/commit/6135ef4f5288652bf45f616ec590607e4c95f443), [`d9d228c`](https://github.com/mastra-ai/mastra/commit/d9d228c0c6ae82ae6ce3b540a3a56b2b1c2b8d98), [`5576507`](https://github.com/mastra-ai/mastra/commit/55765071e360fb97e443aa0a91ccf7e1cd8d92aa), [`79d69c9`](https://github.com/mastra-ai/mastra/commit/79d69c9d5f842ff1c31352fb6026f04c1f6190f3), [`94f44b8`](https://github.com/mastra-ai/mastra/commit/94f44b827ce57b179e50f4916a84c0fa6e7f3b8c), [`13187db`](https://github.com/mastra-ai/mastra/commit/13187dbac880174232dedc5a501ff6c5d0fe59bc), [`2ae5311`](https://github.com/mastra-ai/mastra/commit/2ae531185fff66a80fa165c0999e3d801900e89d), [`6135ef4`](https://github.com/mastra-ai/mastra/commit/6135ef4f5288652bf45f616ec590607e4c95f443)]:
  - @mastra/core@1.10.0-alpha.0
  - @mastra/memory@1.6.1-alpha.0
  - @mastra/mcp@1.1.0-alpha.0
  - @mastra/libsql@1.6.4-alpha.0
  - @mastra/pg@1.7.2-alpha.0

## 0.5.1

### Patch Changes

- Fixed fatal 'Cannot find module ../../package.json' error when running mastracode after installing from npm. The version is now inlined at build time instead of requiring the package.json file at runtime. ([#13760](https://github.com/mastra-ai/mastra/pull/13760))

## 0.5.1-alpha.0

### Patch Changes

- Fixed fatal 'Cannot find module ../../package.json' error when running mastracode after installing from npm. The version is now inlined at build time instead of requiring the package.json file at runtime. ([#13760](https://github.com/mastra-ai/mastra/pull/13760))

## 0.5.0

### Minor Changes

- Added support for dynamic `extraTools` in `createMastraCode`. The `extraTools` option now accepts a function `({ requestContext }) => Record<string, any>` in addition to a static record, enabling conditional tool registration based on the current request context (e.g. model, mode). ([#13713](https://github.com/mastra-ai/mastra/pull/13713))

- Added plan persistence: approved plans are now saved as markdown files to disk. Plans are stored at the platform-specific app data directory (e.g. ~/Library/Application Support/mastracode/plans/ on macOS). Set the MASTRA_PLANS_DIR environment variable to override the storage location. ([#13557](https://github.com/mastra-ai/mastra/pull/13557))

- Added `resolveModel` to the return value of `createMastraCode`, allowing consumers to use the fully-authenticated model resolver instead of having to reimplement provider logic locally. ([#13716](https://github.com/mastra-ai/mastra/pull/13716))

  ```typescript
  const { harness, resolveModel } = await createMastraCode({ cwd: projectPath });
  const model = resolveModel('anthropic/claude-sonnet-4-20250514');
  ```

- Added /report-issue slash command. Starts a guided conversation to help you file a well-structured bug report — the LLM interviews you about the problem, gathers environment info, checks for duplicates, and drafts the issue for your approval before creating it. ([#13605](https://github.com/mastra-ai/mastra/pull/13605))

- Fix assistant streaming updates so tool-result-only chunks do not overwrite visible assistant text with empty content. ([#13609](https://github.com/mastra-ai/mastra/pull/13609))

  Also add an OpenAI native `web_search` fallback when no Tavily key is configured and the current model is `openai/*`.

- Support HTTP MCP servers in mastracode config ([#13613](https://github.com/mastra-ai/mastra/pull/13613))

  MCP server entries with a `url` field are now recognized as HTTP (Streamable HTTP / SSE) servers. Previously only stdio-based servers (with `command`) were loaded from `mcp.json`; entries with `url` were silently dropped.

  **What's new:**
  - Add `url` + optional `headers` config for HTTP MCP servers
  - Invalid or ambiguous entries are tracked as "skipped" with a human-readable reason
  - `/mcp` command shows transport type (`[stdio]` / `[http]`) and lists skipped servers
  - Startup logs report skipped servers with reasons

  **Example mcp.json:**

  ```json
  {
    "mcpServers": {
      "local-fs": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
      },
      "remote-api": {
        "url": "https://mcp.example.com/sse",
        "headers": { "Authorization": "Bearer <token>" }
      }
    }
  }
  ```

- Added auto-update prompt on session start. When a newer version is available on npm, you'll be prompted to update automatically. Declining saves the choice so the prompt won't repeat — a one-liner with the manual update command is shown instead. The update command matches the package manager used for installation (npm, pnpm, yarn, bun). ([#13603](https://github.com/mastra-ai/mastra/pull/13603))

### Patch Changes

- Fixed plan approval flow so selecting Request changes keeps the submitted plan visible while entering feedback in the TUI. ([#13598](https://github.com/mastra-ai/mastra/pull/13598))

- Removed unnecessary Mastra instance wrapper in createMastraCode. The Agent is now created standalone and the Harness handles Mastra registration internally during init(). ([#13519](https://github.com/mastra-ai/mastra/pull/13519))

- **Added** Ctrl+Z now suspends mastracode and returns control to your shell. Run `fg` to resume. ([#13723](https://github.com/mastra-ai/mastra/pull/13723))

  ```bash
  # while mastracode is running, press Ctrl+Z to suspend
  $ fg   # resume mastracode
  ```

  Fixes #13582.

- Added `/clone` command with confirm/cancel and optional rename prompts. Thread selector now sorts threads tagged with the current directory above other same-resource threads. Auto-resume shows thread selector when multiple directory threads exist instead of silently picking the most recent. Thread lock prompts now include a "Switch thread" option to open the thread selector. ([#13569](https://github.com/mastra-ai/mastra/pull/13569))

- Fixed test suite reliability by resolving cross-test module contamination when running with shared isolation ([#13692](https://github.com/mastra-ai/mastra/pull/13692))

- Add first-class custom provider support for MastraCode model selection and routing. ([#13682](https://github.com/mastra-ai/mastra/pull/13682))
  - Add `/custom-providers` command to create, edit, and delete custom OpenAI-compatible providers and manage model IDs under each provider.
  - Persist custom providers and model IDs in `settings.json` with schema parsing/validation updates.
  - Extend Harness model catalog listing with `customModelCatalogProvider` so custom models appear in existing selectors (`/models`, `/subagents`).
  - Route configured custom provider model IDs through `ModelRouterLanguageModel` using provider-specific URL and optional API key settings.

- Added ANTHROPIC_API_KEY support as a fallback for Anthropic model resolution. Previously, anthropic/\* models always required Claude Max OAuth. Now, when not logged in via OAuth, mastracode falls back to the ANTHROPIC_API_KEY environment variable or a stored API key credential. ([#13600](https://github.com/mastra-ai/mastra/pull/13600))

- Fixed an issue where multiple interactive prompts could appear at once and make earlier prompts unresponsive. Prompts are now shown one at a time so each can be answered reliably. ([#13696](https://github.com/mastra-ai/mastra/pull/13696))

- Fixed OpenAI Codex OAuth model routing for observational memory. ([#13563](https://github.com/mastra-ai/mastra/pull/13563))

  When Codex OAuth is active, observer and reflector model IDs now remap GPT-5 OpenAI models to Codex-compatible variants before provider resolution. This prevents observational memory runs from failing when a non-codex GPT-5 model ID is selected.

  Also enforced a minimum reasoning level of `low` for GPT-5 Codex requests so `off` is not sent to Codex for those models.

- The setup flow now detects API keys for all providers listed in the model registry, not just a fixed set. ([#13566](https://github.com/mastra-ai/mastra/pull/13566))
  Users with API keys for providers like Groq, Mistral, or any supported provider will no longer see a "No model providers configured" error.
  Missing provider detection is now a warning, allowing users to continue setup.

- **`sendMessage` now accepts `files` instead of `images`**, supporting any file type with optional `filename`. ([#13574](https://github.com/mastra-ai/mastra/pull/13574))

  **Breaking change:** Rename `images` to `files` when calling `harness.sendMessage()`:

  ```ts
  // Before
  await harness.sendMessage({
    content: 'Analyze this',
    images: [{ data: base64Data, mimeType: 'image/png' }],
  });

  // After
  await harness.sendMessage({
    content: 'Analyze this',
    files: [{ data: base64Data, mediaType: 'image/png', filename: 'screenshot.png' }],
  });
  ```

  - `files` accepts `{ data, mediaType, filename? }` — filenames are now preserved through storage and message history
  - Text-based files (`text/*`, `application/json`) are automatically decoded to readable text content instead of being sent as binary, which models could not process
  - `HarnessMessageContent` now includes a `file` type, so file parts round-trip correctly through message history

- Fixed two bugs in Mastra Code tool handling: ([#13564](https://github.com/mastra-ai/mastra/pull/13564))

  **extraTools not merged** — The `extraTools` parameter in `createMastraCode` was accepted but never passed through to the dynamic tool builder. Extra tools are now correctly merged into the tool set (without overwriting built-in tools).

  **Denied tools still advertised** — Tools with a per-tool `deny` policy in `permissionRules` were still included in the tool set and system prompt guidance, causing the model to attempt using them only to be blocked at execution time. Denied tools are now filtered from both the tool set and the tool guidance, so the model never sees them.

- Added "Quiet mode" setting. When enabled via `/settings` → "Quiet mode" → On, components like subagent output auto-collapse to compact summary lines on completion. Default is off (full output stays visible). The setting persists across restarts. ([#13556](https://github.com/mastra-ai/mastra/pull/13556))

- Added Ctrl+V clipboard paste support for both images and text. Images from the clipboard are detected and sent to the AI agent. Text pastes flow through the editor's paste handling, which condenses large pastes (>10 lines) into a compact `[paste #N +X lines]` marker instead of dumping raw content. ([#13712](https://github.com/mastra-ai/mastra/pull/13712))

- Fixed subagents being unable to access files outside the project root. Subagents now inherit both user-approved sandbox paths and skill paths (e.g. `~/.claude/skills`) from the parent agent. ([#13700](https://github.com/mastra-ai/mastra/pull/13700))

- Improved the `/resource` command. Switching resources now resumes the most recent thread for that resource instead of always creating a new one. If no threads exist for the resource, a new thread is created. Also added help text clarifying how resource switching works. ([#13690](https://github.com/mastra-ai/mastra/pull/13690))

  Example:

  ```bash
  /resource my-resource-id
  ```

- Workspace tool names are now remapped to canonical names (`view`, `search_content`, `string_replace_lsp`, etc.) so they match tool guidance prompts, permissions, and TUI rendering. ([#13687](https://github.com/mastra-ai/mastra/pull/13687))

- Ability to pass in your own workspace to createMastraCode ([#13693](https://github.com/mastra-ai/mastra/pull/13693))

- Fixed mastracode edit tools to resolve relative paths against the configured project root. ([#13526](https://github.com/mastra-ai/mastra/pull/13526))

- Model pack selection is now more consistent and reliable in mastracode. ([#13512](https://github.com/mastra-ai/mastra/pull/13512))
  - `/models` is now the single command for choosing and managing model packs.
  - Model picker ranking now learns from your recent selections and keeps those preferences across sessions.
  - Pack choice now restores correctly per thread when switching between threads.
  - Custom packs now support full create, rename, targeted edit, and delete workflows.
  - The built-in **Varied** option has been retired; users who had it selected are automatically migrated to a saved custom pack named `varied`.

- Fixed a crash where ERR_STREAM_DESTROYED errors would fatally exit the process. These errors occur routinely during cancelled LLM streams, LSP shutdown, or killed subprocesses and are now silently ignored instead of crashing mastracode. ([#13560](https://github.com/mastra-ai/mastra/pull/13560))

- Fixed tool guidance to match actual workspace tool parameters: view uses offset/limit, search_content uses path, string_replace_lsp uses old_string/new_string with replace_all, execute_command documents tail parameter and cwd. Softened overly strict NEVER directives to prefer-style guidance. ([#13724](https://github.com/mastra-ai/mastra/pull/13724))

- Switched Mastra Code to workspace tools and enabled LSP by default ([#13437](https://github.com/mastra-ai/mastra/pull/13437))
  - Switched from built-in tool implementations to workspace tools for file operations, search, edit, write, and command execution
  - Enabled LSP (language server) by default with automatic package runner detection and bundled binary resolution
  - Added real-time stdout/stderr streaming in the TUI for workspace command execution
  - Added TUI rendering for process management tools (view output, kill processes)
  - Fixed edit diff preview in the TUI to work with workspace tool arg names (`old_string`/`new_string`)

- Added MASTRA_DEBUG environment variable to gate debug.log file writing. When MASTRA_DEBUG=true is set, console.error and console.warn output is captured to a debug.log file in the app data directory. The log file is automatically truncated to ~4 MB on startup if it exceeds 5 MB, preventing unbounded disk usage over time. ([#13691](https://github.com/mastra-ai/mastra/pull/13691))

- Updated dependencies [[`504fc8b`](https://github.com/mastra-ai/mastra/commit/504fc8b9d0ddab717577ad3bf9c95ea4bd5377bd), [`f9c150b`](https://github.com/mastra-ai/mastra/commit/f9c150b7595ad05ad9cc9a11098e2944361e8c22), [`88de7e8`](https://github.com/mastra-ai/mastra/commit/88de7e8dfe4b7e1951a9e441bb33136e705ce24e), [`88de7e8`](https://github.com/mastra-ai/mastra/commit/88de7e8dfe4b7e1951a9e441bb33136e705ce24e), [`88de7e8`](https://github.com/mastra-ai/mastra/commit/88de7e8dfe4b7e1951a9e441bb33136e705ce24e), [`edee4b3`](https://github.com/mastra-ai/mastra/commit/edee4b37dff0af515fc7cc0e8d71ee39e6a762f0), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`3790c75`](https://github.com/mastra-ai/mastra/commit/3790c7578cc6a47d854eb12d89e6b1912867fe29), [`e7a235b`](https://github.com/mastra-ai/mastra/commit/e7a235be6472e0c870ed6c791ddb17c492dc188b), [`d51d298`](https://github.com/mastra-ai/mastra/commit/d51d298953967aab1f58ec965b644d109214f085), [`6dbeeb9`](https://github.com/mastra-ai/mastra/commit/6dbeeb94a8b1eebb727300d1a98961f882180794), [`d5f0d8d`](https://github.com/mastra-ai/mastra/commit/d5f0d8d6a03e515ddaa9b5da19b7e44b8357b07b), [`09c3b18`](https://github.com/mastra-ai/mastra/commit/09c3b1802ff14e243a8a8baea327440bc8cc2e32), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`85c84eb`](https://github.com/mastra-ai/mastra/commit/85c84ebb78aebfcba9d209c8e152b16d7a00cb71), [`a89272a`](https://github.com/mastra-ai/mastra/commit/a89272a5d71939b9fcd284e6a6dc1dd091a6bdcf), [`ee9c8df`](https://github.com/mastra-ai/mastra/commit/ee9c8df644f19d055af5f496bf4942705f5a47b7), [`77b4a25`](https://github.com/mastra-ai/mastra/commit/77b4a254e51907f8ff3a3ba95596a18e93ae4b35), [`276246e`](https://github.com/mastra-ai/mastra/commit/276246e0b9066a1ea48bbc70df84dbe528daaf99), [`08ecfdb`](https://github.com/mastra-ai/mastra/commit/08ecfdbdad6fb8285deef86a034bdf4a6047cfca), [`d5f628c`](https://github.com/mastra-ai/mastra/commit/d5f628ca86c6f6f3ff1035d52f635df32dd81cab), [`24f7204`](https://github.com/mastra-ai/mastra/commit/24f72046eb35b47c75d36193af4fb817b588720d), [`359d687`](https://github.com/mastra-ai/mastra/commit/359d687527ab95a79e0ec0487dcecec8d9c7c7dc), [`524c0f3`](https://github.com/mastra-ai/mastra/commit/524c0f3c434c3d9d18f66338dcef383d6161b59c), [`961b7ba`](https://github.com/mastra-ai/mastra/commit/961b7baa2c61365e1ee1b33d2a5074102ee40a52), [`c18a0e9`](https://github.com/mastra-ai/mastra/commit/c18a0e9cef1e4ca004b2963d35e4cfc031971eac), [`4bd21ea`](https://github.com/mastra-ai/mastra/commit/4bd21ea43d44d0a0427414fc047577f9f0aa3bec), [`115a7a4`](https://github.com/mastra-ai/mastra/commit/115a7a47db5e9896fec12ae6507501adb9ec89bf), [`22a48ae`](https://github.com/mastra-ai/mastra/commit/22a48ae2513eb54d8d79dad361fddbca97a155e8), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9e77e8f`](https://github.com/mastra-ai/mastra/commit/9e77e8f0e823ef58cb448dd1f390fce987a101f3), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`7edf78f`](https://github.com/mastra-ai/mastra/commit/7edf78f80422c43e84585f08ba11df0d4d0b73c5), [`1c4221c`](https://github.com/mastra-ai/mastra/commit/1c4221cf6032ec98d0e094d4ee11da3e48490d96), [`d25b9ea`](https://github.com/mastra-ai/mastra/commit/d25b9eabd400167255a97b690ffbc4ee4097ded5), [`fe1ce5c`](https://github.com/mastra-ai/mastra/commit/fe1ce5c9211c03d561606fda95cbfe7df1d9a9b5), [`b03c0e0`](https://github.com/mastra-ai/mastra/commit/b03c0e0389a799523929a458b0509c9e4244d562), [`0a8366b`](https://github.com/mastra-ai/mastra/commit/0a8366b0a692fcdde56c4d526e4cf03c502ae4ac), [`56f2018`](https://github.com/mastra-ai/mastra/commit/56f2018cb38969c11933e815a5f70cf631d3964a), [`85664e9`](https://github.com/mastra-ai/mastra/commit/85664e9fd857320fbc245e301f764f45f66f32a3), [`bc79650`](https://github.com/mastra-ai/mastra/commit/bc796500c6e0334faa158a96077e3fb332274869), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`3a3a59e`](https://github.com/mastra-ai/mastra/commit/3a3a59e8ffaa6a985fe3d9a126a3f5ade11a6724), [`3108d4e`](https://github.com/mastra-ai/mastra/commit/3108d4e649c9fddbf03253a6feeb388a5fa9fa5a), [`0c33b2c`](https://github.com/mastra-ai/mastra/commit/0c33b2c9db537f815e1c59e2c898ffce2e395a79), [`191e5bd`](https://github.com/mastra-ai/mastra/commit/191e5bd29b82f5bda35243945790da7bc7b695c2), [`fde104d`](https://github.com/mastra-ai/mastra/commit/fde104da80935d6e0dd24327e86a51011fcb3173), [`f77cd94`](https://github.com/mastra-ai/mastra/commit/f77cd94c44eabed490384e7d19232a865e13214c), [`e8135c7`](https://github.com/mastra-ai/mastra/commit/e8135c7e300dac5040670eec7eab896ac6092e30), [`daca48f`](https://github.com/mastra-ai/mastra/commit/daca48f0fb17b7ae0b62a2ac40cf0e491b2fd0b7), [`257d14f`](https://github.com/mastra-ai/mastra/commit/257d14faca5931f2e4186fc165b6f0b1f915deee), [`352f25d`](https://github.com/mastra-ai/mastra/commit/352f25da316b24cdd5b410fd8dddf6a8b763da2a), [`93477d0`](https://github.com/mastra-ai/mastra/commit/93477d0769b8a13ea5ed73d508d967fb23eaeed9), [`31c78b3`](https://github.com/mastra-ai/mastra/commit/31c78b3eb28f58a8017f1dcc795c33214d87feac), [`0bc0720`](https://github.com/mastra-ai/mastra/commit/0bc07201095791858087cc56f353fcd65e87ab54), [`36516ac`](https://github.com/mastra-ai/mastra/commit/36516aca1021cbeb42e74751b46a2614101f37c8), [`e947652`](https://github.com/mastra-ai/mastra/commit/e9476527fdecb4449e54570e80dfaf8466901254), [`23b43dd`](https://github.com/mastra-ai/mastra/commit/23b43ddd0e3db05dee828c2733faa2496b7b0319), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`ec248f6`](https://github.com/mastra-ai/mastra/commit/ec248f6b56e8a037c066c49b2178e2507471d988)]:
  - @mastra/core@1.9.0
  - @mastra/libsql@1.6.3
  - @mastra/pg@1.7.1
  - @mastra/memory@1.6.0
  - @mastra/mcp@1.0.3

## 0.5.0-alpha.0

### Minor Changes

- Added support for dynamic `extraTools` in `createMastraCode`. The `extraTools` option now accepts a function `({ requestContext }) => Record<string, any>` in addition to a static record, enabling conditional tool registration based on the current request context (e.g. model, mode). ([#13713](https://github.com/mastra-ai/mastra/pull/13713))

- Added plan persistence: approved plans are now saved as markdown files to disk. Plans are stored at the platform-specific app data directory (e.g. ~/Library/Application Support/mastracode/plans/ on macOS). Set the MASTRA_PLANS_DIR environment variable to override the storage location. ([#13557](https://github.com/mastra-ai/mastra/pull/13557))

- Added `resolveModel` to the return value of `createMastraCode`, allowing consumers to use the fully-authenticated model resolver instead of having to reimplement provider logic locally. ([#13716](https://github.com/mastra-ai/mastra/pull/13716))

  ```typescript
  const { harness, resolveModel } = await createMastraCode({ cwd: projectPath });
  const model = resolveModel('anthropic/claude-sonnet-4-20250514');
  ```

- Added /report-issue slash command. Starts a guided conversation to help you file a well-structured bug report — the LLM interviews you about the problem, gathers environment info, checks for duplicates, and drafts the issue for your approval before creating it. ([#13605](https://github.com/mastra-ai/mastra/pull/13605))

- Fix assistant streaming updates so tool-result-only chunks do not overwrite visible assistant text with empty content. ([#13609](https://github.com/mastra-ai/mastra/pull/13609))

  Also add an OpenAI native `web_search` fallback when no Tavily key is configured and the current model is `openai/*`.

- Support HTTP MCP servers in mastracode config ([#13613](https://github.com/mastra-ai/mastra/pull/13613))

  MCP server entries with a `url` field are now recognized as HTTP (Streamable HTTP / SSE) servers. Previously only stdio-based servers (with `command`) were loaded from `mcp.json`; entries with `url` were silently dropped.

  **What's new:**
  - Add `url` + optional `headers` config for HTTP MCP servers
  - Invalid or ambiguous entries are tracked as "skipped" with a human-readable reason
  - `/mcp` command shows transport type (`[stdio]` / `[http]`) and lists skipped servers
  - Startup logs report skipped servers with reasons

  **Example mcp.json:**

  ```json
  {
    "mcpServers": {
      "local-fs": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
      },
      "remote-api": {
        "url": "https://mcp.example.com/sse",
        "headers": { "Authorization": "Bearer <token>" }
      }
    }
  }
  ```

- Added auto-update prompt on session start. When a newer version is available on npm, you'll be prompted to update automatically. Declining saves the choice so the prompt won't repeat — a one-liner with the manual update command is shown instead. The update command matches the package manager used for installation (npm, pnpm, yarn, bun). ([#13603](https://github.com/mastra-ai/mastra/pull/13603))

### Patch Changes

- Fixed plan approval flow so selecting Request changes keeps the submitted plan visible while entering feedback in the TUI. ([#13598](https://github.com/mastra-ai/mastra/pull/13598))

- Removed unnecessary Mastra instance wrapper in createMastraCode. The Agent is now created standalone and the Harness handles Mastra registration internally during init(). ([#13519](https://github.com/mastra-ai/mastra/pull/13519))

- **Added** Ctrl+Z now suspends mastracode and returns control to your shell. Run `fg` to resume. ([#13723](https://github.com/mastra-ai/mastra/pull/13723))

  ```bash
  # while mastracode is running, press Ctrl+Z to suspend
  $ fg   # resume mastracode
  ```

  Fixes #13582.

- Added `/clone` command with confirm/cancel and optional rename prompts. Thread selector now sorts threads tagged with the current directory above other same-resource threads. Auto-resume shows thread selector when multiple directory threads exist instead of silently picking the most recent. Thread lock prompts now include a "Switch thread" option to open the thread selector. ([#13569](https://github.com/mastra-ai/mastra/pull/13569))

- Fixed test suite reliability by resolving cross-test module contamination when running with shared isolation ([#13692](https://github.com/mastra-ai/mastra/pull/13692))

- Add first-class custom provider support for MastraCode model selection and routing. ([#13682](https://github.com/mastra-ai/mastra/pull/13682))
  - Add `/custom-providers` command to create, edit, and delete custom OpenAI-compatible providers and manage model IDs under each provider.
  - Persist custom providers and model IDs in `settings.json` with schema parsing/validation updates.
  - Extend Harness model catalog listing with `customModelCatalogProvider` so custom models appear in existing selectors (`/models`, `/subagents`).
  - Route configured custom provider model IDs through `ModelRouterLanguageModel` using provider-specific URL and optional API key settings.

- Added ANTHROPIC_API_KEY support as a fallback for Anthropic model resolution. Previously, anthropic/\* models always required Claude Max OAuth. Now, when not logged in via OAuth, mastracode falls back to the ANTHROPIC_API_KEY environment variable or a stored API key credential. ([#13600](https://github.com/mastra-ai/mastra/pull/13600))

- Fixed an issue where multiple interactive prompts could appear at once and make earlier prompts unresponsive. Prompts are now shown one at a time so each can be answered reliably. ([#13696](https://github.com/mastra-ai/mastra/pull/13696))

- Fixed OpenAI Codex OAuth model routing for observational memory. ([#13563](https://github.com/mastra-ai/mastra/pull/13563))

  When Codex OAuth is active, observer and reflector model IDs now remap GPT-5 OpenAI models to Codex-compatible variants before provider resolution. This prevents observational memory runs from failing when a non-codex GPT-5 model ID is selected.

  Also enforced a minimum reasoning level of `low` for GPT-5 Codex requests so `off` is not sent to Codex for those models.

- The setup flow now detects API keys for all providers listed in the model registry, not just a fixed set. ([#13566](https://github.com/mastra-ai/mastra/pull/13566))
  Users with API keys for providers like Groq, Mistral, or any supported provider will no longer see a "No model providers configured" error.
  Missing provider detection is now a warning, allowing users to continue setup.

- **`sendMessage` now accepts `files` instead of `images`**, supporting any file type with optional `filename`. ([#13574](https://github.com/mastra-ai/mastra/pull/13574))

  **Breaking change:** Rename `images` to `files` when calling `harness.sendMessage()`:

  ```ts
  // Before
  await harness.sendMessage({
    content: 'Analyze this',
    images: [{ data: base64Data, mimeType: 'image/png' }],
  });

  // After
  await harness.sendMessage({
    content: 'Analyze this',
    files: [{ data: base64Data, mediaType: 'image/png', filename: 'screenshot.png' }],
  });
  ```

  - `files` accepts `{ data, mediaType, filename? }` — filenames are now preserved through storage and message history
  - Text-based files (`text/*`, `application/json`) are automatically decoded to readable text content instead of being sent as binary, which models could not process
  - `HarnessMessageContent` now includes a `file` type, so file parts round-trip correctly through message history

- Fixed two bugs in Mastra Code tool handling: ([#13564](https://github.com/mastra-ai/mastra/pull/13564))

  **extraTools not merged** — The `extraTools` parameter in `createMastraCode` was accepted but never passed through to the dynamic tool builder. Extra tools are now correctly merged into the tool set (without overwriting built-in tools).

  **Denied tools still advertised** — Tools with a per-tool `deny` policy in `permissionRules` were still included in the tool set and system prompt guidance, causing the model to attempt using them only to be blocked at execution time. Denied tools are now filtered from both the tool set and the tool guidance, so the model never sees them.

- Added "Quiet mode" setting. When enabled via `/settings` → "Quiet mode" → On, components like subagent output auto-collapse to compact summary lines on completion. Default is off (full output stays visible). The setting persists across restarts. ([#13556](https://github.com/mastra-ai/mastra/pull/13556))

- Added Ctrl+V clipboard paste support for both images and text. Images from the clipboard are detected and sent to the AI agent. Text pastes flow through the editor's paste handling, which condenses large pastes (>10 lines) into a compact `[paste #N +X lines]` marker instead of dumping raw content. ([#13712](https://github.com/mastra-ai/mastra/pull/13712))

- Fixed subagents being unable to access files outside the project root. Subagents now inherit both user-approved sandbox paths and skill paths (e.g. `~/.claude/skills`) from the parent agent. ([#13700](https://github.com/mastra-ai/mastra/pull/13700))

- Improved the `/resource` command. Switching resources now resumes the most recent thread for that resource instead of always creating a new one. If no threads exist for the resource, a new thread is created. Also added help text clarifying how resource switching works. ([#13690](https://github.com/mastra-ai/mastra/pull/13690))

  Example:

  ```bash
  /resource my-resource-id
  ```

- Workspace tool names are now remapped to canonical names (`view`, `search_content`, `string_replace_lsp`, etc.) so they match tool guidance prompts, permissions, and TUI rendering. ([#13687](https://github.com/mastra-ai/mastra/pull/13687))

- Ability to pass in your own workspace to createMastraCode ([#13693](https://github.com/mastra-ai/mastra/pull/13693))

- Fixed mastracode edit tools to resolve relative paths against the configured project root. ([#13526](https://github.com/mastra-ai/mastra/pull/13526))

- Model pack selection is now more consistent and reliable in mastracode. ([#13512](https://github.com/mastra-ai/mastra/pull/13512))
  - `/models` is now the single command for choosing and managing model packs.
  - Model picker ranking now learns from your recent selections and keeps those preferences across sessions.
  - Pack choice now restores correctly per thread when switching between threads.
  - Custom packs now support full create, rename, targeted edit, and delete workflows.
  - The built-in **Varied** option has been retired; users who had it selected are automatically migrated to a saved custom pack named `varied`.

- Fixed a crash where ERR_STREAM_DESTROYED errors would fatally exit the process. These errors occur routinely during cancelled LLM streams, LSP shutdown, or killed subprocesses and are now silently ignored instead of crashing mastracode. ([#13560](https://github.com/mastra-ai/mastra/pull/13560))

- Fixed tool guidance to match actual workspace tool parameters: view uses offset/limit, search_content uses path, string_replace_lsp uses old_string/new_string with replace_all, execute_command documents tail parameter and cwd. Softened overly strict NEVER directives to prefer-style guidance. ([#13724](https://github.com/mastra-ai/mastra/pull/13724))

- Switched Mastra Code to workspace tools and enabled LSP by default ([#13437](https://github.com/mastra-ai/mastra/pull/13437))
  - Switched from built-in tool implementations to workspace tools for file operations, search, edit, write, and command execution
  - Enabled LSP (language server) by default with automatic package runner detection and bundled binary resolution
  - Added real-time stdout/stderr streaming in the TUI for workspace command execution
  - Added TUI rendering for process management tools (view output, kill processes)
  - Fixed edit diff preview in the TUI to work with workspace tool arg names (`old_string`/`new_string`)

- Added MASTRA_DEBUG environment variable to gate debug.log file writing. When MASTRA_DEBUG=true is set, console.error and console.warn output is captured to a debug.log file in the app data directory. The log file is automatically truncated to ~4 MB on startup if it exceeds 5 MB, preventing unbounded disk usage over time. ([#13691](https://github.com/mastra-ai/mastra/pull/13691))

- Updated dependencies [[`504fc8b`](https://github.com/mastra-ai/mastra/commit/504fc8b9d0ddab717577ad3bf9c95ea4bd5377bd), [`f9c150b`](https://github.com/mastra-ai/mastra/commit/f9c150b7595ad05ad9cc9a11098e2944361e8c22), [`88de7e8`](https://github.com/mastra-ai/mastra/commit/88de7e8dfe4b7e1951a9e441bb33136e705ce24e), [`88de7e8`](https://github.com/mastra-ai/mastra/commit/88de7e8dfe4b7e1951a9e441bb33136e705ce24e), [`88de7e8`](https://github.com/mastra-ai/mastra/commit/88de7e8dfe4b7e1951a9e441bb33136e705ce24e), [`edee4b3`](https://github.com/mastra-ai/mastra/commit/edee4b37dff0af515fc7cc0e8d71ee39e6a762f0), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`3790c75`](https://github.com/mastra-ai/mastra/commit/3790c7578cc6a47d854eb12d89e6b1912867fe29), [`e7a235b`](https://github.com/mastra-ai/mastra/commit/e7a235be6472e0c870ed6c791ddb17c492dc188b), [`d51d298`](https://github.com/mastra-ai/mastra/commit/d51d298953967aab1f58ec965b644d109214f085), [`6dbeeb9`](https://github.com/mastra-ai/mastra/commit/6dbeeb94a8b1eebb727300d1a98961f882180794), [`d5f0d8d`](https://github.com/mastra-ai/mastra/commit/d5f0d8d6a03e515ddaa9b5da19b7e44b8357b07b), [`09c3b18`](https://github.com/mastra-ai/mastra/commit/09c3b1802ff14e243a8a8baea327440bc8cc2e32), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`85c84eb`](https://github.com/mastra-ai/mastra/commit/85c84ebb78aebfcba9d209c8e152b16d7a00cb71), [`a89272a`](https://github.com/mastra-ai/mastra/commit/a89272a5d71939b9fcd284e6a6dc1dd091a6bdcf), [`ee9c8df`](https://github.com/mastra-ai/mastra/commit/ee9c8df644f19d055af5f496bf4942705f5a47b7), [`77b4a25`](https://github.com/mastra-ai/mastra/commit/77b4a254e51907f8ff3a3ba95596a18e93ae4b35), [`276246e`](https://github.com/mastra-ai/mastra/commit/276246e0b9066a1ea48bbc70df84dbe528daaf99), [`08ecfdb`](https://github.com/mastra-ai/mastra/commit/08ecfdbdad6fb8285deef86a034bdf4a6047cfca), [`d5f628c`](https://github.com/mastra-ai/mastra/commit/d5f628ca86c6f6f3ff1035d52f635df32dd81cab), [`24f7204`](https://github.com/mastra-ai/mastra/commit/24f72046eb35b47c75d36193af4fb817b588720d), [`359d687`](https://github.com/mastra-ai/mastra/commit/359d687527ab95a79e0ec0487dcecec8d9c7c7dc), [`524c0f3`](https://github.com/mastra-ai/mastra/commit/524c0f3c434c3d9d18f66338dcef383d6161b59c), [`961b7ba`](https://github.com/mastra-ai/mastra/commit/961b7baa2c61365e1ee1b33d2a5074102ee40a52), [`c18a0e9`](https://github.com/mastra-ai/mastra/commit/c18a0e9cef1e4ca004b2963d35e4cfc031971eac), [`4bd21ea`](https://github.com/mastra-ai/mastra/commit/4bd21ea43d44d0a0427414fc047577f9f0aa3bec), [`115a7a4`](https://github.com/mastra-ai/mastra/commit/115a7a47db5e9896fec12ae6507501adb9ec89bf), [`22a48ae`](https://github.com/mastra-ai/mastra/commit/22a48ae2513eb54d8d79dad361fddbca97a155e8), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9e77e8f`](https://github.com/mastra-ai/mastra/commit/9e77e8f0e823ef58cb448dd1f390fce987a101f3), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`7edf78f`](https://github.com/mastra-ai/mastra/commit/7edf78f80422c43e84585f08ba11df0d4d0b73c5), [`1c4221c`](https://github.com/mastra-ai/mastra/commit/1c4221cf6032ec98d0e094d4ee11da3e48490d96), [`d25b9ea`](https://github.com/mastra-ai/mastra/commit/d25b9eabd400167255a97b690ffbc4ee4097ded5), [`fe1ce5c`](https://github.com/mastra-ai/mastra/commit/fe1ce5c9211c03d561606fda95cbfe7df1d9a9b5), [`b03c0e0`](https://github.com/mastra-ai/mastra/commit/b03c0e0389a799523929a458b0509c9e4244d562), [`0a8366b`](https://github.com/mastra-ai/mastra/commit/0a8366b0a692fcdde56c4d526e4cf03c502ae4ac), [`56f2018`](https://github.com/mastra-ai/mastra/commit/56f2018cb38969c11933e815a5f70cf631d3964a), [`85664e9`](https://github.com/mastra-ai/mastra/commit/85664e9fd857320fbc245e301f764f45f66f32a3), [`bc79650`](https://github.com/mastra-ai/mastra/commit/bc796500c6e0334faa158a96077e3fb332274869), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`3a3a59e`](https://github.com/mastra-ai/mastra/commit/3a3a59e8ffaa6a985fe3d9a126a3f5ade11a6724), [`3108d4e`](https://github.com/mastra-ai/mastra/commit/3108d4e649c9fddbf03253a6feeb388a5fa9fa5a), [`0c33b2c`](https://github.com/mastra-ai/mastra/commit/0c33b2c9db537f815e1c59e2c898ffce2e395a79), [`191e5bd`](https://github.com/mastra-ai/mastra/commit/191e5bd29b82f5bda35243945790da7bc7b695c2), [`fde104d`](https://github.com/mastra-ai/mastra/commit/fde104da80935d6e0dd24327e86a51011fcb3173), [`f77cd94`](https://github.com/mastra-ai/mastra/commit/f77cd94c44eabed490384e7d19232a865e13214c), [`e8135c7`](https://github.com/mastra-ai/mastra/commit/e8135c7e300dac5040670eec7eab896ac6092e30), [`daca48f`](https://github.com/mastra-ai/mastra/commit/daca48f0fb17b7ae0b62a2ac40cf0e491b2fd0b7), [`257d14f`](https://github.com/mastra-ai/mastra/commit/257d14faca5931f2e4186fc165b6f0b1f915deee), [`352f25d`](https://github.com/mastra-ai/mastra/commit/352f25da316b24cdd5b410fd8dddf6a8b763da2a), [`93477d0`](https://github.com/mastra-ai/mastra/commit/93477d0769b8a13ea5ed73d508d967fb23eaeed9), [`31c78b3`](https://github.com/mastra-ai/mastra/commit/31c78b3eb28f58a8017f1dcc795c33214d87feac), [`0bc0720`](https://github.com/mastra-ai/mastra/commit/0bc07201095791858087cc56f353fcd65e87ab54), [`36516ac`](https://github.com/mastra-ai/mastra/commit/36516aca1021cbeb42e74751b46a2614101f37c8), [`e947652`](https://github.com/mastra-ai/mastra/commit/e9476527fdecb4449e54570e80dfaf8466901254), [`23b43dd`](https://github.com/mastra-ai/mastra/commit/23b43ddd0e3db05dee828c2733faa2496b7b0319), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`ec248f6`](https://github.com/mastra-ai/mastra/commit/ec248f6b56e8a037c066c49b2178e2507471d988)]:
  - @mastra/core@1.9.0-alpha.0
  - @mastra/libsql@1.6.3-alpha.0
  - @mastra/pg@1.7.1-alpha.0
  - @mastra/memory@1.6.0-alpha.0
  - @mastra/mcp@1.0.3-alpha.0

## 0.4.0

### Minor Changes

- Added light theme support and automatic terminal theme detection. Mastra Code now detects your terminal's color scheme and applies a matching dark or light theme. Use the new `/theme` slash command to switch between `auto`, `dark`, and `light` modes. The choice is persisted across sessions. You can also set the `MASTRA_THEME` environment variable to override the detected theme. ([#13487](https://github.com/mastra-ai/mastra/pull/13487))

  ```sh
  # Switch theme at runtime via slash command
  /theme auto    # detect from terminal background
  /theme dark    # force dark theme
  /theme light   # force light theme

  # Or override via environment variable
  MASTRA_THEME=light mastracode
  ```

- Added reasoning effort support for OpenAI Codex models. The `/think` command now controls the reasoning depth (off, low, medium, high, xhigh) sent to the Codex API via the `reasoningEffort` parameter. Without this, gpt-5.3-codex skips tool calls and narrates instead of acting. ([#13490](https://github.com/mastra-ai/mastra/pull/13490))

  **Other improvements:**
  - `/think` now shows an inline selector list when run without arguments, or accepts a level directly (e.g. `/think high`)
  - Dropped `minimal` level (was redundantly mapping to same API value as `low`)
  - Added `xhigh` level for GPT-5.2+ and Codex models
  - Provider-specific values (e.g. `none`, `xhigh`) shown next to labels when an OpenAI model is selected
  - Switching to an OpenAI model pack auto-enables reasoning at `low` if it was off
  - Updated default Codex model from gpt-5.2 to gpt-5.3
  - Shows a warning when the current model doesn't support reasoning

### Patch Changes

- Added Claude Max OAuth warning for Anthropic authentication ([#13505](https://github.com/mastra-ai/mastra/pull/13505))

  A warning now appears when authenticating with Anthropic via OAuth, alerting that using a Claude Max subscription through OAuth is a grey area that may violate Anthropic's Terms of Service.
  - During `/login` or onboarding: **Continue** proceeds with OAuth, **Cancel** returns to the provider selection screen.
  - At startup (when existing Anthropic OAuth credentials are detected and the warning has not been acknowledged): **Continue** keeps credentials, **Remove OAuth** logs out from Anthropic.
  - The startup warning only appears once — acknowledging it persists the choice in settings.

- Fixed `/skills` so it lists skills even before the first message is sent. ([#13457](https://github.com/mastra-ai/mastra/pull/13457))

- Fixed `@` file autocomplete so fuzzy file search works when `fd` or `fdfind` is installed. ([#13460](https://github.com/mastra-ai/mastra/pull/13460))

- Fixed onboarding to allow API-key-only setup without requiring OAuth login. Previously, users with API keys configured as environment variables were blocked at the model pack selection step if they skipped OAuth login during onboarding. The auth step now clearly indicates that OAuth is optional when API keys are set. ([#13500](https://github.com/mastra-ai/mastra/pull/13500))

- Updated default observational memory settings: bufferTokens 1/5, bufferActivation 2000, blockAfter 2. ([#13476](https://github.com/mastra-ai/mastra/pull/13476))

- Fixed a fatal crash on startup that caused the TUI to fail immediately on launch. ([#13503](https://github.com/mastra-ai/mastra/pull/13503))

- Fixed stale git branch in system prompt and TUI status bar. The branch is now refreshed on every agent request and when switching threads, so both the system prompt and status bar reflect the current branch. Also improved the status line to show abbreviated branch names instead of hiding the branch entirely when the name is too long. ([#13456](https://github.com/mastra-ai/mastra/pull/13456))

- Fixed Mastra Code TUI hook triggering so `Stop` runs on every `agent_end` reason (`complete`, `aborted`, `error`) and `UserPromptSubmit` runs before sending non-command user prompts with block handling. ([#13442](https://github.com/mastra-ai/mastra/pull/13442))

- Updated thinking-level labels in Mastra Code UI to be provider-aware for OpenAI models. ([#13490](https://github.com/mastra-ai/mastra/pull/13490))
  - `/think` and Settings now use shared label metadata
  - OpenAI models show provider-specific labels (for example, `Very High (xhigh)`)
  - Stored `thinkingLevel` values remain unchanged (`off`, `low`, `medium`, `high`, `xhigh`)

- Strengthened the Anthropic Claude Max OAuth warning language to explicitly call out account-ban risk and potential Terms of Service violations before users continue with OAuth. ([#13508](https://github.com/mastra-ai/mastra/pull/13508))

- Fixed slash command arguments being silently discarded when the command template doesn't use $ARGUMENTS or positional variables ($1, $2, etc.). Arguments are now appended to the output so the model can see what the user provided. ([#13493](https://github.com/mastra-ai/mastra/pull/13493))

- Updated dependencies [[`df170fd`](https://github.com/mastra-ai/mastra/commit/df170fd139b55f845bfd2de8488b16435bd3d0da), [`ae55343`](https://github.com/mastra-ai/mastra/commit/ae5534397fc006fd6eef3e4f80c235bcdc9289ef), [`b8621e2`](https://github.com/mastra-ai/mastra/commit/b8621e25e70cae69a9343353f878a9112493a2fe), [`c290cec`](https://github.com/mastra-ai/mastra/commit/c290cec5bf9107225de42942b56b487107aa9dce), [`c290cec`](https://github.com/mastra-ai/mastra/commit/c290cec5bf9107225de42942b56b487107aa9dce), [`f03e794`](https://github.com/mastra-ai/mastra/commit/f03e794630f812b56e95aad54f7b1993dc003add), [`aa4a5ae`](https://github.com/mastra-ai/mastra/commit/aa4a5aedb80d8d6837bab8cbb2e301215d1ba3e9), [`de3f584`](https://github.com/mastra-ai/mastra/commit/de3f58408752a8d80a295275c7f23fc306cf7f4f), [`74ae019`](https://github.com/mastra-ai/mastra/commit/74ae0197a6895f8897c369038c643d7e32dd84c2), [`d3fb010`](https://github.com/mastra-ai/mastra/commit/d3fb010c98f575f1c0614452667396e2653815f6), [`702ee1c`](https://github.com/mastra-ai/mastra/commit/702ee1c41be67cc532b4dbe89bcb62143508f6f0), [`f495051`](https://github.com/mastra-ai/mastra/commit/f495051eb6496a720f637fc85b6d69941c12554c), [`60b45e0`](https://github.com/mastra-ai/mastra/commit/60b45e0af29485c69f70f77b15d6643aaa5a9da7), [`e622f1d`](https://github.com/mastra-ai/mastra/commit/e622f1d3ab346a8e6aca6d1fe2eac99bd961e50b), [`861f111`](https://github.com/mastra-ai/mastra/commit/861f11189211b20ddb70d8df81a6b901fc78d11e), [`00f43e8`](https://github.com/mastra-ai/mastra/commit/00f43e8e97a80c82b27d5bd30494f10a715a1df9), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`96a1702`](https://github.com/mastra-ai/mastra/commit/96a1702ce362c50dda20c8b4a228b4ad1a36a17a), [`cb9f921`](https://github.com/mastra-ai/mastra/commit/cb9f921320913975657abb1404855d8c510f7ac5), [`114e7c1`](https://github.com/mastra-ai/mastra/commit/114e7c146ac682925f0fb37376c1be70e5d6e6e5), [`cb9f921`](https://github.com/mastra-ai/mastra/commit/cb9f921320913975657abb1404855d8c510f7ac5), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`c290cec`](https://github.com/mastra-ai/mastra/commit/c290cec5bf9107225de42942b56b487107aa9dce), [`72df4a8`](https://github.com/mastra-ai/mastra/commit/72df4a8f9bf1a20cfd3d9006a4fdb597ad56d10a)]:
  - @mastra/core@1.8.0
  - @mastra/mcp@1.0.2
  - @mastra/pg@1.7.0
  - @mastra/libsql@1.6.2
  - @mastra/memory@1.5.2

## 0.4.0-alpha.0

### Minor Changes

- Added light theme support and automatic terminal theme detection. Mastra Code now detects your terminal's color scheme and applies a matching dark or light theme. Use the new `/theme` slash command to switch between `auto`, `dark`, and `light` modes. The choice is persisted across sessions. You can also set the `MASTRA_THEME` environment variable to override the detected theme. ([#13487](https://github.com/mastra-ai/mastra/pull/13487))

  ```sh
  # Switch theme at runtime via slash command
  /theme auto    # detect from terminal background
  /theme dark    # force dark theme
  /theme light   # force light theme

  # Or override via environment variable
  MASTRA_THEME=light mastracode
  ```

- Added reasoning effort support for OpenAI Codex models. The `/think` command now controls the reasoning depth (off, low, medium, high, xhigh) sent to the Codex API via the `reasoningEffort` parameter. Without this, gpt-5.3-codex skips tool calls and narrates instead of acting. ([#13490](https://github.com/mastra-ai/mastra/pull/13490))

  **Other improvements:**
  - `/think` now shows an inline selector list when run without arguments, or accepts a level directly (e.g. `/think high`)
  - Dropped `minimal` level (was redundantly mapping to same API value as `low`)
  - Added `xhigh` level for GPT-5.2+ and Codex models
  - Provider-specific values (e.g. `none`, `xhigh`) shown next to labels when an OpenAI model is selected
  - Switching to an OpenAI model pack auto-enables reasoning at `low` if it was off
  - Updated default Codex model from gpt-5.2 to gpt-5.3
  - Shows a warning when the current model doesn't support reasoning

### Patch Changes

- Added Claude Max OAuth warning for Anthropic authentication ([#13505](https://github.com/mastra-ai/mastra/pull/13505))

  A warning now appears when authenticating with Anthropic via OAuth, alerting that using a Claude Max subscription through OAuth is a grey area that may violate Anthropic's Terms of Service.
  - During `/login` or onboarding: **Continue** proceeds with OAuth, **Cancel** returns to the provider selection screen.
  - At startup (when existing Anthropic OAuth credentials are detected and the warning has not been acknowledged): **Continue** keeps credentials, **Remove OAuth** logs out from Anthropic.
  - The startup warning only appears once — acknowledging it persists the choice in settings.

- Fixed `/skills` so it lists skills even before the first message is sent. ([#13457](https://github.com/mastra-ai/mastra/pull/13457))

- Fixed `@` file autocomplete so fuzzy file search works when `fd` or `fdfind` is installed. ([#13460](https://github.com/mastra-ai/mastra/pull/13460))

- Fixed onboarding to allow API-key-only setup without requiring OAuth login. Previously, users with API keys configured as environment variables were blocked at the model pack selection step if they skipped OAuth login during onboarding. The auth step now clearly indicates that OAuth is optional when API keys are set. ([#13500](https://github.com/mastra-ai/mastra/pull/13500))

- Updated default observational memory settings: bufferTokens 1/5, bufferActivation 2000, blockAfter 2. ([#13476](https://github.com/mastra-ai/mastra/pull/13476))

- Fixed a fatal crash on startup that caused the TUI to fail immediately on launch. ([#13503](https://github.com/mastra-ai/mastra/pull/13503))

- Fixed stale git branch in system prompt and TUI status bar. The branch is now refreshed on every agent request and when switching threads, so both the system prompt and status bar reflect the current branch. Also improved the status line to show abbreviated branch names instead of hiding the branch entirely when the name is too long. ([#13456](https://github.com/mastra-ai/mastra/pull/13456))

- Fixed Mastra Code TUI hook triggering so `Stop` runs on every `agent_end` reason (`complete`, `aborted`, `error`) and `UserPromptSubmit` runs before sending non-command user prompts with block handling. ([#13442](https://github.com/mastra-ai/mastra/pull/13442))

- Updated thinking-level labels in Mastra Code UI to be provider-aware for OpenAI models. ([#13490](https://github.com/mastra-ai/mastra/pull/13490))
  - `/think` and Settings now use shared label metadata
  - OpenAI models show provider-specific labels (for example, `Very High (xhigh)`)
  - Stored `thinkingLevel` values remain unchanged (`off`, `low`, `medium`, `high`, `xhigh`)

- Strengthened the Anthropic Claude Max OAuth warning language to explicitly call out account-ban risk and potential Terms of Service violations before users continue with OAuth. ([#13508](https://github.com/mastra-ai/mastra/pull/13508))

- Fixed slash command arguments being silently discarded when the command template doesn't use $ARGUMENTS or positional variables ($1, $2, etc.). Arguments are now appended to the output so the model can see what the user provided. ([#13493](https://github.com/mastra-ai/mastra/pull/13493))

- Updated dependencies [[`df170fd`](https://github.com/mastra-ai/mastra/commit/df170fd139b55f845bfd2de8488b16435bd3d0da), [`ae55343`](https://github.com/mastra-ai/mastra/commit/ae5534397fc006fd6eef3e4f80c235bcdc9289ef), [`b8621e2`](https://github.com/mastra-ai/mastra/commit/b8621e25e70cae69a9343353f878a9112493a2fe), [`c290cec`](https://github.com/mastra-ai/mastra/commit/c290cec5bf9107225de42942b56b487107aa9dce), [`c290cec`](https://github.com/mastra-ai/mastra/commit/c290cec5bf9107225de42942b56b487107aa9dce), [`f03e794`](https://github.com/mastra-ai/mastra/commit/f03e794630f812b56e95aad54f7b1993dc003add), [`aa4a5ae`](https://github.com/mastra-ai/mastra/commit/aa4a5aedb80d8d6837bab8cbb2e301215d1ba3e9), [`de3f584`](https://github.com/mastra-ai/mastra/commit/de3f58408752a8d80a295275c7f23fc306cf7f4f), [`74ae019`](https://github.com/mastra-ai/mastra/commit/74ae0197a6895f8897c369038c643d7e32dd84c2), [`d3fb010`](https://github.com/mastra-ai/mastra/commit/d3fb010c98f575f1c0614452667396e2653815f6), [`702ee1c`](https://github.com/mastra-ai/mastra/commit/702ee1c41be67cc532b4dbe89bcb62143508f6f0), [`f495051`](https://github.com/mastra-ai/mastra/commit/f495051eb6496a720f637fc85b6d69941c12554c), [`60b45e0`](https://github.com/mastra-ai/mastra/commit/60b45e0af29485c69f70f77b15d6643aaa5a9da7), [`e622f1d`](https://github.com/mastra-ai/mastra/commit/e622f1d3ab346a8e6aca6d1fe2eac99bd961e50b), [`861f111`](https://github.com/mastra-ai/mastra/commit/861f11189211b20ddb70d8df81a6b901fc78d11e), [`00f43e8`](https://github.com/mastra-ai/mastra/commit/00f43e8e97a80c82b27d5bd30494f10a715a1df9), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`96a1702`](https://github.com/mastra-ai/mastra/commit/96a1702ce362c50dda20c8b4a228b4ad1a36a17a), [`cb9f921`](https://github.com/mastra-ai/mastra/commit/cb9f921320913975657abb1404855d8c510f7ac5), [`114e7c1`](https://github.com/mastra-ai/mastra/commit/114e7c146ac682925f0fb37376c1be70e5d6e6e5), [`cb9f921`](https://github.com/mastra-ai/mastra/commit/cb9f921320913975657abb1404855d8c510f7ac5), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`c290cec`](https://github.com/mastra-ai/mastra/commit/c290cec5bf9107225de42942b56b487107aa9dce), [`72df4a8`](https://github.com/mastra-ai/mastra/commit/72df4a8f9bf1a20cfd3d9006a4fdb597ad56d10a)]:
  - @mastra/core@1.8.0-alpha.0
  - @mastra/mcp@1.0.2-alpha.0
  - @mastra/pg@1.7.0-alpha.0
  - @mastra/libsql@1.6.2-alpha.0
  - @mastra/memory@1.5.2-alpha.0

## 0.3.0

### Minor Changes

- Added interactive onboarding flow for first-time setup ([#13421](https://github.com/mastra-ai/mastra/pull/13421))

  **Setup wizard** — On first launch, an interactive wizard guides you through:
  - Authenticating with AI providers (Claude Max, OpenAI Codex)
  - Choosing a model pack (Varied, Anthropic, OpenAI, or Custom)
  - Selecting an observational memory model
  - Enabling or disabling YOLO mode (auto-approve tool calls)

  **Global settings** — Your preferences are now saved to `settings.json` in the app data directory and automatically applied to new threads. Model pack selections reference pack IDs so you get new model versions automatically.

  **Custom model packs** — Choose "Custom" to pick a specific model for each mode (plan/build/fast). Saved custom packs appear when re-running `/setup`.

  **`/setup` command** — Re-run the setup wizard anytime. Previously chosen options are highlighted with "(current)" indicators.

  **Settings migration** — Model-related data previously stored in `auth.json` (`_modelRanks`, `_modeModelId_*`, `_subagentModelId*`) is automatically migrated to `settings.json` on first load.

- Added storage backend configuration to `/settings` with PostgreSQL opt-in and remote LibSQL support. ([#13435](https://github.com/mastra-ai/mastra/pull/13435))

  **Selecting a backend**

  Switch storage backends through the `/settings` command (Storage backend option) or by setting the `MASTRA_STORAGE_BACKEND` environment variable. LibSQL remains the default — no changes needed for existing setups. Both backends prompt for a connection URL interactively after selection.

  **Remote LibSQL (Turso)**

  Select LibSQL in `/settings` and enter a remote Turso URL (e.g. `libsql://your-db.turso.io`). Leave empty to keep the default local file database. Can also be set via environment variable:

  ```sh
  export MASTRA_DB_URL="libsql://your-db.turso.io"
  export MASTRA_DB_AUTH_TOKEN="your-token"
  ```

  **PostgreSQL configuration**

  Select PostgreSQL in `/settings` and enter a connection string, or configure via environment variables:

  ```sh
  export MASTRA_STORAGE_BACKEND=pg
  export MASTRA_PG_CONNECTION_STRING="postgresql://user:pass@localhost:5432/db"
  ```

  If the PostgreSQL connection fails on startup, mastracode falls back to the local LibSQL database and shows a warning so you can fix the connection via `/settings`.

  Optional PostgreSQL settings include `schemaName`, `disableInit`, and `skipDefaultIndexes`.

- Added model name to Co-Authored-By in commit messages. Commits now include the active model (e.g. `Co-Authored-By: Mastra Code (anthropic/claude-opus-4-6) <noreply@mastra.ai>`) for traceability when switching between models. Falls back to the original static format when no model is set. ([#13376](https://github.com/mastra-ai/mastra/pull/13376))

### Patch Changes

- Fixed plan mode agent to properly call submit_plan tool. The agent was generating text descriptions instead of calling the tool. Fixed by: creating dynamic mode-specific tool guidance with correct tool names, clarifying tool vs text usage with explicit exceptions for communication tools, and strengthening submit_plan call instructions with urgent language and code examples. ([#13416](https://github.com/mastra-ai/mastra/pull/13416))

- Updated `/cost` and `/diff` commands to read token usage, memory progress, and modified files from the Harness display state instead of maintaining separate local copies. Moved shared type definitions (`OMProgressState`, `OMStatus`, `OMBufferedStatus`) to `@mastra/core/harness` and re-exported them for backward compatibility. ([#13427](https://github.com/mastra-ai/mastra/pull/13427))

- Exclude hidden files from directory listings ([#13384](https://github.com/mastra-ai/mastra/pull/13384))

- Consolidated keyboard shortcuts and commands into a `/help` overlay. The header now shows a compact hint line (`⇧Tab mode · /help info & shortcuts`) instead of 3 lines of keybinding instructions. Running `/help` opens a styled overlay with all commands and shortcuts. ([#13426](https://github.com/mastra-ai/mastra/pull/13426))

- Improved TUI maintainability by modularizing the main TUI class into focused modules: event handlers, command dispatchers, status line rendering, message rendering, error display, shell passthrough, and setup logic. Reduced the main TUI file from ~4,760 lines to 449 lines with no changes to user-facing behavior. ([#13413](https://github.com/mastra-ai/mastra/pull/13413))

- Added styled ASCII art banner header to the TUI with purple gradient and project frontmatter display. The banner shows "MASTRA CODE" in block letters for wide terminals, "MASTRA" for medium terminals, and falls back to a compact single line for narrow terminals. Project info (name, resource ID, branch, user) now renders inside the TUI header instead of via console.info before startup. ([#13422](https://github.com/mastra-ai/mastra/pull/13422))

- LSP now shows correct diagnostics for TypeScript and JavaScript files ([#13385](https://github.com/mastra-ai/mastra/pull/13385))

- Updated dependencies [[`551dc24`](https://github.com/mastra-ai/mastra/commit/551dc2445ffb6efa05eb268e8ab700bcd34ed39c), [`e8afc44`](https://github.com/mastra-ai/mastra/commit/e8afc44a41f24ffe8b8ae4a5ee27cfddbe7934a6), [`24284ff`](https://github.com/mastra-ai/mastra/commit/24284ffae306ddf0ab83273e13f033520839ef40), [`f5097cc`](https://github.com/mastra-ai/mastra/commit/f5097cc8a813c82c3378882c31178320cadeb655), [`71e237f`](https://github.com/mastra-ai/mastra/commit/71e237fa852a3ad9a50a3ddb3b5f3b20b9a8181c), [`c2e02f1`](https://github.com/mastra-ai/mastra/commit/c2e02f181843cbda8db6fd893adce85edc0f8742), [`13a291e`](https://github.com/mastra-ai/mastra/commit/13a291ebb9f9bca80befa0d9166b916bb348e8e9), [`397af5a`](https://github.com/mastra-ai/mastra/commit/397af5a69f34d4157f51a7c8da3f1ded1e1d611c), [`d4701f7`](https://github.com/mastra-ai/mastra/commit/d4701f7e24822b081b70f9c806c39411b1a712e7), [`2b40831`](https://github.com/mastra-ai/mastra/commit/2b40831dcca2275c9570ddf09b7f25ba3e8dc7fc), [`6184727`](https://github.com/mastra-ai/mastra/commit/6184727e812bf7a65cee209bacec3a2f5a16e923), [`0c338b8`](https://github.com/mastra-ai/mastra/commit/0c338b87362dcd95ff8191ca00df645b6953f534), [`6f6385b`](https://github.com/mastra-ai/mastra/commit/6f6385be5b33687cd21e71fc27e972e6928bb34c), [`14aba61`](https://github.com/mastra-ai/mastra/commit/14aba61b9cff76d72bc7ef6f3a83ae2c5d059193), [`dd9dd1c`](https://github.com/mastra-ai/mastra/commit/dd9dd1c9ae32ae79093f8c4adde1732ac6357233)]:
  - @mastra/libsql@1.6.1
  - @mastra/pg@1.6.1
  - @mastra/memory@1.5.1
  - @mastra/core@1.7.0

## 0.3.0-alpha.0

### Minor Changes

- Added interactive onboarding flow for first-time setup ([#13421](https://github.com/mastra-ai/mastra/pull/13421))

  **Setup wizard** — On first launch, an interactive wizard guides you through:
  - Authenticating with AI providers (Claude Max, OpenAI Codex)
  - Choosing a model pack (Varied, Anthropic, OpenAI, or Custom)
  - Selecting an observational memory model
  - Enabling or disabling YOLO mode (auto-approve tool calls)

  **Global settings** — Your preferences are now saved to `settings.json` in the app data directory and automatically applied to new threads. Model pack selections reference pack IDs so you get new model versions automatically.

  **Custom model packs** — Choose "Custom" to pick a specific model for each mode (plan/build/fast). Saved custom packs appear when re-running `/setup`.

  **`/setup` command** — Re-run the setup wizard anytime. Previously chosen options are highlighted with "(current)" indicators.

  **Settings migration** — Model-related data previously stored in `auth.json` (`_modelRanks`, `_modeModelId_*`, `_subagentModelId*`) is automatically migrated to `settings.json` on first load.

- Added storage backend configuration to `/settings` with PostgreSQL opt-in and remote LibSQL support. ([#13435](https://github.com/mastra-ai/mastra/pull/13435))

  **Selecting a backend**

  Switch storage backends through the `/settings` command (Storage backend option) or by setting the `MASTRA_STORAGE_BACKEND` environment variable. LibSQL remains the default — no changes needed for existing setups. Both backends prompt for a connection URL interactively after selection.

  **Remote LibSQL (Turso)**

  Select LibSQL in `/settings` and enter a remote Turso URL (e.g. `libsql://your-db.turso.io`). Leave empty to keep the default local file database. Can also be set via environment variable:

  ```sh
  export MASTRA_DB_URL="libsql://your-db.turso.io"
  export MASTRA_DB_AUTH_TOKEN="your-token"
  ```

  **PostgreSQL configuration**

  Select PostgreSQL in `/settings` and enter a connection string, or configure via environment variables:

  ```sh
  export MASTRA_STORAGE_BACKEND=pg
  export MASTRA_PG_CONNECTION_STRING="postgresql://user:pass@localhost:5432/db"
  ```

  If the PostgreSQL connection fails on startup, mastracode falls back to the local LibSQL database and shows a warning so you can fix the connection via `/settings`.

  Optional PostgreSQL settings include `schemaName`, `disableInit`, and `skipDefaultIndexes`.

- Added model name to Co-Authored-By in commit messages. Commits now include the active model (e.g. `Co-Authored-By: Mastra Code (anthropic/claude-opus-4-6) <noreply@mastra.ai>`) for traceability when switching between models. Falls back to the original static format when no model is set. ([#13376](https://github.com/mastra-ai/mastra/pull/13376))

### Patch Changes

- Fixed plan mode agent to properly call submit_plan tool. The agent was generating text descriptions instead of calling the tool. Fixed by: creating dynamic mode-specific tool guidance with correct tool names, clarifying tool vs text usage with explicit exceptions for communication tools, and strengthening submit_plan call instructions with urgent language and code examples. ([#13416](https://github.com/mastra-ai/mastra/pull/13416))

- Updated `/cost` and `/diff` commands to read token usage, memory progress, and modified files from the Harness display state instead of maintaining separate local copies. Moved shared type definitions (`OMProgressState`, `OMStatus`, `OMBufferedStatus`) to `@mastra/core/harness` and re-exported them for backward compatibility. ([#13427](https://github.com/mastra-ai/mastra/pull/13427))

- Exclude hidden files from directory listings ([#13384](https://github.com/mastra-ai/mastra/pull/13384))

- Consolidated keyboard shortcuts and commands into a `/help` overlay. The header now shows a compact hint line (`⇧Tab mode · /help info & shortcuts`) instead of 3 lines of keybinding instructions. Running `/help` opens a styled overlay with all commands and shortcuts. ([#13426](https://github.com/mastra-ai/mastra/pull/13426))

- Improved TUI maintainability by modularizing the main TUI class into focused modules: event handlers, command dispatchers, status line rendering, message rendering, error display, shell passthrough, and setup logic. Reduced the main TUI file from ~4,760 lines to 449 lines with no changes to user-facing behavior. ([#13413](https://github.com/mastra-ai/mastra/pull/13413))

- Added styled ASCII art banner header to the TUI with purple gradient and project frontmatter display. The banner shows "MASTRA CODE" in block letters for wide terminals, "MASTRA" for medium terminals, and falls back to a compact single line for narrow terminals. Project info (name, resource ID, branch, user) now renders inside the TUI header instead of via console.info before startup. ([#13422](https://github.com/mastra-ai/mastra/pull/13422))

- LSP now shows correct diagnostics for TypeScript and JavaScript files ([#13385](https://github.com/mastra-ai/mastra/pull/13385))

- Updated dependencies [[`551dc24`](https://github.com/mastra-ai/mastra/commit/551dc2445ffb6efa05eb268e8ab700bcd34ed39c), [`e8afc44`](https://github.com/mastra-ai/mastra/commit/e8afc44a41f24ffe8b8ae4a5ee27cfddbe7934a6), [`24284ff`](https://github.com/mastra-ai/mastra/commit/24284ffae306ddf0ab83273e13f033520839ef40), [`f5097cc`](https://github.com/mastra-ai/mastra/commit/f5097cc8a813c82c3378882c31178320cadeb655), [`71e237f`](https://github.com/mastra-ai/mastra/commit/71e237fa852a3ad9a50a3ddb3b5f3b20b9a8181c), [`c2e02f1`](https://github.com/mastra-ai/mastra/commit/c2e02f181843cbda8db6fd893adce85edc0f8742), [`13a291e`](https://github.com/mastra-ai/mastra/commit/13a291ebb9f9bca80befa0d9166b916bb348e8e9), [`397af5a`](https://github.com/mastra-ai/mastra/commit/397af5a69f34d4157f51a7c8da3f1ded1e1d611c), [`d4701f7`](https://github.com/mastra-ai/mastra/commit/d4701f7e24822b081b70f9c806c39411b1a712e7), [`2b40831`](https://github.com/mastra-ai/mastra/commit/2b40831dcca2275c9570ddf09b7f25ba3e8dc7fc), [`6184727`](https://github.com/mastra-ai/mastra/commit/6184727e812bf7a65cee209bacec3a2f5a16e923), [`6f6385b`](https://github.com/mastra-ai/mastra/commit/6f6385be5b33687cd21e71fc27e972e6928bb34c), [`14aba61`](https://github.com/mastra-ai/mastra/commit/14aba61b9cff76d72bc7ef6f3a83ae2c5d059193), [`dd9dd1c`](https://github.com/mastra-ai/mastra/commit/dd9dd1c9ae32ae79093f8c4adde1732ac6357233)]:
  - @mastra/libsql@1.6.1-alpha.0
  - @mastra/pg@1.6.1-alpha.0
  - @mastra/memory@1.5.1-alpha.0
  - @mastra/core@1.7.0-alpha.0

## 0.2.0

### Minor Changes

- Added streaming tool argument previews across all tool renderers. Tool names, file paths, and commands now appear immediately as the model generates them, rather than waiting for the complete tool call. ([#13328](https://github.com/mastra-ai/mastra/pull/13328))
  - **Generic tools** show live key/value argument previews as args stream in
  - **Edit tool** renders a bordered diff preview as soon as `old_str` and `new_str` are available, even before the tool result arrives
  - **Write tool** streams syntax-highlighted file content in a bordered box while args arrive
  - **Find files** shows the glob pattern in the pending header
  - **Task write** streams items directly into the pinned task list component in real-time

  All tools use partial JSON parsing to progressively display argument information. This is enabled automatically for all Harness-based agents — no configuration required.

### Patch Changes

- Improved subagent usage guidance: subagents are now only recommended when spawning multiple in parallel, and the main agent must verify all subagent output before proceeding. ([#13339](https://github.com/mastra-ai/mastra/pull/13339))

- Updated TUI to work with the new Harness object-parameter API, ensuring all commands, approvals, and thread flows continue to function correctly. ([#13353](https://github.com/mastra-ai/mastra/pull/13353))

- Added audit-tests subagent that reviews test quality in a branch. The parent agent passes a description of the branch work along with changed files to this read-only subagent, which explores existing test conventions then audits for behavioral coverage, intent-vs-test alignment, LLM-generated test slop, redundant assertions, file organization, and missing edge cases. ([#13331](https://github.com/mastra-ai/mastra/pull/13331))

- Fixed the `/mcp` slash command always showing "MCP system not initialized" even when MCP servers were configured and working. Server status and `/mcp reload` now work as expected. ([#13311](https://github.com/mastra-ai/mastra/pull/13311))

- Improved Observational Memory activation timing by halving the buffer interval when approaching the activation threshold, producing finer-grained chunks for more precise context management. ([#13357](https://github.com/mastra-ai/mastra/pull/13357))

- Fixed stale OAuth credentials when resolving the OpenAI Codex model. Auth storage is now reloaded before each model resolution, preventing authentication failures after token refresh. ([#13307](https://github.com/mastra-ai/mastra/pull/13307))

- Improved TUI composability for external consumers by exposing a structured `TUIState` interface and `createTUIState` factory. ([#13350](https://github.com/mastra-ai/mastra/pull/13350))

- Added AGENTS.md to the instruction file loader so projects created by create-mastra are automatically picked up. Removed support for the deprecated AGENT.md (singular) convention. ([#13346](https://github.com/mastra-ai/mastra/pull/13346))

- Fixed an issue where memory activation could shrink the message window too aggressively due to a token counting inaccuracy, resulting in very small context windows (~300 tokens). Temporarily raised the buffer activation threshold to prevent this. ([#13349](https://github.com/mastra-ai/mastra/pull/13349))

- Fixed assistant message text disappearing when todo_write tool calls were made during streaming ([#13335](https://github.com/mastra-ai/mastra/pull/13335))

- Fixed the view tool to gracefully handle view_range when viewing directories. Previously, passing view_range with a directory path would throw an error, and passing undefined values would fail schema validation. Now, view_range slices the directory listing to show a subset of entries, enabling pagination through large directories. ([#13355](https://github.com/mastra-ai/mastra/pull/13355))

- Updated README with current installation instructions for npm, pnpm, and Homebrew. ([#13294](https://github.com/mastra-ai/mastra/pull/13294))

- Simplified the MCP management API by replacing the `MCPManager` class with a `createMcpManager()` factory function. All existing behavior (TUI `/mcp` command, tool collection, config merging) is preserved. ([#13347](https://github.com/mastra-ai/mastra/pull/13347))

- **@mastra/core:** Added optional `threadLock` callbacks to `HarnessConfig` for preventing concurrent thread access across processes. The Harness calls `acquire`/`release` during `selectOrCreateThread`, `createThread`, and `switchThread` when configured. Locking is opt-in — when `threadLock` is not provided, behavior is unchanged. ([#13334](https://github.com/mastra-ai/mastra/pull/13334))

  ```ts
  const harness = new Harness({
    id: 'my-harness',
    storage: myStore,
    modes: [{ id: 'default', agent: myAgent }],
    threadLock: {
      acquire: threadId => acquireThreadLock(threadId),
      release: threadId => releaseThreadLock(threadId),
    },
  });
  ```

  **mastracode:** Wires the existing filesystem-based thread lock (`thread-lock.ts`) into the new `threadLock` config, restoring the concurrent access protection that was lost during the monorepo migration.

- Migrated from todo_write/todo_check tools to the new built-in task_write/task_check tools from @mastra/core/harness. Renamed all todo terminology to task across prompts, TUI components, and agent configurations. ([#13344](https://github.com/mastra-ai/mastra/pull/13344))

- Fixed Observational Memory status not updating during conversations. The harness was missing streaming handlers for OM data chunks (status, observation start/end, buffering, activation), so the TUI never received real-time OM progress updates. Also added switchObserverModel and switchReflectorModel methods so changing OM models properly emits events to subscribers. ([#13330](https://github.com/mastra-ai/mastra/pull/13330))

- Fixed Ctrl+F follow-up queueing to resolve autocomplete suggestions before reading editor text, so partially typed slash commands (e.g. /rev) are expanded to their full form (e.g. /review). Slash commands queued via Ctrl+F are now properly processed through the slash command handler after the agent finishes, instead of being sent as raw text to the LLM. ([#13345](https://github.com/mastra-ai/mastra/pull/13345))

- Reduced tool result token limits to prevent oversized responses. Lowered file view and grep token limits from 3,000 to 2,000 tokens. Added 2,000 token truncation to web search and web extract tools, which previously returned unbounded results. ([#13348](https://github.com/mastra-ai/mastra/pull/13348))

- Fixed thread resuming in git worktrees. Previously, starting mastracode in a new worktree would resume a thread from another worktree of the same repo. Threads are now auto-tagged with the project path and filtered on resume so each worktree gets its own thread scope. ([#13343](https://github.com/mastra-ai/mastra/pull/13343))

- Updated dependencies [[`5c70aeb`](https://github.com/mastra-ai/mastra/commit/5c70aeb391434c34f9e43caa2e8572d412bcb2b0), [`0d9efb4`](https://github.com/mastra-ai/mastra/commit/0d9efb47992c34aa90581c18b9f51f774f6252a5), [`5caa13d`](https://github.com/mastra-ai/mastra/commit/5caa13d1b2a496e2565ab124a11de9a51ad3e3b9), [`270dd16`](https://github.com/mastra-ai/mastra/commit/270dd168a86698a699d8a9de8dbce1a40f72d862), [`940163f`](https://github.com/mastra-ai/mastra/commit/940163fc492401d7562301e6f106ccef4fefe06f), [`5c70aeb`](https://github.com/mastra-ai/mastra/commit/5c70aeb391434c34f9e43caa2e8572d412bcb2b0), [`b260123`](https://github.com/mastra-ai/mastra/commit/b2601234bd093d358c92081a58f9b0befdae52b3), [`47892c8`](https://github.com/mastra-ai/mastra/commit/47892c85708eac348209f99f10f9a5f5267e11c0), [`45bb78b`](https://github.com/mastra-ai/mastra/commit/45bb78b70bd9db29678fe49476cd9f4ed01bfd0b), [`5c70aeb`](https://github.com/mastra-ai/mastra/commit/5c70aeb391434c34f9e43caa2e8572d412bcb2b0), [`70eef84`](https://github.com/mastra-ai/mastra/commit/70eef84b8f44493598fdafa2980a0e7283415eda), [`d84e52d`](https://github.com/mastra-ai/mastra/commit/d84e52d0f6511283ddd21ed5fe7f945449d0f799), [`24b80af`](https://github.com/mastra-ai/mastra/commit/24b80af87da93bb84d389340181e17b7477fa9ca), [`608e156`](https://github.com/mastra-ai/mastra/commit/608e156def954c9604c5e3f6d9dfce3bcc7aeab0), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`2b2e157`](https://github.com/mastra-ai/mastra/commit/2b2e157a092cd597d9d3f0000d62b8bb4a7348ed), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`59d30b5`](https://github.com/mastra-ai/mastra/commit/59d30b5d0cb44ea7a1c440e7460dfb57eac9a9b5), [`453693b`](https://github.com/mastra-ai/mastra/commit/453693bf9e265ddccecef901d50da6caaea0fbc6), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`c204b63`](https://github.com/mastra-ai/mastra/commit/c204b632d19e66acb6d6e19b11c4540dd6ad5380), [`742a417`](https://github.com/mastra-ai/mastra/commit/742a417896088220a3b5560c354c45c5ca6d88b9)]:
  - @mastra/libsql@1.6.0
  - @mastra/core@1.6.0
  - @mastra/memory@1.5.0

## 0.2.0-alpha.0

### Minor Changes

- Added streaming tool argument previews across all tool renderers. Tool names, file paths, and commands now appear immediately as the model generates them, rather than waiting for the complete tool call. ([#13328](https://github.com/mastra-ai/mastra/pull/13328))
  - **Generic tools** show live key/value argument previews as args stream in
  - **Edit tool** renders a bordered diff preview as soon as `old_str` and `new_str` are available, even before the tool result arrives
  - **Write tool** streams syntax-highlighted file content in a bordered box while args arrive
  - **Find files** shows the glob pattern in the pending header
  - **Task write** streams items directly into the pinned task list component in real-time

  All tools use partial JSON parsing to progressively display argument information. This is enabled automatically for all Harness-based agents — no configuration required.

### Patch Changes

- Improved subagent usage guidance: subagents are now only recommended when spawning multiple in parallel, and the main agent must verify all subagent output before proceeding. ([#13339](https://github.com/mastra-ai/mastra/pull/13339))

- Updated TUI to work with the new Harness object-parameter API, ensuring all commands, approvals, and thread flows continue to function correctly. ([#13353](https://github.com/mastra-ai/mastra/pull/13353))

- Added audit-tests subagent that reviews test quality in a branch. The parent agent passes a description of the branch work along with changed files to this read-only subagent, which explores existing test conventions then audits for behavioral coverage, intent-vs-test alignment, LLM-generated test slop, redundant assertions, file organization, and missing edge cases. ([#13331](https://github.com/mastra-ai/mastra/pull/13331))

- Fixed the `/mcp` slash command always showing "MCP system not initialized" even when MCP servers were configured and working. Server status and `/mcp reload` now work as expected. ([#13311](https://github.com/mastra-ai/mastra/pull/13311))

- Improved Observational Memory activation timing by halving the buffer interval when approaching the activation threshold, producing finer-grained chunks for more precise context management. ([#13357](https://github.com/mastra-ai/mastra/pull/13357))

- Fixed stale OAuth credentials when resolving the OpenAI Codex model. Auth storage is now reloaded before each model resolution, preventing authentication failures after token refresh. ([#13307](https://github.com/mastra-ai/mastra/pull/13307))

- Improved TUI composability for external consumers by exposing a structured `TUIState` interface and `createTUIState` factory. ([#13350](https://github.com/mastra-ai/mastra/pull/13350))

- Added AGENTS.md to the instruction file loader so projects created by create-mastra are automatically picked up. Removed support for the deprecated AGENT.md (singular) convention. ([#13346](https://github.com/mastra-ai/mastra/pull/13346))

- Fixed an issue where memory activation could shrink the message window too aggressively due to a token counting inaccuracy, resulting in very small context windows (~300 tokens). Temporarily raised the buffer activation threshold to prevent this. ([#13349](https://github.com/mastra-ai/mastra/pull/13349))

- Fixed assistant message text disappearing when todo_write tool calls were made during streaming ([#13335](https://github.com/mastra-ai/mastra/pull/13335))

- Fixed the view tool to gracefully handle view_range when viewing directories. Previously, passing view_range with a directory path would throw an error, and passing undefined values would fail schema validation. Now, view_range slices the directory listing to show a subset of entries, enabling pagination through large directories. ([#13355](https://github.com/mastra-ai/mastra/pull/13355))

- Updated README with current installation instructions for npm, pnpm, and Homebrew. ([#13294](https://github.com/mastra-ai/mastra/pull/13294))

- Simplified the MCP management API by replacing the `MCPManager` class with a `createMcpManager()` factory function. All existing behavior (TUI `/mcp` command, tool collection, config merging) is preserved. ([#13347](https://github.com/mastra-ai/mastra/pull/13347))

- **@mastra/core:** Added optional `threadLock` callbacks to `HarnessConfig` for preventing concurrent thread access across processes. The Harness calls `acquire`/`release` during `selectOrCreateThread`, `createThread`, and `switchThread` when configured. Locking is opt-in — when `threadLock` is not provided, behavior is unchanged. ([#13334](https://github.com/mastra-ai/mastra/pull/13334))

  ```ts
  const harness = new Harness({
    id: 'my-harness',
    storage: myStore,
    modes: [{ id: 'default', agent: myAgent }],
    threadLock: {
      acquire: threadId => acquireThreadLock(threadId),
      release: threadId => releaseThreadLock(threadId),
    },
  });
  ```

  **mastracode:** Wires the existing filesystem-based thread lock (`thread-lock.ts`) into the new `threadLock` config, restoring the concurrent access protection that was lost during the monorepo migration.

- Migrated from todo_write/todo_check tools to the new built-in task_write/task_check tools from @mastra/core/harness. Renamed all todo terminology to task across prompts, TUI components, and agent configurations. ([#13344](https://github.com/mastra-ai/mastra/pull/13344))

- Fixed Observational Memory status not updating during conversations. The harness was missing streaming handlers for OM data chunks (status, observation start/end, buffering, activation), so the TUI never received real-time OM progress updates. Also added switchObserverModel and switchReflectorModel methods so changing OM models properly emits events to subscribers. ([#13330](https://github.com/mastra-ai/mastra/pull/13330))

- Fixed Ctrl+F follow-up queueing to resolve autocomplete suggestions before reading editor text, so partially typed slash commands (e.g. /rev) are expanded to their full form (e.g. /review). Slash commands queued via Ctrl+F are now properly processed through the slash command handler after the agent finishes, instead of being sent as raw text to the LLM. ([#13345](https://github.com/mastra-ai/mastra/pull/13345))

- Reduced tool result token limits to prevent oversized responses. Lowered file view and grep token limits from 3,000 to 2,000 tokens. Added 2,000 token truncation to web search and web extract tools, which previously returned unbounded results. ([#13348](https://github.com/mastra-ai/mastra/pull/13348))

- Fixed thread resuming in git worktrees. Previously, starting mastracode in a new worktree would resume a thread from another worktree of the same repo. Threads are now auto-tagged with the project path and filtered on resume so each worktree gets its own thread scope. ([#13343](https://github.com/mastra-ai/mastra/pull/13343))

- Updated dependencies [[`5c70aeb`](https://github.com/mastra-ai/mastra/commit/5c70aeb391434c34f9e43caa2e8572d412bcb2b0), [`0d9efb4`](https://github.com/mastra-ai/mastra/commit/0d9efb47992c34aa90581c18b9f51f774f6252a5), [`5caa13d`](https://github.com/mastra-ai/mastra/commit/5caa13d1b2a496e2565ab124a11de9a51ad3e3b9), [`270dd16`](https://github.com/mastra-ai/mastra/commit/270dd168a86698a699d8a9de8dbce1a40f72d862), [`940163f`](https://github.com/mastra-ai/mastra/commit/940163fc492401d7562301e6f106ccef4fefe06f), [`5c70aeb`](https://github.com/mastra-ai/mastra/commit/5c70aeb391434c34f9e43caa2e8572d412bcb2b0), [`b260123`](https://github.com/mastra-ai/mastra/commit/b2601234bd093d358c92081a58f9b0befdae52b3), [`47892c8`](https://github.com/mastra-ai/mastra/commit/47892c85708eac348209f99f10f9a5f5267e11c0), [`45bb78b`](https://github.com/mastra-ai/mastra/commit/45bb78b70bd9db29678fe49476cd9f4ed01bfd0b), [`5c70aeb`](https://github.com/mastra-ai/mastra/commit/5c70aeb391434c34f9e43caa2e8572d412bcb2b0), [`70eef84`](https://github.com/mastra-ai/mastra/commit/70eef84b8f44493598fdafa2980a0e7283415eda), [`d84e52d`](https://github.com/mastra-ai/mastra/commit/d84e52d0f6511283ddd21ed5fe7f945449d0f799), [`24b80af`](https://github.com/mastra-ai/mastra/commit/24b80af87da93bb84d389340181e17b7477fa9ca), [`608e156`](https://github.com/mastra-ai/mastra/commit/608e156def954c9604c5e3f6d9dfce3bcc7aeab0), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`2b2e157`](https://github.com/mastra-ai/mastra/commit/2b2e157a092cd597d9d3f0000d62b8bb4a7348ed), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`59d30b5`](https://github.com/mastra-ai/mastra/commit/59d30b5d0cb44ea7a1c440e7460dfb57eac9a9b5), [`453693b`](https://github.com/mastra-ai/mastra/commit/453693bf9e265ddccecef901d50da6caaea0fbc6), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`c204b63`](https://github.com/mastra-ai/mastra/commit/c204b632d19e66acb6d6e19b11c4540dd6ad5380), [`742a417`](https://github.com/mastra-ai/mastra/commit/742a417896088220a3b5560c354c45c5ca6d88b9)]:
  - @mastra/libsql@1.6.0-alpha.0
  - @mastra/core@1.6.0-alpha.0
  - @mastra/memory@1.5.0-alpha.0

## 0.1.0

### Minor Changes

- Added a separate export path for the TUI at `mastracode/tui`, so consumers can cleanly import MastraTUI and related components without reaching into internals. ([#13255](https://github.com/mastra-ai/mastra/pull/13255))

  ```ts
  import { MastraTUI, type MastraTUIOptions } from 'mastracode/tui';
  import { theme, setTheme, ModelSelectorComponent } from 'mastracode/tui';
  ```

- Migrated MastraCode from the prototype harness to the generic CoreHarness from @mastra/core. The createMastraCode function is now fully configurable with optional parameters for modes, subagents, storage, tools, and more. Removed the deprecated prototype harness implementation. ([#13245](https://github.com/mastra-ai/mastra/pull/13245))

### Patch Changes

- Added generic Harness class to @mastra/core for orchestrating agents with modes, state management, built-in tools (ask_user, submit_plan), subagent support, Observational Memory integration, model discovery, and permission-aware tool approval. The Harness provides a reusable foundation for building agent-powered applications with features like thread management, heartbeat monitoring, and event-driven architecture. ([#13245](https://github.com/mastra-ai/mastra/pull/13245))

- fix(schema-compat): fix zodToJsonSchema routing for v3/v4 Zod schemas ([#13253](https://github.com/mastra-ai/mastra/pull/13253))

  The `zodToJsonSchema` function now reliably detects and routes Zod v3 vs v4 schemas regardless of which version the ambient `zod` import resolves to. Previously, the detection relied on checking `'toJSONSchema' in z` against the ambient `z` import, which could resolve to either v3 or v4 depending on the environment (monorepo vs global install). This caused v3 schemas to be passed to v4's `toJSONSchema()` (crashing with "Cannot read properties of undefined (reading 'def')") or v4 schemas to be passed to the v3 converter (producing schemas missing the `type` field).

  The fix explicitly imports `z as zV4` from `zod/v4` and routes based on the schema's own `_zod` property, making the behavior environment-independent.

  Also migrates all mastracode tool files from `zod/v3` to `zod` imports now that the schema-compat fix supports both versions correctly.

- Fixed mastracode crashing on startup with ERR_MODULE_NOT_FOUND for vscode-jsonrpc/node. Node.js ESM requires explicit .js extensions on subpath imports. ([#13250](https://github.com/mastra-ai/mastra/pull/13250))

- Updated dependencies [[`252580a`](https://github.com/mastra-ai/mastra/commit/252580a71feb0e46d0ccab04a70a79ff6a2ee0ab), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`5c75261`](https://github.com/mastra-ai/mastra/commit/5c7526120d936757d4ffb7b82232e1641ebd45cb), [`e27d832`](https://github.com/mastra-ai/mastra/commit/e27d83281b5e166fd63a13969689e928d8605944), [`e37ef84`](https://github.com/mastra-ai/mastra/commit/e37ef8404043c94ca0c8e35ecdedb093b8087878), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`10cf521`](https://github.com/mastra-ai/mastra/commit/10cf52183344743a0d7babe24cd24fd78870c354), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`efdb682`](https://github.com/mastra-ai/mastra/commit/efdb682887f6522149769383908f9790c188ab88), [`0dee7a0`](https://github.com/mastra-ai/mastra/commit/0dee7a0ff4c2507e6eb6e6ee5f9738877ebd4ad1), [`04c2c8e`](https://github.com/mastra-ai/mastra/commit/04c2c8e888984364194131aecb490a3d6e920e61), [`02dc07a`](https://github.com/mastra-ai/mastra/commit/02dc07acc4ad42d93335825e3308f5b42266eba2), [`8650e4d`](https://github.com/mastra-ai/mastra/commit/8650e4d3579a2c3a13e2dba7ec6ee7c82c7f61a8), [`bd222d3`](https://github.com/mastra-ai/mastra/commit/bd222d39e292bfcc4a2d9a9e6ec3976cc5a4f22f), [`bb7262b`](https://github.com/mastra-ai/mastra/commit/bb7262b7c0ca76320d985b40510b6ffbbb936582), [`cf1c6e7`](https://github.com/mastra-ai/mastra/commit/cf1c6e789b131f55638fed52183a89d5078b4876), [`5ffadfe`](https://github.com/mastra-ai/mastra/commit/5ffadfefb1468ac2612b20bb84d24c39de6961c0), [`1e1339c`](https://github.com/mastra-ai/mastra/commit/1e1339cc276e571a48cfff5014487877086bfe68), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`d03df73`](https://github.com/mastra-ai/mastra/commit/d03df73f8fe9496064a33e1c3b74ba0479bf9ee6), [`79b8f45`](https://github.com/mastra-ai/mastra/commit/79b8f45a6767e1a5c3d56cd3c5b1214326b81661), [`9bbf08e`](https://github.com/mastra-ai/mastra/commit/9bbf08e3c20731c79dea13a765895b9fcf29cbf1), [`0a25952`](https://github.com/mastra-ai/mastra/commit/0a259526b5e1ac11e6efa53db1f140272962af2d), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`3264a04`](https://github.com/mastra-ai/mastra/commit/3264a04e30340c3c5447433300a035ea0878df85), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`088d9ba`](https://github.com/mastra-ai/mastra/commit/088d9ba2577518703c52b0dccd617178d9ee6b0d), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`aea6217`](https://github.com/mastra-ai/mastra/commit/aea621790bfb2291431b08da0cc5e6e150303ae7), [`b6a855e`](https://github.com/mastra-ai/mastra/commit/b6a855edc056e088279075506442ba1d6fa6def9), [`ae408ea`](https://github.com/mastra-ai/mastra/commit/ae408ea7128f0d2710b78d8623185198e7cb19c1), [`17e942e`](https://github.com/mastra-ai/mastra/commit/17e942eee2ba44985b1f807e6208cdde672f82f9), [`2015cf9`](https://github.com/mastra-ai/mastra/commit/2015cf921649f44c3f5bcd32a2c052335f8e49b4), [`7ef454e`](https://github.com/mastra-ai/mastra/commit/7ef454eaf9dcec6de60021c8f42192052dd490d6), [`2be1d99`](https://github.com/mastra-ai/mastra/commit/2be1d99564ce79acc4846071082bff353035a87a), [`2708fa1`](https://github.com/mastra-ai/mastra/commit/2708fa1055ac91c03e08b598869f6b8fb51fa37f), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ec53e89`](https://github.com/mastra-ai/mastra/commit/ec53e8939c76c638991e21af762e51378eff7543), [`9b5a8cb`](https://github.com/mastra-ai/mastra/commit/9b5a8cb13e120811b0bf14140ada314f1c067894), [`607e66b`](https://github.com/mastra-ai/mastra/commit/607e66b02dc7f531ee37799f3456aa2dc0ca7ac5), [`a215d06`](https://github.com/mastra-ai/mastra/commit/a215d06758dcf590eabfe0b7afd4ae39bdbf082c), [`6909c74`](https://github.com/mastra-ai/mastra/commit/6909c74a7781e0447d475e9dbc1dc871b700f426), [`192438f`](https://github.com/mastra-ai/mastra/commit/192438f8a90c4f375e955f8ff179bf8dc6821a83)]:
  - @mastra/core@1.5.0
  - @mastra/memory@1.4.0
  - @mastra/libsql@1.5.0

## 0.1.0-alpha.3

### Minor Changes

- Added a separate export path for the TUI at `mastracode/tui`, so consumers can cleanly import MastraTUI and related components without reaching into internals. ([#13255](https://github.com/mastra-ai/mastra/pull/13255))

  ```ts
  import { MastraTUI, type MastraTUIOptions } from 'mastracode/tui';
  import { theme, setTheme, ModelSelectorComponent } from 'mastracode/tui';
  ```

## 0.1.0-alpha.2

### Patch Changes

- fix(schema-compat): fix zodToJsonSchema routing for v3/v4 Zod schemas ([#13253](https://github.com/mastra-ai/mastra/pull/13253))

  The `zodToJsonSchema` function now reliably detects and routes Zod v3 vs v4 schemas regardless of which version the ambient `zod` import resolves to. Previously, the detection relied on checking `'toJSONSchema' in z` against the ambient `z` import, which could resolve to either v3 or v4 depending on the environment (monorepo vs global install). This caused v3 schemas to be passed to v4's `toJSONSchema()` (crashing with "Cannot read properties of undefined (reading 'def')") or v4 schemas to be passed to the v3 converter (producing schemas missing the `type` field).

  The fix explicitly imports `z as zV4` from `zod/v4` and routes based on the schema's own `_zod` property, making the behavior environment-independent.

  Also migrates all mastracode tool files from `zod/v3` to `zod` imports now that the schema-compat fix supports both versions correctly.

- Updated dependencies:
  - @mastra/core@1.5.0-alpha.1
  - @mastra/memory@1.4.0-alpha.1

## 0.1.0-alpha.1

### Patch Changes

- Fixed mastracode crashing on startup with ERR_MODULE_NOT_FOUND for vscode-jsonrpc/node. Node.js ESM requires explicit .js extensions on subpath imports. ([#13250](https://github.com/mastra-ai/mastra/pull/13250))

## 0.1.0-alpha.0

### Minor Changes

- Migrated MastraCode from the prototype harness to the generic CoreHarness from @mastra/core. The createMastraCode function is now fully configurable with optional parameters for modes, subagents, storage, tools, and more. Removed the deprecated prototype harness implementation. ([#13245](https://github.com/mastra-ai/mastra/pull/13245))

### Patch Changes

- Added generic Harness class to @mastra/core for orchestrating agents with modes, state management, built-in tools (ask_user, submit_plan), subagent support, Observational Memory integration, model discovery, and permission-aware tool approval. The Harness provides a reusable foundation for building agent-powered applications with features like thread management, heartbeat monitoring, and event-driven architecture. ([#13245](https://github.com/mastra-ai/mastra/pull/13245))

- Updated dependencies [[`252580a`](https://github.com/mastra-ai/mastra/commit/252580a71feb0e46d0ccab04a70a79ff6a2ee0ab), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`5c75261`](https://github.com/mastra-ai/mastra/commit/5c7526120d936757d4ffb7b82232e1641ebd45cb), [`e27d832`](https://github.com/mastra-ai/mastra/commit/e27d83281b5e166fd63a13969689e928d8605944), [`e37ef84`](https://github.com/mastra-ai/mastra/commit/e37ef8404043c94ca0c8e35ecdedb093b8087878), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`10cf521`](https://github.com/mastra-ai/mastra/commit/10cf52183344743a0d7babe24cd24fd78870c354), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`efdb682`](https://github.com/mastra-ai/mastra/commit/efdb682887f6522149769383908f9790c188ab88), [`0dee7a0`](https://github.com/mastra-ai/mastra/commit/0dee7a0ff4c2507e6eb6e6ee5f9738877ebd4ad1), [`04c2c8e`](https://github.com/mastra-ai/mastra/commit/04c2c8e888984364194131aecb490a3d6e920e61), [`02dc07a`](https://github.com/mastra-ai/mastra/commit/02dc07acc4ad42d93335825e3308f5b42266eba2), [`8650e4d`](https://github.com/mastra-ai/mastra/commit/8650e4d3579a2c3a13e2dba7ec6ee7c82c7f61a8), [`bd222d3`](https://github.com/mastra-ai/mastra/commit/bd222d39e292bfcc4a2d9a9e6ec3976cc5a4f22f), [`bb7262b`](https://github.com/mastra-ai/mastra/commit/bb7262b7c0ca76320d985b40510b6ffbbb936582), [`cf1c6e7`](https://github.com/mastra-ai/mastra/commit/cf1c6e789b131f55638fed52183a89d5078b4876), [`5ffadfe`](https://github.com/mastra-ai/mastra/commit/5ffadfefb1468ac2612b20bb84d24c39de6961c0), [`1e1339c`](https://github.com/mastra-ai/mastra/commit/1e1339cc276e571a48cfff5014487877086bfe68), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`d03df73`](https://github.com/mastra-ai/mastra/commit/d03df73f8fe9496064a33e1c3b74ba0479bf9ee6), [`79b8f45`](https://github.com/mastra-ai/mastra/commit/79b8f45a6767e1a5c3d56cd3c5b1214326b81661), [`9bbf08e`](https://github.com/mastra-ai/mastra/commit/9bbf08e3c20731c79dea13a765895b9fcf29cbf1), [`0a25952`](https://github.com/mastra-ai/mastra/commit/0a259526b5e1ac11e6efa53db1f140272962af2d), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`3264a04`](https://github.com/mastra-ai/mastra/commit/3264a04e30340c3c5447433300a035ea0878df85), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`088d9ba`](https://github.com/mastra-ai/mastra/commit/088d9ba2577518703c52b0dccd617178d9ee6b0d), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`aea6217`](https://github.com/mastra-ai/mastra/commit/aea621790bfb2291431b08da0cc5e6e150303ae7), [`b6a855e`](https://github.com/mastra-ai/mastra/commit/b6a855edc056e088279075506442ba1d6fa6def9), [`ae408ea`](https://github.com/mastra-ai/mastra/commit/ae408ea7128f0d2710b78d8623185198e7cb19c1), [`17e942e`](https://github.com/mastra-ai/mastra/commit/17e942eee2ba44985b1f807e6208cdde672f82f9), [`2015cf9`](https://github.com/mastra-ai/mastra/commit/2015cf921649f44c3f5bcd32a2c052335f8e49b4), [`7ef454e`](https://github.com/mastra-ai/mastra/commit/7ef454eaf9dcec6de60021c8f42192052dd490d6), [`2be1d99`](https://github.com/mastra-ai/mastra/commit/2be1d99564ce79acc4846071082bff353035a87a), [`2708fa1`](https://github.com/mastra-ai/mastra/commit/2708fa1055ac91c03e08b598869f6b8fb51fa37f), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ec53e89`](https://github.com/mastra-ai/mastra/commit/ec53e8939c76c638991e21af762e51378eff7543), [`9b5a8cb`](https://github.com/mastra-ai/mastra/commit/9b5a8cb13e120811b0bf14140ada314f1c067894), [`607e66b`](https://github.com/mastra-ai/mastra/commit/607e66b02dc7f531ee37799f3456aa2dc0ca7ac5), [`a215d06`](https://github.com/mastra-ai/mastra/commit/a215d06758dcf590eabfe0b7afd4ae39bdbf082c), [`6909c74`](https://github.com/mastra-ai/mastra/commit/6909c74a7781e0447d475e9dbc1dc871b700f426), [`192438f`](https://github.com/mastra-ai/mastra/commit/192438f8a90c4f375e955f8ff179bf8dc6821a83)]:
  - @mastra/core@1.5.0-alpha.0
  - @mastra/memory@1.4.0-alpha.0
  - @mastra/libsql@1.5.0-alpha.0
