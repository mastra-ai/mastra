import { cn } from '@mastra/playground-ui/utils/cn';

import { AUDIT_CATEGORIES } from '../../auditPresentation';
import type { AuditNamespace } from '../../auditPresentation';

function CategoryToggle({
  label,
  dotClass,
  pressed,
  onClick,
}: {
  label: string;
  dotClass: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-ui-xs font-semibold outline-none transition-colors',
        pressed
          ? 'bg-neutral6/10 text-neutral6'
          : 'text-neutral3 hover:bg-neutral6/5 hover:text-neutral5 focus-visible:bg-neutral6/5 focus-visible:text-neutral5',
      )}
    >
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', dotClass)} />
      {label}
    </button>
  );
}

export function AuditCategoryFilter({
  selectedCategories,
  countLabel,
  onToggleCategory,
  onClearCategories,
}: {
  selectedCategories: ReadonlySet<AuditNamespace>;
  countLabel: string;
  onToggleCategory: (category: AuditNamespace) => void;
  onClearCategories: () => void;
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 items-center gap-1 pt-2 sm:grid-cols-[1fr_auto_1fr] sm:gap-2">
      <span className="hidden sm:block" />
      <div
        className="flex max-w-full min-w-0 flex-wrap justify-center gap-1"
        role="group"
        aria-label="Audit categories"
      >
        <CategoryToggle
          label="All"
          dotClass="bg-neutral3"
          pressed={selectedCategories.size === 0}
          onClick={onClearCategories}
        />
        {AUDIT_CATEGORIES.map(category => (
          <CategoryToggle
            key={category.namespace}
            label={category.label}
            dotClass={category.dotClass}
            pressed={selectedCategories.has(category.namespace)}
            onClick={() => onToggleCategory(category.namespace)}
          />
        ))}
      </div>
      <span className="text-ui-xs text-neutral2 justify-self-center tabular-nums sm:justify-self-end">
        {countLabel}
      </span>
    </div>
  );
}
