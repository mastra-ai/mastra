#!/usr/bin/env bash
# Runs the packed-core compatibility consumers: published @mastra/mcp 1.x against a packed
# @mastra/core build, then the core-native suspend/resume contract. Requires a built core
# (`pnpm build:core` from the repository root).
set -euo pipefail
root=$(cd "$(dirname "$0")/../../.." && pwd)
out=$(mktemp -d "${TMPDIR:-/tmp}/mcp-compat-XXXXXX")
trap 'rm -rf "$out"' EXIT
(cd "$root" && pnpm --filter ./packages/core pack --pack-destination "$out" > "$out/pack.log")
core=$(ls "$out"/mastra-core-*.tgz)
bash "$root/packages/mcp/integration-tests/published-v1/run.sh" "$core" "$out/published-v1"
bash "$root/packages/mcp/integration-tests/core-native/run.sh" "$core" "$out/core-native"
echo "MCP COMPAT PASS: published MCP 1.x and the core-native contract against $(basename "$core")"
