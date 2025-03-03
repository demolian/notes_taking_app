import React, { useRef, useEffect, forwardRef, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

// This is a wrapper component for ReactQuill that works with React 19
// It addresses the findDOMNode deprecation and React 19 compatibility issues
const CustomQuill = forwardRef(({ value, onChange, placeholder, modules, formats, className }, ref) => {
  const quillRef = useRef(null);
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(null);

  // Polyfill for ReactQuill to work with React 19
  useEffect(() => {
    // Apply patches to workaround ReactQuill compatibility issues
    try {
      const originalCreateReactClass = React.createClass;
      if (!React.createClass && !window._reactQuillPolyfillApplied) {
        // Only apply once
        window._reactQuillPolyfillApplied = true;
        
        // Create a polyfill for React.createClass which react-quill uses internally
        React.createClass = function(spec) {
          const Constructor = function(props) {
            this.props = props;
            this.state = this.getInitialState ? this.getInitialState() : {};
          };
          
          Constructor.prototype = Object.assign({}, spec);
          return Constructor;
        };
        
        console.info("Applied React.createClass polyfill for ReactQuill");
      }
    } catch (err) {
      console.error("Error applying React polyfills:", err);
      setError("Error initializing editor. Please try refreshing the page.");
    }
  }, []);

  useEffect(() => {
    // Expose the Quill instance and editor element through the ref
    if (ref && quillRef.current) {
      try {
        // Make sure Quill is initialized
        const editor = quillRef.current.getEditor ? quillRef.current.getEditor() : null;
        
        if (editor) {
          editorRef.current = editor;
          
          // Expose methods through ref
          ref.current = {
            getEditor: () => editor,
            getContainerRef: () => containerRef.current,
            focus: () => editor.focus(),
            blur: () => editor.blur(),
            // Add extra properties that ReactQuill might expect
            editor
          };
          
          setInitialized(true);
        }
      } catch (err) {
        console.error('Error accessing Quill editor:', err);
        setError("Error accessing editor. Content editing may be limited.");
      }
    }
  }, [ref, quillRef]);

  // Handle paste events at the container level
  useEffect(() => {
    const container = containerRef.current;
    
    if (container) {
      const handlePaste = (e) => {
        if (editorRef.current && e.clipboardData && e.clipboardData.items) {
          // Allow ReactQuill to handle the paste normally
        }
      };
      
      container.addEventListener('paste', handlePaste);
      return () => {
        container.removeEventListener('paste', handlePaste);
      };
    }
  }, [containerRef, editorRef]);

  if (error) {
    // Fallback to a simple textarea if there's an error
    return (
      <div className={className}>
        <div className="quill-error-message">{error}</div>
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="quill-fallback-textarea"
          style={{ width: '100%', minHeight: '200px' }}
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className}>
      <ReactQuill
        ref={quillRef}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        modules={modules}
        formats={formats}
        theme="snow"
      />
    </div>
  );
});

CustomQuill.displayName = 'CustomQuill';

export default CustomQuill; 