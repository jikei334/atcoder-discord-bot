export type ContestType = 'ABC' | 'ARC' | 'AGC' | 'AHC-Short' | 'AHC-Long' | 'AWC' | 'Other';

export interface Contest {
  id: string;
  title: string;
  start_epoch_second: number;
  duration_second: number;
  rate_change: string;
}

export interface AuthUser {
  userId: string;
  displayName: string;
  avatarUrl: string;
}

export interface ReportRecord {
  id: string;
  discordUserId: string;
  discordDisplayName: string;
  contestId: string;
  contestName: string;
  contestType: ContestType;
  contestStartDate: string;
  solvedProblems: string[];
  comment: string;
  reportedAt: string;
}

export interface AddReportInput {
  contestName: string;
  contestId: string;
  contestType: string;
  contestStartDate: string;
  solvedProblems: string[];
  comment: string;
}
