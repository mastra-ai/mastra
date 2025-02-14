import { Terminal, Wand2, MessageSquare } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CodeDisplay } from '@/components/ui/code-display';
import { Textarea } from '@/components/ui/textarea';

import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

interface CurrentInstructionsProps {
  instructions?: string;
  enhancedPrompt: string;
  isEnhancing: boolean;
  showCommentInput: boolean;
  userComment: string;
  onEnhance: () => void;
  onCancel: () => void;
  onSave: () => void;
  onCommentToggle: () => void;
  onCommentChange: (comment: string) => void;
}

export function CurrentInstructions({
  instructions,
  enhancedPrompt,
  isEnhancing,
  showCommentInput,
  userComment,
  onEnhance,
  onCancel,
  onSave,
  onCommentToggle,
  onCommentChange,
}: CurrentInstructionsProps) {
  const currentContent = enhancedPrompt || instructions?.trim();

  const { isCopied, handleCopy } = useCopyToClipboard({ text: currentContent || '' });

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <h3 className="text-sm font-medium text-mastra-el-5"> Current Instructions </h3>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={onEnhance}
          disabled={isEnhancing || !instructions}
          className="bg-[#6366F1] hover:bg-[#6366F1]/90 text-white font-medium"
        >
          {isEnhancing ? (
            <>
              <Terminal className="mr-2 h-3 w-3 animate-spin" />
              Enhancing...
            </>
          ) : (
            <>
              <Wand2 className="mr-2 h-3 w-3" />
              Enhance
            </>
          )}
        </Button>
      </div>

      <div className="space-y-2">
        <CodeDisplay
          content={currentContent || ''}
          isCopied={isCopied}
          isDraft={!!enhancedPrompt}
          onCopy={() => currentContent && handleCopy()}
        />
      </div>

      <div className="flex items-center justify-between mt-1.5">
        {enhancedPrompt && (
          <div className="flex space-x-1.5">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={!enhancedPrompt}>
              Save
            </Button>
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={onCommentToggle} className="text-mastra-el-4 hover:text-mastra-el-5">
          <MessageSquare className="h-3 w-3 mr-1" />
          {showCommentInput ? 'Hide Comment' : 'Add Comment'}
        </Button>
      </div>

      {showCommentInput && (
        <div className="mt-1.5 bg-mastra-bg-1/50 p-2 rounded-lg border border-mastra-bg-3 shadow-sm">
          <Textarea
            value={userComment}
            onChange={e => onCommentChange(e.target.value)}
            placeholder="Add your comments or requirements for enhancing the prompt..."
            className="w-full h-16 px-3 py-2 text-xs rounded-md bg-mastra-bg-2 border border-mastra-bg-3 text-mastra-el-5 placeholder:text-mastra-el-3 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30 focus:border-[#6366F1] transition-all"
          />
        </div>
      )}
    </div>
  );
}
