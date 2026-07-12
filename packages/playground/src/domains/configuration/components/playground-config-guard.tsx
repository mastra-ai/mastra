import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { StudioConfigForm } from './studio-config-form';

export const PlaygroundConfigGuard = () => {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-surface1">
      <div className="mx-auto w-full max-w-md px-4 pt-4">
        <div className="flex items-center justify-center pb-4">
          <LogoWithoutText className="size-32" />
        </div>
        <StudioConfigForm />
      </div>
    </div>
  );
};
