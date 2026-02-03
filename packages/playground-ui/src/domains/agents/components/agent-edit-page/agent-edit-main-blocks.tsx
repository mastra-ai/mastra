import { UseFormReturn } from 'react-hook-form';
import { Blocks } from 'lucide-react';
import { useState } from 'react';

import { SectionHeader } from '@/domains/cms';

import type { AgentFormValues } from './utils/form-validation';
import { AgentCMSBlocks } from '../agent-cms-blocks';

interface AgentEditMainProps {
  form: UseFormReturn<AgentFormValues>;
  readOnly?: boolean;
}

export function AgentEditMainContentBlocks({ form, readOnly: _readOnly = false }: AgentEditMainProps) {
  const [items, setItems] = useState<Array<string>>([]);
  const schema = form.watch('variables');

  return (
    <div className="flex flex-col gap-6 h-full p-4">
      <div className="min-h-0 pb-4">
        <SectionHeader title="Blocks" subtitle="Add blocks to your agent." icon={<Blocks />} />
      </div>

      <AgentCMSBlocks items={items} onChange={setItems} placeholder="Enter content..." schema={schema} />
    </div>
  );
}
