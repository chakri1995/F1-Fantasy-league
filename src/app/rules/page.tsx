export default function RulesPage() {
  return (
    <main className="container">
      <h1 className="section-header" style={{ marginBottom: '1.25rem' }}>Rules</h1>

      <div className="card">
        <h2>Pick structure</h2>
        <ul>
          <li>Qualifying: pick drivers for positions 1–3</li>
          <li>Sprint qualifying: pick drivers for positions 1–3 (scored same as regular qualifying)</li>
          <li>Sprint: pick drivers for positions 1–5</li>
          <li>Race: pick drivers for positions 1–10</li>
        </ul>

        <h2>Scoring</h2>
        <ul>
          <li>Correct position = 12 points</li>
          <li>1-place difference = 8 points</li>
          <li>2-place difference = 5 points</li>
          <li>3-place difference = 2 points</li>
          <li>Difference greater than the session limit = 0 points</li>
          <li>DNF in any session = 5 points penalty</li>
          <li>10-point bonus for nailing all three podium spots in a session</li>
          <li>50-point mega bonus if all podiums are correct across every session in a weekend</li>
        </ul>

        <h2>Locking</h2>
        <p>Each session has its own deadline. Once the clock passes a session's lock time, picks for that session cannot be changed.</p>

        <h2>Other notes</h2>
        <ul>
          <li>No budget or transfer system.</li>
          <li>Scores are recalculated whenever an admin runs the scoring job (useful after penalties are issued).</li>
          <li>Picks are private; only you can see them. Leaderboard totals are visible to all authenticated users.</li>
        </ul>
      </div>
    </main>
  )
}
