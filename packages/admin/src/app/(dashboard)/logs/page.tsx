'use client';

import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { cn } from '@/lib/utils';

import Icon from '@/app/components/icon';
import { InfoItem, RenderMetadata, statusColors } from '@/domains/logs/components/render-metadata';
import { Log } from '@/domains/logs/types';
import { getAgentLogs } from '@/domains/workflows/actions';

const statusOptions = [
  { value: 'all', label: 'All' },
  { value: 'info', label: 'Info' },
  { value: 'requires_action', label: 'Requires Action' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

export default function Logs() {
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<Log[]>([]);
  const [filter, setFilter] = useState('');
  const [activeStatus, setActiveStatus] = useState('all');
  const [logId, setLogId] = useState<string>('all');
  const [logIds, setLogIds] = useState<string[]>([]);
  const [selectedLogIndex, setSelectedLogIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      const fetchedLogs = await getAgentLogs();
      setLogs(fetchedLogs);
      setIsLoading(false);
      const uniqueLogIds = Array.from(new Set(fetchedLogs.map(log => log.logId)));
      setLogIds(['all', ...uniqueLogIds]);
    };
    fetchLogs();
  }, []);

  const filteredLogs = logs
    .filter(log => log.message.toLowerCase().includes(filter.toLowerCase()))
    .filter(
      log =>
        activeStatus === 'all' ||
        log.metadata.run?.status === activeStatus ||
        (activeStatus === 'info' && !log.metadata.run?.status),
    )
    .filter(log => logId === 'all' || log.logId === logId);

  const logsLength = filteredLogs.length;
  const searchPlaceholder = `${
    logsLength > 0 ? `${logsLength} total log${logsLength > 1 ? 's' : ''} found` : 'Search logs'
  }...`;

  const openLogDetails = (index: number) => {
    setSelectedLogIndex(index);
  };

  const closeLogDetails = () => {
    setSelectedLogIndex(null);
  };

  const navigateLog = (direction: 'prev' | 'next') => {
    if (selectedLogIndex === null) return;
    const newIndex = direction === 'prev' ? selectedLogIndex - 1 : selectedLogIndex + 1;
    if (newIndex >= 0 && newIndex < filteredLogs.length) {
      setSelectedLogIndex(newIndex);
    }
  };

  const emptyLoaderArr = Array.from({ length: 25 });

  const isLogSelected = selectedLogIndex !== null;

  return (
    <TooltipProvider>
      <section className="p-6 min-h-screen text-gray-200">
        <h3 className="text-2xl font-bold text-white mb-6">Logs</h3>
        <div className="mb-4 space-y-4">
          <div className="flex items-center gap-4">
            <Input
              type="text"
              placeholder={searchPlaceholder}
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="bg-mastra-bg-2 border-mastra-bg-4 h-9 flex-grow"
            />
            <div className="flex-shrink-0">
              <Select value={logId} onValueChange={setLogId}>
                <SelectTrigger className="w-[350px] h-9 bg-mastra-bg-2 border-mastra-bg-4">
                  <SelectValue placeholder="Select Agent" />
                </SelectTrigger>
                <SelectContent className="w-[350px]">
                  {logIds.map(id => (
                    <SelectItem key={id} value={id}>
                      {id === 'all' ? 'All Logs' : `Log ${id}`}
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
                className="px-4 py-[3px] font-light text-xs"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="bg-mastra-bg-1 text-gray-400 gap-4 flex h-12 px-4 text-xs font-light items-center">
          <span className="w-[120px]">Time</span>
          <span className="w-12">Code</span>
          <span className="w-96">Message</span>
          <span className="w-24">Log ID</span>
          <span className="w-24">Run status</span>
        </div>
        <ScrollArea className="h-[calc(100vh-250px)] relative">
          {isLoading ? (
            <div className="space-y-1 mt-0.5">
              {emptyLoaderArr.map((_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          ) : (
            <>
              {logsLength > 0 ? (
                <AnimatePresence>
                  {filteredLogs.map((log, index) => {
                    const timestamp = log?.createdAt;
                    const formattedTimestamp = format(new Date(timestamp), 'MMM dd HH:mm:ss.SS');

                    if (log.message === 'Run requires further action') {
                      return null;
                    }

                    const isSuccessCode = log.statusCode?.toString().startsWith('2');
                    const isReadyCode = log.statusCode?.toString().startsWith('1');
                    const isErrorCode = log.statusCode?.toString().startsWith('4');

                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="bg-mastra-bg-2 shadow-md overflow-hidden border border-mastra-bg-1">
                          <Button
                            variant="ghost"
                            className={cn(
                              'w-full gap-4 flex h-9 items-center font-light justify-start hover:bg-mastra-bg-4 transition-colors',
                              selectedLogIndex === index && 'bg-mastra-bg-4',
                            )}
                            onClick={() => openLogDetails(index)}
                          >
                            <span className="text-xs text-left w-[120px]">{formattedTimestamp}</span>
                            <span
                              className={cn('font-light w-12 text-left rounded-sm text-xs py-1', {
                                'text-green-600': isSuccessCode,
                                'text-blue-600': isReadyCode,
                                'text-red-600': isErrorCode,
                              })}
                            >
                              {log.statusCode}
                            </span>
                            <Tooltip>
                              <TooltipTrigger>
                                <div className="text-xs w-96 truncate text-left">{log.message}</div>
                              </TooltipTrigger>
                              <TooltipContent>{log.message}</TooltipContent>
                            </Tooltip>
                            <div className="flex items-center gap-2 w-64">
                              <Badge variant="outline" className="font-light text-white">
                                Log {String(log.logId).substring(log.logId.length - 6)}
                              </Badge>
                              <span
                                className={cn(
                                  'font-light rounded-sm text-xs px-3 py-1',
                                  statusColors[log.metadata.run?.status || 'info'],
                                )}
                              >
                                {log.metadata.run?.status || 'Info'}
                              </span>
                            </div>
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              ) : (
                <div className="text-gray-500 text-center flex items-center justify-center flex-col h-[calc(100vh-250px)]">
                  <div className="border border-gray-500 p-2 rounded-md inline-block">
                    <Icon name="logs" className="w-8 h-8" />
                  </div>
                  <p className="text-sm font-light mt-2">There are no logs</p>
                </div>
              )}
            </>
          )}
          <Sheet modal={false} open={selectedLogIndex !== null} onOpenChange={closeLogDetails}>
            <SheetContent
              side="right"
              className="w-[540px] p-0 mt-[245px] right-[33px] border-t border-border bg-mastra-bg-1 h-[calc(100vh-250px)] text-white"
            >
              <div className="flex p-4 border-b border-border items-center justify-between">
                <Tooltip>
                  <TooltipTrigger>
                    <div className="text-[13px] text-gray-400 w-56 truncate">
                      {isLogSelected && filteredLogs[selectedLogIndex].message}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{isLogSelected && filteredLogs[selectedLogIndex].message}</TooltipContent>
                </Tooltip>
                <div className="text-gray-500 flex justify-end">
                  <button
                    className="hover:text-white disabled:cursor-not-allowed transition-colors p-2 rounded-sm"
                    onClick={() => navigateLog('prev')}
                    disabled={selectedLogIndex === 0}
                  >
                    <Icon name="chevron-up" />
                  </button>
                  <button
                    className="hover:text-white disabled:cursor-not-allowed transition-colors p-2 rounded-sm"
                    onClick={() => navigateLog('next')}
                    disabled={selectedLogIndex === filteredLogs.length - 1}
                  >
                    <Icon className="rotate-180 transform" name="chevron-up" />
                  </button>
                  <div className="bg-gray-500 h-5 m-2 w-[1px]"></div>
                  <SheetClose className="hover:text-white p-2 transition-colors">
                    <Icon name="cancel" />
                    <span className="sr-only">Close</span>
                  </SheetClose>
                </div>
              </div>
              <ScrollArea className="h-[65vh]">
                <div className="mt-1 space-y-4 p-4">
                  {selectedLogIndex !== null && (
                    <>
                      <InfoItem
                        label="Time"
                        value={format(filteredLogs[selectedLogIndex].createdAt, 'MMMM dd HH:mm:ss.SS')}
                      />{' '}
                      <RenderMetadata metadata={filteredLogs[selectedLogIndex].metadata} />
                    </>
                  )}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </ScrollArea>
      </section>
    </TooltipProvider>
  );
}
