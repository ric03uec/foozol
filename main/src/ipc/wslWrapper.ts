/**
 * IPC Handler Wrappers for WSL Context Injection
 *
 * Provides higher-order functions that wrap IPC handlers to automatically
 * set up WSL execution context at the start of request handling.
 *
 * Usage:
 *   ipcMain.handle('git:commit', withWSLContext(services, async (sessionId, message) => {
 *     // execSync calls will automatically use WSL context if applicable
 *     execSync('git commit -m "..."', { cwd: worktreePath });
 *   }));
 */

import type { IpcMainInvokeEvent } from 'electron';
import type { AppServices } from './types';
import { runWithWSLContextAsync } from '../utils/wslExecutionContext';
import { WSLContext } from '../utils/wslUtils';

/**
 * Type for IPC handler functions that receive sessionId as first argument.
 * The wrapper extracts sessionId to look up WSL context, then passes through all args.
 */
type SessionHandler<TArgs extends unknown[], TResult> = (
  event: IpcMainInvokeEvent,
  sessionId: string,
  ...args: TArgs
) => Promise<TResult>;

/**
 * Type for IPC handler functions that don't have sessionId but need project-based context.
 * Use withProjectWSLContext for these handlers.
 */
type ProjectHandler<TArgs extends unknown[], TResult> = (
  event: IpcMainInvokeEvent,
  projectId: number,
  ...args: TArgs
) => Promise<TResult>;

/**
 * Wrap an IPC handler to automatically inject WSL context based on sessionId.
 *
 * The first argument after event must be sessionId. The wrapper looks up the
 * WSL context for that session and runs the handler within that context.
 *
 * @param services - AppServices containing sessionManager
 * @param handler - The IPC handler function
 * @returns Wrapped handler that runs within WSL context
 *
 * @example
 * ipcMain.handle('git:commit', withWSLContext(services, async (event, sessionId, message) => {
 *   const session = sessionManager.getSession(sessionId);
 *   // All execSync calls here automatically use WSL wrapping if needed
 *   execSync('git status', { cwd: session.worktreePath });
 * }));
 */
export function withWSLContext<TArgs extends unknown[], TResult>(
  services: AppServices,
  handler: SessionHandler<TArgs, TResult>
): (event: IpcMainInvokeEvent, sessionId: string, ...args: TArgs) => Promise<TResult> {
  return async (event: IpcMainInvokeEvent, sessionId: string, ...args: TArgs): Promise<TResult> => {
    const wslContext = services.sessionManager.getWSLContextForSession(sessionId);
    return runWithWSLContextAsync(wslContext, () => handler(event, sessionId, ...args));
  };
}

/**
 * Wrap an IPC handler to automatically inject WSL context based on projectId.
 *
 * Use this for handlers that operate on projects rather than sessions.
 *
 * @param services - AppServices containing sessionManager and databaseService
 * @param handler - The IPC handler function
 * @returns Wrapped handler that runs within WSL context
 */
export function withProjectWSLContext<TArgs extends unknown[], TResult>(
  services: AppServices,
  handler: ProjectHandler<TArgs, TResult>
): (event: IpcMainInvokeEvent, projectId: number, ...args: TArgs) => Promise<TResult> {
  return async (event: IpcMainInvokeEvent, projectId: number, ...args: TArgs): Promise<TResult> => {
    // Get project and build WSL context
    const project = services.databaseService.getProject(projectId);
    let wslContext: WSLContext | null = null;
    if (project?.wsl_enabled && project.wsl_distribution) {
      wslContext = {
        enabled: true,
        distribution: project.wsl_distribution,
        linuxPath: project.path
      };
    }
    return runWithWSLContextAsync(wslContext, () => handler(event, projectId, ...args));
  };
}

/**
 * Helper to create a WSL-aware exec function that's pre-bound to a session.
 * This is useful for handlers that make multiple exec calls with the same session context.
 *
 * @deprecated Use withWSLContext wrapper instead - execSync now automatically
 * checks AsyncLocalStorage for WSL context.
 */
export function createSessionExec(services: AppServices, sessionId: string) {
  const wslContext = services.sessionManager.getWSLContextForSession(sessionId);
  return {
    wslContext,
    // The execSync from commandExecutor will automatically use AsyncLocalStorage,
    // but we expose wslContext for explicit passing if needed
  };
}
