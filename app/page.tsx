'use client';

import React, { useState, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  Server,
  FolderTree,
  Key,
  Code,
  Plus,
  Search,
  Trash2,
  RefreshCw,
  X,
  Play,
  ArrowRight,
  Shield,
  Loader2,
  Menu,
  Pencil,
  LogIn,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  SshHost,
  SshKeyItem,
  SshSnippet,
  TerminalSession,
  DistroType,
  INITIAL_HOSTS,
  INITIAL_KEYS,
  INITIAL_SNIPPETS,
  validateQuickConnectInput,
} from '@/lib/ssh-workspace';
import DistroIcon from '@/components/distro-icon';
import TerminalWorkspace from '@/components/terminal-workspace';
import SftpWorkspace from '@/components/sftp-workspace';
import KeychainWorkspace from '@/components/keychain-workspace';
import SnippetsWorkspace from '@/components/snippets-workspace';

type NavTab = 'hosts' | 'terminal' | 'sftp' | 'keys' | 'snippets';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('hosts');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [hosts, setHosts] = useState<SshHost[]>(INITIAL_HOSTS);
  const [keys, setKeys] = useState<SshKeyItem[]>(INITIAL_KEYS);
  const [snippets, setSnippets] = useState<SshSnippet[]>(INITIAL_SNIPPETS);

  const [sftpHostId, setSftpHostId] = useState<string>(INITIAL_HOSTS[0].id);

  const [sessions, setSessions] = useState<TerminalSession[]>([
    {
      id: 'session-local-1',
      hostId: 'host-local',
      title: 'root@localhost',
      cwd: '/root',
      connected: true,
      connecting: false,
      history: ['uname -a', 'pwd'],
      lines: [],
    },
  ]);
  const [activeSessionId, setActiveSessionId] = useState<string>('session-local-1');

  const [quickConnectInput, setQuickConnectInput] = useState('');
  const [quickConnectError, setQuickConnectError] = useState<string | null>(null);
  const [showAddHostModal, setShowAddHostModal] = useState(false);
  const [probingHostId, setProbingHostId] = useState<string | null>(null);
  const [connectingHostId, setConnectingHostId] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [hostSearch, setHostSearch] = useState('');
  const [editingHost, setEditingHost] = useState<SshHost | null>(null);
  const [showMobileQuickConnect, setShowMobileQuickConnect] = useState(false);

  const [formLabel, setFormLabel] = useState('');
  const [formHostname, setFormHostname] = useState('');
  const [formPort, setFormPort] = useState(22);
  const [formUsername, setFormUsername] = useState('root');
  const [formAuthMethod, setFormAuthMethod] = useState<'password' | 'key'>('password');
  const [formKeyId, setFormKeyId] = useState<string>(INITIAL_KEYS[0]?.id || '');
  const [formPassword, setFormPassword] = useState('');
  const [formDistro, setFormDistro] = useState<DistroType | 'auto'>('auto');
  const [formGroup, setFormGroup] = useState<SshHost['group']>('Production');

  const handleProbeHost = async (host: SshHost): Promise<boolean> => {
    if (host.isLocalWorkspace) {
      setHosts((prev) =>
        prev.map((h) =>
          h.id === host.id
            ? {
                ...h,
                probeStatus: {
                  checkedAt: new Date().toLocaleTimeString(),
                  reachable: true,
                  latencyMs: 1,
                  banner: 'Debian GNU/Linux 12 (bookworm) — Full PTY (apt, npm, bun, python3, git)',
                },
                lastConnected: 'Ready',
              }
            : h
        )
      );
      return true;
    }

    setProbingHostId(host.id);
    try {
      const res = await fetch('/api/ssh/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: host.hostname, port: host.port, timeoutMs: 5000 }),
      });
      const data = await res.json();
      const isReachable = Boolean(data.reachable);

      setHosts((prev) =>
        prev.map((h) =>
          h.id === host.id
            ? {
                ...h,
                distro:
                  h.distro && h.distro !== 'linux'
                    ? h.distro
                    : (data.detectedDistro as DistroType) || h.distro,
                probeStatus: {
                  checkedAt: new Date().toLocaleTimeString(),
                  reachable: isReachable,
                  latencyMs: Number(data.latencyMs) || 0,
                  banner: data.banner || null,
                  error: data.error,
                },
                lastConnected: isReachable ? 'Connected' : 'Disconnected',
              }
            : h
        )
      );

      return isReachable;
    } catch (err: unknown) {
      setHosts((prev) =>
        prev.map((h) =>
          h.id === host.id
            ? {
                ...h,
                probeStatus: {
                  checkedAt: new Date().toLocaleTimeString(),
                  reachable: false,
                  latencyMs: 0,
                  banner: null,
                  error: err instanceof Error ? err.message : 'Network error',
                },
                lastConnected: 'Disconnected',
              }
            : h
        )
      );
      return false;
    } finally {
      setProbingHostId(null);
    }
  };

  const handleOpenHostSession = (host: SshHost) => {
    const isOnline = Boolean(host.isLocalWorkspace || host.probeStatus?.reachable);
    if (!isOnline) {
      setConnectionError(
        `Akses ditolak: Host "${host.label}" belum terhubung. Pastikan statusnya CONNECTED sebelum membuka terminal.`
      );
      return;
    }

    const newSessionId = `session-${Date.now()}`;
    const newSession: TerminalSession = {
      id: newSessionId,
      hostId: host.id,
      title: `${host.username}@${host.hostname}`,
      cwd: host.isLocalWorkspace ? '/root' : '~',
      connected: true,
      connecting: false,
      history: [],
      lines: host.isLocalWorkspace
        ? []
        : [
            {
              id: `line-${Date.now()}-1`,
              type: 'system',
              text: `Connected to ${host.username}@${host.hostname}:${host.port}`,
              timestamp: new Date().toTimeString().slice(0, 8),
            },
          ],
    };

    setSessions((prev) => [...prev, newSession]);
    setActiveSessionId(newSessionId);
    setActiveTab('terminal');
    setHosts((prev) =>
      prev.map((h) => (h.id === host.id ? { ...h, lastConnected: 'Just now' } : h))
    );
  };

  const handleConnectHost = async (host: SshHost) => {
    setConnectionError(null);
    if (host.isLocalWorkspace || host.probeStatus?.reachable) {
      handleOpenHostSession(host);
      return;
    }

    setConnectingHostId(host.id);
    const reachable = await handleProbeHost(host);
    setConnectingHostId(null);

    if (reachable) {
      handleOpenHostSession(host);
    } else {
      setConnectionError(
        `Gagal terhubung ke "${host.label}" (${host.hostname}:${host.port}). Periksa alamat IP, port SSH, dan firewall.`
      );
    }
  };

  const handleExecuteCommand = async (sessionId: string, command: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const host = hosts.find((h) => h.id === session.hostId);
    if (!host) return;

    const trimmed = command.trim();
    const nowTime = new Date().toTimeString().slice(0, 8);

    if (!trimmed) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                lines: [
                  ...s.lines,
                  {
                    id: `in-${Date.now()}`,
                    type: 'input',
                    text: '',
                    timestamp: nowTime,
                    cwd: s.cwd,
                  },
                ],
              }
            : s
        )
      );
      return;
    }

    if (trimmed === 'clear') {
      handleClearSession(sessionId);
      return;
    }

    if (trimmed === '^C' || trimmed === '^Z' || trimmed === '^X' || trimmed === '^O') {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                lines: [
                  ...s.lines,
                  {
                    id: `in-${Date.now()}`,
                    type: 'input',
                    text: trimmed,
                    timestamp: nowTime,
                    cwd: s.cwd,
                  },
                ],
              }
            : s
        )
      );
      return;
    }

    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              history: [...s.history, trimmed],
              lines: [
                ...s.lines,
                {
                  id: `in-${Date.now()}`,
                  type: 'input',
                  text: trimmed,
                  timestamp: nowTime,
                  cwd: s.cwd,
                },
              ],
            }
          : s
      )
    );

    try {
      if (host.isLocalWorkspace) {
        const res = await fetch('/api/terminal/exec', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: trimmed, cwd: session.cwd }),
        });
        const data = await res.json();

        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== sessionId) return s;
            const updatedLines = [...s.lines];

            if (data.error) {
              updatedLines.push({
                id: `err-${Date.now()}`,
                type: 'error',
                text: data.error,
                timestamp: nowTime,
              });
            } else {
              if (data.stdout) {
                updatedLines.push({
                  id: `out-${Date.now()}`,
                  type: 'output',
                  text: data.stdout,
                  timestamp: nowTime,
                });
              }
              if (data.stderr) {
                updatedLines.push({
                  id: `err-${Date.now()}`,
                  type: 'error',
                  text: data.stderr,
                  timestamp: nowTime,
                });
              }
              if (!data.stdout && !data.stderr && data.exitCode !== 0) {
                updatedLines.push({
                  id: `err-${Date.now()}`,
                  type: 'error',
                  text: `Process exited with code ${data.exitCode}`,
                  timestamp: nowTime,
                });
              }
            }

            return {
              ...s,
              cwd: data.newCwd || s.cwd,
              lines: updatedLines,
            };
          })
        );
      } else {
        const selectedKey = keys.find((k) => k.id === host.keyId);
        const res = await fetch('/api/ssh/exec', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: host.hostname,
            port: host.port,
            username: host.username,
            password: host.password,
            privateKey: host.authMethod === 'key' ? selectedKey?.privateKey : undefined,
            command: trimmed,
            cwd: session.cwd,
          }),
        });
        const data = await res.json();

        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== sessionId) return s;
            const updatedLines = [...s.lines];

            if (data.error) {
              updatedLines.push({
                id: `err-${Date.now()}`,
                type: 'error',
                text: `SSH: ${data.error}`,
                timestamp: nowTime,
              });
            } else {
              if (data.stdout) {
                updatedLines.push({
                  id: `out-${Date.now()}`,
                  type: 'output',
                  text: data.stdout,
                  timestamp: nowTime,
                });
              }
              if (data.stderr) {
                updatedLines.push({
                  id: `err-${Date.now()}`,
                  type: 'error',
                  text: data.stderr,
                  timestamp: nowTime,
                });
              }
            }

            return {
              ...s,
              cwd: data.newCwd || s.cwd,
              lines: updatedLines,
            };
          })
        );
      }
    } catch (err: unknown) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                lines: [
                  ...s.lines,
                  {
                    id: `err-${Date.now()}`,
                    type: 'error',
                    text: err instanceof Error ? err.message : 'Execution error',
                    timestamp: nowTime,
                  },
                ],
              }
            : s
        )
      );
    }
  };

  const handleClearSession = (sessionId: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, lines: [] } : s))
    );
  };

  const handleCloseSession = (sessionId: string) => {
    const remaining = sessions.filter((s) => s.id !== sessionId);
    if (remaining.length === 0) {
      const fallbackSession: TerminalSession = {
        id: `session-${Date.now()}`,
        hostId: 'host-local',
        title: 'root@localhost',
        cwd: '/root',
        connected: true,
        connecting: false,
        history: [],
        lines: [],
      };
      setSessions([fallbackSession]);
      setActiveSessionId(fallbackSession.id);
    } else {
      setSessions(remaining);
      if (activeSessionId === sessionId) {
        setActiveSessionId(remaining[0].id);
      }
    }
  };

  const handleQuickConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickConnectError(null);
    setConnectionError(null);

    const validation = validateQuickConnectInput(quickConnectInput);
    if (!validation.valid || !validation.parsed) {
      setQuickConnectError(
        validation.error ||
          'Format Quick Connect tidak valid. Contoh yang benar: root@192.168.1.1 atau user@hostname:22'
      );
      return;
    }

    const parsed = validation.parsed;

    const newHost: SshHost = {
      id: `host-${Date.now()}`,
      label: `${parsed.username}@${parsed.hostname}`,
      hostname: parsed.hostname,
      port: parsed.port,
      username: parsed.username,
      group: 'Custom',
      authMethod: 'password',
      password: parsed.password || undefined,
      lastConnected: 'Menghubungkan host...',
    };

    setHosts((prev) => [newHost, ...prev]);
    setQuickConnectInput('');
    setShowMobileQuickConnect(false);

    setConnectingHostId(newHost.id);
    const reachable = await handleProbeHost(newHost);
    setConnectingHostId(null);

    if (reachable) {
      handleOpenHostSession(newHost);
    } else {
      setConnectionError(
        `Host "${newHost.label}" berhasil ditambahkan, namun gagal terhubung (${newHost.hostname}:${newHost.port}).`
      );
    }
  };

  const handleAddHost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formHostname.trim() || !formUsername.trim()) return;

    const newHost: SshHost = {
      id: `host-${Date.now()}`,
      label: formLabel.trim() || `${formUsername.trim()}@${formHostname.trim()}`,
      hostname: formHostname.trim(),
      port: formPort || 22,
      username: formUsername.trim(),
      group: formGroup,
      authMethod: formAuthMethod,
      distro: formDistro === 'auto' ? undefined : formDistro,
      keyId: formAuthMethod === 'key' ? formKeyId : undefined,
      password: formAuthMethod === 'password' ? formPassword : undefined,
      lastConnected: 'Never',
    };

    setHosts((prev) => [newHost, ...prev]);
    setShowAddHostModal(false);
    setFormLabel('');
    setFormHostname('');
    setFormPort(22);
    setFormUsername('root');
    setFormPassword('');
    setFormDistro('auto');
  };

  const handleStartEditHost = (host: SshHost) => {
    setEditingHost(host);
    setFormLabel(host.label);
    setFormHostname(host.hostname);
    setFormPort(host.port);
    setFormUsername(host.username);
    setFormAuthMethod(host.authMethod === 'none' ? 'password' : host.authMethod);
    setFormKeyId(host.keyId || keys[0]?.id || '');
    setFormPassword(host.password || '');
    setFormDistro(host.distro || 'auto');
    setFormGroup(host.group);
  };

  const handleSaveEditHost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHost || !formHostname.trim() || !formUsername.trim()) return;

    setHosts((prev) =>
      prev.map((h) =>
        h.id === editingHost.id
          ? {
              ...h,
              label: formLabel.trim() || `${formUsername.trim()}@${formHostname.trim()}`,
              hostname: formHostname.trim(),
              port: formPort || 22,
              username: formUsername.trim(),
              group: formGroup,
              distro: formDistro === 'auto' ? undefined : formDistro,
              authMethod: formAuthMethod,
              keyId: formAuthMethod === 'key' ? formKeyId : undefined,
              password: formAuthMethod === 'password' ? formPassword : undefined,
            }
          : h
      )
    );

    setEditingHost(null);
    setFormLabel('');
    setFormHostname('');
    setFormPort(22);
    setFormUsername('root');
    setFormPassword('');
    setFormDistro('auto');
  };

  const handleDeleteHost = (hostId: string) => {
    if (confirm('Hapus host ini?')) {
      setHosts((prev) => prev.filter((h) => h.id !== hostId));
    }
  };

  const filteredHosts = hosts.filter((h) => {
    const q = hostSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      h.label.toLowerCase().includes(q) ||
      h.hostname.toLowerCase().includes(q) ||
      h.username.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-full bg-black text-white font-sans overflow-hidden select-none min-h-0 min-w-0">
      <header className="h-12 border-b border-zinc-800 bg-zinc-950 px-2 sm:px-4 flex items-center justify-between shrink-0 z-20 min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-2 font-mono font-semibold text-xs tracking-wider text-white shrink-0">
            <span className="w-2 h-2 bg-white rounded-full inline-block" />
            <span>TERMIUS</span>
          </div>

          <nav className="hidden md:flex items-center gap-1 ml-4">
            {(
              [
                { id: 'hosts', label: 'Hosts', icon: Server },
                { id: 'terminal', label: 'Terminal', icon: TerminalIcon },
                { id: 'sftp', label: 'Files', icon: FolderTree },
                { id: 'keys', label: 'Keys', icon: Key },
                { id: 'snippets', label: 'Snippets', icon: Code },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded text-xs flex items-center gap-1.5 transition-colors ${
                    isActive
                      ? 'bg-zinc-800 text-white font-medium'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <form
            onSubmit={handleQuickConnect}
            className="hidden sm:flex items-center bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-xs"
          >
            <input
              type="text"
              value={quickConnectInput}
              onChange={(e) => {
                setQuickConnectInput(e.target.value);
                if (quickConnectError) setQuickConnectError(null);
              }}
              placeholder="ssh -p 22 root@host"
              className="bg-transparent text-white placeholder-zinc-500 outline-none w-36 sm:w-48 font-mono text-xs"
            />
            <button
              type="submit"
              className="text-zinc-400 hover:text-white p-0.5 ml-1 transition-colors"
              title="Quick Connect"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          <button
            onClick={() => setShowMobileQuickConnect(true)}
            className="sm:hidden p-1.5 text-zinc-300 hover:text-white rounded bg-zinc-900 border border-zinc-800"
            title="Quick Connect"
          >
            <LogIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {quickConnectError && (
        <div className="bg-red-950/70 border-b border-red-500/50 text-red-200 px-3 py-2 text-xs flex items-center justify-between shrink-0 font-mono">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{quickConnectError}</span>
          </div>
          <button onClick={() => setQuickConnectError(null)} className="p-0.5 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {connectionError && (
        <div className="bg-amber-950/60 border-b border-amber-500/50 text-amber-200 px-3 py-2 text-xs flex items-center justify-between shrink-0 font-mono">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{connectionError}</span>
          </div>
          <button onClick={() => setConnectionError(null)} className="p-0.5 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <main className="flex-1 overflow-hidden p-1 sm:p-2.5 md:p-3 bg-black flex flex-col min-h-0 min-w-0">
        {activeTab === 'hosts' && (
          <div className="flex flex-col h-full w-full bg-zinc-950 border border-zinc-800 rounded-none sm:rounded-lg overflow-hidden min-h-0 min-w-0">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-zinc-800 p-2 sm:p-3 bg-zinc-900/60 gap-2 shrink-0 min-w-0 max-w-full">
              <form
                onSubmit={(e) => e.preventDefault()}
                className="flex items-center gap-2 flex-1 min-w-0 max-w-full sm:max-w-md bg-black/60 border border-zinc-800 rounded px-2.5 py-1.5 focus-within:border-zinc-700"
              >
                <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <input
                  type="text"
                  value={hostSearch}
                  onChange={(e) => setHostSearch(e.target.value)}
                  placeholder="Cari host (nama, IP, username)..."
                  className="w-full bg-transparent text-xs text-white placeholder-zinc-500 outline-none font-mono min-w-0"
                />
                {hostSearch && (
                  <button
                    type="button"
                    onClick={() => setHostSearch('')}
                    className="text-zinc-500 hover:text-white p-0.5"
                    title="Hapus pencarian"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </form>

              <button
                type="button"
                onClick={() => setShowAddHostModal(true)}
                className="px-3 py-1.5 bg-white hover:bg-zinc-200 text-black text-xs font-semibold rounded flex items-center justify-center gap-1.5 transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Host</span>
              </button>
            </div>

            <div className="flex-1 overflow-auto min-h-0 min-w-0 max-w-full">
              {filteredHosts.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-xs text-zinc-500 font-mono">
                  No hosts found. Type a command above and click Add Host.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse min-w-full">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 select-none bg-zinc-900/40 font-mono">
                      <th className="py-2.5 px-3">Host</th>
                      <th className="py-2.5 px-3 hidden sm:table-cell">Address</th>
                      <th className="py-2.5 px-3 hidden md:table-cell">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900 font-mono">
                    {filteredHosts.map((h) => {
                      const isProbing = probingHostId === h.id || connectingHostId === h.id;
                      const isOnline = Boolean(h.isLocalWorkspace || h.probeStatus?.reachable);
                      const probe = h.probeStatus;
                      return (
                        <tr
                          key={h.id}
                          className="hover:bg-zinc-900/60 transition-colors group text-zinc-300"
                        >
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 p-1.5 shadow-xs">
                                <DistroIcon host={h} className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                              </div>
                              <div className="min-w-0">
                                <div className="font-sans font-medium text-white truncate max-w-[110px] sm:max-w-[200px] md:max-w-none">
                                  {h.label}
                                </div>
                                <div className="text-[11px] text-zinc-500 truncate sm:hidden max-w-[130px]">
                                  {h.username}@{h.hostname}:{h.port}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-zinc-400 hidden sm:table-cell">
                            {h.username}@{h.hostname}:{h.port}
                          </td>
                          <td className="py-2.5 px-3 hidden md:table-cell">
                            {isProbing ? (
                              <span className="flex items-center gap-1.5 text-amber-300 text-[11px]">
                                <Loader2 className="w-3 h-3 animate-spin" /> Menghubungkan host...
                              </span>
                            ) : isOnline ? (
                              <span className="flex items-center gap-1 text-emerald-400 text-[11px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                                <span>Connected ({probe?.latencyMs ?? 1}ms)</span>
                              </span>
                            ) : probe ? (
                              <span className="flex items-center gap-1 text-zinc-500 text-[11px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 inline-block" />
                                <span>Disconnected</span>
                              </span>
                            ) : (
                              <span className="text-zinc-600 text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleProbeHost(h)}
                                disabled={isProbing}
                                className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
                                title="Sinkronkan status server"
                              >
                                <RefreshCw
                                  className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin' : ''}`}
                                />
                              </button>
                              <button
                                onClick={() => handleStartEditHost(h)}
                                className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
                                title="Edit Host"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleConnectHost(h)}
                                disabled={isProbing}
                                className="px-2.5 py-1 bg-white hover:bg-zinc-200 text-black rounded text-[11px] font-semibold flex items-center gap-1 transition-colors font-sans"
                              >
                                {isProbing ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <TerminalIcon className="w-3 h-3" />
                                )}
                                <span>{isOnline ? 'Open' : 'Connect'}</span>
                              </button>
                              {!h.isLocalWorkspace && (
                                <button
                                  onClick={() => handleDeleteHost(h.id)}
                                  className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-red-400 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'terminal' && (
          <TerminalWorkspace
            hosts={hosts}
            sessions={sessions}
            activeSessionId={activeSessionId}
            snippets={snippets}
            keys={keys}
            onSelectSession={setActiveSessionId}
            onOpenHostSession={handleOpenHostSession}
            onCloseSession={handleCloseSession}
            onExecuteCommand={handleExecuteCommand}
            onClearSession={handleClearSession}
          />
        )}

        {activeTab === 'sftp' && (
          <SftpWorkspace
            hosts={hosts}
            selectedHostId={sftpHostId}
            keys={keys}
            onSelectHost={setSftpHostId}
          />
        )}

        {activeTab === 'keys' && (
          <KeychainWorkspace
            keys={keys}
            onAddKey={(k) => setKeys((prev) => [k, ...prev])}
            onDeleteKey={(id) => setKeys((prev) => prev.filter((k) => k.id !== id))}
          />
        )}

        {activeTab === 'snippets' && (
          <SnippetsWorkspace
            snippets={snippets}
            onAddSnippet={(s) => setSnippets((prev) => [s, ...prev])}
            onDeleteSnippet={(id) => setSnippets((prev) => prev.filter((s) => s.id !== id))}
            onRunSnippet={(command) => {
              handleExecuteCommand(activeSessionId, command);
              setActiveTab('terminal');
            }}
          />
        )}
      </main>

      {showAddHostModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 select-none"
          onClick={() => setShowAddHostModal(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-zinc-300" />
                <span className="text-xs font-semibold text-white">Add New SSH Host</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddHostModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleAddHost} className="p-4 space-y-3 font-mono text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Host Label (Opsional)</label>
                <input
                  type="text"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder="My Ubuntu VPS"
                  className="w-full bg-black border border-zinc-700 rounded px-2.5 py-1.5 text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-zinc-400 mb-1">Hostname / IP *</label>
                  <input
                    type="text"
                    required
                    value={formHostname}
                    onChange={(e) => setFormHostname(e.target.value)}
                    placeholder="192.168.1.1"
                    className="w-full bg-black border border-zinc-700 rounded px-2.5 py-1.5 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Port *</label>
                  <input
                    type="number"
                    required
                    value={formPort}
                    onChange={(e) => setFormPort(Number(e.target.value))}
                    className="w-full bg-black border border-zinc-700 rounded px-2.5 py-1.5 text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded px-2.5 py-1.5 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">OS Distro (Auto-detect / Manual)</label>
                <select
                  value={formDistro}
                  onChange={(e) => setFormDistro(e.target.value as DistroType | 'auto')}
                  className="w-full bg-black border border-zinc-700 rounded px-2.5 py-1.5 text-white outline-none"
                >
                  <option value="auto">Auto-detect (Otomatis dari SSH probe)</option>
                  <option value="ubuntu">Ubuntu</option>
                  <option value="debian">Debian</option>
                  <option value="centos">CentOS</option>
                  <option value="redhat">Red Hat / Alma / Rocky</option>
                  <option value="alpine">Alpine</option>
                  <option value="arch">Arch Linux</option>
                  <option value="fedora">Fedora</option>
                  <option value="kali">Kali Linux</option>
                  <option value="suse">openSUSE</option>
                  <option value="darwin">macOS</option>
                  <option value="windows">Windows</option>
                  <option value="linux">Generic Linux</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Metode Autentikasi</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormAuthMethod('password')}
                    className={`py-1.5 rounded border text-center transition-colors ${
                      formAuthMethod === 'password'
                        ? 'bg-zinc-800 border-zinc-500 text-white font-medium'
                        : 'bg-black border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    Password
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormAuthMethod('key')}
                    className={`py-1.5 rounded border text-center transition-colors ${
                      formAuthMethod === 'key'
                        ? 'bg-zinc-800 border-zinc-500 text-white font-medium'
                        : 'bg-black border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    SSH Key
                  </button>
                </div>
              </div>

              {formAuthMethod === 'password' ? (
                <div>
                  <label className="block text-zinc-400 mb-1">Password</label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Password SSH"
                    className="w-full bg-black border border-zinc-700 rounded px-2.5 py-1.5 text-white outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-zinc-400 mb-1">Pilih SSH Key</label>
                  <select
                    value={formKeyId}
                    onChange={(e) => setFormKeyId(e.target.value)}
                    className="w-full bg-black border border-zinc-700 rounded px-2.5 py-1.5 text-white outline-none"
                  >
                    {keys.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.label} ({k.algorithm})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddHostModal(false)}
                  className="px-3 py-1.5 text-zinc-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-white hover:bg-zinc-200 text-black font-semibold rounded"
                >
                  Simpan Host
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingHost && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 select-none"
          onClick={() => setEditingHost(null)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-zinc-300" />
                <span className="text-xs font-semibold text-white">Edit SSH Host</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingHost(null)}
                className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditHost} className="p-4 space-y-3 font-mono text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Host Label</label>
                <input
                  type="text"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded px-2.5 py-1.5 text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-zinc-400 mb-1">Hostname / IP *</label>
                  <input
                    type="text"
                    required
                    value={formHostname}
                    onChange={(e) => setFormHostname(e.target.value)}
                    className="w-full bg-black border border-zinc-700 rounded px-2.5 py-1.5 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Port *</label>
                  <input
                    type="number"
                    required
                    value={formPort}
                    onChange={(e) => setFormPort(Number(e.target.value))}
                    className="w-full bg-black border border-zinc-700 rounded px-2.5 py-1.5 text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded px-2.5 py-1.5 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">OS Distro (Auto-detect / Manual)</label>
                <select
                  value={formDistro}
                  onChange={(e) => setFormDistro(e.target.value as DistroType | 'auto')}
                  className="w-full bg-black border border-zinc-700 rounded px-2.5 py-1.5 text-white outline-none"
                >
                  <option value="auto">Auto-detect (Otomatis dari SSH probe)</option>
                  <option value="ubuntu">Ubuntu</option>
                  <option value="debian">Debian</option>
                  <option value="centos">CentOS</option>
                  <option value="redhat">Red Hat / Alma / Rocky</option>
                  <option value="alpine">Alpine</option>
                  <option value="arch">Arch Linux</option>
                  <option value="fedora">Fedora</option>
                  <option value="kali">Kali Linux</option>
                  <option value="suse">openSUSE</option>
                  <option value="darwin">macOS</option>
                  <option value="windows">Windows</option>
                  <option value="linux">Generic Linux</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Metode Autentikasi</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormAuthMethod('password')}
                    className={`py-1.5 rounded border text-center transition-colors ${
                      formAuthMethod === 'password'
                        ? 'bg-zinc-800 border-zinc-500 text-white font-medium'
                        : 'bg-black border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    Password
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormAuthMethod('key')}
                    className={`py-1.5 rounded border text-center transition-colors ${
                      formAuthMethod === 'key'
                        ? 'bg-zinc-800 border-zinc-500 text-white font-medium'
                        : 'bg-black border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    SSH Key
                  </button>
                </div>
              </div>

              {formAuthMethod === 'password' ? (
                <div>
                  <label className="block text-zinc-400 mb-1">Password</label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Ganti password"
                    className="w-full bg-black border border-zinc-700 rounded px-2.5 py-1.5 text-white outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-zinc-400 mb-1">Pilih SSH Key</label>
                  <select
                    value={formKeyId}
                    onChange={(e) => setFormKeyId(e.target.value)}
                    className="w-full bg-black border border-zinc-700 rounded px-2.5 py-1.5 text-white outline-none"
                  >
                    {keys.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.label} ({k.algorithm})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingHost(null)}
                  className="px-3 py-1.5 text-zinc-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-white hover:bg-zinc-200 text-black font-semibold rounded"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMobileQuickConnect && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 select-none"
          onClick={() => setShowMobileQuickConnect(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-800 bg-zinc-950">
              <span className="text-xs font-semibold text-white">Quick Connect SSH</span>
              <button
                type="button"
                onClick={() => setShowMobileQuickConnect(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <form onSubmit={handleQuickConnect} className="p-3.5 space-y-3 font-mono text-xs">
              <input
                type="text"
                value={quickConnectInput}
                onChange={(e) => setQuickConnectInput(e.target.value)}
                placeholder="ssh -p 22 root@host"
                className="w-full bg-black border border-zinc-700 rounded p-2 text-white outline-none"
                autoFocus
              />
              <button
                type="submit"
                className="w-full py-2 bg-white text-black font-semibold rounded text-xs"
              >
                Connect Now
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
