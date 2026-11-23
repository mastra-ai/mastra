#!/usr/bin/env bash
# Installs this fixture into a new consumer directory: published @mastra/mcp 1.x from npmjs, and
# @mastra/core plus its workspace dependencies from the E2E registry snapshot. Run it through
# ../with-registry.mjs, which sets MASTRA_COMPAT_REGISTRY and MASTRA_COMPAT_CORE_VERSION.
set -euo pipefail
consumer=${1:?Pass a new consumer directory}
registry=${MASTRA_COMPAT_REGISTRY:?Run through packages/mcp/integration-tests/with-registry.mjs}
core_version=${MASTRA_COMPAT_CORE_VERSION:?Run through packages/mcp/integration-tests/with-registry.mjs}
test ! -e "$consumer"
mkdir -p "$consumer"
fixture=$(cd "$(dirname "$0")" && pwd)
cp "$fixture/package.json" "$fixture/tsconfig.json" "$fixture/demo.ts" "$consumer/"
# pnpm 11 only fails on unmet peers when strictPeerDependencies is set in pnpm-workspace.yaml; the
# --strict-peer-dependencies CLI flag just warns. The snapshot core (0.0.0-e2e-test-*) is outside
# MCP 1.x's core peer range, so allow exactly that version on that one edge and check the real
# core version against the range with assert-core-peer-range.mjs instead.
cat > "$consumer/pnpm-workspace.yaml" <<EOF
strictPeerDependencies: true
peerDependencyRules:
  allowedVersions:
    '@mastra/mcp>@mastra/core': '$core_version'
EOF
cd "$consumer"
pnpm install --registry "$registry"
installed=$(node -p 'require("@mastra/core/package.json").version')
if [[ "$installed" != "$core_version" ]]; then
  echo "Installed @mastra/core@$installed, expected the E2E registry's $core_version" >&2
  exit 1
fi
node "$fixture/../assert-core-peer-range.mjs" "$consumer"
pnpm exec tsc --noEmit
pnpm demo
