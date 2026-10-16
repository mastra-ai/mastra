import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { ListFilter } from 'lucide-react';

import { AUDIT_CATEGORIES } from '../../../auditPresentation';
import type { AuditNamespace } from '../../../auditPresentation';

function filterHint(categories: ReadonlySet<AuditNamespace>): string {
  if (categories.size === 0) return 'All';
  const [only] = AUDIT_CATEGORIES.filter(category => categories.has(category.namespace));
  return categories.size === 1 && only ? only.label : `${categories.size} kinds`;
}

/** Every category picked is the same as none, so the filter folds back to "All". */
function toggled(categories: ReadonlySet<AuditNamespace>, category: AuditNamespace): ReadonlySet<AuditNamespace> {
  const next = new Set(categories);
  if (!next.delete(category)) next.add(category);
  return next.size === AUDIT_CATEGORIES.length ? new Set() : next;
}

export function CategoryFilter({
  categories,
  onChange,
}: {
  categories: ReadonlySet<AuditNamespace>;
  onChange: (categories: ReadonlySet<AuditNamespace>) => void;
}) {
  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger hint={filterHint(categories)}>
        <ListFilter aria-hidden />
        <span>Filter</span>
      </DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent>
        <DropdownMenu.CheckboxItem checked={categories.size === 0} onCheckedChange={() => onChange(new Set())}>
          All events
        </DropdownMenu.CheckboxItem>
        <DropdownMenu.Separator />
        {AUDIT_CATEGORIES.map(category => (
          <DropdownMenu.CheckboxItem
            key={category.namespace}
            checked={categories.has(category.namespace)}
            onCheckedChange={() => onChange(toggled(categories, category.namespace))}
          >
            <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${category.dotClass}`} />
            {category.label}
          </DropdownMenu.CheckboxItem>
        ))}
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>
  );
}
