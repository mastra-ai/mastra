'use client';

import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { cn } from '@/lib/utils';

import { RenderMetadata, statusColors } from '@/domains/logs/components/render-metadata';
import { getAgentLogs } from '@/domains/workflows/actions';

type LogEntry = {
  message: string;
  metadata: any;
  agentId: string;
};

const statusOptions = [
  { value: 'all', label: 'All' },
  { value: 'info', label: 'Info' },
  { value: 'requires_action', label: 'Requires Action' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

export default function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [expandedLogs, setExpandedLogs] = useState<Record<number, boolean>>({});
  const [activeStatus, setActiveStatus] = useState('all');
  const [activeAgentId, setActiveAgentId] = useState<string>('all');
  const [agentIds, setAgentIds] = useState<string[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      const fetchedLogs = await getAgentLogs();
      setLogs(fetchedLogs);
      setExpandedLogs(fetchedLogs.reduce((acc, _, index) => ({ ...acc, [index]: false }), {}));
      const uniqueAgentIds = Array.from(new Set(fetchedLogs.map(log => log.agentId)));
      setAgentIds(['all', ...uniqueAgentIds]);
    };
    fetchLogs();
  }, []);

  const toggleExpand = (index: number) => {
    setExpandedLogs(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const filteredLogs = logs
    .filter(log => log.message.toLowerCase().includes(filter.toLowerCase()))
    .filter(
      log =>
        activeStatus === 'all' ||
        log.metadata.run?.status === activeStatus ||
        (activeStatus === 'info' && !log.metadata.run?.status),
    )
    .filter(log => activeAgentId === 'all' || log.agentId === activeAgentId);

  return (
    <section className="p-6 min-h-screen text-gray-200">
      <h3 className="text-2xl font-bold text-white mb-6">Logs</h3>
      <div className="mb-4 space-y-4">
        <div className="flex items-center gap-4">
          <Input
            type="text"
            placeholder="Filter logs..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="bg-mastra-bg-2 border-mastra-bg-4 h-9 flex-grow"
          />
          <div className="flex-shrink-0">
            <Select value={activeAgentId} onValueChange={setActiveAgentId}>
              <SelectTrigger className="w-[350px] h-9 bg-mastra-bg-2 border-mastra-bg-4">
                <SelectValue placeholder="Select Agent" />
              </SelectTrigger>
              <SelectContent className="w-[350px]">
                {agentIds.map(id => (
                  <SelectItem key={id} value={id}>
                    {id === 'all' ? 'All Agents' : `Agent ${id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map(option => (
            <Button
              key={option.value}
              variant={activeStatus === option.value ? 'primary' : 'outline'}
              onClick={() => setActiveStatus(option.value)}
              className="px-3 py-1 text-sm"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
      <ScrollArea className="h-[calc(100vh-200px)]">
        <AnimatePresence>
          {filteredLogs.map((log, index) => {
            const timestamp = log?.metadata?.timestamp; // TODO: properly type logo
            const formattedTimestamp = format(new Date(timestamp * 1000), 'HH:mm:ss:SSS'); // TODO: format timestamp well

            // TODO: clean this up
            if (log.message === 'Run requires further action') {
              return null;
            }

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="bg-mastra-bg-1 shadow-md overflow-hidden border border-mastra-bg-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full gap-4 flex items-center font-light justify-start hover:bg-mastra-bg-5 transition-colors"
                          onClick={() => toggleExpand(index)}
                        >
                          <span className="text-xs">{formattedTimestamp}</span>
                          <span className="text-xs w-72 truncate text-left">{log.message}</span>
                          {/*TODO: show full message on hover log.message*/}
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-light text-white">
                              Agent {String(log.agentId).substring(log.agentId.length - 6)}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn(
                                'font-light rounded-sm px-3 py-1',
                                statusColors[log.metadata.run?.status || 'info'],
                              )}
                            >
                              {log.metadata.run?.status || 'Info'}
                            </Badge>
                          </div>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{expandedLogs[index] ? 'Collapse' : 'Expand'}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <AnimatePresence>
                    {expandedLogs[index] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 bg-mastra-bg-5 border-t border-mastra-bg-4">
                          <RenderMetadata metadata={log.metadata} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </ScrollArea>
    </section>
  );
}
