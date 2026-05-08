import { useSearchParams, useNavigate } from 'react-router';
import { LoginPage } from '@/domains/auth/components/login-page';

export function SignUp() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const redirectUri = searchParams.get('redirect') || '/';

  const handleSuccess = () => {
    // For full URLs, use window.location; for paths, use navigate
    if (redirectUri.startsWith('http')) {
      window.location.href = redirectUri;
    } else {
      void navigate(redirectUri, { replace: true });
    }
  };

  return <LoginPage redirectUri={redirectUri} onSuccess={handleSuccess} initialMode="signup" />;
}
