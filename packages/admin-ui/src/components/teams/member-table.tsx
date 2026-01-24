import { MoreHorizontal, Mail, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RoleBadge } from './role-badge';
import { formatDistanceToNow } from 'date-fns';
import { TeamRole, type TeamMember, type User } from '@/types/api';

interface MemberWithUser extends TeamMember {
  user: User;
}

interface MemberTableProps {
  members: MemberWithUser[];
  currentUserId?: string;
  canManage?: boolean;
  onUpdateRole?: (userId: string, role: TeamRole) => void;
  onRemove?: (userId: string) => void;
}

export function MemberTable({ members, currentUserId, canManage = false, onUpdateRole, onRemove }: MemberTableProps) {
  const roleOptions = [
    { value: TeamRole.ADMIN, label: 'Admin' },
    { value: TeamRole.DEVELOPER, label: 'Developer' },
    { value: TeamRole.VIEWER, label: 'Viewer' },
  ];

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Joined</TableHead>
          {canManage && <TableHead className="w-[50px]"></TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map(member => {
          const isCurrentUser = member.userId === currentUserId;
          const isOwner = member.role === TeamRole.OWNER;

          return (
            <TableRow key={member.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-surface4 flex items-center justify-center">
                    {member.user.avatarUrl ? (
                      <img
                        src={member.user.avatarUrl}
                        alt={member.user.name ?? member.user.email}
                        className="h-8 w-8 rounded-full"
                      />
                    ) : (
                      <span className="text-sm font-medium">
                        {(member.user.name ?? member.user.email).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="font-medium">
                      {member.user.name ?? 'Unknown'}
                      {isCurrentUser && <span className="ml-2 text-neutral6">(you)</span>}
                    </div>
                    <div className="text-sm text-neutral6">{member.user.email}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {canManage && !isOwner && !isCurrentUser && onUpdateRole ? (
                  <Select value={member.role} onValueChange={(value: TeamRole) => onUpdateRole(member.userId, value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <RoleBadge role={member.role} />
                )}
              </TableCell>
              <TableCell className="text-neutral6">
                {formatDistanceToNow(new Date(member.createdAt), { addSuffix: true })}
              </TableCell>
              {canManage && (
                <TableCell>
                  {!isOwner && !isCurrentUser && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Mail className="mr-2 h-4 w-4" />
                          Send Message
                        </DropdownMenuItem>
                        {onRemove && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-500" onClick={() => onRemove(member.userId)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove from Team
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
