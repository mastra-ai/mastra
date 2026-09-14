import { Badge } from '@mastra/playground-ui/components/Badge';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import { Link, useParams } from 'react-router';

import { useOMQuery } from '../../../../hooks/use-om';
import type { AvailableModelOption } from '../../../../hooks/useAvailableModels';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { settingsSectionPath } from '../settingsSections';

/** Setup seeds these behind the Factory model pick and a run fails on either, so they sit next to it; the Memory page owns the edits. */
export function FactoryMemoryModelRow({ models }: { models: AvailableModelOption[] }) {
  const { factoryId } = useParams<{ factoryId: string }>();
  const omQuery = useOMQuery(undefined, undefined, factoryId);

  if (!factoryId) return null;

  const config = omQuery.data?.config;
  const roles = config
    ? [
        { role: 'Observer', modelId: config.observerModelId },
        { role: 'Reflector', modelId: config.reflectorModelId },
      ]
    : [];
  const configuredModelIds = new Set(models.map(model => model.id));
  const credentialsMissing = roles.some(({ modelId }) => !configuredModelIds.has(modelId));
  const error = omQuery.error instanceof Error ? omQuery.error.message : undefined;

  return (
    <SettingsRow
      label="Observational memory"
      description={
        <>
          <span>
            Factory runs summarize and retain context with these models. Thresholds and changes live on the Memory page.
          </span>
          {error && (
            <Txt as="span" variant="ui-xs" className="text-notice-destructive-fg">
              {error}
            </Txt>
          )}
          {credentialsMissing && (
            <span className="flex items-center gap-2 pt-1">
              <Badge size="xs" variant="yellow">
                Model credentials required
              </Badge>
              <Txt as="span" variant="ui-xs" className="text-icon3">
                Memory calls in Factory runs fail until credentials are configured.
              </Txt>
            </span>
          )}
        </>
      }
    >
      <div className="flex w-full max-w-72 flex-col gap-1.5 lg:items-end">
        {omQuery.isPending ? (
          <SkeletonRows label="Loading observational-memory models" rows={2} rowClassName="h-4 w-48" />
        ) : (
          <dl className="text-ui-sm grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5">
            {roles.map(({ role, modelId }) => (
              <Fragment key={role}>
                <dt className="text-icon3">{role}</dt>
                <dd className="text-icon6 m-0 min-w-0 truncate">{modelId}</dd>
              </Fragment>
            ))}
          </dl>
        )}
        <Link
          to={`${settingsSectionPath(factoryId, 'memory')}?scope=factory`}
          className="text-ui-sm text-icon4 hover:text-icon5 flex items-center gap-1"
        >
          Memory settings
          <ChevronRight size={14} aria-hidden />
        </Link>
      </div>
    </SettingsRow>
  );
}
