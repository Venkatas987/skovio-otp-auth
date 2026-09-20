const STEPS = ['Register', 'Verify email', 'Sign in'];

export default function BrandPanel({ activeStep = 0, title, description }) {
  return (
    <div className="brand-panel">
      <div className="brand-word">Skovio</div>
      <div className="brand-copy">
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="flow-steps">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`flow-step ${i === activeStep ? 'active' : ''} ${i < activeStep ? 'done' : ''}`}
            >
              <span className="dot">{i < activeStep ? '✓' : i + 1}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="brand-footer">Secured with hashed passwords &amp; one-time email codes.</div>
    </div>
  );
}
