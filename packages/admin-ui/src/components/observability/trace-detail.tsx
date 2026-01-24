import { useState } from 'react';
import { CheckCircle2, XCircle, Circle, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SpanTree } from './span-tree';
import { format } from 'date-fns';
import type { Trace, Span } from '@/types/api';
import { cn } from '@/lib/utils';

const statusConfig: Record<
  Trace['status'],
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  ok: { icon: CheckCircle2, color: 'text-green-500', label: 'Success' },
  error: { icon: XCircle, color: 'text-red-500', label: 'Error' },
  unset: { icon: Circle, color: 'text-neutral6', label: 'Unset' },
};

interface TraceDetailProps {
  trace: Trace;
  spans: Span[];
}

export function TraceDetail({ trace, spans }: TraceDetailProps) {
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);
  const statusInfo = statusConfig[trace.status];
  const StatusIcon = statusInfo.icon;

  const formatDuration = (ms: number | null) => {
    if (ms === null) return '-';
    if (ms < 1) return '<1ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="space-y-6">
      {/* Trace header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <StatusIcon className={cn('h-5 w-5', statusInfo.color)} />
              {trace.name}
            </CardTitle>
            <Badge variant={trace.status === 'error' ? 'destructive' : trace.status === 'ok' ? 'success' : 'secondary'}>
              {statusInfo.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-neutral6">Trace ID</div>
              <div className="font-mono text-sm truncate">{trace.traceId}</div>
            </div>
            <div>
              <div className="text-sm text-neutral6">Duration</div>
              <div className="font-mono">{formatDuration(trace.durationMs)}</div>
            </div>
            <div>
              <div className="text-sm text-neutral6">Started</div>
              <div className="text-sm">{format(new Date(trace.startTime), 'MMM d, yyyy HH:mm:ss.SSS')}</div>
            </div>
            <div>
              <div className="text-sm text-neutral6">Spans</div>
              <div>{spans.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Span tree and detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Span tree */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Spans</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <SpanTree spans={spans} selectedSpanId={selectedSpan?.spanId} onSelectSpan={setSelectedSpan} />
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Span detail */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Span Detail</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedSpan ? (
              <Tabs defaultValue="attributes">
                <TabsList className="w-full">
                  <TabsTrigger value="attributes" className="flex-1">
                    Attributes
                  </TabsTrigger>
                  <TabsTrigger value="events" className="flex-1">
                    Events
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="attributes">
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-4 pt-4">
                      <div>
                        <div className="text-sm text-neutral6">Name</div>
                        <div className="font-medium">{selectedSpan.name}</div>
                      </div>
                      <div>
                        <div className="text-sm text-neutral6">Span ID</div>
                        <div className="font-mono text-sm">{selectedSpan.spanId}</div>
                      </div>
                      <div>
                        <div className="text-sm text-neutral6">Duration</div>
                        <div className="font-mono">{formatDuration(selectedSpan.durationMs)}</div>
                      </div>
                      {Object.entries(selectedSpan.attributes).length > 0 && (
                        <div>
                          <div className="text-sm text-neutral6 mb-2">Attributes</div>
                          <div className="space-y-1">
                            {Object.entries(selectedSpan.attributes).map(([key, value]) => (
                              <div key={key} className="flex items-start gap-2 text-sm">
                                <Tag className="h-3 w-3 mt-1 text-neutral6" />
                                <span className="text-neutral6">{key}:</span>
                                <span className="font-mono break-all">{JSON.stringify(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="events">
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3 pt-4">
                      {selectedSpan.events.length === 0 ? (
                        <div className="text-sm text-neutral6">No events</div>
                      ) : (
                        selectedSpan.events.map((event, index) => (
                          <div key={index} className="border border-border rounded-md p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{event.name}</span>
                              <span className="text-xs text-neutral6">
                                {format(new Date(event.timestamp), 'HH:mm:ss.SSS')}
                              </span>
                            </div>
                            {Object.entries(event.attributes).length > 0 && (
                              <div className="space-y-1">
                                {Object.entries(event.attributes).map(([key, value]) => (
                                  <div key={key} className="text-sm">
                                    <span className="text-neutral6">{key}: </span>
                                    <span className="font-mono">{JSON.stringify(value)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-neutral6">
                Select a span to view details
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
