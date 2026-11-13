import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { Id, Meeting, SlotStatus } from '../domain/schemas';
import type { MeetingRepository } from '../storage/MeetingRepository';
import { useRepository } from './repositoryContext';

/**
 * Хуки TanStack Query — единый слой загрузки и сохранения.
 * Экраны не знают, где лежат данные: сейчас localStorage, потом сервер.
 */

export const qk = {
  meetings: ['meetings'] as const,
  meeting: (id: Id) => ['meeting', id] as const,
  active: (id: Id) => ['active', id] as const,
};

export function useMeetings() {
  const repo = useRepository();
  return useQuery({ queryKey: qk.meetings, queryFn: () => repo.list() });
}

export function useMeeting(id: Id) {
  const repo = useRepository();
  return useQuery({
    queryKey: qk.meeting(id),
    queryFn: async () => (await repo.get(id)) ?? null,
  });
}

/** Положить свежую версию встречи в кеш и обновить список. */
export function useApplyMeeting() {
  const qc = useQueryClient();
  return useCallback(
    (m: Meeting) => {
      qc.setQueryData(qk.meeting(m.id), m);
      void qc.invalidateQueries({ queryKey: qk.meetings });
    },
    [qc],
  );
}

type HasMeeting = Meeting | { meeting: Meeting };

function meetingOf(res: HasMeeting): Meeting {
  return 'meeting' in res ? res.meeting : res;
}

/** Универсальная мутация над одной встречей: результат сразу попадает в кеш. */
export function useMeetingMutation<V, R extends HasMeeting>(
  fn: (repo: MeetingRepository, vars: V) => Promise<R>,
) {
  const repo = useRepository();
  const apply = useApplyMeeting();
  return useMutation({
    mutationFn: (vars: V) => fn(repo, vars),
    onSuccess: (res) => apply(meetingOf(res)),
  });
}

export function useSaveAvailability(meetingId: Id) {
  const repo = useRepository();
  const qc = useQueryClient();
  const apply = useApplyMeeting();
  return useMutation({
    mutationFn: (v: { participantId: Id; slots: Record<string, SlotStatus> }) =>
      repo.setAvailability(meetingId, v.participantId, v.slots),
    // Оптимистично: сетка обновляется сразу, без мигания.
    // Синхронно, чтобы следующее действие пользователя уже видело новое значение.
    onMutate: (v) => {
      void qc.cancelQueries({ queryKey: qk.meeting(meetingId) });
      const prev = qc.getQueryData<Meeting | null>(qk.meeting(meetingId));
      if (prev) {
        qc.setQueryData(qk.meeting(meetingId), {
          ...prev,
          availability: { ...prev.availability, [v.participantId]: v.slots },
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.meeting(meetingId), ctx.prev);
    },
    onSuccess: apply,
  });
}

export function useCreateMeeting() {
  const repo = useRepository();
  const apply = useApplyMeeting();
  return useMutation({
    mutationFn: (input: Parameters<MeetingRepository['create']>[0]) => repo.create(input),
    onSuccess: apply,
  });
}

export function useCreateDemo() {
  const repo = useRepository();
  const apply = useApplyMeeting();
  return useMutation({ mutationFn: () => repo.createDemo(), onSuccess: apply });
}

export function useDeleteMeeting() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => repo.remove(id),
    onSuccess: (_r, id) => {
      qc.setQueryData(qk.meeting(id), null);
      void qc.invalidateQueries({ queryKey: qk.meetings });
    },
  });
}

export function useImportMeeting() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: string) => repo.importMeeting(json),
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: qk.meetings });
      void qc.invalidateQueries({ queryKey: qk.meeting(s.meetingId) });
    },
  });
}

// ——— Кто отмечается ———

export function useActiveParticipant(meeting: Meeting | null | undefined) {
  const repo = useRepository();
  const qc = useQueryClient();
  const meetingId = meeting?.id ?? '';
  const query = useQuery({
    queryKey: qk.active(meetingId),
    queryFn: async () => (await repo.getActiveParticipant(meetingId)) ?? null,
    enabled: Boolean(meeting),
  });
  const set = useMutation({
    mutationFn: (participantId: Id) => repo.setActiveParticipant(meetingId, participantId),
    onMutate: (participantId) => qc.setQueryData(qk.active(meetingId), participantId),
  });
  const activeId = query.data ?? null;
  const active = meeting?.participants.find((p) => p.id === activeId) ?? null;
  return { active, setActive: set.mutate };
}
