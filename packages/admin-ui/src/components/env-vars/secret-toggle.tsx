import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface SecretToggleProps {
  value: string;
  isSecret: boolean;
}

export function SecretToggle({ value, isSecret }: SecretToggleProps) {
  const [revealed, setRevealed] = useState(false);

  if (!isSecret) {
    return <span className="font-mono text-sm">{value}</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-sm">{revealed ? value : '••••••••'}</span>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setRevealed(!revealed)}>
        {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </Button>
    </div>
  );
}
