import { Link } from 'react-router';
import { ArrowRight, GitBranch, Rocket } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SourceTypeIcon } from './source-type-icon';
import type { Project } from '@/types/api';

interface ProjectCardProps {
  project: Project;
  deploymentCount?: number;
}

export function ProjectCard({ project, deploymentCount = 0 }: ProjectCardProps) {
  return (
    <Card className="hover:border-accent1/50 transition-colors">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SourceTypeIcon type={project.sourceType} className="text-neutral6" />
          <span>{project.name}</span>
        </CardTitle>
        <CardDescription className="text-neutral3">/{project.slug}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6 text-sm text-neutral6">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            <span>{project.defaultBranch}</span>
          </div>
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            <span>{deploymentCount} deployments</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button asChild variant="ghost" className="ml-auto">
          <Link to={`/projects/${project.id}`}>
            View Project
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
