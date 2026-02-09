# Command Reference

## Global Flags

Available on all commands:

| Flag        | Short | Description                                         |
| ----------- | ----- | --------------------------------------------------- |
| `--config`  | `-c`  | Path to config file (default: `.lima-sandbox.toml`) |
| `--project` | `-p`  | Override project name from config                   |
| `--verbose` | `-v`  | Verbose output                                      |
| `--quiet`   | `-q`  | Minimal output                                      |
| `--help`    | `-h`  | Show help                                           |

## Commands

### `init`

Initialize a new lima-sandbox project.

```bash
lima-sandbox init [flags]
```

**Flags:**
| Flag | Description |
|------|-------------|
| `--template` | Use a preset template: `nodejs`, `python`, `rust`, `full` |
| `--force` | Overwrite existing config file |

**Examples:**

```bash
# Interactive initialization
lima-sandbox init

# Use Node.js template
lima-sandbox init --template nodejs

# Use full template (all languages)
lima-sandbox init --template full
```

---

### `build`

Build the golden image from scratch.

```bash
lima-sandbox build [flags]
```

**Flags:**
| Flag | Description |
|------|-------------|
| `--no-cache` | Force fresh build, ignore existing golden |
| `--skip-sync` | Build VM but don't sync project code |

**What it does:**

1. Creates a new Lima VM from base image
2. Runs cloud-init provisioning (apt updates, etc.)
3. Installs configured tools (Node.js, Python, etc.)
4. Installs Claude Code
5. Syncs project code to VM
6. Runs `post_sync` hook
7. Stops VM (ready for cloning)

**Examples:**

```bash
# Standard build
lima-sandbox build

# Force rebuild
lima-sandbox build --no-cache
```

---

### `update`

Update the golden image (re-sync code and rebuild).

```bash
lima-sandbox update [flags]
```

**Flags:**
| Flag | Description |
|------|-------------|
| `--sync-only` | Only sync code, don't run hooks |

**What it does:**

1. Starts golden VM
2. Syncs latest code
3. Runs `post_sync` hook
4. Stops VM

---

### `spawn`

Create worker VMs by cloning the golden image.

```bash
lima-sandbox spawn <count> [flags]
```

**Arguments:**
| Arg | Description |
|-----|-------------|
| `count` | Number of workers to create |

**Flags:**
| Flag | Description |
|------|-------------|
| `--start` | Start workers after creating (default: true) |
| `--parallel` | Clone in parallel (faster but more disk I/O) |

**Examples:**

```bash
# Create 2 workers
lima-sandbox spawn 2

# Create 4 workers, clone in parallel
lima-sandbox spawn 4 --parallel
```

---

### `sync`

Sync code TO workers (repo → VM).

```bash
lima-sandbox sync [workers...] [paths...] [flags]
```

**Arguments:**
| Arg | Description |
|-----|-------------|
| `workers` | Worker numbers or names (default: all) |
| `paths` | Paths to sync (default: from config or entire repo) |

**Flags:**
| Flag | Short | Description |
|------|-------|-------------|
| `--dry-run` | `-n` | Preview what would sync |
| `--delete` | | Delete files on destination not in source |

**Examples:**

```bash
# Sync to all workers (default paths from config)
lima-sandbox sync

# Preview sync
lima-sandbox sync --dry-run

# Sync to worker 1 only
lima-sandbox sync 1

# Sync specific path to worker 1
lima-sandbox sync 1 packages/core/

# Sync multiple paths to multiple workers
lima-sandbox sync 1 2 packages/core/ packages/cli/
```

---

### `sync-back`

Sync code FROM a worker back to repo (VM → repo).

```bash
lima-sandbox sync-back <worker> [paths...] [flags]
```

**Arguments:**
| Arg | Description |
|-----|-------------|
| `worker` | Worker number or name (required) |
| `paths` | Paths to sync (default: entire repo) |

**Flags:**
| Flag | Short | Description |
|------|-------|-------------|
| `--dry-run` | `-n` | Preview what would sync |
| `--delete` | | Delete local files not on worker |

**Examples:**

```bash
# Preview what would sync from worker 1
lima-sandbox sync-back --dry-run 1

# Sync everything from worker 1
lima-sandbox sync-back 1

# Sync specific path
lima-sandbox sync-back 1 .notion/

# Sync multiple paths
lima-sandbox sync-back 1 output/ docs/
```

---

### `watch-back`

Continuously watch and sync changes from a worker.

