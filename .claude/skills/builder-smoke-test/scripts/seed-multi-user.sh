#!/usr/bin/env bash
# Seed the scaffolded project's libsql DB with two skills owned by a fake
# "other user" so the smoke test can exercise non-owner flows (Library Copy,
# non-owner visibility, RBAC) without provisioning a second WorkOS account.
#
# What gets seeded:
#   - smoke-seed-public-skill  (owner=user_seed_other, visibility=public, status=published)
#   - smoke-seed-private-skill (owner=user_seed_other, visibility=private, status=published)
# Each gets a single version row so the UI has something to render.
#
# Project dir resolution (first wins):
#   1. --dir <path> flag
#   2. $BUILDER_SMOKE_TEST_DIR env var
#   3. ~/mastra-builder-smoke-tests/builder-smoke  (default)
#
# Idempotent: re-running deletes the seeded rows first then re-inserts.
# Uses the sqlite3 CLI directly against the on-disk libsql DB file; no node
# dependencies required.
#
# Usage:
#   bash seed-multi-user.sh
#   bash seed-multi-user.sh --dir /custom/path
#
# Exit codes:
#   0 — seed complete; printed PROJECT_DIR=... DB_PATH=... SEEDED_PUBLIC=... SEEDED_PRIVATE=...
#   1 — failed; stderr explains which step

set -uo pipefail

DEFAULT_PROJECT_DIR="${HOME}/mastra-builder-smoke-tests/builder-smoke"

PROJECT_DIR=""

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) PROJECT_DIR="${2:-}"; shift 2 ;;
    --dir=*) PROJECT_DIR="${1#--dir=}"; shift ;;
    -h|--help) sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "seed-multi-user: unknown arg '$1'" >&2; exit 1 ;;
  esac
done

if [ -z "${PROJECT_DIR}" ]; then
  PROJECT_DIR="${BUILDER_SMOKE_TEST_DIR:-$DEFAULT_PROJECT_DIR}"
fi

if [ ! -d "${PROJECT_DIR}" ]; then
  echo "seed-multi-user: PROJECT_DIR does not exist: ${PROJECT_DIR}" >&2
  echo "  Run scaffold.sh first." >&2
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "seed-multi-user: sqlite3 CLI not found in PATH" >&2
  exit 1
fi

# mastra dev rewrites the libsql `file:./mastra.db` URL relative to the
# bundled output dir, so the runtime DB usually lives at
# src/mastra/public/mastra.db rather than the project root. Try both.
DB_PATH=""
for candidate in \
    "${PROJECT_DIR}/src/mastra/public/mastra.db" \
    "${PROJECT_DIR}/mastra.db"; do
  if [ -f "${candidate}" ]; then
    DB_PATH="${candidate}"
    break
  fi
done

if [ -z "${DB_PATH}" ]; then
  echo "seed-multi-user: mastra.db not found under ${PROJECT_DIR}" >&2
  echo "  Start the server once (pnpm mastra:dev) so libsql initializes the tables, then re-run." >&2
  exit 1
fi

# Confirm the skill tables exist (server has booted at least once).
if ! sqlite3 "${DB_PATH}" "SELECT name FROM sqlite_master WHERE type='table' AND name='mastra_skills';" | grep -q "mastra_skills"; then
  echo "seed-multi-user: mastra_skills table missing in ${DB_PATH}" >&2
  echo "  Start the server once (pnpm mastra:dev) so libsql initializes the tables, then re-run." >&2
  exit 1
fi

now="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
other_user="user_seed_other"
public_id="smoke-seed-public-skill"
private_id="smoke-seed-private-skill"
public_version="$(uuidgen | tr '[:upper:]' '[:lower:]')"
private_version="$(uuidgen | tr '[:upper:]' '[:lower:]')"

sqlite3 "${DB_PATH}" <<SQL
-- foreign_keys=OFF so we can DELETE versions before the parent skills row
-- (the schema has a self-referential FK between mastra_skills.activeVersionId
-- and mastra_skill_versions.id; without the pragma the cleanup half of an
-- idempotent re-run aborts before the INSERT can re-seed).
PRAGMA foreign_keys = OFF;
-- All interpolated values below are script-internal constants (public_id,
-- private_id, generated uuids, frozen 'user_seed_other'); none come from
-- user input, so direct string interpolation is safe inside this heredoc.
DELETE FROM mastra_skill_versions WHERE skillId IN ('${public_id}', '${private_id}');
DELETE FROM mastra_skills         WHERE id      IN ('${public_id}', '${private_id}');

INSERT INTO mastra_skill_versions
  (id, skillId, versionNumber, name, description, instructions,
   license, compatibility, source, "references", scripts, assets, files, metadata, tree,
   changedFields, changeMessage, createdAt)
VALUES
  ('${public_version}', '${public_id}', 1,
   'Seeded public skill',
   'Public skill owned by a different user; used for Library Copy and non-owner flows.',
   'You are a seeded skill used by the builder smoke test.',
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
   '["name","description","instructions"]', 'Initial version (seeded)', '${now}'),
  ('${private_version}', '${private_id}', 1,
   'Seeded private skill',
   'Private skill owned by a different user; should be hidden from non-owners.',
   'You are a seeded private skill used by the builder smoke test.',
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
   '["name","description","instructions"]', 'Initial version (seeded)', '${now}');

INSERT INTO mastra_skills
  (id, status, activeVersionId, authorId, visibility, favoriteCount, createdAt, updatedAt)
VALUES
  ('${public_id}',  'published', '${public_version}',  '${other_user}', 'public',  0, '${now}', '${now}'),
  ('${private_id}', 'published', '${private_version}', '${other_user}', 'private', 0, '${now}', '${now}');
SQL

status=$?
if [ "${status}" -ne 0 ]; then
  echo "seed-multi-user: sqlite3 insert failed (exit ${status})" >&2
  exit 1
fi

echo "PROJECT_DIR=${PROJECT_DIR}"
echo "DB_PATH=${DB_PATH}"
echo "SEEDED_PUBLIC=${public_id}"
echo "SEEDED_PRIVATE=${private_id}"
