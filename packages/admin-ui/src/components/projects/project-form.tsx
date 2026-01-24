import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SourcePicker } from './source-picker';
import { SourceType, type ProjectSource, type CreateProjectInput } from '@/types/api';

const projectFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name must be less than 50 characters'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50, 'Slug must be less than 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
    .optional(),
  defaultBranch: z.string().optional(),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

interface ProjectFormProps {
  sources: ProjectSource[];
  sourcesLoading?: boolean;
  selectedSource?: ProjectSource;
  onSelectSource: (source: ProjectSource) => void;
  validationState?: 'idle' | 'validating' | 'valid' | 'invalid';
  validationMessage?: string;
  onSubmit: (values: CreateProjectInput) => void | Promise<void>;
  loading?: boolean;
  submitText?: string;
}

export function ProjectForm({
  sources,
  sourcesLoading = false,
  selectedSource,
  onSelectSource,
  validationState = 'idle',
  validationMessage,
  onSubmit,
  loading = false,
  submitText = 'Create Project',
}: ProjectFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: '',
      slug: '',
      defaultBranch: 'main',
    },
  });

  const handleSourceSelect = (source: ProjectSource) => {
    onSelectSource(source);
    setValue('name', source.name);
    const slug = source.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    setValue('slug', slug);
    if (source.defaultBranch) {
      setValue('defaultBranch', source.defaultBranch);
    }
  };

  const handleFormSubmit = (values: ProjectFormValues) => {
    if (!selectedSource) return;

    const input: CreateProjectInput = {
      name: values.name,
      slug: values.slug,
      sourceType: selectedSource.type,
      sourceConfig:
        selectedSource.type === SourceType.LOCAL
          ? { path: selectedSource.path }
          : {
              repoFullName: selectedSource.path,
              installationId: (selectedSource.metadata?.installationId as string) ?? '',
              isPrivate: (selectedSource.metadata?.isPrivate as boolean) ?? false,
            },
      defaultBranch: values.defaultBranch,
    };

    onSubmit(input);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label>Select Project Source</Label>
        <SourcePicker
          sources={sources}
          loading={sourcesLoading}
          selectedSourceId={selectedSource?.id}
          onSelect={handleSourceSelect}
          validationState={validationState}
          validationMessage={validationMessage}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Project Name</Label>
        <Input id="name" placeholder="My Mastra Project" {...register('name')} />
        {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Slug</Label>
        <div className="flex items-center">
          <span className="text-neutral6 text-sm mr-1">/</span>
          <Input id="slug" placeholder="my-mastra-project" {...register('slug')} />
        </div>
        {errors.slug && <p className="text-sm text-red-500">{errors.slug.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="defaultBranch">Default Branch</Label>
        <Input id="defaultBranch" placeholder="main" {...register('defaultBranch')} />
        {errors.defaultBranch && <p className="text-sm text-red-500">{errors.defaultBranch.message}</p>}
      </div>

      <Button
        type="submit"
        disabled={loading || !selectedSource || validationState === 'validating' || validationState === 'invalid'}
        className="w-full"
      >
        {loading ? 'Creating...' : submitText}
      </Button>
    </form>
  );
}
