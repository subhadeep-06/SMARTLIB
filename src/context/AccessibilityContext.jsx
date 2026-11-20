import React, { createContext, useContext, useEffect, useState } from 'react';

const AccessibilityContext = createContext(null);

export function AccessibilityProvider({ children }) {
  const [fontScale, setFontScale] = useState(
    () => localStorage.getItem('smartlib_font_scale') || 'md'
  );
  const [highContrast, setHighContrast] = useState(
    () => localStorage.getItem('smartlib_high_contrast') === 'true'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-font-scale', fontScale);
    localStorage.setItem('smartlib_font_scale', fontScale);
  }, [fontScale]);

  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', highContrast);
    localStorage.setItem('smartlib_high_contrast', String(highContrast));
  }, [highContrast]);

  return (
    <AccessibilityContext.Provider
      value={{ fontScale, setFontScale, highContrast, setHighContrast }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error('useAccessibility must be used inside AccessibilityProvider');
  return ctx;
}
