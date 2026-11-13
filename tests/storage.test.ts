import { describe, expect, it } from 'vitest';
import {
  BROKEN_PREFIX,
  LocalStorageRepository,
  STORAGE_KEY,
  type StorageLike,
} from '../src/storage/LocalStorageRepository';

class MemoryStorage implements StorageLike {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const input = {
  title: 'Кино',
  timezone: 'Europe/Moscow',
  dates: ['2026-11-14', '2026-11-15'],
  dayStartMin: 600,
  dayEndMin: 1380,
  durationMin: 120,
  participantNames: ['Аня', 'Макс', 'аня'],
};

describe('LocalStorageRepository', () => {
  it('данные переживают «перезагрузку» (новый экземпляр репозитория)', async () => {
    const storage = new MemoryStorage();
    const repo = new LocalStorageRepository(storage);
    const m = await repo.create(input);
    expect(m.participants.map((p) => p.name)).toEqual(['Аня', 'Макс']); // дубль отброшен
    await repo.setAvailability(m.id, m.participants[0].id, { '2026-11-14T07:00:00.000Z': 'yes' });
    repo.flush();

    const reloaded = new LocalStorageRepository(storage);
    const again = await reloaded.get(m.id);
    expect(again?.availability[m.participants[0].id]).toEqual({
      '2026-11-14T07:00:00.000Z': 'yes',
    });
    expect(await reloaded.getActiveParticipant(m.id)).toBe(m.participants[0].id);
  });

  it('запись откладывается на 300 мс', async () => {
    const storage = new MemoryStorage();
    const repo = new LocalStorageRepository(storage, { writeDelayMs: 20 });
    await repo.create(input);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    await new Promise((r) => setTimeout(r, 40));
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('битый JSON не ломает сайт: копия сохраняется, старт с чистого листа', async () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{"version":1,"meetings":[{"oops"');
    const repo = new LocalStorageRepository(storage, {
      now: () => new Date('2026-11-13T10:00:00.000Z'),
    });
    expect(await repo.list()).toEqual([]);
    expect(storage.getItem(`${BROKEN_PREFIX}2026-11-13T10:00:00.000Z`)).toContain('oops');
    expect(repo.takeLoadWarning()).toMatch(/повреждены/);
    expect(repo.takeLoadWarning()).toBeUndefined();
  });

  it('без несохранённых изменений flush не перезаписывает данные другой вкладки', async () => {
    const storage = new MemoryStorage();
    const repo = new LocalStorageRepository(storage);
    await repo.create(input);
    repo.flush();
    storage.setItem(STORAGE_KEY, 'written-by-another-tab');
    repo.flush();
    expect(storage.getItem(STORAGE_KEY)).toBe('written-by-another-tab');
  });

  it('данные неверной структуры тоже считаются битыми', async () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, meetings: [{ id: 1 }] }));
    const repo = new LocalStorageRepository(storage);
    expect(await repo.list()).toEqual([]);
    expect(repo.takeLoadWarning()).toBeDefined();
  });

  it('экспорт → импорт на другом устройстве → обратный импорт сливает отметки без потерь', async () => {
    let clock = Date.parse('2026-11-13T10:00:00.000Z');
    const now = () => new Date((clock += 1000));
    const orgRepo = new LocalStorageRepository(new MemoryStorage(), { now });
    const m = await orgRepo.create(input);
    const [anya, max] = m.participants;
    await orgRepo.setAvailability(m.id, anya.id, { '2026-11-14T15:00:00.000Z': 'yes' });

    const friendRepo = new LocalStorageRepository(new MemoryStorage(), { now });
    const s1 = await friendRepo.importMeeting(await orgRepo.exportMeeting(m.id));
    expect(s1.isNew).toBe(true);
    await friendRepo.setAvailability(m.id, max.id, { '2026-11-14T15:00:00.000Z': 'maybe' });

    // Тем временем организатор меняет свои отметки.
    await orgRepo.setAvailability(m.id, anya.id, {
      '2026-11-14T15:00:00.000Z': 'yes',
      '2026-11-14T15:30:00.000Z': 'yes',
    });

    const fileBack = await friendRepo.exportMeeting(m.id);
    const preview = await orgRepo.previewImport(fileBack);
    expect(preview.updatedParticipants).toEqual(['Макс']);
    await orgRepo.importMeeting(fileBack);

    const merged = (await orgRepo.get(m.id))!;
    expect(merged.availability[anya.id]).toEqual({
      '2026-11-14T15:00:00.000Z': 'yes',
      '2026-11-14T15:30:00.000Z': 'yes',
    });
    expect(merged.availability[max.id]).toEqual({ '2026-11-14T15:00:00.000Z': 'maybe' });
  });

  it('импорт мусора даёт понятную ошибку', async () => {
    const repo = new LocalStorageRepository(new MemoryStorage());
    await expect(repo.previewImport('not json')).rejects.toThrow(/не файл встречи/);
    await expect(repo.previewImport('{"a":1}')).rejects.toThrow(/повреждён/);
  });

  it('удаление участника и «Вернуть»', async () => {
    const repo = new LocalStorageRepository(new MemoryStorage());
    const m = await repo.create(input);
    const anya = m.participants[0];
    await repo.setAvailability(m.id, anya.id, { '2026-11-14T15:00:00.000Z': 'yes' });
    const { snapshot, meeting } = await repo.removeParticipant(m.id, anya.id);
    expect(meeting.participants).toHaveLength(1);
    const restored = await repo.restoreParticipant(m.id, snapshot);
    expect(restored.participants.map((p) => p.name)).toEqual(['Аня', 'Макс']);
    expect(restored.availability[anya.id]).toEqual({ '2026-11-14T15:00:00.000Z': 'yes' });
  });

  it('демо-встреча проходит проверку схемы', async () => {
    const repo = new LocalStorageRepository(new MemoryStorage());
    const demo = await repo.createDemo();
    expect(demo.participants).toHaveLength(6);
    const json = await repo.exportMeeting(demo.id);
    const other = new LocalStorageRepository(new MemoryStorage());
    expect((await other.importMeeting(json)).isNew).toBe(true);
  });
});
