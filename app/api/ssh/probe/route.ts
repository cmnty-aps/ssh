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
      detectedDistro?: string;
      error?: string;
    }>((resolve) => {
      const socket = new net.Socket();
      let settled = false;
      let bannerData = '';

      const finish = (payload: {
        reachable: boolean;
        latencyMs: number;
        banner: string | null;
        detectedDistro?: string;
        error?: string;
      }) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(payload);
      };

      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        try {
          socket.write('SSH-2.0-RemixSSH_1.0\r\n');
        } catch {}

        setTimeout(() => {
          const latencyMs = Math.round(performance.now() - startTime);
          const rawBanner = bannerData.split(/\r?\n/)[0]?.trim() || '';
          const banner = rawBanner || 'TCP Port Open (No SSH Banner)';
          const bLower = banner.toLowerCase();

          let detectedDistro = 'linux';
          if (bLower.includes('ubuntu')) detectedDistro = 'ubuntu';
          else if (bLower.includes('debian')) detectedDistro = 'debian';
          else if (bLower.includes('centos')) detectedDistro = 'centos';
          else if (bLower.includes('alpine')) detectedDistro = 'alpine';
          else if (bLower.includes('arch')) detectedDistro = 'arch';
          else if (bLower.includes('kali')) detectedDistro = 'kali';
          else if (bLower.includes('fedora')) detectedDistro = 'fedora';
          else if (
            bLower.includes('red hat') ||
            bLower.includes('rhel') ||
            bLower.includes('redhat') ||
            bLower.includes('rocky') ||
            bLower.includes('alma') ||
            bLower.includes('.el')
          ) {
            detectedDistro = 'redhat';
          } else if (bLower.includes('suse') || bLower.includes('opensuse')) {
            detectedDistro = 'suse';
          } else if (bLower.includes('apple') || bLower.includes('darwin')) {
            detectedDistro = 'darwin';
          } else if (bLower.includes('windows')) {
            detectedDistro = 'windows';
          }

          finish({
            reachable: true,
            latencyMs,
            banner,
            detectedDistro,
          });
        }, 350);
      });

      socket.on('data', (chunk) => {
        bannerData += chunk.toString('utf8');
        if (bannerData.includes('\n')) {
          const latencyMs = Math.round(performance.now() - startTime);
          const rawBanner = bannerData.split(/\r?\n/)[0]?.trim() || '';
          const bLower = rawBanner.toLowerCase();

          let detectedDistro = 'linux';
          if (bLower.includes('ubuntu')) detectedDistro = 'ubuntu';
          else if (bLower.includes('debian')) detectedDistro = 'debian';
          else if (bLower.includes('centos')) detectedDistro = 'centos';
          else if (bLower.includes('alpine')) detectedDistro = 'alpine';
          else if (bLower.includes('arch')) detectedDistro = 'arch';
          else if (bLower.includes('kali')) detectedDistro = 'kali';
          else if (bLower.includes('fedora')) detectedDistro = 'fedora';
          else if (
            bLower.includes('red hat') ||
            bLower.includes('rhel') ||
            bLower.includes('redhat') ||
            bLower.includes('rocky') ||
            bLower.includes('alma') ||
            bLower.includes('.el')
          ) {
            detectedDistro = 'redhat';
          } else if (bLower.includes('suse') || bLower.includes('opensuse')) {
            detectedDistro = 'suse';
          } else if (bLower.includes('apple') || bLower.includes('darwin')) {
            detectedDistro = 'darwin';
          } else if (bLower.includes('windows')) {
            detectedDistro = 'windows';
          }

          finish({
            reachable: true,
            latencyMs,
            banner: rawBanner,
            detectedDistro,
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
