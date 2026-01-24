import { Link } from 'react-router';
import { MoreHorizontal, ExternalLink, GitBranch, History, Settings } from 'lucide-react';
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
import { DeploymentStatusBadge } from './deployment-status-badge';
import { DeploymentUrl } from './deployment-url';
import { formatDistanceToNow } from 'date-fns';
import { DeploymentType, type Deployment } from '@/types/api';

const typeConfig: Record<DeploymentType, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  [DeploymentType.PRODUCTION]: { label: 'Prod', variant: 'default' },
  [DeploymentType.STAGING]: { label: 'Staging', variant: 'secondary' },
  [DeploymentType.PREVIEW]: { label: 'Preview', variant: 'outline' },
};

interface DeploymentTableProps {
  deployments: Deployment[];
  projectId: string;
  onDelete?: (deploymentId: string) => void;
}

export function DeploymentTable({ deployments, projectId, onDelete }: DeploymentTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Deployment</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>URL</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deployments.map(deployment => {
          const typeInfo = typeConfig[deployment.type];
          return (
            <TableRow key={deployment.id}>
              <TableCell>
                <Link
                  to={`/projects/${projectId}/deployments/${deployment.id}`}
                  className="font-medium hover:text-accent1"
                >
                  {deployment.slug}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <GitBranch className="h-4 w-4 text-neutral6" />
                  <span>{deployment.branch}</span>
                </div>
              </TableCell>
              <TableCell>
                <DeploymentStatusBadge status={deployment.status} />
              </TableCell>
              <TableCell>
                <DeploymentUrl url={deployment.publicUrl} />
              </TableCell>
              <TableCell className="text-neutral6">
                {formatDistanceToNow(new Date(deployment.updatedAt), { addSuffix: true })}
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
                    {deployment.publicUrl && (
                      <DropdownMenuItem asChild>
                        <a href={deployment.publicUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open URL
                        </a>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <Link to={`/projects/${projectId}/deployments/${deployment.id}`}>
                        <History className="mr-2 h-4 w-4" />
                        Build History
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={`/projects/${projectId}/deployments/${deployment.id}/settings`}>
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    {onDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-500" onClick={() => onDelete(deployment.id)}>
                          Delete Deployment
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
