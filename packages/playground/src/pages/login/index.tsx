import { useSearchParams, useNavigate } from 'react-router';
import { LoginPage } from '@/domains/auth/components/login-page';

export function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const redirectUri = searchParams.get('redirect') || '/';
  const mode = searchParams.get('mode');
  const initialMode = mode === 'signup' ? 'signup' : 'signin';
  const errorMessage = searchParams.get('error_description') || searchParams.get('error') || null;

  const handleSuccess = () => {
    // For full URLs, use window.location; for paths, use navigate
    if (redirectUri.startsWith('http')) {
      window.location.href = redirectUri;
    } else {
      void navigate(redirectUri, { replace: true });
    }
  };

  return (
    <LoginPage
      redirectUri={redirectUri}
      onSuccess={handleSuccess}
      initialMode={initialMode}
      errorMessage={errorMessage}
    />
  );
}
