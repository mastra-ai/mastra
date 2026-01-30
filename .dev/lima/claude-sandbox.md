# Lima Sandbox for Claude Code

This directory contains configuration and scripts for running Claude Code in isolated Lima VMs. This enables safe "YOLO mode" (`--dangerously-skip-permissions`) execution and parallel agent workflows.

## Why Use This

Claude runs with full autonomy inside a VM that:
- Has no access to your home directory
- Has no access to your host Docker socket
- Can be deleted and recreated at any time
- Supports parallel workers for multi-agent experiments

## Architecture

```
Base Template (claude-sandbox.yaml)
    └── Golden Image (mastra-golden)
            ├── Worker 1 (mastra-worker-1)
            ├── Worker 2 (mastra-worker-2)
            └── Worker N (mastra-worker-N)
```

- **Base Template**: Defines the VM configuration (Ubuntu 22.04 ARM64, 8 CPUs, 16GB RAM, 60GB disk)
- **Golden Image**: A fully provisioned VM with Node.js, pnpm, the built mastra repo, Claude Code, and container images
- **Workers**: Cloned from the golden image for parallel Claude agent execution

## Quick Start

```bash
cd .dev/lima

# Build the golden image (first time setup)
./lima-cluster.sh build

# Spawn workers
./lima-cluster.sh spawn 2          # Create 2 workers

# Run Claude on workers
./lima-cluster.sh run "implement feature X"
./lima-cluster.sh run-parallel "fix bug in packages/core"

# Shell into a worker
./lima-cluster.sh shell 1

# Cleanup
./lima-cluster.sh stop             # Stop all workers
./lima-cluster.sh teardown         # Delete workers (keep golden)
./lima-cluster.sh teardown --all   # Delete everything
```

## Commands Reference

| Command | Description |
|---------|-------------|
| `build` | Build the golden image from scratch |
| `update` | Update golden image (re-sync repo and rebuild) |
| `spawn <n>` | Create N worker VMs from golden image |
| `run <prompt>` | Run Claude on all workers (background) |
| `run-parallel <prompt>` | Run Claude with output capture to files |
| `sync [workers...]` | Sync repo to workers without rebuilding |
| `shell [n\|name]` | Shell into a worker (default: worker-1) |
| `list` | List all cluster VMs |
| `stop [workers...]` | Stop workers (preserves state) |
| `teardown [--all]` | Delete workers (--all includes golden) |

## What's Included in the Golden Image

- **OS**: Ubuntu 22.04 (Jammy) ARM64
- **Node.js**: v22.13.0 via nvm
- **pnpm**: Latest via standalone installer
- **corepack**: Latest (updated to fix keyid bug)
- **Claude Code**: Latest version
- **Mastra repo**: Full repo with dependencies installed and all packages built
- **Container images**: pgvector, qdrant, redis (for testing)
- **containerd/nerdctl**: For running containers

## Key Learnings & Fixes

### 1. Corepack Keyid Verification Bug

**Problem**: Corepack 0.30.0 (bundled with Node.js 22) has a keyid verification bug that causes failures when installing or running pnpm.

**Error**:
```
Error: Cannot find matching keyid: {"signatures":[...],"keys":[...]}
```

