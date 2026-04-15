#!/bin/bash
# Teardown script - removes all runtime state for a fresh start
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Cleaning browser-workspace example..."

# Remove runtime data
rm -rf "$PROJECT_DIR/src/mastra/public"

# Remove node_modules and lockfile
rm -rf "$PROJECT_DIR/node_modules"
rm -f "$PROJECT_DIR/pnpm-lock.yaml"

echo "Done. Run 'pnpm install' and 'pnpm dev' to start fresh."
