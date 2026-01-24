import { ExternalLink, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DeploymentUrlProps {
  url: string | null;
  className?: string;
}

export function DeploymentUrl({ url, className }: DeploymentUrlProps) {
  const [copied, setCopied] = useState(false);

  if (!url) {
    return <span className="text-neutral6 text-sm">Not deployed</span>;
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-accent1 hover:underline truncate max-w-[200px]"
      >
        {url.replace(/^https?:\/\//, '')}
      </a>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
        <a href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-3 w-3" />
        </a>
      </Button>
    </div>
  );
}
