'use client';

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

import { ToolChoice, useAgentFormContext } from '../context/agent-form-context';

export const ToolChoiceRadio = () => {
  const { toolChoice, setToolChoice } = useAgentFormContext();

  return (
    <div className="flex gap-2 justify-between">
      <p className="text-mastra-el-3 text-xs font-medium">Tool choice:</p>
      <RadioGroup
        onValueChange={val => setToolChoice(val as ToolChoice)}
        defaultValue="auto"
        value={toolChoice}
        className="flex items-center"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="auto" id="auto" />
          <Label htmlFor="auto">Auto</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="required" id="required" />
          <Label htmlFor="required">Required</Label>
        </div>
      </RadioGroup>
    </div>
  );
};

export default ToolChoiceRadio;
