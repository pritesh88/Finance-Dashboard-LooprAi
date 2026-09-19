import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// @testing-library's auto-cleanup only self-registers when vitest's globals are
// enabled; this project imports test APIs explicitly, so clean up the DOM here.
afterEach(() => {
  cleanup();
});
