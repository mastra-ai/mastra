# Contributing to lima-sandbox

## Development Setup

### Prerequisites

- Go 1.22+
- Lima installed (`brew install lima`)
- golangci-lint (`brew install golangci-lint`)

### Clone and Build

```bash
git clone https://github.com/pinzurlytics/lima-sandbox.git
cd lima-sandbox
make deps
make build
```

### Run Tests

```bash
make test
make test-coverage
```

### Run Linter

```bash
make lint
```

## Project Structure

```
lima-sandbox/
├── cmd/lima-sandbox/     # CLI entry point
├── internal/             # Internal packages (not importable)
│   ├── config/           # Configuration parsing
│   ├── lima/             # Lima SDK wrapper
│   ├── sync/             # rsync operations
│   ├── provision/        # VM provisioning
│   └── commands/         # CLI commands
├── pkg/                  # Public packages (importable)
│   └── version/          # Version info
└── templates/            # Embedded templates
```

## Code Style

- Follow standard Go conventions
- Use `gofmt` and `goimports`
- Keep functions small and focused
- Write tests for new functionality
- Document exported functions

## Adding a New Command

1. Create `internal/commands/mycommand.go`:

```go
package commands

import (
    "github.com/spf13/cobra"
)

func NewMyCommand() *cobra.Command {
    cmd := &cobra.Command{
        Use:   "mycommand",
        Short: "Short description",
        Long:  `Longer description with examples.`,
        RunE: func(cmd *cobra.Command, args []string) error {
            // Implementation
            return nil
        },
    }

    // Add flags
    cmd.Flags().BoolP("verbose", "v", false, "Verbose output")

    return cmd
}
```

2. Register in `cmd/lima-sandbox/main.go`:

```go
rootCmd.AddCommand(commands.NewMyCommand())
```

3. Add documentation in `docs/commands.md`

4. Write tests in `internal/commands/mycommand_test.go`

## Testing

### Unit Tests

```go
func TestMyFunction(t *testing.T) {
    // Test implementation
}
```

### Integration Tests

Integration tests require Lima and are skipped in CI:

```go
func TestIntegration_Build(t *testing.T) {
    if testing.Short() {
        t.Skip("Skipping integration test")
    }
    // Test with real Lima VMs
}
```

Run integration tests:

```bash
go test -v -run Integration ./...
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run tests and linter
5. Commit with clear messages
6. Push and create PR

## Commit Messages

Follow conventional commits:

```
feat: add new sync-back command
fix: handle SSH connection timeout
docs: update configuration reference
refactor: simplify VM cloning logic
test: add tests for config parser
```

## Release Process

1. Update version in `pkg/version/version.go`
2. Update CHANGELOG.md
3. Create git tag: `git tag v0.1.0`
4. Push tag: `git push origin v0.1.0`
5. GitHub Actions builds and releases

## Getting Help

- Open an issue for bugs or feature requests
- Discussions for questions and ideas
