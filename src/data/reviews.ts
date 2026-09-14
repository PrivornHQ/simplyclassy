export const MAX_REVIEW_WORDS = 80;
export const MAX_REVIEW_IMAGES = 4;
export const MAX_REVIEW_NAME_CHARS = 60;
export const MAX_REVIEW_LOCATION_CHARS = 80;

export type CustomerReview = {
  id: string;
  name?: string;
  location?: string;
  text: string;
  rating: number;
  imageUrls: string[];
  createdAt: string;
};

export function countReviewWords(value: string): number {
  const words = value.trim().match(/\S+/g);
  return words ? words.length : 0;
}
