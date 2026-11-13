import {
  createMeeting,
  defaultIdGen,
  type IdGen,
  DEFAULT_DAY_END,
  DEFAULT_DAY_START,
} from './meetings';
import type { Meeting, SlotStatus } from './schemas';
import { addDays, buildGrid, todayIn } from './slots';

/** Демо-данные (F14): 6 участников и случайные, но правдоподобные отметки. */

const NAMES = ['Аня', 'Борис', 'Вика', 'Гоша', 'Даша', 'Макс'];

export function createDemoMeeting(
  timezone: string,
  now: Date = new Date(),
  random: () => number = Math.random,
  idGen: IdGen = defaultIdGen,
): Meeting {
  const today = todayIn(timezone, now);
  const base = createMeeting(
    {
      title: 'Боулинг',
      timezone,
      dates: Array.from({ length: 7 }, (_, i) => addDays(today, i + 1)),
      dayStartMin: DEFAULT_DAY_START,
      dayEndMin: DEFAULT_DAY_END,
      durationMin: 120,
      participantNames: NAMES,
    },
    now,
    idGen,
  );

  const grid = buildGrid(base);
  const availability: Meeting['availability'] = {};
  // Общий «хороший» вечер, чтобы в топе было что показать.
  const sweetDay = grid.days[Math.min(4, grid.days.length - 1)];

  base.participants.forEach((p, idx) => {
    const marks: Record<string, SlotStatus> = {};
    for (const day of grid.days) {
      if (random() < 0.35) continue; // в этот день не может
      const cells = day.cells.filter((c) => c !== null);
      // Один-два блока в день, чаще вечером.
      const blocks = random() < 0.5 ? 1 : 2;
      for (let b = 0; b < blocks; b++) {
        const evening = random() < 0.7;
        const from = evening
          ? Math.floor(cells.length * 0.55 + random() * cells.length * 0.25)
          : Math.floor(random() * cells.length * 0.5);
        const len = 3 + Math.floor(random() * 6);
        const status: SlotStatus = random() < 0.75 ? 'yes' : 'maybe';
        for (const c of cells.slice(from, from + len)) marks[c.key] = status;
      }
    }
    // Все, кроме последнего, свободны в «хороший» вечер 19:00–22:00.
    if (idx < NAMES.length - 1) {
      for (const c of sweetDay.cells) {
        if (c && c.minute >= 19 * 60 && c.minute < 22 * 60)
          marks[c.key] = idx === 2 ? 'maybe' : 'yes';
      }
    }
    availability[p.id] = marks;
  });

  const [anya, boris, vika, gosha, dasha] = base.participants;
  return {
    ...base,
    participants: base.participants.map((p) => (p.id === anya.id ? { ...p, isRequired: true } : p)),
    availability,
    places: [
      {
        id: idGen(),
        name: 'Боулинг-клуб «Страйк»',
        address: 'ул. Примерная, 12',
        mapUrl: 'https://yandex.ru/maps/?text=%D0%B1%D0%BE%D1%83%D0%BB%D0%B8%D0%BD%D0%B3',
        addedBy: boris.id,
        votes: [boris.id, anya.id, dasha.id],
      },
      {
        id: idGen(),
        name: 'Космик',
        address: 'пр. Тестовый, 5',
        addedBy: vika.id,
        votes: [vika.id, gosha.id],
      },
    ],
  };
}
