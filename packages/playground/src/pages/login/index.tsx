import { useSearchParams, useNavigate } from 'react-router';
import { LoginPage } from '@mastra/playground-ui';

export function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const redirectUri = searchParams.get('redirect') || '/';
  const mode = searchParams.get('mode');
  const initialMode = mode === 'signup' ? 'signup' : 'signin';

  const handleSuccess = () => {
    // For full URLs, use window.location; for paths, use navigate
    if (redirectUri.startsWith('http')) {
      window.location.href = redirectUri;
    } else {
      navigate(redirectUri, { replace: true });
    }
  };

  return <LoginPage redirectUri={redirectUri} onSuccess={handleSuccess} initialMode={initialMode} />;
}
