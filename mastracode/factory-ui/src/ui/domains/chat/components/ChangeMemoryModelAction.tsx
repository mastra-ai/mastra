import { Button } from '@mastra/playground-ui/components/Button';
import { IconArrowRight } from '@mastra/playground-ui/icons/central/IconArrowRight';
import { Link, useLocation } from 'react-router';

import { settingsSectionPath } from '../../settings/settingsSections';
import { useChatModelScope } from '../context/useChatModelScope';

/** Observer and reflector models come from Memory settings, not the session model picker. */
export function ChangeMemoryModelAction() {
  const location = useLocation();
  const { factoryId } = useChatModelScope();
  if (!factoryId) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      render={<Link to={settingsSectionPath(factoryId, 'memory')} state={{ from: location }} />}
      iconEnd={<IconArrowRight aria-hidden="true" />}
    >
      Change memory model
    </Button>
  );
}
