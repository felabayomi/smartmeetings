import React from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Camera, PenLine } from 'lucide-react';
import { motion } from 'framer-motion';

interface AddMeetingChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: () => void;
  onManual: () => void;
}

export function AddMeetingChoiceModal({ isOpen, onClose, onScan, onManual }: AddMeetingChoiceModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden bg-card border border-border shadow-2xl rounded-2xl">
        <DialogTitle className="sr-only">Add a Meeting</DialogTitle>
        <DialogDescription className="sr-only">Choose how to add your meeting</DialogDescription>

        <div className="p-6 space-y-4">
          <div className="text-center mb-6">
            <h2 className="text-xl font-display font-bold text-foreground">Add a Meeting</h2>
            <p className="text-muted-foreground text-sm mt-1">How would you like to add it?</p>
          </div>

          {/* Scan option */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.01 }}
            onClick={() => { onClose(); onScan(); }}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 transition-all text-left group"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
              <Camera className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Scan Image</p>
              <p className="text-sm text-muted-foreground">Upload a screenshot or invite — AI fills in the details</p>
            </div>
          </motion.button>

          {/* Manual option */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.01 }}
            onClick={() => { onClose(); onManual(); }}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-border hover:border-primary/20 hover:bg-muted/50 transition-all text-left group"
          >
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 group-hover:bg-muted/70 transition-colors">
              <PenLine className="w-6 h-6 text-foreground/70" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Enter Manually</p>
              <p className="text-sm text-muted-foreground">Type in the meeting title, time, and details yourself</p>
            </div>
          </motion.button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
