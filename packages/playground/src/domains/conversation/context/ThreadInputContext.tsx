import { createContext, useContext, useState } from 'react';

const ThreadInputContext = createContext<{
  threadInput: string;
  setThreadInput: React.Dispatch<React.SetStateAction<string>>;
}>({
  threadInput: '',
  setThreadInput: () => {},
});

export const ThreadInputProvider = ({ children }: { children: React.ReactNode }) => {
  const [threadInput, setThreadInput] = useState('');

  return <ThreadInputContext.Provider value={{ threadInput, setThreadInput }}>{children}</ThreadInputContext.Provider>;
};

export const useThreadInput = () => {
  return useContext(ThreadInputContext);
};
