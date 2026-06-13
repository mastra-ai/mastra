# @mastra/auth-neon

## 0.2.0-alpha.0

### Minor Changes

- Added Neon Auth adapter for managed authentication with Neon's Better Auth service. ([#17864](https://github.com/mastra-ai/mastra/pull/17864))
  - `MastraAuthNeon` — JWT verification via JWKS, session cookie verification, email/password sign-in/sign-up for Studio, full `ISessionProvider` implementation
  - `MastraRBACNeon` — Role-based access control mapping Neon Auth organization roles (`owner`/`admin`/`member`) to Mastra permissions, with LRU caching

  **Usage:**

  ```typescript
  import { MastraAuthNeon, MastraRBACNeon } from '@mastra/auth-neon';

  const mastra = new Mastra({
    server: {
      auth: new MastraAuthNeon({ baseUrl: process.env.NEON_AUTH_BASE_URL }),
      rbac: new MastraRBACNeon({
        roleMapping: { owner: ['*'], admin: ['*'], member: ['agents:read', 'workflows:*'], _default: [] },
      }),
    },
  });
  ```

### Patch Changes

- Updated dependencies [[`de66bb0`](https://github.com/mastra-ai/mastra/commit/de66bb040570444c702ce4d8e1e228a5de2949cb), [`5eb94eb`](https://github.com/mastra-ai/mastra/commit/5eb94ebcf66d4e28c9e26d5821ac93379bab20a0), [`9192ddb`](https://github.com/mastra-ai/mastra/commit/9192ddbced8949113b30de444cbe763f075b59f5), [`5573693`](https://github.com/mastra-ai/mastra/commit/5573693b589822250e20dfe6cf66e9ff3bc96da8), [`adc44e1`](https://github.com/mastra-ai/mastra/commit/adc44e13c7e570b91e86b20ea7556e61d819db31), [`3ef01fd`](https://github.com/mastra-ai/mastra/commit/3ef01fd130b53d5bd4f828beb174e516a2eb1158), [`dd6a66e`](https://github.com/mastra-ai/mastra/commit/dd6a66ea0b32e0dea8059aec6b35d151e2c87dc4), [`d785c59`](https://github.com/mastra-ai/mastra/commit/d785c593b67fcb4cdc4fab9fdbde5f3b7665efc0), [`bf08402`](https://github.com/mastra-ai/mastra/commit/bf084022374fa5d06ca70ed67a86dd64e379071b), [`81fe587`](https://github.com/mastra-ai/mastra/commit/81fe587275035715c1720ddf3fee0505cf053036), [`403c438`](https://github.com/mastra-ai/mastra/commit/403c438e417278989ce247233d2c465b8d902cdd)]:
  - @mastra/core@1.43.0-alpha.0
