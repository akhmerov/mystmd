import util from 'util';
import type { ExecOptions } from 'child_process';
import child_process from 'child_process';
import type { Logger } from './types.js';

/**
 * Kill a process and all of its descendant processes.
 */
export function killProcessTree(proc: child_process.ChildProcess): void {
  if (proc.pid === undefined) return;
  if (process.platform === 'win32') {
    try {
      child_process.execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore' });
    } catch {
      // Process may already be dead
    }
  } else {
    killPid(proc.pid);
  }
}

function killPid(pid: number): void {
  // Find and kill children first
  try {
    const children = child_process
      .execSync(`pgrep -P ${pid}`, { encoding: 'utf8' })
      .trim()
      .split('\n')
      .map((p) => parseInt(p, 10))
      .filter((p) => !isNaN(p));
    children.forEach((child) => killPid(child));
  } catch {
    // No children
  }
  try {
    process.kill(pid);
  } catch {
    // Process may already be dead
  }
}

function execWrapper(
  command: string,
  options?: { cwd?: string },
  callback?: (error: child_process.ExecException | null, stdout: string, stderr: string) => void,
) {
  const childProcess = child_process.exec(command, options ?? {}, callback);
  childProcess.stdout?.pipe(process.stdout);
  childProcess.stderr?.pipe(process.stderr);
  return childProcess;
}

export const exec = util.promisify(execWrapper);

type Options = ExecOptions & { getProcess?: (process: child_process.ChildProcess) => void };

function makeExecWrapper(
  command: string,
  log: Pick<Logger, 'debug' | 'error'> | null,
  options?: Options,
) {
  return function inner(
    callback?: (
      error: child_process.ExecException | null,
      stdout: string | Buffer,
      stderr: string | Buffer,
    ) => void,
  ) {
    const childProcess = child_process.exec(command, (options ?? {}) as ExecOptions, callback);
    childProcess.stdout?.on('data', (data: any) => log?.debug(data));
    childProcess.stderr?.on('data', (data: any) => log?.error(data));
    options?.getProcess?.(childProcess);
    return childProcess;
  };
}

export function makeExecutable(
  command: string,
  log: Pick<Logger, 'debug' | 'error'> | null,
  options?: Options,
) {
  return util.promisify(makeExecWrapper(command, log, options)) as () => Promise<string>;
}
