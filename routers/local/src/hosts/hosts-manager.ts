import { existsSync } from 'node:fs';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

/**
 * Configuration for HostsManager.
 */
export interface HostsManagerConfig {
  /**
   * Path to hosts file.
   * @default '/etc/hosts' on Linux/macOS, 'C:\\Windows\\System32\\drivers\\etc\\hosts' on Windows
   */
  hostsPath?: string;

  /**
   * Directory for backup files.
   * @default '~/.mastra/hosts-backups'
   */
  backupDir?: string;

  /**
   * IP address to use for local domains.
   * @default '127.0.0.1'
   */
  localIp?: string;

  /**
   * Enable console logging.
   * @default true
   */
  logChanges?: boolean;
}

/**
 * A hosts file entry managed by Mastra.
 */
export interface HostsEntry {
  hostname: string;
  ip: string;
  comment?: string;
}

/**
 * Result of a hosts file operation.
 */
export interface HostsOperationResult {
  success: boolean;
  error?: string;
  backupPath?: string;
}

// Marker comments to identify Mastra-managed entries
const MASTRA_START_MARKER = '# BEGIN MASTRA LOCAL ROUTING';
const MASTRA_END_MARKER = '# END MASTRA LOCAL ROUTING';

/**
 * Manages the system hosts file for custom local domain routing.
 *
 * This allows custom domains like `*.mastra.local` to resolve to localhost,
 * enabling subdomain-based routing in local development.
 *
 * **Important:** Modifying the hosts file requires elevated permissions.
 * On Linux/macOS, run with sudo. On Windows, run as Administrator.
 *
 * @example
 * ```typescript
 * const hosts = new HostsManager({
 *   localIp: '127.0.0.1',
 *   logChanges: true,
 * });
 *
 * // Add a domain
 * await hosts.addEntry('my-agent.mastra.local');
 *
 * // Remove a domain
 * await hosts.removeEntry('my-agent.mastra.local');
 *
 * // Clean up all Mastra entries
 * await hosts.removeAllEntries();
 * ```
 */
export class HostsManager {
  private readonly config: Required<HostsManagerConfig>;

  constructor(config: HostsManagerConfig = {}) {
    this.config = {
      hostsPath: config.hostsPath ?? this.getDefaultHostsPath(),
      backupDir: config.backupDir ?? join(homedir(), '.mastra', 'hosts-backups'),
      localIp: config.localIp ?? '127.0.0.1',
      logChanges: config.logChanges ?? true,
    };
  }

  /**
   * Add a hostname entry to the hosts file.
   */
  async addEntry(hostname: string, comment?: string): Promise<HostsOperationResult> {
    return this.addEntries([{ hostname, ip: this.config.localIp, comment }]);
  }

