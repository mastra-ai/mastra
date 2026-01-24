import { useEffect, useRef, useState } from 'react';
import { Download, Pause, Play, ArrowDown, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface LogLine {
  line: string;
  timestamp: string;
  stream: 'stdout' | 'stderr';
}

interface ServerLogsViewerProps {
  logs: LogLine[];
  isConnected?: boolean;
  className?: string;
}

export function ServerLogsViewer({ logs, isConnected = false, className }: ServerLogsViewerProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && !paused && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll, paused]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setAutoScroll(isNearBottom);
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setAutoScroll(true);
  };

  const handleDownload = () => {
    const content = logs.map(log => `[${log.timestamp}] [${log.stream}] ${log.line}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'server-logs.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn('flex flex-col rounded-lg border border-border bg-surface1', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface2">
        <div className="flex items-center gap-3">
          <Terminal className="h-4 w-4 text-neutral6" />
          <span className="text-sm font-medium">Server Logs</span>
          <Badge variant={isConnected ? 'success' : 'secondary'}>{isConnected ? 'Live' : 'Disconnected'}</Badge>
          <span className="text-xs text-neutral6">{logs.length} lines</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setPaused(!paused)}>
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
        </div>
      </div>

      {/* Log content */}
      <ScrollArea className="h-[400px]" ref={scrollRef} onScroll={handleScroll}>
        <pre className="p-4 font-mono text-xs leading-relaxed">
          {logs.length === 0 && <span className="text-neutral6">Waiting for logs...</span>}
          {logs.map((log, index) => (
            <div key={index} className="hover:bg-surface3 flex">
              <span className="text-neutral3 w-28 flex-shrink-0 select-none">
                {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
              </span>
              <span className={cn('w-12 flex-shrink-0', log.stream === 'stderr' ? 'text-red-400' : 'text-neutral6')}>
                {log.stream}
              </span>
              <span className={cn(log.stream === 'stderr' ? 'text-red-400' : 'text-neutral9')}>{log.line}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </pre>
      </ScrollArea>

      {/* Scroll to bottom button */}
      {!autoScroll && (
        <Button variant="outline" size="sm" className="absolute bottom-4 right-4" onClick={scrollToBottom}>
          <ArrowDown className="h-4 w-4 mr-1" />
          Scroll to bottom
        </Button>
      )}
    </div>
  );
}
