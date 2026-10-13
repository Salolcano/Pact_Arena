// Hand-built SVG charts: no chart library, so the look stays under our control.

export function Donut({
  parts,
  center,
  label,
}: {
  parts: { value: number; color: string; name: string }[];
  center: string;
  label: string;
}) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut">
      <svg viewBox="0 0 140 140" width="160" height="160">
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="16" />
        {parts.map((p) => {
          const len = (p.value / total) * c;
          const el = (
            <circle
              key={p.name}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={p.color}
              strokeWidth="16"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
              strokeLinecap="butt"
            >
              <title>{`${p.name}: ${p.value}`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
        <text x="70" y="68" textAnchor="middle" className="donut-center">{center}</text>
        <text x="70" y="86" textAnchor="middle" className="donut-label">{label}</text>
      </svg>
      <ul className="legend">
        {parts.map((p) => (
          <li key={p.name}>
            <span className="dot" style={{ background: p.color }} />
            {p.name} <b>{p.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Ring({ value, max, color = "#7CFFB2" }: { value: number; max: number; color?: string }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const frac = max ? Math.min(value / max, 1) : 0;
  return (
    <svg viewBox="0 0 56 56" width="56" height="56" className="ring">
      <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${frac * c} ${c}`}
        transform="rotate(-90 28 28)"
      />
      <text x="28" y="32" textAnchor="middle" className="ring-text">{`${value}/${max}`}</text>
    </svg>
  );
}

export function Bars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(1, ...values);
  const w = 360;
  const h = 150;
  const gap = 10;
  const bw = (w - gap * (values.length - 1)) / values.length;
  return (
    <svg viewBox={`0 0 ${w} ${h + 22}`} className="bars" role="img" aria-label="Weekly hit rate">
      <defs>
        <linearGradient id="barg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#7CFFB2" />
          <stop offset="100%" stopColor="#1b8f5a" />
        </linearGradient>
      </defs>
      {values.map((v, i) => {
        const bh = (v / max) * h;
        const x = i * (bw + gap);
        return (
          <g key={i}>
            <rect x={x} y={h - bh} width={bw} height={Math.max(bh, 2)} rx="6" fill="url(#barg)" className="bar">
              <title>{`${labels[i]}: ${Math.round(v * 100)}%`}</title>
            </rect>
            <text x={x + bw / 2} y={h + 16} textAnchor="middle" className="bar-label">{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Spark({ values, color = "#FFB84D" }: { values: number[]; color?: string }) {
  const w = 300;
  const h = 80;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * w;
    const y = h - (v / max) * (h - 8) - 4;
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="spark" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkg)" />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

export function OddsBar({ yes, no }: { yes: number; no: number }) {
  const total = yes + no || 1;
  const yesPct = Math.round((yes / total) * 100);
  return (
    <div className="odds">
      <div className="odds-track">
        <div className="odds-yes" style={{ width: `${yesPct}%` }} />
        <div className="odds-no" style={{ width: `${100 - yesPct}%` }} />
      </div>
      <div className="odds-labels">
        <span className="yes-text">YES {yesPct}%</span>
        <span className="no-text">NO {100 - yesPct}%</span>
      </div>
    </div>
  );
}
