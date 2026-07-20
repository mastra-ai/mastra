#!/usr/bin/env bash
# Scaffold a docs-audit eval job directory and minimal TypeScript project.
#
# Creates:
#   $RUN_DIR/evals/<job-slug>/doc-under-test.mdx
#   $RUN_DIR/evals/<job-slug>/project/package.json
#   $RUN_DIR/evals/<job-slug>/project/tsconfig.json
# and links requested local @mastra/* workspace packages for the eval project.
#
# Run from anywhere; resolves paths relative to this script's location.
#
# Usage:
#   bash .claude/skills/docs-audit/scripts/eval-setup.sh --run-dir "$RUN_DIR" --job "Retrieve an agent by ID" --doc docs/src/content/en/reference/core/getAgentById.mdx --pkg @mastra/core
#   bash .claude/skills/docs-audit/scripts/eval-setup.sh --run-dir "$RUN_DIR" --job "Use LibSQL memory" --doc docs/page.mdx --pkg @mastra/core --pkg @mastra/libsql
#
# Exit codes:
#   0 — eval job scaffolded and JOB_DIR=... printed
#   1 — setup failed
#   2 — bad CLI usage

set -uo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
WORKTREE_ROOT="$(cd -- "${SKILL_ROOT}/../../.." && pwd)"

RUN_DIR=""
JOB=""
DOC=""
PKGS=()

usage() {
  sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'
}

slugify() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g' \
    | cut -c 1-60 \
    | sed -E 's/-+$//'
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

resolve_path_in_worktree() {
  local input="$1"
  local abs dir base
  case "$input" in
    /*) abs="$input" ;;
    *) abs="$WORKTREE_ROOT/$input" ;;
  esac
  dir="$(dirname -- "$abs")"
  base="$(basename -- "$abs")"
  if [ ! -d "$dir" ]; then
    echo "eval-setup: doc directory does not exist: $dir" >&2
    return 1
  fi
  if ! dir="$(cd "$dir" && pwd -P)"; then
    echo "eval-setup: failed to resolve doc directory: $dir" >&2
    return 1
  fi
  abs="$dir/$base"
  case "$abs" in
    "$WORKTREE_ROOT"/*) ;;
    *)
      echo "eval-setup: refusing doc outside worktree: $input" >&2
      return 1
      ;;
  esac
  if [ ! -f "$abs" ]; then
    echo "eval-setup: doc file does not exist: $input" >&2
    return 1
  fi
  printf '%s\n' "$abs"
}

resolve_package_dir() {
  local pkg="$1"
  local candidate=""

  if [ "$pkg" = "@mastra/core" ] && [ -f "$WORKTREE_ROOT/packages/core/package.json" ]; then
    printf '%s\n' "$WORKTREE_ROOT/packages/core"
    return 0
  fi

  case "$pkg" in
    @mastra/*)
      local short="${pkg#@mastra/}"
      if [ -f "$WORKTREE_ROOT/packages/$short/package.json" ]; then
        if node -e 'const fs=require("fs"); const p=process.argv[1]; const n=process.argv[2]; process.exit(JSON.parse(fs.readFileSync(p,"utf8")).name===n?0:1)' "$WORKTREE_ROOT/packages/$short/package.json" "$pkg" 2>/dev/null; then
          printf '%s\n' "$WORKTREE_ROOT/packages/$short"
          return 0
        fi
      fi
      ;;
  esac

  while IFS= read -r package_json; do
    if node -e 'const fs=require("fs"); const p=process.argv[1]; const n=process.argv[2]; try { process.exit(JSON.parse(fs.readFileSync(p,"utf8")).name===n?0:1) } catch { process.exit(1) }' "$package_json" "$pkg" 2>/dev/null; then
      candidate="$(dirname -- "$package_json")"
      break
    fi
  done < <(find "$WORKTREE_ROOT" \
    \( -path '*/node_modules' -o -path '*/.git' -o -path '*/dist' -o -path '*/.turbo' \) -prune \
    -o -name package.json -type f -print)

  if [ -n "$candidate" ]; then
    (cd "$candidate" && pwd -P)
    return 0
  fi

  return 1
}

