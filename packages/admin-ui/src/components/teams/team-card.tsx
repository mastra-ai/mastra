import { Link } from 'react-router';
import { Users, FolderGit2, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Team } from '@/types/api';

interface TeamCardProps {
  team: Team;
  memberCount?: number;
  projectCount?: number;
}

export function TeamCard({ team, memberCount = 0, projectCount = 0 }: TeamCardProps) {
  return (
    <Card className="hover:border-accent1/50 transition-colors">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{team.name}</span>
        </CardTitle>
        <CardDescription className="text-neutral3">/{team.slug}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6 text-sm text-neutral6">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>{memberCount} members</span>
          </div>
          <div className="flex items-center gap-2">
            <FolderGit2 className="h-4 w-4" />
            <span>{projectCount} projects</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button asChild variant="ghost" className="ml-auto">
          <Link to={`/teams/${team.id}`}>
            View Team
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
