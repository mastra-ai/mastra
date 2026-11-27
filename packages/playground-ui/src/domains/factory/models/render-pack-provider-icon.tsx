import { ProviderBrandIcon } from './provider-brand-icon';
import { IconBox } from '@/ds/icons/central/IconBox';

export const renderPackProviderIcon = (provider: string) => (
  <ProviderBrandIcon provider={provider} fallback={<IconBox className="size-icon-md" />} />
);
