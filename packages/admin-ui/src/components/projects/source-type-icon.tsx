import { Github, FolderCode } from 'lucide-react';
import { SourceType } from '@/types/api';
import { cn } from '@/lib/utils';

interface SourceTypeIconProps {
  type: SourceType;
  className?: string;
}

export function SourceTypeIcon({ type, className }: SourceTypeIconProps) {
  const Icon = type === SourceType.GITHUB ? Github : FolderCode;
  return <Icon className={cn('h-4 w-4', className)} />;
}
