import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { findClashes } from './lib/conflicts';
import { useLineups } from './data/useLineups';
import { encodeState, planHasContent, useUrlState } from './state/urlState';
import {
  DAYS,
  WEEKENDS,
  type Day,
  type Performance,
  type WeekendPlan,
} from './types';
import { Toolbar } from './components/Toolbar';
import { Timetable } from './components/Timetable';
import { NoteModal } from './components/NoteModal';
import { Sidebar } from './components/Sidebar';

const emptyGroups = (): Record<Day, Performance[]> => ({
  FRIDAY: [],
  SATURDAY: [],
  SUNDAY: [],
});

export default function App() {
  const [state, setState, hashInvalid] = useUrlState();
  const lineups = useLineups();
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // Opening a shared link that already has a plan starts with the sidebar open
  // (matters on mobile, where it's otherwise a closed drawer).
  const [lineupOpen, setLineupOpen] = useState(
    () =>
      (state.name ?? '').trim() !== '' ||
      planHasContent(state.plans[state.weekend]),
  );

  const all = lineups.status === 'ready' ? lineups.data : null;
  const errored = lineups.status === 'error' ? lineups.error : null;
  const data = all ? all[state.weekend] : null; // active weekend's lineup
  const plan = state.plans[state.weekend];
  const selected = useMemo(() => new Set(plan.sel), [plan.sel]);

  // Selected sets for the active weekend, grouped by day (time-sorted) + clashes.
  const { byDaySelected, clashes } = useMemo(() => {
    const grouped = emptyGroups();
    const clash = new Set<string>();
    if (data) {
      for (const day of DAYS) {
        const list = data.byDay[day]
          .filter((p) => selected.has(p.id))
          .sort((a, b) => a.startMin - b.startMin);
        grouped[day] = list;
        for (const id of findClashes(list)) clash.add(id);
      }
    }
    return { byDaySelected: grouped, clashes: clash };
  }, [data, selected]);

  // Resilience: once the lineups are loaded, drop any picks/notes (in either
  // weekend) for acts that are no longer in that weekend's lineup.
  useEffect(() => {
    if (!all) return;
    let changed = false;
    const plans = { ...state.plans };
    for (const w of WEEKENDS) {
      const p = state.plans[w];
      const byId = all[w].byId;
      const sel = p.sel.filter((id) => byId.has(id));
      if (sel.length === p.sel.length) continue;
      const notes: Record<string, string> = {};
      for (const id of sel) {
        if (p.notes[id] !== undefined) notes[id] = p.notes[id];
      }
      plans[w] = { ...p, sel, notes };
      changed = true;
    }
    if (changed) setState({ ...state, plans });
  }, [all, state, setState]);

  const setPlan = (next: WeekendPlan): void => {
    setState({ ...state, plans: { ...state.plans, [state.weekend]: next } });
  };

  const toggle = (id: string): void => {
    if (selected.has(id)) {
      const notes = { ...plan.notes };
      delete notes[id]; // removing a set drops its comment
      setPlan({ ...plan, sel: plan.sel.filter((x) => x !== id), notes });
    } else {
      setPlan({ ...plan, sel: [...plan.sel, id] });
    }
  };

  const setNote = (id: string, text: string): void => {
    const notes = { ...plan.notes };
    if (text.trim()) notes[id] = text;
    else delete notes[id];
    setPlan({ ...plan, notes });
  };

  // Search across act + artist names in the active weekend.
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    const found = new Set<string>();
    if (q && data) {
      for (const p of data.performances) {
        if (
          p.name.toLowerCase().includes(q) ||
          p.artists.some((a) => a.name.toLowerCase().includes(q))
        ) {
          found.add(p.id);
        }
      }
    }
    return found;
  }, [q, data]);
  const matchDays = useMemo(() => {
    const days = new Set<Day>();
    if (q && data) {
      for (const day of DAYS) {
        if (data.byDay[day].some((p) => matches.has(p.id))) days.add(day);
      }
    }
    return days;
  }, [q, data, matches]);

  const dayClashCount = byDaySelected[state.day].filter((p) =>
    clashes.has(p.id),
  ).length;
  const selCount = DAYS.reduce((n, d) => n + byDaySelected[d].length, 0);

  const notePerf = data && openId ? data.byId.get(openId) : undefined;
  const noteClashWith: Performance[] = notePerf
    ? byDaySelected[notePerf.day].filter(
        (p) =>
          p.id !== notePerf.id &&
          p.startMin < notePerf.endMin &&
          notePerf.startMin < p.endMin,
      )
    : [];

  const shareUrl =
    location.origin + location.pathname + '#s=' + encodeState(state);

  return (
    <div className="app">
      {hashInvalid && (
        <div className="hash-warn" role="alert">
          <span>
            This link’s saved lineup couldn’t be read — it may be corrupted or
            truncated. Showing your current view instead.
          </span>
          <div className="toolbar__spacer" />
          <button
            type="button"
            className="icon-btn"
            aria-label="Dismiss"
            onClick={() => setState(state)}
          >
            ×
          </button>
        </div>
      )}

      <Toolbar
        weekend={state.weekend}
        day={state.day}
        orient={state.orient}
        focus={state.focus}
        clashCount={dayClashCount}
        selCount={selCount}
        query={query}
        matchCount={matches.size}
        matchDays={matchDays}
        onQuery={setQuery}
        onWeekend={(weekend) => setState({ ...state, weekend })}
        onDay={(day) => setState({ ...state, day })}
        onOrient={(orient) => setState({ ...state, orient })}
        onFocus={(focus) => setState({ ...state, focus })}
        onToggleLineup={() => setLineupOpen((o) => !o)}
      />

      <div className="body">
        <main className="grid-region" aria-label="Timetable">
          {data ? (
            <Timetable
              layout={data.dayLayout[state.day]}
              orient={state.orient}
              performances={data.byDay[state.day]}
              selected={selected}
              clashes={clashes}
              notes={plan.notes}
              focus={state.focus}
              matches={matches}
              searching={q !== ''}
              onSelect={toggle}
            />
          ) : (
            <div className="splash">
              {errored === null ? (
                <span className="muted">Loading the lineups…</span>
              ) : (
                <>
                  <span className="muted">
                    Couldn’t load the lineups — {errored}
                  </span>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={lineups.reload}
                  >
                    Retry
                  </button>
                </>
              )}
            </div>
          )}
        </main>

        <Sidebar
          key={state.weekend}
          open={lineupOpen}
          weekend={state.weekend}
          onWeekend={(weekend) => setState({ ...state, weekend })}
          name={state.name ?? ''}
          byDaySelected={byDaySelected}
          clashes={clashes}
          notes={plan.notes}
          activeDay={state.day}
          planNote={plan.planNote}
          shareUrl={shareUrl}
          tooLong={shareUrl.length > 8000}
          onName={(name) => setState({ ...state, name })}
          onPlanNote={(planNote) => setPlan({ ...plan, planNote })}
          onRemove={toggle}
          onEditNote={setOpenId}
          onJump={(day) => setState({ ...state, day })}
          onClose={() => setLineupOpen(false)}
        />
      </div>

      {notePerf && (
        <NoteModal
          key={notePerf.id}
          perf={notePerf}
          note={plan.notes[notePerf.id] ?? ''}
          clashWith={noteClashWith}
          onNote={(t) => setNote(notePerf.id, t)}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
