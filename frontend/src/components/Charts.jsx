// Small hand-built SVG charts (no chart library needed).
import { useT } from "../i18n";

export function Sparkline({ values, width = 120, height = 34, color = "var(--ink)" }) {
  const { t } = useT();
  const v = values.filter((x) => x != null);
  if (v.length < 2) return <span className="faint">{t("chart.notenough")}</span>;
  const min = Math.min(...v), max = Math.max(...v);
  const span = max - min || 1;
  const pts = v.map((y, i) => [3 + (i / (v.length - 1)) * (width - 6), height - 4 - ((y - min) / span) * (height - 8)]);
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth="2.2"
        strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill={color} />
    </svg>
  );
}

/** Range of motion over time, with the target as a dashed line. series: [{date, best_rom}] */
export function RomChart({ series, target, height = 240 }) {
  const { t, fmtDate } = useT();
  const W = 640, H = height, padL = 44, padR = 16, padT = 16, padB = 34;
  const vals = series.map((s) => s.best_rom).filter((x) => x != null);
  if (vals.length === 0) return <div className="empty">{t("chart.empty")}</div>;
  const lo = Math.max(0, Math.floor((Math.min(...vals, target) - 10) / 10) * 10);
  const hi = Math.ceil((Math.max(...vals, target) + 10) / 10) * 10;
  const x = (i) => padL + (series.length === 1 ? (W - padL - padR) / 2 : (i / (series.length - 1)) * (W - padL - padR));
  const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const ticks = [];
  for (let tk = lo; tk <= hi; tk += (hi - lo) > 60 ? 20 : 10) ticks.push(tk);
  const pts = series.map((s, i) => [x(i), y(s.best_rom)]);
  const area = `M${pts[0][0]},${H - padB} ` + pts.map((p) => `L${p[0]},${p[1]}`).join(" ") + ` L${pts[pts.length - 1][0]},${H - padB} Z`;
  const labelIdx = series.length <= 6 ? series.map((_, i) => i) : [0, Math.floor(series.length / 2), series.length - 1];
  const anchor = (i) => (series.length > 1 && i === 0 ? "start" : series.length > 1 && i === series.length - 1 ? "end" : "middle");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rom-chart" role="img"
      aria-label={`${Math.round(vals[0])}° → ${Math.round(vals[vals.length - 1])}°, ${t("chart.target", { n: Math.round(target) })}`}>
      {ticks.map((tk) => (
        <g key={tk}>
          <line x1={padL} x2={W - padR} y1={y(tk)} y2={y(tk)} stroke="var(--line)" />
          <text x={padL - 8} y={y(tk) + 4} textAnchor="end" fontSize="12" fill="var(--ink-3)">{tk}°</text>
        </g>
      ))}
      <path d={area} fill="rgba(244,164,12,0.14)" />
      <line x1={padL} x2={W - padR} y1={y(target)} y2={y(target)} stroke="var(--rani)" strokeWidth="2" strokeDasharray="6 5" />
      <text x={W - padR} y={y(target) - 7} textAnchor="end" fontSize="12.5" fontWeight="600" fill="var(--rani)">
        {t("chart.target", { n: Math.round(target) })}
      </text>
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 5.5 : 3.5}
          fill={i === pts.length - 1 ? "var(--marigold)" : "var(--ink)"} stroke="#fff" strokeWidth="1.5">
          <title>{fmtDate(series[i].date)}: {Math.round(series[i].best_rom)}°</title>
        </circle>
      ))}
      {labelIdx.map((i) => (
        <text key={i} x={x(i)} y={H - 10} textAnchor={anchor(i)} fontSize="12" fill="var(--ink-3)">{fmtDate(series[i].date)}</text>
      ))}
    </svg>
  );
}

/** Level progress drawn as a stitched line. */
export function ThreadMeter({ progress }) {
  const { t } = useT();
  const W = 300, H = 18;
  const filled = Math.max(0.02, Math.min(1, progress)) * W;
  return (
    <div className="thread-meter">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={t("level.aria", { n: Math.round(progress * 100) })}>
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="var(--line-strong)" strokeWidth="2" strokeDasharray="5 5" />
        <line x1="0" x2={filled} y1={H / 2} y2={H / 2} stroke="var(--rani)" strokeWidth="5" strokeDasharray="9 4" strokeLinecap="round" />
        <path d={`M${filled} ${H / 2 - 7} L${filled + 7} ${H / 2} L${filled} ${H / 2 + 7} L${filled - 7} ${H / 2} Z`} fill="var(--marigold)" />
      </svg>
    </div>
  );
}

export function Stars({ count, size = 34, animate = false }) {
  const { t } = useT();
  return (
    <div className="stars" role="img" aria-label={t("stars.aria", { n: count })}>
      {[0, 1, 2].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24"
          className={animate && i < count ? "star-pop" : ""} style={{ animationDelay: `${300 + i * 260}ms` }}>
          <path d="M12 2 L15 9 L22 9.6 L16.6 14.3 L18.3 21.4 L12 17.6 L5.7 21.4 L7.4 14.3 L2 9.6 L9 9 Z"
            fill={i < count ? "var(--marigold)" : "var(--line)"} stroke={i < count ? "#c98200" : "none"} strokeWidth="1" />
        </svg>
      ))}
    </div>
  );
}
