# @mastra/observability-file-local

## 0.0.1

### Initial Release

- Initial release of the local file storage provider for MastraAdmin observability
- Implements `FileStorageProvider` interface from `@mastra/admin`
- Features:
  - Atomic writes (write to temp, then rename) for crash safety
  - Automatic directory creation
  - Prefix-based file listing for processing queues
  - Move operations for marking files as processed
  - Security validation to prevent path traversal attacks
