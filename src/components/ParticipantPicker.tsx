import { useState, type FormEvent } from 'react';
import type { Meeting, Participant } from '../domain/schemas';
import { MAX_NAME_LENGTH, MAX_PARTICIPANTS } from '../domain/schemas';
import { useMeetingMutation } from '../hooks/meetings';
import { Avatar } from './Avatar';
import { Sheet } from './Sheet';
import { Button } from './ui';
import { inputClass } from './styles';
import s from './ParticipantPicker.module.css';

/** «Кто отмечается: Аня ▾» — выбор запоминается для каждой встречи. */
export function ParticipantPicker({
  meeting,
  active,
  onSelect,
  prefix = 'Кто отмечается',
}: {
  meeting: Meeting;
  active: Participant | null;
  onSelect: (id: string) => void;
  prefix?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={s.trigger}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <span className={s.prefix}>{prefix}:</span>
        {active ? (
          <>
            <Avatar name={active.name} size={28} />
            <span className={s.name}>{active.name}</span>
          </>
        ) : (
          <span className={s.placeholder}>выберите себя</span>
        )}
        <svg className={s.caret} width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Кто вы?">
        <PickList
          meeting={meeting}
          activeId={active?.id}
          onPick={(id) => {
            onSelect(id);
            setOpen(false);
          }}
        />
      </Sheet>
    </>
  );
}

export function PickList({
  meeting,
  activeId,
  onPick,
  hideList,
}: {
  meeting: Meeting;
  activeId?: string;
  onPick: (id: string) => void;
  hideList?: boolean;
}) {
  const [name, setName] = useState('');
  const add = useMeetingMutation((repo, n: string) => repo.addParticipant(meeting.id, n));
  const full = meeting.participants.length >= MAX_PARTICIPANTS;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    add.mutate(name, {
      onSuccess: (res) => {
        setName('');
        onPick(res.participant.id);
      },
    });
  };

  return (
    <div className={s.list}>
      {!hideList && meeting.participants.length > 0 && (
        <ul className={s.people} role="listbox" aria-label="Участники">
          {meeting.participants.map((p) => {
            const marked = Object.keys(meeting.availability[p.id] ?? {}).length > 0;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={p.id === activeId}
                  className={`${s.person} ${p.id === activeId ? s.personOn : ''}`}
                  onClick={() => onPick(p.id)}
                >
                  <Avatar name={p.name} size={36} />
                  <span className={s.personName}>
                    {p.name}
                    {p.isRequired && <span className={s.req}> · обязательный</span>}
                  </span>
                  <span className={s.personMeta}>{marked ? 'есть отметки' : 'нет отметок'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {!full && (
        <form className={s.addForm} onSubmit={submit}>
          <label className="visually-hidden" htmlFor="pick-add">
            Ваше имя
          </label>
          <input
            id="pick-add"
            className={inputClass}
            placeholder={
              hideList
                ? 'Имя нового участника'
                : meeting.participants.length
                  ? 'Меня нет в списке — моё имя'
                  : 'Ваше имя'
            }
            value={name}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => setName(e.target.value)}
            autoComplete="given-name"
            enterKeyHint="done"
          />
          <Button type="submit" variant="primary" disabled={!name.trim() || add.isPending}>
            Добавить
          </Button>
        </form>
      )}
    </div>
  );
}
