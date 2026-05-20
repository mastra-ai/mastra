import { Txt } from '@mastra/playground-ui';

export interface BrowserProps {
  editable?: boolean;
}

export const Browser = ({ editable: _editable = true }: BrowserProps) => {
  return (
    <div className="flex h-full min-h-0 items-center justify-center px-6" data-testid="browser-detail-picker">
      <Txt variant="ui-md" className="text-neutral3">
        Browser configuration coming soon
      </Txt>
    </div>
  );
};
