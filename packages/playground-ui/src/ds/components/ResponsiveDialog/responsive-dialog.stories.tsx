import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from './responsive-dialog';
import { Button } from '@/ds/components/Button';

function DefaultResponsiveDialog() {
  return (
    <ResponsiveDialog>
      <ResponsiveDialogTrigger render={<Button>Open</Button>} />
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Edit agent instructions</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>Changes apply to every thread that uses this agent.</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>
          <p>Resize below 640px and this dialog becomes a bottom drawer you can swipe down to close.</p>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <ResponsiveDialogClose render={<Button variant="ghost">Cancel</Button>} />
          <ResponsiveDialogClose render={<Button>Save</Button>} />
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

const meta = {
  title: 'Feedback/ResponsiveDialog',
  component: DefaultResponsiveDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A `Dialog` above 640px, a bottom `Drawer` below it. Same parts as `Dialog`, prefixed `ResponsiveDialog`. Open state survives crossing the breakpoint. Use the viewport toolbar to switch.',
      },
    },
  },
} satisfies Meta<typeof DefaultResponsiveDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
