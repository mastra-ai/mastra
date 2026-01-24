import { useState, useRef, useEffect } from 'react';
import { Search, Download, RefreshCw, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import type { Log } from '@/types/api';
import { cn } from '@/lib/utils';

const levelConfig: Record<Log['level'], { color: string; bgColor: string }> = {
  debug: { color: 'text-neutral6', bgColor: 'bg-neutral6' },
  info: { color: 'text-blue-400', bgColor: 'bg-blue-600' },
  warn: { color: 'text-yellow-400', bgColor: 'bg-yellow-600' },
  error: { color: 'text-red-400', bgColor: 'bg-red-600' },
};

interface LogViewerProps {
  logs: Log[];
  loading?: boolean;
  onRefresh?: () => void;
  onSearch?: (query: string) => void;
  onLevelFilter?: (level: Log['level'] | 'all') => void;
}

export function LogViewer({ logs, loading = false, onRefresh, onSearch, onLevelFilter }: LogViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<Log['level'] | 'all'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchQuery);
  };

  const handleDownload = () => {
    const content = logs
      .map(
        log =>
          `[${format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss.SSS')}] [${log.level.toUpperCase()}] ${log.message}`,
      )
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'logs.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full rounded-lg border border-border bg-surface1">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b border-border bg-surface2">
        <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral6" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </form>

        <Select
          value={selectedLevel}
          onValueChange={(value: Log['level'] | 'all') => {
            setSelectedLevel(value);
            onLevelFilter?.(value);
          }}
        >
          <SelectTrigger className="w-32">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="debug">Debug</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="icon" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>

        <Button variant="outline" size="icon" onClick={handleDownload}>
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* Log content */}
      <ScrollArea className="flex-1 h-[500px]" ref={scrollRef}>
        <div className="p-4 font-mono text-xs space-y-1">
          {logs.length === 0 ? (
            <div className="text-neutral6 text-center py-8">No logs to display</div>
          ) : (
            logs.map(log => {
              const levelInfo = levelConfig[log.level];
              return (
                <div key={log.id} className="flex items-start gap-3 hover:bg-surface3 px-2 py-1 rounded">
                  <span className="text-neutral3 w-40 flex-shrink-0">
                    {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
                  </span>
                  <Badge className={cn('w-14 justify-center text-xs', levelInfo.bgColor)}>
                    {log.level.toUpperCase()}
                  </Badge>
                  <span className={cn('flex-1 break-all', levelInfo.color)}>{log.message}</span>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-surface2 text-sm text-neutral6">
        <span>{logs.length} entries</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={e => setAutoScroll(e.target.checked)}
            className="rounded border-border"
          />
          Auto-scroll
        </label>
      </div>
    </div>
  );
}
