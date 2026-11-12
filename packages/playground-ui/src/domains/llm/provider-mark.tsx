import { ProviderLogo } from './provider-logo';
import { SeriesMark } from '@/ds/components/SeriesMark';

export type ProviderMarkProps = {
  /** The provider id, e.g. `openai` or `anthropic.messages`. */
  provider: string;
  /** The row's series color on a chart; neutral without one. */
  color?: string;
};

/**
 * A model's provider logo in a `SeriesMark`, for rows that name a model or provider. 13px: brand
 * logos are finer than entity glyphs, so they get a pixel more in the same 18px square.
 */
export function ProviderMark({ provider, color }: ProviderMarkProps) {
  return <SeriesMark color={color} icon={<ProviderLogo providerId={provider} size={13} />} />;
}
