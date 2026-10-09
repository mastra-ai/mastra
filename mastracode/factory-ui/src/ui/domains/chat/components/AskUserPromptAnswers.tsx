import * as AskUser from '@mastra/playground-ui/components/ai/ask-user';
import type { AskUserPayload } from '@mastra/playground-ui/components/ai/ask-user';

export function AskUserPromptAnswers({
  options,
  selectionMode,
}: {
  options: NonNullable<AskUserPayload['options']>;
  selectionMode: AskUserPayload['selectionMode'];
}) {
  if (options.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <AskUser.TextAnswer />
        <AskUser.Submit className="shrink-0 whitespace-nowrap" />
      </div>
    );
  }

  const isMultiSelect = selectionMode === 'multi_select';

  return (
    <>
      <AskUser.Options>
        {options.map(option => (
          <AskUser.Option key={option.label} value={option.label} description={option.description}>
            {option.label}
          </AskUser.Option>
        ))}
        <AskUser.CustomAnswer />
        {isMultiSelect ? <AskUser.Submit className="mt-1 justify-self-start" /> : null}
      </AskUser.Options>
      {!isMultiSelect ? <AskUser.Submit when="custom-answer" className="mt-2" /> : null}
    </>
  );
}
