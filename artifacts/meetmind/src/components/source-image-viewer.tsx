import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { AlertCircle, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = { meetingId: number; iconOnly?: boolean; color?: string };

export function SourceImageViewer({
  meetingId,
  iconOnly = false,
  color,
}: Props) {
  const { getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const token = await getToken();
        const response = await fetch(
          `/api/meetings/${meetingId}/source-image`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          },
        );
        if (!response.ok)
          throw new Error("The original scanned image could not be loaded.");
        objectUrl = URL.createObjectURL(await response.blob());
        if (cancelled) URL.revokeObjectURL(objectUrl);
        else setImageUrl(objectUrl);
      } catch (reason) {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : "The original scanned image could not be loaded.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [getToken, meetingId, open]);

  return (
    <>
      {iconOnly ? (
        <button
          type="button"
          aria-label="View original scanned image"
          title="View original scanned image"
          onClick={(event) => {
            event.stopPropagation();
            setOpen(true);
          }}
          className="h-8 w-8 rounded-lg grid place-items-center hover:bg-background/80"
          style={{ color }}
        >
          <ImageIcon className="h-4 w-4" />
        </button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-xl"
          onClick={() => setOpen(true)}
        >
          <ImageIcon className="mr-2 h-4 w-4" />
          View original scanned image
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-3xl max-h-[92dvh] overflow-hidden flex flex-col">
          <DialogTitle>Original scanned image</DialogTitle>
          <DialogDescription>
            Private source image used to create this meeting. Only your
            signed-in account can retrieve it.
          </DialogDescription>
          <div className="min-h-56 flex-1 overflow-auto rounded-xl bg-muted/40 grid place-items-center p-3">
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : error ? (
              <div className="text-center text-destructive">
                <AlertCircle className="mx-auto h-8 w-8" />
                <p className="mt-2">{error}</p>
              </div>
            ) : imageUrl ? (
              <img
                src={imageUrl}
                alt="Original meeting scan"
                className="max-h-[70dvh] max-w-full object-contain rounded-lg"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
