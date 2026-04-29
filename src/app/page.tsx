export default function Home() {
  return (
    <main
      style={{
        maxWidth: 800,
        margin: "0 auto",
        padding: "2rem 1rem",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <img
          src="/logo.jpeg"
          alt="Veilleur"
          style={{ width: 120, height: 120, borderRadius: 24 }}
        />
      </div>
      <h1
        style={{
          fontSize: "2rem",
          fontWeight: 700,
          marginBottom: "0.5rem",
          color: "var(--brand)",
          textAlign: "center",
        }}
      >
        Veilleur
      </h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
        Bot Discord de veille technologique - extrait et synthétise les liens partagés dans vos
        canaux.
      </p>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "1.5rem",
        }}
      >
        <h2 style={{ marginBottom: "1rem" }}>Commande Discord</h2>
        <code
          style={{
            display: "block",
            background: "var(--surface-alt)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "0.75rem 1rem",
            fontFamily: "monospace",
            color: "var(--text)",
          }}
        >
          /veille canal:#tech-watch période:7j
        </code>
        <p style={{ marginTop: "1rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Le bot parcourt le canal indiqué sur la période demandée, extrait les liens et génère une
          liste synthétique de ressources à lire.
        </p>
      </div>
    </main>
  );
}
