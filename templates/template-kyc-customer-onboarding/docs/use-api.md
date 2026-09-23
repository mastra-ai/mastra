# Use the API and portal

Mastra Studio, the Hono API, and the React portal run the same workflow implementation. Start all three with `npm run dev`, or start the API and portal in separate terminals:

```bash
npm run dev:api
npm run dev:portal
```

- Studio: `http://127.0.0.1:4112` (start separately with `npm run dev:studio`)
- API: `http://127.0.0.1:4111`
- readiness: `/health/ready`
- OpenAPI: `/openapi.json`
- portal: `http://127.0.0.1:5173`

The API and portal share case storage. Studio defaults to isolated storage under `data/studio`, so cases created in Studio do not appear in the portal by default. To share operational and workflow storage in the combined development command, set `STUDIO_DATA_ROOT=./data`; Studio keeps a separate analytics database to avoid sharing the DuckDB writer. See [Configuration](configuration.md).

Domain commands require idempotency keys. Reviewer routes enforce the selected demo role and tenant. Case events expose redacted status/reason data through JSON pages or SSE, and the portal falls back to polling when the stream is unavailable.

Before embedding the workflow in your application, replace the process-local demo session with production authentication and authorization, retain origin/CSRF/rate/body-size controls, and preserve opaque references and PII-safe responses. Inspect the running API at [`/openapi.json`](http://127.0.0.1:4111/openapi.json) for the generated route contracts, and [the server implementation](../src/server) for the access controls.
