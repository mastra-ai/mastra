import { useEffect, useState } from 'react';

import { toast } from 'sonner';
import {
  Header,
  HeaderTitle,
  Txt,
  usePlaygroundStore,
  MainContentLayout,
  MainContentContent,
  MainLayout,
  MainContent,
  MainHeader,
  MainHeaderTitle,
  Button,
  Icon,
  RuntimeContextInfo,
  RuntimeContextEditor,
} from '@mastra/playground-ui';
import { Braces, CopyIcon } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNewUI } from '@/hooks/use-new-ui';

import { formatJSON, isValidJson } from '@/lib/utils';
import CodeMirror from '@uiw/react-codemirror';
import { useCodemirrorTheme } from '@/components/syntax-highlighter';
import { jsonLanguage } from '@codemirror/lang-json';
export default function RuntimeContext() {
  const { runtimeContext, setRuntimeContext } = usePlaygroundStore();
  const [runtimeContextValue, setRuntimeContextValue] = useState<string>('');
  const theme = useCodemirrorTheme();
  const newUIEnabled = useNewUI();

  const { handleCopy } = useCopyToClipboard({ text: runtimeContextValue });

  const runtimeContextStr = JSON.stringify(runtimeContext);

  useEffect(() => {
    const run = async () => {
      if (!isValidJson(runtimeContextStr)) {
        toast.error('Invalid JSON');
        return;
      }

      const formatted = await formatJSON(runtimeContextStr);
      setRuntimeContextValue(formatted);
    };

    run();
  }, [runtimeContextStr]);

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

  const buttonClass = 'text-icon3 hover:text-icon6';

  const formatRuntimeContext = async () => {
    if (!isValidJson(runtimeContextValue)) {
      toast.error('Invalid JSON');
      return;
    }

    const formatted = await formatJSON(runtimeContextValue);
    setRuntimeContextValue(formatted);
  };

  return (
    <TempConditionalLayout newUIEnabled={newUIEnabled}>
      <div className="max-w-3xl p-5">
        <RuntimeContextInfo />
        <RuntimeContextEditor
          formatRuntimeContext={formatRuntimeContext}
          handleCopy={handleCopy}
          handleSaveRuntimeContext={handleSaveRuntimeContext}
        >
          <CodeMirror
            value={runtimeContextValue}
            onChange={setRuntimeContextValue}
            theme={theme}
            extensions={[jsonLanguage]}
            className="h-[400px] overflow-y-scroll bg-surface3 rounded-lg overflow-hidden p-3"
          />
        </RuntimeContextEditor>
      </div>
    </TempConditionalLayout>
  );
}

function TempConditionalLayout({ newUIEnabled, children }: { newUIEnabled: boolean; children: React.ReactNode }) {
  return newUIEnabled ? (
    <MainLayout>
      <MainHeader>
        <MainHeaderTitle>Runtime Context</MainHeaderTitle>
      </MainHeader>
      <MainContent>{children}</MainContent>
    </MainLayout>
  ) : (
    <MainContentLayout>
      <Header>
        <HeaderTitle>Runtime Context</HeaderTitle>
      </Header>
      <MainContentContent>{children}</MainContentContent>
    </MainContentLayout>
  );
}
