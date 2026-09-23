import type { FactoryWebActivity } from '@mastra/factory/telemetry-types';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

import { useApiConfig } from '../../../api/config';
import { useFactoryAuth } from '../../../hooks/useFactoryAuth';
import { telemetryPage } from './telemetry-page';

/** No persistence, anonymous tracking, input contents, or background heartbeat. */
export function FactoryWebTelemetry() {
  const { baseUrl } = useApiConfig();
  const { data: auth } = useFactoryAuth();
  const { pathname, key } = useLocation();
  const lastView = useRef<string | undefined>(undefined);
  const lastInteraction = useRef<{ userId: string; at: number } | undefined>(undefined);
  const page = telemetryPage(pathname);
  const userId = auth?.user?.userId;
  const enabled = auth?.authenticated && auth.telemetryEnabled === true;

  useEffect(() => {
    if (!enabled || !userId || !page) return;
    const visit = JSON.stringify([baseUrl, userId, key, pathname]);
    const currentPage = page;
    const currentUserId = userId;
    function capture(activity: FactoryWebActivity['activity']) {
      void fetch(`${baseUrl}/web/telemetry/activity`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity, page: currentPage } satisfies FactoryWebActivity),
      }).catch(() => {
        /* Analytics must not interrupt the UI. */
      });
    }
    function pageView() {
      if (document.visibilityState !== 'visible' || lastView.current === visit) return;
      lastView.current = visit;
      capture('page_view');
    }
    function interaction() {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (lastInteraction.current?.userId === currentUserId && now - lastInteraction.current.at < 60_000) return;
      lastInteraction.current = { userId: currentUserId, at: now };
      pageView();
      capture('interaction');
    }
    // Coalesce redirect chains and StrictMode effect replay before recording a view.
    const timer = window.setTimeout(pageView, 250);
    document.addEventListener('visibilitychange', pageView);
    document.addEventListener('pointerdown', interaction, { passive: true });
    document.addEventListener('keydown', interaction);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', pageView);
      document.removeEventListener('pointerdown', interaction);
      document.removeEventListener('keydown', interaction);
    };
  }, [enabled, userId, page, baseUrl, key, pathname]);

  return undefined;
}