  /**
   * Add multiple hostname entries to the hosts file.
   */
  async addEntries(entries: HostsEntry[]): Promise<HostsOperationResult> {
    try {
      // Read current hosts file
      const content = await this.readHostsFile();

      // Parse existing Mastra entries
      const existingEntries = this.parseMastraSection(content);

      // Merge new entries (avoid duplicates)
      const mergedEntries = [...existingEntries];
      for (const entry of entries) {
        if (!mergedEntries.some(e => e.hostname === entry.hostname)) {
          mergedEntries.push(entry);
        }
      }

      // Build new content
      const newContent = this.updateMastraSection(content, mergedEntries);

      // Create backup
      const backupPath = await this.createBackup();

      // Write updated hosts file
      await this.writeHostsFile(newContent);

      if (this.config.logChanges) {
        for (const entry of entries) {
          console.info(`[HostsManager] Added: ${entry.hostname} → ${entry.ip}`);
        }
      }

      return { success: true, backupPath };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Remove a hostname entry from the hosts file.
   */
  async removeEntry(hostname: string): Promise<HostsOperationResult> {
    return this.removeEntries([hostname]);
  }

  /**
   * Remove multiple hostname entries from the hosts file.
   */
  async removeEntries(hostnames: string[]): Promise<HostsOperationResult> {
    try {
      // Read current hosts file
      const content = await this.readHostsFile();

      // Parse existing Mastra entries
      const existingEntries = this.parseMastraSection(content);

      // Filter out removed entries
      const remainingEntries = existingEntries.filter(e => !hostnames.includes(e.hostname));

      // Build new content
      const newContent = this.updateMastraSection(content, remainingEntries);

      // Create backup
      const backupPath = await this.createBackup();

      // Write updated hosts file
      await this.writeHostsFile(newContent);

      if (this.config.logChanges) {
        for (const hostname of hostnames) {
          console.info(`[HostsManager] Removed: ${hostname}`);
        }
      }

      return { success: true, backupPath };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Remove all Mastra-managed entries from the hosts file.
   */
  async removeAllEntries(): Promise<HostsOperationResult> {
    try {
      // Read current hosts file
      const content = await this.readHostsFile();

      // Remove Mastra section entirely
      const newContent = this.removeMastraSection(content);

      // Create backup
      const backupPath = await this.createBackup();

      // Write updated hosts file
      await this.writeHostsFile(newContent);

      if (this.config.logChanges) {
        console.info('[HostsManager] All Mastra entries removed');
      }

      return { success: true, backupPath };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Get all Mastra-managed entries.
   */
  async getEntries(): Promise<HostsEntry[]> {
    const content = await this.readHostsFile();
    return this.parseMastraSection(content);
  }

  /**
   * Check if a hostname is already registered.
   */
  async hasEntry(hostname: string): Promise<boolean> {
    const entries = await this.getEntries();
    return entries.some(e => e.hostname === hostname);
  }

  /**
   * Restore from a backup file.
   */
  async restoreFromBackup(backupPath: string): Promise<HostsOperationResult> {
    try {
      if (!existsSync(backupPath)) {
        return { success: false, error: `Backup file not found: ${backupPath}` };
      }

      const backupContent = await readFile(backupPath, 'utf-8');
      await this.writeHostsFile(backupContent);

      if (this.config.logChanges) {
        console.info(`[HostsManager] Restored from: ${backupPath}`);
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Get the path to the hosts file.
   */
  getHostsPath(): string {
    return this.config.hostsPath;
  }

  /**
   * Get the default hosts file path for the current platform.
   */
  private getDefaultHostsPath(): string {
    const os = platform();
    if (os === 'win32') {
      return 'C:\\Windows\\System32\\drivers\\etc\\hosts';
    }
    return '/etc/hosts';
  }

  /**
   * Read the hosts file.
   */
  private async readHostsFile(): Promise<string> {
    try {
      return await readFile(this.config.hostsPath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return '';
      }
      throw error;
    }
  }

  /**
   * Write the hosts file.
   */
  private async writeHostsFile(content: string): Promise<void> {
    await writeFile(this.config.hostsPath, content, 'utf-8');
  }

  /**
   * Create a backup of the hosts file.
   */
  private async createBackup(): Promise<string> {
    const { mkdir } = await import('node:fs/promises');
    await mkdir(this.config.backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = join(this.config.backupDir, `hosts.backup.${timestamp}`);

    if (existsSync(this.config.hostsPath)) {
      await copyFile(this.config.hostsPath, backupPath);
    }

    return backupPath;
  }

  /**
   * Parse the Mastra section from hosts file content.
   */
  private parseMastraSection(content: string): HostsEntry[] {
    const entries: HostsEntry[] = [];

    const startIndex = content.indexOf(MASTRA_START_MARKER);
    const endIndex = content.indexOf(MASTRA_END_MARKER);

    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
      return entries;
    }

    const sectionContent = content.slice(startIndex + MASTRA_START_MARKER.length, endIndex);
    const lines = sectionContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Parse: IP HOSTNAME # optional comment
      const match = trimmed.match(/^([\d.]+)\s+(\S+)(?:\s+#\s*(.*))?$/);
      if (match && match[1] && match[2]) {
        entries.push({
          ip: match[1],
          hostname: match[2],
          comment: match[3],
        });
      }
    }

    return entries;
  }

  /**
   * Update the Mastra section in hosts file content.
   */
  private updateMastraSection(content: string, entries: HostsEntry[]): string {
    // Build new Mastra section
    const sectionLines = [MASTRA_START_MARKER];
    for (const entry of entries) {
      const comment = entry.comment ? ` # ${entry.comment}` : '';
      sectionLines.push(`${entry.ip}\t${entry.hostname}${comment}`);
    }
    sectionLines.push(MASTRA_END_MARKER);
    const newSection = sectionLines.join('\n');

    // Find and replace existing section, or append
    const startIndex = content.indexOf(MASTRA_START_MARKER);
    const endIndex = content.indexOf(MASTRA_END_MARKER);

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      // Replace existing section
      const before = content.slice(0, startIndex);
      const after = content.slice(endIndex + MASTRA_END_MARKER.length);
      return before + newSection + after;
    }

    // Append new section
    const separator = content.endsWith('\n') ? '\n' : '\n\n';
    return content + separator + newSection + '\n';
  }

  /**
   * Remove the Mastra section from hosts file content.
   */
  private removeMastraSection(content: string): string {
    const startIndex = content.indexOf(MASTRA_START_MARKER);
    const endIndex = content.indexOf(MASTRA_END_MARKER);

    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
      return content;
    }

    const before = content.slice(0, startIndex);
    const after = content.slice(endIndex + MASTRA_END_MARKER.length);

    // Clean up extra newlines
    return (before + after).replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }
}
