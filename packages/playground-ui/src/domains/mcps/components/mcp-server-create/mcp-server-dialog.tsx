import { SideDialog } from '@/ds/components/SideDialog';

import { MCPServerCreateContent } from './mcp-server-create-content';

interface MCPServerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editServerId?: string;
}

export function MCPServerDialog({ isOpen, onClose, editServerId }: MCPServerDialogProps) {
  return (
    <SideDialog
      isOpen={isOpen}
      onClose={onClose}
      dialogTitle={editServerId ? 'Edit MCP Server' : 'Create MCP Server'}
      dialogDescription={editServerId ? 'Edit your MCP server configuration' : 'Create a new MCP server with tools'}
    >
      {isOpen && <MCPServerCreateContent editServerId={editServerId} onClose={onClose} />}
    </SideDialog>
  );
}
