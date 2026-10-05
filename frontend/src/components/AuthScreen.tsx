import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';

export default function AuthScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await login(email, password);
      else await signup(name, email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const isLogin = mode === 'login';
  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit} noValidate>
        <h1>Hourglass</h1>
        <p className="muted">{isLogin ? 'Sign in to book and manage your visits.' : 'Create an account to start booking.'}</p>

        {!isLogin && (
          <label>Name
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </label>
        )}
        <label>Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label>Password
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
            autoComplete={isLogin ? 'current-password' : 'new-password'} minLength={8}
          />
          {!isLogin && <small className="muted">At least 8 characters.</small>}
        </label>

        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}</button>

        <p className="muted switch">
          {isLogin ? 'New here?' : 'Already have an account?'}{' '}
          <button type="button" className="link" onClick={() => { setMode(isLogin ? 'signup' : 'login'); setError(null); }}>
            {isLogin ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </form>
    </div>
  );
}
