import type { ReactNode } from 'react';
import { ToolCallProvider } from '@/domains/chat/context/tool-call-context';

const noop = () => {};

/** Tool cards read back from a trace: nothing is running and nothing can be approved. */
export function ReadOnlyToolCallProvider({ children }: { children: ReactNode }) {
  return (
    <ToolCallProvider
      approveToolcall={noop}
      declineToolcall={noop}
      approveToolcallGenerate={noop}
      declineToolcallGenerate={noop}
      approveNetworkToolcall={noop}
      declineNetworkToolcall={noop}
      isRunning={false}
      toolCallApprovals={{}}
      networkToolCallApprovals={{}}
    >
      {children}
    </ToolCallProvider>
  );
}
