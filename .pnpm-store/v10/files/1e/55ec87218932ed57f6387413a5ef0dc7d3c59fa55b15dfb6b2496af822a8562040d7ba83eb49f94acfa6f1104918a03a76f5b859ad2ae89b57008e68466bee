"use client";

import { useContext, Context } from "react";

/**
 * Creates a context hook with optional support.
 * @param context - The React context to consume.
 * @param providerName - The name of the provider for error messages.
 * @returns A hook function that provides the context value.
 */
export function createContextHook<T>(
  context: Context<T | null>,
  providerName: string,
) {
  function useContextHook(options?: {
    optional?: boolean | undefined;
  }): T | null {
    const contextValue = useContext(context);
    if (!options?.optional && !contextValue) {
      throw new Error(`This component must be used within ${providerName}.`);
    }
    return contextValue;
  }

  return useContextHook;
}
