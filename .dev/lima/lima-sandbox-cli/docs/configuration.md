# Configuration Reference

lima-sandbox uses a TOML configuration file (`.lima-sandbox.toml`) in your project root.

## Example Configuration

```toml
# .lima-sandbox.toml

# Project identifier (used for VM naming: {project}-golden, {project}-worker-1, etc.)
project = "my-project"

# VM Resources
[vm]
cpus = 4
memory = "8GiB"
disk = "30GiB"
# VM type: "vz" (Apple Virtualization) or "qemu"
vmType = "vz"
# Base image (default: Ubuntu 22.04 ARM64)
image = "ubuntu-22.04"

# Development tools to install in the golden image
[tools]
# Node.js version (via nvm)
nodejs = "22"
# Python version (via pyenv) - optional
python = "3.13"
# Rust toolchain (via rustup) - optional
rust = "stable"
# Go version - optional
go = "1.22"
# DuckDB version - optional
duckdb = "1.1.3"
# Additional apt packages
apt = ["jq", "ripgrep", "fd-find"]

# Claude Code configuration
[claude]
# Install Claude Code in golden image
install = true
# Claude Code version (default: latest)
# version = "1.0.0"

# Sync TO workers (lima-sandbox sync)
[sync.to]
# Default paths to sync (if none specified on CLI)
default_paths = ["shared/"]
# Always exclude these patterns
exclude = [
    "node_modules/",
    ".git/",
    "target/",
    ".venv/",
    "__pycache__/",
    "dist/",
    "*.log",
]

# Sync FROM workers (lima-sandbox sync-back)
[sync.from]
# Default: sync entire repo
# default_paths = []
exclude = [
    "node_modules/",
    ".git/",
    "target/",
    ".venv/",
    "__pycache__/",
    "dist/",
    "*.log",
    ".DS_Store",
]

# Watch-back configuration
[watch]
# Default interval in seconds
interval = 30
# Default paths to watch (if none specified)
default_paths = [".notion/"]

# Hooks for customization
[hooks]
# Run after VM provisioning, before marking golden as ready
post_provision = """
echo "Custom provisioning..."
"""

# Run after code sync to golden (during build/update)
post_sync = """
pnpm install
pnpm build
"""

# Run inside worker before Claude starts
pre_run = """
source ~/.nvm/nvm.sh
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"
"""
```

## Configuration Sections

### `project`

**Required.** The project name used for VM naming:

- Golden image: `{project}-golden`
- Workers: `{project}-worker-1`, `{project}-worker-2`, etc.

```toml
project = "mastra"
# Creates: mastra-golden, mastra-worker-1, etc.
```

### `[vm]`

Virtual machine resource configuration.

| Field    | Type   | Default        | Description                                     |
| -------- | ------ | -------------- | ----------------------------------------------- |
| `cpus`   | int    | 4              | Number of CPU cores                             |
| `memory` | string | "8GiB"         | RAM allocation                                  |
| `disk`   | string | "30GiB"        | Disk size                                       |
| `vmType` | string | "vz"           | VM backend: "vz" (faster, macOS only) or "qemu" |
| `image`  | string | "ubuntu-22.04" | Base OS image                                   |

### `[tools]`

Development tools to install. All are optional.

| Field    | Type     | Example           | Description               |
| -------- | -------- | ----------------- | ------------------------- |
| `nodejs` | string   | "22"              | Node.js version via nvm   |
| `python` | string   | "3.13"            | Python version via pyenv  |
| `rust`   | string   | "stable"          | Rust toolchain via rustup |
| `go`     | string   | "1.22"            | Go version                |
| `duckdb` | string   | "1.1.3"           | DuckDB CLI version        |
| `apt`    | []string | ["jq", "ripgrep"] | Additional apt packages   |

### `[claude]`

Claude Code configuration.

| Field     | Type   | Default  | Description                    |
| --------- | ------ | -------- | ------------------------------ |
| `install` | bool   | true     | Whether to install Claude Code |
| `version` | string | "latest" | Claude Code version            |

### `[sync.to]`

Configuration for syncing TO workers.

| Field           | Type     | Default | Description                     |
| --------------- | -------- | ------- | ------------------------------- |
| `default_paths` | []string | ["."]   | Paths to sync if none specified |
| `exclude`       | []string | [...]   | Patterns to exclude from sync   |

### `[sync.from]`

Configuration for syncing FROM workers back to repo.

| Field           | Type     | Default | Description                                   |
| --------------- | -------- | ------- | --------------------------------------------- |
| `default_paths` | []string | []      | Paths to sync if none specified (empty = all) |
| `exclude`       | []string | [...]   | Patterns to exclude from sync                 |

### `[watch]`

Watch-back configuration.

| Field           | Type     | Default | Description                      |
| --------------- | -------- | ------- | -------------------------------- |
| `interval`      | int      | 30      | Seconds between sync checks      |
| `default_paths` | []string | []      | Paths to watch if none specified |

### `[hooks]`

Shell scripts that run at various lifecycle points.

| Hook             | When it runs                    | Use case                     |
| ---------------- | ------------------------------- | ---------------------------- |
| `post_provision` | After VM OS setup, before tools | Custom apt packages, configs |
| `post_sync`      | After code syncs to golden      | Install deps, build project  |
| `pre_run`        | Before Claude starts in worker  | Set up environment           |

## Environment Variables

Configuration can be overridden via environment variables:

| Variable               | Overrides   |
| ---------------------- | ----------- |
| `LIMA_SANDBOX_PROJECT` | `project`   |
| `LIMA_SANDBOX_CPUS`    | `vm.cpus`   |
| `LIMA_SANDBOX_MEMORY`  | `vm.memory` |
| `LIMA_SANDBOX_DISK`    | `vm.disk`   |

## Config File Discovery

lima-sandbox searches for `.lima-sandbox.toml` in:

1. Current directory
2. Parent directories (up to git root or home)
3. `~/.config/lima-sandbox/config.toml` (global defaults)

## Minimal Configuration

The smallest valid config:

```toml
project = "my-project"
```

This uses all defaults: Ubuntu 22.04, 4 CPUs, 8GB RAM, 30GB disk, Node.js 22, Claude Code.
