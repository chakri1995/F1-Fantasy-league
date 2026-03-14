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
        <h2 style={{ marginBottom: '0.4rem' }}>Scoring</h2>
        <p className="small" style={{ marginBottom: '1rem' }}>
          An exact match always earns <strong style={{ color: 'var(--ink)' }}>10 points</strong>.
          Each position you are off costs you points — but the penalty rate depends on the session.
          Faster, shorter sessions penalise misses more heavily.
        </p>

        {/* Formula callout */}
        <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-raised)', borderRadius: '8px', border: '1px solid var(--line-bright)', marginBottom: '1.25rem', fontFamily: 'monospace', fontSize: 'var(--font-sm)' }}>
          <span style={{ color: 'var(--muted)' }}>points = </span>
          <span style={{ color: 'var(--ink)', fontWeight: 700 }}>max(0,  10 − diff × decrement)</span>
        </div>

        {/* Per-session tables side by side on wide screens */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          {[
            {
              label: 'Qualifying & Sprint Quali',
              decrement: 3,
              color: '#6366f1',
              rows: [
                { diff: 0, pts: 10, example: 'Exact ✓' },
                { diff: 1, pts: 7,  example: '1 off' },
                { diff: 2, pts: 4,  example: '2 off' },
                { diff: 3, pts: 1,  example: '3 off' },
                { diff: 4, pts: 0,  example: '4+ off' },
              ],
            },
            {
              label: 'Sprint',
              decrement: 2,
              color: '#f59e0b',
              rows: [
                { diff: 0, pts: 10, example: 'Exact ✓' },
                { diff: 1, pts: 8,  example: '1 off' },
                { diff: 2, pts: 6,  example: '2 off' },
                { diff: 3, pts: 4,  example: '3 off' },
                { diff: 4, pts: 2,  example: '4 off' },
                { diff: 5, pts: 0,  example: '5+ off' },
              ],
            },
            {
              label: 'Race',
              decrement: 1,
              color: 'var(--brand)',
              rows: [
                { diff: 0, pts: 10, example: 'Exact ✓' },
                { diff: 1, pts: 9,  example: '1 off' },
                { diff: 3, pts: 7,  example: '3 off' },
                { diff: 5, pts: 5,  example: '5 off' },
                { diff: 9, pts: 1,  example: '9 off' },
                { diff: 10, pts: 0, example: '10+ off' },
              ],
            },
          ].map((session) => (
            <div key={session.label} style={{ background: 'var(--bg-raised)', borderRadius: '8px', border: '1px solid var(--line)', overflow: 'hidden' }}>
              <div style={{ padding: '0.5rem 0.75rem', background: session.color, opacity: 0.9 }}>
                <p style={{ fontWeight: 800, fontSize: 'var(--font-sm)', color: '#fff', margin: 0 }}>{session.label}</p>
                <p style={{ fontSize: 'var(--font-xs)', color: 'rgba(255,255,255,0.8)', margin: 0 }}>−{session.decrement} per position off</p>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-sm)' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '0.35rem 0.6rem', color: 'var(--muted)', fontSize: 'var(--font-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--line)', textAlign: 'left' }}>Diff</th>
                    <th style={{ padding: '0.35rem 0.6rem', color: 'var(--muted)', fontSize: 'var(--font-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--line)', textAlign: 'right' }}>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {session.rows.map((r) => (
                    <tr key={r.diff}>
                      <td style={{ padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: 'var(--font-xs)' }}>{r.example}</td>
                      <td style={{ padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--line)', fontWeight: 800, textAlign: 'right', color: r.pts > 0 ? 'var(--status-saved)' : 'var(--muted)' }}>
                        {r.pts > 0 ? `+${r.pts}` : r.pts}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* DNF + example */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <div style={{ padding: '0.75rem', background: 'rgba(232,0,45,0.07)', borderRadius: '8px', border: '1px solid rgba(232,0,45,0.2)' }}>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--brand)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Driver not in results</p>
            <p className="small">If your picked driver doesn&apos;t appear in the scored positions, you get <strong style={{ color: 'var(--brand)' }}>−5 pts</strong>. This covers DNFs, DNS, and drivers outside the scored positions.</p>
          </div>
          <div style={{ padding: '0.75rem', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <p style={{ fontSize: 'var(--font-xs)', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Example</p>
            <p className="small">
              Race: You pick Verstappen P4, he finishes P7 → diff 3 → <strong style={{ color: 'var(--ink)' }}>10 − 3×1 = +7 pts</strong><br />
              Qualifying: Same pick, diff 3 → <strong style={{ color: 'var(--ink)' }}>10 − 3×3 = +1 pt</strong>
            </p>
          </div>
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
