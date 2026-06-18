import { useEffect, useState } from 'react';

type Theme = 'system' | 'light' | 'dark';
const ORDER: Theme[] = ['system', 'light', 'dark'];
const LABEL: Record<Theme, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

function readTheme(): Theme {
  try {
    const v = localStorage.getItem('theme');
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // localStorage unavailable — fall through to system.
  }
  return 'system';
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === 'light') {
    // sun
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path
          d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (theme === 'dark') {
    // moon
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8z" />
      </svg>
    );
  }
  // system / monitor
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="3"
        y="4"
        width="18"
        height="12"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M9 20h6M12 16v4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // Ignore persistence failures (private mode, etc.).
    }
  }, [theme]);

  const cycle = (): void =>
    setTheme((t) => ORDER[(ORDER.indexOf(t) + 1) % ORDER.length]);

  return (
    <button
      type="button"
      className="chip theme-toggle"
      onClick={cycle}
      title={`Theme: ${LABEL[theme]} (click to change)`}
      aria-label={`Theme: ${LABEL[theme]}. Click to change.`}
    >
      <ThemeIcon theme={theme} />
    </button>
  );
}
