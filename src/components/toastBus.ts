/** Простая шина тостов: показать тост можно из любого места, даже не из React. */

export interface ToastInput {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'default' | 'error';
  durationMs?: number;
}

export interface ToastItem extends ToastInput {
  id: number;
}

type Listener = (t: ToastItem) => void;
const listeners = new Set<Listener>();
let nextId = 1;

export function showToast(input: ToastInput | string) {
  const t: ToastItem =
    typeof input === 'string' ? { message: input, id: nextId++ } : { ...input, id: nextId++ };
  listeners.forEach((l) => l(t));
}

export function onToast(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
