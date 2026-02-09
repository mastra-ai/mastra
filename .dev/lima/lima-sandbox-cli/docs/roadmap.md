# Implementation Roadmap

## Phase 1: Foundation (MVP)

### 1.1 Project Setup

- [ ] Initialize Go module
- [ ] Set up project structure (cmd/, internal/, pkg/)
- [ ] Add cobra for CLI framework
- [ ] Add TOML parser (pelletier/go-toml)
- [ ] Set up Makefile and build process
- [ ] Add golangci-lint configuration

### 1.2 Configuration

- [ ] Define config structs (`internal/config/config.go`)
- [ ] Implement TOML parsing with defaults
- [ ] Config file discovery (walk up to git root)
- [ ] Environment variable overrides
- [ ] Config validation

### 1.3 Lima SDK Integration

- [ ] Create Lima client wrapper (`internal/lima/client.go`)
- [ ] Implement instance creation (generate Lima YAML)
- [ ] Implement start/stop/delete operations
- [ ] SSH config extraction
- [ ] VM status checking

### 1.4 Basic Commands

- [ ] `init` - Create config file (with templates)
- [ ] `list` - List VMs
- [ ] `shell` - SSH into VM
- [ ] `version` - Show version info
- [ ] `help` - Help system

**Milestone**: Can create config and list Lima VMs

---

## Phase 2: Core Workflow

### 2.1 Build Command

- [ ] Generate cloud-init config
- [ ] Create golden VM
- [ ] Wait for cloud-init completion
- [ ] Tool installation (Node.js, Python, Rust, etc.)
- [ ] Claude Code installation
- [ ] Post-provision hooks
- [ ] Progress reporting

### 2.2 Sync Commands

- [ ] rsync wrapper (`internal/sync/rsync.go`)
- [ ] SSH config management
- [ ] `sync` command (repo → VM)
- [ ] `sync-back` command (VM → repo)
- [ ] Dry-run support
- [ ] Path filtering
- [ ] Exclusion patterns from config

### 2.3 Spawn Command

- [ ] Clone golden disk image
- [ ] Create worker VMs
- [ ] Start workers
- [ ] Git state tracking

### 2.4 Lifecycle Commands

- [ ] `stop` - Stop workers
- [ ] `start` - Start workers
- [ ] `teardown` - Delete workers/golden
- [ ] `status` - Show worker status with git info
- [ ] `update` - Update golden image

**Milestone**: Full build → spawn → sync → shell workflow

---

## Phase 3: Claude Integration

### 3.1 Run Command

- [ ] `run` - Execute Claude in workers
- [ ] YOLO mode support
- [ ] Output capture
- [ ] Parallel execution
- [ ] Worker selection

### 3.2 Watch Command

- [ ] `watch-back` - Continuous sync
- [ ] Configurable interval
- [ ] Change detection (rsync itemize)
- [ ] Quiet mode
- [ ] Graceful shutdown

**Milestone**: Can run Claude agents in parallel, sync results back

---

## Phase 4: Polish

### 4.1 User Experience

- [ ] Colored output (fatih/color)
- [ ] Progress bars for long operations
- [ ] Spinner for waiting operations
- [ ] Better error messages
- [ ] Confirmation prompts for destructive ops

### 4.2 Reliability

- [ ] Signal handling (Ctrl+C cleanup)
- [ ] Temp file cleanup
- [ ] Partial failure handling
- [ ] Retry logic for transient failures
- [ ] Timeout handling

### 4.3 Testing

- [ ] Unit tests for config parsing
- [ ] Unit tests for YAML generation
- [ ] Integration tests (with real Lima)
- [ ] CI setup (GitHub Actions)

### 4.4 Documentation

- [ ] Man page generation
- [ ] Shell completions (bash, zsh, fish)
- [ ] Example configs in repo

**Milestone**: Production-ready CLI

---

## Phase 5: Distribution

### 5.1 Release Process

- [ ] GoReleaser configuration
- [ ] Multi-platform builds (darwin-arm64, darwin-amd64, linux-arm64, linux-amd64)
- [ ] Checksum generation
- [ ] GitHub Releases automation

### 5.2 Installation

- [ ] Install script (curl | sh)
- [ ] Version upgrade checking

**Milestone**: Easy installation via GitHub releases

---

## Future Enhancements

### VM Features

- [ ] Snapshot support (save/restore worker state)
- [ ] Shared disk volumes between workers
- [ ] GPU passthrough (for ML workloads)
- [ ] Custom base images

### Sync Features

- [ ] Incremental sync with checksums
- [ ] Bidirectional sync (conflict detection)
- [ ] Real-time sync (fsnotify-based)
- [ ] Compression options

### Multi-host

- [ ] Remote Lima hosts (SSH tunnel)
- [ ] Kubernetes-based workers
- [ ] Cloud VM workers (EC2, GCE)

### Monitoring

- [ ] Web dashboard
- [ ] Log aggregation
- [ ] Resource monitoring (CPU, memory, disk)
- [ ] Notifications (Slack, webhooks)

### AI Features

- [ ] Multiple AI backend support (not just Claude)
- [ ] Prompt templates
- [ ] Result comparison across workers
- [ ] Automated iteration (re-run on failure)

---

## Implementation Priority

Recommended order:

1. Project setup, config parsing, basic Lima integration
2. `init`, `list`, `shell` commands
3. `build` command (most complex)
4. `spawn`, `sync`, `sync-back`
5. `run`, `watch-back`
6. Polish, testing, GitHub releases

**Note**: Implementation will be done by Claude. Expect MVP in ~20-30 minutes of agent time, not 6 weeks of human time.
