import type { ReactNode } from 'react';
import { CHAT_LAYOUT_SHORTCUTS, ChatLayout } from '../chat-layout';
import { Button } from '@/ds/components/Button';
import { ShortcutHint } from '@/ds/components/Kbd/shortcut-hint';
import { PageLayout } from '@/ds/components/PageLayout';
import { PanelEdgeIcon } from '@/lib/resize/panel-edge-icon';

interface DocumentEditorFrameProps {
  breadcrumbs: ReactNode;
  title: string;
  children: ReactNode;
}

/** Details is controlled: a Details card comes with its open state, so its toggles always work. */
type DocumentEditorDetailsState =
  | { details?: undefined; detailsOpen?: undefined; onDetailsOpenChange?: undefined }
  | { details: ReactNode; detailsOpen: boolean; onDetailsOpenChange: (open: boolean) => void };

export type DocumentEditorProps = DocumentEditorFrameProps & DocumentEditorDetailsState;

export function DocumentEditorRoot({
  breadcrumbs,
  title,
  details,
  detailsOpen = false,
  onDetailsOpenChange = () => undefined,
  children,
}: DocumentEditorProps) {
  return (
    <PageLayout variant="page" body="fixed" breadcrumbs={breadcrumbs}>
      <h1 className="sr-only">{title}</h1>
      <ChatLayout details={details} detailsOpen={detailsOpen} onDetailsOpenChange={onDetailsOpenChange}>
        {details && !detailsOpen ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Show details"
            tooltip={<ShortcutHint label="Show details" shortcut={CHAT_LAYOUT_SHORTCUTS.details} />}
            className="absolute top-2 right-2 z-10"
            onClick={() => onDetailsOpenChange(true)}
          >
            <PanelEdgeIcon side="right" />
          </Button>
        ) : null}
        {children}
      </ChatLayout>
    </PageLayout>
  );
}
