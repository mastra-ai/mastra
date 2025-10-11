import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { client } from '@/lib/client';
import { Search, RefreshCw, Edit, Trash2, Database } from 'lucide-react';
import { toast } from 'sonner';

interface Table {
  name: string;
  label: string;
}

interface StorageData {
  data: any[];
  pagination: {
    page: number;
    perPage: number;
    totalCount: number;
    totalPages: number;
  };
  message?: string;
}

export default function StorageExplorer() {
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [page, setPage] = useState(0);
  const [perPage] = useState(50);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Fetch available tables
  const { data: tablesData, isLoading: tablesLoading } = useQuery<{ tables: Table[] }>({
    queryKey: ['storage', 'tables'],
    queryFn: async () => {
      const response = await client.get('/api/storage/tables');
      return response.json();
    },
  });

  // Fetch table data
  const {
    data: tableData,
    isLoading: dataLoading,
    refetch,
  } = useQuery<StorageData>({
    queryKey: ['storage', 'table', selectedTable, page, perPage, search],
    queryFn: async () => {
      if (!selectedTable) return { data: [], pagination: { page: 0, perPage, totalCount: 0, totalPages: 0 } };
      
      const params = new URLSearchParams({
        page: page.toString(),
        perPage: perPage.toString(),
        ...(search && { search }),
      });
      
      const response = await client.get(`/api/storage/tables/${selectedTable}/data?${params}`);
      return response.json();
    },
    enabled: !!selectedTable,
  });

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(0);
  };

  const handleRefresh = () => {
    refetch();
    toast.success('Data refreshed');
  };

  const handleEdit = (record: any) => {
    setSelectedRecord(record);
    setEditDialogOpen(true);
  };

  const handleDelete = async (record: any) => {
    if (!confirm('Are you sure you want to delete this record?')) return;

    try {
      await client.delete(`/api/storage/tables/${selectedTable}/record`, {
        body: JSON.stringify({ id: record.id }),
      });
      toast.success('Record deleted successfully');
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete record');
    }
  };

  const renderValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (value instanceof Date) return value.toISOString();
    return String(value);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center gap-4">
          <Database className="w-8 h-8" />
          <div className="flex-1">
            <Text size="3" weight="medium">Storage Explorer</Text>
            <Text size="1" className="text-muted-foreground">
              Browse and edit data in your Mastra storage
            </Text>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="border-b p-4 space-y-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Table</label>
            <Select value={selectedTable} onValueChange={(value) => {
              setSelectedTable(value);
              setPage(0);
              setSearch('');
              setSearchInput('');
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a table" />
              </SelectTrigger>
              <SelectContent>
                {tablesData?.tables.map((table) => (
                  <SelectItem key={table.name} value={table.name}>
                    {table.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Search</label>
            <div className="flex gap-2">
              <Input
                placeholder="Search..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} size="icon">
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <Button onClick={handleRefresh} size="icon" variant="outline">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Pagination Info */}
        {tableData && tableData.data.length > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {page * perPage + 1} to {Math.min((page + 1) * perPage, tableData.pagination.totalCount)} of{' '}
              {tableData.pagination.totalCount} records
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(page + 1)}
                disabled={page >= tableData.pagination.totalPages - 1}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto p-4">
        {tablesLoading && (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {!selectedTable && !tablesLoading && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Database className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p>Select a table to view its data</p>
            </div>
          </div>
        )}

        {selectedTable && dataLoading && (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {selectedTable && !dataLoading && tableData && tableData.data.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center max-w-md">
              <p className="mb-2">No data found</p>
              {tableData.message && (
                <p className="text-sm text-muted-foreground/70">{tableData.message}</p>
              )}
            </div>
          </div>
        )}

        {selectedTable && !dataLoading && tableData && tableData.data.length > 0 && (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  {Object.keys(tableData.data[0]).map((key) => (
                    <TableHead key={key}>{key}</TableHead>
                  ))}
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.data.map((record, idx) => (
                  <TableRow key={idx}>
                    {Object.keys(record).map((key) => (
                      <TableCell key={key} className="max-w-xs truncate">
                        {renderValue(record[key])}
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(record)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(record)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Edit Record</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4">
              <pre className="bg-muted p-4 rounded-lg overflow-auto">
                {JSON.stringify(selectedRecord, null, 2)}
              </pre>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => {
                  toast.info('Edit functionality coming soon');
                  setEditDialogOpen(false);
                }}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
