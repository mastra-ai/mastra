# Future Considerations

Ideas and patterns to explore in future iterations. These are not blockers for the current PR.

---

## Mount Manager / Sandbox Base Class

### Potential Abstract Methods

These methods have patterns that could be generalized, but require sandbox-specific implementations:

1. **`reconcileMounts(expectedPaths: string[]): Promise<void>`**
   - Pattern: Clean up stale mounts that aren't in expected list
   - E2B implementation: Uses `/proc/mounts`, FUSE-specific commands
   - Could define in MastraSandbox as optional/abstract method

2. **`checkExistingMount(mountPath: string): Promise<'not_mounted' | 'matching' | 'mismatched'>`**
   - Pattern: Check if path is mounted and if config matches
   - E2B implementation: Uses `mountpoint -q`, reads marker files
   - Return type could be standardized

3. **Mount directory creation**
   - Pattern: Create mount point with proper permissions
   - E2B implementation: `sudo mkdir -p`, `chown`
   - Other sandboxes may have different permission models

### Considerations

- These are tightly coupled to Linux/FUSE semantics
- Other sandbox providers (Docker, local) may have very different mount mechanisms
- May not be worth abstracting until we have 2+ sandbox implementations
- Could add interfaces/types now, implementations later

---

## PathContext Enhancement

See Task 10 in WORKING.md for current plan.

Additional ideas:
- Include mount health/status in context
- Add mount-specific instructions per filesystem type
- Consider caching pathContext for performance

---

## Shared Test Suite

See Task 12 in WORKING.md.

Should follow patterns from:
- `stores/` - storage adapter tests
- `server-adapters/` - server framework tests

Key aspects to test:
- Filesystem interface compliance
- Mount lifecycle (pending → mounting → mounted)
- readOnly enforcement
- Error handling consistency
