import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const teamFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name must be less than 50 characters'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50, 'Slug must be less than 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
    .optional(),
});

type TeamFormValues = z.infer<typeof teamFormSchema>;

interface TeamFormProps {
  defaultValues?: Partial<TeamFormValues>;
  onSubmit: (values: TeamFormValues) => void | Promise<void>;
  loading?: boolean;
  submitText?: string;
}

export function TeamForm({ defaultValues, onSubmit, loading = false, submitText = 'Create Team' }: TeamFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<TeamFormValues>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: {
      name: '',
      slug: '',
      ...defaultValues,
    },
  });

  const name = watch('name');

  // Auto-generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!defaultValues?.slug) {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      setValue('slug', slug);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Team Name</Label>
        <Input
          id="name"
          placeholder="My Awesome Team"
          {...register('name', {
            onChange: handleNameChange,
          })}
        />
        {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Slug</Label>
        <div className="flex items-center">
          <span className="text-neutral6 text-sm mr-1">/</span>
          <Input id="slug" placeholder="my-awesome-team" {...register('slug')} />
        </div>
        {errors.slug && <p className="text-sm text-red-500">{errors.slug.message}</p>}
        <p className="text-xs text-neutral6">
          This will be used in URLs. Only lowercase letters, numbers, and hyphens.
        </p>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Creating...' : submitText}
      </Button>
    </form>
  );
}
