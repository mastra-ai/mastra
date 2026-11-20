import { Header, HeaderTitle } from '@mastra/playground-ui/components/Header';
import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { AuthStatus } from '@/domains/auth/components/auth-status';

export const SessionHeader = () => {
  return (
    <Header>
      <HeaderTitle>
        <LogoWithoutText className="h-5 w-8 shrink-0" />
        Mastra Studio
        <AuthStatus />
      </HeaderTitle>
    </Header>
  );
};
