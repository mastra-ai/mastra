import type { CatalogTool } from './catalog-tool';
import { Badge } from '@/ds/components/Badge';
import { Checkbox } from '@/ds/components/Checkbox';
import { Txt } from '@/ds/components/Txt';

export function CatalogRow({
  tool,
  checked,
  onCheckedChange,
}: {
  tool: CatalogTool;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <span aria-hidden="true" className="flex shrink-0">
        {tool.logo}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2">
          <Txt as="span" variant="label" tone="ink">
            {tool.name}
          </Txt>
          {tool.connected ? (
            <Badge variant="success" emphasis="subtle" size="sm">
              Connected
            </Badge>
          ) : null}
        </span>
        <Txt as="span" variant="caption" tone="muted" className="truncate">
          {tool.description}
        </Txt>
      </span>
      <Checkbox aria-label={tool.name} checked={checked} onCheckedChange={next => onCheckedChange(next === true)} />
    </label>
  );
}
