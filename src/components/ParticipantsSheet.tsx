import { useState } from 'react';
import type { Meeting, Participant } from '../domain/schemas';
import { MAX_NAME_LENGTH, MAX_PARTICIPANTS } from '../domain/schemas';
import { useMeetingMutation } from '../hooks/meetings';
import { Avatar } from './Avatar';
import { PickList } from './ParticipantPicker';
import { Sheet } from './Sheet';
import { showToast } from './toastBus';
import { inputClass } from './styles';
import s from './ParticipantsSheet.module.css';

/** Управление участниками: переименовать, сделать обязательным, удалить (с «Вернуть»). */
export function ParticipantsSheet({
  meeting,
  open,
  onClose,
}: {
  meeting: Meeting;
  open: boolean;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const update = useMeetingMutation(
    (repo, v: { id: string; name?: string; isRequired?: boolean }) =>
      repo.updateParticipant(meeting.id, v.id, { name: v.name, isRequired: v.isRequired }),
  );
  const restore = useMeetingMutation(
    (repo, snap: Awaited<ReturnType<typeof repo.removeParticipant>>['snapshot']) =>
      repo.restoreParticipant(meeting.id, snap),
  );
  const remove = useMeetingMutation((repo, id: string) => repo.removeParticipant(meeting.id, id));

  const onRemove = (p: Participant) => {
    remove.mutate(p.id, {
      onSuccess: (res) =>
        showToast({
          message: `Удалено: ${p.name}`,
          actionLabel: 'Вернуть',
          onAction: () => restore.mutate(res.snapshot),
        }),
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Участники · ${meeting.participants.length} из ${MAX_PARTICIPANTS}`}
    >
      <div className={s.wrap}>
        {meeting.participants.length === 0 && (
          <p className={s.empty}>Пока никого. Добавьте участников по именам.</p>
        )}
        <ul className={s.list}>
          {meeting.participants.map((p) => (
            <li key={p.id} className={s.row}>
              <Avatar name={p.name} size={36} />
              {editing === p.id ? (
                <form
                  className={s.renameForm}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const name = new FormData(e.currentTarget).get('name') as string;
                    update.mutate({ id: p.id, name }, { onSuccess: () => setEditing(null) });
                  }}
                >
                  <input
                    name="name"
                    className={inputClass}
                    defaultValue={p.name}
                    maxLength={MAX_NAME_LENGTH}
                    aria-label={`Новое имя для ${p.name}`}
                    autoFocus
                    onBlur={(e) => {
                      if (e.target.value.trim() && e.target.value.trim() !== p.name) {
                        e.currentTarget.form?.requestSubmit();
                      } else {
                        setEditing(null);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.stopPropagation();
                        setEditing(null);
                      }
                    }}
                  />
                </form>
              ) : (
                <button
                  type="button"
                  className={s.name}
                  onClick={() => setEditing(p.id)}
                  title="Переименовать"
                >
                  {p.name}
                  <span className="visually-hidden"> — переименовать</span>
                </button>
              )}
              <button
                type="button"
                className={`${s.iconBtn} ${p.isRequired ? s.on : ''}`}
                aria-pressed={p.isRequired}
                aria-label={`${p.name}: обязательный участник`}
                title="Обязательный: без него встреча не состоится"
                onClick={() => update.mutate({ id: p.id, isRequired: !p.isRequired })}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                  <path
                    d="M10 2.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 7.8l5-.7z"
                    fill={p.isRequired ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                className={`${s.iconBtn} ${s.delete}`}
                aria-label={`Удалить ${p.name}`}
                title="Удалить"
                onClick={() => onRemove(p)}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                  <path
                    d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
        <p className={s.legend}>★ — обязательный: варианты, где он не может, не попадут в топ.</p>
        <PickList meeting={meeting} hideList onPick={() => {}} />
      </div>
    </Sheet>
  );
}
