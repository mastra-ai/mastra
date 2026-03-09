import { LogoWithoutText } from '@/ds/components/Logo/MastraLogo';
import { StudioConfigForm } from './studio-config-form';

export const PlaygroundConfigGuard = () => {
  return (
    <div className="flex flex-col h-screen w-full items-center justify-center bg-surface1">
      <div className="max-w-md w-full mx-auto px-4 pt-4">
        <div className="flex items-center justify-center pb-4">
          <LogoWithoutText className="size-32" />
        </div>
        <StudioConfigForm />
      </div>
    </div>
  );
};
