import { useEffect, useState } from 'react';
import { WEEKENDS, type Weekend } from '../types';
import { fetchLineup, type LineupData } from './lineup';

export type LineupsState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; data: Record<Weekend, LineupData> };

/**
 * Fetches every weekend's lineup once, in parallel, and keeps them all in
 * memory — so switching weekend afterwards is instant (no refetch).
 */
export function useLineups(): LineupsState & { reload: () => void } {
  const [state, setState] = useState<LineupsState>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all(WEEKENDS.map((w) => fetchLineup(w, ctrl.signal)))
      .then((results) => {
        const data = {} as Record<Weekend, LineupData>;
        WEEKENDS.forEach((w, i) => {
          data[w] = results[i];
        });
        setState({ status: 'ready', data });
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setState({
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed to load lineups',
        });
      });
    return () => ctrl.abort();
  }, [nonce]);

  return { ...state, reload: () => setNonce((n) => n + 1) };
}
