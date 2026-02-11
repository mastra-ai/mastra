# lima-sandbox

A Go CLI for managing isolated Lima VM sandboxes for AI agent workflows.

## Overview

`lima-sandbox` wraps [Lima](https://lima-vm.io) to provide a streamlined experience for running AI coding agents (like Claude Code) in isolated VMs. It uses a layered architecture (Golden Image → Workers) for fast iteration and supports parallel agent execution.

## Key Features

- **Config-driven**: Project settings in `.lima-sandbox.toml`
- **Layered VMs**: Golden image with cloned workers for fast spawning
- **Multi-language**: Configurable toolchains (Node.js, Python, Rust, Go, etc.)
- **Efficient sync**: rsync-based bidirectional sync with dry-run support
- **Watch mode**: Continuous sync-back for specific paths
- **Native Lima integration**: Uses Lima's Go SDK, not shell commands

## Installation

### First install Lima

```bash
mkdir -p ~/.local

VERSION=$(curl -L https://api.github.com/repos/lima-vm/lima/releases/latest | jq -r .tag_name)

curl -L --progress-bar \
  "https://github.com/lima-vm/lima/releases/download/${VERSION}/lima-${VERSION:1}-$(uname -s)-$(uname -m).tar.gz" \
  | tar -xzv -C ~/.local -f -

curl -L --progress-bar \
  "https://github.com/lima-vm/lima/releases/download/${VERSION}/lima-additional-guestagents-${VERSION:1}-$(uname -s)-$(uname -m).tar.gz" \
  | tar -xzv -C ~/.local -f -
```

### Ensure your PATH includes ~/.local/bin (zsh):

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Then install lima-sandbox

```bash
# Download binary from GitHub releases
curl -fsSL https://github.com/pinzurlytics/lima-sandbox/releases/latest/download/lima-sandbox-darwin-arm64.tar.gz | tar -xz
sudo mv lima-sandbox /usr/local/bin/

# Or from source
go install github.com/pinzurlytics/lima-sandbox@latest
```

## Quick Start

```bash
# Initialize a new project (creates .lima-sandbox.toml)
lima-sandbox init

# Build the golden image
lima-sandbox build

# Spawn workers
lima-sandbox spawn 2

# Sync code to workers
lima-sandbox sync

# Run Claude Code on workers
lima-sandbox run "implement feature X"

# Shell into a worker
lima-sandbox shell 1

# Watch and sync changes back
lima-sandbox watch-back 1 .notion/

# Sync specific paths back
lima-sandbox sync-back 1 output/

# Cleanup
lima-sandbox teardown
```

## Why This Tool?

Running AI agents with full autonomy requires isolation:

- **Security**: VMs have no access to host filesystem or Docker socket
- **Reproducibility**: Golden images ensure consistent environments
- **Parallelism**: Spawn multiple workers for concurrent experiments
- **Fast iteration**: rsync for efficient incremental syncs

## Architecture

```
.lima-sandbox.toml (project config)
    └── Golden Image (fully provisioned)
            ├── Worker 1 (cloned, isolated)
            ├── Worker 2 (cloned, isolated)
            └── Worker N (cloned, isolated)
```

## Requirements

- macOS with Apple Silicon (ARM64) or Intel
- [Lima](https://lima-vm.io) installed (`brew install lima`)
- ~30-60GB disk per VM

## Documentation

- [Configuration Reference](docs/configuration.md)
- [Command Reference](docs/commands.md)
- [Architecture](docs/architecture.md)
- [Contributing](CONTRIBUTING.md)

## License

Apache 2.0
