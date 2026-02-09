# Learnings & Gotchas

Hard-won knowledge from building the bash prototype. Reference this when implementing the Go version.

## Lima-Specific

### 1. Probe Timeouts During Cloud-Init

**Problem**: `limactl start` times out waiting for probes while cloud-init is still running.

**Solution**:

- Don't rely solely on `limactl start` success
- Poll cloud-init status separately: `cloud-init status --wait`
- Set generous probe timeouts (300s+)

```go
// After starting, wait for cloud-init
err := waitForCloudInit(ctx, instance, 10*time.Minute)
```

### 2. Lima JSON Output Format

**Problem**: `limactl list --json` outputs one JSON object per line, not a JSON array.

**Solution**: Parse line-by-line, not as a single JSON document.

```go
scanner := bufio.NewScanner(output)
for scanner.Scan() {
    var vm VMInfo
    json.Unmarshal(scanner.Bytes(), &vm)
    // Process each VM
}
```

### 3. SSH Config Extraction

**Problem**: Need SSH config to use rsync with Lima VMs.

**Solution**: Use `limactl show-ssh-config` or Lima's `sshutil` package.

```go
sshConfig, err := sshutil.SSHConfig(inst)
```

### 4. VM Cloning

**Problem**: Lima doesn't have a native clone command.

**Solution**:

1. Stop source VM
2. Copy disk image: `cp ~/.lima/source/basedisk ~/.lima/dest/basedisk`
3. Copy diffdisk if present
4. Create new instance with same config pointing to copied disk

## Networking

### 5. vzNAT Slowness

**Problem**: `vzNAT` networking can be extremely slow (~170 bytes/sec) for certain mirrors.

**Solution**: Use default user-mode networking (omit `networks:` config). Still not blazing fast but more reliable.

### 6. No Host Network Access

**Problem**: VMs can't reach services on the host (e.g., localhost:5432).

**Solution**: This is intentional for security. If needed, use Lima's port forwarding or explicit IP binding.

## SSH & rsync

### 7. Tilde Expansion in Remote Commands

**Problem**: `~` doesn't expand when passed through SSH in quoted strings.

```bash
# Wrong - ~ stays literal
ssh vm "cat ~/file"
# Works in some cases but not reliably
```

**Solution**: Use `$HOME` with proper escaping.

```go
cmd := fmt.Sprintf("cat $HOME/%s", path)
// or
homeDir, _ := getRemoteHomeDir(ssh)
cmd := fmt.Sprintf("cat %s/%s", homeDir, path)
```

### 8. rsync Exclusion Patterns

**Problem**: Shell quoting issues when building rsync commands dynamically.

**Solution**: In Go, build args as a slice, not a string:

```go
args := []string{
    "-avz",
    "--exclude=node_modules/",
    "--exclude=.git/",
    src,
    dst,
}
exec.Command("rsync", args...)
```

### 9. rsync SSH Config

**Problem**: rsync needs to use Lima's SSH config.

**Solution**: Write temp SSH config file and pass via `-e`:

```go
sshConfigPath := writeTempSSHConfig(vmName)
defer os.Remove(sshConfigPath)

args := []string{
    "-e", fmt.Sprintf("ssh -F %s", sshConfigPath),
    // ...
}
```

### 10. SIGPIPE with grep -q

**Problem**: Using `grep -q` in a pipeline causes SIGPIPE (exit 141) when the pipe closes early.

**Solution**: Capture output first, then check:

```go
output, _ := exec.Command("limactl", "list", "--json").Output()
exists := strings.Contains(string(output), vmName)
```

## Tool Installation

### 11. Corepack Keyid Bug

**Problem**: Corepack 0.30.0 (bundled with Node.js 22) has a keyid verification bug.

**Error**: `Cannot find matching keyid: {"signatures":[...],"keys":[...]}`

**Solution**: Update corepack before using pnpm:

```bash
npm install -g corepack@latest
corepack enable
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

### 12. pnpm PATH Issues

**Problem**: pnpm standalone installer puts binary in `~/.local/share/pnpm`, not in PATH.

**Solution**: Always set PNPM_HOME:

```bash
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"
```

### 13. pyenv Initialization

**Problem**: pyenv requires shell initialization to work properly.

**Solution**: In scripts, always init:

```bash
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"
```

## macOS Compatibility

### 14. No GNU Tools

**Problem**: macOS grep doesn't support `-P` (Perl regex), macOS doesn't have `timeout`, etc.

**Solution**:

- Use `awk` instead of `grep -P`
- Use Go's built-in timeout mechanisms
- Avoid GNU-specific flags

### 15. Extended Attributes in tar

**Problem**: macOS tar includes xattrs that cause warnings on Linux.

**Warning**: `tar: Ignoring unknown extended header keyword 'LIBARCHIVE.xattr.com.apple.provenance'`

**Solution**: Suppress stderr or use `--no-xattrs` on macOS:

```go
if runtime.GOOS == "darwin" {
    args = append(args, "--no-mac-metadata")
}
```

## Shell Scripting (Reference for Go Translation)

### 16. zsh Glob Failures

**Problem**: In zsh, glob patterns fail if no matches found.

```bash
rm -f *.pid  # Fails in zsh if no .pid files
```

**Solution**: In Go, use `filepath.Glob` and check results:

```go
files, _ := filepath.Glob("*.pid")
for _, f := range files {
    os.Remove(f)
}
```

### 17. Array Handling for rsync

**Problem**: Bash string concatenation mangles quotes in rsync options.

```bash
# Wrong
opts="--exclude='node_modules/'"
rsync $opts ...  # Literal quotes passed

# Right (bash arrays)
opts=(--exclude="node_modules/")
rsync "${opts[@]}" ...
```

**Go equivalent**: Just use a string slice:

```go
opts := []string{"--exclude=node_modules/"}
```

## Performance

### 18. Cloud-Init Provisioning Time

**Problem**: Initial VM creation with cloud-init is slow (5-15 minutes).

**Mitigation**:

- Use minimal cloud-init (defer tool installation to post-boot scripts)
- Consider pre-baked base images
- Show progress to user

### 19. Disk Space

**Problem**: Each VM uses 15-60GB of disk space.

**Mitigation**:

- Warn users about disk requirements
- Implement `df` check before spawning
- Consider thin provisioning / copy-on-write if Lima supports it

### 20. rsync vs tar for Sync

**Problem**: Initial sync of large repos is slow.

**Analysis**:

- tar over stdin: Good for initial sync, bad for incremental
- rsync: Slower initial sync, but incremental is fast
- Recommendation: Use rsync for both (simpler, incremental wins)

## Error Handling

### 21. Partial Failures

**Problem**: Operations on multiple workers can partially fail.

**Solution**:

- Track success/failure per worker
- Continue on error, report at end
- Return appropriate exit code

```go
var errs []error
for _, worker := range workers {
    if err := sync(worker); err != nil {
        errs = append(errs, fmt.Errorf("%s: %w", worker, err))
        continue  // Don't abort
    }
}
return errors.Join(errs...)
```

### 22. Cleanup on Interrupt

**Problem**: Ctrl+C during operations can leave temp files or VMs in bad state.

**Solution**: Use signal handling and defer cleanup:

```go
ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
defer cancel()

tmpFile := createTempSSHConfig()
defer os.Remove(tmpFile)

// Use ctx for all operations
```
