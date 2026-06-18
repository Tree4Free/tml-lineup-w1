import { useCallback, useEffect, useState } from 'react';
import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string';
import {
  DAYS,
  WEEKENDS,
  type Day,
  type Orientation,
  type ShareState,
  type Weekend,
  type WeekendPlan,
} from '../types';

const emptyPlan = (): WeekendPlan => ({ sel: [], notes: {}, planNote: '' });

export const DEFAULT_STATE: ShareState = {
  v: 2,
  name: '',
  weekend: 'W1',
  day: 'FRIDAY',
  orient: 'h',
  focus: false,
  plans: { W1: emptyPlan(), W2: emptyPlan() },
};

export function planHasContent(p: WeekendPlan): boolean {
  return (
    p.sel.length > 0 ||
    Object.keys(p.notes).length > 0 ||
    p.planNote.trim() !== ''
  );
}

// There's only something worth putting in the URL once the user has built a
// plan — a name, picks, a per-set note, or a plan note. View-only prefs
// (weekend, day, orientation, focus) don't dirty the URL on their own.
function isShareable(s: ShareState): boolean {
  return (
    (s.name ?? '').trim() !== '' ||
    WEEKENDS.some((w) => planHasContent(s.plans[w]))
  );
}

export function encodeState(s: ShareState): string {
  return compressToEncodedURIComponent(JSON.stringify(s));
}

function isStringRecord(v: unknown): v is Record<string, string> {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    Object.values(v).every((x) => typeof x === 'string')
  );
}

function migratePlan(value: unknown): WeekendPlan {
  if (typeof value !== 'object' || value === null) return emptyPlan();
  const p = value as Partial<WeekendPlan>;
  return {
    sel: Array.isArray(p.sel)
      ? p.sel.filter((x): x is string => typeof x === 'string')
      : [],
    notes: isStringRecord(p.notes) ? p.notes : {},
    planNote: typeof p.planNote === 'string' ? p.planNote : '',
  };
}

// Validate shape, fill defaults, and bring older versions forward. A v1 link was
// a single (W1) plan with flat sel/notes/planNote; fold it into plans.W1.
function migrate(parsed: unknown): ShareState {
  if (typeof parsed !== 'object' || parsed === null) return DEFAULT_STATE;
  const p = parsed as Record<string, unknown>;
  const day = DAYS.includes(p.day as Day) ? (p.day as Day) : DEFAULT_STATE.day;
  const orient: Orientation = p.orient === 'v' ? 'v' : 'h';
  const focus = Boolean(p.focus);

  const name = typeof p.name === 'string' ? p.name : '';

  if (p.v === 2) {
    const plans = (p.plans ?? {}) as Record<string, unknown>;
    return {
      v: 2,
      name,
      weekend: WEEKENDS.includes(p.weekend as Weekend)
        ? (p.weekend as Weekend)
        : 'W1',
      day,
      orient,
      focus,
      plans: { W1: migratePlan(plans.W1), W2: migratePlan(plans.W2) },
    };
  }

  // Legacy v1 (or unknown): treat the flat fields as the W1 plan.
  return {
    v: 2,
    name,
    weekend: 'W1',
    day,
    orient,
    focus,
    plans: { W1: migratePlan(parsed), W2: emptyPlan() },
  };
}

// Returns null for an invalid/unreadable hash so callers can decide what to do
// (default it on first load, but ignore it mid-session rather than wiping state).
export function decodeState(hash: string): ShareState | null {
  const raw = hash.replace(/^#s=/, '');
  if (!raw) return null;
  let parsed: unknown;
  try {
    const json = decompressFromEncodedURIComponent(raw);
    if (!json) return null;
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  return migrate(parsed);
}

function initialState(): ShareState {
  const decoded = decodeState(location.hash);
  if (decoded) return decoded;
  // No (valid) shared link: phones default to the vertical layout (the wide
  // grid can't fit a narrow screen).
  const narrow =
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'v' : 'h';
  return { ...DEFAULT_STATE, orient: narrow };
}

export function useUrlState(): [
  ShareState,
  (next: ShareState) => void,
  boolean,
] {
  const [state, setState] = useState<ShareState>(initialState);
  const [hashInvalid, setHashInvalid] = useState(
    () => location.hash !== '' && decodeState(location.hash) === null,
  );

  useEffect(() => {
    // Adopt a hash that someone typed/pasted into the address bar. `hashchange`
    // covers most browsers; `popstate` covers back/forward; `focus` is the
    // backstop for browsers that fire neither on an address-bar commit (focus
    // always returns to the page after Enter). We only adopt a valid hash that
    // differs from the current state, so clean URLs and view-only prefs (which
    // aren't encoded) are never clobbered and our replaceState writes don't loop.
    const sync = () => {
      const hasHash = location.hash !== '';
      const fromUrl = hasHash ? decodeState(location.hash) : null;
      setHashInvalid(hasHash && fromUrl === null);
      if (!fromUrl) return; // empty or invalid → keep the current view
      const encoded = encodeState(fromUrl);
      setState((prev) => (encoded !== encodeState(prev) ? fromUrl : prev));
    };
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  const update = useCallback((next: ShareState) => {
    const url = isShareable(next)
      ? '#s=' + encodeState(next)
      : location.pathname + location.search; // clean URL until there's a plan
    history.replaceState(null, '', url);
    setHashInvalid(false); // we just wrote a valid hash (or a clean URL)
    setState(next);
  }, []);

  return [state, update, hashInvalid];
}
