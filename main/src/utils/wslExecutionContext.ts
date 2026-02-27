/**
 * WSL Execution Context using AsyncLocalStorage
 *
 * This module provides automatic WSL context propagation for the entire call chain
 * without requiring explicit parameter threading through every function.
 *
 * Usage:
 * 1. At IPC handler level, wrap execution with runWithWSLContext()
 * 2. Downstream services automatically get WSL context via getWSLContext()
 * 3. CommandExecutor checks this context when no explicit wslContext is passed
 *
 * This is safe for concurrent sessions - each async execution chain has its own context.
 */

import { AsyncLocalStorage } from 'async_hooks';
import { WSLContext } from './wslUtils';

// AsyncLocalStorage instance for WSL context
const wslContextStorage = new AsyncLocalStorage<WSLContext | null>();

/**
 * Run a function within a WSL execution context.
 * All downstream calls can retrieve this context via getWSLContext().
 *
 * @param context - The WSL context for this execution, or null if not WSL
 * @param fn - The function to execute within this context
 * @returns The result of the function
 */
export function runWithWSLContext<T>(context: WSLContext | null, fn: () => T): T {
  return wslContextStorage.run(context, fn);
}

/**
 * Run an async function within a WSL execution context.
 * All downstream async calls will have access to this context.
 *
 * @param context - The WSL context for this execution, or null if not WSL
 * @param fn - The async function to execute within this context
 * @returns A promise resolving to the function result
 */
export async function runWithWSLContextAsync<T>(
  context: WSLContext | null,
  fn: () => Promise<T>
): Promise<T> {
  return wslContextStorage.run(context, fn);
}

/**
 * Get the current WSL context from AsyncLocalStorage.
 * Returns null if not running within a WSL context or if WSL is not enabled.
 *
 * @returns The current WSL context, or null
 */
export function getWSLContext(): WSLContext | null {
  return wslContextStorage.getStore() ?? null;
}

/**
 * Check if we're currently running within a WSL execution context.
 *
 * @returns true if running within a WSL context with WSL enabled
 */
export function isInWSLContext(): boolean {
  const ctx = getWSLContext();
  return ctx !== null && ctx.enabled;
}
