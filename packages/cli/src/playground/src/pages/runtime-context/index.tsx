import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Header, HeaderTitle, usePlaygroundStore } from '@mastra/playground-ui';

export default function RuntimeContext() {
  const { runtimeContext, setRuntimeContext } = usePlaygroundStore();
  const [runtimeContextValue, setRuntimeContextValue] = useState<string>(JSON.stringify(runtimeContext));

  const handleSaveRuntimeContext = () => {
    try {
      const parsedContext = JSON.parse(runtimeContextValue);
      setRuntimeContext(parsedContext);
      toast.success('Runtime context saved successfully');
    } catch (error) {
      console.error('error', error);
      toast.error('Invalid JSON');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <Header>
        <HeaderTitle>Runtime Context</HeaderTitle>
      </Header>
      <div className="flex-1 p-6 space-y-4">
        <div className="space-y-2">
          <Label className="text-mastra-el-3 text-sm">Runtime Context (JSON)</Label>
          <Textarea
            className="min-h-[400px] font-mono text-sm"
            value={runtimeContextValue}
            onChange={e => {
              setRuntimeContextValue(e.target.value);
            }}
            placeholder='{"name": "John Doe", "age": 30, "email": "john.doe@example.com"}'
          />
        </div>
        <Button onClick={handleSaveRuntimeContext}>Save</Button>
      </div>
    </div>
  );
}
