import { MoreHorizontal, Pencil, Trash2, Lock } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SecretToggle } from './secret-toggle';
import { formatDistanceToNow } from 'date-fns';
import type { EncryptedEnvVar } from '@/types/api';

interface EnvVarTableProps {
  envVars: EncryptedEnvVar[];
  onEdit?: (key: string) => void;
  onDelete?: (key: string) => void;
}

export function EnvVarTable({ envVars, onEdit, onDelete }: EnvVarTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Key</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {envVars.map(envVar => (
          <TableRow key={envVar.key}>
            <TableCell>
              <span className="font-mono font-medium">{envVar.key}</span>
            </TableCell>
            <TableCell>
              <SecretToggle value={envVar.encryptedValue} isSecret={envVar.isSecret} />
            </TableCell>
            <TableCell>
              {envVar.isSecret ? (
                <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                  <Lock className="h-3 w-3" />
                  Secret
                </Badge>
              ) : (
                <Badge variant="outline">Plain</Badge>
              )}
            </TableCell>
            <TableCell className="text-neutral6">
              {formatDistanceToNow(new Date(envVar.updatedAt), { addSuffix: true })}
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onEdit && (
                    <DropdownMenuItem onClick={() => onEdit(envVar.key)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-500" onClick={() => onDelete(envVar.key)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
