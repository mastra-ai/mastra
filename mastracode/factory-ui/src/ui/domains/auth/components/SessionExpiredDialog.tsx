import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { useNavigate } from 'react-router';

export function SessionExpiredDialog({ returnTo }: { returnTo: string }) {
  const navigate = useNavigate();

  return (
    <AlertDialog open>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Session expired</AlertDialog.Title>
          <AlertDialog.Description>
            You’re no longer signed in. Factory has stopped receiving updates. Sign in again to continue where you left
            off.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Action onClick={() => void navigate(`/signin?returnTo=${encodeURIComponent(returnTo)}`)}>
            Sign in again
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}
