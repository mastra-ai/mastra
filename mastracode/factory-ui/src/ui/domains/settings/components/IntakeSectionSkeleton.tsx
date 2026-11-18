import { SettingsContainer, SettingsSkeleton } from '@mastra/playground-ui/new/settings';

export function IntakeSourcesSkeleton() {
  return Array.from({ length: 5 }, (_, index) => (
    <SettingsContainer key={index} aria-hidden>
      <SettingsSkeleton label="Loading intake source" variant="item" rows={1} />
    </SettingsContainer>
  ));
}
