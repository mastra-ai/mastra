import 'react-dom';

declare module 'react-dom' {
  function useFormStatus(): { pending: boolean; method: string; action: string };
}
