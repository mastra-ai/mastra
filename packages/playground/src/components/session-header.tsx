import { Header, HeaderAction, HeaderTitle } from '@mastra/playground-ui/components/Header';
import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { useMemo } from 'react';
import { AuthStatus } from '@/domains/auth/components/auth-status';
import { useRequestContextPresets } from '@/domains/request-context/hooks/use-request-context-presets';
import { usePlaygroundStore } from '@/store/playground-store';

const CUSTOM_PRESET_KEY = '__custom__';

export const SessionHeader = () => {
  const presets = useRequestContextPresets();
  const { requestContext, setRequestContext } = usePlaygroundStore();

  const selectedPreset = useMemo(() => {
    if (!presets) return CUSTOM_PRESET_KEY;

    const requestContextStr = JSON.stringify(requestContext ?? {});

    for (const [presetKey, presetValue] of Object.entries(presets)) {
      if (JSON.stringify(presetValue) === requestContextStr) {
        return presetKey;
      }
    }

    return CUSTOM_PRESET_KEY;
  }, [presets, requestContext]);

  const handlePresetChange = (presetKey: string) => {
    if (presetKey === CUSTOM_PRESET_KEY) {
      setRequestContext({});
      return;
    }

    if (!presets) return;

    const presetValue = presets[presetKey];
    if (!presetValue) return;

    setRequestContext(presetValue);
  };

  return (
    <Header>
      <HeaderTitle>
        <LogoWithoutText className="h-5 w-8 shrink-0" />
        Mastra Studio
        <AuthStatus />
      </HeaderTitle>

      {presets && Object.keys(presets).length > 0 && (
        <HeaderAction>
          <Select value={selectedPreset} onValueChange={handlePresetChange}>
            <SelectTrigger size="sm" className="w-50">
              <SelectValue placeholder="Select a preset..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CUSTOM_PRESET_KEY}>Custom</SelectItem>
              {Object.keys(presets).map(key => (
                <SelectItem key={key} value={key}>
                  {key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </HeaderAction>
      )}
    </Header>
  );
};
