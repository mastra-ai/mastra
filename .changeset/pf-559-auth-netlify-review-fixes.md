---
'@mastra/auth-auth0': major
'@mastra/auth-better-auth': major
---

Breaking change: `@mastra/auth-auth0` and `@mastra/auth-better-auth` now require `@mastra/core >= 1.32.0`.

Update any project that uses either auth package so the auth package and core package are upgraded together:

```json
{
  "dependencies": {
    "@mastra/core": ">=1.32.0",
    "@mastra/auth-auth0": "latest"
  }
}
```

Use the matching auth package for Better Auth projects:

```json
{
  "dependencies": {
    "@mastra/core": ">=1.32.0",
    "@mastra/auth-better-auth": "latest"
  }
}
```

Run your package manager upgrade command, for example `pnpm up @mastra/core @mastra/auth-auth0` or `pnpm up @mastra/core @mastra/auth-better-auth`.

After upgrading, runtime behavior is unchanged except that the auth integrations now rely on the newer core auth APIs instead of older incompatible core versions.
