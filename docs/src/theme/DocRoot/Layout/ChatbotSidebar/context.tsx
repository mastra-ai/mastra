import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export interface ChatbotSidebarContextValue {
  /**
   * Whether the chatbot sidebar is hidden
   */
  isHidden: boolean;
  /**
   * Set the hidden state of the chatbot sidebar
   */
  setIsHidden: (value: boolean | ((prev: boolean) => boolean)) => void;
  /**
   * Toggle the chatbot sidebar open/closed
   */
  toggle: () => void;
  /**
   * Open the chatbot sidebar
   */
  open: () => void;
  /**
   * Close the chatbot sidebar
   */
  close: () => void;
}

const ChatbotSidebarContext = createContext<
  ChatbotSidebarContextValue | undefined
>(undefined);

interface ChatbotSidebarProviderProps {
  children: ReactNode;
  /**
   * Initial hidden state (defaults to true)
   */
  defaultHidden?: boolean;
}

/**
 * Provider component for chatbot sidebar state management.
 * Wrap your layout with this provider to enable chatbot sidebar state access
 * from any child component.
 */
export function ChatbotSidebarProvider({
  children,
  defaultHidden = true,
}: ChatbotSidebarProviderProps) {
  const [isHidden, setIsHidden] = useState(defaultHidden);

  const toggle = useCallback(() => {
    setIsHidden((prev) => !prev);
  }, []);

  const open = useCallback(() => {
    setIsHidden(false);
  }, []);

  const close = useCallback(() => {
    setIsHidden(true);
  }, []);

  const value: ChatbotSidebarContextValue = {
    isHidden,
    setIsHidden,
    toggle,
    open,
    close,
  };

  return (
    <ChatbotSidebarContext.Provider value={value}>
      {children}
    </ChatbotSidebarContext.Provider>
  );
}

/**
 * Hook to access the chatbot sidebar state and controls.
 * Must be used within a ChatbotSidebarProvider.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isHidden, open, close, toggle } = useChatbotSidebar();
 *
 *   return (
 *     <button onClick={toggle}>
 *       {isHidden ? 'Open' : 'Close'} Chatbot
 *     </button>
 *   );
 * }
 * ```
 */
export function useChatbotSidebar(): ChatbotSidebarContextValue {
  const context = useContext(ChatbotSidebarContext);
  if (context === undefined) {
    throw new Error(
      "useChatbotSidebar must be used within a ChatbotSidebarProvider",
    );
  }
  return context;
}
