/**
 * Настройки внешнего вида этого устройства (не данные встреч, поэтому не в MeetingRepository).
 * Хранятся отдельно от kogda:v1; любые ошибки хранилища просто игнорируются.
 */

export type ThemeChoice = 'system' | 'light' | 'dark';

const THEME_KEY = 'kogda:theme';

export function loadTheme(): ThemeChoice {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function saveTheme(choice: ThemeChoice) {
  try {
    if (choice === 'system') window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* приватный режим и т. п. — тема просто не запомнится */
  }
}

/** Применить тему к документу: data-theme на <html> переопределяет системную. */
export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === 'system') delete root.dataset.theme;
  else root.dataset.theme = choice;
}
