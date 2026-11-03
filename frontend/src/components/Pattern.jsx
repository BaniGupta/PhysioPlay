// Colourful diamond pattern used as the brand's visual signature:
// the login hero, the thin band under the top bar, and the practice calendar
// where every finished session fills one diamond.
import { useT } from "../i18n";

const COLORS = ["#F4A40C", "#D4246E", "#F4A40C", "#2F7D4F"];

export function Diamond({ cx, cy, r, fill, stroke, strokeWidth = 0, dash }) {
  const d = `M${cx} ${cy - r} L${cx + r} ${cy} L${cx} ${cy + r} L${cx - r} ${cy} Z`;
  return <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} strokeLinejoin="round" />;
}

/** One filled tile: outer marigold, inner pink, small light centre, with fine texture lines. */
export function Tile({ cx, cy, r, colors = ["#F4A40C", "#D4246E", "#FFF4DE"] }) {
  const lines = [];
  for (let i = -3; i <= 3; i++) {
    const off = (i / 4) * r;
    const half = r - Math.abs(off);
    lines.push(<line key={i} x1={cx - half} y1={cy + off} x2={cx + half} y2={cy + off}
      stroke="rgba(255,255,255,0.28)" strokeWidth={Math.max(0.6, r / 22)} />);
  }
  return (
    <g>
      <Diamond cx={cx} cy={cy} r={r} fill={colors[0]} />
      {lines}
      <Diamond cx={cx} cy={cy} r={r * 0.56} fill={colors[1]} />
      <Diamond cx={cx} cy={cy} r={r * 0.2} fill={colors[2]} />
    </g>
  );
}

/** Large pattern for the login screen. Each tile pops in once, from the centre outwards. */
export function HeroPattern({ cols = 7, rows = 7, size = 520 }) {
  const step = size / cols;
  const r = step / 2 - 2;
  const items = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const dist = Math.abs(x - (cols - 1) / 2) + Math.abs(y - (rows - 1) / 2);
      const ring = Math.round(dist) % 4;
      items.push(
        <g key={`${x}-${y}`} className="pop-cell" style={{ animationDelay: `${dist * 90}ms` }}>
          <Tile cx={step / 2 + x * step} cy={step / 2 + y * step} r={r}
            colors={[COLORS[ring], ring % 2 ? "#F4A40C" : "#D4246E", "#FFF4DE"]} />
        </g>
      );
    }
  }
  return <svg viewBox={`0 0 ${size} ${size}`} className="hero-pattern" aria-hidden="true">{items}</svg>;
}

export function PatternBand({ count = 40, height = 14 }) {
  const step = height * 1.4;
  return (
    <svg className="pattern-band" viewBox={`0 0 ${count * step} ${height}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <Diamond key={i} cx={step / 2 + i * step} cy={height / 2} r={height / 2 - 1} fill={COLORS[i % COLORS.length]} />
      ))}
    </svg>
  );
}

/** One diamond per day. Empty days are dashed outlines, practice days are filled. Today gets a ring. */
export function PracticeCalendar({ days, columns = 7, cell = 44 }) {
  const { t, fmtDate, weekdayNarrow: weekday } = useT();
  const rows = Math.ceil(days.length / columns);
  const r = cell / 2 - 3;
  const today = new Date().toISOString().slice(0, 10);
  const labelH = 22;
  return (
    <svg viewBox={`0 0 ${columns * cell} ${rows * cell + labelH}`} className="practice-calendar" role="img"
      aria-label={t("cal.aria", { n: days.filter((d) => d.sessions).length, total: days.length })}>
      {days.slice(-columns).map((d, i) => (
        <text key={d.date} x={cell / 2 + i * cell} y={14} textAnchor="middle" fontSize="12" fill="var(--ink-3)">{weekday(d.date)}</text>
      ))}
      {days.map((d, i) => {
        const cx = cell / 2 + (i % columns) * cell;
        const cy = labelH + cell / 2 + Math.floor(i / columns) * cell;
        return (
          <g key={d.date}>
            <title>{d.sessions ? t("cal.cell", { date: fmtDate(d.date), n: d.sessions }) : t("cal.cell0", { date: fmtDate(d.date) })}</title>
            {d.sessions ? (
              <Tile cx={cx} cy={cy} r={r} colors={d.sessions > 1 ? ["#2F7D4F", "#F4A40C", "#FFF4DE"] : undefined} />
            ) : (
              <Diamond cx={cx} cy={cy} r={r} fill="none" stroke="var(--line-strong)" strokeWidth={1.6} dash="3 3" />
            )}
            {d.date === today && <Diamond cx={cx} cy={cy} r={r + 2.5} fill="none" stroke="var(--ink)" strokeWidth={2.2} />}
          </g>
        );
      })}
    </svg>
  );
}
