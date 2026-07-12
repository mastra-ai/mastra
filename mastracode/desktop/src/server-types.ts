export interface DesktopServerHandle {
  bootstrapUrl: string;
  origin: string;
  port: number;
  approveProjectDirectory: (path: string) => Promise<string>;
  close: () => Promise<void>;
}

export interface DesktopServerOptions {
  projectAccessFile: string;
}
