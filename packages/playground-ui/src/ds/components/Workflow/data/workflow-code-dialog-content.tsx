import { javascript } from '@codemirror/lang-javascript';
import { jsonLanguage } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { useCodemirrorTheme } from '@/ds/components/CodeEditor';
import { CopyButton } from '@/ds/components/CopyButton';

export const WorkflowCodeContent = ({
  data,
  language = 'auto',
}: {
  data: unknown;
  language?: 'json' | 'javascript' | 'auto';
}) => {
  const theme = useCodemirrorTheme();

  const getExtensions = (content: string) => {
    if (language === 'javascript') {
      return [javascript(), EditorView.lineWrapping];
    }
    if (language === 'json') {
      return [jsonLanguage, EditorView.lineWrapping];
    }

    try {
      JSON.parse(content);
      return [jsonLanguage, EditorView.lineWrapping];
    } catch {
      if (
        content.includes('=>') ||
        content.includes('function') ||
        content.includes('const ') ||
        content.includes('return ')
      ) {
        return [javascript(), EditorView.lineWrapping];
      }
      return [EditorView.lineWrapping];
    }
  };

  if (typeof data !== 'string') {
    const content = JSON.stringify(data, null, 2);
    return (
      <div className="relative overflow-auto" style={{ maxHeight: 500 }}>
        <div className="bg-surface4 absolute top-2 right-2 z-10 rounded-full">
          <CopyButton content={content} />
        </div>
        <div className="bg-surface4 rounded-lg p-4">
          <CodeMirror value={content} theme={theme} extensions={[jsonLanguage, EditorView.lineWrapping]} />
        </div>
      </div>
    );
  }

  const extensions = getExtensions(data);

  let displayContent = data;
  try {
    const json = JSON.parse(data);
    displayContent = JSON.stringify(json, null, 2);
  } catch {}

  return (
    <div className="relative overflow-auto" style={{ maxHeight: 500 }}>
      <div className="bg-surface4 absolute top-2 right-2 z-10 rounded-full">
        <CopyButton content={data} />
      </div>
      <div className="bg-surface4 rounded-lg p-4">
        <CodeMirror value={displayContent} theme={theme} extensions={extensions} />
      </div>
    </div>
  );
};
