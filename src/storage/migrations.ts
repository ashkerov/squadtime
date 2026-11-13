/**
 * Миграции формата данных в localStorage. Поле version растёт при смене структуры;
 * для каждого шага пишется функция migrateVnToVn+1.
 */

export const CURRENT_VERSION = 1;

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/** Индекс — исходная версия: MIGRATIONS[1] переводит v1 → v2. */
const MIGRATIONS: Record<number, Migration> = {};

export function migrate(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) throw new Error('Данные — не объект');
  let data = raw as Record<string, unknown>;
  if (typeof data.version !== 'number') throw new Error('Нет версии данных');
  let version: number = data.version;
  if (version > CURRENT_VERSION) throw new Error(`Данные из более новой версии (${version})`);
  while (version < CURRENT_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new Error(`Нет миграции с версии ${version}`);
    data = step(data);
    version = data.version as number;
  }
  return data;
}
