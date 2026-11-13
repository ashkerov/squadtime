import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar } from '../components/Calendar';
import { DualRange } from '../components/DualRange';
import { TopBar } from '../components/TopBar';
import { Button, Chip, Field } from '../components/ui';
import { inputClass } from '../components/styles';
import {
  DEFAULT_DAY_END,
  DEFAULT_DAY_START,
  DEFAULT_DURATION,
  EVENING_DURATION,
  nextWeekDates,
  normalizeName,
  weekendDates,
} from '../domain/meetings';
import {
  MAX_NAME_LENGTH,
  MAX_PARTICIPANTS,
  MAX_TITLE_LENGTH,
  type Meeting,
} from '../domain/schemas';
import { deviceTimezone, formatDateRange, todayIn } from '../domain/slots';
import { useCreateMeeting, useMeetingMutation } from '../hooks/meetings';
import p from './Page.module.css';
import s from './NewMeeting.module.css';

type DatePreset = 'weekend' | 'week' | 'custom';

const DURATIONS = [
  { value: 60, label: '1 ч' },
  { value: 120, label: '2 ч' },
  { value: 180, label: '3 ч' },
  { value: EVENING_DURATION, label: 'Весь вечер' },
];

function sameDates(a: string[], b: string[]) {
  return a.length === b.length && a.every((d, i) => d === b[i]);
}

/** Создание встречи — один экран без шагов. В режиме редактирования — те же поля. */
export function NewMeeting({ meeting }: { meeting?: Meeting }) {
  const navigate = useNavigate();
  const editing = Boolean(meeting);
  const timezone = meeting?.timezone ?? deviceTimezone();
  const today = todayIn(timezone);

  const [title, setTitle] = useState(meeting?.title ?? '');
  const [dates, setDates] = useState<string[]>(meeting?.dates ?? nextWeekDates(today));
  const [preset, setPreset] = useState<DatePreset>(() => {
    if (!meeting) return 'week';
    if (sameDates(meeting.dates, nextWeekDates(today))) return 'week';
    if (sameDates(meeting.dates, weekendDates(today))) return 'weekend';
    return 'custom';
  });
  const [dayStart, setDayStart] = useState(meeting?.dayStartMin ?? DEFAULT_DAY_START);
  const [dayEnd, setDayEnd] = useState(meeting?.dayEndMin ?? DEFAULT_DAY_END);
  const [duration, setDuration] = useState(meeting?.durationMin ?? DEFAULT_DURATION);
  const [names, setNames] = useState<string[]>([]);
  const [nameInput, setNameInput] = useState('');
  const [error, setError] = useState<string>();

  const create = useCreateMeeting();
  const update = useMeetingMutation((repo, patch: Parameters<typeof repo.update>[1]) =>
    repo.update(meeting!.id, patch),
  );

  const choosePreset = (next: DatePreset) => {
    setPreset(next);
    if (next === 'week') setDates(nextWeekDates(today));
    if (next === 'weekend') setDates(weekendDates(today));
  };

  const addName = () => {
    const name = normalizeName(nameInput);
    if (!name) return;
    if (names.some((n) => n.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'))) {
      setNameInput('');
      return;
    }
    if (names.length >= MAX_PARTICIPANTS) return;
    setNames([...names, name]);
    setNameInput('');
  };

  const onNameKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addName();
    } else if (e.key === 'Backspace' && !nameInput && names.length) {
      setNames(names.slice(0, -1));
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Введите название — это единственное обязательное поле');
      return;
    }
    if (dates.length === 0) {
      setError('Выберите хотя бы один день');
      return;
    }
    setError(undefined);
    const settings = {
      title: title.trim(),
      dates,
      dayStartMin: dayStart,
      dayEndMin: dayEnd,
      durationMin: duration,
    };
    if (meeting) {
      update.mutate(settings, { onSuccess: () => navigate(`/m/${meeting.id}`) });
    } else {
      const pending = normalizeName(nameInput);
      const participantNames = pending ? [...names, pending] : names;
      create.mutate(
        { ...settings, timezone, participantNames },
        { onSuccess: (m) => navigate(`/m/${m.id}`) },
      );
    }
  };

  const busy = create.isPending || update.isPending;

  return (
    <main className={p.page}>
      <TopBar
        back={meeting ? `/m/${meeting.id}` : '/'}
        title={editing ? 'Настройки встречи' : 'Новая встреча'}
      />
      <form className={s.form} onSubmit={submit} noValidate>
        <Field label="Название" htmlFor="title" error={error}>
          <input
            id="title"
            className={inputClass}
            placeholder="Например, кино в пятницу"
            value={title}
            maxLength={MAX_TITLE_LENGTH}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus={!editing}
            autoComplete="off"
            enterKeyHint="next"
          />
        </Field>

        <Field label="Даты" hint={preset !== 'custom' ? formatDateRange(dates) : undefined}>
          <div className={p.row}>
            <Chip selected={preset === 'weekend'} onClick={() => choosePreset('weekend')}>
              Эти выходные
            </Chip>
            <Chip selected={preset === 'week'} onClick={() => choosePreset('week')}>
              Ближайшая неделя
            </Chip>
            <Chip selected={preset === 'custom'} onClick={() => choosePreset('custom')}>
              Выбрать…
            </Chip>
          </div>
          {preset === 'custom' && <Calendar selected={dates} onChange={setDates} today={today} />}
        </Field>

        <Field label="Часы">
          <DualRange
            start={dayStart}
            end={dayEnd}
            onChange={(a, b) => {
              setDayStart(a);
              setDayEnd(b);
            }}
          />
        </Field>

        <Field label="Длительность">
          <div className={p.row}>
            {DURATIONS.map((d) => (
              <Chip
                key={d.value}
                selected={duration === d.value}
                onClick={() => setDuration(d.value)}
              >
                {d.label}
              </Chip>
            ))}
          </div>
        </Field>

        {!editing && (
          <Field
            label="Участники"
            htmlFor="names"
            hint="Имя и Enter. Можно пропустить — участники добавят себя сами."
          >
            <div className={s.names}>
              {names.map((n) => (
                <span key={n} className={s.nameChip}>
                  {n}
                  <button
                    type="button"
                    aria-label={`Убрать ${n}`}
                    onClick={() => setNames(names.filter((x) => x !== n))}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                id="names"
                className={s.nameInput}
                placeholder={names.length ? 'Ещё имя' : 'Аня, Макс…'}
                value={nameInput}
                maxLength={MAX_NAME_LENGTH}
                onChange={(e) => {
                  const v = e.target.value;
                  // Запятая тоже добавляет имя — удобно вставлять список.
                  if (v.includes(',')) {
                    const parts = v.split(',');
                    const fresh = parts
                      .slice(0, -1)
                      .map(normalizeName)
                      .filter(Boolean)
                      .filter(
                        (n) =>
                          !names.some(
                            (x) => x.toLocaleLowerCase('ru') === n.toLocaleLowerCase('ru'),
                          ),
                      );
                    setNames([...names, ...fresh].slice(0, MAX_PARTICIPANTS));
                    setNameInput(parts[parts.length - 1]);
                  } else {
                    setNameInput(v);
                  }
                }}
                onKeyDown={onNameKey}
                onBlur={addName}
                enterKeyHint="enter"
                autoComplete="off"
              />
            </div>
          </Field>
        )}

        <div className={p.stickyBottom}>
          <Button type="submit" variant="primary" block disabled={busy}>
            {editing ? 'Сохранить' : 'Создать'}
          </Button>
        </div>
      </form>
    </main>
  );
}
