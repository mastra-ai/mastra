# @mastra/connect

## 1.2.0-alpha.1

### Patch Changes

- Fixed provider generation to discover template aliases exposed as symlinks. ([#27314](https://github.com/mastra-ai/mastra/pull/27314))

- Fixed delegated Microsoft Office provider generation to use the connected user's OneDrive and preserve supported generic proxy, typed request, and random UUID template patterns. ([#27314](https://github.com/mastra-ai/mastra/pull/27314))

- Updated dependencies [[`b7ff751`](https://github.com/mastra-ai/mastra/commit/b7ff751ed0fd87a3f93ce438c355c2dcc16e79d5), [`ca04e2c`](https://github.com/mastra-ai/mastra/commit/ca04e2cbb6f5ae13edf006905d9810434b4163fe), [`decd0a0`](https://github.com/mastra-ai/mastra/commit/decd0a0066286996a4558f63e91a8edfa1143feb), [`5bd713b`](https://github.com/mastra-ai/mastra/commit/5bd713b4f2ca7769675d949f8052943807c11598), [`2ca9e35`](https://github.com/mastra-ai/mastra/commit/2ca9e3522f117cc12fee7a9dad2f5961cd41164e), [`2ded35c`](https://github.com/mastra-ai/mastra/commit/2ded35cb0c97b26f641a9eb9a5747d32164d45c9), [`2b9f9a5`](https://github.com/mastra-ai/mastra/commit/2b9f9a55799ee7a6020a063d2419096429254481), [`34ee1d1`](https://github.com/mastra-ai/mastra/commit/34ee1d16226852f57d1f8bb34ee7a88397e5cce2), [`b7ff751`](https://github.com/mastra-ai/mastra/commit/b7ff751ed0fd87a3f93ce438c355c2dcc16e79d5), [`1e31034`](https://github.com/mastra-ai/mastra/commit/1e31034b30cb9661e38af548dfda646aee74f08f)]:
  - @mastra/core@1.80.0-alpha.3

## 1.2.0-alpha.0

### Minor Changes

- In-chat connect prompts for end-user connections. Resource-scoped `tools({ resourceId })` resolutions now include a built-in `request_connection` tool: when a task needs a provider the user hasn't connected, the agent calls it and gets a structured `connect-prompt` payload listing connectable providers with their current connection state, which chat UIs render as a connect card. The connectable set follows the `providers` allowlist when one is set, otherwise the full catalog. The tool is never added to global-only resolutions. ([#26928](https://github.com/mastra-ai/mastra/pull/26928))

  ```ts
  import { tools } from '@mastra/connect';

  export const agent = new Agent({
    // ...
    tools: ctx => tools({ resourceId: ctx.requestContext.get('mastra__resourceId') }),
  });

  // Opt out of the built-in tool:
  tools({ resourceId: userId, connectPrompt: false });
  ```

  `userConnectRoutes()` `providers` is now optional: omit it to expose the full platform catalog on the end-user connect surface. An explicit empty array is still rejected, and configuring an allowlist behaves exactly as before.

  ```ts
  // All catalog providers are connectable:
  userConnectRoutes();

  // Or restrict to an allowlist, as before:
  userConnectRoutes({ providers: ['linear', 'slack'] });
  ```

- Added end-user (per-resource) connections to @mastra/connect. ([#26928](https://github.com/mastra-ai/mastra/pull/26928))

  **Scope tools to an end user**

  `tools()` accepts a new `resourceId` option — a static key or a callback derived per request — so an agent resolves the shared global connections plus that end user's own connections. Every platform call made under a resource scope asserts the key, so one user's connection can never serve another user's request.

  ```ts
  import { tools } from '@mastra/connect';

  // Per-request scoping on an agent:
  new Agent({ tools: ctx => tools({ resourceId: myUserIdFrom(ctx) }) });

  // Static/global usage is unchanged:
  new Agent({ tools: tools({ providers: ['linear'] }) });
  ```

  Calling `tools()` per request is cheap: identical options share one internal snapshot/MCP-client state, with per-resource caching and eviction. The returned resolver is also awaitable, so a dynamic `tools` argument can return it directly.

  **Let end users connect their own accounts**

  A new `userConnectRoutes()` export returns mountable API routes (provider catalog, the caller's connections, connect sessions, status polling, disconnect, and a hosted connect page) gated on the authenticated end user's resource key from `server.auth.mapUserToResourceId`.

  ```ts
  import { Mastra } from '@mastra/core';
  import { userConnectRoutes } from '@mastra/connect';

  export const mastra = new Mastra({
    server: {
      auth: {
        authenticateToken: async token => verifyToken(token),
        mapUserToResourceId: user => user.id,
      },
      apiRoutes: [...userConnectRoutes({ providers: ['linear', 'slack'] })],
    },
  });
  ```

  `credential()` also gains an optional `resourceId` option for asserting a resource-scoped connection's key.

- Added project-managed provider policies for end-user connections. When `providers` is omitted, `userConnectRoutes()` and the built-in `request_connection` tool now use the project provider list from Mastra Platform. An explicit code allowlist still takes priority. ([#26928](https://github.com/mastra-ai/mastra/pull/26928))

  ```typescript
  // Use the project policy from Mastra Platform.
  userConnectRoutes({});

  // Or enforce a code-level override.
  userConnectRoutes({ providers: ['linear', 'slack'] });
  ```

### Patch Changes

- Gate end-user connect flows behind a launch route. The vendor authorization link is a bearer capability (anyone who opens it can bind their account to the pending connection), so it now stays server-side: the new `GET /connect/connections/:id/launch` route verifies the caller owns the pending session before 302-redirecting into the provider's OAuth flow, and a forwarded or leaked launch URL returns 404 for anyone but the session owner. The hosted connect page navigates its popup through the launch route automatically. ([#26928](https://github.com/mastra-ai/mastra/pull/26928))

  Breaking response change for custom UIs: `POST /connect/:provider/sessions` now returns `launchUrl` (a server-relative path to the launch route) instead of `connectUrl`. Migrate by navigating to the launch route with the user's session instead of the vendor link:

  ```diff
   const session = await fetch(`${serverUrl}/connect/linear/sessions`, {
     method: 'POST',
     headers: authHeaders,
   }).then(res => res.json());

  -popup.location.href = session.connectUrl;
  +// Same-origin authenticated navigation; the server verifies ownership
  +// before redirecting into the vendor OAuth flow.
  +popup.location.href = `${serverUrl}${session.launchUrl}`;
  ```

- Updated dependencies [[`a15ea70`](https://github.com/mastra-ai/mastra/commit/a15ea70e71ca57242fa61b23e7f0178d77f9af4b), [`a15ea70`](https://github.com/mastra-ai/mastra/commit/a15ea70e71ca57242fa61b23e7f0178d77f9af4b), [`c253e13`](https://github.com/mastra-ai/mastra/commit/c253e13ac627d0325f8665004f7af8a49805a9a4), [`c8f8e41`](https://github.com/mastra-ai/mastra/commit/c8f8e410d39a29b8b69cb7bf90cc9a774cb956f5), [`08640de`](https://github.com/mastra-ai/mastra/commit/08640de350ff9183c1d9ef568fde4c6ccdf181e4), [`a1e248b`](https://github.com/mastra-ai/mastra/commit/a1e248bfe0776ab6ca2a55fed3c423b08fb5ae03), [`0afde2c`](https://github.com/mastra-ai/mastra/commit/0afde2c114aa02b0186ae963c8c83796f8801b60), [`a5a9179`](https://github.com/mastra-ai/mastra/commit/a5a9179daa5ac1ed49447265038208c9f96cd0f8), [`8e1247c`](https://github.com/mastra-ai/mastra/commit/8e1247cb26fc1a3cd1c2ac6edaf34fddad897852), [`ed76bdc`](https://github.com/mastra-ai/mastra/commit/ed76bdcc88e09c0f7f0da14ffadca62b1b4a2409), [`2f655e5`](https://github.com/mastra-ai/mastra/commit/2f655e53fcae10a2423e0194a113ce52e70580fe), [`be5c929`](https://github.com/mastra-ai/mastra/commit/be5c9292ac6d4beb7f1020d0dc745edd18842f3d), [`e39aa42`](https://github.com/mastra-ai/mastra/commit/e39aa4237c81a2eb546a899c9739c96d6359737f), [`e20bbd0`](https://github.com/mastra-ai/mastra/commit/e20bbd0ef40475bda611ddfd8ea2721ddac3642c), [`c9ff73d`](https://github.com/mastra-ai/mastra/commit/c9ff73dd24e9473cb0008857105367c99ba839cb), [`7d58088`](https://github.com/mastra-ai/mastra/commit/7d580884fbf1fb5d90e0761272e2480ed01da70f), [`db2a1a6`](https://github.com/mastra-ai/mastra/commit/db2a1a659ecb057ae9ff6798a501ed33dd38b7c7), [`6a4a607`](https://github.com/mastra-ai/mastra/commit/6a4a607e710000e46790e20f28c2355af9ca2a05), [`de53c27`](https://github.com/mastra-ai/mastra/commit/de53c27a70dbd0c362384691459648043edbee72), [`015c7db`](https://github.com/mastra-ai/mastra/commit/015c7db2acf5c0e364195831c3de2bcc376474fe), [`d3f5000`](https://github.com/mastra-ai/mastra/commit/d3f500024f7b0c107c3786757b3f5481f029d061), [`8ae87fa`](https://github.com/mastra-ai/mastra/commit/8ae87fadd01daa128086e015473881bf55d6e47b), [`20f40eb`](https://github.com/mastra-ai/mastra/commit/20f40ebf5623b059336f4c3000d47755941b4451), [`35806cb`](https://github.com/mastra-ai/mastra/commit/35806cb9b62dfed212b238d00148341d8b2f68ac), [`2fed0ad`](https://github.com/mastra-ai/mastra/commit/2fed0ad258322811ea7f2107f1121c6d5dee1c59), [`6fea510`](https://github.com/mastra-ai/mastra/commit/6fea51000dfc4f249993a7d3959ad41ca6c422ca), [`bfce5b6`](https://github.com/mastra-ai/mastra/commit/bfce5b6982dc17a6944484b1ee9b333f6f5023d6), [`95c6e7c`](https://github.com/mastra-ai/mastra/commit/95c6e7caf4929d941f958e3f146b551e25eaeef3), [`2829b0e`](https://github.com/mastra-ai/mastra/commit/2829b0eae687d36c8f864eba4051225ae3b82343), [`e053569`](https://github.com/mastra-ai/mastra/commit/e05356995ee8c807516d8aff836a8363dba7eee6), [`a9ad47d`](https://github.com/mastra-ai/mastra/commit/a9ad47d8c3186e51142b9c1a3ed1e8e29ade2338), [`cf0ca8b`](https://github.com/mastra-ai/mastra/commit/cf0ca8b55d67a3ccf6ee7835e4dd2addea0c82a8), [`875a657`](https://github.com/mastra-ai/mastra/commit/875a65748d5e03b436bab01d7f9fe782fa2941e7), [`d3e8ec7`](https://github.com/mastra-ai/mastra/commit/d3e8ec74e90bedefc28414e459ec9c5d52c97ccc), [`d58fe2a`](https://github.com/mastra-ai/mastra/commit/d58fe2ac5cd64a96dca05657f07df18f23db14e1), [`a1e248b`](https://github.com/mastra-ai/mastra/commit/a1e248bfe0776ab6ca2a55fed3c423b08fb5ae03), [`bd508a2`](https://github.com/mastra-ai/mastra/commit/bd508a2dec8c550baec245bfffc2d0853386e2eb), [`875a657`](https://github.com/mastra-ai/mastra/commit/875a65748d5e03b436bab01d7f9fe782fa2941e7), [`578cb67`](https://github.com/mastra-ai/mastra/commit/578cb670bd8621538eda4afc1f25139e5903aab9), [`2ac8cf1`](https://github.com/mastra-ai/mastra/commit/2ac8cf1435ba3abae9dba7b6c34f1c02f75eab21), [`875a657`](https://github.com/mastra-ai/mastra/commit/875a65748d5e03b436bab01d7f9fe782fa2941e7), [`307b711`](https://github.com/mastra-ai/mastra/commit/307b711bbe73132f1f319c3326333d49bc23b79d), [`dc10589`](https://github.com/mastra-ai/mastra/commit/dc1058900dd9be01638d43491ddfd2037da12bac), [`339da0b`](https://github.com/mastra-ai/mastra/commit/339da0bef7e2e5570f533f6b41abbd746190bffb), [`8c61247`](https://github.com/mastra-ai/mastra/commit/8c6124708341d699c3b1f3bb19f19be468923483), [`5c56910`](https://github.com/mastra-ai/mastra/commit/5c56910b2647e11cbb6880431e556471b25ba949), [`66da6af`](https://github.com/mastra-ai/mastra/commit/66da6af573224af3daeb8767cddbd6112ad2c5e4), [`17444a7`](https://github.com/mastra-ai/mastra/commit/17444a7e46b656b3877faad6e61d5637f435b291), [`f3bc1ca`](https://github.com/mastra-ai/mastra/commit/f3bc1caddb161453f8e2636fd0fc96d9b60e2719), [`f156ad0`](https://github.com/mastra-ai/mastra/commit/f156ad0b7ed6b0ba286efd9040c061c9240d55c3)]:
  - @mastra/core@1.80.0-alpha.0
  - @mastra/mcp@2.6.0-alpha.0
  - @mastra/slack@1.8.0-alpha.0

## 1.1.0

### Minor Changes

- Added Microsoft Teams as a supported Connect channel. When MASTRA_ENCRYPTION_KEY is unset, the Teams install store is encrypted with a key derived from the platform access token and a warning is logged; projects without a Teams connection are unaffected. ([#27094](https://github.com/mastra-ai/mastra/pull/27094))

- Added end-user (per-resource) connections to @mastra/connect. ([#26923](https://github.com/mastra-ai/mastra/pull/26923))

  **Scope tools to an end user**

  `tools()` accepts a new `resourceId` option — a static key or a callback derived per request — so an agent resolves the shared global connections plus that end user's own connections. Every platform call made under a resource scope asserts the key, so one user's connection can never serve another user's request.

  ```ts
  import { tools } from '@mastra/connect';

  // Per-request scoping on an agent:
  new Agent({ tools: ctx => tools({ resourceId: myUserIdFrom(ctx) }) });

  // Static/global usage is unchanged:
  new Agent({ tools: tools({ providers: ['linear'] }) });
  ```

  Calling `tools()` per request is cheap: identical options share one internal snapshot/MCP-client state, with per-resource caching and eviction. The returned resolver is also awaitable, so a dynamic `tools` argument can return it directly.

  **Let end users connect their own accounts**

  A new `userConnectRoutes()` export returns mountable API routes (provider catalog, the caller's connections, connect sessions, status polling, disconnect, and a hosted connect page) gated on the authenticated end user's resource key from `server.auth.mapUserToResourceId`.

  ```ts
  import { Mastra } from '@mastra/core';
  import { userConnectRoutes } from '@mastra/connect';

  export const mastra = new Mastra({
    server: {
      auth: {
        authenticateToken: async token => verifyToken(token),
        mapUserToResourceId: user => user.id,
      },
      apiRoutes: [...userConnectRoutes({ providers: ['linear', 'slack'] })],
    },
  });
  ```

  `credential()` also gains an optional `resourceId` option for asserting a resource-scoped connection's key.

- Added a callback form to tools() for per-request options. Pass a function that reads the request context and returns ToolsOptions to vary tool filters and approval policies per request (for example by user role), without losing the snapshot cache: resolutions producing the same options share one cached snapshot with the usual TTL semantics. ([#27160](https://github.com/mastra-ai/mastra/pull/27160))

  **Before** (per-request resolver, re-fetches every request):

  ```ts
  tools: async ctx => {
    const role = ctx.requestContext?.get('role');
    return tools({
      providers: {
        linear: role === 'viewer' ? { allowTools: ['linear_list_*'] } : { requireApproval: ['linear_delete_*'] },
      },
    })(ctx);
  };
  ```

  **After** (one resolver, cache intact):

  ```ts
  tools: tools(ctx => ({
    providers: {
      linear:
        ctx?.requestContext?.get('role') === 'viewer'
          ? { allowTools: ['linear_list_*'] }
          : { requireApproval: ['linear_delete_*'] },
    },
  }));
  ```

### Patch Changes

- Fixed project-level Connect activity showing empty on the Mastra platform. @mastra/connect now sends its configured project id (MASTRA_PROJECT_ID or the projectId option) with every proxied provider request, so the platform can attribute tool and channel activity to the right project. ([#26932](https://github.com/mastra-ai/mastra/pull/26932))

  ```typescript
  import { tools } from '@mastra/connect';

  // Uses MASTRA_PROJECT_ID by default; pass projectId to override.
  const agentTools = tools({ projectId: 'proj_123' });
  ```

- **Google Drive** ([#27156](https://github.com/mastra-ai/mastra/pull/27156))

  - Fixed `google_drive_create_folder`, `google_drive_upload_document`, and `google_drive_move_file` failing with 404 errors on shared drives. Agents can now write to team shared drives.
  - Added `google_drive_export_file` for exporting Docs, Sheets, and Slides to PDF and other formats.
  - Added `google_drive_list_revisions` for listing a file's revision history.

  ```ts
  const toolset = await tools({ providers: ['google-drive'] })();

  await toolset.google_drive_export_file.execute({
    fileId: '1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c',
    mimeType: 'application/pdf',
  });
  ```

  **Fireflies**

  - Fixed `fireflies_get_transcript` failing validation on every transcript. Fireflies returns numeric `speaker_id`, `start_time`, and `end_time` values that the schema only accepted as strings; the tool now accepts and normalizes them.

- `@mastra/mcp` and `@mastra/connect` now require `@mastra/core` 1.79.0 or later. Upgrade `@mastra/core` together with them: ([#27674](https://github.com/mastra-ai/mastra/pull/27674))

  ```bash
  # Before: @mastra/core 1.78.x with an older @mastra/mcp
  npm install @mastra/mcp@latest # peer dependency error

  # After
  npm install @mastra/core@latest @mastra/mcp@latest @mastra/connect@latest
  ```

- Bump for npm ([#27221](https://github.com/mastra-ai/mastra/pull/27221))

- Updated dependencies [[`dbde4bf`](https://github.com/mastra-ai/mastra/commit/dbde4bf36ac016abcda61868cc6f792f9d07abee), [`f3cf773`](https://github.com/mastra-ai/mastra/commit/f3cf77305f6e0447ce3d7d100087c3b828a4f509), [`f3cf773`](https://github.com/mastra-ai/mastra/commit/f3cf77305f6e0447ce3d7d100087c3b828a4f509), [`f3cf773`](https://github.com/mastra-ai/mastra/commit/f3cf77305f6e0447ce3d7d100087c3b828a4f509), [`3af753f`](https://github.com/mastra-ai/mastra/commit/3af753fb40a2b8f7ab17b1cf16cd4da7e1b020a6), [`ec84d93`](https://github.com/mastra-ai/mastra/commit/ec84d93cda24d56a0812086fcaace9e68ce8e089), [`6362d32`](https://github.com/mastra-ai/mastra/commit/6362d32a905d32820dcab3b9a039ebc1cec4f444), [`1c9fd9b`](https://github.com/mastra-ai/mastra/commit/1c9fd9bbdd4258c0d86c89cac6ae68c5023a2590), [`59c02f5`](https://github.com/mastra-ai/mastra/commit/59c02f53955dde397f343f2107060ed70bbe63c5), [`e3678a5`](https://github.com/mastra-ai/mastra/commit/e3678a564cf3bb5922112b4dca65973c5fdc0a92), [`934ec13`](https://github.com/mastra-ai/mastra/commit/934ec1315e8ee4b73067864f56a9fcc8105e8512), [`9b60f12`](https://github.com/mastra-ai/mastra/commit/9b60f12b13b28c9664a839aef435e6d10898644d), [`14f17b8`](https://github.com/mastra-ai/mastra/commit/14f17b86e2b162623bb22942c7930c2113a6d8a1), [`9c4d65f`](https://github.com/mastra-ai/mastra/commit/9c4d65f41ee21e407f0015b0e745881288f69d05), [`48bee02`](https://github.com/mastra-ai/mastra/commit/48bee02e1a5cef20f4da67720191d5e85cdca13c), [`f885386`](https://github.com/mastra-ai/mastra/commit/f885386b79be0e4d784067b0e26608971e0cc788), [`915fbe6`](https://github.com/mastra-ai/mastra/commit/915fbe67e974edbeba4dbd3afeaec4d68b34b118), [`f1b596e`](https://github.com/mastra-ai/mastra/commit/f1b596e3219bd8721079611c62b92b8f0f6c12d9), [`d93662b`](https://github.com/mastra-ai/mastra/commit/d93662bfee9313c376cff90e910e05ec9b0634ea), [`871f3c8`](https://github.com/mastra-ai/mastra/commit/871f3c801640148cffa09474fc9f9032495ddccf), [`44e35e4`](https://github.com/mastra-ai/mastra/commit/44e35e47491ad5fd9f771526d5d8c312644000ec), [`336692a`](https://github.com/mastra-ai/mastra/commit/336692a646e28d24b303eefdb8fdbe64e4b4e801), [`41b7f34`](https://github.com/mastra-ai/mastra/commit/41b7f3422a97f1385a285002b7e6f898eb5c7b06), [`f1c68eb`](https://github.com/mastra-ai/mastra/commit/f1c68eb4ae080d8cbbc694ae580850d8fa94dece), [`97f78c3`](https://github.com/mastra-ai/mastra/commit/97f78c3cf104600887e08e94cc073c973bb53c3b), [`e13dddd`](https://github.com/mastra-ai/mastra/commit/e13dddd4f5ac10448cd37009c31efedbf4c40ff4), [`9c66073`](https://github.com/mastra-ai/mastra/commit/9c66073db33749ab622d54db7e8885f183451ca4), [`6bfe708`](https://github.com/mastra-ai/mastra/commit/6bfe7087fcc27a08c8cba95a45c5da353188bb9c), [`3624981`](https://github.com/mastra-ai/mastra/commit/36249818e7cd0b2904142c6b133cc1ceb756ba68), [`aaedaa6`](https://github.com/mastra-ai/mastra/commit/aaedaa634aa7394789952d4f9fe04b1aec8619a1), [`a92384b`](https://github.com/mastra-ai/mastra/commit/a92384bf9093beb9071953292a936ca722370ce5), [`a8f9157`](https://github.com/mastra-ai/mastra/commit/a8f9157fafe38f5acf68e37c8874ebd192ef8e10), [`79fd3b0`](https://github.com/mastra-ai/mastra/commit/79fd3b06a7cf59f7acb4591b9ba0f388d548fd17), [`04ded0b`](https://github.com/mastra-ai/mastra/commit/04ded0b7409b39008a1e4611c412ee80ee20993d), [`f28b72f`](https://github.com/mastra-ai/mastra/commit/f28b72f255a460746f08c73b2a1d336bfc57757b), [`90dca88`](https://github.com/mastra-ai/mastra/commit/90dca88f44f31428a0e585584114b56f0bec477b), [`1874bf2`](https://github.com/mastra-ai/mastra/commit/1874bf2a5ba304f22ffb93f9ec5a9afea000a5a1), [`4e6701a`](https://github.com/mastra-ai/mastra/commit/4e6701a8534e29fad29c7fe4c6787dc1ed56b419), [`a3f8ac0`](https://github.com/mastra-ai/mastra/commit/a3f8ac03c7526248e585f3e4e87b349566dd4797), [`022e6cf`](https://github.com/mastra-ai/mastra/commit/022e6cf06fdc891a6318f16db304be8fe75b7f72), [`d8fb857`](https://github.com/mastra-ai/mastra/commit/d8fb857bda2c23a08e535291a638fbc6e3a4e073), [`6c67158`](https://github.com/mastra-ai/mastra/commit/6c67158a10406adae195887167862d632bb54d64), [`26e684b`](https://github.com/mastra-ai/mastra/commit/26e684b1f152d341c2dca01c5347fea7e8762188), [`d8bfd3d`](https://github.com/mastra-ai/mastra/commit/d8bfd3d502dd9952db66f0c4f53cd04f5c8e71ef), [`ace1e35`](https://github.com/mastra-ai/mastra/commit/ace1e35d5762f96976a2cba958283edda71fcc3b), [`f905746`](https://github.com/mastra-ai/mastra/commit/f905746159def2d386dca516657123f43ef90e24), [`b77f59c`](https://github.com/mastra-ai/mastra/commit/b77f59cc5407b1158a271d579b55514f2ba79145), [`776bb6e`](https://github.com/mastra-ai/mastra/commit/776bb6e2b3ed9ec32e5430332ee756185fcebb68), [`2d0a3b0`](https://github.com/mastra-ai/mastra/commit/2d0a3b06d0880036c0dbd4b1fcf782d1f5115a56), [`ad8e752`](https://github.com/mastra-ai/mastra/commit/ad8e75217bcbb12986e7e77a30cb4af1be93c0fd), [`ba744e5`](https://github.com/mastra-ai/mastra/commit/ba744e5347d7d373b89233f1b8beddb5bdf5b2c3), [`4471372`](https://github.com/mastra-ai/mastra/commit/4471372b0338523a2f57407a90b1d913e68f17cc), [`5131dad`](https://github.com/mastra-ai/mastra/commit/5131dadf8c2db8641030111203db6c16fe3240f2), [`58db748`](https://github.com/mastra-ai/mastra/commit/58db74858beae6ff20ff22786c968386b9d3edcc), [`8c2d516`](https://github.com/mastra-ai/mastra/commit/8c2d5164714a27e720d898da612da6054a88ef91), [`7425858`](https://github.com/mastra-ai/mastra/commit/74258589417e9e91114c64571a67702d2e352b3f), [`0e9a577`](https://github.com/mastra-ai/mastra/commit/0e9a5774151385c93524883e2b1bea40e2a644de), [`fd98055`](https://github.com/mastra-ai/mastra/commit/fd98055302882876b8dc5ae03649a89a72e2ac6c), [`b2c91db`](https://github.com/mastra-ai/mastra/commit/b2c91dbd2d32e18cd114d87301fc3b8182fddb10), [`c111a5b`](https://github.com/mastra-ai/mastra/commit/c111a5bfa2a7a197f30700ce238c84ee799df140), [`a97ba85`](https://github.com/mastra-ai/mastra/commit/a97ba8578a2dc91a16d945276ca8c7a4ad32e38a), [`f6a9762`](https://github.com/mastra-ai/mastra/commit/f6a9762b12ae9dad6a154f73ed3099a2ee472d0c), [`fa5a031`](https://github.com/mastra-ai/mastra/commit/fa5a0316dbd5f68316b48c426fd904d2d80d9045), [`14b2a7c`](https://github.com/mastra-ai/mastra/commit/14b2a7c56da4329f7fd17738056a081663deed46), [`750a4ed`](https://github.com/mastra-ai/mastra/commit/750a4edf7826da9ba7321682912504c60f29712d), [`e5b6877`](https://github.com/mastra-ai/mastra/commit/e5b6877fbdb471485b99019eb50046b44e778aae), [`c236d64`](https://github.com/mastra-ai/mastra/commit/c236d64974c68e6c0f9bf6e3d6442e0184c5f49e), [`fc96794`](https://github.com/mastra-ai/mastra/commit/fc9679466bede4ca3e014aea48a72fd950a13d2a), [`e5b6877`](https://github.com/mastra-ai/mastra/commit/e5b6877fbdb471485b99019eb50046b44e778aae), [`85a26af`](https://github.com/mastra-ai/mastra/commit/85a26af75fe62b7f2d8ac0b56d322798e5ae0616), [`5758ba0`](https://github.com/mastra-ai/mastra/commit/5758ba045b01c407a7414b32dbbdf5480596b31d), [`8271439`](https://github.com/mastra-ai/mastra/commit/8271439b491f5f777590abfda9a0ac7f1e3212c2), [`44e35e4`](https://github.com/mastra-ai/mastra/commit/44e35e47491ad5fd9f771526d5d8c312644000ec), [`7337dac`](https://github.com/mastra-ai/mastra/commit/7337dac8aad8d70e98a4b0c7caa677c01966b53b), [`f51c0af`](https://github.com/mastra-ai/mastra/commit/f51c0afdd1b181b84e294f8613185494a8aaec3c), [`5f70db1`](https://github.com/mastra-ai/mastra/commit/5f70db1f3b5b38a27438d1c153db352d2bc8de30), [`179964b`](https://github.com/mastra-ai/mastra/commit/179964b95aacac31763a4a1aa2f2d1c652aa529d), [`7afee18`](https://github.com/mastra-ai/mastra/commit/7afee18a3d91ce125f08ffd6e2724695e8a68652), [`ca1b2f2`](https://github.com/mastra-ai/mastra/commit/ca1b2f25d7c69c6e90b719baef32ffb1db6c5681), [`12991bd`](https://github.com/mastra-ai/mastra/commit/12991bd0945ca36e13b213ebcbfaf0880d04d44d), [`0ac6a2a`](https://github.com/mastra-ai/mastra/commit/0ac6a2a4ab19f294b5362bcdf9c8ae9e3d8a3ede), [`b8fe2ae`](https://github.com/mastra-ai/mastra/commit/b8fe2aec651efeaad6d607d816565453a341cdef), [`22df9d7`](https://github.com/mastra-ai/mastra/commit/22df9d76651b3b4d513388a7eae8e51dbfb36a1b), [`f54f8b2`](https://github.com/mastra-ai/mastra/commit/f54f8b2df2aa24e1ef4d171c733576e7c62bb1b0), [`f54f8b2`](https://github.com/mastra-ai/mastra/commit/f54f8b2df2aa24e1ef4d171c733576e7c62bb1b0), [`f54f8b2`](https://github.com/mastra-ai/mastra/commit/f54f8b2df2aa24e1ef4d171c733576e7c62bb1b0), [`6309939`](https://github.com/mastra-ai/mastra/commit/63099393563cc177960862c9179c4e2420acac5f), [`f6260f8`](https://github.com/mastra-ai/mastra/commit/f6260f8cc50c21a5d78d47fff4e04e55aca57a08), [`9cb6843`](https://github.com/mastra-ai/mastra/commit/9cb6843a8a39ab2e12498b0c08c9f4cdcefd9cea), [`0971298`](https://github.com/mastra-ai/mastra/commit/0971298317be971ae1c3f0c1d949a31df7d71c7f), [`a0c031c`](https://github.com/mastra-ai/mastra/commit/a0c031ceb671721b6f8557726e216ee81d23612e), [`72cb1e2`](https://github.com/mastra-ai/mastra/commit/72cb1e2b9453f7bb1bd08e4f9aa54da56fa20600), [`a3be51b`](https://github.com/mastra-ai/mastra/commit/a3be51b1a545b45bfb04377699edecbb8a8d79d6), [`bcfb6af`](https://github.com/mastra-ai/mastra/commit/bcfb6af5a61d79f6902e87d3a8fa70283f48705d), [`03868f8`](https://github.com/mastra-ai/mastra/commit/03868f840401865af433040ba7ff90f585dea2e1), [`368149c`](https://github.com/mastra-ai/mastra/commit/368149c27954f6d578d3561cc1801cb415b78aa7), [`fdf475d`](https://github.com/mastra-ai/mastra/commit/fdf475dbc8974e1ae21966e5e96e316a7beebdf7), [`2725bd7`](https://github.com/mastra-ai/mastra/commit/2725bd73fa27f231e30bce7c6a03c651bc15b408), [`9277d8e`](https://github.com/mastra-ai/mastra/commit/9277d8ef26ad2f08bfbae89d78d409fb91c95c8d), [`0611d4a`](https://github.com/mastra-ai/mastra/commit/0611d4a060696da5c3c550b07451d870d4af0f58), [`eb0b702`](https://github.com/mastra-ai/mastra/commit/eb0b702e9939f02073fb1c4dfd7eaa51fde59e0b), [`e41478c`](https://github.com/mastra-ai/mastra/commit/e41478cbb7ab108cf7f704a6f0f4092ec4374e21), [`323b021`](https://github.com/mastra-ai/mastra/commit/323b0212bc57c2b9acaed2716812a873c0fa43ee), [`78b3ef7`](https://github.com/mastra-ai/mastra/commit/78b3ef7cb120f2b366a39d7095ece5f0ec7d3f71), [`0eb8311`](https://github.com/mastra-ai/mastra/commit/0eb8311f9ecf254c96179e99dc145d6df3cccd07), [`ba7b0ea`](https://github.com/mastra-ai/mastra/commit/ba7b0eac045755d39d20dcf3a943ea5f8270b009), [`9b546e2`](https://github.com/mastra-ai/mastra/commit/9b546e2b9dba91d51769a73ce1a0b34d775b144a), [`e8d7f8e`](https://github.com/mastra-ai/mastra/commit/e8d7f8e52da32b05f2e8501c1127128ae1a5d450), [`d93662b`](https://github.com/mastra-ai/mastra/commit/d93662bfee9313c376cff90e910e05ec9b0634ea), [`0e5d045`](https://github.com/mastra-ai/mastra/commit/0e5d045be4ab67d1fba5eeb8125bc2ec43aa9519), [`0e4fa4f`](https://github.com/mastra-ai/mastra/commit/0e4fa4f0604bb2e6e63e5d1d203b2dcadd646a81), [`c397dff`](https://github.com/mastra-ai/mastra/commit/c397dff0ee0662b56f348852ad08aff820239d66), [`92034fa`](https://github.com/mastra-ai/mastra/commit/92034fa2a46a4f45af416c3201752342ead71d89), [`e4cd1d1`](https://github.com/mastra-ai/mastra/commit/e4cd1d13de8bcb14d8d0a8531f7b96fcbb138217), [`4e44e7f`](https://github.com/mastra-ai/mastra/commit/4e44e7f518debb3b0aebc5ad71ea3e4a3902d8c9), [`b03ee08`](https://github.com/mastra-ai/mastra/commit/b03ee089c70c087cdc9d1d0a85aa749621ad5a3c), [`0f1d83f`](https://github.com/mastra-ai/mastra/commit/0f1d83fed073613869d6283adb198b934ef80093), [`7aa0361`](https://github.com/mastra-ai/mastra/commit/7aa036142ca476b1f1e18a220f826e73ca58c38a), [`cd864ca`](https://github.com/mastra-ai/mastra/commit/cd864ca5d1fa6cb3477cb8a87b79070febbb3b6b), [`d95a821`](https://github.com/mastra-ai/mastra/commit/d95a821e903f7883b5fadfee5c7f59809d66cfb8), [`98c7e10`](https://github.com/mastra-ai/mastra/commit/98c7e109fca4995d19d7eb132fdb8411c860b151), [`e35e335`](https://github.com/mastra-ai/mastra/commit/e35e335f19ee0c7c1e03bf247aebd24c3e041459), [`e3678a5`](https://github.com/mastra-ai/mastra/commit/e3678a564cf3bb5922112b4dca65973c5fdc0a92), [`3c2c033`](https://github.com/mastra-ai/mastra/commit/3c2c033aa68cd8cd7e4c630abd7f1bfeb440f457), [`425d383`](https://github.com/mastra-ai/mastra/commit/425d383d4fb15e55e9491b6bdaebb57f2de7cdc8), [`5d8f8b7`](https://github.com/mastra-ai/mastra/commit/5d8f8b78460350d581e8a92412cdfe88b4ce76bc), [`5d5ea03`](https://github.com/mastra-ai/mastra/commit/5d5ea032a4c64cefe5bc217f4cc761a9364ccbf4), [`fae54c5`](https://github.com/mastra-ai/mastra/commit/fae54c57917cd1f527937ca42b5ab7dfe1d55a2a), [`d7c012f`](https://github.com/mastra-ai/mastra/commit/d7c012fcc98a18552e0aef55f9c0d19fccad57da), [`b0f7f91`](https://github.com/mastra-ai/mastra/commit/b0f7f91eb667f15e188b861759b4c4a5761ec233), [`958d170`](https://github.com/mastra-ai/mastra/commit/958d170c218a0e050c0c4807a94ce1f67f00e570), [`ba7d4e5`](https://github.com/mastra-ai/mastra/commit/ba7d4e5c9759a164279c7ebdbe2b7a32ae94b4ce), [`8b36444`](https://github.com/mastra-ai/mastra/commit/8b36444dbbc6916d298015c2586fbbde2e9b265f), [`3f68324`](https://github.com/mastra-ai/mastra/commit/3f68324e72f03bbc7d918d23013f550527f59c40), [`bfd35f6`](https://github.com/mastra-ai/mastra/commit/bfd35f64178f06774c95dabec4a796245cf8a401), [`0b5eaa0`](https://github.com/mastra-ai/mastra/commit/0b5eaa07445a6551481ab6ceadef603b020a099b), [`12407df`](https://github.com/mastra-ai/mastra/commit/12407df9e6bd2f82cd27533bd4a9aa8057b97f2e), [`f122808`](https://github.com/mastra-ai/mastra/commit/f1228088b6f60f6c7ef9db8b9aca70bc5cf9f00c), [`8c05e78`](https://github.com/mastra-ai/mastra/commit/8c05e78b099b26daf4bfa9b229190201c8bf581d), [`9620613`](https://github.com/mastra-ai/mastra/commit/96206136bcc184e6238bd6dd5627fe28254eec0b), [`cc977b4`](https://github.com/mastra-ai/mastra/commit/cc977b4ce7def6727cdd63af3478d2b8b83daf07), [`c36b9e7`](https://github.com/mastra-ai/mastra/commit/c36b9e7129b355211ed9e7a3b7df2d7b81c01c05), [`c82558f`](https://github.com/mastra-ai/mastra/commit/c82558f2e5eedb493afff46f940ab7f3c085d57f), [`100431b`](https://github.com/mastra-ai/mastra/commit/100431b965dba5d32d282cfcd3c0415013cc0eed), [`7a0aea2`](https://github.com/mastra-ai/mastra/commit/7a0aea28af3bcf879a75b5bcdbfc3d471f63c565), [`a0471fe`](https://github.com/mastra-ai/mastra/commit/a0471fefaf92a44b44f5fb23e607fdad087e51f2), [`3012dd4`](https://github.com/mastra-ai/mastra/commit/3012dd424b2329eda78381688f1f48244173e6a2), [`e0077c3`](https://github.com/mastra-ai/mastra/commit/e0077c34070037ac77c264a9d5000a69c0dd2095), [`f9e22cc`](https://github.com/mastra-ai/mastra/commit/f9e22cc6fa264ded4a95ab34dab84b6ce12c2597), [`fed802d`](https://github.com/mastra-ai/mastra/commit/fed802d6e4e395d9ba42a1122c2468a072407b1c), [`6889aa2`](https://github.com/mastra-ai/mastra/commit/6889aa29d661a8892f503e37bc3d8ffe18aa7e37), [`bde069a`](https://github.com/mastra-ai/mastra/commit/bde069ac2f610abd5a09bcdb511ed04f5f01437e), [`7f4a1ca`](https://github.com/mastra-ai/mastra/commit/7f4a1ca724829e0a732eea6afb285f15908df8e9), [`d0251e3`](https://github.com/mastra-ai/mastra/commit/d0251e34973492c60e4dc7614116fcf912739875), [`680d914`](https://github.com/mastra-ai/mastra/commit/680d9141c851e8eb6fcd2d3c3fbadf05a0f1011d), [`ae74f81`](https://github.com/mastra-ai/mastra/commit/ae74f812d75034a90d647739062b9c2ca84b4ed6), [`b23b87b`](https://github.com/mastra-ai/mastra/commit/b23b87b8ab849cdc9f58b297d667c0bbaed0b62f), [`8c90438`](https://github.com/mastra-ai/mastra/commit/8c90438b404d27593927eccc47616aab4a35006e), [`a7bfa1f`](https://github.com/mastra-ai/mastra/commit/a7bfa1ff7c592f368cf34be472c7d89e03b0098b), [`f42951a`](https://github.com/mastra-ai/mastra/commit/f42951afb1d2c2a2148100a54b6ec10d473c9591), [`c8035a4`](https://github.com/mastra-ai/mastra/commit/c8035a49ae2af692d812dace394ac64635f5fd1d), [`1980959`](https://github.com/mastra-ai/mastra/commit/1980959335396f8ee72558689623abf3e205b31b), [`fa409d4`](https://github.com/mastra-ai/mastra/commit/fa409d430b879e45d433497439c0c11d2a3fafd6), [`0876fa8`](https://github.com/mastra-ai/mastra/commit/0876fa827a9685022fb0dc1606cbb673dffcaf95), [`f81d7cb`](https://github.com/mastra-ai/mastra/commit/f81d7cb89f122e1c01729a917c70ca62d6c51216), [`78cbed0`](https://github.com/mastra-ai/mastra/commit/78cbed0e0ed27b74d9b3b767566b21d513cddd53), [`beb81d3`](https://github.com/mastra-ai/mastra/commit/beb81d355b4a8e472ac411f33aa0d4854cb8662b), [`f99e0e5`](https://github.com/mastra-ai/mastra/commit/f99e0e5db6012fbdcd8eac8a32d762b2a1d56b5e), [`16d8f44`](https://github.com/mastra-ai/mastra/commit/16d8f44e3a1486d7319c1baeca6115d37f6c4cea), [`6dc66e6`](https://github.com/mastra-ai/mastra/commit/6dc66e6c69a5d26cd59349a4741fa58a15edf2b9)]:
  - @mastra/core@1.79.0
  - @mastra/discord@1.3.1
  - @mastra/teams@0.1.2
  - @mastra/telegram@0.2.3
  - @mastra/mcp@2.5.0
  - @mastra/slack@1.7.3

## 1.1.0-alpha.5

### Patch Changes

- `@mastra/mcp` and `@mastra/connect` now require `@mastra/core` 1.79.0 or later. Upgrade `@mastra/core` together with them: ([#27674](https://github.com/mastra-ai/mastra/pull/27674))

  ```bash
  # Before: @mastra/core 1.78.x with an older @mastra/mcp
  npm install @mastra/mcp@latest # peer dependency error

  # After
  npm install @mastra/core@latest @mastra/mcp@latest @mastra/connect@latest
  ```

- Updated dependencies [[`a92384b`](https://github.com/mastra-ai/mastra/commit/a92384bf9093beb9071953292a936ca722370ce5), [`a8f9157`](https://github.com/mastra-ai/mastra/commit/a8f9157fafe38f5acf68e37c8874ebd192ef8e10), [`4471372`](https://github.com/mastra-ai/mastra/commit/4471372b0338523a2f57407a90b1d913e68f17cc), [`0e9a577`](https://github.com/mastra-ai/mastra/commit/0e9a5774151385c93524883e2b1bea40e2a644de), [`fa5a031`](https://github.com/mastra-ai/mastra/commit/fa5a0316dbd5f68316b48c426fd904d2d80d9045), [`b8fe2ae`](https://github.com/mastra-ai/mastra/commit/b8fe2aec651efeaad6d607d816565453a341cdef), [`f54f8b2`](https://github.com/mastra-ai/mastra/commit/f54f8b2df2aa24e1ef4d171c733576e7c62bb1b0), [`f54f8b2`](https://github.com/mastra-ai/mastra/commit/f54f8b2df2aa24e1ef4d171c733576e7c62bb1b0), [`f54f8b2`](https://github.com/mastra-ai/mastra/commit/f54f8b2df2aa24e1ef4d171c733576e7c62bb1b0), [`a0c031c`](https://github.com/mastra-ai/mastra/commit/a0c031ceb671721b6f8557726e216ee81d23612e), [`03868f8`](https://github.com/mastra-ai/mastra/commit/03868f840401865af433040ba7ff90f585dea2e1), [`e35e335`](https://github.com/mastra-ai/mastra/commit/e35e335f19ee0c7c1e03bf247aebd24c3e041459), [`f122808`](https://github.com/mastra-ai/mastra/commit/f1228088b6f60f6c7ef9db8b9aca70bc5cf9f00c), [`cc977b4`](https://github.com/mastra-ai/mastra/commit/cc977b4ce7def6727cdd63af3478d2b8b83daf07), [`d0251e3`](https://github.com/mastra-ai/mastra/commit/d0251e34973492c60e4dc7614116fcf912739875), [`16d8f44`](https://github.com/mastra-ai/mastra/commit/16d8f44e3a1486d7319c1baeca6115d37f6c4cea)]:
  - @mastra/core@1.79.0-alpha.12
  - @mastra/mcp@2.5.0-alpha.3

## 1.1.0-alpha.4

### Minor Changes

- Added end-user (per-resource) connections to @mastra/connect. ([#26923](https://github.com/mastra-ai/mastra/pull/26923))

  **Scope tools to an end user**

  `tools()` accepts a new `resourceId` option — a static key or a callback derived per request — so an agent resolves the shared global connections plus that end user's own connections. Every platform call made under a resource scope asserts the key, so one user's connection can never serve another user's request.

  ```ts
  import { tools } from '@mastra/connect';

  // Per-request scoping on an agent:
  new Agent({ tools: ctx => tools({ resourceId: myUserIdFrom(ctx) }) });

  // Static/global usage is unchanged:
  new Agent({ tools: tools({ providers: ['linear'] }) });
  ```

  Calling `tools()` per request is cheap: identical options share one internal snapshot/MCP-client state, with per-resource caching and eviction. The returned resolver is also awaitable, so a dynamic `tools` argument can return it directly.

  **Let end users connect their own accounts**

  A new `userConnectRoutes()` export returns mountable API routes (provider catalog, the caller's connections, connect sessions, status polling, disconnect, and a hosted connect page) gated on the authenticated end user's resource key from `server.auth.mapUserToResourceId`.

  ```ts
  import { Mastra } from '@mastra/core';
  import { userConnectRoutes } from '@mastra/connect';

  export const mastra = new Mastra({
    server: {
      auth: {
        authenticateToken: async token => verifyToken(token),
        mapUserToResourceId: user => user.id,
      },
      apiRoutes: [...userConnectRoutes({ providers: ['linear', 'slack'] })],
    },
  });
  ```

  `credential()` also gains an optional `resourceId` option for asserting a resource-scoped connection's key.

### Patch Changes

- Updated dependencies [[`f1b596e`](https://github.com/mastra-ai/mastra/commit/f1b596e3219bd8721079611c62b92b8f0f6c12d9), [`4e6701a`](https://github.com/mastra-ai/mastra/commit/4e6701a8534e29fad29c7fe4c6787dc1ed56b419), [`f905746`](https://github.com/mastra-ai/mastra/commit/f905746159def2d386dca516657123f43ef90e24), [`72cb1e2`](https://github.com/mastra-ai/mastra/commit/72cb1e2b9453f7bb1bd08e4f9aa54da56fa20600), [`0e5d045`](https://github.com/mastra-ai/mastra/commit/0e5d045be4ab67d1fba5eeb8125bc2ec43aa9519), [`0e4fa4f`](https://github.com/mastra-ai/mastra/commit/0e4fa4f0604bb2e6e63e5d1d203b2dcadd646a81), [`d7c012f`](https://github.com/mastra-ai/mastra/commit/d7c012fcc98a18552e0aef55f9c0d19fccad57da), [`a7bfa1f`](https://github.com/mastra-ai/mastra/commit/a7bfa1ff7c592f368cf34be472c7d89e03b0098b)]:
  - @mastra/core@1.79.0-alpha.11
  - @mastra/mcp@2.5.0-alpha.2

## 1.1.0-alpha.3

### Patch Changes

- Updated dependencies [[`1c9fd9b`](https://github.com/mastra-ai/mastra/commit/1c9fd9bbdd4258c0d86c89cac6ae68c5023a2590), [`934ec13`](https://github.com/mastra-ai/mastra/commit/934ec1315e8ee4b73067864f56a9fcc8105e8512), [`14f17b8`](https://github.com/mastra-ai/mastra/commit/14f17b86e2b162623bb22942c7930c2113a6d8a1), [`915fbe6`](https://github.com/mastra-ai/mastra/commit/915fbe67e974edbeba4dbd3afeaec4d68b34b118), [`44e35e4`](https://github.com/mastra-ai/mastra/commit/44e35e47491ad5fd9f771526d5d8c312644000ec), [`336692a`](https://github.com/mastra-ai/mastra/commit/336692a646e28d24b303eefdb8fdbe64e4b4e801), [`f1c68eb`](https://github.com/mastra-ai/mastra/commit/f1c68eb4ae080d8cbbc694ae580850d8fa94dece), [`97f78c3`](https://github.com/mastra-ai/mastra/commit/97f78c3cf104600887e08e94cc073c973bb53c3b), [`6bfe708`](https://github.com/mastra-ai/mastra/commit/6bfe7087fcc27a08c8cba95a45c5da353188bb9c), [`a3f8ac0`](https://github.com/mastra-ai/mastra/commit/a3f8ac03c7526248e585f3e4e87b349566dd4797), [`26e684b`](https://github.com/mastra-ai/mastra/commit/26e684b1f152d341c2dca01c5347fea7e8762188), [`b77f59c`](https://github.com/mastra-ai/mastra/commit/b77f59cc5407b1158a271d579b55514f2ba79145), [`776bb6e`](https://github.com/mastra-ai/mastra/commit/776bb6e2b3ed9ec32e5430332ee756185fcebb68), [`2d0a3b0`](https://github.com/mastra-ai/mastra/commit/2d0a3b06d0880036c0dbd4b1fcf782d1f5115a56), [`5131dad`](https://github.com/mastra-ai/mastra/commit/5131dadf8c2db8641030111203db6c16fe3240f2), [`58db748`](https://github.com/mastra-ai/mastra/commit/58db74858beae6ff20ff22786c968386b9d3edcc), [`fd98055`](https://github.com/mastra-ai/mastra/commit/fd98055302882876b8dc5ae03649a89a72e2ac6c), [`b2c91db`](https://github.com/mastra-ai/mastra/commit/b2c91dbd2d32e18cd114d87301fc3b8182fddb10), [`c111a5b`](https://github.com/mastra-ai/mastra/commit/c111a5bfa2a7a197f30700ce238c84ee799df140), [`fc96794`](https://github.com/mastra-ai/mastra/commit/fc9679466bede4ca3e014aea48a72fd950a13d2a), [`44e35e4`](https://github.com/mastra-ai/mastra/commit/44e35e47491ad5fd9f771526d5d8c312644000ec), [`7337dac`](https://github.com/mastra-ai/mastra/commit/7337dac8aad8d70e98a4b0c7caa677c01966b53b), [`f51c0af`](https://github.com/mastra-ai/mastra/commit/f51c0afdd1b181b84e294f8613185494a8aaec3c), [`5f70db1`](https://github.com/mastra-ai/mastra/commit/5f70db1f3b5b38a27438d1c153db352d2bc8de30), [`7afee18`](https://github.com/mastra-ai/mastra/commit/7afee18a3d91ce125f08ffd6e2724695e8a68652), [`ca1b2f2`](https://github.com/mastra-ai/mastra/commit/ca1b2f25d7c69c6e90b719baef32ffb1db6c5681), [`6309939`](https://github.com/mastra-ai/mastra/commit/63099393563cc177960862c9179c4e2420acac5f), [`f6260f8`](https://github.com/mastra-ai/mastra/commit/f6260f8cc50c21a5d78d47fff4e04e55aca57a08), [`a3be51b`](https://github.com/mastra-ai/mastra/commit/a3be51b1a545b45bfb04377699edecbb8a8d79d6), [`bcfb6af`](https://github.com/mastra-ai/mastra/commit/bcfb6af5a61d79f6902e87d3a8fa70283f48705d), [`368149c`](https://github.com/mastra-ai/mastra/commit/368149c27954f6d578d3561cc1801cb415b78aa7), [`fdf475d`](https://github.com/mastra-ai/mastra/commit/fdf475dbc8974e1ae21966e5e96e316a7beebdf7), [`2725bd7`](https://github.com/mastra-ai/mastra/commit/2725bd73fa27f231e30bce7c6a03c651bc15b408), [`0611d4a`](https://github.com/mastra-ai/mastra/commit/0611d4a060696da5c3c550b07451d870d4af0f58), [`0eb8311`](https://github.com/mastra-ai/mastra/commit/0eb8311f9ecf254c96179e99dc145d6df3cccd07), [`9b546e2`](https://github.com/mastra-ai/mastra/commit/9b546e2b9dba91d51769a73ce1a0b34d775b144a), [`c397dff`](https://github.com/mastra-ai/mastra/commit/c397dff0ee0662b56f348852ad08aff820239d66), [`b03ee08`](https://github.com/mastra-ai/mastra/commit/b03ee089c70c087cdc9d1d0a85aa749621ad5a3c), [`0f1d83f`](https://github.com/mastra-ai/mastra/commit/0f1d83fed073613869d6283adb198b934ef80093), [`cd864ca`](https://github.com/mastra-ai/mastra/commit/cd864ca5d1fa6cb3477cb8a87b79070febbb3b6b), [`d95a821`](https://github.com/mastra-ai/mastra/commit/d95a821e903f7883b5fadfee5c7f59809d66cfb8), [`b0f7f91`](https://github.com/mastra-ai/mastra/commit/b0f7f91eb667f15e188b861759b4c4a5761ec233), [`958d170`](https://github.com/mastra-ai/mastra/commit/958d170c218a0e050c0c4807a94ce1f67f00e570), [`ba7d4e5`](https://github.com/mastra-ai/mastra/commit/ba7d4e5c9759a164279c7ebdbe2b7a32ae94b4ce), [`8b36444`](https://github.com/mastra-ai/mastra/commit/8b36444dbbc6916d298015c2586fbbde2e9b265f), [`bfd35f6`](https://github.com/mastra-ai/mastra/commit/bfd35f64178f06774c95dabec4a796245cf8a401), [`0b5eaa0`](https://github.com/mastra-ai/mastra/commit/0b5eaa07445a6551481ab6ceadef603b020a099b), [`9620613`](https://github.com/mastra-ai/mastra/commit/96206136bcc184e6238bd6dd5627fe28254eec0b), [`c36b9e7`](https://github.com/mastra-ai/mastra/commit/c36b9e7129b355211ed9e7a3b7df2d7b81c01c05), [`c82558f`](https://github.com/mastra-ai/mastra/commit/c82558f2e5eedb493afff46f940ab7f3c085d57f), [`7a0aea2`](https://github.com/mastra-ai/mastra/commit/7a0aea28af3bcf879a75b5bcdbfc3d471f63c565), [`a0471fe`](https://github.com/mastra-ai/mastra/commit/a0471fefaf92a44b44f5fb23e607fdad087e51f2), [`bde069a`](https://github.com/mastra-ai/mastra/commit/bde069ac2f610abd5a09bcdb511ed04f5f01437e), [`7f4a1ca`](https://github.com/mastra-ai/mastra/commit/7f4a1ca724829e0a732eea6afb285f15908df8e9), [`ae74f81`](https://github.com/mastra-ai/mastra/commit/ae74f812d75034a90d647739062b9c2ca84b4ed6), [`b23b87b`](https://github.com/mastra-ai/mastra/commit/b23b87b8ab849cdc9f58b297d667c0bbaed0b62f), [`c8035a4`](https://github.com/mastra-ai/mastra/commit/c8035a49ae2af692d812dace394ac64635f5fd1d), [`1980959`](https://github.com/mastra-ai/mastra/commit/1980959335396f8ee72558689623abf3e205b31b), [`fa409d4`](https://github.com/mastra-ai/mastra/commit/fa409d430b879e45d433497439c0c11d2a3fafd6), [`78cbed0`](https://github.com/mastra-ai/mastra/commit/78cbed0e0ed27b74d9b3b767566b21d513cddd53), [`f99e0e5`](https://github.com/mastra-ai/mastra/commit/f99e0e5db6012fbdcd8eac8a32d762b2a1d56b5e)]:
  - @mastra/core@1.79.0-alpha.4
  - @mastra/mcp@2.5.0-alpha.1

## 1.1.0-alpha.2

### Minor Changes

- Added a callback form to tools() for per-request options. Pass a function that reads the request context and returns ToolsOptions to vary tool filters and approval policies per request (for example by user role), without losing the snapshot cache: resolutions producing the same options share one cached snapshot with the usual TTL semantics. ([#27160](https://github.com/mastra-ai/mastra/pull/27160))

  **Before** (per-request resolver, re-fetches every request):

  ```ts
  tools: async ctx => {
    const role = ctx.requestContext?.get('role');
    return tools({
      providers: {
        linear: role === 'viewer' ? { allowTools: ['linear_list_*'] } : { requireApproval: ['linear_delete_*'] },
      },
    })(ctx);
  };
  ```

  **After** (one resolver, cache intact):

  ```ts
  tools: tools(ctx => ({
    providers: {
      linear:
        ctx?.requestContext?.get('role') === 'viewer'
          ? { allowTools: ['linear_list_*'] }
          : { requireApproval: ['linear_delete_*'] },
    },
  }));
  ```

### Patch Changes

- **Google Drive** ([#27156](https://github.com/mastra-ai/mastra/pull/27156))

  - Fixed `google_drive_create_folder`, `google_drive_upload_document`, and `google_drive_move_file` failing with 404 errors on shared drives. Agents can now write to team shared drives.
  - Added `google_drive_export_file` for exporting Docs, Sheets, and Slides to PDF and other formats.
  - Added `google_drive_list_revisions` for listing a file's revision history.

  ```ts
  const toolset = await tools({ providers: ['google-drive'] })();

  await toolset.google_drive_export_file.execute({
    fileId: '1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c',
    mimeType: 'application/pdf',
  });
  ```

  **Fireflies**

  - Fixed `fireflies_get_transcript` failing validation on every transcript. Fireflies returns numeric `speaker_id`, `start_time`, and `end_time` values that the schema only accepted as strings; the tool now accepts and normalizes them.

- Updated dependencies [[`871f3c8`](https://github.com/mastra-ai/mastra/commit/871f3c801640148cffa09474fc9f9032495ddccf), [`aaedaa6`](https://github.com/mastra-ai/mastra/commit/aaedaa634aa7394789952d4f9fe04b1aec8619a1), [`d8bfd3d`](https://github.com/mastra-ai/mastra/commit/d8bfd3d502dd9952db66f0c4f53cd04f5c8e71ef), [`12991bd`](https://github.com/mastra-ai/mastra/commit/12991bd0945ca36e13b213ebcbfaf0880d04d44d), [`323b021`](https://github.com/mastra-ai/mastra/commit/323b0212bc57c2b9acaed2716812a873c0fa43ee), [`4e44e7f`](https://github.com/mastra-ai/mastra/commit/4e44e7f518debb3b0aebc5ad71ea3e4a3902d8c9), [`3c2c033`](https://github.com/mastra-ai/mastra/commit/3c2c033aa68cd8cd7e4c630abd7f1bfeb440f457), [`12407df`](https://github.com/mastra-ai/mastra/commit/12407df9e6bd2f82cd27533bd4a9aa8057b97f2e), [`6889aa2`](https://github.com/mastra-ai/mastra/commit/6889aa29d661a8892f503e37bc3d8ffe18aa7e37)]:
  - @mastra/core@1.79.0-alpha.2

## 1.1.0-alpha.1

### Minor Changes

- Added Microsoft Teams as a supported Connect channel. When MASTRA_ENCRYPTION_KEY is unset, the Teams install store is encrypted with a key derived from the platform access token and a warning is logged; projects without a Teams connection are unaffected. ([#27094](https://github.com/mastra-ai/mastra/pull/27094))

### Patch Changes

- Fixed project-level Connect activity showing empty on the Mastra platform. @mastra/connect now sends its configured project id (MASTRA_PROJECT_ID or the projectId option) with every proxied provider request, so the platform can attribute tool and channel activity to the right project. ([#26932](https://github.com/mastra-ai/mastra/pull/26932))

  ```typescript
  import { tools } from '@mastra/connect';

  // Uses MASTRA_PROJECT_ID by default; pass projectId to override.
  const agentTools = tools({ projectId: 'proj_123' });
  ```

- Updated dependencies [[`48bee02`](https://github.com/mastra-ai/mastra/commit/48bee02e1a5cef20f4da67720191d5e85cdca13c), [`d93662b`](https://github.com/mastra-ai/mastra/commit/d93662bfee9313c376cff90e910e05ec9b0634ea), [`1874bf2`](https://github.com/mastra-ai/mastra/commit/1874bf2a5ba304f22ffb93f9ec5a9afea000a5a1), [`8c2d516`](https://github.com/mastra-ai/mastra/commit/8c2d5164714a27e720d898da612da6054a88ef91), [`14b2a7c`](https://github.com/mastra-ai/mastra/commit/14b2a7c56da4329f7fd17738056a081663deed46), [`eb0b702`](https://github.com/mastra-ai/mastra/commit/eb0b702e9939f02073fb1c4dfd7eaa51fde59e0b), [`d93662b`](https://github.com/mastra-ai/mastra/commit/d93662bfee9313c376cff90e910e05ec9b0634ea), [`425d383`](https://github.com/mastra-ai/mastra/commit/425d383d4fb15e55e9491b6bdaebb57f2de7cdc8), [`5d8f8b7`](https://github.com/mastra-ai/mastra/commit/5d8f8b78460350d581e8a92412cdfe88b4ce76bc), [`8c90438`](https://github.com/mastra-ai/mastra/commit/8c90438b404d27593927eccc47616aab4a35006e), [`6dc66e6`](https://github.com/mastra-ai/mastra/commit/6dc66e6c69a5d26cd59349a4741fa58a15edf2b9)]:
  - @mastra/core@1.79.0-alpha.1
  - @mastra/teams@0.1.2-alpha.1

## 1.0.4-alpha.0

### Patch Changes

- Bump for npm ([#27221](https://github.com/mastra-ai/mastra/pull/27221))

- Updated dependencies [[`9b60f12`](https://github.com/mastra-ai/mastra/commit/9b60f12b13b28c9664a839aef435e6d10898644d), [`f885386`](https://github.com/mastra-ai/mastra/commit/f885386b79be0e4d784067b0e26608971e0cc788), [`f6a9762`](https://github.com/mastra-ai/mastra/commit/f6a9762b12ae9dad6a154f73ed3099a2ee472d0c), [`fae54c5`](https://github.com/mastra-ai/mastra/commit/fae54c57917cd1f527937ca42b5ab7dfe1d55a2a)]:
  - @mastra/core@1.78.1-alpha.0
  - @mastra/discord@1.3.1-alpha.0
  - @mastra/slack@1.7.3-alpha.0
  - @mastra/teams@0.1.2-alpha.0
  - @mastra/telegram@0.2.3-alpha.0
  - @mastra/mcp@2.4.2-alpha.0

## 1.0.3

### Patch Changes

- Updated dependencies [[`0b1ea6c`](https://github.com/mastra-ai/mastra/commit/0b1ea6ca6266158316defb522feb3d2f9bf33174), [`bed1ccc`](https://github.com/mastra-ai/mastra/commit/bed1cccea5817d68faa42a15fda3a0b329f70680), [`a9b85ba`](https://github.com/mastra-ai/mastra/commit/a9b85ba48a2542c568d91f3032464057227d55dc), [`6f50db8`](https://github.com/mastra-ai/mastra/commit/6f50db8a3e0a673c6e094229e3d18e2b8dbb99f7), [`f28c44e`](https://github.com/mastra-ai/mastra/commit/f28c44ed98a87c6078a3e3e9ef2b197d97f97956), [`3ddf32d`](https://github.com/mastra-ai/mastra/commit/3ddf32da0e6eaffd1e5da33105bf245b6e56a117), [`03646c5`](https://github.com/mastra-ai/mastra/commit/03646c587b915ced4c9fad3189391909a296f441), [`02e2eae`](https://github.com/mastra-ai/mastra/commit/02e2eae3aee1c5b5b9c807a6a3389b88eca1440c), [`7b08a87`](https://github.com/mastra-ai/mastra/commit/7b08a876b1060cf6842c61ed8af0eaa93e1310c4), [`5d82145`](https://github.com/mastra-ai/mastra/commit/5d82145ae3cc591eb5cdafd4af5977c36fec5c01), [`7e4b680`](https://github.com/mastra-ai/mastra/commit/7e4b68035c3e62a4fcf981afce9b02ecf65ddcf5), [`032a92d`](https://github.com/mastra-ai/mastra/commit/032a92d661696b3620ce45f4a0b1de60f0a6c068), [`1c9cb41`](https://github.com/mastra-ai/mastra/commit/1c9cb4151c3addfdf689ee1dd9d3a013c7342e25), [`460b600`](https://github.com/mastra-ai/mastra/commit/460b600abe3b7563537cfb8a676d649c638a9190), [`2362057`](https://github.com/mastra-ai/mastra/commit/2362057cedc6b90b9fd71c424df40eedf3a4ecf3), [`9daf547`](https://github.com/mastra-ai/mastra/commit/9daf547f810df721eaca9c9dafc18f8ce1727b77), [`5faebef`](https://github.com/mastra-ai/mastra/commit/5faebef77012b31d2062e266a27718ca35ac738d), [`2eefb56`](https://github.com/mastra-ai/mastra/commit/2eefb565fd524acbc5105ddecd9d4f2a0f1deb2f), [`f738a12`](https://github.com/mastra-ai/mastra/commit/f738a120225329f619211756d69f164a3f434c5d), [`4c29655`](https://github.com/mastra-ai/mastra/commit/4c296551a79bebc6a40fddcf2409824f601e6c43), [`843d441`](https://github.com/mastra-ai/mastra/commit/843d4411284c3b96953edebd2c22c3ac9556bac2), [`33eb344`](https://github.com/mastra-ai/mastra/commit/33eb344ebfe918d032e3ad1e410788d4c8bc6526), [`6155190`](https://github.com/mastra-ai/mastra/commit/6155190d2436d5e93e21f6a875d8c4306c8043ff), [`5d12fbf`](https://github.com/mastra-ai/mastra/commit/5d12fbfcd756e5f5b0cae53e45a486a64ad102f5), [`eb71f8c`](https://github.com/mastra-ai/mastra/commit/eb71f8c3abbe9aa40375f898fce60f555ef9ebf3), [`6ea5f80`](https://github.com/mastra-ai/mastra/commit/6ea5f80919ae4ebc3e3fbba29390da74f043c69a), [`35fbdce`](https://github.com/mastra-ai/mastra/commit/35fbdce6de71332246dd6d9b4a5ecba2d87fb6cc), [`e496762`](https://github.com/mastra-ai/mastra/commit/e49676258181017f50eb5739d4a97c0da7317dd9), [`d7bd3cd`](https://github.com/mastra-ai/mastra/commit/d7bd3cda0fb2e46c68d164af2e0cb1815be03572), [`cb015a1`](https://github.com/mastra-ai/mastra/commit/cb015a1be6560cbaf4deaef219cb02e63b263bc3), [`9cf0fe4`](https://github.com/mastra-ai/mastra/commit/9cf0fe4731d6186be20c890dba27ba3a2c134f5e), [`c09fb4b`](https://github.com/mastra-ai/mastra/commit/c09fb4b5758114c8c57d0af48cbe6dfdfe9dde90), [`b2dd0c6`](https://github.com/mastra-ai/mastra/commit/b2dd0c6333691467e61406ac920eb6f861db6bc0), [`ad16eae`](https://github.com/mastra-ai/mastra/commit/ad16eae7eec9af386c9eee81f4f30ef65d0df48b), [`d99fa30`](https://github.com/mastra-ai/mastra/commit/d99fa305e0baa00fb2064283658c10e00b95bf10)]:
  - @mastra/core@1.78.0
  - @mastra/mcp@2.4.1

## 1.0.3-alpha.0

### Patch Changes

- Updated dependencies [[`bed1ccc`](https://github.com/mastra-ai/mastra/commit/bed1cccea5817d68faa42a15fda3a0b329f70680), [`02e2eae`](https://github.com/mastra-ai/mastra/commit/02e2eae3aee1c5b5b9c807a6a3389b88eca1440c), [`5faebef`](https://github.com/mastra-ai/mastra/commit/5faebef77012b31d2062e266a27718ca35ac738d), [`b2dd0c6`](https://github.com/mastra-ai/mastra/commit/b2dd0c6333691467e61406ac920eb6f861db6bc0), [`ad16eae`](https://github.com/mastra-ai/mastra/commit/ad16eae7eec9af386c9eee81f4f30ef65d0df48b)]:
  - @mastra/core@1.78.0-alpha.1
  - @mastra/mcp@2.4.1-alpha.0

## 1.0.2

### Patch Changes

- Jira tool errors now include the human-readable message from `errorMessages[]` and field-level `errors` maps, and GitHub-style `{ message }` error bodies surface their message instead of a bare status code. ([#26762](https://github.com/mastra-ai/mastra/pull/26762))

- Fixed Linear tool calls failing on valid API responses: attachment tools now accept null creator emails, and cycle/project tools report GraphQL errors instead of crashing on validation. Fireflies transcript tools now handle `action_items` returned as either an array or a newline-joined string. ([#26516](https://github.com/mastra-ai/mastra/pull/26516))

- `@mastra/connect` now requires `@mastra/core` 1.76.0 or later, matching the `@mastra/mcp` version it depends on. ([#26059](https://github.com/mastra-ai/mastra/pull/26059))

- Updated dependencies [[`54e9dc3`](https://github.com/mastra-ai/mastra/commit/54e9dc3ed0615ee84a6526395a9fefe17320fe7e), [`f8c0ce2`](https://github.com/mastra-ai/mastra/commit/f8c0ce2646427327b63c05d2eb09e76a3b04133e), [`eaa9d12`](https://github.com/mastra-ai/mastra/commit/eaa9d12407f4962e94e0d5cd49a643e6e317d60a), [`5a70664`](https://github.com/mastra-ai/mastra/commit/5a7066478c1924a6e9a94e1ba3210f9b67a35535), [`3504acd`](https://github.com/mastra-ai/mastra/commit/3504acdb2833b71db61dc9387c0f25f3cd0a3070), [`59164cb`](https://github.com/mastra-ai/mastra/commit/59164cb7f8b298e28e13305b0273ed2ef7f1d9e1), [`2a1bb80`](https://github.com/mastra-ai/mastra/commit/2a1bb80305bca1859504287e1a09f43c8a014330), [`4df792b`](https://github.com/mastra-ai/mastra/commit/4df792b5b9146b5a2d6726193ee82d9db31180a4), [`0017956`](https://github.com/mastra-ai/mastra/commit/001795671cf329997bee74541f5de9056e6b1cec), [`aa00f41`](https://github.com/mastra-ai/mastra/commit/aa00f41855e8d6802546f613ffec1669e03409fc), [`36fc7ea`](https://github.com/mastra-ai/mastra/commit/36fc7eabf79ca70bd489e4022eb39a3d8382ace5), [`2ec9c07`](https://github.com/mastra-ai/mastra/commit/2ec9c07eddb142c965f1201f5c6e5dbb288405f9), [`e384817`](https://github.com/mastra-ai/mastra/commit/e3848177f2a0051ea1469a06fb6502164bfada7c), [`519e97f`](https://github.com/mastra-ai/mastra/commit/519e97f624a15362fec7b143dea4eabcff556712), [`e384817`](https://github.com/mastra-ai/mastra/commit/e3848177f2a0051ea1469a06fb6502164bfada7c), [`821b8d4`](https://github.com/mastra-ai/mastra/commit/821b8d4253dcac5d8cf886994884e4645899bedc), [`878e0e2`](https://github.com/mastra-ai/mastra/commit/878e0e2f5adf9669158c7a8a8d67cd8809633c24), [`aea91e7`](https://github.com/mastra-ai/mastra/commit/aea91e7f3a4fb066bfda96dca670d7d2a766d770), [`380e9f5`](https://github.com/mastra-ai/mastra/commit/380e9f57ea9ba7c37950b989d145b70c03a09a6c), [`4029a96`](https://github.com/mastra-ai/mastra/commit/4029a964848512399f27bca283915d49fd106717), [`8dc4d65`](https://github.com/mastra-ai/mastra/commit/8dc4d65b34aad280c4f6ab265162c4846face7e3), [`ca92c02`](https://github.com/mastra-ai/mastra/commit/ca92c02696427baad81dd7a61b049ef37c332452), [`3504acd`](https://github.com/mastra-ai/mastra/commit/3504acdb2833b71db61dc9387c0f25f3cd0a3070), [`5bb6d71`](https://github.com/mastra-ai/mastra/commit/5bb6d711680d17370eacdcdab105e5af69202c5f), [`dab6849`](https://github.com/mastra-ai/mastra/commit/dab6849945ab2a0e4c946f5b31fb6f41b2c1cd7d), [`da87b0a`](https://github.com/mastra-ai/mastra/commit/da87b0a1629d5ffc980b434f70fe60f9445ddb1c), [`182f097`](https://github.com/mastra-ai/mastra/commit/182f09745783aa83e42131307085ecf913cfbc38), [`d9da0da`](https://github.com/mastra-ai/mastra/commit/d9da0da5e5d36023469b527f7be55c017634b186), [`097f002`](https://github.com/mastra-ai/mastra/commit/097f00297b0d46aa304eba3a7203248e21d1a70a), [`958bdc9`](https://github.com/mastra-ai/mastra/commit/958bdc942aa78f00c9ec25f8adfb8e14a0dd4fd9), [`4659a11`](https://github.com/mastra-ai/mastra/commit/4659a1130842f07364d4778aa360f3cb7877679d), [`aa00f41`](https://github.com/mastra-ai/mastra/commit/aa00f41855e8d6802546f613ffec1669e03409fc), [`5227c95`](https://github.com/mastra-ai/mastra/commit/5227c95d54d0b4846220530450063f259797b587), [`226823f`](https://github.com/mastra-ai/mastra/commit/226823ffde55e2dcce01f2111a6a35be3f2c9b85), [`67a6b30`](https://github.com/mastra-ai/mastra/commit/67a6b30769f041244f75f9093a181cdf38e1f2e7), [`7236b47`](https://github.com/mastra-ai/mastra/commit/7236b472bca9bbc9dddba53f683b15c271350183)]:
  - @mastra/core@1.77.0
  - @mastra/mcp@2.4.0

## 1.0.2-alpha.0

### Patch Changes

- Jira tool errors now include the human-readable message from `errorMessages[]` and field-level `errors` maps, and GitHub-style `{ message }` error bodies surface their message instead of a bare status code. ([#26762](https://github.com/mastra-ai/mastra/pull/26762))

- Fixed Linear tool calls failing on valid API responses: attachment tools now accept null creator emails, and cycle/project tools report GraphQL errors instead of crashing on validation. Fireflies transcript tools now handle `action_items` returned as either an array or a newline-joined string. ([#26516](https://github.com/mastra-ai/mastra/pull/26516))

- `@mastra/connect` now requires `@mastra/core` 1.76.0 or later, matching the `@mastra/mcp` version it depends on. ([#26059](https://github.com/mastra-ai/mastra/pull/26059))

- Updated dependencies [[`3504acd`](https://github.com/mastra-ai/mastra/commit/3504acdb2833b71db61dc9387c0f25f3cd0a3070), [`e384817`](https://github.com/mastra-ai/mastra/commit/e3848177f2a0051ea1469a06fb6502164bfada7c), [`e384817`](https://github.com/mastra-ai/mastra/commit/e3848177f2a0051ea1469a06fb6502164bfada7c), [`821b8d4`](https://github.com/mastra-ai/mastra/commit/821b8d4253dcac5d8cf886994884e4645899bedc), [`878e0e2`](https://github.com/mastra-ai/mastra/commit/878e0e2f5adf9669158c7a8a8d67cd8809633c24), [`3504acd`](https://github.com/mastra-ai/mastra/commit/3504acdb2833b71db61dc9387c0f25f3cd0a3070), [`5bb6d71`](https://github.com/mastra-ai/mastra/commit/5bb6d711680d17370eacdcdab105e5af69202c5f), [`dab6849`](https://github.com/mastra-ai/mastra/commit/dab6849945ab2a0e4c946f5b31fb6f41b2c1cd7d), [`5227c95`](https://github.com/mastra-ai/mastra/commit/5227c95d54d0b4846220530450063f259797b587)]:
  - @mastra/mcp@2.4.0-alpha.0
  - @mastra/core@1.77.0-alpha.1

## 1.0.1

### Patch Changes

- Added search tools so agents can find records directly instead of paging through full listings: `slack_search_channels` (find channels by name), `github_search_issues`, `github_search_repositories`, `github_search_code`, `hubspot_search_contacts`, `discord_search_members`, and `stripe_search_customers`. ([#26271](https://github.com/mastra-ai/mastra/pull/26271))

  ```ts
  const tools = await mastra.tools();
  // Find a channel without paging conversations.list manually
  await tools.slack_search_channels.execute({ query: 'eng-platform' }, { requestContext });
  // Search issues and PRs with GitHub's query syntax
  await tools.github_search_issues.execute({ q: 'repo:mastra-ai/mastra is:open label:bug' }, { requestContext });
  ```

- Updated dependencies [[`908f923`](https://github.com/mastra-ai/mastra/commit/908f92340e14f776d7a69edab244d0ae3cefe057), [`b196f30`](https://github.com/mastra-ai/mastra/commit/b196f30602005325e95bde29a9b7676aeea14c42), [`a65d0c7`](https://github.com/mastra-ai/mastra/commit/a65d0c788824081f36ccd95078a8d1214ff687c4), [`4b8f1d7`](https://github.com/mastra-ai/mastra/commit/4b8f1d74adb2b1742fd10ebb1d24e863329075aa), [`9a511a4`](https://github.com/mastra-ai/mastra/commit/9a511a4ff5ac8349f4d4b64b0f432576fa3c8656), [`2233844`](https://github.com/mastra-ai/mastra/commit/223384452984718e16fc660d29f0d5d93a1ebaf2), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`cca0f8a`](https://github.com/mastra-ai/mastra/commit/cca0f8a543eca15c24be21c8ee43dc46fb7aefae), [`20f7f87`](https://github.com/mastra-ai/mastra/commit/20f7f878953cb0965962d1e83a463be5e4ba2c26), [`65b62c0`](https://github.com/mastra-ai/mastra/commit/65b62c04c28267ab81f7d6b92ed29ce0ef46671b), [`d4e6c7f`](https://github.com/mastra-ai/mastra/commit/d4e6c7fffdef836fc44276509596e78d7d785729), [`b801545`](https://github.com/mastra-ai/mastra/commit/b80154540bf557de296bcb6f068b5117b5d84ef9), [`ed0e355`](https://github.com/mastra-ai/mastra/commit/ed0e355205da51bac4d11b7a9553c95ef1f505f4), [`b93ce2e`](https://github.com/mastra-ai/mastra/commit/b93ce2ee034c6a0be511b717e1e043e875dca677), [`ddb53f2`](https://github.com/mastra-ai/mastra/commit/ddb53f26142ccf6177dec5392b6dc867ce177d15), [`42a3c74`](https://github.com/mastra-ai/mastra/commit/42a3c748085fee95d4e38e42a4ccbce891ce3e3f), [`21eaa20`](https://github.com/mastra-ai/mastra/commit/21eaa208834ae36721324700023f88cec7cf5c01), [`4580309`](https://github.com/mastra-ai/mastra/commit/45803095e2aed7bf58d878eb206a767b9b0e2489), [`06e428d`](https://github.com/mastra-ai/mastra/commit/06e428d80ccbc54bb74eb6bd6f01a7fd4eddc45f), [`d0db35e`](https://github.com/mastra-ai/mastra/commit/d0db35e00be93f1339525188c102f73dea5867d8), [`b48ddcc`](https://github.com/mastra-ai/mastra/commit/b48ddcc7768c76f02d1dd4ed0f21d417a8b21418), [`578d2c4`](https://github.com/mastra-ai/mastra/commit/578d2c41fc83b13efd88165ff0105904434a6db4), [`b875985`](https://github.com/mastra-ai/mastra/commit/b87598584f0f2b008242ed1f458b7f72ba6d42d1), [`cf6446c`](https://github.com/mastra-ai/mastra/commit/cf6446cae036784bd6802e4bcca8f3cf34a9ca9f), [`a8f39b6`](https://github.com/mastra-ai/mastra/commit/a8f39b629d8bcd6659b61bf71bd5a5dd2f38ed12), [`34844fc`](https://github.com/mastra-ai/mastra/commit/34844fcc7aeff1ae867c0aeedcd990caa520c418), [`04a2433`](https://github.com/mastra-ai/mastra/commit/04a2433d8e533010e23c3af84421d52bd0b3a908), [`85cfc88`](https://github.com/mastra-ai/mastra/commit/85cfc88fc5f196ef97cd2334441cd30cac99bce1), [`f2073f6`](https://github.com/mastra-ai/mastra/commit/f2073f6f2fff59ffca7eeac67579093454a0e761), [`46bb6b2`](https://github.com/mastra-ai/mastra/commit/46bb6b29dd83cabb09cf720dd8a3655860bf5858), [`2bf5b78`](https://github.com/mastra-ai/mastra/commit/2bf5b78761af6606b42ae2e085722eb50cdbc839), [`dc28dbd`](https://github.com/mastra-ai/mastra/commit/dc28dbd89f7afa455a1985c7909adf42ddd6bd48), [`25b8b60`](https://github.com/mastra-ai/mastra/commit/25b8b6074cbb5f0c744e4edb4ce0c5ee1f3771d6), [`41bf075`](https://github.com/mastra-ai/mastra/commit/41bf0759e486ff7eb078ff9d83d532e086a16039), [`73e6b7c`](https://github.com/mastra-ai/mastra/commit/73e6b7c18ee19fbb31c6f9bad4ce23c16212876b), [`68fa51c`](https://github.com/mastra-ai/mastra/commit/68fa51cf57ee7a3b0914d5381870b60e81f0647e), [`faf79ea`](https://github.com/mastra-ai/mastra/commit/faf79ea0d1aa7b2265b070f5323339fa275ebb49), [`b801545`](https://github.com/mastra-ai/mastra/commit/b80154540bf557de296bcb6f068b5117b5d84ef9), [`a1793d7`](https://github.com/mastra-ai/mastra/commit/a1793d7d077ed450125628ede812897ecbf08c4c), [`3645c3d`](https://github.com/mastra-ai/mastra/commit/3645c3d67e0c1f40005035911103deba381d246a), [`a9c8af5`](https://github.com/mastra-ai/mastra/commit/a9c8af5b6b2449e4127ab30b662e79ac025cc4f0), [`028dc61`](https://github.com/mastra-ai/mastra/commit/028dc61f4802fad472603df1538c4ca126f8680f), [`e5688d2`](https://github.com/mastra-ai/mastra/commit/e5688d2945aff1e867eb8b9fc5f25393d6579216), [`1211fcf`](https://github.com/mastra-ai/mastra/commit/1211fcf499acbda22ca8d399ae820789c69609f2), [`a1c0020`](https://github.com/mastra-ai/mastra/commit/a1c002066736e54a4b07c03968b0df19cf1afb03), [`c0540d2`](https://github.com/mastra-ai/mastra/commit/c0540d2dfccec3470eed3cab539221557abd1fc5), [`297e55e`](https://github.com/mastra-ai/mastra/commit/297e55ea3d0eef280c3776bec401584ce3c2bff2), [`e995603`](https://github.com/mastra-ai/mastra/commit/e995603f64d4f03d234e7f53cc3ab03d9dfea502), [`2f0c604`](https://github.com/mastra-ai/mastra/commit/2f0c604b802068a063689fec4d0db91daa80d7c9), [`85636a2`](https://github.com/mastra-ai/mastra/commit/85636a2341aca229feb83c72b730a0d50f2f1753), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`2ef4283`](https://github.com/mastra-ai/mastra/commit/2ef428340d1eda6c6c8cfba4b90a43b88739f098), [`d45b854`](https://github.com/mastra-ai/mastra/commit/d45b854640e9b3d7fe7434061be988359ac2f470), [`b801545`](https://github.com/mastra-ai/mastra/commit/b80154540bf557de296bcb6f068b5117b5d84ef9), [`a7404f9`](https://github.com/mastra-ai/mastra/commit/a7404f965b811a0eef35d41a5e69c91187eb0cf6), [`5068168`](https://github.com/mastra-ai/mastra/commit/50681683948fd55928d029a63f0de7e56976e1f4), [`956901a`](https://github.com/mastra-ai/mastra/commit/956901a36b84a85f3985d9e5956494749b7ea72c), [`92004fd`](https://github.com/mastra-ai/mastra/commit/92004fd001edd2a0647f2531e0daf76a5825fc00), [`b389368`](https://github.com/mastra-ai/mastra/commit/b389368b0574a6a575a5835a11fc41437b78b842), [`6c9ad80`](https://github.com/mastra-ai/mastra/commit/6c9ad808c8503e812a72a48827ce425b9e78970f), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`eda5b00`](https://github.com/mastra-ai/mastra/commit/eda5b0081bdc49cc17ac8fc1267fccabb5e7a33f), [`838fd4b`](https://github.com/mastra-ai/mastra/commit/838fd4b1526c5385424d8e147d3d1d37137f6a13), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`835e2cd`](https://github.com/mastra-ai/mastra/commit/835e2cdba8dbef6848f18bb73bbb8aa9dad6dddf), [`65b62c0`](https://github.com/mastra-ai/mastra/commit/65b62c04c28267ab81f7d6b92ed29ce0ef46671b), [`0fca057`](https://github.com/mastra-ai/mastra/commit/0fca05756ac8409494d54c70106db2ef7dfc81fc), [`57c3117`](https://github.com/mastra-ai/mastra/commit/57c3117dd4d0dd0ad0835edb1bf410b6ec76fba0), [`9db8229`](https://github.com/mastra-ai/mastra/commit/9db8229bc7c30133fb1c085f710f1fbf94e5d335), [`7a96951`](https://github.com/mastra-ai/mastra/commit/7a96951771a6aab850ceafefc73afe684ef24b21), [`a3f884c`](https://github.com/mastra-ai/mastra/commit/a3f884c6fa230f9c75049f7105df5f1429fa406e), [`e89310a`](https://github.com/mastra-ai/mastra/commit/e89310a8db29a663a85c6a31a8c376cc8f59c129), [`7c0cf99`](https://github.com/mastra-ai/mastra/commit/7c0cf997ab2306a176aa84fe6f611574721120c3), [`46bb6b2`](https://github.com/mastra-ai/mastra/commit/46bb6b29dd83cabb09cf720dd8a3655860bf5858), [`a3269cd`](https://github.com/mastra-ai/mastra/commit/a3269cd4b92683780591ca782be491834787b861), [`152679c`](https://github.com/mastra-ai/mastra/commit/152679c4b74de8be29e5d932f6c4b35e79397516), [`18afca3`](https://github.com/mastra-ai/mastra/commit/18afca34ba6ab013152da61b2017dc443c2aa08b), [`b6b3f49`](https://github.com/mastra-ai/mastra/commit/b6b3f49d35ce62b584d9753361a7db7c15045801), [`a2d52e1`](https://github.com/mastra-ai/mastra/commit/a2d52e1d6a1542e3eb994853145ffd113fd02c2f), [`3a7e3d0`](https://github.com/mastra-ai/mastra/commit/3a7e3d01211a7ad5696b242f033cd1a30b06912e), [`436ea9d`](https://github.com/mastra-ai/mastra/commit/436ea9d4fb8146250bb106fd0f0200ea1cfd47d5), [`a7a34bf`](https://github.com/mastra-ai/mastra/commit/a7a34bfcc2235daa6229d6783b3ad1a2eaa25c56), [`65b62c0`](https://github.com/mastra-ai/mastra/commit/65b62c04c28267ab81f7d6b92ed29ce0ef46671b), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`4416137`](https://github.com/mastra-ai/mastra/commit/4416137e6b9368c11fcb31edba3d1937cfe61a40), [`678e1c3`](https://github.com/mastra-ai/mastra/commit/678e1c36f9118165c3315c2fd739334d9138eff4), [`f2243ae`](https://github.com/mastra-ai/mastra/commit/f2243ae5e0d183fdbb8c8f3ff81fa86d32036a6c), [`70d59a9`](https://github.com/mastra-ai/mastra/commit/70d59a97fb2a5953c5853bf5f5fdfdc02d2337e7), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`005161a`](https://github.com/mastra-ai/mastra/commit/005161a90ac9a8d25a4f9b1edc95c139e5d295d9), [`14f9341`](https://github.com/mastra-ai/mastra/commit/14f934145150a2531abfc1c36d03909fd05b5c56), [`b329f0d`](https://github.com/mastra-ai/mastra/commit/b329f0d45ce719acdd8926263269de6c91e31305), [`539d0e6`](https://github.com/mastra-ai/mastra/commit/539d0e638c9eaa3b71d99df067061af4ddbb2045), [`46bb6b2`](https://github.com/mastra-ai/mastra/commit/46bb6b29dd83cabb09cf720dd8a3655860bf5858), [`c7283d7`](https://github.com/mastra-ai/mastra/commit/c7283d715d9c8a7f3d3afd904f402ea0d4d843c4), [`7cb014d`](https://github.com/mastra-ai/mastra/commit/7cb014d3bdd96739c4bd7ad968af34c6a88ced7e), [`fe99f41`](https://github.com/mastra-ai/mastra/commit/fe99f41ea293a172da840c89a782d13a7c7a7709), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`9f4ab32`](https://github.com/mastra-ai/mastra/commit/9f4ab3242bd686ff43c871fedeede1ed21260dbf), [`2558c00`](https://github.com/mastra-ai/mastra/commit/2558c00b338025de29f778ca72b6bd05e5726349), [`2f14b26`](https://github.com/mastra-ai/mastra/commit/2f14b267b06da7255ef7c131f1138993c39bd733), [`590d6ca`](https://github.com/mastra-ai/mastra/commit/590d6ca9fa6ccf8b55dcf2e98da080ee1a348f67), [`1511a1d`](https://github.com/mastra-ai/mastra/commit/1511a1d65d9e2ccc08b4d6746f8e8053fc48549e), [`f431c23`](https://github.com/mastra-ai/mastra/commit/f431c2321cf186f09565c42ddba33ee40cb96b6d), [`ea7ca75`](https://github.com/mastra-ai/mastra/commit/ea7ca755a470f026606949567da32e69969ef16c), [`a831a8b`](https://github.com/mastra-ai/mastra/commit/a831a8be6b92cf7a549e7b9d851f3c4295d4431b), [`436ea9d`](https://github.com/mastra-ai/mastra/commit/436ea9d4fb8146250bb106fd0f0200ea1cfd47d5), [`cfaeff3`](https://github.com/mastra-ai/mastra/commit/cfaeff3e03d6743682a8db0c1c30c2dab11b3171), [`180bdc5`](https://github.com/mastra-ai/mastra/commit/180bdc5398e253ffae7eaff6330409d7f5254f8b), [`45a1ab7`](https://github.com/mastra-ai/mastra/commit/45a1ab7f300637be9d5b953d82b58f77b64c1b56), [`70d59a9`](https://github.com/mastra-ai/mastra/commit/70d59a97fb2a5953c5853bf5f5fdfdc02d2337e7), [`33a206d`](https://github.com/mastra-ai/mastra/commit/33a206d7d0a52d17ebab8db5224c5091c086c86d), [`38643be`](https://github.com/mastra-ai/mastra/commit/38643beb41ab0d1f67b8754f057781022448a618), [`7c34315`](https://github.com/mastra-ai/mastra/commit/7c343153b26755a4cdcdd7897d2b4bd2758c29d4)]:
  - @mastra/core@1.76.0
  - @mastra/mcp@2.3.0

## 1.0.1-alpha.1

### Patch Changes

- Updated dependencies [[`b196f30`](https://github.com/mastra-ai/mastra/commit/b196f30602005325e95bde29a9b7676aeea14c42), [`cca0f8a`](https://github.com/mastra-ai/mastra/commit/cca0f8a543eca15c24be21c8ee43dc46fb7aefae), [`06e428d`](https://github.com/mastra-ai/mastra/commit/06e428d80ccbc54bb74eb6bd6f01a7fd4eddc45f), [`b875985`](https://github.com/mastra-ai/mastra/commit/b87598584f0f2b008242ed1f458b7f72ba6d42d1), [`85cfc88`](https://github.com/mastra-ai/mastra/commit/85cfc88fc5f196ef97cd2334441cd30cac99bce1), [`f2073f6`](https://github.com/mastra-ai/mastra/commit/f2073f6f2fff59ffca7eeac67579093454a0e761), [`a1c0020`](https://github.com/mastra-ai/mastra/commit/a1c002066736e54a4b07c03968b0df19cf1afb03), [`5068168`](https://github.com/mastra-ai/mastra/commit/50681683948fd55928d029a63f0de7e56976e1f4), [`6c9ad80`](https://github.com/mastra-ai/mastra/commit/6c9ad808c8503e812a72a48827ce425b9e78970f), [`a3269cd`](https://github.com/mastra-ai/mastra/commit/a3269cd4b92683780591ca782be491834787b861), [`152679c`](https://github.com/mastra-ai/mastra/commit/152679c4b74de8be29e5d932f6c4b35e79397516), [`7cb014d`](https://github.com/mastra-ai/mastra/commit/7cb014d3bdd96739c4bd7ad968af34c6a88ced7e), [`9f4ab32`](https://github.com/mastra-ai/mastra/commit/9f4ab3242bd686ff43c871fedeede1ed21260dbf), [`a831a8b`](https://github.com/mastra-ai/mastra/commit/a831a8be6b92cf7a549e7b9d851f3c4295d4431b)]:
  - @mastra/core@1.76.0-alpha.6
  - @mastra/mcp@2.3.0-alpha.1

## 1.0.1-alpha.0

### Patch Changes

- Added search tools so agents can find records directly instead of paging through full listings: `slack_search_channels` (find channels by name), `github_search_issues`, `github_search_repositories`, `github_search_code`, `hubspot_search_contacts`, `discord_search_members`, and `stripe_search_customers`. ([#26271](https://github.com/mastra-ai/mastra/pull/26271))

  ```ts
  const tools = await mastra.tools();
  // Find a channel without paging conversations.list manually
  await tools.slack_search_channels.execute({ query: 'eng-platform' }, { requestContext });
  // Search issues and PRs with GitHub's query syntax
  await tools.github_search_issues.execute({ q: 'repo:mastra-ai/mastra is:open label:bug' }, { requestContext });
  ```

- Updated dependencies [[`4b8f1d7`](https://github.com/mastra-ai/mastra/commit/4b8f1d74adb2b1742fd10ebb1d24e863329075aa), [`d4e6c7f`](https://github.com/mastra-ai/mastra/commit/d4e6c7fffdef836fc44276509596e78d7d785729), [`b801545`](https://github.com/mastra-ai/mastra/commit/b80154540bf557de296bcb6f068b5117b5d84ef9), [`ddb53f2`](https://github.com/mastra-ai/mastra/commit/ddb53f26142ccf6177dec5392b6dc867ce177d15), [`42a3c74`](https://github.com/mastra-ai/mastra/commit/42a3c748085fee95d4e38e42a4ccbce891ce3e3f), [`b801545`](https://github.com/mastra-ai/mastra/commit/b80154540bf557de296bcb6f068b5117b5d84ef9), [`a9c8af5`](https://github.com/mastra-ai/mastra/commit/a9c8af5b6b2449e4127ab30b662e79ac025cc4f0), [`028dc61`](https://github.com/mastra-ai/mastra/commit/028dc61f4802fad472603df1538c4ca126f8680f), [`2ef4283`](https://github.com/mastra-ai/mastra/commit/2ef428340d1eda6c6c8cfba4b90a43b88739f098), [`d45b854`](https://github.com/mastra-ai/mastra/commit/d45b854640e9b3d7fe7434061be988359ac2f470), [`b801545`](https://github.com/mastra-ai/mastra/commit/b80154540bf557de296bcb6f068b5117b5d84ef9), [`92004fd`](https://github.com/mastra-ai/mastra/commit/92004fd001edd2a0647f2531e0daf76a5825fc00), [`b389368`](https://github.com/mastra-ai/mastra/commit/b389368b0574a6a575a5835a11fc41437b78b842), [`835e2cd`](https://github.com/mastra-ai/mastra/commit/835e2cdba8dbef6848f18bb73bbb8aa9dad6dddf), [`0fca057`](https://github.com/mastra-ai/mastra/commit/0fca05756ac8409494d54c70106db2ef7dfc81fc), [`9db8229`](https://github.com/mastra-ai/mastra/commit/9db8229bc7c30133fb1c085f710f1fbf94e5d335), [`3a7e3d0`](https://github.com/mastra-ai/mastra/commit/3a7e3d01211a7ad5696b242f033cd1a30b06912e), [`005161a`](https://github.com/mastra-ai/mastra/commit/005161a90ac9a8d25a4f9b1edc95c139e5d295d9), [`c7283d7`](https://github.com/mastra-ai/mastra/commit/c7283d715d9c8a7f3d3afd904f402ea0d4d843c4), [`2f14b26`](https://github.com/mastra-ai/mastra/commit/2f14b267b06da7255ef7c131f1138993c39bd733), [`ea7ca75`](https://github.com/mastra-ai/mastra/commit/ea7ca755a470f026606949567da32e69969ef16c)]:
  - @mastra/core@1.76.0-alpha.1
  - @mastra/mcp@2.2.1-alpha.0

## 1.0.0

### Major Changes

- **Breaking:** Discovered MCP tools no longer require approval by default, matching `@mastra/mcp`'s own default. Opt into approval per integration with the new `requireApproval` option. ([#25740](https://github.com/mastra-ai/mastra/pull/25740))

  Previously, every MCP tool discovered through `connect()` was forced to require approval, with an `autoApproveTools` escape hatch to list specific keys that should skip it. The forced-approval policy made the typical case needlessly interactive and diverged from `@mastra/mcp`, whose default is "no approval unless the server definition opts in."

  The new `requireApproval` option replaces `autoApproveTools` and applies to generated HTTP toolsets as well as discovered MCP tools:

  - Omit (or pass `false`) → no approval required for any tool on this provider
  - `true` → every tool on this provider requires approval
  - `string[]` → approval required only for the listed tool keys

  Unknown names in the array fail resolution with an `invalid_options` error instead of silently dropping the provider, so a typo can neither widen access nor remove the toolset. A config that still contains the removed `autoApproveTools` key throws at `tools()` call time with a migration hint, so loosely typed configs cannot carry the dead option forward and run previously-gated tools without a prompt.

  If you relied on the old always-on default (for example, agents scaffolded from the connect templates), opt back in explicitly with `requireApproval: true` on the providers whose tools should prompt before running.

  **Migration**

  ```ts
  // Before: approval required by default, allowlist of tools that skip it
  connect({
    integrations: {
      neon: { autoApproveTools: ['neon_list_projects', 'neon_describe_project'] },
    },
  });

  // After (conservative): gate every tool on the provider. This preserves the
  // former approval policy, except the tools previously listed in
  // autoApproveTools now prompt too.
  connect({ integrations: { neon: { requireApproval: true } } });

  // After (targeted): gate only the listed tools. Not equivalent to the old
  // default; every tool missing from the list runs without a prompt, so list
  // every tool that must stay gated.
  connect({
    integrations: {
      neon: { requireApproval: ['neon_delete_project'] },
    },
  });
  ```

### Minor Changes

- Reworked the `@mastra/connect` API ahead of the first stable release. Breaking: the package has not shipped stable, so no deprecation period applies. ([#26084](https://github.com/mastra-ai/mastra/pull/26084))

  **Renamed `integrations` to `providers`**

  The option on `tools()` and `channels()` is now called `providers`, with types renamed to match (`ToolsProviderOptions`, `ChannelsProviders`, `ChannelsProviderOptions`).

  ```ts
  // Before
  const connectTools = tools({ integrations: { linear: { allowTools: ['linear_get_issue'] } } });

  // After
  const connectTools = tools({ providers: { linear: { allowTools: ['linear_get_issue'] } } });
  ```

  **Merge your own tools in a dynamic `tools` callback**

  Spread the resolver's result alongside local tools; your tools win on key collision.

  ```ts
  const agent = new Agent({
    // ...
    tools: async ctx => ({ ...(await connectTools(ctx)), weatherTool }),
  });
  ```

  A `.with()` convenience method also exists for the same merge (`tools: connectTools.with({ weatherTool })`); it accepts a static record or a (sync/async, optionally context-reading) function, and calls chain.

  **Simpler provider selection**

  The array form is now a real allowlist (only the listed providers resolve), and the record form accepts boolean shorthand:

  ```ts
  tools({ providers: ['linear', 'resend'] }); // only these resolve
  tools({ providers: { linear: true, github: false } }); // enable / exclude
  ```

  Unknown provider ids now fail with `invalid_options` instead of silently resolving nothing. `channels()` throws at call time; `tools()` checks ids against the platform catalog when it resolves tools, and if the catalog can't be reached it logs a warning and skips the id.

  In `channels()`, `slack` is accepted as an alias for the platform's `slack-channels` key, so the common spelling needs no quotes:

  ```ts
  channels({ providers: { slack: true, discord: true } });
  ```

  Both spellings configure the same channel; naming it twice throws.

  **Glob filters and top-level defaults**

  `allowTools`, `disallowTools`, and `requireApproval` accept `*` globs, and all three can be set at the top level of `tools()` as defaults for every provider. Per-provider options win, including `requireApproval: false` to opt out of a global policy.

  ```ts
  tools({
    requireApproval: ['*_delete_*', '*_send_*'],
    providers: { linear: { requireApproval: false } },
  });
  ```

  A per-provider glob that matches nothing fails like an unknown literal name, so typos never silently widen access.

  **Removed**

  - The deprecated `connect()` alias of `tools()`.
  - The `environment()` sandbox credential surface.
  - The `MASTRA_<PROVIDER>_CONNECTION_ID` env-var pin is no longer documented (it keeps working); pass `connectionId` per provider instead.
  - The `TOOLS` registry alias (use `PROVIDERS`) and the `findRegistration`/`findChannelRegistration` lookup helpers.
  - Internal toolset plumbing (`defineProxyTool`, `applyAllowTools`, `resolveConnectionId` and their types) is no longer exported.
  - The `disabled: true` per-provider field — use the `false` shorthand instead: `providers: { github: false }`.
  - The resolver `invalidate()` method — call `refresh()` to force a fetch now, or lower `ttlMs` to control freshness.

- Discord (channel **and** generated tools) now targets the platform's `discord` integration as a **single API-key connection** whose credential is the bot token, sourced from the encrypted `/credentials` endpoint on every call. The same connection powers both the channel and every generated tool from one credential. ([#25358](https://github.com/mastra-ai/mastra/pull/25358))

  **Why:** connection metadata is treated as non-secret by the platform, so a bot token stored there was readable by any caller with project access. Every Discord surface now reads the bot token from the platform's encrypted, audited credentials path.

  **Breaking:**

  - The 33 generated Discord tools no longer read the bot token from connection metadata; they call `getConnectionWithCredentials()` and use `credentials.apiKey`.
  - The `discord` integration on the platform is now API-key auth (Nango's `discord-bot` provider), not OAuth. OAuth-typed credentials on the channel are skipped with a warning — Discord rejects OAuth user tokens for bot authentication.

  **Migration:**

  1. Reconnect the `discord` integration on the platform against the new API-key auth flow (Nango's `discord-bot`) and paste the bot token when prompted. The token is now stored in the encrypted credential, not connection metadata.
  2. Remove any `botToken` you were still writing to connection metadata — it is no longer read and, since metadata is non-secret, it should not be left behind.

  Before:

  ```ts
  // Bot token was pulled from non-secret connection metadata.
  // Tools called `getMetadata<{ botToken: string }>()` internally.
  ```

  After:

  ```ts
  import { channels, tools } from '@mastra/connect';

  const projectId = 'proj_...';

  // Generated Discord tools — bot token now comes from the encrypted
  // `credentials.apiKey` on the `discord` connection.
  const toolResolver = tools({
    projectId,
    integrations: { discord: { connectionId: 'conn_...' } },
  });
  const discordTools = await toolResolver();

  // Discord channel — same `discord` connection, same credential.
  const channelResolver = await channels({
    projectId,
    integrations: {
      discord: { providerOptions: { commandScope: 'global' } },
    },
  });
  const providers = await channelResolver(); // providers.discord
  ```

- Improved error handling across all providers and updated the Clerk tools, verified by a new live end-to-end test suite that exercises every tool of all 26 checked-in providers. ([#25815](https://github.com/mastra-ai/mastra/pull/25815))

  **Clearer error messages** — errors returned as `{ errors: [{ message, long_message }] }` (Clerk, Linear, and other providers) now surface the human-readable message instead of a generic failure.

  **Fixed error recovery in generated tools** — `MastraConnectError` now also exposes its HTTP status as `error.response.status`. Generated tools check this field in their error handlers (for example the create-vs-update fallback in `github_create_or_update_file`), which previously never matched and failed instead of recovering.

  **Updated Clerk tools** (regenerated from the upstream template fix, NangoHQ/integration-templates#670):

  - `clerk_list_sessions` now requires `client_id` or `user_id` and no longer returns `total`.
  - `clerk_create_user` now requires at least one identifier (`email_address`, `phone_number`, or `username`).
  - `clerk_list_users` now returns an accurate `total`.

  ```ts
  // Before: accepted by the schema, then rejected by the Clerk API
  await toolset.clerk_list_sessions.execute({ status: 'active' });

  // After: the input schema requires a client or user filter
  await toolset.clerk_list_sessions.execute({ user_id: 'user_123', status: 'active' });
  ```

- Added Microsoft Teams to `channels()` and re-keyed the Slack channel from `slack` to `slack-channels`. ([#25332](https://github.com/mastra-ai/mastra/pull/25332))

  **Microsoft Teams**: projects with an active `microsoft-teams` platform connection now resolve a `TeamsProvider` automatically — no bot credentials in your code. Connecting an agent provisions a dedicated Teams bot for it through the platform connection. Requires `MASTRA_ENCRYPTION_KEY` (a 32-byte value, base64-encoded) in the server environment: the Teams install store persists each provisioned bot's client secret at rest, so `channels()` refuses to construct the Teams provider without it and skips the integration with a warning until a key is configured.

  **Breaking: Slack channel integration id renamed**. Use the `slack-channels` connection to hook the Slack channel up to agents; the existing `slack` connection continues to back the generated Slack **tools**. Two separate connections, one purpose each.

  If you pass per-integration overrides to `channels()`, migrate the key:

  ```diff
   channels: await channels({
     projectId: process.env.MASTRA_PROJECT_ID,
     integrations: {
  -    slack: { providerOptions: { defaultChannel: 'C123' } },
  +    'slack-channels': { providerOptions: { defaultChannel: 'C123' } },
     },
   }),
  ```

  ```typescript
  import { Mastra } from '@mastra/core/mastra';
  import { channels } from '@mastra/connect';

  const mastra = new Mastra({
    agents: { myAgent },
    channels: await channels({ projectId: process.env.MASTRA_PROJECT_ID }),
  });

  // With `microsoft-teams` and `slack-channels` connections active, both
  // channels resolve automatically and agents can be connected from Studio
  // or via the API. Teams additionally requires MASTRA_ENCRYPTION_KEY set
  // in the server environment.
  ```

- Connect tool calls now show up in traces. When observability is enabled, every platform API call and proxied vendor call appears as a child span under the tool call span, recording the method, a safe route template, connection id, and response status. Spans never include query strings, headers, bodies, or vendor path segments; apps without observability configured are unaffected. ([#26080](https://github.com/mastra-ai/mastra/pull/26080))

- Add Google Analytics (GA4) provider to `@mastra/connect` with 11 generated tools from the Nango integration-templates upstream: `archive-conversion-event`, `batch-run-reports`, `create-conversion-event`, `create-data-stream`, `create-property`, `get-metadata`, `run-pivot-report`, `run-realtime-report`, `run-report`, `update-data-stream`, and `update-property`. ([#25743](https://github.com/mastra-ai/mastra/pull/25743))

  Opt in by setting `MASTRA_GOOGLE_ANALYTICS_CONNECTION_ID` and selecting `google-analytics` in the `integrations` map.

### Patch Changes

- Fixed Jira issue creation so agents can discover project-specific issue types and their required fields. ([#26119](https://github.com/mastra-ai/mastra/pull/26119))

- `@mastra/connect` now requires `@mastra/core` 1.75.0 or later, matching the `@mastra/mcp` version it depends on. ([#25985](https://github.com/mastra-ai/mastra/pull/25985))

- Updated dependencies [[`b54fda3`](https://github.com/mastra-ai/mastra/commit/b54fda3f30330d65e52bf34802f0aa4035e30ef8), [`b0d2c38`](https://github.com/mastra-ai/mastra/commit/b0d2c387ec339229d878fdd9bbf6b6f87ec308b8), [`97644a7`](https://github.com/mastra-ai/mastra/commit/97644a78cafe8276026509c56a70108075e950b7), [`06e3dcf`](https://github.com/mastra-ai/mastra/commit/06e3dcf59aa937d8d5ab4de61b87465dfe38a62d), [`56eb894`](https://github.com/mastra-ai/mastra/commit/56eb894700575480c0e5d14a1ed7b633008610f2), [`79b3c78`](https://github.com/mastra-ai/mastra/commit/79b3c7875c511a718526020e3442bca433787199), [`6babc6d`](https://github.com/mastra-ai/mastra/commit/6babc6d526fc79c6633c796182de47a7a88d8bc1), [`8a5278a`](https://github.com/mastra-ai/mastra/commit/8a5278a8ab3fc6d4ae81073c7cef100954b4f0ef), [`d253891`](https://github.com/mastra-ai/mastra/commit/d2538914d2305d905bc9ed1dc7928b7f7ecc931a), [`7a50f76`](https://github.com/mastra-ai/mastra/commit/7a50f76900eb1488f755090651deae87b57cbab1), [`6cb981b`](https://github.com/mastra-ai/mastra/commit/6cb981bc62994e4c775864204617af70a7db3c4a), [`4cf860a`](https://github.com/mastra-ai/mastra/commit/4cf860a5a550a21fabce43010e6f1c95710e155c), [`e554c6d`](https://github.com/mastra-ai/mastra/commit/e554c6d7ff40805950f37a230ede4e2db82fc426), [`e5f53fe`](https://github.com/mastra-ai/mastra/commit/e5f53fe5965b22b274435bde05fd75f0b851e1e5), [`9c5fd7d`](https://github.com/mastra-ai/mastra/commit/9c5fd7dd5468d4b029d1015a711b328010a71484), [`af5086d`](https://github.com/mastra-ai/mastra/commit/af5086da68bd70cd263d9234684e7fa5c90fc61d), [`8a5278a`](https://github.com/mastra-ai/mastra/commit/8a5278a8ab3fc6d4ae81073c7cef100954b4f0ef), [`dac82ea`](https://github.com/mastra-ai/mastra/commit/dac82eaa324b66acad38d468799fa4e66594107f), [`3b03b05`](https://github.com/mastra-ai/mastra/commit/3b03b054281496e07201284f686b20b4dc2c51b1), [`06496a9`](https://github.com/mastra-ai/mastra/commit/06496a961baaa86178efe24be052107ea019d649), [`616ef0f`](https://github.com/mastra-ai/mastra/commit/616ef0fa482a7724f5e93609ab4f3960e3784a17), [`bcc2ceb`](https://github.com/mastra-ai/mastra/commit/bcc2ceb951d5259d09cde558dd6b86015b096d5c), [`9d4f647`](https://github.com/mastra-ai/mastra/commit/9d4f647c52ac5701f04ff320399d01b4cc2f0942), [`cdf0d0b`](https://github.com/mastra-ai/mastra/commit/cdf0d0bcad55398a2022bbf10fe921ca801d09ac), [`7736c40`](https://github.com/mastra-ai/mastra/commit/7736c40dedd54ce840f834f7de862e64895cd3a8), [`ce51958`](https://github.com/mastra-ai/mastra/commit/ce5195800c77c90141ee38684b4b163006dd56ff), [`b9c0fe5`](https://github.com/mastra-ai/mastra/commit/b9c0fe5e4cc4bc1758a7569837ae9e76a6e35839), [`bf982e9`](https://github.com/mastra-ai/mastra/commit/bf982e91512d5fb864984b44e649f104b7a9d7a4), [`da4eac9`](https://github.com/mastra-ai/mastra/commit/da4eac96c1856b81dd132183bccb3247de1d427f), [`832f57d`](https://github.com/mastra-ai/mastra/commit/832f57da36a03e5a90bf3ccc90e9df26ecf7d59d), [`97644a7`](https://github.com/mastra-ai/mastra/commit/97644a78cafe8276026509c56a70108075e950b7), [`ed8b01a`](https://github.com/mastra-ai/mastra/commit/ed8b01a81ebf018779571de5d9af63cdc61c5693), [`a3d23f9`](https://github.com/mastra-ai/mastra/commit/a3d23f9c2ea1283001b06dffd5015f798bf75d9d), [`757b1e4`](https://github.com/mastra-ai/mastra/commit/757b1e48e8645fd99551b0af9e8ce1b415f876ea), [`edf1ce6`](https://github.com/mastra-ai/mastra/commit/edf1ce69cc703f917cd2ee06488293a1f1d45597), [`824eb7f`](https://github.com/mastra-ai/mastra/commit/824eb7fef2eb3a52a63c59c2b879c7211294e5ae), [`648a4f3`](https://github.com/mastra-ai/mastra/commit/648a4f3ec442416816173e5fd64b97efd930df8d), [`539b958`](https://github.com/mastra-ai/mastra/commit/539b958da37c302f0b8bee5d9ce2b063c63ab09a), [`847a426`](https://github.com/mastra-ai/mastra/commit/847a426fc2158fdec7c939e576e8072c7998f2e3), [`01ac36b`](https://github.com/mastra-ai/mastra/commit/01ac36bf59295cf16d7a86c04f5776a4f1c98132), [`4c1bc9d`](https://github.com/mastra-ai/mastra/commit/4c1bc9d87fb5545b190e7e691331576781bffecf), [`f6fb6bc`](https://github.com/mastra-ai/mastra/commit/f6fb6bc2b0efadd6b744b6f73f07aa9800e5fc07), [`810b48d`](https://github.com/mastra-ai/mastra/commit/810b48dd77d992966a47ca5920e3c32267521b3a), [`7e63f04`](https://github.com/mastra-ai/mastra/commit/7e63f0486ea13841fc64395e3c03866afa476449), [`b0d2b33`](https://github.com/mastra-ai/mastra/commit/b0d2b336efd2a023a9f29218b442b386e42248f9), [`7a5c69e`](https://github.com/mastra-ai/mastra/commit/7a5c69e59d6f23b68c44887b15a674715e8c876f), [`53ef78f`](https://github.com/mastra-ai/mastra/commit/53ef78fa1314549de9e3ac8fd7bf57941112e316), [`9131d74`](https://github.com/mastra-ai/mastra/commit/9131d7459cfbd67037b7ea2515fcf22b60c213f3), [`196fd89`](https://github.com/mastra-ai/mastra/commit/196fd89df87b1675adcff0d4eeb1cd75965e40cb), [`b1a5896`](https://github.com/mastra-ai/mastra/commit/b1a5896196764500614cd435c48c6364a00e8726), [`0a37598`](https://github.com/mastra-ai/mastra/commit/0a375986869049865023d765337db427b6e27436), [`3acf1e3`](https://github.com/mastra-ai/mastra/commit/3acf1e36e26835caac9c22764bc87ee536ef5a62), [`7a046c6`](https://github.com/mastra-ai/mastra/commit/7a046c6a75c27d9859d695a59f6b3e8a96f6bfc8), [`9168424`](https://github.com/mastra-ai/mastra/commit/9168424453b5c0d793e0ddaa8066dceec60f619a), [`e1478fc`](https://github.com/mastra-ai/mastra/commit/e1478fc0cb9284f2e6fca7e582381c06749e2c06), [`6efbfad`](https://github.com/mastra-ai/mastra/commit/6efbfad1d763f54a2b346579d43a67ad0d92ce42), [`6cb981b`](https://github.com/mastra-ai/mastra/commit/6cb981bc62994e4c775864204617af70a7db3c4a), [`fb03761`](https://github.com/mastra-ai/mastra/commit/fb0376186c5fc8fc633c38d13a8dcc7c976318d8), [`1d94199`](https://github.com/mastra-ai/mastra/commit/1d94199fbb65d5acbcd0101bcbac96876e35cac4), [`018ae9d`](https://github.com/mastra-ai/mastra/commit/018ae9d2f4ebfd3bd6f267d0010171a546cb3abf), [`3e7a81b`](https://github.com/mastra-ai/mastra/commit/3e7a81b4e9b2c9de440b85b315a8297418afbaca), [`5054905`](https://github.com/mastra-ai/mastra/commit/5054905e5856fb8fe41c8d1b54859ad6e9169074), [`8fd2313`](https://github.com/mastra-ai/mastra/commit/8fd23138d68dd1b1b324a45db645c4968df45751), [`c3caa9a`](https://github.com/mastra-ai/mastra/commit/c3caa9a04cfa7652a9e5e214839285074eaa3f05), [`077dc71`](https://github.com/mastra-ai/mastra/commit/077dc7181a69bd473319ce1c48f7fd2fcdf95b97), [`8a5278a`](https://github.com/mastra-ai/mastra/commit/8a5278a8ab3fc6d4ae81073c7cef100954b4f0ef), [`718207d`](https://github.com/mastra-ai/mastra/commit/718207d5cc37d625bea6ff290fe25a949d3594f6), [`c498e24`](https://github.com/mastra-ai/mastra/commit/c498e249038d08a2e2fc31eed7ba4ca5e7fa1aa8), [`873b67e`](https://github.com/mastra-ai/mastra/commit/873b67e1e80e33cedf1809bf51f342cf7e9e654f), [`c96dab0`](https://github.com/mastra-ai/mastra/commit/c96dab05e69601667bc237ff2b27b9cb7d1f50c6), [`6a4f0bd`](https://github.com/mastra-ai/mastra/commit/6a4f0bd01016fba8d8dea5159a18c6a400237256), [`a4b2030`](https://github.com/mastra-ai/mastra/commit/a4b2030f6a1cb7123530f99d06f2b9e461e63932), [`2a48242`](https://github.com/mastra-ai/mastra/commit/2a48242a18f7444896bf8c7054fb59c0afae050e), [`07440af`](https://github.com/mastra-ai/mastra/commit/07440affa587b68f8348eb68e92fc1aa1817b61f), [`499f480`](https://github.com/mastra-ai/mastra/commit/499f480c86ba137356367e6b6281ba02b42d8169), [`bb57489`](https://github.com/mastra-ai/mastra/commit/bb5748958b6d404619884f7e04a0d7619fdebae7), [`045d583`](https://github.com/mastra-ai/mastra/commit/045d583852e55d0c1c518d2f5f9c33b48243cf7d), [`4ec3ccd`](https://github.com/mastra-ai/mastra/commit/4ec3ccde9924c27e7320f7bbe26c932731b7b4cd), [`3439cb2`](https://github.com/mastra-ai/mastra/commit/3439cb236f17bd248a326ff7f2c934cfb9974936), [`b8be029`](https://github.com/mastra-ai/mastra/commit/b8be0295bf88782f95702e65349a714d03a787d1)]:
  - @mastra/core@1.75.0
  - @mastra/mcp@2.2.0
  - @mastra/slack@1.7.2
  - @mastra/telegram@0.2.2
  - @mastra/teams@0.1.1
  - @mastra/discord@1.3.0

## 1.0.0-alpha.4

### Minor Changes

- Reworked the `@mastra/connect` API ahead of the first stable release. Breaking: the package has not shipped stable, so no deprecation period applies. ([#26084](https://github.com/mastra-ai/mastra/pull/26084))

  **Renamed `integrations` to `providers`**

  The option on `tools()` and `channels()` is now called `providers`, with types renamed to match (`ToolsProviderOptions`, `ChannelsProviders`, `ChannelsProviderOptions`).

  ```ts
  // Before
  const connectTools = tools({ integrations: { linear: { allowTools: ['linear_get_issue'] } } });

  // After
  const connectTools = tools({ providers: { linear: { allowTools: ['linear_get_issue'] } } });
  ```

  **Merge your own tools in a dynamic `tools` callback**

  Spread the resolver's result alongside local tools; your tools win on key collision.

  ```ts
  const agent = new Agent({
    // ...
    tools: async ctx => ({ ...(await connectTools(ctx)), weatherTool }),
  });
  ```

  A `.with()` convenience method also exists for the same merge (`tools: connectTools.with({ weatherTool })`); it accepts a static record or a (sync/async, optionally context-reading) function, and calls chain.

  **Simpler provider selection**

  The array form is now a real allowlist (only the listed providers resolve), and the record form accepts boolean shorthand:

  ```ts
  tools({ providers: ['linear', 'resend'] }); // only these resolve
  tools({ providers: { linear: true, github: false } }); // enable / exclude
  ```

  Unknown provider ids now fail with `invalid_options` instead of silently resolving nothing. `channels()` throws at call time; `tools()` checks ids against the platform catalog when it resolves tools, and if the catalog can't be reached it logs a warning and skips the id.

  In `channels()`, `slack` is accepted as an alias for the platform's `slack-channels` key, so the common spelling needs no quotes:

  ```ts
  channels({ providers: { slack: true, discord: true } });
  ```

  Both spellings configure the same channel; naming it twice throws.

  **Glob filters and top-level defaults**

  `allowTools`, `disallowTools`, and `requireApproval` accept `*` globs, and all three can be set at the top level of `tools()` as defaults for every provider. Per-provider options win, including `requireApproval: false` to opt out of a global policy.

  ```ts
  tools({
    requireApproval: ['*_delete_*', '*_send_*'],
    providers: { linear: { requireApproval: false } },
  });
  ```

  A per-provider glob that matches nothing fails like an unknown literal name, so typos never silently widen access.

  **Removed**

  - The deprecated `connect()` alias of `tools()`.
  - The `environment()` sandbox credential surface.
  - The `MASTRA_<PROVIDER>_CONNECTION_ID` env-var pin is no longer documented (it keeps working); pass `connectionId` per provider instead.
  - The `TOOLS` registry alias (use `PROVIDERS`) and the `findRegistration`/`findChannelRegistration` lookup helpers.
  - Internal toolset plumbing (`defineProxyTool`, `applyAllowTools`, `resolveConnectionId` and their types) is no longer exported.
  - The `disabled: true` per-provider field — use the `false` shorthand instead: `providers: { github: false }`.
  - The resolver `invalidate()` method — call `refresh()` to force a fetch now, or lower `ttlMs` to control freshness.

### Patch Changes

- Fixed Jira issue creation so agents can discover project-specific issue types and their required fields. ([#26119](https://github.com/mastra-ai/mastra/pull/26119))

- Updated dependencies [[`6babc6d`](https://github.com/mastra-ai/mastra/commit/6babc6d526fc79c6633c796182de47a7a88d8bc1), [`e554c6d`](https://github.com/mastra-ai/mastra/commit/e554c6d7ff40805950f37a230ede4e2db82fc426), [`7736c40`](https://github.com/mastra-ai/mastra/commit/7736c40dedd54ce840f834f7de862e64895cd3a8), [`bf982e9`](https://github.com/mastra-ai/mastra/commit/bf982e91512d5fb864984b44e649f104b7a9d7a4), [`da4eac9`](https://github.com/mastra-ai/mastra/commit/da4eac96c1856b81dd132183bccb3247de1d427f), [`539b958`](https://github.com/mastra-ai/mastra/commit/539b958da37c302f0b8bee5d9ce2b063c63ab09a), [`810b48d`](https://github.com/mastra-ai/mastra/commit/810b48dd77d992966a47ca5920e3c32267521b3a), [`7a5c69e`](https://github.com/mastra-ai/mastra/commit/7a5c69e59d6f23b68c44887b15a674715e8c876f), [`fb03761`](https://github.com/mastra-ai/mastra/commit/fb0376186c5fc8fc633c38d13a8dcc7c976318d8), [`6a4f0bd`](https://github.com/mastra-ai/mastra/commit/6a4f0bd01016fba8d8dea5159a18c6a400237256), [`07440af`](https://github.com/mastra-ai/mastra/commit/07440affa587b68f8348eb68e92fc1aa1817b61f), [`3439cb2`](https://github.com/mastra-ai/mastra/commit/3439cb236f17bd248a326ff7f2c934cfb9974936)]:
  - @mastra/slack@1.7.2-alpha.1
  - @mastra/telegram@0.2.2-alpha.1
  - @mastra/teams@0.1.1-alpha.0
  - @mastra/core@1.75.0-alpha.8

## 1.0.0-alpha.3

### Minor Changes

- Connect tool calls now show up in traces. When observability is enabled, every platform API call and proxied vendor call appears as a child span under the tool call span, recording the method, a safe route template, connection id, and response status. Spans never include query strings, headers, bodies, or vendor path segments; apps without observability configured are unaffected. ([#26080](https://github.com/mastra-ai/mastra/pull/26080))

### Patch Changes

- Updated dependencies [[`97644a7`](https://github.com/mastra-ai/mastra/commit/97644a78cafe8276026509c56a70108075e950b7), [`d253891`](https://github.com/mastra-ai/mastra/commit/d2538914d2305d905bc9ed1dc7928b7f7ecc931a), [`4cf860a`](https://github.com/mastra-ai/mastra/commit/4cf860a5a550a21fabce43010e6f1c95710e155c), [`af5086d`](https://github.com/mastra-ai/mastra/commit/af5086da68bd70cd263d9234684e7fa5c90fc61d), [`dac82ea`](https://github.com/mastra-ai/mastra/commit/dac82eaa324b66acad38d468799fa4e66594107f), [`97644a7`](https://github.com/mastra-ai/mastra/commit/97644a78cafe8276026509c56a70108075e950b7), [`0a37598`](https://github.com/mastra-ai/mastra/commit/0a375986869049865023d765337db427b6e27436), [`018ae9d`](https://github.com/mastra-ai/mastra/commit/018ae9d2f4ebfd3bd6f267d0010171a546cb3abf), [`c498e24`](https://github.com/mastra-ai/mastra/commit/c498e249038d08a2e2fc31eed7ba4ca5e7fa1aa8), [`045d583`](https://github.com/mastra-ai/mastra/commit/045d583852e55d0c1c518d2f5f9c33b48243cf7d)]:
  - @mastra/core@1.75.0-alpha.7
  - @mastra/mcp@2.2.0-alpha.2
  - @mastra/discord@1.3.0-alpha.1

## 1.0.0-alpha.2

### Major Changes

- **Breaking:** Discovered MCP tools no longer require approval by default, matching `@mastra/mcp`'s own default. Opt into approval per integration with the new `requireApproval` option. ([#25740](https://github.com/mastra-ai/mastra/pull/25740))

  Previously, every MCP tool discovered through `connect()` was forced to require approval, with an `autoApproveTools` escape hatch to list specific keys that should skip it. The forced-approval policy made the typical case needlessly interactive and diverged from `@mastra/mcp`, whose default is "no approval unless the server definition opts in."

  The new `requireApproval` option replaces `autoApproveTools` and applies to generated HTTP toolsets as well as discovered MCP tools:

  - Omit (or pass `false`) → no approval required for any tool on this provider
  - `true` → every tool on this provider requires approval
  - `string[]` → approval required only for the listed tool keys

  Unknown names in the array fail resolution with an `invalid_options` error instead of silently dropping the provider, so a typo can neither widen access nor remove the toolset. A config that still contains the removed `autoApproveTools` key throws at `tools()` call time with a migration hint, so loosely typed configs cannot carry the dead option forward and run previously-gated tools without a prompt.

  If you relied on the old always-on default (for example, agents scaffolded from the connect templates), opt back in explicitly with `requireApproval: true` on the providers whose tools should prompt before running.

  **Migration**

  ```ts
  // Before: approval required by default, allowlist of tools that skip it
  connect({
    integrations: {
      neon: { autoApproveTools: ['neon_list_projects', 'neon_describe_project'] },
    },
  });

  // After (conservative): gate every tool on the provider. This preserves the
  // former approval policy, except the tools previously listed in
  // autoApproveTools now prompt too.
  connect({ integrations: { neon: { requireApproval: true } } });

  // After (targeted): gate only the listed tools. Not equivalent to the old
  // default; every tool missing from the list runs without a prompt, so list
  // every tool that must stay gated.
  connect({
    integrations: {
      neon: { requireApproval: ['neon_delete_project'] },
    },
  });
  ```

### Minor Changes

- Improved error handling across all providers and updated the Clerk tools, verified by a new live end-to-end test suite that exercises every tool of all 26 checked-in providers. ([#25815](https://github.com/mastra-ai/mastra/pull/25815))

  **Clearer error messages** — errors returned as `{ errors: [{ message, long_message }] }` (Clerk, Linear, and other providers) now surface the human-readable message instead of a generic failure.

  **Fixed error recovery in generated tools** — `MastraConnectError` now also exposes its HTTP status as `error.response.status`. Generated tools check this field in their error handlers (for example the create-vs-update fallback in `github_create_or_update_file`), which previously never matched and failed instead of recovering.

  **Updated Clerk tools** (regenerated from the upstream template fix, NangoHQ/integration-templates#670):

  - `clerk_list_sessions` now requires `client_id` or `user_id` and no longer returns `total`.
  - `clerk_create_user` now requires at least one identifier (`email_address`, `phone_number`, or `username`).
  - `clerk_list_users` now returns an accurate `total`.

  ```ts
  // Before: accepted by the schema, then rejected by the Clerk API
  await toolset.clerk_list_sessions.execute({ status: 'active' });

  // After: the input schema requires a client or user filter
  await toolset.clerk_list_sessions.execute({ user_id: 'user_123', status: 'active' });
  ```

- Added Microsoft Teams to `channels()` and re-keyed the Slack channel from `slack` to `slack-channels`. ([#25332](https://github.com/mastra-ai/mastra/pull/25332))

  **Microsoft Teams**: projects with an active `microsoft-teams` platform connection now resolve a `TeamsProvider` automatically — no bot credentials in your code. Connecting an agent provisions a dedicated Teams bot for it through the platform connection. Requires `MASTRA_ENCRYPTION_KEY` (a 32-byte value, base64-encoded) in the server environment: the Teams install store persists each provisioned bot's client secret at rest, so `channels()` refuses to construct the Teams provider without it and skips the integration with a warning until a key is configured.

  **Breaking: Slack channel integration id renamed**. Use the `slack-channels` connection to hook the Slack channel up to agents; the existing `slack` connection continues to back the generated Slack **tools**. Two separate connections, one purpose each.

  If you pass per-integration overrides to `channels()`, migrate the key:

  ```diff
   channels: await channels({
     projectId: process.env.MASTRA_PROJECT_ID,
     integrations: {
  -    slack: { providerOptions: { defaultChannel: 'C123' } },
  +    'slack-channels': { providerOptions: { defaultChannel: 'C123' } },
     },
   }),
  ```

  ```typescript
  import { Mastra } from '@mastra/core/mastra';
  import { channels } from '@mastra/connect';

  const mastra = new Mastra({
    agents: { myAgent },
    channels: await channels({ projectId: process.env.MASTRA_PROJECT_ID }),
  });

  // With `microsoft-teams` and `slack-channels` connections active, both
  // channels resolve automatically and agents can be connected from Studio
  // or via the API. Teams additionally requires MASTRA_ENCRYPTION_KEY set
  // in the server environment.
  ```

### Patch Changes

- `@mastra/connect` now requires `@mastra/core` 1.75.0 or later, matching the `@mastra/mcp` version it depends on. ([#25985](https://github.com/mastra-ai/mastra/pull/25985))

- Updated dependencies [[`8a5278a`](https://github.com/mastra-ai/mastra/commit/8a5278a8ab3fc6d4ae81073c7cef100954b4f0ef), [`7a50f76`](https://github.com/mastra-ai/mastra/commit/7a50f76900eb1488f755090651deae87b57cbab1), [`6cb981b`](https://github.com/mastra-ai/mastra/commit/6cb981bc62994e4c775864204617af70a7db3c4a), [`8a5278a`](https://github.com/mastra-ai/mastra/commit/8a5278a8ab3fc6d4ae81073c7cef100954b4f0ef), [`616ef0f`](https://github.com/mastra-ai/mastra/commit/616ef0fa482a7724f5e93609ab4f3960e3784a17), [`9168424`](https://github.com/mastra-ai/mastra/commit/9168424453b5c0d793e0ddaa8066dceec60f619a), [`6cb981b`](https://github.com/mastra-ai/mastra/commit/6cb981bc62994e4c775864204617af70a7db3c4a), [`5054905`](https://github.com/mastra-ai/mastra/commit/5054905e5856fb8fe41c8d1b54859ad6e9169074), [`8a5278a`](https://github.com/mastra-ai/mastra/commit/8a5278a8ab3fc6d4ae81073c7cef100954b4f0ef), [`873b67e`](https://github.com/mastra-ai/mastra/commit/873b67e1e80e33cedf1809bf51f342cf7e9e654f), [`c96dab0`](https://github.com/mastra-ai/mastra/commit/c96dab05e69601667bc237ff2b27b9cb7d1f50c6)]:
  - @mastra/core@1.75.0-alpha.5
  - @mastra/discord@1.3.0-alpha.0
  - @mastra/mcp@2.2.0-alpha.1
  - @mastra/slack@1.7.2-alpha.0
  - @mastra/telegram@0.2.2-alpha.0

## 0.7.0-alpha.1

### Minor Changes

- Discord (channel **and** generated tools) now targets the platform's `discord` integration as a **single API-key connection** whose credential is the bot token, sourced from the encrypted `/credentials` endpoint on every call. The same connection powers both the channel and every generated tool from one credential. ([#25358](https://github.com/mastra-ai/mastra/pull/25358))

  **Why:** connection metadata is treated as non-secret by the platform, so a bot token stored there was readable by any caller with project access. Every Discord surface now reads the bot token from the platform's encrypted, audited credentials path.

  **Breaking:**

  - The 33 generated Discord tools no longer read the bot token from connection metadata; they call `getConnectionWithCredentials()` and use `credentials.apiKey`.
  - The `discord` integration on the platform is now API-key auth (Nango's `discord-bot` provider), not OAuth. OAuth-typed credentials on the channel are skipped with a warning — Discord rejects OAuth user tokens for bot authentication.

  **Migration:**

  1. Reconnect the `discord` integration on the platform against the new API-key auth flow (Nango's `discord-bot`) and paste the bot token when prompted. The token is now stored in the encrypted credential, not connection metadata.
  2. Remove any `botToken` you were still writing to connection metadata — it is no longer read and, since metadata is non-secret, it should not be left behind.

  Before:

  ```ts
  // Bot token was pulled from non-secret connection metadata.
  // Tools called `getMetadata<{ botToken: string }>()` internally.
  ```

  After:

  ```ts
  import { channels, tools } from '@mastra/connect';

  const projectId = 'proj_...';

  // Generated Discord tools — bot token now comes from the encrypted
  // `credentials.apiKey` on the `discord` connection.
  const toolResolver = tools({
    projectId,
    integrations: { discord: { connectionId: 'conn_...' } },
  });
  const discordTools = await toolResolver();

  // Discord channel — same `discord` connection, same credential.
  const channelResolver = await channels({
    projectId,
    integrations: {
      discord: { providerOptions: { commandScope: 'global' } },
    },
  });
  const providers = await channelResolver(); // providers.discord
  ```

### Patch Changes

- Updated dependencies [[`b0d2c38`](https://github.com/mastra-ai/mastra/commit/b0d2c387ec339229d878fdd9bbf6b6f87ec308b8), [`79b3c78`](https://github.com/mastra-ai/mastra/commit/79b3c7875c511a718526020e3442bca433787199), [`e5f53fe`](https://github.com/mastra-ai/mastra/commit/e5f53fe5965b22b274435bde05fd75f0b851e1e5), [`3b03b05`](https://github.com/mastra-ai/mastra/commit/3b03b054281496e07201284f686b20b4dc2c51b1), [`bcc2ceb`](https://github.com/mastra-ai/mastra/commit/bcc2ceb951d5259d09cde558dd6b86015b096d5c), [`832f57d`](https://github.com/mastra-ai/mastra/commit/832f57da36a03e5a90bf3ccc90e9df26ecf7d59d), [`edf1ce6`](https://github.com/mastra-ai/mastra/commit/edf1ce69cc703f917cd2ee06488293a1f1d45597), [`824eb7f`](https://github.com/mastra-ai/mastra/commit/824eb7fef2eb3a52a63c59c2b879c7211294e5ae), [`648a4f3`](https://github.com/mastra-ai/mastra/commit/648a4f3ec442416816173e5fd64b97efd930df8d), [`01ac36b`](https://github.com/mastra-ai/mastra/commit/01ac36bf59295cf16d7a86c04f5776a4f1c98132), [`4c1bc9d`](https://github.com/mastra-ai/mastra/commit/4c1bc9d87fb5545b190e7e691331576781bffecf), [`f6fb6bc`](https://github.com/mastra-ai/mastra/commit/f6fb6bc2b0efadd6b744b6f73f07aa9800e5fc07), [`b0d2b33`](https://github.com/mastra-ai/mastra/commit/b0d2b336efd2a023a9f29218b442b386e42248f9), [`196fd89`](https://github.com/mastra-ai/mastra/commit/196fd89df87b1675adcff0d4eeb1cd75965e40cb), [`3acf1e3`](https://github.com/mastra-ai/mastra/commit/3acf1e36e26835caac9c22764bc87ee536ef5a62), [`7a046c6`](https://github.com/mastra-ai/mastra/commit/7a046c6a75c27d9859d695a59f6b3e8a96f6bfc8), [`6efbfad`](https://github.com/mastra-ai/mastra/commit/6efbfad1d763f54a2b346579d43a67ad0d92ce42), [`1d94199`](https://github.com/mastra-ai/mastra/commit/1d94199fbb65d5acbcd0101bcbac96876e35cac4), [`3e7a81b`](https://github.com/mastra-ai/mastra/commit/3e7a81b4e9b2c9de440b85b315a8297418afbaca), [`a4b2030`](https://github.com/mastra-ai/mastra/commit/a4b2030f6a1cb7123530f99d06f2b9e461e63932), [`bb57489`](https://github.com/mastra-ai/mastra/commit/bb5748958b6d404619884f7e04a0d7619fdebae7), [`4ec3ccd`](https://github.com/mastra-ai/mastra/commit/4ec3ccde9924c27e7320f7bbe26c932731b7b4cd), [`b8be029`](https://github.com/mastra-ai/mastra/commit/b8be0295bf88782f95702e65349a714d03a787d1)]:
  - @mastra/core@1.75.0-alpha.2
  - @mastra/mcp@2.2.0-alpha.0

## 0.7.0-alpha.0

### Minor Changes

- Add Google Analytics (GA4) provider to `@mastra/connect` with 11 generated tools from the Nango integration-templates upstream: `archive-conversion-event`, `batch-run-reports`, `create-conversion-event`, `create-data-stream`, `create-property`, `get-metadata`, `run-pivot-report`, `run-realtime-report`, `run-report`, `update-data-stream`, and `update-property`. ([#25743](https://github.com/mastra-ai/mastra/pull/25743))

  Opt in by setting `MASTRA_GOOGLE_ANALYTICS_CONNECTION_ID` and selecting `google-analytics` in the `integrations` map.

### Patch Changes

- Updated dependencies [[`b54fda3`](https://github.com/mastra-ai/mastra/commit/b54fda3f30330d65e52bf34802f0aa4035e30ef8), [`06e3dcf`](https://github.com/mastra-ai/mastra/commit/06e3dcf59aa937d8d5ab4de61b87465dfe38a62d), [`06496a9`](https://github.com/mastra-ai/mastra/commit/06496a961baaa86178efe24be052107ea019d649), [`9d4f647`](https://github.com/mastra-ai/mastra/commit/9d4f647c52ac5701f04ff320399d01b4cc2f0942), [`b9c0fe5`](https://github.com/mastra-ai/mastra/commit/b9c0fe5e4cc4bc1758a7569837ae9e76a6e35839), [`847a426`](https://github.com/mastra-ai/mastra/commit/847a426fc2158fdec7c939e576e8072c7998f2e3), [`9131d74`](https://github.com/mastra-ai/mastra/commit/9131d7459cfbd67037b7ea2515fcf22b60c213f3), [`e1478fc`](https://github.com/mastra-ai/mastra/commit/e1478fc0cb9284f2e6fca7e582381c06749e2c06), [`077dc71`](https://github.com/mastra-ai/mastra/commit/077dc7181a69bd473319ce1c48f7fd2fcdf95b97), [`718207d`](https://github.com/mastra-ai/mastra/commit/718207d5cc37d625bea6ff290fe25a949d3594f6)]:
  - @mastra/core@1.75.0-alpha.0

## 0.6.0

### Minor Changes

- **Added Google Docs, Google Drive, and Google Sheets toolsets to @mastra/connect.** Agents connected through Mastra Cloud can now edit Google Docs (including PDF/DOCX/HTML/text export), manage Google Drive files, folders, permissions, and shared drives, and read and write Google Sheets, alongside the existing Gmail and Google Calendar toolsets. ([#25596](https://github.com/mastra-ai/mastra/pull/25596))

  **Added binary response support to the platform proxy.** Tool templates that need to fetch binary payloads (file exports, image downloads) can now pass `responseType: 'arraybuffer'` on a proxy request; the response body is returned as an `ArrayBuffer` instead of being parsed as JSON. This unlocks document-export tools such as Google Docs' `export-document`, and any future providers that ship binary-download actions.

### Patch Changes

- Provider errors that nest their message as `{ "error": { "message": "..." } }` (for example OpenAI) now include that message in the thrown error. A missing OpenAI batch now reports `Provider request failed (404): No such batch: batch_abc123` instead of `Provider request failed (404).` ([#25533](https://github.com/mastra-ai/mastra/pull/25533))

- Updated dependencies [[`bf8915a`](https://github.com/mastra-ai/mastra/commit/bf8915a00a4bc2cdacbbf94f6b9628cda5ad872c), [`42b8761`](https://github.com/mastra-ai/mastra/commit/42b8761d917453cfe9b0b189c51442a5398fbf27), [`c260e42`](https://github.com/mastra-ai/mastra/commit/c260e429ff30cc19859555985cacd5b70cfd63d9), [`2588009`](https://github.com/mastra-ai/mastra/commit/25880090300e3e5810057323ff22c743f090d315), [`9a30e77`](https://github.com/mastra-ai/mastra/commit/9a30e7768d3ac704e3940bae24b7aafc7eb6cf23), [`4e9f39b`](https://github.com/mastra-ai/mastra/commit/4e9f39b0be3b49e9df4586c08d4eec1b6ab5c37c), [`4228a4e`](https://github.com/mastra-ai/mastra/commit/4228a4e13b18f09b2c6281ebeec6ea76dbd9ba4d), [`c4c5397`](https://github.com/mastra-ai/mastra/commit/c4c539745afe736a4be0304784e3ec5d1a41f39b), [`9762b12`](https://github.com/mastra-ai/mastra/commit/9762b125c480ee8bdb887145f4044a69eb18e27f), [`c1a0491`](https://github.com/mastra-ai/mastra/commit/c1a049108588b49eff57461c4f294c9459397933), [`8cf6a36`](https://github.com/mastra-ai/mastra/commit/8cf6a364f74ae7d2807689519735974dc7e527b6), [`279d4a7`](https://github.com/mastra-ai/mastra/commit/279d4a7acba086eac37f49471ed30734eecec490), [`dbeb617`](https://github.com/mastra-ai/mastra/commit/dbeb617af5e3f7150ab412ea03f85d6869d49537), [`2302827`](https://github.com/mastra-ai/mastra/commit/2302827442eb5eb7d7039c70b61165b85a401c3b), [`bc826e8`](https://github.com/mastra-ai/mastra/commit/bc826e8fb1c0d0311b4675fcfcf5c4f6bc43efe6), [`3da569c`](https://github.com/mastra-ai/mastra/commit/3da569c2032b3ec32a818f47f942151926c8fd6a), [`23da871`](https://github.com/mastra-ai/mastra/commit/23da871c62bee9a4628d64afe8f3a154b8c7322b), [`c4b52a2`](https://github.com/mastra-ai/mastra/commit/c4b52a20b533b92cab1a0478e8bab66231cefb86), [`63b8630`](https://github.com/mastra-ai/mastra/commit/63b8630cf4f7f3b330c872a21ae0cfedf0b4978a), [`c3b3801`](https://github.com/mastra-ai/mastra/commit/c3b38019e60d41c4ef8cae328523e461dd45ea71), [`df91bae`](https://github.com/mastra-ai/mastra/commit/df91bae13d880242f755031cc4bcfbe2d3102c06), [`2f8cb4d`](https://github.com/mastra-ai/mastra/commit/2f8cb4d7237372a7dff899bf3b4cbf4060b007db), [`e8f60c7`](https://github.com/mastra-ai/mastra/commit/e8f60c762a8335071418aaf04db4363ac0120e3a), [`c260e42`](https://github.com/mastra-ai/mastra/commit/c260e429ff30cc19859555985cacd5b70cfd63d9), [`9d304f4`](https://github.com/mastra-ai/mastra/commit/9d304f452c761403a726a9a518d6678019af23ca), [`e9276f4`](https://github.com/mastra-ai/mastra/commit/e9276f45c6c1a222890334209d24e8917e4f6ad1), [`fab9ba1`](https://github.com/mastra-ai/mastra/commit/fab9ba1687199a8284ea51034d049fcd232fb7dd), [`8acf89f`](https://github.com/mastra-ai/mastra/commit/8acf89ff090ab4666de8fa1452239fbd4080b216), [`0b9e7bc`](https://github.com/mastra-ai/mastra/commit/0b9e7bc0839bcec59f9eaa014c759ae935454c45), [`270e05f`](https://github.com/mastra-ai/mastra/commit/270e05fec0ec934c564527e33d0f51768712ad79), [`beb81b1`](https://github.com/mastra-ai/mastra/commit/beb81b1b01740c79895049187dc96008723dab92), [`bc826e8`](https://github.com/mastra-ai/mastra/commit/bc826e8fb1c0d0311b4675fcfcf5c4f6bc43efe6), [`bc826e8`](https://github.com/mastra-ai/mastra/commit/bc826e8fb1c0d0311b4675fcfcf5c4f6bc43efe6), [`53a5c68`](https://github.com/mastra-ai/mastra/commit/53a5c68a20b2b38351120abe634b351630c1f41e), [`961c668`](https://github.com/mastra-ai/mastra/commit/961c6684ae23bfe1e014d14b9def61e9518fcdf0), [`ab42292`](https://github.com/mastra-ai/mastra/commit/ab42292369c62b847ae4039e4dcf07b0a1116966), [`bc826e8`](https://github.com/mastra-ai/mastra/commit/bc826e8fb1c0d0311b4675fcfcf5c4f6bc43efe6), [`5d8b27d`](https://github.com/mastra-ai/mastra/commit/5d8b27df7306759b7d065f8a968d4e250ceae7d4), [`9762b12`](https://github.com/mastra-ai/mastra/commit/9762b125c480ee8bdb887145f4044a69eb18e27f), [`0718aac`](https://github.com/mastra-ai/mastra/commit/0718aaccc12d5cc86b65088c329c56251a645dcc), [`d7c35a2`](https://github.com/mastra-ai/mastra/commit/d7c35a2fc17d692c4397c59d34f7cdbe4398cc3f), [`cdaf888`](https://github.com/mastra-ai/mastra/commit/cdaf88896503e3fe04465754a8a0a469ceb9d360)]:
  - @mastra/core@1.73.0
  - @mastra/telegram@0.2.1
  - @mastra/slack@1.7.1
  - @mastra/discord@1.2.1
  - @mastra/mcp@2.1.2

## 0.6.0-alpha.1

### Minor Changes

- **Added Google Docs, Google Drive, and Google Sheets toolsets to @mastra/connect.** Agents connected through Mastra Cloud can now edit Google Docs (including PDF/DOCX/HTML/text export), manage Google Drive files, folders, permissions, and shared drives, and read and write Google Sheets, alongside the existing Gmail and Google Calendar toolsets. ([#25596](https://github.com/mastra-ai/mastra/pull/25596))

  **Added binary response support to the platform proxy.** Tool templates that need to fetch binary payloads (file exports, image downloads) can now pass `responseType: 'arraybuffer'` on a proxy request; the response body is returned as an `ArrayBuffer` instead of being parsed as JSON. This unlocks document-export tools such as Google Docs' `export-document`, and any future providers that ship binary-download actions.

### Patch Changes

- Updated dependencies [[`bf8915a`](https://github.com/mastra-ai/mastra/commit/bf8915a00a4bc2cdacbbf94f6b9628cda5ad872c), [`2588009`](https://github.com/mastra-ai/mastra/commit/25880090300e3e5810057323ff22c743f090d315), [`4228a4e`](https://github.com/mastra-ai/mastra/commit/4228a4e13b18f09b2c6281ebeec6ea76dbd9ba4d), [`c4c5397`](https://github.com/mastra-ai/mastra/commit/c4c539745afe736a4be0304784e3ec5d1a41f39b), [`c1a0491`](https://github.com/mastra-ai/mastra/commit/c1a049108588b49eff57461c4f294c9459397933), [`8cf6a36`](https://github.com/mastra-ai/mastra/commit/8cf6a364f74ae7d2807689519735974dc7e527b6), [`dbeb617`](https://github.com/mastra-ai/mastra/commit/dbeb617af5e3f7150ab412ea03f85d6869d49537), [`2302827`](https://github.com/mastra-ai/mastra/commit/2302827442eb5eb7d7039c70b61165b85a401c3b), [`23da871`](https://github.com/mastra-ai/mastra/commit/23da871c62bee9a4628d64afe8f3a154b8c7322b), [`c3b3801`](https://github.com/mastra-ai/mastra/commit/c3b38019e60d41c4ef8cae328523e461dd45ea71), [`df91bae`](https://github.com/mastra-ai/mastra/commit/df91bae13d880242f755031cc4bcfbe2d3102c06), [`e8f60c7`](https://github.com/mastra-ai/mastra/commit/e8f60c762a8335071418aaf04db4363ac0120e3a), [`fab9ba1`](https://github.com/mastra-ai/mastra/commit/fab9ba1687199a8284ea51034d049fcd232fb7dd), [`8acf89f`](https://github.com/mastra-ai/mastra/commit/8acf89ff090ab4666de8fa1452239fbd4080b216), [`beb81b1`](https://github.com/mastra-ai/mastra/commit/beb81b1b01740c79895049187dc96008723dab92), [`53a5c68`](https://github.com/mastra-ai/mastra/commit/53a5c68a20b2b38351120abe634b351630c1f41e), [`961c668`](https://github.com/mastra-ai/mastra/commit/961c6684ae23bfe1e014d14b9def61e9518fcdf0), [`0718aac`](https://github.com/mastra-ai/mastra/commit/0718aaccc12d5cc86b65088c329c56251a645dcc), [`d7c35a2`](https://github.com/mastra-ai/mastra/commit/d7c35a2fc17d692c4397c59d34f7cdbe4398cc3f), [`cdaf888`](https://github.com/mastra-ai/mastra/commit/cdaf88896503e3fe04465754a8a0a469ceb9d360)]:
  - @mastra/core@1.73.0-alpha.1
  - @mastra/slack@1.7.1-alpha.1
  - @mastra/telegram@0.2.1-alpha.1

## 0.5.1-alpha.0

### Patch Changes

- Provider errors that nest their message as `{ "error": { "message": "..." } }` (for example OpenAI) now include that message in the thrown error. A missing OpenAI batch now reports `Provider request failed (404): No such batch: batch_abc123` instead of `Provider request failed (404).` ([#25533](https://github.com/mastra-ai/mastra/pull/25533))

- Updated dependencies [[`42b8761`](https://github.com/mastra-ai/mastra/commit/42b8761d917453cfe9b0b189c51442a5398fbf27), [`c260e42`](https://github.com/mastra-ai/mastra/commit/c260e429ff30cc19859555985cacd5b70cfd63d9), [`9a30e77`](https://github.com/mastra-ai/mastra/commit/9a30e7768d3ac704e3940bae24b7aafc7eb6cf23), [`4e9f39b`](https://github.com/mastra-ai/mastra/commit/4e9f39b0be3b49e9df4586c08d4eec1b6ab5c37c), [`9762b12`](https://github.com/mastra-ai/mastra/commit/9762b125c480ee8bdb887145f4044a69eb18e27f), [`279d4a7`](https://github.com/mastra-ai/mastra/commit/279d4a7acba086eac37f49471ed30734eecec490), [`bc826e8`](https://github.com/mastra-ai/mastra/commit/bc826e8fb1c0d0311b4675fcfcf5c4f6bc43efe6), [`3da569c`](https://github.com/mastra-ai/mastra/commit/3da569c2032b3ec32a818f47f942151926c8fd6a), [`c4b52a2`](https://github.com/mastra-ai/mastra/commit/c4b52a20b533b92cab1a0478e8bab66231cefb86), [`63b8630`](https://github.com/mastra-ai/mastra/commit/63b8630cf4f7f3b330c872a21ae0cfedf0b4978a), [`2f8cb4d`](https://github.com/mastra-ai/mastra/commit/2f8cb4d7237372a7dff899bf3b4cbf4060b007db), [`c260e42`](https://github.com/mastra-ai/mastra/commit/c260e429ff30cc19859555985cacd5b70cfd63d9), [`9d304f4`](https://github.com/mastra-ai/mastra/commit/9d304f452c761403a726a9a518d6678019af23ca), [`e9276f4`](https://github.com/mastra-ai/mastra/commit/e9276f45c6c1a222890334209d24e8917e4f6ad1), [`0b9e7bc`](https://github.com/mastra-ai/mastra/commit/0b9e7bc0839bcec59f9eaa014c759ae935454c45), [`270e05f`](https://github.com/mastra-ai/mastra/commit/270e05fec0ec934c564527e33d0f51768712ad79), [`bc826e8`](https://github.com/mastra-ai/mastra/commit/bc826e8fb1c0d0311b4675fcfcf5c4f6bc43efe6), [`bc826e8`](https://github.com/mastra-ai/mastra/commit/bc826e8fb1c0d0311b4675fcfcf5c4f6bc43efe6), [`ab42292`](https://github.com/mastra-ai/mastra/commit/ab42292369c62b847ae4039e4dcf07b0a1116966), [`bc826e8`](https://github.com/mastra-ai/mastra/commit/bc826e8fb1c0d0311b4675fcfcf5c4f6bc43efe6), [`5d8b27d`](https://github.com/mastra-ai/mastra/commit/5d8b27df7306759b7d065f8a968d4e250ceae7d4), [`9762b12`](https://github.com/mastra-ai/mastra/commit/9762b125c480ee8bdb887145f4044a69eb18e27f)]:
  - @mastra/core@1.73.0-alpha.0
  - @mastra/telegram@0.2.1-alpha.0
  - @mastra/slack@1.7.1-alpha.0
  - @mastra/discord@1.2.1-alpha.0
  - @mastra/mcp@2.1.2-alpha.0

## 0.5.0

### Minor Changes

- Added multi-connection support and a string-array shorthand to `@mastra/connect`. ([#24864](https://github.com/mastra-ai/mastra/pull/24864))

  **Multi-connection support:** when a provider has more than one active connection, tools are wrapped with a required `connection_name` input and a new `<provider>__list_connections` tool is exposed so agents can discover and select which connection to use. Single-connection behavior and explicit `connectionId` pins are unchanged. The wrapper preserves each inner tool's approval contract (`requireApproval` and, when the MCP server-level policy is a function, `needsApprovalFn`) so approval prompts still fire for multi-connection MCP tools; missing or unknown `connection_name` fails closed and requires approval.

  The helper key uses a double underscore (`<integrationId>__list_connections`) so it cannot collide with a real provider tool of the form `<integrationId>_<toolName>` (for example, WorkOS ships a real `workos_list_connections` tool that lists SSO connections).

  Previously, multi-active provider connections were skipped with a warning.

  ```ts
  // connect() returns a resolver; call it to load tools.
  const tools = await connect({ integrations: ['linear'] })();

  // Agent lists available connections.
  await tools.linear__list_connections.execute({}, {});
  // => { connections: [
  //      { name: 'Work', accountLabel: 'Work' },
  //      { name: 'Personal', accountLabel: 'Personal' },
  //    ] }

  // Agent calls tools with the chosen connection.
  await tools.linear_get_issue.execute({ connection_name: 'Work', id: 'LIN-123' }, {});
  ```

  **String-array shorthand for `integrations`:** you can now pass a plain array of integration ids when no per-provider overrides are needed. The object form still works whenever you need `allowTools`, `disallowTools`, `autoApproveTools`, `connectionId`, or `disabled`.

  ```ts
  // Shorthand
  connect({ integrations: ['linear', 'github'] });

  // Object form (unchanged)
  connect({
    integrations: {
      linear: { allowTools: ['linear_get_issue'] },
      github: {},
    },
  });
  ```

  **`disallowTools` per provider:** each provider now accepts either `allowTools` or `disallowTools` — `ConnectIntegrationOptions` is a mutually exclusive union, so setting both is a compile-time and runtime error. Use `disallowTools` when you want the whole toolset minus a few keys instead of an explicit allowlist.

  ```ts
  connect({
    integrations: {
      // Everything except the delete tool
      linear: { disallowTools: ['linear_delete_issue'] },
      // Explicit allowlist still works
      github: { allowTools: ['github_get_repo'] },
    },
  });
  ```

- `channels()` now returns a live channel resolver instead of a fixed provider map. Channel connections created or removed on the Mastra platform are picked up by a running server automatically — no redeploy needed. ([#25149](https://github.com/mastra-ai/mastra/pull/25149))

  ```typescript
  import { Mastra } from '@mastra/core/mastra';
  import { channels } from '@mastra/connect';

  export const mastra = new Mastra({
    channels: await channels({ projectId: 'my-project' }),
  });
  ```

  The resolver keeps one provider instance per integration, refreshes platform connections on a configurable `ttlMs` cache (30 seconds by default), and re-applies credentials when a connection changes. Slack credentials are fetched fresh from the platform before each app-management call, so tokens refreshed by the platform are always honored.

  If you previously awaited `channels()` and read providers off the result as a plain object, call the resolver instead: `const providers = await resolver()`.

  Requires `@mastra/core` 1.72.0 or later — the first release whose `Mastra` constructor accepts a `ChannelsResolver` (the peer dependency range has been raised to match). Older cores treat the resolver as a static provider record and fail at construction.

- Added 25 Microsoft Teams tools. Areas covered: ([#25361](https://github.com/mastra-ai/mastra/pull/25361))

  - **Teams** — create, get, list joined teams, list members, add and remove members
  - **Channels** — create, get, list, update, delete
  - **Channel messages** — send, get, list, reply, list replies
  - **Channel tabs** — create, list
  - **Chats** — create, get, list, send messages, get message, list messages, list members

  One `microsoft-teams` connection powers both these tools and the Teams channel — no extra bot token or app registration to wire up.

  ```ts
  import { createMicrosoftTeamsTools } from '@mastra/connect';

  const tools = createMicrosoftTeamsTools({ connectionId: 'conn_...' });
  ```

- `@mastra/slack`, `@mastra/telegram`, and `@mastra/discord` are now direct dependencies of `@mastra/connect`. Installing `@mastra/connect` is enough to use any channel with `channels()` — no separate channel package installs required. ([#25125](https://github.com/mastra-ai/mastra/pull/25125))

### Patch Changes

- Fixed Discord channel connections failing with `Discord rejected the bot token: 401: Unauthorized`. The Discord bot token is now read from the connection's metadata (`botToken`, following Nango's Discord convention) instead of the OAuth credential — Discord's OAuth exchange only yields a user Bearer token, which can never authenticate as a bot. A Discord connection without `botToken` metadata is skipped with a warning telling you to store the token on the connection. ([#25260](https://github.com/mastra-ai/mastra/pull/25260))

- Discord channel connections no longer require `applicationId` and `publicKey` on the platform connection. The bot token stored as the connection credential is enough — the provider resolves the rest from Discord automatically — so the "missing applicationId + publicKey" warning is gone. Connection metadata and `providerOptions` still work as explicit overrides. ([#25125](https://github.com/mastra-ai/mastra/pull/25125))

- Telegram channels now run in delegated credential mode: the provider receives a platform-backed `tokenResolver` instead of a static bot token, so a token re-pasted or rotated on the platform takes effect on the very next Bot API call without a snapshot refresh, and the bot token is never persisted in provider storage. ([#25272](https://github.com/mastra-ai/mastra/pull/25272))

  ```ts
  import { channels } from '@mastra/connect';

  // Telegram is wired automatically — the resolver reads the current
  // connection's api-key credential per Bot API call. No app-side config.
  const registrations = await channels({ projectId: process.env.MASTRA_PROJECT_ID! });
  ```

- Fixed Slack channel connections that failed with "Slack refresh token is invalid" when connecting an agent. The Mastra platform now manages the Slack credential refresh cycle, so `channels()` no longer competes with it over the single-use refresh token. ([#25125](https://github.com/mastra-ai/mastra/pull/25125))

- Updated dependencies [[`9ce3444`](https://github.com/mastra-ai/mastra/commit/9ce3444d1a6b17e72b0a20c74603abaf252a843e), [`af4aed5`](https://github.com/mastra-ai/mastra/commit/af4aed50ad96b340d82a67c3f01cbf358b156ab2), [`43fbe75`](https://github.com/mastra-ai/mastra/commit/43fbe75535650345cf61dee00cf3e7b3f5efaf7f), [`e1c3193`](https://github.com/mastra-ai/mastra/commit/e1c3193b18ca68e5cca27f7dce9b0381a6e7b95d), [`4375206`](https://github.com/mastra-ai/mastra/commit/4375206131ff701405a20326be660b2e8c3742f8), [`4601dfa`](https://github.com/mastra-ai/mastra/commit/4601dfac7c2bfdf04f041b1725c8ac4ae92a8d7d), [`77c6f1c`](https://github.com/mastra-ai/mastra/commit/77c6f1cf14ba9ba47257829646a4569c4462d12f), [`9773cb2`](https://github.com/mastra-ai/mastra/commit/9773cb2f22f307c8017f887af4a6728c4cb875c9), [`3d25340`](https://github.com/mastra-ai/mastra/commit/3d2534080417711d1baf2ad947d1205ca95a34cd), [`3b77788`](https://github.com/mastra-ai/mastra/commit/3b77788a08df1e754282d39c42823e6e1c5f2742), [`c3bc77c`](https://github.com/mastra-ai/mastra/commit/c3bc77ca9e1e665d9e0ad2bfd15a88ad71461f12), [`ebd03fd`](https://github.com/mastra-ai/mastra/commit/ebd03fd3bc93fe3930747956724252f7c8834826), [`63927e8`](https://github.com/mastra-ai/mastra/commit/63927e89c1b9db0fc87eef8503e3a03204f24b09), [`68cc668`](https://github.com/mastra-ai/mastra/commit/68cc66800e5ce6f5d62189fc7b5ef9d71cf80971), [`987257a`](https://github.com/mastra-ai/mastra/commit/987257a34cda8a153fe592c31d75fbb1dee55202), [`65a93a2`](https://github.com/mastra-ai/mastra/commit/65a93a2a3b1434d605a6a417cb83d2d58e16bfc0), [`fd92729`](https://github.com/mastra-ai/mastra/commit/fd92729380a29f2a0ec822e39f3c09eb9aaa5ac5), [`c3bc77c`](https://github.com/mastra-ai/mastra/commit/c3bc77ca9e1e665d9e0ad2bfd15a88ad71461f12), [`68cc668`](https://github.com/mastra-ai/mastra/commit/68cc66800e5ce6f5d62189fc7b5ef9d71cf80971), [`5e799d9`](https://github.com/mastra-ai/mastra/commit/5e799d9098c5c4d1078bf90647e95db699be11ea), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`afc53be`](https://github.com/mastra-ai/mastra/commit/afc53be4c95e83e8613f4e080b5a1926e63c5da6), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`2c57ba8`](https://github.com/mastra-ai/mastra/commit/2c57ba896b04215fface2a8216b88fe59cfdd041), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`93fe2d6`](https://github.com/mastra-ai/mastra/commit/93fe2d6a9e47861d90cc0fd0080aefdb8cabb612), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`781762b`](https://github.com/mastra-ai/mastra/commit/781762b2dcd0c8cc7f9b8ab73824ec45a5225db7), [`4d187b7`](https://github.com/mastra-ai/mastra/commit/4d187b79d7ecce4d2f357f5fe385b414a532ff19), [`cc0da13`](https://github.com/mastra-ai/mastra/commit/cc0da13b826d5f74213c4d8c470acf8698542249), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`2a28888`](https://github.com/mastra-ai/mastra/commit/2a28888f7dfee74f84ec548c9c222cfd1aa7f393), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`f6effda`](https://github.com/mastra-ai/mastra/commit/f6effdabafa9fc6388478b3e281ad4c457d4200b), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`ec005d5`](https://github.com/mastra-ai/mastra/commit/ec005d517ea10b7742e67f7e75bf89259d72c37e), [`f2c3f8c`](https://github.com/mastra-ai/mastra/commit/f2c3f8c74e1d7bc7baca5303b36320b0b361775c), [`ed67acc`](https://github.com/mastra-ai/mastra/commit/ed67acc3213d469ed69610c304c604693cfec383), [`0c23429`](https://github.com/mastra-ai/mastra/commit/0c23429515b5c307e8a5759f5be1ce20d09d2347), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`b33985e`](https://github.com/mastra-ai/mastra/commit/b33985eac3e019f58d3785c48ef85eae48b4e068), [`c64bf75`](https://github.com/mastra-ai/mastra/commit/c64bf752dec931f5f6c8b3d5afc91a8b9aa670d8), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`79c3b1f`](https://github.com/mastra-ai/mastra/commit/79c3b1fa4d470585a00558b317ed47db9b1decd4), [`4092ef2`](https://github.com/mastra-ai/mastra/commit/4092ef29aad09f2ba5f90c92a4d4d3bd444eae67), [`5f1efad`](https://github.com/mastra-ai/mastra/commit/5f1efad5c2230a4de715cad3f01859b4ff9d255b), [`32d71df`](https://github.com/mastra-ai/mastra/commit/32d71df2ce71573b40f9a62b8ac510ad6eadd859), [`7f4ce21`](https://github.com/mastra-ai/mastra/commit/7f4ce2190029710851d95f7b75a2fb724782483c), [`e62e372`](https://github.com/mastra-ai/mastra/commit/e62e3721356955f0a9fd3d723cee9fa0c160652b), [`4b5b212`](https://github.com/mastra-ai/mastra/commit/4b5b212f1c5caa40a2d02308806bbe610f194503), [`75c2ee1`](https://github.com/mastra-ai/mastra/commit/75c2ee1280a5441eb66c31f23a53a52b42244686), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`1fe1c2b`](https://github.com/mastra-ai/mastra/commit/1fe1c2b6f0b29481dca62a9199af751d594e3ea6), [`d3a7dba`](https://github.com/mastra-ai/mastra/commit/d3a7dbaeb0d027e1e47e4e4ddb2ede271a007e17), [`561e2a6`](https://github.com/mastra-ai/mastra/commit/561e2a6c8a44dbfd91eae390e14671462497cf85), [`64916c6`](https://github.com/mastra-ai/mastra/commit/64916c66e8d9dec107da2f81e7c1301471bf7bc3), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`444debd`](https://github.com/mastra-ai/mastra/commit/444debd7104ada74fa15d0e70703ee9be180fc75), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`1ba1588`](https://github.com/mastra-ai/mastra/commit/1ba158873dadf3d290b111981c3bc7ef95ab1d1c), [`9a35897`](https://github.com/mastra-ai/mastra/commit/9a3589783a40157759f939f5c63bba3c8aef1c1c), [`9997948`](https://github.com/mastra-ai/mastra/commit/99979482956903a2cd685b31f53370dd33074799), [`279a736`](https://github.com/mastra-ai/mastra/commit/279a736c62495cac0f247ab1402a8c80bccc892a), [`d3a22a7`](https://github.com/mastra-ai/mastra/commit/d3a22a78f12e094118ce80ec35b63987009644e2), [`56fef1c`](https://github.com/mastra-ai/mastra/commit/56fef1cdd92a671c3de2cc5e4a319c637f700cf4), [`8156816`](https://github.com/mastra-ai/mastra/commit/815681621dd88997608c5b7e8f0f87fe03cd1d18), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`4d40bd9`](https://github.com/mastra-ai/mastra/commit/4d40bd91ccb00db163365a319b5d82bfb56a9ace), [`5e799d9`](https://github.com/mastra-ai/mastra/commit/5e799d9098c5c4d1078bf90647e95db699be11ea), [`94ba70e`](https://github.com/mastra-ai/mastra/commit/94ba70ea6ba8a53f5e4010392bf3bbaecde7966d), [`d2f0cd7`](https://github.com/mastra-ai/mastra/commit/d2f0cd7c5d5f5f06cf5b65cf78a9f14ac052dbb1), [`6946c4d`](https://github.com/mastra-ai/mastra/commit/6946c4db91071cb43fb36514a42a1e4ce05c37ba), [`e4e0f90`](https://github.com/mastra-ai/mastra/commit/e4e0f9000d73396609ae2f2b6c31259ade43078c), [`7540eb1`](https://github.com/mastra-ai/mastra/commit/7540eb176c32ffbff45ccc64a8d8fce82ce42a94), [`c01f1ad`](https://github.com/mastra-ai/mastra/commit/c01f1ad358db0ab361fdb1b2f4f77c88540c2671), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`b537ab1`](https://github.com/mastra-ai/mastra/commit/b537ab14714870e058775530bc55b37c9115613f), [`a7895fc`](https://github.com/mastra-ai/mastra/commit/a7895fce693e499c08c4784c57d4c4f46c0e1ccb), [`d8fcd39`](https://github.com/mastra-ai/mastra/commit/d8fcd397230a83f5fe9ef16e6b41237f057c2c29), [`5197f81`](https://github.com/mastra-ai/mastra/commit/5197f81d6a5641f80f0ee6596ac085653b38cca3), [`1eccabc`](https://github.com/mastra-ai/mastra/commit/1eccabc1b95daec65ed84f1179157b1ca0305448), [`caf94f9`](https://github.com/mastra-ai/mastra/commit/caf94f9c1927f737370b6118264bd16c7210a765), [`9623397`](https://github.com/mastra-ai/mastra/commit/96233975b75135852c9b1616b91fd8cb54c77a53), [`5036e61`](https://github.com/mastra-ai/mastra/commit/5036e6179bee4105ad8f1fc57d315f78024565f4), [`4375206`](https://github.com/mastra-ai/mastra/commit/4375206131ff701405a20326be660b2e8c3742f8), [`676fcbf`](https://github.com/mastra-ai/mastra/commit/676fcbfc5f770ee45560c7b558b17ad5ff25d9e7), [`6c9f7ab`](https://github.com/mastra-ai/mastra/commit/6c9f7abf9bdce0a52450398b31d497519465bb80), [`d9790fd`](https://github.com/mastra-ai/mastra/commit/d9790fd00d95063de288560f6a0d2bac8f57cc4d), [`4375206`](https://github.com/mastra-ai/mastra/commit/4375206131ff701405a20326be660b2e8c3742f8), [`91196d5`](https://github.com/mastra-ai/mastra/commit/91196d5a6d582c0f494622d0378f33e22d881659), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0c2fe6c`](https://github.com/mastra-ai/mastra/commit/0c2fe6c00909795234270c8ea2c2c53882d63798), [`5e799d9`](https://github.com/mastra-ai/mastra/commit/5e799d9098c5c4d1078bf90647e95db699be11ea), [`f36019c`](https://github.com/mastra-ai/mastra/commit/f36019c24193e0d29f920663851198bf45e3d12f), [`5026973`](https://github.com/mastra-ai/mastra/commit/50269736f432cee1170627b2b6f88ba1431e837f), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`4edc93d`](https://github.com/mastra-ai/mastra/commit/4edc93dedadb89686aad75a4853cb0aa807d256e), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`dd01709`](https://github.com/mastra-ai/mastra/commit/dd01709f780562f9ff8c72d977f3da5ae265970e), [`d4e350a`](https://github.com/mastra-ai/mastra/commit/d4e350a5c1e29a7da5a22da52ed1f33431403012)]:
  - @mastra/core@1.72.0
  - @mastra/slack@1.7.0
  - @mastra/discord@1.2.0
  - @mastra/mcp@2.1.1
  - @mastra/telegram@0.2.0

## 0.5.0-alpha.3

### Minor Changes

- Added multi-connection support and a string-array shorthand to `@mastra/connect`. ([#24864](https://github.com/mastra-ai/mastra/pull/24864))

  **Multi-connection support:** when a provider has more than one active connection, tools are wrapped with a required `connection_name` input and a new `<provider>__list_connections` tool is exposed so agents can discover and select which connection to use. Single-connection behavior and explicit `connectionId` pins are unchanged. The wrapper preserves each inner tool's approval contract (`requireApproval` and, when the MCP server-level policy is a function, `needsApprovalFn`) so approval prompts still fire for multi-connection MCP tools; missing or unknown `connection_name` fails closed and requires approval.

  The helper key uses a double underscore (`<integrationId>__list_connections`) so it cannot collide with a real provider tool of the form `<integrationId>_<toolName>` (for example, WorkOS ships a real `workos_list_connections` tool that lists SSO connections).

  Previously, multi-active provider connections were skipped with a warning.

  ```ts
  // connect() returns a resolver; call it to load tools.
  const tools = await connect({ integrations: ['linear'] })();

  // Agent lists available connections.
  await tools.linear__list_connections.execute({}, {});
  // => { connections: [
  //      { name: 'Work', accountLabel: 'Work' },
  //      { name: 'Personal', accountLabel: 'Personal' },
  //    ] }

  // Agent calls tools with the chosen connection.
  await tools.linear_get_issue.execute({ connection_name: 'Work', id: 'LIN-123' }, {});
  ```

  **String-array shorthand for `integrations`:** you can now pass a plain array of integration ids when no per-provider overrides are needed. The object form still works whenever you need `allowTools`, `disallowTools`, `autoApproveTools`, `connectionId`, or `disabled`.

  ```ts
  // Shorthand
  connect({ integrations: ['linear', 'github'] });

  // Object form (unchanged)
  connect({
    integrations: {
      linear: { allowTools: ['linear_get_issue'] },
      github: {},
    },
  });
  ```

  **`disallowTools` per provider:** each provider now accepts either `allowTools` or `disallowTools` — `ConnectIntegrationOptions` is a mutually exclusive union, so setting both is a compile-time and runtime error. Use `disallowTools` when you want the whole toolset minus a few keys instead of an explicit allowlist.

  ```ts
  connect({
    integrations: {
      // Everything except the delete tool
      linear: { disallowTools: ['linear_delete_issue'] },
      // Explicit allowlist still works
      github: { allowTools: ['github_get_repo'] },
    },
  });
  ```

- Added 25 Microsoft Teams tools. Areas covered: ([#25361](https://github.com/mastra-ai/mastra/pull/25361))

  - **Teams** — create, get, list joined teams, list members, add and remove members
  - **Channels** — create, get, list, update, delete
  - **Channel messages** — send, get, list, reply, list replies
  - **Channel tabs** — create, list
  - **Chats** — create, get, list, send messages, get message, list messages, list members

  One `microsoft-teams` connection powers both these tools and the Teams channel — no extra bot token or app registration to wire up.

  ```ts
  import { createMicrosoftTeamsTools } from '@mastra/connect';

  const tools = createMicrosoftTeamsTools({ connectionId: 'conn_...' });
  ```

### Patch Changes

- Telegram channels now run in delegated credential mode: the provider receives a platform-backed `tokenResolver` instead of a static bot token, so a token re-pasted or rotated on the platform takes effect on the very next Bot API call without a snapshot refresh, and the bot token is never persisted in provider storage. ([#25272](https://github.com/mastra-ai/mastra/pull/25272))

  ```ts
  import { channels } from '@mastra/connect';

  // Telegram is wired automatically — the resolver reads the current
  // connection's api-key credential per Bot API call. No app-side config.
  const registrations = await channels({ projectId: process.env.MASTRA_PROJECT_ID! });
  ```

- Updated dependencies [[`ed67acc`](https://github.com/mastra-ai/mastra/commit/ed67acc3213d469ed69610c304c604693cfec383), [`5f1efad`](https://github.com/mastra-ai/mastra/commit/5f1efad5c2230a4de715cad3f01859b4ff9d255b), [`75c2ee1`](https://github.com/mastra-ai/mastra/commit/75c2ee1280a5441eb66c31f23a53a52b42244686), [`9a35897`](https://github.com/mastra-ai/mastra/commit/9a3589783a40157759f939f5c63bba3c8aef1c1c), [`d3a22a7`](https://github.com/mastra-ai/mastra/commit/d3a22a78f12e094118ce80ec35b63987009644e2), [`e4e0f90`](https://github.com/mastra-ai/mastra/commit/e4e0f9000d73396609ae2f2b6c31259ade43078c), [`1eccabc`](https://github.com/mastra-ai/mastra/commit/1eccabc1b95daec65ed84f1179157b1ca0305448), [`caf94f9`](https://github.com/mastra-ai/mastra/commit/caf94f9c1927f737370b6118264bd16c7210a765), [`6c9f7ab`](https://github.com/mastra-ai/mastra/commit/6c9f7abf9bdce0a52450398b31d497519465bb80), [`91196d5`](https://github.com/mastra-ai/mastra/commit/91196d5a6d582c0f494622d0378f33e22d881659), [`f36019c`](https://github.com/mastra-ai/mastra/commit/f36019c24193e0d29f920663851198bf45e3d12f)]:
  - @mastra/core@1.72.0-alpha.10
  - @mastra/telegram@0.2.0-alpha.0

## 0.5.0-alpha.2

### Patch Changes

- Updated dependencies [[`9ce3444`](https://github.com/mastra-ai/mastra/commit/9ce3444d1a6b17e72b0a20c74603abaf252a843e), [`3b77788`](https://github.com/mastra-ai/mastra/commit/3b77788a08df1e754282d39c42823e6e1c5f2742), [`987257a`](https://github.com/mastra-ai/mastra/commit/987257a34cda8a153fe592c31d75fbb1dee55202), [`65a93a2`](https://github.com/mastra-ai/mastra/commit/65a93a2a3b1434d605a6a417cb83d2d58e16bfc0), [`fd92729`](https://github.com/mastra-ai/mastra/commit/fd92729380a29f2a0ec822e39f3c09eb9aaa5ac5), [`79c3b1f`](https://github.com/mastra-ai/mastra/commit/79c3b1fa4d470585a00558b317ed47db9b1decd4), [`4092ef2`](https://github.com/mastra-ai/mastra/commit/4092ef29aad09f2ba5f90c92a4d4d3bd444eae67), [`e62e372`](https://github.com/mastra-ai/mastra/commit/e62e3721356955f0a9fd3d723cee9fa0c160652b), [`5026973`](https://github.com/mastra-ai/mastra/commit/50269736f432cee1170627b2b6f88ba1431e837f)]:
  - @mastra/core@1.72.0-alpha.7
  - @mastra/mcp@2.1.1-alpha.0

## 0.5.0-alpha.1

### Patch Changes

- Fixed Discord channel connections failing with `Discord rejected the bot token: 401: Unauthorized`. The Discord bot token is now read from the connection's metadata (`botToken`, following Nango's Discord convention) instead of the OAuth credential — Discord's OAuth exchange only yields a user Bearer token, which can never authenticate as a bot. A Discord connection without `botToken` metadata is skipped with a warning telling you to store the token on the connection. ([#25260](https://github.com/mastra-ai/mastra/pull/25260))

- Updated dependencies [[`43fbe75`](https://github.com/mastra-ai/mastra/commit/43fbe75535650345cf61dee00cf3e7b3f5efaf7f), [`ebd03fd`](https://github.com/mastra-ai/mastra/commit/ebd03fd3bc93fe3930747956724252f7c8834826), [`2c57ba8`](https://github.com/mastra-ai/mastra/commit/2c57ba896b04215fface2a8216b88fe59cfdd041), [`f6effda`](https://github.com/mastra-ai/mastra/commit/f6effdabafa9fc6388478b3e281ad4c457d4200b), [`7f4ce21`](https://github.com/mastra-ai/mastra/commit/7f4ce2190029710851d95f7b75a2fb724782483c), [`1ba1588`](https://github.com/mastra-ai/mastra/commit/1ba158873dadf3d290b111981c3bc7ef95ab1d1c), [`b537ab1`](https://github.com/mastra-ai/mastra/commit/b537ab14714870e058775530bc55b37c9115613f), [`d4e350a`](https://github.com/mastra-ai/mastra/commit/d4e350a5c1e29a7da5a22da52ed1f33431403012)]:
  - @mastra/core@1.72.0-alpha.5

## 0.5.0-alpha.0

### Minor Changes

- `channels()` now returns a live channel resolver instead of a fixed provider map. Channel connections created or removed on the Mastra platform are picked up by a running server automatically — no redeploy needed. ([#25149](https://github.com/mastra-ai/mastra/pull/25149))

  ```typescript
  import { Mastra } from '@mastra/core/mastra';
  import { channels } from '@mastra/connect';

  export const mastra = new Mastra({
    channels: await channels({ projectId: 'my-project' }),
  });
  ```

  The resolver keeps one provider instance per integration, refreshes platform connections on a configurable `ttlMs` cache (30 seconds by default), and re-applies credentials when a connection changes. Slack credentials are fetched fresh from the platform before each app-management call, so tokens refreshed by the platform are always honored.

  If you previously awaited `channels()` and read providers off the result as a plain object, call the resolver instead: `const providers = await resolver()`.

  Requires `@mastra/core` 1.72.0 or later — the first release whose `Mastra` constructor accepts a `ChannelsResolver` (the peer dependency range has been raised to match). Older cores treat the resolver as a static provider record and fail at construction.

- `@mastra/slack`, `@mastra/telegram`, and `@mastra/discord` are now direct dependencies of `@mastra/connect`. Installing `@mastra/connect` is enough to use any channel with `channels()` — no separate channel package installs required. ([#25125](https://github.com/mastra-ai/mastra/pull/25125))

### Patch Changes

- Discord channel connections no longer require `applicationId` and `publicKey` on the platform connection. The bot token stored as the connection credential is enough — the provider resolves the rest from Discord automatically — so the "missing applicationId + publicKey" warning is gone. Connection metadata and `providerOptions` still work as explicit overrides. ([#25125](https://github.com/mastra-ai/mastra/pull/25125))

- Fixed Slack channel connections that failed with "Slack refresh token is invalid" when connecting an agent. The Mastra platform now manages the Slack credential refresh cycle, so `channels()` no longer competes with it over the single-use refresh token. ([#25125](https://github.com/mastra-ai/mastra/pull/25125))

- Updated dependencies [[`c3bc77c`](https://github.com/mastra-ai/mastra/commit/c3bc77ca9e1e665d9e0ad2bfd15a88ad71461f12), [`68cc668`](https://github.com/mastra-ai/mastra/commit/68cc66800e5ce6f5d62189fc7b5ef9d71cf80971), [`c3bc77c`](https://github.com/mastra-ai/mastra/commit/c3bc77ca9e1e665d9e0ad2bfd15a88ad71461f12), [`68cc668`](https://github.com/mastra-ai/mastra/commit/68cc66800e5ce6f5d62189fc7b5ef9d71cf80971), [`781762b`](https://github.com/mastra-ai/mastra/commit/781762b2dcd0c8cc7f9b8ab73824ec45a5225db7), [`cc0da13`](https://github.com/mastra-ai/mastra/commit/cc0da13b826d5f74213c4d8c470acf8698542249), [`f2c3f8c`](https://github.com/mastra-ai/mastra/commit/f2c3f8c74e1d7bc7baca5303b36320b0b361775c), [`1fe1c2b`](https://github.com/mastra-ai/mastra/commit/1fe1c2b6f0b29481dca62a9199af751d594e3ea6), [`279a736`](https://github.com/mastra-ai/mastra/commit/279a736c62495cac0f247ab1402a8c80bccc892a), [`4edc93d`](https://github.com/mastra-ai/mastra/commit/4edc93dedadb89686aad75a4853cb0aa807d256e)]:
  - @mastra/slack@1.7.0-alpha.0
  - @mastra/core@1.72.0-alpha.2
  - @mastra/discord@1.2.0-alpha.0

## 0.4.0

### Minor Changes

- Add `environment()` for sandboxed agents. Materialize provider credentials from your project's Platform connections into a `{ env, onStart }` pair that any sandbox provider (e2b, Modal, Daytona, Docker, subprocess) can consume — so CLI tooling inside the sandbox is authenticated without hand-wiring tokens per agent. ([#24912](https://github.com/mastra-ai/mastra/pull/24912))

  ```ts
  import { environment } from '@mastra/connect';

  const env = environment({
    projectId: process.env.MASTRA_PROJECT_ID,
    client: { accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN },
  });

  const { env: envVars, onStart } = await env();

  await sandbox.start({ env: envVars, onStart });
  ```

  `environment()` shares its resolution model with `connect()`: same `projectId`, `client`, and per-provider `integrations` overrides (`connectionId` to pin, `disabled: true` to exclude). GitHub is the first provider with an env contributor — its OAuth token is exported as `GH_TOKEN`/`GITHUB_TOKEN` so both `gh` and `git` HTTPS authenticate as the connected user, and `onStart` installs a git credential helper that reads the token from the environment rather than baking it into git config.

### Patch Changes

- Updated dependencies [[`d47a70d`](https://github.com/mastra-ai/mastra/commit/d47a70d14aa2486089115069416fb0a9cac5eef5), [`fc7d2c1`](https://github.com/mastra-ai/mastra/commit/fc7d2c102e911f43f70f425e67c970231ea19363), [`4607046`](https://github.com/mastra-ai/mastra/commit/460704663e2869183e7dfff7efec49a4f2f47503), [`1e435dc`](https://github.com/mastra-ai/mastra/commit/1e435dc84a9c1b35aa58d0ab9b14ff39fe13aab0), [`9ba23a2`](https://github.com/mastra-ai/mastra/commit/9ba23a23893622b72c76189199d02432590606c1), [`b757896`](https://github.com/mastra-ai/mastra/commit/b757896872edd74f71ec104be92273c5406265da), [`1640470`](https://github.com/mastra-ai/mastra/commit/1640470792c1138f91f543526b3a516a948cf129), [`7f64865`](https://github.com/mastra-ai/mastra/commit/7f648656d2b24b214a899e8835b8286333c80a19), [`f751e65`](https://github.com/mastra-ai/mastra/commit/f751e659f496e5e53ed38632c59c296fec2ccbe5)]:
  - @mastra/discord@1.1.0
  - @mastra/core@1.71.0
  - @mastra/telegram@0.1.3

## 0.4.0-alpha.0

### Minor Changes

- Add `environment()` for sandboxed agents. Materialize provider credentials from your project's Platform connections into a `{ env, onStart }` pair that any sandbox provider (e2b, Modal, Daytona, Docker, subprocess) can consume — so CLI tooling inside the sandbox is authenticated without hand-wiring tokens per agent. ([#24912](https://github.com/mastra-ai/mastra/pull/24912))

  ```ts
  import { environment } from '@mastra/connect';

  const env = environment({
    projectId: process.env.MASTRA_PROJECT_ID,
    client: { accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN },
  });

  const { env: envVars, onStart } = await env();

  await sandbox.start({ env: envVars, onStart });
  ```

  `environment()` shares its resolution model with `connect()`: same `projectId`, `client`, and per-provider `integrations` overrides (`connectionId` to pin, `disabled: true` to exclude). GitHub is the first provider with an env contributor — its OAuth token is exported as `GH_TOKEN`/`GITHUB_TOKEN` so both `gh` and `git` HTTPS authenticate as the connected user, and `onStart` installs a git credential helper that reads the token from the environment rather than baking it into git config.

### Patch Changes

- Updated dependencies [[`d47a70d`](https://github.com/mastra-ai/mastra/commit/d47a70d14aa2486089115069416fb0a9cac5eef5), [`fc7d2c1`](https://github.com/mastra-ai/mastra/commit/fc7d2c102e911f43f70f425e67c970231ea19363), [`4607046`](https://github.com/mastra-ai/mastra/commit/460704663e2869183e7dfff7efec49a4f2f47503), [`1e435dc`](https://github.com/mastra-ai/mastra/commit/1e435dc84a9c1b35aa58d0ab9b14ff39fe13aab0), [`9ba23a2`](https://github.com/mastra-ai/mastra/commit/9ba23a23893622b72c76189199d02432590606c1), [`1640470`](https://github.com/mastra-ai/mastra/commit/1640470792c1138f91f543526b3a516a948cf129)]:
  - @mastra/discord@1.1.0-alpha.0
  - @mastra/core@1.71.0-alpha.1
  - @mastra/telegram@0.1.3-alpha.0

## 0.3.1

### Patch Changes

- Updated dependencies [[`bfde500`](https://github.com/mastra-ai/mastra/commit/bfde5009d1d9bdbce241132b3df9e638ad805fab), [`04233fd`](https://github.com/mastra-ai/mastra/commit/04233fdc197e1d9a4b13e9d182447df283ea1850), [`574a55c`](https://github.com/mastra-ai/mastra/commit/574a55cd26cc2171f61906e0f090c817032c9603), [`e33a488`](https://github.com/mastra-ai/mastra/commit/e33a488ec308b7742e2bf66528873767f802c957), [`fc0ee2b`](https://github.com/mastra-ai/mastra/commit/fc0ee2b7d6d33bd5dd80f7338a5a90ec615b1235), [`9544a15`](https://github.com/mastra-ai/mastra/commit/9544a158e9bf110b3873b74b2c368616015244ee), [`22ed0d9`](https://github.com/mastra-ai/mastra/commit/22ed0d9f0f399ca29cf66e847795784018e6b79c), [`68fece5`](https://github.com/mastra-ai/mastra/commit/68fece5b724be17ab9bbfaa132468c5afa866b39), [`e7d378f`](https://github.com/mastra-ai/mastra/commit/e7d378f16e68b9ec1268a71960ecf102f86cd437), [`8adceb5`](https://github.com/mastra-ai/mastra/commit/8adceb53a48bb1b628ba839665e736b062b0d58f), [`e675e83`](https://github.com/mastra-ai/mastra/commit/e675e83c29d1c69ee334985725c5ce78ac5dcd6f), [`f9ffd28`](https://github.com/mastra-ai/mastra/commit/f9ffd2825c3cb21145b361f06c96f3c35c07bce2), [`5e4edbe`](https://github.com/mastra-ai/mastra/commit/5e4edbe212a714cc659203964f60e44988c7171f), [`7465c16`](https://github.com/mastra-ai/mastra/commit/7465c166894c5a0628634f564c62a26322654f9e), [`9f349e3`](https://github.com/mastra-ai/mastra/commit/9f349e34a1bc6e1011c471ad305068d95966ae35), [`c593409`](https://github.com/mastra-ai/mastra/commit/c59340998206b7273747d5b5281a09ab26535f81), [`4cb2f12`](https://github.com/mastra-ai/mastra/commit/4cb2f12d05b0de71a22127a76a16c1732bb674ec), [`3601e57`](https://github.com/mastra-ai/mastra/commit/3601e57cd8a4d2ca6f68d460c527c472a19f612d), [`ac426a0`](https://github.com/mastra-ai/mastra/commit/ac426a0f015e0d234f1394505c0b0795dc03ebed), [`cf98812`](https://github.com/mastra-ai/mastra/commit/cf98812b7e9b511bc45a8641047ad7b91fee6abf), [`cf98812`](https://github.com/mastra-ai/mastra/commit/cf98812b7e9b511bc45a8641047ad7b91fee6abf), [`68695fd`](https://github.com/mastra-ai/mastra/commit/68695fdc4b92cdf67c7fcf36603fa3c59e1bc10e), [`c35feed`](https://github.com/mastra-ai/mastra/commit/c35feedf99a55ad404657a1cebf0c298f36ab82e), [`2d73b0f`](https://github.com/mastra-ai/mastra/commit/2d73b0f52801be76691bab1204f133de1d631208), [`9a2db9a`](https://github.com/mastra-ai/mastra/commit/9a2db9ac12c7b5e24a44841d47a7f7ff17d3f504), [`ff6487e`](https://github.com/mastra-ai/mastra/commit/ff6487e163c4e4fcde950352e6598961b037dd1a)]:
  - @mastra/core@1.70.0
  - @mastra/mcp@2.1.0

## 0.3.1-alpha.0

### Patch Changes

- Updated dependencies [[`bfde500`](https://github.com/mastra-ai/mastra/commit/bfde5009d1d9bdbce241132b3df9e638ad805fab), [`f9ffd28`](https://github.com/mastra-ai/mastra/commit/f9ffd2825c3cb21145b361f06c96f3c35c07bce2), [`c593409`](https://github.com/mastra-ai/mastra/commit/c59340998206b7273747d5b5281a09ab26535f81), [`cf98812`](https://github.com/mastra-ai/mastra/commit/cf98812b7e9b511bc45a8641047ad7b91fee6abf), [`cf98812`](https://github.com/mastra-ai/mastra/commit/cf98812b7e9b511bc45a8641047ad7b91fee6abf), [`68695fd`](https://github.com/mastra-ai/mastra/commit/68695fdc4b92cdf67c7fcf36603fa3c59e1bc10e)]:
  - @mastra/core@1.70.0-alpha.0
  - @mastra/mcp@2.1.0-alpha.0

## 0.3.0

### Minor Changes

- Added ten generated tool providers to @mastra/connect: Slack, GitHub, Google Mail, Google Calendar, Fireflies, PostHog, Stripe, Discord, Twitter/X, and HubSpot. Each ships checked-in tools generated from Nango integration templates, including new agent-focused actions (PostHog HogQL queries, Stripe balance/dispute/coupon/account reads, GitHub tags and trees, Slack Connect shared-channel invites, Twitter search and following lookups, HubSpot form submission). Attach a provider connection in Mastra Platform and the tools resolve through connect() with no extra configuration: ([#24606](https://github.com/mastra-ai/mastra/pull/24606))

  ```ts
  import { Agent } from '@mastra/core/agent';
  import { connect } from '@mastra/connect';

  const agent = new Agent({
    id: 'ops-agent',
    model: 'anthropic/claude-sonnet-4-6',
    tools: connect(),
  });
  ```

### Patch Changes

- Generated `@mastra/connect` providers now cover more of the upstream template catalog. Actions that authenticate with the raw connection credential — token-introspection endpoints, for example — are generated instead of skipped, and actions that validate their input with the template validation helper are generated too. The credential is fetched from the platform only for the specific actions that read it. Under the hood this extends the platform proxy runtime and the provider generator; agents consume the resulting tools through the normal provider workflow with no API changes: ([#24605](https://github.com/mastra-ai/mastra/pull/24605))

  ```typescript
  import { Agent } from '@mastra/core/agent';
  import { connect } from '@mastra/connect';

  const assistant = new Agent({
    id: 'assistant',
    name: 'Assistant',
    instructions: 'Help with connected services.',
    model: 'anthropic/claude-sonnet-4-6',
    tools: connect(), // tools for every connected provider, resolved per request
  });
  ```

- Updated dependencies [[`7fefefd`](https://github.com/mastra-ai/mastra/commit/7fefefdcb91e15f8bf60b5b2148ef27cf1352faf), [`251eb56`](https://github.com/mastra-ai/mastra/commit/251eb5674e8e32855af6925d7fd1cd337aa5ea7d), [`e0fd937`](https://github.com/mastra-ai/mastra/commit/e0fd937e84fa6dd7e82b7b55b039a4191e61aa5c), [`f7180bd`](https://github.com/mastra-ai/mastra/commit/f7180bdd52b4ffaa9f053b8495c6c8b8c530de2a), [`f9ea7b2`](https://github.com/mastra-ai/mastra/commit/f9ea7b2d2f1e925b357fd71fe18ab26d3b00feae), [`fc3ee16`](https://github.com/mastra-ai/mastra/commit/fc3ee1604c0ec0a98e5051585e3d201b5699abbe), [`26ed7ad`](https://github.com/mastra-ai/mastra/commit/26ed7ad111927211231a995346b9b561d4baa8e2), [`ecc642d`](https://github.com/mastra-ai/mastra/commit/ecc642d0a6ca2e938f92129726a4278471924124), [`1ed77dd`](https://github.com/mastra-ai/mastra/commit/1ed77dd7176e2f41ea2bf74f5ab0e4d1899c38e5), [`18863ae`](https://github.com/mastra-ai/mastra/commit/18863ae95c87218b8163e28d9826883cf4edf02b), [`c61d52c`](https://github.com/mastra-ai/mastra/commit/c61d52c338dbd77f3e8f0e7487f44b1f0a0d1350), [`32a9682`](https://github.com/mastra-ai/mastra/commit/32a96824a9ff31c3596fdb1a2789b946eba152cc), [`9ce6bc9`](https://github.com/mastra-ai/mastra/commit/9ce6bc9107b5fe81dffe8a155dded9b0471013b5), [`fc3ee16`](https://github.com/mastra-ai/mastra/commit/fc3ee1604c0ec0a98e5051585e3d201b5699abbe), [`725d46b`](https://github.com/mastra-ai/mastra/commit/725d46b4b7eaf5a3f3ef2f3fbbe8ee8909cb2c9b), [`6e21835`](https://github.com/mastra-ai/mastra/commit/6e2183502250ee5325fc834d80f4d0584916f54e), [`fc3ee16`](https://github.com/mastra-ai/mastra/commit/fc3ee1604c0ec0a98e5051585e3d201b5699abbe), [`70cd0d8`](https://github.com/mastra-ai/mastra/commit/70cd0d80373346b4d04ebf913851ade37aa807ed), [`3802d6f`](https://github.com/mastra-ai/mastra/commit/3802d6f7dbf8c27b1f84b48c6c7c2efa6c4f0d03), [`2a83258`](https://github.com/mastra-ai/mastra/commit/2a832580e3cf3efcdb4be3355eaa9a02929b3a2c), [`fc3ee16`](https://github.com/mastra-ai/mastra/commit/fc3ee1604c0ec0a98e5051585e3d201b5699abbe)]:
  - @mastra/core@1.69.0

## 0.3.0-alpha.0

### Minor Changes

- Added ten generated tool providers to @mastra/connect: Slack, GitHub, Google Mail, Google Calendar, Fireflies, PostHog, Stripe, Discord, Twitter/X, and HubSpot. Each ships checked-in tools generated from Nango integration templates, including new agent-focused actions (PostHog HogQL queries, Stripe balance/dispute/coupon/account reads, GitHub tags and trees, Slack Connect shared-channel invites, Twitter search and following lookups, HubSpot form submission). Attach a provider connection in Mastra Platform and the tools resolve through connect() with no extra configuration: ([#24606](https://github.com/mastra-ai/mastra/pull/24606))

  ```ts
  import { Agent } from '@mastra/core/agent';
  import { connect } from '@mastra/connect';

  const agent = new Agent({
    id: 'ops-agent',
    model: 'anthropic/claude-sonnet-4-6',
    tools: connect(),
  });
  ```

### Patch Changes

- Generated `@mastra/connect` providers now cover more of the upstream template catalog. Actions that authenticate with the raw connection credential — token-introspection endpoints, for example — are generated instead of skipped, and actions that validate their input with the template validation helper are generated too. The credential is fetched from the platform only for the specific actions that read it. Under the hood this extends the platform proxy runtime and the provider generator; agents consume the resulting tools through the normal provider workflow with no API changes: ([#24605](https://github.com/mastra-ai/mastra/pull/24605))

  ```typescript
  import { Agent } from '@mastra/core/agent';
  import { connect } from '@mastra/connect';

  const assistant = new Agent({
    id: 'assistant',
    name: 'Assistant',
    instructions: 'Help with connected services.',
    model: 'anthropic/claude-sonnet-4-6',
    tools: connect(), // tools for every connected provider, resolved per request
  });
  ```

- Updated dependencies:
  - @mastra/core@1.69.0-alpha.1

## 0.2.0

### Minor Changes

- Added the generated Linear provider with 46 tools for issues, projects, cycles, teams, users, workflow states, comments, attachments, relations, and labels. ([#23527](https://github.com/mastra-ai/mastra/pull/23527))

  `connect()` now automatically exposes the Linear toolset when the project has a matching `linear` connection. Set `MASTRA_LINEAR_CONNECTION_ID` or pass `integrations.linear.connectionId` when the project has multiple Linear connections.

- Added automatic discovery of MCP-backed integrations from the Mastra Platform catalog. Connected MCP providers require no checked-in provider registration: `connect()` discovers their tools through Platform, keeps provider credentials outside the application process, and preserves Platform proxy analytics. Discovered MCP tools require tool approval unless the application lists them in `autoApproveTools`. ([#23996](https://github.com/mastra-ai/mastra/pull/23996))

  ```ts
  import { connect } from '@mastra/connect';

  const tools = connect({
    projectId: process.env.MASTRA_PROJECT_ID,
    client: { accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN },
    integrations: {
      // An MCP-backed integration attached to the project; tools are discovered at runtime.
      neon: { autoApproveTools: ['neon_list_projects', 'neon_describe_project'] },
    },
  });
  ```

- Added broad Resend and incident.io tool coverage backed by Platform connections. Resend covers email operations and account resources such as domains, templates, audiences, contacts, broadcasts, and webhooks. incident.io covers incident response, alerts, on-call data, teams, users, postmortems, and catalog reads. ([#23631](https://github.com/mastra-ai/mastra/pull/23631))

  ```ts
  import { connect } from '@mastra/connect';

  const tools = connect({
    projectId: process.env.MASTRA_PROJECT_ID,
    client: { accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN },
    integrations: {
      resend: { allowTools: ['resend_send_email', 'resend_get_email'] },
      'incident-io': { allowTools: ['incident_io_list_incidents'] },
    },
  });
  ```

- Added Snowflake tools backed by Platform connections using the OAuth snowflake integration. Agents can run SQL statements (with async statement polling and cancellation) and browse warehouses, databases, schemas, tables, columns, views, stages, streams, tasks, roles, and users. The execute-statement tool runs any SQL the connection's Snowflake role permits, so scope the connected user to least privilege or restrict the toolset with allowTools. ([#24066](https://github.com/mastra-ai/mastra/pull/24066))

  ```ts
  import { connect } from '@mastra/connect';

  const tools = connect({
    projectId: process.env.MASTRA_PROJECT_ID,
    client: { accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN },
    integrations: {
      snowflake: { allowTools: ['snowflake_execute_statement', 'snowflake_list_tables'] },
    },
  });
  ```

- Add a generated Jira provider with 37 tools covering issue lifecycle (create, update, transition, link), comments, worklogs, watchers, projects, users, and metadata lookups. The tool runtime now supports the template `updateMetadata` helper by caching derived connection facts (such as the Atlassian cloud ID) in memory for the lifetime of a toolset, so tools skip repeat discovery round-trips. ([#24066](https://github.com/mastra-ai/mastra/pull/24066))

- Added built-in Clerk and WorkOS providers with 42 and 40 tools respectively for identity, organization, directory, connection, invitation, membership, and domain administration. Provider tools can now forward repeated query parameters for multi-value filters. ([#23527](https://github.com/mastra-ai/mastra/pull/23527))

- Added built-in Anthropic, Notion, OpenAI, and Supabase providers. Generated tools can now read safe connection configuration and metadata through the platform proxy, enabling providers with connection-specific API hosts. ([#23527](https://github.com/mastra-ai/mastra/pull/23527))

### Patch Changes

- Fixed OpenAI image generation tools to send base64 images to models as multimodal image content instead of JSON text, preventing generated images from consuming the text context window. Updated the generated OpenAI tools to the current API parameters. ([#23527](https://github.com/mastra-ai/mastra/pull/23527))

- Removed warnings for providers that do not have project connections. Connect now silently skips unavailable providers while continuing to report actionable connection problems. ([#23527](https://github.com/mastra-ai/mastra/pull/23527))

- Raise the `@mastra/core` peer floor to `>=1.68.0-0` to match `@mastra/mcp` 2.x, which `@mastra/connect` uses for catalog MCP discovery. ([#23876](https://github.com/mastra-ai/mastra/pull/23876))

- Validate `baseUrlOverride` on the connection-proxy client before it is forwarded as a request header. Only absolute HTTPS URLs without embedded credentials are accepted; unparseable values, non-HTTPS schemes, and userinfo-bearing URLs are rejected with `invalid_options` so a compromised connection config cannot redirect authenticated proxy traffic to an unintended origin. ([#23527](https://github.com/mastra-ai/mastra/pull/23527))

- Updated dependencies [[`81ccd7b`](https://github.com/mastra-ai/mastra/commit/81ccd7b93040952fe9c7168a2757c43a217f0a87), [`a46385d`](https://github.com/mastra-ai/mastra/commit/a46385dc1b773d1e1453627b1d62e7b6ebe93cf1), [`1e68460`](https://github.com/mastra-ai/mastra/commit/1e68460205d0061c6dbc7a7e7a50950236af774b), [`372dfed`](https://github.com/mastra-ai/mastra/commit/372dfed464ad1cbf2d42e5559f08205eea8d54a0), [`4266b67`](https://github.com/mastra-ai/mastra/commit/4266b677d33bb20651ca296f64aa91fa3b3d4e82), [`d21aa84`](https://github.com/mastra-ai/mastra/commit/d21aa84aac0dc61bbc43434af7a3b3180373a8a7), [`291a694`](https://github.com/mastra-ai/mastra/commit/291a694b3f9b7d9a17af7d10ed3c9c357bed7a6c), [`2cb5319`](https://github.com/mastra-ai/mastra/commit/2cb5319fc72ef20e7feebfa1e786ff78956aae84), [`a0fbeab`](https://github.com/mastra-ai/mastra/commit/a0fbeabf6298854bcc6d64c8b31530bedd1ea934), [`7cfa0df`](https://github.com/mastra-ai/mastra/commit/7cfa0df76759a31b54dd1a87bc95d3064f2026e9), [`b246a1b`](https://github.com/mastra-ai/mastra/commit/b246a1ba0cec1ca2781c661a6b90c777520b64c7), [`f43da93`](https://github.com/mastra-ai/mastra/commit/f43da9335acf26f9d18a1fa4abb49efe70be935e), [`291a694`](https://github.com/mastra-ai/mastra/commit/291a694b3f9b7d9a17af7d10ed3c9c357bed7a6c), [`79385bb`](https://github.com/mastra-ai/mastra/commit/79385bbd8a52ed5e5536b16190dd8b8ac1ee0840), [`bec18d0`](https://github.com/mastra-ai/mastra/commit/bec18d05e7f997ead6ada04a4dc0179c3cad8aa2), [`164e197`](https://github.com/mastra-ai/mastra/commit/164e197aa5b0973ae49a82252294f6276b2829aa), [`6ef8186`](https://github.com/mastra-ai/mastra/commit/6ef8186ade9c8ca69269deed07fd47a942ecf70d), [`f6e7562`](https://github.com/mastra-ai/mastra/commit/f6e7562b2ccfdd5d7d77a7eeea0849b6ffd2ec94), [`11560f5`](https://github.com/mastra-ai/mastra/commit/11560f54627055f5ae541a6825669778983a23c9), [`abecb67`](https://github.com/mastra-ai/mastra/commit/abecb6709643785fd87a3ff9251032a61479ccab), [`697fecc`](https://github.com/mastra-ai/mastra/commit/697feccaa4ad5df913c22e47bf16f493dd7956a8), [`2ea44c1`](https://github.com/mastra-ai/mastra/commit/2ea44c1b578d8116507160ac32c7824faa07158e), [`9fe69d6`](https://github.com/mastra-ai/mastra/commit/9fe69d6566c3e6d1e5c9f5bf5e9848b35c73e182), [`25d940a`](https://github.com/mastra-ai/mastra/commit/25d940add25504daebe65bc5cc02f268d6eba07c), [`467e0a6`](https://github.com/mastra-ai/mastra/commit/467e0a630db09a1750ce9271bddb38e46681bf04), [`13b0f30`](https://github.com/mastra-ai/mastra/commit/13b0f304533a43df7a7c486b6f37c9dca2187ecf), [`ee7187e`](https://github.com/mastra-ai/mastra/commit/ee7187e7bf66db46630f33c64e86b1ff7bb0c0b7), [`0bf287c`](https://github.com/mastra-ai/mastra/commit/0bf287c36ec14b45f5a4fdd0d279698694f592dd), [`89b8005`](https://github.com/mastra-ai/mastra/commit/89b8005902259b7c53b4079787a4798262b83192), [`b2942c0`](https://github.com/mastra-ai/mastra/commit/b2942c0f3c99dd1edba9dc8c2c17bfa55c851ae8), [`6249741`](https://github.com/mastra-ai/mastra/commit/6249741f8463bdc5a05ded2b35b143f92f33afbf), [`99fab39`](https://github.com/mastra-ai/mastra/commit/99fab399c35952ae15427ea64845d4762e9ec144), [`cd6948c`](https://github.com/mastra-ai/mastra/commit/cd6948c50aa4478d795613bdfa2d5259a7045026), [`2480359`](https://github.com/mastra-ai/mastra/commit/248035940aa048c7bcd8cfe7845915dc4734b571), [`15d3e76`](https://github.com/mastra-ai/mastra/commit/15d3e7647636c7286650ef517953c9885806c3dd), [`02f8f09`](https://github.com/mastra-ai/mastra/commit/02f8f09bc3665ed9a82ffbbc769e42e6027dc29b), [`34e4d21`](https://github.com/mastra-ai/mastra/commit/34e4d21e62c61e11e52aa7d6c39748b1120fbb93), [`8702f39`](https://github.com/mastra-ai/mastra/commit/8702f39331322ef0296fd3d68c0bd0997079faaa), [`d7f0579`](https://github.com/mastra-ai/mastra/commit/d7f0579a0445469430b9eadbf9c28ed3fa009839), [`5014bf6`](https://github.com/mastra-ai/mastra/commit/5014bf6a52f04304c30b4e572df4052085e3ac02), [`096825c`](https://github.com/mastra-ai/mastra/commit/096825c0cc37de5f465ecdc6617d642b8c898a78), [`d65d4d4`](https://github.com/mastra-ai/mastra/commit/d65d4d40a24a482d5b0ee83d9bab6042702ca1be), [`e6072cb`](https://github.com/mastra-ai/mastra/commit/e6072cbbd3482e37027e53e4d62da7aad6a36c41), [`c016c9b`](https://github.com/mastra-ai/mastra/commit/c016c9bd051612714e662588e5928b72bd6a6ac6), [`644ac13`](https://github.com/mastra-ai/mastra/commit/644ac131110a9f24a8d92b62dd3777384211a2e7), [`9cfb572`](https://github.com/mastra-ai/mastra/commit/9cfb5720d30af5421c021ab2cf8edd7a517b0442), [`b483910`](https://github.com/mastra-ai/mastra/commit/b48391034dee9a19396c1b3ec084ecf20faf550e), [`3c86726`](https://github.com/mastra-ai/mastra/commit/3c867260be59d3cd8337bc0af9a76bac517fe16f), [`6fd532a`](https://github.com/mastra-ai/mastra/commit/6fd532a2462858637a5f0b38096e9ab105bc146f), [`fec1259`](https://github.com/mastra-ai/mastra/commit/fec125946766805f3122be391272415691de6408), [`285b25a`](https://github.com/mastra-ai/mastra/commit/285b25aa9bb7cc3184991ad01f1acd4895fba076), [`33a46bd`](https://github.com/mastra-ai/mastra/commit/33a46bd43a5945b052e00341d1eecdcd78327d6e), [`4fb5ae9`](https://github.com/mastra-ai/mastra/commit/4fb5ae9e2cba9b14ba6c5cef0894e49bccf6f607), [`0a989ab`](https://github.com/mastra-ai/mastra/commit/0a989abf37c409040ee2ce9a9ccfcfb5a700508e), [`d4795a4`](https://github.com/mastra-ai/mastra/commit/d4795a42067605d2bbec10ad0b3dcc45acf02147), [`164e197`](https://github.com/mastra-ai/mastra/commit/164e197aa5b0973ae49a82252294f6276b2829aa), [`b87aa0d`](https://github.com/mastra-ai/mastra/commit/b87aa0dc38055558950024f750532ddae6ccf40c), [`ed24c7f`](https://github.com/mastra-ai/mastra/commit/ed24c7f654bb193a0c503469f4f19dda9d687ecb), [`babda00`](https://github.com/mastra-ai/mastra/commit/babda005397d2780aa21be0a7670688b704bdb2f), [`0894a0e`](https://github.com/mastra-ai/mastra/commit/0894a0e6ede48058b547aab5bb8a2a3d71c3878a), [`aa38e6f`](https://github.com/mastra-ai/mastra/commit/aa38e6f424a0eae0e43a5c2ae0b387e404f5e6a6), [`8d9eadb`](https://github.com/mastra-ai/mastra/commit/8d9eadb59ccbcae054600128aa15d95ea4d1141a), [`2476423`](https://github.com/mastra-ai/mastra/commit/24764233246dc85d7bcba8f8bb610110449a54d6), [`5085475`](https://github.com/mastra-ai/mastra/commit/5085475c0da226e618eb3ee2676d347788c3fb00), [`fa4c366`](https://github.com/mastra-ai/mastra/commit/fa4c3664c5446ae13d991204275883b2d7f00690), [`8d808d8`](https://github.com/mastra-ai/mastra/commit/8d808d8452b8acd5eda4f8cfe014331a8c0f1e92), [`164e197`](https://github.com/mastra-ai/mastra/commit/164e197aa5b0973ae49a82252294f6276b2829aa), [`e581e66`](https://github.com/mastra-ai/mastra/commit/e581e66e14bb1b2863698aecca7324fbf1ec4ff5), [`34fd538`](https://github.com/mastra-ai/mastra/commit/34fd538060402e414bdf65af9f469e7bff60be1e), [`1670091`](https://github.com/mastra-ai/mastra/commit/16700919c35dadb9737dc7fe7e5feb67cc209494), [`53519a2`](https://github.com/mastra-ai/mastra/commit/53519a29ce0063712786b74973ae2dbe97a433a7), [`a3f8f05`](https://github.com/mastra-ai/mastra/commit/a3f8f05ecb60c52056c590325e3821ecfc85afe3), [`58c88c4`](https://github.com/mastra-ai/mastra/commit/58c88c4e58504176ccb06d52df9440105aca788d), [`f43da93`](https://github.com/mastra-ai/mastra/commit/f43da9335acf26f9d18a1fa4abb49efe70be935e), [`13b0f30`](https://github.com/mastra-ai/mastra/commit/13b0f304533a43df7a7c486b6f37c9dca2187ecf), [`d39b43b`](https://github.com/mastra-ai/mastra/commit/d39b43beada08e69a962a47b58d743384722cd1f), [`b8e3ee5`](https://github.com/mastra-ai/mastra/commit/b8e3ee5da5cbc46b182ca75214acda667bac5205), [`02f8f09`](https://github.com/mastra-ai/mastra/commit/02f8f09bc3665ed9a82ffbbc769e42e6027dc29b), [`9cd9b4e`](https://github.com/mastra-ai/mastra/commit/9cd9b4eca69a3db0a0c415d0dcedf266cc7d5ec6), [`bdab4a8`](https://github.com/mastra-ai/mastra/commit/bdab4a889808d502f398a8086af3b50cc3bfbcd5), [`fc1e4f2`](https://github.com/mastra-ai/mastra/commit/fc1e4f2d4e0c1caa9d29de02f7be6a7d69ee2ea2), [`fa08939`](https://github.com/mastra-ai/mastra/commit/fa08939df788c81feb3f0afe70e10a3c40072f93), [`53cdd63`](https://github.com/mastra-ai/mastra/commit/53cdd6368b12aea743f95118a49fc6b93985fd20), [`3589cde`](https://github.com/mastra-ai/mastra/commit/3589cde4ea8dd210df6b9a2355a3e568210965fc), [`d777788`](https://github.com/mastra-ai/mastra/commit/d7777889d72b4f37a3d50b830f8208c736ee0e7a), [`5085475`](https://github.com/mastra-ai/mastra/commit/5085475c0da226e618eb3ee2676d347788c3fb00), [`5968b71`](https://github.com/mastra-ai/mastra/commit/5968b718044f8dd21bab6ce4ae7da3590729842b), [`76c7d98`](https://github.com/mastra-ai/mastra/commit/76c7d989f691510d7bfc016723cc78d7e08ac108), [`dafabf2`](https://github.com/mastra-ai/mastra/commit/dafabf22e4f4b0aabecb09839de5abe54e03151a), [`150a670`](https://github.com/mastra-ai/mastra/commit/150a67086539eea91cac3550fc068e6ac5c7e79b), [`f8683b3`](https://github.com/mastra-ai/mastra/commit/f8683b3f45fcc1b92cebe74991b94653a1fafab2), [`9fe69d6`](https://github.com/mastra-ai/mastra/commit/9fe69d6566c3e6d1e5c9f5bf5e9848b35c73e182), [`73ab51d`](https://github.com/mastra-ai/mastra/commit/73ab51dbb3d29413cae0a5bf5875cfa0382a589a), [`783e48a`](https://github.com/mastra-ai/mastra/commit/783e48aba82489a085230f6b8539a9fb338c326b), [`aee580d`](https://github.com/mastra-ai/mastra/commit/aee580d98976560e68e401c36790ce0cc6443aad), [`b26e528`](https://github.com/mastra-ai/mastra/commit/b26e5288891641044a3c26a498c06259985fed10), [`61f953a`](https://github.com/mastra-ai/mastra/commit/61f953a79736ac0d8a9650f0561c6dab1b097c8e), [`56680bf`](https://github.com/mastra-ai/mastra/commit/56680bfff71e7cdad71721b424b160bdd5de6e02), [`93a3425`](https://github.com/mastra-ai/mastra/commit/93a342569d592d0449eee7b4b4f7555dc001081b), [`32edb03`](https://github.com/mastra-ai/mastra/commit/32edb0371b8d884bee66897f236e852a959ae07a), [`7c73bac`](https://github.com/mastra-ai/mastra/commit/7c73baccc8336a4fb0db92614bf778bae5459e24), [`b130872`](https://github.com/mastra-ai/mastra/commit/b130872508e95f17894c2ed4932d4952db0a2d3c), [`a2c9876`](https://github.com/mastra-ai/mastra/commit/a2c9876f0d76a3b50ea28e6bab71de0ff4bd78a8), [`1853f3d`](https://github.com/mastra-ai/mastra/commit/1853f3d9331e3131930581556df781cca85f2d2d), [`b2f412a`](https://github.com/mastra-ai/mastra/commit/b2f412ae77fa5379471d103ebcc1ba69b22dd353), [`bc12e6c`](https://github.com/mastra-ai/mastra/commit/bc12e6cd9cc74fb078b006ed5d14429e2101cbb2), [`fdb59c6`](https://github.com/mastra-ai/mastra/commit/fdb59c6a4c3d9aea19159886aac8d80602763f04), [`07a81c8`](https://github.com/mastra-ai/mastra/commit/07a81c8be0cbdb5413ffa5c289d32765d80f4ea4), [`07ff1b8`](https://github.com/mastra-ai/mastra/commit/07ff1b8eafbd9c7786ef77decc6be3b63497cfd9), [`c6999e2`](https://github.com/mastra-ai/mastra/commit/c6999e2b4ab805301e66723ca8ba9fe30faa82ca), [`0ca5d6d`](https://github.com/mastra-ai/mastra/commit/0ca5d6d58a24e73a364451660a5a8696883eba45)]:
  - @mastra/core@1.68.0
  - @mastra/mcp@2.0.0

## 0.2.0-alpha.2

### Patch Changes

- Raise the `@mastra/core` peer floor to `>=1.68.0-0` to match `@mastra/mcp` 2.x, which `@mastra/connect` uses for catalog MCP discovery. ([#23876](https://github.com/mastra-ai/mastra/pull/23876))

- Updated dependencies [[`6ef8186`](https://github.com/mastra-ai/mastra/commit/6ef8186ade9c8ca69269deed07fd47a942ecf70d), [`2ea44c1`](https://github.com/mastra-ai/mastra/commit/2ea44c1b578d8116507160ac32c7824faa07158e), [`34e4d21`](https://github.com/mastra-ai/mastra/commit/34e4d21e62c61e11e52aa7d6c39748b1120fbb93), [`8702f39`](https://github.com/mastra-ai/mastra/commit/8702f39331322ef0296fd3d68c0bd0997079faaa), [`e6072cb`](https://github.com/mastra-ai/mastra/commit/e6072cbbd3482e37027e53e4d62da7aad6a36c41), [`8d808d8`](https://github.com/mastra-ai/mastra/commit/8d808d8452b8acd5eda4f8cfe014331a8c0f1e92)]:
  - @mastra/core@1.68.0-alpha.6
  - @mastra/mcp@2.0.0-alpha.4

## 0.2.0-alpha.1

### Minor Changes

- Added Snowflake tools backed by Platform connections using the OAuth snowflake integration. Agents can run SQL statements (with async statement polling and cancellation) and browse warehouses, databases, schemas, tables, columns, views, stages, streams, tasks, roles, and users. The execute-statement tool runs any SQL the connection's Snowflake role permits, so scope the connected user to least privilege or restrict the toolset with allowTools. ([#24066](https://github.com/mastra-ai/mastra/pull/24066))

  ```ts
  import { connect } from '@mastra/connect';

  const tools = connect({
    projectId: process.env.MASTRA_PROJECT_ID,
    client: { accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN },
    integrations: {
      snowflake: { allowTools: ['snowflake_execute_statement', 'snowflake_list_tables'] },
    },
  });
  ```

- Add a generated Jira provider with 37 tools covering issue lifecycle (create, update, transition, link), comments, worklogs, watchers, projects, users, and metadata lookups. The tool runtime now supports the template `updateMetadata` helper by caching derived connection facts (such as the Atlassian cloud ID) in memory for the lifetime of a toolset, so tools skip repeat discovery round-trips. ([#24066](https://github.com/mastra-ai/mastra/pull/24066))

### Patch Changes

- Updated dependencies [[`b246a1b`](https://github.com/mastra-ai/mastra/commit/b246a1ba0cec1ca2781c661a6b90c777520b64c7), [`13b0f30`](https://github.com/mastra-ai/mastra/commit/13b0f304533a43df7a7c486b6f37c9dca2187ecf), [`b2942c0`](https://github.com/mastra-ai/mastra/commit/b2942c0f3c99dd1edba9dc8c2c17bfa55c851ae8), [`99fab39`](https://github.com/mastra-ai/mastra/commit/99fab399c35952ae15427ea64845d4762e9ec144), [`d65d4d4`](https://github.com/mastra-ai/mastra/commit/d65d4d40a24a482d5b0ee83d9bab6042702ca1be), [`4fb5ae9`](https://github.com/mastra-ai/mastra/commit/4fb5ae9e2cba9b14ba6c5cef0894e49bccf6f607), [`e581e66`](https://github.com/mastra-ai/mastra/commit/e581e66e14bb1b2863698aecca7324fbf1ec4ff5), [`a3f8f05`](https://github.com/mastra-ai/mastra/commit/a3f8f05ecb60c52056c590325e3821ecfc85afe3), [`13b0f30`](https://github.com/mastra-ai/mastra/commit/13b0f304533a43df7a7c486b6f37c9dca2187ecf), [`9cd9b4e`](https://github.com/mastra-ai/mastra/commit/9cd9b4eca69a3db0a0c415d0dcedf266cc7d5ec6), [`3589cde`](https://github.com/mastra-ai/mastra/commit/3589cde4ea8dd210df6b9a2355a3e568210965fc), [`783e48a`](https://github.com/mastra-ai/mastra/commit/783e48aba82489a085230f6b8539a9fb338c326b), [`07a81c8`](https://github.com/mastra-ai/mastra/commit/07a81c8be0cbdb5413ffa5c289d32765d80f4ea4), [`07ff1b8`](https://github.com/mastra-ai/mastra/commit/07ff1b8eafbd9c7786ef77decc6be3b63497cfd9), [`0ca5d6d`](https://github.com/mastra-ai/mastra/commit/0ca5d6d58a24e73a364451660a5a8696883eba45)]:
  - @mastra/core@1.68.0-alpha.3

## 0.2.0-alpha.0

### Minor Changes

- Added the generated Linear provider with 46 tools for issues, projects, cycles, teams, users, workflow states, comments, attachments, relations, and labels. ([#23527](https://github.com/mastra-ai/mastra/pull/23527))

  `connect()` now automatically exposes the Linear toolset when the project has a matching `linear` connection. Set `MASTRA_LINEAR_CONNECTION_ID` or pass `integrations.linear.connectionId` when the project has multiple Linear connections.

- Added automatic discovery of MCP-backed integrations from the Mastra Platform catalog. Connected MCP providers require no checked-in provider registration: `connect()` discovers their tools through Platform, keeps provider credentials outside the application process, and preserves Platform proxy analytics. Discovered MCP tools require tool approval unless the application lists them in `autoApproveTools`. ([#23996](https://github.com/mastra-ai/mastra/pull/23996))

  ```ts
  import { connect } from '@mastra/connect';

  const tools = connect({
    projectId: process.env.MASTRA_PROJECT_ID,
    client: { accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN },
    integrations: {
      // An MCP-backed integration attached to the project; tools are discovered at runtime.
      neon: { autoApproveTools: ['neon_list_projects', 'neon_describe_project'] },
    },
  });
  ```

- Added broad Resend and incident.io tool coverage backed by Platform connections. Resend covers email operations and account resources such as domains, templates, audiences, contacts, broadcasts, and webhooks. incident.io covers incident response, alerts, on-call data, teams, users, postmortems, and catalog reads. ([#23631](https://github.com/mastra-ai/mastra/pull/23631))

  ```ts
  import { connect } from '@mastra/connect';

  const tools = connect({
    projectId: process.env.MASTRA_PROJECT_ID,
    client: { accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN },
    integrations: {
      resend: { allowTools: ['resend_send_email', 'resend_get_email'] },
      'incident-io': { allowTools: ['incident_io_list_incidents'] },
    },
  });
  ```

- Added built-in Clerk and WorkOS providers with 42 and 40 tools respectively for identity, organization, directory, connection, invitation, membership, and domain administration. Provider tools can now forward repeated query parameters for multi-value filters. ([#23527](https://github.com/mastra-ai/mastra/pull/23527))

- Added built-in Anthropic, Notion, OpenAI, and Supabase providers. Generated tools can now read safe connection configuration and metadata through the platform proxy, enabling providers with connection-specific API hosts. ([#23527](https://github.com/mastra-ai/mastra/pull/23527))

### Patch Changes

- Fixed OpenAI image generation tools to send base64 images to models as multimodal image content instead of JSON text, preventing generated images from consuming the text context window. Updated the generated OpenAI tools to the current API parameters. ([#23527](https://github.com/mastra-ai/mastra/pull/23527))

- Removed warnings for providers that do not have project connections. Connect now silently skips unavailable providers while continuing to report actionable connection problems. ([#23527](https://github.com/mastra-ai/mastra/pull/23527))

- Validate `baseUrlOverride` on the connection-proxy client before it is forwarded as a request header. Only absolute HTTPS URLs without embedded credentials are accepted; unparseable values, non-HTTPS schemes, and userinfo-bearing URLs are rejected with `invalid_options` so a compromised connection config cannot redirect authenticated proxy traffic to an unintended origin. ([#23527](https://github.com/mastra-ai/mastra/pull/23527))

- Updated dependencies [[`81ccd7b`](https://github.com/mastra-ai/mastra/commit/81ccd7b93040952fe9c7168a2757c43a217f0a87), [`a46385d`](https://github.com/mastra-ai/mastra/commit/a46385dc1b773d1e1453627b1d62e7b6ebe93cf1), [`164e197`](https://github.com/mastra-ai/mastra/commit/164e197aa5b0973ae49a82252294f6276b2829aa), [`25d940a`](https://github.com/mastra-ai/mastra/commit/25d940add25504daebe65bc5cc02f268d6eba07c), [`d7f0579`](https://github.com/mastra-ai/mastra/commit/d7f0579a0445469430b9eadbf9c28ed3fa009839), [`b483910`](https://github.com/mastra-ai/mastra/commit/b48391034dee9a19396c1b3ec084ecf20faf550e), [`164e197`](https://github.com/mastra-ai/mastra/commit/164e197aa5b0973ae49a82252294f6276b2829aa), [`fa4c366`](https://github.com/mastra-ai/mastra/commit/fa4c3664c5446ae13d991204275883b2d7f00690), [`164e197`](https://github.com/mastra-ai/mastra/commit/164e197aa5b0973ae49a82252294f6276b2829aa), [`1670091`](https://github.com/mastra-ai/mastra/commit/16700919c35dadb9737dc7fe7e5feb67cc209494), [`b8e3ee5`](https://github.com/mastra-ai/mastra/commit/b8e3ee5da5cbc46b182ca75214acda667bac5205), [`d777788`](https://github.com/mastra-ai/mastra/commit/d7777889d72b4f37a3d50b830f8208c736ee0e7a), [`56680bf`](https://github.com/mastra-ai/mastra/commit/56680bfff71e7cdad71721b424b160bdd5de6e02), [`93a3425`](https://github.com/mastra-ai/mastra/commit/93a342569d592d0449eee7b4b4f7555dc001081b), [`b130872`](https://github.com/mastra-ai/mastra/commit/b130872508e95f17894c2ed4932d4952db0a2d3c), [`1853f3d`](https://github.com/mastra-ai/mastra/commit/1853f3d9331e3131930581556df781cca85f2d2d), [`fdb59c6`](https://github.com/mastra-ai/mastra/commit/fdb59c6a4c3d9aea19159886aac8d80602763f04)]:
  - @mastra/core@1.68.0-alpha.1
  - @mastra/mcp@1.18.1-alpha.0

## 0.1.0

### Minor Changes

- Added `@mastra/connect`, a new package that turns Mastra platform integration connections into agent tools without exposing provider credentials to your app. Tools execute through the platform connection proxy, which injects credentials and refreshes tokens. ([#23087](https://github.com/mastra-ai/mastra/pull/23087))

  **Use every shipped provider connected to a project**

  ```ts
  import { Agent } from '@mastra/core/agent';
  import { connect } from '@mastra/connect';

  const agent = new Agent({
    name: 'ops',
    instructions: 'You manage our workspaces.',
    model: 'openai/gpt-5-mini',
    tools: connect(),
  });
  ```

  `connect()` returns a live resolver compatible with an agent's dynamic `tools` argument. This release establishes the connection runtime and provider-generation pipeline; generated provider modules are shipped separately, and the resolver returns an empty tool record until the installed package includes one. Once providers are present, it discovers matching project connections, merges their tools into one flat record, and refreshes its cached snapshot without requiring a server restart. Its resolver type remains compatible across linked or locally built packages that resolve a different `@mastra/core` installation.

  Use the `integrations` option to allowlist providers, restrict tool names, or select a connection when a project has more than one. Per-provider resolution failures, including ambiguous connections and connections that need reauthentication, are warned and skipped so one provider doesn't disable the other tools. Call `invalidate()` or `refresh()` to control the resolver cache manually.

  **Fetch a raw credential for custom interactions**

  ```ts
  import { credential } from '@mastra/connect';

  const credentialValue = await credential('c_yourconnectionid');
  ```

  Use `credential()` when a provider SDK requires direct credentials instead of the platform proxy.

### Patch Changes

- Updated dependencies [[`d9ef543`](https://github.com/mastra-ai/mastra/commit/d9ef54303b7f050f4e364701c3821fc61e7002f2), [`b96744d`](https://github.com/mastra-ai/mastra/commit/b96744daad8c6e181f03fdf38c732206ded428a2), [`ad5ac69`](https://github.com/mastra-ai/mastra/commit/ad5ac69bcd037bfb85c3399d8b39d9364931ad1b), [`e86be03`](https://github.com/mastra-ai/mastra/commit/e86be034c017fca7deae7d1ebb34d36413928cb8), [`492c0ae`](https://github.com/mastra-ai/mastra/commit/492c0aedcee3fde9555111a660b6c975c160a0db), [`0f4d9cf`](https://github.com/mastra-ai/mastra/commit/0f4d9cf79b49b6dc6a484a0b2d1cf381eb2343a6), [`50e2658`](https://github.com/mastra-ai/mastra/commit/50e2658cdcdc55a14abde08610a8e2b12fdf67a4), [`a0aa698`](https://github.com/mastra-ai/mastra/commit/a0aa698427db9730e39f0c9956d21b97307ab313), [`8510a6d`](https://github.com/mastra-ai/mastra/commit/8510a6d38b9d211af7d94b7860ab182ce55c39d1), [`ddbd352`](https://github.com/mastra-ai/mastra/commit/ddbd3527654a058ed413ae164a1246003dcc9030), [`5eba942`](https://github.com/mastra-ai/mastra/commit/5eba9420330b3f116810891ae14888f7f256cd4f), [`4112ecd`](https://github.com/mastra-ai/mastra/commit/4112ecdec76827384d3a7ab4e8db3ccf90ae7ed1), [`37065ad`](https://github.com/mastra-ai/mastra/commit/37065ad6cd3f74afd16417e8d4e0839c13beca40), [`648dd4f`](https://github.com/mastra-ai/mastra/commit/648dd4f4c4cd330013c0a98f50ffac77fe2ad632), [`2990bcc`](https://github.com/mastra-ai/mastra/commit/2990bccd1c648c8f8614da97fbb459819871f5bc), [`617c1b3`](https://github.com/mastra-ai/mastra/commit/617c1b30e7e794bbb77feaced1848fde291fc240), [`1ce03b9`](https://github.com/mastra-ai/mastra/commit/1ce03b9c04c633e815bc21cb78c29f7f19851fb2), [`c3d00db`](https://github.com/mastra-ai/mastra/commit/c3d00db279a95c7dcba0f767704a2bb6544b7b29), [`df14b5d`](https://github.com/mastra-ai/mastra/commit/df14b5d12374137db86f92061f8714b28473672e), [`fff3361`](https://github.com/mastra-ai/mastra/commit/fff33614a3376676797cb9b5a5c5b090b026fa0e), [`422e798`](https://github.com/mastra-ai/mastra/commit/422e798ab1a4b14302c5b49fed2f6c818a82706e), [`3fc8c2d`](https://github.com/mastra-ai/mastra/commit/3fc8c2d35f724c3648150b29e50cf61a9360b274), [`ddb3639`](https://github.com/mastra-ai/mastra/commit/ddb3639e3de41f3fe33f68f81c2e5850ff1280b6), [`4b3f587`](https://github.com/mastra-ai/mastra/commit/4b3f587ceabb3f3697c4c1ad4fb154d58002ef7c), [`47868b2`](https://github.com/mastra-ai/mastra/commit/47868b2dde360b038d829c9f88e15061acf3efb5), [`44c20c9`](https://github.com/mastra-ai/mastra/commit/44c20c9a40ba5ef153e1d5d0c413b825e1de42d7), [`502ca89`](https://github.com/mastra-ai/mastra/commit/502ca8904848e77d44622669f2728171d36ad6ca), [`953be88`](https://github.com/mastra-ai/mastra/commit/953be88befd9cdb789b4cfc16680121c663a631b), [`b95aabb`](https://github.com/mastra-ai/mastra/commit/b95aabba261a39b73430d95f3ed051634117d517), [`055057c`](https://github.com/mastra-ai/mastra/commit/055057ca2102e35008fe30871f7c8f422ae25ec2), [`7290151`](https://github.com/mastra-ai/mastra/commit/7290151bdb3bfe518653b0a66a19d6790925e4a0), [`2990bcc`](https://github.com/mastra-ai/mastra/commit/2990bccd1c648c8f8614da97fbb459819871f5bc), [`9bc7895`](https://github.com/mastra-ai/mastra/commit/9bc789591ad683f304c63bd01e554fbba2df9cf6), [`ffe16f1`](https://github.com/mastra-ai/mastra/commit/ffe16f17447449b7155f1f15992e3c9e5f6511ac), [`f466753`](https://github.com/mastra-ai/mastra/commit/f4667539a0c41ae4aa08a4ed380f374687db2592), [`04c11b3`](https://github.com/mastra-ai/mastra/commit/04c11b3cd698fa37af8fad466dc2bf6fa0d5494d), [`967ab17`](https://github.com/mastra-ai/mastra/commit/967ab179c9814e734af9c3395ff8ef795acbe06c), [`ad5ac69`](https://github.com/mastra-ai/mastra/commit/ad5ac69bcd037bfb85c3399d8b39d9364931ad1b), [`6d20620`](https://github.com/mastra-ai/mastra/commit/6d206205f781cfa2598c2a55123a336909e039b4), [`47868b2`](https://github.com/mastra-ai/mastra/commit/47868b2dde360b038d829c9f88e15061acf3efb5), [`fde3ca5`](https://github.com/mastra-ai/mastra/commit/fde3ca590f7d854ff33354eff4261b907bdacde4), [`3a1d253`](https://github.com/mastra-ai/mastra/commit/3a1d2537ad28754a164aedbf0dd94be224ccb0c3), [`0775cde`](https://github.com/mastra-ai/mastra/commit/0775cdee12b6ad2ad6b5c97874e6248db720224c), [`e3c3e5e`](https://github.com/mastra-ai/mastra/commit/e3c3e5e3e354e88207aa9747f9f0cd3352cea972), [`6902f94`](https://github.com/mastra-ai/mastra/commit/6902f940f1879955a90faa0a0ac871667b59d428), [`d55aa61`](https://github.com/mastra-ai/mastra/commit/d55aa616b3e88015c3b74342c75bd510c7e764df), [`7148bf5`](https://github.com/mastra-ai/mastra/commit/7148bf55b147e3fae90b3ba0c9517adb0af5f2a4), [`e83dfad`](https://github.com/mastra-ai/mastra/commit/e83dfade569ee5aea688de9f2bb8bf8db0a653a7), [`44057ea`](https://github.com/mastra-ai/mastra/commit/44057eac6fd048100574bf71c6dc095f769a6d63), [`d581249`](https://github.com/mastra-ai/mastra/commit/d581249a5bf97d32d73e0f1f30cd50ff108e2d67), [`2289456`](https://github.com/mastra-ai/mastra/commit/228945659b2003633e0ebb33e7e34cc2f6efbded), [`6bb122c`](https://github.com/mastra-ai/mastra/commit/6bb122c5147b612c0fe7f173f940933066c4cfcc), [`2c501bc`](https://github.com/mastra-ai/mastra/commit/2c501bc8f661b27a06842f1312221efa6125e580), [`990b47f`](https://github.com/mastra-ai/mastra/commit/990b47fa7370753967ea7ce83100a522f79ab328), [`90846f2`](https://github.com/mastra-ai/mastra/commit/90846f2bfd890de159ab7c3d4fcf8a71c6fb7125), [`6bdb944`](https://github.com/mastra-ai/mastra/commit/6bdb944acb3f39bccad59ee140d7614420948f6b), [`d1b070c`](https://github.com/mastra-ai/mastra/commit/d1b070cd77a944e6bb2e5848052b1e8275be88a2), [`7f6d101`](https://github.com/mastra-ai/mastra/commit/7f6d101044eefc0d776a555b45dbea1c0d5224c4), [`4573c23`](https://github.com/mastra-ai/mastra/commit/4573c231c108e7d796eab12b8e9b2094f8cc4d47), [`a54766a`](https://github.com/mastra-ai/mastra/commit/a54766a10381295583144847b856d18e8f924d30), [`1bd31e7`](https://github.com/mastra-ai/mastra/commit/1bd31e7fd49e6de56e6e9a157a6b452cbbd86983), [`a4381a2`](https://github.com/mastra-ai/mastra/commit/a4381a2b36cdb81c4e33c435cd882921edfc146c), [`ff45065`](https://github.com/mastra-ai/mastra/commit/ff45065d42132075c4efb064d96169c4eadbab58), [`e872dd6`](https://github.com/mastra-ai/mastra/commit/e872dd6619f3a5a46f1158b190b02f607b74d191)]:
  - @mastra/core@1.67.0

## 0.1.0-alpha.0

### Minor Changes

- Added `@mastra/connect`, a new package that turns Mastra platform integration connections into agent tools without exposing provider credentials to your app. Tools execute through the platform connection proxy, which injects credentials and refreshes tokens. ([#23087](https://github.com/mastra-ai/mastra/pull/23087))

  **Use every shipped provider connected to a project**

  ```ts
  import { Agent } from '@mastra/core/agent';
  import { connect } from '@mastra/connect';

  const agent = new Agent({
    name: 'ops',
    instructions: 'You manage our workspaces.',
    model: 'openai/gpt-5-mini',
    tools: connect(),
  });
  ```

  `connect()` returns a live resolver compatible with an agent's dynamic `tools` argument. This release establishes the connection runtime and provider-generation pipeline; generated provider modules are shipped separately, and the resolver returns an empty tool record until the installed package includes one. Once providers are present, it discovers matching project connections, merges their tools into one flat record, and refreshes its cached snapshot without requiring a server restart. Its resolver type remains compatible across linked or locally built packages that resolve a different `@mastra/core` installation.

  Use the `integrations` option to allowlist providers, restrict tool names, or select a connection when a project has more than one. Per-provider resolution failures, including ambiguous connections and connections that need reauthentication, are warned and skipped so one provider doesn't disable the other tools. Call `invalidate()` or `refresh()` to control the resolver cache manually.

  **Fetch a raw credential for custom interactions**

  ```ts
  import { credential } from '@mastra/connect';

  const credentialValue = await credential('c_yourconnectionid');
  ```

  Use `credential()` when a provider SDK requires direct credentials instead of the platform proxy.

### Patch Changes

- Updated dependencies [[`0f4d9cf`](https://github.com/mastra-ai/mastra/commit/0f4d9cf79b49b6dc6a484a0b2d1cf381eb2343a6), [`50e2658`](https://github.com/mastra-ai/mastra/commit/50e2658cdcdc55a14abde08610a8e2b12fdf67a4), [`8510a6d`](https://github.com/mastra-ai/mastra/commit/8510a6d38b9d211af7d94b7860ab182ce55c39d1), [`5eba942`](https://github.com/mastra-ai/mastra/commit/5eba9420330b3f116810891ae14888f7f256cd4f), [`648dd4f`](https://github.com/mastra-ai/mastra/commit/648dd4f4c4cd330013c0a98f50ffac77fe2ad632), [`3fc8c2d`](https://github.com/mastra-ai/mastra/commit/3fc8c2d35f724c3648150b29e50cf61a9360b274), [`ddb3639`](https://github.com/mastra-ai/mastra/commit/ddb3639e3de41f3fe33f68f81c2e5850ff1280b6), [`502ca89`](https://github.com/mastra-ai/mastra/commit/502ca8904848e77d44622669f2728171d36ad6ca), [`953be88`](https://github.com/mastra-ai/mastra/commit/953be88befd9cdb789b4cfc16680121c663a631b), [`6d20620`](https://github.com/mastra-ai/mastra/commit/6d206205f781cfa2598c2a55123a336909e039b4), [`d55aa61`](https://github.com/mastra-ai/mastra/commit/d55aa616b3e88015c3b74342c75bd510c7e764df), [`4573c23`](https://github.com/mastra-ai/mastra/commit/4573c231c108e7d796eab12b8e9b2094f8cc4d47)]:
  - @mastra/core@1.67.0-alpha.5
