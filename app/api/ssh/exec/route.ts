import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'ssh2';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      host,
      port = 22,
      username,
      password,
      privateKey,
      command,
      cwd = '~',
    } = body;

    if (!host || !username || !command) {
      return NextResponse.json(
        { error: 'Host, username, and command are required for live SSH execution.' },
        { status: 400 }
      );
    }

    const startTime = performance.now();

    const executionResult = await new Promise<{
      stdout: string;
      stderr: string;
      exitCode: number;
      newCwd: string;
      durationMs: number;
      serverFingerprint?: string;
    }>((resolve, reject) => {
      const conn = new Client();
      let settled = false;
      let serverFingerprint = '';

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          conn.end();
          reject(new Error('SSH command execution timed out (15s limit).'));
        }
      }, 15000);

      conn
        .on('ready', () => {
          const wrappedCommand =
            cwd && cwd !== '~'
              ? `cd ${JSON.stringify(cwd)} 2>/dev/null; ${command}; echo "__TERMIUS_CWD__$(pwd)"`
              : `${command}; echo "__TERMIUS_CWD__$(pwd)"`;

          const execOptions = {
            pty: {
              term: 'xterm-256color',
              rows: 35,
              cols: 120,
            },
          };

          conn.exec(wrappedCommand, execOptions, (err, stream) => {
            if (err) {
              clearTimeout(timer);
              settled = true;
              conn.end();
              return reject(err);
            }

            let stdout = '';
            let stderr = '';

            stream
              .on('close', (code: number) => {
                clearTimeout(timer);
                if (settled) return;
                settled = true;
                conn.end();

                let newCwd = cwd;
                const cwdMarker = '__TERMIUS_CWD__';
                const markerIdx = stdout.lastIndexOf(cwdMarker);
                if (markerIdx !== -1) {
                  newCwd = stdout.slice(markerIdx + cwdMarker.length).trim() || cwd;
                  stdout = stdout.slice(0, markerIdx);
                }

                resolve({
                  stdout: stdout.replace(/\r?\n$/, ''),
                  stderr: stderr.replace(/\r?\n$/, ''),
                  exitCode: typeof code === 'number' ? code : 0,
                  newCwd,
                  durationMs: Math.round(performance.now() - startTime),
                  serverFingerprint,
                });
              })
              .on('data', (data: Buffer) => {
                stdout += data.toString('utf8');
              })
              .stderr.on('data', (data: Buffer) => {
                stderr += data.toString('utf8');
              });
          });
        })
        .on('error', (err) => {
          clearTimeout(timer);
          if (!settled) {
            settled = true;
            reject(err);
          }
        })
        .connect({
          host: String(host).trim(),
          port: Number(port) || 22,
          username: String(username).trim(),
          password: password ? String(password) : undefined,
          privateKey: privateKey ? String(privateKey) : undefined,
          readyTimeout: 7000,
          hostVerifier: (keyHash: Buffer | string) => {
            serverFingerprint =
              typeof keyHash === 'string'
                ? keyHash
                : `SHA256:${keyHash.toString('base64').replace(/=+$/, '')}`;
            return true;
          },
        });
    });

    return NextResponse.json(executionResult);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'SSH execution failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
