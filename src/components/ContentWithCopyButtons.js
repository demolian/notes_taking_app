import React, { useEffect, useRef, memo } from 'react';
import CodeCopyButton from './CodeCopyButton';

const ContentWithCopyButtons = memo(({ htmlContent, className = '' }) => {
  const contentRef = useRef(null);

  useEffect(() => {
    if (!contentRef.current) return;

    // Find all code blocks and pre elements
    const codeElements = contentRef.current.querySelectorAll('pre, code, .ql-code-block');
    
    codeElements.forEach((element, index) => {
      // Skip if this element already has a copy button
      if (element.parentElement?.querySelector('.code-copy-wrapper')) return;
      
      // Get the text content of the code block
      const codeText = element.textContent || element.innerText || '';
      
      // Only add copy button if there's actual code content and it's substantial
      if (codeText.trim().length > 10) {
        // Create wrapper div
        const wrapper = document.createElement('div');
        wrapper.className = 'code-copy-wrapper';
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';
        wrapper.style.width = '100%';
        
        // Insert wrapper before the code element
        element.parentNode.insertBefore(wrapper, element);
        
        // Move code element into wrapper
        wrapper.appendChild(element);
        
        // Create copy button container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'copy-button-container';
        buttonContainer.style.position = 'absolute';
        buttonContainer.style.top = '8px';
        buttonContainer.style.right = '8px';
        buttonContainer.style.zIndex = '10';
        
        // Create and render React copy button
        const copyButton = document.createElement('div');
        copyButton.id = `copy-button-${index}`;
        buttonContainer.appendChild(copyButton);
        wrapper.appendChild(buttonContainer);
        
        // Render the React component into the button container
        import('react-dom/client').then(({ createRoot }) => {
          try {
            const root = createRoot(copyButton);
            root.render(React.createElement(CodeCopyButton, { 
              code: codeText,
              className: 'code-snippet-copy'
            }));
          } catch (error) {
            console.warn('Failed to render copy button:', error);
            // Fallback: create a simple button
            copyButton.innerHTML = `
              <button class="code-copy-button code-snippet-copy" onclick="navigator.clipboard.writeText('${codeText.replace(/'/g, "\\'")}')">
                Copy
              </button>
            `;
          }
        }).catch(error => {
          console.warn('Failed to load React DOM client:', error);
          // Fallback: create a simple button
          copyButton.innerHTML = `
            <button class="code-copy-button code-snippet-copy" onclick="navigator.clipboard.writeText('${codeText.replace(/'/g, "\\'")}')">
              Copy
            </button>
          `;
        });
      }
    });

    // Cleanup function
    return () => {
      if (contentRef.current) {
        const wrappers = contentRef.current.querySelectorAll('.code-copy-wrapper');
        wrappers.forEach(wrapper => {
          const codeElement = wrapper.querySelector('pre, code, .ql-code-block');
          if (codeElement && wrapper.parentNode) {
            wrapper.parentNode.insertBefore(codeElement, wrapper);
            wrapper.parentNode.removeChild(wrapper);
          }
        });
      }
    };
  }, [htmlContent]);

  return (
    <div 
      ref={contentRef}
      className={`content-with-copy ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
});

ContentWithCopyButtons.displayName = 'ContentWithCopyButtons';

export default ContentWithCopyButtons;