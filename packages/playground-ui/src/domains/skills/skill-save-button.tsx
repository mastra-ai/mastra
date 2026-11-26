import { Button } from '@/ds/components/Button';
import { IconCheckmark2Medium } from '@/ds/icons/central/IconCheckmark2Medium';
import { SkillIcon } from '@/ds/icons/SkillIcon';

export function SkillSaveButton({
  editing,
  disabled,
  pending,
  onSave,
}: {
  editing?: boolean;
  disabled: boolean;
  pending: boolean;
  onSave: () => void;
}) {
  return (
    <Button
      type="button"
      icon={editing ? <IconCheckmark2Medium /> : <SkillIcon />}
      variant="primary"
      size="sm"
      onClick={onSave}
      disabled={disabled}
      loading={pending}
    >
      {editing ? 'Save' : 'Create'}
    </Button>
  );
}
