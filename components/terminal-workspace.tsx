'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Terminal as TerminalIcon,
  Plus,
  X,
  CornerDownLeft,
  Loader2,
  Maximize2,
  Minimize2,
  ArrowRight,
} from 'lucide-react';
import {
  SshHost,
  TerminalSession,
  SshSnippet,
  SshKeyItem,
} from '@/lib/ssh-workspace';
import DistroIcon from '@/components/distro-icon';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalWorkspaceProps {
  hosts: SshHost[];
  sessions: TerminalSession[];
  activeSessionId: string;
  snippets: SshSnippet[];
  keys: SshKeyItem[];
  onSelectSession: (id: string) => void;
  onOpenHostSession: (host: SshHost) => void;
  onCloseSession: (id: string) => void;
  onExecuteCommand: (sessionId: string, command: string) => Promise<void>;
  onClearSession: (sessionId: string) => void;
}

export default function TerminalWorkspace({
  hosts,
  sessions,
  activeSessionId,
  onSelectSession,
  onOpenHostSession,
  onCloseSession,
  onExecuteCommand,
  onClearSession,
}: TerminalWorkspaceProps) {
  const [inputVal, setInputVal] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showHostPicker, setShowHostPicker] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [ctrlSticky, setCtrlSticky] = useState(false);
  const [altSticky, setAltSticky] = useState(false);

  const terminalContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const termInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastRenderedLineCountRef = useRef<Record<string, number>>({});

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const activeHost = hosts.find((h) => h.id === activeSession?.hostId) || hosts[0];

  const formatCwdDisplay = useCallback((fullCwd: string) => {
    if (!fullCwd) return '~';
    const home = '/root';
    if (fullCwd === home) return '~';
    if (fullCwd.startsWith(home + '/')) return '~' + fullCwd.slice(home.length);
    return fullCwd;
  }, []);

  const sendTerminalLine = useCallback(
    (term: Terminal, lineText: string, type: string, cwd?: string) => {
      if (type === 'system') {
        term.writeln(`\x1b[90m[${new Date().toTimeString().slice(0, 8)}] ${lineText}\x1b[0m`);
        return;
      }
      if (type === 'input') {
        const isRoot = (activeHost?.username || 'root') === 'root';
        const displayCwd = formatCwdDisplay(cwd || activeSession?.cwd || '~');
        const promptSymbol = isRoot ? '#' : '$';
        term.writeln(
          `\x1b[32m${activeHost?.username || 'root'}@${activeHost?.hostname || 'localhost'}\x1b[0m:\x1b[34m${displayCwd}\x1b[0m${promptSymbol} \x1b[1m\x1b[37m${lineText}\x1b[0m`
        );
        return;
      }
      if (type === 'error') {
        const formatted = lineText.replace(/\r?\n/g, '\r\n');
        term.writeln(`\x1b[31m${formatted}\x1b[0m`);
        return;
      }
      const formatted = lineText.replace(/\r?\n/g, '\r\n');
      term.writeln(formatted);
    },
    [activeHost, activeSession, formatCwdDisplay]
  );

  useEffect(() => {
    if (!terminalContainerRef.current) return;

    if (!termInstanceRef.current) {
      const term = new Terminal({
        cursorBlink: true,
        fontSize: 12,
        lineHeight: 1.25,
        fontFamily:
          'var(--font-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        theme: {
          background: '#000000',
          foreground: '#f4f4f5',
          cursor: '#ffffff',
          cursorAccent: '#000000',
          selectionBackground: '#3f3f46',
          black: '#18181b',
          red: '#ef4444',
          green: '#22c55e',
          yellow: '#eab308',
          blue: '#3b82f6',
          magenta: '#ec4899',
          cyan: '#06b6d4',
          white: '#ffffff',
          brightBlack: '#71717a',
          brightRed: '#f87171',
          brightGreen: '#4ade80',
          brightYellow: '#facc15',
          brightBlue: '#60a5fa',
          brightMagenta: '#f472b6',
          brightCyan: '#22d3ee',
          brightWhite: '#ffffff',
        },
        convertEol: true,
        allowTransparency: false,
        disableStdin: false,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      term.open(terminalContainerRef.current);
      fitAddon.fit();

      termInstanceRef.current = term;
      fitAddonRef.current = fitAddon;
    }

    const term = termInstanceRef.current;
    const fitAddon = fitAddonRef.current;

    term.clear();
    lastRenderedLineCountRef.current[activeSessionId] = 0;

    if (activeSession) {
      if (activeSession.lines.length === 0) {
        const isRoot = (activeHost?.username || 'root') === 'root';
        const displayCwd = formatCwdDisplay(activeSession.cwd || '~');
        term.writeln(
          `\x1b[90mConnected to ${activeHost?.username || 'root'}@${activeHost?.hostname || 'localhost'}:${activeHost?.port || 22}\x1b[0m`
        );
        term.writeln(
          `\x1b[32m${activeHost?.username || 'root'}@${activeHost?.hostname || 'localhost'}\x1b[0m:\x1b[34m${displayCwd}\x1b[0m${isRoot ? '#' : '$'} `
        );
      } else {
        activeSession.lines.forEach((l) => {
          sendTerminalLine(term, l.text, l.type, l.cwd);
        });
        lastRenderedLineCountRef.current[activeSessionId] = activeSession.lines.length;
      }
    }

    const handleResize = () => {
      try {
        fitAddon?.fit();
      } catch {}
    };

    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [activeSessionId, activeHost, activeSession, formatCwdDisplay, sendTerminalLine]);

  useEffect(() => {
    const term = termInstanceRef.current;
    if (!term || !activeSession) return;

    const lastCount = lastRenderedLineCountRef.current[activeSessionId] || 0;
    const currentLines = activeSession.lines;

    if (currentLines.length < lastCount) {
      term.clear();
      currentLines.forEach((l) => {
        sendTerminalLine(term, l.text, l.type, l.cwd);
      });
      lastRenderedLineCountRef.current[activeSessionId] = currentLines.length;
      return;
    }

    if (currentLines.length > lastCount) {
      for (let i = lastCount; i < currentLines.length; i++) {
        const l = currentLines[i];
        sendTerminalLine(term, l.text, l.type, l.cwd);
      }
      lastRenderedLineCountRef.current[activeSessionId] = currentLines.length;
    }
  }, [activeSession?.lines, activeSessionId, activeSession, sendTerminalLine]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        fitAddonRef.current?.fit();
      } catch {}
    }, 150);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeSessionId]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeSession || isExecuting) return;

    const cmd = inputVal.trim();
    setInputVal('');
    setHistoryIndex(-1);

    if (!cmd) return;

    setIsExecuting(true);
    try {
      await onExecuteCommand(activeSession.id, cmd);
    } finally {
      setIsExecuting(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const executeControlAction = (combo: string) => {
    if (!activeSession) return;
    const term = termInstanceRef.current;

    switch (combo.toLowerCase()) {
      case 'c':
        setCtrlSticky(false);
        setInputVal('');
        term?.writeln('^C');
        onExecuteCommand(activeSession.id, '^C');
        break;
      case 'z':
        setCtrlSticky(false);
        setInputVal('');
        term?.writeln('^Z');
        onExecuteCommand(activeSession.id, '^Z');
        break;
      case 'd':
        setCtrlSticky(false);
        if (!inputVal) {
          onCloseSession(activeSession.id);
        } else {
          setInputVal('');
        }
        break;
      case 'l':
        setCtrlSticky(false);
        term?.clear();
        onClearSession(activeSession.id);
        break;
      case 'a':
        setCtrlSticky(false);
        if (inputRef.current) {
          inputRef.current.setSelectionRange(0, 0);
          inputRef.current.focus();
        }
        break;
      case 'e':
        setCtrlSticky(false);
        if (inputRef.current) {
          const len = inputVal.length;
          inputRef.current.setSelectionRange(len, len);
          inputRef.current.focus();
        }
        break;
      case 'u':
        setCtrlSticky(false);
        setInputVal('');
        break;
      case 'k':
        setCtrlSticky(false);
        if (inputRef.current) {
          const pos = inputRef.current.selectionStart ?? 0;
          setInputVal(inputVal.slice(0, pos));
        }
        break;
      case 'w':
        setCtrlSticky(false);
        if (inputRef.current) {
          const pos = inputRef.current.selectionStart ?? inputVal.length;
          const before = inputVal.slice(0, pos);
          const after = inputVal.slice(pos);
          const trimmedBefore = before.trimEnd();
          const lastSpace = trimmedBefore.lastIndexOf(' ');
          const newBefore = lastSpace === -1 ? '' : trimmedBefore.slice(0, lastSpace + 1);
          setInputVal(newBefore + after);
        }
        break;
      case 'x':
        setCtrlSticky(false);
        term?.writeln('^X');
        onExecuteCommand(activeSession.id, '^X');
        break;
      case 'o':
        setCtrlSticky(false);
        term?.writeln('^O');
        onExecuteCommand(activeSession.id, '^O');
        break;
      default:
        setCtrlSticky(false);
        term?.writeln(`^${combo.toUpperCase()}`);
        onExecuteCommand(activeSession.id, `^${combo.toUpperCase()}`);
        break;
    }
  };

  const handleShellKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!activeSession) return;
    const isCtrl = e.ctrlKey || ctrlSticky;
    const isAlt = e.altKey || altSticky;

    if (isCtrl) {
      const key = e.key.toLowerCase();
      if (/^[a-z0-9]$/.test(key) || key === '[' || key === ']' || key === '\\') {
        e.preventDefault();
        executeControlAction(key);
        return;
      }
    }

    if (isAlt) {
      setAltSticky(false);
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const hist = activeSession.history;
      if (hist.length === 0) return;
      const nextIndex = historyIndex === -1 ? hist.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInputVal(hist[nextIndex] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const hist = activeSession.history;
      if (historyIndex === -1) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= hist.length) {
        setHistoryIndex(-1);
        setInputVal('');
      } else {
        setHistoryIndex(nextIndex);
        setInputVal(hist[nextIndex]);
      }
    }
  };

  const handleKeyEsc = () => {
    setInputVal('');
  };

  const handleKeyTab = () => {
    setInputVal((prev) => prev + '\t');
    setTimeout(() => inputRef.current?.focus(), 20);
  };

  const handleKeyArrowLeft = () => {
    if (inputRef.current) {
      const pos = inputRef.current.selectionStart ?? 0;
      const newPos = Math.max(0, pos - 1);
      inputRef.current.setSelectionRange(newPos, newPos);
      inputRef.current.focus();
    }
  };

  const handleKeyArrowRight = () => {
    if (inputRef.current) {
      const pos = inputRef.current.selectionStart ?? 0;
      const newPos = Math.min(inputVal.length, pos + 1);
      inputRef.current.setSelectionRange(newPos, newPos);
      inputRef.current.focus();
    }
  };

  const handleKeyArrowUp = () => {
    if (activeSession) {
      const hist = activeSession.history;
      if (hist.length === 0) return;
      const nextIndex = historyIndex === -1 ? hist.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInputVal(hist[nextIndex] || '');
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  };

  const handleKeyArrowDown = () => {
    if (activeSession && historyIndex !== -1) {
      const hist = activeSession.history;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= hist.length) {
        setHistoryIndex(-1);
        setInputVal('');
      } else {
        setHistoryIndex(nextIndex);
        setInputVal(hist[nextIndex]);
      }
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  };

  const ctrlBtn =
    'h-6 px-2 rounded text-[10px] sm:text-[11px] font-mono font-medium shrink-0 inline-flex items-center justify-center transition-all border touch-manipulation select-none active:scale-95 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border-zinc-800';
  const ctrlBtnActive =
    'h-6 px-2 rounded text-[10px] sm:text-[11px] font-mono font-bold shrink-0 inline-flex items-center justify-center transition-all border touch-manipulation select-none active:scale-95 bg-white text-black border-white shadow-xs';
  const ctrlBtnDisabled =
    'h-6 px-2 rounded text-[10px] sm:text-[11px] font-mono font-medium shrink-0 inline-flex items-center justify-center transition-all border select-none opacity-30 cursor-not-allowed bg-zinc-950 text-zinc-600 border-zinc-900';

  return (
    <div
      className={`flex flex-col bg-black text-zinc-100 overflow-hidden font-mono text-[11px] ${
        isFullscreen
          ? 'fixed inset-0 z-50 w-full h-[100dvh] rounded-none border-0'
          : 'h-full w-full border border-zinc-800 rounded-none sm:rounded-lg shadow-2xl min-h-0 min-w-0'
      }`}
    >
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-2 py-1.5 overflow-x-auto scrollbar-none gap-1.5 select-none shrink-0 min-w-0">
        <div className="flex items-center gap-1.5 overflow-x-auto min-w-0">
          {sessions.map((s) => {
            const isCurrent = s.id === activeSession?.id;
            const sessionHost = hosts.find((h) => h.id === s.hostId) || activeHost;
            return (
              <div
                key={s.id}
                onClick={() => onSelectSession(s.id)}
                className={`flex items-center gap-2 px-2.5 py-1 rounded text-xs cursor-pointer border transition-colors whitespace-nowrap shrink-0 ${
                  isCurrent
                    ? 'bg-zinc-900 border-zinc-700 text-white font-medium'
                    : 'bg-transparent border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                }`}
              >
                <DistroIcon host={sessionHost} className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-[90px] sm:max-w-[170px]">{s.title}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseSession(s.id);
                  }}
                  className="p-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0 ml-0.5"
                  title="Close Tab"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setShowHostPicker(true)}
            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded border border-transparent hover:border-zinc-800 transition-colors shrink-0"
            title="New Terminal Session"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded transition-colors text-xs flex items-center justify-center border border-zinc-800"
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {showHostPicker && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 select-none"
          onClick={() => setShowHostPicker(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-800 bg-zinc-950">
              <div className="flex items-center gap-2">
                <TerminalIcon className="w-4 h-4 text-zinc-300" />
                <span className="text-xs font-semibold text-white">Select Host for New Session</span>
              </div>
              <button
                type="button"
                onClick={() => setShowHostPicker(false)}
                className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-2 space-y-1 max-h-72 overflow-y-auto">
              {hosts.map((h) => {
                const isConnected = Boolean(h.isLocalWorkspace || h.probeStatus?.reachable);
                return (
                  <button
                    key={h.id}
                    disabled={!isConnected}
                    onClick={() => {
                      if (!isConnected) return;
                      onOpenHostSession(h);
                      setShowHostPicker(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs rounded flex items-center justify-between transition-colors ${
                      isConnected
                        ? 'hover:bg-zinc-800 cursor-pointer'
                        : 'opacity-50 cursor-not-allowed bg-zinc-950/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 p-1">
                        <DistroIcon host={h} className="w-4 h-4 shrink-0" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-sans font-medium text-white truncate">{h.label}</div>
                        <div className="text-[11px] text-zinc-500 font-mono truncate">
                          {h.username}@{h.hostname}:{h.port}
                        </div>
                      </div>
                    </div>
                    {isConnected ? (
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-500 shrink-0 ml-2" />
                    ) : (
                      <span className="text-[10px] text-zinc-500 font-mono shrink-0 ml-2">Offline</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div
        ref={terminalContainerRef}
        onClick={() => inputRef.current?.focus()}
        className="flex-1 w-full min-h-0 min-w-0 bg-black p-2 overflow-hidden select-text cursor-text"
      />

      <div className="border-t border-zinc-800 bg-zinc-950 px-2 py-1.5 flex items-center gap-1 overflow-x-auto scrollbar-none select-none shrink-0 w-full">
        <button type="button" onClick={handleKeyEsc} className={ctrlBtn} title="Escape">
          ESC
        </button>

        <button type="button" onClick={handleKeyTab} className={ctrlBtn} title="Tab / Autocomplete">
          TAB
        </button>

        <button
          type="button"
          onClick={() => setCtrlSticky(!ctrlSticky)}
          className={ctrlSticky ? ctrlBtnActive : ctrlBtn}
          title="Sticky Ctrl modifier (Termux)"
        >
          CTRL
        </button>

        <button
          type="button"
          onClick={() => setAltSticky(!altSticky)}
          className={altSticky ? ctrlBtnActive : ctrlBtn}
          title="Sticky Alt modifier (Termux)"
        >
          ALT
        </button>

        <button
          type="button"
          onClick={() => executeControlAction('c')}
          className={ctrlBtn}
          title="Ctrl+C: Interrupt Process"
        >
          ^C
        </button>

        <button
          type="button"
          onClick={() => executeControlAction('l')}
          className={ctrlBtn}
          title="Ctrl+L: Clear Screen"
        >
          ^L
        </button>

        <button
          type="button"
          onClick={() => executeControlAction('d')}
          className={ctrlBtn}
          title="Ctrl+D: EOF / Exit"
        >
          ^D
        </button>

        <button
          type="button"
          onClick={() => executeControlAction('z')}
          className={ctrlBtn}
          title="Ctrl+Z: Suspend / Stop Job"
        >
          ^Z
        </button>

        <button
          type="button"
          onClick={() => executeControlAction('x')}
          className={ctrlBtn}
          title="Ctrl+X: Exit Nano"
        >
          ^X
        </button>

        <button
          type="button"
          onClick={() => executeControlAction('o')}
          className={ctrlBtn}
          title="Ctrl+O: WriteOut Nano"
        >
          ^O
        </button>

        <button
          type="button"
          onClick={() => executeControlAction('a')}
          className={ctrlBtn}
          title="Ctrl+A: Jump to Start"
        >
          ^A
        </button>

        <button
          type="button"
          onClick={() => executeControlAction('e')}
          className={ctrlBtn}
          title="Ctrl+E: Jump to End"
        >
          ^E
        </button>

        <button
          type="button"
          onClick={() => executeControlAction('u')}
          className={ctrlBtn}
          title="Ctrl+U: Cut Line"
        >
          ^U
        </button>

        <button
          type="button"
          onClick={() => executeControlAction('w')}
          className={ctrlBtn}
          title="Ctrl+W: Erase Word"
        >
          ^W
        </button>

        <button
          type="button"
          onClick={() => executeControlAction('k')}
          className={ctrlBtn}
          title="Ctrl+K: Kill to End"
        >
          ^K
        </button>

        <button type="button" onClick={handleKeyArrowLeft} className={ctrlBtn} title="Cursor Left">
          ◀
        </button>

        <button type="button" onClick={handleKeyArrowUp} className={ctrlBtn} title="History Up">
          ▲
        </button>

        <button type="button" onClick={handleKeyArrowDown} className={ctrlBtn} title="History Down">
          ▼
        </button>

        <button type="button" onClick={handleKeyArrowRight} className={ctrlBtn} title="Cursor Right">
          ▶
        </button>

        <button
          type="button"
          onClick={() => {
            if (activeSession) {
              termInstanceRef.current?.clear();
              onClearSession(activeSession.id);
            }
          }}
          className={ctrlBtn}
          title="clear"
        >
          clear
        </button>

        <button
          type="button"
          disabled={isExecuting || !activeSession}
          onClick={() => {
            if (activeSession) onExecuteCommand(activeSession.id, 'ls -la --color=auto');
          }}
          className={isExecuting || !activeSession ? ctrlBtnDisabled : ctrlBtn}
          title="ls -la"
        >
          ls
        </button>

        <button
          type="button"
          disabled={isExecuting || !activeSession}
          onClick={() => {
            if (activeSession) onExecuteCommand(activeSession.id, 'pwd');
          }}
          className={isExecuting || !activeSession ? ctrlBtnDisabled : ctrlBtn}
          title="pwd"
        >
          pwd
        </button>

        <button
          type="button"
          disabled={isExecuting || !activeSession}
          onClick={() => {
            if (activeSession) onExecuteCommand(activeSession.id, 'top');
          }}
          className={isExecuting || !activeSession ? ctrlBtnDisabled : ctrlBtn}
          title="top"
        >
          top
        </button>
      </div>

      {activeSession && (
        <form
          onSubmit={handleSubmit}
          className="border-t border-zinc-800 bg-zinc-950 px-2.5 sm:px-3 py-2 flex items-center gap-2 shrink-0 w-full"
        >
          <div className="text-xs text-zinc-400 shrink-0 select-none flex items-center gap-1 font-mono">
            <span className="text-zinc-200 font-mono truncate max-w-[80px] sm:max-w-none">
              {activeHost?.username || 'root'}@{activeHost?.hostname || 'localhost'}
            </span>
            <span className="text-zinc-500">:</span>
            <span className="text-zinc-300 font-mono truncate max-w-[60px] sm:max-w-none">
              {formatCwdDisplay(activeSession.cwd)}
            </span>
            <span className="text-zinc-200 font-bold ml-0.5">
              {(activeHost?.username || 'root') === 'root' ? '#' : '$'}
            </span>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleShellKeyDown}
            disabled={isExecuting}
            placeholder={
              isExecuting
                ? 'Running command...'
                : ctrlSticky
                ? 'CTRL active: tekan Z, C, D, L dll'
                : 'Ketik perintah shell (apt, nano, git, ls, htop)...'
            }
            className={`flex-1 min-w-0 bg-transparent text-white text-xs outline-none focus:ring-0 placeholder-zinc-500 font-mono ${
              ctrlSticky ? 'ring-1 ring-white/40 rounded px-1' : ''
            }`}
            autoFocus
          />

          <button
            type="submit"
            disabled={isExecuting || !inputVal.trim()}
            className="text-zinc-400 hover:text-white disabled:opacity-30 p-1 shrink-0 transition-colors"
            title="Execute (Enter)"
          >
            {isExecuting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CornerDownLeft className="w-3.5 h-3.5" />
            )}
          </button>
        </form>
      )}
    </div>
  );
}
