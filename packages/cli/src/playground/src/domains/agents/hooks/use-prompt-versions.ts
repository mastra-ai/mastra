import { useState, useEffect } from 'react';

import type { EvalResult, PromptVersion } from '../types';

export function usePromptVersions(agentId: string, instructions?: string) {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [copiedVersions, setCopiedVersions] = useState<Record<number, boolean>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [versionToDelete, setVersionToDelete] = useState<number | null>(null);

  // Fetch eval results for a version
  const fetchEvalResults = async (): Promise<EvalResult[]> => {
    try {
      const response = await fetch(`/api/agents/${agentId}/evals/live`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch eval results');
      }

      const data = await response.json();
      return data?.evals;
    } catch (error) {
      console.error('Failed to fetch eval results:', error);
      return [];
    }
  };

  useEffect(() => {
    const loadVersions = async () => {
      const evals = await fetchEvalResults();

      const storedVersions = localStorage.getItem(`agent-${agentId}-versions`);

      if (storedVersions) {
        const parsedVersions = JSON.parse(storedVersions);
        // Check if the original version content matches current instructions
        const originalVersion = parsedVersions.find((v: any) => v.status === 'original');
        if (instructions && originalVersion && originalVersion.content !== instructions) {
          // If instructions changed, reset version history with new original version
          const originalEvals = evals?.filter(m => m.meta.instructions === instructions);

          const newVersions: PromptVersion[] = [
            {
              content: instructions,
              timestamp: new Date(),
              analysis: 'Original instructions',
              status: 'original' as const,
              evals: originalEvals,
            },
          ];
          // Fetch evals for the new original version
          newVersions[0].evals = evals;

          setVersions(newVersions);
          localStorage.setItem(`agent-${agentId}-versions`, JSON.stringify(newVersions));
        } else {
          // If instructions haven't changed, load existing versions and fetch their evals
          const updatedVersions = await Promise.all(
            parsedVersions.map(async (v: any) => {
              const originalEvals = evals?.filter(m => m.meta.instructions === v.content);

              const version = {
                ...v,
                timestamp: new Date(v.timestamp),
                status: v.content === instructions ? 'active' : v.status === 'active' ? 'published' : v.status,
              };
              return { ...version, evals: originalEvals };
            }),
          );
          setVersions(updatedVersions);
        }
      } else if (instructions) {
        const initialVersions: PromptVersion[] = [
          {
            content: instructions,
            timestamp: new Date(),
            analysis: 'Original instructions',
            status: 'original' as const,
            evals: [],
          },
        ];

        const originalEvals = evals?.filter(m => m.meta.instructions === instructions);

        // Fetch evals for the initial version
        initialVersions[0].evals = originalEvals;

        setVersions(initialVersions);

        localStorage.setItem(`agent-${agentId}-versions`, JSON.stringify(initialVersions));
      }
    };

    loadVersions();
  }, [instructions, agentId]);

  // Save versions to local storage whenever they change
  useEffect(() => {
    if (versions.length > 0) {
      localStorage.setItem(`agent-${agentId}-versions`, JSON.stringify(versions));
    }
  }, [versions, agentId]);

  const copyToClipboard = async (text: string, versionIndex: number) => {
    // Set copied state immediately
    setCopiedVersions(prev => ({ ...prev, [versionIndex]: true }));

    // Clear the copied state after a delay
    const timer = setTimeout(() => {
      setCopiedVersions(prev => ({ ...prev, [versionIndex]: false }));
    }, 1000);

    // Cleanup timer if component unmounts
    return () => clearTimeout(timer);
  };

  const setVersionActive = async (version: PromptVersion, index: number) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/agents/${agentId}/instructions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instructions: version.content,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update instructions');
      }

      // Update version statuses
      setVersions(prev =>
        prev.map((v, i) => ({
          ...v,
          status: i === index ? 'active' : v.status === 'active' ? 'published' : v.status,
        })),
      );
    } catch (error) {
      console.error('Failed to set version as active:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteVersion = (index: number) => {
    setVersions(prev => prev.filter((_, i) => i !== index));
    setVersionToDelete(null);
  };

  const updateVersion = async (index: number, updates: Partial<PromptVersion>) => {
    const updatedVersion = {
      ...versions[index],
      ...updates,
    };

    setVersions(prev => prev.map((version, i) => (i === index ? updatedVersion : version)));
  };

  return {
    versions,
    copiedVersions,
    isUpdating,
    versionToDelete,
    setVersions,
    setVersionToDelete,
    copyToClipboard,
    setVersionActive,
    deleteVersion,
    updateVersion,
  };
}
