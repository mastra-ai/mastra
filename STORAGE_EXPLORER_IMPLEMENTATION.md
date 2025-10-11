# Storage Explorer Implementation

This document describes the new Storage Explorer feature added to the Mastra playground.

## Overview

The Storage Explorer provides a universal data browser and editor for all Mastra storage tables (excluding `mastra_traces`). It works with any storage provider (PostgreSQL, LibSQL, Upstash, etc.) and allows users to navigate, search, and edit data directly from the playground.

## Features

- **Table Navigation**: Browse all available storage tables
- **Data Viewing**: Paginated view of table data (50 records per page)
- **Search**: Search across all columns in a table
- **Edit**: View and edit individual records (UI implemented, backend ready)
- **Delete**: Delete records from supported tables (threads, messages)
- **Universal Compatibility**: Works with any Mastra storage provider

## Architecture

### Backend Components

#### 1. Server Handlers (`packages/server/src/server/handlers/storage.ts`)

Core handler functions that interact with the storage layer:

- `getTablesHandler()` - Returns list of available tables
- `getTableDataHandler()` - Fetches paginated table data with search
- `getRecordHandler()` - Retrieves a single record by keys
- `updateRecordHandler()` - Updates a record (uses insert/upsert)
- `deleteRecordHandler()` - Deletes a record (limited to specific tables)
- `queryTableHandler()` - Generic query interface (extensible)

**Key Design Decisions:**
- Excludes `mastra_traces` table for security/performance
- Attempts to use underlying database connection for querying
- Falls back gracefully when direct querying isn't available
- Validates table names to prevent SQL injection

#### 2. Deployer Router (`packages/deployer/src/server/handlers/routes/storage/`)

Exposes storage operations via HTTP endpoints:

**Endpoints:**
- `GET /api/storage/tables` - List all tables
- `GET /api/storage/tables/:tableName/data` - Get table data (with pagination & search)
- `POST /api/storage/tables/:tableName/record` - Get single record
- `PUT /api/storage/tables/:tableName/record` - Update record
- `DELETE /api/storage/tables/:tableName/record` - Delete record
- `GET /api/storage/tables/:tableName/query` - Generic query interface

All routes use OpenAPI documentation via `hono-openapi`.

### Frontend Components

#### Storage Explorer Page (`packages/playground/src/pages/storage/index.tsx`)

Main UI component with the following sections:

1. **Header**
   - Database icon and title
   - Brief description

2. **Controls**
   - Table selector dropdown
   - Search input with button
   - Refresh button
   - Pagination controls

3. **Data Table**
   - Dynamic columns based on table schema
   - Action buttons (Edit, Delete) per row
   - Handles different data types (objects, dates, booleans)
   - Empty states with helpful messages

4. **Edit Dialog**
   - Modal for viewing/editing records
   - JSON preview of record data
   - Save/Cancel actions

**UI/UX Features:**
- Loading skeletons during data fetch
- Empty state guidance
- Error handling with toast notifications
- Responsive design
- Accessible keyboard navigation

#### Sidebar Integration (`packages/playground/src/components/ui/app-sidebar.tsx`)

Added "Storage" link to the main navigation sidebar with Database icon.

#### Routing (`packages/playground/src/App.tsx`)

Registered `/storage` route with the Layout component.

## Tables Available

The Storage Explorer provides access to these Mastra tables:

1. **mastra_workflow_snapshot** - Workflow execution snapshots
2. **mastra_evals** - Evaluation results
3. **mastra_messages** - Chat messages
4. **mastra_threads** - Conversation threads
5. **mastra_scorers** - Scoring results
6. **mastra_ai_spans** - AI tracing spans (if supported)
7. **mastra_resources** - Resource records (if supported by storage adapter)

**Excluded:** `mastra_traces` - omitted for security and to avoid overwhelming the UI

## Storage Provider Compatibility

### Current Implementation

The storage handlers attempt to query data using the underlying database connection:

```typescript
// Checks for common database client properties
if (storage.db || storage.client || storage.connection) {
  const db = storage.db || storage.client || storage.connection;
  
  // Uses common query methods
  if (typeof db.execute === 'function' || typeof db.query === 'function') {
    // Execute SQL queries
  }
}
```

### Supported Storage Adapters

The implementation should work with:

- **PostgreSQL** (`@mastra/pg`)
- **LibSQL** (`@mastra/libsql`) 
- **Upstash** (`@mastra/upstash`)
- Any SQL-based storage adapter with `db.execute()` or `db.query()`

### Extending Support

To add support for a new storage adapter:

1. Ensure the storage instance exposes a `db`, `client`, or `connection` property
2. Implement `execute()` or `query()` method that accepts SQL strings
3. Return results in format: `{ rows: [...] }` or `[...]`

Alternatively, implement custom query logic in `getTableDataHandler()` for your specific adapter.

