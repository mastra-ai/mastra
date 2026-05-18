import {
  Badge,
  Button,
  ErrorState,
  Input,
  NoDataPageLayout,
  PageLayout,
  PermissionDenied,
  SectionCard,
  SessionExpired,
  Skeleton,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { PlusIcon, SearchIcon, TrashIcon, FolderIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { isAuthenticated } from '@/domains/auth/types';
import { useFGAResources, useCreateFGAResource, useDeleteFGAResource } from '@/domains/fga/hooks';
import type { FGAResource } from '@/domains/fga/hooks';

function formatResourceType(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

function ResourceCard({
  resource,
  onDelete,
  canManage,
  isPending,
}: {
  resource: FGAResource;
  onDelete: (id: string) => void;
  canManage: boolean;
  isPending: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-4 border border-border1 rounded-lg hover:bg-surface2 transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-surface3 rounded-lg">
          <FolderIcon className="h-5 w-5 text-neutral4" />
        </div>
        <div>
          <h3 className="font-medium text-text1">{resource.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="default" className="text-xs">
              {formatResourceType(resource.resourceTypeSlug)}
            </Badge>
            {resource.description && <span className="text-xs text-text3">— {resource.description}</span>}
          </div>
        </div>
      </div>
      {canManage && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(resource.id)}
          disabled={isPending}
          className="text-error"
        >
          <TrashIcon className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function CreateResourceModal({
  onClose,
  onSubmit,
  isPending,
}: {
  onClose: () => void;
  onSubmit: (resource: Omit<FGAResource, 'id'>) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !resourceType.trim()) return;

    onSubmit({
      name: name.trim(),
      resourceTypeSlug: resourceType.trim().toLowerCase().replace(/\s+/g, '-'),
      description: description.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative rounded-xl border border-border1/40 bg-surface2/96 backdrop-blur-md shadow-dialog w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border1">
          <h2 className="text-lg font-semibold text-neutral6">Create Resource</h2>
          <button onClick={onClose} className="p-1 hover:bg-surface3 rounded transition-colors">
            <XIcon className="h-5 w-5 text-neutral4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral5 mb-1">Name *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="My Resource" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral5 mb-1">Resource Type *</label>
            <Input
              value={resourceType}
              onChange={e => setResourceType(e.target.value)}
              placeholder="e.g., project, folder, document"
              required
            />
            <p className="text-xs text-text3 mt-1">The type of resource (will be converted to slug format)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral5 mb-1">Description</label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name.trim() || !resourceType.trim()}>
              Create Resource
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FGAResourcesPage() {
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data, isLoading, error } = useFGAResources(undefined, search);
  const { mutate: createResource, isPending: isCreating } = useCreateFGAResource();
  const { mutate: deleteResource, isPending: isDeleting } = useDeleteFGAResource();
  const { data: capabilities } = useAuthCapabilities();
  const { hasPermission } = usePermissions();

  const canManage = hasPermission('team:write');
  const fgaCapabilities =
    capabilities && isAuthenticated(capabilities) ? capabilities.capabilities.fgaCapabilities : null;
  const fgaEnabled = capabilities && isAuthenticated(capabilities) ? capabilities.capabilities.fga : false;

  const resources = data?.resources ?? [];

  const handleCreate = (resource: Omit<FGAResource, 'id'>) => {
    createResource(resource, {
      onSuccess: () => {
        setShowCreateModal(false);
      },
    });
  };

  const handleDelete = (resourceId: string) => {
    if (!confirm('Are you sure you want to delete this resource?')) return;
    deleteResource(resourceId);
  };

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout>
        <PermissionDenied resource="FGA resources" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout>
        <ErrorState title="Failed to load resources" message={error.message} />
      </NoDataPageLayout>
    );
  }

  // If FGA is not enabled, show a message
  if (!fgaEnabled && !isLoading) {
    return (
      <PageLayout width="narrow">
        <PageLayout.MainArea className="flex flex-col gap-5 mt-6">
          <SectionCard title="Fine-Grained Access Control" description="FGA is not enabled for this Studio instance.">
            <div className="py-4 text-center text-text3">
              <p>To enable FGA, configure an FGA provider in your Studio configuration.</p>
              <p className="text-sm mt-2">FGA allows you to manage access to specific resources at a granular level.</p>
            </div>
          </SectionCard>
        </PageLayout.MainArea>
      </PageLayout>
    );
  }

  return (
    <PageLayout width="narrow">
      <PageLayout.MainArea className="flex flex-col gap-5 mt-6">
        <SectionCard
          title="FGA Resources"
          description="Manage fine-grained access control resources"
          action={
            canManage && fgaCapabilities?.resourceManagement ? (
              <Button variant="outline" size="sm" onClick={() => setShowCreateModal(true)}>
                <PlusIcon className="h-4 w-4 mr-2" />
                Create Resource
              </Button>
            ) : undefined
          }
        >
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text3" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search resources..."
                className="pl-9"
              />
            </div>
          </div>

          {/* Resource list */}
          <div className="space-y-2">
            {isLoading ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : resources.length > 0 ? (
              resources.map(resource => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  onDelete={handleDelete}
                  canManage={canManage && fgaCapabilities?.resourceManagement === true}
                  isPending={isDeleting}
                />
              ))
            ) : (
              <div className="py-8 text-center text-text3">
                <FolderIcon className="h-12 w-12 mx-auto mb-3 text-text4" />
                <p className="font-medium">No resources found</p>
                <p className="text-sm mt-1">
                  {search ? 'Try a different search term' : 'Create your first resource to get started'}
                </p>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Capabilities info */}
        {fgaCapabilities && (
          <SectionCard title="Provider Capabilities" description="What this FGA provider supports">
            <div className="flex flex-wrap gap-2 py-2">
              <Badge variant={fgaCapabilities.resourceManagement ? 'success' : 'warning'}>
                Resource Management: {fgaCapabilities.resourceManagement ? 'Yes' : 'No'}
              </Badge>
              <Badge variant={fgaCapabilities.roleAssignment ? 'success' : 'warning'}>
                Role Assignment: {fgaCapabilities.roleAssignment ? 'Yes' : 'No'}
              </Badge>
              <Badge variant={fgaCapabilities.hierarchicalResources ? 'success' : 'warning'}>
                Hierarchical Resources: {fgaCapabilities.hierarchicalResources ? 'Yes' : 'No'}
              </Badge>
            </div>
          </SectionCard>
        )}
      </PageLayout.MainArea>

      {/* Create modal */}
      {showCreateModal && (
        <CreateResourceModal onClose={() => setShowCreateModal(false)} onSubmit={handleCreate} isPending={isCreating} />
      )}
    </PageLayout>
  );
}

export default FGAResourcesPage;
