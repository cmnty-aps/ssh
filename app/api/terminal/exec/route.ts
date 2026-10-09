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

    if (!fs.existsSync(resolvedCwd)) {
      resolvedCwd = '/root';
    }

    if (!trimmedCmd) {
      return NextResponse.json({ stdout: '', stderr: '', exitCode: 0, newCwd: resolvedCwd });
    }

    const startTime = performance.now();

    let executableCmd = trimmedCmd;

    if (/^top(\s.*)?$/.test(trimmedCmd) && !trimmedCmd.includes('-b')) {
      executableCmd = 'top -b -n 1 | head -n 35';
    }

    if (/^htop(\s.*)?$/.test(trimmedCmd)) {
      executableCmd = 'top -b -n 1 | head -n 35';
    }

    if (/^apt(-get)?\s+install(\s.*)?$/.test(trimmedCmd) && !trimmedCmd.includes('-y')) {
      executableCmd = trimmedCmd.replace(/^apt(-get)?\s+install/, '$& -y');
    }

    if (/^(nano|vi|vim)(\s+.*)?$/.test(trimmedCmd)) {
      const parts = trimmedCmd.split(/\s+/);
      const targetFile = parts.slice(1).join(' ').trim();
      if (!targetFile) {
        return NextResponse.json({
          stdout: `GNU nano 7.2 (Terminal Mode)\n\n[ Untuk mengedit file dengan antarmuka grafis & syntax highlighting lengkap, gunakan tab 'Files'. ]`,
          stderr: '',
          exitCode: 0,
          newCwd: resolvedCwd,
        });
      }
      executableCmd = `cat "${targetFile}" 2>/dev/null || echo "[File baru: ${targetFile}]"`;
    }

    const marker = '___ROOT_SSH_CWD_MARKER___';
    const wrappedCmd = `/bin/bash -c "script -q -c \\"${executableCmd.replace(/"/g, '\\"')}\\" /dev/null 2>/dev/null || (${executableCmd}); __ROOT_SSH_EXIT=$?; echo \\"${marker}\\$(pwd)\\"; exit \\$__ROOT_SSH_EXIT"`;

    return new Promise<NextResponse>((resolve) => {
      exec(
        wrappedCmd,
        {
          cwd: resolvedCwd,
          shell: '/bin/bash',
          timeout: 180000,
          maxBuffer: 15 * 1024 * 1024,
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
