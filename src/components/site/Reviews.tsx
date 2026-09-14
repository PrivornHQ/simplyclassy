import { useMemo, useState, type ChangeEvent } from "react";
import { ImageUp, Star, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  countReviewWords,
  MAX_REVIEW_IMAGES,
  MAX_REVIEW_WORDS,
  type CustomerReview,
} from "@/data/reviews";
import { optimizeReviewImage } from "@/lib/optimize-review-image";
import { submitCustomerReview } from "@/lib/review.functions";
import { cn } from "@/lib/utils";

type ReviewImagePreview = {
  file: File;
  url: string;
};

export function Reviews({ initialReviews }: { initialReviews: CustomerReview[] }) {
  const [reviews, setReviews] = useState(initialReviews);
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);
  const [images, setImages] = useState<ReviewImagePreview[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const wordCount = countReviewWords(text);
  const wordsRemaining = MAX_REVIEW_WORDS - wordCount;
  const overLimit = wordsRemaining < 0;

  const sortedReviews = useMemo(
    () => [...reviews].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [reviews],
  );

  const clearImages = () => {
    for (const image of images) URL.revokeObjectURL(image.url);
    setImages([]);
  };

  const handleImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selected.length === 0) return;

    const remainingSlots = MAX_REVIEW_IMAGES - images.length;
    if (remainingSlots <= 0) {
      toast.error(`You can upload up to ${MAX_REVIEW_IMAGES} review images.`);
      return;
    }

    const nextFiles = selected.slice(0, remainingSlots);
    if (selected.length > remainingSlots) {
      toast.message(`Only ${remainingSlots} more image${remainingSlots === 1 ? "" : "s"} added.`);
    }

    setOptimizing(true);
    try {
      const optimized = await Promise.all(nextFiles.map((file) => optimizeReviewImage(file)));
      setImages((current) => [
        ...current,
        ...optimized.map((file) => ({
          file,
          url: URL.createObjectURL(file),
        })),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't prepare those images.");
    } finally {
      setOptimizing(false);
    }
  };

  const removeImage = (url: string) => {
    setImages((current) => {
      const next = current.filter((image) => image.url !== url);
      const removed = current.find((image) => image.url === url);
      if (removed) URL.revokeObjectURL(removed.url);
      return next;
    });
  };

  return (
    <section id="reviews" aria-labelledby="reviews-title" className="py-14 md:py-20">
      <div className="section-shell">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="eyebrow">Reviews</p>
            <h2
              id="reviews-title"
              className="mt-2 text-3xl font-semibold text-foreground sm:text-4xl"
            >
              What SimplyClassy customers say
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Share a quick note about your order and add photos if you want to show how it arrived.
            </p>

            <form
              className="mt-6 space-y-5 rounded-xl border border-border bg-card p-5 shadow-soft sm:p-6"
              onSubmit={async (event) => {
                event.preventDefault();
                if (overLimit) {
                  toast.error(`Review must be ${MAX_REVIEW_WORDS} words or fewer.`);
                  return;
                }
                if (!text.trim()) {
                  toast.error("Please write a short review.");
                  return;
                }

                const form = new FormData();
                form.set("text", text.trim());
                form.set("rating", String(rating));
                for (const image of images) form.append("images", image.file);

                setSubmitting(true);
                try {
                  const review = await submitCustomerReview({ data: form });
                  setReviews((current) => [review, ...current]);
                  setText("");
                  setRating(5);
                  clearImages();
                  toast.success("Thanks for your review.");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Couldn't submit review.");
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              <div className="space-y-2">
                <Label>Star rating</Label>
                <div className="flex gap-1" aria-label={`${rating} out of 5 stars selected`}>
                  {Array.from({ length: 5 }).map((_, index) => {
                    const value = index + 1;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRating(value)}
                        disabled={submitting}
                        aria-label={`${value} star${value === 1 ? "" : "s"}`}
                        className="rounded-md p-1 text-primary transition hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <Star
                          className={cn("size-6", value <= rating ? "fill-current" : "fill-none")}
                          aria-hidden
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="review-text">Review text</Label>
                  <span
                    className={cn(
                      "text-xs",
                      overLimit ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {Math.max(0, wordsRemaining)} words left
                  </span>
                </div>
                <Textarea
                  id="review-text"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  disabled={submitting}
                  required
                  rows={5}
                  className="resize-none"
                />
                {overLimit && (
                  <p className="text-sm text-destructive">
                    Shorten your review to {MAX_REVIEW_WORDS} words before submitting.
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Label htmlFor="review-images">Purchase photos</Label>
                  <span className="text-xs text-muted-foreground">
                    Optional, up to {MAX_REVIEW_IMAGES}
                  </span>
                </div>
                {images.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {images.map((image) => (
                      <div
                        key={image.url}
                        className="relative overflow-hidden rounded-lg border border-border bg-muted"
                      >
                        <img
                          src={image.url}
                          alt="Selected review upload"
                          className="aspect-square w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(image.url)}
                          disabled={submitting}
                          aria-label="Remove image"
                          className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft"
                        >
                          <X className="size-4" aria-hidden />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <Input
                    id="review-images"
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={submitting || optimizing || images.length >= MAX_REVIEW_IMAGES}
                    onChange={handleImages}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitting || optimizing || images.length >= MAX_REVIEW_IMAGES}
                    onClick={() => document.getElementById("review-images")?.click()}
                  >
                    <ImageUp className="size-4" aria-hidden />
                    {optimizing ? "Preparing..." : "Add photos"}
                  </Button>
                </div>
              </div>

              <Button type="submit" disabled={submitting || optimizing || overLimit}>
                {submitting ? "Submitting..." : "Submit review"}
              </Button>
            </form>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
            {sortedReviews.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
                Be the first to leave a SimplyClassy review.
              </div>
            ) : (
              sortedReviews.map((review) => <ReviewCard key={review.id} review={review} />)
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ReviewCard({ review }: { review: CustomerReview }) {
  const date = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(review.createdAt));

  return (
    <figure className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1 text-primary" aria-label={`${review.rating} out of 5 stars`}>
          {Array.from({ length: 5 }).map((_, index) => (
            <Star
              key={index}
              className={cn("size-4", index < review.rating ? "fill-current" : "fill-none")}
              aria-hidden
            />
          ))}
        </div>
        <figcaption className="text-xs text-muted-foreground">{date}</figcaption>
      </div>
      <blockquote className="mt-3 text-sm leading-6 text-muted-foreground">
        "{review.text}"
      </blockquote>
      {review.imageUrls.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {review.imageUrls.map((url) => (
            <img
              key={url}
              src={url}
              alt="Customer purchase photo"
              loading="lazy"
              decoding="async"
              className="aspect-square w-full rounded-lg object-cover"
            />
          ))}
        </div>
      )}
    </figure>
  );
}
