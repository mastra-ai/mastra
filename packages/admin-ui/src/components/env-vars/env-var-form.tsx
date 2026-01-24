import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

const envVarFormSchema = z.object({
  key: z
    .string()
    .min(1, 'Key is required')
    .max(100, 'Key must be less than 100 characters')
    .regex(
      /^[A-Z][A-Z0-9_]*$/,
      'Key must start with an uppercase letter and contain only uppercase letters, numbers, and underscores',
    ),
  value: z.string().min(1, 'Value is required'),
  isSecret: z.boolean(),
});

type EnvVarFormValues = z.infer<typeof envVarFormSchema>;

interface EnvVarFormProps {
  defaultValues?: Partial<EnvVarFormValues>;
  onSubmit: (values: EnvVarFormValues) => void | Promise<void>;
  loading?: boolean;
  trigger?: React.ReactNode;
  title?: string;
  description?: string;
}

export function EnvVarForm({
  defaultValues,
  onSubmit,
  loading = false,
  trigger,
  title = 'Add Environment Variable',
  description = 'Add a new environment variable to your project.',
}: EnvVarFormProps) {
  const [open, setOpen] = useState(false);
  const isEdit = !!defaultValues?.key;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<EnvVarFormValues>({
    resolver: zodResolver(envVarFormSchema),
    defaultValues: {
      key: '',
      value: '',
      isSecret: false,
      ...defaultValues,
    },
  });

  const isSecret = watch('isSecret');

  const handleFormSubmit = async (values: EnvVarFormValues) => {
    await onSubmit(values);
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Variable
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="key">Key</Label>
            <Input id="key" placeholder="MY_VARIABLE" {...register('key')} disabled={isEdit} className="font-mono" />
            {errors.key && <p className="text-sm text-red-500">{errors.key.message}</p>}
            <p className="text-xs text-neutral6">Use SCREAMING_SNAKE_CASE (e.g., API_KEY, DATABASE_URL)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">Value</Label>
            <Textarea
              id="value"
              placeholder="Enter value..."
              {...register('value')}
              className="font-mono min-h-[100px]"
            />
            {errors.value && <p className="text-sm text-red-500">{errors.value.message}</p>}
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Secret</Label>
              <p className="text-xs text-neutral6">Encrypt and hide the value from logs</p>
            </div>
            <Switch checked={isSecret} onCheckedChange={checked => setValue('isSecret', checked)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
