import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { Table } from '@mastra/playground-ui/components/Table';

import { SandboxEnvsTableHeader } from './SandboxEnvsTableHeader';

export function SandboxEnvsSkeleton() {
  return (
    <div role="status" aria-label="Loading environment variables">
      <Table variant="inset" aria-hidden inert>
        <SandboxEnvsTableHeader />
        <Table.Body>
          {Array.from({ length: 2 }, (_, index) => (
            <Table.Row key={index}>
              <Table.Cell>
                <SkeletonText line="text-body-sm font-mono" className="w-[9ch] motion-reduce:before:animate-none" />
              </Table.Cell>
              <Table.Cell>
                <SkeletonText line="text-body-sm font-mono" className="w-[12ch] motion-reduce:before:animate-none" />
              </Table.Cell>
              <Table.Cell>
                <Skeleton className="h-5 w-24 rounded-full motion-reduce:before:animate-none" />
              </Table.Cell>
              <Table.Cell>
                <SkeletonText className="w-10 motion-reduce:before:animate-none" />
              </Table.Cell>
              <Table.Cell align="end">
                <Skeleton className="size-control-sm ml-auto rounded-full motion-reduce:before:animate-none" />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}
