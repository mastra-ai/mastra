#!/bin/bash
# lima-cluster.sh - Manage a cluster of Lima VMs for parallel Claude Code agents
#
# Layered approach:
#   Base (claude-sandbox.yaml) -> Golden (repo + deps + build + claude-code) -> Workers (parallel agents)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BASE_TEMPLATE="$SCRIPT_DIR/claude-sandbox.yaml"
GOLDEN_NAME="mastra-golden"
WORKER_PREFIX="mastra-worker"
LIMA_HOME="${LIMA_HOME:-$HOME/.lima}"

# Container images to pre-pull for testing
CONTAINER_IMAGES=(
  "pgvector/pgvector:0.8.0-pg16"
  "qdrant/qdrant:latest"
  "redis:latest"
)

log() {
  echo "[lima-cluster] $*" >&2
}

error() {
  echo "[lima-cluster] ERROR: $*" >&2
  exit 1
}

# Run a command inside a Lima VM with nvm and pnpm loaded
lima_exec() {
  local vm_name="$1"
  shift
  limactl shell "$vm_name" -- bash -c "source ~/.nvm/nvm.sh && export PNPM_HOME=\"\$HOME/.local/share/pnpm\" && export PATH=\"\$PNPM_HOME:\$PATH\" && $*"
}

# Check if a VM exists
vm_exists() {
  limactl list --json 2>/dev/null | grep -q "\"name\":\"$1\""
}

# Check if a VM is running
vm_running() {
  limactl list --json 2>/dev/null | grep -A5 "\"name\":\"$1\"" | grep -q '"status":"Running"'
}

# Wait for cloud-init to complete
wait_for_cloud_init() {
  local vm_name="$1"
  local timeout="${2:-1800}"  # 30 min default
  local elapsed=0

  log "Waiting for cloud-init to complete (timeout: ${timeout}s)..."
  while [ $elapsed -lt $timeout ]; do
    local status
    status=$(limactl shell "$vm_name" -- sudo cloud-init status 2>/dev/null | awk '/^status:/ {print $2}' || echo "unknown")

    if [ "$status" = "done" ]; then
      log "Cloud-init completed!"
      return 0
    elif [ "$status" = "error" ]; then
      log "Cloud-init failed!"
      return 1
    fi

    log "  Cloud-init status: $status (${elapsed}s elapsed)..."
    sleep 30
    elapsed=$((elapsed + 30))
  done

  log "Cloud-init timeout after ${timeout}s"
  return 1
}

# Build the golden image from base
cmd_build() {
  local skip_base="${1:-}"

  log "Building golden image..."

  # Step 1: Create base VM if needed
  if ! vm_exists "$GOLDEN_NAME"; then
    log "Creating base VM '$GOLDEN_NAME' from template..."
    # Start VM - may timeout on probes but VM will continue booting
    limactl start --name="$GOLDEN_NAME" "$BASE_TEMPLATE" || true
  elif ! vm_running "$GOLDEN_NAME"; then
    log "Starting existing VM '$GOLDEN_NAME'..."
    limactl start "$GOLDEN_NAME" || true
  else
    log "VM '$GOLDEN_NAME' is already running"
  fi

  # Check VM is actually running
  if ! vm_running "$GOLDEN_NAME"; then
    error "VM '$GOLDEN_NAME' failed to start"
  fi

  # Wait for cloud-init to complete (base provisioning)
  wait_for_cloud_init "$GOLDEN_NAME" 1800

  # Step 2: Sync the repo
  log "Syncing repository to VM..."
  local vm_home
  vm_home=$(limactl shell "$GOLDEN_NAME" -- bash -c 'echo $HOME')

  # Use rsync via limactl shell (Lima mounts aren't enabled in our secure config)
  # We'll tar and pipe instead for efficiency
  log "Copying repo (this may take a moment)..."
  tar -C "$REPO_ROOT" --exclude=node_modules --exclude=.git --exclude=dist --exclude='*.log' -cf - . | \
    limactl shell "$GOLDEN_NAME" -- bash -c "mkdir -p ~/mastra && cd ~/mastra && tar -xf -"

  # Step 3: Install dependencies and build
  log "Installing dependencies..."
  lima_exec "$GOLDEN_NAME" "cd ~/mastra && pnpm install"

  log "Building packages..."
  lima_exec "$GOLDEN_NAME" "cd ~/mastra && NODE_OPTIONS='--max-old-space-size=4096' pnpm build"

  # Step 4: Install Claude Code
  log "Installing Claude Code..."
  lima_exec "$GOLDEN_NAME" "npm install -g @anthropic-ai/claude-code"

  # Step 5: Pre-pull container images for testing
  log "Pre-pulling container images for testing..."
  for image in "${CONTAINER_IMAGES[@]}"; do
    log "  Pulling $image..."
    limactl shell "$GOLDEN_NAME" -- nerdctl pull "$image" || log "  Warning: Failed to pull $image"
  done

  # Step 6: Stop the golden VM to preserve state
  log "Stopping golden VM to preserve state..."
  limactl stop "$GOLDEN_NAME"

  log "Golden image '$GOLDEN_NAME' is ready!"
  log "Disk location: $LIMA_HOME/$GOLDEN_NAME"
}

