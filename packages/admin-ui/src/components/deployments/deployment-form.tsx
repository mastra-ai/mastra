import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DeploymentType, type CreateDeploymentInput } from '@/types/api';

const deploymentFormSchema = z.object({
  type: z.nativeEnum(DeploymentType),
  branch: z.string().min(1, 'Branch is required'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50, 'Slug must be less than 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
    .optional(),
  autoShutdown: z.boolean().optional(),
});

type DeploymentFormValues = z.infer<typeof deploymentFormSchema>;

interface DeploymentFormProps {
  defaultBranch?: string;
  onSubmit: (values: CreateDeploymentInput) => void | Promise<void>;
  loading?: boolean;
  submitText?: string;
}

export function DeploymentForm({
  defaultBranch = 'main',
  onSubmit,
  loading = false,
  submitText = 'Create Deployment',
}: DeploymentFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<DeploymentFormValues>({
    resolver: zodResolver(deploymentFormSchema),
    defaultValues: {
      type: DeploymentType.PREVIEW,
      branch: defaultBranch,
      slug: '',
      autoShutdown: true,
    },
  });

  const selectedType = watch('type');
  const autoShutdown = watch('autoShutdown');

  // Auto-generate slug from branch
  const handleBranchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    setValue('slug', slug);
  };

  const handleFormSubmit = (values: DeploymentFormValues) => {
    onSubmit({
      type: values.type,
      branch: values.branch,
      slug: values.slug,
      autoShutdown: values.autoShutdown,
    });
  };

  const typeOptions = [
    { value: DeploymentType.PRODUCTION, label: 'Production', description: 'Live environment for end users' },
    { value: DeploymentType.STAGING, label: 'Staging', description: 'Pre-production testing environment' },
    { value: DeploymentType.PREVIEW, label: 'Preview', description: 'Temporary environment for feature branches' },
  ];

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label>Deployment Type</Label>
        <Select value={selectedType} onValueChange={(value: DeploymentType) => setValue('type', value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                <div>
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-neutral6">{option.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="branch">Branch</Label>
        <Input
          id="branch"
          placeholder="main"
          {...register('branch', {
            onChange: handleBranchChange,
          })}
        />
        {errors.branch && <p className="text-sm text-red-500">{errors.branch.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Deployment Slug</Label>
        <Input id="slug" placeholder="my-deployment" {...register('slug')} />
        {errors.slug && <p className="text-sm text-red-500">{errors.slug.message}</p>}
        <p className="text-xs text-neutral6">Used in the deployment URL. Leave empty to auto-generate.</p>
      </div>

      {selectedType === DeploymentType.PREVIEW && (
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Auto Shutdown</Label>
            <p className="text-xs text-neutral6">Automatically stop after 24 hours of inactivity</p>
          </div>
          <Switch checked={autoShutdown} onCheckedChange={checked => setValue('autoShutdown', checked)} />
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Creating...' : submitText}
      </Button>
    </form>
  );
}
