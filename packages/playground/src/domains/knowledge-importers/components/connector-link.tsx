import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ExternalLinkIcon } from 'lucide-react';
import { useImporterConnectUrl } from '../use-knowledge-importers';

/** Connectors are linked on the Mastra Platform, never here: link out when the server knows where, else say so. */
export function ConnectorLink() {
  const connectUrl = useImporterConnectUrl();
  if (!connectUrl) {
    return (
      <Txt variant="caption" tone="muted">
        Link connectors to this project on the Mastra Platform.
      </Txt>
    );
  }
  return (
    <Button
      variant="ghost"
      render={<a href={connectUrl} target="_blank" rel="noopener noreferrer" />}
      icon={<ExternalLinkIcon />}
    >
      Add or link a connector
    </Button>
  );
}
