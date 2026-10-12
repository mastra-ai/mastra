import { Button } from '@mastra/playground-ui/components/Button';
import { PanelEdgeIcon } from '@mastra/playground-ui/resize/panel-edge-icon';
import { useContext } from 'react';
import { FeatureNavigationContext } from './feature-navigation-context';

export function FeatureNavigationToggle() {
  const navigation = useContext(FeatureNavigationContext);
  if (!navigation) return null;
  const label = navigation.collapsed ? 'Expand navigation' : 'Collapse navigation';
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="shrink-0"
      aria-label={label}
      aria-expanded={!navigation.collapsed}
      tooltip={label}
      onClick={navigation.toggle}
    >
      <PanelEdgeIcon side="left" />
    </Button>
  );
}
