import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

function resolveTerminalCwd(rawCwd?: string): string {
  if (!rawCwd || rawCwd === '~' || rawCwd === '.' || rawCwd === '/root') {
    return '/root';
  }
  if (rawCwd.startsWith('~/')) {
    return path.resolve('/root', rawCwd.slice(2));
  }
  if (path.isAbsolute(rawCwd)) {
    return rawCwd;
  }
  return path.resolve('/root', rawCwd);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { command, cwd } = body;

    if (typeof command !== 'string') {
      return NextResponse.json({ error: 'Command string is required' }, { status: 400 });
    }

    const trimmedCmd = command.trim();
    let resolvedCwd = resolveTerminalCwd(cwd);

    // Fallback if directory does not exist
    if (!fs.existsSync(resolvedCwd)) {
      resolvedCwd = '/root';
    }

    if (!trimmedCmd) {
      return NextResponse.json({ stdout: '', stderr: '', exitCode: 0, newCwd: resolvedCwd });
    }

    // Handle interactive terminal commands gracefully
    if (/^(nano|vi|vim)(\s+.*)?$/.test(trimmedCmd)) {
      return NextResponse.json({
        stdout: '',
        stderr: `[Terminal Notice] Interactive editors (${trimmedCmd.split(' ')[0]}) require a full raw TTY.\nTip: Open and edit files with syntax highlighting in the 'Files' tab, or view with 'cat <file>'.`,
        exitCode: 0,
        newCwd: resolvedCwd,
      });
    }

    const startTime = performance.now();

    // Transform commands that require non-interactive batch mode
    let executableCmd = trimmedCmd;

    // Auto-batch 'top' command to avoid TTY error
    if (/^top(\s.*)?$/.test(trimmedCmd)) {
      if (!trimmedCmd.includes('-b')) {
        executableCmd = 'top -b -n 1 | head -n 35';
      }
    }

    // Auto add -y to apt-get/apt install so it doesn't hang waiting for user stdin
    if (/^apt(-get)?\s+install(\s.*)?$/.test(trimmedCmd) && !trimmedCmd.includes('-y')) {
      executableCmd = trimmedCmd.replace(/^apt(-get)?\s+install/, '$& -y');
    }

    // Marker to extract new working directory after command runs
    const marker = '___ROOT_SSH_CWD_MARKER___';
    // Run command in bash, capture exit code, print marker with current directory, and exit with code
    const wrappedCmd = `${executableCmd}\n__ROOT_SSH_EXIT=$?\necho "${marker}$(pwd)"\nexit $__ROOT_SSH_EXIT`;

    return new Promise<NextResponse>((resolve) => {
      exec(
        wrappedCmd,
        {
          cwd: resolvedCwd,
          shell: '/bin/bash',
          timeout: 180000, // 3 minutes for long-running scripts / package installations
          maxBuffer: 15 * 1024 * 1024, // 15MB buffer
          env: {
            ...process.env,
            PATH: `/usr/local/sbin:/usr/sbin:/sbin:/usr/local/bin:/usr/bin:/bin:/root/.bun/bin:/root/.local/bin:${process.env.PATH || ''}`,
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US.UTF-8',
            COLUMNS: '120',
            LINES: '35',
            PAGER: 'cat',
            DEBIAN_FRONTEND: 'noninteractive',
            FORCE_COLOR: '1',
            SHELL: '/bin/bash',
            HOME: '/root',
            USER: 'root',
          },
        },
        (error, stdout, stderr) => {
          let cleanStdout = stdout || '';
          let newCwd = resolvedCwd;

          const markerIdx = cleanStdout.lastIndexOf(marker);
          if (markerIdx !== -1) {
            newCwd = cleanStdout.slice(markerIdx + marker.length).trim() || resolvedCwd;
            cleanStdout = cleanStdout.slice(0, markerIdx);
          }

          // If directory is invalid, stay at resolvedCwd
          if (!fs.existsSync(newCwd)) {
            newCwd = resolvedCwd;
          }

          resolve(
            NextResponse.json({
              stdout: cleanStdout.replace(/\r?\n$/, ''),
              stderr: (stderr || '').replace(/\r?\n$/, ''),
              exitCode: error && typeof error.code === 'number' ? error.code : error ? 1 : 0,
              newCwd,
              durationMs: Math.round(performance.now() - startTime),
            })
          );
        }
      );
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Execution failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
