import { NextRequest, NextResponse } from 'next/server';
import net from 'net';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const host = String(body.host || '').trim();
    const port = Number(body.port || 22);
    const timeoutMs = Number(body.timeoutMs || 4500);

    if (!host) {
      return NextResponse.json(
        { reachable: false, error: 'Host address is required.' },
        { status: 400 }
      );
    }

    const startTime = performance.now();

    const result = await new Promise<{
      reachable: boolean;
      latencyMs: number;
      banner: string | null;
      error?: string;
    }>((resolve) => {
      const socket = new net.Socket();
      let settled = false;
      let bannerData = '';

      const finish = (payload: {
        reachable: boolean;
        latencyMs: number;
        banner: string | null;
        error?: string;
      }) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(payload);
      };

      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        const latencyMs = Math.round(performance.now() - startTime);
        // Wait briefly for SSH protocol identification string (RFC 4253)
        setTimeout(() => {
          finish({
            reachable: true,
            latencyMs,
            banner: bannerData.trim() || 'TCP Port Open (No SSH Banner Sent)',
          });
        }, 450);
      });

      socket.on('data', (chunk) => {
        bannerData += chunk.toString('utf8');
        if (bannerData.includes('\n')) {
          const latencyMs = Math.round(performance.now() - startTime);
          finish({
            reachable: true,
            latencyMs,
            banner: bannerData.split(/\r?\n/)[0].trim(),
          });
        }
      });

      socket.on('timeout', () => {
        finish({
          reachable: false,
          latencyMs: Math.round(performance.now() - startTime),
          banner: null,
          error: `Connection timed out after ${timeoutMs}ms`,
        });
      });

      socket.on('error', (err: Error) => {
        finish({
          reachable: false,
          latencyMs: Math.round(performance.now() - startTime),
          banner: null,
          error: err.message || 'TCP connection refused or unreachable',
        });
      });

      socket.connect(port, host);
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Probe request failed';
    return NextResponse.json({ reachable: false, error: message }, { status: 500 });
  }
}
