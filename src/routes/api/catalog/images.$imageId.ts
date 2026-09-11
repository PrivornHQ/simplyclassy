import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/catalog/images/$imageId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { readProductImage } = await import("@/server/catalog-store.server");
        const image = await readProductImage(params.imageId);
        if (!image) {
          return new Response("Not found", { status: 404 });
        }
        return new Response(new Blob([image.data as BlobPart], { type: image.contentType }), {
          status: 200,
          headers: {
            "content-type": image.contentType,
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
