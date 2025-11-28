import util from 'util';
import type { ExecOptions } from 'child_process';
import child_process from 'child_process';
import type { Logger } from './types.js';

/**
 * Recursively kill a process and all its descendants by PID.
 *
 * @param pid - The process ID to kill
 * @param signal - The signal to send (default: 'SIGTERM')
 */
function killProcessTreeByPid(pid: number, signal: NodeJS.Signals = 'SIGTERM'): void {
  // First, find and kill all child processes recursively
  try {
    const result = child_process.execSync(`pgrep -P ${pid}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const childPids = result
      .trim()
      .split('\n')
      .filter((p) => p)
      .map((p) => parseInt(p, 10));

    // Recursively kill children first (depth-first)
    for (const childPid of childPids) {
      killProcessTreeByPid(childPid, signal);
    }
  } catch {
    // pgrep returns non-zero if no children found, which is fine
  }

  // Then kill this process
  try {
    process.kill(pid, signal);
  } catch {
    // Process may already be dead, ignore
  }
}

/**
 * Kill a process and all of its descendant processes.
 *
 * On Unix-like systems, this recursively finds and kills all child processes.
 * On Windows, it uses taskkill with the /T flag which handles the tree kill.
 *
 * @param proc - The child process to kill
 * @param signal - The signal to send (default: 'SIGTERM')
 */
export function killProcessTree(
  proc: child_process.ChildProcess,
  signal: NodeJS.Signals = 'SIGTERM',
): void {
  if (proc.pid === undefined) {
    return;
  }

  if (process.platform === 'win32') {
    // On Windows, use taskkill with /T flag to kill process tree
    try {
      child_process.execSync(`taskkill /F /T /PID ${proc.pid}`, {
        stdio: 'ignore',
      });
    } catch {
      // Process may already be dead, ignore
    }
  } else {
    // On Unix-like systems, recursively kill all descendants
    killProcessTreeByPid(proc.pid, signal);
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
