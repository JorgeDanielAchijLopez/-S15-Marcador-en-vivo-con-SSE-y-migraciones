import type { EventForm, Match, MatchDetail, MatchEvent } from './types';

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data: unknown = await response.json();
  if (!response.ok) {
    const message = (data as { error?: string })?.error;
    throw new Error(message || `Error HTTP ${response.status}`);
  }
  return data as T;
}

export const api = {
  matches: () => getJson<Match[]>('/api/matches'),
  details: (id: number, signal?: AbortSignal) =>
    getJson<MatchDetail>(`/api/matches/${id}`, { signal }),
  addEvent: (id: number, values: EventForm) =>
    getJson<{ match: Match; event: MatchEvent }>(
      `/api/matches/${id}/events`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) },
    ),
};
