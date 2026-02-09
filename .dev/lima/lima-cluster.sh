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
SYNC_EXCLUDES="$SCRIPT_DIR/sync-excludes.txt"

# Read shared exclude patterns (strips comments and blanks), one per line
_exclude_patterns() {
  while IFS= read -r line; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// }" ]] && continue
    echo "$line"
  done < "$SYNC_EXCLUDES"
}

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

# Check if a VM exists (use variable to avoid SIGPIPE with pipefail)
vm_exists() {
  local json
  json=$(limactl list --json 2>/dev/null) || true
  echo "$json" | grep -q "\"name\":\"$1\""
}

# Check if a VM is running (use variable to avoid SIGPIPE with pipefail)
vm_running() {
  local json
  json=$(limactl list --json 2>/dev/null) || true
  echo "$json" | grep "\"name\":\"$1\"" | grep -q '"status":"Running"'
}

# Get SSH config for Lima VM (for rsync)
get_lima_ssh_config() {
  local vm_name="$1"
  limactl show-ssh --format=config "$vm_name" 2>/dev/null
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

  # Record the git commit for traceability
  local git_commit git_branch
  git_commit=$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo "unknown")
  git_branch=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
  log "Recording git state: $git_branch @ ${git_commit:0:8}"

  # Use rsync via limactl shell (Lima mounts aren't enabled in our secure config)
  # We'll tar and pipe instead for efficiency
  log "Copying repo (this may take a moment)..."
  local -a tar_excludes=()
  while IFS= read -r pat; do tar_excludes+=("--exclude=${pat%/}"); done < <(_exclude_patterns)
  tar -C "$REPO_ROOT" "${tar_excludes[@]}" -cf - . 2>/dev/null | \
    limactl shell "$GOLDEN_NAME" -- bash -c "mkdir -p ~/mastra && cd ~/mastra && tar -xf -"

  # Save git metadata to the VM for future reference
  limactl shell "$GOLDEN_NAME" -- bash -c "cat > ~/mastra/.git-state << EOF
