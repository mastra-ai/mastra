import { Link } from 'react-router';
import { GitBranch, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DeploymentStatusBadge } from './deployment-status-badge';
import { DeploymentUrl } from './deployment-url';
import { DeploymentType, type Deployment } from '@/types/api';
import { formatDistanceToNow } from 'date-fns';

const typeConfig: Record<DeploymentType, { label: string; color: string }> = {
  [DeploymentType.PRODUCTION]: { label: 'Production', color: 'bg-green-600' },
  [DeploymentType.STAGING]: { label: 'Staging', color: 'bg-yellow-600' },
  [DeploymentType.PREVIEW]: { label: 'Preview', color: 'bg-blue-600' },
};

interface DeploymentCardProps {
  deployment: Deployment;
  projectId: string;
}

export function DeploymentCard({ deployment, projectId }: DeploymentCardProps) {
  const typeInfo = typeConfig[deployment.type];

  return (
    <Card className="hover:border-accent1/50 transition-colors">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span>{deployment.slug}</span>
            <Badge className={typeInfo.color}>{typeInfo.label}</Badge>
          </CardTitle>
          <DeploymentStatusBadge status={deployment.status} />
        </div>
        <CardDescription className="flex items-center gap-2 text-neutral6">
          <GitBranch className="h-4 w-4" />
          {deployment.branch}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <DeploymentUrl url={deployment.publicUrl} />
          <div className="text-sm text-neutral6">
            Updated {formatDistanceToNow(new Date(deployment.updatedAt), { addSuffix: true })}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button asChild variant="ghost" className="ml-auto">
          <Link to={`/projects/${projectId}/deployments/${deployment.id}`}>
            View Details
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
