# Storage Explorer

Universal data browser and editor for Mastra storage.

## Overview

The Storage Explorer allows you to browse, search, and edit data across all Mastra storage tables (except `mastra_traces`). It works with any Mastra storage provider including PostgreSQL, LibSQL, and Upstash.

## Features

- 📊 **Browse All Tables**: View data from all Mastra storage tables
- 🔍 **Search**: Search across all columns in a table
- 📄 **Pagination**: Navigate through large datasets (50 records per page)
- ✏️ **Edit**: View and edit individual records
- 🗑️ **Delete**: Remove records with confirmation
- 🔄 **Refresh**: Reload data on demand
- 🎨 **Beautiful UI**: Clean, responsive interface with loading states

## Usage

1. Navigate to `/storage` in the playground
2. Select a table from the dropdown
3. Browse the data
4. Use the search box to filter results
5. Click Edit or Delete icons to modify records

## Available Tables

- `mastra_workflow_snapshot` - Workflow execution snapshots
- `mastra_evals` - Evaluation results
- `mastra_messages` - Chat messages
- `mastra_threads` - Conversation threads
- `mastra_scorers` - Scoring results
- `mastra_ai_spans` - AI tracing spans
- `mastra_resources` - Resource records

## Component Structure

```
index.tsx (main component)
├── Header (title and description)
├── Controls (table selector, search, pagination)
├── Data Table (dynamic columns, actions)
└── Edit Dialog (modal for editing records)
```

## API Integration

Uses these endpoints:

- `GET /api/storage/tables` - Get available tables
- `GET /api/storage/tables/:tableName/data` - Get table data
- `DELETE /api/storage/tables/:tableName/record` - Delete record

## State Management

Uses React Query for data fetching:

```typescript
const { data, isLoading, refetch } = useQuery({
  queryKey: ['storage', 'table', selectedTable, page, perPage, search],
  queryFn: async () => { /* fetch data */ }
});
```

## Customization

### Change Records Per Page

```typescript
const [perPage] = useState(100); // Change from 50 to 100
```

### Add Custom Table Actions

```typescript
<TableCell>
  <div className="flex gap-2">
    <Button onClick={() => handleEdit(record)}>
      <Edit className="w-4 h-4" />
    </Button>
    <Button onClick={() => handleCustomAction(record)}>
      <CustomIcon className="w-4 h-4" />
    </Button>
  </div>
</TableCell>
```

### Customize Search Behavior

```typescript
const handleSearch = () => {
  // Add custom search logic
  setSearch(searchInput);
  setPage(0);
};
```

## Error Handling

The component handles:

- Loading states with skeleton loaders
- Empty states with helpful messages
- Error states with toast notifications
- Network errors with user feedback

## Dependencies

- `@tanstack/react-query` - Data fetching
- `lucide-react` - Icons
- `sonner` - Toast notifications
- UI components from `@/components/ui/*`

## Future Enhancements

- [ ] Complete edit functionality
- [ ] Export to CSV/JSON
- [ ] Batch operations
- [ ] Column sorting
- [ ] Advanced filters
- [ ] Custom views

## Troubleshooting

### No data showing

- Check if storage adapter is configured
- Verify table has data
- Check browser console for errors

### Search not working

- Ensure storage provider supports text search
- Check search query is valid
- Try refreshing the data

### Delete not available

- Only certain tables support deletion
- Ensure storage adapter has delete methods

## Related Files

- Backend: `packages/server/src/server/handlers/storage.ts`
- Router: `packages/deployer/src/server/handlers/routes/storage/`
- Docs: `/STORAGE_EXPLORER_IMPLEMENTATION.md`
