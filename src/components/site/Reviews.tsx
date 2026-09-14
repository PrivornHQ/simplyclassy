import { useMemo, useState, type ChangeEvent } from "react";
import { ImageUp, Star, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  countReviewWords,
  MAX_REVIEW_IMAGES,
  MAX_REVIEW_LOCATION_CHARS,
  MAX_REVIEW_NAME_CHARS,
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
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);
  const [images, setImages] = useState<ReviewImagePreview[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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

  const resetForm = () => {
    setName("");
    setLocation("");
    setText("");
    setRating(5);
    clearImages();
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

  const submitReview = async () => {
    if (!name.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    if (name.trim().length < 2) {
      toast.error("Name must be at least 2 characters.");
      return;
    }
    if (overLimit) {
      toast.error(`Review must be ${MAX_REVIEW_WORDS} words or fewer.`);
      return;
    }
    if (!text.trim()) {
      toast.error("Please write a short review.");
      return;
    }

    const form = new FormData();
    form.set("name", name.trim());
    form.set("location", location.trim());
    form.set("text", text.trim());
    form.set("rating", String(rating));
    for (const image of images) form.append("images", image.file);

    setSubmitting(true);
    try {
      const review = await submitCustomerReview({ data: form });
      setReviews((current) => [review, ...current]);
      resetForm();
      setOpen(false);
      setSuccessMessage("Thanks for sharing your review. It is now visible below.");
      toast.success("Thanks for your review.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't submit review.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="reviews" aria-labelledby="reviews-title" className="py-14 md:py-20">
      <div className="section-shell">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Reviews</p>
            <h2
              id="reviews-title"
              className="mt-2 text-3xl font-semibold text-foreground sm:text-4xl"
            >
              What SimplyClassy customers say
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Read real customer notes, then share your own experience when you are ready.
            </p>
            {successMessage && (
              <p className="mt-4 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground shadow-soft">
                {successMessage}
              </p>
            )}
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full">Leave a review</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">Leave a review</DialogTitle>
                <DialogDescription>
                  Share your SimplyClassy order experience. Use city or area only for location.
                </DialogDescription>
              </DialogHeader>

              <form
                className="space-y-5"
                onSubmit={async (event) => {
                  event.preventDefault();
                  await submitReview();
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="review-name">Name</Label>
                    <Input
                      id="review-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                      minLength={2}
                      maxLength={MAX_REVIEW_NAME_CHARS}
                      disabled={submitting}
                      autoComplete="name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="review-location">Location</Label>
                    <Input
                      id="review-location"
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                      maxLength={MAX_REVIEW_LOCATION_CHARS}
                      disabled={submitting}
                      autoComplete="address-level2"
                      placeholder="City or area"
                    />
                  </div>
                </div>

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
                            className={cn(
                              "size-6",
                              value <= rating ? "fill-current" : "fill-none",
                            )}
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

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitting}
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting || optimizing || overLimit}>
                    {submitting ? "Submitting..." : "Submit review"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedReviews.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground md:col-span-2 lg:col-span-3">
              Be the first to leave a SimplyClassy review.
            </div>
          ) : (
            sortedReviews.map((review) => <ReviewCard key={review.id} review={review} />)
          )}
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
  const reviewer = review.name?.trim() || "SimplyClassy customer";

  return (
    <figure className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <figcaption>
          <p className="text-sm font-semibold text-foreground">{reviewer}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {review.location ? `${review.location} - ${date}` : date}
          </p>
        </figcaption>
        <div
          className="flex shrink-0 gap-1 text-primary"
          aria-label={`${review.rating} out of 5 stars`}
        >
          {Array.from({ length: 5 }).map((_, index) => (
            <Star
              key={index}
              className={cn("size-4", index < review.rating ? "fill-current" : "fill-none")}
              aria-hidden
            />
          ))}
        </div>
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
