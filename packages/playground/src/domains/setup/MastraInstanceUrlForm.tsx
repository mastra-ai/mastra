import { Button, Icon, InputField, LogoWithoutText } from '@mastra/playground-ui';
import { Link2 } from 'lucide-react';

export interface MastraInstanceUrlFormProps {
  onSetUrl: (url: string) => void;
}

export const MastraInstanceUrlForm = ({ onSetUrl }: MastraInstanceUrlFormProps) => {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const url = formData.get('url') as string;
    onSetUrl(url);
  };

  return (
    <div className="flex flex-col h-screen w-full items-center justify-center bg-surface1">
      <LogoWithoutText className="size-32" />
      <form onSubmit={handleSubmit} className="max-w-md w-full mx-auto px-4 pt-4 space-y-4">
        <InputField name="url" label="Mastra instance URL" placeholder="e.g: http://localhost:4111" required />

        <Button type="submit" variant="light" className="w-full" size="lg">
          <Icon>
            <Link2 />
          </Icon>
          Set URL
        </Button>
      </form>
    </div>
  );
};
