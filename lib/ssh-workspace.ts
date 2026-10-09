export type AuthMethod = 'key' | 'password' | 'none';

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

  // Strip leading ssh
  if (text.startsWith('ssh ')) {
    text = text.slice(4).trim();
  }

  let port = 22;

  // Check for -p <port> or -p<port>
  const portMatch = text.match(/(?:-p\s*|-P\s*)(\d+)/);
  if (portMatch) {
    port = parseInt(portMatch[1], 10) || 22;
    text = text.replace(/(?:-p\s*|-P\s*)\d+/, '').trim();
  }

  // Remove possible -l <user>
  let username = 'root';
  const userFlagMatch = text.match(/-l\s+([^\s]+)/);
  if (userFlagMatch) {
    username = userFlagMatch[1];
    text = text.replace(/-l\s+[^\s]+/, '').trim();
  }

  let hostname = '';
  let password: string | undefined = undefined;

  // Check for format: user:pass@host or user:pass@host:port
  if (text.includes('@')) {
    const atParts = text.split('@');
    const left = atParts[0].trim();
    const right = atParts.slice(1).join('@').trim();

    // Check if right has :port
    let rightHost = right;
    if (right.includes(':')) {
      const rightCol = right.split(':');
      rightHost = rightCol[0];
      const parsedPort = parseInt(rightCol[1], 10);
      if (!isNaN(parsedPort)) {
        port = parsedPort;
      }
    }

    if (left.includes(':')) {
      // user:pass@host
      const [u, p] = left.split(':');
      username = u || 'root';
      password = p;
      hostname = rightHost;
    } else {
      // Detect if left looks like host/IP (e.g. host@password) or standard user@host
      const isLeftHostLike = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(left) ||
        left.includes('.') ||
        left === 'localhost';
      const isRightHostLike = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(rightHost) ||
        rightHost.includes('.') ||
        rightHost === 'localhost';

      if (isLeftHostLike && !isRightHostLike) {
        // e.g. "192.168.1.5@mypassword" or "myvps.com@secret"
        hostname = left;
        username = 'root';
        password = right;
      } else {
        // standard "user@host"
        username = left || 'root';
        hostname = rightHost;
      }
    }
  } else {
    // No @ sign: could be host:port or host
    if (text.includes(':')) {
      const parts = text.split(':');
      hostname = parts[0];
      const parsedPort = parseInt(parts[1], 10);
      if (!isNaN(parsedPort)) {
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
