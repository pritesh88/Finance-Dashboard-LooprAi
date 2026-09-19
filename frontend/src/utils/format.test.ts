import { describe, expect, it } from 'vitest';
import { formatCurrency, formatMonth, formatPercent, initialsFor } from './format';

describe('formatCurrency', () => {
  it('formats a number as USD by default', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });
});

describe('formatMonth', () => {
  it('turns a YYYY-MM key into a short month/year label', () => {
    expect(formatMonth('2024-01')).toBe('Jan 2024');
    expect(formatMonth('2024-12')).toBe('Dec 2024');
  });
});

describe('formatPercent', () => {
  it('renders a fraction as a one-decimal percentage', () => {
    expect(formatPercent(0.6219)).toBe('62.2%');
    expect(formatPercent(0)).toBe('0.0%');
  });
});

describe('initialsFor', () => {
  it('derives U + last digit for user_00N ids', () => {
    expect(initialsFor('user_001')).toBe('U1');
    expect(initialsFor('user_004')).toBe('U4');
  });

  it('derives two letters from a full name', () => {
    expect(initialsFor('Financial Analyst')).toBe('FA');
  });
});