## Usage

### Accessing the Storage Explorer

1. Start the Mastra playground: `pnpm dev`
2. Navigate to the "Storage" link in the sidebar
3. Select a table from the dropdown
4. Browse, search, and interact with your data

### Searching Data

1. Select a table
2. Enter search term in the search box
3. Click the search icon or press Enter
4. Results are filtered across all columns

### Viewing Records

All records are displayed in a table with:
- Column names as headers
- Formatted values (JSON stringified for objects)
- Truncated long text (hover to see full content)

### Editing Records

1. Click the Edit icon on any record
2. View the full JSON representation
3. Edit the JSON (functionality to be completed)
4. Save changes

### Deleting Records

1. Click the Delete icon on any record
2. Confirm the deletion
3. Record is removed from the database

**Note:** Deletion is only available for tables that support it (threads, messages with deleteMessages support)

## Security Considerations

1. **SQL Injection Protection**
   - Table names are validated against a whitelist
   - User input should be parameterized (current implementation needs improvement)

2. **Access Control**
   - Inherits Mastra's authentication/authorization middleware
   - All routes go through standard security checks

3. **Excluded Tables**
   - `mastra_traces` is deliberately excluded
   - Can be configured to exclude other sensitive tables

## Future Enhancements

### High Priority

1. **Edit Functionality**
   - JSON editor with validation
   - Field-by-field editing UI
   - Type-aware input fields

2. **Better Search**
   - Column-specific search
   - Filter by date ranges
   - Advanced query builder

3. **SQL Injection Protection**
   - Parameterized queries
   - Prepared statements

### Medium Priority

4. **Export Data**
   - CSV export
   - JSON export
   - Copy to clipboard

5. **Batch Operations**
   - Bulk delete
   - Bulk update

6. **Data Visualization**
   - Record count charts
   - Data distribution graphs

### Low Priority

7. **Custom Views**
   - Save favorite queries
   - Custom column selection
   - Sorting by column

8. **Real-time Updates**
   - WebSocket integration
   - Auto-refresh option

## Testing

### Manual Testing Checklist

- [ ] Navigate to /storage page
- [ ] Select each table from dropdown
- [ ] Verify data loads correctly
- [ ] Test pagination (next/previous)
- [ ] Test search functionality
- [ ] Test edit dialog opens
- [ ] Test delete with confirmation
- [ ] Test refresh button
- [ ] Test with empty tables
- [ ] Test with different storage providers (PG, LibSQL, etc.)

### Integration Testing

Create integration tests for:
- API endpoints in `packages/server/src/server/handlers/storage.test.ts`
- React components in `packages/playground/src/pages/storage/index.test.tsx`
- End-to-end flows with different storage adapters

## Known Limitations

1. **Generic Query Implementation**
   - Current implementation uses string concatenation for SQL
   - Should be replaced with parameterized queries

2. **Storage Adapter Dependency**
   - Relies on storage adapters exposing their database connection
   - May not work with all custom storage implementations

3. **Search Limitations**
   - Basic text search only
   - No column-specific filtering
   - Performance may be poor on large tables

4. **Edit Functionality**
   - UI shows JSON but doesn't handle editing yet
   - Needs validation and type checking

5. **No Audit Trail**
   - Edits and deletes aren't logged
   - No way to undo operations

## Troubleshooting

### "No data available" message

**Cause:** Storage adapter doesn't expose database connection or uses unsupported query interface

**Solution:** 
1. Check if storage adapter has `db`, `client`, or `connection` property
2. Verify it has `execute()` or `query()` method
3. Implement custom query logic for your adapter

### Tables not showing up

**Cause:** Storage adapter doesn't support certain tables

**Solution:** Check `storage.supports` flags (e.g., `resourceWorkingMemory`, `aiTracing`)

### Search not working

**Cause:** Current search implementation uses basic SQL LIKE

**Solution:** Implement more robust search for your specific database

## Contributing

When contributing to the Storage Explorer:

1. Follow existing code patterns
2. Add TypeScript types for all new functions
3. Document new endpoints with OpenAPI specs
4. Update this README with new features
5. Add tests for new functionality
6. Consider backward compatibility with existing storage adapters

## Related Files

### Backend
- `packages/server/src/server/handlers/storage.ts`
- `packages/server/src/server/handlers.ts`
- `packages/deployer/src/server/handlers/routes/storage/handlers.ts`
- `packages/deployer/src/server/handlers/routes/storage/router.ts`
- `packages/deployer/src/server/index.ts`

### Frontend
- `packages/playground/src/pages/storage/index.tsx`
- `packages/playground/src/App.tsx`
- `packages/playground/src/components/ui/app-sidebar.tsx`

### Core
- `packages/core/src/storage/base.ts`
- `packages/core/src/storage/constants.ts`
- `packages/core/src/storage/types.ts`
