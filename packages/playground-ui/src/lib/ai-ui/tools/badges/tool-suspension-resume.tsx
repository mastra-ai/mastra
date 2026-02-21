import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons';
import { useToolCall } from '@/services/tool-call-provider';
import { Play } from 'lucide-react';
import { useState } from 'react';
import { CodeEditor } from '@/ds/components/CodeEditor';

export interface ToolSuspensionResumeProps {
  toolCallId: string;
  suspendedToolMetadata: {
    toolCallId: string;
    toolName: string;
    args: Record<string, any>;
    suspendPayload: any;
    resumeSchema?: any;
  };
  toolCalled: boolean;
}

export const ToolSuspensionResume = ({ toolCallId, suspendedToolMetadata, toolCalled }: ToolSuspensionResumeProps) => {
  const { resumeToolSuspension, isRunning, toolSuspensionResumes } = useToolCall();
  const [resumeDataText, setResumeDataText] = useState('{}');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const resumeStatus = toolSuspensionResumes?.[toolCallId]?.status;

  const handleResume = () => {
    try {
      const parsed = JSON.parse(resumeDataText);
      setJsonError(null);
      resumeToolSuspension(parsed, toolCallId);
    } catch {
      setJsonError('Invalid JSON');
    }
  };

  if (toolCalled || !suspendedToolMetadata) return null;

  return (
    <div>
      <p className="font-medium pb-2">Resume tool execution</p>

      {suspendedToolMetadata.resumeSchema && (
        <div className="pb-2">
          <p className="text-xs text-text4 pb-1">Expected resume schema:</p>
          <CodeEditor data={suspendedToolMetadata.resumeSchema} data-testid="tool-resume-schema" />
        </div>
      )}

      <div className="pb-2">
        <textarea
          className="w-full min-h-[80px] bg-surface4 p-3 rounded-md font-mono text-xs text-text1 border border-border1 focus:border-accent6 focus:outline-none resize-y"
          value={resumeDataText}
          onChange={e => {
            setResumeDataText(e.target.value);
            setJsonError(null);
          }}
          placeholder='Enter resume data as JSON, e.g. {"name": "John"}'
          disabled={isRunning || !!resumeStatus}
        />
        {jsonError && <p className="text-xs text-accent2 pt-1">{jsonError}</p>}
      </div>

      <Button onClick={handleResume} disabled={isRunning || !!resumeStatus}>
        <Icon>
          <Play />
        </Icon>
        {resumeStatus === 'submitted' ? 'Resumed' : 'Resume'}
      </Button>
    </div>
  );
};
