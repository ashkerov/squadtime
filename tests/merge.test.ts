import { describe, expect, it } from 'vitest';
import { describeSummary, mergeMeetings } from '../src/domain/merge';
import { makeMeeting, person, range } from './helpers';

const D1 = '2026-11-14';

describe('mergeMeetings', () => {
  const base = makeMeeting({
    participants: [person('anya', 'Аня'), person('max', 'Макс')],
    availability: { anya: range(D1, '18:00', '20:00') },
    places: [{ id: 'p1', name: 'Кино', addedBy: 'anya', votes: ['anya'] }],
  });

  it('отметки разных людей не конфликтуют: каждый берётся из более свежей версии', () => {
    // Организатор обновил свои отметки локально.
    const local = {
      ...base,
      participants: [
        { ...base.participants[0], updatedAt: '2026-11-05T00:00:00.000Z' },
        base.participants[1],
      ],
      availability: { anya: range(D1, '17:00', '21:00') },
      updatedAt: '2026-11-05T00:00:00.000Z',
    };
    // Макс отметился у себя, его файл свежее по Максу, но старее по Ане.
    const incoming = {
      ...base,
      participants: [
        base.participants[0],
        { ...base.participants[1], updatedAt: '2026-11-03T00:00:00.000Z' },
      ],
      availability: { ...base.availability, max: range(D1, '19:00', '22:00') },
      updatedAt: '2026-11-03T00:00:00.000Z',
    };
    const { meeting, summary } = mergeMeetings(local, incoming);
    expect(meeting.availability.anya).toEqual(range(D1, '17:00', '21:00'));
    expect(meeting.availability.max).toEqual(range(D1, '19:00', '22:00'));
    expect(summary.updatedParticipants).toEqual(['Макс']);
    expect(describeSummary(summary)).toBe('Добавится: Макс (новые отметки)');

    // Обратный импорт у Макса даёт тот же результат.
    const back = mergeMeetings(incoming, local).meeting;
    expect(back.availability).toEqual(meeting.availability);
  });

  it('новые участники и места добавляются, лайки объединяются', () => {
    const incoming = {
      ...base,
      participants: [...base.participants, person('vika', 'Вика')],
      availability: { ...base.availability, vika: range(D1, '10:00', '12:00') },
      places: [
        { ...base.places[0], votes: ['anya', 'vika'] },
        { id: 'p2', name: 'Боулинг', addedBy: 'vika', votes: ['vika'] },
      ],
    };
    const { meeting, summary } = mergeMeetings(base, incoming);
    expect(meeting.participants.map((p) => p.id)).toEqual(['anya', 'max', 'vika']);
    expect(meeting.places).toHaveLength(2);
    expect(meeting.places[0].votes.sort()).toEqual(['anya', 'vika']);
    expect(summary.newParticipants).toEqual(['Вика']);
    expect(summary.newPlaces).toBe(1);
    expect(summary.newVotes).toBe(1);
    expect(describeSummary(summary)).toBe('Добавится: Вика (новый участник), 1 место, 1 лайк');
  });

  it('настройки и фиксация — из версии с более поздним settingsUpdatedAt', () => {
    const organizer = {
      ...base,
      title: 'Кино в субботу',
      settingsUpdatedAt: '2026-11-06T00:00:00.000Z',
      final: { start: '2026-11-14T16:00:00.000Z', fixedAt: '2026-11-06T00:00:00.000Z' },
    };
    // Друг отметился позже, но настройки у него старые.
    const friend = {
      ...base,
      participants: [
        base.participants[0],
        { ...base.participants[1], updatedAt: '2026-11-07T00:00:00.000Z' },
      ],
      availability: { ...base.availability, max: range(D1, '19:00', '21:00') },
      updatedAt: '2026-11-07T00:00:00.000Z',
    };
    const a = mergeMeetings(organizer, friend);
    expect(a.meeting.title).toBe('Кино в субботу');
    expect(a.meeting.final?.start).toBe('2026-11-14T16:00:00.000Z');
    expect(a.summary.settingsChanged).toBe(false);

    const b = mergeMeetings(friend, organizer);
    expect(b.meeting.title).toBe('Кино в субботу');
    expect(b.summary.settingsChanged).toBe(true);
    expect(b.summary.finalChanged).toBe(true);
    expect(b.meeting.availability.max).toEqual(range(D1, '19:00', '21:00'));
  });

  it('импорт той же версии — ничего не меняется', () => {
    const { meeting, summary } = mergeMeetings(base, structuredClone(base));
    expect(summary.isNoop).toBe(true);
    expect(meeting).toEqual(base);
  });
});
