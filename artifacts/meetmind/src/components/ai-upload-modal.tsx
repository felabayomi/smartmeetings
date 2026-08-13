import React, { useState, useRef } from 'react';
import { APP_TZ } from '@/lib/timezone';
import { useExtractMeetingFromImage } from '@workspace/api-client-react';
import { Upload, Loader2, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AiUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExtracted: (data: any) => void;
}

export function AiUploadModal({ isOpen, onClose, onExtracted }: AiUploadModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const extractMutation = useExtractMeetingFromImage({
    mutation: {
      onSuccess: (data) => {
        const count = Array.isArray((data as any)?.meetings) ? (data as any).meetings.length : 1;
        toast({
          title: `${count} meeting${count === 1 ? "" : "s"} found`,
          description: count === 1 ? "Review the details below." : "Review and save each meeting separately.",
        });
        onExtracted(data);
        reset();
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Extraction failed", description: err.message || "Could not read the image." });
        setPreviewUrl(null);
      }
    }
  });

  const reset = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ variant: "destructive", title: "Invalid file", description: "Please upload an image file." });
      return;
    }

    // Create preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      // Convert to Base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // remove data:image/...;base64,
        };
        reader.onerror = error => reject(error);
      });

      // Send to API
      extractMutation.mutate({
        data: {
          imageBase64: base64,
          mimeType: file.type,
          userTimezone: APP_TZ,
        }
      });
    } catch (e) {
      toast({ variant: "destructive", title: "Error reading file", description: "Please try again." });
      setPreviewUrl(null);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !extractMutation.isPending && reset()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-card border-border rounded-3xl shadow-2xl">
        {/* Hidden title for accessibility */}
        <DialogTitle className="sr-only">Upload Meeting Screenshot</DialogTitle>
        <DialogDescription className="sr-only">Upload an image of an invite or calendar to automatically extract meeting details.</DialogDescription>
        
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-6 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent/20 rounded-full blur-2xl" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-primary/20 rounded-full blur-2xl" />
          
          <div className="w-16 h-16 rounded-full bg-white dark:bg-zinc-900 shadow-xl flex items-center justify-center mb-4 relative z-10">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground relative z-10">AI Meeting Scanner</h2>
          <p className="text-muted-foreground mt-2 text-sm max-w-xs relative z-10">
            Upload an invite, email, or schedule screenshot. MeetMind will extract the details automatically.
          </p>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {!previewUrl ? (
              <motion.div
                key="upload"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <label
                  htmlFor="meeting-image-upload"
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 block",
                    isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                >
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground text-lg mb-1">Tap to choose image</h3>
                  <p className="text-sm text-muted-foreground">PNG, JPG, HEIC, screenshots — all supported</p>
                </label>
                <input
                  id="meeting-image-upload"
                  type="file"
                  className="sr-only"
                  accept="image/*,image/heic,image/heif"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </motion.div>
            ) : (
              <motion.div
                key="preview"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative rounded-2xl overflow-hidden border border-border bg-black/5 flex flex-col items-center justify-center min-h-[250px]"
              >
                <img src={previewUrl} alt="Preview" className="w-full h-full object-contain max-h-[300px] opacity-50 blur-sm transition-all" />
                
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-background/50 backdrop-blur-sm">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full border-4 border-primary/30 animate-ping" />
                    <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-2xl relative z-10">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                  </div>
                  <h3 className="font-display font-bold text-xl mt-6 text-foreground">Extracting Details...</h3>
                  <p className="text-sm text-muted-foreground mt-2 font-medium">Using AI to read time, location, and context</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
