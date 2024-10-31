'use client';

import { LogProvider, type LogConfig } from '@mastra/core';
import { Popover, PopoverTrigger } from '@radix-ui/react-popover';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

import Icon from '@/components/icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

import { saveLogsConfig } from '@/domains/logs/actions';
import { InfoItem, RenderMetadata, statusColors } from '@/domains/logs/components/render-metadata';
import { useLogContext } from '@/domains/logs/providers/log-provider';

const statusOptions = [
  { value: 'all', label: 'All' },
  { value: 'info', label: 'Info' },
  { value: 'requires_action', label: 'Requires Action' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

const logsConfig = [
  { name: 'Console', value: 'CONSOLE' },
  { name: 'File', value: 'FILE' },
  { name: 'Upstash', value: 'UPSTASH' },
];

function strToLogLevel(str: string): LogLevel {
  const enumKey = str.includes('.') ? str.split('.')[1] : str;

  if (enumKey in LogLevel) {
    return LogLevel[enumKey as keyof typeof LogLevel];
  }

  throw new Error(`Invalid log level: ${str}`);
}

enum LogLevel {
  DEBUG,
  INFO,
  WARN,
  ERROR,
}

export default function LogsClientLayout({
  defaultLogOptions,
  logLevelOptions,
  defaultUpstashConfig,
}: {
  defaultLogOptions: { provider: LogConfig['provider']; level: string };
  logLevelOptions: Array<{ name: string; value: LogLevel }>;
  defaultUpstashConfig: { url: string; apiKey: string };
}) {
  const [selectedLogsConfig, setSelectedLogsConfig] = useState(defaultLogOptions.provider);
  const [selectedLogLevel, setSelectedLogLevel] = useState(
    strToLogLevel(defaultLogOptions.level as string) || logLevelOptions[0].value,
  );
  const [upstashUrl, setUpstashUrl] = useState('');
  const [upstashApiKey, setUpstashApiKey] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function loadUpstashConfig() {
      if (selectedLogsConfig === 'UPSTASH') {
        setUpstashUrl(defaultUpstashConfig.url);
        setUpstashApiKey(defaultUpstashConfig.apiKey);
      }
    }

    loadUpstashConfig();
  }, [defaultUpstashConfig.apiKey, defaultUpstashConfig.url, selectedLogsConfig]);

  const {
    isLoading,
    filter,
    activeStatus,
    logId,
    logIds,
    selectedLogIndex,
    openLogDetails,
    closeLogDetails,
    navigateLog,
    setFilter,
    setActiveStatus,
    setLogId,
    filteredLogs,
  } = useLogContext();

  const logsLength = filteredLogs.length;

  const searchPlaceholder = `${
    logsLength > 0 ? `${logsLength} total log${logsLength > 1 ? 's' : ''} found` : 'Search logs'
  }...`;

  const emptyLoaderArr = Array.from({ length: 25 });
  const isLogSelected = selectedLogIndex !== null;

  const saveLogConfig = async () => {
    if (selectedLogsConfig === 'UPSTASH') {
      if (!upstashUrl || !upstashApiKey) {
        return toast.error('Please enter the Upstash URL and API Key', {
          position: 'top-right',
        });
      }
      await saveLogsConfig({
        provider: selectedLogsConfig as 'CONSOLE' | 'UPSTASH' | 'FILE',
        level: selectedLogLevel,
        config: {
          url: upstashUrl,
          token: upstashApiKey,
        },
      });
    } else {
      await saveLogsConfig({
        provider: selectedLogsConfig as 'CONSOLE' | 'FILE',
        level: selectedLogLevel,
      });
    }

    toast.success('Logs config saved', {
      position: 'top-right',
    });

    setOpen(false);
  };

  return (
    <section className="min-h-screen text-gray-200">
      <h1 className="text-sm text-mastra-el-5 sticky top-0 bg-mastra-bg-3 capitalize border-b-mastra-border-1 border-b-[0.5px] py-3 p-4">
        Logs
      </h1>
      <div className="pl-4 p-6">
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
                      {id === 'all' ? 'All Logs' : `${id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex flex-wrap gap-2">
              {statusOptions.map(option => (
                <Button
                  key={option.value}
                  variant={activeStatus === option.value ? 'primary' : 'outline'}
                  onClick={() => setActiveStatus(option.value)}
                  className="h-[26px] text-xs"
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Log Provider:</span>

              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="rounded-md text-xs border-mastra-border-1 h-[26px] bg-mastra-bg-5 px-2 py-1"
                  >
                    Configure logs
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" avoidCollisions={true} className="p-0 text-white border-none py-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-col pt-0 p-3 gap-2">
                      <p className="text-xs text-white">Log Provider:</p>
                      <Select
                        value={selectedLogsConfig}
                        onValueChange={value => setSelectedLogsConfig(value as LogProvider)}
                      >
                        <SelectTrigger className="w-full text-white bg-mastra-bg-2 border-mastra-bg-4">
                          <SelectValue placeholder="Configure logs text-white" />
                        </SelectTrigger>
                        <SelectContent className="w-[123px]">
                          {logsConfig.map(config => (
                            <SelectItem className="text-white" key={config.value} value={config.value}>
                              {config.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedLogsConfig === 'UPSTASH' ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-col pt-0 p-3 gap-2">
                          <p className="text-xs text-white">Upstash Url:</p>
                          <Input
                            placeholder="Enter the Upstash URL"
                            onChange={e => setUpstashUrl(e.target.value)}
                            value={upstashUrl}
                          />
                        </div>
                        <div className="flex flex-col pt-0 p-3 gap-2">
                          <p className="text-xs text-white">API Key:</p>
                          <Input
                            placeholder="Enter the Upstash API Key"
                            onChange={e => setUpstashApiKey(e.target.value)}
                            value={upstashApiKey}
                          />
                        </div>
                      </div>
                    ) : null}
                    <div className="flex flex-col pt-0 p-3 gap-2">
                      <p className="text-xs text-white">Log Level:</p>
                      <Select
                        value={selectedLogLevel as unknown as string}
                        onValueChange={value => setSelectedLogLevel(value as unknown as LogLevel)}
                      >
                        <SelectTrigger className="w-full text-white bg-mastra-bg-2 border-mastra-bg-4">
                          <SelectValue placeholder="Configure text-white logs" />
                        </SelectTrigger>
                        <SelectContent className="w-[123px] text-white">
                          {logLevelOptions.map(option => (
                            <SelectItem key={option.value} value={option.value as unknown as string}>
                              {option.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end pt-0 px-3">
                    <Button onClick={() => saveLogConfig()} className="text-xs h-7" type="button">
                      Save
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
        <div className="bg-mastra-bg-1 text-gray-400 gap-4 flex h-12 px-4 text-xs font-light items-center">
          <span className="w-[120px]">Time</span>
          <span className="w-12">Code</span>
          <span className="w-96">Message</span>
          <span className="w-24">Log ID</span>
          <span className="w-24">Run status</span>
        </div>
        <div className="h-[calc(100vh-250px)] overflow-y-scroll relative">
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

                    const isSuccessCode = log?.statusCode?.toString().startsWith('2');
                    const isReadyCode = log?.statusCode?.toString().startsWith('1');
                    const isErrorCode = log?.statusCode?.toString().startsWith('4');

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
                              <TooltipTrigger asChild>
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
                                  statusColors[log?.metadata?.run?.status || 'info'],
                                )}
                              >
                                {log?.metadata?.run?.status || 'Info'}
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
            <VisuallyHidden>
              <SheetTitle>Log details</SheetTitle>
            </VisuallyHidden>
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
                      <RenderMetadata metadata={filteredLogs[selectedLogIndex]?.metadata} />
                    </>
                  )}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </section>
  );
}
