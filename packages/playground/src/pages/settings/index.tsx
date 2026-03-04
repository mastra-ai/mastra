import {
  useStudioConfig,
  StudioConfigForm,
  MainContentLayout,
  Header,
  HeaderTitle,
  Icon,
  SettingsIcon,
  MainContentContent,
} from '@mastra/playground-ui';

export const StudioSettingsPage = () => {
  const { baseUrl, headers } = useStudioConfig();

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <SettingsIcon />
          </Icon>
          Settings
        </HeaderTitle>
      </Header>
      <MainContentContent>
        <div className="p-5">
          <div className="max-w-2xl p-5 w-full bg-surface3 border border-border1 rounded-lg">
            <StudioConfigForm initialConfig={{ baseUrl, headers }} />
          </div>
        </div>
      </MainContentContent>
    </MainContentLayout>
  );
};
