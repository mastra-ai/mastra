import { useEffect, useRef, useState } from 'react';
import { Download, Pause, Play, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BuildStatusBadge } from './build-status-badge';
import { BuildProgress } from './build-progress';
import { cn } from '@/lib/utils';
import { BuildStatus } from '@/types/api';

interface BuildLogViewerProps {
  logs: string[];
  status: BuildStatus;
  className?: string;
  autoScroll?: boolean;
}

export function BuildLogViewer({ logs, status, className, autoScroll: initialAutoScroll = true }: BuildLogViewerProps) {
  const [autoScroll, setAutoScroll] = useState(initialAutoScroll);
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isActive = status === BuildStatus.BUILDING || status === BuildStatus.DEPLOYING || status === BuildStatus.QUEUED;

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
    const content = logs.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'build-logs.txt';
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
          <BuildStatusBadge status={status} />
          <span className="text-sm text-neutral6">{logs.length} lines</span>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <Button variant="ghost" size="sm" onClick={() => setPaused(!paused)}>
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {paused ? 'Resume' : 'Pause'}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <BuildProgress status={status} className="rounded-none" />

      {/* Log content */}
      <ScrollArea className="h-[500px]" ref={scrollRef} onScroll={handleScroll}>
        <pre className="p-4 font-mono text-xs text-neutral9 leading-relaxed">
          {logs.length === 0 && isActive && <span className="text-neutral6">Waiting for logs...</span>}
          {logs.length === 0 && !isActive && <span className="text-neutral6">No logs available</span>}
          {logs.map((line, index) => (
            <div key={index} className={cn('hover:bg-surface3', getLogLineClass(line))}>
              <span className="text-neutral3 mr-4 select-none">{String(index + 1).padStart(4, ' ')}</span>
              {line}
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

function getLogLineClass(line: string): string {
  const lowerLine = line.toLowerCase();
  if (lowerLine.includes('error') || lowerLine.includes('fail')) {
    return 'text-red-400';
  }
  if (lowerLine.includes('warn')) {
    return 'text-yellow-400';
  }
  if (lowerLine.includes('success') || lowerLine.includes('done') || lowerLine.includes('completed')) {
    return 'text-green-400';
  }
  return '';
}