# Update the golden image (re-sync repo and rebuild)
cmd_update() {
  log "Updating golden image..."

  if ! vm_exists "$GOLDEN_NAME"; then
    error "Golden image '$GOLDEN_NAME' does not exist. Run 'build' first."
  fi

  if ! vm_running "$GOLDEN_NAME"; then
    log "Starting golden VM..."
    limactl start "$GOLDEN_NAME"
  fi

  # Sync repo
  log "Syncing repository..."
  tar -C "$REPO_ROOT" --exclude=node_modules --exclude=.git --exclude=dist --exclude='*.log' -cf - . | \
    limactl shell "$GOLDEN_NAME" -- bash -c "cd ~/mastra && tar -xf -"

  # Reinstall and rebuild
  log "Installing dependencies..."
  lima_exec "$GOLDEN_NAME" "cd ~/mastra && pnpm install"

  log "Building packages..."
  lima_exec "$GOLDEN_NAME" "cd ~/mastra && NODE_OPTIONS='--max-old-space-size=4096' pnpm build"

  # Update Claude Code
  log "Updating Claude Code..."
  lima_exec "$GOLDEN_NAME" "npm install -g @anthropic-ai/claude-code"

  # Stop to preserve state
  log "Stopping golden VM..."
  limactl stop "$GOLDEN_NAME"

  log "Golden image updated!"
}

# Spawn worker VMs from the golden image
cmd_spawn() {
  local count="${1:-1}"

  if ! vm_exists "$GOLDEN_NAME"; then
    error "Golden image '$GOLDEN_NAME' does not exist. Run 'build' first."
  fi

  if vm_running "$GOLDEN_NAME"; then
    log "Stopping golden VM before cloning..."
    limactl stop "$GOLDEN_NAME"
  fi

  log "Spawning $count worker(s) from golden image..."

  for i in $(seq 1 "$count"); do
    local worker_name="${WORKER_PREFIX}-${i}"

    if vm_exists "$worker_name"; then
      log "Worker '$worker_name' already exists, skipping..."
      continue
    fi

    log "Creating worker '$worker_name'..."

    # Copy the golden VM directory (ignore socket warnings)
    cp -r "$LIMA_HOME/$GOLDEN_NAME" "$LIMA_HOME/$worker_name" 2>/dev/null || \
      cp -r "$LIMA_HOME/$GOLDEN_NAME" "$LIMA_HOME/$worker_name"

    # Remove instance-specific state files using find (avoids glob issues in zsh)
    find "$LIMA_HOME/$worker_name" -maxdepth 1 \( \
      -name "*.pid" -o \
      -name "*.sock" -o \
      -name "serial*.log" -o \
      -name "ha.*" -o \
      -name "ssh.*" -o \
      -name "ga.sock" -o \
      -name "cidata.iso" \
    \) -delete 2>/dev/null || true

    # Start the worker
    log "Starting worker '$worker_name'..."
    limactl start "$worker_name" &
  done

  # Wait for all workers to start
  wait

  log "All workers spawned!"
  cmd_list
}

