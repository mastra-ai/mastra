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
        <div className="max-w-2xl mx-auto w-full mt-[4vh]">
          <StudioConfigForm initialConfig={{ baseUrl, headers }} />
        </div>
      </MainContentContent>
    </MainContentLayout>
  );
};
