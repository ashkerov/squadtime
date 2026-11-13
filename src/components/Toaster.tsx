import { useEffect, useState } from 'react';
import { onToast, type ToastItem } from './toastBus';
import s from './Toaster.module.css';

/** Тосты «Удалено · Вернуть» вместо модальных «Вы уверены?». */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(
    () =>
      onToast((t) => {
        setItems((prev) => [...prev.slice(-2), t]);
        window.setTimeout(
          () => setItems((prev) => prev.filter((x) => x.id !== t.id)),
          t.durationMs ?? (t.onAction ? 6000 : 3500),
        );
      }),
    [],
  );

  const dismiss = (id: number) => setItems((prev) => prev.filter((x) => x.id !== id));

  return (
    <div className={s.region} role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`${s.toast} ${t.tone === 'error' ? s.error : ''}`}>
          <span className={s.message}>{t.message}</span>
          {t.onAction && (
            <button
              type="button"
              className={s.action}
              onClick={() => {
                t.onAction?.();
                dismiss(t.id);
              }}
            >
              {t.actionLabel ?? 'Вернуть'}
            </button>
          )}
          <button
            type="button"
            className={s.close}
            aria-label="Закрыть уведомление"
            onClick={() => dismiss(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
