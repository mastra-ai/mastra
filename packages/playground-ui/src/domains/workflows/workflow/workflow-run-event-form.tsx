import { Txt } from '@/ds/components/Txt';
import { useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { useCodemirrorTheme } from '@/components/syntax-highlighter';
import { jsonLanguage } from '@codemirror/lang-json';
import { Button } from '@/ds/components/Button';
import { Braces, CopyIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatJSON, isValidJson } from '@/lib/formatting';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icon } from '@/ds/icons';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

export type WorkflowSendEventFormProps = {
  event: string;
  runId: string;
  onSendEvent: (params: { event: string; data: unknown; runId: string }) => Promise<{ message: string }>;
};

export const WorkflowRunEventForm = ({ event, runId, onSendEvent }: WorkflowSendEventFormProps) => {
  const [eventData, setEventData] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = useCodemirrorTheme();

  const { handleCopy } = useCopyToClipboard({ text: eventData });

  const handleSendEvent = async () => {
    let data: unknown;

    setIsLoading(true);
    setError(null);
    try {
      data = JSON.parse(eventData);
    } catch (error) {
      setError('Invalid JSON');
      setIsLoading(false);
      return;
    }

    try {
      const result = await onSendEvent({ event, data, runId });
      toast.success(result.message);
    } catch (error) {
      console.error('Error sending event', error);
      setError('Error sending event');
    } finally {
      setIsLoading(false);
    }
  };

  const buttonClass = 'text-icon3 hover:text-icon6';

  const formatEventData = async () => {
    if (!isValidJson(eventData)) {
      setError('Invalid JSON');
      return;
    }

    const formatted = await formatJSON(eventData);
    setEventData(formatted);
  };

  return (
    <div>
      <div className="space-y-2">
        <div className="flex items-center justify-between pb-2">
          <Txt as="label" variant="ui-md" className="text-icon3">
            Event data (JSON)
          </Txt>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={formatEventData} className={buttonClass}>
                  <Icon>
                    <Braces />
                  </Icon>
                </button>
              </TooltipTrigger>
              <TooltipContent>Format the event data JSON</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={handleCopy} className={buttonClass}>
                  <Icon>
                    <CopyIcon />
                  </Icon>
                </button>
              </TooltipTrigger>
              <TooltipContent>Copy event data</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <CodeMirror
          value={eventData}
          onChange={setEventData}
          theme={theme}
          extensions={[jsonLanguage]}
          className="h-[400px] overflow-y-scroll bg-surface3 rounded-lg overflow-hidden p-3"
        />

        {error && (
          <Txt variant="ui-md" className="text-accent2">
            {error}
          </Txt>
        )}
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={handleSendEvent} disabled={isLoading}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
        </Button>
      </div>
    </div>
  );
};
