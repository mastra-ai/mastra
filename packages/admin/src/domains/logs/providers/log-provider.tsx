'use client';

import { createContext, useContext, useEffect, useState } from 'react';

import { getLogs } from '@/domains/workflows/actions';

import { Log } from '../types';

interface LogContextProps {
  isLoading: boolean;
  logs: Log[];
  filteredLogs: Log[];
  filter: string;
  activeStatus: string;
  logId: string;
  logIds: string[];
  selectedLogIndex: number | null;
  openLogDetails: (index: number) => void;
  closeLogDetails: () => void;
  navigateLog: (direction: 'prev' | 'next') => void;
  setFilter: React.Dispatch<React.SetStateAction<string>>;
  setActiveStatus: React.Dispatch<React.SetStateAction<string>>;
  setLogId: React.Dispatch<React.SetStateAction<string>>;
  setLogIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedLogIndex: React.Dispatch<React.SetStateAction<number | null>>;
}

const LogContext = createContext({} as LogContextProps);

export const useLogContext = () => {
  const context = useContext(LogContext);
  if (!context) {
    throw new Error('useLogContext must be used within a LogProvider');
  }
  return context;
};

export const LogProvider = ({
  children,
  registeredLoggers,
}: {
  children: React.ReactNode;
  registeredLoggers: string[];
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<Log[]>([]);
  const [filter, setFilter] = useState('');
  const [activeStatus, setActiveStatus] = useState('all');
  const [logId, setLogId] = useState<string>('all');
  const [logIds, setLogIds] = useState<string[]>([]);
  const [selectedLogIndex, setSelectedLogIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      const fetchedLogs = await getLogs(registeredLoggers);
      setLogs(fetchedLogs);
      setIsLoading(false);
      const uniqueLogIds = Array.from(new Set(fetchedLogs.map(log => log.logId)));
      setLogIds(['all', ...uniqueLogIds]);
    };
    fetchLogs();
  }, [registeredLoggers]);

  const filteredLogs = logs
    .filter(log => log.message.toLowerCase().includes(filter.toLowerCase()))
    .filter(
      log =>
        activeStatus === 'all' ||
        log?.metadata?.run?.status === activeStatus ||
        (activeStatus === 'info' && !log?.metadata?.run?.status),
    )
    .filter(log => logId === 'all' || log.logId === logId);

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

  const value = {
    isLoading,
    logs,
    filteredLogs,
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
    setLogIds,
    setSelectedLogIndex,
  };

  return <LogContext.Provider value={value}>{children}</LogContext.Provider>;
};
