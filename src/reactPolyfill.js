// reactPolyfill.js - Provides compatibility for older React libraries with React 19
import React from 'react';
import ReactDOMClient from 'react-dom/client';
import ReactDOM from 'react-dom';

// Export a compatibility layer for findDOMNode
const patchReactDOM = () => {
  // Use the appropriate ReactDOM object
  const reactDOMToFix = ReactDOM.default || ReactDOM;
  
  // Only add the polyfill if it's missing
  if (!reactDOMToFix.findDOMNode) {
    // console.log('Applying findDOMNode polyfill for React 19 compatibility');
    
    reactDOMToFix.findDOMNode = function(component) {
      // Handle null values
      if (!component) return null;
      
      // Handle refs
      if (component.current) {
        return component.current;
      }
      
      // Handle DOM nodes directly
      if (component.nodeType) {
        return component;
      }
      
      // Handle React components
      if (component._reactInternals) {
        return component._reactInternals.stateNode;
      }
      
      // Try React 19's internal structure (might change)
      if (component.__reactFiber$) {
        const key = Object.keys(component).find(key => key.startsWith('__reactFiber$'));
        if (key) {
          return component[key].stateNode;
        }
      }
      
      // Fallback - for compatibility, don't throw
      console.warn('findDOMNode polyfill could not find DOM node for', component);
      return null;
    };
  }
};

// Apply the patch immediately
patchReactDOM();

export default { patchReactDOM }; 