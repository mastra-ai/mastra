---
'@mastra/daytona': patch
---

Updated `@daytonaio/sdk` to ^0.226.1. This changes how the Daytona API endpoint is resolved when you don't pass `apiUrl`:

- The SDK no longer reads `DAYTONA_API_URL` from `.env` files on its own. It only reads the process environment.
- If `DAYTONA_API_URL` (or `DAYTONA_SERVER_URL`) is in the process environment and a `.env`, `.env.local` or `.env.development` file in the working directory also defines it, `DaytonaSandbox` fails to start with `The Daytona API endpoint is ambiguous`. This happens under `mastra dev`, which loads those files into the process environment.

If you use a self-hosted Daytona endpoint, pass it explicitly.

**Before**

```ts
// .env: DAYTONA_API_URL=https://daytona.example.com/api
const sandbox = new DaytonaSandbox();
```

**After**

```ts
// .env: DAYTONA_API_URL=https://daytona.example.com/api
const sandbox = new DaytonaSandbox({
  apiUrl: process.env.DAYTONA_API_URL,
});
```
