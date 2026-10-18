import { InlineCode } from '@mastra/playground-ui/components/InlineCode';
import { Notice } from '@mastra/playground-ui/components/Notice';

export function RegisteredMemoryNotice({ memoryId }: { memoryId: string }) {
  return (
    <Notice variant="info" title="Registered memory">
      <Notice.Message>
        Uses registered memory <InlineCode>{memoryId}</InlineCode>. Its settings are defined in code on the Mastra
        instance and can't be edited here.
      </Notice.Message>
    </Notice>
  );
}
