import React from 'react';
import { Link, useLocation } from 'wouter';
import { Calendar as CalendarIcon, List, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface LayoutProps {
  children: React.ReactNode;
}

function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/icon-192.png"
      alt="Logo"
      className={cn("rounded-xl object-cover", className)}
    />
  );
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navItems = [
    { path: '/', label: 'Calendar', icon: CalendarIcon },
    { path: '/list', label: 'All Meetings', icon: List },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row font-sans">
      {/* Mobile Header */}
      <div className="md:hidden glass-panel sticky top-0 z-50 flex items-center justify-between p-4">
        <Logo className="w-9 h-9 shadow-lg shadow-primary/20" />
        <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)}>
          <Menu className="w-6 h-6" />
        </Button>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-3/4 max-w-sm bg-card z-50 p-6 flex flex-col shadow-2xl border-r border-border md:hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <Logo className="w-10 h-10" />
                <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <nav className="flex-1 space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.path;
                  return (
                    <Link key={item.path} href={item.path} className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium",
                      isActive 
                        ? "bg-primary/10 text-primary" 
                        : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                    )} onClick={() => setMobileMenuOpen(false)}>
                      <Icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-72 flex-col border-r border-border/50 bg-card/50 backdrop-blur-xl p-6 sticky top-0 h-screen">
        <div className="flex items-center gap-3 mb-12 px-2">
          <Logo className="w-12 h-12 shadow-lg shadow-primary/20" />
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            return (
              <Link key={item.path} href={item.path} className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-medium group relative overflow-hidden",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}>
                {isActive && (
                  <motion.div 
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-primary z-0 rounded-xl"
                    initial={false}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <Icon className={cn("w-5 h-5 relative z-10", isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground")} />
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 border-t border-border/50">
          <div className="glass-card rounded-xl p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">AI Assistant Ready</p>
            <p className="text-xs">Upload screenshots to auto-create meetings instantly.</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 w-full min-h-screen relative overflow-x-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none -z-10" />
        <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-accent/5 blur-[120px] pointer-events-none -z-10" />
        
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
