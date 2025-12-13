import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { CopyButton } from '@/components/ui/copy-button';
import { useCodemirrorTheme } from '@/components/syntax-highlighter';
import { jsonLanguage } from '@codemirror/lang-json';
import { javascript } from '@codemirror/lang-javascript';

export const CodeDialogContent = ({
  data,
  language = 'auto',
}: {
  data: any;
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
    // Auto-detect: try JSON first, fall back to JavaScript for code-like content
    try {
      JSON.parse(content);
      return [jsonLanguage, EditorView.lineWrapping];
    } catch {
      // Check if it looks like JavaScript/TypeScript code
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
      <div className="max-h-[500px] overflow-auto relative p-4">
        <div className="absolute right-2 top-2 bg-surface4 rounded-full z-10">
          <CopyButton content={content} />
        </div>
        <div className="bg-surface4 rounded-lg p-4">
          <CodeMirror value={content} theme={theme} extensions={[jsonLanguage, EditorView.lineWrapping]} />
        </div>
      </div>
    );
  }

  const extensions = getExtensions(data);

  // Try to format JSON if it's valid JSON
  let displayContent = data;
  try {
    const json = JSON.parse(data);
    displayContent = JSON.stringify(json, null, 2);
  } catch {
    // Keep original content
  }

  return (
    <div className="max-h-[500px] overflow-auto relative p-4">
      <div className="absolute right-2 top-2 bg-surface4 rounded-full z-10">
        <CopyButton content={data} />
      </div>
      <div className="bg-surface4 rounded-lg p-4">
        <CodeMirror value={displayContent} theme={theme} extensions={extensions} />
      </div>
    </div>
  );
};
