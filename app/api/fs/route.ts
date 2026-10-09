import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

function resolveLocalPath(inputPath?: string | null): string {
  if (!inputPath || inputPath === '~' || inputPath === '.' || inputPath === '/root' || inputPath === '/root/') {
    return '/root';
  }
  if (inputPath.startsWith('~/')) {
    return path.resolve('/root', inputPath.slice(2));
  }
  if (path.isAbsolute(inputPath)) {
    return path.normalize(inputPath);
  }
  return path.resolve('/root', inputPath);
}

function isAllowedLocalPath(resolvedPath: string): boolean {
  return resolvedPath === '/root' || resolvedPath.startsWith('/root/');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawPath = searchParams.get('path');
    const download = searchParams.get('download') === 'true';
    const targetPath = resolveLocalPath(rawPath);

    if (!isAllowedLocalPath(targetPath)) {
      return NextResponse.json(
        { error: 'EISDIR: illegal operation on a directory, read' },
        { status: 403 }
      );
    }

    const stat = await fs.stat(targetPath);

    if (download) {
      if (stat.isDirectory()) {
        return NextResponse.json({ error: 'Cannot download a directory directly' }, { status: 400 });
      }
      const fileBuffer = await fs.readFile(targetPath);
      const filename = path.basename(targetPath);
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
          'Content-Type': 'application/octet-stream',
          'Content-Length': fileBuffer.length.toString(),
        },
      });
    }

    if (!stat.isDirectory()) {
      return NextResponse.json({ error: 'Path is not a directory' }, { status: 400 });
    }

    const dirents = await fs.readdir(targetPath, { withFileTypes: true });

    const items = await Promise.all(
      dirents.map(async (d) => {
        const itemPath = path.join(targetPath, d.name);
        try {
          const itemStat = await fs.stat(itemPath);
          return {
            name: d.name,
            path: itemPath,
            type: d.isDirectory() ? 'dir' : 'file',
            size: itemStat.size,
            permissions: (itemStat.mode & 0o777).toString(8).padStart(3, '0'),
            owner: 'root',
            modified: itemStat.mtime.toISOString().slice(0, 16).replace('T', ' '),
          };
        } catch {
          return {
            name: d.name,
            path: itemPath,
            type: d.isDirectory() ? 'dir' : 'file',
            size: 0,
            permissions: '644',
            owner: 'root',
            modified: new Date().toISOString().slice(0, 16).replace('T', ' '),
          };
        }
      })
    );

    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const parent = targetPath === '/root' ? '/root' : path.dirname(targetPath);

    return NextResponse.json({
      path: targetPath,
      parentPath: parent,
      items,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to read directory';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'read') {
      const filePath = resolveLocalPath(body.path);
      if (!isAllowedLocalPath(filePath)) {
        return NextResponse.json(
          { error: 'EISDIR: illegal operation on a directory, read' },
          { status: 403 }
        );
      }
      const content = await fs.readFile(filePath, 'utf-8');
      const stat = await fs.stat(filePath);
      return NextResponse.json({
        content,
        size: stat.size,
        modified: stat.mtime.toISOString(),
      });
    }

    if (action === 'write') {
      const filePath = resolveLocalPath(body.path);
      if (!isAllowedLocalPath(filePath)) {
        return NextResponse.json(
          { error: 'EISDIR: illegal operation on a directory, read' },
          { status: 403 }
        );
      }
      if (body.isBase64 && typeof body.content === 'string') {
        const buffer = Buffer.from(body.content, 'base64');
        await fs.writeFile(filePath, buffer);
      } else {
        await fs.writeFile(filePath, body.content ?? '', 'utf-8');
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'mkdir') {
      const dirPath = resolveLocalPath(body.path);
      if (!isAllowedLocalPath(dirPath)) {
        return NextResponse.json(
          { error: 'EISDIR: illegal operation on a directory, read' },
          { status: 403 }
        );
      }
      await fs.mkdir(dirPath, { recursive: true });
      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      const targetPath = resolveLocalPath(body.path);
      if (!isAllowedLocalPath(targetPath) || targetPath === '/root') {
        return NextResponse.json(
          { error: 'EISDIR: illegal operation on a directory, read' },
          { status: 403 }
        );
      }
      await fs.rm(targetPath, { recursive: true, force: true });
      return NextResponse.json({ success: true });
    }

    if (action === 'rename') {
      const oldPath = resolveLocalPath(body.oldPath);
      const newPath = resolveLocalPath(body.newPath);
      if (!isAllowedLocalPath(oldPath) || !isAllowedLocalPath(newPath)) {
        return NextResponse.json(
          { error: 'EISDIR: illegal operation on a directory, read' },
          { status: 403 }
        );
      }
      await fs.rename(oldPath, newPath);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Filesystem operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
