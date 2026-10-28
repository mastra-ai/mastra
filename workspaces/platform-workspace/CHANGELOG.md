# @mastra/platform

## 1.10.0

### Minor Changes

- Added a full process manager to `PlatformSandbox`. Background processes now stream their output and can be stopped: ([#27919](https://github.com/mastra-ai/mastra/pull/27919))

  - `spawn()` streams stdout and stderr while the process runs, instead of only when it exits.
  - `kill()` stops a process.
  - `list()` shows what is running in the sandbox, plus exited processes whose output hasn't been read.
  - `get(pid)` attaches to a process this manager didn't start, for example after your app restarts.

  ```ts
  const handle = await sandbox.processes.spawn('pnpm dev', {
    onStdout: data => console.log(data),
  });

  const processes = await sandbox.processes.list();
  await handle.kill();
  ```

  Processes have no time limit unless you set `timeout`. A long-running process's output stream reconnects periodically, and the process keeps running through it. Output written during a reconnect is lost, and a process that exits while its stream reconnects reports exit code `1` from `wait()` instead of its real exit code.

- Added an opt-in `docker` sandbox setting. When it is on, E2B sandboxes get Docker Engine and Compose, and the daemon starts the first time something uses Docker. Sessions can then run `docker compose up` for local services such as Redis. ([#27888](https://github.com/mastra-ai/mastra/pull/27888))

  ```ts
  import { Template } from '@mastra/platform-workspace';

  const template = Template().memoryMB(2048).docker();
  ```

  In a factory, turn on the **Docker** switch in the sandbox settings, or pass `docker: true` to `createRepoTemplate`.

  Docker is part of the template identity, so templates that leave it off keep their current IDs. We recommend at least 2 GB of memory for Docker.

### Patch Changes

- dependencies updates: ([#28417](https://github.com/mastra-ai/mastra/pull/28417))
  - Updated dependency [`e2b@^2.59.0` ↗︎](https://www.npmjs.com/package/e2b/v/2.59.0) (from `^2.38.0`, in `dependencies`)
  - Updated dependency [`@types/node@22.19.15` ↗︎](https://www.npmjs.com/package/@types/node/v/22.19.15) (from `22.20.5`, in `devDependencies`)

- The Docker sandbox setting and its low-memory warning no longer name the underlying sandbox provider. ([#28646](https://github.com/mastra-ai/mastra/pull/28646))

- Fixed `read_file` returning images and PDFs from E2B, platform, AgentFS, Modal and Mesa filesystems as garbled text. Their `stat()` now reports a `mimeType` for files, inferred from the extension with `getMimeType` from `@mastra/core/workspace` like `LocalFilesystem`, so `read_file` returns supported images (PNG, JPEG, WebP) and PDFs as media the model can view. Directories still have no `mimeType`. ([#28462](https://github.com/mastra-ai/mastra/pull/28462))

  These packages now require `@mastra/core` 1.80.0 or later, the first release that exports `getMimeType`.

- Fixed background processes losing output, and `wait()` failing, when a command wrote output as soon as it started. Output that arrived before the process handle was ready was dropped with an error; it now reaches `stdout`, `stderr` and the `onStdout`/`onStderr` callbacks like any other output. This applies to `sandbox.processes.spawn()` and to attaching with `sandbox.processes.get(pid)`. ([#28056](https://github.com/mastra-ai/mastra/pull/28056))

- Updated dependencies [[`ce5d473`](https://github.com/mastra-ai/mastra/commit/ce5d4731eeeb44779748852618b95c5cb6485bed), [`a15ea70`](https://github.com/mastra-ai/mastra/commit/a15ea70e71ca57242fa61b23e7f0178d77f9af4b), [`f396b43`](https://github.com/mastra-ai/mastra/commit/f396b435c72042fc6d9e82c361fa047675995812), [`c253e13`](https://github.com/mastra-ai/mastra/commit/c253e13ac627d0325f8665004f7af8a49805a9a4), [`0a913e0`](https://github.com/mastra-ai/mastra/commit/0a913e096cb569aea396fa3d9f286cc874179ce8), [`c8f8e41`](https://github.com/mastra-ai/mastra/commit/c8f8e410d39a29b8b69cb7bf90cc9a774cb956f5), [`3dfe2eb`](https://github.com/mastra-ai/mastra/commit/3dfe2eb8c3ef3b18d2395a3618b6214488963d05), [`152e380`](https://github.com/mastra-ai/mastra/commit/152e380aca6fcf74f598a158c710c0e755ceb325), [`08640de`](https://github.com/mastra-ai/mastra/commit/08640de350ff9183c1d9ef568fde4c6ccdf181e4), [`b7ff751`](https://github.com/mastra-ai/mastra/commit/b7ff751ed0fd87a3f93ce438c355c2dcc16e79d5), [`24a821b`](https://github.com/mastra-ai/mastra/commit/24a821b0ff29f527787c0645a7bf7bbe50d27f57), [`551189d`](https://github.com/mastra-ai/mastra/commit/551189d6b6737a928b61335ce80cbe19e1b53bdd), [`99e4867`](https://github.com/mastra-ai/mastra/commit/99e486723d3f0063ae70a39c9840daf92a98fa23), [`a1e248b`](https://github.com/mastra-ai/mastra/commit/a1e248bfe0776ab6ca2a55fed3c423b08fb5ae03), [`0afde2c`](https://github.com/mastra-ai/mastra/commit/0afde2c114aa02b0186ae963c8c83796f8801b60), [`38ff787`](https://github.com/mastra-ai/mastra/commit/38ff787998d56210cfd938439af0fea68703a196), [`929a728`](https://github.com/mastra-ai/mastra/commit/929a7281d411ac515e0befb53a5383741b06d484), [`1fc075a`](https://github.com/mastra-ai/mastra/commit/1fc075ab7f7eddca854512d21149db8212f422eb), [`1fc075a`](https://github.com/mastra-ai/mastra/commit/1fc075ab7f7eddca854512d21149db8212f422eb), [`a5a9179`](https://github.com/mastra-ai/mastra/commit/a5a9179daa5ac1ed49447265038208c9f96cd0f8), [`38ff787`](https://github.com/mastra-ai/mastra/commit/38ff787998d56210cfd938439af0fea68703a196), [`52db47c`](https://github.com/mastra-ai/mastra/commit/52db47cd0d66f891d41a2dbfa36e55b640a30a37), [`8e1247c`](https://github.com/mastra-ai/mastra/commit/8e1247cb26fc1a3cd1c2ac6edaf34fddad897852), [`ed76bdc`](https://github.com/mastra-ai/mastra/commit/ed76bdcc88e09c0f7f0da14ffadca62b1b4a2409), [`2f655e5`](https://github.com/mastra-ai/mastra/commit/2f655e53fcae10a2423e0194a113ce52e70580fe), [`ac953f0`](https://github.com/mastra-ai/mastra/commit/ac953f08a74d063ce0e8d2368b36556f715b1fb0), [`ca04e2c`](https://github.com/mastra-ai/mastra/commit/ca04e2cbb6f5ae13edf006905d9810434b4163fe), [`9ffb79b`](https://github.com/mastra-ai/mastra/commit/9ffb79b17e6ed0f0ec6bd1640218ef2a5fb7c058), [`155e3ac`](https://github.com/mastra-ai/mastra/commit/155e3aca3e57114ce3393bd88f6848c29f37c82b), [`be5c929`](https://github.com/mastra-ai/mastra/commit/be5c9292ac6d4beb7f1020d0dc745edd18842f3d), [`7adffbb`](https://github.com/mastra-ai/mastra/commit/7adffbb3df2f734b59648dcf8d461e7af8d1f914), [`e39aa42`](https://github.com/mastra-ai/mastra/commit/e39aa4237c81a2eb546a899c9739c96d6359737f), [`0d7d5cb`](https://github.com/mastra-ai/mastra/commit/0d7d5cbdccacc0b03697b3400579ea520e382061), [`7c20f00`](https://github.com/mastra-ai/mastra/commit/7c20f008c84db8f4f49e6e95d6dc965482bb2039), [`e20bbd0`](https://github.com/mastra-ai/mastra/commit/e20bbd0ef40475bda611ddfd8ea2721ddac3642c), [`c9ff73d`](https://github.com/mastra-ai/mastra/commit/c9ff73dd24e9473cb0008857105367c99ba839cb), [`f51a29e`](https://github.com/mastra-ai/mastra/commit/f51a29e82b6e2371b5c6aed46141ce20f099c9a9), [`7d58088`](https://github.com/mastra-ai/mastra/commit/7d580884fbf1fb5d90e0761272e2480ed01da70f), [`4ad204d`](https://github.com/mastra-ai/mastra/commit/4ad204dc5bdde76dca26cb7d87c48dd11f97316d), [`f5ebbf3`](https://github.com/mastra-ai/mastra/commit/f5ebbf3b2dc935b8fc068996b4db478815f05bd5), [`decd0a0`](https://github.com/mastra-ai/mastra/commit/decd0a0066286996a4558f63e91a8edfa1143feb), [`e56f88e`](https://github.com/mastra-ai/mastra/commit/e56f88e18d906635b033173abcae637cf361ce8a), [`cd4722a`](https://github.com/mastra-ai/mastra/commit/cd4722a583a0eb75022b1da6a6f8210f8126e486), [`db2a1a6`](https://github.com/mastra-ai/mastra/commit/db2a1a659ecb057ae9ff6798a501ed33dd38b7c7), [`6a4a607`](https://github.com/mastra-ai/mastra/commit/6a4a607e710000e46790e20f28c2355af9ca2a05), [`2499c00`](https://github.com/mastra-ai/mastra/commit/2499c00181520cf7cda756729dc0e0085b85454f), [`de53c27`](https://github.com/mastra-ai/mastra/commit/de53c27a70dbd0c362384691459648043edbee72), [`d580530`](https://github.com/mastra-ai/mastra/commit/d580530ff36d43e752b1f838b3f8e16017e8f92b), [`a6077b7`](https://github.com/mastra-ai/mastra/commit/a6077b7f61bde8d302f20b54a2dced2d969887aa), [`5bd713b`](https://github.com/mastra-ai/mastra/commit/5bd713b4f2ca7769675d949f8052943807c11598), [`5c0a994`](https://github.com/mastra-ai/mastra/commit/5c0a99438ef82cf5584218f250a023371bab3373), [`d3f5000`](https://github.com/mastra-ai/mastra/commit/d3f500024f7b0c107c3786757b3f5481f029d061), [`682ebf6`](https://github.com/mastra-ai/mastra/commit/682ebf6b6f867224acbcb021fc142b902738ad07), [`11c83d5`](https://github.com/mastra-ai/mastra/commit/11c83d53331588e06623d5d4a35baa606bbaa424), [`dd6205e`](https://github.com/mastra-ai/mastra/commit/dd6205e985e5fd76b59d000076ab199143c989eb), [`97ade4e`](https://github.com/mastra-ai/mastra/commit/97ade4e8621a9afd01a1f38b921519ddc3086568), [`8ae87fa`](https://github.com/mastra-ai/mastra/commit/8ae87fadd01daa128086e015473881bf55d6e47b), [`fe73073`](https://github.com/mastra-ai/mastra/commit/fe73073027b4884d1a301e6d6cc4f0bf168b43ae), [`2ca9e35`](https://github.com/mastra-ai/mastra/commit/2ca9e3522f117cc12fee7a9dad2f5961cd41164e), [`d1aee64`](https://github.com/mastra-ai/mastra/commit/d1aee64e65968744c118440d2d01eb4fba3616d6), [`20f40eb`](https://github.com/mastra-ai/mastra/commit/20f40ebf5623b059336f4c3000d47755941b4451), [`7adffbb`](https://github.com/mastra-ai/mastra/commit/7adffbb3df2f734b59648dcf8d461e7af8d1f914), [`e718b91`](https://github.com/mastra-ai/mastra/commit/e718b91a64eb720cd755b7fd78255d0ab5a412de), [`9a9085e`](https://github.com/mastra-ai/mastra/commit/9a9085ef3481c31093152ea9976759c72dc3fd89), [`35806cb`](https://github.com/mastra-ai/mastra/commit/35806cb9b62dfed212b238d00148341d8b2f68ac), [`2fed0ad`](https://github.com/mastra-ai/mastra/commit/2fed0ad258322811ea7f2107f1121c6d5dee1c59), [`823a389`](https://github.com/mastra-ai/mastra/commit/823a3890deb5cf14484fd655c8360df4c41c4aed), [`6fea510`](https://github.com/mastra-ai/mastra/commit/6fea51000dfc4f249993a7d3959ad41ca6c422ca), [`9a83d42`](https://github.com/mastra-ai/mastra/commit/9a83d42b2461dd1629021d05704939b641330d5b), [`703b0a1`](https://github.com/mastra-ai/mastra/commit/703b0a1cb342d3a6fce72b5b07685fbb31695674), [`bfce5b6`](https://github.com/mastra-ai/mastra/commit/bfce5b6982dc17a6944484b1ee9b333f6f5023d6), [`95c6e7c`](https://github.com/mastra-ai/mastra/commit/95c6e7caf4929d941f958e3f146b551e25eaeef3), [`2447071`](https://github.com/mastra-ai/mastra/commit/2447071b11d7a5f159e6dc726eb5df0aa0db69da), [`ff35b8c`](https://github.com/mastra-ai/mastra/commit/ff35b8c3d86136509d31b87fed7f789a572dc1af), [`59421d0`](https://github.com/mastra-ai/mastra/commit/59421d0137a0642c60b687567e33bf2358be4c64), [`501b207`](https://github.com/mastra-ai/mastra/commit/501b207b1b6300af44b5b8f40ff33adfe7a9d195), [`3143101`](https://github.com/mastra-ai/mastra/commit/31431019ddd56d0b5677f8cd169f715f0e907266), [`2829b0e`](https://github.com/mastra-ai/mastra/commit/2829b0eae687d36c8f864eba4051225ae3b82343), [`e053569`](https://github.com/mastra-ai/mastra/commit/e05356995ee8c807516d8aff836a8363dba7eee6), [`d9245dd`](https://github.com/mastra-ai/mastra/commit/d9245dd486349163bfc6468ab45e5600abc6a59e), [`ab1727d`](https://github.com/mastra-ai/mastra/commit/ab1727d5cafb64e36b04fad9f8871dc6640d2420), [`4fc17c6`](https://github.com/mastra-ai/mastra/commit/4fc17c65e85628a71201bf7490fca1db8376cf71), [`a9ad47d`](https://github.com/mastra-ai/mastra/commit/a9ad47d8c3186e51142b9c1a3ed1e8e29ade2338), [`358c711`](https://github.com/mastra-ai/mastra/commit/358c71145d677394ce03a019156bc464afe6cc76), [`dbdfaee`](https://github.com/mastra-ai/mastra/commit/dbdfaee279dab2a5dca31134ca1967eb582e639c), [`cf0ca8b`](https://github.com/mastra-ai/mastra/commit/cf0ca8b55d67a3ccf6ee7835e4dd2addea0c82a8), [`2ded35c`](https://github.com/mastra-ai/mastra/commit/2ded35cb0c97b26f641a9eb9a5747d32164d45c9), [`875a657`](https://github.com/mastra-ai/mastra/commit/875a65748d5e03b436bab01d7f9fe782fa2941e7), [`d3e8ec7`](https://github.com/mastra-ai/mastra/commit/d3e8ec74e90bedefc28414e459ec9c5d52c97ccc), [`ddb7721`](https://github.com/mastra-ai/mastra/commit/ddb77211bc797c45fe434baac5c44c4193c1381e), [`d1aee64`](https://github.com/mastra-ai/mastra/commit/d1aee64e65968744c118440d2d01eb4fba3616d6), [`d58fe2a`](https://github.com/mastra-ai/mastra/commit/d58fe2ac5cd64a96dca05657f07df18f23db14e1), [`7662736`](https://github.com/mastra-ai/mastra/commit/7662736615043b8f4d0d2e7277094936ff2c88d6), [`5e88354`](https://github.com/mastra-ai/mastra/commit/5e883545edd6082e741cdce1d192e0e83fa5dc2e), [`5bb592a`](https://github.com/mastra-ai/mastra/commit/5bb592a862869d529d8d6ca48772cd0e1863f224), [`bd508a2`](https://github.com/mastra-ai/mastra/commit/bd508a2dec8c550baec245bfffc2d0853386e2eb), [`6f5eadb`](https://github.com/mastra-ai/mastra/commit/6f5eadbf7744a48ee742b940455e969922c3277d), [`578cb67`](https://github.com/mastra-ai/mastra/commit/578cb670bd8621538eda4afc1f25139e5903aab9), [`4278b9d`](https://github.com/mastra-ai/mastra/commit/4278b9dfb8aef7f274e4dfb102597cc0400475ee), [`2ac8cf1`](https://github.com/mastra-ai/mastra/commit/2ac8cf1435ba3abae9dba7b6c34f1c02f75eab21), [`1283717`](https://github.com/mastra-ai/mastra/commit/1283717ecfc652da293aafe6ff582afa07ca84a5), [`875a657`](https://github.com/mastra-ai/mastra/commit/875a65748d5e03b436bab01d7f9fe782fa2941e7), [`2b9f9a5`](https://github.com/mastra-ai/mastra/commit/2b9f9a55799ee7a6020a063d2419096429254481), [`307b711`](https://github.com/mastra-ai/mastra/commit/307b711bbe73132f1f319c3326333d49bc23b79d), [`45c1d16`](https://github.com/mastra-ai/mastra/commit/45c1d16c4f0cd3e5b18d2a788fb998c70b45b7c0), [`dc10589`](https://github.com/mastra-ai/mastra/commit/dc1058900dd9be01638d43491ddfd2037da12bac), [`339da0b`](https://github.com/mastra-ai/mastra/commit/339da0bef7e2e5570f533f6b41abbd746190bffb), [`34ee1d1`](https://github.com/mastra-ai/mastra/commit/34ee1d16226852f57d1f8bb34ee7a88397e5cce2), [`8c61247`](https://github.com/mastra-ai/mastra/commit/8c6124708341d699c3b1f3bb19f19be468923483), [`a9f392e`](https://github.com/mastra-ai/mastra/commit/a9f392e60e5bc1fab66280314bab5f697e8d7c09), [`fdd2201`](https://github.com/mastra-ai/mastra/commit/fdd22014f6fbfa115eba53cff42063544af2ff41), [`5c56910`](https://github.com/mastra-ai/mastra/commit/5c56910b2647e11cbb6880431e556471b25ba949), [`b7ff751`](https://github.com/mastra-ai/mastra/commit/b7ff751ed0fd87a3f93ce438c355c2dcc16e79d5), [`0811cda`](https://github.com/mastra-ai/mastra/commit/0811cda8d22476cf1393b429a63aaefa5292048c), [`1e31034`](https://github.com/mastra-ai/mastra/commit/1e31034b30cb9661e38af548dfda646aee74f08f), [`17444a7`](https://github.com/mastra-ai/mastra/commit/17444a7e46b656b3877faad6e61d5637f435b291), [`a7cc444`](https://github.com/mastra-ai/mastra/commit/a7cc44423357eaa1e0a73c63ce28ba08ca2ce85c), [`3cdaaa8`](https://github.com/mastra-ai/mastra/commit/3cdaaa86f48812bdae1077e55be1d58dd5e85fc5), [`3be96ae`](https://github.com/mastra-ai/mastra/commit/3be96ae2f65a2ff3b2189fb79fd03b7eedee3dbe), [`852110d`](https://github.com/mastra-ai/mastra/commit/852110d4eeaf5ab74ea94747343501700033a1e8), [`b63456b`](https://github.com/mastra-ai/mastra/commit/b63456befb5f51d1a2b1288225f02c30738b6099), [`f156ad0`](https://github.com/mastra-ai/mastra/commit/f156ad0b7ed6b0ba286efd9040c061c9240d55c3), [`580452a`](https://github.com/mastra-ai/mastra/commit/580452acbbb9812eae1b31d4f3ded716c348a78b), [`4303017`](https://github.com/mastra-ai/mastra/commit/4303017f393b9c09f692837d8e9e7a19f6539cf4)]:
  - @mastra/core@1.80.0

## 1.10.0-alpha.3

### Patch Changes

- The Docker sandbox setting and its low-memory warning no longer name the underlying sandbox provider. ([#28646](https://github.com/mastra-ai/mastra/pull/28646))

- Updated dependencies [[`59421d0`](https://github.com/mastra-ai/mastra/commit/59421d0137a0642c60b687567e33bf2358be4c64), [`6f5eadb`](https://github.com/mastra-ai/mastra/commit/6f5eadbf7744a48ee742b940455e969922c3277d)]:
  - @mastra/core@1.80.0-alpha.7

## 1.10.0-alpha.2

### Minor Changes

- Added an opt-in `docker` sandbox setting. When it is on, E2B sandboxes get Docker Engine and Compose, and the daemon starts the first time something uses Docker. Sessions can then run `docker compose up` for local services such as Redis. ([#27888](https://github.com/mastra-ai/mastra/pull/27888))

  ```ts
  import { Template } from '@mastra/platform-workspace';

  const template = Template().memoryMB(2048).docker();
  ```

  In a factory, turn on the **Docker** switch in the sandbox settings, or pass `docker: true` to `createRepoTemplate`.

  Docker is part of the template identity, so templates that leave it off keep their current IDs. E2B recommends at least 2 GB of memory for Docker.

### Patch Changes

- Updated dependencies [[`24a821b`](https://github.com/mastra-ai/mastra/commit/24a821b0ff29f527787c0645a7bf7bbe50d27f57), [`38ff787`](https://github.com/mastra-ai/mastra/commit/38ff787998d56210cfd938439af0fea68703a196), [`1fc075a`](https://github.com/mastra-ai/mastra/commit/1fc075ab7f7eddca854512d21149db8212f422eb), [`1fc075a`](https://github.com/mastra-ai/mastra/commit/1fc075ab7f7eddca854512d21149db8212f422eb), [`38ff787`](https://github.com/mastra-ai/mastra/commit/38ff787998d56210cfd938439af0fea68703a196), [`9ffb79b`](https://github.com/mastra-ai/mastra/commit/9ffb79b17e6ed0f0ec6bd1640218ef2a5fb7c058), [`155e3ac`](https://github.com/mastra-ai/mastra/commit/155e3aca3e57114ce3393bd88f6848c29f37c82b), [`7c20f00`](https://github.com/mastra-ai/mastra/commit/7c20f008c84db8f4f49e6e95d6dc965482bb2039), [`4ad204d`](https://github.com/mastra-ai/mastra/commit/4ad204dc5bdde76dca26cb7d87c48dd11f97316d), [`e56f88e`](https://github.com/mastra-ai/mastra/commit/e56f88e18d906635b033173abcae637cf361ce8a), [`cd4722a`](https://github.com/mastra-ai/mastra/commit/cd4722a583a0eb75022b1da6a6f8210f8126e486), [`2499c00`](https://github.com/mastra-ai/mastra/commit/2499c00181520cf7cda756729dc0e0085b85454f), [`d580530`](https://github.com/mastra-ai/mastra/commit/d580530ff36d43e752b1f838b3f8e16017e8f92b), [`682ebf6`](https://github.com/mastra-ai/mastra/commit/682ebf6b6f867224acbcb021fc142b902738ad07), [`dd6205e`](https://github.com/mastra-ai/mastra/commit/dd6205e985e5fd76b59d000076ab199143c989eb), [`97ade4e`](https://github.com/mastra-ai/mastra/commit/97ade4e8621a9afd01a1f38b921519ddc3086568), [`d1aee64`](https://github.com/mastra-ai/mastra/commit/d1aee64e65968744c118440d2d01eb4fba3616d6), [`9a9085e`](https://github.com/mastra-ai/mastra/commit/9a9085ef3481c31093152ea9976759c72dc3fd89), [`9a83d42`](https://github.com/mastra-ai/mastra/commit/9a83d42b2461dd1629021d05704939b641330d5b), [`2447071`](https://github.com/mastra-ai/mastra/commit/2447071b11d7a5f159e6dc726eb5df0aa0db69da), [`ab1727d`](https://github.com/mastra-ai/mastra/commit/ab1727d5cafb64e36b04fad9f8871dc6640d2420), [`4fc17c6`](https://github.com/mastra-ai/mastra/commit/4fc17c65e85628a71201bf7490fca1db8376cf71), [`ddb7721`](https://github.com/mastra-ai/mastra/commit/ddb77211bc797c45fe434baac5c44c4193c1381e), [`d1aee64`](https://github.com/mastra-ai/mastra/commit/d1aee64e65968744c118440d2d01eb4fba3616d6), [`5e88354`](https://github.com/mastra-ai/mastra/commit/5e883545edd6082e741cdce1d192e0e83fa5dc2e), [`5bb592a`](https://github.com/mastra-ai/mastra/commit/5bb592a862869d529d8d6ca48772cd0e1863f224), [`4278b9d`](https://github.com/mastra-ai/mastra/commit/4278b9dfb8aef7f274e4dfb102597cc0400475ee), [`45c1d16`](https://github.com/mastra-ai/mastra/commit/45c1d16c4f0cd3e5b18d2a788fb998c70b45b7c0), [`a9f392e`](https://github.com/mastra-ai/mastra/commit/a9f392e60e5bc1fab66280314bab5f697e8d7c09), [`0811cda`](https://github.com/mastra-ai/mastra/commit/0811cda8d22476cf1393b429a63aaefa5292048c), [`3cdaaa8`](https://github.com/mastra-ai/mastra/commit/3cdaaa86f48812bdae1077e55be1d58dd5e85fc5), [`852110d`](https://github.com/mastra-ai/mastra/commit/852110d4eeaf5ab74ea94747343501700033a1e8), [`b63456b`](https://github.com/mastra-ai/mastra/commit/b63456befb5f51d1a2b1288225f02c30738b6099), [`580452a`](https://github.com/mastra-ai/mastra/commit/580452acbbb9812eae1b31d4f3ded716c348a78b)]:
  - @mastra/core@1.80.0-alpha.5

## 1.10.0-alpha.1

### Patch Changes

- dependencies updates: ([#28417](https://github.com/mastra-ai/mastra/pull/28417))
  - Updated dependency [`e2b@^2.59.0` ↗︎](https://www.npmjs.com/package/e2b/v/2.59.0) (from `^2.38.0`, in `dependencies`)
  - Updated dependency [`@types/node@22.19.15` ↗︎](https://www.npmjs.com/package/@types/node/v/22.19.15) (from `22.20.5`, in `devDependencies`)

- Fixed `read_file` returning images and PDFs from E2B, platform, AgentFS, Modal and Mesa filesystems as garbled text. Their `stat()` now reports a `mimeType` for files, inferred from the extension with `getMimeType` from `@mastra/core/workspace` like `LocalFilesystem`, so `read_file` returns supported images (PNG, JPEG, WebP) and PDFs as media the model can view. Directories still have no `mimeType`. ([#28462](https://github.com/mastra-ai/mastra/pull/28462))

  These packages now require `@mastra/core` 1.80.0 or later, the first release that exports `getMimeType`.

- Updated dependencies [[`ce5d473`](https://github.com/mastra-ai/mastra/commit/ce5d4731eeeb44779748852618b95c5cb6485bed), [`0a913e0`](https://github.com/mastra-ai/mastra/commit/0a913e096cb569aea396fa3d9f286cc874179ce8), [`3dfe2eb`](https://github.com/mastra-ai/mastra/commit/3dfe2eb8c3ef3b18d2395a3618b6214488963d05), [`152e380`](https://github.com/mastra-ai/mastra/commit/152e380aca6fcf74f598a158c710c0e755ceb325), [`99e4867`](https://github.com/mastra-ai/mastra/commit/99e486723d3f0063ae70a39c9840daf92a98fa23), [`929a728`](https://github.com/mastra-ai/mastra/commit/929a7281d411ac515e0befb53a5383741b06d484), [`52db47c`](https://github.com/mastra-ai/mastra/commit/52db47cd0d66f891d41a2dbfa36e55b640a30a37), [`7adffbb`](https://github.com/mastra-ai/mastra/commit/7adffbb3df2f734b59648dcf8d461e7af8d1f914), [`f51a29e`](https://github.com/mastra-ai/mastra/commit/f51a29e82b6e2371b5c6aed46141ce20f099c9a9), [`5c0a994`](https://github.com/mastra-ai/mastra/commit/5c0a99438ef82cf5584218f250a023371bab3373), [`7adffbb`](https://github.com/mastra-ai/mastra/commit/7adffbb3df2f734b59648dcf8d461e7af8d1f914), [`823a389`](https://github.com/mastra-ai/mastra/commit/823a3890deb5cf14484fd655c8360df4c41c4aed), [`ff35b8c`](https://github.com/mastra-ai/mastra/commit/ff35b8c3d86136509d31b87fed7f789a572dc1af), [`501b207`](https://github.com/mastra-ai/mastra/commit/501b207b1b6300af44b5b8f40ff33adfe7a9d195), [`d9245dd`](https://github.com/mastra-ai/mastra/commit/d9245dd486349163bfc6468ab45e5600abc6a59e), [`358c711`](https://github.com/mastra-ai/mastra/commit/358c71145d677394ce03a019156bc464afe6cc76), [`dbdfaee`](https://github.com/mastra-ai/mastra/commit/dbdfaee279dab2a5dca31134ca1967eb582e639c), [`fdd2201`](https://github.com/mastra-ai/mastra/commit/fdd22014f6fbfa115eba53cff42063544af2ff41), [`4303017`](https://github.com/mastra-ai/mastra/commit/4303017f393b9c09f692837d8e9e7a19f6539cf4)]:
  - @mastra/core@1.80.0-alpha.4

## 1.10.0-alpha.0

### Minor Changes

- Added a full process manager to `PlatformSandbox`. Background processes now stream their output and can be stopped: ([#27919](https://github.com/mastra-ai/mastra/pull/27919))

  - `spawn()` streams stdout and stderr while the process runs, instead of only when it exits.
  - `kill()` stops a process.
  - `list()` shows what is running in the sandbox, plus exited processes whose output hasn't been read.
  - `get(pid)` attaches to a process this manager didn't start, for example after your app restarts.

  ```ts
  const handle = await sandbox.processes.spawn('pnpm dev', {
    onStdout: data => console.log(data),
  });

  const processes = await sandbox.processes.list();
  await handle.kill();
  ```

  Processes have no time limit unless you set `timeout`. A long-running process's output stream reconnects periodically, and the process keeps running through it. Output written during a reconnect is lost, and a process that exits while its stream reconnects reports exit code `1` from `wait()` instead of its real exit code.

### Patch Changes

- Fixed background processes losing output, and `wait()` failing, when a command wrote output as soon as it started. Output that arrived before the process handle was ready was dropped with an error; it now reaches `stdout`, `stderr` and the `onStdout`/`onStderr` callbacks like any other output. This applies to `sandbox.processes.spawn()` and to attaching with `sandbox.processes.get(pid)`. ([#28056](https://github.com/mastra-ai/mastra/pull/28056))

- Updated dependencies [[`a15ea70`](https://github.com/mastra-ai/mastra/commit/a15ea70e71ca57242fa61b23e7f0178d77f9af4b), [`c253e13`](https://github.com/mastra-ai/mastra/commit/c253e13ac627d0325f8665004f7af8a49805a9a4), [`c8f8e41`](https://github.com/mastra-ai/mastra/commit/c8f8e410d39a29b8b69cb7bf90cc9a774cb956f5), [`08640de`](https://github.com/mastra-ai/mastra/commit/08640de350ff9183c1d9ef568fde4c6ccdf181e4), [`a1e248b`](https://github.com/mastra-ai/mastra/commit/a1e248bfe0776ab6ca2a55fed3c423b08fb5ae03), [`0afde2c`](https://github.com/mastra-ai/mastra/commit/0afde2c114aa02b0186ae963c8c83796f8801b60), [`a5a9179`](https://github.com/mastra-ai/mastra/commit/a5a9179daa5ac1ed49447265038208c9f96cd0f8), [`8e1247c`](https://github.com/mastra-ai/mastra/commit/8e1247cb26fc1a3cd1c2ac6edaf34fddad897852), [`ed76bdc`](https://github.com/mastra-ai/mastra/commit/ed76bdcc88e09c0f7f0da14ffadca62b1b4a2409), [`2f655e5`](https://github.com/mastra-ai/mastra/commit/2f655e53fcae10a2423e0194a113ce52e70580fe), [`be5c929`](https://github.com/mastra-ai/mastra/commit/be5c9292ac6d4beb7f1020d0dc745edd18842f3d), [`e39aa42`](https://github.com/mastra-ai/mastra/commit/e39aa4237c81a2eb546a899c9739c96d6359737f), [`e20bbd0`](https://github.com/mastra-ai/mastra/commit/e20bbd0ef40475bda611ddfd8ea2721ddac3642c), [`c9ff73d`](https://github.com/mastra-ai/mastra/commit/c9ff73dd24e9473cb0008857105367c99ba839cb), [`7d58088`](https://github.com/mastra-ai/mastra/commit/7d580884fbf1fb5d90e0761272e2480ed01da70f), [`db2a1a6`](https://github.com/mastra-ai/mastra/commit/db2a1a659ecb057ae9ff6798a501ed33dd38b7c7), [`6a4a607`](https://github.com/mastra-ai/mastra/commit/6a4a607e710000e46790e20f28c2355af9ca2a05), [`de53c27`](https://github.com/mastra-ai/mastra/commit/de53c27a70dbd0c362384691459648043edbee72), [`d3f5000`](https://github.com/mastra-ai/mastra/commit/d3f500024f7b0c107c3786757b3f5481f029d061), [`8ae87fa`](https://github.com/mastra-ai/mastra/commit/8ae87fadd01daa128086e015473881bf55d6e47b), [`20f40eb`](https://github.com/mastra-ai/mastra/commit/20f40ebf5623b059336f4c3000d47755941b4451), [`35806cb`](https://github.com/mastra-ai/mastra/commit/35806cb9b62dfed212b238d00148341d8b2f68ac), [`2fed0ad`](https://github.com/mastra-ai/mastra/commit/2fed0ad258322811ea7f2107f1121c6d5dee1c59), [`6fea510`](https://github.com/mastra-ai/mastra/commit/6fea51000dfc4f249993a7d3959ad41ca6c422ca), [`bfce5b6`](https://github.com/mastra-ai/mastra/commit/bfce5b6982dc17a6944484b1ee9b333f6f5023d6), [`95c6e7c`](https://github.com/mastra-ai/mastra/commit/95c6e7caf4929d941f958e3f146b551e25eaeef3), [`2829b0e`](https://github.com/mastra-ai/mastra/commit/2829b0eae687d36c8f864eba4051225ae3b82343), [`e053569`](https://github.com/mastra-ai/mastra/commit/e05356995ee8c807516d8aff836a8363dba7eee6), [`a9ad47d`](https://github.com/mastra-ai/mastra/commit/a9ad47d8c3186e51142b9c1a3ed1e8e29ade2338), [`cf0ca8b`](https://github.com/mastra-ai/mastra/commit/cf0ca8b55d67a3ccf6ee7835e4dd2addea0c82a8), [`875a657`](https://github.com/mastra-ai/mastra/commit/875a65748d5e03b436bab01d7f9fe782fa2941e7), [`d3e8ec7`](https://github.com/mastra-ai/mastra/commit/d3e8ec74e90bedefc28414e459ec9c5d52c97ccc), [`d58fe2a`](https://github.com/mastra-ai/mastra/commit/d58fe2ac5cd64a96dca05657f07df18f23db14e1), [`bd508a2`](https://github.com/mastra-ai/mastra/commit/bd508a2dec8c550baec245bfffc2d0853386e2eb), [`578cb67`](https://github.com/mastra-ai/mastra/commit/578cb670bd8621538eda4afc1f25139e5903aab9), [`2ac8cf1`](https://github.com/mastra-ai/mastra/commit/2ac8cf1435ba3abae9dba7b6c34f1c02f75eab21), [`875a657`](https://github.com/mastra-ai/mastra/commit/875a65748d5e03b436bab01d7f9fe782fa2941e7), [`307b711`](https://github.com/mastra-ai/mastra/commit/307b711bbe73132f1f319c3326333d49bc23b79d), [`dc10589`](https://github.com/mastra-ai/mastra/commit/dc1058900dd9be01638d43491ddfd2037da12bac), [`339da0b`](https://github.com/mastra-ai/mastra/commit/339da0bef7e2e5570f533f6b41abbd746190bffb), [`8c61247`](https://github.com/mastra-ai/mastra/commit/8c6124708341d699c3b1f3bb19f19be468923483), [`5c56910`](https://github.com/mastra-ai/mastra/commit/5c56910b2647e11cbb6880431e556471b25ba949), [`17444a7`](https://github.com/mastra-ai/mastra/commit/17444a7e46b656b3877faad6e61d5637f435b291), [`f156ad0`](https://github.com/mastra-ai/mastra/commit/f156ad0b7ed6b0ba286efd9040c061c9240d55c3)]:
  - @mastra/core@1.80.0-alpha.0

## 1.9.0

### Minor Changes

- `PlatformSandbox.filesystem` reads and writes the sandbox's disk through E2B's files API, sent straight to the VM with the same lease `executeCommand()` already uses. A file read or stat takes one round trip instead of several commands. On a sandbox that isn't E2B-backed, `filesystem` is `undefined`. ([#27859](https://github.com/mastra-ai/mastra/pull/27859))

  ```ts
  const sandbox = new PlatformSandbox();
  const source = await sandbox.filesystem?.readFile('/workspace/app/src/index.ts', { encoding: 'utf-8' });
  ```

  Copies, appends, and writes or moves with `overwrite: false` run as one command inside the VM, so they're atomic and file contents don't travel through your server.

### Patch Changes

- Bump for npm ([#27221](https://github.com/mastra-ai/mastra/pull/27221))

- Updated dependencies [[`dbde4bf`](https://github.com/mastra-ai/mastra/commit/dbde4bf36ac016abcda61868cc6f792f9d07abee), [`3af753f`](https://github.com/mastra-ai/mastra/commit/3af753fb40a2b8f7ab17b1cf16cd4da7e1b020a6), [`ec84d93`](https://github.com/mastra-ai/mastra/commit/ec84d93cda24d56a0812086fcaace9e68ce8e089), [`6362d32`](https://github.com/mastra-ai/mastra/commit/6362d32a905d32820dcab3b9a039ebc1cec4f444), [`1c9fd9b`](https://github.com/mastra-ai/mastra/commit/1c9fd9bbdd4258c0d86c89cac6ae68c5023a2590), [`59c02f5`](https://github.com/mastra-ai/mastra/commit/59c02f53955dde397f343f2107060ed70bbe63c5), [`e3678a5`](https://github.com/mastra-ai/mastra/commit/e3678a564cf3bb5922112b4dca65973c5fdc0a92), [`934ec13`](https://github.com/mastra-ai/mastra/commit/934ec1315e8ee4b73067864f56a9fcc8105e8512), [`9b60f12`](https://github.com/mastra-ai/mastra/commit/9b60f12b13b28c9664a839aef435e6d10898644d), [`14f17b8`](https://github.com/mastra-ai/mastra/commit/14f17b86e2b162623bb22942c7930c2113a6d8a1), [`9c4d65f`](https://github.com/mastra-ai/mastra/commit/9c4d65f41ee21e407f0015b0e745881288f69d05), [`48bee02`](https://github.com/mastra-ai/mastra/commit/48bee02e1a5cef20f4da67720191d5e85cdca13c), [`f885386`](https://github.com/mastra-ai/mastra/commit/f885386b79be0e4d784067b0e26608971e0cc788), [`915fbe6`](https://github.com/mastra-ai/mastra/commit/915fbe67e974edbeba4dbd3afeaec4d68b34b118), [`f1b596e`](https://github.com/mastra-ai/mastra/commit/f1b596e3219bd8721079611c62b92b8f0f6c12d9), [`d93662b`](https://github.com/mastra-ai/mastra/commit/d93662bfee9313c376cff90e910e05ec9b0634ea), [`871f3c8`](https://github.com/mastra-ai/mastra/commit/871f3c801640148cffa09474fc9f9032495ddccf), [`44e35e4`](https://github.com/mastra-ai/mastra/commit/44e35e47491ad5fd9f771526d5d8c312644000ec), [`336692a`](https://github.com/mastra-ai/mastra/commit/336692a646e28d24b303eefdb8fdbe64e4b4e801), [`41b7f34`](https://github.com/mastra-ai/mastra/commit/41b7f3422a97f1385a285002b7e6f898eb5c7b06), [`f1c68eb`](https://github.com/mastra-ai/mastra/commit/f1c68eb4ae080d8cbbc694ae580850d8fa94dece), [`97f78c3`](https://github.com/mastra-ai/mastra/commit/97f78c3cf104600887e08e94cc073c973bb53c3b), [`e13dddd`](https://github.com/mastra-ai/mastra/commit/e13dddd4f5ac10448cd37009c31efedbf4c40ff4), [`9c66073`](https://github.com/mastra-ai/mastra/commit/9c66073db33749ab622d54db7e8885f183451ca4), [`6bfe708`](https://github.com/mastra-ai/mastra/commit/6bfe7087fcc27a08c8cba95a45c5da353188bb9c), [`3624981`](https://github.com/mastra-ai/mastra/commit/36249818e7cd0b2904142c6b133cc1ceb756ba68), [`aaedaa6`](https://github.com/mastra-ai/mastra/commit/aaedaa634aa7394789952d4f9fe04b1aec8619a1), [`a92384b`](https://github.com/mastra-ai/mastra/commit/a92384bf9093beb9071953292a936ca722370ce5), [`a8f9157`](https://github.com/mastra-ai/mastra/commit/a8f9157fafe38f5acf68e37c8874ebd192ef8e10), [`79fd3b0`](https://github.com/mastra-ai/mastra/commit/79fd3b06a7cf59f7acb4591b9ba0f388d548fd17), [`04ded0b`](https://github.com/mastra-ai/mastra/commit/04ded0b7409b39008a1e4611c412ee80ee20993d), [`f28b72f`](https://github.com/mastra-ai/mastra/commit/f28b72f255a460746f08c73b2a1d336bfc57757b), [`90dca88`](https://github.com/mastra-ai/mastra/commit/90dca88f44f31428a0e585584114b56f0bec477b), [`1874bf2`](https://github.com/mastra-ai/mastra/commit/1874bf2a5ba304f22ffb93f9ec5a9afea000a5a1), [`4e6701a`](https://github.com/mastra-ai/mastra/commit/4e6701a8534e29fad29c7fe4c6787dc1ed56b419), [`a3f8ac0`](https://github.com/mastra-ai/mastra/commit/a3f8ac03c7526248e585f3e4e87b349566dd4797), [`022e6cf`](https://github.com/mastra-ai/mastra/commit/022e6cf06fdc891a6318f16db304be8fe75b7f72), [`d8fb857`](https://github.com/mastra-ai/mastra/commit/d8fb857bda2c23a08e535291a638fbc6e3a4e073), [`6c67158`](https://github.com/mastra-ai/mastra/commit/6c67158a10406adae195887167862d632bb54d64), [`26e684b`](https://github.com/mastra-ai/mastra/commit/26e684b1f152d341c2dca01c5347fea7e8762188), [`d8bfd3d`](https://github.com/mastra-ai/mastra/commit/d8bfd3d502dd9952db66f0c4f53cd04f5c8e71ef), [`ace1e35`](https://github.com/mastra-ai/mastra/commit/ace1e35d5762f96976a2cba958283edda71fcc3b), [`f905746`](https://github.com/mastra-ai/mastra/commit/f905746159def2d386dca516657123f43ef90e24), [`b77f59c`](https://github.com/mastra-ai/mastra/commit/b77f59cc5407b1158a271d579b55514f2ba79145), [`776bb6e`](https://github.com/mastra-ai/mastra/commit/776bb6e2b3ed9ec32e5430332ee756185fcebb68), [`2d0a3b0`](https://github.com/mastra-ai/mastra/commit/2d0a3b06d0880036c0dbd4b1fcf782d1f5115a56), [`ad8e752`](https://github.com/mastra-ai/mastra/commit/ad8e75217bcbb12986e7e77a30cb4af1be93c0fd), [`ba744e5`](https://github.com/mastra-ai/mastra/commit/ba744e5347d7d373b89233f1b8beddb5bdf5b2c3), [`4471372`](https://github.com/mastra-ai/mastra/commit/4471372b0338523a2f57407a90b1d913e68f17cc), [`5131dad`](https://github.com/mastra-ai/mastra/commit/5131dadf8c2db8641030111203db6c16fe3240f2), [`58db748`](https://github.com/mastra-ai/mastra/commit/58db74858beae6ff20ff22786c968386b9d3edcc), [`8c2d516`](https://github.com/mastra-ai/mastra/commit/8c2d5164714a27e720d898da612da6054a88ef91), [`7425858`](https://github.com/mastra-ai/mastra/commit/74258589417e9e91114c64571a67702d2e352b3f), [`0e9a577`](https://github.com/mastra-ai/mastra/commit/0e9a5774151385c93524883e2b1bea40e2a644de), [`fd98055`](https://github.com/mastra-ai/mastra/commit/fd98055302882876b8dc5ae03649a89a72e2ac6c), [`b2c91db`](https://github.com/mastra-ai/mastra/commit/b2c91dbd2d32e18cd114d87301fc3b8182fddb10), [`c111a5b`](https://github.com/mastra-ai/mastra/commit/c111a5bfa2a7a197f30700ce238c84ee799df140), [`a97ba85`](https://github.com/mastra-ai/mastra/commit/a97ba8578a2dc91a16d945276ca8c7a4ad32e38a), [`f6a9762`](https://github.com/mastra-ai/mastra/commit/f6a9762b12ae9dad6a154f73ed3099a2ee472d0c), [`14b2a7c`](https://github.com/mastra-ai/mastra/commit/14b2a7c56da4329f7fd17738056a081663deed46), [`750a4ed`](https://github.com/mastra-ai/mastra/commit/750a4edf7826da9ba7321682912504c60f29712d), [`e5b6877`](https://github.com/mastra-ai/mastra/commit/e5b6877fbdb471485b99019eb50046b44e778aae), [`c236d64`](https://github.com/mastra-ai/mastra/commit/c236d64974c68e6c0f9bf6e3d6442e0184c5f49e), [`fc96794`](https://github.com/mastra-ai/mastra/commit/fc9679466bede4ca3e014aea48a72fd950a13d2a), [`e5b6877`](https://github.com/mastra-ai/mastra/commit/e5b6877fbdb471485b99019eb50046b44e778aae), [`85a26af`](https://github.com/mastra-ai/mastra/commit/85a26af75fe62b7f2d8ac0b56d322798e5ae0616), [`5758ba0`](https://github.com/mastra-ai/mastra/commit/5758ba045b01c407a7414b32dbbdf5480596b31d), [`8271439`](https://github.com/mastra-ai/mastra/commit/8271439b491f5f777590abfda9a0ac7f1e3212c2), [`44e35e4`](https://github.com/mastra-ai/mastra/commit/44e35e47491ad5fd9f771526d5d8c312644000ec), [`7337dac`](https://github.com/mastra-ai/mastra/commit/7337dac8aad8d70e98a4b0c7caa677c01966b53b), [`f51c0af`](https://github.com/mastra-ai/mastra/commit/f51c0afdd1b181b84e294f8613185494a8aaec3c), [`5f70db1`](https://github.com/mastra-ai/mastra/commit/5f70db1f3b5b38a27438d1c153db352d2bc8de30), [`179964b`](https://github.com/mastra-ai/mastra/commit/179964b95aacac31763a4a1aa2f2d1c652aa529d), [`7afee18`](https://github.com/mastra-ai/mastra/commit/7afee18a3d91ce125f08ffd6e2724695e8a68652), [`ca1b2f2`](https://github.com/mastra-ai/mastra/commit/ca1b2f25d7c69c6e90b719baef32ffb1db6c5681), [`12991bd`](https://github.com/mastra-ai/mastra/commit/12991bd0945ca36e13b213ebcbfaf0880d04d44d), [`0ac6a2a`](https://github.com/mastra-ai/mastra/commit/0ac6a2a4ab19f294b5362bcdf9c8ae9e3d8a3ede), [`b8fe2ae`](https://github.com/mastra-ai/mastra/commit/b8fe2aec651efeaad6d607d816565453a341cdef), [`22df9d7`](https://github.com/mastra-ai/mastra/commit/22df9d76651b3b4d513388a7eae8e51dbfb36a1b), [`f54f8b2`](https://github.com/mastra-ai/mastra/commit/f54f8b2df2aa24e1ef4d171c733576e7c62bb1b0), [`9cb6843`](https://github.com/mastra-ai/mastra/commit/9cb6843a8a39ab2e12498b0c08c9f4cdcefd9cea), [`0971298`](https://github.com/mastra-ai/mastra/commit/0971298317be971ae1c3f0c1d949a31df7d71c7f), [`72cb1e2`](https://github.com/mastra-ai/mastra/commit/72cb1e2b9453f7bb1bd08e4f9aa54da56fa20600), [`a3be51b`](https://github.com/mastra-ai/mastra/commit/a3be51b1a545b45bfb04377699edecbb8a8d79d6), [`bcfb6af`](https://github.com/mastra-ai/mastra/commit/bcfb6af5a61d79f6902e87d3a8fa70283f48705d), [`03868f8`](https://github.com/mastra-ai/mastra/commit/03868f840401865af433040ba7ff90f585dea2e1), [`368149c`](https://github.com/mastra-ai/mastra/commit/368149c27954f6d578d3561cc1801cb415b78aa7), [`fdf475d`](https://github.com/mastra-ai/mastra/commit/fdf475dbc8974e1ae21966e5e96e316a7beebdf7), [`2725bd7`](https://github.com/mastra-ai/mastra/commit/2725bd73fa27f231e30bce7c6a03c651bc15b408), [`9277d8e`](https://github.com/mastra-ai/mastra/commit/9277d8ef26ad2f08bfbae89d78d409fb91c95c8d), [`0611d4a`](https://github.com/mastra-ai/mastra/commit/0611d4a060696da5c3c550b07451d870d4af0f58), [`eb0b702`](https://github.com/mastra-ai/mastra/commit/eb0b702e9939f02073fb1c4dfd7eaa51fde59e0b), [`e41478c`](https://github.com/mastra-ai/mastra/commit/e41478cbb7ab108cf7f704a6f0f4092ec4374e21), [`323b021`](https://github.com/mastra-ai/mastra/commit/323b0212bc57c2b9acaed2716812a873c0fa43ee), [`78b3ef7`](https://github.com/mastra-ai/mastra/commit/78b3ef7cb120f2b366a39d7095ece5f0ec7d3f71), [`0eb8311`](https://github.com/mastra-ai/mastra/commit/0eb8311f9ecf254c96179e99dc145d6df3cccd07), [`ba7b0ea`](https://github.com/mastra-ai/mastra/commit/ba7b0eac045755d39d20dcf3a943ea5f8270b009), [`9b546e2`](https://github.com/mastra-ai/mastra/commit/9b546e2b9dba91d51769a73ce1a0b34d775b144a), [`e8d7f8e`](https://github.com/mastra-ai/mastra/commit/e8d7f8e52da32b05f2e8501c1127128ae1a5d450), [`d93662b`](https://github.com/mastra-ai/mastra/commit/d93662bfee9313c376cff90e910e05ec9b0634ea), [`0e5d045`](https://github.com/mastra-ai/mastra/commit/0e5d045be4ab67d1fba5eeb8125bc2ec43aa9519), [`0e4fa4f`](https://github.com/mastra-ai/mastra/commit/0e4fa4f0604bb2e6e63e5d1d203b2dcadd646a81), [`c397dff`](https://github.com/mastra-ai/mastra/commit/c397dff0ee0662b56f348852ad08aff820239d66), [`92034fa`](https://github.com/mastra-ai/mastra/commit/92034fa2a46a4f45af416c3201752342ead71d89), [`e4cd1d1`](https://github.com/mastra-ai/mastra/commit/e4cd1d13de8bcb14d8d0a8531f7b96fcbb138217), [`4e44e7f`](https://github.com/mastra-ai/mastra/commit/4e44e7f518debb3b0aebc5ad71ea3e4a3902d8c9), [`b03ee08`](https://github.com/mastra-ai/mastra/commit/b03ee089c70c087cdc9d1d0a85aa749621ad5a3c), [`0f1d83f`](https://github.com/mastra-ai/mastra/commit/0f1d83fed073613869d6283adb198b934ef80093), [`7aa0361`](https://github.com/mastra-ai/mastra/commit/7aa036142ca476b1f1e18a220f826e73ca58c38a), [`cd864ca`](https://github.com/mastra-ai/mastra/commit/cd864ca5d1fa6cb3477cb8a87b79070febbb3b6b), [`d95a821`](https://github.com/mastra-ai/mastra/commit/d95a821e903f7883b5fadfee5c7f59809d66cfb8), [`98c7e10`](https://github.com/mastra-ai/mastra/commit/98c7e109fca4995d19d7eb132fdb8411c860b151), [`e35e335`](https://github.com/mastra-ai/mastra/commit/e35e335f19ee0c7c1e03bf247aebd24c3e041459), [`e3678a5`](https://github.com/mastra-ai/mastra/commit/e3678a564cf3bb5922112b4dca65973c5fdc0a92), [`3c2c033`](https://github.com/mastra-ai/mastra/commit/3c2c033aa68cd8cd7e4c630abd7f1bfeb440f457), [`425d383`](https://github.com/mastra-ai/mastra/commit/425d383d4fb15e55e9491b6bdaebb57f2de7cdc8), [`5d8f8b7`](https://github.com/mastra-ai/mastra/commit/5d8f8b78460350d581e8a92412cdfe88b4ce76bc), [`5d5ea03`](https://github.com/mastra-ai/mastra/commit/5d5ea032a4c64cefe5bc217f4cc761a9364ccbf4), [`fae54c5`](https://github.com/mastra-ai/mastra/commit/fae54c57917cd1f527937ca42b5ab7dfe1d55a2a), [`b0f7f91`](https://github.com/mastra-ai/mastra/commit/b0f7f91eb667f15e188b861759b4c4a5761ec233), [`958d170`](https://github.com/mastra-ai/mastra/commit/958d170c218a0e050c0c4807a94ce1f67f00e570), [`ba7d4e5`](https://github.com/mastra-ai/mastra/commit/ba7d4e5c9759a164279c7ebdbe2b7a32ae94b4ce), [`8b36444`](https://github.com/mastra-ai/mastra/commit/8b36444dbbc6916d298015c2586fbbde2e9b265f), [`3f68324`](https://github.com/mastra-ai/mastra/commit/3f68324e72f03bbc7d918d23013f550527f59c40), [`bfd35f6`](https://github.com/mastra-ai/mastra/commit/bfd35f64178f06774c95dabec4a796245cf8a401), [`0b5eaa0`](https://github.com/mastra-ai/mastra/commit/0b5eaa07445a6551481ab6ceadef603b020a099b), [`12407df`](https://github.com/mastra-ai/mastra/commit/12407df9e6bd2f82cd27533bd4a9aa8057b97f2e), [`8c05e78`](https://github.com/mastra-ai/mastra/commit/8c05e78b099b26daf4bfa9b229190201c8bf581d), [`9620613`](https://github.com/mastra-ai/mastra/commit/96206136bcc184e6238bd6dd5627fe28254eec0b), [`cc977b4`](https://github.com/mastra-ai/mastra/commit/cc977b4ce7def6727cdd63af3478d2b8b83daf07), [`c36b9e7`](https://github.com/mastra-ai/mastra/commit/c36b9e7129b355211ed9e7a3b7df2d7b81c01c05), [`c82558f`](https://github.com/mastra-ai/mastra/commit/c82558f2e5eedb493afff46f940ab7f3c085d57f), [`100431b`](https://github.com/mastra-ai/mastra/commit/100431b965dba5d32d282cfcd3c0415013cc0eed), [`7a0aea2`](https://github.com/mastra-ai/mastra/commit/7a0aea28af3bcf879a75b5bcdbfc3d471f63c565), [`a0471fe`](https://github.com/mastra-ai/mastra/commit/a0471fefaf92a44b44f5fb23e607fdad087e51f2), [`3012dd4`](https://github.com/mastra-ai/mastra/commit/3012dd424b2329eda78381688f1f48244173e6a2), [`e0077c3`](https://github.com/mastra-ai/mastra/commit/e0077c34070037ac77c264a9d5000a69c0dd2095), [`f9e22cc`](https://github.com/mastra-ai/mastra/commit/f9e22cc6fa264ded4a95ab34dab84b6ce12c2597), [`fed802d`](https://github.com/mastra-ai/mastra/commit/fed802d6e4e395d9ba42a1122c2468a072407b1c), [`6889aa2`](https://github.com/mastra-ai/mastra/commit/6889aa29d661a8892f503e37bc3d8ffe18aa7e37), [`bde069a`](https://github.com/mastra-ai/mastra/commit/bde069ac2f610abd5a09bcdb511ed04f5f01437e), [`7f4a1ca`](https://github.com/mastra-ai/mastra/commit/7f4a1ca724829e0a732eea6afb285f15908df8e9), [`680d914`](https://github.com/mastra-ai/mastra/commit/680d9141c851e8eb6fcd2d3c3fbadf05a0f1011d), [`ae74f81`](https://github.com/mastra-ai/mastra/commit/ae74f812d75034a90d647739062b9c2ca84b4ed6), [`b23b87b`](https://github.com/mastra-ai/mastra/commit/b23b87b8ab849cdc9f58b297d667c0bbaed0b62f), [`8c90438`](https://github.com/mastra-ai/mastra/commit/8c90438b404d27593927eccc47616aab4a35006e), [`a7bfa1f`](https://github.com/mastra-ai/mastra/commit/a7bfa1ff7c592f368cf34be472c7d89e03b0098b), [`f42951a`](https://github.com/mastra-ai/mastra/commit/f42951afb1d2c2a2148100a54b6ec10d473c9591), [`c8035a4`](https://github.com/mastra-ai/mastra/commit/c8035a49ae2af692d812dace394ac64635f5fd1d), [`1980959`](https://github.com/mastra-ai/mastra/commit/1980959335396f8ee72558689623abf3e205b31b), [`fa409d4`](https://github.com/mastra-ai/mastra/commit/fa409d430b879e45d433497439c0c11d2a3fafd6), [`0876fa8`](https://github.com/mastra-ai/mastra/commit/0876fa827a9685022fb0dc1606cbb673dffcaf95), [`f81d7cb`](https://github.com/mastra-ai/mastra/commit/f81d7cb89f122e1c01729a917c70ca62d6c51216), [`78cbed0`](https://github.com/mastra-ai/mastra/commit/78cbed0e0ed27b74d9b3b767566b21d513cddd53), [`beb81d3`](https://github.com/mastra-ai/mastra/commit/beb81d355b4a8e472ac411f33aa0d4854cb8662b), [`f99e0e5`](https://github.com/mastra-ai/mastra/commit/f99e0e5db6012fbdcd8eac8a32d762b2a1d56b5e), [`16d8f44`](https://github.com/mastra-ai/mastra/commit/16d8f44e3a1486d7319c1baeca6115d37f6c4cea)]:
  - @mastra/core@1.79.0

## 1.9.0-alpha.1

### Minor Changes

- `PlatformSandbox.filesystem` reads and writes the sandbox's disk through E2B's files API, sent straight to the VM with the same lease `executeCommand()` already uses. A file read or stat takes one round trip instead of several commands. On a sandbox that isn't E2B-backed, `filesystem` is `undefined`. ([#27859](https://github.com/mastra-ai/mastra/pull/27859))

  ```ts
  const sandbox = new PlatformSandbox();
  const source = await sandbox.filesystem?.readFile('/workspace/app/src/index.ts', { encoding: 'utf-8' });
  ```

  Copies, appends, and writes or moves with `overwrite: false` run as one command inside the VM, so they're atomic and file contents don't travel through your server.

### Patch Changes

- Updated dependencies [[`f1b596e`](https://github.com/mastra-ai/mastra/commit/f1b596e3219bd8721079611c62b92b8f0f6c12d9), [`4e6701a`](https://github.com/mastra-ai/mastra/commit/4e6701a8534e29fad29c7fe4c6787dc1ed56b419), [`f905746`](https://github.com/mastra-ai/mastra/commit/f905746159def2d386dca516657123f43ef90e24), [`72cb1e2`](https://github.com/mastra-ai/mastra/commit/72cb1e2b9453f7bb1bd08e4f9aa54da56fa20600), [`0e5d045`](https://github.com/mastra-ai/mastra/commit/0e5d045be4ab67d1fba5eeb8125bc2ec43aa9519), [`0e4fa4f`](https://github.com/mastra-ai/mastra/commit/0e4fa4f0604bb2e6e63e5d1d203b2dcadd646a81), [`a7bfa1f`](https://github.com/mastra-ai/mastra/commit/a7bfa1ff7c592f368cf34be472c7d89e03b0098b)]:
  - @mastra/core@1.79.0-alpha.11

## 1.8.2-alpha.0

### Patch Changes

- Bump for npm ([#27221](https://github.com/mastra-ai/mastra/pull/27221))

- Updated dependencies [[`9b60f12`](https://github.com/mastra-ai/mastra/commit/9b60f12b13b28c9664a839aef435e6d10898644d), [`f885386`](https://github.com/mastra-ai/mastra/commit/f885386b79be0e4d784067b0e26608971e0cc788), [`f6a9762`](https://github.com/mastra-ai/mastra/commit/f6a9762b12ae9dad6a154f73ed3099a2ee472d0c), [`fae54c5`](https://github.com/mastra-ai/mastra/commit/fae54c57917cd1f527937ca42b5ab7dfe1d55a2a)]:
  - @mastra/core@1.78.1-alpha.0

## 1.8.1

### Patch Changes

- Changed the Factory sandbox memory setting from a free-form MB field to a dropdown of sizes: 512 MB, 1 GB, 2 GB, 4 GB or 8 GB, matching E2B's 8 GB limit. Memory set through the `defaults` option in code is unaffected. ([#27098](https://github.com/mastra-ai/mastra/pull/27098))

- Updated dependencies [[`0b1ea6c`](https://github.com/mastra-ai/mastra/commit/0b1ea6ca6266158316defb522feb3d2f9bf33174), [`bed1ccc`](https://github.com/mastra-ai/mastra/commit/bed1cccea5817d68faa42a15fda3a0b329f70680), [`a9b85ba`](https://github.com/mastra-ai/mastra/commit/a9b85ba48a2542c568d91f3032464057227d55dc), [`6f50db8`](https://github.com/mastra-ai/mastra/commit/6f50db8a3e0a673c6e094229e3d18e2b8dbb99f7), [`f28c44e`](https://github.com/mastra-ai/mastra/commit/f28c44ed98a87c6078a3e3e9ef2b197d97f97956), [`3ddf32d`](https://github.com/mastra-ai/mastra/commit/3ddf32da0e6eaffd1e5da33105bf245b6e56a117), [`03646c5`](https://github.com/mastra-ai/mastra/commit/03646c587b915ced4c9fad3189391909a296f441), [`02e2eae`](https://github.com/mastra-ai/mastra/commit/02e2eae3aee1c5b5b9c807a6a3389b88eca1440c), [`7b08a87`](https://github.com/mastra-ai/mastra/commit/7b08a876b1060cf6842c61ed8af0eaa93e1310c4), [`5d82145`](https://github.com/mastra-ai/mastra/commit/5d82145ae3cc591eb5cdafd4af5977c36fec5c01), [`7e4b680`](https://github.com/mastra-ai/mastra/commit/7e4b68035c3e62a4fcf981afce9b02ecf65ddcf5), [`032a92d`](https://github.com/mastra-ai/mastra/commit/032a92d661696b3620ce45f4a0b1de60f0a6c068), [`1c9cb41`](https://github.com/mastra-ai/mastra/commit/1c9cb4151c3addfdf689ee1dd9d3a013c7342e25), [`460b600`](https://github.com/mastra-ai/mastra/commit/460b600abe3b7563537cfb8a676d649c638a9190), [`2362057`](https://github.com/mastra-ai/mastra/commit/2362057cedc6b90b9fd71c424df40eedf3a4ecf3), [`9daf547`](https://github.com/mastra-ai/mastra/commit/9daf547f810df721eaca9c9dafc18f8ce1727b77), [`f738a12`](https://github.com/mastra-ai/mastra/commit/f738a120225329f619211756d69f164a3f434c5d), [`4c29655`](https://github.com/mastra-ai/mastra/commit/4c296551a79bebc6a40fddcf2409824f601e6c43), [`843d441`](https://github.com/mastra-ai/mastra/commit/843d4411284c3b96953edebd2c22c3ac9556bac2), [`33eb344`](https://github.com/mastra-ai/mastra/commit/33eb344ebfe918d032e3ad1e410788d4c8bc6526), [`6155190`](https://github.com/mastra-ai/mastra/commit/6155190d2436d5e93e21f6a875d8c4306c8043ff), [`5d12fbf`](https://github.com/mastra-ai/mastra/commit/5d12fbfcd756e5f5b0cae53e45a486a64ad102f5), [`eb71f8c`](https://github.com/mastra-ai/mastra/commit/eb71f8c3abbe9aa40375f898fce60f555ef9ebf3), [`6ea5f80`](https://github.com/mastra-ai/mastra/commit/6ea5f80919ae4ebc3e3fbba29390da74f043c69a), [`35fbdce`](https://github.com/mastra-ai/mastra/commit/35fbdce6de71332246dd6d9b4a5ecba2d87fb6cc), [`e496762`](https://github.com/mastra-ai/mastra/commit/e49676258181017f50eb5739d4a97c0da7317dd9), [`d7bd3cd`](https://github.com/mastra-ai/mastra/commit/d7bd3cda0fb2e46c68d164af2e0cb1815be03572), [`cb015a1`](https://github.com/mastra-ai/mastra/commit/cb015a1be6560cbaf4deaef219cb02e63b263bc3), [`9cf0fe4`](https://github.com/mastra-ai/mastra/commit/9cf0fe4731d6186be20c890dba27ba3a2c134f5e), [`c09fb4b`](https://github.com/mastra-ai/mastra/commit/c09fb4b5758114c8c57d0af48cbe6dfdfe9dde90), [`b2dd0c6`](https://github.com/mastra-ai/mastra/commit/b2dd0c6333691467e61406ac920eb6f861db6bc0), [`ad16eae`](https://github.com/mastra-ai/mastra/commit/ad16eae7eec9af386c9eee81f4f30ef65d0df48b), [`d99fa30`](https://github.com/mastra-ai/mastra/commit/d99fa305e0baa00fb2064283658c10e00b95bf10)]:
  - @mastra/core@1.78.0

## 1.8.1-alpha.0

### Patch Changes

- Changed the Factory sandbox memory setting from a free-form MB field to a dropdown of sizes: 512 MB, 1 GB, 2 GB, 4 GB or 8 GB, matching E2B's 8 GB limit. Memory set through the `defaults` option in code is unaffected. ([#27098](https://github.com/mastra-ai/mastra/pull/27098))

- Updated dependencies [[`7b08a87`](https://github.com/mastra-ai/mastra/commit/7b08a876b1060cf6842c61ed8af0eaa93e1310c4), [`5d82145`](https://github.com/mastra-ai/mastra/commit/5d82145ae3cc591eb5cdafd4af5977c36fec5c01), [`4c29655`](https://github.com/mastra-ai/mastra/commit/4c296551a79bebc6a40fddcf2409824f601e6c43), [`6155190`](https://github.com/mastra-ai/mastra/commit/6155190d2436d5e93e21f6a875d8c4306c8043ff), [`eb71f8c`](https://github.com/mastra-ai/mastra/commit/eb71f8c3abbe9aa40375f898fce60f555ef9ebf3), [`35fbdce`](https://github.com/mastra-ai/mastra/commit/35fbdce6de71332246dd6d9b4a5ecba2d87fb6cc), [`cb015a1`](https://github.com/mastra-ai/mastra/commit/cb015a1be6560cbaf4deaef219cb02e63b263bc3), [`d99fa30`](https://github.com/mastra-ai/mastra/commit/d99fa305e0baa00fb2064283658c10e00b95bf10)]:
  - @mastra/core@1.78.0-alpha.3

## 1.8.0

### Minor Changes

- Added `PlatformFactorySandbox`, which plugs Mastra Platform sandboxes into Mastra Factory as the sandbox provider. Factory gets one sandbox per session, a repository template it can build ahead of the first session, and user-tunable settings. It takes the same options as `PlatformSandbox` except the per-session ones (`id`, `sandboxId`, `sessionId`, `template`). ([#26467](https://github.com/mastra-ai/mastra/pull/26467))

  ```ts
  import { MastraFactory } from '@mastra/factory';
  import { PlatformFactorySandbox } from '@mastra/platform-workspace';

  new MastraFactory({
    sandbox: new PlatformFactorySandbox(), // reads MASTRA_PLATFORM_ACCESS_TOKEN and MASTRA_ENVIRONMENT_ID
  });
  ```

  **Settings:** `cpuCount`, `memoryMb` and `idleTimeoutMinutes`. Unset values fall back to the `defaults` option, then to 2 CPUs, 1024 MB and 5 minutes. An unset idle timeout also honors the top-level `idleTimeoutMinutes` option before the built-in 5 minutes.

  **Builds:** starts a template build through the platform build API and reports its status. Builds are tracked in the host process, so after a restart an earlier build id reads as `unknown`.

### Patch Changes

- Updated dependencies [[`54e9dc3`](https://github.com/mastra-ai/mastra/commit/54e9dc3ed0615ee84a6526395a9fefe17320fe7e), [`f8c0ce2`](https://github.com/mastra-ai/mastra/commit/f8c0ce2646427327b63c05d2eb09e76a3b04133e), [`eaa9d12`](https://github.com/mastra-ai/mastra/commit/eaa9d12407f4962e94e0d5cd49a643e6e317d60a), [`5a70664`](https://github.com/mastra-ai/mastra/commit/5a7066478c1924a6e9a94e1ba3210f9b67a35535), [`59164cb`](https://github.com/mastra-ai/mastra/commit/59164cb7f8b298e28e13305b0273ed2ef7f1d9e1), [`2a1bb80`](https://github.com/mastra-ai/mastra/commit/2a1bb80305bca1859504287e1a09f43c8a014330), [`4df792b`](https://github.com/mastra-ai/mastra/commit/4df792b5b9146b5a2d6726193ee82d9db31180a4), [`0017956`](https://github.com/mastra-ai/mastra/commit/001795671cf329997bee74541f5de9056e6b1cec), [`aa00f41`](https://github.com/mastra-ai/mastra/commit/aa00f41855e8d6802546f613ffec1669e03409fc), [`36fc7ea`](https://github.com/mastra-ai/mastra/commit/36fc7eabf79ca70bd489e4022eb39a3d8382ace5), [`2ec9c07`](https://github.com/mastra-ai/mastra/commit/2ec9c07eddb142c965f1201f5c6e5dbb288405f9), [`e384817`](https://github.com/mastra-ai/mastra/commit/e3848177f2a0051ea1469a06fb6502164bfada7c), [`519e97f`](https://github.com/mastra-ai/mastra/commit/519e97f624a15362fec7b143dea4eabcff556712), [`e384817`](https://github.com/mastra-ai/mastra/commit/e3848177f2a0051ea1469a06fb6502164bfada7c), [`821b8d4`](https://github.com/mastra-ai/mastra/commit/821b8d4253dcac5d8cf886994884e4645899bedc), [`878e0e2`](https://github.com/mastra-ai/mastra/commit/878e0e2f5adf9669158c7a8a8d67cd8809633c24), [`aea91e7`](https://github.com/mastra-ai/mastra/commit/aea91e7f3a4fb066bfda96dca670d7d2a766d770), [`380e9f5`](https://github.com/mastra-ai/mastra/commit/380e9f57ea9ba7c37950b989d145b70c03a09a6c), [`4029a96`](https://github.com/mastra-ai/mastra/commit/4029a964848512399f27bca283915d49fd106717), [`8dc4d65`](https://github.com/mastra-ai/mastra/commit/8dc4d65b34aad280c4f6ab265162c4846face7e3), [`ca92c02`](https://github.com/mastra-ai/mastra/commit/ca92c02696427baad81dd7a61b049ef37c332452), [`3504acd`](https://github.com/mastra-ai/mastra/commit/3504acdb2833b71db61dc9387c0f25f3cd0a3070), [`5bb6d71`](https://github.com/mastra-ai/mastra/commit/5bb6d711680d17370eacdcdab105e5af69202c5f), [`dab6849`](https://github.com/mastra-ai/mastra/commit/dab6849945ab2a0e4c946f5b31fb6f41b2c1cd7d), [`da87b0a`](https://github.com/mastra-ai/mastra/commit/da87b0a1629d5ffc980b434f70fe60f9445ddb1c), [`182f097`](https://github.com/mastra-ai/mastra/commit/182f09745783aa83e42131307085ecf913cfbc38), [`d9da0da`](https://github.com/mastra-ai/mastra/commit/d9da0da5e5d36023469b527f7be55c017634b186), [`097f002`](https://github.com/mastra-ai/mastra/commit/097f00297b0d46aa304eba3a7203248e21d1a70a), [`958bdc9`](https://github.com/mastra-ai/mastra/commit/958bdc942aa78f00c9ec25f8adfb8e14a0dd4fd9), [`4659a11`](https://github.com/mastra-ai/mastra/commit/4659a1130842f07364d4778aa360f3cb7877679d), [`aa00f41`](https://github.com/mastra-ai/mastra/commit/aa00f41855e8d6802546f613ffec1669e03409fc), [`5227c95`](https://github.com/mastra-ai/mastra/commit/5227c95d54d0b4846220530450063f259797b587), [`226823f`](https://github.com/mastra-ai/mastra/commit/226823ffde55e2dcce01f2111a6a35be3f2c9b85), [`67a6b30`](https://github.com/mastra-ai/mastra/commit/67a6b30769f041244f75f9093a181cdf38e1f2e7), [`7236b47`](https://github.com/mastra-ai/mastra/commit/7236b472bca9bbc9dddba53f683b15c271350183)]:
  - @mastra/core@1.77.0

## 1.8.0-alpha.0

### Minor Changes

- Added `PlatformFactorySandbox`, which plugs Mastra Platform sandboxes into Mastra Factory as the sandbox provider. Factory gets one sandbox per session, a repository template it can build ahead of the first session, and user-tunable settings. It takes the same options as `PlatformSandbox` except the per-session ones (`id`, `sandboxId`, `sessionId`, `template`). ([#26467](https://github.com/mastra-ai/mastra/pull/26467))

  ```ts
  import { MastraFactory } from '@mastra/factory';
  import { PlatformFactorySandbox } from '@mastra/platform-workspace';

  new MastraFactory({
    sandbox: new PlatformFactorySandbox(), // reads MASTRA_PLATFORM_ACCESS_TOKEN and MASTRA_ENVIRONMENT_ID
  });
  ```

  **Settings:** `cpuCount`, `memoryMb` and `idleTimeoutMinutes`. Unset values fall back to the `defaults` option, then to 2 CPUs, 1024 MB and 5 minutes. An unset idle timeout also honors the top-level `idleTimeoutMinutes` option before the built-in 5 minutes.

  **Builds:** starts a template build through the platform build API and reports its status. Builds are tracked in the host process, so after a restart an earlier build id reads as `unknown`.

### Patch Changes

- Updated dependencies [[`f8c0ce2`](https://github.com/mastra-ai/mastra/commit/f8c0ce2646427327b63c05d2eb09e76a3b04133e), [`4df792b`](https://github.com/mastra-ai/mastra/commit/4df792b5b9146b5a2d6726193ee82d9db31180a4), [`0017956`](https://github.com/mastra-ai/mastra/commit/001795671cf329997bee74541f5de9056e6b1cec), [`36fc7ea`](https://github.com/mastra-ai/mastra/commit/36fc7eabf79ca70bd489e4022eb39a3d8382ace5), [`2ec9c07`](https://github.com/mastra-ai/mastra/commit/2ec9c07eddb142c965f1201f5c6e5dbb288405f9), [`380e9f5`](https://github.com/mastra-ai/mastra/commit/380e9f57ea9ba7c37950b989d145b70c03a09a6c), [`4029a96`](https://github.com/mastra-ai/mastra/commit/4029a964848512399f27bca283915d49fd106717), [`ca92c02`](https://github.com/mastra-ai/mastra/commit/ca92c02696427baad81dd7a61b049ef37c332452), [`d9da0da`](https://github.com/mastra-ai/mastra/commit/d9da0da5e5d36023469b527f7be55c017634b186), [`67a6b30`](https://github.com/mastra-ai/mastra/commit/67a6b30769f041244f75f9093a181cdf38e1f2e7)]:
  - @mastra/core@1.77.0-alpha.4

## 1.7.0

### Minor Changes

- Added a `repos` option to `createRepoTemplate` to build one template from several repositories. ([#26039](https://github.com/mastra-ai/mastra/pull/26039))

  - Each entry has its own `getRepositoryAccess` and `setupCommand`, and is cloned to `<workingDirectory>/<repo>`.
  - `workspaceSetupCommand` runs once at the working directory after every repository.
  - `continueOnSetupFailure` records a failing repository setup in `.mastra-sandbox/setup-failed` instead of failing the build.
  - Writes a marker at `.mastra-sandbox/repos/<repo>` after each repository setup and `.mastra-sandbox/workspace-setup` after the workspace step.

  ```ts
  const template = createRepoTemplate({
    repos: [
      {
        getRepositoryAccess: async () => ({ cloneUrl: 'https://github.com/acme/app.git' }),
        setupCommand: 'pnpm install --frozen-lockfile',
      },
      {
        getRepositoryAccess: async () => ({
          cloneUrl: 'https://github.com/acme/shared-ui.git',
          authorization: { scheme: 'bearer', token: process.env.GITHUB_TOKEN! },
        }),
        setupCommand: 'pnpm install --frozen-lockfile',
      },
    ],
    workspaceSetupCommand: 'cd app && pnpm link ../shared-ui',
    workingDirectory: '/home/user/repos',
  });
  ```

- Added a `reattach` option to `RailwaySandbox`, `PlatformSandbox`, and `E2BSandbox` to control what happens when a persisted `sandboxId` can't be reattached on `start()`. ([#26675](https://github.com/mastra-ai/mastra/pull/26675))

  - `'best-effort'` (default, unchanged behavior): carry on without the lost sandbox. Railway and Platform provision a replacement; E2B first looks for another sandbox with the same logical `id` and only creates a new one if none is found.
  - `'required'`: throw a `SandboxError` with code `SANDBOX_REATTACH_FAILED` instead, so the caller can tell the user their previous sandbox (and its state) is gone rather than silently starting a fresh one.

  Transient errors such as auth, rate limit, or network failures still propagate unchanged. Clones inherit the parent's `reattach` setting.

  ```ts
  const sandbox = new RailwaySandbox({ sandboxId: session.sandboxId, reattach: 'required' });

  try {
    await sandbox.start();
  } catch (error) {
    if (error instanceof SandboxError && error.code === 'SANDBOX_REATTACH_FAILED') {
      // Previous sandbox is gone: ask the user to start fresh, then clear the persisted sandboxId.
    }
  }
  ```

### Patch Changes

- Fixed `PlatformSandbox.getInfo()` asking the workspace proxy about a `sandboxId` hint before `start()` had confirmed it, which failed the first tool call of a resumed session with `404 not_found`. `getInfo()` now answers from local state until the sandbox has started in the current process. `start()` also treats a `410 sandbox_destroyed` answer for the reattach id like a 404 and provisions a fresh sandbox instead of failing the resumed session. ([#26488](https://github.com/mastra-ai/mastra/pull/26488))

  Fixed `PlatformSandbox.stop()` releasing the sandbox through the proxy's `DELETE /sandbox/:id`, which kills the VM on E2B. `Mastra.shutdown()` stops every registered workspace, so a host restart destroyed every live session. `stop()` now sends nothing and keeps the sandbox id, so the next `start()` reattaches; `destroy()` is the only call that releases the VM and its checkpoint.

  Added a `sandboxId` property that exposes the platform's id for the running sandbox, so callers persist an id the proxy recognises and reattach to the same sandbox later:

  ```ts
  const sandbox = new PlatformSandbox({ id: 'session-1', environmentId: 'env_123' });
  await sandbox.start();
  const persisted = sandbox.sandboxId; // the platform's id, undefined before start()

  const resumed = new PlatformSandbox({ id: 'session-1', environmentId: 'env_123', sandboxId: persisted });
  await resumed.start(); // { outcome: 'connected' }
  ```

- Updated dependencies [[`908f923`](https://github.com/mastra-ai/mastra/commit/908f92340e14f776d7a69edab244d0ae3cefe057), [`b196f30`](https://github.com/mastra-ai/mastra/commit/b196f30602005325e95bde29a9b7676aeea14c42), [`a65d0c7`](https://github.com/mastra-ai/mastra/commit/a65d0c788824081f36ccd95078a8d1214ff687c4), [`4b8f1d7`](https://github.com/mastra-ai/mastra/commit/4b8f1d74adb2b1742fd10ebb1d24e863329075aa), [`9a511a4`](https://github.com/mastra-ai/mastra/commit/9a511a4ff5ac8349f4d4b64b0f432576fa3c8656), [`2233844`](https://github.com/mastra-ai/mastra/commit/223384452984718e16fc660d29f0d5d93a1ebaf2), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`cca0f8a`](https://github.com/mastra-ai/mastra/commit/cca0f8a543eca15c24be21c8ee43dc46fb7aefae), [`20f7f87`](https://github.com/mastra-ai/mastra/commit/20f7f878953cb0965962d1e83a463be5e4ba2c26), [`65b62c0`](https://github.com/mastra-ai/mastra/commit/65b62c04c28267ab81f7d6b92ed29ce0ef46671b), [`d4e6c7f`](https://github.com/mastra-ai/mastra/commit/d4e6c7fffdef836fc44276509596e78d7d785729), [`b801545`](https://github.com/mastra-ai/mastra/commit/b80154540bf557de296bcb6f068b5117b5d84ef9), [`ed0e355`](https://github.com/mastra-ai/mastra/commit/ed0e355205da51bac4d11b7a9553c95ef1f505f4), [`b93ce2e`](https://github.com/mastra-ai/mastra/commit/b93ce2ee034c6a0be511b717e1e043e875dca677), [`ddb53f2`](https://github.com/mastra-ai/mastra/commit/ddb53f26142ccf6177dec5392b6dc867ce177d15), [`42a3c74`](https://github.com/mastra-ai/mastra/commit/42a3c748085fee95d4e38e42a4ccbce891ce3e3f), [`21eaa20`](https://github.com/mastra-ai/mastra/commit/21eaa208834ae36721324700023f88cec7cf5c01), [`4580309`](https://github.com/mastra-ai/mastra/commit/45803095e2aed7bf58d878eb206a767b9b0e2489), [`06e428d`](https://github.com/mastra-ai/mastra/commit/06e428d80ccbc54bb74eb6bd6f01a7fd4eddc45f), [`d0db35e`](https://github.com/mastra-ai/mastra/commit/d0db35e00be93f1339525188c102f73dea5867d8), [`b48ddcc`](https://github.com/mastra-ai/mastra/commit/b48ddcc7768c76f02d1dd4ed0f21d417a8b21418), [`578d2c4`](https://github.com/mastra-ai/mastra/commit/578d2c41fc83b13efd88165ff0105904434a6db4), [`b875985`](https://github.com/mastra-ai/mastra/commit/b87598584f0f2b008242ed1f458b7f72ba6d42d1), [`cf6446c`](https://github.com/mastra-ai/mastra/commit/cf6446cae036784bd6802e4bcca8f3cf34a9ca9f), [`a8f39b6`](https://github.com/mastra-ai/mastra/commit/a8f39b629d8bcd6659b61bf71bd5a5dd2f38ed12), [`34844fc`](https://github.com/mastra-ai/mastra/commit/34844fcc7aeff1ae867c0aeedcd990caa520c418), [`04a2433`](https://github.com/mastra-ai/mastra/commit/04a2433d8e533010e23c3af84421d52bd0b3a908), [`85cfc88`](https://github.com/mastra-ai/mastra/commit/85cfc88fc5f196ef97cd2334441cd30cac99bce1), [`f2073f6`](https://github.com/mastra-ai/mastra/commit/f2073f6f2fff59ffca7eeac67579093454a0e761), [`46bb6b2`](https://github.com/mastra-ai/mastra/commit/46bb6b29dd83cabb09cf720dd8a3655860bf5858), [`2bf5b78`](https://github.com/mastra-ai/mastra/commit/2bf5b78761af6606b42ae2e085722eb50cdbc839), [`dc28dbd`](https://github.com/mastra-ai/mastra/commit/dc28dbd89f7afa455a1985c7909adf42ddd6bd48), [`25b8b60`](https://github.com/mastra-ai/mastra/commit/25b8b6074cbb5f0c744e4edb4ce0c5ee1f3771d6), [`41bf075`](https://github.com/mastra-ai/mastra/commit/41bf0759e486ff7eb078ff9d83d532e086a16039), [`73e6b7c`](https://github.com/mastra-ai/mastra/commit/73e6b7c18ee19fbb31c6f9bad4ce23c16212876b), [`68fa51c`](https://github.com/mastra-ai/mastra/commit/68fa51cf57ee7a3b0914d5381870b60e81f0647e), [`faf79ea`](https://github.com/mastra-ai/mastra/commit/faf79ea0d1aa7b2265b070f5323339fa275ebb49), [`b801545`](https://github.com/mastra-ai/mastra/commit/b80154540bf557de296bcb6f068b5117b5d84ef9), [`a1793d7`](https://github.com/mastra-ai/mastra/commit/a1793d7d077ed450125628ede812897ecbf08c4c), [`3645c3d`](https://github.com/mastra-ai/mastra/commit/3645c3d67e0c1f40005035911103deba381d246a), [`a9c8af5`](https://github.com/mastra-ai/mastra/commit/a9c8af5b6b2449e4127ab30b662e79ac025cc4f0), [`028dc61`](https://github.com/mastra-ai/mastra/commit/028dc61f4802fad472603df1538c4ca126f8680f), [`e5688d2`](https://github.com/mastra-ai/mastra/commit/e5688d2945aff1e867eb8b9fc5f25393d6579216), [`1211fcf`](https://github.com/mastra-ai/mastra/commit/1211fcf499acbda22ca8d399ae820789c69609f2), [`a1c0020`](https://github.com/mastra-ai/mastra/commit/a1c002066736e54a4b07c03968b0df19cf1afb03), [`c0540d2`](https://github.com/mastra-ai/mastra/commit/c0540d2dfccec3470eed3cab539221557abd1fc5), [`297e55e`](https://github.com/mastra-ai/mastra/commit/297e55ea3d0eef280c3776bec401584ce3c2bff2), [`e995603`](https://github.com/mastra-ai/mastra/commit/e995603f64d4f03d234e7f53cc3ab03d9dfea502), [`2f0c604`](https://github.com/mastra-ai/mastra/commit/2f0c604b802068a063689fec4d0db91daa80d7c9), [`85636a2`](https://github.com/mastra-ai/mastra/commit/85636a2341aca229feb83c72b730a0d50f2f1753), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`2ef4283`](https://github.com/mastra-ai/mastra/commit/2ef428340d1eda6c6c8cfba4b90a43b88739f098), [`d45b854`](https://github.com/mastra-ai/mastra/commit/d45b854640e9b3d7fe7434061be988359ac2f470), [`b801545`](https://github.com/mastra-ai/mastra/commit/b80154540bf557de296bcb6f068b5117b5d84ef9), [`a7404f9`](https://github.com/mastra-ai/mastra/commit/a7404f965b811a0eef35d41a5e69c91187eb0cf6), [`5068168`](https://github.com/mastra-ai/mastra/commit/50681683948fd55928d029a63f0de7e56976e1f4), [`956901a`](https://github.com/mastra-ai/mastra/commit/956901a36b84a85f3985d9e5956494749b7ea72c), [`92004fd`](https://github.com/mastra-ai/mastra/commit/92004fd001edd2a0647f2531e0daf76a5825fc00), [`b389368`](https://github.com/mastra-ai/mastra/commit/b389368b0574a6a575a5835a11fc41437b78b842), [`6c9ad80`](https://github.com/mastra-ai/mastra/commit/6c9ad808c8503e812a72a48827ce425b9e78970f), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`eda5b00`](https://github.com/mastra-ai/mastra/commit/eda5b0081bdc49cc17ac8fc1267fccabb5e7a33f), [`838fd4b`](https://github.com/mastra-ai/mastra/commit/838fd4b1526c5385424d8e147d3d1d37137f6a13), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`835e2cd`](https://github.com/mastra-ai/mastra/commit/835e2cdba8dbef6848f18bb73bbb8aa9dad6dddf), [`65b62c0`](https://github.com/mastra-ai/mastra/commit/65b62c04c28267ab81f7d6b92ed29ce0ef46671b), [`0fca057`](https://github.com/mastra-ai/mastra/commit/0fca05756ac8409494d54c70106db2ef7dfc81fc), [`57c3117`](https://github.com/mastra-ai/mastra/commit/57c3117dd4d0dd0ad0835edb1bf410b6ec76fba0), [`9db8229`](https://github.com/mastra-ai/mastra/commit/9db8229bc7c30133fb1c085f710f1fbf94e5d335), [`7a96951`](https://github.com/mastra-ai/mastra/commit/7a96951771a6aab850ceafefc73afe684ef24b21), [`a3f884c`](https://github.com/mastra-ai/mastra/commit/a3f884c6fa230f9c75049f7105df5f1429fa406e), [`e89310a`](https://github.com/mastra-ai/mastra/commit/e89310a8db29a663a85c6a31a8c376cc8f59c129), [`7c0cf99`](https://github.com/mastra-ai/mastra/commit/7c0cf997ab2306a176aa84fe6f611574721120c3), [`46bb6b2`](https://github.com/mastra-ai/mastra/commit/46bb6b29dd83cabb09cf720dd8a3655860bf5858), [`a3269cd`](https://github.com/mastra-ai/mastra/commit/a3269cd4b92683780591ca782be491834787b861), [`152679c`](https://github.com/mastra-ai/mastra/commit/152679c4b74de8be29e5d932f6c4b35e79397516), [`18afca3`](https://github.com/mastra-ai/mastra/commit/18afca34ba6ab013152da61b2017dc443c2aa08b), [`b6b3f49`](https://github.com/mastra-ai/mastra/commit/b6b3f49d35ce62b584d9753361a7db7c15045801), [`a2d52e1`](https://github.com/mastra-ai/mastra/commit/a2d52e1d6a1542e3eb994853145ffd113fd02c2f), [`3a7e3d0`](https://github.com/mastra-ai/mastra/commit/3a7e3d01211a7ad5696b242f033cd1a30b06912e), [`436ea9d`](https://github.com/mastra-ai/mastra/commit/436ea9d4fb8146250bb106fd0f0200ea1cfd47d5), [`a7a34bf`](https://github.com/mastra-ai/mastra/commit/a7a34bfcc2235daa6229d6783b3ad1a2eaa25c56), [`65b62c0`](https://github.com/mastra-ai/mastra/commit/65b62c04c28267ab81f7d6b92ed29ce0ef46671b), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`4416137`](https://github.com/mastra-ai/mastra/commit/4416137e6b9368c11fcb31edba3d1937cfe61a40), [`678e1c3`](https://github.com/mastra-ai/mastra/commit/678e1c36f9118165c3315c2fd739334d9138eff4), [`f2243ae`](https://github.com/mastra-ai/mastra/commit/f2243ae5e0d183fdbb8c8f3ff81fa86d32036a6c), [`70d59a9`](https://github.com/mastra-ai/mastra/commit/70d59a97fb2a5953c5853bf5f5fdfdc02d2337e7), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`005161a`](https://github.com/mastra-ai/mastra/commit/005161a90ac9a8d25a4f9b1edc95c139e5d295d9), [`14f9341`](https://github.com/mastra-ai/mastra/commit/14f934145150a2531abfc1c36d03909fd05b5c56), [`b329f0d`](https://github.com/mastra-ai/mastra/commit/b329f0d45ce719acdd8926263269de6c91e31305), [`539d0e6`](https://github.com/mastra-ai/mastra/commit/539d0e638c9eaa3b71d99df067061af4ddbb2045), [`46bb6b2`](https://github.com/mastra-ai/mastra/commit/46bb6b29dd83cabb09cf720dd8a3655860bf5858), [`c7283d7`](https://github.com/mastra-ai/mastra/commit/c7283d715d9c8a7f3d3afd904f402ea0d4d843c4), [`7cb014d`](https://github.com/mastra-ai/mastra/commit/7cb014d3bdd96739c4bd7ad968af34c6a88ced7e), [`fe99f41`](https://github.com/mastra-ai/mastra/commit/fe99f41ea293a172da840c89a782d13a7c7a7709), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`9f4ab32`](https://github.com/mastra-ai/mastra/commit/9f4ab3242bd686ff43c871fedeede1ed21260dbf), [`2558c00`](https://github.com/mastra-ai/mastra/commit/2558c00b338025de29f778ca72b6bd05e5726349), [`2f14b26`](https://github.com/mastra-ai/mastra/commit/2f14b267b06da7255ef7c131f1138993c39bd733), [`590d6ca`](https://github.com/mastra-ai/mastra/commit/590d6ca9fa6ccf8b55dcf2e98da080ee1a348f67), [`1511a1d`](https://github.com/mastra-ai/mastra/commit/1511a1d65d9e2ccc08b4d6746f8e8053fc48549e), [`f431c23`](https://github.com/mastra-ai/mastra/commit/f431c2321cf186f09565c42ddba33ee40cb96b6d), [`ea7ca75`](https://github.com/mastra-ai/mastra/commit/ea7ca755a470f026606949567da32e69969ef16c), [`436ea9d`](https://github.com/mastra-ai/mastra/commit/436ea9d4fb8146250bb106fd0f0200ea1cfd47d5), [`cfaeff3`](https://github.com/mastra-ai/mastra/commit/cfaeff3e03d6743682a8db0c1c30c2dab11b3171), [`180bdc5`](https://github.com/mastra-ai/mastra/commit/180bdc5398e253ffae7eaff6330409d7f5254f8b), [`45a1ab7`](https://github.com/mastra-ai/mastra/commit/45a1ab7f300637be9d5b953d82b58f77b64c1b56), [`70d59a9`](https://github.com/mastra-ai/mastra/commit/70d59a97fb2a5953c5853bf5f5fdfdc02d2337e7), [`33a206d`](https://github.com/mastra-ai/mastra/commit/33a206d7d0a52d17ebab8db5224c5091c086c86d), [`38643be`](https://github.com/mastra-ai/mastra/commit/38643beb41ab0d1f67b8754f057781022448a618), [`7c34315`](https://github.com/mastra-ai/mastra/commit/7c343153b26755a4cdcdd7897d2b4bd2758c29d4)]:
  - @mastra/core@1.76.0

## 1.7.0-alpha.2

### Minor Changes

- Added a `reattach` option to `RailwaySandbox`, `PlatformSandbox`, and `E2BSandbox` to control what happens when a persisted `sandboxId` can't be reattached on `start()`. ([#26675](https://github.com/mastra-ai/mastra/pull/26675))

  - `'best-effort'` (default, unchanged behavior): carry on without the lost sandbox. Railway and Platform provision a replacement; E2B first looks for another sandbox with the same logical `id` and only creates a new one if none is found.
  - `'required'`: throw a `SandboxError` with code `SANDBOX_REATTACH_FAILED` instead, so the caller can tell the user their previous sandbox (and its state) is gone rather than silently starting a fresh one.

  Transient errors such as auth, rate limit, or network failures still propagate unchanged. Clones inherit the parent's `reattach` setting.

  ```ts
  const sandbox = new RailwaySandbox({ sandboxId: session.sandboxId, reattach: 'required' });

  try {
    await sandbox.start();
  } catch (error) {
    if (error instanceof SandboxError && error.code === 'SANDBOX_REATTACH_FAILED') {
      // Previous sandbox is gone: ask the user to start fresh, then clear the persisted sandboxId.
    }
  }
  ```

### Patch Changes

- Updated dependencies [[`a65d0c7`](https://github.com/mastra-ai/mastra/commit/a65d0c788824081f36ccd95078a8d1214ff687c4), [`e89310a`](https://github.com/mastra-ai/mastra/commit/e89310a8db29a663a85c6a31a8c376cc8f59c129), [`590d6ca`](https://github.com/mastra-ai/mastra/commit/590d6ca9fa6ccf8b55dcf2e98da080ee1a348f67)]:
  - @mastra/core@1.76.0-alpha.9

## 1.7.0-alpha.1

### Patch Changes

- Fixed `PlatformSandbox.getInfo()` asking the workspace proxy about a `sandboxId` hint before `start()` had confirmed it, which failed the first tool call of a resumed session with `404 not_found`. `getInfo()` now answers from local state until the sandbox has started in the current process. `start()` also treats a `410 sandbox_destroyed` answer for the reattach id like a 404 and provisions a fresh sandbox instead of failing the resumed session. ([#26488](https://github.com/mastra-ai/mastra/pull/26488))

  Fixed `PlatformSandbox.stop()` releasing the sandbox through the proxy's `DELETE /sandbox/:id`, which kills the VM on E2B. `Mastra.shutdown()` stops every registered workspace, so a host restart destroyed every live session. `stop()` now sends nothing and keeps the sandbox id, so the next `start()` reattaches; `destroy()` is the only call that releases the VM and its checkpoint.

  Added a `sandboxId` property that exposes the platform's id for the running sandbox, so callers persist an id the proxy recognises and reattach to the same sandbox later:

  ```ts
  const sandbox = new PlatformSandbox({ id: 'session-1', environmentId: 'env_123' });
  await sandbox.start();
  const persisted = sandbox.sandboxId; // the platform's id, undefined before start()

  const resumed = new PlatformSandbox({ id: 'session-1', environmentId: 'env_123', sandboxId: persisted });
  await resumed.start(); // { outcome: 'connected' }
  ```

- Updated dependencies [[`65b62c0`](https://github.com/mastra-ai/mastra/commit/65b62c04c28267ab81f7d6b92ed29ce0ef46671b), [`68fa51c`](https://github.com/mastra-ai/mastra/commit/68fa51cf57ee7a3b0914d5381870b60e81f0647e), [`297e55e`](https://github.com/mastra-ai/mastra/commit/297e55ea3d0eef280c3776bec401584ce3c2bff2), [`65b62c0`](https://github.com/mastra-ai/mastra/commit/65b62c04c28267ab81f7d6b92ed29ce0ef46671b), [`57c3117`](https://github.com/mastra-ai/mastra/commit/57c3117dd4d0dd0ad0835edb1bf410b6ec76fba0), [`7a96951`](https://github.com/mastra-ai/mastra/commit/7a96951771a6aab850ceafefc73afe684ef24b21), [`436ea9d`](https://github.com/mastra-ai/mastra/commit/436ea9d4fb8146250bb106fd0f0200ea1cfd47d5), [`65b62c0`](https://github.com/mastra-ai/mastra/commit/65b62c04c28267ab81f7d6b92ed29ce0ef46671b), [`14f9341`](https://github.com/mastra-ai/mastra/commit/14f934145150a2531abfc1c36d03909fd05b5c56), [`2558c00`](https://github.com/mastra-ai/mastra/commit/2558c00b338025de29f778ca72b6bd05e5726349), [`436ea9d`](https://github.com/mastra-ai/mastra/commit/436ea9d4fb8146250bb106fd0f0200ea1cfd47d5), [`38643be`](https://github.com/mastra-ai/mastra/commit/38643beb41ab0d1f67b8754f057781022448a618)]:
  - @mastra/core@1.76.0-alpha.4

## 1.7.0-alpha.0

### Minor Changes

- Added a `repos` option to `createRepoTemplate` to build one template from several repositories. ([#26039](https://github.com/mastra-ai/mastra/pull/26039))

  - Each entry has its own `getRepositoryAccess` and `setupCommand`, and is cloned to `<workingDirectory>/<repo>`.
  - `workspaceSetupCommand` runs once at the working directory after every repository.
  - `continueOnSetupFailure` records a failing repository setup in `.mastra-sandbox/setup-failed` instead of failing the build.
  - Writes a marker at `.mastra-sandbox/repos/<repo>` after each repository setup and `.mastra-sandbox/workspace-setup` after the workspace step.

  ```ts
  const template = createRepoTemplate({
    repos: [
      {
        getRepositoryAccess: async () => ({ cloneUrl: 'https://github.com/acme/app.git' }),
        setupCommand: 'pnpm install --frozen-lockfile',
      },
      {
        getRepositoryAccess: async () => ({
          cloneUrl: 'https://github.com/acme/shared-ui.git',
          authorization: { scheme: 'bearer', token: process.env.GITHUB_TOKEN! },
        }),
        setupCommand: 'pnpm install --frozen-lockfile',
      },
    ],
    workspaceSetupCommand: 'cd app && pnpm link ../shared-ui',
    workingDirectory: '/home/user/repos',
  });
  ```

### Patch Changes

- Updated dependencies [[`9a511a4`](https://github.com/mastra-ai/mastra/commit/9a511a4ff5ac8349f4d4b64b0f432576fa3c8656), [`ed0e355`](https://github.com/mastra-ai/mastra/commit/ed0e355205da51bac4d11b7a9553c95ef1f505f4), [`b93ce2e`](https://github.com/mastra-ai/mastra/commit/b93ce2ee034c6a0be511b717e1e043e875dca677), [`21eaa20`](https://github.com/mastra-ai/mastra/commit/21eaa208834ae36721324700023f88cec7cf5c01), [`4580309`](https://github.com/mastra-ai/mastra/commit/45803095e2aed7bf58d878eb206a767b9b0e2489), [`dc28dbd`](https://github.com/mastra-ai/mastra/commit/dc28dbd89f7afa455a1985c7909adf42ddd6bd48), [`a3f884c`](https://github.com/mastra-ai/mastra/commit/a3f884c6fa230f9c75049f7105df5f1429fa406e), [`a7a34bf`](https://github.com/mastra-ai/mastra/commit/a7a34bfcc2235daa6229d6783b3ad1a2eaa25c56), [`70d59a9`](https://github.com/mastra-ai/mastra/commit/70d59a97fb2a5953c5853bf5f5fdfdc02d2337e7), [`f431c23`](https://github.com/mastra-ai/mastra/commit/f431c2321cf186f09565c42ddba33ee40cb96b6d), [`70d59a9`](https://github.com/mastra-ai/mastra/commit/70d59a97fb2a5953c5853bf5f5fdfdc02d2337e7), [`33a206d`](https://github.com/mastra-ai/mastra/commit/33a206d7d0a52d17ebab8db5224c5091c086c86d)]:
  - @mastra/core@1.76.0-alpha.3

## 1.6.2

### Patch Changes

- Fixed nested folders in `PlatformFilesystem` workspaces so they open in Studio. Folders created by writing a file under them are now reported by `stat` and `exists`, and can be listed with `readdir`. ([#25184](https://github.com/mastra-ai/mastra/pull/25184))

- Updated dependencies [[`9ce3444`](https://github.com/mastra-ai/mastra/commit/9ce3444d1a6b17e72b0a20c74603abaf252a843e), [`af4aed5`](https://github.com/mastra-ai/mastra/commit/af4aed50ad96b340d82a67c3f01cbf358b156ab2), [`43fbe75`](https://github.com/mastra-ai/mastra/commit/43fbe75535650345cf61dee00cf3e7b3f5efaf7f), [`e1c3193`](https://github.com/mastra-ai/mastra/commit/e1c3193b18ca68e5cca27f7dce9b0381a6e7b95d), [`4375206`](https://github.com/mastra-ai/mastra/commit/4375206131ff701405a20326be660b2e8c3742f8), [`4601dfa`](https://github.com/mastra-ai/mastra/commit/4601dfac7c2bfdf04f041b1725c8ac4ae92a8d7d), [`77c6f1c`](https://github.com/mastra-ai/mastra/commit/77c6f1cf14ba9ba47257829646a4569c4462d12f), [`9773cb2`](https://github.com/mastra-ai/mastra/commit/9773cb2f22f307c8017f887af4a6728c4cb875c9), [`3d25340`](https://github.com/mastra-ai/mastra/commit/3d2534080417711d1baf2ad947d1205ca95a34cd), [`3b77788`](https://github.com/mastra-ai/mastra/commit/3b77788a08df1e754282d39c42823e6e1c5f2742), [`ebd03fd`](https://github.com/mastra-ai/mastra/commit/ebd03fd3bc93fe3930747956724252f7c8834826), [`63927e8`](https://github.com/mastra-ai/mastra/commit/63927e89c1b9db0fc87eef8503e3a03204f24b09), [`68cc668`](https://github.com/mastra-ai/mastra/commit/68cc66800e5ce6f5d62189fc7b5ef9d71cf80971), [`987257a`](https://github.com/mastra-ai/mastra/commit/987257a34cda8a153fe592c31d75fbb1dee55202), [`65a93a2`](https://github.com/mastra-ai/mastra/commit/65a93a2a3b1434d605a6a417cb83d2d58e16bfc0), [`fd92729`](https://github.com/mastra-ai/mastra/commit/fd92729380a29f2a0ec822e39f3c09eb9aaa5ac5), [`5e799d9`](https://github.com/mastra-ai/mastra/commit/5e799d9098c5c4d1078bf90647e95db699be11ea), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`afc53be`](https://github.com/mastra-ai/mastra/commit/afc53be4c95e83e8613f4e080b5a1926e63c5da6), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`2c57ba8`](https://github.com/mastra-ai/mastra/commit/2c57ba896b04215fface2a8216b88fe59cfdd041), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`93fe2d6`](https://github.com/mastra-ai/mastra/commit/93fe2d6a9e47861d90cc0fd0080aefdb8cabb612), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`781762b`](https://github.com/mastra-ai/mastra/commit/781762b2dcd0c8cc7f9b8ab73824ec45a5225db7), [`4d187b7`](https://github.com/mastra-ai/mastra/commit/4d187b79d7ecce4d2f357f5fe385b414a532ff19), [`cc0da13`](https://github.com/mastra-ai/mastra/commit/cc0da13b826d5f74213c4d8c470acf8698542249), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`2a28888`](https://github.com/mastra-ai/mastra/commit/2a28888f7dfee74f84ec548c9c222cfd1aa7f393), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`f6effda`](https://github.com/mastra-ai/mastra/commit/f6effdabafa9fc6388478b3e281ad4c457d4200b), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`ec005d5`](https://github.com/mastra-ai/mastra/commit/ec005d517ea10b7742e67f7e75bf89259d72c37e), [`f2c3f8c`](https://github.com/mastra-ai/mastra/commit/f2c3f8c74e1d7bc7baca5303b36320b0b361775c), [`ed67acc`](https://github.com/mastra-ai/mastra/commit/ed67acc3213d469ed69610c304c604693cfec383), [`0c23429`](https://github.com/mastra-ai/mastra/commit/0c23429515b5c307e8a5759f5be1ce20d09d2347), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`b33985e`](https://github.com/mastra-ai/mastra/commit/b33985eac3e019f58d3785c48ef85eae48b4e068), [`c64bf75`](https://github.com/mastra-ai/mastra/commit/c64bf752dec931f5f6c8b3d5afc91a8b9aa670d8), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`79c3b1f`](https://github.com/mastra-ai/mastra/commit/79c3b1fa4d470585a00558b317ed47db9b1decd4), [`4092ef2`](https://github.com/mastra-ai/mastra/commit/4092ef29aad09f2ba5f90c92a4d4d3bd444eae67), [`5f1efad`](https://github.com/mastra-ai/mastra/commit/5f1efad5c2230a4de715cad3f01859b4ff9d255b), [`32d71df`](https://github.com/mastra-ai/mastra/commit/32d71df2ce71573b40f9a62b8ac510ad6eadd859), [`7f4ce21`](https://github.com/mastra-ai/mastra/commit/7f4ce2190029710851d95f7b75a2fb724782483c), [`4b5b212`](https://github.com/mastra-ai/mastra/commit/4b5b212f1c5caa40a2d02308806bbe610f194503), [`75c2ee1`](https://github.com/mastra-ai/mastra/commit/75c2ee1280a5441eb66c31f23a53a52b42244686), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`1fe1c2b`](https://github.com/mastra-ai/mastra/commit/1fe1c2b6f0b29481dca62a9199af751d594e3ea6), [`d3a7dba`](https://github.com/mastra-ai/mastra/commit/d3a7dbaeb0d027e1e47e4e4ddb2ede271a007e17), [`561e2a6`](https://github.com/mastra-ai/mastra/commit/561e2a6c8a44dbfd91eae390e14671462497cf85), [`64916c6`](https://github.com/mastra-ai/mastra/commit/64916c66e8d9dec107da2f81e7c1301471bf7bc3), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`444debd`](https://github.com/mastra-ai/mastra/commit/444debd7104ada74fa15d0e70703ee9be180fc75), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`1ba1588`](https://github.com/mastra-ai/mastra/commit/1ba158873dadf3d290b111981c3bc7ef95ab1d1c), [`9a35897`](https://github.com/mastra-ai/mastra/commit/9a3589783a40157759f939f5c63bba3c8aef1c1c), [`9997948`](https://github.com/mastra-ai/mastra/commit/99979482956903a2cd685b31f53370dd33074799), [`279a736`](https://github.com/mastra-ai/mastra/commit/279a736c62495cac0f247ab1402a8c80bccc892a), [`d3a22a7`](https://github.com/mastra-ai/mastra/commit/d3a22a78f12e094118ce80ec35b63987009644e2), [`56fef1c`](https://github.com/mastra-ai/mastra/commit/56fef1cdd92a671c3de2cc5e4a319c637f700cf4), [`8156816`](https://github.com/mastra-ai/mastra/commit/815681621dd88997608c5b7e8f0f87fe03cd1d18), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`4d40bd9`](https://github.com/mastra-ai/mastra/commit/4d40bd91ccb00db163365a319b5d82bfb56a9ace), [`5e799d9`](https://github.com/mastra-ai/mastra/commit/5e799d9098c5c4d1078bf90647e95db699be11ea), [`94ba70e`](https://github.com/mastra-ai/mastra/commit/94ba70ea6ba8a53f5e4010392bf3bbaecde7966d), [`d2f0cd7`](https://github.com/mastra-ai/mastra/commit/d2f0cd7c5d5f5f06cf5b65cf78a9f14ac052dbb1), [`6946c4d`](https://github.com/mastra-ai/mastra/commit/6946c4db91071cb43fb36514a42a1e4ce05c37ba), [`e4e0f90`](https://github.com/mastra-ai/mastra/commit/e4e0f9000d73396609ae2f2b6c31259ade43078c), [`7540eb1`](https://github.com/mastra-ai/mastra/commit/7540eb176c32ffbff45ccc64a8d8fce82ce42a94), [`c01f1ad`](https://github.com/mastra-ai/mastra/commit/c01f1ad358db0ab361fdb1b2f4f77c88540c2671), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`b537ab1`](https://github.com/mastra-ai/mastra/commit/b537ab14714870e058775530bc55b37c9115613f), [`a7895fc`](https://github.com/mastra-ai/mastra/commit/a7895fce693e499c08c4784c57d4c4f46c0e1ccb), [`d8fcd39`](https://github.com/mastra-ai/mastra/commit/d8fcd397230a83f5fe9ef16e6b41237f057c2c29), [`5197f81`](https://github.com/mastra-ai/mastra/commit/5197f81d6a5641f80f0ee6596ac085653b38cca3), [`caf94f9`](https://github.com/mastra-ai/mastra/commit/caf94f9c1927f737370b6118264bd16c7210a765), [`9623397`](https://github.com/mastra-ai/mastra/commit/96233975b75135852c9b1616b91fd8cb54c77a53), [`5036e61`](https://github.com/mastra-ai/mastra/commit/5036e6179bee4105ad8f1fc57d315f78024565f4), [`4375206`](https://github.com/mastra-ai/mastra/commit/4375206131ff701405a20326be660b2e8c3742f8), [`676fcbf`](https://github.com/mastra-ai/mastra/commit/676fcbfc5f770ee45560c7b558b17ad5ff25d9e7), [`6c9f7ab`](https://github.com/mastra-ai/mastra/commit/6c9f7abf9bdce0a52450398b31d497519465bb80), [`d9790fd`](https://github.com/mastra-ai/mastra/commit/d9790fd00d95063de288560f6a0d2bac8f57cc4d), [`4375206`](https://github.com/mastra-ai/mastra/commit/4375206131ff701405a20326be660b2e8c3742f8), [`91196d5`](https://github.com/mastra-ai/mastra/commit/91196d5a6d582c0f494622d0378f33e22d881659), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0c2fe6c`](https://github.com/mastra-ai/mastra/commit/0c2fe6c00909795234270c8ea2c2c53882d63798), [`5e799d9`](https://github.com/mastra-ai/mastra/commit/5e799d9098c5c4d1078bf90647e95db699be11ea), [`f36019c`](https://github.com/mastra-ai/mastra/commit/f36019c24193e0d29f920663851198bf45e3d12f), [`5026973`](https://github.com/mastra-ai/mastra/commit/50269736f432cee1170627b2b6f88ba1431e837f), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`4edc93d`](https://github.com/mastra-ai/mastra/commit/4edc93dedadb89686aad75a4853cb0aa807d256e), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`dd01709`](https://github.com/mastra-ai/mastra/commit/dd01709f780562f9ff8c72d977f3da5ae265970e), [`d4e350a`](https://github.com/mastra-ai/mastra/commit/d4e350a5c1e29a7da5a22da52ed1f33431403012)]:
  - @mastra/core@1.72.0

## 1.6.2-alpha.0

### Patch Changes

- Fixed nested folders in `PlatformFilesystem` workspaces so they open in Studio. Folders created by writing a file under them are now reported by `stat` and `exists`, and can be listed with `readdir`. ([#25184](https://github.com/mastra-ai/mastra/pull/25184))

- Updated dependencies [[`9773cb2`](https://github.com/mastra-ai/mastra/commit/9773cb2f22f307c8017f887af4a6728c4cb875c9)]:
  - @mastra/core@1.72.0-alpha.4

## 1.6.1

### Patch Changes

- Reorganized the README so usage appears before configuration details. ([#23488](https://github.com/mastra-ai/mastra/pull/23488))

- Updated dependencies [[`7eda39b`](https://github.com/mastra-ai/mastra/commit/7eda39bd17356b9985ae44e663ccde30ff0fedea), [`bb09e86`](https://github.com/mastra-ai/mastra/commit/bb09e860dd6c510365f0d7ab068b194707e99fa4), [`4cbb201`](https://github.com/mastra-ai/mastra/commit/4cbb201261df30574a98c241615cd096d9f223f3), [`cf9cd79`](https://github.com/mastra-ai/mastra/commit/cf9cd7963c664c7e9bcebe41fe7e492d1557ff6f), [`f3d9aae`](https://github.com/mastra-ai/mastra/commit/f3d9aae7bb5324c9dc7abc7caa166595f7582190), [`4d72bce`](https://github.com/mastra-ai/mastra/commit/4d72bceaf323dfe617a882b80defb2ab21b97ed9), [`44a6da9`](https://github.com/mastra-ai/mastra/commit/44a6da9cd61b7767a73c66da42ab1eca4073cd42), [`1e1fe34`](https://github.com/mastra-ai/mastra/commit/1e1fe3483102459e6ec9da096756b4efb12f5221), [`1fc8225`](https://github.com/mastra-ai/mastra/commit/1fc82255bdca4340a7e0fd42aa61a97359d6c87f), [`67315b1`](https://github.com/mastra-ai/mastra/commit/67315b10f2058a17bfadcb053e49b0d4655bf3bb), [`2efa6ba`](https://github.com/mastra-ai/mastra/commit/2efa6bab6dde4e77e21adf1a9d59e8e44710194b), [`cc91725`](https://github.com/mastra-ai/mastra/commit/cc917251a39b60050b9d8b004f5d281f4a578b75), [`0d56f39`](https://github.com/mastra-ai/mastra/commit/0d56f398f08a1527eff72de4c0b66f74606b17d6), [`3da908f`](https://github.com/mastra-ai/mastra/commit/3da908fdf7b80b4e1577aa85cc45f28bb54aebc9), [`ecada83`](https://github.com/mastra-ai/mastra/commit/ecada83c1960b02720dcff6323ce5cd3fc39cbe7), [`7865a79`](https://github.com/mastra-ai/mastra/commit/7865a79253be403bd79a307224c9968d98ea0b72), [`e7df80e`](https://github.com/mastra-ai/mastra/commit/e7df80e4e043c1c63ad81fbb4b6e0716f43c43bd), [`1fa24d1`](https://github.com/mastra-ai/mastra/commit/1fa24d1d23bfac997af49fa5a9684b67c8249612), [`9c43765`](https://github.com/mastra-ai/mastra/commit/9c437659d97fe45775ecf3a35e121db15c6405fa), [`0096d5c`](https://github.com/mastra-ai/mastra/commit/0096d5c819d058ecc4de645774e4f46b8c122656), [`119d2aa`](https://github.com/mastra-ai/mastra/commit/119d2aaded03df03325fe25b167e71603cd8a2aa), [`50c588e`](https://github.com/mastra-ai/mastra/commit/50c588ebe5e3fe407efe3a36e46c380a9d2492fb), [`de5db60`](https://github.com/mastra-ai/mastra/commit/de5db6055519fd22d1673a2ad90e69d1b45ac54d), [`8fb01c3`](https://github.com/mastra-ai/mastra/commit/8fb01c3ef5a4b2e2d2ac5099f19f663c7e7a382c)]:
  - @mastra/core@1.66.0

## 1.6.1-alpha.0

### Patch Changes

- Reorganized the README so usage appears before configuration details. ([#23488](https://github.com/mastra-ai/mastra/pull/23488))

- Updated dependencies [[`4cbb201`](https://github.com/mastra-ai/mastra/commit/4cbb201261df30574a98c241615cd096d9f223f3), [`44a6da9`](https://github.com/mastra-ai/mastra/commit/44a6da9cd61b7767a73c66da42ab1eca4073cd42), [`1e1fe34`](https://github.com/mastra-ai/mastra/commit/1e1fe3483102459e6ec9da096756b4efb12f5221), [`67315b1`](https://github.com/mastra-ai/mastra/commit/67315b10f2058a17bfadcb053e49b0d4655bf3bb), [`cc91725`](https://github.com/mastra-ai/mastra/commit/cc917251a39b60050b9d8b004f5d281f4a578b75), [`50c588e`](https://github.com/mastra-ai/mastra/commit/50c588ebe5e3fe407efe3a36e46c380a9d2492fb)]:
  - @mastra/core@1.66.0-alpha.3

## 1.6.0

### Minor Changes

- Added `MASTRA_PLATFORM_REGION` support to `PlatformSandbox` and `PlatformFilesystem`. Set it to `us` or `eu` (case-insensitive) to route the workspace proxy to the regional replica at `https://workspaces.us.mastra.ai` or `https://workspaces.eu.mastra.ai`. When unset, calls continue to hit the global default `https://workspaces.mastra.ai`. An explicit `MASTRA_WORKSPACE_PROXY_URL` still overrides both. ([#20925](https://github.com/mastra-ai/mastra/pull/20925))

  ```bash
  # Route platform workspaces to the EU replica
  export MASTRA_PLATFORM_REGION=eu
  ```

### Patch Changes

- Fixed workspace providers to support `MASTRA_PLATFORM_SECRET_KEY` for local development while preserving precedence for explicit `accessToken` options and `MASTRA_PLATFORM_ACCESS_TOKEN`. ([#23361](https://github.com/mastra-ai/mastra/pull/23361))

- Repository templates now pin to the last default-branch head resolved for the same clone URL when the lookup fails, instead of dropping the repo steps and booting the base image. ([#22947](https://github.com/mastra-ai/mastra/pull/22947))

- Updated dependencies [[`b72c747`](https://github.com/mastra-ai/mastra/commit/b72c747a1a698c829c7c1d42e75f72c6d1808dde), [`89f2486`](https://github.com/mastra-ai/mastra/commit/89f2486028ce25c5db19d1f361d5f65cd3ff93e5), [`d7bd6f7`](https://github.com/mastra-ai/mastra/commit/d7bd6f7a91daf528f34d628faede4a916421b0dd), [`e4852fc`](https://github.com/mastra-ai/mastra/commit/e4852fc42fc9e72559370dfa9b0e3f20ccf9012e), [`917da71`](https://github.com/mastra-ai/mastra/commit/917da711580cdc9e8f7ca474b301f3611a5c46ed), [`51b2b5e`](https://github.com/mastra-ai/mastra/commit/51b2b5e0ca9ba4a23fc6544246ad9822c4dbd92e), [`ae375e6`](https://github.com/mastra-ai/mastra/commit/ae375e6799af20820d90e30f63a084ba1507b771), [`b5a1a42`](https://github.com/mastra-ai/mastra/commit/b5a1a42763b891c54d7027b916622d45f95f86b9), [`1778103`](https://github.com/mastra-ai/mastra/commit/17781034204a151a1ff910e9d11d21effe22a9e0), [`2911c88`](https://github.com/mastra-ai/mastra/commit/2911c88c9226f5ab969abc3a90b161c1c1cbd19e), [`66029df`](https://github.com/mastra-ai/mastra/commit/66029dfccb8f5d69f26d8df920647b34a0a763d1), [`eef3409`](https://github.com/mastra-ai/mastra/commit/eef3409c125dcd9765e4a85d17f10c53892f6f2c), [`0ea8af0`](https://github.com/mastra-ai/mastra/commit/0ea8af012ba2fe1431c93697399d7643f09c073d), [`8ff274c`](https://github.com/mastra-ai/mastra/commit/8ff274c2ffea84a910c5d6ce93dd6d3c048f8082), [`f649ea0`](https://github.com/mastra-ai/mastra/commit/f649ea0f006436e7268c3b0fa45f9865a02130cc), [`54adc91`](https://github.com/mastra-ai/mastra/commit/54adc9164beee68798adff0bfb0ebae4dada1af0), [`6a05d36`](https://github.com/mastra-ai/mastra/commit/6a05d36a0bb28390539cfc5a4f12c847474d28d2), [`2801d26`](https://github.com/mastra-ai/mastra/commit/2801d26b69bbe8929d302abd09619a68b4cc0d98), [`c9b21f3`](https://github.com/mastra-ai/mastra/commit/c9b21f39792f892c91e616a67f9cfb19ddaa8046), [`88abfbf`](https://github.com/mastra-ai/mastra/commit/88abfbf5fb256e0b5602aafa6e733192f9a4236a), [`e243fec`](https://github.com/mastra-ai/mastra/commit/e243feca17207d1545ff9776e8fff635b0ff4189), [`18d99e7`](https://github.com/mastra-ai/mastra/commit/18d99e7b5687ea6a1cdb601fa5c4209a03b97c02), [`b1227c0`](https://github.com/mastra-ai/mastra/commit/b1227c0604be8c33dd02705fe6978df70c32f87d), [`ce2f341`](https://github.com/mastra-ai/mastra/commit/ce2f34171a8e1eee428219670a0a7897083c91e3), [`4337eb6`](https://github.com/mastra-ai/mastra/commit/4337eb6230681b791ec1ad56e58af9fb8329a5ce), [`4362001`](https://github.com/mastra-ai/mastra/commit/436200145bf70d825918e60f6dbdd2389a749e48), [`ffc6440`](https://github.com/mastra-ai/mastra/commit/ffc6440d13b9392b3cf1ff309d3b9cde4a791038), [`a0ad935`](https://github.com/mastra-ai/mastra/commit/a0ad9351eaf8527d1515051ddf3998ee258b9acd), [`cd71bd3`](https://github.com/mastra-ai/mastra/commit/cd71bd3beb8afe08a106d1e29efee387ffb74cd1), [`a5f22f4`](https://github.com/mastra-ai/mastra/commit/a5f22f4ff1763ab9679391a6a9118358c8059e11), [`5901b59`](https://github.com/mastra-ai/mastra/commit/5901b5920a08f1869092e5e4cccf8a0be17781e9), [`8c96b5c`](https://github.com/mastra-ai/mastra/commit/8c96b5c6a3c55d4665ee8dd4f9c55bb14e8e1dd3), [`f31c3fa`](https://github.com/mastra-ai/mastra/commit/f31c3fae16a0710f9e52dba9bccc0018f9da2ac1), [`9d647e2`](https://github.com/mastra-ai/mastra/commit/9d647e25b51cd246ef974d9cad6b05dfdd37126e)]:
  - @mastra/core@1.65.0

## 1.6.0-alpha.2

### Patch Changes

- Fixed workspace providers to support `MASTRA_PLATFORM_SECRET_KEY` for local development while preserving precedence for explicit `accessToken` options and `MASTRA_PLATFORM_ACCESS_TOKEN`. ([#23361](https://github.com/mastra-ai/mastra/pull/23361))

- Updated dependencies [[`0ea8af0`](https://github.com/mastra-ai/mastra/commit/0ea8af012ba2fe1431c93697399d7643f09c073d)]:
  - @mastra/core@1.65.0-alpha.12

## 1.6.0-alpha.1

### Minor Changes

- Added `MASTRA_PLATFORM_REGION` support to `PlatformSandbox` and `PlatformFilesystem`. Set it to `us` or `eu` (case-insensitive) to route the workspace proxy to the regional replica at `https://workspaces.us.mastra.ai` or `https://workspaces.eu.mastra.ai`. When unset, calls continue to hit the global default `https://workspaces.mastra.ai`. An explicit `MASTRA_WORKSPACE_PROXY_URL` still overrides both. ([#20925](https://github.com/mastra-ai/mastra/pull/20925))

  ```bash
  # Route platform workspaces to the EU replica
  export MASTRA_PLATFORM_REGION=eu
  ```

### Patch Changes

- Updated dependencies [[`54adc91`](https://github.com/mastra-ai/mastra/commit/54adc9164beee68798adff0bfb0ebae4dada1af0), [`c9b21f3`](https://github.com/mastra-ai/mastra/commit/c9b21f39792f892c91e616a67f9cfb19ddaa8046), [`4362001`](https://github.com/mastra-ai/mastra/commit/436200145bf70d825918e60f6dbdd2389a749e48)]:
  - @mastra/core@1.65.0-alpha.9

## 1.5.1-alpha.0

### Patch Changes

- Repository templates now pin to the last default-branch head resolved for the same clone URL when the lookup fails, instead of dropping the repo steps and booting the base image. ([#22947](https://github.com/mastra-ai/mastra/pull/22947))

- Updated dependencies [[`b72c747`](https://github.com/mastra-ai/mastra/commit/b72c747a1a698c829c7c1d42e75f72c6d1808dde), [`89f2486`](https://github.com/mastra-ai/mastra/commit/89f2486028ce25c5db19d1f361d5f65cd3ff93e5), [`1778103`](https://github.com/mastra-ai/mastra/commit/17781034204a151a1ff910e9d11d21effe22a9e0), [`2801d26`](https://github.com/mastra-ai/mastra/commit/2801d26b69bbe8929d302abd09619a68b4cc0d98), [`ffc6440`](https://github.com/mastra-ai/mastra/commit/ffc6440d13b9392b3cf1ff309d3b9cde4a791038), [`f31c3fa`](https://github.com/mastra-ai/mastra/commit/f31c3fae16a0710f9e52dba9bccc0018f9da2ac1), [`9d647e2`](https://github.com/mastra-ai/mastra/commit/9d647e25b51cd246ef974d9cad6b05dfdd37126e)]:
  - @mastra/core@1.65.0-alpha.1

## 1.5.0

### Minor Changes

- Added reusable sandbox templates to Platform workspaces. Build templates through `PlatformSandbox` with the portable `Template()` API; Platform content-addresses each serialized definition for reuse. Public repositories can be warmed lazily with `createRepoTemplate()`. Use `cpuCount()` and `memoryMB()` to size E2B template builds and sandboxes created from the exact or a resource-matched stale build; `createRepoTemplate()` accepts the same sizing as plain options. Railway ignores these resource methods. ([#22065](https://github.com/mastra-ai/mastra/pull/22065))

  ```ts
  const sandbox = new PlatformSandbox({
    environmentId,
    template: Template().cpuCount(4).memoryMB(8192).runCmd('pnpm install'),
  });

  // createRepoTemplate takes the whole sandbox context: a session with no
  // repository gets undefined back and boots the provider default.
  const repoSandbox = new PlatformSandbox({
    environmentId,
    template: createRepoTemplate({
      getRepositoryAccess: async () => ({ cloneUrl: 'https://github.com/mastra-ai/mastra.git' }),
      setupCommand: 'pnpm install --frozen-lockfile',
      memoryMB: 2048,
    }),
  });
  ```

  Template environment values are serialized by default. Pass `{ ephemeral: true }` to `setEnvs()` for short-lived build credentials that must stay outside the definition, identity, persistent record, and runtime environment. `Template.build()` can eagerly start or reuse the provider build without provisioning a sandbox. Railway includes transient values in its provider cache input, so rotating one may trigger another Railway build while the Platform template ID remains stable.

  `PlatformSandbox.start()` never blocks on a template build. When the exact template is not yet ready, Platform boots the sandbox on the best available fallback (an E2B prior member of the same family with matching effective resources if one exists, otherwise the provider base template) and builds the exact template in the background. A provider-base fallback may use provider-default resources. The sandbox surfaces `templatePending` for observability; reconcile filesystem state in your own runtime setup (for example, an `onStart` hook that runs `git fetch && git checkout <sha>`).

  `Template().withFamily(key)` attaches a caller-supplied family key that groups successive builds of the "same thing" (e.g. the same repository+workdir across commits) so an E2B definition can warm-start on a resource-matched prior member of the same family. Railway doesn't use family fallback. `createRepoTemplate()` populates the key automatically as `repo:<cloneUrl>:<workdir>`.

- Changed Platform sandboxes to use E2B by default. Set sandboxProvider or SANDBOX_PROVIDER to railway to opt into Railway. ([#22065](https://github.com/mastra-ai/mastra/pull/22065))

- `createRepoTemplate` accepts `buildEnv`: environment variables for the build steps only (for example, remote cache credentials). They never enter the template definition or identity. Template fallback warnings now redact credentials. ([#22698](https://github.com/mastra-ai/mastra/pull/22698))

- `createRepoTemplate` now runs each command (clone, fetch, checkout, and each setup command) as its own cached build step, and `setupCommand` accepts an array. A new `workingDirectory` option sets the cwd for the build and for sandboxes created from the template; the repository is cloned to `<workingDirectory>/<repo>`. When omitted, the clone lands in the base image's working directory instead of `$HOME`. ([#22698](https://github.com/mastra-ai/mastra/pull/22698))

  ```ts
  createRepoTemplate({
    getRepositoryAccess,
    setupCommand: ['pnpm i', 'pnpm build'],
    workingDirectory: '/workspace',
  });
  ```

- **Added a `workingDirectory` option to `MastraSandboxOptions`, honored by every sandbox provider** ([#22697](https://github.com/mastra-ai/mastra/pull/22697))

  Every sandbox now accepts one instance-level `workingDirectory` option that sets the default directory for command execution and process spawns. A per-command `cwd` always wins over it, and when neither is provided each provider keeps its previous default (E2B home, docker `/workspace`, Vercel serverless `/tmp`, and so on). The effective value is readable through the new `sandbox.workingDirectory` getter.

  ```ts
  const sandbox = new E2BSandbox({ workingDirectory: '/home/user/my-repo' });
  await sandbox.executeCommand('pwd'); // /home/user/my-repo
  await sandbox.executeCommand('pwd', [], { cwd: '/tmp' }); // /tmp
  ```

  Providers that already carried this concept under other names keep those names working as deprecated aliases feeding the same field: `workingDir` on `@mastra/docker` and `@mastra/apple-container`, and `workdir` on `@mastra/modal`. When both the alias and `workingDirectory` are set, `workingDirectory` wins. Use absolute paths: the value is passed to the provider as-is, so `~` and environment variables like `$HOME` are not expanded (except where a provider documents expansion, such as `LocalSandbox` expanding `~`).

### Patch Changes

- Update README to include accurate, up-to-date information ([#22858](https://github.com/mastra-ai/mastra/pull/22858))

- Removed the automatic sandbox snapshot Factory took after every agent turn. ([#22846](https://github.com/mastra-ai/mastra/pull/22846))

  `PlatformSandbox.destroy()` on E2B now only kills the sandbox instead of first asking the platform to delete a recovery checkpoint.

- Repo templates now write `.mastra-sandbox/setup` beside the checkout as their last build step. It contains `sha256:<digest of the setup commands>`, so a sandbox booted from the template can tell that this setup already ran. ([#22837](https://github.com/mastra-ai/mastra/pull/22837))

- Repository templates now clone with `--depth=1 --single-branch`, so template builds transfer less history. ([#22840](https://github.com/mastra-ai/mastra/pull/22840))

- Fixed repo templates silently degrading to a repo-less template on hosts without a `git` binary (deployed Mastra servers), which made every session cold-clone at runtime. GitHub (github.com) clone URLs now resolve the default-branch head through the GitHub REST API; other hosts keep using `git ls-remote`. ([#22833](https://github.com/mastra-ai/mastra/pull/22833))

- Remove `CHANGELOG.md` from distributed npm files resulting in reduced package size ([#22737](https://github.com/mastra-ai/mastra/pull/22737))

- Updated dependencies [[`3910c77`](https://github.com/mastra-ai/mastra/commit/3910c77413a3058ab270c6dbc74a59bc3cdf67ea), [`decd47d`](https://github.com/mastra-ai/mastra/commit/decd47d0db2a891a6832e226557145b6658b0b19), [`c1d3422`](https://github.com/mastra-ai/mastra/commit/c1d3422e8052a4282e8547df914b6231e5345f01), [`285ce1c`](https://github.com/mastra-ai/mastra/commit/285ce1c1399341a37e76233aa94dbf9f1a41bd5d), [`e983f74`](https://github.com/mastra-ai/mastra/commit/e983f749873189f767f509eb33d1a3596c0f1c74), [`4596348`](https://github.com/mastra-ai/mastra/commit/45963483f4cd2810f0646469916f74266a3dd607), [`7686114`](https://github.com/mastra-ai/mastra/commit/7686114e3802f4cea414377eaf10999524d670fa), [`ea56b1f`](https://github.com/mastra-ai/mastra/commit/ea56b1fa6e0f99673d2f8a5b7dacc8d351507ff7), [`50469b2`](https://github.com/mastra-ai/mastra/commit/50469b2d085fc8550579ca4b741eb359d1705abc), [`5b5e3cc`](https://github.com/mastra-ai/mastra/commit/5b5e3cc006950b0ff9720c5be8396d4c95e8a6ac), [`809e882`](https://github.com/mastra-ai/mastra/commit/809e882ee9c154ac642eaed396163df706db6ae4), [`cedc25d`](https://github.com/mastra-ai/mastra/commit/cedc25d8c2dec005d8b10b6ce2d36feef1162ff0), [`1255235`](https://github.com/mastra-ai/mastra/commit/125523539237c39f84d126d16476093336089c0d), [`2e87ffb`](https://github.com/mastra-ai/mastra/commit/2e87ffbb454cc88bd8a8c022d1e46325e7907482), [`a499422`](https://github.com/mastra-ai/mastra/commit/a499422cd7eccca184cac7b7a684a6199784aa82), [`cf58c86`](https://github.com/mastra-ai/mastra/commit/cf58c86cb48ccc72677bdaa422e43f102683184c), [`a3606a0`](https://github.com/mastra-ai/mastra/commit/a3606a09f3deaeef17caf04b9c6a0d7cd6b80fe6), [`4095752`](https://github.com/mastra-ai/mastra/commit/40957529233d202446ebecab1f59c76e99910230), [`74b21fd`](https://github.com/mastra-ai/mastra/commit/74b21fd9bbe88e770d9acf4e00e01c8bbb7c9e61), [`045c3c7`](https://github.com/mastra-ai/mastra/commit/045c3c78f2129fea5d4467bb26cff2b49788b3d0), [`a3606a0`](https://github.com/mastra-ai/mastra/commit/a3606a09f3deaeef17caf04b9c6a0d7cd6b80fe6), [`449d112`](https://github.com/mastra-ai/mastra/commit/449d1120cc1f9c43a71308a9fd8b178cfb11355f), [`e8aca33`](https://github.com/mastra-ai/mastra/commit/e8aca339dc92c0b60baad3d948a7c48ec9ae106f), [`c5c9ffc`](https://github.com/mastra-ai/mastra/commit/c5c9ffc3b36bdc7b17d6f911be81e28ba02acfad), [`9d3073c`](https://github.com/mastra-ai/mastra/commit/9d3073c230dbff45d58c259d676b2b137afd2ff5), [`19b71cf`](https://github.com/mastra-ai/mastra/commit/19b71cf1de8afe6f69a3171d8a5a28086790e49b), [`2a0ca02`](https://github.com/mastra-ai/mastra/commit/2a0ca021d95e23f1d1c0b5fe858b0b56f71fe0ba), [`ff539f6`](https://github.com/mastra-ai/mastra/commit/ff539f6dc21137fbeb3f0867f07069cbce45c15f), [`9fdb3bc`](https://github.com/mastra-ai/mastra/commit/9fdb3bc0f9bfab5269b4f3045595e62323da5d3a), [`d53a056`](https://github.com/mastra-ai/mastra/commit/d53a05614893e8d1bbfdab50b42c19435e6bd065), [`420052f`](https://github.com/mastra-ai/mastra/commit/420052fcac3fc672be17fe655667dfbdbd35a2cc), [`28ce924`](https://github.com/mastra-ai/mastra/commit/28ce924276eeca492e6a360e5482ed20c2785ef6)]:
  - @mastra/core@1.64.0

## 1.5.0-alpha.6

### Patch Changes

- Removed the automatic sandbox snapshot Factory took after every agent turn. ([#22846](https://github.com/mastra-ai/mastra/pull/22846))

  `PlatformSandbox.destroy()` on E2B now only kills the sandbox instead of first asking the platform to delete a recovery checkpoint.

- Repository templates now clone with `--depth=1 --single-branch`, so template builds transfer less history. ([#22840](https://github.com/mastra-ai/mastra/pull/22840))

- Updated dependencies [[`7686114`](https://github.com/mastra-ai/mastra/commit/7686114e3802f4cea414377eaf10999524d670fa), [`50469b2`](https://github.com/mastra-ai/mastra/commit/50469b2d085fc8550579ca4b741eb359d1705abc), [`809e882`](https://github.com/mastra-ai/mastra/commit/809e882ee9c154ac642eaed396163df706db6ae4), [`74b21fd`](https://github.com/mastra-ai/mastra/commit/74b21fd9bbe88e770d9acf4e00e01c8bbb7c9e61), [`c5c9ffc`](https://github.com/mastra-ai/mastra/commit/c5c9ffc3b36bdc7b17d6f911be81e28ba02acfad)]:
  - @mastra/core@1.64.0-alpha.9

## 1.5.0-alpha.5

### Patch Changes

- Update README to include accurate, up-to-date information ([#22858](https://github.com/mastra-ai/mastra/pull/22858))

- Updated dependencies [[`e983f74`](https://github.com/mastra-ai/mastra/commit/e983f749873189f767f509eb33d1a3596c0f1c74), [`cedc25d`](https://github.com/mastra-ai/mastra/commit/cedc25d8c2dec005d8b10b6ce2d36feef1162ff0), [`9fdb3bc`](https://github.com/mastra-ai/mastra/commit/9fdb3bc0f9bfab5269b4f3045595e62323da5d3a)]:
  - @mastra/core@1.64.0-alpha.7

## 1.5.0-alpha.4

### Patch Changes

- Repo templates now write `.mastra-sandbox/setup` beside the checkout as their last build step. It contains `sha256:<digest of the setup commands>`, so a sandbox booted from the template can tell that this setup already ran. ([#22837](https://github.com/mastra-ai/mastra/pull/22837))

- Updated dependencies [[`c1d3422`](https://github.com/mastra-ai/mastra/commit/c1d3422e8052a4282e8547df914b6231e5345f01), [`4596348`](https://github.com/mastra-ai/mastra/commit/45963483f4cd2810f0646469916f74266a3dd607), [`e8aca33`](https://github.com/mastra-ai/mastra/commit/e8aca339dc92c0b60baad3d948a7c48ec9ae106f), [`19b71cf`](https://github.com/mastra-ai/mastra/commit/19b71cf1de8afe6f69a3171d8a5a28086790e49b)]:
  - @mastra/core@1.64.0-alpha.6

## 1.5.0-alpha.3

### Patch Changes

- Fixed repo templates silently degrading to a repo-less template on hosts without a `git` binary (deployed Mastra servers), which made every session cold-clone at runtime. GitHub (github.com) clone URLs now resolve the default-branch head through the GitHub REST API; other hosts keep using `git ls-remote`. ([#22833](https://github.com/mastra-ai/mastra/pull/22833))

- Updated dependencies [[`decd47d`](https://github.com/mastra-ai/mastra/commit/decd47d0db2a891a6832e226557145b6658b0b19), [`285ce1c`](https://github.com/mastra-ai/mastra/commit/285ce1c1399341a37e76233aa94dbf9f1a41bd5d), [`5b5e3cc`](https://github.com/mastra-ai/mastra/commit/5b5e3cc006950b0ff9720c5be8396d4c95e8a6ac), [`045c3c7`](https://github.com/mastra-ai/mastra/commit/045c3c78f2129fea5d4467bb26cff2b49788b3d0), [`d53a056`](https://github.com/mastra-ai/mastra/commit/d53a05614893e8d1bbfdab50b42c19435e6bd065)]:
  - @mastra/core@1.64.0-alpha.5

## 1.5.0-alpha.2

### Minor Changes

- `createRepoTemplate` accepts `buildEnv`: environment variables for the build steps only (for example, remote cache credentials). They never enter the template definition or identity. Template fallback warnings now redact credentials. ([#22698](https://github.com/mastra-ai/mastra/pull/22698))

- `createRepoTemplate` now runs each command (clone, fetch, checkout, and each setup command) as its own cached build step, and `setupCommand` accepts an array. A new `workingDirectory` option sets the cwd for the build and for sandboxes created from the template; the repository is cloned to `<workingDirectory>/<repo>`. When omitted, the clone lands in the base image's working directory instead of `$HOME`. ([#22698](https://github.com/mastra-ai/mastra/pull/22698))

  ```ts
  createRepoTemplate({
    getRepositoryAccess,
    setupCommand: ['pnpm i', 'pnpm build'],
    workingDirectory: '/workspace',
  });
  ```

### Patch Changes

- Updated dependencies [[`a499422`](https://github.com/mastra-ai/mastra/commit/a499422cd7eccca184cac7b7a684a6199784aa82), [`9d3073c`](https://github.com/mastra-ai/mastra/commit/9d3073c230dbff45d58c259d676b2b137afd2ff5)]:
  - @mastra/core@1.64.0-alpha.4

## 1.5.0-alpha.1

### Minor Changes

- **Added a `workingDirectory` option to `MastraSandboxOptions`, honored by every sandbox provider** ([#22697](https://github.com/mastra-ai/mastra/pull/22697))

  Every sandbox now accepts one instance-level `workingDirectory` option that sets the default directory for command execution and process spawns. A per-command `cwd` always wins over it, and when neither is provided each provider keeps its previous default (E2B home, docker `/workspace`, Vercel serverless `/tmp`, and so on). The effective value is readable through the new `sandbox.workingDirectory` getter.

  ```ts
  const sandbox = new E2BSandbox({ workingDirectory: '/home/user/my-repo' });
  await sandbox.executeCommand('pwd'); // /home/user/my-repo
  await sandbox.executeCommand('pwd', [], { cwd: '/tmp' }); // /tmp
  ```

  Providers that already carried this concept under other names keep those names working as deprecated aliases feeding the same field: `workingDir` on `@mastra/docker` and `@mastra/apple-container`, and `workdir` on `@mastra/modal`. When both the alias and `workingDirectory` are set, `workingDirectory` wins. Use absolute paths: the value is passed to the provider as-is, so `~` and environment variables like `$HOME` are not expanded (except where a provider documents expansion, such as `LocalSandbox` expanding `~`).

### Patch Changes

- Remove `CHANGELOG.md` from distributed npm files resulting in reduced package size ([#22737](https://github.com/mastra-ai/mastra/pull/22737))

- Updated dependencies [[`cf58c86`](https://github.com/mastra-ai/mastra/commit/cf58c86cb48ccc72677bdaa422e43f102683184c), [`449d112`](https://github.com/mastra-ai/mastra/commit/449d1120cc1f9c43a71308a9fd8b178cfb11355f), [`2a0ca02`](https://github.com/mastra-ai/mastra/commit/2a0ca021d95e23f1d1c0b5fe858b0b56f71fe0ba), [`ff539f6`](https://github.com/mastra-ai/mastra/commit/ff539f6dc21137fbeb3f0867f07069cbce45c15f), [`420052f`](https://github.com/mastra-ai/mastra/commit/420052fcac3fc672be17fe655667dfbdbd35a2cc), [`28ce924`](https://github.com/mastra-ai/mastra/commit/28ce924276eeca492e6a360e5482ed20c2785ef6)]:
  - @mastra/core@1.64.0-alpha.2

## 1.5.0-alpha.0

### Minor Changes

- Added reusable sandbox templates to Platform workspaces. Build templates through `PlatformSandbox` with the portable `Template()` API; Platform content-addresses each serialized definition for reuse. Public repositories can be warmed lazily with `createRepoTemplate()`. Use `cpuCount()` and `memoryMB()` to size E2B template builds and sandboxes created from the exact or a resource-matched stale build; `createRepoTemplate()` accepts the same sizing as plain options. Railway ignores these resource methods. ([#22065](https://github.com/mastra-ai/mastra/pull/22065))

  ```ts
  const sandbox = new PlatformSandbox({
    environmentId,
    template: Template().cpuCount(4).memoryMB(8192).runCmd('pnpm install'),
  });

  // createRepoTemplate takes the whole sandbox context: a session with no
  // repository gets undefined back and boots the provider default.
  const repoSandbox = new PlatformSandbox({
    environmentId,
    template: createRepoTemplate({
      getRepositoryAccess: async () => ({ cloneUrl: 'https://github.com/mastra-ai/mastra.git' }),
      setupCommand: 'pnpm install --frozen-lockfile',
      memoryMB: 2048,
    }),
  });
  ```

  Template environment values are serialized by default. Pass `{ ephemeral: true }` to `setEnvs()` for short-lived build credentials that must stay outside the definition, identity, persistent record, and runtime environment. `Template.build()` can eagerly start or reuse the provider build without provisioning a sandbox. Railway includes transient values in its provider cache input, so rotating one may trigger another Railway build while the Platform template ID remains stable.

  `PlatformSandbox.start()` never blocks on a template build. When the exact template is not yet ready, Platform boots the sandbox on the best available fallback (an E2B prior member of the same family with matching effective resources if one exists, otherwise the provider base template) and builds the exact template in the background. A provider-base fallback may use provider-default resources. The sandbox surfaces `templatePending` for observability; reconcile filesystem state in your own runtime setup (for example, an `onStart` hook that runs `git fetch && git checkout <sha>`).

  `Template().withFamily(key)` attaches a caller-supplied family key that groups successive builds of the "same thing" (e.g. the same repository+workdir across commits) so an E2B definition can warm-start on a resource-matched prior member of the same family. Railway doesn't use family fallback. `createRepoTemplate()` populates the key automatically as `repo:<cloneUrl>:<workdir>`.

- Changed Platform sandboxes to use E2B by default. Set sandboxProvider or SANDBOX_PROVIDER to railway to opt into Railway. ([#22065](https://github.com/mastra-ai/mastra/pull/22065))

### Patch Changes

- Updated dependencies [[`3910c77`](https://github.com/mastra-ai/mastra/commit/3910c77413a3058ab270c6dbc74a59bc3cdf67ea)]:
  - @mastra/core@1.63.3-alpha.0

## 1.4.1

### Patch Changes

- Starting a sandbox now reports whether it created a fresh sandbox or reconnected to an existing one, so an `onStart` handler can run first-time setup only when it's actually needed: ([#21984](https://github.com/mastra-ai/mastra/pull/21984))

  ```typescript
  new E2BSandbox({
    id: 'session-1',
    onStart: async ({ outcome }) => {
      if (outcome === 'created') await cloneRepo();
    },
  });
  ```

- Honor the sandbox runtime environment (`setEnv()`/`getEnv()` from `@mastra/core`) in every workspace sandbox provider. Environment variables set after construction now reach subsequent commands on all providers: ([#22250](https://github.com/mastra-ai/mastra/pull/22250))

  - Process-manager-routed providers (E2B, Blaxel, Cloudflare, Daytona, Docker, Modal, Vercel microVM spawns) inherit the merge from the core spawn wrapper; their duplicated per-manager env plumbing is removed.
  - Providers with their own exec transports (AgentCore, Apple Container, Railway, Vercel microVM and serverless `executeCommand`, Platform's private-network, WebSocket lease, and E2B lease paths) now merge `getEnv()` under per-call env.

  Constructor `env` continues to behave as before: it seeds the sandbox runtime environment, and providers that bake env into the VM or container at creation time (Docker, Modal, Railway, Apple Container, Vercel, Platform) still do so. Per-call `env` on `executeCommand` still takes precedence for that command only.

  Removed exported types (minor bump for these two packages): `BlaxelProcessManagerOptions` from `@mastra/blaxel` and `RailwayProcessManagerOptions` from `@mastra/railway`. Both existed only to pass `env` into a process manager constructed by hand; the core spawn wrapper now owns that merge, so the option and its type are gone.

- Updated dependencies [[`79f04a7`](https://github.com/mastra-ai/mastra/commit/79f04a7f6c6829da541139f638f2f1d267916e08), [`65edab1`](https://github.com/mastra-ai/mastra/commit/65edab1c233d17b8f163bad12fca410d0e6f16b1), [`1e47b75`](https://github.com/mastra-ai/mastra/commit/1e47b7520cab4cfaa8daed52f17e2e6d14ff7539), [`ab20a38`](https://github.com/mastra-ai/mastra/commit/ab20a38d0275f8d85e0f3833bd87ef487bcc609f), [`fd4d5fe`](https://github.com/mastra-ai/mastra/commit/fd4d5fe4f943699b85db5e74404f190d5a6b8c2a), [`ae8790c`](https://github.com/mastra-ai/mastra/commit/ae8790c4bfaa088d2ab279d1dcc06f326b9fd109), [`2c85f42`](https://github.com/mastra-ai/mastra/commit/2c85f428e04ccd63ea31a7ec80b5b327afdad555), [`11bbeb9`](https://github.com/mastra-ai/mastra/commit/11bbeb9b108ef2264e05acefc6dafb9cbb342921), [`48ef1f1`](https://github.com/mastra-ai/mastra/commit/48ef1f1d24eedafbb07f64e659a81b52b67b8bf6), [`aa3a85d`](https://github.com/mastra-ai/mastra/commit/aa3a85daf094c683bb97efdf4b6a696d2e474af5), [`d29d06f`](https://github.com/mastra-ai/mastra/commit/d29d06fe00bbd35b4571150ea04c59d2ed783c71), [`e6516df`](https://github.com/mastra-ai/mastra/commit/e6516dfcdae4f4ac0e7971d84359a81385ee602f), [`1a485f3`](https://github.com/mastra-ai/mastra/commit/1a485f3538f5ec64d58bd8b5e1e99de0c695c87b), [`0d37487`](https://github.com/mastra-ai/mastra/commit/0d37487d9f349388a3f1cef6a536cf9dcc4b6273), [`8661d7d`](https://github.com/mastra-ai/mastra/commit/8661d7d7179f0a024456aabdd8679bcecd09ac28), [`dbbfeb8`](https://github.com/mastra-ai/mastra/commit/dbbfeb85ec949dc9ebc0755e1ad262e4f5eba8db), [`575e343`](https://github.com/mastra-ai/mastra/commit/575e343900451021d96110916497d334af7bc252), [`0b2a3d1`](https://github.com/mastra-ai/mastra/commit/0b2a3d1783875c5b97b7b36ab3d03d7360e0dde7), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`3cc9d00`](https://github.com/mastra-ai/mastra/commit/3cc9d00b2b4333e0377a5e9df5eff92c17ce7630), [`cacb839`](https://github.com/mastra-ai/mastra/commit/cacb8392d9e74189b56d857290b0615f98a2683d), [`57de7d6`](https://github.com/mastra-ai/mastra/commit/57de7d644ba7146edb4e9e6111ec4fa98c3a59e9), [`c8e4cea`](https://github.com/mastra-ai/mastra/commit/c8e4ceac9a390d78c8327dff3cdb2861dd71957f), [`ed01e9a`](https://github.com/mastra-ai/mastra/commit/ed01e9a807514a904374bf687a7b8f18750f6f78), [`b47b26e`](https://github.com/mastra-ai/mastra/commit/b47b26e6fe95cb8a3482be2c5e52de157fe59d0b), [`0d37487`](https://github.com/mastra-ai/mastra/commit/0d37487d9f349388a3f1cef6a536cf9dcc4b6273), [`733a537`](https://github.com/mastra-ai/mastra/commit/733a537489a858b5880b2e98809334fba895a221), [`e8e299c`](https://github.com/mastra-ai/mastra/commit/e8e299cc6abdfc39947e2fec25803493015d3882), [`edfc548`](https://github.com/mastra-ai/mastra/commit/edfc548886bc7bae17b681f8b6b41a47eb32bcd2), [`b05f486`](https://github.com/mastra-ai/mastra/commit/b05f48612984d5fe2447ea2d6cdd5c604d285b97), [`a8a4871`](https://github.com/mastra-ai/mastra/commit/a8a4871215f51da95c47129602157ce5372f634a), [`eb9ecaa`](https://github.com/mastra-ai/mastra/commit/eb9ecaa89c36e889749e3b825cfc507ce7f7980b), [`4ff3ee2`](https://github.com/mastra-ai/mastra/commit/4ff3ee2bff7ed07528b4817f8f49639031c72a4d), [`9207dfa`](https://github.com/mastra-ai/mastra/commit/9207dfab8062e5fc68b751684797ff86fe0b4e70), [`5165cdc`](https://github.com/mastra-ai/mastra/commit/5165cdcdcf50e144bb8113278535196cc9b07065), [`e737014`](https://github.com/mastra-ai/mastra/commit/e737014e0fc7035759762bb5b48baef1d6c0f6a7), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`f591643`](https://github.com/mastra-ai/mastra/commit/f591643becdf0be9bddce6ba1748e64bc30d77f1), [`63796ba`](https://github.com/mastra-ai/mastra/commit/63796ba0fda60253be17535e68f6bbbf1e6ffa09), [`b1ad324`](https://github.com/mastra-ai/mastra/commit/b1ad324d657f3544b0701332aef7eb10e9a36258), [`61c566d`](https://github.com/mastra-ai/mastra/commit/61c566dd2f2cde2b23ed8f139924e530d4202214), [`c24754c`](https://github.com/mastra-ai/mastra/commit/c24754c1fb6fe144e5051e536e98c8a18b0214ac), [`12c61d2`](https://github.com/mastra-ai/mastra/commit/12c61d280c8cb208bc3c8dbcbe5dcc60cf9d1cd0), [`c46eb09`](https://github.com/mastra-ai/mastra/commit/c46eb09ce4987509af57a0ac582c61241a6dd2f1), [`9ee8120`](https://github.com/mastra-ai/mastra/commit/9ee8120ce17f76b9f617489e05a283353742690a), [`d975e92`](https://github.com/mastra-ai/mastra/commit/d975e924d4936f46c386bd3dee39c671720289f6), [`45dd6ee`](https://github.com/mastra-ai/mastra/commit/45dd6ee089bd7df0d0c98a10098e483fd388e04a), [`4e9a228`](https://github.com/mastra-ai/mastra/commit/4e9a2283d5fd6ed1b70a2751eb3dc2cbf82ada20), [`d6ce34a`](https://github.com/mastra-ai/mastra/commit/d6ce34aeceb06ddf3d595a1eed5cc74f481a46a1), [`f95f468`](https://github.com/mastra-ai/mastra/commit/f95f468cf1e7c2b924a13826494f98b8f2ccd581), [`30ed33e`](https://github.com/mastra-ai/mastra/commit/30ed33ee14084a26019aba15fceadda6d6ddefaf), [`04a815f`](https://github.com/mastra-ai/mastra/commit/04a815fc8971d29e97fcdcc5008a1eb472fc00ff), [`1cfa878`](https://github.com/mastra-ai/mastra/commit/1cfa8784d8da0dfaa0317e5048bc48b6084a5ea5), [`9a12ef3`](https://github.com/mastra-ai/mastra/commit/9a12ef3fccf3f4186db0f294f4ee1f02cf4d8db2), [`32d3583`](https://github.com/mastra-ai/mastra/commit/32d358332cb8ac2306b83b73cf3536e74dbd435e), [`7960688`](https://github.com/mastra-ai/mastra/commit/7960688828e04eaf3106e34f7758fa580257eef6), [`91ad69d`](https://github.com/mastra-ai/mastra/commit/91ad69d64994c89199b0c55399e64ed91c61df2f), [`8dc408d`](https://github.com/mastra-ai/mastra/commit/8dc408d34438f9e13297f792c11a5cfd6cf952e1), [`c92def1`](https://github.com/mastra-ai/mastra/commit/c92def10a13c822972c96f0a4ca6ffc1f4258aed), [`63041eb`](https://github.com/mastra-ai/mastra/commit/63041eb4c50b520a0a80e03d4cd6ea99f67715a0), [`c118318`](https://github.com/mastra-ai/mastra/commit/c1183181c9804303db4b511c2e2648f8b714712b), [`c5eaec5`](https://github.com/mastra-ai/mastra/commit/c5eaec5a860d80d0e3805e67db0414b87ac8cbed), [`fc07c64`](https://github.com/mastra-ai/mastra/commit/fc07c6465043e08e99193a6751a01c56ffc2e7a1), [`cced745`](https://github.com/mastra-ai/mastra/commit/cced745a056ec2225c5bc702e32d848847aa8b65), [`542dee2`](https://github.com/mastra-ai/mastra/commit/542dee254167f974ff8cbbbfc0ce10f9a2616a7b), [`3c19dce`](https://github.com/mastra-ai/mastra/commit/3c19dcef8e73062a80627a4927eae3ec11145afd), [`aca2869`](https://github.com/mastra-ai/mastra/commit/aca2869b2031982f3c4a2f52525c9be7cf123ef8), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`e6f8450`](https://github.com/mastra-ai/mastra/commit/e6f845074d478527026b18d85031b23353e1d0a4), [`895e9df`](https://github.com/mastra-ai/mastra/commit/895e9dfc17d6f34299eca64e317ded9e5f5e5ef8), [`e66b2ba`](https://github.com/mastra-ai/mastra/commit/e66b2ba100db63eaeab6e21e1ea34b113f2ec781), [`3e8727e`](https://github.com/mastra-ai/mastra/commit/3e8727e11ec1a5d733acedb5c872896394be18c1)]:
  - @mastra/core@1.62.0

## 1.4.1-alpha.1

### Patch Changes

- Starting a sandbox now reports whether it created a fresh sandbox or reconnected to an existing one, so an `onStart` handler can run first-time setup only when it's actually needed: ([#21984](https://github.com/mastra-ai/mastra/pull/21984))

  ```typescript
  new E2BSandbox({
    id: 'session-1',
    onStart: async ({ outcome }) => {
      if (outcome === 'created') await cloneRepo();
    },
  });
  ```

- Updated dependencies [[`4ff3ee2`](https://github.com/mastra-ai/mastra/commit/4ff3ee2bff7ed07528b4817f8f49639031c72a4d), [`c24754c`](https://github.com/mastra-ai/mastra/commit/c24754c1fb6fe144e5051e536e98c8a18b0214ac), [`45dd6ee`](https://github.com/mastra-ai/mastra/commit/45dd6ee089bd7df0d0c98a10098e483fd388e04a), [`32d3583`](https://github.com/mastra-ai/mastra/commit/32d358332cb8ac2306b83b73cf3536e74dbd435e), [`aca2869`](https://github.com/mastra-ai/mastra/commit/aca2869b2031982f3c4a2f52525c9be7cf123ef8)]:
  - @mastra/core@1.62.0-alpha.11

## 1.4.1-alpha.0

### Patch Changes

- Honor the sandbox runtime environment (`setEnv()`/`getEnv()` from `@mastra/core`) in every workspace sandbox provider. Environment variables set after construction now reach subsequent commands on all providers: ([#22250](https://github.com/mastra-ai/mastra/pull/22250))

  - Process-manager-routed providers (E2B, Blaxel, Cloudflare, Daytona, Docker, Modal, Vercel microVM spawns) inherit the merge from the core spawn wrapper; their duplicated per-manager env plumbing is removed.
  - Providers with their own exec transports (AgentCore, Apple Container, Railway, Vercel microVM and serverless `executeCommand`, Platform's private-network, WebSocket lease, and E2B lease paths) now merge `getEnv()` under per-call env.

  Constructor `env` continues to behave as before: it seeds the sandbox runtime environment, and providers that bake env into the VM or container at creation time (Docker, Modal, Railway, Apple Container, Vercel, Platform) still do so. Per-call `env` on `executeCommand` still takes precedence for that command only.

  Removed exported types (minor bump for these two packages): `BlaxelProcessManagerOptions` from `@mastra/blaxel` and `RailwayProcessManagerOptions` from `@mastra/railway`. Both existed only to pass `env` into a process manager constructed by hand; the core spawn wrapper now owns that merge, so the option and its type are gone.

- Updated dependencies [[`aa3a85d`](https://github.com/mastra-ai/mastra/commit/aa3a85daf094c683bb97efdf4b6a696d2e474af5), [`d29d06f`](https://github.com/mastra-ai/mastra/commit/d29d06fe00bbd35b4571150ea04c59d2ed783c71), [`e6516df`](https://github.com/mastra-ai/mastra/commit/e6516dfcdae4f4ac0e7971d84359a81385ee602f), [`0b2a3d1`](https://github.com/mastra-ai/mastra/commit/0b2a3d1783875c5b97b7b36ab3d03d7360e0dde7), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`57de7d6`](https://github.com/mastra-ai/mastra/commit/57de7d644ba7146edb4e9e6111ec4fa98c3a59e9), [`e8e299c`](https://github.com/mastra-ai/mastra/commit/e8e299cc6abdfc39947e2fec25803493015d3882), [`edfc548`](https://github.com/mastra-ai/mastra/commit/edfc548886bc7bae17b681f8b6b41a47eb32bcd2), [`a8a4871`](https://github.com/mastra-ai/mastra/commit/a8a4871215f51da95c47129602157ce5372f634a), [`5165cdc`](https://github.com/mastra-ai/mastra/commit/5165cdcdcf50e144bb8113278535196cc9b07065), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`9ee8120`](https://github.com/mastra-ai/mastra/commit/9ee8120ce17f76b9f617489e05a283353742690a), [`d975e92`](https://github.com/mastra-ai/mastra/commit/d975e924d4936f46c386bd3dee39c671720289f6), [`1cfa878`](https://github.com/mastra-ai/mastra/commit/1cfa8784d8da0dfaa0317e5048bc48b6084a5ea5), [`c118318`](https://github.com/mastra-ai/mastra/commit/c1183181c9804303db4b511c2e2648f8b714712b), [`fc07c64`](https://github.com/mastra-ai/mastra/commit/fc07c6465043e08e99193a6751a01c56ffc2e7a1), [`542dee2`](https://github.com/mastra-ai/mastra/commit/542dee254167f974ff8cbbbfc0ce10f9a2616a7b), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`895e9df`](https://github.com/mastra-ai/mastra/commit/895e9dfc17d6f34299eca64e317ded9e5f5e5ef8)]:
  - @mastra/core@1.62.0-alpha.8

## 1.4.0

### Minor Changes

- Added provider-selectable Platform Workspace routing through `SANDBOX_PROVIDER`, with direct E2B command execution and snapshot restore support. ([#21991](https://github.com/mastra-ai/mastra/pull/21991))

  Set `SANDBOX_PROVIDER=e2b` before constructing `PlatformSandbox` or `PlatformFilesystem` to use provider-prefixed E2B routes. Set it to `railway` for provider-prefixed Railway routes, or leave it unset to preserve the legacy `/v1/projects/...` Railway API.

### Patch Changes

- Updated dependencies [[`88d14ca`](https://github.com/mastra-ai/mastra/commit/88d14cac008582a618fecc3d5c7fd3bdf4f6ddc3), [`480e491`](https://github.com/mastra-ai/mastra/commit/480e491588bd6a7a1c9ee4407590ad625dd33952), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`acc3471`](https://github.com/mastra-ai/mastra/commit/acc3471de5f3fde8027ee4e355af292b2bc1bc30), [`b6a771e`](https://github.com/mastra-ai/mastra/commit/b6a771ef23d203ddb348efca8065eff65def8191), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`3bb88dd`](https://github.com/mastra-ai/mastra/commit/3bb88ddf07fb98f3cd16d3bff94e51cd3b45d011), [`d23e75d`](https://github.com/mastra-ai/mastra/commit/d23e75d57cc7cf5b9bfdbee896bf5a6a2484fed7), [`c8faa4e`](https://github.com/mastra-ai/mastra/commit/c8faa4e1cfebaec56b65e754e90b9fe46d153359), [`d378d75`](https://github.com/mastra-ai/mastra/commit/d378d7511f71309ed61a8f6b93cd0361dc6cb70f), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`26d4016`](https://github.com/mastra-ai/mastra/commit/26d40160ff7f7d8bf95fee2039a52cbc83863533), [`7c60df5`](https://github.com/mastra-ai/mastra/commit/7c60df5c7872343fbac5c3e5b1175c8076a5abfd), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`f2031a4`](https://github.com/mastra-ai/mastra/commit/f2031a47445e8f67a89ba1309036816f97ab7a65), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`cad4208`](https://github.com/mastra-ai/mastra/commit/cad42082e6aa1776168a94914f523334be45d929), [`8e529d4`](https://github.com/mastra-ai/mastra/commit/8e529d4ac754efef04b225841349e0da9edf89a6), [`57c5103`](https://github.com/mastra-ai/mastra/commit/57c51035a2a36e3df3c4f32f46bb789a66ed5946), [`038b7b4`](https://github.com/mastra-ai/mastra/commit/038b7b405cb4ac25ab3f3031334111b1f87ac112), [`4132d61`](https://github.com/mastra-ai/mastra/commit/4132d61f8367077120ee9e6420d3224dffd93c93), [`d378d75`](https://github.com/mastra-ai/mastra/commit/d378d7511f71309ed61a8f6b93cd0361dc6cb70f)]:
  - @mastra/core@1.61.0

## 1.4.0-alpha.0

### Minor Changes

- Added provider-selectable Platform Workspace routing through `SANDBOX_PROVIDER`, with direct E2B command execution and snapshot restore support. ([#21991](https://github.com/mastra-ai/mastra/pull/21991))

  Set `SANDBOX_PROVIDER=e2b` before constructing `PlatformSandbox` or `PlatformFilesystem` to use provider-prefixed E2B routes. Set it to `railway` for provider-prefixed Railway routes, or leave it unset to preserve the legacy `/v1/projects/...` Railway API.

## 1.3.0

### Minor Changes

- Added `ProcessHandle.closeStdin()` to signal end-of-file to background processes. Local and Docker sandboxes support closing stdin, while providers without an available stdin-close API return a provider-specific unsupported-operation error. Providers signal the unsupported case with the new `UnsupportedStdinCloseError`, and the base class supplies that behavior by default so existing `ProcessHandle` subclasses keep compiling. Calling `handle.writer.end()` also closes stdin, and finishes without an error when the provider cannot close stdin. ([#21606](https://github.com/mastra-ai/mastra/pull/21606))

### Patch Changes

- PlatformSandbox restarts use the current sandbox connection after the previous sandbox is deleted or the platform does not return an instance URL, so later commands do not hit a stale sidecar. ([#21798](https://github.com/mastra-ai/mastra/pull/21798))

- Added fallback checkpoint forwarding for Platform sandboxes so the workspace proxy can seed fresh sessions without changing their primary recovery key. ([#21803](https://github.com/mastra-ai/mastra/pull/21803))

  ```typescript
  const sandbox = new PlatformSandbox({
    id: 'session-42',
    seedCheckpointName: 'repo-base',
  });
  ```

- PlatformSandbox now restarts a timed-out sidecar health probe on the next command instead of falling back to the slower lease-based exec path for the sandbox's lifetime. If the in-sandbox sidecar was just slow to boot, later commands recover the fast private-network transport automatically. ([#21798](https://github.com/mastra-ai/mastra/pull/21798))

- Declared checkpoint support (`supportsCheckpoints`) so checkpoint-based features like warm base checkpoints and boot-from-checkpoint know snapshots are real. ([#21798](https://github.com/mastra-ai/mastra/pull/21798))

  ```ts
  // Gate checkpoint-dependent work on the provider's capability flag.
  if (sandbox.supportsCheckpoints) {
    await sandbox.snapshot(); // persists a checkpoint that can seed a later boot
  }
  ```

- Updated dependencies [[`587f6ef`](https://github.com/mastra-ai/mastra/commit/587f6efcfc25880b93760a8607d1cd381ec612fe), [`7e096f0`](https://github.com/mastra-ai/mastra/commit/7e096f02f0dddbf09b85d306458351245ed2f886), [`d7e6745`](https://github.com/mastra-ai/mastra/commit/d7e67456954863c55440ea9c49bc6ceb9949972d), [`6223446`](https://github.com/mastra-ai/mastra/commit/6223446ddce6166e96e0ba5e00d628b615dee8ca), [`15101bb`](https://github.com/mastra-ai/mastra/commit/15101bb53c0d934f31af6b8813b88191e382a5e5), [`4e7a421`](https://github.com/mastra-ai/mastra/commit/4e7a421dce8a48742f785d1e93ad2f43a572b282), [`c2c3deb`](https://github.com/mastra-ai/mastra/commit/c2c3debcf670c7082d0a5e553aa99818a864698c), [`d8308a2`](https://github.com/mastra-ai/mastra/commit/d8308a2be3c07e777393d1017a381dcae3890d30), [`b0a2a07`](https://github.com/mastra-ai/mastra/commit/b0a2a07800d42bd9823292e7db832374ed084c9c), [`74e5bd3`](https://github.com/mastra-ai/mastra/commit/74e5bd315b8b3a1e04cb6cf480bb0f5fc4951dc8), [`242e324`](https://github.com/mastra-ai/mastra/commit/242e3241e73cbd5c9bb86a31ebb49ca0256488d4), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`d774e89`](https://github.com/mastra-ai/mastra/commit/d774e8930c781df8c9effe3763e6b501c099b6cc), [`9c27a53`](https://github.com/mastra-ai/mastra/commit/9c27a53cd9d3de4f3f025bc387d94ce371c33f95), [`8f0a332`](https://github.com/mastra-ai/mastra/commit/8f0a3321bf180368d76fe7b36aa1a8f60f00b6de), [`0b4f108`](https://github.com/mastra-ai/mastra/commit/0b4f1089aa8d92e67c2a8e99726822c5ee410784), [`9acb50f`](https://github.com/mastra-ai/mastra/commit/9acb50f71cec9c362f06820033f90ae6b1f8282f), [`46e9e3f`](https://github.com/mastra-ai/mastra/commit/46e9e3f73babe1bc70080a596cf2ac0b9da48519), [`3f9a190`](https://github.com/mastra-ai/mastra/commit/3f9a19057c027155867b9317294ee4ca7bd0581a), [`dff25a1`](https://github.com/mastra-ai/mastra/commit/dff25a1103fa72ee082a9b6f805ebeb5ce400753), [`6db7a5d`](https://github.com/mastra-ai/mastra/commit/6db7a5dd3dd2b6f7ef75dcd804fcffef5fa83963), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`583e235`](https://github.com/mastra-ai/mastra/commit/583e23519c13af16c1746f9c49722d011216611b), [`b098de9`](https://github.com/mastra-ai/mastra/commit/b098de9d7cb9f672e0883a5c716465a3a689693d), [`e8808e3`](https://github.com/mastra-ai/mastra/commit/e8808e3d8eb585a2565be53e56a7e0e1477352a4), [`a77f8d4`](https://github.com/mastra-ai/mastra/commit/a77f8d4740d2178a74c41e4bf678b4fcd8fa0bb2), [`7f78585`](https://github.com/mastra-ai/mastra/commit/7f785857e401570e2ffb316911f126ed363aa537), [`33374ba`](https://github.com/mastra-ai/mastra/commit/33374ba359e4fb13eaa918ae925fe167a3c55414), [`940bf5c`](https://github.com/mastra-ai/mastra/commit/940bf5ccf04f2c9ebd8a1390431733222a03b1cd), [`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`58c43d3`](https://github.com/mastra-ai/mastra/commit/58c43d3f7cb2eeaeb8ac733ae71dde822348e588), [`ef6e295`](https://github.com/mastra-ai/mastra/commit/ef6e295b59bc25a5b61b633a89c97bcfce9fb465), [`208e1b3`](https://github.com/mastra-ai/mastra/commit/208e1b39f30f4b386e494394e9d71d96f0f90241), [`c938d34`](https://github.com/mastra-ai/mastra/commit/c938d34739936c8ecbabd67ad6a4a4396f41c4c6), [`88ddc7c`](https://github.com/mastra-ai/mastra/commit/88ddc7ce01d40175f13a3228b789a906779680bd), [`f2a4afd`](https://github.com/mastra-ai/mastra/commit/f2a4afd7e37e809669001ed17724b341a5c1f45e), [`d438148`](https://github.com/mastra-ai/mastra/commit/d438148e222c1e2fb3c652725ce75680962ebec4), [`ba05fe0`](https://github.com/mastra-ai/mastra/commit/ba05fe0738f70cb686777546e968237d09269142), [`40d358e`](https://github.com/mastra-ai/mastra/commit/40d358e29d55543803e64b49241122f598ffabc7), [`d26a8d4`](https://github.com/mastra-ai/mastra/commit/d26a8d4281f28414715b333c85bedaf70d0b2890), [`e80cd7e`](https://github.com/mastra-ai/mastra/commit/e80cd7e7683e7d732e1cc6784bcac1d2640d2ce3), [`ccbbcd9`](https://github.com/mastra-ai/mastra/commit/ccbbcd974eedff4367a54ed0e24c9ee742ab2f61), [`1d9a0ea`](https://github.com/mastra-ai/mastra/commit/1d9a0ea4a9901baee6cd56737243bd6d1f631ac0), [`677cdc6`](https://github.com/mastra-ai/mastra/commit/677cdc6af564dec29a13464d12b7ab2a4efc22e9), [`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`a7dd322`](https://github.com/mastra-ai/mastra/commit/a7dd32247d95afc539f483ca37f4594af0387f59), [`3f5c6f7`](https://github.com/mastra-ai/mastra/commit/3f5c6f728ea35da344248de9aa070f12849f3aa0), [`a318490`](https://github.com/mastra-ai/mastra/commit/a318490e17da32f338d50929c770d901a9b3dd72), [`b860493`](https://github.com/mastra-ai/mastra/commit/b86049391100e665d579f700c8a2034c036defc3), [`d4be8c1`](https://github.com/mastra-ai/mastra/commit/d4be8c1739d22d621e3f78790e1dd5eb5ecc3589), [`a5d2eb1`](https://github.com/mastra-ai/mastra/commit/a5d2eb10347eade1ae2816d88f466c25186c54a5), [`3667679`](https://github.com/mastra-ai/mastra/commit/3667679db057edfb086846d13369fdda4902ad65), [`49696e8`](https://github.com/mastra-ai/mastra/commit/49696e8e42f870674a0a58f5abcd22cc54dd2864), [`2ef2f23`](https://github.com/mastra-ai/mastra/commit/2ef2f230a7aed342e7dc3b2000cd42e4c43e08a7), [`763e0c6`](https://github.com/mastra-ai/mastra/commit/763e0c61e04d76ad9a9efd301aa57525ca0cbea9), [`20504b2`](https://github.com/mastra-ai/mastra/commit/20504b2ecebd0e077acda3d457ab57480a98ed3e), [`77e6b1b`](https://github.com/mastra-ai/mastra/commit/77e6b1bc4c46ce94fe501023fb4393c812ec6be3), [`c5f964d`](https://github.com/mastra-ai/mastra/commit/c5f964d3f77064e978f8066ec506eed77ba5c63c), [`23e0be2`](https://github.com/mastra-ai/mastra/commit/23e0be261381e49534b4ff3101c60ee64a946cbf), [`7fc8806`](https://github.com/mastra-ai/mastra/commit/7fc880627d3cbf995d31ea0e8b807bf15417e651), [`0e02eac`](https://github.com/mastra-ai/mastra/commit/0e02eacdb2e30e1697a41910b41163742a181dc1), [`4df174c`](https://github.com/mastra-ai/mastra/commit/4df174c32bddf093a82f273070b8380aef7c9e90), [`f7c25b5`](https://github.com/mastra-ai/mastra/commit/f7c25b5106ddfb48e591f98df7a51e0f2dd01dba), [`7aad631`](https://github.com/mastra-ai/mastra/commit/7aad631b43bc10db77d5b8c66b200d7a49d18bf2), [`512100a`](https://github.com/mastra-ai/mastra/commit/512100a7d8b7e9c920f2590c6b3612f5de0d3cff), [`e81744c`](https://github.com/mastra-ai/mastra/commit/e81744cd13c46619c142dc521dc0baac47607a84), [`f8f653f`](https://github.com/mastra-ai/mastra/commit/f8f653f10980d01a73706cc3c8689ca5e40ce808), [`dc09cc1`](https://github.com/mastra-ai/mastra/commit/dc09cc1083d861cde192c1cd235324dc75b8c731), [`9ef432b`](https://github.com/mastra-ai/mastra/commit/9ef432b6faa534b57b0d182a610e13dd9a7123ff), [`36b4649`](https://github.com/mastra-ai/mastra/commit/36b4649045a3a380cbab8ceca866db4086223aff), [`b9cf308`](https://github.com/mastra-ai/mastra/commit/b9cf30846f97f99ac1906ee8a68f4f2d117b0378), [`2e1d098`](https://github.com/mastra-ai/mastra/commit/2e1d0984e325fd319d32ea182f596b3170be3847), [`377eb81`](https://github.com/mastra-ai/mastra/commit/377eb81ce43b964e3a6b541df172da74a8ff3716), [`1794a79`](https://github.com/mastra-ai/mastra/commit/1794a79178c418004a7261b1ad9114066f7ef01d), [`0cdc5dc`](https://github.com/mastra-ai/mastra/commit/0cdc5dc69024957815da4f51acc4119eb4f447d7), [`5740ec6`](https://github.com/mastra-ai/mastra/commit/5740ec60c760ffdfbfaa59d603d03b847c864e05)]:
  - @mastra/core@1.60.0

## 1.3.0-alpha.2

### Patch Changes

- Added fallback checkpoint forwarding for Platform sandboxes so the workspace proxy can seed fresh sessions without changing their primary recovery key. ([#21803](https://github.com/mastra-ai/mastra/pull/21803))

  ```typescript
  const sandbox = new PlatformSandbox({
    id: 'session-42',
    seedCheckpointName: 'repo-base',
  });
  ```

- Updated dependencies [[`58c43d3`](https://github.com/mastra-ai/mastra/commit/58c43d3f7cb2eeaeb8ac733ae71dde822348e588)]:
  - @mastra/core@1.60.0-alpha.14

## 1.3.0-alpha.1

### Patch Changes

- PlatformSandbox restarts use the current sandbox connection after the previous sandbox is deleted or the platform does not return an instance URL, so later commands do not hit a stale sidecar. ([#21798](https://github.com/mastra-ai/mastra/pull/21798))

- PlatformSandbox now restarts a timed-out sidecar health probe on the next command instead of falling back to the slower lease-based exec path for the sandbox's lifetime. If the in-sandbox sidecar was just slow to boot, later commands recover the fast private-network transport automatically. ([#21798](https://github.com/mastra-ai/mastra/pull/21798))

- Declared checkpoint support (`supportsCheckpoints`) so checkpoint-based features like warm base checkpoints and boot-from-checkpoint know snapshots are real. ([#21798](https://github.com/mastra-ai/mastra/pull/21798))

  ```ts
  // Gate checkpoint-dependent work on the provider's capability flag.
  if (sandbox.supportsCheckpoints) {
    await sandbox.snapshot(); // persists a checkpoint that can seed a later boot
  }
  ```

- Updated dependencies [[`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`2ef2f23`](https://github.com/mastra-ai/mastra/commit/2ef2f230a7aed342e7dc3b2000cd42e4c43e08a7), [`5740ec6`](https://github.com/mastra-ai/mastra/commit/5740ec60c760ffdfbfaa59d603d03b847c864e05)]:
  - @mastra/core@1.60.0-alpha.13

## 1.3.0-alpha.0

### Minor Changes

- Added `ProcessHandle.closeStdin()` to signal end-of-file to background processes. Local and Docker sandboxes support closing stdin, while providers without an available stdin-close API return a provider-specific unsupported-operation error. Providers signal the unsupported case with the new `UnsupportedStdinCloseError`, and the base class supplies that behavior by default so existing `ProcessHandle` subclasses keep compiling. Calling `handle.writer.end()` also closes stdin, and finishes without an error when the provider cannot close stdin. ([#21606](https://github.com/mastra-ai/mastra/pull/21606))

### Patch Changes

- Updated dependencies [[`4e7a421`](https://github.com/mastra-ai/mastra/commit/4e7a421dce8a48742f785d1e93ad2f43a572b282), [`242e324`](https://github.com/mastra-ai/mastra/commit/242e3241e73cbd5c9bb86a31ebb49ca0256488d4), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`d774e89`](https://github.com/mastra-ai/mastra/commit/d774e8930c781df8c9effe3763e6b501c099b6cc), [`9c27a53`](https://github.com/mastra-ai/mastra/commit/9c27a53cd9d3de4f3f025bc387d94ce371c33f95), [`dff25a1`](https://github.com/mastra-ai/mastra/commit/dff25a1103fa72ee082a9b6f805ebeb5ce400753), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`7f78585`](https://github.com/mastra-ai/mastra/commit/7f785857e401570e2ffb316911f126ed363aa537), [`f2a4afd`](https://github.com/mastra-ai/mastra/commit/f2a4afd7e37e809669001ed17724b341a5c1f45e), [`d438148`](https://github.com/mastra-ai/mastra/commit/d438148e222c1e2fb3c652725ce75680962ebec4), [`ba05fe0`](https://github.com/mastra-ai/mastra/commit/ba05fe0738f70cb686777546e968237d09269142), [`d26a8d4`](https://github.com/mastra-ai/mastra/commit/d26a8d4281f28414715b333c85bedaf70d0b2890), [`677cdc6`](https://github.com/mastra-ai/mastra/commit/677cdc6af564dec29a13464d12b7ab2a4efc22e9), [`a318490`](https://github.com/mastra-ai/mastra/commit/a318490e17da32f338d50929c770d901a9b3dd72), [`763e0c6`](https://github.com/mastra-ai/mastra/commit/763e0c61e04d76ad9a9efd301aa57525ca0cbea9), [`23e0be2`](https://github.com/mastra-ai/mastra/commit/23e0be261381e49534b4ff3101c60ee64a946cbf), [`7fc8806`](https://github.com/mastra-ai/mastra/commit/7fc880627d3cbf995d31ea0e8b807bf15417e651), [`0e02eac`](https://github.com/mastra-ai/mastra/commit/0e02eacdb2e30e1697a41910b41163742a181dc1), [`4df174c`](https://github.com/mastra-ai/mastra/commit/4df174c32bddf093a82f273070b8380aef7c9e90), [`f7c25b5`](https://github.com/mastra-ai/mastra/commit/f7c25b5106ddfb48e591f98df7a51e0f2dd01dba), [`dc09cc1`](https://github.com/mastra-ai/mastra/commit/dc09cc1083d861cde192c1cd235324dc75b8c731), [`36b4649`](https://github.com/mastra-ai/mastra/commit/36b4649045a3a380cbab8ceca866db4086223aff), [`377eb81`](https://github.com/mastra-ai/mastra/commit/377eb81ce43b964e3a6b541df172da74a8ff3716)]:
  - @mastra/core@1.60.0-alpha.8

## 1.2.1

### Patch Changes

- Send opaque acting-user subjects with Platform sandbox requests, including Factory creation and reattachment flows. ([#20754](https://github.com/mastra-ai/mastra/pull/20754))

  ```typescript
  import { PlatformSandbox } from '@mastra/platform-workspace';

  const sandbox = new PlatformSandbox({
    environmentId: 'env_abc',
    actingUserId: auth.user.id,
  });
  ```

- Updated dependencies [[`088e41e`](https://github.com/mastra-ai/mastra/commit/088e41e434ed05f2c674b254f1034ec46a57a7be), [`aa3e7be`](https://github.com/mastra-ai/mastra/commit/aa3e7be30f8addb0278ea74429f4df054517a287), [`d118873`](https://github.com/mastra-ai/mastra/commit/d118873cfd5074b1f814a1c169a97ca7a3a29174), [`b2f0013`](https://github.com/mastra-ai/mastra/commit/b2f0013375588d40c03c13e843b99c0ff8872ca5), [`3b541ae`](https://github.com/mastra-ai/mastra/commit/3b541ae5d410c52b80a7e381d84d021cddb9a449), [`79dd7c2`](https://github.com/mastra-ai/mastra/commit/79dd7c261ee6be1fafedd4651959394db21d2cba), [`90822db`](https://github.com/mastra-ai/mastra/commit/90822dba08fb2169c518e4a6d7f127c098eb46b8), [`898bba4`](https://github.com/mastra-ai/mastra/commit/898bba46d4806dd255a44e5dc3a3d5827eaefdfe), [`b9a28ec`](https://github.com/mastra-ai/mastra/commit/b9a28ecf7acdc0cb7a543d5b660f9fbee301df9a), [`f9aab1c`](https://github.com/mastra-ai/mastra/commit/f9aab1cfc3fda03238a7fd7bd8b794e07497878c), [`3700208`](https://github.com/mastra-ai/mastra/commit/37002080c7838267803a7e579a7d58b908d62f36), [`e31421b`](https://github.com/mastra-ai/mastra/commit/e31421bc9c11c03c6e74f447ecb5820000e2b9d7), [`8b7131e`](https://github.com/mastra-ai/mastra/commit/8b7131eb0407f58f5205e68fb27b81f026488f28), [`161258b`](https://github.com/mastra-ai/mastra/commit/161258b3473a6d0fce00a43cab59d119a49a232f), [`aece0e7`](https://github.com/mastra-ai/mastra/commit/aece0e7cb124ae1eb1230689b887f5554b9a0bf0), [`ae79e34`](https://github.com/mastra-ai/mastra/commit/ae79e34c0bd8674fc24c7524217bfc4a051c6136), [`59d8898`](https://github.com/mastra-ai/mastra/commit/59d8898c8cb48b342fe5bcb5eee803cc8cc95060), [`a6c4399`](https://github.com/mastra-ai/mastra/commit/a6c4399763590b3dae21a2c81826e89a3b1deee4), [`a40f915`](https://github.com/mastra-ai/mastra/commit/a40f9157690d89ef13ce825cc88e30be581de5d4), [`8ea8038`](https://github.com/mastra-ai/mastra/commit/8ea80386fde53d26e2c0b2060c53bc9bd9be10f3), [`be31796`](https://github.com/mastra-ai/mastra/commit/be3179624ad5f77cff5fa342cd08046bf7605283), [`79c4f82`](https://github.com/mastra-ai/mastra/commit/79c4f8295f568752eeadf8a9b50010a7d9ec06ae), [`7dafa4f`](https://github.com/mastra-ai/mastra/commit/7dafa4f670fb16ec8ff07349645a00ca12bc5794)]:
  - @mastra/core@1.59.0

## 1.2.1-alpha.0

### Patch Changes

- Send opaque acting-user subjects with Platform sandbox requests, including Factory creation and reattachment flows. ([#20754](https://github.com/mastra-ai/mastra/pull/20754))

  ```typescript
  import { PlatformSandbox } from '@mastra/platform-workspace';

  const sandbox = new PlatformSandbox({
    environmentId: 'env_abc',
    actingUserId: auth.user.id,
  });
  ```

- Updated dependencies [[`79dd7c2`](https://github.com/mastra-ai/mastra/commit/79dd7c261ee6be1fafedd4651959394db21d2cba), [`b9a28ec`](https://github.com/mastra-ai/mastra/commit/b9a28ecf7acdc0cb7a543d5b660f9fbee301df9a), [`be31796`](https://github.com/mastra-ai/mastra/commit/be3179624ad5f77cff5fa342cd08046bf7605283)]:
  - @mastra/core@1.59.0-alpha.4

## 1.2.0

### Minor Changes

- Added startup observability to `PlatformSandbox`. New optional `sessionId` and `threadId` options let you correlate all sandbox startup activity with the session that triggered it, and the sandbox now logs how long startup took and whether it became reachable. ([#21189](https://github.com/mastra-ai/mastra/pull/21189))

  ```ts
  import { PlatformSandbox } from '@mastra/platform-workspace';

  const sandbox = new PlatformSandbox({
    projectId: 'proj_123',
    environmentId: 'env_123',
    sessionId: 'session_abc', // correlate startup logs with your session
    threadId: 'thread_xyz', // optional finer-grained correlation
  });
  ```

- Added `PlatformSandbox.snapshot()` to capture the configured recovery checkpoint. ([#21221](https://github.com/mastra-ai/mastra/pull/21221))

  ```ts
  await sandbox.snapshot();
  ```

- Split `PlatformSandbox.stop()` from `PlatformSandbox.destroy()` so the two lifecycle exits mirror `@mastra/railway` `RailwaySandbox` ([#20956](https://github.com/mastra-ai/mastra/pull/20956))

  **Before:** `stop()` was an alias for `destroy()`, and `destroy()` only released the sandbox VM — the on-provider recovery checkpoint was never actively deleted. There was no way to end a hosted sandbox while preserving its checkpoint for a later resume, and destroyed sandboxes accumulated stray checkpoints until the upstream provider's own GC.

  **After:**

  - **`stop()`** — releases the VM but **preserves the recovery checkpoint**. Any in-flight capture is awaited first so the preserved checkpoint reflects the caller's latest state. Corresponds to `DELETE /v1/projects/:pid/sandbox/:sandboxId` on workspace-proxy, which by contract does not touch the checkpoint.
  - **`destroy()`** — releases the VM **and deletes the recovery checkpoint**. Cancels any in-flight capture (no reason to burn a capture on state we're releasing), asks the proxy to delete the checkpoint via `DELETE /v1/projects/:pid/sandbox/:sandboxId/checkpoint`, then releases the VM. Both remote operations are best-effort — an already-absent checkpoint or a transient checkpoint-delete failure does not block the VM teardown, since a half-torn-down sandbox is worse than a lingering checkpoint alone.

  Callers constructed without a recovery `id` skip the checkpoint DELETE and behave identically to `stop()`, because they have no on-provider checkpoint to release.

  This restores the "providers move in lockstep" invariant that broke after `@mastra/railway` gained its own `stop()`/`destroy()` split.

  **Requires** a matching workspace-proxy release that exposes `DELETE /v1/projects/:pid/sandbox/:sandboxId/checkpoint`. Callers on older workspace-proxy versions will see the checkpoint DELETE 404 and fall through to the VM DELETE — same net effect as the pre-split behavior.

### Patch Changes

- Add public `captureCheckpoint()` method to `PlatformSandbox` — mirrors `@mastra/railway`'s `RailwaySandbox.captureCheckpoint()` so callers (e.g. a factory-side scheduler) can capture the recovery checkpoint on demand at semantic moments (turn end, session-idle, pre-teardown) without having to know which provider is underneath. ([#20882](https://github.com/mastra-ai/mastra/pull/20882))

  ```ts
  const result = await sandbox.captureCheckpoint();
  switch (result.status) {
    case 'captured':
    case 'coalesced':
      await persistBinding({ sessionId, checkpointName: result.checkpointName });
      break;
    case 'skipped':
      // result.reason: 'no-checkpoint-name-configured' | 'sandbox-not-running'
      break;
  }
  ```

  - POSTs to `/v1/projects/:projectId/sandbox/:sandboxId/checkpoint` with the caller-supplied recovery key (the `id` the sandbox was constructed with) as the body, matching the shape the workspace-proxy expects.
  - Coalesces concurrent callers on the same instance onto a single upstream request, so N simultaneous turn-end fires do not each round-trip the proxy.
  - Returns `{ status: 'skipped', reason: 'no-checkpoint-name-configured' }` when the sandbox was constructed without a caller-supplied `id` (an auto-generated random id is never a meaningful recovery key), and `{ status: 'skipped', reason: 'sandbox-not-running' }` when the sandbox has not been started yet.
  - Normalizes upstream "sandbox destroyed" outcomes (a 410 from the proxy, or the proxy's own `skipped` status) to `{ status: 'skipped', reason: 'sandbox-not-running' }` — the discriminant matches the pre-flight case so callers branch uniformly, and the sandbox's local state is cleared as a side effect so the next `start()` provisions fresh instead of reattaching to a dead id.
  - Transport failures other than 410 (5xx, 429) propagate as `PlatformApiError` for the caller to handle.

- Fixed Platform Sandbox startup so commands use a reliable connection while a new sandbox is starting. ([#21028](https://github.com/mastra-ai/mastra/pull/21028))

- Coalesce concurrent `PlatformSandbox.start()` callers onto a single in-flight attempt ([#20960](https://github.com/mastra-ai/mastra/pull/20960))

  Two callers hitting `start()` on the same instance before the first one resolves used to both race to `POST /v1/projects/:pid/sandbox` (or `GET /sandbox/:id` on the reattach path), burning N proxy provisions and leaving `N-1` stray sandboxes behind. Fleet-level coalescing on the caller side masked most of this, but the underlying invariant "providers move in lockstep" was false — `@mastra/railway` `RailwaySandbox` has always had `_startInFlight` coalescing.

  `start()` now publishes a single shared promise via `??=` **before** the first `await`, so a second caller entering `start()` while the first is mid-round-trip joins the existing promise instead of racing past the null check. The slot is cleared in `.finally()` on both success and failure paths so a failed attempt isn't a permanent latch — the next call starts fresh. Failures propagate to every joined caller.

  Bug fix; no public API surface change. Callers already awaiting `start()` see the same success/failure semantics; the only observable difference is one upstream call instead of N.

- Improved `PlatformSandbox.getInfo()` to return cached sandbox information when the sandbox is known to be directly reachable, removing a redundant network round-trip on every workspace status poll. When no cached address is available, `getInfo()` behaves exactly as before. ([#20855](https://github.com/mastra-ai/mastra/pull/20855))

- Updated dependencies [[`e7109ee`](https://github.com/mastra-ai/mastra/commit/e7109ee6f731bacc79c885906f3c7dca8d8f013a), [`b8ce7ec`](https://github.com/mastra-ai/mastra/commit/b8ce7ec96e39343c6c2f36d12d68a9ad816c09f7), [`2e4624e`](https://github.com/mastra-ai/mastra/commit/2e4624edb6917e61249cb60ee377735e7af7e4a9), [`45a9147`](https://github.com/mastra-ai/mastra/commit/45a914741f578754d79d8b7de7b4e4f304d8e14a), [`a3a3624`](https://github.com/mastra-ai/mastra/commit/a3a3624f646b98e409424d8defccbd334da9e8b8), [`6246914`](https://github.com/mastra-ai/mastra/commit/62469146636911f3cbbe0880bd011c6a897a59a7), [`6445eba`](https://github.com/mastra-ai/mastra/commit/6445eba6020abac681aba1cc9289f446cb400cbe), [`86b7b77`](https://github.com/mastra-ai/mastra/commit/86b7b777980d30f66e1fd134a37d2af4c22e54cc), [`1c75e32`](https://github.com/mastra-ai/mastra/commit/1c75e32f7fc0b9fb6f548b4407feaec8a1440212), [`296dc9a`](https://github.com/mastra-ai/mastra/commit/296dc9af29f3616e786c7825ec32e0df92d754c5), [`f59032a`](https://github.com/mastra-ai/mastra/commit/f59032a73699443555a08a479e7ac578975784f2), [`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`3f73c07`](https://github.com/mastra-ai/mastra/commit/3f73c076727e8c36b4fff7a1b40290fb68957fa8), [`772c0c8`](https://github.com/mastra-ai/mastra/commit/772c0c897cec383258de2e6178147f8014767c7b), [`d7cf7fa`](https://github.com/mastra-ai/mastra/commit/d7cf7fafc1ae1b50bd8462dd0e6c671a8606db93), [`7c1ebb1`](https://github.com/mastra-ai/mastra/commit/7c1ebb15690c4b3f0eabb19077cf8af573311e57), [`0f9a448`](https://github.com/mastra-ai/mastra/commit/0f9a448502157e59f7b76f24360ad497168f5ef8), [`578bf2e`](https://github.com/mastra-ai/mastra/commit/578bf2e6a88e9d5b8bf502204e15a95dfbb679ae), [`c47165c`](https://github.com/mastra-ai/mastra/commit/c47165c983c87594c6952f1fd2fa51a90205034c), [`289f4ce`](https://github.com/mastra-ai/mastra/commit/289f4ce16e3293370440172132c52ee787cbc09f), [`df31eb0`](https://github.com/mastra-ai/mastra/commit/df31eb0c7087d782a0d9346e467f9a4af4b0eef6), [`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`4f16ff8`](https://github.com/mastra-ai/mastra/commit/4f16ff824bf2f9b0ddc93f210477c10c8a4fb1ab), [`b4c89b4`](https://github.com/mastra-ai/mastra/commit/b4c89b4371b0c86da57403ad1a3b3ef0681f3128), [`e6534fa`](https://github.com/mastra-ai/mastra/commit/e6534fab031216f6cb48c4c9907cbfdce9d60bc6), [`210cb7a`](https://github.com/mastra-ai/mastra/commit/210cb7a167998c7bbf72cb3b93e6eb0563330239), [`06b2d87`](https://github.com/mastra-ai/mastra/commit/06b2d87e63bcdd0ed59215c6789692b9b12de376), [`1c67d85`](https://github.com/mastra-ai/mastra/commit/1c67d85e9da8285662f4dbbf47e0378c3fee0747), [`ac01d63`](https://github.com/mastra-ai/mastra/commit/ac01d6355974aec73fdb8781449ed12bac582094), [`80a3324`](https://github.com/mastra-ai/mastra/commit/80a33245d3110204de6f56d61211523ffe338692), [`e44e8f3`](https://github.com/mastra-ai/mastra/commit/e44e8f370b66c339ddcaba946d33da6d3c3f06cd), [`d9d2881`](https://github.com/mastra-ai/mastra/commit/d9d2881ede6dd6c023d144215fc812062aed0890), [`a810a05`](https://github.com/mastra-ai/mastra/commit/a810a058f62ad407cfc1701e0be36ae91145d7cf), [`ba24be6`](https://github.com/mastra-ai/mastra/commit/ba24be662439c331ab23a600041f93803c89eca8), [`842b5fe`](https://github.com/mastra-ai/mastra/commit/842b5fe22b6a7fa811bd14e48eb9af523ac989f2), [`990611b`](https://github.com/mastra-ai/mastra/commit/990611ba76eb876d86c9c594371ae5f02f94b432), [`80bdf3a`](https://github.com/mastra-ai/mastra/commit/80bdf3ae16ade6ff63bde0cb16fa2df8ab7dd4dd), [`c967a5e`](https://github.com/mastra-ai/mastra/commit/c967a5eec150c5dc5418c4a4388982d1fb7ad27c), [`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b), [`9ba1247`](https://github.com/mastra-ai/mastra/commit/9ba12470c77f1c03642d720ce67e517e878f666e), [`fd96298`](https://github.com/mastra-ai/mastra/commit/fd96298a8367622f4ebfcaa97b5b6c1fbbd14564), [`66bbfb5`](https://github.com/mastra-ai/mastra/commit/66bbfb5f05b473d39f88c0e4a481ccac41634f3a), [`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b), [`f8da216`](https://github.com/mastra-ai/mastra/commit/f8da21633e7eb0e31c9ce0fc30567870d19416d3), [`4a09a9c`](https://github.com/mastra-ai/mastra/commit/4a09a9c0474ef643558fcb5f0edc542b82f1cab0), [`5f798b3`](https://github.com/mastra-ai/mastra/commit/5f798b3362e9bdf4d690f85245606e146eef60b9), [`6a84954`](https://github.com/mastra-ai/mastra/commit/6a84954a2667f85b6d59da652dab1bbff007ccb0), [`1e83a47`](https://github.com/mastra-ai/mastra/commit/1e83a4734ab61ba5926af6793e3569a78b72ed37), [`52d8ef0`](https://github.com/mastra-ai/mastra/commit/52d8ef03801f1deb7ee48532fc4190dd4a33916c), [`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`7fdcaa6`](https://github.com/mastra-ai/mastra/commit/7fdcaa66105d64290f9b14432a12ec99f39c4d3a), [`d6c56f9`](https://github.com/mastra-ai/mastra/commit/d6c56f951db3213330b98b0abafa9778c8770e58), [`e08e789`](https://github.com/mastra-ai/mastra/commit/e08e789c1bf4cd2fe46363f7a4728536ceccc9bd), [`bf936e2`](https://github.com/mastra-ai/mastra/commit/bf936e2c89b2ff0dad5695b873ddc009ba96d41e), [`7fb580a`](https://github.com/mastra-ai/mastra/commit/7fb580ac73fbcacf2ff00872a3395f73ae1b9fa5), [`ed5d606`](https://github.com/mastra-ai/mastra/commit/ed5d606739c5e3fbdfa9f272df7809aa5ab43b1d), [`f53d5bd`](https://github.com/mastra-ai/mastra/commit/f53d5bd4885b29e4ac29a428a6044088ea8d6aa3), [`32980a3`](https://github.com/mastra-ai/mastra/commit/32980a3e2413d0274ac244d32c37d910edc13f00), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`82e3365`](https://github.com/mastra-ai/mastra/commit/82e3365ef7c9bf7bee2e7a7029035ea262d68895), [`6104347`](https://github.com/mastra-ai/mastra/commit/61043473ba6bfd0a25156824e853e13165562e6c), [`35cc901`](https://github.com/mastra-ai/mastra/commit/35cc90102cf834a84827acaf9eee0b6d6d1e2a3b), [`a8b4cf0`](https://github.com/mastra-ai/mastra/commit/a8b4cf02823cffebc4751a53337dfacf097c1ae1), [`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`333785c`](https://github.com/mastra-ai/mastra/commit/333785c93cbb01e42c60167e995457c28897ddbf), [`bda2235`](https://github.com/mastra-ai/mastra/commit/bda22353ee28f2df0eaea555f7cae1549f979c0b), [`efd5c81`](https://github.com/mastra-ai/mastra/commit/efd5c81cc25fde3c2ddd86fc1178deb4ec176e19), [`1b482c2`](https://github.com/mastra-ai/mastra/commit/1b482c2d89244dd758c41e5f927a2b44041388d2), [`45bfb88`](https://github.com/mastra-ai/mastra/commit/45bfb88fd52f1dd3be20e2a38905777c96499c90), [`ff28284`](https://github.com/mastra-ai/mastra/commit/ff2828416f14daff9d956e6a352fdaa23c950979), [`4bcdfaf`](https://github.com/mastra-ai/mastra/commit/4bcdfaf0eac3199d7cb171b0a19a92c9c341eea4), [`e3b9307`](https://github.com/mastra-ai/mastra/commit/e3b9307098daefbfae2a52ae2ef51bc9fc701190), [`d6834c5`](https://github.com/mastra-ai/mastra/commit/d6834c5a7866b16734d23900163c2414ed70d791), [`f33264f`](https://github.com/mastra-ai/mastra/commit/f33264f517ae603279afd5c4251e2b40f6dd3618), [`689f2c4`](https://github.com/mastra-ai/mastra/commit/689f2c4b6c0835fe455702b01d21daa8abcd9331), [`fcd0667`](https://github.com/mastra-ai/mastra/commit/fcd0667a4e378be35c9a1b1eb19cce78fbfd7282), [`cfd0d9e`](https://github.com/mastra-ai/mastra/commit/cfd0d9ec77ec3c69dd96f79cdb579e03d79f22ce), [`acc3513`](https://github.com/mastra-ai/mastra/commit/acc3513b19f79bf0a7ec2998694580edca54086c), [`1670533`](https://github.com/mastra-ai/mastra/commit/1670533986f6bacf567746245348125e3a106448), [`a7eb4a1`](https://github.com/mastra-ai/mastra/commit/a7eb4a11450f6170274ed5141bffe821d4fdd5a6), [`0976933`](https://github.com/mastra-ai/mastra/commit/0976933142333ec78451feef265b68bcb45aa5e7), [`242b945`](https://github.com/mastra-ai/mastra/commit/242b94558777bfbdeb42cbfea84afff0b6ad0633), [`c52d346`](https://github.com/mastra-ai/mastra/commit/c52d3462ec831a5d95926ecd3d3373f5928ad2e5), [`af4636a`](https://github.com/mastra-ai/mastra/commit/af4636a74463275d71c1d13a38f7d2b738f128bf), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`2eabc09`](https://github.com/mastra-ai/mastra/commit/2eabc097d86d52fbd0123da36a7c874154cc384f), [`0023e79`](https://github.com/mastra-ai/mastra/commit/0023e7919431078280abd11c89d1edeae35fcc69), [`c2ad51e`](https://github.com/mastra-ai/mastra/commit/c2ad51e2467f901eecba8c9f4a45e22a50bd7c18), [`25ca73d`](https://github.com/mastra-ai/mastra/commit/25ca73d25dee7ce9f0ca72939e3a505c4db7257e), [`2f9ef3f`](https://github.com/mastra-ai/mastra/commit/2f9ef3f4ca06fc2dcdd5088c26b7f4da6a016791), [`e7eefcb`](https://github.com/mastra-ai/mastra/commit/e7eefcb162cda7c493e8c3bf43050ead0efbcb2c), [`fea5cae`](https://github.com/mastra-ai/mastra/commit/fea5caedc7e2cfea51784a15e015952692027abf), [`4d7aca2`](https://github.com/mastra-ai/mastra/commit/4d7aca2fe75f225c83d1502d63079568e6ec163f), [`e1cead1`](https://github.com/mastra-ai/mastra/commit/e1cead17b5f3653cf00d2f90cc19b113119c02ba), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`d9d93b2`](https://github.com/mastra-ai/mastra/commit/d9d93b25e4a65ad5fa153fa35be7ed149c8d587f), [`c4ec889`](https://github.com/mastra-ai/mastra/commit/c4ec889561c0264c43f66d04d587bee4ce35e792), [`4b59f78`](https://github.com/mastra-ai/mastra/commit/4b59f786cbc9a7d1ef07a07517dbd4b96865e99d), [`eeae63e`](https://github.com/mastra-ai/mastra/commit/eeae63e7fbe8e1f237adc69bca6e2ac13c5ca907), [`3dc97ea`](https://github.com/mastra-ai/mastra/commit/3dc97ea415fad353b48a13095fad1835933cc12a), [`94e7ae9`](https://github.com/mastra-ai/mastra/commit/94e7ae970b37c888cd1244ef013292639a2fe6d1), [`e6a2860`](https://github.com/mastra-ai/mastra/commit/e6a2860649cc51f87d32d78b766ae2126446ba07), [`7010c5d`](https://github.com/mastra-ai/mastra/commit/7010c5d15728bf9c5dfe4fb6b1bf80ce23bf143a), [`bab06b1`](https://github.com/mastra-ai/mastra/commit/bab06b18923873a584bdfc71a6b4ec7fb4727fb7), [`3d01cd3`](https://github.com/mastra-ai/mastra/commit/3d01cd387321b6f9c5cac31d487c84bf51b19c78), [`7bf3086`](https://github.com/mastra-ai/mastra/commit/7bf308663f0115ca74ad20554ade740f06640859), [`4c186a0`](https://github.com/mastra-ai/mastra/commit/4c186a017275f45e6ed4c09de0f89550e2d09e8c), [`b0fa077`](https://github.com/mastra-ai/mastra/commit/b0fa077bcbc9b08551846fe372a0d3d15b71ed72), [`0282e16`](https://github.com/mastra-ai/mastra/commit/0282e16115538c8e9b248b90f0748eb01cb5dc98), [`a8dd139`](https://github.com/mastra-ai/mastra/commit/a8dd1391a9fe9a6632c25809ef236980afa9a020), [`6a667b4`](https://github.com/mastra-ai/mastra/commit/6a667b4b7cd6a93fe41fcdd357b08c5a8c09b9ab), [`9be8878`](https://github.com/mastra-ai/mastra/commit/9be8878dcf0388e84fc4873e0eec27bd49b881a4), [`e5786be`](https://github.com/mastra-ai/mastra/commit/e5786be02bb903073082bd9d6da880ebaacc343f), [`2440e09`](https://github.com/mastra-ai/mastra/commit/2440e096ea6c2def1ccc1eb2d0f3f5b88c4af940), [`2093fbd`](https://github.com/mastra-ai/mastra/commit/2093fbd53bb744bae19ec89f6d73db9a66fbe8a7), [`a59049b`](https://github.com/mastra-ai/mastra/commit/a59049b1652a13efff66ac826326b5ed9a550342), [`7bd85ea`](https://github.com/mastra-ai/mastra/commit/7bd85ea7588b71c25ce9f4019c88f8539be5dcbc), [`83fa004`](https://github.com/mastra-ai/mastra/commit/83fa0044bfda8b703a83883dbd8bef204844d13f), [`a463cdf`](https://github.com/mastra-ai/mastra/commit/a463cdf1c95c3059e70f0bff27959e8558bb899d), [`e7a5da4`](https://github.com/mastra-ai/mastra/commit/e7a5da4ef8e4dd452d2f232961b4e682a85ffe43), [`7b4393d`](https://github.com/mastra-ai/mastra/commit/7b4393d557411fdcf07b0e30e5acaf7cc85154ae), [`0ea6b80`](https://github.com/mastra-ai/mastra/commit/0ea6b8001408ce02b56e8be0536b0fd8cbaf8ad2)]:
  - @mastra/core@1.58.0

## 1.2.0-alpha.2

### Minor Changes

- Added startup observability to `PlatformSandbox`. New optional `sessionId` and `threadId` options let you correlate all sandbox startup activity with the session that triggered it, and the sandbox now logs how long startup took and whether it became reachable. ([#21189](https://github.com/mastra-ai/mastra/pull/21189))

  ```ts
  import { PlatformSandbox } from '@mastra/platform-workspace';

  const sandbox = new PlatformSandbox({
    projectId: 'proj_123',
    environmentId: 'env_123',
    sessionId: 'session_abc', // correlate startup logs with your session
    threadId: 'thread_xyz', // optional finer-grained correlation
  });
  ```

- Added `PlatformSandbox.snapshot()` to capture the configured recovery checkpoint. ([#21221](https://github.com/mastra-ai/mastra/pull/21221))

  ```ts
  await sandbox.snapshot();
  ```

### Patch Changes

- Fixed Platform Sandbox startup so commands use a reliable connection while a new sandbox is starting. ([#21028](https://github.com/mastra-ai/mastra/pull/21028))

- Updated dependencies [[`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`d6c56f9`](https://github.com/mastra-ai/mastra/commit/d6c56f951db3213330b98b0abafa9778c8770e58), [`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`acc3513`](https://github.com/mastra-ai/mastra/commit/acc3513b19f79bf0a7ec2998694580edca54086c), [`94e7ae9`](https://github.com/mastra-ai/mastra/commit/94e7ae970b37c888cd1244ef013292639a2fe6d1), [`6a667b4`](https://github.com/mastra-ai/mastra/commit/6a667b4b7cd6a93fe41fcdd357b08c5a8c09b9ab), [`2440e09`](https://github.com/mastra-ai/mastra/commit/2440e096ea6c2def1ccc1eb2d0f3f5b88c4af940), [`a59049b`](https://github.com/mastra-ai/mastra/commit/a59049b1652a13efff66ac826326b5ed9a550342)]:
  - @mastra/core@1.58.0-alpha.13

## 1.2.0-alpha.1

### Minor Changes

- Split `PlatformSandbox.stop()` from `PlatformSandbox.destroy()` so the two lifecycle exits mirror `@mastra/railway` `RailwaySandbox` ([#20956](https://github.com/mastra-ai/mastra/pull/20956))

  **Before:** `stop()` was an alias for `destroy()`, and `destroy()` only released the sandbox VM — the on-provider recovery checkpoint was never actively deleted. There was no way to end a hosted sandbox while preserving its checkpoint for a later resume, and destroyed sandboxes accumulated stray checkpoints until the upstream provider's own GC.

  **After:**

  - **`stop()`** — releases the VM but **preserves the recovery checkpoint**. Any in-flight capture is awaited first so the preserved checkpoint reflects the caller's latest state. Corresponds to `DELETE /v1/projects/:pid/sandbox/:sandboxId` on workspace-proxy, which by contract does not touch the checkpoint.
  - **`destroy()`** — releases the VM **and deletes the recovery checkpoint**. Cancels any in-flight capture (no reason to burn a capture on state we're releasing), asks the proxy to delete the checkpoint via `DELETE /v1/projects/:pid/sandbox/:sandboxId/checkpoint`, then releases the VM. Both remote operations are best-effort — an already-absent checkpoint or a transient checkpoint-delete failure does not block the VM teardown, since a half-torn-down sandbox is worse than a lingering checkpoint alone.

  Callers constructed without a recovery `id` skip the checkpoint DELETE and behave identically to `stop()`, because they have no on-provider checkpoint to release.

  This restores the "providers move in lockstep" invariant that broke after `@mastra/railway` gained its own `stop()`/`destroy()` split.

  **Requires** a matching workspace-proxy release that exposes `DELETE /v1/projects/:pid/sandbox/:sandboxId/checkpoint`. Callers on older workspace-proxy versions will see the checkpoint DELETE 404 and fall through to the VM DELETE — same net effect as the pre-split behavior.

### Patch Changes

- Add public `captureCheckpoint()` method to `PlatformSandbox` — mirrors `@mastra/railway`'s `RailwaySandbox.captureCheckpoint()` so callers (e.g. a factory-side scheduler) can capture the recovery checkpoint on demand at semantic moments (turn end, session-idle, pre-teardown) without having to know which provider is underneath. ([#20882](https://github.com/mastra-ai/mastra/pull/20882))

  ```ts
  const result = await sandbox.captureCheckpoint();
  switch (result.status) {
    case 'captured':
    case 'coalesced':
      await persistBinding({ sessionId, checkpointName: result.checkpointName });
      break;
    case 'skipped':
      // result.reason: 'no-checkpoint-name-configured' | 'sandbox-not-running'
      break;
  }
  ```

  - POSTs to `/v1/projects/:projectId/sandbox/:sandboxId/checkpoint` with the caller-supplied recovery key (the `id` the sandbox was constructed with) as the body, matching the shape the workspace-proxy expects.
  - Coalesces concurrent callers on the same instance onto a single upstream request, so N simultaneous turn-end fires do not each round-trip the proxy.
  - Returns `{ status: 'skipped', reason: 'no-checkpoint-name-configured' }` when the sandbox was constructed without a caller-supplied `id` (an auto-generated random id is never a meaningful recovery key), and `{ status: 'skipped', reason: 'sandbox-not-running' }` when the sandbox has not been started yet.
  - Normalizes upstream "sandbox destroyed" outcomes (a 410 from the proxy, or the proxy's own `skipped` status) to `{ status: 'skipped', reason: 'sandbox-not-running' }` — the discriminant matches the pre-flight case so callers branch uniformly, and the sandbox's local state is cleared as a side effect so the next `start()` provisions fresh instead of reattaching to a dead id.
  - Transport failures other than 410 (5xx, 429) propagate as `PlatformApiError` for the caller to handle.

- Coalesce concurrent `PlatformSandbox.start()` callers onto a single in-flight attempt ([#20960](https://github.com/mastra-ai/mastra/pull/20960))

  Two callers hitting `start()` on the same instance before the first one resolves used to both race to `POST /v1/projects/:pid/sandbox` (or `GET /sandbox/:id` on the reattach path), burning N proxy provisions and leaving `N-1` stray sandboxes behind. Fleet-level coalescing on the caller side masked most of this, but the underlying invariant "providers move in lockstep" was false — `@mastra/railway` `RailwaySandbox` has always had `_startInFlight` coalescing.

  `start()` now publishes a single shared promise via `??=` **before** the first `await`, so a second caller entering `start()` while the first is mid-round-trip joins the existing promise instead of racing past the null check. The slot is cleared in `.finally()` on both success and failure paths so a failed attempt isn't a permanent latch — the next call starts fresh. Failures propagate to every joined caller.

  Bug fix; no public API surface change. Callers already awaiting `start()` see the same success/failure semantics; the only observable difference is one upstream call instead of N.

- Updated dependencies [[`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`d7cf7fa`](https://github.com/mastra-ai/mastra/commit/d7cf7fafc1ae1b50bd8462dd0e6c671a8606db93), [`0f9a448`](https://github.com/mastra-ai/mastra/commit/0f9a448502157e59f7b76f24360ad497168f5ef8), [`289f4ce`](https://github.com/mastra-ai/mastra/commit/289f4ce16e3293370440172132c52ee787cbc09f), [`4f16ff8`](https://github.com/mastra-ai/mastra/commit/4f16ff824bf2f9b0ddc93f210477c10c8a4fb1ab), [`1c67d85`](https://github.com/mastra-ai/mastra/commit/1c67d85e9da8285662f4dbbf47e0378c3fee0747), [`ba24be6`](https://github.com/mastra-ai/mastra/commit/ba24be662439c331ab23a600041f93803c89eca8), [`842b5fe`](https://github.com/mastra-ai/mastra/commit/842b5fe22b6a7fa811bd14e48eb9af523ac989f2), [`80bdf3a`](https://github.com/mastra-ai/mastra/commit/80bdf3ae16ade6ff63bde0cb16fa2df8ab7dd4dd), [`9ba1247`](https://github.com/mastra-ai/mastra/commit/9ba12470c77f1c03642d720ce67e517e878f666e), [`fd96298`](https://github.com/mastra-ai/mastra/commit/fd96298a8367622f4ebfcaa97b5b6c1fbbd14564), [`6a84954`](https://github.com/mastra-ai/mastra/commit/6a84954a2667f85b6d59da652dab1bbff007ccb0), [`52d8ef0`](https://github.com/mastra-ai/mastra/commit/52d8ef03801f1deb7ee48532fc4190dd4a33916c), [`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`efd5c81`](https://github.com/mastra-ai/mastra/commit/efd5c81cc25fde3c2ddd86fc1178deb4ec176e19), [`0976933`](https://github.com/mastra-ai/mastra/commit/0976933142333ec78451feef265b68bcb45aa5e7), [`242b945`](https://github.com/mastra-ai/mastra/commit/242b94558777bfbdeb42cbfea84afff0b6ad0633), [`fea5cae`](https://github.com/mastra-ai/mastra/commit/fea5caedc7e2cfea51784a15e015952692027abf), [`4b59f78`](https://github.com/mastra-ai/mastra/commit/4b59f786cbc9a7d1ef07a07517dbd4b96865e99d), [`7010c5d`](https://github.com/mastra-ai/mastra/commit/7010c5d15728bf9c5dfe4fb6b1bf80ce23bf143a)]:
  - @mastra/core@1.58.0-alpha.3

## 1.1.1-alpha.0

### Patch Changes

- Improved `PlatformSandbox.getInfo()` to return cached sandbox information when the sandbox is known to be directly reachable, removing a redundant network round-trip on every workspace status poll. When no cached address is available, `getInfo()` behaves exactly as before. ([#20855](https://github.com/mastra-ai/mastra/pull/20855))

- Updated dependencies [[`e7109ee`](https://github.com/mastra-ai/mastra/commit/e7109ee6f731bacc79c885906f3c7dca8d8f013a), [`772c0c8`](https://github.com/mastra-ai/mastra/commit/772c0c897cec383258de2e6178147f8014767c7b), [`578bf2e`](https://github.com/mastra-ai/mastra/commit/578bf2e6a88e9d5b8bf502204e15a95dfbb679ae), [`06b2d87`](https://github.com/mastra-ai/mastra/commit/06b2d87e63bcdd0ed59215c6789692b9b12de376), [`ac01d63`](https://github.com/mastra-ai/mastra/commit/ac01d6355974aec73fdb8781449ed12bac582094), [`a810a05`](https://github.com/mastra-ai/mastra/commit/a810a058f62ad407cfc1701e0be36ae91145d7cf), [`f8da216`](https://github.com/mastra-ai/mastra/commit/f8da21633e7eb0e31c9ce0fc30567870d19416d3), [`6104347`](https://github.com/mastra-ai/mastra/commit/61043473ba6bfd0a25156824e853e13165562e6c), [`45bfb88`](https://github.com/mastra-ai/mastra/commit/45bfb88fd52f1dd3be20e2a38905777c96499c90), [`e3b9307`](https://github.com/mastra-ai/mastra/commit/e3b9307098daefbfae2a52ae2ef51bc9fc701190), [`d6834c5`](https://github.com/mastra-ai/mastra/commit/d6834c5a7866b16734d23900163c2414ed70d791), [`c52d346`](https://github.com/mastra-ai/mastra/commit/c52d3462ec831a5d95926ecd3d3373f5928ad2e5), [`0023e79`](https://github.com/mastra-ai/mastra/commit/0023e7919431078280abd11c89d1edeae35fcc69), [`c2ad51e`](https://github.com/mastra-ai/mastra/commit/c2ad51e2467f901eecba8c9f4a45e22a50bd7c18), [`3dc97ea`](https://github.com/mastra-ai/mastra/commit/3dc97ea415fad353b48a13095fad1835933cc12a), [`3d01cd3`](https://github.com/mastra-ai/mastra/commit/3d01cd387321b6f9c5cac31d487c84bf51b19c78), [`7bf3086`](https://github.com/mastra-ai/mastra/commit/7bf308663f0115ca74ad20554ade740f06640859), [`a8dd139`](https://github.com/mastra-ai/mastra/commit/a8dd1391a9fe9a6632c25809ef236980afa9a020), [`e5786be`](https://github.com/mastra-ai/mastra/commit/e5786be02bb903073082bd9d6da880ebaacc343f), [`2093fbd`](https://github.com/mastra-ai/mastra/commit/2093fbd53bb744bae19ec89f6d73db9a66fbe8a7), [`e7a5da4`](https://github.com/mastra-ai/mastra/commit/e7a5da4ef8e4dd452d2f232961b4e682a85ffe43), [`7b4393d`](https://github.com/mastra-ai/mastra/commit/7b4393d557411fdcf07b0e30e5acaf7cc85154ae)]:
  - @mastra/core@1.58.0-alpha.1

## 1.1.0

### Minor Changes

- `PlatformSandbox.executeCommand` can now dial the sandbox directly over Railway's private network instead of going through the platform's public exec proxy. On paths where the direct route is available, per-exec latency drops from ~400 ms p50 to ~16 ms p50, and the exec stops touching the platform control plane. This flows through to every filesystem call (`SandboxFilesystem.readFile`, `writeFile`, `readdir`, `mkdir`, `stat`, `exists`, `copyFile`, `moveFile`, `deleteFile`), which is where most agent tool time was going. ([#20664](https://github.com/mastra-ai/mastra/pull/20664))

  Direct-path availability is a runtime property, not a configuration knob. When it's not available — no address registry wired up, the workspace-proxy hasn't discovered the sandbox address yet, or a direct dial fails — `executeCommand` transparently falls back to the existing exec-lease path with no behavior change. Timed-out execs are never retried on the fallback path (they're returned to the caller as-is), so this is safe for non-idempotent commands.

  ### Enabling the direct path

  Wire a `SandboxAddressRegistry` into `PlatformSandbox`:

  ```ts
  import { PlatformSandbox, InProcessSandboxAddressRegistry } from '@mastra/platform-workspace';

  const registry = new InProcessSandboxAddressRegistry();

  const sandbox = new PlatformSandbox({
    accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN,
    projectId: process.env.MASTRA_PLATFORM_PROJECT_ID,
    environmentId: process.env.MASTRA_PLATFORM_ENVIRONMENT_ID,
    addressRegistry: registry,
  });
  ```

  `PlatformSandbox.start()` populates the registry from the workspace-proxy's response; `executeCommand` reads it, tries the direct path first, evicts on transport failure. `destroy()` also evicts. `clone()` shares the same registry — each child sandbox looks up its own id.

  ### New public exports
  - `SandboxAddressRegistry` — the `{ get, set, delete }` interface `PlatformSandbox` sees. Callers can implement their own (e.g. shared across a worker pool) or use the default.
  - `InProcessSandboxAddressRegistry` — the default `Map`-backed implementation.
  - `PlatformSandboxOptions.addressRegistry?` — DI seam. Optional; omitted keeps pre-existing behavior.
  - `execViaPrivateNetwork`, `PrivateNetExecHttpError`, `PrivateNetExecOptions`, `PrivateNetExecResult`, `PrivateNetFetch` — standalone transport for callers that want to talk to a sandbox directly without going through `PlatformSandbox`.

### Patch Changes

- Updated dependencies [[`8d2399b`](https://github.com/mastra-ai/mastra/commit/8d2399b638f8e0945cf2cda0187dbea8dcf0b784), [`c8002da`](https://github.com/mastra-ai/mastra/commit/c8002da7775c468e2965b6ff5f82045450fa8cb9), [`92be47f`](https://github.com/mastra-ai/mastra/commit/92be47fbd26ffccec0e2131ef7c1d9e70dd5ef4a), [`89200ba`](https://github.com/mastra-ai/mastra/commit/89200bafa05444bb7949b363ce7b743e29867561), [`c950138`](https://github.com/mastra-ai/mastra/commit/c950138e72e4f317a40187e3800588731ab790ce), [`810c7e7`](https://github.com/mastra-ai/mastra/commit/810c7e74929989d8b8b5db52cd3af22cd0998af4), [`063c8b2`](https://github.com/mastra-ai/mastra/commit/063c8b2eb14e4e5ca021779bc33e8c3c031c8604), [`f9f9884`](https://github.com/mastra-ai/mastra/commit/f9f98848ee194dc71a787a709ec430b065cdc41b), [`e0904dc`](https://github.com/mastra-ai/mastra/commit/e0904dc538792e54e1806b70172e5900ac49bff4), [`9672fab`](https://github.com/mastra-ai/mastra/commit/9672fabfbcadb961a35c22a2d6722e077f7b24b9), [`f4e964c`](https://github.com/mastra-ai/mastra/commit/f4e964cad57057301d6bed5c55bcdd730175b941), [`1f7bbd7`](https://github.com/mastra-ai/mastra/commit/1f7bbd7785a8d230aad02454ecabeb4a0b2cc96f), [`e47ff36`](https://github.com/mastra-ai/mastra/commit/e47ff36945720f4ee4caa09f6e83514d7d188608), [`64d6781`](https://github.com/mastra-ai/mastra/commit/64d67814bccddd314f7e09643243821e57cb87b6), [`fb9a6ac`](https://github.com/mastra-ai/mastra/commit/fb9a6ac11c9560518742ece60b49d6b062845fd3), [`aa2cec8`](https://github.com/mastra-ai/mastra/commit/aa2cec8501f634d51c2f3ebfb3dd3aa7af8d2ca2), [`c848e65`](https://github.com/mastra-ai/mastra/commit/c848e655a64ff10331a8ceafafe7f18e70a0f092), [`2adf8eb`](https://github.com/mastra-ai/mastra/commit/2adf8eb4a70ed2b6cff2dd39281496ea0e025fac), [`0494489`](https://github.com/mastra-ai/mastra/commit/049448906e4c3d2d615bbe865b073a0d890ddb7c), [`8d1aeb8`](https://github.com/mastra-ai/mastra/commit/8d1aeb8acf7c20c4bb8e4d8e4bdc6569c83ac561), [`8264611`](https://github.com/mastra-ai/mastra/commit/8264611510e421b818bc7395dc2ae4d9c2d518b2), [`d8fa243`](https://github.com/mastra-ai/mastra/commit/d8fa2430d21113e330c4e676ac65e1235cf44f81), [`44fc98b`](https://github.com/mastra-ai/mastra/commit/44fc98b9d1242aa87a3ab44bdce9e9f12c44d8c9), [`f933ba3`](https://github.com/mastra-ai/mastra/commit/f933ba32700e1d0bf143311c1a08f88300b840b6), [`83065bf`](https://github.com/mastra-ai/mastra/commit/83065bfee9e47c3c6f09132a9034501f6cfb69cf), [`0f2ef41`](https://github.com/mastra-ai/mastra/commit/0f2ef4118da022e4f30dac4e9856cc3a8c97671c), [`01b162f`](https://github.com/mastra-ai/mastra/commit/01b162fe435295881aa7ea55f1759407ad5175ad)]:
  - @mastra/core@1.57.0

## 1.1.0-alpha.0

### Minor Changes

- `PlatformSandbox.executeCommand` can now dial the sandbox directly over Railway's private network instead of going through the platform's public exec proxy. On paths where the direct route is available, per-exec latency drops from ~400 ms p50 to ~16 ms p50, and the exec stops touching the platform control plane. This flows through to every filesystem call (`SandboxFilesystem.readFile`, `writeFile`, `readdir`, `mkdir`, `stat`, `exists`, `copyFile`, `moveFile`, `deleteFile`), which is where most agent tool time was going. ([#20664](https://github.com/mastra-ai/mastra/pull/20664))

  Direct-path availability is a runtime property, not a configuration knob. When it's not available — no address registry wired up, the workspace-proxy hasn't discovered the sandbox address yet, or a direct dial fails — `executeCommand` transparently falls back to the existing exec-lease path with no behavior change. Timed-out execs are never retried on the fallback path (they're returned to the caller as-is), so this is safe for non-idempotent commands.

  ### Enabling the direct path

  Wire a `SandboxAddressRegistry` into `PlatformSandbox`:

  ```ts
  import { PlatformSandbox, InProcessSandboxAddressRegistry } from '@mastra/platform-workspace';

  const registry = new InProcessSandboxAddressRegistry();

  const sandbox = new PlatformSandbox({
    accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN,
    projectId: process.env.MASTRA_PLATFORM_PROJECT_ID,
    environmentId: process.env.MASTRA_PLATFORM_ENVIRONMENT_ID,
    addressRegistry: registry,
  });
  ```

  `PlatformSandbox.start()` populates the registry from the workspace-proxy's response; `executeCommand` reads it, tries the direct path first, evicts on transport failure. `destroy()` also evicts. `clone()` shares the same registry — each child sandbox looks up its own id.

  ### New public exports
  - `SandboxAddressRegistry` — the `{ get, set, delete }` interface `PlatformSandbox` sees. Callers can implement their own (e.g. shared across a worker pool) or use the default.
  - `InProcessSandboxAddressRegistry` — the default `Map`-backed implementation.
  - `PlatformSandboxOptions.addressRegistry?` — DI seam. Optional; omitted keeps pre-existing behavior.
  - `execViaPrivateNetwork`, `PrivateNetExecHttpError`, `PrivateNetExecOptions`, `PrivateNetExecResult`, `PrivateNetFetch` — standalone transport for callers that want to talk to a sandbox directly without going through `PlatformSandbox`.

### Patch Changes

- Updated dependencies [[`89200ba`](https://github.com/mastra-ai/mastra/commit/89200bafa05444bb7949b363ce7b743e29867561), [`c950138`](https://github.com/mastra-ai/mastra/commit/c950138e72e4f317a40187e3800588731ab790ce), [`063c8b2`](https://github.com/mastra-ai/mastra/commit/063c8b2eb14e4e5ca021779bc33e8c3c031c8604), [`f4e964c`](https://github.com/mastra-ai/mastra/commit/f4e964cad57057301d6bed5c55bcdd730175b941), [`1f7bbd7`](https://github.com/mastra-ai/mastra/commit/1f7bbd7785a8d230aad02454ecabeb4a0b2cc96f), [`e47ff36`](https://github.com/mastra-ai/mastra/commit/e47ff36945720f4ee4caa09f6e83514d7d188608), [`fb9a6ac`](https://github.com/mastra-ai/mastra/commit/fb9a6ac11c9560518742ece60b49d6b062845fd3), [`aa2cec8`](https://github.com/mastra-ai/mastra/commit/aa2cec8501f634d51c2f3ebfb3dd3aa7af8d2ca2), [`2adf8eb`](https://github.com/mastra-ai/mastra/commit/2adf8eb4a70ed2b6cff2dd39281496ea0e025fac), [`8264611`](https://github.com/mastra-ai/mastra/commit/8264611510e421b818bc7395dc2ae4d9c2d518b2), [`44fc98b`](https://github.com/mastra-ai/mastra/commit/44fc98b9d1242aa87a3ab44bdce9e9f12c44d8c9), [`0f2ef41`](https://github.com/mastra-ai/mastra/commit/0f2ef4118da022e4f30dac4e9856cc3a8c97671c)]:
  - @mastra/core@1.57.0-alpha.1

## 1.0.0

### Major Changes

- Removed support for using `MASTRA_PLATFORM_SECRET_KEY` to authenticate workspace providers. Use the platform-injected `MASTRA_PLATFORM_ACCESS_TOKEN` or pass `accessToken` explicitly instead. ([#20695](https://github.com/mastra-ai/mastra/pull/20695))

  **Before:** Set `MASTRA_PLATFORM_SECRET_KEY`.

  **After:** Use the platform-injected `MASTRA_PLATFORM_ACCESS_TOKEN`. For local development, set `MASTRA_PLATFORM_ACCESS_TOKEN` to an organization API token, or pass it explicitly:

  ```typescript
  import { PlatformSandbox } from '@mastra/platform-workspace';

  const sandbox = new PlatformSandbox({
    accessToken: 'sk_your-api-token',
    projectId: 'project_abc',
    environmentId: 'environment_abc',
  });
  ```

### Minor Changes

- `PlatformSandbox.executeCommand` now retries a dropped connection once and continues using direct execution for later commands. Previously a single connection hiccup permanently downgraded the sandbox to a slower fallback route for the rest of its lifetime. ([#20482](https://github.com/mastra-ai/mastra/pull/20482))

  Execution failures now surface directly:

  - A destroyed sandbox throws the new `SandboxDestroyedError`. The cached sandbox is cleared, so the next call provisions a fresh one.
  - Two connection failures in a row against a live sandbox throw the new `SandboxExecTransportError`, which carries `sandboxId`, `command`, `attempts`, `opened`, `closeCode`, `closeReason`, and `wsEndpoint` for diagnostics.
  - Other platform errors previously masked by the fallback now bubble out as `PlatformApiError`.

  ```ts
  import { SandboxDestroyedError, SandboxExecTransportError } from '@mastra/platform-workspace';

  try {
    await sandbox.executeCommand('pytest');
  } catch (err) {
    if (err instanceof SandboxDestroyedError) {
      // Reprovision and retry.
    } else if (err instanceof SandboxExecTransportError) {
      // Connection failed twice; sandbox is still alive.
    }
  }
  ```

### Patch Changes

- Fixed `PlatformSandbox.clone()` silently ignoring `checkpointName`. Clones created with `clone({ checkpointName })` now reuse a matching captured checkpoint on `start()` instead of always provisioning a fresh sandbox, so repeated boots of the same session start much faster. ([#20477](https://github.com/mastra-ai/mastra/pull/20477))

  ```ts
  const child = template.clone({ checkpointName: 'mastra-recovery-session-42' });
  await child.start(); // Reuses the captured checkpoint when one is available.
  ```

  An explicit `id` still takes precedence over `checkpointName` when both are passed.

- Updated dependencies [[`4844167`](https://github.com/mastra-ai/mastra/commit/4844167cff2d5ec5004e94edd34970833040fa3f), [`c5e56ff`](https://github.com/mastra-ai/mastra/commit/c5e56ff3bcabdf062708f2d48744fec304df6792), [`594f7b2`](https://github.com/mastra-ai/mastra/commit/594f7b28f5263fb9982fd50d95c471fb971ea984), [`7f4e26d`](https://github.com/mastra-ai/mastra/commit/7f4e26dd57bd9b23c278ea21235ab823a3810a6c), [`311f943`](https://github.com/mastra-ai/mastra/commit/311f943bee60e8fdf5c84499ea50e884276c936c), [`322daa6`](https://github.com/mastra-ai/mastra/commit/322daa6d90552909204044790d850958f6745fed), [`db4e6ff`](https://github.com/mastra-ai/mastra/commit/db4e6ff744503112eb64deeaf6c2b54bf26a54c7), [`5faf93f`](https://github.com/mastra-ai/mastra/commit/5faf93f03e19daea394b9e2a923f2e4f833407f2), [`82201f7`](https://github.com/mastra-ai/mastra/commit/82201f75fae8e050a8de2df08b74875ee74c6b83), [`cadaa13`](https://github.com/mastra-ai/mastra/commit/cadaa1372e1077c8e85eb64c5499ba8803caa323), [`0c89896`](https://github.com/mastra-ai/mastra/commit/0c8989673fb7d106837098398131e570c6023b68), [`6d19a65`](https://github.com/mastra-ai/mastra/commit/6d19a6517f5da3911023d446b7e2d5dad8adb1cb), [`23b4238`](https://github.com/mastra-ai/mastra/commit/23b423844ad0bcf2a502a68dd62866d6160f9f6d), [`80ad891`](https://github.com/mastra-ai/mastra/commit/80ad891f8cd10379aa5b5af7510c763783b2ab56), [`fb18da5`](https://github.com/mastra-ai/mastra/commit/fb18da56fc35689ae370621a8f10b5b0d8606e20), [`fb18da5`](https://github.com/mastra-ai/mastra/commit/fb18da56fc35689ae370621a8f10b5b0d8606e20), [`e320a76`](https://github.com/mastra-ai/mastra/commit/e320a763feaf65c6be3cebecf746defcbde161b3), [`03b4918`](https://github.com/mastra-ai/mastra/commit/03b4918c80d188ce375334c393e131c6e94bd7eb), [`14ef73a`](https://github.com/mastra-ai/mastra/commit/14ef73a4bbd73e7808414816eb0628ce1d80b5d7), [`b582f7f`](https://github.com/mastra-ai/mastra/commit/b582f7fa2f9c1f87d19efc63d344fbe5dda2608c), [`0a6598b`](https://github.com/mastra-ai/mastra/commit/0a6598bde80bde008986ad6616bed9632b9294cb), [`06000d7`](https://github.com/mastra-ai/mastra/commit/06000d73712911572e913b8a83339270296d0a22), [`1d677d5`](https://github.com/mastra-ai/mastra/commit/1d677d5f99d7db403f7828585e8c25f299f72628), [`9e1dad8`](https://github.com/mastra-ai/mastra/commit/9e1dad8f7b1cab2bb7ade90e5b7561f24577b88a), [`2f43145`](https://github.com/mastra-ai/mastra/commit/2f4314504c03cbba280414ac81ba3197448ee6b0), [`4e35a56`](https://github.com/mastra-ai/mastra/commit/4e35a56cdf8d74a5ff6d5eda01f2c1deaf6cc7be), [`d94b8e1`](https://github.com/mastra-ai/mastra/commit/d94b8e1cee67416d518a8c30099040061bef6a1c), [`93e28ec`](https://github.com/mastra-ai/mastra/commit/93e28ecce9031c02397e0ae8406593e5c7a95883), [`729dab4`](https://github.com/mastra-ai/mastra/commit/729dab408faccfaef0cbb048e5a4338f9172847e), [`484003d`](https://github.com/mastra-ai/mastra/commit/484003d33ff59330c86b19863e4a38732d7e4155), [`3de0188`](https://github.com/mastra-ai/mastra/commit/3de0188bfaf9a9c09c95fe322b53838cf52c70b6), [`34d34d8`](https://github.com/mastra-ai/mastra/commit/34d34d8c811df512fef4dd5459f79b7821be1866), [`b582f7f`](https://github.com/mastra-ai/mastra/commit/b582f7fa2f9c1f87d19efc63d344fbe5dda2608c), [`933d291`](https://github.com/mastra-ai/mastra/commit/933d291146b789c19442ad206f94da3e4be90c64), [`a1cb98d`](https://github.com/mastra-ai/mastra/commit/a1cb98d11990b560b98482292a1f34aa1a2d9092), [`598ad82`](https://github.com/mastra-ai/mastra/commit/598ad82d41c41389a686338a1d0e50b7400e1938), [`1fd6aad`](https://github.com/mastra-ai/mastra/commit/1fd6aad1ea4a9d32f65efa832307c35e981a4c0a)]:
  - @mastra/core@1.56.0

## 1.0.0-alpha.2

### Major Changes

- Removed support for using `MASTRA_PLATFORM_SECRET_KEY` to authenticate workspace providers. Use the platform-injected `MASTRA_PLATFORM_ACCESS_TOKEN` or pass `accessToken` explicitly instead. ([#20695](https://github.com/mastra-ai/mastra/pull/20695))

  **Before:** Set `MASTRA_PLATFORM_SECRET_KEY`.

  **After:** Use the platform-injected `MASTRA_PLATFORM_ACCESS_TOKEN`. For local development, set `MASTRA_PLATFORM_ACCESS_TOKEN` to an organization API token, or pass it explicitly:

  ```typescript
  import { PlatformSandbox } from '@mastra/platform-workspace';

  const sandbox = new PlatformSandbox({
    accessToken: 'sk_your-api-token',
    projectId: 'project_abc',
    environmentId: 'environment_abc',
  });
  ```

### Patch Changes

- Updated dependencies [[`d94b8e1`](https://github.com/mastra-ai/mastra/commit/d94b8e1cee67416d518a8c30099040061bef6a1c)]:
  - @mastra/core@1.56.0-alpha.7

## 0.3.0-alpha.1

### Minor Changes

- `PlatformSandbox.executeCommand` now retries a dropped connection once and continues using direct execution for later commands. Previously a single connection hiccup permanently downgraded the sandbox to a slower fallback route for the rest of its lifetime. ([#20482](https://github.com/mastra-ai/mastra/pull/20482))

  Execution failures now surface directly:

  - A destroyed sandbox throws the new `SandboxDestroyedError`. The cached sandbox is cleared, so the next call provisions a fresh one.
  - Two connection failures in a row against a live sandbox throw the new `SandboxExecTransportError`, which carries `sandboxId`, `command`, `attempts`, `opened`, `closeCode`, `closeReason`, and `wsEndpoint` for diagnostics.
  - Other platform errors previously masked by the fallback now bubble out as `PlatformApiError`.

  ```ts
  import { SandboxDestroyedError, SandboxExecTransportError } from '@mastra/platform-workspace';

  try {
    await sandbox.executeCommand('pytest');
  } catch (err) {
    if (err instanceof SandboxDestroyedError) {
      // Reprovision and retry.
    } else if (err instanceof SandboxExecTransportError) {
      // Connection failed twice; sandbox is still alive.
    }
  }
  ```

### Patch Changes

- Updated dependencies [[`594f7b2`](https://github.com/mastra-ai/mastra/commit/594f7b28f5263fb9982fd50d95c471fb971ea984), [`311f943`](https://github.com/mastra-ai/mastra/commit/311f943bee60e8fdf5c84499ea50e884276c936c), [`0c89896`](https://github.com/mastra-ai/mastra/commit/0c8989673fb7d106837098398131e570c6023b68), [`23b4238`](https://github.com/mastra-ai/mastra/commit/23b423844ad0bcf2a502a68dd62866d6160f9f6d), [`e320a76`](https://github.com/mastra-ai/mastra/commit/e320a763feaf65c6be3cebecf746defcbde161b3), [`03b4918`](https://github.com/mastra-ai/mastra/commit/03b4918c80d188ce375334c393e131c6e94bd7eb), [`14ef73a`](https://github.com/mastra-ai/mastra/commit/14ef73a4bbd73e7808414816eb0628ce1d80b5d7), [`1d677d5`](https://github.com/mastra-ai/mastra/commit/1d677d5f99d7db403f7828585e8c25f299f72628), [`93e28ec`](https://github.com/mastra-ai/mastra/commit/93e28ecce9031c02397e0ae8406593e5c7a95883), [`729dab4`](https://github.com/mastra-ai/mastra/commit/729dab408faccfaef0cbb048e5a4338f9172847e), [`484003d`](https://github.com/mastra-ai/mastra/commit/484003d33ff59330c86b19863e4a38732d7e4155), [`933d291`](https://github.com/mastra-ai/mastra/commit/933d291146b789c19442ad206f94da3e4be90c64)]:
  - @mastra/core@1.56.0-alpha.3

## 0.2.4-alpha.0

### Patch Changes

- Fixed `PlatformSandbox.clone()` silently ignoring `checkpointName`. Clones created with `clone({ checkpointName })` now reuse a matching captured checkpoint on `start()` instead of always provisioning a fresh sandbox, so repeated boots of the same session start much faster. ([#20477](https://github.com/mastra-ai/mastra/pull/20477))

  ```ts
  const child = template.clone({ checkpointName: 'mastra-recovery-session-42' });
  await child.start(); // Reuses the captured checkpoint when one is available.
  ```

  An explicit `id` still takes precedence over `checkpointName` when both are passed.

- Updated dependencies [[`322daa6`](https://github.com/mastra-ai/mastra/commit/322daa6d90552909204044790d850958f6745fed), [`cadaa13`](https://github.com/mastra-ai/mastra/commit/cadaa1372e1077c8e85eb64c5499ba8803caa323), [`06000d7`](https://github.com/mastra-ai/mastra/commit/06000d73712911572e913b8a83339270296d0a22), [`3de0188`](https://github.com/mastra-ai/mastra/commit/3de0188bfaf9a9c09c95fe322b53838cf52c70b6)]:
  - @mastra/core@1.56.0-alpha.2

## 0.2.3

### Patch Changes

- Fix direct-exec fallback loop: when the WebSocket transport fails on a sandbox (Railway rejects the handshake, mid-stream drop, etc.), disable direct-exec permanently for that sandbox instead of re-minting a fresh lease on every subsequent exec. Also surface WebSocket close code, reason, and `opened` state in `DirectExecResult` and emit a diagnostic warning on transport failure so we can see why Railway is refusing the upgrade in production. ([#20412](https://github.com/mastra-ai/mastra/pull/20412))

- Updated dependencies [[`3f472b4`](https://github.com/mastra-ai/mastra/commit/3f472b468892a1ff14ccb43cc0343b86f7d8fd7d), [`ba369f2`](https://github.com/mastra-ai/mastra/commit/ba369f2a0aaf998da0d6aa033d26f64f96bef8ac), [`35b929b`](https://github.com/mastra-ai/mastra/commit/35b929b7abc3d20d85c7985880960ac2d04a6c86), [`55c9e24`](https://github.com/mastra-ai/mastra/commit/55c9e248c27c1d72b5bb7e94ea6b8a3999eee49f), [`dcfed93`](https://github.com/mastra-ai/mastra/commit/dcfed93e1e256c6abfa792cbb7ca836f5d0e8638), [`2876e15`](https://github.com/mastra-ai/mastra/commit/2876e15b4d2f616a3bc1ed3af57d546c268384ce), [`9b3626a`](https://github.com/mastra-ai/mastra/commit/9b3626aeb1d16fcd34b0a8e94c114ddb80a3b240), [`4696963`](https://github.com/mastra-ai/mastra/commit/469696312ac4c618bc8475b0c5ed7949b8a3455e), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`07f5b4b`](https://github.com/mastra-ai/mastra/commit/07f5b4ba9d608d88865030732e580298296adf99), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`598080f`](https://github.com/mastra-ai/mastra/commit/598080f224edb3f0f5b801035b067fac50a56a03)]:
  - @mastra/core@1.55.0

## 0.2.3-alpha.0

### Patch Changes

- Fix direct-exec fallback loop: when the WebSocket transport fails on a sandbox (Railway rejects the handshake, mid-stream drop, etc.), disable direct-exec permanently for that sandbox instead of re-minting a fresh lease on every subsequent exec. Also surface WebSocket close code, reason, and `opened` state in `DirectExecResult` and emit a diagnostic warning on transport failure so we can see why Railway is refusing the upgrade in production. ([#20412](https://github.com/mastra-ai/mastra/pull/20412))

- Updated dependencies [[`55c9e24`](https://github.com/mastra-ai/mastra/commit/55c9e248c27c1d72b5bb7e94ea6b8a3999eee49f), [`07f5b4b`](https://github.com/mastra-ai/mastra/commit/07f5b4ba9d608d88865030732e580298296adf99)]:
  - @mastra/core@1.55.0-alpha.2

## 0.2.2

### Patch Changes

- **Added:** Direct exec data plane for `PlatformSandbox`. ([#20326](https://github.com/mastra-ai/mastra/pull/20326))

  Commands now execute against Railway's WebSocket endpoint directly using a short-lived JWT lease minted by the workspace proxy, instead of proxying every exec through the HTTP proxy. This removes the workspace proxy from the exec hot path — cutting latency for large-payload commands (e.g. `pnpm install`) and eliminating duplicated observability spans.

  The change is transparent: `executeCommand` still returns the same `CommandResult` shape. If the proxy's `/exec-lease` endpoint is unavailable (older deployments), the client automatically falls back to the legacy `POST /sandbox/:id/exec` route for the lifetime of the sandbox.

- Fixed platform sandbox reattach and made provisioning resilient to transient proxy failures: ([#20294](https://github.com/mastra-ai/mastra/pull/20294))

  - The workspace proxy assigns its own sandbox id on create (the advisory id in the request body is not honored), but `getInfo()` never exposed it, so callers persisting a reattach id (e.g. the Factory sandbox fleet, which reads `metadata.sandboxId`) stored the locally generated construction id instead. Every reattach then 404'd and each session open provisioned a brand-new sandbox and re-cloned the repository. `getInfo()` now reports the platform-assigned id in `metadata.sandboxId`, and `start()` treats a sandbox record with `destroyedAt` set as gone (falls through to a fresh provision) instead of pointing exec at a dead resource.
  - Sandbox creation retries transient workspace-proxy 5xx responses with a short backoff. Provisioning intermittently fails with proxy 500s while the provider is under load; a retry keeps a single flaky window from failing the caller's whole workflow (e.g. Factory kickoff runs). Non-transient errors (4xx) still fail immediately.

- Updated dependencies [[`ce93a3c`](https://github.com/mastra-ai/mastra/commit/ce93a3c114ea1cbfbd576f3db41d7c26c9844f5b), [`5718a22`](https://github.com/mastra-ai/mastra/commit/5718a229281dcfd36bcd1f42a242e3717e510a33), [`a211d09`](https://github.com/mastra-ai/mastra/commit/a211d09185dc65a746534914cf38b67f21ee9bac), [`0dca9d0`](https://github.com/mastra-ai/mastra/commit/0dca9d0b1356024a53b72ea6f040db528b126caa), [`6218217`](https://github.com/mastra-ai/mastra/commit/62182171b6cfca0b099f1c6a77a2e65e7639ab86), [`5807d3a`](https://github.com/mastra-ai/mastra/commit/5807d3ae1d259b8b7d6df7e5bf2b485c694af9c8), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`05db566`](https://github.com/mastra-ai/mastra/commit/05db566fcbdcbf33d0bffca0c72ec30129e2e3ca), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`5718a22`](https://github.com/mastra-ai/mastra/commit/5718a229281dcfd36bcd1f42a242e3717e510a33), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`d1b7e3a`](https://github.com/mastra-ai/mastra/commit/d1b7e3a978a309a5653eeaa490d2d6c7c53bd093), [`29c584a`](https://github.com/mastra-ai/mastra/commit/29c584a13a88831e5ed1fdeb0ff8e82eae180433), [`c093146`](https://github.com/mastra-ai/mastra/commit/c0931466404d3c521308ea119cb165bb7e695155), [`8124754`](https://github.com/mastra-ai/mastra/commit/8124754ae89fbc69f8136d1df4a91904d0f84c4e), [`d12b2e4`](https://github.com/mastra-ai/mastra/commit/d12b2e4023fd9e3d3e93a9169f5088bcee2a849c)]:
  - @mastra/core@1.54.0

## 0.2.2-alpha.0

### Patch Changes

- Fixed platform sandbox reattach and made provisioning resilient to transient proxy failures: ([#20294](https://github.com/mastra-ai/mastra/pull/20294))

  - The workspace proxy assigns its own sandbox id on create (the advisory id in the request body is not honored), but `getInfo()` never exposed it, so callers persisting a reattach id (e.g. the Factory sandbox fleet, which reads `metadata.sandboxId`) stored the locally generated construction id instead. Every reattach then 404'd and each session open provisioned a brand-new sandbox and re-cloned the repository. `getInfo()` now reports the platform-assigned id in `metadata.sandboxId`, and `start()` treats a sandbox record with `destroyedAt` set as gone (falls through to a fresh provision) instead of pointing exec at a dead resource.
  - Sandbox creation retries transient workspace-proxy 5xx responses with a short backoff. Provisioning intermittently fails with proxy 500s while the provider is under load; a retry keeps a single flaky window from failing the caller's whole workflow (e.g. Factory kickoff runs). Non-transient errors (4xx) still fail immediately.

- Updated dependencies [[`6218217`](https://github.com/mastra-ai/mastra/commit/62182171b6cfca0b099f1c6a77a2e65e7639ab86), [`d12b2e4`](https://github.com/mastra-ai/mastra/commit/d12b2e4023fd9e3d3e93a9169f5088bcee2a849c)]:
  - @mastra/core@1.54.0-alpha.4

## 0.2.1

### Patch Changes

- Fixed PlatformSandbox reattach so stale sandbox IDs are recreated before commands run. ([#20102](https://github.com/mastra-ai/mastra/pull/20102))

- Updated dependencies [[`c8d8a01`](https://github.com/mastra-ai/mastra/commit/c8d8a010ee2efe2b7bf4d07707382c34c87b14e4), [`df6a9ce`](https://github.com/mastra-ai/mastra/commit/df6a9ce87214f7aadb2edfe62f67605fe998a0a4), [`73839cb`](https://github.com/mastra-ai/mastra/commit/73839cb58322679c170627d1015669ede5f619aa), [`371cf60`](https://github.com/mastra-ai/mastra/commit/371cf6075cef88ac6919a08d59a82e485397364a), [`8e4dc79`](https://github.com/mastra-ai/mastra/commit/8e4dc793dcf035ea506f9ce79f56d2d501a4be14), [`2db93cc`](https://github.com/mastra-ai/mastra/commit/2db93ccd0b872e4de7853a93383efe0647901df8), [`094ab61`](https://github.com/mastra-ai/mastra/commit/094ab6129a1a3ecf6eeb86decac17d5faea4e02a), [`fe80944`](https://github.com/mastra-ai/mastra/commit/fe80944f3ef6681fea6eae8200fce387b7bb3c2f), [`263d2ca`](https://github.com/mastra-ai/mastra/commit/263d2cac80ba3b03b9c0f008db6f1f1b9eb0278c), [`75f843d`](https://github.com/mastra-ai/mastra/commit/75f843d09f758223e6eeb321321bdcc5c7e779d0), [`e51e166`](https://github.com/mastra-ai/mastra/commit/e51e166c52e220abc9b64554ce37359dca8544b1)]:
  - @mastra/core@1.53.0

## 0.2.1-alpha.0

### Patch Changes

- Fixed PlatformSandbox reattach so stale sandbox IDs are recreated before commands run. ([#20102](https://github.com/mastra-ai/mastra/pull/20102))

- Updated dependencies [[`df6a9ce`](https://github.com/mastra-ai/mastra/commit/df6a9ce87214f7aadb2edfe62f67605fe998a0a4)]:
  - @mastra/core@1.52.2-alpha.0

## 0.2.0

### Minor Changes

- Renamed the environment variable read by PlatformSandbox and PlatformFilesystem for platform authentication from MASTRA_PLATFORM_ACCESS_TOKEN to MASTRA_PLATFORM_SECRET_KEY. The old variable still works as a deprecated fallback. ([#19932](https://github.com/mastra-ai/mastra/pull/19932))

- Added `clone()` support to `PlatformSandbox`. `clone()` constructs an unstarted sibling sandbox that inherits the template's configuration (access token, project, environment, network isolation, timeout, instructions, env, idle timeout) with per-instance overrides for `id`, `sandboxId`, `env`, and `idleTimeoutMinutes`, so one configured sandbox can act as a template for a fleet of sandbox clones (for example, one per project). ([#19647](https://github.com/mastra-ai/mastra/pull/19647))

  ```ts
  const template = new PlatformSandbox({
    accessToken,
    projectId,
    environmentId,
  });

  const projectSandbox = template.clone({
    id: 'mc-project-42',
    env: { GITHUB_TOKEN: token },
    idleTimeoutMinutes: 30,
  });
  await projectSandbox.start();
  ```

  This brings `PlatformSandbox` up to parity with the other sandbox providers (`@mastra/railway`, `@mastra/e2b`, `@mastra/daytona`, `@mastra/modal`, `@mastra/docker`, `@mastra/blaxel`, `@mastra/apple-container`, `@mastra/vercel`) so it can be used with `MastraFactory` fleets and the MC Web factory.

### Patch Changes

- `PlatformSandbox` now includes its caller-facing `id` on the `POST /v1/projects/:projectId/sandbox` wire body when provisioning a new sandbox. The Mastra Platform treats this as an advisory recovery key so callers can opt into checkpoint-based sandbox recovery — if the platform recognizes the id from a previous session, the new sandbox boots from the most recent checkpoint instead of the base template. Unknown ids fall through to a fresh sandbox, so existing callers see no change in behavior. ([#19648](https://github.com/mastra-ai/mastra/pull/19648))

  No API changes — the value sent is the same `id` you already pass to `new PlatformSandbox({ id })` (or the auto-generated one).

- Updated dependencies [[`ec857fc`](https://github.com/mastra-ai/mastra/commit/ec857fc79c264b53b38e16478c789b7177f2ad59), [`d7385ad`](https://github.com/mastra-ai/mastra/commit/d7385ad9e88f9e4f33d15c0ec0bfebedde0cbc2e), [`41a5392`](https://github.com/mastra-ai/mastra/commit/41a5392d9f6c5e18d6b227f0fc0ddf49c50774e9), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`1426af2`](https://github.com/mastra-ai/mastra/commit/1426af24975879c000d13ac75673f630fcc970c1), [`a40adeb`](https://github.com/mastra-ai/mastra/commit/a40adeb222b961a56a58af56a106106525721b74), [`8a0d145`](https://github.com/mastra-ai/mastra/commit/8a0d145aadbdf7278665aceaaec364b35dd9bd94), [`bd2f1d2`](https://github.com/mastra-ai/mastra/commit/bd2f1d274d05e60e2366f005ea0d94d5cea0d5ff), [`e1f2fae`](https://github.com/mastra-ai/mastra/commit/e1f2faebaf048c3d4c2e2c01d293767c195d5794), [`63aa799`](https://github.com/mastra-ai/mastra/commit/63aa799c6b44eacc7806cda6846b7c5bbee06b37), [`b7e79c3`](https://github.com/mastra-ai/mastra/commit/b7e79c3c02ac5cd415db34ba0975ceafc1464333), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`da009e1`](https://github.com/mastra-ai/mastra/commit/da009e1aacd89ed94b8d1b2af09c9d4fe7c4db49), [`3b77e77`](https://github.com/mastra-ai/mastra/commit/3b77e7704936522e4769d29de1b5ea6901f302bd), [`c7d30cd`](https://github.com/mastra-ai/mastra/commit/c7d30cd86009c407df91105591f03cd6e3d2854d), [`21a0eb8`](https://github.com/mastra-ai/mastra/commit/21a0eb86746ba0b703acea360d4f84c6a5a493f2), [`8b20926`](https://github.com/mastra-ai/mastra/commit/8b20926cd59e2ba3d66458e062fa0e6e2ada3e68), [`975295d`](https://github.com/mastra-ai/mastra/commit/975295d418552f0d46a59edfef4c3ee555f9930a), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`6b1bf3b`](https://github.com/mastra-ai/mastra/commit/6b1bf3b9494bd51aa8f654c68c9355d6046fa2a1), [`35c2181`](https://github.com/mastra-ai/mastra/commit/35c2181e6a50e47c90ba36260db7c9723d54696f), [`0a2c22c`](https://github.com/mastra-ai/mastra/commit/0a2c22c902604439ec490319e14c17f331e0c84c), [`4cfdd64`](https://github.com/mastra-ai/mastra/commit/4cfdd645794feaea0c4ea711e70ecdfbef0c5b8e), [`b75d749`](https://github.com/mastra-ai/mastra/commit/b75d749621ff5d17e86bcb4ee809d301fb4f7cf3), [`821648b`](https://github.com/mastra-ai/mastra/commit/821648bf2871ef840100c7bacbecf676010bd12a), [`de86fd7`](https://github.com/mastra-ai/mastra/commit/de86fd7119f0438381d1a642e3d258143c0b9c29), [`2745031`](https://github.com/mastra-ai/mastra/commit/2745031d1d4a4978f037092da371428c32e2842a), [`b4b7ea8`](https://github.com/mastra-ai/mastra/commit/b4b7ea8733f033fc441ea47ed03f6afb17ec2248), [`3a8024c`](https://github.com/mastra-ai/mastra/commit/3a8024ce615f8aa89479c0d71fe61d10bb0040be), [`35865a5`](https://github.com/mastra-ai/mastra/commit/35865a53e194aa9634d6a70a97010e7a6b9d58b1), [`74faf8b`](https://github.com/mastra-ai/mastra/commit/74faf8bd9c1018f2492653c06b1e25fc8300e9e6), [`ef03fbc`](https://github.com/mastra-ai/mastra/commit/ef03fbcc556bcbc04c9b3d06fab88771ecaa043c), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`70687f7`](https://github.com/mastra-ai/mastra/commit/70687f7e495a322a02070b4a67cb0c77a5ca91ec), [`1fadac4`](https://github.com/mastra-ai/mastra/commit/1fadac44537caeefe81f9f775ae2f2f3d94e9069), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`76b7181`](https://github.com/mastra-ai/mastra/commit/76b71810366e6d90b9d3973149d1c7ba3659ffb9), [`792ec9a`](https://github.com/mastra-ai/mastra/commit/792ec9a0869bab8274cf5e0ed2840738737a1607), [`712b864`](https://github.com/mastra-ai/mastra/commit/712b864aa1ed12b14c54390ec17b69de163c37f7), [`85e4fb5`](https://github.com/mastra-ai/mastra/commit/85e4fb50087a81c74df3a762f53b56373db0b912), [`0c0e8d7`](https://github.com/mastra-ai/mastra/commit/0c0e8d7becd4d1445c656b78d5d845f606c1ff9d), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`72e437c`](https://github.com/mastra-ai/mastra/commit/72e437c515942c80b9def5b026e0bdee61b469d9), [`8f7a5de`](https://github.com/mastra-ai/mastra/commit/8f7a5dedc246cdc938bb65516703cf9b27b03756), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`11f6cd9`](https://github.com/mastra-ai/mastra/commit/11f6cd96fe42582403416608beb212cc1a2cc79e), [`ef03c0c`](https://github.com/mastra-ai/mastra/commit/ef03c0cfc62367a458e4cc56462e2148b35681c5), [`4fb4d88`](https://github.com/mastra-ai/mastra/commit/4fb4d881bc107acee13890ad4d78661016c510ed), [`4e68363`](https://github.com/mastra-ai/mastra/commit/4e683634f94ebd062d26a3bb6093a8dfc7263d37), [`c328769`](https://github.com/mastra-ai/mastra/commit/c3287698ff8ef98dba86d415faa566fa3e5f4d56), [`9f7c67a`](https://github.com/mastra-ai/mastra/commit/9f7c67abeeb52c41c51a9b5edee60b62afe7cd8d), [`3b65e68`](https://github.com/mastra-ai/mastra/commit/3b65e68d7f1c771c7a70eea42d83fefdd28cad88), [`4eba27a`](https://github.com/mastra-ai/mastra/commit/4eba27adcf60f991df0e62f94b3e75b4e67f3b4b), [`c701be3`](https://github.com/mastra-ai/mastra/commit/c701be32d7d9aa94a66da8c6cc38dcac6856f464), [`db650ce`](https://github.com/mastra-ai/mastra/commit/db650ce490348914e85b93651d83acdf8f2a4c31), [`232fcbc`](https://github.com/mastra-ai/mastra/commit/232fcbc14fce625dd672ba043329c0b732c62be2), [`6354eeb`](https://github.com/mastra-ai/mastra/commit/6354eeb32efa9f5f68f51dda394e90e2ee76f1fb), [`a8799bb`](https://github.com/mastra-ai/mastra/commit/a8799bb8e44f4a60d01e4e2acd3448ff80bf14f8), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`e3868e2`](https://github.com/mastra-ai/mastra/commit/e3868e22babfffd0133771669ca724501c2dd58e), [`9251370`](https://github.com/mastra-ai/mastra/commit/9251370ad413af464aa22d7566338bec5613e8de), [`3491666`](https://github.com/mastra-ai/mastra/commit/34916663c4fdd43b48c21f4ab2d5fb6dcccc94f9), [`c0bec73`](https://github.com/mastra-ai/mastra/commit/c0bec732c93d1a22ae5e51ed66cf8cacca8bd6a6)]:
  - @mastra/core@1.52.0

## 0.2.0-alpha.1

### Minor Changes

- Renamed the environment variable read by PlatformSandbox and PlatformFilesystem for platform authentication from MASTRA_PLATFORM_ACCESS_TOKEN to MASTRA_PLATFORM_SECRET_KEY. The old variable still works as a deprecated fallback. ([#19932](https://github.com/mastra-ai/mastra/pull/19932))

## 0.2.0-alpha.0

### Minor Changes

- Added `clone()` support to `PlatformSandbox`. `clone()` constructs an unstarted sibling sandbox that inherits the template's configuration (access token, project, environment, network isolation, timeout, instructions, env, idle timeout) with per-instance overrides for `id`, `sandboxId`, `env`, and `idleTimeoutMinutes`, so one configured sandbox can act as a template for a fleet of sandbox clones (for example, one per project). ([#19647](https://github.com/mastra-ai/mastra/pull/19647))

  ```ts
  const template = new PlatformSandbox({
    accessToken,
    projectId,
    environmentId,
  });

  const projectSandbox = template.clone({
    id: 'mc-project-42',
    env: { GITHUB_TOKEN: token },
    idleTimeoutMinutes: 30,
  });
  await projectSandbox.start();
  ```

  This brings `PlatformSandbox` up to parity with the other sandbox providers (`@mastra/railway`, `@mastra/e2b`, `@mastra/daytona`, `@mastra/modal`, `@mastra/docker`, `@mastra/blaxel`, `@mastra/apple-container`, `@mastra/vercel`) so it can be used with `MastraFactory` fleets and the MC Web factory.

### Patch Changes

- `PlatformSandbox` now includes its caller-facing `id` on the `POST /v1/projects/:projectId/sandbox` wire body when provisioning a new sandbox. The Mastra Platform treats this as an advisory recovery key so callers can opt into checkpoint-based sandbox recovery — if the platform recognizes the id from a previous session, the new sandbox boots from the most recent checkpoint instead of the base template. Unknown ids fall through to a fresh sandbox, so existing callers see no change in behavior. ([#19648](https://github.com/mastra-ai/mastra/pull/19648))

  No API changes — the value sent is the same `id` you already pass to `new PlatformSandbox({ id })` (or the auto-generated one).

- Updated dependencies [[`a40adeb`](https://github.com/mastra-ai/mastra/commit/a40adeb222b961a56a58af56a106106525721b74), [`821648b`](https://github.com/mastra-ai/mastra/commit/821648bf2871ef840100c7bacbecf676010bd12a), [`11f6cd9`](https://github.com/mastra-ai/mastra/commit/11f6cd96fe42582403416608beb212cc1a2cc79e)]:
  - @mastra/core@1.52.0-alpha.6

## 0.1.0

### Minor Changes

- Added Mastra Platform workspace providers for connecting agents to Platform sandboxes and bucket-backed filesystems. ([#18908](https://github.com/mastra-ai/mastra/pull/18908))

  `PlatformFilesystem` and `PlatformSandbox` extend `MastraFilesystem` / `MastraSandbox` from `@mastra/core/workspace` and speak the workspace-proxy wire format (`Authorization: Bearer sk_*`, project-scoped routes at `/v1/projects/:projectId/...`). Both accept config directly and fall back to env vars (`MASTRA_PLATFORM_ACCESS_TOKEN`, `MASTRA_PROJECT_ID`, `MASTRA_ENVIRONMENT_ID`, `MASTRA_PLATFORM_BUCKET_NAME`, `MASTRA_WORKSPACE_PROXY_URL`).

  ```ts
  import { Workspace } from '@mastra/core/workspace';
  import { PlatformFilesystem, PlatformSandbox } from '@mastra/platform-workspace';

  const workspace = new Workspace({
    filesystem: new PlatformFilesystem({ bucketName: 'dev-bucket' }),
    sandbox: new PlatformSandbox({
      environmentId: 'env_123',
      idleTimeoutMinutes: 30,
      networkIsolation: 'ISOLATED',
    }),
  });
  ```

  Also exports `platformFilesystemProvider` and `platformSandboxProvider` descriptors for hosts that register providers dynamically through the editor's `FilesystemProvider` / `SandboxProvider` registries:

  ```ts
  import { platformFilesystemProvider, platformSandboxProvider } from '@mastra/platform-workspace';

  registry.registerFilesystem(platformFilesystemProvider);
  registry.registerSandbox(platformSandboxProvider);
  ```

### Patch Changes

- Updated dependencies [[`bd6d240`](https://github.com/mastra-ai/mastra/commit/bd6d2402db93dddaef0721667e7e8a030e7c6e16), [`0111486`](https://github.com/mastra-ai/mastra/commit/01114867612593eef5cfa2fda6a1194dfedda841), [`96a3749`](https://github.com/mastra-ai/mastra/commit/96a37492235f5b8076b3e3177d83ed5a5e44a640), [`fe1bda0`](https://github.com/mastra-ai/mastra/commit/fe1bda06f6af92a694a51712db747cda1e7185f0), [`25e7c12`](https://github.com/mastra-ai/mastra/commit/25e7c126a770069ae7fb7ecf1d2adb40e017b009), [`1ce5121`](https://github.com/mastra-ai/mastra/commit/1ce512155d122bb21f47d98383e82ffbf84b39e8), [`fb8aea3`](https://github.com/mastra-ai/mastra/commit/fb8aea384291e77311be3a64ee1717320d5c3c73), [`4adc391`](https://github.com/mastra-ai/mastra/commit/4adc3911075249c352bb4832d2471922826344de), [`a5c6337`](https://github.com/mastra-ai/mastra/commit/a5c6337d23c7686c81a32ce62f550f610543a240), [`3cfc47a`](https://github.com/mastra-ai/mastra/commit/3cfc47a6b89940aadd0f46fb01ae9624a73a865d), [`2bb7817`](https://github.com/mastra-ai/mastra/commit/2bb78176112fde628483de2830528f7eee911e56), [`51d9870`](https://github.com/mastra-ai/mastra/commit/51d987032c689c2855374d0f244f5d654da809d1), [`5cab274`](https://github.com/mastra-ai/mastra/commit/5cab2744250e22d12fefa7b32637dce224233cee), [`7fa27d3`](https://github.com/mastra-ai/mastra/commit/7fa27d3b6f5ed68cd34e454a4d3ad9c482a0cfbc), [`8b97958`](https://github.com/mastra-ai/mastra/commit/8b979589f9aa59ba67cac565949475f2ffeb4ac3), [`8410541`](https://github.com/mastra-ai/mastra/commit/84105412c60ecd3bb33a9838146f59c4b588228f), [`a58dcbb`](https://github.com/mastra-ai/mastra/commit/a58dcbb546d7e1d65ebdc1f39e55f0908fcd9391), [`aa38805`](https://github.com/mastra-ai/mastra/commit/aa38805b878b827403be785eb90688d7172f5a40), [`153bd3b`](https://github.com/mastra-ai/mastra/commit/153bd3b396bdfed6b74cf43de12db8fd2d83c04a), [`45a8e65`](https://github.com/mastra-ai/mastra/commit/45a8e65e1556d1362cb3f25187023c36de26661d), [`e955965`](https://github.com/mastra-ai/mastra/commit/e955965dce575a903e37cf054d28ea99aa48785e), [`2d22570`](https://github.com/mastra-ai/mastra/commit/2d22570c7dfdd02123d0ecc529efb05ccba2d9fc), [`07bb863`](https://github.com/mastra-ai/mastra/commit/07bb8631919c6f7cf377dccd45b096e0f17fbed0), [`c8ed116`](https://github.com/mastra-ai/mastra/commit/c8ed11699f62bcac70102ab4ec84d80d20541da6), [`01b338c`](https://github.com/mastra-ai/mastra/commit/01b338c56271f0219606710e3e8b26dee27ac6c2), [`a99eae8`](https://github.com/mastra-ai/mastra/commit/a99eae8908e500c1b2d12f9d277be616b98617a5), [`860ef7e`](https://github.com/mastra-ai/mastra/commit/860ef7e77d92b63469cbe5857aa1e626197e43e9), [`17e818c`](https://github.com/mastra-ai/mastra/commit/17e818c51a958ba90641b1a959dc38faf8c034e9), [`edce8d2`](https://github.com/mastra-ai/mastra/commit/edce8d2769f19e27a05737c627af2d765472a4f8), [`8a586ec`](https://github.com/mastra-ai/mastra/commit/8a586eca9a4914f31dff6140d0d45ac375b00669), [`4451dfe`](https://github.com/mastra-ai/mastra/commit/4451dfe857428e7abcc0261a507a2e186dae6d47), [`8b7361d`](https://github.com/mastra-ai/mastra/commit/8b7361d35de68b80d05d30a74e0c69e7218fd612), [`1d39058`](https://github.com/mastra-ai/mastra/commit/1d39058e548efd691799985d5c8af2737f1c3bd2), [`3927473`](https://github.com/mastra-ai/mastra/commit/392747323ddb10c643d12be7b9ae913159dfaeed), [`dce50dc`](https://github.com/mastra-ai/mastra/commit/dce50dc9a1c1fcd0f427bb5f6250ec74910cb04b), [`fd13f8e`](https://github.com/mastra-ai/mastra/commit/fd13f8e21990f9904c3eedba3a626bb4a929cdb8), [`634caff`](https://github.com/mastra-ai/mastra/commit/634caff29a9200ad058b67d53f96d9e5832fb8a2), [`f703f87`](https://github.com/mastra-ai/mastra/commit/f703f878de072d51fda557f9c50867d8252bef05), [`3e26c87`](https://github.com/mastra-ai/mastra/commit/3e26c87de0c5bc2583b795ce6ca5889b6b161acb), [`33f2b88`](https://github.com/mastra-ai/mastra/commit/33f2b88842c09a567f906fac4cb61cd5277ced59), [`177010f`](https://github.com/mastra-ai/mastra/commit/177010ff096d2e4b28d89803be5b1a4cad2a0d6b), [`0ad646f`](https://github.com/mastra-ai/mastra/commit/0ad646f71a530f2454664299e5e01bfd13fa12e5), [`b486abf`](https://github.com/mastra-ai/mastra/commit/b486abfa2a7528c6f527e4015c819ea9fa54aaad), [`54a51e0`](https://github.com/mastra-ai/mastra/commit/54a51e0a484fe1ebad3fb1f7ef5282a075709eb7), [`c43f3a9`](https://github.com/mastra-ai/mastra/commit/c43f3a9d1efde99b38789364ba4d0ba670f430e3), [`a5008f2`](https://github.com/mastra-ai/mastra/commit/a5008f22ae710ad9402ea9f2547d8c02f74d384b), [`e2d5f37`](https://github.com/mastra-ai/mastra/commit/e2d5f373bd289be534d5f8694d34465010533df6), [`4ce0163`](https://github.com/mastra-ai/mastra/commit/4ce0163dc86e675a86809685c8ce6c49f1aeb87e), [`4378341`](https://github.com/mastra-ai/mastra/commit/43783412df5ea3dd35f5b1f6e4851e79c346fc89)]:
  - @mastra/core@1.51.0

## 0.1.0-alpha.0

### Minor Changes

- Added Mastra Platform workspace providers for connecting agents to Platform sandboxes and bucket-backed filesystems. ([#18908](https://github.com/mastra-ai/mastra/pull/18908))

  `PlatformFilesystem` and `PlatformSandbox` extend `MastraFilesystem` / `MastraSandbox` from `@mastra/core/workspace` and speak the workspace-proxy wire format (`Authorization: Bearer sk_*`, project-scoped routes at `/v1/projects/:projectId/...`). Both accept config directly and fall back to env vars (`MASTRA_PLATFORM_ACCESS_TOKEN`, `MASTRA_PROJECT_ID`, `MASTRA_ENVIRONMENT_ID`, `MASTRA_PLATFORM_BUCKET_NAME`, `MASTRA_WORKSPACE_PROXY_URL`).

  ```ts
  import { Workspace } from '@mastra/core/workspace';
  import { PlatformFilesystem, PlatformSandbox } from '@mastra/platform-workspace';

  const workspace = new Workspace({
    filesystem: new PlatformFilesystem({ bucketName: 'dev-bucket' }),
    sandbox: new PlatformSandbox({
      environmentId: 'env_123',
      idleTimeoutMinutes: 30,
      networkIsolation: 'ISOLATED',
    }),
  });
  ```

  Also exports `platformFilesystemProvider` and `platformSandboxProvider` descriptors for hosts that register providers dynamically through the editor's `FilesystemProvider` / `SandboxProvider` registries:

  ```ts
  import { platformFilesystemProvider, platformSandboxProvider } from '@mastra/platform-workspace';

  registry.registerFilesystem(platformFilesystemProvider);
  registry.registerSandbox(platformSandboxProvider);
  ```

### Patch Changes

- Updated dependencies [[`45a8e65`](https://github.com/mastra-ai/mastra/commit/45a8e65e1556d1362cb3f25187023c36de26661d), [`c8ed116`](https://github.com/mastra-ai/mastra/commit/c8ed11699f62bcac70102ab4ec84d80d20541da6), [`33f2b88`](https://github.com/mastra-ai/mastra/commit/33f2b88842c09a567f906fac4cb61cd5277ced59)]:
  - @mastra/core@1.51.0-alpha.11

## 0.0.1-alpha.0

### Patch Changes

- Initial Platform workspace providers.
