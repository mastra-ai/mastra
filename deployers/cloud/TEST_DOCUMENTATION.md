# Cloud Deployer Test Documentation

This document describes the test suite for the `@mastra/deployer-cloud` package, explaining what each test validates and how it contributes to ensuring the reliability of the cloud deployment system.

## Overview

The cloud deployer test suite consists of **67 tests** across **5 test files**, providing comprehensive coverage of the deployment pipeline from build configuration to server runtime initialization.

## Test Structure

### 1. Core CloudDeployer Tests (`src/index.test.ts`)

**17 tests** covering the main CloudDeployer class functionality.

#### What It Tests:

- **Constructor**: Ensures the CloudDeployer instance is created properly with the correct inheritance chain
- **Deploy Method**: Validates the deploy method exists (currently a no-op implementation)
- **Instrumentation File Creation**: Tests that the instrumentation template is correctly copied to the output directory
- **Package.json Generation**: Verifies cloud-specific dependencies (`@mastra/loggers`, `@mastra/libsql`, `@mastra/cloud`) are automatically added
- **Bundle Method**: Tests the bundling process, including:
  - Correct working directory changes
  - Proper mastra entry file detection
  - Tools path inclusion
- **Error Handling**: Validates graceful error handling for common failure scenarios

#### How It Helps:

- Ensures the deployer correctly prepares a Mastra application for cloud deployment
- Prevents regression in dependency management
- Validates the build pipeline maintains correct file paths and working directories

### 2. Server Runtime Tests (`src/server-runtime.test.ts`)

**13 tests** validating the generated server entry code.

#### What It Tests:

- **Import Statements**: Verifies all required imports are included in the generated code
- **Environment Variable Handling**: Tests proper handling of runtime environment variables
- **Logging Configuration**: Validates PinoLogger setup with appropriate transports
- **Storage Initialization**: Tests LibSQL store and vector database setup
- **Hook Registration**: Verifies ON_GENERATION and ON_EVALUATION hooks are properly registered
- **Readiness Logging**: Ensures proper JSON-formatted logs for monitoring server startup
- **Error Resilience**: Tests optional chaining and conditional logic for missing components

#### How It Helps:

- Ensures the generated server code will run correctly in production
- Validates proper telemetry and monitoring setup
- Guarantees cloud storage integration works as expected
- Provides confidence that the server will handle various deployment scenarios

### 3. File Utility Tests (`src/utils/file.test.ts`)

**4 tests** for file system operations.

#### What It Tests:

- **Entry File Detection**: Validates finding the correct Mastra entry file (index.ts or index.js)
- **Error Handling**: Tests proper MastraError throwing when files are not found
- **Path Resolution**: Ensures correct handling of file paths using MASTRA_DIRECTORY constant

#### How It Helps:

- Prevents build failures due to incorrect file path resolution
- Ensures consistent error reporting for debugging
- Validates the deployer can handle different project structures

### 4. Dependencies Utility Tests (`src/utils/deps.test.ts`)

**22 tests** covering package manager operations and script execution.

#### What It Tests:

- **Package Manager Detection**: Tests detection of npm, yarn, pnpm, and bun based on lock files
- **Lock File Search**: Validates searching parent directories for lock files
- **Caching**: Ensures package manager detection is properly cached
- **Node Version Management**: Tests .nvmrc and .node-version file handling
- **Dependency Installation**: Validates running install commands with the correct package manager
- **Script Execution**: Tests running npm scripts with proper argument handling
- **Build Commands**: Validates custom build command execution
- **Error Scenarios**: Tests proper error handling and MastraError generation

#### How It Helps:

- Ensures compatibility with all major package managers
- Prevents installation failures in different project setups
- Validates proper command execution for builds and scripts
- Provides clear error messages for debugging deployment issues

### 5. Integration Tests (`src/integration.test.ts`)

**11 tests** validating end-to-end deployment scenarios.

#### What It Tests:

- **Directory Preparation**: Tests output directory creation and cleanup
- **Instrumentation File**: Validates the complete instrumentation file content
- **Package.json Generation**: Tests complete package.json creation with:
  - Cloud dependencies
  - Telemetry dependencies
  - Proper script configuration
  - Scoped package handling
- **Entry Code Generation**: Validates the complete server entry code structure
- **Error Recovery**: Tests handling of missing directories and invalid configurations
- **Bundling Workflow**: Tests the complete bundle process with mocked implementations

#### How It Helps:

- Provides confidence in the complete deployment pipeline
- Catches integration issues between components
- Validates real file system operations
- Ensures the deployer produces valid, runnable output

## Benefits of This Test Suite

### 1. **Deployment Reliability**

The comprehensive test coverage ensures that applications deployed using the cloud deployer will:

- Have all required dependencies
- Initialize properly with cloud services
- Handle errors gracefully
- Provide proper monitoring and logging

### 2. **Developer Confidence**

Developers can:

- Make changes without fear of breaking deployments
- Quickly identify issues through clear test failures
- Understand expected behavior through test cases
- Trust that edge cases are handled

### 3. **Maintenance Efficiency**

The test suite:

- Acts as living documentation of expected behavior
- Catches regressions immediately
- Reduces debugging time in production
- Provides clear examples of how to use the deployer

### 4. **Cloud Platform Compatibility**

Tests ensure:

- Proper integration with cloud storage services
- Correct environment variable handling
- Appropriate logging for cloud platforms
- Telemetry and monitoring setup

## Running the Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run a specific test file
pnpm test src/index.test.ts
```

## Test Coverage Areas

- ✅ Build pipeline configuration
- ✅ Dependency management
- ✅ File system operations
- ✅ Package manager compatibility
- ✅ Error handling and recovery
- ✅ Cloud service integration
- ✅ Logging and telemetry
- ✅ Server initialization
- ✅ Environment configuration

## Future Test Considerations

While the current test suite is comprehensive, consider adding tests for:

- Performance benchmarks for large applications
- Memory usage during bundling
- Concurrent deployment scenarios
- Cloud provider-specific integrations
- Advanced error recovery scenarios

---

This test suite ensures that the cloud deployer remains reliable, maintainable, and ready for production use across various deployment scenarios.