commit=$git_commit
branch=$git_branch
synced_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF"
  log "Git state saved to ~/mastra/.git-state"

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
  local -a tar_excludes=()
  while IFS= read -r pat; do tar_excludes+=("--exclude=${pat%/}"); done < <(_exclude_patterns)
  tar -C "$REPO_ROOT" "${tar_excludes[@]}" -cf - . | \
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
# Supports --dry-run flag and optional path filtering
# Usage: sync [--dry-run] [worker...] [path...]
cmd_sync() {
  local dry_run=false
  local workers=()
  local paths=()

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run|-n)
        dry_run=true
        shift
        ;;
      *)
        # Distinguish workers from paths:
        # - Numbers are workers (1, 2, etc.)
        # - mastra-worker-* are workers
        # - Everything else with / or . or existing as path is a path
        if [[ "$1" =~ ^[0-9]+$ ]] || [[ "$1" == ${WORKER_PREFIX}-* ]]; then
          workers+=("$1")
        elif [[ "$1" == */* ]] || [[ "$1" == .* ]] || [[ -e "$REPO_ROOT/$1" ]]; then
          paths+=("$1")
        else
          # Assume it's a worker if we can't tell
          workers+=("$1")
        fi
        shift
        ;;
    esac
  done

  # If no workers specified, sync to all running workers
  if [[ ${#workers[@]} -eq 0 ]]; then
    workers=($(limactl list --json 2>/dev/null | grep -o "\"name\":\"${WORKER_PREFIX}-[0-9]*\"" | cut -d'"' -f4))
  fi

  if [[ ${#workers[@]} -eq 0 ]]; then
    error "No workers found. Run 'spawn N' first."
  fi

  # Record git state for traceability
  local git_commit git_branch sync_time
  git_commit=$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo "unknown")
  git_branch=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
  sync_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  local path_desc=""
  if [[ ${#paths[@]} -gt 0 ]]; then
    path_desc=" (paths: ${paths[*]})"
  fi

  if [[ "$dry_run" == "true" ]]; then
    log "DRY RUN: Would sync to ${#workers[@]} worker(s)...$path_desc ($git_branch @ ${git_commit:0:8})"
  else
    log "Syncing to ${#workers[@]} worker(s)...$path_desc ($git_branch @ ${git_commit:0:8})"
  fi

  for worker in "${workers[@]}"; do
    # Allow shorthand: "1" -> "mastra-worker-1"
    if [[ "$worker" =~ ^[0-9]+$ ]]; then
      worker="${WORKER_PREFIX}-${worker}"
    fi

    if ! vm_exists "$worker"; then
      log "Worker '$worker' does not exist, skipping..."
      continue
    fi

    if ! vm_running "$worker"; then
      log "Starting worker '$worker'..."
      limactl start "$worker"
    fi

    # Get SSH config for rsync
    local ssh_config_file
    ssh_config_file=$(mktemp)
    get_lima_ssh_config "$worker" > "$ssh_config_file"

    # Build rsync options as array to handle quoting properly
    local -a rsync_opts=(-avz --progress --omit-dir-times)

    # Only use --delete when syncing entire repo (no specific paths)
    if [[ ${#paths[@]} -eq 0 ]]; then
      rsync_opts+=(--delete)
    fi

    # Add shared exclusion patterns
    while IFS= read -r pat; do rsync_opts+=("--exclude=$pat"); done < <(_exclude_patterns)

    if [[ "$dry_run" == "true" ]]; then
      rsync_opts+=(--dry-run)
      log "DRY RUN: Syncing to '$worker'..."
    else
      log "Syncing to '$worker'..."
    fi

    # Ensure destination directory exists
    limactl shell "$worker" -- bash -c "mkdir -p \$HOME/mastra"

    # Get remote path (expand $HOME on remote)
    local remote_base
    remote_base=$(limactl shell "$worker" -- bash -c "echo \$HOME/mastra")

    if [[ ${#paths[@]} -gt 0 ]]; then
      # Sync specific paths
      for path in "${paths[@]}"; do
        # Remove trailing slash for consistency
        path="${path%/}"

        # Ensure remote parent directory exists
        local remote_parent
        remote_parent=$(dirname "$path")
        if [[ "$remote_parent" != "." ]]; then
          limactl shell "$worker" -- bash -c "mkdir -p \$HOME/mastra/$remote_parent"
        fi

        log "  Syncing path: $path"
        rsync "${rsync_opts[@]}" \
          -e "ssh -F $ssh_config_file" \
          "$REPO_ROOT/$path" \
          "lima-$worker:$remote_base/$remote_parent/"
      done
    else
      # Sync entire repo
      rsync "${rsync_opts[@]}" \
        -e "ssh -F $ssh_config_file" \
        "$REPO_ROOT/" \
        "lima-$worker:$remote_base/"
    fi

    rm -f "$ssh_config_file"

    if [[ "$dry_run" != "true" ]]; then
      # Save git state to the worker
      limactl shell "$worker" -- bash -c "cat > \$HOME/mastra/.git-state << EOF
commit=$git_commit
branch=$git_branch
synced_at=$sync_time
EOF"
      log "  Synced to '$worker'"
    fi
  done

  log "Sync complete!"
}

# Sync changes back from a worker to the local repo
# Supports --dry-run flag and optional path filtering
# Usage: sync-back [--dry-run] <worker> [path...]
cmd_sync_back() {
  local dry_run=false
  local worker=""
  local paths=()

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run|-n)
        dry_run=true
        shift
        ;;
      *)
        # First non-flag argument is worker, rest are paths
        if [[ -z "$worker" ]]; then
          worker="$1"
        else
          paths+=("$1")
        fi
        shift
        ;;
    esac
  done

  if [[ -z "$worker" ]]; then
    error "Usage: sync-back [--dry-run] <worker> [path...]"
  fi

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

  # Get SSH config for rsync
  local ssh_config_file
  ssh_config_file=$(mktemp)
  get_lima_ssh_config "$worker" > "$ssh_config_file"

  # Build rsync options as array to handle quoting properly
  local -a rsync_opts=(-avz --progress --omit-dir-times)
  # Add shared exclusion patterns
  while IFS= read -r pat; do rsync_opts+=("--exclude=$pat"); done < <(_exclude_patterns)

  local path_desc=""
  if [[ ${#paths[@]} -gt 0 ]]; then
    path_desc=" (paths: ${paths[*]})"
  fi

  if [[ "$dry_run" == "true" ]]; then
    rsync_opts+=(--dry-run)
    log "DRY RUN: Syncing FROM '$worker' back to repo...$path_desc"
  else
    log "Syncing FROM '$worker' back to repo...$path_desc"
  fi

  # Get remote base path (expand $HOME on remote)
  local remote_base
  remote_base=$(limactl shell "$worker" -- bash -c "echo \$HOME/mastra")

  if [[ ${#paths[@]} -gt 0 ]]; then
    # Sync specific paths
    for path in "${paths[@]}"; do
      # Remove trailing slash for consistency
      path="${path%/}"

      # Ensure local parent directory exists
      local local_parent
      local_parent=$(dirname "$path")
      if [[ "$local_parent" != "." ]]; then
        mkdir -p "$REPO_ROOT/$local_parent"
      fi

      log "  Syncing path: $path"
      rsync "${rsync_opts[@]}" \
        -e "ssh -F $ssh_config_file" \
        "lima-$worker:$remote_base/$path" \
        "$REPO_ROOT/$local_parent/"
    done
  else
    # Sync entire repo
    rsync "${rsync_opts[@]}" \
      -e "ssh -F $ssh_config_file" \
      "lima-$worker:$remote_base/" \
      "$REPO_ROOT/"
  fi

  rm -f "$ssh_config_file"

  if [[ "$dry_run" != "true" ]]; then
    log "Sync back complete from '$worker'"
  fi
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

# Show git state of workers
cmd_status() {
  local workers=("$@")

  # If no workers specified, check all
  if [[ ${#workers[@]} -eq 0 ]]; then
    workers=($(limactl list --json 2>/dev/null | grep -o "\"name\":\"${WORKER_PREFIX}-[0-9]*\"" | cut -d'"' -f4))
    # Also include golden
    workers=("$GOLDEN_NAME" "${workers[@]}")
  fi

  echo ""
  printf "%-20s %-10s %-12s %s\n" "VM" "STATUS" "COMMIT" "SYNCED AT"
  printf "%-20s %-10s %-12s %s\n" "---" "------" "------" "---------"

  for vm in "${workers[@]}"; do
    local status="stopped"
    local commit="-"
    local synced_at="-"

    if ! vm_exists "$vm"; then
      status="missing"
    elif vm_running "$vm"; then
      status="running"
      # Try to read git state
      local git_state
      git_state=$(limactl shell "$vm" -- cat ~/mastra/.git-state 2>/dev/null || echo "")
      if [[ -n "$git_state" ]]; then
        commit=$(echo "$git_state" | grep "^commit=" | cut -d= -f2)
        commit="${commit:0:8}"
        synced_at=$(echo "$git_state" | grep "^synced_at=" | cut -d= -f2)
      fi
    fi

    printf "%-20s %-10s %-12s %s\n" "$vm" "$status" "$commit" "$synced_at"
  done
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

# Watch and sync changes from a worker on a timed loop
cmd_watch_back() {
  local worker=""
  local interval=30
  local paths=()
  local quiet=false

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --interval|-i)
        interval="$2"
        shift 2
        ;;
      --quiet|-q)
        quiet=true
        shift
        ;;
      *)
        if [[ -z "$worker" ]]; then
          # First non-flag argument is worker
          worker="$1"
        else
          # Rest are paths
          paths+=("$1")
        fi
        shift
        ;;
    esac
  done

  if [[ -z "$worker" ]]; then
    error "Usage: $0 watch-back <worker> [path...] [--interval N] [--quiet]"
  fi

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

  # Default to .notion/ if no paths specified
  if [[ ${#paths[@]} -eq 0 ]]; then
    paths=(".notion/")
  fi

  local path_list="${paths[*]}"
  log "Watching '$worker' for changes to: $path_list"
  log "Sync interval: ${interval}s (Ctrl+C to stop)"
  echo ""

  # Get SSH config for rsync
  local ssh_config_file
  ssh_config_file=$(mktemp)
  get_lima_ssh_config "$worker" > "$ssh_config_file"

  # Cleanup on exit
  trap "rm -f '$ssh_config_file'; echo ''; log 'Watch stopped.'" EXIT

  # Build base rsync options
  local -a base_rsync_opts=(-avz --itemize-changes --omit-dir-times)
  # Add shared exclusion patterns
  while IFS= read -r pat; do base_rsync_opts+=("--exclude=$pat"); done < <(_exclude_patterns)

  # Get remote base path
  local remote_base
  remote_base=$(limactl shell "$worker" -- bash -c "echo \$HOME/mastra")

  while true; do
    local timestamp
    timestamp=$(date '+%H:%M:%S')
    local total_changes=0
    local changes_summary=""

    for path in "${paths[@]}"; do
      # Remove trailing slash for consistency
      path="${path%/}"

      # Ensure local parent directory exists
      local local_parent
      local_parent=$(dirname "$path")
      if [[ "$local_parent" != "." ]]; then
        mkdir -p "$REPO_ROOT/$local_parent"
      fi

      # Run rsync and capture output
      local rsync_output
      rsync_output=$(rsync "${base_rsync_opts[@]}" \
        -e "ssh -F $ssh_config_file" \
        "lima-$worker:$remote_base/$path" \
        "$REPO_ROOT/$local_parent/" 2>&1) || true

      # Count actual file changes (lines starting with < or > indicate transfers)
      # The itemize format: >f means receiving file, <f means sending, etc.
      local change_count
      change_count=$(echo "$rsync_output" | grep -c '^[<>]' 2>/dev/null) || change_count=0

      if [[ $change_count -gt 0 ]]; then
        total_changes=$((total_changes + change_count))
        if [[ -n "$changes_summary" ]]; then
          changes_summary+=", "
        fi
        changes_summary+="$path: $change_count"

        # Show detailed changes if not quiet
        if [[ "$quiet" != "true" ]]; then
          echo "$rsync_output" | grep '^[<>]' | while read -r line; do
            # Extract just the filename from itemize output (already includes path base)
            local filename
            filename=$(echo "$line" | awk '{print $2}')
            echo "  [$timestamp] $filename"
          done
        fi
      fi
    done

    # Print summary line
    if [[ $total_changes -gt 0 ]]; then
      log "[$timestamp] Synced $total_changes file(s): $changes_summary"
    elif [[ "$quiet" != "true" ]]; then
      # Only show "no changes" in verbose mode
      printf "\r[lima-cluster] [%s] No changes...    " "$timestamp"
    fi

    sleep "$interval"
  done
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
    sync [--dry-run] [worker...] [path...]   Sync repo TO workers (rsync)
    sync-back [--dry-run] <worker> [path...] Sync FROM worker back to repo
    watch-back <worker> [path...] [--interval N]
                        Watch and sync changes from worker on timed loop

    shell [n|name]      Shell into a worker (default: worker-1)
    list                List all cluster VMs
    status [workers...] Show git commit state of workers
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
    $0 sync --dry-run           # Preview what would sync to workers
    $0 sync                     # Sync code changes to all workers
    $0 sync 1 packages/core/    # Sync specific path to worker 1
    $0 shell 1                  # Connect to worker 1
    $0 sync-back --dry-run 1    # Preview what would sync from worker 1
    $0 sync-back 1 .notion/     # Sync specific path from worker 1
    $0 sync-back 1              # Sync all changes from worker 1

    # Watch for changes (continuous sync)
    $0 watch-back 2 .notion/              # Watch .notion/ on worker 2 (30s interval)
    $0 watch-back 2 .notion/ -i 10        # Watch with 10s interval
    $0 watch-back 2 .notion/ docs/ -q     # Watch multiple paths, quiet mode

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
    sync-back)  cmd_sync_back "$@" ;;
    watch-back) cmd_watch_back "$@" ;;
    shell)      cmd_shell "$@" ;;
    list)       cmd_list "$@" ;;
    status)     cmd_status "$@" ;;
    stop)       cmd_stop "$@" ;;
    teardown)   cmd_teardown "$@" ;;
    help|--help|-h) cmd_help ;;
    *)          error "Unknown command: $cmd. Run '$0 help' for usage." ;;
  esac
}

main "$@"
