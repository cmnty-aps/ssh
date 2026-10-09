import React from 'react';

interface AnsiSpan {
  text: string;
  color?: string;
  bold?: boolean;
}

export function parseAnsiToSpans(input: string): AnsiSpan[] {
  if (!input) return [];

  const colorMap: Record<number, string> = {
    30: 'text-zinc-600',
    31: 'text-red-400',
    32: 'text-emerald-400',
    33: 'text-amber-400',
    34: 'text-blue-400',
    35: 'text-purple-400',
    36: 'text-cyan-400',
    37: 'text-zinc-200',
    90: 'text-zinc-500',
    91: 'text-red-300',
    92: 'text-emerald-300',
    93: 'text-yellow-300',
    94: 'text-blue-300',
    95: 'text-purple-300',
    96: 'text-cyan-300',
    97: 'text-white',
  };

  const regex = /\u001b\[([0-9;]*)m/g;
  const spans: AnsiSpan[] = [];
  let lastIndex = 0;
  let currentColor: string | undefined = undefined;
  let currentBold = false;

  let match;
  while ((match = regex.exec(input)) !== null) {
    const textChunk = input.slice(lastIndex, match.index);
    if (textChunk) {
      spans.push({
        text: textChunk,
        color: currentColor,
        bold: currentBold,
      });
    }

    const codeStr = match[1] || '0';
    const codes = codeStr.split(';').map((s) => parseInt(s, 10) || 0);

    for (const code of codes) {
      if (code === 0) {
        currentColor = undefined;
        currentBold = false;
      } else if (code === 1) {
        currentBold = true;
      } else if (colorMap[code]) {
        currentColor = colorMap[code];
      }
    }

    lastIndex = regex.lastIndex;
  }

  const trailing = input.slice(lastIndex);
  if (trailing) {
    spans.push({
      text: trailing,
      color: currentColor,
      bold: currentBold,
    });
  }

  return spans;
}

export function renderAnsiText(input: string): React.ReactNode {
  const spans = parseAnsiToSpans(input);
  if (spans.length === 0) return null;

  return spans.map((s, idx) => (
    <span
      key={idx}
      className={`${s.color || ''} ${s.bold ? 'font-bold' : ''}`}
    >
      {s.text}
    </span>
  ));
}
