import { Terminal, Wand2, MessageSquare } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

import { useCopyToClipboard } from '@/hooks/use-clipboard';

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
  const { copiedMap, copyToClipboard } = useCopyToClipboard();
  const currentContent = enhancedPrompt || instructions?.trim();

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <h3 className="text-sm font-medium text-mastra-el-5">Current Instructions</h3>
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

      <ScrollArea className="h-[180px] rounded-md border bg-mastra-bg-2">
        <div
          className="p-2 cursor-pointer hover:bg-mastra-bg-3/50 transition-colors group relative"
          onClick={() => currentContent && copyToClipboard(currentContent, -1)}
        >
          <pre className="text-xs whitespace-pre-wrap font-mono">{currentContent}</pre>
          {enhancedPrompt && (
            <div className="mt-1.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500">
                Draft - Save changes to apply
              </span>
            </div>
          )}
          {copiedMap[-1] && (
            <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-500">
              Copied!
            </span>
          )}
          <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-full bg-mastra-bg-3 text-mastra-el-4 opacity-0 group-hover:opacity-100 transition-opacity">
            Click to copy
          </span>
        </div>
      </ScrollArea>

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
          <textarea
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
