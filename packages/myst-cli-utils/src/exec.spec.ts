import { describe, expect, it } from 'vitest';
import { exec } from 'child_process';
import { killProcessTree } from './exec.js';

describe('killProcessTree', () => {
  it('handles undefined pid gracefully', () => {
    killProcessTree({ pid: undefined } as any);
  });

  it('kills process tree', async () => {
    const proc = exec('sh -c "sleep 10 & wait"');
    await new Promise((r) => setTimeout(r, 100));
    expect(() => process.kill(proc.pid!, 0)).not.toThrow();
    killProcessTree(proc);
    await new Promise((r) => setTimeout(r, 100));
    expect(() => process.kill(proc.pid!, 0)).toThrow();
  });
});
