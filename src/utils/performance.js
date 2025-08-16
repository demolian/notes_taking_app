// Performance monitoring utilities

// Measure component render time
export const measureRenderTime = (componentName, renderFunction) => {
  if (process.env.NODE_ENV === 'development') {
    const startTime = performance.now();
    const result = renderFunction();
    const endTime = performance.now();
    console.log(`${componentName} render time: ${endTime - startTime} milliseconds`);
    return result;
  }
  return renderFunction();
};

// Debounce function for performance optimization
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Throttle function for performance optimization
export const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Memory usage monitoring (development only)
export const logMemoryUsage = () => {
  if (process.env.NODE_ENV === 'development' && performance.memory) {
    console.log('Memory Usage:', {
      used: Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB',
      total: Math.round(performance.memory.totalJSHeapSize / 1048576) + ' MB',
      limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576) + ' MB'
    });
  }
};