import { Link } from 'react-router';
import { MoreHorizontal, Settings, Rocket, Key, GitBranch } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SourceTypeIcon } from './source-type-icon';
import { formatDistanceToNow } from 'date-fns';
import type { Project } from '@/types/api';

interface ProjectWithCounts extends Project {
  deploymentCount?: number;
}

interface ProjectTableProps {
  projects: ProjectWithCounts[];
  onDelete?: (projectId: string) => void;
}

export function ProjectTable({ projects, onDelete }: ProjectTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Project</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Deployments</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map(project => (
          <TableRow key={project.id}>
            <TableCell>
              <div>
                <Link to={`/projects/${project.id}`} className="font-medium hover:text-accent1">
                  {project.name}
                </Link>
                <div className="text-sm text-neutral6">/{project.slug}</div>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <SourceTypeIcon type={project.sourceType} className="text-neutral6" />
                <span className="capitalize">{project.sourceType}</span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <GitBranch className="h-4 w-4 text-neutral6" />
                <span>{project.defaultBranch}</span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <Rocket className="h-4 w-4 text-neutral6" />
                <span>{project.deploymentCount ?? 0}</span>
              </div>
            </TableCell>
            <TableCell className="text-neutral6">
              {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
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
                  <DropdownMenuItem asChild>
                    <Link to={`/projects/${project.id}/deployments`}>
                      <Rocket className="mr-2 h-4 w-4" />
                      Deployments
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/projects/${project.id}/env-vars`}>
                      <Key className="mr-2 h-4 w-4" />
                      Environment Variables
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/projects/${project.id}/settings`}>
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-500" onClick={() => onDelete(project.id)}>
                        Delete Project
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
