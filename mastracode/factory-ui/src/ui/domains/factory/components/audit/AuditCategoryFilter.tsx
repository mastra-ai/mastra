import { AUDIT_CATEGORIES } from '../../auditPresentation';
import type { AuditNamespace } from '../../auditPresentation';
import { FilterChip } from './FilterChip';

export function AuditCategoryFilter({
  selectedCategories,
  countLabel,
  onToggleCategory,
  onClearCategories,
}: {
  selectedCategories: ReadonlySet<AuditNamespace>;
  countLabel?: string;
  onToggleCategory: (category: AuditNamespace) => void;
  onClearCategories: () => void;
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 items-center gap-1 pt-2 sm:grid-cols-[1fr_auto_1fr] sm:gap-2">
      <span className="hidden sm:block" />
      <div
        className="flex max-w-full min-w-0 flex-nowrap gap-1 overflow-x-auto sm:flex-wrap sm:justify-center sm:overflow-visible"
        role="group"
        aria-label="Audit categories"
      >
        <FilterChip
          label="All"
          dotClass="bg-neutral3"
          pressed={selectedCategories.size === 0}
          onClick={onClearCategories}
        />
        {AUDIT_CATEGORIES.map(category => (
          <FilterChip
            key={category.namespace}
            label={category.label}
            dotClass={category.dotClass}
            pressed={selectedCategories.has(category.namespace)}
            onClick={() => onToggleCategory(category.namespace)}
          />
        ))}
      </div>
      {countLabel ? (
        <span className="text-ui-xs text-neutral2 justify-self-center tabular-nums sm:justify-self-end">
          {countLabel}
        </span>
      ) : null}
    </div>
  );
}
