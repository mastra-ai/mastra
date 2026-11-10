# COR-1512 real-Redis two-process evidence (evidence only, not product code)

Candidate: c412839fb81b7b80931768160141f52979e1afa8 (merged via #29791). Base: 6bc7614a8f.

- `reproduce.mjs` / `child.mjs`: forks two HTTP processes sharing Redis on 127.0.0.1:16379
  (e.g. `docker run -d -p 16379:6379 redis:7-alpine`), AIMock model, bearer tokens `alice`/`bob`.
- Build first: `pnpm exec turbo build --filter=@mastra/server... --filter=@mastra/hono... --filter=@mastra/redis-streams... --filter=@mastra/redis...`
- Run from repo root with files at `.artifacts/pr4/`: `node .artifacts/pr4/reproduce.mjs durable evented plain`

Logs:
- `repro-before.log` (base 6bc7614): durable/evented owner 200 executor / 404 other process; other tenant 403 / 404.
- `repro-after.log`, `repro-final.log`, `repro-final2.log` (candidate): durable/evented/plain owner 200/200,
  other tenant 403/403, anonymous 401/401, finished abort 200 {"aborted":false}, after cleanup 404/404.
  Replay-owner key present during window, absent after cleanup.

Not covered: Inngest finished replay; atomic retention under backend faults.
