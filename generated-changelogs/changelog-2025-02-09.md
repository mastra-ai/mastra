## packages/core

Here's the changelog for the core package updates between 2025-02-02 and 2025-02-09:

## New Features

- Added new DefaultVectorDB class with comprehensive filtering capabilities and LibSQL support (#a10b7a3)
- Added new short term "working" memory for agents with XML block masking support (#27275c9)
- Added new filter translator system for vector stores with extensive operator support (#7f24c29)

## Improvements

- Renamed MastraLibSQLStorage and MastraLibSQLVector to DefaultStorage and DefaultVectorDB for better clarity (#5285356)
- Reworked Memory API for more intuitive usage:
  - Renamed historySearch to semanticRecall
  - Renamed embeddingOptions to embedder
  - Added support for configurable working memory (#cb290ee)
- Simplified LLM integration by moving to new primitive-based architecture (#6fa4bd2)
- Enhanced error messages for vector store usage with Memory class (#3700be1)
- Updated operator validation and handling across all vector stores (#ccbc581)

## Breaking Changes

- Removed engine-related functionality in favor of storage-based approach
- Changed Memory configuration:
  - embeddings: {} replaced with embedder: new OpenAIEmbedder()
  - Moved @mastra/vector-libsql into @mastra/core/vector/libsql (#16e5b04)
- Removed direct embedding functionality in favor of using AI SDK embedders

## Build/Deployment

- Added sideEffects: false flag for better tree-shaking
- Updated build configuration to include vector/libsql directory
- Streamlined dependencies by moving several packages to peer dependencies

## Documentation

- Added clarification about base MastraMemory vs Memory class usage
- Updated code examples to reflect new primitive-based architecture
- Added helpful error messages with embedding configuration examples

The focus this week was on simplifying the architecture by removing the engine layer, improving the Memory API, and enhancing vector store capabilities with better filtering support.

## packages/cli

Here's the structured changelog for the CLI package covering February 2-9, 2025:

## New Features

- Added support for AI SDK model providers (OpenAI, Anthropic, Groq) in agent initialization (#323e09e)
- Introduced new build bundler system for improved deployment workflow (#57ae28a)

## Improvements

- Enhanced error handling and display in playground chat component (#42a2e69)
- Updated starter project configuration:
  - Added .env files to gitignore (#0209290)
  - Switched to ES modules by default (#541519c)
  - Improved tsconfig.json defaults for better module resolution (#82a6d53)
- Streamlined deployment process with new deployer integration (#8b416d9)

## Notable Bug Fixes

- Fixed multipart location tool error in init example (#2f2f65e)
- Resolved playground error parsing issues (#42a2e69)
- Fixed bundling issues with server components (#b80ea8d)
- Corrected environment file loading in development mode (#c16b6a1)

## Build/Deployment Improvements

- Removed legacy engine commands in favor of new deployment system (#8b416d9)
- Updated all package dependencies to use caret versioning (#5916f9d)
- Migrated to new deployer architecture for builds and deployments (#4d4f6b6)

## Breaking Changes

- Removed engine-related commands (add, generate, migrate, up, down) (#8b416d9)
- Changed dependency versioning from fixed to caret ranges (#5916f9d)

This release focuses on modernizing the CLI's build and deployment capabilities while improving developer experience through better error handling and project defaults. The removal of engine-related commands marks a significant architectural shift toward a more streamlined deployment process.

## packages/create-mastra

Here's the changelog for create-mastra covering February 2-9, 2025:

## create-mastra Updates (0.1.0-alpha.33)

### Breaking Changes

- Introduced significant breaking changes to core functionality (#8b416d9)

### Dependency Updates

- Updated dependency management strategy from fixed to caret versioning for better compatibility (#5916f9d)
- Refreshed package dependencies to latest stable versions (#9c10484)

### Build System

- Released new create-mastra version with improved stability (#9c10484)

Note: This release contains breaking changes. Please review your implementation when upgrading.

The main focus of this release was on dependency management and build system improvements. The switch to caret versioning (^) allows for more flexible minor version updates while maintaining compatibility.

## packages/deployer

Here's the structured changelog for the deployer module covering 2025-02-02 to 2025-02-09:

## @mastra/deployer 0.1.0-alpha.43

### Major Changes

- Completely refactored bundling system with new architecture and improved dependency handling (#8b416d9)

### New Features

- Added new bundler system with separate analyze, bundle and watch capabilities
- Introduced dedicated bundler plugins for handling special cases like libsql and telemetry
- Added support for platform-specific builds (node/browser)

### Improvements

- Enhanced dependency management with smarter external handling
- Better error handling and validation in server routes
- Updated memory handlers to align with latest core API changes
- Improved environment variable handling with production-focused defaults

### Notable Bug Fixes

- Fixed playground error parsing (#42a2e69)
- Fixed pino logger initialization issues (#0b96376)
- Fixed server agent stream handling for better reliability (#ab01c53)

### Build System

- Migrated to Rollup-based bundling for better tree-shaking and code splitting
- Added dedicated build analysis step to optimize dependencies
- Improved TypeScript configuration and type definitions
- Updated all package dependencies to use caret ranges for better compatibility (#9c10484)

### Performance

- Optimized bundle size through better tree-shaking
- Improved memory usage in bundling process
- Enhanced build caching for faster rebuilds

This release represents a major overhaul of the deployer's bundling system, focusing on reliability, performance, and better dependency management. The new architecture provides more flexibility for different deployment targets while maintaining backward compatibility.

## packages/evals

Here's the structured changelog for the evals package covering February 2-9, 2025:

### Breaking Changes

- Updated model configuration to use new language model interface from @mastra/core (#8b416d9)

### Improvements

- Simplified model initialization by using direct provider functions like `openai()` instead of config objects (#9c10484)
- Updated dependency management to use caret ranges for better version compatibility (#5916f9d)

### Build/Development

- Added TypeScript type checking step to build process (#9c10484)
- Added ai-sdk as peer dependency for improved model handling (#9c10484)
- Updated all package dependencies to latest versions (#9c10484)

### Documentation

- Updated README examples to use new model initialization syntax (#9c10484)
- Simplified code examples for ToxicityMetric and FaithfulnessMetric configuration

This release focuses on modernizing the model configuration interface and improving build reliability. The main breaking change is the switch to using direct provider functions for model initialization, which provides a more intuitive API. Build processes have been enhanced with additional type checking, and dependency management has been updated for better compatibility.

## packages/rag

Here's the structured changelog for the RAG module covering February 2-9, 2025:

## New Features

- Added new vector store prompts and filters for Astra, Chroma, LibSQL, PGVector, Pinecone, Qdrant, Upstash, and Vectorize (#various)
- Introduced GraphRAG tool for enhanced document retrieval and ranking (#various)
- Added vector query tool with support for reranking and filtering (#various)
- Added document chunker tool for flexible document processing (#various)

## Improvements

- Replaced jsdom with node-html-parser for better HTML parsing performance and reduced dependencies (#b27bdb8)
- Enhanced HTML parsing with improved header hierarchy handling and XPath generation (#various)
- Updated vector query search to use new AI SDK embedding models (#various)
- Improved filter handling across different vector store implementations (#various)
- Added comprehensive test coverage for HTML parsing edge cases (#various)

## Notable Bug Fixes

- Fixed handling of empty and invalid HTML documents (#various)
- Improved handling of mixed content and special characters in HTML headers (#various)
- Fixed XPath generation for deeply nested elements (#various)

## Build/Deployment

- Updated all package dependencies (#9c10484)
- Changed dependency versioning from fixed to caret ranges (#5916f9d)
- Added new peer dependencies for AI SDK (#various)

## Breaking Changes

- Migrated from jsdom to node-html-parser for HTML processing (#b27bdb8)
- Updated embedding interface to use new AI SDK models (#various)
- Restructured vector store filtering implementation (#various)
- Changed tool creation interfaces for better type safety (#various)

This release focuses on improving the RAG module's stability, performance, and extensibility while adding support for more vector stores and enhanced document processing capabilities.

## packages/memory

Here's the changelog for the Memory module covering the period from 2025-02-02 to 2025-02-09:

## Memory Module Updates

### New Features

- Added working memory system for agents to maintain contextual information across conversations (#27275c9)
- Introduced `maskStreamTags` helper to hide working memory XML blocks in streamed responses (#27275c9)
- Added integration test suite for comprehensive testing across different storage backends (#9c10484)

### Breaking Changes

- Replaced `embeddings: {}` configuration with `embedder: new OpenAIEmbedder()` for more explicit embedding setup (#d7d465a)
- Renamed memory options for better clarity:
  - `historySearch` → `semanticRecall`
  - `embeddingOptions` → `embedding` (#e9d1b47)

### Improvements

- Reworked Memory public API for more intuitive property names (#cb290ee)
- Enhanced vector search configuration with new `topK` and `messageRange` parameters (#67637ba)
- Added validation for required embedder configuration when using vector storage (#8b416d9)
- Improved error messages with helpful examples for embedder configuration (#8b416d9)

### Bug Fixes

- Fixed storage-related issues with the new Memory API implementation (#67637ba)

### Build/Testing

- Added comprehensive integration tests for PostgreSQL, Upstash, and LibSQL storage backends (#9c10484)
- Moved integration tests to separate package for better organization (#9c10484)
- Added Docker compose configurations for testing different storage backends (#9c10484)

This release significantly improves the Memory module's architecture and developer experience while introducing powerful new features like working memory for maintaining conversation context.

## packages/mcp

Here's the changelog for Mastra AI's MCP package covering February 2-9, 2025:

## MCP Package Updates (v0.1.0-alpha.36)

### Breaking Changes

- Introduced significant breaking changes to core functionality (#8b416d9)

### Improvements

- Updated dependency management to use caret versioning (^) for more flexible version ranges (#5916f9d)
- Simplified agent configuration by using direct model initialization from @ai-sdk/anthropic
- Updated all package dependencies to latest versions (#9c10484)

### Dependencies

- Added @ai-sdk/anthropic SDK for improved model handling
- Updated @mastra/core to v0.2.0-alpha.94

This release includes breaking changes and significant improvements to dependency management. Users should review their implementations when upgrading, particularly around model configuration patterns.

## deployers/cloudflare

Here's the changelog for the Cloudflare deployer module covering February 2-9, 2025:

## Cloudflare Deployer Updates

### Breaking Changes

- Refactored deployer architecture to align with new core API patterns (#8b416d9)

### Improvements

- Updated dependency management from fixed to caret versioning for better compatibility (#5916f9d)
- Enhanced environment variable handling with support for object-based configurations (#38b7f66)
- Made project name parameter optional with 'mastra' as default (#4d4f6b6)
- Simplified authentication configuration by making API token required but email optional

### Build System

- Added Node.js polyfill support for better compatibility (#46124271)
- Integrated rollup-plugin-shim for improved bundling (#79840a1f)
- Added @rollup/plugin-virtual for dynamic entry file generation
- Improved worker configuration with nodejs_compat flag

### Code Structure

- Migrated from MastraDeployer to new Deployer base class
- Implemented new bundle preparation workflow with dedicated prepare() method
- Added structured entry point generation for Cloudflare Workers
- Reorganized deployment logic for better maintainability

### Documentation

- Added TypeScript type declarations for better developer experience
- Updated configuration interface documentation

This release focuses on architectural improvements and better build system support for Cloudflare Workers deployment.

## deployers/netlify

Here's the changelog for the Netlify deployer module covering February 2nd - 9th, 2025:

## Netlify Deployer Updates (Feb 2-9, 2025)

### Breaking Changes

- Refactored deployer architecture with significant API changes (#8b416d9)

### Improvements

- Simplified Netlify site deployment configuration and setup (#4d4f6b6)
- Enhanced function bundling with improved directory structure handling
- Updated dependency management to use more flexible version ranges (#5916f9d)
- Streamlined Netlify functions configuration with better defaults

### Build/Deployment

- Added support for `@rollup/plugin-virtual` for better bundle generation
- Improved Netlify CLI integration using `npx netlify-cli` for more reliable deployments
- Enhanced function directory structure to follow Netlify best practices

### Code Quality

- Removed unnecessary console logging from site creation process
- Improved error handling in deployment process
- Restructured core deployer class for better extensibility

### Dependencies

- Updated core and deployer package dependencies to latest versions
- Switched from fixed to caret (^) versioning for better compatibility

This release focuses on improving the reliability and maintainability of the Netlify deployer while providing a more streamlined deployment experience.

## deployers/vercel

Here's the structured changelog for the Vercel deployer module covering February 2-9, 2025:

## Vercel Deployer Updates

### Major Changes

- Refactored Vercel deployer to extend base `Deployer` class instead of `MastraDeployer` for better architecture alignment (#8b416d9)

### New Features

- Added support for team-based deployments with new `teamId` parameter (#4d4f6b6)
- Introduced token-based authentication for Vercel API interactions
- Added built-in environment variable syncing with Vercel platform

### Improvements

- Enhanced bundle generation with virtual entry file support using `@rollup/plugin-virtual`
- Improved environment variable handling with Map-based storage
- Streamlined deployment process with better file organization
- Added structured logging through logger interface

### Build/Deployment Improvements

- Updated dependency management to use caret (^) versioning for better compatibility (#5916f9d)
- Added `fs-extra` and `@rollup/plugin-virtual` as direct dependencies
- Simplified deployment directory structure with dedicated output directory

### Code Quality

- Improved error handling for environment variable processing
- Enhanced type safety throughout the deployment process
- Cleaned up file generation logic with more maintainable structure

This release represents a significant architectural improvement to the Vercel deployer, making it more robust and easier to maintain while adding important features for team-based deployments.

## speech/azure

Here's the changelog for Mastra AI's speech/azure module covering February 2-9, 2025:

# Speech Azure Module Updates (v0.1.0-alpha.19)

## Breaking Changes

- Implemented significant breaking changes to improve module architecture (#8b416d9)

## Improvements

- Updated dependency management from fixed to caret versioning for better compatibility (#5916f9d)
- Updated all package dependencies to latest versions (#9c10484)

## Build/Deployment

- Upgraded to @mastra/core v0.2.0-alpha.94
- Multiple dependency version bumps to maintain compatibility with core module updates

Note: This release contains breaking changes. Please review documentation before upgrading.

The main focus of this release was on architectural improvements and dependency management. The switch to caret versioning allows for more flexible minor version updates while maintaining compatibility.

## speech/deepgram

Here's the changelog for the Mastra AI Speech/Deepgram module covering February 2-9, 2025:

# Speech/Deepgram Module Updates

## Breaking Changes

- Implemented significant breaking changes to improve module stability and functionality (#8b416d9)

## Improvements

- Updated dependency management to use caret (^) versioning for more flexible package updates (#5916f9d)
- Performed comprehensive package updates across all dependencies (#9c10484)

## Build/Deployment

- Upgraded from version 0.0.1-alpha.8 to 0.1.0-alpha.19, reflecting significant module maturity
- Updated core dependency to latest version with multiple improvements

Note: This update period included several version bumps and dependency updates that were primarily maintenance-focused. The most significant changes were the breaking changes implementation and the shift to more flexible dependency versioning.

## speech/elevenlabs

Here's the changelog for the Mastra AI Speech/ElevenLabs module covering February 2-9, 2025:

## Speech/ElevenLabs Updates

### Breaking Changes

- Implemented significant breaking changes to improve module stability and API consistency (#8b416d9)

### Improvements

- Updated dependency management to use caret (^) versioning for more flexible package updates (#5916f9d)
- Performed comprehensive package updates across all dependencies (#9c10484)

### Build/Deployment

- Upgraded from version 0.0.1-alpha.8 to 0.1.0-alpha.19, reflecting significant module maturity
- Updated core dependency to latest version with multiple improvements

Note: This module saw primarily infrastructure and dependency updates during this period, laying groundwork for future feature additions. The breaking changes indicate important architectural improvements that will enable better stability and maintainability going forward.

## speech/google

Here's the changelog for Mastra AI's speech/google module covering February 2-9, 2025:

# Speech Google Module Changelog

## Breaking Changes

- Implemented significant breaking changes to improve module stability and functionality (#8b416d9)

## Dependency Updates

- Updated dependency management from fixed to caret versioning for better compatibility (#5916f9d)
- Updated all package dependencies to latest versions (#9c10484)

## Build System

- Bumped version from 0.0.1-alpha.8 to 0.1.0-alpha.19 to reflect breaking changes

Note: This week's changes were primarily focused on infrastructure and dependency management. The breaking changes introduced may require updates to existing implementations. Please review the [migration guide](docs/migration-guide.md) for detailed upgrade instructions.

The module continues to maintain compatibility with Google Cloud Text-to-Speech v5.0.1.

## speech/ibm

Here's the changelog for the IBM Speech module covering February 2-9, 2025:

# IBM Speech Module Changelog

## Breaking Changes

- Implemented significant breaking changes to improve module stability and API consistency (#8b416d9)

## Dependency Updates

- Updated dependency management from fixed to caret versioning for better compatibility (#5916f9d)
- Updated all package dependencies to latest versions (#9c10484)

## Core Integration

- Multiple core module updates integrated through @mastra/core version bumps to 0.2.0-alpha.94

Note: This period primarily focused on infrastructure and dependency management improvements. No significant feature additions or bug fixes were implemented during this timeframe.

For detailed information about the IBM Speech integration, please visit our [documentation](https://docs.mastra.ai/speech/ibm).

## speech/murf

Here's the changelog for Mastra AI's speech/murf module covering February 2-9, 2025:

# Mastra Speech/Murf Changelog (Feb 2-9, 2025)

## Breaking Changes

- Implemented significant breaking changes to improve module stability and API consistency (#8b416d9)

## Improvements

- Updated dependency management to use more flexible version ranges with caret (^) instead of fixed versions (#5916f9d)
- Updated all package dependencies to latest compatible versions (#9c10484)

## Build/Deployment

- Bumped version from 0.0.1-alpha.8 to 0.1.0-alpha.19, reflecting breaking changes
- Updated core dependency to use workspace-level versioning

Note: This release includes several internal dependency updates and preparations for future features. While the breaking changes are significant, they lay the groundwork for improved stability and functionality in upcoming releases.

---

Dependencies:

- Updated @mastra/core to version 0.2.0-alpha.94

## speech/openai

Here's the changelog for Mastra AI's speech/openai module covering February 2-9, 2025:

# Mastra AI Changelog - Speech OpenAI Module

February 2-9, 2025

## Breaking Changes

- Updated dependency management to use caret (^) versioning instead of fixed versions for better compatibility (#5916f9d)

## Improvements

- Implemented major package updates across all components (#9c10484)
- Updated OpenAI integration to version 4.28.0 for improved speech processing capabilities

## Build/Deployment

- Upgraded to version 0.1.0-alpha.19 from 0.0.1-alpha.8, reflecting significant module maturity
- Updated core dependency to use workspace-level versioning for better package management

Note: This module has several version bumps related to dependency updates from the core package, but they don't directly affect the speech/openai functionality.

For detailed technical documentation, visit our [OpenAI Speech Integration docs](https://docs.mastra.ai/speech/openai).

## speech/playai

Here's the changelog for Mastra AI's speech/playai module covering February 2-9, 2025:

# Speech PlayAI Module Changelog

## Breaking Changes

- Implemented significant breaking changes to core functionality (#8b416d9)

## Improvements

- Updated dependency management to use semantic versioning with caret ranges (^) instead of fixed versions (#5916f9d)
- Updated all package dependencies to latest versions (#9c10484)

## Build/Deployment

- Bumped version from 0.0.1-alpha.8 to 0.1.0-alpha.19, reflecting breaking changes
- Updated @mastra/core dependency to use workspace versioning

Note: This week's changes were primarily focused on dependency management and version updates. The breaking changes introduced may require updates to dependent applications. Please review your integration points with the PlayAI module.

For detailed information about the breaking changes, please refer to our [migration guide](docs/migration-guide.md).

## speech/replicate

Here's the changelog for Mastra AI's speech/replicate module covering February 2-9, 2025:

# Mastra Speech Replicate Changelog (Feb 2-9, 2025)

## Breaking Changes

- Updated dependency management to use caret (^) versioning instead of fixed versions for better compatibility (#5916f9d)

## Build & Dependencies

- Updated all package dependencies to latest versions (#9c10484)
- Upgraded to @mastra/core v0.2.0-alpha.94 with latest features and improvements

## Version Notes

- Module version bumped to 0.1.0-alpha.19
- Multiple alpha releases (0.1.0-alpha.11 through 0.1.0-alpha.19) for iterative improvements

Note: This week's changes were primarily focused on dependency management and version alignment. No significant feature additions or bug fixes were included in this update.

For detailed information about the @mastra/core updates included in this release, please refer to the core module's changelog.

## speech/speechify

Here's the changelog for Mastra AI's speechify module covering February 2-9, 2025:

# Speechify Module Changelog (Feb 2-9, 2025)

## Breaking Changes

- Implemented significant breaking changes to improve module stability and performance (#8b416d9)

## Improvements

- Updated dependency management from fixed to caret versioning for better compatibility (#5916f9d)
- Updated all package dependencies to latest versions for improved stability (#9c10484)

## Build/Deployment

- Upgraded to version 0.1.0-alpha.19 from 0.0.1-alpha.8, reflecting module maturity
- Updated core dependency to use workspace-level versioning

Note: Several minor version bumps and dependency updates were made to maintain compatibility with @mastra/core updates.

For detailed API documentation, please visit our [Speechify Integration Guide](https://docs.mastra.ai/speech/speechify).

## stores/pg

Here's the structured changelog for @mastra/pg for the week of February 2-9, 2025:

## @mastra/pg - Combined PostgreSQL Package

### New Features

- Combined PostgreSQL vector and storage capabilities into a unified `@mastra/pg` package (#c87eb4e)
- Added support for complex metadata filtering with MongoDB-like query syntax
- Implemented comprehensive regex pattern matching with support for flags and options
- Added `$elemMatch` operator for querying array elements with multiple conditions

### Improvements

- Enhanced filter translation with support for nested logical operators
- Added support for array operations including `$all`, `$in`, `$nin`, and `$contains`
- Improved handling of numeric comparisons with support for string-numeric conversions
- Added support for deep object traversal in metadata queries
- Enhanced connection pooling with configurable timeouts and limits

### Notable Bug Fixes

- Fixed transaction handling for batch vector operations
- Improved error handling for invalid filter operators
- Fixed edge cases in array comparison operations
- Corrected handling of empty logical operators

### Build/Deployment

- Added Docker compose configuration for local development
- Implemented comprehensive test suite with 100+ test cases
- Added TypeScript configuration with strict type checking
- Set up CI/CD pipeline with automated testing

### Documentation

- Added detailed API documentation with examples
- Included comprehensive filter operator guide
- Added connection configuration documentation
- Provided migration guide from separate packages

This release represents a major consolidation of PostgreSQL functionality in Mastra, combining vector similarity search and storage capabilities into a single, more maintainable package. The new unified package provides improved developer experience and better integration between vector and storage operations.

## stores/astra

Here's the structured changelog for @mastra/astra for the week of February 2-9, 2025:

## @mastra/astra Changelog (Feb 2-9, 2025)

### New Features

- Added comprehensive vector store implementation for DataStax Astra DB (#c87eb4e)
- Implemented support for cosine, euclidean, and dot product similarity metrics
- Added metadata filtering with MongoDB-style query syntax
- Added batch vector operations for efficient data management

### Improvements

- Moved package from `@mastra/vector-astra` to `@mastra/astra` for better organization (#c87eb4e)
- Enhanced filter validation and handling for vector queries
- Added support for complex nested metadata queries
- Improved collection management with create, list, describe, and delete operations
- Added optional vector inclusion in query results

### Notable Bug Fixes

- Fixed handling of null/undefined filters in vector queries
- Improved validation of operator values in metadata filters
- Fixed edge cases in array operations and numeric comparisons

### Build/Deployment

- Added `.env` file support for configuration management
- Set up TypeScript configuration with bundler-based module resolution
- Configured Vitest for comprehensive test coverage
- Added tsup for optimized package bundling

### Documentation

- Added comprehensive README with installation and usage instructions
- Added detailed API documentation for vector store operations
- Included examples for common vector operations and metadata filtering
- Added links to Astra DB documentation and API references

### Migration Guide

Users upgrading from @mastra/vector-astra should:

1. Remove @mastra/vector-astra from dependencies
2. Install @mastra/astra
3. Update imports from '@mastra/vector-astra' to '@mastra/astra'
4. No functional changes required - all features remain compatible

Note: This is a significant release that establishes the foundation for Astra DB vector store integration in Mastra AI, with comprehensive support for vector similarity search and advanced metadata filtering capabilities.

## stores/chroma

Here's the structured changelog for @mastra/chroma for the week of February 2-9, 2025:

# @mastra/chroma Changelog

## Package Migration

- Moved package from `@mastra/vector-chroma` to `@mastra/chroma` for better organization (#684d5d1)
- Relocated source files to `stores/chroma` directory
- Updated package name and imports while maintaining functionality

## New Features

- Added comprehensive filter validation for query operations
- Implemented ChromaFilterTranslator for improved query filtering
- Added support for complex nested logical operators in queries
- Introduced collection-based organization with automatic caching

## Improvements

- Enhanced vector dimension validation for better error handling
- Updated operator validation and handling for all vector stores
- Added support for multiple comparison operators on same field
- Improved handling of metadata filters with complex conditions
- Added validation for date values and numeric edge cases

## Notable Bug Fixes

- Fixed handling of empty object filters
- Corrected validation for array operator values
- Fixed issues with nested logical operators in field-level conditions

## Build/Deployment

- Added tsup bundling configuration for better package distribution
- Updated dependencies to use caret ranges for better compatibility
- Added comprehensive test suite for filter operations and edge cases

## Documentation

- Added detailed API documentation with usage examples
- Included migration guide from @mastra/vector-chroma
- Added documentation for supported filter operations and metadata handling

This release represents a significant restructuring of the Chroma vector store implementation, with major improvements to query filtering capabilities and better organization within the Mastra ecosystem.

## stores/pinecone

Here's the structured changelog for @mastra/pinecone for the week of February 2-9, 2025:

## @mastra/pinecone Changelog

### New Features

- Added comprehensive support for Pinecone's Unified Filter API with complex query capabilities (#c87eb4e)
- Implemented automatic batching for large vector upserts, handling up to 100 vectors per request (#c87eb4e)
- Added support for empty object handling in filters and queries (#c87eb4e)

### Improvements

- Moved package from `@mastra/vector-pinecone` to `@mastra/pinecone` for better organization (#c87eb4e)
- Enhanced filter validation with improved error handling and type checking (#c87eb4e)
- Added extensive test coverage for filter operations and edge cases (#cf4c02c)
- Updated operator validation to better handle comparison and logical operators (#ccbc581)

### Notable Bug Fixes

- Fixed handling of empty arrays in $in operator (#c87eb4e)
- Corrected validation for numeric comparison operators (#c87eb4e)
- Fixed handling of null values in filter queries (#c87eb4e)

### Build/Deployment Improvements

- Added .env file to .gitignore for better security (#2eea525)
- Reorganized source files into src/vector structure for better maintainability (#c87eb4e)
- Updated package dependencies to use caret ranges for better compatibility (#5916f9d)

### Documentation

- Added comprehensive README with installation and usage instructions (#c87eb4e)
- Added detailed examples for filter operations and vector queries (#c87eb4e)
- Updated migration guide for users moving from @mastra/vector-pinecone (#c87eb4e)

This release represents a significant evolution of the Pinecone integration, with major improvements to filtering capabilities and overall package organization. The move to a new package name and enhanced filter support provides a more robust foundation for vector search operations.

## stores/qdrant

Here's the structured changelog for @mastra/qdrant for the week of February 2-9, 2025:

# @mastra/qdrant Changelog

## New Features

- Added comprehensive filter translation system supporting MongoDB-style queries for Qdrant (#c87eb4e)
- Implemented geo-spatial filtering with support for radius, bounding box, and polygon queries (#c87eb4e)
- Added support for nested object queries and array operations (#c87eb4e)
- Introduced custom operators for specialized Qdrant features:
  - `$count` for array length queries
  - `$geo` for spatial searches
  - `$hasId` for point ID filtering
  - `$hasVector` for vector existence checks
  - `$datetime` for timestamp range queries
  - `$nested` for nested object filtering

## Improvements

- Moved package from `@mastra/vector-qdrant` to `@mastra/qdrant` with improved organization (#c87eb4e)
- Enhanced query performance with automatic batching for large upserts (256 vectors per batch) (#c87eb4e)
- Added type safety for filter operations (#c87eb4e)
- Improved error handling for invalid queries and connection issues (#c87eb4e)

## Notable Bug Fixes

- Fixed handling of null values and empty arrays in filters (#c87eb4e)
- Corrected dimension validation for vector inputs (#c87eb4e)

## Build/Deployment

- Updated package structure with separate vector and filter modules (#c87eb4e)
- Added comprehensive test suite with 100+ test cases (#c87eb4e)
- Configured tsup for optimized builds (#b422ed3)

## Documentation

- Added detailed API documentation with examples (#c87eb4e)
- Included migration guide from `@mastra/vector-qdrant` (#c87eb4e)
- Added code examples for all filtering operations (#c87eb4e)

This release represents a significant evolution of the Qdrant integration, with major improvements to filtering capabilities and overall reliability. The new filter translation system enables complex queries while maintaining type safety and performance.

## stores/upstash

Here's the changelog for the Upstash module updates from February 2-9, 2025:

## @mastra/upstash Updates

### New Features

- Combined Upstash vector store and database storage into a single unified package (#c87eb4e)
- Added support for complex filter operations in vector queries including:
  - Array indexing with positive and negative indices
  - Pattern matching with glob syntax
  - Nested field queries
  - Logical operators (AND, OR, NOT, NOR)
  - Field existence checks

### Improvements

- Reorganized source code into dedicated `src/vector` and `src/storage` directories for better maintainability (#c87eb4e)
- Enhanced filter translation system with comprehensive operator support
- Added proper test skipping when Upstash credentials are unavailable
- Improved error handling for invalid filter conditions and edge cases

### Notable Bug Fixes

- Fixed handling of special characters in filter strings
- Corrected scientific notation number formatting in queries
- Addressed issues with empty array conditions in filters

### Build/Deployment

- Added Docker compose configuration for local development
- Updated package exports to include both vector and storage functionality
- Added comprehensive test coverage for filter operations

### Migration Guide

Users should:

1. Replace `@mastra/vector-upstash` and `@mastra/store-upstash` with `@mastra/upstash`
2. Update imports:

   ```typescript
   // Old
   import { UpstashVector } from '@mastra/vector-upstash'
   import { UpstashStore } from '@mastra/store-upstash'

   // New
   import { UpstashVector, UpstashStore } from '@mastra/upstash'
   ```

This release represents a major consolidation of Upstash functionality while maintaining backward compatibility.

## stores/vectorize

Here's the structured changelog for @mastra/vectorize for the week of February 2-9, 2025:

## @mastra/vectorize 0.1.0-alpha.30

### Breaking Changes

- Renamed package from `@mastra/vector-vectorize` to `@mastra/vectorize` for better consistency (#91c81f5)
- Moved package from vector-stores directory to stores directory for improved organization (#91c81f5)

### New Features

- Added comprehensive filter validation for vector queries (#ccbc581)
- Implemented support for nested field operations in metadata filters (#9c10484)
- Added metadata indexing capabilities with type support for string, number, and boolean fields (#8b416d9)

### Improvements

- Enhanced filter translation with support for:
  - Complex range queries
  - Mixed type comparisons
  - Nested field operations
  - Null value handling
- Improved error handling for invalid filter conditions (#ccbc581)
- Added validation for filter key lengths and character restrictions (#9c10484)

### Notable Bug Fixes

- Fixed handling of numeric zero values in metadata filters
- Corrected lexicographical ordering in string range queries
- Resolved issues with empty filter objects and undefined values

### Build/Deployment

- Updated package dependencies to use caret (^) version ranges for better compatibility (#5285356)
- Implemented bundle optimization with tsup for improved package size (#b422ed3)

### Documentation

- Added comprehensive usage examples in README
- Improved API documentation for filter operations
- Added configuration guidelines for Vectorize integration

For more details on the Vectorize integration, see our [documentation](https://www.vectorize.com/docs).
