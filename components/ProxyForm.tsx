'use client';

import { useState, FormEvent, useRef } from 'react';
import styles from './ProxyForm.module.css';

interface ProxyFormProps {
  onRequest: (url: string) => void;
}

const ProxyForm = ({ onRequest }: ProxyFormProps) => {
  const [inputValue, setInputValue] = useState('');
  const [isValid, setIsValid] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateUrl = (urlString: string): boolean => {
    if (!urlString.trim()) return false;
    try {
      const url = urlString.startsWith('http') ? urlString : `https://${urlString}`;
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateUrl(inputValue)) {
      setIsValid(false);
      inputRef.current?.focus();
      return;
    }

    setIsValid(true);
    const urlToProxy = inputValue.startsWith('http')
      ? inputValue
      : `https://${inputValue}`;

    onRequest(urlToProxy);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (!isValid && e.target.value) {
      setIsValid(validateUrl(e.target.value));
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.inputGroup}>
        <label htmlFor="url-input" className={styles.label}>
          Enter Website URL
        </label>
        <div className={styles.inputWrapper}>
          <input
            ref={inputRef}
            id="url-input"
            type="text"
            className={`${styles.input} ${!isValid ? styles.invalid : ''}`}
            placeholder="example.com or https://example.com"
            value={inputValue}
            onChange={handleInputChange}
            aria-invalid={!isValid}
            aria-describedby={!isValid ? 'url-error' : undefined}
            autoComplete="off"
            spellCheck="false"
          />
          <button
            type="submit"
            className={styles.button}
            aria-label="Load website in proxy"
          >
            <span className={styles.buttonText}>Go</span>
          </button>
        </div>
      </div>

      {!isValid && (
        <div
          id="url-error"
          className={styles.errorMessage}
          role="alert"
          aria-live="polite"
        >
          Please enter a valid URL (e.g., example.com)
        </div>
      )}
    </form>
  );
};

export default ProxyForm;