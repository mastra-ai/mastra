import { useParams } from 'react-router';
import { Plus } from 'lucide-react';
import { useEnvVars } from '@/hooks/projects/use-env-vars';

export function ProjectEnvVars() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: envVars, isLoading } = useEnvVars(projectId!);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent1" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-neutral9">Environment Variables</h1>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-accent1 text-white rounded-md hover:bg-accent2">
          <Plus className="h-4 w-4" />
          Add Variable
        </button>
      </div>

      <div className="bg-surface2 rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral6">Key</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral6">Value</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral6">Type</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-neutral6">Actions</th>
            </tr>
          </thead>
          <tbody>
            {envVars && envVars.length > 0 ? (
              envVars.map(envVar => (
                <tr key={envVar.key} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-sm font-mono text-neutral9">{envVar.key}</td>
                  <td className="px-4 py-3 text-sm font-mono text-neutral6">{envVar.isSecret ? '••••••••' : '(encrypted)'}</td>
                  <td className="px-4 py-3">
                    {envVar.isSecret && (
                      <span className="px-2 py-1 text-xs font-medium bg-yellow-500/10 text-yellow-500 rounded">Secret</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-sm text-neutral6 hover:text-red-500">Remove</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral6">
                  No environment variables yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
