export type AuthMethod = 'key' | 'password' | 'none';

export type DistroType =
  | 'ubuntu'
  | 'debian'
  | 'alpine'
  | 'arch'
  | 'fedora'
  | 'centos'
  | 'redhat'
  | 'kali'
  | 'suse'
  | 'darwin'
  | 'windows'
  | 'linux';

export interface SshHost {
  id: string;
  label: string;
  hostname: string;
  port: number;
  username: string;
  group: 'Production' | 'Staging' | 'Database' | 'Local' | 'Custom';
  authMethod: AuthMethod;
  keyId?: string;
  password?: string;
  distro?: DistroType;
  isLocalWorkspace?: boolean;
  probeStatus?: {
    checkedAt: string;
    reachable: boolean;
    latencyMs: number;
    banner: string | null;
    error?: string;
  };
  lastConnected?: string;
}

export interface FsItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
  permissions: string;
  owner: string;
  modified: string;
}

export interface SshSnippet {
  id: string;
  name: string;
  category: 'System' | 'Docker' | 'Network' | 'Logs' | 'Git';
  command: string;
  description: string;
}

export interface SshKeyItem {
  id: string;
  label: string;
  algorithm: 'Ed25519' | 'RSA';
  bits: number;
  fingerprint: string;
  publicKey: string;
  privateKey: string;
  createdAt: string;
}

export interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system';
  text: string;
  timestamp: string;
  cwd?: string;
}

export interface TerminalSession {
  id: string;
  hostId: string;
  title: string;
  cwd: string;
  connected: boolean;
  connecting: boolean;
  history: string[];
  lines: TerminalLine[];
}

export const INITIAL_HOSTS: SshHost[] = [
  {
    id: 'host-local',
    label: 'Local host',
    hostname: 'localhost',
    port: 22,
    username: 'root',
    group: 'Local',
    authMethod: 'none',
    distro: 'debian',
    isLocalWorkspace: true,
    lastConnected: 'Ready',
    probeStatus: {
      checkedAt: new Date().toLocaleTimeString(),
      reachable: true,
      latencyMs: 1,
      banner: 'Debian GNU/Linux 12 (bookworm) — Root PTY (apt, bash, git, python3, bun, npm)',
    },
  },
];

export const INITIAL_KEYS: SshKeyItem[] = [
  {
    id: 'key-ed25519-default',
    label: 'id_ed25519_default',
    algorithm: 'Ed25519',
    bits: 256,
    fingerprint: 'SHA256:d8K3hQ4mL1vZ0nW9xP2jC7tY6bE4rT8uI5oA2sD0',
    publicKey:
      'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIInp3X9V8B1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z admin@ssh-client',
    privateKey:
      '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW\nQyNTUxOQAAACAAInp3X9V8B1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6ZAAAA\n-----END OPENSSH PRIVATE KEY-----',
    createdAt: new Date().toISOString().slice(0, 10),
  },
];

export const INITIAL_SNIPPETS: SshSnippet[] = [
  {
    id: 'snip-1',
    name: 'System Info & Uptime',
    category: 'System',
    command: 'uname -a && uptime && free -h && df -h',
    description: 'Kernel version, system uptime, memory and disk utilization',
  },
  {
    id: 'snip-2',
    name: 'Top Processes by Memory',
    category: 'System',
    command: 'ps aux --sort=-%mem | head -n 10',
    description: 'Inspect top 10 resource-heavy memory processes',
  },
  {
    id: 'snip-3',
    name: 'Listening Ports',
    category: 'Network',
    command: 'ss -tulpn || netstat -tulnp',
    description: 'List all open and listening TCP/UDP sockets with PIDs',
  },
  {
    id: 'snip-4',
    name: 'Docker Status',
    category: 'Docker',
    command: 'docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"',
    description: 'Formatted view of all Docker containers and ports',
  },
  {
    id: 'snip-5',
    name: 'Git Status & Branch',
    category: 'Git',
    command: 'git status -s && git branch -vv',
    description: 'Short Git working tree status and branch tracking',
  },
  {
    id: 'snip-6',
    name: 'Recent System Logs',
    category: 'Logs',
    command: 'journalctl -n 50 --no-pager || tail -n 50 /var/log/syslog',
    description: 'Last 50 system log messages',
  },
];

export interface ParsedSshConnection {
  username: string;
  hostname: string;
  port: number;
  password?: string;
  label?: string;
}

