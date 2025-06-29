export const useNewUI = () => {
  return import.meta.env.VITE_USE_NEW_UI === '1' || import.meta.env.VITE_USE_NEW_UI === 'true' || false;
};
