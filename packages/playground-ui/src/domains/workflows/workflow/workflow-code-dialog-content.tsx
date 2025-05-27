import CodeMirror from '@uiw/react-codemirror';
import { CopyButton } from '@/components/ui/copy-button';
import { useCodemirrorTheme } from '@/components/syntax-highlighter';
import { jsonLanguage } from '@codemirror/lang-json';

export const CodeDialogContent = ({ data }: { data: any }) => {
  const theme = useCodemirrorTheme();

  if (typeof data !== 'string') {
    return (
      <div className="max-h-[500px] overflow-auto relative p-4">
        <div className="absolute right-2 top-2 bg-surface4 rounded-full z-10">
          <CopyButton content={JSON.stringify(data, null, 2)} />
        </div>
        <div className="bg-surface4 rounded-lg p-4">
          <CodeMirror value={JSON.stringify(data, null, 2)} theme={theme} extensions={[jsonLanguage]} />
        </div>
      </div>
    );
  }

  try {
    const json = JSON.parse(data);
    return (
      <div className="max-h-[500px] overflow-auto relative p-4">
        <div className="absolute right-2 top-2 bg-surface4 rounded-full z-10">
          <CopyButton content={data} />
        </div>
        <div className="bg-surface4 rounded-lg p-4">
          <CodeMirror value={JSON.stringify(json, null, 2)} theme={theme} extensions={[jsonLanguage]} />
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="max-h-[500px] overflow-auto relative p-4">
        <div className="absolute right-2 top-2 bg-surface4 rounded-full z-10">
          <CopyButton content={data} />
        </div>
        <div className="bg-surface4 rounded-lg p-4">
          <CodeMirror value={data} theme={theme} extensions={[]} />
        </div>
      </div>
    );
  }
};
