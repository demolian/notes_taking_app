import React, { useState, memo } from 'react';
import { FaCopy, FaCheck } from 'react-icons/fa';

const CodeCopyButton = memo(({ code, className = '' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      
      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
      
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = code;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
      
      document.body.removeChild(textArea);
    }
  };

  return (
    <button
      className={`code-copy-button ${className} ${copied ? 'copied' : ''}`}
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy code'}
      aria-label={copied ? 'Code copied to clipboard' : 'Copy code to clipboard'}
    >
      {copied ? <FaCheck /> : <FaCopy />}
      <span className="copy-text">{copied ? 'Copied!' : 'Copy'}</span>
    </button>
  );
});

CodeCopyButton.displayName = 'CodeCopyButton';

export default CodeCopyButton;