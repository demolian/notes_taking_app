import React, { useRef, useEffect, forwardRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

// This is a wrapper component for ReactQuill that works with React 19
// It addresses the findDOMNode deprecation by using refs
const CustomQuill = forwardRef(({ value, onChange, placeholder, modules, formats, className }, ref) => {
  const quillRef = useRef(null);
  const containerRef = useRef(null);
  const editorRef = useRef(null);

  useEffect(() => {
    // Expose the Quill instance and editor element through the ref
    if (ref && quillRef.current) {
      // Store a reference to the editor for the polyfill to use
      try {
        const editor = quillRef.current.getEditor();
        if (editor) {
          editorRef.current = editor;
          
          // Expose methods through ref
          ref.current = {
            getEditor: () => editor,
            getContainerRef: () => containerRef.current,
            // Add extra properties that ReactQuill might expect
            editor
          };
        }
      } catch (err) {
        console.error('Error accessing Quill editor:', err);
      }
    }
  }, [ref, quillRef]);

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