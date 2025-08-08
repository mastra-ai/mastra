import { Container } from './shared';
import Spinner from '@/components/ui/spinner';

type TemplateInstallationProps = {
  name: string;
};

export function TemplateInstallation({ name }: TemplateInstallationProps) {
  return (
    <Container className="grid items-center justify-items-center gap-[1rem] text-icon3 content-center">
      <Spinner />
      <p className="text-[0.875rem] text-center">
        Installing the <b className="text-icon5">{name}</b> template.
        <br /> This may take some time.
      </p>
    </Container>
  );
}
