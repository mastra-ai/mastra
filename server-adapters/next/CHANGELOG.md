# @mastra/next

## 0.2.1-alpha.5

### Patch Changes

- Updated dependencies [[`023766f`](https://github.com/mastra-ai/mastra/commit/023766f44d59b30a50f3a381e33eddde8ab56c00), [`a0509c7`](https://github.com/mastra-ai/mastra/commit/a0509c731a08aa3ed626557c5338126362856f57), [`01caf93`](https://github.com/mastra-ai/mastra/commit/01caf93d71ae2c1e65f49735cafb531975187426), [`c2c1d7b`](https://github.com/mastra-ai/mastra/commit/c2c1d7bb61d2602955f14ed3952f807c2d6eb576), [`3eb852e`](https://github.com/mastra-ai/mastra/commit/3eb852e5435bc908b800193498103dc724f455b0)]:
  - @mastra/core@1.47.0-alpha.5
  - @mastra/server@1.47.0-alpha.5
  - @mastra/hono@1.5.2-alpha.5

## 0.2.1-alpha.4

### Patch Changes

- Updated dependencies [[`462a769`](https://github.com/mastra-ai/mastra/commit/462a769da61850862ca1be3d74134d33078ee6a7), [`f328049`](https://github.com/mastra-ai/mastra/commit/f3280498c324afd2a8d36cd828f5b9f94a2dddc1), [`e545228`](https://github.com/mastra-ai/mastra/commit/e54522856934a5dc030b7b6385771e3548020d59)]:
  - @mastra/core@1.47.0-alpha.4
  - @mastra/server@1.47.0-alpha.4
  - @mastra/hono@1.5.2-alpha.4

## 0.2.1-alpha.3

### Patch Changes

- Updated dependencies [[`bf3fe49`](https://github.com/mastra-ai/mastra/commit/bf3fe49f9467dbbdb8f9eaf74e0f7971ffb19559), [`24ceaea`](https://github.com/mastra-ai/mastra/commit/24ceaea0bdd8609cabbab764380608ca6621a194), [`9e45902`](https://github.com/mastra-ai/mastra/commit/9e4590208e745055cecca202e2db0e5c65e17d3c), [`6ccf67b`](https://github.com/mastra-ai/mastra/commit/6ccf67bf075753754927a57bc2e1734ba2c820c5), [`825d8de`](https://github.com/mastra-ai/mastra/commit/825d8def9fa64c2bcc3d8dd6b49e09342c3ac5c7), [`ffa09e7`](https://github.com/mastra-ai/mastra/commit/ffa09e772a5c92270eabe2090fc42d45bd8ec4b7), [`461a7c5`](https://github.com/mastra-ai/mastra/commit/461a7c501449295287f4f0ee4b0b42344f39fcf8), [`4211472`](https://github.com/mastra-ai/mastra/commit/4211472a5a2bd319c60cd2e42d9109c3eef7ac1c), [`9e45902`](https://github.com/mastra-ai/mastra/commit/9e4590208e745055cecca202e2db0e5c65e17d3c), [`5c0df77`](https://github.com/mastra-ai/mastra/commit/5c0df776c40efa420f8c07a2f3ee66010296618e)]:
  - @mastra/core@1.47.0-alpha.3
  - @mastra/server@1.47.0-alpha.3
  - @mastra/hono@1.5.2-alpha.3

## 0.2.1-alpha.2

### Patch Changes

- Updated dependencies [[`86623c1`](https://github.com/mastra-ai/mastra/commit/86623c1adf7d22de32cc916dda17f4155184db36), [`7c9dd77`](https://github.com/mastra-ai/mastra/commit/7c9dd77bd18cb8dc72797e25f1a0fbdc71a11347), [`9990965`](https://github.com/mastra-ai/mastra/commit/999096571635a83b42ef40841fd7028cfa630779), [`c0ffa3c`](https://github.com/mastra-ai/mastra/commit/c0ffa3c897ccd326de880df734740a7f0681a18f), [`0504bf5`](https://github.com/mastra-ai/mastra/commit/0504bf5e8cffc571a4b343326178de371e6f859b), [`5afe423`](https://github.com/mastra-ai/mastra/commit/5afe423e4badf040f1b0d4525183a856fcb8146e), [`86623c1`](https://github.com/mastra-ai/mastra/commit/86623c1adf7d22de32cc916dda17f4155184db36), [`8c9f1c0`](https://github.com/mastra-ai/mastra/commit/8c9f1c0361d89066f9bcd14a2f69e761b01766c8)]:
  - @mastra/core@1.47.0-alpha.2
  - @mastra/server@1.47.0-alpha.2
  - @mastra/hono@1.5.2-alpha.2

## 0.2.1-alpha.1

### Patch Changes

- Updated dependencies [[`7f9ae70`](https://github.com/mastra-ai/mastra/commit/7f9ae70826b047e5a66218f9e92f20e54a2d791f), [`1505c07`](https://github.com/mastra-ai/mastra/commit/1505c07603f6346bae12aa82f140e8b88ffea9ab), [`e940f09`](https://github.com/mastra-ai/mastra/commit/e940f099ef5d18b403e6f2b4937e086a4da857b1)]:
  - @mastra/core@1.46.1-alpha.1
  - @mastra/hono@1.5.2-alpha.1
  - @mastra/server@1.46.1-alpha.1

## 0.2.1-alpha.0

### Patch Changes

- Updated dependencies [[`fbeda0c`](https://github.com/mastra-ai/mastra/commit/fbeda0c0f35def07e6837936dd3a003b2b7c5172), [`307573b`](https://github.com/mastra-ai/mastra/commit/307573b9ff3149b70c79540dbc86f1319b180f29)]:
  - @mastra/core@1.46.1-alpha.0
  - @mastra/server@1.46.1-alpha.0
  - @mastra/hono@1.5.2-alpha.0

## 0.2.0

### Minor Changes

- Added `@mastra/next` — a server adapter for Next.js App Router. Drop your Mastra instance into a catch-all route to expose all Mastra API endpoints without manually wiring routes. ([#18230](https://github.com/mastra-ai/mastra/pull/18230))

  **Usage**

  ```ts
  // app/api/[...mastra]/route.ts
  import { createNextRouteHandler } from '@mastra/next';
  import { mastra } from '../../../mastra';

  export const { GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD } = createNextRouteHandler({ mastra });
  ```

### Patch Changes

- Updated dependencies [[`5bd72d2`](https://github.com/mastra-ai/mastra/commit/5bd72d255f45b5ea8ab342643bd463814a980a24), [`1cc9ee1`](https://github.com/mastra-ai/mastra/commit/1cc9ee1ba51db53020a735626d33017a60b4b5b3), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`65f255a`](https://github.com/mastra-ai/mastra/commit/65f255a38667beb6ceeadabfa9eb5059bfec8298), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`30ebaf0`](https://github.com/mastra-ai/mastra/commit/30ebaf07bed5f4d30f2f257836c15d1bf7e40aae), [`5704634`](https://github.com/mastra-ai/mastra/commit/5704634b22133167dea337a942a34f57aaa3fa14), [`5c4e9a4`](https://github.com/mastra-ai/mastra/commit/5c4e9a4cfb2216bb3ea7f8988ad3727f3b92bb3a), [`def2671`](https://github.com/mastra-ai/mastra/commit/def267176e72ebbb28823f7d2c35da3dbf637564), [`4a88c6e`](https://github.com/mastra-ai/mastra/commit/4a88c6e2bdce316f8d7551b4ec3449b0b06fc71c), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`25961e3`](https://github.com/mastra-ai/mastra/commit/25961e3260ff3b1464637af8fcdb36210551c39f), [`6a1428a`](https://github.com/mastra-ai/mastra/commit/6a1428a23133fc070fc6c1caa08d28f3ba4fe5ff), [`87a17ef`](https://github.com/mastra-ai/mastra/commit/87a17efbd725aca6639febdc5e69e2abb3048689), [`e11ff30`](https://github.com/mastra-ai/mastra/commit/e11ff301408bf1731dca2fb7fbfcd8c819500a35), [`7794d71`](https://github.com/mastra-ai/mastra/commit/7794d71872c68733a30e028dfb7b1705daf6c5d2), [`9d2c946`](https://github.com/mastra-ai/mastra/commit/9d2c946d0859e90ae4bcec5beeb1da7398d2ad1e), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`7b29f33`](https://github.com/mastra-ai/mastra/commit/7b29f332a357a83e555f29e718e5f2fab9979943), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`b13925b`](https://github.com/mastra-ai/mastra/commit/b13925bfa91aa8700f56fa54a9ce707ee7e4ba62), [`f1ec385`](https://github.com/mastra-ai/mastra/commit/f1ec385386f62b1a0847ec5353ae2bb169d1c3d9), [`e14986f`](https://github.com/mastra-ai/mastra/commit/e14986f6e5478d6384d04ff9a7f9a79a46a8b529), [`4df4f37`](https://github.com/mastra-ai/mastra/commit/4df4f37ea8e00aec18d698c0da9001491c57468e), [`24912b1`](https://github.com/mastra-ai/mastra/commit/24912b1f855d29ec36af4ef4bde1f7417e20cdf5), [`bf94ec6`](https://github.com/mastra-ai/mastra/commit/bf94ec68192d9f16e46ef7e5ac36370aeeddf35d), [`a29f371`](https://github.com/mastra-ai/mastra/commit/a29f371aef629ac8562661524a497127e93b5131), [`7686216`](https://github.com/mastra-ai/mastra/commit/7686216f37e74568feddec17cef3c3d24e10e60a), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`073f910`](https://github.com/mastra-ai/mastra/commit/073f910481e7d94b95ba3830f96531774ae95d33), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`974f614`](https://github.com/mastra-ai/mastra/commit/974f614e083bd68278536f94453f7b320b86a3c7), [`3818814`](https://github.com/mastra-ai/mastra/commit/38188149ce454c4403fe9fcbdf73b735c68d36be), [`975c59a`](https://github.com/mastra-ai/mastra/commit/975c59ae363ee275fc55062392e1ffd2cbccbd53), [`1f97ce5`](https://github.com/mastra-ai/mastra/commit/1f97ce5695463bebb4eaacf501da6fb403e20885), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`7f51548`](https://github.com/mastra-ai/mastra/commit/7f515481213780be7047cef00640b9d35f3d545c), [`64f58c0`](https://github.com/mastra-ai/mastra/commit/64f58c04e78b40137497d47f781e897e416f22a5), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`d95f394`](https://github.com/mastra-ai/mastra/commit/d95f394fd24c8411886930d727679c4d5252aa26), [`37ab9d3`](https://github.com/mastra-ai/mastra/commit/37ab9d3482cea21388008e522a5c781763832588), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`25961e3`](https://github.com/mastra-ai/mastra/commit/25961e3260ff3b1464637af8fcdb36210551c39f), [`8e25a78`](https://github.com/mastra-ai/mastra/commit/8e25a78e0597575f0b0729bae8c5e190c84869b5), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`f3f0c9d`](https://github.com/mastra-ai/mastra/commit/f3f0c9d7c878db5a13177871ce3523a14f14b311), [`a5b22d3`](https://github.com/mastra-ai/mastra/commit/a5b22d314d62a68d801886a8d3d0eb6c089473db), [`6581e28`](https://github.com/mastra-ai/mastra/commit/6581e28a65d72cdb5f0e8d8f892220a5c27160fe), [`31be1cf`](https://github.com/mastra-ai/mastra/commit/31be1cf5f2a7b5eef12f6123a40653b4d8115c16), [`def2671`](https://github.com/mastra-ai/mastra/commit/def267176e72ebbb28823f7d2c35da3dbf637564), [`ea55a1d`](https://github.com/mastra-ai/mastra/commit/ea55a1d67e656129b74d661a0e06fa274f503aa3), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858)]:
  - @mastra/core@1.46.0
  - @mastra/hono@1.5.1
  - @mastra/server@1.46.0

## 0.2.0-alpha.5

### Patch Changes

- Updated dependencies [[`3818814`](https://github.com/mastra-ai/mastra/commit/38188149ce454c4403fe9fcbdf73b735c68d36be)]:
  - @mastra/core@1.46.0-alpha.5
  - @mastra/server@1.46.0-alpha.5
  - @mastra/hono@1.5.1-alpha.5

## 0.2.0-alpha.4

### Patch Changes

- Updated dependencies [[`5c4e9a4`](https://github.com/mastra-ai/mastra/commit/5c4e9a4cfb2216bb3ea7f8988ad3727f3b92bb3a), [`25961e3`](https://github.com/mastra-ai/mastra/commit/25961e3260ff3b1464637af8fcdb36210551c39f), [`7b29f33`](https://github.com/mastra-ai/mastra/commit/7b29f332a357a83e555f29e718e5f2fab9979943), [`24912b1`](https://github.com/mastra-ai/mastra/commit/24912b1f855d29ec36af4ef4bde1f7417e20cdf5), [`7686216`](https://github.com/mastra-ai/mastra/commit/7686216f37e74568feddec17cef3c3d24e10e60a), [`975c59a`](https://github.com/mastra-ai/mastra/commit/975c59ae363ee275fc55062392e1ffd2cbccbd53), [`d95f394`](https://github.com/mastra-ai/mastra/commit/d95f394fd24c8411886930d727679c4d5252aa26), [`25961e3`](https://github.com/mastra-ai/mastra/commit/25961e3260ff3b1464637af8fcdb36210551c39f), [`f3f0c9d`](https://github.com/mastra-ai/mastra/commit/f3f0c9d7c878db5a13177871ce3523a14f14b311), [`6581e28`](https://github.com/mastra-ai/mastra/commit/6581e28a65d72cdb5f0e8d8f892220a5c27160fe)]:
  - @mastra/core@1.46.0-alpha.4
  - @mastra/server@1.46.0-alpha.4
  - @mastra/hono@1.5.1-alpha.4

## 0.2.0-alpha.3

### Patch Changes

- Updated dependencies [[`65f255a`](https://github.com/mastra-ai/mastra/commit/65f255a38667beb6ceeadabfa9eb5059bfec8298), [`4a88c6e`](https://github.com/mastra-ai/mastra/commit/4a88c6e2bdce316f8d7551b4ec3449b0b06fc71c), [`87a17ef`](https://github.com/mastra-ai/mastra/commit/87a17efbd725aca6639febdc5e69e2abb3048689), [`e11ff30`](https://github.com/mastra-ai/mastra/commit/e11ff301408bf1731dca2fb7fbfcd8c819500a35), [`9d2c946`](https://github.com/mastra-ai/mastra/commit/9d2c946d0859e90ae4bcec5beeb1da7398d2ad1e), [`f1ec385`](https://github.com/mastra-ai/mastra/commit/f1ec385386f62b1a0847ec5353ae2bb169d1c3d9), [`e14986f`](https://github.com/mastra-ai/mastra/commit/e14986f6e5478d6384d04ff9a7f9a79a46a8b529), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`974f614`](https://github.com/mastra-ai/mastra/commit/974f614e083bd68278536f94453f7b320b86a3c7), [`31be1cf`](https://github.com/mastra-ai/mastra/commit/31be1cf5f2a7b5eef12f6123a40653b4d8115c16)]:
  - @mastra/core@1.46.0-alpha.3
  - @mastra/server@1.46.0-alpha.3
  - @mastra/hono@1.5.1-alpha.3

## 0.2.0-alpha.2

### Patch Changes

- Updated dependencies [[`6a1428a`](https://github.com/mastra-ai/mastra/commit/6a1428a23133fc070fc6c1caa08d28f3ba4fe5ff), [`4df4f37`](https://github.com/mastra-ai/mastra/commit/4df4f37ea8e00aec18d698c0da9001491c57468e), [`7f51548`](https://github.com/mastra-ai/mastra/commit/7f515481213780be7047cef00640b9d35f3d545c)]:
  - @mastra/core@1.46.0-alpha.2
  - @mastra/hono@1.5.1-alpha.2
  - @mastra/server@1.46.0-alpha.2

## 0.2.0-alpha.1

### Patch Changes

- Updated dependencies [[`7794d71`](https://github.com/mastra-ai/mastra/commit/7794d71872c68733a30e028dfb7b1705daf6c5d2)]:
  - @mastra/core@1.46.0-alpha.1
  - @mastra/server@1.46.0-alpha.1
  - @mastra/hono@1.5.1-alpha.1

## 0.2.0-alpha.0

### Minor Changes

- Added `@mastra/next` — a server adapter for Next.js App Router. Drop your Mastra instance into a catch-all route to expose all Mastra API endpoints without manually wiring routes. ([#18230](https://github.com/mastra-ai/mastra/pull/18230))

  **Usage**

  ```ts
  // app/api/[...mastra]/route.ts
  import { createNextRouteHandler } from '@mastra/next';
  import { mastra } from '../../../mastra';

  export const { GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD } = createNextRouteHandler({ mastra });
  ```

### Patch Changes

- Updated dependencies [[`5bd72d2`](https://github.com/mastra-ai/mastra/commit/5bd72d255f45b5ea8ab342643bd463814a980a24), [`1cc9ee1`](https://github.com/mastra-ai/mastra/commit/1cc9ee1ba51db53020a735626d33017a60b4b5b3), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`30ebaf0`](https://github.com/mastra-ai/mastra/commit/30ebaf07bed5f4d30f2f257836c15d1bf7e40aae), [`5704634`](https://github.com/mastra-ai/mastra/commit/5704634b22133167dea337a942a34f57aaa3fa14), [`def2671`](https://github.com/mastra-ai/mastra/commit/def267176e72ebbb28823f7d2c35da3dbf637564), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`b13925b`](https://github.com/mastra-ai/mastra/commit/b13925bfa91aa8700f56fa54a9ce707ee7e4ba62), [`bf94ec6`](https://github.com/mastra-ai/mastra/commit/bf94ec68192d9f16e46ef7e5ac36370aeeddf35d), [`a29f371`](https://github.com/mastra-ai/mastra/commit/a29f371aef629ac8562661524a497127e93b5131), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`073f910`](https://github.com/mastra-ai/mastra/commit/073f910481e7d94b95ba3830f96531774ae95d33), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`1f97ce5`](https://github.com/mastra-ai/mastra/commit/1f97ce5695463bebb4eaacf501da6fb403e20885), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`64f58c0`](https://github.com/mastra-ai/mastra/commit/64f58c04e78b40137497d47f781e897e416f22a5), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`37ab9d3`](https://github.com/mastra-ai/mastra/commit/37ab9d3482cea21388008e522a5c781763832588), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`8e25a78`](https://github.com/mastra-ai/mastra/commit/8e25a78e0597575f0b0729bae8c5e190c84869b5), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`a5b22d3`](https://github.com/mastra-ai/mastra/commit/a5b22d314d62a68d801886a8d3d0eb6c089473db), [`def2671`](https://github.com/mastra-ai/mastra/commit/def267176e72ebbb28823f7d2c35da3dbf637564), [`ea55a1d`](https://github.com/mastra-ai/mastra/commit/ea55a1d67e656129b74d661a0e06fa274f503aa3), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858)]:
  - @mastra/core@1.46.0-alpha.0
  - @mastra/hono@1.5.1-alpha.0
  - @mastra/server@1.46.0-alpha.0
