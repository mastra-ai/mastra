import { Icon } from '@/components/icon';
import { Text } from '@/components/ui/text';

import { cn } from '@/lib/utils';

interface AddNextStepProps {
  onAddNextStep: () => void;
}

const blockStyles = {
  default: 'border-[0.5px] border-solid rounded-md relative border-mastra-border-1',
  states: 'hover:border-mastra-border-5 focus:border-mastra-border-5',
  header: 'p-2 text-[13px] flex gap-[7px] items-center',
};

export function AddNextStep({ onAddNextStep }: AddNextStepProps) {
  return (
    <button
      onClick={onAddNextStep}
      className={cn(blockStyles.default, 'bg-transparent flex w-full min-w-[274px] gap-[10px] !border-dashed p-[10px]')}
      title="New API"
    >
      <div className={cn('flex gap-[6px] rounded-sm bg-[#2C2C2C] p-2')}>
        <Icon name="enrich" className="text-mastra-el-4" />
        <Text size="xs" className="text-mastra-el-4" weight="medium">
          API
        </Text>
      </div>
      <Text className="text-mastra-el-3 max-w-[120px] text-left text-[10px]">
        Add another API that continues your workflow
      </Text>
    </button>
  );
}

export default AddNextStep;
