export default function RulesPage() {
  return (
    <main className="container">
      <h1 className="section-header" style={{ marginBottom: '1.5rem' }}>How to Play</h1>

      {/* ── What you pick ── */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginBottom: '0.75rem' }}>What you pick</h2>
        <p className="small" style={{ marginBottom: '1rem' }}>
          Before each session locks, predict which drivers will finish in the top positions.
          Each session has its own picks — you can submit them independently up until the lock time.
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-sm)' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem', color: 'var(--muted)', fontSize: 'var(--font-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--line)' }}>Session</th>
              <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem', color: 'var(--muted)', fontSize: 'var(--font-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--line)' }}>Positions to Pick</th>
              <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem', color: 'var(--muted)', fontSize: 'var(--font-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--line)' }}>Locks before</th>
            </tr>
          </thead>
          <tbody>
            {[
              { session: 'Qualifying', picks: 'P1 – P3 (top 3)', locks: 'Qualifying session starts' },
              { session: 'Sprint Qualifying', picks: 'P1 – P3 (top 3)', locks: 'Sprint Qualifying starts' },
              { session: 'Sprint', picks: 'P1 – P5 (top 5)', locks: 'Sprint race starts' },
              { session: 'Race', picks: 'P1 – P10 (top 10)', locks: 'Race starts' },
            ].map((row) => (
              <tr key={row.session}>
                <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--line)', fontWeight: 600 }}>{row.session}</td>
                <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--line)', color: 'var(--brand)', fontWeight: 700 }}>{row.picks}</td>
                <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>{row.locks}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-raised)', borderRadius: '8px', border: '1px solid var(--line)' }}>
          <p style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
            ⚠ Important
          </p>
          <p className="small">
            Once a session&apos;s lock time passes, your picks for that session are frozen — even if you haven&apos;t saved them yet.
            The app shows a 🔒 icon on locked sessions. Save early!
          </p>
        </div>
      </div>

      {/* ── Scoring ── */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginBottom: '0.75rem' }}>Scoring</h2>
        <p className="small" style={{ marginBottom: '1rem' }}>
          Points are based on how close your prediction was to the actual finishing position.
          The closer you are, the more points you earn.
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-sm)', marginBottom: '1rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem', color: 'var(--muted)', fontSize: 'var(--font-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--line)' }}>How far off</th>
              <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem', color: 'var(--muted)', fontSize: 'var(--font-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--line)' }}>Points</th>
              <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem', color: 'var(--muted)', fontSize: 'var(--font-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--line)' }}>Example</th>
            </tr>
          </thead>
          <tbody>
            {[
              { diff: 'Exact match', pts: '+12', example: 'You pick Norris P1, he finishes P1 ✓' },
              { diff: '1 place off', pts: '+8', example: 'You pick Norris P1, he finishes P2' },
              { diff: '2 places off', pts: '+5', example: 'You pick Norris P1, he finishes P3' },
              { diff: '3 places off', pts: '+2', example: 'You pick Norris P1, he finishes P4' },
              { diff: 'More than 3 off*', pts: '0', example: 'You pick Norris P1, he finishes P6' },
              { diff: 'Driver DNF', pts: '−5', example: 'You picked Hamilton, he retired from the race' },
            ].map((row) => (
              <tr key={row.diff}>
                <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--line)', fontWeight: 600 }}>{row.diff}</td>
                <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--line)', fontWeight: 800, color: row.pts.startsWith('+') ? 'var(--status-saved)' : 'var(--brand)' }}>{row.pts}</td>
                <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: 'var(--font-xs)' }}>{row.example}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="small" style={{ marginBottom: '0.5rem' }}>
          * The max offset varies by session: Qualifying and Sprint Qualifying allow up to 3 places off. Sprint allows up to 5. Race allows up to 10.
        </p>

        <div style={{ padding: '0.75rem', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
          <p style={{ fontSize: 'var(--font-xs)', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
            Race session example
          </p>
          <p className="small">
            You pick Verstappen P4, he finishes P7 → that&apos;s 3 places off → <strong style={{ color: 'var(--ink)' }}>+2 pts</strong>.
            In a Race (max offset 10), this still scores. In Qualifying (max offset 3), it would score the same.
            But if he finished P8 (4 places off) in Qualifying, it would be <strong style={{ color: 'var(--ink)' }}>0 pts</strong>.
          </p>
        </div>
      </div>

      {/* ── Bonuses ── */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginBottom: '0.75rem' }}>Bonus Points</h2>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ padding: '0.85rem', background: 'var(--bg-raised)', borderRadius: '8px', border: '1px solid var(--line)', borderLeft: '3px solid var(--brand)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <p style={{ fontWeight: 700, fontSize: 'var(--font-md)' }}>Perfect Podium Bonus</p>
              <span style={{ fontWeight: 800, color: 'var(--brand)', fontSize: '1.1rem' }}>+10 pts</span>
            </div>
            <p className="small" style={{ marginBottom: '0.4rem' }}>
              Get all three podium positions (P1, P2, P3) exactly right in any single session.
            </p>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)', background: 'var(--card)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
              Example: You pick Norris P1, Piastri P2, Russell P3 — and that&apos;s exactly what happens → +10 bonus on top of your regular points.
            </p>
          </div>

          <div style={{ padding: '0.85rem', background: 'var(--bg-raised)', borderRadius: '8px', border: '1px solid var(--line)', borderLeft: '3px solid #f59e0b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <p style={{ fontWeight: 700, fontSize: 'var(--font-md)' }}>Mega Bonus — Perfect Weekend</p>
              <span style={{ fontWeight: 800, color: '#f59e0b', fontSize: '1.1rem' }}>+50 pts</span>
            </div>
            <p className="small" style={{ marginBottom: '0.4rem' }}>
              Nail the perfect podium in <em>all four sessions</em> in the same race weekend.
            </p>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)', background: 'var(--card)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
              Incredibly hard to do — but worth 50 extra points if you pull it off.
            </p>
          </div>
        </div>
      </div>

      {/* ── Locking & Scores ── */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginBottom: '0.75rem' }}>Lock Times &amp; Score Updates</h2>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div>
            <p style={{ fontWeight: 600, marginBottom: '0.3rem' }}>When do picks lock?</p>
            <p className="small">
              Each session has its own cutoff. As soon as that time passes, picks for that session are frozen.
              You can still edit other sessions that haven&apos;t locked yet.
              The picks page shows the exact lock time per session, and a 🔒 icon once it&apos;s locked.
            </p>
          </div>

          <div>
            <p style={{ fontWeight: 600, marginBottom: '0.3rem' }}>When do scores appear?</p>
            <p className="small">
              Scores are <strong style={{ color: 'var(--ink)' }}>not live</strong> — they are calculated by the league admin
              after each session finishes and official results are confirmed. This means:
            </p>
            <ul style={{ marginTop: '0.4rem', paddingLeft: '1.2rem', fontSize: 'var(--font-sm)', color: 'var(--muted)', lineHeight: 1.7 }}>
              <li>Results page may show 0 for a session even after the race — wait for the admin to run scoring.</li>
              <li>If stewards change a result, the admin can re-run scoring to update everyone&apos;s points.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Other notes ── */}
      <div className="card">
        <h2 style={{ marginBottom: '0.75rem' }}>Other Notes</h2>
        <ul style={{ paddingLeft: '1.2rem', fontSize: 'var(--font-sm)', color: 'var(--muted)', lineHeight: 1.9 }}>
          <li>No budget cap or driver transfers — just pure prediction.</li>
          <li>Your picks are <strong style={{ color: 'var(--ink)' }}>private</strong>. No one can see what you picked until after the session locks.</li>
          <li>The leaderboard shows everyone&apos;s total points across all races.</li>
          <li>Not all race weekends have a Sprint — for non-sprint weekends, only Qualifying and Race picks count.</li>
        </ul>
      </div>
    </main>
  )
}
