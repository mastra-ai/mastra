#!/usr/bin/env bash

set -euo pipefail

VALIDATOR_REPOSITORY_ROOT="$(git rev-parse --show-toplevel)"
# TypeScript 7 keeps the compiler API in the upstream typescript-classic alias.
# Select from manifest metadata so pre-install admission needs no dependencies.
TYPESCRIPT_MODULE_PATH="$(node - "$VALIDATOR_REPOSITORY_ROOT" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2];
const manifestPath = path.join(root, 'package.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
const compilerPackage = Object.hasOwn(manifest.devDependencies ?? {}, 'typescript-classic')
  ? 'typescript-classic'
  : 'typescript';
process.stdout.write(path.join(root, 'node_modules', compilerPackage));
NODE
)"
readonly VALIDATOR_REPOSITORY_ROOT TYPESCRIPT_MODULE_PATH
PACKED_DECLARATION_CHECK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/check-packed-declaration-fixture.mjs"
readonly PACKED_DECLARATION_CHECK
readonly PG_PERFORMANCE_INDEX_UNIT_TEST='stores/pg/src/storage/performance-indexes/performance-indexes.test.ts'

pf558_config() {
  PF558_PR_NUMBER="${PAPERSFLOW_PF558_PR_NUMBER:-266}"
  PF558_HEAD_REPOSITORY="${PAPERSFLOW_PF558_HEAD_REPOSITORY:-mbenhamd/mastra}"
  PF558_HEAD_REF="${PAPERSFLOW_PF558_HEAD_REF:-feature/pf-558-upstream-sync-20260714}"
  PF558_BASE_REF="${PAPERSFLOW_PF558_BASE_REF:-main}"
  PF558_MERGE_COMMIT="${PAPERSFLOW_PF558_MERGE_COMMIT:-56b439e70131ed553b56041609701d073d1b9f4a}"
  PF558_FORK_PARENT="${PAPERSFLOW_PF558_FORK_PARENT:-02b1f450bec836b63aa7224a565838edbcb13e2c}"
  PF558_UPSTREAM_PARENT="${PAPERSFLOW_PF558_UPSTREAM_PARENT:-899997e52c6a1f05089f3e7ead3ebd64b6036eea}"
  PF558_PACKAGE_JSON_SHA256="${PAPERSFLOW_PF558_PACKAGE_JSON_SHA256:-626a82759c7dc79883eb14ea0ff9a2e25be7e027ac9932c86d9d229117a77e93}"
  PF558_SERVER_PACKAGE_JSON_SHA256="${PAPERSFLOW_PF558_SERVER_PACKAGE_JSON_SHA256:-93cc906bfc540917e19972ec922d01ff17753142d0fe03a20227c858afddd5ad}"
  PF558_WORKSPACE_SHA256="${PAPERSFLOW_PF558_WORKSPACE_SHA256:-768f91f814be021bfe09b79ec178d0e8a676ad07f0a5e6d5257da5de5d4b82f0}"
  PF558_LOCKFILE_SHA256="${PAPERSFLOW_PF558_LOCKFILE_SHA256:-4a686859ab820a2d19ae0ba5c66194b50678596f8dde7a5beb23cde917aee9f2}"
  PF558_PI_TUI_PATCH_SHA256="${PAPERSFLOW_PF558_PI_TUI_PATCH_SHA256:-88572df39a8452647fa073db5bc0907de3f1cb04c52c4559c8cc6e662973818b}"
  readonly \
    PF558_PR_NUMBER PF558_HEAD_REPOSITORY PF558_HEAD_REF PF558_BASE_REF \
    PF558_MERGE_COMMIT PF558_FORK_PARENT PF558_UPSTREAM_PARENT \
    PF558_PACKAGE_JSON_SHA256 PF558_SERVER_PACKAGE_JSON_SHA256 PF558_WORKSPACE_SHA256 \
    PF558_LOCKFILE_SHA256 PF558_PI_TUI_PATCH_SHA256
}

pf2009_config() {
  PF2009_PR_NUMBER="${PAPERSFLOW_PF2009_PR_NUMBER:-277}"
  PF2009_HEAD_REPOSITORY="${PAPERSFLOW_PF2009_HEAD_REPOSITORY:-mbenhamd/mastra}"
  PF2009_HEAD_REF="${PAPERSFLOW_PF2009_HEAD_REF:-feature/pf-2009-upstream-refresh-20260715}"
  PF2009_BASE_REF="${PAPERSFLOW_PF2009_BASE_REF:-main}"
  PF2009_PRIMARY_MERGE_COMMIT="${PAPERSFLOW_PF2009_PRIMARY_MERGE_COMMIT:-5cf253ed58e7bd0eddf128093bf6999081e45590}"
  PF2009_FORK_PARENT="${PAPERSFLOW_PF2009_FORK_PARENT:-000ead5619e49859586467f849c4efddd1d6196b}"
  PF2009_PRIMARY_UPSTREAM_PARENT="${PAPERSFLOW_PF2009_PRIMARY_UPSTREAM_PARENT:-bd2f1d274d05e60e2366f005ea0d94d5cea0d5ff}"
  PF2009_LATEST_MERGE_COMMIT="${PAPERSFLOW_PF2009_LATEST_MERGE_COMMIT:-7a860dbb43bd6498fe7c9c6f374638256c102eb2}"
  PF2009_LATEST_FIRST_PARENT="${PAPERSFLOW_PF2009_LATEST_FIRST_PARENT:-2583bd763122e6625aa13b15b46979a0631d360e}"
  PF2009_LATEST_UPSTREAM_PARENT="${PAPERSFLOW_PF2009_LATEST_UPSTREAM_PARENT:-78c079612cc3e0c800984459711275b0241e0bfe}"
  PF2009_PACKAGE_JSON_SHA256="${PAPERSFLOW_PF2009_PACKAGE_JSON_SHA256:-48d931b08963ccd0f2b141f2ede020e44658b0bc43d4286fec192079ae651a3f}"
  PF2009_SERVER_PACKAGE_JSON_SHA256="${PAPERSFLOW_PF2009_SERVER_PACKAGE_JSON_SHA256:-2c4af475beaa7c27eb598a2d10b5ee470e81302861e0a81236ffae14079be224}"
  PF2009_WORKSPACE_SHA256="${PAPERSFLOW_PF2009_WORKSPACE_SHA256:-768f91f814be021bfe09b79ec178d0e8a676ad07f0a5e6d5257da5de5d4b82f0}"
  PF2009_LOCKFILE_SHA256="${PAPERSFLOW_PF2009_LOCKFILE_SHA256:-175c451edf808b31b397e5730951bc63eafb147d0b78ce56c6ae534f705b166c}"
  PF2009_DEPENDENCY_GRAPH_SHA256="${PAPERSFLOW_PF2009_DEPENDENCY_GRAPH_SHA256:-6e0e838e04ea7e301dd1dd475e54c57452f69a5d367d34877600319ea89f3ee5}"
  readonly \
    PF2009_PR_NUMBER PF2009_HEAD_REPOSITORY PF2009_HEAD_REF PF2009_BASE_REF \
    PF2009_PRIMARY_MERGE_COMMIT PF2009_FORK_PARENT PF2009_PRIMARY_UPSTREAM_PARENT \
    PF2009_LATEST_MERGE_COMMIT PF2009_LATEST_FIRST_PARENT PF2009_LATEST_UPSTREAM_PARENT \
    PF2009_PACKAGE_JSON_SHA256 PF2009_SERVER_PACKAGE_JSON_SHA256 PF2009_WORKSPACE_SHA256 \
    PF2009_LOCKFILE_SHA256 PF2009_DEPENDENCY_GRAPH_SHA256
}

pf3553_config() {
  PF3553_PR_NUMBER="${PAPERSFLOW_PF3553_PR_NUMBER:-373}"
  PF3553_HEAD_REPOSITORY="${PAPERSFLOW_PF3553_HEAD_REPOSITORY:-mbenhamd/mastra}"
  PF3553_HEAD_REF="${PAPERSFLOW_PF3553_HEAD_REF:-feature/pf-3553-selected-routes}"
  PF3553_BASE_REF="${PAPERSFLOW_PF3553_BASE_REF:-main}"
  PF3553_BASE_SURFACE_SHA256="${PAPERSFLOW_PF3553_BASE_SURFACE_SHA256:-2e08146bdcac60f3982fb9110146cc0c3d0a03849906bfd82b0fdec415c36103}"
  PF3553_HEAD_SURFACE_SHA256="${PAPERSFLOW_PF3553_HEAD_SURFACE_SHA256:-5b24ac62752863ad58b6bb00ab801c56c1ff3c1942968e5bb6e752dda8e277d6}"
  readonly PF3553_PR_NUMBER PF3553_HEAD_REPOSITORY PF3553_HEAD_REF \
    PF3553_BASE_REF PF3553_BASE_SURFACE_SHA256 \
    PF3553_HEAD_SURFACE_SHA256
}

pf3553_base_ref_allowed() {
  [[ "$1" == "$PF3553_BASE_REF" ]]
}

pf3553_reviewed_paths() {
  cat <<'EOF'
.changeset/calm-routes-select.md
.changeset/lean-fastify-select.md
docs/src/content/en/docs/server/server-adapters.mdx
packages/server/package.json
packages/server/src/server/server-adapter/http-logging.test.ts
packages/server/src/server/server-adapter/index.test.ts
packages/server/src/server/server-adapter/index.ts
packages/server/src/server/server-adapter/routes/harness.ts
packages/server/src/server/server-adapter/selected-import-closure.test.ts
packages/server/src/server/server-adapter/selected.test.ts
packages/server/src/server/server-adapter/selected.ts
packages/server/tsdown.config.ts
server-adapters/fastify/package.json
server-adapters/fastify/src/__tests__/selected-import-closure.test.ts
server-adapters/fastify/src/__tests__/selected-package-exports.test.ts
server-adapters/fastify/src/__tests__/selected-routes.test.ts
server-adapters/fastify/src/index.ts
server-adapters/fastify/src/selected.ts
server-adapters/fastify/test-fixtures/selected-package-types/consumer.cts
server-adapters/fastify/test-fixtures/selected-package-types/consumer.mts
server-adapters/fastify/test-fixtures/selected-package-types/tsconfig.json
server-adapters/fastify/tsdown.config.ts
EOF
}

pf3553_surface_digest() {
  local revision="${1:?revision is required}"
  local path entry

  while IFS= read -r path; do
    entry="$(git ls-tree "$revision" -- "$path")"
    printf '%s\t%s\n' "$path" "${entry:-missing}"
  done < <(pf3553_reviewed_paths) |
    sha256sum |
    awk '{print $1}'
}

verify_pf3553_reviewed_surface() (
  local base_revision="${1:?base revision is required}"
  local head_revision="${2:?head revision is required}"
  local merge_base expected_paths actual_paths base_digest head_digest

  merge_base="$(git merge-base "$base_revision" "$head_revision")"
  expected_paths="$(mktemp)"
  actual_paths="$(mktemp)"
  trap 'rm -f "$expected_paths" "$actual_paths"' EXIT

  pf3553_reviewed_paths | LC_ALL=C sort > "$expected_paths"
  git diff --no-renames --name-only "$merge_base..$head_revision" |
    LC_ALL=C sort > "$actual_paths"
  if ! cmp -s "$expected_paths" "$actual_paths"; then
    echo 'PF-3553 changed paths differ from the reviewed selected-route surface:' >&2
    diff -u "$expected_paths" "$actual_paths" >&2 || true
    return 1
  fi

  base_digest="$(pf3553_surface_digest "$merge_base")"
  head_digest="$(pf3553_surface_digest "$head_revision")"
  if [[ "$base_digest" != "$PF3553_BASE_SURFACE_SHA256" ]]; then
    echo 'PF-3553 reviewed base files changed after the selected-route review.' >&2
    echo "expected: $PF3553_BASE_SURFACE_SHA256" >&2
    echo "actual:   $base_digest" >&2
    return 1
  fi
  if [[ "$head_digest" != "$PF3553_HEAD_SURFACE_SHA256" ]]; then
    echo 'PF-3553 selected-route file identities differ from the reviewed head.' >&2
    echo "expected: $PF3553_HEAD_SURFACE_SHA256" >&2
    echo "actual:   $head_digest" >&2
    return 1
  fi
)

pf4051_config() {
  PF4051_HEAD_REPOSITORY="${PAPERSFLOW_PF4051_HEAD_REPOSITORY:-mbenhamd/mastra}"
  PF4051_HEAD_REF="${PAPERSFLOW_PF4051_HEAD_REF:-feature/pf-4051-mastra-upstream-sync-2de367c9-r4}"
  PF4051_BASE_REF="${PAPERSFLOW_PF4051_BASE_REF:-main}"
  PF4051_PENDING_MERGE_COMMIT='PENDING_PF4051_MERGE_COMMIT'
  PF4051_PENDING_REVIEWED_TREE='PENDING_PF4051_REVIEWED_TREE'
  PF4051_MERGE_COMMIT="${PAPERSFLOW_PF4051_MERGE_COMMIT:-ad02d168cca4021e4404d45b8929504ffc9b6eb0}"
  PF4051_FORK_PARENT="${PAPERSFLOW_PF4051_FORK_PARENT:-0aefcaca3f58d2a807176c9c9b85151e917067a5}"
  PF4051_MAIN_PARENT="${PAPERSFLOW_PF4051_MAIN_PARENT:-831f841b713550b76026c7c52041a6a6889360d3}"
  PF4051_UPSTREAM_PARENT="${PAPERSFLOW_PF4051_UPSTREAM_PARENT:-2de367c9399c5fe51ea1db2d5821107591f7a7b4}"
  PF4051_REVIEWED_TREE="${PAPERSFLOW_PF4051_REVIEWED_TREE:-419ad412281a6468f50737f225b25ea214b28ca9}"
  PF4051_TRUSTED_MAIN="${PAPERSFLOW_PF4051_TRUSTED_MAIN:-831f841b713550b76026c7c52041a6a6889360d3}"
  readonly \
    PF4051_TRUSTED_MAIN \
    PF4051_HEAD_REPOSITORY PF4051_HEAD_REF PF4051_BASE_REF PF4051_MERGE_COMMIT \
    PF4051_FORK_PARENT PF4051_MAIN_PARENT PF4051_UPSTREAM_PARENT PF4051_REVIEWED_TREE \
    PF4051_PENDING_MERGE_COMMIT PF4051_PENDING_REVIEWED_TREE
}

pf4163_config() {
  PF4163_HEAD_REPOSITORY="${PAPERSFLOW_PF4163_HEAD_REPOSITORY:-mbenhamd/mastra}"
  PF4163_HEAD_REF="${PAPERSFLOW_PF4163_HEAD_REF:-feature/pf-4163-mastra-upstream-sync-23c232d7}"
  PF4163_BASE_REF="${PAPERSFLOW_PF4163_BASE_REF:-main}"
  PF4163_PENDING_MERGE_COMMIT='PENDING_PF4163_MERGE_COMMIT'
  PF4163_PENDING_FORK_PARENT='PENDING_PF4163_FORK_PARENT'
  PF4163_PENDING_REVIEWED_TREE='PENDING_PF4163_REVIEWED_TREE'
  PF4163_PENDING_CORRECTION_HEAD='PENDING_PF4163_CORRECTION_HEAD'
  PF4163_PENDING_CORRECTION_TREE='PENDING_PF4163_CORRECTION_TREE'
  # S is the reviewed source merge. R is pinned only after its ordinary
  # correction commit and tree have completed review.
  PF4163_MERGE_COMMIT="${PAPERSFLOW_PF4163_MERGE_COMMIT:-d82d954d4f0cf863b9e5a2634122eb5c2d904efc}"
  PF4163_FORK_PARENT="${PAPERSFLOW_PF4163_FORK_PARENT:-207efdbf9920909d9444709849791d0a6d42fdfd}"
  PF4163_UPSTREAM_PARENT="${PAPERSFLOW_PF4163_UPSTREAM_PARENT:-23c232d780afe4fca07f7729f2d698cc15bb1d20}"
  PF4163_REVIEWED_TREE="${PAPERSFLOW_PF4163_REVIEWED_TREE:-4840e0ce8c48c9b85c1fd23beab43125877001a6}"
  PF4163_CORRECTION_HEAD="${PAPERSFLOW_PF4163_CORRECTION_HEAD:-b298af9673713b64da4c87c5192fd324bd2035fc}"
  PF4163_CORRECTION_TREE="${PAPERSFLOW_PF4163_CORRECTION_TREE:-18619ba2efff2305f3f25142fdfb877297a2cf61}"
  readonly \
    PF4163_HEAD_REPOSITORY PF4163_HEAD_REF PF4163_BASE_REF \
    PF4163_MERGE_COMMIT PF4163_FORK_PARENT PF4163_UPSTREAM_PARENT PF4163_REVIEWED_TREE \
    PF4163_CORRECTION_HEAD PF4163_CORRECTION_TREE \
    PF4163_PENDING_MERGE_COMMIT PF4163_PENDING_FORK_PARENT PF4163_PENDING_REVIEWED_TREE \
    PF4163_PENDING_CORRECTION_HEAD PF4163_PENDING_CORRECTION_TREE
}

pf4163_install_allowlist() {
  # This is the complete frozen install-path surface generated from the
  # reviewed F...S source diff, using recursive native Git pathspecs. The
  # six manually resolved graph files are recorded separately in the source
  # provenance manifest and are a subset of this 115-path surface.
  # Source surface: F=207efdbf9920909d9444709849791d0a6d42fdfd,
  # S=d82d954d4f0cf863b9e5a2634122eb5c2d904efc,
  # list SHA-256=37b646e8c8516937d26ea892fa77eadc3ac0e586238240da45c8a027f8bda4dc.
  cat <<'EOF'
auth/studio/package.json
browser/_test-utils/package.json
browser/agent-browser/package.json
browser/firecrawl/package.json
browser/stagehand/package.json
client-sdks/ai-sdk/package.json
client-sdks/client-js/package.json
client-sdks/react/package.json
deployers/cloud/package.json
deployers/cloudflare/package.json
deployers/netlify/package.json
deployers/sandbox/package.json
deployers/vercel/package.json
docs/package.json
e2e-tests/experiment-worker/package.json
e2e-tests/experiment-worker/pnpm-lock.yaml
e2e-tests/workspace-compat/package.json
explorations/longmemeval/package.json
integrations/livekit/package.json
integrations/opencode/package.json
mastracode/factory/package.json
mastracode/mastra-factory/package.json
mastracode/sdk/package.json
mastracode/tui/package.json
mastracode/web/package.json
observability/_examples/otel-bridge/agent-hub/package.json
observability/_examples/otel-bridge/agent-hub/pnpm-lock.yaml
observability/_examples/otel-bridge/agent-hub/pnpm-workspace.yaml
observability/arize/package.json
observability/arthur/package.json
observability/braintrust/package.json
observability/datadog/package.json
observability/deepeval/package.json
observability/laminar/package.json
observability/langfuse/package.json
observability/langsmith/package.json
observability/mastra/package.json
observability/otel-bridge/package.json
observability/otel-exporter/package.json
observability/posthog/package.json
observability/sentry/package.json
packages/_changeset-cli/package.json
packages/_config/package.json
packages/_external-types/package.json
packages/_internals/auth/package.json
packages/_internals/voice/package.json
packages/_internals/workspace/package.json
packages/_llm-recorder/package.json
packages/_test-utils/package.json
packages/_types-builder/package.json
packages/_vendored/ai_v4/package.json
packages/_vendored/ai_v5/package.json
packages/_vendored/ai_v6/package.json
packages/_vendored/ai_v7/package.json
packages/agent-builder/package.json
packages/cli/package.json
packages/core/package.json
packages/create-mastra/package.json
packages/deployer/package.json
packages/editor/package.json
packages/evals/package.json
packages/loggers/package.json
packages/mcp-docs-server/package.json
packages/mcp/package.json
packages/memory/package.json
packages/playground-ui/package.json
packages/playground/package.json
packages/rag/package.json
packages/schema-compat/package.json
packages/server/package.json
pnpm-lock.yaml
pnpm-workspace.yaml
pubsub/redis-streams/package.json
pubsub/valkey-streams/package.json
server-adapters/elysia/package.json
server-adapters/express/package.json
server-adapters/fastify/package.json
server-adapters/hono/package.json
server-adapters/koa/package.json
server-adapters/nestjs/package.json
server-adapters/next/package.json
server-adapters/tanstack-start/package.json
stores/_test-utils/package.json
stores/clickhouse/package.json
stores/convex/package.json
stores/dsql/package.json
stores/duckdb/package.json
stores/elasticsearch/package.json
stores/libsql/package.json
stores/mongodb/package.json
stores/mssql/package.json
stores/mysql/package.json
stores/oracledb/package.json
stores/pg/package.json
stores/redis/package.json
stores/spanner/package.json
stores/turso/package.json
stores/upstash/package.json
stores/valkey/package.json
voice/google-gemini-live-api/package.json
voice/openai-realtime-api/package.json
voice/xai-realtime-api/package.json
workflows/inngest/package.json
workflows/temporal/package.json
workspaces/_test-utils/package.json
workspaces/archil/package.json
workspaces/blaxel/package.json
workspaces/cloudflare-sandbox/package.json
workspaces/daytona/package.json
workspaces/docker/package.json
workspaces/e2b-desktop/package.json
workspaces/e2b/package.json
workspaces/platform-workspace/package.json
workspaces/s3/package.json
workspaces/vercel/package.json
EOF
}

pf3375_config() {
  PF3375_HEAD_REPOSITORY="${PAPERSFLOW_PF3375_HEAD_REPOSITORY:-mbenhamd/mastra}"
  PF3375_HEAD_REF="${PAPERSFLOW_PF3375_HEAD_REF:-feature/pf-3375-mastra-upstream-sync-372b1a71}"
  PF3375_BASE_REF="${PAPERSFLOW_PF3375_BASE_REF:-main}"
  PF3375_MERGE_COMMIT="${PAPERSFLOW_PF3375_MERGE_COMMIT:-69cbed9fcacc118a7b26b04e1f2815e53f22917f}"
  PF3375_FORK_PARENT="${PAPERSFLOW_PF3375_FORK_PARENT:-e5f5f4a5dd3c58a06a17f931d49d8f1567783cd4}"
  PF3375_UPSTREAM_PARENT="${PAPERSFLOW_PF3375_UPSTREAM_PARENT:-372b1a71d670deeb958e4fa3d7cfeddef225a617}"
  PF3375_REVIEWED_TREE="${PAPERSFLOW_PF3375_REVIEWED_TREE:-728c6408525c0f31ec57905aebc739432a8dfa81}"
  readonly \
    PF3375_HEAD_REPOSITORY PF3375_HEAD_REF PF3375_BASE_REF PF3375_MERGE_COMMIT \
    PF3375_FORK_PARENT PF3375_UPSTREAM_PARENT PF3375_REVIEWED_TREE
}

pf3020_config() {
  PF3020_HEAD_REPOSITORY="${PAPERSFLOW_PF3020_HEAD_REPOSITORY:-mbenhamd/mastra}"
  PF3020_HEAD_REF="${PAPERSFLOW_PF3020_HEAD_REF:-feature/pf-3020-mastra-upstream-sync-b8ce7ec9}"
  PF3020_BASE_REF="${PAPERSFLOW_PF3020_BASE_REF:-main}"
  PF3020_MERGE_COMMIT="${PAPERSFLOW_PF3020_MERGE_COMMIT:-a89fbab3c65d17cd4673b5fc308f3bd7fb4fb7c6}"
  PF3020_FORK_PARENT="${PAPERSFLOW_PF3020_FORK_PARENT:-ae3b0916b6a7735cb48fa34d68b8035b4848c7d5}"
  PF3020_UPSTREAM_PARENT="${PAPERSFLOW_PF3020_UPSTREAM_PARENT:-b8ce7ec96e39343c6c2f36d12d68a9ad816c09f7}"
  PF3020_REVIEWED_TREE="${PAPERSFLOW_PF3020_REVIEWED_TREE:-b2f1f62166e3902e394e1075562e0da6dcd0cdb3}"
  readonly \
    PF3020_HEAD_REPOSITORY PF3020_HEAD_REF PF3020_BASE_REF PF3020_MERGE_COMMIT \
    PF3020_FORK_PARENT PF3020_UPSTREAM_PARENT PF3020_REVIEWED_TREE
}

pf2576_config() {
  PF2576_HEAD_REPOSITORY="${PAPERSFLOW_PF2576_HEAD_REPOSITORY:-mbenhamd/mastra}"
  PF2576_HEAD_REF="${PAPERSFLOW_PF2576_HEAD_REF:-papersflow/pf-2576-upstream-sync-20260801}"
  PF2576_BASE_REF="${PAPERSFLOW_PF2576_BASE_REF:-main}"
  PF2576_MERGE_COMMIT="${PAPERSFLOW_PF2576_MERGE_COMMIT:-c888fb1d2f82a85f09f9f55d051a4f7cf4c06e41}"
  PF2576_FORK_PARENT="${PAPERSFLOW_PF2576_FORK_PARENT:-a29df1a5084245138b52c148875763ee5498a495}"
  PF2576_UPSTREAM_PARENT="${PAPERSFLOW_PF2576_UPSTREAM_PARENT:-cc85af24250f406f43fa8ef736f1bee6855dc57a}"
  PF2576_REVIEWED_TREE="${PAPERSFLOW_PF2576_REVIEWED_TREE:-9fa41d62d7176c8773a2b5cc41814d6a53b2a20a}"
  readonly \
    PF2576_HEAD_REPOSITORY PF2576_HEAD_REF PF2576_BASE_REF PF2576_MERGE_COMMIT \
    PF2576_FORK_PARENT PF2576_UPSTREAM_PARENT PF2576_REVIEWED_TREE
}

pf2247_config() {
  PF2247_HEAD_REPOSITORY="${PAPERSFLOW_PF2247_HEAD_REPOSITORY:-mbenhamd/mastra}"
  PF2247_HEAD_REF="${PAPERSFLOW_PF2247_HEAD_REF:-feature/pf-2247-upstream-sync-a81d3c24}"
  PF2247_BASE_REF="${PAPERSFLOW_PF2247_BASE_REF:-main}"
  PF2247_MERGE_COMMIT="${PAPERSFLOW_PF2247_MERGE_COMMIT:-8dc172076b4fe7fbf984afe3bd0a7d76da21df12}"
  PF2247_FORK_PARENT="${PAPERSFLOW_PF2247_FORK_PARENT:-b2222c28f151592e396ff02a40c41ac8d6f0ca40}"
  PF2247_UPSTREAM_PARENT="${PAPERSFLOW_PF2247_UPSTREAM_PARENT:-a81d3c2499092b2c0578f5d8785ddc32e6f7bc39}"
  PF2247_REVIEWED_TREE="${PAPERSFLOW_PF2247_REVIEWED_TREE:-3b5ab0370820fc076bb8bc0fb864463fbb5bd4ed}"
  readonly \
    PF2247_HEAD_REPOSITORY PF2247_HEAD_REF PF2247_BASE_REF PF2247_MERGE_COMMIT \
    PF2247_FORK_PARENT PF2247_UPSTREAM_PARENT PF2247_REVIEWED_TREE
}

pf2042_config() {
  PF2042_INNGEST_TEST_BLOB="${PAPERSFLOW_PF2042_INNGEST_TEST_BLOB:-f6ce426a4f389d45c2c5f345cca5b511b4a85885}"
  PF2042_INNGEST_TEST_SHA256="${PAPERSFLOW_PF2042_INNGEST_TEST_SHA256:-f50ee827b50e669c16009ca492a87df81631e9ad8d65bd853d2fabacb5b56b34}"
  PF2042_INNGEST_COMPOSE_BLOB="${PAPERSFLOW_PF2042_INNGEST_COMPOSE_BLOB:-db69236f8e87d48f192d889e0951b7b972105935}"
  PF2042_INNGEST_COMPOSE_SHA256="${PAPERSFLOW_PF2042_INNGEST_COMPOSE_SHA256:-a71433863378c1bcb46a331598ee671efcb117e4d29ffb69d37f68c21b5ef267}"
  PF2042_INNGEST_ADAPTER_BLOB="${PAPERSFLOW_PF2042_INNGEST_ADAPTER_BLOB:-1318d79a99dd7a19149cd14aadade33d99167b5c}"
  PF2042_INNGEST_ADAPTER_SHA256="${PAPERSFLOW_PF2042_INNGEST_ADAPTER_SHA256:-260f3de91533e4234b0388c55ec8a55e985594bc882d14095372439d56dd61dc}"
  readonly \
    PF2042_INNGEST_TEST_BLOB PF2042_INNGEST_TEST_SHA256 \
    PF2042_INNGEST_COMPOSE_BLOB PF2042_INNGEST_COMPOSE_SHA256 \
    PF2042_INNGEST_ADAPTER_BLOB PF2042_INNGEST_ADAPTER_SHA256
}

pf2045_config() {
  PF2045_HEAD_REPOSITORY="${PAPERSFLOW_PF2045_HEAD_REPOSITORY:-mbenhamd/mastra}"
  PF2045_HEAD_REF="${PAPERSFLOW_PF2045_HEAD_REF:-feature/pf-2045-mastra-fork-merge-official-main-through-4fb4d881-before-the}"
  PF2045_BASE_REF="${PAPERSFLOW_PF2045_BASE_REF:-main}"
  PF2045_UPSTREAM_PARENT="${PAPERSFLOW_PF2045_UPSTREAM_PARENT:-4fb4d881bc107acee13890ad4d78661016c510ed}"
  PF2045_REHEARSED_BASE="${PAPERSFLOW_PF2045_REHEARSED_BASE:-711010569312141e3792be3e864ce20f010d433b}"
  PF2045_REHEARSED_TREE="${PAPERSFLOW_PF2045_REHEARSED_TREE:-61e80433d05f7bf97bd51950ebab786c0a829a29}"
  PF2045_UPSTREAM_DELTA_PATH_COUNT="${PAPERSFLOW_PF2045_UPSTREAM_DELTA_PATH_COUNT:-313}"
  PF2045_RECONCILED_PATH_COUNT="${PAPERSFLOW_PF2045_RECONCILED_PATH_COUNT:-312}"
  PF2045_CONFLICT_FILE_COUNT="${PAPERSFLOW_PF2045_CONFLICT_FILE_COUNT:-6}"
  PF2045_CONFLICT_STAGE_COUNT="${PAPERSFLOW_PF2045_CONFLICT_STAGE_COUNT:-18}"
  PF2045_CONFLICT_REGION_COUNT="${PAPERSFLOW_PF2045_CONFLICT_REGION_COUNT:-26}"
  PF2045_CONFLICT_STAGES="${PAPERSFLOW_PF2045_CONFLICT_STAGES:-$(cat <<'EOF'
100644 5d65c16bff06c8632e3c442167c4bfe0a14b8236 1	client-sdks/ai-sdk/src/__tests__/tool-call-approval.test.ts
100644 93f17f2ad7b35bab03dc9c5fe578ef839c987b33 2	client-sdks/ai-sdk/src/__tests__/tool-call-approval.test.ts
100644 9df5a5ef3ea077ffe73e66bd8e18813efe90e3c8 3	client-sdks/ai-sdk/src/__tests__/tool-call-approval.test.ts
100644 0c23d10bbfc542c446fa615d01bb4de73a2c729e 1	client-sdks/ai-sdk/src/chat-route.ts
100644 18e2715d2273f73dbe4067024216b4ffef213e43 2	client-sdks/ai-sdk/src/chat-route.ts
100644 a7987e8d5d151e7227323b5c2309d2436e289715 3	client-sdks/ai-sdk/src/chat-route.ts
100644 ec49e9e4418809226773a98010b39d1121d022ea 1	packages/core/src/agent/utils.ts
100644 ba2f2c11b98019d71f4f6f689ccbb81febbbee1e 2	packages/core/src/agent/utils.ts
100644 3c1ea79fa05d8de722f588f8cc31e0b5269eb976 3	packages/core/src/agent/utils.ts
100644 a01701c323899b10e9c0145ae2f62c9f3a1b0f26 1	packages/server/src/server/handlers/agents.ts
100644 c56099bdd0207548e7ae85c71e3eb9c0fd1a2b52 2	packages/server/src/server/handlers/agents.ts
100644 7c0d9a104e449a8ae9770d507671415f8059eb48 3	packages/server/src/server/handlers/agents.ts
100644 3cc4556f8fd061e8a15cb545f64257f7dd77f993 1	pnpm-lock.yaml
100644 11f12c4885dc79ada34d724bb64e63f413f4eb2a 2	pnpm-lock.yaml
100644 25898723f430d02ecd8251d2b254b3608d4030a7 3	pnpm-lock.yaml
100644 5ace0c307607cacf36f7b120549b492cf867dfac 1	pnpm-workspace.yaml
100644 10c6a79cbf59cac968146ceae7c2e376471544af 2	pnpm-workspace.yaml
100644 fa4157364d838a3d32e6b9f28b0d888121d73752 3	pnpm-workspace.yaml
EOF
)}"
  PF2045_AI_SDK_APPROVAL_TEST_BLOB="${PAPERSFLOW_PF2045_AI_SDK_APPROVAL_TEST_BLOB:-df1710b70f62a4f4c3db5c11cf3eaec3fb02677b}"
  PF2045_AI_SDK_APPROVAL_TEST_SHA256="${PAPERSFLOW_PF2045_AI_SDK_APPROVAL_TEST_SHA256:-409d580dbaa37d7ea9f23e7d825f9d28df97db27a958a7a5da0a5ef89ff10d6a}"
  PF2045_AI_SDK_APPROVAL_E2E_BLOB="${PAPERSFLOW_PF2045_AI_SDK_APPROVAL_E2E_BLOB:-347dbf518e609c31207404541a3698775d491b9d}"
  PF2045_AI_SDK_APPROVAL_E2E_SHA256="${PAPERSFLOW_PF2045_AI_SDK_APPROVAL_E2E_SHA256:-591578986df9940167659b3d483a9f316a1fd2cd1e8b50c5c0259980ba42cb79}"
  PF2045_AI_SDK_CHAT_ROUTE_BLOB="${PAPERSFLOW_PF2045_AI_SDK_CHAT_ROUTE_BLOB:-e274c49eb7ba1dd7e0100754c85f92ea111be77c}"
  PF2045_AI_SDK_CHAT_ROUTE_SHA256="${PAPERSFLOW_PF2045_AI_SDK_CHAT_ROUTE_SHA256:-4cba0eaa885a8ea723458ac5743d056655b5470802665cec6f3af1ee14fa9af5}"
  PF2045_AI_SDK_CHANGESET_BLOB="${PAPERSFLOW_PF2045_AI_SDK_CHANGESET_BLOB:-fcf40a92208ced60beaadbdce9512070af6b0ce9}"
  PF2045_AI_SDK_CHANGESET_SHA256="${PAPERSFLOW_PF2045_AI_SDK_CHANGESET_SHA256:-b7bc0670a4f39b5b4781473a4a961c8eca6a2fe04af0fb3b15ed918df81932c7}"
  PF2045_AGENT_UTILS_BLOB="${PAPERSFLOW_PF2045_AGENT_UTILS_BLOB:-bcea886bbd2d562dabfd59d8fdbac4f9251c914e}"
  PF2045_AGENT_UTILS_SHA256="${PAPERSFLOW_PF2045_AGENT_UTILS_SHA256:-f87ab4652d7157b82db9d988c0efe6f7a5cb1e17914b8a35419eaab7a38cc9bb}"
  PF2045_AGENTS_BLOB="${PAPERSFLOW_PF2045_AGENTS_BLOB:-2374de06de2e73898b31844ad6ae672dcb9fa537}"
  PF2045_AGENTS_SHA256="${PAPERSFLOW_PF2045_AGENTS_SHA256:-d31254afb5b298b5df1b1f6ffac78d27bdd47aa04b3654304a9adc8b777d012b}"
  PF2045_LOCKFILE_BLOB="${PAPERSFLOW_PF2045_LOCKFILE_BLOB:-08a229cbba5a62352453959feabdca1be414195d}"
  PF2045_LOCKFILE_SHA256="${PAPERSFLOW_PF2045_LOCKFILE_SHA256:-1ad788bded52c41ba8b723e9098b1a77eb69f687a2378adfec906ce6ee5bccc0}"
  PF2045_WORKSPACE_BLOB="${PAPERSFLOW_PF2045_WORKSPACE_BLOB:-10c6a79cbf59cac968146ceae7c2e376471544af}"
  PF2045_WORKSPACE_SHA256="${PAPERSFLOW_PF2045_WORKSPACE_SHA256:-eeb02bff3f4b79eebca83103bf114f48c097a5d985ba72789a5a73a0408408fb}"
  readonly \
    PF2045_HEAD_REPOSITORY PF2045_HEAD_REF PF2045_BASE_REF PF2045_UPSTREAM_PARENT \
    PF2045_REHEARSED_BASE PF2045_REHEARSED_TREE \
    PF2045_UPSTREAM_DELTA_PATH_COUNT PF2045_RECONCILED_PATH_COUNT PF2045_CONFLICT_FILE_COUNT \
    PF2045_CONFLICT_STAGE_COUNT PF2045_CONFLICT_REGION_COUNT PF2045_CONFLICT_STAGES \
    PF2045_AI_SDK_APPROVAL_TEST_BLOB PF2045_AI_SDK_APPROVAL_TEST_SHA256 \
    PF2045_AI_SDK_APPROVAL_E2E_BLOB PF2045_AI_SDK_APPROVAL_E2E_SHA256 \
    PF2045_AI_SDK_CHAT_ROUTE_BLOB PF2045_AI_SDK_CHAT_ROUTE_SHA256 \
    PF2045_AI_SDK_CHANGESET_BLOB PF2045_AI_SDK_CHANGESET_SHA256 \
    PF2045_AGENT_UTILS_BLOB PF2045_AGENT_UTILS_SHA256 \
    PF2045_AGENTS_BLOB PF2045_AGENTS_SHA256 PF2045_LOCKFILE_BLOB PF2045_LOCKFILE_SHA256 \
    PF2045_WORKSPACE_BLOB PF2045_WORKSPACE_SHA256
}

verify_pf2045_reviewed_tree() (
  : "${BASE_SHA:?BASE_SHA is required}"
  : "${HEAD_SHA:?HEAD_SHA is required}"

  local merge_tree_output merge_tree_status synthetic_tree expected_tree actual_tree
  local expected_stages actual_stages temporary_index merge_file_output
  local path blob expected_sha actual_sha head_entry
  local upstream_merge_base upstream_delta_path_count reconciled_path_count
  local conflict_file_count conflict_stage_count
  local base_blob ours_blob theirs_blob merge_file_status conflict_regions total_conflict_regions

  merge_tree_output="$(mktemp)"
  expected_stages="$(mktemp)"
  actual_stages="$(mktemp)"
  temporary_index="$(mktemp)"
  merge_file_output="$(mktemp)"
  rm -f "$temporary_index"
  trap 'rm -f "$merge_tree_output" "$expected_stages" "$actual_stages" "$temporary_index" "$merge_file_output"' EXIT

  upstream_merge_base="$(git merge-base "$BASE_SHA" "$PF2045_UPSTREAM_PARENT")"
  upstream_delta_path_count="$(
    git diff --no-renames --name-only "$upstream_merge_base..$PF2045_UPSTREAM_PARENT" |
      wc -l |
      tr -d ' '
  )"
  if [[ "$upstream_delta_path_count" != "$PF2045_UPSTREAM_DELTA_PATH_COUNT" ]]; then
    echo 'PF-2045 reviewed official-upstream delta path count changed.' >&2
    echo "expected: $PF2045_UPSTREAM_DELTA_PATH_COUNT" >&2
    echo "actual:   $upstream_delta_path_count" >&2
    return 1
  fi

  set +e
  git merge-tree --write-tree "$BASE_SHA" "$PF2045_UPSTREAM_PARENT" > "$merge_tree_output" 2>&1
  merge_tree_status=$?
  set -e
  if (( merge_tree_status != 1 )); then
    echo 'PF-2045 reviewed merge must produce exactly the six rehearsed content conflicts.' >&2
    cat "$merge_tree_output" >&2
    return 1
  fi

  synthetic_tree="$(sed -n '1p' "$merge_tree_output")"
  if ! [[ "$synthetic_tree" =~ ^[0-9a-f]{40,64}$ ]] ||
    [[ "$(git cat-file -t "$synthetic_tree" 2>/dev/null || true)" != tree ]]; then
    echo 'PF-2045 merge-tree did not produce a valid synthetic tree.' >&2
    cat "$merge_tree_output" >&2
    return 1
  fi

  printf '%s\n' "$PF2045_CONFLICT_STAGES" | LC_ALL=C sort > "$expected_stages"
  sed -nE '/^100644 [0-9a-f]{40,64} [123]\t.*$/p' "$merge_tree_output" |
    LC_ALL=C sort > "$actual_stages"
  conflict_stage_count="$(wc -l < "$actual_stages" | tr -d ' ')"
  conflict_file_count="$(cut -f2 "$actual_stages" | LC_ALL=C sort -u | wc -l | tr -d ' ')"
  if ! cmp -s "$expected_stages" "$actual_stages" ||
    [[ "$conflict_stage_count" != "$PF2045_CONFLICT_STAGE_COUNT" ]] ||
    [[ "$conflict_file_count" != "$PF2045_CONFLICT_FILE_COUNT" ]]; then
    echo "PF-2045 merge conflict inputs differ from the ${PF2045_CONFLICT_STAGE_COUNT} reviewed base/ours/theirs blobs." >&2
    diff -u "$expected_stages" "$actual_stages" >&2 || true
    cat "$merge_tree_output" >&2
    return 1
  fi

  total_conflict_regions=0
  while IFS= read -r path; do
    base_blob="$(awk -v path="$path" '$3 == 1 && $4 == path { print $2 }' "$actual_stages")"
    ours_blob="$(awk -v path="$path" '$3 == 2 && $4 == path { print $2 }' "$actual_stages")"
    theirs_blob="$(awk -v path="$path" '$3 == 3 && $4 == path { print $2 }' "$actual_stages")"
    set +e
    git merge-file -p --diff3 --object-id "$ours_blob" "$base_blob" "$theirs_blob" > "$merge_file_output"
    merge_file_status=$?
    set -e
    conflict_regions="$(grep -c '^<<<<<<< ' "$merge_file_output" || true)"
    if (( merge_file_status == 0 || conflict_regions == 0 )); then
      echo "PF-2045 reviewed conflict no longer produces a content conflict: $path" >&2
      return 1
    fi
    total_conflict_regions=$((total_conflict_regions + conflict_regions))
  done < <(cut -f2 "$actual_stages" | LC_ALL=C sort -u)
  if (( total_conflict_regions != PF2045_CONFLICT_REGION_COUNT )); then
    echo 'PF-2045 reviewed merge conflict-region count changed.' >&2
    echo "expected: $PF2045_CONFLICT_REGION_COUNT" >&2
    echo "actual:   $total_conflict_regions" >&2
    return 1
  fi

  while IFS='|' read -r path blob expected_sha; do
    if [[ "$(git cat-file -t "$blob" 2>/dev/null || true)" != blob ]]; then
      echo "PF-2045 reviewed content blob is unavailable: $path ($blob)" >&2
      return 1
    fi
    actual_sha="$(git cat-file blob "$blob" | sha256sum | awk '{print $1}')"
    if [[ "$actual_sha" != "$expected_sha" ]]; then
      echo "PF-2045 reviewed content SHA-256 mismatch: $path" >&2
      return 1
    fi
    head_entry="$(git ls-tree "$HEAD_SHA" -- "$path")"
    if [[ "$head_entry" != $'100644 blob '"$blob"$'\t'"$path" ]]; then
      echo "PF-2045 head does not contain the reviewed regular-file content: $path" >&2
      return 1
    fi
  done <<EOF
.changeset/fresh-donuts-divide.md|$PF2045_AI_SDK_CHANGESET_BLOB|$PF2045_AI_SDK_CHANGESET_SHA256
client-sdks/ai-sdk/src/__tests__/tool-call-approval.e2e.test.ts|$PF2045_AI_SDK_APPROVAL_E2E_BLOB|$PF2045_AI_SDK_APPROVAL_E2E_SHA256
client-sdks/ai-sdk/src/__tests__/tool-call-approval.test.ts|$PF2045_AI_SDK_APPROVAL_TEST_BLOB|$PF2045_AI_SDK_APPROVAL_TEST_SHA256
client-sdks/ai-sdk/src/chat-route.ts|$PF2045_AI_SDK_CHAT_ROUTE_BLOB|$PF2045_AI_SDK_CHAT_ROUTE_SHA256
packages/core/src/agent/utils.ts|$PF2045_AGENT_UTILS_BLOB|$PF2045_AGENT_UTILS_SHA256
packages/server/src/server/handlers/agents.ts|$PF2045_AGENTS_BLOB|$PF2045_AGENTS_SHA256
pnpm-lock.yaml|$PF2045_LOCKFILE_BLOB|$PF2045_LOCKFILE_SHA256
pnpm-workspace.yaml|$PF2045_WORKSPACE_BLOB|$PF2045_WORKSPACE_SHA256
EOF

  GIT_INDEX_FILE="$temporary_index" git read-tree "$synthetic_tree"
  GIT_INDEX_FILE="$temporary_index" git update-index --add --cacheinfo \
    100644 "$PF2045_AI_SDK_CHANGESET_BLOB" .changeset/fresh-donuts-divide.md
  GIT_INDEX_FILE="$temporary_index" git update-index --add --cacheinfo \
    100644 "$PF2045_AI_SDK_APPROVAL_E2E_BLOB" client-sdks/ai-sdk/src/__tests__/tool-call-approval.e2e.test.ts
  GIT_INDEX_FILE="$temporary_index" git update-index --add --cacheinfo \
    100644 "$PF2045_AI_SDK_APPROVAL_TEST_BLOB" client-sdks/ai-sdk/src/__tests__/tool-call-approval.test.ts
  GIT_INDEX_FILE="$temporary_index" git update-index --add --cacheinfo \
    100644 "$PF2045_AI_SDK_CHAT_ROUTE_BLOB" client-sdks/ai-sdk/src/chat-route.ts
  GIT_INDEX_FILE="$temporary_index" git update-index --add --cacheinfo \
    100644 "$PF2045_AGENT_UTILS_BLOB" packages/core/src/agent/utils.ts
  GIT_INDEX_FILE="$temporary_index" git update-index --add --cacheinfo \
    100644 "$PF2045_AGENTS_BLOB" packages/server/src/server/handlers/agents.ts
  GIT_INDEX_FILE="$temporary_index" git update-index --add --cacheinfo \
    100644 "$PF2045_LOCKFILE_BLOB" pnpm-lock.yaml
  GIT_INDEX_FILE="$temporary_index" git update-index --add --cacheinfo \
    100644 "$PF2045_WORKSPACE_BLOB" pnpm-workspace.yaml
  expected_tree="$(GIT_INDEX_FILE="$temporary_index" git write-tree)"
  actual_tree="$(git rev-parse "$HEAD_SHA^{tree}")"
  if [[ "$BASE_SHA" == "$PF2045_REHEARSED_BASE" && "$expected_tree" != "$PF2045_REHEARSED_TREE" ]]; then
    echo 'PF-2045 exact rehearsal no longer reconstructs its frozen reviewed tree.' >&2
    echo "expected: $PF2045_REHEARSED_TREE" >&2
    echo "actual:   $expected_tree" >&2
    return 1
  fi
  if [[ "$actual_tree" != "$expected_tree" ]]; then
    echo 'PF-2045 head tree does not match the reconstructed reviewed merge tree.' >&2
    echo "expected: $expected_tree" >&2
    echo "actual:   $actual_tree" >&2
    return 1
  fi

  reconciled_path_count="$(
    git diff --no-renames --name-only "$BASE_SHA..$HEAD_SHA" |
      wc -l |
      tr -d ' '
  )"
  if [[ "$reconciled_path_count" != "$PF2045_RECONCILED_PATH_COUNT" ]]; then
    echo 'PF-2045 reviewed reconciled first-parent path count changed.' >&2
    echo "expected: $PF2045_RECONCILED_PATH_COUNT" >&2
    echo "actual:   $reconciled_path_count" >&2
    return 1
  fi
)

verify_pf4051_reviewed_merge() (
  : "${BASE_SHA:?BASE_SHA is required}"
  : "${HEAD_SHA:?HEAD_SHA is required}"

  local merge_topology actual_tree protected_merge_bases

  if [[ "$PF4051_MERGE_COMMIT" == "$PF4051_PENDING_MERGE_COMMIT" || \
    "$PF4051_REVIEWED_TREE" == "$PF4051_PENDING_REVIEWED_TREE" ]]; then
    echo 'PF-4051 exact-sync admission pins are pending; refusing admission.' >&2
    return 1
  fi

  if [[ "$HEAD_SHA" != "$PF4051_MERGE_COMMIT" ]]; then
    echo 'PF-4051 head is not the exact reviewed merge commit.' >&2
    echo "expected: $PF4051_MERGE_COMMIT" >&2
    echo "actual:   $HEAD_SHA" >&2
    return 1
  fi

  merge_topology="$(git rev-list --parents -n 1 "$HEAD_SHA")"
  if [[ "$merge_topology" != "$HEAD_SHA $PF4051_FORK_PARENT $PF4051_MAIN_PARENT" ]]; then
    echo 'PF-4051 head is not the exact reviewed two-parent reconciliation merge topology.' >&2
    echo "expected: $HEAD_SHA $PF4051_FORK_PARENT $PF4051_MAIN_PARENT" >&2
    echo "actual:   $merge_topology" >&2
    return 1
  fi

  actual_tree="$(git rev-parse "$HEAD_SHA^{tree}")"
  if [[ "$actual_tree" != "$PF4051_REVIEWED_TREE" ]]; then
    echo 'PF-4051 head tree does not match the reviewed merge tree.' >&2
    echo "expected: $PF4051_REVIEWED_TREE" >&2
    echo "actual:   $actual_tree" >&2
    return 1
  fi

  # The source reconciles the frozen upstream sync with the landed fork main.
  # A later CI-only prerequisite shares exactly that main, never extra ancestry.
  if ! git merge-base --is-ancestor "$PF4051_TRUSTED_MAIN" "$BASE_SHA" ||
    ! git merge-base --is-ancestor "$PF4051_TRUSTED_MAIN" "$PF4051_MAIN_PARENT"; then
    echo 'PF-4051 protected base or main parent lacks the reviewed trusted ancestry.' >&2
    return 1
  fi
  protected_merge_bases="$(git merge-base --all "$BASE_SHA" "$HEAD_SHA")"
  if [[ "$protected_merge_bases" != "$PF4051_TRUSTED_MAIN" ]]; then
    echo 'PF-4051 protected base and reviewed head do not have the exact reviewed intersection.' >&2
    echo "expected: $PF4051_TRUSTED_MAIN" >&2
    echo "actual:   $protected_merge_bases" >&2
    return 1
  fi
  if ! git merge-base --is-ancestor "$PF4051_UPSTREAM_PARENT" "$PF4051_FORK_PARENT"; then
    echo 'PF-4051 source parent does not contain the reviewed official upstream parent.' >&2
    return 1
  fi
)

verify_pf4163_install_allowlist() (
  : "${BASE_SHA:?BASE_SHA is required}"
  : "${HEAD_SHA:?HEAD_SHA is required}"

  local expected_paths actual_paths
  expected_paths="$(mktemp)"
  actual_paths="$(mktemp)"
  trap 'rm -f "$expected_paths" "$actual_paths"' EXIT

  pf4163_install_allowlist | sort -u > "$expected_paths"
  git diff --no-renames --name-only "${BASE_SHA}...${HEAD_SHA}" -- \
    .npmrc .pnpmfile.cjs pnpmfile.cjs package.json pnpm-workspace.yaml pnpm-lock.yaml patches \
    ':(glob)**/.npmrc' ':(glob)**/.pnpmfile.cjs' ':(glob)**/pnpmfile.cjs' \
    ':(glob)**/package.json' ':(glob)**/pnpm-workspace.yaml' \
    ':(glob)**/pnpm-lock.yaml' ':(glob)**/patches/**' |
    sort -u > "$actual_paths"
  if ! cmp -s "$expected_paths" "$actual_paths"; then
    echo 'PF-4163 changed dependency-graph paths outside the frozen install allowlist:' >&2
    diff -u "$expected_paths" "$actual_paths" >&2 || true
    return 1
  fi
)

verify_pf4163_reviewed_merge() (
  : "${BASE_SHA:?BASE_SHA is required}"
  : "${HEAD_SHA:?HEAD_SHA is required}"

  local correction_topology actual_correction_tree source_topology actual_source_tree
  local protected_merge_bases

  if [[ "$PF4163_MERGE_COMMIT" == "$PF4163_PENDING_MERGE_COMMIT" || \
    "$PF4163_FORK_PARENT" == "$PF4163_PENDING_FORK_PARENT" || \
    "$PF4163_REVIEWED_TREE" == "$PF4163_PENDING_REVIEWED_TREE" || \
    "$PF4163_CORRECTION_HEAD" == "$PF4163_PENDING_CORRECTION_HEAD" || \
    "$PF4163_CORRECTION_TREE" == "$PF4163_PENDING_CORRECTION_TREE" ]]; then
    echo 'PF-4163 exact-sync admission pins are pending; refusing admission.' >&2
    return 1
  fi

  if [[ "$HEAD_SHA" != "$PF4163_CORRECTION_HEAD" ]]; then
    echo 'PF-4163 head is not the exact reviewed correction commit.' >&2
    echo "expected: $PF4163_CORRECTION_HEAD" >&2
    echo "actual:   $HEAD_SHA" >&2
    return 1
  fi

  correction_topology="$(git rev-list --parents -n 1 "$HEAD_SHA")"
  if [[ "$correction_topology" != "$HEAD_SHA $PF4163_MERGE_COMMIT" ]]; then
    echo 'PF-4163 correction head is not the exact reviewed single-parent correction atop the source merge.' >&2
    echo "expected: $HEAD_SHA $PF4163_MERGE_COMMIT" >&2
    echo "actual:   $correction_topology" >&2
    return 1
  fi

  actual_correction_tree="$(git rev-parse "$HEAD_SHA^{tree}")"
  if [[ "$actual_correction_tree" != "$PF4163_CORRECTION_TREE" ]]; then
    echo 'PF-4163 correction head tree does not match the reviewed correction tree.' >&2
    echo "expected: $PF4163_CORRECTION_TREE" >&2
    echo "actual:   $actual_correction_tree" >&2
    return 1
  fi

  source_topology="$(git rev-list --parents -n 1 "$PF4163_MERGE_COMMIT")"
  if [[ "$source_topology" != "$PF4163_MERGE_COMMIT $PF4163_FORK_PARENT $PF4163_UPSTREAM_PARENT" ]]; then
    echo 'PF-4163 source merge is not the exact reviewed two-parent upstream merge topology.' >&2
    echo "expected: $PF4163_MERGE_COMMIT $PF4163_FORK_PARENT $PF4163_UPSTREAM_PARENT" >&2
    echo "actual:   $source_topology" >&2
    return 1
  fi

  actual_source_tree="$(git rev-parse "$PF4163_MERGE_COMMIT^{tree}")"
  if [[ "$actual_source_tree" != "$PF4163_REVIEWED_TREE" ]]; then
    echo 'PF-4163 source merge tree does not match the reviewed source merge tree.' >&2
    echo "expected: $PF4163_REVIEWED_TREE" >&2
    echo "actual:   $actual_source_tree" >&2
    return 1
  fi

  # The source merge reconciles the exact fork main F with the reviewed official
  # upstream parent. The correction is one ordinary commit directly atop S.
  # A later CI-only protected-base advance C is accepted only when C and S
  # still meet exactly at F.
  if ! git merge-base --is-ancestor "$PF4163_FORK_PARENT" "$BASE_SHA"; then
    echo 'PF-4163 protected base does not descend from the reviewed fork parent.' >&2
    return 1
  fi
  protected_merge_bases="$(git merge-base --all "$BASE_SHA" "$PF4163_MERGE_COMMIT")"
  if [[ "$protected_merge_bases" != "$PF4163_FORK_PARENT" ]]; then
    echo 'PF-4163 protected base and source merge no longer meet at the reviewed fork parent.' >&2
    echo "expected: $PF4163_FORK_PARENT" >&2
    echo "actual:   $protected_merge_bases" >&2
    return 1
  fi
  if ! git merge-base --is-ancestor "$PF4163_UPSTREAM_PARENT" "$PF4163_MERGE_COMMIT"; then
    echo 'PF-4163 source merge does not contain the reviewed official upstream parent.' >&2
    return 1
  fi

  verify_pf4163_install_allowlist
)

verify_pf3375_reviewed_merge() (
  : "${BASE_SHA:?BASE_SHA is required}"
  : "${HEAD_SHA:?HEAD_SHA is required}"

  local merge_topology actual_tree protected_merge_base

  if [[ "$HEAD_SHA" != "$PF3375_MERGE_COMMIT" ]]; then
    echo 'PF-3375 head is not the exact reviewed merge commit.' >&2
    echo "expected: $PF3375_MERGE_COMMIT" >&2
    echo "actual:   $HEAD_SHA" >&2
    return 1
  fi

  merge_topology="$(git rev-list --parents -n 1 "$HEAD_SHA")"
  if [[ "$merge_topology" != "$HEAD_SHA $PF3375_FORK_PARENT $PF3375_UPSTREAM_PARENT" ]]; then
    echo 'PF-3375 head is not the exact reviewed two-parent upstream merge topology.' >&2
    echo "expected: $HEAD_SHA $PF3375_FORK_PARENT $PF3375_UPSTREAM_PARENT" >&2
    echo "actual:   $merge_topology" >&2
    return 1
  fi

  actual_tree="$(git rev-parse "$HEAD_SHA^{tree}")"
  if [[ "$actual_tree" != "$PF3375_REVIEWED_TREE" ]]; then
    echo 'PF-3375 head tree does not match the reviewed merge tree.' >&2
    echo "expected: $PF3375_REVIEWED_TREE" >&2
    echo "actual:   $actual_tree" >&2
    return 1
  fi

  if ! git merge-base --is-ancestor "$PF3375_FORK_PARENT" "$BASE_SHA"; then
    echo 'PF-3375 protected base does not descend from the reviewed fork parent.' >&2
    return 1
  fi
  protected_merge_base="$(git merge-base "$BASE_SHA" "$HEAD_SHA")"
  if [[ "$protected_merge_base" != "$PF3375_FORK_PARENT" ]]; then
    echo 'PF-3375 protected base and reviewed head no longer meet at the reviewed fork parent.' >&2
    echo "expected: $PF3375_FORK_PARENT" >&2
    echo "actual:   $protected_merge_base" >&2
    return 1
  fi
  if ! git merge-base --is-ancestor "$PF3375_UPSTREAM_PARENT" "$HEAD_SHA"; then
    echo 'PF-3375 head does not contain the reviewed official upstream parent.' >&2
    return 1
  fi
)

verify_pf3020_reviewed_merge() (
  : "${BASE_SHA:?BASE_SHA is required}"
  : "${HEAD_SHA:?HEAD_SHA is required}"

  local merge_topology actual_tree protected_merge_base

  if [[ "$HEAD_SHA" != "$PF3020_MERGE_COMMIT" ]]; then
    echo 'PF-3020 head is not the exact reviewed merge commit.' >&2
    echo "expected: $PF3020_MERGE_COMMIT" >&2
    echo "actual:   $HEAD_SHA" >&2
    return 1
  fi

  merge_topology="$(git rev-list --parents -n 1 "$HEAD_SHA")"
  if [[ "$merge_topology" != "$HEAD_SHA $PF3020_FORK_PARENT $PF3020_UPSTREAM_PARENT" ]]; then
    echo 'PF-3020 head is not the exact reviewed two-parent upstream merge topology.' >&2
    echo "expected: $HEAD_SHA $PF3020_FORK_PARENT $PF3020_UPSTREAM_PARENT" >&2
    echo "actual:   $merge_topology" >&2
    return 1
  fi

  actual_tree="$(git rev-parse "$HEAD_SHA^{tree}")"
  if [[ "$actual_tree" != "$PF3020_REVIEWED_TREE" ]]; then
    echo 'PF-3020 head tree does not match the reviewed merge tree.' >&2
    echo "expected: $PF3020_REVIEWED_TREE" >&2
    echo "actual:   $actual_tree" >&2
    return 1
  fi

  if ! git merge-base --is-ancestor "$PF3020_FORK_PARENT" "$BASE_SHA"; then
    echo 'PF-3020 protected base does not descend from the reviewed fork parent.' >&2
    return 1
  fi
  protected_merge_base="$(git merge-base "$BASE_SHA" "$HEAD_SHA")"
  if [[ "$protected_merge_base" != "$PF3020_FORK_PARENT" ]]; then
    echo 'PF-3020 protected base and reviewed head no longer meet at the reviewed fork parent.' >&2
    echo "expected: $PF3020_FORK_PARENT" >&2
    echo "actual:   $protected_merge_base" >&2
    return 1
  fi
  if ! git merge-base --is-ancestor "$PF3020_UPSTREAM_PARENT" "$HEAD_SHA"; then
    echo 'PF-3020 head does not contain the reviewed official upstream parent.' >&2
    return 1
  fi
)

verify_pf2576_reviewed_merge() (
  : "${BASE_SHA:?BASE_SHA is required}"
  : "${HEAD_SHA:?HEAD_SHA is required}"

  local merge_topology actual_tree protected_merge_base

  if [[ "$HEAD_SHA" != "$PF2576_MERGE_COMMIT" ]]; then
    echo 'PF-2576 head is not the exact reviewed merge commit.' >&2
    echo "expected: $PF2576_MERGE_COMMIT" >&2
    echo "actual:   $HEAD_SHA" >&2
    return 1
  fi

  merge_topology="$(git rev-list --parents -n 1 "$HEAD_SHA")"
  if [[ "$merge_topology" != "$HEAD_SHA $PF2576_FORK_PARENT $PF2576_UPSTREAM_PARENT" ]]; then
    echo 'PF-2576 head is not the exact reviewed two-parent upstream merge topology.' >&2
    echo "expected: $HEAD_SHA $PF2576_FORK_PARENT $PF2576_UPSTREAM_PARENT" >&2
    echo "actual:   $merge_topology" >&2
    return 1
  fi

  actual_tree="$(git rev-parse "$HEAD_SHA^{tree}")"
  if [[ "$actual_tree" != "$PF2576_REVIEWED_TREE" ]]; then
    echo 'PF-2576 head tree does not match the reviewed merge tree.' >&2
    echo "expected: $PF2576_REVIEWED_TREE" >&2
    echo "actual:   $actual_tree" >&2
    return 1
  fi

  if ! git merge-base --is-ancestor "$PF2576_FORK_PARENT" "$BASE_SHA"; then
    echo 'PF-2576 protected base does not descend from the reviewed fork parent.' >&2
    return 1
  fi
  protected_merge_base="$(git merge-base "$BASE_SHA" "$HEAD_SHA")"
  if [[ "$protected_merge_base" != "$PF2576_FORK_PARENT" ]]; then
    echo 'PF-2576 protected base and reviewed head no longer meet at the reviewed fork parent.' >&2
    echo "expected: $PF2576_FORK_PARENT" >&2
    echo "actual:   $protected_merge_base" >&2
    return 1
  fi
  if ! git merge-base --is-ancestor "$PF2576_UPSTREAM_PARENT" "$HEAD_SHA"; then
    echo 'PF-2576 head does not contain the reviewed official upstream parent.' >&2
    return 1
  fi
)

verify_pf2247_reviewed_merge() (
  : "${BASE_SHA:?BASE_SHA is required}"
  : "${HEAD_SHA:?HEAD_SHA is required}"

  local merge_topology actual_tree protected_merge_base

  if [[ "$HEAD_SHA" != "$PF2247_MERGE_COMMIT" ]]; then
    echo 'PF-2247 head is not the exact reviewed merge commit.' >&2
    echo "expected: $PF2247_MERGE_COMMIT" >&2
    echo "actual:   $HEAD_SHA" >&2
    return 1
  fi

  merge_topology="$(git rev-list --parents -n 1 "$HEAD_SHA")"
  if [[ "$merge_topology" != "$HEAD_SHA $PF2247_FORK_PARENT $PF2247_UPSTREAM_PARENT" ]]; then
    echo 'PF-2247 head is not the exact reviewed two-parent upstream merge topology.' >&2
    echo "expected: $HEAD_SHA $PF2247_FORK_PARENT $PF2247_UPSTREAM_PARENT" >&2
    echo "actual:   $merge_topology" >&2
    return 1
  fi

  actual_tree="$(git rev-parse "$HEAD_SHA^{tree}")"
  if [[ "$actual_tree" != "$PF2247_REVIEWED_TREE" ]]; then
    echo 'PF-2247 head tree does not match the reviewed merge tree.' >&2
    echo "expected: $PF2247_REVIEWED_TREE" >&2
    echo "actual:   $actual_tree" >&2
    return 1
  fi

  if ! git merge-base --is-ancestor "$PF2247_FORK_PARENT" "$BASE_SHA"; then
    echo 'PF-2247 protected base does not descend from the reviewed fork parent.' >&2
    return 1
  fi
  protected_merge_base="$(git merge-base "$BASE_SHA" "$HEAD_SHA")"
  if [[ "$protected_merge_base" != "$PF2247_FORK_PARENT" ]]; then
    echo 'PF-2247 protected base and reviewed head no longer meet at the reviewed fork parent.' >&2
    echo "expected: $PF2247_FORK_PARENT" >&2
    echo "actual:   $protected_merge_base" >&2
    return 1
  fi
  if ! git merge-base --is-ancestor "$PF2247_UPSTREAM_PARENT" "$HEAD_SHA"; then
    echo 'PF-2247 head does not contain the reviewed official upstream parent.' >&2
    return 1
  fi
)

git_blob_sha256() {
  local revision="$1"
  local path="$2"
  git show "${revision}:${path}" | sha256sum | awk '{print $1}'
}

git_regular_file_at_revision() {
  local revision="$1"
  local path="$2"
  git ls-tree "$revision" -- "$path" | grep -Eq '^100(644|755) blob '
}

verify_reviewed_regular_blob() {
  local revision="$1"
  local path="$2"
  local expected_blob="$3"
  local expected_sha="$4"
  local entry actual_sha

  entry="$(git ls-tree "$revision" -- "$path")"
  if [[ "$entry" != $'100644 blob '"$expected_blob"$'\t'"$path" ]]; then
    echo "Reviewed regular-file content mismatch: $path" >&2
    return 1
  fi
  actual_sha="$(git cat-file blob "$expected_blob" | sha256sum | awk '{print $1}')"
  if [[ "$actual_sha" != "$expected_sha" ]]; then
    echo "Reviewed regular-file SHA-256 mismatch: $path" >&2
    return 1
  fi
}

verify_pf2042_inngest_topology() {
  : "${HEAD_SHA:?HEAD_SHA is required}"
  pf2042_config

  verify_reviewed_regular_blob \
    "$HEAD_SHA" workflows/inngest/src/index.test.ts \
    "$PF2042_INNGEST_TEST_BLOB" "$PF2042_INNGEST_TEST_SHA256"
  verify_reviewed_regular_blob \
    "$HEAD_SHA" workflows/inngest/docker-compose.yaml \
    "$PF2042_INNGEST_COMPOSE_BLOB" "$PF2042_INNGEST_COMPOSE_SHA256"
  verify_reviewed_regular_blob \
    "$HEAD_SHA" workflows/inngest/src/__tests__/adapters/_utils.ts \
    "$PF2042_INNGEST_ADAPTER_BLOB" "$PF2042_INNGEST_ADAPTER_SHA256"

  node - <<'NODE'
const fs = require('node:fs');
const compose = fs.readFileSync('workflows/inngest/docker-compose.yaml', 'utf8');
const adapter = fs.readFileSync('workflows/inngest/src/__tests__/adapters/_utils.ts', 'utf8');
const test = fs.readFileSync('workflows/inngest/src/index.test.ts', 'utf8');
const requiredCompose = [
  'image: inngest/inngest:v1.34.0',
  'container_name: mastra-inngest-test',
  'command: inngest dev -p 4200 -u http://host.docker.internal:4201/inngest/api --poll-interval=1',
  "- '4200:4200'",
  "- 'host.docker.internal:host-gateway'",
];
for (const fragment of requiredCompose) {
  if (!compose.includes(fragment)) throw new Error(`PF-2042 Compose topology is missing: ${fragment}`);
}
for (const fragment of ['export const INNGEST_PORT = 4200;', 'export const HANDLER_PORT = 4201;']) {
  if (!adapter.includes(fragment)) throw new Error(`PF-2042 adapter topology is missing: ${fragment}`);
}
if (!test.includes('createLocalTestEndpoints({ inngestPort: 4200, handlerPort: 4201 })')) {
  throw new Error('PF-2042 index suite does not derive its local endpoints from 4200/4201.');
}
NODE
}

git_dependency_graph_sha256() {
  local revision="$1" entry path
  git ls-tree -r -z --full-tree "$revision" |
    while IFS= read -r -d '' entry; do
      path="${entry#*$'\t'}"
      case "$path" in
        .npmrc | */.npmrc | \
          .pnpmfile.cjs | */.pnpmfile.cjs | \
          pnpmfile.cjs | */pnpmfile.cjs | \
          pnpm-workspace.yaml | */pnpm-workspace.yaml | \
          package.json | */package.json | \
          pnpm-lock.yaml | */pnpm-lock.yaml | \
          patches/* | */patches/*)
          printf '%s\0' "$entry"
          ;;
      esac
    done |
    LC_ALL=C sort -z |
    sha256sum |
    awk '{print $1}'
}

verify_pf3553_selected_route_exports() {
  local base_revision="${1:?base revision is required}"
  local head_revision="${2:?head revision is required}"

  node - "$base_revision" "$head_revision" <<'NODE'
const { execFileSync } = require('node:child_process');
const { isDeepStrictEqual, TextDecoder } = require('node:util');

const [baseRevision, headRevision] = process.argv.slice(2);
const manifestPaths = [
  'packages/server/package.json',
  'server-adapters/fastify/package.json',
];
const manifestPathSet = new Set(manifestPaths);
const decoder = new TextDecoder('utf-8', { fatal: true });

function fail(message) {
  throw new Error(message);
}

function decodeUtf8(value, description) {
  try {
    return decoder.decode(value);
  } catch {
    fail(`${description} is not valid UTF-8.`);
  }
}

function treeEntries(revision) {
  const output = execFileSync(
    'git',
    ['ls-tree', '-r', '-z', '--full-tree', revision],
    { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 },
  );
  const entries = new Map();
  let offset = 0;
  while (offset < output.length) {
    const end = output.indexOf(0, offset);
    if (end < 0) fail(`Git tree listing for ${revision} is not NUL-terminated.`);
    if (end === offset) {
      offset = end + 1;
      continue;
    }
    const rawEntry = output.subarray(offset, end);
    const separator = rawEntry.indexOf(9);
    if (separator < 1) fail(`Git tree listing for ${revision} has a malformed entry.`);
    const metadata = rawEntry.subarray(0, separator).toString('ascii');
    const match = /^(\d{6}) (blob|commit) ([0-9a-f]{40,64})$/.exec(metadata);
    if (!match) fail(`Git tree listing for ${revision} has unsupported metadata: ${metadata}`);
    const path = decodeUtf8(rawEntry.subarray(separator + 1), `Git path at ${revision}`);
    if (entries.has(path)) fail(`Git tree listing for ${revision} repeats ${JSON.stringify(path)}.`);
    entries.set(path, { mode: match[1], type: match[2], oid: match[3] });
    offset = end + 1;
  }
  return entries;
}

function isDependencyGraphPath(path) {
  const segments = path.split('/');
  const basename = segments.at(-1);
  if (
    basename === '.npmrc' ||
    basename === '.pnpmfile.cjs' ||
    basename === 'pnpmfile.cjs' ||
    basename === 'pnpm-workspace.yaml' ||
    basename === 'package.json' ||
    basename === 'pnpm-lock.yaml'
  ) {
    return true;
  }
  const patchesIndex = segments.indexOf('patches');
  return patchesIndex >= 0 && patchesIndex < segments.length - 1;
}

function entryIdentity(entry) {
  return entry ? `${entry.mode} ${entry.type} ${entry.oid}` : undefined;
}

function requireManifestEntry(entries, revision, path) {
  const entry = entries.get(path);
  if (!entry || entry.mode !== '100644' || entry.type !== 'blob') {
    fail(`${path} must be a non-executable regular blob at ${revision}.`);
  }
  return entry;
}

function parseManifest(entry, revision, path) {
  const bytes = execFileSync('git', ['cat-file', 'blob', entry.oid], {
    encoding: 'buffer',
    maxBuffer: 8 * 1024 * 1024,
  });
  const source = decodeUtf8(bytes, `${path} at ${revision}`);
  let manifest;
  try {
    manifest = JSON.parse(source);
  } catch (error) {
    fail(`${path} is invalid JSON at ${revision}: ${error.message}`);
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    fail(`${path} must contain a JSON object at ${revision}.`);
  }
  return manifest;
}

function requireExactExports(baseManifest, headManifest, additions, path) {
  const baseExports = baseManifest.exports;
  const headExports = headManifest.exports;
  if (
    !baseExports ||
    typeof baseExports !== 'object' ||
    Array.isArray(baseExports) ||
    !headExports ||
    typeof headExports !== 'object' ||
    Array.isArray(headExports)
  ) {
    fail(`${path} must preserve an object-valued exports map.`);
  }

  const expectedExports = structuredClone(baseExports);
  for (const [exportPath, target] of Object.entries(additions)) {
    if (Object.hasOwn(baseExports, exportPath)) {
      fail(`${path} base already contains reviewed export ${exportPath}.`);
    }
    expectedExports[exportPath] = target;
  }
  if (!isDeepStrictEqual(headExports, expectedExports)) {
    fail(`${path} exports differ from the exact PF-3553 additive map.`);
  }

  // Conditional-export object order is runtime behavior: `default` before
  // `types`, for example, changes Node/TypeScript resolution even when the
  // object has the same keys and values. Preserve the order of every base
  // entry and require each reviewed addition in its literal reviewed order.
  const headWithoutAdditions = structuredClone(headExports);
  for (const exportPath of Object.keys(additions)) delete headWithoutAdditions[exportPath];
  if (JSON.stringify(headWithoutAdditions) !== JSON.stringify(baseExports)) {
    fail(`${path} reordered an existing exports entry or condition.`);
  }
  for (const [exportPath, target] of Object.entries(additions)) {
    if (JSON.stringify(headExports[exportPath]) !== JSON.stringify(target)) {
      fail(`${path} reordered reviewed conditions for ${exportPath}.`);
    }
  }

  const normalizedHead = structuredClone(headManifest);
  normalizedHead.exports = structuredClone(baseExports);
  if (!isDeepStrictEqual(normalizedHead, baseManifest)) {
    fail(`${path} metadata outside exports changed.`);
  }
}

try {
  const baseEntries = treeEntries(baseRevision);
  const headEntries = treeEntries(headRevision);
  const dependencyPaths = new Set();
  for (const path of baseEntries.keys()) {
    if (isDependencyGraphPath(path) && !manifestPathSet.has(path)) dependencyPaths.add(path);
  }
  for (const path of headEntries.keys()) {
    if (isDependencyGraphPath(path) && !manifestPathSet.has(path)) dependencyPaths.add(path);
  }
  const changedDependencyPaths = [...dependencyPaths]
    .filter(
      path => entryIdentity(baseEntries.get(path)) !== entryIdentity(headEntries.get(path)),
    )
    .sort();
  if (changedDependencyPaths.length > 0) {
    fail(
      `dependency graph changed outside the two reviewed manifests: ${changedDependencyPaths
        .map(path => JSON.stringify(path))
        .join(', ')}`,
    );
  }

  const baseServerEntry = requireManifestEntry(
    baseEntries,
    baseRevision,
    manifestPaths[0],
  );
  const headServerEntry = requireManifestEntry(
    headEntries,
    headRevision,
    manifestPaths[0],
  );
  const baseFastifyEntry = requireManifestEntry(
    baseEntries,
    baseRevision,
    manifestPaths[1],
  );
  const headFastifyEntry = requireManifestEntry(
    headEntries,
    headRevision,
    manifestPaths[1],
  );

  requireExactExports(
    parseManifest(baseServerEntry, baseRevision, manifestPaths[0]),
    parseManifest(headServerEntry, headRevision, manifestPaths[0]),
    {
      './server-adapter/selected': {
        import: {
          types: './dist/server/server-adapter/selected.d.ts',
          default: './dist/server/server-adapter/selected.js',
        },
        require: {
          types: './dist/server/server-adapter/selected.d.ts',
          default: './dist/server/server-adapter/selected.cjs',
        },
      },
      './server-adapter/routes/harness': {
        import: {
          types: './dist/server/server-adapter/routes/harness.d.ts',
          default: './dist/server/server-adapter/routes/harness.js',
        },
        require: {
          types: './dist/server/server-adapter/routes/harness.d.ts',
          default: './dist/server/server-adapter/routes/harness.cjs',
        },
      },
    },
    manifestPaths[0],
  );
  requireExactExports(
    parseManifest(baseFastifyEntry, baseRevision, manifestPaths[1]),
    parseManifest(headFastifyEntry, headRevision, manifestPaths[1]),
    {
      './selected': {
        import: {
          types: './dist/selected.d.ts',
          default: './dist/selected.js',
        },
        require: {
          types: './dist/selected.d.ts',
          default: './dist/selected.cjs',
        },
      },
    },
    manifestPaths[1],
  );
} catch (error) {
  console.error(`PF-3553 selected-route export admission failed: ${error.message}`);
  process.exit(1);
}
NODE
}

emit_validation_lane() {
  local lane="$1"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    printf 'lane=%s\n' "$lane" >> "$GITHUB_OUTPUT"
  else
    printf 'lane=%s\n' "$lane"
  fi
}

verify_agent_builder_fixture_config() {
  git_regular_file_at_revision "$1" packages/agent-builder/tsconfig.fixtures.json || return 1
  node - "$1" <<'NODE'
const { execFileSync } = require('node:child_process');
const { isDeepStrictEqual } = require('node:util');
const config = JSON.parse(execFileSync('git', [
  'show', `${process.argv[2]}:packages/agent-builder/tsconfig.fixtures.json`,
], { encoding: 'utf8' }));
if (!isDeepStrictEqual(config, {
  extends: './tsconfig.json',
  include: ['integration-tests/src/fixtures/**/*'],
})) {
  throw new Error('Agent Builder fixture checking must inherit the package project and include every fixture source.');
}
NODE
}

verify_agent_builder_fixture_dependency() {
  local base_sha="$1" head_sha="$2" file
  for file in packages/agent-builder/package.json pnpm-lock.yaml; do
    git_regular_file_at_revision "$base_sha" "$file" || return 1
    git_regular_file_at_revision "$head_sha" "$file" || return 1
  done
  verify_agent_builder_fixture_config "$head_sha" || return 1
  node - "$base_sha" "$head_sha" <<'NODE'
const { execFileSync } = require('node:child_process');
const { isDeepStrictEqual } = require('node:util');
const [baseSha, headSha] = process.argv.slice(2);
const readAt = (sha, file) => execFileSync('git', ['show', `${sha}:${file}`], {
  encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
});
const manifestPath = 'packages/agent-builder/package.json';
const before = JSON.parse(readAt(baseSha, manifestPath));
const after = JSON.parse(readAt(headSha, manifestPath));
if (Object.hasOwn(before.scripts ?? {}, 'check:fixtures') ||
  Object.hasOwn(before.devDependencies ?? {}, '@mastra/mcp')) {
  throw new Error('Agent Builder fixture admission only adds its owning check and existing MCP workspace dependency.');
}
const expected = structuredClone(before);
expected.scripts = { ...expected.scripts, 'check:fixtures': 'tsc --noEmit --project tsconfig.fixtures.json' };
expected.devDependencies = { ...expected.devDependencies, '@mastra/mcp': 'workspace:*' };
if (!isDeepStrictEqual(after, expected)) {
  throw new Error('Agent Builder package.json changed outside the owned fixture script and MCP devDependency.');
}

// Remove the one new workspace link from the proposed lockfile and require
// the complete remaining file to equal the base, including every other graph.
const lines = readAt(headSha, 'pnpm-lock.yaml').split('\n');
const importer = lines.indexOf('  packages/agent-builder:');
if (importer < 0 || lines.lastIndexOf('  packages/agent-builder:') !== importer) {
  throw new Error('Agent Builder lockfile importer is missing or ambiguous.');
}
let end = importer + 1;
while (end < lines.length && (lines[end] === '' || lines[end].startsWith('    '))) end += 1;
const devDependencies = lines.indexOf('    devDependencies:', importer + 1);
if (devDependencies < 0 || devDependencies >= end) {
  throw new Error('Agent Builder lockfile devDependencies are missing.');
}
let devEnd = devDependencies + 1;
while (devEnd < end && (lines[devEnd] === '' || lines[devEnd].startsWith('      '))) devEnd += 1;
const dependency = lines.indexOf("      '@mastra/mcp':", devDependencies + 1);
if (dependency < 0 || dependency >= devEnd ||
  lines[dependency + 1] !== '        specifier: workspace:*' ||
  lines[dependency + 2] !== '        version: link:../mcp') {
  throw new Error('Agent Builder must resolve its MCP fixture dependency to the existing workspace package.');
}
lines.splice(dependency, 3);
if (lines.join('\n') !== readAt(baseSha, 'pnpm-lock.yaml')) {
  throw new Error('Agent Builder fixture admission may only add its MCP importer link to pnpm-lock.yaml.');
}
NODE
}

verify_pf2057_inngest_dependency_cleanup() {
  node - "$1" "$2" <<'NODE'
const { execFileSync } = require('node:child_process');
const { isDeepStrictEqual } = require('node:util');

const [baseSha, headSha] = process.argv.slice(2);
const readAt = (sha, path) =>
  execFileSync('git', ['show', `${sha}:${path}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const manifestPath = 'workflows/inngest/package.json';
const baseManifest = JSON.parse(readAt(baseSha, manifestPath));
const headManifest = JSON.parse(readAt(headSha, manifestPath));
for (const [dependency, version] of [
  ['@ai-sdk/openai', '^1.3.24'],
  ['inngest-cli', '^1.26.0'],
]) {
  if (baseManifest.devDependencies?.[dependency] !== version) {
    throw new Error(`PF-2057 base no longer contains the reviewed ${dependency}@${version} devDependency.`);
  }
}
const expectedManifest = structuredClone(baseManifest);
delete expectedManifest.devDependencies['@ai-sdk/openai'];
delete expectedManifest.devDependencies['inngest-cli'];
if (!isDeepStrictEqual(headManifest, expectedManifest)) {
  throw new Error('PF-2057 package.json may only remove the two reviewed unused devDependencies.');
}

const baseLock = readAt(baseSha, 'pnpm-lock.yaml');
const headLock = readAt(headSha, 'pnpm-lock.yaml');
const lines = baseLock.split('\n');

function indentation(line) {
  return line.length - line.trimStart().length;
}

function sectionEnd(start) {
  const startIndent = indentation(lines[start]);
  let end = start + 1;
  while (end < lines.length && (lines[end] === '' || indentation(lines[end]) > startIndent)) end += 1;
  return end;
}

function findUniqueLine(marker, start = 0, end = lines.length) {
  const matches = [];
  for (let index = start; index < end; index += 1) {
    if (lines[index] === marker) matches.push(index);
  }
  if (matches.length !== 1) {
    throw new Error(`PF-2057 expected exactly one lockfile line ${JSON.stringify(marker)}, found ${matches.length}.`);
  }
  return matches[0];
}

function removeBlock(marker, start = 0, end = lines.length) {
  const blockStart = findUniqueLine(marker, start, end);
  lines.splice(blockStart, sectionEnd(blockStart) - blockStart);
}

function importerBounds() {
  const start = findUniqueLine('  workflows/inngest:');
  return [start + 1, sectionEnd(start)];
}

for (const marker of ["      '@ai-sdk/openai':", '      inngest-cli:']) {
  const [start, end] = importerBounds();
  removeBlock(marker, start, end);
}
removeBlock('  inngest-cli@1.27.0:');
removeBlock('  inngest-cli@1.27.0(encoding@0.1.13):');

if (lines.join('\n') !== headLock) {
  throw new Error('PF-2057 pnpm-lock.yaml may only remove the reviewed Inngest importer and inngest-cli graph blocks.');
}
NODE
}

classify_install_lane() (
  : "${BASE_SHA:?BASE_SHA is required}"
  : "${HEAD_SHA:?HEAD_SHA is required}"

  local manifest_changes
  manifest_changes="$(mktemp)"
  trap 'rm -f "$manifest_changes"' EXIT
  git diff --no-renames --name-only "${BASE_SHA}...${HEAD_SHA}" -- \
    .npmrc .pnpmfile.cjs pnpmfile.cjs package.json pnpm-workspace.yaml \
    patches packages/server/package.json server-adapters/fastify/package.json \
    packages/_types-builder/package.json packages/agent-builder/package.json |
    sort -u > "$manifest_changes"

  # PF-4163 is frozen to one reviewed source merge S(F,U), its source tree,
  # and one exact correction R directly atop S, alongside the source branch,
  # repository, and upstream parent. The protected-base advance C may contain
  # CI policy only, but must meet S exactly at F. Its install graph is frozen
  # to the complete reviewed 115-path manifest, workspace, lockfile, config,
  # and patch surface; the six manually resolved graph files are a separately
  # recorded provenance subset.
  pf4163_config
  if [[ "${HEAD_REPOSITORY:-}" == "$PF4163_HEAD_REPOSITORY" && \
    "${HEAD_REF:-}" == "$PF4163_HEAD_REF" && "${BASE_REF:-}" == "$PF4163_BASE_REF" ]]; then
    verify_pf4163_reviewed_merge
    echo 'PF-4163 exact correction atop reviewed source merge, source topology/tree, ancestry, and install allowlist accepted from trusted base policy.'
    emit_validation_lane pf4163-upstream-sync
    return
  fi

  # PF-4051 is frozen to one reviewed merge commit, tree, branch, repository,
  # and source-parent pair. The consolidated prerequisite and frozen source
  # must meet exactly at the reviewed main commit containing native contracts.
  pf4051_config
  if [[ "${HEAD_REPOSITORY:-}" == "$PF4051_HEAD_REPOSITORY" && \
    "${HEAD_REF:-}" == "$PF4051_HEAD_REF" && "${BASE_REF:-}" == "$PF4051_BASE_REF" ]]; then
    verify_pf4051_reviewed_merge
    echo 'PF-4051 exact two-parent upstream merge and reviewed tree accepted from trusted base policy.'
    emit_validation_lane pf4051-upstream-sync
    return
  fi

  # PF-3375 is frozen to one reviewed merge commit, tree, branch, repository,
  # and parent pair. The policy PR advances protected main after that merge was
  # constructed, so the checked PR base may descend from (but must meet the
  # feature head exactly at) the reviewed fork parent.
  pf3375_config
  if [[ "${HEAD_REPOSITORY:-}" == "$PF3375_HEAD_REPOSITORY" && \
    "${HEAD_REF:-}" == "$PF3375_HEAD_REF" && "${BASE_REF:-}" == "$PF3375_BASE_REF" ]]; then
    verify_pf3375_reviewed_merge
    echo 'PF-3375 exact two-parent upstream merge and reviewed tree accepted from trusted base policy.'
    emit_validation_lane pf3375-upstream-sync
    return
  fi

  # PF-3020 is frozen to one reviewed merge commit, tree, branch, repository,
  # and parent pair. The policy PR advances protected main after that merge was
  # constructed, so the checked PR base may descend from (but must meet the
  # feature head exactly at) the reviewed fork parent.
  pf3020_config
  if [[ "${HEAD_REPOSITORY:-}" == "$PF3020_HEAD_REPOSITORY" && \
    "${HEAD_REF:-}" == "$PF3020_HEAD_REF" && "${BASE_REF:-}" == "$PF3020_BASE_REF" ]]; then
    verify_pf3020_reviewed_merge
    echo 'PF-3020 exact two-parent upstream merge and reviewed tree accepted from trusted base policy.'
    emit_validation_lane pf3020-upstream-sync
    return
  fi

  # PF-2576 is frozen to one reviewed merge commit, tree, branch, repository,
  # and parent pair, exactly like PF-2247 below. The policy PR advances
  # protected main after that merge was constructed, so the checked PR base may
  # descend from (but must meet the feature head exactly at) the reviewed fork
  # parent.
  pf2576_config
  if [[ "${HEAD_REPOSITORY:-}" == "$PF2576_HEAD_REPOSITORY" && \
    "${HEAD_REF:-}" == "$PF2576_HEAD_REF" && "${BASE_REF:-}" == "$PF2576_BASE_REF" ]]; then
    verify_pf2576_reviewed_merge
    echo 'PF-2576 exact two-parent upstream merge and reviewed tree accepted from trusted base policy.'
    emit_validation_lane pf2576-upstream-sync
    return
  fi

  # PF-2247 is frozen to one reviewed merge commit, tree, branch, repository,
  # and parent pair. The policy PR advances protected main after that merge was
  # constructed, so the checked PR base may descend from (but must meet the
  # feature head exactly at) the reviewed fork parent.
  pf2247_config
  if [[ "${HEAD_REPOSITORY:-}" == "$PF2247_HEAD_REPOSITORY" && \
    "${HEAD_REF:-}" == "$PF2247_HEAD_REF" && "${BASE_REF:-}" == "$PF2247_BASE_REF" ]]; then
    verify_pf2247_reviewed_merge
    echo 'PF-2247 exact two-parent upstream merge and reviewed tree accepted from trusted base policy.'
    emit_validation_lane pf2247-upstream-sync
    return
  fi

  # PF-2045 is topology- and tree-bound. Its future merge commit hash cannot be
  # pinned before this policy lands, so admission reconstructs the merge from
  # the current protected-base tip and reviewed upstream parent, substitutes
  # only the six rehearsed conflict resolutions plus the two reviewed PF-2053
  # truthfulness overlays, and requires the checked head to have that exact
  # tree. The lane installs with hooks and lifecycle scripts disabled and runs
  # only the explicit trusted-base validation plan below.
  pf2045_config
  if [[ "${HEAD_REPOSITORY:-}" == "$PF2045_HEAD_REPOSITORY" && \
    "${HEAD_REF:-}" == "$PF2045_HEAD_REF" && "${BASE_REF:-}" == "$PF2045_BASE_REF" ]]; then
    local merge_topology
    merge_topology="$(git rev-list --parents -n 1 "$HEAD_SHA")"
    if [[ "$merge_topology" != "$HEAD_SHA $BASE_SHA $PF2045_UPSTREAM_PARENT" ]]; then
      echo 'PF-2045 head is not the exact reviewed two-parent upstream merge topology.' >&2
      echo "expected: $HEAD_SHA $BASE_SHA $PF2045_UPSTREAM_PARENT" >&2
      echo "actual:   $merge_topology" >&2
      return 1
    fi
    if ! git merge-base --is-ancestor "$PF2045_UPSTREAM_PARENT" "$HEAD_SHA"; then
      echo 'PF-2045 does not contain the reviewed official upstream parent.' >&2
      return 1
    fi
    verify_pf2045_reviewed_tree

    echo 'PF-2045 exact two-parent upstream merge and reconstructed tree accepted from trusted base policy.'
    emit_validation_lane pf2045-upstream-sync
    return
  fi

  # PF-3553 is frozen to the complete reviewed 22-file Server/Fastify feature
  # surface. In addition, require the exact three additive selected-route
  # exports, preserve conditional-export ordering, and keep every other
  # dependency-graph entry and all non-export manifest metadata unchanged.
  pf3553_config
  if [[ "${PR_NUMBER:-}" == "$PF3553_PR_NUMBER" && \
    "${HEAD_REPOSITORY:-}" == "$PF3553_HEAD_REPOSITORY" && \
    "${HEAD_REF:-}" == "$PF3553_HEAD_REF" ]] && \
    pf3553_base_ref_allowed "${BASE_REF:-}"; then
    verify_pf3553_selected_route_exports "$BASE_SHA" "$HEAD_SHA"
    verify_pf3553_reviewed_surface "$BASE_SHA" "$HEAD_SHA"
    echo 'PF-3553 exact reviewed selected-route surface and export maps accepted from trusted base policy.'
    emit_validation_lane pf3553-selected-route-exports
    return
  fi

  if [[ ! -s "$manifest_changes" ]]; then
    if ! git diff --quiet "${BASE_SHA}...${HEAD_SHA}" -- pnpm-lock.yaml; then
      if ! git diff --quiet "${BASE_SHA}...${HEAD_SHA}" -- workflows/inngest/package.json &&
        verify_pf2057_inngest_dependency_cleanup "$(git merge-base "$BASE_SHA" "$HEAD_SHA")" "$HEAD_SHA"; then
        emit_validation_lane standard
        return
      fi
      echo 'Lockfile-only changes require a reviewed dependency-graph lane.' >&2
      return 1
    fi
    emit_validation_lane standard
    return
  fi

  if [[ "$(cat "$manifest_changes")" == 'packages/agent-builder/package.json' ]]; then
    verify_agent_builder_fixture_dependency "$(git merge-base "$BASE_SHA" "$HEAD_SHA")" "$HEAD_SHA"
    emit_validation_lane standard
    return
  fi

  : "${PR_NUMBER:?PR_NUMBER is required for a dependency-graph exception}"
  : "${HEAD_REPOSITORY:?HEAD_REPOSITORY is required for a dependency-graph exception}"
  : "${HEAD_REF:?HEAD_REF is required for a dependency-graph exception}"
  : "${BASE_REF:?BASE_REF is required for a dependency-graph exception}"

  pf2009_config
  if [[ "$PR_NUMBER" == "$PF2009_PR_NUMBER" && \
    "$HEAD_REPOSITORY" == "$PF2009_HEAD_REPOSITORY" && \
    "$HEAD_REF" == "$PF2009_HEAD_REF" && "$BASE_REF" == "$PF2009_BASE_REF" ]]; then
    local expected_changes merge_topology actual_dependency_graph_hash
    expected_changes="$(mktemp)"
    trap 'rm -f "$manifest_changes" "$expected_changes"' EXIT
    printf '%s\n' package.json packages/server/package.json | sort > "$expected_changes"
    if ! cmp -s "$expected_changes" "$manifest_changes"; then
      echo 'PF-2009 changed dependency-graph paths outside the exact reviewed set:' >&2
      diff -u "$expected_changes" "$manifest_changes" >&2 || true
      return 1
    fi

    merge_topology="$(git rev-list --parents -n 1 "$PF2009_PRIMARY_MERGE_COMMIT")"
    if [[ "$merge_topology" != "$PF2009_PRIMARY_MERGE_COMMIT $PF2009_FORK_PARENT $PF2009_PRIMARY_UPSTREAM_PARENT" ]] || \
      ! git merge-base --is-ancestor "$PF2009_PRIMARY_MERGE_COMMIT" "$HEAD_SHA"; then
      echo 'PF-2009 no longer contains the reviewed primary upstream merge topology.' >&2
      return 1
    fi
    merge_topology="$(git rev-list --parents -n 1 "$PF2009_LATEST_MERGE_COMMIT")"
    if [[ "$merge_topology" != "$PF2009_LATEST_MERGE_COMMIT $PF2009_LATEST_FIRST_PARENT $PF2009_LATEST_UPSTREAM_PARENT" ]] || \
      ! git merge-base --is-ancestor "$PF2009_LATEST_MERGE_COMMIT" "$HEAD_SHA"; then
      echo 'PF-2009 no longer contains the reviewed latest-upstream merge topology.' >&2
      return 1
    fi

    local path expected_hash actual_hash
    while IFS=$'\t' read -r path expected_hash; do
      if ! git_regular_file_at_revision "$HEAD_SHA" "$path"; then
        echo "PF-2009 approved dependency file is not a regular blob: $path" >&2
        return 1
      fi
      actual_hash="$(git_blob_sha256 "$HEAD_SHA" "$path")"
      if [[ "$actual_hash" != "$expected_hash" ]]; then
        echo "PF-2009 approved dependency file hash changed: $path" >&2
        echo "expected: $expected_hash" >&2
        echo "actual:   $actual_hash" >&2
        return 1
      fi
    done <<EOF
package.json	$PF2009_PACKAGE_JSON_SHA256
packages/server/package.json	$PF2009_SERVER_PACKAGE_JSON_SHA256
pnpm-workspace.yaml	$PF2009_WORKSPACE_SHA256
pnpm-lock.yaml	$PF2009_LOCKFILE_SHA256
EOF

    actual_dependency_graph_hash="$(git_dependency_graph_sha256 "$HEAD_SHA")"
    if [[ "$actual_dependency_graph_hash" != "$PF2009_DEPENDENCY_GRAPH_SHA256" ]]; then
      echo 'PF-2009 dependency-graph tree hash changed.' >&2
      echo "expected: $PF2009_DEPENDENCY_GRAPH_SHA256" >&2
      echo "actual:   $actual_dependency_graph_hash" >&2
      return 1
    fi

    echo 'PF-2009 exact dependency-graph exception accepted from trusted base policy.'
    emit_validation_lane pf2009-upstream-sync
    return
  fi

  pf558_config

  if [[ "$PR_NUMBER" != "$PF558_PR_NUMBER" || \
    "$HEAD_REPOSITORY" != "$PF558_HEAD_REPOSITORY" || \
    "$HEAD_REF" != "$PF558_HEAD_REF" || "$BASE_REF" != "$PF558_BASE_REF" ]]; then
    echo 'Dependency-graph changes do not match a reviewed upstream-sync lane.' >&2
    cat "$manifest_changes" >&2
    return 1
  fi

  local expected_changes
  expected_changes="$(mktemp)"
  trap 'rm -f "$manifest_changes" "$expected_changes"' EXIT
  printf '%s\n' \
    package.json \
    packages/server/package.json \
    patches/@earendil-works__pi-tui@0.80.6.patch \
    pnpm-workspace.yaml | sort > "$expected_changes"
  if ! cmp -s "$expected_changes" "$manifest_changes"; then
    echo 'PF-558 changed dependency-graph paths outside the exact reviewed set:' >&2
    diff -u "$expected_changes" "$manifest_changes" >&2 || true
    return 1
  fi

  local merge_topology
  merge_topology="$(git rev-list --parents -n 1 "$PF558_MERGE_COMMIT")"
  if [[ "$merge_topology" != "$PF558_MERGE_COMMIT $PF558_FORK_PARENT $PF558_UPSTREAM_PARENT" ]] || \
    ! git merge-base --is-ancestor "$PF558_MERGE_COMMIT" "$HEAD_SHA"; then
    echo 'PF-558 no longer contains the reviewed upstream merge topology.' >&2
    return 1
  fi

  local path expected_hash actual_hash
  while IFS=$'\t' read -r path expected_hash; do
    if ! git_regular_file_at_revision "$HEAD_SHA" "$path"; then
      echo "PF-558 approved dependency file is not a regular blob: $path" >&2
      return 1
    fi
    actual_hash="$(git_blob_sha256 "$HEAD_SHA" "$path")"
    if [[ "$actual_hash" != "$expected_hash" ]]; then
      echo "PF-558 approved dependency file hash changed: $path" >&2
      echo "expected: $expected_hash" >&2
      echo "actual:   $actual_hash" >&2
      return 1
    fi
  done <<EOF
package.json	$PF558_PACKAGE_JSON_SHA256
packages/server/package.json	$PF558_SERVER_PACKAGE_JSON_SHA256
pnpm-workspace.yaml	$PF558_WORKSPACE_SHA256
pnpm-lock.yaml	$PF558_LOCKFILE_SHA256
patches/@earendil-works__pi-tui@0.80.6.patch	$PF558_PI_TUI_PATCH_SHA256
EOF

  echo 'PF-558 exact dependency-graph exception accepted from trusted base policy.'
  emit_validation_lane pf558-upstream-sync
)

run_pf3553_admission_self_tests() (
  local script_path test_root fixture_repo base_sha valid_head mutation_head output
  local fixture_base_surface_sha256 fixture_head_surface_sha256
  script_path="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
  test_root="$(mktemp -d)"
  fixture_repo="$test_root/repo"

  # Invoked indirectly by the EXIT trap below.
  # shellcheck disable=SC2317
  pf3553_fixture_cleanup() {
    local status=$?
    trap - EXIT
    if (( status != 0 )); then
      echo 'PF-3553 admission fixture failed; captured classifier output follows:' >&2
      find "$test_root" -maxdepth 1 -type f -name '*.log' -print \
        -exec sed -n '1,240p' {} \; >&2 || true
    fi
    rm -rf -- "$test_root"
    exit "$status"
  }
  trap pf3553_fixture_cleanup EXIT

  mkdir -p \
    "$fixture_repo/docs/src/content/en/docs/server" \
    "$fixture_repo/packages/core" \
    "$fixture_repo/packages/server/src/server/server-adapter/routes" \
    "$fixture_repo/server-adapters/fastify/src" \
    "$fixture_repo/patches"
  git -C "$fixture_repo" init -q -b main
  git -C "$fixture_repo" config user.email validator@example.test
  git -C "$fixture_repo" config user.name 'PF-3553 validator fixture'

  cat > "$fixture_repo/package.json" <<'JSON'
{
  "name": "fixture-root",
  "private": true,
  "scripts": {
    "check": "trusted-root-check"
  }
}
JSON
  cat > "$fixture_repo/packages/core/package.json" <<'JSON'
{
  "name": "@mastra/core",
  "version": "1.0.0"
}
JSON
  cat > "$fixture_repo/packages/server/package.json" <<'JSON'
{
  "name": "@mastra/server",
  "version": "1.0.0",
  "files": [
    "dist",
    "CHANGELOG.md"
  ],
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.cjs"
      }
    },
    "./server-adapter": {
      "import": {
        "types": "./dist/server/server-adapter/index.d.ts",
        "default": "./dist/server/server-adapter/index.js"
      },
      "require": {
        "types": "./dist/server/server-adapter/index.d.ts",
        "default": "./dist/server/server-adapter/index.cjs"
      }
    },
    "./package.json": "./package.json"
  },
  "scripts": {
    "build:lib": "trusted-server-build",
    "lint": "trusted-server-lint",
    "test": "trusted-server-test"
  },
  "dependencies": {
    "hono": "^4.0.0"
  },
  "peerDependencies": {
    "zod": "^4.0.0"
  }
}
JSON
  cat > "$fixture_repo/server-adapters/fastify/package.json" <<'JSON'
{
  "name": "@mastra/fastify",
  "version": "1.0.0",
  "files": [
    "dist",
    "CHANGELOG.md"
  ],
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.cjs"
      }
    },
    "./package.json": "./package.json"
  },
  "scripts": {
    "build": "trusted-fastify-build",
    "lint": "trusted-fastify-lint",
    "test": "trusted-fastify-test"
  },
  "dependencies": {
    "@mastra/server": "workspace:*"
  },
  "peerDependencies": {
    "fastify": "^5.0.0"
  }
}
JSON
  printf '%s\n' 'base adapter documentation' \
    > "$fixture_repo/docs/src/content/en/docs/server/server-adapters.mdx"
  printf '%s\n' 'base server adapter test' \
    > "$fixture_repo/packages/server/src/server/server-adapter/index.test.ts"
  printf '%s\n' 'base server adapter' \
    > "$fixture_repo/packages/server/src/server/server-adapter/index.ts"
  printf '%s\n' 'base Harness routes' \
    > "$fixture_repo/packages/server/src/server/server-adapter/routes/harness.ts"
  printf '%s\n' 'base Server build configuration' \
    > "$fixture_repo/packages/server/tsdown.config.ts"
  printf '%s\n' 'base Fastify adapter' \
    > "$fixture_repo/server-adapters/fastify/src/index.ts"
  printf '%s\n' 'base Fastify build configuration' \
    > "$fixture_repo/server-adapters/fastify/tsdown.config.ts"
  printf '%s\n' '{"name":"symlink-target"}' \
    > "$fixture_repo/server-adapters/fastify-package.json"
  printf '%s\n' 'registry=https://registry.npmjs.org/' > "$fixture_repo/.npmrc"
  printf '%s\n' 'module.exports = { hooks: {} };' > "$fixture_repo/.pnpmfile.cjs"
  printf '%s\n' 'packages:' "  - 'packages/*'" "  - 'server-adapters/*'" \
    > "$fixture_repo/pnpm-workspace.yaml"
  printf '%s\n' "lockfileVersion: '9.0'" 'importers: {}' \
    > "$fixture_repo/pnpm-lock.yaml"
  printf '%s\n' 'trusted patch' > "$fixture_repo/patches/trusted.patch"
  git -C "$fixture_repo" add .
  git -C "$fixture_repo" commit -q -m base
  base_sha="$(git -C "$fixture_repo" rev-parse HEAD)"
  fixture_base_surface_sha256="$(cd "$fixture_repo" && pf3553_surface_digest "$base_sha")"

  cat > "$fixture_repo/packages/server/package.json" <<'JSON'
{
  "name": "@mastra/server",
  "version": "1.0.0",
  "files": [
    "dist",
    "CHANGELOG.md"
  ],
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.cjs"
      }
    },
    "./server-adapter": {
      "import": {
        "types": "./dist/server/server-adapter/index.d.ts",
        "default": "./dist/server/server-adapter/index.js"
      },
      "require": {
        "types": "./dist/server/server-adapter/index.d.ts",
        "default": "./dist/server/server-adapter/index.cjs"
      }
    },
    "./server-adapter/selected": {
      "import": {
        "types": "./dist/server/server-adapter/selected.d.ts",
        "default": "./dist/server/server-adapter/selected.js"
      },
      "require": {
        "types": "./dist/server/server-adapter/selected.d.ts",
        "default": "./dist/server/server-adapter/selected.cjs"
      }
    },
    "./server-adapter/routes/harness": {
      "import": {
        "types": "./dist/server/server-adapter/routes/harness.d.ts",
        "default": "./dist/server/server-adapter/routes/harness.js"
      },
      "require": {
        "types": "./dist/server/server-adapter/routes/harness.d.ts",
        "default": "./dist/server/server-adapter/routes/harness.cjs"
      }
    },
    "./package.json": "./package.json"
  },
  "scripts": {
    "build:lib": "trusted-server-build",
    "lint": "trusted-server-lint",
    "test": "trusted-server-test"
  },
  "dependencies": {
    "hono": "^4.0.0"
  },
  "peerDependencies": {
    "zod": "^4.0.0"
  }
}
JSON
  cat > "$fixture_repo/server-adapters/fastify/package.json" <<'JSON'
{
  "name": "@mastra/fastify",
  "version": "1.0.0",
  "files": [
    "dist",
    "CHANGELOG.md"
  ],
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.cjs"
      }
    },
    "./selected": {
      "import": {
        "types": "./dist/selected.d.ts",
        "default": "./dist/selected.js"
      },
      "require": {
        "types": "./dist/selected.d.ts",
        "default": "./dist/selected.cjs"
      }
    },
    "./package.json": "./package.json"
  },
  "scripts": {
    "build": "trusted-fastify-build",
    "lint": "trusted-fastify-lint",
    "test": "trusted-fastify-test"
  },
  "dependencies": {
    "@mastra/server": "workspace:*"
  },
  "peerDependencies": {
    "fastify": "^5.0.0"
  }
}
JSON
  mkdir -p \
    "$fixture_repo/.changeset" \
    "$fixture_repo/packages/server/src/server/server-adapter" \
    "$fixture_repo/server-adapters/fastify/src/__tests__" \
    "$fixture_repo/server-adapters/fastify/test-fixtures/selected-package-types"
  printf '%s\n' 'reviewed Server changeset' > "$fixture_repo/.changeset/calm-routes-select.md"
  printf '%s\n' 'reviewed Fastify changeset' > "$fixture_repo/.changeset/lean-fastify-select.md"
  printf '%s\n' 'reviewed adapter documentation' \
    > "$fixture_repo/docs/src/content/en/docs/server/server-adapters.mdx"
  printf '%s\n' 'reviewed HTTP logging test' \
    > "$fixture_repo/packages/server/src/server/server-adapter/http-logging.test.ts"
  printf '%s\n' 'reviewed server adapter test' \
    > "$fixture_repo/packages/server/src/server/server-adapter/index.test.ts"
  printf '%s\n' 'reviewed server adapter' \
    > "$fixture_repo/packages/server/src/server/server-adapter/index.ts"
  printf '%s\n' 'reviewed Harness routes' \
    > "$fixture_repo/packages/server/src/server/server-adapter/routes/harness.ts"
  printf '%s\n' 'reviewed selected Server import test' \
    > "$fixture_repo/packages/server/src/server/server-adapter/selected-import-closure.test.ts"
  printf '%s\n' 'reviewed selected Server test' \
    > "$fixture_repo/packages/server/src/server/server-adapter/selected.test.ts"
  printf '%s\n' 'reviewed selected Server adapter' \
    > "$fixture_repo/packages/server/src/server/server-adapter/selected.ts"
  printf '%s\n' 'reviewed Server build configuration' \
    > "$fixture_repo/packages/server/tsdown.config.ts"
  printf '%s\n' 'reviewed selected Fastify import test' \
    > "$fixture_repo/server-adapters/fastify/src/__tests__/selected-import-closure.test.ts"
  printf '%s\n' 'reviewed selected package exports test' \
    > "$fixture_repo/server-adapters/fastify/src/__tests__/selected-package-exports.test.ts"
  printf '%s\n' 'reviewed selected Fastify routes test' \
    > "$fixture_repo/server-adapters/fastify/src/__tests__/selected-routes.test.ts"
  printf '%s\n' 'reviewed Fastify adapter' \
    > "$fixture_repo/server-adapters/fastify/src/index.ts"
  printf '%s\n' 'reviewed selected Fastify adapter' \
    > "$fixture_repo/server-adapters/fastify/src/selected.ts"
  printf '%s\n' 'reviewed CommonJS type consumer' \
    > "$fixture_repo/server-adapters/fastify/test-fixtures/selected-package-types/consumer.cts"
  printf '%s\n' 'reviewed ESM type consumer' \
    > "$fixture_repo/server-adapters/fastify/test-fixtures/selected-package-types/consumer.mts"
  printf '%s\n' '{"compilerOptions":{"module":"NodeNext"}}' \
    > "$fixture_repo/server-adapters/fastify/test-fixtures/selected-package-types/tsconfig.json"
  printf '%s\n' 'reviewed Fastify build configuration' \
    > "$fixture_repo/server-adapters/fastify/tsdown.config.ts"
  git -C "$fixture_repo" add -A
  git -C "$fixture_repo" commit -q -m 'exact selected-route exports'
  valid_head="$(git -C "$fixture_repo" rev-parse HEAD)"
  fixture_head_surface_sha256="$(cd "$fixture_repo" && pf3553_surface_digest "$valid_head")"

  run_fixture_admission() {
    local fixture_head="$1"
    local fixture_output="$2"
    shift 2
    (
      cd "$fixture_repo"
      env \
        GITHUB_OUTPUT= \
        BASE_SHA="$base_sha" \
        HEAD_SHA="$fixture_head" \
        PR_NUMBER=373 \
        HEAD_REPOSITORY=mbenhamd/mastra \
        HEAD_REF=feature/pf-3553-selected-routes \
        BASE_REF=main \
        PAPERSFLOW_PF3553_BASE_SURFACE_SHA256="$fixture_base_surface_sha256" \
        PAPERSFLOW_PF3553_HEAD_SURFACE_SHA256="$fixture_head_surface_sha256" \
        "$@" \
        bash "$script_path" --classify-install
    ) > "$fixture_output" 2>&1
  }

  assert_rejected() {
    local label="$1"
    local fixture_head="$2"
    output="$test_root/${label}.log"
    if run_fixture_admission "$fixture_head" "$output"; then
      echo "PF-3553 hostile fixture unexpectedly passed: $label" >&2
      cat "$output" >&2
      return 1
    fi
    if ! grep -Fq 'PF-3553 selected-route export admission failed:' "$output"; then
      echo "PF-3553 hostile fixture failed for an unexpected reason: $label" >&2
      cat "$output" >&2
      return 1
    fi
  }

  json_mutation_head() (
    local path="$1"
    local mode="$2"
    cd "$fixture_repo"
    git reset -q --hard "$valid_head"
    node - "$path" "$mode" <<'NODE'
const fs = require('node:fs');
const [path, mode] = process.argv.slice(2);
const manifest = JSON.parse(fs.readFileSync(path, 'utf8'));
switch (mode) {
  case 'script':
    manifest.scripts.reviewed = 'untrusted-script';
    break;
  case 'lifecycle':
    manifest.scripts.preinstall = 'untrusted-lifecycle';
    break;
  case 'dependency':
    manifest.dependencies['untrusted-dependency'] = '^1.0.0';
    break;
  case 'files':
    manifest.files.push('unreviewed-output');
    break;
  case 'retarget':
    manifest.exports['./server-adapter/selected'].import.default =
      './dist/server/server-adapter/retargeted.js';
    break;
  case 'traversal':
    manifest.exports['./selected'].require.default = '../outside.cjs';
    break;
  case 'wildcard':
    manifest.exports['./*'] = './dist/*.js';
    break;
  case 'extra-export':
    manifest.exports['./unreviewed'] = './dist/unreviewed.js';
    break;
  case 'extra-condition':
    manifest.exports['./selected'].import.browser = './dist/selected.browser.js';
    break;
  case 'missing-export':
    delete manifest.exports['./server-adapter/routes/harness'];
    break;
  case 'reorder-added-condition': {
    const selected = manifest.exports['./selected'].import;
    manifest.exports['./selected'].import = {
      default: selected.default,
      types: selected.types,
    };
    break;
  }
  case 'reorder-existing-condition': {
    const root = manifest.exports['.'].import;
    manifest.exports['.'].import = {
      default: root.default,
      types: root.types,
    };
    break;
  }
  default:
    throw new Error(`Unknown fixture mutation: ${mode}`);
}
fs.writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
NODE
    git add -A
    git commit -q -m "mutate manifest: $mode"
    git rev-parse HEAD
  )

  graph_mutation_head() (
    local mode="$1"
    cd "$fixture_repo"
    git reset -q --hard "$valid_head"
    case "$mode" in
      lockfile)
        printf '%s\n' 'unreviewed: true' >> pnpm-lock.yaml
        ;;
      workspace)
        printf '%s\n' "  - 'unreviewed/*'" >> pnpm-workspace.yaml
        ;;
      nested-manifest)
        printf '%s\n' '{"name":"@mastra/core","version":"2.0.0"}' \
          > packages/core/package.json
        ;;
      pnpm-hook)
        printf '%s\n' 'module.exports.unreviewed = true;' >> .pnpmfile.cjs
        ;;
      patch)
        printf '%s\n' 'unreviewed patch content' >> patches/trusted.patch
        ;;
      unknown-workspace)
        mkdir -p server-adapters/unreviewed
        printf '%s\n' '{"name":"@mastra/unreviewed"}' \
          > server-adapters/unreviewed/package.json
        ;;
      *)
        echo "Unknown graph mutation: $mode" >&2
        return 2
        ;;
    esac
    git add -A
    git commit -q -m "mutate dependency graph: $mode"
    git rev-parse HEAD
  )

  output="$test_root/accepted.log"
  run_fixture_admission "$valid_head" "$output"
  grep -Fxq 'lane=pf3553-selected-route-exports' "$output"

  mutation_head="$(json_mutation_head packages/server/package.json script)"
  assert_rejected script-metadata "$mutation_head"
  mutation_head="$(json_mutation_head server-adapters/fastify/package.json lifecycle)"
  assert_rejected lifecycle-metadata "$mutation_head"
  mutation_head="$(json_mutation_head server-adapters/fastify/package.json dependency)"
  assert_rejected dependency-metadata "$mutation_head"
  mutation_head="$(json_mutation_head packages/server/package.json files)"
  assert_rejected files-metadata "$mutation_head"
  mutation_head="$(json_mutation_head packages/server/package.json retarget)"
  assert_rejected export-retarget "$mutation_head"
  mutation_head="$(json_mutation_head server-adapters/fastify/package.json traversal)"
  assert_rejected export-traversal "$mutation_head"
  mutation_head="$(json_mutation_head packages/server/package.json wildcard)"
  assert_rejected wildcard-export "$mutation_head"
  mutation_head="$(json_mutation_head server-adapters/fastify/package.json extra-export)"
  assert_rejected extra-export "$mutation_head"
  mutation_head="$(json_mutation_head server-adapters/fastify/package.json extra-condition)"
  assert_rejected extra-condition "$mutation_head"
  mutation_head="$(json_mutation_head server-adapters/fastify/package.json reorder-added-condition)"
  assert_rejected reorder-added-condition "$mutation_head"
  mutation_head="$(json_mutation_head server-adapters/fastify/package.json reorder-existing-condition)"
  assert_rejected reorder-existing-condition "$mutation_head"
  mutation_head="$(json_mutation_head packages/server/package.json missing-export)"
  assert_rejected missing-export "$mutation_head"

  for graph_mutation in \
    lockfile workspace nested-manifest pnpm-hook patch unknown-workspace; do
    mutation_head="$(graph_mutation_head "$graph_mutation")"
    assert_rejected "$graph_mutation" "$mutation_head"
  done

  mutation_head="$(
    cd "$fixture_repo"
    git reset -q --hard "$valid_head"
    printf '%s\n' '{invalid json' > packages/server/package.json
    git add -A
    git commit -q -m 'invalid Server manifest'
    git rev-parse HEAD
  )"
  assert_rejected invalid-json "$mutation_head"

  mutation_head="$(
    cd "$fixture_repo"
    git reset -q --hard "$valid_head"
    git rm -q server-adapters/fastify/package.json
    git commit -q -m 'delete Fastify manifest'
    git rev-parse HEAD
  )"
  assert_rejected deleted-manifest "$mutation_head"

  mutation_head="$(
    cd "$fixture_repo"
    git reset -q --hard "$valid_head"
    rm server-adapters/fastify/package.json
    ln -s ../fastify-package.json server-adapters/fastify/package.json
    git add -A
    git commit -q -m 'replace Fastify manifest with symlink'
    git rev-parse HEAD
  )"
  assert_rejected nonregular-manifest "$mutation_head"

  mutation_head="$(
    cd "$fixture_repo"
    git reset -q --hard "$valid_head"
    printf '%s\n' 'unreviewed selected implementation' \
      > server-adapters/fastify/src/selected.ts
    git add server-adapters/fastify/src/selected.ts
    git commit -q -m 'mutate reviewed selected source'
    git rev-parse HEAD
  )"
  output="$test_root/reviewed-surface-drift.log"
  if run_fixture_admission "$mutation_head" "$output"; then
    echo 'PF-3553 source drift outside the reviewed file identities unexpectedly passed.' >&2
    return 1
  fi
  grep -Fq 'PF-3553 selected-route file identities differ from the reviewed head.' "$output"

  output="$test_root/wrong-head-metadata.log"
  if run_fixture_admission "$valid_head" "$output" HEAD_REF=feature/not-pf-3553; then
    echo 'PF-3553 exact manifests with wrong PR metadata unexpectedly passed.' >&2
    return 1
  fi
  grep -Fq 'do not match a reviewed upstream-sync lane' "$output"

  output="$test_root/wrong-base-metadata.log"
  if run_fixture_admission "$valid_head" "$output" BASE_REF=ci/unreviewed-policy; then
    echo 'PF-3553 exact manifests with an unreviewed base unexpectedly passed.' >&2
    return 1
  fi
  grep -Fq 'do not match a reviewed upstream-sync lane' "$output"

  echo 'PF-3553 exact reviewed-surface, export-order, dependency-graph, metadata, and file-mode admission fixtures passed.'
)

run_pf558_admission_self_tests() (
  local script_path test_root fixture_repo base_sha fork_parent upstream_parent merge_commit head_sha output
  local package_hash server_hash workspace_hash lockfile_hash patch_hash
  script_path="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
  test_root="$(mktemp -d)"
  fixture_repo="$test_root/repo"
  pf558_fixture_cleanup() {
    local status=$?
    trap - EXIT
    if (( status != 0 )); then
      echo 'PF-558 admission fixture failed; captured classifier output follows:' >&2
      find "$test_root" -maxdepth 1 -type f -name '*.log' -print -exec sed -n '1,240p' {} \; >&2 || true
    fi
    rm -rf -- "$test_root"
    exit "$status"
  }
  trap pf558_fixture_cleanup EXIT
  mkdir -p "$fixture_repo/packages/server"

  git -C "$fixture_repo" init -q -b main
  git -C "$fixture_repo" config user.email validator@example.invalid
  git -C "$fixture_repo" config user.name 'PF-558 admission fixture'
  printf '{"name":"fixture"}\n' > "$fixture_repo/package.json"
  printf '{"name":"server"}\n' > "$fixture_repo/packages/server/package.json"
  printf 'packages: []\n' > "$fixture_repo/pnpm-workspace.yaml"
  printf 'lockfileVersion: 9.0\n' > "$fixture_repo/pnpm-lock.yaml"
  git -C "$fixture_repo" add .
  git -C "$fixture_repo" commit -q -m base
  base_sha="$(git -C "$fixture_repo" rev-parse HEAD)"
  fork_parent="$base_sha"

  git -C "$fixture_repo" switch -q -c upstream
  printf 'upstream\n' > "$fixture_repo/upstream.txt"
  git -C "$fixture_repo" add upstream.txt
  git -C "$fixture_repo" commit -q -m upstream
  upstream_parent="$(git -C "$fixture_repo" rev-parse HEAD)"
  git -C "$fixture_repo" switch -q main
  git -C "$fixture_repo" merge -q --no-ff upstream -m merge
  merge_commit="$(git -C "$fixture_repo" rev-parse HEAD)"

  printf '{"name":"approved"}\n' > "$fixture_repo/package.json"
  printf '{"name":"approved-server"}\n' > "$fixture_repo/packages/server/package.json"
  printf 'packages:\n  - packages/*\n' > "$fixture_repo/pnpm-workspace.yaml"
  printf 'lockfileVersion: 9.0\nsettings:\n  autoInstallPeers: false\n' > "$fixture_repo/pnpm-lock.yaml"
  mkdir -p "$fixture_repo/patches"
  printf 'approved patch\n' > "$fixture_repo/patches/@earendil-works__pi-tui@0.80.6.patch"
  git -C "$fixture_repo" add .
  git -C "$fixture_repo" commit -q -m approved
  head_sha="$(git -C "$fixture_repo" rev-parse HEAD)"
  package_hash="$(sha256sum "$fixture_repo/package.json" | awk '{print $1}')"
  server_hash="$(sha256sum "$fixture_repo/packages/server/package.json" | awk '{print $1}')"
  workspace_hash="$(sha256sum "$fixture_repo/pnpm-workspace.yaml" | awk '{print $1}')"
  lockfile_hash="$(sha256sum "$fixture_repo/pnpm-lock.yaml" | awk '{print $1}')"
  patch_hash="$(sha256sum "$fixture_repo/patches/@earendil-works__pi-tui@0.80.6.patch" | awk '{print $1}')"

  run_fixture_admission() {
    local fixture_output="$1"
    shift
    (
      cd "$fixture_repo"
      env \
        GITHUB_OUTPUT= \
        BASE_SHA="$base_sha" HEAD_SHA="$head_sha" PR_NUMBER=266 \
        HEAD_REPOSITORY=mbenhamd/mastra HEAD_REF=feature/pf-558-upstream-sync-20260714 BASE_REF=main \
        PAPERSFLOW_PF558_MERGE_COMMIT="$merge_commit" \
        PAPERSFLOW_PF558_FORK_PARENT="$fork_parent" \
        PAPERSFLOW_PF558_UPSTREAM_PARENT="$upstream_parent" \
        PAPERSFLOW_PF558_PACKAGE_JSON_SHA256="$package_hash" \
        PAPERSFLOW_PF558_SERVER_PACKAGE_JSON_SHA256="$server_hash" \
        PAPERSFLOW_PF558_WORKSPACE_SHA256="$workspace_hash" \
        PAPERSFLOW_PF558_LOCKFILE_SHA256="$lockfile_hash" \
        PAPERSFLOW_PF558_PI_TUI_PATCH_SHA256="$patch_hash" \
        "$@" bash "$script_path" --classify-install
    ) > "$fixture_output" 2>&1
  }

  output="$test_root/approved.log"
  run_fixture_admission "$output"
  grep -Fxq 'lane=pf558-upstream-sync' "$output"

  printf '{"name":"tampered"}\n' > "$fixture_repo/package.json"
  git -C "$fixture_repo" commit -q -am tampered
  head_sha="$(git -C "$fixture_repo" rev-parse HEAD)"
  output="$test_root/tampered.log"
  if run_fixture_admission "$output"; then
    echo 'Tampered PF-558 manifest unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'approved dependency file hash changed: package.json' "$output"

  git -C "$fixture_repo" reset -q --hard HEAD^
  printf 'lockfileVersion: 9.0\ntampered: true\n' > "$fixture_repo/pnpm-lock.yaml"
  git -C "$fixture_repo" commit -q -am 'tamper lockfile'
  head_sha="$(git -C "$fixture_repo" rev-parse HEAD)"
  output="$test_root/tampered-lockfile.log"
  if run_fixture_admission "$output"; then
    echo 'Tampered PF-558 lockfile unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'approved dependency file hash changed: pnpm-lock.yaml' "$output"

  git -C "$fixture_repo" reset -q --hard HEAD^
  printf 'tampered patch\n' > "$fixture_repo/patches/@earendil-works__pi-tui@0.80.6.patch"
  git -C "$fixture_repo" commit -q -am 'tamper approved patch'
  head_sha="$(git -C "$fixture_repo" rev-parse HEAD)"
  output="$test_root/tampered-patch.log"
  if run_fixture_admission "$output"; then
    echo 'Tampered PF-558 approved patch unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'approved dependency file hash changed: patches/@earendil-works__pi-tui@0.80.6.patch' "$output"

  git -C "$fixture_repo" reset -q --hard HEAD^
  printf 'unreviewed\n' > "$fixture_repo/patches/unreviewed.patch"
  git -C "$fixture_repo" add patches/unreviewed.patch
  git -C "$fixture_repo" commit -q -m unreviewed
  head_sha="$(git -C "$fixture_repo" rev-parse HEAD)"
  output="$test_root/unreviewed.log"
  if run_fixture_admission "$output"; then
    echo 'Unreviewed PF-558 dependency path unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'outside the exact reviewed set' "$output"

  git -C "$fixture_repo" reset -q --hard HEAD^
  head_sha="$(git -C "$fixture_repo" rev-parse HEAD)"
  output="$test_root/wrong-pr.log"
  if run_fixture_admission "$output" PR_NUMBER=999; then
    echo 'Wrong PR metadata unexpectedly passed PF-558 admission.' >&2
    return 1
  fi
  grep -Fq 'do not match a reviewed upstream-sync lane' "$output"

  echo 'PF-558 upstream-sync admission fixtures passed.'
)

run_pf2009_admission_self_tests() (
  local script_path test_root fixture_repo base_sha fork_parent primary_upstream_parent
  local primary_merge_commit latest_upstream_parent latest_merge_commit head_sha output
  local package_hash server_hash workspace_hash lockfile_hash dependency_graph_hash weird_dir
  script_path="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
  test_root="$(mktemp -d)"
  fixture_repo="$test_root/repo"
  pf2009_fixture_cleanup() {
    local status=$?
    trap - EXIT
    if (( status != 0 )); then
      echo 'PF-2009 admission fixture failed; captured classifier output follows:' >&2
      find "$test_root" -maxdepth 1 -type f -name '*.log' -print -exec sed -n '1,240p' {} \; >&2 || true
    fi
    rm -rf -- "$test_root"
    exit "$status"
  }
  trap pf2009_fixture_cleanup EXIT
  mkdir -p "$fixture_repo/packages/server" "$fixture_repo/packages/nested" "$fixture_repo/patches"

  git -C "$fixture_repo" init -q -b main
  git -C "$fixture_repo" config user.email validator@example.invalid
  git -C "$fixture_repo" config user.name 'PF-2009 admission fixture'
  printf '{"name":"fixture"}\n' > "$fixture_repo/package.json"
  printf '{"name":"server"}\n' > "$fixture_repo/packages/server/package.json"
  printf '{"name":"nested"}\n' > "$fixture_repo/packages/nested/package.json"
  printf 'packages:\n  - packages/*\n' > "$fixture_repo/pnpm-workspace.yaml"
  printf 'lockfileVersion: 9.0\n' > "$fixture_repo/pnpm-lock.yaml"
  printf 'approved patch\n' > "$fixture_repo/patches/existing.patch"
  git -C "$fixture_repo" add .
  git -C "$fixture_repo" commit -q -m base
  base_sha="$(git -C "$fixture_repo" rev-parse HEAD)"
  fork_parent="$base_sha"

  git -C "$fixture_repo" switch -q -c upstream
  printf 'upstream runtime\n' > "$fixture_repo/upstream.txt"
  git -C "$fixture_repo" add upstream.txt
  git -C "$fixture_repo" commit -q -m upstream
  primary_upstream_parent="$(git -C "$fixture_repo" rev-parse HEAD)"
  git -C "$fixture_repo" switch -q main
  git -C "$fixture_repo" merge -q --no-ff upstream -m 'primary upstream merge'
  primary_merge_commit="$(git -C "$fixture_repo" rev-parse HEAD)"

  git -C "$fixture_repo" switch -q upstream
  printf 'latest docs\n' > "$fixture_repo/latest.txt"
  git -C "$fixture_repo" add latest.txt
  git -C "$fixture_repo" commit -q -m 'latest upstream'
  latest_upstream_parent="$(git -C "$fixture_repo" rev-parse HEAD)"
  git -C "$fixture_repo" switch -q main
  git -C "$fixture_repo" merge -q --no-ff upstream -m 'latest upstream merge'
  latest_merge_commit="$(git -C "$fixture_repo" rev-parse HEAD)"

  printf '{"name":"approved"}\n' > "$fixture_repo/package.json"
  printf '{"name":"approved-server"}\n' > "$fixture_repo/packages/server/package.json"
  printf '{"name":"approved-nested"}\n' > "$fixture_repo/packages/nested/package.json"
  printf 'lockfileVersion: 9.0\nsettings:\n  autoInstallPeers: false\n' > "$fixture_repo/pnpm-lock.yaml"
  git -C "$fixture_repo" add .
  git -C "$fixture_repo" commit -q -m approved
  head_sha="$(git -C "$fixture_repo" rev-parse HEAD)"
  package_hash="$(sha256sum "$fixture_repo/package.json" | awk '{print $1}')"
  server_hash="$(sha256sum "$fixture_repo/packages/server/package.json" | awk '{print $1}')"
  workspace_hash="$(sha256sum "$fixture_repo/pnpm-workspace.yaml" | awk '{print $1}')"
  lockfile_hash="$(sha256sum "$fixture_repo/pnpm-lock.yaml" | awk '{print $1}')"
  dependency_graph_hash="$(cd "$fixture_repo" && git_dependency_graph_sha256 "$head_sha")"

  run_fixture_admission() {
    local fixture_output="$1"
    shift
    (
      cd "$fixture_repo"
      env \
        GITHUB_OUTPUT= \
        BASE_SHA="$base_sha" HEAD_SHA="$head_sha" PR_NUMBER=277 \
        HEAD_REPOSITORY=mbenhamd/mastra \
        HEAD_REF=feature/pf-2009-upstream-refresh-20260715 BASE_REF=main \
        PAPERSFLOW_PF2009_PRIMARY_MERGE_COMMIT="$primary_merge_commit" \
        PAPERSFLOW_PF2009_FORK_PARENT="$fork_parent" \
        PAPERSFLOW_PF2009_PRIMARY_UPSTREAM_PARENT="$primary_upstream_parent" \
        PAPERSFLOW_PF2009_LATEST_MERGE_COMMIT="$latest_merge_commit" \
        PAPERSFLOW_PF2009_LATEST_FIRST_PARENT="$primary_merge_commit" \
        PAPERSFLOW_PF2009_LATEST_UPSTREAM_PARENT="$latest_upstream_parent" \
        PAPERSFLOW_PF2009_PACKAGE_JSON_SHA256="$package_hash" \
        PAPERSFLOW_PF2009_SERVER_PACKAGE_JSON_SHA256="$server_hash" \
        PAPERSFLOW_PF2009_WORKSPACE_SHA256="$workspace_hash" \
        PAPERSFLOW_PF2009_LOCKFILE_SHA256="$lockfile_hash" \
        PAPERSFLOW_PF2009_DEPENDENCY_GRAPH_SHA256="$dependency_graph_hash" \
        "$@" bash "$script_path" --classify-install
    ) > "$fixture_output" 2>&1
  }

  output="$test_root/approved.log"
  run_fixture_admission "$output"
  grep -Fxq 'lane=pf2009-upstream-sync' "$output"

  printf '{"name":"tampered"}\n' > "$fixture_repo/package.json"
  git -C "$fixture_repo" commit -q -am tampered
  head_sha="$(git -C "$fixture_repo" rev-parse HEAD)"
  output="$test_root/tampered.log"
  if run_fixture_admission "$output"; then
    echo 'Tampered PF-2009 manifest unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'approved dependency file hash changed: package.json' "$output"

  git -C "$fixture_repo" reset -q --hard HEAD^
  printf '{"name":"tampered-nested"}\n' > "$fixture_repo/packages/nested/package.json"
  git -C "$fixture_repo" commit -q -am 'tamper nested manifest'
  head_sha="$(git -C "$fixture_repo" rev-parse HEAD)"
  output="$test_root/tampered-graph.log"
  if run_fixture_admission "$output"; then
    echo 'Tampered PF-2009 dependency graph unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'dependency-graph tree hash changed' "$output"

  git -C "$fixture_repo" reset -q --hard HEAD^
  weird_dir="$fixture_repo/packages/"$'weird\nname'
  mkdir -p "$weird_dir"
  printf '{"name":"tampered-unusual-path"}\n' > "$weird_dir/package.json"
  git -C "$fixture_repo" add .
  git -C "$fixture_repo" commit -q -m 'tamper unusual dependency path'
  head_sha="$(git -C "$fixture_repo" rev-parse HEAD)"
  output="$test_root/tampered-unusual-path.log"
  if run_fixture_admission "$output"; then
    echo 'Unusual-path PF-2009 dependency tampering unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'dependency-graph tree hash changed' "$output"

  git -C "$fixture_repo" reset -q --hard HEAD^
  printf 'unreviewed\n' > "$fixture_repo/patches/unreviewed.patch"
  git -C "$fixture_repo" add patches/unreviewed.patch
  git -C "$fixture_repo" commit -q -m 'unreviewed dependency path'
  head_sha="$(git -C "$fixture_repo" rev-parse HEAD)"
  output="$test_root/unreviewed.log"
  if run_fixture_admission "$output"; then
    echo 'Unreviewed PF-2009 dependency path unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'outside the exact reviewed set' "$output"

  git -C "$fixture_repo" reset -q --hard HEAD^
  head_sha="$(git -C "$fixture_repo" rev-parse HEAD)"
  output="$test_root/wrong-topology.log"
  if run_fixture_admission "$output" PAPERSFLOW_PF2009_LATEST_UPSTREAM_PARENT="$fork_parent"; then
    echo 'Wrong PF-2009 latest-upstream parent unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'latest-upstream merge topology' "$output"

  output="$test_root/wrong-pr.log"
  if run_fixture_admission "$output" PR_NUMBER=999; then
    echo 'Wrong PR metadata unexpectedly passed PF-2009 admission.' >&2
    return 1
  fi
  grep -Fq 'do not match a reviewed upstream-sync lane' "$output"

  echo 'PF-2009 upstream-sync admission fixtures passed.'
)

run_pf2045_admission_self_tests() (
  local script_path test_root fixture_repo common_sha base_sha upstream_parent head_sha output
  local octopus_head non_merge_head forged_tree forged_head forged_resolution_tree forged_resolution_head
  local forged_changeset_tree forged_changeset_head forged_e2e_tree forged_e2e_head
  local benign_base benign_head benign_policy_blob benign_tree
  local extra_parent drift_base drift_head agent_utils_drift_base agent_utils_drift_head
  local approval_e2e_blob approval_e2e_sha approval_test_blob approval_test_sha
  local changeset_blob changeset_sha chat_route_blob chat_route_sha
  local agent_utils_blob agent_utils_sha agents_blob agents_sha
  local lockfile_blob lockfile_sha workspace_blob workspace_sha
  local fixture_conflict_stages path rehearsed_tree wrong_rehearsal_tree
  script_path="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
  test_root="$(mktemp -d)"
  fixture_repo="$test_root/repo"
  pf2045_fixture_cleanup() {
    local status=$?
    trap - EXIT
    if (( status != 0 )); then
      echo 'PF-2045 admission fixture failed; captured classifier output follows:' >&2
      find "$test_root" -maxdepth 1 -type f -name '*.log' -print -exec sed -n '1,240p' {} \; >&2 || true
    fi
    rm -rf -- "$test_root"
    exit "$status"
  }
  trap pf2045_fixture_cleanup EXIT

  mkdir -p "$fixture_repo"
  git -C "$fixture_repo" init -q -b main
  git -C "$fixture_repo" config user.email validator@example.invalid
  git -C "$fixture_repo" config user.name 'PF-2045 admission fixture'
  printf '{"name":"fixture"}\n' > "$fixture_repo/package.json"
  mkdir -p "$fixture_repo/client-sdks/ai-sdk/src/__tests__"
  mkdir -p "$fixture_repo/packages/core/src/agent"
  mkdir -p "$fixture_repo/packages/server/src/server/handlers"
  printf 'expect(extractApproval()).toEqual(null);\n' \
    > "$fixture_repo/client-sdks/ai-sdk/src/__tests__/tool-call-approval.test.ts"
  printf 'export const extractApprovals = () => latestApproval;\n' \
    > "$fixture_repo/client-sdks/ai-sdk/src/chat-route.ts"
  printf 'export const streamResult = () => onStream?.(result);\n' \
    > "$fixture_repo/packages/core/src/agent/utils.ts"
  printf 'export const options = { memory: clientMemory };\n' \
    > "$fixture_repo/packages/server/src/server/handlers/agents.ts"
  printf 'packages: []\nproviderUtils: old\n' > "$fixture_repo/pnpm-workspace.yaml"
  printf 'lockfileVersion: 9.0\ngraph: old\n' > "$fixture_repo/pnpm-lock.yaml"
  git -C "$fixture_repo" add .
  git -C "$fixture_repo" commit -q -m common
  common_sha="$(git -C "$fixture_repo" rev-parse HEAD)"

  printf 'expect(extractApproval()).toEqual({ runId, toolCallId });\n' \
    > "$fixture_repo/client-sdks/ai-sdk/src/__tests__/tool-call-approval.test.ts"
  printf 'export const extractApprovals = () => validateApprovalIdentity(latestApproval);\n' \
    > "$fixture_repo/client-sdks/ai-sdk/src/chat-route.ts"
  printf 'export const streamResult = () => notifyStreamObserver(onStream, result);\n' \
    > "$fixture_repo/packages/core/src/agent/utils.ts"
  printf 'export const options = { ...params, requestContext };\n' \
    > "$fixture_repo/packages/server/src/server/handlers/agents.ts"
  printf 'packages: []\nproviderUtils: vitest-4.1.10\n' > "$fixture_repo/pnpm-workspace.yaml"
  printf 'lockfileVersion: 9.0\ngraph: fork\n' > "$fixture_repo/pnpm-lock.yaml"
  git -C "$fixture_repo" commit -q -am fork
  base_sha="$(git -C "$fixture_repo" rev-parse HEAD)"

  git -C "$fixture_repo" switch -q -c upstream "$common_sha"
  mkdir -p "$fixture_repo/.changeset"
  printf 'Approvals are collected across all assistant messages.\n' \
    > "$fixture_repo/.changeset/fresh-donuts-divide.md"
  printf "describe('whole-request approvals', () => {});\n" \
    > "$fixture_repo/client-sdks/ai-sdk/src/__tests__/tool-call-approval.e2e.test.ts"
  printf 'expect(extractApprovals()).toContainHistoricalAndTrailingResponses();\n' \
    > "$fixture_repo/client-sdks/ai-sdk/src/__tests__/tool-call-approval.test.ts"
  printf 'export const extractApprovals = () => scanAllAssistantMessages();\n' \
    > "$fixture_repo/client-sdks/ai-sdk/src/chat-route.ts"
  printf 'export const streamResult = async () => { onStream?.(result); await result.object; };\n' \
    > "$fixture_repo/packages/core/src/agent/utils.ts"
  printf 'export const options = { ...params, memory: authorizedMemoryOption };\n' \
    > "$fixture_repo/packages/server/src/server/handlers/agents.ts"
  printf 'packages: []\nproviderUtils: adds-3.0.28\n' > "$fixture_repo/pnpm-workspace.yaml"
  printf 'lockfileVersion: 9.0\ngraph: upstream\n' > "$fixture_repo/pnpm-lock.yaml"
  git -C "$fixture_repo" add .
  git -C "$fixture_repo" commit -q -m upstream
  upstream_parent="$(git -C "$fixture_repo" rev-parse HEAD)"
  non_merge_head="$upstream_parent"

  git -C "$fixture_repo" switch -q main
  if git -C "$fixture_repo" merge -q --no-ff --no-commit upstream; then
    echo 'PF-2045 fixture unexpectedly merged without the six reviewed conflicts.' >&2
    return 1
  fi
  if [[ "$(git -C "$fixture_repo" ls-files -u | wc -l | tr -d ' ')" != 18 ]]; then
    echo 'PF-2045 fixture did not produce the eighteen reviewed conflict-stage entries.' >&2
    return 1
  fi
  printf 'expect(extractApprovals()).toEqual(trailingAssistantApprovalsOnly());\n' \
    > "$fixture_repo/client-sdks/ai-sdk/src/__tests__/tool-call-approval.test.ts"
  printf 'Only trailing-message approvals resume; unsafe historical pending responses fail closed.\n' \
    > "$fixture_repo/.changeset/fresh-donuts-divide.md"
  printf "describe('trailing-message approval batch', () => {});\n" \
    > "$fixture_repo/client-sdks/ai-sdk/src/__tests__/tool-call-approval.e2e.test.ts"
  printf 'export const extractApprovals = () => inspectTrailingAssistant({ failClosedHistoricalPending: true });\n' \
    > "$fixture_repo/client-sdks/ai-sdk/src/chat-route.ts"
  printf 'export const streamResult = async () => { notifyStreamObserver(onStream, result); await result.object; };\n' \
    > "$fixture_repo/packages/core/src/agent/utils.ts"
  printf 'export const options = { ...params, requestContext, memory: authorizedMemoryOption };\n' \
    > "$fixture_repo/packages/server/src/server/handlers/agents.ts"
  printf 'packages: []\nproviderUtils: vitest-4.1.10-and-3.0.28\n' > "$fixture_repo/pnpm-workspace.yaml"
  printf 'lockfileVersion: 9.0\ngraph: reconciled\n' > "$fixture_repo/pnpm-lock.yaml"
  git -C "$fixture_repo" add \
    .changeset/fresh-donuts-divide.md \
    client-sdks/ai-sdk/src/__tests__/tool-call-approval.e2e.test.ts \
    client-sdks/ai-sdk/src/__tests__/tool-call-approval.test.ts \
    client-sdks/ai-sdk/src/chat-route.ts \
    packages/core/src/agent/utils.ts packages/server/src/server/handlers/agents.ts \
    pnpm-workspace.yaml pnpm-lock.yaml
  git -C "$fixture_repo" commit -q -m 'PF-2045 upstream merge'
  head_sha="$(git -C "$fixture_repo" rev-parse HEAD)"
  rehearsed_tree="$(git -C "$fixture_repo" rev-parse "$head_sha^{tree}")"
  wrong_rehearsal_tree="$(git -C "$fixture_repo" rev-parse "$base_sha^{tree}")"
  changeset_blob="$(git -C "$fixture_repo" rev-parse "$head_sha:.changeset/fresh-donuts-divide.md")"
  changeset_sha="$(
    git -C "$fixture_repo" show "$head_sha:.changeset/fresh-donuts-divide.md" |
      sha256sum |
      awk '{print $1}'
  )"
  approval_e2e_blob="$(
    git -C "$fixture_repo" rev-parse "$head_sha:client-sdks/ai-sdk/src/__tests__/tool-call-approval.e2e.test.ts"
  )"
  approval_e2e_sha="$(
    git -C "$fixture_repo" show "$head_sha:client-sdks/ai-sdk/src/__tests__/tool-call-approval.e2e.test.ts" |
      sha256sum |
      awk '{print $1}'
  )"
  approval_test_blob="$(
    git -C "$fixture_repo" rev-parse "$head_sha:client-sdks/ai-sdk/src/__tests__/tool-call-approval.test.ts"
  )"
  approval_test_sha="$(
    git -C "$fixture_repo" show "$head_sha:client-sdks/ai-sdk/src/__tests__/tool-call-approval.test.ts" |
      sha256sum |
      awk '{print $1}'
  )"
  chat_route_blob="$(git -C "$fixture_repo" rev-parse "$head_sha:client-sdks/ai-sdk/src/chat-route.ts")"
  chat_route_sha="$(
    git -C "$fixture_repo" show "$head_sha:client-sdks/ai-sdk/src/chat-route.ts" |
      sha256sum |
      awk '{print $1}'
  )"
  agent_utils_blob="$(git -C "$fixture_repo" rev-parse "$head_sha:packages/core/src/agent/utils.ts")"
  agent_utils_sha="$(
    git -C "$fixture_repo" show "$head_sha:packages/core/src/agent/utils.ts" |
      sha256sum |
      awk '{print $1}'
  )"
  agents_blob="$(git -C "$fixture_repo" rev-parse "$head_sha:packages/server/src/server/handlers/agents.ts")"
  agents_sha="$(git -C "$fixture_repo" show "$head_sha:packages/server/src/server/handlers/agents.ts" | sha256sum | awk '{print $1}')"
  lockfile_blob="$(git -C "$fixture_repo" rev-parse "$head_sha:pnpm-lock.yaml")"
  lockfile_sha="$(git -C "$fixture_repo" show "$head_sha:pnpm-lock.yaml" | sha256sum | awk '{print $1}')"
  workspace_blob="$(git -C "$fixture_repo" rev-parse "$head_sha:pnpm-workspace.yaml")"
  workspace_sha="$(git -C "$fixture_repo" show "$head_sha:pnpm-workspace.yaml" | sha256sum | awk '{print $1}')"
  fixture_conflict_stages="$({
    for path in \
      client-sdks/ai-sdk/src/__tests__/tool-call-approval.test.ts \
      client-sdks/ai-sdk/src/chat-route.ts \
      packages/core/src/agent/utils.ts \
      packages/server/src/server/handlers/agents.ts \
      pnpm-lock.yaml \
      pnpm-workspace.yaml; do
      printf '100644 %s 1\t%s\n' "$(git -C "$fixture_repo" rev-parse "$common_sha:$path")" "$path"
      printf '100644 %s 2\t%s\n' "$(git -C "$fixture_repo" rev-parse "$base_sha:$path")" "$path"
      printf '100644 %s 3\t%s\n' "$(git -C "$fixture_repo" rev-parse "$upstream_parent:$path")" "$path"
    done
  } | LC_ALL=C sort)"

  run_fixture_admission() {
    local fixture_head="$1"
    local fixture_output="$2"
    shift 2
    (
      cd "$fixture_repo"
      env \
        GITHUB_OUTPUT= \
        BASE_SHA="$base_sha" HEAD_SHA="$fixture_head" PR_NUMBER=999 \
        HEAD_REPOSITORY=mbenhamd/mastra \
        HEAD_REF=feature/pf-2045-mastra-fork-merge-official-main-through-4fb4d881-before-the \
        BASE_REF=main \
        PAPERSFLOW_PF2045_UPSTREAM_PARENT="$upstream_parent" \
        PAPERSFLOW_PF2045_REHEARSED_BASE="$base_sha" \
        PAPERSFLOW_PF2045_REHEARSED_TREE="$rehearsed_tree" \
        PAPERSFLOW_PF2045_UPSTREAM_DELTA_PATH_COUNT=8 \
        PAPERSFLOW_PF2045_RECONCILED_PATH_COUNT=8 \
        PAPERSFLOW_PF2045_CONFLICT_FILE_COUNT=6 \
        PAPERSFLOW_PF2045_CONFLICT_STAGE_COUNT=18 \
        PAPERSFLOW_PF2045_CONFLICT_REGION_COUNT=6 \
        PAPERSFLOW_PF2045_CONFLICT_STAGES="$fixture_conflict_stages" \
        PAPERSFLOW_PF2045_AI_SDK_APPROVAL_TEST_BLOB="$approval_test_blob" \
        PAPERSFLOW_PF2045_AI_SDK_APPROVAL_TEST_SHA256="$approval_test_sha" \
        PAPERSFLOW_PF2045_AI_SDK_APPROVAL_E2E_BLOB="$approval_e2e_blob" \
        PAPERSFLOW_PF2045_AI_SDK_APPROVAL_E2E_SHA256="$approval_e2e_sha" \
        PAPERSFLOW_PF2045_AI_SDK_CHAT_ROUTE_BLOB="$chat_route_blob" \
        PAPERSFLOW_PF2045_AI_SDK_CHAT_ROUTE_SHA256="$chat_route_sha" \
        PAPERSFLOW_PF2045_AI_SDK_CHANGESET_BLOB="$changeset_blob" \
        PAPERSFLOW_PF2045_AI_SDK_CHANGESET_SHA256="$changeset_sha" \
        PAPERSFLOW_PF2045_AGENT_UTILS_BLOB="$agent_utils_blob" \
        PAPERSFLOW_PF2045_AGENT_UTILS_SHA256="$agent_utils_sha" \
        PAPERSFLOW_PF2045_AGENTS_BLOB="$agents_blob" \
        PAPERSFLOW_PF2045_AGENTS_SHA256="$agents_sha" \
        PAPERSFLOW_PF2045_LOCKFILE_BLOB="$lockfile_blob" \
        PAPERSFLOW_PF2045_LOCKFILE_SHA256="$lockfile_sha" \
        PAPERSFLOW_PF2045_WORKSPACE_BLOB="$workspace_blob" \
        PAPERSFLOW_PF2045_WORKSPACE_SHA256="$workspace_sha" \
        "$@" bash "$script_path" --classify-install
    ) > "$fixture_output" 2>&1
  }

  output="$test_root/approved.log"
  run_fixture_admission "$head_sha" "$output"
  grep -Fxq 'lane=pf2045-upstream-sync' "$output"

  output="$test_root/wrong-rehearsal-tree.log"
  if run_fixture_admission \
    "$head_sha" "$output" PAPERSFLOW_PF2045_REHEARSED_TREE="$wrong_rehearsal_tree"; then
    echo 'PF-2045 wrong frozen rehearsal tree unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'exact rehearsal no longer reconstructs its frozen reviewed tree' "$output"

  git -C "$fixture_repo" switch -q -c benign-base-advance "$base_sha"
  printf 'trusted policy advanced without touching merge inputs\n' \
    > "$fixture_repo/protected-base-policy.txt"
  git -C "$fixture_repo" add protected-base-policy.txt
  git -C "$fixture_repo" commit -q -m 'advance protected base outside reviewed merge inputs'
  benign_base="$(git -C "$fixture_repo" rev-parse HEAD)"
  benign_policy_blob="$(git -C "$fixture_repo" rev-parse "$benign_base:protected-base-policy.txt")"
  git -C "$fixture_repo" read-tree "$head_sha^{tree}"
  git -C "$fixture_repo" update-index --add --cacheinfo \
    100644 "$benign_policy_blob" protected-base-policy.txt
  benign_tree="$(git -C "$fixture_repo" write-tree)"
  benign_head="$(printf 'PF-2045 merge on advanced protected base\n' | git -C "$fixture_repo" commit-tree \
    "$benign_tree" -p "$benign_base" -p "$upstream_parent")"
  git -C "$fixture_repo" reset -q --hard "$head_sha"
  output="$test_root/benign-protected-base-advance.log"
  run_fixture_admission "$benign_head" "$output" BASE_SHA="$benign_base"
  grep -Fxq 'lane=pf2045-upstream-sync' "$output"

  printf 'export const extractApprovals = () => scanAllAssistantMessages();\n' \
    > "$fixture_repo/client-sdks/ai-sdk/src/chat-route.ts"
  git -C "$fixture_repo" add client-sdks/ai-sdk/src/chat-route.ts
  forged_resolution_tree="$(git -C "$fixture_repo" write-tree)"
  forged_resolution_head="$(printf 'forged AI SDK conflict resolution\n' | git -C "$fixture_repo" commit-tree \
    "$forged_resolution_tree" -p "$base_sha" -p "$upstream_parent")"
  git -C "$fixture_repo" reset -q --hard "$head_sha"
  output="$test_root/forged-resolution.log"
  if run_fixture_admission "$forged_resolution_head" "$output"; then
    echo 'PF-2045 forged AI SDK conflict resolution unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq \
    'head does not contain the reviewed regular-file content: client-sdks/ai-sdk/src/chat-route.ts' \
    "$output"

  printf 'Approvals are collected across all assistant messages.\n' \
    > "$fixture_repo/.changeset/fresh-donuts-divide.md"
  git -C "$fixture_repo" add .changeset/fresh-donuts-divide.md
  forged_changeset_tree="$(git -C "$fixture_repo" write-tree)"
  forged_changeset_head="$(printf 'forged approval changeset overlay\n' | git -C "$fixture_repo" commit-tree \
    "$forged_changeset_tree" -p "$base_sha" -p "$upstream_parent")"
  git -C "$fixture_repo" reset -q --hard "$head_sha"
  output="$test_root/forged-changeset-overlay.log"
  if run_fixture_admission "$forged_changeset_head" "$output"; then
    echo 'PF-2045 forged approval changeset overlay unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq \
    'head does not contain the reviewed regular-file content: .changeset/fresh-donuts-divide.md' \
    "$output"

  printf "describe('whole-request approvals', () => {});\n" \
    > "$fixture_repo/client-sdks/ai-sdk/src/__tests__/tool-call-approval.e2e.test.ts"
  git -C "$fixture_repo" add client-sdks/ai-sdk/src/__tests__/tool-call-approval.e2e.test.ts
  forged_e2e_tree="$(git -C "$fixture_repo" write-tree)"
  forged_e2e_head="$(printf 'forged approval replay E2E overlay\n' | git -C "$fixture_repo" commit-tree \
    "$forged_e2e_tree" -p "$base_sha" -p "$upstream_parent")"
  git -C "$fixture_repo" reset -q --hard "$head_sha"
  output="$test_root/forged-e2e-overlay.log"
  if run_fixture_admission "$forged_e2e_head" "$output"; then
    echo 'PF-2045 forged approval replay E2E overlay unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq \
    'head does not contain the reviewed regular-file content: client-sdks/ai-sdk/src/__tests__/tool-call-approval.e2e.test.ts' \
    "$output"

  git -C "$fixture_repo" switch -q main
  printf 'not part of the reviewed merge\n' > "$fixture_repo/forged.txt"
  git -C "$fixture_repo" add forged.txt
  forged_tree="$(git -C "$fixture_repo" write-tree)"
  forged_head="$(printf 'forged same-parent tree\n' | git -C "$fixture_repo" commit-tree \
    "$forged_tree" -p "$base_sha" -p "$upstream_parent")"
  git -C "$fixture_repo" reset -q --hard "$head_sha"
  output="$test_root/forged-tree.log"
  if run_fixture_admission "$forged_head" "$output"; then
    echo 'PF-2045 forged tree with the reviewed parents unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'does not match the reconstructed reviewed merge tree' "$output"

  git -C "$fixture_repo" switch -q -c agent-utils-conflict-drift "$base_sha"
  printf 'export const streamResult = () => notifyStreamObserver(onStream, result, forkGuard);\n' \
    > "$fixture_repo/packages/core/src/agent/utils.ts"
  git -C "$fixture_repo" commit -q -am 'advance protected base agent-utils conflict input'
  agent_utils_drift_base="$(git -C "$fixture_repo" rev-parse HEAD)"
  agent_utils_drift_head="$(printf 'discarded protected-base agent-utils conflict guard\n' | \
    git -C "$fixture_repo" commit-tree \
      "$head_sha^{tree}" -p "$agent_utils_drift_base" -p "$upstream_parent")"
  output="$test_root/agent-utils-conflict-stage-drift.log"
  if run_fixture_admission "$agent_utils_drift_head" "$output" BASE_SHA="$agent_utils_drift_base"; then
    echo 'PF-2045 merge that discarded the newer agent-utils conflict input unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'merge conflict inputs differ from the 18 reviewed' "$output"

  git -C "$fixture_repo" switch -q -c drift-base "$base_sha"
  printf 'export const options = { ...params, requestContext, forkGuard: true };\n' \
    > "$fixture_repo/packages/server/src/server/handlers/agents.ts"
  git -C "$fixture_repo" commit -q -am 'advance protected base conflict input'
  drift_base="$(git -C "$fixture_repo" rev-parse HEAD)"
  drift_head="$(printf 'discarded protected-base guard\n' | git -C "$fixture_repo" commit-tree \
    "$head_sha^{tree}" -p "$drift_base" -p "$upstream_parent")"
  output="$test_root/base-stage-drift.log"
  if run_fixture_admission "$drift_head" "$output" BASE_SHA="$drift_base"; then
    echo 'PF-2045 merge that discarded a newer protected-base conflict input unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'merge conflict inputs differ from the 18 reviewed' "$output"

  output="$test_root/wrong-upstream-parent.log"
  if run_fixture_admission "$head_sha" "$output" PAPERSFLOW_PF2045_UPSTREAM_PARENT="$base_sha"; then
    echo 'Wrong PF-2045 upstream parent unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'not the exact reviewed two-parent upstream merge topology' "$output"

  output="$test_root/wrong-first-parent.log"
  if run_fixture_admission "$head_sha" "$output" BASE_SHA="$upstream_parent"; then
    echo 'Wrong PF-2045 first parent unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'not the exact reviewed two-parent upstream merge topology' "$output"

  git -C "$fixture_repo" switch -q main
  git -C "$fixture_repo" reset -q --hard "$base_sha"
  git -C "$fixture_repo" switch -q -c extra
  printf 'extra\n' > "$fixture_repo/extra.txt"
  git -C "$fixture_repo" add extra.txt
  git -C "$fixture_repo" commit -q -m extra
  extra_parent="$(git -C "$fixture_repo" rev-parse HEAD)"
  octopus_head="$(printf 'unreviewed octopus merge\n' | git -C "$fixture_repo" commit-tree \
    "$head_sha^{tree}" -p "$base_sha" -p "$upstream_parent" -p "$extra_parent")"
  output="$test_root/extra-parent.log"
  if run_fixture_admission "$octopus_head" "$output"; then
    echo 'PF-2045 octopus merge unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'not the exact reviewed two-parent upstream merge topology' "$output"

  output="$test_root/wrong-metadata.log"
  if run_fixture_admission "$head_sha" "$output" HEAD_REF=feature/not-pf-2045; then
    echo 'Wrong PF-2045 branch metadata unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'do not match a reviewed upstream-sync lane' "$output"

  output="$test_root/non-merge-head.log"
  if run_fixture_admission "$non_merge_head" "$output" BASE_SHA="$base_sha"; then
    echo 'Non-merge PF-2045 head unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'not the exact reviewed two-parent upstream merge topology' "$output"

  echo 'PF-2045 upstream-sync topology and reconstructed-tree admission fixtures passed.'
)

run_pf4051_admission_self_tests() (
  local script_path test_root fixture_repo common_sha fork_parent upstream_parent
  local reviewed_head reviewed_tree protected_base forged_tree forged_head
  local reversed_head extra_parent octopus_head non_merge_head output
  local trusted_main extra_shared_parent unapproved_base mock_bin command_log preservation_command
  local web_install_line web_check_line web_test_line

  script_path="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
  test_root="$(mktemp -d)"
  fixture_repo="$test_root/repo"
  pf4051_fixture_cleanup() {
    local status=$?
    trap - EXIT
    if (( status != 0 )); then
      echo 'PF-4051 admission fixture failed; captured classifier output follows:' >&2
      find "$test_root" -maxdepth 1 -type f -name '*.log' -print -exec sed -n '1,240p' {} \; >&2 || true
    fi
    rm -rf -- "$test_root"
    exit "$status"
  }
  trap pf4051_fixture_cleanup EXIT
  mkdir -p "$fixture_repo"

  git -C "$fixture_repo" init -q -b main
  git -C "$fixture_repo" config user.email validator@example.invalid
  git -C "$fixture_repo" config user.name 'PF-4051 admission fixture'
  printf '{"name":"fixture","version":"1.0.0"}\n' > "$fixture_repo/package.json"
  # Only the package-command boundary is mocked below. These tracked files let
  # the real admitted validation path check topology and preserved surfaces.
  while IFS= read -r path; do
    mkdir -p "$fixture_repo/$(dirname "$path")"
    printf '\n' > "$fixture_repo/$path"
  done <<'EOF'
packages/core/src/harness/v1/contracts.ts
packages/core/src/harness/v1/harness.ts
packages/core/src/harness/v1/index.ts
packages/core/src/harness/v1/session.ts
packages/core/src/agent-controller/agent-controller.ts
packages/core/src/agent-controller/index.ts
packages/server/src/server/handlers/harness.ts
packages/server/src/server/handlers/agent-controller.ts
packages/server/src/server/server-adapter/routes/harness.ts
packages/server/src/server/server-adapter/routes/agent-controller.ts
client-sdks/client-js/src/resources/harness.ts
client-sdks/client-js/src/resources/agent-controller.ts
docs/src/content/en/docs/harness/overview.mdx
packages/_types-builder/src/index.js
packages/_types-builder/src/replace-types.js
scripts/affected-tests.mjs
EOF
  git -C "$fixture_repo" add .
  git -C "$fixture_repo" commit -q -m common
  common_sha="$(git -C "$fixture_repo" rev-parse HEAD)"

  git -C "$fixture_repo" switch -q -c upstream
  printf '{"name":"fixture","version":"2.0.0"}\n' > "$fixture_repo/package.json"
  printf 'official upstream\n' > "$fixture_repo/upstream.txt"
  git -C "$fixture_repo" add package.json upstream.txt
  git -C "$fixture_repo" commit -q -m upstream
  upstream_parent="$(git -C "$fixture_repo" rev-parse HEAD)"

  git -C "$fixture_repo" switch -q main
  printf 'reviewed main\n' > "$fixture_repo/main.txt"
  git -C "$fixture_repo" add main.txt
  git -C "$fixture_repo" commit -q -m 'reviewed main'
  trusted_main="$(git -C "$fixture_repo" rev-parse HEAD)"
  git -C "$fixture_repo" switch -q -c extra-shared "$common_sha"
  printf 'extra shared ancestry\n' > "$fixture_repo/extra-shared.txt"
  git -C "$fixture_repo" add extra-shared.txt
  git -C "$fixture_repo" commit -q -m 'independent source ancestry'
  extra_shared_parent="$(git -C "$fixture_repo" rev-parse HEAD)"
  git -C "$fixture_repo" switch -q -c fork "$common_sha"
  git -C "$fixture_repo" merge -q --no-ff extra-shared -m 'source combines independent ancestry'
  printf 'fork work\n' > "$fixture_repo/fork.txt"
  git -C "$fixture_repo" add fork.txt
  git -C "$fixture_repo" commit -q -m fork
  git -C "$fixture_repo" merge -q --no-ff upstream -m 'reviewed upstream merge'
  fork_parent="$(git -C "$fixture_repo" rev-parse HEAD)"
  git -C "$fixture_repo" merge -q --no-ff "$trusted_main" -m 'reconcile landed main'
  reviewed_head="$(git -C "$fixture_repo" rev-parse HEAD)"
  reviewed_tree="$(git -C "$fixture_repo" rev-parse "$reviewed_head^{tree}")"

  git -C "$fixture_repo" switch -q -c protected-base "$trusted_main"
  mkdir -p "$fixture_repo/.github"
  printf 'trusted policy advance\n' > "$fixture_repo/.github/policy.txt"
  git -C "$fixture_repo" add .github/policy.txt
  git -C "$fixture_repo" commit -q -m 'advance protected policy'
  protected_base="$(git -C "$fixture_repo" rev-parse HEAD)"

  git -C "$fixture_repo" merge -q --no-ff "$extra_shared_parent" -m 'unapproved extra shared ancestry'
  unapproved_base="$(git -C "$fixture_repo" rev-parse HEAD)"

  git -C "$fixture_repo" switch -q --detach "$reviewed_head"
  printf 'not reviewed\n' > "$fixture_repo/forged.txt"
  git -C "$fixture_repo" add forged.txt
  forged_tree="$(git -C "$fixture_repo" write-tree)"
  git -C "$fixture_repo" reset -q --hard "$reviewed_head"
  forged_head="$(printf 'forged tree\n' | git -C "$fixture_repo" commit-tree \
    "$forged_tree" -p "$fork_parent" -p "$trusted_main")"
  reversed_head="$(printf 'reversed parents\n' | git -C "$fixture_repo" commit-tree \
    "$reviewed_tree" -p "$trusted_main" -p "$fork_parent")"
  extra_parent="$(printf 'extra parent\n' | git -C "$fixture_repo" commit-tree \
    "$common_sha^{tree}" -p "$common_sha")"
  octopus_head="$(printf 'octopus merge\n' | git -C "$fixture_repo" commit-tree \
    "$reviewed_tree" -p "$fork_parent" -p "$trusted_main" -p "$extra_parent")"
  non_merge_head="$(printf 'not a merge\n' | git -C "$fixture_repo" commit-tree \
    "$reviewed_tree" -p "$fork_parent")"

  run_fixture_admission() {
    local fixture_head="$1"
    local fixture_output="$2"
    shift 2
    (
      cd "$fixture_repo"
      env \
        GITHUB_OUTPUT= \
        BASE_SHA="$protected_base" HEAD_SHA="$fixture_head" PR_NUMBER=999 \
        HEAD_REPOSITORY=mbenhamd/mastra \
        HEAD_REF=feature/pf-4051-mastra-upstream-sync-2de367c9-r4 \
        BASE_REF=main \
        PAPERSFLOW_PF4051_MERGE_COMMIT="$reviewed_head" \
        PAPERSFLOW_PF4051_FORK_PARENT="$fork_parent" \
        PAPERSFLOW_PF4051_MAIN_PARENT="$trusted_main" \
        PAPERSFLOW_PF4051_UPSTREAM_PARENT="$upstream_parent" \
        PAPERSFLOW_PF4051_REVIEWED_TREE="$reviewed_tree" \
        PAPERSFLOW_PF4051_TRUSTED_MAIN="$trusted_main" \
        "$@" bash "$script_path" --classify-install
    ) > "$fixture_output" 2>&1
  }

  output="$test_root/pending-pins.log"
  if run_fixture_admission "$reviewed_head" "$output" \
    PAPERSFLOW_PF4051_MERGE_COMMIT=PENDING_PF4051_MERGE_COMMIT \
    PAPERSFLOW_PF4051_REVIEWED_TREE=PENDING_PF4051_REVIEWED_TREE; then
    echo 'PF-4051 pending admission pins unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'exact-sync admission pins are pending; refusing admission' "$output"

  output="$test_root/approved.log"
  run_fixture_admission "$reviewed_head" "$output"
  grep -Fxq 'lane=pf4051-upstream-sync' "$output"

  output="$test_root/forged-tree.log"
  if run_fixture_admission "$forged_head" "$output" \
    PAPERSFLOW_PF4051_MERGE_COMMIT="$forged_head"; then
    echo 'PF-4051 forged tree with the reviewed parents unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'head tree does not match the reviewed merge tree' "$output"

  output="$test_root/reversed-parents.log"
  if run_fixture_admission "$reversed_head" "$output" \
    PAPERSFLOW_PF4051_MERGE_COMMIT="$reversed_head"; then
    echo 'PF-4051 reversed parent order unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'not the exact reviewed two-parent reconciliation merge topology' "$output"

  output="$test_root/octopus.log"
  if run_fixture_admission "$octopus_head" "$output" \
    PAPERSFLOW_PF4051_MERGE_COMMIT="$octopus_head"; then
    echo 'PF-4051 octopus merge unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'not the exact reviewed two-parent reconciliation merge topology' "$output"

  output="$test_root/non-merge.log"
  if run_fixture_admission "$non_merge_head" "$output" \
    PAPERSFLOW_PF4051_MERGE_COMMIT="$non_merge_head"; then
    echo 'PF-4051 non-merge head unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'not the exact reviewed two-parent reconciliation merge topology' "$output"

  output="$test_root/wrong-head.log"
  if run_fixture_admission "$reviewed_head" "$output" \
    PAPERSFLOW_PF4051_MERGE_COMMIT="$fork_parent"; then
    echo 'PF-4051 head that differs from the reviewed commit unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'head is not the exact reviewed merge commit' "$output"

  output="$test_root/untrusted-base.log"
  if run_fixture_admission "$reviewed_head" "$output" BASE_SHA="$common_sha"; then
    echo 'PF-4051 base outside the reviewed fork lineage unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'lacks the reviewed trusted ancestry' "$output"

  output="$test_root/base-contained-in-head.log"
  if run_fixture_admission "$reviewed_head" "$output" BASE_SHA="$reviewed_head"; then
    echo 'PF-4051 base/head intersection beyond the reviewed fork parent unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'do not have the exact reviewed intersection' "$output"

  output="$test_root/unapproved-intersection.log"
  if run_fixture_admission "$reviewed_head" "$output" BASE_SHA="$unapproved_base"; then
    echo 'PF-4051 additional shared source history unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'do not have the exact reviewed intersection' "$output"

  output="$test_root/upstream-outside-source-parent.log"
  if run_fixture_admission "$reviewed_head" "$output" \
    PAPERSFLOW_PF4051_UPSTREAM_PARENT="$trusted_main"; then
    echo 'PF-4051 upstream provenance outside the reviewed source parent unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'source parent does not contain the reviewed official upstream parent' "$output"

  output="$test_root/wrong-metadata.log"
  if run_fixture_admission "$reviewed_head" "$output" HEAD_REF=feature/not-pf-4051; then
    echo 'Wrong PF-4051 branch metadata unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'do not match a reviewed upstream-sync lane' "$output"

  mock_bin="$test_root/bin"
  command_log="$test_root/validation-commands.log"
  mkdir -p "$mock_bin"
  cat > "$mock_bin/pnpm" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${MOCK_PF4051_COMMAND_LOG:?}"
if [[ "$*" == '--dir stores/pg '* &&
  ( "${POSTGRES_HOST:-}" != 127.0.0.1 || "${POSTGRES_PORT:-}" != 32791 ) ]]; then
  echo 'PF-4051 PostgreSQL selection ignored the explicit native fixture endpoint.' >&2
  exit 32
fi
if [[ "${MOCK_FAIL_PF4051_SELECTION:-0}" == 1 &&
  "$*" == '--dir mastracode/web install --frozen-lockfile --ignore-scripts' ]]; then
  exit 29
fi
SH
  chmod +x "$mock_bin/pnpm"
  git -C "$fixture_repo" switch -q --detach "$reviewed_head"
  run_fixture_validation() {
    (
      cd "$fixture_repo"
      env PATH="$mock_bin:$PATH" MOCK_PF4051_COMMAND_LOG="$command_log" \
        POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=32791 \
        BASE_SHA="$protected_base" HEAD_SHA="$reviewed_head" \
        HEAD_REPOSITORY=mbenhamd/mastra \
        HEAD_REF=feature/pf-4051-mastra-upstream-sync-2de367c9-r4 BASE_REF=main \
        PAPERSFLOW_PF4051_MERGE_COMMIT="$reviewed_head" \
        PAPERSFLOW_PF4051_FORK_PARENT="$fork_parent" \
        PAPERSFLOW_PF4051_MAIN_PARENT="$trusted_main" \
        PAPERSFLOW_PF4051_UPSTREAM_PARENT="$upstream_parent" \
        PAPERSFLOW_PF4051_REVIEWED_TREE="$reviewed_tree" \
        PAPERSFLOW_PF4051_TRUSTED_MAIN="$trusted_main" \
        "$@" bash "$script_path" --validate-pf4051-upstream-sync
    )
  }
  output="$test_root/validation-selection.log"
  run_fixture_validation > "$output" 2>&1
  grep -Fq -- "exec node $PACKED_DECLARATION_CHECK --package packages/agent-builder" "$command_log"
  grep -Fq -- '--fail-if-no-match check:fixtures' "$command_log"
  grep -Fq -- 'scripts/types-builder.test.ts' "$command_log"
  grep -Fq -- 'read/write pools' "$command_log"
  preservation_command="$(grep -F -- '--dir stores/pg exec vitest run --reporter=dot src/storage/index.pinned-init.test.ts' "$command_log")"
  [[ "$preservation_command" != *' -t '* ]]
  [[ "$preservation_command" == *'src/storage/domains/memory/clone-rollback.test.ts'* ]]
  grep -Fq -- 'src/agent/durable/step-start-chunk-shape.test.ts' "$command_log"
  grep -Fq -- 'src/agent/agent-processor.test.ts' "$command_log"
  grep -Fq -- 'src/processors/runner.test.ts' "$command_log"
  grep -Fq -- 'src/workflows/default.test.ts' "$command_log"
  grep -Fq -- 'src/loop/test-utils/aimock/scenarios/optional-agent-stages.scenario.test.ts' "$command_log"
  grep -Fq -- 'src/loop/test-utils/aimock/scenarios/optional-stages-approval.scenario.test.ts' "$command_log"
  grep -Fq -- 'src/loop/test-utils/aimock/scenarios/optional-stages-cancellation.scenario.test.ts' "$command_log"
  grep -Fq -- 'src/loop/test-utils/aimock/scenarios/optional-stages-mutable.scenario.test.ts' "$command_log"
  grep -Fxq -- '--dir server-adapters/hono exec vitest run --reporter=dot src/__tests__/hono-adapter.test.ts -t should strip mastra__resourceId|should strip reserved keys' "$command_log"
  grep -Fxq -- 'run test:mastracode' "$command_log"
  grep -Fxq -- '--dir pubsub/redis-streams exec vitest run --reporter=dot src/connection-and-cleanup.test.ts src/pubsub-ack-audit.test.ts' "$command_log"
  grep -Fq -- 'src/auth-seam.test.ts' "$command_log"
  grep -Fq -- 'src/session/org-seed-fail-open.test.ts src/session/memory-settings-hydration.test.ts' "$command_log"
  grep -Fq -- 'src/server/handlers/a2a-memory.test.ts' "$command_log"
  grep -Fq -- 'TranscriptSender.msw.test.tsx' "$command_log"
  grep -Fq -- 'experiment-item-route.msw.test.tsx' "$command_log"
  grep -Fq -- 'src/domains/traces/components/__tests__/no-traces-info.test.tsx' "$command_log"
  grep -Fq -- 'src/pages/agent-builder/__tests__/empty-collections.test.tsx' "$command_log"
  grep -Fq -- 'src/domains/experiments/components/__tests__/rerun-experiment-button.msw.test.tsx' "$command_log"
  grep -Fq -- 'src/pages/experiments/__tests__/experiments-compare.msw.test.tsx' "$command_log"
  grep -Fq -- 'src/pages/experiments/__tests__/experiments-run.msw.test.tsx' "$command_log"
  web_install_line="$(grep -nFx -- '--dir mastracode/web install --frozen-lockfile --ignore-scripts' "$command_log" | cut -d: -f1)"
  web_check_line="$(grep -nFx -- '--dir mastracode/web check' "$command_log" | cut -d: -f1)"
  web_test_line="$(grep -nFx -- '--dir mastracode/web exec vitest run --reporter=dot src/mastra/index.test.ts' "$command_log" | cut -d: -f1)"
  (( web_install_line < web_check_line && web_install_line < web_test_line ))
  output="$test_root/validation-failure.log"
  : > "$command_log"
  if run_fixture_validation MOCK_FAIL_PF4051_SELECTION=1 > "$output" 2>&1; then
    echo 'PF-4051 standalone Web install failure was swallowed.' >&2
    return 1
  else
    [[ "$?" == 29 ]]
  fi
  if grep -Eq -- '^--dir mastracode/web (check|exec vitest run)' "$command_log"; then
    echo 'PF-4051 ran Web validation after its standalone install failed.' >&2
    return 1
  fi
  if grep -Fq 'workspace build/lint and selected reconciliation validation passed' "$output"; then
    echo 'PF-4051 reported completed validation after a selected suite failed.' >&2
    return 1
  fi
  echo 'PF-4051 native and incoming test selection with failure propagation fixtures passed.'
  echo 'PF-4051 pending-pin, exact-commit, topology, tree, ancestry, and metadata admission fixtures passed.'
)

run_pf3375_admission_self_tests() (
  local script_path test_root fixture_repo common_sha fork_parent upstream_parent
  local reviewed_head reviewed_tree protected_base forged_tree forged_head
  local reversed_head extra_parent octopus_head non_merge_head output

  script_path="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
  test_root="$(mktemp -d)"
  fixture_repo="$test_root/repo"
  pf3375_fixture_cleanup() {
    local status=$?
    trap - EXIT
    if (( status != 0 )); then
      echo 'PF-3375 admission fixture failed; captured classifier output follows:' >&2
      find "$test_root" -maxdepth 1 -type f -name '*.log' -print -exec sed -n '1,240p' {} \; >&2 || true
    fi
    rm -rf -- "$test_root"
    exit "$status"
  }
  trap pf3375_fixture_cleanup EXIT
  mkdir -p "$fixture_repo"

  git -C "$fixture_repo" init -q -b main
  git -C "$fixture_repo" config user.email validator@example.invalid
  git -C "$fixture_repo" config user.name 'PF-3375 admission fixture'
  printf '{"name":"fixture","version":"1.0.0"}\n' > "$fixture_repo/package.json"
  git -C "$fixture_repo" add package.json
  git -C "$fixture_repo" commit -q -m common
  common_sha="$(git -C "$fixture_repo" rev-parse HEAD)"

  git -C "$fixture_repo" switch -q -c upstream
  printf '{"name":"fixture","version":"2.0.0"}\n' > "$fixture_repo/package.json"
  printf 'official upstream\n' > "$fixture_repo/upstream.txt"
  git -C "$fixture_repo" add package.json upstream.txt
  git -C "$fixture_repo" commit -q -m upstream
  upstream_parent="$(git -C "$fixture_repo" rev-parse HEAD)"

  git -C "$fixture_repo" switch -q main
  printf 'fork work\n' > "$fixture_repo/fork.txt"
  git -C "$fixture_repo" add fork.txt
  git -C "$fixture_repo" commit -q -m fork
  fork_parent="$(git -C "$fixture_repo" rev-parse HEAD)"
  git -C "$fixture_repo" merge -q --no-ff upstream -m 'reviewed upstream merge'
  reviewed_head="$(git -C "$fixture_repo" rev-parse HEAD)"
  reviewed_tree="$(git -C "$fixture_repo" rev-parse "$reviewed_head^{tree}")"

  git -C "$fixture_repo" switch -q -c protected-base "$fork_parent"
  mkdir -p "$fixture_repo/.github"
  printf 'trusted policy advance\n' > "$fixture_repo/.github/policy.txt"
  git -C "$fixture_repo" add .github/policy.txt
  git -C "$fixture_repo" commit -q -m 'advance protected policy'
  protected_base="$(git -C "$fixture_repo" rev-parse HEAD)"

  git -C "$fixture_repo" switch -q --detach "$reviewed_head"
  printf 'not reviewed\n' > "$fixture_repo/forged.txt"
  git -C "$fixture_repo" add forged.txt
  forged_tree="$(git -C "$fixture_repo" write-tree)"
  git -C "$fixture_repo" reset -q --hard "$reviewed_head"
  forged_head="$(printf 'forged tree\n' | git -C "$fixture_repo" commit-tree \
    "$forged_tree" -p "$fork_parent" -p "$upstream_parent")"
  reversed_head="$(printf 'reversed parents\n' | git -C "$fixture_repo" commit-tree \
    "$reviewed_tree" -p "$upstream_parent" -p "$fork_parent")"
  extra_parent="$(printf 'extra parent\n' | git -C "$fixture_repo" commit-tree \
    "$common_sha^{tree}" -p "$common_sha")"
  octopus_head="$(printf 'octopus merge\n' | git -C "$fixture_repo" commit-tree \
    "$reviewed_tree" -p "$fork_parent" -p "$upstream_parent" -p "$extra_parent")"
  non_merge_head="$(printf 'not a merge\n' | git -C "$fixture_repo" commit-tree \
    "$reviewed_tree" -p "$fork_parent")"

  run_fixture_admission() {
    local fixture_head="$1"
    local fixture_output="$2"
    shift 2
    (
      cd "$fixture_repo"
      env \
        GITHUB_OUTPUT= \
        BASE_SHA="$protected_base" HEAD_SHA="$fixture_head" PR_NUMBER=999 \
        HEAD_REPOSITORY=mbenhamd/mastra \
        HEAD_REF=feature/pf-3375-mastra-upstream-sync-372b1a71 \
        BASE_REF=main \
        PAPERSFLOW_PF3375_MERGE_COMMIT="$reviewed_head" \
        PAPERSFLOW_PF3375_FORK_PARENT="$fork_parent" \
        PAPERSFLOW_PF3375_UPSTREAM_PARENT="$upstream_parent" \
        PAPERSFLOW_PF3375_REVIEWED_TREE="$reviewed_tree" \
        "$@" bash "$script_path" --classify-install
    ) > "$fixture_output" 2>&1
  }

  output="$test_root/approved.log"
  run_fixture_admission "$reviewed_head" "$output"
  grep -Fxq 'lane=pf3375-upstream-sync' "$output"

  output="$test_root/forged-tree.log"
  if run_fixture_admission "$forged_head" "$output" \
    PAPERSFLOW_PF3375_MERGE_COMMIT="$forged_head"; then
    echo 'PF-3375 forged tree with the reviewed parents unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'head tree does not match the reviewed merge tree' "$output"

  output="$test_root/reversed-parents.log"
  if run_fixture_admission "$reversed_head" "$output" \
    PAPERSFLOW_PF3375_MERGE_COMMIT="$reversed_head"; then
    echo 'PF-3375 reversed parent order unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'not the exact reviewed two-parent upstream merge topology' "$output"

  output="$test_root/octopus.log"
  if run_fixture_admission "$octopus_head" "$output" \
    PAPERSFLOW_PF3375_MERGE_COMMIT="$octopus_head"; then
    echo 'PF-3375 octopus merge unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'not the exact reviewed two-parent upstream merge topology' "$output"

  output="$test_root/non-merge.log"
  if run_fixture_admission "$non_merge_head" "$output" \
    PAPERSFLOW_PF3375_MERGE_COMMIT="$non_merge_head"; then
    echo 'PF-3375 non-merge head unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'not the exact reviewed two-parent upstream merge topology' "$output"

  output="$test_root/wrong-head.log"
  if run_fixture_admission "$reviewed_head" "$output" \
    PAPERSFLOW_PF3375_MERGE_COMMIT="$fork_parent"; then
    echo 'PF-3375 head that differs from the reviewed commit unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'head is not the exact reviewed merge commit' "$output"

  output="$test_root/untrusted-base.log"
  if run_fixture_admission "$reviewed_head" "$output" BASE_SHA="$common_sha"; then
    echo 'PF-3375 base outside the reviewed fork lineage unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'protected base does not descend from the reviewed fork parent' "$output"

  output="$test_root/base-contained-in-head.log"
  if run_fixture_admission "$reviewed_head" "$output" BASE_SHA="$reviewed_head"; then
    echo 'PF-3375 base/head intersection beyond the reviewed fork parent unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'no longer meet at the reviewed fork parent' "$output"

  output="$test_root/wrong-metadata.log"
  if run_fixture_admission "$reviewed_head" "$output" HEAD_REF=feature/not-pf-3375; then
    echo 'Wrong PF-3375 branch metadata unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'do not match a reviewed upstream-sync lane' "$output"

  echo 'PF-3375 exact-commit, topology, tree, ancestry, and metadata admission fixtures passed.'
)

run_pf4163_admission_self_tests() (
  local script_path test_root fixture_repo common_sha fork_parent upstream_parent
  local source_merge source_tree correction_head correction_tree
  local protected_base extra_intersection_base
  local forged_correction_tree forged_correction_head
  local unreviewed_descendant_tree unreviewed_descendant_head
  local wrong_parent_head extra_parent_head
  local reversed_source_merge reversed_source_correction
  local extra_source_parent octopus_source_merge octopus_source_correction
  local non_merge_source_merge non_merge_source_correction
  local altered_source_tree altered_source_merge altered_source_correction altered_correction_tree
  local wrong_graph_tree wrong_graph_correction_head nested_graph_tree nested_graph_correction_head
  local output path

  script_path="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
  test_root="$(mktemp -d)"
  fixture_repo="$test_root/repo"
  pf4163_fixture_cleanup() {
    local status=$?
    trap - EXIT
    if (( status != 0 )); then
      echo 'PF-4163 admission fixture failed; captured classifier output follows:' >&2
      find "$test_root" -maxdepth 1 -type f -name '*.log' -print -exec sed -n '1,240p' {} \; >&2 || true
    fi
    rm -rf -- "$test_root"
    exit "$status"
  }
  trap pf4163_fixture_cleanup EXIT
  mkdir -p "$fixture_repo"

  git -C "$fixture_repo" init -q -b main
  git -C "$fixture_repo" config user.email validator@example.invalid
  git -C "$fixture_repo" config user.name 'PF-4163 admission fixture'
  printf '{"name":"fixture","version":"1.0.0"}\n' > "$fixture_repo/package.json"
  while IFS= read -r path; do
    mkdir -p "$fixture_repo/$(dirname "$path")"
    printf 'fork dependency graph\n' > "$fixture_repo/$path"
  done < <(pf4163_install_allowlist)
  git -C "$fixture_repo" add .
  git -C "$fixture_repo" commit -q -m common
  common_sha="$(git -C "$fixture_repo" rev-parse HEAD)"

  git -C "$fixture_repo" switch -q -c upstream
  while IFS= read -r path; do
    printf 'reviewed upstream dependency graph\n' > "$fixture_repo/$path"
  done < <(pf4163_install_allowlist)
  printf 'official upstream\n' > "$fixture_repo/upstream.txt"
  git -C "$fixture_repo" add .
  git -C "$fixture_repo" commit -q -m upstream
  upstream_parent="$(git -C "$fixture_repo" rev-parse HEAD)"

  git -C "$fixture_repo" switch -q main
  printf 'fork work\n' > "$fixture_repo/fork.txt"
  git -C "$fixture_repo" add fork.txt
  git -C "$fixture_repo" commit -q -m fork
  fork_parent="$(git -C "$fixture_repo" rev-parse HEAD)"
  git -C "$fixture_repo" merge -q --no-ff upstream -m 'reviewed upstream merge'
  source_merge="$(git -C "$fixture_repo" rev-parse HEAD)"
  source_tree="$(git -C "$fixture_repo" rev-parse "$source_merge^{tree}")"

  git -C "$fixture_repo" switch -q -c protected-base "$fork_parent"
  mkdir -p "$fixture_repo/.github"
  printf 'trusted policy advance\n' > "$fixture_repo/.github/policy.txt"
  git -C "$fixture_repo" add .github/policy.txt
  git -C "$fixture_repo" commit -q -m 'advance protected policy'
  protected_base="$(git -C "$fixture_repo" rev-parse HEAD)"
  extra_intersection_base="$(printf 'extra merge base\n' | git -C "$fixture_repo" commit-tree \
    "$source_tree" -p "$protected_base" -p "$upstream_parent")"

  git -C "$fixture_repo" switch -q --detach "$source_merge"
  printf 'reviewed correction\n' > "$fixture_repo/correction.txt"
  git -C "$fixture_repo" add correction.txt
  correction_tree="$(git -C "$fixture_repo" write-tree)"
  git -C "$fixture_repo" reset -q --hard "$source_merge"
  correction_head="$(printf 'reviewed correction\n' | git -C "$fixture_repo" commit-tree \
    "$correction_tree" -p "$source_merge")"

  printf 'not reviewed\n' > "$fixture_repo/forged.txt"
  git -C "$fixture_repo" add forged.txt
  forged_correction_tree="$(git -C "$fixture_repo" write-tree)"
  git -C "$fixture_repo" reset -q --hard "$source_merge"
  forged_correction_head="$(printf 'forged correction tree\n' | git -C "$fixture_repo" commit-tree \
    "$forged_correction_tree" -p "$source_merge")"

  git -C "$fixture_repo" switch -q --detach "$correction_head"
  printf 'unreviewed descendant\n' > "$fixture_repo/unreviewed.txt"
  git -C "$fixture_repo" add unreviewed.txt
  unreviewed_descendant_tree="$(git -C "$fixture_repo" write-tree)"
  git -C "$fixture_repo" reset -q --hard "$correction_head"
  unreviewed_descendant_head="$(printf 'unreviewed descendant\n' | git -C "$fixture_repo" commit-tree \
    "$unreviewed_descendant_tree" -p "$correction_head")"

  wrong_parent_head="$(printf 'wrong correction parent\n' | git -C "$fixture_repo" commit-tree \
    "$correction_tree" -p "$upstream_parent")"
  extra_parent_head="$(printf 'extra correction parent\n' | git -C "$fixture_repo" commit-tree \
    "$correction_tree" -p "$source_merge" -p "$common_sha")"

  reversed_source_merge="$(printf 'reversed source parents\n' | git -C "$fixture_repo" commit-tree \
    "$source_tree" -p "$upstream_parent" -p "$fork_parent")"
  reversed_source_correction="$(printf 'correction atop reversed source\n' | git -C "$fixture_repo" commit-tree \
    "$correction_tree" -p "$reversed_source_merge")"
  extra_source_parent="$(printf 'extra source parent\n' | git -C "$fixture_repo" commit-tree \
    "$common_sha^{tree}" -p "$common_sha")"
  octopus_source_merge="$(printf 'octopus source merge\n' | git -C "$fixture_repo" commit-tree \
    "$source_tree" -p "$fork_parent" -p "$upstream_parent" -p "$extra_source_parent")"
  octopus_source_correction="$(printf 'correction atop octopus source\n' | git -C "$fixture_repo" commit-tree \
    "$correction_tree" -p "$octopus_source_merge")"
  non_merge_source_merge="$(printf 'non-merge source\n' | git -C "$fixture_repo" commit-tree \
    "$source_tree" -p "$fork_parent")"
  non_merge_source_correction="$(printf 'correction atop non-merge source\n' | git -C "$fixture_repo" commit-tree \
    "$correction_tree" -p "$non_merge_source_merge")"

  printf 'altered source merge\n' > "$fixture_repo/altered-source.txt"
  git -C "$fixture_repo" add altered-source.txt
  altered_source_tree="$(git -C "$fixture_repo" write-tree)"
  git -C "$fixture_repo" reset -q --hard "$source_merge"
  altered_source_merge="$(printf 'altered source merge tree\n' | git -C "$fixture_repo" commit-tree \
    "$altered_source_tree" -p "$fork_parent" -p "$upstream_parent")"
  git -C "$fixture_repo" switch -q --detach "$altered_source_merge"
  printf 'altered correction\n' > "$fixture_repo/altered-correction.txt"
  git -C "$fixture_repo" add altered-correction.txt
  altered_correction_tree="$(git -C "$fixture_repo" write-tree)"
  git -C "$fixture_repo" reset -q --hard "$altered_source_merge"
  altered_source_correction="$(printf 'correction atop altered source\n' | git -C "$fixture_repo" commit-tree \
    "$altered_correction_tree" -p "$altered_source_merge")"

  git -C "$fixture_repo" switch -q --detach "$source_merge"
  printf '{"name":"unreviewed-fixture"}\n' > "$fixture_repo/package.json"
  git -C "$fixture_repo" add package.json
  wrong_graph_tree="$(git -C "$fixture_repo" write-tree)"
  git -C "$fixture_repo" reset -q --hard "$source_merge"
  wrong_graph_correction_head="$(printf 'unreviewed dependency graph\n' | git -C "$fixture_repo" commit-tree \
    "$wrong_graph_tree" -p "$source_merge")"
  mkdir -p "$fixture_repo/packages/unlisted"
  printf '{"name":"unlisted-fixture"}\n' > "$fixture_repo/packages/unlisted/package.json"
  git -C "$fixture_repo" add packages/unlisted/package.json
  nested_graph_tree="$(git -C "$fixture_repo" write-tree)"
  git -C "$fixture_repo" reset -q --hard "$source_merge"
  nested_graph_correction_head="$(printf 'unlisted nested dependency graph\n' | git -C "$fixture_repo" commit-tree \
    "$nested_graph_tree" -p "$source_merge")"

  run_fixture_admission() {
    local fixture_head="$1"
    local fixture_output="$2"
    shift 2
    (
      cd "$fixture_repo"
      env \
        GITHUB_OUTPUT= \
        BASE_SHA="$protected_base" HEAD_SHA="$fixture_head" PR_NUMBER=999 \
        HEAD_REPOSITORY=mbenhamd/mastra \
        HEAD_REF=feature/pf-4163-mastra-upstream-sync-23c232d7 \
        BASE_REF=main \
        PAPERSFLOW_PF4163_MERGE_COMMIT="$source_merge" \
        PAPERSFLOW_PF4163_FORK_PARENT="$fork_parent" \
        PAPERSFLOW_PF4163_UPSTREAM_PARENT="$upstream_parent" \
        PAPERSFLOW_PF4163_REVIEWED_TREE="$source_tree" \
        PAPERSFLOW_PF4163_CORRECTION_HEAD="$correction_head" \
        PAPERSFLOW_PF4163_CORRECTION_TREE="$correction_tree" \
        "$@" bash "$script_path" --classify-install
    ) > "$fixture_output" 2>&1
  }

  output="$test_root/approved.log"
  run_fixture_admission "$correction_head" "$output"
  grep -Fxq 'lane=pf4163-upstream-sync' "$output"

  output="$test_root/pending-merge-pin.log"
  if run_fixture_admission "$correction_head" "$output" \
    PAPERSFLOW_PF4163_MERGE_COMMIT=PENDING_PF4163_MERGE_COMMIT; then
    echo 'PF-4163 pending merge pin unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'exact-sync admission pins are pending' "$output"

  output="$test_root/pending-fork-parent.log"
  if run_fixture_admission "$correction_head" "$output" \
    PAPERSFLOW_PF4163_FORK_PARENT=PENDING_PF4163_FORK_PARENT; then
    echo 'PF-4163 pending fork-parent pin unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'exact-sync admission pins are pending' "$output"

  output="$test_root/pending-reviewed-tree.log"
  if run_fixture_admission "$correction_head" "$output" \
    PAPERSFLOW_PF4163_REVIEWED_TREE=PENDING_PF4163_REVIEWED_TREE; then
    echo 'PF-4163 pending reviewed-tree pin unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'exact-sync admission pins are pending' "$output"

  output="$test_root/pending-correction-head.log"
  if run_fixture_admission "$correction_head" "$output" \
    PAPERSFLOW_PF4163_CORRECTION_HEAD=PENDING_PF4163_CORRECTION_HEAD; then
    echo 'PF-4163 pending correction-head pin unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'exact-sync admission pins are pending' "$output"

  output="$test_root/pending-correction-tree.log"
  if run_fixture_admission "$correction_head" "$output" \
    PAPERSFLOW_PF4163_CORRECTION_TREE=PENDING_PF4163_CORRECTION_TREE; then
    echo 'PF-4163 pending correction-tree pin unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'exact-sync admission pins are pending' "$output"

  output="$test_root/wrong-sha.log"
  if run_fixture_admission "$correction_head" "$output" \
    PAPERSFLOW_PF4163_CORRECTION_HEAD="$source_merge"; then
    echo 'PF-4163 head with a wrong reviewed correction SHA unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'head is not the exact reviewed correction commit' "$output"

  output="$test_root/unreviewed-descendant.log"
  if run_fixture_admission "$unreviewed_descendant_head" "$output"; then
    echo 'PF-4163 unreviewed correction descendant unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'head is not the exact reviewed correction commit' "$output"

  output="$test_root/forged-correction-tree.log"
  if run_fixture_admission "$forged_correction_head" "$output" \
    PAPERSFLOW_PF4163_CORRECTION_HEAD="$forged_correction_head"; then
    echo 'PF-4163 forged correction tree unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'correction head tree does not match the reviewed correction tree' "$output"

  output="$test_root/wrong-correction-parent.log"
  if run_fixture_admission "$wrong_parent_head" "$output" \
    PAPERSFLOW_PF4163_CORRECTION_HEAD="$wrong_parent_head"; then
    echo 'PF-4163 correction with a wrong parent unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'single-parent correction atop the source merge' "$output"

  output="$test_root/extra-correction-parent.log"
  if run_fixture_admission "$extra_parent_head" "$output" \
    PAPERSFLOW_PF4163_CORRECTION_HEAD="$extra_parent_head"; then
    echo 'PF-4163 correction with an extra parent unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'single-parent correction atop the source merge' "$output"

  output="$test_root/reversed-source-parents.log"
  if run_fixture_admission "$reversed_source_correction" "$output" \
    PAPERSFLOW_PF4163_MERGE_COMMIT="$reversed_source_merge" \
    PAPERSFLOW_PF4163_CORRECTION_HEAD="$reversed_source_correction"; then
    echo 'PF-4163 reversed source parent order unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'source merge is not the exact reviewed two-parent upstream merge topology' "$output"

  output="$test_root/octopus-source.log"
  if run_fixture_admission "$octopus_source_correction" "$output" \
    PAPERSFLOW_PF4163_MERGE_COMMIT="$octopus_source_merge" \
    PAPERSFLOW_PF4163_CORRECTION_HEAD="$octopus_source_correction"; then
    echo 'PF-4163 octopus source merge unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'source merge is not the exact reviewed two-parent upstream merge topology' "$output"

  output="$test_root/non-merge-source.log"
  if run_fixture_admission "$non_merge_source_correction" "$output" \
    PAPERSFLOW_PF4163_MERGE_COMMIT="$non_merge_source_merge" \
    PAPERSFLOW_PF4163_CORRECTION_HEAD="$non_merge_source_correction"; then
    echo 'PF-4163 non-merge source unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'source merge is not the exact reviewed two-parent upstream merge topology' "$output"

  output="$test_root/altered-source-merge.log"
  if run_fixture_admission "$altered_source_correction" "$output" \
    PAPERSFLOW_PF4163_MERGE_COMMIT="$altered_source_merge" \
    PAPERSFLOW_PF4163_CORRECTION_HEAD="$altered_source_correction" \
    PAPERSFLOW_PF4163_CORRECTION_TREE="$altered_correction_tree"; then
    echo 'PF-4163 altered source merge unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'source merge tree does not match the reviewed source merge tree' "$output"

  output="$test_root/untrusted-base.log"
  if run_fixture_admission "$correction_head" "$output" BASE_SHA="$common_sha"; then
    echo 'PF-4163 base outside the reviewed fork lineage unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'protected base does not descend from the reviewed fork parent' "$output"

  output="$test_root/base-contained-in-correction.log"
  if run_fixture_admission "$correction_head" "$output" BASE_SHA="$correction_head"; then
    echo 'PF-4163 base containing the reviewed correction unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'no longer meet at the reviewed fork parent' "$output"

  output="$test_root/extra-best-merge-base.log"
  if run_fixture_admission "$correction_head" "$output" BASE_SHA="$extra_intersection_base"; then
    echo 'PF-4163 extra best protected-base intersection unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'no longer meet at the reviewed fork parent' "$output"

  output="$test_root/unapproved-install-path.log"
  if run_fixture_admission "$wrong_graph_correction_head" "$output" \
    PAPERSFLOW_PF4163_CORRECTION_HEAD="$wrong_graph_correction_head" \
    PAPERSFLOW_PF4163_CORRECTION_TREE="$wrong_graph_tree"; then
    echo 'PF-4163 unapproved dependency-graph path unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'outside the frozen install allowlist' "$output"

  output="$test_root/unapproved-nested-install-path.log"
  if run_fixture_admission "$nested_graph_correction_head" "$output" \
    PAPERSFLOW_PF4163_CORRECTION_HEAD="$nested_graph_correction_head" \
    PAPERSFLOW_PF4163_CORRECTION_TREE="$nested_graph_tree"; then
    echo 'PF-4163 unapproved nested dependency-graph path unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'outside the frozen install allowlist' "$output"

  echo 'PF-4163 pending-pin, exact-correction, source topology/tree, ancestry, and frozen-install admission fixtures passed.'
)

run_pf3020_admission_self_tests() (
  local script_path test_root fixture_repo common_sha fork_parent upstream_parent
  local reviewed_head reviewed_tree protected_base forged_tree forged_head
  local reversed_head extra_parent octopus_head non_merge_head output

  script_path="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
  test_root="$(mktemp -d)"
  fixture_repo="$test_root/repo"
  pf3020_fixture_cleanup() {
    local status=$?
    trap - EXIT
    if (( status != 0 )); then
      echo 'PF-3020 admission fixture failed; captured classifier output follows:' >&2
      find "$test_root" -maxdepth 1 -type f -name '*.log' -print -exec sed -n '1,240p' {} \; >&2 || true
    fi
    rm -rf -- "$test_root"
    exit "$status"
  }
  trap pf3020_fixture_cleanup EXIT
  mkdir -p "$fixture_repo"

  git -C "$fixture_repo" init -q -b main
  git -C "$fixture_repo" config user.email validator@example.invalid
  git -C "$fixture_repo" config user.name 'PF-3020 admission fixture'
  printf '{"name":"fixture","version":"1.0.0"}\n' > "$fixture_repo/package.json"
  git -C "$fixture_repo" add package.json
  git -C "$fixture_repo" commit -q -m common
  common_sha="$(git -C "$fixture_repo" rev-parse HEAD)"

  git -C "$fixture_repo" switch -q -c upstream
  printf '{"name":"fixture","version":"2.0.0"}\n' > "$fixture_repo/package.json"
  printf 'official upstream\n' > "$fixture_repo/upstream.txt"
  git -C "$fixture_repo" add package.json upstream.txt
  git -C "$fixture_repo" commit -q -m upstream
  upstream_parent="$(git -C "$fixture_repo" rev-parse HEAD)"

  git -C "$fixture_repo" switch -q main
  printf 'fork work\n' > "$fixture_repo/fork.txt"
  git -C "$fixture_repo" add fork.txt
  git -C "$fixture_repo" commit -q -m fork
  fork_parent="$(git -C "$fixture_repo" rev-parse HEAD)"
  git -C "$fixture_repo" merge -q --no-ff upstream -m 'reviewed upstream merge'
  reviewed_head="$(git -C "$fixture_repo" rev-parse HEAD)"
  reviewed_tree="$(git -C "$fixture_repo" rev-parse "$reviewed_head^{tree}")"

  git -C "$fixture_repo" switch -q -c protected-base "$fork_parent"
  mkdir -p "$fixture_repo/.github"
  printf 'trusted policy advance\n' > "$fixture_repo/.github/policy.txt"
  git -C "$fixture_repo" add .github/policy.txt
  git -C "$fixture_repo" commit -q -m 'advance protected policy'
  protected_base="$(git -C "$fixture_repo" rev-parse HEAD)"

  git -C "$fixture_repo" switch -q --detach "$reviewed_head"
  printf 'not reviewed\n' > "$fixture_repo/forged.txt"
  git -C "$fixture_repo" add forged.txt
  forged_tree="$(git -C "$fixture_repo" write-tree)"
  git -C "$fixture_repo" reset -q --hard "$reviewed_head"
  forged_head="$(printf 'forged tree\n' | git -C "$fixture_repo" commit-tree \
    "$forged_tree" -p "$fork_parent" -p "$upstream_parent")"
  reversed_head="$(printf 'reversed parents\n' | git -C "$fixture_repo" commit-tree \
    "$reviewed_tree" -p "$upstream_parent" -p "$fork_parent")"
  extra_parent="$(printf 'extra parent\n' | git -C "$fixture_repo" commit-tree \
    "$common_sha^{tree}" -p "$common_sha")"
  octopus_head="$(printf 'octopus merge\n' | git -C "$fixture_repo" commit-tree \
    "$reviewed_tree" -p "$fork_parent" -p "$upstream_parent" -p "$extra_parent")"
  non_merge_head="$(printf 'not a merge\n' | git -C "$fixture_repo" commit-tree \
    "$reviewed_tree" -p "$fork_parent")"

  run_fixture_admission() {
    local fixture_head="$1"
    local fixture_output="$2"
    shift 2
    (
      cd "$fixture_repo"
      env \
        GITHUB_OUTPUT= \
        BASE_SHA="$protected_base" HEAD_SHA="$fixture_head" PR_NUMBER=999 \
        HEAD_REPOSITORY=mbenhamd/mastra \
        HEAD_REF=feature/pf-3020-mastra-upstream-sync-b8ce7ec9 \
        BASE_REF=main \
        PAPERSFLOW_PF3020_MERGE_COMMIT="$reviewed_head" \
        PAPERSFLOW_PF3020_FORK_PARENT="$fork_parent" \
        PAPERSFLOW_PF3020_UPSTREAM_PARENT="$upstream_parent" \
        PAPERSFLOW_PF3020_REVIEWED_TREE="$reviewed_tree" \
        "$@" bash "$script_path" --classify-install
    ) > "$fixture_output" 2>&1
  }

  output="$test_root/approved.log"
  run_fixture_admission "$reviewed_head" "$output"
  grep -Fxq 'lane=pf3020-upstream-sync' "$output"

  output="$test_root/forged-tree.log"
  if run_fixture_admission "$forged_head" "$output" \
    PAPERSFLOW_PF3020_MERGE_COMMIT="$forged_head"; then
    echo 'PF-3020 forged tree with the reviewed parents unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'head tree does not match the reviewed merge tree' "$output"

  output="$test_root/reversed-parents.log"
  if run_fixture_admission "$reversed_head" "$output" \
    PAPERSFLOW_PF3020_MERGE_COMMIT="$reversed_head"; then
    echo 'PF-3020 reversed parent order unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'not the exact reviewed two-parent upstream merge topology' "$output"

  output="$test_root/octopus.log"
  if run_fixture_admission "$octopus_head" "$output" \
    PAPERSFLOW_PF3020_MERGE_COMMIT="$octopus_head"; then
    echo 'PF-3020 octopus merge unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'not the exact reviewed two-parent upstream merge topology' "$output"

  output="$test_root/non-merge.log"
  if run_fixture_admission "$non_merge_head" "$output" \
    PAPERSFLOW_PF3020_MERGE_COMMIT="$non_merge_head"; then
    echo 'PF-3020 non-merge head unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'not the exact reviewed two-parent upstream merge topology' "$output"

  output="$test_root/wrong-head.log"
  if run_fixture_admission "$reviewed_head" "$output" \
    PAPERSFLOW_PF3020_MERGE_COMMIT="$fork_parent"; then
    echo 'PF-3020 head that differs from the reviewed commit unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'head is not the exact reviewed merge commit' "$output"

  output="$test_root/untrusted-base.log"
  if run_fixture_admission "$reviewed_head" "$output" BASE_SHA="$common_sha"; then
    echo 'PF-3020 base outside the reviewed fork lineage unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'protected base does not descend from the reviewed fork parent' "$output"

  output="$test_root/base-contained-in-head.log"
  if run_fixture_admission "$reviewed_head" "$output" BASE_SHA="$reviewed_head"; then
    echo 'PF-3020 base/head intersection beyond the reviewed fork parent unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'no longer meet at the reviewed fork parent' "$output"

  output="$test_root/wrong-metadata.log"
  if run_fixture_admission "$reviewed_head" "$output" HEAD_REF=feature/not-pf-3020; then
    echo 'Wrong PF-3020 branch metadata unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'do not match a reviewed upstream-sync lane' "$output"

  echo 'PF-3020 exact-commit, topology, tree, ancestry, and metadata admission fixtures passed.'
)

run_pf2576_admission_self_tests() (
  local script_path test_root fixture_repo common_sha fork_parent upstream_parent
  local reviewed_head reviewed_tree protected_base forged_tree forged_head
  local reversed_head extra_parent octopus_head non_merge_head output

  script_path="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
  test_root="$(mktemp -d)"
  fixture_repo="$test_root/repo"
  pf2576_fixture_cleanup() {
    local status=$?
    trap - EXIT
    if (( status != 0 )); then
      echo 'PF-2576 admission fixture failed; captured classifier output follows:' >&2
      find "$test_root" -maxdepth 1 -type f -name '*.log' -print -exec sed -n '1,240p' {} \; >&2 || true
    fi
    rm -rf -- "$test_root"
    exit "$status"
  }
  trap pf2576_fixture_cleanup EXIT
  mkdir -p "$fixture_repo"

  git -C "$fixture_repo" init -q -b main
  git -C "$fixture_repo" config user.email validator@example.invalid
  git -C "$fixture_repo" config user.name 'PF-2576 admission fixture'
  printf '{"name":"fixture","version":"1.0.0"}\n' > "$fixture_repo/package.json"
  git -C "$fixture_repo" add package.json
  git -C "$fixture_repo" commit -q -m common
  common_sha="$(git -C "$fixture_repo" rev-parse HEAD)"

  git -C "$fixture_repo" switch -q -c upstream
  printf '{"name":"fixture","version":"2.0.0"}\n' > "$fixture_repo/package.json"
  printf 'official upstream\n' > "$fixture_repo/upstream.txt"
  git -C "$fixture_repo" add package.json upstream.txt
  git -C "$fixture_repo" commit -q -m upstream
  upstream_parent="$(git -C "$fixture_repo" rev-parse HEAD)"

  git -C "$fixture_repo" switch -q main
  printf 'fork work\n' > "$fixture_repo/fork.txt"
  git -C "$fixture_repo" add fork.txt
  git -C "$fixture_repo" commit -q -m fork
  fork_parent="$(git -C "$fixture_repo" rev-parse HEAD)"
  git -C "$fixture_repo" merge -q --no-ff upstream -m 'reviewed upstream merge'
  reviewed_head="$(git -C "$fixture_repo" rev-parse HEAD)"
  reviewed_tree="$(git -C "$fixture_repo" rev-parse "$reviewed_head^{tree}")"

  git -C "$fixture_repo" switch -q -c protected-base "$fork_parent"
  mkdir -p "$fixture_repo/.github"
  printf 'trusted policy advance\n' > "$fixture_repo/.github/policy.txt"
  git -C "$fixture_repo" add .github/policy.txt
  git -C "$fixture_repo" commit -q -m 'advance protected policy'
  protected_base="$(git -C "$fixture_repo" rev-parse HEAD)"

  git -C "$fixture_repo" switch -q --detach "$reviewed_head"
  printf 'not reviewed\n' > "$fixture_repo/forged.txt"
  git -C "$fixture_repo" add forged.txt
  forged_tree="$(git -C "$fixture_repo" write-tree)"
  git -C "$fixture_repo" reset -q --hard "$reviewed_head"
  forged_head="$(printf 'forged tree\n' | git -C "$fixture_repo" commit-tree \
    "$forged_tree" -p "$fork_parent" -p "$upstream_parent")"
  reversed_head="$(printf 'reversed parents\n' | git -C "$fixture_repo" commit-tree \
    "$reviewed_tree" -p "$upstream_parent" -p "$fork_parent")"
  extra_parent="$(printf 'extra parent\n' | git -C "$fixture_repo" commit-tree \
    "$common_sha^{tree}" -p "$common_sha")"
  octopus_head="$(printf 'octopus merge\n' | git -C "$fixture_repo" commit-tree \
    "$reviewed_tree" -p "$fork_parent" -p "$upstream_parent" -p "$extra_parent")"
  non_merge_head="$(printf 'not a merge\n' | git -C "$fixture_repo" commit-tree \
    "$reviewed_tree" -p "$fork_parent")"

  run_fixture_admission() {
    local fixture_head="$1"
    local fixture_output="$2"
    shift 2
    (
      cd "$fixture_repo"
      env \
        GITHUB_OUTPUT= \
        BASE_SHA="$protected_base" HEAD_SHA="$fixture_head" PR_NUMBER=999 \
        HEAD_REPOSITORY=mbenhamd/mastra \
        HEAD_REF=papersflow/pf-2576-upstream-sync-20260801 \
        BASE_REF=main \
        PAPERSFLOW_PF2576_MERGE_COMMIT="$reviewed_head" \
        PAPERSFLOW_PF2576_FORK_PARENT="$fork_parent" \
        PAPERSFLOW_PF2576_UPSTREAM_PARENT="$upstream_parent" \
        PAPERSFLOW_PF2576_REVIEWED_TREE="$reviewed_tree" \
        "$@" bash "$script_path" --classify-install
    ) > "$fixture_output" 2>&1
  }

  output="$test_root/approved.log"
  run_fixture_admission "$reviewed_head" "$output"
  grep -Fxq 'lane=pf2576-upstream-sync' "$output"

  output="$test_root/forged-tree.log"
  if run_fixture_admission "$forged_head" "$output" \
    PAPERSFLOW_PF2576_MERGE_COMMIT="$forged_head"; then
    echo 'PF-2576 forged tree with the reviewed parents unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'head tree does not match the reviewed merge tree' "$output"

  output="$test_root/reversed-parents.log"
  if run_fixture_admission "$reversed_head" "$output" \
    PAPERSFLOW_PF2576_MERGE_COMMIT="$reversed_head"; then
    echo 'PF-2576 reversed parent order unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'not the exact reviewed two-parent upstream merge topology' "$output"

  output="$test_root/octopus.log"
  if run_fixture_admission "$octopus_head" "$output" \
    PAPERSFLOW_PF2576_MERGE_COMMIT="$octopus_head"; then
    echo 'PF-2576 octopus merge unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'not the exact reviewed two-parent upstream merge topology' "$output"

  output="$test_root/non-merge.log"
  if run_fixture_admission "$non_merge_head" "$output" \
    PAPERSFLOW_PF2576_MERGE_COMMIT="$non_merge_head"; then
    echo 'PF-2576 non-merge head unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'not the exact reviewed two-parent upstream merge topology' "$output"

  output="$test_root/wrong-head.log"
  if run_fixture_admission "$reviewed_head" "$output" \
    PAPERSFLOW_PF2576_MERGE_COMMIT="$fork_parent"; then
    echo 'PF-2576 head that differs from the reviewed commit unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'head is not the exact reviewed merge commit' "$output"

  output="$test_root/untrusted-base.log"
  if run_fixture_admission "$reviewed_head" "$output" BASE_SHA="$common_sha"; then
    echo 'PF-2576 base outside the reviewed fork lineage unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'protected base does not descend from the reviewed fork parent' "$output"

  output="$test_root/base-contained-in-head.log"
  if run_fixture_admission "$reviewed_head" "$output" BASE_SHA="$reviewed_head"; then
    echo 'PF-2576 base/head intersection beyond the reviewed fork parent unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'no longer meet at the reviewed fork parent' "$output"

  output="$test_root/wrong-metadata.log"
  if run_fixture_admission "$reviewed_head" "$output" HEAD_REF=feature/not-pf-2576; then
    echo 'Wrong PF-2576 branch metadata unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'do not match a reviewed upstream-sync lane' "$output"

  echo 'PF-2576 exact-commit, topology, tree, ancestry, and metadata admission fixtures passed.'
)

run_pf2247_admission_self_tests() (
  local script_path test_root fixture_repo common_sha fork_parent upstream_parent
  local reviewed_head reviewed_tree protected_base forged_tree forged_head
  local reversed_head extra_parent octopus_head non_merge_head output

  script_path="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
  test_root="$(mktemp -d)"
  fixture_repo="$test_root/repo"
  pf2247_fixture_cleanup() {
    local status=$?
    trap - EXIT
    if (( status != 0 )); then
      echo 'PF-2247 admission fixture failed; captured classifier output follows:' >&2
      find "$test_root" -maxdepth 1 -type f -name '*.log' -print -exec sed -n '1,240p' {} \; >&2 || true
    fi
    rm -rf -- "$test_root"
    exit "$status"
  }
  trap pf2247_fixture_cleanup EXIT
  mkdir -p "$fixture_repo"

  git -C "$fixture_repo" init -q -b main
  git -C "$fixture_repo" config user.email validator@example.invalid
  git -C "$fixture_repo" config user.name 'PF-2247 admission fixture'
  printf '{"name":"fixture","version":"1.0.0"}\n' > "$fixture_repo/package.json"
  git -C "$fixture_repo" add package.json
  git -C "$fixture_repo" commit -q -m common
  common_sha="$(git -C "$fixture_repo" rev-parse HEAD)"

  git -C "$fixture_repo" switch -q -c upstream
  printf '{"name":"fixture","version":"2.0.0"}\n' > "$fixture_repo/package.json"
  printf 'official upstream\n' > "$fixture_repo/upstream.txt"
  git -C "$fixture_repo" add package.json upstream.txt
  git -C "$fixture_repo" commit -q -m upstream
  upstream_parent="$(git -C "$fixture_repo" rev-parse HEAD)"

  git -C "$fixture_repo" switch -q main
  printf 'fork work\n' > "$fixture_repo/fork.txt"
  git -C "$fixture_repo" add fork.txt
  git -C "$fixture_repo" commit -q -m fork
  fork_parent="$(git -C "$fixture_repo" rev-parse HEAD)"
  git -C "$fixture_repo" merge -q --no-ff upstream -m 'reviewed upstream merge'
  reviewed_head="$(git -C "$fixture_repo" rev-parse HEAD)"
  reviewed_tree="$(git -C "$fixture_repo" rev-parse "$reviewed_head^{tree}")"

  git -C "$fixture_repo" switch -q -c protected-base "$fork_parent"
  mkdir -p "$fixture_repo/.github"
  printf 'trusted policy advance\n' > "$fixture_repo/.github/policy.txt"
  git -C "$fixture_repo" add .github/policy.txt
  git -C "$fixture_repo" commit -q -m 'advance protected policy'
  protected_base="$(git -C "$fixture_repo" rev-parse HEAD)"

  git -C "$fixture_repo" switch -q --detach "$reviewed_head"
  printf 'not reviewed\n' > "$fixture_repo/forged.txt"
  git -C "$fixture_repo" add forged.txt
  forged_tree="$(git -C "$fixture_repo" write-tree)"
  git -C "$fixture_repo" reset -q --hard "$reviewed_head"
  forged_head="$(printf 'forged tree\n' | git -C "$fixture_repo" commit-tree \
    "$forged_tree" -p "$fork_parent" -p "$upstream_parent")"
  reversed_head="$(printf 'reversed parents\n' | git -C "$fixture_repo" commit-tree \
    "$reviewed_tree" -p "$upstream_parent" -p "$fork_parent")"
  extra_parent="$(printf 'extra parent\n' | git -C "$fixture_repo" commit-tree \
    "$common_sha^{tree}" -p "$common_sha")"
  octopus_head="$(printf 'octopus merge\n' | git -C "$fixture_repo" commit-tree \
    "$reviewed_tree" -p "$fork_parent" -p "$upstream_parent" -p "$extra_parent")"
  non_merge_head="$(printf 'not a merge\n' | git -C "$fixture_repo" commit-tree \
    "$reviewed_tree" -p "$fork_parent")"

  run_fixture_admission() {
    local fixture_head="$1"
    local fixture_output="$2"
    shift 2
    (
      cd "$fixture_repo"
      env \
        GITHUB_OUTPUT= \
        BASE_SHA="$protected_base" HEAD_SHA="$fixture_head" PR_NUMBER=999 \
        HEAD_REPOSITORY=mbenhamd/mastra \
        HEAD_REF=feature/pf-2247-upstream-sync-a81d3c24 \
        BASE_REF=main \
        PAPERSFLOW_PF2247_MERGE_COMMIT="$reviewed_head" \
        PAPERSFLOW_PF2247_FORK_PARENT="$fork_parent" \
        PAPERSFLOW_PF2247_UPSTREAM_PARENT="$upstream_parent" \
        PAPERSFLOW_PF2247_REVIEWED_TREE="$reviewed_tree" \
        "$@" bash "$script_path" --classify-install
    ) > "$fixture_output" 2>&1
  }

  output="$test_root/approved.log"
  run_fixture_admission "$reviewed_head" "$output"
  grep -Fxq 'lane=pf2247-upstream-sync' "$output"

  output="$test_root/forged-tree.log"
  if run_fixture_admission "$forged_head" "$output" \
    PAPERSFLOW_PF2247_MERGE_COMMIT="$forged_head"; then
    echo 'PF-2247 forged tree with the reviewed parents unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'head tree does not match the reviewed merge tree' "$output"

  output="$test_root/reversed-parents.log"
  if run_fixture_admission "$reversed_head" "$output" \
    PAPERSFLOW_PF2247_MERGE_COMMIT="$reversed_head"; then
    echo 'PF-2247 reversed parent order unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'not the exact reviewed two-parent upstream merge topology' "$output"

  output="$test_root/octopus.log"
  if run_fixture_admission "$octopus_head" "$output" \
    PAPERSFLOW_PF2247_MERGE_COMMIT="$octopus_head"; then
    echo 'PF-2247 octopus merge unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'not the exact reviewed two-parent upstream merge topology' "$output"

  output="$test_root/non-merge.log"
  if run_fixture_admission "$non_merge_head" "$output" \
    PAPERSFLOW_PF2247_MERGE_COMMIT="$non_merge_head"; then
    echo 'PF-2247 non-merge head unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'not the exact reviewed two-parent upstream merge topology' "$output"

  output="$test_root/wrong-head.log"
  if run_fixture_admission "$reviewed_head" "$output" \
    PAPERSFLOW_PF2247_MERGE_COMMIT="$fork_parent"; then
    echo 'PF-2247 head that differs from the reviewed commit unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'head is not the exact reviewed merge commit' "$output"

  output="$test_root/untrusted-base.log"
  if run_fixture_admission "$reviewed_head" "$output" BASE_SHA="$common_sha"; then
    echo 'PF-2247 base outside the reviewed fork lineage unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'protected base does not descend from the reviewed fork parent' "$output"

  output="$test_root/base-contained-in-head.log"
  if run_fixture_admission "$reviewed_head" "$output" BASE_SHA="$reviewed_head"; then
    echo 'PF-2247 base/head intersection beyond the reviewed fork parent unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'no longer meet at the reviewed fork parent' "$output"

  output="$test_root/wrong-metadata.log"
  if run_fixture_admission "$reviewed_head" "$output" HEAD_REF=feature/not-pf-2247; then
    echo 'Wrong PF-2247 branch metadata unexpectedly passed admission.' >&2
    return 1
  fi
  grep -Fq 'do not match a reviewed upstream-sync lane' "$output"

  echo 'PF-2247 exact-commit, topology, tree, ancestry, and metadata admission fixtures passed.'
)

case "${1:-}" in
  --classify-install)
    classify_install_lane
    exit
    ;;
  --self-test-pf3553-selected-route-exports)
    run_pf3553_admission_self_tests
    exit
    ;;
  --self-test-pf558-upstream-sync)
    run_pf558_admission_self_tests
    exit
    ;;
  --self-test-pf2009-upstream-sync)
    run_pf2009_admission_self_tests
    exit
    ;;
  --self-test-pf2045-upstream-sync)
    run_pf2045_admission_self_tests
    exit
    ;;
  --self-test-pf4051-upstream-sync)
    run_pf4051_admission_self_tests
    exit
    ;;
  --self-test-pf3375-upstream-sync)
    run_pf3375_admission_self_tests
    exit
    ;;
  --self-test-pf4163-upstream-sync)
    run_pf4163_admission_self_tests
    exit
    ;;
  --self-test-pf3020-upstream-sync)
    run_pf3020_admission_self_tests
    exit
    ;;
  --self-test-pf2576-upstream-sync)
    run_pf2576_admission_self_tests
    exit
    ;;
  --self-test-pf2247-upstream-sync)
    run_pf2247_admission_self_tests
    exit
    ;;
  --validate-pf2042-reviewed-topology)
    verify_pf2042_inngest_topology
    exit
    ;;
esac

run_validator_self_tests() {
  # Synthetic cases own PR metadata even when invoked by an exact-pin source PR.
  local -x HEAD_REPOSITORY=mbenhamd/mastra HEAD_REF=feature/fork-validator-fixture
  local -x BASE_REF=main PR_NUMBER=999
  local validator_path
  local test_root
  local fixture_repo
  local mock_bin
  local command_log
  local command_environment_log
  local docker_log
  local service_log
  local base_sha
  local head_sha
  local server_root_core_imports_base_sha server_root_core_imports_head_sha
  local pf3553_base_sha pf3553_head_sha pf3553_lane_spoof_head_sha
  local pf3553_base_surface_sha256 pf3553_head_surface_sha256
  local inngest_trio_head_sha inngest_pf2050_head_sha inngest_manager_followup_head_sha
  local fixture_inngest_test_blob fixture_inngest_test_sha
  local fixture_inngest_compose_blob fixture_inngest_compose_sha
  local fixture_inngest_adapter_blob fixture_inngest_adapter_sha
  local temporal_build_line temporal_typecheck_line
  local package_contract_dependency_base_sha package_contract_base_sha package_contract_head_sha rejected_case failed_command
  local output
  local status

  # Keep the dedicated manifest/dependency admission suite in the aggregate
  # validator self-test as well as exposing it through its focused entrypoint.
  if [[ "${1:-}" != '--package-contracts-only' ]]; then
    run_pf3553_admission_self_tests
  fi

  validator_path="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
  test_root="$(mktemp -d)"
  validator_self_test_root="$test_root"
  trap 'rm -rf -- "${validator_self_test_root:?}"' EXIT
  fixture_repo="$test_root/repo"
  mock_bin="$test_root/bin"
  command_log="$test_root/pnpm.log"
  command_environment_log="$test_root/pnpm-environment.log"
  docker_log="$test_root/docker.log"
  service_log="$test_root/services.log"
  mkdir -p \
    "$fixture_repo/client-sdks/client-js/src/resources" \
    "$fixture_repo/.github/workflows" \
    "$fixture_repo/harnessv1/sections/04-public-api/02-session" \
    "$fixture_repo/mastracode/sdk/scripts" \
    "$fixture_repo/mastracode/sdk/src/utils/__tests__" \
    "$fixture_repo/packages/cli/src/commands/api" \
    "$fixture_repo/packages/core/src/auth/ee/interfaces" \
    "$fixture_repo/packages/core/src/agent/__tests__" \
    "$fixture_repo/packages/core/src/agent/durable/__tests__" \
    "$fixture_repo/packages/core/src/harness/v1" \
    "$fixture_repo/packages/_types-builder/src" \
    "$fixture_repo/packages/agent-builder/src" \
    "$fixture_repo/packages/agent-builder/integration-tests/src" \
    "$fixture_repo/scripts" \
    "$fixture_repo/packages/server/src/server/handlers" \
    "$fixture_repo/packages/server/src/server/server-adapter/routes" \
    "$fixture_repo/pubsub/google-cloud-pubsub/src" \
    "$fixture_repo/pubsub/redis-streams/src" \
    "$fixture_repo/stores/convex/src/cache" \
    "$fixture_repo/stores/convex/src/server" \
    "$fixture_repo/stores/_test-utils/src/domains/harness" \
    "$fixture_repo/stores/_test-utils/src/domains/workflows" \
    "$fixture_repo/stores/libsql/src/storage/domains/harness" \
    "$fixture_repo/stores/libsql/src/storage/domains/workflows" \
    "$fixture_repo/stores/libsql/src/storage" \
    "$fixture_repo/stores/pg/src/storage/domains/workflows" \
    "$fixture_repo/stores/pg/src/storage/domains/memory" \
    "$fixture_repo/stores/pg/src/storage/db" \
    "$fixture_repo/stores/pg/src/storage/performance-indexes" \
    "$fixture_repo/workflows/inngest/src/__tests__/adapters" \
    "$fixture_repo/workflows/inngest/src/durable-agent" \
    "$fixture_repo/workflows/inngest/src" \
    "$fixture_repo/workflows/temporal/src" \
    "$fixture_repo/node_modules" \
    "$mock_bin"
  # The production validator is copied to RUNNER_TEMP and resolves TypeScript
  # from the checked-out repository. Mirror that installed dependency in the
  # isolated fixture rather than resolving modules relative to BASH_SOURCE.
  ln -s "$TYPESCRIPT_MODULE_PATH" "$fixture_repo/node_modules/typescript"

  # The single-quoted lines are intentionally emitted into the mock pnpm
  # executable and expand only when that fixture command runs.
  printf '%s\n' '#!/usr/bin/env bash' 'set -euo pipefail' > "$mock_bin/pnpm"
  # shellcheck disable=SC2016
  printf '%s\n' \
    'printf '\''%s\n'\'' "$*" >> "${MOCK_PNPM_LOG:?}"' \
    'printf '\''LLM_TEST_MODE=%s\t%s\n'\'' "${LLM_TEST_MODE:-}" "$*" >> "${MOCK_PNPM_ENVIRONMENT_LOG:?}"' \
    'printf '\''OPENAI_API_KEY=%s\t%s\n'\'' "${OPENAI_API_KEY:-}" "$*" >> "${MOCK_PNPM_ENVIRONMENT_LOG:?}"' \
    'if [[ " $* " == *" check:core-imports "* && "${MOCK_FAIL_CORE_IMPORTS:-0}" == 1 ]]; then exit 23; fi' \
    'if [[ " $* " == *" check:permissions "* && "${MOCK_FAIL_PERMISSIONS:-0}" == 1 ]]; then exit 17; fi' \
    'if [[ -n "${MOCK_FAIL_PACKAGE_CONTRACT_COMMAND:-}" && "$*" == "$MOCK_FAIL_PACKAGE_CONTRACT_COMMAND" ]]; then exit 29; fi' \
    'if [[ -n "${MOCK_FAIL_PACKAGE_CONTRACT_TEST:-}" && " $* " == *" $MOCK_FAIL_PACKAGE_CONTRACT_TEST "* ]]; then exit 31; fi' \
    'if [[ " $* " == *" generate:route-types "* && "${MOCK_STALE_ROUTE_TYPES:-0}" == 1 ]]; then' \
    '  printf '\''%s\n'\'' "// regenerated" >> client-sdks/client-js/src/route-types.generated.ts' \
    'fi' \
    'if [[ " $* " == *" generate:route-types "* && ! -f client-sdks/client-js/src/route-types.generated.ts ]]; then' \
    '  mkdir -p client-sdks/client-js/src' \
    '  printf '\''%s\n'\'' "export const routeTypes = '\''regenerated'\'';" > client-sdks/client-js/src/route-types.generated.ts' \
    'fi' \
    'if [[ " $* " == *" generate:api-cli-route-metadata "* && "${MOCK_STALE_CLI_METADATA:-0}" == 1 ]]; then' \
    '  printf '\''%s\n'\'' "// regenerated" >> packages/cli/src/commands/api/route-metadata.generated.ts' \
    'fi' \
    'if [[ " $* " == *" generate:api-cli-route-metadata "* && ! -f packages/cli/src/commands/api/route-metadata.generated.ts ]]; then' \
    '  mkdir -p packages/cli/src/commands/api' \
    '  printf '\''%s\n'\'' "export const routeMetadata = '\''regenerated'\'';" > packages/cli/src/commands/api/route-metadata.generated.ts' \
    'fi' \
    'if [[ " $* " == *" --filter ./packages/server --fail-if-no-match build:lib "* ]]; then' \
    '  mkdir -p packages/server/dist/server/server-adapter/routes' \
    '  for path in packages/server/dist/server/server-adapter/selected.{d.ts,js,cjs} packages/server/dist/server/server-adapter/routes/harness.{d.ts,js,cjs}; do' \
    '    printf '\''%s\n'\'' "// fixture build output" > "$path"' \
    '  done' \
    'fi' \
    'if [[ " $* " == *" --filter ./server-adapters/fastify --fail-if-no-match build "* ]]; then' \
    '  mkdir -p server-adapters/fastify/dist' \
    '  for path in server-adapters/fastify/dist/selected.{d.ts,js,cjs}; do' \
    '    printf '\''%s\n'\'' "// fixture build output" > "$path"' \
    '  done' \
    'fi' \
    'for argument in "$@"; do' \
    '  case "$argument" in' \
    '    --outputFile.json=*)' \
    '      if [[ -n "${MOCK_ZERO_PACKAGE_CONTRACT_TEST:-}" && " $* " == *" $MOCK_ZERO_PACKAGE_CONTRACT_TEST "* ]]; then' \
    '        printf '\''%s\n'\'' '\''{"numPassedTests":0,"numFailedTests":0}'\'' > "${argument#*=}"' \
    '      elif [[ " $* " == *" --typecheck.only "* ]]; then' \
    '        case "${MOCK_TYPE_TEST_REPORT:-pass}" in' \
    '          zero) printf '\''%s\n'\'' '\''{"numPassedTests":0,"numFailedTests":0}'\'' > "${argument#*=}" ;;' \
    '          partial) printf '\''%s\n'\'' '\''{"numPassedTests":1}'\'' > "${argument#*=}" ;;' \
    '          nonnumeric) printf '\''%s\n'\'' '\''{"numPassedTests":"one","numFailedTests":0}'\'' > "${argument#*=}" ;;' \
    '          *) printf '\''%s\n'\'' '\''{"numPassedTests":1,"numFailedTests":0}'\'' > "${argument#*=}" ;;' \
    '        esac' \
    '      elif [[ " $* " == *" --dir server-adapters/fastify exec vitest run "* ]]; then' \
    '        printf '\''%s\n'\'' '\''{"numPassedTests":3,"numFailedTests":0,"testResults":[{"name":"server-adapters/fastify/src/__tests__/selected-import-closure.test.ts","status":"passed","assertionResults":[{"status":"passed"}]},{"name":"server-adapters/fastify/src/__tests__/selected-package-exports.test.ts","status":"passed","assertionResults":[{"status":"passed"}]},{"name":"server-adapters/fastify/src/__tests__/selected-routes.test.ts","status":"passed","assertionResults":[{"status":"passed"}]}]}'\'' > "${argument#*=}"' \
    '      else' \
    '        printf '\''%s\n'\'' '\''{"numPassedTests":1,"numFailedTests":0}'\'' > "${argument#*=}"' \
    '      fi' \
    '      ;;' \
    '  esac' \
    'done' \
    >> "$mock_bin/pnpm"
  chmod +x "$mock_bin/pnpm"
  # Expanded only inside the emitted mock.
  # shellcheck disable=SC2016
  printf '%s\n' '#!/usr/bin/env bash' 'set -euo pipefail' \
    'printf '\''%s\n'\'' "$*" >> "${MOCK_DOCKER_LOG:?}"' \
    'if [[ "${MOCK_DOCKER_FAIL:-0}" == 1 ]]; then exit 19; fi' \
    > "$mock_bin/docker"
  chmod +x "$mock_bin/docker"

  (
    cd "$fixture_repo"
    git init -q -b main
    git config user.email validator@example.test
    git config user.name 'Fork validator fixture'
    printf '%s\n' '{}' > package.json
    printf '%s\n' \
      "lockfileVersion: '9.0'" \
      '' \
      'importers:' \
      '' \
      '  workflows/inngest:' \
      '    devDependencies:' \
      "      '@ai-sdk/openai':" \
      '        specifier: ^1.3.24' \
      '        version: 1.3.24(zod@4.4.3)' \
      '      inngest-cli:' \
      '        specifier: ^1.26.0' \
      '        version: 1.27.0(encoding@0.1.13)' \
      '      vitest:' \
      '        specifier: ^4.1.0' \
      '        version: 4.1.0' \
      '' \
      'packages:' \
      '' \
      '  inngest-cli@1.27.0:' \
      '    resolution: {integrity: sha512-fixture}' \
      '    hasBin: true' \
      '  vitest@4.1.0:' \
      '    resolution: {integrity: sha512-retained}' \
      '' \
      'snapshots:' \
      '' \
      '  inngest-cli@1.27.0(encoding@0.1.13):' \
      '    dependencies:' \
      '      debug: 4.4.3' \
      '    transitivePeerDependencies:' \
      '      - encoding' \
      '  vitest@4.1.0: {}' \
      '' \
      > pnpm-lock.yaml
    printf '%s\n' '{}' > client-sdks/client-js/package.json
    printf '%s\n' \
      '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext","noEmit":true,"strict":true}}' \
      > client-sdks/client-js/tsconfig.json
    printf '%s\n' 'export default {};' > client-sdks/client-js/vitest.config.ts
    printf '%s\n' "import { it } from 'vitest';" "it('client harness resource', () => {});" \
      > client-sdks/client-js/src/resources/harness.test.ts
    printf '%s\n' "import { it } from 'vitest';" "it('client package exports', () => {});" \
      > client-sdks/client-js/src/index.test.ts
    printf '%s\n' '# Harness session contract' \
      > harnessv1/sections/04-public-api/02-session/messages.md
    printf '%s\n' '{}' > mastracode/sdk/package.json
    printf '%s\n' 'export default {};' > mastracode/sdk/vitest.config.ts
    printf '%s\n' \
      'export function buildObservationIndexInput(candidate: unknown) {' \
      '  return candidate;' \
      '}' \
      > mastracode/sdk/src/utils/observation-index-input.ts
    printf '%s\n' "import { it } from 'vitest';" "it('authorizes observation indexing', () => {});" \
      > mastracode/sdk/src/utils/__tests__/observation-index-input.test.ts
    printf '%s\n' \
      "import { buildObservationIndexInput } from '../src/utils/observation-index-input';" \
      'declare const memory: { indexObservation(input: unknown): Promise<void> };' \
      'export async function indexObservationGroupsFromMessages(' \
      '  memory: { indexObservation(input: unknown): Promise<void> },' \
      '  candidate: unknown,' \
      ') {' \
      '  const input = buildObservationIndexInput(candidate);' \
      '  if (!input) return;' \
      '  await memory.indexObservation(input);' \
      '}' \
      'void indexObservationGroupsFromMessages(memory, {});' \
      > mastracode/sdk/scripts/index-messages.ts
    printf '%s\n' '{}' > packages/cli/package.json
    printf '%s\n' '{"private":true,"scripts":{}}' > packages/_types-builder/package.json
    printf '%s\n' 'export const generateTypes = true;' > packages/_types-builder/src/index.js
    printf '%s\n' 'export const replaceTypes = true;' > packages/_types-builder/src/replace-types.js
    printf '%s\n' '{"scripts":{"check":"tsc --noEmit","lint":"oxlint .","build":"tsdown"},"devDependencies":{"@mastra/core":"workspace:*"}}' \
      > packages/agent-builder/package.json
    printf '%s\n' 'export default {};' > packages/agent-builder/tsdown.config.ts
    printf '%s\n' 'export default {};' > packages/agent-builder/vitest.config.ts
    printf '%s\n' '{"compilerOptions":{"strict":true},"include":["src"]}' > packages/agent-builder/tsconfig.json
    printf '%s\n' '{}' > packages/agent-builder/integration-tests/package.json
    printf '%s\n' '# Agent Builder integration tests' > packages/agent-builder/integration-tests/README.md
    printf '%s\n' "import { it } from 'vitest';" "it('agent builder', () => {});" \
      > packages/agent-builder/src/agent-builder.test.ts
    printf '%s\n' "import { it } from 'vitest';" "it('native declarations', () => {});" \
      > scripts/types-builder.test.ts
    printf '%s\n' '{"compilerOptions":{"strict":true,"noUncheckedIndexedAccess":true},"include":["types-builder.test.ts"]}' \
      > scripts/tsconfig.json
    printf '%s\n' '{}' > packages/core/package.json
    printf '%s\n' 'export default {};' > packages/core/vitest.config.ts
    printf '%s\n' "export const supervisorRuntime = 'base';" \
      > packages/core/src/agent/supervisor-runtime.ts
    printf '%s\n' \
      "import { openai } from '@ai-sdk/openai-v5';" \
      "import { describe, expect, it } from 'vitest';" \
      "import { supervisorRuntime } from '../supervisor-runtime';" \
      "describe('Supervisor Pattern Integration Tests', () => {" \
      "  it('supervisor integration', () => expect(supervisorRuntime).toBe('base'));" \
      '});' \
      "describe('Supervisor Pattern - Working memory forwarding', () => {" \
      '  it.skipIf(!process.env.OPENAI_API_KEY)(' \
      "    'keeps the reviewed provider smoke guarded'," \
      "    () => void openai('gpt-4o-mini')," \
      '  );' \
      '});' \
      > packages/core/src/agent/__tests__/supervisor-integration.test.ts
    printf '%s\n' \
      "import { createGatewayMock } from '@internal/test-utils';" \
      "import { afterAll, beforeAll, it } from 'vitest';" \
      'const mock = createGatewayMock({});' \
      'beforeAll(() => mock.start());' \
      'afterAll(() => mock.saveAndStop());' \
      'export function toolApprovalAndSuspensionTests() {' \
      "  it('tool approval', () => {});" \
      '}' \
      > packages/core/src/agent/__tests__/tool-approval.e2e.test.ts
    printf '%s\n' "import { it } from 'vitest';" "it('permission gate', () => {});" \
      > packages/core/src/harness/v1/session.permission-gate.e2e.test.ts
    printf '%s\n' "import { it } from 'vitest';" "it('plan task', () => {});" \
      > packages/core/src/harness/v1/session.plan-task.e2e.test.ts
    printf '%s\n' "export const permission = 'base';" \
      > packages/core/src/auth/ee/interfaces/permissions.generated.ts
    printf '%s\n' '{}' > packages/server/package.json
    printf '%s\n' 'export default {};' > packages/server/vitest.config.ts
    printf '%s\n' '{}' > pubsub/google-cloud-pubsub/package.json
    printf '%s\n' 'export const googleCloudPubSub = true;' > pubsub/google-cloud-pubsub/src/index.ts
    printf '%s\n' "import { it } from 'vitest';" "it('google pubsub', () => {});" \
      > pubsub/google-cloud-pubsub/src/group.test.ts
    printf '%s\n' '{}' > pubsub/redis-streams/package.json
    printf '%s\n' 'export const redisStreams = true;' > pubsub/redis-streams/src/index.ts
    printf '%s\n' "import { it } from 'vitest';" "it('redis streams', () => {});" \
      > pubsub/redis-streams/src/pubsub.test.ts
    printf '%s\n' 'services:' '  redis:' '    image: redis:8-alpine' \
      > pubsub/redis-streams/docker-compose.yaml
    printf '%s\n' '{}' > stores/convex/package.json
    printf '%s\n' 'export const convexCache = true;' > stores/convex/src/cache/index.ts
    printf '%s\n' "import { it } from 'vitest';" "it('convex cache', () => {});" \
      > stores/convex/src/cache/index.test.ts
    printf '%s\n' 'export const convexServerCache = true;' > stores/convex/src/server/cache.ts
    printf '%s\n' "import { it } from 'vitest';" "it('convex server cache', () => {});" \
      > stores/convex/src/server/cache.test.ts
    printf '%s\n' '{}' > stores/_test-utils/package.json
    printf '%s\n' 'export const harnessConformance = true;' \
      > stores/_test-utils/src/domains/harness/index.ts
    printf '%s\n' \
      "import { describe } from 'vitest';" \
      "import { createHarnessTest } from './domains/harness';" \
      'export function createTestSuite(storage: unknown) {' \
      "  describe('Harness', () => {" \
      '    createHarnessTest({ storage });' \
      '  });' \
      "  describe('Other domain', () => {});" \
      '}' \
      > stores/_test-utils/src/factory.ts
    printf '%s\n' \
      "import { MockStore } from '@mastra/core/storage';" \
      "import { createTestSuite } from './factory';" \
      'createTestSuite(new MockStore());' \
      > stores/_test-utils/src/index.test.ts
    printf '%s\n' 'export const atomicResumeConformance = true;' \
      > stores/_test-utils/src/domains/workflows/atomic-resume.ts
    printf '%s\n' "export { atomicResumeConformance } from './domains/workflows/atomic-resume';" \
      > stores/_test-utils/src/index.ts
    printf '%s\n' '{}' > stores/libsql/package.json
    printf '%s\n' 'export const libsqlStore = true;' \
      > stores/libsql/src/storage/index.ts
    printf '%s\n' "import { it } from 'vitest';" "it('libsql composite wiring', () => {});" \
      > stores/libsql/src/storage/index.test.ts
    printf '%s\n' 'export const harnessStorage = true;' \
      > stores/libsql/src/storage/domains/harness/index.ts
    printf '%s\n' "import { it } from 'vitest';" "it('libsql harness storage', () => {});" \
      > stores/libsql/src/storage/domains/harness/index.test.ts
    printf '%s\n' 'export const libsqlWorkflowStorage = true;' \
      > stores/libsql/src/storage/domains/workflows/index.ts
    printf '%s\n' "import { it } from 'vitest';" "it('libsql atomic resume', () => {});" \
      > stores/libsql/src/storage/domains/workflows/atomic-resume.test.ts
    printf '%s\n' '{}' > stores/pg/package.json
    printf '%s\n' 'export default {};' > stores/pg/vitest.config.ts
    printf '%s\n' 'export default {};' > stores/pg/vitest.perf.config.ts
    printf '%s\n' 'export const pgWorkflowStorage = true;' \
      > stores/pg/src/storage/domains/workflows/index.ts
    printf '%s\n' "import { it } from 'vitest';" "it('pg atomic resume', () => {});" \
      > stores/pg/src/storage/domains/workflows/atomic-resume.test.ts
    printf '%s\n' "import { it } from 'vitest';" "it('pg performance index', () => {});" \
      > stores/pg/src/storage/performance-indexes/performance-indexes.test.ts
    printf '%s\n' "import { it } from 'vitest';" "it('pg external schema', () => {});" \
      > stores/pg/src/storage/db/external-schema.integration.test.ts
    printf '%s\n' \
      '{"scripts":{"test":"vitest run","test:workflow":"vitest run --no-isolate --retry=1 src/index.test.ts","test:docker":"docker-compose up -d && vitest run --no-isolate --retry=1 --exclude='\''src/__tests__/adapters/**'\'' && docker-compose down"},"devDependencies":{"@ai-sdk/openai":"^1.3.24","inngest-cli":"^1.26.0"}}' \
      > workflows/inngest/package.json
    printf '%s\n' 'services:' '  inngest:' '    image: inngest/inngest:v1.13.1' \
      > workflows/inngest/docker-compose.yaml
    printf '%s\n' 'export const adapterInngestPort = 43123;' \
      > workflows/inngest/src/__tests__/adapters/_utils.ts
    printf '%s\n' "import { it } from 'vitest';" "it('self-hosting inngest', () => {});" \
      > workflows/inngest/src/index.test.ts
    printf '%s\n' 'export const resumeOperation = true;' > workflows/inngest/src/resume-operation.ts
    printf '%s\n' 'export const run = true;' > workflows/inngest/src/run.ts
    printf '%s\n' 'export const workflow = true;' > workflows/inngest/src/workflow.ts
    printf '%s\n' 'export type InngestAgentResumeOptions = { requireToolPermissionPolicy?: true };' \
      > workflows/inngest/src/durable-agent/create-inngest-agent.ts
    printf '%s\n' "import { it } from 'vitest';" "it('create inngest agent', () => {});" \
      > workflows/inngest/src/__tests__/create-inngest-agent.test.ts
    printf '%s\n' 'export const durableAgentTestUtils = true;' \
      > workflows/inngest/src/__tests__/durable-agent.test.utils.ts
    printf '%s\n' "import { it } from 'vitest';" "it('durable test utility', () => {});" \
      > workflows/inngest/src/__tests__/durable-agent.test.utils.test.ts
    printf '%s\n' "import { it } from 'vitest';" "it('create run contract', () => {});" \
      > workflows/inngest/src/create-run-contract.test.ts
    printf '%s\n' "import { it } from 'vitest';" "it('lifecycle execution', () => {});" \
      > workflows/inngest/src/lifecycle-execution.test.ts
    printf '%s\n' "import { it } from 'vitest';" "it('resume async', () => {});" \
      > workflows/inngest/src/resume-async.test.ts
    printf '%s\n' "import { it } from 'vitest';" "it('stream terminal', () => {});" \
      > workflows/inngest/src/run-stream-terminal.test.ts
    printf '%s\n' "import { it } from 'vitest';" "it('serve terminal', () => {});" \
      > workflows/inngest/src/serve.test.ts
    printf '%s\n' 'export const inngest = true;' > workflows/inngest/src/index.ts
    printf '%s\n' '{}' > workflows/temporal/package.json
    printf '%s\n' 'export const temporalWorkflow = true;' > workflows/temporal/src/workflow.ts
    printf '%s\n' "import { it } from 'vitest';" "it('temporal workflow contract', () => {});" \
      > workflows/temporal/src/workflow.test.ts
    printf '%s\n' \
      'name: Fork validation fixture' \
      'jobs:' \
      '  validate:' \
      '    steps:' \
      '      - name: Start pinned Inngest dev server when index suite is owned' \
      '        run: |' \
      '          docker run --detach --name mastra-inngest-test inngest/inngest@sha256:fixture' \
      "          echo 'MASTRA_INNGEST_TEST_DOCKER=1' >> \"\$GITHUB_ENV\"" \
      '      - name: Validate fork PR' \
      '        run: bash validator.bash' \
      '      - name: Stop pinned Inngest dev server' \
      '        if: always()' \
      '        run: docker rm --force mastra-inngest-test' \
      > .github/workflows/papersflow-fork-pr.yml
    printf '%s\n' "export const route = 'base';" > packages/server/src/server/server-adapter/routes/index.ts
    printf '%s\n' 'export type RouteTypes = { source: "base" };' \
      'export type HarnessRoute = { source: "base" };' \
      'export type IndexOnlyRoute = { source: "base" };' \
      > client-sdks/client-js/src/route-types.generated.ts
    printf '%s\n' "import type { RouteTypes } from './route-types.generated.js';" \
      'export type ClientRouteTypes = RouteTypes;' \
      > client-sdks/client-js/src/types.ts
    printf '%s\n' "import type { HarnessRoute } from '../route-types.generated.js';" \
      'export type ClientHarnessRoute = HarnessRoute;' \
      'export type InboxResponseGeneration = { responseId: string };' \
      > client-sdks/client-js/src/resources/harness.ts
    printf '%s\n' 'export const clientTool = true;' \
      > client-sdks/client-js/src/tools.ts
    printf '%s\n' \
      "export * from './tools';" \
      "export type { IndexOnlyRoute, RouteTypes } from './route-types.generated.js';" \
      "export type { ClientHarnessRoute } from './resources/harness';" \
      > client-sdks/client-js/src/index.ts
    printf '%s\n' "export const routeMetadata = 'base';" > packages/cli/src/commands/api/route-metadata.generated.ts
    printf '%s\n' 'export const favoriteFixture = true;' \
      > packages/server/src/server/handlers/favorites-helper.ts
    printf '%s\n' "import { Hono } from 'hono';" \
      'export const dormantExternalFixture = Hono;' \
      > packages/server/src/server/handlers/dormant-external-helper.ts
    printf '%s\n' "import { it } from 'vitest';" "import { favoriteFixture } from './favorites-helper';" \
      "it('favorites', () => favoriteFixture);" \
      > packages/server/src/server/handlers/favorites.integration.test.ts
    printf '%s\n' 'export const eventedExecution = process.env.MASTRA_EVENTED_EXECUTION;' \
      > packages/core/src/harness/v1/agent-helper.ts
    printf '%s\n' "import { it } from 'vitest';" \
      "import { eventedExecution } from './agent-helper';" \
      "it('harness', () => eventedExecution);" \
      > packages/core/src/harness/v1/session.real-agent.e2e.test.ts
    printf '%s\n' "import { it } from 'vitest';" "it('durable background tasks', () => {});" \
      > packages/core/src/agent/durable/__tests__/durable-agent-background-tasks.e2e.test.ts
    printf '%s\n' "import { it } from 'vitest';" "it('external', () => {});" \
      > packages/server/src/server/handlers/external.integration.test.ts
    git add .
    git commit -q -m base
  )
  base_sha="$(git -C "$fixture_repo" rev-parse HEAD)"

  run_fixture() {
    local fixture_head="$1"
    local fixture_output="$2"
    shift 2
    (
      cd "$fixture_repo"
      env \
        PATH="$mock_bin:$PATH" \
        MOCK_PNPM_LOG="$command_log" \
        MOCK_PNPM_ENVIRONMENT_LOG="$command_environment_log" \
        MOCK_DOCKER_LOG="$docker_log" \
        MOCK_SERVICE_LOG="$service_log" \
        BASE_SHA="$base_sha" \
        HEAD_SHA="$fixture_head" \
        "$@" \
        bash "$validator_path"
    ) > "$fixture_output" 2>&1
  }

  assert_contains() {
    local expected="$1"
    local file="$2"
    if ! grep -Fq -- "$expected" "$file"; then
      echo "Expected fixture output to contain: $expected" >&2
      cat "$file" >&2
      exit 1
    fi
  }

  assert_not_contains() {
    local unexpected="$1"
    local file="$2"
    if grep -Fq -- "$unexpected" "$file"; then
      echo "Expected fixture output not to contain: $unexpected" >&2
      cat "$file" >&2
      exit 1
    fi
  }

  assert_line_matches() {
    local expected_regex="$1"
    local file="$2"
    if ! grep -Eq -- "$expected_regex" "$file"; then
      echo "Expected a fixture-output line to match: $expected_regex" >&2
      cat "$file" >&2
      exit 1
    fi
  }

  assert_line_count() {
    local expected_count="$1"
    local expected_line="$2"
    local file="$3"
    local actual_count
    actual_count="$(grep -Fxc -- "$expected_line" "$file" || true)"
    if [[ "$actual_count" != "$expected_count" ]]; then
      echo "Expected fixture line count $expected_count for: $expected_line" >&2
      echo "Actual fixture line count: $actual_count" >&2
      cat "$file" >&2
      exit 1
    fi
  }

  assert_line_match_count() {
    local expected_count="$1"
    local expected_regex="$2"
    local file="$3"
    local actual_count
    actual_count="$(grep -Ec -- "$expected_regex" "$file" || true)"
    if [[ "$actual_count" != "$expected_count" ]]; then
      echo "Expected fixture matching-line count $expected_count for: $expected_regex" >&2
      echo "Actual fixture matching-line count: $actual_count" >&2
      cat "$file" >&2
      exit 1
    fi
  }

  assert_route_consumer_commands() {
    assert_contains '--dir client-sdks/client-js exec tsc-files --noEmit src/route-types.generated.ts src/types.ts src/resources/harness.ts src/resources/agent.test.ts' "$command_log"
    assert_contains '--dir packages/cli exec tsc-files --noEmit src/commands/api/route-metadata.generated.ts src/commands/api/index.ts src/commands/api/descriptors.test.ts' "$command_log"
    assert_contains '--dir client-sdks/client-js exec vitest run src/resources/harness.test.ts --reporter=dot' "$command_log"
    assert_contains '--dir packages/cli exec vitest run src/commands/api/descriptors.test.ts --reporter=dot' "$command_log"
  }

  assert_package_contract_rejected() {
    : > "$command_log"
    if run_fixture "$1" "$3" BASE_SHA="$2"; then
      echo 'An unsupported package contract change unexpectedly passed.' >&2
      cat "$3" >&2
      exit 1
    fi
    if [[ -s "$command_log" ]]; then
      echo 'An unsupported package contract change executed package commands.' >&2
      cat "$command_log" >&2
      exit 1
    fi
  }

  package_contract_dependency_base_sha="$(
    cd "$fixture_repo"
    node <<'NODE'
const fs = require('node:fs');
const lock = fs.readFileSync('pnpm-lock.yaml', 'utf8');
fs.writeFileSync('pnpm-lock.yaml', lock.replace('importers:\n',
  'importers:\n\n  packages/agent-builder:\n    devDependencies:\n' +
  "      '@mastra/core':\n        specifier: workspace:*\n        version: link:../core\n"));
NODE
    git add pnpm-lock.yaml
    git commit -q -m 'prepare Agent Builder importer fixture'
    git rev-parse HEAD
  )"
  output="$test_root/package-contract-lockfile-only-admission.log"
  if (
    cd "$fixture_repo"
    BASE_SHA="$base_sha" HEAD_SHA="$package_contract_dependency_base_sha" \
      GITHUB_OUTPUT= bash "$validator_path" --classify-install
  ) > "$output" 2>&1; then
    echo 'A lockfile-only change unexpectedly entered the standard install lane.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'Lockfile-only changes require a reviewed dependency-graph lane.' "$output"
  package_contract_base_sha="$(
    cd "$fixture_repo"
    node <<'NODE'
const fs = require('node:fs');
const file = 'packages/agent-builder/package.json';
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
manifest.scripts['check:fixtures'] = 'tsc --noEmit --project tsconfig.fixtures.json';
manifest.devDependencies['@mastra/mcp'] = 'workspace:*';
fs.writeFileSync(file, JSON.stringify(manifest));
const lock = fs.readFileSync('pnpm-lock.yaml', 'utf8');
fs.writeFileSync('pnpm-lock.yaml', lock.replace('        version: link:../core\n',
  '        version: link:../core\n' +
  "      '@mastra/mcp':\n        specifier: workspace:*\n        version: link:../mcp\n"));
NODE
    printf '%s\n' '{"extends":"./tsconfig.json","include":["integration-tests/src/fixtures/**/*"]}' \
      > packages/agent-builder/tsconfig.fixtures.json
    printf '%s\n' 'Run both package and fixture checks after building the workspace dependencies.' \
      >> packages/agent-builder/integration-tests/README.md
    git add .
    git commit -q -m 'own Agent Builder fixture compilation'
    git rev-parse HEAD
  )"
  output="$test_root/package-contract-fixture-admission.log"
  (
    cd "$fixture_repo"
    BASE_SHA="$package_contract_dependency_base_sha" HEAD_SHA="$package_contract_base_sha" \
      GITHUB_OUTPUT= bash "$validator_path" --classify-install
  ) > "$output" 2>&1
  assert_contains 'lane=standard' "$output"
  : > "$command_log"
  if ! run_fixture "$package_contract_base_sha" "$output" BASE_SHA="$package_contract_dependency_base_sha"; then
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'exec turbo run build --filter=@mastra/agent-builder... --concurrency=2' "$command_log"
  assert_contains '--filter ./packages/agent-builder --fail-if-no-match check' "$command_log"
  assert_contains '--filter ./packages/agent-builder --fail-if-no-match check:fixtures' "$command_log"
  assert_contains '--filter ./packages/agent-builder --fail-if-no-match lint' "$command_log"
  assert_contains 'src/agent-builder.test.ts' "$command_log"

  package_contract_head_sha="$(
    cd "$fixture_repo"
    printf '%s\n' 'export const generateTypes = false;' > packages/_types-builder/src/index.js
    printf '%s\n' 'export const replaceTypes = false;' > packages/_types-builder/src/replace-types.js
    printf '%s\n' "export default { format: ['esm', 'cjs'] };" > packages/agent-builder/tsdown.config.ts
    git add .
    git commit -q -m 'change owned package build sources without changing tests'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/package-contract-owned-sources.log"
  if ! run_fixture "$package_contract_head_sha" "$output" BASE_SHA="$package_contract_base_sha"; then
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'build:core' "$command_log"
  assert_contains '--filter ./packages/core --fail-if-no-match check' "$command_log"
  assert_contains 'exec tsc --project scripts/tsconfig.json --noEmit' "$command_log"
  assert_contains 'exec oxlint packages/_types-builder/src/index.js packages/_types-builder/src/replace-types.js' "$command_log"
  assert_line_count 1 'exec turbo run build --filter=@mastra/agent-builder... --concurrency=2' "$command_log"
  assert_contains "exec node $PACKED_DECLARATION_CHECK --package packages/agent-builder" "$command_log"
  assert_contains '--filter ./packages/agent-builder --fail-if-no-match check:fixtures' "$command_log"
  assert_contains 'scripts/types-builder.test.ts' "$command_log"
  assert_contains 'src/agent-builder.test.ts' "$command_log"

  for failed_command in \
    'build:core' \
    'exec tsc --project scripts/tsconfig.json --noEmit' \
    'exec turbo run build --filter=@mastra/agent-builder... --concurrency=2' \
    "exec node $PACKED_DECLARATION_CHECK --package packages/agent-builder" \
    '--filter ./packages/agent-builder --fail-if-no-match check' \
    '--filter ./packages/agent-builder --fail-if-no-match check:fixtures'; do
    output="$test_root/package-contract-command-failure.log"
    if run_fixture "$package_contract_head_sha" "$output" BASE_SHA="$package_contract_base_sha" \
      MOCK_FAIL_PACKAGE_CONTRACT_COMMAND="$failed_command"; then
      echo "Failed owning command unexpectedly passed: $failed_command" >&2
      exit 1
    fi
  done
  for rejected_case in scripts/types-builder.test.ts src/agent-builder.test.ts; do
    for failed_command in MOCK_FAIL_PACKAGE_CONTRACT_TEST MOCK_ZERO_PACKAGE_CONTRACT_TEST; do
      output="$test_root/package-contract-test-failure.log"
      if run_fixture "$package_contract_head_sha" "$output" BASE_SHA="$package_contract_base_sha" \
        "$failed_command=$rejected_case"; then
        echo "An unexecuted or failed owning test unexpectedly passed: $rejected_case ($failed_command)" >&2
        exit 1
      fi
    done
  done

  for rejected_case in types-builder-source agent-builder-source nested-test types-builder-manifest \
    deleted-generator symlink-generator excluded-generator deleted-builder symlink-builder; do
    head_sha="$(
      cd "$fixture_repo"
      git reset -q --hard "$package_contract_base_sha"
      case "$rejected_case" in
        types-builder-source) printf '%s\n' 'export const unknown = true;' > packages/_types-builder/src/unknown.js ;;
        agent-builder-source) printf '%s\n' 'export const unknown = true;' > packages/agent-builder/src/unknown.ts ;;
        nested-test) printf '%s\n' "it('external fixture', () => {});" > packages/agent-builder/integration-tests/src/unknown.test.ts ;;
        types-builder-manifest) printf '%s\n' '{"private":false}' > packages/_types-builder/package.json ;;
        deleted-generator) rm scripts/types-builder.test.ts ;;
        symlink-generator) rm scripts/types-builder.test.ts; ln -s missing.test.ts scripts/types-builder.test.ts ;;
        excluded-generator)
          printf '%s\n' 'export const generateTypes = false;' > packages/_types-builder/src/index.js
          printf '%s\n' '{"compilerOptions":{"strict":true,"noUncheckedIndexedAccess":true},"include":["types-builder.test.ts"],"exclude":["types-builder.test.ts"]}' \
            > scripts/tsconfig.json
          ;;
        deleted-builder) rm packages/agent-builder/src/agent-builder.test.ts ;;
        symlink-builder) rm packages/agent-builder/src/agent-builder.test.ts; ln -s missing.test.ts packages/agent-builder/src/agent-builder.test.ts ;;
      esac
      git add .
      git commit -q -m "reject $rejected_case"
      git rev-parse HEAD
    )"
    assert_package_contract_rejected "$head_sha" "$package_contract_base_sha" "$test_root/package-contract-$rejected_case.log"
  done

  for rejected_case in metadata script dependency lock-link lock-graph lock-other-importer fixture-exclusion; do
    head_sha="$(
      cd "$fixture_repo"
      git reset -q --hard "$package_contract_base_sha"
      node - "$rejected_case" <<'NODE'
const fs = require('node:fs');
const variant = process.argv[2];
const file = 'packages/agent-builder/package.json';
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
if (variant === 'metadata') manifest.description = 'unreviewed metadata';
if (variant === 'script') manifest.scripts.check = 'echo skipped';
if (variant === 'dependency') manifest.devDependencies['@mastra/core'] = 'latest';
fs.writeFileSync(file, JSON.stringify(manifest));
let lock = fs.readFileSync('pnpm-lock.yaml', 'utf8');
if (variant === 'lock-link') lock = lock.replace('link:../mcp', '1.0.0');
if (variant === 'lock-graph') lock = lock.replace('sha512-retained', 'sha512-changed');
if (variant === 'lock-other-importer') lock = lock.replace('specifier: ^1.26.0', 'specifier: ^1.27.0');
fs.writeFileSync('pnpm-lock.yaml', lock);
if (variant === 'fixture-exclusion') {
  const configFile = 'packages/agent-builder/tsconfig.fixtures.json';
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  config.exclude = ['**/*'];
  fs.writeFileSync(configFile, JSON.stringify(config));
}
NODE
      git add .
      git commit -q -m "reject fixture $rejected_case drift"
      git rev-parse HEAD
    )"
    output="$test_root/package-contract-$rejected_case-admission.log"
    if (
      cd "$fixture_repo"
      BASE_SHA="$package_contract_dependency_base_sha" HEAD_SHA="$head_sha" \
        GITHUB_OUTPUT= bash "$validator_path" --classify-install
    ) > "$output" 2>&1; then
      echo "Unsupported fixture $rejected_case drift passed install admission." >&2
      exit 1
    fi
    assert_package_contract_rejected "$head_sha" "$package_contract_dependency_base_sha" "$test_root/package-contract-$rejected_case-validation.log"
  done

  local schema_runtime_base_sha schema_runtime_case
  schema_runtime_base_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$package_contract_base_sha"
    mkdir -p packages/core/src/tools/tool-builder
    printf '%s\n' 'export const schema = {};' > packages/core/src/tools/tool-builder/builder.ts
    printf '%s\n' "import '../../../../core/src/tools/tool-builder/builder';" \
      >> packages/server/src/server/handlers/favorites.integration.test.ts
    git add .
    git commit -q -m 'prepare the native Tool Builder schema runtime fixture'
    git rev-parse HEAD
  )"
  for schema_runtime_case in named extra-value namespace default side-effect reexport require dynamic outside-owner; do
    head_sha="$(
      cd "$fixture_repo"
      git reset -q --hard "$schema_runtime_base_sha"
      node - "$schema_runtime_case" <<'NODE'
const fs = require('node:fs');
const variant = process.argv[2];
const file = 'packages/core/src/tools/tool-builder/builder.ts';
const named = "import { jsonSchema } from '@internal/ai-v6';\n";
const schema = 'export const schema = jsonSchema({ type: "object" });\n';
const extra = {
  named: "import type { Schema } from '@internal/ai-v6';\n",
  'extra-value': "import { generateText } from '@internal/ai-v6';\nvoid generateText;\n",
  namespace: "import * as sdk from '@internal/ai-v6';\nvoid sdk;\n",
  default: "import sdk from '@internal/ai-v6';\nvoid sdk;\n",
  'side-effect': "import '@internal/ai-v6';\n",
  reexport: "export { generateText } from '@internal/ai-v6';\n",
  require: "void require('@internal/ai-v6');\n",
  dynamic: "void import('@internal/ai-v6');\n",
};
if (variant === 'outside-owner') {
  fs.writeFileSync(file, "export { schema } from './schema-helper';\n");
  fs.writeFileSync('packages/core/src/tools/tool-builder/schema-helper.ts', named + schema);
} else {
  fs.writeFileSync(file, named + extra[variant] + schema);
}
NODE
      git add .
      git commit -q -m "exercise native schema import $schema_runtime_case"
      git rev-parse HEAD
    )"
    : > "$command_log"
    output="$test_root/package-contract-schema-runtime-$schema_runtime_case.log"
    if [[ "$schema_runtime_case" == named ]]; then
      if ! run_fixture "$head_sha" "$output" BASE_SHA="$schema_runtime_base_sha"; then
        cat "$output" >&2
        exit 1
      fi
      assert_contains 'Running changed test file in full: packages/server/src/server/handlers/favorites.integration.test.ts' "$output"
      schema_runtime_base_sha="$head_sha"
    else
      if run_fixture "$head_sha" "$output" BASE_SHA="$schema_runtime_base_sha"; then
        echo "Unsupported native schema import unexpectedly passed: $schema_runtime_case" >&2
        cat "$output" >&2
        exit 1
      fi
      assert_contains 'unreviewed external module @internal/ai-v6' "$output"
      assert_not_contains 'Running changed test file in full:' "$output"
    fi
  done
  git -C "$fixture_repo" reset -q --hard "$base_sha"
  echo 'Package contract ownership, native command, fixture metadata, and fail-closed validation fixtures passed.'
  if [[ "${1:-}" == '--package-contracts-only' ]]; then
    return
  fi

  pf3553_base_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    mkdir -p \
      docs/src/content/en/docs/server \
      packages/server/src/server/server-adapter/routes \
      server-adapters/fastify/src
    printf '%s\n' '{}' > docs/package.json
    cat > packages/server/package.json <<'JSON'
{
  "name": "@mastra/server",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.cjs"
      }
    },
    "./server-adapter": {
      "import": {
        "types": "./dist/server/server-adapter/index.d.ts",
        "default": "./dist/server/server-adapter/index.js"
      },
      "require": {
        "types": "./dist/server/server-adapter/index.d.ts",
        "default": "./dist/server/server-adapter/index.cjs"
      }
    }
  },
  "scripts": {
    "build:lib": "trusted-server-build",
    "lint": "trusted-server-lint",
    "test": "trusted-server-test"
  },
  "dependencies": {
    "hono": "^4.0.0"
  }
}
JSON
    cat > server-adapters/fastify/package.json <<'JSON'
{
  "name": "@mastra/fastify",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.cjs"
      }
    }
  },
  "scripts": {
    "build": "trusted-fastify-build",
    "lint": "trusted-fastify-lint",
    "test": "trusted-fastify-test"
  },
  "dependencies": {
    "@mastra/server": "workspace:*"
  }
}
JSON
    printf '%s\n' 'base adapter documentation' \
      > docs/src/content/en/docs/server/server-adapters.mdx
    printf '%s\n' 'base server adapter test' \
      > packages/server/src/server/server-adapter/index.test.ts
    printf '%s\n' 'base server adapter' \
      > packages/server/src/server/server-adapter/index.ts
    printf '%s\n' 'base Harness routes' \
      > packages/server/src/server/server-adapter/routes/harness.ts
    printf '%s\n' 'base Server build configuration' > packages/server/tsdown.config.ts
    printf '%s\n' 'base Fastify adapter' > server-adapters/fastify/src/index.ts
    printf '%s\n' 'base Fastify build configuration' > server-adapters/fastify/tsdown.config.ts
    rm -rf \
      .changeset/calm-routes-select.md \
      .changeset/lean-fastify-select.md \
      packages/server/src/server/server-adapter/selected-import-closure.test.ts \
      packages/server/src/server/server-adapter/selected.test.ts \
      packages/server/src/server/server-adapter/selected.ts \
      server-adapters/fastify/src/__tests__/selected-import-closure.test.ts \
      server-adapters/fastify/src/__tests__/selected-package-exports.test.ts \
      server-adapters/fastify/src/__tests__/selected-routes.test.ts \
      server-adapters/fastify/src/selected.ts \
      server-adapters/fastify/test-fixtures/selected-package-types
    git add -A
    git commit -q -m 'PF-3553 fixture base manifests'
    git rev-parse HEAD
  )"
  pf3553_base_surface_sha256="$(
    cd "$fixture_repo"
    pf3553_surface_digest "$pf3553_base_sha"
  )"

  pf3553_head_sha="$(
    cd "$fixture_repo"
    cat > packages/server/package.json <<'JSON'
{
  "name": "@mastra/server",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.cjs"
      }
    },
    "./server-adapter": {
      "import": {
        "types": "./dist/server/server-adapter/index.d.ts",
        "default": "./dist/server/server-adapter/index.js"
      },
      "require": {
        "types": "./dist/server/server-adapter/index.d.ts",
        "default": "./dist/server/server-adapter/index.cjs"
      }
    },
    "./server-adapter/selected": {
      "import": {
        "types": "./dist/server/server-adapter/selected.d.ts",
        "default": "./dist/server/server-adapter/selected.js"
      },
      "require": {
        "types": "./dist/server/server-adapter/selected.d.ts",
        "default": "./dist/server/server-adapter/selected.cjs"
      }
    },
    "./server-adapter/routes/harness": {
      "import": {
        "types": "./dist/server/server-adapter/routes/harness.d.ts",
        "default": "./dist/server/server-adapter/routes/harness.js"
      },
      "require": {
        "types": "./dist/server/server-adapter/routes/harness.d.ts",
        "default": "./dist/server/server-adapter/routes/harness.cjs"
      }
    }
  },
  "scripts": {
    "build:lib": "trusted-server-build",
    "lint": "trusted-server-lint",
    "test": "trusted-server-test"
  },
  "dependencies": {
    "hono": "^4.0.0"
  }
}
JSON
    cat > server-adapters/fastify/package.json <<'JSON'
{
  "name": "@mastra/fastify",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.cjs"
      }
    },
    "./selected": {
      "import": {
        "types": "./dist/selected.d.ts",
        "default": "./dist/selected.js"
      },
      "require": {
        "types": "./dist/selected.d.ts",
        "default": "./dist/selected.cjs"
      }
    }
  },
  "scripts": {
    "build": "trusted-fastify-build",
    "lint": "trusted-fastify-lint",
    "test": "trusted-fastify-test"
  },
  "dependencies": {
    "@mastra/server": "workspace:*"
  }
}
JSON
    mkdir -p \
      .changeset \
      packages/server/src/server/server-adapter \
      server-adapters/fastify/src/__tests__ \
      server-adapters/fastify/test-fixtures/selected-package-types
    printf '%s\n' 'reviewed Server changeset' > .changeset/calm-routes-select.md
    printf '%s\n' 'reviewed Fastify changeset' > .changeset/lean-fastify-select.md
    printf '%s\n' 'reviewed adapter documentation' \
      > docs/src/content/en/docs/server/server-adapters.mdx
    printf '%s\n' 'reviewed HTTP logging test' \
      > packages/server/src/server/server-adapter/http-logging.test.ts
    printf '%s\n' 'reviewed server adapter test' \
      > packages/server/src/server/server-adapter/index.test.ts
    printf '%s\n' 'reviewed server adapter' \
      > packages/server/src/server/server-adapter/index.ts
    printf '%s\n' 'reviewed Harness routes' \
      > packages/server/src/server/server-adapter/routes/harness.ts
    printf '%s\n' 'reviewed selected Server import test' \
      > packages/server/src/server/server-adapter/selected-import-closure.test.ts
    printf '%s\n' 'reviewed selected Server test' \
      > packages/server/src/server/server-adapter/selected.test.ts
    printf '%s\n' 'reviewed selected Server adapter' \
      > packages/server/src/server/server-adapter/selected.ts
    printf '%s\n' 'reviewed Server build configuration' > packages/server/tsdown.config.ts
    printf '%s\n' 'reviewed selected Fastify import test' \
      > server-adapters/fastify/src/__tests__/selected-import-closure.test.ts
    printf '%s\n' 'reviewed selected package exports test' \
      > server-adapters/fastify/src/__tests__/selected-package-exports.test.ts
    printf '%s\n' 'reviewed selected Fastify routes test' \
      > server-adapters/fastify/src/__tests__/selected-routes.test.ts
    printf '%s\n' 'reviewed Fastify adapter' > server-adapters/fastify/src/index.ts
    printf '%s\n' 'reviewed selected Fastify adapter' > server-adapters/fastify/src/selected.ts
    printf '%s\n' 'reviewed CommonJS type consumer' \
      > server-adapters/fastify/test-fixtures/selected-package-types/consumer.cts
    printf '%s\n' 'reviewed ESM type consumer' \
      > server-adapters/fastify/test-fixtures/selected-package-types/consumer.mts
    printf '%s\n' '{"compilerOptions":{"module":"NodeNext"}}' \
      > server-adapters/fastify/test-fixtures/selected-package-types/tsconfig.json
    printf '%s\n' 'reviewed Fastify build configuration' \
      > server-adapters/fastify/tsdown.config.ts
    git add -A
    git commit -q -m 'PF-3553 exact export maps'
    git rev-parse HEAD
  )"
  pf3553_head_surface_sha256="$(
    cd "$fixture_repo"
    pf3553_surface_digest "$pf3553_head_sha"
  )"
  : > "$command_log"
  output="$test_root/pf3553-command-owner-success.log"
  set +e
  run_fixture "$pf3553_head_sha" "$output" \
    BASE_SHA="$pf3553_base_sha" \
    PAPERSFLOW_PF3553_BASE_SURFACE_SHA256="$pf3553_base_surface_sha256" \
    PAPERSFLOW_PF3553_HEAD_SURFACE_SHA256="$pf3553_head_surface_sha256"
  status=$?
  set -e
  if (( status != 0 )); then
    echo 'Exact PF-3553 command-owner fixture failed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains '--filter ./packages/server --fail-if-no-match build:lib' "$command_log"
  assert_contains '--filter ./packages/server --fail-if-no-match exec tsc --noEmit' "$command_log"
  assert_contains '--filter ./packages/server --fail-if-no-match lint' "$command_log"
  assert_contains '--filter ./packages/server --fail-if-no-match check:core-imports' "$command_log"
  assert_contains 'build:server' "$command_log"
  assert_contains '--filter @mastra/server lint' "$command_log"
  assert_contains '--filter @mastra/server check:core-imports' "$command_log"
  assert_contains '--filter @mastra/server check:permissions' "$command_log"
  assert_contains '--filter @mastra/server generate:route-types' "$command_log"
  assert_contains '--filter @mastra/server generate:api-cli-route-metadata' "$command_log"
  assert_line_count 1 \
    '--filter ./stores/libsql --fail-if-no-match build:lib' \
    "$command_log"
  assert_line_count 1 \
    '--filter ./observability/mastra --fail-if-no-match build' \
    "$command_log"
  assert_line_count 1 \
    '--filter ./packages/mcp --fail-if-no-match build:lib' \
    "$command_log"
  assert_line_count 1 \
    '--dir server-adapters/fastify exec tsc-files --noEmit src/index.ts src/selected.ts src/__tests__/selected-import-closure.test.ts src/__tests__/selected-package-exports.test.ts src/__tests__/selected-routes.test.ts' \
    "$command_log"
  assert_line_count 1 \
    '--filter ./server-adapters/fastify --fail-if-no-match build' \
    "$command_log"
  assert_line_count 1 \
    '--filter ./server-adapters/fastify --fail-if-no-match lint' \
    "$command_log"
  assert_line_matches \
    '^--dir server-adapters/fastify exec vitest run --reporter=dot --reporter=json --outputFile\.json=' \
    "$command_log"
  for reviewed_server_test in \
    src/server/server-adapter/http-logging.test.ts \
    src/server/server-adapter/index.test.ts \
    src/server/server-adapter/selected-import-closure.test.ts \
    src/server/server-adapter/selected.test.ts; do
    assert_line_matches \
      "^--dir packages/server exec vitest run --reporter=dot --reporter=json --outputFile\\.json=.* ${reviewed_server_test}$" \
      "$command_log"
    assert_line_matches \
      "^OPENAI_API_KEY=[[:space:]]--dir packages/server exec vitest run --reporter=dot --reporter=json --outputFile\\.json=.* ${reviewed_server_test}$" \
      "$command_environment_log"
  done
  rm -rf -- \
    "$fixture_repo/packages/server/dist" \
    "$fixture_repo/server-adapters/fastify/dist"

  pf3553_lane_spoof_head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$pf3553_head_sha"
    node - <<'NODE'
const fs = require('node:fs');
const path = 'server-adapters/fastify/package.json';
const manifest = JSON.parse(fs.readFileSync(path, 'utf8'));
manifest.scripts.preinstall = 'untrusted-lifecycle';
fs.writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
NODE
    git add server-adapters/fastify/package.json
    git commit -q -m 'spoof PF-3553 lane with lifecycle mutation'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/pf3553-lane-spoof-failure.log"
  set +e
  run_fixture "$pf3553_lane_spoof_head_sha" "$output" \
    BASE_SHA="$pf3553_base_sha" \
    PAPERSFLOW_PF3553_BASE_SURFACE_SHA256="$pf3553_base_surface_sha256" \
    PAPERSFLOW_PF3553_HEAD_SURFACE_SHA256="$pf3553_head_surface_sha256" \
    VALIDATION_LANE=pf3553-selected-route-exports
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Spoofed PF-3553 lane with changed lifecycle metadata unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'PF-3553 selected-route export admission failed:' "$output"
  assert_contains 'server-adapters/fastify/package.json' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Spoofed PF-3553 lane executed PR-controlled package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi
  git -C "$fixture_repo" reset -q --hard "$base_sha"

  head_sha="$(
    cd "$fixture_repo"
    printf '%s\n' "export const route = 'head';" > packages/server/src/server/server-adapter/routes/index.ts
    printf '%s\n' 'export type RouteTypes = { source: "head" };' \
      'export type HarnessRoute = { source: "head" };' \
      'export type IndexOnlyRoute = { source: "head" };' \
      > client-sdks/client-js/src/route-types.generated.ts
    printf '%s\n' "export const routeMetadata = 'head';" > packages/cli/src/commands/api/route-metadata.generated.ts
    git add .
    git commit -q -m 'server route change'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/server-success.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status != 0 )); then
    echo 'Server route command-owner fixture failed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains '--filter @mastra/server check:permissions' "$command_log"
  assert_contains '--filter @mastra/server generate:route-types' "$command_log"
  assert_contains '--filter @mastra/server generate:api-cli-route-metadata' "$command_log"
  assert_contains 'Client SDK route consumers accept generated route types.' "$output"
  assert_route_consumer_commands
  assert_contains 'src/server/server-adapter/schema-consistency.test.ts' "$command_log"
  assert_contains 'src/server/server-adapter/api-schema-manifest.test.ts' "$command_log"

  server_root_core_imports_base_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' '{"scripts":{"check:core-imports":"tsx scripts/check-core-imports.ts"}}' > package.json
    git add package.json
    git commit -q -m 'root owns the core import check'
    git rev-parse HEAD
  )"
  server_root_core_imports_head_sha="$(
    cd "$fixture_repo"
    printf '%s\n' "export const route = 'head';" > packages/server/src/server/server-adapter/routes/index.ts
    git add packages/server/src/server/server-adapter/routes/index.ts
    git commit -q -m 'server route change with root core import check'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/server-root-core-imports-success.log"
  run_fixture "$server_root_core_imports_head_sha" "$output" BASE_SHA="$server_root_core_imports_base_sha"
  assert_line_count 2 'run check:core-imports packages/server' "$command_log"
  assert_not_contains '--filter ./packages/server --fail-if-no-match check:core-imports' "$command_log"
  assert_not_contains '--filter @mastra/server check:core-imports' "$command_log"

  : > "$command_log"
  output="$test_root/server-root-core-imports-failure.log"
  set +e
  run_fixture "$server_root_core_imports_head_sha" "$output" \
    BASE_SHA="$server_root_core_imports_base_sha" MOCK_FAIL_CORE_IMPORTS=1
  status=$?
  set -e
  if (( status != 23 )); then
    echo 'Root core import check failure did not propagate its exit status.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_line_count 1 'run check:core-imports packages/server' "$command_log"
  assert_not_contains '--filter ./packages/server --fail-if-no-match check:core-imports' "$command_log"
  assert_not_contains '--filter @mastra/server check:core-imports' "$command_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' '{"scripts":{"build:lib":"true"}}' > packages/server/package.json
    git add .
    git commit -q -m 'change Server package scripts'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/server-package-manifest-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Changed Server package manifest unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'packages/server/package.json' "$output"
  assert_contains 'require dedicated validation' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Changed Server package manifest fixture executed PR-controlled package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "export const permission = 'head';" \
      > packages/core/src/auth/ee/interfaces/permissions.generated.ts
    git add .
    git commit -q -m 'generated permissions only'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/generated-permissions-only.log"
  run_fixture "$head_sha" "$output"
  assert_contains 'packages/server' "$output"
  assert_contains '--filter @mastra/server check:permissions' "$command_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    git mv \
      packages/core/src/auth/ee/interfaces/permissions.generated.ts \
      packages/core/src/auth/ee/interfaces/permissions-renamed.ts
    git commit -q -m 'rename generated permissions artifact'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/generated-permissions-rename.log"
  run_fixture "$head_sha" "$output"
  assert_contains 'packages/server' "$output"
  assert_contains '--filter @mastra/server check:permissions' "$command_log"

  : > "$command_log"
  output="$test_root/permission-failure.log"
  set +e
  run_fixture "$head_sha" "$output" MOCK_FAIL_PERMISSIONS=1
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Permission freshness fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains '--filter @mastra/server check:permissions' "$command_log"

  : > "$command_log"
  output="$test_root/generated-failure.log"
  set +e
  run_fixture "$head_sha" "$output" MOCK_STALE_ROUTE_TYPES=1
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Stale generated route artifact fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'Generated Server route artifacts are stale or missing from the pull request.' "$output"

  git -C "$fixture_repo" reset -q --hard "$head_sha"
  : > "$command_log"
  output="$test_root/cli-generated-failure.log"
  set +e
  run_fixture "$head_sha" "$output" MOCK_STALE_CLI_METADATA=1
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Stale generated CLI route metadata fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'Generated Server route artifacts are stale or missing from the pull request.' "$output"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export type RouteTypes = { source: "head" };' \
      'export type HarnessRoute = { source: "head" };' \
      'export type IndexOnlyRoute = { source: "head" };' \
      > client-sdks/client-js/src/route-types.generated.ts
    git add .
    git commit -q -m 'generated route types only'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/generated-route-types-only.log"
  run_fixture "$head_sha" "$output"
  assert_contains 'packages/server' "$output"
  assert_contains '--filter @mastra/server generate:route-types' "$command_log"
  assert_contains '--filter @mastra/server generate:api-cli-route-metadata' "$command_log"
  assert_contains 'Client SDK route consumers accept generated route types.' "$output"
  assert_route_consumer_commands

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export type RouteTypes = { source: "head" };' \
      'export type HarnessRoute = { source: "head" };' \
      > client-sdks/client-js/src/route-types.generated.ts
    git add .
    git commit -q -m 'drop an index-only generated route export'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/generated-index-export-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Missing public generated route export unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'Client SDK index references missing generated exports: IndexOnlyRoute' "$output"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "export const routeMetadata = 'head';" > packages/cli/src/commands/api/route-metadata.generated.ts
    git add .
    git commit -q -m 'generated CLI metadata only'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/generated-cli-metadata-only.log"
  run_fixture "$head_sha" "$output"
  assert_contains 'packages/server' "$output"
  assert_contains '--filter @mastra/server generate:route-types' "$command_log"
  assert_contains '--filter @mastra/server generate:api-cli-route-metadata' "$command_log"
  assert_contains 'Client SDK route consumers accept generated route types.' "$output"
  assert_route_consumer_commands

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    git rm -q client-sdks/client-js/src/route-types.generated.ts
    git commit -q -m 'delete generated route types'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/deleted-route-types.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Deleted generated route types fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'packages/server' "$output"
  assert_contains 'Generated Server route artifacts are stale or missing from the pull request.' "$output"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "import '@playwright/test';" \
      >> packages/server/src/server/handlers/favorites.integration.test.ts
    git add .
    git commit -q -m 'make favorites test require Playwright'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/favorites-playwright-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Playwright-dependent favorites fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'packages/server/src/server/handlers/favorites.integration.test.ts' "$output"
  assert_contains 'Failing closed instead of reporting incomplete validation as successful.' "$output"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "import { z } from 'zod';" 'void z;' \
      >> packages/server/src/server/handlers/favorites.integration.test.ts
    git add .
    git commit -q -m 'make favorites test use an approved external module'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/favorites-approved-external-success.log"
  run_fixture "$head_sha" "$output"
  assert_line_matches \
    '^--dir packages/server exec vitest run .* src/server/handlers/favorites\.integration\.test\.ts$' \
    "$command_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "import { createOpenAI } from '@ai-sdk/openai';" \
      >> packages/server/src/server/handlers/favorites.integration.test.ts
    git add .
    git commit -q -m 'make favorites test import AI SDK provider'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/favorites-ai-sdk-provider-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'AI SDK provider fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'packages/server/src/server/handlers/favorites.integration.test.ts' "$output"
  assert_contains 'module @ai-sdk/openai' "$output"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "import { run } from '@openai/agents';" \
      >> packages/server/src/server/handlers/favorites.integration.test.ts
    git add .
    git commit -q -m 'make favorites test import scoped OpenAI agents SDK'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/favorites-openai-agents-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Scoped OpenAI agents fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'packages/server/src/server/handlers/favorites.integration.test.ts' "$output"
  assert_contains 'module @openai/agents' "$output"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "import { openai } from '@mastra/openai';" \
      >> packages/server/src/server/handlers/favorites.integration.test.ts
    git add .
    git commit -q -m 'make favorites test import Mastra OpenAI provider'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/favorites-mastra-openai-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Mastra OpenAI provider fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'packages/server/src/server/handlers/favorites.integration.test.ts' "$output"
  assert_contains 'module @mastra/openai' "$output"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "import { dormantExternalFixture } from './dormant-external-helper';" \
      >> packages/server/src/server/handlers/favorites.integration.test.ts
    git add .
    git commit -q -m 'make a dormant external helper newly reachable'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/favorites-dormant-external-helper-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Newly reachable dormant external helper unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'packages/server/src/server/handlers/favorites.integration.test.ts' "$output"
  assert_contains 'Failing closed instead of reporting incomplete validation as successful.' "$output"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "import { OpenAIVoice } from '@mastra/voice-openai';" \
      >> packages/server/src/server/handlers/favorites.integration.test.ts
    git add .
    git commit -q -m 'make favorites test require a voice provider'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/favorites-voice-provider-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Voice-provider favorites fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'packages/server/src/server/handlers/favorites.integration.test.ts' "$output"
  assert_contains 'Failing closed instead of reporting incomplete validation as successful.' "$output"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "void import('./favorites-network-helper.js', { with: {} });" \
      >> packages/server/src/server/handlers/favorites.integration.test.ts
    printf '%s\n' "import { createServer } from 'node:http';" \
      'export const networkFixture = createServer;' \
      > packages/server/src/server/handlers/favorites-network-helper.ts
    git add .
    git commit -q -m 'add unsafe dynamic import with options'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/favorites-dynamic-import-options-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Unsafe dynamic import-with-options fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'packages/server/src/server/handlers/favorites.integration.test.ts' "$output"
  assert_contains 'Failing closed instead of reporting incomplete validation as successful.' "$output"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "import { createServer } from 'node:http2';" \
      >> packages/server/src/server/handlers/favorites.integration.test.ts
    git add .
    git commit -q -m 'make favorites test require an HTTP2 server'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/favorites-http2-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'HTTP2-dependent favorites fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'packages/server/src/server/handlers/favorites.integration.test.ts' "$output"
  assert_contains 'Failing closed instead of reporting incomplete validation as successful.' "$output"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "import { networkFixture } from './favorites-network-helper.js';" \
      >> packages/server/src/server/handlers/favorites-helper.ts
    printf '%s\n' "import { createServer } from 'http';" \
      'export const networkFixture = createServer;' \
      > packages/server/src/server/handlers/favorites-network-helper.ts
    git add .
    git commit -q -m 'add transitive unsafe favorites helper'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/favorites-transitive-helper-runtime-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Unsafe transitive favorites helper fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'packages/server/src/server/handlers/favorites.integration.test.ts' "$output"
  assert_contains 'Failing closed instead of reporting incomplete validation as successful.' "$output"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "// Documentation example only: import './not-a-real-module';" \
      >> packages/server/src/server/handlers/favorites.integration.test.ts
    git add .
    git commit -q -m 'add import example comment'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/favorites-comment-import-success.log"
  run_fixture "$head_sha" "$output"
  assert_contains \
    'Running changed test file in full: packages/server/src/server/handlers/favorites.integration.test.ts' \
    "$output"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "import { createServer } from 'http';" \
      'export const serverFixture = createServer;' \
      > packages/server/src/server/handlers/server-network-helper.ts
    printf '%s\n' "import { it } from 'vitest';" \
      "import { serverFixture } from './server-network-helper.js';" \
      "it('server helper', () => serverFixture);" \
      > packages/server/src/server/handlers/server-helper.test.ts
    git add .
    git commit -q -m 'add unsafe Server unit-test helper'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/server-unit-helper-runtime-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Unsafe Server unit-test helper fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'packages/server/src/server/handlers/server-helper.test.ts' "$output"
  assert_contains 'Failing closed instead of reporting incomplete validation as successful.' "$output"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "import { execSync } from 'child_process';" \
      >> packages/server/src/server/handlers/favorites.integration.test.ts
    git add .
    git commit -q -m 'make favorites test execute a bare process import'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/favorites-bare-process-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Bare process import in favorites fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'packages/server/src/server/handlers/favorites.integration.test.ts' "$output"
  assert_contains 'Failing closed instead of reporting incomplete validation as successful.' "$output"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "import { createServer } from 'http';" \
      >> packages/server/src/server/handlers/favorites-helper.ts
    git add .
    git commit -q -m 'make imported favorites helper require a network primitive'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/favorites-helper-runtime-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Unsafe imported favorites helper fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'packages/server/src/server/handlers/favorites.integration.test.ts' "$output"
  assert_contains 'Failing closed instead of reporting incomplete validation as successful.' "$output"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "import { GenericContainer } from 'testcontainers';" \
      "import { it } from 'vitest';" "it('container test', () => GenericContainer);" \
      > packages/server/src/server/handlers/container.test.ts
    git add .
    git commit -q -m 'add non-fork-safe Server unit test'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/server-unit-runtime-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Unsafe Server unit-test fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'packages/server/src/server/handlers/container.test.ts' "$output"
  assert_contains 'Failing closed instead of reporting incomplete validation as successful.' "$output"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'const providerApiKey = process.env.PROVIDER_API_KEY;' \
      >> packages/core/src/harness/v1/session.real-agent.e2e.test.ts
    git add .
    git commit -q -m 'make Harness test require provider credentials'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/harness-provider-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Provider-dependent Harness fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'packages/core/src/harness/v1/session.real-agent.e2e.test.ts' "$output"
  assert_contains 'Failing closed instead of reporting incomplete validation as successful.' "$output"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const helperUpdate = true;' \
      >> packages/core/src/harness/v1/agent-helper.ts
    git add .
    git commit -q -m 'safe Harness runtime dependency change'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/harness-success.log"
  run_fixture "$head_sha" "$output"
  assert_contains \
    'Running changed test file in full: packages/core/src/harness/v1/session.real-agent.e2e.test.ts' \
    "$output"
  assert_contains 'src/harness/v1/session.real-agent.e2e.test.ts' "$command_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "it('durable background update', () => {});" \
      >> packages/core/src/agent/durable/__tests__/durable-agent-background-tasks.e2e.test.ts
    git add .
    git commit -q -m 'safe durable background E2E change'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/durable-background-success.log"
  run_fixture "$head_sha" "$output"
  assert_contains \
    'Running changed test file in full: packages/core/src/agent/durable/__tests__/durable-agent-background-tasks.e2e.test.ts' \
    "$output"
  assert_contains 'src/agent/durable/__tests__/durable-agent-background-tasks.e2e.test.ts' "$command_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'const providerApiKey = process.env.PROVIDER_API_KEY;' \
      >> packages/core/src/agent/durable/__tests__/durable-agent-background-tasks.e2e.test.ts
    git add .
    git commit -q -m 'make durable background E2E require provider credentials'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/durable-background-provider-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Provider-dependent durable background fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'packages/core/src/agent/durable/__tests__/durable-agent-background-tasks.e2e.test.ts' "$output"
  assert_contains 'Failing closed instead of reporting incomplete validation as successful.' "$output"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    git rm -q packages/cli/src/commands/api/route-metadata.generated.ts
    git commit -q -m 'delete generated CLI metadata'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/deleted-cli-metadata.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Deleted generated CLI metadata fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'packages/server' "$output"
  assert_contains 'Generated Server route artifacts are stale or missing from the pull request.' "$output"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "it('favorites update', () => {});" \
      >> packages/server/src/server/handlers/favorites.integration.test.ts
    git add .
    git commit -q -m 'favorites integration change'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/favorites-success.log"
  run_fixture "$head_sha" "$output"
  assert_contains \
    'Running changed test file in full: packages/server/src/server/handlers/favorites.integration.test.ts' \
    "$output"
  assert_line_matches \
    '^--dir packages/server exec vitest run .* src/server/handlers/favorites\.integration\.test\.ts$' \
    "$command_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "it('external update', () => {});" \
      >> packages/server/src/server/handlers/external.integration.test.ts
    git add .
    git commit -q -m 'unsupported integration change'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/integration-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Non-allowlisted integration fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'packages/server/src/server/handlers/external.integration.test.ts' "$output"
  assert_contains 'Failing closed instead of reporting incomplete validation as successful.' "$output"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      'services:' \
      '  inngest-test:' \
      '    image: inngest/inngest:v1.34.0' \
      '    container_name: mastra-inngest-test' \
      '    command: inngest dev -p 4200 -u http://host.docker.internal:4201/inngest/api --poll-interval=1' \
      '    ports:' \
      "      - '4200:4200'" \
      '    extra_hosts:' \
      "      - 'host.docker.internal:host-gateway'" \
      > workflows/inngest/docker-compose.yaml
    printf '%s\n' \
      'export const INNGEST_PORT = 4200;' \
      'export const HANDLER_PORT = 4201;' \
      > workflows/inngest/src/__tests__/adapters/_utils.ts
    printf '%s\n' \
      "import { it } from 'vitest';" \
      'const createLocalTestEndpoints = (ports: unknown) => ports;' \
      'const LOCAL_TEST_ENDPOINTS = createLocalTestEndpoints({ inngestPort: 4200, handlerPort: 4201 });' \
      "it('fixed self-hosting topology', () => LOCAL_TEST_ENDPOINTS);" \
      > workflows/inngest/src/index.test.ts
    git add .
    git commit -q -m 'paired Inngest self-hosting topology change'
    git rev-parse HEAD
  )"
  inngest_trio_head_sha="$head_sha"
  fixture_inngest_test_blob="$(git -C "$fixture_repo" rev-parse "$head_sha:workflows/inngest/src/index.test.ts")"
  fixture_inngest_test_sha="$(git -C "$fixture_repo" show "$head_sha:workflows/inngest/src/index.test.ts" | sha256sum | awk '{print $1}')"
  fixture_inngest_compose_blob="$(git -C "$fixture_repo" rev-parse "$head_sha:workflows/inngest/docker-compose.yaml")"
  fixture_inngest_compose_sha="$(git -C "$fixture_repo" show "$head_sha:workflows/inngest/docker-compose.yaml" | sha256sum | awk '{print $1}')"
  fixture_inngest_adapter_blob="$(git -C "$fixture_repo" rev-parse "$head_sha:workflows/inngest/src/__tests__/adapters/_utils.ts")"
  fixture_inngest_adapter_sha="$(git -C "$fixture_repo" show "$head_sha:workflows/inngest/src/__tests__/adapters/_utils.ts" | sha256sum | awk '{print $1}')"
  : > "$command_log"
  : > "$docker_log"
  : > "$service_log"
  output="$test_root/inngest-paired-topology-success.log"
  run_fixture "$head_sha" "$output" \
    PAPERSFLOW_PF2042_INNGEST_TEST_BLOB="$fixture_inngest_test_blob" \
    PAPERSFLOW_PF2042_INNGEST_TEST_SHA256="$fixture_inngest_test_sha" \
    PAPERSFLOW_PF2042_INNGEST_COMPOSE_BLOB="$fixture_inngest_compose_blob" \
    PAPERSFLOW_PF2042_INNGEST_COMPOSE_SHA256="$fixture_inngest_compose_sha" \
    PAPERSFLOW_PF2042_INNGEST_ADAPTER_BLOB="$fixture_inngest_adapter_blob" \
    PAPERSFLOW_PF2042_INNGEST_ADAPTER_SHA256="$fixture_inngest_adapter_sha"
  assert_contains 'compose -f workflows/inngest/docker-compose.yaml config --quiet' "$docker_log"
  assert_contains 'PF-2042 exact Inngest test/Compose/adapter trio: deferring the package-wide typecheck and build baseline to PF-2051.' "$output"
  assert_contains 'exec eslint workflows/inngest/src/index.test.ts workflows/inngest/src/__tests__/adapters/_utils.ts' "$command_log"
  assert_contains '--filter ./packages/deployer --fail-if-no-match build:lib' "$command_log"
  assert_contains '--filter ./stores/libsql --fail-if-no-match build:lib' "$command_log"
  assert_contains '--filter ./observability/mastra --fail-if-no-match build' "$command_log"
  assert_contains 'inngest-dev-server 127.0.0.1:4200' "$service_log"
  assert_not_contains '--filter ./workflows/inngest --fail-if-no-match exec tsc --noEmit' "$command_log"
  assert_not_contains '--filter ./workflows/inngest --fail-if-no-match build' "$command_log"
  assert_not_contains '--filter ./workflows/inngest --fail-if-no-match lint' "$command_log"
  assert_contains '--dir workflows/inngest exec vitest run --reporter=dot --reporter=json' "$command_log"
  assert_contains 'src/index.test.ts' "$command_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$inngest_trio_head_sha"
    printf '%s\n' \
      'services:' \
      '  inngest-test:' \
      '    image: inngest/inngest:v1.34.0@sha256:fixture' \
      '    network_mode: host' \
      '    command: inngest dev -p 4200 -u http://127.0.0.1:4201/inngest/api --poll-interval=1' \
      > workflows/inngest/docker-compose.yaml
    printf '%s\n' \
      'export const INNGEST_PORT = 4200;' \
      'export const HANDLER_PORT = 4201;' \
      'export const ADAPTER_TEST_ENDPOINTS = Object.freeze({ clientBaseUrl: "http://localhost:4200" });' \
      > workflows/inngest/src/__tests__/adapters/_utils.ts
    printf '%s\n' \
      "import { it } from 'vitest';" \
      "import { InngestTestRuntimeManager } from './__tests__/inngest-test-runtime';" \
      'const runtime = new InngestTestRuntimeManager();' \
      "it('manager-owned live inngest', () => runtime);" \
      > workflows/inngest/src/index.test.ts
    printf '%s\n' \
      'export class InngestTestRuntimeManager {' \
      '  stop() { return Promise.resolve(); }' \
      '}' \
      > workflows/inngest/src/__tests__/inngest-test-runtime.ts
    printf '%s\n' \
      "import { it } from 'vitest';" \
      "import { InngestTestRuntimeManager } from './inngest-test-runtime';" \
      "it('owns one pinned Docker lifecycle', () => new InngestTestRuntimeManager());" \
      > workflows/inngest/src/__tests__/inngest-test-runtime.test.ts
    node - <<'NODE'
const fs = require('node:fs');

const manifestPath = 'workflows/inngest/package.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
delete manifest.scripts['test:docker'];
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);

const workflowPath = '.github/workflows/papersflow-fork-pr.yml';
let workflow = fs.readFileSync(workflowPath, 'utf8');
for (const name of [
  'Start pinned Inngest dev server when index suite is owned',
  'Stop pinned Inngest dev server',
]) {
  const marker = `\n      - name: ${name}\n`;
  const start = workflow.indexOf(marker);
  const nextStep = workflow.indexOf('\n      - name: ', start + marker.length);
  workflow = workflow.slice(0, start) + (nextStep < 0 ? '' : workflow.slice(nextStep));
}
fs.writeFileSync(workflowPath, workflow);
NODE
    git add \
      .github/workflows/papersflow-fork-pr.yml \
      workflows/inngest/docker-compose.yaml \
      workflows/inngest/package.json \
      workflows/inngest/src/__tests__/adapters/_utils.ts \
      workflows/inngest/src/__tests__/inngest-test-runtime.test.ts \
      workflows/inngest/src/__tests__/inngest-test-runtime.ts \
      workflows/inngest/src/index.test.ts
    git commit -q -m 'move Inngest lifecycle under one runtime manager'
    git rev-parse HEAD
  )"
  inngest_pf2050_head_sha="$head_sha"
  : > "$command_log"
  : > "$docker_log"
  : > "$service_log"
  output="$test_root/inngest-pf2050-manager-success.log"
  run_fixture "$inngest_pf2050_head_sha" "$output"
  assert_contains 'compose -f workflows/inngest/docker-compose.yaml config --quiet' "$docker_log"
  assert_not_contains \
    'PF-2042 exact Inngest test/Compose/adapter trio: deferring the package-wide typecheck and build baseline to PF-2051.' \
    "$output"
  assert_contains '--filter ./workflows/inngest --fail-if-no-match exec tsc --noEmit' "$command_log"
  assert_contains '--filter ./workflows/inngest --fail-if-no-match build' "$command_log"
  assert_contains '--filter ./workflows/inngest --fail-if-no-match lint' "$command_log"
  assert_contains '--dir workflows/inngest exec vitest run --reporter=dot --reporter=json' "$command_log"
  assert_contains 'src/index.test.ts' "$command_log"
  assert_contains 'src/__tests__/inngest-test-runtime.test.ts' "$command_log"
  assert_contains \
    'PF-2050 Inngest runtime manager owns pinned Docker startup, readiness, and cleanup for the live index suite.' \
    "$output"
  assert_not_contains 'inngest-dev-server 127.0.0.1:4200' "$service_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$inngest_pf2050_head_sha"
    printf '%s\n' 'export const managerRevision = 2;' \
      >> workflows/inngest/src/__tests__/inngest-test-runtime.ts
    git add workflows/inngest/src/__tests__/inngest-test-runtime.ts
    git commit -q -m 'update owned Inngest runtime manager'
    git rev-parse HEAD
  )"
  inngest_manager_followup_head_sha="$head_sha"
  : > "$command_log"
  : > "$docker_log"
  : > "$service_log"
  output="$test_root/inngest-manager-followup-success.log"
  run_fixture "$inngest_manager_followup_head_sha" "$output" BASE_SHA="$inngest_pf2050_head_sha"
  assert_contains '--filter ./workflows/inngest --fail-if-no-match exec tsc --noEmit' "$command_log"
  assert_contains '--filter ./workflows/inngest --fail-if-no-match build' "$command_log"
  assert_contains '--filter ./workflows/inngest --fail-if-no-match lint' "$command_log"
  assert_contains 'src/__tests__/inngest-test-runtime.test.ts' "$command_log"
  assert_not_contains 'src/index.test.ts' "$command_log"
  assert_not_contains 'inngest-dev-server 127.0.0.1:4200' "$service_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$inngest_pf2050_head_sha"
    printf '%s\n' '# unrelated workflow mutation' \
      >> .github/workflows/papersflow-fork-pr.yml
    git add .github/workflows/papersflow-fork-pr.yml
    git commit -q -m 'mutate unrelated workflow content'
    git rev-parse HEAD
  )"
  : > "$command_log"
  : > "$docker_log"
  output="$test_root/inngest-pf2050-unrelated-workflow-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'PF-2050 unrelated workflow mutation unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'PF-2050 workflow may only remove the two legacy Inngest lifecycle steps.' "$output"
  if [[ -s "$command_log" || -s "$docker_log" ]]; then
    echo 'PF-2050 unrelated workflow mutation executed validation commands.' >&2
    cat "$command_log" "$docker_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$inngest_pf2050_head_sha"
    printf '%s\n' \
      '      # duplicate owner: docker run --detach --name mastra-inngest-test' \
      '      # MASTRA_INNGEST_TEST_DOCKER=1' \
      >> .github/workflows/papersflow-fork-pr.yml
    git add .github/workflows/papersflow-fork-pr.yml
    git commit -q -m 'reintroduce duplicate Inngest workflow owner'
    git rev-parse HEAD
  )"
  : > "$command_log"
  : > "$docker_log"
  output="$test_root/inngest-pf2050-duplicate-owner-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'PF-2050 duplicate workflow owner unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'PF-2050 workflow retained duplicate Inngest lifecycle ownership' "$output"
  if [[ -s "$command_log" || -s "$docker_log" ]]; then
    echo 'PF-2050 duplicate workflow owner executed validation commands.' >&2
    cat "$command_log" "$docker_log" >&2
    exit 1
  fi

  git -C "$fixture_repo" reset -q --hard "$inngest_trio_head_sha"
  head_sha="$inngest_trio_head_sha"
  : > "$command_log"
  : > "$docker_log"
  output="$test_root/inngest-invalid-compose-failure.log"
  set +e
  run_fixture "$head_sha" "$output" \
    PAPERSFLOW_PF2042_INNGEST_TEST_BLOB="$fixture_inngest_test_blob" \
    PAPERSFLOW_PF2042_INNGEST_TEST_SHA256="$fixture_inngest_test_sha" \
    PAPERSFLOW_PF2042_INNGEST_COMPOSE_BLOB="$fixture_inngest_compose_blob" \
    PAPERSFLOW_PF2042_INNGEST_COMPOSE_SHA256="$fixture_inngest_compose_sha" \
    PAPERSFLOW_PF2042_INNGEST_ADAPTER_BLOB="$fixture_inngest_adapter_blob" \
    PAPERSFLOW_PF2042_INNGEST_ADAPTER_SHA256="$fixture_inngest_adapter_sha" \
    MOCK_DOCKER_FAIL=1
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Invalid Inngest Compose fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'compose -f workflows/inngest/docker-compose.yaml config --quiet' "$docker_log"
  if [[ -s "$command_log" ]]; then
    echo 'Invalid Inngest Compose fixture executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$inngest_trio_head_sha"
    sed -i \
      -e 's/dev -p 4200/dev -p 43123/' \
      -e "s/'4200:4200'/'43123:43123'/" \
      workflows/inngest/docker-compose.yaml
    git add .
    git commit -q -m 'misalign reviewed Inngest topology'
    git rev-parse HEAD
  )"
  : > "$command_log"
  : > "$docker_log"
  output="$test_root/inngest-misaligned-topology-failure.log"
  set +e
  run_fixture "$head_sha" "$output" \
    PAPERSFLOW_PF2042_INNGEST_TEST_BLOB="$fixture_inngest_test_blob" \
    PAPERSFLOW_PF2042_INNGEST_TEST_SHA256="$fixture_inngest_test_sha" \
    PAPERSFLOW_PF2042_INNGEST_COMPOSE_BLOB="$fixture_inngest_compose_blob" \
    PAPERSFLOW_PF2042_INNGEST_COMPOSE_SHA256="$fixture_inngest_compose_sha" \
    PAPERSFLOW_PF2042_INNGEST_ADAPTER_BLOB="$fixture_inngest_adapter_blob" \
    PAPERSFLOW_PF2042_INNGEST_ADAPTER_SHA256="$fixture_inngest_adapter_sha"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Misaligned PF-2042 Inngest topology unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'Reviewed regular-file content mismatch: workflows/inngest/docker-compose.yaml' "$output"
  if [[ -s "$command_log" || -s "$docker_log" ]]; then
    echo 'Misaligned PF-2042 Inngest topology executed validation commands.' >&2
    cat "$command_log" "$docker_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' '    ports:' "      - '43123:43123'" \
      >> workflows/inngest/docker-compose.yaml
    git add .
    git commit -q -m 'unpaired Inngest Compose change'
    git rev-parse HEAD
  )"
  : > "$command_log"
  : > "$docker_log"
  : > "$service_log"
  output="$test_root/inngest-unpaired-compose-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Unpaired Inngest Compose fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'self-hosting Inngest test, Compose topology, and adapter launcher must change together' "$output"
  if [[ -s "$command_log" || -s "$docker_log" ]]; then
    echo 'Unpaired Inngest Compose fixture executed validation commands.' >&2
    cat "$command_log" "$docker_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "it('ordinary index regression', () => {});" \
      >> workflows/inngest/src/index.test.ts
    git add .
    git commit -q -m 'ordinary Inngest index test change'
    git rev-parse HEAD
  )"
  : > "$command_log"
  : > "$docker_log"
  : > "$service_log"
  output="$test_root/inngest-index-test-success.log"
  run_fixture "$head_sha" "$output"
  assert_contains 'compose -f workflows/inngest/docker-compose.yaml config --quiet' "$docker_log"
  assert_contains '--filter ./workflows/inngest --fail-if-no-match exec tsc --noEmit' "$command_log"
  assert_contains '--filter ./workflows/inngest --fail-if-no-match build' "$command_log"
  assert_contains '--filter ./workflows/inngest --fail-if-no-match lint' "$command_log"
  assert_contains 'src/index.test.ts' "$command_log"
  assert_contains 'inngest-dev-server 127.0.0.1:4200' "$service_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const adapterHandlerPort = 43124;' \
      >> workflows/inngest/src/__tests__/adapters/_utils.ts
    git add .
    git commit -q -m 'unpaired Inngest adapter launcher change'
    git rev-parse HEAD
  )"
  : > "$command_log"
  : > "$docker_log"
  output="$test_root/inngest-unpaired-adapter-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Unpaired Inngest adapter launcher fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'self-hosting Inngest test, Compose topology, and adapter launcher must change together' "$output"
  if [[ -s "$command_log" || -s "$docker_log" ]]; then
    echo 'Unpaired Inngest adapter launcher fixture executed validation commands.' >&2
    cat "$command_log" "$docker_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const atomicResumeConformance = "head";' \
      > stores/_test-utils/src/domains/workflows/atomic-resume.ts
    printf '%s\n' "export { atomicResumeConformance } from './domains/workflows/atomic-resume';" \
      'export const atomicResumeExport = "head";' \
      > stores/_test-utils/src/index.ts
    printf '%s\n' "it('libsql atomic resume head', () => {});" \
      >> stores/libsql/src/storage/domains/workflows/atomic-resume.test.ts
    printf '%s\n' "it('pg atomic resume head', () => {});" \
      >> stores/pg/src/storage/domains/workflows/atomic-resume.test.ts
    git add .
    git commit -q -m 'exercise atomic resume conformance adapters'
    git rev-parse HEAD
  )"
  : > "$command_log"
  : > "$service_log"
  output="$test_root/atomic-resume-conformance-success.log"
  if ! run_fixture "$head_sha" "$output"; then
    cat "$output" >&2
    exit 1
  fi
  assert_contains '--filter ./stores/libsql --fail-if-no-match exec tsc --noEmit' "$command_log"
  assert_contains '--filter ./stores/pg --fail-if-no-match exec tsc --noEmit' "$command_log"
  assert_contains 'src/storage/domains/workflows/atomic-resume.test.ts' "$command_log"
  assert_contains 'postgres 127.0.0.1:5434' "$service_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "it('pg performance index head', () => {});" \
      >> stores/pg/src/storage/performance-indexes/performance-indexes.test.ts
    printf '%s\n' "it('pg external schema head', () => {});" \
      >> stores/pg/src/storage/db/external-schema.integration.test.ts
    git add .
    git commit -q -m 'exercise PostgreSQL performance and external schema routes'
    git rev-parse HEAD
  )"
  : > "$command_log"
  : > "$service_log"
  output="$test_root/pg-performance-and-external-schema-success.log"
  if ! run_fixture "$head_sha" "$output"; then
    cat "$output" >&2
    exit 1
  fi
  assert_contains '--filter ./stores/pg --fail-if-no-match exec tsc --noEmit' "$command_log"
  assert_contains '--filter ./stores/pg --fail-if-no-match build:lib' "$command_log"
  assert_contains '--filter ./stores/pg --fail-if-no-match lint' "$command_log"
  assert_line_matches \
    '^--dir stores/pg exec vitest run --config vitest\.perf\.config\.ts --reporter=dot --reporter=json .*src/storage/performance-indexes/performance-indexes\.test\.ts$' \
    "$command_log"
  assert_line_matches \
    '^--dir stores/pg exec vitest run --reporter=dot --reporter=json .*src/storage/db/external-schema\.integration\.test\.ts$' \
    "$command_log"
  assert_contains 'postgres 127.0.0.1:5434' "$service_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "it('pg performance integration head', () => {});" \
      > stores/pg/src/storage/performance-indexes/performance-indexes.integration.test.ts
    printf '%s\n' "it('pg row-number performance head', () => {});" \
      > stores/pg/src/storage/domains/memory/row-number-performance.test.ts
    git add .
    git commit -q -m 'reject unowned PostgreSQL performance suites'
    git rev-parse HEAD
  )"
  : > "$command_log"
  : > "$service_log"
  output="$test_root/pg-unowned-performance-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Unowned PostgreSQL performance fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'stores/pg/src/storage/performance-indexes/performance-indexes.integration.test.ts' "$output"
  assert_contains 'stores/pg/src/storage/domains/memory/row-number-performance.test.ts' "$output"
  assert_contains 'Failing closed instead of reporting incomplete validation as successful.' "$output"
  if grep -Fq -- 'exec vitest run' "$command_log" || [[ -s "$service_log" ]]; then
    echo 'Unowned PostgreSQL performance fixture reached a test runner or service probe.' >&2
    cat "$command_log" "$service_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const resumeOperation = "head";' \
      > workflows/inngest/src/resume-operation.ts
    printf '%s\n' "it('create run contract head', () => {});" \
      >> workflows/inngest/src/create-run-contract.test.ts
    git add .
    git commit -q -m 'exercise owned Inngest resume operation'
    git rev-parse HEAD
  )"
  : > "$command_log"
  : > "$docker_log"
  output="$test_root/inngest-resume-operation-success.log"
  if ! run_fixture "$head_sha" "$output"; then
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'Forcing PF-2044 owned suites to run for source-only changes:' "$output"
  assert_contains 'workflows/inngest/src/lifecycle-execution.test.ts' "$output"
  assert_contains 'workflows/inngest/src/resume-async.test.ts' "$output"
  assert_contains 'src/create-run-contract.test.ts' "$command_log"
  assert_contains 'src/lifecycle-execution.test.ts' "$command_log"
  assert_contains 'src/resume-async.test.ts' "$command_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const inngest = "processor-traits-head";' \
      > workflows/inngest/src/index.ts
    git add .
    git commit -q -m 'exercise Inngest processor trait clone contract'
    git rev-parse HEAD
  )"
  : > "$command_log"
  : > "$docker_log"
  output="$test_root/inngest-index-contract-success.log"
  if ! run_fixture "$head_sha" "$output"; then
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'Forcing PF-2044 owned suites to run for source-only changes:' "$output"
  assert_contains 'workflows/inngest/src/create-run-contract.test.ts' "$output"
  assert_contains '--filter ./workflows/inngest --fail-if-no-match exec tsc --noEmit' "$command_log"
  assert_contains 'src/create-run-contract.test.ts' "$command_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const temporalWorkflow = "transient-boundary-head";' \
      > workflows/temporal/src/workflow.ts
    git add .
    git commit -q -m 'exercise Temporal transient boundary contract'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/temporal-workflow-contract-success.log"
  if ! run_fixture "$head_sha" "$output"; then
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'Forcing PF-2044 owned suites to run for source-only changes:' "$output"
  assert_contains 'workflows/temporal/src/workflow.test.ts' "$output"
  assert_contains '--filter ./workflows/temporal --fail-if-no-match exec tsc --noEmit' "$command_log"
  assert_contains '--filter ./workflows/temporal --fail-if-no-match build' "$command_log"
  assert_contains '--filter ./workflows/temporal --fail-if-no-match lint' "$command_log"
  assert_contains 'src/workflow.test.ts' "$command_log"
  temporal_build_line="$(
    awk -v command='--filter ./workflows/temporal --fail-if-no-match build' \
      '$0 == command { print NR; exit }' "$command_log"
  )"
  temporal_typecheck_line="$(
    awk -v command='--filter ./workflows/temporal --fail-if-no-match exec tsc --noEmit' \
      '$0 == command { print NR; exit }' "$command_log"
  )"
  if [[ -z "$temporal_build_line" || -z "$temporal_typecheck_line" ]] ||
    (( temporal_build_line >= temporal_typecheck_line )); then
    echo 'Temporal validation must build its self-imported dist types before typechecking a clean checkout.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const unreviewedTemporalSource = true;' \
      > workflows/temporal/src/unreviewed.ts
    git add .
    git commit -q -m 'add unreviewed Temporal source'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/temporal-unknown-source-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Unknown Temporal source fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'workflows/temporal/src/unreviewed.ts' "$output"
  assert_contains 'outside the PF-2044 owned source-and-test maps' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Unknown Temporal source fixture executed validation commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    node - <<'NODE'
const fs = require('node:fs');
const manifestPath = 'workflows/inngest/package.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
delete manifest.devDependencies['@ai-sdk/openai'];
delete manifest.devDependencies['inngest-cli'];
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
NODE
    printf '%s\n' \
      "lockfileVersion: '9.0'" \
      '' \
      'importers:' \
      '' \
      '  workflows/inngest:' \
      '    devDependencies:' \
      '      vitest:' \
      '        specifier: ^4.1.0' \
      '        version: 4.1.0' \
      '' \
      'packages:' \
      '' \
      '  vitest@4.1.0:' \
      '    resolution: {integrity: sha512-retained}' \
      '' \
      'snapshots:' \
      '' \
      '  vitest@4.1.0: {}' \
      '' \
      > pnpm-lock.yaml
    printf '%s\n' 'export const durableAgentTestUtils = "head";' \
      > workflows/inngest/src/__tests__/durable-agent.test.utils.ts
    printf '%s\n' "it('durable test utility head', () => {});" \
      >> workflows/inngest/src/__tests__/durable-agent.test.utils.test.ts
    printf '%s\n' "it('terminal index head', () => {});" \
      >> workflows/inngest/src/index.test.ts
    printf '%s\n' 'export const run = "terminal-head";' > workflows/inngest/src/run.ts
    printf '%s\n' 'export const workflow = "terminal-head";' > workflows/inngest/src/workflow.ts
    printf '%s\n' "it('stream terminal head', () => {});" \
      >> workflows/inngest/src/run-stream-terminal.test.ts
    printf '%s\n' "it('serve terminal head', () => {});" \
      >> workflows/inngest/src/serve.test.ts
    git add .
    git commit -q -m 'exercise deterministic terminal delivery'
    git rev-parse HEAD
  )"
  inngest_pf2057_head_sha="$head_sha"
  output="$test_root/inngest-pf2057-install-admission.log"
  if ! (
    cd "$fixture_repo"
    BASE_SHA="$base_sha" HEAD_SHA="$head_sha" GITHUB_OUTPUT= bash "$validator_path" --classify-install
  ) > "$output" 2>&1; then
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'lane=standard' "$output"
  : > "$command_log"
  : > "$docker_log"
  : > "$service_log"
  output="$test_root/inngest-pf2057-terminal-success.log"
  if ! run_fixture "$head_sha" "$output"; then
    cat "$output" >&2
    exit 1
  fi
  assert_contains '--filter ./workflows/inngest --fail-if-no-match exec tsc --noEmit' "$command_log"
  assert_contains 'src/__tests__/durable-agent.test.utils.test.ts' "$command_log"
  assert_contains 'src/index.test.ts' "$command_log"
  assert_contains 'src/lifecycle-execution.test.ts' "$command_log"
  assert_contains 'src/resume-async.test.ts' "$command_log"
  assert_contains 'src/run-stream-terminal.test.ts' "$command_log"
  assert_contains 'src/serve.test.ts' "$command_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$inngest_pf2057_head_sha"
    printf '%s\n' '# unreviewed lockfile mutation' >> pnpm-lock.yaml
    git add pnpm-lock.yaml
    git commit -q -m 'tamper deterministic terminal dependency cleanup'
    git rev-parse HEAD
  )"
  : > "$command_log"
  : > "$docker_log"
  output="$test_root/inngest-pf2057-lock-tamper-admission.log"
  if (
    cd "$fixture_repo"
    BASE_SHA="$base_sha" HEAD_SHA="$head_sha" GITHUB_OUTPUT= bash "$validator_path" --classify-install
  ) > "$output" 2>&1; then
    echo 'PF-2057 tampered lockfile unexpectedly passed install admission.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'Lockfile-only changes require a reviewed dependency-graph lane.' "$output"
  output="$test_root/inngest-pf2057-lock-tamper-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'PF-2057 tampered lockfile fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'PF-2057 pnpm-lock.yaml may only remove the reviewed Inngest importer and inngest-cli graph blocks.' "$output"
  if [[ -s "$command_log" || -s "$docker_log" ]]; then
    echo 'PF-2057 tampered lockfile fixture executed validation commands.' >&2
    cat "$command_log" "$docker_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' '{"scripts":{"test":"echo unreviewed"}}' > workflows/inngest/package.json
    git add .
    git commit -q -m 'unreviewed Inngest manifest change'
    git rev-parse HEAD
  )"
  : > "$command_log"
  : > "$docker_log"
  output="$test_root/inngest-manifest-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Inngest manifest fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'workflows/inngest/package.json' "$output"
  assert_contains 'require dedicated validation' "$output"
  if [[ -s "$command_log" || -s "$docker_log" ]]; then
    echo 'Inngest manifest fixture executed validation commands.' >&2
    cat "$command_log" "$docker_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "import { it } from 'vitest';" "it('unreviewed live Inngest', () => {});" \
      > workflows/inngest/src/unreviewed-live.test.ts
    git add .
    git commit -q -m 'unreviewed live Inngest test'
    git rev-parse HEAD
  )"
  : > "$command_log"
  : > "$docker_log"
  output="$test_root/inngest-unknown-live-test-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Unknown live Inngest test fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'workflows/inngest/src/unreviewed-live.test.ts' "$output"
  assert_contains 'outside the PF-2044 owned service and runtime contracts' "$output"
  if [[ -s "$command_log" || -s "$docker_log" ]]; then
    echo 'Unknown live Inngest test fixture executed validation commands.' >&2
    cat "$command_log" "$docker_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      'export type InngestAgentResumeOptions = { requireToolPermissionPolicy?: true; head?: true };' \
      > workflows/inngest/src/durable-agent/create-inngest-agent.ts
    printf '%s\n' \
      "import { expectTypeOf, it } from 'vitest';" \
      "import type { InngestAgentResumeOptions } from './create-inngest-agent';" \
      "it('keeps resume permission monotonic', () => expectTypeOf<InngestAgentResumeOptions>().toBeObject());" \
      > workflows/inngest/src/durable-agent/create-inngest-agent.test-d.ts
    git add .
    git commit -q -m 'inngest resume type contract'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/inngest-resume-type-contract-success.log"
  run_fixture "$head_sha" "$output"
  assert_contains '--filter ./workflows/inngest --fail-if-no-match exec tsc --noEmit' "$command_log"
  assert_contains '--filter ./workflows/inngest --fail-if-no-match build' "$command_log"
  assert_contains '--filter ./workflows/inngest --fail-if-no-match lint' "$command_log"
  assert_contains '--dir workflows/inngest exec vitest run --typecheck.only --reporter=dot --reporter=json --outputFile.json=' "$command_log"
  assert_contains 'src/durable-agent/create-inngest-agent.test-d.ts' "$command_log"
  assert_contains 'src/__tests__/create-inngest-agent.test.ts' "$command_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      'export type InngestAgentResumeOptions = { requireToolPermissionPolicy?: true; head?: true };' \
      > workflows/inngest/src/durable-agent/create-inngest-agent.ts
    printf '%s\n' 'export type EmptyTypeContract = true;' \
      > workflows/inngest/src/durable-agent/create-inngest-agent.test-d.ts
    git add .
    git commit -q -m 'empty inngest resume type contract'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/inngest-empty-resume-type-contract-failure.log"
  set +e
  run_fixture "$head_sha" "$output" MOCK_TYPE_TEST_REPORT=zero
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Empty Inngest resume type contract unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'The changed type-test file did not execute a passing Vitest type test.' "$output"
  assert_contains 'workflows/inngest/src/durable-agent/create-inngest-agent.test-d.ts' "$output"

  for invalid_report in partial nonnumeric; do
    : > "$command_log"
    output="$test_root/inngest-${invalid_report}-resume-type-contract-failure.log"
    set +e
    run_fixture "$head_sha" "$output" MOCK_TYPE_TEST_REPORT="$invalid_report"
    status=$?
    set -e
    if (( status == 0 )); then
      echo "Invalid ${invalid_report} Inngest type-test report unexpectedly passed." >&2
      cat "$output" >&2
      exit 1
    fi
    assert_contains 'The changed type-test file did not execute a passing Vitest type test.' "$output"
    assert_contains 'workflows/inngest/src/durable-agent/create-inngest-agent.test-d.ts' "$output"
  done

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import type { HarnessRoute } from '../route-types.generated.js';" \
      'export type ClientHarnessRoute = HarnessRoute & { permissions: "durable" };' \
      > client-sdks/client-js/src/resources/harness.ts
    git add .
    git commit -q -m 'client harness contract'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/client-harness-production-success.log"
  run_fixture "$head_sha" "$output"
  assert_contains 'Forcing PF-2044 owned suites to run for source-only changes:' "$output"
  assert_contains 'client-sdks/client-js/src/resources/harness.test.ts' "$output"
  assert_contains '--filter ./client-sdks/client-js --fail-if-no-match exec tsc --noEmit' "$command_log"
  assert_contains '--filter ./client-sdks/client-js --fail-if-no-match build:lib' "$command_log"
  assert_contains '--filter ./client-sdks/client-js --fail-if-no-match lint' "$command_log"
  assert_contains '--dir client-sdks/client-js exec vitest run' "$command_log"
  assert_contains 'src/resources/harness.test.ts' "$command_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "export * from './tools';" \
      "export type { IndexOnlyRoute, RouteTypes } from './route-types.generated.js';" \
      "export type { ClientHarnessRoute, InboxResponseGeneration } from './resources/harness';" \
      > client-sdks/client-js/src/index.ts
    git add .
    git commit -q -m 'client inbox response generation export'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/client-index-production-success.log"
  run_fixture "$head_sha" "$output"
  assert_contains 'Forcing PF-2044 owned suites to run for source-only changes:' "$output"
  assert_contains 'client-sdks/client-js/src/index.test.ts' "$output"
  assert_contains '--filter ./client-sdks/client-js --fail-if-no-match exec tsc --noEmit' "$command_log"
  assert_contains '--filter ./client-sdks/client-js --fail-if-no-match build:lib' "$command_log"
  assert_contains '--filter ./client-sdks/client-js --fail-if-no-match lint' "$command_log"
  assert_contains '--dir client-sdks/client-js exec vitest run' "$command_log"
  assert_contains 'src/index.test.ts' "$command_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "export * from './tools';" \
      "export type { IndexOnlyRoute } from './route-types.generated.js';" \
      "export type { ClientHarnessRoute, InboxResponseGeneration } from './resources/harness';" \
      > client-sdks/client-js/src/index.ts
    git add .
    git commit -q -m 'remove one public client route export'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/client-index-route-export-removal-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Partial Client SDK route-export removal unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains \
    'Client SDK public entrypoint changed outside the reviewed InboxResponseGeneration type re-export.' \
    "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Invalid Client SDK route-export fixture executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "export * from './tools';" \
      "export type { IndexOnlyRoute } from './route-types.generated.js';" \
      "export type { ClientHarnessRoute, InboxResponseGeneration } from './resources/harness';" \
      > client-sdks/client-js/src/index.ts
    printf '%s\n' "it('unrelated server coverage', () => true);" \
      >> packages/server/src/server/handlers/favorites.integration.test.ts
    git add .
    git commit -q -m 'hide client route export removal behind unrelated server test'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/client-index-route-export-removal-with-server-test-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Client SDK route-export removal paired with an unrelated Server test unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains \
    'Client SDK public entrypoint changed outside the reviewed InboxResponseGeneration type re-export.' \
    "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Invalid mixed Client SDK/Server route-export fixture executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "export * from './tools';" \
      "export type { IndexOnlyRoute, RouteTypes } from './route-types.generated.js';" \
      "export type * from './route-types.generated.js';" \
      "export type { ClientHarnessRoute, InboxResponseGeneration } from './resources/harness';" \
      > client-sdks/client-js/src/index.ts
    git add .
    git commit -q -m 'add wildcard public client route exports'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/client-index-wildcard-route-export-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Wildcard Client SDK route export unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains \
    'Client SDK public entrypoint changed outside the reviewed InboxResponseGeneration type re-export.' \
    "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Invalid wildcard Client SDK route-export fixture executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "export * from './tools';" \
      "export type { IndexOnlyRoute, RouteTypes } from './route-types.generated.js';" \
      "export type LeakedHarnessRoute = import('./route-types.generated.js').HarnessRoute;" \
      "export type { ClientHarnessRoute, InboxResponseGeneration } from './resources/harness';" \
      > client-sdks/client-js/src/index.ts
    git add .
    git commit -q -m 'indirectly expose a generated client route type'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/client-index-indirect-route-export-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Indirect Client SDK generated route export unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains \
    'Client SDK public entrypoint changed outside the reviewed InboxResponseGeneration type re-export.' \
    "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Invalid indirect Client SDK route-export fixture executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "export * from './tools';" \
      "export type { IndexOnlyRoute, RouteTypes } from './route-types.generated.js';" \
      "export type { HarnessRoute } from './resources/../route-types.generated.js';" \
      "export type { ClientHarnessRoute, InboxResponseGeneration } from './resources/harness';" \
      > client-sdks/client-js/src/index.ts
    git add .
    git commit -q -m 'expose generated client route through an equivalent path'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/client-index-equivalent-route-path-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Equivalent-path Client SDK generated route export unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains \
    'Client SDK public entrypoint changed outside the reviewed InboxResponseGeneration type re-export.' \
    "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Invalid equivalent-path Client SDK route-export fixture executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "export type { IndexOnlyRoute, RouteTypes } from './route-types.generated.js';" \
      "export type { ClientHarnessRoute, InboxResponseGeneration } from './resources/harness';" \
      > client-sdks/client-js/src/index.ts
    git add .
    git commit -q -m 'remove an unrelated client entrypoint export'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/client-index-unrelated-export-removal-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Unrelated Client SDK entrypoint export removal unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains \
    'Client SDK public entrypoint changed outside the reviewed InboxResponseGeneration type re-export.' \
    "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Invalid unrelated Client SDK entrypoint-export fixture executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const unreviewedClientSurface = true;' \
      > client-sdks/client-js/src/resources/unreviewed.ts
    git add .
    git commit -q -m 'unreviewed client source'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/client-unknown-source-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Unknown Client SDK source unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'client-sdks/client-js/src/resources/unreviewed.ts' "$output"
  assert_contains 'outside the PF-2044 owned source-and-test maps' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Unknown Client SDK source fixture executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' '# Harness session contract' '' 'Durable approval coordinates are immutable.' \
      > harnessv1/sections/04-public-api/02-session/messages.md
    git add .
    git commit -q -m 'harness specification update'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/harness-spec-success.log"
  run_fixture "$head_sha" "$output"
  assert_contains \
    'exec oxfmt --check --no-error-on-unmatched-pattern harnessv1/sections/04-public-api/02-session/messages.md' \
    "$command_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    ln -s ../../../../outside.md \
      harnessv1/sections/04-public-api/02-session/messages-link.md
    git add .
    git commit -q -m 'symlink Harness specification input'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/harness-spec-symlink-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Symlink Harness specification input unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'harnessv1/sections/04-public-api/02-session/messages-link.md' "$output"
  assert_contains 'require dedicated validation' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Symlink Harness specification input executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'unreviewed binary specification input' \
      > harnessv1/sections/04-public-api/02-session/messages.bin
    git add .
    git commit -q -m 'unreviewed harness specification input'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/harness-spec-unknown-input-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Unknown Harness specification input unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'harnessv1/sections/04-public-api/02-session/messages.bin' "$output"
  assert_contains 'require dedicated validation' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Unknown Harness specification input executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      'export function buildObservationIndexInput(candidate: unknown) {' \
      '  return { candidate, recordId: "record-1" };' \
      '}' \
      > mastracode/sdk/src/utils/observation-index-input.ts
    printf '%s\n' \
      "import { it } from 'vitest';" \
      "import { buildObservationIndexInput } from '../observation-index-input';" \
      "it('authorizes observation indexing', () => buildObservationIndexInput);" \
      > mastracode/sdk/src/utils/__tests__/observation-index-input.test.ts
    printf '%s\n' \
      "import { buildObservationIndexInput } from '../src/utils/observation-index-input';" \
      'declare const memory: { indexObservation(input: unknown): Promise<void> };' \
      'export async function indexObservationGroupsFromMessages(' \
      '  memory: { indexObservation(input: unknown): Promise<void> },' \
      '  candidate: unknown,' \
      ') {' \
      '  const input = buildObservationIndexInput(candidate);' \
      '  if (!input) return;' \
      '  await memory.indexObservation(input);' \
      '}' \
      'void indexObservationGroupsFromMessages(memory, {});' \
      > mastracode/sdk/scripts/index-messages.ts
    git add .
    git commit -q -m 'authorize mastracode observation indexing'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/mastracode-observation-index-success.log"
  run_fixture "$head_sha" "$output"
  assert_contains 'turbo build --filter ./mastracode/sdk' "$command_log"
  assert_contains '--filter ./mastracode/sdk --fail-if-no-match check' "$command_log"
  assert_contains '--filter ./mastracode/sdk --fail-if-no-match build:lib' "$command_log"
  assert_contains '--filter ./mastracode/sdk --fail-if-no-match lint' "$command_log"
  assert_contains '--dir mastracode/sdk exec tsc-files --noEmit scripts/index-messages.ts' "$command_log"
  assert_contains '--dir mastracode/sdk exec vitest run' "$command_log"
  assert_contains 'src/utils/__tests__/observation-index-input.test.ts' "$command_log"

  # PF-2306: a guarded indexObservation call inside a for-of body is not
  # guaranteed to execute under the guard the analysis reasons about (the loop
  # runs zero or more times over an unbounded value), so the loop body counts as
  # a disallowed, statically unreachable position. Without the for-of rule this
  # migration passes; with it the call must be rejected and moved to
  # straight-line code.
  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import { buildObservationIndexInput } from '../src/utils/observation-index-input';" \
      'declare const memory: { indexObservation(input: unknown): Promise<void> };' \
      'export async function indexObservationGroupsFromMessages(' \
      '  memory: { indexObservation(input: unknown): Promise<void> },' \
      '  candidates: unknown[],' \
      ') {' \
      '  for (const candidate of candidates) {' \
      '    const input = buildObservationIndexInput(candidate);' \
      '    if (!input) continue;' \
      '    await memory.indexObservation(input);' \
      '  }' \
      '}' \
      'void indexObservationGroupsFromMessages(memory, []);' \
      > mastracode/sdk/scripts/index-messages.ts
    git add .
    git commit -q -m 'hide observation indexing inside a for-of loop body'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/mastracode-observation-index-for-of-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'for-of-hidden observation indexing unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must pass buildObservationIndexInput output to every indexObservation call' "$output"
  assert_contains 'mastracode/sdk/scripts/index-messages.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'for-of-hidden observation indexing executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  # PF-2306: the same reasoning applies to a plain runtime-bounded for loop --
  # its body runs zero or more times, so a guarded call inside it is not
  # guaranteed to run and must be rejected just like a for-of body.
  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import { buildObservationIndexInput } from '../src/utils/observation-index-input';" \
      'declare const memory: { indexObservation(input: unknown): Promise<void> };' \
      'export async function indexObservationGroupsFromMessages(' \
      '  memory: { indexObservation(input: unknown): Promise<void> },' \
      '  candidates: unknown[],' \
      ') {' \
      '  for (let i = 0; i < candidates.length; i++) {' \
      '    const input = buildObservationIndexInput(candidates[i]);' \
      '    if (!input) continue;' \
      '    await memory.indexObservation(input);' \
      '  }' \
      '}' \
      'void indexObservationGroupsFromMessages(memory, []);' \
      > mastracode/sdk/scripts/index-messages.ts
    git add .
    git commit -q -m 'hide observation indexing inside a plain for loop body'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/mastracode-observation-index-for-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'for-loop-hidden observation indexing unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must pass buildObservationIndexInput output to every indexObservation call' "$output"
  assert_contains 'mastracode/sdk/scripts/index-messages.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'for-loop-hidden observation indexing executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  # PF-2306: a missing-input guard whose body always exits through a try/finally
  # (cleanup before returning) is a valid guard. Without TryStatement handling in
  # statementAlwaysExits the guard is not recognized and this legitimate
  # migration is wrongly rejected; with it the guarded call is authorized and the
  # migration passes.
  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import { buildObservationIndexInput } from '../src/utils/observation-index-input';" \
      'declare const memory: { indexObservation(input: unknown): Promise<void> };' \
      'declare function teardown(): void;' \
      'export async function indexObservationGroupsFromMessages(' \
      '  memory: { indexObservation(input: unknown): Promise<void> },' \
      '  candidate: unknown,' \
      ') {' \
      '  const input = buildObservationIndexInput(candidate);' \
      '  if (!input) {' \
      '    try {' \
      '      return;' \
      '    } finally {' \
      '      teardown();' \
      '    }' \
      '  }' \
      '  await memory.indexObservation(input);' \
      '}' \
      'void indexObservationGroupsFromMessages(memory, {});' \
      > mastracode/sdk/scripts/index-messages.ts
    git add .
    git commit -q -m 'guard observation indexing with a try/finally that always exits'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/mastracode-observation-index-try-finally-success.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status != 0 )); then
    echo 'try/finally-guarded observation indexing unexpectedly failed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains '--dir mastracode/sdk exec vitest run' "$command_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import { buildObservationIndexInput } from '../src/utils/observation-index-input';" \
      'declare const memory: { indexObservation(input: unknown): Promise<void> };' \
      'export async function* indexObservationGroupsFromMessages(' \
      '  memory: { indexObservation(input: unknown): Promise<void> },' \
      '  candidate: unknown,' \
      ') {' \
      '  const input = buildObservationIndexInput(candidate);' \
      '  if (!input) return;' \
      '  await memory.indexObservation(input);' \
      '}' \
      'void indexObservationGroupsFromMessages(memory, {});' \
      > mastracode/sdk/scripts/index-messages.ts
    git add .
    git commit -q -m 'hide observation indexing in a generator entrypoint'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/mastracode-observation-index-generator-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Generator-backed observation-index entrypoint unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must pass buildObservationIndexInput output to every indexObservation call' "$output"
  assert_contains 'mastracode/sdk/scripts/index-messages.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Generator-backed observation-index entrypoint executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import { buildObservationIndexInput } from '../src/utils/observation-index-input';" \
      'declare const fakeSink: { indexObservation(input: unknown): Promise<void> };' \
      'export async function indexObservationGroupsFromMessages(' \
      '  memory: { indexObservation(input: unknown): Promise<void> },' \
      '  candidate: unknown,' \
      ') {' \
      '  void memory;' \
      '  const input = buildObservationIndexInput(candidate);' \
      '  if (!input) return;' \
      '  await fakeSink.indexObservation(input);' \
      '}' \
      'void indexObservationGroupsFromMessages(fakeSink, {});' \
      > mastracode/sdk/scripts/index-messages.ts
    git add .
    git commit -q -m 'send observation input to an unrelated sink'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/mastracode-observation-index-fake-sink-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Unrelated observation-index sink unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must pass buildObservationIndexInput output to every indexObservation call' "$output"
  assert_contains 'mastracode/sdk/scripts/index-messages.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Unrelated observation-index sink executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import { buildObservationIndexInput } from '../src/utils/observation-index-input';" \
      'declare const memory: { indexObservation?(input: unknown): Promise<void> };' \
      'export async function indexObservationGroupsFromMessages(' \
      '  memory: { indexObservation?(input: unknown): Promise<void> },' \
      '  candidate: unknown,' \
      ') {' \
      '  const input = buildObservationIndexInput(candidate);' \
      '  if (!input) return;' \
      '  await memory?.indexObservation?.(input);' \
      '}' \
      'void indexObservationGroupsFromMessages(memory, {});' \
      > mastracode/sdk/scripts/index-messages.ts
    git add .
    git commit -q -m 'make observation indexing optional'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/mastracode-observation-index-optional-call-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Optional observation-index invocation unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must pass buildObservationIndexInput output to every indexObservation call' "$output"
  assert_contains 'mastracode/sdk/scripts/index-messages.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Optional observation-index invocation executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import { buildObservationIndexInput } from '../src/utils/observation-index-input';" \
      'declare const memory: { indexObservation(input: unknown): Promise<void> };' \
      'export async function indexMessages(candidate: unknown) {' \
      '  buildObservationIndexInput(candidate);' \
      '  await memory.indexObservation(candidate);' \
      '}' \
      > mastracode/sdk/scripts/index-messages.ts
    git add .
    git commit -q -m 'bypass observation index authorization helper'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/mastracode-observation-index-bypass-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Observation-index helper bypass unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must pass buildObservationIndexInput output to every indexObservation call' "$output"
  assert_contains 'mastracode/sdk/scripts/index-messages.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Observation-index helper bypass executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import { buildObservationIndexInput } from '../src/utils/observation-index-input';" \
      'declare const memory: { indexObservation(input: unknown): Promise<void> };' \
      'export async function indexMessages(candidate: unknown) {' \
      '  const input = buildObservationIndexInput(candidate);' \
      '  if (!input) return;' \
      '  input.recordId = "forged-record";' \
      '  await memory.indexObservation(input);' \
      '}' \
      > mastracode/sdk/scripts/index-messages.ts
    git add .
    git commit -q -m 'mutate observation index authorization input'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/mastracode-observation-index-mutation-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Mutated observation-index helper result unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must pass buildObservationIndexInput output to every indexObservation call' "$output"
  assert_contains 'mastracode/sdk/scripts/index-messages.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Mutated observation-index helper result executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import { buildObservationIndexInput } from '../src/utils/observation-index-input';" \
      'declare const memory: { indexObservation(input: unknown): Promise<void> };' \
      'export async function indexMessages(candidate: unknown) {' \
      '  const input = buildObservationIndexInput(candidate);' \
      '  if (!input) return;' \
      '  await memory.indexObservation(input);' \
      '  await memory.indexObservation.call(memory, candidate);' \
      '}' \
      > mastracode/sdk/scripts/index-messages.ts
    git add .
    git commit -q -m 'invoke observation index authorization indirectly'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/mastracode-observation-index-indirect-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Indirect observation-index invocation unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must pass buildObservationIndexInput output to every indexObservation call' "$output"
  assert_contains 'mastracode/sdk/scripts/index-messages.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Indirect observation-index invocation executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import { buildObservationIndexInput } from '../src/utils/observation-index-input';" \
      'declare const memory: { indexObservation(input: unknown): Promise<void>; [key: string]: any };' \
      'export async function indexMessages(candidate: unknown) {' \
      '  const input = buildObservationIndexInput(candidate);' \
      '  if (!input) return;' \
      '  await memory.indexObservation(input);' \
      "  const method = ('indexObserv' + 'ation') as 'indexObservation';" \
      '  await memory[method](candidate);' \
      '}' \
      'void indexMessages({});' \
      > mastracode/sdk/scripts/index-messages.ts
    git add .
    git commit -q -m 'invoke observation index through a computed method'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/mastracode-observation-index-computed-method-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Computed observation-index invocation unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must pass buildObservationIndexInput output to every indexObservation call' "$output"
  assert_contains 'mastracode/sdk/scripts/index-messages.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Computed observation-index invocation executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import { buildObservationIndexInput } from '../src/utils/observation-index-input';" \
      'declare const memory: { indexObservation(input: unknown): Promise<void>; [key: string]: any };' \
      'export async function indexObservationGroupsFromMessages(' \
      '  memory: { indexObservation(input: unknown): Promise<void>; [key: string]: any },' \
      '  candidate: unknown,' \
      ') {' \
      "  const key = ['index', 'Observation'].join('');" \
      '  const hiddenSink = memory[key];' \
      '  await hiddenSink(candidate);' \
      '  const input = buildObservationIndexInput(candidate);' \
      '  if (!input) return;' \
      '  await memory.indexObservation(input);' \
      '}' \
      'void indexObservationGroupsFromMessages(memory, {});' \
      > mastracode/sdk/scripts/index-messages.ts
    git add .
    git commit -q -m 'alias observation indexing through a computed memory member'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/mastracode-observation-index-computed-alias-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Computed observation-index alias unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must pass buildObservationIndexInput output to every indexObservation call' "$output"
  assert_contains 'mastracode/sdk/scripts/index-messages.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Computed observation-index alias executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import { buildObservationIndexInput } from '../src/utils/observation-index-input';" \
      'declare const memory: { indexObservation(input: unknown): Promise<void>; valueOf(): any };' \
      'export async function indexObservationGroupsFromMessages(' \
      '  memory: { indexObservation(input: unknown): Promise<void>; valueOf(): any },' \
      '  candidate: unknown,' \
      ') {' \
      '  const input = buildObservationIndexInput(candidate);' \
      '  if (!input) return;' \
      '  await memory.indexObservation(input);' \
      "  await Reflect.get(memory.valueOf(), ['index', 'Observation'].join(''))(candidate);" \
      '}' \
      'void indexObservationGroupsFromMessages(memory, {});' \
      > mastracode/sdk/scripts/index-messages.ts
    git add .
    git commit -q -m 'invoke observation indexing through reflection'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/mastracode-observation-index-reflective-call-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Reflective observation-index invocation unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must pass buildObservationIndexInput output to every indexObservation call' "$output"
  assert_contains 'mastracode/sdk/scripts/index-messages.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Reflective observation-index invocation executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import { buildObservationIndexInput } from '../src/utils/observation-index-input';" \
      'declare const memory: { indexObservation(input: unknown): Promise<void> };' \
      'export function indexMessages(candidate: unknown) {' \
      '  const neverInvoked = async () => {' \
      '    const input = buildObservationIndexInput(candidate);' \
      '    if (!input) return;' \
      '    await memory.indexObservation(input);' \
      '  };' \
      '  void neverInvoked;' \
      '}' \
      'void indexMessages({});' \
      > mastracode/sdk/scripts/index-messages.ts
    git add .
    git commit -q -m 'hide observation indexing in dormant closure'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/mastracode-observation-index-dormant-closure-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Dormant observation-index closure unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must pass buildObservationIndexInput output to every indexObservation call' "$output"
  assert_contains 'mastracode/sdk/scripts/index-messages.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Dormant observation-index closure executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import { buildObservationIndexInput } from '../src/utils/observation-index-input';" \
      'declare const memory: { indexObservation(input: unknown): Promise<void> };' \
      'export async function indexMessages(candidate: unknown) {' \
      '  if (false) {' \
      '    const input = buildObservationIndexInput(candidate);' \
      '    if (!input) return;' \
      '    await memory.indexObservation(input);' \
      '  }' \
      '}' \
      'void indexMessages({});' \
      > mastracode/sdk/scripts/index-messages.ts
    git add .
    git commit -q -m 'hide observation indexing in a static false branch'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/mastracode-observation-index-static-false-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Statically unreachable observation-index call unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must pass buildObservationIndexInput output to every indexObservation call' "$output"
  assert_contains 'mastracode/sdk/scripts/index-messages.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Statically unreachable observation-index call executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import { buildObservationIndexInput } from '../src/utils/observation-index-input';" \
      'declare const memory: { indexObservation(input: unknown): Promise<void> };' \
      'export async function indexObservationGroupsFromMessages(' \
      '  memory: { indexObservation(input: unknown): Promise<void> },' \
      '  candidate: unknown,' \
      ') {' \
      '  if (0) {' \
      '    const input = buildObservationIndexInput(candidate);' \
      '    if (!input) return;' \
      '    await memory.indexObservation(input);' \
      '  }' \
      '}' \
      'void indexObservationGroupsFromMessages(memory, {});' \
      > mastracode/sdk/scripts/index-messages.ts
    git add .
    git commit -q -m 'hide observation indexing in a numeric false branch'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/mastracode-observation-index-numeric-false-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Numeric-false observation-index branch unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must pass buildObservationIndexInput output to every indexObservation call' "$output"
  assert_contains 'mastracode/sdk/scripts/index-messages.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Numeric-false observation-index branch executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import { buildObservationIndexInput } from '../src/utils/observation-index-input';" \
      'declare const memory: { indexObservation(input: unknown): Promise<void> };' \
      'export async function indexObservationGroupsFromMessages(' \
      '  memory: { indexObservation(input: unknown): Promise<void> },' \
      '  candidate: unknown,' \
      ') {' \
      '  if (1 < 0) {' \
      '    const input = buildObservationIndexInput(candidate);' \
      '    if (!input) return;' \
      '    await memory.indexObservation(input);' \
      '  }' \
      '}' \
      'void indexObservationGroupsFromMessages(memory, {});' \
      > mastracode/sdk/scripts/index-messages.ts
    git add .
    git commit -q -m 'hide observation indexing in a constant-expression branch'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/mastracode-observation-index-constant-expression-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Constant-expression observation-index branch unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must pass buildObservationIndexInput output to every indexObservation call' "$output"
  assert_contains 'mastracode/sdk/scripts/index-messages.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Constant-expression observation-index branch executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import { buildObservationIndexInput } from '../src/utils/observation-index-input';" \
      'declare const memory: { indexObservation(input: unknown): Promise<void> };' \
      'export async function indexObservationGroupsFromMessages(' \
      '  memory: { indexObservation(input: unknown): Promise<void> },' \
      '  candidate: unknown,' \
      ') {' \
      "  switch ('skip' as string) {" \
      "    case 'run': {" \
      '      const input = buildObservationIndexInput(candidate);' \
      '      if (!input) return;' \
      '      await memory.indexObservation(input);' \
      '      break;' \
      '    }' \
      '  }' \
      '}' \
      'void indexObservationGroupsFromMessages(memory, {});' \
      > mastracode/sdk/scripts/index-messages.ts
    git add .
    git commit -q -m 'hide observation indexing in an unmatched switch case'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/mastracode-observation-index-switch-case-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Unmatched switch-case observation-index branch unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must pass buildObservationIndexInput output to every indexObservation call' "$output"
  assert_contains 'mastracode/sdk/scripts/index-messages.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Unmatched switch-case observation-index branch executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import { buildObservationIndexInput } from '../src/utils/observation-index-input';" \
      'declare const memory: { indexObservation(input: unknown): Promise<void> };' \
      'export async function indexObservationGroupsFromMessages(' \
      '  memory: { indexObservation(input: unknown): Promise<void> },' \
      '  candidate: unknown,' \
      ') {' \
      "  switch ('run' as string) {" \
      "    case 'run':" \
      '      break;' \
      '    default: {' \
      '      const input = buildObservationIndexInput(candidate);' \
      '      if (!input) return;' \
      '      await memory.indexObservation(input);' \
      '      break;' \
      '    }' \
      '  }' \
      '}' \
      'void indexObservationGroupsFromMessages(memory, {});' \
      > mastracode/sdk/scripts/index-messages.ts
    git add .
    git commit -q -m 'hide observation indexing in a shadowed switch default'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/mastracode-observation-index-switch-default-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Shadowed switch-default observation-index branch unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must pass buildObservationIndexInput output to every indexObservation call' "$output"
  assert_contains 'mastracode/sdk/scripts/index-messages.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Shadowed switch-default observation-index branch executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import { buildObservationIndexInput } from '../src/utils/observation-index-input';" \
      'declare const memory: { indexObservation(input: unknown): Promise<void> };' \
      'export async function indexMessages(candidate: unknown) {' \
      '  const input = buildObservationIndexInput(candidate);' \
      '  if (!input) return;' \
      '  await memory.indexObservation(input);' \
      '}' \
      'false && indexMessages({});' \
      > mastracode/sdk/scripts/index-messages.ts
    git add .
    git commit -q -m 'hide observation indexing behind a short-circuited entrypoint'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/mastracode-observation-index-short-circuit-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Short-circuited observation-index entrypoint unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must pass buildObservationIndexInput output to every indexObservation call' "$output"
  assert_contains 'mastracode/sdk/scripts/index-messages.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Short-circuited observation-index entrypoint executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import { buildObservationIndexInput } from '../src/utils/observation-index-input';" \
      'declare const memory: { indexObservation(input: unknown): Promise<void> };' \
      'export async function indexObservationGroupsFromMessages(' \
      '  memory: { indexObservation(input: unknown): Promise<void> },' \
      '  candidate: unknown,' \
      ') {' \
      '  const input = buildObservationIndexInput(candidate);' \
      '  if (!input) return;' \
      '  await memory.indexObservation(input);' \
      '}' \
      'class DormantInvocation {' \
      '  result = indexObservationGroupsFromMessages(memory, {});' \
      '}' \
      'void DormantInvocation;' \
      > mastracode/sdk/scripts/index-messages.ts
    git add .
    git commit -q -m 'hide observation indexing in an unconstructed class'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/mastracode-observation-index-dormant-class-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Dormant class observation-index entrypoint unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must pass buildObservationIndexInput output to every indexObservation call' "$output"
  assert_contains 'mastracode/sdk/scripts/index-messages.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Dormant class observation-index entrypoint executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import { buildObservationIndexInput } from '../src/utils/observation-index-input';" \
      'declare const memory: { indexObservation(input: unknown): Promise<void> };' \
      'export async function indexMessages(candidate: unknown) {' \
      '  return;' \
      '  const input = buildObservationIndexInput(candidate);' \
      '  if (!input) return;' \
      '  await memory.indexObservation(input);' \
      '}' \
      'void indexMessages({});' \
      > mastracode/sdk/scripts/index-messages.ts
    git add .
    git commit -q -m 'hide observation indexing after an unconditional return'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/mastracode-observation-index-post-return-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Post-return observation-index call unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must pass buildObservationIndexInput output to every indexObservation call' "$output"
  assert_contains 'mastracode/sdk/scripts/index-messages.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Post-return observation-index call executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import { buildObservationIndexInput } from '../src/utils/observation-index-input';" \
      'declare const memory: { indexObservation(input: unknown): Promise<void> };' \
      'void buildObservationIndexInput;' \
      'export async function indexMessages(candidate: unknown) {' \
      '  function buildObservationIndexInput(input: unknown) {' \
      '    return input;' \
      '  }' \
      '  const input = buildObservationIndexInput(candidate);' \
      '  await memory.indexObservation(input);' \
      '}' \
      > mastracode/sdk/scripts/index-messages.ts
    git add .
    git commit -q -m 'shadow observation index authorization helper'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/mastracode-observation-index-shadow-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Shadowed observation-index helper unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must pass buildObservationIndexInput output to every indexObservation call' "$output"
  assert_contains 'mastracode/sdk/scripts/index-messages.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Shadowed observation-index helper executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      'export function buildObservationIndexInput(candidate: unknown) {' \
      '  return { candidate, recordId: "helper-only-record-id-change" };' \
      '}' \
      > mastracode/sdk/src/utils/observation-index-input.ts
    git add .
    git commit -q -m 'change observation index helper only'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/mastracode-observation-helper-success.log"
  run_fixture "$head_sha" "$output"
  assert_contains 'Forcing owned MastraCode suites to run for source-only changes:' "$output"
  assert_contains 'mastracode/sdk/src/utils/__tests__/observation-index-input.test.ts' "$output"
  assert_contains 'turbo build --filter ./mastracode/sdk' "$command_log"
  assert_contains '--dir mastracode/sdk exec tsc-files --noEmit scripts/index-messages.ts' "$command_log"
  assert_contains '--dir mastracode/sdk exec vitest run' "$command_log"
  assert_contains 'src/utils/__tests__/observation-index-input.test.ts' "$command_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const googleCloudPubSub = "source-only-head";' \
      > pubsub/google-cloud-pubsub/src/index.ts
    git add .
    git commit -q -m 'google pubsub production-only change'
    git rev-parse HEAD
  )"
  : > "$command_log"
  : > "$service_log"
  output="$test_root/google-pubsub-production-success.log"
  run_fixture "$head_sha" "$output"
  assert_contains 'Forcing PF-2044 owned suites to run for source-only changes:' "$output"
  assert_contains 'pubsub/google-cloud-pubsub/src/group.test.ts' "$output"
  assert_contains '--filter ./pubsub/google-cloud-pubsub --fail-if-no-match exec tsc --noEmit' "$command_log"
  assert_contains '--filter ./pubsub/google-cloud-pubsub --fail-if-no-match build' "$command_log"
  assert_contains '--filter ./pubsub/google-cloud-pubsub --fail-if-no-match lint' "$command_log"
  assert_contains '--dir pubsub/google-cloud-pubsub exec vitest run' "$command_log"
  assert_contains 'google-cloud-pubsub-emulator 127.0.0.1:8085' "$service_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "it('redis streams head', () => {});" \
      >> pubsub/redis-streams/src/pubsub.test.ts
    git add .
    git commit -q -m 'redis streams test-only change'
    git rev-parse HEAD
  )"
  : > "$command_log"
  : > "$service_log"
  output="$test_root/redis-streams-test-success.log"
  run_fixture "$head_sha" "$output"
  assert_contains '--filter ./pubsub/redis-streams --fail-if-no-match exec tsc --noEmit' "$command_log"
  assert_contains '--filter ./pubsub/redis-streams --fail-if-no-match build' "$command_log"
  assert_contains '--filter ./pubsub/redis-streams --fail-if-no-match lint' "$command_log"
  assert_contains '--dir pubsub/redis-streams exec vitest run' "$command_log"
  assert_contains 'redis-streams 127.0.0.1:6381' "$service_log"

  : > "$command_log"
  : > "$service_log"
  output="$test_root/redis-streams-service-failure.log"
  set +e
  run_fixture "$head_sha" "$output" MOCK_UNAVAILABLE_SERVICE=redis-streams
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Unavailable Redis Streams service unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'Required redis-streams test service is unavailable at 127.0.0.1:6381.' "$output"
  if grep -Fq -- '--dir pubsub/redis-streams exec vitest run' "$command_log"; then
    echo 'Unavailable Redis Streams fixture executed its Vitest file.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const harnessStorage = "source-only-head";' \
      > stores/libsql/src/storage/domains/harness/index.ts
    git add .
    git commit -q -m 'libsql harness production-only change'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/libsql-harness-production-success.log"
  run_fixture "$head_sha" "$output"
  assert_contains 'Forcing PF-2044 owned suites to run for source-only changes:' "$output"
  assert_contains 'stores/libsql/src/storage/domains/harness/index.test.ts' "$output"
  assert_contains '--filter ./stores/libsql --fail-if-no-match exec tsc --noEmit' "$command_log"
  assert_contains '--filter ./stores/libsql --fail-if-no-match build:lib' "$command_log"
  assert_contains '--filter ./stores/libsql --fail-if-no-match lint' "$command_log"
  assert_contains '--dir stores/libsql exec vitest run' "$command_log"
  assert_contains 'src/storage/domains/harness/index.test.ts' "$command_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const libsqlStore = "transactional-harness-wiring";' \
      > stores/libsql/src/storage/index.ts
    git add .
    git commit -q -m 'libsql composite harness wiring'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/libsql-index-production-success.log"
  run_fixture "$head_sha" "$output"
  assert_contains 'Forcing PF-2044 owned suites to run for source-only changes:' "$output"
  assert_contains 'stores/libsql/src/storage/index.test.ts' "$output"
  assert_contains '--filter ./stores/libsql --fail-if-no-match exec tsc --noEmit' "$command_log"
  assert_contains '--filter ./stores/libsql --fail-if-no-match build:lib' "$command_log"
  assert_contains '--filter ./stores/libsql --fail-if-no-match lint' "$command_log"
  assert_contains '--dir stores/libsql exec vitest run' "$command_log"
  assert_contains 'src/storage/index.test.ts' "$command_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import type { HarnessRoute } from '../route-types.generated.js';" \
      'export type ClientHarnessRoute = HarnessRoute & { permissions: "durable" };' \
      > client-sdks/client-js/src/resources/harness.ts
    printf '%s\n' "import { it } from 'vitest';" "it('client harness head', () => {});" \
      > client-sdks/client-js/src/resources/harness.test.ts
    printf '%s\n' '# Harness session contract' '' 'PF-2246 aggregate contract.' \
      > harnessv1/sections/04-public-api/02-session/messages.md
    printf '%s\n' \
      'export function buildObservationIndexInput(candidate: unknown) {' \
      '  return { candidate, recordId: "record-1" };' \
      '}' \
      > mastracode/sdk/src/utils/observation-index-input.ts
    printf '%s\n' \
      "import { it } from 'vitest';" \
      "import { buildObservationIndexInput } from '../observation-index-input';" \
      "it('authorizes observation indexing', () => buildObservationIndexInput);" \
      > mastracode/sdk/src/utils/__tests__/observation-index-input.test.ts
    printf '%s\n' \
      "import { buildObservationIndexInput } from '../src/utils/observation-index-input';" \
      'declare const memory: { indexObservation(input: unknown): Promise<void> };' \
      'export async function indexObservationGroupsFromMessages(' \
      '  memory: { indexObservation(input: unknown): Promise<void> },' \
      '  candidate: unknown,' \
      ') {' \
      '  const input = buildObservationIndexInput(candidate);' \
      '  if (!input) return;' \
      '  await memory.indexObservation(input);' \
      '}' \
      'void indexObservationGroupsFromMessages(memory, {});' \
      > mastracode/sdk/scripts/index-messages.ts
    printf '%s\n' \
      "import { openai } from '@ai-sdk/openai-v5';" \
      "import { describe, expect, it } from 'vitest';" \
      "import { supervisorRuntime } from '../supervisor-runtime';" \
      "describe('Supervisor Pattern Integration Tests', () => {" \
      "  it('supervisor integration head', () => expect(supervisorRuntime).toBe('base'));" \
      '});' \
      "describe('Supervisor Pattern - Working memory forwarding', () => {" \
      '  it.skipIf(!process.env.OPENAI_API_KEY)(' \
      "    'keeps the reviewed provider smoke guarded'," \
      "    () => void openai('gpt-4o-mini')," \
      '  );' \
      '});' \
      > packages/core/src/agent/__tests__/supervisor-integration.test.ts
    printf '%s\n' \
      "import { createGatewayMock } from '@internal/test-utils';" \
      "import { afterAll, beforeAll, it } from 'vitest';" \
      'const mock = createGatewayMock({});' \
      'beforeAll(() => mock.start());' \
      'afterAll(() => mock.saveAndStop());' \
      'export function toolApprovalAndSuspensionTests() {' \
      "  it('tool approval head', () => {});" \
      '}' \
      > packages/core/src/agent/__tests__/tool-approval.e2e.test.ts
    printf '%s\n' "import { it } from 'vitest';" "it('permission gate head', () => {});" \
      > packages/core/src/harness/v1/session.permission-gate.e2e.test.ts
    printf '%s\n' "import { it } from 'vitest';" "it('plan task head', () => {});" \
      > packages/core/src/harness/v1/session.plan-task.e2e.test.ts
    printf '%s\n' 'export const harnessConformance = "pf-2246-head";' \
      > stores/_test-utils/src/domains/harness/index.ts
    printf '%s\n' \
      "import { describe } from 'vitest';" \
      "import { createHarnessTest } from './domains/harness';" \
      'export function createTestSuite(storage: unknown) {' \
      "  describe('Harness', () => {" \
      '    createHarnessTest({ storage });' \
      '  });' \
      "  describe('Other domain', () => {});" \
      '}' \
      > stores/_test-utils/src/factory.ts
    printf '%s\n' 'export const libsqlStore = "transactional-harness-wiring";' \
      > stores/libsql/src/storage/index.ts
    printf '%s\n' "import { it } from 'vitest';" "it('libsql composite head', () => {});" \
      > stores/libsql/src/storage/index.test.ts
    printf '%s\n' \
      'export type InngestAgentResumeOptions = { requireToolPermissionPolicy?: true; head?: true };' \
      > workflows/inngest/src/durable-agent/create-inngest-agent.ts
    printf '%s\n' \
      "import { expectTypeOf, it } from 'vitest';" \
      "import type { InngestAgentResumeOptions } from './create-inngest-agent';" \
      "it('keeps resume permission monotonic', () => expectTypeOf<InngestAgentResumeOptions>().toBeObject());" \
      > workflows/inngest/src/durable-agent/create-inngest-agent.test-d.ts
    printf '%s\n' "import { it } from 'vitest';" "it('create inngest agent head', () => {});" \
      > workflows/inngest/src/__tests__/create-inngest-agent.test.ts
    git add .
    git commit -q -m 'PF-2246 aggregate validation footprint'
    git rev-parse HEAD
  )"
  : > "$command_log"
  : > "$command_environment_log"
  output="$test_root/pf2246-aggregate-success.log"
  run_fixture "$head_sha" "$output" OPENAI_API_KEY=fixture-secret
  assert_contains '--dir mastracode/sdk exec tsc-files --noEmit scripts/index-messages.ts' "$command_log"
  assert_contains 'exec tsc-files --noEmit stores/_test-utils/src/domains/harness/index.ts stores/_test-utils/src/factory.ts stores/_test-utils/src/index.test.ts' "$command_log"
  assert_contains '--dir stores/_test-utils exec vitest run' "$command_log"
  assert_contains 'src/index.test.ts' "$command_log"
  for expected_test in \
    packages/core/src/agent/__tests__/supervisor-integration.test.ts \
    packages/core/src/agent/__tests__/tool-approval.e2e.test.ts \
    packages/core/src/harness/v1/session.permission-gate.e2e.test.ts \
    packages/core/src/harness/v1/session.plan-task.e2e.test.ts; do
    assert_contains "Running changed test file in full: $expected_test" "$output"
    assert_contains "${expected_test#packages/core/}" "$command_log"
  done
  assert_contains \
    $'LLM_TEST_MODE=replay\t--dir packages/core exec vitest run' \
    "$command_environment_log"
  assert_contains \
    $'OPENAI_API_KEY=\t--dir packages/core exec vitest run' \
    "$command_environment_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "export const supervisorRuntime = 'base';" \
      "export const supervisorRuntimeRevision = 'dependency-head';" \
      > packages/core/src/agent/supervisor-runtime.ts
    git add .
    git commit -q -m 'change a supervisor runtime dependency'
    git rev-parse HEAD
  )"
  : > "$command_log"
  : > "$command_environment_log"
  output="$test_root/core-supervisor-dependency-success.log"
  run_fixture "$head_sha" "$output" OPENAI_API_KEY=fixture-secret
  assert_contains \
    'Verified the exact supervisor suite provider-safety boundary.' \
    "$output"
  assert_contains \
    'Running changed test file in full: packages/core/src/agent/__tests__/supervisor-integration.test.ts' \
    "$output"
  assert_line_match_count 1 \
    '^--dir packages/core exec vitest run ' \
    "$command_log"
  assert_line_match_count 1 \
    '^--dir packages/core exec vitest run --reporter=dot --reporter=json --outputFile\.json=[^[:space:]]+ src/agent/__tests__/supervisor-integration\.test\.ts$' \
    "$command_log"
  assert_contains \
    $'OPENAI_API_KEY=\t--dir packages/core exec vitest run' \
    "$command_environment_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import { openai } from '@ai-sdk/openai-v5';" \
      "import { describe, expect, it } from 'vitest';" \
      "import { supervisorRuntime } from '../supervisor-runtime';" \
      "describe('Supervisor Pattern Integration Tests', () => {" \
      "  it('supervisor integration head', () => expect(supervisorRuntime).toBe('base'));" \
      '});' \
      "describe('Supervisor Pattern - Working memory forwarding', () => {" \
      '  it(' \
      "    'enable the provider smoke'," \
      "    () => void openai('gpt-4o-mini')," \
      '  );' \
      '});' \
      > packages/core/src/agent/__tests__/supervisor-integration.test.ts
    git add .
    git commit -q -m 'enable the supervisor provider smoke'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/core-supervisor-provider-gate-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Enabled supervisor provider smoke unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'may not modify the reviewed real-provider suite' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Enabled supervisor provider smoke executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import { createGatewayMock } from '@internal/test-utils';" \
      "import { afterAll, beforeAll, it } from 'vitest';" \
      "const mock = createGatewayMock({ mode: 'live' });" \
      'beforeAll(() => mock.start());' \
      'afterAll(() => mock.saveAndStop());' \
      'export function toolApprovalAndSuspensionTests() {' \
      "  it('tool approval head', () => {});" \
      '}' \
      > packages/core/src/agent/__tests__/tool-approval.e2e.test.ts
    git add .
    git commit -q -m 'override the tool approval replay mode'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/core-tool-approval-live-mode-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Live tool-approval recorder mode unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'may not modify its reviewed recorder setup or lifecycle' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Live tool-approval recorder mode executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    rm packages/core/src/agent/__tests__/tool-approval.e2e.test.ts
    ln -s supervisor-integration.test.ts \
      packages/core/src/agent/__tests__/tool-approval.e2e.test.ts
    git add .
    git commit -q -m 'replace exact Core exception with a symlink'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/core-exact-test-symlink-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Symlinked exact Core exception unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'packages/core/src/agent/__tests__/tool-approval.e2e.test.ts' "$output"
  assert_contains 'Failing closed instead of reporting incomplete validation as successful.' "$output"
  if grep -Fq -- 'exec vitest run' "$command_log"; then
    echo 'Symlinked exact Core exception executed a test suite.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    rm packages/core/src/harness/v1/session.permission-gate.e2e.test.ts
    ln -s missing-target.ts \
      packages/core/src/harness/v1/session.permission-gate.e2e.test.ts
    git add .
    git commit -q -m 'replace exact Core exception with a dangling symlink'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/core-exact-test-dangling-symlink-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Dangling exact Core exception unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'packages/core/src/harness/v1/session.permission-gate.e2e.test.ts' "$output"
  assert_contains 'Failing closed instead of reporting incomplete validation as successful.' "$output"
  if grep -Fq -- 'exec vitest run' "$command_log"; then
    echo 'Dangling exact Core exception executed a test suite.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const harnessConformance = "detached-head";' \
      > stores/_test-utils/src/domains/harness/index.ts
    printf '%s\n' \
      "import { describe } from 'vitest';" \
      "// import { createHarnessTest } from './domains/harness';" \
      'export function createTestSuite(_storage: unknown) {' \
      "  describe('Harness', () => {" \
      '    // createHarnessTest({ storage });' \
      '  });' \
      '}' \
      > stores/_test-utils/src/factory.ts
    printf '%s\n' "it('unrelated changed test', () => {});" \
      >> stores/_test-utils/src/index.test.ts
    git add .
    git commit -q -m 'detach shared Harness registration'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/storage-harness-detached-registration-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Detached shared Harness registration unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'These files are outside the PF-2044 owned source-and-test maps:' "$output"
  assert_contains 'stores/_test-utils/src/factory.ts' "$output"
  assert_contains 'Failing closed instead of reporting Core-only validation as workspace coverage.' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Detached shared Harness registration executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const harnessConformance = "mocked-registration-head";' \
      > stores/_test-utils/src/domains/harness/index.ts
    printf '%s\n' \
      "import { describe, vi } from 'vitest';" \
      "import { createHarnessTest } from './domains/harness';" \
      "vi.mock('./domains/' + 'harness', () => ({ createHarnessTest: () => undefined }));" \
      'export function createTestSuite(storage: unknown) {' \
      "  describe('Harness', () => {" \
      '    createHarnessTest({ storage });' \
      '  });' \
      '}' \
      > stores/_test-utils/src/factory.ts
    git add .
    git commit -q -m 'mock shared Harness registration'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/storage-harness-mocked-registration-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Mocked shared Harness registration unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must import createHarnessTest and register it unconditionally' "$output"
  assert_contains 'stores/_test-utils/src/factory.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Mocked shared Harness registration executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const harnessConformance = "mocked-entrypoint-head";' \
      > stores/_test-utils/src/domains/harness/index.ts
    printf '%s\n' \
      "import { MockStore } from '@mastra/core/storage';" \
      "import { vi } from 'vitest';" \
      "import { createTestSuite } from './factory';" \
      "vi.mock('./' + 'factory', () => ({ createTestSuite: () => undefined }));" \
      'createTestSuite(new MockStore());' \
      > stores/_test-utils/src/index.test.ts
    git add .
    git commit -q -m 'mock shared Harness entrypoint'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/storage-harness-mocked-entrypoint-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Mocked shared Harness entrypoint unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains \
    'must import createTestSuite and invoke it unconditionally at module scope with a new MockStore' \
    "$output"
  assert_contains 'stores/_test-utils/src/index.test.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Mocked shared Harness entrypoint executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const harnessConformance = "mocked-store-head";' \
      > stores/_test-utils/src/domains/harness/index.ts
    printf '%s\n' \
      "import { MockStore } from '@mastra/core/storage';" \
      "import { vi } from 'vitest';" \
      "import { createTestSuite } from './factory';" \
      "vi.mock('@mastra/core/storage', () => ({ MockStore: class {} }));" \
      'createTestSuite(new MockStore());' \
      > stores/_test-utils/src/index.test.ts
    git add .
    git commit -q -m 'mock the in-memory store behind the shared Harness entrypoint'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/storage-harness-mocked-store-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Mocked in-memory store unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains \
    'must import createTestSuite and invoke it unconditionally at module scope with a new MockStore' \
    "$output"
  assert_contains 'stores/_test-utils/src/index.test.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Mocked in-memory store executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  # PF-2306: a template-expression specifier whose substitutions are all constant
  # resolves to the same module identity as a literal. Mocking the in-memory
  # store through `@mastra/core/stora${`ge`}` must be caught the same way a
  # literal or concatenated specifier is, or the guard is evaded by obfuscation.
  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const harnessConformance = "mocked-store-template-head";' \
      > stores/_test-utils/src/domains/harness/index.ts
    printf '%s\n' \
      "import { MockStore } from '@mastra/core/storage';" \
      "import { vi } from 'vitest';" \
      "import { createTestSuite } from './factory';" \
      'vi.mock(`@mastra/core/stora${`ge`}`, () => ({ MockStore: class {} }));' \
      'createTestSuite(new MockStore());' \
      > stores/_test-utils/src/index.test.ts
    git add .
    git commit -q -m 'mock the in-memory store through a template-expression specifier'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/storage-harness-mocked-store-template-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Template-specifier store mock unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains \
    'must import createTestSuite and invoke it unconditionally at module scope with a new MockStore' \
    "$output"
  assert_contains 'stores/_test-utils/src/index.test.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Template-specifier store mock executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const harnessConformance = "shadowed-registration-head";' \
      > stores/_test-utils/src/domains/harness/index.ts
    printf '%s\n' \
      "import { describe } from 'vitest';" \
      "import { createHarnessTest } from './domains/harness';" \
      'void describe;' \
      'void createHarnessTest;' \
      'export function createTestSuite(storage: unknown) {' \
      '  function describe(_name: string, callback: () => void) {' \
      '    callback();' \
      '  }' \
      '  function createHarnessTest(_options: { storage: unknown }) {}' \
      "  describe('Harness', () => {" \
      '    createHarnessTest({ storage });' \
      '  });' \
      '}' \
      > stores/_test-utils/src/factory.ts
    git add .
    git commit -q -m 'shadow shared Harness registration imports'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/storage-harness-shadowed-registration-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Shadowed shared Harness registration unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must import createHarnessTest and register it unconditionally' "$output"
  assert_contains 'stores/_test-utils/src/factory.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Shadowed shared Harness registration executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const harnessConformance = "generator-registration-head";' \
      > stores/_test-utils/src/domains/harness/index.ts
    printf '%s\n' \
      "import { describe } from 'vitest';" \
      "import { createHarnessTest } from './domains/harness';" \
      'export function createTestSuite(storage: unknown) {' \
      "  describe('Harness', function* () {" \
      '    createHarnessTest({ storage });' \
      '  });' \
      '}' \
      > stores/_test-utils/src/factory.ts
    git add .
    git commit -q -m 'hide shared Harness registration in a generator callback'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/storage-harness-generator-registration-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Generator-backed shared Harness registration unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must import createHarnessTest and register it unconditionally' "$output"
  assert_contains 'stores/_test-utils/src/factory.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Generator-backed shared Harness registration executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const harnessConformance = "outer-generator-registration-head";' \
      > stores/_test-utils/src/domains/harness/index.ts
    printf '%s\n' \
      "import { describe } from 'vitest';" \
      "import { createHarnessTest } from './domains/harness';" \
      'export function* createTestSuite(storage: unknown) {' \
      "  describe('Harness', () => {" \
      '    createHarnessTest({ storage });' \
      '  });' \
      '}' \
      > stores/_test-utils/src/factory.ts
    git add .
    git commit -q -m 'hide shared Harness registration in a generator factory'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/storage-harness-outer-generator-registration-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Generator-backed shared Harness factory unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must import createHarnessTest and register it unconditionally' "$output"
  assert_contains 'stores/_test-utils/src/factory.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Generator-backed shared Harness factory executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const harnessConformance = "async-registration-head";' \
      > stores/_test-utils/src/domains/harness/index.ts
    printf '%s\n' \
      "import { describe } from 'vitest';" \
      "import { createHarnessTest } from './domains/harness';" \
      'export async function createTestSuite(storage: unknown) {' \
      '  await Promise.resolve();' \
      "  describe('Harness', () => {" \
      '    createHarnessTest({ storage });' \
      '  });' \
      '}' \
      > stores/_test-utils/src/factory.ts
    git add .
    git commit -q -m 'defer shared Harness registration in an async factory'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/storage-harness-async-registration-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Async shared Harness factory unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must import createHarnessTest and register it unconditionally' "$output"
  assert_contains 'stores/_test-utils/src/factory.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Async shared Harness factory executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const harnessConformance = "guarded-registration-head";' \
      > stores/_test-utils/src/domains/harness/index.ts
    printf '%s\n' \
      "import { describe } from 'vitest';" \
      "import { createHarnessTest } from './domains/harness';" \
      'export function createTestSuite(storage: unknown) {' \
      "  describe('Harness', () => {" \
      '    if (storage) return;' \
      '    createHarnessTest({ storage });' \
      '  });' \
      '}' \
      > stores/_test-utils/src/factory.ts
    git add .
    git commit -q -m 'guard shared Harness registration'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/storage-harness-guarded-registration-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Guarded shared Harness registration unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must import createHarnessTest and register it unconditionally' "$output"
  assert_contains 'stores/_test-utils/src/factory.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Guarded shared Harness registration executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const harnessConformance = "outer-guarded-registration-head";' \
      > stores/_test-utils/src/domains/harness/index.ts
    printf '%s\n' \
      "import { describe } from 'vitest';" \
      "import { createHarnessTest } from './domains/harness';" \
      'export function createTestSuite(storage: unknown) {' \
      '  if (storage) return;' \
      "  describe('Harness', () => {" \
      '    createHarnessTest({ storage });' \
      '  });' \
      '}' \
      > stores/_test-utils/src/factory.ts
    git add .
    git commit -q -m 'guard outer shared Harness registration'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/storage-harness-outer-guarded-registration-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Outer-guarded shared Harness registration unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must import createHarnessTest and register it unconditionally' "$output"
  assert_contains 'stores/_test-utils/src/factory.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Outer-guarded shared Harness registration executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const harnessConformance = "reassigned-storage-registration-head";' \
      > stores/_test-utils/src/domains/harness/index.ts
    printf '%s\n' \
      "import { describe } from 'vitest';" \
      "import { createHarnessTest } from './domains/harness';" \
      'export function createTestSuite(storage: unknown) {' \
      '  storage = undefined;' \
      "  describe('Harness', () => {" \
      '    createHarnessTest({ storage });' \
      '  });' \
      '}' \
      > stores/_test-utils/src/factory.ts
    git add .
    git commit -q -m 'replace shared Harness storage before registration'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/storage-harness-reassigned-storage-registration-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Reassigned shared Harness storage unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must import createHarnessTest and register it unconditionally' "$output"
  assert_contains 'stores/_test-utils/src/factory.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Reassigned shared Harness storage executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const harnessConformance = "overridden-storage-registration-head";' \
      > stores/_test-utils/src/domains/harness/index.ts
    printf '%s\n' \
      "import { describe } from 'vitest';" \
      "import { createHarnessTest } from './domains/harness';" \
      'export function createTestSuite(storage: unknown) {' \
      "  describe('Harness', () => {" \
      '    createHarnessTest({ storage, ...{ storage: undefined } });' \
      '  });' \
      '}' \
      > stores/_test-utils/src/factory.ts
    git add .
    git commit -q -m 'override shared Harness storage registration'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/storage-harness-overridden-storage-registration-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Overridden shared Harness storage registration unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must import createHarnessTest and register it unconditionally' "$output"
  assert_contains 'stores/_test-utils/src/factory.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Overridden shared Harness storage registration executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' \
      "import { MockStore } from '@mastra/core/storage';" \
      "import { createTestSuite } from './factory';" \
      'void MockStore;' \
      'void createTestSuite;' \
      > stores/_test-utils/src/index.test.ts
    git add .
    git commit -q -m 'detach shared Harness entrypoint'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/storage-harness-detached-entrypoint-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Detached shared Harness entrypoint unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'must import createTestSuite and invoke it unconditionally at module scope with a new MockStore' "$output"
  assert_contains 'stores/_test-utils/src/index.test.ts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Detached shared Harness entrypoint executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "import { it } from 'vitest';" "it('unknown Core E2E', () => {});" \
      > packages/core/src/harness/v1/session.unreviewed.e2e.test.ts
    git add .
    git commit -q -m 'unreviewed Core E2E'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/core-unknown-e2e-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Unknown Core E2E fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'packages/core/src/harness/v1/session.unreviewed.e2e.test.ts' "$output"
  assert_contains 'Failing closed instead of reporting incomplete validation as successful.' "$output"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const harnessConformance = "owned-plus-unreviewed-head";' \
      > stores/_test-utils/src/domains/harness/index.ts
    printf '%s\n' 'export const unknownHarnessFixture = true;' \
      > stores/_test-utils/src/domains/harness/unreviewed.ts
    git add .
    git commit -q -m 'unreviewed shared Harness source'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/storage-harness-unknown-source-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Unknown shared Harness source fixture unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'Storage test utility changes must include a changed Vitest file' "$output"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const unknownStorageHelper = true;' \
      > stores/_test-utils/src/unreviewed.ts
    ln -s missing-target.ts stores/_test-utils/src/authored.test.ts
    git add .
    git commit -q -m 'pair storage helper with dangling test symlink'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/storage-test-utils-dangling-test-symlink-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Dangling Storage Test Utils test symlink unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'stores/_test-utils/src/authored.test.ts' "$output"
  assert_contains 'Failing closed instead of reporting incomplete validation as successful.' "$output"
  if grep -Fq -- '--dir stores/_test-utils exec vitest run' "$command_log"; then
    echo 'Dangling Storage Test Utils test symlink executed the shared suite.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "it('libsql harness storage head', () => {});" \
      >> stores/libsql/src/storage/domains/harness/index.test.ts
    git add .
    git commit -q -m 'libsql harness test-only change'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/libsql-harness-test-success.log"
  run_fixture "$head_sha" "$output"
  assert_contains '--filter ./stores/libsql --fail-if-no-match exec tsc --noEmit' "$command_log"
  assert_contains '--filter ./stores/libsql --fail-if-no-match build:lib' "$command_log"
  assert_contains '--filter ./stores/libsql --fail-if-no-match lint' "$command_log"
  assert_contains '--dir stores/libsql exec vitest run' "$command_log"
  assert_contains 'src/storage/domains/harness/index.test.ts' "$command_log"

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const unreviewedHarnessStorage = true;' \
      > stores/libsql/src/storage/domains/harness/unreviewed.ts
    git add .
    git commit -q -m 'unreviewed libsql harness source'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/libsql-harness-unknown-source-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Unknown LibSQL Harness source unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'stores/libsql/src/storage/domains/harness/unreviewed.ts' "$output"
  assert_contains 'outside the PF-2044 owned source-and-test maps' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Unknown LibSQL Harness source fixture executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' "import { it } from 'vitest';" "it('unreviewed libsql harness', () => {});" \
      > stores/libsql/src/storage/domains/harness/unreviewed.test.ts
    git add .
    git commit -q -m 'unreviewed libsql harness test'
    git rev-parse HEAD
  )"
  : > "$command_log"
  output="$test_root/libsql-harness-unknown-test-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Unknown LibSQL Harness test unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'stores/libsql/src/storage/domains/harness/unreviewed.test.ts' "$output"
  assert_contains 'outside the PF-2044 owned service and runtime contracts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Unknown LibSQL Harness test fixture executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'export const unreviewed = true;' \
      > pubsub/google-cloud-pubsub/src/unreviewed.ts
    git add .
    git commit -q -m 'unreviewed owned-workspace source'
    git rev-parse HEAD
  )"
  : > "$command_log"
  : > "$service_log"
  output="$test_root/unknown-owned-source-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Unknown owned-workspace source unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'pubsub/google-cloud-pubsub/src/unreviewed.ts' "$output"
  assert_contains 'outside the PF-2044 owned source-and-test maps' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Unknown owned-workspace source fixture executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    printf '%s\n' 'services:' '  redis:' '    image: unreviewed:latest' \
      > pubsub/redis-streams/docker-compose.yaml
    git add .
    git commit -q -m 'unreviewed owned-workspace Compose change'
    git rev-parse HEAD
  )"
  : > "$command_log"
  : > "$service_log"
  output="$test_root/unknown-owned-compose-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Unknown owned-workspace Compose change unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'pubsub/redis-streams/docker-compose.yaml' "$output"
  assert_contains 'outside the PF-2044 owned source-and-test maps' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Unknown owned-workspace Compose fixture executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  head_sha="$(
    cd "$fixture_repo"
    git reset -q --hard "$base_sha"
    rm pubsub/google-cloud-pubsub/src/group.test.ts
    ln -s index.ts pubsub/google-cloud-pubsub/src/group.test.ts
    git add .
    git commit -q -m 'replace owned regression with symlink'
    git rev-parse HEAD
  )"
  : > "$command_log"
  : > "$service_log"
  output="$test_root/owned-test-symlink-failure.log"
  set +e
  run_fixture "$head_sha" "$output"
  status=$?
  set -e
  if (( status == 0 )); then
    echo 'Symlinked owned regression unexpectedly passed.' >&2
    cat "$output" >&2
    exit 1
  fi
  assert_contains 'pubsub/google-cloud-pubsub/src/group.test.ts' "$output"
  assert_contains 'outside the PF-2044 owned service and runtime contracts' "$output"
  if [[ -s "$command_log" ]]; then
    echo 'Symlinked owned regression fixture executed package commands.' >&2
    cat "$command_log" >&2
    exit 1
  fi

  echo 'PapersFlow fork validator fixtures passed.'
}

if [[ "${1:-}" == "--self-test" ]]; then
  run_validator_self_tests
  exit 0
fi

if [[ "${1:-}" == "--self-test-package-contracts" ]]; then
  run_validator_self_tests --package-contracts-only
  exit 0
fi


run_stagehand_validation_self_test() {
  local script_path test_root test_repo stub_bin command_log base_sha head_sha deleted_test_sha deletion_log
  local restored_test_sha renamed_test_sha rename_log
  script_path="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
  test_root="$(mktemp -d)"
  test_repo="$test_root/repo"
  stub_bin="$test_root/bin"
  command_log="$test_root/commands.log"
  trap 'rm -rf "$test_root"' RETURN

  mkdir -p "$test_repo/browser/stagehand/src/__tests__" "$test_repo/packages/core/src" "$stub_bin"
  cat > "$stub_bin/pnpm" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${VALIDATION_COMMAND_LOG:?}"

if [[ "$*" == *'--dir packages/core exec vitest list '* ]]; then
  test_file="${!#}"
  absolute_file="$(pwd)/packages/core/$test_file"
  if [[ "$*" == *'duplicate leaf$'* ]]; then
    printf '[{"name":"passing sibling > duplicate leaf","file":"%s"},{"name":"second sibling > duplicate leaf","file":"%s"}]\n' \
      "$absolute_file" "$absolute_file"
  else
    printf '[{"name":"outer suite > inner suite > unique nested case","file":"%s"}]\n' "$absolute_file"
  fi
  exit 0
fi

if [[ "$*" == *'--dir packages/core exec vitest run '* ]]; then
  test_file="${!#}"
  absolute_file="$(pwd)/packages/core/$test_file"
  output_file=''
  for argument in "$@"; do
    if [[ "$argument" == --outputFile.json=* ]]; then
      output_file="${argument#--outputFile.json=}"
    fi
  done
  : "${output_file:?Vitest JSON output path is required}"
  printf '{"numPassedTests":1,"numFailedTests":0,"testResults":[{"name":"%s","assertionResults":[{"status":"passed","ancestorTitles":["outer suite","inner suite"],"title":"unique nested case"}]}]}\n' \
    "$absolute_file" > "$output_file"
fi
STUB
  chmod +x "$stub_bin/pnpm"

  git -C "$test_repo" init --quiet
  git -C "$test_repo" config user.email validator@example.invalid
  git -C "$test_repo" config user.name 'Fork validator self-test'
  printf '{"name":"@mastra/stagehand"}\n' > "$test_repo/browser/stagehand/package.json"
  printf '{"name":"@mastra/core"}\n' > "$test_repo/packages/core/package.json"
  printf 'export type BrowserConfig = {}\n' > "$test_repo/browser/stagehand/src/types.ts"
  printf 'export {}\n' > "$test_repo/browser/stagehand/src/__tests__/profile-lifecycle.test.ts"
  git -C "$test_repo" add .
  git -C "$test_repo" commit --quiet -m base
  base_sha="$(git -C "$test_repo" rev-parse HEAD)"
  printf 'export type BrowserConfig = { recording?: boolean }\n' > "$test_repo/browser/stagehand/src/types.ts"
  git -C "$test_repo" commit --quiet -am head
  head_sha="$(git -C "$test_repo" rev-parse HEAD)"

  (
    cd "$test_repo"
    PATH="$stub_bin:$PATH" VALIDATION_COMMAND_LOG="$command_log" BASE_SHA="$base_sha" HEAD_SHA="$head_sha" \
      bash "$script_path"
  )

  grep -Fx -- 'build:core' "$command_log"
  grep -Fx -- '--filter ./browser/stagehand --fail-if-no-match build' "$command_log"
  grep -Fx -- '--filter ./browser/stagehand --fail-if-no-match lint' "$command_log"
  grep -Fx -- \
    '--dir browser/stagehand exec vitest run --reporter=dot --exclude src/__tests__/profile-lifecycle.test.ts' \
    "$command_log"

  rm "$test_repo/browser/stagehand/src/__tests__/profile-lifecycle.test.ts"
  git -C "$test_repo" commit --quiet -am 'delete browser-dependent test'
  deleted_test_sha="$(git -C "$test_repo" rev-parse HEAD)"
  deletion_log="$test_root/deletion.log"
  if (
    cd "$test_repo"
    PATH="$stub_bin:$PATH" VALIDATION_COMMAND_LOG="$command_log" BASE_SHA="$head_sha" HEAD_SHA="$deleted_test_sha" \
      bash "$script_path"
  ) 2> "$deletion_log"; then
    echo 'Stagehand fork validation accepted deletion of profile-lifecycle.test.ts.' >&2
    return 1
  fi
  grep -Fx -- 'browser/stagehand/src/__tests__/profile-lifecycle.test.ts' "$deletion_log"
  grep -F -- 'Failing closed instead of' "$deletion_log"

  printf 'export {}\n' > "$test_repo/browser/stagehand/src/__tests__/profile-lifecycle.test.ts"
  git -C "$test_repo" add browser/stagehand/src/__tests__/profile-lifecycle.test.ts
  git -C "$test_repo" commit --quiet -m 'restore browser-dependent test'
  restored_test_sha="$(git -C "$test_repo" rev-parse HEAD)"
  git -C "$test_repo" mv \
    browser/stagehand/src/__tests__/profile-lifecycle.test.ts \
    browser/stagehand/src/profile-lifecycle.ts
  git -C "$test_repo" commit --quiet -m 'rename browser-dependent test'
  renamed_test_sha="$(git -C "$test_repo" rev-parse HEAD)"
  rename_log="$test_root/rename.log"
  if (
    cd "$test_repo"
    PATH="$stub_bin:$PATH" VALIDATION_COMMAND_LOG="$command_log" \
      BASE_SHA="$restored_test_sha" HEAD_SHA="$renamed_test_sha" bash "$script_path"
  ) 2> "$rename_log"; then
    echo 'Stagehand fork validation accepted renaming profile-lifecycle.test.ts.' >&2
    return 1
  fi
  grep -Fx -- 'browser/stagehand/src/__tests__/profile-lifecycle.test.ts' "$rename_log"
  grep -F -- 'Failing closed instead of' "$rename_log"
  echo 'Stagehand fork-validation self-test passed.'
}

validation_started_at=$SECONDS
validation_budget_seconds=$((50 * 60))
validation_reserve_seconds=120

remaining_validation_seconds() {
  local maximum_seconds="$1"
  local elapsed_seconds=$((SECONDS - validation_started_at))
  local available_seconds=$((validation_budget_seconds - elapsed_seconds - validation_reserve_seconds))

  if (( available_seconds <= 0 )); then
    return 1
  fi
  if (( available_seconds < maximum_seconds )); then
    printf '%s\n' "$available_seconds"
  else
    printf '%s\n' "$maximum_seconds"
  fi
}

run_with_validation_budget() {
  local maximum_seconds="$1"
  shift
  local timeout_seconds

  if ! timeout_seconds="$(remaining_validation_seconds "$maximum_seconds")"; then
    echo "Validation budget exhausted before: $*" >&2
    return 124
  fi
  timeout --kill-after=30s "${timeout_seconds}s" "$@"
}

run_isolated_vitest_case() {
  local test_workspace="$1"
  local vitest_file="$2"
  local test_name="$3"
  local test_pattern="$4"
  local expected_test=""
  local list_result=""
  local status=0
  local test_result=""
  local timeout_seconds=""

  list_result="$(mktemp)"
  expected_test="$(mktemp)"
  test_result="$(mktemp)"

  if ! timeout_seconds="$(remaining_validation_seconds 240)"; then
    echo "Validation budget exhausted before collecting Agent signal test: $test_name" >&2
    rm -f "$list_result" "$expected_test" "$test_result"
    return 124
  fi

  echo "Collecting changed Agent signal test: $test_name"
  if timeout --kill-after=30s "${timeout_seconds}s" \
    pnpm --dir "$test_workspace" exec vitest list \
      --json -t "$test_pattern" "$vitest_file" > "$list_result"; then
    status=0
  else
    status=$?
    echo "Vitest could not collect the selected Agent signal case: $test_name" >&2
    rm -f "$list_result" "$expected_test" "$test_result"
    return "$status"
  fi

  if ! node - "$list_result" "$expected_test" "$test_name" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

try {
  const listed = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const selectedTitle = process.argv[4];
  if (!Array.isArray(listed)) {
    throw new Error('Vitest list did not return an array.');
  }
  if (listed.length !== 1) {
    throw new Error(
      `Expected exactly one collected Vitest test for ${JSON.stringify(selectedTitle)}; found ${listed.length}.`,
    );
  }

  const [expected] = listed;
  if (!expected || typeof expected.name !== 'string' || typeof expected.file !== 'string') {
    throw new Error('Vitest list returned an entry without a test name and file.');
  }
  fs.writeFileSync(
    process.argv[3],
    JSON.stringify({
      file: path.resolve(expected.file),
      name: expected.name,
    }),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
NODE
  then
    echo "The selected Agent signal case is not uniquely collectable; failing closed." >&2
    rm -f "$list_result" "$expected_test" "$test_result"
    return 1
  fi

  if ! timeout_seconds="$(remaining_validation_seconds 240)"; then
    echo "Validation budget exhausted before Agent signal test: $test_name" >&2
    rm -f "$list_result" "$expected_test" "$test_result"
    return 124
  fi

  echo "Running changed Agent signal test in isolation: $test_name"
  if timeout --kill-after=30s "${timeout_seconds}s" \
    pnpm --dir "$test_workspace" exec vitest run \
      --reporter=dot --reporter=json --outputFile.json="$test_result" \
      -t "$test_pattern" "$vitest_file"; then
    status=0
  else
    status=$?
  fi

  if (( status == 0 )); then
    if node - "$test_result" "$expected_test" "$test_name" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

try {
  const result = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const expected = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  const selectedTitle = process.argv[4];
  const passed = [];

  for (const testFile of result.testResults ?? []) {
    for (const assertion of testFile.assertionResults ?? []) {
      if (assertion.status === 'passed') passed.push({ assertion, file: testFile.name });
    }
  }

  if (result.numPassedTests !== 1 || result.numFailedTests !== 0 || passed.length !== 1) {
    throw new Error(
      `Expected exactly one passing Vitest assertion and no failures; reporter recorded ` +
        `${result.numPassedTests ?? 0} passed, ${result.numFailedTests ?? 0} failed, and ` +
        `${passed.length} passing assertion entries.`,
    );
  }

  const [{ assertion, file }] = passed;
  const reporterIdentity = [...(assertion.ancestorTitles ?? []), assertion.title].join(' > ');
  if (assertion.title !== selectedTitle) {
    throw new Error(
      `Vitest passed ${JSON.stringify(assertion.title)} instead of selected case ${JSON.stringify(selectedTitle)}.`,
    );
  }
  if (reporterIdentity !== expected.name) {
    throw new Error(
      `Vitest reporter identity ${JSON.stringify(reporterIdentity)} does not match collected identity ` +
        `${JSON.stringify(expected.name)}.`,
    );
  }
  if (typeof file !== 'string' || path.resolve(file) !== expected.file) {
    throw new Error(
      `Vitest reporter file ${JSON.stringify(file)} does not match collected file ${JSON.stringify(expected.file)}.`,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
NODE
    then
      status=0
    else
      status=$?
    fi
  fi

  rm -f "$list_result" "$expected_test" "$test_result"
  return "$status"
}

run_vitest_selection_regressions() (
  local duplicate_file=""
  local fixture_dir=""
  local test_log=""
  local test_workspace="packages/core"
  local unique_file=""

  if [[ ! -f "$test_workspace/package.json" ]]; then
    echo "Vitest selection self-test requires the packages/core workspace." >&2
    return 1
  fi

  fixture_dir="$(mktemp -d "$test_workspace/src/papersflow-vitest-selection.XXXXXX")"
  test_log="$(mktemp)"
  trap 'rm -rf "$fixture_dir"; rm -f "$test_log"' EXIT

  unique_file="$fixture_dir/unique-nested.test.ts"
  cat > "$unique_file" <<'TEST'
import { describe, expect, it } from 'vitest';

describe('outer suite', () => {
  describe('inner suite', () => {
    it('unique nested case', () => {
      expect(true).toBe(true);
    });
  });
});
TEST

  run_isolated_vitest_case \
    "$test_workspace" "${unique_file#"$test_workspace"/}" \
    'unique nested case' 'unique nested case$'

  duplicate_file="$fixture_dir/duplicate-leaf.test.ts"
  cat > "$duplicate_file" <<'TEST'
import { describe, expect, it } from 'vitest';

describe('passing sibling', () => {
  it('duplicate leaf', () => {
    expect(true).toBe(true);
  });
});

describe('second sibling', () => {
  it('duplicate leaf', () => {
    expect(true).toBe(true);
  });
});
TEST

  if run_isolated_vitest_case \
    "$test_workspace" "${duplicate_file#"$test_workspace"/}" \
    'duplicate leaf' 'duplicate leaf$' > "$test_log" 2>&1; then
    echo "Duplicate-leaf Vitest selection unexpectedly passed." >&2
    return 1
  fi
  if ! grep -Fq 'Expected exactly one collected Vitest test for "duplicate leaf"; found 2.' "$test_log"; then
    echo "Duplicate-leaf Vitest selection failed for an unexpected reason:" >&2
    cat "$test_log" >&2
    return 1
  fi

  echo "Vitest selection regressions passed: unique nested identity and duplicate-leaf fail-closed behavior."
  rm -rf "$fixture_dir"
  rm -f "$test_log"
  trap - EXIT
)

run_upstream_sync_validation() {
  local expected_lane="${1:?validation lane is required}"
  local issue_key="${2:?issue key is required}"
  : "${BASE_SHA:?BASE_SHA is required}"
  : "${HEAD_SHA:?HEAD_SHA is required}"

  local admission_output merge_base_sha path
  admission_output="$(mktemp)"
  GITHUB_OUTPUT="$admission_output" classify_install_lane
  if ! grep -Fxq "lane=$expected_lane" "$admission_output"; then
    echo "$issue_key dedicated validation ran without exact admission." >&2
    rm -f "$admission_output"
    return 1
  fi
  rm -f "$admission_output"

  if [[ "$expected_lane" == pf4051-upstream-sync ]]; then
    # Exact admission already checked the trusted shared main commit.
    # Whitespace belongs to the current upstream delta from its source parent.
    merge_base_sha="$(git rev-parse "$HEAD_SHA^1")"
  else
    merge_base_sha="$(git merge-base "$BASE_SHA" "$HEAD_SHA")"
  fi
  git diff --check "${merge_base_sha}..${HEAD_SHA}"

  # The upstream AgentController surface is additive. These Harness v1 paths
  # are the fork-owned compatibility boundary and must remain real tracked
  # files in the proposed tree.
  while IFS= read -r path; do
    if ! git_regular_file_at_revision "$HEAD_SHA" "$path"; then
      echo "$issue_key removed or replaced a required Harness/AgentController boundary: $path" >&2
      return 1
    fi
  done <<'EOF'
packages/core/src/harness/v1/contracts.ts
packages/core/src/harness/v1/harness.ts
packages/core/src/harness/v1/index.ts
packages/core/src/harness/v1/session.ts
packages/core/src/agent-controller/agent-controller.ts
packages/core/src/agent-controller/index.ts
packages/server/src/server/handlers/harness.ts
packages/server/src/server/handlers/agent-controller.ts
packages/server/src/server/server-adapter/routes/harness.ts
packages/server/src/server/server-adapter/routes/agent-controller.ts
client-sdks/client-js/src/resources/harness.ts
client-sdks/client-js/src/resources/agent-controller.ts
docs/src/content/en/docs/harness/overview.mdx
EOF

  echo 'Building and typechecking the preserved and adopted runtime boundaries.'
  # Turbo builds the core package's internal workspace dependencies. A fresh
  # runner has no dist artifacts, so typechecking before this build produces
  # cascading false missing-module errors from @internal/* and schema-compat.
  run_with_validation_budget 900 pnpm run build:core
  run_with_validation_budget 900 pnpm --filter @mastra/core --fail-if-no-match check
  run_with_validation_budget 900 pnpm run build:server
  run_with_validation_budget 900 pnpm --filter @mastra/client-js --fail-if-no-match build:lib
  run_with_validation_budget 600 pnpm --filter @mastra/react --fail-if-no-match build:js
  # The split SDK imports workspace packages through their built exports.
  # Build the complete SDK/TUI dependency graph before either tsc invocation;
  # otherwise a clean runner has no dist declarations for packages such as
  # MCP, LibSQL, observability, DuckDB, and FastEmbed.
  run_with_validation_budget 900 pnpm run build:mastracode
  run_with_validation_budget 600 pnpm --filter @mastra/code-sdk --fail-if-no-match check
  run_with_validation_budget 600 pnpm --filter mastracode --fail-if-no-match check
  run_with_validation_budget 600 pnpm --filter @mastra/slack --fail-if-no-match build
  run_with_validation_budget 600 pnpm --filter @mastra/vercel --fail-if-no-match build
  run_with_validation_budget 600 pnpm --filter @mastra/core --fail-if-no-match lint
  run_with_validation_budget 600 pnpm --filter @mastra/server --fail-if-no-match lint
  run_with_validation_budget 600 pnpm --filter @mastra/client-js --fail-if-no-match lint
  run_with_validation_budget 600 pnpm --filter @mastra/react --fail-if-no-match lint
  run_with_validation_budget 600 pnpm --filter @mastra/code-sdk --fail-if-no-match lint
  run_with_validation_budget 600 pnpm --filter mastracode --fail-if-no-match lint
  run_with_validation_budget 600 pnpm --filter @mastra/slack --fail-if-no-match typecheck
  run_with_validation_budget 600 pnpm --filter @mastra/vercel --fail-if-no-match lint
  if [[ "$expected_lane" == pf4051-upstream-sync ]]; then
    run_with_validation_budget 600 pnpm run check:core-imports packages/server
  elif [[ "$expected_lane" == pf4163-upstream-sync ]]; then
    run_standard_server_core_imports_check 600 --filter @mastra/server --fail-if-no-match
  else
    run_with_validation_budget 600 pnpm --filter @mastra/server --fail-if-no-match check:core-imports
  fi
  run_with_validation_budget 600 pnpm --filter @mastra/server --fail-if-no-match check:permissions
  run_with_validation_budget 600 pnpm --filter @mastra/server --fail-if-no-match generate:route-types
  run_with_validation_budget 600 pnpm --filter @mastra/server --fail-if-no-match generate:api-cli-route-metadata
  if ! git diff --exit-code "$HEAD_SHA" -- \
    client-sdks/client-js/src/route-types.generated.ts \
    packages/cli/src/commands/api/route-metadata.generated.ts \
    packages/core/src/auth/ee/interfaces/permissions.generated.ts \
    packages/_internals/auth/src/ee/interfaces/permissions.generated.ts; then
    echo "$issue_key generated route or permission artifacts are stale." >&2
    return 1
  fi

  echo 'Running the Harness v1, AgentController, workflow, and reconciliation suites.'
  run_with_validation_budget 1200 \
    pnpm --dir packages/core exec vitest run --reporter=dot \
      src/harness/v1 src/agent-controller src/workflows/evented
  run_with_validation_budget 1200 pnpm run test:mastracode
  run_with_validation_budget 600 \
    pnpm --dir client-sdks/client-js exec vitest run --reporter=dot \
      src/resources/harness.test.ts src/resources/agent-controller.test.ts
  run_with_validation_budget 600 \
    pnpm --dir packages/server exec vitest run --reporter=dot \
      src/server/handlers/harness.test.ts src/server/handlers/agent-controller.test.ts \
      src/server/server-adapter/routes/agent-controller.test.ts
  run_with_validation_budget 600 \
    pnpm --dir client-sdks/react exec vitest run --reporter=dot \
      src/agent/hooks.test.ts src/voice/use-speech-recognition.test.ts
  run_with_validation_budget 600 \
    pnpm --dir channels/slack exec vitest run --reporter=dot \
      src/__tests__/legacy-tool-display.test.ts
  run_with_validation_budget 600 \
    pnpm --dir workspaces/vercel exec vitest run --reporter=dot src/serverless/index.test.ts

  if [[ -f scripts/affected-tests.test.ts ]]; then
    run_with_validation_budget 600 pnpm exec vitest run --reporter=dot scripts/affected-tests.test.ts
  fi
  run_with_validation_budget 60 node scripts/affected-tests.mjs --self-test-symbol-exports

  echo "$issue_key dedicated upstream-sync validation passed."
}

run_pf558_upstream_sync_validation() {
  run_upstream_sync_validation pf558-upstream-sync PF-558
}

run_pf2009_upstream_sync_validation() {
  run_upstream_sync_validation pf2009-upstream-sync PF-2009
}

run_pf4051_upstream_sync_validation() {
  run_upstream_sync_validation pf4051-upstream-sync PF-4051

  echo 'Building/linting the PF-4051 workspace and testing the selected reconciliation boundaries.'
  run_with_validation_budget 1200 pnpm run build
  run_with_validation_budget 300 pnpm exec node "$PACKED_DECLARATION_CHECK" --package packages/agent-builder
  run_with_validation_budget 900 pnpm run lint
  # The dedicated sync lane exits before generic changed-workspace ownership.
  # Execute the native package contracts explicitly against the frozen source.
  run_with_validation_budget 120 node --check packages/_types-builder/src/index.js
  run_with_validation_budget 120 node --check packages/_types-builder/src/replace-types.js
  run_with_validation_budget 300 pnpm exec oxlint packages/_types-builder/src/index.js packages/_types-builder/src/replace-types.js
  run_with_validation_budget 600 pnpm exec tsc --project scripts/tsconfig.json --noEmit
  run_with_validation_budget 600 pnpm exec vitest run --reporter=dot scripts/types-builder.test.ts
  run_with_validation_budget 600 pnpm --filter ./packages/agent-builder --fail-if-no-match check
  run_with_validation_budget 600 pnpm --filter ./packages/agent-builder --fail-if-no-match check:fixtures
  run_with_validation_budget 600 pnpm --dir packages/agent-builder exec vitest run --reporter=dot src/agent-builder.test.ts
  run_with_validation_budget 600 pnpm --filter ./packages/server --fail-if-no-match exec tsc --noEmit
  run_with_validation_budget 600 pnpm --dir client-sdks/client-js exec tsc-files --noEmit \
    src/route-types.generated.ts src/types.ts src/resources/harness.ts src/resources/agent.test.ts
  run_with_validation_budget 600 pnpm --dir packages/cli exec tsc-files --noEmit \
    src/commands/api/route-metadata.generated.ts src/commands/api/index.ts src/commands/api/descriptors.test.ts
  run_with_validation_budget 600 pnpm --dir packages/cli exec vitest run --reporter=dot \
    src/commands/api/descriptors.test.ts src/services/service.file.test.ts
  run_with_validation_budget 600 pnpm --dir packages/playground-ui typecheck
  run_with_validation_budget 600 pnpm --dir packages/playground typecheck
  # The root lint task deliberately excludes the Playground application.
  run_with_validation_budget 600 pnpm --dir packages/playground lint
  run_with_validation_budget 600 pnpm --dir mastracode/factory-ui typecheck
  run_with_validation_budget 600 pnpm --dir mastracode/factory check
  # Web has its own pnpm root and lockfile, outside the monorepo install.
  run_with_validation_budget 600 pnpm --dir mastracode/web install --frozen-lockfile --ignore-scripts
  run_with_validation_budget 600 pnpm --dir mastracode/web check
  run_with_validation_budget 900 \
    pnpm --dir packages/core exec vitest run --reporter=dot \
      src/agent/durable/__tests__/durable-agent-cross-process-abort.test.ts \
      src/agent/durable/__tests__/suspended-run-discovery.test.ts \
      src/agent/durable/run-registry.test.ts \
      src/agent/durable/workflows/steps/signal-drain.test.ts \
      src/agent/durable/workflows/steps/tool-approval-recall.test.ts \
      src/events/caching-pubsub.test.ts \
      src/agent/durable/workflows/steps/tool-call-approval-context.test.ts \
      src/agent/durable/utils/resolve-runtime-approval.test.ts \
      src/tools/approval.test.ts \
      src/stream/base/output.test.ts \
      src/storage/domains/workflows/inmemory-persist.test.ts \
      src/storage/types.test.ts
  run_with_validation_budget 600 \
    pnpm --dir packages/core exec vitest run --reporter=dot \
      src/storage/workflow-snapshot.test.ts \
      src/workflows/default.test.ts \
      src/workflows/dynamic/validate/index.test.ts \
      src/mastra/add-dynamic-workflows-bundle.test.ts \
      src/workflows/scheduler/definition-hash.test.ts \
      src/loop/workflows/prune-snapshot.test.ts \
      src/loop/test-utils/aimock/scenarios/optional-agent-stages.scenario.test.ts \
      src/loop/test-utils/aimock/scenarios/optional-stages-approval.scenario.test.ts \
      src/loop/test-utils/aimock/scenarios/optional-stages-cancellation.scenario.test.ts \
      src/loop/test-utils/aimock/scenarios/optional-stages-mutable.scenario.test.ts \
      src/loop/test-utils/aimock/scenarios/evented-sequential-approval.scenario.test.ts
  run_with_validation_budget 600 \
    pnpm --dir stores/convex exec vitest run --reporter=dot src/server/storage.test.ts
  run_with_validation_budget 600 \
    pnpm --dir packages/memory exec vitest run --reporter=dot \
      src/processors/observational-memory/__tests__/sync-end-of-turn-observation.test.ts
  run_with_validation_budget 600 \
    pnpm --dir workspaces/platform-workspace exec vitest run --reporter=dot \
      src/sandbox.test.ts src/provider.test.ts
  run_with_validation_budget 600 \
    pnpm --filter @mastra/platform-workspace --fail-if-no-match test:types
  run_with_validation_budget 600 \
    pnpm --dir stores/valkey exec vitest run --reporter=dot src/index.test.ts
  run_with_validation_budget 600 \
    pnpm --dir packages/server exec vitest run --reporter=dot \
      src/server/schemas/dynamic-workflows.test.ts src/server/handlers/dynamic-workflows.test.ts
  run_with_validation_budget 600 \
    pnpm --dir stores/libsql exec vitest run --reporter=dot \
      src/storage/domains/workflows/atomic-resume.test.ts src/storage/index.test.ts \
      -t 'atomic.*resume|workflow-state guard|expected .* guard does not match|stale claim after suspended'
  run_with_validation_budget 600 \
    env POSTGRES_HOST="${POSTGRES_HOST:-127.0.0.1}" POSTGRES_PORT="${POSTGRES_PORT:-5434}" \
      pnpm --dir stores/pg exec vitest run --reporter=dot \
        src/storage/domains/workflows/atomic-resume.test.ts src/storage/index.test.ts \
        -t 'atomic.*resume|workflow-state guard|expected .* guard does not match|stale claim after suspended|read/write pools'
  run_with_validation_budget 600 \
    env POSTGRES_HOST="${POSTGRES_HOST:-127.0.0.1}" POSTGRES_PORT="${POSTGRES_PORT:-5434}" \
      pnpm --dir stores/pg exec vitest run --reporter=dot \
        src/storage/index.pinned-init.test.ts src/storage/enabled-domains.test.ts \
        src/storage/index.vnext.test.ts src/storage/domains/thread-state/index.test.ts \
        src/storage/domains/memory/read-fail-closed.test.ts \
        src/storage/domains/memory/working-memory-snapshot.test.ts \
        src/storage/domains/memory/lock-order.test.ts \
        src/storage/domains/memory/clone-rollback.test.ts
  run_with_validation_budget 900 \
    pnpm --dir workflows/inngest exec vitest run --no-isolate --reporter=dot \
      src/__tests__/create-inngest-agent.test.ts \
      src/durable-agent/create-inngest-agentic-workflow.test.ts \
      src/durable-agent/create-inngest-agentic-workflow.scorers.test.ts \
      src/workflow-failure-transport.test.ts
  run_with_validation_budget 600 \
    pnpm --dir pubsub/redis-streams exec vitest run --reporter=dot \
      src/connection-and-cleanup.test.ts \
      src/pubsub-ack-audit.test.ts

  echo 'Running incoming runtime, storage, Factory, and UI regressions.'
  run_with_validation_budget 900 \
    pnpm --dir packages/core exec vitest run --reporter=dot \
      src/agent/agent-processor.test.ts src/processors/runner.test.ts \
      src/agent/__tests__/agent-response-cache.test.ts \
      src/agent/__tests__/processor-workflow-stream-capability.test.ts \
      src/agent/__tests__/workspace-tool-context.test.ts \
      src/agent/__tests__/agentic-loop-snapshot-lifecycle.test.ts \
      src/agent/durable/step-start-chunk-shape.test.ts \
      src/agent/message-list/tests/message-list-v6.test.ts \
      src/agent/message-list/utils/provider-compat.test.ts \
      src/browser/__tests__/cli-handler.test.ts \
      src/datasets/experiment/__tests__/executor.test.ts \
      src/datasets/experiment/__tests__/runExperiment.test.ts \
      src/llm/model/model.test.ts \
      src/loop/workflows/agentic-execution/llm-execution-step.test.ts \
      src/loop/workflows/stream.test.ts \
      src/tools/tool-builder/schema-compat-validation.test.ts \
      src/workspace/tools/__tests__/execute-command.test.ts
  run_with_validation_budget 600 \
    pnpm --dir packages/server exec vitest run --reporter=dot \
      src/server/a2a/tasks.test.ts src/server/handlers/a2a-memory.test.ts \
      src/server/handlers/a2a.test.ts src/server/server-adapter/api-schema-manifest.test.ts
  run_with_validation_budget 600 \
    pnpm --dir server-adapters/hono exec vitest run --reporter=dot \
      src/__tests__/hono-adapter.test.ts \
      -t 'should strip mastra__resourceId|should strip reserved keys'
  run_with_validation_budget 600 \
    pnpm --dir packages/rag exec vitest run --reporter=dot src/document/transformers/character.test.ts
  run_with_validation_budget 600 \
    pnpm --dir packages/playground-ui exec vitest run --reporter=dot \
      src/domains/traces/components/__tests__/no-traces-info.test.tsx \
      src/ds/components/Combobox/combobox.test.tsx \
      src/ds/components/Section/section.test.tsx \
      src/ds/components/SettingsLayout/settings-layout.test.tsx \
      src/ds/components/ai/tool-call/tool-call.test.tsx
  run_with_validation_budget 600 \
    pnpm --dir packages/playground exec vitest run --reporter=dot \
      src/pages/agent-builder/__tests__/empty-collections.test.tsx \
      src/domains/experiments/components/__tests__/rerun-experiment-button.msw.test.tsx \
      src/pages/experiments/__tests__/experiments-compare.msw.test.tsx \
      src/pages/experiments/__tests__/experiments-run.msw.test.tsx \
      src/domains/experiments/__tests__/experiment-item-route.msw.test.tsx
  run_with_validation_budget 900 \
    pnpm --dir mastracode/factory-ui exec vitest run --reporter=dot \
      src/ui/domains/chat/components/__tests__/ChannelOriginBadge.msw.test.tsx \
      src/ui/domains/chat/components/__tests__/TranscriptMessageMeta.msw.test.tsx \
      src/ui/domains/chat/components/__tests__/TranscriptSender.msw.test.tsx \
      src/ui/domains/chat/components/__tests__/TranscriptToolRows.msw.test.tsx \
      src/ui/domains/chat/components/transcript-parts.test.ts \
      src/ui/domains/chat/services/__tests__/message-author.test.ts \
      src/ui/domains/chat/services/__tests__/transcript.test.ts \
      src/ui/domains/settings/components/__tests__/ModelPacksSection.msw.test.tsx \
      src/ui/domains/workspaces/components/__tests__/UserSessionFilters.msw.test.tsx \
      src/ui/domains/workspaces/services/__tests__/sessionFilters.test.ts
  run_with_validation_budget 900 \
    pnpm --dir mastracode/factory exec vitest run --reporter=dot \
      src/auth.test.ts src/auth-seam.test.ts src/boards/registry.test.ts src/boards/transition-policy.test.ts \
      src/factory.test.ts src/workspace.test.ts src/routes/work-items.test.ts \
      src/session/org-seed-fail-open.test.ts src/session/memory-settings-hydration.test.ts \
      src/integrations/github/default-rules.test.ts src/integrations/github/integration.test.ts \
      src/integrations/github/rules.test.ts src/integrations/issue-reconciler.test.ts \
      src/integrations/linear/default-rules.test.ts src/integrations/linear/integration.test.ts \
      src/integrations/linear/rules.test.ts src/integrations/platform/github/integration.test.ts \
      src/integrations/platform/linear/integration.test.ts src/integrations/slack/slack.test.ts \
      src/integrations/slack/integration.test.ts \
      src/rules/defaults.test.ts src/rules/dispatcher.test.ts src/rules/processor.test.ts \
      src/rules/resolve.test.ts src/rules/start-coordinator.test.ts src/rules/tools.test.ts \
      src/rules/transition-service.test.ts src/rules/validation.test.ts src/supervisor/read-tools.test.ts
  run_with_validation_budget 600 \
    pnpm --dir mastracode/web exec vitest run --reporter=dot src/mastra/index.test.ts
  # These voice suites mock hosted SDKs or connect only to their local WebSocket fixture.
  run_with_validation_budget 600 \
    pnpm --dir voice/google-gemini-live-api exec vitest run --reporter=dot src/index.test.ts
  run_with_validation_budget 600 \
    pnpm --dir voice/openai-realtime-api exec vitest run --reporter=dot \
      src/connection.test.ts src/connection.integration.test.ts

  echo 'PF-4051 workspace build/lint and selected reconciliation validation passed.'
}

run_pf3375_upstream_sync_validation() {
  run_upstream_sync_validation pf3375-upstream-sync PF-3375

  echo 'Validating the complete PF-3375 reconciled workspace and durable-runtime boundaries.'
  run_with_validation_budget 1200 pnpm run build
  run_with_validation_budget 900 pnpm run lint
  run_with_validation_budget 900 \
    pnpm --dir packages/core exec vitest run --reporter=dot \
      src/agent/durable/__tests__/durable-agent-cross-process-abort.test.ts \
      src/agent/durable/__tests__/suspended-run-discovery.test.ts \
      src/agent/durable/run-registry.test.ts \
      src/agent/durable/workflows/steps/signal-drain.test.ts \
      src/agent/durable/workflows/steps/tool-approval-recall.test.ts \
      src/events/caching-pubsub.test.ts
  run_with_validation_budget 900 \
    pnpm --dir workflows/inngest exec vitest run --no-isolate --reporter=dot \
      src/__tests__/create-inngest-agent.test.ts \
      src/durable-agent/create-inngest-agentic-workflow.test.ts \
      src/durable-agent/create-inngest-agentic-workflow.scorers.test.ts \
      src/workflow-failure-transport.test.ts
  run_with_validation_budget 600 \
    pnpm --dir pubsub/redis-streams exec vitest run --reporter=dot \
      src/connection-and-cleanup.test.ts \
      src/pubsub-ack-audit.test.ts

  echo 'PF-3375 complete workspace and durable-runtime validation passed.'
}

run_pf4163_upstream_sync_validation() {
  run_upstream_sync_validation pf4163-upstream-sync PF-4163

  echo 'Running native PF-4163 Agent Builder and Fastify package validation.'
  run_with_validation_budget 600 \
    pnpm --filter ./packages/agent-builder --fail-if-no-match check
  run_with_validation_budget 900 \
    pnpm --filter ./packages/agent-builder --fail-if-no-match test
  run_with_validation_budget 900 \
    pnpm --filter ./server-adapters/fastify --fail-if-no-match build
  run_with_validation_budget 900 \
    pnpm --filter ./server-adapters/fastify --fail-if-no-match test

  echo 'Running native PF-4163 correction Core and CLI validation.'
  # The focused CLI deploy test imports the native deployer and logger package
  # exports. Build those exports (and the deployer's bundled Hono adapter)
  # after the generic lane has built Core and Server.
  run_with_validation_budget 900 \
    pnpm --filter ./server-adapters/hono --fail-if-no-match build
  run_with_validation_budget 900 \
    pnpm --filter ./packages/deployer --fail-if-no-match build:lib
  run_with_validation_budget 900 \
    pnpm --filter ./packages/loggers --fail-if-no-match build:lib
  run_with_validation_budget 900 \
    pnpm --dir packages/core exec vitest run --reporter=dot \
      src/agent/__tests__/agent-signals.test.ts
  run_with_validation_budget 900 \
    pnpm --dir packages/cli exec vitest run --reporter=dot \
      src/commands/deploy/index.test.ts
}

run_pf3020_upstream_sync_validation() {
  run_upstream_sync_validation pf3020-upstream-sync PF-3020

  echo 'Validating the complete PF-3020 reconciled workspace and durable-runtime boundaries.'
  run_with_validation_budget 1200 pnpm run build
  run_with_validation_budget 900 pnpm run lint
  run_with_validation_budget 900 \
    pnpm --dir packages/core exec vitest run --reporter=dot \
      src/agent/durable/__tests__/durable-agent-cross-process-abort.test.ts \
      src/agent/durable/__tests__/suspended-run-discovery.test.ts \
      src/agent/durable/run-registry.test.ts \
      src/agent/durable/workflows/steps/signal-drain.test.ts \
      src/agent/durable/workflows/steps/tool-approval-recall.test.ts \
      src/events/caching-pubsub.test.ts
  run_with_validation_budget 900 \
    pnpm --dir workflows/inngest exec vitest run --no-isolate --reporter=dot \
      src/__tests__/create-inngest-agent.test.ts \
      src/durable-agent/create-inngest-agentic-workflow.test.ts \
      src/durable-agent/create-inngest-agentic-workflow.scorers.test.ts \
      src/workflow-failure-transport.test.ts
  run_with_validation_budget 600 \
    pnpm --dir pubsub/redis-streams exec vitest run --reporter=dot \
      src/connection-and-cleanup.test.ts \
      src/pubsub-ack-audit.test.ts

  echo 'PF-3020 complete workspace and durable-runtime validation passed.'
}

run_pf2576_upstream_sync_validation() {
  run_upstream_sync_validation pf2576-upstream-sync PF-2576

  echo 'Validating the complete PF-2576 reconciled workspace and merge boundaries.'
  run_with_validation_budget 1200 pnpm run build
  run_with_validation_budget 900 pnpm run lint
  run_with_validation_budget 900 \
    pnpm --dir packages/core exec vitest run --reporter=dot \
      src/agent/__tests__/agent-fga.test.ts \
      src/agent/durable/__tests__/suspended-run-discovery.test.ts \
      src/agent/durable/__tests__/durable-agent-tool-hooks.test.ts \
      src/agent/goal/activity.test.ts \
      src/background-tasks/manager.test.ts \
      src/workflows/terminal-continuation/graph-fingerprint.test.ts \
      src/workflows/terminal-continuation/graph-fingerprint-builder.test.ts
  run_with_validation_budget 900 \
    pnpm --dir packages/core exec vitest run --reporter=dot \
      src/agent/__tests__/agent-signals.test.ts

  echo 'PF-2576 complete workspace and merge-boundary validation passed.'
}

run_pf2247_upstream_sync_validation() {
  run_upstream_sync_validation pf2247-upstream-sync PF-2247

  echo 'Validating the complete PF-2247 reconciled workspace and corrected merge boundaries.'
  run_with_validation_budget 1200 pnpm run build
  run_with_validation_budget 900 pnpm run lint
  run_with_validation_budget 600 \
    pnpm --dir packages/core exec vitest run --reporter=dot \
      src/agent/durable/__tests__/agent-config-durable.test.ts \
      src/agent/durable/__tests__/durable-agent-memory.test.ts \
      src/mastra/recover-all-durable-agents.test.ts \
      src/workflows/default.test.ts
  run_with_validation_budget 600 \
    pnpm --dir workflows/inngest exec vitest run --no-isolate --reporter=dot \
      src/create-run-contract.test.ts \
      src/__tests__/create-inngest-agent.test.ts \
      src/__tests__/proxyref-verification.test.ts
  run_with_validation_budget 600 \
    pnpm --dir packages/server exec vitest run --reporter=dot \
      src/server/handlers/agents.test.ts -t RECOVER_ROUTE
  run_with_validation_budget 600 pnpm --dir deployers/sandbox test

  echo 'PF-2247 complete workspace and merge-boundary validation passed.'
}

run_pf2045_memory_transform_smoke() (
  : "${BASE_SHA:?BASE_SHA is required}"

  local smoke_file base_recording_file recording_path
  smoke_file="$(mktemp packages/memory/integration-tests/.pf2045-transform-request.XXXXXX.ts)"
  base_recording_file="$(mktemp)"
  recording_path='packages/memory/__recordings__/memory-integration-tests-src-agent-memory-v5.json'
  trap 'rm -f "$smoke_file" "$base_recording_file"' EXIT
  git show "$BASE_SHA:$recording_path" > "$base_recording_file"
  cat > "$smoke_file" <<'TS'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { transformRequest } from './src/transform-request';

type Recording = {
  hash: string;
  request: { url: string; body: { messages?: Array<{ role?: string; content?: unknown }> } };
};

const readRecordings = (path: string): Recording[] => {
  const parsed = JSON.parse(fs.readFileSync(path, 'utf8')) as { recordings?: unknown };
  assert.ok(Array.isArray(parsed.recordings), `${path} must contain a recordings array`);
  return parsed.recordings as Recording[];
};

const findReasoningRequest = (recordings: Recording[]): Recording[] =>
  recordings.filter(
    recording =>
      recording.request.url === 'https://openrouter.ai/api/v1/chat/completions' &&
      recording.request.body.messages?.some(
        message => message.role === 'user' && message.content === 'What is 2+2? Think through this carefully.',
      ),
  );

const baseMatches = findReasoningRequest(readRecordings(process.argv[2]!));
const incomingMatches = findReasoningRequest(readRecordings(process.argv[3]!));
assert.equal(baseMatches.length, 1, 'base recording must contain exactly one reviewed OpenRouter reasoning request');
assert.equal(incomingMatches.length, 1, 'incoming recording must contain exactly one reviewed OpenRouter reasoning request');

const baseRecording = baseMatches[0]!;
const incomingRecording = incomingMatches[0]!;
assert.equal(typeof baseRecording.request.body.messages?.[0]?.content, 'string');
assert.ok(Array.isArray(incomingRecording.request.body.messages?.[0]?.content));
const transformedIncomingRecording = transformRequest({
  url: incomingRecording.request.url,
  body: incomingRecording.request.body,
});
assert.equal(transformedIncomingRecording.url, baseRecording.request.url);
assert.deepEqual(
  transformedIncomingRecording.body,
  baseRecording.request.body,
  'the incoming OpenRouter recording must normalize to the exact previously replayable request signature',
);

const textParts = [
  { type: 'text', text: 'You are a helpful assistant ' },
  { type: 'text', text: 'that thinks through problems.' },
];
const openRouter = transformRequest({
  url: 'https://openrouter.ai/api/v1/chat/completions',
  body: { messages: [{ role: 'system', content: textParts }] },
});
assert.equal(
  (openRouter.body as { messages: Array<{ content: unknown }> }).messages[0]?.content,
  'You are a helpful assistant that thinks through problems.',
);

const otherProvider = transformRequest({
  url: 'https://api.openai.com/v1/chat/completions',
  body: { messages: [{ role: 'system', content: textParts }] },
});
assert.deepEqual(
  (otherProvider.body as { messages: Array<{ content: unknown }> }).messages[0]?.content,
  textParts,
);

const mixedContent = [{ type: 'text', text: 'caption' }, { type: 'image_url', image_url: 'https://example.invalid' }];
const mixed = transformRequest({
  url: 'https://openrouter.ai/api/v1/chat/completions',
  body: { messages: [{ role: 'user', content: mixedContent }] },
});
assert.deepEqual((mixed.body as { messages: Array<{ content: unknown }> }).messages[0]?.content, mixedContent);
TS
  run_with_validation_budget 300 pnpm exec tsx "$smoke_file" "$base_recording_file" "$recording_path"
)

run_pf2045_resolution_semantic_assertions() {
  run_with_validation_budget 60 node - <<'NODE'
const fs = require('node:fs');
const approvalTest = fs.readFileSync('client-sdks/ai-sdk/src/__tests__/tool-call-approval.test.ts', 'utf8');
const approvalE2E = fs.readFileSync('client-sdks/ai-sdk/src/__tests__/tool-call-approval.e2e.test.ts', 'utf8');
const chatRoute = fs.readFileSync('client-sdks/ai-sdk/src/chat-route.ts', 'utf8');
const approvalChangeset = fs.readFileSync('.changeset/fresh-donuts-divide.md', 'utf8');

const requireFragments = (source, label, fragments) => {
  for (const fragment of fragments) {
    if (!source.includes(fragment)) {
      throw new Error(`PF-2053 ${label} is missing reviewed contract fragment: ${fragment}`);
    }
  }
};

requireFragments(chatRoute, 'AI SDK approval route', [
  "type V6NativeApprovalInspection =",
  "{ status: 'none' | 'historical-only' | 'invalid'; approvals: [] }",
  "{ status: 'valid'; approvals: V6NativeApprovalResponse[] }",
  'const trailingMessage = messages.at(-1);',
  'const respondedParts = (trailingMessage.parts ?? []).filter(claimsV6NativeApprovalResponse);',
  "part => isToolUIPart(part) && part.state === 'approval-requested'",
  '.slice(0, -1)',
  "status: hasPendingApproval && hasHistoricalResponse ? 'historical-only' : 'none'",
  'const approvalIds = new Set<string>();',
  'const toolCallIds = new Set<string>();',
  'if (approvalIds.has(part.approval.id) || toolCallIds.has(toolCallId))',
  'for (const approval of approvals)',
  'runId: approval.runId,',
  'toolCallId: approval.toolCallId,',
  "if (part.type === 'error' || part.type === 'abort') return;",
  "id !== 'AGENT_RESUME_TOOL_CALL_NOT_SUSPENDED'",
  "id !== 'AGENT_RESUME_NO_SNAPSHOT_FOUND'",
  "if (inspection.status === 'invalid')",
  "if (inspection.status === 'historical-only')",
  'approvals: inspection.approvals,',
]);
for (const forbidden of [
  'scanAllAssistantMessages',
  'new Map<string, V6NativeApprovalResponse>()',
  'approval responses are collected across all assistant messages',
]) {
  if (chatRoute.includes(forbidden)) {
    throw new Error(`PF-2053 AI SDK approval route reintroduced unsafe whole-history behavior: ${forbidden}`);
  }
}

requireFragments(approvalTest, 'approval regression suite', [
  'extracts only responses from the trailing assistant message',
  'rejects an earlier-only approval response when a pending card is trailing',
  'allows a normal assistant continuation when only history contains an approval response',
  'isolates a trailing approval from history that repeats the same toolCallId',
  'rejects a malformed trailing approval response without falling through',
  'rejects duplicate decisions for one trailing tool card without executing either',
  'resumes multiple exact targets sequentially and keeps one framed response',
  'readUIMessageStream({',
  'stops the trailing batch on a fatal resume error',
  "it.each(['error', 'abort'] as const)",
  'honors disabled start and finish framing for a trailing approval batch',
]);
requireFragments(approvalE2E, 'approval replay E2E', [
  "describe('v6 trailing-message tool approval extraction (e2e)'",
  "it('resumes multiple exact targets from one trailing assistant message'",
  "id: 'message-approval-batch'",
  "expect(executedValues).toEqual(['VALUE_A', 'VALUE_B']);",
]);
requireFragments(approvalChangeset, 'approval changeset', [
  'multiple exact approval responses on the trailing assistant message',
  'Unsafe earlier-message-only, malformed, and ambiguous approval responses now fail closed',
]);
if (approvalChangeset.includes('collected across all assistant messages')) {
  throw new Error('PF-2053 approval changeset still advertises unsafe whole-history collection.');
}

const agentUtils = fs.readFileSync('packages/core/src/agent/utils.ts', 'utf8');
const fallbackStart = agentUtils.indexOf("console.warn('Error in tryStreamWithJsonFallback. Attempting fallback.'");
const fallbackEnd = agentUtils.indexOf('\n    return result;', fallbackStart);
if (fallbackStart < 0 || fallbackEnd < 0) {
  throw new Error('PF-2045 agent utils does not contain the reviewed structured-output stream fallback.');
}
const fallback = agentUtils.slice(fallbackStart, fallbackEnd);
let previousIndex = -1;
for (const token of [
  'const result = await agent.stream(prompt, {',
  'notifyStreamObserver(onStream, result',
  'const object = await result.object;',
  'if (object === undefined)',
]) {
  const tokenIndex = fallback.indexOf(token);
  if (tokenIndex <= previousIndex) {
    throw new Error(
      'PF-2045 agent utils must preserve the fork stream observer before the upstream fallback object guard.',
    );
  }
  previousIndex = tokenIndex;
}
if (fallback.includes('void onStream?.(')) {
  throw new Error('PF-2045 agent utils reintroduced the unguarded stream observer in the fallback path.');
}

const agent = fs.readFileSync('packages/core/src/agent/agent.ts', 'utf8');
const agentTypes = fs.readFileSync('packages/core/src/agent/types.ts', 'utf8');
const skillsTypes = fs.readFileSync('packages/core/src/skills/types.ts', 'utf8');
const agentTypeTests = fs.readFileSync('packages/core/src/agent/agent-types.test-d.ts', 'utf8');
requireFragments(agent, 'dynamic skills request-context implementation', [
  '#skills?: AgentSkillsInput<TRequestContext>;',
  'resolvedInputs = await this.#skills({ requestContext: rc as RequestContext<TRequestContext> });',
]);
requireFragments(agentTypes, 'dynamic skills Agent configuration', [
  'skills?: AgentSkillsInput<TRequestContext>;',
]);
requireFragments(skillsTypes, 'dynamic skills request-context types', [
  'export interface AgentSkillsContext<TRequestContext extends Record<string, any> | unknown = unknown>',
  'requestContext: RequestContext<TRequestContext>;',
  'export type AgentSkillsInput<TRequestContext extends Record<string, any> | unknown = unknown>',
]);
requireFragments(agentTypeTests, 'dynamic skills request-context type regression', [
  'should type requestContext in skills function based on requestContextSchema',
  "requestContext.get('documentId')",
  "requestContext.get('nonexistentKey')",
]);

const agents = fs.readFileSync('packages/server/src/server/handlers/agents.ts', 'utf8');
if (!/\.\.\.params,\s*requestContext,\s*memory:\s*authorizedMemoryOption,/.test(agents)) {
  throw new Error('PF-2045 agents.ts does not preserve request context plus authorized memory in the network call.');
}

const workspace = fs.readFileSync('pnpm-workspace.yaml', 'utf8').split(/\r?\n/);
for (const version of ['3.0.25', '3.0.28']) {
  const key = `  '@ai-sdk/provider-utils@${version}':`;
  const start = workspace.indexOf(key);
  if (start < 0) throw new Error(`Missing ${key}`);
  let end = start + 1;
  while (end < workspace.length && !/^  '[^']+':/.test(workspace[end])) end += 1;
  if (!workspace.slice(start + 1, end).some(line => line.trim() === 'vitest: 4.1.10')) {
    throw new Error(`${key} must resolve the catalog-aligned Vitest 4.1.10.`);
  }
}
if (!workspace.some(line => line === '  inngest-cli: false')) {
  throw new Error('PF-2045 must preserve the fork allowBuilds policy for inngest-cli.');
}
NODE
}

run_pf2045_incoming_validation() {
  : "${BASE_SHA:?BASE_SHA is required}"
  : "${HEAD_SHA:?HEAD_SHA is required}"

  echo 'Validating every reviewed runtime surface across 313 incoming official-upstream paths and the 312-path reconciled first-parent merge result.'

  mapfile -t pf2045_format_files < <(
    git diff --no-renames --name-only "$BASE_SHA..$HEAD_SHA" |
      grep -E '\.(cjs|css|js|json|jsx|md|mdx|mjs|ts|tsx|ya?ml)$' || true
  )
  if (( ${#pf2045_format_files[@]} > 0 )); then
    run_with_validation_budget 600 pnpm exec prettier --check "${pf2045_format_files[@]}"
  fi

  run_with_validation_budget 600 pnpm --filter ./client-sdks/ai-sdk --fail-if-no-match exec tsc --noEmit
  run_with_validation_budget 900 pnpm --filter ./client-sdks/ai-sdk --fail-if-no-match build:lib
  run_with_validation_budget 600 pnpm --filter ./client-sdks/ai-sdk --fail-if-no-match lint

  run_with_validation_budget 600 pnpm --filter ./packages/mcp --fail-if-no-match exec tsc --noEmit
  run_with_validation_budget 900 pnpm --filter ./packages/mcp --fail-if-no-match build:lib
  run_with_validation_budget 600 pnpm --filter ./packages/mcp --fail-if-no-match lint

  run_with_validation_budget 600 pnpm --filter ./packages/memory --fail-if-no-match check
  run_with_validation_budget 900 pnpm --filter ./packages/memory --fail-if-no-match build:lib
  run_with_validation_budget 600 pnpm --filter ./packages/memory --fail-if-no-match lint

  run_with_validation_budget 900 pnpm --filter ./packages/mcp-registry-registry --fail-if-no-match build
  run_with_validation_budget 600 pnpm --filter ./packages/mcp-registry-registry --fail-if-no-match build:cli
  run_with_validation_budget 600 pnpm --filter ./packages/mcp-registry-registry --fail-if-no-match lint

  run_with_validation_budget 900 pnpm --filter ./agent-sdks/acp --fail-if-no-match build
  run_with_validation_budget 600 pnpm --filter ./agent-sdks/acp --fail-if-no-match lint

  run_with_validation_budget 600 pnpm --dir docs validate
  run_with_validation_budget 600 pnpm --dir docs lint:remark

  run_with_validation_budget 1200 env LLM_TEST_MODE=replay \
    pnpm --dir packages/core exec vitest run --reporter=dot \
      src/a2a/a2a-agent.test.ts \
      src/agent/__tests__/goal.test.ts \
      src/agent/__tests__/scorers.test.ts \
      src/agent/__tests__/stream.e2e.test.ts \
      src/agent/__tests__/stream.test.ts \
      src/agent/__tests__/supervisor-integration.test.ts \
      src/agent/__tests__/tool-calls-finish-reason.e2e.test.ts \
      src/agent/__tests__/tool-handling.e2e.test.ts \
      src/agent/__tests__/tool-handling.test.ts \
      src/agent/__tests__/workspace-tools-openai.e2e.test.ts \
      src/agent/durable/__tests__/durable-agent-goal.test.ts \
      src/agent/goal/scorer.test.ts \
      src/agent/utils.test.ts \
      src/evals/base.test.ts \
      src/evals/run/index.test.ts \
      src/evals/run/multi-turn.scenario.test.ts \
      src/llm/model/cloudflare-workers-ai-url.test.ts \
      src/llm/model/embedding-router.e2e.test.ts \
      src/llm/model/gateways/models-dev.test.ts \
      src/llm/model/provider-registry.test.ts \
      src/llm/model/registry-generator.test.ts \
      src/llm/model/router-custom-provider.test.ts \
      src/loop/test-utils/aimock/scenarios/goal-default-scorer-json-fallback.scenario.test.ts \
      src/loop/workflows/agentic-execution/goal-step.test.ts \
      src/stream/aisdk/v5/execute.test.ts \
      src/stream/base/output-format-handlers.test.ts \
      src/tools/provider-tools.e2e.test.ts
  run_with_validation_budget 900 env LLM_TEST_MODE=replay \
    pnpm --dir client-sdks/ai-sdk exec vitest run --reporter=dot \
      src/__tests__/transform-agent-a2a-stream.test.ts \
      src/__tests__/tool-call-approval.test.ts \
      src/__tests__/tool-call-approval.e2e.test.ts \
      src/__tests__/harness-chat-stream.test.ts \
      src/__tests__/resume-stream.test.ts
  run_with_validation_budget 600 \
    pnpm --dir agent-sdks/acp exec vitest run --reporter=dot \
      src/__tests__/tool.test.ts
  run_with_validation_budget 600 pnpm --filter ./packages/mcp --fail-if-no-match test:client
  run_with_validation_budget 600 \
    pnpm --dir packages/server exec vitest run --reporter=dot \
      src/server/handlers/agents.test.ts
  run_with_validation_budget 600 \
    pnpm --dir packages/mcp-registry-registry exec vitest run --reporter=dot \
      src/registry/__tests__/list-registries.test.ts

  run_pf2045_resolution_semantic_assertions
  run_pf2045_memory_transform_smoke

  echo 'PF-2045 reviewed incoming runtime validation passed.'
}

run_standard_server_core_imports_check() {
  local maximum_seconds="$1"
  shift
  local root_owns_check

  # Read ownership as data; do not load a PR's check script to select its lane.
  root_owns_check="$(node - "$VALIDATOR_REPOSITORY_ROOT/package.json" <<'NODE'
const fs = require('node:fs');
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
process.stdout.write(String(Object.hasOwn(manifest.scripts ?? {}, 'check:core-imports')));
NODE
)" || return

  if [[ "$root_owns_check" == true ]]; then
    run_with_validation_budget "$maximum_seconds" pnpm run check:core-imports packages/server
  else
    run_with_validation_budget "$maximum_seconds" pnpm "$@" check:core-imports
  fi
}

run_pf2045_upstream_sync_validation() {
  run_upstream_sync_validation pf2045-upstream-sync PF-2045
  run_pf2045_incoming_validation
}

case "${1:-}" in
  --self-test-stagehand)
    run_stagehand_validation_self_test
    exit
    ;;
  --self-test-vitest-selection)
    run_vitest_selection_regressions
    exit
    ;;
  --validate-pf558-upstream-sync)
    run_pf558_upstream_sync_validation
    exit
    ;;
  --validate-pf2009-upstream-sync)
    run_pf2009_upstream_sync_validation
    exit
    ;;
  --validate-pf2045-upstream-sync)
    run_pf2045_upstream_sync_validation
    exit
    ;;
  --validate-pf4051-upstream-sync)
    run_pf4051_upstream_sync_validation
    exit
    ;;
  --validate-pf3375-upstream-sync)
    run_pf3375_upstream_sync_validation
    exit
    ;;
  --validate-pf4163-upstream-sync)
    run_pf4163_upstream_sync_validation
    exit
    ;;
  --validate-pf3020-upstream-sync)
    run_pf3020_upstream_sync_validation
    exit
    ;;
  --validate-pf2576-upstream-sync)
    run_pf2576_upstream_sync_validation
    exit
    ;;
  --validate-pf2247-upstream-sync)
    run_pf2247_upstream_sync_validation
    exit
    ;;
  --validate-pf2045-resolution-contracts)
    run_pf2045_resolution_semantic_assertions
    run_pf2045_memory_transform_smoke
    exit
    ;;
  '') ;;
  *)
    echo "Unknown validator argument: $1" >&2
    exit 2
    ;;
esac

: "${BASE_SHA:?BASE_SHA is required}"
: "${HEAD_SHA:?HEAD_SHA is required}"

merge_base_sha="$(git merge-base "$BASE_SHA" "$HEAD_SHA")"

changed_files="$(mktemp)"
changed_lockfile_importers="$(mktemp)"
changed_workspaces="$(mktemp)"
changed_tests="$(mktemp)"
fastify_changed_tests="$(mktemp)"
fastify_test_result="$(mktemp)"
forced_mastracode_tests="$(mktemp)"
forced_workspace_tests="$(mktemp)"
delegated_docs_tests="$(mktemp)"
deleted_tests="$(mktemp)"
fixer_test_result="$(mktemp)"
root_vitest_config_list="$(mktemp)"
unowned_files="$(mktemp)"
unsupported_inputs="$(mktemp)"
missing_mastracode_tests="$(mktemp)"
unsupported_mastracode_tests="$(mktemp)"
unsupported_mastracode_sources="$(mktemp)"
unsupported_tests="$(mktemp)"
unsupported_owned_workspace_sources="$(mktemp)"
unsupported_owned_workspace_tests="$(mktemp)"
unsupported_owned_workspace_pairs="$(mktemp)"
unsupported_workspaces="$(mktemp)"
workspace_candidates="$(mktemp)"
trap 'rm -f "$changed_files" "$changed_lockfile_importers" "$changed_workspaces" "$changed_tests" "$fastify_changed_tests" "$fastify_test_result" "$forced_mastracode_tests" "$forced_workspace_tests" "$delegated_docs_tests" "$deleted_tests" "$fixer_test_result" "$root_vitest_config_list" "$unowned_files" "$unsupported_inputs" "$missing_mastracode_tests" "$unsupported_mastracode_sources" "$unsupported_mastracode_tests" "$unsupported_tests" "$unsupported_owned_workspace_sources" "$unsupported_owned_workspace_tests" "$unsupported_owned_workspace_pairs" "$unsupported_workspaces" "$workspace_candidates"' EXIT

# Treat renames as a delete plus an add so both ownership boundaries are
# validated. Otherwise moving a generated artifact out of its canonical path
# can hide the source owner from a name-only diff.
git diff --no-renames --name-only --diff-filter=ACMRTD "${merge_base_sha}..${HEAD_SHA}" | sort > "$changed_files"

# Deleted Vitest files never reach the changed-test runner (it only enqueues
# files that exist at the proposed head), so removed coverage in owned
# workspaces would otherwise be accepted silently. Collect deletions here and
# fail closed on them below.
git diff --no-renames --name-only --diff-filter=D "${merge_base_sha}..${HEAD_SHA}" |
  grep -E '\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$|\.test-d\.ts$' |
  sort > "$deleted_tests" || true

echo "Changed files:"
cat "$changed_files"

# Recompute the PF-3553 semantic boundary in the main validator. The
# classifier's lane output is intentionally not consulted here: a spoofed or
# stale VALIDATION_LANE value must not suppress unsupported-manifest checks.
pf3553_config
pf3553_selected_route_exports=false
if grep -Eq \
  '^(packages/server/package\.json|server-adapters/fastify/package\.json)$' \
  "$changed_files"; then
  if verify_pf3553_selected_route_exports "$BASE_SHA" "$HEAD_SHA" &&
    verify_pf3553_reviewed_surface "$BASE_SHA" "$HEAD_SHA"; then
    pf3553_selected_route_exports=true
  fi
fi

git_regular_file_at_head() {
  git ls-tree "$HEAD_SHA" -- "$1" | grep -Eq '^100(644|755) blob '
}

core_supervisor_test_preserves_provider_gate() {
  if ! node - "$TYPESCRIPT_MODULE_PATH" "$merge_base_sha" "$HEAD_SHA" <<'NODE'
const { execFileSync } = require('node:child_process');
const ts = require(process.argv[2]);

const [baseSha, headSha] = process.argv.slice(3);
const file = 'packages/core/src/agent/__tests__/supervisor-integration.test.ts';
const read = sha => execFileSync('git', ['show', `${sha}:${file}`], { encoding: 'utf8' });
const parse = source => ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const baseSource = read(baseSha);
const headSource = read(headSha);
const base = parse(baseSource);
const head = parse(headSource);

function importTexts(sourceFile) {
  return sourceFile.statements
    .filter(ts.isImportDeclaration)
    .map(statement => statement.getText(sourceFile));
}

if (JSON.stringify(importTexts(base)) !== JSON.stringify(importTexts(head))) {
  throw new Error(`${file} may not change imports while it is admitted as a provider-safe exact suite.`);
}

function rootIdentifier(expression) {
  let current = expression;
  while (
    ts.isPropertyAccessExpression(current) ||
    ts.isElementAccessExpression(current)
  ) {
    current = current.expression;
  }
  return ts.isIdentifier(current) ? current.text : undefined;
}

function providerSuites(sourceFile) {
  const suites = [];
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      rootIdentifier(node.expression) === 'describe' &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      node.arguments[0].text === 'Supervisor Pattern - Working memory forwarding'
    ) {
      suites.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return suites;
}

const baseSuites = providerSuites(base);
const headSuites = providerSuites(head);
if (baseSuites.length !== 1 || headSuites.length !== 1) {
  throw new Error(`${file} must retain exactly one reviewed working-memory provider suite.`);
}
const baseSuiteText = baseSuites[0].getText(base);
const headSuite = headSuites[0];
const headSuiteText = headSuite.getText(head);
if (baseSuiteText !== headSuiteText) {
  throw new Error(`${file} may not modify the reviewed real-provider suite.`);
}
if (!headSuiteText.includes('it.skipIf(!process.env.OPENAI_API_KEY)')) {
  throw new Error(`${file} must keep its real-provider test behind the empty-key skip gate.`);
}

let openAiLocalName;
for (const statement of head.statements) {
  if (
    ts.isImportDeclaration(statement) &&
    ts.isStringLiteralLike(statement.moduleSpecifier) &&
    statement.moduleSpecifier.text === '@ai-sdk/openai-v5' &&
    statement.importClause?.namedBindings &&
    ts.isNamedImports(statement.importClause.namedBindings)
  ) {
    for (const element of statement.importClause.namedBindings.elements) {
      if ((element.propertyName ?? element.name).text === 'openai') {
        openAiLocalName = element.name.text;
      }
    }
  }
}
if (!openAiLocalName) {
  throw new Error(`${file} no longer has the reviewed OpenAI provider binding.`);
}

function insideProviderSuite(node) {
  return node.getStart(head) >= headSuite.getStart(head) && node.getEnd() <= headSuite.getEnd();
}

let invalidReference = false;
function visit(node) {
  if (
    ts.isIdentifier(node) &&
    (node.text === openAiLocalName || node.text === 'process') &&
    !insideProviderSuite(node)
  ) {
    const inReviewedImport =
      ts.isImportSpecifier(node.parent) ||
      (ts.isImportClause(node.parent) && node.parent.name === node);
    if (!inReviewedImport) invalidReference = true;
  }
  ts.forEachChild(node, visit);
}
visit(head);

if (invalidReference) {
  throw new Error(`${file} may not enable or reuse its real-provider binding outside the frozen skipped suite.`);
}
NODE
  then
    return 1
  fi
  echo 'Verified the exact supervisor suite provider-safety boundary.'
}

tool_approval_test_preserves_replay_harness() {
  node - "$TYPESCRIPT_MODULE_PATH" "$merge_base_sha" "$HEAD_SHA" <<'NODE'
const { execFileSync } = require('node:child_process');
const ts = require(process.argv[2]);

const [baseSha, headSha] = process.argv.slice(3);
const file = 'packages/core/src/agent/__tests__/tool-approval.e2e.test.ts';
const read = sha => execFileSync('git', ['show', `${sha}:${file}`], { encoding: 'utf8' });
const parse = source => ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const baseSource = read(baseSha);
const headSource = read(headSha);
const base = parse(baseSource);
const head = parse(headSource);

function imports(sourceFile) {
  return sourceFile.statements
    .filter(ts.isImportDeclaration)
    .map(statement => statement.getText(sourceFile));
}
if (JSON.stringify(imports(base)) !== JSON.stringify(imports(head))) {
  throw new Error(`${file} may not change imports while using the recorder-backed exact-suite exception.`);
}

function entrypoint(sourceFile) {
  const matches = sourceFile.statements.filter(
    statement =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === 'toolApprovalAndSuspensionTests',
  );
  if (matches.length !== 1) {
    throw new Error(`${file} must retain exactly one toolApprovalAndSuspensionTests entrypoint.`);
  }
  return matches[0];
}

const baseEntrypoint = entrypoint(base);
const headEntrypoint = entrypoint(head);
const basePrelude = baseSource.slice(0, baseEntrypoint.getStart(base));
const headPrelude = headSource.slice(0, headEntrypoint.getStart(head));
if (basePrelude !== headPrelude) {
  throw new Error(`${file} may not modify its reviewed recorder setup or lifecycle.`);
}
for (const fragment of [
  'const mock = createGatewayMock(',
  'beforeAll(() => mock.start());',
  'afterAll(() => mock.saveAndStop());',
]) {
  if (!headPrelude.includes(fragment)) {
    throw new Error(`${file} is missing reviewed replay-harness fragment: ${fragment}`);
  }
}

let gatewayCalls = 0;
let unsafeGatewayOptions = false;
let unsafeSuffixReference = false;
function propertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
}
function visit(node) {
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'createGatewayMock'
  ) {
    gatewayCalls++;
    const options = node.arguments[0];
    if (!options || !ts.isObjectLiteralExpression(options)) {
      unsafeGatewayOptions = true;
    } else {
      for (const property of options.properties) {
        if (ts.isSpreadAssignment(property)) {
          unsafeGatewayOptions = true;
          continue;
        }
        if (!ts.isPropertyAssignment(property)) continue;
        const name = propertyName(property.name);
        if (
          name === 'mode' &&
          !(ts.isStringLiteralLike(property.initializer) && property.initializer.text === 'replay')
        ) {
          unsafeGatewayOptions = true;
        }
        if (
          name === 'forceRecord' &&
          property.initializer.kind !== ts.SyntaxKind.FalseKeyword
        ) {
          unsafeGatewayOptions = true;
        }
      }
    }
  }
  if (
    node.getStart(head) >= headEntrypoint.getStart(head) &&
    ((ts.isIdentifier(node) &&
      ['createGatewayMock', 'mock', 'process', 'recorder'].includes(node.text)) ||
      (ts.isStringLiteralLike(node) && ['LLM_TEST_MODE', 'recorder'].includes(node.text)))
  ) {
    unsafeSuffixReference = true;
  }
  ts.forEachChild(node, visit);
}
visit(head);

if (gatewayCalls !== 1 || unsafeGatewayOptions || unsafeSuffixReference) {
  throw new Error(`${file} must retain one immutable replay-only gateway harness with no in-test override.`);
}
NODE
}

storage_harness_factory_registers_suite() {
  node - "$TYPESCRIPT_MODULE_PATH" "$HEAD_SHA" <<'NODE'
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const ts = require(process.argv[2]);

const [headSha] = process.argv.slice(3);
const factoryPath = 'stores/_test-utils/src/factory.ts';
const sourceText = execFileSync('git', ['show', `${headSha}:${factoryPath}`], {
  encoding: 'utf8',
  maxBuffer: 8 * 1024 * 1024,
});

function createCheckedSource(filePath, text) {
  const options = {
    noLib: true,
    noResolve: true,
    target: ts.ScriptTarget.Latest,
  };
  const resolvedPath = path.resolve(filePath);
  const host = ts.createCompilerHost(options, true);
  const originalFileExists = host.fileExists.bind(host);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  const originalReadFile = host.readFile.bind(host);
  host.fileExists = fileName =>
    path.resolve(fileName) === resolvedPath || originalFileExists(fileName);
  host.readFile = fileName =>
    path.resolve(fileName) === resolvedPath ? text : originalReadFile(fileName);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) =>
    path.resolve(fileName) === resolvedPath
      ? ts.createSourceFile(fileName, text, languageVersion, true, ts.ScriptKind.TS)
      : originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  const program = ts.createProgram([filePath], options, host);
  const source = program
    .getSourceFiles()
    .find(candidate => path.resolve(candidate.fileName) === resolvedPath);
  if (!source) throw new Error(`Unable to parse ${filePath}.`);
  return { checker: program.getTypeChecker(), source };
}

const { checker, source } = createCheckedSource(factoryPath, sourceText);

function unwrap(expression) {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function constantModuleName(expression) {
  const candidate = unwrap(expression);
  if (ts.isStringLiteralLike(candidate)) return candidate.text;
  if (ts.isTemplateExpression(candidate)) {
    // Fold a template whose every substitution is itself a constant string, so
    // `@mastra/core/stor${'age'}` resolves to the same module identity a plain
    // literal would. Matches the concatenation folding below and keeps the
    // guard from being evaded by template obfuscation.
    let text = candidate.head.text;
    for (const span of candidate.templateSpans) {
      const value = constantModuleName(span.expression);
      if (value === undefined) return undefined;
      text += value + span.literal.text;
    }
    return text;
  }
  if (
    ts.isBinaryExpression(candidate) &&
    candidate.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = constantModuleName(candidate.left);
    const right = constantModuleName(candidate.right);
    if (left !== undefined && right !== undefined) return left + right;
  }
  if (
    ts.isCallExpression(candidate) &&
    candidate.expression.kind === ts.SyntaxKind.ImportKeyword &&
    candidate.arguments[0]
  ) {
    return constantModuleName(candidate.arguments[0]);
  }
}

function callMemberName(expression) {
  const candidate = unwrap(expression);
  if (ts.isIdentifier(candidate)) return candidate.text;
  if (ts.isPropertyAccessExpression(candidate)) return candidate.name.text;
  if (
    ts.isElementAccessExpression(candidate) &&
    candidate.argumentExpression
  ) {
    return constantModuleName(candidate.argumentExpression);
  }
}

function mocksModule(moduleName) {
  let mocked = false;
  const mockMembers = new Set(['mock', 'doMock', 'unstable_mockModule', 'module']);
  function visit(node) {
    if (mocked) return;
    if (
      ts.isCallExpression(node) &&
      node.arguments[0] &&
      constantModuleName(node.arguments[0]) === moduleName &&
      mockMembers.has(callMemberName(node.expression))
    ) {
      mocked = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return mocked;
}

function importedBinding(moduleName, exportedName) {
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteralLike(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== moduleName ||
      !statement.importClause ||
      statement.importClause.isTypeOnly ||
      !statement.importClause.namedBindings ||
      !ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      continue;
    }
    for (const element of statement.importClause.namedBindings.elements) {
      if (!element.isTypeOnly && (element.propertyName ?? element.name).text === exportedName) {
        const symbol = checker.getSymbolAtLocation(element.name);
        if (symbol) return { symbol };
      }
    }
  }
}

function hasBinding(node, binding) {
  return (
    !!binding &&
    ts.isIdentifier(node) &&
    checker.getSymbolAtLocation(node) === binding.symbol
  );
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text;
}

function containsCallbackExit(statement) {
  let found = false;
  function visit(node) {
    if (found) return;
    if (node !== statement && ts.isFunctionLike(node)) return;
    if (ts.isReturnStatement(node) || ts.isThrowStatement(node)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(statement);
  return found;
}

function writesSymbol(statement, symbol) {
  let found = false;

  function containsSymbol(node) {
    let contains = false;
    function visit(candidate) {
      if (contains) return;
      if (ts.isIdentifier(candidate) && checker.getSymbolAtLocation(candidate) === symbol) {
        contains = true;
        return;
      }
      ts.forEachChild(candidate, visit);
    }
    visit(node);
    return contains;
  }

  function visit(node) {
    if (found) return;
    if (node !== statement && ts.isFunctionLike(node)) return;
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      containsSymbol(node.left)
    ) {
      found = true;
      return;
    }
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken ||
        node.operator === ts.SyntaxKind.MinusMinusToken) &&
      containsSymbol(node.operand)
    ) {
      found = true;
      return;
    }
    if (
      (ts.isForInStatement(node) || ts.isForOfStatement(node)) &&
      containsSymbol(node.initializer)
    ) {
      found = true;
      return;
    }
    if (
      ts.isDeleteExpression(node) &&
      containsSymbol(node.expression)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(statement);
  return found;
}

const describeBinding = importedBinding('vitest', 'describe');
const harnessBinding = importedBinding('./domains/harness', 'createHarnessTest');
const harnessModuleMocked = mocksModule('./domains/harness');
let registered = false;

for (const statement of source.statements) {
  if (
    registered ||
      !ts.isFunctionDeclaration(statement) ||
      statement.name?.text !== 'createTestSuite' ||
      !statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) ||
      statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword) ||
      !!statement.asteriskToken ||
      !statement.body
  ) {
    continue;
  }
  const storageParameter = statement.parameters[0]?.name;
  if (!storageParameter || !ts.isIdentifier(storageParameter)) continue;
  const storageSymbol = checker.getSymbolAtLocation(storageParameter);
  if (!storageSymbol) continue;

  for (const [bodyStatementIndex, bodyStatement] of statement.body.statements.entries()) {
    if (
      !ts.isExpressionStatement(bodyStatement) ||
      !ts.isCallExpression(bodyStatement.expression) ||
      !hasBinding(bodyStatement.expression.expression, describeBinding)
    ) {
      continue;
    }
    if (statement.body.statements.slice(0, bodyStatementIndex).some(containsCallbackExit)) {
      continue;
    }
    if (statement.body.statements.slice(0, bodyStatementIndex).some(candidate => writesSymbol(candidate, storageSymbol))) {
      continue;
    }
    const callback = bodyStatement.expression.arguments[1];
    if (
      !callback ||
      (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) ||
      callback.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword) ||
      (ts.isFunctionExpression(callback) && !!callback.asteriskToken) ||
      !ts.isBlock(callback.body)
    ) {
      continue;
    }

    registered = registered || callback.body.statements.some((candidate, candidateIndex) => {
      if (
        !ts.isExpressionStatement(candidate) ||
        !ts.isCallExpression(candidate.expression) ||
        !hasBinding(candidate.expression.expression, harnessBinding)
      ) {
        return false;
      }
      if (callback.body.statements.slice(0, candidateIndex).some(containsCallbackExit)) {
        return false;
      }
      if (callback.body.statements.slice(0, candidateIndex).some(statement => writesSymbol(statement, storageSymbol))) {
        return false;
      }
      const options = candidate.expression.arguments[0];
      if (!options || !ts.isObjectLiteralExpression(options)) return false;
      if (options.properties.length !== 1) return false;
      const property = options.properties[0];
      if (ts.isShorthandPropertyAssignment(property)) {
        return (
          property.name.text === 'storage' &&
          checker.getShorthandAssignmentValueSymbol(property) === storageSymbol
        );
      }
      return (
        ts.isPropertyAssignment(property) &&
        propertyName(property.name) === 'storage' &&
        hasBinding(property.initializer, { symbol: storageSymbol })
      );
    });
  }
}

if (!describeBinding || !harnessBinding || harnessModuleMocked || !registered) {
  console.error(
    `${factoryPath} must import createHarnessTest and register it unconditionally in createTestSuite's describe block without mocking the module.`,
  );
  process.exit(1);
}
NODE
}

storage_harness_entrypoint_registers_suite() {
  node - "$TYPESCRIPT_MODULE_PATH" "$HEAD_SHA" <<'NODE'
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const ts = require(process.argv[2]);

const [headSha] = process.argv.slice(3);
const testPath = 'stores/_test-utils/src/index.test.ts';
const sourceText = execFileSync('git', ['show', `${headSha}:${testPath}`], {
  encoding: 'utf8',
  maxBuffer: 8 * 1024 * 1024,
});

function createCheckedSource(filePath, text) {
  const options = {
    noLib: true,
    noResolve: true,
    target: ts.ScriptTarget.Latest,
  };
  const resolvedPath = path.resolve(filePath);
  const host = ts.createCompilerHost(options, true);
  const originalFileExists = host.fileExists.bind(host);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  const originalReadFile = host.readFile.bind(host);
  host.fileExists = fileName =>
    path.resolve(fileName) === resolvedPath || originalFileExists(fileName);
  host.readFile = fileName =>
    path.resolve(fileName) === resolvedPath ? text : originalReadFile(fileName);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) =>
    path.resolve(fileName) === resolvedPath
      ? ts.createSourceFile(fileName, text, languageVersion, true, ts.ScriptKind.TS)
      : originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  const program = ts.createProgram([filePath], options, host);
  const source = program
    .getSourceFiles()
    .find(candidate => path.resolve(candidate.fileName) === resolvedPath);
  if (!source) throw new Error(`Unable to parse ${filePath}.`);
  return { checker: program.getTypeChecker(), source };
}

const { checker, source } = createCheckedSource(testPath, sourceText);

function unwrap(expression) {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function constantModuleName(expression) {
  const candidate = unwrap(expression);
  if (ts.isStringLiteralLike(candidate)) return candidate.text;
  if (ts.isTemplateExpression(candidate)) {
    // Fold a template whose every substitution is itself a constant string, so
    // `@mastra/core/stor${'age'}` resolves to the same module identity a plain
    // literal would. Matches the concatenation folding below and keeps the
    // guard from being evaded by template obfuscation.
    let text = candidate.head.text;
    for (const span of candidate.templateSpans) {
      const value = constantModuleName(span.expression);
      if (value === undefined) return undefined;
      text += value + span.literal.text;
    }
    return text;
  }
  if (
    ts.isBinaryExpression(candidate) &&
    candidate.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = constantModuleName(candidate.left);
    const right = constantModuleName(candidate.right);
    if (left !== undefined && right !== undefined) return left + right;
  }
  if (
    ts.isCallExpression(candidate) &&
    candidate.expression.kind === ts.SyntaxKind.ImportKeyword &&
    candidate.arguments[0]
  ) {
    return constantModuleName(candidate.arguments[0]);
  }
}

function callMemberName(expression) {
  const candidate = unwrap(expression);
  if (ts.isIdentifier(candidate)) return candidate.text;
  if (ts.isPropertyAccessExpression(candidate)) return candidate.name.text;
  if (
    ts.isElementAccessExpression(candidate) &&
    candidate.argumentExpression
  ) {
    return constantModuleName(candidate.argumentExpression);
  }
}

function mocksModule(moduleName) {
  let mocked = false;
  const mockMembers = new Set(['mock', 'doMock', 'unstable_mockModule', 'module']);
  function visit(node) {
    if (mocked) return;
    if (
      ts.isCallExpression(node) &&
      node.arguments[0] &&
      constantModuleName(node.arguments[0]) === moduleName &&
      mockMembers.has(callMemberName(node.expression))
    ) {
      mocked = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return mocked;
}

function importedBinding(moduleName, exportedName) {
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteralLike(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== moduleName ||
      !statement.importClause ||
      statement.importClause.isTypeOnly ||
      !statement.importClause.namedBindings ||
      !ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      continue;
    }
    for (const element of statement.importClause.namedBindings.elements) {
      if (!element.isTypeOnly && (element.propertyName ?? element.name).text === exportedName) {
        const symbol = checker.getSymbolAtLocation(element.name);
        if (symbol) return { symbol };
      }
    }
  }
}

function hasBinding(node, binding) {
  return (
    !!binding &&
    ts.isIdentifier(node) &&
    checker.getSymbolAtLocation(node) === binding.symbol
  );
}

const suiteBinding = importedBinding('./factory', 'createTestSuite');
const mockStoreBinding = importedBinding('@mastra/core/storage', 'MockStore');
const factoryModuleMocked = mocksModule('./factory');
// Import bindings resolve to the same symbol whether or not the module is
// replaced at run time, so a mocked storage module would run the shared suite
// against a hand-written fake instead of the reviewed in-memory store.
const mockStoreModuleMocked = mocksModule('@mastra/core/storage');
const registered = source.statements.some(statement => {
  if (
    !ts.isExpressionStatement(statement) ||
    !ts.isCallExpression(statement.expression) ||
    !hasBinding(statement.expression.expression, suiteBinding)
  ) {
    return false;
  }
  const storage = statement.expression.arguments[0];
  return (
    !!storage &&
    ts.isNewExpression(storage) &&
    hasBinding(storage.expression, mockStoreBinding)
  );
});

if (
  !suiteBinding ||
  !mockStoreBinding ||
  factoryModuleMocked ||
  mockStoreModuleMocked ||
  !registered
) {
  console.error(
    `${testPath} must import createTestSuite and invoke it unconditionally at module scope with a new MockStore without mocking either module.`,
  );
  process.exit(1);
}
NODE
}

mastracode_observation_migration_uses_helper() {
  node - "$TYPESCRIPT_MODULE_PATH" "$HEAD_SHA" <<'NODE'
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const ts = require(process.argv[2]);

const [headSha] = process.argv.slice(3);
const scriptPath = 'mastracode/sdk/scripts/index-messages.ts';
const sourceText = execFileSync('git', ['show', `${headSha}:${scriptPath}`], {
  encoding: 'utf8',
  maxBuffer: 8 * 1024 * 1024,
});

function createCheckedSource(filePath, text) {
  const options = {
    noLib: true,
    noResolve: true,
    target: ts.ScriptTarget.Latest,
  };
  const resolvedPath = path.resolve(filePath);
  const host = ts.createCompilerHost(options, true);
  const originalFileExists = host.fileExists.bind(host);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  const originalReadFile = host.readFile.bind(host);
  host.fileExists = fileName =>
    path.resolve(fileName) === resolvedPath || originalFileExists(fileName);
  host.readFile = fileName =>
    path.resolve(fileName) === resolvedPath ? text : originalReadFile(fileName);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) =>
    path.resolve(fileName) === resolvedPath
      ? ts.createSourceFile(fileName, text, languageVersion, true, ts.ScriptKind.TS)
      : originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  const program = ts.createProgram([filePath], options, host);
  const source = program
    .getSourceFiles()
    .find(candidate => path.resolve(candidate.fileName) === resolvedPath);
  if (!source) throw new Error(`Unable to parse ${filePath}.`);
  return { checker: program.getTypeChecker(), source };
}

const { checker, source } = createCheckedSource(scriptPath, sourceText);

function importedBinding(moduleName, exportedName) {
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteralLike(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== moduleName ||
      !statement.importClause ||
      statement.importClause.isTypeOnly ||
      !statement.importClause.namedBindings ||
      !ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      continue;
    }
    for (const element of statement.importClause.namedBindings.elements) {
      if (!element.isTypeOnly && (element.propertyName ?? element.name).text === exportedName) {
        const symbol = checker.getSymbolAtLocation(element.name);
        if (symbol) return { symbol };
      }
    }
  }
}

const helperBinding = importedBinding(
  '../src/utils/observation-index-input',
  'buildObservationIndexInput',
);

function unwrap(expression) {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function isHelperCall(expression) {
  const candidate = unwrap(expression);
  const callee = ts.isCallExpression(candidate) ? unwrap(candidate.expression) : undefined;
  return (
    ts.isCallExpression(candidate) &&
    !!callee &&
    ts.isIdentifier(callee) &&
    !!helperBinding &&
    checker.getSymbolAtLocation(callee) === helperBinding.symbol
  );
}

function constantString(expression) {
  const candidate = unwrap(expression);
  if (ts.isStringLiteralLike(candidate)) return candidate.text;
  if (
    ts.isBinaryExpression(candidate) &&
    candidate.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = constantString(candidate.left);
    const right = constantString(candidate.right);
    if (left !== undefined && right !== undefined) return left + right;
  }
}

function isIndexObservationMember(node) {
  if (ts.isPropertyAccessExpression(node)) return node.name.text === 'indexObservation';
  return (
    ts.isElementAccessExpression(node) &&
    !!node.argumentExpression &&
    constantString(node.argumentExpression) === 'indexObservation'
  );
}

function enclosingExpression(node) {
  let current = node;
  while (
    current.parent &&
    (ts.isParenthesizedExpression(current.parent) ||
      ts.isAsExpression(current.parent) ||
      ts.isTypeAssertionExpression(current.parent) ||
      ts.isNonNullExpression(current.parent)) &&
    current.parent.expression === current
  ) {
    current = current.parent;
  }
  return current;
}

function containingStatement(node) {
  let current = node;
  while (current.parent && !ts.isBlock(current.parent) && !ts.isSourceFile(current.parent)) {
    if (ts.isFunctionLike(current.parent)) return undefined;
    current = current.parent;
  }
  return current.parent && ts.isStatement(current) ? current : undefined;
}

function nearestFunction(node) {
  let current = node.parent;
  while (current) {
    if (ts.isFunctionLike(current)) return current;
    current = current.parent;
  }
}

function topLevelFunction(node) {
  const owner = nearestFunction(node);
  return (
    owner &&
    ts.isFunctionDeclaration(owner) &&
    !!owner.name &&
    ts.isSourceFile(owner.parent)
      ? owner
      : undefined
  );
}

function staticConstant(expression) {
  const candidate = unwrap(expression);
  if (candidate.kind === ts.SyntaxKind.TrueKeyword) return { known: true, value: true };
  if (candidate.kind === ts.SyntaxKind.FalseKeyword) return { known: true, value: false };
  if (candidate.kind === ts.SyntaxKind.NullKeyword) return { known: true, value: null };
  if (ts.isNumericLiteral(candidate)) return { known: true, value: Number(candidate.text) };
  if (ts.isBigIntLiteral(candidate)) {
    return { known: true, value: BigInt(candidate.text.slice(0, -1)) };
  }
  if (ts.isStringLiteralLike(candidate)) return { known: true, value: candidate.text };
  if (ts.isIdentifier(candidate)) {
    if (candidate.text === 'undefined') return { known: true, value: undefined };
    if (candidate.text === 'NaN') return { known: true, value: Number.NaN };
    if (candidate.text === 'Infinity') return { known: true, value: Infinity };
  }
  if (ts.isNoSubstitutionTemplateLiteral(candidate)) {
    return { known: true, value: candidate.text };
  }
  if (ts.isTemplateExpression(candidate)) {
    let value = candidate.head.text;
    for (const span of candidate.templateSpans) {
      const expressionValue = staticConstant(span.expression);
      if (!expressionValue.known) return { known: false };
      value += String(expressionValue.value) + span.literal.text;
    }
    return { known: true, value };
  }
  if (ts.isPrefixUnaryExpression(candidate)) {
    const operand = staticConstant(candidate.operand);
    if (!operand.known) return { known: false };
    try {
      switch (candidate.operator) {
        case ts.SyntaxKind.ExclamationToken:
          return { known: true, value: !operand.value };
        case ts.SyntaxKind.PlusToken:
          return { known: true, value: +operand.value };
        case ts.SyntaxKind.MinusToken:
          return { known: true, value: -operand.value };
        case ts.SyntaxKind.TildeToken:
          return { known: true, value: ~operand.value };
        default:
          return { known: false };
      }
    } catch {
      return { known: false };
    }
  }
  if (ts.isVoidExpression(candidate)) {
    return { known: true, value: undefined };
  }
  if (ts.isBinaryExpression(candidate)) {
    const left = staticConstant(candidate.left);
    const operator = candidate.operatorToken.kind;
    if (operator === ts.SyntaxKind.CommaToken) return staticConstant(candidate.right);
    if (operator === ts.SyntaxKind.AmpersandAmpersandToken && left.known) {
      return left.value ? staticConstant(candidate.right) : left;
    }
    if (operator === ts.SyntaxKind.BarBarToken && left.known) {
      return left.value ? left : staticConstant(candidate.right);
    }
    if (operator === ts.SyntaxKind.QuestionQuestionToken && left.known) {
      return left.value === null || left.value === undefined
        ? staticConstant(candidate.right)
        : left;
    }
    const right = staticConstant(candidate.right);
    if (!left.known || !right.known) return { known: false };
    try {
      switch (operator) {
        case ts.SyntaxKind.PlusToken:
          return { known: true, value: left.value + right.value };
        case ts.SyntaxKind.MinusToken:
          return { known: true, value: left.value - right.value };
        case ts.SyntaxKind.AsteriskToken:
          return { known: true, value: left.value * right.value };
        case ts.SyntaxKind.SlashToken:
          return { known: true, value: left.value / right.value };
        case ts.SyntaxKind.PercentToken:
          return { known: true, value: left.value % right.value };
        case ts.SyntaxKind.AsteriskAsteriskToken:
          return { known: true, value: left.value ** right.value };
        case ts.SyntaxKind.LessThanToken:
          return { known: true, value: left.value < right.value };
        case ts.SyntaxKind.LessThanEqualsToken:
          return { known: true, value: left.value <= right.value };
        case ts.SyntaxKind.GreaterThanToken:
          return { known: true, value: left.value > right.value };
        case ts.SyntaxKind.GreaterThanEqualsToken:
          return { known: true, value: left.value >= right.value };
        case ts.SyntaxKind.EqualsEqualsToken:
          return { known: true, value: left.value == right.value };
        case ts.SyntaxKind.ExclamationEqualsToken:
          return { known: true, value: left.value != right.value };
        case ts.SyntaxKind.EqualsEqualsEqualsToken:
          return { known: true, value: left.value === right.value };
        case ts.SyntaxKind.ExclamationEqualsEqualsToken:
          return { known: true, value: left.value !== right.value };
        case ts.SyntaxKind.AmpersandToken:
          return { known: true, value: left.value & right.value };
        case ts.SyntaxKind.BarToken:
          return { known: true, value: left.value | right.value };
        case ts.SyntaxKind.CaretToken:
          return { known: true, value: left.value ^ right.value };
        case ts.SyntaxKind.LessThanLessThanToken:
          return { known: true, value: left.value << right.value };
        case ts.SyntaxKind.GreaterThanGreaterThanToken:
          return { known: true, value: left.value >> right.value };
        case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
          return { known: true, value: left.value >>> right.value };
        default:
          return { known: false };
      }
    } catch {
      return { known: false };
    }
  }
  return { known: false };
}

function staticBoolean(expression) {
  const constant = staticConstant(expression);
  return constant.known ? Boolean(constant.value) : undefined;
}

function isModuleInitialization(node) {
  let current = node.parent;
  while (current && !ts.isSourceFile(current)) {
    if (
      ts.isClassDeclaration(current) ||
      ts.isClassExpression(current)
    ) {
      return false;
    }
    current = current.parent;
  }
  return !!current;
}

function isStaticallyUnreachable(node, boundary) {
  let child = node;
  let parent = node.parent;
  while (parent) {
    if (
      (ts.isBlock(parent) || ts.isSourceFile(parent)) &&
      ts.isStatement(child)
    ) {
      const statementIndex = parent.statements.indexOf(child);
      if (
        statementIndex > 0 &&
        parent.statements
          .slice(0, statementIndex)
          .some(statementAlwaysExits)
      ) {
        return true;
      }
    }

    if (parent === boundary) break;

    // Switch dispatch is not modeled. A constant discriminant leaves a clause
    // body dead while every other authorization check still passes, and a
    // default clause is skipped whenever an earlier case matches, so every
    // clause body fails closed.
    if (ts.isCaseClause(parent) || ts.isDefaultClause(parent)) return true;

    // Loop bodies (for-of, for-in, and plain for) execute zero or more times
    // over a value the analysis cannot bound, so a guarded call inside one is
    // not guaranteed to run under the guard reasoned about in the enclosing
    // block. Treat the loop body as a disallowed position and fail closed,
    // mirroring the switch-clause rule; the loop head (iterable/initializer/
    // condition) still evaluates unconditionally and is left reachable.
    if (
      (ts.isForOfStatement(parent) || ts.isForInStatement(parent) || ts.isForStatement(parent)) &&
      child === parent.statement
    ) {
      return true;
    }

    if (ts.isBinaryExpression(parent) && child === parent.right) {
      const leftValue = staticBoolean(parent.left);
      if (
        (parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
          leftValue === false) ||
        (parent.operatorToken.kind === ts.SyntaxKind.BarBarToken && leftValue === true)
      ) {
        return true;
      }
    }

    const condition =
      ts.isIfStatement(parent) ||
      ts.isConditionalExpression(parent) ||
      ts.isWhileStatement(parent) ||
      ts.isForStatement(parent)
        ? parent.expression
        : undefined;
    const value = condition ? staticBoolean(condition) : undefined;

    if (ts.isIfStatement(parent) && value !== undefined) {
      if ((child === parent.thenStatement && !value) || (child === parent.elseStatement && value)) {
        return true;
      }
    } else if (ts.isConditionalExpression(parent) && value !== undefined) {
      if ((child === parent.whenTrue && !value) || (child === parent.whenFalse && value)) {
        return true;
      }
    } else if (ts.isWhileStatement(parent) && child === parent.statement && value === false) {
      return true;
    } else if (
      ts.isForStatement(parent) &&
      child === parent.statement &&
      parent.condition &&
      staticBoolean(parent.condition) === false
    ) {
      return true;
    }

    child = parent;
    parent = parent.parent;
  }
  return false;
}

const topLevelFunctions = new Map();
for (const statement of source.statements) {
  if (ts.isFunctionDeclaration(statement) && statement.name && !statement.asteriskToken) {
    const symbol = checker.getSymbolAtLocation(statement.name);
    if (symbol) topLevelFunctions.set(symbol, statement);
  }
}

const topLevelCallGraph = new Map();
const rootCalls = new Set();

function directCalleeSymbol(call) {
  const callee = unwrap(call.expression);
  return ts.isIdentifier(callee) ? checker.getSymbolAtLocation(callee) : undefined;
}

function collectTopLevelCallGraph(node) {
  if (ts.isCallExpression(node)) {
    const targetSymbol = directCalleeSymbol(node);
    if (targetSymbol && topLevelFunctions.has(targetSymbol)) {
      const owner = topLevelFunction(node);
      if (owner && nearestFunction(node) === owner && !isStaticallyUnreachable(node, owner)) {
        const ownerSymbol = checker.getSymbolAtLocation(owner.name);
        if (ownerSymbol) {
          const callees = topLevelCallGraph.get(ownerSymbol) ?? new Set();
          callees.add(targetSymbol);
          topLevelCallGraph.set(ownerSymbol, callees);
        }
      } else if (
        !nearestFunction(node) &&
        isModuleInitialization(node) &&
        !isStaticallyUnreachable(node, source)
      ) {
        rootCalls.add(targetSymbol);
      }
    }
  }
  ts.forEachChild(node, collectTopLevelCallGraph);
}
collectTopLevelCallGraph(source);

const reachableTopLevelFunctions = new Set(rootCalls);
const pendingTopLevelFunctions = [...rootCalls];
while (pendingTopLevelFunctions.length > 0) {
  const owner = pendingTopLevelFunctions.pop();
  for (const callee of topLevelCallGraph.get(owner) ?? []) {
    if (!reachableTopLevelFunctions.has(callee)) {
      reachableTopLevelFunctions.add(callee);
      pendingTopLevelFunctions.push(callee);
    }
  }
}

function statementAlwaysExits(statement) {
  if (
    ts.isReturnStatement(statement) ||
    ts.isThrowStatement(statement) ||
    ts.isContinueStatement(statement) ||
    ts.isBreakStatement(statement)
  ) {
    return true;
  }
  if (ts.isBlock(statement)) {
    const last = statement.statements.at(-1);
    return !!last && statementAlwaysExits(last);
  }
  if (ts.isIfStatement(statement)) {
    const value = staticBoolean(statement.expression);
    if (value === true) return statementAlwaysExits(statement.thenStatement);
    if (value === false) {
      return !!statement.elseStatement && statementAlwaysExits(statement.elseStatement);
    }
    return (
      !!statement.elseStatement &&
      statementAlwaysExits(statement.thenStatement) &&
      statementAlwaysExits(statement.elseStatement)
    );
  }
  if (ts.isTryStatement(statement)) {
    // A finally that always exits dominates every other completion path.
    if (statement.finallyBlock && statementAlwaysExits(statement.finallyBlock)) {
      return true;
    }
    // Otherwise both the normal-completion path (the try block) and, when
    // present, the exception path (the catch block) must always exit. Required
    // conservatively so a catch that falls through is never mistaken for a
    // guard that always exits.
    if (!statementAlwaysExits(statement.tryBlock)) return false;
    return !statement.catchClause || statementAlwaysExits(statement.catchClause.block);
  }
  return false;
}

function missingInputGuardIdentifier(statement, symbol) {
  if (!ts.isIfStatement(statement)) return undefined;
  const condition = unwrap(statement.expression);
  if (
    !ts.isPrefixUnaryExpression(condition) ||
    condition.operator !== ts.SyntaxKind.ExclamationToken
  ) {
    return undefined;
  }
  const identifier = unwrap(condition.operand);
  if (
    !ts.isIdentifier(identifier) ||
    checker.getSymbolAtLocation(identifier) !== symbol ||
    !statementAlwaysExits(statement.thenStatement)
  ) {
    return undefined;
  }
  return identifier;
}

function helperBackedIdentifier(call, identifier) {
  const owner = topLevelFunction(call);
  const ownerSymbol = owner?.name ? checker.getSymbolAtLocation(owner.name) : undefined;
  const memoryParameter = owner?.parameters[0]?.name;
  const memoryMember = unwrap(call.expression);
  const memoryReceiver =
    (ts.isPropertyAccessExpression(memoryMember) || ts.isElementAccessExpression(memoryMember))
      ? unwrap(memoryMember.expression)
      : undefined;
  if (
    !owner ||
    owner.name?.text !== 'indexObservationGroupsFromMessages' ||
    !memoryParameter ||
    !ts.isIdentifier(memoryParameter) ||
    !memoryReceiver ||
    !ts.isIdentifier(memoryReceiver) ||
    checker.getSymbolAtLocation(memoryReceiver) !== checker.getSymbolAtLocation(memoryParameter) ||
    !ownerSymbol ||
    nearestFunction(call) !== owner ||
    !reachableTopLevelFunctions.has(ownerSymbol) ||
    isStaticallyUnreachable(call, owner)
  ) {
    return false;
  }

  const statement = containingStatement(call);
  const container = statement?.parent;
  if (!statement || (!ts.isBlock(container) && !ts.isSourceFile(container))) return false;
  const statementIndex = container.statements.indexOf(statement);
  if (statementIndex < 0) return false;
  const inputSymbol = checker.getSymbolAtLocation(identifier);
  if (!inputSymbol) return false;

  for (let declarationIndex = statementIndex - 1; declarationIndex >= 0; declarationIndex--) {
    const candidate = container.statements[declarationIndex];
    if (!ts.isVariableStatement(candidate) || !(candidate.declarationList.flags & ts.NodeFlags.Const)) {
      continue;
    }
    for (const declaration of candidate.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        checker.getSymbolAtLocation(declaration.name) === inputSymbol &&
        declaration.initializer &&
        isHelperCall(declaration.initializer)
      ) {
        let guardIdentifier;
        for (let index = declarationIndex + 1; index < statementIndex; index++) {
          guardIdentifier = missingInputGuardIdentifier(container.statements[index], inputSymbol);
          if (guardIdentifier) break;
        }
        if (!guardIdentifier) return false;

        const allowedReferences = new Set([declaration.name, guardIdentifier, identifier]);
        let hasUnexpectedReference = false;
        const visitReference = node => {
          if (hasUnexpectedReference) return;
          if (
            ts.isIdentifier(node) &&
            checker.getSymbolAtLocation(node) === inputSymbol &&
            !allowedReferences.has(node)
          ) {
            hasUnexpectedReference = true;
            return;
          }
          ts.forEachChild(node, visitReference);
        };
        for (let index = declarationIndex; index <= statementIndex; index++) {
          visitReference(container.statements[index]);
        }
        return !hasUnexpectedReference;
      }
    }
  }
  return false;
}

let indexReferences = 0;
let indexCalls = 0;
let invalidIndexReferences = 0;
let invalidMemoryReferences = 0;
const allowedMemoryMembers = new Set([
  'recall',
  'listMessagesByResourceId',
  'indexObservation',
]);

function isWithinTypeNode(node) {
  let current = node.parent;
  while (current && !ts.isStatement(current) && !ts.isSourceFile(current)) {
    if (ts.isTypeNode(current)) return true;
    current = current.parent;
  }
  return false;
}

function visit(node) {
  const owner = topLevelFunction(node);
  const memoryParameter =
    owner?.name?.text === 'indexObservationGroupsFromMessages'
      ? owner.parameters[0]?.name
      : undefined;
  const memorySymbol =
    memoryParameter && ts.isIdentifier(memoryParameter)
      ? checker.getSymbolAtLocation(memoryParameter)
      : undefined;

  if (
    memorySymbol &&
    ts.isElementAccessExpression(node) &&
    (!node.argumentExpression || constantString(node.argumentExpression) === undefined)
  ) {
    const receiver = unwrap(node.expression);
    if (
      ts.isIdentifier(receiver) &&
      checker.getSymbolAtLocation(receiver) === memorySymbol
    ) {
      invalidMemoryReferences++;
    }
  }

  if (
    memorySymbol &&
    ts.isIdentifier(node) &&
    checker.getSymbolAtLocation(node) === memorySymbol &&
    node !== memoryParameter
  ) {
    const expression = enclosingExpression(node);
    const parent = expression.parent;
    const memberName =
      ts.isPropertyAccessExpression(parent) && parent.expression === expression
        ? parent.name.text
        : ts.isElementAccessExpression(parent) &&
            parent.expression === expression &&
            parent.argumentExpression
          ? constantString(parent.argumentExpression)
          : undefined;
    if (!memberName || !allowedMemoryMembers.has(memberName)) {
      invalidMemoryReferences++;
    }
  }

  if (ts.isCallExpression(node)) {
    const callee = unwrap(node.expression);
    if (
      ts.isElementAccessExpression(callee) &&
      (!callee.argumentExpression ||
        constantString(callee.argumentExpression) === undefined)
    ) {
      // A computed call can synthesize "indexObservation" without ever
      // containing the reviewed member name in the source. This one-time
      // migration has no legitimate computed method calls, so fail closed.
      invalidIndexReferences++;
    }
  }

  if (isIndexObservationMember(node)) {
    indexReferences++;
    const expression = enclosingExpression(node);
    const call = expression.parent;
    if (!ts.isCallExpression(call) || call.expression !== expression) {
      invalidIndexReferences++;
    } else {
      indexCalls++;
      const input = call.arguments[0];
      const authorized =
        !expression.questionDotToken &&
        !call.questionDotToken &&
        !!input &&
        ts.isIdentifier(unwrap(input)) &&
        helperBackedIdentifier(call, unwrap(input));
      if (!authorized) invalidIndexReferences++;
    }
  } else if (
    ts.isIdentifier(node) &&
    node.text === 'indexObservation' &&
    !isWithinTypeNode(node) &&
    !(
      ts.isPropertyAccessExpression(node.parent) &&
      node.parent.name === node &&
      isIndexObservationMember(node.parent)
    )
  ) {
    invalidIndexReferences++;
  } else if (
    ts.isStringLiteralLike(node) &&
    node.text === 'indexObservation' &&
    !isWithinTypeNode(node) &&
    !(
      ts.isElementAccessExpression(node.parent) &&
      node.parent.argumentExpression === node &&
      isIndexObservationMember(node.parent)
    )
  ) {
    invalidIndexReferences++;
  }
  ts.forEachChild(node, visit);
}
visit(source);

if (
  !helperBinding ||
  indexCalls < 1 ||
  indexReferences !== indexCalls ||
  invalidIndexReferences > 0 ||
  invalidMemoryReferences > 0
) {
  console.error(
    `${scriptPath} must pass buildObservationIndexInput output to every indexObservation call. ` +
      `Switch dispatch is not modeled, so a case or default clause body counts as statically ` +
      `unreachable; move the call out of the switch.`,
  );
  process.exit(1);
}
NODE
}

supervisor_provider_gate_verified=false
if grep -Fxq 'packages/core/src/agent/__tests__/supervisor-integration.test.ts' "$changed_files"; then
  if git_regular_file_at_head 'packages/core/src/agent/__tests__/supervisor-integration.test.ts' &&
    ! core_supervisor_test_preserves_provider_gate; then
    echo 'The exact supervisor suite changed its frozen real-provider safety boundary.' >&2
    exit 1
  fi
  if git_regular_file_at_head 'packages/core/src/agent/__tests__/supervisor-integration.test.ts'; then
    supervisor_provider_gate_verified=true
  fi
fi

tool_approval_replay_harness_verified=false
if grep -Fxq 'packages/core/src/agent/__tests__/tool-approval.e2e.test.ts' "$changed_files"; then
  if git_regular_file_at_head 'packages/core/src/agent/__tests__/tool-approval.e2e.test.ts' &&
    ! tool_approval_test_preserves_replay_harness; then
    echo 'The exact tool-approval suite changed its frozen replay harness.' >&2
    exit 1
  fi
  if git_regular_file_at_head 'packages/core/src/agent/__tests__/tool-approval.e2e.test.ts'; then
    tool_approval_replay_harness_verified=true
  fi
fi

is_server_generated_artifact() {
  case "$1" in
    client-sdks/client-js/src/route-types.generated.ts | \
      packages/cli/src/commands/api/route-metadata.generated.ts | \
      packages/core/src/auth/ee/interfaces/permissions.generated.ts) return 0 ;;
    *) return 1 ;;
  esac
}

while IFS= read -r file; do
  if [[ "$file" == packages/agent-builder/integration-tests/README.md ]]; then
    # The root workspace owns fixture compilation; the nested integration
    # package remains outside the installed and runnable workspace graph.
    printf '%s\n' packages/agent-builder >> "$workspace_candidates"
    continue
  fi
  if is_server_generated_artifact "$file"; then
    # These exact generated consumers are owned by Server route/permission
    # sources. Their output can be committed without granting general fork
    # validation coverage to the Client SDK, CLI, or Core workspaces.
    printf '%s\n' "packages/server" >> "$workspace_candidates"
    continue
  fi

  workspace_found=false
  search_dir="$(dirname "$file")"
  while [[ "$search_dir" != "." && "$search_dir" != "/" ]]; do
    manifest_path="${search_dir}/package.json"
    if [[ "$manifest_path" == */__fixtures__/* ]]; then
      search_dir="$(dirname "$search_dir")"
      continue
    fi
    if [[ -f "$manifest_path" ]] ||
      git cat-file -e "${HEAD_SHA}:${manifest_path}" 2>/dev/null ||
      git cat-file -e "${BASE_SHA}:${manifest_path}" 2>/dev/null; then
      printf '%s\n' "$search_dir" >> "$workspace_candidates"
      workspace_found=true
      break
    fi
    search_dir="$(dirname "$search_dir")"
  done
  if [[ "$workspace_found" == false ]]; then
    printf '%s\n' "$file" >> "$unowned_files"
  fi
done < "$changed_files"

sort -u "$workspace_candidates" > "$changed_workspaces"

echo "Changed workspaces:"
cat "$changed_workspaces"

while IFS= read -r workspace; do
  if [[ ! -f "$workspace/package.json" ]]; then
    printf '%s\n' "$workspace" >> "$unsupported_workspaces"
    continue
  fi
  case "$workspace" in
    auth/okta | browser/stagehand | packages/_internal-core | packages/_types-builder | packages/agent-builder | packages/cli | packages/codemod | packages/core | packages/deployer | packages/mcp | packages/memory | packages/server | client-sdks/ai-sdk | client-sdks/client-js | stores/_test-utils | stores/convex | stores/libsql | stores/pg | stores/redis | mastracode | mastracode/sdk | mastracode/tui | pubsub/google-cloud-pubsub | pubsub/redis-streams | workflows/inngest | workflows/temporal | observability/mastra | docs) ;;
    server-adapters/fastify)
      if [[ "$pf3553_selected_route_exports" == false ]]; then
        printf '%s\n' "$workspace" >> "$unsupported_workspaces"
      fi
      ;;
    *) printf '%s\n' "$workspace" >> "$unsupported_workspaces" ;;
  esac
done < "$changed_workspaces"

while IFS= read -r file; do
  case "$file" in
    .changeset/* | \
      .github/scripts/run-papersflow-fork-pr-validation.bash | \
      .github/scripts/check-packed-declaration-fixture.mjs | \
      .github/workflows/README.md | \
      .github/workflows/e2e-docs.yml | \
      .github/workflows/labeler.yml | \
      .github/workflows/lint-docs.yml | \
      .github/workflows/lint.yml | \
      .github/workflows/mastracode-e2e.yml | \
      .github/workflows/papersflow-fork-pr.yml | \
      .github/workflows/prebuild.yml | \
      pnpm-lock.yaml | \
      scripts/commonjs-tsc-fixer.js | \
      scripts/commonjs-tsc-fixer.test.ts | \
      scripts/types-builder.test.ts | \
      scripts/tsconfig.json | \
      scripts/vitest.config.ts | \
      vitest.config.ts) ;;
    harnessv1/sections/*.md)
      # A Markdown suffix is not enough: symlinks can escape the reviewed tree
      # or disappear on checkout, and deleted documents cannot be formatted.
      # Only immutable regular blobs at the proposed head enter the docs lane.
      git_regular_file_at_head "$file" ||
        printf '%s\n' "$file" >> "$unsupported_inputs"
      ;;
    *) printf '%s\n' "$file" >> "$unsupported_inputs" ;;
  esac
done < "$unowned_files"

grep -E '^(package\.json|pnpm-workspace\.yaml|patches/)' "$changed_files" \
  >> "$unsupported_inputs" || true
# Server and Fastify validation invoke package-owned scripts. Admit their two
# manifests only after the exact PF-3553 semantic predicate above succeeds;
# every other edit fails before PR-controlled package commands can run.
if [[ "$pf3553_selected_route_exports" == false ]]; then
  grep -E \
    '^(packages/server/package\.json|server-adapters/fastify/package\.json)$' \
    "$changed_files" >> "$unsupported_inputs" || true
fi

agent_builder_fixture_dependency=false
if grep -Fxq packages/agent-builder/package.json "$changed_files"; then
  if verify_agent_builder_fixture_dependency "$merge_base_sha" "$HEAD_SHA"; then
    agent_builder_fixture_dependency=true
  else
    printf '%s\n' packages/agent-builder/package.json >> "$unsupported_inputs"
  fi
fi


inngest_pf2057_dependency_cleanup=false
inngest_manifest_changed=false
lockfile_changed=false
grep -Fxq 'workflows/inngest/package.json' "$changed_files" && inngest_manifest_changed=true
grep -Fxq 'pnpm-lock.yaml' "$changed_files" && lockfile_changed=true
if [[ "$inngest_manifest_changed" == true && "$lockfile_changed" == true ]] &&
  verify_pf2057_inngest_dependency_cleanup "$merge_base_sha" "$HEAD_SHA"; then
  inngest_pf2057_dependency_cleanup=true
fi

if [[ "$lockfile_changed" == true && "$inngest_pf2057_dependency_cleanup" == false ]]; then
  node - "$merge_base_sha" "$HEAD_SHA" > "$changed_lockfile_importers" <<'NODE'
const { execFileSync } = require('node:child_process');

function lockfileSections(sha) {
  const lockfile = execFileSync('git', ['show', `${sha}:pnpm-lock.yaml`], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const lines = lockfile.split('\n');
  const sections = new Map();
  const start = lines.indexOf('importers:');
  if (start < 0) return { importers: sections, nonImporterGraph: lockfile };

  let importer;
  let body = [];
  let end = lines.length;
  const flush = () => {
    if (importer !== undefined) sections.set(importer, body.join('\n'));
  };

  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line && !line.startsWith(' ')) {
      end = index;
      break;
    }
    const match = /^  (\S.*):$/.exec(line);
    if (match) {
      flush();
      importer = match[1].replace(/^'|'$/g, '').replace(/''/g, "'");
      body = [];
    } else if (importer !== undefined) {
      body.push(line);
    }
  }
  flush();
  return {
    importers: sections,
    nonImporterGraph: [...lines.slice(0, start), ...lines.slice(end)].join('\n'),
  };
}

const before = lockfileSections(process.argv[2]);
const after = lockfileSections(process.argv[3]);
if (before.nonImporterGraph !== after.nonImporterGraph) {
  console.log('__PAPERSFLOW_NON_IMPORTER_GRAPH__');
}
const importers = new Set([...before.importers.keys(), ...after.importers.keys()]);
for (const importer of [...importers].sort()) {
  if (before.importers.get(importer) !== after.importers.get(importer)) console.log(importer);
}
NODE

  lockfile_importers_match_manifests=true
  if [[ ! -s "$changed_lockfile_importers" ]]; then
    lockfile_importers_match_manifests=false
  fi
  while IFS= read -r importer; do
    if [[ "$importer" == "__PAPERSFLOW_NON_IMPORTER_GRAPH__" ]]; then
      lockfile_importers_match_manifests=false
      echo "Lockfile content outside importer sections changed without an owned validation target." >&2
      continue
    fi
    manifest="${importer}/package.json"
    if [[ "$importer" == "." ]]; then
      manifest="package.json"
    fi
    if ! grep -Fxq "$manifest" "$changed_files"; then
      lockfile_importers_match_manifests=false
      echo "Lockfile importer changed without its manifest: $importer" >&2
    fi
  done < "$changed_lockfile_importers"

  if [[ "$lockfile_importers_match_manifests" == false ]]; then
    printf '%s\n' 'pnpm-lock.yaml' >> "$unsupported_inputs"
  fi
fi

verify_pf2050_inngest_coordination() (
  local expected_paths actual_paths path
  expected_paths="$(mktemp)"
  actual_paths="$(mktemp)"
  trap 'rm -f "$expected_paths" "$actual_paths"' EXIT

  printf '%s\n' \
    .github/workflows/papersflow-fork-pr.yml \
    workflows/inngest/docker-compose.yaml \
    workflows/inngest/package.json \
    workflows/inngest/src/__tests__/adapters/_utils.ts \
    workflows/inngest/src/__tests__/inngest-test-runtime.test.ts \
    workflows/inngest/src/__tests__/inngest-test-runtime.ts \
    workflows/inngest/src/index.test.ts |
    LC_ALL=C sort > "$expected_paths"
  grep -E '^(\.github/workflows/|workflows/inngest/)' "$changed_files" |
    LC_ALL=C sort > "$actual_paths" || true

  if ! cmp -s "$expected_paths" "$actual_paths"; then
    echo 'PF-2050 manifest coordination must use exactly the seven reviewed workflow/manager paths.' >&2
    diff -u "$expected_paths" "$actual_paths" >&2 || true
    return 1
  fi
  if grep -Fxq 'pnpm-lock.yaml' "$changed_files"; then
    echo 'PF-2050 is a script-only manifest change; pnpm-lock.yaml must remain unchanged.' >&2
    return 1
  fi
  while IFS= read -r path; do
    if ! git_regular_file_at_head "$path"; then
      echo "PF-2050 reviewed coordination path is not a regular file: $path" >&2
      return 1
    fi
  done < "$expected_paths"

  node - "$merge_base_sha" "$HEAD_SHA" <<'NODE'
const { execFileSync } = require('node:child_process');
const { isDeepStrictEqual } = require('node:util');

const [baseSha, headSha] = process.argv.slice(2);
const readAt = (sha, path) => execFileSync('git', ['show', `${sha}:${path}`], { encoding: 'utf8' });

const manifestPath = 'workflows/inngest/package.json';
const baseManifest = JSON.parse(readAt(baseSha, manifestPath));
const headManifest = JSON.parse(readAt(headSha, manifestPath));
const removedScript = baseManifest.scripts?.['test:docker'];
if (
  removedScript !==
  "docker-compose up -d && vitest run --no-isolate --retry=1 --exclude='src/__tests__/adapters/**' && docker-compose down"
) {
  throw new Error('PF-2050 base no longer contains the reviewed failure-unsafe test:docker lifecycle.');
}
const expectedManifest = structuredClone(baseManifest);
delete expectedManifest.scripts['test:docker'];
if (!isDeepStrictEqual(headManifest, expectedManifest)) {
  throw new Error('PF-2050 package.json may only remove the reviewed test:docker script.');
}

const workflowPath = '.github/workflows/papersflow-fork-pr.yml';
const baseWorkflow = readAt(baseSha, workflowPath);
const headWorkflow = readAt(headSha, workflowPath);
const removeNamedStep = (source, name) => {
  const marker = `\n      - name: ${name}\n`;
  const start = source.indexOf(marker);
  if (start < 0 || source.indexOf(marker, start + marker.length) >= 0) {
    throw new Error(`PF-2050 base must contain exactly one legacy workflow step: ${name}`);
  }
  const nextStep = source.indexOf('\n      - name: ', start + marker.length);
  const end = nextStep < 0 ? source.length : nextStep;
  return {
    source: source.slice(0, start) + (nextStep < 0 ? '' : source.slice(end)),
    removed: source.slice(start, end),
  };
};

let expectedWorkflow = baseWorkflow;
const startStep = removeNamedStep(expectedWorkflow, 'Start pinned Inngest dev server when index suite is owned');
expectedWorkflow = startStep.source;
const stopStep = removeNamedStep(expectedWorkflow, 'Stop pinned Inngest dev server');
expectedWorkflow = stopStep.source;
for (const [fragment, removed] of [
  ['docker run --detach --name mastra-inngest-test', startStep.removed],
  ["echo 'MASTRA_INNGEST_TEST_DOCKER=1' >> \"$GITHUB_ENV\"", startStep.removed],
  ['docker rm --force mastra-inngest-test', stopStep.removed],
]) {
  if (!removed.includes(fragment)) {
    throw new Error(`PF-2050 legacy workflow step no longer contains the reviewed owner: ${fragment}`);
  }
}
for (const fragment of [
  'Start pinned Inngest dev server when index suite is owned',
  'Stop pinned Inngest dev server',
  'MASTRA_INNGEST_TEST_DOCKER=1',
  'docker run --detach --name mastra-inngest-test',
]) {
  if (headWorkflow.includes(fragment)) {
    throw new Error(`PF-2050 workflow retained duplicate Inngest lifecycle ownership: ${fragment}`);
  }
}
if (headWorkflow !== expectedWorkflow) {
  throw new Error('PF-2050 workflow may only remove the two legacy Inngest lifecycle steps.');
}
NODE
)

inngest_pf2050_coordination=false
if [[ "$inngest_manifest_changed" == true && "$inngest_pf2057_dependency_cleanup" == false ]]; then
  if verify_pf2050_inngest_coordination; then
    inngest_pf2050_coordination=true
  else
    printf '%s\n' \
      .github/workflows/papersflow-fork-pr.yml \
      workflows/inngest/package.json \
      >> "$unsupported_inputs"
  fi
fi

# PF-2044 owns source and test execution for these workspaces, not mutable
# package-command definitions. PF-2050 admits one script-only removal paired
# with its exact workflow/runtime-manager surface; PF-2057 admits only the
# reviewed unused dependency removals and their byte-exact lockfile cleanup.
while IFS= read -r path; do
  if [[ "$path" == 'workflows/inngest/package.json' ]] &&
    { [[ "$inngest_pf2050_coordination" == true ]] ||
      [[ "$inngest_pf2057_dependency_cleanup" == true ]]; }; then
    continue
  fi
  printf '%s\n' "$path" >> "$unsupported_inputs"
done < <(
  grep -E \
    '^(client-sdks/client-js|mastracode/(sdk|tui)|pubsub/(google-cloud-pubsub|redis-streams)|stores/(convex|libsql)|workflows/inngest)/package\.json$' \
    "$changed_files" || true
)

inngest_index_test_changed=false
inngest_compose_changed=false
inngest_adapter_utils_changed=false
inngest_pf2042_trio_only=false
grep -Fxq 'workflows/inngest/src/index.test.ts' "$changed_files" && inngest_index_test_changed=true
grep -Fxq 'workflows/inngest/docker-compose.yaml' "$changed_files" && inngest_compose_changed=true
grep -Fxq 'workflows/inngest/src/__tests__/adapters/_utils.ts' "$changed_files" && inngest_adapter_utils_changed=true
inngest_pf2042_changed_count=0
[[ "$inngest_index_test_changed" == true ]] && ((inngest_pf2042_changed_count += 1))
[[ "$inngest_compose_changed" == true ]] && ((inngest_pf2042_changed_count += 1))
[[ "$inngest_adapter_utils_changed" == true ]] && ((inngest_pf2042_changed_count += 1))
if {
  [[ "$inngest_compose_changed" == true || "$inngest_adapter_utils_changed" == true ]] &&
    (( inngest_pf2042_changed_count < 3 ));
} || {
  (( inngest_pf2042_changed_count == 3 )) &&
    { ! git_regular_file_at_head workflows/inngest/src/index.test.ts ||
      ! git_regular_file_at_head workflows/inngest/docker-compose.yaml ||
      ! git_regular_file_at_head workflows/inngest/src/__tests__/adapters/_utils.ts; }
}; then
  printf '%s\n' \
    workflows/inngest/src/index.test.ts \
    workflows/inngest/docker-compose.yaml \
    workflows/inngest/src/__tests__/adapters/_utils.ts \
    >> "$unsupported_owned_workspace_pairs"
fi
if (( inngest_pf2042_changed_count == 3 )) &&
  ! grep -E '^workflows/inngest/' "$changed_files" |
    grep -Ev '^(workflows/inngest/src/index\.test\.ts|workflows/inngest/docker-compose\.yaml|workflows/inngest/src/__tests__/adapters/_utils\.ts)$' |
    grep -q .; then
  inngest_pf2042_trio_only=true
fi
if [[ "$inngest_pf2042_trio_only" == true ]]; then
  verify_pf2042_inngest_topology
fi

inngest_manager_owns_runtime=false
if git_regular_file_at_head workflows/inngest/src/__tests__/inngest-test-runtime.ts &&
  git_regular_file_at_head workflows/inngest/src/__tests__/inngest-test-runtime.test.ts &&
  git show "$HEAD_SHA:workflows/inngest/src/index.test.ts" |
    grep -Fq 'new InngestTestRuntimeManager' &&
  ! git show "$HEAD_SHA:.github/workflows/papersflow-fork-pr.yml" |
    grep -Eq 'Start pinned Inngest dev server|MASTRA_INNGEST_TEST_DOCKER=1|docker run --detach --name mastra-inngest-test'; then
  inngest_manager_owns_runtime=true
fi

while IFS= read -r file; do
  if [[ "$file" =~ ^mastracode/.*\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$ ]]; then
    if grep -Eq '\.(test|spec)\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$|\.test-d\.ts$' <<< "$file"; then
      if ! git_regular_file_at_head "$file"; then
        printf '%s\n' "$file" >> "$missing_mastracode_tests"
      else
        case "$file" in
          mastracode/tui/src/tui/components/login-dialog.test.ts | \
            mastracode/tui/src/tui/event-dispatch.test.ts | \
            mastracode/tui/src/tui/notify.test.ts | \
            mastracode/tui/src/tui/__tests__/goal-manager.test.ts | \
            mastracode/sdk/src/headless/run-mc.test.ts | \
            mastracode/sdk/src/utils/__tests__/observation-index-input.test.ts | \
            mastracode/sdk/src/utils/__tests__/signals-pubsub.test.ts) ;;
          *) printf '%s\n' "$file" >> "$unsupported_mastracode_tests" ;;
        esac
      fi
      continue
    fi
    required_test=""
    case "$file" in
      mastracode/tui/src/tui/components/login-dialog.ts)
        required_test="mastracode/tui/src/tui/components/login-dialog.test.ts"
        ;;
      mastracode/tui/src/tui/event-dispatch.ts)
        required_test="mastracode/tui/src/tui/event-dispatch.test.ts"
        ;;
      mastracode/tui/src/tui/notify.ts)
        required_test="mastracode/tui/src/tui/notify.test.ts"
        ;;
      mastracode/tui/src/tui/goal-manager.ts)
        required_test="mastracode/tui/src/tui/__tests__/goal-manager.test.ts"
        ;;
      mastracode/sdk/src/goal-manager.ts)
        # The accepted upstream history moved the implementation into Code SDK;
        # the TUI regression exercises it through the package re-export.
        required_test="mastracode/tui/src/tui/__tests__/goal-manager.test.ts"
        ;;
      mastracode/sdk/src/headless/run-mc.ts)
        required_test="mastracode/sdk/src/headless/run-mc.test.ts"
        ;;
      mastracode/sdk/scripts/index-messages.ts | \
        mastracode/sdk/src/utils/observation-index-input.ts)
        required_test="mastracode/sdk/src/utils/__tests__/observation-index-input.test.ts"
        ;;
      mastracode/sdk/src/utils/signals-pubsub.ts)
        required_test="mastracode/sdk/src/utils/__tests__/signals-pubsub.test.ts"
        ;;
      mastracode/sdk/src/index.ts | mastracode/tui/src/main.ts)
        # Composition roots: no single unit suite owns them; build:mastracode
        # compiles both packages and their owned suites exercise the wiring.
        # Restoration-only edits are accepted under the build gate.
        ;;
      *)
        printf '%s\n' "$file" >> "$unsupported_mastracode_sources"
        ;;
    esac
    if [[ -n "$required_test" ]]; then
      if ! git_regular_file_at_head "$file" || ! git_regular_file_at_head "$required_test"; then
        printf '%s\n' "$file" >> "$unsupported_mastracode_sources"
      elif ! grep -Fxq "$required_test" "$changed_files"; then
        # The paired suite exists but was not edited: force it to RUN so the
        # source change is still executed against its owned coverage instead
        # of failing closed on parse-only or restoration commits.
        printf '%s\n' "$required_test" >> "$forced_mastracode_tests"
      fi
    fi
  fi
done < "$changed_files"

if grep -Eq \
  '^(mastracode/sdk/scripts/index-messages\.ts|mastracode/sdk/src/utils/observation-index-input\.ts)$' \
  "$changed_files"; then
  if ! git_regular_file_at_head mastracode/sdk/scripts/index-messages.ts ||
    ! git_regular_file_at_head mastracode/sdk/src/utils/observation-index-input.ts ||
    ! mastracode_observation_migration_uses_helper; then
    printf '%s\n' mastracode/sdk/scripts/index-messages.ts \
      >> "$unsupported_mastracode_sources"
  fi
fi

queue_owned_workspace_test() {
  local source_file="$1"
  local test_file="$2"
  if ! git_regular_file_at_head "$source_file" || ! git_regular_file_at_head "$test_file"; then
    printf '%s\n' "$source_file" >> "$unsupported_owned_workspace_sources"
  elif ! grep -Fxq "$test_file" "$changed_files"; then
    printf '%s\n' "$test_file" >> "$forced_workspace_tests"
  fi
}

types_builder_changed=false
while IFS= read -r file; do
  case "$file" in
    packages/_types-builder/src/index.js | packages/_types-builder/src/replace-types.js | \
      scripts/types-builder.test.ts)
      types_builder_changed=true
      queue_owned_workspace_test "$file" scripts/types-builder.test.ts
      ;;
    packages/_types-builder/*)
      printf '%s\n' "$file" >> "$unsupported_owned_workspace_sources"
      ;;
    packages/agent-builder/tsdown.config.ts | packages/agent-builder/src/agent-builder.test.ts | \
      packages/agent-builder/integration-tests/README.md)
      queue_owned_workspace_test "$file" packages/agent-builder/src/agent-builder.test.ts
      ;;
    packages/agent-builder/tsconfig.fixtures.json)
      if verify_agent_builder_fixture_config "$HEAD_SHA"; then
        queue_owned_workspace_test "$file" packages/agent-builder/src/agent-builder.test.ts
      else
        printf '%s\n' "$file" >> "$unsupported_owned_workspace_sources"
      fi
      ;;
    packages/agent-builder/package.json)
      if [[ "$agent_builder_fixture_dependency" == true ]]; then
        queue_owned_workspace_test "$file" packages/agent-builder/src/agent-builder.test.ts
      else
        printf '%s\n' "$file" >> "$unsupported_owned_workspace_sources"
      fi
      ;;
    packages/agent-builder/*)
      printf '%s\n' "$file" >> "$unsupported_owned_workspace_sources"
      ;;
  esac
done < "$changed_files"

if [[ "$types_builder_changed" == true ]]; then
  if ! node - "$TYPESCRIPT_MODULE_PATH" <<'NODE'
const path = require('node:path');
const ts = require(process.argv[2]);
const project = ts.getParsedCommandLineOfConfigFile('scripts/tsconfig.json', {}, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic(diagnostic) {
    console.error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
  },
});
if (!project || project.errors.length > 0 ||
  !project.fileNames.includes(path.resolve('scripts/types-builder.test.ts'))) {
  console.error('Generator validation requires scripts/types-builder.test.ts in the resolved scripts TypeScript project.');
  process.exit(1);
}
NODE
  then
    printf '%s\n' 'scripts/tsconfig.json' >> "$unsupported_owned_workspace_sources"
  fi
fi

# The Client SDK is admitted only through exact source-and-test ownership.
# Generated route types remain owned by the Server generator path above.
# Direct Harness resource edits execute their request-contract regression;
# public entrypoint edits execute the package-export regression. Both paths
# also build, typecheck, and lint the complete Client SDK workspace.
while IFS= read -r file; do
  [[ "$file" == client-sdks/client-js/* ]] || continue

  if [[ "$file" == 'client-sdks/client-js/src/route-types.generated.ts' ]]; then
    continue
  fi
  if ! [[ "$file" =~ \.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$ ]]; then
    printf '%s\n' "$file" >> "$unsupported_owned_workspace_sources"
    continue
  fi
  if grep -Eq '\.(test|spec)\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$|\.test-d\.ts$' <<< "$file"; then
    case "$file" in
      client-sdks/client-js/src/index.test.ts | client-sdks/client-js/src/resources/harness.test.ts) ;;
      *) printf '%s\n' "$file" >> "$unsupported_owned_workspace_tests" ;;
    esac
    if ! git_regular_file_at_head "$file"; then
      printf '%s\n' "$file" >> "$unsupported_owned_workspace_tests"
    fi
    continue
  fi

  case "$file" in
    client-sdks/client-js/src/index.ts)
      queue_owned_workspace_test "$file" client-sdks/client-js/src/index.test.ts
      ;;
    client-sdks/client-js/src/resources/harness.ts)
      queue_owned_workspace_test "$file" client-sdks/client-js/src/resources/harness.test.ts
      ;;
    *) printf '%s\n' "$file" >> "$unsupported_owned_workspace_sources" ;;
  esac
done < "$changed_files"

storage_atomic_resume_conformance_owned=false
if grep -Eq '^stores/_test-utils/src/(domains/workflows/atomic-resume\.ts|index\.ts)$' "$changed_files" &&
  ! grep -E '^stores/_test-utils/' "$changed_files" |
    grep -Ev '^stores/_test-utils/src/(domains/workflows/atomic-resume\.ts|index\.ts)$' |
    grep -q .; then
  storage_atomic_resume_conformance_owned=true
  while IFS= read -r file; do
    queue_owned_workspace_test "$file" stores/libsql/src/storage/domains/workflows/atomic-resume.test.ts
    queue_owned_workspace_test "$file" stores/pg/src/storage/domains/workflows/atomic-resume.test.ts
  done < <(
    grep -E '^stores/_test-utils/src/(domains/workflows/atomic-resume\.ts|index\.ts)$' "$changed_files"
  )
fi

storage_harness_factory_registered=false
if grep -Eq '^stores/_test-utils/src/(domains/harness/index\.ts|factory\.ts|index\.test\.ts)$' "$changed_files"; then
  storage_harness_factory_valid=false
  storage_harness_entrypoint_valid=false
  if git_regular_file_at_head stores/_test-utils/src/factory.ts &&
    storage_harness_factory_registers_suite; then
    storage_harness_factory_valid=true
  fi
  if git_regular_file_at_head stores/_test-utils/src/index.test.ts &&
    storage_harness_entrypoint_registers_suite; then
    storage_harness_entrypoint_valid=true
  fi

  if [[ "$storage_harness_factory_valid" == true &&
    "$storage_harness_entrypoint_valid" == true ]]; then
    storage_harness_factory_registered=true
    while IFS= read -r file; do
      # The package's in-memory suite invokes createTestSuite, whose exact
      # registration above installs the shared Harness conformance tests. This
      # validates both definitions and factory wiring without a networked
      # adapter.
      queue_owned_workspace_test "$file" stores/_test-utils/src/index.test.ts
    done < <(
      grep -E '^stores/_test-utils/src/(domains/harness/index\.ts|factory\.ts)$' "$changed_files"
    )
  else
    # Running src/index.test.ts is meaningful only when createTestSuite wires
    # the shared Harness suite into the in-memory entrypoint. Reject a detached
    # definition or entrypoint rather than accepting unrelated green tests.
    if [[ "$storage_harness_factory_valid" == false ]]; then
      printf '%s\n' stores/_test-utils/src/factory.ts \
        >> "$unsupported_owned_workspace_sources"
    fi
    if [[ "$storage_harness_entrypoint_valid" == false ]]; then
      printf '%s\n' stores/_test-utils/src/index.test.ts \
        >> "$unsupported_owned_workspace_tests"
    fi
  fi
fi

storage_harness_conformance_owned=false
if [[ "$storage_harness_factory_registered" == true ]] &&
  ! grep -E '^stores/_test-utils/' "$changed_files" |
    grep -Ev '^stores/_test-utils/src/(domains/harness/index\.ts|factory\.ts|index\.test\.ts)$' |
    grep -q .; then
  storage_harness_conformance_owned=true
fi

# These are executable ownership maps, not passive workspace allowlists. A
# production-only change forces its native regression file to run; an unknown
# source or test in a newly admitted workspace fails closed until its runtime
# and service contract are reviewed explicitly.
while IFS= read -r file; do
  if [[ "$file" =~ ^(pubsub/(google-cloud-pubsub|redis-streams)|stores/(convex|libsql)|workflows/(inngest|temporal))/ ]] &&
    ! [[ "$file" =~ \.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$ ]]; then
    if [[ "$file" == 'workflows/inngest/package.json' ]] &&
      { [[ "$inngest_pf2050_coordination" == true ]] ||
        [[ "$inngest_pf2057_dependency_cleanup" == true ]]; }; then
      continue
    fi
    if [[ "$file" == 'workflows/inngest/docker-compose.yaml' ]] &&
      (( inngest_pf2042_changed_count == 3 )); then
      # The Compose topology is allowed only when its live index suite and
      # adapter endpoint contract change with it. An exact trio enters the
      # immutable PF-2042 lane; the broader PF-2050 surface replaces duplicate
      # workflow/CLI ownership with the manager-owned pinned Docker lifecycle
      # and runs the native package gates.
      continue
    fi
    printf '%s\n' "$file" >> "$unsupported_owned_workspace_sources"
    continue
  fi

  if ! [[ "$file" =~ ^(pubsub/(google-cloud-pubsub|redis-streams)|stores/(convex|libsql)|workflows/(inngest|temporal))/.*\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$ ]]; then
    continue
  fi

  if grep -Eq '\.(test|spec)\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$|\.test-d\.ts$' <<< "$file"; then
    case "$file" in
      pubsub/google-cloud-pubsub/src/group.test.ts | \
        pubsub/redis-streams/src/pubsub.test.ts | \
        stores/convex/src/cache/index.test.ts | \
        stores/convex/src/server/cache.test.ts | \
        stores/libsql/src/storage/index.test.ts | \
        stores/libsql/src/storage/domains/harness/index.test.ts | \
        stores/libsql/src/storage/domains/thread-state/index.test.ts | \
        stores/libsql/src/storage/domains/workflows/atomic-resume.test.ts | \
        workflows/inngest/src/__tests__/create-inngest-agent.test.ts | \
        workflows/inngest/src/__tests__/durable-agent.test.utils.test.ts | \
        workflows/inngest/src/__tests__/inngest-test-runtime.test.ts | \
        workflows/inngest/src/actor-signal.test.ts | \
        workflows/inngest/src/create-run-contract.test.ts | \
        workflows/inngest/src/durable-agent/create-inngest-agent.test-d.ts | \
        workflows/inngest/src/durable-agent/create-inngest-agentic-workflow.test.ts | \
        workflows/inngest/src/index.test.ts | \
        workflows/inngest/src/lifecycle-execution.test.ts | \
        workflows/inngest/src/pubsub.test.ts | \
        workflows/inngest/src/resume-async.test.ts | \
        workflows/inngest/src/run-stream-terminal.test.ts | \
        workflows/inngest/src/serve.test.ts | \
        workflows/temporal/src/workflow.test.ts) ;;
      *) printf '%s\n' "$file" >> "$unsupported_owned_workspace_tests" ;;
    esac
    if ! git_regular_file_at_head "$file"; then
      printf '%s\n' "$file" >> "$unsupported_owned_workspace_tests"
    fi
    continue
  fi

  case "$file" in
    pubsub/google-cloud-pubsub/src/index.ts)
      queue_owned_workspace_test "$file" pubsub/google-cloud-pubsub/src/group.test.ts
      ;;
    pubsub/redis-streams/src/index.ts)
      queue_owned_workspace_test "$file" pubsub/redis-streams/src/pubsub.test.ts
      ;;
    stores/convex/src/cache/index.ts | stores/convex/src/cache/types.ts)
      queue_owned_workspace_test "$file" stores/convex/src/cache/index.test.ts
      ;;
    stores/convex/src/schema.ts)
      queue_owned_workspace_test "$file" stores/convex/src/cache/index.test.ts
      queue_owned_workspace_test "$file" stores/convex/src/server/cache.test.ts
      ;;
    stores/convex/src/server/cache.ts)
      queue_owned_workspace_test "$file" stores/convex/src/server/cache.test.ts
      ;;
    stores/libsql/src/storage/domains/thread-state/index.ts)
      queue_owned_workspace_test "$file" stores/libsql/src/storage/domains/thread-state/index.test.ts
      ;;
    stores/libsql/src/storage/domains/harness/index.ts)
      queue_owned_workspace_test "$file" stores/libsql/src/storage/domains/harness/index.test.ts
      ;;
    stores/libsql/src/storage/index.ts)
      queue_owned_workspace_test "$file" stores/libsql/src/storage/index.test.ts
      ;;
    stores/libsql/src/storage/domains/workflows/index.ts)
      queue_owned_workspace_test "$file" stores/libsql/src/storage/domains/workflows/atomic-resume.test.ts
      ;;
    workflows/inngest/src/__tests__/durable-agent.test.utils.ts)
      queue_owned_workspace_test "$file" workflows/inngest/src/__tests__/durable-agent.test.utils.test.ts
      ;;
    workflows/inngest/src/durable-agent/create-inngest-agent.ts | \
      workflows/inngest/src/durable-agent/index.ts)
      queue_owned_workspace_test "$file" workflows/inngest/src/__tests__/create-inngest-agent.test.ts
      ;;
    workflows/inngest/src/durable-agent/create-inngest-agentic-workflow.ts)
      queue_owned_workspace_test "$file" workflows/inngest/src/durable-agent/create-inngest-agentic-workflow.test.ts
      ;;
    workflows/inngest/src/pubsub.ts)
      queue_owned_workspace_test "$file" workflows/inngest/src/pubsub.test.ts
      ;;
    workflows/inngest/src/index.ts)
      queue_owned_workspace_test "$file" workflows/inngest/src/create-run-contract.test.ts
      ;;
    workflows/inngest/src/execution-engine.ts | workflows/inngest/src/types.ts | workflows/inngest/src/workflow.ts)
      queue_owned_workspace_test "$file" workflows/inngest/src/lifecycle-execution.test.ts
      ;;
    workflows/inngest/src/run.ts)
      queue_owned_workspace_test "$file" workflows/inngest/src/lifecycle-execution.test.ts
      queue_owned_workspace_test "$file" workflows/inngest/src/resume-async.test.ts
      ;;
    workflows/inngest/src/resume-operation.ts)
      queue_owned_workspace_test "$file" workflows/inngest/src/lifecycle-execution.test.ts
      queue_owned_workspace_test "$file" workflows/inngest/src/resume-async.test.ts
      ;;
    workflows/inngest/src/__tests__/inngest-test-runtime.ts)
      # The runtime manager owns one pinned Docker lifecycle and has a focused
      # unit suite for startup, registration, interruption, and cleanup. The
      # live index suite remains independently owned by its own changed path.
      queue_owned_workspace_test "$file" workflows/inngest/src/__tests__/inngest-test-runtime.test.ts
      ;;
    workflows/inngest/src/__tests__/adapters/_utils.ts)
      # PF-2042 owns this launcher helper only as part of the atomic
      # index.test/Compose/adapter topology trio. A broader Inngest change may
      # include the same atomic trio, but then the normal package gates and
      # live index suite provide coverage instead of the immutable exception.
      if (( inngest_pf2042_changed_count != 3 )); then
        printf '%s\n' "$file" >> "$unsupported_owned_workspace_sources"
      fi
      ;;
    workflows/temporal/src/workflow.ts)
      queue_owned_workspace_test "$file" workflows/temporal/src/workflow.test.ts
      ;;
    *) printf '%s\n' "$file" >> "$unsupported_owned_workspace_sources" ;;
  esac
done < "$changed_files"

# Existing PostgreSQL and Redis validation already owns their service-backed
# workspaces broadly. These exact PF-2026/PF-2007 production paths additionally
# force the regressions that prove the newly introduced behavior, so a later
# source-only conflict resolution cannot silently degrade to compile coverage.
while IFS= read -r file; do
  case "$file" in
    stores/pg/src/storage/domains/thread-state/index.ts | stores/pg/src/storage/index.ts)
      queue_owned_workspace_test "$file" stores/pg/src/storage/domains/thread-state/index.test.ts
      ;;
    stores/redis/src/cache.ts)
      queue_owned_workspace_test "$file" stores/redis/src/index.test.ts
      queue_owned_workspace_test "$file" stores/redis/src/integration.test.ts
      ;;
  esac
done < "$changed_files"

sort -u -o "$unsupported_inputs" "$unsupported_inputs"
sort -u -o "$missing_mastracode_tests" "$missing_mastracode_tests"
sort -u -o "$unsupported_mastracode_tests" "$unsupported_mastracode_tests"
sort -u -o "$unsupported_mastracode_sources" "$unsupported_mastracode_sources"
sort -u -o "$unsupported_owned_workspace_sources" "$unsupported_owned_workspace_sources"
sort -u -o "$unsupported_owned_workspace_tests" "$unsupported_owned_workspace_tests"
sort -u -o "$unsupported_owned_workspace_pairs" "$unsupported_owned_workspace_pairs"

if [[ -s "$unsupported_workspaces" || -s "$unsupported_inputs" || -s "$deleted_tests" || -s "$missing_mastracode_tests" || -s "$unsupported_mastracode_tests" || -s "$unsupported_mastracode_sources" || -s "$unsupported_owned_workspace_sources" || -s "$unsupported_owned_workspace_tests" || -s "$unsupported_owned_workspace_pairs" ]]; then
  if [[ -s "$unsupported_workspaces" ]]; then
    echo "These changed workspaces do not have an owned fork-safe validation target:" >&2
    cat "$unsupported_workspaces" >&2
  fi
  if [[ -s "$unsupported_inputs" ]]; then
    echo "These non-workspace or root dependency-graph changes require dedicated validation:" >&2
    cat "$unsupported_inputs" >&2
  fi
  if [[ -s "$deleted_tests" ]]; then
    echo "These Vitest files are deleted at the proposed head, so this validator cannot re-run their coverage:" >&2
    cat "$deleted_tests" >&2
  fi
  if [[ -s "$unsupported_mastracode_sources" ]]; then
    echo "These MastraCode production sources are outside the owned source-and-test pairs:" >&2
    cat "$unsupported_mastracode_sources" >&2
  fi
  if [[ -s "$missing_mastracode_tests" ]]; then
    echo "These changed MastraCode tests do not exist as regular files at the proposed head and cannot run:" >&2
    cat "$missing_mastracode_tests" >&2
  fi
  if [[ -s "$unsupported_mastracode_tests" ]]; then
    echo "These MastraCode tests are outside the owned regression files:" >&2
    cat "$unsupported_mastracode_tests" >&2
  fi
  if [[ -s "$unsupported_owned_workspace_sources" ]]; then
    echo "These files are outside the PF-2044 owned source-and-test maps:" >&2
    cat "$unsupported_owned_workspace_sources" >&2
  fi
  if [[ -s "$unsupported_owned_workspace_tests" ]]; then
    echo "These tests are outside the PF-2044 owned service and runtime contracts:" >&2
    cat "$unsupported_owned_workspace_tests" >&2
  fi
  if [[ -s "$unsupported_owned_workspace_pairs" ]]; then
    echo "The PF-2042 self-hosting Inngest test, Compose topology, and adapter launcher must change together as regular files:" >&2
    cat "$unsupported_owned_workspace_pairs" >&2
  fi
  echo "Failing closed instead of reporting Core-only validation as workspace coverage." >&2
  exit 1
fi

workspace_changed() {
  grep -Fxq "$1" "$changed_workspaces"
}

server_route_source_changed() {
  grep -Eq \
    '^(packages/server/scripts/generate-(route-types|api-cli-route-metadata)\.ts|packages/server/src/server/(handlers|schemas|server-adapter/routes)/|packages/server/src/server/server-adapter/(api-schema-manifest|openapi-utils)\.ts)' \
    "$changed_files"
}

server_route_contract_changed() {
  server_route_source_changed ||
    grep -Eq \
      '^(client-sdks/client-js/src/route-types\.generated\.ts|packages/cli/src/commands/api/route-metadata\.generated\.ts)$' \
      "$changed_files"
}

check_client_route_consumers() {
  local timeout_seconds
  if ! timeout_seconds="$(remaining_validation_seconds 600)"; then
    echo 'Validation budget exhausted before Client SDK route-consumer typecheck.' >&2
    return 124
  fi

  timeout --kill-after=30s "${timeout_seconds}s" node - "$TYPESCRIPT_MODULE_PATH" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const ts = require(process.argv[2]);
const formatHost = {
  getCanonicalFileName: file => file,
  getCurrentDirectory: () => process.cwd(),
  getNewLine: () => '\n',
};
const configPath = 'client-sdks/client-js/tsconfig.json';
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) {
  console.error(ts.formatDiagnosticsWithColorAndContext([config.error], formatHost));
  process.exit(1);
}

const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
if (parsed.errors.length > 0) {
  console.error(ts.formatDiagnosticsWithColorAndContext(parsed.errors, formatHost));
  process.exit(1);
}

const rootNames = [
  'client-sdks/client-js/src/route-types.generated.ts',
  'client-sdks/client-js/src/types.ts',
  'client-sdks/client-js/src/resources/harness.ts',
].map(file => path.resolve(file));
const program = ts.createProgram({
  rootNames,
  options: {
    ...parsed.options,
    incremental: false,
    noEmit: true,
    tsBuildInfoFile: undefined,
  },
});
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length > 0) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost));
  process.exit(1);
}

const generatedSource = program.getSourceFile(rootNames[0]);
const generatedModule = generatedSource && program.getTypeChecker().getSymbolAtLocation(generatedSource);
if (!generatedSource || !generatedModule) {
  console.error('Could not resolve the generated Client SDK route-type module.');
  process.exit(1);
}
const generatedExports = new Set(
  program
    .getTypeChecker()
    .getExportsOfModule(generatedModule)
    .map(symbol => symbol.getName()),
);
const indexPath = 'client-sdks/client-js/src/index.ts';
const absoluteIndexPath = path.resolve(indexPath);
const generatedRoutePath = rootNames[0];
const resolvesToGeneratedRouteModule = specifier => {
  if (specifier === './route-types.generated.js') return true;
  const resolution = ts.resolveModuleName(specifier, absoluteIndexPath, parsed.options, ts.sys).resolvedModule;
  return Boolean(resolution && path.resolve(resolution.resolvedFileName) === generatedRoutePath);
};
const indexSource = ts.createSourceFile(
  indexPath,
  fs.readFileSync(indexPath, 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);
if (indexSource.parseDiagnostics.length > 0) {
  console.error(ts.formatDiagnosticsWithColorAndContext(indexSource.parseDiagnostics, formatHost));
  process.exit(1);
}
const publicRouteExports = [];
for (const statement of indexSource.statements) {
  if (
    !ts.isExportDeclaration(statement) ||
    !statement.moduleSpecifier ||
    !ts.isStringLiteralLike(statement.moduleSpecifier) ||
    !resolvesToGeneratedRouteModule(statement.moduleSpecifier.text)
  ) {
    continue;
  }
  if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) {
    console.error('Client SDK index must use explicit named generated route-type exports.');
    process.exit(1);
  }
  for (const element of statement.exportClause.elements) {
    publicRouteExports.push(element.propertyName?.text ?? element.name.text);
  }
}
if (publicRouteExports.length === 0) {
  console.error('Client SDK index has no explicit generated route-type re-export contract.');
  process.exit(1);
}
const missingPublicExports = publicRouteExports.filter(name => !generatedExports.has(name));
if (missingPublicExports.length > 0) {
  console.error(`Client SDK index references missing generated exports: ${missingPublicExports.join(', ')}`);
  process.exit(1);
}
console.log('Client SDK route consumers accept generated route types.');
NODE
}

check_client_index_entrypoint_contract() {
  local timeout_seconds
  if ! timeout_seconds="$(remaining_validation_seconds 60)"; then
    echo 'Validation budget exhausted before Client SDK public entrypoint comparison.' >&2
    return 124
  fi

  timeout --kill-after=30s "${timeout_seconds}s" \
    node - "$TYPESCRIPT_MODULE_PATH" "$merge_base_sha" "$HEAD_SHA" <<'NODE'
const { execFileSync } = require('node:child_process');

const ts = require(process.argv[2]);
const [baseSha, headSha] = process.argv.slice(3);
const indexPath = 'client-sdks/client-js/src/index.ts';
const reviewedModule = './resources/harness';
const reviewedExport = 'InboxResponseGeneration';
const readAt = revision =>
  execFileSync('git', ['show', `${revision}:${indexPath}`], { encoding: 'utf8' });
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

function moduleExportName(name) {
  return name && typeof name.text === 'string' ? name.text : undefined;
}

function entrypointContract(source, revision, removeReviewedExport) {
  const parsed = ts.createSourceFile(indexPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (parsed.parseDiagnostics.length > 0) {
    throw new Error(`Could not parse Client SDK index at ${revision}.`);
  }

  const contract = [];
  let reviewedExportCount = 0;
  for (const statement of parsed.statements) {
    if (!ts.isExportDeclaration(statement)) {
      contract.push({
        kind: 'statement',
        syntaxKind: ts.SyntaxKind[statement.kind],
        text: printer.printNode(ts.EmitHint.Unspecified, statement, parsed),
      });
      continue;
    }

    const moduleSpecifier =
      statement.moduleSpecifier && ts.isStringLiteralLike(statement.moduleSpecifier)
        ? statement.moduleSpecifier.text
        : statement.moduleSpecifier
          ? printer.printNode(ts.EmitHint.Unspecified, statement.moduleSpecifier, parsed)
          : null;
    const attributes = statement.attributes
      ? printer.printNode(ts.EmitHint.Unspecified, statement.attributes, parsed)
      : null;

    if (!statement.exportClause) {
      contract.push({
        kind: 'export-all',
        typeOnly: statement.isTypeOnly,
        moduleSpecifier,
        attributes,
      });
      continue;
    }

    if (ts.isNamespaceExport(statement.exportClause)) {
      contract.push({
        kind: 'export-namespace',
        typeOnly: statement.isTypeOnly,
        moduleSpecifier,
        attributes,
        name: moduleExportName(statement.exportClause.name),
      });
      continue;
    }

    const elements = [];
    for (const element of statement.exportClause.elements) {
      const sourceName = moduleExportName(element.propertyName) ?? moduleExportName(element.name);
      const exportedName = moduleExportName(element.name);
      const typeOnly = statement.isTypeOnly || element.isTypeOnly;
      const isReviewedExport =
        moduleSpecifier === reviewedModule &&
        typeOnly &&
        sourceName === reviewedExport &&
        exportedName === reviewedExport;
      if (removeReviewedExport && isReviewedExport) {
        reviewedExportCount += 1;
        continue;
      }
      elements.push({
        typeOnly,
        sourceName,
        exportedName,
      });
    }

    contract.push({
      kind: 'export-named',
      typeOnly: statement.isTypeOnly,
      moduleSpecifier,
      attributes,
      elements,
    });
  }
  return { contract, reviewedExportCount };
}

const baseResult = entrypointContract(readAt(baseSha), baseSha, false);
const headResult = entrypointContract(readAt(headSha), headSha, true);
if (
  headResult.reviewedExportCount !== 1 ||
  JSON.stringify(baseResult.contract) !== JSON.stringify(headResult.contract)
) {
  console.error(
    'Client SDK public entrypoint changed outside the reviewed InboxResponseGeneration type re-export.',
  );
  console.error(
    "This lane permits exactly one added type-only named export from './resources/harness'.",
  );
  console.error(`Reviewed export occurrences at head: ${headResult.reviewedExportCount}`);
  console.error(`Base contract: ${JSON.stringify(baseResult.contract)}`);
  console.error(`Head contract without the reviewed export: ${JSON.stringify(headResult.contract)}`);
  process.exit(1);
}
NODE
}

if grep -Fxq 'client-sdks/client-js/src/index.ts' "$changed_files"; then
  # This narrow lane exists only for the reviewed Harness response type needed
  # by PF-2246. Compare the complete semantic entrypoint shape with the PR merge
  # base before running package work, remove exactly one type-only named
  # InboxResponseGeneration re-export from the proposed head, and require every
  # remaining statement and export to be unchanged. This prevents unrelated
  # exports, aliases, route surfaces, side effects, or removals from hitching a
  # ride on the admitted index source-and-test pair.
  check_client_index_entrypoint_contract
fi


agent_builder_prerequisites_built=false
ensure_agent_builder_prerequisites() {
  if [[ "$agent_builder_prerequisites_built" == true ]]; then
    return
  fi
  # Build the native dependency graph, including MCP's fixture declarations.
  run_with_validation_budget 900 pnpm exec turbo run build --filter=@mastra/agent-builder... --concurrency=2
  agent_builder_prerequisites_built=true
}

server_prerequisites_built=false
ensure_server_prerequisites() {
  if [[ "$server_prerequisites_built" == true ]]; then
    return
  fi

  ensure_agent_builder_prerequisites
  run_with_validation_budget 900 pnpm --filter ./packages/server --fail-if-no-match build:lib
  server_prerequisites_built=true
}

fastify_prerequisites_built=false
ensure_fastify_prerequisites() {
  if [[ "$fastify_prerequisites_built" == true ]]; then
    return
  fi

  # Fastify's TypeScript project includes examples that resolve LibSQL and
  # observability through their dist exports. Its complete Vitest suite loads
  # @mastra/mcp through the shared adapter test utilities. A clean install has
  # none of those generated trees, so build the exact runtime prerequisites.
  ensure_server_prerequisites
  run_with_validation_budget 900 pnpm --filter ./stores/libsql --fail-if-no-match build:lib
  run_with_validation_budget 900 pnpm --filter ./observability/mastra --fail-if-no-match build
  run_with_validation_budget 900 pnpm --filter ./packages/mcp --fail-if-no-match build:lib
  fastify_prerequisites_built=true
}

deployer_prerequisites_built=false
ensure_deployer_prerequisites() {
  if [[ "$deployer_prerequisites_built" == true ]]; then
    return
  fi

  ensure_server_prerequisites
  run_with_validation_budget 900 pnpm --filter ./server-adapters/hono --fail-if-no-match build
  run_with_validation_budget 900 pnpm --filter ./packages/deployer --fail-if-no-match build:lib
  deployer_prerequisites_built=true
}

inngest_prerequisites_built=false
ensure_inngest_prerequisites() {
  if [[ "$inngest_prerequisites_built" == true ]]; then
    return
  fi

  # The Inngest suites runtime-import these workspace packages through their
  # published dist exports. A clean install has no generated dist tree, so
  # build the exact runtime prerequisites before typechecking or invoking any
  # admitted Inngest test file.
  ensure_deployer_prerequisites
  run_with_validation_budget 900 pnpm --filter ./stores/libsql --fail-if-no-match build:lib
  run_with_validation_budget 900 pnpm --filter ./observability/mastra --fail-if-no-match build
  inngest_prerequisites_built=true
}

if [[ "$inngest_index_test_changed" == true ]]; then
  # PF-2042 owns one exact live-dev-server topology; PF-2050 moves that topology
  # under the package runtime manager. Validate Compose structure here without
  # creating a second lifecycle owner.
  run_with_validation_budget 120 docker compose -f workflows/inngest/docker-compose.yaml config --quiet
fi

# Formatter ownership. `oxfmt` is this repository's formatter for root-owned source: `pnpm run
# format` is `format:eslint && format:oxfmt`, there is no prettier format script, and
# `lint:format` runs `oxfmt --check .` over everything except docs/, examples/, explorations/ and
# observability/_examples/. Checking a root-owned file with BOTH tools is not redundancy but
# contradiction - they disagree on a union type whose declaration does not fit on one line while
# its members fit on a continuation line, so each rewrites what the other just wrote and a PR
# touching such a file cannot satisfy both gates. Nine files on `main` are in exactly that state.
# So: oxfmt checks what it owns, prettier keeps only the trees oxfmt excludes, and docs are left
# to their own package-owned oxfmt-mdx check in .github/workflows/lint-docs.yml.
mapfile -t oxfmt_files < <(
  while IFS= read -r file; do
    if [[ ! -f "$file" || -L "$file" ]]; then
      continue
    fi
    case "$file" in
      docs/* | examples/* | explorations/* | observability/_examples/*)
        continue
        ;;
    esac
    if [[ "$file" =~ \.(cjs|css|gql|graphql|js|json|json5|jsonc|jsx|less|md|mdx|mjs|scss|toml|ts|tsx|ya?ml)$ ]]; then
      printf '%s\n' "$file"
    fi
  done < "$changed_files"
)

if (( ${#oxfmt_files[@]} > 0 )); then
  run_with_validation_budget 300 pnpm exec oxfmt --check --no-error-on-unmatched-pattern "${oxfmt_files[@]}"
fi

mapfile -t prettier_files < <(
  while IFS= read -r file; do
    if [[ ! -f "$file" || -L "$file" ]]; then
      continue
    fi
    case "$file" in
      examples/* | explorations/* | observability/_examples/*) ;;
      *)
        continue
        ;;
    esac
    if [[ "$file" =~ \.(cjs|css|js|json|jsx|md|mdx|mjs|ts|tsx|ya?ml)$ ]]; then
      printf '%s\n' "$file"
    fi
  done < "$changed_files"
)

if (( ${#prettier_files[@]} > 0 )); then
  run_with_validation_budget 300 pnpm exec prettier --check "${prettier_files[@]}"
fi

run_with_validation_budget 900 pnpm build:core
if grep -Fxq 'client-sdks/client-js/src/index.ts' "$changed_files"; then
  # The consumer compiler resolves @mastra/core through its built package
  # exports. Run only after build:core so this guard also works in clean CI.
  check_client_route_consumers
fi
run_with_validation_budget 600 pnpm --filter ./packages/core --fail-if-no-match check
if workspace_changed packages/core; then
  run_with_validation_budget 600 pnpm --filter ./packages/core --fail-if-no-match lint
fi
if [[ -z "${MOCK_PNPM_LOG:-}" ]]; then
  # The Vitest selection self-check drives real pnpm/vitest processes. Inside
  # the validator's own fixture harness pnpm is a command-logging mock, so the
  # self-check cannot run there; production runs never set MOCK_PNPM_LOG.
  run_vitest_selection_regressions
fi

if workspace_changed auth/okta; then
  run_with_validation_budget 900 pnpm --filter ./auth/okta --fail-if-no-match build
  run_with_validation_budget 600 pnpm --filter ./auth/okta --fail-if-no-match lint
fi

if workspace_changed browser/stagehand; then
  run_with_validation_budget 900 pnpm --filter ./browser/stagehand --fail-if-no-match build
  run_with_validation_budget 600 pnpm --filter ./browser/stagehand --fail-if-no-match lint
  run_with_validation_budget 900 pnpm --dir browser/stagehand exec vitest run \
    --reporter=dot --exclude src/__tests__/profile-lifecycle.test.ts
fi

if workspace_changed packages/_internal-core; then
  run_with_validation_budget 600 pnpm --dir packages/_internal-core typecheck
fi

if [[ "$types_builder_changed" == true ]]; then
  # This private build tool has no package scripts. Check its two owned JS
  # sources with native tools; build:core above consumes the real declarations
  # and the queued generator regression exercises both source boundaries.
  run_with_validation_budget 120 node --check packages/_types-builder/src/index.js
  run_with_validation_budget 120 node --check packages/_types-builder/src/replace-types.js
  run_with_validation_budget 300 pnpm exec oxlint packages/_types-builder/src/index.js packages/_types-builder/src/replace-types.js
fi

if workspace_changed packages/agent-builder; then
  ensure_agent_builder_prerequisites
  # The workflow extracts this helper beside the validator from the same
  # trusted revision, so a source PR cannot replace its own archive checker.
  run_with_validation_budget 300 pnpm exec node "$PACKED_DECLARATION_CHECK" --package packages/agent-builder
  run_with_validation_budget 600 pnpm --filter ./packages/agent-builder --fail-if-no-match check
  run_with_validation_budget 600 pnpm --filter ./packages/agent-builder --fail-if-no-match check:fixtures
  run_with_validation_budget 600 pnpm --filter ./packages/agent-builder --fail-if-no-match lint
fi

if workspace_changed packages/server; then
  ensure_server_prerequisites
  run_with_validation_budget 600 pnpm --filter ./packages/server --fail-if-no-match exec tsc --noEmit
  run_with_validation_budget 600 pnpm --filter ./packages/server --fail-if-no-match lint
  run_standard_server_core_imports_check 300 --filter ./packages/server --fail-if-no-match
fi

if workspace_changed packages/deployer; then
  ensure_deployer_prerequisites
  run_with_validation_budget 600 pnpm --filter ./packages/deployer --fail-if-no-match exec tsc --noEmit
  run_with_validation_budget 600 pnpm --filter ./packages/deployer --fail-if-no-match lint
fi

if workspace_changed packages/cli; then
  ensure_deployer_prerequisites
  run_with_validation_budget 900 pnpm --filter ./packages/loggers --fail-if-no-match build:lib
  run_with_validation_budget 600 pnpm --filter ./packages/cli --fail-if-no-match exec tsc --noEmit
  run_with_validation_budget 600 pnpm --filter ./packages/cli --fail-if-no-match lint
fi

if workspace_changed packages/codemod; then
  run_with_validation_budget 600 pnpm --filter ./packages/codemod --fail-if-no-match exec tsc --noEmit
  run_with_validation_budget 900 pnpm --filter ./packages/codemod --fail-if-no-match build
  run_with_validation_budget 600 pnpm --filter ./packages/codemod --fail-if-no-match lint
fi

if [[ "$types_builder_changed" == true ]] ||
  grep -Eq '^(scripts/(commonjs-tsc-fixer\.(js|test\.ts)|tsconfig\.json|vitest\.config\.ts)|vitest\.config\.ts)$' "$changed_files"; then
  # scripts/tsconfig.json includes the root vitest.config.ts, so this also
  # type-checks root Vitest config changes.
  run_with_validation_budget 600 pnpm exec tsc --project scripts/tsconfig.json --noEmit
fi

if grep -Fxq 'scripts/commonjs-tsc-fixer.js' "$changed_files"; then
  # The scripts tsconfig only type-checks the fixer's test and config, so a
  # changed JS fixer must run its Vitest regressions to be validated.
  echo "Running the CommonJS fixer Vitest regressions for the changed scripts/commonjs-tsc-fixer.js"
  run_with_validation_budget 600 pnpm exec vitest run \
    --config scripts/vitest.config.ts \
    --reporter=dot --reporter=json --outputFile.json="$fixer_test_result" \
    commonjs-tsc-fixer.test.ts
  node - "$fixer_test_result" <<'NODE'
const fs = require('node:fs');
const result = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (result.numPassedTests < 1 || result.numFailedTests !== 0) {
  console.error('The CommonJS fixer Vitest regressions did not record a passing run.');
  process.exit(1);
}
NODE
fi

if grep -Fxq 'vitest.config.ts' "$changed_files"; then
  # Type-checking alone does not execute the root config's project discovery.
  # Prove the changed root Vitest config still loads and resolves its
  # discovered projects by collecting the fixer suite through it.
  echo "Collecting the scripts project through the changed root vitest.config.ts"
  run_with_validation_budget 600 pnpm exec vitest list \
    --config vitest.config.ts --project scripts \
    --json="$root_vitest_config_list" commonjs-tsc-fixer.test.ts
  node - "$root_vitest_config_list" <<'NODE'
const fs = require('node:fs');
const listed = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!Array.isArray(listed) || listed.length < 1) {
  console.error('The root Vitest config smoke did not collect any scripts-project tests.');
  process.exit(1);
}
NODE
fi

if workspace_changed packages/memory; then
  run_with_validation_budget 600 pnpm --filter ./packages/memory --fail-if-no-match check
  run_with_validation_budget 900 pnpm --filter ./packages/memory --fail-if-no-match build:lib
fi

if workspace_changed packages/mcp; then
  run_with_validation_budget 600 pnpm --filter ./packages/mcp --fail-if-no-match exec tsc --noEmit
  run_with_validation_budget 900 pnpm --filter ./packages/mcp --fail-if-no-match build:lib
  run_with_validation_budget 600 pnpm --filter ./packages/mcp --fail-if-no-match lint
fi

if workspace_changed packages/server; then
  run_with_validation_budget 900 pnpm build:server
  run_with_validation_budget 600 pnpm --filter @mastra/server lint
  run_standard_server_core_imports_check 600 --filter @mastra/server
  run_with_validation_budget 300 pnpm --filter @mastra/server check:permissions
  if grep -Fxq 'packages/server/src/server/server-adapter/routes/permissions.ts' "$changed_files" || \
    grep -Fxq 'packages/core/src/auth/ee/interfaces/permissions.generated.ts' "$changed_files"; then
    # check:permissions only proves the generated RBAC table is self-consistent
    # with getEffectivePermission. Permission-source changes must also pass the
    # semantics suite that encodes what callers rely on.
    run_with_validation_budget 600 \
      pnpm --dir packages/server exec vitest run src/server/server-adapter/routes/permissions.test.ts --reporter=dot
  fi
  # Anchor artifact freshness to the commit the workflow checked out. In CI
  # that is the pull_request merge commit, whose second parent must be the PR
  # head; local and fixture runs check out the head directly. Capturing the
  # anchor before the generators run means a PR-controlled generator that
  # stages or commits its own output still diffs against reviewed content.
  server_artifact_anchor="$(git rev-parse HEAD)"
  if [[ "$server_artifact_anchor" != "$HEAD_SHA" && \
    "$(git rev-parse --quiet --verify 'HEAD^2' 2>/dev/null || true)" != "$HEAD_SHA" ]]; then
    echo "Validation checkout matches neither the pull request head ${HEAD_SHA} nor a merge of it." >&2
    echo "Failing closed instead of validating unreviewed content." >&2
    exit 1
  fi
  run_with_validation_budget 300 pnpm --filter @mastra/server generate:route-types
  run_with_validation_budget 300 pnpm --filter @mastra/server generate:api-cli-route-metadata
  if [[ "$(git rev-parse HEAD)" != "$server_artifact_anchor" ]]; then
    echo "A generator or package script moved HEAD during Server validation; failing closed." >&2
    exit 1
  fi
  if ! git cat-file -e "${server_artifact_anchor}:client-sdks/client-js/src/route-types.generated.ts" 2>/dev/null || \
    ! git cat-file -e "${server_artifact_anchor}:packages/cli/src/commands/api/route-metadata.generated.ts" 2>/dev/null || \
    ! git diff --exit-code "$server_artifact_anchor" -- \
      client-sdks/client-js/src/route-types.generated.ts \
      packages/cli/src/commands/api/route-metadata.generated.ts; then
    echo "Generated Server route artifacts are stale or missing from the pull request." >&2
    echo "Run both @mastra/server route generators and commit their output." >&2
    exit 1
  fi
  if server_route_contract_changed; then
    # Byte-clean generated output is not sufficient if either native consumer
    # rejects it. Keep this scoped to the direct Client SDK and CLI type/test
    # consumers so unrelated package baselines cannot mask route compatibility.
    check_client_route_consumers
    run_with_validation_budget 600 pnpm --dir client-sdks/client-js exec tsc-files --noEmit \
      src/route-types.generated.ts \
      src/types.ts \
      src/resources/harness.ts \
      src/resources/agent.test.ts
    run_with_validation_budget 600 pnpm --dir packages/cli exec tsc-files --noEmit \
      src/commands/api/route-metadata.generated.ts \
      src/commands/api/index.ts \
      src/commands/api/descriptors.test.ts
    run_with_validation_budget 600 \
      pnpm --dir client-sdks/client-js exec vitest run src/resources/harness.test.ts --reporter=dot
    run_with_validation_budget 600 \
      pnpm --dir packages/cli exec vitest run src/commands/api/descriptors.test.ts --reporter=dot
  fi
fi

if workspace_changed server-adapters/fastify; then
  # Fastify is admitted only for the exact PF-3553 reviewed file identities.
  # The pinned base's package tsconfig includes an unrelated example that does
  # not typecheck, so compile the complete reviewed production/test source set
  # directly. The package declaration build below independently compiles every
  # production source under tsconfig.build.json. The package suite runs later,
  # after changed-test admission.
  ensure_fastify_prerequisites
  run_with_validation_budget 600 \
    pnpm --dir server-adapters/fastify exec tsc-files --noEmit \
      src/index.ts \
      src/selected.ts \
      src/__tests__/selected-import-closure.test.ts \
      src/__tests__/selected-package-exports.test.ts \
      src/__tests__/selected-routes.test.ts
  run_with_validation_budget 900 \
    pnpm --filter ./server-adapters/fastify --fail-if-no-match build
  run_with_validation_budget 600 \
    pnpm --filter ./server-adapters/fastify --fail-if-no-match lint
  node <<'NODE'
const fs = require('node:fs');

const expectedOutputs = [
  'packages/server/dist/server/server-adapter/selected.d.ts',
  'packages/server/dist/server/server-adapter/selected.js',
  'packages/server/dist/server/server-adapter/selected.cjs',
  'packages/server/dist/server/server-adapter/routes/harness.d.ts',
  'packages/server/dist/server/server-adapter/routes/harness.js',
  'packages/server/dist/server/server-adapter/routes/harness.cjs',
  'server-adapters/fastify/dist/selected.d.ts',
  'server-adapters/fastify/dist/selected.js',
  'server-adapters/fastify/dist/selected.cjs',
];

for (const path of expectedOutputs) {
  let stat;
  try {
    stat = fs.lstatSync(path);
  } catch {
    console.error(`PF-3553 build did not emit reviewed export target: ${path}`);
    process.exit(1);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    console.error(`PF-3553 export target is not a regular build output: ${path}`);
    process.exit(1);
  }
}
NODE
fi

if workspace_changed client-sdks/ai-sdk; then
  run_with_validation_budget 600 pnpm --filter ./client-sdks/ai-sdk --fail-if-no-match exec tsc --noEmit
  run_with_validation_budget 900 pnpm --filter ./client-sdks/ai-sdk --fail-if-no-match build:lib
fi

if workspace_changed client-sdks/client-js; then
  run_with_validation_budget 600 pnpm --filter ./client-sdks/client-js --fail-if-no-match exec tsc --noEmit
  run_with_validation_budget 900 pnpm --filter ./client-sdks/client-js --fail-if-no-match build:lib
  run_with_validation_budget 600 pnpm --filter ./client-sdks/client-js --fail-if-no-match lint
fi

if [[ "$storage_harness_factory_registered" == true ]]; then
  # Storage Test Utils has no package-wide TypeScript command. Compile the
  # shared Harness definition, factory, and in-memory entrypoint together so
  # the AST-proven wiring is also checked against the real types.
  run_with_validation_budget 600 pnpm exec tsc-files --noEmit \
    stores/_test-utils/src/domains/harness/index.ts \
    stores/_test-utils/src/factory.ts \
    stores/_test-utils/src/index.test.ts
fi

if workspace_changed stores/pg; then
  run_with_validation_budget 600 pnpm --filter ./stores/pg --fail-if-no-match exec tsc --noEmit
  run_with_validation_budget 900 pnpm --filter ./stores/pg --fail-if-no-match build:lib
  run_with_validation_budget 600 pnpm --filter ./stores/pg --fail-if-no-match lint
fi

if workspace_changed stores/redis; then
  run_with_validation_budget 600 pnpm --filter ./stores/redis --fail-if-no-match exec tsc --noEmit
  run_with_validation_budget 900 pnpm --filter ./stores/redis --fail-if-no-match build:lib
  run_with_validation_budget 600 pnpm --filter ./stores/redis --fail-if-no-match lint
fi

if workspace_changed stores/convex; then
  run_with_validation_budget 600 pnpm --filter ./stores/convex --fail-if-no-match exec tsc --noEmit
  run_with_validation_budget 900 pnpm --filter ./stores/convex --fail-if-no-match build:lib
  run_with_validation_budget 600 pnpm --filter ./stores/convex --fail-if-no-match lint
fi

if workspace_changed stores/libsql; then
  run_with_validation_budget 600 pnpm --filter ./stores/libsql --fail-if-no-match exec tsc --noEmit
  run_with_validation_budget 900 pnpm --filter ./stores/libsql --fail-if-no-match build:lib
  run_with_validation_budget 600 pnpm --filter ./stores/libsql --fail-if-no-match lint
fi

if workspace_changed pubsub/google-cloud-pubsub; then
  run_with_validation_budget 600 pnpm --filter ./pubsub/google-cloud-pubsub --fail-if-no-match exec tsc --noEmit
  run_with_validation_budget 900 pnpm --filter ./pubsub/google-cloud-pubsub --fail-if-no-match build
  run_with_validation_budget 600 pnpm --filter ./pubsub/google-cloud-pubsub --fail-if-no-match lint
fi

if workspace_changed pubsub/redis-streams; then
  run_with_validation_budget 600 pnpm --filter ./pubsub/redis-streams --fail-if-no-match exec tsc --noEmit
  run_with_validation_budget 900 pnpm --filter ./pubsub/redis-streams --fail-if-no-match build
  run_with_validation_budget 600 pnpm --filter ./pubsub/redis-streams --fail-if-no-match lint
fi

if workspace_changed workflows/inngest; then
  ensure_inngest_prerequisites
fi

if workspace_changed workflows/inngest && [[ "$inngest_pf2042_trio_only" == false ]]; then
  run_with_validation_budget 600 pnpm --filter ./workflows/inngest --fail-if-no-match exec tsc --noEmit
  run_with_validation_budget 900 pnpm --filter ./workflows/inngest --fail-if-no-match build
  run_with_validation_budget 600 pnpm --filter ./workflows/inngest --fail-if-no-match lint
elif [[ "$inngest_pf2042_trio_only" == true ]]; then
  # PF-2051 owns the pre-existing createRun/RunWithRawInput type mismatch in
  # workflow.ts. Do not misreport the PF-2042 three-file infrastructure fix as
  # package-wide type coverage while that clean-base failure remains. The
  # reviewed test file is still formatted, linted directly, and run in full;
  # every other Inngest source/test continues through the normal owned map and
  # package gates above.
  echo 'PF-2042 exact Inngest test/Compose/adapter trio: deferring the package-wide typecheck and build baseline to PF-2051.'
  run_with_validation_budget 600 pnpm exec eslint \
    workflows/inngest/src/index.test.ts \
    workflows/inngest/src/__tests__/adapters/_utils.ts
fi

if workspace_changed workflows/temporal; then
  # Temporal integration fixtures import @mastra/temporal through its dist
  # export. A clean runner therefore needs this package build before tsc.
  run_with_validation_budget 900 pnpm --filter ./workflows/temporal --fail-if-no-match build
  run_with_validation_budget 600 pnpm --filter ./workflows/temporal --fail-if-no-match exec tsc --noEmit
  run_with_validation_budget 600 pnpm --filter ./workflows/temporal --fail-if-no-match lint
fi

if workspace_changed observability/mastra; then
  # @mastra/observability is consumed through its dist export - that is already why
  # ensure_inngest_prerequisites builds it before touching an Inngest suite - so a clean
  # runner needs the build before tsc can resolve the package's own emitted types.
  # The package declares no `typecheck` script, so typechecking goes through `exec tsc`
  # exactly as Temporal's does.
  run_with_validation_budget 900 pnpm --filter ./observability/mastra --fail-if-no-match build
  run_with_validation_budget 600 pnpm --filter ./observability/mastra --fail-if-no-match exec tsc --noEmit
  run_with_validation_budget 600 pnpm --filter ./observability/mastra --fail-if-no-match lint
fi

mastracode_prerequisites_built=false
ensure_mastracode_prerequisites() {
  if [[ "$mastracode_prerequisites_built" == true ]]; then
    return
  fi

  # MastraCode resolves workspace packages through their published dist
  # exports during typechecking and before Vitest applies its mocks. Build the
  # complete Code SDK dependency graph so a clean runner has declarations for
  # storage, memory, MCP, embeddings, signals, and browser integrations.
  run_with_validation_budget 900 pnpm turbo build --filter ./mastracode/sdk
  mastracode_prerequisites_built=true
}

if workspace_changed mastracode || workspace_changed mastracode/sdk || workspace_changed mastracode/tui; then
  ensure_mastracode_prerequisites
  mapfile -t mastracode_lint_files < <(
    while IFS= read -r file; do
      if [[ -f "$file" && "$file" =~ ^mastracode/.*\.(ts|tsx|js|jsx|mjs|cjs)$ ]]; then
        printf '%s\n' "$file"
      fi
    done < "$changed_files"
  )
  if (( ${#mastracode_lint_files[@]} > 0 )); then
    run_with_validation_budget 600 pnpm exec eslint "${mastracode_lint_files[@]}"
  fi
fi

if workspace_changed mastracode/sdk; then
  run_with_validation_budget 600 pnpm --filter ./mastracode/sdk --fail-if-no-match check
  run_with_validation_budget 900 pnpm --filter ./mastracode/sdk --fail-if-no-match build:lib
  run_with_validation_budget 600 pnpm --filter ./mastracode/sdk --fail-if-no-match lint
  if grep -Eq \
    '^(mastracode/sdk/scripts/index-messages\.ts|mastracode/sdk/src/utils/observation-index-input\.ts)$' \
    "$changed_files"; then
    # The SDK tsconfig and ESLint config intentionally exclude scripts/**.
    # Compile the executable migration entrypoint directly so its helper
    # import and indexObservation call cannot drift behind a green helper test.
    run_with_validation_budget 600 \
      pnpm --dir mastracode/sdk exec tsc-files --noEmit scripts/index-messages.ts
  fi
fi

if workspace_changed mastracode/tui; then
  # TUI imports the SDK package through its published entrypoints, so build the
  # exact direct workspace before compiling and testing the TUI.
  run_with_validation_budget 900 pnpm --filter ./mastracode/sdk --fail-if-no-match build:lib
  run_with_validation_budget 600 pnpm --filter ./mastracode/tui --fail-if-no-match check
  run_with_validation_budget 900 pnpm --filter ./mastracode/tui --fail-if-no-match build:lib
  run_with_validation_budget 600 pnpm --filter ./mastracode/tui --fail-if-no-match lint
fi

is_explicit_fork_safe_test() {
  case "$1" in
    packages/core/src/agent/durable/__tests__/durable-agent-background-tasks.e2e.test.ts | \
      packages/core/src/harness/v1/session.permission-gate.e2e.test.ts | \
      packages/core/src/harness/v1/session.plan-task.e2e.test.ts | \
    packages/core/src/harness/v1/session.real-agent.e2e.test.ts | \
      packages/server/src/server/handlers/favorites.integration.test.ts) return 0 ;;
    *) return 1 ;;
  esac
}

analyze_test_runtime_surface() {
  local mode="$1"
  local file="$2"

  node - \
    "$mode" \
    "$BASE_SHA" \
    "$file" \
    "$changed_files" \
    "$TYPESCRIPT_MODULE_PATH" <<'NODE'
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const { builtinModules } = require('node:module');
const path = require('node:path');

const [mode, baseSha, entryFile, changedFilesPath, typescriptModulePath] = process.argv.slice(2);
const ts = require(typescriptModulePath);
const repositoryRoot = process.cwd();
const changedFiles = new Set(fs.readFileSync(changedFilesPath, 'utf8').split('\n').filter(Boolean));

function repositoryPath(file) {
  const relative = path.relative(repositoryRoot, file);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Resolved test dependency escapes the repository: ${file}`);
  }
  return relative.split(path.sep).join('/');
}

function scriptKind(file) {
  switch (path.extname(file)) {
    case '.js':
    case '.cjs':
    case '.mjs':
      return ts.ScriptKind.JS;
    case '.jsx':
      return ts.ScriptKind.JSX;
    case '.tsx':
      return ts.ScriptKind.TSX;
    case '.json':
      return ts.ScriptKind.JSON;
    default:
      return ts.ScriptKind.TS;
  }
}

function sourceFile(file, source) {
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind(file));
}

function importDeclarationHasRuntimeValue(node) {
  const clause = node.importClause;
  if (!clause) return true;
  if (clause.isTypeOnly) return false;
  if (clause.name) return true;
  if (ts.isNamespaceImport(clause.namedBindings)) return true;
  return clause.namedBindings?.elements.some(element => !element.isTypeOnly) ?? false;
}

function exportDeclarationHasRuntimeValue(node) {
  if (node.isTypeOnly) return false;
  if (!node.exportClause || !ts.isNamedExports(node.exportClause)) return true;
  return node.exportClause.elements.some(element => !element.isTypeOnly);
}

function runtimeModuleSpecifiers(file, source, computedSpecifiers, runtimeOccurrences) {
  const specifiers = new Set();
  const addSpecifier = (specifier, node) => {
    specifiers.add(specifier);
    if (runtimeOccurrences) {
      const occurrences = runtimeOccurrences.get(specifier) ?? [];
      occurrences.push(node);
      runtimeOccurrences.set(specifier, occurrences);
    }
  };
  const parsed = sourceFile(file, source);
  const visit = node => {
    if (
      ts.isImportDeclaration(node) &&
      importDeclarationHasRuntimeValue(node) &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      addSpecifier(node.moduleSpecifier.text, node);
    } else if (
      ts.isExportDeclaration(node) &&
      exportDeclarationHasRuntimeValue(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      addSpecifier(node.moduleSpecifier.text, node);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      !node.isTypeOnly &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      addSpecifier(node.moduleReference.expression.text, node);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      if (node.arguments.length >= 1 && ts.isStringLiteralLike(node.arguments[0])) {
        addSpecifier(node.arguments[0].text, node);
      } else if (computedSpecifiers) {
        // A computed specifier hides the loaded module from this literal-only
        // scan, so the caller must fail closed instead of trusting the graph.
        computedSpecifiers.add(node.getText(parsed).slice(0, 120));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return specifiers;
}

function loadCompilerOptions() {
  const fallback = {
    allowJs: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    resolveJsonModule: true,
  };
  const configPath = ts.findConfigFile(path.dirname(path.resolve(entryFile)), ts.sys.fileExists, 'tsconfig.json');
  if (!configPath) return fallback;
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  return {
    ...fallback,
    ...ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath)).options,
  };
}

const compilerOptions = loadCompilerOptions();

function resolveLocalImport(importer, specifier, failOnUnresolved) {
  if (!specifier.startsWith('.')) return undefined;
  const resolved = ts.resolveModuleName(specifier, importer, compilerOptions, ts.sys).resolvedModule;
  if (!resolved) {
    if (failOnUnresolved) throw new Error(`Cannot resolve local test dependency ${specifier} from ${importer}`);
    return undefined;
  }
  const resolvedFile = path.resolve(resolved.resolvedFileName);
  repositoryPath(resolvedFile);
  return resolvedFile;
}

const baseSourceCache = new Map();
function readBaseSource(file) {
  const relative = repositoryPath(file);
  if (baseSourceCache.has(relative)) return baseSourceCache.get(relative);
  let source;
  try {
    source = execFileSync('git', ['show', `${baseSha}:${relative}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    source = undefined;
  }
  baseSourceCache.set(relative, source);
  return source;
}

function collectGraph(readSource, failOnUnresolved) {
  const entry = path.resolve(entryFile);
  const queue = [entry];
  const visited = new Set();
  while (queue.length > 0) {
    const file = queue.shift();
    const relative = repositoryPath(file);
    if (visited.has(relative)) continue;
    const source = readSource(file);
    if (source === undefined) continue;
    visited.add(relative);
    for (const specifier of runtimeModuleSpecifiers(file, source)) {
      const dependency = resolveLocalImport(file, specifier, failOnUnresolved);
      if (dependency) queue.push(dependency);
    }
  }
  return visited;
}

const headGraph = collectGraph(file => fs.readFileSync(file, 'utf8'), true);
const baseGraph = collectGraph(readBaseSource, false);
const surface = new Set(
  [...headGraph].filter(file => file === entryFile || changedFiles.has(file) || !baseGraph.has(file)),
);
surface.add(entryFile);

const bannedMastraPackages = new Set([
  'astra',
  'chroma',
  'clickhouse',
  'cloudflare',
  'cloudflare-d1',
  'convex',
  'couchbase',
  'dsql',
  'duckdb',
  'dynamodb',
  'elasticsearch',
  'lance',
  'libsql',
  'mongodb',
  'mssql',
  'mysql',
  'openai',
  'opensearch',
  'pg',
  'pinecone',
  'qdrant',
  'redis',
  's3vectors',
  'spanner',
  'turbopuffer',
  'upstash',
  'vectorize',
]);
const bannedBuiltins = new Set([
  'child_process',
  'cluster',
  'dgram',
  'dns',
  'http',
  'http2',
  'https',
  'net',
  'tls',
  'worker_threads',
]);
const nodeBuiltins = new Set(builtinModules.map(specifier => specifier.replace(/^node:/, '').split('/')[0]));
const exactTestEntries = new Set([
  'packages/core/src/agent/__tests__/supervisor-integration.test.ts',
  'packages/core/src/agent/__tests__/tool-approval.e2e.test.ts',
  'packages/core/src/agent/durable/__tests__/durable-agent-background-tasks.e2e.test.ts',
  'packages/core/src/harness/v1/session.permission-gate.e2e.test.ts',
  'packages/core/src/harness/v1/session.plan-task.e2e.test.ts',
  'packages/core/src/harness/v1/session.real-agent.e2e.test.ts',
  'packages/server/src/server/handlers/favorites.integration.test.ts',
]);

function unsupportedModuleReason(specifier) {
  if (specifier === '@playwright/test' || specifier === 'testcontainers') return specifier;
  if (specifier.startsWith('@ai-sdk/')) return specifier;
  if (specifier.startsWith('@openai/')) return specifier;
  if (specifier === '@anthropic-ai/sdk' || specifier === '@google/generative-ai') return specifier;
  if (specifier === 'ollama' || specifier === 'openai') return specifier;
  if (specifier === '@mastra/openai' || specifier.startsWith('@mastra/openai/')) return specifier;
  if (specifier.startsWith('@mastra/voice-')) return specifier;
  if (specifier.startsWith('@mastra/')) {
    const packageName = specifier.slice('@mastra/'.length).split('/')[0];
    if (bannedMastraPackages.has(packageName)) return specifier;
  }
  const bareSpecifier = specifier.startsWith('node:') ? specifier.slice('node:'.length) : specifier;
  if (bannedBuiltins.has(bareSpecifier.split('/')[0])) return specifier;
  return undefined;
}

function approvedExactExternalSpecifier(specifier, importer, occurrences) {
  // Tool Builder's owning SDK supplies this schema constructor. Every runtime
  // occurrence must retain the reviewed named import, including repeated uses
  // of the same module through another import or loader expression.
  if (specifier === '@internal/ai-v6' &&
    repositoryPath(importer) === 'packages/core/src/tools/tool-builder/builder.ts') {
    return Boolean(occurrences?.length && occurrences.every(node => {
      if (!ts.isImportDeclaration(node)) return false;
      const clause = node.importClause;
      return clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings) &&
        clause.namedBindings.elements.every(element =>
          element.isTypeOnly || (element.propertyName ?? element.name).text === 'jsonSchema');
    }));
  }
  const bareSpecifier = specifier.startsWith('node:') ? specifier.slice('node:'.length) : specifier;
  return (
    specifier === 'vitest' ||
    specifier === 'zod' ||
    specifier.startsWith('zod/') ||
    specifier === '@internal/ai-sdk-v5/test' ||
    specifier === '@mastra/core' ||
    specifier.startsWith('@mastra/core/') ||
    nodeBuiltins.has(bareSpecifier.split('/')[0])
  );
}

function propertyName(node) {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isElementAccessExpression(node) && node.argumentExpression && ts.isStringLiteralLike(node.argumentExpression)) {
    return node.argumentExpression.text;
  }
  return undefined;
}

function isTypePosition(node) {
  const parent = node.parent;
  return Boolean(parent && (ts.isTypeReferenceNode(parent) || ts.isTypeQueryNode(parent)));
}

function isDeclaredNamePosition(node) {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return true;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isPropertySignature(parent) && parent.name === node) return true;
  if (ts.isMethodDeclaration(parent) && parent.name === node) return true;
  if (ts.isBindingElement(parent) && parent.propertyName === node) return true;
  return false;
}

// Aliasing any of these globals (const request = fetch, const { env } = process,
// const load = require) strips the name this literal scanner keys on, so every
// value-position reference outside the directly supported shapes fails closed.
function runtimeGlobalFindings(file, source) {
  const parsed = sourceFile(file, source);
  const findings = [];
  const addFinding = (reason, node, name) => {
    let expression = node;
    const parent = node.parent;
    if (name === 'process' && reason === 'process.env' && parent) {
      expression = parent;
      const envConsumer = parent.parent;
      if (
        envConsumer &&
        (ts.isPropertyAccessExpression(envConsumer) || ts.isElementAccessExpression(envConsumer)) &&
        envConsumer.expression === parent
      ) {
        expression = envConsumer;
      }
    } else if (
      parent &&
      (ts.isCallExpression(parent) || ts.isNewExpression(parent)) &&
      parent.expression === node
    ) {
      expression = parent;
    }
    findings.push({ reason, fingerprint: `${reason}\u0000${expression.getText(parsed)}` });
  };
  const flagGlobalReference = (node, name) => {
    if (isDeclaredNamePosition(node) || isTypePosition(node)) return;
    const parent = node.parent;
    if (name === 'process') {
      const isMemberReceiver =
        parent &&
        (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
        parent.expression === node;
      if (isMemberReceiver) {
        if (propertyName(parent) === 'env') addFinding('process.env', node, name);
        return;
      }
      addFinding('process alias', node, name);
      return;
    }
    if (name === 'require') {
      if (parent && ts.isCallExpression(parent) && parent.expression === node) return;
      addFinding('require alias', node, name);
      return;
    }
    if (name === 'createRequire') {
      addFinding('createRequire()', node, name);
      return;
    }
    const isDirectCall =
      parent && (ts.isCallExpression(parent) || ts.isNewExpression(parent)) && parent.expression === node;
    addFinding(isDirectCall ? `${name}()` : `${name} alias`, node, name);
  };
  const visit = node => {
    if (ts.isIdentifier(node) && ['process', 'require', 'createRequire', 'fetch', 'WebSocket'].includes(node.text)) {
      flagGlobalReference(node, node.text);
    } else if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const accessedName = propertyName(node);
      if (['process', 'fetch', 'WebSocket'].includes(accessedName)) {
        // globalThis.process / globalThis['fetch'] and deeper receiver chains.
        flagGlobalReference(node, accessedName);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return findings;
}

function unsupportedRuntimeReasons(file, source) {
  const reasons = new Set();
  const wasReachableFromExactTest = baseGraph.has(repositoryPath(file));
  const baseSource = readBaseSource(file);
  const baseSpecifiers = baseSource ? runtimeModuleSpecifiers(file, baseSource) : new Set();
  const computedSpecifiers = new Set();
  const runtimeOccurrences = new Map();
  for (const specifier of runtimeModuleSpecifiers(file, source, computedSpecifiers, runtimeOccurrences)) {
    const reason = unsupportedModuleReason(specifier);
    // A banned specifier that already existed in this file at the trusted
    // base commit is part of the reviewed production surface (e.g. a server
    // handler's SSRF-guarded fetch); editing unrelated lines of that file
    // must not retroactively reject it. Only NEWLY ADDED banned imports in
    // the changed surface fail closed.
    if (reason && !(baseSource !== undefined && baseSpecifiers.has(specifier))) {
      reasons.add(`module ${reason}`);
    }
    // The Tool Builder approval names one export, so it remains scoped after
    // that import reaches the trusted base.
    if (
      exactTestEntries.has(entryFile) &&
      !specifier.startsWith('.') &&
      (!wasReachableFromExactTest || !baseSpecifiers.has(specifier) ||
        (specifier === '@internal/ai-v6' &&
          repositoryPath(file) === 'packages/core/src/tools/tool-builder/builder.ts')) &&
      !approvedExactExternalSpecifier(specifier, file, runtimeOccurrences.get(specifier))
    ) {
      reasons.add(`unreviewed external module ${specifier}`);
    }
  }
  for (const occurrence of computedSpecifiers) {
    reasons.add(`computed module specifier ${occurrence}`);
  }

  // Exact-path tests re-run when a reviewed runtime dependency changes. Keep
  // pre-existing global accesses trusted by fingerprint and count, while any
  // newly added or changed process/network access still fails closed.
  const baseGlobalCounts = new Map();
  if (wasReachableFromExactTest && baseSource !== undefined) {
    for (const finding of runtimeGlobalFindings(file, baseSource)) {
      baseGlobalCounts.set(finding.fingerprint, (baseGlobalCounts.get(finding.fingerprint) ?? 0) + 1);
    }
  }
  for (const finding of runtimeGlobalFindings(file, source)) {
    const trustedCount = baseGlobalCounts.get(finding.fingerprint) ?? 0;
    if (trustedCount > 0) {
      baseGlobalCounts.set(finding.fingerprint, trustedCount - 1);
    } else {
      reasons.add(finding.reason);
    }
  }
  return reasons;
}

if (mode === 'surface') {
  process.stdout.write([...surface].sort().join('\n'));
} else if (mode === 'unsupported') {
  const findings = [];
  for (const file of [...surface].sort()) {
    const absoluteFile = path.resolve(file);
    for (const reason of unsupportedRuntimeReasons(absoluteFile, fs.readFileSync(absoluteFile, 'utf8'))) {
      findings.push(`${file}: ${reason}`);
    }
  }
  process.stdout.write(findings.join('\n'));
} else {
  throw new Error(`Unknown test-runtime analysis mode: ${mode}`);
}
NODE
}

list_test_runtime_surface() {
  analyze_test_runtime_surface surface "$1"
}

test_runtime_surface_has_unsupported_runtime() {
  local file="$1"
  local findings=""

  if ! findings="$(analyze_test_runtime_surface unsupported "$file")"; then
    echo "Could not inspect the local runtime dependency surface for test: $file" >&2
    return 0
  fi
  if [[ -n "$findings" ]]; then
    echo "Unsupported fork-test runtime surface for $file:" >&2
    printf '%s\n' "$findings" >&2
    return 0
  fi
  return 1
}

is_pf3553_reviewed_server_test() {
  local file="$1"
  [[ "$pf3553_selected_route_exports" == true ]] || return 1
  case "$file" in
    packages/server/src/server/server-adapter/http-logging.test.ts | \
      packages/server/src/server/server-adapter/index.test.ts | \
      packages/server/src/server/server-adapter/selected-import-closure.test.ts | \
      packages/server/src/server/server-adapter/selected.test.ts) return 0 ;;
    *) return 1 ;;
  esac
}

# Collection is by path alone, because -f follows symlinks: a changed suite
# replaced by a dangling symlink would drop out of validation entirely instead
# of failing closed. git_regular_file_at_head below is the mode-aware existence
# check, and deleted suites already failed closed through "$deleted_tests".
mapfile -t detected_tests < <(
  while IFS= read -r file; do
    if [[ "$file" == browser/stagehand/src/__tests__/profile-lifecycle.test.ts ]] ||
      grep -Eq \
        '\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$|\.test-d\.ts$' \
        <<< "$file"; then
      printf '%s\n' "$file"
    fi
  done < "$changed_files"
)

# A changed or newly reachable local dependency of an exact-path exception
# changes the runtime contract of that test even when the test file is untouched.
# tool-approval.e2e.test.ts remains an exact changed-file exception, but is not
# dependency-triggered until its committed replay baseline is repaired.
for explicit_test in \
  packages/core/src/agent/__tests__/supervisor-integration.test.ts \
  packages/core/src/agent/durable/__tests__/durable-agent-background-tasks.e2e.test.ts \
  packages/core/src/harness/v1/session.permission-gate.e2e.test.ts \
  packages/core/src/harness/v1/session.plan-task.e2e.test.ts \
  packages/core/src/harness/v1/session.real-agent.e2e.test.ts \
  packages/server/src/server/handlers/favorites.integration.test.ts; do
  git_regular_file_at_head "$explicit_test" || continue
  if surface="$(list_test_runtime_surface "$explicit_test")"; then
    while IFS= read -r source_file; do
      if grep -Fxq "$source_file" "$changed_files"; then
        detected_tests+=("$explicit_test")
        break
      fi
    done <<< "$surface"
  else
    printf '%s\n' "$explicit_test" >> "$unsupported_tests"
  fi
done

if (( ${#detected_tests[@]} > 0 )); then
  mapfile -t detected_tests < <(printf '%s\n' "${detected_tests[@]}" | sort -u)
fi

if (( ${#detected_tests[@]} > 0 )) && [[ "$supervisor_provider_gate_verified" != true ]]; then
  for file in "${detected_tests[@]}"; do
    if [[ "$file" != packages/core/src/agent/__tests__/supervisor-integration.test.ts ]]; then
      continue
    fi
    if ! git_regular_file_at_head "$file"; then
      break
    fi
    if ! core_supervisor_test_preserves_provider_gate; then
      echo 'The exact supervisor suite changed its frozen real-provider safety boundary.' >&2
      exit 1
    fi
    supervisor_provider_gate_verified=true
    break
  done
fi

if (( ${#detected_tests[@]} > 0 )); then
  for file in "${detected_tests[@]}"; do
    if ! git_regular_file_at_head "$file"; then
      printf '%s\n' "$file" >> "$unsupported_tests"
    elif [[ "$file" == docs/* ]] && grep -Eq "['\"]@playwright/test['\"]" "$file"; then
      printf '%s\n' "$file" >> "$delegated_docs_tests"
    elif [[ "$file" == packages/core/src/agent/__tests__/supervisor-integration.test.ts ]] &&
      [[ "$supervisor_provider_gate_verified" == true ]] &&
      test_runtime_surface_has_unsupported_runtime "$file"; then
      printf '%s\n' "$file" >> "$unsupported_tests"
    elif [[ "$file" == packages/core/src/agent/__tests__/supervisor-integration.test.ts ]] &&
      [[ "$supervisor_provider_gate_verified" == true ]]; then
      # The deterministic supervisor suite is admitted only after its imports,
      # real-provider subtree, provider binding, and empty-key skip boundary
      # match the trusted base exactly.
      printf '%s\n' "$file" >> "$changed_tests"
    elif [[ "$file" == packages/core/src/agent/__tests__/tool-approval.e2e.test.ts ]] &&
      [[ "$tool_approval_replay_harness_verified" == true ]] &&
      test_runtime_surface_has_unsupported_runtime "$file"; then
      printf '%s\n' "$file" >> "$unsupported_tests"
    elif [[ "$file" == packages/core/src/agent/__tests__/tool-approval.e2e.test.ts ]] &&
      [[ "$tool_approval_replay_harness_verified" == true ]]; then
      # Recorder-backed approval coverage is admitted only after imports and
      # the gateway setup/lifecycle match the trusted replay harness exactly.
      printf '%s\n' "$file" >> "$changed_tests"
    elif is_explicit_fork_safe_test "$file" &&
      test_runtime_surface_has_unsupported_runtime "$file"; then
      printf '%s\n' "$file" >> "$unsupported_tests"
    elif is_pf3553_reviewed_server_test "$file"; then
      # These exact Server suites and their complete local dependency closure
      # are frozen by PF-3553's reviewed changed-path set and Git-object
      # digests. Their current closure contains conservative fetch()/process.env
      # markers but the reviewed tests make no provider or external-service
      # calls. Keep the generic runtime scanner fail-closed for every other PR.
      printf '%s\n' "$file" >> "$changed_tests"
    elif [[ "$file" == packages/server/* ]] &&
      test_runtime_surface_has_unsupported_runtime "$file"; then
      printf '%s\n' "$file" >> "$unsupported_tests"
    elif [[ "$file" == packages/core/src/agent/durable/__tests__/durable-agent-background-tasks.e2e.test.ts || \
      "$file" == packages/core/src/harness/v1/session.permission-gate.e2e.test.ts || \
      "$file" == packages/core/src/harness/v1/session.plan-task.e2e.test.ts || \
      "$file" == packages/core/src/harness/v1/session.real-agent.e2e.test.ts ]]; then
      # These exact Core suites are deterministic and fork-safe. They use
      # in-process stores and mock language models or the frozen recorder
      # harness with committed replay fixtures.
      printf '%s\n' "$file" >> "$changed_tests"
    elif [[ "$file" == packages/server/src/server/handlers/favorites.integration.test.ts ]]; then
      # This exact cross-layer Server suite is deterministic and fork-safe: it
      # exercises real route handlers against InMemoryStore without credentials,
      # provider calls, containers, or other external infrastructure.
      printf '%s\n' "$file" >> "$changed_tests"
    elif [[ "$file" == server-adapters/fastify/* ]]; then
      # The complete Fastify suite is deferred until every changed test has
      # been admitted. PF-3553 freezes the complete file surface by Git object
      # identity, so only these three reviewed suites may enter that run.
      case "$file" in
        server-adapters/fastify/src/__tests__/selected-import-closure.test.ts | \
          server-adapters/fastify/src/__tests__/selected-package-exports.test.ts | \
          server-adapters/fastify/src/__tests__/selected-routes.test.ts)
          printf '%s\n' "$file" >> "$fastify_changed_tests"
          ;;
        *) printf '%s\n' "$file" >> "$unsupported_tests" ;;
      esac
    elif [[ "$file" == browser/stagehand/src/__tests__/profile-lifecycle.test.ts ]]; then
      printf '%s\n' "$file" >> "$unsupported_tests"
    elif [[ "$file" == e2e-tests/* || "$file" == */integration-tests/* || \
      "$file" == mastracode/tui/e2e/* || \
      "$file" =~ \.e2e\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$ ]] || \
      grep -Eq "['\"]@playwright/test['\"]" "$file"; then
      printf '%s\n' "$file" >> "$unsupported_tests"
    elif [[ "$file" == mastracode/* && \
      "$file" != mastracode/tui/src/tui/components/login-dialog.test.ts && \
      "$file" != mastracode/tui/src/tui/event-dispatch.test.ts && \
      "$file" != mastracode/tui/src/tui/notify.test.ts && \
      "$file" != mastracode/tui/src/tui/__tests__/goal-manager.test.ts && \
      "$file" != mastracode/sdk/src/headless/run-mc.test.ts && \
      "$file" != mastracode/sdk/src/utils/__tests__/observation-index-input.test.ts && \
      "$file" != mastracode/sdk/src/utils/__tests__/signals-pubsub.test.ts ]]; then
      printf '%s\n' "$file" >> "$unsupported_tests"
    elif [[ "$file" =~ integration\.(test|spec)\. && \
      "$file" != packages/cli/src/services/service.deps.integration.test.ts && \
      "$file" != packages/codemod/src/lib/transform.integration.test.ts && \
      "$file" != packages/deployer/src/deploy/log.integration.test.ts && \
      "$file" != stores/pg/* && "$file" != stores/redis/* ]]; then
      printf '%s\n' "$file" >> "$unsupported_tests"
    elif [[ "$file" == stores/convex/src/cache/index.test.ts || \
      "$file" == stores/convex/src/server/cache.test.ts || \
      "$file" == stores/libsql/src/storage/index.test.ts || \
      "$file" == stores/libsql/src/storage/domains/harness/index.test.ts || \
      "$file" == stores/libsql/src/storage/domains/thread-state/index.test.ts || \
      "$file" == stores/libsql/src/storage/domains/workflows/atomic-resume.test.ts ]]; then
      printf '%s\n' "$file" >> "$changed_tests"
    elif [[ "$file" == stores/* && "$file" != stores/_test-utils/* && \
      "$file" != stores/pg/* && "$file" != stores/redis/* ]]; then
      printf '%s\n' "$file" >> "$unsupported_tests"
    elif [[ "$file" == "$PG_PERFORMANCE_INDEX_UNIT_TEST" ]]; then
      printf '%s\n' "$file" >> "$changed_tests"
    elif [[ "$file" == stores/pg/* && \
      ( "$file" =~ \.pooler\.test\. || "$file" =~ \.performance\.test\. || \
        "$file" == */performance-indexes/* || "$file" == */row-number-performance.test.* ) ]]; then
      printf '%s\n' "$file" >> "$unsupported_tests"
    else
      printf '%s\n' "$file" >> "$changed_tests"
    fi
  done
fi

if server_route_source_changed; then
  # Route generators prove artifact freshness; these canonical suites prove
  # the serving tuple remains collision-free and the public manifest remains
  # derivable from it even when the PR does not edit a test file.
  printf '%s\n' \
    'packages/server/src/server/server-adapter/schema-consistency.test.ts' \
    'packages/server/src/server/server-adapter/api-schema-manifest.test.ts' \
    >> "$changed_tests"
fi

if [[ -s "$forced_mastracode_tests" ]]; then
  echo "Forcing owned MastraCode suites to run for source-only changes:"
  sort -u "$forced_mastracode_tests"
  sort -u "$forced_mastracode_tests" >> "$changed_tests"
fi
if [[ -s "$forced_workspace_tests" ]]; then
  echo "Forcing PF-2044 owned suites to run for source-only changes:"
  sort -u "$forced_workspace_tests"
  sort -u "$forced_workspace_tests" >> "$changed_tests"
fi
sort -u -o "$changed_tests" "$changed_tests"

if [[ -s "$delegated_docs_tests" ]]; then
  echo "Delegating docs Playwright files to the fork-enabled Docs E2E workflow:"
  cat "$delegated_docs_tests"
fi

if [[ -s "$unsupported_tests" ]]; then
  echo "These changed tests require a dedicated fork-safe workflow or suite-specific infrastructure:" >&2
  cat "$unsupported_tests" >&2
  echo "Failing closed instead of reporting incomplete validation as successful." >&2
  exit 1
fi

if [[ -s "$fastify_changed_tests" ]]; then
  LC_ALL=C sort -u -o "$fastify_changed_tests" "$fastify_changed_tests"
  : > "$fastify_test_result"
  run_with_validation_budget 900 \
    env OPENAI_API_KEY= ANTHROPIC_API_KEY= GOOGLE_GENERATIVE_AI_API_KEY= \
    pnpm --dir server-adapters/fastify exec vitest run \
      --reporter=dot --reporter=json --outputFile.json="$fastify_test_result"
  node - "$fastify_test_result" "$fastify_changed_tests" <<'NODE'
const fs = require('node:fs');

const [reportPath, requiredPathsFile] = process.argv.slice(2);
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const requiredPaths = fs.readFileSync(requiredPathsFile, 'utf8').split('\n').filter(Boolean);
if (requiredPaths.length !== 3) {
  console.error(`PF-3553 expected exactly three reviewed Fastify suites; found ${requiredPaths.length}.`);
  process.exit(1);
}
if (!Number.isSafeInteger(report.numFailedTests) || report.numFailedTests !== 0) {
  console.error('The complete Fastify suite reported failed tests.');
  process.exit(1);
}
for (const requiredPath of requiredPaths) {
  const testResult = report.testResults?.find(result => {
    const normalizedName = String(result.name ?? '').replaceAll('\\', '/');
    return normalizedName === requiredPath || normalizedName.endsWith(`/${requiredPath}`);
  });
  const passedAssertions = testResult?.assertionResults?.filter(result => result.status === 'passed') ?? [];
  if (!testResult || testResult.status !== 'passed' || passedAssertions.length < 1) {
    console.error(`The complete Fastify suite did not collect and pass ${requiredPath}.`);
    process.exit(1);
  }
}
NODE
fi

storage_test_utils_runnable_test=false
while IFS= read -r file; do
  if [[ "$file" =~ ^stores/_test-utils/.*\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$ ]] &&
    grep -Fxq "$file" "$changed_files" &&
    git_regular_file_at_head "$file"; then
    storage_test_utils_runnable_test=true
    break
  fi
done < "$changed_tests"

if workspace_changed stores/_test-utils &&
  [[ "$storage_atomic_resume_conformance_owned" == false ]] &&
  [[ "$storage_harness_conformance_owned" == false ]] &&
  [[ "$storage_test_utils_runnable_test" == false ]]; then
  echo "Storage test utility changes must include a changed Vitest file in stores/_test-utils." >&2
  echo "Failing closed instead of accepting unexecuted shared conformance helpers." >&2
  exit 1
fi

require_test_service() {
  local service_name="$1"
  local host="$2"
  local port="$3"

  if [[ -n "${MOCK_SERVICE_LOG:-}" ]]; then
    printf '%s %s:%s\n' "$service_name" "$host" "$port" >> "$MOCK_SERVICE_LOG"
    if [[ "${MOCK_UNAVAILABLE_SERVICE:-}" == "$service_name" ]]; then
      echo "Required ${service_name} test service is unavailable at ${host}:${port}." >&2
      return 1
    fi
    return
  fi

  node - "$service_name" "$host" "$port" <<'NODE'
const net = require('node:net');

const [serviceName, host, rawPort] = process.argv.slice(2);
const port = Number(rawPort);
const deadline = Date.now() + 20_000;

function probe() {
  const socket = net.createConnection({ host, port });
  let settled = false;
  const finish = success => {
    if (settled) return;
    settled = true;
    socket.destroy();
    if (success) process.exit(0);
    if (Date.now() >= deadline) {
      console.error(`Required ${serviceName} test service is unavailable at ${host}:${port}.`);
      process.exit(1);
    }
    setTimeout(probe, 500);
  };
  socket.setTimeout(1_000);
  socket.once('connect', () => finish(true));
  socket.once('timeout', () => finish(false));
  socket.once('error', () => finish(false));
}

probe();
NODE
}

# A service-backed test is never treated as coverage merely because Vitest can
# be invoked. Prove the exact disposable endpoint is reachable before running
# any package command that might retry, skip, or hang when infrastructure is
# missing. In-process Convex/LibSQL/Inngest tests deliberately need no probe.
if grep -Eq '^stores/pg/.*\.(test|spec)\.' "$changed_tests"; then
  require_test_service postgres 127.0.0.1 5434
fi
if grep -Eq '^stores/redis/.*\.(test|spec)\.' "$changed_tests"; then
  require_test_service redis-store 127.0.0.1 6380
fi
if grep -Fxq 'pubsub/google-cloud-pubsub/src/group.test.ts' "$changed_tests"; then
  require_test_service google-cloud-pubsub-emulator 127.0.0.1 8085
fi
if grep -Fxq 'pubsub/redis-streams/src/pubsub.test.ts' "$changed_tests"; then
  require_test_service redis-streams 127.0.0.1 6381
fi
if grep -Fxq 'workflows/inngest/src/index.test.ts' "$changed_tests" &&
  [[ "$inngest_manager_owns_runtime" == false ]]; then
  require_test_service inngest-dev-server 127.0.0.1 4200
elif grep -Fxq 'workflows/inngest/src/index.test.ts' "$changed_tests"; then
  echo 'PF-2050 Inngest runtime manager owns pinned Docker startup, readiness, and cleanup for the live index suite.'
fi

if [[ ! -s "$changed_tests" ]]; then
  echo "No changed test files detected. Build and type checks completed."
  exit 0
fi

echo "Changed test files:"
cat "$changed_tests"

select_changed_agent_signal_tests() {
  local file="$1"
  local output_file="$2"

  node - "$TYPESCRIPT_MODULE_PATH" "$merge_base_sha" "$HEAD_SHA" "$file" > "$output_file" <<'NODE'
const { execFileSync } = require('node:child_process');
const ts = require(process.argv[2]);

const [baseSha, headSha, file] = process.argv.slice(3);
const readSource = sha => execFileSync('git', ['show', `${sha}:${file}`], { encoding: 'utf8' });
const diff = execFileSync('git', ['diff', '--unified=0', '--no-color', baseSha, headSha, '--', file], {
  encoding: 'utf8',
});

const oldRanges = [];
const newRanges = [];
for (const line of diff.split('\n')) {
  const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
  if (!match) continue;
  const oldCount = match[2] === undefined ? 1 : Number(match[2]);
  const newCount = match[4] === undefined ? 1 : Number(match[4]);
  if (oldCount > 0) oldRanges.push([Number(match[1]), Number(match[1]) + oldCount - 1]);
  if (newCount > 0) newRanges.push([Number(match[3]), Number(match[3]) + newCount - 1]);
}

function rootIdentifier(expression) {
  let current = expression;
  while (ts.isPropertyAccessExpression(current) || ts.isCallExpression(current)) {
    current = current.expression;
  }
  return ts.isIdentifier(current) ? current.text : undefined;
}

function collectTests(source) {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const tests = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ['it', 'test'].includes(rootIdentifier(node.expression))) {
      const name = node.arguments[0];
      if (name && (ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name))) {
        tests.push({
          name: name.text,
          start: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
          end: sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1,
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return tests;
}

const knownSharedFixtureTests = new Map([
  [
    'DeliverThenRejectRegistrationPubSub',
    ['does not reject a partially delivered registration until its enqueued stream is drained'],
  ],
  [
    'RejectFirstRunCompletedPubSub',
    ['removes a failed terminal without a drain waiter before the same run id is reused'],
  ],
]);

function collectKnownSharedFixtures(source) {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const fixtures = [];
  function visit(node) {
    if (ts.isClassDeclaration(node) && node.name && knownSharedFixtureTests.has(node.name.text)) {
      fixtures.push({
        name: node.name.text,
        start: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
        end: sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1,
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return fixtures;
}

function namesForRanges(source, tests, ranges, revision) {
  const names = new Set();
  const fixtures = collectKnownSharedFixtures(source);
  const sourceLines = source.split('\n');
  for (const [start, end] of ranges) {
    for (let line = start; line <= end; line += 1) {
      if ((sourceLines[line - 1] ?? '').trim() === '') continue;
      const containing = tests.filter(test => test.start <= line && test.end >= line);
      if (containing.length > 0) {
        containing.sort((left, right) => left.end - left.start - (right.end - right.start));
        names.add(containing[0].name);
        continue;
      }
      const fixture = fixtures.find(candidate => candidate.start <= line && candidate.end >= line);
      if (!fixture) {
        throw new Error(
          `${file} changes lines ${start}-${end} outside a named it()/test() case or owned shared fixture in ` +
            `${revision}; the fork validator cannot safely select coverage for this shared setup change.`,
        );
      }
      for (const testName of knownSharedFixtureTests.get(fixture.name) ?? []) names.add(testName);
    }
  }
  return names;
}

const baseSource = readSource(baseSha);
const headSource = readSource(headSha);
const baseTests = collectTests(baseSource);
const headTests = collectTests(headSource);
const headNameCounts = new Map();
for (const test of headTests) headNameCounts.set(test.name, (headNameCounts.get(test.name) ?? 0) + 1);
const headNames = new Set(headTests.map(test => test.name));
const selected = new Set(namesForRanges(headSource, headTests, newRanges, headSha));
for (const name of namesForRanges(baseSource, baseTests, oldRanges, baseSha)) {
  if (headNames.has(name)) selected.add(name);
}
for (const name of selected) {
  if (!headNames.has(name)) throw new Error(`Selected Agent signal test does not exist at ${headSha}: ${name}`);
  if (headNameCounts.get(name) !== 1) {
    throw new Error(
      `Selected Agent signal test name is not unique at ${headSha}: ${name}; ` +
        `found ${headNameCounts.get(name)} declarations.`,
    );
  }
}
if (selected.size === 0) {
  throw new Error(`No runnable changed test cases were selected for ${file}.`);
}

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const name of [...selected].sort()) {
  process.stdout.write(`${name}\t${escapeRegex(name)}$\n`);
}
NODE
}

type_test_report_has_passing_test() {
  local report_path="$1"
  node - "$report_path" <<'NODE'
const fs = require('node:fs');
const result = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const passed = result.numPassedTests;
const failed = result.numFailedTests;
if (
  !Number.isSafeInteger(passed) ||
  passed < 1 ||
  !Number.isSafeInteger(failed) ||
  failed !== 0
) {
  console.error('The changed type-test file did not execute a passing Vitest type test.');
  process.exit(1);
}
NODE
}

test_status=0
while IFS= read -r file; do
  status=0
  test_dir=""
  test_workspace=""
  vitest_environment=()
  if [[ "$file" == packages/core/src/agent/__tests__/tool-approval.e2e.test.ts ]]; then
    # Never let this recorder-backed exception fall back from a missing replay
    # fixture to auto-recording against a provider.
    vitest_environment=(env LLM_TEST_MODE=replay)
  elif [[ "$file" == packages/core/src/agent/__tests__/supervisor-integration.test.ts ]]; then
    # The frozen provider subtree remains skipped even if the runner happens to
    # carry an ambient OpenAI credential.
    vitest_environment=(env OPENAI_API_KEY=)
  elif is_pf3553_reviewed_server_test "$file"; then
    # Keep accidental hosted-runner provider credentials out of these exact
    # local Server suites even though the reviewed tests do not call providers.
    vitest_environment=(env OPENAI_API_KEY= ANTHROPIC_API_KEY= GOOGLE_GENERATIVE_AI_API_KEY=)
  fi
  search_dir="$(dirname "$file")"

  workspace_search_dir="$search_dir"
  while [[ "$workspace_search_dir" != "/" ]]; do
    if [[ "$workspace_search_dir" != "." && -f "$workspace_search_dir/package.json" && \
      "$workspace_search_dir" != */__fixtures__/* ]]; then
      test_workspace="$workspace_search_dir"
      break
    fi
    if [[ "$workspace_search_dir" == "." ]]; then
      break
    fi
    workspace_search_dir="$(dirname "$workspace_search_dir")"
  done

  while [[ "$search_dir" != "/" ]]; do
    if [[ -f "$search_dir/vitest.config.ts" || -f "$search_dir/vitest.config.mts" || \
      -f "$search_dir/vitest.config.js" || -f "$search_dir/vitest.config.mjs" || \
      -f "$search_dir/vitest.config.cjs" || -f "$search_dir/vite.config.ts" || \
      -f "$search_dir/vite.config.mts" || -f "$search_dir/vite.config.js" || \
      -f "$search_dir/vite.config.mjs" || -f "$search_dir/vite.config.cjs" ]]; then
      if [[ "$search_dir" == "." || -f "$search_dir/package.json" ]]; then
        test_dir="$search_dir"
        break
      fi
    fi
    if [[ "$search_dir" == "." ]]; then
      break
    fi
    search_dir="$(dirname "$search_dir")"
  done

  if [[ "$test_dir" == "." ]]; then
    test_dir=""
  fi

  vitest_config_args=()
  if [[ "$file" == "$PG_PERFORMANCE_INDEX_UNIT_TEST" ]]; then
    if [[ "$test_dir" != "stores/pg" || ! -f "$test_dir/vitest.perf.config.ts" ]]; then
      echo "The exact PostgreSQL performance-index unit route requires stores/pg/vitest.perf.config.ts; failing closed." >&2
      test_status=1
      continue
    fi
    vitest_config_args=(--config vitest.perf.config.ts)
  fi

  if [[ "$file" == packages/core/src/agent/__tests__/agent-signals.test.ts ]]; then
    selected_tests="$(mktemp)"
    set +e
    select_changed_agent_signal_tests "$file" "$selected_tests"
    status=$?
    set -e
    if (( status != 0 )); then
      echo "Unable to select isolated Agent signal tests; failing closed." >&2
      rm -f "$selected_tests"
      test_status=$status
      continue
    fi

    while IFS=$'\t' read -r test_name test_pattern; do
      set +e
      run_isolated_vitest_case \
        "$test_workspace" "${file#"$test_workspace"/}" "$test_name" "$test_pattern"
      status=$?
      set -e
      if (( status != 0 )); then
        break
      fi
    done < "$selected_tests"
    rm -f "$selected_tests"
    if (( status != 0 )); then
      test_status=$status
    fi
    continue
  fi

  if [[ -n "$test_dir" ]]; then
    relative_file="${file#"$test_dir"/}"
    if [[ "$file" == *.test-d.ts ]]; then
      if ! timeout_seconds="$(remaining_validation_seconds 600)"; then
        echo "Validation budget exhausted before $file; failing predictably before the workflow timeout." >&2
        test_status=124
        break
      fi
      test_result="$(mktemp)"
      set +e
      timeout --kill-after=30s "${timeout_seconds}s" \
        pnpm --dir "$test_dir" exec vitest run --typecheck.only \
          --reporter=dot --reporter=json --outputFile.json="$test_result" "$relative_file"
      status=$?
      set -e
      if (( status == 0 )); then
        set +e
        type_test_report_has_passing_test "$test_result"
        status=$?
        set -e
      fi
      rm -f "$test_result"
    else
      if ! timeout_seconds="$(remaining_validation_seconds 900)"; then
        echo "Validation budget exhausted before $file; failing predictably before the workflow timeout." >&2
        test_status=124
        break
      fi
      echo "Running changed test file in full: $file"
      test_result="$(mktemp)"
      set +e
      timeout --kill-after=30s "${timeout_seconds}s" \
        "${vitest_environment[@]}" pnpm --dir "$test_dir" exec vitest run \
          "${vitest_config_args[@]}" \
          --reporter=dot --reporter=json --outputFile.json="$test_result" \
          "$relative_file"
      status=$?
      set -e

      if (( status == 0 )); then
        set +e
        node - "$test_result" <<'NODE'
const fs = require('node:fs');
const result = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (result.numPassedTests < 1) {
  console.error('The changed test file did not execute a passing Vitest test.');
  process.exit(1);
}
NODE
        status=$?
        set -e
      fi
      rm -f "$test_result"
    fi
  elif [[ "$file" == *.test-d.ts ]]; then
    if ! timeout_seconds="$(remaining_validation_seconds 600)"; then
      echo "Validation budget exhausted before $file; failing predictably before the workflow timeout." >&2
      test_status=124
      break
    fi
    set +e
    vitest_command=(pnpm exec vitest)
    vitest_file="$file"
    if [[ -n "$test_workspace" ]]; then
      vitest_command=(pnpm --dir "$test_workspace" exec vitest)
      vitest_file="${file#"$test_workspace"/}"
    fi
    test_result="$(mktemp)"
    timeout --kill-after=30s "${timeout_seconds}s" \
      "${vitest_command[@]}" run --typecheck.only \
        --reporter=dot --reporter=json --outputFile.json="$test_result" "$vitest_file"
    status=$?
    set -e
    if (( status == 0 )); then
      set +e
      type_test_report_has_passing_test "$test_result"
      status=$?
      set -e
    fi
    rm -f "$test_result"
  else
    if ! timeout_seconds="$(remaining_validation_seconds 900)"; then
      echo "Validation budget exhausted before $file; failing predictably before the workflow timeout." >&2
      test_status=124
      break
    fi
    echo "Running changed test file in full: $file"
    test_result="$(mktemp)"
    set +e
    vitest_command=(pnpm exec vitest)
    vitest_file="$file"
    if [[ -n "$test_workspace" ]]; then
      vitest_command=(pnpm --dir "$test_workspace" exec vitest)
      vitest_file="${file#"$test_workspace"/}"
    fi
    timeout --kill-after=30s "${timeout_seconds}s" \
      "${vitest_environment[@]}" "${vitest_command[@]}" run \
        --reporter=dot --reporter=json --outputFile.json="$test_result" \
        "$vitest_file"
    status=$?
    set -e

    if (( status == 0 )); then
      set +e
      node - "$test_result" <<'NODE'
const fs = require('node:fs');
const result = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (result.numPassedTests < 1) {
  console.error('The changed test file did not execute a passing Vitest test.');
  process.exit(1);
}
NODE
      status=$?
      set -e
    fi

    rm -f "$test_result"
  fi

  if (( status != 0 )); then
    test_status=$status
  fi
done < "$changed_tests"

exit "$test_status"
