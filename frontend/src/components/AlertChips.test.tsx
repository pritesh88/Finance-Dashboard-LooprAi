import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material';
import { theme } from '../theme';
import { AlertProvider, useAlerts } from '../context/AlertContext';
import { AlertChips } from './AlertChips';

function Harness() {
  const { pushAlert } = useAlerts();
  return (
    <>
      <button onClick={() => pushAlert('error', 'Something went wrong')}>trigger error</button>
      <AlertChips />
    </>
  );
}

function renderHarness() {
  return render(
    <ThemeProvider theme={theme}>
      <AlertProvider>
        <Harness />
      </AlertProvider>
    </ThemeProvider>,
  );
}

describe('AlertChips', () => {
  it('renders nothing when there are no alerts', () => {
    renderHarness();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a pushed alert and removes it when dismissed', async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole('button', { name: /trigger error/i }));
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});
