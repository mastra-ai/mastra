# Issue Summary: Large Payload Handling Across All Storage Adapters

## Related Issues & PRs

- **GitHub Issue**: [#6322 - Memory Leak in Mastra Workflow After Multiple Requests](https://github.com/mastra-ai/mastra/issues/6322)
- **GitHub PR**: [#8415 - added tests to check for large payloads in snapshots](https://github.com/mastra-ai/mastra/pull/8415)
- **Branch**: `mastra-4194/pg-large-payloads`

## Executive Summary

This is a **critical cross-cutting issue** affecting **all storage adapters**, not just PostgreSQL. Mastra workflow snapshots can cause heap out-of-memory crashes when handling large payloads due to JSON serialization limits and database constraints.

## Problem Statement

### Primary Issue (Originally PostgreSQL)

When inserting to PostgreSQL via the PG store, if an individual column is large enough, `JSON.stringify` succeeds but the insert query fails with a mysterious error.

**Root Cause Discovery**: Through testing, we identified multiple failure points:

1. **~255MB**: pg-promise's `String.replace()` fails during query formatting
2. **~500MB**: V8's `JSON.stringify()` fails with heap exhaustion
3. **The Gap (255-500MB)**: JSON.stringify works but insert fails - the "mysterious error" from the original ticket

### Scope Expansion: ALL Adapters Affected

After implementing PostgreSQL fixes, we discovered this affects **every storage adapter** with workflow support:

#### Adapters Using JSON.stringify (Vulnerable to V8 heap limits):

- **DynamoDB**: 400KB item limit - **MOST RESTRICTIVE! CRITICAL!**
- **PostgreSQL**: Fails at ~255MB (pg-promise) or ~500MB (V8)
- **Cloudflare D1**: 128MB worker memory limit
- **Cloudflare Workers KV**: 128MB worker memory limit, 25MB value limit
- **MS SQL**: V8 limit (~500MB)
- **ClickHouse**: V8 limit (~500MB), column size limits vary
- **Lance**: V8 limit (~500MB), columnar storage
- **LibSQL**: V8 limit (~500MB), SQLite fork

#### Adapters with Native Object Storage:

- **MongoDB**: 16MB document limit (stores as native object, no stringify)
- **Upstash**: 256MB value limit (Redis-based, stores as object)

### Related Memory Leak (Issue #6322)

- User's workflow with ~20k tokens of context data
- First execution succeeds
- Second execution causes heap crash with "JavaScript heap out of memory"
- Stack trace shows failure in `v8::internal::JsonStringify`
- Memory accumulates between runs without proper garbage collection
- **Environment**: Mastra 0.11.1 (@mastra/core), 0.12.5 (@mastra/pg), Node.js v22.16.0, macOS 14.5.0

## Testing Results (PostgreSQL Only - So Far)

### PostgreSQL Environment

- **PostgreSQL Version**: 16 (via pgvector/pgvector:pg16 Docker image)
- **pg Node Driver**: 8.16.3
- **pg-promise Version**: 11.15.0
- **TEXT Column Limit**: ~1GB (1,073,741,823 bytes) via TOAST
- **JSONB Hard Limit**: **256MB (268,435,455 bytes)** - PostgreSQL internal limit due to 32-bit offsets in JSONB structure

### Test 1: Full Snapshot Insertion (`persistWorkflowSnapshot`)

Comprehensive tests in `stores/pg/src/storage/test-utils.ts` demonstrating failure points when inserting complete snapshots:

#### Failure Points by Size:

- **50-100MB**: Generally succeeds ✓
- **200MB**: Current safety limit (PostgreSQL temporary fix) ✓
- **255MB**: pg-promise formatting fails - `String.replace()` exceeds internal limit ❌
- **300MB**: Within JSON.stringify limit but database insert fails (the gap issue) ❌
- **500MB**: JSON.stringify fails with heap exhaustion ❌
- **600MB+**: Guaranteed heap crash without protection ❌

#### Test Patterns Verified:

All patterns show the same failure thresholds:

- Single huge strings
- Large object arrays (25,000 objects × 4KB each)
- Multiple large fields across snapshot
- Deeply nested structures (10+ levels deep)

### Test 2: Gradual Column Accumulation (`updateWorkflowResults`)

**NEW**: Implemented `updateWorkflowResults` to test how much data can accumulate in a PostgreSQL column through incremental updates using `jsonb_set`.

#### Implementation Details:

- Uses PostgreSQL's `jsonb_set` function to update JSON in-place
- Each update adds a step result to `snapshot.context[stepId]`
- Avoids re-inserting entire snapshot
- Tests actual PostgreSQL column capacity limits

#### Results (50MB per step):

- **Step 1**: Added 50MB → Total: 50MB ✓ (verified: 1 step in context)
- **Step 2**: Added 50MB → Total: 100MB ✓ (verified: 2 steps in context)
- **Step 3**: Added 50MB → Total: 150MB ✓ (verified: 3 steps in context)
- **Step 4**: Added 50MB → Total: 200MB ✓ (verified: 4 steps in context)
- **Step 5**: Added 50MB → Total: 250MB ✓ (verified: 5 steps in context)
- **Step 6**: Added 50MB → **FAILED** at 300MB ❌
  - **Error**: `total size of jsonb object elements exceeds the maximum of 268435455 bytes`
  - **268,435,455 bytes = 256MB exactly** (256 _ 1024 _ 1024 - 1)

#### Key Findings:

1. **PostgreSQL JSONB has a hard 256MB limit**: This is an internal PostgreSQL limitation, not a driver issue
2. **Root cause identified**: JSONB uses 32-bit offsets to track element positions (2^28 bytes = 268,435,456 bytes, minus 1 reserved)
3. **Data integrity verified**: Each step correctly added to context and retrievable up to the limit
4. **Gradual accumulation hits same limit as single insert**: Both methods fail at 256MB for JSONB
5. **This is NOT**:
   - ❌ pg-promise limit (~255MB for string formatting, but that's different)
   - ❌ V8 JSON.stringify limit (~500MB)
   - ❌ TEXT column limit (~1GB)
   - ❌ Driver or JavaScript issue
6. **This IS**: ✅ PostgreSQL's internal JSONB storage architecture limit

#### Comparison: Different Limits in the Stack

| Layer                       | Limit     | Type           | Notes                                            |
| --------------------------- | --------- | -------------- | ------------------------------------------------ |
| **PostgreSQL JSONB**        | **256MB** | **Hard limit** | **Internal JSONB structure uses 32-bit offsets** |
| pg-promise query formatting | ~255MB    | Soft limit     | String.replace() fails during query building     |
| V8 JSON.stringify           | ~500MB    | Soft limit     | Heap exhaustion during stringification           |
| PostgreSQL TEXT column      | ~1GB      | Hard limit     | TOAST storage limit                              |
| PostgreSQL JSON (not JSONB) | ~1GB      | Hard limit     | Stored as TEXT, no 256MB limit                   |

**Critical Insight**: The 256MB JSONB limit is the actual bottleneck for workflow snapshots. This explains:

- Why single inserts fail around 200-255MB (hitting both pg-promise AND JSONB limits)
- Why gradual accumulation also fails at 256MB (JSONB limit)
- Why we can't work around this with `jsonb_set` or any other JSONB operation
- Why switching to plain JSON (stored as TEXT) would allow up to 1GB, but lose JSONB query capabilities

### Other Adapters (Not Yet Tested)

Expected failure points based on limits:

- **DynamoDB**: Will fail at 400KB - **needs immediate attention**
- **MongoDB**: Will fail at 16MB document limit
- **Cloudflare Workers KV**: Will fail at 25MB value limit
- **Cloudflare D1**: Will fail at ~128MB (worker memory)
- **Upstash**: Will fail at 256MB (Redis limit)
- **MS SQL, ClickHouse, LibSQL, Lance**: Will fail at ~500MB (V8 heap limit)

## Current Mitigation (PostgreSQL Only - TEMPORARY)

### ⚠️ CRITICAL: PostgreSQL-Only Fix (Not Universal)

**These fixes are ONLY in the PostgreSQL adapter**. All other storage adapters remain vulnerable to heap crashes and don't have the enhanced error handling. This temporary fix was implemented before we realized the scope of the issue across all adapters.

### What We've Implemented for PostgreSQL:

1. **Proactive size checking**:
   - Estimates payload size before JSON.stringify
   - Rejects payloads >200MB with clear error message
   - Prevents heap crashes

2. **Enhanced error handling** with distinct error IDs:
   - `MASTRA_STORAGE_PAYLOAD_TOO_LARGE`: Size check fails (>200MB)
   - `MASTRA_STORAGE_JSON_STRINGIFY_FAILED`: JSON.stringify fails
   - `MASTRA_STORAGE_PG_STORE_PERSIST_WORKFLOW_SNAPSHOT_FAILED`: Database insert fails

3. **Comprehensive test suite** demonstrating:
   - Success cases (100-200MB)
   - pg-promise formatting failures (~255MB)
   - JSON.stringify failures (~500MB)
   - Memory leak prevention

### Limitations of Current Fix:

- ❌ Band-aid that rejects valid use cases rather than handling them
- ❌ Only protects PostgreSQL users
- ❌ Other adapters need similar protection urgently (especially DynamoDB with 400KB limit)
- ❌ No actual solution for large payloads - just rejection

## Database-Specific Limits Reference

| Adapter                | Storage Type  | Theoretical Limit | Practical Limit | Critical Issue                             |
| ---------------------- | ------------- | ----------------- | --------------- | ------------------------------------------ |
| **DynamoDB**           | Item          | 400KB             | **400KB**       | **Smallest limit - CRITICAL!**             |
| MongoDB                | Document      | 16MB              | 16MB            | Document size limit                        |
| Cloudflare Workers KV  | KV Value      | 25MB              | 25MB            | Value size limit                           |
| Cloudflare D1          | TEXT          | 1GB               | 128MB           | Worker memory limit                        |
| **PostgreSQL (JSONB)** | **JSONB**     | **256MB**         | **256MB**       | **JSONB 32-bit offset limit - HARD LIMIT** |
| PostgreSQL (JSON)      | TEXT          | 1GB               | ~500MB          | JSON.stringify limit                       |
| Upstash                | Redis Value   | 256MB             | 256MB           | Redis value limit                          |
| MS SQL                 | NVARCHAR(MAX) | 2GB               | ~500MB          | JSON.stringify limit                       |
| ClickHouse             | String        | Configurable      | ~500MB          | JSON.stringify limit                       |
| LibSQL                 | TEXT          | 1GB               | ~500MB          | JSON.stringify limit                       |
| Lance                  | Column        | No fixed limit    | ~500MB          | JSON.stringify limit                       |

**Critical Findings**:

- DynamoDB's 400KB limit makes it unusable for even moderately sized workflows without a solution
- PostgreSQL JSONB has a **hard 256MB limit** due to internal structure (32-bit offsets)
- Switching PostgreSQL to plain JSON (TEXT) storage could support up to 1GB but would lose JSONB query capabilities

## Solution Options Analysis

### Option 1: Compression

**What it is**: Compress JSON data before storage using standard algorithms.

**Technical Details**:

- **Algorithms**: gzip (widely supported), Brotli (better compression), LZ4 (faster)
- **Compression Ratios**: JSON typically compresses 5-10x (highly redundant structure)
- **Implementation**: Node.js built-in `zlib` module, no dependencies

**Real-world Impact**:

- 300MB JSON → ~30-60MB compressed
- Would solve most cases except extreme outliers
- DynamoDB's 400KB limit would still be challenging

**Trade-offs**:

- CPU overhead: ~50-200ms for 100MB payload
- Decompression required on every read
- Still subject to JSON.stringify memory limits during compression

**Library Options**:

- Built-in: `zlib` (gzip, deflate, brotli)
- Third-party: `lz4`, `snappy` (faster but less compression)

### Option 2: Binary Serialization

**What it is**: Replace JSON with more efficient binary formats.

**Technical Details**:

- **MessagePack**: Binary JSON-like format, 2-3x smaller than JSON
- **Protocol Buffers**: Google's format, requires schema definition
- **CBOR**: Binary JSON, self-describing like JSON

**Size Comparisons** (100MB JSON test):

- JSON: 100MB
- MessagePack: 35-40MB
- MessagePack + gzip: 15-20MB
- Protocol Buffers: 30-35MB
- CBOR: 38-42MB

**Trade-offs**:

- Not human-readable (debugging harder)
- Requires migration strategy for existing data
- Some formats (protobuf) need schema management

**Library Options**:

- `msgpackr`: Fast MessagePack with extensions (recommended)
- `protobufjs`: Protocol Buffers for JavaScript
- `cbor`: CBOR implementation
- `avro-js`: Apache Avro format

### Option 3: Chunking

**What it is**: Split large payloads into multiple database rows.

**Implementation Considerations**:

- Transaction boundaries (all chunks or none)
- Ordered reassembly required
- Cleanup of partial chunk sets
- Query complexity increases

**Chunk Size Strategy**:

- Fixed size: e.g., 1MB chunks
- Adapter-specific: Optimize per database
- Dynamic: Based on content type

**Trade-offs**:

- Multiple queries for read/write
- Storage overhead (duplicate metadata)
- Complex error handling
- Potential for orphaned chunks

### Option 4: External Storage

**What it is**: Store large payloads in object storage, keep references in database.

**Storage Providers**:

- **S3**: Most mature, 5GB single object limit
- **Azure Blob**: 4.75 TB block blob limit
- **Google Cloud Storage**: 5TB object limit
- **Cloudflare R2**: S3-compatible, no egress fees

**Threshold Strategy**:

- Size-based: >10MB goes external
- Cost-based: Optimize storage vs. egress costs
- Performance-based: Hot/cold data tiering

**Trade-offs**:

- Additional service dependency
- Network latency for reads
- Separate backup/recovery needed
- Cost considerations (storage + egress)

### Option 5: Streaming

**What it is**: Process data in chunks without loading entire payload in memory.

**Database Support**:

- **PostgreSQL**: COPY command, pg-query-stream
- **MongoDB**: GridFS streaming API
- **S3**: Multipart upload API
- **Most SQL DBs**: Limited streaming support for TEXT/BLOB

**Trade-offs**:

- Complex error handling mid-stream
- Transaction management challenges
- Not all adapters support streaming

### Option 6: Database-Native Large Object Support

**What it is**: Use database-specific features for large data.

**Options by Database**:

- **PostgreSQL**:
  - Switch from JSONB to JSON (TEXT): Supports up to 1GB, but loses JSONB indexing/querying
  - Large Objects (pg_largeobject table): Max 1GB, different API
  - TOAST: Automatic for TEXT, handles up to 1GB
- **MongoDB**: GridFS (file storage abstraction), 16MB document limit otherwise
- **DynamoDB**: No native large object support, must use S3 + reference pattern
- **MySQL**: LONGBLOB/LONGTEXT (4GB max)

**Trade-offs**:

- Completely different code per adapter
- Some databases have no solution
- Migration complexity between databases
- For PostgreSQL: Switching to JSON (TEXT) loses JSONB query performance benefits

## Combination Strategies

### Compression + Chunking

- Compress first to reduce size
- Chunk if still too large
- **Best for**: Databases with moderate limits (1-100MB)
- **Complexity**: Medium

### Binary Serialization + Compression

- MessagePack + gzip = maximum size reduction
- Can achieve 10-20x reduction combined
- **Best for**: When staying in database is priority
- **Complexity**: Low-Medium

### Tiered Storage (Size-based routing)

```typescript
if (size < 1MB) {
  // Store inline
} else if (size < 100MB) {
  // Compress and store
} else if (size < 1GB) {
  // Compress and chunk
} else {
  // External storage
}
```

- **Best for**: Mixed workload sizes
- **Complexity**: High

### Smart Serialization + External Storage

- Try compression first
- Fallback to external storage if needed
- **Best for**: Simplicity with escape hatch
- **Complexity**: Medium

## Key Considerations

### Implementation

- **Backward Compatibility**: Must handle existing uncompressed data with version markers
- **Performance**: Compression CPU overhead vs. storage/network savings
- **Storage Costs**: Compression reduces size but chunking increases row count
- **Migration Path**: How to transition existing deployments

### Operations

- **Monitoring**: Need metrics for payload sizes, compression ratios, failures
- **Debugging**: Compressed/chunked data harder to inspect, need tooling
- **Cost Analysis**: Balance storage costs vs. CPU costs vs. external service costs

## Open Questions

### Architecture Questions

1. **Where to implement?**
   - Core WorkflowsStorage base class (universal)?
   - Per-adapter implementation (optimized)?
   - Separate utility module (composable)?

2. **Configuration approach?**
   - Global settings vs per-workflow settings?
   - Runtime vs deployment-time configuration?
   - Fallback strategies when limits exceeded?

3. **Backward compatibility?**
   - How to handle existing uncompressed data?
   - Version markers in stored data?
   - Migration strategy (lazy vs eager)?

### Technical Questions

1. **Compression algorithm choice?**
   - Optimize for size or speed?
   - Different algorithms for different sizes?
   - Streaming vs buffer compression?

2. **Chunking strategy?**
   - Fixed vs variable chunk sizes?
   - How to handle partial chunk failures?
   - Transaction boundaries for chunks?

3. **External storage triggers?**
   - Size threshold only?
   - Cost-based decisions?
   - Performance-based routing?

## Next Steps

### Immediate Actions

1. ✅ Implemented `updateWorkflowResults` for incremental updates
2. ✅ Verified gradual accumulation limits (250MB → actually 256MB JSONB limit)
3. ✅ **Identified root cause**: PostgreSQL JSONB hard limit of 256MB (268,435,455 bytes)
4. ⏳ Evaluate switching PostgreSQL from JSONB to JSON (TEXT) storage
5. ⏳ Add similar safety checks to other adapters (especially DynamoDB)

### Experiments Needed

1. **Compression ratios** with real workflow data
2. **Memory usage** patterns under load
3. **Database performance** with different strategies (latency, throughput)
4. **Failure scenarios** and recovery testing
5. **Migration path** validation for existing deployments
6. **Cost analysis** of storage vs compute vs external services

### Long-term Solution

1. Choose solution strategy (likely combination approach)
2. Design universal interface in base class
3. Implement per-adapter optimizations
4. Create migration tooling for existing data
5. Add monitoring and observability
6. Update documentation and examples

## Code Locations

- **Base class**: `packages/core/src/storage/base.ts`
- **PostgreSQL implementation**: `stores/pg/src/storage/domains/workflows/index.ts`
- **Tests**: `stores/pg/src/storage/test-utils.ts` (Large Payload Handling section)

## Files Modified in PR #8415

- `stores/pg/src/storage/test-utils.ts` - New test file with large payload tests

## Investigation Timeline

- **Investigation started**: October 17, 2025
- **Scope expanded to all adapters**: October 17, 2025
- **PostgreSQL JSONB 256MB limit identified**: October 17, 2025
- **Document updated**: October 17, 2025

## Summary of Findings

### PostgreSQL Specific

1. **JSONB has a hard 256MB limit** - Cannot be worked around without changing data type
2. **Root cause**: PostgreSQL JSONB internal structure uses 32-bit offsets (2^28 = 268,435,456 bytes)
3. **Solutions for PostgreSQL**:
   - Switch to JSON (TEXT) storage: Up to 1GB but loses JSONB query benefits
   - Implement compression: Reduces payload size before hitting limit
   - Use chunking: Split data across multiple rows
   - External storage: Store large payloads in S3/blob storage

### Cross-Adapter Impact

- All adapters have size limits ranging from 400KB (DynamoDB) to 1GB+ (some databases)
- JavaScript layer adds V8 JSON.stringify limit (~500MB) for all adapters
- Each adapter needs specific handling based on its constraints