# Run a Claude command on all workers (or specific ones)
cmd_run() {
  local prompt="$1"
  shift
  local workers=("$@")

  # If no workers specified, run on all
  if [[ ${#workers[@]} -eq 0 ]]; then
    workers=($(limactl list --json 2>/dev/null | grep -o "\"name\":\"${WORKER_PREFIX}-[0-9]*\"" | cut -d'"' -f4))
  fi

  if [[ ${#workers[@]} -eq 0 ]]; then
    error "No workers found. Run 'spawn N' first."
  fi

  log "Running Claude on ${#workers[@]} worker(s)..."

  for worker in "${workers[@]}"; do
    if ! vm_running "$worker"; then
      log "Starting worker '$worker'..."
      limactl start "$worker"
    fi

    log "Launching Claude on '$worker'..."
    limactl shell "$worker" -- bash -c "
      source ~/.nvm/nvm.sh
      export PNPM_HOME=\"\$HOME/.local/share/pnpm\"
      export PATH=\"\$PNPM_HOME:\$PATH\"
      cd ~/mastra
      claude --dangerously-skip-permissions \"$prompt\"
    " &
  done

  log "Claude agents launched on all workers!"
  log "Use 'lima-cluster.sh logs <worker>' to view output"
}

# Run a Claude command on workers in parallel with output capture
cmd_run_parallel() {
  local prompt="$1"
  shift
  local workers=("$@")

  # If no workers specified, run on all
  if [[ ${#workers[@]} -eq 0 ]]; then
    workers=($(limactl list --json 2>/dev/null | grep -o "\"name\":\"${WORKER_PREFIX}-[0-9]*\"" | cut -d'"' -f4))
  fi

  if [[ ${#workers[@]} -eq 0 ]]; then
    error "No workers found. Run 'spawn N' first."
  fi

  local output_dir="$REPO_ROOT/.dev/lima/outputs/$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$output_dir"

  log "Running Claude on ${#workers[@]} worker(s) in parallel..."
  log "Output directory: $output_dir"

  for worker in "${workers[@]}"; do
    if ! vm_running "$worker"; then
      log "Starting worker '$worker'..."
      limactl start "$worker"
    fi

    log "Launching Claude on '$worker'..."
    (
      limactl shell "$worker" -- bash -c "
        source ~/.nvm/nvm.sh
        export PNPM_HOME=\"\$HOME/.local/share/pnpm\"
        export PATH=\"\$PNPM_HOME:\$PATH\"
        cd ~/mastra
        claude --dangerously-skip-permissions \"$prompt\"
      " > "$output_dir/$worker.log" 2>&1
      log "Worker '$worker' completed. Output: $output_dir/$worker.log"
    ) &
  done

  wait
  log "All Claude agents completed!"
  log "Outputs saved to: $output_dir"
}

# Sync repo to workers without rebuilding (for quick iterations)
cmd_sync() {
  local workers=("$@")

  # If no workers specified, sync to all
  if [[ ${#workers[@]} -eq 0 ]]; then
    workers=($(limactl list --json 2>/dev/null | grep -o "\"name\":\"${WORKER_PREFIX}-[0-9]*\"" | cut -d'"' -f4))
  fi

  if [[ ${#workers[@]} -eq 0 ]]; then
    error "No workers found. Run 'spawn N' first."
  fi

  log "Syncing repo to ${#workers[@]} worker(s)..."

  for worker in "${workers[@]}"; do
    if ! vm_exists "$worker"; then
      log "Worker '$worker' does not exist, skipping..."
      continue
    fi

    if ! vm_running "$worker"; then
      log "Starting worker '$worker'..."
      limactl start "$worker"
    fi

    log "Syncing to '$worker'..."
    # Use tar with exclusions, suppress macOS xattr warnings
    # Run in background for parallel sync
    (
      tar -C "$REPO_ROOT" --exclude=node_modules --exclude=.git --exclude=dist --exclude='*.log' -cf - . 2>/dev/null | \
        limactl shell "$worker" -- bash -c 'cd ~/mastra && tar -xf -' 2>/dev/null
      log "  Synced to '$worker'"
    ) &
  done

  wait
  log "Sync complete!"
}

# Shell into a worker
cmd_shell() {
  local worker="${1:-${WORKER_PREFIX}-1}"

  # Allow shorthand: "1" -> "mastra-worker-1"
  if [[ "$worker" =~ ^[0-9]+$ ]]; then
    worker="${WORKER_PREFIX}-${worker}"
  fi

  if ! vm_exists "$worker"; then
    error "Worker '$worker' does not exist."
  fi

  if ! vm_running "$worker"; then
    log "Starting worker '$worker'..."
    limactl start "$worker"
  fi

  log "Connecting to '$worker'..."
  limactl shell "$worker"
}

# List all VMs in the cluster
cmd_list() {
  log "Cluster VMs:"
  echo ""
  limactl list 2>/dev/null | grep -E "(NAME|$GOLDEN_NAME|$WORKER_PREFIX)" || echo "No cluster VMs found"
  echo ""
}

# Stop all workers (but not golden)
cmd_stop() {
  local workers=("$@")

  # If no workers specified, stop all
  if [[ ${#workers[@]} -eq 0 ]]; then
    workers=($(limactl list --json 2>/dev/null | grep -o "\"name\":\"${WORKER_PREFIX}-[0-9]*\"" | cut -d'"' -f4))
  fi

  log "Stopping ${#workers[@]} worker(s)..."

  for worker in "${workers[@]}"; do
    if vm_running "$worker"; then
      log "Stopping '$worker'..."
      limactl stop "$worker" &
    fi
  done

  wait
  log "All workers stopped."
}

# Teardown - delete all workers (but preserve golden)
cmd_teardown() {
  local include_golden="${1:-}"

  log "Tearing down workers..."

  # Get all workers
  local workers
  workers=($(limactl list --json 2>/dev/null | grep -o "\"name\":\"${WORKER_PREFIX}-[0-9]*\"" | cut -d'"' -f4)) || true

  for worker in "${workers[@]}"; do
    log "Deleting '$worker'..."
    limactl delete --force "$worker" || true
  done

  if [[ "$include_golden" == "--all" ]]; then
    log "Deleting golden image..."
    limactl delete --force "$GOLDEN_NAME" || true
  fi

  log "Teardown complete."
}

# Print help
cmd_help() {
  cat <<EOF
lima-cluster.sh - Manage a cluster of Lima VMs for parallel Claude Code agents

USAGE:
    $0 <command> [args...]

COMMANDS:
    build               Build the golden image (base + repo + deps + claude-code)
    update              Update golden image (re-sync repo and rebuild)
    spawn <n>           Spawn N worker VMs from the golden image

    run <prompt>        Run Claude on all workers (background, interactive)
    run-parallel <prompt>  Run Claude on all workers with output capture
    sync [workers...]   Sync repo to workers without rebuilding

    shell [n|name]      Shell into a worker (default: worker-1)
    list                List all cluster VMs
    stop [workers...]   Stop workers (preserves state)
    teardown [--all]    Delete all workers (--all includes golden)

    help                Show this help message

EXAMPLES:
    # Initial setup
    $0 build                    # Create golden image (~10-15 min)
    $0 spawn 4                  # Create 4 worker VMs (~1 min each)

    # Run parallel experiments
    $0 run "implement feature X using approach A"
    $0 run-parallel "fix the bug in packages/core/src/agent"

    # Quick iteration
    $0 sync                     # Sync code changes to all workers
    $0 shell 1                  # Connect to worker 1

    # Cleanup
    $0 stop                     # Stop all workers
    $0 teardown                 # Delete workers, keep golden
    $0 teardown --all           # Delete everything

LAYER ARCHITECTURE:
    Base (claude-sandbox.yaml)
      └─> Golden ($GOLDEN_NAME)
            ├─> $WORKER_PREFIX-1
            ├─> $WORKER_PREFIX-2
            └─> ...

EOF
}

# Main dispatch
main() {
  local cmd="${1:-help}"
  shift || true

  case "$cmd" in
    build)      cmd_build "$@" ;;
    update)     cmd_update "$@" ;;
    spawn)      cmd_spawn "$@" ;;
    run)        cmd_run "$@" ;;
    run-parallel) cmd_run_parallel "$@" ;;
    sync)       cmd_sync "$@" ;;
    shell)      cmd_shell "$@" ;;
    list)       cmd_list "$@" ;;
    stop)       cmd_stop "$@" ;;
    teardown)   cmd_teardown "$@" ;;
    help|--help|-h) cmd_help ;;
    *)          error "Unknown command: $cmd. Run '$0 help' for usage." ;;
  esac
}

main "$@"