**Solution**: Update corepack to latest version and use standalone pnpm installer:
```bash
npm install -g corepack@latest
corepack enable
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

### 2. Lima Networking

**Problem**: `vzNAT` networking mode was extremely slow (~170 bytes/sec) for Ubuntu ARM mirrors.

**Solution**: Use default user-mode networking (remove `networks:` config entirely). Still not blazing fast for Ubuntu ARM mirrors, but more reliable.

### 3. Lima Probe Timeouts

**Problem**: `limactl start` times out waiting for probes during cloud-init provisioning.

**Solution**:
- Add `|| true` after `limactl start` to continue despite timeout
- Use `wait_for_cloud_init` function to poll cloud-init status separately
- Increase probe timeout to 300s

### 4. pnpm PATH Issues

**Problem**: pnpm installed via standalone installer is in `~/.local/share/pnpm`, not in nvm's bin directory.

**Solution**: Always set PNPM_HOME in scripts:
```bash
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"
```

### 5. macOS grep Compatibility

**Problem**: macOS grep doesn't support `-P` (Perl regex) flag.

**Solution**: Use `awk` instead:
```bash
# Instead of: grep -oP 'status: \K\w+'
awk '/^status:/ {print $2}'
```

### 6. zsh Glob Pattern Failures

**Problem**: When running bash scripts from zsh, glob patterns like `*.pid` fail with "no matches found" if no files match.

**Error**:
```
(eval):12: no matches found: /path/*.pid
```

**Solution**: Use `find` with `-delete` instead of `rm` with globs:
```bash
# Instead of: rm -f "$dir"/*.pid "$dir"/*.sock
find "$dir" -maxdepth 1 \( -name "*.pid" -o -name "*.sock" \) -delete 2>/dev/null || true
```

### 7. macOS tar Extended Attributes Warnings

**Problem**: When syncing files from macOS to Linux VMs, tar produces many warnings about unknown extended header keywords.

**Warning**:
```
tar: Ignoring unknown extended header keyword 'LIBARCHIVE.xattr.com.apple.provenance'
tar: Ignoring unknown extended header keyword 'LIBARCHIVE.xattr.com.apple.quarantine'
```

**Solution**: Suppress with `2>/dev/null` - the warnings are harmless and files sync correctly:
```bash
tar -C "$REPO_ROOT" --exclude=node_modules -cf - . 2>/dev/null | \
  limactl shell "$worker" -- bash -c 'cd ~/mastra && tar -xf -'
```

## VM Security Model

The Lima VMs are configured with security in mind for YOLO mode:

- **No home directory mounts** (`mounts: []`) - Host filesystem is not accessible
- **No port forwards** (`portForwards: []`) - No automatic host port exposure
- **Isolated networking** - VMs can access internet but not host network services
- **User-mode containerd** - Containers run without root privileges

## Manual VM Operations

```bash
# List all VMs
limactl list

# Start/stop a specific VM
limactl start mastra-worker-1
limactl stop mastra-worker-1

# Shell into VM
limactl shell mastra-worker-1

# Delete a VM
limactl delete --force mastra-worker-1

# Check cloud-init status inside VM
limactl shell mastra-golden -- sudo cloud-init status

# View cloud-init logs
limactl shell mastra-golden -- sudo tail -200 /var/log/cloud-init-output.log
```

## Running Commands in VMs

```bash
# Run a command with nvm and pnpm loaded
limactl shell mastra-worker-1 -- bash -c '
  source ~/.nvm/nvm.sh
  export PNPM_HOME="$HOME/.local/share/pnpm"
  export PATH="$PNPM_HOME:$PATH"
  cd ~/mastra
  pnpm test:core
'

# Run containers
limactl shell mastra-worker-1 -- nerdctl run -d --name postgres pgvector/pgvector:0.8.0-pg16
limactl shell mastra-worker-1 -- nerdctl ps
```

## Troubleshooting

### Build fails with corepack keyid error
```bash
# Inside the VM, update corepack:
limactl shell mastra-golden -- bash -c '
  source ~/.nvm/nvm.sh
  npm install -g corepack@latest
  corepack enable
'
```

### pnpm not found
```bash
# Check if pnpm is installed:
limactl shell mastra-worker-1 -- ls ~/.local/share/pnpm

# Reinstall if needed:
limactl shell mastra-worker-1 -- bash -c 'curl -fsSL https://get.pnpm.io/install.sh | sh -'
```

### VM won't start
```bash
# Check for leftover socket files
ls ~/.lima/mastra-golden/*.sock

# Force stop and restart
limactl stop --force mastra-golden
limactl start mastra-golden
```

### Slow provisioning
Ubuntu ARM mirror downloads can be slow. Check progress:
```bash
limactl shell mastra-golden -- sudo tail -f /var/log/cloud-init-output.log
```

### Container networking issues
```bash
# Restart containerd
limactl shell mastra-worker-1 -- systemctl --user restart containerd

# Check nerdctl works
limactl shell mastra-worker-1 -- nerdctl info
```

## File Structure

```
.dev/lima/
├── claude-sandbox.yaml   # Base VM template
├── lima-cluster.sh       # Cluster management script
├── claude-sandbox.md     # This documentation
└── outputs/              # Claude run outputs (created by run-parallel)
    └── YYYYMMDD-HHMMSS/
        ├── mastra-worker-1.log
        └── mastra-worker-2.log
```

## Performance Notes

- **Golden image build**: First build takes time (cloud-init provisioning, pnpm install, pnpm build)
- **Worker spawn**: Fast (~1 minute) - just copies disk and boots
- **Worker start**: Very fast (~10 seconds) - VM is already provisioned
- **Disk usage**: ~60GB per VM (golden + each worker)

## Future Improvements

- [ ] Pre-bake a base image with Ubuntu packages to skip slow ARM mirror downloads
- [ ] Add support for shared socket_vmnet for better networking performance
- [ ] Add log aggregation for parallel Claude runs
- [ ] Add health check endpoints for workers
