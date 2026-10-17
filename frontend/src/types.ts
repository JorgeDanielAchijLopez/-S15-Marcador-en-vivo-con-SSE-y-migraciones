export type MatchStatus = 'PROGRAMADO' | 'EN_JUEGO' | 'FINALIZADO';
export type EventType = 'GOAL' | 'FOUL' | 'SUBSTITUTION';
export type TeamSide = 'HOME' | 'AWAY';

export interface Match {
  id: number;
  homeTeam: string;
  awayTeam: string;
  status: MatchStatus;
  homeScore: number;
  awayScore: number;
}
export interface MatchEvent {
  id: number;
  matchId: number;
  minute: number;
  type: EventType;
  team: TeamSide;
  player: string | null;
  description: string;
  createdAt: string;
}
export interface MatchDetail { match: Match; events: MatchEvent[] }
export interface EventForm {
  type: EventType;
  team: TeamSide;
  minute: number;
  player: string;
  description: string;
}
