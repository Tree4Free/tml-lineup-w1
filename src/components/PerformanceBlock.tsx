import type { CSSProperties } from 'react';
import type { Performance } from '../types';
import { formatMinutes } from '../lib/time';

interface Props {
  perf: Performance;
  style: CSSProperties;
  selected: boolean;
  clash: boolean;
  hasNote: boolean;
  match: boolean;
  dim: boolean;
  onClick: (id: string) => void;
}

export function PerformanceBlock({
  perf,
  style,
  selected,
  clash,
  hasNote,
  match,
  dim,
  onClick,
}: Props) {
  const cls = ['block'];
  if (selected) cls.push('block--sel');
  if (clash) cls.push('block--clash');
  if (match) cls.push('block--match');
  if (dim) cls.push('block--dim');

  const time = `${formatMinutes(perf.startMin)}–${formatMinutes(perf.endMin)}`;
  const label =
    `${perf.name}, ${perf.stageName}, ${time}` +
    (selected ? ', in your lineup' : '') +
    (clash ? ', has a clash' : '');

  return (
    <button
      type="button"
      className={cls.join(' ')}
      style={style}
      aria-pressed={selected}
      aria-label={label}
      title={`${perf.name} · ${perf.stageName} · ${time}`}
      onClick={() => onClick(perf.id)}
    >
      <span className="block__top">
        <span className="block__name">{perf.name}</span>
        {clash && (
          <span className="block__clash" aria-hidden="true">
            ⚠
          </span>
        )}
        {hasNote && (
          <span className="block__note" aria-hidden="true">
            ✎
          </span>
        )}
      </span>
      <span className="block__time">{time}</span>
    </button>
  );
}
