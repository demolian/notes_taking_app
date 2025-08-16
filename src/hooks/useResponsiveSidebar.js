import { useState, useEffect, useCallback } from 'react';

export const useResponsiveSidebar = (autoHideDelay = 5000) => {
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [autoHideTimer, setAutoHideTimer] = useState(null);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      
      // On desktop, always show sidebar
      if (!mobile) {
        setIsSidebarVisible(true);
        if (autoHideTimer) {
          clearTimeout(autoHideTimer);
          setAutoHideTimer(null);
        }
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      if (autoHideTimer) {
        clearTimeout(autoHideTimer);
      }
    };
  }, [autoHideTimer]);

  // Auto-hide sidebar on mobile after inactivity
  const resetAutoHideTimer = useCallback(() => {
    if (!isMobile) return;

    // Clear existing timer
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
    }

    // Show sidebar
    setIsSidebarVisible(true);

    // Set new timer to hide sidebar
    const newTimer = setTimeout(() => {
      setIsSidebarVisible(false);
    }, autoHideDelay);

    setAutoHideTimer(newTimer);
  }, [isMobile, autoHideDelay, autoHideTimer]);

  // Manual toggle
  const toggleSidebar = useCallback(() => {
    setIsSidebarVisible(prev => !prev);
    
    // Reset auto-hide timer when manually toggling
    if (isMobile) {
      resetAutoHideTimer();
    }
  }, [isMobile, resetAutoHideTimer]);

  // Show sidebar temporarily
  const showSidebarTemporarily = useCallback(() => {
    if (isMobile) {
      resetAutoHideTimer();
    }
  }, [isMobile, resetAutoHideTimer]);

  // Handle user activity to reset timer
  useEffect(() => {
    if (!isMobile) return;

    const handleActivity = () => {
      resetAutoHideTimer();
    };

    // Listen for user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial timer setup
    resetAutoHideTimer();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [isMobile, resetAutoHideTimer]);

  return {
    isSidebarVisible,
    isMobile,
    toggleSidebar,
    showSidebarTemporarily,
    resetAutoHideTimer
  };
};