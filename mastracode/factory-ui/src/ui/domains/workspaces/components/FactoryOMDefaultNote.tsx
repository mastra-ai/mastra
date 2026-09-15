import { Txt } from '@mastra/playground-ui/components/Txt';

import { useProviderOMDefaultQuery } from '../../../../hooks/use-om';

/** The pick also seeds the observational-memory model (`POST /web/config/om/provider-defaults`); say so before it lands. */
export function FactoryOMDefaultNote({ providerId, factoryModelId }: { providerId: string; factoryModelId?: string }) {
  const preview = useProviderOMDefaultQuery(providerId, factoryModelId);
  const pack = preview.data?.pack;
  if (!pack) return null;

  const followsPick = pack.id === 'custom' && !factoryModelId;

  return (
    <Txt as="p" variant="ui-sm" className="text-icon4 m-0" role="note">
      {followsPick ? (
        <>Factory runs also summarize their context with the model you pick.</>
      ) : (
        <>
          Factory runs also summarize their context with <span className="text-icon5">{pack.modelId}</span>. Change it
          later in Memory settings.
        </>
      )}
    </Txt>
  );
}
