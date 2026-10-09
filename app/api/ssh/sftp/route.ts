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
      action = 'list',
      remotePath = '.',
      content,
      newPath,
    } = body;

    if (!host || !username) {
      return NextResponse.json(
        { error: 'Host and username are required.' },
        { status: 400 }
      );
    }

    const result = await new Promise<any>((resolve, reject) => {
      const conn = new Client();
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          conn.end();
          reject(new Error('SFTP connection timed out (10s)'));
        }
      }, 10000);

      const cleanup = (res: any, isErr = false) => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        conn.end();
        if (isErr) reject(res);
        else resolve(res);
      };

      conn
        .on('ready', () => {
          conn.sftp((err, sftp) => {
            if (err) return cleanup(err, true);

            if (action === 'list') {
              sftp.readdir(remotePath, (err, list) => {
                if (err) return cleanup(err, true);
                const items = list.map((item) => {
                  const isDir = (item.attrs.mode & 0o040000) === 0o040000;
                  return {
                    name: item.filename,
                    path: remotePath.endsWith('/')
                      ? `${remotePath}${item.filename}`
                      : `${remotePath}/${item.filename}`,
                    type: isDir ? 'dir' : 'file',
                    size: item.attrs.size,
                    permissions: (item.attrs.mode & 0o777).toString(8).padStart(3, '0'),
                    owner: String(item.attrs.uid || 'user'),
                    modified: new Date(item.attrs.mtime * 1000)
                      .toISOString()
                      .slice(0, 16)
                      .replace('T', ' '),
                  };
                });

                items.sort((a, b) => {
                  if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
                  return a.name.localeCompare(b.name);
                });

                cleanup({ path: remotePath, items });
              });
            } else if (action === 'read') {
              const stream = sftp.createReadStream(remotePath);
              let data = '';
              stream.on('data', (chunk: Buffer | string) => {
                data += chunk.toString('utf8');
              });
              stream.on('end', () => {
                cleanup({ content: data });
              });
              stream.on('error', (err: unknown) => {
                cleanup(err, true);
              });
            } else if (action === 'download_base64') {
              const stream = sftp.createReadStream(remotePath);
              const chunks: Buffer[] = [];
              stream.on('data', (chunk: Buffer) => {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
              });
              stream.on('end', () => {
                const fullBuffer = Buffer.concat(chunks);
                cleanup({ base64: fullBuffer.toString('base64') });
              });
              stream.on('error', (err: unknown) => {
                cleanup(err, true);
              });
            } else if (action === 'write') {
              const stream = sftp.createWriteStream(remotePath);
              if (body.isBase64 && typeof content === 'string') {
                const buffer = Buffer.from(content, 'base64');
                stream.end(buffer, () => {
                  cleanup({ success: true });
                });
              } else {
                stream.end(content || '', 'utf8', () => {
                  cleanup({ success: true });
                });
              }
              stream.on('error', (err: unknown) => {
                cleanup(err, true);
              });
            } else if (action === 'mkdir') {
              sftp.mkdir(remotePath, (err: unknown) => {
                if (err) return cleanup(err, true);
                cleanup({ success: true });
              });
            } else if (action === 'delete') {
              // Try unlink first, then rmdir
              sftp.unlink(remotePath, (err: unknown) => {
                if (!err) return cleanup({ success: true });
                sftp.rmdir(remotePath, (rmErr: unknown) => {
                  if (rmErr) return cleanup(rmErr, true);
                  cleanup({ success: true });
                });
              });
            } else if (action === 'rename') {
              sftp.rename(remotePath, newPath, (err: unknown) => {
                if (err) return cleanup(err, true);
                cleanup({ success: true });
              });
            } else {
              cleanup(new Error(`Unsupported SFTP action: ${action}`), true);
            }
          });
        })
        .on('error', (err) => {
          cleanup(err, true);
        })
        .connect({
          host: String(host).trim(),
          port: Number(port) || 22,
          username: String(username).trim(),
          password: password ? String(password) : undefined,
          privateKey: privateKey ? String(privateKey) : undefined,
          readyTimeout: 7000,
        });
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'SFTP operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
