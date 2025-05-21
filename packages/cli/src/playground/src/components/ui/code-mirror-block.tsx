import ReactCodeMirror, { ReactCodeMirrorProps } from '@uiw/react-codemirror';
import { useCodemirrorTheme } from '@/components/syntax-highlighter';
import { json } from '@codemirror/lang-json';
import { CopyButton } from './copy-button';

export const CodeMirrorBlock = (props: ReactCodeMirrorProps) => {
  const theme = useCodemirrorTheme();

  return (
    <div className="rounded-lg border-sm border-border1 bg-surface3 p-4 relative">
      <div className="absolute top-4 right-4 z-10">
        <CopyButton tooltip="Copy code" content={props.value || 'No content'} />
      </div>
      <ReactCodeMirror extensions={[json()]} theme={theme} {...props} />
    </div>
  );
};
