
import { Level, Rank, Position } from './types';

export const SCORING_RUBRIC = {
  INDIVIDUAL: {
    [Level.NATIONAL]: { '1st': 20, '2nd': 19, '3rd': 18, '4th': 17, '5th': 16, '6th': 15, '7th': 14, weight: 0.08 },
    [Level.REGIONAL]: { '1st': 12, '2nd': 11, '3rd': 10, weight: 0.05 },
    [Level.DIVISION]: { '1st': 7, '2nd': 6, '3rd': 5, weight: 0.03 }
  },
  GROUP: {
    [Level.NATIONAL]: { '1st': 20, '2nd': 19, '3rd': 18, '4th': 17, '5th': 16, '6th': 15, '7th': 14, weight: 0.08 },
    [Level.REGIONAL]: { '1st': 12, '2nd': 11, '3rd': 10, weight: 0.05 },
    [Level.DIVISION]: { '1st': 7, '2nd': 6, '3rd': 5, weight: 0.03 }
  },
  SPECIAL_AWARDS: {
    [Level.NATIONAL]: { '1st': 15, '2nd': 14, '3rd': 13, '4th': 12, '5th': 11, '6th': 10, '7th': 9, weight: 0.03 },
    [Level.REGIONAL]: { '1st': 7, '2nd': 6, '3rd': 5, weight: 0.02 },
    [Level.DIVISION]: { '1st': 4, '2nd': 3, '3rd': 2, weight: 0.01 }
  },
  PUBLICATION: {
    [Level.NATIONAL]: { '1st': 13, '2nd': 12, '3rd': 11, '4th': 10, '5th': 9, '6th': 8, '7th': 7, weight: 0.06 },
    [Level.REGIONAL]: { '1st': 6, '2nd': 5, '3rd': 4, weight: 0.03 },
    [Level.DIVISION]: { '1st': 3, '2nd': 2, '3rd': 1, weight: 0.02 }
  },
  LEADERSHIP: {
    [Level.NATIONAL]: { [Position.PRESIDENT]: 25, [Position.VICE_PRESIDENT]: 20, [Position.OTHER]: 18 },
    [Level.REGIONAL]: { [Position.PRESIDENT]: 20, [Position.VICE_PRESIDENT]: 15, [Position.OTHER]: 12 },
    [Level.DIVISION]: { [Position.PRESIDENT]: 15, [Position.VICE_PRESIDENT]: 10, [Position.OTHER]: 8 },
    weight: 0.13
  },
  EXTENSION: {
    [Level.NATIONAL]: 10, [Level.REGIONAL]: 7, [Level.DIVISION]: 5, weight: 0.13
  },
  INNOVATIONS: {
    [Level.NATIONAL]: 15, [Level.REGIONAL]: 12, [Level.DIVISION]: 10, [Level.DISTRICT]: 8, [Level.SCHOOL]: 6, weight: 0.13
  },
  SPEAKERSHIP: {
    [Level.NATIONAL]: 10, [Level.REGIONAL]: 7, [Level.DIVISION]: 5, weight: 0.10
  },
  BOOKS: {
    [Level.NATIONAL]: 10, [Level.REGIONAL]: 7, [Level.DIVISION]: 5, weight: 0.05
  },
  ARTICLES: {
    [Level.NATIONAL]: 5, [Level.REGIONAL]: 3, [Level.DIVISION]: 1, weight: 0.05
  }
};
