export default function AuthScreen({ mode, onModeChange, form, setForm, onSubmit, message }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-mark">TaskNest</div>
        <h1>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
        <p>Manage todo lists, tags, stats, and public links from one place.</p>

        <div className="auth-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => onModeChange('login')} type="button">
            Log in
          </button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => onModeChange('signup')} type="button">
            Sign up
          </button>
        </div>

        <form onSubmit={onSubmit} className="auth-form">
          {mode === 'signup' ? (
            <label>
              Name
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
          ) : null}
          <label>
            Email
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label>
            Password
            <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </label>
          <button type="submit" className="primary-btn">
            {mode === 'signup' ? 'Create account' : 'Log in'}
          </button>
        </form>
        {message ? <p className="flash-message">{message}</p> : null}
      </div>
    </div>
  );
}
