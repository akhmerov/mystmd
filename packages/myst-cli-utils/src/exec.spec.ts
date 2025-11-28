import { describe, expect, it } from 'vitest';
import { spawn, exec } from 'child_process';
import { killProcessTree } from './exec.js';

describe('killProcessTree', () => {
  it('handles undefined pid gracefully', () => {
    const proc = { pid: undefined } as any;
    // Should not throw
    killProcessTree(proc);
  });

  it('kills a simple process', async () => {
    // Spawn a simple sleep process
    const proc = spawn('sleep', ['10']);
    const pid = proc.pid!;

    // Verify the process is running by checking if we can signal it
    expect(() => process.kill(pid, 0)).not.toThrow();

    // Kill the process tree
    killProcessTree(proc);

    // Wait for the process to exit
    await new Promise<void>((resolve) => {
      proc.on('exit', () => resolve());
      // Timeout in case the process doesn't exit
      setTimeout(resolve, 1000);
    });

    // Verify the process is killed by checking that signaling it throws
    expect(() => process.kill(pid, 0)).toThrow();
  });

  it('kills a process with child processes', async () => {
    // Spawn a shell that spawns child processes (similar to npm run start)
    const proc = exec('sh -c "sleep 10 & sleep 10 & wait"');
    const pid = proc.pid!;

    // Give some time for child processes to start
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Get child PIDs before killing
    let childPids: number[] = [];
    try {
      const { execSync } = await import('child_process');
      const result = execSync(`pgrep -P ${pid}`, { encoding: 'utf8' });
      childPids = result.trim().split('\n').map(p => parseInt(p, 10));
    } catch {
      // No children yet, that's ok
    }

    // Verify the parent process is running
    expect(() => process.kill(pid, 0)).not.toThrow();

    // Kill the process tree
    killProcessTree(proc);

    // Wait for the process to exit
    await new Promise<void>((resolve) => {
      proc.on('exit', () => resolve());
      setTimeout(resolve, 1000);
    });

    // Verify the parent process is killed
    expect(() => process.kill(pid, 0)).toThrow();

    // Verify all child processes are also killed
    for (const childPid of childPids) {
      expect(() => process.kill(childPid, 0)).toThrow();
    }
  });

  it('handles already-dead processes gracefully', async () => {
    // Spawn a process that exits immediately
    const proc = spawn('true');

    // Wait for the process to exit
    await new Promise<void>((resolve) => {
      proc.on('exit', () => resolve());
    });

    // Should not throw when trying to kill an already-dead process
    killProcessTree(proc);
  });
});
