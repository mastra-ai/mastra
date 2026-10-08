import { SignInContent } from '../domains/auth/components/SignInContent';
import { SignInLayout } from '../domains/auth/components/SignInLayout';

export function SignInPage() {
  return (
    <SignInLayout>
      <SignInContent />
    </SignInLayout>
  );
}
