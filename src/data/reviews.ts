export const MAX_REVIEW_WORDS = 80;
export const MAX_REVIEW_IMAGES = 4;

export type CustomerReview = {
  id: string;
  text: string;
  rating: number;
  imageUrls: string[];
  createdAt: string;
};

export function countReviewWords(value: string): number {
  const words = value.trim().match(/\S+/g);
  return words ? words.length : 0;
}
