import { Link } from 'react-router';
import { MoreHorizontal, Settings, Users, FolderGit2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import type { Team } from '@/types/api';

interface TeamWithCounts extends Team {
  memberCount?: number;
  projectCount?: number;
}

interface TeamTableProps {
  teams: TeamWithCounts[];
  onDelete?: (teamId: string) => void;
}

export function TeamTable({ teams, onDelete }: TeamTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Slug</TableHead>
          <TableHead>Members</TableHead>
          <TableHead>Projects</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {teams.map(team => (
          <TableRow key={team.id}>
            <TableCell>
              <Link to={`/teams/${team.id}`} className="font-medium hover:text-accent1">
                {team.name}
              </Link>
            </TableCell>
            <TableCell className="text-neutral6">/{team.slug}</TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4 text-neutral6" />
                <span>{team.memberCount ?? 0}</span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <FolderGit2 className="h-4 w-4 text-neutral6" />
                <span>{team.projectCount ?? 0}</span>
              </div>
            </TableCell>
            <TableCell className="text-neutral6">
              {formatDistanceToNow(new Date(team.createdAt), { addSuffix: true })}
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
                    <Link to={`/teams/${team.id}/members`}>
                      <Users className="mr-2 h-4 w-4" />
                      Members
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/teams/${team.id}/settings`}>
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-500" onClick={() => onDelete(team.id)}>
                        Delete Team
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
