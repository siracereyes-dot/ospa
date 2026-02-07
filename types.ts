
export enum Level {
  NATIONAL = 'National',
  REGIONAL = 'Regional',
  DIVISION = 'Division',
  DISTRICT = 'District',
  SCHOOL = 'School'
}

export enum Rank {
  FIRST = '1st',
  SECOND = '2nd',
  THIRD = '3rd',
  FOURTH = '4th',
  FIFTH = '5th',
  SIXTH = '6th',
  SEVENTH = '7th'
}

export enum Position {
  PRESIDENT = 'President',
  VICE_PRESIDENT = 'Vice President',
  OTHER = 'Other positions'
}

export interface RatingEntry {
  year: string;
  score: number;
}

export interface Achievement {
  id: string;
  level: Level;
  rank: Rank;
  year: string;
  points: number;
}

export interface LeadershipEntry {
  id: string;
  level: Level;
  position: Position;
  points: number;
}

export interface ServiceEntry {
  id: string;
  level: Level;
  points: number;
}

export interface InterviewScores {
  principles: number;
  leadership: number;
  engagement: number;
  commitment: number;
  communication: number;
}

export interface MOVFile {
  name: string;
  data: string;
  mimeType: string;
}

export interface OSPAScoreState {
  candidateName: string;
  division: string;
  schoolName: string;
  movFile: MOVFile | null;
  performanceRatings: RatingEntry[];
  individualContests: Achievement[];
  groupContests: Achievement[];
  specialAwards: Achievement[];
  publicationContests: Achievement[];
  leadership: LeadershipEntry[];
  extensionServices: ServiceEntry[];
  innovations: ServiceEntry[];
  speakership: ServiceEntry[];
  publishedBooks: ServiceEntry[];
  publishedArticles: ServiceEntry[];
  interview: InterviewScores;
}
