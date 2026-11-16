#!/usr/bin/env bash
# Runs the core compatibility consumers: published @mastra/mcp 1.x against this checkout's
# @mastra/core, then the core-native suspend/resume contract. Core and its workspace dependencies
# come from the E2E registry snapshot at MASTRA_E2E_REGISTRY_STORAGE (see published-v1/README.md),
# so they install even when their versions are not on npmjs yet, as on a version-packages PR.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
if [[ -z "${MASTRA_COMPAT_REGISTRY:-}" ]]; then
  exec node "$here/with-registry.mjs" bash "$here/compat.sh"
fi
out=$(mktemp -d "${TMPDIR:-/tmp}/mcp-compat-XXXXXX")
trap 'rm -rf "$out"' EXIT
bash "$here/published-v1/run.sh" "$out/published-v1"
bash "$here/core-native/run.sh" "$out/core-native"
echo "MCP COMPAT PASS: published MCP 1.x and the core-native contract against @mastra/core@$MASTRA_COMPAT_CORE_VERSION from the E2E registry"
