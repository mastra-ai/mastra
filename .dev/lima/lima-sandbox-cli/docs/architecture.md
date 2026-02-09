# Architecture

## Overview

lima-sandbox is built on [Lima](https://lima-vm.io), using its Go SDK for native VM management. The architecture centers around a layered VM approach for efficient iteration.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Host (macOS)                              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    lima-sandbox CLI                        │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │   │
│  │  │  Config  │ │   Lima   │ │   Sync   │ │   Watch     │  │   │
│  │  │  Parser  │ │   SDK    │ │  Manager │ │   Manager   │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └─────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                Lima (Virtualization)                       │   │
│  │  ┌─────────────────┐  ┌─────────────────────────────────┐ │   │
│  │  │  vz Driver      │  │  Instance Store (~/.lima/)       │ │   │
│  │  │  (Apple VF)     │  │  ├── project-golden/             │ │   │
│  │  └─────────────────┘  │  ├── project-worker-1/           │ │   │
│  │                       │  └── project-worker-2/           │ │   │
│  │                       └─────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ Golden Image  │    │   Worker 1    │    │   Worker 2    │
│ (Template)    │───▶│   (Clone)     │    │   (Clone)     │
│               │    │               │    │               │
│ - Ubuntu 22.04│    │ - Isolated    │    │ - Isolated    │
│ - Node.js     │    │ - Has code    │    │ - Has code    │
│ - Python      │    │ - Claude Code │    │ - Claude Code │
│ - Claude Code │    │               │    │               │
│ - Project code│    │               │    │               │
└───────────────┘    └───────────────┘    └───────────────┘
```

## VM Layer Architecture

### Golden Image

The golden image is a fully provisioned VM that serves as the template for workers:

1. **Base OS**: Ubuntu 22.04 (Jammy) ARM64/AMD64
2. **Cloud-init**: Handles initial OS setup
3. **Tool Installation**: Node.js, Python, Rust, etc.
4. **Claude Code**: Installed and ready
5. **Project Code**: Synced and built

The golden image is stopped after build. Workers are cloned from its disk image.

### Workers

Workers are lightweight clones of the golden image:

- **Fast creation**: Just copies disk image (~60 seconds)
- **Isolated**: No shared state between workers
- **Disposable**: Delete and recreate at any time
- **Independent**: Each can run different experiments

## Code Organization

```
lima-sandbox/
├── cmd/
│   └── lima-sandbox/
│       └── main.go              # Entry point
├── internal/
│   ├── config/
│   │   ├── config.go            # Config struct definitions
│   │   ├── parser.go            # TOML parsing
│   │   └── defaults.go          # Default values
│   ├── lima/
│   │   ├── client.go            # Lima SDK wrapper
│   │   ├── instance.go          # VM instance management
│   │   ├── yaml.go              # Lima YAML generation
│   │   └── ssh.go               # SSH helpers
│   ├── sync/
│   │   ├── rsync.go             # rsync operations
│   │   ├── watch.go             # File watching
│   │   └── exclude.go           # Exclusion patterns
│   ├── provision/
│   │   ├── cloudinit.go         # Cloud-init generation
│   │   ├── tools.go             # Tool installers
│   │   └── hooks.go             # Hook execution
│   └── commands/
│       ├── init.go
│       ├── build.go
│       ├── spawn.go
│       ├── sync.go
│       ├── syncback.go
│       ├── watchback.go
│       ├── run.go
│       ├── shell.go
│       ├── list.go
│       ├── status.go
│       ├── stop.go
│       ├── start.go
│       └── teardown.go
├── pkg/
│   └── version/
│       └── version.go           # Version info
├── templates/
│   ├── cloudinit/
│   │   └── base.yaml            # Cloud-init template
│   └── configs/
│       ├── nodejs.toml          # Node.js project template
│       ├── python.toml          # Python project template
│       └── full.toml            # Full stack template
├── go.mod
├── go.sum
├── Makefile
└── README.md
```

## Key Components

### Config Parser (`internal/config/`)

Handles `.lima-sandbox.toml` parsing and validation:

```go
type Config struct {
    Project string      `toml:"project"`
    VM      VMConfig    `toml:"vm"`
    Tools   ToolsConfig `toml:"tools"`
    Claude  ClaudeConfig `toml:"claude"`
    Sync    SyncConfig  `toml:"sync"`
    Watch   WatchConfig `toml:"watch"`
    Hooks   HooksConfig `toml:"hooks"`
}
```

### Lima Client (`internal/lima/`)

Wraps Lima's Go SDK for VM operations:

```go
type Client struct {
    store *store.Store
}

func (c *Client) CreateInstance(name string, yaml *limayaml.LimaYAML) error
func (c *Client) StartInstance(name string) error
func (c *Client) StopInstance(name string) error
func (c *Client) DeleteInstance(name string) error
func (c *Client) CloneInstance(src, dst string) error
func (c *Client) SSH(name string) (*ssh.Client, error)
```

### Sync Manager (`internal/sync/`)

Handles bidirectional sync using rsync:

```go
type SyncManager struct {
    config    *config.SyncConfig
    sshConfig string  // Lima SSH config
}

func (s *SyncManager) SyncTo(worker, path string, dryRun bool) error
func (s *SyncManager) SyncFrom(worker, path string, dryRun bool) error
func (s *SyncManager) Watch(worker string, paths []string, interval int) error
```

### Provision Manager (`internal/provision/`)

Generates cloud-init configs and manages tool installation:

```go
type Provisioner struct {
    config *config.Config
}

func (p *Provisioner) GenerateCloudInit() ([]byte, error)
func (p *Provisioner) InstallTools(ssh *ssh.Client) error
func (p *Provisioner) RunHook(ssh *ssh.Client, hook string) error
```

## Data Flow

### Build Flow

```
1. Parse .lima-sandbox.toml
2. Generate Lima YAML (vm resources, mounts, etc.)
3. Generate cloud-init (apt packages, user setup)
4. Create Lima instance (golden)
5. Wait for cloud-init completion
6. Install tools via SSH (nvm, pyenv, etc.)
7. Install Claude Code
8. Sync project code
9. Run post_sync hook
10. Stop instance
```

### Spawn Flow

```
1. Ensure golden exists and is stopped
2. For each worker:
   a. Clone golden disk image
   b. Create new Lima instance with cloned disk
   c. Start instance
   d. Record git state
```

### Sync Flow

```
1. Get Lima SSH config for worker
2. Build rsync options (excludes, etc.)
3. Execute rsync via SSH
4. Report results
```

## Security Model

Workers are isolated from the host:

| Aspect     | Configuration                                     |
| ---------- | ------------------------------------------------- |
| Filesystem | `mounts: []` - No host mounts                     |
| Ports      | `portForwards: []` - No port exposure             |
| Network    | User-mode - Can reach internet, not host services |
| Docker     | No Docker socket access                           |

This enables safe YOLO mode (`--dangerously-skip-permissions`) for Claude Code.

## Performance Considerations

### VM Creation

| Operation    | Time      | Notes                          |
| ------------ | --------- | ------------------------------ |
| Golden build | 10-15 min | One-time, includes apt updates |
| Worker clone | ~60 sec   | Disk copy + boot               |
| Worker start | ~10 sec   | Already provisioned            |

### Sync Performance

- Uses rsync with compression (`-z`)
- Incremental syncs (only changed files)
- SSH multiplexing for multiple operations

### Disk Usage

- Golden: ~15-30 GB (depending on tools)
- Each worker: ~15-30 GB (full clone)
- Total: Golden + (N × Worker size)

## Lima SDK Integration

Key Lima packages used:

```go
import (
    "github.com/lima-vm/lima/pkg/instance"
    "github.com/lima-vm/lima/pkg/limayaml"
    "github.com/lima-vm/lima/pkg/store"
    "github.com/lima-vm/lima/pkg/sshutil"
    "github.com/lima-vm/lima/pkg/driver/vz"
)
```

### Instance Management

```go
// Create instance
inst, err := instance.Create(ctx, name, limaYAML, store.WithName(name))

// Start instance
err := inst.Start(ctx)

// Get SSH config
sshConfig, err := sshutil.SSHConfig(inst)

// Stop instance
err := inst.Stop(ctx)
```

### YAML Generation

```go
yaml := &limayaml.LimaYAML{
    CPUs:   ptr(4),
    Memory: ptr("8GiB"),
    Disk:   ptr("30GiB"),
    VMType: ptr(limayaml.VZ),
    Mounts: []limayaml.Mount{},  // No mounts for isolation
    // ...
}
```

## Future Considerations

1. **Snapshot support**: Create snapshots of workers for quick restore
2. **Remote workers**: Support for workers on remote hosts
3. **Container support**: Run containers inside workers (containerd/nerdctl)
4. **Log aggregation**: Centralized logs from parallel Claude runs
5. **Web UI**: Dashboard for monitoring workers
