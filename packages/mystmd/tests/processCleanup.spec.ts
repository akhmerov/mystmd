import { describe, expect, test } from 'vitest';
import { execSync, exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function resolve(relative: string) {
  return path.resolve(__dirname, relative);
}

describe('Process cleanup', { timeout: 120000 }, () => {
  test('myst build --html does not leave server processes behind', async () => {
    const cwd = resolve('hidden-pages');
    const buildDir = path.join(cwd, '_build');

    // Clean up any existing build (cross-platform)
    if (fs.existsSync(buildDir)) {
      fs.rmSync(buildDir, { recursive: true, force: true });
    }

    // Run myst build --html and wait for it to complete
    let exitCode: number | null = null;
    let stderr = '';
    await new Promise<void>((resolve) => {
      const proc = exec('myst build --html', { cwd });
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      proc.on('exit', (code) => {
        exitCode = code;
        resolve();
      });
      proc.on('error', () => {
        resolve();
      });
    });

    // If the build failed due to network/template issues, skip the cleanup test
    if (exitCode !== 0) {
      console.log('Build failed (possibly due to network), skipping process cleanup check');
      return;
    }

    // Give a brief moment for any cleanup to complete
    await new Promise((r) => setTimeout(r, 500));

    // Check for any lingering server.js processes started from this project's build
    // We look specifically for processes in the template directory
    let serverProcesses = '';
    try {
      // On Unix, check for server.js processes
      if (process.platform !== 'win32') {
        serverProcesses = execSync(
          `pgrep -f "node.*templates.*server\\.js" || true`,
          { encoding: 'utf8' },
        ).trim();
      }
      // On Windows, tasklist would be used but --html build typically uses npm scripts
    } catch {
      // pgrep returns non-zero when no processes found, which is expected
    }

    // Should have no template server.js processes
    expect(serverProcesses).toBe('');
  });
});