export function parseSshConnectionString(raw: string): ParsedSshConnection {
  let text = raw.trim();

  if (text.startsWith('ssh ')) {
    text = text.slice(4).trim();
  }

  let port = 22;

  const portMatch = text.match(/(?:-p\s*|-P\s*)(\d+)/i);
  if (portMatch) {
    port = parseInt(portMatch[1], 10) || 22;
    text = text.replace(/(?:-p\s*|-P\s*)\d+/i, '').trim();
  }

  let username = 'root';
  const userFlagMatch = text.match(/-l\s+([^\s]+)/i);
  if (userFlagMatch) {
    username = userFlagMatch[1];
    text = text.replace(/-l\s+[^\s]+/i, '').trim();
  }

  let hostname = '';
  let password: string | undefined = undefined;

  if (text.includes('@')) {
    const atParts = text.split('@');
    const left = atParts[0].trim();
    const right = atParts.slice(1).join('@').trim();

    let rightHost = right;
    if (right.includes(':')) {
      const rightCol = right.split(':');
      rightHost = rightCol[0];
      const parsedPort = parseInt(rightCol[1], 10);
      if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
        port = parsedPort;
      }
    }

    if (left.includes(':')) {
      const [u, p] = left.split(':');
      username = u || 'root';
      password = p;
      hostname = rightHost;
    } else {
      username = left || 'root';
      hostname = rightHost;
    }
  } else {
    if (text.includes(':')) {
      const parts = text.split(':');
      hostname = parts[0];
      const parsedPort = parseInt(parts[1], 10);
      if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
        port = parsedPort;
      }
    } else {
      hostname = text;
    }
  }

  return {
    username: username || 'root',
    hostname: hostname || 'localhost',
    port: port || 22,
    password,
    label: hostname || 'New Host',
  };
}

export function validateQuickConnectInput(raw: string): {
  valid: boolean;
  error?: string;
  parsed?: ParsedSshConnection;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, error: 'Masukkan string koneksi SSH.' };
  }

  if (/[;&|`<>$]/.test(trimmed)) {
    return { valid: false, error: 'Karakter tidak valid terdeteksi.' };
  }

  let checkText = trimmed;
  if (checkText.startsWith('ssh ')) {
    checkText = checkText.slice(4).trim();
  }

  const portMatch = checkText.match(/(?:-p\s*|-P\s*)(\d+)/i);
  if (portMatch) {
    const p = parseInt(portMatch[1], 10);
    if (isNaN(p) || p <= 0 || p > 65535) {
      return { valid: false, error: 'Port SSH harus antara 1 sampai 65535.' };
    }
    checkText = checkText.replace(/(?:-p\s*|-P\s*)\d+/i, '').trim();
  }

  const userFlagMatch = checkText.match(/-l\s+([^\s]+)/i);
  if (userFlagMatch) {
    const u = userFlagMatch[1];
    if (!/^[a-zA-Z0-9_.-]{1,32}$/.test(u)) {
      return { valid: false, error: 'Format username SSH tidak valid.' };
    }
    checkText = checkText.replace(/-l\s+[^\s]+/i, '').trim();
  }

  if (checkText.includes(' ')) {
    return {
      valid: false,
      error: 'Format tidak valid. Contoh yang benar: root@192.168.1.1 atau user@hostname:22 atau ssh -p 22 root@host',
    };
  }

  const parsed = parseSshConnectionString(trimmed);

  if (!parsed.hostname || parsed.hostname.length < 2) {
    return { valid: false, error: 'Alamat host (IP atau domain) tidak boleh kosong.' };
  }

  const isIpv4 =
    /^(\d{1,3}\.){3}\d{1,3}$/.test(parsed.hostname) &&
    parsed.hostname.split('.').every((oct) => {
      const num = parseInt(oct, 10);
      return num >= 0 && num <= 255;
    });

  const isIpv6 = parsed.hostname.includes(':') && /^[0-9a-fA-F:]+$/.test(parsed.hostname);

  const isDomainOrHost = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(
    parsed.hostname
  );

  if (!isIpv4 && !isIpv6 && !isDomainOrHost) {
    return {
      valid: false,
      error: `Hostname "${parsed.hostname}" tidak valid. Gunakan format domain atau IP yang valid.`,
    };
  }

  if (!/^[a-zA-Z0-9_.-]{1,32}$/.test(parsed.username)) {
    return { valid: false, error: `Username "${parsed.username}" tidak valid.` };
  }

  if (parsed.port <= 0 || parsed.port > 65535) {
    return { valid: false, error: `Port "${parsed.port}" tidak valid (harus 1-65535).` };
  }

  return { valid: true, parsed };
}
