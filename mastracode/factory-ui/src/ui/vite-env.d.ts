/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Local dev only: set to "true" to load the react-grab dev tool. */
  readonly VITE_REACT_GRAB?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
