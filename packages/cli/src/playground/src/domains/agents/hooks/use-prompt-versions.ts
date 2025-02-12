import { useState, useEffect } from 'react';

import type { PromptVersion } from '../types';

export function usePromptVersions(agentId: string, instructions?: string) {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [copiedVersions, setCopiedVersions] = useState<Record<number, boolean>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [versionToDelete, setVersionToDelete] = useState<number | null>(null);

  // Load versions from local storage on mount
  useEffect(() => {
    const storedVersions = localStorage.getItem(`agent-${agentId}-versions`);
    if (storedVersions) {
      const parsedVersions = JSON.parse(storedVersions);
      // Convert string dates back to Date objects and set active version
      const updatedVersions = parsedVersions.map((v: any) => ({
        ...v,
        timestamp: new Date(v.timestamp),
        // Set the version matching current instructions as active
        status: v.content === instructions ? 'active' : v.status === 'active' ? 'published' : v.status,
      }));
      setVersions(updatedVersions);
    } else if (instructions) {
      const initialVersions = [
        {
          content: instructions,
          timestamp: new Date(),
          analysis: 'Original instructions',
          status: 'original' as const,
        },
      ];
      setVersions(initialVersions);
      localStorage.setItem(`agent-${agentId}-versions`, JSON.stringify(initialVersions));
    }
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
      const response = await fetch(`http://localhost:4111/api/agents/${agentId}/instructions`, {
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

  const updateVersion = (index: number, updates: Partial<PromptVersion>) => {
    setVersions(prev => prev.map((version, i) => (i === index ? { ...version, ...updates } : version)));
  };

  return {
    versions,
    copiedVersions,
    isUpdating,
    versionToDelete,
    setVersions,
    setCopiedVersions,
    setIsUpdating,
    setVersionToDelete,
    copyToClipboard,
    setVersionActive,
    deleteVersion,
    updateVersion,
  };
}
