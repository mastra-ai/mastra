---
'@mastra/platform': patch
---

Add package README covering env-var fallbacks, bearer auth, and filesystem/sandbox examples. Drop `required` on `accessToken`, `projectId`, `environmentId`, and `bucketName` in the `SandboxProvider` / `FilesystemProvider` config schemas — the constructors already read those from `MASTRA_PLATFORM_ACCESS_TOKEN`, `MASTRA_PROJECT_ID`, `MASTRA_ENVIRONMENT_ID`, and `MASTRA_PLATFORM_BUCKET_NAME`, so marking them required forced UI/config forms to demand values that runtime env could supply (matches how `@mastra/e2b` treats its API key).
