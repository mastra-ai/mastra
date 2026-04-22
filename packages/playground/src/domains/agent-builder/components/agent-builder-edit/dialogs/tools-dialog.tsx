import {
  Badge,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Switch,
  Txt,
  cn,
} from '@mastra/playground-ui';
import { useMemo, useState } from 'react';
import { toolsFixture, type ToolFixture } from '../../../fixtures';

const CATEGORY_LABEL: Record<ToolFixture['category'], string> = {
  web: 'Web',
  data: 'Data',
  files: 'Files',
  communication: 'Communication',
  automation: 'Automation',
};

interface ToolsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ToolsDialog = ({ open, onOpenChange }: ToolsDialogProps) => {
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(toolsFixture.map(t => [t.id, t.enabled])),
  );

  const grouped = useMemo(() => {
    const byCategory = new Map<ToolFixture['category'], ToolFixture[]>();
    for (const tool of toolsFixture) {
      const list = byCategory.get(tool.category) ?? [];
      list.push(tool);
      byCategory.set(tool.category, list);
    }
    return Array.from(byCategory.entries());
  }, []);

  const toggle = (id: string, next: boolean) => setEnabledMap(prev => ({ ...prev, [id]: next }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[640px]">
        <DialogHeader>
          <DialogTitle>Tools</DialogTitle>
          <DialogDescription>Select the tools your agent is allowed to use.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-5">
            {grouped.map(([category, tools]) => (
              <div key={category} className="flex flex-col gap-2">
                <Txt variant="ui-xs" className="font-medium uppercase tracking-wide text-neutral3">
                  {CATEGORY_LABEL[category]}
                </Txt>
                <div className="flex flex-col gap-2">
                  {tools.map(tool => (
                    <div
                      key={tool.id}
                      className={cn(
                        'flex items-start justify-between gap-4 rounded-md border border-border1 bg-surface2 p-4',
                      )}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Txt variant="ui-sm" className="font-medium text-neutral6">
                            {tool.name}
                          </Txt>
                          <Badge variant="default">{tool.id}</Badge>
                        </div>
                        <Txt variant="ui-sm" className="text-neutral3">
                          {tool.description}
                        </Txt>
                      </div>
                      <Switch
                        checked={enabledMap[tool.id] ?? false}
                        onCheckedChange={next => toggle(tool.id, next)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
