import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { describeSummary, type ImportSummary } from '../domain/merge';
import { useImportMeeting } from '../hooks/meetings';
import { useRepository } from '../hooks/repositoryContext';
import { readFileText } from '../lib/browser';
import { Sheet } from './Sheet';
import { showToast } from './toastBus';
import { Button } from './ui';

/** «Импорт»: выбрать .meet.json, показать сводку «Добавится: …» и только потом применить. */
export function ImportButton({ variant = 'secondary' }: { variant?: 'secondary' | 'ghost' }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const repo = useRepository();
  const navigate = useNavigate();
  const importMeeting = useImportMeeting();
  const [pending, setPending] = useState<{ json: string; summary: ImportSummary } | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const json = await readFileText(file);
      const summary = await repo.previewImport(json);
      setPending({ json, summary });
    } catch (e) {
      showToast({ message: (e as Error).message, tone: 'error' });
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const apply = () => {
    if (!pending) return;
    if (pending.summary.isNoop) {
      setPending(null);
      navigate(`/m/${pending.summary.meetingId}`);
      return;
    }
    importMeeting.mutate(pending.json, {
      onSuccess: (s) => {
        setPending(null);
        showToast(s.isNew ? 'Встреча добавлена' : 'Отметки объединены');
        navigate(`/m/${s.meetingId}/results`);
      },
    });
  };

  return (
    <>
      <Button variant={variant} onClick={() => inputRef.current?.click()}>
        Импорт
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,.meet.json,application/json"
        hidden
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <Sheet
        open={pending !== null}
        onClose={() => setPending(null)}
        title={
          pending?.summary.isNew ? 'Новая встреча' : `Обновить «${pending?.summary.title ?? ''}»`
        }
        footer={
          <>
            <Button onClick={() => setPending(null)}>Отмена</Button>
            <Button variant="primary" onClick={apply} disabled={importMeeting.isPending}>
              {pending?.summary.isNoop ? 'Открыть встречу' : 'Применить'}
            </Button>
          </>
        }
      >
        {pending && <p>{describeSummary(pending.summary)}</p>}
      </Sheet>
    </>
  );
}
