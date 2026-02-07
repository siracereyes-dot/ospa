
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

export enum PublicationPosition {
  EIC = 'Editor in Chief',
  ASSOC = 'Associate Editor',
  SECTION = 'Section Editor',
  WRITER = 'Writer/Contributor/Others'
}

export enum AcademicRank {
  HIGHEST = 'With Highest Honors',
  HIGH = 'With High Honors',
  HONORS = 'With Honors',
  AVERAGE = '89-85 Average',
  NONE = 'None'
}

export enum NominationType {
  ADVISER = 'Outstanding School Paper Adviser',
  JOURNALIST = 'Outstanding Campus Journalist'
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
  nominationType: NominationType;
  candidateName: string;
  division: string;
  schoolName: string;
  movFile: MOVFile | null;
  // Shared but logic differs
  performanceRatings: RatingEntry[]; // Used as Mean for Adviser, not used for Journalist (Journalist uses AcademicRank)
  academicRank: AcademicRank; 
  individualContests: Achievement[];
  groupContests: Achievement[];
  specialAwards: Achievement[];
  publicationContests: Achievement[];
  // Journalist specific leadership
  pubPosition: PublicationPosition;
  leadership: LeadershipEntry[]; // Guild Leadership
  innovations: ServiceEntry[];
  // Journalist specific others
  extensionServices: ServiceEntry[];
  publishedWorks: ServiceEntry[];
  trainingsAttended: ServiceEntry[];
  // Shared
  interview: InterviewScores;
  // Adviser specific
  speakership: ServiceEntry[];
  publishedBooks: ServiceEntry[];
  publishedArticles: ServiceEntry[];
}
