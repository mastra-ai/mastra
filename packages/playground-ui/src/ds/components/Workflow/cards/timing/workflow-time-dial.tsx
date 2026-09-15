function pointAt(angle: number, radius: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: 58 + Math.sin(radians) * radius,
    y: 58 - Math.cos(radians) * radius,
  };
}

function DialMark({ angle, major, selected = false }: { angle: number; major: boolean; selected?: boolean }) {
  const outer = pointAt(angle, 49);
  const inner = pointAt(angle, major ? 38 : 43);
  return (
    <line
      x1={inner.x}
      y1={inner.y}
      x2={outer.x}
      y2={outer.y}
      className={selected ? 'workflow-time-dial-marker' : 'workflow-time-dial-tick'}
      data-major={major || undefined}
    />
  );
}

export function TimeDial({ date, amount, unit }: { date?: Date; amount: number; unit: 'ms' | 's' | 'min' | 'h' }) {
  const scale = Math.max({ h: 24, ms: 1000, s: 60, min: 60 }[unit], Math.ceil(amount / 10) * 10);
  const markerAngle = -120 + (amount / scale) * 240;
  const marks = date ? 60 : 41;
  const hourAngle = date ? ((date.getUTCHours() % 12) + date.getUTCMinutes() / 60) * 30 : 0;
  const hour = pointAt(hourAngle, 26);
  const minute = pointAt(date ? date.getUTCMinutes() * 6 : 0, 37);
  return (
    <span className="workflow-time-dial" aria-hidden>
      <svg viewBox="0 0 116 116" fill="none">
        {Array.from({ length: marks }, (_, index) => {
          const angle = date ? index * 6 : -120 + index * 6;
          return <DialMark key={angle} angle={angle} major={index % 5 === 0} />;
        })}
        {date ? (
          <>
            <line x1="58" y1="58" x2={hour.x} y2={hour.y} className="workflow-time-dial-hand" />
            <line x1="58" y1="58" x2={minute.x} y2={minute.y} className="workflow-time-dial-hand" />
            <circle cx="58" cy="58" r="2" fill="currentColor" />
          </>
        ) : (
          <>
            <DialMark angle={markerAngle} major selected />
            <text x="58" y="94" textAnchor="middle">
              {scale} {unit}
            </text>
            <text x="58" y="106" textAnchor="middle" className="workflow-time-dial-scale">
              scale
            </text>
          </>
        )}
      </svg>
    </span>
  );
}
