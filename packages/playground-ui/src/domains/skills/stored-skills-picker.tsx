import { Button } from '@/ds/components/Button';
import { Checkbox } from '@/ds/components/Checkbox';
import { Field, FieldLabel } from '@/ds/components/Field';
import { Txt } from '@/ds/components/Txt';
import { IconPencil } from '@/ds/icons/central/IconPencil';

export interface StoredSkillsPickerSkill {
  id: string;
  name: string;
  description?: string | null;
}

export interface StoredSkillsPickerProps {
  availableSkills: readonly StoredSkillsPickerSkill[];
  selectedSkillIds: readonly string[];
  isLoading?: boolean;
  disabled?: boolean;
  onAttach: (skillId: string) => void;
  onRemove: (skillId: string) => void;
  onCreate?: () => void;
  /** Offers an edit action on each skill. The host owns the editor. */
  onEdit?: (skillId: string) => void;
}

export function StoredSkillsPicker({
  availableSkills,
  selectedSkillIds,
  isLoading = false,
  disabled = false,
  onAttach,
  onRemove,
  onCreate,
  onEdit,
}: StoredSkillsPickerProps) {
  const selected = new Set(selectedSkillIds);

  return (
    <div className="h-full min-h-0 overflow-y-auto py-2">
      {isLoading ? (
        <div role="status" className="flex items-center justify-center py-8">
          <Txt variant="caption" tone="muted">
            Loading skills…
          </Txt>
        </div>
      ) : availableSkills.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-8">
          <Txt variant="caption" tone="muted">
            No skills available in this project.
          </Txt>
          {onCreate && (
            <Button variant="ghost" disabled={disabled} onClick={onCreate}>
              Create skill
            </Button>
          )}
        </div>
      ) : (
        <ul className="flex flex-col">
          {availableSkills.map(skill => (
            <li key={skill.id} className="flex items-start hover:bg-fill-subtle">
              <Field disabled={disabled} className="min-w-0 flex-1">
                <FieldLabel className="flex shrink items-start gap-3 p-4">
                  <span className="mt-0.5 flex">
                    <Checkbox
                      checked={selected.has(skill.id)}
                      onCheckedChange={next => (next === true ? onAttach(skill.id) : onRemove(skill.id))}
                    />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <Txt as="span" variant="column" tone="ink">
                      {skill.name}
                    </Txt>
                    {skill.description && (
                      <Txt as="span" variant="meta" tone="muted" className="mt-0.5 truncate" title={skill.description}>
                        {skill.description}
                      </Txt>
                    )}
                  </span>
                </FieldLabel>
              </Field>
              {onEdit && (
                <span className="p-3">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    tooltip={`Edit ${skill.name}`}
                    aria-label={`Edit ${skill.name}`}
                    disabled={disabled}
                    onClick={() => onEdit(skill.id)}
                  >
                    <IconPencil />
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
