import { Braces } from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { traces_mock_data } from './mock-data';

export function Traces() {
  const isLoading = false;
  return (
    <main className="flex-1 relative overflow-hidden">
      <ScrollArea className="rounded-lg h-full">
        <Table>
          <TableHeader className="bg-[#171717] sticky top-0 z-10">
            <TableRow className="border-gray-6 border-b-[0.1px] text-[0.8125rem]">
              <TableHead className="text-mastra-el-3">Trace</TableHead>
              <TableHead className="text-mastra-el-3 flex items-center gap-1">
                <Braces className="h-3 w-3" /> Trace Id
              </TableHead>
              <TableHead className="text-mastra-el-3">Started</TableHead>
              <TableHead className="text-mastra-el-3">Total Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="border-b border-gray-6">
            {isLoading ? (
              <TableRow className="border-b-gray-6 border-b-[0.1px] text-[0.8125rem]">
                <TableCell>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ) : (
              traces_mock_data.traces.map(trace => (
                <TableRow key={trace.id} className="border-b-gray-6 border-b-[0.1px] text-[0.8125rem]">
                  <TableCell className="font-medium text-mastra-el-5">{trace.name}</TableCell>
                  <TableCell className="text-mastra-el-5">{trace.id}</TableCell>
                  <TableCell className="text-mastra-el-5 text-sm">{trace.startTime}</TableCell>
                  <TableCell className="text-mastra-el-5 text-sm">{trace.endTime}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </main>
  );
}