write_package_json() {
  local project_dir="$1"
  shift
  local deps=("$@")
  local first="yes"
  {
    printf '{\n'
    printf '  "name": "%s",\n' "$(json_escape "eval-$job_slug")"
    printf '  "private": true,\n'
    printf '  "type": "module",\n'
    printf '  "dependencies": {'
    if [ ${#deps[@]} -gt 0 ]; then
      printf '\n'
      for entry in "${deps[@]}"; do
        local name="${entry%%$'\t'*}"
        local dir="${entry#*$'\t'}"
        if [ "$first" = "no" ]; then
          printf ',\n'
        fi
        first="no"
        printf '    "%s": "file:%s"' "$(json_escape "$name")" "$(json_escape "$dir")"
      done
      printf '\n  }\n'
    else
      printf '}\n'
    fi
    printf '}\n'
  } > "$project_dir/package.json"
}

write_workspace_yaml() {
  local project_dir="$1"
  local root_workspace="$WORKTREE_ROOT/pnpm-workspace.yaml"

  if [ ! -f "$root_workspace" ]; then
    echo "eval-setup: root pnpm-workspace.yaml not found: $root_workspace" >&2
    return 1
  fi

  {
    printf 'packages:\n'
    printf '  - .\n'
    awk -v root="$WORKTREE_ROOT" '
      /^packages:[[:space:]]*$/ { in_packages = 1; next }
      in_packages && /^[^[:space:]#]/ { exit }
      in_packages && /^[[:space:]]*-[[:space:]]*/ {
        entry = $0
        sub(/^[[:space:]]*-[[:space:]]*/, "", entry)
        sub(/[[:space:]]+#.*$/, "", entry)
        gsub(/^['\''"]|['\''"]$/, "", entry)
        if (entry != "." && entry != "") {
          printf "  - \"%s/%s\"\n", root, entry
        }
      }
    ' "$root_workspace"
  } > "$project_dir/pnpm-workspace.yaml"
}

symlink_package() {
  local project_dir="$1"
  local pkg="$2"
  local pkg_dir="$3"
  local scope name target_dir target

  case "$pkg" in
    @*/*)
      scope="${pkg%%/*}"
      name="${pkg#*/}"
      target_dir="$project_dir/node_modules/$scope"
      target="$target_dir/$name"
      ;;
    *)
      target_dir="$project_dir/node_modules"
      target="$target_dir/$pkg"
      ;;
  esac

  mkdir -p "$target_dir"
  rm -rf "$target"
  ln -s "$pkg_dir" "$target"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --run-dir)
      if [ $# -lt 2 ] || [ -z "${2:-}" ]; then echo "eval-setup: --run-dir requires a directory" >&2; exit 2; fi
      RUN_DIR="$2"; shift 2 ;;
    --job)
      if [ $# -lt 2 ] || [ -z "${2:-}" ]; then echo "eval-setup: --job requires text" >&2; exit 2; fi
      JOB="$2"; shift 2 ;;
    --doc)
      if [ $# -lt 2 ] || [ -z "${2:-}" ]; then echo "eval-setup: --doc requires a path" >&2; exit 2; fi
      DOC="$2"; shift 2 ;;
    --pkg)
      if [ $# -lt 2 ] || [ -z "${2:-}" ]; then echo "eval-setup: --pkg requires a package name" >&2; exit 2; fi
      PKGS+=("$2"); shift 2 ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "eval-setup: unknown argument: $1" >&2
      usage >&2
      exit 2 ;;
  esac
done

if [ -z "$RUN_DIR" ]; then echo "eval-setup: --run-dir is required" >&2; exit 2; fi
if [ ! -d "$RUN_DIR" ]; then echo "eval-setup: run directory does not exist: $RUN_DIR" >&2; exit 2; fi
if [ -z "$JOB" ]; then echo "eval-setup: --job is required" >&2; exit 2; fi
if [ -z "$DOC" ]; then echo "eval-setup: --doc is required" >&2; exit 2; fi
if ! command -v node >/dev/null 2>&1; then echo "eval-setup: node is required to read package.json files" >&2; exit 1; fi

DOC_ABS="$(resolve_path_in_worktree "$DOC")" || exit 2
job_slug="$(slugify "$JOB")"
if [ -z "$job_slug" ]; then job_slug="eval-job"; fi
JOB_DIR="$RUN_DIR/evals/$job_slug"
PROJECT_DIR="$JOB_DIR/project"

if ! mkdir -p "$PROJECT_DIR/src"; then
  echo "eval-setup: failed to create eval project: $PROJECT_DIR" >&2
  exit 1
fi
if ! cp "$DOC_ABS" "$JOB_DIR/doc-under-test.mdx"; then
  echo "eval-setup: failed to copy doc-under-test.mdx" >&2
  exit 1
fi

cat > "$PROJECT_DIR/tsconfig.json" <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
EOF

PKG_ENTRIES=()
for pkg in "${PKGS[@]}"; do
  pkg_dir="$(resolve_package_dir "$pkg")" || {
    echo "eval-setup: could not resolve workspace package: $pkg" >&2
    exit 1
  }
  printf 'PKG %s -> %s\n' "$pkg" "$pkg_dir"
  PKG_ENTRIES+=("$pkg"$'\t'"$pkg_dir")
done

write_package_json "$PROJECT_DIR" "${PKG_ENTRIES[@]}"
if ! write_workspace_yaml "$PROJECT_DIR"; then
  echo "eval-setup: failed to write temp pnpm-workspace.yaml" >&2
  exit 1
fi

setup_method="pnpm install with absolute file dependencies"
install_log="$JOB_DIR/install.log"
printf '$ pnpm install\n\n' > "$install_log"
(
  cd "$PROJECT_DIR" && pnpm install
) >> "$install_log" 2>&1
install_code=$?

if [ $install_code -ne 0 ] || [ ! -x "$PROJECT_DIR/node_modules/.bin/tsc" ]; then
  setup_method="symlink+repo-tsc"
  printf '\n[docs-audit] pnpm install failed or tsc missing; falling back to local symlinks + repo tsc\n' >> "$install_log"
  for entry in "${PKG_ENTRIES[@]}"; do
    pkg="${entry%%$'\t'*}"
    pkg_dir="${entry#*$'\t'}"
    if ! symlink_package "$PROJECT_DIR" "$pkg" "$pkg_dir"; then
      echo "eval-setup: failed to symlink $pkg" >&2
      exit 1
    fi
  done
  if [ -d "$WORKTREE_ROOT/node_modules/@types" ]; then
    mkdir -p "$PROJECT_DIR/node_modules"
    rm -rf "$PROJECT_DIR/node_modules/@types"
    ln -s "$WORKTREE_ROOT/node_modules/@types" "$PROJECT_DIR/node_modules/@types"
  fi
fi

printf '%s\n' "$setup_method" > "$JOB_DIR/setup-method.txt"
printf 'JOB_DIR=%s\n' "$JOB_DIR"
printf 'SETUP_METHOD=%s\n' "$setup_method"
