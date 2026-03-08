import {
  AuthStatus,
  Header,
  HeaderTitle,
  HeaderAction,
  LogoWithoutText,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  usePlaygroundStore,
  useRequestContextPresets,
} from '@mastra/playground-ui';

export const SessionHeader = () => {
  const presets = useRequestContextPresets();
  const { setRequestContext } = usePlaygroundStore();

  const handlePresetChange = (presetKey: string) => {
    if (!presets || presetKey === '__custom__') return;
    const presetValue = presets[presetKey];
    if (presetValue) {
      setRequestContext(presetValue);
    }
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
          <Select onValueChange={handlePresetChange}>
            <SelectTrigger size="sm" className="w-[200px]">
              <SelectValue placeholder="Select a preset..." />
            </SelectTrigger>
            <SelectContent>
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
