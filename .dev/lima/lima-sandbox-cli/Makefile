# lima-sandbox Makefile

BINARY := lima-sandbox
VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE := $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")

LDFLAGS := -ldflags "-X github.com/pinzurlytics/lima-sandbox/pkg/version.Version=$(VERSION) \
	-X github.com/pinzurlytics/lima-sandbox/pkg/version.Commit=$(COMMIT) \
	-X github.com/pinzurlytics/lima-sandbox/pkg/version.BuildDate=$(BUILD_DATE)"

# Platforms for release
PLATFORMS := darwin/arm64 darwin/amd64 linux/arm64 linux/amd64

.PHONY: all build install clean test lint release

all: build

## build: Build the binary for current platform
build:
	go build $(LDFLAGS) -o bin/$(BINARY) ./cmd/lima-sandbox

## install: Install to GOPATH/bin
install:
	go install $(LDFLAGS) ./cmd/lima-sandbox

## test: Run tests
test:
	go test -v ./...

## test-coverage: Run tests with coverage
test-coverage:
	go test -v -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

## lint: Run linters
lint:
	golangci-lint run

## fmt: Format code
fmt:
	go fmt ./...
	goimports -w .

## clean: Remove build artifacts
clean:
	rm -rf bin/
	rm -rf dist/
	rm -f coverage.out coverage.html

## release: Build for all platforms
release: clean
	@for platform in $(PLATFORMS); do \
		os=$${platform%/*}; \
		arch=$${platform#*/}; \
		output="dist/$(BINARY)-$$os-$$arch"; \
		if [ "$$os" = "windows" ]; then output="$$output.exe"; fi; \
		echo "Building $$os/$$arch..."; \
		GOOS=$$os GOARCH=$$arch go build $(LDFLAGS) -o $$output ./cmd/lima-sandbox; \
	done
	@echo "Creating archives..."
	@cd dist && for f in $(BINARY)-*; do \
		if [ -f "$$f" ]; then \
			tar -czf "$$f.tar.gz" "$$f"; \
			rm "$$f"; \
		fi; \
	done

## checksums: Generate checksums for release artifacts
checksums:
	@cd dist && shasum -a 256 *.tar.gz > checksums.txt

## deps: Download dependencies
deps:
	go mod download
	go mod tidy

## update-deps: Update dependencies
update-deps:
	go get -u ./...
	go mod tidy

## dev: Run in development mode
dev:
	go run ./cmd/lima-sandbox $(ARGS)

## help: Show this help
help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## /  /'

# Default target
.DEFAULT_GOAL := help
