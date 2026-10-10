'use client';

import React, { useState, useRef, useEffect } from 'react';
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
import SyntaxHighlighter from '@/components/syntax-highlighter';
import { renderAnsiText } from '@/lib/ansi';

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

  // Termux Sticky Modifiers
  const [ctrlSticky, setCtrlSticky] = useState(false);
  const [altSticky, setAltSticky] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const activeHost = hosts.find((h) => h.id === activeSession?.hostId) || hosts[0];

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [activeSession?.lines]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeSessionId]);

  // Submit command in shell
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

  const handleShellKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!activeSession) return;
    const isCtrl = e.ctrlKey || ctrlSticky;

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
    } else if (isCtrl && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      setCtrlSticky(false);
      onClearSession(activeSession.id);
    } else if (isCtrl && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      setCtrlSticky(false);
      setInputVal('');
    } else if (isCtrl && e.key.toLowerCase() === 'u') {
      e.preventDefault();
      setCtrlSticky(false);
      setInputVal('');
    } else if (isCtrl && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      setCtrlSticky(false);
      inputRef.current?.setSelectionRange(0, 0);
    } else if (isCtrl && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      setCtrlSticky(false);
      const len = inputVal.length;
      inputRef.current?.setSelectionRange(len, len);
    } else if (isCtrl && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      setCtrlSticky(false);
      const pos = inputRef.current?.selectionStart ?? 0;
      setInputVal(inputVal.slice(0, pos));
    } else if (isCtrl && e.key.toLowerCase() === 'w') {
      e.preventDefault();
      setCtrlSticky(false);
      const pos = inputRef.current?.selectionStart ?? inputVal.length;
      const before = inputVal.slice(0, pos);
      const after = inputVal.slice(pos);
      const trimmedBefore = before.trimEnd();
      const lastSpace = trimmedBefore.lastIndexOf(' ');
      const newBefore = lastSpace === -1 ? '' : trimmedBefore.slice(0, lastSpace + 1);
      setInputVal(newBefore + after);
    }
  };

  // Quick Key Handlers
  const handleKeyEsc = () => {
    setInputVal('');
  };

  const handleKeyTab = () => {
    setInputVal((prev) => prev + '\t');
    setTimeout(() => inputRef.current?.focus(), 20);
  };

  const handleKeyCtrlC = () => {
    setCtrlSticky(false);
    setInputVal('');
    if (activeSession) {
      onExecuteCommand(activeSession.id, '^C');
    }
  };

  const handleKeyCtrlD = () => {
    setCtrlSticky(false);
    if (activeSession) {
      if (!inputVal) {
        onCloseSession(activeSession.id);
      } else {
        setInputVal('');
      }
    }
  };

  const handleKeyCtrlL = () => {
    setCtrlSticky(false);
    if (activeSession) {
      onClearSession(activeSession.id);
    }
  };

  const handleKeyCtrlZ = () => {
    setCtrlSticky(false);
    if (activeSession) {
      onExecuteCommand(activeSession.id, '^Z');
      setInputVal('');
    }
  };

  const handleKeyCtrlA = () => {
    setCtrlSticky(false);
    if (inputRef.current) {
      inputRef.current.setSelectionRange(0, 0);
      inputRef.current.focus();
    }
  };

  const handleKeyCtrlE = () => {
    setCtrlSticky(false);
    if (inputRef.current) {
      const len = inputVal.length;
      inputRef.current.setSelectionRange(len, len);
      inputRef.current.focus();
    }
  };

  const handleKeyCtrlU = () => {
    setCtrlSticky(false);
    if (inputRef.current) {
      const pos = inputRef.current.selectionStart ?? inputVal.length;
      const after = inputVal.slice(pos);
      setInputVal(after);
      setTimeout(() => {
        inputRef.current?.setSelectionRange(0, 0);
        inputRef.current?.focus();
      }, 10);
    }
  };

  const handleKeyCtrlW = () => {
    setCtrlSticky(false);
    if (inputRef.current) {
      const pos = inputRef.current.selectionStart ?? inputVal.length;
      const before = inputVal.slice(0, pos);
      const after = inputVal.slice(pos);
      const trimmedBefore = before.trimEnd();
      const lastSpace = trimmedBefore.lastIndexOf(' ');
      const newBefore = lastSpace === -1 ? '' : trimmedBefore.slice(0, lastSpace + 1);
      setInputVal(newBefore + after);
      setTimeout(() => {
        inputRef.current?.setSelectionRange(newBefore.length, newBefore.length);
        inputRef.current?.focus();
      }, 10);
    }
  };

  const handleKeyCtrlK = () => {
    setCtrlSticky(false);
    if (inputRef.current) {
      const pos = inputRef.current.selectionStart ?? 0;
      setInputVal(inputVal.slice(0, pos));
      setTimeout(() => {
        inputRef.current?.setSelectionRange(pos, pos);
        inputRef.current?.focus();
      }, 10);
    }
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

  const formatCwdDisplay = (fullCwd: string) => {
    if (!fullCwd) return '~';
    const home = process.env.HOME || '/root';
    if (fullCwd === home) return '~';
    if (fullCwd.startsWith(home + '/')) return '~' + fullCwd.slice(home.length);
    return fullCwd;
  };

  const ctrlBtn =
    'h-5 sm:h-5.5 px-1.5 rounded text-[9px] sm:text-[10px] font-mono font-medium shrink-0 inline-flex items-center justify-center transition-all border touch-manipulation select-none active:scale-95 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border-zinc-800';
  const ctrlBtnActive =
    'h-5 sm:h-5.5 px-1.5 rounded text-[9px] sm:text-[10px] font-mono font-bold shrink-0 inline-flex items-center justify-center transition-all border touch-manipulation select-none active:scale-95 bg-white text-black border-white';
  const ctrlBtnDisabled =
    'h-5 sm:h-5.5 px-1.5 rounded text-[9px] sm:text-[10px] font-mono font-medium shrink-0 inline-flex items-center justify-center transition-all border select-none opacity-30 cursor-not-allowed bg-zinc-950 text-zinc-600 border-zinc-900';

  return (
    <div
      className={`flex flex-col bg-black text-zinc-100 overflow-hidden font-mono text-[10px] sm:text-[11.5px] ${
        isFullscreen
          ? 'fixed inset-0 z-50 w-screen h-screen rounded-none border-0'
          : 'h-full w-full border border-zinc-800 rounded-none sm:rounded-lg shadow-2xl min-h-0 min-w-0'
      }`}
    >
      {/* Session Tab Bar with Real Distro Icons & Full Screen Button ONLY */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-2 py-1 overflow-x-auto scrollbar-none gap-1.5 select-none shrink-0 min-w-0">
        <div className="flex items-center gap-1 overflow-x-auto min-w-0">
          {sessions.map((s) => {
            const isCurrent = s.id === activeSession?.id;
            const sessionHost = hosts.find((h) => h.id === s.hostId) || activeHost;
            return (
              <div
                key={s.id}
                onClick={() => onSelectSession(s.id)}
                className={`group flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] cursor-pointer border transition-colors whitespace-nowrap shrink-0 ${
                  isCurrent
                    ? 'bg-zinc-900 border-zinc-700 text-white font-medium'
                    : 'bg-transparent border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                }`}
              >
                {/* Authentic Distro Icon replacing green dot */}
                <DistroIcon host={sessionHost} className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-[90px] sm:max-w-[160px]">{s.title}</span>
                {sessions.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseSession(s.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition-opacity"
                    title="Close Tab"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          <button
            onClick={() => setShowHostPicker(true)}
            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded border border-transparent hover:border-zinc-800 transition-colors shrink-0"
            title="New Terminal Session"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Action Controls: Full Screen button ONLY */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded transition-colors text-[11px] flex items-center justify-center border border-zinc-800/80"
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3 h-3" />
            ) : (
              <Maximize2 className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>

      {/* Host Picker Modal */}
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
                onClick={() => setShowHostPicker(false)}
                className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-2 space-y-1 max-h-72 overflow-y-auto">
              {hosts.map((h) => (
                <button
                  key={h.id}
                  onClick={() => {
                    onOpenHostSession(h);
                    setShowHostPicker(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs rounded hover:bg-zinc-800 flex items-center justify-between transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 p-1">
                      <DistroIcon host={h} className="w-4.5 h-4.5 shrink-0" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-sans font-medium text-white truncate">{h.label}</div>
                      <div className="text-[11px] text-zinc-500 font-mono truncate">
                        {h.username}@{h.hostname}:{h.port}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Terminal Shell Viewport */}
      <div
        ref={scrollContainerRef}
        onClick={() => inputRef.current?.focus()}
        className="flex-1 p-2 sm:p-2.5 overflow-y-auto overflow-x-hidden space-y-1 select-text cursor-text min-h-0 min-w-0 max-w-full bg-black font-mono text-[10px] sm:text-[11.5px] leading-[17px] tracking-tight"
      >
        {activeSession ? (
          <>
            {activeSession.lines.map((line) => {
              if (line.type === 'system') {
                return (
                  <div key={line.id} className="text-zinc-400 text-[9.5px] sm:text-[10.5px] py-0.5 leading-snug break-words font-mono">
                    <span className="text-zinc-500 mr-1.5 select-none">[{line.timestamp}]</span>
                    {line.text}
                  </div>
                );
              }

              if (line.type === 'input') {
                const isRoot = (activeHost?.username || 'root') === 'root';
                return (
                  <div key={line.id} className="flex items-start gap-1 sm:gap-1.5 text-[10px] sm:text-[11.5px] pt-1 leading-snug break-words font-mono">
                    <span className="text-zinc-400 select-none shrink-0 font-medium">
                      {activeHost?.username || 'root'}@{activeHost?.hostname || 'localhost'}:
                      <span className="text-zinc-300">{formatCwdDisplay(line.cwd || activeSession.cwd)}</span>
                      <span className="text-zinc-300 font-bold ml-0.5">{isRoot ? '#' : '$'}</span>
                    </span>
                    <span className="text-white font-medium flex-1 overflow-x-auto min-w-0">
                      <SyntaxHighlighter code={line.text} language="bash" className="text-[10px] sm:text-[11.5px]" />
                    </span>
                  </div>
                );
              }

              if (line.type === 'error') {
                return (
                  <div
                    key={line.id}
                    className="text-red-400 text-[10px] sm:text-[11.5px] bg-red-950/20 border-l border-red-500/50 pl-2 py-0.5 my-0.5 whitespace-pre-wrap break-all font-mono leading-snug"
                  >
                    {renderAnsiText(line.text) || line.text}
                  </div>
                );
              }

              return (
                <div
                  key={line.id}
                  className="text-zinc-200 text-[10px] sm:text-[11.5px] whitespace-pre-wrap break-all leading-snug font-mono"
                >
                  {renderAnsiText(line.text) || line.text}
                </div>
              );
            })}

            {isExecuting && (
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-zinc-400 py-1 font-mono">
                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                <span>Executing...</span>
              </div>
            )}
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-500 text-[10px] font-mono">
            No active terminal session. Click + to launch.
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Toolbar */}
      <div className="border-t border-zinc-800 bg-zinc-950 px-2 py-1 flex items-center gap-1 overflow-x-auto scrollbar-none select-none shrink-0 max-w-full">
        <button
          type="button"
          onClick={handleKeyEsc}
          className={ctrlBtn}
          title="Escape"
        >
          ESC
        </button>

        <button
          type="button"
          onClick={handleKeyTab}
          className={ctrlBtn}
          title="Tab / Autocomplete"
        >
          TAB
        </button>

        <button
          type="button"
          onClick={() => setCtrlSticky(!ctrlSticky)}
          className={ctrlSticky ? ctrlBtnActive : ctrlBtn}
          title="Sticky Ctrl modifier"
        >
          CTRL
        </button>

        <button
          type="button"
          onClick={() => setAltSticky(!altSticky)}
          className={altSticky ? ctrlBtnActive : ctrlBtn}
          title="Sticky Alt modifier"
        >
          ALT
        </button>

        <button
          type="button"
          onClick={handleKeyCtrlC}
          className={ctrlBtn}
          title="Ctrl+C: Interrupt Process"
        >
          ^C
        </button>

        <button
          type="button"
          onClick={handleKeyCtrlL}
          className={ctrlBtn}
          title="Ctrl+L: Clear Screen"
        >
          ^L
        </button>

        <button
          type="button"
          onClick={handleKeyCtrlD}
          className={ctrlBtn}
          title="Ctrl+D: EOF / Exit"
        >
          ^D
        </button>

        <button
          type="button"
          onClick={handleKeyCtrlZ}
          className={ctrlBtn}
          title="Ctrl+Z: Suspend"
        >
          ^Z
        </button>

        <button
          type="button"
          onClick={handleKeyCtrlA}
          className={ctrlBtn}
          title="Ctrl+A: Jump to Beginning of Line"
        >
          ^A
        </button>

        <button
          type="button"
          onClick={handleKeyCtrlE}
          className={ctrlBtn}
          title="Ctrl+E: Jump to End of Line"
        >
          ^E
        </button>

        <button
          type="button"
          onClick={handleKeyCtrlU}
          className={ctrlBtn}
          title="Ctrl+U: Cut from Cursor to Start"
        >
          ^U
        </button>

        <button
          type="button"
          onClick={handleKeyCtrlW}
          className={ctrlBtn}
          title="Ctrl+W: Erase Preceding Word"
        >
          ^W
        </button>

        <button
          type="button"
          onClick={handleKeyCtrlK}
          className={ctrlBtn}
          title="Ctrl+K: Kill Line"
        >
          ^K
        </button>

        {/* Navigation Arrows */}
        <button
          type="button"
          onClick={handleKeyArrowLeft}
          className={ctrlBtn}
          title="Cursor Left"
        >
          ◀
        </button>

        <button
          type="button"
          onClick={handleKeyArrowUp}
          className={ctrlBtn}
          title="History Up"
        >
          ▲
        </button>

        <button
          type="button"
          onClick={handleKeyArrowDown}
          className={ctrlBtn}
          title="History Down"
        >
          ▼
        </button>

        <button
          type="button"
          onClick={handleKeyArrowRight}
          className={ctrlBtn}
          title="Cursor Right"
        >
          ▶
        </button>

        {/* Quick Commands */}
        <button
          type="button"
          onClick={() => {
            if (activeSession) onClearSession(activeSession.id);
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
            if (activeSession) onExecuteCommand(activeSession.id, 'ls -la');
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
            if (activeSession) onExecuteCommand(activeSession.id, 'ps aux | head -n 10');
          }}
          className={isExecuting || !activeSession ? ctrlBtnDisabled : ctrlBtn}
          title="ps / top"
        >
          top
        </button>
      </div>

      {/* Input Prompt */}
      {activeSession && (
        <form
          onSubmit={handleSubmit}
          className="border-t border-zinc-800 bg-zinc-950 px-2 sm:px-3 py-1.5 flex items-center gap-1.5 shrink-0 min-w-0 max-w-full"
        >
          <div className="text-[10px] sm:text-[11.5px] text-zinc-400 shrink-0 select-none flex items-center gap-1 font-mono">
            <span className="text-zinc-300 font-mono truncate max-w-[70px] sm:max-w-none">
              {activeHost?.username || 'root'}@{activeHost?.hostname || 'localhost'}
            </span>
            <span className="text-zinc-500">:</span>
            <span className="text-zinc-400 font-mono truncate max-w-[50px] sm:max-w-none">
              {formatCwdDisplay(activeSession.cwd)}
            </span>
            <span className="text-zinc-300 font-bold ml-0.5">
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
            placeholder={isExecuting ? 'Running command...' : 'Type command (e.g. apt, npm, git, python3, ls)...'}
            className="flex-1 min-w-0 bg-transparent text-white text-[10px] sm:text-[11.5px] outline-none focus:ring-0 placeholder-zinc-600 font-mono"
            autoFocus
          />

          <button
            type="submit"
            disabled={isExecuting || !inputVal.trim()}
            className="text-zinc-400 hover:text-white disabled:opacity-30 p-1 shrink-0 transition-colors"
            title="Execute (Enter)"
          >
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </form>
      )}
    </div>
  );
}