```bash
lima-sandbox watch-back <worker> [paths...] [flags]
```

**Arguments:**
| Arg | Description |
|-----|-------------|
| `worker` | Worker number or name (required) |
| `paths` | Paths to watch (default: from config) |

**Flags:**
| Flag | Short | Description |
|------|-------|-------------|
| `--interval` | `-i` | Sync interval in seconds (default: 30) |
| `--quiet` | `-q` | Only show output when files change |

**Examples:**

```bash
# Watch .notion/ on worker 2 (default 30s interval)
lima-sandbox watch-back 2 .notion/

# Faster interval
lima-sandbox watch-back 2 .notion/ -i 10

# Watch multiple paths, quiet mode
lima-sandbox watch-back 2 .notion/ docs/ -q
```

**Output:**

```
Watching 'my-project-worker-2' for changes to: .notion/
Sync interval: 30s (Ctrl+C to stop)

[16:45:00] .notion/docs/api.md
[16:45:00] Synced 1 file(s)
[16:45:30] No changes...
[16:46:00] .notion/docs/guide.md
[16:46:00] .notion/docs/faq.md
[16:46:00] Synced 2 file(s)
```

---

### `run`

Run Claude Code on workers.

```bash
lima-sandbox run <prompt> [flags]
```

**Arguments:**
| Arg | Description |
|-----|-------------|
| `prompt` | The prompt/task for Claude |

**Flags:**
| Flag | Description |
|------|-------------|
| `--workers` | Which workers to run on (default: all) |
| `--yolo` | Run with `--dangerously-skip-permissions` |
| `--output` | Directory for output logs |
| `--parallel` | Run on all workers simultaneously |

**Examples:**

```bash
# Run on all workers
lima-sandbox run "implement feature X"

# Run with YOLO mode
lima-sandbox run --yolo "fix all linting errors"

# Run only on workers 1 and 2
lima-sandbox run --workers 1,2 "add unit tests"
```

---

### `shell`

Open an interactive shell in a worker.

```bash
lima-sandbox shell [worker] [flags]
```

**Arguments:**
| Arg | Description |
|-----|-------------|
| `worker` | Worker number or name (default: 1) |

**Flags:**
| Flag | Description |
|------|-------------|
| `--command` | Run a command instead of interactive shell |

**Examples:**

```bash
# Shell into worker 1
lima-sandbox shell

# Shell into worker 3
lima-sandbox shell 3

# Run a command
lima-sandbox shell 1 --command "cd ~/project && pnpm test"
```

---

### `list`

List all VMs in the cluster.

```bash
lima-sandbox list [flags]
```

**Flags:**
| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |
| `--all` | Include stopped VMs |

**Output:**

```
NAME                STATUS    CPUS  MEMORY  DISK
my-project-golden   Stopped   4     8GiB    30GiB
my-project-worker-1 Running   4     8GiB    30GiB
my-project-worker-2 Running   4     8GiB    30GiB
```

---

### `status`

Show detailed status of workers including git state.

```bash
lima-sandbox status [workers...] [flags]
```

**Flags:**
| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |

**Output:**

```
WORKER              STATUS   BRANCH  COMMIT    DIRTY
my-project-worker-1 Running  main    a1b2c3d   Yes
my-project-worker-2 Running  main    a1b2c3d   No
```

---

### `stop`

Stop running workers.

```bash
lima-sandbox stop [workers...] [flags]
```

**Arguments:**
| Arg | Description |
|-----|-------------|
| `workers` | Workers to stop (default: all) |

**Examples:**

```bash
# Stop all workers
lima-sandbox stop

# Stop specific workers
lima-sandbox stop 1 2
```

---

### `start`

Start stopped workers.

```bash
lima-sandbox start [workers...] [flags]
```

**Arguments:**
| Arg | Description |
|-----|-------------|
| `workers` | Workers to start (default: all) |

---

### `teardown`

Delete workers and optionally the golden image.

```bash
lima-sandbox teardown [flags]
```

**Flags:**
| Flag | Description |
|------|-------------|
| `--all` | Also delete the golden image |
| `--force` | Skip confirmation prompt |

**Examples:**

```bash
# Delete workers only
lima-sandbox teardown

# Delete everything
lima-sandbox teardown --all

# Skip confirmation
lima-sandbox teardown --all --force
```

---

### `version`

Show version information.

```bash
lima-sandbox version
```

**Output:**

```
lima-sandbox v0.1.0
lima v1.0.0 (API)
go1.22.0
```
