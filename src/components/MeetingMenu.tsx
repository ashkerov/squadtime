import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeFileName } from '../domain/ics';
import type { Meeting } from '../domain/schemas';
import { useDeleteMeeting, useMeetingMutation } from '../hooks/meetings';
import { useRepository } from '../hooks/repositoryContext';
import { downloadText } from '../lib/browser';
import { Menu } from './Menu';
import { ParticipantsSheet } from './ParticipantsSheet';
import { Sheet } from './Sheet';
import { showToast } from './toastBus';
import { Button } from './ui';

/** Меню «⋯» встречи: Редактировать, Участники, Экспорт, Удалить. */
export function MeetingMenu({
  meeting,
  afterDelete,
}: {
  meeting: Meeting;
  afterDelete?: () => void;
}) {
  const navigate = useNavigate();
  const repo = useRepository();
  const del = useDeleteMeeting();
  const duplicate = useMeetingMutation((r, id: string) => r.duplicate(id));
  const [people, setPeople] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const exportFile = async () => {
    const json = await repo.exportMeeting(meeting.id);
    downloadText(`${safeFileName(meeting.title)}.meet.json`, json, 'application/json');
    showToast('Файл сохранён — отправьте его друзьям');
  };

  return (
    <>
      <Menu
        label={`Действия со встречей «${meeting.title}»`}
        items={[
          { label: 'Редактировать', onSelect: () => navigate(`/m/${meeting.id}/edit`) },
          { label: 'Участники', onSelect: () => setPeople(true) },
          { label: 'Экспорт', onSelect: () => void exportFile() },
          {
            label: 'Повторить встречу',
            onSelect: () =>
              duplicate.mutate(meeting.id, {
                onSuccess: (copy) => {
                  showToast(`Создана копия «${copy.title}» — те же люди и места, новые даты`);
                  navigate(`/m/${copy.id}`);
                },
              }),
          },
          { label: 'Удалить', onSelect: () => setConfirm(true), danger: true },
        ]}
      />
      <ParticipantsSheet meeting={meeting} open={people} onClose={() => setPeople(false)} />
      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Удалить встречу?"
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>Отмена</Button>
            <Button
              variant="danger"
              disabled={del.isPending}
              onClick={() =>
                del.mutate(meeting.id, {
                  onSuccess: () => {
                    setConfirm(false);
                    showToast(`Встреча «${meeting.title}» удалена`);
                    afterDelete?.();
                  },
                })
              }
            >
              Удалить
            </Button>
          </>
        }
      >
        <p>
          «{meeting.title}» и все отметки участников исчезнут с этого устройства. Это действие
          нельзя отменить. Если нужна копия — сначала сделайте экспорт.
        </p>
      </Sheet>
    </>
  );
}
